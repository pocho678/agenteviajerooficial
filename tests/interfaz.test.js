import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LienzoGrafo } from '../src/ui/RenderizadorGrafo.js';
import { Grafo } from '../src/domain/Grafo.js';

globalThis.ResizeObserver = class { observe() {} };
globalThis.window = { devicePixelRatio: 1 };

function lienzo() {
  const ctx = new Proxy({}, { get(target, key) { return target[key] || (() => {}); } });
  const listeners = {};
  const canvas = {
    clientWidth: 650, clientHeight: 440, style: {},
    setAttribute() {}, getContext() { return ctx; },
    addEventListener(type, cb) { listeners[type] = cb; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 650, height: 440 }; },
    setPointerCapture() {}
  };
  return { view: new LienzoGrafo(canvas, { mapa: {x0:-5,y0:-5,ancho:30,alto:20} }), listeners };
}
const grafo = () => {
  const g = new Grafo([{x:0,y:0},{x:10,y:10},{x:20,y:0},{x:23,y:11},{x:3,y:14}]);
  for (let i=0;i<5;i++) g.agregarArista(i,(i+1)%5,i+2);
  return g;
};

test('Mapa editable: los pesos se conservan y la vista de ciclos usa posiciones originales',()=>{
  const g=grafo(), original=g.posiciones.map(p=>({...p})), pesos=g.aristas();
  const {view:mapa,listeners}=lienzo();
  mapa.mostrar(g);mapa.habilitarArrastre(()=>{});
  const node=mapa.pix[0];
  listeners.pointerdown({clientX:node.x,clientY:node.y,pointerId:1,preventDefault(){}});
  listeners.pointermove({clientX:node.x+32,clientY:node.y+25,pointerId:1});
  listeners.pointerup({});
  assert.notDeepEqual(g.posiciones,original);
  assert.deepEqual(g.aristas(),pesos);
  const {view:ciclos}=lienzo();
  ciclos.mostrar(g,{posiciones:original});
  assert.deepEqual(ciclos.args.posiciones,original);
  assert.notEqual(ciclos.pix[0].x,mapa.pix[0].x);
});

test('Fuerza bruta y resultado no se habilitan para arrastrar nodos',()=>{
  const code=readFileSync(new URL('../src/ui/Controlador.js',import.meta.url),'utf8');
  assert.match(code,/this\.lienzo\.grafo\.habilitarArrastre/);
  assert.doesNotMatch(code,/this\.lienzo\.ruta\.habilitarArrastre/);
  assert.doesNotMatch(code,/this\.lienzo\.resultado\.habilitarArrastre/);
  assert.doesNotMatch(code,/this\.lienzo\.ciclos\.habilitarArrastre/);
  assert.match(code,/this\.lienzo\.ruta\.mostrar\(g, \{ ciclo: c, k, posiciones: this\.#posicionesOriginales\(\) \}\)/);
});

test('Nueva generación y texto de coordenadas iniciales: controles y reglas presentes',()=>{
  const code=readFileSync(new URL('../src/ui/Controlador.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  for(const id of ['btnGenerarOtroGrafo']) {
    assert.match(html,new RegExp(`id="${id}"`));
    assert.match(code,new RegExp(`on\\("${id}"`));
  }
  assert.match(code,/Math\.round\(p\.x\)/);
  assert.match(code,/Math\.round\(p\.y\)/);
  assert.match(code,/this\.sesion\.iniciarAleatorio\(n, this\.sesion\.completo, this\.sesion\.config\)/);
});


test('El visor de ciclos mantiene la disposición original de cada nodo',()=>{
  const g=grafo(), original=g.posiciones.map(p=>({...p}));
  const ciclo={nodos:[0,2,4,1,3,0], texto:()=>"A → C → E → B → D → A"};
  const {view}=lienzo();
  view.soloRuta=true;
  view.mostrar(g,{ciclo,posiciones:original});
  const posicionesDibujadas=view.pix.map(p=>({x:p.x,y:p.y}));
  const {view:referencia}=lienzo();
  referencia.mostrar(g,{posiciones:original});
  assert.deepEqual(posicionesDibujadas, referencia.pix.map(p=>({x:p.x,y:p.y})));
  assert.deepEqual(g.posiciones,original);
  const source=readFileSync(new URL('../src/ui/Controlador.js',import.meta.url),'utf8');
  assert.match(source,/this\.lienzo\.ciclos\.mostrar\(this\.grafo, \{ ciclo: c, posiciones: this\.#posicionesOriginales\(\) \}\)/);
});

test('La portada ya no ofrece grafo dirigido ni aparece regenerar en verificación',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const code=readFileSync(new URL('../src/ui/Controlador.js',import.meta.url),'utf8');
 assert.doesNotMatch(html,/name="tipoGrafo"/);
 assert.doesNotMatch(html,/id="btnGenerarOtroVerificacion"/);
 assert.doesNotMatch(code,/confirm\("¿Generar otro grafo aleatorio/);
 assert.doesNotMatch(code,/ordenarCiclo/);
});
