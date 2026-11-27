import { LearnerNotificationError } from "../services/learner-notification-service.js";

export function createLearnerNotificationController(service) {
  function handle(action) {
    return async (req, res, next) => {
      try {
        res.json({ success: true, data: await action(req) });
      } catch (error) {
        if (!(error instanceof LearnerNotificationError)) return next(error);
        res.status(error.status).json({ success: false, error: { code: error.code, message: error.message } });
      }
    };
  }
  return {
    list: handle((req) => service.list(req.user.id, req.query)),
    refresh: handle((req) => service.refresh(req.user.id, req.query)),
    markOne: handle((req) => service.markOne(req.user.id, req.params.id)),
    markAll: handle((req) => service.markAll(req.user.id)),
  };
}
