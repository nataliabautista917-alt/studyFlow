/**
 * Pruebas de interfaz con DOM falso (RF-5, RF-6, RF-7, RF-8, RF-10, RNF-2, RNF-8).
 *
 * Cierran el hallazgo COV-01 de `docs/TEST_REPORT.md`: hasta ahora ninguna
 * prueba importaba `src/app.js`, así que los requisitos Must de interfaz no
 * tenían comprobación ejecutable. Aquí se carga el `index.html` real en el DOM
 * falso de `tests/helpers/fake-dom.js` y se arranca la aplicación con
 * `initApp({ doc, storage, now, idFactory })`.
 *
 * Determinismo: reloj fijo (`NOW`), identificadores secuenciales inyectados y
 * almacenamiento en memoria. Sin red, sin navegador y sin dependencias.
 *
 * Los límites del arnés (no hay CSS, ni layout, ni foco real de navegador)
 * están documentados al final de `tests/helpers/fake-dom.js`; las pruebas no
 * afirman nada que dependa de ellos.
 */

import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createDocument,
  fireEvent,
  installDownloadStubs,
  installMatchMedia,
  tick,
} from "./helpers/fake-dom.js";
import { NOW, createFailingStorage, createMemoryStorage, seqIdFactory } from "./helpers/fakes.js";
import { initApp } from "../src/app.js";

/** HTML real de la aplicación, tal como lo sirve `scripts/serve.mjs`. */
const HTML = readFileSync(new URL("../index.html", import.meta.url), "utf8");

/** Aplicaciones arrancadas en el archivo, para limpiar sus temporizadores al final. */
const started = [];

after(() => {
  for (const app of started) app.destroy();
  started.length = 0;
});

/** Reloj posterior a `NOW`, para comprobar `completedAt` y la marca de guardado. */
const LATER = new Date(2026, 10, 12, 18, 30, 0);

/** Retardo del debounce de la búsqueda en `src/app.js` (200 ms). */
const DEBOUNCE_MS = 200;

/** Ids de los controles del formulario, en el orden del contrato del DOM §3.4. */
const FIELD_IDS = Object.freeze({
  title: "task-title",
  course: "task-course",
  type: "task-type",
  dueDate: "task-due-date",
  priority: "task-priority",
  status: "task-status",
  estimatedHours: "task-hours",
  notes: "task-notes",
});

/**
 * Arranca la aplicación sobre un documento nuevo.
 *
 * Cada instancia se apunta en `started` para que el hook `after` del archivo
 * limpie sus temporizadores (los avisos viven entre 6 y 8 s y, si no, el
 * proceso de pruebas se quedaría esperándolos).
 *
 * @param {{ storage?: object, clock?: { current: Date }, idFactory?: () => string, html?: string }} [options]
 */
function boot(options = {}) {
  const doc = createDocument(options.html ?? HTML);
  const storage = options.storage ?? createMemoryStorage();
  const clock = options.clock ?? { current: NOW };
  const app = initApp({
    doc,
    storage,
    now: () => clock.current,
    idFactory: options.idFactory ?? seqIdFactory(),
  });
  started.push(app);
  return { app, clock, doc, storage, $: (id) => doc.getElementById(id) };
}

/** Tarjetas visibles en la lista. */
const cardsOf = (doc) => [...doc.querySelectorAll("#task-list article.task-card")];

/** Ids de las tarjetas visibles, en el orden en que se pintan. */
const cardIds = (doc) => cardsOf(doc).map((card) => card.dataset.id);

/** Títulos de las tarjetas visibles, en orden de pintado. */
const cardTitles = (doc) =>
  [...doc.querySelectorAll("#task-list .task-card__title")].map((node) => node.textContent);

/** Textos de los avisos visibles. */
const toastTexts = (doc) =>
  [...doc.querySelectorAll("#toast-region .toast")].map((node) => node.textContent);

/** Tarjeta concreta de la lista. */
const cardOf = (doc, id) => doc.querySelector(`#task-list article.task-card[data-id="${id}"]`);

/** Tareas persistidas en el almacenamiento. */
const storedTasks = (storage) => JSON.parse(storage.getItem("studyflow.tasks")).tasks;

/** Tarea persistida por id. */
const storedTask = (storage, id) => storedTasks(storage).find((task) => task.id === id);

/** Rellena los campos indicados del formulario de tarea. */
function fillForm($, values) {
  for (const [field, value] of Object.entries(values)) {
    const id = FIELD_IDS[field];
    assert.ok(id, `campo de formulario desconocido: ${field}`);
    const control = $(id);
    assert.ok(control, `falta el control #${id}`);
    control.value = String(value);
  }
}

/** Envía el formulario de tarea como lo haría el navegador. */
function submitForm($) {
  fireEvent($("task-form"), "submit");
}

/** Archivo falso para `#import-file` (el arnés no tiene `File` real). */
function fakeFile(content, name = "studyflow.json") {
  return { name, size: content.length, text: () => Promise.resolve(content) };
}

/** Espera al debounce de la búsqueda más un margen. */
const settleDebounce = () => tick(DEBOUNCE_MS + 60);

/** Espera a que terminen los manejadores asíncronos (promesas ya resueltas). */
const settleAsync = () => tick();

/* ================================================================== */
/* 1. Primer arranque                                                  */
/* ================================================================== */

test("UI-01 · el primer arranque siembra 6 ejemplos, los persiste y pinta las métricas", () => {
  const { doc, storage, $ } = boot();

  assert.equal(cardsOf(doc).length, 6, "se pintan las 6 tareas de ejemplo");
  assert.equal($("stat-total").textContent, "6");
  assert.equal($("stat-pending").textContent, "4");
  assert.equal($("stat-in-progress").textContent, "1");
  assert.equal($("stat-completed").textContent, "1");
  assert.equal($("stat-overdue").textContent, "1");
  assert.equal($("stat-upcoming").textContent, "3");
  assert.equal($("stat-progress").textContent, "17 %");
  assert.equal($("progress-bar").value, 17);
  assert.equal($("progress-bar").getAttribute("aria-valuetext"), "17 %");
  assert.equal($("task-count").textContent, "6 tareas");
  assert.equal($("empty-state").hidden, true, "no se muestra el estado vacío");

  // Orden por defecto: fecha de entrega ascendente, con las vencidas primero.
  assert.deepEqual(cardIds(doc), [
    "tsk_test05",
    "tsk_test06",
    "tsk_test01",
    "tsk_test04",
    "tsk_test02",
    "tsk_test03",
  ]);

  // Se persiste con la versión del esquema y sin avisos de almacenamiento.
  const document = JSON.parse(storage.getItem("studyflow.tasks"));
  assert.equal(document.version, 1);
  assert.equal(document.tasks.length, 6);
  assert.equal($("storage-warning").hidden, true);
  assert.match($("storage-note").textContent, /^6 tareas · guardado a las \d{2}:\d{2}$/);
});

/* ================================================================== */
/* 2. Crear                                                            */
/* ================================================================== */

test("UI-02 · crear una tarea válida la añade a la lista, sube el total, persiste y cierra el diálogo", () => {
  const { doc, storage, $ } = boot();

  $("btn-new-task").click();
  assert.equal($("task-dialog").open, true, "el diálogo queda abierto");
  assert.equal($("task-dialog-title").textContent, "Nueva tarea");
  assert.equal($("task-type").value, "tarea", "el formulario arranca con los valores por defecto");
  assert.equal($("task-priority").value, "media");
  assert.equal($("task-status").value, "pendiente");

  fillForm($, {
    title: "Ensayo de física",
    course: "Física",
    type: "examen",
    dueDate: "2026-11-20",
    priority: "alta",
    estimatedHours: "3",
    notes: "Repasar el capítulo 4",
  });
  submitForm($);

  assert.equal($("task-dialog").open, false, "el diálogo se cierra al guardar");
  assert.equal($("stat-total").textContent, "7");
  assert.ok(cardIds(doc).includes("tsk_test07"), "la tarea nueva aparece en la lista");

  const card = cardOf(doc, "tsk_test07");
  assert.equal(card.querySelector(".task-card__title").textContent, "Ensayo de física");
  assert.equal(card.querySelector(".task-card__course").textContent, "Física");
  assert.equal(card.querySelector(".task-card__hours").textContent, "3 h");
  assert.equal(card.querySelector(".task-card__notes").textContent, "Repasar el capítulo 4");

  assert.equal(storedTasks(storage).length, 7, "se persiste la tarea nueva");
  assert.equal(storedTask(storage, "tsk_test07").dueDate, "2026-11-20");
  assert.ok(toastTexts(doc).some((text) => text.includes("Tarea creada")));
});

/* ================================================================== */
/* 3. Validación                                                       */
/* ================================================================== */

test("UI-03 · el formulario inválido no crea nada y marca los campos con error", () => {
  const { doc, storage, $ } = boot();

  $("btn-new-task").click();
  fillForm($, { title: "   ", course: "" });
  submitForm($);

  assert.equal($("stat-total").textContent, "6", "no se crea ninguna tarea");
  assert.equal(storedTasks(storage).length, 6, "tampoco se persiste nada");
  assert.equal($("task-dialog").open, true, "el diálogo sigue abierto para corregir");

  assert.equal($("task-title").getAttribute("aria-invalid"), "true");
  assert.equal($("task-title").classList.contains("is-invalid"), true);
  assert.equal($("task-title-error").textContent, "El título es obligatorio.");
  assert.equal($("task-course").getAttribute("aria-invalid"), "true");
  assert.equal($("task-course-error").textContent, "El curso es obligatorio.");

  // El resumen anuncia todos los campos revisados y el foco va al primero.
  assert.match($("form-errors").textContent, /^Revisa 2 campos: /);
  assert.ok($("form-errors").textContent.includes("El título es obligatorio."));
  assert.equal(doc.activeElement, $("task-title"), "el foco va al primer campo con error");
  assert.ok(toastTexts(doc).some((text) => text.includes("Revisa los campos")));

  // Al corregir, los errores se limpian.
  fillForm($, { title: "Ensayo de física", course: "Física" });
  submitForm($);
  assert.equal($("task-title-error").textContent, "");
  assert.equal($("task-title").getAttribute("aria-invalid"), null);
  assert.equal($("form-errors").textContent, "");
  assert.equal($("stat-total").textContent, "7");
});

/* ================================================================== */
/* 4. Editar                                                           */
/* ================================================================== */

test("UI-04 · editar conserva id y createdAt y actualiza la tarjeta", () => {
  const { doc, storage, $ } = boot();
  const before = storedTask(storage, "tsk_test01");

  cardOf(doc, "tsk_test01").querySelector('button[data-action="edit"]').click();
  assert.equal($("task-dialog").open, true);
  assert.equal($("task-dialog-title").textContent, "Editar tarea");
  assert.equal($("task-id").value, "tsk_test01");
  assert.equal($("task-title").value, "Ensayo de historia", "el formulario se rellena con la tarea");
  assert.equal($("task-course").value, "Historia");
  assert.equal($("task-due-date").value, "2026-11-14");

  fillForm($, { title: "Ensayo de historia v2", estimatedHours: "5" });
  submitForm($);

  const after = storedTask(storage, "tsk_test01");
  assert.equal(after.id, before.id, "el id no cambia");
  assert.equal(after.createdAt, before.createdAt, "createdAt no cambia");
  assert.equal(after.title, "Ensayo de historia v2");
  assert.equal(after.estimatedHours, 5);
  assert.equal(storedTasks(storage).length, 6, "no se duplica la tarea");

  const card = cardOf(doc, "tsk_test01");
  assert.equal(card.querySelector(".task-card__title").textContent, "Ensayo de historia v2");
  assert.equal(card.querySelector(".task-card__hours").textContent, "5 h");
  assert.equal($("stat-total").textContent, "6");
});

/* ================================================================== */
/* 5. Estados                                                          */
/* ================================================================== */

test("UI-05 · el ciclo Iniciar → Completar → Reabrir actualiza completedAt y las métricas", () => {
  const clock = { current: NOW };
  const { doc, storage, $ } = boot({ clock });

  cardOf(doc, "tsk_test01").querySelector('button[data-action="start"]').click();
  assert.equal(cardOf(doc, "tsk_test01").dataset.status, "en_progreso");
  assert.equal($("stat-pending").textContent, "3");
  assert.equal($("stat-in-progress").textContent, "2");

  clock.current = LATER;
  cardOf(doc, "tsk_test01").querySelector('button[data-action="complete"]').click();
  const done = storedTask(storage, "tsk_test01");
  assert.equal(done.status, "completada");
  assert.equal(done.completedAt, LATER.toISOString(), "completedAt usa el reloj inyectado");
  assert.equal(done.updatedAt, LATER.toISOString());
  assert.equal($("stat-completed").textContent, "2");
  assert.equal($("stat-progress").textContent, "33 %");
  assert.equal($("progress-bar").value, 33);
  assert.ok(toastTexts(doc).some((text) => text.includes("Tarea completada")));

  cardOf(doc, "tsk_test01").querySelector('button[data-action="reopen"]').click();
  const reopened = storedTask(storage, "tsk_test01");
  assert.equal(reopened.status, "pendiente");
  assert.equal(reopened.completedAt, null, "al reabrir se limpia completedAt");
  assert.equal($("stat-completed").textContent, "1");
  assert.equal($("stat-progress").textContent, "17 %");
});

/* ================================================================== */
/* 6. Eliminar                                                         */
/* ================================================================== */

test("UI-06 · eliminar pide confirmación: cancelar no borra y confirmar borra y anuncia", async () => {
  const { doc, storage, $ } = boot();

  cardOf(doc, "tsk_test01").querySelector('button[data-action="delete"]').click();
  assert.equal($("confirm-dialog").open, true);
  assert.equal($("confirm-title").textContent, "Eliminar tarea");
  assert.ok($("confirm-message").textContent.includes("Ensayo de historia"));

  $("btn-cancel-confirm").click();
  await settleAsync();
  assert.equal($("confirm-dialog").open, false);
  assert.ok(cardIds(doc).includes("tsk_test01"), "cancelar no borra la tarea");
  assert.equal($("stat-total").textContent, "6");
  assert.equal(storedTasks(storage).length, 6);

  cardOf(doc, "tsk_test01").querySelector('button[data-action="delete"]').click();
  $("btn-confirm").click();
  await settleAsync();

  assert.equal($("confirm-dialog").open, false);
  assert.equal(cardIds(doc).includes("tsk_test01"), false, "confirmar borra la tarea");
  assert.equal($("stat-total").textContent, "5");
  assert.equal(storedTasks(storage).length, 5);
  assert.ok(toastTexts(doc).some((text) => text.includes("Tarea eliminada")));
});

/* ================================================================== */
/* 7. Filtros                                                          */
/* ================================================================== */

test("UI-07 · los filtros por texto y por curso reducen la lista y actualizan el contador", async () => {
  const { doc, $ } = boot();

  // El texto pasa por el debounce: la lista no cambia de inmediato.
  $("search-input").value = "química";
  fireEvent($("search-input"), "input");
  assert.equal($("task-count").textContent, "6 tareas", "todavía no se ha filtrado");
  assert.equal($("btn-clear-filters").disabled, false, "hay filtros activos");

  await settleDebounce();
  assert.deepEqual(cardIds(doc), ["tsk_test05"], "solo queda «Laboratorio de química»");
  assert.equal($("task-count").textContent, "1 tarea");

  $("search-input").value = "";
  fireEvent($("search-input"), "input");
  await settleDebounce();

  // El curso se aplica al instante (evento `change`).
  $("filter-course").value = "Historia";
  fireEvent($("filter-course"), "change");
  await tick(5);
  assert.deepEqual(cardIds(doc), ["tsk_test01"]);
  assert.equal($("task-count").textContent, "1 tarea");

  // Sin coincidencias se muestra el estado vacío de búsqueda.
  $("filter-course").value = "";
  $("search-input").value = "zzz";
  fireEvent($("search-input"), "input");
  await settleDebounce();
  assert.deepEqual(cardIds(doc), []);
  assert.equal($("task-count").textContent, "0 tareas");
  assert.equal($("empty-state").hidden, false);
  assert.equal($("empty-title").textContent, "No hay tareas que coincidan");
  assert.equal($("btn-empty-action").dataset.emptyAction, "clear");

  // «Limpiar filtros» devuelve las 6 tareas y deshabilita el botón.
  $("btn-clear-filters").click();
  assert.equal(cardsOf(doc).length, 6);
  assert.equal($("search-input").value, "");
  assert.equal($("btn-clear-filters").disabled, true);
});

/* ================================================================== */
/* 8. Orden                                                            */
/* ================================================================== */

test("UI-08 · el orden por prioridad y por fecha reordena las tarjetas", () => {
  const { doc, $ } = boot();

  const byDate = [
    "Laboratorio de química",
    "Resumen de sociología",
    "Ensayo de historia",
    "Lectura: El túnel",
    "Examen de cálculo",
    "Proyecto de biología",
  ];
  assert.deepEqual(cardTitles(doc), byDate, "por defecto ordena por fecha");

  $("sort-by").value = "priority";
  fireEvent($("sort-by"), "change");
  assert.deepEqual(
    cardTitles(doc),
    [
      "Ensayo de historia",
      "Examen de cálculo",
      "Laboratorio de química",
      "Resumen de sociología",
      "Proyecto de biología",
      "Lectura: El túnel",
    ],
    "alta antes que media y media antes que baja, con desempate por fecha",
  );

  $("sort-by").value = "dueDate";
  fireEvent($("sort-by"), "change");
  assert.deepEqual(cardTitles(doc), byDate, "vuelve al orden por fecha");
});

/* ================================================================== */
/* 9. Tema                                                             */
/* ================================================================== */

test("UI-09 · alternar el tema cambia documentElement, aria-pressed, persiste y sobrevive al reinicio", () => {
  const { doc, storage, $ } = boot();

  assert.equal(doc.documentElement.dataset.theme, "light");
  assert.equal($("theme-toggle").getAttribute("aria-pressed"), "false");
  assert.equal($("theme-toggle").getAttribute("aria-label"), "Cambiar a tema oscuro");
  assert.equal($("theme-icon").textContent, "🌙");

  $("theme-toggle").click();
  assert.equal(doc.documentElement.dataset.theme, "dark");
  assert.equal($("theme-toggle").getAttribute("aria-pressed"), "true");
  assert.equal($("theme-toggle").getAttribute("aria-label"), "Cambiar a tema claro");
  assert.equal($("theme-icon").textContent, "☀️");
  assert.equal(storage.getItem("studyflow.theme"), "dark", "la preferencia se persiste");

  // Un segundo arranque sobre el mismo almacenamiento conserva el tema.
  const second = createDocument(HTML);
  started.push(initApp({ doc: second, storage, now: () => NOW, idFactory: seqIdFactory() }));
  assert.equal(second.documentElement.dataset.theme, "dark");
  assert.equal(second.getElementById("theme-toggle").getAttribute("aria-pressed"), "true");

  $("theme-toggle").click();
  assert.equal(doc.documentElement.dataset.theme, "light");
  assert.equal(storage.getItem("studyflow.theme"), "light");
});

test("UI-10 · sin tema guardado se respeta prefers-color-scheme", () => {
  const media = installMatchMedia(true);
  try {
    const { doc, $ } = boot();
    assert.equal(doc.documentElement.dataset.theme, "dark");
    assert.equal($("theme-toggle").getAttribute("aria-pressed"), "true");
    assert.ok(media.calls.includes("(prefers-color-scheme: dark)"));
  } finally {
    media.restore();
  }
});

/* ================================================================== */
/* 11. Seguridad (XSS)                                                 */
/* ================================================================== */

test("UI-11 · un título con HTML se pinta como texto y no crea elementos", () => {
  const { doc, storage, $ } = boot();
  const evil = '<img src=x onerror="window.__xss=1">';

  $("btn-new-task").click();
  fillForm($, { title: evil, course: "Seguridad" });
  submitForm($);

  const title = cardOf(doc, "tsk_test07").querySelector(".task-card__title");
  assert.equal(title.textContent, evil, "el texto se conserva literal");
  assert.match(title.innerHTML, /^&lt;img src=x/, "el HTML se escapa al serializar");
  assert.equal(doc.querySelectorAll("img").length, 0, "no se creó ningún <img>");
  assert.equal(doc.querySelectorAll("#task-list img").length, 0);
  assert.equal(
    doc.querySelectorAll("script").length,
    2,
    "solo los dos scripts de index.html (tema y módulo); el render no añade ninguno",
  );

  // El dato también se guarda literal, sin interpretarse.
  assert.equal(storedTask(storage, "tsk_test07").title, evil);
});

/* ================================================================== */
/* 12. Fallo de guardado                                               */
/* ================================================================== */

test("UI-12 · si el almacenamiento falla la tarea queda en memoria, se avisa y no se revierte", () => {
  const storage = createFailingStorage();
  const { doc, $ } = boot({ storage });

  assert.equal($("storage-warning").hidden, false, "el aviso de almacenamiento es visible");
  assert.ok($("storage-note").textContent.includes("sin guardar"));

  $("btn-new-task").click();
  fillForm($, { title: "Tarea sin guardar", course: "Sistemas" });
  submitForm($);

  assert.equal($("stat-total").textContent, "7", "la tarea sigue en memoria");
  assert.ok(cardIds(doc).includes("tsk_test07"), "y se pinta en la lista");
  assert.equal(cardOf(doc, "tsk_test07").querySelector(".task-card__title").textContent, "Tarea sin guardar");
  assert.equal($("storage-warning").hidden, false);
  assert.ok(
    toastTexts(doc).some((text) => text.includes("No se pudieron guardar")),
    "se avisa del fallo de guardado",
  );

  // El aviso persistente sigue visible y la nota refleja el estado en memoria.
  assert.equal($("storage-warning").hidden, false, "el aviso no desaparece");
  assert.equal($("storage-note").textContent, "7 tareas · sin guardar");
});

/* ================================================================== */
/* 13. Exportar e importar                                             */
/* ================================================================== */

test("UI-13 · exportar produce JSON parseable e importar un archivo inválido no cambia el estado", async () => {
  const { doc, storage, $ } = boot();
  const stubs = installDownloadStubs();
  const downloads = [];
  doc.body.addEventListener("click", (event) => {
    if (event.target.download) downloads.push(event.target);
  });

  try {
    $("btn-export").click();
  } finally {
    stubs.restore();
  }

  assert.equal(downloads.length, 1, "se dispara una descarga");
  assert.equal(downloads[0].download, "studyflow-2026-11-12.json");
  assert.match(downloads[0].href, /^blob:/);

  const exported = JSON.parse(stubs.contents()[0]);
  assert.equal(exported.app, "studyflow");
  assert.equal(exported.version, 1);
  assert.equal(exported.tasks.length, 6);
  assert.equal(
    exported.tasks[0].title,
    "Ensayo de historia",
    "la exportación respeta el orden del estado, no el de la vista",
  );
  assert.ok(toastTexts(doc).some((text) => text.includes("6 tareas exportadas")));

  // Importación inválida: avisa y no toca el estado ni abre la confirmación.
  $("import-file").files = [fakeFile('{"no es una lista de tareas')];
  fireEvent($("import-file"), "change");
  await settleAsync();

  assert.equal($("confirm-dialog").open, false, "no se pide confirmación");
  assert.equal(cardsOf(doc).length, 6, "el estado no cambia");
  assert.equal($("stat-total").textContent, "6");
  assert.equal(storedTasks(storage).length, 6);
  assert.ok(toastTexts(doc).some((text) => text.includes("no es un JSON válido")));

  // Importación válida: pide confirmación y reemplaza el estado.
  const incoming = [
    {
      id: "tsk_import01",
      title: "Informe importado",
      course: "Historia",
      type: "tarea",
      dueDate: "",
      priority: "baja",
      status: "pendiente",
      estimatedHours: 0,
      notes: "",
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      completedAt: null,
    },
  ];
  $("import-file").files = [fakeFile(JSON.stringify(incoming))];
  fireEvent($("import-file"), "change");
  await settleAsync();

  assert.equal($("confirm-dialog").open, true);
  assert.equal($("confirm-message").textContent, "Se reemplazarán 6 tareas por 1 tarea del archivo.");

  $("btn-confirm").click();
  await settleAsync();

  assert.deepEqual(cardIds(doc), ["tsk_import01"]);
  assert.equal($("stat-total").textContent, "1");
  assert.equal(storedTasks(storage).length, 1);
  assert.equal(storedTasks(storage)[0].title, "Informe importado");
  assert.equal($("import-file").value, "", "el input de archivo se limpia");
});

/* ================================================================== */
/* 14. Datos corruptos y ciclo de vida                                 */
/* ================================================================== */

test("UI-14 · con datos corruptos se guarda copia, se siembran ejemplos y se avisa", () => {
  const storage = createMemoryStorage({ "studyflow.tasks": "{no es json" });
  const { doc, $ } = boot({ storage });

  assert.equal(cardsOf(doc).length, 6, "se cargan los ejemplos");
  assert.equal($("stat-total").textContent, "6");
  assert.equal(storage.getItem("studyflow.tasks.backup"), "{no es json", "se conserva la copia");
  assert.ok(
    toastTexts(doc).some((text) => text.includes("No se pudieron leer tus datos")),
    "se avisa de los datos ilegibles",
  );
  assert.equal($("storage-warning").hidden, true, "el guardado nuevo sí funciona");
});

test("UI-15 · destroy quita los listeners y refresh vuelve a pintar", () => {
  const { app, doc, $ } = boot();

  app.destroy();
  $("btn-new-task").click();
  assert.equal($("task-dialog").open, false, "tras destroy no se abren diálogos");

  app.refresh();
  assert.equal(cardsOf(doc).length, 6, "refresh repinta la lista");
});

/* ------------------------------------------------------------------ */
/* Lo que este archivo NO puede afirmar (declarado, no silenciado)     */
/* ------------------------------------------------------------------ */
/*
 * 1. El arranque automático de `src/app.js` (la rama que lee
 *    `globalThis.document` y espera `DOMContentLoaded`) no se ejecuta aquí:
 *    el módulo se importa una sola vez, en Node `globalThis.document` no
 *    existe y esa rama usaría el reloj y el generador de ids reales, lo que
 *    rompería el determinismo exigido. El arnés sí soporta `readyState` y
 *    `DOMContentLoaded` (`createDocument` + `dispatchEvent`) por si el Tester
 *    quiere cubrirlo; el camino probado es el inyectable
 *    `initApp({ doc, storage, now, idFactory })`.
 * 2. Nada de lo visual: sin CSS ni layout no se puede afirmar que el aviso de
 *    almacenamiento se vea, que el encabezado del diálogo quede fijo, el
 *    desplazamiento horizontal a 360 px, el contraste ni `prefers-reduced-motion`.
 * 3. La accesibilidad real (orden de tabulación, trampeo de foco, anuncios de
 *    `aria-live` con lector de pantalla) requiere un navegador: aquí solo se
 *    comprueban los atributos (`aria-invalid`, `aria-pressed`, `aria-valuetext`,
 *    `hidden`, `aria-label`) y que el foco pase al primer campo con error.
 * 4. `focus()` del arnés mueve `document.activeElement` sin comprobar si el
 *    elemento es enfocable de verdad.
 * 5. `File`/`FileList` no existen: las importaciones usan un doble con `name`,
 *    `size` y `text()`.
 */
