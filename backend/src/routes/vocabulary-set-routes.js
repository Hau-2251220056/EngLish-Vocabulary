// @ts-nocheck
import express from "express";

export function createPublicVocabularySetRouter({ vocabularySetController }) {
  const router = express.Router();
  router.get("/topics/:topicId/vocabulary-sets", vocabularySetController.listPublicByTopic);
  router.get("/vocabulary-sets/:setId", vocabularySetController.getPublicById);
  return router;
}

export function createAdminVocabularySetRouter({
  vocabularySetController,
  authenticationMiddleware,
  adminAuthorizationMiddleware,
}) {
  const router = express.Router();
  router.use(authenticationMiddleware);
  router.use(adminAuthorizationMiddleware);
  router.get("/", vocabularySetController.listSystem);
  router.get("/:setId", vocabularySetController.getSystemById);
  router.post("/", vocabularySetController.createSystem);
  router.patch("/:setId", vocabularySetController.updateSystem);
  router.delete("/:setId", vocabularySetController.deleteSystem);
  return router;
}

export function createUserVocabularySetRouter({
  vocabularySetController,
  authenticationMiddleware,
  userAuthorizationMiddleware,
}) {
  const router = express.Router();
  const middleware = [authenticationMiddleware, userAuthorizationMiddleware];
  router.get("/my/vocabulary-sets", ...middleware, vocabularySetController.listPrivate);
  router.get("/my/vocabulary-sets/:setId", ...middleware, vocabularySetController.getPrivate);
  router.post("/my/vocabulary-sets", ...middleware, vocabularySetController.createPrivate);
  router.patch("/my/vocabulary-sets/:setId", ...middleware, vocabularySetController.updatePrivate);
  router.delete("/my/vocabulary-sets/:setId", ...middleware, vocabularySetController.deletePrivate);
  router.post("/vocabulary-sets/:setId/copy", ...middleware, vocabularySetController.copySystem);
  return router;
}

export function createVocabularySetPickerRouter({ vocabularySetController, authenticationMiddleware }) {
  const router = express.Router();
  router.get("/vocabulary-set-picker", authenticationMiddleware, vocabularySetController.searchPicker);
  return router;
}
