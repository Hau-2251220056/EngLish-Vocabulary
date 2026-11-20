import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import sharp from "sharp";
import { readVocabularySetCoverStorageConfig } from "../../src/config/vocabulary-set-cover-storage-config.js";
import { createVocabularySetCoverImageProcessor, MAX_COVER_INPUT_BYTES } from "../../src/images/vocabulary-set-cover-image-processor.js";
import { createVocabularySetCoverStorage } from "../../src/storage/vocabulary-set-cover-storage.js";
import { createFakeVocabularySetCoverStorage } from "../helpers/fake-vocabulary-set-cover-storage.js";

const setId = "10000000-0000-4000-8000-000000000010";
const otherSetId = "10000000-0000-4000-8000-000000000011";
const objectId = "10000000-0000-4000-8000-000000000012";

test("TEST Storage config fails closed and never falls back to ordinary values", () => {
  assert.throws(() => readVocabularySetCoverStorageConfig({ env: {}, test: true }), { code: "COVER_STORAGE_UNAVAILABLE" });
  const env = testEnv();
  assert.equal(readVocabularySetCoverStorageConfig({ env, test: true }).namespace, "unit-test");
  assert.throws(() => readVocabularySetCoverStorageConfig({
    env: { ...env, SUPABASE_URL: env.TEST_SUPABASE_URL }, test: true,
  }), { code: "COVER_STORAGE_UNAVAILABLE" });
});

test("every invalid TEST Storage configuration fails before provider client construction", async () => {
  const valid = testEnv();
  const testNames = Object.keys(valid);
  const ordinaryNames = testNames.map((name) => name.slice("TEST_".length));
  const invalidEnvironments = [];

  for (const name of testNames) {
    const missing = { ...valid };
    delete missing[name];
    invalidEnvironments.push(missing, { ...valid, [name]: "   " });
  }
  invalidEnvironments.push(Object.fromEntries(ordinaryNames.map((name, index) => [name, valid[testNames[index]]])));
  for (let index = 0; index < testNames.length; index += 1) {
    invalidEnvironments.push({ ...valid, [ordinaryNames[index]]: valid[testNames[index]] });
  }
  invalidEnvironments.push(
    { ...valid, TEST_SUPABASE_VOCABULARY_SET_COVERS_BUCKET: "covers" },
    { ...valid, TEST_SUPABASE_STORAGE_NAMESPACE: "preview" },
  );

  for (const env of invalidEnvironments) {
    let clientConstructions = 0;
    const storage = createVocabularySetCoverStorage({
      env,
      test: true,
      clientFactory: () => {
        clientConstructions += 1;
        throw new Error("Provider client must not be constructed.");
      },
    });
    await assert.rejects(() => storage.upload({ setId, buffer: Buffer.from("webp") }), {
      code: "COVER_STORAGE_UNAVAILABLE",
    });
    assert.equal(clientConstructions, 0);
  }
});

test("Storage adapter generates owned keys, uses upsert false, and redacts provider failures", async () => {
  const provider = createProviderFake();
  const storage = createVocabularySetCoverStorage({
    env: testEnv(), test: true, uuid: () => objectId, clientFactory: () => provider.client,
  });
  const uploaded = await storage.upload({ setId, buffer: Buffer.from("webp") });
  assert.equal(uploaded.key, `unit-test/vocabulary-sets/${setId}/${objectId}.webp`);
  assert.deepEqual(provider.uploadOptions, { contentType: "image/webp", upsert: false });
  assert.match(uploaded.url, /^https:\/\/storage\.example\.test\//);
  await assert.rejects(() => storage.removeObject({ setId: otherSetId, key: uploaded.key }), { code: "VALIDATION_ERROR" });
  await assert.rejects(() => storage.removeObject({ setId, key: `unit-test/vocabulary-sets/${setId}/../foreign.webp` }), { code: "VALIDATION_ERROR" });
  provider.failUpload = true;
  await assert.rejects(async () => {
    try { await storage.upload({ setId, buffer: Buffer.from("webp") }); }
    catch (error) {
      assert.equal(error.message.includes("provider-secret"), false);
      throw error;
    }
  }, { code: "COVER_STORAGE_FAILED" });
});

test("deterministic fake uploads, copies, lists, and removes exact Set-owned objects", async () => {
  const ids = [objectId, randomUUID()];
  const storage = createFakeVocabularySetCoverStorage({ namespace: "unit-test", uuid: () => ids.shift() });
  const source = await storage.upload({ setId, buffer: Buffer.from("source") });
  const copied = await storage.copy({ sourceSetId: setId, sourceKey: source.key, destinationSetId: otherSetId });
  assert.deepEqual(await storage.listSetObjects(setId), [source.key]);
  assert.deepEqual(storage.objects.get(copied.key), Buffer.from("source"));
  await storage.removeSetObjects({ setId, exceptKey: source.key });
  assert.equal(storage.objects.has(source.key), true);
  await storage.removeObject({ setId, key: source.key });
  assert.equal(storage.objects.has(source.key), false);
});

test("processor accepts JPEG, PNG, and WebP and emits bounded metadata-free WebP", async () => {
  const processor = createVocabularySetCoverImageProcessor();
  for (const [format, mimetype] of [["jpeg", "image/jpeg"], ["png", "image/png"], ["webp", "image/webp"]]) {
    const input = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: "#abcdef" } })[format]().toBuffer();
    const result = await processor.process({ buffer: input, mimetype });
    const metadata = await sharp(result.buffer).metadata();
    assert.equal(result.mimetype, "image/webp");
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 1600);
    assert.equal(metadata.height, 800);
    assert.equal(metadata.exif, undefined);
  }
  const small = await sharp({ create: { width: 20, height: 10, channels: 3, background: "#fff" } }).png().toBuffer();
  const result = await processor.process({ buffer: small, mimetype: "image/png" });
  assert.deepEqual([result.width, result.height], [20, 10]);
  const oriented = await sharp({ create: { width: 10, height: 20, channels: 3, background: "#fff" } })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
  const orientedResult = await processor.process({ buffer: oriented, mimetype: "image/jpeg" });
  const orientedMetadata = await sharp(orientedResult.buffer).metadata();
  assert.deepEqual([orientedMetadata.width, orientedMetadata.height], [20, 10]);
  assert.equal(orientedMetadata.orientation, undefined);
  assert.equal(orientedMetadata.exif, undefined);
});

test("processor rejects mismatches, unsupported, malformed, oversized, over-dimension, and animated inputs", async () => {
  const processor = createVocabularySetCoverImageProcessor();
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#fff" } }).png().toBuffer();
  await assert.rejects(() => processor.process({ buffer: png, mimetype: "image/jpeg" }), { code: "UNSUPPORTED_COVER_MEDIA_TYPE" });
  await assert.rejects(() => processor.process({ buffer: Buffer.from("<svg></svg>"), mimetype: "image/svg+xml" }), { code: "UNSUPPORTED_COVER_MEDIA_TYPE" });
  await assert.rejects(() => processor.process({ buffer: Buffer.from("GIF89a"), mimetype: "image/gif" }), { code: "UNSUPPORTED_COVER_MEDIA_TYPE" });
  await assert.rejects(() => processor.process({ buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]), mimetype: "image/jpeg" }), { code: "VALIDATION_ERROR" });
  await assert.rejects(() => processor.process({ buffer: Buffer.alloc(MAX_COVER_INPUT_BYTES + 1), mimetype: "image/png" }), { code: "COVER_FILE_TOO_LARGE" });
  const overDimension = await sharp({ create: { width: 4097, height: 1, channels: 3, background: "#fff" } }).png().toBuffer();
  await assert.rejects(() => processor.process({ buffer: overDimension, mimetype: "image/png" }), { code: "VALIDATION_ERROR" });
  const webpSignature = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]);
  const multipage = createVocabularySetCoverImageProcessor({ sharpFactory: () => ({
    metadata: async () => ({ format: "webp", width: 2, height: 2, pages: 2 }),
  }) });
  await assert.rejects(() => multipage.process({ buffer: webpSignature, mimetype: "image/webp" }), { code: "VALIDATION_ERROR" });
});

test("processor enforces queue and deadline bounds deterministically", async () => {
  const input = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]);
  const slowFactory = () => ({
    metadata: async () => ({ format: "webp", width: 1, height: 1, pages: 1 }),
    rotate() { return this; }, resize() { return this; }, webp() { return this; },
    async toBuffer() { await new Promise((resolve) => setTimeout(resolve, 30)); return input; },
  });
  const processor = createVocabularySetCoverImageProcessor({ sharpFactory: slowFactory, maxConcurrent: 1, maxQueue: 1, deadlineMs: 100 });
  const first = processor.process({ buffer: input, mimetype: "image/webp" });
  const second = processor.process({ buffer: input, mimetype: "image/webp" });
  await assert.rejects(() => processor.process({ buffer: input, mimetype: "image/webp" }), { code: "COVER_PROCESSING_BUSY" });
  await Promise.all([first, second]);
  const timeout = createVocabularySetCoverImageProcessor({ sharpFactory: slowFactory, maxConcurrent: 1, maxQueue: 0, deadlineMs: 1 });
  await assert.rejects(() => timeout.process({ buffer: input, mimetype: "image/webp" }), { code: "COVER_PROCESSING_TIMEOUT" });
});

function testEnv() {
  return {
    TEST_SUPABASE_URL: "https://unit-test.supabase.co",
    TEST_SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
    TEST_SUPABASE_VOCABULARY_SET_COVERS_BUCKET: "covers-test",
    TEST_SUPABASE_STORAGE_NAMESPACE: "unit-test",
  };
}

function createProviderFake() {
  const state = { uploadOptions: null, failUpload: false };
  const bucket = {
    async upload(_key, _buffer, options) {
      state.uploadOptions = options;
      return state.failUpload ? { error: new Error("provider-secret") } : { error: null };
    },
    async copy() { return { error: null }; },
    async list() { return { data: [], error: null }; },
    async remove() { return { error: null }; },
    getPublicUrl(key) { return { data: { publicUrl: `https://storage.example.test/${key}` } }; },
  };
  state.client = { storage: { from: () => bucket } };
  return state;
}
