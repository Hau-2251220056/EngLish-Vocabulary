# Backend Tests

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

## CI Foundation boundary

The approved CI Foundation keeps local `.env.test` commands and future CI
commands as separate entry paths to the same safety helpers. CI commands will
inherit environment variables from the runner; they must not create or commit
an `.env.test` file and must not weaken `configureTestEnvironment()`.

Database-dependent CI requires a PostgreSQL TEST database dedicated exclusively
to this repository's CI. Main, Preview, Production, development and the
developer-shared/manual TEST database are prohibited. The external GitHub
secret is named `CI_TEST_DATABASE_URL`; its value must never appear in source,
logs, artifacts or documentation.

CI migration preparation must continue through
`test/scripts/prepare-test-database.js`. Backend DB Integration and real-stack
browser verification must execute serially when they share that database, with
workflow cancellation disabled and controlled cleanup preserved.

TASK-055 documents this boundary only. CI-specific package scripts and GitHub
Actions workflows are introduced by later approved tasks.

TASK-056 adds environment-inheriting CI commands without changing the local
`.env.test` commands:

```text
npm run test:unit:ci
npm run test:db:prepare:ci
npm run test:integration:ci
```

`test:unit:ci` contains only DB-independent Authentication component, password
security, deferred-contract and Vercel-entry coverage. It must not require or
attempt a PostgreSQL connection.

`test:integration:ci` contains the DB-backed Authentication HTTP, Topic,
Vocabulary, Vocabulary Set and Learning suites. It uses one Node test process
with test concurrency `1`. The runner must inject the guarded TEST variables;
the command itself does not load `.env.test` and provides no fallback.

`test:db:prepare:ci` invokes the existing guarded migration-preparation script
without loading an environment file. Missing or invalid injected TEST
configuration is refused before Prisma migration execution.

## Commands

From `backend/`:

```text
npm run test:db:prepare
npm run test:auth
npm test
```

The commands above remain the developer-local entry points and continue to load
the ignored `.env.test` file. The new `:ci` commands do not replace them.

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
