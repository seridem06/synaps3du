"""Servidor local Misti con API de actividades verificables.

Arrancar en PowerShell desde raíz:
  python modules/comunicacion/backend/servidor.py --port 8765

No expone credenciales ni ofrece un endpoint público para llamar a OpenRouter.
"""
from __future__ import annotations

import argparse
import json
import random
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

from catalogo import BACKEND, catalogo, visible_para_estudiante

ROOT = Path(__file__).resolve().parents[3]
MAX_BODY = 4096


class MistiHandler(SimpleHTTPRequestHandler):
    server_version = 'MistiLocal/0.5'

    def log_message(self, fmt, *args):
        # No registrar cuerpos HTTP, claves ni respuestas de estudiantes.
        super().log_message(fmt, *args)

    def _json(self, status: int, payload: dict):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _params(self):
        return {k: v[0] for k, v in parse_qs(urlsplit(self.path).query).items() if v}

    def _actividad(self, id_: str):
        return next((x for x in catalogo() if x.get('id') == id_), None)

    def do_GET(self):
        parsed = urlsplit(self.path)
        p = unquote(parsed.path)
        if p == '/api/misti/estado':
            items = catalogo()
            self._json(200, {'operativo': True, 'motor': 'local',
                            'generacion_ia_para_docentes': 'CLI separada',
                            'variantes_disponibles': len(items),
                            'aviso': 'Las muestras no representan contenidos validados por MINEDU.'})
            return
        if p == '/api/misti/catalogo':
            params = self._params()
            try:
                grado = int(params.get('grado', ''))
            except ValueError:
                grado = 0
            if grado not in (4, 5, 6):
                return self._json(400, {'error': 'Grado no admitido.'})
            counts = {}
            for a in catalogo(grado):
                c = a.get('capacidad_principal_id')
                counts[c] = counts.get(c, 0) + 1
            return self._json(200, {'capacidades': [{'id': k, 'cantidad': v} for k, v in sorted(counts.items())]})
        if p == '/api/misti/actividad':
            params = self._params()
            try:
                grado = int(params.get('grado', ''))
            except ValueError:
                grado = 0
            capacidad = params.get('capacidad', 'L2')
            if grado not in (4, 5, 6) or capacidad not in {'L1','L2','L3','O1','O2','O3','O4','O5','O6','E1','E2','E3','E4'}:
                return self._json(400, {'error': 'Grado o capacidad no admitidos.'})
            items = catalogo(grado, capacidad)
            prev = params.get('exclude', '')
            if prev and len(items) > 1:
                filtrados = [a for a in items if a['id'] != prev]
                if filtrados:
                    items = filtrados
            if not items:
                return self._json(404, {'error': 'No hay actividades aprobadas o ejemplos para esa capacidad y grado.'})
            return self._json(200, {'actividad': visible_para_estudiante(random.choice(items))})
        if p == '/api/misti/pista':
            params = self._params()
            a = self._actividad(params.get('id', ''))
            try:
                nivel = int(params.get('nivel', ''))
            except ValueError:
                nivel = -1
            if not a or nivel not in (1, 2):
                return self._json(400, {'error': 'Actividad o nivel de pista no válido.'})
            return self._json(200, {'pista': a['pistas'][nivel - 1], 'nivel': nivel})
        if p.startswith('/api/'):
            return self._json(404, {'error': 'Ruta no encontrada.'})
        # Bloquear código y contenidos editoriales del backend en HTTP local.
        lower = p.lower()
        protected = ('/modules/comunicacion/backend/', '/modules/comunicacion/generador/',
                     '/.git/', '/.env', '/modules/comunicacion/data/plantillas_actividades.json')
        if any(lower.startswith(x) for x in protected) or '/..' in lower or '\\' in lower:
            self.send_error(404, 'No disponible')
            return
        return super().do_GET()

    def do_POST(self):
        parsed = urlsplit(self.path)
        if parsed.path != '/api/misti/responder':
            return self._json(404, {'error': 'Ruta no encontrada.'})
        if self.headers.get('Content-Type', '').split(';')[0].strip().lower() != 'application/json':
            return self._json(415, {'error': 'Se requiere application/json.'})
        # Solo mismo origen para el servidor local; no habilitar en una IP pública.
        origin = self.headers.get('Origin', '')
        host = self.headers.get('Host', '')
        if origin and origin not in ('http://' + host, 'https://' + host):
            return self._json(403, {'error': 'Origen no autorizado.'})
        try:
            length = int(self.headers.get('Content-Length', '-1'))
            if length < 2 or length > MAX_BODY:
                return self._json(413, {'error': 'Solicitud demasiado grande.'})
            body = json.loads(self.rfile.read(length).decode('utf-8'))
        except (ValueError, UnicodeError):
            return self._json(400, {'error': 'JSON inválido.'})
        if not isinstance(body, dict):
            return self._json(400, {'error': 'Solicitud inválida.'})
        a = self._actividad(body.get('id', ''))
        choice = body.get('opcion')
        if not a or a.get('tipo') != 'seleccion' or type(choice) is not int or choice not in (0,1,2):
            return self._json(400, {'error': 'Actividad u opción inválida.'})
        ok = choice == a['respuesta_correcta_indice']
        if ok:
            return self._json(200, {'correcta': True,
                                    'mensaje': '¡Muy bien! Tu respuesta está sustentada en el texto.',
                                    'cita_evidencia': a['cita_evidencia'],
                                    'capacidad_id': a['capacidad_principal_id']})
        return self._json(200, {'correcta': False,
                                'mensaje': 'Todavía no. Busca qué parte del texto respalda tu elección. Puedes pedir una pista.'})


def main():
    parser = argparse.ArgumentParser(description='Servidor local de Misti Comunicación')
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        parser.error('Selecciona un puerto entre 1024 y 65535.')
    handler = partial(MistiHandler, directory=str(ROOT))
    with ThreadingHTTPServer(('127.0.0.1', args.port), handler) as srv:
        print('Misti Comunicación listo en http://127.0.0.1:%d/modules/comunicacion/ui/' % args.port)
        print('Servidor de prueba LOCAL: no exponerlo a internet ni usar datos reales de menores.')
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            print('\nServidor detenido.')


if __name__ == '__main__':
    main()
