import test from "node:test";
import assert from "node:assert/strict";
import { Grafo } from "../src/domain/Grafo.js";
import { buscarCiclos, sugerirAristasFaltantes } from "../src/domain/BuscadorCiclos.js";
import { generarGrafoAleatorio } from "../src/domain/GeneradorAleatorio.js";
import { Sesion } from "../src/application/Sesion.js";

const completo = (n) => { const g = new Grafo(Array.from({ length: n }, (_, i) => ({ x: i, y: i * i }))); for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) g.agregarArista(a, b, 1 + ((a * 7 + b * 3) % 9)); return g; };

test("(n-1)!/2 ciclos en grafo completo", () => {
  assert.equal(buscarCiclos(completo(5)).length, 12);
  assert.equal(buscarCiclos(completo(6)).length, 60);
});
test("grafo sin ciclo sugiere aristas faltantes", () => {
  const g = new Grafo(Array.from({ length: 5 }, (_, i) => ({ x: i, y: 0 })));
  [[0, 1], [1, 2], [2, 3]].forEach(([a, b]) => g.agregarArista(a, b, 1));
  assert.equal(buscarCiclos(g).length, 0);
  assert.equal(sugerirAristasFaltantes(g).faltantes.length, 2);
});
test("aleatorio: de 5 a 10 nodos, 1..30 ciclos y nodos separados", () => {
  for (let n = 5; n <= 10; n++) for (let r = 0; r < 25; r++) {
    const g = generarGrafoAleatorio(n), c = buscarCiclos(g).length;
    assert.ok(c >= 1 && c <= 30, `n=${n} ciclos=${c}`);
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) assert.ok(g.distancia(a, b) >= 3);
  }
});
test("fuerza bruta encuentra el mínimo", () => {
  const s = new Sesion(); s.iniciarAleatorio(7);
  const f = s.iniciarFuerzaBruta(); f.resolverTodo();
  assert.equal(f.mejorCosto, Math.min(...s.ciclos.map((c) => c.costo(s.grafo))));
});

test("aleatorio: ninguna arista se cruza con otra", () => {
  const orient = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  for (let n = 5; n <= 10; n++) for (let r = 0; r < 60; r++) {
    const g = generarGrafoAleatorio(n), A = g.aristas(), P = g.posiciones;
    for (const u of A) for (const v of A) {
      if (u === v || [u.a, u.b].some((x) => x === v.a || x === v.b)) continue;
      const cruza = orient(P[u.a], P[u.b], P[v.a]) !== orient(P[u.a], P[u.b], P[v.b]) && orient(P[v.a], P[v.b], P[u.a]) !== orient(P[v.a], P[v.b], P[u.b]);
      assert.ok(!cruza, `cruce en n=${n}`);
    }
  }
});

import { EJEMPLOS } from "../src/domain/Ejemplos.js";
import { dirac, vecinoMasCercano, ciclosPosibles } from "../src/domain/Analisis.js";

test("ejemplos: la práctica de la lectura da 46 km y 12 ciclos; todos tienen ciclo", () => {
  const g = EJEMPLOS[0].crear(), ciclos = buscarCiclos(g);
  assert.equal(ciclos.length, 12);
  assert.equal(Math.min(...ciclos.map((c) => c.costo(g))), 46);
  EJEMPLOS.forEach((e) => assert.ok(buscarCiclos(e.crear()).length >= 1, e.nombre));
});
test("Dirac, (n-1)!/2 y vecino más cercano", () => {
  assert.ok(dirac(completo(5)).cumple);
  assert.equal(ciclosPosibles(10), 181440);
  const v = vecinoMasCercano(completo(6));
  assert.ok(v && v.costo >= Math.min(...buscarCiclos(completo(6)).map((c) => c.costo(completo(6)))));
});

import { serializar, deserializar } from "../src/domain/Persistencia.js";
test("grafo completo opcional: da exactamente (n-1)!/2 ciclos", () => {
  assert.equal(buscarCiclos(generarGrafoAleatorio(6, Math.random, true)).length, 60);
});
test("guardar y cargar un grafo conserva nodos, aristas y óptimo", () => {
  const s = new Sesion(); s.iniciarAleatorio(7);
  const f = s.iniciarFuerzaBruta(); f.resolverTodo();
  const texto = serializar(s.grafo, s.ciclos, f.mejor), g2 = deserializar(texto);
  assert.deepEqual(g2.aristas(), s.grafo.aristas());
  assert.equal(JSON.parse(texto).optimo.costo, f.mejorCosto);
  assert.throws(() => deserializar("{}"));
  assert.throws(() => deserializar(texto.replace(/"peso": (\d+)/, '"peso": 1.5')));
});

import { densidad, grados } from "../src/domain/Analisis.js";
import { PESO_MAX } from "../src/domain/Grafo.js";
test("pesos enteros de 1 a 25 (aleatorio y completo); densidad y grados", () => {
  for (let n = 5; n <= 10; n++) for (const completo of [false, true]) for (let r = 0; r < 20; r++)
    generarGrafoAleatorio(n, Math.random, completo).aristas().forEach(({ peso }) => assert.ok(Number.isInteger(peso) && peso >= 1 && peso <= PESO_MAX, `peso ${peso}`));
  assert.equal(densidad(completo(6)), 1);
  assert.deepEqual(grados(completo(4)), [3, 3, 3, 3]);
});

// v18: pruebas de los grafos dirigidos y límites de entrada/salida
import { generarGrafoDirigido } from '../src/domain/GeneradorAleatorio.js';
import { gradosDirigidos } from '../src/domain/Analisis.js';
test('grafo dirigido conserva la orientación de las aristas', () => {
  const g = new Grafo(Array.from({length:5},(_,i)=>({x:i,y:i})),{dirigido:true,maxEntrada:2,maxSalida:2});
  g.agregarArista(0,1,4);
  assert.equal(g.existe(0,1),true);
  assert.equal(g.existe(1,0),false);
  assert.equal(g.peso(1,0),Infinity);
  assert.equal(g.aristas().length,1);
  assert.deepEqual(gradosDirigidos(g)[0],{entrada:0,salida:1});
  g.agregarArista(0,2,5);
  assert.throws(()=>g.agregarArista(0,3,3),/Límite/);
  g.agregarArista(3,1,2);
  assert.throws(()=>g.agregarArista(4,1,2),/Límite/);
});
test('generación dirigida produce ciclo válido y respeta máximos 1..3',()=>{
  for(let n=5;n<=10;n++) for(let maxEntrada=1;maxEntrada<=3;maxEntrada++) for(let maxSalida=1;maxSalida<=3;maxSalida++) {
    const g=generarGrafoDirigido(n,{maxEntrada,maxSalida});
    assert.ok(g.dirigido);
    assert.ok(buscarCiclos(g).length>0,`n=${n}`);
    for(let i=0;i<n;i++) {assert.ok(g.gradoEntrada(i)<=maxEntrada);assert.ok(g.gradoSalida(i)<=maxSalida);}
    assert.ok(densidad(g)<=1);
  }
});
test('ciclo inverso dirigido es distinto y JSON conserva orientación',()=>{
  const g=new Grafo(Array.from({length:5},(_,i)=>({x:i,y:i})),{dirigido:true,maxEntrada:3,maxSalida:3});
  for(let i=0;i<5;i++) {g.agregarArista(i,(i+1)%5,2);g.agregarArista((i+1)%5,i,2);}
  assert.equal(buscarCiclos(g).length,2);
  const loaded=deserializar(serializar(g,buscarCiclos(g),buscarCiclos(g)[0]));
  assert.equal(loaded.dirigido,true);
  assert.equal(loaded.maxEntrada,3);
  assert.deepEqual(loaded.aristas(),g.aristas());
});
