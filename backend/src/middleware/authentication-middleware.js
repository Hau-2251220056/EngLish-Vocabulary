// @ts-nocheck
export function createAuthenticationMiddleware({ authenticationService }) {
  return async function authenticationMiddleware(req, res, next) {
    const sessionToken = req.cookies?.session_id;
    if (typeof sessionToken !== "string" || sessionToken.length === 0) {
      sendAuthenticationFailure(res);
      return;
    }

    try {
      req.user = await authenticationService.getCurrentUser(sessionToken);
      next();
    } catch (error) {
      if (error?.code === "AUTHENTICATION_FAILED") {
        sendAuthenticationFailure(res);
        return;
      }

      next(error);
    }
  };
}

function sendAuthenticationFailure(res) {
  res.status(401).json({
    success: false,
    error: {
      code: "AUTHENTICATION_FAILED",
      message: "Authentication failed.",
    },
  });
}