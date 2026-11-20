import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createVocabularySetService } from "../../src/services/vocabulary-set-service.js";
import { createFakeVocabularySetCoverStorage } from "../helpers/fake-vocabulary-set-cover-storage.js";

const ownerId = randomUUID();
const sourceId = randomUUID();

test("upload persistence failure compensates the exact new object and preserves old metadata", async () => {
  const storage = createFakeVocabularySetCoverStorage({ namespace: "lifecycle-test" });
  const old = await storage.upload({ setId: sourceId, buffer: Buffer.from("old") });
  const source = aggregate({ id: sourceId, cover_image_url: old.url, cover_storage_key: old.key });
  const repository = repositoryFor(source, { updateCoverError: Object.assign(new Error("db"), { code: "DB_FAIL" }) });
  const service = serviceFor(repository, storage);
  await assert.rejects(service.uploadSystemCover(sourceId, file()), /db/);
  assert.equal(storage.objects.has(old.key), true);
  assert.equal(storage.objects.size, 1);
});

test("managed copy is independent and compensates destination object when DB persistence fails", async () => {
  const storage = createFakeVocabularySetCoverStorage({ namespace: "lifecycle-test" });
  const sourceCover = await storage.upload({ setId: sourceId, buffer: Buffer.from("source") });
  const source = aggregate({ id: sourceId, cover_image_url: sourceCover.url, cover_storage_key: sourceCover.key });
  const repository = repositoryFor(source, { createError: Object.assign(new Error("db"), { code: "DB_FAIL" }) });
  const service = serviceFor(repository, storage);
  await assert.rejects(service.copySystemSet(ownerId, sourceId), /db/);
  assert.equal(storage.objects.size, 1);
  assert.equal(storage.objects.has(sourceCover.key), true);
});

test("failed copy compensation exposes only deterministic orphan Set evidence", async () => {
  const storage = createFakeVocabularySetCoverStorage({ namespace: "lifecycle-test" });
  const sourceCover = await storage.upload({ setId: sourceId, buffer: Buffer.from("source") });
  const source = aggregate({ id: sourceId, cover_image_url: sourceCover.url, cover_storage_key: sourceCover.key });
  const repository = repositoryFor(source, { createError: new Error("db") });
  const service = serviceFor(repository, storage);
  storage.failNext("remove", "COVER_STORAGE_CLEANUP_FAILED");
  await assert.rejects(service.copySystemSet(ownerId, sourceId), (error) => {
    assert.equal(error.code, "COVER_STORAGE_CLEANUP_FAILED");
    assert.match(error.details.orphan_set_id, /^[0-9a-f-]{36}$/i);
    assert.equal(error.message.includes("db"), false);
    return true;
  });
});

test("Set deletion cleans managed prefix first and preserves the row when cleanup fails", async () => {
  const storage = createFakeVocabularySetCoverStorage({ namespace: "lifecycle-test" });
  const cover = await storage.upload({ setId: sourceId, buffer: Buffer.from("source") });
  const source = aggregate({ id: sourceId, cover_image_url: cover.url, cover_storage_key: cover.key });
  const repository = repositoryFor(source);
  const service = serviceFor(repository, storage);
  storage.failNext("remove", "COVER_STORAGE_CLEANUP_FAILED");
  await assert.rejects(service.deleteSystemSet(sourceId), (error) => error.code === "COVER_STORAGE_CLEANUP_FAILED");
  assert.equal(repository.deleted, false);
  await service.deleteSystemSet(sourceId);
  assert.equal(repository.deleted, true);
  assert.equal(storage.objects.size, 0);
});

function serviceFor(repository, coverStorage) {
  return createVocabularySetService({
    vocabularySetRepository: repository,
    coverStorage,
    coverImageProcessor: { async process({ buffer }) { return { buffer }; } },
  });
}

function repositoryFor(source, options = {}) {
  return {
    deleted: false,
    async findPublicSystemById(id) { return id === source.id ? source : null; },
    async findCanonicalVocabularyIds(ids) { return ids; },
    async updateCoverMetadata() { if (options.updateCoverError) throw options.updateCoverError; },
    async createPrivate(data) { if (options.createError) throw options.createError; return aggregate(data); },
    async deleteSystem() { this.deleted = true; },
    async withTransaction(callback) { return callback(this); },
  };
}

function aggregate(overrides = {}) {
  return {
    id: randomUUID(), topic_id: randomUUID(), owner_id: ownerId, name: "Set", description: null,
    cefr_level: "A1", cover_image_url: null, cover_storage_key: null, is_public: true,
    created_at: new Date(), items: [], ...overrides,
  };
}

function file() { return { buffer: Buffer.from("image"), mimetype: "image/webp" }; }
