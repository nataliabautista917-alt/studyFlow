/**
 * Dobles de prueba compartidos (ARCHITECTURE.md §8).
 *
 * Reglas: sin red, sin reloj real y sin `Math.random` sin inyectar. Todo lo no
 * determinista (fechas, identificadores, almacenamiento) se pasa desde aquí.
 */

import { createTask, toDateOnly } from "../../src/domain.js";

/** Reloj fijo: jueves 12 de noviembre de 2026 a las 09:00 en hora local. */
export const NOW = new Date(2026, 10, 12, 9, 0, 0);

/** `NOW` como fecha date-only (`YYYY-MM-DD`): `2026-11-12`. */
export const TODAY = toDateOnly(NOW);

/**
 * Almacenamiento en memoria con la misma forma que `Storage`.
 * Implementación propia e independiente de `src/storage.js` para no probar el
 * módulo con su propio doble.
 *
 * @param {Record<string, unknown>} [initial]
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
 * Almacenamiento que lanza al escribir (cuota agotada o modo privado), pero
 * que sigue leyendo con normalidad.
 *
 * @param {{ failOn?: "getItem" | "setItem" | "removeItem", initial?: Record<string, unknown> }} [options]
 */
export function createFailingStorage({ failOn = "setItem", initial = {} } = {}) {
  const inner = createMemoryStorage(initial);
  const fail = () => {
    throw new Error("Almacenamiento no disponible (simulado).");
  };

  return {
    getItem: failOn === "getItem" ? fail : (key) => inner.getItem(key),
    setItem: failOn === "setItem" ? fail : (key, value) => inner.setItem(key, value),
    removeItem: failOn === "removeItem" ? fail : (key) => inner.removeItem(key),
    dump: () => inner.dump(),
  };
}

/**
 * Genera identificadores correlativos: `tsk_test01`, `tsk_test02`, …
 * Cumplen `^tsk_[a-z0-9]{6,32}$`.
 *
 * @param {string} [prefix]
 * @returns {() => string}
 */
export function seqIdFactory(prefix = "tsk_test") {
  let counter = 0;
  return () => {
    counter += 1;
    return `${prefix}${String(counter).padStart(2, "0")}`;
  };
}

/**
 * Crea una tarea válida con valores por defecto.
 *
 * @param {object} [overrides] Campos del formulario (`title`, `course`, …).
 * @param {{ now?: Date, idFactory?: () => string }} [options]
 */
export function makeTask(overrides = {}, options = {}) {
  const { now = NOW, idFactory = seqIdFactory() } = options ?? {};
  return createTask(
    { title: "Tarea de prueba", course: "Curso base", ...overrides },
    { now, idFactory },
  );
}

/**
 * Crea un lote de tareas con identificadores correlativos y un único reloj.
 * La clave `at` (Date) de cada definición fija el `now` de esa tarea, útil para
 * controlar `createdAt` sin tocar el reloj global.
 *
 * @param {Array<object & { at?: Date }>} definitions
 * @param {{ now?: Date, idFactory?: () => string }} [options]
 */
export function makeTasks(definitions, options = {}) {
  const { now = NOW, idFactory = seqIdFactory() } = options ?? {};
  return definitions.map((definition) => {
    const { at, ...fields } = definition;
    return makeTask(fields, { now: at ?? now, idFactory });
  });
}
