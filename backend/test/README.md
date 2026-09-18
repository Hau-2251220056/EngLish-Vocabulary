# Backend Authentication Tests

The backend test suite uses Node.js 22 built-ins (`node:test`,
`node:assert/strict`, and native `fetch`). It does not use a third-party test
framework or HTTP client.

## Safety prerequisites

Database-backed tests delete Authentication test data. They must only run
against a dedicated PostgreSQL test database.

Set these variables outside source control:

```text
NODE_ENV=test
TEST_DATABASE_URL=<dedicated PostgreSQL test database URL>
TEST_DATABASE_ALLOW_RESET=true
```

The suite never falls back to the development `DATABASE_URL`. It maps the
verified `TEST_DATABASE_URL` into the test process only. Missing or unsafe
configuration fails before migration, reset, or delete operations. Database
URLs and credentials must not be printed in reports.

The database must already exist. Preparation applies the repository's existing
migrations; it does not create a database, schema, or migration.

## Commands

From `backend/`:

```text
npm run test:db:prepare
npm run test:auth
npm test
```

Authentication tests run sequentially. Cleanup deletes `AUTH_SESSION` records
before `USER` records to respect the foreign key. A repeatability check runs
`npm run test:auth` twice against the same dedicated test database.

## Result meanings

- PASS: a runnable assertion completed successfully.
- FAIL: an assertion, setup, safety guard, or cleanup failed.
- TODO: the governing contract or infrastructure is not approved yet; TODO is
  not passing evidence.
- NOT AVAILABLE: the repository does not provide the requested command, such
  as backend lint/build at the time this suite was introduced.

## Deferred contracts

The suite reports explicit TODO entries for:

- malformed JSON final HTTP response;
- unexpected-error final HTTP response;
- credentialed CORS policy;
- CSRF behavior;
- cookie `SameSite`;
- cookie `Domain`.

These become runnable tests only after their contracts and required production
implementation are separately approved. Current cookie requirements
(`session_id`, `HttpOnly`, `Path=/`, `Max-Age=604800`, and conditional
`Secure`) are runnable assertions.
