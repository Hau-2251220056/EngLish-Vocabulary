// @ts-nocheck
const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_COOKIE_NAME = "session_id";

export function createAuthenticationController({ authenticationService }) {
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
        });

        res.cookie(SESSION_COOKIE_NAME, sessionToken, {
          httpOnly: true,
          maxAge: SESSION_LIFETIME_MS,
          path: "/",
          secure: isSecureRequest(req),
        });

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
  });
}

function isSecureRequest(req) {
  return process.env.NODE_ENV === "production" || req.secure === true;
}

function handleKnownServiceError(error, res, next) {
  const statusByCode = {
    VALIDATION_ERROR: 400,
    EMAIL_ALREADY_EXISTS: 409,
    AUTHENTICATION_FAILED: 401,
  };
  const status = statusByCode[error?.code];

  if (!status) {
    next(error);
    return;
  }

  res.status(status).json({
    success: false,
    error: {
      code: error.code,
      message: error.message,
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
