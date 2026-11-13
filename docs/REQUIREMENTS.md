# Requisitos — StudyFlow v1

- **Estado:** aprobado para implementación
- **Autor:** Architect
- **Fecha:** 12 nov 2026
- **Fuentes:** `docs/BRIEF.md`, `AGENTS.md`, skill `requirements-analysis`
- **Documentos relacionados:** `docs/ARCHITECTURE.md`, `docs/UI_SPEC.md`

## 1. Problema y usuario

- **Usuario:** estudiante de secundaria o universidad que cursa varias materias y
  recibe entregas por aulas virtuales, correo y mensajería.
- **Necesidad:** saber en menos de 10 segundos qué debe hacer hoy y qué está en
  riesgo, sin crear cuentas ni depender de internet.
- **Resultado esperado:** un panel local que registra tareas académicas, calcula
  vencimientos y avance, y conserva los datos entre sesiones en el mismo equipo.
- **Actores:** un único usuario por navegador. No hay roles, cuentas ni
  colaboración.

## 2. Alcance (MoSCoW)

### Must (v1)

- CRUD de tareas académicas con validación en la frontera.
- Estados `pendiente`, `en_progreso`, `completada`; prioridades `alta`, `media`,
  `baja`; tipos `tarea`, `examen`, `proyecto`, `lectura`.
- Panel de métricas: total, pendientes, en progreso, completadas, vencidas,
  próximas 7 días y porcentaje de avance.
- Búsqueda por texto, filtros por estado, curso y prioridad, y orden por fecha,
  prioridad y creación.
- Persistencia versionada en `localStorage`, datos de ejemplo en el primer
  arranque y restablecimiento de datos.
- Importación y exportación JSON.
- Tema claro/oscuro, diseño responsive y accesibilidad por teclado.
- Interfaz y documentación en español; código con identificadores en inglés.

### Should (v1 si el tiempo alcanza)

- Filtro adicional por tipo de tarea.
- Contador de horas estimadas pendientes.
- Atajo de teclado `N` para abrir el formulario de nueva tarea.
- Deshacer la última eliminación desde el toast.

### Won't (fuera de alcance v1)

- Backend, autenticación, cuentas, sincronización multidispositivo o multitar.
- Notificaciones push, correo o recordatorios del sistema.
- Adjuntos, subtareas, tareas recurrentes, arrastrar y soltar.
- Colaboración, comentarios o compartir tableros.
- Integraciones con calendarios, aulas virtuales o IA generativa.
- Service worker/PWA, i18n, exportación CSV, analítica o telemetría.

## 3. Requisitos funcionales

| ID | Requisito | Prioridad | Criterios |
| --- | --- | --- | --- |
| RF-1 | Crear tareas con título, curso, tipo, fecha de entrega, prioridad, estado, horas estimadas y notas, aplicando valores por defecto y validación. | Must | AC-01, AC-02, AC-03, AC-23, AC-24 |
| RF-2 | Editar una tarea existente sin alterar su `id` ni su `createdAt`. | Must | AC-04, AC-05 |
| RF-3 | Eliminar una tarea con confirmación explícita y sin afectar a las demás. | Must | AC-06 |
| RF-4 | Cambiar el estado de una tarea entre pendiente, en progreso y completada, registrando o limpiando `completedAt`. | Must | AC-07 |
| RF-5 | Calcular y mostrar las siete métricas del panel en cada cambio. | Must | AC-08, AC-09, AC-10 |
| RF-6 | Buscar por texto, filtrar por estado, curso y prioridad (y tipo como Should), y ordenar por fecha, prioridad o creación. | Must | AC-11, AC-12, AC-13 |
| RF-7 | Persistir las tareas en `localStorage` con un documento versionado, recuperarlas al arrancar y sobrevivir a datos corruptos. | Must | AC-14, AC-15 |
| RF-8 | Exportar e importar JSON validado, con confirmación de reemplazo y rechazo atómico de archivos inválidos. | Must | AC-16, AC-17, AC-18 |
| RF-9 | Sembrar seis tareas de ejemplo en el primer arranque y restaurarlas al restablecer los datos. | Must | AC-19 |
| RF-10 | Alternar tema claro/oscuro, persistir la preferencia y respetar la preferencia del sistema en la primera visita. | Must | AC-20 |

### Detalle por requisito

#### RF-1 — Crear tarea

- El formulario se abre desde `#btn-new-task` y desde el estado vacío.
- Campos obligatorios: `title` (1–120 caracteres tras recortar) y `course`
  (1–60 tras recortar). El resto tiene valores por defecto.
- Valores por defecto: `status = "pendiente"`, `priority = "media"`,
  `type = "tarea"`, `dueDate = ""` (sin fecha), `estimatedHours = 0`,
  `notes = ""`.
- El sistema genera `id` con el prefijo `tsk_`, `createdAt` y `updatedAt` con el
  reloj inyectado, y `completedAt = null`.
- Si la validación falla, no se crea nada, se muestran todos los errores por
  campo, el foco va al primer campo inválido y se anuncia el resumen.
- Al guardar: se persiste, se cierra el diálogo, se re-renderiza y se anuncia
  «Tarea creada».

#### RF-2 — Editar tarea

- El diálogo se abre con los valores actuales y el título «Editar tarea».
- Se conservan `id` y `createdAt`; se actualiza `updatedAt`.
- Cancelar o `Escape` descarta los cambios y devuelve el foco al botón «Editar».
- Un `id` inexistente produce error de dominio y no altera la lista.

#### RF-3 — Eliminar tarea

- Se pide confirmación con el título de la tarea y una acción destructiva.
- Confirmar elimina solo esa tarea, persiste y anuncia «Tarea eliminada».
- Cancelar o `Escape` no modifica nada.
- El foco vuelve al control que abrió la confirmación o al encabezado de la
  lista si el elemento desapareció.

#### RF-4 — Estados

- Transiciones visibles: pendiente → en progreso («Iniciar»), pendiente o en
  progreso → completada («Completar»), en progreso → pendiente («Pausar»),
  completada → pendiente («Reabrir»).
- Al entrar en `completada`, `completedAt` toma el instante del cambio.
- Al salir de `completada`, `completedAt` vuelve a `null`.
- Volver a marcar una tarea ya completada no cambia `completedAt`.

#### RF-5 — Métricas

Definiciones exactas (todas calculadas con la fecha local de hoy como
`YYYY-MM-DD`):

| Métrica | Campo | Regla |
| --- | --- | --- |
| Total | `total` | Todas las tareas, sin importar estado ni fecha. |
| Pendientes | `pending` | `status === "pendiente"`. |
| En progreso | `inProgress` | `status === "en_progreso"`. |
| Completadas | `completed` | `status === "completada"`. |
| Vencidas | `overdue` | No completada, con fecha no vacía y `dueDate < hoy`. |
| Próximas 7 días | `upcoming7` | No completada, con `hoy <= dueDate <= hoy + 6 días`. |
| Avance | `completionRate` | `total === 0 ? 0 : Math.round(completed / total * 100)`. Entero 0–100. |

- Una tarea que vence hoy **no** está vencida y **sí** cuenta como próxima.
- Una tarea sin fecha nunca es vencida ni próxima.
- Una tarea completada nunca es vencida ni próxima.

#### RF-6 — Búsqueda, filtros y orden

- Búsqueda sobre `title`, `course` y `notes`, sin distinguir mayúsculas ni
  acentos, recortando espacios. Longitud máxima del campo: 80 caracteres.
- Filtros combinables con lógica AND. Valor vacío (`""`) significa «sin filtro».
  - `status`: `"" | pendiente | en_progreso | completada`.
  - `course`: `""` o un curso exacto de la lista de cursos existentes.
  - `priority`: `"" | alta | media | baja`.
  - `type` (Should): `"" | tarea | examen | proyecto | lectura`.
- Orden:
  - `dueDate` (predeterminado): ascendente; las tareas sin fecha van al final;
    desempata por prioridad (alta, media, baja), luego `createdAt` ascendente,
    luego `id`.
  - `priority`: alta, media, baja; desempata por `dueDate` ascendente (sin fecha
    al final), luego `createdAt` ascendente, luego `id`.
  - `createdAt`: más reciente primero; desempata por `id`.
- «Limpiar filtros» restaura los filtros vacíos y conserva el orden elegido.
- La lista de cursos del filtro se deriva de las tareas y se ordena con
  `localeCompare("es")`.

#### RF-7 — Persistencia

- Clave única de tareas: `studyflow.tasks`. Clave de respaldo:
  `studyflow.tasks.backup`. Clave de tema: `studyflow.theme`.
- Documento guardado: `{ app: "studyflow", version: 1, updatedAt, tasks }`.
- Se guarda de forma síncrona tras cada mutación (crear, editar, eliminar,
  cambiar estado, importar, restablecer).
- Al arrancar:
  - Sin datos → se siembran los ejemplos y se guardan.
  - Documento válido → se cargan las tareas; si se descartaron tareas inválidas,
    se copia el valor crudo a `studyflow.tasks.backup`, se avisa y se guarda la
    versión limpia en la siguiente mutación.
  - Documento corrupto o de versión desconocida → se copia el valor crudo a
    `studyflow.tasks.backup`, se arranca con los ejemplos y se muestra un aviso
    de error.
- Un fallo de escritura (cuota, almacenamiento bloqueado) no pierde el estado en
  memoria: se muestra un aviso persistente y se sugiere exportar.

#### RF-8 — Importar y exportar

- Exportar produce `studyflow-AAAA-MM-DD.json` (fecha local) con
  `{ app, version: 1, exportedAt, tasks }`, JSON con 2 espacios de indentación.
- Importar acepta la envoltura anterior o un arreglo simple de tareas.
- La importación es **atómica**: si una sola tarea es inválida, hay IDs
  duplicados, la versión es desconocida o el JSON no parsea, no se modifica el
  estado ni el almacenamiento.
- Antes de aplicar una importación válida se pide confirmación indicando cuántas
  tareas serán reemplazadas. Importar **reemplaza** la colección completa.
- Tras importar: se persiste, se re-renderiza y se anuncia «N tareas
  importadas».

#### RF-9 — Datos de ejemplo y restablecimiento

- Primer arranque sin datos: seis ejemplos que cubren los tres estados, las tres
  prioridades, los cuatro tipos, una vencida y tres próximas.
- Restablecer pide confirmación destructiva, elimina la clave de tareas y vuelve
  a sembrar los ejemplos. No borra el tema ni el respaldo.
- Las fechas de los ejemplos se calculan relativas a hoy; nunca son constantes
  que envejezcan.

#### RF-10 — Tema

- Primer arranque sin preferencia guardada: se usa `prefers-color-scheme`.
- El botón `#theme-toggle` alterna `document.documentElement.dataset.theme`
  entre `light` y `dark`, guarda la preferencia y actualiza su etiqueta
  accesible y `aria-pressed`.
- La preferencia sobrevive a la recarga.
- Un valor inválido en `studyflow.theme` se ignora y se usa el sistema.
- No debe haber destello de tema incorrecto: el tema se aplica con un script
  mínimo en `<head>` antes del CSS.

## 4. Requisitos no funcionales

| ID | Requisito | Métrica verificable |
| --- | --- | --- |
| RNF-1 | Accesibilidad | Flujo completo solo con teclado; un `h1`; labels asociados; foco visible ≥ 3 px; diálogo con foco atrapado y restaurado; `Escape` cierra; objetivos táctiles ≥ 44×44 px; cambios anunciados en `aria-live="polite"`. |
| RNF-2 | Responsive | A 360 px `document.documentElement.scrollWidth <= clientWidth`; 1 columna de tarjetas; diálogo cabe con scroll interno. A 768 px 2 columnas; a 1280 px 3 columnas y ancho máximo 1200 px. |
| RNF-3 | Rendimiento | `computeStats` + `filterTasks` + `sortTasks` sobre 500 tareas en < 50 ms en Node 20; primer render de 500 tareas < 100 ms medido con `performance.now()` en un equipo de referencia. |
| RNF-4 | Integridad | Round-trip guardar/cargar idéntico; ninguna entrada inválida muta el estado; documento corrupto respaldado; importación inválida no escribe. |
| RNF-5 | Compatibilidad | Navegadores evergreens (Chrome, Edge, Firefox, Safari) en sus dos últimas versiones; Node ≥ 20; sin dependencias de runtime ni build step. |
| RNF-6 | Privacidad y offline | Cero peticiones de red después de cargar; datos solo en `localStorage`; sin telemetría ni cuentas. |
| RNF-7 | Mantenibilidad | `src/domain.js` no importa DOM, `window` ni `localStorage`; sin importaciones circulares; `npm run check` en verde. |
| RNF-8 | Pruebas | `npm test` en verde con ≥ 30 pruebas; 100 % de requisitos Must con al menos una prueba; 0 bugs S1/S2. |
| RNF-9 | Idioma | Interfaz y documentación en español; identificadores de código en inglés. |
| RNF-10 | Arranque limpio | `npm start` sirve `index.html`, CSS y módulos sin 404 ni errores de consola (salvo avisos explícitos de almacenamiento). |

## 5. Modelo de datos

### 5.1 Enumeraciones

| Enumeración | Valores | Etiquetas de interfaz |
| --- | --- | --- |
| `status` | `pendiente`, `en_progreso`, `completada` | Pendiente, En progreso, Completada |
| `priority` | `alta`, `media`, `baja` | Alta, Media, Baja |
| `type` | `tarea`, `examen`, `proyecto`, `lectura` | Tarea, Examen, Proyecto, Lectura |
| `sortBy` | `dueDate`, `priority`, `createdAt` | Fecha de entrega, Prioridad, Más recientes |

### 5.2 Tarea (`Task`)

| Campo | Tipo | Reglas | Ejemplo |
| --- | --- | --- | --- |
| `id` | string | Único en la colección; inmutable; `^tsk_[a-z0-9]{6,32}$` | `tsk_9f2a1c4b7d10` |
| `title` | string | Recortado; 1–120 caracteres; obligatorio | `Ensayo de historia` |
| `course` | string | Recortado; 1–60 caracteres; obligatorio | `Historia` |
| `type` | enum | Uno de `TASK_TYPES`; por defecto `tarea` | `examen` |
| `status` | enum | Uno de `TASK_STATUSES`; por defecto `pendiente` | `en_progreso` |
| `priority` | enum | Uno de `TASK_PRIORITIES`; por defecto `media` | `alta` |
| `dueDate` | string | `""` (sin fecha) o `YYYY-MM-DD` válida en calendario local | `2026-11-18` |
| `estimatedHours` | number | 0–100; hasta 2 decimales; por defecto `0` | `3.5` |
| `notes` | string | Recortado en extremos; 0–500 caracteres; por defecto `""` | `Capítulos 3 y 4` |
| `createdAt` | string | ISO 8601 UTC; se fija al crear; inmutable | `2026-11-12T15:04:05.000Z` |
| `updatedAt` | string | ISO 8601 UTC; se actualiza en cada cambio | `2026-11-12T15:10:00.000Z` |
| `completedAt` | string \| null | ISO 8601 si `status === "completada"`; en otro caso `null` | `2026-11-12T16:00:00.000Z` |

Reglas transversales:

- `updatedAt >= createdAt` (comparación ISO lexicográfica).
- `status === "completada"` ⇔ `completedAt` no nulo.
- Una tarea con `dueDate === ""` se ordena al final y no suma a vencidas ni
  próximas.
- No se mutan tareas ni arreglos: cada operación devuelve estructuras nuevas.
- Los campos desconocidos de una importación se ignoran al normalizar.

### 5.3 Documento (`Store`)

| Campo | Tipo | Reglas |
| --- | --- | --- |
| `app` | string | Literal `"studyflow"`. |
| `version` | number | Entero `1` para esta versión del esquema. |
| `updatedAt` | string | ISO 8601 del último guardado. |
| `tasks` | `Task[]` | 0..500 recomendado; IDs únicos; cada tarea válida. |

El documento exportado añade `exportedAt` (ISO 8601) y conserva `app`,
`version` y `tasks`. `updatedAt` es opcional al importar.

### 5.4 Filtros y métricas

```text
Filters = {
  query: string,      // "" = sin búsqueda; se recorta y se compara sin acentos
  status: string,     // "" = todos
  course: string,     // "" = todos
  priority: string,   // "" = todas
  type: string        // "" = todos (Should)
}

Stats = {
  total: number,
  pending: number,
  inProgress: number,
  completed: number,
  overdue: number,
  upcoming7: number,
  completionRate: number  // entero 0..100
}
```

## 6. Flujos principales

1. **Alta:** abrir diálogo → completar → validar → crear → persistir → cerrar →
   renderizar → anunciar.
2. **Edición:** abrir con datos → modificar → validar → actualizar conservando
   `id`/`createdAt` → persistir → renderizar.
3. **Cambio de estado:** acción en la tarjeta → actualizar estado y
   `completedAt` → persistir → recalcular métricas → anunciar.
4. **Eliminación:** acción → confirmación → eliminar → persistir → renderizar →
   anunciar.
5. **Búsqueda/filtros/orden:** cambiar control → recalcular lista visible →
   actualizar contador y estado vacío; no se recrean los controles.
6. **Importación:** elegir archivo → leer → validar todo → confirmar reemplazo →
   aplicar → persistir → renderizar.
7. **Exportación:** serializar → descargar `studyflow-AAAA-MM-DD.json` →
   anunciar.
8. **Error de guardado:** la mutación queda en memoria → aviso persistente →
   exportar disponible.
9. **Datos corruptos:** respaldar crudo → sembrar ejemplos → avisar.
10. **Tema:** alternar → aplicar `data-theme` → persistir.

## 7. Criterios de aceptación (Given/When/Then)

- **AC-01 Crear tarea válida.** Dado el formulario con título `Ensayo`, curso
  `Historia`, tipo `tarea`, prioridad `media`, sin fecha y 0 horas, cuando se
  guarda, entonces existe una tarea con `status = "pendiente"`, `id` con prefijo
  `tsk_`, `createdAt` y `updatedAt` ISO, `completedAt = null` y el total sube en 1.
- **AC-02 Título vacío.** Dado un título con solo espacios, cuando se guarda,
  entonces se muestra «El título es obligatorio.», no se crea la tarea, el foco
  va al campo y el total no cambia.
- **AC-03 Límites de texto.** Dado un título de 121 caracteres, cuando se guarda,
  entonces se rechaza; con 120 se acepta. Un curso vacío se rechaza. Las notas de
  501 caracteres se rechazan.
- **AC-04 Editar.** Dada una tarea existente, cuando se cambian título,
  prioridad y fecha y se guarda, entonces conserva `id` y `createdAt`, su
  `updatedAt` aumenta y la tarjeta refleja los cambios.
- **AC-05 Cancelar edición.** Dado el diálogo abierto, cuando se pulsa Cancelar o
  `Escape`, entonces no cambia ninguna tarea y el foco vuelve al botón «Editar».
- **AC-06 Eliminar.** Dada una tarea, cuando se confirma la eliminación, entonces
  desaparece, el total baja en 1 y las métricas se recalculan. Si se cancela, la
  tarea permanece.
- **AC-07 Estados y `completedAt`.** Dada una tarea pendiente, cuando se pulsa
  «Iniciar», entonces queda `en_progreso`; al pulsar «Completar» queda
  `completada` con `completedAt` ISO; al pulsar «Reabrir» vuelve a `pendiente` y
  `completedAt` es `null`.
- **AC-08 Vencidas.** Dada una tarea pendiente que vence ayer, cuenta en
  `overdue`. Una completada que vencía ayer no cuenta. Una que vence hoy no
  cuenta como vencida.
- **AC-09 Próximas 7 días.** Con hoy `2026-11-12`, una tarea no completada con
  fecha `2026-11-18` cuenta en `upcoming7`; una con `2026-11-19` no cuenta; una
  completada no cuenta; una sin fecha no cuenta.
- **AC-10 Porcentaje de avance.** Con 6 tareas y 1 completada, `completionRate`
  es 17. Con 0 tareas es 0. Nunca es decimal ni supera 100.
- **AC-11 Búsqueda.** Dado un texto `calculo`, cuando se busca, entonces coincide
  con «Cálculo»; `EXAMEN` coincide sin distinguir mayúsculas; una búsqueda sin
  coincidencias muestra el estado «sin resultados».
- **AC-12 Filtros combinados.** Dados estado `pendiente`, curso `Historia` y
  prioridad `alta`, cuando se aplican, entonces solo se listan tareas que
  cumplen las tres condiciones. Al limpiar filtros vuelven todas.
- **AC-13 Orden.** Con orden por fecha, la más próxima aparece primero y las que
  no tienen fecha al final. Con orden por prioridad, `alta` va antes que `media`
  y `baja`. Con orden por creación, la más reciente va primero.
- **AC-14 Persistencia.** Dadas N tareas creadas, cuando se vuelve a cargar el
  mismo almacenamiento, entonces se recuperan las N tareas con los mismos campos.
- **AC-15 Datos corruptos.** Dado un valor no JSON en `studyflow.tasks`, cuando
  arranca la aplicación, entonces el valor crudo queda en
  `studyflow.tasks.backup`, se cargan los ejemplos y se muestra un aviso de error.
- **AC-16 Exportar.** Dado un estado con 2 tareas, cuando se exporta, entonces se
  descarga `studyflow-AAAA-MM-DD.json`, el JSON parsea y contiene
  `app = "studyflow"`, `version = 1`, `exportedAt` y 2 tareas.
- **AC-17 Importar válido.** Dado un archivo con 2 tareas válidas, cuando se
  confirma el reemplazo, entonces la colección pasa a tener esas 2 tareas, se
  persiste y se anuncia «2 tareas importadas».
- **AC-18 Importar inválido.** Dado un JSON corrupto, una versión desconocida, una
  tarea inválida o IDs duplicados, cuando se importa, entonces se muestra un
  error, el estado no cambia y no se escribe en el almacenamiento.
- **AC-19 Primer arranque y reset.** Dado un almacenamiento vacío, cuando arranca,
  entonces hay 6 ejemplos. Dado el botón Restablecer, cuando se confirma,
  entonces se borran las tareas actuales y vuelven los 6 ejemplos.
- **AC-20 Tema.** Dada una primera visita con el sistema en oscuro, cuando
  arranca, entonces `data-theme = "dark"`. Al alternar, cambia el tema, se
  guarda y se conserva tras recargar.
- **AC-21 Teclado en diálogo.** Dado el diálogo de tarea abierto con teclado,
  entonces el foco entra en el título, `Tab` circula dentro, `Escape` cierra sin
  guardar y el foco vuelve al disparador.
- **AC-22 Responsive 360 px.** Dado un viewport de 360 px, entonces no hay scroll
  horizontal, las tarjetas están en una columna y el diálogo cabe con scroll
  interno.
- **AC-23 Fecha inválida.** Dada la fecha `2026-02-30`, cuando se guarda, entonces
  se rechaza con un mensaje de fecha. `2028-02-29` se acepta.
- **AC-24 Horas.** Dado `3,5` en horas, cuando se guarda, entonces se almacena
  `3.5`. `101`, `-1` y texto no numérico se rechazan. Vacío se guarda como `0`.
- **AC-25 Sin XSS.** Dado el título `<img src=x onerror=alert(1)>`, cuando se
  renderiza, entonces se muestra como texto y no se crea ningún elemento `img`.
- **AC-26 Fallo de guardado.** Dado un almacenamiento que lanza al escribir,
  cuando se crea una tarea, entonces la tarea permanece en memoria, aparece un
  aviso de error y la aplicación sigue usable.

## 8. Casos límite

1. Título vacío, solo espacios o con espacios en los extremos.
2. Título de 120/121 caracteres; curso de 60/61; notas de 500/501.
3. Fecha `""`, hoy, ayer, mañana, `hoy + 6`, `hoy + 7`, `2026-02-30`,
   `2028-02-29`, `2026-13-01`.
4. Horas `""`, `0`, `0,5`, `100`, `100.1`, `-1`, `3,5`, `abc`.
5. Tarea completada con fecha pasada; tarea sin fecha; tarea vencida y
   completada.
6. Lista vacía; filtros sin resultados; búsqueda con acentos y mayúsculas.
7. Curso repetido con distinta capitalización en la lista de filtros.
8. Importar: JSON vacío, `null`, arreglo vacío, envoltura sin `tasks`, versión
   `2`, tarea con `status` desconocido, IDs duplicados, campos extra.
9. `localStorage` ausente, bloqueado o con cuota agotada.
10. Documento guardado con una tarea inválida entre varias válidas.
11. Tema guardado con valor `"auto"` o basura.
12. Restablecer sin datos; eliminar la última tarea; completar la última
    pendiente.
13. Diálogo abierto y `Escape`; foco devuelto tras eliminar el disparador.
14. Título con HTML, emojis o caracteres combinados; notas con saltos de línea.
15. 500 tareas para el presupuesto de rendimiento.

## 9. Matriz de trazabilidad requisito → prueba prevista

Los nombres son el contrato para Developer y Tester; pueden añadirse pruebas,
pero no renombrarse sin actualizar este documento.

| Requisito | Criterios | Prueba prevista |
| --- | --- | --- |
| RF-1 | AC-01, AC-02, AC-03, AC-23, AC-24 | `tests/domain.test.js` › `crea una tarea con estado pendiente por defecto`; › `rechaza título vacío o solo espacios`; › `rechaza una fecha inexistente como 2026-02-30`; › `normaliza horas con coma decimal`; › `rechaza horas fuera del rango 0-100` |
| RF-2 | AC-04, AC-05 | `tests/domain.test.js` › `actualiza sin mutar la tarea original`; › `ignora id y createdAt en el patch`; › `lanza NotFoundError si la tarea no existe` |
| RF-3 | AC-06 | `tests/domain.test.js` › `elimina solo la tarea indicada` |
| RF-4 | AC-07 | `tests/domain.test.js` › `cambia el estado y registra completedAt`; › `limpia completedAt al reabrir`; › `no muta la lista al cambiar estado` |
| RF-5 | AC-08, AC-09, AC-10 | `tests/metrics.test.js` › `cuenta total, pendientes, en progreso y completadas`; › `no cuenta completadas como vencidas`; › `una tarea que vence hoy no está vencida`; › `cuenta próximas dentro de la ventana de 7 días`; › `excluye la fecha hoy+7 de próximas`; › `calcula el porcentaje de avance redondeado`; › `devuelve 0 % con lista vacía` |
| RF-6 | AC-11, AC-12, AC-13 | `tests/filters.test.js` › `busca sin distinguir mayúsculas ni acentos`; › `busca en título, curso y notas`; › `combina estado, curso y prioridad`; › `devuelve lista vacía si nada coincide`; › `ordena por fecha con las sin fecha al final`; › `ordena por prioridad y desempata por fecha`; › `ordena por creación con la más reciente primero`; › `selectTasks no muta la entrada`; › `lista cursos únicos ordenados` |
| RF-7 | AC-14, AC-15, AC-26 | `tests/storage.test.js` › `guarda y carga el mismo estado`; › `crea un documento con versión 1`; › `devuelve vacío si no hay datos`; › `respalda y reporta datos corruptos`; › `descarta tareas inválidas al cargar y las cuenta`; › `saveTasks informa error si el almacenamiento falla` |
| RF-8 | AC-16, AC-17, AC-18 | `tests/storage.test.js` › `exporta JSON parseable con envoltura y versión`; › `importa una envoltura válida`; › `importa un arreglo simple`; › `rechaza una versión desconocida`; › `rechaza la importación completa si una tarea es inválida`; › `rechaza ids duplicados al importar`; › `informa error si el JSON no parsea` |
| RF-9 | AC-19 | `tests/domain.test.js` › `los ejemplos cubren estados, prioridades y tipos`; `tests/integration.test.js` › `reset restaura los ejemplos`; `tests/metrics.test.js` › `los ejemplos producen métricas esperadas` |
| RF-10 | AC-20 | `tests/storage.test.js` › `guarda y lee el tema; un valor inválido devuelve null`; `tests/markup.test.js` › `el arranque aplica data-theme desde el script inline` |
| RNF-1 | AC-21, AC-25 | `tests/markup.test.js` › `hay un solo h1 y landmarks`; › `los campos del formulario tienen label`; › `existe una región aria-live`; `tests/domain.test.js` › `no interpreta HTML en el título` |
| RNF-2 | AC-22 | Inspección con viewport 360/768/1280; `tests/markup.test.js` › `declara viewport y media queries base` |
| RNF-3 | — | `tests/performance.test.js` › `filtra y ordena 500 tareas en menos de 50 ms` |
| RNF-4 | AC-14, AC-15, AC-18, AC-26 | Mismas pruebas de RF-7/RF-8 más `tests/integration.test.js` › `ciclo completo crear, filtrar, completar, exportar e importar` |
| RNF-5 | — | `npm run check`; `tests/markup.test.js` › `index.html carga módulos ES y no usa dependencias externas` |
| RNF-6 | — | `tests/markup.test.js` › `no hay fetch ni recursos externos` |
| RNF-7 | — | Inspección estática: `src/domain.js` sin `document`, `window`, `localStorage`; `npm run check` |
| RNF-8 | — | `npm test` con ≥ 30 pruebas en verde |
| RNF-9 | — | Revisión de textos de interfaz y documentación |
| RNF-10 | — | `npm start` + smoke manual sin 404 ni errores de consola |

## 10. Supuestos y decisiones de alcance

| ID | Supuesto | Razón | Reversibilidad |
| --- | --- | --- | --- |
| A-1 | `dueDate` es opcional; `""` significa sin fecha. | No toda lectura tiene fecha límite; evita inventar fechas. | Alta: volverlo obligatorio es un cambio de validación. |
| A-2 | Restablecer vuelve a los seis ejemplos, no a una lista vacía. | Permite demostrar la app y recuperar un estado conocido. | Alta: cambiar el seed por `[]` es local. |
| A-3 | Importar reemplaza la colección completa tras confirmar. | Restaurar un respaldo es el caso principal; fusionar exige reglas de duplicados no pedidas. | Alta: se exporta antes de importar. |
| A-4 | El primer arranque siembra seis ejemplos con fechas relativas a hoy. | El panel debe verse útil desde el primer segundo. | Alta. |
| A-5 | «Próximas 7 días» = hoy hasta hoy + 6, inclusive. | Ventana de 7 días naturales, sin ambigüedad. | Alta: ajustar el límite y sus pruebas. |
| A-6 | Avance = completadas / total, redondeado. | Métrica simple y explicable. | Alta. |
| A-7 | El tema inicial sigue al sistema y luego la preferencia guardada. | Menor sorpresa para el usuario. | Alta. |
| A-8 | Un solo usuario y una sola pestaña; última escritura gana. | Sin backend ni sincronización en v1. | Requiere rediseño para multitar. |
| A-9 | La importación acepta envoltura o arreglo simple; la versión desconocida se rechaza. | Facilita archivos hechos a mano sin perder control de esquema. | Alta. |
| A-10 | Las notas se recortan y se renderizan como texto plano. | Evita XSS y espacios accidentales. | Alta. |
| A-11 | El curso es texto libre con sugerencias de cursos existentes. | No se pidió un catálogo de materias. | Alta. |

## 11. Fuera de alcance

Todo lo listado en «Won't» de la sección 2. En particular: backend, cuentas,
sincronización, notificaciones, adjuntos, colaboración, integraciones y PWA.

## 12. Preguntas abiertas

Ninguna bloqueante. Las ambigüedades se resolvieron en la sección 10 y cualquier
cambio posterior debe actualizar este documento y avisar a Developer y Tester.
