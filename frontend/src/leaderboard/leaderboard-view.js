const POLL_MS = 60_000;
const MAX_BACKOFF_MS = 240_000;
const MAX_CACHE_ENTRIES = 12;

export function createLeaderboardView({
  session, read, documentTarget = document, clock = Date.now, random = Math.random,
  schedule = setTimeout, cancel = clearTimeout,
}) {
  const listeners = new Set();
  const snapshots = session.snapshots;
  const visible = () => active && !session.closed && documentTarget.visibilityState === "visible";
  let state = { period: "weekly", page: 1, entry: snapshots.get("weekly:1") ?? null,
    loading: true, error: null, previousPeriod: false };
  let active = false;
  let request = null;
  let pending = false;
  let timer;
  let failures = 0;

  function update(changes) {
    state = { ...state, ...changes };
    listeners.forEach((listener) => listener());
  }

  function dueForRollover() {
    return !state.previousPeriod && state.entry?.expiresAt <= clock();
  }

  function resetForNewPeriod() {
    if (!dueForRollover()) return;
    update({ page: 1, previousPeriod: true });
  }

  function planNext() {
    cancel(timer);
    if (!visible() || state.error === "auth") return;
    const untilRollover = state.previousPeriod ? Infinity : (state.entry?.expiresAt ?? Infinity) - clock();
    const jitter = Math.floor(random() * 4_001) - 2_000;
    const interval = Math.min(MAX_BACKOFF_MS, POLL_MS * 2 ** failures + jitter);
    timer = schedule(refresh, Math.max(0, Math.min(interval, untilRollover)));
  }

  function refresh() {
    if (!visible() || request || state.error === "auth") return;
    cancel(timer);
    resetForNewPeriod();
    const { period, page } = state;
    const revision = session.revision;
    const controller = new AbortController();
    const { signal } = controller;
    request = controller;
    pending = false;
    update({ loading: true, error: null });
    void run();

    async function run() {
      try {
        let data = await read(period, page, signal);
        if (signal.aborted || session.closed) return;
        failures = 0;
        const oldWindow = state.entry?.data.window.end;
        const rolled = oldWindow && data.window.end !== oldWindow;
        const lastPage = Math.max(1, data.pagination.total_pages);
        const target = rolled ? 1 : Math.min(page, lastPage);
        if (target !== page && data.pagination.total_items > 0) {
          pending = true;
          update({ page: target, previousPeriod: Boolean(rolled) });
          return;
        }
        if (page !== target) data = { ...data, pagination: { ...data.pagination, page: target } };
        const expiresAt = data.window.end
          ? clock() + Math.max(1, Date.parse(data.window.end) - Date.parse(data.as_of))
          : Infinity;
        const entry = { data, expiresAt };
        for (const [cacheKey, cached] of snapshots) {
          if (cached.data.period === period && cached.data.window.end !== data.window.end) snapshots.delete(cacheKey);
        }
        const cacheKey = `${period}:${target}`;
        snapshots.delete(cacheKey);
        snapshots.set(cacheKey, entry);
        if (snapshots.size > MAX_CACHE_ENTRIES) snapshots.delete(snapshots.keys().next().value);
        update({ page: target, entry, previousPeriod: false });
      } catch (error) {
        if (signal.aborted || session.closed) return;
        if ([401, 403].includes(error?.response?.status)) {
          snapshots.clear();
          pending = false;
          update({ entry: null, previousPeriod: false, error: "auth" });
        } else {
          failures = Math.min(failures + 1, 2);
          update({ error: "transient" });
        }
      } finally {
        request = null;
        if (active) {
          if ((pending || (!signal.aborted && revision !== session.revision))
            && visible() && state.error !== "auth") refresh();
          else {
            update({ loading: false });
            planNext();
          }
        }
      }
    }
  }

  function select(period, page) {
    if (state.period === period && state.page === page) return;
    request?.abort();
    failures = 0;
    pending = true;
    const entry = snapshots.get(`${period}:${page}`) ?? (period === state.period ? state.entry : null);
    update({ period, page, entry,
      loading: true, previousPeriod: false, error: null });
    refresh();
  }

  function onVisibilityChange() {
    cancel(timer);
    if (!visible()) {
      request?.abort();
      return;
    }
    if (request?.signal.aborted) pending = true;
    refresh();
  }

  function invalidate() {
    if (!visible() || state.error === "auth") return;
    refresh();
  }

  return {
    snapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      active = true;
      documentTarget.addEventListener("visibilitychange", onVisibilityChange);
      session.invalidations.add(invalidate);
      onVisibilityChange();
      return () => {
        active = false;
        cancel(timer);
        request?.abort();
        pending = false;
        session.invalidations.delete(invalidate);
        documentTarget.removeEventListener("visibilitychange", onVisibilityChange);
      };
    },
    setPeriod(period) { select(period, 1); },
    setPage(page) { select(state.period, page); },
    refresh,
  };
}
