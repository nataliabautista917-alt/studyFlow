/**
 * Pruebas del dominio puro (RF-1…RF-4, RF-9, RNF-1).
 *
 * Los nombres de las pruebas son los de la matriz de `docs/REQUIREMENTS.md` §9.
 * Reloj e identificadores siempre inyectados: nada depende de la hora real.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  LIMITS,
  NotFoundError,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  ValidationError,
  addDays,
  changeTaskStatus,
  createSampleTasks,
  createTask,
  deleteTask,
  findTask,
  formatDateEs,
  isValidDateOnly,
  normalizeTask,
  parseDateOnly,
  toDateOnly,
  updateTask,
  validateTaskInput,
} from "../src/domain.js";

import { NOW, TODAY, makeTasks, seqIdFactory } from "./helpers/fakes.js";

/** Reloj posterior a `NOW`, para comprobar `updatedAt` y `completedAt`. */
const LATER = new Date(2026, 10, 12, 10, 30, 0);

/** Claves exactas de una tarea (REQUIREMENTS §5). */
const TASK_KEYS = [
  "completedAt",
  "course",
  "createdAt",
  "dueDate",
  "estimatedHours",
  "id",
  "notes",
  "priority",
  "status",
  "title",
  "type",
  "updatedAt",
];

/* ------------------------------------------------------------------ */
/* RF-1 · Crear                                                        */
/* ------------------------------------------------------------------ */

test("crea una tarea con estado pendiente por defecto", () => {
  const task = createTask(
    { title: "  Ensayo de historia  ", course: "  Historia  " },
    { now: NOW, idFactory: seqIdFactory() },
  );

  assert.equal(task.status, "pendiente");
  assert.equal(task.priority, "media");
  assert.equal(task.type, "tarea");
  assert.equal(task.dueDate, "");
  assert.equal(task.estimatedHours, 0);
  assert.equal(task.notes, "");
  assert.equal(task.completedAt, null);
  assert.equal(task.title, "Ensayo de historia");
  assert.equal(task.course, "Historia");
  assert.equal(task.id, "tsk_test01");
  assert.match(task.id, /^tsk_[a-z0-9]{6,32}$/);
  assert.equal(task.createdAt, NOW.toISOString());
  assert.equal(task.updatedAt, NOW.toISOString());
  assert.deepEqual(Object.keys(task).toSorted(), TASK_KEYS);
});

test("rechaza título vacío o solo espacios", () => {
  for (const title of ["", "   ", "\t\n", undefined, null, 42]) {
    assert.throws(
      () =>
        createTask({ title, course: "Historia" }, { now: NOW, idFactory: seqIdFactory() }),
      (error) => {
        assert.ok(error instanceof ValidationError, "debe ser ValidationError");
        assert.equal(error.field, "title");
        assert.equal(error.errors.title, "El título es obligatorio.");
        return true;
      },
      `debe rechazar el título ${JSON.stringify(title)}`,
    );
  }

  const { valid, errors } = validateTaskInput({
    title: "   ",
    course: "Historia",
    type: "tarea",
    status: "pendiente",
    priority: "media",
  });
  assert.equal(valid, false);
  assert.equal(errors.title, "El título es obligatorio.");

  // Un título con contenido sí se acepta (y se recorta)
  const task = createTask(
    { title: " Ensayo ", course: "Historia" },
    { now: NOW, idFactory: seqIdFactory() },
  );
  assert.equal(task.title, "Ensayo");
});

test("rechaza una fecha inexistente como 2026-02-30", () => {
  assert.equal(parseDateOnly("2026-02-30"), null);
  assert.equal(isValidDateOnly("2026-02-30"), false);

  assert.throws(
    () =>
      createTask(
        { title: "Ensayo", course: "Historia", dueDate: "2026-02-30" },
        { now: NOW, idFactory: seqIdFactory() },
      ),
    (error) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, "dueDate");
      assert.equal(error.errors.dueDate, "Usa una fecha válida (AAAA-MM-DD).");
      return true;
    },
  );

  // Otras fechas imposibles: mes 13, 31 de abril, formato suelto
  assert.equal(isValidDateOnly("2026-13-01"), false);
  assert.equal(isValidDateOnly("2026-04-31"), false);
  assert.equal(isValidDateOnly("2026-2-3"), false);
  assert.equal(isValidDateOnly(""), false);
  assert.equal(isValidDateOnly(20260230), false);
});

test("acepta una fecha real de año bisiesto como 2028-02-29", () => {
  assert.equal(isValidDateOnly("2028-02-29"), true);
  assert.equal(parseDateOnly("2028-02-29").getDate(), 29);
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");

  const task = createTask(
    { title: "Ensayo", course: "Historia", dueDate: "2028-02-29" },
    { now: NOW, idFactory: seqIdFactory() },
  );
  assert.equal(task.dueDate, "2028-02-29");

  // 2027 no es bisiesto
  assert.equal(isValidDateOnly("2027-02-29"), false);
});

test("normaliza horas con coma decimal", () => {
  const cases = [
    ["3,5", 3.5],
    ["0,25", 0.25],
    ["4", 4],
    [" 2,5 ", 2.5],
    ["3,456", 3.46],
    ["", 0],
    [3.25, 3.25],
    [null, 0],
    [undefined, 0],
  ];

  for (const [input, expected] of cases) {
    const task = createTask(
      { title: "Ensayo", course: "Historia", estimatedHours: input },
      { now: NOW, idFactory: seqIdFactory() },
    );
    assert.equal(task.estimatedHours, expected, `estimatedHours de ${JSON.stringify(input)}`);
  }
});

test("rechaza horas fuera del rango 0-100", () => {
  for (const input of [101, -1, "100,5", "muchas", NaN, {}, []]) {
    assert.throws(
      () =>
        createTask(
          { title: "Ensayo", course: "Historia", estimatedHours: input },
          { now: NOW, idFactory: seqIdFactory() },
        ),
      (error) => {
        assert.ok(error instanceof ValidationError);
        assert.equal(error.field, "estimatedHours");
        assert.equal(
          error.errors.estimatedHours,
          `Las horas deben ser un número entre 0 y ${LIMITS.estimatedHoursMax}.`,
        );
        return true;
      },
      `debe rechazar ${JSON.stringify(input)}`,
    );
  }

  // Los extremos del rango son válidos
  for (const [input, expected] of [
    [0, 0],
    [100, 100],
    ["0", 0],
    ["100", 100],
  ]) {
    const task = createTask(
      { title: "Ensayo", course: "Historia", estimatedHours: input },
      { now: NOW, idFactory: seqIdFactory() },
    );
    assert.equal(task.estimatedHours, expected);
  }
});

test("rechaza título, curso y notas por encima del límite", () => {
  const longTitle = "a".repeat(LIMITS.title + 1);
  const longCourse = "b".repeat(LIMITS.course + 1);
  const longNotes = "c".repeat(LIMITS.notes + 1);

  const check = (input, field) => {
    assert.throws(
      () => createTask(input, { now: NOW, idFactory: seqIdFactory() }),
      (error) => {
        assert.ok(error instanceof ValidationError);
        assert.equal(error.field, field);
        assert.match(error.errors[field], /no puede superar|no pueden superar/);
        return true;
      },
    );
  };

  check({ title: longTitle, course: "Historia" }, "title");
  check({ title: "Ensayo", course: longCourse }, "course");
  check({ title: "Ensayo", course: "Historia", notes: longNotes }, "notes");

  assert.match(
    validateTaskInput({
      title: longTitle,
      course: "Historia",
      type: "tarea",
      status: "pendiente",
      priority: "media",
    }).errors.title,
    /120/,
  );
  assert.match(
    validateTaskInput({
      title: "Ensayo",
      course: longCourse,
      type: "tarea",
      status: "pendiente",
      priority: "media",
    }).errors.course,
    /60/,
  );
  assert.match(
    validateTaskInput({
      title: "Ensayo",
      course: "Historia",
      notes: longNotes,
      type: "tarea",
      status: "pendiente",
      priority: "media",
    }).errors.notes,
    /500/,
  );

  // Los tres errores se acumulan en una sola llamada
  const { valid, errors } = validateTaskInput({
    title: longTitle,
    course: longCourse,
    notes: longNotes,
    type: "tarea",
    status: "pendiente",
    priority: "media",
  });
  assert.equal(valid, false);
  assert.deepEqual(Object.keys(errors).toSorted(), ["course", "notes", "title"]);

  // Los valores exactos del límite se aceptan
  const ok = createTask(
    { title: "a".repeat(LIMITS.title), course: "b".repeat(LIMITS.course), notes: "c".repeat(LIMITS.notes) },
    { now: NOW, idFactory: seqIdFactory() },
  );
  assert.equal(ok.title.length, LIMITS.title);
  assert.equal(ok.course.length, LIMITS.course);
  assert.equal(ok.notes.length, LIMITS.notes);
});

/* ------------------------------------------------------------------ */
/* RF-2 · Editar                                                       */
/* ------------------------------------------------------------------ */

test("actualiza sin mutar la tarea original", () => {
  const original = createTask(
    { title: "Ensayo de historia", course: "Historia", estimatedHours: 4 },
    { now: NOW, idFactory: seqIdFactory() },
  );
  const snapshot = structuredClone(original);

  const updated = updateTask(
    original,
    { title: "Ensayo final", priority: "alta", notes: "Capítulos 3 y 4" },
    { now: LATER },
  );

  assert.notEqual(updated, original, "debe devolver un objeto nuevo");
  assert.deepEqual(original, snapshot, "la tarea original no debe cambiar");
  assert.equal(updated.title, "Ensayo final");
  assert.equal(updated.priority, "alta");
  assert.equal(updated.notes, "Capítulos 3 y 4");
  assert.equal(updated.course, "Historia", "los campos no parcheados se conservan");
  assert.equal(updated.estimatedHours, 4);
  assert.equal(updated.id, original.id);
  assert.equal(updated.createdAt, original.createdAt);
  assert.equal(updated.updatedAt, LATER.toISOString());
});

test("ignora id y createdAt en el patch", () => {
  const task = createTask(
    { title: "Ensayo de historia", course: "Historia" },
    { now: NOW, idFactory: seqIdFactory() },
  );

  const updated = updateTask(
    task,
    {
      id: "tsk_intruso99",
      createdAt: "2001-01-01T00:00:00.000Z",
      updatedAt: "2001-01-01T00:00:00.000Z",
      completedAt: "2001-01-01T00:00:00.000Z",
      title: "Solo el título cambia",
    },
    { now: LATER },
  );

  assert.equal(updated.id, task.id);
  assert.equal(updated.createdAt, task.createdAt);
  assert.equal(updated.updatedAt, LATER.toISOString());
  assert.equal(updated.completedAt, null);
  assert.equal(updated.title, "Solo el título cambia");
  assert.equal(task.title, "Ensayo de historia", "la tarea original no cambia");
});

test("lanza NotFoundError si la tarea no existe", () => {
  const tasks = makeTasks([{ title: "Ensayo", course: "Historia" }], {
    idFactory: seqIdFactory(),
  });

  assert.throws(
    () => changeTaskStatus(tasks, "tsk_ausente1", "completada", { now: LATER }),
    (error) => {
      assert.ok(error instanceof NotFoundError);
      assert.equal(error.id, "tsk_ausente1");
      assert.match(error.message, /tsk_ausente1/);
      return true;
    },
  );

  assert.throws(() => deleteTask(tasks, "tsk_ausente1"), NotFoundError);
  assert.equal(findTask(tasks, "tsk_ausente1"), undefined);
  assert.equal(tasks.length, 1, "la lista no cambia al fallar");
});

/* ------------------------------------------------------------------ */
/* RF-3 · Eliminar                                                     */
/* ------------------------------------------------------------------ */

test("elimina solo la tarea indicada", () => {
  const tasks = makeTasks(
    [
      { title: "Ensayo", course: "Historia" },
      { title: "Examen", course: "Cálculo" },
      { title: "Proyecto", course: "Biología" },
    ],
    { idFactory: seqIdFactory() },
  );

  const remaining = deleteTask(tasks, "tsk_test02");

  assert.equal(tasks.length, 3, "la entrada no se muta");
  assert.equal(remaining.length, 2);
  assert.deepEqual(
    remaining.map((task) => task.id),
    ["tsk_test01", "tsk_test03"],
  );
  assert.equal(remaining.includes(findTask(tasks, "tsk_test02")), false);
  assert.ok(remaining.includes(tasks[0]), "conserva las demás tareas");
  assert.ok(remaining.includes(tasks[2]));
  assert.notEqual(remaining, tasks);
});

/* ------------------------------------------------------------------ */
/* RF-4 · Estado                                                       */
/* ------------------------------------------------------------------ */

test("cambia el estado y registra completedAt", () => {
  const tasks = makeTasks([{ title: "Ensayo", course: "Historia" }], {
    idFactory: seqIdFactory(),
  });

  const completed = changeTaskStatus(tasks, "tsk_test01", "completada", { now: LATER });

  assert.equal(completed[0].status, "completada");
  assert.equal(completed[0].completedAt, LATER.toISOString());
  assert.equal(completed[0].updatedAt, LATER.toISOString());
  assert.equal(completed[0].createdAt, NOW.toISOString());

  // `en_progreso` no registra `completedAt`
  const inProgress = changeTaskStatus(completed, "tsk_test01", "en_progreso", { now: LATER });
  assert.equal(inProgress[0].status, "en_progreso");
  assert.equal(inProgress[0].completedAt, null);

  // Volver a completar conserva el primer `completedAt` y refresca `updatedAt`
  const again = new Date(2026, 10, 12, 12, 0, 0);
  const reCompleted = changeTaskStatus(completed, "tsk_test01", "completada", { now: again });
  assert.equal(reCompleted[0].completedAt, LATER.toISOString());
  assert.equal(reCompleted[0].updatedAt, again.toISOString());
});

test("limpia completedAt al reabrir", () => {
  const tasks = makeTasks([{ title: "Ensayo", course: "Historia", status: "completada" }], {
    idFactory: seqIdFactory(),
  });
  assert.equal(tasks[0].completedAt, NOW.toISOString(), "al crear completada se registra");

  const reopened = changeTaskStatus(tasks, "tsk_test01", "pendiente", { now: LATER });
  assert.equal(reopened[0].status, "pendiente");
  assert.equal(reopened[0].completedAt, null);

  const inProgress = changeTaskStatus(reopened, "tsk_test01", "en_progreso", { now: LATER });
  assert.equal(inProgress[0].completedAt, null);

  // Y volver a completarla lo registra de nuevo
  const reCompleted = changeTaskStatus(inProgress, "tsk_test01", "completada", { now: LATER });
  assert.equal(reCompleted[0].completedAt, LATER.toISOString());
});

test("no muta la lista al cambiar estado", () => {
  const tasks = makeTasks(
    [
      { title: "Ensayo", course: "Historia" },
      { title: "Examen", course: "Cálculo" },
    ],
    { idFactory: seqIdFactory() },
  );
  const snapshot = structuredClone(tasks);

  const result = changeTaskStatus(tasks, "tsk_test02", "en_progreso", { now: LATER });

  assert.notEqual(result, tasks);
  assert.deepEqual(tasks, snapshot, "ni la lista ni las tareas cambian");
  assert.notEqual(result[1], tasks[1], "la tarea modificada es una copia nueva");
  assert.equal(result[0], tasks[0], "las demás se reutilizan");
  assert.equal(result[1].status, "en_progreso");
});

test("rechaza un estado desconocido y no toca la lista", () => {
  const tasks = makeTasks([{ title: "Ensayo", course: "Historia" }], {
    idFactory: seqIdFactory(),
  });

  assert.throws(
    () => changeTaskStatus(tasks, "tsk_test01", "en curso", { now: LATER }),
    (error) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.code, "invalid_enum");
      assert.equal(error.field, "status");
      return true;
    },
  );
  assert.equal(tasks[0].status, "pendiente");
});

/* ------------------------------------------------------------------ */
/* RF-9 · Datos de ejemplo                                             */
/* ------------------------------------------------------------------ */

test("los ejemplos cubren estados, prioridades y tipos", () => {
  const samples = createSampleTasks({ now: NOW, idFactory: seqIdFactory() });

  assert.equal(samples.length, 6);
  assert.equal(new Set(samples.map((task) => task.id)).size, 6, "ids únicos");
  for (const task of samples) {
    assert.match(task.id, /^tsk_[a-z0-9]{6,32}$/);
    assert.equal(task.createdAt, NOW.toISOString());
  }

  for (const status of TASK_STATUSES) {
    assert.ok(samples.some((task) => task.status === status), `falta el estado ${status}`);
  }
  for (const priority of TASK_PRIORITIES) {
    assert.ok(samples.some((task) => task.priority === priority), `falta la prioridad ${priority}`);
  }
  for (const type of TASK_TYPES) {
    assert.ok(samples.some((task) => task.type === type), `falta el tipo ${type}`);
  }

  // Fechas relativas al reloj inyectado (RF-9)
  assert.ok(samples.some((task) => task.dueDate < TODAY), "hay una vencida");
  assert.ok(samples.some((task) => task.dueDate > TODAY), "hay una futura");
  assert.ok(samples.some((task) => task.status === "completada" && task.completedAt !== null));
});

/* ------------------------------------------------------------------ */
/* RNF-1 · Texto plano                                                 */
/* ------------------------------------------------------------------ */

test("no interpreta HTML en el título", () => {
  const html = '<img src=x onerror="alert(1)">Ensayo';
  const task = createTask(
    { title: html, course: "Historia", notes: "<b>negrita</b>" },
    { now: NOW, idFactory: seqIdFactory() },
  );

  assert.equal(task.title, html, "se guarda tal cual, sin interpretar ni escapar");
  assert.equal(task.notes, "<b>negrita</b>");
  assert.equal(typeof task.title, "string");
  assert.equal(task.title.includes("<"), true);

  const { valid, errors } = validateTaskInput({
    title: html,
    course: "Historia",
    type: "tarea",
    status: "pendiente",
    priority: "media",
  });
  assert.equal(valid, true);
  assert.deepEqual(errors, {});

  // Las etiquetas cuentan como caracteres: 3 + 119 + 4 = 126 > 120
  const { errors: longErrors } = validateTaskInput({
    title: `<b>${"x".repeat(119)}</b>`,
    course: "Historia",
    type: "tarea",
    status: "pendiente",
    priority: "media",
  });
  assert.match(longErrors.title, /120/);
});

/* ------------------------------------------------------------------ */
/* Fechas y datos externos                                             */
/* ------------------------------------------------------------------ */

test("convierte fechas locales sin desfase UTC", () => {
  assert.equal(TODAY, "2026-11-12");
  assert.equal(toDateOnly(NOW), "2026-11-12");
  assert.equal(toDateOnly(new Date(2026, 0, 1, 0, 0, 0)), "2026-01-01");
  // La última hora del día local sigue siendo el mismo día
  assert.equal(toDateOnly(new Date(2026, 11, 31, 23, 59, 59)), "2026-12-31");

  const parsed = parseDateOnly("2026-11-12");
  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 10);
  assert.equal(parsed.getDate(), 12);
  assert.equal(parsed.getHours(), 0);

  assert.equal(addDays("2026-11-12", 6), "2026-11-18");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.throws(() => addDays("2026-02-30", 1), TypeError);
  assert.throws(() => toDateOnly(new Date("ayer")), TypeError);
});

test("formatea fechas en español y devuelve vacío si son inválidas", () => {
  assert.match(formatDateEs("2026-11-14"), /^14\s+nov\.?\s+2026$/i);
  assert.match(formatDateEs("2026-01-05"), /^5\s+ene\.?\s+2026$/i);
  assert.equal(formatDateEs(""), "");
  assert.equal(formatDateEs("2026-02-30"), "");
  assert.equal(formatDateEs("14/11/2026"), "");
  assert.equal(formatDateEs(null), "");
  assert.equal(formatDateEs(undefined), "");
});

test("normaliza tareas externas y rechaza documentos inválidos", () => {
  const raw = {
    id: "tsk_externo1",
    title: "  Ensayo  ",
    course: " Historia ",
    type: "tarea",
    status: "completada",
    priority: "alta",
    dueDate: "",
    estimatedHours: "3,5",
    notes: "  notas  ",
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-02T10:00:00.000Z",
    extra: "se ignora",
  };

  const task = normalizeTask(raw);
  assert.equal(task.title, "Ensayo");
  assert.equal(task.course, "Historia");
  assert.equal(task.notes, "notas");
  assert.equal(task.estimatedHours, 3.5);
  assert.equal(task.dueDate, "");
  assert.equal(task.completedAt, "2026-11-02T10:00:00.000Z", "hereda de updatedAt");
  assert.equal("extra" in task, false);
  assert.deepEqual(Object.keys(task).toSorted(), TASK_KEYS);

  assert.throws(
    () => normalizeTask(null),
    (error) => error instanceof ValidationError && error.code === "invalid_document",
  );
  assert.throws(
    () => normalizeTask({ ...raw, id: "malo" }),
    (error) => error.code === "invalid_task" && Boolean(error.errors.id),
  );
  assert.throws(
    () => normalizeTask({ ...raw, status: "hecha" }),
    (error) => error.code === "invalid_task" && Boolean(error.errors.status),
  );
  assert.throws(
    () => normalizeTask({ ...raw, createdAt: "ayer" }),
    (error) => error.errors.createdAt !== undefined,
  );

  // `updatedAt` anterior a `createdAt` se corrige, no se rechaza
  const fixed = normalizeTask({ ...raw, updatedAt: "2020-01-01T00:00:00.000Z" });
  assert.equal(fixed.updatedAt, raw.createdAt);
});
