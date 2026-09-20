// @ts-nocheck
// Importable application factory shared by local, test, and Vercel entry points.
import cookieParser from "cookie-parser";
import express from "express";
import { createAuthenticationController } from "./controllers/auth-controller.js";
import { createAuthenticationMiddleware } from "./middleware/authentication-middleware.js";
import { createAuthSessionRepository } from "./repositories/auth-session-repository.js";
import { createUserRepository } from "./repositories/user-repository.js";
import { createAuthenticationRouter } from "./routes/auth-routes.js";
import { createAuthenticationService } from "./services/authentication-service.js";
import * as passwordSecurity from "./utils/password-security.js";

export function createApp({ prisma }) {
  if (!prisma) {
    throw new TypeError("A Prisma client is required to create the application.");
  }

  const userRepository = createUserRepository(prisma);
  const authSessionRepository = createAuthSessionRepository(prisma);
  const authenticationService = createAuthenticationService({
    userRepository,
    authSessionRepository,
    passwordSecurity,
  });
  const authenticationMiddleware = createAuthenticationMiddleware({
    authenticationService,
  });
  const authenticationController = createAuthenticationController({
    authenticationService,
  });
  const authRouter = createAuthenticationRouter({
    authenticationController,
    authenticationMiddleware,
  });
  const app = express();

  app.use(express.json({ strict: false }));
  app.use(cookieParser());
  app.use("/api/auth", authRouter);

  app.get("/", (req, res) => {
    res.status(200).json({
      True: "OK",
    });
  });

  return app;
}
