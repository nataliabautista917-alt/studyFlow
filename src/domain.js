/**
 * StudyFlow — dominio puro (ARCHITECTURE.md §3.1).
 *
 * Reglas de negocio sin efectos secundarios: no conoce el DOM, ni `window`, ni
 * `localStorage`. El reloj y los identificadores se inyectan para que las
 * pruebas sean deterministas.
 *
 * Las fechas de entrega son strings `YYYY-MM-DD` comparados lexicográficamente
 * en hora local. Nunca se usa `new Date("YYYY-MM-DD")` (desfase UTC).
 */

/** Identificador de tarea: `tsk_` + 6..32 caracteres `[a-z0-9]`. */
const TASK_ID_PATTERN = /^tsk_[a-z0-9]{6,32}$/;

/** Fecha sin hora, en calendario local. */
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Clave usada para enviar al final las tareas sin fecha.
 * `\uffff` ordena después de cualquier fecha `YYYY-MM-DD` (la mayor posible es
 * `9999-12-31`) y no puede coincidir con una fecha real (BUG-08).
 */
const NO_DATE_KEY = "\uffff";

/** Peso de orden de las prioridades (menor = antes). */
export const TASK_STATUSES = Object.freeze(["pendiente", "en_progreso", "completada"]);
export const TASK_PRIORITIES = Object.freeze(["alta", "media", "baja"]);
export const TASK_TYPES = Object.freeze(["tarea", "examen", "proyecto", "lectura"]);
export const SORT_OPTIONS = Object.freeze(["dueDate", "priority", "createdAt"]);

export const STATUS_LABELS = Object.freeze({
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  completada: "Completada",
});

export const PRIORITY_LABELS = Object.freeze({
  alta: "Alta",
  media: "Media",
  baja: "Baja",
});

export const TYPE_LABELS = Object.freeze({
  tarea: "Tarea",
  examen: "Examen",
  proyecto: "Proyecto",
  lectura: "Lectura",
});

export const PRIORITY_WEIGHT = Object.freeze({ alta: 0, media: 1, baja: 2 });

export const LIMITS = Object.freeze({
  title: 120,
  course: 60,
  notes: 500,
  estimatedHoursMax: 100,
  query: 80,
});

export const DEFAULT_FILTERS = Object.freeze({
  query: "",
  status: "",
  course: "",
  priority: "",
  type: "",
});

/** Campos editables por el usuario (los demás son inmutables o derivados). */
const EDITABLE_FIELDS = Object.freeze([
  "title",
  "course",
  "type",
  "status",
  "priority",
  "dueDate",
  "estimatedHours",
  "notes",
]);

/**
 * Error de validación con campo, código estable y mapa completo de errores.
 */
export class ValidationError extends Error {
  constructor(message, { field = null, code = "validation", errors = null } = {}) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
    this.code = code;
    this.errors = errors;
  }
}

/**
 * Error de recurso inexistente (tarea no encontrada por `id`).
 */
export class NotFoundError extends Error {
  constructor(id) {
    super(`No existe la tarea ${id}.`);
    this.name = "NotFoundError";
    this.id = id;
  }
}

/* ------------------------------------------------------------------ */
/* Utilidades internas                                                 */
/* ------------------------------------------------------------------ */

function roundToTwo(value) {
  return Math.round(value * 100) / 100;
}

function isIsoTimestamp(value) {
  if (typeof value !== "string" || value === "") return false;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return false;
  return Number.isFinite(Date.parse(value));
}

function toIsoTimestamp(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError("Se esperaba una fecha válida.");
  }
  return value.toISOString();
}

/**
 * Convierte horas a número: acepta number o string con coma o punto.
 * `""`, `null` y `undefined` valen 0. Devuelve `null` si no es numérico.
 */
function parseEstimatedHours(value) {
  if (value === "" || value === null || value === undefined) return 0;
  if (typeof value === "number") {
    return Number.isFinite(value) ? roundToTwo(value) : null;
  }
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (normalized === "") return 0;
    if (!/^[+-]?\d+(\.\d+)?$/.test(normalized)) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? roundToTwo(parsed) : null;
  }
  return null;
}

/** Normaliza `today` (Date o `YYYY-MM-DD`) a string date-only. */
function resolveToday(value) {
  if (value instanceof Date) return toDateOnly(value);
  if (typeof value === "string" && isValidDateOnly(value)) return value;
  throw new TypeError("Se esperaba una fecha de hoy válida.");
}

function normalizeForSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function dueDateKey(value) {
  return typeof value === "string" && value !== "" ? value : NO_DATE_KEY;
}

function compareStrings(a, b) {
  const left = typeof a === "string" ? a : "";
  const right = typeof b === "string" ? b : "";
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function priorityWeight(value) {
  const weight = PRIORITY_WEIGHT[value];
  return typeof weight === "number" ? weight : 99;
}

/* ------------------------------------------------------------------ */
/* Fechas                                                              */
/* ------------------------------------------------------------------ */

/**
 * Convierte una `Date` a `YYYY-MM-DD` usando año, mes y día locales.
 * @throws {TypeError} si la fecha no es válida.
 */
export function toDateOnly(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError("Se esperaba una fecha válida.");
  }
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Convierte `YYYY-MM-DD` a `Date` local a medianoche.
 * Devuelve `null` si el formato o el día no existen (`2026-02-30`).
 */
export function parseDateOnly(value) {
  if (typeof value !== "string" || !DATE_ONLY_PATTERN.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  const sameYear = date.getFullYear() === year;
  const sameMonth = date.getMonth() === month - 1;
  const sameDay = date.getDate() === day;
  if (!sameYear || !sameMonth || !sameDay) return null;
  return date;
}

/** `true` solo si es string con formato `YYYY-MM-DD` y día real. */
export function isValidDateOnly(value) {
  return parseDateOnly(value) !== null;
}

/**
 * Suma días de calendario en hora local; cruza mes y año.
 * @throws {TypeError} si `dateOnly` no es una fecha válida.
 */
export function addDays(dateOnly, days) {
  const date = parseDateOnly(dateOnly);
  if (date === null) throw new TypeError("Se esperaba una fecha válida.");
  const amount = Number(days);
  if (!Number.isFinite(amount)) throw new TypeError("Se esperaba un número de días.");
  date.setDate(date.getDate() + amount);
  return toDateOnly(date);
}

const DATE_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Formatea una fecha date-only en español; `""` o inválida devuelven `""`. */
export function formatDateEs(dateOnly) {
  if (dateOnly === "") return "";
  const date = parseDateOnly(dateOnly);
  if (date === null) return "";
  return DATE_FORMATTER.format(date);
}

/* ------------------------------------------------------------------ */
/* Validación y normalización                                          */
/* ------------------------------------------------------------------ */

/**
 * Valida los campos editables de una tarea.
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
export function validateTaskInput(input = {}) {
  const source = input ?? {};
  const errors = {};

  const title = typeof source.title === "string" ? source.title.trim() : null;
  if (title === null || title === "") {
    errors.title = "El título es obligatorio.";
  } else if (title.length > LIMITS.title) {
    errors.title = `El título no puede superar ${LIMITS.title} caracteres.`;
  }

  const course = typeof source.course === "string" ? source.course.trim() : null;
  if (course === null || course === "") {
    errors.course = "El curso es obligatorio.";
  } else if (course.length > LIMITS.course) {
    errors.course = `El curso no puede superar ${LIMITS.course} caracteres.`;
  }

  if (!TASK_TYPES.includes(source.type)) {
    errors.type = "Selecciona un tipo válido.";
  }
  if (!TASK_STATUSES.includes(source.status)) {
    errors.status = "Selecciona un estado válido.";
  }
  if (!TASK_PRIORITIES.includes(source.priority)) {
    errors.priority = "Selecciona una prioridad válida.";
  }

  const dueDate = source.dueDate ?? "";
  if (dueDate !== "" && !isValidDateOnly(dueDate)) {
    errors.dueDate = "Usa una fecha válida (AAAA-MM-DD).";
  }

  const hours = parseEstimatedHours(source.estimatedHours);
  if (hours === null || hours < 0 || hours > LIMITS.estimatedHoursMax) {
    errors.estimatedHours = `Las horas deben ser un número entre 0 y ${LIMITS.estimatedHoursMax}.`;
  }

  const notes = source.notes ?? "";
  if (typeof notes !== "string" || notes.trim().length > LIMITS.notes) {
    errors.notes = `Las notas no pueden superar ${LIMITS.notes} caracteres.`;
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Convierte datos externos (importación, `localStorage`) en una `Task` válida.
 * Ignora campos desconocidos y aplica coherencia entre `status` y `completedAt`.
 * @throws {ValidationError}
 */
export function normalizeTask(raw) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ValidationError("La tarea no tiene el formato esperado.", {
      field: "document",
      code: "invalid_document",
    });
  }

  const errors = {};

  if (typeof raw.id !== "string" || !TASK_ID_PATTERN.test(raw.id)) {
    errors.id = "El identificador de la tarea no es válido.";
  }

  const { errors: fieldErrors } = validateTaskInput({
    title: raw.title,
    course: raw.course,
    type: raw.type,
    status: raw.status,
    priority: raw.priority,
    dueDate: raw.dueDate,
    estimatedHours: raw.estimatedHours,
    notes: raw.notes,
  });
  Object.assign(errors, fieldErrors);

  const createdAt = isIsoTimestamp(raw.createdAt) ? raw.createdAt : null;
  if (createdAt === null) errors.createdAt = "La fecha de creación no es válida.";

  let updatedAt = isIsoTimestamp(raw.updatedAt) ? raw.updatedAt : createdAt;
  if (updatedAt === null) errors.updatedAt = "La fecha de actualización no es válida.";
  if (createdAt !== null && updatedAt !== null && updatedAt < createdAt) {
    updatedAt = createdAt;
  }

  const keys = Object.keys(errors);
  if (keys.length > 0) {
    throw new ValidationError("La tarea no es válida.", {
      field: keys[0],
      code: "invalid_task",
      errors,
    });
  }

  const status = raw.status;
  const completedAt =
    status === "completada"
      ? isIsoTimestamp(raw.completedAt)
        ? raw.completedAt
        : updatedAt
      : null;

  return {
    id: raw.id,
    title: raw.title.trim(),
    course: raw.course.trim(),
    type: raw.type,
    status,
    priority: raw.priority,
    dueDate: raw.dueDate ?? "",
    estimatedHours: parseEstimatedHours(raw.estimatedHours) ?? 0,
    notes: (raw.notes ?? "").trim(),
    createdAt,
    updatedAt,
    completedAt,
  };
}

/* ------------------------------------------------------------------ */
/* CRUD y estado                                                       */
/* ------------------------------------------------------------------ */

/**
 * Genera `tsk_` + 12 caracteres `[a-z0-9]` usando `crypto.randomUUID` si existe.
 */
export function defaultIdFactory() {
  const cryptoScope = globalThis.crypto;
  let seed;
  if (cryptoScope && typeof cryptoScope.randomUUID === "function") {
    seed = cryptoScope.randomUUID().replace(/-/g, "");
  } else {
    seed = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  }
  const cleaned = String(seed).toLowerCase().replace(/[^a-z0-9]/g, "");
  const body = `${cleaned}${"0".repeat(12)}`.slice(0, 12);
  return `tsk_${body}`;
}

/**
 * Crea una tarea validada con valores por defecto.
 * @param {object} input Campos editables.
 * @param {{ now?: Date, idFactory?: () => string }} [options]
 * @throws {ValidationError}
 */
export function createTask(input = {}, options = {}) {
  const { now = new Date(), idFactory = defaultIdFactory } = options ?? {};
  const source = input ?? {};

  const draft = {
    title: source.title,
    course: source.course,
    type: source.type ?? "tarea",
    status: source.status ?? "pendiente",
    priority: source.priority ?? "media",
    dueDate: source.dueDate ?? "",
    estimatedHours: source.estimatedHours ?? 0,
    notes: source.notes ?? "",
  };

  const { valid, errors } = validateTaskInput(draft);
  if (!valid) {
    throw new ValidationError("Revisa los campos del formulario.", {
      field: Object.keys(errors)[0],
      code: "validation",
      errors,
    });
  }

  const timestamp = toIsoTimestamp(now);
  const id = idFactory();
  // El identificador generado debe cumplir el contrato `tsk_[a-z0-9]{6,32}` (BUG-04).
  if (typeof id !== "string" || !TASK_ID_PATTERN.test(id)) {
    throw new ValidationError("No se pudo generar el identificador de la tarea.", {
      field: "id",
      code: "invalid_id",
    });
  }

  return {
    id,
    title: draft.title.trim(),
    course: draft.course.trim(),
    type: draft.type,
    status: draft.status,
    priority: draft.priority,
    dueDate: draft.dueDate,
    estimatedHours: parseEstimatedHours(draft.estimatedHours) ?? 0,
    notes: draft.notes.trim(),
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: draft.status === "completada" ? timestamp : null,
  };
}

/**
 * Devuelve una copia actualizada de la tarea.
 * Ignora `id`, `createdAt`, `updatedAt` y `completedAt` del patch.
 * @param {object} task Tarea existente (no se muta).
 * @param {object} patch Campos editables a cambiar.
 * @param {{ now?: Date }} [options]
 * @throws {ValidationError}
 */
export function updateTask(task, patch = {}, options = {}) {
  const { now = new Date() } = options ?? {};
  if (task === null || typeof task !== "object") {
    throw new ValidationError("La tarea no tiene el formato esperado.", {
      field: "document",
      code: "invalid_document",
    });
  }

  const source = patch ?? {};
  const draft = {};
  for (const field of EDITABLE_FIELDS) {
    // Decisión del Architect (BUG-01…BUG-03): un campo con valor `undefined`
    // —presente en el patch o ausente— significa «sin cambio» y conserva el
    // valor actual de la tarea.
    const value = source[field];
    draft[field] = value === undefined ? task[field] : value;
  }

  const { valid, errors } = validateTaskInput(draft);
  if (!valid) {
    throw new ValidationError("Revisa los campos del formulario.", {
      field: Object.keys(errors)[0],
      code: "validation",
      errors,
    });
  }

  const createdAt = isIsoTimestamp(task.createdAt) ? task.createdAt : toIsoTimestamp(now);
  let updatedAt = toIsoTimestamp(now);
  if (updatedAt < createdAt) updatedAt = createdAt;

  const status = draft.status;
  let completedAt = null;
  if (status === "completada") {
    const keep = task.status === "completada" && isIsoTimestamp(task.completedAt);
    completedAt = keep ? task.completedAt : updatedAt;
  }

  return {
    id: task.id,
    title: draft.title.trim(),
    course: draft.course.trim(),
    type: draft.type,
    status,
    priority: draft.priority,
    dueDate: draft.dueDate ?? "",
    estimatedHours: parseEstimatedHours(draft.estimatedHours) ?? 0,
    notes: (draft.notes ?? "").trim(),
    createdAt,
    updatedAt,
    completedAt,
  };
}

/**
 * Devuelve un arreglo nuevo sin la tarea indicada.
 * @throws {NotFoundError} si el `id` no existe.
 */
export function deleteTask(tasks, id) {
  if (!Array.isArray(tasks)) throw new TypeError("Se esperaba una lista de tareas.");
  if (!tasks.some((task) => task && task.id === id)) throw new NotFoundError(id);
  return tasks.filter((task) => task && task.id !== id);
}

/**
 * Cambia el estado de una tarea y sincroniza `completedAt`.
 * @throws {ValidationError} si el estado no pertenece a `TASK_STATUSES`.
 * @throws {NotFoundError} si el `id` no existe.
 */
export function changeTaskStatus(tasks, id, status, options = {}) {
  if (!TASK_STATUSES.includes(status)) {
    throw new ValidationError("Selecciona un estado válido.", {
      field: "status",
      code: "invalid_enum",
    });
  }
  const task = findTask(tasks, id);
  if (!task) throw new NotFoundError(id);
  const updated = updateTask(task, { status }, options);
  return tasks.map((item) => (item && item.id === id ? updated : item));
}

/** Busca una tarea por `id`; devuelve `undefined` si no está. */
export function findTask(tasks, id) {
  if (!Array.isArray(tasks)) return undefined;
  return tasks.find((task) => task && task.id === id);
}

/* ------------------------------------------------------------------ */
/* Métricas                                                            */
/* ------------------------------------------------------------------ */

/** No completada, con fecha y anterior a hoy. */
export function isOverdue(task, today) {
  if (!task || typeof task !== "object") return false;
  if (task.status === "completada") return false;
  if (!isValidDateOnly(task.dueDate)) return false;
  return task.dueDate < resolveToday(today);
}

/** No completada y dentro de la ventana hoy..hoy+6 (inclusive). */
export function isUpcoming(task, today) {
  if (!task || typeof task !== "object") return false;
  if (task.status === "completada") return false;
  if (!isValidDateOnly(task.dueDate)) return false;
  const start = resolveToday(today);
  const end = addDays(start, 6);
  return task.dueDate >= start && task.dueDate <= end;
}

/**
 * Calcula las siete métricas del panel (RF-5).
 * Las entradas que no sean objetos se ignoran, también para `total` (BUG-06).
 * @param {object[]} tasks
 * @param {{ today?: Date | string }} [options]
 */
export function computeStats(tasks, options = {}) {
  const { today = new Date() } = options ?? {};
  const list = Array.isArray(tasks) ? tasks : [];
  const todayOnly = resolveToday(today);

  let total = 0;
  let pending = 0;
  let inProgress = 0;
  let completed = 0;
  let overdue = 0;
  let upcoming7 = 0;

  for (const task of list) {
    if (!task || typeof task !== "object") continue;
    total += 1;
    if (task.status === "pendiente") pending += 1;
    else if (task.status === "en_progreso") inProgress += 1;
    else if (task.status === "completada") completed += 1;
    if (isOverdue(task, todayOnly)) overdue += 1;
    if (isUpcoming(task, todayOnly)) upcoming7 += 1;
  }

  // `total` solo cuenta entradas que sean objetos, igual que el bucle (BUG-06).
  const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);

  return { total, pending, inProgress, completed, overdue, upcoming7, completionRate };
}

/* ------------------------------------------------------------------ */
/* Filtros y orden                                                     */
/* ------------------------------------------------------------------ */

/**
 * Filtra por texto (sin acentos ni mayúsculas) y por igualdad exacta en
 * estado, curso, prioridad y tipo. `""` significa «sin filtro».
 */
export function filterTasks(tasks, filters = {}) {
  const list = Array.isArray(tasks) ? tasks : [];
  const active = { ...DEFAULT_FILTERS, ...(filters ?? {}) };
  const query = normalizeForSearch(String(active.query ?? "").trim());

  return list.filter((task) => {
    if (!task || typeof task !== "object") return false;
    if (active.status !== "" && task.status !== active.status) return false;
    if (active.course !== "" && task.course !== active.course) return false;
    if (active.priority !== "" && task.priority !== active.priority) return false;
    if (active.type !== "" && task.type !== active.type) return false;
    if (query === "") return true;
    const haystack = normalizeForSearch(
      `${task.title ?? ""} ${task.course ?? ""} ${task.notes ?? ""}`,
    );
    return haystack.includes(query);
  });
}

/** Cursos únicos (recortados) ordenados con `localeCompare("es")`. */
export function getCourses(tasks) {
  const list = Array.isArray(tasks) ? tasks : [];
  const seen = new Set();
  const courses = [];
  for (const task of list) {
    const course = task && typeof task.course === "string" ? task.course.trim() : "";
    if (course === "") continue;
    // Deduplicación sin distinguir mayúsculas; se conserva la primera grafía (BUG-07).
    const key = course.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    courses.push(course);
  }
  return courses.toSorted((a, b) => a.localeCompare(b, "es"));
}

/**
 * Ordena una copia del arreglo.
 * `dueDate`: ascendente con las tareas sin fecha al final.
 * `priority`: alta → baja, desempata por fecha.
 * `createdAt`: más reciente primero.
 * Un `sortBy` desconocido se comporta como `dueDate`.
 */
export function sortTasks(tasks, sortBy = "dueDate") {
  const list = Array.isArray(tasks) ? tasks : [];
  const mode = SORT_OPTIONS.includes(sortBy) ? sortBy : "dueDate";

  const compareId = (a, b) => compareStrings(a?.id, b?.id);
  const compareCreatedAt = (a, b) => compareStrings(a?.createdAt, b?.createdAt);
  const compareDueDate = (a, b) =>
    compareStrings(dueDateKey(a?.dueDate), dueDateKey(b?.dueDate));

  if (mode === "priority") {
    return list.toSorted((a, b) => {
      const byPriority = priorityWeight(a?.priority) - priorityWeight(b?.priority);
      if (byPriority !== 0) return byPriority;
      const byDueDate = compareDueDate(a, b);
      if (byDueDate !== 0) return byDueDate;
      const byCreated = compareCreatedAt(a, b);
      if (byCreated !== 0) return byCreated;
      return compareId(a, b);
    });
  }

  if (mode === "createdAt") {
    return list.toSorted((a, b) => {
      const byCreated = compareCreatedAt(b, a);
      if (byCreated !== 0) return byCreated;
      return compareId(a, b);
    });
  }

  return list.toSorted((a, b) => {
    const byDueDate = compareDueDate(a, b);
    if (byDueDate !== 0) return byDueDate;
    const byPriority = priorityWeight(a?.priority) - priorityWeight(b?.priority);
    if (byPriority !== 0) return byPriority;
    const byCreated = compareCreatedAt(a, b);
    if (byCreated !== 0) return byCreated;
    return compareId(a, b);
  });
}

/** `sortTasks(filterTasks(tasks, filters), sortBy)` sin mutar la entrada. */
export function selectTasks(tasks, { filters = {}, sortBy = "dueDate" } = {}) {
  return sortTasks(filterTasks(tasks, filters), sortBy);
}

/* ------------------------------------------------------------------ */
/* Datos de ejemplo                                                    */
/* ------------------------------------------------------------------ */

/**
 * Seis tareas de ejemplo con fechas relativas a `now` (RF-9).
 * Con hoy `2026-11-12`: total 6, pendientes 4, en progreso 1, completadas 1,
 * vencidas 1, próximas 7 días 3 y avance 17 %.
 * @param {{ now?: Date, idFactory?: () => string }} [options]
 */
export function createSampleTasks(options = {}) {
  const { now = new Date(), idFactory = defaultIdFactory } = options ?? {};
  const today = toDateOnly(now);

  const samples = [
    {
      title: "Ensayo de historia",
      course: "Historia",
      type: "tarea",
      priority: "alta",
      dueDate: addDays(today, 2),
      estimatedHours: 4,
      status: "pendiente",
    },
    {
      title: "Examen de cálculo",
      course: "Cálculo",
      type: "examen",
      priority: "alta",
      dueDate: addDays(today, 6),
      estimatedHours: 2,
      status: "pendiente",
    },
    {
      title: "Proyecto de biología",
      course: "Biología",
      type: "proyecto",
      priority: "media",
      dueDate: addDays(today, 12),
      estimatedHours: 8,
      status: "en_progreso",
    },
    {
      title: "Lectura: El túnel",
      course: "Literatura",
      type: "lectura",
      priority: "baja",
      dueDate: addDays(today, 4),
      estimatedHours: 1.5,
      status: "pendiente",
    },
    {
      title: "Laboratorio de química",
      course: "Química",
      type: "tarea",
      priority: "media",
      dueDate: addDays(today, -2),
      estimatedHours: 3,
      status: "pendiente",
    },
    {
      title: "Resumen de sociología",
      course: "Sociología",
      type: "tarea",
      priority: "media",
      dueDate: addDays(today, -1),
      estimatedHours: 1,
      status: "completada",
    },
  ];

  return samples.map((sample) => createTask(sample, { now, idFactory }));
}
