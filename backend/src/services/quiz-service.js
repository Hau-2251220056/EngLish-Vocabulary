// @ts-nocheck
import {
  buildCharacterFeedback,
  createUnscrambleProjection,
  createQuestionRevision,
  normalizeQuizAnswer,
  quizAnswersAreEquivalent,
  selectPrimaryMeaning,
} from "./quiz-domain.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QUESTION_QUERY_FIELDS = new Set(["type", "run_id"]);
const QUIZ_TYPES = new Set(["VI_TO_ENGLISH", "UNSCRAMBLE_WORD"]);
const ANSWER_FIELDS = new Set([
  "event_id",
  "set_id",
  "vocabulary_id",
  "run_id",
  "question_revision",
  "quiz_type",
  "expected_revision",
  "answer",
]);

export class QuizServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "QuizServiceError";
    this.code = code;
  }
}

export function createQuizService({ quizRepository }) {
  return {
    async getQuestions(userId, setId, input) {
      validateUuid(userId);
      validateUuid(setId);
      const query = validateQuestionQuery(input);
      const set = await quizRepository.findAccessibleSetForUser(
        setId,
        userId,
        query.type,
      );
      if (!set) {
        throw new QuizServiceError(
          "QUIZ_SET_NOT_FOUND",
          "Quiz set was not found.",
        );
      }
      if (set.items.length === 0) {
        throw new QuizServiceError(
          "QUIZ_SET_EMPTY",
          "Quiz set has no vocabulary to practice.",
        );
      }

      return {
        id: set.id,
        name: set.name,
        quiz_type: query.type,
        run_id: query.run_id,
        questions: set.items.map((item) =>
          toQuestion(set.id, item, query.type, query.run_id),
        ),
      };
    },

    async recordAnswer(userId, input) {
      validateUuid(userId);
      const answer = validateAnswerInput(input);
      const execute = () => quizRepository.withTransaction((repository) =>
        recordAnswerInTransaction(repository, userId, answer));

      try {
        return await execute();
      } catch (error) {
        if (error?.code !== "P2002" && error?.code !== "P2034") throw error;
        try {
          return await execute();
        } catch (retryError) {
          if (retryError?.code === "P2002" || retryError?.code === "P2034") {
            throw progressConflictError();
          }
          throw retryError;
        }
      }
    },
  };
}

async function recordAnswerInTransaction(repository, userId, answer) {
  const set = await repository.lockAccessibleSetForUser(answer.set_id, userId);
  if (!set) throw setNotFoundError();

  const item = await repository.lockQuestionItem(
    answer.set_id,
    answer.vocabulary_id,
  );
  if (!item) throw questionUnavailableError();

  const meanings = await repository.lockMeanings(answer.vocabulary_id);
  const meaning = selectPrimaryMeaning(meanings);
  if (!meaning) {
    throw questionUnavailableError();
  }

  const currentQuestionRevision = createQuestionRevision({
    setId: answer.set_id,
    itemId: item.item_id,
    position: item.position,
    quizType: answer.quiz_type,
    vocabularyId: item.vocabulary_id,
    vocabularyUpdatedAt: item.vocabulary_updated_at,
    runId: answer.run_id,
    meaningId: meaning?.id ?? null,
    meaningUpdatedAt: meaning?.updated_at ?? null,
  });
  if (currentQuestionRevision !== answer.question_revision) {
    throw questionChangedError();
  }

  const canonicalAnswer = item.word;
  const allowSpaceForCanonicalHyphen = answer.quiz_type === "VI_TO_ENGLISH";
  const isCorrect = quizAnswersAreEquivalent(
    answer.normalized_answer,
    canonicalAnswer,
    { allowSpaceForCanonicalHyphen },
  );
  const targetStatus = isCorrect ? "LEARNED" : "LEARNING";
  const current = await repository.findProgress(userId, answer.vocabulary_id);

  if (current?.last_event_id === answer.event_id) {
    if (!isCompatibleRetry(current, targetStatus, answer.expected_revision)) {
      throw retryConflictError();
    }
    return toAnswerResult(answer, canonicalAnswer, isCorrect, current);
  }

  const reviewedAt = new Date();
  let progress;
  if (!current) {
    if (answer.expected_revision !== 0) throw progressConflictError();
    progress = await repository.createProgress({
      user_id: userId,
      vocabulary_id: answer.vocabulary_id,
      status: targetStatus,
      review_count: 1,
      revision: 1,
      last_reviewed_at: reviewedAt,
      last_event_id: answer.event_id,
    });
  } else {
    if (current.revision !== answer.expected_revision) {
      throw progressConflictError();
    }
    const updated = await repository.updateProgressAtRevision(
      current.id,
      answer.expected_revision,
      {
        status: targetStatus,
        review_count: { increment: 1 },
        revision: { increment: 1 },
        last_reviewed_at: reviewedAt,
        last_event_id: answer.event_id,
      },
    );
    progress = await repository.findProgress(userId, answer.vocabulary_id);
    if (updated.count === 0 || !progress) {
      if (progress?.last_event_id === answer.event_id) {
        if (!isCompatibleRetry(progress, targetStatus, answer.expected_revision)) {
          throw retryConflictError();
        }
      } else {
        throw progressConflictError();
      }
    }
  }

  return toAnswerResult(answer, canonicalAnswer, isCorrect, progress);
}

function isCompatibleRetry(progress, targetStatus, expectedRevision) {
  return (
    progress.status === targetStatus &&
    progress.revision === expectedRevision + 1
  );
}

function toAnswerResult(answer, canonicalAnswer, isCorrect, progress) {
  return {
    set_id: answer.set_id,
    vocabulary_id: answer.vocabulary_id,
    run_id: answer.run_id,
    quiz_type: answer.quiz_type,
    is_correct: isCorrect,
    correct_answer: canonicalAnswer,
    normalized_answer: answer.normalized_answer,
    character_feedback: buildCharacterFeedback(
      answer.normalized_answer,
      canonicalAnswer,
      { allowSpaceForCanonicalHyphen: answer.quiz_type === "VI_TO_ENGLISH" },
    ),
    progress: {
      status: progress.status,
      review_count: progress.review_count,
      revision: progress.revision,
      last_reviewed_at: progress.last_reviewed_at,
    },
  };
}

function toQuestion(setId, item, quizType, runId) {
  const vocabulary = item.vocabulary;
  if (!vocabulary || typeof vocabulary.word !== "string") {
    throw questionUnavailableError();
  }
  const progress = vocabulary.learning_progress[0];
  const shared = {
    vocabulary_id: vocabulary.id,
    position: item.position,
    progress: progress
      ? {
          status: progress.status,
          review_count: progress.review_count,
          revision: progress.revision,
          last_reviewed_at: progress.last_reviewed_at,
        }
      : {
          status: "NEW",
          review_count: 0,
          revision: 0,
          last_reviewed_at: null,
        },
  };

  if (quizType === "VI_TO_ENGLISH") {
    const meaning = selectPrimaryMeaning(vocabulary.meanings);
    if (!meaning) throw questionUnavailableError();
    return {
      ...shared,
      question_revision: createQuestionRevision({
        setId,
        itemId: item.id,
        position: item.position,
        quizType,
        vocabularyId: vocabulary.id,
        vocabularyUpdatedAt: vocabulary.updated_at,
        meaningId: meaning.id,
        meaningUpdatedAt: meaning.updated_at,
      }),
      prompt: {
        meaning_vi: meaning.meaning_vi,
        context: meaning.context,
        part_of_speech: meaning.part_of_speech,
        cefr_level: meaning.cefr_level,
      },
    };
  }

  const meaning = selectPrimaryMeaning(vocabulary.meanings);
  if (!meaning) throw questionUnavailableError();
  let projection;
  try {
    projection = createUnscrambleProjection({
      runId,
      setId,
      vocabularyId: vocabulary.id,
      word: vocabulary.word,
    });
  } catch (error) {
    if (error instanceof TypeError) throw questionUnavailableError();
    throw error;
  }
  return {
    ...shared,
    question_revision: createQuestionRevision({
      setId,
      itemId: item.id,
      position: item.position,
      quizType,
      vocabularyId: vocabulary.id,
      vocabularyUpdatedAt: vocabulary.updated_at,
      runId,
      meaningId: meaning.id,
      meaningUpdatedAt: meaning.updated_at,
    }),
    prompt: {
      meaning_vi: meaning.meaning_vi,
      context: meaning.context,
      part_of_speech: meaning.part_of_speech,
      cefr_level: meaning.cefr_level,
      ...projection,
    },
  };
}

function validateQuestionQuery(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError();
  }
  const fields = Object.keys(input);
  if (
    fields.length !== QUESTION_QUERY_FIELDS.size ||
    fields.some((field) => !QUESTION_QUERY_FIELDS.has(field)) ||
    [...QUESTION_QUERY_FIELDS].some((field) => !Object.hasOwn(input, field)) ||
    typeof input.type !== "string" ||
    !QUIZ_TYPES.has(input.type)
  ) {
    throw validationError();
  }
  validateUuid(input.run_id);
  return { type: input.type, run_id: input.run_id };
}

function validateAnswerInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError();
  }
  const fields = Object.keys(input);
  if (
    fields.length !== ANSWER_FIELDS.size ||
    fields.some((field) => !ANSWER_FIELDS.has(field)) ||
    [...ANSWER_FIELDS].some((field) => !Object.hasOwn(input, field))
  ) {
    throw validationError();
  }
  for (const field of ["event_id", "set_id", "vocabulary_id", "run_id"]) {
    validateUuid(input[field]);
  }
  if (
    typeof input.question_revision !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(input.question_revision) ||
    typeof input.quiz_type !== "string" ||
    !QUIZ_TYPES.has(input.quiz_type) ||
    !Number.isSafeInteger(input.expected_revision) ||
    input.expected_revision < 0
  ) {
    throw validationError();
  }
  let normalizedAnswer;
  try {
    normalizedAnswer = normalizeQuizAnswer(input.answer);
  } catch (error) {
    if (error instanceof TypeError) throw validationError();
    throw error;
  }
  return {
    ...input,
    normalized_answer: normalizedAnswer,
  };
}

function validateUuid(value) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw validationError();
  }
  return value;
}

function validationError() {
  return new QuizServiceError(
    "QUIZ_VALIDATION_ERROR",
    "Quiz request data is invalid.",
  );
}

function questionUnavailableError() {
  return new QuizServiceError(
    "QUIZ_ITEM_CHANGED",
    "Quiz vocabulary is no longer available. Refresh before trying again.",
  );
}

function setNotFoundError() {
  return new QuizServiceError(
    "QUIZ_SET_NOT_FOUND",
    "Quiz set was not found.",
  );
}

function questionChangedError() {
  return new QuizServiceError(
    "QUIZ_QUESTION_CHANGED",
    "Quiz question changed. Refresh before trying again.",
  );
}

function retryConflictError() {
  return new QuizServiceError(
    "QUIZ_RETRY_CONFLICT",
    "Quiz answer retry conflicts with current progress.",
  );
}

function progressConflictError() {
  return new QuizServiceError(
    "QUIZ_PROGRESS_CONFLICT",
    "Learning progress changed. Refresh before trying again.",
  );
}
