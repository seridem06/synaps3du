# Misti — Módulo de Comunicación (4.º, 5.º y 6.º de primaria)

**Proyecto:** synaps3du · Hack4Edu 2026  
**Documento:** Propuesta funcional y acuerdo de integración  
**Estado:** Planificado; pendiente de integración y revisión pedagógica

## 1. Objetivo

Desarrollar experiencias de aprendizaje interactivas en el área de Comunicación para estudiantes de 4.º, 5.º y 6.º de primaria del Perú, con ayuda gradual del asistente Misti y seguimiento por competencias y capacidades.

El contenido debe alinearse con el Programa Curricular de Educación Primaria del MINEDU y adaptarse a los desempeños de cada grado. La IA podrá generar variantes de actividades, pero no definirá por su cuenta las competencias ni determinará resultados oficiales.

## 2. Organización visible: cinco mundos

| Mundo | Nombre | Enfoque |
| --- | --- | --- |
| 1 | Exploradores de historias | Lectura, comprensión, inferencia y reflexión |
| 2 | Oídos atentos | Escucha e interpretación de mensajes orales |
| 3 | Creadores de palabras | Producción y revisión de textos escritos |
| 4 | Voces que inspiran | Narración oral, exposición, diálogo y argumentación |
| 5 | Grandes comunicadores | Proyecto integrador de lectura, escritura y oralidad |

Cada mundo se divide en misiones, con progresión **Descubro → Practico → Demuestro → Proyecto final**. La complejidad, los textos y los criterios cambian según el grado.

## 3. Organización pedagógica interna: tres competencias y 13 capacidades

Los códigos siguientes son internos de Misti; no sustituyen la nomenclatura oficial del MINEDU.

| Código | Competencia | Capacidad |
| --- | --- | --- |
| L1 | Lee diversos tipos de textos escritos en su lengua materna | Obtiene información del texto escrito |
| L2 | Lee diversos tipos de textos escritos en su lengua materna | Infiere e interpreta información del texto |
| L3 | Lee diversos tipos de textos escritos en su lengua materna | Reflexiona y evalúa la forma, el contenido y contexto del texto |
| E1 | Escribe diversos tipos de textos en su lengua materna | Adecúa el texto a la situación comunicativa |
| E2 | Escribe diversos tipos de textos en su lengua materna | Organiza y desarrolla las ideas de forma coherente y cohesionada |
| E3 | Escribe diversos tipos de textos en su lengua materna | Utiliza convenciones del lenguaje escrito de forma pertinente |
| E4 | Escribe diversos tipos de textos en su lengua materna | Reflexiona y evalúa la forma, el contenido y contexto del texto escrito |
| O1 | Se comunica oralmente en su lengua materna | Obtiene información del texto oral |
| O2 | Se comunica oralmente en su lengua materna | Infiere e interpreta información del texto oral |
| O3 | Se comunica oralmente en su lengua materna | Adecúa, organiza y desarrolla las ideas de forma coherente y cohesionada |
| O4 | Se comunica oralmente en su lengua materna | Utiliza recursos no verbales y paraverbales de forma estratégica |
| O5 | Se comunica oralmente en su lengua materna | Interactúa estratégicamente con distintos interlocutores |
| O6 | Se comunica oralmente en su lengua materna | Reflexiona y evalúa la forma, el contenido y contexto del texto oral |

Una misión puede trabajar varias capacidades. Solo se registrarán como evaluadas aquellas para las que se obtuvo evidencia apropiada.

## 4. Tipos de actividad

- Lectura de textos breves, afiches, noticias, historietas y otros géneros, con preguntas y tareas de interpretación.
- Ordenamiento de secuencias, asociación de ideas, selección y justificación de respuestas.
- Escucha de audios originales y comprensión oral.
- Redacción de cuentos, cartas, descripciones, textos informativos y argumentativos con revisión guiada.
- Grabaciones y exposiciones orales, condicionadas a permisos y a la disponibilidad técnica.
- Proyectos integradores que combinan lectura, escritura y oralidad.

## 5. Generación de variantes con IA

Cada actividad partirá de una **plantilla validada** que describa: grado, competencia, capacidad principal, capacidades secundarias, desempeño curricular, situación, formato de respuesta, variables permitidas, restricciones de dificultad, rúbrica, respuesta o evidencia esperada y niveles de pista.

Flujo propuesto:

1. Seleccionar una plantilla adecuada al grado y progreso.
2. Generar una variante mediante IA o reutilizar una variante verificada guardada.
3. Validar formato, nivel, consistencia, alternativas y evidencias; rechazar una variante que no supere el control.
4. Presentar la actividad y registrar su versión exacta.
5. Evaluar respuestas cerradas con reglas verificables; ofrecer retroalimentación formativa en tareas abiertas y permitir revisión docente.
6. Registrar intentos, ayudas utilizadas y evidencia por capacidad.

**No se generarán preguntas arbitrarias sin referencia a una plantilla curricular.**

## 6. XP, rachas y seguimiento

- **XP:** puntos por esfuerzo y tareas completadas, con límites para evitar acumulación por repetición de una misma pregunta.
- **Racha:** aumenta cuando el estudiante completa una actividad significativa en un nuevo día consecutivo. No se exige acertar todo.
- **Progreso pedagógico:** distinto de XP y racha; depende de evidencias, rúbricas e intentos por capacidad.
- **Informe:** muestra fortalezas, capacidades trabajadas, evidencias, dificultades y recomendaciones; no atribuye automáticamente niveles oficiales de logro.

## 7. Acuerdo de integración con la interfaz del equipo

La rama de Comunicación debe preservar los archivos existentes de interfaz (`index.html`, `styles.css`, `script.js`, `img/`) mientras el equipo decide cómo integrar módulos.

Estructura **propuesta, no implementada**:

```text
synaps3du/
├── index.html              # Actualmente del equipo de frontend
├── styles.css              # Actualmente del equipo de frontend
├── script.js               # Actualmente del equipo de frontend
├── img/
├── docs/
│   └── comunicacion/
│       └── PLAN_MISTI_COMUNICACION.md
└── modules/
    └── comunicacion/
        ├── data/           # Contenidos, plantillas, alineación curricular
        ├── ui/             # Interfaz independiente, pendiente de integrar
        └── backend/        # Opcional: servidor para IA y progreso
```

Antes de agregar backend, confirmar con el equipo si usará **FastAPI, otro servidor, o solo frontend** y definir las rutas de comunicación entre componentes. Una clave OpenRouter no debe aparecer en HTML, JS, GitHub ni capturas; de usarse, únicamente se configurará en el servidor mediante variables de entorno. Para offline, el motor local se evaluará por separado.

## 8. Primeros hitos propuestos

- **Hito A — Diseño versionado:** subir este plan en una rama propia y abrir PR para revisión. **Estado: pendiente de subir.**
- **Hito B — Matriz curricular:** competencias, capacidades, desempeños y criterios verificados de 4.º a 6.º. **Estado: pendiente.**
- **Hito C — Primera aventura:** 1 historia/actividad integradora por grado, con actividades variadas y pistas. **Estado: pendiente de adaptación del prototipo aislado.**
- **Hito D — Motor dinámico:** plantillas + generación y validación de variantes. **Estado: pendiente.**
- **Hito E — Integración:** conectar módulo con la interfaz común, XP, rachas e informe. **Estado: pendiente de coordinación.**

> Nota: Existe un prototipo anterior independiente de Comunicación con FastAPI y misiones de demostración. No está integrado al repositorio y **no se considera un módulo terminado**. Su código puede servir como referencia después de acordar la arquitectura.

## 9. Fuentes de referencia

- Currículo Nacional de la Educación Básica: https://www.minedu.gob.pe/curriculo/pdf/curriculo-nacional-de-la-educacion-basica.pdf
- Programa Curricular de Educación Primaria: https://repositorio.minedu.gob.pe/handle/20.500.12799/4549
- Texto Comunicación 4 (dotación 2026): https://repositorio.minedu.gob.pe/handle/20.500.12799/11804
- Texto Comunicación 5 (dotación 2026): https://repositorio.minedu.gob.pe/handle/20.500.12799/11805
- Texto Comunicación 6 (dotación 2026): https://repositorio.minedu.gob.pe/handle/20.500.12799/11806
