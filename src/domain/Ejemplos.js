import { Grafo } from "./Grafo.js";

const letra = (c) => c.charCodeAt(0) - 65;
const crear = (puntos, pesos) => {                       // pesos: matriz o lista de pares "AB"
  const g = new Grafo(puntos.map(([x, y]) => ({ x, y })));
  if (Array.isArray(pesos[0])) pesos.forEach((fila, a) => fila.forEach((p, b) => a < b && g.agregarArista(a, b, p)));
  else pesos.forEach((par) => { const [a, b] = [letra(par[0]), letra(par[1])]; g.agregarArista(a, b, g.pesoSugerido(a, b)); });
  return g;
};

export const EJEMPLOS = [
  { nombre: "Lectura 7 · Práctica autónoma (5 ciudades)", leyenda: "Distancias en km de la práctica de la lectura. Respuesta esperada: mínimo 46 km.",
    crear: () => crear([[0, 0], [14, 2], [20, 13], [6, 18], [-6, 9]],
      [[0, 12, 15, 8, 13], [12, 0, 6, 9, 11], [15, 6, 0, 13, 14], [8, 9, 13, 0, 6], [13, 11, 14, 6, 0]]) },
  { nombre: "Reparto en Lima (6 puntos)", leyenda: "A = almacén; B a F = clientes. Pesos en km.",
    crear: () => crear([[0, 0], [8, 3], [15, 1], [17, 10], [9, 13], [1, 9]], ["AB", "BC", "CD", "DE", "EF", "FA", "BE"]) },
  { nombre: "Soldadura de una placa (7 puntos)", leyenda: "Puntos de soldadura de un circuito; pesos = distancia en mm.",
    crear: () => crear([[0, 0], [6, -3], [14, -2], [19, 5], [12, 9], [5, 8], [9, 3]], ["AB", "BC", "CD", "DE", "EG", "GF", "FA", "BG", "CE"]) },
];
