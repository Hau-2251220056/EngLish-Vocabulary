const STORAGE_PREFIX = "elvocab.learning.run.v1:";
const OUTCOMES = new Set(["REMEMBERED", "STUDY_AGAIN"]);

export function createLearningRunState(userId, setId, cards) {
  const currentVocabularyId = firstCardId(cards);
  return {
    version: 1,
    user_id: userId,
    set_id: setId,
    current_vocabulary_id: currentVocabularyId,
    assessments: {},
  };
}

export function reconcileLearningRunState(stored, userId, setId, cards) {
  const fresh = createLearningRunState(userId, setId, cards);
  if (!isStoredState(stored, userId, setId)) return fresh;

  const cardIds = new Set(cards.map((card) => card.id));
  const assessments = {};
  for (const [vocabularyId, outcome] of Object.entries(stored.assessments)) {
    if (cardIds.has(vocabularyId) && OUTCOMES.has(outcome)) {
      assessments[vocabularyId] = outcome;
    }
  }

  return {
    ...fresh,
    current_vocabulary_id: cardIds.has(stored.current_vocabulary_id)
      ? stored.current_vocabulary_id
      : fresh.current_vocabulary_id,
    assessments,
  };
}

export function assessLearningCard(state, vocabularyId, outcome, cards) {
  if (!OUTCOMES.has(outcome) || !cards.some((card) => card.id === vocabularyId)) {
    return state;
  }
  return {
    ...state,
    assessments: { ...state.assessments, [vocabularyId]: outcome },
  };
}

export function selectLearningCard(state, vocabularyId, cards) {
  if (!cards.some((card) => card.id === vocabularyId)) return state;
  return { ...state, current_vocabulary_id: vocabularyId };
}

export function restartLearningRun(state, cards) {
  return createLearningRunState(state.user_id, state.set_id, cards);
}

export function summarizeLearningRun(state, cards) {
  const outcomes = cards
    .map((card) => state.assessments[card.id])
    .filter((outcome) => OUTCOMES.has(outcome));
  return {
    total: cards.length,
    assessed: outcomes.length,
    remembered: outcomes.filter((outcome) => outcome === "REMEMBERED").length,
    study_again: outcomes.filter((outcome) => outcome === "STUDY_AGAIN").length,
    completed: cards.length > 0 && outcomes.length === cards.length,
  };
}

export function loadLearningRunState(storage, userId, setId) {
  try {
    const raw = storage.getItem(storageKey(userId, setId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveLearningRunState(storage, state) {
  try {
    storage.setItem(storageKey(state.user_id, state.set_id), JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearLearningRunState(storage, userId, setId) {
  try {
    storage.removeItem(storageKey(userId, setId));
  } catch {
    // Storage denial must not break logout/session invalidation handling.
  }
}

export function clearLearningRunStateNamespace(storage) {
  try {
    const keys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(STORAGE_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => storage.removeItem(key));
  } catch {
    // Storage denial must not break the shared authentication UI.
  }
}

function storageKey(userId, setId) {
  return `${STORAGE_PREFIX}${encodeURIComponent(userId)}:${encodeURIComponent(setId)}`;
}

function firstCardId(cards) {
  return cards[0]?.id ?? null;
}

function isStoredState(value, userId, setId) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      value.version === 1 &&
      value.user_id === userId &&
      value.set_id === setId &&
      typeof value.assessments === "object" &&
      value.assessments !== null &&
      !Array.isArray(value.assessments),
  );
}
