import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const DIST_DIR = path.resolve(process.cwd(), "dist");
const HOST = process.env.HOST ?? "127.0.0.1";
const PORT = Number(process.env.PORT ?? 4173);

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".wav", "audio/wav"],
  [".ico", "image/x-icon"]
]);

async function resolveRequestPath(urlPath) {
  const normalized = path.posix.normalize(decodeURIComponent(urlPath));
  const relativePath = normalized.replace(/^\/+/, "");
  const requestedPath = relativePath.length > 0 ? relativePath : "index.html";
  const filePath = path.resolve(DIST_DIR, requestedPath);

  if (!filePath.startsWith(DIST_DIR)) {
    return null;
  }

  const stats = await fs.stat(filePath).catch(() => null);
  if (!stats) {
    return null;
  }

  if (stats.isDirectory()) {
    const indexPath = path.join(filePath, "index.html");
    const indexStats = await fs.stat(indexPath).catch(() => null);
    if (!indexStats || !indexStats.isFile()) {
      return null;
    }
    return indexPath;
  }

  return stats.isFile() ? filePath : null;
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? HOST}`);
  const filePath = await resolveRequestPath(requestUrl.pathname);

  if (!filePath) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES.get(extension) ?? "application/octet-stream";
  res.writeHead(200, { "Content-Type": contentType });
  createReadStream(filePath).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`[preview] Serving dist at http://${HOST}:${PORT}`);
});
