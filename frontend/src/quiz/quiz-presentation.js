import { QuizApiError } from "../services/quiz-service.js";

export function createSharedQuizQuestionLoader(load) {
  const pending = new Map();
  return (key, ...argumentsForLoad) => {
    const existing = pending.get(key);
    if (existing) return existing;
    const request = Promise.resolve().then(() => load(...argumentsForLoad));
    pending.set(key, request);
    const cleanup = () => { if (pending.get(key) === request) pending.delete(key); };
    request.then(cleanup, cleanup);
    return request;
  };
}

export function classifyQuizLoadError(error) {
  if (["QUIZ_SET_EMPTY", "LEARNING_SET_EMPTY"].includes(error?.code)) return "empty";
  if (["QUIZ_ITEM_CHANGED", "QUIZ_CHOICES_UNAVAILABLE"].includes(error?.code)) return "stale";
  if (error?.kind === "not-found") return "not-found";
  return "error";
}

export async function readQuizSessionWithRecovery(readSession, state) {
  try {
    return await readSession(state);
  } catch (error) {
    if (!["QUIZ_ITEM_CHANGED", "QUIZ_CHOICES_UNAVAILABLE"].includes(error?.code)) throw error;
    return readSession(state);
  }
}

export function classifyQuizSubmissionError(error) {
  const code = error instanceof QuizApiError ? error.code : "QUIZ_REQUEST_FAILED";
  if (error instanceof QuizApiError && error.kind === "not-found") return { kind: "not-found", code, conclusive: true };
  if (["QUIZ_QUESTION_CHANGED", "QUIZ_CHOICE_CHANGED", "QUIZ_ITEM_CHANGED"].includes(code)) return { kind: "question-changed", code, conclusive: true };
  if (["QUIZ_PROGRESS_CONFLICT", "QUIZ_RETRY_CONFLICT"].includes(code)) return { kind: "progress-conflict", code, conclusive: true };
  if (error instanceof QuizApiError && (error.kind === "validation" || error.status === 400)) return { kind: "validation", code, conclusive: true };
  return { kind: "operational", code, conclusive: false };
}
