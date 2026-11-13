/**
 * Pruebas de las métricas del panel (RF-5).
 *
 * Nombres tomados de la matriz de `docs/REQUIREMENTS.md` §9. Hoy es siempre
 * `TODAY` (2026-11-12) calculado desde el reloj inyectado.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  addDays,
  computeStats,
  createSampleTasks,
  isOverdue,
  isUpcoming,
} from "../src/domain.js";

import { NOW, TODAY, makeTasks, seqIdFactory } from "./helpers/fakes.js";

/** Fecha relativa a hoy: `day(0)` es hoy, `day(-1)` ayer. */
const day = (offset) => addDays(TODAY, offset);

/** Crea tareas con solo el estado indicado. */
function withStatuses(statuses) {
  return makeTasks(
    statuses.map((status, index) => ({
      title: `Tarea ${index + 1}`,
      course: "Curso base",
      status,
    })),
    { idFactory: seqIdFactory() },
  );
}

test("cuenta total, pendientes, en progreso y completadas", () => {
  const tasks = makeTasks(
    [
      { title: "A", course: "Curso A", status: "pendiente" },
      { title: "B", course: "Curso B", status: "pendiente" },
      { title: "C", course: "Curso C", status: "en_progreso" },
      { title: "D", course: "Curso D", status: "completada" },
      { title: "E", course: "Curso E", status: "completada" },
    ],
    { idFactory: seqIdFactory() },
  );

  const stats = computeStats(tasks, { today: NOW });

  assert.equal(stats.total, 5);
  assert.equal(stats.pending, 2);
  assert.equal(stats.inProgress, 1);
  assert.equal(stats.completed, 2);
  // Las tareas sin fecha no son vencidas ni próximas
  assert.equal(stats.overdue, 0);
  assert.equal(stats.upcoming7, 0);
});

test("no cuenta completadas como vencidas", () => {
  const tasks = makeTasks(
    [
      { title: "A", course: "Curso A", status: "pendiente", dueDate: day(-3) },
      { title: "B", course: "Curso B", status: "completada", dueDate: day(-3) },
      { title: "C", course: "Curso C", status: "en_progreso", dueDate: day(-10) },
    ],
    { idFactory: seqIdFactory() },
  );

  const stats = computeStats(tasks, { today: NOW });

  assert.equal(stats.overdue, 2, "solo las no completadas cuentan");
  assert.equal(isOverdue(tasks[0], NOW), true);
  assert.equal(isOverdue(tasks[1], NOW), false, "completada aunque su fecha pasó");
  assert.equal(isOverdue(tasks[2], NOW), true);
  assert.equal(stats.upcoming7, 0);
});

test("una tarea que vence hoy no está vencida", () => {
  const [task] = makeTasks([{ title: "A", course: "Curso A", dueDate: TODAY }], {
    idFactory: seqIdFactory(),
  });

  assert.equal(isOverdue(task, NOW), false);
  assert.equal(isOverdue(task, TODAY), false, "`today` también acepta YYYY-MM-DD");
  assert.equal(isUpcoming(task, NOW), true, "hoy entra en la ventana");

  const stats = computeStats([task], { today: NOW });
  assert.equal(stats.overdue, 0);
  assert.equal(stats.upcoming7, 1);
});

test("cuenta próximas dentro de la ventana de 7 días", () => {
  const tasks = makeTasks(
    [
      { title: "Hoy", course: "Curso", dueDate: TODAY },
      { title: "Mañana", course: "Curso", dueDate: day(1) },
      { title: "En seis", course: "Curso", dueDate: day(6) },
      { title: "En siete", course: "Curso", dueDate: day(7) },
      { title: "Ayer", course: "Curso", dueDate: day(-1) },
      { title: "Sin fecha", course: "Curso" },
      { title: "Completada en tres", course: "Curso", dueDate: day(3), status: "completada" },
    ],
    { idFactory: seqIdFactory() },
  );

  const stats = computeStats(tasks, { today: NOW });

  assert.equal(stats.upcoming7, 3, "hoy, +1 y +6");
  assert.equal(stats.overdue, 1, "solo la de ayer");
  assert.equal(stats.total, 7);
  assert.equal(isUpcoming(tasks[3], NOW), false, "+7 queda fuera");
  assert.equal(isUpcoming(tasks[6], NOW), false, "las completadas no son próximas");
});

test("excluye la fecha hoy+7 de próximas", () => {
  assert.equal(day(6), "2026-11-18");
  assert.equal(day(7), "2026-11-19");

  const [atSix] = makeTasks([{ title: "B", course: "Curso B", dueDate: day(6) }], {
    idFactory: seqIdFactory(),
  });
  const [atSeven] = makeTasks([{ title: "A", course: "Curso A", dueDate: day(7) }], {
    idFactory: seqIdFactory(),
  });

  assert.equal(isUpcoming(atSix, NOW), true, "el último día incluido es hoy+6");
  assert.equal(isUpcoming(atSeven, NOW), false, "hoy+7 queda fuera de la ventana");

  const stats = computeStats([atSeven], { today: NOW });
  assert.equal(stats.upcoming7, 0);
  assert.equal(stats.overdue, 0, "hoy+7 no está vencida, solo fuera de la ventana");
});

test("calcula el porcentaje de avance redondeado", () => {
  const oneOfThree = computeStats(withStatuses(["completada", "pendiente", "pendiente"]), {
    today: NOW,
  });
  const twoOfThree = computeStats(withStatuses(["completada", "completada", "pendiente"]), {
    today: NOW,
  });
  const oneOfSix = computeStats(
    withStatuses(["completada", "pendiente", "pendiente", "pendiente", "en_progreso", "pendiente"]),
    { today: NOW },
  );
  const all = computeStats(withStatuses(["completada", "completada"]), { today: NOW });

  assert.equal(oneOfThree.completionRate, 33);
  assert.equal(twoOfThree.completionRate, 67);
  assert.equal(oneOfSix.completionRate, 17);
  assert.equal(all.completionRate, 100);

  const rate = oneOfThree.completionRate;
  assert.equal(Number.isInteger(rate), true);
  assert.ok(rate >= 0 && rate <= 100);
});

test("devuelve 0 % con lista vacía", () => {
  assert.deepEqual(computeStats([], { today: NOW }), {
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0,
    upcoming7: 0,
    completionRate: 0,
  });

  // Entradas ausentes o incompletas no rompen el cálculo
  assert.equal(computeStats(null, { today: NOW }).total, 0);
  assert.equal(computeStats(undefined, { today: NOW }).completionRate, 0);
  assert.equal(computeStats("no es una lista", { today: NOW }).total, 0);
  assert.doesNotThrow(() => computeStats([null, undefined, "x"], { today: NOW }));
});

test("los ejemplos producen métricas esperadas", () => {
  const samples = createSampleTasks({ now: NOW, idFactory: seqIdFactory() });
  const stats = computeStats(samples, { today: NOW });

  assert.deepEqual(stats, {
    total: 6,
    pending: 4,
    inProgress: 1,
    completed: 1,
    overdue: 1,
    upcoming7: 3,
    completionRate: 17,
  });

  // Recalcular con el mismo reloj da el mismo resultado
  assert.deepEqual(computeStats(samples, { today: NOW }), stats);
});

test("no muta la lista al calcular métricas", () => {
  const samples = createSampleTasks({ now: NOW, idFactory: seqIdFactory() });
  const snapshot = structuredClone(samples);

  computeStats(samples, { today: NOW });
  computeStats(samples, { today: TODAY });

  assert.deepEqual(samples, snapshot);
});
