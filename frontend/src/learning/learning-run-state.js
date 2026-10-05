const STORAGE_PREFIX = "elvocab.learning.run.v1:";
const VERSION = 2;
const MODES = new Set(["SRS", "NORMAL"]);

export function createLearningRunState(userId, setId, srsPayload = null, normalCards = []) {
  const srsIds = uniqueIds(srsPayload?.cards ?? []);
  return {
    version: VERSION,
    user_id: userId,
    set_id: setId,
    active_mode: "SRS",
    srs: {
      snapshot_at: srsPayload?.evaluated_at ?? null,
      initial_ids: srsIds,
      queue: [...srsIds],
      passed_ids: [],
      presentation_count: 0,
      retry_context: null,
    },
    normal: { current_vocabulary_id: firstCardId(normalCards) },
  };
}

export function reconcileLearningRunState(stored, userId, setId, payload) {
  const fresh = createLearningRunState(
    userId,
    setId,
    payload.mode === "SRS" ? payload : null,
    payload.mode === "NORMAL" ? payload.cards : [],
  );
  if (!isStoredState(stored, userId, setId)) return fresh;

  if (payload.mode === "SRS") {
    if (isSettledSrsSnapshot(stored.srs)) {
      return {
        ...fresh,
        active_mode: stored.active_mode,
        normal: stored.normal,
      };
    }
    const eligibleIds = new Set(uniqueIds(payload.cards));
    const passed = stored.srs.passed_ids.filter((id) => stored.srs.initial_ids.includes(id));
    const queue = uniqueStrings(stored.srs.queue).filter((id) => eligibleIds.has(id));
    const initial = uniqueStrings([...passed, ...queue]);
    return {
      ...stored,
      srs: {
        ...stored.srs,
        snapshot_at: stored.srs.snapshot_at ?? payload.evaluated_at,
        initial_ids: initial.length > 0 ? initial : uniqueIds(payload.cards),
        queue: initial.length > 0 ? queue : uniqueIds(payload.cards),
        passed_ids: passed,
        retry_context: sanitizeRetry(stored.srs.retry_context, queue[0]),
      },
    };
  }

  const ids = new Set(uniqueIds(payload.cards));
  return {
    ...stored,
    normal: {
      current_vocabulary_id: ids.has(stored.normal.current_vocabulary_id)
        ? stored.normal.current_vocabulary_id
        : firstCardId(payload.cards),
    },
  };
}

export function selectLearningMode(state, mode) {
  return MODES.has(mode) ? { ...state, active_mode: mode } : state;
}

export function applySrsRating(state, vocabularyId, rating, authoritativeProgress) {
  if (state.active_mode !== "SRS" || state.srs.queue[0] !== vocabularyId) return state;
  let queue = state.srs.queue.filter((id) => id !== vocabularyId);
  let passedIds = state.srs.passed_ids.filter((id) => id !== vocabularyId);
  if (rating === "AGAIN") {
    queue.splice(Math.min(3, queue.length), 0, vocabularyId);
  } else {
    passedIds = uniqueStrings([...passedIds, vocabularyId]);
  }
  return {
    ...state,
    srs: {
      ...state.srs,
      queue,
      passed_ids: passedIds,
      presentation_count: state.srs.presentation_count + 1,
      retry_context: null,
      last_progress: authoritativeProgress,
    },
  };
}

export function setSrsRetryContext(state, context) {
  return { ...state, srs: { ...state.srs, retry_context: context } };
}

export function selectNormalCard(state, vocabularyId, cards) {
  if (!cards.some((card) => card.id === vocabularyId)) return state;
  return { ...state, normal: { current_vocabulary_id: vocabularyId } };
}

export function restartSrsRun(state, payload) {
  const ids = uniqueIds(payload.cards);
  return {
    ...state,
    active_mode: "SRS",
    srs: {
      snapshot_at: payload.evaluated_at,
      initial_ids: ids,
      queue: [...ids],
      passed_ids: [],
      presentation_count: 0,
      retry_context: null,
    },
  };
}

export function restartNormalRun(state, cards) {
  return {
    ...state,
    normal: { current_vocabulary_id: firstCardId(cards) },
  };
}

export function summarizeLearningRun(state) {
  const total = state.srs.initial_ids.length;
  const completedCount = state.srs.passed_ids.filter((id) =>
    state.srs.initial_ids.includes(id)).length;
  return {
    total,
    completed_count: completedCount,
    presentation_count: state.srs.presentation_count,
    completed: total > 0 && completedCount === total && state.srs.queue.length === 0,
  };
}

export function currentSrsVocabularyId(state) {
  return state?.srs.queue[0] ?? null;
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
  try { storage.removeItem(storageKey(userId, setId)); } catch { /* safe denial */ }
}

export function clearLearningRunStateNamespace(storage) {
  try {
    const keys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(STORAGE_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => storage.removeItem(key));
  } catch { /* safe denial */ }
}

function storageKey(userId, setId) {
  return `${STORAGE_PREFIX}${encodeURIComponent(userId)}:${encodeURIComponent(setId)}`;
}

function firstCardId(cards) { return cards[0]?.id ?? null; }
function uniqueIds(cards) { return uniqueStrings(cards.map((card) => card.id)); }
function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string"))];
}
function sanitizeRetry(value, currentId) {
  return value && value.vocabulary_id === currentId ? value : null;
}

function isStoredState(value, userId, setId) {
  return Boolean(
    value && typeof value === "object" && !Array.isArray(value)
    && value.version === VERSION && value.user_id === userId && value.set_id === setId
    && MODES.has(value.active_mode) && isSrsState(value.srs) && isNormalState(value.normal),
  );
}

function isSrsState(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    && (value.snapshot_at === null || typeof value.snapshot_at === "string")
    && Array.isArray(value.initial_ids) && Array.isArray(value.queue)
    && Array.isArray(value.passed_ids) && Number.isSafeInteger(value.presentation_count)
    && value.presentation_count >= 0;
}

function isNormalState(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    && (value.current_vocabulary_id === null || typeof value.current_vocabulary_id === "string");
}

function isSettledSrsSnapshot(srs) {
  if (srs.queue.length > 0) return false;
  if (srs.initial_ids.length === 0) return true;
  const passedIds = new Set(srs.passed_ids);
  return srs.initial_ids.every((id) => passedIds.has(id));
}
