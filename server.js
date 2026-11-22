const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");

const root = __dirname;
const port = Number(process.env.PORT) || 3000;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

const fileCache = new Map();

function readCachedFile(filePath) {
  const cached = fileCache.get(filePath);
  if (cached) return cached;
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
  const content = fs.readFileSync(filePath);
  const entry = {
    content,
    etag: `"${crypto.createHash("sha1").update(content).digest("base64url")}"`
  };
  fileCache.set(filePath, entry);
  return entry;
}

const server = http.createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405);
    response.end("Method Not Allowed");
    return;
  }

  const pathname = new URL(request.url, "http://localhost").pathname;
  const relativePath = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
  const filePath = path.resolve(root, relativePath);

  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  const entry = readCachedFile(filePath);
  if (!entry) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  const isHtml = extension === ".html";
  const headers = {
    "Content-Type": mimeTypes[extension] || "application/octet-stream",
    "Cache-Control": isHtml ? "no-cache" : "public, max-age=86400, immutable",
    "ETag": entry.etag,
    "X-Content-Type-Options": "nosniff"
  };

  if (request.headers["if-none-match"] === entry.etag) {
    response.writeHead(304, headers);
    response.end();
    return;
  }

  const acceptsGzip = (request.headers["accept-encoding"] || "").includes("gzip");
  if (acceptsGzip) {
    headers["Content-Encoding"] = "gzip";
    headers["Vary"] = "Accept-Encoding";
  }

  response.writeHead(200, headers);
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  response.end(acceptsGzip ? zlib.gzipSync(entry.content) : entry.content);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Tap Link is running at http://localhost:${port}`);
});
