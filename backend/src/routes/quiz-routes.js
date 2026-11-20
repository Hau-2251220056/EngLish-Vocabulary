// @ts-nocheck
import express from "express";

export function createQuizRouter({
  quizController,
  authenticationMiddleware,
  userAuthorizationMiddleware,
}) {
  const router = express.Router();
  router.use(authenticationMiddleware);
  router.use(userAuthorizationMiddleware);
  router.get("/sets/:setId/questions", quizController.getQuestions);
  router.post("/answers", quizController.recordAnswer);
  return router;
}
