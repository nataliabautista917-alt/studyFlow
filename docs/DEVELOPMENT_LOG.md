# Bitácora de desarrollo — StudyFlow

**Agente responsable:** Developer (`.opencode/agents/developer.md`)
**Alcance de esta bitácora:** implementación completa del SPA (dominio, almacenamiento,
interfaz, marcado, estilos, servidor y pruebas) más las decisiones y desvíos que el
Architect y el Tester deben conocer.

**Nota sobre skills:** la herramienta `skill` no está expuesta en este runtime, así que
las cuatro skills del proyecto se leyeron directamente desde el repositorio:
`.opencode/skills/requirements-analysis/SKILL.md`,
`.opencode/skills/ui-design/SKILL.md`,
`.opencode/skills/code-generation/SKILL.md` y
`.opencode/skills/testing/SKILL.md`.

## Estado final

```text
npm run check   → exit 0 (node --check sobre domain, storage, app y serve)
npm test        → 130 pruebas, 130 en verde, 0 fallos, 0 omitidas
```

| Archivo de prueba | Pruebas | Cubre |
| --- | --- | --- |
| `tests/domain.test.js` | 20 | RF-1, RF-2, RF-3, RF-4, RF-9, RNF-1, fechas y datos externos |
| `tests/metrics.test.js` | 9 | RF-5, RF-9 |
| `tests/filters.test.js` | 9 | RF-6 |
| `tests/storage.test.js` | 18 | RF-7, RF-8, RF-10 |
| `tests/integration.test.js` | 5 | RF-7, RF-8, RF-9, RNF-4 |
| `tests/markup.test.js` | 10 | RF-10, RNF-1, RNF-2, RNF-5, RNF-6, RNF-7 |
| `tests/performance.test.js` | 3 | RNF-3 |
| `tests/regression.test.js` | 41 | RF-1…RF-10, RNF-4 (33 adversariales + BUG-01…BUG-08) |
| `tests/app.test.js` | 15 | RF-5…RF-8, RF-10, RNF-2, RNF-8 (interfaz con DOM falso) |
| **Total** | **130** | RNF-8 (≥ 30 pruebas) cumplido |

---

### [CONTRATO] 21:30 — Lectura del contrato y de las skills antes de escribir código

- **Agente:** Developer
- **Skills usadas:** `requirements-analysis` (criterios de aceptación y trazabilidad),
  `ui-design` (tokens, estados, accesibilidad), `code-generation` (estructura y
  convenciones), `testing` (pruebas con `node:test`).
- **Decisión / hallazgo:** el contrato se trató como inmutable. Orden de trabajo:
  `docs/REQUIREMENTS.md` → `docs/ARCHITECTURE.md` → `docs/UI_SPEC.md` → `AGENTS.md`.
  Se detectaron tres contradicciones internas y se resolvió por precedencia explícita
  (§3.1 sobre §3.2 en breakpoints; §5.10 sobre §4.1 en el fondo de los campos; la
  matriz §9 como contrato de nombres de prueba, que no se renombran nunca).
- **Evidencia:** `docs/REQUIREMENTS.md` (RF-1…RF-10, AC-01…AC-26, §9),
  `docs/ARCHITECTURE.md` (§3.1–§3.6, §8, §9), `docs/UI_SPEC.md` (§3.1 tabla de
  breakpoints, §4 tokens, §5 componentes, §7 checklist VA-1…VA-16).

### [DOMINIO] 21:54 — `src/domain.js`: reglas puras con reloj e ids inyectables

- **Agente:** Developer
- **Skills usadas:** `code-generation`, `requirements-analysis`.
- **Decisión / hallazgo:** 33 exportaciones según ARCHITECTURE §3.1; constantes
  congeladas con `Object.freeze`; valores de enumeración en español e identificadores en
  inglés. `validateTaskInput` es estricto con las enumeraciones (un valor ausente es
  `invalid_enum`), por eso `createTask`/`updateTask` aplican los valores por defecto
  *antes* de validar. `formatDateEs` devuelve `""` para fechas inválidas.
  `updateTask` acota `updatedAt >= createdAt` y conserva `completedAt` solo si la tarea
  ya estaba completada. Las fechas son strings `YYYY-MM-DD` comparados
  lexicográficamente en hora local: **nunca** `new Date("YYYY-MM-DD")`.
- **Evidencia:** `node --check src/domain.js` OK; humo con 6 tareas →
  `{total:6, pending:4, inProgress:1, completed:1, overdue:1, upcoming7:3, completionRate:17}`;
  `parseDateOnly("2026-02-30") === null`; `addDays("2026-12-31", 1) === "2027-01-01"`;
  `formatDateEs("2026-11-14") === "14 nov 2026"`; `"3,5"` → `3.5`.

### [ALMACENAMIENTO] 21:58 — `src/storage.js`: documento versionado y respaldo

- **Agente:** Developer
- **Skills usadas:** `code-generation`, `requirements-analysis`.
- **Decisión / hallazgo:** documento `{ app, version, updatedAt, tasks }`; `saveTasks`
  **nunca lanza** (devuelve `{ ok:false, code }`) para que la interfaz conserve el estado
  en memoria. `mode:"load"` descarta tareas inválidas y duplicados contándolos en
  `skipped`, y escribe el valor crudo en `BACKUP_KEY` solo si hubo descartes o corrupción;
  `mode:"import"` es atómico y rechaza el documento completo. Una `version` ausente se
  asume como la actual (supuesto A-9). El respaldo es de mejor esfuerzo: si falla, no
  interrumpe la aplicación. `importTasks` acepta `{ now }` por simetría pero no lo usa
  (el documento importado conserva sus `createdAt`/`updatedAt`).
- **Evidencia:** `node --check src/storage.js` OK; humo de ida y vuelta; exportación
  `studyflow-2026-11-12.json` con 2 espacios de indentación; códigos verificados
  `unsupported_version`, `invalid_json`, `invalid_task`, `duplicate_id`,
  `storage_unavailable`, `invalid_theme`; la carga corrupta respalda el crudo y la
  importación no escribe nada.

### [INTERFAZ] 22:00 — `src/app.js`: render por regiones y flujo de mutación

- **Agente:** Developer
- **Skills usadas:** `code-generation`, `ui-design`, `requirements-analysis`.
- **Decisión / hallazgo:** render por regiones para que los controles de filtro no se
  reconstruyan mientras se escribe (no se pierde el foco). Toda mutación sigue el orden
  calcular → persistir → renderizar → anunciar, y **no revierte** si el guardado falla:
  avisa con `#storage-warning` y el estado en memoria se conserva. Los párrafos de error
  se limpian con `textContent = ""` (nunca con `hidden`) y todos los datos del usuario se
  pintan con `textContent`. `#task-id` se mantiene sincronizado, pero la edición se
  gobierna con `state.editingId` en memoria. `SAMPLE_TASKS_COUNT = 6` solo se usa en el
  mensaje de restablecer.
- **Evidencia:** `node --check src/app.js` OK (1 084 líneas, única exportación
  `initApp`); smoke con DOM falso **85/85 OK** cubriendo siembra, métricas, validación,
  XSS como texto, crear/editar, *debounce* de 200 ms, filtros y orden, iniciar/completar/
  reabrir, borrado con confirmación, tema, exportar, importar, restablecer, estados
  vacíos, fallo de guardado y `destroy()`.

### [MARCADO] 22:10 — `index.html` y `scripts/serve.mjs`

- **Agente:** Developer
- **Skills usadas:** `ui-design`, `code-generation`.
- **Decisión / hallazgo:** los 66 identificadores del contrato §3.4 están presentes; el
  script de tema va **inline y antes** del CSS para evitar el destello (RF-10) y el
  módulo se carga al final del `body`. Se añadió `<link rel="icon" href="data:,">` para
  evitar el 404 automático de `/favicon.ico` y se usó `src="./src/app.js"` con prefijo
  `./` según lo indicado. El servidor es estático, solo GET/HEAD, rechaza rutas con
  travesía, sirve `no-store` y registra mensajes en ASCII para no romper terminales
  Windows.
- **Evidencia:** script estático de marcado **47 OK · 0 fallos**; script de servidor
  **29 OK · 0 fallos**; `npm start` → `[studyflow] Escuchando en http://localhost:4173`;
  `GET /` → 200 `text/html; charset=utf-8`; `GET /styles.css` → 200; `GET /src/app.js` → 200.

### [ESTILOS] 22:31 — `styles.css`: tokens, componentes y responsive

- **Agente:** Developer
- **Skills usadas:** `ui-design`, `code-generation`.
- **Decisión / hallazgo:** mobile-first desde 360 px con `min-width: 768px` y
  `min-width: 1280px` (§3.1 manda sobre los wireframes de §3.2). Los campos usan
  `background: var(--surface)` porque §5.10 prevalece sobre §4.1; `--surface-2` queda
  para campos deshabilitados y tarjetas de métrica. Se añadió el token de layout
  `--shell-max` (720 px → `var(--content-max)` en 1280) para alinear cabecera y pie con
  `main`. El diálogo empareja campos en dos columnas con `:has()` y `grid-row` explícito,
  con retroceso seguro a fila completa, y el título queda fijo (`sticky`) mientras los
  botones acompañan el scroll. `!important` solo en `[hidden]`, `.visually-hidden` y el
  bloque de movimiento reducido.
- **Evidencia:** 1 240 líneas, 27 985 B, 85 selectores de clase y 3 bloques `@media`
  (768 px, 1280 px, `prefers-reduced-motion`); auditoría CSS de **148 aserciones
  OK · 0 fallos** (tokens claros y oscuros exactos, tipografía, espaciado, forma y
  movimiento, `max-height: calc(100vh - 32px)`, `-webkit-line-clamp: 2`,
  `overflow-wrap: anywhere`, `minmax(148px, 1fr)`, sin `url()`, `http` ni `@import`);
  barrido de clases de `app.js` + `index.html` → 0 clases sin definir.

### [PRUEBAS] 22:38 — Pruebas de dominio, métricas y filtros

- **Agente:** Developer
- **Skills usadas:** `testing`, `requirements-analysis`.
- **Decisión / hallazgo:** los nombres de prueba se copiaron **literalmente** de la
  matriz §9 (31 nombres) y se añadieron 7 pruebas extra con nombre propio; ninguna
  prueba de la matriz se renombró. Los dobles de `tests/helpers/fakes.js` son
  independientes de `src/storage.js` a propósito (no se prueba un módulo con su propio
  doble). Se corrigió una aserción propia: `createTask` ya recorta el curso, así que el
  caso de “no mutación” pasó a compararse con `structuredClone`.
- **Evidencia:** `node --test tests/domain.test.js tests/metrics.test.js
  tests/filters.test.js` → 38 pruebas, 38 en verde (20 + 9 + 9).

### [PRUEBAS] 22:45 — Pruebas de almacenamiento, integración, marcado y rendimiento

- **Agente:** Developer
- **Skills usadas:** `testing`, `code-generation`.
- **Decisión / hallazgo:** el marcado y los estilos se verifican con `node:fs` y regex,
  sin DOM ni navegador; la integración reproduce el flujo real (crear → guardar → cargar
  → filtrar → completar → exportar → importar) sin depender de la interfaz. Se detectó y
  corrigió una expectativa propia en la prueba de fallo de guardado (al completar una
  tarea seguía habiendo otra vencida: `overdue: 1`, no 0). Ambas correcciones fueron de
  las pruebas, no del producto.
- **Evidencia:** `npm test` → **74 pruebas, 74 en verde, 0 fallos**; por archivo:
  storage 18, markup 10, integration 5, performance 3; `npm run check` → exit 0.

### [PRUEBAS] 23:05 — Cierre de COV-01: pruebas de interfaz con DOM falso

- **Agente:** Developer
- **Skills usadas:** `testing` (pruebas independientes y reproducibles),
  `code-generation` (módulo de apoyo sin dependencias), `ui-design` (estados y
  accesibilidad que hay que afirmar) y `requirements-analysis` (trazar cada caso a RF/RNF).
- **Decisión / hallazgo:** COV-01 (S2) queda cerrado: `tests/app.test.js` importa
  `src/app.js`, carga el `index.html` **real** en un DOM falso y arranca la app con
  `initApp({ doc, storage, now, idFactory })`. Se reconstruyó como código versionado el
  arnés del smoke temporal de 85 comprobaciones (`tests/helpers/fake-dom.js`), ahora
  ampliado: analizador de HTML (con `<script>`/`<style>` tratados como texto y **nunca**
  ejecutados), árbol de nodos con atributos, `classList`, `dataset`, `textContent`/`innerHTML`,
  eventos con propagación, motor de selectores (grupos, descendiente, `>`, `#id`, `.clase`,
  `[attr]`, `[attr="v"]`, `:not(...)`) y `focus()`. Los dobles de APIs del navegador son
  explícitos e inyectables: `installDownloadStubs()` (sustituye `URL`/`Blob` y captura el
  JSON exportado) e `installMatchMedia()` (para `prefers-color-scheme`), ambos con
  `restore()` en `try/finally`. El HTML de `index.html` se analiza de verdad, así que las
  pruebas fallan si el contrato del DOM (§3.4) y `app.js` se separan.
- **Hallazgos durante la construcción del arnés** (todos del arnés, ninguno del producto):
  (1) un regex global compartido en el parser de selectores se pisaba el `lastIndex` entre
  llamadas recursivas de `:not(...)` y provocaba un bucle infinito; ahora se instancia un
  regex por llamada. (2) `URL.revokeObjectURL` borraba el contenido capturado antes de poder
  afirmarlo. (3) `reset()` y el `value` inicial de un `<select>` no partían de la opción
  marcada. (4) Tres expectativas propias mal escritas: `#task-title` tiene `maxlength="120"`
  (no 80), la exportación respeta el orden del **estado** (no el de la vista) y el mensaje
  real de JSON inválido es «El archivo no es un JSON válido.».
- **Cobertura de los 12 casos pedidos:** UI-01 arranque/siembra/métricas/persistencia,
  UI-02 crear, UI-03 validación con `aria-invalid` y `#form-errors`, UI-04 editar conservando
  `id`/`createdAt`, UI-05 Iniciar→Completar→Reabrir con `completedAt` y métricas, UI-06
  eliminar con confirmación (cancelar/confirmar), UI-07 filtros de texto (con debounce de
  200 ms) y de curso + estado vacío + limpiar, UI-08 orden por prioridad y fecha, UI-09 tema
  (persistencia y reinicio), UI-10 `prefers-color-scheme`, UI-11 XSS (el título se pinta como
  texto y no crea `<img>`), UI-12 fallo de guardado sin revertir, UI-13 exportar JSON
  parseable + importar inválido sin cambios + importar válido con confirmación. Extras:
  UI-14 datos corruptos (copia de respaldo) y UI-15 `destroy()`/`refresh()`.
- **Evidencia:** `npm run check` → exit 0; `npm test` → **130 pruebas, 130 en verde,
  0 fallos, 0 omitidas** (`tests/app.test.js` → 15/15). Determinismo: reloj fijo `NOW`,
  `seqIdFactory()`, almacenamiento en memoria, sin red ni dependencias. El hook `after`
  del archivo llama a `destroy()` para no dejar vivos los temporizadores de los avisos.
- **Desvío declarado (no silenciado):** el arranque automático de `src/app.js` (la rama que
  lee `globalThis.document` y espera `DOMContentLoaded`) **no** se ejecuta en las pruebas:
  el módulo se importa una sola vez, en Node no existe `globalThis.document` y esa rama usa
  el reloj y el generador de ids reales, lo que rompería el determinismo exigido. El camino
  probado es el inyectable `initApp(...)`; los límites restantes (sin CSS/layout, sin foco
  real de navegador, sin `File`/`FileList`, sin temporizadores virtuales) están declarados
  al final de `tests/helpers/fake-dom.js` y de `tests/app.test.js`.

---

## Cobertura de requisitos

| Requisito | Pruebas que lo cubren |
| --- | --- |
| RF-1 Crear con validación | `domain.test.js` (crear con pendiente por defecto, título vacío, fecha inexistente, coma decimal, rango de horas, límites, bisiesto) |
| RF-2 Editar sin alterar `id`/`createdAt` | `domain.test.js` (actualiza sin mutar, ignora id y createdAt, NotFoundError) |
| RF-3 Eliminar con confirmación | `domain.test.js` (elimina solo la indicada); `app.test.js` UI-06 (cancelar no borra, confirmar borra y anuncia) |
| RF-4 Cambiar estado | `domain.test.js` (registra y limpia `completedAt`, no muta la lista, estado desconocido); `app.test.js` UI-05 (ciclo en la interfaz) |
| RF-5 Métricas | `metrics.test.js` (9 pruebas, incluidos los valores del seed); `app.test.js` UI-01/UI-05 (pintado de `#stat-*` y `#progress-bar`) |
| RF-6 Buscar, filtrar y ordenar | `filters.test.js` (9 pruebas); `app.test.js` UI-07 (debounce, curso, vacío) y UI-08 (orden) |
| RF-7 Persistencia y corrupción | `storage.test.js` (6 pruebas) + `integration.test.js`; `app.test.js` UI-12/UI-14 |
| RF-8 Exportar e importar | `storage.test.js` (7 pruebas) + `integration.test.js`; `app.test.js` UI-13 |
| RF-9 Datos de ejemplo | `domain.test.js`, `metrics.test.js`, `integration.test.js` (reset); `app.test.js` UI-01/UI-14 |
| RF-10 Tema | `storage.test.js` + `markup.test.js` (arranque desde el script inline) + `app.test.js` UI-09/UI-10 |
| RNF-1 Sin interpretar HTML | `domain.test.js` (texto plano), `markup.test.js` (h1, labels, aria-live), `app.test.js` UI-11 (XSS en el render) |
| RNF-2 Responsive | `markup.test.js` (viewport y media queries) + inspección manual pendiente |
| RNF-3 Rendimiento | `performance.test.js` (500 tareas < 50 ms) |
| RNF-4 Entradas inválidas | `storage.test.js` (carga/importación atómica) + `integration.test.js`; `app.test.js` UI-03/UI-13 |
| RNF-5 Sin dependencias ni build | `markup.test.js` (módulos ES, sin CDN) + `npm run check`; el arnés de DOM es propio y sin dependencias |
| RNF-6 Sin red | `markup.test.js` (sin `fetch`, XHR, WebSocket, URLs externas); `app.test.js` no usa red |
| RNF-7 Dominio puro | `markup.test.js` (inspección estática de `domain.js`) |
| RNF-8 ≥ 30 pruebas | `npm test` → 130 |
| RNF-9 Textos en español | Revisión manual de textos; sin prueba automática |
| RNF-10 Sin 404 ni errores de consola | `npm start` + smoke manual pendiente de navegador real |

## Desvíos y decisiones que requieren confirmación

1. **Token `--shell-max` (no está en la tabla §4).** Se añadió para alinear cabecera y
   pie con `main` (720 px, y `var(--content-max)` en 1280). Necesita visto bueno del
   Architect o su incorporación a la tabla de tokens.
2. **Fondo de los campos: §4.1 vs §5.10.** Se siguió §5.10 (`--surface`); `--surface-2`
   solo en campos deshabilitados y tarjetas de métrica.
3. **Filtros en 768 px: §3.1 vs §3.2.** Se siguió §3.1 (búsqueda en fila completa y
   selects en dos columnas) frente al wireframe esquemático.
4. **Diálogo “encabezado y botones visibles” (§5.5).** Solo se pudo cumplir a medias: el
   título queda fijo, pero los botones no se pueden fijar dentro de un `grid` sin cambiar
   el DOM (los elementos `sticky` no escapan de su área de grid). No se tocó el marcado
   para no salir del alcance.
5. **Emparejamiento en dos columnas con `:has()`.** Requiere un navegador moderno; hay
   retroceso a fila completa cuando no está soportado.
6. **`computeStats` con entradas que no son tareas.** Cuenta `total = list.length`, así
   que una entrada basura infla el total aunque no sume en ningún contador. El
   almacenamiento valida antes, por lo que no llega basura al estado; se dejó como
   observación para el Tester y **no** se fijó en una prueba.
   → **Corregido en el ciclo Tester→Developer (BUG-06):** `total` ahora cuenta solo
   entradas que sean objetos y la prueba `BUG-06` lo fija.
7. **`#task-hours` es `type="number"` (§5.5).** Algunos navegadores devuelven `""` si el
   usuario escribe coma decimal; el dominio normaliza `"3,5"` igualmente, pero la
   experiencia puede variar según el navegador.
8. **Campos ocultos sin `<label>` visible.** `#task-id` (hidden) e `#import-file`
   (hidden, con `aria-label="Archivo JSON para importar"`). Cualquier prueba que enumere
   los campos de `#task-form` debe excluir `[type="hidden"]`.
9. **`./` en las rutas.** El marcado usa `./styles.css` y `./src/app.js`; las pruebas
   aceptan el prefijo opcional.

## Correcciones del ciclo Tester→Developer

Reporte de origen: `docs/TEST_REPORT.md` (BUG-01…BUG-08). Pruebas de regresión:
`tests/regression.test.js` (se retiró el `.skip` de las 8; quedan activas y en verde).
Comandos de cierre: `npm run check` → exit 0; `npm test` → **115 pruebas, 115 en verde,
0 fallos, 0 omitidas**.

### BUG-01 — `updateTask` lanzaba `TypeError` con `notes: undefined`

- **Archivo:** `src/domain.js` (`updateTask`).
- **Causa:** el bucle de `EDITABLE_FIELDS` copiaba el valor del patch cuando la clave
  existía, aunque su valor fuese `undefined`; `draft.notes.trim()` reventaba después.
- **Arreglo:** decisión del Architect aplicada en el bucle: si `source[field] === undefined`
  —presente o ausente— se conserva `task[field]` («sin cambio»). Además el retorno
  normaliza `notes` con `(draft.notes ?? "").trim()` y `dueDate` con `?? ""`, igual que
  `createTask`, para que un `null` explícito tampoco rompa.
- **Prueba:** `tests/regression.test.js` › `BUG-01 updateTask con notes undefined no debe
  lanzar TypeError` (ahora espera conservar `"algo"`, con comentario de la decisión).

### BUG-02 — `updateTask` con `dueDate: undefined` rompía el contrato `YYYY-MM-DD`

- **Archivo:** `src/domain.js` (`updateTask`).
- **Causa:** la misma: el patch con `undefined` sobrescribía la fecha y el retorno devolvía
  un valor que no era cadena.
- **Arreglo:** el bucle conserva la fecha actual; el retorno aplica `draft.dueDate ?? ""`
  para que el campo sea siempre una cadena.
- **Prueba:** `tests/regression.test.js` › `BUG-02 updateTask con dueDate undefined debe
  quedar como cadena vacía` (la expectativa ajustada por el Architect es **conservar la
  fecha actual**, `TODAY`; se dejó el nombre original por trazabilidad con el reporte).

### BUG-03 — `updateTask` con `estimatedHours: undefined` borraba las horas

- **Archivo:** `src/domain.js` (`updateTask`).
- **Causa:** `undefined` llegaba a `parseEstimatedHours` y se convertía en `0`.
- **Arreglo:** el bucle conserva el valor actual (4); `parseEstimatedHours` ya ignoraba
  `null`.
- **Prueba:** `tests/regression.test.js` › `BUG-03 updateTask con estimatedHours undefined
  no debe borrar las horas` (ya esperaba 4).

### BUG-04 — `createTask` aceptaba cualquier id del generador inyectado

- **Archivo:** `src/domain.js` (`createTask`).
- **Causa:** solo se comprobaba `typeof id !== "string" || id === ""`, no el patrón
  `^tsk_[a-z0-9]{6,32}$` que sí usaba `normalizeTask`.
- **Arreglo:** se valida con `TASK_ID_PATTERN` y se lanza `ValidationError` con
  `code: "invalid_id"`.
- **Prueba:** `tests/regression.test.js` › `BUG-04 createTask debe rechazar un id que no
  cumple el patrón tsk_` (ampliada a `"malo"`, `"tsk_"`, `"tsk_abc"`, `"Tsk_abc123"`,
  `"tsk_ABC123"`, `"tsk_abc-123"`, `42` y `null`, más un id válido que sí se acepta).

### BUG-05 — `parseDocument` aceptaba envolturas de otra aplicación

- **Archivo:** `src/storage.js` (`parseDocument`).
- **Causa:** nunca se miraba `document.app`, aunque `saveTasks`/`exportTasks` siempre
  escriben `app: "studyflow"`.
- **Arreglo:** si `app` existe y es distinto de `APP_ID` se devuelve
  `failure("invalid_document", …)` antes de comprobar la versión. Si `app` falta se
  mantiene la tolerancia con archivos hechos a mano (arreglos simples incluidos).
- **Prueba:** `tests/regression.test.js` › `BUG-05 importTasks debe rechazar una envoltura
  con app distinto de studyflow` (se añadió el `code` y el caso tolerado sin `app`).

### BUG-06 — `computeStats` inflaba `total` con entradas que no eran tareas

- **Archivo:** `src/domain.js` (`computeStats`).
- **Causa:** los contadores usaban la guarda `!task || typeof task !== "object"`, pero
  `total` se calculaba con `list.length`, así que `[null, tarea]` daba `total: 2`.
- **Arreglo:** `total` se incrementa dentro del mismo bucle y con la misma guarda;
  `completionRate` se calcula sobre ese `total`.
- **Prueba:** `tests/regression.test.js` › `BUG-06 computeStats no debe inflar total con
  entradas que no son tareas`.

### BUG-07 — `getCourses` duplicaba cursos que solo cambiaban de mayúsculas

- **Archivo:** `src/domain.js` (`getCourses`).
- **Causa:** el `Set` de deduplicación usaba la grafía literal del curso.
- **Arreglo:** la clave de deduplicación es `course.toLowerCase()` (se conserva la primera
  grafía) y el orden final sigue siendo `localeCompare("es")`.
- **Prueba:** `tests/regression.test.js` › `BUG-07 getCourses debe unificar cursos que solo
  difieren en mayúsculas`.

### BUG-08 — una tarea con fecha `9999-12-31` empataba con las tareas sin fecha

- **Archivo:** `src/domain.js` (constante `NO_DATE_KEY`, usada por `sortTasks`).
- **Causa:** el centinela era la propia fecha `"9999-12-31"`, la mayor fecha representable,
  así que una tarea real con esa fecha compartía clave con las que no tienen fecha.
- **Arreglo:** el centinela pasa a ser `"\uffff"`, que ordena después de cualquier fecha
  `YYYY-MM-DD` y no puede coincidir con ninguna.
- **Prueba:** `tests/regression.test.js` › `BUG-08 una tarea con fecha 9999-12-31 no debe
  empatar con las que no tienen fecha`.

**Notas del ciclo:** no se renombró ninguna prueba (los nombres `BUG-01`…`BUG-08` siguen
siendo la referencia del reporte; donde la decisión del Architect cambió la expectativa se
dejó un comentario explicando la semántica). Solo se tocaron `src/domain.js`,
`src/storage.js`, `tests/regression.test.js` y esta bitácora; no se modificó ninguna prueba
existente fuera de `regression.test.js`. Las suites anteriores (74 pruebas) siguen verdes
sin cambios.

## Nota al Tester

**Riesgos y zonas no verificadas (requieren navegador real):**

- **Contraste real** de los tokens en claro y oscuro (§4 y checklist VA-1…VA-16): la
  auditoría fue estática, no medida con una herramienta de contraste.
- **360 px sin scroll horizontal**: la regla está declarada (`min-width` de 768 px y
  `minmax(148px, 1fr)`), pero el desbordamiento real no se puede comprobar sin navegador.
- **Teclado y foco**: orden de tabulación, `Escape` en los diálogos, devolución del foco
  tras eliminar el disparador y `#skip-link` funcionando.
- **`:has()` y el emparejamiento del diálogo**, más el título `sticky` del diálogo y el
  comportamiento de los botones al hacer scroll.
- **RNF-10**: consola limpia y ausencia de 404 con `npm start` en un navegador real.
- **Coma decimal en `#task-hours`** (`type="number"`) según el navegador.
- **Lectores de pantalla**: los anuncios de `aria-live` (`#task-count`, `#toast-region`,
  `#form-errors`) no se pudieron comprobar con tecnología de asistencia.
- **Pruebas de interfaz con DOM falso (`tests/app.test.js`, 15 pruebas)**: cubren el flujo
  funcional de la interfaz (crear, validar, editar, estados, eliminar, filtrar, ordenar,
  tema, XSS, fallo de guardado, exportar/importar, datos corruptos). **No** sustituyen a una
  pasada en navegador real: no hay CSS, ni layout, ni foco real, ni `File`/`FileList`, y el
  arranque automático de `src/app.js` no se ejecuta (ver el desvío declarado más arriba y
  los límites al final de `tests/helpers/fake-dom.js` y `tests/app.test.js`).
- **COV-01 (S2) cerrado**: `tests/app.test.js` importa `src/app.js` y carga el `index.html`
  real, así que los requisitos Must de interfaz ya tienen prueba ejecutable. Lo que queda
  por verificar en navegador es lo puramente visual y de accesibilidad (puntos anteriores).

**Puntos concretos a revalidar:** en navegador real, el orden de tabulación y `Escape` en los
diálogos, el foco tras eliminar la tarea disparadora, el `aria-live` con lector de pantalla y
la ausencia de scroll horizontal a 360 px. En el arnés ya quedan cubiertos RF-3 (cancelar no
borra / confirmar borra y anuncia), RF-4 (Iniciar → Completar → Reabrir con `completedAt` y
métricas) y el flujo completo de importación con confirmación de reemplazo, además de la
ausencia de mutación de argumentos en el dominio (pruebas unitarias).
