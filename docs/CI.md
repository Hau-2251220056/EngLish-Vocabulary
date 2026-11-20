# CI Foundation

## Status

- CI Foundation: `DONE`
- Approved SPEC: `docs/specs/CI_FOUNDATION_SPEC.md`
- Approved PLAN: `docs/plans/CI_FOUNDATION_PLAN.md`
- Approved TASK: `docs/tasks/CI_FOUNDATION_TASK.md`
- TASK-055 through TASK-063: `COMPLETE`.
- Formal TEST: `PASS`.
- Formal REVIEW: `APPROVE`.
- HUMAN final closure approval: `APPROVED`.

## Runtime Baseline

CI and local verification use Node.js 22. The repository root `.nvmrc` is the version declaration for compatible local version managers. Both workflows select Node.js 22 explicitly and use committed npm lockfiles with `npm ci`.

## Approved CI V1 Triggers

CI V1 runs for:

- pull requests targeting `dev`;
- pushes to `dev`; and
- optional maintainer-triggered `workflow_dispatch` runs.

No CI V1 trigger deploys the application.

## Approved Workflow Boundary

CI V1 uses two workflows.

### Secret-Free CI

Stable checks:

- `CI / Frontend Quality`
- `CI / Backend Unit`
- `CI / Frontend Browser Smoke`

These checks require no database secret and are eligible for same-repository and fork pull requests.

### Guarded Integration CI

Stable checks:

- `CI Guarded Integration / Trust Gate`
- `CI Guarded Integration / Backend DB Integration`
- `CI Guarded Integration / Real Stack Browser`
- `CI Guarded Integration / Summary`

Guarded jobs run only for trusted same-repository pull requests, pushes to `dev`, or maintainer dispatch. Fork pull requests must not receive secrets and must report the guarded boundary as `SKIPPED_FORK`, not PASS.

GitHub Actions availability, repository secrets and branch-protection settings are HUMAN-controlled repository administration. They are not configured by application code.

## TEST Database Safety

Database-dependent CI requires a human-provisioned PostgreSQL database used exclusively by CI for this repository.

It must never be:

- Main;
- Preview;
- Production;
- a normal development database; or
- the developer-shared/manual TEST database.

The GitHub secret name is `CI_TEST_DATABASE_URL`. This document intentionally defines no value. The HUMAN database owner confirmed the configured target is a disposable PostgreSQL database reserved exclusively for this repository's GitHub Actions and authorized destructive CI verification there.

Existing safety requirements remain authoritative:

- `NODE_ENV=test`;
- guarded `TEST_DATABASE_URL`;
- `TEST_DATABASE_ALLOW_RESET=true` for destructive work; and
- `configureTestEnvironment()` before migration, reset, fixture or database-backed test access.

Missing configuration reports `SKIPPED_NOT_CONFIGURED` without running a database command and is not PASS evidence. Invalid or ambiguous configuration fails through the existing guards before destructive access. CI never falls back to `DATABASE_URL` from another environment.

## Prisma Migration Boundary

CI may apply only committed migrations to the confirmed CI-exclusive TEST database. The existing guarded `backend/test/scripts/prepare-test-database.js` entry point remains the only approved path to `prisma migrate deploy`.

CI V1 must not use:

- unguarded DB-dependent Prisma commands;
- `prisma migrate dev`;
- `prisma db push`;
- migration generation; or
- Main, Preview or Production migrations.

Prisma Client generation is a code-generation step and is separate from database migration execution.

## Destructive Execution and Cleanup

The guarded workflow must serialize its complete migration, backend integration, real-stack browser and cleanup lifecycle through one workflow-wide concurrency group with `cancel-in-progress: false`.

Backend DB Integration and Real Stack Browser must never overlap when sharing the CI database. Backend tests remain sequential and real-stack Playwright remains single-worker. Cleanup failures are failures; they must not be hidden.

## Failure and Artifact Policy

- Executed lint, test, build, migration, guard and cleanup failures remain non-zero.
- PASS, FAIL, TODO, SKIPPED and NOT RUN must remain distinct.
- Playwright uploads failure screenshots and retained traces only from approved result paths.
- Artifact retention is seven days.
- Environment files, database dumps, database URLs, credentials, cookies and session values must never be uploaded or printed.
- Artifact upload must not mask the original failure.

## Deferred

CI Foundation V1 does not include:

- Continuous Deployment or automatic deployment;
- Main, Preview or Production migrations;
- Docker or CI service containers;
- Vercel/Render deployment-provider restructuring;
- coverage thresholds; or
- unrelated dependency/security automation.

The current deployment-provider documentation/configuration discrepancy remains outside CI Foundation and must be resolved through a separate approved workflow before CD is designed.

## Formal Verification Evidence

- Secret-free PR run for commit `a48a908f09ecc3b5109e42cd417aa073af7b32c3`: Frontend Quality, Backend Unit and Frontend Browser Smoke all PASS; browser smoke completed 25/25 tests.
- Guarded same-repository PR run `35997986127`: Trust Gate, guarded committed-migration preparation, complete sequential Backend DB Integration, both controlled cleanup steps, dependent single-worker Real Stack Browser and Integration Summary all PASS.
- Backend DB Integration completed before Real Stack Browser started; workflow concurrency remains `cancel-in-progress: false`.
- Fork isolation is verified from the workflow trust condition: fork pull requests receive `SKIPPED_FORK`, do not receive the database secret and cannot start guarded DB/browser jobs. No live fork PR was created, so this remains static policy evidence rather than claimed live execution.
- Initial CI failures demonstrated non-zero failure propagation and seven-day Playwright failure-artifact publication. No artifact or repository file contained an environment file, database URL, credential or session value.
- Main, Preview, Production and developer-shared TEST databases were not accessed. No deployment occurred.

### Acceptance-Criteria Traceability

- **AC-01–AC-05:** Workflow trigger inspection, Node.js 22 plus `npm ci`, and the authoritative three-job secret-free run verify frontend quality, DB-independent backend coverage and 25/25 Auth/App Layout browser smoke without a database secret.
- **AC-06–AC-09:** Script inspection verifies the complete Authentication, Topic, Vocabulary, Vocabulary Set and Learning backend sequence. HUMAN-controlled CI database confirmation and guarded run `35997986127` verify fail-closed environment setup and committed migrations through the approved preparation entry point only.
- **AC-10–AC-12:** Workflow dependencies, single-worker configuration and non-cancelling concurrency serialize destructive work; the guarded run verifies both cleanup boundaries and the real-stack browser gate. Failure-path evidence verifies safe Playwright artifact publication.
- **AC-13–AC-15:** CI scripts consume injected variables while retaining local `.env.test` compatibility and all guards. Check-result handling distinguishes skipped, failed and passed states; least-privilege permissions, workflow inspection and repository secret checks found no exposed sensitive value.
- **AC-16–AC-17:** Branch scope inspection confirms no CD, Docker, deployment-provider restructuring, coverage threshold, unrelated automation, application API, schema, authorization, business-rule or production-UI change.
