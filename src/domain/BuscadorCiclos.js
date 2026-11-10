import { Ciclo } from "./Ciclo.js";

/** Backtracking: todos los ciclos hamiltonianos desde A (sin contar el sentido inverso). */
export function buscarCiclos(grafo) {
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
export function sugerirAristasFaltantes(grafo) {
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
