import assert from "node:assert/strict";
import test from "node:test";
import app from "../../src/index.js";

test("Vercel entry default-exports the composed Express application", () => {
  assert.equal(typeof app, "function");
  assert.equal(typeof app.listen, "function");
});
