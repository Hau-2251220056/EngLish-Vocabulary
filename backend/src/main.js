// @ts-nocheck
import { PrismaClient } from "./generated/prisma/client.ts";
import cookieParser from "cookie-parser";
import express from "express";
import { createAuthenticationController } from "./controllers/auth-controller.js";
import { createAuthenticationMiddleware } from "./middleware/authentication-middleware.js";
import { createAuthSessionRepository } from "./repositories/auth-session-repository.js";
import { createUserRepository } from "./repositories/user-repository.js";
import { createAuthenticationService } from "./services/authentication-service.js";
import * as passwordSecurity from "./utils/password-security.js";
import { createAuthenticationRouter } from "./routes/auth-routes.js";

const app = express();
const PORT = process.env.PORT || 5000;
const prisma = new PrismaClient();
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

app.use(express.json());
app.use(cookieParser());
app.use("/api/auth", authRouter);

app.get("/", (req, res) => {
  res.status(200).json({
    True: "OK",
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
