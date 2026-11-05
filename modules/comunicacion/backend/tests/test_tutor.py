import sys
import os
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tutor import conversar

class TutorTests(unittest.TestCase):
    def test_sin_clave(self):
        with patch.dict(os.environ, {'OMNIROUTE_API_KEY': ''}):
            self.assertEqual(conversar({'mensaje':'Hola','grado':4})['modo'], 'respaldo')
    def test_invalido(self):
        with self.assertRaises(ValueError): conversar({'mensaje':'Hola','grado':9})
    def test_proveedor(self):
        response=MagicMock()
        response.__enter__.return_value.read.return_value=b'{"choices":[{"message":{"content":"Busca una pista en el texto."}}]}'
        with patch.dict(os.environ, {'OMNIROUTE_API_KEY':'test-only'}), patch('urllib.request.urlopen',return_value=response):
            self.assertEqual(conversar({'mensaje':'Ayuda','grado':5})['modo'],'ia')
    def test_caida(self):
        with patch.dict(os.environ, {'OMNIROUTE_API_KEY':'test-only'}), patch('urllib.request.urlopen',side_effect=TimeoutError):
            self.assertEqual(conversar({'mensaje':'Ayuda','grado':6})['modo'],'respaldo')
