const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let code=fs.readFileSync('js/app.js','utf8').replace('  iniciar();','  renderRuta=()=>{}; animo=()=>{}; toast=()=>{}; sumarPuntos=(n)=>{S.puntos.total+=n;guardar();}; window.audit={setState:x=>S=x,getState:()=>S,cargar,guardar,cofreEl};');
const mem=new Map();
const node=()=>({style:{setProperty(){}},children:[],append(...items){this.children.push(...items);},classList:{add(){},remove(){}}});
const ctx={window:{},document:{getElementById:node,createElement:node},localStorage:{getItem:k=>mem.get(k),setItem:(k,v)=>mem.set(k,v)},MistyCurr:{AREAS:{},nombresAreas:[]},console,Date,setTimeout:()=>0};
vm.createContext(ctx);vm.runInContext(code,ctx);
const a=ctx.window.audit;
for(const grade of [4,5,6]){
 const s=a.getState();s.perfil={grado:grade+'.° grado'};s.rutas=[{id:'r',grado:grade,nodos:[{comunicacionId:'a'+grade,estado:'activo'}]}];s.rutaActiva='r';s.puntos.total=42;s.comPremios={['a'+grade]:true};a.setState(s);a.guardar();a.cargar();assert.equal(a.getState().puntos.total,42);assert.equal(ctx.window.mistiContext().id,'a'+grade);assert.equal(ctx.window.mistiContext().grado,grade);assert.equal(a.getState().comPremios['a'+grade],true);
}
const chestState=a.getState();chestState.puntos.total=0;
for(let j=0;j<2;j++){const r={nodos:[{estado:'hecho',comunicacionId:'same'}]};const row=a.cofreEl(r,0,0);const button=row.children[0].children[0];button.onclick();button.onclick();}
assert.equal(a.getState().puntos.total,0);
const math={nodos:[{estado:'hecho'}]};const button=a.cofreEl(math,0,0).children[0].children[0];button.onclick();button.onclick();assert.equal(a.getState().puntos.total,15);
console.log('PASS: cofres Comunicación sin XP repetible; Matemática +15 una vez');
const s=a.getState();s.config.key='secret';s.config.keyGemini='secret';a.guardar();assert(!mem.get('misty.v1').includes('secret'));
console.log('PASS: grados 4/5/6, contexto tras recarga, puntos y marcas persistidos, claves excluidas');
// Actual browser API adapter: only same-origin backend, including old Gemini config.
let request;
const ai={window:{mistiContext:()=>({grado:4,id:'demo'})},location:{origin:'http://localhost'},MistyCurr:{},fetch:async(url,opts)=>{request={url,...opts};return {ok:true,json:async()=>({modo:'ia',texto:'pista'})};}};
vm.createContext(ai);vm.runInContext(fs.readFileSync('js/ai.js','utf8')+'\nglobalThis.adapter=MistyAI;',ai);
(async()=>{await ai.adapter.stream({proveedor:'gemini',key:'not-to-send',messages:[{role:'user',content:'Hola'}]});assert.equal(request.url,'/api/misti/modelo');assert(!request.body.includes('not-to-send'));assert.equal(JSON.parse(request.body).id,'demo');console.log('PASS: chat real adapter uses backend and no credentials');})();
