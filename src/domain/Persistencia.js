import { Grafo, PESO_MAX } from "./Grafo.js";

const LIMITE_CICLOS = 5000;   // si hay más, el archivo guarda solo el total y el óptimo

/** Convierte el grafo, sus ciclos Hamiltonianos y el óptimo (fuerza bruta) en texto JSON. */
export function serializar(grafo, ciclos, mejor) {
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
export function deserializar(texto) {
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
