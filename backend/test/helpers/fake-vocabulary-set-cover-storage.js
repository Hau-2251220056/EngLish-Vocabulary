import { randomUUID } from "node:crypto";
import { buildVocabularySetCoverPrefix } from "../../src/storage/vocabulary-set-cover-storage.js";

export function createFakeVocabularySetCoverStorage({ namespace = "unit-test", uuid = randomUUID } = {}) {
  const objects = new Map();
  const calls = [];
  const failures = new Map();

  return {
    calls,
    objects,
    failNext(operation, code = "COVER_STORAGE_FAILED") {
      failures.set(operation, code);
    },
    async upload({ setId, buffer }) {
      fail("upload");
      const key = `${buildVocabularySetCoverPrefix(namespace, setId)}${uuid()}.webp`;
      objects.set(key, Buffer.from(buffer));
      calls.push({ operation: "upload", setId, key, upsert: false });
      return { key, url: `https://storage.example.test/${key}` };
    },
    async copy({ sourceSetId, sourceKey, destinationSetId }) {
      fail("copy");
      requireOwned(sourceSetId, sourceKey);
      if (!objects.has(sourceKey)) throw storageError();
      const key = `${buildVocabularySetCoverPrefix(namespace, destinationSetId)}${uuid()}.webp`;
      objects.set(key, Buffer.from(objects.get(sourceKey)));
      calls.push({ operation: "copy", sourceKey, key });
      return { key, url: `https://storage.example.test/${key}` };
    },
    async listSetObjects(setId) {
      fail("list");
      const prefix = buildVocabularySetCoverPrefix(namespace, setId);
      calls.push({ operation: "list", setId });
      return [...objects.keys()].filter((key) => key.startsWith(prefix));
    },
    async removeObject({ setId, key }) {
      fail("remove");
      requireOwned(setId, key);
      objects.delete(key);
      calls.push({ operation: "remove", setId, keys: [key] });
    },
    async removeSetObjects({ setId, exceptKey = null }) {
      fail("remove");
      const prefix = buildVocabularySetCoverPrefix(namespace, setId);
      const keys = [...objects.keys()].filter((key) => key.startsWith(prefix) && key !== exceptKey);
      for (const key of keys) objects.delete(key);
      calls.push({ operation: "remove-set", setId, exceptKey, keys });
    },
  };

  function fail(operation) {
    const code = failures.get(operation);
    if (!code) return;
    failures.delete(operation);
    throw Object.assign(new Error("Fake cover storage operation failed."), { code });
  }

  function requireOwned(setId, key) {
    if (!key.startsWith(buildVocabularySetCoverPrefix(namespace, setId)) || key.includes("..") || key.includes("\\")) {
      throw Object.assign(new Error("Invalid cover storage key."), { code: "VALIDATION_ERROR" });
    }
  }
}

function storageError() {
  return Object.assign(new Error("Fake cover storage operation failed."), { code: "COVER_STORAGE_FAILED" });
}
