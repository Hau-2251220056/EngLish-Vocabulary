import express from "express";
import { LeaderboardError } from "../services/leaderboard-service.js";

export function createLeaderboardRouter({ service, authenticationMiddleware, userAuthorizationMiddleware }) {
  const router = express.Router();
  router.use((_req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    next();
  });
  router.use(authenticationMiddleware, userAuthorizationMiddleware);
  router.get("/", async (req, res, next) => {
    try {
      res.json({ success: true, data: await service.list(req.user.id, req.query) });
    } catch (error) {
      if (!(error instanceof LeaderboardError)) return next(error);
      res.status(error.status).json({ success: false, error: { code: error.code, message: error.message } });
    }
  });
  return router;
}
