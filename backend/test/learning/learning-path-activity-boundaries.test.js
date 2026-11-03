import assert from "node:assert/strict";
import test from "node:test";
import { createLearningSessionService } from "../../src/services/learning-session-service.js";
import { createLearningService } from "../../src/services/learning-service.js";
import { createQuizService } from "../../src/services/quiz-service.js";

const USER = "10000000-0000-4000-8000-000000000001";
const SET = "10000000-0000-4000-8000-000000000002";
const SESSION = "10000000-0000-4000-8000-000000000003";
const VOCAB = "10000000-0000-4000-8000-000000000004";
const EVENT = "10000000-0000-4000-8000-000000000005";
const NOW = new Date("2026-11-03T00:00:00.000Z");

test("NORMAL/SRS/QUIZ session creation authorizes before replay or creation", async () => {
  for (const mode of ["NORMAL", "SRS", "QUIZ"]) {
    let repositoryTouched = false;
    const service = createLearningSessionService({
      withTransaction: (callback) => callback({ marker: mode }),
      createSessionRepository: () => ({ findCreationReplay: async () => { repositoryTouched = true; } }),
      createLearningRepository: () => ({}),
      createStreakRepository: () => ({}),
      authorizeSetActivity: deniedAuthorization,
    });
    const input = { operation_id: EVENT, set_id: SET, mode, ...(mode === "SRS" ? {} : { vocabulary_ids: [VOCAB] }) };
    await assert.rejects(service.createSession(USER, input), hasLockedCode);
    assert.equal(repositoryTouched, false);
  }
});

test("session read, NORMAL reveal, and bounded completion authorize before protected work", async () => {
  const session = sessionRecord("NORMAL");
  let protectedWork = 0;
  const sessions = {
    findOwnedSession: async () => session,
    lockOwnedSession: async () => session,
    lockSessionItem: async () => { protectedWork += 1; },
  };
  const service = createLearningSessionService({
    withTransaction: (callback) => callback({}),
    createSessionRepository: () => sessions,
    createLearningRepository: () => ({ findAccessibleSetForUser: async () => { protectedWork += 1; } }),
    createStreakRepository: () => ({ listActivityDatesThrough: async () => [] }),
    authorizeSetActivity: deniedAuthorization,
  });
  await assert.rejects(service.readSession(USER, SESSION), hasLockedCode);
  await assert.rejects(service.acknowledgeNormalReveal(USER, SESSION, VOCAB, { operation_id: EVENT }), hasLockedCode);
  await assert.rejects(service.completeNormalSession(USER, SESSION, { operation_id: EVENT }), hasLockedCode);
  assert.equal(protectedWork, 0);
});

test("Learning NORMAL/SRS reads and sessionless SRS mutation use transaction authorization", async () => {
  for (const mode of ["NORMAL", "SRS"]) {
    let projected = false;
    const repository = {
      withTransaction: (callback) => callback({
        findAccessibleSetForUser: async () => ({ id: SET, items: [], topic: null }),
      }, { mode }),
    };
    const service = createLearningService({
      learningRepository: repository,
      authorizeSetActivity: async (transaction) => {
        assert.equal(transaction.mode, mode);
        throw lockedError();
      },
    });
    await assert.rejects(service.getLearningSet(USER, SET, { mode }), hasLockedCode);
    assert.equal(projected, false);
  }

  let mutationTouched = false;
  const repository = {
    withTransaction: (callback) => callback({
      lockAccessibleSetForUser: async () => ({ id: SET }),
      lockSetItem: async () => { mutationTouched = true; },
    }, { kind: "srs-event" }),
  };
  const service = createLearningService({ learningRepository: repository, authorizeSetActivity: deniedAuthorization });
  await assert.rejects(service.recordMeaningfulEvent(USER, {
    event_id: EVENT, set_id: SET, vocabulary_id: VOCAB, expected_revision: 0, rating: "GOOD",
  }), hasLockedCode);
  assert.equal(mutationTouched, false);
});

test("Quiz read and sessionless answer authorize before question/progress mutation", async () => {
  let protectedWork = 0;
  const repository = {
    withTransaction: (callback) => callback({
      findAccessibleSetForUser: async () => ({ id: SET, name: "Set", items: [] }),
      lockAccessibleSetForUser: async () => ({ id: SET }),
      lockQuestionItem: async () => { protectedWork += 1; },
    }, { kind: "quiz" }),
  };
  const service = createQuizService({ quizRepository: repository, authorizeSetActivity: deniedAuthorization });
  await assert.rejects(service.getQuestions(USER, SET, {
    type: "MULTIPLE_CHOICE", run_id: SESSION,
  }), hasLockedCode);
  await assert.rejects(service.recordAnswer(USER, {
    event_id: EVENT, set_id: SET, vocabulary_id: VOCAB, run_id: SESSION,
    question_revision: "a".repeat(43), quiz_type: "MULTIPLE_CHOICE",
    expected_revision: 0, selected_choice_id: "b".repeat(43),
  }), hasLockedCode);
  assert.equal(protectedWork, 0);
});

test("session-aware SRS and Quiz paths deny before evidence, Progress, XP, or Streak mutation", async () => {
  let mutationTouched = false;
  const srsSession = sessionRecord("SRS");
  const learningRepository = {
    withTransaction: (callback) => callback({}, { kind: "srs-session" }),
  };
  const learning = createLearningService({
    learningRepository,
    createSessionRepository: () => ({
      lockOwnedSession: async () => srsSession,
      lockSessionItems: async () => { mutationTouched = true; return srsSession.items; },
    }),
    createStreakRepository: () => ({}),
    authorizeSetActivity: deniedAuthorization,
  });
  await assert.rejects(learning.recordMeaningfulEvent(USER, {
    event_id: EVENT, set_id: SET, vocabulary_id: VOCAB, expected_revision: 0,
    rating: "GOOD", session_id: SESSION,
  }), hasLockedCode);

  const quizSession = sessionRecord("QUIZ");
  const quizRepository = {
    withTransaction: (callback) => callback({
      lockAccessibleSetForUser: async () => ({ id: SET }),
    }, { kind: "quiz-session" }),
  };
  const quiz = createQuizService({
    quizRepository,
    createSessionRepository: () => ({
      lockOwnedSession: async () => quizSession,
      lockSessionItems: async () => quizSession.items,
      findEvidenceReplay: async () => null,
      recordEvidence: async () => { mutationTouched = true; },
    }),
    createStreakRepository: () => ({}),
    authorizeSetActivity: deniedAuthorization,
    now: () => NOW,
  });
  await assert.rejects(quiz.getQuestions(USER, SET, {
    type: "MULTIPLE_CHOICE", run_id: SESSION, session_id: SESSION,
  }), hasLockedCode);
  await assert.rejects(quiz.recordAnswer(USER, {
    event_id: EVENT, set_id: SET, vocabulary_id: VOCAB, run_id: SESSION,
    session_id: SESSION, question_revision: "a".repeat(43), quiz_type: "MULTIPLE_CHOICE",
    expected_revision: 0, selected_choice_id: "b".repeat(43),
  }), hasLockedCode);
  assert.equal(mutationTouched, false);
});

function deniedAuthorization(transaction, userId, setId) {
  assert.ok(transaction);
  assert.equal(userId, USER);
  assert.equal(setId, SET);
  throw lockedError();
}

function lockedError() { return Object.assign(new Error("Locked."), { code: "CEFR_LEVEL_LOCKED" }); }
function hasLockedCode(error) { return error?.code === "CEFR_LEVEL_LOCKED"; }

function sessionRecord(mode) {
  return {
    id: SESSION, user_id: USER, vocabulary_set_id: SET, set_id_snapshot: SET,
    mode, status: "ACTIVE", snapshot_size: 1, created_at: NOW,
    expires_at: new Date("2026-11-10T00:00:00.000Z"), completed_at: null,
    completion_event_id: null,
    items: [{ id: "item", session_id: SESSION, vocabulary_id: VOCAB, position: 0, evidence: null, evidence_event_id: null, evidence_at: null }],
  };
}
