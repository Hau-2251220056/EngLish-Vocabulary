import { readSessionValue, removeSessionValue, writeSessionValue } from "../session-storage/resilient-session-store.js";

const VERSION = 1;
const PREFIX = "elvocab.learning-path-operation";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function runPathOperation({ storage, userId, setId, passId = null, kind, randomUuid, execute }) {
  if (typeof userId !== "string" || typeof setId !== "string" || typeof kind !== "string"
    || typeof randomUuid !== "function" || typeof execute !== "function") {
    throw new TypeError("Learning Path operation dependencies are invalid.");
  }
  const key = operationKey(userId, setId, passId, kind);
  let operation = readSessionValue(storage, key, (value) => isOperation(value, userId, setId, passId, kind));
  if (!operation) {
    const operationId = randomUuid();
    if (!UUID_PATTERN.test(operationId)) throw new TypeError("Learning Path operation identity is invalid.");
    operation = { version: VERSION, user_id: userId, set_id: setId, pass_id: passId, kind, operation_id: operationId };
    if (!writeSessionValue(storage, key, operation)) throw new TypeError("Learning Path operation identity could not be persisted.");
  }
  const result = await execute(operation.operation_id);
  removeSessionValue(storage, key);
  return result;
}

export function clearPathOperation(storage, { userId, setId, passId = null, kind }) {
  return removeSessionValue(storage, operationKey(userId, setId, passId, kind));
}

function operationKey(userId, setId, passId, kind) {
  return [PREFIX, `v${VERSION}`, encodeURIComponent(userId), encodeURIComponent(setId), passId ?? "set", kind].join(":");
}

function isOperation(value, userId, setId, passId, kind) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value)
    && value.version === VERSION && value.user_id === userId && value.set_id === setId
    && value.pass_id === passId && value.kind === kind && UUID_PATTERN.test(value.operation_id));
}
