import {
  authService as defaultAuthService,
  isAuthenticationFailure,
} from "../services/auth-service.js";

const INITIAL_STATE = Object.freeze({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  authError: null,
  sessionExpired: false,
  authenticationRecoveryRequired: false,
});

export function createAuthenticationStore(authService = defaultAuthService, leaderboard, announceSessionChange) {
  let state = { ...INITIAL_STATE };
  let initializationPromise = null;
  let initializationStarted = false;
  let sessionRead = 0;
  const listeners = new Set();

  function getSnapshot() {
    return state;
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function setState(nextState, newSession = false) {
    const previousUser = state.user;
    state = nextState;
    if (newSession || previousUser?.id !== state.user?.id || previousUser?.role !== state.user?.role) {
      leaderboard?.replace(state.user?.role === "USER");
    }
    listeners.forEach((listener) => listener());
  }

  function setGuest(authError = null, sessionExpired = false) {
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      authError,
      sessionExpired,
      authenticationRecoveryRequired: false,
    });
  }

  async function register(credentials) {
    setState({ ...state, authError: null });

    try {
      return await authService.register(credentials);
    } catch (error) {
      setState({ ...state, authError: toStateError(error) });
      throw error;
    }
  }

  async function login(credentials) {
    setState({ ...state, authError: null });

    try {
      const user = await authService.login(credentials);
      sessionRead += 1;
      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        authError: null,
        sessionExpired: false,
        authenticationRecoveryRequired: false,
      }, true);
      announceSessionChange?.();
      return user;
    } catch (error) {
      setGuest(toStateError(error));
      throw error;
    }
  }

  async function loginWithGoogle(credential) {
    setState({ ...state, authError: null });
    try {
      const user = await authService.loginWithGoogle(credential);
      sessionRead += 1;
      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        authError: null,
        sessionExpired: false,
        authenticationRecoveryRequired: false,
      }, true);
      announceSessionChange?.();
      return user;
    } catch (error) {
      setState({ ...state, authError: toStateError(error) });
      throw error;
    }
  }

  async function logout() {
    setState({ ...state, authError: null, sessionExpired: false });

    try {
      await authService.logout();
      sessionRead += 1;
      setGuest();
      announceSessionChange?.();
    } catch (error) {
      setState({ ...state, authError: toStateError(error) });
      throw error;
    }
  }

  async function refreshCurrentUser({ resetLeaderboard = false } = {}) {
    const read = ++sessionRead;
    if (resetLeaderboard) leaderboard?.replace(false);
    const hadAuthenticatedSession = state.isAuthenticated;
    const previousState = state;
    setState({
      ...state,
      isLoading: true,
      authError: null,
      authenticationRecoveryRequired: false,
    });

    try {
      const user = await authService.getCurrentUser();
      if (read !== sessionRead) return null;
      const needsLeaderboardSession = user.role === "USER" && leaderboard?.getSnapshot() === null;
      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        authError: null,
        sessionExpired: false,
        authenticationRecoveryRequired: false,
      }, resetLeaderboard || needsLeaderboardSession);
      return user;
    } catch (error) {
      if (read !== sessionRead) return null;
      if (isAuthenticationFailure(error)) {
        setGuest(null, hadAuthenticatedSession);
        return null;
      }

      setState({
        ...previousState,
        isLoading: false,
        authError: toStateError(error),
        authenticationRecoveryRequired: true,
      });
      return null;
    }
  }

  function initialize() {
    if (!initializationStarted) {
      initializationStarted = true;
      initializationPromise = refreshCurrentUser();
    }

    return initializationPromise;
  }

  function dismissSessionExpired() {
    if (state.sessionExpired) {
      setState({ ...state, sessionExpired: false });
    }
  }

  return Object.freeze({
    getSnapshot,
    subscribe,
    initialize,
    refreshCurrentUser,
    register,
    login,
    loginWithGoogle,
    logout,
    dismissSessionExpired,
  });
}

function toStateError(error) {
  return Object.freeze({
    kind: error?.kind ?? "operational",
    code: error?.code ?? "AUTH_OPERATION_FAILED",
    message: error?.message ?? "Authentication operation failed.",
    status: error?.status ?? null,
  });
}
