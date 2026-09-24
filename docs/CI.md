# CI Foundation

## Status

- CI Foundation: `IN_PROGRESS`
- Approved SPEC: `docs/specs/CI_FOUNDATION_SPEC.md`
- Approved PLAN: `docs/plans/CI_FOUNDATION_PLAN.md`
- Approved TASK: `docs/tasks/CI_FOUNDATION_TASK.md`
- Current implementation boundary: TASK-055 documentation and Node.js baseline only.
- GitHub Actions workflows and CI-safe package scripts do not exist yet.

## Runtime Baseline

CI and local verification use Node.js 22. The repository root `.nvmrc` is the version declaration for compatible local version managers. Future workflows must also select Node.js 22 explicitly and must use committed npm lockfiles with `npm ci`.

## Approved CI V1 Triggers

CI V1 will run for:

- pull requests targeting `dev`;
- pushes to `dev`; and
- optional maintainer-triggered `workflow_dispatch` runs.

No CI V1 trigger deploys the application.

## Approved Workflow Boundary

CI V1 is planned as two workflows.

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

The planned GitHub secret name is `CI_TEST_DATABASE_URL`. This document intentionally defines no value. A HUMAN database owner must confirm the database identity and destructive-test authorization before guarded execution is enabled.

Existing safety requirements remain authoritative:

- `NODE_ENV=test`;
- guarded `TEST_DATABASE_URL`;
- `TEST_DATABASE_ALLOW_RESET=true` for destructive work; and
- `configureTestEnvironment()` before migration, reset, fixture or database-backed test access.

Missing or ambiguous configuration must fail before any database command or write. CI must never fall back to `DATABASE_URL` from another environment.

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
- Planned artifact retention is seven days.
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
