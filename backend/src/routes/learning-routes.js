// @ts-nocheck
import express from "express";

export function createLearningRouter({
  learningController,
  authenticationMiddleware,
  userAuthorizationMiddleware,
}) {
  const router = express.Router();
  router.use(authenticationMiddleware);
  router.use(userAuthorizationMiddleware);
  router.get("/sets/:setId", learningController.getSet);
  router.post("/events", learningController.recordEvent);
  return router;
}
