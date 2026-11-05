# Misti Comunicación — Commit 5: servicio local y generación editorial

> **Prototipo de Hack4Edu.** No es un producto escolar listo para desplegar con datos reales de menores ni un instrumento de evaluación oficial.

## Qué integra

- Conecta la sección **«Una nueva historia para practicar»** de `ui/` con un servidor local en Python 3.11+.
- Incluye **9 versiones originales de demostración** de la capacidad **L2** (3 por grado de 4.º a 6.º). Su contenido **no ha sido validado por un docente**: la pantalla lo etiqueta claramente.
- El estudiante solicita otra versión, pide pistas y envía una respuesta que **el servidor verifica**, sin proporcionar el índice correcto antes del intento. Los XP y las rachas se conservan en el mismo almacenamiento local del Commit 4.
- El profesorado puede generar **borradores** desde el generador del Commit 3 (en modo demo u OpenRouter), revisarlos y publicarlos manualmente. Un borrador nunca se publica automáticamente.
- Las actividades escritas y los guiones pueden guardarse como borradores locales. **No hay evaluación automática de escritura, pronunciación o audio.**

## 1. Arrancar en Windows (no se instala nada adicional)

Desde PowerShell en la **raíz del proyecto** (carpeta que contiene `index.html` y `modules`):

```powershell
python modules/comunicacion/backend/servidor.py --port 8765
```

Navegador: **http://127.0.0.1:8765/modules/comunicacion/ui/**

Este servidor **reemplaza** al comando `python -m http.server`. No ejecutes ambos sobre el mismo puerto. Si el 8765 está ocupado, prueba `--port 9001` y abre el navegador en ese mismo puerto.

**Modo sin OpenRouter:** toda la demo de los cinco mundos continúa funcionando y la sección dinámica usa únicamente las muestras locales. Si se usa `python -m http.server`, los cinco mundos siguen funcionando pero la sección dinámica indicará que falta el backend. Para mostrar las muestras debe ejecutarse el servidor de este commit.

## 2. Probar el nuevo recorrido

1. Elige 4.º, 5.º o 6.º.
2. Baja hasta **«Una nueva historia para practicar»**.
3. Lee el relato y elige respuesta; usa una pista si hace falta.
4. Pulsa **Otra versión**: aparecerá otra historia en la misma capacidad L2 (si hay al menos dos).
5. Prueba una respuesta incorrecta y una correcta. Solo el acierto se registra como **práctica puntual**; no se declara dominio de la capacidad.
6. En **Mi avance** podrás ver la capacidad asociada, XP y rachas; sin calificación oficial.

## 3. Generar borradores con OpenRouter (solo adulto responsable)

La clave antigua que se compartió anteriormente debe **revocarse**. Usa otra clave con límite de gasto. No envíes datos personales ni respuestas reales de estudiantes a OpenRouter.

1. Copia `modules/comunicacion/backend/.env.example` a `modules/comunicacion/backend/.env` en tu PC.
2. Edita **solo tu `.env` local**, con `OPENROUTER_API_KEY` renovada y `OPENROUTER_MODEL` exacto de un modelo que admita salida JSON. El `.env` está excluido por `.gitignore`.
3. Desde la raíz del repositorio ejecuta:

```powershell
python modules/comunicacion/backend/gestor_docente.py generar --plantilla COM-L2-infiere_intenciones --grado 4 --modo openrouter
```

**No es necesario disponer de API para probar el proceso editorial:**

```powershell
python modules/comunicacion/backend/gestor_docente.py generar --plantilla COM-L2-infiere_intenciones --grado 4 --modo demo
```

El generador guarda una actividad con id `MISTI-...` en `backend/data/pendientes/`; **NO estará disponible para alumnos**.

## 4. Revisión y publicación humana

Lista pendientes:

```powershell
python modules/comunicacion/backend/gestor_docente.py listar
```

Abre el archivo JSON del borrador en VS Code y verifica, entre otras cosas: exactitud, pertinencia para el grado, unicidad de respuesta, evidencia literal, inexistencia de contenidos sensibles, calidad de las pistas y alineación curricular. Corrige o descarta si no es apropiado.

**Solo si un docente realmente revisó ese contenido**, ejecuta, sustituyendo el identificador real:

```powershell
python modules/comunicacion/backend/gestor_docente.py aprobar --id MISTI-IDENTIFICADOR --confirmo-revision-docente
```

El flag es una **declaración de revisión humana**, no un mecanismo que compruebe la calidad pedagógica. El archivo revisado pasará a `backend/data/publicadas/` y aparecerá en la sección de práctica al recargar.

Las actividades de **escucha** generadas únicamente con un guion no se publican desde este flujo, porque aún no tienen un archivo de audio cotejado. Se mantienen los audios del Mundo 2 del Commit 4.

## 5. API local

| Método | Ruta | Función |
|---|---|---|
| GET | `/api/misti/estado` | Comprueba que el servicio local funciona |
| GET | `/api/misti/catalogo?grado=4` | Indica capacidades con contenido disponible |
| GET | `/api/misti/actividad?grado=4&capacidad=L2` | Entrega una actividad **sin** solución ni pistas |
| GET | `/api/misti/pista?id=...&nivel=1` | Devuelve una pista progresiva |
| POST | `/api/misti/responder` | Comprueba `{ "id":"...", "opcion":0 }` y devuelve feedback |

El backend **no expone** una API HTTP para generación o publicación de borradores. La generación se realiza solo desde una terminal local por el flujo docente.

## 6. Pruebas

```powershell
python -m unittest discover -s modules/comunicacion/backend/tests -v
```

Para las pruebas existentes del frontend, si tienes Node instalado:

```powershell
node --test modules/comunicacion/ui/tests/core.test.mjs
```

## 7. Limitaciones y seguridad

- Solo **localhost** (`127.0.0.1`) y archivos originales de demostración. No exponer este servidor directamente a internet.
- Sin usuarios, sesión docente, protección contra manipulación de XP o almacenamiento de progreso institucional. `localStorage` no sirve como registro formal.
- Sin generación en vivo al pulsar «Otra versión»: muestra **variantes ya creadas/publicadas**, no llama a un modelo en ese momento.
- Una validación JSON correcta **no prueba** que la respuesta sea pedagógicamente válida. Revisión humana indispensable.
- Para un lanzamiento con menores se requerirán autenticación, controles parentales/institucionales, autorización o base legal aplicable, protección de datos y evaluación de seguridad y accesibilidad.
- El modelo de OpenRouter es opcional y requiere internet. Los contenidos locales previamente disponibles siguen funcionando sin esa conexión.
