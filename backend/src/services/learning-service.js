// @ts-nocheck
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENT_FIELDS = new Set([
  "event_id",
  "set_id",
  "vocabulary_id",
  "expected_revision",
  "outcome",
]);
const STATUS_BY_OUTCOME = {
  REMEMBERED: "LEARNED",
  STUDY_AGAIN: "LEARNING",
};
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

export function createLearningService({ learningRepository }) {
  return {
    async getLearningSet(userId, setId) {
      validateUuid(userId);
      validateUuid(setId);

      const set = await learningRepository.findAccessibleSetForUser(setId, userId);
      if (!set) {
        throw new LearningServiceError(
          "LEARNING_SET_NOT_FOUND",
          "Learning set was not found.",
        );
      }
      if (set.items.length === 0) {
        throw new LearningServiceError(
          "LEARNING_SET_EMPTY",
          "Learning set has no vocabulary to learn.",
        );
      }

      return {
        id: set.id,
        name: set.name,
        topic: set.topic,
        cards: set.items.map(toCard),
      };
    },

    async getLearningProgress(userId, input) {
      validateUuid(userId);
      const query = validateProgressQuery(input);
      const skip = (query.page - 1) * query.page_size;

      const { summaryRows, totalItems, items } =
        await learningRepository.withConsistentRead(async (repository) => {
          const [summaryRows, totalItems, items] = await Promise.all([
            repository.summarizeProgress(userId),
            repository.countProgress(userId, query.status),
            repository.listProgress(userId, {
              status: query.status,
              skip,
              take: query.page_size,
            }),
          ]);
          return { summaryRows, totalItems, items };
        });
      const summary = toProgressSummary(summaryRows);

      return {
        summary,
        items,
        pagination: {
          page: query.page,
          page_size: query.page_size,
          total_items: totalItems,
          total_pages:
            totalItems === 0 ? 0 : Math.ceil(totalItems / query.page_size),
        },
        filter: { status: query.status },
      };
    },

    async recordMeaningfulEvent(userId, input) {
      validateUuid(userId);
      const event = validateEventInput(input);

      try {
        return await learningRepository.withTransaction(async (repository) => {
          const accessibleSet = await repository.lockAccessibleSetForUser(
            event.set_id,
            userId,
          );
          if (!accessibleSet) {
            throw learningSetNotFoundError();
          }

          const setItem = await repository.lockSetItem(
            event.set_id,
            event.vocabulary_id,
          );
          if (!setItem) {
            throw learningSetItemChangedError();
          }

          const current = await repository.findProgress(
            userId,
            event.vocabulary_id,
          );
          if (current?.last_event_id === event.event_id) {
            return toProgress(current);
          }

          const status = STATUS_BY_OUTCOME[event.outcome];
          const reviewedAt = new Date();
          if (!current) {
            if (event.expected_revision !== 0) {
              throw learningProgressChangedError();
            }
            const created = await repository.createProgress({
              user_id: userId,
              vocabulary_id: event.vocabulary_id,
              status,
              review_count: 1,
              revision: 1,
              last_reviewed_at: reviewedAt,
              last_event_id: event.event_id,
            });
            return toProgress(created);
          }

          if (current.revision !== event.expected_revision) {
            throw learningProgressChangedError();
          }

          const updated = await repository.updateProgressAtRevision(
            current.id,
            event.expected_revision,
            {
              status,
              review_count: { increment: 1 },
              revision: { increment: 1 },
              last_reviewed_at: reviewedAt,
              last_event_id: event.event_id,
            },
          );
          const latest = await repository.findProgress(
            userId,
            event.vocabulary_id,
          );
          if (updated.count === 0) {
            if (latest?.last_event_id === event.event_id) {
              return toProgress(latest);
            }
            throw learningProgressChangedError();
          }
          return toProgress(latest);
        });
      } catch (error) {
        if (error?.code === "P2002" || error?.code === "P2034") {
          const latest = await learningRepository.findProgress(
            userId,
            event.vocabulary_id,
          );
          if (latest?.last_event_id === event.event_id) {
            return toProgress(latest);
          }
          throw learningProgressChangedError();
        }
        throw error;
      }
    },
  };
}

function toCard(item) {
  const { learning_progress: progressRows, ...vocabulary } = item.vocabulary;
  const progress = progressRows[0];

  return {
    position: item.position,
    ...vocabulary,
    progress: progress
      ? {
          status: progress.status,
          review_count: progress.review_count,
          revision: progress.revision,
          last_reviewed_at: progress.last_reviewed_at,
        }
      : {
          status: "NEW",
          review_count: 0,
          revision: 0,
          last_reviewed_at: null,
        },
  };
}

function validateUuid(value) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new LearningServiceError(
      "VALIDATION_ERROR",
      "Learning request data is invalid.",
    );
  }
}

function validateEventInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError();
  }
  if (
    Object.keys(input).length !== EVENT_FIELDS.size ||
    Object.keys(input).some((field) => !EVENT_FIELDS.has(field)) ||
    [...EVENT_FIELDS].some((field) => !Object.hasOwn(input, field))
  ) {
    throw validationError();
  }

  validateUuid(input.event_id);
  validateUuid(input.set_id);
  validateUuid(input.vocabulary_id);
  if (
    !Number.isSafeInteger(input.expected_revision) ||
    input.expected_revision < 0 ||
    !Object.hasOwn(STATUS_BY_OUTCOME, input.outcome)
  ) {
    throw validationError();
  }
  return { ...input };
}

function validateProgressQuery(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError();
  }
  const fields = Object.keys(input);
  if (fields.some((field) => !PROGRESS_QUERY_FIELDS.has(field))) {
    throw validationError();
  }

  const page = Object.hasOwn(input, "page")
    ? parsePositiveInteger(input.page)
    : 1;
  const pageSize = Object.hasOwn(input, "page_size")
    ? parsePositiveInteger(input.page_size)
    : DEFAULT_PROGRESS_PAGE_SIZE;
  if (pageSize > MAX_PROGRESS_PAGE_SIZE) {
    throw validationError();
  }

  const status = Object.hasOwn(input, "status") ? input.status : null;
  if (
    status !== null &&
    (typeof status !== "string" || !PROGRESS_STATUSES.has(status))
  ) {
    throw validationError();
  }

  return { page, page_size: pageSize, status };
}

function parsePositiveInteger(value) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    throw validationError();
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw validationError();
  }
  return parsed;
}

function toProgressSummary(rows) {
  const counts = {
    LEARNING: 0,
    LEARNED: 0,
    NEEDS_REVIEW: 0,
  };
  for (const row of rows) {
    if (Object.hasOwn(counts, row.status)) {
      counts[row.status] = row._count._all;
    }
  }
  return {
    total_started: counts.LEARNING + counts.LEARNED + counts.NEEDS_REVIEW,
    learning: counts.LEARNING,
    learned: counts.LEARNED,
    needs_review: counts.NEEDS_REVIEW,
  };
}

function toProgress(progress) {
  return {
    status: progress.status,
    review_count: progress.review_count,
    revision: progress.revision,
    last_reviewed_at: progress.last_reviewed_at,
  };
}

function validationError() {
  return new LearningServiceError(
    "VALIDATION_ERROR",
    "Learning request data is invalid.",
  );
}

function learningSetNotFoundError() {
  return new LearningServiceError(
    "LEARNING_SET_NOT_FOUND",
    "Learning set was not found.",
  );
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
