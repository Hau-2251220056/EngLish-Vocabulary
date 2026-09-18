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

export class TestEnvironmentError extends Error {
  constructor(message) {
    super(message);
    this.name = "TestEnvironmentError";
    this.code = "UNSAFE_TEST_DATABASE_CONFIGURATION";
  }
}
