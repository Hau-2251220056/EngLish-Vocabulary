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

Daily Goal state-changing and migration harnesses add a stricter pre-mapping
gate through `assertCiExclusiveDatabaseAuthorization()`. Before a future
harness may map a URL into `DATABASE_URL`, the gate requires GitHub CI context,
an exact URL-derived identity matching both configured and HUMAN-approved
identities, the `CI_EXCLUSIVE` target class, and authorization for exactly one
requested operation. It rejects pre-populated `DATABASE_URL` and
`TEST_DATABASE_URL`, prohibited target identities, ambiguous permissions, and
all missing/malformed inputs. The target-class label alone is never identity
proof. TASK-255 validates this logic with fictional URLs only; it does not
authorize or contact a database.

A future authorized Daily Goal harness must use
`prepareDailyGoalDatabase()`. It authorizes configuration, requires a connected
target observation, verifies that observation with
`assertConnectedDatabaseIdentity()`, and only then invokes the injected
protected operation. TASK-255 exercises this orchestration with mocks; it
contains no Prisma spawn or socket connection. Live observation remains `NOT
RUN` until TASK-256 receives explicit database authorization.

TASK-256 offline CI integration adds `observation` as a fourth, distinct Daily
Goal database operation. It requires `DAILY_GOAL_OBSERVATION_ALLOW=true` and
cannot authorize migration, reset, state change, schema creation or cleanup.
Conversely, migration permission cannot authorize observation. The guarded
workflow contains mutually exclusive Daily Goal Phase B/Phase D dispatch inputs,
but both jobs include a literal fail-closed disable condition and contain no
database URL, PostgreSQL adapter, Prisma command or migration executor. Selecting
either mode therefore produces `NOT RUN` summary evidence only.

Migration history approval is destination-specific. `EXISTING_TARGET` describes
the read-only history of the observed CI target/schema. `RUN_OWNED_SCHEMA`
describes a future isolated Phase D schema and may require every historical
migration when fresh. An approval is bound to its context, target identity,
schema identity, ownership evidence and exact ordered names/checksums; approval
for one context cannot authorize the other.

The Phase B offline implementation provides a dependency-injected read-only
observer adapter. It opens no connection at import time and has no built-in
PostgreSQL driver or environment loading. A future separately authorized caller
must inject one connection owned exclusively by the adapter. Before any
observation query, the connection must establish and independently verify a
PostgreSQL read-only transaction/session and return the exact
`POSTGRESQL_TRANSACTION_READ_ONLY` attestation. A requested `READ_ONLY` mode is
only a factory contract and is not accepted as proof by itself. Failure or a
read-write result stops before target/history queries. The same verified session observes
`current_database()`, server address/port, `current_schema()`, an independent
database ownership comment, and Prisma migration-history rows. Only static
`SELECT` statements are accepted. The adapter closes the handle in `finally`
and redacts connection failures.

The connection, query method, factory and SQL executor never leave the adapter.
The downstream callback receives only a deeply frozen plain-data snapshot:
validated target observation, mapped history, read-only evidence and a hash
binding. Phase A uses a frozen plain-data binding token instead of a raw target
handle; tokens with functions, accessors or non-plain prototypes fail closed.
This preserves same-session observation binding without claiming that a token
proves identity across separate connections. Static SQL filtering remains
defense-in-depth, not the sole boundary. Live Phase B must additionally prove
the real factory establishes/verifies server-enforced read-only state and should
use dedicated least-privilege credentials; offline mocks do not prove either.

The independent database comment must have the form
`elvocab-ci-exclusive:v1:<approved-target-identity>` and must match the exact
configured/HUMAN-approved target identity through the existing connected-target
verifier. No such live marker or connected observation has been established by
offline tests, so Phase B live remains blocked. A future run-owned schema marker
would prove ownership of that schema only, not that the base database is
CI-exclusive.

The shared `prepare-test-database.js` remains unchanged in behavior for legacy
Authentication, Topic, Vocabulary, Set, Learning, Quiz and XP workflows. Those
paths still use their existing `TEST_DATABASE_URL`/`.env.test` contract and are
not authorized for Daily Goal migration/reset/state-changing work. In this
repository configuration `.env.test` may identify Preview TEST, so it is an
explicitly unsupported and unsafe Daily Goal path; TASK-255 does not broaden
scope by redesigning all legacy database safety.

### Database call-path audit

| Caller/path | Operation | Configuration source | Required guard | Can access DB? | Ownership |
|---|---|---|---|---|---|
| `prepareDailyGoalDatabase()` | Future migration/reset/state change | `CI_TEST_DATABASE_URL` only | CI-exclusive authorization plus connected identity | Only through injected callback after both checks | Daily Goal |
| `test:daily-goal-database-safety` | Pure guard/orchestration tests | Fictional in-memory objects | Same functions with mocks | No | Daily Goal |
| `prepare-test-database.js` via `test:db:prepare[:ci]` | Shared migration deploy | Legacy `.env.test` or injected `TEST_DATABASE_URL` | `configureTestEnvironment()` | Yes | Legacy shared workflow; prohibited for Daily Goal |
| `createTestDatabase()` and reset helpers | Fixture connection/reset | Legacy `TEST_DATABASE_URL` mapped to `DATABASE_URL` | `configureTestEnvironment()`; optional owned-schema marker | Yes | Legacy Auth/Topic/Vocabulary/Set/Learning/Quiz/XP/Streak tests; prohibited for Daily Goal |
| XP/Streak migration harnesses | Isolated-schema migration/cleanup | Guarded `TEST_DATABASE_URL` plus feature-specific CI identity/ownership | Existing XP/Streak authorization and owned-schema guards | Yes | Existing XP/Streak only |
| Start/seed/manual/status scripts | Integration/manual state changes | Legacy test environment | `configureTestEnvironment()` | Yes | Existing workflows; prohibited for Daily Goal |

No existing caller invokes the Daily Goal preparation orchestrator yet. This is
intentional: TASK-256 must supply the authorized live observer and migration
executor. Any Daily Goal caller that bypasses this orchestrator is unsupported.

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
