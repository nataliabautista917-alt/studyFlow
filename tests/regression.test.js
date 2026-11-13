/**
 * Pruebas de regresión adversariales — Tester (RF-1…RF-10, RNF-4, RNF-8).
 *
 * Escritas para *intentar romper* el producto, no para confirmarlo. Todos los
 * datos son deterministas: reloj e identificadores inyectados, sin red, sin
 * `Math.random` propio y sin `localStorage` real.
 *
 * Los casos BUG-01…BUG-08 documentan hallazgos del reporte
 * `docs/TEST_REPORT.md` y ya están activos: el Developer los corrigió en el
 * ciclo Tester→Developer y las expectativas se ajustaron a la decisión del
 * Architect (un campo con valor `undefined` significa «sin cambio»). No se
 * cambiaron pruebas existentes.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  LIMITS,
  NotFoundError,
  ValidationError,
  addDays,
  changeTaskStatus,
  computeStats,
  createTask,
  filterTasks,
  getCourses,
  isOverdue,
  isUpcoming,
  isValidDateOnly,
  normalizeTask,
  parseDateOnly,
  sortTasks,
  updateTask,
} from "../src/domain.js";

import {
  APP_ID,
  BACKUP_KEY,
  SCHEMA_VERSION,
  STORAGE_KEY,
  exportTasks,
  importTasks,
  loadTasks,
  saveTasks,
} from "../src/storage.js";

import { NOW, TODAY, createMemoryStorage, makeTask, makeTasks, seqIdFactory } from "./helpers/fakes.js";

/** Reloj posterior a `NOW`. */
const LATER = new Date(2026, 10, 12, 10, 30, 0);

/** Fecha relativa a hoy: `day(0)` es hoy, `day(-1)` ayer. */
const day = (offset) => addDays(TODAY, offset);

/** Tarea externa mínima válida, para `normalizeTask` e importación. */
function validRaw(overrides = {}) {
  return {
    id: "tsk_abc123",
    title: "Ensayo",
    course: "Historia",
    type: "tarea",
    status: "pendiente",
    priority: "media",
    dueDate: "",
    estimatedHours: 0,
    notes: "",
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-02T10:00:00.000Z",
    ...overrides,
  };
}

const idsOf = (tasks) => tasks.map((task) => task.id);

/** Crea `count` tareas con los estados indicados (cicla si hace falta). */
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

/* ================================================================== */
/* Límites exactos (AC-03, AC-24)                                      */
/* ================================================================== */

test("acepta el título de exactamente 120 caracteres y rechaza 121", () => {
  const atLimit = createTask(
    { title: "a".repeat(LIMITS.title), course: "Historia" },
    { now: NOW, idFactory: seqIdFactory() },
  );
  assert.equal(atLimit.title.length, LIMITS.title);

  assert.throws(
    () =>
      createTask(
        { title: "a".repeat(LIMITS.title + 1), course: "Historia" },
        { now: NOW, idFactory: seqIdFactory() },
      ),
    (error) => error instanceof ValidationError && error.field === "title",
  );
});

test("acepta el curso de exactamente 60 caracteres y rechaza 61", () => {
  const atLimit = createTask(
    { title: "Ensayo", course: "b".repeat(LIMITS.course) },
    { now: NOW, idFactory: seqIdFactory() },
  );
  assert.equal(atLimit.course.length, LIMITS.course);

  assert.throws(
    () =>
      createTask(
        { title: "Ensayo", course: "b".repeat(LIMITS.course + 1) },
        { now: NOW, idFactory: seqIdFactory() },
      ),
    (error) => error instanceof ValidationError && error.field === "course",
  );
});

test("acepta 500 caracteres de notas y rechaza 501", () => {
  const atLimit = createTask(
    { title: "Ensayo", course: "Historia", notes: "c".repeat(LIMITS.notes) },
    { now: NOW, idFactory: seqIdFactory() },
  );
  assert.equal(atLimit.notes.length, LIMITS.notes);

  assert.throws(
    () =>
      createTask(
        { title: "Ensayo", course: "Historia", notes: "c".repeat(LIMITS.notes + 1) },
        { now: NOW, idFactory: seqIdFactory() },
      ),
    (error) => error instanceof ValidationError && error.field === "notes",
  );
});

test("acepta 100 h y rechaza 100.1, -1 y texto; el vacío vale 0", () => {
  for (const [value, expected] of [
    [100, 100],
    ["100", 100],
    ["100,00", 100],
    ["", 0],
    [undefined, 0],
    [null, 0],
  ]) {
    const task = createTask(
      { title: "Ensayo", course: "Historia", estimatedHours: value },
      { now: NOW, idFactory: seqIdFactory() },
    );
    assert.equal(task.estimatedHours, expected, `estimatedHours de ${JSON.stringify(value)}`);
  }

  for (const value of [100.1, "100,1", 100.01, -1, "-1", "abc", NaN, Infinity, {}]) {
    assert.throws(
      () =>
        createTask(
          { title: "Ensayo", course: "Historia", estimatedHours: value },
          { now: NOW, idFactory: seqIdFactory() },
        ),
      (error) =>
        error instanceof ValidationError && error.field === "estimatedHours",
      `debe rechazar ${JSON.stringify(value)}`,
    );
  }
});

test("mide los límites después de recortar los extremos", () => {
  const task = createTask(
    {
      title: `  ${"a".repeat(LIMITS.title)}  `,
      course: `  ${"b".repeat(LIMITS.course)}  `,
      notes: `  ${"c".repeat(LIMITS.notes)}  `,
    },
    { now: NOW, idFactory: seqIdFactory() },
  );
  assert.equal(task.title.length, LIMITS.title);
  assert.equal(task.course.length, LIMITS.course);
  assert.equal(task.notes.length, LIMITS.notes);

  assert.throws(
    () =>
      createTask(
        { title: `  ${"a".repeat(LIMITS.title + 1)}  `, course: "Historia" },
        { now: NOW, idFactory: seqIdFactory() },
      ),
    (error) => error instanceof ValidationError && error.field === "title",
  );
});

/* ================================================================== */
/* Fechas y métricas (AC-08, AC-09, AC-10, AC-23)                      */
/* ================================================================== */

test("hoy no vence y es próxima; ayer vence; hoy+6 entra y hoy+7 no", () => {
  assert.equal(day(-1), "2026-11-11");
  assert.equal(day(6), "2026-11-18");
  assert.equal(day(7), "2026-11-19");

  const tasks = makeTasks(
    [
      { title: "Ayer", course: "C", dueDate: day(-1) },
      { title: "Hoy", course: "C", dueDate: TODAY },
      { title: "En seis", course: "C", dueDate: day(6) },
      { title: "En siete", course: "C", dueDate: day(7) },
      { title: "Sin fecha", course: "C", dueDate: "" },
      { title: "Completada ayer", course: "C", dueDate: day(-1), status: "completada" },
    ],
    { idFactory: seqIdFactory() },
  );

  const stats = computeStats(tasks, { today: NOW });
  assert.equal(stats.overdue, 1, "solo la de ayer");
  assert.equal(stats.upcoming7, 2, "hoy y hoy+6");

  assert.equal(isOverdue(tasks[0], NOW), true);
  assert.equal(isOverdue(tasks[1], NOW), false, "vence hoy, no está vencida");
  assert.equal(isUpcoming(tasks[1], NOW), true, "vence hoy, sí es próxima");
  assert.equal(isUpcoming(tasks[2], NOW), true, "hoy+6 es el último día incluido");
  assert.equal(isUpcoming(tasks[3], NOW), false, "hoy+7 queda fuera");
  assert.equal(isUpcoming(tasks[4], NOW), false, "sin fecha nunca es próxima");
  assert.equal(isUpcoming(tasks[5], NOW), false, "completada nunca es próxima");
  assert.equal(isOverdue(tasks[5], NOW), false, "completada nunca vence");
});

test("acepta el 29 de febrero de 2028 y rechaza fechas imposibles", () => {
  assert.equal(isValidDateOnly("2028-02-29"), true);
  assert.equal(parseDateOnly("2028-02-29").getDate(), 29);

  for (const bad of [
    "2026-02-30",
    "2026-13-01",
    "2026-00-10",
    "2026-01-00",
    "2026-04-31",
    "2027-02-29",
    "2026-2-3",
    "2026-11-12T00:00:00.000Z",
    "",
    null,
    undefined,
    20260230,
  ]) {
    assert.equal(isValidDateOnly(bad), false, `debe rechazar ${JSON.stringify(bad)}`);
    assert.equal(parseDateOnly(bad), null);
  }

  assert.throws(
    () =>
      createTask(
        { title: "Ensayo", course: "Historia", dueDate: "2026-02-30" },
        { now: NOW, idFactory: seqIdFactory() },
      ),
    (error) => error instanceof ValidationError && error.field === "dueDate",
  );
});

test("addDays cruza fin de año, meses y el 29 de febrero", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(addDays("2028-02-29", 1), "2028-03-01");
  assert.equal(addDays("2027-02-28", 1), "2027-03-01");
  assert.equal(addDays("2026-11-12", 0), TODAY);
  assert.throws(() => addDays("2026-02-30", 1), TypeError);
});

test("redondea el porcentaje de avance cuando el cociente es .5", () => {
  const oneOfEight = computeStats(
    withStatuses([
      "completada",
      "pendiente",
      "pendiente",
      "pendiente",
      "pendiente",
      "pendiente",
      "pendiente",
      "pendiente",
    ]),
    { today: NOW },
  );
  assert.equal(oneOfEight.completionRate, 13, "12.5 redondea a 13");

  const threeOfEight = computeStats(
    withStatuses([
      "completada",
      "completada",
      "completada",
      "pendiente",
      "pendiente",
      "pendiente",
      "pendiente",
      "pendiente",
    ]),
    { today: NOW },
  );
  assert.equal(threeOfEight.completionRate, 38, "37.5 redondea a 38");

  const oneOfTwoHundred = computeStats(
    withStatuses(
      Array.from({ length: 200 }, (_, index) => (index === 0 ? "completada" : "pendiente")),
    ),
    { today: NOW },
  );
  assert.equal(oneOfTwoHundred.completionRate, 1, "0.5 redondea a 1");
});

test("el avance es 0 con lista vacía, entero y nunca mayor que 100", () => {
  assert.equal(computeStats([], { today: NOW }).completionRate, 0);
  assert.equal(computeStats(null, { today: NOW }).completionRate, 0);

  const allDone = computeStats(withStatuses(Array.from({ length: 7 }, () => "completada")), {
    today: NOW,
  });
  assert.equal(allDone.completionRate, 100);
  assert.equal(Number.isInteger(allDone.completionRate), true);
  assert.equal(allDone.completed <= allDone.total, true);
});

/* ================================================================== */
/* Búsqueda y orden (AC-11, AC-13)                                     */
/* ================================================================== */

test("busca sin distinguir mayúsculas, acentos ni espacios sobrantes", () => {
  const tasks = makeTasks(
    [
      { title: "Cálculo diferencial", course: "Matemáticas", notes: "Capítulo 3" },
      { title: "Ensayo", course: "Historia", notes: "Revisar fuentes" },
    ],
    { idFactory: seqIdFactory() },
  );

  const ids = (query) => idsOf(filterTasks(tasks, { query }));
  assert.deepEqual(ids("CALCULO"), ["tsk_test01"]);
  assert.deepEqual(ids("  cálculo  "), ["tsk_test01"]);
  assert.deepEqual(ids("matematicas"), ["tsk_test01"]);
  assert.deepEqual(ids("CAPÍTULO"), ["tsk_test01"]);
  assert.deepEqual(ids("fuentes"), ["tsk_test02"]);
  assert.deepEqual(ids("no-existe"), []);
});

test("trata los caracteres especiales de regex como texto literal", () => {
  const tasks = makeTasks(
    [
      { title: "Ensayo (borrador)", course: "Historia" },
      { title: "Cálculo 2+2", course: "Cálculo" },
      { title: "Tarea final", course: "Historia" },
    ],
    { idFactory: seqIdFactory() },
  );

  const ids = (query) => idsOf(filterTasks(tasks, { query }));
  assert.deepEqual(ids("("), ["tsk_test01"]);
  assert.deepEqual(ids(")"), ["tsk_test01"]);
  assert.deepEqual(ids("2+2"), ["tsk_test02"]);
  assert.deepEqual(ids(".*"), [], "no debe comportarse como comodín");
  assert.deepEqual(ids("[a-z]+"), [], "no debe comportarse como clase de caracteres");
  assert.deepEqual(ids("^Ensayo$"), [], "no debe anclarse como regex");
});

test("una consulta de solo espacios no filtra nada", () => {
  const tasks = makeTasks(
    [
      { title: "Uno", course: "A" },
      { title: "Dos", course: "B" },
    ],
    { idFactory: seqIdFactory() },
  );

  assert.equal(filterTasks(tasks, { query: "   " }).length, 2);
  assert.equal(filterTasks(tasks, { query: "\t\n" }).length, 2);
});

test("ordena de forma estable: prioridad, createdAt e id, sin mutar la entrada", () => {
  const tasks = makeTasks(
    [
      {
        title: "Alta tardía",
        course: "C",
        priority: "alta",
        dueDate: "2026-11-20",
        at: new Date(2026, 10, 2, 8, 0, 0),
      },
      {
        title: "Alta temprana",
        course: "C",
        priority: "alta",
        dueDate: "2026-11-20",
        at: new Date(2026, 10, 1, 8, 0, 0),
      },
      {
        title: "Media",
        course: "C",
        priority: "media",
        dueDate: "2026-11-20",
        at: new Date(2026, 10, 3, 8, 0, 0),
      },
      { title: "Sin fecha", course: "C", priority: "baja", dueDate: "" },
    ],
    { idFactory: seqIdFactory() },
  );
  const snapshot = structuredClone(tasks);

  const sorted = sortTasks(tasks, "dueDate");
  assert.deepEqual(
    sorted.map((task) => task.title),
    ["Alta temprana", "Alta tardía", "Media", "Sin fecha"],
  );
  assert.deepEqual(tasks, snapshot, "la entrada no se reordena");
  assert.notEqual(sorted, tasks);

  // Empate total: mismo día, misma prioridad y mismo createdAt → decide el id
  const ties = makeTasks(
    [
      { title: "B", course: "C", dueDate: TODAY, at: NOW },
      { title: "A", course: "C", dueDate: TODAY, at: NOW },
    ],
    { idFactory: seqIdFactory() },
  );
  assert.deepEqual(idsOf(sortTasks(ties, "dueDate")), ["tsk_test01", "tsk_test02"]);
});

test("un criterio de orden desconocido se comporta como dueDate", () => {
  const tasks = makeTasks(
    [
      { title: "Uno", course: "C", dueDate: day(3) },
      { title: "Dos", course: "C", dueDate: day(-3) },
      { title: "Tres", course: "C", dueDate: "" },
    ],
    { idFactory: seqIdFactory() },
  );

  const expected = idsOf(sortTasks(tasks, "dueDate"));
  for (const sortBy of ["desconocido", "", null, undefined, 42, {}]) {
    assert.deepEqual(idsOf(sortTasks(tasks, sortBy)), expected, `sortBy ${String(sortBy)}`);
  }
});

/* ================================================================== */
/* normalizeTask (RF-7, RF-8, §5.2)                                    */
/* ================================================================== */

test("rechaza identificadores que no cumplen el patrón tsk_", () => {
  const badIds = [
    "malo",
    "tsk_12345",
    `tsk_${"a".repeat(33)}`,
    "TSK_abc123",
    "tsk_ABC123",
    "tsk_ab c123",
    "tsk_",
    " tsk_abc123",
    "",
    123,
    null,
    undefined,
  ];

  for (const id of badIds) {
    assert.throws(
      () => normalizeTask(validRaw({ id })),
      (error) =>
        error instanceof ValidationError &&
        error.code === "invalid_task" &&
        Boolean(error.errors.id),
      `debe rechazar el id ${JSON.stringify(id)}`,
    );
  }
});

test("acepta identificadores límite de 6 y 32 caracteres", () => {
  assert.equal(normalizeTask(validRaw({ id: "tsk_abc123" })).id, "tsk_abc123");
  const longest = `tsk_${"a".repeat(32)}`;
  assert.equal(normalizeTask(validRaw({ id: longest })).id, longest);
});

test("una tarea completada sin completedAt hereda updatedAt", () => {
  const task = normalizeTask(validRaw({ status: "completada", completedAt: undefined }));
  assert.equal(task.status, "completada");
  assert.equal(task.completedAt, task.updatedAt);
  assert.equal(task.completedAt, "2026-11-02T10:00:00.000Z");
});

test("una tarea no completada con completedAt lo limpia", () => {
  for (const status of ["pendiente", "en_progreso"]) {
    const task = normalizeTask(
      validRaw({ status, completedAt: "2026-11-02T10:00:00.000Z" }),
    );
    assert.equal(task.completedAt, null, `status ${status}`);
  }
});

test("un completedAt que no es ISO se sustituye por updatedAt", () => {
  const task = normalizeTask(validRaw({ status: "completada", completedAt: "ayer" }));
  assert.equal(task.completedAt, task.updatedAt);
});

test("corrige updatedAt anterior a createdAt y hereda si falta", () => {
  const earlier = normalizeTask(validRaw({ updatedAt: "2020-01-01T00:00:00.000Z" }));
  assert.equal(earlier.updatedAt, earlier.createdAt);

  const missing = normalizeTask(validRaw({ updatedAt: undefined }));
  assert.equal(missing.updatedAt, missing.createdAt);
});

test("ignora campos desconocidos y normaliza horas con coma", () => {
  const task = normalizeTask(
    validRaw({ estimatedHours: "3,5", notes: "  con espacios  ", extra: "ignorar" }),
  );
  assert.equal(task.estimatedHours, 3.5);
  assert.equal(task.notes, "con espacios");
  assert.equal("extra" in task, false);
});

/* ================================================================== */
/* Importación atómica (AC-18, RF-8)                                   */
/* ================================================================== */

test("acepta un arreglo simple de tareas válidas", () => {
  const result = importTasks(
    JSON.stringify([validRaw({ id: "tsk_uno001" }), validRaw({ id: "tsk_dos002" })]),
  );

  assert.equal(result.ok, true);
  assert.equal(result.version, SCHEMA_VERSION);
  assert.deepEqual(idsOf(result.tasks), ["tsk_uno001", "tsk_dos002"]);
});

test("rechaza un arreglo simple con ids duplicados", () => {
  const first = validRaw({ id: "tsk_dup001" });
  const result = importTasks(JSON.stringify([first, { ...first, title: "Copia" }]));

  assert.equal(result.ok, false);
  assert.equal(result.code, "duplicate_id");
  assert.deepEqual(result.tasks, [], "la importación es atómica");
});

test("rechaza versiones desconocidas, nulas o en texto", () => {
  const two = importTasks(JSON.stringify({ app: APP_ID, version: 2, tasks: [] }));
  assert.equal(two.ok, false);
  assert.equal(two.code, "unsupported_version");
  assert.equal(two.version, 2);

  const zero = importTasks(JSON.stringify({ app: APP_ID, version: 0, tasks: [] }));
  assert.equal(zero.code, "unsupported_version");

  const nullish = importTasks(JSON.stringify({ app: APP_ID, version: null, tasks: [] }));
  assert.equal(nullish.code, "unsupported_version");
  assert.equal(nullish.version, null);

  const asText = importTasks(JSON.stringify({ app: APP_ID, version: "1", tasks: [] }));
  assert.equal(asText.code, "unsupported_version");
  assert.equal(asText.version, null, "una versión en texto no se convierte a número");
});

test("acepta un arreglo vacío y rechaza null, 42 y una cadena JSON", () => {
  const empty = importTasks("[]");
  assert.equal(empty.ok, true);
  assert.deepEqual(empty.tasks, []);
  assert.equal(empty.version, SCHEMA_VERSION);

  assert.equal(importTasks("null").code, "invalid_document");
  assert.equal(importTasks("42").code, "invalid_document");
  assert.equal(importTasks('"texto"').code, "invalid_document");
  assert.equal(importTasks("true").code, "invalid_document");
});

test("rechaza una envoltura sin lista de tareas", () => {
  assert.equal(importTasks(JSON.stringify({ app: APP_ID, version: 1 })).code, "invalid_document");
  assert.equal(
    importTasks(JSON.stringify({ app: APP_ID, version: 1, tasks: {} })).code,
    "invalid_document",
  );
});

test("la importación inválida no escribe en el almacenamiento", () => {
  const storage = createMemoryStorage();
  saveTasks(storage, [makeTask()], { now: NOW });
  const before = storage.dump();

  const first = validRaw({ id: "tsk_dup001" });
  assert.equal(importTasks(JSON.stringify([first, first])).ok, false);
  assert.deepEqual(storage.dump(), before, "ni la clave de tareas ni el respaldo cambian");
});

test("al cargar, un arreglo simple con ids duplicados descarta el segundo y respalda", () => {
  const first = validRaw({ id: "tsk_dup001" });
  const raw = JSON.stringify([first, { ...first, title: "Copia" }]);
  const storage = createMemoryStorage({ [STORAGE_KEY]: raw });

  const loaded = loadTasks(storage);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.source, "storage");
  assert.equal(loaded.skipped, 1);
  assert.equal(loaded.tasks.length, 1);
  assert.equal(loaded.tasks[0].title, first.title, "se conserva la primera aparición");
  assert.equal(storage.dump()[BACKUP_KEY], raw);
});

/* ================================================================== */
/* updateTask / changeTaskStatus (RF-2, RF-4)                          */
/* ================================================================== */

test("rechaza una dueDate inválida sin mutar la tarea", () => {
  const task = makeTask({ dueDate: TODAY });
  const snapshot = structuredClone(task);

  assert.throws(
    () => updateTask(task, { dueDate: "2026-02-30" }, { now: LATER }),
    (error) =>
      error instanceof ValidationError &&
      error.field === "dueDate" &&
      Boolean(error.errors.dueDate),
  );
  assert.deepEqual(task, snapshot);
});

test("rechaza un estado desconocido sin tocar la lista", () => {
  const tasks = makeTasks([{ title: "Ensayo", course: "Historia" }], {
    idFactory: seqIdFactory(),
  });
  const snapshot = structuredClone(tasks);

  assert.throws(
    () => changeTaskStatus(tasks, "tsk_test01", "hecha", { now: LATER }),
    (error) =>
      error instanceof ValidationError && error.code === "invalid_enum" && error.field === "status",
  );
  assert.deepEqual(tasks, snapshot);

  assert.throws(() => changeTaskStatus(tasks, "tsk_ausente1", "pendiente", { now: LATER }), NotFoundError);
});

/* ================================================================== */
/* XSS como texto (AC-25)                                              */
/* ================================================================== */

test("guarda el HTML del título como texto literal y sobrevive al round-trip", () => {
  const html = '<img src=x onerror="alert(1)">';
  const task = createTask(
    { title: html, course: "Historia", notes: "<b>negrita</b>" },
    { now: NOW, idFactory: seqIdFactory() },
  );

  assert.equal(task.title, html);
  assert.equal(typeof task.title, "string");
  assert.equal(task.notes, "<b>negrita</b>");

  const { json } = exportTasks([task], { now: NOW });
  assert.equal(JSON.parse(json).tasks[0].title, html, "la exportación no escapa ni interpreta");
  assert.equal(json.includes("onerror"), true);

  const back = importTasks(json);
  assert.equal(back.ok, true);
  assert.equal(back.tasks[0].title, html);
  assert.equal(back.tasks[0].notes, "<b>negrita</b>");
});

/* ================================================================== */
/* Flujo completo de extremo a extremo (RNF-4)                         */
/* ================================================================== */

test("crear → filtrar → completar → métricas → exportar → importar con fechas límite", () => {
  const storage = createMemoryStorage();
  const tasks = makeTasks(
    [
      { title: "Vence ayer", course: "Historia", priority: "alta", dueDate: day(-1) },
      { title: "Vence hoy", course: "Historia", priority: "alta", dueDate: TODAY },
      { title: "Vence en seis", course: "Cálculo", priority: "media", dueDate: day(6) },
      { title: "Vence en siete", course: "Cálculo", priority: "baja", dueDate: day(7) },
    ],
    { idFactory: seqIdFactory() },
  );

  assert.equal(saveTasks(storage, tasks, { now: NOW }).ok, true);
  const loaded = loadTasks(storage);
  assert.equal(loaded.source, "storage");
  assert.deepEqual(loaded.tasks, tasks);

  assert.deepEqual(computeStats(loaded.tasks, { today: NOW }), {
    total: 4,
    pending: 4,
    inProgress: 0,
    completed: 0,
    overdue: 1,
    upcoming7: 2,
    completionRate: 0,
  });

  assert.deepEqual(
    filterTasks(loaded.tasks, { course: "Cálculo" }).map((task) => task.title),
    ["Vence en seis", "Vence en siete"],
  );

  const completed = changeTaskStatus(loaded.tasks, "tsk_test01", "completada", { now: LATER });
  assert.equal(completed[0].completedAt, LATER.toISOString());
  assert.equal(computeStats(completed, { today: NOW }).overdue, 0);
  assert.equal(computeStats(completed, { today: NOW }).completionRate, 25);

  assert.equal(saveTasks(storage, completed, { now: LATER }).ok, true);
  const { json, filename } = exportTasks(completed, { now: LATER });
  assert.equal(filename, "studyflow-2026-11-12.json");

  const imported = importTasks(json);
  assert.equal(imported.ok, true);
  assert.deepEqual(imported.tasks, completed);
  assert.equal(saveTasks(createMemoryStorage(), imported.tasks, { now: LATER }).ok, true);
});

/* ================================================================== */
/* Hallazgos del Tester ya corregidos — la aserción es el contrato.    */
/* Ver docs/TEST_REPORT.md (BUG-01…BUG-08) y la sección «Correcciones  */
/* del ciclo Tester→Developer» de docs/DEVELOPMENT_LOG.md.             */
/* ================================================================== */

test("BUG-01 updateTask con notes undefined no debe lanzar TypeError", () => {
  // El nombre conserva el hallazgo original del Tester. Decisión del Architect:
  // un campo con valor `undefined` significa «sin cambio», así que se conserva
  // el valor actual de la tarea en lugar de borrarlo o lanzar.
  const task = makeTask({ notes: "algo" });
  const updated = updateTask(task, { notes: undefined }, { now: LATER });
  assert.equal(updated.notes, "algo");
  assert.equal(updated.updatedAt, LATER.toISOString());
});

test("BUG-02 updateTask con dueDate undefined debe quedar como cadena vacía", () => {
  // El nombre conserva el hallazgo original del Tester. Decisión del Architect:
  // `undefined` significa «sin cambio», así que la fecha actual se conserva.
  const task = makeTask({ dueDate: TODAY });
  const updated = updateTask(task, { dueDate: undefined }, { now: LATER });
  assert.equal(updated.dueDate, TODAY);
});

test("BUG-03 updateTask con estimatedHours undefined no debe borrar las horas", () => {
  // Misma decisión: `undefined` conserva las horas actuales (4).
  const task = makeTask({ estimatedHours: 4 });
  const updated = updateTask(task, { estimatedHours: undefined }, { now: LATER });
  assert.equal(updated.estimatedHours, 4);
});

test("BUG-04 createTask debe rechazar un id que no cumple el patrón tsk_", () => {
  for (const bad of ["malo", "tsk_", "tsk_abc", "Tsk_abc123", "tsk_ABC123", "tsk_abc-123", 42, null]) {
    assert.throws(
      () =>
        createTask(
          { title: "Ensayo", course: "Historia" },
          { now: NOW, idFactory: () => bad },
        ),
      (error) => error instanceof ValidationError && error.code === "invalid_id",
      `debería rechazar el id ${JSON.stringify(bad)}`,
    );
  }

  // Un id válido sigue aceptándose
  const valid = createTask(
    { title: "Ensayo", course: "Historia" },
    { now: NOW, idFactory: () => "tsk_abc123" },
  );
  assert.equal(valid.id, "tsk_abc123");
});

test("BUG-05 importTasks debe rechazar una envoltura con app distinto de studyflow", () => {
  const result = importTasks(
    JSON.stringify({ app: "otra-app", version: SCHEMA_VERSION, tasks: [validRaw()] }),
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, "invalid_document");
  assert.deepEqual(result.tasks, []);

  // Sin `app` se mantiene la tolerancia con archivos hechos a mano
  const manual = importTasks(JSON.stringify({ version: SCHEMA_VERSION, tasks: [validRaw()] }));
  assert.equal(manual.ok, true);
  assert.equal(manual.tasks.length, 1);
});

test("BUG-06 computeStats no debe inflar total con entradas que no son tareas", () => {
  const stats = computeStats([null, makeTask()], { today: NOW });
  assert.equal(stats.total, 1);
});

test("BUG-07 getCourses debe unificar cursos que solo difieren en mayúsculas", () => {
  assert.deepEqual(getCourses([{ course: "Historia" }, { course: "historia" }]), ["Historia"]);
});

test("BUG-08 una tarea con fecha 9999-12-31 no debe empatar con las que no tienen fecha", () => {
  const tasks = makeTasks(
    [
      { title: "Sin fecha", course: "C", dueDate: "" },
      { title: "Lejana", course: "C", dueDate: "9999-12-31" },
    ],
    { idFactory: seqIdFactory() },
  );
  assert.deepEqual(
    sortTasks(tasks, "dueDate").map((task) => task.title),
    ["Lejana", "Sin fecha"],
  );
});
