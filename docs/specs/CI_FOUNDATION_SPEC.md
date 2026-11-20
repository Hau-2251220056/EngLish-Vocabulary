# SPEC: CI Foundation

**Foundation status:** `TODO` (not yet recorded as a standalone entry in `docs/FEATURE_STATUS.md`)

**SPEC status:** `APPROVED`

**Human approval:** `APPROVED` for CI Foundation PLAN preparation.

**Implementation authorized:** `NO`

## 1. Objective

Establish the smallest safe Continuous Integration foundation for ELVocab. CI V1 must automatically verify the repository's frontend, backend and approved integration boundaries without deploying the application or accessing any Main, Preview or Production database.

CI V1 converts the repository's existing local verification conventions into repeatable GitHub Actions checks. It preserves the current fail-closed TEST database guards, uses deterministic dependency installation and reports failures with sufficient evidence for diagnosis.

Continuous Deployment is not part of this foundation.

## 2. Existing Context and Reconciliation

- The repository currently has no `.github/workflows` configuration.
- Frontend scripts already provide ESLint, Node unit tests, a production Vite build, DB-independent Auth/App Layout Playwright coverage and guarded real-stack Playwright coverage.
- Backend tests use Node.js 22 built-ins. Database-backed Authentication, Topic, Vocabulary, Vocabulary Set and Learning suites use `configureTestEnvironment()` and destructive reset helpers against a dedicated TEST database.
- The current backend default `npm test` does not include the Vocabulary Set or Learning suites and mixes database-backed and DB-independent Authentication coverage.
- Existing backend and real-stack browser commands load a local ignored `.env.test`; CI must instead consume injected environment variables without committing or generating secret-bearing repository files.
- `prepare-test-database.js` already validates the TEST environment before invoking `prisma migrate deploy`. This guarded entry point is the approved migration boundary for CI.
- Database-backed suites perform broad TEST data resets and therefore cannot safely run concurrently against one database.
- `docs/ARCHITECTURE.md` describes Vercel frontend hosting and Render backend hosting, while checked-in deployment configuration also includes a backend Vercel configuration and a frontend rewrite to a Vercel backend URL. CI Foundation does not resolve or alter this deployment-provider direction; CD remains deferred.

## 3. Actors and Trust Boundaries

CI Foundation does not add application roles or change USER/ADMIN behavior.

The relevant automation actors are:

- **Trusted repository pull request:** A pull request whose workflow is permitted to receive the protected CI TEST database secret under repository policy.
- **Fork pull request:** An untrusted pull request that must not receive repository secrets or execute destructive database jobs.
- **Push to `dev`:** A trusted integration event that runs the approved required checks.
- **Maintainer:** May manually dispatch the workflow when an approved rerun or diagnostic execution is required.

GitHub Actions is not an authorization boundary for the application. It is an isolated verification environment with least-privilege repository access.

## 4. Scope

### 4.1 In Scope

- GitHub Actions CI for pull requests targeting `dev`, pushes to `dev`, and optional manual dispatch.
- Node.js 22 as the repository CI runtime baseline.
- Deterministic frontend and backend dependency installation from committed lockfiles.
- Frontend lint, complete unit tests and production build.
- DB-independent backend component/security/contract tests.
- Guarded database migration and backend integration tests against a CI-exclusive PostgreSQL TEST database.
- DB-independent Auth/App Layout browser smoke coverage.
- Guarded real-stack browser verification under the execution policy defined by this SPEC.
- Serialized destructive jobs that share the CI TEST database.
- Failure artifacts for Playwright screenshots and traces.
- Clear required-check and failure behavior.
- CI-safe package scripts and environment injection that preserve existing safety guards.

### 4.2 Out of Scope / Deferred

- Continuous Deployment or automatic deployment to any provider.
- Applying migrations to Main, Preview or Production.
- Provisioning the CI-exclusive PostgreSQL database.
- Docker, Docker Compose or CI service-container infrastructure.
- Restructuring Vercel, Render, Supabase or other deployment-provider responsibilities.
- Resolving the current deployment documentation/configuration discrepancy.
- Coverage collection or coverage thresholds.
- Unrelated dependency update, vulnerability scanning or security automation.
- Renovate, Dependabot or other dependency-management automation.
- Application behavior, API, database schema or business-rule changes.
- Product feature implementation.

## 5. Trigger and Required-Check Policy

### 5.1 Triggers

CI V1 runs on:

1. every pull request whose base branch is `dev`;
2. every push to `dev`; and
3. optional maintainer-triggered `workflow_dispatch`.

CI V1 does not deploy from any trigger.

### 5.2 Required Checks

- Frontend quality and DB-independent backend checks run for every pull request and push to `dev`.
- DB-independent browser smoke coverage runs for every pull request and push to `dev` when the GitHub runner can install the approved browser runtime.
- Guarded DB integration and guarded real-stack browser checks are required for trusted changes before integration is considered verified.
- Fork pull requests run only secret-free checks. Their DB-dependent checks report as intentionally skipped, not passed.
- A trusted push to `dev` must run the full guarded checks so merged code cannot rely solely on a fork's secret-free evidence.
- Any executed required check that fails must fail the workflow. CI must not convert failures into warnings or successful outcomes.
- Skipped secret-dependent fork checks must be visible and must not be presented as test evidence.

Branch-protection configuration is repository administration outside the workflow file, but the eventual PLAN must identify the stable check names intended to become required checks.

## 6. Runtime and Dependency Rules

- All jobs use Node.js 22.
- Frontend and backend use their committed `package-lock.json` files with `npm ci`.
- Frontend and backend dependency caches are separate and keyed from the applicable lockfile.
- CI must not cache `node_modules`.
- Prisma Client is generated in the backend job from the committed schema and installed Prisma version; generated output is not committed or reused as authoritative CI evidence.
- Playwright browser installation is limited to the browser required by existing Chromium projects. Caching the browser download is optional and must not compromise determinism.
- GitHub Actions permissions default to read-only repository contents unless an explicitly approved future requirement needs more.

## 7. CI Jobs and Quality Gates

### 7.1 Frontend Quality

The frontend quality job must:

1. install frontend dependencies deterministically;
2. run the complete frontend ESLint scope;
3. run all frontend Node unit tests; and
4. produce a successful production Vite build.

This job requires no database or deployment secret. A build must not deploy its output.

### 7.2 Backend DB-Independent Verification

The backend DB-independent job must:

1. install backend dependencies deterministically;
2. generate Prisma Client without connecting to a Main, Preview or Production database; and
3. run only tests whose collaborators are mocked/in-memory and that perform no database connection, migration, reset or fixture write.

CI-safe scripts must separate these tests from `auth-http.test.js` and every other database-backed suite. The separation must be explicit rather than inferred from a failed database connection.

### 7.3 DB-Independent Browser Smoke

The browser-smoke job runs the existing mocked Auth/App Layout Playwright project. It must:

- use no PostgreSQL secret;
- start only the frontend development server required by the project;
- retain screenshots on failure and traces according to the existing retry policy; and
- upload available failure artifacts even when the test command fails.

### 7.4 Guarded Backend DB Integration

The guarded backend integration job must cover all current database-backed domains:

- Authentication HTTP behavior;
- Topic;
- Vocabulary;
- Vocabulary Set; and
- Learning.

It must run sequentially against the CI-exclusive TEST database, prepare migrations through the guarded path, preserve current reset/cleanup behavior and report exact PASS/FAIL/TODO results. No current implemented domain may be silently omitted from the aggregate CI command.

### 7.5 Guarded Real-Stack Browser Verification

Real-stack browser verification uses the existing combined integration project where practical so the same feature suites are not redundantly started through overlapping configurations.

It must:

- run only for trusted events with the CI TEST database secret;
- use the existing guarded global setup and backend test-server entry point;
- execute with one worker and without parallel destructive fixture activity;
- run after, or mutually exclusively with, backend DB integration when both share one database;
- preserve controlled fixture cleanup; and
- upload failure screenshots/traces.

Because the guarded PostgreSQL database is remote and has known latency, CI timeout values may accommodate observed network/database round trips. Timeouts must not hide assertion failures or weaken contracts.

## 8. Guarded Database Strategy

### 8.1 CI-Exclusive Database

DB-dependent CI requires one PostgreSQL database created specifically and exclusively for CI automation. It must not be:

- Main;
- Production;
- a Preview deployment database;
- a normal development database; or
- the developer's manual/local shared TEST database.

The database identity and ownership must be human-confirmed before enabling DB-dependent workflow jobs.

### 8.2 Mandatory Environment Guard

Every migration, reset, database fixture or database-backed test process must establish:

- `NODE_ENV=test`;
- a non-empty valid `TEST_DATABASE_URL`; and
- `TEST_DATABASE_ALLOW_RESET=true` when destructive access is required.

`configureTestEnvironment()` remains the mandatory fail-closed entry point and maps the verified `TEST_DATABASE_URL` to process-local `DATABASE_URL`. CI must not weaken, bypass or duplicate this identity check with a less strict implementation.

If identity or safety cannot be established, the job must stop before any database command or write.

### 8.3 Serialization and Cleanup

- All destructive jobs sharing the database use one concurrency group.
- They run with `cancel-in-progress: false` so a newer workflow cannot interrupt a reset/migration/test sequence midway.
- Backend DB tests remain sequential.
- Real-stack browser tests remain single-worker.
- Controlled cleanup runs after test execution where technically safe, including failure paths.
- Cleanup failures fail the job and are reported; they are not ignored.
- CI must not run backend DB integration and real-stack browser tests concurrently against the same database.

## 9. Prisma Migration Safety

- CI may apply only committed migrations to the CI-exclusive TEST database.
- Migration preparation must use the existing guarded test preparation entry point, which calls `prisma migrate deploy` only after environment validation.
- CI must not invoke raw DB-dependent Prisma commands outside that guarded path.
- `prisma migrate dev`, `prisma db push`, schema resets against non-TEST targets and migration generation are prohibited in CI V1.
- CI does not edit historical migrations or generate a migration as part of verification.
- CI never applies migrations to Main, Preview or Production.
- Prisma Client generation is a build-time code-generation step and must remain distinct from database migration execution.

## 10. CI-Safe Environment and Script Contract

The implementation may add narrowly scoped package scripts or test wrappers needed to run in CI. They must:

- consume environment variables injected by the runner instead of requiring an ignored local `.env.test` file;
- preserve the existing developer-local commands;
- call existing guards before any database-dependent action;
- provide one complete backend DB integration command;
- provide one DB-independent backend command;
- provide CI-safe real-stack server/browser commands without writing secrets to disk;
- avoid echoing environment values, connection strings or credentials; and
- return the underlying test/build exit code accurately.

CI configuration must not manufacture a committed `.env` or `.env.test` file. Application production configuration is unchanged.

## 11. Secrets and Security Boundaries

The recommended repository/environment secret name is:

- `CI_TEST_DATABASE_URL`

The workflow may map this value only inside guarded DB jobs to `TEST_DATABASE_URL` and, when Prisma configuration loading requires it, process-local `DATABASE_URL`.

Non-secret job environment names include:

- `CI`;
- `NODE_ENV`;
- `TEST_DATABASE_ALLOW_RESET`;
- `INTEGRATION_PORT`; and
- `API_PROXY_TARGET`.

Security requirements:

- Secret values must never appear in workflow source, logs, artifacts, command output or test reports.
- Fork pull requests must not receive or indirectly access secrets.
- Pull-request code must not be allowed to exfiltrate a protected DB secret through an automatically privileged workflow context.
- CI artifacts must exclude environment files, database dumps, generated credentials and session data.
- CI requires no Vercel, Render, Supabase Production or deployment token.
- Secret absence causes guarded jobs to skip under the approved fork policy or fail closed on trusted events; it must never trigger fallback to another database.

## 12. Failure Reporting and Artifacts

- Lint, unit, build, backend, migration-preparation, browser, cleanup and safety-guard failures retain their non-zero result.
- Playwright failure screenshots and traces are uploaded with a bounded retention period to be chosen during PLAN/implementation.
- Successful browser artifacts need not be uploaded unless required for diagnosis.
- Artifact upload must use an always-run condition but must not mask the original failure.
- Logs and summaries identify which gates passed, failed, were skipped by trust policy or were not run.
- Existing approved `TODO` tests remain visible as TODO and are not counted as PASS.
- Workflow output must not expose secret values or sanitized connection components that could materially reveal credentials.

## 13. Acceptance Criteria

- **AC-01:** CI V1 is triggered for pull requests targeting `dev`, pushes to `dev` and optional manual dispatch, and no trigger performs deployment.
- **AC-02:** Every job uses the approved Node.js 22 baseline and deterministic lockfile-based installation.
- **AC-03:** Every eligible change runs frontend lint, all frontend unit tests and a production build; any failure fails its check.
- **AC-04:** DB-independent backend tests run without connecting to PostgreSQL and are explicitly separated from database-backed suites.
- **AC-05:** The DB-independent Auth/App Layout Playwright smoke suite runs without database secrets and retains diagnostic artifacts on failure.
- **AC-06:** The guarded backend integration command includes Authentication HTTP, Topic, Vocabulary, Vocabulary Set and Learning coverage without silently omitting an implemented domain.
- **AC-07:** DB-dependent jobs cannot start without a human-confirmed CI-exclusive PostgreSQL TEST database and the existing fail-closed environment guard.
- **AC-08:** No CI process accesses or mutates Main, Preview, Production, a normal development database or a developer-shared manual TEST database.
- **AC-09:** Committed migrations are applied only through the guarded test preparation path; CI uses neither `migrate dev` nor `db push` and performs no production migration.
- **AC-10:** Destructive backend and real-stack jobs sharing one TEST database are serialized, not cancelled mid-run, and use sequential/single-worker execution.
- **AC-11:** Trusted events can run guarded DB/real-stack checks, while fork pull requests receive no secret and visibly skip rather than falsely pass those checks.
- **AC-12:** The real-stack browser gate exercises the existing combined integration coverage, cleans controlled fixtures and publishes safe Playwright failure artifacts.
- **AC-13:** CI-safe scripts accept runner-injected environment values without committing secret files, weakening guards or breaking existing local commands.
- **AC-14:** Required executed checks fail on lint, test, build, migration, assertion, safety or cleanup failure; logs distinguish PASS, FAIL, TODO, SKIPPED and NOT RUN accurately.
- **AC-15:** Workflow permissions and secrets follow least privilege, and no credential, database URL, environment file, dump or session value is exposed in source, logs or artifacts.
- **AC-16:** CI V1 adds no CD, Docker, deployment-provider restructuring, coverage threshold or unrelated dependency/security automation.
- **AC-17:** CI Foundation changes no application API, database schema, authentication/authorization behavior, business rule or production UI behavior.

## 14. Dependencies, Risks and Deferred Decisions

### 14.1 Dependencies

- A human-provisioned and human-confirmed CI-exclusive PostgreSQL TEST database.
- Repository secret configuration for `CI_TEST_DATABASE_URL`.
- GitHub Actions repository permissions and eventual branch-protection configuration.
- CI-safe script separation for DB-independent and DB-backed verification.

### 14.2 Risks

- Broad destructive resets make accidental database reuse high impact; guard preservation and database exclusivity are mandatory.
- Remote database latency may lengthen jobs and cause infrastructure timeouts; it must not be mistaken for permission to weaken assertions.
- Fork pull requests cannot provide complete DB evidence because secrets are intentionally unavailable.
- Overlapping DB workflows can corrupt each other's fixtures unless serialization is enforced.
- Unpinned runner/runtime behavior can create drift; Node.js 22 and lockfiles are mandatory.
- Existing deployment documentation and configuration are not sufficiently reconciled for CD.

### 14.3 Deferred Decisions

The PLAN may select implementation details that do not change this contract, including workflow filenames, stable check names, artifact retention duration and whether guarded real-stack verification runs on every trusted PR or on trusted `dev` pushes plus manual dispatch. Before implementation approval, the selected policy must still ensure full guarded evidence before a release/integration checkpoint is treated as verified.

No product or security decision remains unresolved for the SPEC itself.

## Approval Gate

```text
SPEC STATUS: PENDING HUMAN APPROVAL
NEXT ALLOWED STAGE: HUMAN SPEC REVIEW
PLAN / TASK / IMPLEMENTATION AUTHORIZED: NO
```
