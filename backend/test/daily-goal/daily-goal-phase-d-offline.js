import { createHash } from "node:crypto";
import {
  DAILY_GOAL_HISTORY_CONTEXTS,
} from "./daily-goal-ci-contract.js";
import { compareMigrationInventory } from "./daily-goal-migration-domain.js";

export const PHASE_D_OFFLINE_MODE = "OFFLINE_SIMULATION_ONLY";
export const APPROVED_CI_TARGET_IDENTITY = "aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres";
export const APPROVED_CONTEXT_A_OWNERSHIP_MARKER = `elvocab-ci-exclusive:v1:${APPROVED_CI_TARGET_IDENTITY}`;
export const DAILY_GOAL_MIGRATION = Object.freeze({
  name: "20261022000000_add_daily_goal_v1",
  checksum: "8e468739c3f60693e9ff53d1c3d4107124ac1feaa9d95ac3a665ea8b8c89edb6",
  byteCount: 11_487,
});

export const DAILY_GOAL_SCHEMA_EVIDENCE = Object.freeze({
  enums: Object.freeze([
    "DAILY_GOAL_ACTIVITY_TYPE:NORMAL,SRS,QUIZ,SPEAKING",
    "DAILY_GOAL_TRACKING_STATUS:ACTIVE,PAUSED,CLOSED",
    "DAILY_GOAL_OPERATION_TYPE:CREATE,READY,INTERACTION,CLAIM,RESUME,HEARTBEAT,PAUSE,CLOSE,GOAL_UPDATE,REMINDER_PREFERENCE_UPDATE,MONITOR_CREATE,MONITOR_CHECK,MONITOR_CLOSE",
    "USER_NOTIFICATION_TYPE:DAILY_GOAL_COMPLETED,DAILY_GOAL_INACTIVITY_REMINDER",
  ]),
  columns: Object.freeze([
    "USER.daily_goal_minutes:INTEGER:NULLABLE:NO_DEFAULT",
    "USER.daily_goal_reminders_enabled:BOOLEAN:NULLABLE:NO_DEFAULT",
    "USER.daily_goal_reminders_enabled_at:TIMESTAMPTZ(3):NULLABLE:NO_DEFAULT",
    "DAILY_GOAL_DAY.id:UUID:NOT_NULL:NO_DEFAULT",
    "DAILY_GOAL_DAY.user_id:UUID:NOT_NULL:NO_DEFAULT",
    "DAILY_GOAL_DAY.activity_date:DATE:NOT_NULL:NO_DEFAULT",
    "DAILY_GOAL_DAY.active_milliseconds:BIGINT:NOT_NULL:DEFAULT_0",
    "DAILY_GOAL_DAY.last_credited_at:TIMESTAMPTZ(3):NULLABLE:NO_DEFAULT",
    "DAILY_GOAL_DAY.last_engagement_at:TIMESTAMPTZ(3):NULLABLE:NO_DEFAULT",
    "DAILY_GOAL_DAY.last_activity_type:DAILY_GOAL_ACTIVITY_TYPE:NULLABLE:NO_DEFAULT",
    "DAILY_GOAL_DAY.created_at:TIMESTAMPTZ(3):NOT_NULL:DEFAULT_CURRENT_TIMESTAMP",
    "DAILY_GOAL_DAY.updated_at:TIMESTAMPTZ(3):NOT_NULL:NO_DEFAULT",
    "DAILY_GOAL_TRACKING_SESSION.id:UUID:NOT_NULL:NO_DEFAULT",
    "DAILY_GOAL_TRACKING_SESSION.user_id:UUID:NOT_NULL:NO_DEFAULT",
    "DAILY_GOAL_TRACKING_SESSION.activity_type:DAILY_GOAL_ACTIVITY_TYPE:NOT_NULL:NO_DEFAULT",
    "DAILY_GOAL_TRACKING_SESSION.learning_session_id:UUID:NULLABLE:NO_DEFAULT",
    "DAILY_GOAL_TRACKING_SESSION.set_id:UUID:NULLABLE:NO_DEFAULT",
    "DAILY_GOAL_TRACKING_SESSION.vocabulary_id:UUID:NULLABLE:NO_DEFAULT",
    "DAILY_GOAL_TRACKING_SESSION.status:DAILY_GOAL_TRACKING_STATUS:NOT_NULL:DEFAULT_ACTIVE",
    "DAILY_GOAL_TRACKING_SESSION.engagement_expires_at:TIMESTAMPTZ(3):NULLABLE:NO_DEFAULT",
    "DAILY_GOAL_TRACKING_SESSION.last_meaningful_at:TIMESTAMPTZ(3):NULLABLE:NO_DEFAULT",
    "DAILY_GOAL_TRACKING_SESSION.created_at:TIMESTAMPTZ(3):NOT_NULL:DEFAULT_CURRENT_TIMESTAMP",
    "DAILY_GOAL_TRACKING_SESSION.updated_at:TIMESTAMPTZ(3):NOT_NULL:NO_DEFAULT",
    "DAILY_GOAL_TRACKING_SESSION.closed_at:TIMESTAMPTZ(3):NULLABLE:NO_DEFAULT",
    "DAILY_GOAL_MONITOR_SESSION.id:UUID:NOT_NULL:NO_DEFAULT",
    "DAILY_GOAL_MONITOR_SESSION.user_id:UUID:NOT_NULL:NO_DEFAULT",
    "DAILY_GOAL_MONITOR_SESSION.started_at:TIMESTAMPTZ(3):NOT_NULL:DEFAULT_CURRENT_TIMESTAMP",
    "DAILY_GOAL_MONITOR_SESSION.last_seen_at:TIMESTAMPTZ(3):NOT_NULL:NO_DEFAULT",
    "DAILY_GOAL_MONITOR_SESSION.continuity_started_at:TIMESTAMPTZ(3):NOT_NULL:NO_DEFAULT",
    "DAILY_GOAL_MONITOR_SESSION.eligible_baseline_at:TIMESTAMPTZ(3):NOT_NULL:NO_DEFAULT",
    "DAILY_GOAL_MONITOR_SESSION.closed_at:TIMESTAMPTZ(3):NULLABLE:NO_DEFAULT",
    "DAILY_GOAL_OWNER.user_id:UUID:NOT_NULL:NO_DEFAULT",
    "DAILY_GOAL_OWNER.tracking_session_id:UUID:NULLABLE:NO_DEFAULT",
    "DAILY_GOAL_OWNER.generation:BIGINT:NOT_NULL:DEFAULT_0",
    "DAILY_GOAL_OWNER.lease_expires_at:TIMESTAMPTZ(3):NULLABLE:NO_DEFAULT",
    "DAILY_GOAL_OWNER.last_accounted_at:TIMESTAMPTZ(3):NULLABLE:NO_DEFAULT",
    "DAILY_GOAL_OWNER.updated_at:TIMESTAMPTZ(3):NOT_NULL:NO_DEFAULT",
    "DAILY_GOAL_OPERATION_RECEIPT.operation_id:UUID:NOT_NULL:NO_DEFAULT",
    "DAILY_GOAL_OPERATION_RECEIPT.user_id:UUID:NOT_NULL:NO_DEFAULT",
    "DAILY_GOAL_OPERATION_RECEIPT.tracking_session_id:UUID:NULLABLE:NO_DEFAULT",
    "DAILY_GOAL_OPERATION_RECEIPT.monitor_session_id:UUID:NULLABLE:NO_DEFAULT",
    "DAILY_GOAL_OPERATION_RECEIPT.generation:BIGINT:NULLABLE:NO_DEFAULT",
    "DAILY_GOAL_OPERATION_RECEIPT.operation_type:DAILY_GOAL_OPERATION_TYPE:NOT_NULL:NO_DEFAULT",
    "DAILY_GOAL_OPERATION_RECEIPT.request_fingerprint:TEXT:NOT_NULL:NO_DEFAULT",
    "DAILY_GOAL_OPERATION_RECEIPT.credited_milliseconds:BIGINT:NOT_NULL:DEFAULT_0",
    "DAILY_GOAL_OPERATION_RECEIPT.response_projection:JSONB:NOT_NULL:NO_DEFAULT",
    "DAILY_GOAL_OPERATION_RECEIPT.created_at:TIMESTAMPTZ(3):NOT_NULL:DEFAULT_CURRENT_TIMESTAMP",
    "DAILY_GOAL_REWARD.id:UUID:NOT_NULL:NO_DEFAULT",
    "DAILY_GOAL_REWARD.user_id:UUID:NOT_NULL:NO_DEFAULT",
    "DAILY_GOAL_REWARD.activity_date:DATE:NOT_NULL:NO_DEFAULT",
    "DAILY_GOAL_REWARD.source_operation_id:UUID:NOT_NULL:NO_DEFAULT",
    "DAILY_GOAL_REWARD.xp_amount:INTEGER:NOT_NULL:NO_DEFAULT",
    "DAILY_GOAL_REWARD.created_at:TIMESTAMPTZ(3):NOT_NULL:DEFAULT_CURRENT_TIMESTAMP",
    "USER_NOTIFICATION.id:UUID:NOT_NULL:NO_DEFAULT",
    "USER_NOTIFICATION.user_id:UUID:NOT_NULL:NO_DEFAULT",
    "USER_NOTIFICATION.type:USER_NOTIFICATION_TYPE:NOT_NULL:NO_DEFAULT",
    "USER_NOTIFICATION.application_date:DATE:NOT_NULL:NO_DEFAULT",
    "USER_NOTIFICATION.title:VARCHAR(160):NOT_NULL:NO_DEFAULT",
    "USER_NOTIFICATION.body:VARCHAR(500):NOT_NULL:NO_DEFAULT",
    "USER_NOTIFICATION.created_at:TIMESTAMPTZ(3):NOT_NULL:DEFAULT_CURRENT_TIMESTAMP",
    "USER_NOTIFICATION.read_at:TIMESTAMPTZ(3):NULLABLE:NO_DEFAULT",
  ]),
  tables: Object.freeze([
    "DAILY_GOAL_DAY",
    "DAILY_GOAL_TRACKING_SESSION",
    "DAILY_GOAL_MONITOR_SESSION",
    "DAILY_GOAL_OWNER",
    "DAILY_GOAL_OPERATION_RECEIPT",
    "DAILY_GOAL_REWARD",
    "USER_NOTIFICATION",
  ]),
  primaryKeys: Object.freeze([
    "DAILY_GOAL_DAY_pkey:DAILY_GOAL_DAY:id",
    "DAILY_GOAL_TRACKING_SESSION_pkey:DAILY_GOAL_TRACKING_SESSION:id",
    "DAILY_GOAL_MONITOR_SESSION_pkey:DAILY_GOAL_MONITOR_SESSION:id",
    "DAILY_GOAL_OWNER_pkey:DAILY_GOAL_OWNER:user_id",
    "DAILY_GOAL_OPERATION_RECEIPT_pkey:DAILY_GOAL_OPERATION_RECEIPT:operation_id",
    "DAILY_GOAL_REWARD_pkey:DAILY_GOAL_REWARD:id",
    "USER_NOTIFICATION_pkey:USER_NOTIFICATION:id",
  ]),
  constraints: Object.freeze([
    "USER_daily_goal_minutes_check:daily_goal_minutes IS NULL OR daily_goal_minutes BETWEEN 10 AND 240",
    "DAILY_GOAL_DAY_active_milliseconds_non_negative:active_milliseconds >= 0",
    "DAILY_GOAL_TRACKING_SESSION_lifecycle_check:status=CLOSED AND closed_at IS NOT NULL OR status<>CLOSED AND closed_at IS NULL",
    "DAILY_GOAL_TRACKING_SESSION_time_order_check:last_meaningful_at IS NULL OR last_meaningful_at>=created_at;engagement_expires_at IS NULL OR last_meaningful_at IS NOT NULL;engagement_expires_at IS NULL OR engagement_expires_at>last_meaningful_at;closed_at IS NULL OR closed_at>=created_at",
    "DAILY_GOAL_MONITOR_SESSION_time_order_check:last_seen_at>=started_at;continuity_started_at>=started_at;eligible_baseline_at>=continuity_started_at;closed_at IS NULL OR closed_at>=started_at",
    "DAILY_GOAL_OWNER_generation_non_negative:generation >= 0",
    "DAILY_GOAL_OPERATION_RECEIPT_generation_non_negative:generation IS NULL OR generation >= 0",
    "DAILY_GOAL_OPERATION_RECEIPT_credited_milliseconds_non_negative:credited_milliseconds >= 0",
    "DAILY_GOAL_OPERATION_RECEIPT_parent_check:NOT(tracking_session_id IS NOT NULL AND monitor_session_id IS NOT NULL)",
    "DAILY_GOAL_REWARD_xp_amount_check:xp_amount = 10",
    "USER_NOTIFICATION_read_order_check:read_at IS NULL OR read_at>=created_at",
    "USER_NOTIFICATION_content_check:char_length(btrim(title))>0 AND char_length(btrim(body))>0",
  ]),
  indexes: Object.freeze([
    "DAILY_GOAL_DAY_user_id_activity_date_key:DAILY_GOAL_DAY:UNIQUE:user_id ASC,activity_date ASC",
    "DAILY_GOAL_DAY_user_id_activity_date_idx:DAILY_GOAL_DAY:NON_UNIQUE:user_id ASC,activity_date DESC",
    "DAILY_GOAL_TRACKING_SESSION_user_id_status_updated_at_idx:DAILY_GOAL_TRACKING_SESSION:NON_UNIQUE:user_id ASC,status ASC,updated_at ASC",
    "DAILY_GOAL_TRACKING_SESSION_updated_at_idx:DAILY_GOAL_TRACKING_SESSION:NON_UNIQUE:updated_at ASC",
    "DAILY_GOAL_TRACKING_SESSION_learning_session_id_idx:DAILY_GOAL_TRACKING_SESSION:NON_UNIQUE:learning_session_id ASC",
    "DAILY_GOAL_TRACKING_SESSION_set_id_idx:DAILY_GOAL_TRACKING_SESSION:NON_UNIQUE:set_id ASC",
    "DAILY_GOAL_TRACKING_SESSION_vocabulary_id_idx:DAILY_GOAL_TRACKING_SESSION:NON_UNIQUE:vocabulary_id ASC",
    "DAILY_GOAL_OWNER_tracking_session_id_idx:DAILY_GOAL_OWNER:NON_UNIQUE:tracking_session_id ASC",
    "DAILY_GOAL_OPERATION_RECEIPT_user_id_created_at_idx:DAILY_GOAL_OPERATION_RECEIPT:NON_UNIQUE:user_id ASC,created_at ASC",
    "DAILY_GOAL_OPERATION_RECEIPT_created_at_idx:DAILY_GOAL_OPERATION_RECEIPT:NON_UNIQUE:created_at ASC",
    "DAILY_GOAL_OPERATION_RECEIPT_tracking_session_id_idx:DAILY_GOAL_OPERATION_RECEIPT:NON_UNIQUE:tracking_session_id ASC",
    "DAILY_GOAL_OPERATION_RECEIPT_monitor_session_id_idx:DAILY_GOAL_OPERATION_RECEIPT:NON_UNIQUE:monitor_session_id ASC",
    "DAILY_GOAL_REWARD_user_id_activity_date_key:DAILY_GOAL_REWARD:UNIQUE:user_id ASC,activity_date ASC",
    "DAILY_GOAL_REWARD_user_id_source_operation_id_key:DAILY_GOAL_REWARD:UNIQUE:user_id ASC,source_operation_id ASC",
    "USER_NOTIFICATION_user_id_type_application_date_key:USER_NOTIFICATION:UNIQUE:user_id ASC,type ASC,application_date ASC",
    "USER_NOTIFICATION_user_id_read_at_created_at_idx:USER_NOTIFICATION:NON_UNIQUE:user_id ASC,read_at ASC,created_at DESC",
    "USER_NOTIFICATION_user_id_created_at_idx:USER_NOTIFICATION:NON_UNIQUE:user_id ASC,created_at DESC",
    "DAILY_GOAL_MONITOR_SESSION_user_id_last_seen_at_idx:DAILY_GOAL_MONITOR_SESSION:NON_UNIQUE:user_id ASC,last_seen_at ASC",
    "DAILY_GOAL_MONITOR_SESSION_last_seen_at_idx:DAILY_GOAL_MONITOR_SESSION:NON_UNIQUE:last_seen_at ASC",
  ]),
  foreignKeys: Object.freeze([
    "DAILY_GOAL_DAY_user_id_fkey:DAILY_GOAL_DAY(user_id)->USER(id):ON_DELETE_CASCADE:ON_UPDATE_CASCADE",
    "DAILY_GOAL_TRACKING_SESSION_user_id_fkey:DAILY_GOAL_TRACKING_SESSION(user_id)->USER(id):ON_DELETE_CASCADE:ON_UPDATE_CASCADE",
    "DAILY_GOAL_TRACKING_SESSION_learning_session_id_fkey:DAILY_GOAL_TRACKING_SESSION(learning_session_id)->LEARNING_SESSION(id):ON_DELETE_SET_NULL:ON_UPDATE_CASCADE",
    "DAILY_GOAL_TRACKING_SESSION_set_id_fkey:DAILY_GOAL_TRACKING_SESSION(set_id)->VOCABULARY_SET(id):ON_DELETE_SET_NULL:ON_UPDATE_CASCADE",
    "DAILY_GOAL_TRACKING_SESSION_vocabulary_id_fkey:DAILY_GOAL_TRACKING_SESSION(vocabulary_id)->VOCABULARY(id):ON_DELETE_SET_NULL:ON_UPDATE_CASCADE",
    "DAILY_GOAL_MONITOR_SESSION_user_id_fkey:DAILY_GOAL_MONITOR_SESSION(user_id)->USER(id):ON_DELETE_CASCADE:ON_UPDATE_CASCADE",
    "DAILY_GOAL_OWNER_user_id_fkey:DAILY_GOAL_OWNER(user_id)->USER(id):ON_DELETE_CASCADE:ON_UPDATE_CASCADE",
    "DAILY_GOAL_OWNER_tracking_session_id_fkey:DAILY_GOAL_OWNER(tracking_session_id)->DAILY_GOAL_TRACKING_SESSION(id):ON_DELETE_SET_NULL:ON_UPDATE_CASCADE",
    "DAILY_GOAL_OPERATION_RECEIPT_user_id_fkey:DAILY_GOAL_OPERATION_RECEIPT(user_id)->USER(id):ON_DELETE_CASCADE:ON_UPDATE_CASCADE",
    "DAILY_GOAL_OPERATION_RECEIPT_tracking_session_id_fkey:DAILY_GOAL_OPERATION_RECEIPT(tracking_session_id)->DAILY_GOAL_TRACKING_SESSION(id):ON_DELETE_RESTRICT:ON_UPDATE_CASCADE",
    "DAILY_GOAL_OPERATION_RECEIPT_monitor_session_id_fkey:DAILY_GOAL_OPERATION_RECEIPT(monitor_session_id)->DAILY_GOAL_MONITOR_SESSION(id):ON_DELETE_RESTRICT:ON_UPDATE_CASCADE",
    "DAILY_GOAL_REWARD_user_id_fkey:DAILY_GOAL_REWARD(user_id)->USER(id):ON_DELETE_CASCADE:ON_UPDATE_CASCADE",
    "USER_NOTIFICATION_user_id_fkey:USER_NOTIFICATION(user_id)->USER(id):ON_DELETE_CASCADE:ON_UPDATE_CASCADE",
  ]),
});

const SAFE_TEXT = /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,255}$/;
const SAFE_SCHEMA = /^[a-z][a-z0-9_]{2,62}$/;
const APPROVAL_DECISION = "HUMAN_PHASE_D_EXECUTION_APPROVED";
const MUTATION_PRINCIPAL = "FUTURE_REVIEWED_PHASE_D_MUTATION_PRINCIPAL";

export class PhaseDOfflineFailure extends Error {
  constructor(code) {
    super(`Daily Goal Phase D offline verification failed. Code: ${code}`);
    this.name = "PhaseDOfflineFailure";
    this.code = code;
  }
}

// This factory deliberately creates only an in-memory simulation boundary.
// It accepts no callbacks, URLs, environment object, Prisma client or SQL executor.
export function createPhaseDOfflineHarness() {
  const trustedApprovals = new WeakMap();

  function issueFakeExecutionAuthorization(claims) {
    const normalized = normalizeApprovalClaims(claims);
    const token = Object.freeze(Object.create(null));
    trustedApprovals.set(token, normalized);
    return token;
  }

  function evaluate(transcript) {
    try {
      return evaluateTrustedTranscript(transcript, trustedApprovals);
    } catch (error) {
      if (error instanceof PhaseDOfflineFailure) throw error;
      throw new PhaseDOfflineFailure("UNTRUSTED_EVIDENCE");
    }
  }

  return Object.freeze({ issueFakeExecutionAuthorization, evaluate });
}

function evaluateTrustedTranscript(transcript, trustedApprovals) {
  if (!transcript || typeof transcript !== "object") fail("TRANSCRIPT_REQUIRED");
  const approval = trustedApprovals.get(transcript.executionAuthorization);
  if (!approval) fail("EXECUTION_AUTHORIZATION_REQUIRED");

  const destination = normalizeDestination(transcript.destination);
  assertSameDestination(approval, destination);
  assertCredentialBoundary(transcript.credentialBoundary, destination);

  const reviewed = normalizeInventory(transcript.reviewedInventory);
  const approvedPending = normalizeInventory(approval.pending);
  assertDailyGoalArtifactIsReviewed(reviewed, approvedPending);
  assertActivationBytes(transcript.activationBytes);

  const before = reconcile({ reviewed, target: transcript.preExecutionHistory, approvedPending });
  const immediate = reconcile({ reviewed, target: transcript.immediateHistory, approvedPending });
  if (stableJson(before.applied) !== stableJson(immediate.applied)
    || stableJson(before.pending) !== stableJson(immediate.pending)) {
    fail("HISTORY_CHANGED_BEFORE_EXECUTION");
  }
  const immediateApproval = trustedApprovals.get(transcript.executionAuthorization);
  if (immediateApproval !== approval) fail("EXECUTION_AUTHORIZATION_STALE");
  assertSameDestination(immediateApproval, destination);
  if (stableJson(immediateApproval.pending) !== stableJson(approvedPending)) {
    fail("EXECUTION_AUTHORIZATION_STALE");
  }

  if (transcript.applicationEvidence?.status !== "APPLIED"
    || stableJson(transcript.applicationEvidence.migrations) !== stableJson(approvedPending)) {
    fail("MIGRATION_APPLY_FAILED");
  }

  const after = reconcile({ reviewed, target: transcript.postExecutionHistory, approvedPending: [] });
  if (after.applied.length !== reviewed.length || after.pending.length !== 0) {
    fail("POST_MIGRATION_HISTORY_INCOMPLETE");
  }
  assertSchemaEvidence(transcript.schemaEvidence);
  assertCleanupEvidence(transcript.cleanupEvidence, destination);

  return deepFreeze({
    mode: PHASE_D_OFFLINE_MODE,
    status: "PASS",
    context: destination.context,
    targetIdentity: destination.targetIdentity,
    schemaIdentity: destination.schemaIdentity,
    pending: approvedPending,
    verification: {
      destinationBound: true,
      authorizationRevalidated: true,
      historyReconciledTwice: true,
      artifactVerified: true,
      postHistoryComplete: true,
      schemaVerified: true,
      cleanupVerified: destination.context === DAILY_GOAL_HISTORY_CONTEXTS.RUN_OWNED_SCHEMA,
    },
  });
}

function normalizeApprovalClaims(claims) {
  if (!claims || claims.decision !== APPROVAL_DECISION) fail("EXECUTION_AUTHORIZATION_REQUIRED");
  const destination = normalizeDestination(claims.destination);
  const pending = normalizeInventory(claims.pending);
  if (pending.length === 0) fail("APPROVED_PENDING_SET_REQUIRED");
  return deepFreeze({ ...destination, pending });
}

function normalizeDestination(value) {
  if (!value || !Object.values(DAILY_GOAL_HISTORY_CONTEXTS).includes(value.context)) {
    fail("DESTINATION_CONTEXT_INVALID");
  }
  for (const field of ["targetIdentity", "databaseName", "schemaIdentity", "ownershipEvidence"]) {
    if (typeof value[field] !== "string" || !SAFE_TEXT.test(value[field])) fail("DESTINATION_INVALID");
  }
  if (value.targetIdentity !== APPROVED_CI_TARGET_IDENTITY || value.databaseName !== "postgres") {
    fail("DESTINATION_INVALID");
  }

  if (value.context === DAILY_GOAL_HISTORY_CONTEXTS.EXISTING_TARGET) {
    if (value.schemaIdentity !== "public" || value.explicitPublicWriteApproval !== true) {
      fail("CONTEXT_A_WRITE_APPROVAL_REQUIRED");
    }
    if (value.ownershipEvidence !== APPROVED_CONTEXT_A_OWNERSHIP_MARKER) {
      fail("CONTEXT_A_OWNERSHIP_MARKER_INVALID");
    }
    return deepFreeze({
      context: value.context,
      targetIdentity: value.targetIdentity,
      databaseName: value.databaseName,
      schemaIdentity: value.schemaIdentity,
      ownershipEvidence: value.ownershipEvidence,
      explicitPublicWriteApproval: true,
    });
  }

  if (!SAFE_SCHEMA.test(value.schemaIdentity) || value.schemaIdentity === "public") {
    fail("RUN_OWNED_SCHEMA_INVALID");
  }
  if (value.ownershipEvidence === APPROVED_CONTEXT_A_OWNERSHIP_MARKER) {
    fail("RUN_OWNERSHIP_INVALID");
  }
  const ownership = value.runOwnership;
  if (!ownership || ownership.schemaIdentity !== value.schemaIdentity
    || ownership.repository !== "Hau-2251220056/EngLish-Vocabulary"
    || typeof ownership.runId !== "string" || !/^\d+$/.test(ownership.runId)
    || typeof ownership.runAttempt !== "string" || !/^\d+$/.test(ownership.runAttempt)
    || ownership.fresh !== true || ownership.foreign !== false
    || ownership.marker !== value.ownershipEvidence) {
    fail("RUN_OWNERSHIP_INVALID");
  }
  return deepFreeze({
    context: value.context,
    targetIdentity: value.targetIdentity,
    databaseName: value.databaseName,
    schemaIdentity: value.schemaIdentity,
    ownershipEvidence: value.ownershipEvidence,
    runOwnership: {
      repository: ownership.repository,
      runId: ownership.runId,
      runAttempt: ownership.runAttempt,
      schemaIdentity: ownership.schemaIdentity,
      marker: ownership.marker,
      fresh: true,
      foreign: false,
    },
  });
}

function assertSameDestination(approval, destination) {
  if (stableJson(approval, ["pending"]) !== stableJson(destination)) {
    fail("APPROVAL_DESTINATION_MISMATCH");
  }
}

function assertCredentialBoundary(value, destination) {
  if (!value || value.principalClass !== MUTATION_PRINCIPAL
    || value.reviewed === false || value.reviewed !== true
    || value.schemaIdentity !== destination.schemaIdentity
    || value.context !== destination.context
    || "databaseUrl" in value || "url" in value || "credential" in value
    || value.principalClass === "DAILY_GOAL_OBSERVER_DATABASE_URL"
    || value.principalClass === "CI_TEST_DATABASE_URL") {
    fail("MUTATION_CREDENTIAL_BOUNDARY_INVALID");
  }
}

function assertDailyGoalArtifactIsReviewed(reviewed, pending) {
  const reviewedArtifact = reviewed.find((entry) => entry.name === DAILY_GOAL_MIGRATION.name);
  const pendingArtifact = pending.find((entry) => entry.name === DAILY_GOAL_MIGRATION.name);
  if (!reviewedArtifact || !pendingArtifact
    || reviewedArtifact.checksum !== DAILY_GOAL_MIGRATION.checksum
    || pendingArtifact.checksum !== DAILY_GOAL_MIGRATION.checksum) {
    fail("DAILY_GOAL_ARTIFACT_NOT_APPROVED");
  }
}

function assertActivationBytes(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length !== DAILY_GOAL_MIGRATION.byteCount
    || createHash("sha256").update(bytes).digest("hex") !== DAILY_GOAL_MIGRATION.checksum) {
    fail("ACTIVATION_BYTES_INVALID");
  }
}

function reconcile({ reviewed, target, approvedPending }) {
  try {
    return compareMigrationInventory({ reviewed, target, approvedPending });
  } catch {
    fail("MIGRATION_INVENTORY_INVALID");
  }
}

function assertSchemaEvidence(value) {
  if (!value || value.status !== "PASS" || value.complete !== true) {
    fail("SCHEMA_VERIFICATION_FAILED");
  }
  for (const [category, required] of Object.entries(DAILY_GOAL_SCHEMA_EVIDENCE)) {
    if (!Array.isArray(value[category]) || stableJson(value[category]) !== stableJson(required)) {
      fail("SCHEMA_VERIFICATION_FAILED");
    }
  }
}

function assertCleanupEvidence(value, destination) {
  if (destination.context === DAILY_GOAL_HISTORY_CONTEXTS.EXISTING_TARGET) {
    if (!value || value.status !== "NOT_APPLICABLE" || value.targetSchema !== null) {
      fail("CONTEXT_A_CLEANUP_PROHIBITED");
    }
    return;
  }
  if (!value || value.status !== "PASS"
    || value.targetSchema !== destination.schemaIdentity
    || value.targetSchema === "public"
    || value.ownershipEvidence !== destination.ownershipEvidence
    || value.foreignSchemaTouched !== false) {
    fail("RUN_OWNED_CLEANUP_FAILED");
  }
}

function normalizeInventory(entries) {
  if (!Array.isArray(entries)) fail("MIGRATION_INVENTORY_INVALID");
  return entries.map((entry) => {
    if (!entry || typeof entry.name !== "string" || typeof entry.checksum !== "string") {
      fail("MIGRATION_INVENTORY_INVALID");
    }
    return Object.freeze({ name: entry.name, checksum: entry.checksum });
  });
}

function stableJson(value, omittedKeys = []) {
  if (Array.isArray(value)) return JSON.stringify(value.map((entry) => JSON.parse(stableJson(entry))));
  if (!value || typeof value !== "object") return JSON.stringify(value);
  const copy = {};
  for (const key of Object.keys(value).filter((key) => !omittedKeys.includes(key)).sort()) {
    copy[key] = value[key];
  }
  return JSON.stringify(copy);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function fail(code) {
  throw new PhaseDOfflineFailure(code);
}
