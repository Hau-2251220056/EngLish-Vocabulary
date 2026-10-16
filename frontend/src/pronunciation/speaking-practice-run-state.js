import {
  advanceOrderedSessionBatch,
  completeOrderedSessionBatch,
  createOrderedSessionRun,
  currentOrderedSessionBatch,
  isOrderedSessionRun,
  reconcileOrderedSessionRun,
  selectOrderedSessionItem,
} from "../session-storage/ordered-session-run.js";
import {
  clearSessionNamespace,
  createSessionIdentity,
  createSessionStorageKey,
  LEARNING_SESSION_MODES,
  readSessionValue,
  writeSessionValue,
} from "../session-storage/resilient-session-store.js";

const VERSION = 1;
const MODE = LEARNING_SESSION_MODES.SPEAKING_PRACTICE;
const STORAGE_NAMESPACE = "elvocab.speaking.run";

export function createSpeakingPracticeRunState(userId, setId, vocabularyIds = null) {
  const identity = createIdentity(userId, setId);
  const initialized = Array.isArray(vocabularyIds);
  return freezeState({
    ...identity,
    session_initialized: initialized,
    ordered_run: createOrderedSessionRun(initialized ? vocabularyIds : []),
  });
}

export function reconcileSpeakingPracticeRun(state, authorizedVocabularyIds) {
  requireState(state);
  const orderedRun = state.session_initialized
    ? reconcileOrderedSessionRun(state.ordered_run, authorizedVocabularyIds)
    : createOrderedSessionRun(authorizedVocabularyIds);
  return freezeState({ ...state, session_initialized: true, ordered_run: orderedRun });
}

export function currentSpeakingPracticeBatchIds(state) {
  requireState(state);
  return currentOrderedSessionBatch(state.ordered_run);
}

export function selectSpeakingPracticeVocabulary(state, vocabularyId) {
  requireState(state);
  const orderedRun = selectOrderedSessionItem(state.ordered_run, vocabularyId);
  return orderedRun === state.ordered_run ? state : freezeState({ ...state, ordered_run: orderedRun });
}

export function completeSpeakingPracticeBatch(state) {
  requireState(state);
  const orderedRun = completeOrderedSessionBatch(state.ordered_run);
  return orderedRun === state.ordered_run ? state : freezeState({ ...state, ordered_run: orderedRun });
}

export function continueSpeakingPracticeRun(state) {
  requireState(state);
  const orderedRun = advanceOrderedSessionBatch(state.ordered_run);
  return orderedRun === state.ordered_run ? state : freezeState({ ...state, ordered_run: orderedRun });
}

export function restartSpeakingPracticeRun(state, latestAuthorizedVocabularyIds) {
  requireState(state);
  return createSpeakingPracticeRunState(state.user_id, state.set_id, latestAuthorizedVocabularyIds);
}

export function summarizeSpeakingPracticeRun(state) {
  requireState(state);
  const batchIds = currentOrderedSessionBatch(state.ordered_run);
  const currentIndex = batchIds.indexOf(state.ordered_run.current_vocabulary_id);
  const nextBatch = state.ordered_run.batches
    .slice((state.ordered_run.active_batch_index ?? -1) + 1)
    .find((batch) => batch.length > 0) ?? [];
  return Object.freeze({
    batch_size: batchIds.length,
    current_index: currentIndex,
    batch_completed: state.ordered_run.batch_status === "COMPLETED",
    full_run_completed: state.ordered_run.run_status === "COMPLETED",
    next_batch_size: nextBatch.length,
  });
}

export function loadSpeakingPracticeRunState(storage, userId, setId) {
  const identity = createIdentity(userId, setId);
  return readSessionValue(storage, storageKey(identity), (value) => isStoredState(value, identity));
}

export function saveSpeakingPracticeRunState(storage, state) {
  try { requireState(state); } catch { return false; }
  return writeSessionValue(storage, storageKey(state), toStoredState(state));
}

export function clearSpeakingPracticeRunStateNamespace(storage) {
  return clearSessionNamespace(storage, `${STORAGE_NAMESPACE}:`);
}

function toStoredState(state) {
  return {
    version: VERSION,
    user_id: state.user_id,
    set_id: state.set_id,
    mode: MODE,
    session_initialized: state.session_initialized,
    ordered_run: {
      snapshot_ids: [...state.ordered_run.snapshot_ids],
      batches: state.ordered_run.batches.map((batch) => [...batch]),
      active_batch_index: state.ordered_run.active_batch_index,
      current_vocabulary_id: state.ordered_run.current_vocabulary_id,
      batch_status: state.ordered_run.batch_status,
      run_status: state.ordered_run.run_status,
    },
  };
}

function freezeState(state) {
  const stored = toStoredState(state);
  stored.ordered_run.snapshot_ids = Object.freeze(stored.ordered_run.snapshot_ids);
  stored.ordered_run.batches = Object.freeze(stored.ordered_run.batches.map(Object.freeze));
  stored.ordered_run = Object.freeze(stored.ordered_run);
  return Object.freeze(stored);
}

function createIdentity(userId, setId) {
  return createSessionIdentity({ version: VERSION, userId, setId, mode: MODE });
}

function storageKey(identity) {
  return createSessionStorageKey(STORAGE_NAMESPACE, identity);
}

function requireState(state) {
  if (!isStoredState(state, createIdentity(state?.user_id, state?.set_id))) {
    throw new TypeError("Speaking Practice run state is invalid.");
  }
}

function isStoredState(value, identity) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  const expectedKeys = ["mode", "ordered_run", "session_initialized", "set_id", "user_id", "version"];
  return keys.length === expectedKeys.length && keys.every((key, index) => key === expectedKeys[index])
    && value.version === identity.version && value.user_id === identity.user_id
    && value.set_id === identity.set_id && value.mode === identity.mode
    && typeof value.session_initialized === "boolean" && isOrderedSessionRun(value.ordered_run);
}
