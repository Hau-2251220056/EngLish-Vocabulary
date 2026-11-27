import express from "express";

export function createLearnerNotificationRouter({ controller, authenticationMiddleware, userAuthorizationMiddleware }) {
  const router = express.Router();
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store, private");
    next();
  });
  router.use(authenticationMiddleware, userAuthorizationMiddleware);
  router.get("/", controller.list);
  router.post("/refresh", requireNotificationMutation, controller.refresh);
  router.patch("/:id/read", requireNotificationMutation, controller.markOne);
  router.post("/read-all", requireNotificationMutation, controller.markAll);
  return router;
}

// The browser uses the same-origin /api rewrite. A custom header disallows
// simple cross-origin mutations, and the app does not enable cross-origin CORS.
function requireNotificationMutation(req, res, next) {
  const site = req.get("sec-fetch-site");
  if (req.get("x-elvocab-notification") === "1" && (!site || site === "same-origin")) return next();
  return res.status(403).json({ success: false, error: {
    code: "NOTIFICATION_ORIGIN_FORBIDDEN", message: "Notification mutation origin is not allowed.",
  } });
}
