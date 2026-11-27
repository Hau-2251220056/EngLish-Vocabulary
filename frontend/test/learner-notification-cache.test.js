import assert from "node:assert/strict";
import test from "node:test";
import { createLearnerNotificationCache, NOTIFICATION_STALE_MS } from "../src/notifications/learner-notification-cache.js";

const row = (id) => ({ id: String(id).padStart(3, "0"), occurred_at: "2026-11-27T00:00:00Z", read_at: null });
const page = (ids, cursor, count = 99) => ({ items: ids.map(row), next_cursor: cursor, has_more: !!cursor, unread_count: count });

test("refresh after new items bridges the old tail without gaps or duplicated rows", async () => {
  let calls = 0;
  const cache = createLearnerNotificationCache({
    refresh: async () => ++calls === 1 ? page([8, 7, 6], "c6") : page([14, 13, 12], "c12"),
    list: async (cursor) => ({
      c12: page([11, 10, 9], "c9"),
      c9: page([8, 7, 6], "c6"),
      c6: page([5, 4, 3], "c3"),
      c3: page([2, 1], null),
    })[cursor],
  });
  await cache.refresh();
  await cache.loadMore();
  await cache.loadMore();
  cache.invalidate();
  await cache.refresh();
  assert.deepEqual(cache.snapshot().items.map((item) => Number(item.id)), Array.from({ length: 14 }, (_, i) => 14 - i));
  assert.equal(cache.snapshot().cursor, null);
});

test("cache TTL and isolated instances prevent cross-account results and repeated fresh gets", async () => {
  let calls = 0;
  let now = 0;
  const viewer = createLearnerNotificationCache({ refresh: async () => { calls++; return page([], null, 0); } }, () => now);
  const anotherViewer = createLearnerNotificationCache({});
  assert.equal(anotherViewer.snapshot().count, null);
  await viewer.refresh();
  await viewer.refresh();
  assert.equal(calls, 1);
  now += NOTIFICATION_STALE_MS;
  await viewer.refresh();
  assert.equal(calls, 2);
  assert.equal(anotherViewer.snapshot().count, null);
});

test("refresh and read serialize and read errors preserve state", async () => {
  let failures = true;
  let reads = 0;
  const cache = createLearnerNotificationCache({
    refresh: async () => page([1], "before", 101),
    markOne: async () => {
      reads++;
      if (failures) throw new Error("offline");
      return { read_at: "2026-11-27T12:00:00Z", unread_count: 100 };
    },
    markAll: async () => ({ read_at: "2026-11-27T12:01:00Z", unread_count: 0 }),
  });
  await cache.refresh();
  await cache.markOne(row(1).id);
  assert.equal(cache.snapshot().readError, true);
  assert.equal(cache.snapshot().items[0].read_at, null);
  failures = false;
  await Promise.all([cache.refresh({ force: true }), cache.markOne(row(1).id), cache.markOne(row(1).id)]);
  assert.equal(reads, 2);
  assert.equal(cache.snapshot().count, 100);
  await cache.markAll();
  assert.equal(cache.snapshot().count, 0);
});

test("pagination and background refresh faults preserve prior rows and cursor", async () => {
  let fail = false;
  const cache = createLearnerNotificationCache({
    refresh: async () => {
      if (fail) throw new Error("offline");
      return page([3, 2], "c2", 2);
    },
    list: async () => { throw new Error("offline"); },
  });
  await cache.refresh();
  await cache.loadMore();
  assert.equal(cache.snapshot().moreError, true);
  fail = true;
  await cache.refresh({ force: true });
  assert.equal(cache.snapshot().refreshError, true);
  assert.equal(cache.snapshot().items.length, 2);
  assert.equal(cache.snapshot().count, 2);
  assert.equal(cache.snapshot().cursor, "c2");
});

test("session reset aborts in-flight work and never sends queued mutations", async () => {
  let finishRefresh;
  let requestSignal;
  let mutations = 0;
  let calls = 0;
  const cache = createLearnerNotificationCache({
    refresh: (signal) => {
      if (++calls === 1) return Promise.resolve(page([1], null, 1));
      requestSignal = signal;
      return new Promise((resolve) => { finishRefresh = resolve; });
    },
    markAll: async () => { mutations++; },
  });
  await cache.refresh();
  const second = cache.refresh({ force: true });
  const queued = cache.markAll();
  await Promise.resolve();
  cache.reset();
  assert.equal(requestSignal.aborted, true);
  finishRefresh(page([2], null, 1));
  await Promise.all([second, queued]);
  assert.equal(mutations, 0);
  assert.deepEqual(cache.snapshot().items, []);
  assert.equal(cache.snapshot().count, null);
});
