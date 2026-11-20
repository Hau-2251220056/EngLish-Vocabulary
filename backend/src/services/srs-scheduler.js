// @ts-nocheck
export const SRS_RATINGS = Object.freeze(["AGAIN", "HARD", "GOOD", "EASY"]);
export const SRS_INTERVAL_DAYS = Object.freeze([1, 3, 7, 14, 30]);

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function stageForInterval(intervalDays) {
  const index = SRS_INTERVAL_DAYS.indexOf(intervalDays);
  return index === -1 ? 0 : index + 1;
}

export function intervalForStage(stage) {
  return stage === 0 ? null : SRS_INTERVAL_DAYS[stage - 1] ?? null;
}

export function evaluateProgress(progress, evaluatedAt) {
  const instant = requireDate(evaluatedAt, "evaluatedAt");
  if (!progress) {
    return {
      stored_status: null,
      effective_status: "NEW",
      stage: 0,
      interval_days: null,
      next_review_at: null,
      is_eligible: true,
      is_due: true,
      is_legacy_unscheduled: false,
    };
  }

  const storedStatus = progress.status;
  const stage = stageForInterval(progress.interval_days);
  const validInterval = stage > 0;
  const nextReviewAt = asValidDate(progress.next_review_at);

  if (storedStatus === "LEARNING") {
    return result(progress, {
      storedStatus,
      effectiveStatus: "LEARNING",
      stage: 0,
      intervalDays: null,
      nextReviewAt,
      eligible: true,
      due: true,
      legacy: progress.interval_days !== null || nextReviewAt === null,
    });
  }

  if (storedStatus === "NEEDS_REVIEW") {
    return result(progress, {
      storedStatus,
      effectiveStatus: "NEEDS_REVIEW",
      stage,
      intervalDays: validInterval ? progress.interval_days : null,
      nextReviewAt,
      eligible: true,
      due: true,
      legacy: !validInterval,
    });
  }

  if (storedStatus === "LEARNED") {
    const completeSchedule = validInterval && nextReviewAt !== null;
    if (!completeSchedule) {
      return result(progress, {
        storedStatus,
        effectiveStatus: "LEARNED",
        stage,
        intervalDays: validInterval ? progress.interval_days : null,
        nextReviewAt,
        eligible: true,
        due: true,
        legacy: true,
      });
    }
    const due = nextReviewAt.getTime() <= instant.getTime();
    return result(progress, {
      storedStatus,
      effectiveStatus: due ? "NEEDS_REVIEW" : "LEARNED",
      stage,
      intervalDays: progress.interval_days,
      nextReviewAt,
      eligible: due,
      due,
      legacy: false,
    });
  }

  throw new TypeError("Unsupported Learning Progress status.");
}

export function calculateRatingTransition(progress, rating, acceptedAt) {
  if (!SRS_RATINGS.includes(rating)) {
    throw new TypeError("Unsupported SRS rating.");
  }
  const instant = requireDate(acceptedAt, "acceptedAt");
  const current = evaluateProgress(progress, instant);

  if (rating === "AGAIN") {
    return {
      status: "LEARNING",
      effective_status: "LEARNING",
      stage: 0,
      interval_days: null,
      next_review_at: new Date(instant),
      last_reviewed_at: new Date(instant),
    };
  }

  let nextStage;
  if (rating === "HARD") {
    nextStage = Math.max(1, current.stage);
  } else if (rating === "GOOD") {
    nextStage = current.stage === 0 ? 2 : Math.min(5, current.stage + 1);
  } else {
    nextStage = current.stage === 0 ? 3 : Math.min(5, current.stage + 2);
  }
  const intervalDays = intervalForStage(nextStage);

  return {
    status: "LEARNED",
    effective_status: "LEARNED",
    stage: nextStage,
    interval_days: intervalDays,
    next_review_at: new Date(instant.getTime() + intervalDays * DAY_IN_MS),
    last_reviewed_at: new Date(instant),
  };
}

function result(progress, {
  storedStatus,
  effectiveStatus,
  stage,
  intervalDays,
  nextReviewAt,
  eligible,
  due,
  legacy,
}) {
  return {
    stored_status: storedStatus,
    effective_status: effectiveStatus,
    stage,
    interval_days: intervalDays,
    next_review_at: nextReviewAt,
    is_eligible: eligible,
    is_due: due,
    is_legacy_unscheduled: legacy,
    review_count: progress.review_count,
    revision: progress.revision,
    last_reviewed_at: progress.last_reviewed_at ?? null,
  };
}

function asValidDate(value) {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function requireDate(value, name) {
  const date = asValidDate(value);
  if (!date) throw new TypeError(`${name} must be a valid date.`);
  return date;
}
