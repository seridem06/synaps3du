# Synaps3du unificado
Base Demo-1, 55bf756 (5 noviembre 2026, 16:56 UTC). Revisadas también master c9c8d9e y rama https/github.com/R0otDrigo 5f93e5b, anteriores. La estructura visual de Demo-1 coincide con la captura proporcionada.

## Windows
En esta carpeta o rama, con Python 3.10+:
```powershell
$env:OMNIROUTE_BASE_URL='http://127.0.0.1:20128/v1'
$env:MISTI_MODEL='openrouter/cohere/north-mini-code:free'
$clave=Read-Host 'Clave del gateway' -AsSecureString
$env:OMNIROUTE_API_KEY=[System.Net.NetworkCredential]::new('', $clave).Password
python modules/comunicacion/backend/servidor.py --port 8765
```
Abrir http://127.0.0.1:8765/ (raíz). No abrir index.html como archivo ni usar Live Server.

Perfil ficticio Alex, colegio Demo, grado 4, 5 o 6. Áreas → Practicar Comunicación. Se abre una ruta en la interfaz existente. Responder incorrectamente → Pista → corregir → Continuar. Preguntar a Misti cierra la hoja y abre el mismo chat, conservando contexto; volver al paso desde Mi ruta. Las recompensas usan misty.v1. Cada ID de actividad concede XP una sola vez. Los intentos se conservan localmente (últimos 500). No hay cuenta autenticada ni sincronización.

## Prueba de inferencia real (segunda consola)
```powershell
$b=@{messages=@(@{role='user';content='Hola, dame una pista para comprender un texto'});grado=4}|ConvertTo-Json -Depth 5
Invoke-RestMethod http://127.0.0.1:8765/api/misti/modelo -Method Post -ContentType application/json -Body ([Text.Encoding]::UTF8.GetBytes($b))
```
Exigir modo=ia; modo=respaldo no prueba inferencia. Sin IA, Comunicación conserva banco/pistas/corrección. Generar rutas nuevas de Matemática requiere el proveedor; las rutas guardadas conservan su motor original.

## Evidencia y pendientes
16 pruebas Python backend/tutor/proxy, 6 generador y 8 lógica de Comunicación aprobadas. Sintaxis app.js y ai.js comprobada con Node. Test anterior de página adaptado a redirección hacia interfaz principal. Resultados en PRUEBAS_UNIFICADO.txt.
Intento de E2E Chromium bloqueado por entorno: socket Operation not permitted. No se declara aprobada la prueba visual, mascota 3D, voz audible ni persistencia visual. Probar en Windows los tres grados, recarga y ausencia de doble XP. La inferencia se comprobó solo con simulaciones; falta gateway real.
El motor y assets 3D, estilos, voz y corrección de Matemática se conservaron; cambió el transporte de IA al backend. Visión directa no está soportada por el proxy de texto; usar OCR. No se promete compatibilidad del modelo real con generación JSON hasta validarla.
Solo L2 está conectado a rutas en esta entrega; otros tipos del catálogo siguen pendientes de adaptación visual. Sin diagnóstico adaptativo nuevo. La aprobación docente del banco existente se conserva; conversación IA experimental, sin revisión docente automática. La antigua URL de Comunicación redirige a la principal.
Voces/STT, fuentes externas, OCR e inferencia pueden requerir internet. No se ha certificado offline.

## Guion
“Esta es la misma plataforma del equipo. Elegimos Comunicación y Misti nos acompaña en una lectura. Si nos equivocamos, pedimos una pista y volvemos a intentar. El programa comprueba la respuesta y registra los puntos en el mismo perfil. Podemos consultar el ejercicio al tutor desde el chat habitual. Cuando no hay IA, el respaldo se identifica claramente.”
