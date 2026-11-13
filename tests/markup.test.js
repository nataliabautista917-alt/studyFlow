/**
 * Pruebas estáticas de marcado y estilos (RF-10, RNF-1, RNF-2, RNF-5, RNF-6).
 *
 * Leen `index.html` y `styles.css` con `node:fs` y regex simples: no hay DOM,
 * ni navegador, ni red. Los nombres siguen la matriz de `docs/REQUIREMENTS.md` §9.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (...parts) => readFileSync(join(ROOT, ...parts), "utf8");

const html = read("index.html");
const css = read("styles.css");
const appJs = read("src", "app.js");
const domainJs = read("src", "domain.js");
const storageJs = read("src", "storage.js");

/** Todas las etiquetas de apertura `<name ...>`. */
const tagsOf = (source, name) =>
  [...source.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map((match) => match[0]);

/** Valor de un atributo de una etiqueta, o `null`. */
const attrOf = (tag, name) => {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`, "i"));
  return match ? match[1] : null;
};

/** Ids presentes en el documento. */
const docIds = () => [...html.matchAll(/\bid="([^"]+)"/gi)].map((match) => match[1]);

test("hay un solo h1 y landmarks", () => {
  const h1 = tagsOf(html, "h1");
  assert.equal(h1.length, 1, "debe haber un único h1");
  assert.equal(attrOf(h1[0], "id"), "app-title");
  assert.match(html, /<h1[^>]*>[\s\S]*?<\/h1>/, "el h1 tiene contenido");

  // Landmarks: un header, un main y un footer
  assert.equal(tagsOf(html, "main").length, 1);
  assert.equal(attrOf(tagsOf(html, "main")[0], "id"), "main");
  assert.equal(tagsOf(html, "header").length, 1);
  assert.equal(tagsOf(html, "footer").length, 1);
  assert.match(html, /<footer\b[^>]*class="app-footer"/);
  assert.match(html, /role="search"/, "los filtros son una región de búsqueda");
  assert.match(html, /<a\b[^>]*id="skip-link"[^>]*href="#main"/, "hay enlace para saltar al contenido");
});

test("los campos del formulario tienen label", () => {
  const controls = [...tagsOf(html, "input"), ...tagsOf(html, "select"), ...tagsOf(html, "textarea")]
    .filter((tag) => !/type="hidden"/i.test(tag));

  assert.ok(controls.length >= 15, `se esperaban al menos 15 controles, hay ${controls.length}`);

  const labelFor = new Map(
    [...html.matchAll(/<label\b[^>]*for="([^"]+)"[^>]*>([\s\S]*?)<\/label>/gi)].map((match) => [
      match[1],
      match[2].replace(/<[^>]*>/g, "").trim(),
    ]),
  );
  const ids = new Set(docIds());

  for (const tag of controls) {
    const id = attrOf(tag, "id");
    assert.ok(id, `control sin id: ${tag.slice(0, 60)}`);
    const labelled = labelFor.has(id) || /\baria-label="/i.test(tag);
    assert.ok(labelled, `el control #${id} no tiene label asociado`);
  }

  // Todo `for` apunta a un control existente y las etiquetas tienen texto
  for (const [target, text] of labelFor) {
    assert.ok(ids.has(target), `label for="${target}" no apunta a ningún control`);
    assert.notEqual(text, "", `la etiqueta de #${target} está vacía`);
  }

  // Los campos clave del formulario están etiquetados explícitamente
  for (const id of ["task-title", "task-course", "task-notes", "search-input", "filter-status"]) {
    assert.ok(labelFor.has(id), `falta la etiqueta de #${id}`);
  }
  // El campo oculto del formulario no requiere etiqueta visible
  assert.match(html, /<input\b[^>]*id="task-id"[^>]*type="hidden"/);
});

test("existe una región aria-live", () => {
  assert.match(html, /id="toast-region"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="task-count"[^>]*aria-live="polite"/);
  assert.match(html, /id="form-errors"[^>]*aria-live="polite"/);
  assert.match(html, /id="storage-warning"[^>]*role="status"/);

  // Las regiones dinámicas empiezan vacías para no anunciar ruido al arrancar
  assert.match(html, /<div id="toast-region"[^>]*><\/div>/);
});

test("el arranque aplica data-theme desde el script inline", () => {
  const inline = html.match(/<script>([\s\S]*?)<\/script>/i);
  assert.ok(inline, "debe existir un script inline en el head");
  const code = inline[1];

  assert.match(code, /studyflow\.theme/, "lee la preferencia de tema");
  assert.match(code, /localStorage/);
  assert.match(code, /prefers-color-scheme/, "respeta la preferencia del sistema");
  assert.match(code, /dataset\.theme\s*=/, "escribe data-theme en <html>");
  assert.match(code, /theme\s*=\s*"light"/, "el valor por defecto nunca queda vacío");
  assert.match(code, /try\s*\{[\s\S]*catch/, "un localStorage bloqueado no rompe el arranque");

  // Se ejecuta antes de la hoja de estilos para evitar el destello de tema
  const stylesLink = html.search(/<link[^>]*rel="stylesheet"/i);
  assert.ok(stylesLink > 0);
  assert.ok(html.indexOf(inline[0]) < stylesLink, "el script va antes del CSS");
  assert.match(html, /<meta\s+name="color-scheme"\s+content="light dark">/);
});

test("index.html carga módulos ES y no usa dependencias externas", () => {
  const scripts = tagsOf(html, "script");
  const modules = scripts.filter((tag) => /type="module"/i.test(tag));

  assert.equal(modules.length, 1, "un único módulo de arranque");
  assert.match(attrOf(modules[0], "src") ?? "", /^(?:\.\/)?src\/app\.js$/);
  assert.equal(modules.length + 1, scripts.length, "el otro script es el inline del tema");
  assert.equal(/\bdefer\b/i.test(modules[0]), false, "type=module ya difiere la ejecución");
  assert.ok(
    html.indexOf(modules[0]) > html.indexOf("</main>"),
    "el módulo se carga después del marcado",
  );

  const styles = tagsOf(html, "link").filter((tag) => /rel="stylesheet"/i.test(tag));
  assert.equal(styles.length, 1);
  assert.match(attrOf(styles[0], "href") ?? "", /^(?:\.\/)?styles\.css$/);

  // Sin CDN, sin dependencias y sin rutas absolutas
  assert.equal(/https?:\/\//i.test(html), false);
  assert.equal(/(?:src|href)="\/\//.test(html), false);
  assert.equal(/\b(unpkg|cdnjs|jsdelivr|esm\.sh|skypack)\b/i.test(html), false);
  assert.equal(/\bnode_modules\b/.test(html), false);
});

test("no hay fetch ni recursos externos", () => {
  const sources = [
    ["index.html", html],
    ["styles.css", css],
    ["src/app.js", appJs],
    ["src/domain.js", domainJs],
    ["src/storage.js", storageJs],
  ];

  for (const [name, source] of sources) {
    assert.equal(/\bfetch\s*\(/.test(source), false, `${name} no debe llamar a fetch()`);
    assert.equal(/\bXMLHttpRequest\b/.test(source), false, `${name} no debe usar XHR`);
    assert.equal(/\bsendBeacon\b/.test(source), false, `${name} no debe usar sendBeacon`);
    assert.equal(/\bWebSocket\b/.test(source), false, `${name} no debe abrir sockets`);
    assert.equal(/\bEventSource\b/.test(source), false, `${name} no debe usar SSE`);
    assert.equal(/https?:\/\//i.test(source), false, `${name} no debe referenciar URLs externas`);
    assert.equal(/@import\b/.test(source), false, `${name} no debe importar recursos`);
    assert.equal(/url\(\s*['"]?(?:https?:)?\/\//i.test(source), false, `${name} sin url() remoto`);
  }

  // El único recurso propio permitido fuera del documento es el favicon vacío
  assert.match(html, /<link\b[^>]*rel="icon"[^>]*href="data:,"/);
});

test("declara viewport y media queries base", () => {
  assert.match(
    html,
    /<meta\s+name="viewport"\s+content="width=device-width, initial-scale=1">/,
  );
  assert.match(html, /<html lang="es">/);
  assert.match(html, /<meta\s+charset="utf-8">/);

  // Los tres puntos de ruptura del UI_SPEC §3.1
  assert.match(css, /@media\s*\(min-width:\s*768px\)/);
  assert.match(css, /@media\s*\(min-width:\s*1280px\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);

  // El tema oscuro se activa por atributo, no solo por preferencia del sistema
  assert.match(css, /\[data-theme="dark"\]/);
  assert.equal(/@media\s*\(prefers-color-scheme/.test(css), false, "el tema lo decide el arranque");
});

test("la barra de progreso usa max 100", () => {
  const progress = tagsOf(html, "progress");
  assert.equal(progress.length, 1);

  assert.equal(attrOf(progress[0], "id"), "progress-bar");
  assert.equal(attrOf(progress[0], "max"), "100");
  assert.equal(attrOf(progress[0], "value"), "0");
  assert.equal(attrOf(progress[0], "aria-labelledby"), "stat-progress-label");
  assert.ok(docIds().includes("stat-progress-label"), "la etiqueta del progreso existe");

  // Las siete métricas del panel están en el marcado (RF-5)
  for (const id of [
    "stat-total",
    "stat-pending",
    "stat-in-progress",
    "stat-completed",
    "stat-overdue",
    "stat-upcoming",
    "stat-progress",
  ]) {
    assert.ok(docIds().includes(id), `falta la métrica #${id}`);
  }
});

test("aria-describedby y aria-labelledby sin referencias colgantes", () => {
  const ids = docIds();
  const idSet = new Set(ids);
  assert.equal(idSet.size, ids.length, "no debe haber id repetidos");

  const refs = [];
  for (const attr of ["aria-describedby", "aria-labelledby"]) {
    for (const match of html.matchAll(new RegExp(`\\b${attr}="([^"]+)"`, "gi"))) {
      for (const ref of match[1].split(/\s+/).filter(Boolean)) refs.push([attr, ref]);
    }
  }

  assert.ok(refs.length >= 12, `solo se revisaron ${refs.length} referencias ARIA`);
  for (const [attr, ref] of refs) {
    assert.ok(idSet.has(ref), `${attr} apunta a #${ref}, que no existe`);
  }

  // Los `for` de las etiquetas también son referencias válidas
  const fors = [...html.matchAll(/<label\b[^>]*for="([^"]+)"/gi)].map((match) => match[1]);
  assert.ok(fors.length >= 14, `se esperaban etiquetas asociadas, hay ${fors.length}`);
  for (const target of fors) assert.ok(idSet.has(target), `label for="${target}" cuelga`);
});

test("el dominio es puro y storage solo depende de él", () => {
  assert.equal(/^\s*import\s/m.test(domainJs), false, "el dominio no importa nada");
  assert.equal(/\bimport\s*\(/.test(domainJs), false, "sin importaciones dinámicas");
  assert.equal(/\bdocument\s*\./.test(domainJs), false, "el dominio no toca el DOM");
  assert.equal(/\bwindow\s*\./.test(domainJs), false, "el dominio no toca window");
  assert.equal(/\blocalStorage\s*[.[]/.test(domainJs), false, "el dominio no toca localStorage");
  assert.equal(/\balert\s*\(/.test(domainJs), false);

  const imports = [...storageJs.matchAll(/^import\s+[\s\S]*?from\s+"([^"]+)";/gm)].map(
    (match) => match[1],
  );
  assert.deepEqual(imports, ["./domain.js"], "storage solo depende del dominio");
});
