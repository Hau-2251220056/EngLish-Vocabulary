// @ts-nocheck
// Importable application factory shared by local, test, and Vercel entry points.
import cookieParser from "cookie-parser";
import express from "express";
import { createAuthenticationController } from "./controllers/auth-controller.js";
import { createTopicController } from "./controllers/topic-controller.js";
import { createVocabularyController } from "./controllers/vocabulary-controller.js";
import { createVocabularySetController } from "./controllers/vocabulary-set-controller.js";
import { createLearningController } from "./controllers/learning-controller.js";
import { createAuthenticationMiddleware } from "./middleware/authentication-middleware.js";
import { createRoleAuthorizationMiddleware } from "./middleware/role-authorization-middleware.js";
import { createAuthSessionRepository } from "./repositories/auth-session-repository.js";
import { createTopicRepository } from "./repositories/topic-repository.js";
import { createUserRepository } from "./repositories/user-repository.js";
import { createVocabularyRepository } from "./repositories/vocabulary-repository.js";
import { createVocabularySetRepository } from "./repositories/vocabulary-set-repository.js";
import { createLearningRepository } from "./repositories/learning-repository.js";
import { createAuthenticationRouter } from "./routes/auth-routes.js";
import { createLearningRouter } from "./routes/learning-routes.js";
import {
  createAdminTopicRouter,
  createPublicTopicRouter,
} from "./routes/topic-routes.js";
import { createAdminVocabularyRouter } from "./routes/vocabulary-routes.js";
import {
  createAdminVocabularySetRouter,
  createPublicVocabularySetRouter,
  createUserVocabularySetRouter,
  createVocabularySetPickerRouter,
} from "./routes/vocabulary-set-routes.js";
import { createAuthenticationService } from "./services/authentication-service.js";
import { createTopicService } from "./services/topic-service.js";
import { createVocabularyService } from "./services/vocabulary-service.js";
import { createVocabularySetService } from "./services/vocabulary-set-service.js";
import { createLearningService } from "./services/learning-service.js";
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
  const vocabularySetRepository = createVocabularySetRepository(prisma);
  const vocabularySetService = createVocabularySetService({ vocabularySetRepository });
  const vocabularySetController = createVocabularySetController({ vocabularySetService });
  const publicVocabularySetRouter = createPublicVocabularySetRouter({ vocabularySetController });
  const adminVocabularySetRouter = createAdminVocabularySetRouter({
    vocabularySetController,
    authenticationMiddleware,
    adminAuthorizationMiddleware,
  });
  const userAuthorizationMiddleware = createRoleAuthorizationMiddleware({ allowedRoles: ["USER"] });
  const userVocabularySetRouter = createUserVocabularySetRouter({
    vocabularySetController,
    authenticationMiddleware,
    userAuthorizationMiddleware,
  });
  const vocabularySetPickerRouter = createVocabularySetPickerRouter({
    vocabularySetController,
    authenticationMiddleware,
  });
  const learningRepository = createLearningRepository(prisma);
  const learningService = createLearningService({ learningRepository });
  const learningController = createLearningController({ learningService });
  const learningRouter = createLearningRouter({
    learningController,
    authenticationMiddleware,
    userAuthorizationMiddleware,
  });
  const app = express();

  app.use(express.json({ strict: false }));
  app.use(cookieParser());
  app.use("/api/auth", authRouter);
  app.use("/api/topics", publicTopicRouter);
  app.use("/api", publicVocabularySetRouter);
  app.use("/api", vocabularySetPickerRouter);
  app.use("/api", userVocabularySetRouter);
  app.use("/api/learning", learningRouter);
  app.use("/api/admin/topics", adminTopicRouter);
  app.use("/api/admin/vocabulary", adminVocabularyRouter);
  app.use("/api/admin/vocabulary-sets", adminVocabularySetRouter);

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
