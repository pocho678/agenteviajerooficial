import { nombreNodo } from "../domain/Grafo.js";

export const COLORES_CICLO = ["#129b91", "#e0731a", "#d32f2f", "#7e57c2", "#f9a825", "#1e88e5", "#43a047", "#ec407a", "#6d4c41", "#00acc1"];
export const MIN_CICLOS_COLORES = 2;
/** Si hay más de 1 ciclo, cada uno tiene su propio color, el mismo en todas las pantallas. */
export const colorDeCiclo = (indice, total) => (total >= MIN_CICLOS_COLORES ? COLORES_CICLO[indice % COLORES_CICLO.length] : null);
const oscurecer = (hex, f = 0.35) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - f)).toString(16).padStart(2, "0")).join("");
export const COLORES_NODO = ["#1769AA", "#2E7D32", "#7B1FA2", "#00838F", "#AD1457", "#5D4037", "#283593", "#558B2F", "#37474F", "#9E6B00"];
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
export class LienzoGrafo {
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
