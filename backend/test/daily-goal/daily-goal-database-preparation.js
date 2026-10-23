import {
  assertCiExclusiveDatabaseAuthorization,
  assertConnectedDatabaseIdentity,
} from "../helpers/test-environment.js";

export async function prepareDailyGoalDatabase({
  environment,
  operation,
  observeConnectedIdentity,
  executeProtectedOperation,
}) {
  const authorization = assertCiExclusiveDatabaseAuthorization(environment, {
    operation,
  });
  if (typeof observeConnectedIdentity !== "function") {
    throw new TypeError("A connected-target identity observer is required.");
  }
  if (typeof executeProtectedOperation !== "function") {
    throw new TypeError("A protected database operation is required.");
  }

  const observation = await observeConnectedIdentity(
    Object.freeze({ databaseUrl: authorization.databaseUrl }),
  );
  assertConnectedDatabaseIdentity(authorization, observation);

  return executeProtectedOperation(
    Object.freeze({
      databaseUrl: authorization.databaseUrl,
      operation: authorization.operation,
      targetIdentity: authorization.targetIdentity,
    }),
  );
}
