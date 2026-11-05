import { STORAGE_KEY, WORLDS, startState, getGradeState, localDate, streakForDays, completedCount, totalXp, isUnlocked, saveDraft, finishMission, getMissionSummary } from './core.mjs';

const $ = selector => document.querySelector(selector);
const escape = input => String(input ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state = readState();
let grade = 4;
let missions = [];
let capacities = [];
let active = null;
let selected = null;
let tries = 0;
let hints = 0;
let transcriptShown = false;
let statusMessage = '';
let completedThisOpen = false;

function readState(){
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved?.version === 1 && saved.grades && typeof saved.grades==='object' ? saved : startState();
  } catch { return startState(); }
}
function persist(){
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); }
  catch { alert('Tu navegador no permite guardar el progreso local. Podrás practicar, pero el avance no se conservará.'); }
}
function sortedGradeMissions(){return missions.filter(m=>m.grado===grade).sort((a,b)=>Number(a.mundo_id.slice(1))-Number(b.mundo_id.slice(1)));}
function completed(m){return getGradeState(state,grade).done[m.id];}
function message(text){$('#mistiLine').textContent=text;}
function renderGradeButtons(){
 $('#gradeButtons').innerHTML=[4,5,6].map(g=>`<button class="grade ${grade===g?'active':''}" data-grade="${g}" aria-pressed="${grade===g}">${g}.º</button>`).join('');
 document.querySelectorAll('[data-grade]').forEach(el=>el.addEventListener('click',()=>{
   grade=Number(el.dataset.grade); active=null;selected=null;statusMessage='';hints=0;tries=0;transcriptShown=false;completedThisOpen=false;
   $('#reportPanel').hidden=true; renderAll(); $('#activityPanel').innerHTML='<div class="activity-placeholder"><span>🗺️</span><h2>¡Elige una aventura!</h2><p>Selecciona el primer mundo para comenzar.</p></div>';
   message(`¡Hola! En ${grade}.º de primaria comenzaremos por leer, escuchar, escribir y expresarnos.`);
 }));
}
function renderStats(){
 const g=getGradeState(state,grade);
 $('#xpValue').textContent=totalXp(state,grade);
 $('#streakValue').textContent=streakForDays(g.days, localDate());
 $('#finishedValue').textContent=`${completedCount(state,grade,missions)}/5`;
}
function renderWorlds(){
 $('#worldCards').innerHTML=sortedGradeMissions().map(m=>{
   const w=WORLDS.find(w=>w.id===m.mundo_id);
   const done=Boolean(completed(m));
   const enabled=isUnlocked(state,grade,missions,m.id);
   return `<button class="world-card" data-mission="${escape(m.id)}" ${enabled?'':'disabled'} aria-label="${escape(w.nombre)} ${done?'completado':enabled?'disponible':'bloqueado'}">
     <span class="world-icon" aria-hidden="true">${w.icono}</span><span class="world-description"><strong>${escape(w.nombre)}</strong><span>${escape(m.titulo)} · ${escape(w.breve)}</span></span>
     <span class="world-tag ${done?'done':''}">${done?'✓ Entregada':enabled?'Iniciar':'🔒 Bloqueada'}</span>
   </button>`;
 }).join('');
 document.querySelectorAll('[data-mission]').forEach(b=>b.addEventListener('click',()=>openMission(b.dataset.mission)));
}
function renderAll(){renderGradeButtons();renderStats();renderWorlds();}
function renderMission(){
 if (!active) return;
 const a=active;
 const w=WORLDS.find(w=>w.id===a.mundo_id);
 const finished=completed(a);
 const typeLabels={seleccion:'Lectura',escucha:'Escucha',escritura:'Escritura creativa',oralidad:'Planificación oral',proyecto:'Desafío integrador'};
 let content='';
 if (a.tipo==='seleccion' || a.tipo==='escucha') {
   const listening=a.tipo==='escucha';
   content += listening ? `<p class="activity-area">🎧 Escucha el audio y responde. Puedes repetirlo cuantas veces necesites.</p><audio controls preload="none" src="${escape(a.audio)}" aria-label="Reproducir mensaje oral"></audio>
      <div class="controls"><button class="button outline" id="toggleTranscript">${transcriptShown?'Ocultar':'Mostrar'} transcripción</button></div>
      ${transcriptShown?`<div class="bodytext">${escape(a.guion_audio)}</div>`:''}` : `<div class="bodytext">${escape(a.texto_base)}</div>`;
   content += `<div class="prompt">${escape(a.pregunta)}</div><div class="options">${a.opciones.map((op,i)=>`<button class="option ${selected===i?'selected':''}" data-answer="${i}" aria-pressed="${selected===i}">${escape(op)}</button>`).join('')}</div>`;
   if(finished){
     content += `<div class="feedback success">✅ Misión registrada. ${escape(a.explicacion)}<br><small>${escape(finished.mode==='answer_with_transcript'?'Resolviste con apoyo de la transcripción; no se evalúa tu escucha sin ese apoyo.':'Acierto puntual, no equivale a dominar toda una capacidad.')}</small></div>`;
   }else{
     content += `<div class="controls"><button class="button" id="checkAnswer" ${selected===null?'disabled':''}>Comprobar respuesta</button><button class="button secondary" id="showHint" ${hints>=a.pistas.length?'disabled':''}>💡 Pista ${Math.min(hints+1,2)}/2</button></div>`;
   }
 } else {
   const draft=getGradeState(state,grade).drafts[a.id] || '';
   content += `<p class="activity-area">${escape(a.consigna)}</p><div class="rubric"><h3>Qué observaremos en la revisión</h3><ul>${a.criterios_rubrica.map(s=>`<li>${escape(s)}</li>`).join('')}</ul></div>
   <p class="prompt">${a.tipo==='oralidad'?'Escribe tu guion de práctica:':'Escribe tu propuesta o borrador:'}</p>
   <textarea class="writebox" id="studentDraft" maxlength="4500" placeholder="Escribe aquí usando personajes y situaciones ficticias…" aria-label="Respuesta escrita">${escape(draft)}</textarea>
   <p class="review-note">No escribas nombres reales, direcciones ni información privada. Se guarda solo en este navegador.</p>
   ${finished?`<div class="feedback success">✅ ${a.tipo==='oralidad'?'Guion de práctica guardado. No se evaluó tu voz ni una interacción real.':'Borrador guardado. Requiere revisión docente; aún no está calificado.'}</div>`:`<div class="controls"><button class="button" id="saveActivity">${a.tipo==='oralidad'?'Registrar mi guion':'Guardar mi trabajo'}</button><button class="button secondary" id="showHint" ${hints>=a.pistas.length?'disabled':''}>💡 Pista ${Math.min(hints+1,2)}/2</button></div>`}`;
 }
 const hintHtml=hints>0?`<div class="hint"><strong>💜 Misti te ayuda:</strong> ${escape(a.pistas[hints-1])}</div>`:'';
 $('#activityPanel').innerHTML=`<div class="activity-title"><div><p class="eyebrow">${escape(w.nombre.toUpperCase())} · ${grade}.º PRIMARIA</p><h2>${escape(a.titulo)}</h2></div><span class="tag">${escape(typeLabels[a.tipo])} · ${escape(a.capacidad_principal_id)}</span></div><p class="activity-area">${escape(a.descripcion)}</p>${content}${hintHtml}<div id="statusMessage" aria-live="polite">${statusMessage}</div><p class="review-note">Actividades originales de demostración · Alineación curricular propuesta pendiente de validación pedagógica.</p>`;
 $('#activityPanel').querySelectorAll('[data-answer]').forEach(el=>el.addEventListener('click',()=>{if(finished)return;selected=Number(el.dataset.answer);statusMessage='';renderMission();}));
 $('#toggleTranscript')?.addEventListener('click',()=>{transcriptShown=!transcriptShown;renderMission();});
 $('#checkAnswer')?.addEventListener('click',checkAnswer);
 $('#showHint')?.addEventListener('click',()=>{hints=Math.min(2,hints+1);renderMission();message(a.pistas[hints-1]);});
 $('#studentDraft')?.addEventListener('input',e=>{state=saveDraft(state,grade,a.id,e.target.value);persist();});
 $('#saveActivity')?.addEventListener('click',saveOpenActivity);
}
function openMission(id){
 const m=missions.find(x=>x.id===id&&x.grado===grade);
 if(!m || !isUnlocked(state,grade,missions,id))return;
 active=m; selected=null;hints=0;tries=0;statusMessage='';transcriptShown=false;completedThisOpen=false;
 $('#reportPanel').hidden=true;renderMission();message(`¡Vamos con «${m.titulo}»! Si te cuesta, tengo dos pistas para ayudarte.`);
 $('#activityPanel').scrollIntoView({behavior:'smooth',block:'start'});
}
function finish(a,mode){
 const previous=Boolean(completed(a));
 state=finishMission(state,a,{mode,attempts:Math.max(1,tries)});
 persist();renderStats();renderWorlds();renderMission();
 if(!previous)message(`¡Buen avance! Registré tu misión y sumaste XP. Recuerda: aprender vale más que acertar a la primera.`);
}
function checkAnswer(){
 if(!active||selected===null||completed(active))return;
 tries+=1;
 if(selected!==active.respuesta_correcta_indice){
   statusMessage='<div class="feedback">Todavía no. Busca una pista en el texto o vuelve a escuchar. ¡Puedes intentarlo otra vez!</div>';
   renderMission();message('Equivocarse también ayuda. Observa qué parte del texto o audio sustenta cada alternativa.');return;
 }
 statusMessage='';
 const mode=active.tipo==='escucha'&&transcriptShown?'answer_with_transcript':'verified_answer';
 finish(active,mode);
}
function saveOpenActivity(){
 if (!active || completed(active))return;
 const input=$('#studentDraft');
 const value=(input?.value??'').trim();
 if(value.length<40){
   statusMessage='<div class="feedback">Escribe un poco más (al menos 40 caracteres) para guardar tu borrador.</div>';
   renderMission();return;
 }
 state=saveDraft(state,grade,active.id,value);
 const mode=active.tipo==='oralidad'?'oral_plan':active.tipo==='proyecto'?'submitted_project':'submitted_draft';
 tries=1;finish(active,mode);
}
function renderReport(){
 const done=getGradeState(state,grade).done;
 const rows=getMissionSummary(state,grade,missions,capacities);
 $('#reportPanel').innerHTML=`<div class="activity-title"><div><p class="eyebrow">RESUMEN DE PROGRESO · ${grade}.º</p><h2>Mi avance en Comunicación</h2></div><button id="resetProgress" class="button slate">Borrar progreso de demo</button></div>
 <p class="activity-area">⭐ ${totalXp(state,grade)} XP de práctica · 🔥 ${streakForDays(getGradeState(state,grade).days)} días de racha · 🎯 ${completedCount(state,grade,missions)}/5 misiones entregadas.</p>
 <p class="review-note">Se muestran las 13 capacidades del currículo. Un acierto aislado no significa dominio; los borradores y guiones requieren revisión docente.</p>
 <div class="report-list">${rows.map(r=>`<div class="report-item"><strong>${escape(r.id)} · ${escape(r.nombre)}</strong><small>${escape(r.status)}</small></div>`).join('')}</div>`;
 $('#reportPanel').hidden=false;
 $('#resetProgress').addEventListener('click',()=>{
  if(!confirm(`¿Quieres borrar los avances y borradores DEMO de ${grade}.º guardados en este navegador?`))return;
  delete state.grades[String(grade)];persist();renderAll();renderReport();
  $('#activityPanel').innerHTML='<div class="activity-placeholder"><span>🗺️</span><h2>¡Nueva aventura!</h2><p>El progreso de esta demo se reinició.</p></div>';
 });
 $('#reportPanel').scrollIntoView({behavior:'smooth',block:'start'});
}
async function start(){
 try{
  const [missionRes, matrixRes] = await Promise.all([fetch('./data/misiones_demo.json',{cache:'no-store'}),fetch('../data/matriz_curricular.json',{cache:'no-store'})]);
  if(!missionRes.ok || !matrixRes.ok)throw new Error('No se pudieron cargar los datos del módulo.');
  missions=(await missionRes.json()).misiones;
  capacities=(await matrixRes.json()).capacidades;
  if(!Array.isArray(missions)||missions.length!==15||!Array.isArray(capacities)||capacities.length!==13)throw new Error('Los datos de misiones o capacidades están incompletos.');
  renderAll();
  $('#showReport').addEventListener('click',renderReport);
 }catch(e){
  $('#worldCards').innerHTML=`<div class="error-box"><strong>No pudimos iniciar las misiones.</strong><p>${escape(e.message)}</p><p>Abre una terminal en la raíz de synaps3du y ejecuta <code>python -m http.server 8000</code>. Luego abre <code>http://localhost:8000/modules/comunicacion/ui/</code>. Comprueba también que subiste la matriz curricular del Commit 2.</p></div>`;
 }
}
window.addEventListener('misti:practice-saved',()=>{ state=readState(); renderStats(); if(!$('#reportPanel').hidden)renderReport(); });
start();
