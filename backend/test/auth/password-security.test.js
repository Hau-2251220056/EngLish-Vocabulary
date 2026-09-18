import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import {
  PASSWORD_MIN_LENGTH,
  SCRYPT_PARAMETERS,
  assertPasswordPolicy,
  constantTimeEqual,
  hashPassword,
  parsePasswordHash,
  serializePasswordHash,
  validatePasswordPolicy,
  verifyPassword,
} from "../../src/utils/password-security.js";

test("password policy enforces the approved eight-character boundary", () => {
  assert.equal(PASSWORD_MIN_LENGTH, 8);
  assert.equal(validatePasswordPolicy("1234567"), false);
  assert.equal(validatePasswordPolicy("12345678"), true);
  assert.equal(validatePasswordPolicy(null), false);
  assert.throws(
    () => assertPasswordPolicy("1234567"),
    (error) => error?.code === "PASSWORD_POLICY_INVALID",
  );
});

test("scrypt hashes verify correctly and use independent salts", async () => {
  const password = "approved-password";
  const first = await hashPassword(password);
  const second = await hashPassword(password);

  assert.notEqual(first, second);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("wrong-password", first), false);
  assert.equal(await verifyPassword(null, first), false);

  const parsed = parsePasswordHash(first);
  assert.equal(parsed.algorithm, "scrypt");
  assert.equal(parsed.parameters.N, SCRYPT_PARAMETERS.N);
  assert.equal(parsed.parameters.r, SCRYPT_PARAMETERS.r);
  assert.equal(parsed.parameters.p, SCRYPT_PARAMETERS.p);
  assert.equal(parsed.salt.length >= 16, true);
  assert.equal(parsed.derivedKey.length, 64);
});

test("malformed or unsafe serialized password hashes are rejected", () => {
  const invalidHashes = [
    "$bcrypt$N=32768,r=8,p=1$YWJjZGVmZ2hpamtsbW5vcA$YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXo",
    "$scrypt$N=32768,r=8,p=1$only-four-parts",
    "$scrypt$N=32768,r=8,p=1$not+base64url$also_not_valid",
    "$scrypt$N=3,r=8,p=1$YWJjZGVmZ2hpamtsbW5vcA$YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXphYmNkZWY",
    "$scrypt$N=1048576,r=8,p=1$YWJjZGVmZ2hpamtsbW5vcA$YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXphYmNkZWY",
  ];

  for (const value of invalidHashes) {
    assert.throws(
      () => parsePasswordHash(value),
      (error) => error?.code === "PASSWORD_HASH_INVALID",
    );
  }

  assert.throws(
    () =>
      serializePasswordHash({
        algorithm: "scrypt",
        parameters: SCRYPT_PARAMETERS,
        salt: randomBytes(15),
        derivedKey: randomBytes(64),
      }),
    (error) => error?.code === "PASSWORD_HASH_INVALID",
  );
  assert.throws(
    () =>
      serializePasswordHash({
        algorithm: "scrypt",
        parameters: SCRYPT_PARAMETERS,
        salt: randomBytes(16),
        derivedKey: randomBytes(31),
      }),
    (error) => error?.code === "PASSWORD_HASH_INVALID",
  );
});

test("constant-time helper handles equality, mismatch, length, and type", () => {
  assert.equal(constantTimeEqual(Buffer.from("same"), Buffer.from("same")), true);
  assert.equal(constantTimeEqual(Buffer.from("same"), Buffer.from("diff")), false);
  assert.equal(constantTimeEqual(Buffer.from("short"), Buffer.from("longer")), false);
  assert.equal(constantTimeEqual("same", Buffer.from("same")), false);
});
