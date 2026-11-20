# TASKS: Flashcard / Learning V1

**Source SPEC:** `docs/specs/FLASHCARD_LEARNING_V1_SPEC.md` (`APPROVED`)

**Source PLAN:** `docs/plans/FLASHCARD_LEARNING_V1_PLAN.md` (`APPROVED`)

**TASK status:** `COMPLETE`

**Human approval:** `APPROVED`; TASK-045 through TASK-054 and final feature closure are HUMAN APPROVED.

**Implementation authorized:** `NO — Flashcard / Learning V1 workflow is closed`

## 1. Overview

These tasks deliver the approved authenticated USER Flashcard / Learning V1 flow in dependency order. The backend remains authoritative for accessible-Set authorization, meaningful learning outcomes, progress transitions, optimistic revision handling and immediate-current-event retry behavior. The frontend consumes that contract, owns only its namespaced same-tab run state and cannot implement the final Flashcard experience until a dedicated UI/UX checkpoint receives HUMAN approval.

The tasks do not add a server Learning Session, event ledger, SRS algorithm or review queue, Quiz, XP/Level/Streak/Achievement, Dashboard, Pronunciation Practice, Community or AI behavior.

## 2. Feature Status

Current status: `TODO`

At TASK decomposition time, `docs/FEATURE_STATUS.md` recorded Vocabulary Learning Session, Flashcard Learning and Learning Progress as `TODO`. TASK-045 synchronized the approved V1 work to `PLANNED`; TASK-054 recorded completed implementation/TEST/REVIEW evidence, and subsequent HUMAN closure authorization moved all three covered rows to `DONE`.

## 3. Dependency and Approval Graph

```text
TASK-045  Documentation synchronization
    |
TASK-046  Guarded schema/migration
    |
TASK-047  Authorized ordered learning payload backend
    |
TASK-048  Transactional progress-event backend
    |
TASK-049  Database/backend/API/security verification
    |
TASK-050  Frontend service/route/run-state foundation only
    |
TASK-051  UI/UX design checkpoint
    |
    +---- HUMAN UI/UX APPROVAL REQUIRED ----+
                                           |
TASK-052  Final Flashcard/Learning UI <-----+
    |
TASK-053  Browser/accessibility/regression coverage
    |
TASK-054  Formal TEST/REVIEW and closure preparation
```

Execution is sequential. TASK-050 cannot begin until TASK-049 has proved the backend contract, and TASK-052 is prohibited until TASK-051 receives explicit HUMAN UI/UX approval.

## 4. Tasks

### TASK-045 — Synchronize Approved Flashcard / Learning V1 Documentation

**Objective:** Reconcile active database, API, architecture, UI/UX and feature-status documentation with the approved SPEC and PLAN before implementation begins.

**Dependencies:** HUMAN approval of this TASK decomposition.

**Expected files / areas:** `docs/DATABASE.md`, `docs/API_SPEC.md`, `docs/UI_UX_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/FEATURE_STATUS.md`; approved SPEC/PLAN/TASK remain authoritative.

**In scope:** Persisted Learning Progress subset; conceptual `NEW`; meaningful-assessment `review_count`; `revision` and current `last_event_id` retry boundary; ordered accessible-Set learning payload; event API; Learning-owned `sessionStorage`; UI/UX checkpoint; relevant covered feature statuses to `PLANNED`.

**Out of scope:** Source/schema/test implementation, feature `DONE`, SRS algorithm/Words to Review, Quiz, gamification, Dashboard, Pronunciation Practice, Community or AI.

**Implementation requirements:** Remove or qualify stale active contracts without erasing legitimate future directions. Document that progress remains `(user_id, vocabulary_id)`, not per Set; immediate current-event retry is the only idempotency guarantee; delayed/reordered older events use revision rejection; no ledger exists.

**Acceptance criteria:** All active documentation describes one consistent approved V1 contract and preserves completed Auth, Vocabulary and Vocabulary Set behavior.

**Verification:** Contract searches for stale session/SRS/idempotency/state/API claims; documentation diff review; `git diff --check`; secret and scope checks.

**Mapped SPEC AC:** AC-01–AC-15.

**Completion gate/status:** `COMPLETE` — approved Database/API/UI/Architecture/Feature Status contracts were synchronized, deferred boundaries were preserved and lightweight documentation verification passed. HUMAN review is required before TASK-046.

### TASK-046 — Materialize Learning Progress and Verify Guarded TEST DB Migration

**Objective:** Add the approved `LEARNING_PROGRESS` persistence model and one focused migration, then prove its constraints and delete behavior only on the guarded dedicated TEST DB.

**Dependencies:** TASK-045 complete and HUMAN-reviewed.

**Expected files / areas:** `backend/prisma/schema.prisma`; one new migration under `backend/prisma/migrations/`; generated Prisma client through existing convention; narrowly focused guarded migration verification artifacts if required.

**In scope:** UUID identity; USER/Vocabulary FKs; unique `(user_id, vocabulary_id)`; string status; meaningful-assessment count; revision/current-event metadata; nullable planned SRS-compatible fields; timestamps; approved checks and indexes.

**Out of scope:** Backend endpoints, `LEARNING_SESSION`, event/history/ledger tables, Set/Topic/Meaning progress FKs, due-review index/service, XP or any deferred feature.

**Implementation requirements:** Persist only `LEARNING`, `LEARNED`, `NEEDS_REVIEW`; represent `NEW` by row absence. Use explicit CHECK constraints for status, non-negative `review_count`/`revision`, and positive nullable `interval_days`. Use non-cascade/restrict USER policy and Vocabulary `ON DELETE RESTRICT`. Never edit an applied migration. Every database command must enter through `configureTestEnvironment()` with explicit `NODE_ENV=test` and existing identity/reset guards.

**Acceptance criteria:** Prisma validates/generates; the migration applies on the dedicated TEST DB; constraints, defaults, unique pair, FKs and Set/Item deletion independence behave exactly as approved; controlled fixtures are removed.

**Verification:** Guarded migration status/application and focused database checks; Prisma validation/generation; existing schema objects remain intact; fixture cleanup; diff/secret/scope checks.

**Mapped SPEC AC:** AC-07–AC-08, AC-11, AC-15.

**Completion gate/status:** `COMPLETE` — Prisma validation/generation, guarded dedicated TEST DB migration deployment/status, approved columns/defaults/checks, composite uniqueness, both `RESTRICT` foreign keys, Set/Item deletion independence and controlled fixture cleanup passed. HUMAN review is required before TASK-047.

### TASK-047 — Implement Authorized Ordered Learning Payload Backend

**Objective:** Implement the USER-only learning Set read contract with accessible-Set authorization, ordered traversal, complete card content and current-USER progress projection.

**Dependencies:** TASK-046 complete and HUMAN-reviewed.

**Expected files / areas:** focused learning repository/service/controller/route modules under existing backend conventions; `backend/src/create-app.js`; existing Auth, Vocabulary and Vocabulary Set modules reused without contract redesign.

**In scope:** `GET /api/learning/sets/:setId`; public System or current-USER-owned private Set authorization; non-disclosing inaccessible-private behavior; non-empty Set rule; Item position order; Vocabulary metadata; all Meaning/Example content in deterministic order; current USER progress only.

**Out of scope:** Progress writes/event endpoint, ADMIN learning, public learning, server Learning Session, SRS scheduling, rewards, external audio service or frontend.

**Implementation requirements:** Reuse existing authentication plus USER role authorization. Map missing progress to `NEW` with zero count/revision without creating a row. Return only the approved projection and safe errors; reads must never mutate progress.

**Acceptance criteria:** An authenticated USER can load an accessible non-empty Set in exact Item order with complete multi-meaning cards and only their progress; Guest, ADMIN, non-owner and missing/empty cases follow approved safe boundaries.

**Verification:** Focused repository/service/API checks using guarded TEST fixtures where database access is required; authorization, order, nesting, no-write and safe-error checks; lint/diff/secret/scope checks.

**Mapped SPEC AC:** AC-01–AC-03, AC-07, AC-11–AC-12, AC-15.

**Completion gate/status:** `COMPLETE` — the USER-only read endpoint passed focused guarded HTTP verification for public System and owned private access, Guest/ADMIN/non-owner boundaries, safe validation/not-found/empty errors, explicit Item order, complete deterministic Meaning/Example content, current-USER progress/conceptual `NEW`, and read-without-write behavior. HUMAN review is required before TASK-048.

### TASK-048 — Implement Transactional Meaningful Learning Events

**Objective:** Implement the backend-authoritative progress event contract with atomic membership validation, outcome transitions, revision protection and immediate-current-event retry behavior.

**Dependencies:** TASK-047 complete and HUMAN-reviewed.

**Expected files / areas:** learning repository/service/controller/routes from TASK-047; `backend/src/create-app.js` only as needed for the approved endpoint composition.

**In scope:** `POST /api/learning/events`; exact body validation; accessible Set and current Item membership revalidation; first-row creation; outcome mapping; count/revision/timestamp/current-event updates; concurrency and safe domain errors.

**Out of scope:** Arbitrary historical replay idempotency, event ledger/history, client-authoritative state, SRS scheduling, session completion persistence, Quiz, XP/Streak or frontend.

**Implementation requirements:** Derive USER from the session. Map `REMEMBERED` to `LEARNED` and `STUDY_AGAIN` to `LEARNING`; each accepted outcome increments `review_count` and `revision` once and leaves SRS fields null. Repeating the current `last_event_id` returns unchanged progress. A different stale event/revision is rejected. All membership/progress operations are one transaction and persistence failures map to safe stable errors.

**Acceptance criteria:** Valid events update exactly one USER/Vocabulary progress atomically; retries do not double-count; stale/reordered or no-longer-member events do not mutate data; concurrent first/update events cannot violate the unique/revision contract.

**Verification:** Focused transactional service/API harness on the guarded TEST DB; outcome, retry, stale revision, membership and concurrency evidence; controlled cleanup; lint/diff/secret/scope checks.

**Mapped SPEC AC:** AC-04–AC-08, AC-11–AC-12, AC-15.

**Completion gate/status:** `COMPLETE` — the USER-only meaningful-event endpoint passed focused guarded verification for exact validation, Set access and locked membership reauthorization, both outcome transitions, per-USER atomic counters/revisions, immediate current-event retry, stale/reordered conflicts, concurrent same/different first events, untouched nullable SRS fields and controlled cleanup. HUMAN review is required before TASK-049.

### TASK-049 — Add Learning Database, Backend, API and Security Coverage

**Objective:** Establish authoritative automated evidence for the schema and both learning endpoints before any frontend consumes them.

**Dependencies:** TASK-048 complete and HUMAN-reviewed.

**Expected files / areas:** focused backend database/service/API/security tests; existing guarded TEST helpers only where narrowly required; relevant Auth/Vocabulary/Vocabulary Set regression suites.

**In scope:** Constraints/delete behavior, ordered payload, full nested content, read-without-write, authorization/non-disclosure, validation/errors, both outcomes, atomicity, retry/revision/concurrency, membership changes and shared backend regressions.

**Out of scope:** Frontend/browser tests, Preview/Production, deferred learning domains or weakening existing tests/contracts.

**Implementation requirements:** Use explicit `NODE_ENV=test` and only the guarded dedicated TEST DB. Test Guest/ADMIN/non-owner denial, forged identity/fields, safe unexpected errors, no event-history endpoint/table and no deferred scheduling/reward behavior. Controlled fixtures must be uniquely scoped and fully cleaned.

**Acceptance criteria:** All Learning database/backend/API/security cases pass and relevant Authentication, Vocabulary and Vocabulary Set backend regressions remain green with no unexplained TODO/failure.

**Verification:** Exact pass/fail/TODO counts; guarded fixture cleanup; migration status if required through the approved guard; `git diff --check`; secret and scope checks.

**Mapped SPEC AC:** AC-01–AC-08, AC-11–AC-12, AC-15.

**Completion gate/status:** `COMPLETE` — the durable guarded Learning suite passed 9/9 with database constraints/referential behavior, USER-only public/owned-private access, non-disclosure, ordered complete payloads, conceptual `NEW` read-without-write behavior, exact validation/safe errors, both transitions, counters/revisions, immediate retry idempotency, stale and concurrent event handling, transactional membership/ownership isolation and safe unexpected failures. Required regressions passed: Authentication 29 pass / 3 approved TODO, Vocabulary 13/13 and Vocabulary Set 8/8. Controlled fixtures were reset by the guarded suite lifecycle. HUMAN review is required before TASK-050.

### TASK-050 — Add Frontend Learning Foundation Without Final Visual UI

**Objective:** Connect the verified learning API to the existing USER route/layout and establish safe run-state mechanics without implementing the final Flashcard visual experience.

**Dependencies:** TASK-049 complete and HUMAN-reviewed.

**Expected files / areas:** Learning frontend service beside existing services; `frontend/src/app-router.jsx`; existing System/private Vocabulary Set detail entry points; focused Learning-owned run-state helper; a minimal foundation page; focused unit/route tests.

**In scope:** API/error mapping; `/learn/vocabulary-sets/:setId` under `ProtectedRoute → AuthenticatedShell → UserRoute`; appropriate USER learning entry actions; loading/foundation state; namespaced `sessionStorage` serialization, reconciliation and cleanup owned by Learning.

**Out of scope:** Final card appearance, final interaction layout, outcome controls/animation polish, generic Learn navigation/Dashboard, Auth-internal Flashcard keys, server session or browser-regression suite.

**Implementation requirements:** Store no credentials or full Vocabulary content. Observe auth/session invalidation and clear only the Learning namespace without coupling Auth internals. Guest retains the existing login path; ADMIN has no learning action. The foundation may prove data/route/state integration but must not pre-empt TASK-051 design decisions.

**Acceptance criteria:** The verified backend is reachable through a guarded USER route, run state safely round-trips/reconciles/clears, and no final Flashcard UI or deferred scope is introduced.

**Verification:** Focused service, route/role, entry-action and run-state unit tests; relevant lightweight Auth/App Layout and Vocabulary Set regressions; ESLint/build/diff/secret/scope checks.

**Mapped SPEC AC:** AC-01, AC-09–AC-13, AC-15.

**Completion gate/status:** `COMPLETE` — the approved GET/event API service, guarded USER route, public/owned-private Set entry actions, minimal non-final foundation page and Learning-owned namespaced same-tab run-state lifecycle are implemented. Focused tests verify safe service mapping, USER/Set-scoped persistence, fresh-payload reconciliation, stale cursor/assessment removal, current-card selection, restart/completion summaries, corrupt-state fallback and namespace-only cleanup; Auth/Vocabulary Set service regressions, ESLint and production build pass. HUMAN review is required before TASK-051; final visual UI remains unauthorized.

### TASK-051 — Produce and Obtain HUMAN Approval for the Learning UI/UX Design Checkpoint

**Objective:** Define and review the complete Flashcard/Learning interaction and responsive/accessibility design before final frontend implementation.

**Dependencies:** TASK-050 complete and HUMAN-reviewed.

**Expected files / areas:** one focused repo-native UI/UX checkpoint artifact under the project documentation convention; no production component implementation.

**In scope:** Desktop/mobile card front/revealed back; deterministic primary Meaning/Example hierarchy from the complete payload; progress/run header; pronunciation-audio control placement; reveal/outcome/previous/next/restart/completion flows; all safe states; keyboard map; focus/live announcements; reduced motion; responsive overflow in the existing shell.

**Out of scope:** Production Flashcard UI code, shell redesign, Dashboard/generic Learn area, Pronunciation Practice, Quiz, SRS/review queue, rewards or new dependency.

**Implementation requirements:** Ground the artifact in the approved SPEC and verified foundation. It must distinguish UI-only actions from meaningful backend events and show how retry/conflict/reload/restart/completion behave. Record unresolved presentation choices for HUMAN decision rather than silently choosing them.

**Acceptance criteria:** The artifact covers every required state and interaction with implementable accessible semantics, and HUMAN explicitly approves it.

**Verification:** SPEC/PLAN/AC traceability review; accessibility/responsive checklist; documentation diff/scope check. No implementation or browser test is performed in this task.

**Mapped SPEC AC:** AC-02–AC-05, AC-09–AC-15.

**Completion gate/status:** `COMPLETE — HUMAN UI/UX APPROVED`. The approved checkpoint is recorded in `docs/FLASHCARD_LEARNING_V1_UI_UX_CHECKPOINT.md`, including the deterministic primary-Meaning rule, card/control anatomy, complete state model, responsive/accessibility behavior and future-SRS boundary. TASK-052 remains a separate implementation task.

### TASK-052 — Implement the HUMAN-Approved Flashcard / Learning UI

**Objective:** Replace the foundation page with the approved complete USER learning experience without moving backend-authoritative rules into the frontend.

**Dependencies:** TASK-051 complete **and explicitly HUMAN UI/UX APPROVED**.

**Expected files / areas:** Learning page/components/state helpers; existing Learning service/run-state module; Set entry points; focused styles within existing frontend conventions; focused component/unit tests.

**In scope:** Fresh payload/reconciliation; ordered single-card traversal; reveal and deterministic primary-Meaning presentation; outcome submission; pending/retry/conflict handling; previous/next inspection; same-tab resume; restart confirmation; current-run completion/summary/new run; optional model-audio playback; approved focus/keyboard/responsive/reduced-motion behavior.

**Out of scope:** UI beyond the approved checkpoint, standalone Vocabulary catalog, durable server session/completion, SRS queue, Quiz, Pronunciation Practice, XP/gamification, Dashboard or AI.

**Implementation requirements:** Only successful outcome responses advance assessment/completion state. Reuse the same `event_id` and revision for an inconclusive immediate retry; refresh/reconcile on conflict. Prevent duplicate pending actions. Audio failure is local and never mutates progress. Preserve complete content and accessible names/status announcements.

**Acceptance criteria:** A USER can complete, resume, restart and inspect one accessible ordered Set using the HUMAN-approved design while durable progress remains wholly backend-authoritative.

**Verification:** Focused UI/service payload tests and interaction checks; ESLint and production build; diff/secret/scope checks. Formal browser evidence belongs to TASK-053.

**Mapped SPEC AC:** AC-01–AC-15.

**Completion gate/status:** `COMPLETE` — the HUMAN-approved production Flashcard UI now implements ordered front/reveal/assessment/advance/completion behavior, deterministic primary-Meaning presentation, pronunciation, same-event retry and conflict refresh, Learning-owned resume/restart state, responsive ELVocab styling, safe states, focus/live announcements, keyboard safety and reduced motion. Focused Learning tests pass 15/15, ESLint and production build pass. HUMAN review is required before TASK-053.

### TASK-053 — Add Browser, Accessibility and Cross-Feature Regression Coverage

**Objective:** Prove the complete learning flow in real browser conditions and demonstrate regression safety for completed shared features.

**Dependencies:** TASK-052 complete and HUMAN-reviewed.

**Expected files / areas:** focused guarded Learning Playwright configuration/spec/fixtures; existing frontend/unit and Auth/Topic/Vocabulary/Vocabulary Set regression infrastructure only where required.

**In scope:** Access roles/ownership, ordered traversal, multiple meanings/examples, no-write reveal, both outcomes, pending/retry/conflict, reload resume, stale reconciliation, restart/completion, safe error/audio states, keyboard/focus/live announcements, reduced motion and responsive viewports.

**Out of scope:** Preview/Production verification, unrelated broad suite creation, deferred feature tests or contract changes merely to satisfy a test.

**Implementation requirements:** Use controlled guarded TEST fixtures and existing process/log conventions. Verify exact cleanup and no orphan dedicated processes/listeners. Reuse authoritative evidence when still valid; fix only concrete in-scope defects and report contract/design conflicts instead of altering approved behavior.

**Acceptance criteria:** Dedicated Learning browser/accessibility/responsive coverage passes; required Auth/App Layout, Vocabulary Set, Vocabulary and affected Topic regressions remain green; static/build/security/scope gates pass.

**Verification:** Exact test counts; ESLint/build; fixture and process cleanup; `git diff --check`; secret/sensitive-data and scope checks.

**Mapped SPEC AC:** AC-01–AC-15.

**Completion gate/status:** `COMPLETE` — guarded dedicated Learning browser coverage passed 4/4 for ordered real-stack learning, reveal/pronunciation, both outcome-specific pending states, same-tab resume, completion, retry/conflict preservation, keyboard/focus, reduced motion, mobile overflow/touch targets and Guest/ADMIN/non-owner boundaries. Cross-feature evidence passed: frontend unit 39/39, Auth/App Layout browser 25/25 and combined guarded real-stack 28/28 (Auth 2, Learning 4, Topic 9, Vocabulary 5, Vocabulary Set 8). ESLint, production build, controlled fixture cleanup, diff/secret/scope and dedicated-process checks passed. HUMAN review is required before TASK-054.

### TASK-054 — Perform Formal Flashcard / Learning V1 TEST, REVIEW and Closure Preparation

**Objective:** Reconcile all approved requirements and evidence through formal TEST/REVIEW, resolve findings through the workflow and prepare separate HUMAN-authorized closure.

**Dependencies:** TASK-053 complete and HUMAN-reviewed.

**Expected files / areas:** formal evidence/status documentation only when supported; no unrelated implementation or deployment work.

**In scope:** AC-01–AC-15 traceability; contract/security/authorization/progress/concurrency review; UI checkpoint conformance; accessibility/regression/scope audit; documentation consistency; blocker and deferral record.

**Out of scope:** Automatic feature `DONE`, deployment, Preview/Production, next feature work, or silently fixing a design/implementation issue outside its proper stage.

**Implementation requirements:** Treat earlier automated evidence as input, not a substitute for formal review. A failure or changes-required finding returns to the correct SPEC/PLAN/TASK/implementation stage. Keep SRS, Words to Review, Quiz, rewards, Dashboard and Pronunciation Practice explicitly deferred.

**Acceptance criteria:** Formal TEST is `PASS`, formal REVIEW is `APPROVE`, no unresolved blocker remains and the feature is eligible for separate HUMAN closure authorization.

**Verification:** Final evidence matrix, documentation/diff/secret/scope consistency, guarded fixture-cleanup proof and explicit HUMAN review.

**Mapped SPEC AC:** AC-01–AC-15.

#### TASK-054 Formal Evidence

| SPEC acceptance criteria | Result | Implementation / verification evidence |
|---|---|---|
| AC-01 | PASS | USER-only route/API, public System or owned-private access, Guest/ADMIN/non-owner browser and backend denial. |
| AC-02 | PASS | Position-ordered Set payload with complete Vocabulary → Meaning → Example nesting and deterministic child ordering. |
| AC-03 | PASS | Deterministic primary Meaning, approved one-Example presentation, URL/TTS pronunciation and failure isolation verified by unit/browser coverage. |
| AC-04 | PASS | Reveal, navigation, reload/resume, restart and summary remain client-only; backend no-write read coverage passes. |
| AC-05 | PASS | Backend accepts only `REMEMBERED`/`STUDY_AGAIN` and maps them to `LEARNED`/`LEARNING`. |
| AC-06 | PASS | Transaction tests cover counters/revisions, immediate-current-event retry and stale/concurrent rejection. |
| AC-07 | PASS | Migration and database coverage prove unique per USER/Vocabulary progress with no Set/Item/Topic/Meaning identity. |
| AC-08 | PASS | Missing rows project conceptual `NEW`; V1 never assigns `NEEDS_REVIEW` or writes nullable SRS scheduling fields. |
| AC-09 | PASS | Learning-owned same-tab state reconciles against fresh cards and safely removes stale cursor/assessments. |
| AC-10 | PASS | Restart clears only transient run state; browser completion requires all cards and reports both outcomes. |
| AC-11 | PASS | Every event derives USER identity and transactionally revalidates accessible Set plus current membership. |
| AC-12 | PASS | Safe validation/auth/not-found/empty/item-changed/conflict/unexpected API errors and actionable UI retry states verified. |
| AC-13 | PASS | Existing route guards/session behavior remain authoritative; Learning-only Focus Mode and namespace cleanup preserve other App Layout routes. |
| AC-14 | PASS | Dedicated browser evidence covers focus, native keyboard safety, live feedback, reduced motion, mobile overflow and touch targets. |
| AC-15 | PASS | Scope/diff review finds no Learning Session ledger, SRS algorithm/queue, Quiz, rewards, Dashboard, Pronunciation Practice, Community, AI or unrelated dependency. |

**Formal TEST:** `PASS` — AC-01 through AC-15 pass with no failed, partial or unverified criterion. Durable evidence includes Learning backend 9/9, required backend regressions (Authentication 29 pass / 3 approved TODO, Vocabulary 13/13, Vocabulary Set 8/8), frontend unit 39/39, dedicated Learning browser 4/4, Auth/App Layout browser 25/25 and combined real-stack 28/28.

**Formal REVIEW:** `APPROVE` — architecture, database/API contracts, USER authorization, Set ownership/privacy, per-USER progress isolation, transaction/revision semantics, Learning-owned transient state, HUMAN-approved UI/UX, accessibility, regression safety and deferred-scope boundaries are consistent. The remote guarded TEST DB latency diagnostic is environment/round-trip related, does not change correctness, and is a separately deferred non-blocking performance concern.

**Completion gate/status:** `COMPLETE` — formal TEST passed, formal REVIEW approved, HUMAN closure authorization was received and `docs/FEATURE_STATUS.md` now records the three covered Flashcard / Learning V1 rows as `DONE`.

## 5. Execution and Scope Guards

- Execute TASK-045 through TASK-054 strictly in order and stop for HUMAN review at each approved checkpoint.
- TASK-046 is the only schema/migration materialization task. Database commands must use the guarded dedicated TEST DB path and fail closed on ambiguous identity.
- TASK-049 must complete and be HUMAN-reviewed before TASK-050 consumes the backend contract.
- TASK-050 establishes only service/route/run-state foundations; it must not implement the final visual learning experience.
- TASK-051 is the mandatory HUMAN UI/UX approval gate. TASK-052 cannot start on task-list approval alone.
- Progress remains per USER plus Vocabulary. No task may add progress/session identity based on Set, Item, Topic or Meaning.
- No task may add a full SRS algorithm, Words to Review, Quiz, XP/Level/Streak/Achievement, Dashboard, Pronunciation Practice, Community or AI work.
- Formal TEST/REVIEW and explicit HUMAN closure approval are required before `FEATURE_STATUS.md` can mark covered work `DONE`.

## Approval Gate

```text
SPEC STATUS: APPROVED
PLAN STATUS: APPROVED
TASK STATUS: APPROVED
TASK-045: COMPLETE
TASK-046: COMPLETE
TASK-047: COMPLETE
TASK-048: COMPLETE
TASK-049: COMPLETE
TASK-050: COMPLETE
TASK-051: COMPLETE — HUMAN UI/UX APPROVED
TASK-052: COMPLETE
TASK-053: COMPLETE
TASK-054: COMPLETE
FORMAL TEST: PASS
FORMAL REVIEW: APPROVE
FLASHCARD / LEARNING V1 CLOSURE: HUMAN AUTHORIZED — FEATURE STATUS DONE
NEXT ALLOWED STAGE: FEATURE COMMIT / HUMAN INTEGRATION REVIEW
IMPLEMENTATION AUTHORIZED: NO — Flashcard / Learning V1 workflow is closed
```
