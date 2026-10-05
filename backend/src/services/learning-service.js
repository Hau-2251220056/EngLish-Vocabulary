// @ts-nocheck
import {
  SRS_RATINGS,
  calculateRatingTransition,
  evaluateProgress,
} from "./srs-scheduler.js";

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

export function createLearningService({ learningRepository, now = () => new Date() }) {
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
      const { summaryRows, totalItems, items } =
        await learningRepository.withConsistentRead(async (repository) => {
          const [summaryRows, totalItems, items] = await Promise.all([
            repository.summarizeProgress(userId, evaluatedAt),
            repository.countProgress(userId, query.status, evaluatedAt),
            repository.listProgress(userId, {
              status: query.status,
              evaluatedAt,
              skip,
              take: query.page_size,
            }),
          ]);
          return { summaryRows, totalItems, items };
        });
      return {
        evaluated_at: evaluatedAt,
        summary: toProgressSummary(summaryRows),
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

          const current = await repository.findProgress(userId, event.vocabulary_id);
          if (current?.last_event_id === event.event_id) {
            return toAuthoritativeProgress(current);
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
            return toAuthoritativeProgress(created);
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
              return toAuthoritativeProgress(latest);
            }
            throw learningProgressChangedError();
          }
          return toAuthoritativeProgress(latest);
        });
      } catch (error) {
        if (error?.code === "P2002" || error?.code === "P2034") {
          const latest = await learningRepository.findProgress(
            userId,
            event.vocabulary_id,
          );
          if (latest?.last_event_id === event.event_id) {
            return toAuthoritativeProgress(latest);
          }
          throw learningProgressChangedError();
        }
        throw error;
      }
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
  if (
    Object.keys(input).length !== EVENT_FIELDS.size
    || Object.keys(input).some((field) => !EVENT_FIELDS.has(field))
    || [...EVENT_FIELDS].some((field) => !Object.hasOwn(input, field))
  ) {
    throw validationError();
  }
  validateUuid(input.event_id);
  validateUuid(input.set_id);
  validateUuid(input.vocabulary_id);
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

function toProgressSummary(rows) {
  const counts = { LEARNING: 0, LEARNED: 0, NEEDS_REVIEW: 0 };
  for (const row of rows) counts[row.status] = row._count._all;
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
