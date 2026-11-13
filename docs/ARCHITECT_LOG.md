# Bitácora del Architect — StudyFlow

Formato según `AGENTS.md`. Una entrada por decisión relevante.

### [FASE 1] 09:10 — Descubrimiento, alcance y restricciones

- **Agente:** Architect
- **Skills usadas:** `requirements-analysis` (`SKILL.md`,
  `templates/requirements-template.md`, `references/invest-and-acceptance.md`) y
  `ui-design` (`SKILL.md`, `templates/ui-spec-template.md`). La herramienta
  `skill` no está expuesta en este runtime de subagente; las skills se cargaron
  leyendo directamente sus archivos y referencias, que quedan citados como
  evidencia.
- **Decisión / hallazgo:** se confirma una SPA estática, sin backend ni build,
  para un único usuario por navegador. Se separa Must (RF-1 a RF-10, salvo el
  filtro por tipo que queda Should) de Won't (cuentas, sincronización,
  notificaciones, adjuntos, colaboración, integraciones, PWA). Se detectan cuatro
  ambigüedades de alcance: fecha de entrega opcional, reset con datos de ejemplo,
  importación que reemplaza y ventana de «próximas 7 días».
- **Evidencia:** `docs/BRIEF.md`, `AGENTS.md`, `package.json`,
  `.opencode/skills/requirements-analysis/**`,
  `.opencode/skills/ui-design/**`; supuestos A-1 a A-11 en
  `docs/REQUIREMENTS.md` §10.

### [FASE 1] 09:45 — Requisitos verificables, modelo de datos y trazabilidad

- **Agente:** Architect
- **Skills usadas:** `requirements-analysis`
  (`references/traceability-example.md` para la matriz,
  `references/invest-and-acceptance.md` para Given/When/Then).
- **Decisión / hallazgo:** se fijan RF-1..RF-10 con 26 criterios AC y se define
  el modelo exacto de `Task` y `Store`. Reglas clave: `dueDate` es `""` o
  `YYYY-MM-DD`; se compara como string local; `completedAt` es coherente con
  `status`; «próximas 7 días» abarca hoy..hoy+6; avance =
  `round(completadas / total * 100)`; una tarea sin fecha nunca es vencida ni
  próxima. Se establecen límites numéricos (título 120, curso 60, notas 500,
  horas 0–100, búsqueda 80).
- **Decisión / hallazgo:** cada RF tiene al menos una prueba prevista con nombre
  estable en `tests/`; se añaden pruebas de estructura (`markup`) y rendimiento
  para cubrir RNF-1, RNF-3 y RNF-6.
- **Evidencia:** `docs/REQUIREMENTS.md` §3–§9; 26 AC; matriz con 60+ nombres de
  prueba previstos.

### [FASE 2] 10:30 — Arquitectura, contratos y persistencia versionada

- **Agente:** Architect
- **Skills usadas:** `requirements-analysis` (criterios y límites) y
  `ui-design` (tokens y estados para el contrato del DOM). Se consultó además
  `code-generation/references/js-conventions.md` para alinear fechas,
  inmutabilidad y DOM seguro, y `testing/references/node-test-recipes.md` para el
  fake de almacenamiento y el reloj fijo.
- **Decisión / hallazgo:** dependencias unidireccionales
  `app → storage → domain`; `domain` no importa DOM ni `localStorage`.
  Se congela una API concreta: constantes, `ValidationError`/`NotFoundError`,
  `toDateOnly`/`parseDateOnly`/`addDays`, `createTask`/`updateTask`/`deleteTask`/
  `changeTaskStatus`, `computeStats`, `filterTasks`/`sortTasks`/`selectTasks`,
  `createSampleTasks`; en storage `loadTasks`/`saveTasks`/`parseDocument`/
  `importTasks`/`exportTasks`/`clearTasks`/`loadTheme`/`saveTheme`; en app
  `initApp({ doc, storage, now, idFactory })`.
- **Decisión / hallazgo:** documento `{ app, version: 1, updatedAt, tasks }` en
  `studyflow.tasks`; respaldo en `studyflow.tasks.backup` ante corrupción o
  versión desconocida; importación atómica que reemplaza tras confirmar. Diez
  ADR registran estilo, pureza, fechas, versionado, filtros, render por regiones,
  `<dialog>`, reset, importación y tema.
- **Evidencia:** `docs/ARCHITECTURE.md` §2–§6; contratos y tabla de IDs del DOM
  en §3; riesgos en §7; estrategia de pruebas en §8.

### [FASE 3] 11:15 — Especificación de interfaz, tokens y accesibilidad

- **Agente:** Architect
- **Skills usadas:** `ui-design` (`templates/ui-spec-template.md`,
  `references/design-tokens.md`, `references/accessibility-checklist.md`).
- **Decisión / hallazgo:** pantalla única con tarea principal «decidir hoy y lo
  que está en riesgo». Layout mobile-first 360/768/1280 con 1/2/3 columnas de
  tarjetas; siete métricas en 2/4/7 columnas; barra de filtros que se apila sin
  recrear controles. Tokens semánticos claros y oscuros derivados de la skill,
  con `--focus` claro ajustado a `#b45309` para cumplir 3:1. Se documentan
  estados vacío, sin resultados, error de lectura, error de guardado, éxito,
  vencida, foco, hover y deshabilitado.
- **Decisión / hallazgo:** se exige que prioridad, estado y vencimiento tengan
  texto además de color; diálogos con foco inicial, ciclo de Tab, `Escape` y
  restauración; toasts en `#toast-region` con `aria-live="polite"`; objetivos
  táctiles de 44×44 px; movimiento reducido. Se añaden 16 criterios visuales
  verificables (VA-1 a VA-16) y una tabla de contraste AA.
- **Evidencia:** `docs/UI_SPEC.md` §3–§8; tabla de tokens §4; componentes §5;
  checklist §7; criterios VA §8.

### [FASE 4] 11:40 — Cierre del diseño y preparación del handoff

- **Agente:** Architect
- **Skills usadas:** `requirements-analysis` y `ui-design` (verificación cruzada
  de cobertura: cada RF tiene AC y prueba; cada componente del UI spec tiene
  contrato de DOM en la arquitectura).
- **Decisión / hallazgo:** el paquete de diseño queda cerrado y consistente:
  los IDs de `index.html`, los nombres de funciones y los nombres de prueba
  coinciden entre los tres documentos. No se lanza todavía a Developer/Tester
  porque el encargo de esta sesión es solo el diseño. No se editó ningún archivo
  de `src/`, `tests/`, `index.html` ni `styles.css`, y no se ejecutaron comandos
  de shell.
- **Riesgos abiertos para la implementación:** fallo o bloqueo de
  `localStorage` (mitigado con fallback, respaldo y aviso); corrupción de datos
  (respaldo + ejemplos); desfase de fechas (strings date-only y reloj inyectado);
  XSS (solo `textContent`); foco en diálogos; rendimiento de 500 tareas; multitar
  fuera de alcance. Quedan como S3/S4 potenciales el filtro por tipo (Should) y
  el formato exacto de fechas con `Intl`.
- **Evidencia:** `docs/REQUIREMENTS.md`, `docs/ARCHITECTURE.md`,
  `docs/UI_SPEC.md`, `docs/ARCHITECT_LOG.md`; verificación de existencia con
  `glob` al cierre de la sesión.
