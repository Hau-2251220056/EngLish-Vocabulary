// @ts-nocheck
import { buildMultipleChoiceQuestion } from "./quiz-domain.js";
import {
  XP_REWARD_TYPES,
  deriveQuizRewardCandidate,
  projectXpLevel,
} from "./xp-level-service.js";
import { isXpRewardCollisionError } from "../repositories/xp-reward-repository.js";
import { assertSnapshotIntegrity } from "../repositories/learning-session-repository.js";
import { captureOperationTime, projectSessionLifecycle } from "./learning-session-domain.js";
import { completeLearningSessionAtomically } from "./learning-session-persistence.js";
import { readStreakProjection, toSessionProjection } from "./learning-session-service.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QUESTION_QUERY_FIELDS = new Set(["type", "run_id", "vocabulary_ids", "session_id"]);
const REQUIRED_QUESTION_QUERY_FIELDS = new Set(["type", "run_id"]);
const MAX_BOUNDED_QUESTIONS = 10;
const ANSWER_FIELDS = new Set(["event_id", "set_id", "vocabulary_id", "run_id", "question_revision", "quiz_type", "expected_revision", "selected_choice_id"]);
const QUIZ_TYPE = "MULTIPLE_CHOICE";

export class QuizServiceError extends Error {
  constructor(code, message) { super(message); this.name = "QuizServiceError"; this.code = code; }
}

export function createQuizService({
  quizRepository,
  createSessionRepository,
  createStreakRepository,
  now = () => new Date(),
}) {
  return {
    async getQuestions(userId, setId, input) {
      validateUuid(userId); validateUuid(setId);
      const query = validateQuestionQueryShape(input);
      if (query.session_id) {
        if (typeof createSessionRepository !== "function") throw sessionConflictError();
        return quizRepository.withTransaction(async (repository, transaction) => {
          const sessions = createSessionRepository(transaction);
          const session = await sessions.lockOwnedSession(query.session_id, userId);
          if (!session) throw sessionNotFoundError();
          if (session.mode !== "QUIZ" || session.set_id_snapshot !== setId || query.run_id !== session.id) {
            throw sessionConflictError();
          }
          const items = await sessions.lockSessionItems(session.id);
          assertSnapshotIntegrity(session.snapshot_size, items);
          if (projectSessionLifecycle(session, captureOperationTime(now).instant) === "EXPIRED") {
            throw sessionExpiredError();
          }
          const ids = items.map(({ vocabulary_id: id }) => id);
          if (query.has_vocabulary_ids && !sameIds(ids, parseBoundedVocabularyIds(query.vocabulary_ids))) {
            throw sessionConflictError();
          }
          return buildQuestionPayload(repository, userId, setId, session.id, ids);
        });
      }
      const set = await quizRepository.findAccessibleSetForUser(setId, userId);
      if (!set) throw serviceError("QUIZ_SET_NOT_FOUND", "Quiz set was not found.");
      const requestedIds = query.has_vocabulary_ids
        ? parseBoundedVocabularyIds(query.vocabulary_ids)
        : null;
      if (!set.items.length && requestedIds === null) {
        throw serviceError("QUIZ_SET_EMPTY", "Quiz set has no vocabulary to practice.");
      }
      const questionItems = requestedIds === null
        ? set.items
        : selectRequestedItems(set.items, requestedIds);
      const external = await quizRepository.findCanonicalDistractorCandidates(set.items.map((item) => item.vocabulary.id));
      const questions = buildQuestions(set, questionItems, external, query.run_id);
      return { id: set.id, name: set.name, quiz_type: QUIZ_TYPE, run_id: query.run_id, questions };
    },

    async recordAnswer(userId, input) {
      validateUuid(userId);
      const answer = validateAnswerInput(input);
      const execute = () => quizRepository.withTransaction((repository, transaction) => (
        answer.session_id
          ? recordSessionAnswerInTransaction({ repository, transaction, userId, answer,
            createSessionRepository, createStreakRepository, now })
          : recordAnswerInTransaction(repository, userId, answer)
      ));
      try { return await execute(); } catch (error) {
        if (!isRetryablePersistenceConflict(error)) throw error;
        try { return await execute(); } catch (retryError) {
          if (isRetryablePersistenceConflict(retryError)) throw progressConflictError();
          throw retryError;
        }
      }
    },
  };
}

async function buildQuestionPayload(repository, userId, setId, runId, requestedIds) {
  const set = await repository.findAccessibleSetForUser(setId, userId);
  if (!set) throw serviceError("QUIZ_SET_NOT_FOUND", "Quiz set was not found.");
  const questionItems = selectRequestedItems(set.items, requestedIds);
  const external = await repository.findCanonicalDistractorCandidates(set.items.map((item) => item.vocabulary.id));
  return { id: set.id, name: set.name, quiz_type: QUIZ_TYPE, run_id: runId,
    questions: buildQuestions(set, questionItems, external, runId) };
}

async function recordSessionAnswerInTransaction({
  repository, transaction, userId, answer, createSessionRepository, createStreakRepository, now,
}) {
  if (typeof createSessionRepository !== "function" || typeof createStreakRepository !== "function") {
    throw sessionConflictError();
  }
  if (answer.session_id !== answer.run_id) throw sessionConflictError();
  const sessions = createSessionRepository(transaction);
  const streaks = createStreakRepository(transaction);
  const session = await sessions.lockOwnedSession(answer.session_id, userId);
  if (!session) throw sessionNotFoundError();
  if (session.mode !== "QUIZ" || session.set_id_snapshot !== answer.set_id) throw sessionConflictError();
  const items = await sessions.lockSessionItems(session.id);
  assertSnapshotIntegrity(session.snapshot_size, items);
  const item = items.find(({ vocabulary_id: id }) => id === answer.vocabulary_id);
  if (!item) throw sessionConflictError();
  const existingEvidence = await sessions.findEvidenceReplay(answer.event_id);
  if (existingEvidence && existingEvidence.id !== item.id) {
    if (existingEvidence.session?.user_id !== userId) throw sessionNotFoundError();
    throw sessionConflictError();
  }
  const acceptedAt = captureOperationTime(now).instant;
  if (projectSessionLifecycle(session, acceptedAt) === "EXPIRED") throw sessionExpiredError();
  if (item.evidence_event_id && item.evidence_event_id !== answer.event_id) throw sessionConflictError();

  const result = await recordAnswerInTransaction(repository, userId, answer, acceptedAt);
  const evidence = result.is_correct ? "QUIZ_CORRECT" : "QUIZ_INCORRECT";
  let resolvedItems = items;
  if (item.evidence_event_id === answer.event_id) {
    if (item.evidence !== evidence) throw sessionConflictError();
  } else {
    if (session.status !== "ACTIVE" || item.evidence !== null) throw sessionConflictError();
    const recorded = await sessions.recordEvidence({ session, item, evidence,
      eventId: answer.event_id, acceptedAt });
    if (recorded.count !== 1) throw sessionConflictError();
    resolvedItems = items.map((candidate) => candidate.id === item.id
      ? { ...candidate, evidence, evidence_event_id: answer.event_id, evidence_at: acceptedAt }
      : candidate);
  }
  if (!resolvedItems.every(({ evidence: value }) => value !== null)) {
    return { ...result, session: toSessionProjection({ ...session, items: resolvedItems }, acceptedAt) };
  }
  const completion = await completeLearningSessionAtomically({
    sessionRepository: sessions, streakRepository: streaks, sessionId: session.id, userId,
    completionEventId: answer.event_id,
    captureTime: () => captureOperationTime(() => acceptedAt),
  });
  return { ...result, session: toSessionProjection(completion.session, acceptedAt),
    streak: await readStreakProjection(streaks, userId, acceptedAt) };
}

function buildQuestions(set, questionItems, external, runId) {
  const setCandidates = set.items.map(({ vocabulary }) => vocabulary);
  return questionItems.map((item) => {
    let built;
    try { built = buildMultipleChoiceQuestion({ runId, setId: set.id, item, setCandidates, canonicalCandidates: external }); }
    catch (error) { if (error instanceof TypeError) throw questionUnavailableError(); throw error; }
    if (!built) throw choicesUnavailableError();
    const progress = item.vocabulary.learning_progress?.[0];
    return { ...built.question, progress: progressProjection(progress) };
  });
}

async function recordAnswerInTransaction(repository, userId, answer, acceptedAt = new Date()) {
  const lockedSet = await repository.lockAccessibleSetForUser(answer.set_id, userId);
  if (!lockedSet) throw serviceError("QUIZ_SET_NOT_FOUND", "Quiz set was not found.");
  const lockedItem = await repository.lockQuestionItem(answer.set_id, answer.vocabulary_id);
  if (!lockedItem) throw questionUnavailableError();
  await repository.lockProgressIdentity(userId, answer.vocabulary_id);
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
    return toAcceptedAnswerResult(
      repository,
      userId,
      answer,
      built.correctChoiceId,
      isCorrect,
      current,
      true,
    );
  }

  const firstCorrectReward = await repository.findRewardByIdentity(
    userId,
    answer.vocabulary_id,
    XP_REWARD_TYPES.QUIZ_FIRST_CORRECT,
    0,
  );
  const rewardCandidate = deriveQuizRewardCandidate({
    user_id: userId,
    vocabulary_id: answer.vocabulary_id,
    is_correct: isCorrect,
    has_first_correct_reward: Boolean(firstCorrectReward),
  });

  const reviewedAt = acceptedAt;
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
  return completeAcceptedAnswer(
    repository,
    userId,
    answer,
    built.correctChoiceId,
    isCorrect,
    progress,
    rewardCandidate,
  );
}

function isCompatibleRetry(progress, status, expectedRevision) {
  return progress.status === status && progress.revision === expectedRevision + 1;
}
async function completeAcceptedAnswer(
  repository,
  userId,
  answer,
  correctChoiceId,
  isCorrect,
  progress,
  rewardCandidate,
) {
  let xpEarned = 0;
  let totalXp;
  if (rewardCandidate) {
    const result = await repository.insertRewardAndIncrementXp({
      user_id: userId,
      vocabulary_id: answer.vocabulary_id,
      ...rewardCandidate,
      source_event_id: answer.event_id,
    });
    xpEarned = result.reward.xp_amount;
    totalXp = result.total_xp;
  } else {
    totalXp = await repository.readUserTotalXp(userId);
  }
  return toAnswerResult(
    answer,
    correctChoiceId,
    isCorrect,
    progress,
    answer.event_id,
    xpEarned,
    false,
    totalXp,
  );
}

async function toAcceptedAnswerResult(
  repository,
  userId,
  answer,
  correctChoiceId,
  isCorrect,
  progress,
  replayed,
) {
  const [reward, totalXp] = await Promise.all([
    repository.findRewardBySourceEvent(userId, answer.event_id),
    repository.readUserTotalXp(userId),
  ]);
  const xpEarned = reward?.vocabulary_id === answer.vocabulary_id
    ? reward.xp_amount
    : 0;
  return toAnswerResult(
    answer,
    correctChoiceId,
    isCorrect,
    progress,
    answer.event_id,
    xpEarned,
    replayed,
    totalXp,
  );
}

function toAnswerResult(
  answer,
  correctChoiceId,
  isCorrect,
  progress,
  sourceEventId,
  xpEarned,
  replayed,
  totalXp,
) {
  return { set_id: answer.set_id, vocabulary_id: answer.vocabulary_id, run_id: answer.run_id,
    quiz_type: QUIZ_TYPE, is_correct: isCorrect, selected_choice_id: answer.selected_choice_id,
    correct_choice_id: correctChoiceId, progress: progressProjection(progress),
    reward: { source_event_id: sourceEventId, xp_earned: xpEarned, replayed, ...projectXpLevel(totalXp) } };
}
function progressProjection(progress) {
  return progress ? { status: progress.status, review_count: progress.review_count, revision: progress.revision,
    last_reviewed_at: progress.last_reviewed_at } : { status: "NEW", review_count: 0, revision: 0, last_reviewed_at: null };
}

function validateQuestionQueryShape(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)
    || !Object.keys(input).every((field) => QUESTION_QUERY_FIELDS.has(field))
    || ![...REQUIRED_QUESTION_QUERY_FIELDS].every((field) => Object.hasOwn(input, field))
    || input.type !== QUIZ_TYPE) throw validationError();
  validateUuid(input.run_id);
  if (Object.hasOwn(input, "session_id")) validateUuid(input.session_id);
  return {
    run_id: input.run_id,
    session_id: input.session_id,
    has_vocabulary_ids: Object.hasOwn(input, "vocabulary_ids"),
    vocabulary_ids: input.vocabulary_ids,
  };
}
function parseBoundedVocabularyIds(value) {
  if (typeof value !== "string" || value.length === 0) throw validationError();
  const ids = value.split(",");
  if (ids.length < 1 || ids.length > MAX_BOUNDED_QUESTIONS
    || ids.some((id) => id.length === 0 || !UUID_PATTERN.test(id))
    || new Set(ids).size !== ids.length) throw validationError();
  return ids;
}
function selectRequestedItems(items, requestedIds) {
  const itemsByVocabularyId = new Map(items.map((item) => [item.vocabulary.id, item]));
  const selected = requestedIds.map((id) => itemsByVocabularyId.get(id));
  if (selected.some((item) => !item)) throw questionUnavailableError();
  return selected;
}
function validateAnswerInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)
    || Object.keys(input).some((field) => !ANSWER_FIELDS.has(field) && field !== "session_id")
    || [...ANSWER_FIELDS].some((field) => !Object.hasOwn(input, field))) throw validationError();
  for (const field of ["event_id", "set_id", "vocabulary_id", "run_id"]) validateUuid(input[field]);
  if (Object.hasOwn(input, "session_id")) validateUuid(input.session_id);
  if (input.quiz_type !== QUIZ_TYPE || typeof input.question_revision !== "string"
    || !/^[A-Za-z0-9_-]{43}$/.test(input.question_revision)
    || typeof input.selected_choice_id !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(input.selected_choice_id)
    || !Number.isSafeInteger(input.expected_revision) || input.expected_revision < 0) throw validationError();
  return { ...input };
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
function sessionNotFoundError() { return serviceError("LEARNING_SESSION_NOT_FOUND", "Learning session was not found."); }
function sessionExpiredError() { return serviceError("LEARNING_SESSION_EXPIRED", "The learning session has expired."); }
function sessionConflictError() { return serviceError("LEARNING_SESSION_EVENT_CONFLICT", "Quiz answer conflicts with the learning session."); }
function sameIds(left, right) { return left.length === right.length && left.every((id, index) => id === right[index]); }
function isRetryablePersistenceConflict(error) {
  return error?.code === "P2002" || error?.code === "P2034" || isXpRewardCollisionError(error);
}
