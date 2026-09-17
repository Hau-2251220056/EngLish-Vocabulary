// @ts-nocheck
import express from "express";

export function createAuthenticationRouter({
  authenticationController,
  authenticationMiddleware,
}) {
  const router = express.Router();

  router.post("/register", authenticationController.register);
  router.post("/login", authenticationController.login);
  router.post("/logout", authenticationController.logout);
  router.get(
    "/me",
    authenticationMiddleware,
    authenticationController.getCurrentUser,
  );

  return router;
}
