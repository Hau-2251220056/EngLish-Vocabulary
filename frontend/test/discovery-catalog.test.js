import assert from "node:assert/strict";
import test from "node:test";
import {
  filterDiscoveryCatalog,
  loadDiscoveryCatalog,
  paginateDiscoveryCatalog,
  selectDiscoveryFeaturedSets,
  sortDiscoveryCatalog,
} from "../src/topics/discovery-catalog.js";

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
    { id: "set-1", name: "Airport Basics", description: "Travel essentials", cefr_level: "A1", topic: { id: "topic-1" } },
    { id: "set-2", name: "Office", description: "Daily WORK", cefr_level: "B1", topic: { id: "topic-2" } },
    { id: "set-3", name: "Hotel", description: null, cefr_level: null, topic: { id: "topic-1" } },
  ];

  assert.deepEqual(filterDiscoveryCatalog(sets, { query: "  essentials ", topicId: "" }).map(({ id }) => id), ["set-1"]);
  assert.deepEqual(filterDiscoveryCatalog(sets, { query: "work", topicId: "topic-2" }).map(({ id }) => id), ["set-2"]);
  assert.deepEqual(filterDiscoveryCatalog(sets, { query: "office", topicId: "topic-1" }), []);
  assert.deepEqual(filterDiscoveryCatalog(sets, { query: "", topicId: "topic-1" }).map(({ id }) => id), ["set-1", "set-3"]);
  assert.deepEqual(filterDiscoveryCatalog(sets, { cefrLevel: "A1", query: "", topicId: "" }).map(({ id }) => id), ["set-1"]);
  assert.deepEqual(filterDiscoveryCatalog(sets, { cefrLevel: "B1", query: "work", topicId: "topic-2" }).map(({ id }) => id), ["set-2"]);
  assert.deepEqual(filterDiscoveryCatalog(sets, { cefrLevel: "A1", query: "", topicId: "topic-2" }), []);
  assert.deepEqual(filterDiscoveryCatalog(sets, { cefrLevel: "C1", query: "", topicId: "" }), []);
});

test("selects at most the first three catalog Sets as Featured without marker or environment rules", () => {
  const ordinarySets = Array.from({ length: 5 }, (_, index) => ({
    id: `set-${index + 1}`,
    name: `Ordinary catalog Set ${index + 1}`,
  }));

  assert.deepEqual(selectDiscoveryFeaturedSets(ordinarySets), ordinarySets.slice(0, 3));
  assert.deepEqual(selectDiscoveryFeaturedSets(ordinarySets.slice(0, 2)), ordinarySets.slice(0, 2));
  assert.deepEqual(selectDiscoveryFeaturedSets([]), []);
  assert.deepEqual(ordinarySets.map(({ id }) => id), ["set-1", "set-2", "set-3", "set-4", "set-5"]);
});

test("paginates filtered catalog at nine items and clamps invalid pages", () => {
  for (const total of [8, 9, 10]) {
    const catalog = Array.from({ length: total }, (_, index) => ({ id: `catalog-${index + 1}` }));
    const firstPage = paginateDiscoveryCatalog(catalog, 1);
    assert.equal(firstPage.items.length, Math.min(total, 9));
    assert.equal(firstPage.totalPages, total > 9 ? 2 : 1);
    assert.deepEqual(firstPage.items, catalog.slice(0, 9));
    if (total === 10) assert.deepEqual(paginateDiscoveryCatalog(catalog, 2).items, catalog.slice(9));
  }

  const sets = Array.from({ length: 20 }, (_, index) => ({ id: `set-${index + 1}` }));
  assert.deepEqual(paginateDiscoveryCatalog(sets, 1), { currentPage: 1, items: sets.slice(0, 9), totalPages: 3 });
  assert.deepEqual(paginateDiscoveryCatalog(sets, 2), { currentPage: 2, items: sets.slice(9, 18), totalPages: 3 });
  assert.deepEqual(paginateDiscoveryCatalog(sets, 99), { currentPage: 3, items: sets.slice(18), totalPages: 3 });
  assert.deepEqual(paginateDiscoveryCatalog([], 4), { currentPage: 1, items: [], totalPages: 1 });
});

test("sorts visible catalog by A1-C2, normalized name, then stable id without mutation", () => {
  const sets = [
    { id: "z-unknown", name: "Unsupported", cefr_level: "Z9" },
    { id: "b1-beta", name: "Beta", cefr_level: "B1" },
    { id: "a1-zulu", name: "Zulu", cefr_level: "A1" },
    { id: "c2-alpha", name: "Alpha", cefr_level: "C2" },
    { id: "a2-alpha-2", name: "Álpha", cefr_level: "A2" },
    { id: "a2-alpha-1", name: "Álpha", cefr_level: "A2" },
    { id: "missing", name: "Missing", cefr_level: null },
    { id: "c1", name: "C1", cefr_level: "C1" },
    { id: "b2", name: "B2", cefr_level: "B2" },
  ];
  const original = sets.map(({ id }) => id);

  assert.deepEqual(sortDiscoveryCatalog(sets).map(({ id }) => id), [
    "a1-zulu", "a2-alpha-1", "a2-alpha-2", "b1-beta", "b2", "c1", "c2-alpha", "missing", "z-unknown",
  ]);
  assert.deepEqual(sets.map(({ id }) => id), original);
});

test("applies filtering before deterministic sorting and pagination while Featured keeps source order", () => {
  const source = [
    { id: "featured-b2", name: "First source", cefr_level: "B2", topic: { id: "topic-1" } },
    { id: "featured-a2", name: "Second source", cefr_level: "A2", topic: { id: "topic-1" } },
    ...Array.from({ length: 8 }, (_, index) => ({
      id: `a1-${String(index).padStart(2, "0")}`,
      name: `A1 Set ${index}`,
      cefr_level: "A1",
      topic: { id: "topic-1" },
    })),
  ];
  const filtered = filterDiscoveryCatalog(source, { query: "", topicId: "topic-1" });
  const visible = paginateDiscoveryCatalog(sortDiscoveryCatalog(filtered), 1);

  assert.deepEqual(selectDiscoveryFeaturedSets(source).map(({ id }) => id), ["featured-b2", "featured-a2", "a1-00"]);
  assert.deepEqual(visible.items.map(({ id }) => id), [
    "a1-00", "a1-01", "a1-02", "a1-03", "a1-04", "a1-05", "a1-06", "a1-07", "featured-a2",
  ]);
  assert.equal(visible.totalPages, 2);
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
