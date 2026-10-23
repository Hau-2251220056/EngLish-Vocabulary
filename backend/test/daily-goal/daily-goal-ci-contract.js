import { createHash } from "node:crypto";
import { verifyConnectedTarget, compareMigrationInventory } from "./daily-goal-migration-domain.js";

export const DAILY_GOAL_HISTORY_CONTEXTS = Object.freeze({
  EXISTING_TARGET: "EXISTING_TARGET",
  RUN_OWNED_SCHEMA: "RUN_OWNED_SCHEMA",
});

const CONTEXT_VALUES = new Set(Object.values(DAILY_GOAL_HISTORY_CONTEXTS));
const NONEMPTY_TEXT = /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,255}$/;

export async function observeDailyGoalTarget({
  authorization,
  expectedTarget,
  observationAdapter,
}) {
  if (authorization?.operation !== "observation") {
    throw new Error("Observation authorization is required.");
  }
  if (typeof observationAdapter !== "function") {
    throw new TypeError("A connected-target observation adapter is required.");
  }

  const connected = await observationAdapter(Object.freeze({
    databaseUrl: authorization.databaseUrl,
    requestedEvidenceSource: "CONNECTED_POSTGRESQL",
  }));
  return verifyConnectedTarget({
    authorization,
    expected: expectedTarget,
    observation: connected?.observation,
    targetBindingToken: connected?.targetBindingToken,
  });
}

export function reviewMigrationHistoryContext({
  context,
  targetIdentity,
  schemaIdentity,
  ownershipEvidence,
  reviewed,
  target,
  approval,
}) {
  assertContextIdentity({ context, targetIdentity, schemaIdentity, ownershipEvidence });
  if (!approval || approval.context !== context
    || approval.targetIdentity !== targetIdentity
    || approval.schemaIdentity !== schemaIdentity
    || approval.ownershipEvidence !== ownershipEvidence) {
    throw new Error("Migration approval does not belong to this destination context.");
  }

  const inventory = compareMigrationInventory({
    reviewed,
    target,
    approvedPending: approval.pending,
  });
  const binding = createHash("sha256").update(JSON.stringify({
    context,
    targetIdentity,
    schemaIdentity,
    ownershipEvidence,
    pending: inventory.pending,
  })).digest("hex");

  return Object.freeze({
    context,
    targetIdentity,
    schemaIdentity,
    ownershipEvidence,
    binding,
    inventory,
  });
}

export function createMigrationContextApproval({
  context,
  targetIdentity,
  schemaIdentity,
  ownershipEvidence,
  pending,
}) {
  assertContextIdentity({ context, targetIdentity, schemaIdentity, ownershipEvidence });
  if (!Array.isArray(pending)) {
    throw new TypeError("An explicit ordered pending migration set is required.");
  }
  return Object.freeze({
    context,
    targetIdentity,
    schemaIdentity,
    ownershipEvidence,
    pending: Object.freeze(pending.map((entry) => Object.freeze({ ...entry }))),
  });
}

function assertContextIdentity({ context, targetIdentity, schemaIdentity, ownershipEvidence }) {
  if (!CONTEXT_VALUES.has(context)) {
    throw new Error("Migration history context is unknown.");
  }
  for (const [name, value] of Object.entries({ targetIdentity, schemaIdentity, ownershipEvidence })) {
    if (typeof value !== "string" || !NONEMPTY_TEXT.test(value)) {
      throw new Error(`${name} is missing or malformed.`);
    }
  }
  if (context === DAILY_GOAL_HISTORY_CONTEXTS.RUN_OWNED_SCHEMA
    && schemaIdentity === "public") {
    throw new Error("Run-owned migration verification cannot target public schema.");
  }
}
