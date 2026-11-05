"""Catálogo local: actividades demostrativas o publicadas tras revisión humana.

No utiliza perfiles de alumnos. La generación con IA se realiza SOLO desde gestor_docente.py.
"""
from __future__ import annotations

import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

COMUNICACION = Path(__file__).resolve().parents[1]
BACKEND = Path(__file__).resolve().parent
DATA = BACKEND / 'data'
PENDIENTES = DATA / 'pendientes'
PUBLICADAS = DATA / 'publicadas'
MUESTRAS = DATA / 'muestras_l2.json'
sys.path.insert(0, str(COMUNICACION / 'generador'))
from generar_actividad import obtener_plantilla, validar_actividad  # noqa: E402


def leer_json(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))


def guardar_json(path: Path, value: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    # exclusiva creación de un borrador nuevo; para publicar se usa replace tras revisión
    with path.open('x', encoding='utf-8') as f:
        json.dump(value, f, ensure_ascii=False, indent=2)
        f.write('\n')


def formato_valido(a: dict) -> bool:
    """Verifica contrato estructural. NO reemplaza la evaluación semántica de un docente."""
    try:
        plantilla = obtener_plantilla(a['plantilla_id'])
        grado = int(a['grado'])
        if grado not in (4, 5, 6) or a.get('tipo') not in ('seleccion', 'escritura', 'oralidad'):
            return False
        return not validar_actividad(a, plantilla, grado)
    except (KeyError, TypeError, ValueError, OSError):
        return False


def lista_muestras():
    # Datos originales para demostración (NO aprobados oficialmente ni por un docente).
    return [a for a in leer_json(MUESTRAS)['actividades'] if formato_valido(a)]


def lista_publicadas():
    items = []
    for path in sorted(PUBLICADAS.glob('MISTI-*.json')):
        try:
            item = leer_json(path)
            if (item.get('estado_revision') == 'aprobada_revision_humana' and
                    item.get('revision_confirmada') is True and formato_valido(item)):
                items.append(item)
        except (OSError, ValueError, TypeError):
            continue
    return items


def catalogo(grado: int | None = None, capacidad: str | None = None):
    # Banco de muestras separado explícitamente del material revisado.
    muestra = os.environ.get('MISTI_MODO_DEMO', '1') == '1'
    items = lista_publicadas() + (lista_muestras() if muestra else [])
    if grado is not None:
        items = [a for a in items if a['grado'] == grado]
    if capacidad:
        items = [a for a in items if a.get('capacidad_principal_id') == capacidad]
    return items


def crear_borrador(actividad: dict, fuente: str):
    if not formato_valido(actividad):
        raise ValueError('La estructura generada no supera la validación. No se guardó.')
    v = dict(actividad)
    v['id'] = 'MISTI-' + uuid.uuid4().hex[:14].upper()
    v['origen'] = fuente
    v['estado_revision'] = 'pendiente_revision_docente'
    v['creado_utc'] = datetime.now(timezone.utc).isoformat()
    v.pop('revision_confirmada', None)
    guardar_json(PENDIENTES / f"{v['id']}.json", v)
    return v


def nombre_seguro(id_: str):
    if not isinstance(id_, str) or not id_.startswith('MISTI-') or len(id_) != 20:
        raise ValueError('Identificador no válido.')
    if not all(c in '0123456789ABCDEF' for c in id_[6:]):
        raise ValueError('Identificador no válido.')
    return f'{id_}.json'


def aprobar_borrador(id_: str, confirmo: bool):
    if not confirmo:
        raise ValueError('Falta una revisión humana explícita de contenido, opciones y evidencia.')
    p = PENDIENTES / nombre_seguro(id_)
    if not p.is_file():
        raise FileNotFoundError('No existe ese borrador pendiente.')
    a = leer_json(p)
    if not formato_valido(a):
        raise ValueError('El borrador ya no cumple la estructura. Corrígelo antes de aprobar.')
    if a.get('tipo') == 'oralidad':
        # Permitir exposición de la consigna; NO generar evaluación de la voz.
        pass
    a['estado_revision'] = 'aprobada_revision_humana'
    a['revision_confirmada'] = True
    a['publicada_utc'] = datetime.now(timezone.utc).isoformat()
    dst = PUBLICADAS / nombre_seguro(id_)
    guardar_json(dst, a)
    p.unlink()
    return dst


def visible_para_estudiante(a: dict):
    # No revelar claves de corrección, datos editoriales o campos que permitan alterar resultados.
    campos = ('id', 'grado', 'plantilla_id', 'competencia_id', 'capacidad_principal_id',
              'mundo_id', 'tipo', 'titulo', 'texto_base', 'pregunta', 'opciones',
              'consigna', 'criterios_rubrica')
    v = {key: a[key] for key in campos if key in a}
    v['etiqueta'] = ('Ejemplo para prueba, pendiente de validación docente'
                     if a.get('estado_revision') != 'aprobada_revision_humana'
                     else 'Actividad revisada antes de su publicación')
    return v
