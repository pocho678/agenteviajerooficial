import { Grafo } from "./Grafo.js";
import { buscarCiclos } from "./BuscadorCiclos.js";

export const MAPA = { x0: -5, y0: -5, ancho: 30, alto: 20 };   // plano de "km"
const SEPARACION = 5;                                   // distancia mínima entre nodos
const MIN_CICLOS = 4, MAX_CICLOS = 30;                  // pocos ciclos, pero no uno solo

const barajar = (v, rng) => { for (let i = v.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [v[i], v[j]] = [v[j], v[i]]; } return v; };
const orient = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
const seCruzan = (a, b, c, d) => orient(a, b, c) !== orient(a, b, d) && orient(c, d, a) !== orient(c, d, b);

function distanciaASegmento(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  if (t <= 0 || t >= 1) return Infinity;                // solo cuenta si cae "dentro" del tramo
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function generarPosiciones(n, rng) {
  let sep = SEPARACION, pos = [], intentos = 0;
  while (pos.length < n) {
    const p = { x: Math.round(MAPA.x0 + rng() * MAPA.ancho), y: Math.round(MAPA.y0 + rng() * MAPA.alto) };
    if (pos.every((q) => Math.hypot(p.x - q.x, p.y - q.y) >= sep)) pos.push(p);
    else if (++intentos % 200 === 0) sep *= 0.9;
  }
  return pos;
}

/** Quita cruces del recorrido base (2-opt) para que el grafo se lea mejor. */
function destrabar(orden, pos) {
  const n = orden.length;
  for (let mejora = true; mejora;) {
    mejora = false;
    for (let i = 0; i < n - 1; i++)
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        if (seCruzan(pos[orden[i]], pos[orden[i + 1]], pos[orden[j]], pos[orden[(j + 1) % n]])) {
          orden.splice(i + 1, j - i, ...orden.slice(i + 1, j + 1).reverse());
          mejora = true;
        }
      }
  }
}

/**
 * Nodos dispersos en coordenadas (como casa en (0,0), iglesia en (10,5)...).
 * Aristas = un ciclo garantizado + pocas conexiones cercanas; peso = distancia redondeada.
 */
export function generarGrafoAleatorio(n, rng = Math.random, completo = false) {
  if (completo) {                       // todos los nodos conectados entre sí, como en la lectura: (n-1)!/2 ciclos
    const g = new Grafo(generarPosiciones(n, rng));
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) g.agregarArista(a, b, g.pesoSugerido(a, b));
    return g;
  }
  let grafo;
  for (let intento = 0; intento < 200; intento++) {
    const pos = generarPosiciones(n, rng), claro = Math.max(0.6, 2.6 - intento * 0.01);   // aire alrededor de cada nodo
    grafo = new Grafo(pos);
    const orden = barajar([...Array(n).keys()], rng);
    destrabar(orden, pos);
    const libre = (a, b) => pos.every((p, k) => k === a || k === b || distanciaASegmento(p, pos[a], pos[b]) > claro);
    const base = orden.map((a, i) => [a, orden[(i + 1) % n]]);
    if (!base.every(([a, b]) => libre(a, b))) continue;
    const conectar = (a, b) => grafo.agregarArista(a, b, grafo.pesoSugerido(a, b));
    base.forEach(([a, b]) => conectar(a, b));

    const cruza = (a, b) => grafo.aristas().some(({ a: c, b: d }) =>
      a !== c && a !== d && b !== c && b !== d && seCruzan(pos[a], pos[b], pos[c], pos[d]));
    const candidatas = [];
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++)
      if (!grafo.existe(a, b) && libre(a, b)) candidatas.push([a, b]);
    candidatas.sort((p, q) => grafo.distancia(...p) - grafo.distancia(...q));
    const extras = [];
    for (const [a, b] of barajar(candidatas.slice(0, 8 * n), rng)) {
      if (buscarCiclos(grafo).length >= MIN_CICLOS) break;
      if (cruza(a, b)) continue;                        // ninguna arista cruza a otra
      conectar(a, b); extras.push([a, b]);
    }
    while (extras.length && buscarCiclos(grafo).length > MAX_CICLOS) grafo.eliminarArista(...extras.pop());
    return grafo;
  }
  return grafo;
}

/** Grafo dirigido: ciclo base A→...→A que garantiza un recorrido; arcos adicionales respetan los límites. */
export function generarGrafoDirigido(n, { maxEntrada = 3, maxSalida = 3 } = {}, rng = Math.random) {
  const g = new Grafo(generarPosiciones(n, rng), { dirigido:true, maxEntrada, maxSalida });
  const orden = barajar([...Array(n).keys()], rng);
  for (let i = 0; i < n; i++) {
    const a = orden[i], b = orden[(i + 1) % n];
    g.agregarArista(a,b,g.pesoSugerido(a,b));
  }
  const candidatos = [];
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if(a !== b && !g.existe(a,b)) candidatos.push([a,b]);
  barajar(candidatos,rng);
  // Intentamos arcos extra sin superar los máximos y evitando listas enormes de ciclos.
  for (const [a,b] of candidatos) {
    if (g.gradoSalida(a) >= maxSalida || g.gradoEntrada(b) >= maxEntrada) continue;
    if (rng() > 0.27) continue;
    g.agregarArista(a,b,g.pesoSugerido(a,b));
    if (buscarCiclos(g).length > 120) g.eliminarArista(a,b);
  }
  return g;
}
