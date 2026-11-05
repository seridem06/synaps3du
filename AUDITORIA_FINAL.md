# Auditoría final — 5 noviembre 2026
Fuente verificada: GitHub seridem06/synaps3du feature/misti-unificado 3634e7d. Comparación mediante GitHub: un commit por delante de Demo-1 55bf756, cero por detrás. Correcciones en review/misti-auditoria; sin merge ni despliegue.

## Funciona / verificado
- Chat existente: stream y complete usan POST /api/misti/modelo. Prueba Node del adaptador real verifica URL, contexto y ausencia de clave en el cuerpo, incluso con configuración antigua Gemini.
- Backend: clave desde OMNIROUTE_API_KEY, base por defecto 127.0.0.1:20128/v1. No hay inferencia real verificada en este entorno; pruebas usan simulaciones controladas.
- Corrección: todas las opciones de las actividades L2 del catálogo para 4/5/6 comprobadas por HTTP; pistas 1 y 2 coinciden exactamente con el ejercicio.
- Estado: puntos, marcas de premios y grado sobreviven serialización/carga con localStorage simulado. Sigue siendo almacenamiento local modificable por el usuario, sin garantía contra manipulación, pestañas concurrentes o borrado del navegador.
- Matemática: motor de corrección conservado; prueba del cofre confirma +15 una vez. No hay cambios en cat.js, voice.js, curriculum.js, style.css, assets ni vendor respecto a Demo-1. No equivale a E2E completo de Matemática: generación de rutas/diagnósticos depende del nuevo transporte y de que el modelo entregue JSON válido.
- Usuario confirmó previamente interfaz 3D, Comunicación y puntos en Windows; es evidencia del usuario, no una prueba visual ejecutada aquí.

## Fallos corregidos
1. Cofres de rutas nuevas de Comunicación permitían ganar 15 puntos por repetir el mismo banco. Ahora son visuales; XP se concede por ID de actividad. Matemática conserva su recompensa.
2. Contexto del tutor se perdía tras recarga. Ahora se recupera del nodo activo de la ruta y se conserva su grado.
3. Respaldo sin IA concedía puntos de consulta; ahora no los concede.
4. Doble respuesta pendiente desde hojas distintas podía volver a avanzar el mismo nodo; se vuelve a comprobar el estado después de la respuesta HTTP.
5. Migración de claves escribía estado antes de completar la normalización; ahora guarda al finalizar.
6. Rutas HTTP con segmentos normalizados podían eludir el bloqueo por prefijo y leer archivos del backend. Se verifica también la ruta real resuelta. Prueba de regresión /foo/../modules/comunicacion/backend/tutor.py devuelve 404.

## Pruebas ejecutadas
18 pruebas backend/tutor/proxy/HTTP, 6 generador, 8 lógica original de Comunicación aprobadas. Suite Node adicional ejecuta funciones reales de app.js en entorno simulado: cofres, persistencia, claves y contexto; también adaptador ai.js. Registro: AUDITORIA_PRUEBAS.txt. Sintaxis JS comprobada.
Las 8 pruebas originales NO prueban la interfaz unificada. No se afirma prueba visual, audible ni de navegador real en esta auditoría.

## Falta / límites
Solo L2 está conectado a rutas. Faltan integración de L1/L3, oralidad O1–O6 y escritura E1–E4, borradores/rúbricas y reproducción de actividades de escucha del módulo anterior. No todos estos contenidos están necesariamente publicados en el catálogo. Cinco mundos y sus misiones no se trasladaron a la navegación principal. Generador y aprobación docente siguen disponibles por CLI, no integrados visualmente.
No hay autenticación real, diagnóstico adaptativo nuevo, servidor central de progreso ni sincronización. El historial se envía al proveedor y puede incluir perfil: usar exclusivamente datos ficticios. Visión directa del sistema anterior no pasa por el proxy de texto; permanece fallback OCR que depende de internet. Streaming es actualmente respuesta completa entregada al manejador de tokens, no transmisión incremental.
OmniRoute/modelo real, calidad de las pistas generativas, voz/micrófono, recarga en navegador, Matemática nueva y regresiones de todas las pantallas pendientes en Windows. No se garantiza que un modelo nunca revele la respuesta.

## ¿Lista para integrar?
3634e7d sin correcciones: no recomendar fusionar. Rama revisada: candidata para revisión del equipo y demo local; aprobación final condicionada a pruebas Windows anteriores. No lista para producción.
No divergencia con Demo-1 al consultar; sí cambios compartidos en app.js, ai.js e index.html que deben coordinarse si el compañero avanza. Comparar nuevamente las ramas antes de cualquier merge. El cambio de transporte afecta todas las materias y no debe presentarse como validado con el proveedor hasta probarlo.

## Aplicar revisión en Windows
Descargar Synaps3du_auditado.bundle en Downloads. En el repositorio con cambios locales previamente guardados:
```powershell
git fetch "$HOME\Downloads\Synaps3du_auditado.bundle" review/misti-auditoria:review/misti-auditoria
git switch review/misti-auditoria
```
Seguir EJECUTAR_UNIFICADO.md. Abrir http://127.0.0.1:8765/. Verificar modo=ia, reto por grado, pista/error/acierto, recarga sin XP adicional, repetir ruta/cofre, crear ruta Matemática y comprobar voz. No hacer reset --hard ni forzar cambio de rama si Git reporta trabajo local.
