const STORAGE_PREFIX = "elvocab.quiz.run.v1:";
const ACTIVE_PREFIX = "elvocab.quiz.active.v1:";
const QUIZ_TYPES = new Set(["VI_TO_ENGLISH", "UNSCRAMBLE_WORD"]);

export function createQuizRunState(userId, setId, quizType, createRunId = defaultRunId) {
  requireIdentity(userId, setId, quizType);
  return {
    version: 1,
    user_id: userId,
    set_id: setId,
    quiz_type: quizType,
    run_id: createRunId(),
    current_vocabulary_id: null,
    questions: [],
    accepted: {},
    pending_attempt: null,
    request_state: "idle",
    error_code: null,
  };
}

export function reconcileQuizRunState(stored, userId, payload) {
  const base = isStoredState(stored, userId, payload.id, payload.quiz_type, payload.run_id)
    ? stored
    : {
        ...createQuizRunState(userId, payload.id, payload.quiz_type, () => payload.run_id),
      };
  const questions = payload.questions.map(toStoredQuestion);
  const revisionById = new Map(
    questions.map((question) => [question.vocabulary_id, question.question_revision]),
  );
  const accepted = {};
  for (const [vocabularyId, result] of Object.entries(base.accepted ?? {})) {
    if (
      isAcceptedResult(result) &&
      revisionById.get(vocabularyId) === result.question_revision
    ) {
      accepted[vocabularyId] = result;
    }
  }
  const pendingAttempt = isPendingAttempt(base.pending_attempt) &&
    revisionById.get(base.pending_attempt.vocabulary_id) === base.pending_attempt.question_revision
    ? base.pending_attempt
    : null;
  const validCurrent =
    revisionById.has(base.current_vocabulary_id) &&
    !accepted[base.current_vocabulary_id];

  return {
    ...base,
    current_vocabulary_id: validCurrent
      ? base.current_vocabulary_id
      : firstUnacceptedQuestionId(questions, accepted),
    questions,
    accepted,
    pending_attempt: pendingAttempt,
    request_state: "ready",
    error_code: null,
  };
}

export function beginQuizAnswer(state, vocabularyId, answer, createEventId = defaultRunId) {
  const question = state.questions.find((item) => item.vocabulary_id === vocabularyId);
  if (!question || state.accepted[vocabularyId] || state.pending_attempt) return state;
  return {
    ...state,
    pending_attempt: {
      event_id: createEventId(),
      set_id: state.set_id,
      vocabulary_id: vocabularyId,
      run_id: state.run_id,
      question_revision: question.question_revision,
      quiz_type: state.quiz_type,
      expected_revision: question.progress_revision,
      answer,
    },
    request_state: "submitting",
    error_code: null,
  };
}

export function acceptQuizAnswer(state, result) {
  const attempt = state.pending_attempt;
  if (!attempt || result.vocabulary_id !== attempt.vocabulary_id) return state;
  const accepted = {
    ...state.accepted,
    [attempt.vocabulary_id]: {
      question_revision: attempt.question_revision,
      is_correct: result.is_correct,
      progress_revision: result.progress.revision,
    },
  };
  return {
    ...state,
    accepted,
    pending_attempt: null,
    current_vocabulary_id: firstUnacceptedQuestionId(state.questions, accepted),
    request_state: "ready",
    error_code: null,
  };
}

export function failQuizAnswer(state, errorCode, { conclusive = false } = {}) {
  return {
    ...state,
    pending_attempt: conclusive ? null : state.pending_attempt,
    request_state: errorCode?.includes("CONFLICT") || errorCode === "QUIZ_QUESTION_CHANGED"
      ? "conflict"
      : "error",
    error_code: errorCode ?? "QUIZ_REQUEST_FAILED",
  };
}

export function summarizeQuizRun(state) {
  const accepted = Object.values(state.accepted).filter(isAcceptedResult);
  return {
    total: state.questions.length,
    answered: accepted.length,
    correct: accepted.filter((result) => result.is_correct).length,
    incorrect: accepted.filter((result) => !result.is_correct).length,
    completed: state.questions.length > 0 && accepted.length === state.questions.length,
  };
}

export function restartQuizRun(state, createRunId = defaultRunId) {
  return createQuizRunState(state.user_id, state.set_id, state.quiz_type, createRunId);
}

export function loadQuizRunState(storage, userId, setId, quizType) {
  try {
    const activeKey = activeStorageKey(userId, setId, quizType);
    const runId = storage.getItem(activeKey);
    if (!runId) return null;
    const raw = storage.getItem(runStorageKey(userId, setId, quizType, runId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveQuizRunState(storage, state) {
  try {
    storage.setItem(
      runStorageKey(state.user_id, state.set_id, state.quiz_type, state.run_id),
      JSON.stringify(state),
    );
    storage.setItem(
      activeStorageKey(state.user_id, state.set_id, state.quiz_type),
      state.run_id,
    );
    return true;
  } catch {
    return false;
  }
}

export function clearQuizRunStateNamespace(storage) {
  try {
    const keys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(STORAGE_PREFIX) || key?.startsWith(ACTIVE_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => storage.removeItem(key));
  } catch {
    // Quiz-owned storage cleanup must not break authentication transitions.
  }
}

function toStoredQuestion(question) {
  return {
    vocabulary_id: question.vocabulary_id,
    position: question.position,
    question_revision: question.question_revision,
    progress_revision: question.progress.revision,
  };
}

function firstUnacceptedQuestionId(questions, accepted) {
  return questions.find((question) => !accepted[question.vocabulary_id])?.vocabulary_id ?? null;
}

function isAcceptedResult(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof value.question_revision === "string" &&
      typeof value.is_correct === "boolean" &&
      Number.isSafeInteger(value.progress_revision),
  );
}

function isPendingAttempt(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof value.event_id === "string" &&
      typeof value.vocabulary_id === "string" &&
      typeof value.question_revision === "string" &&
      typeof value.answer === "string",
  );
}

function isStoredState(value, userId, setId, quizType, runId) {
  return Boolean(
    value &&
      typeof value === "object" &&
      value.version === 1 &&
      value.user_id === userId &&
      value.set_id === setId &&
      value.quiz_type === quizType &&
      value.run_id === runId &&
      Array.isArray(value.questions) &&
      value.accepted &&
      typeof value.accepted === "object",
  );
}

function requireIdentity(userId, setId, quizType) {
  if (!userId || !setId || !QUIZ_TYPES.has(quizType)) {
    throw new TypeError("Quiz run identity is invalid.");
  }
}

function activeStorageKey(userId, setId, quizType) {
  return `${ACTIVE_PREFIX}${encodeURIComponent(userId)}:${encodeURIComponent(setId)}:${quizType}`;
}

function runStorageKey(userId, setId, quizType, runId) {
  return `${STORAGE_PREFIX}${encodeURIComponent(userId)}:${encodeURIComponent(setId)}:${quizType}:${encodeURIComponent(runId)}`;
}

function defaultRunId() {
  return crypto.randomUUID();
}
