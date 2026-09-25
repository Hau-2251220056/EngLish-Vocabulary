# TASKS: Learning Progress View V1

**Source SPEC:** `docs/specs/LEARNING_PROGRESS_VIEW_V1_SPEC.md` (HUMAN APPROVED)

**Source PLAN:** `docs/plans/LEARNING_PROGRESS_VIEW_V1_PLAN.md` (HUMAN APPROVED)

**TASK status:** `APPROVED`

**Human approval:** `APPROVED`

**Implementation authorized:** `YES` — only according to the approved task sequence and active task boundary.

## 1. Overview

These tasks add the approved read-only USER Learning Progress View without rebuilding the completed Learning Progress engine. They extend the existing Learning backend and authenticated frontend in dependency order, insert a mandatory HUMAN UI/UX approval gate before production page work, and finish with guarded browser/regression evidence plus formal TEST/REVIEW.

No task authorizes a schema migration, conceptual `NEW` aggregation, SRS/Words-to-Review behavior, Topic/Set progress, Dashboard, history, gamification or Flashcard redesign.

## 2. Feature Status

- Existing Learning Progress persistence/mutation engine: `DONE`.
- Learning Progress View V1 extension: `DONE`; TASK-064 through TASK-072 are complete and HUMAN approved.
- Current workflow stage: feature closure complete; commit authorized, with push/integration remaining separate checkpoints.

The extension must be tracked separately and must not move the completed Flashcard / Learning V1 feature back to an unfinished state.

## 3. Dependency Graph and HUMAN Gates

```text
TASK-064  Documentation synchronization
    ↓
TASK-065  Read-only backend/API implementation
    ↓
TASK-066  Backend/API/security verification
    ↓
TASK-067  Frontend service/route/navigation foundation
    ↓
TASK-068  UI/UX DESIGN CHECKPOINT
    ↓
HUMAN UI/UX APPROVAL — HARD BLOCKING GATE
    ↓
TASK-069  Production progress page
    ↓
TASK-070  Frontend unit/accessibility verification
    ↓
TASK-071  Guarded browser and cross-feature regressions
    ↓
TASK-072  Formal TEST / REVIEW / closure preparation
    ↓
HUMAN FINAL CLOSURE APPROVAL
```

No production progress-page implementation may start before TASK-068 is complete and HUMAN approved. Formal unit/integration coverage in implementation tasks does not replace TASK-072 formal TEST/REVIEW.

## 4. Acceptance-Criteria Traceability

| SPEC acceptance criteria | Tasks |
|---|---|
| AC-01–AC-02 | TASK-064, TASK-065, TASK-067, TASK-070, TASK-071, TASK-072 |
| AC-03–AC-05 | TASK-065, TASK-066, TASK-069–TASK-072 |
| AC-06–AC-08 | TASK-065–TASK-067, TASK-069–TASK-072 |
| AC-09 | TASK-064–TASK-066, TASK-068–TASK-072 |
| AC-10–AC-12 | TASK-068–TASK-072 |
| AC-13 | TASK-066, TASK-071, TASK-072 |
| AC-14 | TASK-066, TASK-070–TASK-072 |
| AC-15 | TASK-064–TASK-072 |

## TASK-064 — Synchronize Approved Learning Progress View Documentation

### Objective

Synchronize the approved read-only extension contract before implementation while preserving the completed Learning engine and every deferred boundary.

### Dependencies

- HUMAN-approved SPEC, PLAN and TASK decomposition.

### Expected Files / Areas

- `docs/API_SPEC.md`
- `docs/UI_UX_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/FEATURE_STATUS.md`
- `docs/DATABASE.md` only if a clarification is required to state that no new persistence is introduced.

### In Scope

- USER-only progress-read contract, summary semantics, pagination/status filtering, projection and safe errors.
- Functional UX states and dedicated extension status.
- Explicit distinction between the completed engine and the new view.

### Out of Scope

- Source, tests, schema, migration or production UI.
- Activating legacy review, analytics, Dashboard or gamification drafts.

### Implementation Requirements

- Record conceptual `NEW` exclusion and compatibility-only `NEEDS_REVIEW` handling.
- Preserve existing Flashcard event/payload contracts unchanged.
- Track the extension at the workflow-appropriate status without changing the completed engine from `DONE`.
- Record that no schema change is approved.

### Verification

- Search active docs for conflicting global-`NEW`, search, review-queue, Dashboard or mutation implications.
- Confirm only approved documentation changes.
- Run `git diff --check` and scope/secret checks.

### Mapped Acceptance Criteria

AC-01, AC-02, AC-09, AC-15.

### Completion Gate / Status

`COMPLETE` — the approved USER-only read contract is synchronized in active API, architecture, UI/UX and feature-status documentation without changing the existing schema or historical Flashcard / Learning closure. HUMAN review is required before TASK-065.

## TASK-065 — Implement Read-Only Learning Progress Backend and API

### Objective

Add the approved `GET /api/learning/progress` repository/service/controller/router behavior using the existing schema and USER authorization.

### Dependencies

- TASK-064 complete and HUMAN reviewed.

### Expected Files / Areas

- `backend/src/repositories/learning-repository.js`
- `backend/src/services/learning-service.js`
- `backend/src/controllers/learning-controller.js`
- `backend/src/routes/learning-routes.js`
- Existing Learning composition only if necessary; no new subsystem.

### In Scope

- Current-USER grouped summary.
- Paginated and optionally status-filtered minimal list.
- Exact query validation, deterministic order and consistent read snapshot.
- Existing safe envelopes/errors and middleware.

### Out of Scope

- Schema/migration/index changes.
- Progress writes, reset, history, SRS/review queue or new middleware/roles.

### Implementation Requirements

- Accept only scalar `page`, `page_size` and `status` with approved defaults/bounds/statuses; reject malformed, repeated and unknown input.
- Apply authenticated `user_id` independently to summary, filtered count and page queries.
- Obtain all response parts from one read-only consistent snapshot without write locks or N+1 queries.
- Order `last_reviewed_at DESC NULLS LAST`, `created_at DESC`, `id ASC`.
- Explicitly select only approved Vocabulary/progress fields.
- Return unfiltered summary, filtered pagination totals and successful empty out-of-range pages.
- Leave existing `/sets/:setId` and `/events` semantics unchanged.

### Verification

- Focused syntax/unit checks appropriate to changed backend modules.
- Manual/static contract inspection; no claim of full TEST-stage evidence.
- Confirm Prisma schema/migrations unchanged and no database command required.

### Mapped Acceptance Criteria

AC-02–AC-09, AC-13–AC-15.

### Completion Gate / Status

`COMPLETE` — `GET /api/learning/progress` now uses the existing USER-only Learning router, strict current-USER predicates, approved validation/projection/pagination/order and one `RepeatableRead` read transaction for summary/count/page. Existing Set/event paths are unchanged. Syntax checks and the DB-independent backend unit regression passed; database/API/security coverage remains TASK-066. HUMAN review is required before TASK-066.

## TASK-066 — Add Backend, API, Security and Read-Only Regression Coverage

### Objective

Convert the TASK-065 contract into durable automated evidence at the guarded TEST database boundary and protect existing Learning/Auth behavior.

### Dependencies

- TASK-065 complete and HUMAN reviewed.

### Expected Files / Areas

- `backend/test/learning/learning.test.js` or one narrowly scoped Learning Progress View suite.
- Existing guarded TEST helpers and backend package scripts only when genuinely required.

### In Scope

- Summary, pagination, status filters, ordering, projection, validation and safe errors.
- Authentication, USER role and strict per-USER isolation.
- Repeated-read invariance and consistent response behavior.
- Existing Learning/Auth regressions.

### Out of Scope

- Frontend implementation/tests.
- Weakening guards, using a non-TEST database or adding schema fixtures permanently.

### Implementation Requirements

- Cover no-row, mixed-status and controlled `NEEDS_REVIEW` fixtures.
- Prove summary is unfiltered while pagination totals are filtered.
- Cover boundary/default/out-of-range pages, timestamp ties and nullable review timestamps.
- Assert exact minimal projection and absence of internal/SRS fields.
- Cover malformed/repeated/unknown query input, safe `401`/`403`/`500` and forged-user attempts.
- Snapshot row count and all persisted progress fields before/after repeated reads.
- Confirm existing Set learning and meaningful events remain unchanged.

### Verification

- Explicit `NODE_ENV=test` and existing `configureTestEnvironment()` safeguards.
- Run focused Learning Progress View/Learning backend coverage and required Authentication regression.
- Use controlled fixture cleanup; report exact PASS/FAIL/TODO counts.
- Run `git diff --check` and scope/secret checks.

### Mapped Acceptance Criteria

AC-02–AC-09, AC-13–AC-15.

### Completion Gate / Status

`COMPLETE` — guarded Learning coverage passes 12/12, including the read-only Progress contract, USER-only access and isolation, pagination/filter validation, deterministic ordering, compatibility-only `NEEDS_REVIEW`, repeated-read invariance, safe failures and existing Set/event regressions. The guarded Authentication regression passes 29 with 0 failures and 3 pre-existing approved TODOs. HUMAN review is required before TASK-067.

## TASK-067 — Add Frontend Service, Guarded Route and USER Navigation Foundation

### Objective

Create the frontend consumption/access foundation without implementing the production Learning Progress page design.

### Dependencies

- TASK-066 complete and HUMAN reviewed.

### Expected Files / Areas

- `frontend/src/services/learning-service.js`
- `frontend/src/app-router.jsx`
- `frontend/src/auth/ui/authenticated-shell.jsx`
- A minimal Learning Progress route/page foundation.
- Focused service/route tests.

### In Scope

- Approved query serialization and defensive response validation.
- `/my/learning-progress` under existing USER guards.
- USER-only authenticated navigation entry.
- Minimal placeholder/foundation sufficient to verify routing and access.

### Out of Scope

- Production summary/list design and final responsive page.
- Dashboard, generic Vocabulary navigation or changes to Learning Focus Mode.

### Implementation Requirements

- Extend the existing Learning service and `LearningApiError`; do not create a duplicate HTTP architecture.
- Send only approved query parameters and safely reject malformed responses.
- Reuse `ProtectedRoute`, `AuthenticatedShell` and `UserRoute`.
- Hide navigation from ADMIN and preserve Guest redirects/backend security.
- Keep the foundation deliberately presentation-neutral pending TASK-068.

### Verification

- Focused frontend service tests and route/navigation checks.
- ESLint for changed files and production build if required by repository convention.
- Confirm existing Dashboard, Auth navigation, My Sets and Learning route behavior remains intact.

### Mapped Acceptance Criteria

AC-01, AC-02, AC-05–AC-08, AC-14, AC-15.

### Completion Gate / Status

`COMPLETE` — the existing Learning service now exposes the approved validated read contract, `/my/learning-progress` is nested under the existing USER guard and App Layout, and USER-only navigation reaches a deliberately presentation-neutral foundation page. Focused service tests, route/role checks, ESLint and production build pass. HUMAN review is required before TASK-068.

## TASK-068 — HUMAN UI/UX Design Checkpoint

### Objective

Record and obtain HUMAN approval for the production Learning Progress View composition and interaction states before any final page implementation.

### Dependencies

- TASK-067 complete and HUMAN reviewed.

### Expected Files / Areas

- A repo-native Learning Progress View V1 UI/UX checkpoint document.
- `docs/UI_UX_SPEC.md` only if required to reference the approved checkpoint.

### In Scope

- Information hierarchy for four persisted summary counts.
- Status wording/filter, list rows and pagination.
- Loading, first-use empty, filtered-empty and safe error/retry designs.
- Desktop/tablet/mobile composition, keyboard/focus/live-region behavior and reduced motion.
- Compatibility-only `NEEDS_REVIEW` presentation without due/review actions.

### Out of Scope

- Production JSX/CSS implementation.
- API/business changes, charts, search, recommendations, Dashboard or Flashcard design.

### Implementation Requirements

- Keep styling decisions within existing ELVocab identity while leaving implementation details proportional.
- Show no global completion percentage or conceptual `NEW` total.
- Define pending filter/pagination protection and predictable focus behavior.
- Record HUMAN decisions and any approved visual reference without expanding scope.

### Verification

- Documentation, scope, secret and `git diff --check` verification only.
- Trace the checkpoint to AC-10 through AC-12 and the approved API response.

### Mapped Acceptance Criteria

AC-03, AC-09–AC-12, AC-15.

### Completion Gate / Status

`COMPLETE — HUMAN APPROVED.` The approved visual direction establishes four responsive summary cards, a non-interactive learner-facing Vocabulary list, status filter, server pagination and distinct accessible loading/first-use-empty/filtered-empty/error states in the existing ELVocab visual language. It explicitly excludes row navigation, history wording and unapproved CTAs.

## TASK-069 — Implement the HUMAN-Approved Production Progress Page

### Objective

Implement the production USER Learning Progress page exactly according to the approved checkpoint and API contract.

### Dependencies

- TASK-068 complete.
- Explicit HUMAN UI/UX checkpoint approval.

### Expected Files / Areas

- Learning Progress page/component area created by TASK-067.
- Feature-scoped styling within existing frontend conventions.

### In Scope

- Summary, current-state list, status filter and pagination.
- Accessible loading, first-use empty, filtered-empty and error/retry states.
- Pending/stale-request protection and responsive behavior.

### Out of Scope

- Any unapproved visual redesign or changes to backend/API.
- Search, charts, progress percentages, review actions, recommendations, Dashboard or Flashcard.

### Implementation Requirements

- Render only backend-provided summary/pagination values and approved list metadata.
- Reset page to 1 on filter changes; prevent duplicate pending pagination/filter actions.
- Prevent stale slower responses from replacing the latest selection.
- Distinguish first-use and filtered-empty states truthfully.
- Format nullable phonetic/timestamp safely and communicate status with text.
- Preserve keyboard focus, live-region behavior, touch targets, reduced motion and no horizontal overflow from the checkpoint.

### Verification

- Focused component/manual behavior checks.
- ESLint for changed frontend files and production build.
- Confirm no backend/schema/API or unrelated page changes.

### Mapped Acceptance Criteria

AC-01, AC-03–AC-12, AC-14, AC-15.

### Completion Gate / Status

`COMPLETE` — the production page consumes only the approved read service and renders server-authoritative summary/list/pagination data with stale-response protection, pending controls, safe date/phonetic handling and the HUMAN-approved desktop/mobile state hierarchy. Focused Learning service tests, USER/ADMIN route smoke, ESLint, production build and `git diff --check` pass. HUMAN review is required before TASK-070.

## TASK-070 — Add Frontend Unit and Accessibility Coverage

### Objective

Add focused automated coverage for frontend service/page state, access integration and accessible interaction without duplicating later real-stack flows.

### Dependencies

- TASK-069 complete and HUMAN reviewed.

### Expected Files / Areas

- Existing/new Learning Progress frontend test files.
- Existing Auth/App Layout frontend tests where navigation assertions belong.

### In Scope

- Response validation/error mapping and approved query serialization.
- Loading, summary/list, both empty states, error/retry and pagination/filter transitions.
- Pending duplicate prevention, page reset and stale-response protection.
- Text statuses, keyboard/focus/live-region semantics and responsive component assumptions.
- USER/ADMIN navigation and route-guard expectations.

### Out of Scope

- Guarded database/browser execution owned by TASK-071.
- Weakening existing assertions or testing deferred features.

### Verification

- Run focused Learning Progress frontend tests and relevant Auth/App Layout unit coverage.
- Run frontend ESLint and production build.
- Record exact PASS/FAIL/TODO counts and run diff/secret/scope checks.

### Mapped Acceptance Criteria

AC-01, AC-02, AC-05–AC-12, AC-14, AC-15.

### Completion Gate / Status

`COMPLETE` — focused mocked-browser coverage passes 6/6 for populated/loading/empty/error/filter/pagination/pending/stale/reduced-motion and accessibility behavior; Learning service tests pass 4/4 and scoped Auth route/App Layout/responsive regressions pass 16/16. Pagination now restores predictable keyboard focus to the requested control or the remaining enabled pagination control after loading. ESLint, production build and diff/scope checks pass. HUMAN review is required before TASK-071.

## TASK-071 — Verify Guarded Real-Stack, Accessibility, Responsive and Regressions

### Objective

Produce authoritative browser/integration evidence for the complete USER flow and protect shared completed features.

### Dependencies

- TASK-070 complete and HUMAN reviewed.

### Expected Files / Areas

- Focused Learning Progress real-stack Playwright coverage/configuration using existing infrastructure.
- Minimal existing regression test adjustments only if a concrete defect is reproduced.

### In Scope

- USER navigation, summary/list, filtering, pagination and isolation.
- Loading, first-use empty, filtered-empty, safe failure/retry.
- Guest/ADMIN protection, keyboard/focus, screen-reader semantics, responsive/mobile and reduced motion.
- Read-only invariance and scoped Auth/Learning/Vocabulary Set regressions.

### Out of Scope

- New product behavior, visual redesign, schema/API changes or unrelated broad suites.

### Implementation Requirements

- Use only the guarded dedicated TEST database with explicit `NODE_ENV=test` and existing reset authorization.
- Use controlled fixtures covering mixed statuses and pagination, including compatibility-only `NEEDS_REVIEW`.
- Do not treat remote TEST DB latency alone as a product failure.
- Fix only reproducible in-scope defects and add corresponding regression evidence.
- Never access Main, Preview or Production.

### Verification

- Run the focused Learning Progress real-stack suite once through the proven guarded runner.
- Run only required cross-feature Auth/App Layout, Learning and relevant Vocabulary Set regressions.
- Verify controlled fixture cleanup and no orphan servers/listeners.
- Run final ESLint/build if changed, `git diff --check`, secret and scope checks.
- Report exact PASS/FAIL/TODO/NOT RUN totals.

### Mapped Acceptance Criteria

AC-01–AC-15.

### Completion Gate / Status

`COMPLETE` — guarded Learning Progress real-stack coverage passes 5/5 for persisted summary/list, current-user isolation, filtering, pagination/focus, repeated-read invariance, loading/error/retry, first-use/filtered-empty, USER-only access, desktop main-only scrolling, mobile overflow/drawer behavior and accessibility semantics. The complete sequential real-stack regression run passes 33/33 (Auth 2, Learning Progress 5, Learning 4, Topic 9, Vocabulary 5 and Vocabulary Set 8); mocked Auth/App Layout/Progress browser regressions pass 32/32 and Learning service unit coverage passes 4/4. Controlled fixtures are removed, scoped test listeners are absent, and ESLint/diff/secret/scope checks pass. HUMAN review is required before TASK-072.

## TASK-072 — Formal TEST, REVIEW and Closure Preparation

### Objective

Formally assess Learning Progress View V1 against the approved contract, review security/scope/quality, and prepare—but not prematurely claim—feature closure.

### Dependencies

- TASK-064 through TASK-071 complete and HUMAN reviewed.

### Expected Files / Areas

- TASK evidence/status documentation.
- `docs/FEATURE_STATUS.md` and other closure documentation only as authorized by workflow.

### In Scope

- AC-01 through AC-15 traceability to implementation and authoritative evidence.
- Formal TEST result.
- Formal REVIEW of authorization/isolation, read-only behavior, projection, consistent reads, accessibility, regressions, documentation and scope.
- Fixture/process cleanup, diff/secret/scope and documentation consistency checks.
- Closure readiness preparation.

### Out of Scope

- New implementation, merging, deployment or marking `DONE` before HUMAN final approval.

### Implementation Requirements

- Preserve exact PASS/FAIL/PARTIAL/NOT RUN evidence; do not invent or unnecessarily rerun authoritative suites.
- Confirm no schema migration, global `NEW`, SRS/review queue, Dashboard, history, gamification or Flashcard change entered scope.
- Record findings and approved deferrals accurately.
- Keep Learning Progress View V1 short of `DONE` until formal TEST PASS, REVIEW APPROVE and HUMAN closure authorization.

### Verification

- Documentation/status consistency.
- `git diff --check`, working-tree scope and secret checks.
- Confirm controlled TEST fixtures/processes are cleaned.

### Mapped Acceptance Criteria

AC-01 through AC-15.

### Formal Assessment Evidence

| Contract area | Acceptance Criteria | Result | Evidence |
|---|---|---|---|
| USER route and authorization | AC-01–AC-02 | PASS | Existing backend USER middleware plus route/browser coverage reject Guest/ADMIN access and expose the route/navigation only to USER. |
| Persisted summary, projection and read-only isolation | AC-03–AC-05, AC-13 | PASS | Guarded backend and real-stack tests verify exact current-user counts, conceptual-`NEW` exclusion, minimal Vocabulary projection, no cross-user data and unchanged rows/fields across repeated reads. |
| Validation, pagination, filters and safe errors | AC-06–AC-09 | PASS | Backend 12/12 and guarded browser coverage verify bounded queries, deterministic order, truthful totals/out-of-range pages, unfiltered summaries, compatible `NEEDS_REVIEW` and safe `400`/`500` behavior. |
| UI states, interaction and responsive accessibility | AC-10–AC-12 | PASS | HUMAN-approved UI plus mocked 6/6 and guarded 5/5 browser evidence verify loading/empty/error states, retry, pending protection, focus restoration, keyboard semantics, reduced motion and overflow-free desktop/mobile layouts. |
| Regression and scope | AC-14–AC-15 | PASS | Sequential real-stack 33/33 and mocked Auth/App Layout/Progress 32/32 pass; no schema/migration, dependency, deferred domain or Flashcard contract change is present. |

- **Formal TEST:** `PASS` — AC-01 through AC-15 pass with no TODO, NOT RUN or unresolved failure in the required verification scope.
- **Formal REVIEW:** `APPROVE` — correctness, architecture, security, current-user isolation, read-only behavior, accessibility, regression safety, documentation and scope pass with no findings.
- **Closure readiness:** `YES` — requires separate HUMAN final closure authorization before changing feature status to `DONE`.

### Completion Gate / Status

`COMPLETE — HUMAN APPROVED / CLOSURE AUTHORIZED.` Formal TEST is `PASS` for AC-01 through AC-15 and formal REVIEW is `APPROVE`, with no findings or blockers. Evidence confirms the USER-only read contract, current-user isolation, persisted-only summaries, bounded filtering/pagination, minimal projection, repeatable consistent reads, read-only invariance, accessible responsive states and required cross-feature regressions. No schema/migration or deferred feature entered scope. Learning Progress View V1 is `DONE`.

## 5. Execution and Safety Notes

- Execute tasks sequentially unless a later HUMAN-approved task explicitly permits otherwise.
- Do not begin the next task until the active task evidence receives HUMAN review.
- TASK-068 HUMAN UI/UX approval is mandatory before TASK-069.
- Use existing guarded TEST database entry points for every DB-backed test/reset/fixture action.
- No task may create/edit a Prisma schema or migration under the approved contract.
- No granular or write-capable Learning Progress endpoint is permitted.
- Preserve existing Flashcard Learning, Auth, Topic, Vocabulary and Vocabulary Set contracts.
- Formal tests within implementation tasks do not replace TASK-072 formal TEST/REVIEW.

## Approval Gate

```text
EXISTING LEARNING PROGRESS ENGINE: DONE
LEARNING PROGRESS VIEW V1 SPEC: HUMAN APPROVED
LEARNING PROGRESS VIEW V1 PLAN: HUMAN APPROVED
LEARNING PROGRESS VIEW V1 TASK: APPROVED
TASK-064: COMPLETE
TASK-065: COMPLETE
TASK-066: COMPLETE
TASK-067: COMPLETE
TASK-068: COMPLETE — HUMAN DESIGN APPROVED
TASK-069: COMPLETE
TASK-070: COMPLETE
TASK-071: COMPLETE — HUMAN APPROVED
TASK-072: COMPLETE — HUMAN APPROVED / FORMAL TEST PASS / FORMAL REVIEW APPROVE
TASK-064 THROUGH TASK-072: COMPLETE — HUMAN APPROVED
LEARNING PROGRESS VIEW V1 STATUS: DONE
FEATURE CLOSURE AUTHORIZED: YES
NEXT ALLOWED STAGE: COMMIT, THEN SEPARATE PUSH/INTEGRATION REVIEW
```
