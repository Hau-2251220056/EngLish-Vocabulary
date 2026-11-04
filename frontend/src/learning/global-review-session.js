const VERSION = 1;
const STATE_KEY = "elvocab.global-review.state.v1";
const CREATE_KEY = "elvocab.global-review.create.v1";
const EVENT_KEY = "elvocab.global-review.event.v1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createGlobalReviewQueue(session) {
  return session.items.filter(({ evidence }) => evidence === null)
    .map(({ vocabulary_id: vocabularyId }) => vocabularyId);
}

export function applyGlobalReviewRating(queue, vocabularyId, rating) {
  if (queue[0] !== vocabularyId) return queue;
  const next = queue.slice(1);
  if (rating === "AGAIN") next.splice(Math.min(3, next.length), 0, vocabularyId);
  return next;
}

export async function createReviewSessionWithReplay({ storage, service, randomUuid }) {
  let operationId = read(storage, CREATE_KEY)?.operation_id;
  if (!UUID_PATTERN.test(operationId ?? "")) {
    operationId = randomUuid();
    requireUuid(operationId);
    write(storage, CREATE_KEY, { version: VERSION, operation_id: operationId });
  }
  const result = await service.createGlobalReviewSession(operationId);
  remove(storage, CREATE_KEY);
  return result;
}

export async function submitReviewRatingWithReplay({ storage, service, request, randomUuid }) {
  let pending = read(storage, EVENT_KEY);
  if (!isPendingEvent(pending, request)) {
    pending = { version: VERSION, ...request, event_id: randomUuid() };
    requireUuid(pending.event_id);
    write(storage, EVENT_KEY, pending);
  }
  const event = { ...pending };
  delete event.version;
  const result = await service.recordMeaningfulEvent(event);
  remove(storage, EVENT_KEY);
  return result;
}

export function saveGlobalReviewState(storage, state) {
  return write(storage, STATE_KEY, { version: VERSION, ...state });
}

export function loadGlobalReviewState(storage) {
  const value = read(storage, STATE_KEY);
  return value?.version === VERSION && typeof value.session_id === "string"
    && Array.isArray(value.cards) && Array.isArray(value.queue) ? value : null;
}

export function clearGlobalReviewState(storage) {
  remove(storage, STATE_KEY);
  remove(storage, EVENT_KEY);
}

function isPendingEvent(value, request) {
  return value?.version === VERSION && UUID_PATTERN.test(value.event_id ?? "")
    && value.session_id === request.session_id && value.set_id === null
    && value.vocabulary_id === request.vocabulary_id
    && value.expected_revision === request.expected_revision && value.rating === request.rating;
}
function requireUuid(value) { if (!UUID_PATTERN.test(value)) throw new TypeError("Global review operation identity is invalid."); }
function read(storage, key) { try { const value = storage?.getItem(key); return value ? JSON.parse(value) : null; } catch { return null; } }
function write(storage, key, value) { try { storage?.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
function remove(storage, key) { try { storage?.removeItem(key); } catch { /* presentation storage is optional */ } }
