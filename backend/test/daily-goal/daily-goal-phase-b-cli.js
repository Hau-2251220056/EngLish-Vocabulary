import { pathToFileURL } from "node:url";
import { runDailyGoalPhaseBObservation } from "./daily-goal-phase-b-runner.js";
import { CI_EXCLUSIVE_OWNERSHIP_PREFIX } from "./daily-goal-read-only-observer.js";

const SAFE_TEXT = /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,255}$/;
const REQUIRED_CONFIGURATION = Object.freeze({
  targetIdentity: "DAILY_GOAL_APPROVED_TARGET_IDENTITY",
  databaseName: "DAILY_GOAL_EXPECTED_DATABASE_NAME",
  schemaName: "DAILY_GOAL_EXPECTED_SCHEMA_NAME",
  ownershipMarker: "DAILY_GOAL_EXPECTED_OWNERSHIP_MARKER",
});

export async function runDailyGoalPhaseBCli({
  environment = process.env,
  writeOutput = (value) => process.stdout.write(`${value}\n`),
  runObservation = runDailyGoalPhaseBObservation,
} = {}) {
  try {
    const expectedTarget = readExpectedTarget(environment);
    const summary = await runObservation({
      environment,
      expectedTarget,
      operation: createSummary,
    });
    writeOutput(JSON.stringify(summary));
    return summary;
  } catch {
    throw cliError();
  }
}

export function readExpectedTarget(environment) {
  const target = {};
  for (const [field, name] of Object.entries(REQUIRED_CONFIGURATION)) {
    const value = environment?.[name];
    if (typeof value !== "string" || !SAFE_TEXT.test(value)) throw cliError();
    target[field] = value;
  }
  if (target.ownershipMarker !== `${CI_EXCLUSIVE_OWNERSHIP_PREFIX}${target.targetIdentity}`) {
    throw cliError();
  }
  return Object.freeze(target);
}

function createSummary(snapshot) {
  if (!snapshot || snapshot.readOnlyEvidence?.enforced !== true
    || snapshot.readOnlyEvidence?.transactionReadOnly !== true
    || !Array.isArray(snapshot.history)) {
    throw cliError();
  }
  const observation = snapshot.observation;
  const migrations = snapshot.history.map((entry) => Object.freeze({
    name: entry.name,
    checksum: entry.checksum,
    status: entry.status,
  }));
  return Object.freeze({
    status: "PASS",
    target: Object.freeze({
      identity: observation.targetIdentity,
      database: observation.databaseName,
      serverEndpoint: observation.serverEndpoint,
      serverPort: observation.serverPort,
      schema: observation.schemaName,
      ownershipMarkerVerified: true,
    }),
    readOnlyTransactionVerified: true,
    migrationHistory: Object.freeze(migrations),
  });
}

function cliError() {
  const error = new Error("Daily Goal Phase B observation failed.");
  error.code = "DAILY_GOAL_PHASE_B_FAILED";
  return error;
}

function isMainModule() {
  return typeof process.argv[1] === "string"
    && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  runDailyGoalPhaseBCli().catch(() => {
    process.stderr.write("Daily Goal Phase B observation failed.\n");
    process.exitCode = 1;
  });
}
