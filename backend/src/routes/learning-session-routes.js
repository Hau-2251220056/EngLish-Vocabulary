// @ts-nocheck
import express from "express";

export function createLearningSessionRouter({ controller, authenticationMiddleware, userAuthorizationMiddleware }) {
  const router = express.Router();
  router.use(authenticationMiddleware, userAuthorizationMiddleware);
  router.post("/", controller.create);
  router.get("/:sessionId", controller.read);
  router.put("/:sessionId/items/:vocabularyId/reveal", controller.reveal);
  router.post("/:sessionId/complete", controller.complete);
  return router;
}

export function createUserStreakRouter({ controller, authenticationMiddleware, userAuthorizationMiddleware }) {
  const router = express.Router();
  router.use(authenticationMiddleware, userAuthorizationMiddleware);
  router.get("/streak", controller.readStreak);
  return router;
}
