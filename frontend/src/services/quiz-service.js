import { httpClient } from "./http-client.js";

const QUIZ_ENDPOINT = "/api/quiz";
const QUIZ_TYPES = new Set(["VI_TO_ENGLISH", "UNSCRAMBLE_WORD"]);
const ANSWER_FIELDS = [
  "event_id",
  "set_id",
  "vocabulary_id",
  "run_id",
  "question_revision",
  "quiz_type",
  "expected_revision",
  "answer",
];

export class QuizApiError extends Error {
  constructor({ kind, code, message, status }) {
    super(message);
    this.name = "QuizApiError";
    this.kind = kind;
    this.code = code;
    this.status = status;
  }
}

export function createQuizService(client = httpClient) {
  return {
    async getQuestions(setId, quizType, runId) {
      requireString(setId);
      requireQuizType(quizType);
      requireString(runId);
      try {
        const response = await client.get(
          `${QUIZ_ENDPOINT}/sets/${encodeURIComponent(setId)}/questions`,
          { params: { type: quizType, run_id: runId } },
        );
        return requireQuestionPayload(response.data?.data);
      } catch (error) {
        throw mapQuizError(error);
      }
    },

    async submitAnswer(input) {
      const body = serializeAnswer(input);
      try {
        const response = await client.post(`${QUIZ_ENDPOINT}/answers`, body);
        return requireAnswerResult(response.data?.data);
      } catch (error) {
        throw mapQuizError(error);
      }
    },
  };
}

function serializeAnswer(input) {
  if (!isRecord(input) || Object.keys(input).some((field) => !ANSWER_FIELDS.includes(field))) {
    throw validationError();
  }
  const body = {};
  for (const field of ANSWER_FIELDS) {
    if (!Object.hasOwn(input, field)) throw validationError();
    body[field] = input[field];
  }
  for (const field of ["event_id", "set_id", "vocabulary_id", "run_id", "question_revision", "answer"]) {
    requireString(body[field]);
  }
  requireQuizType(body.quiz_type);
  if (!Number.isSafeInteger(body.expected_revision) || body.expected_revision < 0) {
    throw validationError();
  }
  return body;
}

function requireQuestionPayload(value) {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    !QUIZ_TYPES.has(value.quiz_type) ||
    typeof value.run_id !== "string" ||
    !Array.isArray(value.questions) ||
    value.questions.length === 0 ||
    !value.questions.every(
      (question, index) => isQuestion(question, value.quiz_type, index + 1),
    )
  ) {
    throw invalidResponseError();
  }
  return value;
}

function isQuestion(value, quizType, expectedPosition) {
  return (
    isRecord(value) &&
    typeof value.vocabulary_id === "string" &&
    value.position === expectedPosition &&
    typeof value.question_revision === "string" &&
    isSafePrompt(value.prompt, quizType) &&
    isProgress(value.progress) &&
    !hasAnswerBearingField(value)
  );
}

function isSafePrompt(prompt, quizType) {
  if (!isRecord(prompt)) return false;
  const fields = Object.keys(prompt);
  const allowed = new Set(["meaning_vi", "context", "part_of_speech", "cefr_level"]);
  if (quizType === "UNSCRAMBLE_WORD") {
    const unscrambleAllowed = new Set([...allowed, "tiles", "slots", "shuffle_mode"]);
    return (
      fields.every((field) => unscrambleAllowed.has(field)) &&
      isMeaningPrompt(prompt) &&
      Array.isArray(prompt.tiles) &&
      prompt.tiles.length > 0 &&
      prompt.tiles.every(isSafeTile) &&
      new Set(prompt.tiles.map(({ tile_id: tileId }) => tileId)).size === prompt.tiles.length &&
      Array.isArray(prompt.slots) &&
      prompt.slots.some(({ kind }) => kind === "tile") &&
      prompt.slots.every(isSafeSlot) &&
      prompt.slots.filter(({ kind }) => kind === "tile").length === prompt.tiles.length &&
      ["SHUFFLED", "IDENTITY_FALLBACK"].includes(prompt.shuffle_mode)
    );
  }
  return (
    fields.every((field) => allowed.has(field)) &&
    isMeaningPrompt(prompt)
  );
}

function isMeaningPrompt(prompt) {
  return (
    typeof prompt.meaning_vi === "string" &&
    typeof prompt.part_of_speech === "string" &&
    (prompt.context === null || typeof prompt.context === "string") &&
    (prompt.cefr_level === null || typeof prompt.cefr_level === "string")
  );
}

function isSafeTile(tile) {
  return isRecord(tile) &&
    Object.keys(tile).length === 2 &&
    typeof tile.tile_id === "string" &&
    /^[A-Za-z0-9_-]{43}$/.test(tile.tile_id) &&
    typeof tile.character === "string" &&
    [...tile.character].length === 1;
}

function isSafeSlot(slot) {
  if (!isRecord(slot)) return false;
  if (slot.kind === "tile") return Object.keys(slot).length === 1;
  return slot.kind === "separator" &&
    Object.keys(slot).length === 2 &&
    typeof slot.value === "string" &&
    [...slot.value].length === 1 &&
    !/^[\p{L}\p{Nd}]$/u.test(slot.value);
}

function requireAnswerResult(value) {
  if (
    !isRecord(value) ||
    typeof value.set_id !== "string" ||
    typeof value.vocabulary_id !== "string" ||
    typeof value.run_id !== "string" ||
    !QUIZ_TYPES.has(value.quiz_type) ||
    typeof value.is_correct !== "boolean" ||
    typeof value.correct_answer !== "string" ||
    typeof value.normalized_answer !== "string" ||
    !Array.isArray(value.character_feedback) ||
    !value.character_feedback.every(isCharacterFeedback) ||
    !isProgress(value.progress)
  ) {
    throw invalidResponseError();
  }
  return value;
}

function isCharacterFeedback(value) {
  return isRecord(value) &&
    Number.isSafeInteger(value.position) &&
    (value.submitted === null || typeof value.submitted === "string") &&
    (value.expected === null || typeof value.expected === "string") &&
    ["correct", "incorrect", "missing", "extra"].includes(value.state);
}

function isProgress(value) {
  return (
    isRecord(value) &&
    typeof value.status === "string" &&
    Number.isSafeInteger(value.review_count) &&
    Number.isSafeInteger(value.revision)
  );
}

function hasAnswerBearingField(question) {
  return [
    "word",
    "phonetic",
    "pronunciation_url",
    "meanings",
    "examples",
    "correct_answer",
    "normalized_answer",
  ].some((field) => Object.hasOwn(question, field));
}

function mapQuizError(error) {
  if (error instanceof QuizApiError) return error;
  const status = error?.response?.status ?? null;
  const responseError = error?.response?.data?.error;
  const code = responseError?.code ?? "QUIZ_REQUEST_FAILED";
  return new QuizApiError({
    kind:
      status === 404
        ? "not-found"
        : status === 409
          ? "conflict"
          : status === null
            ? "operational"
            : "api",
    code,
    message:
      responseError?.message ??
      (status === null ? "Quiz service is unavailable." : "Quiz request failed."),
    status,
  });
}

function requireQuizType(value) {
  if (!QUIZ_TYPES.has(value)) throw validationError();
}

function requireString(value) {
  if (typeof value !== "string" || value.length === 0) throw validationError();
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validationError() {
  return new QuizApiError({
    kind: "validation",
    code: "INVALID_QUIZ_REQUEST",
    message: "Quiz request is invalid.",
    status: null,
  });
}

function invalidResponseError() {
  return new QuizApiError({
    kind: "operational",
    code: "INVALID_QUIZ_RESPONSE",
    message: "Quiz service returned an invalid response.",
    status: null,
  });
}

export const quizService = createQuizService();
