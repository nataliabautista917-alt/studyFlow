/**
 * StudyFlow — interfaz (ARCHITECTURE.md §3.3 y §3.4).
 *
 * Este módulo solo orquesta: lee y escribe a través de `domain.js` y
 * `storage.js`, nunca implementa reglas de negocio. Los datos del usuario se
 * pintan siempre con `textContent` (nunca `innerHTML`), el render es por
 * regiones para no recrear los controles de filtro mientras se escribe y cada
 * mutación sigue el orden calcular → persistir → renderizar → anunciar.
 */

import {
  DEFAULT_FILTERS,
  PRIORITY_LABELS,
  SORT_OPTIONS,
  STATUS_LABELS,
  TYPE_LABELS,
  changeTaskStatus,
  computeStats,
  createSampleTasks,
  createTask,
  defaultIdFactory,
  deleteTask,
  findTask,
  formatDateEs,
  getCourses,
  isOverdue,
  selectTasks,
  updateTask,
  validateTaskInput,
} from "./domain.js";

import {
  clearTasks,
  createSafeStorage,
  exportTasks,
  importTasks,
  loadTasks,
  loadTheme,
  saveTasks,
  saveTheme,
} from "./storage.js";

/** Número de tareas de ejemplo sembradas (ARCHITECTURE.md §3.1). */
const SAMPLE_TASKS_COUNT = 6;
/** Retardo del render de la lista mientras se escribe en la búsqueda. */
const SEARCH_DEBOUNCE_MS = 200;
/** Máximo de toasts visibles simultáneamente (UI_SPEC §5.8). */
const TOAST_LIMIT = 3;
const TOAST_DURATION_MS = Object.freeze({ success: 6000, info: 6000, error: 8000 });
/** Tamaño máximo aceptado al importar (ARCHITECTURE.md §3.3). */
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
/** Si una importación tarda más que esto, la nota de almacenamiento lo dice. */
const BUSY_NOTICE_MS = 300;

const TIME_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Acciones de estado disponibles según el estado actual de la tarjeta. */
const STATUS_ACTIONS = Object.freeze({
  pendiente: Object.freeze([
    Object.freeze({ action: "start", label: "Iniciar" }),
    Object.freeze({ action: "complete", label: "Completar" }),
  ]),
  en_progreso: Object.freeze([
    Object.freeze({ action: "complete", label: "Completar" }),
    Object.freeze({ action: "pause", label: "Pausar" }),
  ]),
  completada: Object.freeze([Object.freeze({ action: "reopen", label: "Reabrir" })]),
});

const STATUS_TRANSITIONS = Object.freeze({
  start: Object.freeze({ status: "en_progreso", message: "Tarea iniciada" }),
  pause: Object.freeze({ status: "pendiente", message: "Tarea pausada" }),
  complete: Object.freeze({ status: "completada", message: "Tarea completada" }),
  reopen: Object.freeze({ status: "pendiente", message: "Tarea reabierta" }),
});

/** Campo del formulario → control. */
const FIELD_INPUT_IDS = Object.freeze({
  title: "task-title",
  course: "task-course",
  type: "task-type",
  dueDate: "task-due-date",
  priority: "task-priority",
  status: "task-status",
  estimatedHours: "task-hours",
  notes: "task-notes",
});

/** Campo del formulario → párrafo de error (contrato del DOM §3.4). */
const FIELD_ERROR_IDS = Object.freeze({
  title: "task-title-error",
  course: "task-course-error",
  type: "task-type-error",
  dueDate: "task-due-date-error",
  priority: "task-priority-error",
  status: "task-status-error",
  estimatedHours: "task-hours-error",
  notes: "task-notes-error",
});

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

function formatHours(hours) {
  return String(hours).replace(".", ",");
}

function pluralTasks(count) {
  return `${count} ${count === 1 ? "tarea" : "tareas"}`;
}

/**
 * Arranca la aplicación sobre un documento dado.
 *
 * @param {{
 *   doc?: Document,
 *   storage?: { getItem: Function, setItem: Function, removeItem: Function },
 *   now?: () => Date,
 *   idFactory?: () => string,
 * }} [options]
 * @returns {{ refresh: () => void, destroy: () => void }}
 */
export function initApp(options = {}) {
  const doc = options.doc ?? globalThis.document;
  if (!doc || typeof doc.getElementById !== "function") {
    throw new Error("StudyFlow necesita un documento con getElementById.");
  }

  const storage = options.storage ?? createSafeStorage();
  const now = typeof options.now === "function" ? options.now : () => new Date();
  const idFactory = typeof options.idFactory === "function" ? options.idFactory : defaultIdFactory;

  const state = {
    tasks: [],
    filters: { ...DEFAULT_FILTERS },
    sortBy: "dueDate",
    editingId: null,
    theme: "light",
    storageOk: true,
    lastSavedAt: null,
  };

  const byId = (id) => doc.getElementById(id);

  const els = {
    skipLink: byId("skip-link"),
    themeToggle: byId("theme-toggle"),
    themeIcon: byId("theme-icon"),
    btnNewTask: byId("btn-new-task"),
    dashboard: byId("dashboard"),
    statTotal: byId("stat-total"),
    statPending: byId("stat-pending"),
    statInProgress: byId("stat-in-progress"),
    statCompleted: byId("stat-completed"),
    statOverdue: byId("stat-overdue"),
    statUpcoming: byId("stat-upcoming"),
    statProgress: byId("stat-progress"),
    progressBar: byId("progress-bar"),
    tasksTitle: byId("tasks-title"),
    taskCount: byId("task-count"),
    filtersForm: byId("filters-form"),
    searchInput: byId("search-input"),
    filterStatus: byId("filter-status"),
    filterCourse: byId("filter-course"),
    filterPriority: byId("filter-priority"),
    filterType: byId("filter-type"),
    sortBy: byId("sort-by"),
    btnClearFilters: byId("btn-clear-filters"),
    taskList: byId("task-list"),
    emptyState: byId("empty-state"),
    emptyTitle: byId("empty-title"),
    emptyMessage: byId("empty-message"),
    btnEmptyAction: byId("btn-empty-action"),
    toastRegion: byId("toast-region"),
    storageNote: byId("storage-note"),
    storageWarning: byId("storage-warning"),
    btnExport: byId("btn-export"),
    btnImport: byId("btn-import"),
    importFile: byId("import-file"),
    btnReset: byId("btn-reset"),
    taskDialog: byId("task-dialog"),
    taskDialogTitle: byId("task-dialog-title"),
    taskForm: byId("task-form"),
    taskId: byId("task-id"),
    taskTitle: byId("task-title"),
    taskCourse: byId("task-course"),
    taskType: byId("task-type"),
    taskDueDate: byId("task-due-date"),
    taskPriority: byId("task-priority"),
    taskStatus: byId("task-status"),
    taskHours: byId("task-hours"),
    taskNotes: byId("task-notes"),
    courseOptions: byId("course-options"),
    formErrors: byId("form-errors"),
    btnSaveTask: byId("btn-save-task"),
    btnCancelTask: byId("btn-cancel-task"),
    confirmDialog: byId("confirm-dialog"),
    confirmTitle: byId("confirm-title"),
    confirmMessage: byId("confirm-message"),
    btnConfirm: byId("btn-confirm"),
    btnCancelConfirm: byId("btn-cancel-confirm"),
  };

  const listeners = [];
  const toastTimers = new Map();
  let listTimer = null;
  let busyTimer = null;
  let lastFocused = null;
  let lastFocusedAction = null;

  /* -------------------------------------------------------------- */
  /* Utilidades                                                     */
  /* -------------------------------------------------------------- */

  function on(target, type, handler, listenerOptions) {
    if (!target || typeof target.addEventListener !== "function") return;
    target.addEventListener(type, handler, listenerOptions);
    listeners.push([target, type, handler, listenerOptions]);
  }

  function setText(node, value) {
    if (node) node.textContent = String(value);
  }

  function setValue(node, value) {
    if (node) node.value = String(value ?? "");
  }

  function showModal(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
      return;
    }
    dialog.setAttribute("open", "");
  }

  function closeModal(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function") {
      if (dialog.open) dialog.close();
      return;
    }
    dialog.removeAttribute("open");
  }

  function getFocusable(root) {
    if (!root || typeof root.querySelectorAll !== "function") return [];
    return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
      (node) => node.hidden !== true && node.getAttribute("aria-hidden") !== "true",
    );
  }

  function focusElement(node) {
    if (node && typeof node.focus === "function") node.focus();
  }

  /** Devuelve el foco al disparador; si desapareció, al encabezado de tareas. */
  function restoreFocus() {
    const candidates = [];
    if (lastFocusedAction) {
      const card = findCardElement(lastFocusedAction.id);
      if (card) {
        candidates.push(card.querySelector(`button[data-action="${lastFocusedAction.action}"]`));
        candidates.push(card.querySelector("button[data-action]"));
      }
    }
    candidates.push(lastFocused, els.tasksTitle, els.skipLink);

    for (const candidate of candidates) {
      if (!candidate) continue;
      if (candidate.isConnected === false) continue;
      if (typeof candidate.focus === "function") {
        candidate.focus();
        lastFocused = null;
        lastFocusedAction = null;
        return;
      }
    }
    lastFocused = null;
    lastFocusedAction = null;
  }

  function findCardElement(id) {
    if (!els.taskList || typeof els.taskList.querySelectorAll !== "function") return null;
    const cards = els.taskList.querySelectorAll("article.task-card");
    for (const card of cards) {
      if (card.dataset && card.dataset.id === id) return card;
    }
    return null;
  }

  function trapFocus(dialog) {
    return (event) => {
      if (event.key !== "Tab") return;
      const focusables = getFocusable(dialog);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = doc.activeElement;
      const inside = typeof dialog.contains === "function" ? dialog.contains(active) : false;
      if (event.shiftKey && (active === first || !inside)) {
        event.preventDefault();
        focusElement(last);
      } else if (!event.shiftKey && (active === last || !inside)) {
        event.preventDefault();
        focusElement(first);
      }
    };
  }

  /* -------------------------------------------------------------- */
  /* Toasts (UI_SPEC §5.8)                                          */
  /* -------------------------------------------------------------- */

  function clearToastTimer(node) {
    const timer = toastTimers.get(node);
    if (timer) {
      clearTimeout(timer);
      toastTimers.delete(node);
    }
  }

  function showToast(kind, message) {
    const region = els.toastRegion;
    if (!region) return;

    while (region.children.length >= TOAST_LIMIT && region.firstElementChild) {
      const oldest = region.firstElementChild;
      clearToastTimer(oldest);
      oldest.remove();
    }

    const toast = doc.createElement("div");
    toast.className = `toast toast--${kind}`;
    toast.dataset.kind = kind;

    const icon = doc.createElement("span");
    icon.className = "toast__icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = kind === "error" ? "⚠" : kind === "success" ? "✓" : "ℹ";

    const text = doc.createElement("span");
    text.className = "toast__text";
    text.textContent = String(message ?? "");

    const close = doc.createElement("button");
    close.type = "button";
    close.className = "toast__close";
    close.setAttribute("aria-label", "Cerrar aviso");
    close.textContent = "×";

    toast.append(icon, text, close);
    region.append(toast);

    const dismiss = () => {
      clearToastTimer(toast);
      toast.remove();
    };
    const duration = kind === "error" ? TOAST_DURATION_MS.error : TOAST_DURATION_MS.info;
    const startTimer = () => {
      clearToastTimer(toast);
      toastTimers.set(toast, setTimeout(dismiss, duration));
    };
    const pauseTimer = () => clearToastTimer(toast);

    close.addEventListener("click", dismiss);
    toast.addEventListener("mouseenter", pauseTimer);
    toast.addEventListener("mouseleave", startTimer);
    toast.addEventListener("focusin", pauseTimer);
    toast.addEventListener("focusout", startTimer);
    startTimer();
  }

  /* -------------------------------------------------------------- */
  /* Persistencia                                                   */
  /* -------------------------------------------------------------- */

  function setStorageWarning(visible) {
    if (!els.storageWarning) return;
    if (visible) els.storageWarning.removeAttribute("hidden");
    else els.storageWarning.setAttribute("hidden", "");
  }

  /**
   * Persiste el estado en memoria. Si falla, el estado NO se revierte:
   * se marca `storageOk = false` y se avisa de forma persistente.
   */
  function persist({ notify = true } = {}) {
    const stamp = now();
    const result = saveTasks(storage, state.tasks, { now: stamp });

    state.storageOk = result.ok;
    if (result.ok) state.lastSavedAt = stamp;
    setStorageWarning(!result.ok);

    if (!result.ok && notify) {
      showToast("error", "No se pudieron guardar los cambios. Exporta tus datos.");
    }

    renderStorageNote();
    return result.ok;
  }

  /* -------------------------------------------------------------- */
  /* Render por regiones                                            */
  /* -------------------------------------------------------------- */

  function renderStats() {
    const stats = computeStats(state.tasks, { today: now() });
    setText(els.statTotal, stats.total);
    setText(els.statPending, stats.pending);
    setText(els.statInProgress, stats.inProgress);
    setText(els.statCompleted, stats.completed);
    setText(els.statOverdue, stats.overdue);
    setText(els.statUpcoming, stats.upcoming7);
    setText(els.statProgress, `${stats.completionRate} %`);

    if (els.statOverdue) {
      els.statOverdue.classList.toggle("stat__value--danger", stats.overdue > 0);
    }
    if (els.progressBar) {
      els.progressBar.value = stats.completionRate;
      els.progressBar.setAttribute("aria-valuetext", `${stats.completionRate} %`);
    }
  }

  function renderCourses() {
    const courses = getCourses(state.tasks);

    if (els.filterCourse) {
      const previous = state.filters.course;
      els.filterCourse.replaceChildren();
      const all = doc.createElement("option");
      all.value = "";
      all.textContent = "Todos los cursos";
      els.filterCourse.append(all);
      for (const course of courses) {
        const option = doc.createElement("option");
        option.value = course;
        option.textContent = course;
        els.filterCourse.append(option);
      }
      const keep = courses.includes(previous) ? previous : "";
      els.filterCourse.value = keep;
      state.filters.course = keep;
    }

    if (els.courseOptions) {
      els.courseOptions.replaceChildren();
      for (const course of courses) {
        const option = doc.createElement("option");
        option.value = course;
        els.courseOptions.append(option);
      }
    }
  }

  function createBadge(className, text) {
    const badge = doc.createElement("span");
    badge.className = className;
    badge.textContent = text;
    return badge;
  }

  function createActionButton(action, label, task) {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "btn btn--small btn--secondary";
    button.dataset.action = action;
    button.dataset.id = task.id;
    button.textContent = label;
    if (action === "delete") {
      button.classList.add("btn--danger");
      button.setAttribute("aria-label", `Eliminar tarea ${task.title}`);
    } else if (action === "edit") {
      button.setAttribute("aria-label", `Editar tarea ${task.title}`);
    }
    return button;
  }

  function createCard(task) {
    const overdue = isOverdue(task, now());

    const item = doc.createElement("li");
    item.className = "task-list__item";

    const card = doc.createElement("article");
    card.className = "task-card";
    card.dataset.id = task.id;
    card.dataset.status = task.status;
    card.dataset.priority = task.priority;
    card.dataset.overdue = overdue ? "true" : "false";
    card.setAttribute("aria-labelledby", `task-title-${task.id}`);

    const head = doc.createElement("div");
    head.className = "task-card__head";
    head.append(
      createBadge("task-card__badge task-card__badge--type", TYPE_LABELS[task.type] ?? task.type),
      createBadge(
        `task-card__badge task-card__badge--priority is-${task.priority}`,
        PRIORITY_LABELS[task.priority] ?? task.priority,
      ),
    );
    if (overdue) {
      head.append(createBadge("task-card__badge task-card__badge--overdue", "Vencida"));
    }

    const title = doc.createElement("h3");
    title.className = "task-card__title";
    title.id = `task-title-${task.id}`;
    title.textContent = task.title;

    const meta = doc.createElement("div");
    meta.className = "task-card__meta";

    const course = doc.createElement("span");
    course.className = "task-card__course";
    course.textContent = task.course;
    meta.append(course);

    if (task.dueDate !== "") {
      const time = doc.createElement("time");
      time.className = overdue ? "task-card__date is-overdue" : "task-card__date";
      time.dateTime = task.dueDate;
      time.textContent = formatDateEs(task.dueDate);
      meta.append(time);
    }

    if (task.estimatedHours > 0) {
      const hours = doc.createElement("span");
      hours.className = "task-card__hours";
      hours.textContent = `${formatHours(task.estimatedHours)} h`;
      meta.append(hours);
    }

    const status = createBadge(
      `task-card__status is-${task.status}`,
      STATUS_LABELS[task.status] ?? task.status,
    );

    const actions = doc.createElement("div");
    actions.className = "task-card__actions";
    for (const statusAction of STATUS_ACTIONS[task.status] ?? []) {
      actions.append(createActionButton(statusAction.action, statusAction.label, task));
    }
    actions.append(createActionButton("edit", "Editar", task));
    actions.append(createActionButton("delete", "Eliminar", task));

    card.append(head, title, meta, status);
    if (task.notes !== "") {
      const notes = doc.createElement("p");
      notes.className = "task-card__notes";
      notes.textContent = task.notes;
      notes.title = task.notes;
      card.append(notes);
    }
    card.append(actions);
    item.append(card);
    return item;
  }

  function renderEmptyState(visibleCount) {
    const empty = state.tasks.length === 0;
    const noResults = !empty && visibleCount === 0;

    if (els.taskList) {
      if (visibleCount === 0) els.taskList.setAttribute("hidden", "");
      else els.taskList.removeAttribute("hidden");
    }

    if (!els.emptyState) return;

    if (visibleCount > 0) {
      els.emptyState.setAttribute("hidden", "");
      return;
    }

    els.emptyState.removeAttribute("hidden");
    if (empty) {
      setText(els.emptyTitle, "Tu panel está vacío");
      setText(els.emptyMessage, "Crea tu primera tarea para empezar a organizar tu semana.");
      setText(els.btnEmptyAction, "Crear tarea");
      if (els.btnEmptyAction) els.btnEmptyAction.dataset.emptyAction = "new";
    } else if (noResults) {
      setText(els.emptyTitle, "No hay tareas que coincidan");
      setText(els.emptyMessage, "Prueba con otro término o limpia los filtros.");
      setText(els.btnEmptyAction, "Limpiar filtros");
      if (els.btnEmptyAction) els.btnEmptyAction.dataset.emptyAction = "clear";
    }
  }

  function renderList() {
    const visible = selectTasks(state.tasks, {
      filters: state.filters,
      sortBy: state.sortBy,
    });

    if (els.taskList) {
      els.taskList.replaceChildren(...visible.map((task) => createCard(task)));
    }
    setText(els.taskCount, pluralTasks(visible.length));
    renderEmptyState(visible.length);
    updateClearButton();
  }

  function renderStorageNote() {
    if (!els.storageNote) return;
    const saved = state.lastSavedAt ? TIME_FORMATTER.format(state.lastSavedAt) : null;
    const suffix = saved ? `guardado a las ${saved}` : "sin guardar";
    setText(els.storageNote, `${pluralTasks(state.tasks.length)} · ${suffix}`);
  }

  function hasActiveFilters() {
    const { query, status, course, priority, type } = state.filters;
    return (
      String(query ?? "").trim() !== "" ||
      status !== "" ||
      course !== "" ||
      priority !== "" ||
      type !== ""
    );
  }

  function updateClearButton() {
    if (els.btnClearFilters) els.btnClearFilters.disabled = !hasActiveFilters();
  }

  function renderAll() {
    renderStats();
    renderCourses();
    renderList();
    renderStorageNote();
  }

  /* -------------------------------------------------------------- */
  /* Filtros y orden                                                */
  /* -------------------------------------------------------------- */

  function readFiltersFromForm() {
    state.filters = {
      query: els.searchInput ? els.searchInput.value : "",
      status: els.filterStatus ? els.filterStatus.value : "",
      course: els.filterCourse ? els.filterCourse.value : "",
      priority: els.filterPriority ? els.filterPriority.value : "",
      type: els.filterType ? els.filterType.value : "",
    };
  }

  function syncFilterControls() {
    setValue(els.searchInput, state.filters.query);
    setValue(els.filterStatus, state.filters.status);
    setValue(els.filterCourse, state.filters.course);
    setValue(els.filterPriority, state.filters.priority);
    setValue(els.filterType, state.filters.type);
    setValue(els.sortBy, state.sortBy);
  }

  function scheduleListRender(delay) {
    if (listTimer) clearTimeout(listTimer);
    listTimer = setTimeout(() => {
      listTimer = null;
      renderList();
    }, delay);
  }

  function handleFilterEvent(event) {
    const target = event.target;
    if (!target || target === els.filtersForm) return;

    if (target === els.searchInput) {
      state.filters.query = target.value;
      updateClearButton();
      scheduleListRender(SEARCH_DEBOUNCE_MS);
      return;
    }

    readFiltersFromForm();
    updateClearButton();
    scheduleListRender(0);
  }

  function clearFilters() {
    state.filters = { ...DEFAULT_FILTERS };
    syncFilterControls();
    renderList();
  }

  /* -------------------------------------------------------------- */
  /* Tema                                                           */
  /* -------------------------------------------------------------- */

  function applyTheme(theme) {
    state.theme = theme === "dark" ? "dark" : "light";
    const root = doc.documentElement;
    if (root && root.dataset) root.dataset.theme = state.theme;

    if (els.themeToggle) {
      const isDark = state.theme === "dark";
      els.themeToggle.setAttribute("aria-pressed", isDark ? "true" : "false");
      els.themeToggle.setAttribute(
        "aria-label",
        isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro",
      );
    }
    if (els.themeIcon) els.themeIcon.textContent = state.theme === "dark" ? "☀️" : "🌙";
  }

  function resolveTheme() {
    const stored = loadTheme(storage);
    if (stored !== null) return stored;
    const media =
      typeof globalThis.matchMedia === "function"
        ? globalThis.matchMedia("(prefers-color-scheme: dark)")
        : null;
    return media && media.matches ? "dark" : "light";
  }

  function toggleTheme() {
    const next = state.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    const result = saveTheme(storage, next);
    if (!result.ok) showToast("error", "No se pudo guardar tu preferencia de tema.");
  }

  /* -------------------------------------------------------------- */
  /* Diálogo de tarea                                               */
  /* -------------------------------------------------------------- */

  function fieldInput(field) {
    return byId(FIELD_INPUT_IDS[field]);
  }

  function clearFormErrors() {
    for (const errorId of Object.values(FIELD_ERROR_IDS)) {
      const node = byId(errorId);
      if (!node) continue;
      node.textContent = "";
      node.removeAttribute("hidden");
    }
    for (const field of Object.keys(FIELD_INPUT_IDS)) {
      const input = fieldInput(field);
      if (!input) continue;
      input.removeAttribute("aria-invalid");
      input.classList.remove("is-invalid");
    }
    if (els.formErrors) {
      els.formErrors.textContent = "";
      els.formErrors.removeAttribute("hidden");
    }
  }

  function showFormErrors(errors) {
    clearFormErrors();
    const fields = Object.keys(errors ?? {});
    if (fields.length === 0) return;

    const messages = [];
    for (const field of fields) {
      const message = String(errors[field]);
      messages.push(message);
      const errorNode = byId(FIELD_ERROR_IDS[field]);
      if (errorNode) errorNode.textContent = message;
      const input = fieldInput(field);
      if (input) {
        input.setAttribute("aria-invalid", "true");
        input.classList.add("is-invalid");
      }
    }

    if (els.formErrors) {
      els.formErrors.textContent =
        fields.length === 1
          ? messages[0]
          : `Revisa ${fields.length} campos: ${messages.join(" ")}`;
    }

    const first = fieldInput(fields[0]);
    focusElement(first);
  }

  function readFormValues() {
    const values = {};
    for (const [field, id] of Object.entries(FIELD_INPUT_IDS)) {
      const input = byId(id);
      values[field] = input ? input.value : "";
    }
    return values;
  }

  function openTaskDialog(task = null, trigger = null) {
    state.editingId = task ? task.id : null;
    lastFocused = trigger ?? doc.activeElement;
    lastFocusedAction = task ? { id: task.id, action: "edit" } : null;

    setText(els.taskDialogTitle, task ? "Editar tarea" : "Nueva tarea");
    setText(els.btnSaveTask, task ? "Guardar cambios" : "Guardar tarea");

    if (els.taskForm && typeof els.taskForm.reset === "function") els.taskForm.reset();
    clearFormErrors();
    setValue(els.taskId, task ? task.id : "");

    if (task) {
      setValue(els.taskTitle, task.title);
      setValue(els.taskCourse, task.course);
      setValue(els.taskType, task.type);
      setValue(els.taskDueDate, task.dueDate);
      setValue(els.taskPriority, task.priority);
      setValue(els.taskStatus, task.status);
      setValue(els.taskHours, String(task.estimatedHours));
      setValue(els.taskNotes, task.notes);
    } else {
      setValue(els.taskTitle, "");
      setValue(els.taskCourse, "");
      setValue(els.taskType, "tarea");
      setValue(els.taskDueDate, "");
      setValue(els.taskPriority, "media");
      setValue(els.taskStatus, "pendiente");
      setValue(els.taskHours, "0");
      setValue(els.taskNotes, "");
    }

    showModal(els.taskDialog);
    focusElement(els.taskTitle);
    if (els.taskTitle && typeof els.taskTitle.select === "function") els.taskTitle.select();
  }

  function submitTaskForm() {
    const values = readFormValues();
    const { valid, errors } = validateTaskInput(values);

    if (!valid) {
      showFormErrors(errors);
      showToast("error", "Revisa los campos marcados antes de guardar.");
      return;
    }

    clearFormErrors();

    if (state.editingId !== null) {
      const current = findTask(state.tasks, state.editingId);
      if (!current) {
        showFormErrors({ title: "La tarea ya no existe." });
        return;
      }
      const updated = updateTask(current, values, { now: now() });
      state.tasks = state.tasks.map((task) => (task.id === updated.id ? updated : task));
      closeModal(els.taskDialog);
      applyMutation("Tarea actualizada");
      return;
    }

    const created = createTask(values, { now: now(), idFactory });
    state.tasks = [...state.tasks, created];
    closeModal(els.taskDialog);
    applyMutation("Tarea creada");
  }

  /* -------------------------------------------------------------- */
  /* Confirmación genérica                                          */
  /* -------------------------------------------------------------- */

  function confirmAction({ title, message, confirmLabel = "Confirmar", danger = true }) {
    return new Promise((resolve) => {
      let settled = false;
      lastFocused = doc.activeElement;
      lastFocusedAction = null;

      const finish = (value) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      };

      const cleanup = () => {
        if (els.btnConfirm) els.btnConfirm.removeEventListener("click", onConfirm);
        if (els.btnCancelConfirm) {
          els.btnCancelConfirm.removeEventListener("click", onCancel);
        }
        if (els.confirmDialog) els.confirmDialog.removeEventListener("close", onClose);
      };

      const onConfirm = () => {
        finish(true);
        closeModal(els.confirmDialog);
      };
      const onCancel = () => {
        finish(false);
        closeModal(els.confirmDialog);
      };
      const onClose = () => finish(false);

      setText(els.confirmTitle, title);
      setText(els.confirmMessage, message);
      setText(els.btnConfirm, confirmLabel);
      if (els.btnConfirm) els.btnConfirm.classList.toggle("btn--danger", danger !== false);

      on(els.btnConfirm, "click", onConfirm);
      on(els.btnCancelConfirm, "click", onCancel);
      on(els.confirmDialog, "close", onClose);

      showModal(els.confirmDialog);
      focusElement(els.btnCancelConfirm);
    });
  }

  /* -------------------------------------------------------------- */
  /* Mutaciones                                                     */
  /* -------------------------------------------------------------- */

  /** calcular → persistir → renderizar → anunciar. */
  function applyMutation(message) {
    persist();
    renderAll();
    if (message) showToast("success", message);
  }

  async function handleDelete(task, trigger) {
    lastFocusedAction = { id: task.id, action: "delete" };
    const confirmed = await confirmAction({
      title: "Eliminar tarea",
      message: `Se eliminará “${task.title}”. Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar",
      danger: true,
    });

    if (!confirmed) {
      restoreFocus();
      return;
    }

    state.tasks = deleteTask(state.tasks, task.id);
    applyMutation("Tarea eliminada");
    lastFocused = trigger;
    restoreFocus();
  }

  function handleStatusAction(action, id) {
    const transition = STATUS_TRANSITIONS[action];
    if (!transition) return;
    const task = findTask(state.tasks, id);
    if (!task) return;

    state.tasks = changeTaskStatus(state.tasks, id, transition.status, { now: now() });
    lastFocusedAction = { id, action };
    persist();
    renderStats();
    renderList();
    renderStorageNote();
    showToast("success", transition.message);
    focusTaskCard(id);
  }

  function focusTaskCard(id) {
    const card = findCardElement(id);
    if (!card) {
      restoreFocus();
      return;
    }
    const button = card.querySelector("button[data-action]");
    focusElement(button ?? els.tasksTitle);
  }

  function handleCardAction(event) {
    const target = event.target;
    if (!target || typeof target.closest !== "function") return;
    const button = target.closest("button[data-action]");
    if (!button) return;
    if (els.taskList && !els.taskList.contains(button)) return;

    const { action, id } = button.dataset;
    if (!action || !id) return;
    const task = findTask(state.tasks, id);
    if (!task) return;

    if (action === "edit") {
      openTaskDialog(task, button);
      return;
    }
    if (action === "delete") {
      handleDelete(task, button);
      return;
    }
    if (STATUS_TRANSITIONS[action]) handleStatusAction(action, id);
  }

  /* -------------------------------------------------------------- */
  /* Importar, exportar y restablecer                               */
  /* -------------------------------------------------------------- */

  function setBusy(busy) {
    for (const button of [els.btnImport, els.btnReset]) {
      if (button) button.disabled = busy;
    }
    if (busyTimer) {
      clearTimeout(busyTimer);
      busyTimer = null;
    }
    if (busy) {
      busyTimer = setTimeout(() => {
        busyTimer = null;
        setText(els.storageNote, "Importando…");
      }, BUSY_NOTICE_MS);
    } else {
      renderStorageNote();
    }
  }

  function handleExport() {
    try {
      const { json, filename } = exportTasks(state.tasks, { now: now() });
      const urlApi = globalThis.URL;
      const blobApi = globalThis.Blob;
      if (!urlApi || !blobApi) {
        showToast("error", "Tu navegador no permite descargar archivos.");
        return;
      }
      const url = urlApi.createObjectURL(new blobApi([json], { type: "application/json" }));
      const link = doc.createElement("a");
      link.href = url;
      link.download = filename;
      link.rel = "noopener";
      link.setAttribute("hidden", "");
      if (doc.body) doc.body.append(link);
      link.click();
      link.remove();
      urlApi.revokeObjectURL(url);
      showToast("success", `${pluralTasks(state.tasks.length)} exportadas.`);
    } catch {
      showToast("error", "No se pudieron exportar las tareas.");
    }
  }

  async function handleImportFile() {
    const input = els.importFile;
    const file = input && input.files ? input.files[0] : null;
    if (!file) return;

    setBusy(true);
    try {
      if (typeof file.size === "number" && file.size > MAX_IMPORT_BYTES) {
        showToast("error", "El archivo supera el límite de 2 MB.");
        return;
      }

      const text = await file.text();
      const result = importTasks(text);
      if (!result.ok) {
        showToast("error", result.error ?? "No se pudo importar el archivo.");
        return;
      }

      const incoming = result.tasks.length;
      const confirmed = await confirmAction({
        title: "Importar tareas",
        message: `Se reemplazarán ${pluralTasks(state.tasks.length)} por ${pluralTasks(incoming)} del archivo.`,
        confirmLabel: "Importar",
        danger: true,
      });

      if (!confirmed) {
        restoreFocus();
        return;
      }

      state.tasks = result.tasks;
      applyMutation(`${pluralTasks(incoming)} importadas`);
      restoreFocus();
    } catch {
      showToast("error", "No se pudo leer el archivo seleccionado.");
    } finally {
      if (input) input.value = "";
      setBusy(false);
    }
  }

  async function handleReset() {
    const confirmed = await confirmAction({
      title: "Restablecer datos",
      message: `Se borrarán tus tareas y se restaurarán los ${SAMPLE_TASKS_COUNT} ejemplos.`,
      confirmLabel: "Restablecer",
      danger: true,
    });

    if (!confirmed) {
      restoreFocus();
      return;
    }

    const cleared = clearTasks(storage);
    if (!cleared.ok) showToast("error", "No se pudieron borrar los datos guardados.");

    state.tasks = createSampleTasks({ now: now(), idFactory });
    applyMutation("Datos restablecidos");
    restoreFocus();
  }

  /* -------------------------------------------------------------- */
  /* Arranque                                                       */
  /* -------------------------------------------------------------- */

  function seedTasks() {
    return createSampleTasks({ now: now(), idFactory });
  }

  function loadInitialTasks() {
    const result = loadTasks(storage);

    if (result.source === "empty") {
      state.tasks = seedTasks();
      persist({ notify: false });
      return;
    }

    if (result.source === "invalid") {
      state.tasks = seedTasks();
      persist({ notify: false });
      showToast(
        "error",
        "No se pudieron leer tus datos; se guardó una copia y se cargaron ejemplos.",
      );
      return;
    }

    state.tasks = result.tasks;
    if (result.skipped > 0) {
      persist({ notify: false });
      showToast(
        "error",
        `Se descartaron ${result.skipped} ${result.skipped === 1 ? "tarea inválida" : "tareas inválidas"} al leer tus datos.`,
      );
    }
  }

  function bindEvents() {
    on(els.taskList, "click", handleCardAction);

    on(els.btnNewTask, "click", () => openTaskDialog(null, els.btnNewTask));
    on(els.btnEmptyAction, "click", () => {
      const mode = els.btnEmptyAction.dataset ? els.btnEmptyAction.dataset.emptyAction : "new";
      if (mode === "clear") clearFilters();
      else openTaskDialog(null, els.btnEmptyAction);
    });

    on(els.filtersForm, "input", handleFilterEvent);
    on(els.filtersForm, "change", handleFilterEvent);
    on(els.btnClearFilters, "click", clearFilters);

    on(els.sortBy, "change", () => {
      const value = els.sortBy.value;
      state.sortBy = SORT_OPTIONS.includes(value) ? value : "dueDate";
      renderList();
    });

    on(els.themeToggle, "click", toggleTheme);

    on(els.taskForm, "submit", (event) => {
      event.preventDefault();
      submitTaskForm();
    });
    on(els.btnCancelTask, "click", () => {
      closeModal(els.taskDialog);
    });

    on(els.taskDialog, "keydown", trapFocus(els.taskDialog));
    on(els.taskDialog, "close", () => {
      state.editingId = null;
      clearFormErrors();
      restoreFocus();
    });
    on(els.taskDialog, "cancel", () => {
      state.editingId = null;
      clearFormErrors();
    });

    on(els.confirmDialog, "keydown", trapFocus(els.confirmDialog));

    on(els.btnExport, "click", handleExport);
    on(els.btnImport, "click", () => {
      if (els.importFile && typeof els.importFile.click === "function") els.importFile.click();
    });
    on(els.importFile, "change", () => {
      handleImportFile();
    });
    on(els.btnReset, "click", () => {
      handleReset();
    });
  }

  function destroy() {
    for (const [target, type, handler, listenerOptions] of listeners) {
      target.removeEventListener(type, handler, listenerOptions);
    }
    listeners.length = 0;

    if (listTimer) {
      clearTimeout(listTimer);
      listTimer = null;
    }
    if (busyTimer) {
      clearTimeout(busyTimer);
      busyTimer = null;
    }
    for (const timer of toastTimers.values()) clearTimeout(timer);
    toastTimers.clear();
  }

  applyTheme(resolveTheme());
  loadInitialTasks();
  bindEvents();
  syncFilterControls();
  renderAll();

  return {
    refresh: renderAll,
    destroy,
  };
}

/* Arranque automático en el navegador; en Node no se ejecuta nada. */
if (typeof globalThis.document !== "undefined" && globalThis.document !== null) {
  if (globalThis.document.readyState === "loading") {
    globalThis.document.addEventListener(
      "DOMContentLoaded",
      () => {
        initApp();
      },
      { once: true },
    );
  } else {
    initApp();
  }
}
