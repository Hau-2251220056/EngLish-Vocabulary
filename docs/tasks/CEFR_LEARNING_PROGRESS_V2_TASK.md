# TASKS: CEFR Learning Progress V2

**Source SPEC:** `docs/specs/CEFR_LEARNING_PROGRESS_V2_SPEC.md` — `HUMAN APPROVED — 2026-11-12`

**Source PLAN:** `docs/plans/CEFR_LEARNING_PROGRESS_V2_PLAN.md` — `HUMAN APPROVED — 2026-11-12`

**TASK status:** `HUMAN APPROVED — 2026-11-12`

**HUMAN TASK approval:** `GRANTED — TASK-001 THROUGH TASK-010`

**Implementation authorization:** `TASK-001 ONLY — HUMAN AUTHORIZED 2026-11-12`

**Database, Prisma CLI, migration execution, CI, commit, push, merge and deployment authorization:** `NO`

This document decomposes the approved V2 delta into bounded implementation tasks. TASK-001 alone is authorized for implementation on 2026-11-12. TASK-002 through TASK-010 and all database/CI operations remain separately gated.

## 1. Overview and Feature Status

CEFR Learning Path V1 and its existing pass, Learning Session, ordinary/GLOBAL SRS, Dashboard, Quiz, Speaking, XP and Streak foundations are `DONE`. CEFR Learning Progress V2 is an approved change request with approved SPEC and PLAN but no implementation. Its current implementation status is `TODO`.

The tasks extend existing modules rather than rebuild V1. They are grouped into the five approved batches and preserve:

- immutable pass snapshots and explicit completion;
- maximum ten items per session;
- current SRS scheduling/reward semantics;
- ordinary/GLOBAL SRS non-credit behavior;
- Quiz/Speaking isolation;
- monotonic entitlement; and
- all database, migration, CI and publication gates.

## 2. Dependency Graph and Authorization Boundaries

```text
BATCH 1 — DATA FOUNDATION

TASK-001 Schema, forward migration, exact V1 backfill, static safety
   ↓
TASK-002 First-credit repository contract and lock-order audit

BATCH 2 — BACKEND NORMAL/SRS

TASK-002
   ↓
TASK-003 Mode-aware pass sessions, projections, readiness and API
   ↓
TASK-004 Atomic NORMAL/SRS credit, AGAIN and backend regression

BATCH 3 — FRONTEND LEARNING

TASK-004
   ↓
TASK-005 Mode-aware pass continuation and exact SRS resume
   ↓
TASK-006 Completed-Set independent NORMAL relearning

BATCH 4 — DASHBOARD AND UX

TASK-005 ──→ TASK-007 Dashboard Current Learning simplification
   │
   └──────→ TASK-008 Pending NORMAL interaction accessibility

BATCH 5 — INTEGRATED VERIFICATION

TASK-001 THROUGH TASK-008
   ↓
TASK-009 Guarded migration, concurrency and real-stack verification
   ↓
TASK-010 Documentation synchronization, formal TEST and REVIEW
```

TASK-007 and TASK-008 may proceed in parallel only after TASK-005 is stable because they modify different primary surfaces. Tasks sharing learning-path services, repositories or `learning-foundation-page.jsx` are sequential.

Offline source/test work, schema/migration file authoring, Prisma CLI, database execution, guarded integration, CI and Git publication are distinct permissions. Approval of one does not authorize another.

## 3. Batch 1 — Data Foundation

### TASK-001: Add pass-item first-credit schema and exact V1 backfill migration

#### Objective

Add the approved nullable first-credit fields, narrowly relax pass-linked session mode constraints and author one forward migration that backfills only exact valid V1 pass-linked NORMAL evidence without completing passes or advancing entitlement.

#### Exact File Allowlist

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20261112000000_add_cefr_learning_progress_v2/migration.sql` — new
- `backend/test/learning/cefr-learning-path-migration-safety.test.js`
- `backend/test/learning/cefr-learning-path-migration-harness.js`

No other file may be edited under this task. If the migration directory name conflicts at execution time, stop for TASK amendment rather than silently renaming it.

#### Dependencies

- Approved SPEC and PLAN.
- No implementation task dependency.

#### Authorized Operations Required

- Separate HUMAN authorization for TASK-001 source/schema/migration-file edits.
- Prisma CLI and every database command remain separately prohibited.

#### Implementation Requirements

- Add exactly the five approved first-credit sources.
- Add nullable source, event UUID, session UUID and accepted-at fields to pass items.
- Enforce all-null/all-non-null integrity, event uniqueness and a restrictive source-session relationship.
- Preserve existing pass-item uniqueness and snapshot position.
- Replace only the pass-scope check so pass-linked sessions may be SET/NORMAL or SET/SRS.
- Validate exact USER, pass, Set, session and Vocabulary identity before backfill.
- Deterministically choose earliest `evidence_at`, then event UUID.
- Abort on missing, foreign, malformed, ambiguous or temporally invalid source evidence.
- Never write pass status/completion fields or path entitlement fields.
- Encode no destructive automatic rollback.

#### Acceptance Criteria Mapping

- `AC-V2-005`, `AC-V2-009`, `AC-V2-023`, `AC-V2-025`, `AC-V2-029`, `AC-V2-030`.
- Approved `HD-V2-01`, `HD-V2-02`, `HD-V2-09`.

#### Offline Tests

- Static SQL/schema assertions for fields, enum, constraints, exact source joins, deterministic rank and prohibited updates.
- Migration harness parsing only; no Prisma generation or database connection.
- `git diff --check` and targeted backend lint/syntax checks when authorized.

#### Evidence Expected from Codex

- Exact changed paths and migration checksum.
- Static test command/results.
- Proof that migration SQL contains no completion/unlock mutation.
- Explicit statement that Prisma and database commands were not run.

#### Stop Conditions

- Exact V1 evidence cannot be identified without fabrication.
- Existing completed passes cannot satisfy preflight invariants.
- Constraints cannot enforce a complete first-credit tuple.
- Safe write-quiescent rollout cannot be preserved by the approved design.

#### HUMAN Approval Gate

`HUMAN AUTHORIZED — 2026-11-12.` TASK-001 implementation only is authorized. Migration execution remains prohibited until separately authorized.

### TASK-002: Implement first-credit persistence and audit transaction lock order

#### Objective

Extend the existing learning-path repository/service with canonical first-credit reads, locks and conditional writes, and prove a consistent lock sequence before event integration.

#### Exact File Allowlist

- `backend/src/repositories/learning-path-repository.js`
- `backend/src/services/learning-path-service.js`
- `backend/test/learning/learning-path-service.test.js`
- `backend/test/learning/learning-path-authorization.test.js`

#### Dependencies

- TASK-001 schema contract authored and reviewed.

#### Authorized Operations Required

- Separate HUMAN authorization for TASK-002 backend/test edits and focused offline tests.
- No Prisma CLI or database operation.

#### Implementation Requirements

- Extend pass selects with first-credit identity.
- Add exact pass-item lock/read and conditional first-credit update.
- Return winner/existing credit and authoritative credited/remaining summary.
- Validate session/pass/Set/Vocabulary/USER alignment and active pass status.
- Preserve concealed ownership errors and inactive-pass non-credit behavior.
- Audit current session, Progress, pass, restart and completion lock order.
- Use the approved sequence or stop on an inversion that cannot be safely resolved.
- Keep source-event ordinary effects outside the repository.

#### Acceptance Criteria Mapping

- `AC-V2-005`, `AC-V2-009`, `AC-V2-015`, `AC-V2-022`, `AC-V2-023`.

#### Offline Tests

- First write, existing credit, exact replay, cross-source race result and inactive/foreign pass cases with repository fakes.
- Lock-order service tests where current harnesses support them.
- Targeted ESLint/syntax and `git diff --check`.

#### Evidence Expected from Codex

- Lock-order table covering NORMAL, SRS, completion and restart.
- Test commands/results and first-credit race assertions.
- Confirmation no controller/API/frontend behavior changed.

#### Stop Conditions

- Lock order conflicts with existing SRS Progress/reward transactions.
- Atomic conditional credit cannot be expressed with current repository transaction boundaries.
- Fix requires a new persistence model or approved PLAN change.

#### HUMAN Approval Gate

`NOT AUTHORIZED BY THIS DRAFT.` TASK-002 requires explicit HUMAN approval after TASK-001 review.

## 4. Batch 2 — Backend NORMAL and CEFR-Scoped SRS

### TASK-003: Add mode-aware pass sessions, canonical projection and readiness

#### Objective

Extend the existing pass-session API for backend-owned NORMAL/SRS batches, canonical remaining-item selection, safe session summaries and first-credit-based readiness.

#### Exact File Allowlist

- `backend/src/repositories/learning-path-repository.js`
- `backend/src/services/learning-path-service.js`
- `backend/src/controllers/learning-path-controller.js`
- `backend/src/routes/learning-path-routes.js`
- `backend/src/services/learning-session-service.js`
- `backend/src/repositories/learning-session-repository.js`
- `backend/test/learning/learning-path-service.test.js`
- `backend/test/learning/learning-path-api.test.js`
- `backend/test/learning/learning-path-activity-boundaries.test.js`

#### Dependencies

- TASK-002 complete and lock order accepted.

#### Authorized Operations Required

- Separate HUMAN authorization for TASK-003 backend/API/test edits and focused offline tests.
- No database, Prisma CLI or hosted CI.

#### Implementation Requirements

- Accept optional `mode`; normalize omission to `NORMAL`; reject unknown fields/values.
- Include normalized mode in operation replay matching.
- Select at most ten canonical uncredited pass items in position order.
- Resume a same-mode session only when it contains uncredited pass items.
- Preserve exact unresolved SRS session resume separately.
- Create pass-linked SET/SRS only through learning-path service.
- Return SRS cards/rating previews for unseen or non-due snapshot items.
- Add cards to safe exact-session read for pass-linked SRS.
- Project credited/remaining/readiness and active session summaries.
- Explicit completion uses all pass-item credits, not completed-session reconstruction.

#### Acceptance Criteria Mapping

- `AC-V2-002`, `AC-V2-006`–`AC-V2-011`, `AC-V2-020`, `AC-V2-022`.

#### Offline Tests

- Mode default/validation/replay.
- 10/11/15/20-item batch selection.
- Pristine SRS creation and non-due card projection.
- Same-mode resume, mixed-mode coexistence, expiry and ready response.
- Existing authorization/API envelope regression.

#### Evidence Expected from Codex

- API request/response examples from tests.
- Batch-boundary test results.
- Proof clients cannot attach pass IDs or Vocabulary IDs.
- Diff inventory limited to the allowlist.

#### Stop Conditions

- Safe card projection requires duplicating the scheduler.
- Same-mode serialization cannot prevent duplicate batches.
- Existing API compatibility requires changing an approved contract.

#### HUMAN Approval Gate

`NOT AUTHORIZED BY THIS DRAFT.` TASK-003 requires explicit HUMAN approval after TASK-002.

### TASK-004: Integrate atomic NORMAL/SRS credit and preserve SRS compatibility

#### Objective

Credit pass items atomically with accepted NORMAL reveals and CEFR-scoped SRS ratings, including `AGAIN`, while preserving ordinary/GLOBAL SRS, scheduler, reward and session behavior.

#### Exact File Allowlist

- `backend/src/services/learning-session-service.js`
- `backend/src/repositories/learning-session-repository.js`
- `backend/src/services/learning-service.js`
- `backend/src/services/learning-path-service.js`
- `backend/src/repositories/learning-path-repository.js`
- `backend/src/create-app.js`
- `backend/test/learning/learning.test.js`
- `backend/test/learning/learning-path-service.test.js`
- `backend/test/learning/learning-path-api.test.js`
- `backend/test/learning/learning-path-activity-boundaries.test.js`
- `backend/test/streak/streak-srs-session.test.js`

#### Dependencies

- TASK-003 complete.
- Lock-order checkpoint from TASK-002 remains valid.

#### Authorized Operations Required

- Separate HUMAN authorization for TASK-004 backend/test edits and offline checks.
- No database-backed XP/Streak tests, migration execution or CI without separate authorization.

#### Implementation Requirements

- NORMAL source evidence and first credit succeed or roll back together.
- SRS receipt/Progress/reward mutation and first credit succeed or roll back together.
- `AGAIN` credits immediately but keeps session evidence unresolved/requeued.
- Passing ratings retain existing resolution/completion behavior.
- Only pass-linked SET/SRS may accept unseen/non-due candidates.
- Ordinary SET/SRS and GLOBAL/SRS remain due-based and non-crediting.
- Replays and cross-mode races cannot add duplicate credit.
- Completed/invalidated pass cannot receive new CEFR credit.
- Add authoritative `cefr_pass` summary only to pass-linked responses.
- Preserve SRS revision, reward, XP and Streak behavior.

#### Acceptance Criteria Mapping

- `AC-V2-001`–`AC-V2-005`, `AC-V2-009`, `AC-V2-010`, `AC-V2-016`, `AC-V2-017`, `AC-V2-022`, `AC-V2-023`, `AC-V2-026`–`AC-V2-028`.

#### Offline Tests

- NORMAL success/replay/failure rollback.
- SRS all four ratings, repeated `AGAIN`, first-credit race and exact replay.
- Ordinary/GLOBAL due-only non-credit regressions.
- Scheduler pure tests and mocked reward/Streak compatibility.
- Targeted ESLint/syntax and `git diff --check`.

#### Evidence Expected from Codex

- Atomicity and deduplication test results.
- Before/after ordinary/GLOBAL SRS contract comparison.
- Confirmation no new reward or scheduler branch was introduced.
- Any database-backed checks explicitly reported `NOT RUN`.

#### Stop Conditions

- Atomic source-event/credit transaction cannot be maintained.
- `AGAIN` credit requires marking the session item resolved.
- Ordinary/GLOBAL SRS eligibility or reward rules regress.
- Lock-order audit reveals unresolved inversion.

#### HUMAN Approval Gate

`NOT AUTHORIZED BY THIS DRAFT.` TASK-004 requires explicit HUMAN approval and successful review of TASK-003.

## 5. Batch 3 — Frontend Learning

### TASK-005: Implement mode-aware pass continuation and exact SRS resume

#### Objective

Extend the Set Learning flow and frontend service validators to orchestrate NORMAL/SRS pass sessions, reconcile authoritative credit and expose separate exact-SRS versus remaining-CEFR continuation.

#### Exact File Allowlist

- `frontend/src/services/learning-path-service.js`
- `frontend/src/services/learning-session-service.js`
- `frontend/src/services/learning-service.js`
- `frontend/src/learning/learning-path-run.js`
- `frontend/src/learning/normal-learning-session.js`
- `frontend/src/learning/srs-learning-session.js`
- `frontend/src/learning/learning-run-state.js`
- `frontend/src/learning/learning-foundation-page.jsx`
- `frontend/src/session-storage/learning-session-state.js`
- `frontend/test/learning-path-service.test.js`
- `frontend/test/learning-session-service.test.js`
- `frontend/test/learning-service.test.js`
- `frontend/test/learning-path-run.test.js`
- `frontend/test/normal-learning-session.test.js`
- `frontend/test/srs-learning-session.test.js`
- `frontend/test/learning-session-state.test.js`
- `frontend/e2e/auth/learning-path-full-pass.spec.js`
- `frontend/e2e/auth/learning-srs.spec.js`

#### Dependencies

- TASK-004 backend contracts stable.

#### Authorized Operations Required

- Separate HUMAN authorization for TASK-005 frontend/test edits and focused offline/browser checks.
- Browser installation and CI remain prohibited.

#### Implementation Requirements

- Validate additive pass, cards, mode and active-session projections strictly.
- Start/resume the active pass for eligible NORMAL or SRS Set study.
- Use backend session cards for CEFR SRS, including unseen/non-due items.
- Reconcile every accepted response from authoritative session/pass state.
- Keep exact unresolved SRS session ID and queue independently resumable.
- Offer separate SRS-resume and remaining-CEFR actions.
- Preserve `AGAIN` retry/requeue and avoid local credit increments.
- Recover reload, expiry, access loss, retry and mode switch safely.
- Keep client storage USER/Set/mode/pass scoped and presentation-only.

#### Acceptance Criteria Mapping

- `AC-V2-001`–`AC-V2-010`, `AC-V2-020`, `AC-V2-026`–`AC-V2-028`.

#### Offline Tests

- Service validators and mode default.
- NORMAL-only, SRS-only and mixed state transitions.
- Exact session resume versus remaining batch.
- Repeated `AGAIN`, expiry and retry reconciliation.
- Mocked Playwright cases only if existing Chromium is available.
- Targeted ESLint, frontend build when authorized and `git diff --check`.

#### Evidence Expected from Codex

- Unit/contract command results.
- Browser result or honest `NOT RUN` reason.
- Exact pass/session identity evidence.
- Confirmation no business authority moved frontend-side.

#### Stop Conditions

- Backend projection cannot distinguish exact SRS resume from pass continuation.
- Client must infer credit or submit Vocabulary IDs.
- Existing state storage cannot be safely scoped without PLAN change.

#### HUMAN Approval Gate

`NOT AUTHORIZED BY THIS DRAFT.` TASK-005 requires explicit HUMAN approval after backend review.

### TASK-006: Enable independent NORMAL relearning for completed Sets

#### Objective

Ensure a deliberate Set Detail Flashcard entry for a historically completed Set starts fresh independent NORMAL study without mutating or recreating the completed CEFR pass.

#### Exact File Allowlist

- `frontend/src/vocabulary-sets/set-detail-primitives.jsx`
- `frontend/src/learning/learning-foundation-page.jsx`
- `frontend/src/learning/learning-run-state.js`
- `frontend/src/session-storage/learning-session-state.js`
- `frontend/test/learning-path-ui-contract.test.js`
- `frontend/test/learning-run-state.test.js`
- `frontend/e2e/auth/learning-path-full-pass.spec.js`

#### Dependencies

- TASK-005 complete.

#### Authorized Operations Required

- Separate HUMAN authorization for TASK-006 frontend/test edits and focused offline/browser checks.

#### Implementation Requirements

- Mark the existing Set Detail NORMAL action as explicit fresh-study intent.
- Clear only matching USER/Set/NORMAL stale run/session presentation state after backend confirms historical completion.
- Use ordinary non-pass NORMAL session creation.
- Preserve pending operation identities until safely reconciled.
- Never clear another USER, Set or SRS state.
- Never create or modify a completed pass or entitlement.
- Retain ordinary due-based SRS after completion.

#### Acceptance Criteria Mapping

- `AC-V2-018`; relearning boundaries from Sections 11 and 13 of the approved SPEC/PLAN.

#### Offline Tests

- Completed-run stale state, fresh independent entry and namespace isolation.
- Unfinished pass still resumes rather than clearing.
- Completed pass remains unchanged in mocked flow.
- Mocked Playwright if existing Chromium is available; targeted lint/build/diff checks.

#### Evidence Expected from Codex

- Storage keys removed/preserved in tests.
- Proof no pass mutation occurs during independent relearning.
- Browser result or `NOT RUN` limitation.

#### Stop Conditions

- Fresh intent cannot be distinguished from Dashboard/pass resume.
- Cleanup risks unrelated storage or accepted retry identities.
- Backend changes beyond approved existing ordinary NORMAL behavior are required.

#### HUMAN Approval Gate

`NOT AUTHORIZED BY THIS DRAFT.` TASK-006 requires explicit HUMAN approval after TASK-005.

## 6. Batch 4 — Dashboard and Pending UX

### TASK-007: Simplify Dashboard Current Learning presentation

#### Objective

Remove the numeric fraction/progress bar while preserving the exact active-pass Current Learning card, truthful state, responsive presentation and independent Next Suggestion.

#### Exact File Allowlist

- `frontend/src/dashboard/dashboard-page.jsx`
- `frontend/src/dashboard/dashboard-current-learning.js`
- `frontend/test/dashboard-current-learning.test.js`
- `frontend/test/learning-path-ui-contract.test.js`
- `frontend/e2e/auth/dashboard-foundation.spec.js`

#### Dependencies

- TASK-005 authoritative frontend pass state stable.

#### Authorized Operations Required

- Separate HUMAN authorization for TASK-007 frontend/test edits and focused verification.

#### Implementation Requirements

- Remove only the fraction and progressbar from Current Learning.
- Keep Set cover/title, concise backend-derived state and exact pass navigation.
- Preserve loading/error/retry/focus and mobile/tablet/desktop order.
- Keep Next Suggestion, CEFR counts, Review and metrics unchanged.
- Do not add analytics or mastery language.

#### Acceptance Criteria Mapping

- `AC-V2-020`, `AC-V2-021`; approved `HD-V2-06`.

#### Offline Tests

- UI contract and Dashboard helper tests.
- Responsive/accessibility mocked browser cases if Chromium exists.
- Targeted ESLint/build and `git diff --check`.

#### Evidence Expected from Codex

- Exact removed selectors/copy and preserved pass ID assertion.
- Next Suggestion independence evidence.
- Browser status and responsive limitations.

#### Stop Conditions

- Removing numeric UI changes navigation or pass selection.
- Test repair would weaken identity/accessibility assertions.
- Change requires unrelated Dashboard redesign.

#### HUMAN Approval Gate

`NOT AUTHORIZED BY THIS DRAFT.` TASK-007 requires explicit HUMAN approval.

### TASK-008: Refine pending NORMAL evidence interaction safely

#### Objective

Allow pronunciation playback and passive reading while a NORMAL reveal is pending, while retaining every correctness-sensitive lock, exact retry identity and accessible status/focus behavior.

#### Exact File Allowlist

- `frontend/src/learning/learning-foundation-page.jsx`
- `frontend/src/learning/flashcard-presentation.jsx`
- `frontend/test/learning-path-ui-contract.test.js`
- `frontend/test/loading-experience-ui-contract.test.js`
- `frontend/e2e/auth/learning-path-full-pass.spec.js`

#### Dependencies

- TASK-005 complete.
- May run parallel with TASK-007 only after shared frontend contracts stabilize.

#### Authorized Operations Required

- Separate HUMAN authorization for TASK-008 frontend/test edits and focused verification.
- No performance tooling, dependency/browser installation or hosted CI.

#### Implementation Requirements

- Keep reveal retry, navigation, completion, restart and mode switch blocked while result is unknown.
- Keep pronunciation audio and passive reading available.
- Expose `aria-busy` and concise live pending/success/error announcements.
- Preserve exact operation identity and current card on failure.
- Restore focus to retry or next valid action.
- Honor reduced motion and introduce no artificial delay.
- Do not optimize backend/network performance.

#### Acceptance Criteria Mapping

- `AC-V2-024`; approved `HD-V2-07`.

#### Offline Tests

- Pending control matrix, audio availability, duplicate prevention and retry focus.
- Keyboard/reduced-motion mocked browser cases when Chromium exists.
- Targeted ESLint/build and `git diff --check`.

#### Evidence Expected from Codex

- Control-by-control pending behavior table.
- Accessibility assertions and test results.
- Explicit confirmation no latency/performance refactor occurred.

#### Stop Conditions

- Safe audio cannot be separated without permitting evidence mutation.
- Retry identity or focus becomes unstable.
- Measured latency work is required to meet the request.

#### HUMAN Approval Gate

`NOT AUTHORIZED BY THIS DRAFT.` TASK-008 requires explicit HUMAN approval.

## 7. Batch 5 — Guarded Integration and Closure

### TASK-009: Execute guarded migration, concurrency and integrated regression verification

#### Objective

After all implementation batches pass focused review, prove migration safety, atomic concurrency, mixed-mode real-stack behavior and domain regressions in explicitly authorized isolated environments.

#### Exact File Allowlist

- `backend/test/learning/cefr-learning-path-migration-harness.js`
- `backend/test/learning/cefr-learning-path-migration-integration.test.js`
- `backend/test/learning/cefr-learning-progress-v2.integration.test.js` — new if required by the reviewed implementation
- `frontend/e2e/integration/cefr-learning-path-real-stack.spec.js`
- `frontend/e2e/integration/cefr-global-review-real-stack.spec.js`
- `frontend/e2e/integration/learning-real-stack.spec.js`
- `frontend/e2e/integration/dashboard-real-stack.spec.js`
- `frontend/e2e/integration/quiz-real-stack.spec.js`
- `frontend/e2e/auth/speaking-practice-flow.spec.js`

No production file may change in this verification task. A production defect returns to the owning implementation task.

#### Dependencies

- TASK-001 through TASK-008 implemented, focused tests passed and diffs reviewed.

#### Authorized Operations Required

- Separate HUMAN authorization for test edits.
- Separate explicit HUMAN authorization naming the isolated TEST database before Prisma/migration/database execution.
- Separate authorization for hosted CI or workflow dispatch.
- Existing browser/dependencies only unless separately authorized.

#### Implementation Requirements

- Rehearse exact V1 backfill and immutable-field verification.
- Prove no V1 writer can land between backfill snapshot and V2 writer activation; otherwise stop.
- Exercise concurrent NORMAL/SRS first-credit races and replay.
- Cover 10/11/15/20-item NORMAL-only, SRS-only and mixed flows.
- Verify repeated `AGAIN`, unresolved exact resume, expiry and explicit completion.
- Prove ordinary/GLOBAL SRS, Quiz, Speaking, XP and Streak regression compatibility.
- Prove cross-user/private/copied/locked boundaries and monotonic entitlement.

#### Acceptance Criteria Mapping

- Integrated evidence for `AC-V2-001` through `AC-V2-030`.

#### Offline Tests

- Static migration safety, test syntax, targeted lint and `git diff --check` before any gated environment call.
- Database/real-stack commands are not “offline” and must remain unexecuted until separately authorized.

#### Evidence Expected from Codex

- Exact environment safety preflight.
- Commands, PASS/FAIL/NOT RUN counts and artifacts.
- Before/after migration invariants and concurrency results.
- CI run IDs/URLs only if a later authorized workflow runs.

#### Stop Conditions

- Target database identity is uncertain or not isolated TEST.
- Write-quiescence cannot be guaranteed.
- Migration changes completion/unlock data.
- Any concurrency duplicate, regression or production defect appears.
- Browser/DB/CI authority is absent.

#### HUMAN Approval Gate

`NOT AUTHORIZED BY THIS DRAFT.` TASK-009 requires separate test-file, database and CI permissions; none is implied by implementation approval.

### TASK-010: Synchronize documentation and perform formal TEST/REVIEW closure

#### Objective

Synchronize active contracts after verified implementation, perform the required regression impact scan and submit formal TEST/REVIEW evidence for HUMAN acceptance without prematurely marking V2 DONE.

#### Exact File Allowlist

- `docs/ARCHITECTURE.md`
- `docs/DATABASE.md`
- `docs/API_SPEC.md`
- `docs/UI_UX_SPEC.md`
- `docs/FEATURE_STATUS.md`

The approved V2 SPEC, PLAN and TASK documents are read-only during this task except for a separately authorized approval/closure metadata update.

#### Dependencies

- TASK-009 completed with accepted evidence.

#### Authorized Operations Required

- Separate HUMAN authorization for documentation edits and formal TEST/REVIEW.
- CI rerun, commit, push, merge and deployment remain independently gated.

#### Implementation Requirements

- Document only implemented and verified schema, API, architecture and UI behavior.
- Record accurate PASS/FAIL/NOT RUN evidence and known limitations.
- Scan legacy Learning Session, ordinary/GLOBAL SRS, Quiz, Speaking, XP, Streak, Dashboard and authorization contracts.
- Keep feature `IN_PROGRESS` until IMPLEMENT, TEST, REVIEW and HUMAN approval all complete.
- Mark `DONE` only after explicit HUMAN final acceptance.
- Do not change approved requirements to fit implementation.

#### Acceptance Criteria Mapping

- Traceability and closure evidence for `AC-V2-001` through `AC-V2-030`.

#### Offline Tests

- Documentation link/contract consistency, whitespace and `git diff --check`.
- Reuse accepted TASK-009 evidence; do not rerun DB/CI without authorization.

#### Evidence Expected from Codex

- Requirement-to-test matrix.
- Changed documentation inventory.
- Formal TEST verdict, REVIEW findings and unresolved limitations.
- Explicit HUMAN acceptance request; no self-approval.

#### Stop Conditions

- Implementation differs from approved SPEC/PLAN.
- Required tests are missing or failing.
- Documentation would need to legitimize an unapproved behavior.
- HUMAN final acceptance has not been granted for a DONE transition.

#### HUMAN Approval Gate

`NOT AUTHORIZED BY THIS DRAFT.` TASK-010 and any final status/closure update require explicit HUMAN authorization.

## 8. Global Execution Rules

- Execute tasks only in dependency order unless the graph explicitly permits parallel work.
- Before each task, verify branch, HEAD, index, tracked status and exact allowlist.
- Preserve sibling worktrees and original UI skill directories.
- Never use broad staging, destructive Git or database commands.
- Do not install dependencies or browsers without authorization.
- Do not silently expand an allowlist. Stop and request TASK amendment if another file is essential.
- Existing valid tests may be run read-only even when not edited, subject to the task’s operation authorization.
- Database, Prisma, guarded real-stack, CI and publication permissions are always explicit and separate.
- Every implementation batch ends with combined diff review and HUMAN checkpoint.

## 9. TASK Approval Gate

```text
SOURCE SPEC: HUMAN APPROVED — 2026-11-12
SOURCE PLAN: HUMAN APPROVED — 2026-11-12
TASK STATUS: HUMAN APPROVED — 2026-11-12
HUMAN TASK APPROVAL: GRANTED — TASK-001 THROUGH TASK-010
TASK-001 IMPLEMENTATION: HUMAN AUTHORIZED — 2026-11-12
TASK-002 THROUGH TASK-010 IMPLEMENTATION: NOT AUTHORIZED
TASK-001 SCHEMA / MIGRATION FILE CREATION: HUMAN AUTHORIZED — 2026-11-12
PRISMA / DATABASE / MIGRATION EXECUTION AUTHORIZED: NO
DEPENDENCY / BROWSER INSTALLATION AUTHORIZED: NO
CI / COMMIT / PUSH / MERGE / DEPLOYMENT AUTHORIZED: NO
NEXT ALLOWED ACTION: Implement and report TASK-001 only, then stop for HUMAN review
```

TASK-001 alone may execute under the explicit authorization dated 2026-11-12. TASK-002 through TASK-010 still require separate implementation authorization. TASK approval does not authorize Prisma CLI, database, CI, Git publication or deployment operations.
