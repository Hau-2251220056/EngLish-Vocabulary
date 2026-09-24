# TASKS: CI Foundation

**Source SPEC:** `docs/specs/CI_FOUNDATION_SPEC.md` (`APPROVED`)

**Source PLAN:** `docs/plans/CI_FOUNDATION_PLAN.md` (`APPROVED`)

**TASK status:** `APPROVED`

**Human approval:** `APPROVED`; implementation is authorized only in task order and within the active task boundary.

**Implementation authorized:** `YES — only for the current approved task`

## 1. Overview

These tasks implement the approved CI Foundation without changing application behavior, schema, API or deployment architecture. Repository work is separated from the HUMAN-controlled CI-exclusive database and GitHub secret prerequisite. Destructive verification cannot begin until that external checkpoint is explicitly approved.

Task identifiers continue the repository sequence after Flashcard / Learning `TASK-054`.

## 2. Scope Boundary

### Included

- CI documentation and Node.js 22 baseline.
- CI-safe backend/frontend test commands that preserve local `.env.test` workflows.
- Secret-free GitHub Actions checks.
- Trusted guarded integration workflow with whole-workflow serialization.
- HUMAN-controlled CI database/secret checkpoint.
- Secret-free and guarded workflow verification.
- Formal TEST, REVIEW and closure preparation.

### Deferred / Prohibited

- CD or deployment.
- Main, Preview or Production database access or migrations.
- Docker or CI service containers.
- Vercel/Render restructuring.
- Coverage thresholds.
- Unrelated dependency/security automation.
- Product source, Prisma schema, migration, API or UI changes.

## 3. Dependency Graph

```text
TASK-055  Documentation and Node baseline
   ↓
TASK-056  Backend CI-safe command separation
   ↓
TASK-057  Frontend/Playwright CI-safe commands
   ├───────────────┐
   ↓               ↓
TASK-058          TASK-059
Secret-free CI    Guarded CI repository workflow
   ↓               ↓
TASK-060           TASK-061 [HUMAN CHECKPOINT]
Secret-free test   CI-exclusive DB + secret configuration
   └───────┬───────┘
           ↓
        TASK-062
   Guarded live verification
           ↓
        TASK-063
 Formal TEST / REVIEW / closure preparation
```

`TASK-058` and `TASK-059` may proceed independently after `TASK-057`. `TASK-060` does not require external secrets. `TASK-062` is blocked until both repository workflows and the HUMAN external checkpoint are complete.

## 4. Acceptance-Criteria Traceability

| SPEC acceptance criteria | Tasks |
|---|---|
| AC-01 | TASK-058, TASK-059, TASK-060, TASK-062, TASK-063 |
| AC-02 | TASK-055, TASK-056–TASK-060, TASK-063 |
| AC-03 | TASK-058, TASK-060, TASK-063 |
| AC-04 | TASK-056, TASK-060, TASK-063 |
| AC-05 | TASK-057, TASK-058, TASK-060, TASK-063 |
| AC-06 | TASK-056, TASK-059, TASK-062, TASK-063 |
| AC-07–AC-09 | TASK-056, TASK-059, TASK-061, TASK-062, TASK-063 |
| AC-10 | TASK-059, TASK-062, TASK-063 |
| AC-11 | TASK-059–TASK-063 |
| AC-12 | TASK-057, TASK-059, TASK-062, TASK-063 |
| AC-13 | TASK-056, TASK-057, TASK-060, TASK-062, TASK-063 |
| AC-14 | TASK-058–TASK-063 |
| AC-15 | TASK-055, TASK-058–TASK-063 |
| AC-16–AC-17 | TASK-055–TASK-063 |

## TASK-055 — Synchronize CI Documentation and Node.js 22 Baseline

**Objective:** Record the approved CI boundary and establish the repository runtime baseline before scripts or workflows are introduced.

**Dependencies:** Approved SPEC, PLAN and TASK decomposition.

**Expected files / areas:**

- `.nvmrc`
- `docs/CI.md`
- `docs/ARCHITECTURE.md`
- `docs/FEATURE_STATUS.md`
- `backend/test/README.md`

**In scope:**

- Add the Node.js 22 declaration.
- Document CI triggers, two-workflow structure, stable check names, trusted/fork behavior, guarded TEST DB rules, Prisma migration boundary, failure/artifact behavior and deferred CD.
- Add CI Foundation status as `IN_PROGRESS` only when implementation begins.
- Preserve deployment-provider documentation without attempting reconciliation.

**Out of scope:** Workflow files, package scripts, database provisioning, secrets, deployment configuration.

**Implementation requirements:**

- Documentation must name `CI_TEST_DATABASE_URL` but never define a value.
- Document that Main/Preview/Production and developer-shared TEST databases are prohibited.
- Record that GitHub Actions/branch settings are external administration.

**Verification:**

- Documentation consistency/search for conflicting CI DB or deployment claims.
- Confirm `.nvmrc` specifies Node.js 22.
- `git diff --check`, secret and scope checks.

**Mapped AC:** AC-02, AC-15, AC-16, AC-17.

**Completion gate/status:** `COMPLETE` — Node.js 22 baseline and CI documentation foundation were added; lightweight documentation, whitespace, secret and scope checks passed. HUMAN review is required before TASK-056.

## TASK-056 — Add Backend CI-Safe Test Command Separation

**Objective:** Provide explicit DB-independent and complete guarded backend commands without weakening current local `.env.test` behavior.

**Dependencies:** TASK-055 complete and HUMAN reviewed.

**Expected files / areas:**

- `backend/package.json`
- Existing backend test scripts/helpers only if a narrowly scoped wrapper is necessary.
- `backend/test/README.md`

**In scope:**

- Add `test:unit:ci`, `test:db:prepare:ci` and `test:integration:ci` per approved PLAN.
- DB-independent command includes only Auth component/password/deferred/Vercel-entry coverage.
- Complete DB integration command explicitly includes Auth HTTP, Topic, Vocabulary, Vocabulary Set and Learning suites and enforces sequential execution.
- CI commands consume inherited environment variables instead of `.env.test`.
- Preserve existing local commands.

**Out of scope:** Workflow YAML, test weakening, test behavior changes, schema/migrations, DB provisioning.

**Implementation requirements:**

- `test:db:prepare:ci` must invoke the existing guarded preparation script.
- No DB test or migration command may bypass `configureTestEnvironment()`.
- DB-independent execution must remain successful with an intentionally unreachable generation-only `DATABASE_URL` and no TEST DB secret.
- Underlying exit codes must propagate.

**Verification:**

- Run `test:unit:ci` with no reachable DB and verify exact results/no connection attempt.
- Inspect command membership to prove all DB suites are present once.
- Verify missing guarded DB environment fails closed before DB work using a non-destructive guard check; do not access a real DB during this task.
- `git diff --check`, secret and scope checks.

**Mapped AC:** AC-02, AC-04, AC-06–AC-09, AC-13, AC-16, AC-17.

**Completion gate/status:** `COMPLETE` — DB-independent and complete sequential DB-backed CI commands were added while local `.env.test` commands and all existing guards remained unchanged. DB-independent tests and fail-closed guard verification passed; no DB-backed suite was executed. HUMAN review is required before TASK-057.

## TASK-057 — Add Frontend and Playwright CI-Safe Commands

**Objective:** Make DB-independent and guarded browser projects runnable from inherited CI environment while preserving local commands and test semantics.

**Dependencies:** TASK-056 complete and HUMAN reviewed.

**Expected files / areas:**

- `frontend/package.json`
- `frontend/playwright.integration.config.js`
- Existing feature-specific real-stack Playwright config files that embed `backend/.env.test` in child server commands.

**In scope:**

- Add `test:browser:ci` and `test:integration:ci`.
- Change backend web-server commands to inherit the already established parent environment and invoke the existing guarded integration server directly.
- Preserve local scripts that load `.env.test` before invoking Playwright.
- Preserve existing projects, ports, one-worker integration behavior, assertions, screenshots and traces.

**Out of scope:** Browser test redesign, application code, backend/schema/API changes, workflow YAML.

**Implementation requirements:**

- DB-independent browser command must need no DB secret.
- Real-stack child process must fail closed through the existing server guard.
- No environment or credential file is generated.
- Only latency-justified infrastructure timeout adjustment is permitted; business assertions/retry semantics remain unchanged.

**Verification:**

- Run focused command/config validation.
- Run DB-independent browser smoke once.
- Confirm guarded real-stack command refuses missing TEST environment before DB access; do not run it against a DB yet.
- Confirm existing local invocation path remains structurally valid.
- ESLint/config syntax, `git diff --check`, secret and scope checks.

**Mapped AC:** AC-02, AC-05, AC-12, AC-13, AC-16, AC-17.

**Completion gate/status:** `COMPLETE` — CI-safe browser commands and inherited-environment real-stack server configuration were added while existing local `.env.test` entry points, guarded global setup/server behavior and browser semantics remained intact. Focused config, mocked browser and fail-closed guard verification passed. HUMAN review is required before workflow creation.

## TASK-058 — Implement Secret-Free CI Workflow

**Objective:** Add the universally safe CI workflow for frontend quality, backend unit and mocked browser smoke checks.

**Dependencies:** TASK-057 complete and HUMAN reviewed.

**Expected files / areas:**

- `.github/workflows/ci.yml`

**In scope:**

- Configure PR-to-`dev`, push-to-`dev` and manual triggers.
- Add stable jobs/checks: `Frontend Quality`, `Backend Unit`, `Frontend Browser Smoke`.
- Configure Node.js 22, lockfile-specific npm caches and `npm ci`.
- Use an unreachable non-secret placeholder only for Prisma generation in Backend Unit.
- Install Chromium for browser smoke and upload safe failure artifacts for 7 days.
- Use least-privilege read-only repository permissions.

**Out of scope:** Any database secret, guarded integration, deployment, Docker, branch-protection administration.

**Implementation requirements:**

- No `pull_request_target`.
- No database-dependent Prisma command.
- No `node_modules` or generated Prisma cache.
- Artifact upload must not mask test failure or include environment/session material.
- Every executed failure remains non-zero.

**Verification:**

- Validate workflow syntax, triggers, permissions, action inputs and secret absence.
- Run underlying frontend lint/unit/build, backend unit and browser smoke commands.
- Verify a controlled command failure would propagate without modifying production/test behavior.
- Inspect artifact paths and exclusions.
- `git diff --check`, secret, deferred-scope and no-deployment checks.

**Mapped AC:** AC-01–AC-05, AC-14–AC-17.

**Completion gate/status:** `COMPLETE` — the secret-free `CI` workflow now defines the approved `Frontend Quality`, `Backend Unit` and `Frontend Browser Smoke` checks with Node.js 22, lockfile-scoped npm caching, deterministic installation and seven-day failure artifacts. Static/local verification passed with no database secret or access. HUMAN review is required before TASK-059.

## TASK-059 — Implement Guarded Integration Workflow Repository Configuration

**Objective:** Add the trusted, serialized guarded integration workflow without yet provisioning or using external infrastructure.

**Dependencies:** TASK-057 complete and HUMAN reviewed. May proceed independently of TASK-058.

**Expected files / areas:**

- `.github/workflows/ci-integration.yml`

**In scope:**

- Configure the same approved triggers.
- Add Trust Gate, Backend DB Integration, Real Stack Browser and Summary jobs/checks.
- Implement same-repository PR/push/manual trust classification and explicit fork skip behavior.
- Add workflow-level `elvocab-ci-test-db` concurrency with `cancel-in-progress: false`.
- Order backend guarded migration/integration/cleanup before combined single-worker real-stack browser/cleanup.
- Map `CI_TEST_DATABASE_URL` only inside trusted guarded jobs.
- Add 7-day failure artifact handling and always-run summary/cleanup behavior.

**Out of scope:** Creating/configuring the database or secret, executing DB jobs, deployment, branch-protection settings.

**Implementation requirements:**

- No `pull_request_target` or secret exposure to fork code.
- Trusted missing-secret condition must fail closed, not skip or fall back.
- Use existing guarded preparation/server entry points; no raw DB-dependent Prisma CLI.
- Backend DB Integration and Real Stack Browser cannot overlap, within or across workflow runs.
- Summary must distinguish `PASS`, `FAIL` and `SKIPPED_FORK`.

**Verification:**

- Static workflow validation and event-condition review.
- Prove dependency ordering and workflow-wide concurrency from configuration.
- Search for raw Prisma migration/reset commands, secret interpolation in commands, Docker/services, deployment actions and write permissions.
- Verify artifact and cleanup conditions do not mask failures.
- `git diff --check`, secret and scope checks.

**Mapped AC:** AC-01, AC-02, AC-06–AC-16, AC-17.

**Completion gate/status:** `COMPLETE` — the guarded integration workflow now provides trust classification, secret-gated sequential backend/browser jobs, workflow-wide non-cancelling concurrency, guarded migration preparation, always-run cleanup, seven-day failure artifacts and an explicit PASS/FAIL/SKIPPED_FORK summary. Secret-free structural verification passed; no guarded job was executed. HUMAN review is required before external setup.

## TASK-060 — Verify Secret-Free CI Foundation

**Objective:** Produce authoritative evidence for all checks that require no external database or GitHub secret.

**Dependencies:** TASK-058 complete; TASK-056 and TASK-057 already complete.

**Expected files / areas:** Verification evidence/status documentation only; implementation fixes limited to concrete TASK-055–058 defects.

**In scope:**

- Execute frontend lint, complete unit tests and production build through planned CI commands.
- Execute DB-independent backend tests with an unreachable generation-only placeholder.
- Execute DB-independent Auth/App Layout Playwright smoke.
- Verify Node/cache/install behavior, workflow syntax, artifact paths, failure propagation and secret-free fork eligibility.

**Out of scope:** Guarded DB tests, real-stack browser, database/secret provisioning, weakening tests.

**Implementation requirements:**

- Fix only reproducible CI Foundation defects within approved repository scope.
- Do not claim guarded or live GitHub event evidence.
- Report exact PASS/FAIL/TODO/SKIPPED/NOT RUN totals.

**Verification:**

- `git diff --check`.
- Secret/sensitive-data and artifact-scope check.
- Confirm no DB connection, schema/source change, deployment or external write.

**Mapped AC:** AC-01–AC-05, AC-11, AC-13–AC-17.

**Completion gate/status:** `COMPLETE` — authoritative GitHub Actions evidence passed for Frontend Quality, Backend Unit and Frontend Browser Smoke after the responsive Auth test synchronization defect was corrected. Missing CI database configuration remained fail-safe with no database fallback or DB command. HUMAN review approved TASK-060.

## TASK-061 — HUMAN Checkpoint: Provision CI-Exclusive TEST DB and Configure Secret

**Objective:** Establish the external infrastructure identity and authorization required for guarded CI without delegating credentials or database ownership decisions to the agent.

**Dependencies:** TASK-059 complete and HUMAN reviewed.

**Owner:** HUMAN database/repository owner only.

**External areas:**

- CI-exclusive PostgreSQL database created outside the repository.
- GitHub Actions repository/environment secret `CI_TEST_DATABASE_URL`.
- GitHub Actions availability/settings.

**In scope:**

- HUMAN confirms the database is dedicated exclusively to this repository's CI and is not Main, Preview, Production, development or developer-shared TEST.
- HUMAN configures the secret value without exposing it to chat, source, logs or artifacts.
- HUMAN confirms destructive reset/migration verification is authorized for that database.

**Out of scope:** Agent provisioning, reading/changing credentials, weakening guards, branch protection, deployment.

**Checkpoint evidence:**

- Explicit HUMAN database-owner confirmation.
- Explicit HUMAN confirmation that `CI_TEST_DATABASE_URL` is configured for the guarded workflow.
- No secret value, URI component or credential is returned or recorded.

**Mapped AC:** AC-07–AC-11, AC-15–AC-17.

**Completion gate/status:** `COMPLETE — HUMAN CONTROLLED`. The HUMAN database/repository owner confirmed that the dedicated disposable PostgreSQL project `EngLish Vocabulary CI` is reserved exclusively for this repository's GitHub Actions, destructive CI reset/migration verification is authorized there, and repository secret `CI_TEST_DATABASE_URL` is configured without exposing its value. No database command was run during this checkpoint. HUMAN review is required before TASK-062.

## TASK-062 — Verify Guarded Integration and Trust Behavior

**Objective:** Execute and verify the complete guarded backend and real-stack CI lifecycle against the confirmed CI-exclusive TEST database.

**Dependencies:** TASK-059, TASK-060 and HUMAN TASK-061 complete.

**Expected files / areas:** Workflow/test evidence and minimal CI Foundation fixes only; no product behavior changes.

**In scope:**

- Verify trusted environment guard and migration preparation.
- Run complete sequential backend integration and record exact Auth/Topic/Vocabulary/Vocabulary Set/Learning results.
- Verify cleanup, then run combined single-worker real-stack Playwright and record exact cross-feature totals.
- Verify final cleanup and no orphan processes.
- Verify trusted same-repo/push/manual behavior and fork skip condition to the extent safely available.
- Verify missing/invalid guard fails before DB access without printing secrets.

**Out of scope:** Main/Preview/Production, developer TEST DB, CD, Docker, product changes, test weakening.

**Implementation requirements:**

- One guarded workflow run owns the serialized migration → backend → browser → cleanup lifecycle.
- Backend DB Integration must complete before Real Stack Browser starts.
- Cross-run concurrency uses `cancel-in-progress: false`.
- If identity becomes ambiguous, stop immediately without destructive work.
- If live fork-event evidence is unavailable, report it accurately as an administrative verification item; do not fabricate PASS.

**Verification:**

- Guard, migration, backend suite, browser suite, cleanup and artifact results.
- Confirm all DB writes targeted only the CI-exclusive TEST database.
- Confirm workflow/log/artifacts contain no secret or session material.
- Confirm Main/Preview/Production and manual TEST were untouched.
- `git diff --check` and scope check.

**Mapped AC:** AC-01, AC-02, AC-06–AC-15, AC-16, AC-17.

**Completion gate/status:** `NOT STARTED` — must PASS or accurately report infrastructure BLOCKED; HUMAN review required before TASK-063.

## TASK-063 — Formal CI Foundation TEST, REVIEW and Closure Preparation

**Objective:** Assess all approved acceptance criteria, review security/scope and prepare—not prematurely claim—CI Foundation closure.

**Dependencies:** TASK-055 through TASK-062 complete and HUMAN reviewed, including the HUMAN external checkpoint.

**Expected files / areas:**

- `docs/CI.md`
- `docs/FEATURE_STATUS.md`
- `docs/tasks/CI_FOUNDATION_TASK.md`
- Formal evidence/status documentation required by repo convention.

**In scope:**

- Trace AC-01 through AC-17 to implementation and authoritative evidence.
- Formal TEST result for secret-free and guarded workflows.
- Formal REVIEW of trust boundaries, DB isolation, serialization, failure semantics, artifacts, secrets, scope and regression safety.
- Record any live event/branch-protection administrative item accurately.
- Prepare closure status; mark DONE only after TEST PASS, REVIEW APPROVE and HUMAN closure authorization.

**Out of scope:** New implementation, CD, branch merge, deployment, production migrations, next feature.

**Verification:**

- Documentation/workflow/script consistency.
- Exact evidence totals and no unresolved blocker.
- Clean secret, environment, artifact, diff and scope checks.
- Confirm no deployment or production database action occurred.

**Mapped AC:** AC-01 through AC-17.

**Completion gate/status:** `NOT STARTED` — formal TEST/REVIEW and closure require HUMAN approval.

## 5. Execution and Safety Notes

- Execute tasks in dependency order and stop after each task for HUMAN review.
- TASK-061 is an external HUMAN checkpoint. The agent must never provision the database, configure/read the secret or infer authorization.
- TASK-062 must not begin without explicit TASK-061 completion evidence.
- Do not run backend DB integration and Real Stack Browser concurrently when they share the CI database.
- Do not cancel an active guarded workflow to start another; `cancel-in-progress: false` is mandatory.
- Never substitute Main, Preview, Production, development or manual TEST databases when CI infrastructure is unavailable.
- Formal TEST/REVIEW does not retroactively authorize CD, deployment or production migrations.

## Approval Gate

```text
SPEC STATUS: APPROVED
PLAN STATUS: APPROVED
TASK STATUS: APPROVED
TASK-055: COMPLETE
TASK-056: COMPLETE
TASK-057: COMPLETE
TASK-058: COMPLETE
TASK-059: COMPLETE
NEXT ALLOWED STAGE: HUMAN TASK-059 REVIEW
IMPLEMENTATION AUTHORIZED: YES — only according to the approved task sequence and active task boundary
```
