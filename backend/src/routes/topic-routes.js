// @ts-nocheck
import express from "express";

export function createPublicTopicRouter({ topicController }) {
  const router = express.Router();

  router.get("/", topicController.list);
  router.get("/:topicId", topicController.getById);

  return router;
}

export function createAdminTopicRouter({
  topicController,
  authenticationMiddleware,
  adminAuthorizationMiddleware,
}) {
  const router = express.Router();

  router.use(authenticationMiddleware);
  router.use(adminAuthorizationMiddleware);
  router.post("/", topicController.create);
  router.patch("/:topicId", topicController.update);
  router.delete("/:topicId", topicController.delete);

  return router;
}
