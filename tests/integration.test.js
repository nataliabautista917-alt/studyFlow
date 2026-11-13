/**
 * Pruebas de integración dominio + almacenamiento (RF-7, RF-8, RF-9, RNF-4).
 *
 * Reproducen el flujo real de la aplicación sin DOM: crear → guardar → cargar →
 * filtrar → completar → exportar → importar. Nombres de la matriz
 * `docs/REQUIREMENTS.md` §9 y reloj siempre inyectado.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  changeTaskStatus,
  computeStats,
  createSampleTasks,
  selectTasks,
} from "../src/domain.js";
import {
  clearTasks,
  exportTasks,
  importTasks,
  loadTasks,
  loadTheme,
  saveTasks,
  saveTheme,
} from "../src/storage.js";

import {
  NOW,
  TODAY,
  createFailingStorage,
  createMemoryStorage,
  makeTasks,
  seqIdFactory,
} from "./helpers/fakes.js";

/** Reloj posterior a `NOW`. */
const LATER = new Date(2026, 10, 12, 10, 30, 0);

/** Métricas del panel con el reloj fijo. */
const statsOf = (tasks) => computeStats(tasks, { today: NOW });

/** Tres tareas: dos pendientes (una vencida) y una en progreso. */
function scenario() {
  return makeTasks(
    [
      {
        title: "Ensayo de historia",
        course: "Historia",
        priority: "alta",
        dueDate: TODAY,
      },
      {
        title: "Examen de cálculo",
        course: "Cálculo",
        type: "examen",
        priority: "media",
        dueDate: "2026-11-11",
      },
      {
        title: "Proyecto de biología",
        course: "Biología",
        type: "proyecto",
        status: "en_progreso",
        priority: "baja",
      },
    ],
    { idFactory: seqIdFactory() },
  );
}

test("ciclo completo crear, filtrar, completar, exportar e importar", () => {
  const storage = createMemoryStorage();
  const tasks = scenario();

  // Crear y persistir
  assert.equal(saveTasks(storage, tasks, { now: NOW }).ok, true);

  // Cargar
  const loaded = loadTasks(storage);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.source, "storage");
  assert.deepEqual(loaded.tasks, tasks);

  // Filtrar
  const pending = selectTasks(loaded.tasks, {
    filters: { status: "pendiente" },
    sortBy: "dueDate",
  });
  assert.deepEqual(
    pending.map((task) => task.id),
    ["tsk_test02", "tsk_test01"],
    "la vencida va primero",
  );

  // Completar la vencida y persistir el nuevo estado
  const completed = changeTaskStatus(loaded.tasks, pending[0].id, "completada", { now: LATER });
  assert.equal(completed[1].completedAt, LATER.toISOString());
  assert.equal(saveTasks(storage, completed, { now: LATER }).ok, true);

  // Las métricas reflejan el cambio y siguen siendo coherentes
  const afterComplete = statsOf(loadTasks(storage).tasks);
  assert.deepEqual(afterComplete, {
    total: 3,
    pending: 1,
    inProgress: 1,
    completed: 1,
    overdue: 0,
    upcoming7: 1,
    completionRate: 33,
  });

  // Exportar
  const { json, filename } = exportTasks(completed, { now: LATER });
  assert.equal(filename, "studyflow-2026-11-12.json");

  // Importar en un almacenamiento nuevo
  const other = createMemoryStorage();
  const imported = importTasks(json);
  assert.equal(imported.ok, true);
  assert.equal(imported.tasks.length, 3);
  assert.equal(saveTasks(other, imported.tasks, { now: LATER }).ok, true);

  const restored = loadTasks(other);
  assert.deepEqual(restored.tasks, completed);
  assert.deepEqual(statsOf(restored.tasks), afterComplete, "las métricas sobreviven al viaje");
});

test("reset restaura los ejemplos", () => {
  const storage = createMemoryStorage();
  saveTasks(storage, scenario(), { now: NOW });
  saveTheme(storage, "dark");

  // Restablecer: borrar y volver a sembrar
  assert.equal(clearTasks(storage).ok, true);
  const samples = createSampleTasks({ now: NOW, idFactory: seqIdFactory() });
  assert.equal(saveTasks(storage, samples, { now: NOW }).ok, true);

  const loaded = loadTasks(storage);
  assert.equal(loaded.tasks.length, 6, "vuelven los seis ejemplos");
  assert.deepEqual(
    loaded.tasks.map((task) => task.id),
    ["tsk_test01", "tsk_test02", "tsk_test03", "tsk_test04", "tsk_test05", "tsk_test06"],
  );
  assert.equal(
    loaded.tasks.some((task) => task.title === "Ensayo de historia"),
    true,
    "los datos anteriores se descartan",
  );
  assert.deepEqual(statsOf(loaded.tasks), {
    total: 6,
    pending: 4,
    inProgress: 1,
    completed: 1,
    overdue: 1,
    upcoming7: 3,
    completionRate: 17,
  });
  assert.equal(loadTheme(storage), "dark", "restablecer no borra la preferencia de tema");
});

test("persistencia entre dos cargas del mismo almacenamiento", () => {
  const storage = createMemoryStorage();
  const tasks = scenario();
  saveTasks(storage, tasks, { now: NOW });

  const first = loadTasks(storage);
  const second = loadTasks(storage);

  assert.deepEqual(first.tasks, tasks);
  assert.deepEqual(second.tasks, tasks);
  assert.deepEqual(first.tasks, second.tasks);
  assert.notEqual(first.tasks, second.tasks, "cada carga devuelve su propia copia");

  // Modificar una copia no altera lo persistido
  first.tasks[0].title = "Mutado a mano";
  first.tasks.push({ id: "tsk_extra01" });
  const third = loadTasks(storage);
  assert.equal(third.tasks.length, 3);
  assert.equal(third.tasks[0].title, tasks[0].title);
});

test("fallo de guardado no pierde el estado en memoria", () => {
  const storage = createFailingStorage();
  const tasks = scenario();

  const saved = saveTasks(storage, tasks, { now: NOW });
  assert.equal(saved.ok, false);
  assert.equal(saved.code, "storage_unavailable");

  // El estado en memoria sigue disponible y la app puede seguir trabajando
  assert.equal(tasks.length, 3);
  const completed = changeTaskStatus(tasks, "tsk_test01", "completada", { now: LATER });
  assert.equal(completed[0].status, "completada");
  assert.equal(saveTasks(storage, completed, { now: LATER }).ok, false);
  assert.deepEqual(statsOf(completed), {
    total: 3,
    pending: 1,
    inProgress: 1,
    completed: 1,
    overdue: 1, // la otra pendiente sigue vencida
    upcoming7: 0,
    completionRate: 33,
  });

  // Y el almacenamiento averiado no ha conservado nada a medias
  assert.equal(loadTasks(storage).source, "empty");
});

test("el primer arranque siembra los ejemplos y los persiste", () => {
  const storage = createMemoryStorage();

  const boot = loadTasks(storage);
  assert.equal(boot.source, "empty");
  assert.deepEqual(boot.tasks, []);

  const seeded = createSampleTasks({ now: NOW, idFactory: seqIdFactory() });
  assert.equal(saveTasks(storage, seeded, { now: NOW }).ok, true);

  const second = loadTasks(storage);
  assert.equal(second.source, "storage");
  assert.equal(second.tasks.length, 6);
  assert.deepEqual(second.tasks, seeded, "el segundo arranque no vuelve a sembrar");
  assert.equal(statsOf(second.tasks).total, 6);
});
