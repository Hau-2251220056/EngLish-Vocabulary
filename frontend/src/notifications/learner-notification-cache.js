export const NOTIFICATION_STALE_MS = 60_000;
export const NOTIFICATION_PAGE_SIZE = 3;
const MAX_REFRESH_PAGES = 32;

function mergeItems(first, next) {
  const byId = new Map(first.map((item) => [item.id, item]));
  for (const item of next) byId.set(item.id, item);
  return [...byId.values()];
}

function atOrBefore(item, tail) {
  if (!item || !tail) return false;
  const difference = Date.parse(item.occurred_at) - Date.parse(tail.occurred_at);
  return difference < 0 || (difference === 0 && item.id <= tail.id);
}

function checkedPage(value) {
  if (!Array.isArray(value?.items) || value.items.length > NOTIFICATION_PAGE_SIZE
    || !Number.isSafeInteger(value.unread_count) || value.unread_count < 0
    || typeof value.has_more !== "boolean"
    || (value.has_more ? typeof value.next_cursor !== "string" || !value.items.length : value.next_cursor !== null)) {
    throw new Error("Invalid notification page.");
  }
  return value;
}

export function createLearnerNotificationCache(api, clock = Date.now) {
  const initial = {
    items: [], count: null, cursor: null, loaded: false,
    refreshing: false, loadingMore: false, reading: [], readingAll: false,
    refreshError: false, moreError: false, readError: false,
  };
  let state = initial;
  let lifetime = new AbortController();
  let queue = Promise.resolve();
  let refreshedAt = -Infinity;
  let invalidation = 0;
  const listeners = new Set();
  function update(changes) {
    state = { ...state, ...changes };
    listeners.forEach((listener) => listener());
  }
  function enqueue(operation) {
    // Apply responses in operation order so a refresh cannot overwrite a later read.
    const { signal } = lifetime;
    queue = queue.then(() => { if (!signal.aborted) return operation(signal); });
    return queue;
  }
  function refresh({ force = false } = {}) {
    if (state.refreshing || (!force && clock() - refreshedAt < NOTIFICATION_STALE_MS)) return queue;
    update({ refreshing: true, refreshError: false });
    return enqueue(async (signal) => {
      const version = invalidation;
      const previousTail = state.items.at(-1);
      try {
        let page = checkedPage(await api.refresh(signal));
        if (signal.aborted) return;
        let items = page.items;
        let pages = 1;
        // Rebuild a contiguous range through the old tail, including any new
        // rows ahead of it. Keep the original cache if any page fails.
        while (page.has_more && previousTail && !atOrBefore(items.at(-1), previousTail)) {
          if (pages++ >= MAX_REFRESH_PAGES) throw new Error("Notification refresh exceeded its page bound.");
          page = checkedPage(await api.list(page.next_cursor, signal));
          if (signal.aborted) return;
          items = mergeItems(items, page.items);
        }
        update({ items, count: page.unread_count, cursor: page.next_cursor, loaded: true, moreError: false });
        refreshedAt = version === invalidation ? clock() : -Infinity;
      } catch {
        if (!signal.aborted) update({ refreshError: true });
      } finally {
        if (!signal.aborted) update({ refreshing: false });
      }
    });
  }
  function loadMore() {
    if (!state.cursor || state.loadingMore || state.refreshing) return queue;
    update({ loadingMore: true, moreError: false });
    return enqueue(async (signal) => {
      try {
        const page = checkedPage(await api.list(state.cursor, signal));
        if (signal.aborted) return;
        update({ items: mergeItems(state.items, page.items), count: page.unread_count, cursor: page.next_cursor });
      } catch {
        if (!signal.aborted) update({ moreError: true });
      } finally {
        if (!signal.aborted) update({ loadingMore: false });
      }
    });
  }
  function markOne(id) {
    if (state.readingAll || state.reading.includes(id) || !state.items.some((item) => item.id === id && !item.read_at)) return queue;
    update({ reading: [...state.reading, id], readError: false });
    return enqueue(async (signal) => {
      try {
        if (state.items.some((item) => item.id === id && item.read_at)) return;
        const result = await api.markOne(id, signal);
        if (signal.aborted) return;
        update({ count: result.unread_count, items: state.items.map((item) => item.id === id ? { ...item, read_at: result.read_at } : item) });
      } catch {
        if (!signal.aborted) update({ readError: true });
      } finally {
        if (!signal.aborted) update({ reading: state.reading.filter((key) => key !== id) });
      }
    });
  }
  function markAll() {
    if (state.readingAll || state.count === null || state.count === 0) return queue;
    update({ readingAll: true, readError: false });
    return enqueue(async (signal) => {
      try {
        if (state.count === 0) return;
        const result = await api.markAll(signal);
        if (signal.aborted) return;
        update({ count: result.unread_count, items: state.items.map((item) => item.read_at ? item : { ...item, read_at: result.read_at }) });
      } catch {
        if (!signal.aborted) update({ readError: true });
      } finally {
        if (!signal.aborted) update({ readingAll: false });
      }
    });
  }
  return {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    snapshot: () => state,
    invalidate() { invalidation += 1; refreshedAt = -Infinity; },
    reset() {
      lifetime.abort();
      lifetime = new AbortController();
      queue = Promise.resolve();
      refreshedAt = -Infinity;
      update(initial);
    },
    refresh, loadMore, markOne, markAll,
  };
}
