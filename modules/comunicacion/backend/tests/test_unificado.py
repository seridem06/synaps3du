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
