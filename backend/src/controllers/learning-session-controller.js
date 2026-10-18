// @ts-nocheck
export function createLearningSessionController({ learningSessionService, streakService }) {
  return Object.freeze({
    create: handler(async (req) => learningSessionService.createSession(req.user.id, req.body), (result) => result.replayed ? 200 : result.session ? 201 : 200),
    read: handler((req) => learningSessionService.readSession(req.user.id, req.params.sessionId)),
    reveal: handler((req) => learningSessionService.acknowledgeNormalReveal(req.user.id, req.params.sessionId, req.params.vocabularyId, req.body)),
    complete: handler((req) => learningSessionService.completeNormalSession(req.user.id, req.params.sessionId, req.body)),
    readStreak: handler((req) => streakService.getCurrentStreak(req.user.id)),
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
  if (code === "LEARNING_SESSION_VALIDATION_ERROR") return 400;
  if (code === "LEARNING_SESSION_NOT_FOUND") return 404;
  if (typeof code === "string" && code.startsWith("LEARNING_SESSION_")) return 409;
  return null;
}
