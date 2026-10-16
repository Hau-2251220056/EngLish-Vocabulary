import {
  clearSessionNamespace,
  readSessionValue,
  removeSessionValue,
  writeSessionValue,
} from "../session-storage/resilient-session-store.js";
import {
  advanceOrderedSessionBatch,
  completeOrderedSessionBatch,
  createOrderedSessionRun,
  currentOrderedSessionBatch,
  reconcileOrderedSessionRun,
  restartOrderedSessionRun,
  selectOrderedSessionItem,
} from "../session-storage/ordered-session-run.js";

const STORAGE_PREFIX = "elvocab.learning.run.v1:";
const VERSION = 3;
const MAX_SRS_SESSION_SIZE = 10;
const MODES = new Set(["SRS", "NORMAL"]);
const SRS_RATINGS = new Set(["AGAIN", "HARD", "GOOD", "EASY"]);

export function createLearningRunState(userId, setId, srsPayload = null, normalCards = null) {
  const srsIds = boundedSrsIds(srsPayload?.cards ?? []);
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
      status: srsIds.length > 0 ? "ACTIVE" : "UP_TO_DATE",
    },
    normal_initialized: Array.isArray(normalCards),
    normal: createOrderedSessionRun(uniqueIds(normalCards ?? [])),
  };
}

export function reconcileLearningRunState(stored, userId, setId, payload) {
  const fresh = createLearningRunState(
    userId,
    setId,
    payload.mode === "SRS" ? payload : null,
    payload.mode === "NORMAL" ? payload.cards : null,
  );
  if (!isStoredState(stored, userId, setId)) return fresh;

  if (payload.mode === "SRS") {
    if (stored.srs.status === "COMPLETED") {
      return {
        ...stored,
        active_mode: stored.active_mode,
      };
    }
    if (stored.srs.status === "UP_TO_DATE") {
      return { ...fresh, active_mode: stored.active_mode, normal_initialized: stored.normal_initialized, normal: stored.normal };
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
        initial_ids: initial,
        queue,
        passed_ids: passed,
        retry_context: sanitizeRetry(stored.srs.retry_context, queue[0]),
        status: queue.length === 0 ? "COMPLETED" : "ACTIVE",
      },
    };
  }

  return {
    ...stored,
    normal_initialized: true,
    normal: stored.normal_initialized
      ? reconcileOrderedSessionRun(stored.normal, uniqueIds(payload.cards))
      : createOrderedSessionRun(uniqueIds(payload.cards)),
  };
}

export function selectLearningMode(state, mode) {
  return MODES.has(mode) ? { ...state, active_mode: mode } : state;
}

export function applySrsRating(state, vocabularyId, rating, authoritativeProgress) {
  if (state.active_mode !== "SRS" || state.srs.status !== "ACTIVE"
    || state.srs.queue[0] !== vocabularyId) return state;
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
      status: queue.length === 0 ? "COMPLETED" : "ACTIVE",
    },
  };
}

export function setSrsRetryContext(state, context) {
  return { ...state, srs: { ...state.srs, retry_context: context } };
}

export function selectNormalCard(state, vocabularyId, cards) {
  if (!cards.some((card) => card.id === vocabularyId)) return state;
  return { ...state, normal: selectOrderedSessionItem(state.normal, vocabularyId) };
}

export function restartSrsRun(state, payload) {
  const ids = boundedSrsIds(payload.cards);
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
      status: ids.length > 0 ? "ACTIVE" : "UP_TO_DATE",
    },
  };
}

export function restartNormalRun(state, cards) {
  return {
    ...state,
    normal_initialized: true,
    normal: restartOrderedSessionRun(uniqueIds(cards)),
  };
}

export function completeNormalBatch(state) {
  const batch = currentOrderedSessionBatch(state.normal);
  if (state.active_mode !== "NORMAL"
    || state.normal.current_vocabulary_id !== batch.at(-1)) return state;
  return { ...state, normal: completeOrderedSessionBatch(state.normal) };
}

export function continueNormalRun(state) {
  if (state.active_mode !== "NORMAL") return state;
  return { ...state, normal: advanceOrderedSessionBatch(state.normal) };
}

export function currentNormalBatchCards(state, cards) {
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  return currentOrderedSessionBatch(state.normal)
    .map((id) => cardsById.get(id))
    .filter(Boolean);
}

export function summarizeNormalRun(state) {
  const normal = state.normal;
  const activeIndex = normal.active_batch_index;
  let nextBatchSize = 0;
  if (activeIndex !== null) {
    for (let index = activeIndex + 1; index < normal.batches.length; index += 1) {
      if (normal.batches[index].length > 0) {
        nextBatchSize = normal.batches[index].length;
        break;
      }
    }
  }
  return {
    batch_completed: normal.batch_status === "COMPLETED",
    full_run_completed: normal.run_status === "COMPLETED",
    next_batch_size: nextBatchSize,
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
    completed: state.srs.status === "COMPLETED",
    up_to_date: state.srs.status === "UP_TO_DATE",
  };
}

export function currentSrsVocabularyId(state) {
  return state?.srs.queue[0] ?? null;
}

export function loadLearningRunState(storage, userId, setId) {
  return readSessionValue(
    storage,
    storageKey(userId, setId),
    (value) => isStoredState(value, userId, setId),
  );
}

export function saveLearningRunState(storage, state) {
  if (!isStoredState(state, state?.user_id, state?.set_id)) return false;
  return writeSessionValue(storage, storageKey(state.user_id, state.set_id), state);
}

export function clearLearningRunState(storage, userId, setId) {
  removeSessionValue(storage, storageKey(userId, setId));
}

export function clearLearningRunStateNamespace(storage) {
  clearSessionNamespace(storage, STORAGE_PREFIX);
}

function storageKey(userId, setId) {
  return `${STORAGE_PREFIX}${encodeURIComponent(userId)}:${encodeURIComponent(setId)}`;
}

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
    && typeof value.normal_initialized === "boolean"
    && MODES.has(value.active_mode) && isSrsState(value.srs) && isNormalState(value.normal),
  );
}

function isSrsState(value) {
  const structurallyValid = value && typeof value === "object" && !Array.isArray(value)
    && (value.snapshot_at === null || typeof value.snapshot_at === "string")
    && Array.isArray(value.initial_ids) && Array.isArray(value.queue)
    && Array.isArray(value.passed_ids) && Number.isSafeInteger(value.presentation_count)
    && value.presentation_count >= 0
    && new Set(["ACTIVE", "COMPLETED", "UP_TO_DATE"]).has(value.status)
    && value.initial_ids.length <= MAX_SRS_SESSION_SIZE
    && value.initial_ids.every(isNonEmptyString)
    && value.queue.every(isNonEmptyString)
    && value.passed_ids.every(isNonEmptyString)
    && new Set(value.initial_ids).size === value.initial_ids.length
    && new Set(value.queue).size === value.queue.length
    && new Set(value.passed_ids).size === value.passed_ids.length
    && value.queue.every((id) => value.initial_ids.includes(id))
    && value.passed_ids.every((id) => value.initial_ids.includes(id))
    && isSrsRetryContext(value.retry_context, value.queue[0]);
  if (!structurallyValid) return false;
  if (new Set([...value.queue, ...value.passed_ids]).size !== value.initial_ids.length) return false;
  if (value.status === "ACTIVE") return value.queue.length > 0;
  if (value.status === "UP_TO_DATE") {
    return value.initial_ids.length === 0 && value.queue.length === 0 && value.passed_ids.length === 0;
  }
  return value.queue.length === 0;
}

function isNormalState(value) {
  try {
    currentOrderedSessionBatch(value);
    return true;
  } catch {
    return false;
  }
}

function boundedSrsIds(cards) { return uniqueIds(cards).slice(0, MAX_SRS_SESSION_SIZE); }

function isSrsRetryContext(value, currentId) {
  return value === null || Boolean(
    value && typeof value === "object" && !Array.isArray(value)
    && isNonEmptyString(value.event_id)
    && value.vocabulary_id === currentId
    && Number.isSafeInteger(value.expected_revision) && value.expected_revision >= 0
    && SRS_RATINGS.has(value.rating),
  );
}

function isNonEmptyString(value) { return typeof value === "string" && value.length > 0; }
