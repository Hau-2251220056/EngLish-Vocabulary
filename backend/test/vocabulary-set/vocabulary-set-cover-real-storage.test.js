import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { test } from "node:test";
import sharp from "sharp";
import { readVocabularySetCoverStorageConfig } from "../../src/config/vocabulary-set-cover-storage-config.js";
import { createVocabularySetCoverImageProcessor, MAX_COVER_INPUT_BYTES } from "../../src/images/vocabulary-set-cover-image-processor.js";
import { buildVocabularySetCoverPrefix, createVocabularySetCoverStorage } from "../../src/storage/vocabulary-set-cover-storage.js";
import { configureTestStorageEnvironment } from "../helpers/test-environment.js";

const REAL_PROBE_ENABLED = process.env.RUN_REAL_TEST_STORAGE_PROBE === "true";
const EXPECTED_TEST_BUCKET = "vocabulary-set-covers-test";

test("dedicated TEST Storage supports an isolated run-owned lifecycle", { skip: !REAL_PROBE_ENABLED }, async (context) => {
  const isolatedTestEnvironment = Object.freeze({
    TEST_SUPABASE_URL: process.env.TEST_SUPABASE_URL,
    TEST_SUPABASE_SERVICE_ROLE_KEY: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY,
    TEST_SUPABASE_VOCABULARY_SET_COVERS_BUCKET:
      process.env.TEST_SUPABASE_VOCABULARY_SET_COVERS_BUCKET,
    TEST_SUPABASE_STORAGE_NAMESPACE: process.env.TEST_SUPABASE_STORAGE_NAMESPACE,
  });
  const config = readVocabularySetCoverStorageConfig({
    env: isolatedTestEnvironment,
    test: true,
  });
  const mapped = configureTestStorageEnvironment();
  assert.equal(config.bucket, EXPECTED_TEST_BUCKET);
  assert.equal(config.namespace.toLowerCase().includes("test"), true);
  assert.equal(new URL(config.url).protocol, "https:");
  assert.equal(mapped.SUPABASE_URL, config.url);

  context.diagnostic(JSON.stringify({
    testStorage: {
      projectHostFingerprint: fingerprint(new URL(config.url).hostname),
      bucket: config.bucket,
      namespaceFingerprint: fingerprint(config.namespace),
      namespaceTestIdentifiable: true,
    },
  }));

  const sourceSetId = randomUUID();
  const destinationSetId = randomUUID();
  const markerSetId = randomUUID();
  const measurementSetId = randomUUID();
  const objectIds = [randomUUID(), randomUUID(), randomUUID()];
  const expectedSourceKey = `${buildVocabularySetCoverPrefix(config.namespace, sourceSetId)}${objectIds[0]}.webp`;
  const expectedMarkerKey = `${buildVocabularySetCoverPrefix(config.namespace, markerSetId)}${objectIds[1]}.webp`;
  const expectedDestinationKey = `${buildVocabularySetCoverPrefix(config.namespace, destinationSetId)}${objectIds[2]}.webp`;
  const storage = createVocabularySetCoverStorage({
    env: isolatedTestEnvironment,
    test: true,
    uuid: () => objectIds.shift() ?? randomUUID(),
  });
  const probeBytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#4ca2e6" } }).webp({ quality: 82 }).toBuffer();
  const markerBytes = await sharp({ create: { width: 1, height: 1, channels: 3, background: "#7ed321" } }).webp({ quality: 82 }).toBuffer();

  let source;
  let destination;
  let marker;
  try {
    assert.deepEqual(await runOwnedCounts(storage, [sourceSetId, destinationSetId, markerSetId]), [0, 0, 0]);

    source = await storage.upload({ setId: sourceSetId, buffer: probeBytes });
    assert.equal(source.key, expectedSourceKey);
    assert.equal(await readPublicObject(source.url, probeBytes), true);

    marker = await storage.upload({ setId: markerSetId, buffer: markerBytes });
    assert.equal(marker.key, expectedMarkerKey);
    assert.equal(await readPublicObject(marker.url, markerBytes), true);

    destination = await storage.copy({ sourceSetId, sourceKey: source.key, destinationSetId });
    assert.equal(destination.key, expectedDestinationKey);
    assert.equal(await readPublicObject(destination.url, probeBytes), true);
    assert.deepEqual(await runOwnedCounts(storage, [sourceSetId, destinationSetId, markerSetId]), [1, 1, 1]);

    await assert.rejects(() => storage.removeObject({ setId: destinationSetId, key: source.key }), { code: "VALIDATION_ERROR" });
    await assert.rejects(() => storage.removeObject({
      setId: sourceSetId,
      key: `foreign-test/vocabulary-sets/${sourceSetId}/${randomUUID()}.webp`,
    }), { code: "VALIDATION_ERROR" });

    await storage.removeObject({ setId: sourceSetId, key: source.key });
    await storage.removeObject({ setId: destinationSetId, key: destination.key });
    assert.deepEqual(await runOwnedCounts(storage, [sourceSetId, destinationSetId]), [0, 0]);

    await storage.removeSetObjects({ setId: sourceSetId });
    await storage.removeSetObjects({ setId: destinationSetId });
    await storage.removeSetObjects({ setId: sourceSetId });
    await storage.removeSetObjects({ setId: destinationSetId });
    assert.deepEqual(await runOwnedCounts(storage, [sourceSetId, destinationSetId]), [0, 0]);
    assert.deepEqual(await storage.listSetObjects(markerSetId), [marker.key]);
    assert.equal(await readPublicObject(marker.url, markerBytes), true);

    const measurements = await measureRepresentativeUploads({
      storage,
      setId: measurementSetId,
    });
    assert.equal(measurements.length, 5);
    assert.equal((await storage.listSetObjects(measurementSetId)).length, 6);
    context.diagnostic(JSON.stringify({ representativeUploads: measurements }));

    await storage.removeSetObjects({ setId: measurementSetId });
    await storage.removeSetObjects({ setId: measurementSetId });
    assert.deepEqual(await storage.listSetObjects(measurementSetId), []);
    assert.deepEqual(await storage.listSetObjects(markerSetId), [marker.key]);
    assert.equal(await readPublicObject(marker.url, markerBytes), true);

    await storage.removeObject({ setId: markerSetId, key: marker.key });
    assert.deepEqual(
      await runOwnedCounts(storage, [sourceSetId, destinationSetId, markerSetId, measurementSetId]),
      [0, 0, 0, 0],
    );
  } finally {
    await Promise.allSettled([
      storage.removeSetObjects({ setId: sourceSetId }),
      storage.removeSetObjects({ setId: destinationSetId }),
      storage.removeSetObjects({ setId: markerSetId }),
      storage.removeSetObjects({ setId: measurementSetId }),
    ]);
  }
});

async function measureRepresentativeUploads({ storage, setId }) {
  const width = 2400;
  const height = 1600;
  const pixels = Buffer.allocUnsafe(width * height * 3);
  for (let index = 0; index < pixels.length; index += 3) {
    const pixel = index / 3;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    pixels[index] = (x * 13 + y * 7) % 256;
    pixels[index + 1] = (x * 3 + y * 17) % 256;
    pixels[index + 2] = (x * 11 + y * 5) % 256;
  }
  const input = await sharp(pixels, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 90 })
    .toBuffer();
  assert.equal(input.length <= MAX_COVER_INPUT_BYTES, true);
  const processor = createVocabularySetCoverImageProcessor();
  const measurements = [];

  for (let sample = 0; sample < 6; sample += 1) {
    const processStart = performance.now();
    const output = await processor.process({ buffer: input, mimetype: "image/jpeg" });
    const processMs = performance.now() - processStart;
    assert.equal(output.mimetype, "image/webp");
    assert.equal(Math.max(output.width, output.height), 1600);

    const uploadStart = performance.now();
    const uploaded = await storage.upload({ setId, buffer: output.buffer });
    const remoteUploadMs = performance.now() - uploadStart;

    const publicReadStart = performance.now();
    assert.equal(await readPublicObject(uploaded.url, output.buffer), true);
    const publicReadMs = performance.now() - publicReadStart;

    if (sample > 0) {
      measurements.push({
        sample,
        inputBytes: input.length,
        outputBytes: output.buffer.length,
        processMs: rounded(processMs),
        remoteUploadMs: rounded(remoteUploadMs),
        publicReadMs: rounded(publicReadMs),
      });
    }
  }

  return measurements;
}

async function runOwnedCounts(storage, setIds) {
  return Promise.all(setIds.map(async (setId) => (await storage.listSetObjects(setId)).length));
}

async function readPublicObject(url, expected) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return false;
  const actual = Buffer.from(await response.arrayBuffer());
  return actual.equals(expected);
}

function fingerprint(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function rounded(value) {
  return Math.round(value * 100) / 100;
}
