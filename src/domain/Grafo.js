export const PESO_MAX = 25;   // peso máximo de una arista
export const nombreNodo = (i) => String.fromCharCode(65 + i);

/** Agregado raíz: nodos con coordenadas (x, y) y aristas ponderadas no dirigidas. */
export class Grafo {
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
