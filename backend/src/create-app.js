// @ts-nocheck
// Importable application factory shared by local, test, and Vercel entry points.
import cookieParser from "cookie-parser";
import express from "express";
import { createAuthenticationController } from "./controllers/auth-controller.js";
import { createTopicController } from "./controllers/topic-controller.js";
import { createVocabularyController } from "./controllers/vocabulary-controller.js";
import { createAuthenticationMiddleware } from "./middleware/authentication-middleware.js";
import { createRoleAuthorizationMiddleware } from "./middleware/role-authorization-middleware.js";
import { createAuthSessionRepository } from "./repositories/auth-session-repository.js";
import { createTopicRepository } from "./repositories/topic-repository.js";
import { createUserRepository } from "./repositories/user-repository.js";
import { createVocabularyRepository } from "./repositories/vocabulary-repository.js";
import { createAuthenticationRouter } from "./routes/auth-routes.js";
import {
  createAdminTopicRouter,
  createPublicTopicRouter,
} from "./routes/topic-routes.js";
import { createAdminVocabularyRouter } from "./routes/vocabulary-routes.js";
import { createAuthenticationService } from "./services/authentication-service.js";
import { createTopicService } from "./services/topic-service.js";
import { createVocabularyService } from "./services/vocabulary-service.js";
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
  const topicRepository = createTopicRepository(prisma);
  const topicService = createTopicService({ topicRepository });
  const topicController = createTopicController({ topicService });
  const adminAuthorizationMiddleware = createRoleAuthorizationMiddleware({
    allowedRoles: ["ADMIN"],
  });
  const publicTopicRouter = createPublicTopicRouter({ topicController });
  const adminTopicRouter = createAdminTopicRouter({
    topicController,
    authenticationMiddleware,
    adminAuthorizationMiddleware,
  });
  const vocabularyRepository = createVocabularyRepository(prisma);
  const vocabularyService = createVocabularyService({ vocabularyRepository });
  const vocabularyController = createVocabularyController({ vocabularyService });
  const adminVocabularyRouter = createAdminVocabularyRouter({
    vocabularyController,
    authenticationMiddleware,
    adminAuthorizationMiddleware,
  });
  const app = express();

  app.use(express.json({ strict: false }));
  app.use(cookieParser());
  app.use("/api/auth", authRouter);
  app.use("/api/topics", publicTopicRouter);
  app.use("/api/admin/topics", adminTopicRouter);
  app.use("/api/admin/vocabulary", adminVocabularyRouter);

  app.get("/", (req, res) => {
    res.status(200).json({
      True: "OK",
    });
  });

  app.use((_error, _req, res, _next) => {
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    });
  });

  return app;
}
