import assert from "node:assert/strict";
import test from "node:test";
import {
  createLearningPathFirstCreditRecorder,
  createLearningPathService,
  LearningPathServiceError,
  projectPath,
} from "../../src/services/learning-path-service.js";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const SET_ID = "00000000-0000-4000-8000-000000000002";
const PASS_ID = "00000000-0000-4000-8000-000000000003";
const SESSION_ID = "00000000-0000-4000-8000-000000000004";
const EVENT_ID = "00000000-0000-4000-8000-000000000006";
const OTHER_EVENT_ID = "00000000-0000-4000-8000-000000000007";
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

test("full pass partitions more than ten items and completes from canonical first credits", async () => {
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

  resolveSession(fixture.passes[0], fixture.passes[0].learning_sessions[0]);
  const second = await service.createNextSession(USER_ID, PASS_ID, operation(104));
  assert.equal(second.session.snapshot_size, 2);
  resolveSession(fixture.passes[0], fixture.passes[0].learning_sessions[1]);

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

test("pass session mode defaults to NORMAL and replay matching uses normalized mode", async () => {
  const fixture = createFixture(2);
  const service = createService(fixture);
  await service.startPass(USER_ID, SET_ID, operation(620));
  const request = operation(621);
  const created = await service.createNextSession(USER_ID, PASS_ID, request);
  assert.equal(created.session.mode, "NORMAL");
  const replay = await service.createNextSession(USER_ID, PASS_ID, { ...request, mode: "NORMAL" });
  assert.equal(replay.replayed, true);
  assert.equal(replay.session.id, created.session.id);
  await assert.rejects(
    service.createNextSession(USER_ID, PASS_ID, { ...request, mode: "SRS" }),
    (error) => error.code === "CEFR_PASS_OPERATION_CONFLICT",
  );
  for (const invalid of [
    { ...operation(622), mode: "QUIZ" },
    { ...operation(623), mode: "NORMAL", pass_id: PASS_ID },
    { ...operation(624), mode: "SRS", vocabulary_ids: [fixture.set.items[0].vocabulary_id] },
    { mode: "SRS" },
  ]) {
    await assert.rejects(
      service.createNextSession(USER_ID, PASS_ID, invalid),
      (error) => error.code === "CEFR_PATH_VALIDATION_ERROR",
    );
  }
});

test("canonical first-credit selection partitions 10, 11, 15, and 20 items exactly", async () => {
  for (const size of [10, 11, 15, 20]) {
    const fixture = createFixture(size);
    const service = createService(fixture);
    await service.startPass(USER_ID, SET_ID, operation(1000 + size));
    const batches = [];
    for (let index = 0; ; index += 1) {
      const result = await service.createNextSession(
        USER_ID,
        PASS_ID,
        { ...operation(1100 + size * 10 + index), mode: "NORMAL" },
      );
      if (!result.session) {
        assert.equal(result.reason, "PASS_READY_TO_COMPLETE");
        break;
      }
      batches.push(result.session.snapshot_size);
      creditSession(fixture.passes[0], fixture.passes[0].learning_sessions.at(-1));
    }
    assert.deepEqual(batches, size === 10 ? [10] : [10, size - 10]);
    const pass = await service.readPass(USER_ID, PASS_ID);
    assert.equal(pass.studied_items, size);
    assert.equal(pass.remaining_items, 0);
    assert.equal(pass.ready_to_complete, true);
  }
});

test("pristine CEFR SRS includes unseen and non-due pass items with rating previews", async () => {
  const fixture = createFixture(2);
  fixture.set.items[0].progress = {
    status: "LEARNING",
    review_count: 2,
    revision: 2,
    last_reviewed_at: NOW,
    interval_days: 3,
    next_review_at: new Date("2026-11-20T00:00:00.000Z"),
  };
  const service = createService(fixture);
  await service.startPass(USER_ID, SET_ID, operation(650));
  const result = await service.createNextSession(USER_ID, PASS_ID, { ...operation(651), mode: "SRS" });
  assert.equal(result.session.mode, "SRS");
  assert.deepEqual(result.session.items.map(({ vocabulary_id: id }) => id), fixture.set.items.map(({ vocabulary_id: id }) => id));
  assert.equal(result.cards.length, 2);
  assert.equal(result.cards[0].progress.revision, 2);
  assert.deepEqual(Object.keys(result.cards[0].rating_previews), ["AGAIN", "HARD", "GOOD", "EASY"]);
  assert.equal(result.cards[1].progress.status, "NEW");
  assert.equal(result.cards[1].progress.revision, 0);
  const replay = await service.createNextSession(USER_ID, PASS_ID, { ...operation(651), mode: "SRS" });
  assert.equal(replay.replayed, true);
  assert.equal(replay.cards.length, 2);
});

test("same-mode sessions resume while mixed modes coexist and expired sessions are replaced", async () => {
  const fixture = createFixture(2);
  const service = createService(fixture);
  await service.startPass(USER_ID, SET_ID, operation(660));
  const normal = await service.createNextSession(USER_ID, PASS_ID, operation(661));
  const normalResume = await service.createNextSession(USER_ID, PASS_ID, operation(662));
  assert.equal(normalResume.resumed, true);
  assert.equal(normalResume.session.id, normal.session.id);
  const srs = await service.createNextSession(USER_ID, PASS_ID, { ...operation(663), mode: "SRS" });
  assert.notEqual(srs.session.id, normal.session.id);
  const srsResume = await service.createNextSession(USER_ID, PASS_ID, { ...operation(664), mode: "SRS" });
  assert.equal(srsResume.session.id, srs.session.id);
  const pass = await service.readPass(USER_ID, PASS_ID);
  assert.equal(pass.active_sessions.NORMAL.length, 1);
  assert.equal(pass.active_sessions.SRS.length, 1);
  assert.equal(pass.active_sessions.SRS[0].exact_resume_available, true);
  fixture.passes[0].learning_sessions.find(({ id }) => id === srs.session.id).expires_at = new Date("2026-11-02T00:00:00.000Z");
  const replacement = await service.createNextSession(USER_ID, PASS_ID, { ...operation(665), mode: "SRS" });
  assert.notEqual(replacement.session.id, srs.session.id);
});

test("credited AGAIN items do not hide an independently resumable SRS queue", async () => {
  const fixture = createFixture(1);
  const service = createService(fixture);
  await service.startPass(USER_ID, SET_ID, operation(666));
  const srs = await service.createNextSession(USER_ID, PASS_ID, { ...operation(667), mode: "SRS" });
  Object.assign(fixture.passes[0].items[0], {
    first_credit_source: "SRS_AGAIN",
    first_credit_event_id: EVENT_ID,
    first_credit_session_id: srs.session.id,
    first_credit_accepted_at: NOW,
  });

  const ready = await service.createNextSession(USER_ID, PASS_ID, { ...operation(668), mode: "SRS" });
  assert.equal(ready.session, null);
  assert.equal(ready.reason, "PASS_READY_TO_COMPLETE");
  const pass = await service.readPass(USER_ID, PASS_ID);
  assert.equal(pass.active_sessions.SRS[0].contains_uncredited_items, false);
  assert.equal(pass.active_sessions.SRS[0].exact_resume_available, true);
  assert.equal(pass.active_sessions.SRS[0].unresolved_items, 1);
});

test("canonical readiness requires credits but not bounded-session completion", async () => {
  const fixture = createFixture(1);
  const service = createService(fixture);
  await service.startPass(USER_ID, SET_ID, operation(670));
  await service.createNextSession(USER_ID, PASS_ID, operation(671));
  creditSession(fixture.passes[0], fixture.passes[0].learning_sessions[0], { complete: false });
  const ready = await service.readPass(USER_ID, PASS_ID);
  assert.equal(ready.ready_to_complete, true);
  assert.equal(ready.studied_items, 1);
  assert.equal(ready.credited_items, 1);
  assert.deepEqual(ready.evidence_counts, { NORMAL: 1, SRS: 0 });
  assert.equal(ready.activity_state, "READY_TO_COMPLETE");
  assert.equal(fixture.passes[0].learning_sessions[0].status, "ACTIVE");
  const completed = await service.completePass(USER_ID, PASS_ID, operation(672));
  assert.equal(completed.pass.state, "COMPLETED");
});

test("first-credit recorder writes once and returns an authoritative ready summary", async () => {
  const fixture = createCreditFixture();
  const result = await fixture.record(fixture.normalInput());

  assert.equal(result.won_first_credit, true);
  assert.equal(result.replayed, false);
  assert.equal(result.credit.source, "NORMAL_REVEALED");
  assert.equal(result.credit.event_id, EVENT_ID);
  assert.equal(fixture.receivedTransaction(), fixture.transaction);
  assert.deepEqual(result.pass, {
    id: PASS_ID,
    state: "ACTIVE",
    snapshot_size: 1,
    credited_items: 1,
    remaining_items: 0,
    ready_to_complete: true,
  });
  assert.deepEqual(fixture.calls, ["pass", "pass-item", "conditional-write", "read-item", "read-pass"]);
});

test("existing credit wins cross-source races while an exact replay is identified", async () => {
  const fixture = createCreditFixture();
  const normal = fixture.normalInput();
  const first = await fixture.record(normal);
  const replay = await fixture.record(normal);
  const srs = fixture.srsInput();
  const loser = await fixture.record(srs);

  assert.equal(first.won_first_credit, true);
  assert.equal(replay.won_first_credit, false);
  assert.equal(replay.replayed, true);
  assert.equal(loser.won_first_credit, false);
  assert.equal(loser.replayed, false);
  assert.equal(loser.credit.source, "NORMAL_REVEALED");
  assert.equal(loser.credit.event_id, EVENT_ID);
  assert.equal(loser.pass.credited_items, 1);
  await assert.rejects(
    fixture.record({ ...normal, acceptedAt: new Date(NOW.getTime() + 1) }),
    (error) => error instanceof LearningPathServiceError && error.code === "CEFR_PASS_OPERATION_CONFLICT",
  );
});

test("inactive and ordinary sessions perform no first-credit write", async () => {
  const inactive = createCreditFixture({ status: "INVALIDATED" });
  const inactiveResult = await inactive.record(inactive.normalInput());
  assert.equal(inactiveResult.won_first_credit, false);
  assert.equal(inactiveResult.reason, "PASS_INACTIVE");
  assert.equal(inactiveResult.pass.credited_items, 0);
  assert.deepEqual(inactive.calls, ["pass"]);

  const ordinary = createCreditFixture();
  const ordinaryResult = await ordinary.record({
    ...ordinary.normalInput(),
    session: { ...ordinary.normalInput().session, cefr_learning_pass_id: null },
  });
  assert.equal(ordinaryResult.reason, "NO_CEFR_PASS");
  assert.equal(ordinaryResult.pass, null);
  assert.deepEqual(ordinary.calls, []);
});

test("foreign or misaligned first-credit identities use concealed not-found behavior", async () => {
  const foreign = createCreditFixture({ ownerId: "00000000-0000-4000-8000-000000000099" });
  await assert.rejects(
    foreign.record(foreign.normalInput()),
    (error) => error instanceof LearningPathServiceError && error.code === "CEFR_PASS_NOT_FOUND",
  );

  const mismatched = createCreditFixture();
  await assert.rejects(
    mismatched.record({
      ...mismatched.normalInput(),
      session: { ...mismatched.normalInput().session, set_id_snapshot: "00000000-0000-4000-8000-000000000098" },
    }),
    (error) => error instanceof LearningPathServiceError && error.code === "CEFR_PASS_NOT_FOUND",
  );
  assert.equal(mismatched.credit.first_credit_event_id, null);
});

test("credit, restart and completion preserve the approved lock suffixes", async () => {
  const normal = createCreditFixture({ calls: ["session", "session-item"] });
  await normal.record(normal.normalInput());
  assert.deepEqual(normal.calls.slice(0, 4), ["session", "session-item", "pass", "pass-item"]);

  const srs = createCreditFixture({ calls: ["session", "session-item", "progress"] });
  await srs.record(srs.srsInput());
  assert.deepEqual(srs.calls.slice(0, 5), ["session", "session-item", "progress", "pass", "pass-item"]);

  const restartFixture = createFixture(2);
  const restartService = createService(restartFixture);
  await restartService.startPass(USER_ID, SET_ID, operation(701));
  restartFixture.lockCalls.length = 0;
  await restartService.restartPass(USER_ID, PASS_ID, operation(702));
  assert.deepEqual(restartFixture.lockCalls, ["operation", "pass"]);

  const completionFixture = createFixture(1);
  const completionService = createService(completionFixture);
  await completionService.startPass(USER_ID, SET_ID, operation(711));
  const session = await completionService.createNextSession(USER_ID, PASS_ID, operation(712));
  resolveSession(
    completionFixture.passes[0],
    completionFixture.passes[0].learning_sessions.find(({ id }) => id === session.session.id),
  );
  completionFixture.lockCalls.length = 0;
  await completionService.completePass(USER_ID, PASS_ID, operation(713));
  assert.deepEqual(completionFixture.lockCalls, ["operation", "pass", "path"]);
});

function createService(fixture) {
  let generated = 0;
  return createLearningPathService({
    learningPathRepository: fixture.root,
    createSessionRepository: () => fixture.sessions,
    now: () => NOW,
    uuid: () => generated++ === 0
      ? PASS_ID
      : `00000000-0000-4000-8000-${String(generated + 3).padStart(12, "0")}`,
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
  const lockCalls = [];
  let pathState = null;
  const paths = {
    listCurrentCurriculum: async () => [{
      ...set,
      cefr_learning_passes: passes.filter((pass) => pass.set_id_snapshot === set.id && pass.status === "COMPLETED")
        .map((pass) => ({ id: pass.id, completed_at: pass.completed_at })),
    }],
    findRequiredSet: async (id) => id === set.id ? set : null,
    findRequiredSetForCards: async (id) => id === set.id ? toCardSet(set) : null,
    findPathState: async () => pathState,
    lockPathState: async () => { lockCalls.push("path"); return pathState; },
    upsertPathState: async (_userId, data) => { pathState = { ...pathState, user_id: USER_ID, ...data }; return pathState; },
    listActivePasses: async () => passes.filter((pass) => pass.status === "ACTIVE"),
    listActiveSetContexts: async () => [],
    findActivePass: async (_userId, id) => passes.find((pass) => pass.set_id_snapshot === id && pass.status === "ACTIVE") ?? null,
    findCompletedPass: async (_userId, id) => passes.find((pass) => pass.set_id_snapshot === id && pass.status === "COMPLETED") ?? null,
    lockPassIdentity: async () => { lockCalls.push("pass-identity"); },
    lockOperationIdentity: async () => { lockCalls.push("operation"); },
    findCreationReplay: async (_userId, op) => passes.find((pass) => pass.create_operation_id === op) ?? null,
    findCompletionReplay: async (_userId, op) => passes.find((pass) => pass.completion_event_id === op) ?? null,
    findOwnedPass: async (id) => passes.find((pass) => pass.id === id) ?? null,
    lockOwnedPass: async (id) => { lockCalls.push("pass"); return passes.find((pass) => pass.id === id) ?? null; },
    createPass: async (input) => {
      const pass = {
        id: input.id, user_id: input.user_id, set_id_snapshot: input.set_id_snapshot,
        vocabulary_set_id: input.set_id_snapshot, status: "ACTIVE",
        create_operation_id: input.create_operation_id, snapshot_size: input.items.length,
        created_at: input.created_at, completed_at: null, completion_event_id: null,
        invalidated_at: null,
        items: input.items.map((item, index) => ({
          id: `item-${index}`,
          pass_id: input.id,
          ...item,
          first_credit_source: null,
          first_credit_event_id: null,
          first_credit_session_id: null,
          first_credit_accepted_at: null,
        })),
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
  return { root, paths, sessions, passes, set, lockCalls };
}

function createCreditFixture({ status = "ACTIVE", ownerId = USER_ID, calls = [] } = {}) {
  const credit = {
    id: "pass-item-1",
    pass_id: PASS_ID,
    vocabulary_id: "10000000-0000-4000-8000-000000000001",
    position: 0,
    first_credit_source: null,
    first_credit_event_id: null,
    first_credit_session_id: null,
    first_credit_accepted_at: null,
  };
  const pass = {
    id: PASS_ID,
    user_id: ownerId,
    vocabulary_set_id: SET_ID,
    set_id_snapshot: SET_ID,
    status,
    snapshot_size: 1,
    items: [credit],
  };
  const paths = {
    async lockOwnedPass(id, userId) {
      calls.push("pass");
      return id === pass.id && userId === pass.user_id ? pass : null;
    },
    async lockPassItem(passId, vocabularyId) {
      calls.push("pass-item");
      return passId === pass.id && vocabularyId === credit.vocabulary_id ? credit : null;
    },
    async setFirstCreditIfEmpty(input) {
      calls.push("conditional-write");
      if (credit.first_credit_event_id !== null) return { count: 0 };
      Object.assign(credit, {
        first_credit_source: input.source,
        first_credit_event_id: input.eventId,
        first_credit_session_id: input.sessionId,
        first_credit_accepted_at: input.acceptedAt,
      });
      return { count: 1 };
    },
    async findPassItem() { calls.push("read-item"); return credit; },
    async findOwnedPass() { calls.push("read-pass"); return pass; },
  };
  const transaction = { marker: "caller-transaction" };
  let receivedTransaction;
  const record = createLearningPathFirstCreditRecorder({
    createLearningPathRepository: (candidate) => {
      receivedTransaction = candidate;
      return paths;
    },
  });
  const input = (mode, source, eventId, sessionId) => ({
    userId: USER_ID,
    session: {
      id: sessionId,
      user_id: USER_ID,
      vocabulary_set_id: SET_ID,
      set_id_snapshot: SET_ID,
      scope: "SET",
      mode,
      cefr_learning_pass_id: PASS_ID,
    },
    item: {
      id: `${sessionId}-item`,
      session_id: sessionId,
      vocabulary_id: credit.vocabulary_id,
    },
    source,
    eventId,
    acceptedAt: NOW,
  });
  return {
    calls,
    credit,
    transaction,
    receivedTransaction: () => receivedTransaction,
    record: (candidate) => record(transaction, candidate),
    normalInput: () => input("NORMAL", "NORMAL_REVEALED", EVENT_ID, SESSION_ID),
    srsInput: () => input("SRS", "SRS_GOOD", OTHER_EVENT_ID, "00000000-0000-4000-8000-000000000008"),
  };
}

function resolveSession(pass, session) {
  creditSession(pass, session);
}

function creditSession(pass, session, { complete = true } = {}) {
  if (complete) {
    session.status = "COMPLETED";
    session.completed_at = NOW;
  }
  session.items.forEach((item) => {
    const eventId = operation(900 + item.position).operation_id;
    item.evidence = "NORMAL_REVEALED";
    item.evidence_event_id = eventId;
    item.evidence_at = NOW;
    const passItem = pass.items.find(({ vocabulary_id: id }) => id === item.vocabulary_id);
    Object.assign(passItem, {
      first_credit_source: session.mode === "SRS" ? "SRS_GOOD" : "NORMAL_REVEALED",
      first_credit_event_id: eventId,
      first_credit_session_id: session.id,
      first_credit_accepted_at: NOW,
    });
  });
}

function toCardSet(set) {
  return {
    id: set.id,
    items: set.items.map((item) => ({
      position: item.position,
      vocabulary: {
        id: item.vocabulary_id,
        word: `word-${item.position}`,
        phonetic: null,
        pronunciation_url: null,
        meanings: [],
        learning_progress: item.progress ? [item.progress] : [],
      },
    })),
  };
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
