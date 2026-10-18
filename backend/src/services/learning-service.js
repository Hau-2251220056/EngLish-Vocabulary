// @ts-nocheck
import {
  SRS_RATINGS,
  calculateRatingTransition,
  evaluateProgress,
} from "./srs-scheduler.js";
import {
  XP_REWARD_TYPES,
  deriveSrsRewardCandidate,
  projectXpLevel,
} from "./xp-level-service.js";
import { isXpRewardCollisionError } from "../repositories/xp-reward-repository.js";
import {
  assertSnapshotIntegrity,
} from "../repositories/learning-session-repository.js";
import { completeLearningSessionAtomically } from "./learning-session-persistence.js";
import { captureOperationTime, projectSessionLifecycle } from "./learning-session-domain.js";
import { readStreakProjection, toSessionProjection } from "./learning-session-service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENT_FIELDS = new Set([
  "event_id",
  "set_id",
  "vocabulary_id",
  "expected_revision",
  "rating",
]);
const SET_QUERY_FIELDS = new Set(["mode"]);
const SET_MODES = new Set(["SRS", "NORMAL"]);
const PROGRESS_QUERY_FIELDS = new Set(["page", "page_size", "status"]);
const PROGRESS_STATUSES = new Set(["LEARNING", "LEARNED", "NEEDS_REVIEW"]);
const DEFAULT_PROGRESS_PAGE_SIZE = 20;
const MAX_PROGRESS_PAGE_SIZE = 100;

export class LearningServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "LearningServiceError";
    this.code = code;
  }
}

export function createLearningService({
  learningRepository,
  createSessionRepository,
  createStreakRepository,
  now = () => new Date(),
}) {
  return {
    async getLearningSet(userId, setId, input = {}) {
      validateUuid(userId);
      validateUuid(setId);
      const { mode } = validateSetQuery(input);
      const evaluatedAt = captureNow(now);
      const set = await learningRepository.findAccessibleSetForUser(setId, userId);
      if (!set) throw learningSetNotFoundError();
      if (set.items.length === 0) {
        throw new LearningServiceError(
          "LEARNING_SET_EMPTY",
          "Learning set has no vocabulary to learn.",
        );
      }

      const evaluatedItems = set.items.map((item) => ({
        item,
        evaluation: evaluateProgress(item.vocabulary.learning_progress[0], evaluatedAt),
      }));
      if (mode === "NORMAL") {
        return {
          id: set.id,
          name: set.name,
          topic: set.topic,
          mode,
          total_items: set.items.length,
          cards: evaluatedItems.map(({ item, evaluation }) => toCard(item, evaluation)),
        };
      }

      const eligible = evaluatedItems
        .filter(({ evaluation }) => evaluation.is_eligible)
        .sort(compareSrsItems);
      const futureDates = evaluatedItems
        .filter(({ evaluation }) => !evaluation.is_eligible && evaluation.next_review_at)
        .map(({ evaluation }) => evaluation.next_review_at);
      const nearestFuture = futureDates.length === 0
        ? null
        : new Date(Math.min(...futureDates.map((date) => date.getTime())));

      return {
        id: set.id,
        name: set.name,
        topic: set.topic,
        mode,
        evaluated_at: evaluatedAt,
        total_items: set.items.length,
        eligible_count: eligible.length,
        next_review_at: nearestFuture,
        cards: eligible.map(({ item, evaluation }) => toCard(
          item,
          evaluation,
          createRatingPreviews(item.vocabulary.learning_progress[0], evaluatedAt),
        )),
      };
    },

    async getLearningProgress(userId, input) {
      validateUuid(userId);
      const query = validateProgressQuery(input);
      const evaluatedAt = captureNow(now);
      const skip = (query.page - 1) * query.page_size;
      const { summaryProgress, filteredTotal, items, totalXp } =
        await learningRepository.withConsistentRead(async (repository) => {
          const [summaryProgress, filteredTotal, items, totalXp] = await Promise.all([
            repository.listProgressForSummary(userId),
            query.status
              ? repository.countProgress(userId, query.status, evaluatedAt)
              : Promise.resolve(null),
            repository.listProgress(userId, {
              status: query.status,
              evaluatedAt,
              skip,
              take: query.page_size,
            }),
            repository.readUserTotalXp(userId),
          ]);
          return { summaryProgress, filteredTotal, items, totalXp };
        });
      const summary = toProgressSummary(summaryProgress, evaluatedAt);
      const totalItems = filteredTotal ?? summary.total_started;
      return {
        evaluated_at: evaluatedAt,
        xp_level: projectXpLevel(totalXp),
        summary,
        items: items.map((item) => toProgressListItem(item, evaluatedAt)),
        pagination: {
          page: query.page,
          page_size: query.page_size,
          total_items: totalItems,
          total_pages: totalItems === 0 ? 0 : Math.ceil(totalItems / query.page_size),
        },
        filter: { status: query.status },
      };
    },

    async recordMeaningfulEvent(userId, input) {
      validateUuid(userId);
      const event = validateEventInput(input);
      if (event.session_id) {
        if (typeof createSessionRepository !== "function"
          || typeof createStreakRepository !== "function") {
          throw new TypeError("Session-aware Learning dependencies are required.");
        }
        try {
          return await recordSessionAwareSrsEvent({
            learningRepository, createSessionRepository, createStreakRepository,
            userId, event, now,
          });
        } catch (error) {
          if (isSrsReceiptCollision(error) || isEvidenceEventCollision(error)) {
            return recordSessionAwareSrsEvent({
              learningRepository, createSessionRepository, createStreakRepository,
              userId, event, now,
            });
          }
          if (isProgressIdentityCollision(error) || error?.code === "P2034"
            || isXpRewardCollisionError(error)) {
            throw learningProgressChangedError();
          }
          throw error;
        }
      }
      const acceptedAt = captureNow(now);
      try {
        return await learningRepository.withTransaction(async (repository) => {
          const accessibleSet = await repository.lockAccessibleSetForUser(
            event.set_id,
            userId,
          );
          if (!accessibleSet) throw learningSetNotFoundError();
          const setItem = await repository.lockSetItem(
            event.set_id,
            event.vocabulary_id,
          );
          if (!setItem) throw learningSetItemChangedError();

          await repository.lockProgressIdentity(userId, event.vocabulary_id);

          const current = await repository.findProgress(userId, event.vocabulary_id);
          if (current?.last_event_id === event.event_id) {
            return toAcceptedEventResult(repository, userId, event, current, true);
          }
          if (current && !evaluateProgress(current, acceptedAt).is_eligible) {
            throw learningProgressChangedError();
          }
          if (!current && event.expected_revision !== 0) {
            throw learningProgressChangedError();
          }
          if (current && current.revision !== event.expected_revision) {
            throw learningProgressChangedError();
          }

          const initialReward = await repository.findRewardByIdentity(
            userId,
            event.vocabulary_id,
            XP_REWARD_TYPES.SRS_INITIAL,
            0,
          );
          const rewardCandidate = deriveSrsRewardCandidate({
            user_id: userId,
            vocabulary_id: event.vocabulary_id,
            rating: event.rating,
            progress: current,
            has_initial_reward: Boolean(initialReward),
            accepted_at: acceptedAt,
          });

          const transition = calculateRatingTransition(current, event.rating, acceptedAt);
          const data = {
            status: transition.status,
            interval_days: transition.interval_days,
            next_review_at: transition.next_review_at,
            last_reviewed_at: transition.last_reviewed_at,
            last_event_id: event.event_id,
          };
          if (!current) {
            const created = await repository.createProgress({
              user_id: userId,
              vocabulary_id: event.vocabulary_id,
              ...data,
              review_count: 1,
              revision: 1,
            });
            return completeAcceptedEvent(
              repository,
              userId,
              event,
              created,
              rewardCandidate,
            );
          }

          const updated = await repository.updateProgressAtRevision(
            current.id,
            event.expected_revision,
            {
              ...data,
              review_count: { increment: 1 },
              revision: { increment: 1 },
            },
          );
          const latest = await repository.findProgress(userId, event.vocabulary_id);
          if (updated.count === 0) {
            if (latest?.last_event_id === event.event_id) {
              return toAcceptedEventResult(repository, userId, event, latest, true);
            }
            throw learningProgressChangedError();
          }
          return completeAcceptedEvent(
            repository,
            userId,
            event,
            latest,
            rewardCandidate,
          );
        });
      } catch (error) {
        if (
          error?.code === "P2002"
          || error?.code === "P2034"
          || isXpRewardCollisionError(error)
        ) {
          const latest = await learningRepository.findProgress(
            userId,
            event.vocabulary_id,
          );
          if (latest?.last_event_id === event.event_id) {
            return toAcceptedEventResult(
              learningRepository,
              userId,
              event,
              latest,
              true,
            );
          }
          throw learningProgressChangedError();
        }
        throw error;
      }
    },
  };
}

async function recordSessionAwareSrsEvent({
  learningRepository, createSessionRepository, createStreakRepository, userId, event, now,
}) {
  return learningRepository.withTransaction(async (repository, transaction) => {
    const sessions = createSessionRepository(transaction);
    const streaks = createStreakRepository(transaction);
    const session = await sessions.lockOwnedSession(event.session_id, userId);
    if (!session) throw sessionNotFoundError();
    if (session.mode !== "SRS" || session.set_id_snapshot !== event.set_id) {
      throw sessionEventConflictError();
    }
    const lockedItems = await sessions.lockSessionItems(session.id);
    assertSnapshotIntegrity(session.snapshot_size, lockedItems);
    const item = lockedItems.find(({ vocabulary_id: vocabularyId }) => (
      vocabularyId === event.vocabulary_id
    ));
    if (!item) throw sessionEventConflictError();

    const resolvingEvidence = event.rating === "AGAIN" ? null : `SRS_${event.rating}`;
    const receipt = await sessions.findSrsReceipt(event.event_id);
    if (receipt) {
      return replaySessionAwareSrsEvent({
        repository, streaks, session, lockedItems, item, receipt,
        userId, event, resolvingEvidence, now,
      });
    }
    const existingEvidence = await sessions.findEvidenceReplay(event.event_id);
    if (existingEvidence) {
      if (existingEvidence.session?.user_id !== userId) throw sessionNotFoundError();
      throw sessionEventConflictError();
    }

    if (!await repository.lockAccessibleSetForSessionSnapshot(event.set_id, userId)) {
      throw sessionInaccessibleError();
    }
    for (const candidate of [...lockedItems].sort((left, right) => (
      left.vocabulary_id.localeCompare(right.vocabulary_id)
    ))) {
      if (!await repository.lockSetItem(event.set_id, candidate.vocabulary_id)) {
        throw sessionInaccessibleError();
      }
    }
    await repository.lockProgressIdentity(userId, event.vocabulary_id);
    const current = await repository.findProgress(userId, event.vocabulary_id);
    const serializedReceipt = await sessions.findSrsReceipt(event.event_id);
    if (serializedReceipt) {
      return replaySessionAwareSrsEvent({
        repository, streaks, session, lockedItems, item, receipt: serializedReceipt,
        userId, event, resolvingEvidence, now, progressAlreadyLocked: true,
      });
    }
    if (current?.last_event_id === event.event_id) {
      throw sessionEventConflictError();
    }
    const acceptedAt = captureNow(now);

    const lifecycle = projectSessionLifecycle(session, acceptedAt);
    if (lifecycle === "EXPIRED") throw sessionExpiredError();
    if (item.evidence !== null || lifecycle !== "ACTIVE") throw sessionEventConflictError();
    const result = await applyAcceptedSrsMutation(repository, userId, event, acceptedAt, current);
    await sessions.recordSrsReceipt({
      item,
      eventId: event.event_id,
      rating: event.rating,
      expectedRevision: event.expected_revision,
      acceptedRevision: result.revision,
      acceptedAt,
    });
    if (!resolvingEvidence) {
      return { ...result, session: toSessionProjection({ ...session, items: lockedItems }, acceptedAt) };
    }

    const recorded = await sessions.recordEvidence({
      session,
      item,
      evidence: resolvingEvidence,
      eventId: event.event_id,
      acceptedAt,
    });
    if (recorded.count !== 1) throw sessionEventConflictError();
    const resolvedItems = lockedItems.map((candidate) => candidate.id === item.id ? {
      ...candidate,
      evidence: resolvingEvidence,
      evidence_event_id: event.event_id,
      evidence_at: acceptedAt,
    } : candidate);
    if (!resolvedItems.every(({ evidence }) => evidence !== null)) {
      return { ...result, session: toSessionProjection({ ...session, items: resolvedItems }, acceptedAt) };
    }

    const completion = await completeLearningSessionAtomically({
      sessionRepository: sessions,
      streakRepository: streaks,
      sessionId: session.id,
      userId,
      completionEventId: event.event_id,
      captureTime: () => captureOperationTime(() => acceptedAt),
    });
    return {
      ...result,
      session: toSessionProjection(completion.session, acceptedAt),
      streak: await readStreakProjection(streaks, userId, acceptedAt),
    };
  });
}

async function replaySessionAwareSrsEvent({
  repository, streaks, session, lockedItems, item, receipt,
  userId, event, resolvingEvidence, now, progressAlreadyLocked = false,
}) {
  if (receipt.session_item?.session?.user_id !== userId) throw sessionNotFoundError();
  if (
    receipt.session_item.session.mode !== "SRS"
    || receipt.session_item.session_id !== session.id
    || receipt.session_item_id !== item.id
    || receipt.session_item.vocabulary_id !== event.vocabulary_id
    || receipt.rating !== event.rating
    || receipt.expected_revision !== event.expected_revision
  ) {
    throw sessionEventConflictError();
  }
  if (!progressAlreadyLocked) {
    await repository.lockProgressIdentity(userId, event.vocabulary_id);
  }
  const current = await repository.findProgress(userId, event.vocabulary_id);
  if (
    current?.last_event_id !== event.event_id
    || current.revision !== receipt.accepted_revision
  ) {
    throw learningProgressChangedError();
  }
  if (resolvingEvidence) {
    if (item.evidence_event_id !== event.event_id || item.evidence !== resolvingEvidence) {
      throw sessionEventConflictError();
    }
  } else if (item.evidence !== null || item.evidence_event_id !== null) {
    throw sessionEventConflictError();
  }
  const evaluatedAt = captureNow(now);
  return attachSessionResult(
    await toAcceptedEventResult(repository, userId, event, current, true),
    session, lockedItems, streaks, userId, evaluatedAt,
  );
}

async function applyAcceptedSrsMutation(repository, userId, event, acceptedAt, current) {
  if (current && !evaluateProgress(current, acceptedAt).is_eligible) {
    throw learningProgressChangedError();
  }
  if ((!current && event.expected_revision !== 0)
    || (current && current.revision !== event.expected_revision)) {
    throw learningProgressChangedError();
  }
  const initialReward = await repository.findRewardByIdentity(
    userId, event.vocabulary_id, XP_REWARD_TYPES.SRS_INITIAL, 0,
  );
  const rewardCandidate = deriveSrsRewardCandidate({
    user_id: userId,
    vocabulary_id: event.vocabulary_id,
    rating: event.rating,
    progress: current,
    has_initial_reward: Boolean(initialReward),
    accepted_at: acceptedAt,
  });
  const transition = calculateRatingTransition(current, event.rating, acceptedAt);
  const data = {
    status: transition.status,
    interval_days: transition.interval_days,
    next_review_at: transition.next_review_at,
    last_reviewed_at: transition.last_reviewed_at,
    last_event_id: event.event_id,
  };
  if (!current) {
    const created = await repository.createProgress({
      user_id: userId,
      vocabulary_id: event.vocabulary_id,
      ...data,
      review_count: 1,
      revision: 1,
    });
    return completeAcceptedEvent(repository, userId, event, created, rewardCandidate);
  }
  const updated = await repository.updateProgressAtRevision(current.id, event.expected_revision, {
    ...data,
    review_count: { increment: 1 },
    revision: { increment: 1 },
  });
  if (updated.count !== 1) throw learningProgressChangedError();
  return completeAcceptedEvent(
    repository,
    userId,
    event,
    await repository.findProgress(userId, event.vocabulary_id),
    rewardCandidate,
  );
}

async function attachSessionResult(result, session, items, streaks, userId, acceptedAt) {
  const projected = toSessionProjection({ ...session, items }, acceptedAt);
  if (projected.state !== "COMPLETED") return { ...result, session: projected };
  return {
    ...result,
    session: projected,
    streak: await readStreakProjection(streaks, userId, acceptedAt),
  };
}

async function completeAcceptedEvent(
  repository,
  userId,
  event,
  progress,
  rewardCandidate,
) {
  let xpEarned = 0;
  let totalXp;
  if (rewardCandidate) {
    const result = await repository.insertRewardAndIncrementXp({
      user_id: userId,
      vocabulary_id: event.vocabulary_id,
      ...rewardCandidate,
      source_event_id: event.event_id,
    });
    xpEarned = result.reward.xp_amount;
    totalXp = result.total_xp;
  } else {
    totalXp = await repository.readUserTotalXp(userId);
  }
  return withRewardProjection(progress, event.event_id, xpEarned, false, totalXp);
}

async function toAcceptedEventResult(
  repository,
  userId,
  event,
  progress,
  replayed,
) {
  const [reward, totalXp] = await Promise.all([
    repository.findRewardBySourceEvent(userId, event.event_id),
    repository.readUserTotalXp(userId),
  ]);
  const xpEarned = reward?.vocabulary_id === event.vocabulary_id
    ? reward.xp_amount
    : 0;
  return withRewardProjection(progress, event.event_id, xpEarned, replayed, totalXp);
}

function withRewardProjection(progress, sourceEventId, xpEarned, replayed, totalXp) {
  const projection = projectXpLevel(totalXp);
  return {
    ...toAuthoritativeProgress(progress),
    reward: {
      source_event_id: sourceEventId,
      xp_earned: xpEarned,
      replayed,
      ...projection,
    },
  };
}

function compareSrsItems(left, right) {
  const leftNew = left.evaluation.stored_status === null ? 1 : 0;
  const rightNew = right.evaluation.stored_status === null ? 1 : 0;
  return leftNew - rightNew
    || left.item.position - right.item.position
    || left.item.vocabulary.id.localeCompare(right.item.vocabulary.id);
}

function toCard(item, evaluation, ratingPreviews = undefined) {
  const { learning_progress: _progressRows, ...vocabulary } = item.vocabulary;
  return {
    position: item.position,
    ...vocabulary,
    progress: {
      status: evaluation.effective_status,
      stored_status: evaluation.stored_status,
      effective_status: evaluation.effective_status,
      stage: evaluation.stage,
      interval_days: evaluation.interval_days,
      next_review_at: evaluation.next_review_at,
      review_count: evaluation.review_count ?? 0,
      revision: evaluation.revision ?? 0,
      last_reviewed_at: evaluation.last_reviewed_at ?? null,
    },
    ...(ratingPreviews ? { rating_previews: ratingPreviews } : {}),
  };
}

function createRatingPreviews(progress, evaluatedAt) {
  return Object.fromEntries(SRS_RATINGS.map((rating) => {
    if (rating === "AGAIN") {
      return [rating, { kind: "SESSION_REQUEUE", interval_days: null }];
    }
    const transition = calculateRatingTransition(progress, rating, evaluatedAt);
    return [rating, { kind: "SCHEDULED", interval_days: transition.interval_days }];
  }));
}

function toProgressListItem(item, evaluatedAt) {
  const evaluation = evaluateProgress(item, evaluatedAt);
  return {
    status: evaluation.effective_status,
    review_count: item.review_count,
    last_reviewed_at: item.last_reviewed_at,
    interval_days: evaluation.interval_days,
    next_review_at: evaluation.next_review_at,
    vocabulary: item.vocabulary,
  };
}

function toAuthoritativeProgress(progress) {
  const evaluation = evaluateProgress(
    progress,
    progress.last_reviewed_at ?? progress.next_review_at ?? new Date(0),
  );
  return {
    vocabulary_id: progress.vocabulary_id,
    status: progress.status,
    stored_status: progress.status,
    effective_status: evaluation.effective_status,
    stage: evaluation.stage,
    interval_days: evaluation.interval_days,
    next_review_at: evaluation.next_review_at,
    last_reviewed_at: progress.last_reviewed_at,
    review_count: progress.review_count,
    revision: progress.revision,
  };
}

function validateSetQuery(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw validationError();
  const fields = Object.keys(input);
  if (fields.some((field) => !SET_QUERY_FIELDS.has(field))) throw validationError();
  const mode = Object.hasOwn(input, "mode") ? input.mode : "SRS";
  if (typeof mode !== "string" || !SET_MODES.has(mode)) throw validationError();
  return { mode };
}

function validateUuid(value) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw validationError();
}

function validateEventInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw validationError();
  const fields = Object.keys(input);
  if (
    (fields.length !== EVENT_FIELDS.size && fields.length !== EVENT_FIELDS.size + 1)
    || fields.some((field) => !EVENT_FIELDS.has(field) && field !== "session_id")
    || [...EVENT_FIELDS].some((field) => !Object.hasOwn(input, field))
  ) {
    throw validationError();
  }
  validateUuid(input.event_id);
  validateUuid(input.set_id);
  validateUuid(input.vocabulary_id);
  if (Object.hasOwn(input, "session_id")) validateUuid(input.session_id);
  if (
    !Number.isSafeInteger(input.expected_revision)
    || input.expected_revision < 0
    || !SRS_RATINGS.includes(input.rating)
  ) {
    throw validationError();
  }
  return { ...input };
}

function validateProgressQuery(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw validationError();
  const fields = Object.keys(input);
  if (fields.some((field) => !PROGRESS_QUERY_FIELDS.has(field))) throw validationError();
  const page = Object.hasOwn(input, "page") ? parsePositiveInteger(input.page) : 1;
  const pageSize = Object.hasOwn(input, "page_size")
    ? parsePositiveInteger(input.page_size)
    : DEFAULT_PROGRESS_PAGE_SIZE;
  if (pageSize > MAX_PROGRESS_PAGE_SIZE) throw validationError();
  const status = Object.hasOwn(input, "status") ? input.status : null;
  if (status !== null && (typeof status !== "string" || !PROGRESS_STATUSES.has(status))) {
    throw validationError();
  }
  return { page, page_size: pageSize, status };
}

function parsePositiveInteger(value) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) throw validationError();
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw validationError();
  return parsed;
}

function toProgressSummary(rows, evaluatedAt) {
  const counts = { LEARNING: 0, LEARNED: 0, NEEDS_REVIEW: 0 };
  for (const row of rows) {
    counts[evaluateProgress(row, evaluatedAt).effective_status] += 1;
  }
  return {
    total_started: counts.LEARNING + counts.LEARNED + counts.NEEDS_REVIEW,
    learning: counts.LEARNING,
    learned: counts.LEARNED,
    needs_review: counts.NEEDS_REVIEW,
  };
}

function captureNow(now) {
  const date = new Date(now());
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("Learning clock must return a valid date.");
  }
  return date;
}

function validationError() {
  return new LearningServiceError("VALIDATION_ERROR", "Learning request data is invalid.");
}

function learningSetNotFoundError() {
  return new LearningServiceError("LEARNING_SET_NOT_FOUND", "Learning set was not found.");
}

function learningSetItemChangedError() {
  return new LearningServiceError(
    "LEARNING_SET_ITEM_CHANGED",
    "The vocabulary is no longer available in this learning set.",
  );
}

function learningProgressChangedError() {
  return new LearningServiceError(
    "LEARNING_PROGRESS_CHANGED",
    "Learning progress changed. Refresh before trying again.",
  );
}

function sessionNotFoundError() {
  return new LearningServiceError(
    "LEARNING_SESSION_NOT_FOUND",
    "Learning session was not found.",
  );
}

function sessionInaccessibleError() {
  return new LearningServiceError(
    "LEARNING_SESSION_INACCESSIBLE",
    "Learning session is no longer accessible.",
  );
}

function sessionExpiredError() {
  return new LearningServiceError(
    "LEARNING_SESSION_EXPIRED",
    "Learning session has expired.",
  );
}

function sessionEventConflictError() {
  return new LearningServiceError(
    "LEARNING_SESSION_EVENT_CONFLICT",
    "Learning session event conflicts with accepted evidence.",
  );
}

function prismaUniqueTarget(error) {
  if (error?.code !== "P2002") return "";
  return Array.isArray(error.meta?.target)
    ? error.meta.target.join(",")
    : String(error.meta?.target ?? error.meta?.constraint ?? "");
}

function isSrsReceiptCollision(error) {
  const target = prismaUniqueTarget(error);
  return target.includes("LEARNING_SESSION_SRS_RECEIPT_pkey")
    || (error?.meta?.modelName === "LEARNING_SESSION_SRS_RECEIPT"
      && target.split(",").includes("event_id"));
}

function isEvidenceEventCollision(error) {
  const target = prismaUniqueTarget(error);
  return target.includes("LEARNING_SESSION_ITEM_evidence_event_id_key")
    || (error?.meta?.modelName === "LEARNING_SESSION_ITEM"
      && target.split(",").includes("evidence_event_id"));
}

function isProgressIdentityCollision(error) {
  const target = prismaUniqueTarget(error);
  return target.includes("LEARNING_PROGRESS_user_id_vocabulary_id_key")
    || (error?.meta?.modelName === "LEARNING_PROGRESS"
      && target.includes("user_id") && target.includes("vocabulary_id"));
}
