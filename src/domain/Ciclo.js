import { nombreNodo } from "./Grafo.js";

/** Objeto de valor: recorrido cerrado, p. ej. [0, 2, 1, 3, 0]. */
export class Ciclo {
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
