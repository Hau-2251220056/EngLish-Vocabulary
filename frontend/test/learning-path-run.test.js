import assert from "node:assert/strict";
import test from "node:test";
import { runPathOperation } from "../src/learning/learning-path-run.js";

const identity = {
  userId: "user-1",
  setId: "10000000-0000-4000-8000-000000000001",
  passId: "20000000-0000-4000-8000-000000000002",
};
const firstId = "30000000-0000-4000-8000-000000000003";
const secondId = "30000000-0000-4000-8000-000000000004";

test("failed path mutation retains its operation identity for exact retry", async () => {
  const storage = memoryStorage();
  let attempt = 0;
  const execute = async (operationId) => {
    attempt += 1;
    assert.equal(operationId, firstId);
    if (attempt === 1) throw new Error("offline");
    return { accepted: true };
  };
  const input = { storage, ...identity, kind: "NEXT_SESSION", randomUuid: () => firstId, execute };
  await assert.rejects(runPathOperation(input), /offline/);
  assert.deepEqual(await runPathOperation({ ...input, randomUuid: () => secondId }), { accepted: true });
  assert.equal(storage.length, 0);
});

test("different pass operations use isolated retry identities", async () => {
  const storage = memoryStorage();
  const seen = [];
  await runPathOperation({ storage, ...identity, kind: "COMPLETE_PASS", randomUuid: () => firstId, execute: async (id) => { seen.push(id); return true; } });
  await runPathOperation({ storage, ...identity, kind: "NEXT_SESSION", randomUuid: () => secondId, execute: async (id) => { seen.push(id); return true; } });
  assert.deepEqual(seen, [firstId, secondId]);
});

function memoryStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    key: (index) => [...values.keys()][index] ?? null,
  };
}
