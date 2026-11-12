(function () {
"use strict";
// ===== domain/Grafo =====
const PESO_MAX = 25;   // peso máximo de una arista
const nombreNodo = (i) => String.fromCharCode(65 + i);

/** Agregado raíz: nodos con coordenadas (x, y) y aristas ponderadas no dirigidas. */
class Grafo {
  constructor(posiciones, { dirigido = false, maxEntrada = 3, maxSalida = 3 } = {}) {
    this.dirigido = dirigido;
    this.maxEntrada = maxEntrada;
    this.maxSalida = maxSalida;
    this.posiciones = posiciones;
    this.n = posiciones.length;
    this.matriz = Array.from({ length: this.n }, (_, i) =>
      Array.from({ length: this.n }, (_, j) => (i === j ? 0 : Infinity)));
  }
  gradoEntrada(i) { return this.matriz.reduce((s, fila, a) => s + (a !== i && fila[i] !== Infinity ? 1 : 0), 0); }
  gradoSalida(i) { return this.vecinos(i).length; }
  agregarArista(a, b, peso) {
    if (a === b) throw new Error("No se permiten bucles.");
    if (this.dirigido && !this.existe(a,b) && (this.gradoSalida(a) >= this.maxSalida || this.gradoEntrada(b) >= this.maxEntrada))
      throw new Error(`Límite de grado alcanzado: máximo ${this.maxSalida} salidas y ${this.maxEntrada} entradas por nodo.`);
    this.matriz[a][b] = peso;
    if (!this.dirigido) this.matriz[b][a] = peso;
  }
  eliminarArista(a, b) { this.matriz[a][b] = Infinity; if (!this.dirigido) this.matriz[b][a] = Infinity; }
  peso(a, b) { return this.matriz[a][b]; }
  existe(a, b) { return a !== b && this.matriz[a][b] !== Infinity; }
  vecinos(i) { return this.matriz[i].map((_, j) => j).filter((j) => this.existe(i, j)); }
  aristas() {
    const lista = [];
    for (let a = 0; a < this.n; a++)
      for (let b = this.dirigido ? 0 : a + 1; b < this.n; b++)
        if (this.existe(a, b)) lista.push({ a, b, peso: this.matriz[a][b] });
    return lista;
  }
  /** Peso entero (1 a 25) proporcional a la distancia entre dos nodos del plano de 30 x 20. */
  pesoSugerido(a, b) { return Math.min(PESO_MAX, Math.max(1, Math.round((this.distancia(a, b) * PESO_MAX) / Math.hypot(30, 20)))); }
  distancia(a, b) {
    const p = this.posiciones[a], q = this.posiciones[b];
    return Math.hypot(p.x - q.x, p.y - q.y);
  }
}

// ===== domain/Ciclo =====
/** Objeto de valor: recorrido cerrado, p. ej. [0, 2, 1, 3, 0]. */
class Ciclo {
  constructor(nodos) { this.nodos = nodos; }
  costo(grafo, k = this.nodos.length) {
    let total = 0;
    for (let i = 0; i < k - 1; i++) {
      const p = grafo.peso(this.nodos[i], this.nodos[i + 1]);
      if (p === Infinity) return Infinity;
      total += p;
    }
    return total;
  }
  texto(k = this.nodos.length) {
    return this.nodos.slice(0, k).map(nombreNodo).join(" → ");
  }
}

// ===== domain/BuscadorCiclos =====
/** Backtracking: todos los ciclos hamiltonianos desde A (sin contar el sentido inverso). */
function buscarCiclos(grafo) {
  const { n } = grafo, ciclos = [], usado = Array(n).fill(false), camino = [0];
  usado[0] = true;
  const ady = Array.from({ length: n }, (_, i) => grafo.vecinos(i));
  (function recorrer() {
    const ultimo = camino[camino.length - 1];
    if (camino.length === n) {
      if (grafo.existe(ultimo, 0) && (grafo.dirigido || camino[1] < camino[n - 1])) ciclos.push(new Ciclo([...camino, 0]));
      return;
    }
    for (const s of ady[ultimo]) {
      if (usado[s]) continue;
      usado[s] = true; camino.push(s);
      recorrer();
      camino.pop(); usado[s] = false;
    }
  })();
  return ciclos;
}

/** Ciclo al que le faltan menos aristas (con poda) para sugerirlo al usuario. */
function sugerirAristasFaltantes(grafo) {
  const { n } = grafo, usado = Array(n).fill(false), camino = [0];
  let mejor = null, menor = Infinity;
  usado[0] = true;
  (function recorrer(faltan) {
    if (faltan >= menor) return;
    const ultimo = camino[camino.length - 1];
    if (camino.length === n) {
      const total = faltan + (grafo.existe(ultimo, 0) ? 0 : 1);
      if (total < menor) { menor = total; mejor = [...camino, 0]; }
      return;
    }
    for (let s = 1; s < n; s++) {
      if (usado[s]) continue;
      usado[s] = true; camino.push(s);
      recorrer(faltan + (grafo.existe(ultimo, s) ? 0 : 1));
      camino.pop(); usado[s] = false;
    }
  })(0);
  if (!mejor) return null;
  const faltantes = [];
  for (let i = 0; i < mejor.length - 1; i++)
    if (!grafo.existe(mejor[i], mejor[i + 1])) faltantes.push({ a: mejor[i], b: mejor[i + 1] });
  return { ciclo: new Ciclo(mejor), faltantes };
}

// ===== domain/Analisis =====
const ciclosPosibles = (n) => { let f = 1; for (let i = 2; i < n; i++) f *= i; return f / 2; };   // (n-1)!/2
const formatoNumero = (x) => Number(x).toLocaleString("es-PE");

/** Teorema de Dirac: si todo vértice tiene grado >= n/2 (n >= 3), el grafo es hamiltoniano. */
function dirac(grafo) {
  const gradoMin = Math.min(...grafo.matriz.map((_, i) => grafo.vecinos(i).length));
  return { gradoMin, umbral: grafo.n / 2, cumple: !grafo.dirigido && grafo.n >= 3 && gradoMin >= grafo.n / 2 };
}

/** Heurística voraz: va siempre al vecino no visitado más cercano. Devuelve null si no logra cerrar el ciclo. */
function vecinoMasCercano(grafo, inicio = 0) {
  const ruta = [inicio], visto = new Set(ruta);
  while (ruta.length < grafo.n) {
    const actual = ruta[ruta.length - 1];
    const sig = grafo.vecinos(actual).filter((v) => !visto.has(v)).sort((a, b) => grafo.peso(actual, a) - grafo.peso(actual, b))[0];
    if (sig === undefined) return null;
    ruta.push(sig); visto.add(sig);
  }
  if (!grafo.existe(ruta[ruta.length - 1], inicio)) return null;
  const ciclo = new Ciclo([...ruta, inicio]);
  return { ciclo, costo: ciclo.costo(grafo) };
}

/** Grado (número de conexiones) de cada nodo. */
const grados = (grafo) => grafo.matriz.map((_, i) => grafo.vecinos(i).length);
const gradosDirigidos = (grafo) => grafo.matriz.map((_,i) => ({entrada:grafo.gradoEntrada(i), salida:grafo.gradoSalida(i)}));
/** Densidad = 2m / (n(n-1)): 0 sin aristas, 1 grafo completo. */
const densidad = (grafo) => ((grafo.dirigido ? 1 : 2) * grafo.aristas().length) / (grafo.n * (grafo.n - 1));

// ===== domain/GeneradorAleatorio =====
const MAPA = { x0: -5, y0: -5, ancho: 30, alto: 20 };   // plano de "km"
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
function generarGrafoAleatorio(n, rng = Math.random, completo = false) {
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
function generarGrafoDirigido(n, { maxEntrada = 3, maxSalida = 3 } = {}, rng = Math.random) {
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

// ===== domain/Ejemplos =====
const letra = (c) => c.charCodeAt(0) - 65;
const crear = (puntos, pesos) => {                       // pesos: matriz o lista de pares "AB"
  const g = new Grafo(puntos.map(([x, y]) => ({ x, y })));
  if (Array.isArray(pesos[0])) pesos.forEach((fila, a) => fila.forEach((p, b) => a < b && g.agregarArista(a, b, p)));
  else pesos.forEach((par) => { const [a, b] = [letra(par[0]), letra(par[1])]; g.agregarArista(a, b, g.pesoSugerido(a, b)); });
  return g;
};

const EJEMPLOS = [
  { nombre: "Lectura 7 · Práctica autónoma (5 ciudades)", leyenda: "Distancias en km de la práctica de la lectura. Respuesta esperada: mínimo 46 km.",
    crear: () => crear([[0, 0], [14, 2], [20, 13], [6, 18], [-6, 9]],
      [[0, 12, 15, 8, 13], [12, 0, 6, 9, 11], [15, 6, 0, 13, 14], [8, 9, 13, 0, 6], [13, 11, 14, 6, 0]]) },
  { nombre: "Reparto en Lima (6 puntos)", leyenda: "A = almacén; B a F = clientes. Pesos en km.",
    crear: () => crear([[0, 0], [8, 3], [15, 1], [17, 10], [9, 13], [1, 9]], ["AB", "BC", "CD", "DE", "EF", "FA", "BE"]) },
  { nombre: "Soldadura de una placa (7 puntos)", leyenda: "Puntos de soldadura de un circuito; pesos = distancia en mm.",
    crear: () => crear([[0, 0], [6, -3], [14, -2], [19, 5], [12, 9], [5, 8], [9, 3]], ["AB", "BC", "CD", "DE", "EG", "GF", "FA", "BG", "CE"]) },
];

// ===== domain/Persistencia =====
const LIMITE_CICLOS = 5000;   // si hay más, el archivo guarda solo el total y el óptimo

/** Convierte el grafo, sus ciclos Hamiltonianos y el óptimo (fuerza bruta) en texto JSON. */
function serializar(grafo, ciclos, mejor) {
  return JSON.stringify({
    app: "TSP-fuerza-bruta", version: 2, dirigido: grafo.dirigido, maxEntrada: grafo.maxEntrada, maxSalida: grafo.maxSalida, fecha: new Date().toISOString(),
    nodos: grafo.posiciones.map((p, i) => ({ id: String.fromCharCode(65 + i), x: p.x, y: p.y })),
    aristas: grafo.aristas().map(({ a, b, peso }) => ({ a, b, peso })),
    totalCiclos: ciclos.length,
    ciclos: ciclos.length <= LIMITE_CICLOS ? ciclos.map((c) => ({ ruta: c.texto(), costo: c.costo(grafo) })) : "omitidos (más de 5000)",
    optimo: mejor ? { ruta: mejor.texto(), costo: mejor.costo(grafo) } : null,
  }, null, 2);
}

/** Reconstruye el grafo desde un archivo guardado, validando todo. */
function deserializar(texto) {
  let d;
  try { d = JSON.parse(texto); } catch { throw new Error("El archivo no es un JSON válido."); }
  if (d?.app !== "TSP-fuerza-bruta" || !Array.isArray(d.nodos) || !Array.isArray(d.aristas)) throw new Error("No parece un grafo guardado por esta aplicación.");
  const n = d.nodos.length;
  if (n < 5 || n > 10) throw new Error("El grafo debe tener entre 5 y 10 nodos.");
  const g = new Grafo(d.nodos.map((p) => ({ x: Number(p.x), y: Number(p.y) })), { dirigido: d.dirigido === true, maxEntrada: d.maxEntrada ?? 3, maxSalida: d.maxSalida ?? 3 });
  if (g.posiciones.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw new Error("Hay coordenadas inválidas.");
  for (const { a, b, peso } of d.aristas) {
    const bien = [a, b].every((v) => Number.isInteger(v) && v >= 0 && v < n) && a !== b && Number.isInteger(peso) && peso > 0 && peso <= PESO_MAX;
    if (!bien) throw new Error("Hay una arista inválida en el archivo.");
    g.agregarArista(a, b, peso);
  }
  return g;
}

// ===== application/Sesion =====
/** Recorre los ciclos paso a paso (nodo por nodo) y recuerda el mejor. */
class FuerzaBruta {
  constructor(grafo, ciclos) {
    Object.assign(this, { grafo, ciclos, i: 0, k: 1, mejorCosto: Infinity, mejor: null });
  }
  get ciclo() { return this.ciclos[this.i]; }
  get rutaCompleta() { return this.k === this.ciclo.nodos.length; }
  get finalizado() { return this.i === this.ciclos.length - 1 && this.rutaCompleta; }
  _evaluar() {
    const c = this.ciclo.costo(this.grafo);
    if (c < this.mejorCosto) { this.mejorCosto = c; this.mejor = this.ciclo; }
  }
  avanzar() {
    if (this.rutaCompleta) { if (this.finalizado) return; this.i++; this.k = 2; }
    else this.k++;
    if (this.rutaCompleta) this._evaluar();
  }
  completarRuta() { while (!this.rutaCompleta) this.avanzar(); }
  resolverTodo() { while (!this.finalizado) this.avanzar(); }
}

/** Estado de la sesión de trabajo (casos de uso). */
class Sesion {
  constructor() { this.reiniciar(); }
  reiniciar() { this.completo = false; this.config = { dirigido:false, maxEntrada:3, maxSalida:3 }; this.ejemplo = null; this.grafo = null; this.modo = ""; this.fuerza = null; this._ciclos = null; }
  iniciarManual(n, config = {}) {                       // nodos dispersos, sin aristas todavía
    this.reiniciar(); this.modo = "manual"; this.config = { ...this.config, ...config };
    this.grafo = new Grafo(generarGrafoAleatorio(n).posiciones, this.config);
  }
  iniciarAleatorio(n, completo = false, config = {}) { this.reiniciar(); this.modo = "aleatorio"; this.config = { ...this.config, ...config }; this.completo = completo && !this.config.dirigido; this.grafo = this.config.dirigido ? generarGrafoDirigido(n, this.config) : generarGrafoAleatorio(n, Math.random, completo); }
  iniciarDesdeGrafo(grafo) { this.reiniciar(); this.modo = "archivo"; this.grafo = grafo; }
  cambioElGrafo() { this._ciclos = null; }
  iniciarEjemplo(ej) { this.reiniciar(); this.modo = "ejemplo"; this.ejemplo = ej; this.grafo = ej.crear(); }
  get ciclos() { return (this._ciclos ??= buscarCiclos(this.grafo)); }
  iniciarFuerzaBruta() { this.fuerza = new FuerzaBruta(this.grafo, this.ciclos); return this.fuerza; }
}

// ===== ui/Navegador =====
const PANTALLAS = ["Inicio", "Construccion", "Verificacion", "Grafo", "Ciclos", "Matriz", "Fuerza", "Resultado"];

/** Muestra una pantalla, actualiza el progreso (1 a 7) y hace que el botón Atrás del navegador funcione. */
class Navegador {
  constructor(permitir = (nombre) => nombre) {
    this.permitir = permitir;
    this.desdeHistorial = false;
    try { history.replaceState({ nombre: "Inicio", paso: 1 }, "", "#inicio"); } catch { /* sin historial */ }
    window.addEventListener("popstate", (e) => {
      if (!e.state) return;
      const destino = this.permitir(e.state.nombre);
      this.desdeHistorial = true;
      this.ir(destino, destino === e.state.nombre ? e.state.paso : 1);
      this.desdeHistorial = false;
    });
  }
  ir(nombre, paso) {
    document.body.dataset.vista = nombre.toLowerCase();
    PANTALLAS.forEach((p) => document.getElementById("pantalla" + p).classList.toggle("oculta", p !== nombre));
    for (let i = 1; i <= 7; i++) document.getElementById("progreso" + i).classList.toggle("activo", i <= paso);
    const texto = document.getElementById("textoPaso");
    if (texto) texto.textContent = `Paso ${paso} de 7`;
    window.scrollTo?.({ top: 0 });
    if (!this.desdeHistorial) {
      try { history.pushState({ nombre, paso }, "", "#" + nombre.toLowerCase()); } catch { /* sin historial */ }
    }
  }
}

// ===== ui/Paginador =====
/** Pinta `total` elementos de a `porPagina`, con botones Anterior/Siguiente. */
function paginar(contenedor, total, porPagina, pintar, claseCuerpo = "") {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  let actual = 0;
  const cuerpo = document.createElement("div");
  cuerpo.className = claseCuerpo;
  const nav = document.createElement("div");
  nav.className = "botones paginador";
  nav.innerHTML = `<button class="secundario boton-pequeno" data-d="-1">Anterior</button>
    <span class="pagina"></span><button class="secundario boton-pequeno" data-d="1">Siguiente</button>`;
  const [ant, sig] = nav.querySelectorAll("button");
  const etiqueta = nav.querySelector(".pagina");
  const dibujar = () => {
    cuerpo.replaceChildren();
    pintar(cuerpo, actual * porPagina, Math.min(total, (actual + 1) * porPagina));
    etiqueta.textContent = `Página ${actual + 1} de ${paginas}`;
    ant.disabled = actual === 0;
    sig.disabled = actual >= paginas - 1;
  };
  nav.addEventListener("click", (e) => {
    const d = Number(e.target.dataset.d);
    if (d) { actual += d; dibujar(); }
  });
  contenedor.replaceChildren(cuerpo, ...(paginas > 1 ? [nav] : []));
  dibujar();
}

// ===== ui/RenderizadorGrafo =====
const COLORES_CICLO = ["#129b91", "#e0731a", "#d32f2f", "#7e57c2", "#f9a825", "#1e88e5", "#43a047", "#ec407a", "#6d4c41", "#00acc1"];
const MIN_CICLOS_COLORES = 2;
/** Si hay más de 1 ciclo, cada uno tiene su propio color, el mismo en todas las pantallas. */
const colorDeCiclo = (indice, total) => (total >= MIN_CICLOS_COLORES ? COLORES_CICLO[indice % COLORES_CICLO.length] : null);
const oscurecer = (hex, f = 0.35) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - f)).toString(16).padStart(2, "0")).join("");
const COLORES_NODO = ["#1769AA", "#2E7D32", "#7B1FA2", "#00838F", "#AD1457", "#5D4037", "#283593", "#558B2F", "#37474F", "#9E6B00"];
const TENUE = "#b7ccdf", RUTA = "#129b91", RUTA_OSC = "#08736e", TEXTO = "#12304A";

function flecha(ctx, p, q, radio, color, ancho, punta) {
  const ang = Math.atan2(q.y - p.y, q.x - p.x), c = Math.cos(ang), s = Math.sin(ang);
  const ini = { x: p.x + c * radio, y: p.y + s * radio }, fin = { x: q.x - c * (radio + 2), y: q.y - s * (radio + 2) };
  ctx.strokeStyle = ctx.fillStyle = color; ctx.lineWidth = ancho; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(ini.x, ini.y); ctx.lineTo(fin.x, fin.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(fin.x, fin.y);
  for (const d of [-0.45, 0.45]) ctx.lineTo(fin.x - punta * Math.cos(ang + d), fin.y - punta * Math.sin(ang + d));
  ctx.closePath(); ctx.fill();
}

function etiquetaPeso(ctx, a, b, peso, mini, color, k) {
  const [p, q] = a.i < b.i ? [a, b] : [b, a], dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy) || 1, d = mini ? 9 : 14 * k;
  const x = (p.x + q.x) / 2 - (dy / L) * d, y = (p.y + q.y) / 2 + (dx / L) * d;
  ctx.font = `bold ${mini ? 11 : Math.round(15 * k)}px Trebuchet MS`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineJoin = "round"; ctx.lineWidth = 4; ctx.strokeStyle = "white"; ctx.strokeText(peso, x, y);
  ctx.fillStyle = color; ctx.fillText(peso, x, y);
}

/** Dibuja el grafo en un canvas que se redibuja solo al cambiar de tamaño (responsivo). */
class LienzoGrafo {
  /** mapa: {x0, y0, ancho, alto} fija el plano para que nada se reacomode al arrastrar nodos. */
  constructor(canvas, { mini = false, mapa = null } = {}) {
    this.canvas = canvas; this.mini = mini; this.mapa = mapa; this.args = null; this.mostrarTodosPesos = false; this.ocultarPesos = false; this.nodoFoco = -1; this.nodoFiltro = -1;
    new ResizeObserver(() => this.pintar()).observe(canvas);
  }
  /** ciclo: Ciclo a resaltar con flechas; k: cuántos nodos del ciclo mostrar. */
  mostrar(grafo, { ciclo = null, k = ciclo ? ciclo.nodos.length : 0, posiciones = null, color = null } = {}) {
    this.args = { grafo, ciclo, k, posiciones, color };
    this.canvas.setAttribute("role", "img");
    this.canvas.setAttribute("aria-label", `Grafo de ${grafo.n} nodos` + (ciclo ? `. Ruta: ${ciclo.texto(k)}` : ""));
    this.pintar();
  }
  /** Arrastra nodos sin alterar las conexiones ni sus pesos. */
  habilitarArrastre(alCambiar) {
    const c = this.canvas;
    let mover = -1, activo = false;
    const punto = (e) => {
      const r = c.getBoundingClientRect();
      return { x: (e.clientX - r.left) * c.clientWidth / r.width,
        y: (e.clientY - r.top) * c.clientHeight / r.height };
    };
    c.style.touchAction = "none";
    c.style.cursor = "grab";
    c.addEventListener("pointerdown", (e) => {
      if (!this.pix || !this.args) return;
      const p = punto(e);
      mover = this.pix.findIndex(q => Math.hypot(q.x - p.x, q.y - p.y) <= this.proy.radio + 7);
      if (mover < 0) return;
      activo = true;
      c.style.cursor = "grabbing";
      c.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    });
    c.addEventListener("pointermove", (e) => {
      if (!activo || mover < 0 || !this.args) {
        if (!this.pix || !this.args) return;
        const p = punto(e);
        const nuevo = this.pix.findIndex(q => Math.hypot(q.x - p.x, q.y - p.y) <= this.proy.radio + 7);
        if (nuevo !== this.nodoFoco) { this.nodoFoco = nuevo; this.pintar(); }
        return;
      }
      const p = punto(e), proy = this.proy;
      const margen = proy.margen;
      const x = Math.max(margen, Math.min(c.clientWidth - margen, p.x));
      const y = Math.max(margen, Math.min(c.clientHeight - margen, p.y));
      // Evitar nodos superpuestos (en píxeles, incluso al cambiar el tamaño).
      if (this.pix.some((q, i) => i !== mover && Math.hypot(q.x - x, q.y - y) < 2 * proy.radio + 12)) return;
      const coordenada = {
        x: Math.round((proy.x0 + (x - margen) / proy.sx) * 10) / 10,
        y: Math.round((proy.y0 + (y - margen) / proy.sy) * 10) / 10
      };
      this.args.grafo.posiciones[mover] = coordenada;
      this.pintar();
      alCambiar?.();
    });
    const soltar = () => {
      activo = false;
      mover = -1;
      c.style.cursor = "grab";
    };
    c.addEventListener("pointerleave", () => { if (!activo && this.nodoFoco !== -1) { this.nodoFoco = -1; this.pintar(); } });
    c.addEventListener("pointerup", soltar);
    c.addEventListener("pointercancel", soltar);
    c.addEventListener("lostpointercapture", soltar);
  }
  pintar() {
    const { canvas, mini, args, mapa } = this, w = canvas.clientWidth, h = canvas.clientHeight;
    if (!args || !w || !h) return;
    const { grafo, ciclo, k: pasos, color } = args, posiciones = args.posiciones || grafo.posiciones, dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);

    const radio = mini ? 12 : Math.max(16, Math.min(32, w / 28)), k = mini ? 1 : radio / 24, margen = radio + (mini ? 12 : 24);
    const xs = posiciones.map((p) => p.x), ys = posiciones.map((p) => p.y);
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    this.proy = mapa ? { x0: mapa.x0, y0: mapa.y0, radio, margen, sx: (w - 2 * margen) / mapa.ancho, sy: (h - 2 * margen) / mapa.alto }
      : this.fija ?? { x0, y0, radio, margen, sx: (w - 2 * margen) / (Math.max(...xs) - x0 || 1), sy: (h - 2 * margen) / (Math.max(...ys) - y0 || 1) };
    const { sx, sy } = this.proy;
    const pos = this.pix = posiciones.map((p, i) => ({ i, x: margen + (p.x - this.proy.x0) * sx, y: margen + (p.y - this.proy.y0) * sy }));

    const tramos = ciclo ? ciclo.nodos.slice(0, pasos).slice(1).map((b, i) => [ciclo.nodos[i], b]) : [];
    const enCiclo = (a, b) => tramos.some(([u, v]) => u === a && v === b || (!grafo.dirigido && u === b && v === a));
    for (const { a, b } of grafo.aristas()) {
      if (this.nodoFiltro >= 0 && a !== this.nodoFiltro && b !== this.nodoFiltro) continue;
      ctx.strokeStyle = TENUE; ctx.lineWidth = (mini ? 1.5 : 2) * k; ctx.beginPath();
      if (grafo.dirigido) flecha(ctx, pos[a], pos[b], radio, TENUE, (mini ? 1.5 : 2) * k, mini ? 6 : 10 * k);
      else { ctx.moveTo(pos[a].x, pos[a].y); ctx.lineTo(pos[b].x, pos[b].y); ctx.stroke(); }
    }
    for (const [a, b] of tramos) flecha(ctx, pos[a], pos[b], radio, color || RUTA, mini ? 3 : 5 * k, mini ? 9 : 15 * k);
    // En grafos densos, evitar mostrar 30–45 etiquetas superpuestas.
    // Pasando el cursor por un nodo se revelan los pesos de sus conexiones.
    const denso = grafo.aristas().length > 18;
    for (const { a, b, peso } of grafo.aristas()) {
      const visible = !this.ocultarPesos && (this.nodoFiltro < 0 || a === this.nodoFiltro || b === this.nodoFiltro) &&
        (mini ? enCiclo(a, b) :
        this.mostrarTodosPesos || !denso || enCiclo(a, b) || a === this.nodoFoco || b === this.nodoFoco);
      if (visible) etiquetaPeso(ctx, pos[a], pos[b], peso, mini, enCiclo(a, b) ? (color ? oscurecer(color) : RUTA_OSC) : TEXTO, k);
    }
    pos.forEach((p, i) => {
      ctx.beginPath(); ctx.arc(p.x, p.y, radio, 0, 2 * Math.PI);
      ctx.fillStyle = COLORES_NODO[i % COLORES_NODO.length]; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.stroke();
      ctx.fillStyle = "white"; ctx.font = `bold ${mini ? 13 : Math.round(18 * k)}px Trebuchet MS`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(nombreNodo(i), p.x, p.y);
    });
  }
}

// ===== ui/Controlador =====
const puntoCiclo = (color) => (color ? `<span class="punto-ciclo" style="background:${color}"></span>` : "");
const $ = (id) => document.getElementById(id);
const on = (id, fn) => $(id).addEventListener("click", fn);
const aviso = (el, texto, color) => { el.setAttribute("aria-live", "polite"); el.textContent = (color === "red" ? "Error: " : "") + texto; el.style.color = color; };
const tabla = (cabeza, filas, clase = "") =>
  `<div class="tabla-scroll"><table class="${clase}"><thead><tr>${cabeza.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${filas.join("")}</tbody></table></div>`;

/** Orquesta las 8 pantallas: lee la Sesión (aplicación) y pinta (UI). */
class Controlador {
  constructor() {
    this.sesion = new Sesion();
    this.posicionesOriginales = new WeakMap();
    this.nav = new Navegador((n) => this.#permitir(n));
    const av = document.createElement("p");
    av.id = "avisoVerificacion"; av.className = "aviso-error";
    $("resultadoVerificacion").after(av);
    this.cicloActual = 0;
    this.optimos = [];
    this.optimoActual = 0;
    this.lienzo = { ciclos: new LienzoGrafo($("canvasCicloUnico"), { mapa: MAPA }), grafo: new LienzoGrafo($("canvasGrafo"), { mapa: MAPA }), ruta: new LienzoGrafo($("canvasRuta"), { mapa: MAPA }), resultado: new LienzoGrafo($("canvasResultado"), { mapa: MAPA }), construccion: new LienzoGrafo($("canvasConstruccion"), { mapa: MAPA }) };
    this.lienzo.construccion.habilitarArrastre(() => this.#sugerirPeso());
    // Solo el mapa es editable: ciclos, fuerza bruta y resultado muestran el plano original.
    this.lienzo.grafo.habilitarArrastre(() => {});
    this.#enlazar();
    this.#herramientasGrafo();
    this.#herramientasAleatorias();
    this.nav.ir("Inicio", 1);
  }
  /** Acciones del lienzo, independientes del algoritmo y de los pesos. */
  #herramientasGrafo() {
    const lienzos = { canvasGrafo: this.lienzo.grafo, canvasRuta: this.lienzo.ruta, canvasResultado: this.lienzo.resultado, canvasCicloUnico: this.lienzo.ciclos };
    document.querySelectorAll("button[data-canvas][data-tool]").forEach((boton) => {
      boton.addEventListener("click", async () => {
        const vista = lienzos[boton.dataset.canvas];
        if (!vista) return;
        if (boton.dataset.tool === "weights") {
          vista.ocultarPesos = !vista.ocultarPesos;
          vista.mostrarTodosPesos = !vista.ocultarPesos;
          boton.setAttribute("aria-pressed", String(!vista.ocultarPesos));
          boton.textContent = vista.ocultarPesos ? "Mostrar pesos" : "Ocultar pesos";
          vista.pintar();
        }
      });
    });
  }
  /** Mantiene una fotografía de las posiciones iniciales sin modificar el grafo ni sus pesos. */
  #guardarPosicionesOriginales() {
    if (this.grafo && !this.posicionesOriginales.has(this.grafo)) {
      this.posicionesOriginales.set(this.grafo, this.grafo.posiciones.map(({ x, y }) => ({ x, y })));
    }
  }
  #restaurarPosiciones() {
    const original = this.grafo && this.posicionesOriginales.get(this.grafo);
    if (!original) return;
    this.grafo.posiciones.splice(0, this.grafo.posiciones.length, ...original.map((p) => ({ ...p })));
    for (const lienzo of Object.values(this.lienzo)) {
      if (lienzo.args?.grafo === this.grafo) lienzo.pintar();
    }
    // El texto de coordenadas no se actualiza durante el arrastre ni al restaurar.
  }
  /** Las funciones se despliegan por encima del mapa, sin quitarle ancho. */
  #herramientasAleatorias() {
    const panel = $("panelGrafo"), boton = $("btnPanelAleatorio");
    const mostrar = (visible) => {
      panel.classList.toggle("panel-abierto", visible);
      boton.setAttribute("aria-expanded", String(visible));
      boton.textContent = visible ? "Ocultar funciones ✕" : "Datos y funciones ☰";
    };
    boton.addEventListener("click", () => mostrar(!panel.classList.contains("panel-abierto")));
    $("btnCerrarPanelAleatorio").addEventListener("click", () => mostrar(false));
    $("btnRestaurarPosiciones").addEventListener("click", () => this.#restaurarPosiciones());

    document.addEventListener("keydown", (e) => { if (e.key === "Escape") mostrar(false); });
    this.cerrarPanelGrafo = () => mostrar(false);
  }
  get grafo() { return this.sesion.grafo; }
  /** Vuelve al inicio como si la página se acabara de abrir. */
  #irAlInicio() {
    this.sesion.reiniciar(); this.fb = null;
    document.body.classList.remove("modo-aleatorio");
    this.cerrarPanelGrafo?.();
    for (const id of ["pesoArista"]) $(id).value = "";
    $("cantidadNodos").value = "7";
    for (const id of ["mensaje", "mensajeArista", "avisoVerificacion"]) $(id).textContent = "";
    $("chkCompleto").checked = false;
    this.nav.ir("Inicio", 1);
  }
  #permitir(n) { return (!this.grafo && n !== "Inicio") || (["Fuerza", "Resultado"].includes(n) && !this.fb) ? "Inicio" : n; }

  #leerConfig() {
    // La portada ofrece por ahora únicamente el grafo no dirigido.
    return { dirigido: false, maxEntrada: 3, maxSalida: 3 };
  }
  // ---------- Inicio y construcción ----------
  #cantidad() {
    const n = parseInt($("cantidadNodos").value, 10), msg = $("mensaje");
    if (Number.isNaN(n)) return void aviso(msg, "Ingresa una cantidad de nodos.", "red");
    if (n < 5 || n > 10) return void aviso(msg, "La cantidad debe estar entre 5 y 10.", "red");
    msg.textContent = "";
    return n;
  }
  #iniciarManual(n) {
    document.body.classList.remove("modo-aleatorio");
    this.sesion.iniciarManual(n, this.#leerConfig());
    const opciones = [...Array(n).keys()].map((i) => `<option value="${i}">${nombreNodo(i)}</option>`).join("");
    $("nodoOrigen").innerHTML = $("nodoDestino").innerHTML = opciones;
    $("nodoDestino").value = "1";
    $("mensajeArista").textContent = "";
    this.#sugerirPeso(); this.#listarAristas();
    this.nav.ir("Construccion", 2);
    this.lienzo.construccion.mostrar(this.grafo);
  }
  #sugerirPeso() {
    const a = +$("nodoOrigen").value, b = +$("nodoDestino").value;
    $("pesoArista").placeholder = a === b ? "Peso" : `Sugerido: ${this.grafo.pesoSugerido(a, b)}`;
  }
  #agregarArista() {
    const a = +$("nodoOrigen").value, b = +$("nodoDestino").value, peso = Number($("pesoArista").value), msg = $("mensajeArista");
    if (a === b) return aviso(msg, "No puedes conectar un nodo consigo mismo.", "red");
    if (!Number.isInteger(peso) || peso < 1 || peso > PESO_MAX) return aviso(msg, `El peso debe ser un número entero entre 1 y ${PESO_MAX}.`, "red");
    const actualiza = this.grafo.existe(a, b);
    try { this.grafo.agregarArista(a, b, peso); } catch (err) { return aviso(msg, err.message, "red"); }
    this.sesion.cambioElGrafo();
    aviso(msg, actualiza ? "Conexión actualizada." : (this.grafo.dirigido ? `Arco ${nombreNodo(a)} → ${nombreNodo(b)} agregado.` : "Arista agregada correctamente."), "green");
    $("pesoArista").value = "";
    this.#listarAristas();
    this.lienzo.construccion.mostrar(this.grafo);
  }
  #listarAristas() {
    const aristas = this.grafo.aristas();
    $("listaAristas").innerHTML = aristas.length === 0 ? "<p>No se han agregado aristas todavía.</p>" :
      tabla([this.grafo.dirigido ? "Desde" : "Origen", this.grafo.dirigido ? "Hacia →" : "Destino", "Peso", "Editar", "Eliminar"], aristas.map(({ a, b, peso }) =>
        `<tr><td>${nombreNodo(a)}</td><td>${nombreNodo(b)}</td><td>${peso}</td>
         <td><button class="boton-pequeno boton-editar" data-acc="editar" data-a="${a}" data-b="${b}">Editar</button></td>
         <td><button class="boton-pequeno boton-eliminar" data-acc="eliminar" data-a="${a}" data-b="${b}">Eliminar</button></td></tr>`));
  }
  #accionArista(e) {
    const { acc, a, b } = e.target.dataset;
    if (!acc) return;
    if (acc === "eliminar") { this.grafo.eliminarArista(+a, +b); this.sesion.cambioElGrafo(); this.#listarAristas(); this.lienzo.construccion.mostrar(this.grafo); return; }
    $("nodoOrigen").value = a; $("nodoDestino").value = b; $("pesoArista").value = this.grafo.peso(+a, +b);
    aviso($("mensajeArista"), "Modifica el peso y presiona 'Agregar arista'.", "#1769aa");
  }

  // ---------- Verificación, grafo, ciclos, matriz ----------
  #verificar() {
    this.#guardarPosicionesOriginales();
    const ciclos = this.sesion.ciclos, caja = $("resultadoVerificacion");
    $("avisoVerificacion").textContent = "";
    if (ciclos.length > 0) {
      caja.innerHTML = `<div class="exito"><strong>El grafo permite ciclos Hamiltonianos.</strong><br><br>Se encontraron <strong>${ciclos.length}</strong> ciclos Hamiltonianos.<br><br>El grafo puede continuar con el proceso.${ciclos.length > 5000 ? "<br><br>Son muchos ciclos: paso a paso será largo, usa «Resolver todo»." : ""}</div>`;
    } else {
      const s = sugerirAristasFaltantes(this.grafo);
      const lista = s ? `<br><br><strong>Conexiones que podrían completar un ciclo:</strong><ul class="lista-faltantes">${s.faltantes.map((f) => `<li>${nombreNodo(f.a)} ${this.grafo.dirigido ? "→" : "—"} ${nombreNodo(f.b)}</li>`).join("")}</ul>${this.grafo.dirigido ? "Ten en cuenta los grados máximos configurados; quizá debas eliminar o modificar otros arcos antes de añadir estas conexiones.<br>" : ""}Recorrido propuesto:<br><strong>${s.ciclo.texto()}</strong>` : "";
      caja.innerHTML = `<div class="error"><strong>El grafo no contiene ningún ciclo Hamiltoniano.</strong><br><br>Revisa las conexiones necesarias para completar al menos un ciclo.${lista}</div>`;
    }
    const d = dirac(this.grafo), ej = this.sesion.ejemplo;
    caja.insertAdjacentHTML("beforeend", `${ej ? `<p class="teoria"><strong>Ejemplo:</strong> ${ej.nombre}. ${ej.leyenda}</p>` : ""}
      <p class="teoria"><strong>${this.grafo.dirigido ? "Grafo dirigido" : "Teorema de Dirac"}:</strong> ${this.grafo.dirigido ? `El teorema de Dirac clásico corresponde a grafos no dirigidos. Aquí se comprueban los ciclos respetando el sentido de las flechas y los límites de grado.` : d.cumple
        ? `todos los vértices tienen grado ≥ n/2 (grado mínimo ${d.gradoMin} ≥ ${d.umbral}), así que el grafo es hamiltoniano.`
        : `el grado mínimo es ${d.gradoMin} y n/2 = ${d.umbral}. La condición no se cumple, pero eso no descarta un ciclo: Dirac es suficiente, no necesaria.`}</p>`);
    this.nav.ir("Verificacion", 3);
  }
  #actualizarCoordenadas() {
    if (!this.grafo) return;
    // Mostrar solo al entrar al mapa: coordenadas iniciales, redondeadas a enteros.
    const originales = this.#posicionesOriginales() || this.grafo.posiciones;
    $("coordenadas").textContent = "Coordenadas iniciales (x, y): " + originales
      .map((p, i) => `${nombreNodo(i)} (${Math.round(p.x)}, ${Math.round(p.y)})`).join(" · ");
  }
  #posicionesOriginales() {
    return this.grafo ? this.posicionesOriginales.get(this.grafo) : null;
  }
  #iniciarFiltros() {
    const caja = $("nodosFiltro");
    caja.replaceChildren();
    for (let i = 0; i < this.grafo.n; i++) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip-nodo"; b.textContent = nombreNodo(i);
      b.addEventListener("click", () => this.#filtrarNodo(i));
      caja.append(b);
    }
    this.#filtrarNodo(-1);
  }
  #filtrarNodo(i) {
    this.lienzo.grafo.nodoFiltro = i;
    $("nodosFiltro").querySelectorAll("button").forEach((b, k) => b.classList.toggle("activo", i === k));
    $("btnMostrarTodo").classList.toggle("activo", i < 0);
    this.lienzo.grafo.pintar();
  }
  #mostrarCicloActual() {
    const ciclos = this.sesion.ciclos;
    this.cicloActual = Math.max(0, Math.min(this.cicloActual, ciclos.length - 1));
    const c = ciclos[this.cicloActual];
    const color = colorDeCiclo(this.cicloActual, ciclos.length);
    $("cicloContador").innerHTML = `${puntoCiclo(color)}Ciclo ${formatoNumero(this.cicloActual + 1)} de ${formatoNumero(ciclos.length)}`;
    $("cicloRutaTexto").textContent = c.texto();
    $("cicloCostoTexto").textContent = `Costo total: ${c.costo(this.grafo)}`;
    $("btnCicloAnterior").disabled = this.cicloActual === 0;
    $("btnCicloSiguiente").disabled = this.cicloActual === ciclos.length - 1;
    this.lienzo.ciclos.mostrar(this.grafo, { ciclo: c, color, posiciones: this.#posicionesOriginales() });
  }
  #verGrafo() {
    if (this.sesion.ciclos.length === 0) return aviso($("avisoVerificacion"), "Primero completa el grafo: debe existir al menos un ciclo hamiltoniano.", "red");
    document.body.classList.toggle("modo-aleatorio", this.sesion.modo === "aleatorio");
    this.#guardarPosicionesOriginales();
    this.cerrarPanelGrafo();
    $("btnGenerarOtroGrafo").hidden = this.sesion.modo !== "aleatorio";
    this.#actualizarCoordenadas();
    const g = this.grafo, d = densidad(g);
    $("analisisGrafo").innerHTML = `<p class="teoria"><strong>${g.dirigido ? "Densidad dirigida" : "Densidad"}:</strong> ${g.aristas().length} ${g.dirigido ? "arcos" : "aristas"} de ${g.n * (g.n-1) / (g.dirigido ? 1 : 2)} posibles = ${Math.round(d * 100)} %. ${g.dirigido ? "Cada dirección se cuenta por separado: densidad = m / n(n−1)." : "Densidad = 2m / n(n−1)."}</p>` +
      (g.dirigido ? tabla(["Nodo", "Grado interno", "Grado externo"], gradosDirigidos(g).map((x,i)=>`<tr><td>${nombreNodo(i)}</td><td>${x.entrada} / ${g.maxEntrada}</td><td>${x.salida} / ${g.maxSalida}</td></tr>`))
      : tabla(["Nodo", "Grado (conexiones)"], grados(g).map((x, i) => `<tr><td>${nombreNodo(i)}</td><td>${x}</td></tr>`)));
    this.nav.ir("Grafo", 3);
    this.lienzo.grafo.ocultarPesos = g.aristas().length > 18;
    this.lienzo.grafo.mostrarTodosPesos = false;
    const botonPesos = document.querySelector('[data-canvas="canvasGrafo"][data-tool="weights"]');
    botonPesos.textContent = this.lienzo.grafo.ocultarPesos ? "Mostrar pesos" : "Ocultar pesos";
    this.lienzo.grafo.mostrar(this.grafo);
    this.#iniciarFiltros();
  }
  #verCiclos() {
    const ciclos = this.sesion.ciclos;
    const n = this.grafo.n, posibles = this.grafo.dirigido ? ciclosPosibles(n) * 2 : ciclosPosibles(n);
    $("resumenCiclos").innerHTML = `<h3>¿Por qué hay ${formatoNumero(ciclos.length)} ciclos?</h3>
      <p>Con ${n} nodos, un grafo ${this.grafo.dirigido ? "dirigido sin restricciones de grado" : "completo no dirigido"} permitiría hasta <strong>${formatoNumero(posibles)}</strong> rutas distintas.</p>
      <p>${ciclos.length === posibles ? "Están disponibles todos los recorridos." : "Las conexiones y sus direcciones restringen los recorridos que pueden completarse."}</p>
      <details><summary>¿De dónde sale este máximo?</summary><p>En grafos no dirigidos completos: <strong>(n − 1)! / 2</strong> (el inverso cuenta igual). En grafos dirigidos completos: <strong>(n − 1)!</strong> (el inverso puede ser otro recorrido).</p><p>Con 15 nodos habría ${formatoNumero(this.grafo.dirigido ? ciclosPosibles(15)*2 : ciclosPosibles(15))} rutas para un grafo completo de este tipo; por eso la aplicación se limita a 10.</p></details>`;
    this.cicloActual = 0;
    $("teoriaCiclos").hidden = true;
    this.nav.ir("Ciclos", 4);
    this.#mostrarCicloActual();
  }
  #verMatriz() {
    const g = this.grafo, idx = [...Array(g.n).keys()];
    $("contenedorMatriz").innerHTML = tabla(["", ...idx.map(nombreNodo)], idx.map((i) =>
      `<tr><th>${nombreNodo(i)}</th>${idx.map((j) => `<td>${g.peso(i, j) === Infinity ? "∞" : g.peso(i, j)}</td>`).join("")}</tr>`), "matriz");
    this.nav.ir("Matriz", 5);
  }

  // ---------- Fuerza bruta y resultado ----------
  #iniciarFuerza() {
    this.fb = this.sesion.iniciarFuerzaBruta();
    this.nav.ir("Fuerza", 6);
    this.#pintarFuerza();
  }
  #pintarFuerza() {
    const f = this.fb, g = this.grafo, c = f.ciclo, k = f.k, color = colorDeCiclo(f.i, f.ciclos.length);
    $("numeroRuta").textContent = `${f.i + 1} / ${f.ciclos.length}`;
    $("costoActual").textContent = c.costo(g, k);
    $("mejorCostoActual").textContent = f.mejor ? f.mejorCosto : "-";
    $("rutaActual").innerHTML = `<strong>${puntoCiclo(color)}Ruta en construcción:</strong> ${c.texto(k)}` + (f.rutaCompleta ? `<br><br><strong>Costo total de la ruta:</strong> ${c.costo(g)}` : "");
    $("btnSiguienteRuta").textContent = f.finalizado ? "Ver resultado final" : f.rutaCompleta ? "Ir al siguiente ciclo" : "Siguiente paso";
    $("btnPasoRapido").textContent = $("btnSiguienteRuta").textContent + " →";
    $("btnCompletarRuta").disabled = f.rutaCompleta;
    this.lienzo.ruta.mostrar(g, { ciclo: c, k, color, posiciones: this.#posicionesOriginales() });
  }
  #siguiente() {
    const f = this.fb;
    if (f.finalizado) return this.#resultado();
    f.avanzar();
    this.#pintarFuerza();
    if (f.rutaCompleta) this.#avisoCiclo();
  }
  /** Ventana emergente al terminar cada ciclo: avisa qué sigue. */
  #avisoCiclo() {
    const f = this.fb, c = f.ciclo, ultimo = f.finalizado, d = $("dialogoCiclo");
    $("tituloCiclo").textContent = `Ciclo ${f.i + 1} de ${f.ciclos.length} completado`;
    $("textoCiclo").innerHTML = `Ruta: <strong>${c.texto()}</strong><br>Costo total: <strong>${c.costo(this.grafo)}</strong><br>` +
      (f.mejor === c ? "Es el mejor ciclo hasta ahora." : `El mejor hasta ahora cuesta ${f.mejorCosto}.`) + "<br><br>" +
      (ultimo ? "Ya se evaluaron todos los ciclos." : `A continuación se pasa al ciclo ${f.i + 2} de ${f.ciclos.length}.`);
    $("btnDialogoContinuar").textContent = ultimo ? "Ver resultado final" : `Ir al ciclo ${f.i + 2}`;
    $("btnDialogoResolver").hidden = ultimo;
    d.showModal ? d.showModal() : d.setAttribute("open", "");
  }
  #resultado() {
    const f = this.fb, g = this.grafo;
    f.resolverTodo();
    $("resumenResultado").innerHTML = `<div class="resumen">
      <div class="resumen-item"><span>Nodos</span><strong>${g.n}</strong></div>
      <div class="resumen-item"><span>Ciclos encontrados</span><strong>${f.ciclos.length}</strong></div>
      <div class="resumen-item"><span>Costo mínimo</span><strong>${f.mejorCosto}</strong></div></div>`;
    // Puede haber varios ciclos diferentes con el mismo costo mínimo.
    this.optimos = f.ciclos.filter(c => c.costo(g) === f.mejorCosto);
    this.optimoActual = 0;
    this.#mostrarOptimo();
    paginar($("tablaResultados"), f.ciclos.length, 50, (cuerpo, desde, hasta) => {
      const filas = [];
      for (let i = desde; i < hasta; i++) {
        const costo = f.ciclos[i].costo(g);
        filas.push(`<tr${costo === f.mejorCosto ? ' class="optimo"' : ""}><td>${puntoCiclo(colorDeCiclo(i, f.ciclos.length))}${i + 1}</td><td>${f.ciclos[i].texto()}</td><td>${costo}</td></tr>`);
      }
      cuerpo.innerHTML = tabla(["Nº", "Ciclo Hamiltoniano", "Costo total"], filas);
    });
    const r = f.mejor.nodos, total = g.n;
    $("analisisCiclo").innerHTML = `<p class="teoria">Dentro del ciclo orientado, cada nodo recibe una flecha (grado interno 1) y envía una flecha (grado externo 1). ${g.dirigido ? "El grafo original también es dirigido, pero puede tener más entradas y salidas según los máximos configurados." : "El grafo original es no dirigido; las flechas aquí indican únicamente el orden del recorrido."}</p>` +
      tabla(["Nodo", "Entra", "Sale", "Grado interno", "Grado externo"], r.slice(0, -1).map((v, i) =>
        `<tr><td>${nombreNodo(v)}</td><td>${nombreNodo(r[(i + total - 1) % total])} → ${nombreNodo(v)}</td><td>${nombreNodo(v)} → ${nombreNodo(r[i + 1])}</td><td>1</td><td>1</td></tr>`));
    this.nav.ir("Resultado", 7);
    this.#mostrarOptimo();
    const v = vecinoMasCercano(g);
    const extra = v ? v.costo - f.mejorCosto : null;
    $("comparacionCostoVecino").textContent = v ? formatoNumero(v.costo) : "No encontró ciclo";
    // Cuando el método voraz no completa el recorrido, no hay costo comparable.
    const tarjetaVecino = $("comparacionCostoVecino").closest(".comparacion-metodo");
    const unidadVecino = tarjetaVecino?.querySelector("small");
    const etiquetaVecino = tarjetaVecino?.querySelector(".comparacion-chip");
    if (unidadVecino) unidadVecino.textContent = v ? "Unidades de costo" : "No hay costo total";
    if (etiquetaVecino) etiquetaVecino.textContent = v ? "Ruta aproximada" : "Recorrido incompleto";
    $("comparacionCostoFuerza").textContent = formatoNumero(f.mejorCosto);
    $("comparacionDiferencia").innerHTML = !v
      ? `<strong>Diferencia de costos</strong><p>No es posible comparar los costos: vecino más cercano no encontró un ciclo completo.</p>`
      : `<strong>Diferencia de costos</strong><div class="comparacion-dato"><span>${extra} ${extra === 1 ? "unidad adicional" : "unidades adicionales"}</span><b>${((100 * extra) / f.mejorCosto).toFixed(2)} % más</b></div>`;
    $("comparacionExplicacion").textContent = !v
      ? `Vecino más cercano elige en cada paso la conexión más barata hacia un nodo no visitado. En este grafo, sus elecciones lo dejaron sin una conexión para continuar o para regresar al origen A. Esto no significa que el grafo no tenga ciclos hamiltonianos: fuerza bruta sí encontró uno válido y comprobó que su costo mínimo es ${formatoNumero(f.mejorCosto)}.`
      : extra === 0
        ? "En este grafo, las decisiones del vecino más cercano dieron el mismo costo mínimo que fuerza bruta. Sin embargo, no ocurre siempre."
        : "El vecino más cercano eligió en cada paso la conexión de menor costo disponible, pero eso no garantizó la ruta completa más barata. Fuerza bruta comparó todos los ciclos válidos y encontró uno mejor.";
  }

  #mostrarOptimo() {
    if (!this.optimos?.length || !this.grafo) return;
    const c = this.optimos[this.optimoActual], color = colorDeCiclo(this.fb.ciclos.indexOf(c), this.fb.ciclos.length);
    const cantidad = this.optimos.length;
    $("rutaOptima").innerHTML = `<strong>${cantidad === 1 ? "Ciclo óptimo" : "Ciclos óptimos"} (${cantidad})</strong><br><br><span class="ruta-optima-texto">${puntoCiclo(color)}${c.texto()}</span><br><br>Costo total mínimo: ${this.fb.mejorCosto}`;
    $("optimosNavegador").hidden = cantidad < 2;
    $("optimoIndicador").textContent = `${this.optimoActual + 1} de ${cantidad}`;
    $("btnOptimoAnterior").disabled = this.optimoActual === 0;
    $("btnOptimoSiguiente").disabled = this.optimoActual === cantidad - 1;
    this.lienzo.resultado.mostrar(this.grafo, { ciclo: c, color, posiciones: this.#posicionesOriginales() });
  }

  #enlazar() {
    const elegir = (modo) => () => { const n = this.#cantidad(); if (n) { if (modo === "manual") this.#iniciarManual(n); else { this.sesion.iniciarAleatorio(n, $("chkCompleto").checked, this.#leerConfig()); this.#verificar(); } } };
    on("btnMenosNodo", () => { $("cantidadNodos").value = Math.max(5, (+$("cantidadNodos").value || 7) - 1); });
    on("btnMasNodo", () => { $("cantidadNodos").value = Math.min(10, (+$("cantidadNodos").value || 7) + 1); });
    on("btnIrCiclosRapido", () => $("btnContinuarCiclos").click());
    on("btnPasoRapido", () => $("btnSiguienteRuta").click());
    on("btnManual", elegir("manual"));
    on("btnAleatorio", elegir("aleatorio"));
    $("nodoOrigen").addEventListener("change", () => this.#sugerirPeso());
    $("nodoDestino").addEventListener("change", () => this.#sugerirPeso());
    on("btnAgregarArista", () => this.#agregarArista());
    $("listaAristas").addEventListener("click", (e) => this.#accionArista(e));
    on("btnVerificar", () => this.grafo.aristas().length === 0 ? aviso($("mensajeArista"), "Debe agregar al menos una arista.", "red") : this.#verificar());
    $("selectorEjemplo").innerHTML = EJEMPLOS.map((e, i) => `<option value="${i}">${e.nombre}</option>`).join("");
    on("btnEjemplo", () => { this.sesion.iniciarEjemplo(EJEMPLOS[$("selectorEjemplo").value]); this.#verificar(); });
    on("btnExportarPng", () => { const a = document.createElement("a"); a.download = "ciclo-optimo.png"; a.href = $("canvasResultado").toDataURL("image/png"); a.click(); });
    on("btnExportarPdf", () => window.print());
    const regenerar = (despues) => () => { this.sesion.iniciarAleatorio(this.grafo.n, this.sesion.completo, this.sesion.config); despues(); };
    $("pesoArista").addEventListener("keydown", (e) => e.key === "Enter" && this.#agregarArista());
    on("btnVolverInicio", () => this.#irAlInicio());
    on("btnGuardar", () => {
      const f = this.fb, a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([serializar(this.grafo, f.ciclos, f.mejor)], { type: "application/json" }));
      a.download = "grafo-tsp.json"; a.click(); URL.revokeObjectURL(a.href);
    });
    on("btnCargarArchivo", () => $("archivoGrafo").click());
    $("archivoGrafo").addEventListener("change", async (e) => {
      const archivo = e.target.files[0]; e.target.value = "";
      if (!archivo) return;
      try { this.sesion.iniciarDesdeGrafo(deserializar(await archivo.text())); this.#verificar(); }
      catch (err) { aviso($("mensaje"), err.message, "red"); }
    });
    on("btnVolverConstruccion", () => this.sesion.modo === "manual" ? this.nav.ir("Construccion", 2) : this.#irAlInicio());
    const generarOtro = () => {
      if (this.sesion.modo !== "aleatorio") return;
      const { n } = this.grafo;
      this.sesion.iniciarAleatorio(n, this.sesion.completo, this.sesion.config);
      this.fb = null;
      this.#verificar();
      if (this.sesion.ciclos.length > 0) this.#verGrafo();
    };
    on("btnGenerarOtroGrafo", generarOtro);
    on("btnContinuarGrafo", () => this.#verGrafo());
    on("btnVolverVerificacion", () => this.#verificar());
    on("btnContinuarCiclos", () => this.#verCiclos());
    on("btnMostrarTodo", () => this.#filtrarNodo(-1));
    on("btnCicloAnterior", () => { this.cicloActual--; this.#mostrarCicloActual(); });
    on("btnCicloSiguiente", () => { this.cicloActual++; this.#mostrarCicloActual(); });
    on("btnInfoCiclos", () => { $("teoriaCiclos").hidden = !$("teoriaCiclos").hidden; });
    const alternarVecino = (abierto) => {
      $("explicacionVecino").hidden = !abierto;
      $("btnInfoVecino").setAttribute("aria-expanded", String(abierto));
    };
    on("btnCompararMetodos", () => {
      const detalle = $("detalleComparacion");
      detalle.hidden = !detalle.hidden;
      $("btnCompararMetodos").setAttribute("aria-expanded", String(!detalle.hidden));
      if (detalle.hidden) alternarVecino(false);
    });
    on("btnOptimoAnterior", () => { if (this.optimoActual > 0) { this.optimoActual--; this.#mostrarOptimo(); } });
    on("btnOptimoSiguiente", () => { if (this.optimoActual < this.optimos.length - 1) { this.optimoActual++; this.#mostrarOptimo(); } });
    on("btnInfoVecino", () => alternarVecino($("explicacionVecino").hidden));
    on("btnCerrarVecino", () => alternarVecino(false));
    on("btnCerrarTeoria", () => { $("teoriaCiclos").hidden = true; });
    const panelFuerza = $("panelFuerza");
    const bancoFuerza = panelFuerza.closest(".grafo-workbench");   // al abrir el panel, el grafo se reduce y nada queda tapado
    const abrirFuerza = (abrir) => { panelFuerza.classList.toggle("panel-abierto", abrir); bancoFuerza.classList.toggle("con-panel", abrir); };
    on("btnPanelFuerza", () => abrirFuerza(!panelFuerza.classList.contains("panel-abierto")));
    on("btnCerrarFuerza", () => abrirFuerza(false));
    on("btnVolverGrafoDesdeCiclos", () => this.#verGrafo());
    on("btnContinuarMatriz", () => this.#verMatriz());
    on("btnVolverCiclos", () => this.#verCiclos());
    on("btnIniciarFuerza", () => this.#iniciarFuerza());
    on("btnSiguienteRuta", () => this.#siguiente());
    on("btnCompletarRuta", () => { this.fb.completarRuta(); this.#pintarFuerza(); this.#avisoCiclo(); });
    const cerrar = () => { const d = $("dialogoCiclo"); d.close ? d.close() : d.removeAttribute("open"); };
    on("btnDialogoContinuar", () => { cerrar(); if (this.fb.finalizado) this.#resultado(); else { this.fb.avanzar(); this.#pintarFuerza(); } });
    on("btnDialogoResolver", () => { cerrar(); this.#resultado(); });
    on("btnResolverTodo", () => this.#resultado());
    on("btnVolverMatriz", () => this.#verMatriz());
    on("btnVolverFuerza", () => { this.nav.ir("Fuerza", 6); this.#pintarFuerza(); });
    on("btnNuevoProblema", () => { if (!confirm("¿Empezar un problema nuevo? Se perderá el grafo actual.")) return; this.#irAlInicio(); });
  }
}

// ===== main =====
new Controlador();
})();
