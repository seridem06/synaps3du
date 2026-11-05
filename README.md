# Misty

App web con una gata 3D que acompaña a estudiantes de 5.° y 6.° de primaria en su paso a secundaria, sobre las competencias del Currículo Nacional (Perú). Corre completa en el navegador: HTML, CSS y JavaScript, sin servidor propio. La IA puede ser OpenRouter o Google Gemini, y la voz es la del propio navegador.

## Cómo abrirla

Necesita un servidor local (el micrófono y varias funciones del navegador no funcionan bien con doble clic sobre `index.html`).

```bash
cd misty
python -m http.server 8000
```

Abre `http://localhost:8000` en **Chrome** (el micrófono usa `webkitSpeechRecognition`). También sirve la extensión Live Server de VS Code.

## Primer uso

1. Registro: nombre, colegio y grado.
2. Pega tu clave de IA en el registro (si empieza con `AQ.` o `AIza` usa Gemini; si empieza con `sk-or-` usa OpenRouter) o en **Configuración**, donde eliges el proveedor. Se guarda solo en el `localStorage` de ese navegador. No la escribas en el código ni la subas al repositorio.
3. Revisa el modelo en **Configuración**.

### Google Gemini (AI Studio)
- Las claves nuevas de AI Studio empiezan con `AQ.` y funcionan con la API nativa de Gemini, que es la que usa Misty (cabecera `x-goog-api-key`). El endpoint "compatible con OpenAI" puede rechazarlas, por eso no se usa.
- Modelo por defecto: `gemini-3.8-flash` (sirve para texto y fotos). Si falla, prueba `gemini-2.5-flash`. Lista: <https://ai.google.dev/gemini-api/docs/models>.
- El plan gratuito tiene límites por minuto y por día que dependen del modelo; se consultan en <https://aistudio.google.com/rate-limit>.

### OpenRouter
- Los modelos gratuitos (`:free`) cambian seguido. `openrouter/free` elige al azar entre los gratuitos disponibles y acepta imágenes.
- Sin créditos comprados el límite es de 50 solicitudes por día (1000 con 10 créditos) y 20 por minuto.

### Ahorrar solicitudes
Cada mensaje al Tutor usa 2 llamadas a la IA (la respuesta y la clasificación de puntos). En **Configuración** puedes activar "Ahorrar solicitudes": los puntos se clasifican con palabras clave y cada mensaje usa solo 1 llamada.

## Qué incluye

- **Gato 3D** con Three.js (incluido en `vendor/`, no necesita internet): pelaje moteado, ojos ámbar que parpadean y siguen el puntero, guiño y pata saludando cuando está contento, mandíbula que se abre al hablar, bufanda andina, mochila, cola anillada y libros. Accesorios: chullo (nivel 2), lentes (nivel 3) y telescopio (nivel 4). Si el equipo no tiene WebGL cae solo al **gato 2D en SVG** (mismo estilo y misma API).
- **Diseño tipo dashboard**: barra lateral con perfil, pestañas Inicio / Guía / Tutor, y en Inicio tarjetas de puntos, nivel, racha y logros, progreso de la ruta, reto del día (+20 pts), eficiencia de aprendizaje (donut), calendario del mes y podio de áreas. Escena de Arequipa (Misti y arcos de sillar) detrás del gato.
- **Voz**: `speechSynthesis` por oraciones mientras llega el streaming (tono 1.4 por defecto); la boca se mueve cada 120–180 ms mientras hable.
- **Modo Tutor**: conversación libre con pistas primero; acepta fotos del cuaderno (visión, con plan B de OCR con Tesseract.js).
- **Modo Guía**: camino sinuoso al estilo Duolingo (monedas hechas, estrella con EMPEZAR, candados, cofre de +15 pts a la mitad y trofeo al final). Cada paso se abre en una hoja de lección con retroalimentación inmediata. Si el estudiante no sabe en qué falla, hace un diagnóstico de 6 a 10 preguntas y arma la ruta desde el primer fallo.
- **Puntos y logros**: una segunda llamada corta clasifica área y competencia. 10 puntos por paso, 3 por consulta, 5 por día de racha, 100 por nivel (editable en `PUNTOS`, arriba de `js/app.js`).
- **Extras**: racha, historial, accesorios que se desbloquean por nivel, mapa de progreso en grafo (estilo Obsidian), reporte para padres o docentes (descargable o imprimible), modo oscuro y tamaño de letra.

## Pendiente antes de la demo

- **Desempeños oficiales**: `js/curriculum.js` trae las competencias, pero `DESEMPENOS` está vacío a propósito. Cópialos del programa curricular oficial del MINEDU (no de memoria); en cuanto estén ahí, Misty los usa en rutas y diagnósticos.

## Estructura

```
index.html        pantallas y estructura
style.css         estilos (claro y oscuro)
js/curriculum.js  áreas, competencias, desempeños
js/cat.js         gato 3D (Three.js) y gato 2D (SVG)
assets/           imágenes de Misty (avatar y banner)
js/ai.js          OpenRouter y Gemini: streaming, JSON, prompts, fotos, OCR
js/voice.js       voz de salida y de entrada
js/app.js         estado, modos, puntos, logros, paneles, mapa, reporte
vendor/three.min.js
```

Para una versión real, la clave de IA tendría que pasar por un servidor propio.
