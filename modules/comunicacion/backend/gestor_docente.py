"""Flujo editorial local: generar borrador -> revisar archivo -> aprobar para publicar.

NUNCA se envían respuestas de estudiantes al modelo. Solo contexto curricular y plantillas.
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path
import sys

from catalogo import BACKEND, PENDIENTES, PUBLICADAS, aprobar_borrador, crear_borrador, leer_json

COMUNICACION = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(COMUNICACION / 'generador'))
from generar_actividad import ejemplo_offline, generar_con_openrouter, obtener_plantilla


def leer_env_privado():
    """Permite configurar la clave de forma local; nunca subir backend/.env a GitHub."""
    path = BACKEND / '.env'
    if not path.exists():
        return
    for line in path.read_text(encoding='utf-8-sig').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        if k.strip() in ('OPENROUTER_API_KEY','OPENROUTER_MODEL'):
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def main():
    parser = argparse.ArgumentParser(description='Gestión docente de actividades de Misti')
    subs = parser.add_subparsers(dest='accion', required=True)
    gen = subs.add_parser('generar', help='Crea borrador; NO publica nada')
    gen.add_argument('--plantilla', required=True)
    gen.add_argument('--grado', type=int, choices=(4,5,6), required=True)
    gen.add_argument('--modo', choices=('demo','openrouter'), default='demo')
    subs.add_parser('listar', help='Muestra borradores pendientes')
    apr = subs.add_parser('aprobar', help='Publica solo tras revisión humana real')
    apr.add_argument('--id', required=True)
    apr.add_argument('--confirmo-revision-docente', action='store_true')
    args = parser.parse_args()
    try:
        if args.accion == 'generar':
            plantilla = obtener_plantilla(args.plantilla)
            if args.modo == 'demo':
                actividad = ejemplo_offline(plantilla,args.grado)
                fuente = 'ejemplo_original_para_prueba'
            else:
                leer_env_privado()
                actividad = generar_con_openrouter(plantilla,args.grado)
                fuente = 'borrador_creado_con_openrouter'
            v = crear_borrador(actividad,fuente)
            print('Borrador pendiente:', v['id'])
            print('Revisar:', PENDIENTES / (v['id'] + '.json'))
            print('NO está publicado. Revisa pregunta, respuesta, evidencia y adecuación al grado.')
        elif args.accion == 'listar':
            archivos = sorted(PENDIENTES.glob('MISTI-*.json'))
            if not archivos:
                print('No hay borradores pendientes.')
            for p in archivos:
                a = leer_json(p)
                print(a.get('id'), '|', a.get('grado'), '|', a.get('tipo'), '|', a.get('titulo'))
        elif args.accion == 'aprobar':
            destino = aprobar_borrador(args.id, args.confirmo_revision_docente)
            print('Publicado para el catálogo local:', destino)
            print('La confirmación es una DECLARACIÓN de revisión humana; no es una auditoría automática.')
    except (ValueError, FileNotFoundError, RuntimeError, OSError) as exc:
        parser.exit(2, str(exc) + '\n')


if __name__ == '__main__':
    main()
