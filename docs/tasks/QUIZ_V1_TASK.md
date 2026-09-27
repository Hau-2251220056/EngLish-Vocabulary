# TASKS: Quiz V1

**Source SPEC:** `docs/specs/QUIZ_V1_SPEC.md` (HUMAN APPROVED, including revision)

**Source PLAN:** `docs/plans/QUIZ_V1_PLAN.md` (HUMAN APPROVED, including revision)

**TASK status:** `HUMAN APPROVED`

**Human approval:** Revised decomposition approved; individual task HUMAN gates remain required.

**Implementation authorized:** `YES` — one approved task boundary at a time.

## 1. Overview

These tasks implement Quiz V1 for exactly `VI_TO_ENGLISH` and active type `UNSCRAMBLE_WORD` over every ordered Item in one accessible Vocabulary Set. They reuse the completed Set authorization and per-USER/per-Vocabulary Learning Progress engine while keeping Quiz runs/results transient.

TASK-080 through TASK-086 preserve the historical approved/implemented `MISSING_LETTER` baseline. After TASK-086 visual review, HUMAN requested a controlled contract revision replacing that type. TASK-086A and TASK-086B completed that corrective work and are HUMAN approved; TASK-087 supplies the approved durable frontend verification.

Every task is an independently reviewable boundary and requires HUMAN approval before the next task begins. Production Quiz UI is hard-blocked by TASK-085 HUMAN UI/UX approval. No task may change Prisma schema/migrations or add a Quiz Session, `QUIZ_ATTEMPT`, history, SRS, gamification, Pronunciation or additional type.

## 2. Current Feature Status

- Quiz types, per-character feedback and transient Quiz Result: `DONE — HUMAN APPROVED` in `docs/FEATURE_STATUS.md`.
- Original and revised Quiz V1 SPEC/PLAN/TASK: HUMAN APPROVED.
- Existing implementation: TASK-081 through TASK-086 implemented the historical `MISSING_LETTER` baseline; TASK-086A/TASK-086B replaced it with the approved `UNSCRAMBLE_WORD` contract and UI.
- Existing Set, Vocabulary, Learning Progress, Auth and guarded TEST foundations: `DONE` and must be extended/reused rather than rebuilt.

## 3. Dependency Graph and HUMAN Gates

```text
TASK-080  Synchronize approved Quiz documentation
    ↓
TASK-081  Implement pure Quiz domain and ordered question-read API
    ↓
TASK-082  Implement transactional answer and Progress mutation API
    ↓
TASK-083  Guarded backend/API/security verification and regressions
    ↓
TASK-084  Frontend service/route/run-state foundation
    ↓
TASK-085  UI/UX DESIGN CHECKPOINT
    ↓
HUMAN UI/UX APPROVAL — HARD BLOCKING GATE
    ↓
TASK-086  Production Quiz UI
    ↓
TASK-086A Replace Missing Letter backend/domain contract with Unscramble Word
   ↓ HUMAN APPROVAL
TASK-086B Revise production Quiz UI and repeat HUMAN visual review
   ↓ HUMAN UI/UX APPROVAL
TASK-087  Frontend unit/mocked-browser/accessibility coverage
    ↓
TASK-088  Guarded real-stack and cross-feature regressions
    ↓
TASK-089  Formal TEST / REVIEW / closure preparation
    ↓
HUMAN FINAL CLOSURE APPROVAL
```

TASK-086 historically began only after TASK-085 HUMAN approval. The post-review revision must pass TASK-086A and TASK-086B HUMAN gates before TASK-087. Task-level automated checks never replace TASK-089 formal TEST/REVIEW.

## 4. Acceptance-Criteria Traceability

| SPEC acceptance criteria | Tasks |
|---|---|
| AC-01 | TASK-080–TASK-084, TASK-087–TASK-089 |
| AC-02 | TASK-081, TASK-084, TASK-086–TASK-089 |
| AC-03 | TASK-081, TASK-083, TASK-086–TASK-089 |
| AC-04 | Historical TASK-081/TASK-083; active replacement TASK-086A–TASK-089 |
| AC-05–AC-06 | TASK-081–TASK-083 plus revised TASK-086A–TASK-089 |
| AC-07–AC-09 | TASK-082–TASK-084, TASK-087–TASK-089 |
| AC-10–AC-12 | TASK-084–TASK-089 |
| AC-13 | TASK-081–TASK-089 |
| AC-14 | Historical TASK-085/TASK-086 plus revised TASK-086B–TASK-089 |
| AC-15 | TASK-083, TASK-087–TASK-089 |
| AC-16 | TASK-080–TASK-089 |

## TASK-080 — Synchronize Approved Quiz V1 Documentation

### Objective

Replace active legacy Quiz implications with the approved transient, backend-authoritative V1 contract before implementation.

### Dependencies

- HUMAN-approved SPEC, PLAN and TASK decomposition.

### Expected Files / Areas

- `docs/API_SPEC.md`
- `docs/DATABASE.md`
- `docs/UI_UX_SPEC.md`
- `docs/ARCHITECTURE.md` only where active Quiz wording conflicts
- `docs/FEATURE_STATUS.md`
- Quiz SPEC/PLAN/TASK workflow metadata

### In Scope

- UUID Set-scoped question/answer endpoints, run/question revision, normalization, Progress mapping, transient completion and USER authorization.
- Explicitly non-materialized Quiz Session/Attempt/history and no schema migration.
- Mark only the covered Quiz rows `IN_PROGRESS` according to workflow.

### Out of Scope

- Source, tests, schema/migration, final UI design or deferred-domain documentation cleanup.
- Marking implementation, TEST, REVIEW or feature `DONE`.

### Implementation Requirements

- Distinguish active Quiz V1 from numeric-ID, `QUIZ_ATTEMPT`, XP/SRS and generic legacy examples.
- Preserve completed Learning/Set contracts and broader future product direction as deferred.
- Record exactly two Quiz types and structural answer non-disclosure.

### Verification

- Search for conflicting active Quiz endpoint, persistence, authorization, answer-leakage and reward wording.
- Inspect documentation diff, run `git diff --check`, secret and scope checks.
- Confirm no source/schema/migration/test change.

### Mapped Acceptance Criteria

AC-01–AC-16.

### Completion Gate / Status

`COMPLETE — HUMAN APPROVED.` Active Quiz V1 API, database boundary, UI/UX, architecture and feature-status documentation reflects the approved transient USER-only contract. No source, test, schema or migration change was made.

## TASK-081 — Implement Pure Quiz Domain and Ordered Question-Read API

### Objective

Implement deterministic Quiz helpers and the read-only ordered question endpoint for both approved types without exposing answers or mutating Progress.

### Dependencies

- TASK-080 complete and HUMAN approved.

### Expected Files / Areas

- New Quiz helper/domain module where justified.
- `backend/src/repositories/quiz-repository.js`
- `backend/src/services/quiz-service.js`
- `backend/src/controllers/quiz-controller.js`
- `backend/src/routes/quiz-routes.js`
- `backend/src/create-app.js`
- Focused DB-independent Quiz unit tests.

### In Scope

- Exact query validation and USER-only routing.
- System/owned-private Set concealment and non-empty requirement.
- Every Item once by position.
- Flashcard-equivalent primary Meaning selection.
- Stable stateless Missing Letter masks and opaque question revision.
- NFC/whitespace/lowercase normalization and Unicode-code-point feedback helpers.
- Safe pre-answer projections and read invariance.

### Out of Scope

- Answer endpoint/Progress mutation, frontend, final UI, migration or persistent Quiz state.

### Implementation Requirements

- Use built-in `node:crypto`, canonical versioned serialization and deterministic hashing; add no dependency.
- Preserve Unicode letters and visible punctuation according to SPEC mask invariants.
- Derive question revision only from approved non-answer version metadata.
- Fetch only required current-USER Progress fields and question content; never serialize canonical word/direct answer-bearing fields.
- Keep controller thin and known errors safe.

### Verification

- Focused unit tests for types, selection, normalization, feedback, mask and revision determinism.
- Focused read API/static verification including ordered projection, authorization shape and no mutation.
- Confirm schema/migrations unchanged; lint/syntax and `git diff --check`.

### Mapped Acceptance Criteria

AC-01–AC-06, AC-11, AC-13, AC-16.

### Completion Gate / Status

`COMPLETE — HUMAN APPROVED.` Pure Quiz helpers and the USER-only ordered question-read endpoint are implemented for both approved types. Focused tests passed 8/8; DB-independent backend regressions passed 18 with 3 pre-existing TODO and 0 failures. No Progress mutation, schema/migration, persistent Quiz state or frontend work was added.

## TASK-082 — Implement Transactional Quiz Answer and Progress Mutation API

### Objective

Add backend-authoritative answer evaluation and exactly-once current-event Learning Progress mutation in one transaction.

### Dependencies

- TASK-081 complete and HUMAN approved.

### Expected Files / Areas

- Quiz repository/service/controller/routes from TASK-081.
- Focused service/transaction checks.
- No change to Prisma schema or existing Learning API contract.

### In Scope

- Exact answer body validation.
- Transactional Set/Item/question-content authorization and locking.
- Question revision comparison.
- Correct → `LEARNED`; incorrect → `LEARNING`.
- Counter/revision/backend-time/current-event updates.
- Matching-current-event no-write retry, recomputed transient result and incompatible-retry conflict.
- Stale/different event conflict and concurrent race handling.

### Out of Scope

- Historical response replay, event ledger, answer/attempt persistence, frontend, SRS or rewards.

### Implementation Requirements

- Accept exactly `event_id`, `set_id`, `vocabulary_id`, `run_id`, `question_revision`, `quiz_type`, `expected_revision`, `answer`.
- Validate question revision and evaluate current authoritative answer inside the transaction before mutation.
- For matching `last_event_id`, never mutate; recompute feedback and require target status compatibility.
- Create at revision zero or conditionally update exact current revision once; handle unique/serialization races safely.
- Leave future SRS fields untouched and never call the Learning event endpoint internally.

### Verification

- Focused transaction/service checks for success, retries, incompatible retry, stale revision and rollback.
- Confirm no double increment and no mutation on all rejected paths.
- Syntax/lint/diff/scope verification; guarded comprehensive coverage remains TASK-083.

### Mapped Acceptance Criteria

AC-05–AC-13, AC-15–AC-16.

### Completion Gate / Status

`COMPLETE — HUMAN APPROVED.` The backend-authoritative Quiz answer endpoint transactionally validates Set access, Item membership and question revision, evaluates normalized answers and mutates only the current USER's Progress exactly once. Focused Quiz tests passed 17/17; DB-independent backend regressions passed 18 with 3 pre-existing TODO and 0 failures. No schema/migration, persistent Quiz state, SRS/reward or frontend work was added.

## TASK-083 — Add Guarded Backend, API, Security and Regression Coverage

### Objective

Turn TASK-081/082 behavior into durable guarded TEST evidence and protect shared backend contracts.

### Dependencies

- TASK-082 complete and HUMAN approved.

### Expected Files / Areas

- `backend/test/quiz/` focused suite.
- `backend/package.json` focused/complete integration commands only if required.
- Existing guarded helpers and Auth/Set/Learning suites.
- Production source only for a concrete reproducible contract defect.

### In Scope

- Both type payloads, answer leakage, ordered traversal and read-only invariance.
- USER authorization, concealment and isolation.
- Changed Item/question version, normalization/feedback and safe errors.
- Correct/incorrect transitions, counters, concurrency, retry and atomic rollback.
- SRS-field invariance and absence of Quiz persistence.
- Auth, Vocabulary Set, Learning and Learning Progress backend regressions.

### Out of Scope

- Frontend/browser work, schema/migration, weakened assertions or deferred features.

### Implementation Requirements

- Use `NODE_ENV=test`, `configureTestEnvironment()` and the dedicated authorized TEST DB only.
- Preserve sequential execution/reset guards and use targeted controlled fixtures/cleanup.
- Do not use raw unguarded Prisma commands or substitute another database.
- Report and minimally fix only reproducible approved-contract defects.

### Verification

- Exact Quiz PASS/FAIL/TODO counts.
- Exact required Auth/Set/Learning/Progress regression counts.
- Fixture cleanup, schema-object invariance, diff, secret and scope checks.

### Mapped Acceptance Criteria

AC-01–AC-16.

### Completion Gate / Status

`COMPLETE — HUMAN APPROVED.` Guarded dedicated TEST DB/API coverage verifies both Quiz types, USER authorization, Set ownership/concealment, ordered non-disclosing reads, read invariance, correct/incorrect Progress transitions, exactly-once retry behavior, conflicts, rollback, concurrency, isolation and SRS-field invariance. Quiz tests pass 23/23; Vocabulary Set regressions pass 8/8; Learning/Learning Progress regressions pass 12/12; Authentication regressions pass 29 with 3 pre-existing TODO and 0 failures. Controlled fixtures were reset through the guarded test helper.

## TASK-084 — Add Frontend Service, Guarded Route and Transient Run-State Foundation

### Objective

Add testable Quiz API/run infrastructure and Set entry integration without implementing the final production visual UI.

### Dependencies

- TASK-083 complete and HUMAN approved.

### Expected Files / Areas

- `frontend/src/services/quiz-service.js`
- Quiz feature run-state/storage modules and observer.
- `frontend/src/app-router.jsx`
- Public/owned Vocabulary Set detail entry actions.
- Focused service/run-state/route tests.

### In Scope

- Strict API serialization/response/error mapping.
- `/quiz/vocabulary-sets/:setId` under existing USER guards.
- Type/run creation, same-tab persistence, fresh-payload reconciliation, accepted lockout, restart and completion helpers.
- Quiz-owned cleanup after observed logout/session invalidation.
- Neutral functional placeholder/state scaffolding.

### Out of Scope

- Production question/result visuals, broad App Layout redesign, Sidebar Quiz catalog or TASK-085 decisions.

### Implementation Requirements

- Store no credentials/session token; keep namespace keyed by current USER/Set/type/run.
- Retry must reuse the identical logical event payload until conclusive.
- Send no parallel `POST /api/learning/events`.
- Empty Sets omit Quiz action; Guest/ADMIN behavior stays within existing route/entry conventions.
- Preserve completed Flashcard storage namespace and behavior.

### Verification

- Focused service, run-state, reconciliation, restart/completion and storage-cleanup tests.
- Route/guard/entry action regression checks.
- ESLint, production build and `git diff --check` as appropriate.

### Mapped Acceptance Criteria

AC-01–AC-02, AC-04, AC-08–AC-13, AC-15–AC-16.

### Completion Gate / Status

`COMPLETE — HUMAN APPROVED.` Quiz now has a strict frontend service for the approved question/answer endpoints, a USER-guarded Set route, Set entry actions, Quiz-owned same-tab run persistence/cleanup and deterministic reconciliation/restart/accepted-lockout/completion helpers. Focused Quiz tests pass 11/11 and scoped Auth/Vite regressions pass 20/20; ESLint and production build pass. Production Quiz UI remains deferred to TASK-086 and blocked by TASK-085 HUMAN UI/UX approval.

## TASK-085 — Record Mandatory HUMAN Quiz UI/UX Design Checkpoint

### Objective

Define and receive HUMAN approval for the production Quiz interaction/presentation before any final UI implementation.

### Dependencies

- TASK-084 complete and HUMAN approved.

### Expected Files / Areas

- A focused repo-native Quiz UI/UX checkpoint document.
- Quiz TASK evidence/status only after HUMAN decision.

### In Scope

- Set/type entry and both question anatomies.
- Answer, pending, result, non-color character feedback and explicit next action.
- Progress/restart/completion and all error/conflict states.
- Keyboard/focus/live-region, mobile/tablet/desktop and reduced-motion design.
- ELVocab visual consistency without App Layout redesign.

### Out of Scope

- Production JSX/CSS, API/backend/schema changes or new business behavior.
- Mixed/adaptive Quiz, timer, history/accuracy, rewards, SRS, Pronunciation or third type.

### Implementation Requirements

- Design must not expose pre-answer canonical data.
- Accepted questions cannot be immediately re-answered.
- Visual decisions cannot change approved normalization, Progress or retry semantics.
- Record HUMAN decision explicitly.

### Verification

- Documentation/scope/diff/secret checks only.
- Trace every required runtime state and accessibility behavior to the checkpoint.

### Mapped Acceptance Criteria

AC-02–AC-06, AC-10–AC-14, AC-16.

### Completion Gate / Status

`COMPLETE — HUMAN UI/UX APPROVED.` The production baseline is recorded in `docs/QUIZ_V1_UI_UX_CHECKPOINT.md`; TASK-086 was authorized only within that checkpoint.

TASK-086 is prohibited until this task is `COMPLETE — HUMAN UI/UX APPROVED`.

## TASK-086 — Implement HUMAN-Approved Production Quiz UI

### Objective

Implement the final Quiz page and interactions exactly according to the approved checkpoint while preserving TASK-084 behavior.

### Dependencies

- TASK-085 complete with explicit HUMAN UI/UX approval.

### Expected Files / Areas

- Quiz page/components/styles in the existing frontend structure.
- Existing Set entry surfaces only as approved.
- Focused presentation/interaction tests.

### In Scope

- Type selection, ordered current question, answer form, pending/result/next flow.
- Both approved prompt presentations and accessible character feedback.
- Loading, empty, not-found, changed-item/question, retry-conflict, operational-error and completion states.
- Restart/return behavior and responsive/accessibility/reduced-motion design.

### Out of Scope

- New backend/API behavior, visual redesign outside Quiz, re-answer, score/history, SRS/rewards/Pronunciation.

### Implementation Requirements

- Backend remains the sole correctness/Progress authority.
- Protect duplicate actions; preserve retry request identity and accepted lockout.
- Manage focus after result, next question and completion.
- No color-only result, pointer-only action or horizontal overflow.
- Preserve App Layout and Flashcard/Learning UI unchanged.

### Verification

- Focused Quiz frontend tests, ESLint and production build.
- Manual/automated responsive and keyboard smoke as required by checkpoint.
- `git diff --check`, scope and secret checks.

### Mapped Acceptance Criteria

AC-01–AC-14, AC-16.

### Completion Gate / Status

`COMPLETE — AWAITING HUMAN REVIEW.` The HUMAN-approved production Quiz UI implements both prompt types, ordered progress, protected backend-authoritative submission, safe retry/conflict handling, accepted character feedback, explicit next/completion flow, transient restart and responsive/accessibility/reduced-motion presentation. The HUMAN visual-review loading investigation corrected StrictMode-safe in-flight question loading; focused Quiz tests pass 16/16, both guarded TEST Quiz types reach active UI, and ESLint/production build pass. At this historical TASK-086 checkpoint, TASK-087 had not started; this sentence does not describe the current project status.

**Historical boundary:** this completion evidence describes the former `MISSING_LETTER` contract. HUMAN visual review did not approve TASK-086 for closure and instead requested the active `UNSCRAMBLE_WORD` revision below.

## TASK-086A — Replace Missing Letter Backend/Domain Contract with Unscramble Word

### Objective

Replace only the active Quiz type contract and supporting frontend foundation shapes while preserving all established authorization, transaction, Progress and transient-run semantics.

### Dependencies

- HUMAN approval of the revised Quiz V1 SPEC, PLAN, TASK and UI/UX checkpoint.
- TASK-080 through TASK-086 historical work remains intact.

### In Scope

- Replace accepted `MISSING_LETTER` type with `UNSCRAMBLE_WORD` in backend validation, question projection and answer submission.
- Reuse the deterministic primary Meaning prompt.
- Implement NFC Unicode-code-point classification, fixed separator policy, opaque duplicate-safe tile identities, deterministic digest-backed ordering and `IDENTITY_FALLBACK`.
- Include primary Meaning and shuffle-policy inputs in opaque `question_revision` validation.
- Return no canonical/original-position answer material before submission.
- Extend backend character feedback to explicit `correct`/`incorrect`/`missing`/`extra` semantics.
- Update frontend service/run-state validation and reconciliation only as required for the new safe payload; no final tile presentation in this task.
- Replace focused and guarded backend evidence for the retired type; run scoped Learning/Progress/Set regressions and targeted TEST fixture cleanup.

### Out of Scope

- Production tile/underline presentation, broad frontend browser coverage, schema/migration, Quiz persistence, new endpoint, additional type or unrelated refactor.

### Acceptance Criteria

- Same run/question yields identical safe tile IDs/order/pattern/fallback; a new run may yield another valid order.
- Duplicate tiles remain independently identifiable without exposing canonical indexes.
- Spaces and all punctuation remain fixed and significant; selectable letters/digits are never silently dropped.
- A visibly different order is produced whenever possible; unshufflable values remain in the ordered run using `IDENTITY_FALLBACK`.
- Both read and answer endpoints remain USER-only, concealed, transactional and exactly-once with no schema or Learning-event change.
- Retired `MISSING_LETTER` is rejected by the active API.

### Verification

- Focused pure helper and API tests for determinism, leakage, Unicode, duplicates, separators, fallback and question revision.
- Guarded Quiz backend suite plus scoped Set/Learning/Progress regressions and cleanup.
- Frontend service/run-state focused tests, lint/build when affected, `git diff --check`, secret/schema/scope checks.

### Completion Boundary

`COMPLETE — HUMAN APPROVED.` Active backend/domain/API and minimum frontend foundation support only `VI_TO_ENGLISH` and `UNSCRAMBLE_WORD`. Focused backend tests pass 17/17, guarded Quiz tests pass 23/23, frontend foundation tests pass 16/16, scoped Learning/Vocabulary Set regressions pass 20/20, ESLint/build/diff checks pass, and guarded fixtures were reset.

## TASK-086B — Revise Production Quiz UI and Repeat HUMAN Visual Review

### Objective

Replace the former Missing Letter presentation with the approved accessible Unscramble interaction and use one underline-feedback presentation for both active types.

### Dependencies

- TASK-086A complete and HUMAN approved.

### In Scope

- Render safe Vietnamese prompt, pool tiles and answer slots from the backend projection.
- Click/tap/keyboard selection appends the exact tile; activating a selected answer tile returns that exact tile to its original pool position.
- Preserve duplicate identity, fixed separators, long-word wrapping, mobile touch targets and no horizontal overflow; no drag-and-drop.
- Render `IDENTITY_FALLBACK` as an answerable non-error state.
- Replace boxed character feedback for both types with shared wrapping underline feedback and explicit non-color `correct`/`incorrect`/`missing`/`extra` semantics.
- Preserve pending/retry payload identity, accepted lockout, ordered progress, completion, restart/sessionStorage, focus/live regions and reduced motion.
- Complete focused frontend tests, lint/build and guarded manual visual fixture/review evidence.

### Out of Scope

- Backend contract changes beyond TASK-086A, App Layout/Set redesign, schema/migration, persistence, drag-and-drop, new type or deferred domain.

### Acceptance Criteria

- Both active types complete through authoritative submit/feedback/next/result flows.
- Tile identity/removal/restoration works with duplicates by pointer and keyboard.
- Shared underline feedback wraps safely and remains understandable without color.
- No canonical answer exists in pre-answer DOM, stored state or service projection.
- Desktop/tablet/mobile, focus and reduced-motion behavior receive focused evidence and HUMAN visual approval.

### Verification

- Focused Quiz unit/component tests, ESLint, production build, `git diff --check`, secret/schema/scope checks.
- Guarded visual fixture and HUMAN visual review; stop before TASK-087.

### Completion Boundary

`COMPLETE — HUMAN APPROVED.` Production Quiz renders the backend-projected Unscramble tile pool and fixed answer slots with opaque duplicate-safe tile identity, exact-tile removal/restoration in authoritative pool order, usable `IDENTITY_FALLBACK`, keyboard/mobile/reduced-motion behavior, and shared wrapping underline character feedback for both active types. HUMAN visual/interaction review approved the revised flow, character alignment, separator equivalence, navigation hierarchy and modality-aware focus policy.

## TASK-087 — Add Frontend Unit, Mocked-Browser, Accessibility and Responsive Coverage

### Objective

Provide durable automated frontend evidence for every approved Quiz state and interaction without redesigning the approved UI.

### Dependencies

- TASK-086A and TASK-086B complete and HUMAN approved, including renewed visual review.

### Expected Files / Areas

- Focused Quiz service/run/page unit tests.
- Mocked Playwright Quiz coverage/config only if existing config cannot express the scope.
- Scoped Auth/App Layout/Set/Learning frontend regressions.

### In Scope

- Both complete type flows and ordered traversal.
- Loading/empty/error/retry/pending/conflict/completion and restart/resume.
- Identical retry payload, no Learning event and accepted lockout.
- Keyboard/focus/live-region/non-color/reduced-motion behavior.
- Mobile/tablet/desktop, long content and no overflow.
- Guest/ADMIN and Set entry boundaries.

### Out of Scope

- Real database/backend verification owned by TASK-088.
- UI changes except a concrete reproduced TASK-087 defect.

### Implementation Requirements

- Keep mocks explicit and independent; avoid mutable interception-order assumptions.
- Do not skip, loosen or retry away reproducible failures.
- Stop/report genuine production defects before correction unless separately authorized.

### Verification

- Exact focused unit and browser PASS/FAIL/TODO counts.
- Relevant Auth/App Layout/Set/Learning frontend regression counts.
- ESLint, production build, diff, secret and scope checks.

### Mapped Acceptance Criteria

AC-01–AC-16.

### Completion Gate / Status

`COMPLETE — HUMAN APPROVED.` Durable frontend evidence covers both ordered Quiz flows, transient resume/restart, safe navigation, loading/empty/error/retry/pending/conflict/completion states, access boundaries, accepted feedback semantics, keyboard/focus/live-region behavior, responsive overflow/touch-target invariants and reduced motion. Focused Quiz unit tests pass 27/27, focused Quiz Playwright passes 16/16, the full frontend unit suite passes 68/68 and the full mocked browser CI suite passes 57/57; ESLint, production build, `git diff --check`, and secret/scope checks pass. The existing bundle-size warning remains non-blocking. No production defect or production-code change was required.

## TASK-088 — Verify Guarded Real Stack and Cross-Feature Regressions

### Objective

Verify Quiz V1 through the real browser/backend/Prisma/dedicated TEST DB boundary and protect shared completed features.

### Dependencies

- TASK-087 complete and HUMAN approved.

### Expected Files / Areas

- Focused Quiz real-stack Playwright suite/config/fixtures.
- Existing guarded integration global setup.
- Existing Auth, Vocabulary Set, Learning and Learning Progress regression suites.

### In Scope

- Both complete Quiz types from public and owned Sets.
- Authorization/concealment, ordered all-item traversal and structural non-disclosure.
- Stable reload/new-run mask behavior.
- Correct/incorrect Progress mutation, retry no-double-count and conflict states.
- Read-only/restart/completion invariance.
- Accessibility/responsive real-stack evidence and targeted cleanup.

### Out of Scope

- Main/Preview/Production/developer DB access, migration work or unrelated full-suite expansion.
- Performance optimization for remote TEST latency.

### Implementation Requirements

- Use explicit `NODE_ENV=test`, existing guards and dedicated authorized TEST DB only.
- Use unique controlled fixtures and targeted cleanup; never delete unrelated rows.
- Run sequentially with existing shared-database conventions and leave no orphan server/listener.
- Fix only concrete in-scope regressions with HUMAN-aware reporting.

### Verification

- Exact Quiz real-stack and scoped Auth/Set/Learning/Progress counts.
- Before/after Progress invariance for reads and exact increments for accepted answers.
- Fixture/process/listener cleanup plus final diff/secret/scope checks.

### Mapped Acceptance Criteria

AC-01–AC-16.

### Completion Gate / Status

`COMPLETE — HUMAN APPROVED.` Guarded TEST DB preparation passed with all 5 migrations applied and none pending; Quiz backend verification passed 28/28. After the historical Stage 3 connectivity blocker, the four setup-only `createProgress()` fixture writes were serialized without changing product behavior, assertions or intentional concurrency coverage; focused Learning passed 12/12 and complete backend regressions passed 31/31. The recovered one-worker real-stack run passed 19/19: Quiz 3/3, Auth 2/2, Vocabulary Set public 3/3, Vocabulary Set USER 2/2, Learning 4/4 and Learning Progress 5/5. Targeted cleanup, process/listener cleanup, `git diff --check`, and scope/schema/migration/secret safety checks passed. The earlier `BLOCKED AT STAGE 3`, `STAGE 3 RECOVERED`, and `AWAITING HUMAN REVIEW` states are historical execution checkpoints; the authoritative current status is `COMPLETE — HUMAN APPROVED`. The observed remote pooled TEST DB connectivity instability remains a non-product infrastructure risk note.

## TASK-089 — Formal TEST, REVIEW and Closure Preparation

### Objective

Evaluate Quiz V1 formally against the approved contract and prepare closure without automatically marking the feature `DONE`.

### Dependencies

- TASK-080 through TASK-088 complete and individually HUMAN approved.
- TASK-085 explicit HUMAN UI/UX approval recorded.

### Expected Files / Areas

- Quiz SPEC/PLAN/TASK and synchronized status/evidence documentation.
- No production change unless review returns to an approved correction task.

### In Scope

- Trace AC-01 through AC-16 to implementation and authoritative evidence.
- Formal TEST for both types, Progress atomicity/idempotency, security, accessibility and regressions.
- Formal REVIEW for correctness, authorization, non-disclosure, maintainability, schema prohibition and scope.
- Prepare Quiz status for separate HUMAN closure authorization.

### Out of Scope

- New feature behavior, automatic closure/DONE, commit/push/merge/deploy or next feature.

### Implementation Requirements

- Reuse valid evidence; do not rerun destructive/expensive suites without a concrete gap.
- If any AC lacks evidence or a finding remains, return FAIL/PARTIAL or CHANGES_REQUIRED and do not close.
- Preserve all deferred domains and existing completed feature histories.

### Verification

- AC traceability and documentation consistency.
- Final diff, working-tree scope, schema/migration, dependency, secret/artifact and fixture-cleanup checks.
- Record exact formal TEST result and REVIEW verdict.

### Mapped Acceptance Criteria

AC-01–AC-16.

### Completion Gate / Status

`COMPLETE — HUMAN APPROVED.` Formal TEST is `PASS` for AC-01 through AC-16 and formal REVIEW is `APPROVE`, with no findings or blockers. Authoritative TASK-086B, TASK-087 and TASK-088 evidence was reused; final documentation, diff/worktree scope, schema/migration, dependency, secret/artifact and fixture-cleanup checks passed. HUMAN final closure is authorized and Quiz V1 is `DONE — HUMAN APPROVED`.

## 5. Task Execution Rules

- Preserve TASK-080 through TASK-086 as historical evidence; execute revision TASK-086A then TASK-086B with a HUMAN gate after each before resuming TASK-087 through TASK-089.
- The revised SPEC/PLAN/TASK/UI checkpoint is a hard contract gate. No revision implementation begins from this unapproved draft.
- No task may modify Prisma schema, create/edit a migration or introduce persistent Quiz Session/Attempt/history data.
- No task may add a third/mixed/adaptive Quiz, SRS/Words to Review, XP/Level/Streak/Daily Goal/Achievement, Pronunciation Practice, analytics, AI or unrelated dependency.
- Backend remains authoritative for Set access, correctness and Progress mutation; frontend never issues a second Learning event for a Quiz answer.
- Guarded DB work uses only the dedicated TEST path. Main/Preview/Production are prohibited.
- Any discovered need for persistence, new schema, historical replay, new authorization or deferred behavior stops execution and returns to HUMAN SPEC/PLAN review.

## Approval Gate

```text
ORIGINAL QUIZ V1 SPEC / PLAN / TASK: HUMAN APPROVED
HUMAN-REQUESTED REVISION: HUMAN APPROVED
IMPLEMENTATION AUTHORIZED: YES — APPROVED TASK SEQUENCE ONLY
TASK-080: COMPLETE — HUMAN APPROVED
TASK-081: COMPLETE — HUMAN APPROVED
TASK-082: COMPLETE — HUMAN APPROVED
TASK-083: COMPLETE — HUMAN APPROVED
TASK-084: COMPLETE — HUMAN APPROVED
TASK-085: COMPLETE — HUMAN UI/UX APPROVED
TASK-086: COMPLETE — HISTORICAL BASELINE; HUMAN CONTRACT REVISION REQUESTED DURING VISUAL REVIEW
TASK-086A: COMPLETE — HUMAN APPROVED
TASK-086B: COMPLETE — HUMAN APPROVED
TASK-087: COMPLETE — HUMAN APPROVED
TASK-088: COMPLETE — HUMAN APPROVED
TASK-089: COMPLETE — HUMAN APPROVED
QUIZ V1: DONE — HUMAN APPROVED
NEXT ALLOWED STAGE: SEPARATE COMMIT/PUSH AUTHORIZATION
```
