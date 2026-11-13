# Arquitectura — StudyFlow v1

- **Estado:** aprobado para implementación
- **Autor:** Architect
- **Fecha:** 12 nov 2026
- **Requisitos:** `docs/REQUIREMENTS.md`
- **Interfaz:** `docs/UI_SPEC.md`

## 1. Estilo y justificación

StudyFlow es una **SPA estática sin backend ni build step**: HTML, CSS y módulos
ES servidos tal cual por un servidor estático de Node. El estado vive en memoria
y se persiste en `localStorage`.

Razones:

- El brief exige funcionar offline, sin cuentas y sin dependencias de runtime.
- Los datos son de un solo usuario y de bajo volumen (≤ 500 tareas, ~150 KB).
- Sin build se elimina la cadena de herramientas y se puede auditar el código
  servido.
- Los módulos ES permiten separar dominio puro, persistencia y DOM, y probar los
  dos primeros con `node:test`.

Consecuencias: no hay sincronización, los datos se limitan al navegador y equipo,
y el almacenamiento puede fallar por cuota o bloqueo; se mitiga con respaldo,
aviso visible y exportación.

## 2. Módulos y dependencias

```text
index.html ──carga──► src/app.js
                         │ importa
                         ├──────────► src/domain.js
                         └──────────► src/storage.js ──importa──► src/domain.js

styles.css        presentación (tokens y componentes)
scripts/serve.mjs servidor estático de desarrollo
tests/            dominio, almacenamiento, integración y estructura
```

Dependencias permitidas (flecha = «puede importar»):

| Módulo | Puede importar | No puede importar | Responsabilidad |
| --- | --- | --- | --- |
| `src/domain.js` | nada | `storage`, `app`, DOM, `localStorage` | Reglas puras: validación, CRUD, fechas, métricas, filtros, orden, ejemplos. |
| `src/storage.js` | `domain` | `app`, DOM | Documento versionado, lectura/escritura, importación/exportación, tema. |
| `src/app.js` | `domain`, `storage` | — | Estado de interfaz, render, eventos, diálogos, toasts, tema. |
| `tests/**` | todos | — | Verificación. |

No se permiten importaciones circulares. `domain` debe poder importarse en Node
sin `document`, `window` ni `localStorage`.

## 3. Contratos

### 3.1 `src/domain.js`

#### Constantes y etiquetas

| Export | Tipo | Valor / contrato |
| --- | --- | --- |
| `TASK_STATUSES` | `readonly string[]` | `["pendiente", "en_progreso", "completada"]` |
| `TASK_PRIORITIES` | `readonly string[]` | `["alta", "media", "baja"]` |
| `TASK_TYPES` | `readonly string[]` | `["tarea", "examen", "proyecto", "lectura"]` |
| `SORT_OPTIONS` | `readonly string[]` | `["dueDate", "priority", "createdAt"]` |
| `STATUS_LABELS` | `Record<string,string>` | pendiente → «Pendiente», en_progreso → «En progreso», completada → «Completada» |
| `PRIORITY_LABELS` | `Record<string,string>` | alta → «Alta», media → «Media», baja → «Baja» |
| `TYPE_LABELS` | `Record<string,string>` | tarea → «Tarea», examen → «Examen», proyecto → «Proyecto», lectura → «Lectura» |
| `PRIORITY_WEIGHT` | `Record<string,number>` | `{ alta: 0, media: 1, baja: 2 }` |
| `LIMITS` | `object` | `{ title: 120, course: 60, notes: 500, estimatedHoursMax: 100, query: 80 }` |
| `DEFAULT_FILTERS` | `object` | `{ query: "", status: "", course: "", priority: "", type: "" }` |

Las constantes se congelan con `Object.freeze`. Los valores de enumeración van
en español porque son datos persistidos; los identificadores de código van en
inglés.

#### Errores

```js
class ValidationError extends Error {
  name = "ValidationError";
  field;   // "title" | "course" | "dueDate" | "estimatedHours" | "type" |
           // "priority" | "status" | "notes" | "id" | "document" | ...
  code;    // "required" | "too_long" | "invalid_enum" | "invalid_date" |
           // "out_of_range" | "invalid_document" | "invalid_task" | "duplicate_id"
  errors;  // Record<string,string> con todos los errores, o null
  constructor(message, { field = null, code = "validation", errors = null } = {})
}

class NotFoundError extends Error {
  name = "NotFoundError";
  id;
  constructor(id) // message: `No existe la tarea ${id}.`
}
```

`createTask` y `updateTask` lanzan `ValidationError` con `errors` completo.
`deleteTask` y `changeTaskStatus` lanzan `NotFoundError` si el `id` no existe.

#### Fechas

| Función | Entrada | Salida | Reglas |
| --- | --- | --- | --- |
| `toDateOnly(date)` | `Date` | `"YYYY-MM-DD"` | Usa año, mes y día **locales**; lanza `TypeError` si la fecha es inválida. |
| `parseDateOnly(value)` | `string` | `Date \| null` | Solo acepta `^\d{4}-\d{2}-\d{2}$` y que el round-trip de partes coincida; hora local a medianoche. `"2026-02-30"` → `null`. |
| `isValidDateOnly(value)` | `unknown` | `boolean` | `true` solo si es string y `parseDateOnly` no es `null`. |
| `addDays(dateOnly, days)` | `string`, `number` | `"YYYY-MM-DD"` | Suma días de calendario en hora local; cruza mes y año. |
| `formatDateEs(dateOnly)` | `string` | `string` | `""` → `""`; si no, `Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" })`. |

Regla absoluta: **nunca** `new Date("YYYY-MM-DD")`. Las comparaciones de fechas
de entrega se hacen entre strings `YYYY-MM-DD`, que ordenan lexicográficamente.

#### Validación y normalización

```js
validateTaskInput(input) -> { valid: boolean, errors: Record<string,string> }
```

- Valida solo campos editables: `title`, `course`, `type`, `status`,
  `priority`, `dueDate`, `estimatedHours`, `notes`.
- `title`: string recortado, obligatorio, ≤ 120. Mensaje:
  «El título es obligatorio.» / «El título no puede superar 120 caracteres.»
- `course`: string recortado, obligatorio, ≤ 60. Mensaje:
  «El curso es obligatorio.» / «El curso no puede superar 60 caracteres.»
- `type`/`status`/`priority`: deben pertenecer a su enum. Mensaje:
  «Selecciona un tipo válido.» (análogo para estado y prioridad).
- `dueDate`: `""` permitido; si no, `isValidDateOnly`. Mensaje:
  «Usa una fecha válida (AAAA-MM-DD).»
- `estimatedHours`: acepta number o string numérico con coma o punto; `""`,
  `null` o `undefined` → `0`; rango 0–100; redondeo a 2 decimales. Mensaje:
  «Las horas deben ser un número entre 0 y 100.»
- `notes`: string; recortado; ≤ 500. Mensaje:
  «Las notas no pueden superar 500 caracteres.»

```js
normalizeTask(raw) -> Task
```

- Acepta un objeto con la forma de `Task`; lanza `ValidationError` si no es
  objeto, si `id` no cumple `^tsk_[a-z0-9]{6,32}$` o si un campo obligatorio es
  inválido.
- Recorta `title`, `course`, `notes`; convierte `estimatedHours` numérico.
- Ignora campos desconocidos.
- Coherencia de estado: si `status === "completada"` y `completedAt` es nulo,
  usa `updatedAt` como `completedAt`; si el estado no es completada y hay
  `completedAt`, lo pone a `null`.
- `createdAt`/`updatedAt` deben ser strings ISO parseables; si `updatedAt` falta,
  usa `createdAt`.

#### CRUD y estado

```js
createTask(input, options = {}) -> Task
// options: { now = new Date(), idFactory = defaultIdFactory }
// Valida con validateTaskInput; aplica defaults; genera id, createdAt y updatedAt.

updateTask(task, patch, options = {}) -> Task
// options: { now = new Date() }
// Aplica solo title, course, type, status, priority, dueDate, estimatedHours, notes.
// Ignora id, createdAt, updatedAt y completedAt del patch.
// Si status pasa a completada y antes no lo era: completedAt = now ISO.
// Si status deja de ser completada: completedAt = null.
// Si ya era completada y sigue completada: conserva completedAt.
// Actualiza updatedAt.

deleteTask(tasks, id) -> Task[]
// Devuelve un arreglo nuevo sin la tarea; NotFoundError si no existe.

changeTaskStatus(tasks, id, status, options = {}) -> Task[]
// Valida el enum; delega en updateTask; devuelve arreglo nuevo.

findTask(tasks, id) -> Task | undefined
```

`defaultIdFactory()` exportada: devuelve `tsk_` + 12 caracteres
`[a-z0-9]`; usa `globalThis.crypto.randomUUID()` si existe y, si no,
`Date.now().toString(36)` + sufijo aleatorio. Inyectable en pruebas.

#### Métricas, filtros y orden

```js
computeStats(tasks, options = {}) -> Stats
// options: { today = new Date() }  (Date o string YYYY-MM-DD)
```

`Stats` exacto: `{ total, pending, inProgress, completed, overdue, upcoming7,
completionRate }`, con las reglas de RF-5. Todos enteros; `completionRate` 0–100.

```js
isOverdue(task, today) -> boolean
isUpcoming(task, today) -> boolean
// today: Date | "YYYY-MM-DD"
// overdue: no completada, dueDate !== "" y dueDate < hoy
// upcoming: no completada, dueDate >= hoy y dueDate <= addDays(hoy, 6)

filterTasks(tasks, filters = {}) -> Task[]
// filters se completa con DEFAULT_FILTERS.
// query: recorta, normaliza NFD, quita diacríticos y compara en minúsculas
//        contra title + course + notes.
// status/course/priority/type: igualdad exacta; "" = sin filtro.

getCourses(tasks) -> string[]
// Cursos recortados, únicos, ordenados con localeCompare("es").

sortTasks(tasks, sortBy = "dueDate") -> Task[]
// Devuelve un arreglo nuevo. sortBy desconocido → "dueDate".
// dueDate: ascendente; "" al final (clave "9999-12-31"); desempate prioridad,
//          createdAt ascendente, id.
// priority: PRIORITY_WEIGHT; desempate dueDate ascendente, createdAt, id.
// createdAt: descendente; desempate id.

selectTasks(tasks, { filters = {}, sortBy = "dueDate" } = {}) -> Task[]
// Equivale a sortTasks(filterTasks(tasks, filters), sortBy). No muta.
```

#### Datos de ejemplo

```js
createSampleTasks(options = {}) -> Task[]
// options: { now = new Date(), idFactory = defaultIdFactory }
```

Seis tareas, con fechas relativas a `now`:

| # | Título | Curso | Tipo | Prioridad | Vence | Horas | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Ensayo de historia | Historia | tarea | alta | hoy + 2 | 4 | pendiente |
| 2 | Examen de cálculo | Cálculo | examen | alta | hoy + 6 | 2 | pendiente |
| 3 | Proyecto de biología | Biología | proyecto | media | hoy + 12 | 8 | en_progreso |
| 4 | Lectura: El túnel | Literatura | lectura | baja | hoy + 4 | 1.5 | pendiente |
| 5 | Laboratorio de química | Química | tarea | media | hoy − 2 | 3 | pendiente (vencida) |
| 6 | Resumen de sociología | Sociología | tarea | media | hoy − 1 | 1 | completada |

Con hoy `2026-11-12`, las métricas esperadas son: total 6, pendientes 4, en
progreso 1, completadas 1, vencidas 1, próximas 7 días 3, avance 17 %.

### 3.2 `src/storage.js`

| Export | Valor / contrato |
| --- | --- |
| `STORAGE_KEY` | `"studyflow.tasks"` |
| `BACKUP_KEY` | `"studyflow.tasks.backup"` |
| `THEME_KEY` | `"studyflow.theme"` |
| `APP_ID` | `"studyflow"` |
| `SCHEMA_VERSION` | `1` |

```js
createMemoryStorage(initial = {}) -> StorageLike
// getItem(key) -> string|null; setItem(key, value) -> void (String);
// removeItem(key) -> void; dump() -> Record<string,string>.
// Para pruebas y como respaldo cuando localStorage no está disponible.

createSafeStorage(scope = globalThis) -> StorageLike
// Intenta scope.localStorage con una escritura/borrado de sonda.
// Si falla o no existe, devuelve createMemoryStorage().

parseDocument(rawText, { mode = "load" } = {}) -> {
  ok, tasks, version, skipped, error, code
}
// mode "load": descarta tareas inválidas y deduplica IDs (conserva la primera),
//              informando skipped.
// mode "import": rechaza el documento completo ante cualquier tarea inválida,
//                ID duplicado o forma incorrecta.
// Acepta envoltura { app, version, tasks } o un arreglo simple.
// Versión distinta de 1 → ok:false, code:"unsupported_version".
// JSON inválido → ok:false, code:"invalid_json".
// tasks no es arreglo → ok:false, code:"invalid_document".
```

```js
loadTasks(storage) -> {
  ok, tasks, source: "storage"|"empty"|"invalid", skipped, error, code
}
// Sin valor → { ok:true, tasks:[], source:"empty", skipped:0 }.
// Documento válido → source:"storage"; si skipped > 0, copia el valor crudo a
// BACKUP_KEY (mejor esfuerzo) antes de devolver.
// Documento inválido → copia el crudo a BACKUP_KEY y devuelve
// { ok:false, tasks:[], source:"invalid", error, code }.

saveTasks(storage, tasks, { now = new Date() } = {}) -> { ok, error, code }
// Serializa { app, version, updatedAt, tasks } y escribe STORAGE_KEY.
// Valida que tasks sea arreglo; si no, { ok:false, code:"invalid_document" }.
// Atrapa excepciones de cuota/seguridad → { ok:false, code:"storage_unavailable" }.
// No lanza.

exportTasks(tasks, { now = new Date() } = {}) -> { json, filename }
// Normaliza las tareas (lanza ValidationError si alguna es inválida).
// json: JSON.stringify(doc, null, 2) con { app, version, exportedAt, tasks }.
// filename: `studyflow-${toDateOnly(now)}.json`.

importTasks(jsonText, { now = new Date() } = {}) -> {
  ok, tasks, version, error, code
}
// Llama parseDocument(jsonText, { mode: "import" }). No escribe almacenamiento.

clearTasks(storage) -> { ok, error }
// removeItem(STORAGE_KEY); no toca BACKUP_KEY ni THEME_KEY.

loadTheme(storage) -> "light"|"dark"|null
saveTheme(storage, theme) -> { ok, error }
// Ignora valores distintos de "light"/"dark".
```

Códigos de error estables para pruebas: `invalid_json`, `unsupported_version`,
`invalid_document`, `invalid_task`, `duplicate_id`, `storage_unavailable`,
`invalid_theme`.

### 3.3 `src/app.js`

```js
initApp(options = {}) -> { refresh(), destroy() }
// options: {
//   doc = document,
//   storage = createSafeStorage(),
//   now = () => new Date(),
//   idFactory = defaultIdFactory
// }
```

`initApp` se invoca una vez al cargar el módulo (`DOMContentLoaded` o inmediato
si el documento ya está listo) y devuelve un controlador para pruebas manuales.

Estado interno:

```js
{
  tasks: Task[],
  filters: { ...DEFAULT_FILTERS },
  sortBy: "dueDate",
  editingId: null,
  theme: "light" | "dark",
  storageOk: boolean
}
```

Arranque:

1. Resolver `storage` y tema: `loadTheme(storage)`; si es `null`, usar
   `matchMedia("(prefers-color-scheme: dark)")`; aplicar
   `documentElement.dataset.theme`.
2. `loadTasks(storage)`:
   - `source === "empty"` → `tasks = createSampleTasks({ now: now() })` y
     `saveTasks`.
   - `source === "invalid"` → `tasks = createSampleTasks`, `saveTasks`, toast de
     error («No se pudieron leer tus datos; se guardó una copia y se cargaron
     ejemplos.»).
   - `source === "storage"` con `skipped > 0` → toast de advertencia y
     `saveTasks` de la versión limpia.
   - `saveTasks` falla → `storageOk = false`, mostrar `#storage-warning`.
3. Render inicial completo y enlace de eventos.

Render por regiones (no se recrean los controles de filtro mientras se escribe):

| Región | Se actualiza cuando |
| --- | --- |
| `#stat-*`, `#progress-bar` | cambian las tareas |
| `#filter-course` y `#course-options` | cambian las tareas (conserva selección; si el curso desaparece, vuelve a `""`) |
| `#task-list`, `#task-count`, `#empty-state` | cambian tareas, filtros u orden |
| `#storage-note` | cambian las tareas o el último guardado |
| Toasts | eventos de éxito/error |

Acciones y eventos:

- Delegación de clic en `#task-list`: `data-action` ∈
  `edit | delete | start | pause | complete | reopen`, con `data-id`.
- `#btn-new-task` y `#btn-empty-action`: abrir diálogo vacío.
- `#filters-form` (`input` y `change`): actualizar `filters`; la búsqueda se
  debounce a 200 ms; re-render de lista y contador.
- `#sort-by`: actualizar `sortBy` y re-render de lista.
- `#btn-clear-filters`: `filters = { ...DEFAULT_FILTERS }`; conserva `sortBy`.
- `#theme-toggle`: alternar, `saveTheme`, actualizar `aria-pressed` y etiqueta.
- `#btn-export`: `exportTasks` → `Blob` → `<a download>` → revocar URL → toast.
- `#btn-import` → clic en `#import-file`; al cambiar, leer con `file.text()`
  (rechazar > 2 MB), `importTasks`; si falla, toast de error; si funciona, abrir
  confirmación con el conteo y, al aceptar, reemplazar, `saveTasks`, render,
  toast. Limpiar `input.value` al final.
- `#btn-reset`: confirmación → `clearTasks` → `createSampleTasks` → `saveTasks`
  → render → toast.
- Diálogo de tarea: `showModal()`, foco en `#task-title`, `Escape` cancela,
  validación en `submit`, errores por campo y resumen en `#form-errors`.
- Confirmación: `showModal()`, foco en Cancelar, `Escape` cancela; devuelve
  `Promise<boolean>` internamente.

Cada mutación sigue el mismo orden: **calcular → persistir → renderizar →
anunciar**. Si `saveTasks` falla, se conserva el estado en memoria, se marca
`storageOk = false`, se muestra `#storage-warning` y un toast de error; no se
revierte la mutación.

### 3.4 Contrato del DOM (`index.html`)

Obligatorio para que Tester pueda verificar estructura sin ambigüedad:

| ID | Elemento | Requisitos |
| --- | --- | --- |
| `skip-link` | `a` | `href="#main"`, primer elemento enfocable, visible al foco. |
| `app-title` | `h1` | Único `h1`: «StudyFlow». |
| `theme-toggle` | `button` | `type="button"`, `aria-pressed`, etiqueta «Cambiar a tema oscuro/claro». |
| `btn-new-task` | `button` | Acción primaria «Nueva tarea». |
| `main` | `main` | `id="main"`, landmark principal. |
| `dashboard` | `section` | `aria-labelledby="dashboard-title"`; `h2` con ese id. |
| `stat-total`, `stat-pending`, `stat-in-progress`, `stat-completed`, `stat-overdue`, `stat-upcoming`, `stat-progress` | texto | Valores numéricos; `stat-progress` incluye «%». |
| `progress-bar` | `progress` | `max="100"`, `value` sincronizado, `aria-labelledby`. |
| `tasks-title` | `h2` | «Tareas». |
| `task-count` | texto | `aria-live="polite"`; «N tareas» tras filtrar. |
| `filters-form` | `form` | `role="search"`, `aria-label="Buscar y filtrar tareas"`. |
| `search-input` | `input` | `type="search"`, `maxlength="80"`, label visible. |
| `filter-status` | `select` | Opciones: Todos, Pendiente, En progreso, Completada. |
| `filter-course` | `select` | «Todos los cursos» + cursos derivados. |
| `filter-priority` | `select` | Todas, Alta, Media, Baja. |
| `filter-type` | `select` | Todos, Tarea, Examen, Proyecto, Lectura (Should). |
| `sort-by` | `select` | Fecha de entrega, Prioridad, Más recientes. |
| `btn-clear-filters` | `button` | «Limpiar filtros». |
| `task-list` | `ul` | Tarjetas en `li > article`. |
| `empty-state` | `section` | `hidden` cuando hay resultados; `empty-title`, `empty-message`, `btn-empty-action`. |
| `toast-region` | `div` | `role="status"`, `aria-live="polite"`, `aria-atomic="false"`. |
| `storage-note` | texto | «N tareas · guardado a las HH:MM». |
| `storage-warning` | `div` | `role="status"`, oculto por defecto; aviso persistente de fallo de guardado. |
| `btn-export` | `button` | «Exportar JSON». |
| `btn-import` | `button` | «Importar JSON»; activa `import-file`. |
| `import-file` | `input` | `type="file"`, `accept="application/json,.json"`, oculto. |
| `btn-reset` | `button` | «Restablecer datos». |
| `task-dialog` | `dialog` | `aria-labelledby="task-dialog-title"`. |
| `task-dialog-title` | `h2` | «Nueva tarea» / «Editar tarea». |
| `task-form` | `form` | `novalidate`; campos con `label` y errores asociados. |
| `task-id` | `input` | `type="hidden"`. |
| `task-title`, `task-course`, `task-type`, `task-due-date`, `task-priority`, `task-status`, `task-hours`, `task-notes` | campos | Ver UI spec; `task-course` con `list="course-options"`. |
| `course-options` | `datalist` | Opciones de cursos existentes. |
| `task-title-error`, `task-course-error`, `task-due-date-error`, `task-hours-error`, `task-type-error`, `task-priority-error`, `task-status-error`, `task-notes-error` | `p` | Vacíos sin error; enlazados con `aria-describedby`. |
| `form-errors` | `div` | `aria-live="polite"`; resumen de errores. |
| `btn-save-task`, `btn-cancel-task` | `button` | Guardar (submit) y Cancelar. |
| `confirm-dialog` | `dialog` | `aria-labelledby="confirm-title"`, `aria-describedby="confirm-message"`. |
| `confirm-title`, `confirm-message`, `btn-confirm`, `btn-cancel-confirm` | — | Confirmación genérica para eliminar, importar y restablecer. |

Tarjetas: `article.task-card` con `data-id`, `data-status`, `data-priority`,
`data-overdue`, título en `h3.task-card__title`; acciones `button` con
`data-action` y `data-id`.

### 3.5 `styles.css`

- Tokens en `:root` y sobrescritura en `[data-theme="dark"]`.
- Breakpoints `min-width: 768px` y `min-width: 1280px`; base mobile-first.
- Sin `!important` salvo utilidades de accesibilidad.
- Foco con `:focus-visible` y anillo de 3 px + offset 2 px.
- `@media (prefers-reduced-motion: reduce)` desactiva transiciones y animaciones.
- Sin `outline: none` sin reemplazo.

### 3.6 `scripts/serve.mjs`

- Servidor `node:http` en `PORT` (por defecto `4173`), raíz del repositorio.
- Solo `GET`/`HEAD`; 404 para el resto.
- Resuelve rutas con `path.resolve` y rechaza traversal fuera de la raíz.
- MIME: `.html`, `.css`, `.js`, `.json`, `.svg`, `.ico`; `charset=utf-8` para
  texto.
- `Cache-Control: no-store`; `/` sirve `index.html`; log de método y ruta.

## 4. Flujo de datos

```text
Arranque
  loadTheme ──► dataset.theme
  loadTasks ──► tasks ──► (vacío/corrupto) createSampleTasks ──► saveTasks
      │
      ▼
  renderStats / renderCourses / renderList / renderFooter
      │
Usuario ──► evento ──► domain (create/update/delete/changeStatus/filter/sort)
      │
      ▼
  nuevo estado inmutable ──► saveTasks ──► render por regiones ──► aria-live
```

Invariantes:

1. `domain` nunca conoce el DOM ni el almacenamiento.
2. `app` nunca implementa reglas de negocio: delega en `domain`.
3. `storage` nunca conoce el DOM.
4. Toda escritura pasa por `saveTasks`; toda lectura externa pasa por
   `normalizeTask` o `parseDocument`.
5. La fuente de verdad es `tasks` en memoria; los filtros y el orden son estado
   de interfaz derivado.

## 5. Persistencia versionada

```json
{
  "app": "studyflow",
  "version": 1,
  "updatedAt": "2026-11-12T15:04:05.000Z",
  "tasks": []
}
```

- **Versión 1** es la única soportada. Una versión distinta se rechaza sin
  sobrescribir: el valor crudo se copia a `studyflow.tasks.backup` y la app
  arranca con ejemplos.
- **Migraciones:** no se implementan en v1. Cuando exista v2, se añadirá
  `migrateDocument(doc)` en `storage.js` y se actualizará este documento y la
  matriz de pruebas.
- **Respaldo:** se escribe en `BACKUP_KEY` cuando el documento es inválido o
  cuando se descartaron tareas. Es la única recuperación manual; no hay UI de
  restauración en v1.
- **Fallos de escritura:** `saveTasks` no lanza; devuelve `ok:false`. La app
  conserva el estado en memoria y avisa.
- **Límite práctico:** 500 tareas (~150 KB) muy por debajo de la cuota típica de
  5 MB. No se implementa compresión.

## 6. Decisiones de arquitectura (ADR)

### ADR-001 — SPA estática sin backend ni build

- **Contexto:** el brief exige offline, sin cuentas y sin dependencias.
- **Decisión:** HTML/CSS/módulos ES servidos directamente; `localStorage` como
  única persistencia.
- **Consecuencias:** despliegue trivial y auditoría simple; sin sincronización ni
  multiusuario. Los datos se pierden si el usuario limpia el navegador.

### ADR-002 — Dominio puro, almacenamiento inyectable, UI delgada

- **Contexto:** se necesita probar reglas sin navegador y evitar acoplamiento.
- **Decisión:** `domain.js` sin efectos; `storage.js` recibe un `StorageLike`;
  `app.js` solo orquesta.
- **Consecuencias:** pruebas rápidas y deterministas; la UI no puede saltarse la
  validación sin romper el contrato.

### ADR-003 — Fechas date-only como strings locales

- **Contexto:** `new Date("YYYY-MM-DD")` interpreta UTC y desplaza el día en
  zonas negativas.
- **Decisión:** `dueDate` es `"YYYY-MM-DD"` o `""`; se compara como string y se
  convierte con `parseDateOnly`/`toDateOnly` en hora local.
- **Consecuencias:** sin desfase UTC; los cálculos de «hoy» y «+6 días» usan
  `addDays` y son testeables con un reloj fijo.

### ADR-004 — Documento versionado con respaldo y rechazo de versiones futuras

- **Contexto:** el esquema cambiará y no se debe corromper datos.
- **Decisión:** envoltura `{ app, version, updatedAt, tasks }`; versión distinta
  de 1 se rechaza y se respalda el crudo.
- **Consecuencias:** recuperación manual posible; una versión futura no se
  sobrescribe silenciosamente.

### ADR-005 — Filtros y orden en el dominio

- **Contexto:** la UI necesita lista visible y métricas consistentes.
- **Decisión:** `filterTasks`, `sortTasks` y `selectTasks` son puras y probadas;
  la UI solo guarda `filters` y `sortBy`.
- **Consecuencias:** una sola definición de búsqueda/orden; la UI no duplica
  reglas.

### ADR-006 — Render por regiones con estado único

- **Contexto:** un re-render completo en cada tecla rompería el foco de la
  búsqueda.
- **Decisión:** render granular de métricas, cursos, lista/contador y pie; los
  controles de filtro no se recrean.
- **Consecuencias:** foco estable y rendimiento aceptable; exige disciplinar qué
  región se actualiza en cada evento.

### ADR-007 — `<dialog>` nativo

- **Contexto:** se necesitan modales accesibles sin dependencias.
- **Decisión:** `<dialog>` + `showModal()` para formulario y confirmación, con
  foco inicial, trampa de Tab propio si el navegador no la garantiza, `Escape`
  para cancelar y restauración de foco.
- **Consecuencias:** semántica y backdrop nativos; hay que gestionar el foco y el
  descarte explícitamente.

### ADR-008 — Restablecer vuelve a los ejemplos

- **Contexto:** el brief pide datos de ejemplo y restablecimiento, pero no define
  el estado final.
- **Decisión:** restablecer borra las tareas y siembra los seis ejemplos, previa
  confirmación.
- **Consecuencias:** estado demostrable y reversible; el usuario que quiera vacío
  puede eliminar las tareas.

### ADR-009 — Importar reemplaza, no fusiona

- **Contexto:** fusionar exige reglas de duplicados y conflictos no pedidas.
- **Decisión:** la importación válida reemplaza la colección tras confirmación;
  la inválida no toca nada.
- **Consecuencias:** restauración de respaldos simple y atómica; el usuario debe
  exportar antes si quiere conservar lo actual.

### ADR-010 — Tema con `data-theme` y bootstrap inline

- **Contexto:** evitar destello de tema y permitir preferencia explícita.
- **Decisión:** `data-theme` en `<html>`, script mínimo en `<head>` que lee
  `studyflow.theme` o `prefers-color-scheme`, y tokens semánticos por tema.
- **Consecuencias:** sin flash; el script inline debe ser corto y tolerante a
  errores de almacenamiento.

## 7. Riesgos técnicos y mitigaciones

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| `localStorage` bloqueado, ausente o sin cuota | Pérdida de persistencia (S1) | `createSafeStorage` con fallback en memoria; `#storage-warning`; exportación disponible; pruebas con almacenamiento que lanza. |
| Documento corrupto o versión futura | Pérdida de datos (S1) | Respaldo en `BACKUP_KEY` antes de sembrar; aviso explícito; pruebas de corrupción y versión. |
| Desfase de fechas por UTC | Métricas y vencidas incorrectas (S2) | Strings date-only, `parseDateOnly` local, reloj inyectado, pruebas de hoy/ayer/±6/±7. |
| XSS por `innerHTML` | Ejecución de scripts (S1) | Solo `textContent` para datos; prohibido `innerHTML` con entrada; prueba con título HTML. |
| Foco atrapado o perdido en diálogos | Bloqueo de teclado (S2) | Foco inicial, ciclo de Tab, `Escape`, restauración al disparador; auditoría manual. |
| Re-render completo en cada tecla | Pérdida de foco y lentitud (S2) | Render por regiones y debounce de 200 ms en búsqueda. |
| Multitar sobrescribe datos | Pérdida de cambios (S2) | Fuera de alcance declarado; última escritura gana; exportación como respaldo. |
| Ejemplos con fechas fijas envejecen | Métricas confusas (S3) | Fechas relativas a `now` al sembrar. |
| Importación accidental reemplaza todo | Pérdida de datos (S2) | Confirmación con conteo; validación atómica; exportación previa sugerida. |
| `dialog` o `file.text()` no disponibles | Flujo roto (S3) | Navegadores objetivo evergreens; sin polyfills por la restricción de dependencias. |
| `Intl` con locale distinto en Node | Pruebas frágiles (S4) | Locale fijo `es-MX`; no se prueba el texto exacto del formato salvo que sea estable. |
| 500 tareas y re-render | Lentitud percibida (S3) | Presupuesto de 50 ms en dominio y 100 ms de render; render granular. |

## 8. Estrategia de pruebas

### Niveles

| Nivel | Archivo previsto | Qué cubre |
| --- | --- | --- |
| Unidad de dominio | `tests/domain.test.js` | Validación, defaults, CRUD, inmutabilidad, `completedAt`, fechas, IDs, ejemplos, XSS como texto. |
| Unidad de métricas | `tests/metrics.test.js` | Conteos, vencidas, próximas 7 días, porcentaje, ejemplos. |
| Unidad de filtros/orden | `tests/filters.test.js` | Búsqueda con acentos, combinación de filtros, tres órdenes, cursos, inmutabilidad. |
| Unidad de almacenamiento | `tests/storage.test.js` | Round-trip, envoltura, vacío, corrupción, versión, importación estricta, duplicados, exportación, tema, fallo de escritura. |
| Integración | `tests/integration.test.js` | Crear → filtrar → completar → métricas → exportar → importar; reset. |
| Estructura/estática | `tests/markup.test.js` | IDs, labels, un `h1`, `aria-live`, sin recursos externos, viewport y media queries. |
| Rendimiento | `tests/performance.test.js` | 500 tareas en `computeStats + filterTasks + sortTasks` < 50 ms. |
| Smoke | `npm run check`, `npm start` | Sintaxis y carga sin 404. |

### Infraestructura de pruebas

- `tests/helpers/fakes.js`:
  - `createMemoryStorage(initial)` con `getItem`, `setItem`, `removeItem`,
    `dump` y una variante que lanza al escribir.
  - `NOW = new Date(2026, 10, 12, 9, 0, 0)` (12 nov 2026, hora local).
  - `seqIdFactory()` que devuelve `tsk_test01`, `tsk_test02`, …
- Sin red, sin reloj real y sin `Math.random` sin inyectar.
- Datos de fecha: vencida `2026-11-11`, hoy `2026-11-12`, próxima `2026-11-15`,
  límite `2026-11-18`, fuera `2026-11-19`, lejana `2026-12-01`.
- Comandos: `npm test`, `npm run check`; subconjunto con
  `node --test tests/domain.test.js`.

### Criterio de salida

- ≥ 30 pruebas en verde y 100 % de RF Must trazados.
- `npm run check` en verde.
- `npm start` sirve la app sin 404.
- Cero S1/S2 abiertos antes de aprobar.

## 9. Convenciones de implementación

- Nombres de código en inglés; textos de interfaz en español.
- Sin `var`, sin `==`, sin mutación de argumentos; `toSorted` o copia + `sort`.
- Validación en todas las fronteras: formulario, JSON importado y
  `localStorage`.
- `textContent` para datos del usuario; nunca `innerHTML` con entrada.
- IDs y reloj inyectables en todas las funciones con efectos de tiempo.
- Un módulo, una responsabilidad; sin dependencias nuevas.
- Cada bug corregido añade una prueba de regresión con nombre descriptivo.
