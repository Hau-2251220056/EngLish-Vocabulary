import assert from "node:assert/strict";
import test from "node:test";
import { createLearningPathService, LearningPathServiceError, projectPath } from "../../src/services/learning-path-service.js";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const SET_ID = "00000000-0000-4000-8000-000000000002";
const PASS_ID = "00000000-0000-4000-8000-000000000003";
const SESSION_ID = "00000000-0000-4000-8000-000000000004";
const NOW = new Date("2026-11-03T00:00:00.000Z");

test("projectPath keeps the primary recommendation at the highest unlocked level", () => {
  const curriculum = [
    setRecord("A1", "00000000-0000-4000-8000-000000000011", false),
    setRecord("A2", "00000000-0000-4000-8000-000000000012", false),
  ];
  const result = projectPath(curriculum, { highest_unlocked_level: "A2", path_completed_at: null }, [], NOW);
  assert.equal(result.recommendation.set_id, curriculum[1].id);
  assert.equal(result.next_suggestion.set_id, curriculum[1].id);
  assert.equal(result.levels[0].incomplete_sets.length, 1);
  assert.equal(result.levels[0].unlocked, true);
});

test("next suggestion skips the RESUME-first active pass and keeps curriculum order", () => {
  const first = setRecord("A1", "00000000-0000-4000-8000-000000000031", false);
  const second = setRecord("A1", "00000000-0000-4000-8000-000000000032", false);
  const activePass = { id: PASS_ID, set_id_snapshot: first.id };
  const result = projectPath([first, second], null, [activePass], NOW);
  assert.deepEqual(result.recommendation, { action: "RESUME", set_id: first.id, pass_id: PASS_ID });
  assert.deepEqual(result.next_suggestion, { action: "START", set_id: second.id, pass_id: null });
  assert.equal(result.next_suggestion_reason, null);
});

test("new curriculum and a later active Set keep the earliest untouched recommendation", () => {
  const sets = [21, 22, 23].map((suffix) => (
    setRecord("A1", `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`, false)
  ));
  const result = projectPath(
    sets,
    null,
    [{ id: PASS_ID, set_id_snapshot: sets[2].id }],
    NOW,
  );
  assert.deepEqual(result.recommendation, { action: "RESUME", set_id: sets[2].id, pass_id: PASS_ID });
  assert.deepEqual(result.next_suggestion, { action: "START", set_id: sets[0].id, pass_id: null });
});

test("next suggestion keeps deterministic order across completed active and untouched Sets", () => {
  const completed = setRecord("A1", "00000000-0000-4000-8000-000000000051", true);
  const untouched = setRecord("A1", "00000000-0000-4000-8000-000000000052", false);
  const active = setRecord("A1", "00000000-0000-4000-8000-000000000053", false);
  const result = projectPath(
    [completed, untouched, active],
    null,
    [{ id: PASS_ID, set_id_snapshot: active.id }],
    NOW,
  );
  assert.deepEqual(result.recommendation, { action: "RESUME", set_id: active.id, pass_id: PASS_ID });
  assert.deepEqual(result.next_suggestion, { action: "START", set_id: untouched.id, pass_id: null });
});

test("next suggestion excludes every authoritative SET learning and review context", () => {
  const sets = [31, 32, 33].map((suffix) => (
    setRecord("A1", `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`, false)
  ));
  const contexts = [
    { set_id_snapshot: sets[0].id, scope: "SET", mode: "NORMAL" },
    { set_id_snapshot: sets[1].id, scope: "SET", mode: "SRS" },
  ];
  const result = projectPath(sets, null, [], NOW, contexts);
  assert.equal(result.recommendation.set_id, sets[0].id);
  assert.equal(result.next_suggestion.set_id, sets[2].id);
});

test("next suggestion reports all active when the only nonempty unfinished Set has an active pass", () => {
  const active = setRecord("A1", "00000000-0000-4000-8000-000000000041", false);
  const completed = setRecord("A1", "00000000-0000-4000-8000-000000000042", true);
  const empty = { ...setRecord("A1", "00000000-0000-4000-8000-000000000043", false), items: [] };
  const locked = setRecord("A2", "00000000-0000-4000-8000-000000000044", false);
  const result = projectPath(
    [active, completed, empty, locked],
    { highest_unlocked_level: "A1", path_completed_at: null },
    [{ id: PASS_ID, set_id_snapshot: active.id }],
    NOW,
  );
  assert.equal(result.next_suggestion, null);
  assert.equal(result.next_suggestion_reason, "ALL_INCOMPLETE_SETS_ACTIVE");
  assert.equal(result.levels.find(({ level }) => level === "A2").unlocked, false);
});

test("next suggestion reports all active when every unfinished Set has a pass or Set session", () => {
  const sets = [61, 62, 63].map((suffix) => (
    setRecord("A1", `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`, false)
  ));
  const result = projectPath(
    sets,
    null,
    [{ id: PASS_ID, set_id_snapshot: sets[2].id }],
    NOW,
    [
      { set_id_snapshot: sets[0].id, scope: "SET", mode: "NORMAL" },
      { set_id_snapshot: sets[1].id, scope: "SET", mode: "SRS" },
    ],
  );
  assert.equal(result.next_suggestion, null);
  assert.equal(result.next_suggestion_reason, "ALL_INCOMPLETE_SETS_ACTIVE");
});

test("next suggestion preserves the generic reason when no nonempty unfinished Set exists", () => {
  const completed = setRecord("A1", "00000000-0000-4000-8000-000000000071", true);
  const empty = { ...setRecord("A1", "00000000-0000-4000-8000-000000000072", false), items: [] };
  const result = projectPath([completed, empty], null, [], NOW);
  assert.equal(result.next_suggestion, null);
  assert.equal(result.next_suggestion_reason, "NO_ELIGIBLE_NEXT_SET");
});

test("projectPath preserves terminal entitlement without claiming current completion", () => {
  const curriculum = ["A1", "A2", "B1", "B2", "C1"].map((level, index) => (
    setRecord(level, `00000000-0000-4000-8000-00000000002${index}`, level !== "C1")
  ));
  const completedAt = new Date("2026-10-01T00:00:00.000Z");
  const result = projectPath(curriculum, { highest_unlocked_level: "C1", path_completed_at: completedAt }, [], NOW);
  assert.equal(result.path_completed_at, completedAt);
  assert.equal(result.all_current_sets_complete, false);
  assert.equal(result.recommendation.set_id, curriculum[4].id);
});

test("completed C1 remains terminal and never invents a C2 suggestion", () => {
  const curriculum = ["A1", "A2", "B1", "B2", "C1"].map((level, index) => (
    setRecord(level, `00000000-0000-4000-8000-00000000008${index}`, true)
  ));
  const result = projectPath(curriculum, { highest_unlocked_level: "C1", path_completed_at: NOW }, [], NOW);
  assert.equal(result.recommendation, null);
  assert.equal(result.next_suggestion, null);
  assert.equal(result.next_suggestion_reason, "NO_ELIGIBLE_NEXT_SET");
  assert.equal(result.levels.some(({ level }) => level === "C2"), false);
});

test("full pass partitions more than ten items and accepts only completed reveal evidence", async () => {
  const fixture = createFixture(12);
  const service = createService(fixture);
  const started = await service.startPass(USER_ID, SET_ID, operation(101));
  assert.equal(started.pass.snapshot_size, 12);

  const first = await service.createNextSession(USER_ID, PASS_ID, operation(102));
  assert.equal(first.session.snapshot_size, 10);
  await assert.rejects(
    service.completePass(USER_ID, PASS_ID, operation(103)),
    (error) => error instanceof LearningPathServiceError && error.code === "CEFR_PASS_INCOMPLETE",
  );

  resolveSession(fixture.passes[0].learning_sessions[0]);
  const second = await service.createNextSession(USER_ID, PASS_ID, operation(104));
  assert.equal(second.session.snapshot_size, 2);
  resolveSession(fixture.passes[0].learning_sessions[1]);

  const completed = await service.completePass(USER_ID, PASS_ID, operation(105));
  assert.equal(completed.pass.state, "COMPLETED");
  assert.equal(completed.pass.remaining_items, 0);
});

test("one and ten item passes retain exact ordered snapshots", async () => {
  for (const size of [1, 10]) {
    const fixture = createFixture(size);
    const service = createService(fixture);
    await service.startPass(USER_ID, SET_ID, operation(200 + size));
    const result = await service.createNextSession(USER_ID, PASS_ID, operation(300 + size));
    assert.deepEqual(result.session.items.map((item) => item.position), [...Array(size).keys()]);
    assert.deepEqual(
      result.session.items.map((item) => item.vocabulary_id),
      fixture.set.items.map((item) => item.vocabulary_id),
    );
  }
});

test("changed frozen snapshot requires explicit restart", async () => {
  const fixture = createFixture(2);
  const service = createService(fixture);
  await service.startPass(USER_ID, SET_ID, operation(401));
  fixture.set.items.pop();
  const read = await service.readPass(USER_ID, PASS_ID);
  assert.equal(read.can_continue, false);
  assert.equal(read.restart_reason, "SNAPSHOT_CHANGED");
  await assert.rejects(
    service.createNextSession(USER_ID, PASS_ID, operation(402)),
    (error) => error.code === "CEFR_PASS_RESTART_REQUIRED",
  );
});

test("items added after pass start do not enter or invalidate the frozen snapshot", async () => {
  const fixture = createFixture(2);
  const service = createService(fixture);
  await service.startPass(USER_ID, SET_ID, operation(501));
  fixture.set.items.push({ vocabulary_id: "10000000-0000-4000-8000-000000000099", position: 2 });
  const read = await service.readPass(USER_ID, PASS_ID);
  assert.equal(read.can_continue, true);
  assert.equal(read.snapshot_size, 2);
});

test("explicit restart invalidates the incompatible run and snapshots current content", async () => {
  const fixture = createFixture(2);
  const service = createService(fixture);
  await service.startPass(USER_ID, SET_ID, operation(601));
  fixture.set.items.pop();
  const restarted = await service.restartPass(USER_ID, PASS_ID, operation(602));
  assert.equal(fixture.passes[0].status, "INVALIDATED");
  assert.equal(restarted.pass.state, "ACTIVE");
  assert.equal(restarted.pass.snapshot_size, 1);
});

function createService(fixture) {
  let generated = 0;
  return createLearningPathService({
    learningPathRepository: fixture.root,
    createSessionRepository: () => fixture.sessions,
    now: () => NOW,
    uuid: () => [PASS_ID, SESSION_ID, "00000000-0000-4000-8000-000000000005"][generated++],
  });
}

function createFixture(size) {
  const set = {
    id: SET_ID, name: "Required A1", cefr_level: "A1", created_at: NOW,
    items: Array.from({ length: size }, (_, position) => ({
      vocabulary_id: `10000000-0000-4000-8000-${String(position + 1).padStart(12, "0")}`,
      position,
    })),
  };
  const passes = [];
  let pathState = null;
  const paths = {
    listCurrentCurriculum: async () => [{
      ...set,
      cefr_learning_passes: passes.filter((pass) => pass.set_id_snapshot === set.id && pass.status === "COMPLETED")
        .map((pass) => ({ id: pass.id, completed_at: pass.completed_at })),
    }],
    findRequiredSet: async (id) => id === set.id ? set : null,
    findPathState: async () => pathState,
    lockPathState: async () => pathState,
    upsertPathState: async (_userId, data) => { pathState = { ...pathState, user_id: USER_ID, ...data }; return pathState; },
    listActivePasses: async () => passes.filter((pass) => pass.status === "ACTIVE"),
    listActiveSetContexts: async () => [],
    findActivePass: async (_userId, id) => passes.find((pass) => pass.set_id_snapshot === id && pass.status === "ACTIVE") ?? null,
    findCompletedPass: async (_userId, id) => passes.find((pass) => pass.set_id_snapshot === id && pass.status === "COMPLETED") ?? null,
    lockPassIdentity: async () => {},
    lockOperationIdentity: async () => {},
    findCreationReplay: async (_userId, op) => passes.find((pass) => pass.create_operation_id === op) ?? null,
    findCompletionReplay: async (_userId, op) => passes.find((pass) => pass.completion_event_id === op) ?? null,
    findOwnedPass: async (id) => passes.find((pass) => pass.id === id) ?? null,
    lockOwnedPass: async (id) => passes.find((pass) => pass.id === id) ?? null,
    createPass: async (input) => {
      const pass = {
        id: input.id, user_id: input.user_id, set_id_snapshot: input.set_id_snapshot,
        vocabulary_set_id: input.set_id_snapshot, status: "ACTIVE",
        create_operation_id: input.create_operation_id, snapshot_size: input.items.length,
        created_at: input.created_at, completed_at: null, completion_event_id: null,
        invalidated_at: null, items: input.items.map((item, index) => ({ id: `item-${index}`, pass_id: input.id, ...item })),
        learning_sessions: [], vocabulary_set: set,
      };
      passes.push(pass); return pass;
    },
    invalidatePass: async (id, _userId, at) => { const pass = passes.find((candidate) => candidate.id === id); pass.status = "INVALIDATED"; pass.invalidated_at = at; return { count: 1 }; },
    completePass: async (id, _userId, op, at) => { const pass = passes.find((candidate) => candidate.id === id); pass.status = "COMPLETED"; pass.completion_event_id = op; pass.completed_at = at; return { count: 1 }; },
  };
  const sessions = {
    findCreationReplay: async (_userId, op) => passes.flatMap((pass) => pass.learning_sessions).find((session) => session.create_operation_id === op) ?? null,
    findCompletionReplay: async (_userId, op) => passes.flatMap((pass) => pass.learning_sessions).find((session) => session.completion_event_id === op) ?? null,
    createSessionWithItems: async (input) => {
      const session = {
        ...input, status: "ACTIVE", completed_at: null, completion_event_id: null,
        items: input.items.map((item) => ({ ...item, session_id: input.id, evidence: null, evidence_event_id: null, evidence_at: null })),
      };
      passes.find((pass) => pass.id === input.cefr_learning_pass_id).learning_sessions.push(session);
      return session;
    },
  };
  const root = { withTransaction: (callback) => callback(paths, {}) };
  return { root, paths, sessions, passes, set };
}

function resolveSession(session) {
  session.status = "COMPLETED";
  session.completed_at = NOW;
  session.items.forEach((item, index) => {
    item.evidence = "NORMAL_REVEALED";
    item.evidence_event_id = operation(900 + index).operation_id;
    item.evidence_at = NOW;
  });
}

function setRecord(level, id, completed) {
  return {
    id, name: `${level} Set`, cefr_level: level, created_at: NOW,
    items: [{ vocabulary_id: `${id.slice(0, -1)}9`, position: 0 }],
    cefr_learning_passes: completed ? [{ id: `pass-${id}`, completed_at: NOW }] : [],
  };
}

function operation(number) {
  return { operation_id: `20000000-0000-4000-8000-${String(number).padStart(12, "0")}` };
}
