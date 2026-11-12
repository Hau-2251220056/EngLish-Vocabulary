// @ts-nocheck
import { randomUUID } from "node:crypto";
import { captureOperationTime, deriveSessionExpiry, projectSessionLifecycle } from "./learning-session-domain.js";
import { CEFR_LEVELS } from "../repositories/learning-path-repository.js";
import { toSessionProjection } from "./learning-session-service.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LEVEL_INDEX = new Map(CEFR_LEVELS.map((level, index) => [level, index]));

export class LearningPathServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "LearningPathServiceError";
    this.code = code;
  }
}

export function createLearningPathService({
  learningPathRepository,
  createSessionRepository,
  now = () => new Date(),
  uuid = randomUUID,
}) {
  if (!learningPathRepository?.withTransaction || typeof createSessionRepository !== "function") {
    throw new TypeError("Learning Path repository and Learning Session repository factory are required.");
  }

  const transact = (callback) => learningPathRepository.withTransaction(
    (paths, transaction) => callback(paths, createSessionRepository(transaction)),
  );

  async function readProjection(paths, userId, evaluatedAt) {
    const [curriculum, state, activePasses, activeSetContexts] = await Promise.all([
      paths.listCurrentCurriculum(userId),
      paths.findPathState(userId),
      paths.listActivePasses(userId),
      paths.listActiveSetContexts(userId, evaluatedAt),
    ]);
    return projectPath(curriculum, state, activePasses, evaluatedAt, activeSetContexts);
  }

  async function createPass(paths, userId, set, operationId, instant) {
    const items = normalizeSetItems(set.items);
    if (items.length === 0) throw configurationError();
    return paths.createPass({
      id: uuid(), user_id: userId, set_id_snapshot: set.id,
      create_operation_id: operationId, created_at: instant, items,
    });
  }

  return Object.freeze({
    async getPath(userId) {
      validateUuid(userId);
      return transact(async (paths) => readProjection(paths, userId, captureOperationTime(now).instant));
    },

    async startPass(userId, setId, input) {
      validateUuid(userId); validateUuid(setId);
      const operationId = validateOperation(input);
      return transact(async (paths, sessions) => {
        const instant = captureOperationTime(now).instant;
        await paths.lockOperationIdentity(userId, operationId);
        await paths.lockPassIdentity(userId, setId);
        if (await paths.findCompletionReplay(userId, operationId) || await sessions.findCreationReplay(userId, operationId) || await sessions.findCompletionReplay(userId, operationId)) throw operationConflict();
        const replay = await paths.findCreationReplay(userId, operationId);
        if (replay) {
          assertPassCreationReplay(replay, setId);
          return { pass: projectPass(replay, instant), replayed: true };
        }
        const set = await paths.findRequiredSet(setId);
        if (!set) throw notFound();
        const projection = await readProjection(paths, userId, instant);
        if (!projection.levels.find((level) => level.level === set.cefr_level)?.unlocked) throw locked();
        if (await paths.findCompletedPass(userId, setId)) throw conflict("CEFR_SET_ALREADY_COMPLETED", "The required Set already has accepted completion.");
        const active = await paths.findActivePass(userId, setId);
        if (active) return { pass: projectPass(active, instant), replayed: false, resumed: true };
        const pass = await createPass(paths, userId, set, operationId, instant);
        return { pass: projectPass(pass, instant), replayed: false, resumed: false };
      });
    },

    async readPass(userId, passId) {
      validateUuid(userId); validateUuid(passId);
      return transact(async (paths) => {
        const instant = captureOperationTime(now).instant;
        const pass = await paths.findOwnedPass(passId, userId);
        if (!pass) throw notFound();
        return projectPassWithCompatibility(pass, await paths.findRequiredSet(pass.set_id_snapshot), instant);
      });
    },

    async createNextSession(userId, passId, input) {
      validateUuid(userId); validateUuid(passId);
      const operationId = validateOperation(input);
      return transact(async (paths, sessions) => {
        const instant = captureOperationTime(now).instant;
        await paths.lockOperationIdentity(userId, operationId);
        if (await paths.findCreationReplay(userId, operationId) || await paths.findCompletionReplay(userId, operationId) || await sessions.findCompletionReplay(userId, operationId)) throw operationConflict();
        const replay = await sessions.findCreationReplay(userId, operationId);
        if (replay) {
          if (replay.cefr_learning_pass_id !== passId || replay.mode !== "NORMAL") throw operationConflict();
          return { session: toSessionProjection(replay, instant), replayed: true };
        }
        const pass = await paths.lockOwnedPass(passId, userId);
        requireActivePass(pass);
        const set = await paths.findRequiredSet(pass.set_id_snapshot);
        assertCompatibleSnapshot(pass, set);
        const existing = newestContinuableSession(pass.learning_sessions, instant);
        if (existing) return { session: toSessionProjection(existing, instant), replayed: false, resumed: true };
        const unresolved = unresolvedPassItems(pass).slice(0, 10);
        if (unresolved.length === 0) return { session: null, reason: "PASS_READY_TO_COMPLETE", replayed: false };
        const session = await sessions.createSessionWithItems({
          id: uuid(), user_id: userId, vocabulary_set_id: pass.set_id_snapshot,
          set_id_snapshot: pass.set_id_snapshot, scope: "SET", cefr_learning_pass_id: pass.id,
          mode: "NORMAL", create_operation_id: operationId, snapshot_size: unresolved.length,
          created_at: instant, expires_at: deriveSessionExpiry(instant),
          items: unresolved.map((item, position) => ({ vocabulary_id: item.vocabulary_id, position })),
        });
        return { session: toSessionProjection(session, instant), replayed: false, resumed: false };
      });
    },

    async restartPass(userId, passId, input) {
      validateUuid(userId); validateUuid(passId);
      const operationId = validateOperation(input);
      return transact(async (paths, sessions) => {
        const instant = captureOperationTime(now).instant;
        await paths.lockOperationIdentity(userId, operationId);
        const original = await paths.findOwnedPass(passId, userId);
        if (!original) throw notFound();
        if (await paths.findCompletionReplay(userId, operationId) || await sessions.findCreationReplay(userId, operationId) || await sessions.findCompletionReplay(userId, operationId)) throw operationConflict();
        const replay = await paths.findCreationReplay(userId, operationId);
        if (replay) {
          if (replay.set_id_snapshot !== original.set_id_snapshot) throw operationConflict();
          return { pass: projectPass(replay, instant), replayed: true };
        }
        const pass = await paths.lockOwnedPass(passId, userId);
        requireActivePass(pass);
        const set = await paths.findRequiredSet(pass.set_id_snapshot);
        if (!set) throw notFound();
        const invalidated = await paths.invalidatePass(pass.id, userId, instant);
        if (invalidated.count !== 1) throw operationConflict();
        const replacement = await createPass(paths, userId, set, operationId, instant);
        return { pass: projectPass(replacement, instant), replayed: false };
      });
    },

    async completePass(userId, passId, input) {
      validateUuid(userId); validateUuid(passId);
      const operationId = validateOperation(input);
      return transact(async (paths, sessions) => {
        const instant = captureOperationTime(now).instant;
        await paths.lockOperationIdentity(userId, operationId);
        if (await paths.findCreationReplay(userId, operationId) || await sessions.findCreationReplay(userId, operationId) || await sessions.findCompletionReplay(userId, operationId)) throw operationConflict();
        const replay = await paths.findCompletionReplay(userId, operationId);
        if (replay) {
          if (replay.id !== passId) throw operationConflict();
          return { pass: projectPass(replay, instant), path: await readProjection(paths, userId, instant), replayed: true };
        }
        const pass = await paths.lockOwnedPass(passId, userId);
        requireActivePass(pass);
        assertCompatibleSnapshot(pass, await paths.findRequiredSet(pass.set_id_snapshot));
        if (unresolvedPassItems(pass).length !== 0) throw incomplete();
        const completed = await paths.completePass(pass.id, userId, operationId, instant);
        if (completed.count !== 1) throw operationConflict();
        await advanceEntitlement(paths, userId, instant);
        const accepted = await paths.findOwnedPass(pass.id, userId);
        return { pass: projectPass(accepted, instant), path: await readProjection(paths, userId, instant), replayed: false };
      });
    },
  });
}

export function createLearningPathActivityAuthorizer({ createLearningPathRepository }) {
  if (typeof createLearningPathRepository !== "function") {
    throw new TypeError("Learning Path repository factory is required.");
  }
  return async function authorizeSetActivity(transaction, userId, setId) {
    validateUuid(userId);
    validateUuid(setId);
    if (!transaction) throw new TypeError("Activity authorization requires a transaction client.");
    const paths = createLearningPathRepository(transaction);
    const set = await paths.lockActivitySetClassification(setId);
    if (!set?.is_public || !LEVEL_INDEX.has(set.cefr_level)) return;
    const state = await paths.findPathState(userId);
    const highestUnlockedIndex = LEVEL_INDEX.get(state?.highest_unlocked_level ?? "A1") ?? 0;
    if (LEVEL_INDEX.get(set.cefr_level) > highestUnlockedIndex) throw locked();
  };
}

export function projectPath(curriculum, state, activePasses, evaluatedAt, activeSetContexts = []) {
  const highest = state?.highest_unlocked_level ?? "A1";
  const highestIndex = LEVEL_INDEX.get(highest) ?? 0;
  const levels = CEFR_LEVELS.map((level, index) => {
    const sets = curriculum.filter((set) => set.cefr_level === level);
    const completed = sets.filter((set) => set.cefr_learning_passes.length > 0);
    const hasEmptySet = sets.some((set) => set.items.length === 0);
    return {
      level, unlocked: index <= highestIndex, required_count: sets.length,
      completed_count: completed.length,
      configuration: sets.length === 0 ? "NO_REQUIRED_SETS" : hasEmptySet ? "EMPTY_REQUIRED_SET" : "READY",
      current_complete: sets.length > 0 && !hasEmptySet && completed.length === sets.length,
      incomplete_sets: sets.filter((set) => set.items.length > 0 && set.cefr_learning_passes.length === 0)
        .map((set) => ({ id: set.id, name: set.name, created_at: set.created_at })),
    };
  });
  const primary = levels[highestIndex];
  const primarySetIds = new Set(primary.incomplete_sets.map((set) => set.id));
  const active = activePasses.find((pass) => primarySetIds.has(pass.set_id_snapshot));
  const next = primary.incomplete_sets[0];
  const activeSetIds = new Set([
    ...activePasses.map((pass) => pass.set_id_snapshot),
    ...activeSetContexts.map((context) => context.set_id_snapshot),
  ]);
  const nextSuggestion = primary.incomplete_sets.find((set) => !activeSetIds.has(set.id));
  const allIncompleteSetsActive = primary.incomplete_sets.length > 0
    && primary.incomplete_sets.every((set) => activeSetIds.has(set.id));
  return {
    evaluated_at: evaluatedAt,
    highest_unlocked_level: highest,
    path_completed_at: state?.path_completed_at ?? null,
    levels,
    recommendation: active
      ? { action: "RESUME", set_id: active.set_id_snapshot, pass_id: active.id }
      : next ? { action: "START", set_id: next.id, pass_id: null } : null,
    next_suggestion: nextSuggestion
      ? { action: "START", set_id: nextSuggestion.id, pass_id: null }
      : null,
    next_suggestion_reason: nextSuggestion
      ? null
      : allIncompleteSetsActive ? "ALL_INCOMPLETE_SETS_ACTIVE" : "NO_ELIGIBLE_NEXT_SET",
    all_current_sets_complete: levels.every((level) => level.current_complete),
  };
}

async function advanceEntitlement(paths, userId, instant) {
  const state = await paths.lockPathState(userId);
  const curriculum = await paths.listCurrentCurriculum(userId);
  let index = LEVEL_INDEX.get(state?.highest_unlocked_level ?? "A1") ?? 0;
  while (index < CEFR_LEVELS.length - 1 && levelCurrentlyComplete(curriculum, CEFR_LEVELS[index])) index += 1;
  const c1Complete = index === CEFR_LEVELS.length - 1 && levelCurrentlyComplete(curriculum, "C1");
  if (index > 0 || c1Complete || state) {
    await paths.upsertPathState(userId, {
      highest_unlocked_level: CEFR_LEVELS[index],
      ...(c1Complete && !state?.path_completed_at ? { path_completed_at: instant } : {}),
    });
  }
}

function levelCurrentlyComplete(curriculum, level) {
  const sets = curriculum.filter((set) => set.cefr_level === level);
  return sets.length > 0 && sets.every((set) => set.items.length > 0 && set.cefr_learning_passes.length > 0);
}

function unresolvedPassItems(pass) {
  const resolved = new Set();
  for (const session of pass.learning_sessions ?? []) {
    if (session.status !== "COMPLETED" || session.mode !== "NORMAL") continue;
    for (const item of session.items) {
      if (item.evidence === "NORMAL_REVEALED" && item.evidence_event_id && item.evidence_at) resolved.add(item.vocabulary_id);
    }
  }
  return pass.items.filter((item) => !resolved.has(item.vocabulary_id));
}

function newestContinuableSession(sessions, instant) {
  return [...(sessions ?? [])].reverse().find((session) => (
    session.status === "ACTIVE" && session.mode === "NORMAL" && projectSessionLifecycle(session, instant) === "ACTIVE"
  )) ?? null;
}

function assertCompatibleSnapshot(pass, set) {
  if (!set) throw restartRequired();
  const currentIds = new Set(set.items.map((item) => item.vocabulary_id));
  if (pass.items.some((item) => !currentIds.has(item.vocabulary_id))) throw restartRequired();
}

function normalizeSetItems(items) {
  return items.map((item, position) => ({ vocabulary_id: item.vocabulary_id, position }));
}

function projectPass(pass, instant) {
  const remaining = pass.status === "ACTIVE" ? unresolvedPassItems(pass).length : 0;
  return {
    id: pass.id, set_id: pass.set_id_snapshot, state: pass.status,
    snapshot_size: pass.snapshot_size, studied_items: pass.snapshot_size - remaining,
    remaining_items: remaining, created_at: pass.created_at, completed_at: pass.completed_at,
  };
}

function projectPassWithCompatibility(pass, set, instant) {
  try { assertCompatibleSnapshot(pass, set); return { ...projectPass(pass, instant), can_continue: pass.status === "ACTIVE" }; }
  catch (error) {
    if (error.code !== "CEFR_PASS_RESTART_REQUIRED") throw error;
    return { ...projectPass(pass, instant), can_continue: false, restart_reason: "SNAPSHOT_CHANGED" };
  }
}

function assertPassCreationReplay(pass, setId) { if (pass.set_id_snapshot !== setId) throw operationConflict(); }
function requireActivePass(pass) { if (!pass) throw notFound(); if (pass.status !== "ACTIVE") throw conflict("CEFR_PASS_TERMINAL", "The learning pass is not active."); }
function validateOperation(input) { if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length !== 1 || !Object.hasOwn(input, "operation_id")) throw validation(); validateUuid(input.operation_id); return input.operation_id; }
function validateUuid(value) { if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw validation(); }
function validation() { return new LearningPathServiceError("CEFR_PATH_VALIDATION_ERROR", "Learning Path request data is invalid."); }
function notFound() { return new LearningPathServiceError("CEFR_PASS_NOT_FOUND", "Learning pass was not found."); }
function locked() { return new LearningPathServiceError("CEFR_LEVEL_LOCKED", "The required Set level is locked."); }
function configurationError() { return new LearningPathServiceError("CEFR_CURRICULUM_NOT_CONFIGURED", "The required Set has no vocabulary items."); }
function restartRequired() { return new LearningPathServiceError("CEFR_PASS_RESTART_REQUIRED", "The learning pass snapshot is no longer compatible."); }
function incomplete() { return new LearningPathServiceError("CEFR_PASS_INCOMPLETE", "Every bounded session must be completed with accepted reveal evidence."); }
function operationConflict() { return new LearningPathServiceError("CEFR_PASS_OPERATION_CONFLICT", "Operation identity was reused with a different request."); }
function conflict(code, message) { return new LearningPathServiceError(code, message); }
