// @ts-nocheck

export function createLearningPathController({ learningPathService }) {
  return Object.freeze({
    readPath: handler((req) => learningPathService.getPath(req.user.id)),
    startPass: handler(
      (req) => learningPathService.startPass(req.user.id, req.params.setId, req.body),
      (result) => result.replayed || result.resumed ? 200 : 201,
    ),
    readPass: handler((req) => learningPathService.readPass(req.user.id, req.params.passId)),
    createNextSession: handler(
      (req) => learningPathService.createNextSession(req.user.id, req.params.passId, req.body),
      (result) => result.replayed || result.resumed || !result.session ? 200 : 201,
    ),
    restartPass: handler(
      (req) => learningPathService.restartPass(req.user.id, req.params.passId, req.body),
      (result) => result.replayed ? 200 : 201,
    ),
    completePass: handler((req) => learningPathService.completePass(req.user.id, req.params.passId, req.body)),
  });
}

function handler(action, status = () => 200) {
  return async (req, res, next) => {
    try {
      const data = await action(req);
      res.status(status(data)).json({ success: true, data });
    } catch (error) {
      const statusCode = statusByCode(error?.code);
      if (!statusCode) return next(error);
      res.status(statusCode).json({ success: false, error: { code: error.code, message: error.message } });
    }
  };
}

function statusByCode(code) {
  if (code === "CEFR_PATH_VALIDATION_ERROR") return 400;
  if (code === "CEFR_PASS_NOT_FOUND") return 404;
  if (code === "CEFR_LEVEL_LOCKED") return 403;
  if (typeof code === "string" && (code.startsWith("CEFR_PASS_") || code.startsWith("CEFR_CURRICULUM_") || code === "CEFR_SET_ALREADY_COMPLETED")) return 409;
  return null;
}
