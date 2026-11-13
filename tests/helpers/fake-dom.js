/**
 * DOM falso para pruebas de interfaz (ARCHITECTURE.md §8).
 *
 * Reproduce, en el orden de magnitud que necesita `src/app.js`, un subconjunto
 * del DOM real: árbol de nodos, atributos, `classList`, `dataset`, eventos con
 * propagación, selectores CSS básicos y el ciclo de vida de `<dialog>`.
 *
 * No es un navegador: no hay CSS, ni layout, ni temporizadores virtuales, ni
 * gestión real de foco (ver las notas al final del archivo). Todo lo que el
 * arnés no simula está documentado y no se afirma en las pruebas.
 */

/* ================================================================== */
/* Motor de selectores (subconjunto de CSS)                            */
/* ================================================================== */

/**
 * Fuente del patrón de un compuesto. Se instancia un regex nuevo por llamada
 * porque `parseCompound` es recursivo (`:not(...)`) y un regex global
 * compartido se pisaría el `lastIndex` entre llamadas.
 */
const COMPOUND_SOURCE =
  /([a-zA-Z][\w-]*|\*)|#([\w-]+)|\.([\w-]+)|\[\s*([\w-]+)\s*(?:([~^$*|]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+)))?\s*\]|:not\(([^)]*)\)/.source;

const selectorCache = new Map();

/** Convierte `"article.task-card"` en una descripción comparable. */
function parseCompound(text) {
  const spec = { tag: null, id: null, classes: [], attrs: [], nots: [] };
  const source = text.trim();
  const pattern = new RegExp(COMPOUND_SOURCE, "g");
  let match;
  while ((match = pattern.exec(source)) !== null) {
    if (match[1]) spec.tag = match[1].toLowerCase();
    else if (match[2]) spec.id = match[2];
    else if (match[3]) spec.classes.push(match[3]);
    else if (match[4]) {
      spec.attrs.push({
        name: match[4].toLowerCase(),
        value: match[5] ? (match[6] ?? match[7] ?? match[8] ?? "") : null,
      });
    } else if (match[9]) spec.nots.push(parseCompound(match[9]));
  }

  const rest = source.replace(new RegExp(COMPOUND_SOURCE, "g"), "").replace(/\s+/g, "");
  if (rest !== "") throw new Error(`Selector no soportado por el arnés: "${text}"`);
  return spec;
}

/** Parte un grupo (`"a > b c"`) en compuestos con su combinador. */
function splitGroup(group) {
  const parts = [];
  let buffer = "";
  let pending = " ";
  let depth = 0;
  let quote = null;

  const flush = () => {
    if (buffer.trim() === "") {
      buffer = "";
      return;
    }
    parts.push({ combinator: pending, compound: parseCompound(buffer) });
    buffer = "";
    pending = " ";
  };

  for (const char of group) {
    if (quote) {
      buffer += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      buffer += char;
      continue;
    }
    if (char === "[" || char === "(") {
      depth += 1;
      buffer += char;
      continue;
    }
    if (char === "]" || char === ")") {
      depth = Math.max(0, depth - 1);
      buffer += char;
      continue;
    }
    if (depth === 0 && char === ">") {
      flush();
      pending = ">";
      continue;
    }
    if (depth === 0 && /\s/.test(char)) {
      flush();
      continue;
    }
    buffer += char;
  }
  flush();
  return parts;
}

function parseSelector(selector) {
  const key = String(selector);
  if (selectorCache.has(key)) return selectorCache.get(key);
  const groups = key
    .split(",")
    .map((group) => splitGroup(group))
    .filter((group) => group.length > 0);
  selectorCache.set(key, groups);
  return groups;
}

function matchCompound(element, spec) {
  if (!element || element.nodeType !== 1) return false;
  if (spec.tag && spec.tag !== "*" && element.tagName.toLowerCase() !== spec.tag) return false;
  if (spec.id && element.id !== spec.id) return false;
  for (const className of spec.classes) {
    if (!element.classList.contains(className)) return false;
  }
  for (const attr of spec.attrs) {
    if (!element.hasAttribute(attr.name)) return false;
    if (attr.value !== null && String(element.getAttribute(attr.name)) !== attr.value) return false;
  }
  for (const not of spec.nots) {
    if (matchCompound(element, not)) return false;
  }
  return true;
}

function matchGroup(element, parts) {
  if (!matchCompound(element, parts[parts.length - 1].compound)) return false;
  let current = element;

  for (let index = parts.length - 2; index >= 0; index -= 1) {
    const combinator = parts[index + 1].combinator;
    if (combinator === ">") {
      const parent = current.parentElement;
      if (!parent || !matchCompound(parent, parts[index].compound)) return false;
      current = parent;
      continue;
    }
    let ancestor = current.parentElement;
    let found = null;
    while (ancestor) {
      if (matchCompound(ancestor, parts[index].compound)) {
        found = ancestor;
        break;
      }
      ancestor = ancestor.parentElement;
    }
    if (!found) return false;
    current = found;
  }
  return true;
}

/** ¿El elemento coincide con el selector? */
export function matchesSelector(element, selector) {
  return parseSelector(selector).some((group) => matchGroup(element, group));
}

/* ================================================================== */
/* Árbol de nodos                                                      */
/* ================================================================== */

const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const RAW_TEXT_ELEMENTS = new Set(["script", "style"]);

const VALUE_ELEMENTS = new Set(["input", "option", "progress", "select", "textarea"]);

function escapeText(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(value) {
  return escapeText(value).replace(/"/g, "&quot;");
}

function decodeEntities(value) {
  return String(value)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** `emptyAction` → `empty-action` (convención de `dataset`). */
function toKebabCase(property) {
  return String(property).replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

/** `data-empty-action` → `emptyAction`. */
function toCamelCase(attribute) {
  return String(attribute).replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase());
}

class FakeClassList {
  constructor(element) {
    this._element = element;
  }

  _tokens() {
    return String(this._element.className ?? "")
      .split(/\s+/)
      .filter(Boolean);
  }

  _write(tokens) {
    this._element.className = tokens.join(" ");
  }

  add(...tokens) {
    const current = this._tokens();
    for (const token of tokens) {
      if (token && !current.includes(token)) current.push(token);
    }
    this._write(current);
  }

  remove(...tokens) {
    this._write(this._tokens().filter((token) => !tokens.includes(token)));
  }

  toggle(token, force) {
    const has = this.contains(token);
    const next = force === undefined ? !has : Boolean(force);
    if (next && !has) this.add(token);
    if (!next && has) this.remove(token);
    return next;
  }

  contains(token) {
    return this._tokens().includes(token);
  }

  get length() {
    return this._tokens().length;
  }

  item(index) {
    return this._tokens()[index] ?? null;
  }

  toString() {
    return this._tokens().join(" ");
  }
}

class FakeNode {
  constructor(doc) {
    this.ownerDocument = doc;
    this.parentNode = null;
    this.childNodes = [];
  }

  get parentElement() {
    return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null;
  }

  get children() {
    return this.childNodes.filter((node) => node.nodeType === 1);
  }

  get firstChild() {
    return this.childNodes[0] ?? null;
  }

  get lastChild() {
    return this.childNodes[this.childNodes.length - 1] ?? null;
  }

  get firstElementChild() {
    return this.children[0] ?? null;
  }

  get lastElementChild() {
    const children = this.children;
    return children[children.length - 1] ?? null;
  }

  get textContent() {
    return this.childNodes.map((node) => node.textContent).join("");
  }

  set textContent(value) {
    for (const node of this.childNodes) node.parentNode = null;
    this.childNodes = [];
    const text = String(value ?? "");
    if (text !== "") this.appendChild(this.ownerDocument.createTextNode(text));
  }

  get isConnected() {
    let node = this;
    while (node.parentNode) node = node.parentNode;
    return node === this.ownerDocument.documentElement && node.tagName === "HTML";
  }

  appendChild(node) {
    if (!node) return node;
    if (node.parentNode) node.parentNode._removeChild(node);
    node.parentNode = this;
    this.childNodes.push(node);
    return node;
  }

  append(...nodes) {
    for (const node of nodes) {
      this.appendChild(typeof node === "string" ? this.ownerDocument.createTextNode(node) : node);
    }
  }

  replaceChildren(...nodes) {
    for (const child of this.childNodes) child.parentNode = null;
    this.childNodes = [];
    this.append(...nodes);
  }

  removeChild(node) {
    this._removeChild(node);
    return node;
  }

  _removeChild(node) {
    const index = this.childNodes.indexOf(node);
    if (index !== -1) this.childNodes.splice(index, 1);
    node.parentNode = null;
  }

  remove() {
    if (this.parentNode) this.parentNode._removeChild(this);
  }

  contains(node) {
    let current = node;
    while (current) {
      if (current === this) return true;
      current = current.parentNode;
    }
    return false;
  }

  /** Recorre el subárbol (sin incluir `this`). */
  _descendants() {
    const result = [];
    const walk = (node) => {
      for (const child of node.childNodes) {
        result.push(child);
        if (child.nodeType === 1) walk(child);
      }
    };
    walk(this);
    return result;
  }

  querySelectorAll(selector) {
    return this._descendants().filter(
      (node) => node.nodeType === 1 && matchesSelector(node, selector),
    );
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

class FakeText extends FakeNode {
  constructor(doc, data) {
    super(doc);
    this.nodeType = 3;
    this.nodeName = "#text";
    this.data = String(data);
  }

  get textContent() {
    return this.data;
  }

  set textContent(value) {
    this.data = String(value ?? "");
  }
}

class FakeElement extends FakeNode {
  constructor(doc, tagName) {
    super(doc);
    this.nodeType = 1;
    this.tagName = String(tagName).toUpperCase();
    this.nodeName = this.tagName;
    this._attributes = new Map();
    this._className = "";
    this._classList = new FakeClassList(this);
    this._dataset = null;
    this.value = "";
    this.checked = false;
    this.files = null;
    this.open = false;
    this.href = "";
    this.download = "";
    this.rel = "";
    this.type = "";
    this.dateTime = "";
    this.title = "";
  }

  get id() {
    return this.getAttribute("id") ?? "";
  }

  set id(value) {
    this.setAttribute("id", value);
  }

  get className() {
    return this._className;
  }

  set className(value) {
    this._className = String(value ?? "");
  }

  get classList() {
    return this._classList;
  }

  get dataset() {
    if (!this._dataset) {
      const element = this;
      this._dataset = new Proxy(
        {},
        {
          get: (_target, property) => element.getAttribute(`data-${toKebabCase(property)}`) ?? undefined,
          set: (_target, property, value) => {
            element.setAttribute(`data-${toKebabCase(property)}`, value);
            return true;
          },
          has: (_target, property) =>
            element.hasAttribute(`data-${toKebabCase(property)}`),
          deleteProperty: (_target, property) => {
            element.removeAttribute(`data-${toKebabCase(property)}`);
            return true;
          },
          ownKeys: () =>
            [...element._attributes.keys()]
              .filter((name) => name.startsWith("data-"))
              .map((name) => toCamelCase(name.slice(5))),
          getOwnPropertyDescriptor: (_target, property) => ({
            enumerable: true,
            configurable: true,
            value: element.getAttribute(`data-${toKebabCase(property)}`) ?? undefined,
          }),
        },
      );
    }
    return this._dataset;
  }

  get hidden() {
    return this.hasAttribute("hidden");
  }

  set hidden(value) {
    if (value) this.setAttribute("hidden", "");
    else this.removeAttribute("hidden");
  }

  get disabled() {
    return this.hasAttribute("disabled");
  }

  set disabled(value) {
    if (value) this.setAttribute("disabled", "");
    else this.removeAttribute("disabled");
  }

  hasAttribute(name) {
    return this._attributes.has(String(name).toLowerCase());
  }

  getAttribute(name) {
    const key = String(name).toLowerCase();
    return this._attributes.has(key) ? this._attributes.get(key) : null;
  }

  setAttribute(name, value) {
    const key = String(name).toLowerCase();
    const text = value === null || value === undefined ? "" : String(value);
    this._attributes.set(key, text);
    if (key === "class") this._className = text;
    return text;
  }

  removeAttribute(name) {
    this._attributes.delete(String(name).toLowerCase());
  }

  /** Selector completo del elemento (útil al depurar pruebas). */
  matches(selector) {
    return matchesSelector(this, selector);
  }

  closest(selector) {
    let node = this;
    while (node && node.nodeType === 1) {
      if (matchesSelector(node, selector)) return node;
      node = node.parentNode;
    }
    return null;
  }

  get innerHTML() {
    return this.childNodes.map(serializeNode).join("");
  }

  set innerHTML(value) {
    for (const child of this.childNodes) child.parentNode = null;
    this.childNodes = [];
    parseHtmlInto(String(value ?? ""), this);
  }

  get outerHTML() {
    return serializeNode(this);
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  blur() {
    if (this.ownerDocument.activeElement === this) this.ownerDocument.activeElement = null;
  }

  /** No-op: `app.js` llama a `select()` para seleccionar el texto del título. */
  select() {}

  click() {
    fireEvent(this, "click");
  }

  /** Restaura los controles del formulario a sus valores iniciales. */
  reset() {
    for (const control of this.querySelectorAll("input, select, textarea")) {
      if (control.tagName === "SELECT") control.value = defaultSelectValue(control);
      else if (control.tagName === "TEXTAREA") control.value = control._defaultValue ?? "";
      else control.value = control._defaultValue ?? "";
      if (control.tagName === "INPUT" && control.type === "checkbox") {
        control.checked = control.hasAttribute("checked");
      }
    }
  }

  showModal() {
    this.open = true;
  }

  close() {
    this.open = false;
    fireEvent(this, "close");
  }

  addEventListener(type, handler, options) {
    if (typeof handler !== "function") return;
    const key = String(type);
    if (!this._listeners) this._listeners = new Map();
    if (!this._listeners.has(key)) this._listeners.set(key, []);
    this._listeners.get(key).push({ handler, options });
  }

  removeEventListener(type, handler) {
    if (!this._listeners) return;
    const list = this._listeners.get(String(type));
    if (!list) return;
    const index = list.findIndex((entry) => entry.handler === handler);
    if (index !== -1) list.splice(index, 1);
  }

  dispatchEvent(event) {
    if (!event || typeof event.type !== "string") {
      throw new Error("dispatchEvent necesita un evento con `type`.");
    }
    if (!event.target) event.target = this;
    let node = this;
    while (node) {
      const list = node._listeners ? node._listeners.get(event.type) : null;
      if (list) {
        event.currentTarget = node;
        for (const entry of [...list]) entry.handler.call(node, event);
      }
      if (event.cancelBubble) break;
      node = event.bubbles === false ? null : node.parentNode;
    }
    return !event.defaultPrevented;
  }
}

/** Valor por defecto de un `<select>`: la opción marcada o la primera. */
function defaultSelectValue(select) {
  const options = select.querySelectorAll("option");
  const selected = options.find((option) => option.hasAttribute("selected"));
  const option = selected ?? options[0];
  return option ? String(option.value ?? "") : "";
}

function serializeNode(node) {
  if (node.nodeType === 3) return escapeText(node.data);
  if (node.nodeType !== 1) return "";
  const tag = node.tagName.toLowerCase();
  const attributes = [...node._attributes.entries()]
    .map(([name, value]) => (value === "" ? ` ${name}` : ` ${name}="${escapeAttribute(value)}"`))
    .join("");
  if (VOID_ELEMENTS.has(tag)) return `<${tag}${attributes}>`;
  return `<${tag}${attributes}>${node.childNodes.map(serializeNode).join("")}</${tag}>`;
}

/* ================================================================== */
/* Eventos                                                             */
/* ================================================================== */

/**
 * Evento mínimo compatible con lo que usa `app.js`: `target`, propagación por
 * el árbol, `preventDefault` y `stopPropagation`.
 *
 * @param {string} type
 * @param {{ bubbles?: boolean, shiftKey?: boolean, key?: string }} [init]
 */
export function createEvent(type, init = {}) {
  return {
    type,
    target: null,
    currentTarget: null,
    bubbles: init.bubbles !== false,
    cancelBubble: false,
    defaultPrevented: false,
    shiftKey: init.shiftKey === true,
    key: init.key ?? "",
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {
      this.cancelBubble = true;
    },
  };
}

/** Crea y despacha un evento sobre `target`. */
export function fireEvent(target, type, init = {}) {
  const event = createEvent(type, init);
  target.dispatchEvent(event);
  return event;
}

/* ================================================================== */
/* Analizador de HTML                                                  */
/* ================================================================== */

const ATTRIBUTE_PATTERN = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

/** Índice del `>` que cierra la etiqueta, ignorando los que van entre comillas. */
function findTagEnd(html, start) {
  let quote = null;
  for (let index = start + 1; index < html.length; index += 1) {
    const char = html[index];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === ">") return index;
  }
  return html.length;
}

function parseTag(raw) {
  const name = raw.trim().split(/[\s/]/)[0].toLowerCase();
  const attributes = [];
  const rest = raw.trim().slice(name.length);
  let match;
  ATTRIBUTE_PATTERN.lastIndex = 0;
  while ((match = ATTRIBUTE_PATTERN.exec(rest)) !== null) {
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    attributes.push([match[1].toLowerCase(), decodeEntities(value)]);
  }
  return { name, attributes, selfClosing: /\/\s*$/.test(raw) };
}

/**
 * Construye el árbol dentro de `root` a partir de una cadena HTML.
 * Los `<script>`/`<style>` se guardan como texto y **nunca** se ejecutan.
 */
function parseHtmlInto(html, root) {
  const doc = root.ownerDocument;
  const stack = [root];
  let index = 0;

  const pushText = (text) => {
    if (text.trim() === "") return;
    stack[stack.length - 1].appendChild(doc.createTextNode(decodeEntities(text)));
  };

  while (index < html.length) {
    const start = html.indexOf("<", index);
    if (start === -1) {
      pushText(html.slice(index));
      break;
    }
    if (start > index) pushText(html.slice(index, start));

    if (html.startsWith("<!--", start)) {
      const end = html.indexOf("-->", start + 4);
      index = end === -1 ? html.length : end + 3;
      continue;
    }
    if (html.startsWith("<!", start)) {
      const end = html.indexOf(">", start);
      index = end === -1 ? html.length : end + 1;
      continue;
    }
    if (html.startsWith("</", start)) {
      const end = html.indexOf(">", start);
      const name = html.slice(start + 2, end).trim().toLowerCase();
      for (let level = stack.length - 1; level > 0; level -= 1) {
        if (stack[level].tagName.toLowerCase() === name) {
          stack.length = level;
          break;
        }
      }
      index = end + 1;
      continue;
    }

    const end = findTagEnd(html, start);
    const { name, attributes, selfClosing } = parseTag(html.slice(start + 1, end));
    if (name === "") {
      index = end + 1;
      continue;
    }

    const element = doc.createElement(name);
    for (const [attribute, value] of attributes) element.setAttribute(attribute, value);
    if (VALUE_ELEMENTS.has(name) && element.hasAttribute("value")) {
      element.value = element.getAttribute("value");
      element._defaultValue = element.getAttribute("value");
    } else if (VALUE_ELEMENTS.has(name)) {
      element._defaultValue = "";
    }
    stack[stack.length - 1].appendChild(element);

    if (RAW_TEXT_ELEMENTS.has(name)) {
      const closing = html.toLowerCase().indexOf(`</${name}`, end + 1);
      const content = html.slice(end + 1, closing === -1 ? html.length : closing);
      if (content !== "") element.appendChild(doc.createTextNode(content));
      const closingEnd = closing === -1 ? html.length : html.indexOf(">", closing);
      index = closingEnd === -1 ? html.length : closingEnd + 1;
      continue;
    }

    if (!selfClosing && !VOID_ELEMENTS.has(name)) stack.push(element);
    index = end + 1;
  }
}

/* ================================================================== */
/* Documento                                                           */
/* ================================================================== */

class FakeDocument {
  constructor() {
    this.nodeType = 9;
    this.nodeName = "#document";
    this.readyState = "complete";
    this.activeElement = null;
    this.documentElement = null;
    this.head = null;
    this.body = null;
    this._listeners = new Map();
    this.defaultView = {
      matchMedia: (query) => ({
        media: query,
        matches: false,
        addEventListener() {},
        removeEventListener() {},
      }),
    };
  }

  createElement(tagName) {
    return new FakeElement(this, tagName);
  }

  createTextNode(data) {
    return new FakeText(this, data);
  }

  getElementById(id) {
    if (!this.documentElement) return null;
    const wanted = String(id);
    if (this.documentElement.id === wanted) return this.documentElement;
    for (const node of this.documentElement._descendants()) {
      if (node.nodeType === 1 && node.id === wanted) return node;
    }
    return null;
  }

  querySelectorAll(selector) {
    if (!this.documentElement) return [];
    const result = matchesSelector(this.documentElement, selector)
      ? [this.documentElement]
      : [];
    return result.concat(this.documentElement.querySelectorAll(selector));
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  addEventListener(type, handler) {
    const key = String(type);
    if (!this._listeners.has(key)) this._listeners.set(key, []);
    this._listeners.get(key).push({ handler });
  }

  removeEventListener(type, handler) {
    const list = this._listeners.get(String(type));
    if (!list) return;
    const index = list.findIndex((entry) => entry.handler === handler);
    if (index !== -1) list.splice(index, 1);
  }

  dispatchEvent(event) {
    const list = this._listeners.get(event.type);
    if (!list) return true;
    event.target = this;
    event.currentTarget = this;
    for (const entry of [...list]) entry.handler.call(this, event);
    return !event.defaultPrevented;
  }
}

/**
 * Crea un documento con el HTML dado ya analizado.
 *
 * @param {string} [html]
 * @returns {FakeDocument}
 */
export function createDocument(html = "") {
  const doc = new FakeDocument();
  const root = doc.createElement("root");
  parseHtmlInto(html, root);

  const htmlElement =
    root.children.find((node) => node.tagName === "HTML") ?? null;

  if (htmlElement) {
    htmlElement.parentNode = null;
    doc.documentElement = htmlElement;
    doc.head = htmlElement.querySelector("head");
    doc.body = htmlElement.querySelector("body");
  } else {
    const fallback = doc.createElement("html");
    const body = doc.createElement("body");
    fallback.appendChild(body);
    doc.documentElement = fallback;
    doc.body = body;
  }

  if (!doc.body) {
    const body = doc.createElement("body");
    doc.documentElement.appendChild(body);
    doc.body = body;
  }

  // El valor inicial de un `<select>` es el de su opción marcada (o la primera).
  for (const select of doc.querySelectorAll("select")) {
    select.value = defaultSelectValue(select);
    select._defaultValue = select.value;
  }
  return doc;
}

/* ================================================================== */
/* Dobles de APIs del navegador                                        */
/* ================================================================== */

/**
 * Sustituye `globalThis.URL` y `globalThis.Blob` para capturar las descargas
 * que genera `handleExport` (`URL.createObjectURL`).
 *
 * @returns {{ urls: Map<string, object>, contents: () => string[], restore: () => void }}
 */
export function installDownloadStubs() {
  const originalUrl = globalThis.URL;
  const originalBlob = globalThis.Blob;
  const urls = new Map();
  let counter = 0;

  class FakeBlob {
    constructor(parts = [], options = {}) {
      this.parts = Array.from(parts, (part) => String(part));
      this.type = options.type ?? "";
      this.size = this.parts.join("").length;
    }

    text() {
      return Promise.resolve(this.parts.join(""));
    }
  }

  const fakeUrl = {
    createObjectURL(blob) {
      counter += 1;
      const url = `blob:studyflow/${counter}`;
      urls.set(url, blob);
      return url;
    },
    revokeObjectURL(url) {
      /* El contenido se conserva para poder afirmarlo en la prueba. */
      void url;
    },
  };

  globalThis.URL = fakeUrl;
  globalThis.Blob = FakeBlob;

  return {
    urls,
    contents: () =>
      [...urls.values()].map((blob) => (blob.parts ? blob.parts.join("") : String(blob))),
    restore() {
      globalThis.URL = originalUrl;
      globalThis.Blob = originalBlob;
    },
  };
}

/**
 * Instala `globalThis.matchMedia` (que `app.js` lee para resolver el tema).
 *
 * @param {boolean} matches
 * @returns {{ restore: () => void, calls: string[] }}
 */
export function installMatchMedia(matches) {
  const original = globalThis.matchMedia;
  const calls = [];
  globalThis.matchMedia = (query) => {
    calls.push(String(query));
    return {
      media: String(query),
      matches: Boolean(matches),
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    };
  };
  return {
    calls,
    restore() {
      if (original === undefined) delete globalThis.matchMedia;
      else globalThis.matchMedia = original;
    },
  };
}

/** Espera un turno del bucle de eventos (macrotarea). */
export function tick(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ------------------------------------------------------------------ */
/* Límites del arnés (no afirmar en las pruebas)                       */
/* ------------------------------------------------------------------ */
/* - No hay CSS ni layout: `hidden`, `disabled` y `open` se leen como   */
/*   atributos, pero nada se oculta visualmente.                        */
/* - `focus()` mueve `document.activeElement` sin comprobar si el       */
/*   elemento es enfocable; el trampeo de foco real es del navegador.   */
/* - No hay `File`/`FileList` reales: las pruebas inyectan un objeto    */
/*   con `name`, `size` y `text()`.                                     */
/* - No hay temporizadores virtuales: el debounce se espera con `tick`. */
/* - No se ejecuta ningún `<script>` del HTML analizado.                */
