import assert from "node:assert/strict";
import test from "node:test";
import { paginateSetDetailItems, SET_DETAIL_PAGE_SIZE } from "../src/vocabulary-sets/set-detail-pagination.js";

test("Set Detail pagination keeps ten ordered items per page across approved boundaries", () => {
  assert.equal(SET_DETAIL_PAGE_SIZE, 10);

  for (const total of [0, 1, 10, 11, 30, 50]) {
    const items = Array.from({ length: total }, (_, index) => ({ id: `item-${index + 1}`, position: index + 1 }));
    const first = paginateSetDetailItems(items, 1);
    assert.deepEqual(first.items, items.slice(0, 10));
    assert.equal(first.start, total === 0 ? 0 : 1);
    assert.equal(first.end, Math.min(total, 10));
    assert.equal(first.totalItems, total);
    assert.equal(first.totalPages, Math.max(1, Math.ceil(total / 10)));

    const last = paginateSetDetailItems(items, 999);
    const lastStart = Math.max(0, Math.floor(Math.max(0, total - 1) / 10) * 10);
    assert.deepEqual(last.items, items.slice(lastStart));
    assert.equal(last.currentPage, Math.max(1, Math.ceil(total / 10)));
    assert.equal(last.end, total);
  }
});

test("Set Detail pagination clamps a stale page after item-count or Set replacement", () => {
  const fifty = Array.from({ length: 50 }, (_, index) => ({ id: `large-${index + 1}` }));
  assert.equal(paginateSetDetailItems(fifty, 5).currentPage, 5);

  const replacement = [{ id: "replacement-1" }];
  assert.deepEqual(paginateSetDetailItems(replacement, 5), {
    currentPage: 1,
    end: 1,
    items: replacement,
    start: 1,
    totalItems: 1,
    totalPages: 1,
  });
});
