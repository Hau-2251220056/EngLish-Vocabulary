import { learningService } from "../services/learning-service.js";
import { quizService } from "../services/quiz-service.js";
import {
  currentQuizBatchIds,
  reconcileQuizMembership,
  reconcileQuizRunState,
} from "./quiz-run-state.js";

export function createQuizSessionReader({
  loadMembership = (setId) => learningService.getLearningSet(setId, { mode: "NORMAL" }),
  loadQuestions = (setId, runId, vocabularyIds) => quizService.getQuestions(setId, runId, vocabularyIds),
} = {}) {
  return async function readQuizSession(state) {
    const manifest = await loadMembership(state.set_id);
    const authorizedIds = manifest.cards.map(({ id }) => id);
    const reconciled = reconcileQuizMembership(state, authorizedIds);
    const vocabularyIds = currentQuizBatchIds(reconciled);
    if (reconciled.ordered_run.batch_status !== "ACTIVE" || vocabularyIds.length === 0) {
      return { manifest, state: reconciled, payload: null };
    }
    const payload = await loadQuestions(reconciled.set_id, reconciled.run_id, vocabularyIds);
    return {
      manifest,
      state: reconcileQuizRunState(reconciled, reconciled.user_id, payload),
      payload,
    };
  };
}

export const readQuizSession = createQuizSessionReader();
