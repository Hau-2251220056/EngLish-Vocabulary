import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { createAuthenticationStore } from "./auth-store.js";
import { AuthenticationContext } from "./authentication-context.js";
import { leaderboardSession } from "../leaderboard/leaderboard-session.js";

export function AuthenticationProvider({ children }) {
  const [sessionEvents] = useState(() => new EventTarget());
  const [store] = useState(() => createAuthenticationStore(undefined, leaderboardSession, () => {
    sessionEvents.dispatchEvent(new Event("session-changed"));
  }));
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );

  useEffect(() => {
    void store.initialize();
    if (typeof BroadcastChannel !== "function") return;
    const channel = new BroadcastChannel("elvocab-auth-session");
    const announce = () => channel.postMessage("session-changed");
    sessionEvents.addEventListener("session-changed", announce);
    channel.onmessage = ({ data }) => {
      if (data === "session-changed") void store.refreshCurrentUser({ resetLeaderboard: true });
    };
    return () => {
      sessionEvents.removeEventListener("session-changed", announce);
      channel.close();
    };
  }, [sessionEvents, store]);

  const value = useMemo(
    () => ({
      ...state,
      register: store.register,
      login: store.login,
      loginWithGoogle: store.loginWithGoogle,
      logout: store.logout,
      refreshCurrentUser: store.refreshCurrentUser,
      dismissSessionExpired: store.dismissSessionExpired,
    }),
    [state, store],
  );

  return (
    <AuthenticationContext.Provider value={value}>
      {children}
    </AuthenticationContext.Provider>
  );
}
