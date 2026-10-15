import { httpClient } from "./http-client.js";

const ENDPOINT = "/api/quiz";
const TYPE = "MULTIPLE_CHOICE";
const ANSWER_FIELDS = ["event_id", "set_id", "vocabulary_id", "run_id", "question_revision", "quiz_type", "expected_revision", "selected_choice_id"];

export class QuizApiError extends Error {
  constructor({ kind, code, message, status }) { super(message); this.name = "QuizApiError"; Object.assign(this, { kind, code, status }); }
}

export function createQuizService(client = httpClient) {
  return {
    async getQuestions(setId, runId) {
      requireString(setId); requireString(runId);
      try {
        const response = await client.get(`${ENDPOINT}/sets/${encodeURIComponent(setId)}/questions`, { params: { type: TYPE, run_id: runId } });
        return requireQuestionPayload(response.data?.data);
      } catch (error) { throw mapQuizError(error); }
    },
    async submitAnswer(input) {
      const body = serializeAnswer(input);
      try { return requireAnswerResult((await client.post(`${ENDPOINT}/answers`, body)).data?.data); }
      catch (error) { throw mapQuizError(error); }
    },
  };
}

function serializeAnswer(input) {
  if (!isRecord(input) || Object.keys(input).some((field) => !ANSWER_FIELDS.includes(field))) throw validationError();
  const body = {};
  for (const field of ANSWER_FIELDS) { if (!Object.hasOwn(input, field)) throw validationError(); body[field] = input[field]; }
  for (const field of ["event_id", "set_id", "vocabulary_id", "run_id", "question_revision", "selected_choice_id"]) requireString(body[field]);
  if (body.quiz_type !== TYPE || !Number.isSafeInteger(body.expected_revision) || body.expected_revision < 0) throw validationError();
  return body;
}

function requireQuestionPayload(value) {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string" || value.quiz_type !== TYPE
    || typeof value.run_id !== "string" || !Array.isArray(value.questions) || !value.questions.length
    || !value.questions.every((question, index) => isQuestion(question, index + 1))) throw invalidResponseError();
  return value;
}
function isQuestion(value, position) {
  if (!isRecord(value) || typeof value.vocabulary_id !== "string" || value.position !== position
    || typeof value.question_revision !== "string" || !isRecord(value.prompt)
    || typeof value.prompt.word !== "string" || !(value.prompt.part_of_speech === null || typeof value.prompt.part_of_speech === "string")
    || !Array.isArray(value.choices) || value.choices.length !== 4 || !value.choices.every(isChoice) || !isProgress(value.progress)) return false;
  const ids = new Set(value.choices.map(({ choice_id }) => choice_id));
  const labels = new Set(value.choices.map(({ label }) => normalizeLabel(label)));
  return ids.size === 4 && labels.size === 4 && !["correct_choice_id", "is_correct", "correct_answer", "meanings"].some((field) => Object.hasOwn(value, field));
}
function isChoice(value) { return isRecord(value) && Object.keys(value).length === 2 && typeof value.choice_id === "string" && typeof value.label === "string" && Boolean(normalizeLabel(value.label)); }
function requireAnswerResult(value) {
  if (!isRecord(value) || typeof value.set_id !== "string" || typeof value.vocabulary_id !== "string" || typeof value.run_id !== "string"
    || value.quiz_type !== TYPE || typeof value.is_correct !== "boolean" || typeof value.selected_choice_id !== "string"
    || typeof value.correct_choice_id !== "string" || !isProgress(value.progress)) throw invalidResponseError();
  return value;
}
function isProgress(value) { return isRecord(value) && typeof value.status === "string" && Number.isSafeInteger(value.review_count) && Number.isSafeInteger(value.revision); }
function normalizeLabel(value) { return typeof value === "string" ? value.trim().normalize("NFC").replace(/\s+/gu, " ").toLowerCase() : ""; }
function mapQuizError(error) {
  if (error instanceof QuizApiError) return error;
  const status = error?.response?.status ?? null;
  const responseError = error?.response?.data?.error;
  return new QuizApiError({ kind: status === 404 ? "not-found" : status === 409 ? "conflict" : status === null ? "operational" : "api",
    code: responseError?.code ?? "QUIZ_REQUEST_FAILED", message: responseError?.message ?? (status === null ? "Quiz service is unavailable." : "Quiz request failed."), status });
}
function requireString(value) { if (typeof value !== "string" || !value) throw validationError(); }
function isRecord(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function validationError() { return new QuizApiError({ kind: "validation", code: "INVALID_QUIZ_REQUEST", message: "Quiz request is invalid.", status: null }); }
function invalidResponseError() { return new QuizApiError({ kind: "operational", code: "INVALID_QUIZ_RESPONSE", message: "Quiz service returned an invalid response.", status: null }); }

export const quizService = createQuizService();
