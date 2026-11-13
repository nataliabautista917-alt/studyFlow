/**
 * StudyFlow — persistencia (ARCHITECTURE.md §3.2).
 *
 * Documento versionado `{ app, version, updatedAt, tasks }` en `localStorage`,
 * con respaldo del valor crudo ante corrupción. No conoce el DOM: recibe un
 * `StorageLike` inyectable (`getItem`, `setItem`, `removeItem`, `dump`).
 *
 * Ninguna función de este módulo escribe en el DOM y `saveTasks` no lanza
 * nunca: devuelve `{ ok:false, code }` para que la interfaz conserve el estado
 * en memoria y avise al usuario.
 */

import { normalizeTask, toDateOnly, ValidationError } from "./domain.js";

export const STORAGE_KEY = "studyflow.tasks";
export const BACKUP_KEY = "studyflow.tasks.backup";
export const THEME_KEY = "studyflow.theme";
export const APP_ID = "studyflow";
export const SCHEMA_VERSION = 1;

const THEMES = Object.freeze(["light", "dark"]);

/**
 * Almacenamiento en memoria con la misma forma que `Storage`.
 * Se usa en pruebas y como respaldo cuando `localStorage` no está disponible.
 */
export function createMemoryStorage(initial = {}) {
  const data = new Map(
    Object.entries(initial ?? {}).map(([key, value]) => [key, String(value)]),
  );

  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(String(key), String(value));
    },
    removeItem(key) {
      data.delete(String(key));
    },
    dump() {
      return Object.fromEntries(data);
    },
  };
}

/**
 * Intenta usar `scope.localStorage` con una escritura/borrado de sonda.
 * Si no existe o falla (bloqueado, cuota, modo privado) devuelve un
 * almacenamiento en memoria para que la aplicación siga funcionando.
 */
export function createSafeStorage(scope = globalThis) {
  try {
    const storage = scope ? scope.localStorage : null;
    if (!storage) return createMemoryStorage();
    const probe = "__studyflow_probe__";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return createMemoryStorage();
  }
}

/** Copia el valor crudo a `BACKUP_KEY`; mejor esfuerzo, nunca lanza. */
function writeBackup(storage, rawText) {
  try {
    if (storage && typeof storage.setItem === "function") {
      storage.setItem(BACKUP_KEY, String(rawText));
    }
  } catch {
    /* El respaldo es una red de seguridad: si falla, no se interrumpe la app. */
  }
}

function failure(code, error, { version = null } = {}) {
  return { ok: false, tasks: [], version, skipped: 0, error, code };
}

/**
 * Interpreta un documento guardado o importado.
 *
 * - `mode: "load"`: descarta tareas inválidas, deduplica `id` (conserva la
 *   primera) e informa cuántas se omitieron en `skipped`.
 * - `mode: "import"`: es atómico; cualquier tarea inválida o `id` duplicado
 *   rechaza el documento completo.
 *
 * Acepta la envoltura `{ app, version, tasks }` o un arreglo simple de tareas.
 * Una `version` ausente se asume como la versión actual del esquema y un `app`
 * distinto de `studyflow` se rechaza (BUG-05).
 *
 * @returns {{ ok: boolean, tasks: object[], version: number|null, skipped: number, error: string|null, code: string|null }}
 */
export function parseDocument(rawText, { mode = "load" } = {}) {
  const strict = mode === "import";

  if (typeof rawText !== "string" || rawText.trim() === "") {
    return failure("invalid_document", "El documento está vacío o no es texto.");
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return failure("invalid_json", "El archivo no es un JSON válido.");
  }

  let document;
  if (Array.isArray(parsed)) {
    document = { app: APP_ID, version: SCHEMA_VERSION, tasks: parsed };
  } else if (parsed !== null && typeof parsed === "object") {
    document = parsed;
  } else {
    return failure("invalid_document", "El documento no tiene el formato esperado.");
  }

  const version = document.version === undefined ? SCHEMA_VERSION : document.version;

  // La envoltura debe declarar la app correcta cuando trae `app` (BUG-05). Si
  // `app` falta se mantiene la tolerancia con archivos hechos a mano.
  if (document.app !== undefined && document.app !== APP_ID) {
    return failure("invalid_document", `El documento no pertenece a ${APP_ID}.`, {
      version: typeof version === "number" ? version : null,
    });
  }

  if (version !== SCHEMA_VERSION) {
    return failure(
      "unsupported_version",
      `La versión de datos no es compatible (se esperaba ${SCHEMA_VERSION}).`,
      { version: typeof version === "number" ? version : null },
    );
  }

  if (!Array.isArray(document.tasks)) {
    return failure("invalid_document", "El documento no contiene una lista de tareas.", {
      version,
    });
  }

  const tasks = [];
  const seen = new Set();
  let skipped = 0;

  for (const raw of document.tasks) {
    let task;
    try {
      task = normalizeTask(raw);
    } catch (error) {
      if (strict) {
        const code = error instanceof ValidationError && error.code === "invalid_document"
          ? "invalid_document"
          : "invalid_task";
        return failure(code, "Una de las tareas del archivo no es válida.", { version });
      }
      skipped += 1;
      continue;
    }

    if (seen.has(task.id)) {
      if (strict) {
        return failure("duplicate_id", `El identificador ${task.id} está duplicado.`, {
          version,
        });
      }
      skipped += 1;
      continue;
    }

    seen.add(task.id);
    tasks.push(task);
  }

  return { ok: true, tasks, version, skipped, error: null, code: null };
}

/**
 * Lee las tareas del almacenamiento.
 *
 * - Sin valor → `source: "empty"`.
 * - Documento válido → `source: "storage"`; si se descartaron tareas, copia el
 *   valor crudo a `BACKUP_KEY`.
 * - Documento corrupto o de versión desconocida → respalda el crudo y devuelve
 *   `source: "invalid"`.
 *
 * @returns {{ ok: boolean, tasks: object[], source: "storage"|"empty"|"invalid", skipped: number, error: string|null, code: string|null }}
 */
export function loadTasks(storage) {
  let raw = null;
  try {
    raw = storage && typeof storage.getItem === "function"
      ? storage.getItem(STORAGE_KEY)
      : null;
  } catch {
    return {
      ok: false,
      tasks: [],
      source: "invalid",
      skipped: 0,
      error: "No se pudo leer el almacenamiento local.",
      code: "storage_unavailable",
    };
  }

  if (raw === null || raw === undefined) {
    return { ok: true, tasks: [], source: "empty", skipped: 0, error: null, code: null };
  }

  const result = parseDocument(raw, { mode: "load" });

  if (!result.ok) {
    writeBackup(storage, raw);
    return {
      ok: false,
      tasks: [],
      source: "invalid",
      skipped: 0,
      error: result.error,
      code: result.code,
    };
  }

  if (result.skipped > 0) writeBackup(storage, raw);

  return {
    ok: true,
    tasks: result.tasks,
    source: "storage",
    skipped: result.skipped,
    error: null,
    code: null,
  };
}

/**
 * Serializa y escribe el documento versionado. Nunca lanza.
 * Un fallo de cuota o de seguridad devuelve `code: "storage_unavailable"` y la
 * interfaz conserva el estado en memoria.
 */
export function saveTasks(storage, tasks, { now = new Date() } = {}) {
  if (!Array.isArray(tasks)) {
    return { ok: false, error: "Las tareas no son una lista.", code: "invalid_document" };
  }

  try {
    const document = {
      app: APP_ID,
      version: SCHEMA_VERSION,
      updatedAt: now.toISOString(),
      tasks,
    };
    const serialized = JSON.stringify(document);
    if (storage && typeof storage.setItem === "function") {
      storage.setItem(STORAGE_KEY, serialized);
    } else {
      return {
        ok: false,
        error: "No hay almacenamiento disponible.",
        code: "storage_unavailable",
      };
    }
  } catch {
    return {
      ok: false,
      error: "No se pudo guardar en el almacenamiento local.",
      code: "storage_unavailable",
    };
  }

  return { ok: true, error: null, code: null };
}

/**
 * Prepara la exportación: normaliza las tareas (lanza `ValidationError` si
 * alguna es inválida) y devuelve el JSON con 2 espacios y el nombre de archivo
 * `studyflow-AAAA-MM-DD.json`.
 */
export function exportTasks(tasks, { now = new Date() } = {}) {
  if (!Array.isArray(tasks)) {
    throw new ValidationError("Las tareas no son una lista.", {
      field: "document",
      code: "invalid_document",
    });
  }

  const normalized = tasks.map((task) => normalizeTask(task));
  const document = {
    app: APP_ID,
    version: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    tasks: normalized,
  };

  return {
    json: JSON.stringify(document, null, 2),
    filename: `studyflow-${toDateOnly(now)}.json`,
  };
}

/**
 * Valida un JSON importado. No escribe en el almacenamiento: la aplicación
 * decide cuándo reemplazar la colección tras confirmar.
 *
 * La opción `now` se acepta por simetría con el resto del módulo (el
 * documento importado conserva los `createdAt`/`updatedAt` del archivo).
 *
 * @returns {{ ok: boolean, tasks: object[], version: number|null, error: string|null, code: string|null }}
 */
export function importTasks(jsonText, { now: _now = new Date() } = {}) {
  const result = parseDocument(jsonText, { mode: "import" });
  return {
    ok: result.ok,
    tasks: result.tasks,
    version: result.version,
    error: result.error,
    code: result.code,
  };
}

/**
 * Elimina la clave de tareas. No toca el respaldo ni la preferencia de tema.
 */
export function clearTasks(storage) {
  try {
    if (storage && typeof storage.removeItem === "function") {
      storage.removeItem(STORAGE_KEY);
    }
  } catch {
    return { ok: false, error: "No se pudieron restablecer los datos." };
  }
  return { ok: true, error: null };
}

/** Lee la preferencia de tema; devuelve `null` si falta o es inválida. */
export function loadTheme(storage) {
  let value = null;
  try {
    value = storage && typeof storage.getItem === "function" ? storage.getItem(THEME_KEY) : null;
  } catch {
    return null;
  }
  return THEMES.includes(value) ? value : null;
}

/** Guarda `"light"` o `"dark"`; cualquier otro valor se rechaza. */
export function saveTheme(storage, theme) {
  if (!THEMES.includes(theme)) {
    return { ok: false, error: "Tema no válido.", code: "invalid_theme" };
  }

  try {
    if (!storage || typeof storage.setItem !== "function") {
      return {
        ok: false,
        error: "No hay almacenamiento disponible.",
        code: "storage_unavailable",
      };
    }
    storage.setItem(THEME_KEY, theme);
  } catch {
    return {
      ok: false,
      error: "No se pudo guardar la preferencia de tema.",
      code: "storage_unavailable",
    };
  }

  return { ok: true, error: null };
}
