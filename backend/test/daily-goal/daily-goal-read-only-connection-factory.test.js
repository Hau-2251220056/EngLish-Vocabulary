import assert from "node:assert/strict";
import test from "node:test";
import { createDailyGoalReadOnlyConnectionFactory } from "./daily-goal-read-only-connection-factory.js";
import { DAILY_GOAL_READ_ONLY_QUERIES } from "./daily-goal-read-only-observer.js";

const URL = "postgresql://observer:secret@ci.invalid:5432/postgres";

test("dedicated factory verifies one read-only transaction before ordered observations", async () => {
  const calls = [];
  const open = createDailyGoalReadOnlyConnectionFactory({
    connectDedicatedObserver: async ({ databaseUrl }) => {
      assert.equal(databaseUrl, URL);
      return session(calls);
    },
  });
  const connection = await open({ databaseUrl: URL, requiredMode: "READ_ONLY" });
  assert.equal((await connection.establishAndVerifyReadOnly()).transactionReadOnly, true);
  await connection.query(DAILY_GOAL_READ_ONLY_QUERIES.TARGET_OBSERVATION);
  await connection.query(DAILY_GOAL_READ_ONLY_QUERIES.MIGRATION_HISTORY);
  await connection.close();
  await connection.close();
  assert.deepEqual(calls, ["begin-read-only", "show-read-only", "target", "history", "rollback", "close"]);
});

test("factory fails closed for malformed mode, unsafe state, arbitrary SQL and stale reuse", async () => {
  const open = createDailyGoalReadOnlyConnectionFactory({ connectDedicatedObserver: async () => session([]) });
  await assert.rejects(() => open({ databaseUrl: URL, requiredMode: "READ_WRITE" }));
  await assert.rejects(() => open({ databaseUrl: "", requiredMode: "READ_ONLY" }));
  const connection = await open({ databaseUrl: URL, requiredMode: "READ_ONLY" });
  await assert.rejects(() => connection.query(DAILY_GOAL_READ_ONLY_QUERIES.TARGET_OBSERVATION));
  await connection.establishAndVerifyReadOnly();
  await assert.rejects(() => connection.query("SELECT 1"));
  await assert.rejects(() => connection.query(DAILY_GOAL_READ_ONLY_QUERIES.MIGRATION_HISTORY));
  await connection.query(DAILY_GOAL_READ_ONLY_QUERIES.TARGET_OBSERVATION);
  await connection.query(DAILY_GOAL_READ_ONLY_QUERIES.MIGRATION_HISTORY);
  await assert.rejects(() => connection.query(DAILY_GOAL_READ_ONLY_QUERIES.MIGRATION_HISTORY));
  await connection.close();
  await assert.rejects(() => connection.establishAndVerifyReadOnly());
});

test("read-write verification and driver errors are redacted and cleaned up", async () => {
  for (const mode of ["off", "on"]) {
    const calls = [];
    const open = createDailyGoalReadOnlyConnectionFactory({
      connectDedicatedObserver: async () => session(calls, { mode, failTarget: mode === "on" }),
    });
    const connection = await open({ databaseUrl: URL, requiredMode: "READ_ONLY" });
    if (mode === "off") {
      await assert.rejects(() => connection.establishAndVerifyReadOnly(), safeError);
    } else {
      await connection.establishAndVerifyReadOnly();
      await assert.rejects(() => connection.query(DAILY_GOAL_READ_ONLY_QUERIES.TARGET_OBSERVATION), safeError);
    }
    await connection.close();
    assert.equal(calls.at(-1), "close");
  }
});

test("invalid sessions and partial begin failures still close without leaking details", async () => {
  let invalidClosed = false;
  const invalidFactory = createDailyGoalReadOnlyConnectionFactory({
    connectDedicatedObserver: async () => ({ close: async () => { invalidClosed = true; } }),
  });
  await assert.rejects(() => invalidFactory({ databaseUrl: URL, requiredMode: "READ_ONLY" }), safeError);
  assert.equal(invalidClosed, true);

  const calls = [];
  const beginFailureFactory = createDailyGoalReadOnlyConnectionFactory({
    connectDedicatedObserver: async () => ({
      ...session(calls),
      async beginReadOnlyTransaction() {
        calls.push("begin-read-only");
        throw new Error(`begin leaked ${URL}`);
      },
    }),
  });
  const connection = await beginFailureFactory({ databaseUrl: URL, requiredMode: "READ_ONLY" });
  await assert.rejects(() => connection.establishAndVerifyReadOnly(), safeError);
  await connection.close();
  assert.deepEqual(calls, ["begin-read-only", "rollback", "close"]);
});

function session(calls, { mode = "on", failTarget = false } = {}) {
  return {
    async beginReadOnlyTransaction() { calls.push("begin-read-only"); },
    async query(sql) {
      if (sql === "SHOW transaction_read_only") {
        calls.push("show-read-only");
        return { rows: [{ transaction_read_only: mode }] };
      }
      if (sql === DAILY_GOAL_READ_ONLY_QUERIES.TARGET_OBSERVATION) {
        calls.push("target");
        if (failTarget) throw new Error(`driver leaked ${URL}`);
        return { rows: [] };
      }
      calls.push("history");
      return { rows: [] };
    },
    async rollback() { calls.push("rollback"); },
    async close() { calls.push("close"); },
  };
}

function safeError(error) {
  assert.equal(error.code, "DAILY_GOAL_READ_ONLY_CONNECTION_FAILED");
  assert.doesNotMatch(error.message, /postgres(?:ql)?:\/\//i);
  assert.doesNotMatch(error.message, /secret/);
  return true;
}
