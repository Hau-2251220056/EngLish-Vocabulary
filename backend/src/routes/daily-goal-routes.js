// @ts-nocheck
import express from "express";
export function createDailyGoalRouter({ controller, authenticationMiddleware, userAuthorizationMiddleware }) {
  const router = express.Router();
  router.use(authenticationMiddleware, userAuthorizationMiddleware);
  router.get("/", controller.getGoal);
  router.put("/", controller.updateGoal);
  router.post("/tracking-sessions", controller.establish);
  router.post("/tracking-sessions/:id/engagement", controller.engage);
  router.post("/tracking-sessions/:id/heartbeat", controller.heartbeat);
  router.post("/tracking-sessions/:id/pause", controller.pause);
  router.post("/tracking-sessions/:id/close", controller.close);
  return router;
}

export function createNotificationRouter({ controller, authenticationMiddleware, userAuthorizationMiddleware }) {
  const router = express.Router();
  router.use(authenticationMiddleware, userAuthorizationMiddleware);
  router.get("/", controller.listNotifications);
  router.get("/unread-count", controller.countUnreadNotifications);
  router.patch("/:id/read", controller.markNotificationRead);
  return router;
}
