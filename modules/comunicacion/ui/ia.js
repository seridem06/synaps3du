/** Commit 5: puente entre la interfaz del Commit 4 y el banco local verificado.
 * No llama a OpenRouter desde el navegador. No envía textos ni datos de menores.
 */
import { STORAGE_KEY, startState, finishMission } from './core.mjs';

const $ = s => document.querySelector(s);
const escape = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let grado = 4;
let actividad = null;
let indice = null;
let intentos = 0;
let pistas = 0;
let seq = 0;
let nombres = {};
let capacidad = 'L2';

async function api(path, options) {
  const respuesta = await fetch(path, { cache:'no-store', ...options });
  let data;
  try { data = await respuesta.json(); } catch { throw new Error('El servidor no devolvió JSON.'); }
  if (!respuesta.ok) throw new Error(data.error || `HTTP ${respuesta.status}`);
  return data;
}
function aviso(texto, error=false) {
  window.dispatchEvent(new CustomEvent('misti:feedback',{detail:{texto,error}}));
  const target = $('#iaFeedback');
  target.textContent = texto;
  target.className = `ia-feedback ${error?'warning':''}`;
}
function estado(texto, warning=false) {
  const el = $('#iaStatus');
  el.textContent = texto;
  el.className = warning ? 'ia-status warning' : 'ia-status';
}
function registrarAcierto() {
  // XP/racha en la misma copia local que los cinco mundos, pero sin afirmar dominio.
  let s;
  try { s = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { /* demo */ }
  if (!s || s.version !== 1) s = startState();
  const prev = Boolean(s.grades?.[grado]?.done?.[actividad.id]);
  try {
    s = finishMission(s, {
      id: actividad.id, grado,
      tipo:'seleccion', capacidad_principal_id: actividad.capacidad_principal_id
    }, {mode:'verified_answer', attempts:Math.max(1,intentos)});
    localStorage.setItem(STORAGE_KEY,JSON.stringify(s));
    window.dispatchEvent(new CustomEvent('misti:practice-saved'));
    return !prev;
  } catch { return false; }
}
function renderActividad() {
  const el=$('#iaContent');
  if (!actividad) {
    el.innerHTML='<p class="ia-empty">Elige una capacidad disponible para practicar.</p>';
    return;
  }
  const a=actividad;
  const closed=a.tipo==='seleccion';
  const contenido=closed ? `
    <div class="bodytext">${escape(a.texto_base)}</div>
    <p class="prompt">${escape(a.pregunta)}</p>
    <div class="options">${a.opciones.map((s,i)=>`<button type="button" class="option" data-ia-option="${i}" aria-pressed="false">${escape(s)}</button>`).join('')}</div>
    <div class="controls"><button class="button" id="iaAnswer" disabled>Comprobar</button><button class="button secondary" id="iaHint">💡 Pista 1/2</button></div>` : `
    <p class="activity-area">${escape(a.consigna||'')}</p>
    <div class="rubric"><h3>Criterios para revisión posterior</h3><ul>${(a.criterios_rubrica||[]).map(c=>`<li>${escape(c)}</li>`).join('')}</ul></div>
    <textarea id="iaDraft" maxlength="4000" class="writebox" placeholder="Escribe un borrador ficticio, sin datos personales..."></textarea>
    <div class="controls"><button id="iaSaveDraft" class="button">Guardar borrador local</button></div>
    <p class="review-note">No se asigna nota ni se evalúa la oralidad automáticamente.</p>`;
  el.innerHTML=`<div class="ia-mini"><span class="tag">${escape(a.capacidad_principal_id)} · ${grado}.º</span><span class="ia-origin">${escape(a.etiqueta)}</span></div>
    <h3>${escape(a.titulo)}</h3>${contenido}`;
  if (closed) {
    el.querySelectorAll('[data-ia-option]').forEach(b=>b.addEventListener('click',()=>{
      indice=Number(b.dataset.iaOption);
      el.querySelectorAll('[data-ia-option]').forEach(x=>{
        x.classList.toggle('selected',x===b);
        x.setAttribute('aria-pressed',String(x===b));
      });
      $('#iaAnswer').disabled=false;
    }));
    $('#iaAnswer').addEventListener('click', comprobar);
    $('#iaHint').addEventListener('click', pedirPista);
  } else {
    $('#iaSaveDraft').addEventListener('click',()=>{
      const txt=$('#iaDraft').value.trim();
      if (txt.length < 40) return aviso('Escribe al menos 40 caracteres para guardar el borrador.',true);
      const key=`misti_borrador_practica_${grado}_${a.id}`;
      try {localStorage.setItem(key,txt); aviso('Borrador guardado en este navegador. Pendiente de revisión humana.');}
      catch {aviso('No se pudo guardar el borrador en este navegador.',true);}
    });
  }
}
async function pedirPista() {
  if (!actividad || pistas>=2) return;
  const nivel=pistas+1;
  try {
    const data=await api(`/api/misti/pista?id=${encodeURIComponent(actividad.id)}&nivel=${nivel}`);
    pistas=nivel;
    aviso(`💜 Misti: ${data.pista}`);
    $('#iaHint').textContent=pistas===2?'Ya viste ambas pistas':`💡 Pista ${pistas+1}/2`;
    $('#iaHint').disabled=pistas===2;
  } catch(e) { aviso(e.message,true); }
}
async function comprobar() {
  if (!actividad || indice===null) return;
  const a=actividad;
  intentos++;
  $('#iaAnswer').disabled=true;
  try {
    const data=await api('/api/misti/responder',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({id:a.id,opcion:indice})
    });
    if (a!==actividad) return; // cambio de pregunta durante solicitud
    if (data.correcta) {
      const novedad=registrarAcierto();
      aviso(`${data.mensaje} Evidencia: «${data.cita_evidencia}». ${novedad?'Sumaste XP de práctica.':'Ya habías registrado XP por esta actividad.'}`);
      $('#iaAnswer').textContent='Correcto ✓';
      $('#iaHint').disabled=true;
      $('#iaContent').querySelectorAll('[data-ia-option]').forEach(b=>b.disabled=true);
    } else {
      aviso(data.mensaje,true);
      $('#iaAnswer').disabled=false;
    }
  } catch(e) { aviso(`No se comprobó la respuesta: ${e.message}`,true); $('#iaAnswer').disabled=false; }
}
async function consultarCapacidades() {
  const stamp=++seq;
  $('#iaLoad').disabled=true;
  actividad=null;indice=null;intentos=0;pistas=0;
  renderActividad();aviso('');
  try {
    const data=await api(`/api/misti/catalogo?grado=${grado}`);
    if (stamp!==seq) return;
    const select=$('#iaCapacity');
    if (!data.capacidades.length) {
      select.innerHTML='<option value="">Aún no hay actividades publicadas</option>';
      estado('Sin actividades disponibles',true);
      return;
    }
    select.innerHTML=data.capacidades.map(x=>`<option value="${escape(x.id)}">${escape(x.id)} · ${escape(nombres[x.id]||'Capacidad')} (${x.cantidad})</option>`).join('');
    if(data.capacidades.some(x=>x.id===capacidad))select.value=capacidad;
    else capacidad=select.value;
    estado('Banco de práctica conectado');
    await cargarOtra();
  } catch(e) {
    if(stamp!==seq)return;
    $('#iaCapacity').innerHTML='<option value="">Sin servidor Misti</option>';
    $('#iaContent').innerHTML='<div class="ia-empty">Los cinco mundos funcionan normalmente. Para practicar variantes con comprobación desde el servidor, ejecuta <code>python modules/comunicacion/backend/servidor.py --port 8765</code> y abre esta página desde ese mismo puerto.</div>';
    estado('Servidor de actividades desconectado',true);
    aviso('No hay conexión con el backend local. La demo principal sigue disponible.');
  } finally { if(stamp===seq)$('#iaLoad').disabled=false; }
}
async function cargarOtra() {
  const stamp=++seq;
  const last=actividad?.id||'';
  capacidad=$('#iaCapacity').value;
  if(!capacidad)return;
  $('#iaLoad').disabled=true;
  aviso('');
  try {
    const data=await api(`/api/misti/actividad?grado=${grado}&capacidad=${encodeURIComponent(capacidad)}&exclude=${encodeURIComponent(last)}`);
    if(stamp!==seq)return;
    actividad=data.actividad;
    window.dispatchEvent(new CustomEvent('misti:activity',{detail:{id:actividad.id,grado}}));
    indice=null;intentos=0;pistas=0;
    renderActividad();
  } catch(e) {
    if(stamp!==seq)return;
    actividad=null;
    renderActividad();
    aviso(e.message,true);
  } finally {if(stamp===seq)$('#iaLoad').disabled=false;}
}
async function empezar() {
  try {
    const r=await fetch('../data/matriz_curricular.json');
    if(r.ok) {const d=await r.json(); nombres=Object.fromEntries(d.capacidades.map(x=>[x.id,x.nombre_oficial]));}
  } catch { /* labels are optional */ }
  $('#iaLoad').addEventListener('click',cargarOtra);
  $('#iaCapacity').addEventListener('change',()=>{actividad=null; cargarOtra();});
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-grade]');
    if(button){
      const nuevo=Number(button.dataset.grade);
      if([4,5,6].includes(nuevo) && grado!==nuevo){grado=nuevo;capacidad='L2';consultarCapacidades();}
    }
  });
  await consultarCapacidades();
}
empezar();
