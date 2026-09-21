# TASKS: Topic V1

## Closure Record

**Closure status:** `COMPLETE`

- TASK-019: `COMPLETE`
- TASK-020: `COMPLETE`
- TASK-021: `PASS`
- TASK-022: `COMPLETE`
- TASK-023: `COMPLETE`
- TASK-024: `PASS`
- TASK-025: `COMPLETE`
- Formal TEST: `PASS`
- Formal REVIEW: `APPROVE`
- Acceptance criteria: 15 `PASS`, Deferred AC-13 remains `DEFERRED`, 0 `FAIL`
- Findings/blockers: `NONE`
- Human closure authorization: `APPROVED` on `2026-09-21`

Topic Management and Topic Listing are `DONE` for the approved V1 metadata/public-read/ADMIN-CRUD scope. Topic-based Vocabulary Set Discovery remains `TODO`; no Vocabulary Set relation, count, discovery data or RESTRICT relation-state behavior is claimed by this closure.

**Source SPEC:** `docs/specs/TOPIC_V1_SPEC.md` (`APPROVED`)

**Source PLAN:** `docs/plans/TOPIC_V1_PLAN.md` (`APPROVED`)

**TASK status:** `COMPLETE`

**Implementation status:** `COMPLETE — TASK-019 through TASK-024`

## 1. Overview and Feature Status

Topic Management and Topic Listing are `DONE` after TASK-019 through TASK-025 completed implementation, verification and formal review. Topic-based Vocabulary Set Discovery remains `TODO`. The completed scope contains only approved Topic V1 metadata, public reads and ADMIN CRUD.

Deferred AC-13 remains a future integration requirement. No task may create a Vocabulary Set model, relation, FK, mock, fixture, count, discovery data, visibility behavior or RESTRICT relation-state test.

## 2. Task Dependency Graph

```text
TASK-019 — Topic schema and migration
    ↓
TASK-020 — Topic backend/API implementation
    ↓
TASK-021 — Backend/database/API/security verification
    ↓
TASK-022 — Public Topic frontend
    ↓
TASK-023 — ADMIN Topic frontend and App Layout integration
    ↓
TASK-024 — Frontend/accessibility/regression verification
    ↓
TASK-025 — Formal TEST/REVIEW and closure readiness
```

Tasks are sequential. Backend API evidence is required before frontend integration; formal testing/review is required before any status closure.

## 3. Task Overview

| Task | Responsibility | Primary SPEC ACs |
|---|---|---|
| TASK-019 | Prisma `TOPIC`, migration and case-insensitive uniqueness | AC-01, AC-02, AC-04, AC-12, AC-16 |
| TASK-020 | Repository/service/controller/routes, Admin authz and safe errors | AC-02–AC-05, AC-08–AC-10, AC-12, AC-14, AC-16 |
| TASK-021 | Database/backend/API/security tests and Auth regression | AC-01–AC-05, AC-08, AC-10, AC-12, AC-14, AC-16 |
| TASK-022 | Public list/detail, client search and public UI states | AC-05–AC-08, AC-14, AC-16 |
| TASK-023 | ADMIN management UI, guard and real App Layout navigation | AC-09–AC-12, AC-14–AC-16 |
| TASK-024 | Frontend tests, accessibility/responsive checks and regressions | AC-05–AC-12, AC-14–AC-16 |
| TASK-025 | Formal TEST/REVIEW evidence and closure readiness | AC-01–AC-16; Deferred AC-13 recorded only |

## TASK-019 — Add the Isolated Topic Schema and Migration

### Objective

Materialize only the approved Topic V1 persistence contract and database uniqueness constraint.

### Dependencies

None; human approval of this TASK document is required before execution.

### Files / Modules

- `backend/prisma/schema.prisma` — add the `TOPIC` model with approved fields only.
- New Prisma migration under the existing Prisma migration location — create `TOPIC` and functional `LOWER(name)` unique index.
- Generated Prisma client artifacts only as required by the existing Prisma workflow.

### In Scope

- UUID string id, `name`, nullable `description`, `created_at`, `updated_at`.
- Database field lengths and functional case-insensitive unique index.
- Migration generation/application verification against the dedicated test database.

### Out of Scope

- `VOCABULARY_SET`, `topic_id`, relations/FKs, delete relation behavior, seed/mock data, soft delete, image, slug, ordering and progress fields.

### Acceptance Criteria

- Schema/migration represents exactly the five approved Topic fields.
- Name is database-unique case-insensitively; normal display casing is retained.
- No Vocabulary Set relation or RESTRICT test state is introduced.

### Verification Gate

- Prisma schema generation and migration application succeed in the test database.
- Inspect migration/schema for only approved Topic V1 changes.

## TASK-020 — Implement Topic Backend and API Contract

### Objective

Implement the approved public metadata reads and ADMIN Topic CRUD using the existing route → middleware → controller → service → repository architecture.

### Dependencies

- TASK-019 complete.

### Files / Modules

- New Topic repository, service, controller and route modules under the existing `backend/src/` layer folders.
- `backend/src/create-app.js` — compose and mount public `/api/topics` and protected `/api/admin/topics` routers; register the minimal final safe error handler after routes.
- Existing authentication and role middleware — reuse unchanged for ADMIN mutations.

### In Scope

- Unpaginated public `GET /api/topics` and metadata-only `GET /api/topics/:topicId` with UUID paths.
- ADMIN `POST`, partial `PATCH` and `DELETE` contracts exactly as documented.
- Backend validation/trim, duplicate translation, not-found handling, existing session/ADMIN authorization and safe unexpected `500 INTERNAL_SERVER_ERROR` handling.
- Preserve known Authentication errors and all existing Auth contracts.

### Out of Scope

- Server search/filter, Topic progress, learning/gamification calls, ownership checks, Vocabulary Set discovery/count/visibility/relation checks, new roles or a replacement Auth architecture.

### Acceptance Criteria

- Public reads return Topic metadata only and empty Topics remain valid.
- ADMIN mutations use server-derived `req.user` plus existing `ADMIN` role middleware.
- PATCH follows omitted/`null`/unsupported-field semantics in the approved PLAN/API_SPEC.
- Controllers do not expose internals; the final handler returns only a safe `500` for unexpected failures and does not alter known Auth behavior.

### Verification Gate

- Inspect middleware order, controller/service/repository boundaries and exact public/ADMIN route registration.
- Continue only when TASK-021 automated API/security evidence is ready.

## TASK-021 — Verify Database, Backend API, Authorization and Auth Regression

### Objective

Add and execute focused backend/database/API/security coverage for TASK-019 and TASK-020, then run existing Authentication regressions.

### Dependencies

- TASK-020 complete.

### Files / Modules

- New or focused Topic backend/database test files using existing test helpers.
- Existing backend test helpers and Auth test suites; update helper cleanup only if required for the new Topic table.

### In Scope

- Model/migration/index/timestamp verification.
- Validation, trimming, max lengths, duplicate case variants, UUID path validation, missing Topic and empty Topic coverage.
- Public reads; ADMIN success; unauthenticated/USER/forged-role rejection; PATCH semantics; safe unexpected-error response.
- Existing backend Authentication regression.

### Out of Scope

- Related Vocabulary Set/RESTRICT test, mocks or fixture data; frontend tests; weakening existing Auth assertions.

### Acceptance Criteria

- Expected 200/201/204 and 400/401/403/404/409 contracts are covered.
- Authentication/role middleware uses only existing session-derived identity.
- Database uniqueness withstands case variants/concurrent collision translation.
- Existing Auth suite remains passing.

### Verification Gate

- Run focused Topic database/backend/API tests and backend Auth suite.
- Report each command/result truthfully; failures return work to the applicable implementation task.

## TASK-022 — Build Public Topic List and Detail

### Objective

Add Guest/User Topic metadata views with client-side search and required data states without changing Authentication flow.

### Dependencies

- TASK-021 pass.

### Files / Modules

- `frontend/src/services/` — Topic API client/error mapping using existing `httpClient`.
- `frontend/src/app-router.jsx` — explicit public `/topics` and `/topics/:topicId` routes outside Guest/Protected route guards.
- New focused public Topic pages/components and scoped styles as needed.

### In Scope

- Unpaginated list, in-memory client-side search, detail links, metadata-only display, loading/empty/error/not-found states and accessible semantics.
- Empty Topic detail remains viewable; Guest and authenticated users can reach public routes.

### Out of Scope

- Vocabulary Set cards/count/discovery/visibility, learning actions, pagination, server filtering, Dashboard changes or a public Landing Page redesign.

### Acceptance Criteria

- Public routes do not redirect authenticated users through `GuestRoute` and do not use unknown-route fallback.
- UI renders only approved Topic metadata and has no XP/streak/progress side effect.
- Search is client-side and all required states are accessible.

### Verification Gate

- Manually inspect public route placement and data states before TASK-024 browser tests.

## TASK-023 — Build ADMIN Topic Management in the Existing App Layout

### Objective

Provide real ADMIN Topic management navigation and UI without duplicating the authenticated shell or treating frontend authorization as security.

### Dependencies

- TASK-022 complete.

### Files / Modules

- `frontend/src/auth/ui/route-guards.jsx` — focused ADMIN UX guard, if needed by the approved route design.
- `frontend/src/app-router.jsx` — protected `/admin/topics` route under existing `AuthenticatedShell`.
- `frontend/src/auth/ui/authenticated-shell.jsx` and `frontend/src/index.css` — ADMIN-only real navigation integration only as required.
- New focused Topic management page/components/styles.

### In Scope

- ADMIN list/search/view/create/edit/delete UI using the Topic service.
- Form validation mirroring UX limits, approved PATCH semantics, loading/success/error states and keyboard-accessible delete confirmation/focus behavior.
- ADMIN-only navigation/route UX; non-ADMIN redirect to the existing safe authenticated destination.

### Out of Scope

- A second shell/provider/store, changing Logout/drawer/Auth behavior, exposing an ADMIN route to USER navigation, server-side authorization changes, set counts/discovery or future RESTRICT test behavior.

### Acceptance Criteria

- Only ADMIN gets the real management navigation and route UX; backend remains the enforcement boundary.
- Create/edit/delete use the approved API contract; delete requires confirmation and prevents duplicate submission while pending.
- Existing App Layout's Dashboard, Logout, responsive drawer and account behavior remain intact.

### Verification Gate

- Inspect route nesting, navigation conditions, form state and dialog accessibility before formal frontend verification.

## TASK-024 — Verify Frontend, Accessibility and Regressions

### Objective

Add/run focused Topic frontend tests and prove public, ADMIN, accessibility, responsive, Auth and App Layout behavior remains correct.

### Dependencies

- TASK-023 complete.

### Files / Modules

- New or focused Topic frontend unit/browser test files and existing Playwright/Auth fixtures.
- Existing frontend Auth/App Layout tests only where their expected navigation/route behavior legitimately changes.

### In Scope

- Public list/detail states/search; ADMIN guard/navigation/CRUD/form/delete-confirmation states; keyboard/focus/labels; responsive behavior.
- Absence assertions for set count/discovery and learning/gamification effects.
- Existing Auth/App Layout browser/unit regressions, frontend lint and production build.

### Out of Scope

- Pixel-perfect snapshots, new test dependencies, integration tests for deferred Vocabulary Set relations, or weakening existing tests.

### Acceptance Criteria

- Guest, USER and ADMIN flows reflect approved public/read and ADMIN-management boundaries.
- Accessible forms/dialog/route navigation work at supported responsive sizes.
- Auth/App Layout regressions, lint and build pass with truthful evidence.

### Verification Gate

- Run focused Topic frontend tests, existing frontend Auth/App Layout suites, `npm run lint`, `npm run build`, `git diff --check` and a secret/scope scan.

## TASK-025 — Formal TEST, REVIEW and Closure Readiness

### Objective

Produce final evidence and review Topic V1 without marking it complete until TEST, REVIEW and human approval gates are satisfied.

### Dependencies

- TASK-021 and TASK-024 pass.

### Files / Modules

- Review all actual Topic V1 changes, approved SPEC/PLAN/TASK, test evidence and relevant documentation.
- `docs/FEATURE_STATUS.md` only after a successful TEST + REVIEW + human approval workflow result.

### In Scope

- Trace AC-01 through AC-16 against implementation and test evidence.
- Record Deferred AC-13 as deferred future integration work, not a failed/missing V1 test.
- Review scope, API/database/docs synchronization, authorization/security, Auth/App Layout regression and changed-file hygiene.

### Out of Scope

- Marking Topic `DONE` before required approvals, adding Vocabulary Set work, commit/push/merge/deploy or changing unrelated feature statuses.

### Acceptance Criteria

- Every V1 AC has implementation/test/review evidence; Deferred AC-13 remains explicitly deferred.
- No unresolved BLOCKER/HIGH finding remains for a future review approval.
- Topic-based Vocabulary Set Discovery remains `TODO`; completed Auth/App Layout statuses remain unchanged.

### Verification Gate

- Formal TEST report and REVIEW verdict (`APPROVE`, `CHANGES_REQUIRED`, or `BLOCKED`).
- Final diff/secret/scope check and verified documentation/status update only after all approval gates.

### Formal TEST Report — 2026-09-21

**Result:** `PASS`

Environment and safety:

- Backend and database verification used the dedicated TEST database through the existing `.env.test` and reset opt-in safety gates.
- Topic browser verification used isolated local frontend/backend test ports and the dedicated TEST database.
- Final fixture query confirmed 0 Topic fixtures and 0 account fixtures remaining.
- Production database, deployment, commit, push and merge operations were not used.

Automated evidence:

| Area | Result | Evidence |
|---|---|---|
| Topic database/backend/API/security | PASS | 16 passed, 0 failed; includes schema/index inspection, DB collision translation, validation, PATCH, authorization and safe 500 behavior. |
| Backend Authentication regression | PASS | 29 passed, 0 failed, 3 approved existing TODOs. |
| Topic real-stack browser | PASS | 9 passed, 0 failed across Guest, USER and ADMIN. |
| Frontend Auth browser regression | PASS | 25 passed, 0 failed. |
| App Layout browser regression | PASS | 7 passed, 0 failed. |
| Frontend unit regression | PASS | 20 passed, 0 failed. |
| Responsive/accessibility | PASS | Chromium verification at 375×812, 768×1024 and 1366×768, including keyboard focus, labels, dialog focus/restoration and overflow checks. |
| Frontend lint | PASS | ESLint completed with 0 errors. |
| Frontend production build | PASS | Vite production build completed successfully. |
| Test-data cleanup | PASS | 0 Topic fixtures and 0 Topic E2E account fixtures remained. |

Acceptance-criteria traceability:

| Criterion | Result | Implementation and verification evidence |
|---|---|---|
| AC-01 | PASS | Prisma `TOPIC` and migration contain exactly UUID `id`, `name`, nullable `description`, `created_at`, `updated_at`; backend database test verifies types/nullability/timestamps. |
| AC-02 | PASS | Service trims and validates names; API/browser coverage rejects missing, whitespace-only, null and over-100-character values. |
| AC-03 | PASS | Service and ADMIN form enforce the 500-character description limit; backend coverage includes invalid/overlong values. |
| AC-04 | PASS | PostgreSQL unique index on `LOWER(name)` is the final guard; duplicate create/rename and concurrent DB-collision translation return `409 TOPIC_NAME_ALREADY_EXISTS`. |
| AC-05 | PASS | Public unpaginated list/detail API and explicit public frontend routes work for Guest, USER and ADMIN. |
| AC-06 | PASS | Topics without Vocabulary Sets remain listable/viewable; nullable description is handled without fabricated related content. |
| AC-07 | PASS | Public/admin UI and API return Topic metadata only; browser absence assertions cover Vocabulary Set/count/progress fabrication. |
| AC-08 | PASS | Topic read path is isolated to Topic repository queries and introduces no XP, streak, progress, Level, Achievement or learning-state operation. |
| AC-09 | PASS | ADMIN list, client search, view, create, edit and delete flows pass real-stack browser coverage. |
| AC-10 | PASS | Backend ADMIN router applies authentication then ADMIN authorization; unauthenticated, USER and forged-role attempts are rejected independently of frontend UX. |
| AC-11 | PASS | Browser coverage proves delete requires an accessible confirmation, supports cancel, prevents duplicate pending submission and restores focus. |
| AC-12 | PASS | Schema, migration, fixtures and production code contain no Vocabulary Set model/relation/mock, cascade or reassignment behavior. |
| AC-13 | DEFERRED | Future approved Vocabulary Set integration must add the relation, RESTRICT/no-cascade behavior and relation-state test; none is represented or claimed in Topic V1. |
| AC-14 | PASS | Applicable V1 validation, duplicate, missing, authentication, authorization, operational and safe unexpected-error states are covered. Restricted relation deletion remains part of deferred AC-13. |
| AC-15 | PASS | `/admin/topics` is nested under the existing `ProtectedRoute` and `AuthenticatedShell`; no second shell/provider/store exists. |
| AC-16 | PASS | Scope inspection confirms no Vocabulary Set/Vocabulary relation, pagination, server search/filter or Topic progress behavior. |

Failures: `NONE`.

Regression result: `PASS`.

Next stage: formal REVIEW.

### Formal REVIEW Report — 2026-09-21

**Verdict:** `APPROVE`

Scope reviewed:

- Approved Topic V1 SPEC, PLAN and TASK-019 through TASK-025.
- Prisma schema/migration, Topic backend layers/routes, public and ADMIN frontend, focused tests and synchronized database/API/UI documentation.
- Authentication/App Layout integration and accumulated regression evidence.
- Deferred AC-13 only as a documented future requirement.

Review conclusions:

- **Scope:** PASS — actual changes match Topic metadata/public-read/ADMIN-CRUD scope; no new product feature or unrelated dependency was introduced.
- **Architecture:** PASS — backend follows route → middleware → controller → service → repository → Prisma; frontend uses page/component state → shared service → existing `httpClient`.
- **Database:** PASS — the isolated five-field `TOPIC` model and migration match the approved contract; the functional `LOWER(name)` unique index enforces display-case-preserving case-insensitive uniqueness.
- **API:** PASS — public reads, ADMIN CRUD, UUID/input validation, PATCH semantics, status codes and error contracts match the synchronized API specification.
- **Authorization/security:** PASS — ADMIN identity comes from authenticated `req.user`; backend middleware is authoritative; frontend role guard/navigation is UX-only; safe errors expose no DB internals, secrets, cookies, hashes or stacks.
- **Frontend/accessibility:** PASS — explicit public routes, existing authenticated shell, client-only search, required UI states, responsive behavior and accessible forms/dialog/focus behavior have browser evidence.
- **Regression:** PASS — backend Auth, frontend Auth, App Layout, unit, lint and build evidence is clean; the 3 approved Auth TODOs remain unchanged.
- **Documentation:** PASS — `DATABASE.md`, `API_SPEC.md` and `UI_UX_SPEC.md` describe the implemented V1 boundary; this closure record and `FEATURE_STATUS.md` reflect the verified result.
- **Deferred work:** PASS — AC-13 and Topic-based Vocabulary Set Discovery remain deferred/TODO and are not represented as implemented.

Findings: `NONE`.

Final status: Topic Management and Topic Listing transitioned to `DONE`; Topic-based Vocabulary Set Discovery remains `TODO`.

## 4. Cross-Task Scope Guardrails

- Do not create Vocabulary Set/Vocabulary model, relation, data, mock, count, discovery, visibility or RESTRICT relation-state test.
- Do not add pagination, server filtering, progress, XP, streak, Level, Achievement, new role, dependency or external service.
- Reuse existing Auth middleware, role middleware, Auth provider and `AuthenticatedShell`; do not duplicate or redesign them.
- Preserve `AUTHENTICATION_FAILED` and other known Authentication contracts; the new final safe handler applies only to unexpected errors.
- Execute only the specifically requested approved task; later tasks remain unauthorized until explicitly requested.

## 5. SPEC → PLAN → TASK Traceability Matrix

| SPEC requirement | PLAN area | Tasks |
|---|---|---|
| AC-01 | Database plan | TASK-019, TASK-021, TASK-025 |
| AC-02–AC-04 | Validation/uniqueness/API plan | TASK-019–TASK-021, TASK-023–TASK-025 |
| AC-05–AC-07 | Public API/frontend plan | TASK-020–TASK-022, TASK-024–TASK-025 |
| AC-08 | Business boundary/testing plan | TASK-020–TASK-022, TASK-024–TASK-025 |
| AC-09–AC-11 | Authorization/admin frontend plan | TASK-020–TASK-024, TASK-025 |
| AC-12 | Deferred relation boundary | TASK-019–TASK-025 |
| Deferred AC-13 | Future relation plan | Recorded only; no V1 implementation/test task |
| AC-14 | Error/UI-state/test plan | TASK-020–TASK-025 |
| AC-15 | App Layout integration plan | TASK-023–TASK-025 |
| AC-16 | Scope/documentation/test plan | TASK-019–TASK-025 |

## 6. Approval Gate

```text
SPEC STATUS: APPROVED
PLAN STATUS: APPROVED
TASK STATUS: COMPLETE
FORMAL TEST: PASS
FORMAL REVIEW: APPROVE
FEATURE CLOSURE: APPROVED — TOPIC V1 METADATA/PUBLIC READ/ADMIN CRUD ONLY
DEFERRED AC-13: DEFERRED — FUTURE VOCABULARY SET INTEGRATION
```
