// @ts-nocheck
import express from "express";

export function createAdminVocabularyRouter({
  vocabularyController,
  authenticationMiddleware,
  adminAuthorizationMiddleware,
}) {
  const router = express.Router();

  router.use(authenticationMiddleware);
  router.use(adminAuthorizationMiddleware);
  router.get("/", vocabularyController.list);
  router.get("/:vocabularyId", vocabularyController.getById);
  router.post("/", vocabularyController.create);
  router.patch("/:vocabularyId", vocabularyController.update);
  router.delete("/:vocabularyId", vocabularyController.delete);

  return router;
}
