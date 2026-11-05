"""Misti Comunicación: prototipo autónomo de plantillas y borradores IA.

Uso seguro: no modifica frontend, no contiene credenciales, no asigna notas oficiales.
Para integrar en la aplicación se requiere revisión docente y conexión backend.
"""
from __future__ import annotations

import argparse
import copy
import json
import os
from pathlib import Path
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

DIR = Path(__file__).resolve().parent
CATALOGO = DIR.parent / 'data' / 'plantillas_actividades.json'
DEMOS = DIR / 'ejemplos_demo.json'
API_URL = 'https://openrouter.ai/api/v1/chat/completions'
TIPOS_VALIDOS = {'seleccion', 'escucha', 'escritura', 'oralidad'}


def leer_json(ruta: Path):
    return json.loads(ruta.read_text(encoding='utf-8'))


def obtener_plantilla(plantilla_id: str):
    datos = leer_json(CATALOGO)
    for p in datos['plantillas']:
        if p['id'] == plantilla_id:
            return p
    raise ValueError(f'No se encuentra la plantilla: {plantilla_id}')


def construir_prompt(plantilla: dict, grado: int):
    contexto = plantilla['por_grado'][str(grado)]
    formato = plantilla['tipo']
    instrucciones_formato = {
        'seleccion': (
            'Devuelve: tipo="seleccion", titulo, texto_base, pregunta, opciones (3 textos), '
            'respuesta_correcta_indice (0, 1 o 2), cita_evidencia (fragmento literal exacto del texto), '
            'pistas (2 orientaciones sin revelar solución). '
            'La inferencia debe poder justificarse por el texto; evita respuestas discutibles.'
        ),
        'escucha': (
            'Devuelve: tipo="escucha", titulo, guion_audio, audio_disponible=false, '
            'pregunta, opciones (3 textos), respuesta_correcta_indice (0, 1 o 2), '
            'cita_evidencia (fragmento literal exacto del guion), pistas (2). '
            'El guion todavía NO constituye un audio: la actividad se mostrará solo después de grabar o generar y verificar audio.'
        ),
        'escritura': (
            'Devuelve: tipo="escritura", titulo, consigna, criterios_rubrica (3 criterios observables), '
            'pistas (2). NO incluyas respuesta única, nota ni evaluación automática.'
        ),
        'oralidad': (
            'Devuelve: tipo="oralidad", titulo, consigna, criterios_rubrica (3 criterios observables), '
            'pistas (2). NO supongas que hay grabación, interacción o evidencia oral.'
        ),
    }
    system = (
        'Eres un diseñador de BORRADORES de actividades de Comunicación para niños de primaria peruana. '
        'Respeta la plantilla recibida y entrega un objeto JSON sin markdown. '
        'Crea contenido ORIGINAL y apropiado para menores, sin datos reales ni solicitudes de información personal. '
        'No inventes citas del MINEDU, estándares oficiales ni informes de logro. '
        'Tu salida necesitará revisión pedagógica antes de mostrarse al estudiante.'
    )
    user = '\n'.join([
        f'Grado: {grado} de primaria (Perú).',
        f'Competencia interna: {plantilla["competencia_id"]}.',
        f'Capacidad principal interna: {plantilla["capacidad_principal_id"]}.',
        f'Objetivo de la capacidad para el grado (propuesto): {contexto["objetivo_propuesto"]}.',
        f'Evidencia sugerida (propuesta): {contexto["evidencia_sugerida"]}.',
        f'Propósito de esta plantilla: {plantilla["objetivo_de_la_plantilla"]}.',
        f'Contexto: {plantilla["contexto_de_generacion"]}.',
        'Varía de manera significativa escenario, conflicto y razonamiento; NO solo nombres propios.',
        'Evita copiar textos del libro de MINEDU o de otros autores.',
        'Proporciona dos pistas progresivas. No preguntes datos de menores.',
        instrucciones_formato[formato],
        'Incluye exclusivamente los campos solicitados. Responde SOLO JSON.'
    ])
    return system, user


def validar_actividad(actividad: dict, plantilla: dict, grado: int) -> list[str]:
    errores = []
    if not isinstance(actividad, dict):
        return ['La actividad debe ser un objeto JSON.']
    tipo = actividad.get('tipo')
    if tipo not in TIPOS_VALIDOS or tipo != plantilla['tipo']:
        errores.append('Tipo de actividad no corresponde a plantilla.')
    titulo = actividad.get('titulo')
    if not isinstance(titulo, str) or not 5 <= len(titulo.strip()) <= 140:
        errores.append('Título ausente o de longitud inválida.')
    pistas = actividad.get('pistas')
    if not isinstance(pistas, list) or len(pistas) != 2 or not all(isinstance(x, str) and len(x.strip()) >= 12 for x in pistas):
        errores.append('Se requieren exactamente dos pistas no vacías.')
    if tipo in {'seleccion', 'escucha'}:
        base_key = 'texto_base' if tipo == 'seleccion' else 'guion_audio'
        base = actividad.get(base_key, '')
        if not isinstance(base, str) or not 35 <= len(base.strip()) <= 2400:
            errores.append('Texto/guion original ausente o de longitud inválida.')
        pregunta = actividad.get('pregunta')
        if not isinstance(pregunta, str) or not 12 <= len(pregunta.strip()) <= 400:
            errores.append('Pregunta ausente o demasiado breve.')
        opciones = actividad.get('opciones')
        if not isinstance(opciones, list) or len(opciones) != 3 or not all(isinstance(o, str) and 3 <= len(o.strip()) <= 240 for o in opciones):
            errores.append('Se requieren tres alternativas de respuesta.')
        elif len({o.strip().casefold() for o in opciones}) != 3:
            errores.append('Las alternativas deben ser diferentes.')
        indice = actividad.get('respuesta_correcta_indice')
        if type(indice) is not int or not 0 <= indice <= 2:
            errores.append('Índice correcto inválido; debe ser 0, 1 o 2.')
        cita = actividad.get('cita_evidencia', '')
        if not isinstance(cita, str) or len(cita.strip()) < 9 or not isinstance(base, str) or cita.strip().casefold() not in base.casefold():
            errores.append('La evidencia debe ser una cita literal del texto/guion.')
        if tipo == 'escucha' and actividad.get('audio_disponible') is not False:
            errores.append('No se puede declarar audio disponible sin un archivo comprobado.')
    if tipo in {'escritura', 'oralidad'}:
        consigna = actividad.get('consigna')
        if not isinstance(consigna, str) or not 35 <= len(consigna.strip()) <= 900:
            errores.append('Consigna abierta no válida.')
        rubrica = actividad.get('criterios_rubrica')
        if not isinstance(rubrica, list) or len(rubrica) != 3 or not all(isinstance(x, str) and len(x.strip()) >= 15 for x in rubrica):
            errores.append('Se requieren tres criterios observables en la rúbrica.')
    return errores


def preparar_actividad(actividad: dict, plantilla: dict, grado: int, origen: str) -> dict:
    actividad = copy.deepcopy(actividad)
    errores = validar_actividad(actividad, plantilla, grado)
    if errores:
        raise ValueError('Rechazada por controles mecánicos: ' + '; '.join(errores))
    actividad['plantilla_id'] = plantilla['id']
    actividad['grado'] = grado
    actividad['competencia_id'] = plantilla['competencia_id']
    actividad['capacidad_principal_id'] = plantilla['capacidad_principal_id']
    actividad['mundo_id'] = plantilla['mundo_id']
    actividad['origen'] = origen
    actividad['estado_revision'] = 'pendiente_revision_docente'
    actividad['validacion_automatica'] = 'estructura_aprobada_no_equivale_a_validez_pedagogica'
    actividad['restriccion_evaluacion'] = 'No emitir calificación oficial automáticamente.'
    return actividad


def ejemplo_offline(plantilla: dict, grado: int) -> dict:
    demos = leer_json(DEMOS)['actividades']
    candidatos = [x for x in demos if x['plantilla_id'] == plantilla['id'] and x['grado'] == grado]
    if not candidatos:
        raise ValueError('Esta plantilla/grado aún no tiene ejemplo offline. Usa --listar o --modo openrouter con credenciales nuevas.')
    return preparar_actividad(candidatos[0], plantilla, grado, 'ejemplo_manual_offline')


def generar_con_openrouter(plantilla: dict, grado: int) -> dict:
    api_key = os.environ.get('OPENROUTER_API_KEY', '').strip()
    model = os.environ.get('OPENROUTER_MODEL', '').strip()
    if not api_key:
        raise ValueError('Falta OPENROUTER_API_KEY. Usa una clave NUEVA revocando la expuesta anteriormente.')
    if not model:
        raise ValueError('Falta OPENROUTER_MODEL (modelo compatible con salida JSON).')
    system, user = construir_prompt(plantilla, grado)
    body = {'model': model, 'messages': [{'role':'system','content':system}, {'role':'user','content':user}],
            'response_format': {'type':'json_object'}, 'temperature':0.65, 'max_tokens':1100, 'stream':False}
    req = Request(API_URL, data=json.dumps(body,ensure_ascii=False).encode('utf-8'),
                  headers={'Authorization':'Bearer '+api_key, 'Content-Type':'application/json'}, method='POST')
    try:
        with urlopen(req,timeout=45) as res:
            respuesta = json.loads(res.read().decode('utf-8'))
    except HTTPError as exc:
        raise RuntimeError(f'OpenRouter respondió con HTTP {exc.code}. Revisa credenciales, modelo, cuotas y soporte JSON.') from None
    except (URLError,TimeoutError) as exc:
        raise RuntimeError('No se pudo conectar a OpenRouter. Revisa la conexión a internet.') from None
    try:
        contenido = respuesta['choices'][0]['message']['content']
        actividad = json.loads(contenido)
    except (KeyError,IndexError,ValueError,TypeError) as exc:
        raise RuntimeError('El proveedor no devolvió un objeto JSON interpretable. No se aceptó la actividad.') from None
    # Nunca equivale a una evaluación semántica ni a revisión docente.
    return preparar_actividad(actividad, plantilla, grado, 'borrador_ia_openrouter')


def main():
    parser=argparse.ArgumentParser(description='Misti: ejemplos offline y borradores de actividades con IA')
    parser.add_argument('--listar',action='store_true',help='Mostrar IDs de las 13 plantillas')
    parser.add_argument('--plantilla',default='COM-L2-infiere_intenciones',help='ID de plantilla')
    parser.add_argument('--grado',type=int,choices=[4,5,6],default=4)
    parser.add_argument('--modo',choices=['demo','openrouter'],default='demo')
    parser.add_argument('--salida',type=Path,help='Guardar borrador JSON en una ruta local')
    args=parser.parse_args()
    if args.listar:
        for p in leer_json(CATALOGO)['plantillas']:
            print(f"{p['id']}: {p['tipo']} / {p['mundo_id']}")
        return 0
    try:
        plantilla=obtener_plantilla(args.plantilla)
        resultado=(ejemplo_offline(plantilla,args.grado) if args.modo=='demo'
                   else generar_con_openrouter(plantilla,args.grado))
        serializado=json.dumps(resultado,ensure_ascii=False,indent=2)+'\n'
        if args.salida:
            args.salida.parent.mkdir(parents=True,exist_ok=True)
            args.salida.write_text(serializado,encoding='utf-8')
            print(f'Borrador guardado en {args.salida}. Requiere revisión docente.')
        else:
            print(serializado)
        return 0
    except (ValueError,RuntimeError) as exc:
        print(f'ERROR: {exc}',file=sys.stderr)
        return 1

if __name__=='__main__':
    raise SystemExit(main())
