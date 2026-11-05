# Misti Comunicación — Commit 3: plantillas y generador de borradores

**Estado:** prototipo independiente; aún NO conectado a la interfaz, no apto para evaluación escolar oficial.

Este commit agrega **13 plantillas**, una por capacidad de Comunicación (O1–O6, L1–L3, E1–E4), con propuestas diferenciadas para 4.º, 5.º y 6.º de primaria, más **6 actividades originales de demostración**. Todas requieren revisión docente para publicación con estudiantes.

## Rutas del repositorio

- `modules/comunicacion/data/plantillas_actividades.json`: catálogo de 13 plantillas por capacidad.
- `modules/comunicacion/generador/ejemplos_demo.json`: ejemplos redactados manualmente (NO generados por IA).
- `modules/comunicacion/generador/generar_actividad.py`: consulta plantillas, valida estructura, muestra demos y opcionalmente genera borradores con OpenRouter.
- `modules/comunicacion/generador/tests/test_generador.py`: pruebas automáticas sin internet.

Se usa la matriz ya subida en el Commit 2 como referencia de IDs; **no reemplazar** `matriz_curricular.json`. No se modifican `index.html`, `script.js`, `styles.css` ni archivos de otros compañeros.

## Cómo probar con Python 3.10+ (sin instalar librerías)

Desde la raíz del repositorio:

```powershell
python modules/comunicacion/generador/generar_actividad.py --listar
python modules/comunicacion/generador/generar_actividad.py --plantilla COM-L2-infiere_intenciones --grado 4 --modo demo
python modules/comunicacion/generador/generar_actividad.py --plantilla COM-L2-infiere_intenciones --grado 5 --modo demo
python -m unittest discover -s modules/comunicacion/generador/tests -v
```

Otros ejemplos offline: `COM-L1-localiza_informacion` con grado 4, `COM-E2-organiza_relato` con grado 4 y `COM-O1-escucha_datos` con grado 4. Las otras combinaciones son plantillas preparadas, **no actividades listas**.

## Modo IA: OpenRouter (solo para generar BORRADORES)

**La clave compartida anteriormente quedó expuesta. El propietario debe revocarla y crear una nueva antes de usarla.** Nunca pegues claves en ChatGPT, GitHub, código fuente o frontend. Configura variables de entorno en PowerShell (solo sesión actual):

```powershell
$env:OPENROUTER_API_KEY = [System.Net.NetworkCredential]::new("", (Read-Host "Introduce la clave nueva" -AsSecureString)).Password
$env:OPENROUTER_MODEL="ID_DE_MODELO_COMPATIBLE_CON_JSON"
python modules/comunicacion/generador/generar_actividad.py --plantilla COM-L2-infiere_intenciones --grado 4 --modo openrouter --salida "$env:TEMP\misti_borrador.json"
```

No ejecutes esto con información personal real de un niño. El modelo se selecciona según disponibilidad y compatibilidad JSON en [OpenRouter](https://openrouter.ai/docs/guides/features/structured-outputs). Puede consumir créditos, requiere internet y **no tiene salida garantizada**.

> Importante: que el JSON pase la validación automática NO demuestra que la respuesta o las inferencias sean correctas. El borrador queda `pendiente_revision_docente`. Para publicar una pregunta generada hay que revisar el contenido, las respuestas y la evidencia textual; para escritura y oralidad se requiere rúbrica y, si corresponde, revisión humana. Un guion de escucha NO es un archivo de audio.

## Integración posterior

El equipo podrá conectar el generador a su backend. La interfaz **nunca** debe llamar OpenRouter directamente con una clave API: las llamadas remotas tienen que hacerse desde un servidor protegido. Si se necesita funcionar offline, debe agregarse un proveedor local validado y recursos de audio descargados; este commit todavía NO lo implementa.

## Fuentes y autoría

- [Programa Curricular de Educación Primaria — MINEDU](https://repositorio.minedu.gob.pe/handle/20.500.12799/4549)
- [Comunicación 4 — Dotación 2026 — MINEDU](https://repositorio.minedu.gob.pe/handle/20.500.12799/11804)

Todas las situaciones y ejemplos de este paquete son **originales para el prototipo**. No representan transcripciones del libro ni desempeños literales del currículo.
