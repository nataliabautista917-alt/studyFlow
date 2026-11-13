/**
 * Presupuesto de rendimiento (RNF-3).
 *
 * Con 500 tareas, `computeStats + filterTasks + sortTasks` deben caber en 50 ms.
 * Se hace una pasada de calentamiento antes de medir para que el JIT no cuente.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { addDays, computeStats, filterTasks, sortTasks } from "../src/domain.js";

import { NOW, TODAY, makeTasks, seqIdFactory } from "./helpers/fakes.js";

const SIZE = 500;
const BUDGET_MS = 50;
const STATUSES = ["pendiente", "en_progreso", "completada"];
const PRIORITIES = ["alta", "media", "baja"];

/** 500 tareas variadas: títulos, cursos, estados, prioridades y fechas. */
function buildTasks() {
  return makeTasks(
    Array.from({ length: SIZE }, (_, index) => ({
      title: index % 7 === 0 ? `Ensayo de historia ${index}` : `Tarea de cálculo ${index}`,
      course: index % 5 === 0 ? "Historia" : `Curso ${index % 11}`,
      notes: index % 3 === 0 ? "Incluye laboratorio y autores" : "",
      status: STATUSES[index % 3],
      priority: PRIORITIES[index % 3],
      dueDate: index % 9 === 0 ? "" : addDays(TODAY, (index % 20) - 5),
    })),
    { idFactory: seqIdFactory() },
  );
}

test("filtra y ordena 500 tareas en menos de 50 ms", () => {
  const tasks = buildTasks();
  assert.equal(tasks.length, SIZE);

  // Calentamiento: la primera pasada compila y optimiza el código
  computeStats(tasks, { today: NOW });
  filterTasks(tasks, { query: "historia" });
  sortTasks(tasks, "dueDate");

  const start = performance.now();
  const stats = computeStats(tasks, { today: NOW });
  const filtered = filterTasks(tasks, { query: "historia", status: "pendiente" });
  const sorted = sortTasks(filtered, "priority");
  const elapsed = performance.now() - start;

  // El resultado debe ser real, no un atajo vacío
  assert.equal(stats.total, SIZE);
  assert.ok(filtered.length > 0 && filtered.length < SIZE, "el filtro debe discriminar");
  assert.equal(sorted.length, filtered.length);

  assert.ok(
    elapsed < BUDGET_MS,
    `computeStats + filterTasks + sortTasks tardaron ${elapsed.toFixed(1)} ms (presupuesto ${BUDGET_MS} ms)`,
  );
});

test("ordena 500 tareas sin mutar la colección", () => {
  const tasks = buildTasks();
  const snapshot = structuredClone(tasks);

  const sorted = sortTasks(tasks, "dueDate");

  assert.deepEqual(tasks, snapshot, "la entrada no se reordena");
  assert.notEqual(sorted, tasks);
  assert.equal(sorted.length, SIZE);

  // Fechas ascendentes y las tareas sin fecha al final
  const keys = sorted.map((task) => (task.dueDate === "" ? "9999-12-31" : task.dueDate));
  assert.deepEqual(keys, [...keys].toSorted());
});

test("el presupuesto se mantiene en ejecuciones repetidas", () => {
  const tasks = buildTasks();

  const start = performance.now();
  for (let index = 0; index < 10; index += 1) {
    const filtered = filterTasks(tasks, { query: `curso ${index}`, priority: "alta" });
    sortTasks(filtered, "createdAt");
  }
  const elapsed = performance.now() - start;

  assert.ok(
    elapsed < BUDGET_MS * 4,
    `10 ciclos de filtrado y orden tardaron ${elapsed.toFixed(1)} ms`,
  );
});
