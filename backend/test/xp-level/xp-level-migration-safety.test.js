import assert from "node:assert/strict";
import test from "node:test";
import {
  assertMatchingOwnership,
  assertRunIdentity,
  assertSafeSchemaName,
  buildOwnership,
  buildSchemaName,
  createAndRegisterOwnedSchema,
  decodeOwnershipMarker,
  discoveryLikePattern,
  encodeOwnershipMarker,
} from "./xp-level-migration-safety.js";

const identity = Object.freeze({
  repository: "Hau-2251220056/EngLish-Vocabulary",
  runId: "123456",
  attempt: "2",
});

test("schema names and ownership markers round-trip exactly", () => {
  const schemaName = buildSchemaName("clean", identity.runId, identity.attempt, "deadbeef");
  const ownership = buildOwnership({ ...identity, schemaName });
  const marker = encodeOwnershipMarker(ownership);

  assert.deepEqual(decodeOwnershipMarker(marker), ownership);
  assert.deepEqual(assertMatchingOwnership(marker, ownership), ownership);
  assert.equal(
    discoveryLikePattern(identity.runId, identity.attempt),
    "elvocab\\_xp\\_%\\_123456\\_2\\_%",
  );
});

test("repository and Learning verification schemas use the same owned run identity", () => {
  for (const purpose of ["repository", "learning"]) {
    const schemaName = buildSchemaName(
      purpose,
      identity.runId,
      identity.attempt,
      "cafebabe",
    );
    const ownership = buildOwnership({ ...identity, schemaName });

    assert.equal(assertSafeSchemaName(schemaName), schemaName);
    assert.deepEqual(
      decodeOwnershipMarker(encodeOwnershipMarker(ownership)),
      ownership,
    );
  }
});

test("public, malformed and different-run ownership are rejected", () => {
  assert.throws(() => assertSafeSchemaName("public"));
  assert.throws(() => assertSafeSchemaName("elvocab_xp_clean_123_2_not-hex"));
  assert.throws(() =>
    assertRunIdentity({ repository: "invalid", runId: "123", attempt: "1" }),
  );

  const schemaName = buildSchemaName("clean", identity.runId, identity.attempt, "deadbeef");
  const ownership = buildOwnership({ ...identity, schemaName });
  assert.throws(() =>
    buildOwnership({ ...identity, runId: "654321", schemaName }),
  );
  assert.throws(() => assertMatchingOwnership("unowned", ownership));
});

test("name collision never registers ownership", async () => {
  const schemaName = buildSchemaName("clean", identity.runId, identity.attempt, "deadbeef");
  const ownership = buildOwnership({ ...identity, schemaName });
  const registered = [];

  await assert.rejects(
    createAndRegisterOwnedSchema({
      schemaName,
      ownership,
      create: async () => {
        throw new Error("schema already exists");
      },
      register: (name) => registered.push(name),
      assertActive: async () => {},
    }),
  );
  assert.deepEqual(registered, []);
});

test("successful creation registers before active check or later disconnect failure", async () => {
  const schemaName = buildSchemaName("clean", identity.runId, identity.attempt, "deadbeef");
  const ownership = buildOwnership({ ...identity, schemaName });
  const events = [];

  await createAndRegisterOwnedSchema({
    schemaName,
    ownership,
    create: async () => events.push("created"),
    register: () => events.push("registered"),
    assertActive: async () => events.push("active"),
  });
  events.push("disconnect-failed");

  assert.deepEqual(events, [
    "created",
    "registered",
    "active",
    "disconnect-failed",
  ]);
});
