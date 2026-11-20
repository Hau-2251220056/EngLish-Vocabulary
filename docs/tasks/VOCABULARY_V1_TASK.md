# TASKS: Vocabulary V1

**Source SPEC:** `docs/specs/VOCABULARY_V1_SPEC.md` (`APPROVED`)

**Source PLAN:** `docs/plans/VOCABULARY_V1_PLAN.md` (`APPROVED`)

**TASK status:** `COMPLETE`

**Human approval:** `APPROVED` for the Vocabulary V1 task sequence.

**Implementation authorized:** `NO` — all approved Vocabulary V1 tasks are complete; any new Vocabulary work requires its own approved workflow.

## 1. Overview and Feature Status

Vocabulary V1 implements an ADMIN-only `VOCABULARY → VOCABULARY_MEANING → VOCABULARY_EXAMPLE` aggregate. It starts from the current `TODO` Vocabulary status and must not create a public catalog, Topic relation, Vocabulary Set, learning state, granular child API or future-domain data.

The tasks below follow the approved PLAN order. Formal TEST and REVIEW remain separate quality gates; passing task-level checks does not mark Vocabulary V1 done.

## 2. Dependency Graph

```text
TASK-026 — Approved contract documentation synchronization
    ↓
TASK-027 — Prisma aggregate schema, migration and TEST DB verification
    ↓
TASK-028 — ADMIN Vocabulary aggregate backend
    ↓
TASK-029 — Backend/database/API/security tests and Auth regression
    ↓
TASK-030 — ADMIN frontend service, route and navigation
    ↓
TASK-031 — ADMIN Vocabulary management UI
    ↓
TASK-032 — Frontend/browser/accessibility and regression verification
    ↓
TASK-033 — Formal TEST/REVIEW and closure preparation
```

No tasks are designated parallel: each downstream unit depends on a verified contract or implementation boundary from its predecessor.

## 3. Acceptance-Criteria Mapping

| SPEC AC | Primary task(s) |
|---|---|
| AC-01–AC-02 | TASK-027, TASK-029 |
| AC-03–AC-05 | TASK-028, TASK-029 |
| AC-06 | TASK-028, TASK-029 |
| AC-07 | TASK-028, TASK-030, TASK-031, TASK-032 |
| AC-08–AC-09 | TASK-028, TASK-029, TASK-031, TASK-032 |
| AC-10 | TASK-027, TASK-028, TASK-029, TASK-031, TASK-032 |
| AC-11–AC-12 | TASK-028, TASK-029, TASK-030, TASK-032 |
| AC-13 | TASK-030, TASK-031, TASK-032 |
| AC-14 | TASK-026 through TASK-033 scope gates |

## 4. Tasks

### TASK-026 — Synchronize Approved Vocabulary V1 Documentation Contract

**Objective:** Replace only the obsolete Vocabulary contract drafts with the approved ADMIN-only V1 contract before implementation.

**Dependencies:** Human approval of this TASK document.

**Expected files / areas:** `docs/DATABASE.md`, `docs/API_SPEC.md`, `docs/UI_UX_SPEC.md`, `docs/FEATURE_STATUS.md`; `docs/ARCHITECTURE.md` only if its generic endpoint list remains an active contract reference.

**In scope:** Document UUID aggregate entities, Meaning-only nullable string/text CEFR with explicit `CHECK`, `LOWER(word)` uniqueness, owned-child semantics, ADMIN-only routes/UI, no granular child endpoints and relevant `PLANNED` feature statuses.

**Out of scope:** Schema/source/test changes; Topic/Vocabulary Set/learning documentation changes; marking implementation or tests complete.

**Implementation requirements:** Reconcile numeric/public/difficulty-level/top-level-Example legacy descriptions with the approved SPEC/PLAN. Preserve Topic → Vocabulary Set → Vocabulary and all deferred external-reference policies.

**Completion criteria:** Documentation describes one consistent V1 contract and only covered Vocabulary statuses advance to `PLANNED`.

**Verification:** Documentation review, targeted text search for obsolete V1 conflicts, `git diff --check`, secret/scope check.

**Mapped AC:** AC-01–AC-05, AC-07–AC-14.

**Completion gate/status:** `COMPLETE` — approved contract synchronization completed; human review is required before TASK-027.

### TASK-027 — Materialize Vocabulary Aggregate and Verify Dedicated TEST DB Migration

**Objective:** Add the approved three-model Prisma aggregate, migration constraints and generated client; prove them only against the dedicated TEST DB.

**Dependencies:** TASK-026 complete.

**Expected files / areas:** `backend/prisma/schema.prisma`, one new migration under `backend/prisma/migrations/`, generated Prisma client artifacts if normal project workflow updates them, and focused database verification support only if required by existing test conventions.

**In scope:** UUID models; Vocabulary → Meaning → Example owned foreign keys; owned-child cascade only; approved nullable fields/timestamps; `LOWER(word)` functional unique index; nullable string/text Meaning CEFR with migration-managed `CHECK` allowing `A1/A2/B1/B2/C1/C2/NULL`.

**Out of scope:** CEFR enum, `difficulty_level`, direct Topic relation, Set/Set Item, external references, data seed/mock, Preview/Production migration.

**Implementation requirements:** Generate one focused migration; preserve existing models; use cascade solely for owned Meaning/Example deletion; regenerate client under existing conventions. Apply/verify only with `NODE_ENV=test`, dedicated `TEST_DATABASE_URL` and explicit reset authorization where required.

**Completion criteria:** Prisma generation and dedicated TEST DB migration succeed; database enforces UUID relations, owned deletion, CEFR `CHECK` and case-insensitive word uniqueness.

**Verification:** Migration/status inspection on TEST DB; focused schema/constraint assertions; `git diff --check`; confirm no non-test database target.

**Mapped AC:** AC-01, AC-02, AC-04, AC-05, AC-10, AC-14.

**Completion gate/status:** `COMPLETE` — migration, Prisma client generation and dedicated TEST DB constraint/cascade verification passed; human review is required before TASK-028.

### TASK-028 — Implement ADMIN Vocabulary Aggregate Backend

**Objective:** Provide the transaction-safe ADMIN aggregate API using existing route, middleware, controller, service and repository architecture.

**Dependencies:** TASK-027 complete.

**Expected files / areas:** new Vocabulary repository/service/controller/router modules in current `backend/src` convention; `backend/src/create-app.js`; no Authentication middleware change.

**In scope:** ADMIN list summary/detail, create, PATCH and delete; UUID/body/field validation; word trim/uniqueness; CEFR validation; known safe errors; transaction-safe graph replacement; stable child-ID ownership validation; final-handler forwarding.

**Out of scope:** Public/User routes, child CRUD endpoints, new roles/middleware, Topic/Set/learning behavior, changes to Authentication error contracts.

**Implementation requirements:** Mount only `/api/admin/vocabulary`; apply existing authentication then `ADMIN` middleware to every endpoint. Create needs one-or-more Meanings. PATCH accepts only approved fields; supplied `meanings` is complete replacement; retained IDs must belong to the addressed aggregate; omitted supplied children delete intentionally. Delete only removes the aggregate and owned children. Translate persistence collisions safely and never expose raw database details.

**Completion criteria:** Each endpoint follows the approved request/envelope/status contract and preserves atomicity/ownership rules.

**Verification:** Focused service/controller/router checks, manual HTTP harness only against TEST/local environment, lint/diff/secret checks; no claim of formal test completion.

**Mapped AC:** AC-03–AC-06, AC-08–AC-12, AC-14.

**Completion gate/status:** `COMPLETE` — ADMIN aggregate backend and focused implementation checks passed; human review is required before TASK-029.

### TASK-029 — Add Vocabulary Database, Backend, API and Authorization Coverage

**Objective:** Prove the aggregate database, transaction, contract and security behavior and protect existing Authentication composition.

**Dependencies:** TASK-028 complete.

**Expected files / areas:** new focused Vocabulary backend test file(s) under `backend/test/vocabulary/`; existing test helpers only if extension is necessary; no production source changes beyond testability already approved.

**In scope:** Model/migration constraints; validation; duplicates; full graph reads; nested replacement/rollback; owned deletion; API success/errors; unauthenticated/USER/forged authority; safe unexpected error; Authentication regression.

**Out of scope:** Browser UI coverage, Preview, public catalog, future external-reference deletion tests or any destructive run outside the dedicated TEST DB.

**Implementation requirements:** Verify CEFR `CHECK` and `LOWER(word)` at database boundary, including collision translation. Prove malformed/cross-aggregate/duplicate child IDs are rejected without partial write; prove valid retained IDs and no-ID nodes behave as approved. Confirm no granular child route exists and no future models/data are introduced.

**Completion criteria:** Approved backend/database/API/authorization cases pass on the dedicated TEST DB; existing Authentication suite remains green.

**Verification:** Focused Vocabulary suite, backend Authentication suite, dedicated TEST DB targeted cleanup evidence, `git diff --check` and secret/scope checks.

**Mapped AC:** AC-01–AC-12, AC-14.

**Completion gate/status:** `COMPLETE` — dedicated TEST DB database/backend/API/security coverage passed; Authentication and Topic regressions passed. Human review is required before TASK-030.

### TASK-030 — Add ADMIN Frontend Vocabulary Service, Route and Navigation

**Objective:** Connect the existing authenticated application to the approved ADMIN-only Vocabulary API without changing public/User behavior.

**Dependencies:** TASK-029 complete.

**Expected files / areas:** `frontend/src/services/` Vocabulary service/error mapping; `frontend/src/app-router.jsx`; `frontend/src/auth/ui/authenticated-shell.jsx`; focused CSS only as required by the implemented route.

**In scope:** Credential-aware same-origin service calls, ADMIN error mapping, `/admin/vocabulary` route under existing guards/shell, and conditional ADMIN navigation entry.

**Out of scope:** Public Vocabulary pages/layout, USER nav, Auth-store/provider changes, new dependency, Topic refactor.

**Implementation requirements:** Reuse `httpClient`, `ProtectedRoute`, `AdminRoute`, `AuthenticatedShell` and existing role state. USER route access redirects to the existing safe authenticated destination; backend remains the authorization boundary.

**Completion criteria:** Only ADMIN sees/reaches the real management route and the frontend service conforms to the approved aggregate API/error contract.

**Verification:** Service unit tests/error mapping, route/nav role checks, existing Auth/App Layout regression subset, lint/build as applicable.

**Mapped AC:** AC-07, AC-11–AC-13, AC-14.

**Completion gate/status:** `COMPLETE` — focused service, route/navigation composition and Auth/App Layout regression checks passed. Human review is required before TASK-031.

### TASK-031 — Implement ADMIN Vocabulary Management Aggregate UI

**Objective:** Deliver the ADMIN list/detail/create/edit/delete experience for the complete Vocabulary aggregate.

**Dependencies:** TASK-030 complete.

**Expected files / areas:** new Vocabulary page and focused components under the current frontend feature convention; `frontend/src/index.css` only for required responsive/accessibility presentation.

**In scope:** Unpaginated list/client-side word search; full detail; create/edit aggregate form; nested Meaning/Example editor; complete aggregate load before edit; validation/error/success states; delete confirmation.

**Out of scope:** Public/User catalog, granular child screens/routes, new state/form library, UI redesign, Topic/App Layout refactor, learning/pronunciation practice.

**Implementation requirements:** Edit only after fetching full aggregate detail, retain stable child IDs, submit full desired `meanings` and each retained Meaning's full desired `examples`, and make omission visibly intentional through remove controls. Prevent removing the final Meaning. Use accessible labels/error associations, keyboard controls, focus restoration and duplicate-submit protection.

**Completion criteria:** An ADMIN can manage valid aggregates end-to-end while failed mutations preserve actionable state; list search remains client-side and no public/User functionality appears.

**Verification:** Focused UI/component checks; manual local TEST-backed flow as appropriate; responsive/accessibility smoke checks; lint/diff/secret/scope checks.

**Mapped AC:** AC-03, AC-05–AC-10, AC-12–AC-14.

**Completion gate/status:** `PENDING` until the approved UI flows and state boundaries are implemented.

### TASK-032 — Add Vocabulary Browser, Accessibility and Cross-Feature Regression Coverage

**Objective:** Automate browser-level Vocabulary behavior and verify it does not regress Authentication, App Layout or Topic flows.

**Dependencies:** TASK-031 complete.

**Expected files / areas:** focused frontend unit tests; new/extended Vocabulary real-stack browser test; existing Auth/App Layout/Topic test commands and fixtures only as needed.

**In scope:** List/detail/load/search states; full aggregate editing contract; nested add/remove and stable-ID payloads; ADMIN/USER routing; confirmation; accessibility/focus/responsive checks; regression commands.

**Out of scope:** Preview deployment verification, Production, external services, future feature coverage unrelated to Vocabulary V1.

**Implementation requirements:** Real-stack fixtures use unique identifiers, target only the dedicated TEST DB, delete only their created owned data/sessions/users, and prove no residual Vocabulary fixtures remain. Include no-public-catalog and no-granular-endpoint scope assertions where practical.

**Completion criteria:** Browser, accessibility, responsive and regression coverage passes with isolated fixture cleanup and no Auth/App Layout/Topic regression.

**Verification:** Focused Vocabulary browser suite, frontend unit suite, Topic regression, Auth/App Layout suites, lint, production build, TEST DB cleanup verification and `git diff --check`.

**Mapped AC:** AC-03, AC-05–AC-14.

**Completion gate/status:** `PENDING` until automated frontend and cross-feature evidence passes.

### TASK-033 — Formal Vocabulary V1 TEST, REVIEW and Closure Preparation

**Objective:** Execute the repository’s formal TEST and REVIEW workflow after implementation tasks, then prepare evidence for human closure without prematurely marking the feature done.

**Dependencies:** TASK-032 complete.

**Expected files / areas:** formal test/review records and status documentation only if their outcomes and human approvals authorize updates; no unrelated code or deployment work.

**In scope:** SPEC/PLAN/TASK traceability audit, scope/security review, full required test matrix, documentation consistency, fixture cleanup confirmation and review findings resolution loop if needed.

**Out of scope:** Automatic human approval, Production/Preview deployment, future deferred feature implementation, marking `DONE` before TEST/REVIEW/human approval.

**Implementation requirements:** Treat task-level tests as inputs to, not replacements for, formal TEST and REVIEW. If a finding affects requirements/design, return to SPEC/PLAN/TASK as appropriate; if code changes are needed, return to implementation/test before review approval.

**Completion criteria:** Formal TEST reports PASS and formal REVIEW reports APPROVE with no unresolved blocker; only then may a separately authorized closure update `FEATURE_STATUS.md` to DONE.

**Verification:** Full documented quality gate, diff/secret/scope checks, dedicated TEST DB cleanup proof and human review/closure evidence.

**Mapped AC:** AC-01–AC-14.

**Completion gate/status:** `COMPLETE` — formal TEST passed, formal REVIEW approved, and human closure authorization was received; `docs/FEATURE_STATUS.md` now records Vocabulary V1 as `DONE`.

## 5. Execution and Scope Guards

- Execute tasks strictly in dependency order; do not begin TASK-026 until this TASK document has human approval.
- TASK-026 is the documentation synchronization gate. No schema, migration, backend or frontend implementation begins before it completes.
- Every database-dependent task uses the dedicated TEST DB safety mechanism. Preview and Production migrations, data writes and deployments are outside this task set.
- Future external Vocabulary references remain deferred. No task may introduce Topic linkage, Vocabulary Set/Set Item, learning state, SRS, Quiz, XP/Streak, practice, AI or granular child routes.
- Task completion is not feature completion. Formal TEST, REVIEW and human closure are required after implementation.

## Approval Gate

```text
SPEC STATUS: APPROVED
PLAN STATUS: APPROVED
TASK STATUS: COMPLETE
TASK-033: COMPLETE — formal TEST PASS, formal REVIEW APPROVE, human closure authorized
NEXT ALLOWED STAGE: VOCABULARY V1 CLOSED
IMPLEMENTATION AUTHORIZED: NO — any new Vocabulary scope requires a new approved workflow
```
