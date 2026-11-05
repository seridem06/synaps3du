import unittest
from unittest.mock import patch, MagicMock
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from tutor import modelo

class Unificado(unittest.TestCase):
    def test_contrato_grados(self):
        for grado in (4,5,6):
            with patch.dict('os.environ',{'OMNIROUTE_API_KEY':''}):
                self.assertEqual(modelo({'messages':[{'role':'user','content':'Ayúdame'}],'grado':grado})['modo'],'respaldo')
    def test_contrato_real_simulado(self):
        response=MagicMock();response.__enter__.return_value.read.return_value=b'{"choices":[{"message":{"content":"Busca evidencia en el texto."}}]}'
        with patch.dict('os.environ',{'OMNIROUTE_API_KEY':'test'}),patch('urllib.request.urlopen',return_value=response) as call:
            d=modelo({'messages':[{'role':'user','content':'Ayuda'}]}, {'texto_base':'Nora puso un aviso','pregunta':'Por qué'})
            self.assertEqual(d['modo'],'ia');self.assertIn(b'Nora',call.call_args[0][0].data)
    def test_formato_invalido(self):
        with self.assertRaises(ValueError):modelo({'messages':[{'role':'user','content':[]} ]})

class HTTPAudit(unittest.TestCase):
    def test_correccion_todos_grados(self):
        from catalogo import catalogo
        from test_servicio import TestHTTP
        from urllib.request import Request,urlopen
        import json
        TestHTTP.setUpClass()
        try:
            for grado in (4,5,6):
                for a in catalogo(grado,'L2'):
                    for opcion in (0,1,2):
                        req=Request(f'http://127.0.0.1:{TestHTTP.port}/api/misti/responder',data=json.dumps({'id':a['id'],'opcion':opcion}).encode(),headers={'Content-Type':'application/json'})
                        with urlopen(req) as res:d=json.load(res)
                        self.assertEqual(d['correcta'],opcion==a['respuesta_correcta_indice'])
                    for nivel in (1,2):
                        with urlopen(f"http://127.0.0.1:{TestHTTP.port}/api/misti/pista?id={a['id']}&nivel={nivel}") as res:d=json.load(res)
                        self.assertEqual(d['pista'],a['pistas'][nivel-1])
        finally:TestHTTP.tearDownClass()
    def test_normalizacion_no_expone_backend(self):
        from test_servicio import TestHTTP
        from urllib.request import urlopen
        from urllib.error import HTTPError
        TestHTTP.setUpClass()
        try:
            with self.assertRaises(HTTPError) as cm:urlopen(f'http://127.0.0.1:{TestHTTP.port}/foo/../modules/comunicacion/backend/tutor.py')
            self.assertEqual(cm.exception.code,404)
        finally:TestHTTP.tearDownClass()
