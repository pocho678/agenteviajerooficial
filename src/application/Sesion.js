import { Grafo } from "../domain/Grafo.js";
import { buscarCiclos } from "../domain/BuscadorCiclos.js";
import { generarGrafoAleatorio, generarGrafoDirigido } from "../domain/GeneradorAleatorio.js";

/** Recorre los ciclos paso a paso (nodo por nodo) y recuerda el mejor. */
export class FuerzaBruta {
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
export class Sesion {
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
