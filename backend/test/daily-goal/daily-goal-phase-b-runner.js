import { assertCiExclusiveDatabaseAuthorization, CI_DATABASE_OPERATIONS } from "../helpers/test-environment.js";
import { runDailyGoalPrismaReadOnlyObservation } from "./daily-goal-prisma-read-only-binding.js";

export async function runDailyGoalPhaseBObservation({
  environment,
  expectedTarget,
  operation,
  loadPrismaClient,
}) {
  const authorization = assertCiExclusiveDatabaseAuthorization(environment, {
    operation: CI_DATABASE_OPERATIONS.OBSERVATION,
  });
  return runDailyGoalPrismaReadOnlyObservation({
    authorization,
    expectedTarget,
    operation,
    loadPrismaClient,
  });
}
