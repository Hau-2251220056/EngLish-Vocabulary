import assert from "node:assert/strict";
import test from "node:test";
import {
  createPrivateVocabularyAction,
  createPrivateVocabularySubmitter,
} from "../src/vocabulary-sets/private-vocabulary-action.js";

test("one intentional action keeps one generated operation ID across retry", async () => {
  const generated = [];
  const createId = () => { const id = `operation-${generated.length + 1}`; generated.push(id); return id; };
  const action = createPrivateVocabularyAction({ word: "book", meanings: [] }, createId);
  const calls = [];
  let fail = true;
  const submit = createPrivateVocabularySubmitter({
    async createPrivateVocabularyAndAdd(setId, operationId, vocabulary) {
      calls.push({ setId, operationId, vocabulary });
      if (fail) { fail = false; throw new Error("network"); }
      return { vocabulary: { id: "private-id" }, membership: { vocabulary_id: "private-id" } };
    },
  });
  await assert.rejects(submit("set-1", action), /network/);
  assert.equal(action.state, "error");
  const result = await submit("set-1", action);
  assert.equal(result.vocabulary.id, "private-id");
  assert.deepEqual(calls.map(({ operationId }) => operationId), ["operation-1", "operation-1"]);
  assert.deepEqual(generated, ["operation-1"]);
});

test("rapid duplicate submit shares one request and one operation ID", async () => {
  let resolveRequest;
  let calls = 0;
  const service = {
    createPrivateVocabularyAndAdd() {
      calls += 1;
      return new Promise((resolve) => { resolveRequest = resolve; });
    },
  };
  const action = createPrivateVocabularyAction({ word: "book" }, () => "stable-operation");
  const submit = createPrivateVocabularySubmitter(service);
  const first = submit("set-1", action);
  const second = submit("set-1", action);
  assert.equal(first, second);
  assert.equal(action.state, "pending");
  assert.equal(calls, 1);
  resolveRequest({ vocabulary: { id: "private-id" } });
  await first;
  assert.equal(action.state, "success");
});

test("independent intentional actions receive independent operation IDs", () => {
  let next = 0;
  const createId = () => `uuid-${++next}`;
  const first = createPrivateVocabularyAction({ word: "same" }, createId);
  const second = createPrivateVocabularyAction({ word: "same" }, createId);
  assert.notEqual(first.operation_id, second.operation_id);
  assert.equal(first.operation_id, "uuid-1");
  assert.equal(second.operation_id, "uuid-2");
});
