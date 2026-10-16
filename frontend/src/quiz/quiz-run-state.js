import { advanceOrderedSessionBatch, completeOrderedSessionBatch, createOrderedSessionRun, currentOrderedSessionBatch, reconcileOrderedSessionRun } from "../session-storage/ordered-session-run.js";
import { clearSessionNamespace, readSessionValue, writeSessionValue } from "../session-storage/resilient-session-store.js";

const STORAGE_PREFIX = "elvocab.quiz.run.v2:";
const ACTIVE_PREFIX = "elvocab.quiz.active.v2:";
const LEGACY_PREFIXES = ["elvocab.quiz.run.v1:", "elvocab.quiz.active.v1:"];
const VERSION = 2;
const QUIZ_TYPES = new Set(["MULTIPLE_CHOICE"]);

export function createQuizRunState(userId, setId, quizType, vocabularyIds = null, createRunId = defaultRunId) {
  requireIdentity(userId, setId, quizType);
  if (typeof vocabularyIds === "function") {
    createRunId = vocabularyIds;
    vocabularyIds = null;
  }
  const initialized = Array.isArray(vocabularyIds);
  const orderedRun = createOrderedSessionRun(initialized ? vocabularyIds : []);
  return { version: VERSION, user_id: userId, set_id: setId, quiz_type: quizType,
    session_initialized: initialized, ordered_run: orderedRun, run_id: createRunId(),
    current_vocabulary_id: orderedRun.current_vocabulary_id, questions: [], accepted: {},
    pending_attempt: null, completed_result: null, request_state: "idle", error_code: null };
}

export function reconcileQuizMembership(state, authorizedVocabularyIds) {
  requireStateIdentity(state);
  let orderedRun = state.session_initialized
    ? reconcileOrderedSessionRun(state.ordered_run, authorizedVocabularyIds)
    : createOrderedSessionRun(authorizedVocabularyIds);
  const activeIds = currentOrderedSessionBatch(orderedRun);
  const active = new Set(activeIds);
  const questions = state.questions.filter(({ vocabulary_id: id }) => active.has(id));
  const accepted = Object.fromEntries(Object.entries(state.accepted)
    .filter(([id, result]) => active.has(id) && isAcceptedResult(result)));
  if (orderedRun.batch_status === "ACTIVE" && activeIds.length > 0
    && activeIds.every((id) => accepted[id])) orderedRun = completeOrderedSessionBatch(orderedRun);
  const pendingAttempt = orderedRun.batch_status === "ACTIVE" && isPendingAttempt(state.pending_attempt, state)
    && active.has(state.pending_attempt.vocabulary_id) ? state.pending_attempt : null;
  const currentId = active.has(state.current_vocabulary_id) && !accepted[state.current_vocabulary_id]
    ? state.current_vocabulary_id : firstUnacceptedId(activeIds, accepted);
  return { ...state, session_initialized: true, ordered_run: orderedRun,
    current_vocabulary_id: orderedRun.batch_status === "ACTIVE" ? currentId : null,
    questions, accepted, pending_attempt: pendingAttempt,
    completed_result: orderedRun.batch_status === "COMPLETED"
      ? state.completed_result ?? resultSummary(activeIds, accepted)
      : null };
}

export function currentQuizBatchIds(state) {
  requireStateIdentity(state);
  return currentOrderedSessionBatch(state.ordered_run);
}

export function reconcileQuizRunState(stored, userId, payload) {
  const storedMatchesIdentity = isStoredState(stored, userId, payload.id, payload.quiz_type, stored?.run_id);
  const legacyUnboundedLoad = !storedMatchesIdentity || !stored.session_initialized;
  const questionPayload = legacyUnboundedLoad ? payload.questions.slice(0, 10) : payload.questions;
  const payloadIds = questionPayload.map(({ vocabulary_id: id }) => id);
  if (storedMatchesIdentity && stored.run_id !== payload.run_id) {
    throw new TypeError("Quiz question response belongs to a stale run.");
  }
  let base = isStoredState(stored, userId, payload.id, payload.quiz_type, payload.run_id)
    ? stored : createQuizRunState(userId, payload.id, payload.quiz_type, payloadIds, () => payload.run_id);
  if (!base.session_initialized) base = reconcileQuizMembership(base, payloadIds);
  if (payload.run_id !== base.run_id || !sameOrderedIds(payloadIds, currentQuizBatchIds(base))) {
    throw new TypeError("Quiz question response does not match the active batch.");
  }
  const questions = questionPayload.map(toStoredQuestion);
  const revisionById = new Map(questions.map((question) => [question.vocabulary_id, question.question_revision]));
  const payloadQuestionById = new Map(questionPayload.map((question) => [question.vocabulary_id, question]));
  const accepted = {};
  for (const [vocabularyId, result] of Object.entries(base.accepted)) {
    if (isAcceptedResult(result) && revisionById.get(vocabularyId) === result.question_revision) accepted[vocabularyId] = result;
  }
  const pendingQuestion = payloadQuestionById.get(base.pending_attempt?.vocabulary_id);
  const pendingAttempt = isPendingAttempt(base.pending_attempt, base) && pendingQuestion
    && pendingQuestion.question_revision === base.pending_attempt.question_revision
    && pendingQuestion.progress.revision === base.pending_attempt.expected_revision
    && pendingQuestion.choices.some(({ choice_id: choiceId }) => choiceId === base.pending_attempt.selected_choice_id)
    ? base.pending_attempt : null;
  const validCurrent = revisionById.has(base.current_vocabulary_id) && !accepted[base.current_vocabulary_id];
  return { ...base, current_vocabulary_id: validCurrent ? base.current_vocabulary_id : firstUnacceptedId(payloadIds, accepted),
    questions, accepted, pending_attempt: pendingAttempt, request_state: "ready", error_code: null };
}

export function beginQuizAnswer(state, vocabularyId, selectedChoiceId, createEventId = defaultRunId) {
  const question = state.questions.find((item) => item.vocabulary_id === vocabularyId);
  if (!question || state.accepted[vocabularyId] || state.pending_attempt || state.ordered_run.batch_status !== "ACTIVE") return state;
  return { ...state, pending_attempt: { event_id: createEventId(), set_id: state.set_id, vocabulary_id: vocabularyId,
    run_id: state.run_id, question_revision: question.question_revision, quiz_type: state.quiz_type,
    expected_revision: question.progress_revision, selected_choice_id: selectedChoiceId },
  request_state: "submitting", error_code: null };
}

export function acceptQuizAnswer(state, result) {
  const attempt = state.pending_attempt;
  if (!attempt || result.run_id !== state.run_id || result.vocabulary_id !== attempt.vocabulary_id) return state;
  const accepted = { ...state.accepted, [attempt.vocabulary_id]: { question_revision: attempt.question_revision,
    is_correct: result.is_correct, progress_revision: result.progress.revision } };
  const batchIds = currentQuizBatchIds(state);
  const completed = batchIds.length > 0 && batchIds.every((id) => accepted[id]);
  const orderedRun = completed ? completeOrderedSessionBatch(state.ordered_run) : state.ordered_run;
  return { ...state, ordered_run: orderedRun, accepted, pending_attempt: null,
    current_vocabulary_id: completed ? null : firstUnacceptedId(batchIds, accepted),
    completed_result: completed ? resultSummary(batchIds, accepted) : null,
    request_state: "ready", error_code: null };
}

export function failQuizAnswer(state, errorCode, { conclusive = false } = {}) {
  return { ...state, pending_attempt: conclusive ? null : state.pending_attempt,
    request_state: errorCode?.includes("CONFLICT") || errorCode === "QUIZ_QUESTION_CHANGED" ? "conflict" : "error",
    error_code: errorCode ?? "QUIZ_REQUEST_FAILED" };
}

export function continueQuizRun(state, createRunId = defaultRunId) {
  if (state.ordered_run.batch_status !== "COMPLETED" || state.ordered_run.run_status !== "ACTIVE") return state;
  return resetCurrentQuizRun(state, advanceOrderedSessionBatch(state.ordered_run), createRunId());
}

export function retryQuizBatch(state, createRunId = defaultRunId) {
  if (state.ordered_run.batch_status !== "COMPLETED") return state;
  const batch = currentQuizBatchIds(state);
  if (batch.length === 0) return state;
  return resetCurrentQuizRun(state, { ...state.ordered_run, current_vocabulary_id: batch[0],
    batch_status: "ACTIVE", run_status: "ACTIVE" }, createRunId());
}

export function restartQuizRun(state, vocabularyIds = null, createRunId = defaultRunId) {
  if (typeof vocabularyIds === "function") {
    createRunId = vocabularyIds;
    vocabularyIds = null;
  }
  return createQuizRunState(state.user_id, state.set_id, state.quiz_type, vocabularyIds, createRunId);
}

export function summarizeQuizRun(state) {
  const batchIds = currentQuizBatchIds(state);
  const result = state.completed_result ?? resultSummary(batchIds, state.accepted);
  const nextBatch = state.ordered_run.batches
    .slice((state.ordered_run.active_batch_index ?? -1) + 1)
    .find((batch) => batch.length > 0) ?? [];
  return { ...result, completed: state.ordered_run.batch_status === "COMPLETED",
    full_run_completed: state.ordered_run.run_status === "COMPLETED", next_batch_size: nextBatch.length };
}

export function loadQuizRunState(storage, userId, setId, quizType) {
  const active = readSessionValue(storage, activeStorageKey(userId, setId, quizType),
    (value) => value && typeof value === "object" && typeof value.run_id === "string");
  if (!active) return null;
  return readSessionValue(storage, runStorageKey(userId, setId, quizType, active.run_id),
    (value) => isStoredState(value, userId, setId, quizType, active.run_id));
}

export function saveQuizRunState(storage, state) {
  if (!isStoredState(state, state?.user_id, state?.set_id, state?.quiz_type, state?.run_id)) return false;
  const runSaved = writeSessionValue(storage, runStorageKey(state.user_id, state.set_id, state.quiz_type, state.run_id), state);
  const activeSaved = writeSessionValue(storage, activeStorageKey(state.user_id, state.set_id, state.quiz_type), { run_id: state.run_id });
  return runSaved && activeSaved;
}

export function clearQuizRunStateNamespace(storage) {
  clearSessionNamespace(storage, [STORAGE_PREFIX, ACTIVE_PREFIX, ...LEGACY_PREFIXES]);
}

function resetCurrentQuizRun(state, orderedRun, runId) {
  return { ...state, ordered_run: orderedRun, run_id: runId, current_vocabulary_id: orderedRun.current_vocabulary_id,
    questions: [], accepted: {}, pending_attempt: null, completed_result: null, request_state: "idle", error_code: null };
}
function toStoredQuestion(question) { return { vocabulary_id: question.vocabulary_id, position: question.position,
  question_revision: question.question_revision, progress_revision: question.progress.revision }; }
function resultSummary(batchIds, accepted) {
  const results = batchIds.map((id) => accepted[id]).filter(isAcceptedResult);
  return { total: batchIds.length, answered: results.length, correct: results.filter((result) => result.is_correct).length,
    incorrect: results.filter((result) => !result.is_correct).length };
}
function firstUnacceptedId(ids, accepted) { return ids.find((id) => !accepted[id]) ?? null; }
function isAcceptedResult(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value)
  && typeof value.question_revision === "string" && typeof value.is_correct === "boolean"
  && Number.isSafeInteger(value.progress_revision)); }
function isPendingAttempt(value, state) { return Boolean(value && typeof value === "object" && !Array.isArray(value)
  && typeof value.event_id === "string" && value.event_id.length > 0 && value.set_id === state.set_id
  && typeof value.vocabulary_id === "string" && value.run_id === state.run_id
  && typeof value.question_revision === "string" && value.quiz_type === state.quiz_type
  && Number.isSafeInteger(value.expected_revision) && value.expected_revision >= 0
  && typeof value.selected_choice_id === "string" && value.selected_choice_id.length > 0); }
function isStoredState(value, userId, setId, quizType, runId) {
  try { return Boolean(value && typeof value === "object" && !Array.isArray(value) && value.version === VERSION
    && value.user_id === userId && value.set_id === setId && value.quiz_type === quizType && value.run_id === runId
    && typeof value.session_initialized === "boolean" && Array.isArray(value.questions)
    && value.accepted && typeof value.accepted === "object" && !Array.isArray(value.accepted)
    && currentOrderedSessionBatch(value.ordered_run)
    && (!value.pending_attempt || isPendingAttempt(value.pending_attempt, value))); } catch { return false; }
}
function requireStateIdentity(state) { requireIdentity(state?.user_id, state?.set_id, state?.quiz_type); }
function requireIdentity(userId, setId, quizType) { if (!userId || !setId || !QUIZ_TYPES.has(quizType)) throw new TypeError("Quiz run identity is invalid."); }
function sameOrderedIds(left, right) { return left.length === right.length && left.every((id, index) => id === right[index]); }
function activeStorageKey(userId, setId, quizType) { return `${ACTIVE_PREFIX}${encodeURIComponent(userId)}:${encodeURIComponent(setId)}:${quizType}`; }
function runStorageKey(userId, setId, quizType, runId) { return `${STORAGE_PREFIX}${encodeURIComponent(userId)}:${encodeURIComponent(setId)}:${quizType}:${encodeURIComponent(runId)}`; }
function defaultRunId() { return crypto.randomUUID(); }
