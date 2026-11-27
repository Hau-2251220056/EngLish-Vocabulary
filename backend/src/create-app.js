// @ts-nocheck
// Importable application factory shared by local, test, and Vercel entry points.
import cookieParser from "cookie-parser";
import express from "express";
import { createAuthenticationController } from "./controllers/auth-controller.js";
import { createTopicController } from "./controllers/topic-controller.js";
import { createVocabularyController } from "./controllers/vocabulary-controller.js";
import { createVocabularySetController } from "./controllers/vocabulary-set-controller.js";
import { createLearningController } from "./controllers/learning-controller.js";
import { createQuizController } from "./controllers/quiz-controller.js";
import { createLearningSessionController } from "./controllers/learning-session-controller.js";
import { createLearningPathController } from "./controllers/learning-path-controller.js";
import { createAuthenticationMiddleware } from "./middleware/authentication-middleware.js";
import { createRoleAuthorizationMiddleware } from "./middleware/role-authorization-middleware.js";
import {
  createRequestDiagnosticsMiddleware,
  createUnexpectedErrorMiddleware,
} from "./middleware/request-diagnostics-middleware.js";
import { createAuthSessionRepository } from "./repositories/auth-session-repository.js";
import { createAuthIdentityRepository } from "./repositories/auth-identity-repository.js";
import { createGoogleAuthChallengeRepository } from "./repositories/google-auth-challenge-repository.js";
import { createAdminUserRepository } from "./repositories/admin-user-repository.js";
import { createLoginAbuseRepository } from "./repositories/login-abuse-repository.js";
import { createTopicRepository } from "./repositories/topic-repository.js";
import { createUserRepository } from "./repositories/user-repository.js";
import { createVocabularyRepository } from "./repositories/vocabulary-repository.js";
import { createVocabularySetRepository } from "./repositories/vocabulary-set-repository.js";
import { createLearningRepository } from "./repositories/learning-repository.js";
import { createQuizRepository } from "./repositories/quiz-repository.js";
import { createLearningSessionRepository } from "./repositories/learning-session-repository.js";
import { createStreakRepository } from "./repositories/streak-repository.js";
import { createLearnerNotificationRepository } from "./repositories/learner-notification-repository.js";
import { createLearnerNotificationService } from "./services/learner-notification-service.js";
import { createLearnerNotificationController } from "./controllers/learner-notification-controller.js";
import { createLearnerNotificationRouter } from "./routes/learner-notification-routes.js";
import { createLearningPathRepository } from "./repositories/learning-path-repository.js";
import { createAuthenticationRouter } from "./routes/auth-routes.js";
import { createAdminUserRouter } from "./routes/admin-user-routes.js";
import { createLearningRouter } from "./routes/learning-routes.js";
import { createQuizRouter } from "./routes/quiz-routes.js";
import { createLearningSessionRouter, createUserStreakRouter } from "./routes/learning-session-routes.js";
import { createLearningPathRouter } from "./routes/learning-path-routes.js";
import {
  createAdminTopicRouter,
  createPublicTopicRouter,
} from "./routes/topic-routes.js";
import {
  createAdminVocabularyRouter,
  createUserPrivateVocabularyRouter,
} from "./routes/vocabulary-routes.js";
import {
  createAdminVocabularySetRouter,
  createPublicVocabularySetRouter,
  createUserVocabularySetRouter,
  createVocabularySetPickerRouter,
} from "./routes/vocabulary-set-routes.js";
import { createAuthenticationService } from "./services/authentication-service.js";
import { createGoogleAuthenticationService } from "./services/google-authentication-service.js";
import { createGoogleIdTokenVerifier } from "./security/google-id-token-verifier.js";
import { createAdminUserService } from "./services/admin-user-service.js";
import { createAdminUserController } from "./controllers/admin-user-controller.js";
import { createTopicService } from "./services/topic-service.js";
import { createVocabularyService } from "./services/vocabulary-service.js";
import { createVocabularySetService } from "./services/vocabulary-set-service.js";
import { createGlobalReviewAuthorizer, createLearningService } from "./services/learning-service.js";
import { createQuizService } from "./services/quiz-service.js";
import { createLearningSessionService, createStreakService } from "./services/learning-session-service.js";
import {
  createLearningPathActivityAuthorizer,
  createLearningPathFirstCreditRecorder,
  createLearningPathService,
} from "./services/learning-path-service.js";
import { createVocabularySetCoverStorage } from "./storage/vocabulary-set-cover-storage.js";
import { createVocabularySetCoverImageProcessor } from "./images/vocabulary-set-cover-image-processor.js";
import * as passwordSecurity from "./utils/password-security.js";
import { createLoginAbuseKeyFactory } from "./security/login-abuse-keys.js";

const TEST_LOGIN_ABUSE_SECRET = "test-only-login-abuse-secret-32-characters";

export function createApp({ prisma, learningNow, coverStorage, coverImageProcessor, diagnosticLogger, loginAbuseSecret, loginAbuseProxyMode, googleClientId, googleAllowedOrigins, googleOauthClient } = {}) {
  if (!prisma) {
    throw new TypeError("A Prisma client is required to create the application.");
  }

  const userRepository = createUserRepository(prisma);
  const authSessionRepository = createAuthSessionRepository(prisma);
  const configuredProxyMode = loginAbuseProxyMode ?? process.env.LOGIN_ABUSE_PROXY_MODE;
  if (process.env.NODE_ENV === "production" && !configuredProxyMode) {
    throw new TypeError("LOGIN_ABUSE_PROXY_MODE must be explicitly configured in production.");
  }
  const loginAbuseKeys = createLoginAbuseKeyFactory({
    secret: loginAbuseSecret ?? process.env.LOGIN_ABUSE_HMAC_SECRET
      ?? (process.env.NODE_ENV === "test" ? TEST_LOGIN_ABUSE_SECRET : undefined),
    proxyMode: configuredProxyMode ?? "direct",
  });
  const withLoginTransaction = (callback) => prisma.$transaction((transaction) => callback({
    userRepository: createUserRepository(transaction),
    authSessionRepository: createAuthSessionRepository(transaction),
    loginAbuseRepository: createLoginAbuseRepository(transaction),
  }));
  const resolvedGoogleClientId = googleClientId ?? process.env.GOOGLE_CLIENT_ID;
  const resolvedGoogleOrigins = parseAllowedOrigins(googleAllowedOrigins ?? process.env.GOOGLE_AUTH_ALLOWED_ORIGINS);
  const googleVerifier = createGoogleIdTokenVerifier({ clientId: resolvedGoogleClientId, oauthClient: googleOauthClient });
  const withGoogleTransaction = (callback) => prisma.$transaction((transaction) => callback({
    userRepository: createUserRepository(transaction),
    authSessionRepository: createAuthSessionRepository(transaction),
    authIdentityRepository: createAuthIdentityRepository(transaction),
    challengeRepository: createGoogleAuthChallengeRepository(transaction),
  }));
  const withChallengeTransaction = (callback) => prisma.$transaction((transaction) => callback({
    challengeRepository: createGoogleAuthChallengeRepository(transaction),
    loginAbuseRepository: createLoginAbuseRepository(transaction),
  }));
  const authenticationService = createAuthenticationService({
    userRepository,
    authSessionRepository,
    passwordSecurity,
    loginAbuseKeys,
    withLoginTransaction,
  });
  const googleAuthenticationService = createGoogleAuthenticationService({
    verifier: googleVerifier,
    withGoogleTransaction,
    withChallengeTransaction,
    loginAbuseKeys,
  });
  const authenticationMiddleware = createAuthenticationMiddleware({
    authenticationService,
  });
  const authenticationController = createAuthenticationController({
    authenticationService,
    googleAuthenticationService,
    googleAllowedOrigins: resolvedGoogleOrigins,
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
  const adminUserRepository = createAdminUserRepository(prisma);
  const adminUserService = createAdminUserService({ adminUserRepository });
  const adminUserController = createAdminUserController({ adminUserService });
  const adminUserRouter = createAdminUserRouter({
    adminUserController,
    authenticationMiddleware,
    adminAuthorizationMiddleware,
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
  const vocabularySetService = createVocabularySetService({
    vocabularySetRepository,
    coverStorage: coverStorage ?? createVocabularySetCoverStorage(),
    coverImageProcessor: coverImageProcessor ?? createVocabularySetCoverImageProcessor(),
  });
  const vocabularySetController = createVocabularySetController({ vocabularySetService });
  const publicVocabularySetRouter = createPublicVocabularySetRouter({ vocabularySetController });
  const adminVocabularySetRouter = createAdminVocabularySetRouter({
    vocabularySetController,
    authenticationMiddleware,
    adminAuthorizationMiddleware,
  });
  const userAuthorizationMiddleware = createRoleAuthorizationMiddleware({ allowedRoles: ["USER"] });
  const userPrivateVocabularyRouter = createUserPrivateVocabularyRouter({
    vocabularyController,
    authenticationMiddleware,
    userAuthorizationMiddleware,
  });
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
  const learningPathRepository = createLearningPathRepository(prisma);
  const authorizeSetActivity = createLearningPathActivityAuthorizer({
    createLearningPathRepository,
  });
  const authorizeGlobalReview = createGlobalReviewAuthorizer({
    createLearningRepository,
    createLearningPathRepository,
  });
  const recordLearningPathFirstCredit = createLearningPathFirstCreditRecorder({
    createLearningPathRepository,
  });
  const learningPathService = createLearningPathService({
    learningPathRepository,
    createSessionRepository: createLearningSessionRepository,
    ...(learningNow ? { now: learningNow } : {}),
  });
  const learningPathController = createLearningPathController({ learningPathService });
  const learningPathRouter = createLearningPathRouter({
    learningPathController,
    authenticationMiddleware,
    userAuthorizationMiddleware,
  });
  const learningService = createLearningService({
    learningRepository,
    createSessionRepository: createLearningSessionRepository,
    createStreakRepository,
    createLearningPathRepository,
    recordLearningPathFirstCredit,
    authorizeSetActivity,
    authorizeGlobalReview,
    ...(learningNow ? { now: learningNow } : {}),
  });
  const learningController = createLearningController({ learningService });
  const learningRouter = createLearningRouter({
    learningController,
    authenticationMiddleware,
    userAuthorizationMiddleware,
  });
  const quizRepository = createQuizRepository(prisma);
  const quizService = createQuizService({
    quizRepository,
    createSessionRepository: createLearningSessionRepository,
    createStreakRepository,
    authorizeSetActivity,
    ...(learningNow ? { now: learningNow } : {}),
  });
  const quizController = createQuizController({ quizService });
  const quizRouter = createQuizRouter({
    quizController,
    authenticationMiddleware,
    userAuthorizationMiddleware,
  });
  const withStreakTransaction = (callback) => prisma.$transaction(
    (transaction) => callback(transaction),
    { maxWait: 10_000, timeout: 30_000 },
  );
  const learningSessionService = createLearningSessionService({
    withTransaction: withStreakTransaction,
    createSessionRepository: createLearningSessionRepository,
    createStreakRepository,
    createLearningRepository,
    recordLearningPathFirstCredit,
    authorizeSetActivity,
    authorizeGlobalReview,
    ...(learningNow ? { now: learningNow } : {}),
  });
  const streakService = createStreakService({
    withTransaction: withStreakTransaction,
    createStreakRepository,
    ...(learningNow ? { now: learningNow } : {}),
  });
  const learningSessionController = createLearningSessionController({ learningSessionService, streakService });
  const learningSessionRouter = createLearningSessionRouter({
    controller: learningSessionController,
    authenticationMiddleware,
    userAuthorizationMiddleware,
  });
  const userStreakRouter = createUserStreakRouter({
    controller: learningSessionController,
    authenticationMiddleware,
    userAuthorizationMiddleware,
  });
  const app = express();

  app.use(createRequestDiagnosticsMiddleware());
  app.use(express.json({ strict: false }));
  app.use(cookieParser());
  app.use("/api/auth", authRouter);
  app.use("/api/topics", publicTopicRouter);
  app.use("/api", publicVocabularySetRouter);
  app.use("/api", vocabularySetPickerRouter);
  app.use("/api", userVocabularySetRouter);
  app.use("/api/my/vocabulary", userPrivateVocabularyRouter);
  app.use("/api/learning", learningRouter);
  app.use("/api/learning-path", learningPathRouter);
  app.use("/api/quiz", quizRouter);
  app.use("/api/learning-sessions", learningSessionRouter);
  const learnerNotificationRouter = createLearnerNotificationRouter({
    controller: createLearnerNotificationController(createLearnerNotificationService({
      repository: createLearnerNotificationRepository(prisma),
      activatedAt: process.env.NOTIFICATIONS_ACTIVATED_AT,
    })),
    authenticationMiddleware,
    userAuthorizationMiddleware,
  });
  app.use("/api/users/me/notifications", learnerNotificationRouter);
  app.use("/api/users/me", userStreakRouter);
  app.use("/api/admin/topics", adminTopicRouter);
  app.use("/api/admin/users", adminUserRouter);
  app.use("/api/admin/vocabulary", adminVocabularyRouter);
  app.use("/api/admin/vocabulary-sets", adminVocabularySetRouter);

  app.get("/", (req, res) => {
    res.status(200).json({
      True: "OK",
    });
  });

  app.use(createUnexpectedErrorMiddleware({ logger: diagnosticLogger ?? console }));

  return app;
}

function parseAllowedOrigins(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || value.trim() === "") return [];
  return value.split(",").map((origin) => origin.trim()).filter((origin) => {
    try {
      const parsed = new URL(origin);
      return parsed.origin === origin && (parsed.protocol === "https:" || parsed.hostname === "localhost");
    } catch {
      return false;
    }
  });
}
