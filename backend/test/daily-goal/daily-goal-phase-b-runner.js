import { assertCiExclusiveDatabaseAuthorization, CI_DATABASE_OPERATIONS } from "../helpers/test-environment.js";
import { runDailyGoalPrismaReadOnlyObservation } from "./daily-goal-prisma-read-only-binding.js";
import {
  DAILY_GOAL_PHASE_B_FAILURE_CODES,
  normalizeDailyGoalPhaseBFailure,
} from "./daily-goal-phase-b-diagnostics.js";

export async function runDailyGoalPhaseBObservation({
  environment,
  expectedTarget,
  operation,
  loadPrismaClient,
}) {
  let authorization;
  try {
    authorization = assertCiExclusiveDatabaseAuthorization(environment, {
      operation: CI_DATABASE_OPERATIONS.OBSERVATION,
    });
  } catch (error) {
    throw normalizeDailyGoalPhaseBFailure(
      error,
      DAILY_GOAL_PHASE_B_FAILURE_CODES.CONFIG_REJECTED,
    );
  }
  return runDailyGoalPrismaReadOnlyObservation({
    authorization,
    expectedTarget,
    operation,
    loadPrismaClient,
  });
}
