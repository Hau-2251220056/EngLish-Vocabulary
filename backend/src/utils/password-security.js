// @ts-nocheck
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

export const PASSWORD_MIN_LENGTH = 8;

const ALGORITHM = "scrypt";
const SALT_LENGTH_BYTES = 16;
const KEY_LENGTH_BYTES = 64;
const MAX_SCRYPT_MEMORY_BYTES = 64 * 1024 * 1024;

// N=2^15, r=8, p=1 was validated on Node.js v22.20.0 at about 32 MiB and 91 ms.
// The parameters are serialized with every hash so they can be raised later
// without making existing password hashes unverifiable.
export const SCRYPT_PARAMETERS = Object.freeze({
  N: 32_768,
  r: 8,
  p: 1,
  maxmem: MAX_SCRYPT_MEMORY_BYTES,
});

export class PasswordPolicyError extends Error {
  constructor() {
    super(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`);
    this.name = "PasswordPolicyError";
    this.code = "PASSWORD_POLICY_INVALID";
  }
}

export class PasswordHashFormatError extends Error {
  constructor() {
    super("Password hash has an invalid format.");
    this.name = "PasswordHashFormatError";
    this.code = "PASSWORD_HASH_INVALID";
  }
}

export function validatePasswordPolicy(password) {
  return typeof password === "string" && password.length >= PASSWORD_MIN_LENGTH;
}

export function assertPasswordPolicy(password) {
  if (!validatePasswordPolicy(password)) {
    throw new PasswordPolicyError();
  }
}

export function generateSalt() {
  return randomBytes(SALT_LENGTH_BYTES);
}

export function constantTimeEqual(expected, actual) {
  if (
    !Buffer.isBuffer(expected) ||
    !Buffer.isBuffer(actual) ||
    expected.length !== actual.length
  ) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

export async function hashPassword(password) {
  assertPasswordPolicy(password);

  const salt = generateSalt();
  const derivedKey = await deriveKey(
    password,
    salt,
    SCRYPT_PARAMETERS,
    KEY_LENGTH_BYTES,
  );

  return serializePasswordHash({
    algorithm: ALGORITHM,
    parameters: SCRYPT_PARAMETERS,
    salt,
    derivedKey,
  });
}

export async function verifyPassword(password, serializedHash) {
  if (typeof password !== "string") {
    return false;
  }

  const { parameters, salt, derivedKey } = parsePasswordHash(serializedHash);
  const derivedCandidate = await deriveKey(
    password,
    salt,
    parameters,
    derivedKey.length,
  );

  return constantTimeEqual(derivedKey, derivedCandidate);
}

export function serializePasswordHash({
  algorithm,
  parameters,
  salt,
  derivedKey,
}) {
  if (
    algorithm !== ALGORITHM ||
    !Buffer.isBuffer(salt) ||
    !Buffer.isBuffer(derivedKey)
  ) {
    throw new PasswordHashFormatError();
  }

  validateScryptParameters(parameters);

  if (salt.length < SALT_LENGTH_BYTES || derivedKey.length < 32) {
    throw new PasswordHashFormatError();
  }

  const parameterString = `N=${parameters.N},r=${parameters.r},p=${parameters.p}`;
  return `$${algorithm}$${parameterString}$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`;
}

export function parsePasswordHash(serializedHash) {
  if (typeof serializedHash !== "string") {
    throw new PasswordHashFormatError();
  }

  const parts = serializedHash.split("$");
  if (parts.length !== 5 || parts[0] !== "" || parts[1] !== ALGORITHM) {
    throw new PasswordHashFormatError();
  }

  const parameters = parseScryptParameters(parts[2]);
  const salt = decodeBase64Url(parts[3]);
  const derivedKey = decodeBase64Url(parts[4]);

  if (
    salt.length < SALT_LENGTH_BYTES ||
    salt.length > 64 ||
    derivedKey.length < 32 ||
    derivedKey.length > 128
  ) {
    throw new PasswordHashFormatError();
  }

  return { algorithm: ALGORITHM, parameters, salt, derivedKey };
}

function parseScryptParameters(value) {
  const match = /^N=(\d+),r=(\d+),p=(\d+)$/.exec(value);
  if (!match) {
    throw new PasswordHashFormatError();
  }

  const parameters = {
    N: Number(match[1]),
    r: Number(match[2]),
    p: Number(match[3]),
  };
  validateScryptParameters(parameters);
  return { ...parameters, maxmem: MAX_SCRYPT_MEMORY_BYTES };
}

function validateScryptParameters({ N, r, p }) {
  const isPowerOfTwo = Number.isSafeInteger(N) && N > 1 && (N & (N - 1)) === 0;
  const memoryRequired = 128 * N * r + 256 * r * p;

  if (
    !isPowerOfTwo ||
    !Number.isSafeInteger(r) ||
    r < 1 ||
    !Number.isSafeInteger(p) ||
    p < 1 ||
    p > 4 ||
    !Number.isSafeInteger(memoryRequired) ||
    memoryRequired > MAX_SCRYPT_MEMORY_BYTES
  ) {
    throw new PasswordHashFormatError();
  }
}

function decodeBase64Url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new PasswordHashFormatError();
  }

  const decoded = Buffer.from(value, "base64url");
  if (decoded.length === 0 || decoded.toString("base64url") !== value) {
    throw new PasswordHashFormatError();
  }

  return decoded;
}

function deriveKey(password, salt, parameters, keyLength) {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, parameters, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}
