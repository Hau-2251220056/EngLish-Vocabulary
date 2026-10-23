import { pathToFileURL } from "node:url";
import { runDailyGoalPhaseBObservation } from "./daily-goal-phase-b-runner.js";
import { CI_EXCLUSIVE_OWNERSHIP_PREFIX } from "./daily-goal-read-only-observer.js";
import {
  createDailyGoalPhaseBFailure,
  DAILY_GOAL_PHASE_B_FAILURE_CODES,
  getDailyGoalPhaseBFailureCode,
} from "./daily-goal-phase-b-diagnostics.js";

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
  const authenticSummaries = new WeakSet();
  try {
    const expectedTarget = readExpectedTarget(environment);
    const summary = await runObservation({
      environment,
      expectedTarget,
      operation: (snapshot) => {
        const authenticatedSummary = createSummary(snapshot);
        authenticSummaries.add(authenticatedSummary);
        return authenticatedSummary;
      },
    });
    if (!isAuthenticSummary(summary, authenticSummaries)) {
      throw cliError();
    }
    writeOutput(JSON.stringify(summary));
    return summary;
  } catch (error) {
    throw cliError(getDailyGoalPhaseBFailureCode(error));
  }
}

export function readExpectedTarget(environment) {
  const target = {};
  for (const [field, name] of Object.entries(REQUIRED_CONFIGURATION)) {
    const value = environment?.[name];
    if (typeof value !== "string" || !SAFE_TEXT.test(value)) {
      throw cliError(DAILY_GOAL_PHASE_B_FAILURE_CODES.CONFIG_REJECTED);
    }
    target[field] = value;
  }
  if (target.ownershipMarker !== `${CI_EXCLUSIVE_OWNERSHIP_PREFIX}${target.targetIdentity}`) {
    throw cliError(DAILY_GOAL_PHASE_B_FAILURE_CODES.CONFIG_REJECTED);
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
  const summary = Object.freeze({
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
  return summary;
}

function isAuthenticSummary(value, authenticSummaries) {
  return value !== null
    && typeof value === "object"
    && authenticSummaries.has(value);
}

export function formatDailyGoalPhaseBFailure(error) {
  return `Daily Goal Phase B observation failed. Code: ${getDailyGoalPhaseBFailureCode(error)}`;
}

export async function runDailyGoalPhaseBMain({
  runCli = runDailyGoalPhaseBCli,
  writeError = (value) => process.stderr.write(`${value}\n`),
  setExitCode = (value) => { process.exitCode = value; },
} = {}) {
  try {
    await runCli();
  } catch (error) {
    setExitCode(1);
    try {
      await writeError(formatDailyGoalPhaseBFailure(error));
    } catch {
      // A broken diagnostic channel must not restore success or expose its raw failure.
    }
  }
}

function cliError(failureCode = DAILY_GOAL_PHASE_B_FAILURE_CODES.UNKNOWN_PHASE_B_FAILURE) {
  return createDailyGoalPhaseBFailure(failureCode);
}

function isMainModule() {
  return typeof process.argv[1] === "string"
    && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  runDailyGoalPhaseBMain();
}
