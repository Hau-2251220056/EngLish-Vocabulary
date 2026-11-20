# TASKS: Multiple Choice Quiz V1

**Status:** `APPROVED FOR IMPLEMENTATION BY HUMAN REQUEST`

## Overview

Replace active typed/Unscramble Quiz behavior with one backend-authoritative, Set-scoped `MULTIPLE_CHOICE` flow while retaining authorization, exact Vocabulary identity, transactional Progress, idempotency, concurrency and SRS invariants.

## Feature status

Current status: `IN_PROGRESS`. Existing Quiz V1 was DONE; this approved replacement modifies it in place and reuses completed architecture.

## Dependency graph

```text
TASK-MCQ-01 Domain rules/tests
        ↓
TASK-MCQ-02 Repository candidate access
        ↓
TASK-MCQ-03 Service/API grading
        ↓
TASK-MCQ-04 Backend contract tests
        ↓
TASK-MCQ-05 Frontend service/run state
        ↓
TASK-MCQ-06 Accessible responsive UI
        ↓
TASK-MCQ-07 Frontend/browser regressions
        ↓
TASK-MCQ-08 Documentation and offline verification
```

## TASK-MCQ-01: Deterministic Multiple Choice domain

**Objective:** Replace typed/Unscramble helpers with normalized-label, deterministic candidate/choice and revision helpers.

**Files:** `backend/src/services/quiz-domain.js`, `backend/test/quiz/quiz-read.test.js`.

**In scope:** primary Meaning reuse; normalized Vietnamese uniqueness; set-first/canonical candidate handling; opaque IDs; deterministic ordering/revision.

**Out of scope:** database writes, UI and schema changes.

**Acceptance:** same run/inputs reconstruct identically; ambiguous labels are removed; exactly three distractors or a safe unavailable result; IDs expose no source/correctness.

**Verification:** focused backend unit tests and syntax.

## TASK-MCQ-02: Canonical-safe repository projections

**Dependencies:** TASK-MCQ-01.

**Objective:** Supply ordered Set questions and canonical-only fallback candidates for read and transactional reconstruction.

**Files:** `backend/src/repositories/quiz-repository.js`, repository assertions in Quiz tests.

**In scope:** `owner_id = null`, exclude Set identities, deterministic Meaning projection, existing locks/Progress access.

**Out of scope:** private outside-Set fallback, schema/index changes.

**Acceptance:** no foreign/own private outside candidate can be returned; question membership and exact ID remain authoritative.

**Verification:** repository-shape unit tests; guarded DB behavior later.

## TASK-MCQ-03: Multiple Choice service and API

**Dependencies:** TASK-MCQ-01–02.

**Objective:** Make `MULTIPLE_CHOICE` the sole contract and grade opaque selected choices transactionally.

**Files:** `backend/src/services/quiz-service.js`, `backend/src/controllers/quiz-controller.js`.

**In scope:** all-or-nothing four-choice generation, exact body/query validation, choice/revision reconstruction, safe errors, existing Progress mutation/retry/concurrency logic.

**Out of scope:** new routes, middleware, persistence, SRS changes.

**Acceptance:** only question Vocabulary Progress changes; stale/tampered choice and insufficient pool write nothing; legacy types rejected.

**Verification:** backend read/answer unit tests; DB integration only in guarded CI.

## TASK-MCQ-04: Backend contract regression suite

**Dependencies:** TASK-MCQ-03.

**Objective:** Replace obsolete mode tests while retaining authorization, ordering, identity, rollback, idempotency and concurrency assertions.

**Files:** `backend/test/quiz/quiz-read.test.js`, `quiz-answer.test.js`, `quiz.integration.test.js`.

**Acceptance:** unit scope passes offline; guarded suite covers real authorization/Progress/concurrency without local execution.

## TASK-MCQ-05: Frontend API and transient run state

**Dependencies:** TASK-MCQ-03.

**Objective:** Consume the choice contract and preserve safe resume/retry/summary behavior.

**Files:** `frontend/src/services/quiz-service.js`, `frontend/src/quiz/quiz-run-state.js`, `quiz-presentation.js`, related unit tests.

**In scope:** `selected_choice_id`, four-choice validation, no correctness leakage, pending/accepted state migration.

**Out of scope:** local grading or durable result storage.

**Acceptance:** exact contract; pending retry survives operational error; stored state contains no correct label/distractor data.

## TASK-MCQ-06: Direct accessible responsive Quiz UI

**Dependencies:** TASK-MCQ-05.

**Objective:** Remove type selection and implement one accessible choice-card flow in existing Focus Mode.

**Files:** `frontend/src/quiz/quiz-foundation-page.jsx` and narrowly related presentation styles/helpers.

**In scope:** English prompt, POS, radio selection, submit/pending, non-color feedback, focus/live status, all states, completion/restart, container-responsive cards.

**Out of scope:** shell/navigation redesign, Flashcard/Speaking changes.

**Acceptance:** keyboard/radio semantics, pointer/disabled cursors, visible focus, ≥44px targets, long text/zoom/narrow/landscape safety and no page overflow.

## TASK-MCQ-07: Frontend and browser regressions

**Dependencies:** TASK-MCQ-06.

**Objective:** Replace typed/tile fixtures/assertions and prove interaction, focus, states, responsive layout and navigation.

**Files:** frontend Quiz unit tests, mocked Playwright fixtures/specs, guarded real-stack Quiz spec.

**Acceptance:** mocked tests run offline; DB-backed browser verification remains guarded CI only; obsolete behavior is replaced rather than skipped.

## TASK-MCQ-08: Documentation and verification

**Dependencies:** TASK-MCQ-04, TASK-MCQ-07.

**Objective:** Synchronize active Quiz docs/status and run safe implementation checks.

**Files:** `docs/PROJECT_OVERVIEW.md`, `ARCHITECTURE.md`, `DATABASE.md`, `API_SPEC.md`, `UI_UX_SPEC.md`, `FEATURE_STATUS.md`, Quiz SPEC/PLAN/TASK.

**Acceptance:** active docs describe only Multiple Choice; status remains `IN_PROGRESS`; no migration/dependency/unrelated changes.

**Verification:** backend/frontend units, mocked Playwright, ESLint, production build, syntax, secret/scope scan and `git diff --check`; guarded DB integration marked NOT RUN locally.

## Execution notes

- Preserve the untracked Speaking fixture, stash and Archify branch.
- Do not run local database-backed tests or database preparation scripts.
- No task authorizes commit, push, merge, deployment, migration or dependency installation.
- Any need for a new persistence model, role, external service or different Progress semantics returns to SPEC/PLAN approval.

## TASK skill result

`PASS` — every approved PLAN area is covered, dependencies are explicit, and no unresolved blocker or new product decision was found.
