/**
 * Esqueleto de módulo puro.
 * - Sin DOM, sin localStorage, sin fetch.
 * - Dependencias inyectables para pruebas deterministas.
 */

export const ITEM_STATUSES = Object.freeze(["pending", "done"]);

/** Error de validación con campo asociado. */
export class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

/**
 * Normaliza y valida una entrada.
 * @param {unknown} input
 * @returns {{title: string, status: "pending"|"done"}}
 * @throws {ValidationError}
 */
export function normalizeItem(input) {
  if (!input || typeof input !== "object") {
    throw new ValidationError("La entrada debe ser un objeto");
  }
  const title = String(input.title ?? "").trim();
  if (!title) throw new ValidationError("El título es obligatorio", "title");
  const status = input.status ?? "pending";
  if (!ITEM_STATUSES.includes(status)) {
    throw new ValidationError("Estado inválido", "status");
  }
  return { title, status };
}

/**
 * Devuelve una copia con el cambio aplicado; no muta el original.
 * @template T
 * @param {T[]} items
 * @param {string} id
 * @param {Partial<T>} patch
 * @returns {T[]}
 */
export function patchById(items, id, patch) {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}
