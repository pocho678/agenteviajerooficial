/** Pinta `total` elementos de a `porPagina`, con botones Anterior/Siguiente. */
export function paginar(contenedor, total, porPagina, pintar, claseCuerpo = "") {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  let actual = 0;
  const cuerpo = document.createElement("div");
  cuerpo.className = claseCuerpo;
  const nav = document.createElement("div");
  nav.className = "botones paginador";
  nav.innerHTML = `<button class="secundario boton-pequeno" data-d="-1">Anterior</button>
    <span class="pagina"></span><button class="secundario boton-pequeno" data-d="1">Siguiente</button>`;
  const [ant, sig] = nav.querySelectorAll("button");
  const etiqueta = nav.querySelector(".pagina");
  const dibujar = () => {
    cuerpo.replaceChildren();
    pintar(cuerpo, actual * porPagina, Math.min(total, (actual + 1) * porPagina));
    etiqueta.textContent = `Página ${actual + 1} de ${paginas}`;
    ant.disabled = actual === 0;
    sig.disabled = actual >= paginas - 1;
  };
  nav.addEventListener("click", (e) => {
    const d = Number(e.target.dataset.d);
    if (d) { actual += d; dibujar(); }
  });
  contenedor.replaceChildren(cuerpo, ...(paginas > 1 ? [nav] : []));
  dibujar();
}
