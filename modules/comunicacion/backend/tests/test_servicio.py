"""Pruebas offline de integración HTTP y del flujo editorial (sin llamar a OpenRouter)."""
from __future__ import annotations
import json
import os
import sys
import tempfile
import threading
import unittest
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(BACKEND))
import catalogo
from servidor import MistiHandler, ROOT
sys.path.insert(0,str(BACKEND.parent / 'generador'))
from generar_actividad import ejemplo_offline, obtener_plantilla


class TestHTTP(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(MistiHandler, directory=str(ROOT)))
        cls.port = cls.server.server_address[1]
        cls.worker = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.worker.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.worker.join(timeout=3);cls.server.server_close()

    def get(self, path):
        with urlopen(f'http://127.0.0.1:{self.port}{path}',timeout=4) as res:
            return res.status, json.loads(res.read().decode('utf8'))

    def test_01_estado_local(self):
        status, body=self.get('/api/misti/estado')
        self.assertEqual(status,200);self.assertTrue(body['operativo'])
        self.assertGreaterEqual(body['variantes_disponibles'],9)

    def test_02_variedad_por_grado(self):
        for grado in (4,5,6):
            s,body=self.get(f'/api/misti/catalogo?grado={grado}')
            self.assertEqual(s,200)
            self.assertGreaterEqual(sum(x['cantidad'] for x in body['capacidades']),3)
            self.assertTrue(any(x['id']=='L2' for x in body['capacidades']))

    def test_03_no_entregar_clave_correccion(self):
        _,data=self.get('/api/misti/actividad?grado=4&capacidad=L2')
        a=data['actividad']
        self.assertEqual(a['grado'],4);self.assertEqual(a['capacidad_principal_id'],'L2')
        self.assertNotIn('respuesta_correcta_indice', a)
        self.assertNotIn('cita_evidencia', a)
        self.assertNotIn('pistas', a)
        self.assertIn('pendiente de validación docente',a['etiqueta'])

    def test_04_pista_y_correccion_una_unica_respuesta(self):
        _,data=self.get('/api/misti/actividad?grado=6&capacidad=L2')
        a=data['actividad']
        _,hint=self.get('/api/misti/pista?id='+a['id']+'&nivel=1')
        self.assertGreaterEqual(len(hint['pista']),12)
        original=next(x for x in catalogo.catalogo() if x['id']==a['id'])
        answer=original['respuesta_correcta_indice']
        for opcion in (answer,(answer+1)%3):
            r=Request(f'http://127.0.0.1:{self.port}/api/misti/responder',
                      data=json.dumps({'id':a['id'],'opcion':opcion}).encode(),
                      headers={'Content-Type':'application/json'},method='POST')
            with urlopen(r,timeout=4) as res:
                body=json.loads(res.read())
            self.assertEqual(body['correcta'],opcion==answer)
            if opcion!=answer:self.assertNotIn('cita_evidencia',body)
            else:self.assertTrue(body['cita_evidencia'])

    def test_05_bloquea_archivos_editoriales(self):
        with self.assertRaises(HTTPError) as cm:
            urlopen(f'http://127.0.0.1:{self.port}/modules/comunicacion/backend/data/muestras_l2.json',timeout=4)
        self.assertEqual(cm.exception.code,404)

    def test_06_interfaz_servible(self):
        with urlopen(f'http://127.0.0.1:{self.port}/modules/comunicacion/ui/',timeout=4) as r:
            html=r.read().decode('utf8')
        self.assertIn('id="iaPanel"',html)
        self.assertIn('ia.js',html)

    def test_07_rechaza_grado_invalido_y_json_text_plain(self):
        with self.assertRaises(HTTPError) as cm:
            self.get('/api/misti/actividad?grado=9')
        self.assertEqual(cm.exception.code,400)
        req=Request(f'http://127.0.0.1:{self.port}/api/misti/responder',
                     data=b'{}',headers={'Content-Type':'text/plain'},method='POST')
        with self.assertRaises(HTTPError) as cm:
            urlopen(req,timeout=4)
        self.assertEqual(cm.exception.code,415)

    def test_08_modo_sin_muestras_no_publica_borradores(self):
        with patch.dict(os.environ, {'MISTI_MODO_DEMO':'0'}):
            self.assertEqual(catalogo.catalogo(),[])


class TestRevision(unittest.TestCase):
    def test_09_no_publica_sin_revision(self):
        p=obtener_plantilla('COM-L2-infiere_intenciones')
        actividad=ejemplo_offline(p,4)
        with tempfile.TemporaryDirectory() as temp:
            folder=Path(temp)
            (folder/'pendientes').mkdir();(folder/'publicadas').mkdir()
            with patch.object(catalogo,'PENDIENTES',folder/'pendientes'),patch.object(catalogo,'PUBLICADAS',folder/'publicadas'):
                nuevo=catalogo.crear_borrador(actividad,'ejemplo_de_prueba')
                with self.assertRaises(ValueError):
                    catalogo.aprobar_borrador(nuevo['id'],False)
                self.assertEqual(len(list((folder/'publicadas').glob('*.json'))),0)
                output=catalogo.aprobar_borrador(nuevo['id'],True)
                self.assertTrue(output.exists())
                self.assertEqual(catalogo.leer_json(output)['estado_revision'],'aprobada_revision_humana')

if __name__=='__main__':
    unittest.main(verbosity=2)
