import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Vercel keeps API rewrites ahead of the frontend SPA fallback", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.equal(config.rewrites[0].source, "/api/:path*");
  assert.match(config.rewrites[0].destination, /\/api\/:path\*$/);
  assert.deepEqual(config.rewrites[1], { source: "/:path*", destination: "/index.html" });
});
