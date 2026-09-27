export const QUIZ_PARENT = Object.freeze({
  VOCABULARY_SET: "vocabulary-set",
  TYPE_SELECTION: "type-selection",
});

export function createActiveQuizNavigationState(state) {
  return { ...state, quizParent: QUIZ_PARENT.TYPE_SELECTION };
}

export function resolveQuizBackNavigation({ stage, state, selectionPath, returnTo }) {
  const hasExpectedHistoryParent = stage === "active"
    ? state?.quizParent === QUIZ_PARENT.TYPE_SELECTION
    : typeof state?.returnTo === "string" && state.returnTo.length > 0;
  if (hasExpectedHistoryParent) return { kind: "history", delta: -1 };
  return {
    kind: "replace",
    to: stage === "active" ? selectionPath : returnTo,
    state: stage === "active" ? { ...state, quizParent: undefined } : undefined,
  };
}
