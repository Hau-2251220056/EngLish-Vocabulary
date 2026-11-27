export function createLeaderboardSessionStore() {
  let current = null;
  let generation = 0;
  const listeners = new Set();
  return {
    getSnapshot: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    replace(isLearner) {
      if (current) {
        current.closed = true;
        current.snapshots.clear();
      }
      current = isLearner
        ? { generation: ++generation, snapshots: new Map(), invalidations: new Set(), revision: 0, closed: false }
        : null;
      listeners.forEach((listener) => listener());
    },
    captureInvalidation() {
      const session = current;
      return ({ reward, session: learningSession, streak, replayed }) => {
        if (!session || current !== session || replayed === true || reward?.replayed === true) return;
        if (reward?.xp_earned > 0 || (learningSession?.state === "COMPLETED" && streak)) {
          session.revision += 1;
          session.invalidations.forEach((listener) => listener());
        }
      };
    },
  };
}

export const leaderboardSession = createLeaderboardSessionStore();
