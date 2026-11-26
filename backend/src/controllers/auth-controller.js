// @ts-nocheck
const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_COOKIE_NAME = "session_id";
const GOOGLE_BINDING_COOKIE_NAME = "google_auth_binding";
const GOOGLE_CHALLENGE_LIFETIME_MS = 5 * 60 * 1000;

export function createAuthenticationController({ authenticationService, googleAuthenticationService, googleAllowedOrigins = [] }) {
  return {
    async register(req, res, next) {
      const { display_name, email, password } = req.body ?? {};

      try {
        await authenticationService.register({
          display_name,
          email,
          password,
        });

        res.status(201).json({
          success: true,
          message: "Registration successful",
        });
      } catch (error) {
        handleKnownServiceError(error, res, next);
      }
    },

    async login(req, res, next) {
      const { email, password } = req.body ?? {};

      try {
        const { user, sessionToken } = await authenticationService.login({
          email,
          password,
          source: req,
        });

        setSessionCookie(req, res, sessionToken);

        res.status(200).json({
          success: true,
          data: {
            user: toPublicUserIdentity(user),
          },
        });
      } catch (error) {
        handleKnownServiceError(error, res, next);
      }
    },

    async createGoogleChallenge(req, res, next) {
      if (!isAllowedGoogleOrigin(req, googleAllowedOrigins)) {
        sendGoogleError(res, "GOOGLE_AUTHENTICATION_FAILED", 403);
        return;
      }
      try {
        const challenge = await googleAuthenticationService.createChallenge(
          req.cookies?.[GOOGLE_BINDING_COOKIE_NAME],
          req,
        );
        res.cookie(GOOGLE_BINDING_COOKIE_NAME, challenge.binding, {
          httpOnly: true,
          maxAge: GOOGLE_CHALLENGE_LIFETIME_MS,
          path: "/api/auth/google",
          sameSite: "strict",
          secure: isSecureRequest(req),
        });
        res.status(201).json({
          success: true,
          data: { nonce: challenge.nonce, expires_at: challenge.expiresAt.toISOString() },
        });
      } catch (error) {
        handleKnownServiceError(error, res, next);
      }
    },

    async googleLogin(req, res, next) {
      if (!isAllowedGoogleOrigin(req, googleAllowedOrigins)) {
        clearGoogleBindingCookie(res);
        sendGoogleError(res, "GOOGLE_AUTHENTICATION_FAILED", 403);
        return;
      }
      try {
        const { user, sessionToken } = await googleAuthenticationService.authenticate({
          credential: req.body?.credential,
          browserBinding: req.cookies?.[GOOGLE_BINDING_COOKIE_NAME],
        });
        clearGoogleBindingCookie(res);
        setSessionCookie(req, res, sessionToken);
        res.status(200).json({ success: true, data: { user: toPublicUserIdentity(user) } });
      } catch (error) {
        clearGoogleBindingCookie(res);
        handleKnownServiceError(error, res, next);
      }
    },

    async logout(req, res, next) {
      const sessionToken = req.cookies?.[SESSION_COOKIE_NAME];

      try {
        await authenticationService.logout(sessionToken);
      } catch (error) {
        clearSessionCookie(res);
        next(error);
        return;
      }

      clearSessionCookie(res);
      res.status(204).send();
    },

    async getCurrentUser(req, res, next) {
      if (!req.user) {
        next(
          new Error(
            "Authenticated user is required before current-user controller.",
          ),
        );
        return;
      }

      res.status(200).json({
        success: true,
        data: toPublicUserIdentity(req.user),
      });
    },
  };
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE_NAME, {
    path: "/",
    sameSite: "lax",
  });
}

function clearGoogleBindingCookie(res) {
  res.clearCookie(GOOGLE_BINDING_COOKIE_NAME, {
    path: "/api/auth/google",
    sameSite: "strict",
  });
}

function setSessionCookie(req, res, sessionToken) {
  res.cookie(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    maxAge: SESSION_LIFETIME_MS,
    path: "/",
    sameSite: "lax",
    secure: isSecureRequest(req),
  });
}

function isAllowedGoogleOrigin(req, allowedOrigins) {
  const origin = req.get("origin");
  return typeof origin === "string" && allowedOrigins.includes(origin);
}

function sendGoogleError(res, code, status) {
  res.status(status).json({ success: false, error: { code, message: "Google authentication failed." } });
}

function isSecureRequest(req) {
  return process.env.NODE_ENV === "production" || req.secure === true;
}

function handleKnownServiceError(error, res, next) {
  const statusByCode = {
    VALIDATION_ERROR: 400,
    EMAIL_ALREADY_EXISTS: 409,
    AUTHENTICATION_FAILED: 401,
    AUTHENTICATION_WARNING: 401,
    AUTHENTICATION_LOCKED: 429,
    GOOGLE_AUTHENTICATION_FAILED: 401,
    GOOGLE_ACCOUNT_LINK_REQUIRED: 409,
    GOOGLE_AUTH_UNAVAILABLE: 503,
    GOOGLE_AUTH_RATE_LIMITED: 429,
  };
  const status = statusByCode[error?.code];

  if (!status) {
    next(error);
    return;
  }

  if (error.code === "AUTHENTICATION_LOCKED") {
    res.set("Retry-After", String(error.details.retry_after_seconds));
  }
  if (error.code === "GOOGLE_AUTH_RATE_LIMITED") {
    res.set("Retry-After", "60");
  }
  res.status(status).json({
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...error.details,
    },
  });
}

function toPublicUserIdentity(user) {
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    role: user.role,
  };
}
