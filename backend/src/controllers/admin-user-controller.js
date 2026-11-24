// @ts-nocheck
export function createAdminUserController({ adminUserService }) {
  return {
    async list(req, res, next) {
      try {
        const result = await adminUserService.listUsers(req.query);
        res.status(200).json({ success: true, data: result });
      } catch (error) {
        handleKnownError(error, res, next);
      }
    },

    async getById(req, res, next) {
      try {
        const user = await adminUserService.getUser(req.params.userId);
        res.status(200).json({ success: true, data: user });
      } catch (error) {
        handleKnownError(error, res, next);
      }
    },
  };
}

function handleKnownError(error, res, next) {
  const statusByCode = {
    VALIDATION_ERROR: 400,
    USER_NOT_FOUND: 404,
  };
  const status = statusByCode[error?.code];
  if (!status) {
    next(error);
    return;
  }

  res.status(status).json({
    success: false,
    error: { code: error.code, message: error.message },
  });
}
