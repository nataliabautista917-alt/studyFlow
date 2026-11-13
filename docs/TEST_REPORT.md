# Reporte de verificación — StudyFlow v1

- **Agente:** Tester (`.opencode/agents/tester.md`)
- **Fecha:** 12 nov 2026
- **Skills usadas:** `testing` (matriz requisito → prueba, recetas `node:test`,
  formato de reporte de bug) y `requirements-analysis` (verificación contra
  criterios de aceptación, no contra la implementación).
- **Alcance:** verificación independiente de `docs/REQUIREMENTS.md` (RF-1…RF-10,
  AC-01…AC-26, RNF-1…RNF-10) sobre `src/`, `index.html`, `styles.css` y `tests/`.
- **Veredicto:** **RECHAZADO** — no verificable en este runtime **y** con un
  hallazgo **S2** abierto (cobertura de requisitos Must de interfaz, ver COV-01).

> **Nota sobre skills:** la herramienta `skill` no está expuesta en este runtime;
> las skills se leyeron directamente del repositorio
> (`.opencode/skills/testing/SKILL.md` + `references/test-matrix.md`,
> `references/node-test-recipes.md`, `templates/bug-report.md`, y
> `.opencode/skills/requirements-analysis/SKILL.md`), igual que documentó el
> Developer en `docs/DEVELOPMENT_LOG.md` §Nota sobre skills.

---

## 1. Resumen ejecutivo

1. **Ningún comando se pudo ejecutar.** Este runtime no expone ninguna herramienta
   de shell: el catálogo completo son 59 herramientas de los servidores `blender`,
   `browser` y `opencode` (se verificó con `search` sobre «shell», «bash»,
   «terminal», «command», «npm», «node», «subprocess», «git» → 0 resultados).
   Sin shell no hay `npm run check`, `npm test` ni `npm start`, y sin navegador
   conectado tampoco hay smoke de interfaz. Por la regla del rol («no se declara
   aprobado nada sin comando ejecutado y salida observada»), **el veredicto no
   puede ser APROBADO**.
2. **La verificación fue estática y por lectura de código**, con `grep`/`read`
   sobre los archivos versionados. Se confirmaron muchas conductas correctas
   (fechas, redondeo, búsqueda sin acentos, atomicidad de la importación, XSS
   como texto, no mutación), pero **no** se puede afirmar que la suite esté en
   verde: no se ejecutó.
3. **Se añadió una suite adversarial** `tests/regression.test.js` con 33 pruebas
   activas + 8 `test.skip` que documentan los defectos BUG-01…BUG-08. Los `skip`
   son la conducta exigida por el contrato; al corregir cada bug debe quitarse el
   `.skip` y la prueba debe pasar. No se modificó ninguna prueba existente.
4. **Hallazgo S2 abierto (COV-01):** ninguna prueba de `tests/` importa ni
   ejecuta `src/app.js` (solo `markup.test.js` lo lee como texto). Eso deja sin
   prueba ejecutable varios Must de interfaz (RF-3 confirmación, RF-4 en la UI,
   AC-21, AC-22, AC-25 renderizado, AC-26 aviso de guardado). RNF-8 («100 % de
   requisitos Must con al menos una prueba») **no se cumple** en su mitad de UI.
5. **Hallazgos de dominio y almacenamiento** BUG-01…BUG-08 (S3/S4): ninguno
   destruye datos por sí solo, pero BUG-05 (no se valida `app`) y BUG-07 (cursos
   duplicados por capitalización) incumplen contratos explícitos de
   `docs/REQUIREMENTS.md` §5.3 y §8 caso 7.

---

## 2. Entorno y comandos

| Dato | Valor |
| --- | --- |
| Sistema operativo | `win32` (Windows), workspace `C:\Users\samyl\OneDrive\Documentos\gestorTareas` |
| Node.js | **desconocido** — sin shell no se pudo leer `node --version` (RNF-3/RNF-5 exigen Node ≥ 20; **no verificado**) |
| npm | **desconocido** — no verificable |
| Herramientas disponibles | `blender.*`, `browser.*`, `opencode.*` (59 en total) |
| Herramientas de shell | **ninguna** |
| Navegador de la sesión | **desconectado** — `browser.tabs.list` → `[browser.disconnected] No desktop browser is connected to this session.` |
| Blender (MCP) | no disponible — `get_addon_status` → «Could not connect to Blender…» (irrelevante para esta tarea) |

### Comandos exigidos y su estado

| Comando | Estado | Salida observada |
| --- | --- | --- |
| `npm run check` | **NO EJECUTADO** | No existe herramienta de shell en el catálogo. |
| `npm test` | **NO EJECUTADO** | No existe herramienta de shell en el catálogo. |
| `npm start` (+ smoke de navegador) | **NO EJECUTADO** | `browser.tabs.open` → `[browser.disconnected]`; `fetch("http://localhost:4173/")` → «Unable to connect»; `file://` rechazado por `browser.tabs.open`. |

> **Consecuencia:** todo resultado de la §4 y la §6 es **inspección estática**,
> no ejecución. Las casillas «verde» describen lo que el código *debería* hacer
> según su lectura, no una salida observada de `node:test`.

---

## 3. Conteo de pruebas

Conteo por inspección de los archivos (`grep` de `^test(` sobre `tests/`), no por
ejecución:

| Archivo | Pruebas declaradas | Estado de ejecución |
| --- | --- | --- |
| `tests/domain.test.js` | 20 | no ejecutado |
| `tests/metrics.test.js` | 9 | no ejecutado |
| `tests/filters.test.js` | 9 | no ejecutado |
| `tests/storage.test.js` | 18 | no ejecutado |
| `tests/integration.test.js` | 5 | no ejecutado |
| `tests/markup.test.js` | 10 | no ejecutado |
| `tests/performance.test.js` | 3 | no ejecutado |
| **Subtotal antes del Tester** | **74** | — |
| `tests/regression.test.js` (nuevo) | 33 activas + 8 `skip` = 41 | no ejecutado |
| **Total después del Tester** | **115** (74 previas + 41 nuevas) | — |

- **Antes:** 74 (coincide con lo declarado por el Developer; conteo verificado
  estáticamente, **resultado de la suite no verificado**).
- **Después:** 115 declaradas; 33 nuevas activas y 8 nuevas en `skip`. Las 8 en
  `skip` **no** cuentan como cobertura mientras el bug siga abierto.
- RNF-8 pide ≥ 30 pruebas: el conteo declarado lo cumple; **no se pudo ejecutar
  para confirmar 0 fallos**.

---

## 4. Resultados por requisito (verificación estática)

Leyenda: **OK** = lectura de código coherente con el criterio · **HUECO** = sin
prueba ejecutable o no verificable sin navegador · **BUG** = defecto confirmado
por lectura.

| Requisito | Criterios | Evidencia revisada | Resultado |
| --- | --- | --- | --- |
| RF-1 Crear con validación | AC-01,02,03,23,24 | `domain.js` `createTask`/`validateTaskInput`; `regression.test.js` límites 120/121, 60/61, 500/501, horas | OK |
| RF-2 Editar sin tocar `id`/`createdAt` | AC-04,05 | `domain.js` `updateTask` (líneas 446-497) | BUG-01/02/03 (S4) |
| RF-3 Eliminar con confirmación | AC-06 | `domain.js` `deleteTask` OK; confirmación solo en `app.js` | **HUECO** (UI sin prueba) |
| RF-4 Cambiar estado y `completedAt` | AC-07 | `domain.js` `changeTaskStatus`; `regression.test.js` estado inválido | OK (dominio) / **HUECO** (UI) |
| RF-5 Métricas | AC-08,09,10 | `domain.js` `computeStats`; `regression.test.js` borde hoy/ayer/hoy+6/hoy+7, redondeo .5 | BUG-06 (S4) |
| RF-6 Buscar/filtrar/ordenar | AC-11,12,13 | `domain.js` `filterTasks`/`sortTasks`/`getCourses`; `regression.test.js` acentos y regex | BUG-07 (S3), BUG-08 (S4) |
| RF-7 Persistencia y corrupción | AC-14,15 | `storage.js` `loadTasks`/`saveTasks`/`parseDocument` | OK (salvo BUG-05 en el camino de carga) |
| RF-8 Importar/exportar atómico | AC-16,17,18 | `storage.js` `importTasks`/`exportTasks`; `regression.test.js` atómico y versiones | BUG-05 (S3) |
| RF-9 Datos de ejemplo | AC-19 | `domain.js` seed; `integration.test.js` reset | OK (no ejecutado) |
| RF-10 Tema | AC-20 | `storage.js` tema; script inline en `index.html`; `markup.test.js` | OK (estático) / **HUECO** (toggle en `app.js`) |
| RNF-1 Accesibilidad | AC-21,25 | `index.html` labels, `aria-live`; `markup.test.js`; `domain.js` XSS | Parcial: estructura OK, teclado/foco **HUECO** |
| RNF-2 Responsive | AC-22 | `styles.css` media queries 768/1280; `markup.test.js` | Parcial: 360 px real **HUECO** |
| RNF-3 Rendimiento | — | `performance.test.js` (500 tareas < 50 ms) | No ejecutado |
| RNF-4 Integridad | AC-14,15,18,26 | `storage.js` + `integration.test.js` + `regression.test.js` | OK (estático) |
| RNF-5 Compatibilidad | — | módulos ES, sin dependencias (`markup.test.js`) | OK estático; `npm run check` no ejecutado |
| RNF-6 Privacidad/offline | — | `markup.test.js` (sin fetch/XHR/URLs externas) | OK estático |
| RNF-7 Dominio puro | — | `markup.test.js` (domain sin `document`/`window`/`localStorage`) | OK estático |
| RNF-8 Pruebas | — | 74 declaradas ≥ 30; cobertura Must | **BUG/COV-01 (S2)**: Must de UI sin prueba |
| RNF-9 Idioma | — | revisión de textos | OK (manual) |
| RNF-10 Arranque limpio | — | `npm start` + navegador | **HUECO** (no verificable) |

---

## 5. Bugs y hallazgos

Todos se **confirmaron por lectura de código** (no por ejecución). No se corrigió
ninguno: los `test.skip` de `tests/regression.test.js` fijan la conducta exigida.

### BUG-01 — `updateTask` con `notes: undefined` lanza `TypeError` — **S4**

- **Dónde:** `src/domain.js`, línea 492 (`notes: draft.notes.trim()`).
- **Qué pasa:** el patch se toma *literal* (`hasOwnProperty`), así que
  `{ notes: undefined }` deja `draft.notes === undefined`; `validateTaskInput`
  lo tolera (`notes ?? ""`), pero el `return` hace `.trim()` sobre `undefined`.
- **Esperado (contrato):** `notes` ausente/vacío → `""` (como hace `createTask`
  con `source.notes ?? ""`, línea 401).
- **Obtenido:** excepción `TypeError: Cannot read properties of undefined
  (reading 'trim')`, no un `ValidationError`.
- **Evidencia:** líneas 455-461 (patch literal) + 492; prueba
  `regression.test.js` › `BUG-01 updateTask con notes undefined no debe lanzar TypeError` (`skip`).

### BUG-02 — `updateTask` con `dueDate: undefined` devuelve `undefined` — **S4**

- **Dónde:** `src/domain.js`, línea 490.
- **Qué pasa:** el `return` propaga `draft.dueDate` sin normalizar; con
  `undefined` la tarea resultante tiene `dueDate: undefined` en vez de `""`.
- **Esperado:** `dueDate` es `string` (`""` o `YYYY-MM-DD`), §5.2.
- **Obtenido:** `typeof updated.dueDate === "undefined"`; al persistir,
  `JSON.stringify` elimina la clave y el documento queda sin `dueDate`.
- **Evidencia:** línea 490; prueba `BUG-02` (`skip`).

### BUG-03 — `updateTask` con `estimatedHours: undefined` borra las horas — **S4**

- **Dónde:** `src/domain.js`, línea 491 (`parseEstimatedHours(draft.estimatedHours) ?? 0`).
- **Qué pasa:** un patch con la clave presente y valor `undefined` resetea las
  horas a `0` en lugar de conservar el valor previo.
- **Esperado:** conservar las horas de la tarea (el patch no cambia el campo).
- **Obtenido:** `estimatedHours === 0`.
- **Evidencia:** línea 491; prueba `BUG-03` (`skip`).

### BUG-04 — `createTask` no valida el patrón `^tsk_[a-z0-9]{6,32}$` — **S4**

- **Dónde:** `src/domain.js`, líneas 414-420.
- **Qué pasa:** solo comprueba `typeof id === "string" && id !== ""`; con un
  `idFactory` inyectado que devuelva `"malo"`, `createTask` **crea** la tarea,
  pero `normalizeTask` (línea 305) la rechazaría después → en la siguiente carga
  se descarta silenciosamente (con respaldo).
- **Esperado:** `createTask` debería rechazar un id que no cumpla el patrón (§5.2).
- **Obtenido:** no lanza; el id inválido entra al estado.
- **Riesgo real:** bajo — `defaultIdFactory` (línea 378) siempre produce un id
  válido; solo afecta a llamadas con `idFactory` propio.
- **Evidencia:** líneas 414-420 vs 305; prueba `BUG-04` (`skip`).

### BUG-05 — `parseDocument` nunca valida `app === "studyflow"` — **S3**

- **Dónde:** `src/storage.js`, `parseDocument` (líneas 94-166). `APP_ID` solo se
  **escribe** (líneas 110, 238, 279); en lectura no se compara.
- **Qué pasa:**
  - **Importación:** un archivo `{ app: "otra-app", version: 1, tasks: [...] }`
    se acepta y (tras la confirmación) **reemplaza** la colección.
  - **Carga:** un documento ajeno con `version: 1` y un arreglo `tasks` en
    `studyflow.tasks` se trata como **válido** (`source: "storage"`), sin respaldo
    ni aviso — en vez de considerarse corrupto como exige §5.3 (`app` es literal
    `"studyflow"`).
- **Esperado:** rechazar documentos cuyo `app` no sea `"studyflow"`.
- **Obtenido:** se aceptan.
- **Mitigación existente:** en importación hay diálogo de confirmación de
  reemplazo; en carga, no hay ninguna.
- **Evidencia:** `storage.js` líneas 94-166 (sin referencia a `document.app`),
  `grep` de `app` en `storage.js`; prueba `BUG-05` (`skip`).

### BUG-06 — `computeStats` infla `total` con entradas que no son tareas — **S4**

- **Dónde:** `src/domain.js`, línea 580 (`const total = list.length`).
- **Qué pasa:** el bucle ignora entradas no-objeto (línea 572) pero `total`
  cuenta todos los elementos → `computeStats([null, tarea]).total === 2`.
- **Esperado:** `total` = número de tareas (las no-tareas no deberían llegar al
  estado; el almacenamiento valida antes).
- **Obtenido:** total inflado; `completionRate` queda subestimado.
- **Nota:** el Developer ya lo documentó como observación
  (`docs/DEVELOPMENT_LOG.md` §Desvíos, punto 6) y lo dejó **sin** fijar en prueba.
- **Evidencia:** líneas 571-581; prueba `BUG-06` (`skip`).

### BUG-07 — `getCourses` deduplica distinguiendo mayúsculas — **S3**

- **Dónde:** `src/domain.js`, `getCourses` (líneas 614-625) usa un `Set` con la
  cadena tal cual.
- **Qué pasa:** con `Historia` y `historia`, el `<select>` de cursos muestra dos
  opciones distintas.
- **Esperado:** §8 caso 7 pide tratar el «curso repetido con distinta
  capitalización» en la lista de filtros.
- **Obtenido:** `getCourses([{course:"Historia"},{course:"historia"}])` devuelve
  `["Historia","historia"]`.
- **Evidencia:** líneas 616-624; prueba `BUG-07` (`skip`).

### BUG-08 — `dueDateKey` hace empatar `9999-12-31` con las tareas sin fecha — **S4**

- **Dónde:** `src/domain.js`, línea 19 (`NO_DATE_KEY = "9999-12-31"`) y 154-156.
- **Qué pasa:** `""` se mapea a `"9999-12-31"`; una tarea con fecha real
  `9999-12-31` obtiene la misma clave y el desempate cae en prioridad/`createdAt`/`id`,
  así que puede quedar **antes** que una tarea sin fecha.
- **Esperado:** las tareas sin fecha van siempre al final (RF-6).
- **Obtenido:** orden ambiguo entre la fecha lejana y la vacía.
- **Evidencia:** líneas 19 y 154-156; prueba `BUG-08` (`skip`).

### COV-01 — Requisitos Must de interfaz sin prueba ejecutable — **S2**

- **Dónde:** `tests/` completo.
- **Qué pasa:** ninguna prueba importa `src/app.js` (se confirmó con `grep`:
  la única mención es `markup.test.js` línea 19, que lo lee como **texto** para
  regex). Todo el comportamiento interactivo queda sin prueba:
  - RF-3: confirmación de borrado y devolución de foco (AC-06, AC-21).
  - RF-4 en la UI: botones Iniciar/Pausar/Completar/Reabrir (AC-07).
  - RF-8: confirmación de reemplazo al importar y anuncio «N tareas importadas».
  - RF-10: alternancia real de tema, `aria-pressed` y persistencia (AC-20).
  - AC-21 (foco atrapado y `Escape`), AC-22 (360 px), AC-25 (XSS **renderizado**),
    AC-26 (aviso de fallo de guardado en la interfaz).
- **Esperado (RNF-8):** «100 % de requisitos Must con al menos una prueba».
- **Obtenido:** la mitad de interfaz de los Must no tiene prueba ejecutable; el
  propio Developer lo admite (`docs/DEVELOPMENT_LOG.md` §Nota al Tester).
- **Impacto:** un fallo de regresión en `app.js` (1 244 líneas) pasaría la suite
  sin ser detectado.
- **Evidencia:** `grep` de `app.js` en `tests/` (solo lectura de texto);
  `markup.test.js` líneas 17-21, 144.

---

## 6. Cobertura de requisitos Must

Los 10 RF son Must. Cobertura **ejecutable** verificada por lectura:

| Must | Cobertura de dominio/almacenamiento | Cobertura de interfaz |
| --- | --- | --- |
| RF-1 | Sí (`domain.test.js` + `regression.test.js`) | Parcial (solo estático) |
| RF-2 | Sí | Parcial |
| RF-3 | Sí (dominio) | **No** (COV-01) |
| RF-4 | Sí (dominio) | **No** (COV-01) |
| RF-5 | Sí (`metrics.test.js` + `regression.test.js`) | Estático |
| RF-6 | Sí (`filters.test.js` + `regression.test.js`) | Estático |
| RF-7 | Sí (`storage.test.js` + `integration.test.js`) | Parcial |
| RF-8 | Sí (salvo BUG-05) | **No** (confirmación) |
| RF-9 | Sí | Estático |
| RF-10 | Parcial (`storage.test.js`) | **No** (toggle) |

**Conclusión:** no se puede afirmar el 100 % de Must con prueba; COV-01 (S2) lo
impide. Además, ninguna de las coberturas «Sí» fue **ejecutada** en esta sesión.

---

## 7. Riesgos residuales y lo no verificable

No verificable sin navegador real (documentado para la siguiente ronda):

- **Contraste** real de tokens claro/oscuro (§4 y checklist VA-1…VA-16).
- **360 px** sin scroll horizontal y 1 columna de tarjetas (AC-22/RNF-2).
- **Teclado y foco:** orden de tabulación, foco atrapado/restaurado, `Escape`,
  `#skip-link` (AC-21/RNF-1).
- **`:has()`** del diálogo, título `sticky` y botones al hacer scroll.
- **RNF-10:** consola limpia y ausencia de 404 con `npm start`.
- **Lectores de pantalla:** anuncios de `aria-live` (`#task-count`,
  `#toast-region`, `#form-errors`).
- **Coma decimal** en `#task-hours` (`type="number"`) según navegador
  (desvío 7 del Developer).

No verificable por falta de shell:

- `npm run check` (RNF-5/RNF-7) y `npm test` (RNF-8): **nunca ejecutados**.
- Versión de Node (RNF-3/RNF-5 exigen ≥ 20).
- El conteo real de pruebas en verde y 0 fallos.

Otros riesgos detectados por lectura (sin prueba, S4):

- **Orden del foco en validación:** `validateTaskInput` devuelve los errores en
  orden de código (título, curso, tipo, estado, prioridad, fecha, horas, notas),
  que no coincide con el orden visual del formulario; RF-1 pide «el foco va al
  primer campo inválido», lo que puede diferir del primer error mostrado.
- **Búsqueda entre campos:** el *haystack* concatena `title + course + notes`, así
  que una consulta puede coincidir cruzando el límite entre dos campos.
- **Aviso de respaldo:** `loadInitialTasks` anuncia «se guardó una copia» aun si
  `getItem` lanzó y no se escribió respaldo (texto posiblemente inexacto).
- **Versión en texto:** `version: "1"` (string) se rechaza como
  `unsupported_version`. Es discutible, pero coherente con §5.3 (`version` es
  `number`); se fijó como comportamiento esperado en `regression.test.js`.

---

## 8. Pruebas añadidas

`tests/regression.test.js` (nuevo, 41 casos: 33 activos + 8 `skip`), sin tocar
ninguna prueba existente:

- **Límites exactos:** título 120/121, curso 60/61, notas 500/501, horas
  100/100.1/-1/`""`/coma decimal, medición tras recortar extremos.
- **Fechas y métricas:** hoy/ayer/hoy+6/hoy+7, 2028-02-29 válido y fechas
  imposibles inválidas, `addDays` en fin de año y bisiesto, redondeo .5 (1/8, 3/8,
  1/200), avance 0 con lista vacía, entero y ≤ 100.
- **Búsqueda y orden:** acentos/mayúsculas/espacios, caracteres especiales de
  regex literales, consulta de solo espacios, orden estable sin mutación, `sortBy`
  desconocido.
- **`normalizeTask`:** ids inválidos (patrón `tsk_`), límites 6/32, `completedAt`
  heredado/limpiado/no-ISO, `updatedAt` anterior, campos desconocidos y coma.
- **Importación atómica:** arreglo simple válido, ids duplicados, versiones
  `2`/`0`/`null`/`"1"`, `null`/`42`/`"texto"`/`true`, envoltura sin `tasks`, sin
  escritura en almacenamiento, carga con duplicados que respalda.
- **`updateTask`/`changeTaskStatus`:** `dueDate` inválida sin mutar, estado
  desconocido, `NotFoundError`.
- **XSS como texto:** round-trip de `<img src=x onerror=...>` y `<b>`.
- **Flujo completo:** crear → guardar → cargar → filtrar → completar → métricas
  → exportar → importar con fechas límite.
- **`skip` (contrato de los bugs):** BUG-01…BUG-08.

---

## 9. Bitácora

### [VERIFICACIÓN] 12:00 — Verificación estática, suite adversarial y veredicto RECHAZADO

- **Agente:** Tester
- **Skills usadas:** `testing` (matriz, recetas `node:test`, reporte de bugs),
  `requirements-analysis` (verificación contra AC).
- **Decisión / hallazgo:** el runtime no expone shell (59 herramientas:
  `blender`/`browser`/`opencode`), el navegador está desconectado y Blender no
  responde; por tanto `npm run check`, `npm test` y `npm start` quedan
  **no ejecutados** y el veredicto no puede ser APROBADO. Verificación estática:
  74 pruebas declaradas antes; se añaden 33 activas + 8 `skip` (115 declaradas).
  Se confirman 8 defectos (BUG-01…BUG-08) y un hueco S2 de cobertura de interfaz
  (COV-01).
- **Evidencia:** `docs/TEST_REPORT.md` (este archivo); `tests/regression.test.js`
  (41 casos); `grep` de `^test(` en `tests/` → 115 coincidencias; `grep` de
  `app.js` en `tests/` → solo lectura de texto en `markup.test.js`; errores de
  herramientas: `[browser.disconnected]`, `Could not connect to Blender`,
  `Unable to connect` (fetch a `localhost:4173`).
- **Pendiente para el Developer (vía Architect):** BUG-01…BUG-08 y COV-01. Una
  corrección solo se cierra cuando la suite completa vuelve a pasar **ejecutada**.
