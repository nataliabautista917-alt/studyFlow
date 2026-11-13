/**
 * Pruebas de búsqueda, filtros y orden (RF-6).
 *
 * Nombres tomados de la matriz de `docs/REQUIREMENTS.md` §9. Todas las tareas
 * se construyen con el dominio y un reloj fijo, sin depender de la hora real.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { addDays, filterTasks, getCourses, selectTasks, sortTasks } from "../src/domain.js";

import { TODAY, makeTasks, seqIdFactory } from "./helpers/fakes.js";

/** Fecha relativa a hoy. */
const day = (offset) => addDays(TODAY, offset);

/** Cinco tareas con texto, estado, curso, prioridad, tipo y fecha variados. */
function catalog() {
  return makeTasks(
    [
      {
        title: "Ensayo de HISTORIA",
        course: "Historia",
        notes: "Capítulos 3 y 4",
        status: "pendiente",
        priority: "alta",
        type: "tarea",
        dueDate: day(2),
      },
      {
        title: "Examen de cálculo",
        course: "Cálculo",
        notes: "",
        status: "en_progreso",
        priority: "media",
        type: "examen",
        dueDate: day(1),
      },
      {
        title: "Proyecto de biología",
        course: "Biología",
        notes: "Incluye laboratorio",
        status: "pendiente",
        priority: "baja",
        type: "proyecto",
        dueDate: "",
      },
      {
        title: "Lectura: El túnel",
        course: "Literatura",
        notes: "",
        status: "completada",
        priority: "media",
        type: "lectura",
        dueDate: day(-2),
      },
      {
        title: "Resumen de sociología",
        course: "Sociología",
        notes: "Comparar autores",
        status: "pendiente",
        priority: "alta",
        type: "tarea",
        dueDate: "",
      },
    ],
    { idFactory: seqIdFactory() },
  );
}

const idsOf = (tasks) => tasks.map((task) => task.id);

test("busca sin distinguir mayúsculas ni acentos", () => {
  const tasks = catalog();

  assert.deepEqual(idsOf(filterTasks(tasks, { query: "historia" })), ["tsk_test01"]);
  assert.deepEqual(idsOf(filterTasks(tasks, { query: "HISTORIA" })), ["tsk_test01"]);
  assert.deepEqual(idsOf(filterTasks(tasks, { query: "calculo" })), ["tsk_test02"]);
  assert.deepEqual(idsOf(filterTasks(tasks, { query: "CÁLCULO" })), ["tsk_test02"]);
  assert.deepEqual(idsOf(filterTasks(tasks, { query: "  biologia  " })), ["tsk_test03"]);
  assert.deepEqual(idsOf(filterTasks(tasks, { query: "TUNEL" })), ["tsk_test04"]);
  assert.deepEqual(idsOf(filterTasks(tasks, { query: "SOCIOLOGÍA" })), ["tsk_test05"]);
});

test("busca en título, curso y notas", () => {
  const tasks = catalog();
  const ids = (query) => idsOf(filterTasks(tasks, { query }));

  assert.deepEqual(ids("ensayo"), ["tsk_test01"], "coincide solo en el título");
  assert.deepEqual(ids("literatura"), ["tsk_test04"], "coincide solo en el curso");
  assert.deepEqual(ids("laboratorio"), ["tsk_test03"], "coincide solo en las notas");
  assert.deepEqual(ids("autores"), ["tsk_test05"], "coincide solo en las notas");
  assert.deepEqual(ids("capitulos"), ["tsk_test01"], "notas sin acento en la consulta");
  assert.deepEqual(ids("capítulos"), ["tsk_test01"], "y también con acento");
  assert.deepEqual(ids(""), ["tsk_test01", "tsk_test02", "tsk_test03", "tsk_test04", "tsk_test05"]);
});

test("combina estado, curso y prioridad", () => {
  const tasks = catalog();

  assert.deepEqual(idsOf(filterTasks(tasks, { status: "pendiente" })), [
    "tsk_test01",
    "tsk_test03",
    "tsk_test05",
  ]);
  assert.deepEqual(idsOf(filterTasks(tasks, { priority: "alta" })), ["tsk_test01", "tsk_test05"]);
  assert.deepEqual(idsOf(filterTasks(tasks, { course: "Cálculo" })), ["tsk_test02"]);
  assert.deepEqual(
    idsOf(filterTasks(tasks, { status: "pendiente", course: "Historia", priority: "alta" })),
    ["tsk_test01"],
  );
  assert.deepEqual(
    idsOf(filterTasks(tasks, { status: "completada", priority: "alta" })),
    [],
    "combinación imposible",
  );

  // El tipo también filtra (RF-6, Should)
  assert.deepEqual(idsOf(filterTasks(tasks, { type: "examen" })), ["tsk_test02"]);

  // Sin filtros activos se devuelve todo
  assert.equal(filterTasks(tasks, {}).length, 5);
  assert.equal(filterTasks(tasks).length, 5);
});

test("devuelve lista vacía si nada coincide", () => {
  const tasks = catalog();

  assert.deepEqual(filterTasks(tasks, { query: "zzz" }), []);
  assert.deepEqual(filterTasks(tasks, { query: "Ensayo", course: "Cálculo" }), []);
  assert.deepEqual(filterTasks(tasks, { status: "en_progreso", priority: "baja" }), []);
  assert.deepEqual(filterTasks([], { query: "Ensayo" }), []);
  assert.deepEqual(filterTasks(null, { query: "Ensayo" }), []);
});

test("ordena por fecha con las sin fecha al final", () => {
  const tasks = catalog();
  const sorted = sortTasks(tasks, "dueDate");

  assert.deepEqual(idsOf(sorted).slice(0, 3), ["tsk_test04", "tsk_test02", "tsk_test01"]);
  assert.deepEqual(
    sorted.slice(0, 3).map((task) => task.dueDate),
    [day(-2), day(1), day(2)],
    "orden ascendente",
  );
  assert.equal(sorted.slice(3).every((task) => task.dueDate === ""), true, "sin fecha al final");
  assert.equal(sorted.length, 5);

  // La entrada no se reordena
  assert.deepEqual(idsOf(tasks), [
    "tsk_test01",
    "tsk_test02",
    "tsk_test03",
    "tsk_test04",
    "tsk_test05",
  ]);

  // Un criterio desconocido se comporta como `dueDate`
  assert.deepEqual(idsOf(sortTasks(tasks, "desconocido")), idsOf(sorted));
});

test("ordena por prioridad y desempata por fecha", () => {
  const tasks = makeTasks(
    [
      { title: "Baja temprana", course: "Curso", priority: "baja", dueDate: day(1) },
      { title: "Alta tardía", course: "Curso", priority: "alta", dueDate: day(5) },
      { title: "Media única", course: "Curso", priority: "media", dueDate: day(3) },
      { title: "Alta temprana", course: "Curso", priority: "alta", dueDate: day(2) },
      { title: "Baja sin fecha", course: "Curso", priority: "baja", dueDate: "" },
    ],
    { idFactory: seqIdFactory() },
  );

  const sorted = sortTasks(tasks, "priority");

  assert.deepEqual(
    sorted.map((task) => task.title),
    ["Alta temprana", "Alta tardía", "Media única", "Baja temprana", "Baja sin fecha"],
  );
  assert.deepEqual(
    [...new Set(sorted.map((task) => task.priority))],
    ["alta", "media", "baja"],
  );

  // La entrada conserva su orden original
  assert.equal(tasks[0].title, "Baja temprana");
  assert.equal(tasks.length, 5);
});

test("ordena por creación con la más reciente primero", () => {
  const tasks = makeTasks(
    [
      { title: "Más antigua", course: "Curso", at: new Date(2026, 10, 1, 8, 0, 0) },
      { title: "Intermedia", course: "Curso", at: new Date(2026, 10, 5, 8, 0, 0) },
      { title: "Más reciente", course: "Curso", at: new Date(2026, 10, 10, 8, 0, 0) },
    ],
    { idFactory: seqIdFactory() },
  );

  const sorted = sortTasks(tasks, "createdAt");

  assert.deepEqual(
    sorted.map((task) => task.title),
    ["Más reciente", "Intermedia", "Más antigua"],
  );
  const createdAts = sorted.map((task) => task.createdAt);
  assert.deepEqual(createdAts, [...createdAts].toSorted().reverse());

  // La entrada conserva su orden original
  assert.deepEqual(
    tasks.map((task) => task.title),
    ["Más antigua", "Intermedia", "Más reciente"],
  );
});

test("selectTasks no muta la entrada", () => {
  const tasks = catalog();
  const snapshot = structuredClone(tasks);

  const selected = selectTasks(tasks, {
    filters: { status: "pendiente" },
    sortBy: "priority",
  });

  assert.deepEqual(tasks, snapshot, "nada cambia en la entrada");
  assert.notEqual(selected, tasks);
  assert.deepEqual(idsOf(selected), ["tsk_test01", "tsk_test05", "tsk_test03"]);
  assert.ok(selected.includes(tasks[0]), "los objetos de tarea no se clonan");

  // Sin argumentos: sin filtros y por fecha ascendente
  assert.equal(selectTasks(tasks).length, 5);
  assert.deepEqual(idsOf(selectTasks(tasks)), idsOf(sortTasks(tasks, "dueDate")));
});

test("lista cursos únicos ordenados", () => {
  const tasks = makeTasks(
    [
      { title: "Uno", course: "Historia" },
      { title: "Dos", course: "  Biología  " },
      { title: "Tres", course: "Cálculo" },
      { title: "Cuatro", course: "Historia" },
      { title: "Cinco", course: "Matemáticas" },
    ],
    { idFactory: seqIdFactory() },
  );

  const snapshot = structuredClone(tasks);

  assert.deepEqual(getCourses(tasks), ["Biología", "Cálculo", "Historia", "Matemáticas"]);
  assert.equal(getCourses([]).length, 0);
  assert.equal(getCourses(null).length, 0);

  // Los cursos vacíos o solo con espacios se ignoran
  assert.deepEqual(getCourses([{ course: "" }, { course: "   " }, { course: "Historia" }]), [
    "Historia",
  ]);

  // El curso se recorta al crear la tarea y la entrada no se muta
  assert.equal(tasks[1].course, "Biología");
  assert.deepEqual(tasks, snapshot);
});
