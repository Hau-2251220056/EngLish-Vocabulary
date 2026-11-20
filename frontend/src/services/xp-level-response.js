const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const XP_LEVEL_FIELDS = [
  "total_xp",
  "level",
  "level_min_xp",
  "next_level_xp",
  "is_max_level",
];
const REWARD_FIELDS = [
  "source_event_id",
  "xp_earned",
  "replayed",
  ...XP_LEVEL_FIELDS,
];
const SUPPORTED_XP_AWARDS = new Set([0, 1, 3]);
const MAX_LEVEL = 15;

export function isXpLevelProjection(value) {
  if (!hasExactFields(value, XP_LEVEL_FIELDS)) return false;
  if (
    !isNonNegativeSafeInteger(value.total_xp)
    || !Number.isSafeInteger(value.level)
    || value.level < 1
    || value.level > MAX_LEVEL
    || !isNonNegativeSafeInteger(value.level_min_xp)
    || value.level_min_xp > value.total_xp
    || typeof value.is_max_level !== "boolean"
  ) return false;

  if (value.is_max_level) {
    return value.level === MAX_LEVEL && value.next_level_xp === null;
  }
  return value.level < MAX_LEVEL
    && isNonNegativeSafeInteger(value.next_level_xp)
    && value.next_level_xp > value.total_xp;
}

export function isRewardProjection(value) {
  return hasExactFields(value, REWARD_FIELDS)
    && UUID_PATTERN.test(value.source_event_id)
    && SUPPORTED_XP_AWARDS.has(value.xp_earned)
    && typeof value.replayed === "boolean"
    && isXpLevelProjection(pickXpLevel(value));
}

export function formatNewXpFeedback(reward) {
  return reward?.xp_earned > 0 && reward.replayed === false
    ? `+${reward.xp_earned} XP`
    : null;
}

function pickXpLevel(value) {
  return Object.fromEntries(XP_LEVEL_FIELDS.map((field) => [field, value[field]]));
}

function hasExactFields(value, fields) {
  return isRecord(value)
    && Object.keys(value).length === fields.length
    && fields.every((field) => Object.hasOwn(value, field));
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonNegativeSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}
