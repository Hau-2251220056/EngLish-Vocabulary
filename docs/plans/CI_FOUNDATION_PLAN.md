# PLAN: CI Foundation

**Source SPEC:** `docs/specs/CI_FOUNDATION_SPEC.md` (`APPROVED`)

**Foundation status:** `TODO`

**PLAN status:** `APPROVED`

**Human approval:** `APPROVED` for CI Foundation TASK decomposition.

**Implementation authorized:** `NO`

## 1. Summary

CI Foundation V1 will add two GitHub Actions workflows:

1. a secret-free quality workflow for frontend quality, backend DB-independent tests and mocked browser smoke; and
2. a guarded integration workflow for the complete backend PostgreSQL suites followed by the combined real-stack Playwright suite.

Both workflows target pull requests to `dev`, pushes to `dev` and manual dispatch. The guarded workflow runs only for trusted events, uses a human-provisioned CI-exclusive PostgreSQL TEST database and serializes its entire migration/test/browser lifecycle across workflow runs. It never deploys.

Existing local commands remain available. New CI-safe scripts consume runner-injected environment variables without requiring `.env.test`, while all database-dependent entry points continue through `configureTestEnvironment()`.

## 2. Scope and Acceptance-Criteria Traceability

| Approved SPEC criteria | Planned implementation / evidence |
|---|---|
| AC-01 | Two workflows with `pull_request` to `dev`, `push` to `dev` and `workflow_dispatch`; no deployment step or permission. |
| AC-02 | Root Node version declaration plus explicit Node.js 22 setup and lockfile-driven `npm ci` in every job. |
| AC-03 | `Frontend Quality` job runs ESLint, complete Node unit suite and Vite production build as fail-fast gates. |
| AC-04 | Dedicated backend DB-independent script contains only component/password/deferred/Vercel-entry tests and runs with no reachable database. |
| AC-05 | `Frontend Browser Smoke` runs existing Auth/App Layout Playwright coverage without DB secrets and uploads failures. |
| AC-06 | One complete backend integration command includes Auth HTTP, Topic, Vocabulary, Vocabulary Set and Learning suites sequentially. |
| AC-07–AC-08 | Guarded integration is disabled until a CI-exclusive DB is human-confirmed; runtime guard and trusted-event tests prove fail-closed behavior and no fallback. |
| AC-09 | Existing guarded preparation script remains the sole `prisma migrate deploy` boundary; workflow contains no raw DB migration command. |
| AC-10 | Entire guarded workflow uses one cross-run concurrency group with cancellation disabled; backend runner and Playwright use sequential execution. |
| AC-11 | Same-repository PR/push/manual trust condition; fork PR receives no secret and reports guarded checks as skipped. No `pull_request_target`. |
| AC-12 | Combined real-stack config runs once after backend DB integration, with cleanup and safe screenshot/trace artifacts. |
| AC-13 | CI scripts inherit injected environment; local `.env.test` scripts remain as developer conveniences; no environment file is written. |
| AC-14 | Exact command exit codes and always-run cleanup/artifact steps preserve PASS/FAIL/TODO/SKIPPED/NOT RUN distinctions. |
| AC-15 | Read-only workflow permissions, secret redaction review and artifact-content checks. |
| AC-16–AC-17 | Diff/scope review proves no CD, Docker, deployment restructuring, coverage threshold, product code, schema, API or UI change. |

## 3. Existing Infrastructure to Reuse

- `backend/test/helpers/test-environment.js` — mandatory fail-closed `NODE_ENV`, `TEST_DATABASE_URL` and reset-authorization validation, plus process-local `DATABASE_URL` mapping.
- `backend/test/helpers/test-database.js` — current sequential destructive reset/cleanup boundary.
- `backend/test/scripts/prepare-test-database.js` — guarded migration deployment entry point.
- `backend/test/scripts/start-integration-server.js` — guarded real-stack backend process.
- `backend/test/auth/*.test.js`, `topic/topic.test.js`, `vocabulary/vocabulary.test.js`, `vocabulary-set/vocabulary-set.test.js`, `learning/learning.test.js` — existing backend verification inventory.
- `frontend/playwright.config.js` — DB-independent Auth/App Layout Chromium smoke project.
- `frontend/playwright.integration.config.js` and `frontend/e2e/integration/global-setup.js` — combined serial real-stack project and guarded migration preparation.
- `frontend/test/*.test.js`, ESLint and Vite scripts — complete frontend quality gates.
- Backend and frontend `package-lock.json` files — deterministic installation/cache keys.
- `.gitignore` — existing exclusion of environment files, logs, Playwright reports, test results and generated output.

No new test framework, package, container or external automation dependency is planned.

## 4. Workflow Structure and Stable Job Names

### 4.1 Secret-Free Workflow

Create `.github/workflows/ci.yml`, displayed as **CI**, with least-privilege `contents: read` and these stable jobs:

| Job ID | Check name | Responsibility |
|---|---|---|
| `frontend-quality` | `CI / Frontend Quality` | Frontend install, lint, all unit tests and production build. |
| `backend-unit` | `CI / Backend Unit` | Backend install/client generation and explicitly DB-independent tests. |
| `frontend-browser-smoke` | `CI / Frontend Browser Smoke` | Existing mocked Auth/App Layout Playwright suite and failure artifacts. |

All three jobs run for PRs targeting `dev`, pushes to `dev` and manual dispatch, including fork PRs because they require no secret. They may run in parallel.

### 4.2 Guarded Integration Workflow

Create `.github/workflows/ci-integration.yml`, displayed as **CI Guarded Integration**, with least-privilege `contents: read` and these stable jobs:

| Job ID | Check name | Responsibility |
|---|---|---|
| `trust-gate` | `CI Guarded Integration / Trust Gate` | Classify the event without reading a secret: trusted push/manual/same-repository PR or untrusted fork PR. |
| `backend-db-integration` | `CI Guarded Integration / Backend DB Integration` | Guarded migration preparation, full sequential backend DB suite and cleanup. |
| `real-stack-browser` | `CI Guarded Integration / Real Stack Browser` | Combined real-stack Playwright suite after backend DB integration, with cleanup and failure artifacts. |
| `integration-summary` | `CI Guarded Integration / Summary` | Report PASS/FAIL or intentional fork SKIPPED without presenting skipped tests as passing evidence. |

`backend-db-integration` and `real-stack-browser` run only when `trust-gate` classifies the event as trusted. The browser job has an explicit dependency on the backend DB job. The summary job runs with an always condition and fails when an executed guarded job failed.

The implementation must not use `pull_request_target`, checkout or execute untrusted fork code with repository secrets, or interpolate secret values into commands.

### 4.3 Branch-Protection Plan

After workflow verification, repository administration may mark these secret-free checks as universally required:

- `CI / Frontend Quality`
- `CI / Backend Unit`
- `CI / Frontend Browser Smoke`

For same-repository PRs and `dev` integration, guarded check policy should also require:

- `CI Guarded Integration / Summary`

Because fork PRs intentionally cannot run guarded tests, the PLAN does not require a secret-dependent job directly as a universal fork-compatible branch-protection check. The summary must clearly distinguish `SKIPPED_FORK` from `PASS`, and a trusted `dev` push always executes the full guarded workflow.

Actual branch-protection configuration is repository administration and is not performed by implementation tasks unless separately authorized.

## 5. Runtime, Installation and Cache Strategy

- Add a root `.nvmrc` containing the Node.js 22 major baseline.
- Configure every job with Node.js 22 explicitly rather than relying only on the runner default or `.nvmrc` auto-discovery.
- Use the GitHub Node setup action's npm cache with the applicable dependency path:
  - `frontend/package-lock.json` for frontend jobs;
  - `backend/package-lock.json` for backend jobs;
  - both lockfiles for the real-stack job.
- Use `npm ci`; never cache or upload `node_modules`.
- Do not cache generated Prisma Client. Generate it during backend installation/job setup.
- Install only Chromium plus its runner dependencies for Playwright jobs.
- Do not initially cache Playwright browser binaries; this avoids stale browser/runtime coupling. Reconsider only from measured CI cost in a separately approved improvement.

### 5.1 Prisma Generation Without DB Access

Backend `postinstall` currently runs `prisma generate`, while Prisma configuration requires `DATABASE_URL` to be syntactically present. For the DB-independent backend job:

- provide a non-secret, intentionally unreachable loopback PostgreSQL placeholder only during install/generation;
- never call a database-dependent Prisma command in that job; and
- verify the DB-independent suite succeeds even though no database can be reached.

For guarded integration jobs, map the protected CI database secret to both guarded `TEST_DATABASE_URL` and process-local `DATABASE_URL` as required by Prisma configuration. Database identity is still established by `configureTestEnvironment()` before migration/reset/test access.

## 6. CI-Safe Script and Configuration Plan

### 6.1 Backend Scripts

Modify `backend/package.json` without removing current local commands:

- add `test:unit:ci` for DB-independent Auth component, password-security, deferred-contract and Vercel-entry tests;
- add `test:integration:ci` for Auth HTTP, Topic, Vocabulary, Vocabulary Set and Learning in one sequential Node test process; and
- add `test:db:prepare:ci` invoking the existing guarded preparation script without `--env-file`.

The complete integration script must not rely on the current incomplete default `npm test`. It must list every current DB-backed domain explicitly so omissions are reviewable.

No test is weakened, deleted or reclassified merely to make CI pass.

### 6.2 Frontend Scripts and Playwright Configuration

Modify `frontend/package.json` to add CI-safe names that do not load `backend/.env.test`:

- `test:browser:ci` for the default DB-independent Playwright config; and
- `test:integration:ci` for the combined guarded integration config.

Update the combined and feature-specific real-stack Playwright configs so their backend `webServer.command` invokes `start-integration-server.js` directly and inherits the parent process environment. Existing local commands continue to load `.env.test` before starting Playwright, so local behavior remains available without duplicating secrets into child command text.

All configs retain existing ports, one-worker real-stack behavior, timeouts, screenshots and trace semantics unless a CI-only timeout adjustment is justified by the already documented remote TEST DB latency.

### 6.3 Environment Handling

The GitHub repository/environment secret is named `CI_TEST_DATABASE_URL`. Guarded jobs map it at job scope to:

- `TEST_DATABASE_URL`; and
- `DATABASE_URL` only where Prisma config/client processes require it.

Set these non-secret values explicitly in guarded jobs:

- `CI=true`;
- `NODE_ENV=test`; and
- `TEST_DATABASE_ALLOW_RESET=true`.

`INTEGRATION_PORT` and `API_PROXY_TARGET` remain process-specific values supplied by Playwright configuration. No workflow writes `.env`, `.env.test`, database dumps or credentials to the workspace or artifacts.

## 7. Guarded Database Execution Strategy

### 7.1 Provisioning Gate

Before enabling guarded jobs, a database owner must confirm that `CI_TEST_DATABASE_URL` identifies a PostgreSQL database exclusively assigned to GitHub Actions for this repository. Provisioning and credential entry are manual prerequisites, not repository implementation.

If the secret is missing on a trusted event, guarded integration fails closed at the trust/configuration gate. It must not silently skip or fall back to another URL.

### 7.2 Whole-Workflow Serialization

Apply workflow-level concurrency to `ci-integration.yml`:

- one repository-wide group, `elvocab-ci-test-db`;
- `cancel-in-progress: false`.

Workflow-level rather than job-level concurrency keeps one run's migration → backend integration → real-stack browser → cleanup lifecycle together. It prevents another run's reset from interleaving between the first run's backend and browser jobs.

Within a run:

1. trust and required environment are checked;
2. backend job invokes guarded migration preparation;
3. complete backend integration runs sequentially;
4. cleanup executes and is verified;
5. real-stack browser starts only after backend PASS;
6. its guarded global setup revalidates the environment and committed migrations;
7. combined integration runs with one worker; and
8. final controlled cleanup is verified.

The repeated migration safety check before real-stack execution is acceptable because it is guarded and idempotently applies committed migrations; no migration generation or schema reset occurs.

### 7.3 Failure and Cleanup Behavior

- Test/migration failure remains authoritative and non-zero.
- Cleanup uses an always-run step after a DB-backed command when the guarded environment was established.
- Cleanup reuses existing guarded helpers; it does not introduce an unguarded SQL or Prisma CLI shortcut.
- A cleanup failure fails the job even if assertions passed.
- If preparation or identity validation fails, no subsequent DB step runs.
- GitHub cancellation is disabled for this workflow; manual infrastructure cancellation is treated as incomplete evidence and requires a clean guarded rerun.

## 8. Real-Stack Browser Policy

- Run `frontend/playwright.integration.config.js` once per trusted guarded workflow rather than separately executing Topic, Vocabulary, Set and Learning configs.
- The combined suite remains single-worker and non-parallel because its fixtures share one destructively reset database.
- Run it after backend integration to avoid cross-job fixture collisions and to give database/API failures earlier, cheaper feedback.
- Run on same-repository PRs to `dev`, pushes to `dev` and manual dispatch.
- Fork PRs do not run it because they receive no DB secret.
- Known remote TEST DB latency may justify existing/increased infrastructure timeouts during implementation, but assertions, retry counts and business contracts remain unchanged.
- Upload diagnostic artifacts only for failures or retained-on-failure traces; successful reports are summarized in logs rather than archived by default.

## 9. Playwright Artifact Policy

Both browser jobs upload, when present:

- `frontend/test-results/**` screenshots;
- retained trace archives; and
- the minimal Playwright output required to identify the failed project/test.

Policy:

- artifact upload runs even after test failure;
- missing artifact paths do not replace the original test result;
- retention is **7 days**;
- artifacts are named by workflow/job/run attempt to prevent ambiguity;
- `.env*`, logs containing environment dumps, database exports, cookies/session material and credentials are excluded; and
- the workflow's final status continues to reflect the original test or cleanup failure.

## 10. Planned Repository Changes

### Create

- `.github/workflows/ci.yml` — secret-free quality workflow.
- `.github/workflows/ci-integration.yml` — trusted, serialized guarded integration workflow.
- `.nvmrc` — Node.js 22 baseline.
- `docs/CI.md` — operator-facing trigger, check, trust, TEST DB, secret-name, migration-safety and troubleshooting contract without values.

### Modify

- `backend/package.json` — add complete CI-safe unit, migration-preparation and DB-integration scripts; retain developer-local scripts.
- `frontend/package.json` — add CI-safe browser commands; retain local `.env.test` commands.
- `frontend/playwright.integration.config.js` and real-stack feature configs — inherit guarded environment instead of requiring `.env.test` in the backend child command.
- `backend/test/README.md` — document CI command separation, CI-exclusive DB requirement and local/CI invocation differences.
- `docs/ARCHITECTURE.md` — record the approved CI verification boundary only; do not change deployment providers.
- `docs/FEATURE_STATUS.md` — add/update CI Foundation status only as later workflow stages genuinely progress; never mark it DONE before TEST/REVIEW/HUMAN approval.

### Explicitly Unchanged

- Prisma schema and every migration.
- Backend/frontend production application source and API contracts.
- Vercel/Render configuration and deployment secrets.
- Main, Preview and Production databases.
- Existing application roles, authorization and product behavior.

If implementation reveals that a production source or schema change is required, stop and return to HUMAN review because it is outside this PLAN.

## 11. Verification Strategy

### 11.1 Static and Configuration Verification

- Validate workflow YAML structure and action inputs without executing deployment.
- Confirm `permissions: contents: read` and absence of write/deployment permissions.
- Inspect triggers, trust conditions and confirm there is no `pull_request_target`.
- Verify no Docker/service configuration or deployment step exists.
- Verify scripts use injected environment and never echo secret variables.
- Run `git diff --check` and secret/scope inspection.

### 11.2 Secret-Free Workflow Verification

- Run frontend lint, all frontend unit tests and production build locally through the same underlying commands.
- Run backend DB-independent CI script with an unreachable placeholder database and prove it neither connects nor requires TEST DB credentials.
- Run the mocked Auth/App Layout Playwright command and verify failure artifacts with one controlled diagnostic only if artifact behavior needs proof.
- Verify command failures propagate non-zero status.

### 11.3 Guarded Integration Verification

After the CI-exclusive database and secret are human-confirmed:

- verify missing/invalid environment fails before Prisma migration/reset access;
- run guarded migration preparation against the CI TEST database only;
- run the complete backend integration command and record exact PASS/FAIL/TODO totals;
- run the combined real-stack Playwright suite and record exact totals;
- verify controlled fixture cleanup;
- verify no orphan server/browser process remains; and
- confirm Main, Preview, Production and manual developer TEST databases were untouched.

### 11.4 GitHub Event Verification

- Same-repository PR: all secret-free and guarded checks execute.
- Push to `dev`: all checks execute.
- Manual dispatch: all checks execute when the secret is configured.
- Fork PR: secret-free checks execute; guarded DB/browser commands do not start; summary identifies `SKIPPED_FORK`.
- Deliberate check failure: appropriate workflow/check fails and artifacts remain available without secret leakage.

If a safe fork PR cannot be created for verification, inspect/evaluate the event condition and record that live fork-event verification remains an administrative post-implementation check rather than claiming it passed.

## 12. Rollback and Failure Strategy

- Workflow/script changes are repository-only and can be reverted as one CI foundation change without reverting product code or data.
- A failing CI rollout does not authorize weakening tests, guards or branch protection.
- If the CI database identity is ambiguous, disable/withhold the guarded secret and stop DB jobs; do not point them at another environment.
- If migration preparation fails, preserve the failure, do not run tests and do not use `db push` as a workaround.
- If remote TEST DB availability is unstable, keep secret-free checks required and mark guarded verification blocked; do not convert DB failures to success.
- If Playwright artifact handling exposes sensitive data, stop publication, remove the unsafe artifact and correct the artifact scope before enabling required checks.
- CD remains unaffected because no deployment workflow is introduced.

## 13. Implementation Order

1. After HUMAN PLAN approval, synchronize minimal CI documentation/status and record the Node.js 22/tooling boundary.
2. Add CI-safe backend script separation and verify DB-independent execution cannot reach a database.
3. Add CI-safe frontend browser commands and environment inheritance while preserving local `.env.test` workflows.
4. Add the secret-free workflow, cache/runtime setup and browser failure artifacts; verify all three jobs.
5. Add the guarded workflow with trust gate, whole-workflow concurrency, guarded migration/backend test job, dependent combined browser job, cleanup and summary.
6. Obtain HUMAN database-owner confirmation and configure the CI-exclusive database/secret outside the repository.
7. Verify trusted, fork-safe and failure behavior without touching Main/Preview/Production.
8. Run formal CI Foundation TEST/REVIEW, then update status only after HUMAN approval. CD remains a separate future workflow.

## 14. Risks, Prerequisites and Boundaries

- **Blocking prerequisite for guarded execution:** a human-provisioned, CI-exclusive PostgreSQL TEST database and repository secret `CI_TEST_DATABASE_URL`.
- **Administrative prerequisite:** GitHub Actions must be enabled; branch-protection check selection occurs only after stable check names appear.
- The repository cannot fully prove fork-secret behavior without an actual fork event; static policy and safe conditions remain mandatory.
- Remote DB latency can increase runtime and cost. Serialization favors correctness over speed.
- Two workflows avoid holding secret-free jobs behind the DB concurrency queue while giving destructive operations one atomic serialized lifecycle.
- The non-secret placeholder `DATABASE_URL` is permitted only for Prisma client generation and must be unreachable; no DB command may run in that job.
- Deployment-provider inconsistencies remain explicitly deferred and block CD design, not CI implementation.
- No new npm dependency, Docker service, schema/API/UI change or production behavior is planned.

## 15. Open Questions

None block PLAN approval. Guarded implementation and live verification cannot complete until the external CI database and secret prerequisites are provided and human-confirmed.

## Approval Gate

```text
SPEC STATUS: APPROVED
PLAN STATUS: APPROVED
NEXT ALLOWED STAGE: TASK
TASK / IMPLEMENTATION AUTHORIZED: NO
```
