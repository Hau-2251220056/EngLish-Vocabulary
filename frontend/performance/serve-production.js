import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, request as proxyRequest } from "node:http";
import { extname, resolve } from "node:path";
import process from "node:process";

const host = "127.0.0.1";
const port = Number(process.env.PERFORMANCE_FRONTEND_PORT ?? 4186);
const backend = new URL(process.env.PERFORMANCE_API_TARGET ?? "http://127.0.0.1:5012");
const dist = resolve(import.meta.dirname, "../dist");
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"], [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"], [".json", "application/json"],
  [".png", "image/png"], [".svg", "image/svg+xml"], [".woff2", "font/woff2"],
]);

const server = createServer(async (incoming, outgoing) => {
  if (incoming.url.startsWith("/api/")) {
    proxy(incoming, outgoing);
    return;
  }
  const pathname = new URL(incoming.url, `http://${host}:${port}`).pathname;
  const requested = resolve(dist, `.${pathname}`);
  const file = requested.startsWith(dist) && await isFile(requested)
    ? requested
    : resolve(dist, "index.html");
  outgoing.writeHead(200, { "content-type": contentTypes.get(extname(file)) ?? "application/octet-stream" });
  createReadStream(file).pipe(outgoing);
});

server.listen(port, host, () => console.log(`Performance production frontend listening on ${host}:${port}`));

function proxy(incoming, outgoing) {
  const proxied = proxyRequest(new URL(incoming.url, backend), {
    method: incoming.method,
    headers: { ...incoming.headers, host: backend.host },
  }, (response) => {
    outgoing.writeHead(response.statusCode ?? 502, response.headers);
    response.pipe(outgoing);
  });
  proxied.on("error", () => {
    if (!outgoing.headersSent) outgoing.writeHead(502, { "content-type": "application/json" });
    outgoing.end(JSON.stringify({ success: false, error: { code: "PERFORMANCE_PROXY_ERROR" } }));
  });
  incoming.pipe(proxied);
}

async function isFile(path) {
  try { return (await stat(path)).isFile(); } catch { return false; }
}
