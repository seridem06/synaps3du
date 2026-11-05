# Commit 4 — Misti Comunicación: experiencia jugable

Módulo **independiente** para la rama `feature/misti-comunicacion` de `synaps3du`. No reemplaza la interfaz ni los scripts del equipo. Usa **HTML/CSS/JavaScript vanilla** sin dependencias y la `matriz_curricular.json` del Commit 2.

## Cómo probar desde la raíz del repositorio

En una terminal normal (PowerShell / VS Code, **no** en el cuadro de chat de OpenCode):

```powershell
git branch --show-current
python -m http.server 8000
```

Abre: **http://localhost:8000/modules/comunicacion/ui/**

> No abras `index.html` con doble clic (`file://`): el navegador puede bloquear la lectura de archivos JSON. Debe abrirse desde un servidor HTTP local. La demo no necesita internet una vez que los archivos estén en la computadora.

## Qué ofrece

- 5 mundos para cada uno de los grados 4.º, 5.º y 6.º (15 misiones en total, **una misión por mundo como demostración**).
- Lectura con respuesta verificable; escucha mediante 3 audios `.wav` locales; escritura y guiones orales que se guardan como **borradores**, y un proyecto integrador por grado.
- Dos pistas por misión; desbloqueo secuencial; XP de práctica; racha por **días distintos**; progreso por grado; informe con las 13 capacidades.
- Datos locales guardados en `localStorage` del navegador: no hay autenticación, sincronización de cuentas ni datos enviados a la nube.
- Mensajes que distinguen **acierto puntual** de **dominio curricular**. Los textos escritos, guiones y proyectos no reciben calificación automática; requieren revisión docente.
- Audios originales generados mediante síntesis de voz para probar el recorrido. La reproducción de esos audios no requiere reconocimiento de voz del alumno.

## Lo que NO hace

- No conecta OpenRouter ni crea preguntas nuevas en tiempo real: el generador del Commit 3 es un módulo aparte cuyos borradores necesitan validación editorial antes de publicarse.
- No evalúa pronunciación, fluidez, interacción oral ni capacidad argumentativa a partir de una nota escrita.
- No sustituye el Currículo Nacional ni sus instrumentos formales de evaluación.
- No almacena información personal de menores: usar solo situaciones y nombres ficticios. Los borradores se guardan en este equipo/navegador; si se comparte la computadora, hay que borrar el progreso.
- No se integra automáticamente a `index.html` / `script.js` / `styles.css` del equipo. Se requiere coordinación para navegación, API y estilos comunes.

## Pruebas automáticas

Requiere Node.js moderno (instalación de Node **solo para pruebas**, no para usar la interfaz):

```powershell
node --test modules/comunicacion/ui/tests/core.test.mjs
```

## Próximo paso de integración

Validar las actividades y rúbricas con un docente; ampliar los contenidos por capacidad y desempeño de grado; definir una API segura para conectar los **borradores revisados** del Commit 3 y los eventos de progreso al backend común. Nunca exponer una clave OpenRouter en código JavaScript del navegador ni subirla a GitHub.

## Actualización del Commit 5 — banco de variantes y revisión de IA

Se añade un bloque **«Una nueva historia para practicar»** conectado a la API local del backend de Misti. Para usarlo, ya **no** basta con `python -m http.server`: ejecuta desde la raíz `python modules/comunicacion/backend/servidor.py --port 8765` y abre `http://127.0.0.1:8765/modules/comunicacion/ui/`.

El banco inicial ofrece **9 muestras originales de la capacidad L2**, tres por grado. Se identifican explícitamente como contenido demostrativo no aprobado por docentes. Más capacidades aparecerán cuando el responsable docente revise y publique actividades usando `backend/gestor_docente.py`. El servidor verifica las respuestas cerradas, mientras que las tareas abiertas siguen pendientes de revisión.

El navegador **no llama a OpenRouter**. El flujo de generación está reservado a un proceso editorial local fuera de la sesión del estudiante. Lee `../backend/README.md` para instrucciones y limitaciones.
