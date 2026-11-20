# TASKS: Learning Session V1

**Status:** `AWAITING HUMAN APPROVAL`

## 1. Overview

Implement the HUMAN-approved Learning Session V1 SPEC and PLAN as a transient, same-tab session layer across NORMAL Flashcard, SRS Flashcard, Multiple Choice Quiz and Speaking Practice. The work preserves Backend-authoritative Quiz/SRS behavior, uses at most 10 distinct Vocabulary IDs per batch, retains immutable full-run order for NORMAL/Quiz/Speaking, and adds no database session/history model, dependency, XP, Mastery or cross-device synchronization.

This TASK document authorizes no implementation until HUMAN approval. Existing completed learning foundations are modified in place; they are not rebuilt.

## 2. Feature Status and Scope Gate

- `docs/FEATURE_STATUS.md` currently records the existing Vocabulary Learning Session and Flashcard foundations as `DONE`, SRS as closed/DONE, and the active Multiple Choice Quiz replacement as `IN_PROGRESS` pending verification.
- Learning Session V1 is an approved change request over those foundations. During implementation its active status must be documented as `IN_PROGRESS`; no affected foundation becomes `DONE` for this change until implementation, TEST, REVIEW and HUMAN approval complete.
- No task authorizes a Prisma/schema/migration change, new persistent Learning/Quiz/Speaking entity, new dependency, new external service, new role, XP/Mastery/Daily Goal/reminders, or altered Quiz grading/SRS scheduling algorithm.

## 3. Dependency Order

```text
TASK-LS-01 Active contract documentation/status
        ↓
TASK-LS-02 Resilient isolated session storage
        ↓
TASK-LS-03 Ordered snapshot/batching/reconciliation primitives
        ├──────────────┬────────────────┬─────────────────┐
        ↓              ↓                ↓                 ↓
TASK-LS-04       TASK-LS-05       TASK-LS-06        TASK-LS-09
NORMAL           SRS state         Quiz Backend       Speaking state
        │              │                ↓                 ↓
        │              │          TASK-LS-07        TASK-LS-10
        │              │          Quiz state/API     Speaking UI
        │              │                ↓                 │
        │              │          TASK-LS-08              │
        │              │          Quiz UI/recovery         │
        └──────────────┴────────────────┴─────────────────┘
                               ↓
                    TASK-LS-11 Focused regression coverage
                               ↓
                    TASK-LS-12 Focused UI/UX Review
                               ↓
                    TASK-LS-13 Final local/offline TEST gate
                               ↓
                    TASK-LS-14 Guarded isolated-CI integration
                               ↓
                    TASK-LS-15 Formal REVIEW and HUMAN handoff
```

TASK-LS-04, TASK-LS-05, TASK-LS-06 and TASK-LS-09 may begin after TASK-LS-03 when separate agents/worktrees are explicitly authorized, but shared files and fixtures must be coordinated. In the current shared worktree, execute sequentially to avoid overlapping edits.

## 4. Verification Levels

- **Quick targeted verification:** narrow syntax or directly affected unit test files run immediately after a task. It is feedback for implementation, not the formal TEST verdict.
- **Focused regression verification:** TASK-LS-11 consolidates relevant Learning, Quiz, Speaking and mocked-browser coverage after all mode integrations are present.
- **Feature-wide local/offline TEST:** TASK-LS-13 uses the Test Skill for lint, build, relevant full unit suites, mocked Playwright and static/legacy scans.
- **Guarded integration:** TASK-LS-14 runs database-backed Backend and Playwright integration only in the approved isolated CI environment. It must remain `NOT RUN` locally.
- **Formal acceptance:** TASK-LS-15 uses the Review Skill after all required TEST evidence exists. HUMAN approval is still required before status closure.

## TASK-LS-01: Synchronize active contracts and mark the workstream IN_PROGRESS

**Objective:** Update active documentation before implementation so the approved transient-session and bounded Quiz contracts are explicit and the change is tracked without prematurely claiming completion.

**Dependencies:** None.

**Files / modules:**

- `docs/API_SPEC.md` — unchanged Learning `NORMAL` manifest reuse; bounded `vocabulary_ids`; atomic 400/404/409 contract; unchanged answer endpoint.
- `docs/UI_UX_SPEC.md` — session lifecycles, exact Vietnamese labels, completion/empty/restoration behavior.
- `docs/ARCHITECTURE.md` — client-owned versioned session state, memory fallback and no server persistence.
- `docs/FEATURE_STATUS.md` — Learning Session V1 change workstream marked `IN_PROGRESS` while preserving existing closure history.
- Approved SPEC/PLAN/TASK remain approval evidence and are not rewritten as implementation evidence.

**Implementation constraints:** Documentation must match the approved SPEC/PLAN exactly. Do not change `DATABASE.md` or high-level product scope unless an actual stale contradiction is found and returned for approval.

**Acceptance criteria:**

- Active docs describe maximum-10 batches, stable snapshots, explicit continuation/restart and same-tab persistence.
- Quiz docs define the Learning `NORMAL` manifest and atomic bounded-read errors without `removed_vocabulary_ids`.
- No docs claim implementation, tests or review are complete.

**Quick verification:** Targeted documentation search for stale all-Set session assumptions, obsolete Quiz response metadata, forbidden XP/Mastery/session persistence, and `git diff --check` limited to documentation.

**Risk / rollback:** A premature contract mismatch can mislead later tasks. Roll back only these active-doc edits if TASK approval is withdrawn; preserve historical approved documents.

**Completion gate:** HUMAN-approved contracts are reflected consistently and status is `IN_PROGRESS`; no source/test file changed.

## TASK-LS-02: Add resilient versioned session storage and identity isolation

**Objective:** Provide one dependency-free storage adapter and mode-owned identities scoped by schema version, authenticated USER, Set and stable learning mode.

**Dependencies:** TASK-LS-01.

**Files / modules likely affected:**

- Create `frontend/src/session-storage/resilient-session-store.js`.
- `frontend/src/learning/learning-session-storage-observer.jsx`.
- `frontend/src/quiz/quiz-session-storage-observer.jsx`.
- `frontend/src/app-router.jsx` — mount the thin Speaking cleanup observer when introduced.
- Mode state modules and focused frontend tests for storage/cleanup behavior.

**Implementation constraints:** Use `sessionStorage` with a module-owned in-memory `Map` fallback; never use `localStorage`, cookies or Backend persistence. Store no credentials, card payloads, Quiz correct markers or Speaking recognition data. Clear only ELVocab-owned prefixes on logout/auth invalidation. Keep NORMAL and SRS records independent; an optional last-tab preference must not merge them.

**Acceptance criteria:**

- Read/write/remove failures, quota errors and `SecurityError` do not block learning.
- Successful mutations update memory so a later native write failure retains page-lifetime state.
- Malformed, unsupported-version and wrong-identity records fail closed to fresh authorized state.
- USER/Set/mode namespaces cannot overwrite one another; logout clears native and fallback values without touching unrelated keys.

**Quick verification:** Run only new/affected storage and observer unit tests through `cd frontend; node --test <focused-test-files>`; do not run the full frontend suite yet.

**Risk / rollback:** Namespace mistakes can leak another USER's cursor or delete unrelated storage. Keep the adapter isolated and versioned; rollback removes only the new owned namespace and observer wiring.

**Completion gate:** Focused storage/isolation tests pass and storage failure never triggers an API mutation.

## TASK-LS-03: Implement ordered snapshot, batching and reconciliation primitives

**Objective:** Add shared pure helpers for immutable ordered exact-ID snapshots, fixed at-most-10 batches, cursors and deterministic reconciliation.

**Dependencies:** TASK-LS-02.

**Files / modules likely affected:**

- Shared pure helpers beside `frontend/src/session-storage/` or the approved narrowly scoped shared location.
- `frontend/src/learning/learning-run-state.js`.
- `frontend/src/quiz/quiz-run-state.js`.
- Speaking run-state module introduced by TASK-LS-09.
- `frontend/test/learning-run-state.test.js`, `quiz-run-state.test.js`, and focused shared-helper tests.

**Implementation constraints:** Use exact Vocabulary IDs, never spelling or indices as identity. Preserve the original full-run order and fixed batch boundaries. Remove inaccessible IDs without refill/repartition/substitution; ignore additions until explicit full restart. Completed lifecycle state survives Set edits. SRS may reuse validation primitives but does not use a full-Set remainder snapshot.

**Acceptance criteria:**

- Batch matrices `0,1,9,10,11,20,21` never exceed 10 distinct IDs.
- Add/remove/reorder reconciliation preserves relative original order, completed work and safe cursor selection.
- Empty intermediate batches are skipped by reconciliation without inserting replacements.
- Duplicate/malformed input is rejected and no helper mutates authoritative Progress or schedules.

**Quick verification:** Focused pure unit tests, including property/matrix-style reconciliation cases; no browser suite.

**Risk / rollback:** Index-based reconciliation can repeat or skip valid items. Keep helpers pure and exact-ID based; rollback mode integrations before removing shared helpers.

**Completion gate:** Deterministic helper tests prove stable batches and no-addition/no-refill invariants.

## TASK-LS-04: Integrate NORMAL Flashcard session lifecycle

**Objective:** Apply stable batches and restoration to NORMAL Flashcard while preserving flip, audio and Previous/Next and requiring explicit final-card completion.

**Dependencies:** TASK-LS-03.

**Files / modules likely affected:**

- `frontend/src/learning/learning-run-state.js`.
- `frontend/src/learning/learning-foundation-page.jsx`.
- `frontend/src/learning/learning-presentation.js` and narrowly related styles/tests.
- `frontend/src/services/learning-service.js` only if response validation must expose existing ordered IDs more directly.

**Implementation constraints:** Use authoritative `mode=NORMAL` order; maximum 10 per batch. Reaching/revealing the last card is not completion. Only **Hoàn thành phiên** completes the batch. NORMAL must never call `POST /api/learning/events` or add familiarity assessment.

**Acceptance criteria:**

- Unfinished batches resume to the same valid exact ID and completed screens persist on re-entry.
- Final-card action, **Học tiếp N từ**, and **Học lại từ đầu** appear only in their approved states with accurate reconciled `N`.
- Restart captures latest content without changing durable Progress/SRS.
- Audio/TTS is cancelled safely on completion, target change and navigation.

**Quick verification:** Focused Learning state/presentation/page unit tests; one narrow mocked route test only if the unit harness cannot prove the final-card transition. Do not run full Playwright.

**Risk / rollback:** Shared Learning page changes can regress SRS. Keep mode branches explicit and run a narrow SRS smoke unit alongside NORMAL tests.

**Completion gate:** NORMAL acceptance tests pass and network assertions prove zero Learning event mutations.

## TASK-LS-05: Integrate bounded SRS session lifecycle

**Objective:** Limit a fresh Backend-authoritative SRS eligibility result to the first 10 distinct cards while retaining the existing queue, rating, revision and scheduling behavior.

**Dependencies:** TASK-LS-03. Coordinate with TASK-LS-04 because both touch Learning state/page files.

**Files / modules likely affected:**

- `frontend/src/learning/learning-run-state.js`.
- `frontend/src/learning/learning-foundation-page.jsx` and presentation helpers.
- Existing Learning/SRS unit and mocked-browser fixtures.
- Backend scheduler/service code is expected to remain unchanged.

**Implementation constraints:** Slice only after Backend eligibility and deterministic priority ordering. Do not force future-due items or dynamically inject newly due items. Preserve all four ratings, `AGAIN` spacing/requeue, fixed distinct denominator, pending `event_id`, expected revision and no optimistic mutation.

**Acceptance criteria:**

- At most 10 distinct eligible IDs enter a session; `AGAIN` may add presentations but never a distinct denominator entry or duplicate pending occurrence.
- `HARD`/`GOOD`/`EASY` complete an item only after accepted Backend response.
- Completion, currently-up-to-date and genuinely empty states remain distinct; **Ôn tiếp** performs a fresh authoritative GET.
- Future due metadata remains accessible and concurrent revision/membership conflicts reconcile safely.

**Quick verification:** Focused `learning-run-state`, presentation and scheduler unit tests; do not run database-backed `learning.test.js` locally.

**Risk / rollback:** Capping before eligibility/order changes SRS behavior. Assert the cap is frontend-only after the finalized response and keep scheduler/event modules unchanged.

**Completion gate:** Focused tests preserve the approved `AGAIN`, revision, future-due and no-forced-item contracts.

## TASK-LS-06: Extend Quiz question read with atomic bounded authorization

**Objective:** Add secure optional `vocabulary_ids` bounded reads while preserving omission compatibility and the existing answer endpoint.

**Dependencies:** TASK-LS-03 and TASK-LS-01 API documentation.

**Files / modules likely affected:**

- `backend/src/services/quiz-service.js`.
- `backend/src/repositories/quiz-repository.js` only if the existing accessible-Set projection needs a minimal selection helper.
- `backend/src/controllers/quiz-controller.js` only for already-approved safe error mapping if required.
- `backend/test/quiz/quiz-read.test.js`, `quiz-answer.test.js`, `quiz.integration.test.js`.

**Implementation constraints:** Parse exactly one comma-separated scalar with 1–10 unique UUIDs. Authorize the Set first, then require every submitted ID to be a current Set member and every requested question to be buildable. Mixed valid/invalid input fails atomically with no partial questions or membership echo. Continue using the complete authorized Set plus canonical-safe fallback only as distractor pools. Do not change `POST /api/quiz/answers`, grading, revisions, event retry, Progress semantics or omission behavior.

**Acceptance criteria:**

- Malformed, empty, repeated-key, duplicate, unknown-field and over-limit input returns `400 QUIZ_VALIDATION_ERROR`.
- Missing/inaccessible Set returns concealed `404 QUIZ_SET_NOT_FOUND` before submitted-ID disclosure.
- Foreign-private, other-Set, removed/non-member and ineligible IDs produce safe `409` errors with no failing-ID detail.
- Four-choice construction failure returns atomic `409 QUIZ_CHOICES_UNAVAILABLE`; success returns every requested question in submitted order and no `removed_vocabulary_ids`.
- Omitted `vocabulary_ids` retains the existing all-Set read for non-session compatibility.

**Quick verification:** `cd backend; node --test --test-concurrency=1 test/quiz/quiz-read.test.js test/quiz/quiz-answer.test.js`. Keep DB integration `NOT RUN` locally.

**Risk / rollback:** Client-controlled IDs are not authorization. Backend independently validates the entire list. Rollback removes optional bounded parsing/selection while leaving the old read and answer paths intact.

**Completion gate:** Focused backend unit tests cover all approved 400/404/409 and mixed-batch cases, and answer regression tests remain unchanged/passing.

## TASK-LS-07: Integrate Quiz manifest, API client and batch-aware run state

**Objective:** Reuse the authorized Learning `NORMAL` response as current membership input and evolve Quiz state/service for immutable snapshots, fixed batches and run-bound answer state.

**Dependencies:** TASK-LS-06 and TASK-LS-03.

**Files / modules likely affected:**

- `frontend/src/services/learning-service.js` and `quiz-service.js`.
- `frontend/src/quiz/quiz-run-state.js`.
- `frontend/test/learning-service.test.js`, `quiz-service.test.js`, `quiz-run-state.test.js`.

**Implementation constraints:** Fetch the Learning manifest before every bounded read. New runs snapshot its Backend order; restored runs intersect against it in original order, exclude additions and never refill. Keep accepted and pending attempts bound to their current `run_id` and revisions. Store no correct-choice marker before accepted feedback.

**Acceptance criteria:**

- Initial, restore, next-batch and retry reads all perform fresh authorized membership reconciliation first.
- Bounded query serialization is exact and response validation rejects partial/mismatched question sets.
- Same-run reload retains accepted/pending distinction; new-run retry clears choices, selection, event, result and revisions while preserving durable Backend Progress.
- Completed result and full-run lifecycle persist independently of fresh content changes.

**Quick verification:** Focused Quiz/Learning service and Quiz state unit tests; no browser suite.

**Risk / rollback:** Treating manifest data as Quiz authority would weaken validation. The frontend uses it only for reconciliation; TASK-LS-06 remains authoritative.

**Completion gate:** State/service tests prove manifest-before-read, stable order/boundaries and run isolation.

## TASK-LS-08: Integrate Quiz UI, completion, retry and one-shot stale recovery

**Objective:** Connect batch-aware state to the existing Quiz Focus Mode and implement explicit continuation, current-batch retry and bounded conflict recovery.

**Dependencies:** TASK-LS-07.

**Files / modules likely affected:**

- `frontend/src/quiz/quiz-foundation-page.jsx`.
- `frontend/src/quiz/quiz-presentation.js`, `quiz-navigation.js` and narrowly related styles.
- Quiz unit tests and mocked API fixtures.

**Implementation constraints:** Preserve authoritative submit/feedback and pending retry. A read-time `QUIZ_ITEM_CHANGED` or `QUIZ_CHOICES_UNAVAILABLE` may trigger exactly one fresh manifest reconciliation and deliberate read retry when a non-empty batch remains; repeated conflict renders a recoverable error and must not loop. Restoration or recovery never automatically posts an answer.

**Acceptance criteria:**

- Completed batch result persists and exposes separate **Học tiếp N từ** and **Làm lại nhóm này** actions where applicable.
- Retry uses the same still-valid batch IDs, a new `run_id`, and fresh questions/revisions without advancing or undoing accepted Progress.
- Continue cannot occur before completion; full completion persists until **Học lại từ đầu**.
- One-shot stale recovery is bounded, handles an emptied batch truthfully and never replays accepted/pending submissions.

**Quick verification:** Focused Quiz route/state/presentation/navigation unit tests and mocked request-count assertions for the one-shot path; defer full `quiz-flow.spec.js`/`quiz-focus.spec.js` runs to TASK-LS-11.

**Risk / rollback:** An effect dependency can create request loops or answer replay. Use explicit load-generation/attempt ownership and assert bounded GET counts plus zero recovery POSTs.

**Completion gate:** Focused tests prove result persistence, fresh-run retry and bounded non-mutating recovery.

## TASK-LS-09: Add Speaking positional batch state and persistence boundary

**Objective:** Add versioned USER/Set/mode Speaking state containing only ordered IDs, batch/cursor and lifecycle.

**Dependencies:** TASK-LS-03.

**Files / modules likely affected:**

- Create `frontend/src/pronunciation/speaking-practice-run-state.js` or approved equivalent beside page-session helpers.
- `frontend/src/pronunciation/speaking-practice-page-session.js`.
- New/affected Speaking state/page-session tests.
- Thin Speaking storage cleanup observer and `frontend/src/app-router.jsx` integration from TASK-LS-02.

**Implementation constraints:** Use existing authorized Learning `NORMAL` payload/order. Never persist transcripts, alternatives, confidence, results, issues, raw audio, scores, recognition phase, attempts or disclosure state. Resume only to a safe idle/ready target.

**Acceptance criteria:**

- Batches contain at most 10 stable original IDs; additions are excluded and removals reconcile without refill.
- Same-tab cursor and completion restore; recognition output never restores.
- Logout/auth invalidation clears only the owned Speaking namespace.

**Quick verification:** Focused Speaking page-session/run-state/storage tests; no microphone or live browser-vendor call.

**Risk / rollback:** Accidental serialization can violate privacy. Use an explicit allowlisted state shape and tests that reject recognition fields.

**Completion gate:** Serialized state contains only approved positional fields and passes privacy assertions.

## TASK-LS-10: Integrate Speaking batches and lifecycle cleanup

**Objective:** Apply Speaking run state to the current recognition/playback UI with safe continuation, restart and cleanup.

**Dependencies:** TASK-LS-09.

**Files / modules likely affected:**

- `frontend/src/pronunciation/speaking-practice-page.jsx`.
- `speaking-practice-state.js`, `speaking-practice-presentation.js`, and page-session helpers.
- Existing recognition controller/adapter/playback coordinator only when needed for established cancellation hooks.
- Focused Speaking tests.

**Implementation constraints:** Preserve microphone disclosure/permission, recognition classification, retry, skip and Previous/Next. Before target, batch, restart, visibility or navigation changes, use existing cancel/dispose/generation ownership and stop playback. Do not change recognition scoring or add Backend calls/persistence.

**Acceptance criteria:**

- Re-entry restores the target but never auto-starts recognition or displays old feedback.
- Completion persists; **Luyện tiếp N từ** uses actual next size and **Học lại từ đầu** captures latest content.
- Stale callbacks cannot update a new target/session, and leaving the page releases recognition/playback resources.
- No Learning Progress, XP or SRS mutation occurs.

**Quick verification:** Focused Speaking controller/page/presentation/accessibility unit tests with mocked recognition; defer full mocked Playwright to TASK-LS-11.

**Risk / rollback:** Late recognition events can contaminate another item. Retain generation ownership and cancellation tests; rollback UI binding without changing the established adapter.

**Completion gate:** Lifecycle/cleanup tests pass and persistence/network assertions enforce privacy and no mutation.

## TASK-LS-11: Consolidate focused regression and mocked-browser coverage

**Objective:** Add/update proportional regression coverage after all four modes and the API contract are integrated.

**Dependencies:** TASK-LS-04, TASK-LS-05, TASK-LS-08 and TASK-LS-10.

**Files / modules likely affected:**

- Relevant `frontend/test/*learning*`, `*quiz*`, `*speaking*` tests.
- `frontend/e2e/auth/learning-srs.spec.js`.
- `frontend/e2e/auth/quiz-flow.spec.js`, `quiz-focus.spec.js` and `fixtures/quiz-api.js`.
- `frontend/e2e/auth/speaking-practice-flow.spec.js`, `speaking-practice-focus.spec.js`.
- Backend Quiz/Learning test fixtures and active mock helpers.

**Implementation constraints:** Replace obsolete all-Set assumptions rather than deleting protection. Cover `10/11/21`, add/remove/reorder, preserved completion, storage denial, USER isolation, accurate labels/focus/responsive states, SRS `AGAIN`/future due, Quiz atomic errors/recovery, and Speaking cleanup/privacy. No live microphone or database.

**Acceptance criteria:**

- Mocked browser tests exercise direct start, same-tab resume, explicit continuation/restart and completion preservation in every affected mode.
- Legacy/regression scan covers callers, mocks, selectors, routes, storage prefixes and active docs.
- Tests continue asserting no NORMAL/Speaking mutations and no distractor Progress target.

**Quick verification:** Run affected frontend unit files and only the five affected mocked Playwright specs/configured projects (`learning-srs`, two Quiz and two Speaking specs), not every repository browser suite. Record exact commands/results for TASK-LS-13.

**Risk / rollback:** Broad fixture rewrites can hide regressions. Keep authorization, identity, revision, retry, accessibility and privacy assertions while updating only obsolete run-size behavior.

**Completion gate:** Focused regression set is green or failures are reported and returned to the owning implementation task.

## TASK-LS-12: Run Focused UI/UX Review

**Objective:** Use the repository `ui-ux-review` skill in Focused mode on changed Learning, Quiz and Speaking surfaces before HUMAN visual approval.

**Dependencies:** TASK-LS-11.

**Files / modules:** Changed UI components, styles, mocked fixtures and UI/UX documentation; review is read-only unless findings are routed back through the owning implementation task.

**Implementation constraints:** Review objective interaction, responsive, accessibility and visual-consistency risks only. Full UI/UX Review requires separate HUMAN request. Do not waive functional TEST requirements.

**Acceptance criteria:** Keyboard/focus/live-region behavior, disabled/pending semantics, 44px touch targets, long-content wrapping, 200% zoom, narrow/landscape layouts, reduced motion and truthful completion/error states have evidence. Any blocking finding is fixed and re-reviewed before proceeding.

**Verification:** Focused skill report plus the smallest mocked screenshots/interactions required by that skill; no database-backed environment.

**Risk / rollback:** Visual fixes can alter state behavior. Route functional changes back to TASK-LS-04/05/08/10 and rerun their focused checks.

**Completion gate:** Focused UI/UX verdict has no unresolved blocking finding and HUMAN visual review can be requested when required.

## TASK-LS-13: Execute final local/offline TEST Skill gate

**Objective:** Run the formal Test Skill over all locally safe evidence after implementation and focused UI/UX review.

**Dependencies:** TASK-LS-12.

**Files / modules:** No new feature scope; test fixes may modify only approved tests/implementation and must return to the owning task when behavior changes.

**Implementation constraints:** Distinguish quick task checks from this feature-wide gate. Do not prepare or connect to a local database. Do not mark guarded suites passing when not run.

**Verification categories / commands:**

- Backend non-DB Quiz and pure SRS tests with direct `node --test` commands that exclude `quiz.integration.test.js` and DB-backed `learning.test.js`.
- Relevant/full frontend unit suite: `cd frontend; npm test` when proportional and stable.
- Affected mocked Playwright through the repository config/spec filters; no integration config.
- `cd frontend; npm run lint` and `npm run build`.
- `git diff --check`, changed-file/scope audit, secret scan and legacy/stale-reference scan.
- Process/listener cleanup and truthful `NOT RUN` entries for guarded integration.

**Acceptance criteria:** Formal TEST report maps approved acceptance criteria to evidence, reports exact pass/fail/not-run status, and contains no unresolved critical local failure.

**Risk / rollback:** Do not weaken or delete tests to obtain green results. Return failures to the responsible task and repeat proportional verification.

**Completion gate:** Test Skill verdict permits guarded CI; all required local/offline checks pass or have an explicitly approved exception.

## TASK-LS-14: Run guarded integration only in approved isolated CI

**Objective:** Verify real authorization, membership, Progress and concurrency behavior in the existing safeguarded TEST database environment.

**Dependencies:** TASK-LS-13 and explicit availability of the approved isolated CI environment.

**Files / modules:** Existing CI configuration and guarded suites only; no production database or unapproved workflow redesign.

**Implementation constraints:** Never run database preparation, Backend integration or real-stack Playwright locally. Use existing CI safeguards and ephemeral TEST data. Speaking remains mocked; no live microphone/vendor call.

**Verification categories / commands in CI only:**

- Backend guarded suites including `npm run test:integration:ci` or the narrower approved Learning/Quiz equivalent.
- Frontend real-stack coverage via `npm run test:integration:ci` with affected Learning/Quiz specs.
- Quiz bounded read 400/404/409, mixed atomic rejection, fresh-run revision/idempotency and no distractor mutation.
- SRS `AGAIN`, eligibility/future due/revision and no duplicate mutation.
- USER isolation, public/owned/foreign-private access, Set Item removal between read and mutation, repeated read no-write, and accepted Progress survival.

**Acceptance criteria:** Guarded evidence is green and tied to the intended branch/commit; failures are reported without production impact. If CI is unavailable, status remains `NOT RUN` and final approval is blocked rather than guessed.

**Risk / rollback:** Wrong database targeting is destructive. CI guards must verify isolated TEST configuration before setup; abort on uncertainty.

**Completion gate:** Required guarded suites pass in isolated CI with captured evidence, or the workflow stops as blocked.

## TASK-LS-15: Formal Review Skill, HUMAN approval and status closure

**Objective:** Perform final repository Review Skill assessment against the approved SPEC, PLAN, TASK and TEST evidence, then request HUMAN approval before closure.

**Dependencies:** TASK-LS-14.

**Files / modules:** Entire scoped Git diff, active documentation, implementation/tests and evidence. `docs/FEATURE_STATUS.md` changes from `IN_PROGRESS` to the appropriate completed state only after Review APPROVE and HUMAN authorization.

**Implementation constraints:** Review scope, architecture, authorization, Quiz/SRS integrity, storage privacy, Speaking cleanup, regression evidence and unrelated-file preservation. Do not commit, push, merge or mark DONE merely because code/tests exist.

**Acceptance criteria:**

- No unresolved BLOCKER/HIGH finding or hidden scope expansion.
- TEST evidence includes guarded CI and truthful command results.
- No schema/dependency/XP/Mastery/session-history change exists.
- HUMAN explicitly approves final closure before feature-status completion.

**Verification:** Review Skill report with `APPROVE`, `CHANGES_REQUIRED` or `BLOCKED`; `git status`, diff/stat, stash and manual Speaking fixture preservation checks.

**Risk / rollback:** If review identifies implementation/design/requirement issues, return respectively to IMPLEMENT/TASK, PLAN or SPEC; do not patch around approval gates.

**Completion gate:** Review APPROVE plus HUMAN approval; only then synchronize final feature status. Commit/push/merge remain separate HUMAN-authorized actions.

## 5. Global Execution Guardrails

- Preserve the untracked manual Speaking fixture, `stash@{0}`, existing branches, `main` and unrelated local files.
- Do not discard, reset, stash, overwrite or broadly format existing work.
- Do not add packages, migrations, schema changes, permanent session/history data or external services.
- Backend remains authoritative for Quiz correctness, SRS scheduling, authorization and Progress mutations.
- Session restoration, storage fallback, completion rendering and stale-manifest recovery must never automatically replay an accepted Quiz answer or SRS rating.
- All accepted Quiz/SRS mutations remain durable across retry, restart, storage loss and rollback.
- Any need to change approved business behavior returns to SPEC; any need to change the approved architecture/API design returns to PLAN.

## 6. TASK Skill Result

`PASS` — all approved PLAN workstreams are covered in dependency order, quick verification is separated from final testing, guarded database verification is CI-only, and no unresolved HUMAN decision blocks implementation.

```text
SPEC STATUS: HUMAN APPROVED / REVIEW APPROVE
PLAN STATUS: HUMAN APPROVED / REVIEW APPROVE
TASK STATUS: AWAITING HUMAN REVIEW
IMPLEMENTATION AUTHORIZED: NO
```
