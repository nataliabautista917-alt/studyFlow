# Especificación de interfaz — StudyFlow v1

- **Estado:** aprobado para implementación
- **Autor:** Architect
- **Fecha:** 12 nov 2026
- **Requisitos:** `docs/REQUIREMENTS.md`
- **Contratos de DOM:** `docs/ARCHITECTURE.md` §3.4

## 1. Objetivo de la pantalla

- **Usuario:** estudiante con varias materias y entregas dispersas.
- **Tarea principal:** decidir en menos de 10 segundos qué hacer hoy y qué está
  en riesgo, y registrar o actualizar una tarea en menos de 30 segundos.
- **Métrica de éxito:** una tarea se completa en 3 clics; crear una tarea requiere
  un solo diálogo; no hay scroll horizontal a 360 px.
- **Pantalla única:** no hay rutas ni navegación entre vistas. Todo ocurre en
  `index.html`.

## 2. Jerarquía

1. `h1` — «StudyFlow» y una línea de contexto: «Tu carga académica de un
   vistazo».
2. Acción primaria — «Nueva tarea» visible en el encabezado y en el estado vacío.
3. `h2` «Resumen» — siete métricas, con el avance como indicador destacado.
4. `h2` «Tareas» — barra de búsqueda, filtros y orden.
5. Lista de tarjetas (`h3` por tarea) y estado vacío/sin resultados.
6. Pie — exportar, importar, restablecer y nota de almacenamiento.
7. Diálogos modales (tarea y confirmación) y región de toasts.

Un solo `h1`; sin saltos de nivel. El orden del DOM coincide con el orden visual.

## 3. Layout

### 3.1 Comportamiento por breakpoint

| Breakpoint | Contenedor | Métricas | Barra de filtros | Tarjetas | Encabezado | Diálogo |
| --- | --- | --- | --- | --- | --- | --- |
| 360 px | Padding 16 px, ancho completo | 2 columnas; la 7.ª ocupa 2 | Apilada: búsqueda, luego selects a 1 columna | 1 columna | Título y acciones en dos filas | Ancho completo con margen 16 px, scroll interno |
| 768 px | Máx. 720 px centrado | 4 columnas (auto-fit, mín. 148 px) | Búsqueda en fila completa; selects en 2 columnas | 2 columnas | Una fila: título + tema + nueva tarea | Máx. 560 px |
| 1280 px | Máx. 1200 px centrado | 7 columnas en una fila | Una sola fila: búsqueda flexible + 5 controles | 3 columnas | Una fila, mismo orden | Máx. 600 px |

Reglas:

- Mobile-first; los breakpoints se declaran con `min-width: 768px` y
  `min-width: 1280px`.
- Sin scroll horizontal en ningún breakpoint; los textos largos usan
  `overflow-wrap: anywhere`.
- Las tarjetas usan `grid` con `gap: var(--space-4)`.
- El pie se apila a 360 px y se alinea en fila a partir de 768 px.

### 3.2 Wireframes

```text
360 px
┌────────────────────────────────────┐
│ StudyFlow                  [tema]  │
│ Tu carga académica de un vistazo   │
│ [+ Nueva tarea]                    │
├────────────────────────────────────┤
│ Resumen                            │
│ ┌────────┐ ┌────────┐              │
│ │ Total  │ │ Pend.  │              │
│ └────────┘ └────────┘   … 7 métricas│
├────────────────────────────────────┤
│ Tareas                   6 tareas  │
│ [ Buscar…                        ] │
│ [ Estado ▾ ] [ Curso ▾ ]           │
│ [ Prioridad ▾ ] [ Orden ▾ ]        │
│ [ Limpiar filtros ]                │
│ ┌────────────────────────────────┐ │
│ │ Tarea                          │ │
│ └────────────────────────────────┘ │
├────────────────────────────────────┤
│ [Exportar] [Importar] [Reset]      │
│ 6 tareas · guardado 10:32          │
└────────────────────────────────────┘

768 px
┌──────────────────────────────────────────┐
│ StudyFlow            [tema] [+ Nueva]    │
├──────────────────────────────────────────┤
│ Resumen: 4 métricas por fila             │
│ [Buscar…] [Estado] [Curso]               │
│ [Prioridad] [Tipo] [Orden] [Limpiar]     │
│ ┌──────────────┐ ┌──────────────┐        │
│ │ Tarea        │ │ Tarea        │        │
│ └──────────────┘ └──────────────┘        │
└──────────────────────────────────────────┘

1280 px
┌────────────────────────────────────────────────────────────┐
│ StudyFlow                              [tema] [+ Nueva]    │
│ Resumen: 7 métricas en una fila                            │
│ [Buscar…] [Estado] [Curso] [Prioridad] [Tipo] [Orden] [×]  │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐               │
│ │ Tarea      │ │ Tarea      │ │ Tarea      │               │
│ └────────────┘ └────────────┘ └────────────┘               │
└────────────────────────────────────────────────────────────┘
```

## 4. Tokens

### 4.1 Color — tema claro (`:root`)

| Token | Valor | Uso |
| --- | --- | --- |
| `--bg` | `#f4f6fb` | Fondo de página. |
| `--surface` | `#ffffff` | Tarjetas, diálogos, encabezado. |
| `--surface-2` | `#eef2f9` | Fondo de métricas y campos. |
| `--surface-hover` | `#f7f9ff` | Hover de tarjeta y botones suaves. |
| `--text` | `#172033` | Texto principal. |
| `--text-muted` | `#5d6b85` | Metadatos, ayudas, texto secundario. |
| `--border` | `#dce3ef` | Bordes normales. |
| `--border-strong` | `#b9c5da` | Bordes de campos y separadores fuertes. |
| `--accent` | `#3557d6` | Acción primaria, enlaces, foco de selección. |
| `--accent-strong` | `#2743b0` | Hover/active de la acción primaria. |
| `--accent-soft` | `#e6ecff` | Fondos de énfasis y estado en progreso. |
| `--on-accent` | `#ffffff` | Texto sobre `--accent`. |
| `--success` | `#16794a` | Completadas y confirmaciones. |
| `--success-soft` | `#e3f6ec` | Fondo de completadas. |
| `--warning` | `#9a5b00` | Prioridad media y advertencias. |
| `--warning-soft` | `#fff2d9` | Fondo de prioridad media. |
| `--danger` | `#b42318` | Vencidas, eliminar, errores. |
| `--danger-soft` | `#fee9e7` | Fondo de vencidas y errores. |
| `--priority-high` | `#b42318` | Prioridad alta. |
| `--priority-high-soft` | `#fee9e7` | Fondo de prioridad alta. |
| `--priority-medium` | `#9a5b00` | Prioridad media. |
| `--priority-medium-soft` | `#fff2d9` | Fondo de prioridad media. |
| `--priority-low` | `#3557d6` | Prioridad baja. |
| `--priority-low-soft` | `#e6ecff` | Fondo de prioridad baja. |
| `--focus` | `#b45309` | Anillo de foco (contraste AA sobre fondos claros). |
| `--overlay` | `rgb(13 19 32 / 0.55)` | Backdrop de diálogos (nativo + refuerzo). |

### 4.2 Color — tema oscuro (`[data-theme="dark"]`)

| Token | Valor |
| --- | --- |
| `--bg` | `#0d1320` |
| `--surface` | `#151d2e` |
| `--surface-2` | `#1c2740` |
| `--surface-hover` | `#1a2337` |
| `--text` | `#eef2fb` |
| `--text-muted` | `#a9b6d0` |
| `--border` | `#2a3854` |
| `--border-strong` | `#3c4c6e` |
| `--accent` | `#8ea6ff` |
| `--accent-strong` | `#b3c2ff` |
| `--accent-soft` | `#1e2d55` |
| `--on-accent` | `#0d1320` |
| `--success` | `#6ee7a8` |
| `--success-soft` | `#123526` |
| `--warning` | `#ffd166` |
| `--warning-soft` | `#3a2a0a` |
| `--danger` | `#ff8f86` |
| `--danger-soft` | `#3d1715` |
| `--priority-high` | `#ff8f86` |
| `--priority-high-soft` | `#3d1715` |
| `--priority-medium` | `#ffd166` |
| `--priority-medium-soft` | `#3a2a0a` |
| `--priority-low` | `#8ea6ff` |
| `--priority-low-soft` | `#1e2d55` |
| `--focus` | `#ffd166` |
| `--overlay` | `rgb(0 0 0 / 0.65)` |

El modo oscuro usa tokens semánticos, no inversión automática ni
`filter: invert()`. `--focus` claro se ajusta a `#b45309` (en lugar del ámbar
base `#ffb020`) para alcanzar 3:1 sobre fondos claros.

### 4.3 Tipografía

| Token | Valor | Uso |
| --- | --- | --- |
| `--font-sans` | `"Segoe UI", system-ui, -apple-system, sans-serif` | Toda la interfaz. |
| `--text-xs` | `0.75rem` / 12 px | Badges, ayudas, notas. |
| `--text-sm` | `0.875rem` / 14 px | Metadatos, botones secundarios. |
| `--text-md` | `1rem` / 16 px | Cuerpo, campos, títulos de tarjeta. |
| `--text-lg` | `1.25rem` / 20 px | `h2`. |
| `--text-xl` | `1.75rem` / 28 px | `h1` (móvil). |
| `--text-2xl` | `2.25rem` / 36 px | Cifras de métricas y `h1` en desktop. |

- Altura de línea: 1.5 en cuerpo, 1.2 en títulos y cifras.
- `h1`: `clamp(1.75rem, 4vw, 2.25rem)`, peso 700.
- Cifras de métricas: `font-variant-numeric: tabular-nums`.
- Sin fuentes externas (offline).

### 4.4 Espaciado, forma y movimiento

| Token | Valor | Uso |
| --- | --- | --- |
| `--space-1` … `--space-7` | 4, 8, 12, 16, 24, 32, 48 px | Escala única; sin valores mágicos. |
| `--radius-sm` | 8 px | Badges, campos pequeños. |
| `--radius-md` | 12 px | Botones, tarjetas, métricas. |
| `--radius-lg` | 18 px | Diálogos y contenedores destacados. |
| `--radius-full` | 999 px | Píldoras de estado. |
| `--shadow-sm` | `0 1px 2px rgb(23 32 51 / 0.08)` | Tarjetas en reposo. |
| `--shadow-md` | `0 8px 24px rgb(23 32 51 / 0.10)` | Hover de tarjeta y diálogos. |
| `--duration` | 160 ms | Transiciones. |
| `--ease` | `cubic-bezier(0.2, 0.7, 0.3, 1)` | Curva estándar. |
| `--content-max` | 1200 px | Ancho máximo. |
| `--control-height` | 44 px | Altura mínima de controles y objetivos táctiles. |

## 5. Componentes

### 5.1 Encabezado (`header.app-header`)

- **Contenido:** `h1#app-title` «StudyFlow», subtítulo «Tu carga académica de un
  vistazo», botón `#theme-toggle` y botón primario `#btn-new-task` con icono `+`.
- **Layout:** a 360 px, título/subtítulo en una fila y acciones en otra; desde
  768 px, todo en una fila con las acciones al final.
- **Tema:** botón con icono sol/luna y texto visible «Tema»; `aria-pressed`
  refleja el modo oscuro; `aria-label` cambia entre «Cambiar a tema oscuro» y
  «Cambiar a tema claro». El icono no es el único indicador: hay texto.
- **Estados:** reposo, hover (`--surface-hover`), foco (anillo), activo.
- **Sticky:** el encabezado puede ser `position: sticky; top: 0` con
  `background: var(--surface)` y borde inferior; no debe tapar el foco.

### 5.2 Panel de métricas (`#dashboard`)

- **Contenido:** `h2` «Resumen» y siete tarjetas:
  Total, Pendientes, En progreso, Completadas, Vencidas, Próximas 7 días,
  Avance.
- **Anatomía de tarjeta:** etiqueta (`--text-sm`, `--text-muted`), cifra
  (`--text-2xl`, peso 700), y en Avance una barra `progress#progress-bar` con
  `value` 0–100 y texto «17 %».
- **Semántica:** las cifras tienen `aria-labelledby` hacia su etiqueta; el grupo
  es una lista o `dl` con `dt`/`dd`. El porcentaje no depende solo de la barra.
- **Estados:** normal; vencidas en `--danger` cuando el valor es > 0 (si es 0,
  color normal); avance en `--accent`; actualización por cambio de tareas.
- **Layout:** 2 columnas a 360, 4 a 768, 7 a 1280, con `minmax(148px, 1fr)`.

### 5.3 Barra de filtros (`#filters-form`)

- **Contenido y orden:** `#search-input` (label «Buscar»), `#filter-status`
  («Estado»), `#filter-course` («Curso»), `#filter-priority` («Prioridad»),
  `#filter-type` («Tipo», Should), `#sort-by` («Ordenar por»),
  `#btn-clear-filters` («Limpiar filtros»).
- **Labels:** visibles, asociados con `for`/`id`; en 1280 px pueden ser visibles
  arriba de cada control; nunca solo placeholder.
- **Comportamiento:** búsqueda con debounce de 200 ms; los selects aplican al
  cambiar; «Limpiar filtros» vuelve a «Todos» y conserva el orden.
- **Estados:** reposo, hover, foco, `disabled` durante una operación de
  importación; el botón de limpiar se deshabilita si no hay filtros activos.
- **Contador:** `#task-count` («6 tareas», «1 tarea», «0 tareas») con
  `aria-live="polite"`; se actualiza tras el debounce para no anunciar cada tecla.
- **Layout:** una columna a 360; búsqueda a fila completa y selects en dos
  columnas a 768; una fila a 1280.

### 5.4 Tarjeta de tarea (`article.task-card`)

- **Contenido:**
  - Borde izquierdo de 4 px con el color de prioridad.
  - Fila superior: badge de tipo (`Tarea`, `Examen`, `Proyecto`, `Lectura`) y
    badge de prioridad con texto (`Alta`, `Media`, `Baja`).
  - Título en `h3.task-card__title`.
  - Metadatos: curso y fecha de entrega (`time[datetime]` con formato
    «14 nov 2026»), horas estimadas («4 h»), estado como píldora.
  - Notas, si existen, en una línea truncada a 2 líneas con `title` completo.
  - Acciones: Iniciar/Pausar/Completar/Reabrir, Editar, Eliminar.
- **Estados visuales:**

| Estado | Señal visual | Señal textual |
| --- | --- | --- |
| Pendiente | Borde neutro, badge `--surface-2` | «Pendiente» |
| En progreso | Fondo `--accent-soft`, badge acento | «En progreso» |
| Completada | Fondo `--surface-2`, título tachado, badge `--success-soft` | «Completada» |
| Vencida | Borde izquierdo `--danger`, fecha en `--danger` | «Vencida» +
  fecha |
| Foco dentro | Anillo `--focus` 3 px, offset 2 px | — |
| Hover | `--surface-hover` + `--shadow-md` | — |

- **Prohibido:** comunicar prioridad, estado o vencimiento solo con color.
- **Acciones según estado:**
  - pendiente: Iniciar · Completar · Editar · Eliminar.
  - en_progreso: Completar · Pausar · Editar · Eliminar.
  - completada: Reabrir · Editar · Eliminar.
- **Teclado:** cada acción es un `button`; `Tab` recorre las acciones; `Enter` y
  `Space` activan. Las acciones destructivas se rotulan «Eliminar tarea …».
- **Objetivo táctil:** botones de acción ≥ 44×44 px, con icono + texto o
  `aria-label` explícito.
- **Accesibilidad:** `article` con `aria-labelledby` al `h3`; el estado y la
  prioridad están en texto; la fecha usa `<time>`.

### 5.5 Diálogo de formulario (`#task-dialog`)

- **Apertura:** «Nueva tarea» (vacío, título «Nueva tarea») o «Editar»
  (precargado, título «Editar tarea»). `showModal()`.
- **Campos, orden y reglas:**

| Campo | Control | Label | Reglas y ayuda |
| --- | --- | --- | --- |
| Título | `input#task-title` | «Título» | `required`, `maxlength=120`, autofocus; error «El título es obligatorio.» |
| Curso | `input#task-course` + `datalist#course-options` | «Curso» | `required`, `maxlength=60`; sugiere cursos existentes. |
| Tipo | `select#task-type` | «Tipo» | Tarea/Examen/Proyecto/Lectura. |
| Fecha de entrega | `input#task-due-date` | «Fecha de entrega» | `type="date"`; opcional; ayuda «Déjala vacía si no tiene fecha». |
| Prioridad | `select#task-priority` | «Prioridad» | Alta/Media/Baja. |
| Estado | `select#task-status` | «Estado» | Pendiente/En progreso/Completada. |
| Horas estimadas | `input#task-hours` | «Horas estimadas» | `type="number"`, `min=0`, `max=100`, `step=0.5`, `inputmode="decimal"`; ayuda «0–100 h». |
| Notas | `textarea#task-notes` | «Notas» | `maxlength=500`, filas 3; ayuda «Máximo 500 caracteres». |

- **Layout:** una columna a 360 px; dos columnas para Tipo/Prioridad y
  Fecha/Estado desde 768 px; Título, Curso y Notas a fila completa.
- **Validación:** al enviar; errores por campo en `p` con `id`
  (`task-title-error`, …) y `aria-describedby`; resumen en `#form-errors` con
  `aria-live="polite"`; `aria-invalid="true"` en el campo; foco al primer campo
  inválido.
- **Botones:** «Guardar tarea»/«Guardar cambios» (primario) y «Cancelar»
  (secundario). El botón de guardar no se deshabilita por errores previos: la
  validación ocurre al enviar y muestra los mensajes.
- **Cierre:** `Escape` y «Cancelar» descartan; clic en el backdrop no guarda. El
  foco vuelve al disparador.
- **Scroll:** el diálogo tiene `max-height: calc(100vh - 32px)` y scroll interno
  en el cuerpo; el encabezado y los botones quedan visibles.
- **Confirmación al cerrar con cambios:** no se implementa en v1; `Escape`
  descarta y se documenta en la ayuda del diálogo.

### 5.6 Diálogo de confirmación (`#confirm-dialog`)

- **Usos:** eliminar tarea, importar (reemplazo), restablecer datos.
- **Contenido:** `h2#confirm-title`, `p#confirm-message` con el impacto exacto
  («Se eliminará “Ensayo de historia”. Esta acción no se puede deshacer.»,
  «Se reemplazarán 6 tareas por 2 del archivo.», «Se borrarán tus tareas y se
  restaurarán los 6 ejemplos.»).
- **Botones:** «Cancelar» (foco inicial, seguro) y acción destructiva
  («Eliminar», «Importar», «Restablecer») con `--danger` cuando destruye datos.
- **Teclado:** `Escape` cancela; `Tab` circula entre los dos botones; el foco
  vuelve al disparador.
- **Éxito:** cierra, aplica la acción y muestra un toast.

### 5.7 Estado vacío (`#empty-state`)

- **Sin tareas:** título «Tu panel está vacío», mensaje «Crea tu primera tarea
  para empezar a organizar tu semana.» y botón «Crear tarea» que abre el
  diálogo. No se muestra la lista.
- **Sin resultados:** título «No hay tareas que coincidan», mensaje «Prueba con
  otro término o limpia los filtros.» y botón «Limpiar filtros». Se conserva la
  barra de filtros visible.
- **Diferencia:** el estado sin tareas no muestra filtros activos ni «Limpiar
  filtros»; el de sin resultados sí.
- **Accesibilidad:** el cambio se anuncia en `#task-count` o en el toast; el
  botón recibe foco solo cuando el usuario lo pide (no se roba el foco al
  filtrar).

### 5.8 Toasts (`#toast-region`)

- **Contenido:** mensaje corto + botón «Cerrar» con `aria-label`.
- **Variantes:** éxito (`--success`), error (`--danger`), información
  (`--accent`). Icono + texto, nunca solo color.
- **Comportamiento:** máximo 3 visibles; éxito/información 6 s; error 8 s; el
  cierre manual es siempre posible; pausa al pasar el ratón o enfocar.
- **Posición:** a 360 px, ancho completo sobre el borde inferior; desde 768 px,
  abajo a la derecha, máx. 360 px.
- **Accesibilidad:** `role="status"` y `aria-live="polite"` en el contenedor;
  los errores de guardado usan además `#storage-warning` persistente.
- **Movimiento:** entrada con desplazamiento y opacidad de 160 ms; con
  `prefers-reduced-motion` aparece sin desplazamiento.

### 5.9 Pie (`footer.app-footer`)

- **Contenido:** `#btn-export` («Exportar JSON»), `#btn-import` («Importar
  JSON»), `#btn-reset` («Restablecer datos»), `#storage-note` («6 tareas ·
  guardado 10:32») y `#storage-warning` (oculto por defecto; visible si falla el
  guardado, con texto «No se están guardando los cambios. Exporta tus datos.»).
- **Jerarquía:** exportar/importar son secundarios; restablecer es terciario y
  destructivo, separado visualmente.
- **Layout:** apilado a 360 px; fila con separación desde 768 px.
- **Accesibilidad:** botones reales, no enlaces; la nota de almacenamiento no es
  un live region (evita ruido), el aviso de fallo sí (`role="status"`).

### 5.10 Campos y botones base

- **Inputs/selects/textarea:** altura mínima 44 px, fondo `--surface`, borde 1 px
  `--border-strong`, radio `--radius-md`, texto `--text`; placeholder
  `--text-muted`.
- **Foco:** `outline: 3px solid var(--focus); outline-offset: 2px` en
  `:focus-visible`; nunca `outline: none` sin reemplazo.
- **Error:** borde `--danger`, mensaje `--text-sm` en `--danger`, icono de
  advertencia; `aria-invalid`.
- **Botón primario:** fondo `--accent`, texto `--on-accent`; hover
  `--accent-strong`; activo con desplazamiento de 1 px; deshabilitado con
  opacidad 0.6 y `cursor: not-allowed`.
- **Botón secundario:** fondo `--surface`, borde `--border-strong`, texto
  `--text`.
- **Botón destructivo:** texto `--danger`, borde `--danger`; en confirmación,
  fondo `--danger` y texto blanco/`--on-accent` con contraste verificado.

## 6. Estados globales

| Estado | Comportamiento visual | Anuncio |
| --- | --- | --- |
| Vacío inicial | `#empty-state` con «Tu panel está vacío»; métricas en 0; sin tarjetas. | «Tu panel está vacío.» en el estado; sin toast. |
| Sin resultados | `#empty-state` con «No hay tareas que coincidan»; filtros visibles. | `#task-count` «0 tareas». |
| Error de lectura | Se cargan ejemplos; toast de error y `#storage-warning` si persiste. | Toast «No se pudieron leer tus datos…». |
| Error de guardado | `#storage-warning` visible; toast de error. | `role="status"` + toast. |
| Éxito al guardar | Cierre del diálogo; tarjeta nueva/actualizada; toast de éxito. | «Tarea creada/actualizada». |
| Importación exitosa | Lista reemplazada; toast de éxito. | «N tareas importadas». |
| Importación fallida | Nada cambia; toast de error. | Mensaje con el motivo. |
| Eliminación | Confirmación → tarjeta desaparece; toast. | «Tarea eliminada». |
| Vencida | Tarjeta con borde y fecha en `--danger`, texto «Vencida». | Sin anuncio adicional. |
| Carga/importación en curso | Botones de importar/restablecer `disabled`; sin spinner persistente. | «Importando…» en `#storage-note` si supera 300 ms. |

No hay estado de carga de datos remotos: todo es local y síncrono.

## 7. Accesibilidad

- [ ] Un solo `h1`; `h2` por sección; `h3` por tarjeta; sin saltos.
- [ ] Landmarks: `header`, `main`, `footer`, `form[role="search"]`.
- [ ] Enlace «Saltar al contenido» como primer elemento enfocable.
- [ ] Todos los controles con `label` real y `for`/`id`; ayudas con
      `aria-describedby`.
- [ ] Errores junto al campo y resumen en `#form-errors` con `aria-live`.
- [ ] `aria-invalid` refleja el estado real.
- [ ] Diálogos: foco inicial, ciclo de `Tab`, `Escape`, restauración de foco.
- [ ] `aria-live="polite"` en `#task-count` y `#toast-region`; sin duplicar
      anuncios.
- [ ] Foco visible en todos los interactivos, incluidos los de las tarjetas.
- [ ] Contraste AA: texto normal ≥ 4.5:1; texto grande ≥ 3:1; controles y foco
      ≥ 3:1.
- [ ] El color no es el único portador: prioridad, estado y vencimiento llevan
      texto.
- [ ] Objetivos táctiles ≥ 44×44 px.
- [ ] `prefers-reduced-motion: reduce` desactiva transiciones y animaciones no
      esenciales.
- [ ] Sin scroll horizontal a 360 px; el diálogo cabe y hace scroll interno.
- [ ] Orden de tabulación = orden visual; sin trampas fuera de los diálogos.

### Contraste verificado (aproximado, AA)

| Combinación | Ratio | Uso |
| --- | --- | --- |
| `#172033` sobre `#f4f6fb` | ≈ 14.5:1 | Texto principal claro. |
| `#5d6b85` sobre `#ffffff` | ≈ 5.4:1 | Texto secundario claro. |
| `#ffffff` sobre `#3557d6` | ≈ 6.0:1 | Botón primario. |
| `#b42318` sobre `#fee9e7` | ≈ 5.6:1 | Prioridad alta / error. |
| `#9a5b00` sobre `#fff2d9` | ≈ 5.9:1 | Prioridad media. |
| `#3557d6` sobre `#e6ecff` | ≈ 5.0:1 | Prioridad baja / en progreso. |
| `#eef2fb` sobre `#151d2e` | ≈ 14.8:1 | Texto principal oscuro. |
| `#a9b6d0` sobre `#151d2e` | ≈ 8.3:1 | Texto secundario oscuro. |
| `#ff8f86` sobre `#3d1715` | ≈ 7.2:1 | Prioridad alta oscura. |
| `#ffd166` sobre `#3a2a0a` | ≈ 9.6:1 | Prioridad media oscura. |
| `#8ea6ff` sobre `#1e2d55` | ≈ 5.7:1 | Prioridad baja oscura. |
| `#b45309` sobre `#ffffff` | ≈ 5.0:1 | Anillo de foco claro. |

Los ratios son de referencia; Tester debe confirmar con un medidor de contraste
y reportar cualquier desviación como S3.

## 8. Criterios de aceptación visual

1. **VA-1 Jerarquía:** un solo `h1`, `h2` «Resumen» y «Tareas», `h3` por tarjeta;
   el orden del DOM coincide con el visual.
2. **VA-2 Sin scroll horizontal:** a 360 px,
   `document.documentElement.scrollWidth <= clientWidth`; ningún texto se sale de
   su tarjeta.
3. **VA-3 Métricas:** se ven las siete; «Avance» muestra porcentaje y barra; las
   cifras usan números tabulares y se actualizan sin recargar.
4. **VA-4 Foco:** todo interactivo muestra un anillo de 3 px con offset 2 px;
   ningún control tiene `outline: none` sin reemplazo.
5. **VA-5 Prioridad:** las tres prioridades se distinguen por texto y color;
   ninguna tarjeta depende solo del borde.
6. **VA-6 Vencida:** una tarea vencida muestra «Vencida» y la fecha en
   `--danger`, además del borde; una completada no muestra «Vencida».
7. **VA-7 Diálogo a 360:** cabe en el viewport, hace scroll interno, el título y
   los botones son visibles, y el foco entra en «Título».
8. **VA-8 Contraste:** las combinaciones de la tabla §7 cumplen AA en ambos
   temas.
9. **VA-9 Tema:** el cambio es inmediato, no hay destello al recargar, y el modo
   oscuro no usa inversión ni texto blanco puro sobre negro puro.
10. **VA-10 Movimiento reducido:** con `prefers-reduced-motion: reduce` no hay
    desplazamientos ni transiciones; los toasts aparecen sin animación.
11. **VA-11 Toasts:** visible, anunciado, con cierre manual; máximo 3; no tapa
    el botón primario en 360 px.
12. **VA-12 Objetivos táctiles:** todos los botones y controles miden al menos
    44×44 px, incluidas las acciones de tarjeta.
13. **VA-13 Rejilla:** 1 columna a 360, 2 a 768, 3 a 1280; el contenedor no
    supera 1200 px.
14. **VA-14 Estados vacíos:** «sin tareas» y «sin resultados» son distintos y
    ofrecen la acción correcta.
15. **VA-15 Formulario:** los ocho campos tienen label visible; los errores
    aparecen junto al campo y en el resumen; `aria-invalid` cambia.
16. **VA-16 Confirmación:** eliminar, importar y restablecer usan el diálogo de
    confirmación con impacto explícito y foco inicial en «Cancelar».
