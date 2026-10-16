import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceOrderedSessionBatch,
  completeOrderedSessionBatch,
  createOrderedSessionRun,
  currentOrderedSessionBatch,
  isOrderedSessionRun,
  reconcileOrderedSessionRun,
  restartOrderedSessionRun,
  selectOrderedSessionItem,
} from "../src/session-storage/ordered-session-run.js";

test("empty, short and long snapshots create stable batches of at most ten", () => {
  for (const size of [0, 1, 9, 10, 11, 20, 21]) {
    const ids = makeIds(size);
    const run = createOrderedSessionRun(ids);
    assert.deepEqual(run.snapshot_ids, ids);
    assert.equal(run.batches.every((batch) => batch.length <= 10), true);
    assert.deepEqual(run.batches.flat(), ids);
    assert.equal(isOrderedSessionRun(run), true);
  }
  assert.deepEqual(createOrderedSessionRun([]), {
    snapshot_ids: [], batches: [], active_batch_index: null, current_vocabulary_id: null,
    batch_status: "COMPLETED", run_status: "COMPLETED",
  });
});

test("reconciliation excludes additions and removes missing IDs without refill or reorder", () => {
  const original = createOrderedSessionRun(makeIds(21));
  const authorized = ["new-item", ...makeIds(21).filter((id) => !["id-02", "id-10", "id-11"].includes(id)).reverse()];
  const reconciled = reconcileOrderedSessionRun(original, authorized);
  assert.deepEqual(reconciled.snapshot_ids, makeIds(21).filter((id) => !["id-02", "id-10", "id-11"].includes(id)));
  assert.deepEqual(reconciled.batches.map((batch) => batch.length), [8, 9, 1]);
  assert.deepEqual(reconciled.batches[0], ["id-01", "id-03", "id-04", "id-05", "id-06", "id-07", "id-08", "id-09"]);
  assert.equal(reconciled.snapshot_ids.includes("new-item"), false);
});

test("a removed cursor selects the next valid item without mutating the input", () => {
  const original = selectOrderedSessionItem(createOrderedSessionRun(["one", "two", "three"]), "two");
  const reconciled = reconcileOrderedSessionRun(original, ["three", "one"]);
  assert.equal(reconciled.current_vocabulary_id, "one");
  assert.equal(original.current_vocabulary_id, "two");
  assert.deepEqual(original.snapshot_ids, ["one", "two", "three"]);
});

test("completed batch screens survive reconciliation and advance only explicitly", () => {
  let run = createOrderedSessionRun(makeIds(11));
  run = completeOrderedSessionBatch(run);
  const reconciled = reconcileOrderedSessionRun(run, ["id-11"]);
  assert.equal(reconciled.active_batch_index, 0);
  assert.equal(reconciled.batch_status, "COMPLETED");
  assert.deepEqual(currentOrderedSessionBatch(reconciled), []);
  const advanced = advanceOrderedSessionBatch(reconciled);
  assert.equal(advanced.active_batch_index, 1);
  assert.equal(advanced.current_vocabulary_id, "id-11");
  assert.equal(advanced.batch_status, "ACTIVE");
});

test("batch completion and whole-run completion require explicit advancement", () => {
  let run = createOrderedSessionRun(["one", "two"]);
  assert.equal(advanceOrderedSessionBatch(run), run);
  run = completeOrderedSessionBatch(run);
  assert.equal(run.run_status, "COMPLETED");
  assert.equal(run.batch_status, "COMPLETED");
});

test("completed runs remain completed after membership changes", () => {
  let run = createOrderedSessionRun(["one", "two"]);
  run = completeOrderedSessionBatch(run);
  const reconciled = reconcileOrderedSessionRun(run, ["three", "two"]);
  assert.equal(reconciled.run_status, "COMPLETED");
  assert.deepEqual(reconciled.snapshot_ids, ["two"]);
  assert.deepEqual(reconciled.batches, [["two"]]);
});

test("restart captures latest authorized order as a new full run", () => {
  const restarted = restartOrderedSessionRun(["new", "old"]);
  assert.deepEqual(restarted.snapshot_ids, ["new", "old"]);
  assert.equal(restarted.current_vocabulary_id, "new");
  assert.equal(restarted.run_status, "ACTIVE");
});

test("malformed, duplicate and oversized batch inputs fail closed", () => {
  for (const value of [null, {}, [""], ["one", "one"], [1]]) {
    assert.throws(() => createOrderedSessionRun(value), TypeError);
  }
  assert.throws(() => createOrderedSessionRun(["one"], { batchSize: 11 }), TypeError);
  assert.equal(isOrderedSessionRun({ snapshot_ids: ["one"], batches: [["two"]] }), false);
});

function makeIds(count) {
  return Array.from({ length: count }, (_, index) => `id-${String(index + 1).padStart(2, "0")}`);
}
