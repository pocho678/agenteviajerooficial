import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const leer = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), "utf8");

test("la opción de pantalla completa ya no existe en HTML, JS ni CSS", () => {
  const archivos = ["index.html", "assets/js/app.js", "src/ui/Controlador.js", ...readdirSync(new URL("../css", import.meta.url)).map((f) => `css/${f}`)];
  for (const ruta of archivos) assert.doesNotMatch(leer(ruta), /requestFullscreen|fullscreenchange|:fullscreen|pantalla-completa-alternativa|data-tool="fullscreen"|Pantalla completa/i, ruta);
});
test("el panel de ruta reduce el grafo en lugar de taparlo", () => {
  assert.match(leer("src/ui/Controlador.js"), /con-panel/);
  assert.match(leer("css/visualizacion.css"), /\.con-panel \.grafo-stage>\.canvas-contenedor\{margin-right/);
});
