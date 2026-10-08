const RESET_FLAG = "true";

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
