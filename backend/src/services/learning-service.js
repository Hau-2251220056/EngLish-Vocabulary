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
