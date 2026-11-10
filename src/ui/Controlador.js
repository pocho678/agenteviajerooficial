import { nombreNodo, PESO_MAX } from "../domain/Grafo.js";
import { sugerirAristasFaltantes } from "../domain/BuscadorCiclos.js";
import { MAPA } from "../domain/GeneradorAleatorio.js";
import { ciclosPosibles, formatoNumero, dirac, vecinoMasCercano, densidad, grados, gradosDirigidos } from "../domain/Analisis.js";
import { EJEMPLOS } from "../domain/Ejemplos.js";
import { serializar, deserializar } from "../domain/Persistencia.js";
import { Sesion } from "../application/Sesion.js";
import { Navegador } from "./Navegador.js";
import { LienzoGrafo } from "./RenderizadorGrafo.js";
import { paginar } from "./Paginador.js";

const $ = (id) => document.getElementById(id);
const on = (id, fn) => $(id).addEventListener("click", fn);
const aviso = (el, texto, color) => { el.setAttribute("aria-live", "polite"); el.textContent = (color === "red" ? "Error: " : "") + texto; el.style.color = color; };
const tabla = (cabeza, filas, clase = "") =>
  `<div class="tabla-scroll"><table class="${clase}"><thead><tr>${cabeza.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${filas.join("")}</tbody></table></div>`;

/** Orquesta las 8 pantallas: lee la Sesión (aplicación) y pinta (UI). */
export class Controlador {
  constructor() {
    this.sesion = new Sesion();
    this.posicionesOriginales = new WeakMap();
    this.nav = new Navegador((n) => this.#permitir(n));
    const av = document.createElement("p");
    av.id = "avisoVerificacion"; av.className = "aviso-error";
    $("resultadoVerificacion").after(av);
    this.cicloActual = 0;
    this.optimos = [];
    this.optimoActual = 0;
    this.lienzo = { ciclos: new LienzoGrafo($("canvasCicloUnico"), { mapa: MAPA }), grafo: new LienzoGrafo($("canvasGrafo"), { mapa: MAPA }), ruta: new LienzoGrafo($("canvasRuta"), { mapa: MAPA }), resultado: new LienzoGrafo($("canvasResultado"), { mapa: MAPA }), construccion: new LienzoGrafo($("canvasConstruccion"), { mapa: MAPA }) };
    this.lienzo.construccion.habilitarArrastre(() => this.#sugerirPeso());
    // Solo el mapa es editable: ciclos, fuerza bruta y resultado muestran el plano original.
    this.lienzo.grafo.habilitarArrastre(() => {});
    this.#enlazar();
    this.#herramientasGrafo();
    this.#herramientasAleatorias();
    this.nav.ir("Inicio", 1);
  }
  /** Acciones del lienzo, independientes del algoritmo y de los pesos. */
  #herramientasGrafo() {
    const lienzos = { canvasGrafo: this.lienzo.grafo, canvasRuta: this.lienzo.ruta, canvasResultado: this.lienzo.resultado, canvasCicloUnico: this.lienzo.ciclos };
    document.querySelectorAll("button[data-canvas][data-tool]").forEach((boton) => {
      boton.addEventListener("click", async () => {
        const vista = lienzos[boton.dataset.canvas];
        if (!vista) return;
        if (boton.dataset.tool === "weights") {
          vista.ocultarPesos = !vista.ocultarPesos;
          vista.mostrarTodosPesos = !vista.ocultarPesos;
          boton.setAttribute("aria-pressed", String(!vista.ocultarPesos));
          boton.textContent = vista.ocultarPesos ? "Mostrar pesos" : "Ocultar pesos";
          vista.pintar();
        }
      });
    });
  }
  /** Mantiene una fotografía de las posiciones iniciales sin modificar el grafo ni sus pesos. */
  #guardarPosicionesOriginales() {
    if (this.grafo && !this.posicionesOriginales.has(this.grafo)) {
      this.posicionesOriginales.set(this.grafo, this.grafo.posiciones.map(({ x, y }) => ({ x, y })));
    }
  }
  #restaurarPosiciones() {
    const original = this.grafo && this.posicionesOriginales.get(this.grafo);
    if (!original) return;
    this.grafo.posiciones.splice(0, this.grafo.posiciones.length, ...original.map((p) => ({ ...p })));
    for (const lienzo of Object.values(this.lienzo)) {
      if (lienzo.args?.grafo === this.grafo) lienzo.pintar();
    }
    // El texto de coordenadas no se actualiza durante el arrastre ni al restaurar.
  }
  /** Las funciones se despliegan por encima del mapa, sin quitarle ancho. */
  #herramientasAleatorias() {
    const panel = $("panelGrafo"), boton = $("btnPanelAleatorio");
    const mostrar = (visible) => {
      panel.classList.toggle("panel-abierto", visible);
      boton.setAttribute("aria-expanded", String(visible));
      boton.textContent = visible ? "Ocultar funciones ✕" : "Datos y funciones ☰";
    };
    boton.addEventListener("click", () => mostrar(!panel.classList.contains("panel-abierto")));
    $("btnCerrarPanelAleatorio").addEventListener("click", () => mostrar(false));
    $("btnRestaurarPosiciones").addEventListener("click", () => this.#restaurarPosiciones());

    document.addEventListener("keydown", (e) => { if (e.key === "Escape") mostrar(false); });
    this.cerrarPanelGrafo = () => mostrar(false);
  }
  get grafo() { return this.sesion.grafo; }
  /** Vuelve al inicio como si la página se acabara de abrir. */
  #irAlInicio() {
    this.sesion.reiniciar(); this.fb = null;
    document.body.classList.remove("modo-aleatorio");
    this.cerrarPanelGrafo?.();
    for (const id of ["pesoArista"]) $(id).value = "";
    $("cantidadNodos").value = "7";
    for (const id of ["mensaje", "mensajeArista", "avisoVerificacion"]) $(id).textContent = "";
    $("chkCompleto").checked = false;
    this.nav.ir("Inicio", 1);
  }
  #permitir(n) { return (!this.grafo && n !== "Inicio") || (["Fuerza", "Resultado"].includes(n) && !this.fb) ? "Inicio" : n; }

  #leerConfig() {
    // La portada ofrece por ahora únicamente el grafo no dirigido.
    return { dirigido: false, maxEntrada: 3, maxSalida: 3 };
  }
  // ---------- Inicio y construcción ----------
  #cantidad() {
    const n = parseInt($("cantidadNodos").value, 10), msg = $("mensaje");
    if (Number.isNaN(n)) return void aviso(msg, "Ingresa una cantidad de nodos.", "red");
    if (n < 5 || n > 10) return void aviso(msg, "La cantidad debe estar entre 5 y 10.", "red");
    msg.textContent = "";
    return n;
  }
  #iniciarManual(n) {
    document.body.classList.remove("modo-aleatorio");
    this.sesion.iniciarManual(n, this.#leerConfig());
    const opciones = [...Array(n).keys()].map((i) => `<option value="${i}">${nombreNodo(i)}</option>`).join("");
    $("nodoOrigen").innerHTML = $("nodoDestino").innerHTML = opciones;
    $("nodoDestino").value = "1";
    $("mensajeArista").textContent = "";
    this.#sugerirPeso(); this.#listarAristas();
    this.nav.ir("Construccion", 2);
    this.lienzo.construccion.mostrar(this.grafo);
  }
  #sugerirPeso() {
    const a = +$("nodoOrigen").value, b = +$("nodoDestino").value;
    $("pesoArista").placeholder = a === b ? "Peso" : `Sugerido: ${this.grafo.pesoSugerido(a, b)}`;
  }
  #agregarArista() {
    const a = +$("nodoOrigen").value, b = +$("nodoDestino").value, peso = Number($("pesoArista").value), msg = $("mensajeArista");
    if (a === b) return aviso(msg, "No puedes conectar un nodo consigo mismo.", "red");
    if (!Number.isInteger(peso) || peso < 1 || peso > PESO_MAX) return aviso(msg, `El peso debe ser un número entero entre 1 y ${PESO_MAX}.`, "red");
    const actualiza = this.grafo.existe(a, b);
    try { this.grafo.agregarArista(a, b, peso); } catch (err) { return aviso(msg, err.message, "red"); }
    this.sesion.cambioElGrafo();
    aviso(msg, actualiza ? "Conexión actualizada." : (this.grafo.dirigido ? `Arco ${nombreNodo(a)} → ${nombreNodo(b)} agregado.` : "Arista agregada correctamente."), "green");
    $("pesoArista").value = "";
    this.#listarAristas();
    this.lienzo.construccion.mostrar(this.grafo);
  }
  #listarAristas() {
    const aristas = this.grafo.aristas();
    $("listaAristas").innerHTML = aristas.length === 0 ? "<p>No se han agregado aristas todavía.</p>" :
      tabla([this.grafo.dirigido ? "Desde" : "Origen", this.grafo.dirigido ? "Hacia →" : "Destino", "Peso", "Editar", "Eliminar"], aristas.map(({ a, b, peso }) =>
        `<tr><td>${nombreNodo(a)}</td><td>${nombreNodo(b)}</td><td>${peso}</td>
         <td><button class="boton-pequeno boton-editar" data-acc="editar" data-a="${a}" data-b="${b}">Editar</button></td>
         <td><button class="boton-pequeno boton-eliminar" data-acc="eliminar" data-a="${a}" data-b="${b}">Eliminar</button></td></tr>`));
  }
  #accionArista(e) {
    const { acc, a, b } = e.target.dataset;
    if (!acc) return;
    if (acc === "eliminar") { this.grafo.eliminarArista(+a, +b); this.sesion.cambioElGrafo(); this.#listarAristas(); this.lienzo.construccion.mostrar(this.grafo); return; }
    $("nodoOrigen").value = a; $("nodoDestino").value = b; $("pesoArista").value = this.grafo.peso(+a, +b);
    aviso($("mensajeArista"), "Modifica el peso y presiona 'Agregar arista'.", "#1769aa");
  }

  // ---------- Verificación, grafo, ciclos, matriz ----------
  #verificar() {
    this.#guardarPosicionesOriginales();
    const ciclos = this.sesion.ciclos, caja = $("resultadoVerificacion");
    $("avisoVerificacion").textContent = "";
    if (ciclos.length > 0) {
      caja.innerHTML = `<div class="exito"><strong>El grafo permite ciclos Hamiltonianos.</strong><br><br>Se encontraron <strong>${ciclos.length}</strong> ciclos Hamiltonianos.<br><br>El grafo puede continuar con el proceso.${ciclos.length > 5000 ? "<br><br>Son muchos ciclos: paso a paso será largo, usa «Resolver todo»." : ""}</div>`;
    } else {
      const s = sugerirAristasFaltantes(this.grafo);
      const lista = s ? `<br><br><strong>Conexiones que podrían completar un ciclo:</strong><ul class="lista-faltantes">${s.faltantes.map((f) => `<li>${nombreNodo(f.a)} ${this.grafo.dirigido ? "→" : "—"} ${nombreNodo(f.b)}</li>`).join("")}</ul>${this.grafo.dirigido ? "Ten en cuenta los grados máximos configurados; quizá debas eliminar o modificar otros arcos antes de añadir estas conexiones.<br>" : ""}Recorrido propuesto:<br><strong>${s.ciclo.texto()}</strong>` : "";
      caja.innerHTML = `<div class="error"><strong>El grafo no contiene ningún ciclo Hamiltoniano.</strong><br><br>Revisa las conexiones necesarias para completar al menos un ciclo.${lista}</div>`;
    }
    const d = dirac(this.grafo), ej = this.sesion.ejemplo;
    caja.insertAdjacentHTML("beforeend", `${ej ? `<p class="teoria"><strong>Ejemplo:</strong> ${ej.nombre}. ${ej.leyenda}</p>` : ""}
      <p class="teoria"><strong>${this.grafo.dirigido ? "Grafo dirigido" : "Teorema de Dirac"}:</strong> ${this.grafo.dirigido ? `El teorema de Dirac clásico corresponde a grafos no dirigidos. Aquí se comprueban los ciclos respetando el sentido de las flechas y los límites de grado.` : d.cumple
        ? `todos los vértices tienen grado ≥ n/2 (grado mínimo ${d.gradoMin} ≥ ${d.umbral}), así que el grafo es hamiltoniano.`
        : `el grado mínimo es ${d.gradoMin} y n/2 = ${d.umbral}. La condición no se cumple, pero eso no descarta un ciclo: Dirac es suficiente, no necesaria.`}</p>`);
    this.nav.ir("Verificacion", 3);
  }
  #actualizarCoordenadas() {
    if (!this.grafo) return;
    // Mostrar solo al entrar al mapa: coordenadas iniciales, redondeadas a enteros.
    const originales = this.#posicionesOriginales() || this.grafo.posiciones;
    $("coordenadas").textContent = "Coordenadas iniciales (x, y): " + originales
      .map((p, i) => `${nombreNodo(i)} (${Math.round(p.x)}, ${Math.round(p.y)})`).join(" · ");
  }
  #posicionesOriginales() {
    return this.grafo ? this.posicionesOriginales.get(this.grafo) : null;
  }
  #iniciarFiltros() {
    const caja = $("nodosFiltro");
    caja.replaceChildren();
    for (let i = 0; i < this.grafo.n; i++) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip-nodo"; b.textContent = nombreNodo(i);
      b.addEventListener("click", () => this.#filtrarNodo(i));
      caja.append(b);
    }
    this.#filtrarNodo(-1);
  }
  #filtrarNodo(i) {
    this.lienzo.grafo.nodoFiltro = i;
    $("nodosFiltro").querySelectorAll("button").forEach((b, k) => b.classList.toggle("activo", i === k));
    $("btnMostrarTodo").classList.toggle("activo", i < 0);
    this.lienzo.grafo.pintar();
  }
  #mostrarCicloActual() {
    const ciclos = this.sesion.ciclos;
    this.cicloActual = Math.max(0, Math.min(this.cicloActual, ciclos.length - 1));
    const c = ciclos[this.cicloActual];
    $("cicloContador").textContent = `Ciclo ${formatoNumero(this.cicloActual + 1)} de ${formatoNumero(ciclos.length)}`;
    $("cicloRutaTexto").textContent = c.texto();
    $("cicloCostoTexto").textContent = `Costo total: ${c.costo(this.grafo)}`;
    $("btnCicloAnterior").disabled = this.cicloActual === 0;
    $("btnCicloSiguiente").disabled = this.cicloActual === ciclos.length - 1;
    this.lienzo.ciclos.soloRuta = true;
    this.lienzo.ciclos.mostrar(this.grafo, { ciclo: c, posiciones: this.#posicionesOriginales() });
  }
  #verGrafo() {
    if (this.sesion.ciclos.length === 0) return aviso($("avisoVerificacion"), "Primero completa el grafo: debe existir al menos un ciclo hamiltoniano.", "red");
    document.body.classList.toggle("modo-aleatorio", this.sesion.modo === "aleatorio");
    this.#guardarPosicionesOriginales();
    this.cerrarPanelGrafo();
    $("btnGenerarOtroGrafo").hidden = this.sesion.modo !== "aleatorio";
    this.#actualizarCoordenadas();
    const g = this.grafo, d = densidad(g);
    $("analisisGrafo").innerHTML = `<p class="teoria"><strong>${g.dirigido ? "Densidad dirigida" : "Densidad"}:</strong> ${g.aristas().length} ${g.dirigido ? "arcos" : "aristas"} de ${g.n * (g.n-1) / (g.dirigido ? 1 : 2)} posibles = ${Math.round(d * 100)} %. ${g.dirigido ? "Cada dirección se cuenta por separado: densidad = m / n(n−1)." : "Densidad = 2m / n(n−1)."}</p>` +
      (g.dirigido ? tabla(["Nodo", "Grado interno", "Grado externo"], gradosDirigidos(g).map((x,i)=>`<tr><td>${nombreNodo(i)}</td><td>${x.entrada} / ${g.maxEntrada}</td><td>${x.salida} / ${g.maxSalida}</td></tr>`))
      : tabla(["Nodo", "Grado (conexiones)"], grados(g).map((x, i) => `<tr><td>${nombreNodo(i)}</td><td>${x}</td></tr>`)));
    this.nav.ir("Grafo", 3);
    this.lienzo.grafo.ocultarPesos = g.aristas().length > 18;
    this.lienzo.grafo.mostrarTodosPesos = false;
    const botonPesos = document.querySelector('[data-canvas="canvasGrafo"][data-tool="weights"]');
    botonPesos.textContent = this.lienzo.grafo.ocultarPesos ? "Mostrar pesos" : "Ocultar pesos";
    this.lienzo.grafo.mostrar(this.grafo);
    this.#iniciarFiltros();
  }
  #verCiclos() {
    const ciclos = this.sesion.ciclos;
    const n = this.grafo.n, posibles = this.grafo.dirigido ? ciclosPosibles(n) * 2 : ciclosPosibles(n);
    $("resumenCiclos").innerHTML = `<h3>¿Por qué hay ${formatoNumero(ciclos.length)} ciclos?</h3>
      <p>Con ${n} nodos, un grafo ${this.grafo.dirigido ? "dirigido sin restricciones de grado" : "completo no dirigido"} permitiría hasta <strong>${formatoNumero(posibles)}</strong> rutas distintas.</p>
      <p>${ciclos.length === posibles ? "Están disponibles todos los recorridos." : "Las conexiones y sus direcciones restringen los recorridos que pueden completarse."}</p>
      <details><summary>¿De dónde sale este máximo?</summary><p>En grafos no dirigidos completos: <strong>(n − 1)! / 2</strong> (el inverso cuenta igual). En grafos dirigidos completos: <strong>(n − 1)!</strong> (el inverso puede ser otro recorrido).</p><p>Con 15 nodos habría ${formatoNumero(this.grafo.dirigido ? ciclosPosibles(15)*2 : ciclosPosibles(15))} rutas para un grafo completo de este tipo; por eso la aplicación se limita a 10.</p></details>`;
    this.cicloActual = 0;
    $("teoriaCiclos").hidden = true;
    this.nav.ir("Ciclos", 4);
    this.#mostrarCicloActual();
  }
  #verMatriz() {
    const g = this.grafo, idx = [...Array(g.n).keys()];
    $("contenedorMatriz").innerHTML = tabla(["", ...idx.map(nombreNodo)], idx.map((i) =>
      `<tr><th>${nombreNodo(i)}</th>${idx.map((j) => `<td>${g.peso(i, j) === Infinity ? "∞" : g.peso(i, j)}</td>`).join("")}</tr>`), "matriz");
    this.nav.ir("Matriz", 5);
  }

  // ---------- Fuerza bruta y resultado ----------
  #iniciarFuerza() {
    this.fb = this.sesion.iniciarFuerzaBruta();
    this.nav.ir("Fuerza", 6);
    this.#pintarFuerza();
  }
  #pintarFuerza() {
    const f = this.fb, g = this.grafo, c = f.ciclo, k = f.k;
    $("numeroRuta").textContent = `${f.i + 1} / ${f.ciclos.length}`;
    $("costoActual").textContent = c.costo(g, k);
    $("mejorCostoActual").textContent = f.mejor ? f.mejorCosto : "-";
    $("rutaActual").innerHTML = `<strong>Ruta en construcción:</strong> ${c.texto(k)}` + (f.rutaCompleta ? `<br><br><strong>Costo total de la ruta:</strong> ${c.costo(g)}` : "");
    $("btnSiguienteRuta").textContent = f.finalizado ? "Ver resultado final" : f.rutaCompleta ? "Ir al siguiente ciclo" : "Siguiente paso";
    $("btnPasoRapido").textContent = $("btnSiguienteRuta").textContent + " →";
    $("btnCompletarRuta").disabled = f.rutaCompleta;
    this.lienzo.ruta.soloRuta = true;
    this.lienzo.ruta.mostrar(g, { ciclo: c, k, posiciones: this.#posicionesOriginales() });
  }
  #siguiente() {
    const f = this.fb;
    if (f.finalizado) return this.#resultado();
    f.avanzar();
    this.#pintarFuerza();
    if (f.rutaCompleta) this.#avisoCiclo();
  }
  /** Ventana emergente al terminar cada ciclo: avisa qué sigue. */
  #avisoCiclo() {
    const f = this.fb, c = f.ciclo, ultimo = f.finalizado, d = $("dialogoCiclo");
    $("tituloCiclo").textContent = `Ciclo ${f.i + 1} de ${f.ciclos.length} completado`;
    $("textoCiclo").innerHTML = `Ruta: <strong>${c.texto()}</strong><br>Costo total: <strong>${c.costo(this.grafo)}</strong><br>` +
      (f.mejor === c ? "Es el mejor ciclo hasta ahora." : `El mejor hasta ahora cuesta ${f.mejorCosto}.`) + "<br><br>" +
      (ultimo ? "Ya se evaluaron todos los ciclos." : `A continuación se pasa al ciclo ${f.i + 2} de ${f.ciclos.length}.`);
    $("btnDialogoContinuar").textContent = ultimo ? "Ver resultado final" : `Ir al ciclo ${f.i + 2}`;
    $("btnDialogoResolver").hidden = ultimo;
    d.showModal ? d.showModal() : d.setAttribute("open", "");
  }
  #resultado() {
    const f = this.fb, g = this.grafo;
    f.resolverTodo();
    $("resumenResultado").innerHTML = `<div class="resumen">
      <div class="resumen-item"><span>Nodos</span><strong>${g.n}</strong></div>
      <div class="resumen-item"><span>Ciclos encontrados</span><strong>${f.ciclos.length}</strong></div>
      <div class="resumen-item"><span>Costo mínimo</span><strong>${f.mejorCosto}</strong></div></div>`;
    // Puede haber varios ciclos diferentes con el mismo costo mínimo.
    this.optimos = f.ciclos.filter(c => c.costo(g) === f.mejorCosto);
    this.optimoActual = 0;
    this.#mostrarOptimo();
    paginar($("tablaResultados"), f.ciclos.length, 50, (cuerpo, desde, hasta) => {
      const filas = [];
      for (let i = desde; i < hasta; i++) {
        const costo = f.ciclos[i].costo(g);
        filas.push(`<tr${costo === f.mejorCosto ? ' class="optimo"' : ""}><td>${i + 1}</td><td>${f.ciclos[i].texto()}</td><td>${costo}</td></tr>`);
      }
      cuerpo.innerHTML = tabla(["Nº", "Ciclo Hamiltoniano", "Costo total"], filas);
    });
    const r = f.mejor.nodos, total = g.n;
    $("analisisCiclo").innerHTML = `<p class="teoria">Dentro del ciclo orientado, cada nodo recibe una flecha (grado interno 1) y envía una flecha (grado externo 1). ${g.dirigido ? "El grafo original también es dirigido, pero puede tener más entradas y salidas según los máximos configurados." : "El grafo original es no dirigido; las flechas aquí indican únicamente el orden del recorrido."}</p>` +
      tabla(["Nodo", "Entra", "Sale", "Grado interno", "Grado externo"], r.slice(0, -1).map((v, i) =>
        `<tr><td>${nombreNodo(v)}</td><td>${nombreNodo(r[(i + total - 1) % total])} → ${nombreNodo(v)}</td><td>${nombreNodo(v)} → ${nombreNodo(r[i + 1])}</td><td>1</td><td>1</td></tr>`));
    this.nav.ir("Resultado", 7);
    this.lienzo.resultado.soloRuta = true;
    this.#mostrarOptimo();
    const v = vecinoMasCercano(g);
    const extra = v ? v.costo - f.mejorCosto : null;
    $("comparacionCostoVecino").textContent = v ? formatoNumero(v.costo) : "No encontró ciclo";
    // Cuando el método voraz no completa el recorrido, no hay costo comparable.
    const tarjetaVecino = $("comparacionCostoVecino").closest(".comparacion-metodo");
    const unidadVecino = tarjetaVecino?.querySelector("small");
    const etiquetaVecino = tarjetaVecino?.querySelector(".comparacion-chip");
    if (unidadVecino) unidadVecino.textContent = v ? "Unidades de costo" : "No hay costo total";
    if (etiquetaVecino) etiquetaVecino.textContent = v ? "Ruta aproximada" : "Recorrido incompleto";
    $("comparacionCostoFuerza").textContent = formatoNumero(f.mejorCosto);
    $("comparacionDiferencia").innerHTML = !v
      ? `<strong>Diferencia de costos</strong><p>No es posible comparar los costos: vecino más cercano no encontró un ciclo completo.</p>`
      : `<strong>Diferencia de costos</strong><div class="comparacion-dato"><span>${extra} ${extra === 1 ? "unidad adicional" : "unidades adicionales"}</span><b>${((100 * extra) / f.mejorCosto).toFixed(2)} % más</b></div>`;
    $("comparacionExplicacion").textContent = !v
      ? `Vecino más cercano elige en cada paso la conexión más barata hacia un nodo no visitado. En este grafo, sus elecciones lo dejaron sin una conexión para continuar o para regresar al origen A. Esto no significa que el grafo no tenga ciclos hamiltonianos: fuerza bruta sí encontró uno válido y comprobó que su costo mínimo es ${formatoNumero(f.mejorCosto)}.`
      : extra === 0
        ? "En este grafo, las decisiones del vecino más cercano dieron el mismo costo mínimo que fuerza bruta. Sin embargo, no ocurre siempre."
        : "El vecino más cercano eligió en cada paso la conexión de menor costo disponible, pero eso no garantizó la ruta completa más barata. Fuerza bruta comparó todos los ciclos válidos y encontró uno mejor.";
  }

  #mostrarOptimo() {
    if (!this.optimos?.length || !this.grafo) return;
    const c = this.optimos[this.optimoActual];
    const cantidad = this.optimos.length;
    $("rutaOptima").innerHTML = `<strong>${cantidad === 1 ? "Ciclo óptimo" : "Ciclos óptimos"} (${cantidad})</strong><br><br><span class="ruta-optima-texto">${c.texto()}</span><br><br>Costo total mínimo: ${this.fb.mejorCosto}`;
    $("optimosNavegador").hidden = cantidad < 2;
    $("optimoIndicador").textContent = `${this.optimoActual + 1} de ${cantidad}`;
    $("btnOptimoAnterior").disabled = this.optimoActual === 0;
    $("btnOptimoSiguiente").disabled = this.optimoActual === cantidad - 1;
    this.lienzo.resultado.soloRuta = true;
    this.lienzo.resultado.mostrar(this.grafo, { ciclo: c, posiciones: this.#posicionesOriginales() });
  }

  #enlazar() {
    const elegir = (modo) => () => { const n = this.#cantidad(); if (n) { if (modo === "manual") this.#iniciarManual(n); else { this.sesion.iniciarAleatorio(n, $("chkCompleto").checked, this.#leerConfig()); this.#verificar(); } } };
    on("btnMenosNodo", () => { $("cantidadNodos").value = Math.max(5, (+$("cantidadNodos").value || 7) - 1); });
    on("btnMasNodo", () => { $("cantidadNodos").value = Math.min(10, (+$("cantidadNodos").value || 7) + 1); });
    on("btnIrCiclosRapido", () => $("btnContinuarCiclos").click());
    on("btnPasoRapido", () => $("btnSiguienteRuta").click());
    on("btnManual", elegir("manual"));
    on("btnAleatorio", elegir("aleatorio"));
    $("nodoOrigen").addEventListener("change", () => this.#sugerirPeso());
    $("nodoDestino").addEventListener("change", () => this.#sugerirPeso());
    on("btnAgregarArista", () => this.#agregarArista());
    $("listaAristas").addEventListener("click", (e) => this.#accionArista(e));
    on("btnVerificar", () => this.grafo.aristas().length === 0 ? aviso($("mensajeArista"), "Debe agregar al menos una arista.", "red") : this.#verificar());
    $("selectorEjemplo").innerHTML = EJEMPLOS.map((e, i) => `<option value="${i}">${e.nombre}</option>`).join("");
    on("btnEjemplo", () => { this.sesion.iniciarEjemplo(EJEMPLOS[$("selectorEjemplo").value]); this.#verificar(); });
    on("btnExportarPng", () => { const a = document.createElement("a"); a.download = "ciclo-optimo.png"; a.href = $("canvasResultado").toDataURL("image/png"); a.click(); });
    on("btnExportarPdf", () => window.print());
    const regenerar = (despues) => () => { this.sesion.iniciarAleatorio(this.grafo.n, this.sesion.completo, this.sesion.config); despues(); };
    $("pesoArista").addEventListener("keydown", (e) => e.key === "Enter" && this.#agregarArista());
    on("btnVolverInicio", () => this.#irAlInicio());
    on("btnGuardar", () => {
      const f = this.fb, a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([serializar(this.grafo, f.ciclos, f.mejor)], { type: "application/json" }));
      a.download = "grafo-tsp.json"; a.click(); URL.revokeObjectURL(a.href);
    });
    on("btnCargarArchivo", () => $("archivoGrafo").click());
    $("archivoGrafo").addEventListener("change", async (e) => {
      const archivo = e.target.files[0]; e.target.value = "";
      if (!archivo) return;
      try { this.sesion.iniciarDesdeGrafo(deserializar(await archivo.text())); this.#verificar(); }
      catch (err) { aviso($("mensaje"), err.message, "red"); }
    });
    on("btnVolverConstruccion", () => this.sesion.modo === "manual" ? this.nav.ir("Construccion", 2) : this.#irAlInicio());
    const generarOtro = () => {
      if (this.sesion.modo !== "aleatorio") return;
      const { n } = this.grafo;
      this.sesion.iniciarAleatorio(n, this.sesion.completo, this.sesion.config);
      this.fb = null;
      this.#verificar();
      if (this.sesion.ciclos.length > 0) this.#verGrafo();
    };
    on("btnGenerarOtroGrafo", generarOtro);
    on("btnContinuarGrafo", () => this.#verGrafo());
    on("btnVolverVerificacion", () => this.#verificar());
    on("btnContinuarCiclos", () => this.#verCiclos());
    on("btnMostrarTodo", () => this.#filtrarNodo(-1));
    on("btnCicloAnterior", () => { this.cicloActual--; this.#mostrarCicloActual(); });
    on("btnCicloSiguiente", () => { this.cicloActual++; this.#mostrarCicloActual(); });
    on("btnInfoCiclos", () => { $("teoriaCiclos").hidden = !$("teoriaCiclos").hidden; });
    const alternarVecino = (abierto) => {
      $("explicacionVecino").hidden = !abierto;
      $("btnInfoVecino").setAttribute("aria-expanded", String(abierto));
    };
    on("btnCompararMetodos", () => {
      const detalle = $("detalleComparacion");
      detalle.hidden = !detalle.hidden;
      $("btnCompararMetodos").setAttribute("aria-expanded", String(!detalle.hidden));
      if (detalle.hidden) alternarVecino(false);
    });
    on("btnOptimoAnterior", () => { if (this.optimoActual > 0) { this.optimoActual--; this.#mostrarOptimo(); } });
    on("btnOptimoSiguiente", () => { if (this.optimoActual < this.optimos.length - 1) { this.optimoActual++; this.#mostrarOptimo(); } });
    on("btnInfoVecino", () => alternarVecino($("explicacionVecino").hidden));
    on("btnCerrarVecino", () => alternarVecino(false));
    on("btnCerrarTeoria", () => { $("teoriaCiclos").hidden = true; });
    const panelFuerza = $("panelFuerza");
    const bancoFuerza = panelFuerza.closest(".grafo-workbench");   // al abrir el panel, el grafo se reduce y nada queda tapado
    const abrirFuerza = (abrir) => { panelFuerza.classList.toggle("panel-abierto", abrir); bancoFuerza.classList.toggle("con-panel", abrir); };
    on("btnPanelFuerza", () => abrirFuerza(!panelFuerza.classList.contains("panel-abierto")));
    on("btnCerrarFuerza", () => abrirFuerza(false));
    on("btnVolverGrafoDesdeCiclos", () => this.#verGrafo());
    on("btnContinuarMatriz", () => this.#verMatriz());
    on("btnVolverCiclos", () => this.#verCiclos());
    on("btnIniciarFuerza", () => this.#iniciarFuerza());
    on("btnSiguienteRuta", () => this.#siguiente());
    on("btnCompletarRuta", () => { this.fb.completarRuta(); this.#pintarFuerza(); this.#avisoCiclo(); });
    const cerrar = () => { const d = $("dialogoCiclo"); d.close ? d.close() : d.removeAttribute("open"); };
    on("btnDialogoContinuar", () => { cerrar(); if (this.fb.finalizado) this.#resultado(); else { this.fb.avanzar(); this.#pintarFuerza(); } });
    on("btnDialogoResolver", () => { cerrar(); this.#resultado(); });
    on("btnResolverTodo", () => this.#resultado());
    on("btnVolverMatriz", () => this.#verMatriz());
    on("btnVolverFuerza", () => { this.nav.ir("Fuerza", 6); this.#pintarFuerza(); });
    on("btnNuevoProblema", () => { if (!confirm("¿Empezar un problema nuevo? Se perderá el grafo actual.")) return; this.#irAlInicio(); });
  }
}
