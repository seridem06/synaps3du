/** Misti Comunicación: reglas de progreso DEMO. Sin servicios remotos ni notas oficiales. */
export const STORAGE_KEY = 'synaps3du_misti_comunicacion_demo_v1';
export const WORLDS = [
  { id: 'M1', nombre: 'Exploradores de historias', icono: '📚', breve: 'Leo e interpreto' },
  { id: 'M2', nombre: 'Oídos atentos', icono: '🎧', breve: 'Escucho y comprendo' },
  { id: 'M3', nombre: 'Creadores de palabras', icono: '✍️', breve: 'Escribo y creo' },
  { id: 'M4', nombre: 'Voces que inspiran', icono: '🎙️', breve: 'Me expreso' },
  { id: 'M5', nombre: 'Grandes comunicadores', icono: '🏆', breve: 'Integro lo aprendido' }
];

export function startState() { return { version: 1, grades: {} }; }
export function getGradeState(state, grade) {
  const key = String(grade);
  const entry = state?.grades?.[key];
  return {
    done: entry?.done && typeof entry.done === 'object' ? entry.done : {},
    days: Array.isArray(entry?.days) ? entry.days : [],
    drafts: entry?.drafts && typeof entry.drafts === 'object' ? entry.drafts : {}
  };
}
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function previousDate(ymd) {
  const [y,m,d] = ymd.split('-').map(Number);
  const dt = new Date(y, m-1, d-1, 12);
  return localDate(dt);
}
export function streakForDays(days, today = localDate()) {
  const available = new Set(days.filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)));
  let day = available.has(today) ? today : previousDate(today);
  let count = 0;
  while (available.has(day) && count < 3660) {
    count += 1;
    day = previousDate(day);
  }
  return count;
}
export function completedCount(state, grade, missions) {
  const done = getGradeState(state,grade).done;
  return missions.filter(x=>x.grado === Number(grade) && Boolean(done[x.id])).length;
}
export function totalXp(state, grade) {
  const done = getGradeState(state, grade).done;
  return Object.values(done).reduce((sum,r)=>sum+(Number.isFinite(r?.xp)?r.xp:0),0);
}
export function isUnlocked(state, grade, missions, missionId) {
  const ordered = missions.filter(x=>x.grado===Number(grade)).sort((a,b)=>Number(a.mundo_id.slice(1))-Number(b.mundo_id.slice(1)));
  const index = ordered.findIndex(x=>x.id===missionId);
  if(index<0) return false;
  if(index===0) return true;
  return Boolean(getGradeState(state,grade).done[ordered[index-1].id]);
}
export function saveDraft(state,grade,missionId,value) {
  const copy = structuredClone(state);
  const key = String(grade);
  copy.grades[key] ||= {done:{}, days:[], drafts:{}};
  copy.grades[key].drafts ||= {};
  copy.grades[key].drafts[missionId] = String(value).slice(0,4500);
  return copy;
}
/** mode: verified_answer, answer_with_transcript, submitted_draft, oral_plan, submitted_project */
export function finishMission(state,mission,{mode,attempts=1}={},now=new Date()) {
  const choices = new Set(['verified_answer','answer_with_transcript','submitted_draft','oral_plan','submitted_project']);
  if(!choices.has(mode)) throw new Error('Tipo de registro inválido');
  if(mode==='verified_answer' && !['seleccion','escucha'].includes(mission.tipo)) throw new Error('No es una actividad cerrada');
  const copy=structuredClone(state);
  const grade=String(mission.grado);
  copy.grades[grade] ||= {done:{},days:[],drafts:{}};
  const g=copy.grades[grade];
  g.done ||= {};
  g.days ||= [];
  if(g.done[mission.id]) return copy; // sin acumulación de XP al repetir
  const participation=['submitted_draft','oral_plan','submitted_project'].includes(mode);
  const xp= participation ? 5 : (attempts===1 ? 15 : 10);
  g.done[mission.id]={mode,xp,attempts,date:localDate(now),capacidad_id:mission.capacidad_principal_id};
  const day=localDate(now);
  if(!g.days.includes(day))g.days.push(day);
  return copy;
}
export function getMissionSummary(state, grade, missions, capacities) {
  const g=getGradeState(state,grade);
  const rows=[];
  for (const c of capacities) {
    const relevant=missions.filter(x=>x.grado===Number(grade) && x.capacidad_principal_id===c.id);
    const missionIds=new Set(missions.map(x=>x.id));
    const finished=[...relevant.filter(x=>g.done[x.id]).map(x=>g.done[x.id]),
      ...Object.entries(g.done).filter(([id,r])=>!missionIds.has(id)&&r?.capacidad_id===c.id).map(([,r])=>r)];
    let status='Sin actividad completada';
    if (finished.some(x=>x.mode==='verified_answer'))status='Acierto puntual registrado';
    else if(finished.some(x=>x.mode==='answer_with_transcript'))status='Respuesta con apoyo de transcripción';
    else if(finished.length)status='Producción/guion pendiente de revisión';
    rows.push({id:c.id,nombre:c.nombre_oficial,status});
  }
  return rows;
}
