/**
 * StudyFlow — servidor estático mínimo (ARCHITECTURE.md §3.6).
 *
 * Sin dependencias: solo `node:http` y `node:fs`. Sirve la raíz del repositorio
 * en `PORT` (4173 por defecto) con métodos GET/HEAD, sin caché y rechazando
 * cualquier ruta que escape de la raíz.
 *
 * Uso: `npm start` o `node scripts/serve.mjs`.
 */

import { createReadStream, promises as fs } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** Raíz servida: la carpeta que contiene `index.html`. */
const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

const PORT = Number.parseInt(process.env.PORT ?? "", 10) || 4173;

const ALLOWED_METHODS = new Set(["GET", "HEAD"]);

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".ico", "image/x-icon"],
]);

const DEFAULT_MIME_TYPE = "application/octet-stream";
const NOT_FOUND_BODY = "404 · No encontrado\n";

/**
 * Registra método, ruta y estado (ARCHITECTURE.md §3.6).
 * Salida en ASCII para que ninguna consola la muestre mal.
 */
function logRequest(method, target, status) {
  console.log(`[studyflow] ${method} ${target} -> ${status}`);
}

/** Respuesta de texto con cabeceras coherentes para GET y HEAD. */
function sendText(response, status, text, { head = false, headers = {} } = {}) {
  response.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  response.end(head ? undefined : text);
}

/**
 * Traduce la URL a una ruta absoluta dentro de `ROOT`.
 * Devuelve `null` si la ruta es inválida o intenta salir de la raíz.
 */
function resolveRequestPath(requestUrl) {
  const raw = String(requestUrl ?? "/").split("?")[0].split("#")[0];

  let decoded;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null; // Secuencia de escape malformada.
  }

  if (decoded.includes("\0")) return null;

  const relative = decoded.replace(/^\/+/, "");
  const candidate = resolve(ROOT, relative === "" ? "index.html" : relative);

  if (candidate !== ROOT && !candidate.startsWith(ROOT + sep)) return null;

  return candidate;
}

/**
 * Envía el archivo pedido y devuelve el estado HTTP usado.
 * Los directorios resuelven a su `index.html`.
 */
async function sendFile(response, method, filePath) {
  let info;
  try {
    info = await fs.stat(filePath);
  } catch {
    sendText(response, 404, NOT_FOUND_BODY, { head: method === "HEAD" });
    return 404;
  }

  if (info.isDirectory()) {
    return sendFile(response, method, join(filePath, "index.html"));
  }

  if (!info.isFile()) {
    sendText(response, 404, NOT_FOUND_BODY, { head: method === "HEAD" });
    return 404;
  }

  const contentType = MIME_TYPES.get(extname(filePath).toLowerCase()) ?? DEFAULT_MIME_TYPE;

  response.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": info.size,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });

  if (method === "HEAD") {
    response.end();
    return 200;
  }

  const stream = createReadStream(filePath);
  stream.on("error", () => response.destroy());
  stream.pipe(response);
  return 200;
}

const server = createServer(async (request, response) => {
  const method = String(request.method ?? "GET").toUpperCase();
  const target = String(request.url ?? "/");

  let status = 404;
  try {
    if (ALLOWED_METHODS.has(method)) {
      const filePath = resolveRequestPath(target);
      if (filePath !== null) {
        status = await sendFile(response, method, filePath);
      } else {
        sendText(response, 404, NOT_FOUND_BODY, { head: method === "HEAD" });
      }
    } else {
      sendText(response, 404, NOT_FOUND_BODY);
    }
  } catch {
    if (!response.headersSent) {
      sendText(response, 500, "500 · Error interno\n", { head: method === "HEAD" });
    } else {
      response.destroy();
    }
    status = 500;
  }

  logRequest(method, target, status);
});

server.on("clientError", (error, socket) => {
  if (socket && !socket.destroyed) socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

server.on("error", (error) => {
  const code = error && error.code ? error.code : "desconocido";
  if (code === "EADDRINUSE") {
    console.error(`[studyflow] El puerto ${PORT} ya está en uso.`);
  } else {
    console.error(`[studyflow] Error del servidor (${code}):`, error);
  }
  process.exitCode = 1;
});

server.listen(PORT, () => {
  console.log(`[studyflow] Sirviendo: ${ROOT}`);
  console.log(`[studyflow] Escuchando en http://localhost:${PORT}`);
});
