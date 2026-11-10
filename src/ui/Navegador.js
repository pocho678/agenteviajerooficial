const PANTALLAS = ["Inicio", "Construccion", "Verificacion", "Grafo", "Ciclos", "Matriz", "Fuerza", "Resultado"];

/** Muestra una pantalla, actualiza el progreso (1 a 7) y hace que el botón Atrás del navegador funcione. */
export class Navegador {
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
