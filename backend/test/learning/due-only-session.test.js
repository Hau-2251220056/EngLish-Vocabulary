import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createLearningSessionService } from "../../src/services/learning-session-service.js";

const USER = "10000000-0000-4000-8000-000000000001";
const SET = "10000000-0000-4000-8000-000000000002";
const OPERATION = "10000000-0000-4000-8000-000000000003";
const NOW = new Date("2026-11-19T00:00:00.000Z");
const vocabId = (index) => `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`;

function fixture(dueCount, newCount, futureCount = 0) {
  const items = Array.from({ length: dueCount + newCount + futureCount }, (_, index) => ({
    position: index,
    vocabulary: {
      id: vocabId(index + 1), word: `word${index + 1}`, meanings: [],
      learning_progress: index < dueCount ? [{ status: "LEARNING", interval_days: null,
        next_review_at: NOW, review_count: 1, revision: 1, last_reviewed_at: NOW }]
        : index < dueCount + newCount ? []
          : [{ status: "LEARNED", interval_days: 3,
            next_review_at: new Date("2026-11-22T00:00:00.000Z"), review_count: 1,
            revision: 1, last_reviewed_at: NOW }],
    },
  }));
  let saved = null;
  let authorized = true;
  const set = { id: SET, name: "Authorized Set", items };
  const sessions = {
    findCreationReplay: async (_userId, operationId) => saved?.create_operation_id === operationId ? saved : null,
    findOwnedSession: async (sessionId, userId) => saved?.id === sessionId && userId === USER ? saved : null,
    createSessionWithItems: async (input) => {
      saved = { ...input, scope: "SET", status: "ACTIVE", completed_at: null,
        items: input.items.map((item) => ({ ...item, evidence: null })) };
      return saved;
    },
  };
  const learning = {
    findAccessibleSetForUser: async () => authorized ? set : null,
    lockAccessibleSetForSessionSnapshot: async () => authorized ? set : null,
    lockSetItem: async () => ({}),
    lockProgressIdentity: async () => ({}),
  };
  const service = createLearningSessionService({
    withTransaction: (callback) => callback({}),
    createSessionRepository: () => sessions,
    createLearningRepository: () => learning,
    authorizeSetActivity: async () => { if (!authorized) throw Object.assign(new Error("Locked"), { code: "CEFR_LEVEL_LOCKED" }); },
    now: () => NOW,
    uuid: () => "30000000-0000-4000-8000-000000000001",
  });
  return { service, items, get saved() { return saved; }, deny() { authorized = false; } };
}

const request = (intent = "DUE_ONLY") => ({ operation_id: OPERATION, set_id: SET,
  mode: "SRS", session_intent: intent });

for (const [due, fresh] of [[1, 9], [2, 5], [12, 3]]) {
  test(`${due} due and ${fresh} NEW yields only a bounded due-only snapshot`, async () => {
    const { service } = fixture(due, fresh, 1);
    const result = await service.createSession(USER, request());
    assert.equal(result.session.snapshot_size, Math.min(due, 10));
    assert.deepEqual(result.session.items.map((item) => item.vocabulary_id),
      Array.from({ length: Math.min(due, 10) }, (_, index) => vocabId(index + 1)));
    assert.equal(result.session.session_intent, "DUE_ONLY");
  });
}

test("zero due creates no session; STANDARD retains NEW cards", async () => {
  const due = fixture(0, 9, 1);
  assert.equal((await due.service.createSession(USER, request())).session, null);
  const standard = fixture(1, 9);
  const result = await standard.service.createSession(USER, request("STANDARD"));
  assert.equal(result.session.snapshot_size, 10);
});

test("after a ten-card batch is rated, a new due-only operation reaches the remaining due cards", async () => {
  const context = fixture(12, 0);
  const first = await context.service.createSession(USER, request());
  assert.equal(first.session.snapshot_size, 10);
  for (const item of context.items.slice(0, 10)) {
    item.vocabulary.learning_progress[0] = { status: "LEARNED", interval_days: 3,
      next_review_at: new Date("2026-11-22T00:00:00.000Z"), review_count: 2,
      revision: 2, last_reviewed_at: NOW };
  }
  const second = await context.service.createSession(USER, {
    ...request(), operation_id: "10000000-0000-4000-8000-000000000004",
  });
  assert.deepEqual(second.session.items.map((item) => item.vocabulary_id), [vocabId(11), vocabId(12)]);
});

test("replay and read preserve intent, owner, authorized Set and immutable cards", async () => {
  const context = fixture(2, 5);
  const created = await context.service.createSession(USER, request());
  const replay = await context.service.createSession(USER, request());
  assert.equal(replay.replayed, true);
  assert.equal(replay.session.id, created.session.id);
  await assert.rejects(context.service.createSession(USER, request("STANDARD")),
    (error) => error?.code === "LEARNING_SESSION_OPERATION_CONFLICT");
  const read = await context.service.readSession(USER, created.session.id);
  assert.deepEqual(read.cards.map((card) => card.id), created.session.items.map((item) => item.vocabulary_id));
  assert.equal(read.set_name, "Authorized Set");
  await assert.rejects(context.service.readSession(vocabId(99), created.session.id),
    (error) => error?.code === "LEARNING_SESSION_NOT_FOUND");
  context.deny();
  await assert.rejects(context.service.readSession(USER, created.session.id),
    (error) => error?.code === "CEFR_LEVEL_LOCKED");
});

test("forward-only migration defaults existing snapshots to STANDARD without destructive statements", async () => {
  const sql = await readFile(new URL("../../prisma/migrations/20261119000000_add_learning_session_intent/migration.sql", import.meta.url), "utf8");
  assert.match(sql, /ADD COLUMN "session_intent" "LEARNING_SESSION_INTENT" NOT NULL DEFAULT 'STANDARD'/);
  assert.doesNotMatch(sql, /\b(?:DROP|DELETE|TRUNCATE|UPDATE)\b/i);
});
