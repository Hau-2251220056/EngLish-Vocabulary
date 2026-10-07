import assert from "node:assert/strict";
import test from "node:test";
import { filterDiscoveryCatalog, loadDiscoveryCatalog, paginateDiscoveryCatalog } from "../src/topics/discovery-catalog.js";

const TOPICS = Object.freeze([
  { id: "topic-1", name: "Travel", description: "Travel words" },
  { id: "topic-2", name: "Work", description: null },
  { id: "topic-3", name: "Daily life", description: "Daily words" },
]);

test("loads one Set list per Topic concurrently and preserves deterministic mapping", async () => {
  const gates = new Map(TOPICS.map((topic) => [topic.id, deferred()]));
  const starts = [];
  let topicCalls = 0;
  const loading = loadDiscoveryCatalog({
    async listTopics() {
      topicCalls += 1;
      return TOPICS;
    },
    async listPublicSystemSets(topicId) {
      starts.push(topicId);
      return gates.get(topicId).promise;
    },
  });

  await waitFor(() => starts.length === TOPICS.length);
  assert.deepEqual(starts, TOPICS.map(({ id }) => id));
  assert.equal(topicCalls + starts.length, 1 + TOPICS.length);

  gates.get("topic-2").resolve([{ id: "set-2", name: "Office", description: null, item_count: 2 }]);
  gates.get("topic-1").resolve([
    { id: "set-1", name: "Airport", description: "At the airport", item_count: 3 },
    { id: "set-3", name: "Hotel", description: null, item_count: 4 },
  ]);
  gates.get("topic-3").resolve([]);

  const catalog = await loading;
  assert.deepEqual(catalog.topics, TOPICS);
  assert.deepEqual(catalog.sets.map(({ id }) => id), ["set-1", "set-3", "set-2"]);
  assert.deepEqual(catalog.sets.map(({ topic }) => topic), [
    { id: "topic-1", name: "Travel" },
    { id: "topic-1", name: "Travel" },
    { id: "topic-2", name: "Work" },
  ]);
});

test("publishes only after every required Set response succeeds", async () => {
  const first = deferred();
  const second = deferred();
  let settled = false;
  const loading = loadDiscoveryCatalog({
    async listTopics() { return TOPICS.slice(0, 2); },
    async listPublicSystemSets(topicId) {
      return topicId === "topic-1" ? first.promise : second.promise;
    },
  }).finally(() => { settled = true; });

  first.resolve([{ id: "set-1", name: "Airport", item_count: 1 }]);
  await Promise.resolve();
  assert.equal(settled, false);
  second.resolve([]);
  assert.equal((await loading).sets.length, 1);
});

test("rejects the complete catalog on any required failure and a fresh retry can succeed", async () => {
  const failure = new Error("Topic Set request failed");
  let attempts = 0;
  const dependencies = {
    async listTopics() { return TOPICS.slice(0, 2); },
    async listPublicSystemSets(topicId) {
      if (attempts === 0 && topicId === "topic-2") throw failure;
      return [{ id: `${topicId}-set`, name: topicId, item_count: 1 }];
    },
  };

  await assert.rejects(loadDiscoveryCatalog(dependencies), (error) => error === failure);
  attempts += 1;
  const retry = await loadDiscoveryCatalog(dependencies);
  assert.deepEqual(retry.sets.map(({ id }) => id), ["topic-1-set", "topic-2-set"]);
});

test("an empty Topic list completes without Set requests", async () => {
  let setCalls = 0;
  const catalog = await loadDiscoveryCatalog({
    async listTopics() { return []; },
    async listPublicSystemSets() { setCalls += 1; return []; },
  });
  assert.deepEqual(catalog, { topics: [], sets: [] });
  assert.equal(setCalls, 0);
});

test("filters completed catalog by trimmed name or description and exact Topic identity", () => {
  const sets = [
    { id: "set-1", name: "Airport Basics", description: "Travel essentials", topic: { id: "topic-1" } },
    { id: "set-2", name: "Office", description: "Daily WORK", topic: { id: "topic-2" } },
    { id: "set-3", name: "Hotel", description: null, topic: { id: "topic-1" } },
  ];

  assert.deepEqual(filterDiscoveryCatalog(sets, { query: "  essentials ", topicId: "" }).map(({ id }) => id), ["set-1"]);
  assert.deepEqual(filterDiscoveryCatalog(sets, { query: "work", topicId: "topic-2" }).map(({ id }) => id), ["set-2"]);
  assert.deepEqual(filterDiscoveryCatalog(sets, { query: "office", topicId: "topic-1" }), []);
  assert.deepEqual(filterDiscoveryCatalog(sets, { query: "", topicId: "topic-1" }).map(({ id }) => id), ["set-1", "set-3"]);
});

test("paginates filtered catalog at nine items and clamps invalid pages", () => {
  const sets = Array.from({ length: 20 }, (_, index) => ({ id: `set-${index + 1}` }));
  assert.deepEqual(paginateDiscoveryCatalog(sets, 1), { currentPage: 1, items: sets.slice(0, 9), totalPages: 3 });
  assert.deepEqual(paginateDiscoveryCatalog(sets, 2), { currentPage: 2, items: sets.slice(9, 18), totalPages: 3 });
  assert.deepEqual(paginateDiscoveryCatalog(sets, 99), { currentPage: 3, items: sets.slice(18), totalPages: 3 });
  assert.deepEqual(paginateDiscoveryCatalog([], 4), { currentPage: 1, items: [], totalPages: 1 });
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Condition was not reached.");
}
