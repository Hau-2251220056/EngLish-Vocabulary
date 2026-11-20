import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { readVocabularySetCoverStorageConfig } from "../config/vocabulary-set-cover-storage-config.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createVocabularySetCoverStorage({
  env = process.env,
  test = false,
  clientFactory = createClient,
  uuid = randomUUID,
} = {}) {
  let context;
  function getContext() {
    if (context) return context;
    const config = readVocabularySetCoverStorageConfig({ env, test });
    const client = clientFactory(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    context = { config, bucket: client.storage.from(config.bucket) };
    return context;
  }

  return {
    async upload({ setId, buffer }) {
      requireBuffer(buffer);
      const { config, bucket } = getContext();
      const key = buildKey(config.namespace, setId, uuid());
      const { error } = await bucket.upload(key, buffer, { contentType: "image/webp", upsert: false });
      if (error) throw providerError("upload");
      return { key, url: publicUrl(bucket, key) };
    },
    async copy({ sourceSetId, sourceKey, destinationSetId }) {
      const { config, bucket } = getContext();
      requireOwnedKey(config.namespace, sourceSetId, sourceKey);
      const key = buildKey(config.namespace, destinationSetId, uuid());
      const { error } = await bucket.copy(sourceKey, key);
      if (error) throw providerError("copy");
      return { key, url: publicUrl(bucket, key) };
    },
    async listSetObjects(setId) {
      const { config, bucket } = getContext();
      const prefix = buildPrefix(config.namespace, setId);
      const { data, error } = await bucket.list(prefix, { limit: 1000 });
      if (error) throw providerError("list");
      return (data ?? []).map(({ name }) => `${prefix}${name}`).filter((key) => isOwnedKey(config.namespace, setId, key));
    },
    async removeObject({ setId, key }) {
      const { config, bucket } = getContext();
      requireOwnedKey(config.namespace, setId, key);
      const { error } = await bucket.remove([key]);
      if (error) throw providerError("remove");
    },
    async removeSetObjects({ setId, exceptKey = null }) {
      const keys = (await this.listSetObjects(setId)).filter((key) => key !== exceptKey);
      if (keys.length === 0) return;
      const { bucket } = getContext();
      const { error } = await bucket.remove(keys);
      if (error) throw providerError("remove");
    },
  };
}

export function buildVocabularySetCoverPrefix(namespace, setId) {
  return buildPrefix(namespace, setId);
}

function buildPrefix(namespace, setId) {
  requireNamespace(namespace);
  requireSetId(setId);
  return `${namespace}/vocabulary-sets/${setId}/`;
}

function buildKey(namespace, setId, objectId) {
  if (!UUID_PATTERN.test(objectId)) throw invalidKeyError();
  return `${buildPrefix(namespace, setId)}${objectId}.webp`;
}

function isOwnedKey(namespace, setId, key) {
  if (typeof key !== "string" || key.includes("..") || key.includes("\\")) return false;
  const prefix = buildPrefix(namespace, setId);
  return key.startsWith(prefix) && /^[0-9a-f-]{36}\.webp$/i.test(key.slice(prefix.length));
}

function requireOwnedKey(namespace, setId, key) {
  if (!isOwnedKey(namespace, setId, key)) throw invalidKeyError();
}

function requireNamespace(value) {
  if (!/^[a-z0-9][a-z0-9_-]{0,62}$/i.test(value)) throw invalidKeyError();
}

function requireSetId(value) {
  if (!UUID_PATTERN.test(value)) throw invalidKeyError();
}

function requireBuffer(value) {
  if (!Buffer.isBuffer(value) || value.length === 0) throw invalidKeyError();
}

function publicUrl(bucket, key) {
  const result = bucket.getPublicUrl(key);
  const url = result?.data?.publicUrl;
  if (typeof url !== "string" || url.length === 0) throw providerError("public-url");
  return url;
}

function invalidKeyError() {
  return Object.assign(new Error("Invalid cover storage key."), { code: "VALIDATION_ERROR" });
}

function providerError(operation) {
  return Object.assign(new Error("Cover storage operation failed."), {
    code: operation === "remove" || operation === "list"
      ? "COVER_STORAGE_CLEANUP_FAILED"
      : "COVER_STORAGE_FAILED",
  });
}
