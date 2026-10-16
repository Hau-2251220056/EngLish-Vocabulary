const MEMORY_VALUES = new Map();
const MEMORY_FIRST_KEYS = new Set();

export const LEARNING_SESSION_MODES = Object.freeze({
  NORMAL_FLASHCARD: "NORMAL_FLASHCARD",
  SRS_FLASHCARD: "SRS_FLASHCARD",
  MULTIPLE_CHOICE_QUIZ: "MULTIPLE_CHOICE_QUIZ",
  SPEAKING_PRACTICE: "SPEAKING_PRACTICE",
});

const MODE_VALUES = new Set(Object.values(LEARNING_SESSION_MODES));

export function createSessionIdentity({ version, userId, setId, mode }) {
  if (!Number.isSafeInteger(version) || version < 1) throw new TypeError("Session version is invalid.");
  if (!isNonEmptyString(userId) || !isNonEmptyString(setId) || !MODE_VALUES.has(mode)) {
    throw new TypeError("Session identity is invalid.");
  }
  return Object.freeze({ version, user_id: userId, set_id: setId, mode });
}

export function createSessionStorageKey(namespace, identity) {
  if (!isNonEmptyString(namespace) || !isSessionIdentity(identity)) {
    throw new TypeError("Session storage key input is invalid.");
  }
  return [
    namespace,
    `v${identity.version}`,
    encodeURIComponent(identity.user_id),
    encodeURIComponent(identity.set_id),
    identity.mode,
  ].join(":");
}

export function readSessionValue(storage, key, validate = () => true) {
  if (!isNonEmptyString(key) || typeof validate !== "function") return null;
  let raw;
  if (MEMORY_FIRST_KEYS.has(key)) {
    raw = MEMORY_VALUES.get(key) ?? null;
  } else {
    try {
      raw = storage?.getItem(key) ?? null;
    } catch {
      raw = MEMORY_VALUES.get(key) ?? null;
    }
  }
  if (raw === null) raw = MEMORY_VALUES.get(key) ?? null;
  if (raw === null) return null;

  try {
    const value = JSON.parse(raw);
    if (!validate(value)) throw new TypeError("Stored session value is invalid.");
    return value;
  } catch {
    removeSessionValue(storage, key);
    return null;
  }
}

export function writeSessionValue(storage, key, value) {
  if (!isNonEmptyString(key)) return false;
  let raw;
  try {
    raw = JSON.stringify(value);
  } catch {
    return false;
  }
  if (raw === undefined) return false;

  MEMORY_VALUES.set(key, raw);
  try {
    if (typeof storage?.setItem !== "function") throw new TypeError("Session storage is unavailable.");
    storage.setItem(key, raw);
    MEMORY_FIRST_KEYS.delete(key);
    return true;
  } catch {
    MEMORY_FIRST_KEYS.add(key);
    return false;
  }
}

export function removeSessionValue(storage, key) {
  if (!isNonEmptyString(key)) return false;
  MEMORY_VALUES.delete(key);
  MEMORY_FIRST_KEYS.delete(key);
  try {
    if (typeof storage?.removeItem !== "function") throw new TypeError("Session storage is unavailable.");
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function clearSessionNamespace(storage, prefixes) {
  const ownedPrefixes = normalizePrefixes(prefixes);
  if (ownedPrefixes.length === 0) return false;

  for (const key of [...MEMORY_VALUES.keys()]) {
    if (hasOwnedPrefix(key, ownedPrefixes)) {
      MEMORY_VALUES.delete(key);
      MEMORY_FIRST_KEYS.delete(key);
    }
  }

  try {
    if (typeof storage?.key !== "function" || typeof storage?.removeItem !== "function") {
      throw new TypeError("Session storage is unavailable.");
    }
    const keys = [];
    for (let index = 0; index < (storage?.length ?? 0); index += 1) {
      const key = storage.key(index);
      if (hasOwnedPrefix(key, ownedPrefixes)) keys.push(key);
    }
    keys.forEach((key) => storage.removeItem(key));
    return true;
  } catch {
    return false;
  }
}

export function isSessionIdentity(value, expected = null) {
  const valid = Boolean(
    value && typeof value === "object" && !Array.isArray(value)
    && Number.isSafeInteger(value.version) && value.version > 0
    && isNonEmptyString(value.user_id) && isNonEmptyString(value.set_id)
    && MODE_VALUES.has(value.mode),
  );
  if (!valid || !expected) return valid;
  return value.version === expected.version
    && value.user_id === expected.user_id
    && value.set_id === expected.set_id
    && value.mode === expected.mode;
}

function normalizePrefixes(prefixes) {
  return [...new Set((Array.isArray(prefixes) ? prefixes : [prefixes]).filter(isNonEmptyString))];
}

function hasOwnedPrefix(key, prefixes) {
  return typeof key === "string" && prefixes.some((prefix) => key.startsWith(prefix));
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}
