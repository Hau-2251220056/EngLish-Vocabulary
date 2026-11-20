import assert from "node:assert/strict";
import test from "node:test";
import viteConfig from "../vite.config.js";

test("Vite proxies relative API requests to the local Express backend", () => {
  assert.deepEqual(viteConfig.server?.proxy?.["/api"], {
    target: "http://localhost:5000",
    changeOrigin: true,
  });
});
