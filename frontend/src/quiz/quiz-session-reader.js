import { learningService } from "../services/learning-service.js";
import { quizService } from "../services/quiz-service.js";
import { learningSessionService } from "../services/learning-session-service.js";
import {
  acceptQuizAnswer,
  bindQuizLearningSession,
  currentQuizBatchIds,
  reconcileQuizMembership,
  reconcileQuizLearningSession,
  reconcileQuizRunState,
} from "./quiz-run-state.js";
import { QuizApiError } from "../services/quiz-service.js";

export function createQuizSessionReader({
  loadMembership = (setId) => learningService.getLearningSet(setId, { mode: "NORMAL" }),
  createSession = (input) => learningSessionService.createSession(input),
  readSession = (sessionId) => learningSessionService.readSession(sessionId),
  replayAnswer = (input) => quizService.submitAnswer(input),
  loadQuestions = (setId, runId, vocabularyIds, sessionId) => quizService.getQuestions(setId, runId, vocabularyIds, sessionId),
} = {}) {
  return async function readQuizSession(state) {
    const manifest = await loadMembership(state.set_id);
    let authoritative = state;
    if (state.session_bound) {
      const session = await readSession(state.run_id);
      assertRecoverableSession(session);
      authoritative = reconcileQuizLearningSession(state, session);
      const pendingItem = session.items.find(({ vocabulary_id: id }) => (
        id === authoritative.pending_attempt?.vocabulary_id
      ));
      if (authoritative.pending_attempt && pendingItem?.evidence !== null) {
        authoritative = acceptQuizAnswer(
          authoritative,
          await replayAnswer(authoritative.pending_attempt),
        );
      }
      authoritative = reconcileQuizLearningSession(authoritative, session);
      if (authoritative.ordered_run.batch_status === "COMPLETED") {
        return { manifest, state: authoritative, payload: null };
      }
    }
    const authorizedIds = manifest.cards.map(({ id }) => id);
    const reconciled = reconcileQuizMembership(authoritative, authorizedIds);
    const vocabularyIds = currentQuizBatchIds(reconciled);
    if (reconciled.ordered_run.batch_status !== "ACTIVE" || vocabularyIds.length === 0) {
      return { manifest, state: reconciled, payload: null };
    }
    let bound = reconciled;
    if (!bound.session_bound) {
      const created = await createSession({ operation_id: bound.run_id, set_id: bound.set_id,
        mode: "QUIZ", vocabulary_ids: vocabularyIds });
      bound = bindQuizLearningSession(bound, created.session);
    }
    const payload = await loadQuestions(bound.set_id, bound.run_id, vocabularyIds, bound.run_id);
    return {
      manifest,
      state: reconcileQuizRunState(bound, bound.user_id, payload),
      payload,
    };
  };
}

function assertRecoverableSession(session) {
  if (session?.restart_reason === "SESSION_INACCESSIBLE") {
    throw new QuizApiError({ kind: "not-found", code: "LEARNING_SESSION_NOT_FOUND",
      message: "Learning session is no longer accessible.", status: 404 });
  }
  if (session?.state === "EXPIRED") {
    throw new QuizApiError({ kind: "conflict", code: "LEARNING_SESSION_EXPIRED",
      message: "Learning session has expired.", status: 409 });
  }
}

export const readQuizSession = createQuizSessionReader();
