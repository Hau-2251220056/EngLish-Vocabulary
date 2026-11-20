// @ts-nocheck
export const STREAK_TIME_ZONE = "Asia/Ho_Chi_Minh";

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const EXPLICIT_INSTANT_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/i;
const APPLICATION_DATE_FORMATTER = new Intl.DateTimeFormat(
  "en-US-u-ca-gregory-nu-latn",
  {
    timeZone: STREAK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  },
);

export function toApplicationDate(value) {
  const instant = requireInstant(value, "instant");
  const parts = Object.fromEntries(
    APPLICATION_DATE_FORMATTER
      .formatToParts(instant)
      .filter(({ type }) => type === "year" || type === "month" || type === "day")
      .map(({ type, value: partValue }) => [type, partValue]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function previousApplicationDate(value) {
  const { year, month, day } = parseIsoDate(value);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function projectCurrentStreak(activityDates, evaluatedAt) {
  if (!Array.isArray(activityDates)) {
    throw new TypeError("activityDates must be an array.");
  }

  const instant = requireInstant(evaluatedAt, "evaluatedAt");
  const today = toApplicationDate(instant);
  const yesterday = previousApplicationDate(today);
  const dates = new Set();

  for (const value of activityDates) {
    const date = requireIsoDate(value);
    if (date > today) {
      throw new TypeError("activityDates cannot contain a future application date.");
    }
    dates.add(date);
  }

  const lastQualifiedDate = dates.size === 0
    ? null
    : [...dates].sort().at(-1);
  const completedToday = dates.has(today);
  const anchor = completedToday ? today : dates.has(yesterday) ? yesterday : null;
  let currentStreak = 0;
  let cursor = anchor;

  while (cursor && dates.has(cursor)) {
    currentStreak += 1;
    cursor = previousApplicationDate(cursor);
  }

  return {
    current_streak: currentStreak,
    completed_today: completedToday,
    last_qualified_date: lastQualifiedDate,
    timezone: STREAK_TIME_ZONE,
    evaluated_at: instant.toISOString(),
  };
}

function requireIsoDate(value) {
  parseIsoDate(value);
  return value;
}

function parseIsoDate(value) {
  if (typeof value !== "string") {
    throw new TypeError("Application date must be an ISO YYYY-MM-DD string.");
  }
  const match = value.match(ISO_DATE_PATTERN);
  if (!match) {
    throw new TypeError("Application date must be an ISO YYYY-MM-DD string.");
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const canonical = new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
  if (canonical !== value) {
    throw new TypeError("Application date must be a valid ISO calendar date.");
  }
  return { year, month, day };
}

function requireInstant(value, name) {
  if (
    !(value instanceof Date)
    && !(typeof value === "number" && Number.isFinite(value))
    && !(typeof value === "string" && EXPLICIT_INSTANT_PATTERN.test(value))
  ) {
    throw new TypeError(`${name} must be a valid instant.`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`${name} must be a valid instant.`);
  }
  return date;
}
