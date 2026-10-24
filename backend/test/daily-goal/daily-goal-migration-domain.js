import { createHash } from "node:crypto";
import { isIP } from "node:net";
import {
  createDailyGoalPhaseBFailure,
  DAILY_GOAL_PHASE_B_FAILURE_CODES,
} from "./daily-goal-phase-b-diagnostics.js";

const NAME = /^\d{14}_[a-z0-9_]+$/;
const SHA256 = /^[a-f0-9]{64}$/;
const TEXT = /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,255}$/;
const MANDATORY_IDENTITY_FIELDS = Object.freeze([
  "targetIdentity", "databaseName", "schemaName", "ownershipMarker",
]);
const DIAGNOSTIC_FIELDS = Object.freeze(["serverEndpoint", "serverPort"]);
const MISMATCH_CODES = Object.freeze({
  targetIdentity: DAILY_GOAL_PHASE_B_FAILURE_CODES.TARGET_IDENTITY_MISMATCH,
  databaseName: DAILY_GOAL_PHASE_B_FAILURE_CODES.DATABASE_NAME_MISMATCH,
  schemaName: DAILY_GOAL_PHASE_B_FAILURE_CODES.SCHEMA_NAME_MISMATCH,
  ownershipMarker: DAILY_GOAL_PHASE_B_FAILURE_CODES.OWNERSHIP_MARKER_MISMATCH,
});

export function verifyConnectedTarget({ authorization, expected, observation, targetBindingToken }) {
  if (!isOpaqueBindingToken(targetBindingToken)) {
    throw targetVerificationError(DAILY_GOAL_PHASE_B_FAILURE_CODES.INTERNAL_EVIDENCE_INVALID);
  }
  if (!observation || observation.evidenceSource !== "CONNECTED_POSTGRESQL" || observation.derivedFromConfiguration === true) {
    throw targetVerificationError(DAILY_GOAL_PHASE_B_FAILURE_CODES.CONNECTED_EVIDENCE_INVALID);
  }
  for (const field of MANDATORY_IDENTITY_FIELDS) {
    if (typeof observation[field] !== "string" || !TEXT.test(observation[field])) {
      throw targetVerificationError(DAILY_GOAL_PHASE_B_FAILURE_CODES.TARGET_FIELD_INVALID);
    }
    if (observation[field] !== expected?.[field]) {
      throw targetVerificationError(MISMATCH_CODES[field]);
    }
  }
  assertBackendDiagnostics(observation);
  if (observation.targetIdentity !== authorization?.targetIdentity) {
    throw targetVerificationError(
      DAILY_GOAL_PHASE_B_FAILURE_CODES.AUTHORIZATION_CONTINUITY_FAILED,
    );
  }
  const fields = [...MANDATORY_IDENTITY_FIELDS, ...DIAGNOSTIC_FIELDS];
  const binding = createHash("sha256")
    .update(fields.map((field) => `${field}=${observation[field]}`).join("\n"))
    .digest("hex");
  return Object.freeze({
    binding,
    targetBindingToken,
    observation: Object.freeze(Object.fromEntries(fields.map((field) => [field, observation[field]]))),
  });
}

function assertBackendDiagnostics(observation) {
  if (typeof observation.serverEndpoint !== "string" || isIP(observation.serverEndpoint) === 0) {
    throw targetVerificationError(
      DAILY_GOAL_PHASE_B_FAILURE_CODES.ENDPOINT_DIAGNOSTIC_INVALID,
    );
  }
  if (typeof observation.serverPort !== "string" || !/^\d{1,5}$/.test(observation.serverPort)) {
    throw targetVerificationError(DAILY_GOAL_PHASE_B_FAILURE_CODES.PORT_DIAGNOSTIC_INVALID);
  }
  const port = Number(observation.serverPort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw targetVerificationError(DAILY_GOAL_PHASE_B_FAILURE_CODES.PORT_DIAGNOSTIC_INVALID);
  }
}

function targetVerificationError(failureCode) {
  return createDailyGoalPhaseBFailure(failureCode, {
    errorCode: "DAILY_GOAL_TARGET_VERIFICATION_FAILED",
    message: "Daily Goal connected-target verification failed.",
  });
}

function isOpaqueBindingToken(value, seen = new Set()) {
  if (!value
    || typeof value !== "object"
    || !Object.isFrozen(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || seen.has(value)) {
    return false;
  }
  seen.add(value);
  return Object.values(Object.getOwnPropertyDescriptors(value)).every((descriptor) => {
    if (typeof descriptor.get === "function" || typeof descriptor.set === "function") return false;
    const child = descriptor.value;
    if (typeof child === "function") return false;
    if (child && typeof child === "object") return isOpaqueBindingToken(child, seen);
    return ["string", "number", "boolean", "undefined"].includes(typeof child) || child === null;
  });
}

export function compareMigrationInventory({ reviewed, target, approvedPending }) {
  const local = normalizeReviewed(reviewed);
  const remote = normalizeTarget(target);
  const approved = normalizeApproved(approvedPending);
  const localByName = new Map(local.map((entry) => [entry.name, entry]));
  const remoteByName = new Map(remote.map((entry) => [entry.name, entry]));

  for (const entry of remote) {
    const expected = localByName.get(entry.name);
    if (!expected) throw new Error(`Target contains unexpected migration ${entry.name}.`);
    if (entry.status !== "APPLIED") throw new Error(`Target migration ${entry.name} is not complete.`);
    if (entry.checksum !== expected.checksum) throw new Error(`Migration checksum diverges for ${entry.name}.`);
  }

  const pending = local.filter((entry) => !remoteByName.has(entry.name));
  const firstPending = local.findIndex((entry) => !remoteByName.has(entry.name));
  if (firstPending >= 0 && local.slice(firstPending + 1).some((entry) => remoteByName.has(entry.name))) {
    throw new Error("Target migration history has a missing historical migration.");
  }
  if (pending.length !== approved.length || pending.some((entry, index) =>
    entry.name !== approved[index].name || entry.checksum !== approved[index].checksum)) {
    throw new Error("Pending migration set does not exactly match approval.");
  }
  return Object.freeze({
    reviewed: freezeEntries(local),
    applied: freezeEntries(remote),
    pending: freezeEntries(pending),
  });
}

function normalizeReviewed(entries) {
  if (!Array.isArray(entries) || entries.length === 0) throw new Error("Reviewed migration inventory is required.");
  const normalized = entries.map(normalizeBase);
  assertUniqueAndOrdered(normalized);
  return normalized;
}

function normalizeTarget(entries) {
  if (!Array.isArray(entries)) throw new Error("Target migration inventory is required.");
  const normalized = entries.map((entry) => ({ ...normalizeBase(entry), status: entry.status }));
  if (normalized.some((entry) => !["APPLIED", "FAILED", "INCOMPLETE"].includes(entry.status))) {
    throw new Error("Target migration status is unknown.");
  }
  assertUniqueAndOrdered(normalized);
  return normalized;
}

function normalizeApproved(entries) {
  if (!Array.isArray(entries)) throw new Error("Approved pending migration set is required.");
  const normalized = entries.map(normalizeBase);
  assertUniqueAndOrdered(normalized);
  return normalized;
}

function normalizeBase(entry) {
  if (!entry || typeof entry.name !== "string" || !NAME.test(entry.name)
    || typeof entry.checksum !== "string" || !SHA256.test(entry.checksum)) {
    throw new Error("Migration inventory entry is malformed.");
  }
  return { name: entry.name, checksum: entry.checksum };
}

function assertUniqueAndOrdered(entries) {
  for (let index = 0; index < entries.length; index += 1) {
    if (index > 0 && entries[index - 1].name >= entries[index].name) {
      throw new Error("Migration inventory must be unique and strictly ordered.");
    }
  }
}

function freezeEntries(entries) {
  return Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));
}
