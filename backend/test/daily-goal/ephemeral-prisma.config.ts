import { defineConfig, env } from "prisma/config";

export default defineConfig({
  datasource: {
    url: env("DAILY_GOAL_EPHEMERAL_JOB_DATABASE_URL"),
  },
});
