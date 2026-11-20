// @ts-nocheck
const AUTHORIZED_ROLES = new Set(["USER", "ADMIN"]);
const FORBIDDEN_MESSAGE = "You do not have permission to perform this action.";

export function createRoleAuthorizationMiddleware({ allowedRoles }) {
  return function roleAuthorizationMiddleware(req, res, next) {
    if (!req.user) {
      next(
        new Error("Authenticated user is required before role authorization."),
      );
      return;
    }

    const role = req.user.role;
    if (!AUTHORIZED_ROLES.has(role) || !allowedRoles.includes(role)) {
      sendForbidden(res);
      return;
    }

    next();
  };
}

function sendForbidden(res) {
  res.status(403).json({
    success: false,
    error: {
      code: "FORBIDDEN",
      message: FORBIDDEN_MESSAGE,
    },
  });
}
