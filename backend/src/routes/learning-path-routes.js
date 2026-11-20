// @ts-nocheck
import express from "express";

export function createLearningPathRouter({
  learningPathController,
  authenticationMiddleware,
  userAuthorizationMiddleware,
}) {
  const router = express.Router();
  router.use(authenticationMiddleware, userAuthorizationMiddleware);
  router.get("/", learningPathController.readPath);
  router.post("/sets/:setId/passes", learningPathController.startPass);
  router.get("/passes/:passId", learningPathController.readPass);
  router.post("/passes/:passId/sessions", learningPathController.createNextSession);
  router.post("/passes/:passId/restart", learningPathController.restartPass);
  router.post("/passes/:passId/complete", learningPathController.completePass);
  return router;
}
