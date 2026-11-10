import { Ciclo } from "./Ciclo.js";

export const ciclosPosibles = (n) => { let f = 1; for (let i = 2; i < n; i++) f *= i; return f / 2; };   // (n-1)!/2
export const formatoNumero = (x) => Number(x).toLocaleString("es-PE");

/** Teorema de Dirac: si todo vértice tiene grado >= n/2 (n >= 3), el grafo es hamiltoniano. */
export function dirac(grafo) {
  const gradoMin = Math.min(...grafo.matriz.map((_, i) => grafo.vecinos(i).length));
  return { gradoMin, umbral: grafo.n / 2, cumple: !grafo.dirigido && grafo.n >= 3 && gradoMin >= grafo.n / 2 };
}

/** Heurística voraz: va siempre al vecino no visitado más cercano. Devuelve null si no logra cerrar el ciclo. */
export function vecinoMasCercano(grafo, inicio = 0) {
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
export const grados = (grafo) => grafo.matriz.map((_, i) => grafo.vecinos(i).length);
export const gradosDirigidos = (grafo) => grafo.matriz.map((_,i) => ({entrada:grafo.gradoEntrada(i), salida:grafo.gradoSalida(i)}));
/** Densidad = 2m / (n(n-1)): 0 sin aristas, 1 grafo completo. */
export const densidad = (grafo) => ((grafo.dirigido ? 1 : 2) * grafo.aristas().length) / (grafo.n * (grafo.n - 1));
