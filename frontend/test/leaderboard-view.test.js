import assert from "node:assert/strict";
import test from "node:test";
import { createAuthenticationStore } from "../src/auth/auth-store.js";
import { createLeaderboardSessionStore, leaderboardSession } from "../src/leaderboard/leaderboard-session.js";
import { createLeaderboardView } from "../src/leaderboard/leaderboard-view.js";
import { createLearningService } from "../src/services/learning-service.js";
import { createLearningSessionService } from "../src/services/learning-session-service.js";
import { createQuizService } from "../src/services/quiz-service.js";

const begin = "2026-11-22T17:00:00.000Z";
const end = "2026-11-29T17:00:00.000Z";
const asOf = "2026-11-27T06:15:00.000Z";
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

function snapshot(page = 1, totalPages = 2, windowEnd = end, instant = asOf, period = "weekly") {
  return { period, window: { start: begin, end: windowEnd }, as_of: instant,
    pagination: { page, total_pages: totalPages, total_items: totalPages * 10 } };
}

function harness({ time = Date.parse(asOf), store = createLeaderboardSessionStore() } = {}) {
  if (!store.getSnapshot()) store.replace(true);
  const session = store.getSnapshot();
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const calls = [];
  const timers = new Map();
  let lastTimer = 0;
  const view = createLeaderboardView({
    session, documentTarget: doc, clock: () => time, random: () => 0.5,
    schedule(callback, delay) { timers.set(++lastTimer, { callback, delay }); return lastTimer; },
    cancel: (id) => timers.delete(id),
    read: (period, page, signal) => new Promise((resolve, reject) => calls.push({ period, page, signal, resolve, reject })),
  });
  const stop = view.start();
  return {
    session, store, view, stop, calls, timers,
    runTimer() {
      const [id, timer] = [...timers][0];
      timers.delete(id);
      time += timer.delay;
      timer.callback();
      return timer.delay;
    },
    visibility(value) { doc.visibilityState = value; doc.dispatchEvent(new Event("visibilitychange")); },
  };
}

test("entry fetch, one poll after completion, pause and immediate restore", async () => {
  const h = harness();
  assert.equal(h.calls.length, 1);
  assert.equal(h.timers.size, 0);
  h.view.refresh();
  assert.equal(h.calls.length, 1);
  h.calls[0].resolve(snapshot());
  await flush();
  assert.equal(h.runTimer(), 60_000);
  assert.equal(h.calls.length, 2);
  h.visibility("hidden");
  assert.ok(h.calls[1].signal.aborted);
  h.visibility("visible");
  h.calls[1].resolve(snapshot());
  await flush();
  assert.equal(h.calls.length, 3);
  h.stop();
  assert.ok(h.calls[2].signal.aborted);
  assert.equal(h.timers.size, 0);
});

test("switching period ignores late data and waits for the old request to settle", async () => {
  const h = harness();
  h.view.setPeriod("monthly");
  assert.equal(h.calls.length, 1);
  assert.ok(h.calls[0].signal.aborted);
  h.calls[0].resolve(snapshot());
  await flush();
  assert.equal(h.view.snapshot().entry, null);
  assert.deepEqual([h.calls[1].period, h.calls[1].page], ["monthly", 1]);
  h.calls[1].resolve(snapshot(1, 2, end, asOf, "monthly"));
  await flush();
  assert.equal(h.view.snapshot().entry.data.period, "monthly");
  h.stop();
});

test("new invalidations during a read coalesce into one follow-up, with no inactive GET", async () => {
  const h = harness();
  const notify = h.store.captureInvalidation();
  const reward = { xp_earned: 3, replayed: false };
  notify({ reward });
  notify({ reward });
  assert.equal(h.calls.length, 1);
  h.calls[0].resolve(snapshot());
  await flush();
  assert.equal(h.calls.length, 2);
  h.calls[1].resolve(snapshot());
  await flush();
  assert.equal(h.calls.length, 2);
  h.stop();
  notify({ reward });
  assert.equal(h.session.revision, 3);
  assert.equal(h.calls.length, 2);
});

test("transient error retains data and backs off, while auth failure clears and stops", async () => {
  const h = harness();
  h.calls[0].resolve(snapshot());
  await flush();
  h.runTimer();
  h.calls[1].reject(new Error("offline"));
  await flush();
  assert.equal(h.view.snapshot().error, "transient");
  assert.equal(h.view.snapshot().entry.data.as_of, asOf);
  assert.equal(h.runTimer(), 120_000);
  h.calls[2].reject({ response: { status: 401 } });
  await flush();
  assert.equal(h.view.snapshot().error, "auth");
  assert.equal(h.view.snapshot().entry, null);
  assert.equal(h.session.snapshots.size, 0);
  assert.equal(h.timers.size, 0);
  h.stop();
});

test("rollover resets to the first page and labels the prior data through failure", async () => {
  const h = harness({ time: Date.parse(end) - 500 });
  const nearEnd = new Date(Date.parse(end) - 500).toISOString();
  h.calls[0].resolve(snapshot(1, 2, end, nearEnd));
  await flush();
  h.view.setPage(2);
  h.calls[1].resolve(snapshot(2, 2, end, nearEnd));
  await flush();
  assert.equal(h.runTimer(), 500);
  assert.equal(h.calls[2].page, 1);
  assert.equal(h.view.snapshot().previousPeriod, true);
  h.calls[2].reject(new Error("offline"));
  await flush();
  assert.equal(h.view.snapshot().previousPeriod, true);
  h.view.refresh();
  h.calls[3].resolve(snapshot(1, 2, "2026-12-06T17:00:00.000Z", end));
  await flush();
  assert.equal(h.view.snapshot().previousPeriod, false);
  assert.equal(h.session.snapshots.has("weekly:2"), false);
  h.stop();
});

test("clamps an invalidated page once and normalizes empty rankings to page one", async () => {
  const h = harness();
  h.calls[0].resolve(snapshot());
  await flush();
  h.view.setPage(2);
  h.calls[1].resolve(snapshot(2, 1));
  await flush();
  assert.equal(h.calls[2].page, 1);
  h.calls[2].resolve(snapshot(1, 1));
  await flush();
  h.view.setPage(2);
  h.calls[3].resolve(snapshot(2, 0));
  await flush();
  assert.equal(h.calls.length, 4);
  assert.equal(h.view.snapshot().page, 1);
  assert.equal(h.view.snapshot().entry.data.pagination.page, 1);
  h.stop();
});

test("account switches and logout clear snapshots and reject late old-session invalidation", async () => {
  const sessions = createLeaderboardSessionStore();
  const learner = (id) => ({ id, role: "USER" });
  let changes = 0;
  const auth = createAuthenticationStore({ login: async (id) => learner(id), logout: async () => {} },
    sessions, () => { changes += 1; });
  await auth.login("a");
  const first = sessions.getSnapshot();
  const late = sessions.captureInvalidation();
  first.snapshots.set("weekly:1", {});
  await auth.login("b");
  late({ reward: { xp_earned: 3, replayed: false } });
  assert.ok(first.closed);
  assert.equal(first.snapshots.size, 0);
  assert.equal(sessions.getSnapshot().revision, 0);
  await auth.logout();
  assert.equal(sessions.getSnapshot(), null);
  assert.equal(changes, 3);
});

test("pending Leaderboard read cannot restore a cleared snapshot after logout", async () => {
  const store = createLeaderboardSessionStore();
  const user = { id: "same", role: "USER" };
  const auth = createAuthenticationStore({ getCurrentUser: async () => user, logout: async () => {} }, store);
  await auth.initialize();
  const h = harness({ store });
  h.calls[0].resolve(snapshot());
  await flush();
  h.runTimer();
  assert.equal(h.calls.length, 2);
  await auth.logout();
  h.stop();
  assert.ok(h.calls[1].signal.aborted);
  assert.ok(h.session.closed);
  assert.equal(store.getSnapshot(), null);
  h.calls[1].resolve(snapshot());
  await flush();
  assert.equal(h.session.snapshots.size, 0);
  assert.equal(h.timers.size, 0);
});

test("repeated same-USER revalidation starts one fresh session and one poll schedule", async () => {
  const store = createLeaderboardSessionStore();
  const user = { id: "same", role: "USER" };
  const reads = [];
  const auth = createAuthenticationStore({
    getCurrentUser: () => new Promise((resolve) => reads.push(resolve)),
  }, store);
  const initial = auth.initialize();
  reads[0](user);
  await initial;
  const old = harness({ store });
  old.calls[0].resolve(snapshot());
  await flush();
  const refresh = auth.refreshCurrentUser();
  reads[1](user);
  await refresh;
  assert.equal(store.getSnapshot(), old.session);

  const before = auth.refreshCurrentUser({ resetLeaderboard: true });
  const latest = auth.refreshCurrentUser({ resetLeaderboard: true });
  old.stop();
  assert.ok(old.session.closed);
  assert.equal(old.session.snapshots.size, 0);
  assert.equal(store.getSnapshot(), null);
  reads[3](user);
  await latest;
  const recovered = harness({ store });
  recovered.calls[0].resolve(snapshot());
  await flush();
  reads[2](user);
  assert.equal(await before, null);
  assert.equal(store.getSnapshot(), recovered.session);
  assert.notEqual(recovered.session, old.session);
  assert.equal(recovered.calls.length, 1);
  assert.equal(recovered.timers.size, 1);
  assert.equal(recovered.runTimer(), 60_000);
  assert.equal(recovered.calls.length, 2);
  recovered.stop();
});

const ids = Array.from({ length: 4 }, (_, i) => `10000000-0000-4000-8000-00000000000${i}`);
const [sessionId, setId, vocabularyId, eventId] = ids;
const reward = (xp = 3, replayed = false) => ({ source_event_id: eventId, xp_earned: xp, replayed,
  total_xp: 3, level: 1, level_min_xp: 0, next_level_xp: 50, is_max_level: false });
const progress = { vocabulary_id: vocabularyId, status: "LEARNED", effective_status: "LEARNED", stage: 1,
  interval_days: 1, next_review_at: asOf, last_reviewed_at: asOf, review_count: 1, revision: 1 };
const sessionProjection = (mode, state, evidence) => ({ id: sessionId, set_id: setId, scope: "SET", mode, state,
  snapshot_size: 1, completed_items: 1, credited_items: 1, remaining_items: 0, ready_to_complete: state === "ACTIVE",
  created_at: asOf, expires_at: "2026-12-04T06:15:00.000Z", completed_at: state === "COMPLETED" ? asOf : null,
  items: [{ position: 0, vocabulary_id: vocabularyId, evidence, credited_at: asOf }] });
const mockClient = (value) => ({ post: async () => ({ data: { data: value } }) });

test("validated SRS service responses invalidate before completion and without a session; rejects/replays do not", async () => {
  leaderboardSession.replace(true);
  const current = leaderboardSession.getSnapshot();
  const input = { rating: "GOOD", set_id: setId, vocabulary_id: vocabularyId };
  await createLearningService(mockClient({ ...progress, reward: reward() })).recordMeaningfulEvent(input);
  await createLearningService(mockClient({ ...progress, reward: reward(), session: sessionProjection("SRS", "ACTIVE", "SRS_GOOD") }))
    .recordMeaningfulEvent({ ...input, session_id: sessionId });
  await createLearningService(mockClient({ ...progress, reward: reward(3, true) })).recordMeaningfulEvent(input);
  await createLearningService(mockClient({ ...progress, reward: reward(0) })).recordMeaningfulEvent(input);
  await assert.rejects(createLearningService(mockClient({ reward: reward() })).recordMeaningfulEvent(input));
  assert.equal(current.revision, 2);
  leaderboardSession.replace(false);
});

test("validated quiz answer and streak-only completion invalidate without counting replays", async () => {
  leaderboardSession.replace(true);
  const current = leaderboardSession.getSnapshot();
  const input = { event_id: eventId, set_id: setId, vocabulary_id: vocabularyId, run_id: sessionId,
    question_revision: eventId, quiz_type: "MULTIPLE_CHOICE", expected_revision: 1, selected_choice_id: eventId };
  const result = { ...input, is_correct: true, correct_choice_id: eventId, progress, reward: reward() };
  await createQuizService(mockClient(result)).submitAnswer(input);
  await createQuizService(mockClient({ ...result, session: sessionProjection("QUIZ", "ACTIVE", "QUIZ_CORRECT") }))
    .submitAnswer({ ...input, session_id: sessionId });
  await createQuizService(mockClient({ ...result, reward: reward(3, true) })).submitAnswer(input);
  const completion = { session: sessionProjection("NORMAL", "COMPLETED", "NORMAL_REVEALED"), replayed: false,
    streak: { current_streak: 2, completed_today: true, last_qualified_date: "2026-11-27",
      timezone: "Asia/Ho_Chi_Minh", evaluated_at: asOf } };
  await createLearningSessionService(mockClient(completion)).completeNormalSession(sessionId, eventId);
  await createLearningSessionService(mockClient({ ...completion, replayed: true })).completeNormalSession(sessionId, eventId);
  assert.equal(current.revision, 3);
  leaderboardSession.replace(false);
});
