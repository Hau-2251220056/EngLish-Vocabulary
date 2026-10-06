import { PERFORMANCE_ARTIFACT_VERSION } from "./performance-config.js";

const SENSITIVE_KEY = /(authorization|cookie|password|secret|token|session|database.?url)/i;
const URL_CREDENTIALS = /postgres(?:ql)?:\/\/[^\s"']+/gi;

export function normalizeRequestUrl(rawUrl, baseUrl) {
  const url = new URL(rawUrl, baseUrl);
  const entries = [...url.searchParams.entries()]
    .filter(([key]) => !SENSITIVE_KEY.test(key))
    .sort(([left], [right]) => left.localeCompare(right));
  url.search = "";
  for (const [key, value] of entries) url.searchParams.append(key, value);
  return `${url.pathname}${url.search}`;
}

export function requestIdentity({ method, url }) {
  return `${method.toUpperCase()} ${url}`;
}

export function findDuplicateRequests(requests) {
  const counts = new Map();
  for (const request of requests) {
    const identity = requestIdentity(request);
    counts.set(identity, (counts.get(identity) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([identity, count]) => ({ identity, count }));
}

export function scrubArtifact(value) {
  if (Array.isArray(value)) return value.map(scrubArtifact);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
      key,
      SENSITIVE_KEY.test(key) ? "<redacted>" : scrubArtifact(entry),
    ]));
  }
  if (typeof value !== "string") return value;
  return value.replace(URL_CREDENTIALS, "<redacted-database-url>");
}

export function assertArtifactIsSafe(value) {
  const serialized = JSON.stringify(value);
  if (URL_CREDENTIALS.test(serialized)) throw new Error("Artifact contains a database URL.");
  const parsed = JSON.parse(serialized);
  inspect(parsed);
}

export function createArtifact({ environment, samples }) {
  const artifact = scrubArtifact({
    artifact_version: PERFORMANCE_ARTIFACT_VERSION,
    environment,
    samples,
  });
  assertArtifactIsSafe(artifact);
  return artifact;
}

function inspect(value) {
  if (Array.isArray(value)) {
    value.forEach(inspect);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key) && entry !== "<redacted>") {
      throw new Error(`Artifact field ${key} is not redacted.`);
    }
    inspect(entry);
  }
}
