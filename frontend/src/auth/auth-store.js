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
});

export function createAuthenticationStore(authService = defaultAuthService) {
  let state = { ...INITIAL_STATE };
  let initializationPromise = null;
  let initializationStarted = false;
  const listeners = new Set();

  function getSnapshot() {
    return state;
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function setState(nextState) {
    state = nextState;
    listeners.forEach((listener) => listener());
  }

  function setGuest(authError = null, sessionExpired = false) {
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      authError,
      sessionExpired,
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
      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        authError: null,
        sessionExpired: false,
      });
      return user;
    } catch (error) {
      setGuest(toStateError(error));
      throw error;
    }
  }

  async function logout() {
    setState({ ...state, authError: null, sessionExpired: false });

    try {
      await authService.logout();
      setGuest();
    } catch (error) {
      setState({ ...state, authError: toStateError(error) });
      throw error;
    }
  }

  async function refreshCurrentUser() {
    const hadAuthenticatedSession = state.isAuthenticated;
    setState({ ...state, isLoading: true, authError: null });

    try {
      const user = await authService.getCurrentUser();
      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        authError: null,
        sessionExpired: false,
      });
      return user;
    } catch (error) {
      if (isAuthenticationFailure(error)) {
        setGuest(null, hadAuthenticatedSession);
        return null;
      }

      setGuest(toStateError(error));
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
