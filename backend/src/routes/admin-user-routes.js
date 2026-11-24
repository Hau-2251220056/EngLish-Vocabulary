// @ts-nocheck
import express from "express";

export function createAdminUserRouter({
  adminUserController,
  authenticationMiddleware,
  adminAuthorizationMiddleware,
}) {
  const router = express.Router();

  router.use(authenticationMiddleware);
  router.use(adminAuthorizationMiddleware);
  router.get("/", adminUserController.list);
  router.get("/:userId", adminUserController.getById);

  return router;
}
