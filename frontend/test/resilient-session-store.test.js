import assert from "node:assert/strict";
import test from "node:test";
import {
  clearSessionNamespace,
  createSessionIdentity,
  createSessionStorageKey,
  LEARNING_SESSION_MODES,
  readSessionValue,
  removeSessionValue,
  writeSessionValue,
} from "../src/session-storage/resilient-session-store.js";

let keySequence = 0;

test("versioned keys isolate USER, Set and every learning mode", () => {
  const normal = identity("user-a", "set-a", LEARNING_SESSION_MODES.NORMAL_FLASHCARD);
  const srs = identity("user-a", "set-a", LEARNING_SESSION_MODES.SRS_FLASHCARD);
  const otherUser = identity("user-b", "set-a", LEARNING_SESSION_MODES.NORMAL_FLASHCARD);
  const otherSet = identity("user-a", "set-b", LEARNING_SESSION_MODES.NORMAL_FLASHCARD);
  const keys = [normal, srs, otherUser, otherSet].map((value) => createSessionStorageKey("elvocab.session", value));
  assert.equal(new Set(keys).size, keys.length);
  assert.match(keys[0], /:v1:user-a:set-a:NORMAL_FLASHCARD$/);
});

test("native write failure falls back to page-lifetime memory without blocking reads", () => {
  const storage = throwingStorage();
  const key = uniqueKey("denied");
  const value = { version: 1, user_id: "user", set_id: "set", mode: "NORMAL_FLASHCARD" };
  assert.equal(writeSessionValue(storage, key, value), false);
  assert.deepEqual(readSessionValue(storage, key, (candidate) => candidate.user_id === "user"), value);
  assert.equal(removeSessionValue(storage, key), false);
  assert.equal(readSessionValue(storage, key), null);
});

test("memory stays synchronized when native storage later becomes unavailable", () => {
  const storage = memoryStorage();
  const key = uniqueKey("later-denied");
  assert.equal(writeSessionValue(storage, key, { cursor: "one" }), true);
  storage.deny();
  assert.deepEqual(readSessionValue(storage, key, (value) => value.cursor === "one"), { cursor: "one" });
});

test("a failed update reads the newer fallback instead of stale native data", () => {
  const storage = memoryStorage();
  const key = uniqueKey("stale-native");
  writeSessionValue(storage, key, { cursor: "old" });
  storage.denyWrites();
  assert.equal(writeSessionValue(storage, key, { cursor: "new" }), false);
  assert.deepEqual(readSessionValue(storage, key), { cursor: "new" });
});

test("malformed and validator-rejected records fail closed and are removed", () => {
  const storage = memoryStorage();
  const malformedKey = uniqueKey("malformed");
  const wrongUserKey = uniqueKey("wrong-user");
  storage.setItem(malformedKey, "{");
  storage.setItem(wrongUserKey, JSON.stringify({ user_id: "other" }));
  assert.equal(readSessionValue(storage, malformedKey), null);
  assert.equal(readSessionValue(storage, wrongUserKey, (value) => value.user_id === "expected"), null);
  assert.equal(storage.getItem(malformedKey), null);
  assert.equal(storage.getItem(wrongUserKey), null);
});

test("namespace cleanup clears native and fallback values but preserves unrelated keys", () => {
  const storage = memoryStorage();
  const prefix = uniqueKey("owned:");
  const nativeKey = `${prefix}native`;
  const fallbackKey = `${prefix}fallback`;
  storage.setItem("unrelated", "keep");
  writeSessionValue(storage, nativeKey, { value: 1 });
  storage.denyWrites();
  writeSessionValue(storage, fallbackKey, { value: 2 });
  storage.allow();
  clearSessionNamespace(storage, prefix);
  assert.equal(storage.getItem(nativeKey), null);
  assert.equal(readSessionValue(storage, fallbackKey), null);
  assert.equal(storage.getItem("unrelated"), "keep");
});

test("identity validation rejects unsupported modes and empty identities", () => {
  assert.throws(() => identity("", "set", LEARNING_SESSION_MODES.SRS_FLASHCARD), TypeError);
  assert.throws(() => identity("user", "set", "UNKNOWN"), TypeError);
});

function identity(userId, setId, mode) {
  return createSessionIdentity({ version: 1, userId, setId, mode });
}

function uniqueKey(suffix) {
  keySequence += 1;
  return `elvocab.test.${keySequence}.${suffix}`;
}

function throwingStorage() {
  return {
    get length() { throw new DOMException("denied", "SecurityError"); },
    getItem() { throw new DOMException("denied", "SecurityError"); },
    key() { throw new DOMException("denied", "SecurityError"); },
    removeItem() { throw new DOMException("denied", "SecurityError"); },
    setItem() { throw new DOMException("denied", "SecurityError"); },
  };
}

function memoryStorage() {
  const values = new Map();
  let readDenied = false;
  let writeDenied = false;
  return {
    get length() { if (readDenied) throw new Error("denied"); return values.size; },
    getItem(key) { if (readDenied) throw new Error("denied"); return values.get(key) ?? null; },
    key(index) { if (readDenied) throw new Error("denied"); return [...values.keys()][index] ?? null; },
    removeItem(key) { if (writeDenied) throw new Error("denied"); values.delete(key); },
    setItem(key, value) { if (writeDenied) throw new Error("denied"); values.set(key, String(value)); },
    deny() { readDenied = true; writeDenied = true; },
    denyWrites() { writeDenied = true; },
    allow() { readDenied = false; writeDenied = false; },
  };
}
