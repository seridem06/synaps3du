"""Ejecutar: python -m unittest discover -s modules/comunicacion/generador/tests -v"""
import importlib.util
import json
from pathlib import Path
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'generar_actividad.py'
spec = importlib.util.spec_from_file_location('misti_generador', SCRIPT)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class TestMistiGenerador(unittest.TestCase):
    def test_todas_las_capacidades_tienen_plantilla(self):
        catalogo = mod.leer_json(mod.CATALOGO)
        codigos = {t['capacidad_principal_id'] for t in catalogo['plantillas']}
        self.assertEqual(codigos, {'L1','L2','L3','E1','E2','E3','E4','O1','O2','O3','O4','O5','O6'})
        self.assertTrue(all(set(t['por_grado']) == {'4','5','6'} for t in catalogo['plantillas']))

    def test_ejemplos_offline_validos(self):
        for actividad in mod.leer_json(mod.DEMOS)['actividades']:
            plantilla = mod.obtener_plantilla(actividad['plantilla_id'])
            result = mod.preparar_actividad(actividad, plantilla, actividad['grado'], 'test')
            self.assertEqual(result['estado_revision'], 'pendiente_revision_docente')

    def test_alternativas_duplicadas_se_rechazan(self):
        plantilla = mod.obtener_plantilla('COM-L2-infiere_intenciones')
        actividad = mod.leer_json(mod.DEMOS)['actividades'][0].copy()
        actividad['opciones']=['igual','IGUAL','otra']
        self.assertTrue(mod.validar_actividad(actividad, plantilla, 4))

    def test_evidencia_inventada_se_rechaza(self):
        plantilla = mod.obtener_plantilla('COM-L2-infiere_intenciones')
        actividad = mod.leer_json(mod.DEMOS)['actividades'][0].copy()
        actividad['cita_evidencia']='frase que no aparece en el texto'
        self.assertIn('La evidencia debe ser una cita literal del texto/guion.', mod.validar_actividad(actividad,plantilla,4))

    def test_escucha_no_finge_audio(self):
        plantilla = mod.obtener_plantilla('COM-O1-escucha_datos')
        actividad = mod.leer_json(mod.DEMOS)['actividades'][-1].copy()
        actividad['audio_disponible']=True
        self.assertIn('No se puede declarar audio disponible sin un archivo comprobado.', mod.validar_actividad(actividad,plantilla,4))

    def test_escritura_abierta_necesita_rubrica(self):
        plantilla = mod.obtener_plantilla('COM-E2-organiza_relato')
        actividad = mod.leer_json(mod.DEMOS)['actividades'][-2].copy()
        actividad.pop('criterios_rubrica')
        self.assertIn('Se requieren tres criterios observables en la rúbrica.', mod.validar_actividad(actividad,plantilla,4))

if __name__=='__main__':
    unittest.main()
