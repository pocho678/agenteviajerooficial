import test from "node:test";
import assert from "node:assert/strict";
import { LienzoGrafo, colorDeCiclo, COLORES_CICLO } from "../src/ui/RenderizadorGrafo.js";
import { Grafo } from "../src/domain/Grafo.js";

globalThis.ResizeObserver = class { observe() {} };
globalThis.window = { devicePixelRatio: 1 };

test("con 1 ciclo no hay colores; con 2 o más cada ciclo tiene el suyo y es estable", () => {
  assert.equal(colorDeCiclo(0, 1), null);
  assert.equal(colorDeCiclo(0, 0), null);
  const colores = [0, 1].map((i) => colorDeCiclo(i, 2));
  assert.equal(new Set(colores).size, 2);
  assert.ok(colores.every(Boolean));
  assert.equal(colorDeCiclo(2, 60), colorDeCiclo(2, 12));
  assert.equal(colorDeCiclo(COLORES_CICLO.length, 60), COLORES_CICLO[0]);
});

test("al mostrar un ciclo se conservan las aristas originales y las flechas usan el color del ciclo", () => {
  const trazos = [], rellenos = [];
  const ctx = { stroke() { trazos.push(this.strokeStyle); }, fill() { rellenos.push(this.fillStyle); } };
  for (const m of ["setTransform", "fillRect", "beginPath", "moveTo", "lineTo", "closePath", "arc", "fillText", "strokeText"]) ctx[m] = () => {};
  const canvas = { clientWidth: 650, clientHeight: 440, style: {}, setAttribute() {}, getContext: () => ctx, addEventListener() {} };
  const g = new Grafo([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }, { x: 23, y: 11 }, { x: 3, y: 14 }]);
  for (let i = 0; i < 5; i++) g.agregarArista(i, (i + 1) % 5, i + 2);
  const ciclo = { nodos: [0, 1, 2, 3, 4, 0], texto: () => "A → B → C → D → E → A" };
  new LienzoGrafo(canvas).mostrar(g, { ciclo, k: 3, color: "#d32f2f" });
  assert.equal(trazos.filter((c) => c === "#b7ccdf").length, 5, "las 5 aristas originales siguen dibujadas");
  assert.equal(trazos.filter((c) => c === "#d32f2f").length, 2, "solo 2 tramos de la ruta (k = 3 nodos)");
  assert.ok(rellenos.includes("#d32f2f"), "puntas de flecha del color del ciclo");
});
