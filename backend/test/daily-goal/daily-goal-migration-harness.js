import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { assertCiExclusiveDatabaseAuthorization, CI_DATABASE_OPERATIONS } from "../helpers/test-environment.js";
import { withEphemeralMigrationActivation } from "./daily-goal-migration-activation.js";
import { compareMigrationInventory, verifyConnectedTarget } from "./daily-goal-migration-domain.js";

export async function orchestrateDailyGoalMigrationPhaseA({
  environment, repositoryRoot, manifestPath, expectedTarget, approvedPending,
  observeConnectedTarget, readTargetMigrationHistory, executeAuthorizedOperation,
}) {
  const authorization = assertCiExclusiveDatabaseAuthorization(environment, { operation: CI_DATABASE_OPERATIONS.MIGRATION });
  for (const callback of [observeConnectedTarget, readTargetMigrationHistory, executeAuthorizedOperation]) {
    if (typeof callback !== "function") throw new TypeError("All migration boundary callbacks are required.");
  }
  const connected = await observeConnectedTarget(Object.freeze({ databaseUrl: authorization.databaseUrl }));
  const verifiedTarget = verifyConnectedTarget({ authorization, expected: expectedTarget, ...connected });

  return withEphemeralMigrationActivation({ repositoryRoot, manifestPath, operation: async (activation) => {
    const reviewed = await readMigrationInventory(activation.migrationsPath);
    const target = await readTargetMigrationHistory(Object.freeze({
      targetBindingToken: verifiedTarget.targetBindingToken,
      targetBinding: verifiedTarget.binding,
      observation: verifiedTarget.observation,
    }));
    const inventory = compareMigrationInventory({ reviewed, target, approvedPending });
    const immediate = assertCiExclusiveDatabaseAuthorization(environment, { operation: CI_DATABASE_OPERATIONS.MIGRATION });
    if (immediate.targetIdentity !== authorization.targetIdentity || immediate.databaseUrl !== authorization.databaseUrl) {
      throw new Error("Migration authorization changed before execution.");
    }
    return executeAuthorizedOperation(Object.freeze({
      targetBindingToken: verifiedTarget.targetBindingToken,
      targetBinding: verifiedTarget.binding,
      targetIdentity: authorization.targetIdentity,
      artifact: activation.artifact,
      migrationsPath: activation.migrationsPath,
      inventory,
      operation: authorization.operation,
    }));
  }});
}

export async function readMigrationInventory(migrationsPath) {
  const entries = [];
  for (const directory of (await readdir(migrationsPath, { withFileTypes: true })).filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const bytes = await readFile(path.join(migrationsPath, directory.name, "migration.sql"));
    entries.push({ name: directory.name, checksum: createHash("sha256").update(bytes).digest("hex") });
  }
  return entries;
}
