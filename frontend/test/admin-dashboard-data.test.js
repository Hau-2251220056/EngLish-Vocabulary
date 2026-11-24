import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateCefrDistribution,
  aggregateTopicDistribution,
  percentage,
  selectLeadingCefr,
} from "../src/dashboard/admin-dashboard-data.js";

const topics = [
  { id: "topic-1", name: "Du lịch" },
  { id: "topic-2", name: "Công việc và giao tiếp" },
  { id: "topic-3", name: "Thiên nhiên" },
];
const sets = [
  { id: "set-1", topic_id: "topic-1", cefr_level: "A1" },
  { id: "set-2", topic_id: "topic-1", cefr_level: "A2" },
  { id: "set-3", topic_id: "topic-2", cefr_level: "A1" },
];

test("aggregates exact Set-level CEFR counts in the approved order", () => {
  assert.deepEqual(aggregateCefrDistribution(sets), [
    { level: "A1", count: 2 }, { level: "A2", count: 1 },
    { level: "B1", count: 0 }, { level: "B2", count: 0 }, { level: "C1", count: 0 },
  ]);
  assert.deepEqual(selectLeadingCefr(aggregateCefrDistribution(sets)), { level: "A1", count: 2 });
  assert.equal(percentage(2, 3), 67);
});

test("aggregates authoritative Topic relationships and preserves zero-count Topics", () => {
  assert.deepEqual(aggregateTopicDistribution(topics, sets), [
    { id: "topic-1", name: "Du lịch", count: 2 },
    { id: "topic-2", name: "Công việc và giao tiếp", count: 1 },
    { id: "topic-3", name: "Thiên nhiên", count: 0 },
  ]);
});

test("rejects unsupported CEFR and unresolved Topic relationships", () => {
  assert.throws(() => aggregateCefrDistribution([{ id: "set-c2", topic_id: "topic-1", cefr_level: "C2" }]));
  assert.throws(() => aggregateTopicDistribution(topics, [{ id: "set-x", topic_id: "missing", cefr_level: "A1" }]));
});

test("returns no leading CEFR for empty data or ties", () => {
  assert.equal(selectLeadingCefr(aggregateCefrDistribution([])), null);
  assert.equal(selectLeadingCefr(aggregateCefrDistribution([
    { id: "set-a", topic_id: "topic-1", cefr_level: "A1" },
    { id: "set-b", topic_id: "topic-1", cefr_level: "A2" },
  ])), null);
});
