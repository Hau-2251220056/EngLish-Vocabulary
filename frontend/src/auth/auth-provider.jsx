import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { createAuthenticationStore } from "./auth-store.js";
import { AuthenticationContext } from "./authentication-context.js";

export function AuthenticationProvider({ children }) {
  const [store] = useState(() => createAuthenticationStore());
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );

  useEffect(() => {
    void store.initialize();
  }, [store]);

  const value = useMemo(
    () => ({
      ...state,
      register: store.register,
      login: store.login,
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
