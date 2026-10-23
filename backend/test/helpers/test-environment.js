const RESET_FLAG = "true";
const CI_EXCLUSIVE_TARGET_CLASS = "CI_EXCLUSIVE";
const SAFE_TARGET_IDENTITY = /^[A-Za-z0-9][A-Za-z0-9_.:/-]{2,255}$/;
const PROHIBITED_TARGET_SEGMENT = /(?:^|[._:/-])(preview|production|prod|main|development|dev|shared|manual)(?:$|[._:/-])/i;
export const DAILY_GOAL_APPROVED_OBSERVER_USERNAME = "elvocab_daily_goal_observer.fmosmonrivuoacjfbmov";

export const CI_DATABASE_OPERATIONS = Object.freeze({
  OBSERVATION: "observation",
  MIGRATION: "migration",
  RESET: "reset",
  STATE_CHANGE: "state-change",
});

const OPERATION_AUTHORIZATION = Object.freeze({
  [CI_DATABASE_OPERATIONS.OBSERVATION]: "DAILY_GOAL_OBSERVATION_ALLOW",
  [CI_DATABASE_OPERATIONS.MIGRATION]: "DAILY_GOAL_MIGRATION_ALLOW",
  [CI_DATABASE_OPERATIONS.RESET]: "DAILY_GOAL_RESET_ALLOW",
  [CI_DATABASE_OPERATIONS.STATE_CHANGE]: "DAILY_GOAL_STATE_CHANGE_ALLOW",
});

export function assertCiExclusiveDatabaseAuthorization(
  environment,
  { operation },
) {
  if (environment?.CI !== "true" || environment?.GITHUB_ACTIONS !== "true") {
    throw unsafeDatabaseConfiguration("CI-exclusive execution context is required.");
  }
  if (!Object.hasOwn(OPERATION_AUTHORIZATION, operation)) {
    throw unsafeDatabaseConfiguration("A supported database operation is required.");
  }
  if (environment.NODE_ENV !== "test") {
    throw unsafeDatabaseConfiguration("NODE_ENV must be set to test.");
  }
  if (environment.DAILY_GOAL_DATABASE_TARGET_CLASS !== CI_EXCLUSIVE_TARGET_CLASS) {
    throw unsafeDatabaseConfiguration("The database target must be explicitly CI-exclusive.");
  }

  const unexpectedRuntimeUrl = environment.DATABASE_URL;
  const unexpectedLegacyTestUrl = environment.TEST_DATABASE_URL;
  if (hasValue(unexpectedRuntimeUrl) || hasValue(unexpectedLegacyTestUrl)) {
    throw unsafeDatabaseConfiguration(
      "Runtime and legacy test database URLs must be unset before guarded configuration.",
    );
  }

  const databaseUrl = operation === CI_DATABASE_OPERATIONS.OBSERVATION
    ? environment.DAILY_GOAL_OBSERVER_DATABASE_URL
    : environment.CI_TEST_DATABASE_URL;
  if (!hasValue(databaseUrl)) {
    throw unsafeDatabaseConfiguration(
      operation === CI_DATABASE_OPERATIONS.OBSERVATION
        ? "DAILY_GOAL_OBSERVER_DATABASE_URL is required."
        : "CI_TEST_DATABASE_URL is required.",
    );
  }
  if (operation === CI_DATABASE_OPERATIONS.OBSERVATION
    && hasValue(environment.CI_TEST_DATABASE_URL)
    && databaseUrl === environment.CI_TEST_DATABASE_URL) {
    throw unsafeDatabaseConfiguration("Observation requires a dedicated database credential.");
  }
  const databaseUrlName = operation === CI_DATABASE_OPERATIONS.OBSERVATION
    ? "DAILY_GOAL_OBSERVER_DATABASE_URL"
    : "CI_TEST_DATABASE_URL";
  const parsedUrl = parsePostgresUrl(databaseUrl, databaseUrlName);
  if (operation === CI_DATABASE_OPERATIONS.OBSERVATION) {
    assertApprovedObserverPrincipal(parsedUrl);
  }
  const actualIdentity = databaseIdentity(parsedUrl);
  const configuredIdentity = environment.CI_TEST_DATABASE_IDENTITY ?? "";
  const approvedIdentity = environment.DAILY_GOAL_APPROVED_TARGET_IDENTITY ?? "";
  if (
    !SAFE_TARGET_IDENTITY.test(configuredIdentity)
    || configuredIdentity !== approvedIdentity
    || configuredIdentity !== actualIdentity
  ) {
    throw unsafeDatabaseConfiguration("Database target identity is not authorized.");
  }
  if (PROHIBITED_TARGET_SEGMENT.test(actualIdentity)) {
    throw unsafeDatabaseConfiguration("The selected database target is prohibited.");
  }

  const expectedAuthorization = OPERATION_AUTHORIZATION[operation];
  for (const authorization of Object.values(OPERATION_AUTHORIZATION)) {
    const value = environment[authorization];
    if (authorization === expectedAuthorization) {
      if (value !== RESET_FLAG) {
        throw unsafeDatabaseConfiguration("The requested database operation is not authorized.");
      }
    } else if (value !== undefined) {
      throw unsafeDatabaseConfiguration("Ambiguous database operation authorization is prohibited.");
    }
  }

  return Object.freeze({
    databaseUrl,
    targetIdentity: actualIdentity,
    operation,
  });
}

export function assertConnectedDatabaseIdentity(authorization, observation) {
  const authorizedIdentity = authorization?.targetIdentity;
  const observedIdentity = observation?.targetIdentity;
  if (
    !SAFE_TARGET_IDENTITY.test(authorizedIdentity ?? "")
    || !SAFE_TARGET_IDENTITY.test(observedIdentity ?? "")
    || observedIdentity !== authorizedIdentity
    || PROHIBITED_TARGET_SEGMENT.test(observedIdentity)
  ) {
    throw unsafeDatabaseConfiguration(
      "The connected database identity does not match the authorized target.",
    );
  }
  return observedIdentity;
}

function hasValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function parsePostgresUrl(value, name = "CI_TEST_DATABASE_URL") {
  let parsedUrl;
  try {
    parsedUrl = new URL(value);
  } catch {
    throw unsafeDatabaseConfiguration(`${name} is invalid.`);
  }
  if (parsedUrl.protocol !== "postgresql:" && parsedUrl.protocol !== "postgres:") {
    throw unsafeDatabaseConfiguration(`${name} must use PostgreSQL.`);
  }
  if (!parsedUrl.hostname || !parsedUrl.pathname || parsedUrl.pathname === "/") {
    throw unsafeDatabaseConfiguration(`${name} has no database identity.`);
  }
  return parsedUrl;
}

function databaseIdentity(parsedUrl) {
  return `${parsedUrl.hostname.toLowerCase()}:${parsedUrl.port || "5432"}${parsedUrl.pathname}`;
}

function assertApprovedObserverPrincipal(parsedUrl) {
  let username;
  try {
    username = decodeURIComponent(parsedUrl.username);
  } catch {
    throw unsafeDatabaseConfiguration("Observation requires the approved dedicated observer principal.");
  }
  if (username !== DAILY_GOAL_APPROVED_OBSERVER_USERNAME) {
    throw unsafeDatabaseConfiguration("Observation requires the approved dedicated observer principal.");
  }
}

function unsafeDatabaseConfiguration(message) {
  return new TestEnvironmentError(message);
}

export function configureTestEnvironment({ requireReset = true } = {}) {
  if (process.env.NODE_ENV !== "test") {
    throw new TestEnvironmentError("NODE_ENV must be set to test.");
  }

  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  if (typeof testDatabaseUrl !== "string" || testDatabaseUrl.length === 0) {
    throw new TestEnvironmentError(
      "TEST_DATABASE_URL must reference a dedicated test database.",
    );
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(testDatabaseUrl);
  } catch {
    throw new TestEnvironmentError("TEST_DATABASE_URL is not a valid URL.");
  }

  if (!parsedUrl.protocol.startsWith("postgres")) {
    throw new TestEnvironmentError("TEST_DATABASE_URL must use PostgreSQL.");
  }

  if (
    requireReset &&
    process.env.TEST_DATABASE_ALLOW_RESET !== RESET_FLAG
  ) {
    throw new TestEnvironmentError(
      "TEST_DATABASE_ALLOW_RESET must be explicitly set to true.",
    );
  }

  process.env.DATABASE_URL = testDatabaseUrl;
  return { databaseUrl: testDatabaseUrl };
}

export function redactDatabaseUrl(value) {
  if (typeof value !== "string" || value.length === 0) {
    return "<not-configured>";
  }

  return "<redacted-test-database-url>";
}

export function configureTestStorageEnvironment() {
  if (process.env.NODE_ENV !== "test") {
    throw new TestEnvironmentError("NODE_ENV must be set to test.");
  }
  const mappings = [
    ["TEST_SUPABASE_URL", "SUPABASE_URL"],
    ["TEST_SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
    ["TEST_SUPABASE_VOCABULARY_SET_COVERS_BUCKET", "SUPABASE_VOCABULARY_SET_COVERS_BUCKET"],
    ["TEST_SUPABASE_STORAGE_NAMESPACE", "SUPABASE_STORAGE_NAMESPACE"],
  ];
  const mapped = {};
  for (const [testName, runtimeName] of mappings) {
    const value = process.env[testName];
    if (typeof value !== "string" || value.trim().length === 0 || (process.env[runtimeName] && process.env[runtimeName] === value)) {
      throw new TestEnvironmentError(`${testName} must reference dedicated TEST Storage.`);
    }
    mapped[runtimeName] = value;
  }
  if (!mapped.SUPABASE_VOCABULARY_SET_COVERS_BUCKET.toLowerCase().includes("test")
    || !mapped.SUPABASE_STORAGE_NAMESPACE.toLowerCase().includes("test")) {
    throw new TestEnvironmentError("TEST Storage bucket and namespace must be explicitly test-scoped.");
  }
  Object.assign(process.env, mapped);
  return Object.freeze(mapped);
}

export class TestEnvironmentError extends Error {
  constructor(message) {
    super(message);
    this.name = "TestEnvironmentError";
    this.code = "UNSAFE_TEST_DATABASE_CONFIGURATION";
  }
}
