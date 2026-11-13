/**
 * Pruebas de persistencia (RF-7, RF-8, RF-10).
 *
 * Nombres tomados de la matriz de `docs/REQUIREMENTS.md` §9. Todo el
 * almacenamiento es un doble en memoria: sin `localStorage` real, sin red y con
 * el reloj inyectado.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { ValidationError } from "../src/domain.js";
import {
  APP_ID,
  BACKUP_KEY,
  SCHEMA_VERSION,
  STORAGE_KEY,
  THEME_KEY,
  clearTasks,
  createSafeStorage,
  exportTasks,
  importTasks,
  loadTasks,
  loadTheme,
  saveTasks,
  saveTheme,
} from "../src/storage.js";

import {
  NOW,
  createFailingStorage,
  createMemoryStorage,
  makeTasks,
  seqIdFactory,
} from "./helpers/fakes.js";

/** Reloj posterior a `NOW`. */
const LATER = new Date(2026, 10, 12, 10, 30, 0);

/** Tres tareas válidas: una pendiente, una en progreso y una completada. */
function threeTasks() {
  return makeTasks(
    [
      {
        title: "Ensayo de historia",
        course: "Historia",
        priority: "alta",
        dueDate: "2026-11-14",
        estimatedHours: 4,
      },
      {
        title: "Examen de cálculo",
        course: "Cálculo",
        type: "examen",
        status: "en_progreso",
        dueDate: "2026-11-18",
      },
      {
        title: "Resumen de sociología",
        course: "Sociología",
        status: "completada",
        notes: "Comparar autores",
      },
    ],
    { idFactory: seqIdFactory() },
  );
}

/** Documento con la envoltura de la aplicación, listo para `importTasks`. */
function envelope(tasks, { version = SCHEMA_VERSION } = {}) {
  return JSON.stringify({
    app: APP_ID,
    version,
    updatedAt: NOW.toISOString(),
    tasks,
  });
}

/* ------------------------------------------------------------------ */
/* RF-7 · Persistencia                                                 */
/* ------------------------------------------------------------------ */

test("guarda y carga el mismo estado", () => {
  const storage = createMemoryStorage();
  const tasks = threeTasks();

  const saved = saveTasks(storage, tasks, { now: NOW });
  assert.equal(saved.ok, true);
  assert.equal(saved.code, null);
  assert.equal(saved.error, null);

  const loaded = loadTasks(storage);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.source, "storage");
  assert.equal(loaded.skipped, 0);
  assert.equal(loaded.error, null);
  assert.deepEqual(loaded.tasks, tasks);
  assert.notEqual(loaded.tasks, tasks, "la carga devuelve una copia nueva");

  // Un segundo guardado reemplaza el estado anterior
  const fewer = tasks.slice(0, 1);
  assert.equal(saveTasks(storage, fewer, { now: LATER }).ok, true);
  assert.deepEqual(loadTasks(storage).tasks, fewer);
});

test("crea un documento con versión 1", () => {
  const storage = createMemoryStorage();
  saveTasks(storage, threeTasks(), { now: NOW });

  const raw = storage.dump()[STORAGE_KEY];
  assert.equal(typeof raw, "string");

  const document = JSON.parse(raw);
  assert.deepEqual(Object.keys(document).toSorted(), ["app", "tasks", "updatedAt", "version"]);
  assert.equal(document.app, APP_ID);
  assert.equal(document.version, 1);
  assert.equal(document.version, SCHEMA_VERSION);
  assert.equal(document.updatedAt, NOW.toISOString());
  assert.equal(document.tasks.length, 3);
  assert.equal(document.tasks[0].id, "tsk_test01");
});

test("devuelve vacío si no hay datos", () => {
  const loaded = loadTasks(createMemoryStorage());
  assert.deepEqual(loaded, {
    ok: true,
    tasks: [],
    source: "empty",
    skipped: 0,
    error: null,
    code: null,
  });

  // Sin almacenamiento, y con datos de otras claves
  assert.equal(loadTasks(null).source, "empty");
  assert.equal(loadTasks(createMemoryStorage({ [THEME_KEY]: "dark" })).source, "empty");
  assert.deepEqual(loadTasks(undefined).tasks, []);
});

test("respalda y reporta datos corruptos", () => {
  const broken = "{no es json";
  const storage = createMemoryStorage({ [STORAGE_KEY]: broken });

  const loaded = loadTasks(storage);
  assert.equal(loaded.ok, false);
  assert.equal(loaded.source, "invalid");
  assert.equal(loaded.code, "invalid_json");
  assert.deepEqual(loaded.tasks, []);
  assert.equal(storage.dump()[BACKUP_KEY], broken, "se respalda el valor crudo");

  // Una versión desconocida también se respalda y no rompe la carga
  const raw = envelope(threeTasks(), { version: 2 });
  const future = createMemoryStorage({ [STORAGE_KEY]: raw });
  const result = loadTasks(future);
  assert.equal(result.ok, false);
  assert.equal(result.source, "invalid");
  assert.equal(result.code, "unsupported_version");
  assert.equal(future.dump()[BACKUP_KEY], raw);

  // Un documento válido sin tareas omitidas no genera respaldo
  const clean = createMemoryStorage({ [STORAGE_KEY]: envelope(threeTasks()) });
  assert.equal(loadTasks(clean).ok, true);
  assert.equal(clean.dump()[BACKUP_KEY], undefined);
});

test("descarta tareas inválidas al cargar y las cuenta", () => {
  const [first, second] = threeTasks();
  const invalid = { ...first, id: "tsk_test99", title: "   " };
  const raw = envelope([first, invalid, second]);
  const storage = createMemoryStorage({ [STORAGE_KEY]: raw });

  const loaded = loadTasks(storage);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.source, "storage");
  assert.equal(loaded.skipped, 1);
  assert.deepEqual(
    loaded.tasks.map((task) => task.id),
    ["tsk_test01", "tsk_test02"],
  );
  assert.equal(storage.dump()[BACKUP_KEY], raw, "el crudo se respalda antes de descartar");

  // Un id duplicado también se descarta y se conserva la primera aparición
  const duplicated = createMemoryStorage({
    [STORAGE_KEY]: envelope([first, { ...first, title: "Copia con otro título" }]),
  });
  const deduped = loadTasks(duplicated);
  assert.equal(deduped.ok, true);
  assert.equal(deduped.skipped, 1);
  assert.equal(deduped.tasks.length, 1);
  assert.equal(deduped.tasks[0].title, first.title);
});

test("saveTasks informa error si el almacenamiento falla", () => {
  const storage = createFailingStorage();
  const tasks = threeTasks();

  let result;
  assert.doesNotThrow(() => {
    result = saveTasks(storage, tasks, { now: NOW });
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "storage_unavailable");
  assert.match(result.error, /no se pudo guardar/i);

  // Tampoco lanza sin almacenamiento ni con una entrada que no es lista
  assert.equal(saveTasks(null, tasks).code, "storage_unavailable");
  assert.equal(saveTasks(storage, "no es una lista").code, "invalid_document");
});

/* ------------------------------------------------------------------ */
/* RF-8 · Exportar e importar                                          */
/* ------------------------------------------------------------------ */

test("exporta JSON parseable con envoltura y versión", () => {
  const tasks = threeTasks();
  const { json, filename } = exportTasks(tasks, { now: NOW });

  const document = JSON.parse(json);
  assert.equal(document.app, APP_ID);
  assert.equal(document.version, SCHEMA_VERSION);
  assert.equal(document.exportedAt, NOW.toISOString());
  assert.equal(document.tasks.length, 3);
  assert.equal(document.tasks[0].id, "tsk_test01");

  assert.equal(filename, "studyflow-2026-11-12.json");
  assert.match(filename, /^studyflow-\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(json, JSON.stringify(document, null, 2), "se serializa con 2 espacios");

  // Una entrada inválida impide exportar
  assert.throws(() => exportTasks([{ id: "malo" }], { now: NOW }), ValidationError);
  assert.throws(() => exportTasks("no es una lista", { now: NOW }), ValidationError);
});

test("importa una envoltura válida", () => {
  const tasks = threeTasks();
  const { json } = exportTasks(tasks, { now: NOW });

  const result = importTasks(json);
  assert.equal(result.ok, true);
  assert.equal(result.version, SCHEMA_VERSION);
  assert.equal(result.error, null);
  assert.equal(result.code, null);
  assert.deepEqual(result.tasks, tasks);

  // Una envoltura sin `version` se asume en la versión actual
  const withoutVersion = importTasks(JSON.stringify({ app: APP_ID, tasks }));
  assert.equal(withoutVersion.ok, true);
  assert.equal(withoutVersion.version, SCHEMA_VERSION);
  assert.equal(withoutVersion.tasks.length, 3);
});

test("importa un arreglo simple", () => {
  const result = importTasks(JSON.stringify(threeTasks()));

  assert.equal(result.ok, true);
  assert.equal(result.version, SCHEMA_VERSION);
  assert.deepEqual(
    result.tasks.map((task) => task.id),
    ["tsk_test01", "tsk_test02", "tsk_test03"],
  );
  assert.equal(result.tasks[2].status, "completada");
});

test("rechaza una versión desconocida", () => {
  const result = importTasks(envelope(threeTasks(), { version: 2 }));

  assert.equal(result.ok, false);
  assert.equal(result.code, "unsupported_version");
  assert.equal(result.version, 2);
  assert.deepEqual(result.tasks, []);
  assert.match(result.error, /versión/i);
});

test("rechaza la importación completa si una tarea es inválida", () => {
  const [first, second] = threeTasks();
  const invalid = { ...second, title: "   " };

  const result = importTasks(envelope([first, invalid]));
  assert.equal(result.ok, false);
  assert.equal(result.code, "invalid_task");
  assert.deepEqual(result.tasks, [], "la importación es atómica");

  // Un elemento que no es un objeto tampoco entra
  assert.equal(importTasks(envelope([first, "texto"])).code, "invalid_document");
  // Y un documento que no es objeto ni arreglo se rechaza de raíz
  assert.equal(importTasks(JSON.stringify(42)).code, "invalid_document");
});

test("rechaza ids duplicados al importar", () => {
  const [first] = threeTasks();
  const result = importTasks(envelope([first, { ...first, title: "Copia con otro título" }]));

  assert.equal(result.ok, false);
  assert.equal(result.code, "duplicate_id");
  assert.deepEqual(result.tasks, []);
  assert.match(result.error, /tsk_test01/);
});

test("informa error si el JSON no parsea", () => {
  const result = importTasks("{no es json");
  assert.equal(result.ok, false);
  assert.equal(result.code, "invalid_json");
  assert.equal(result.version, null);
  assert.deepEqual(result.tasks, []);

  // Documento vacío, no textual o sin lista de tareas
  assert.equal(importTasks("").code, "invalid_document");
  assert.equal(importTasks("   ").code, "invalid_document");
  assert.equal(importTasks(null).code, "invalid_document");
  assert.equal(importTasks(JSON.stringify({ app: APP_ID, version: 1 })).code, "invalid_document");
});

test("importar no escribe en el almacenamiento", () => {
  const storage = createMemoryStorage();
  const tasks = threeTasks();
  saveTasks(storage, tasks, { now: NOW });
  const before = storage.dump();

  const { json } = exportTasks(tasks, { now: LATER });
  const result = importTasks(json, { now: LATER });
  assert.equal(result.ok, true);

  assert.deepEqual(storage.dump(), before, "importar solo valida; no persiste");
  assert.equal(loadTasks(storage).tasks.length, 3);
});

/* ------------------------------------------------------------------ */
/* RF-10 · Tema                                                        */
/* ------------------------------------------------------------------ */

test("guarda y lee el tema; un valor inválido devuelve null", () => {
  const storage = createMemoryStorage();

  assert.equal(loadTheme(storage), null, "sin preferencia guardada");
  assert.equal(saveTheme(storage, "dark").ok, true);
  assert.equal(loadTheme(storage), "dark");
  assert.equal(storage.dump()[THEME_KEY], "dark");
  assert.equal(saveTheme(storage, "light").ok, true);
  assert.equal(loadTheme(storage), "light");

  const invalid = saveTheme(storage, "auto");
  assert.equal(invalid.ok, false);
  assert.equal(invalid.code, "invalid_theme");
  assert.equal(loadTheme(storage), "light", "la preferencia válida no cambia");

  // Valores basura guardados por otros medios se ignoran
  assert.equal(loadTheme(createMemoryStorage({ [THEME_KEY]: "auto" })), null);
  assert.equal(loadTheme(createMemoryStorage({ [THEME_KEY]: "DARK" })), null);
  assert.equal(loadTheme(createMemoryStorage({ [THEME_KEY]: "" })), null);

  // Sin almacenamiento utilizable
  assert.equal(saveTheme(createFailingStorage(), "dark").code, "storage_unavailable");
  assert.equal(saveTheme(null, "dark").code, "storage_unavailable");
  assert.equal(loadTheme(createFailingStorage({ failOn: "getItem" })), null);
});

/* ------------------------------------------------------------------ */
/* Bordes                                                              */
/* ------------------------------------------------------------------ */

test("loadTasks informa error si el almacenamiento no está disponible", () => {
  const loaded = loadTasks(createFailingStorage({ failOn: "getItem" }));

  assert.equal(loaded.ok, false);
  assert.equal(loaded.source, "invalid");
  assert.equal(loaded.code, "storage_unavailable");
  assert.deepEqual(loaded.tasks, []);
});

test("clearTasks elimina las tareas y conserva el tema", () => {
  const storage = createMemoryStorage();
  saveTasks(storage, threeTasks(), { now: NOW });
  saveTheme(storage, "dark");

  const result = clearTasks(storage);
  assert.equal(result.ok, true);
  assert.equal(storage.dump()[STORAGE_KEY], undefined);
  assert.equal(loadTasks(storage).source, "empty");
  assert.equal(loadTheme(storage), "dark", "el tema no se toca");

  // Un almacenamiento que falla al borrar informa error sin lanzar
  const failing = createFailingStorage({ failOn: "removeItem" });
  let broken;
  assert.doesNotThrow(() => {
    broken = clearTasks(failing);
  });
  assert.equal(broken.ok, false);
});

test("createSafeStorage cae en memoria si localStorage no sirve", () => {
  const blocked = {
    get localStorage() {
      throw new Error("almacenamiento bloqueado");
    },
  };
  const fallback = createSafeStorage(blocked);
  assert.equal(saveTasks(fallback, threeTasks(), { now: NOW }).ok, true);
  assert.equal(loadTasks(fallback).tasks.length, 3);

  // Sin localStorage devuelve un almacenamiento en memoria utilizable
  const empty = createSafeStorage({});
  assert.equal(typeof empty.setItem, "function");
  assert.equal(empty.getItem("nada"), null);

  // Con localStorage sano se usa el real
  const real = createSafeStorage({ localStorage: createMemoryStorage() });
  assert.equal(saveTheme(real, "dark").ok, true);
});
