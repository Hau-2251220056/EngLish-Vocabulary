import assert from "node:assert/strict";
import test from "node:test";
import {
  assertArtifactIsSafe,
  createArtifact,
  findDuplicateRequests,
  normalizeRequestUrl,
} from "../performance/measurement.js";

test("normalizes request paths, removes sensitive query fields and finds duplicates", () => {
  const url = normalizeRequestUrl(
    "http://127.0.0.1/api/topics?token=secret&page=2&status=active",
  );
  assert.equal(url, "/api/topics?page=2&status=active");
  assert.deepEqual(findDuplicateRequests([
    { method: "GET", url },
    { method: "GET", url },
    { method: "POST", url },
  ]), [{ identity: "GET /api/topics?page=2&status=active", count: 2 }]);
});

test("scrubs sensitive fields and database URLs before artifact persistence", () => {
  const artifact = createArtifact({
    environment: { database_url: "postgresql://user:password@example.test/db" },
    samples: [{ cookie: "session_id=unsafe", note: "postgres://u:p@example.test/db" }],
  });
  assert.equal(artifact.environment.database_url, "<redacted>");
  assert.equal(artifact.samples[0].cookie, "<redacted>");
  assert.equal(artifact.samples[0].note, "<redacted-database-url>");
  assert.doesNotThrow(() => assertArtifactIsSafe(artifact));
});
