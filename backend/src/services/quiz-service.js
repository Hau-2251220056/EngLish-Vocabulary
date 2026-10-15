// @ts-nocheck
import { buildMultipleChoiceQuestion } from "./quiz-domain.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QUESTION_QUERY_FIELDS = new Set(["type", "run_id"]);
const ANSWER_FIELDS = new Set(["event_id", "set_id", "vocabulary_id", "run_id", "question_revision", "quiz_type", "expected_revision", "selected_choice_id"]);
const QUIZ_TYPE = "MULTIPLE_CHOICE";

export class QuizServiceError extends Error {
  constructor(code, message) { super(message); this.name = "QuizServiceError"; this.code = code; }
}

export function createQuizService({ quizRepository }) {
  return {
    async getQuestions(userId, setId, input) {
      validateUuid(userId); validateUuid(setId);
      const query = validateQuestionQuery(input);
      const set = await quizRepository.findAccessibleSetForUser(setId, userId);
      if (!set) throw serviceError("QUIZ_SET_NOT_FOUND", "Quiz set was not found.");
      if (!set.items.length) throw serviceError("QUIZ_SET_EMPTY", "Quiz set has no vocabulary to practice.");
      const external = await quizRepository.findCanonicalDistractorCandidates(set.items.map((item) => item.vocabulary.id));
      const questions = buildQuestions(set, external, query.run_id);
      return { id: set.id, name: set.name, quiz_type: QUIZ_TYPE, run_id: query.run_id, questions };
    },

    async recordAnswer(userId, input) {
      validateUuid(userId);
      const answer = validateAnswerInput(input);
      const execute = () => quizRepository.withTransaction((repository) => recordAnswerInTransaction(repository, userId, answer));
      try { return await execute(); } catch (error) {
        if (error?.code !== "P2002" && error?.code !== "P2034") throw error;
        try { return await execute(); } catch (retryError) {
          if (retryError?.code === "P2002" || retryError?.code === "P2034") throw progressConflictError();
          throw retryError;
        }
      }
    },
  };
}

function buildQuestions(set, external, runId) {
  const setCandidates = set.items.map(({ vocabulary }) => vocabulary);
  return set.items.map((item) => {
    let built;
    try { built = buildMultipleChoiceQuestion({ runId, setId: set.id, item, setCandidates, canonicalCandidates: external }); }
    catch (error) { if (error instanceof TypeError) throw questionUnavailableError(); throw error; }
    if (!built) throw choicesUnavailableError();
    const progress = item.vocabulary.learning_progress?.[0];
    return { ...built.question, progress: progressProjection(progress) };
  });
}

async function recordAnswerInTransaction(repository, userId, answer) {
  const lockedSet = await repository.lockAccessibleSetForUser(answer.set_id, userId);
  if (!lockedSet) throw serviceError("QUIZ_SET_NOT_FOUND", "Quiz set was not found.");
  const lockedItem = await repository.lockQuestionItem(answer.set_id, answer.vocabulary_id);
  if (!lockedItem) throw questionUnavailableError();
  const set = await repository.findAccessibleSetForUser(answer.set_id, userId);
  if (!set) throw serviceError("QUIZ_SET_NOT_FOUND", "Quiz set was not found.");
  const item = set.items.find(({ vocabulary }) => vocabulary.id === answer.vocabulary_id);
  if (!item) throw questionUnavailableError();
  const external = await repository.findCanonicalDistractorCandidates(set.items.map(({ vocabulary }) => vocabulary.id));
  let built;
  try { built = buildMultipleChoiceQuestion({
    runId: answer.run_id, setId: set.id, item,
    setCandidates: set.items.map(({ vocabulary }) => vocabulary), canonicalCandidates: external,
  }); } catch (error) { if (error instanceof TypeError) throw questionUnavailableError(); throw error; }
  if (!built) throw choicesUnavailableError();
  if (built.question.question_revision !== answer.question_revision) throw questionChangedError();
  if (!built.choiceIds.has(answer.selected_choice_id)) throw choiceChangedError();

  const isCorrect = answer.selected_choice_id === built.correctChoiceId;
  const targetStatus = isCorrect ? "LEARNED" : "LEARNING";
  const current = await repository.findProgress(userId, answer.vocabulary_id);
  if (current?.last_event_id === answer.event_id) {
    if (!isCompatibleRetry(current, targetStatus, answer.expected_revision)) throw retryConflictError();
    return toAnswerResult(answer, built.correctChoiceId, isCorrect, current);
  }

  const reviewedAt = new Date();
  let progress;
  if (!current) {
    if (answer.expected_revision !== 0) throw progressConflictError();
    progress = await repository.createProgress({ user_id: userId, vocabulary_id: answer.vocabulary_id,
      status: targetStatus, review_count: 1, revision: 1, last_reviewed_at: reviewedAt, last_event_id: answer.event_id });
  } else {
    if (current.revision !== answer.expected_revision) throw progressConflictError();
    const updated = await repository.updateProgressAtRevision(current.id, answer.expected_revision, {
      status: targetStatus, review_count: { increment: 1 }, revision: { increment: 1 },
      last_reviewed_at: reviewedAt, last_event_id: answer.event_id,
    });
    progress = await repository.findProgress(userId, answer.vocabulary_id);
    if (updated.count === 0 || !progress) {
      if (progress?.last_event_id === answer.event_id) {
        if (!isCompatibleRetry(progress, targetStatus, answer.expected_revision)) throw retryConflictError();
      } else throw progressConflictError();
    }
  }
  return toAnswerResult(answer, built.correctChoiceId, isCorrect, progress);
}

function isCompatibleRetry(progress, status, expectedRevision) {
  return progress.status === status && progress.revision === expectedRevision + 1;
}
function toAnswerResult(answer, correctChoiceId, isCorrect, progress) {
  return { set_id: answer.set_id, vocabulary_id: answer.vocabulary_id, run_id: answer.run_id,
    quiz_type: QUIZ_TYPE, is_correct: isCorrect, selected_choice_id: answer.selected_choice_id,
    correct_choice_id: correctChoiceId, progress: progressProjection(progress) };
}
function progressProjection(progress) {
  return progress ? { status: progress.status, review_count: progress.review_count, revision: progress.revision,
    last_reviewed_at: progress.last_reviewed_at } : { status: "NEW", review_count: 0, revision: 0, last_reviewed_at: null };
}

function validateQuestionQuery(input) {
  if (!exactFields(input, QUESTION_QUERY_FIELDS) || input.type !== QUIZ_TYPE) throw validationError();
  validateUuid(input.run_id); return { run_id: input.run_id };
}
function validateAnswerInput(input) {
  if (!exactFields(input, ANSWER_FIELDS)) throw validationError();
  for (const field of ["event_id", "set_id", "vocabulary_id", "run_id"]) validateUuid(input[field]);
  if (input.quiz_type !== QUIZ_TYPE || typeof input.question_revision !== "string"
    || !/^[A-Za-z0-9_-]{43}$/.test(input.question_revision)
    || typeof input.selected_choice_id !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(input.selected_choice_id)
    || !Number.isSafeInteger(input.expected_revision) || input.expected_revision < 0) throw validationError();
  return { ...input };
}
function exactFields(input, allowed) {
  return input && typeof input === "object" && !Array.isArray(input)
    && Object.keys(input).length === allowed.size
    && Object.keys(input).every((field) => allowed.has(field))
    && [...allowed].every((field) => Object.hasOwn(input, field));
}
function validateUuid(value) { if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw validationError(); }
function serviceError(code, message) { return new QuizServiceError(code, message); }
function validationError() { return serviceError("QUIZ_VALIDATION_ERROR", "Quiz request data is invalid."); }
function questionUnavailableError() { return serviceError("QUIZ_ITEM_CHANGED", "Quiz vocabulary is no longer available. Refresh before trying again."); }
function choicesUnavailableError() { return serviceError("QUIZ_CHOICES_UNAVAILABLE", "Four distinct Quiz choices are not currently available."); }
function questionChangedError() { return serviceError("QUIZ_QUESTION_CHANGED", "Quiz question changed. Refresh before trying again."); }
function choiceChangedError() { return serviceError("QUIZ_CHOICE_CHANGED", "Quiz choice changed. Refresh before trying again."); }
function retryConflictError() { return serviceError("QUIZ_RETRY_CONFLICT", "Quiz answer retry conflicts with current progress."); }
function progressConflictError() { return serviceError("QUIZ_PROGRESS_CONFLICT", "Learning progress changed. Refresh before trying again."); }
