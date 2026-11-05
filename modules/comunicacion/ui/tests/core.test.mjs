import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {startState,finishMission,totalXp,streakForDays,getGradeState,isUnlocked,completedCount,getMissionSummary} from '../core.mjs';
const testsDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(testsDir,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'data/misiones_demo.json'),'utf8'));
const matrix=JSON.parse(fs.readFileSync(path.join(root,'../data/matriz_curricular.json'),'utf8'));
const all=data.misiones;

test('15 misiones: un mundo por cada grado y 3 modalidades adicionales',()=>{
 assert.equal(all.length,15);
 for(const grade of [4,5,6]){
  const missions=all.filter(m=>m.grado===grade);
  assert.deepEqual(missions.map(x=>x.mundo_id),['M1','M2','M3','M4','M5']);
  assert.deepEqual(missions.map(x=>x.tipo),['seleccion','escucha','escritura','oralidad','proyecto']);
 }
});
test('cada misión apunta a capacidad curricular real',()=>{
 const caps=new Set(matrix.capacidades.map(c=>c.id));
 for(const m of all){assert(caps.has(m.capacidad_principal_id));assert(m.pistas.length===2);assert(m.estado_revision.includes('pendiente'));}
});
test('audios existen y son WAV auténticos',()=>{
 for(const m of all.filter(m=>m.tipo==='escucha')){
  const audio=fs.readFileSync(path.join(root,m.audio));
  assert.equal(audio.toString('ascii',0,4),'RIFF');
  assert.equal(audio.toString('ascii',8,12),'WAVE');
 }
});
test('preguntas cerradas con opciones correctas y diferencias',()=>{
 for(const m of all.filter(m=>m.tipo==='seleccion'||m.tipo==='escucha')){
  assert.equal(m.opciones.length,3);
  assert(m.respuesta_correcta_indice>=0&&m.respuesta_correcta_indice<=2);
  assert.equal(new Set(m.opciones).size,3);
 }
});
test('bloqueos de misiones y desbloqueo sin editar master',()=>{
 const m=all.filter(m=>m.grado===4);
 let state=startState();
 assert(isUnlocked(state,4,all,m[0].id));
 assert.equal(isUnlocked(state,4,all,m[1].id),false);
 state=finishMission(state,m[0],{mode:'verified_answer',attempts:1},new Date(2026,10,5));
 assert(isUnlocked(state,4,all,m[1].id));
 assert.equal(completedCount(state,4,all),1);
});
test('XP no se repite si el estudiante rehace la misión',()=>{
 const m=all[0];
 let state=finishMission(startState(),m,{mode:'verified_answer',attempts:2},new Date(2026,10,5));
 state=finishMission(state,m,{mode:'verified_answer',attempts:1},new Date(2026,10,5));
 assert.equal(totalXp(state,4),10);
 assert.equal(getGradeState(state,4).days.length,1);
});
test('racha cuenta días distintos consecutivos y se corta en huecos',()=>{
 assert.equal(streakForDays(['2026-11-03','2026-11-04','2026-11-05'],'2026-11-05'),3);
 assert.equal(streakForDays(['2026-11-02','2026-11-05'],'2026-11-05'),1);
 assert.equal(streakForDays(['2026-11-03','2026-11-04'],'2026-11-05'),2);
});
test('guion oral no se registra como capacidad demostrada',()=>{
 const oral=all.find(m=>m.grado===4&&m.tipo==='oralidad');
 const state=finishMission(startState(),oral,{mode:'oral_plan'},new Date(2026,10,5));
 const report=getMissionSummary(state,4,all,matrix.capacidades);
 assert(report.find(r=>r.id==='O3').status.includes('pendiente de revisión'));
 assert.equal(totalXp(state,4),5);
});
