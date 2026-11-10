// Une los módulos de src/ en un solo assets/js/app.js clásico (sin import/export),
// para poder abrir index.html con doble clic. Uso: node build.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const orden = [
  "domain/Grafo", "domain/Ciclo", "domain/BuscadorCiclos", "domain/Analisis", "domain/GeneradorAleatorio", "domain/Ejemplos", "domain/Persistencia",
  "application/Sesion", "ui/Navegador", "ui/Paginador", "ui/RenderizadorGrafo", "ui/Controlador", "main",
];
const cuerpo = orden.map((m) => {
  const codigo = readFileSync(`src/${m}.js`, "utf8")
    .replace(/^import .*$/gm, "")
    .replace(/^export (?=const|class|function)/gm, "");
  return `// ===== ${m} =====\n${codigo.trim()}`;
}).join("\n\n");
mkdirSync("assets/js", { recursive: true });
writeFileSync("assets/js/app.js", `(function () {\n"use strict";\n${cuerpo}\n})();\n`);
console.log("assets/js/app.js generado");
