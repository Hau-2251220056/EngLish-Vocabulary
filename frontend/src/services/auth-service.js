import { httpClient } from "./http-client.js";

const AUTH_ENDPOINTS = Object.freeze({
  register: "/api/auth/register",
  login: "/api/auth/login",
  logout: "/api/auth/logout",
  currentUser: "/api/auth/me",
});

export class AuthenticationApiError extends Error {
  constructor({ kind, code, message, status }) {
    super(message);
    this.name = "AuthenticationApiError";
    this.kind = kind;
    this.code = code;
    this.status = status;
  }
}

export function createAuthService(client = httpClient) {
  return {
    async register({ display_name, email, password }) {
      try {
        const response = await client.post(AUTH_ENDPOINTS.register, {
          display_name,
          email: normalizeEmail(email),
          password,
        });

        return response.data;
      } catch (error) {
        throw mapAuthenticationError(error);
      }
    },

    async login({ email, password }) {
      try {
        const response = await client.post(AUTH_ENDPOINTS.login, {
          email: normalizeEmail(email),
          password,
        });

        return response.data?.data?.user;
      } catch (error) {
        throw mapAuthenticationError(error);
      }
    },

    async logout() {
      try {
        await client.post(AUTH_ENDPOINTS.logout);
      } catch (error) {
        throw mapAuthenticationError(error);
      }
    },

    async getCurrentUser() {
      try {
        const response = await client.get(AUTH_ENDPOINTS.currentUser);
        return response.data?.data;
      } catch (error) {
        throw mapAuthenticationError(error);
      }
    },
  };
}

export function isAuthenticationFailure(error) {
  return (
    error instanceof AuthenticationApiError &&
    error.kind === "authentication"
  );
}

function normalizeEmail(email) {
  return typeof email === "string" ? email.toLowerCase() : email;
}

function mapAuthenticationError(error) {
  if (error instanceof AuthenticationApiError) {
    return error;
  }

  const status = error?.response?.status ?? null;
  const responseError = error?.response?.data?.error;
  const code = responseError?.code ?? "AUTH_OPERATION_FAILED";
  const isAuthenticationError =
    status === 401 && code === "AUTHENTICATION_FAILED";

  return new AuthenticationApiError({
    kind: isAuthenticationError
      ? "authentication"
      : status === null
        ? "operational"
        : "api",
    code,
    message:
      responseError?.message ??
      (status === null
        ? "Authentication service is unavailable."
        : "Authentication request failed."),
    status,
  });
}

export const authService = createAuthService();
