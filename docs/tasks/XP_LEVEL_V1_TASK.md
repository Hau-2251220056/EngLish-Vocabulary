# TASKS: XP & Level V1

**Document status:** `AWAITING HUMAN APPROVAL`

**Feature status:** `TODO`

**Approved inputs:**

- `docs/specs/XP_LEVEL_V1_SPEC.md` — HUMAN APPROVED in conversation.
- `docs/plans/XP_LEVEL_V1_PLAN.md` — HUMAN APPROVED in conversation.
- Baseline `dev`: `5a6699a87d26a5ac0f77b7ce9165769b8be2e6fc`.

**Implementation authorized:** `NO`

## 1. Overview and Scope Gate

TASK-215 through TASK-234 decompose the approved seven-phase XP & Level V1 PLAN. They add one positive-only reward deduplication entity, backend-authoritative XP/Level rules, atomic SRS/Quiz rewards, additive API projections, and a compact USER Dashboard summary. Existing SRS scheduling, Quiz grading, Learning Session storage, authentication architecture, Vocabulary/Set deletion behavior, ADMIN Dashboard and Speaking Practice Gate R4 status remain unchanged.

No task authorizes Daily Goal, Streak, Achievement, leaderboard, XP history, a persisted Level, another XP balance, a generic reward-write API, a new role/dependency/external service, production database work, or unrelated authentication/performance refactoring.

`docs/FEATURE_STATUS.md` records XP and Level as `TODO`. Do not mark them `DONE` until implementation, formal TEST, formal REVIEW and explicit HUMAN acceptance have all completed. Design approval alone is not completion evidence.

The approved SPEC still contains an embedded `FINAL DRAFT — PENDING HUMAN SPEC APPROVAL` metadata line. Conversation approval is authoritative for this decomposition. No task silently edits that approved document; metadata synchronization requires separate HUMAN authorization if desired.

## 2. Task Distribution

| Phase | Tasks | Count | HUMAN gate |
|---|---|---:|---|
| 1. Database schema and guarded migration | TASK-215–TASK-217 | 3 | Gate 1 |
| 2. Shared XP/Level domain and persistence | TASK-218–TASK-220 | 3 | Feeds Gates 2–4 |
| 3. Atomic SRS reward integration | TASK-221–TASK-222 | 2 | Gate 2 |
| 4. Atomic Quiz reward integration | TASK-223–TASK-224 | 2 | Gate 3 |
| 5. API and Dashboard read contracts | TASK-225–TASK-227 | 3 | Gate 4 |
| 6. USER Dashboard and transient feedback | TASK-228–TASK-230 | 3 | Gate 5 |
| 7. Integrated regression, docs and closure | TASK-231–TASK-234 | 4 | Gate 6 |

Total: **20 tasks**, TASK-215 through TASK-234.

## 3. Dependency Graph

```text
TASK-215 Schema/migration draft
    ↓
TASK-216 Migration transaction-boundary and preflight proof
    ↓
TASK-217 Guarded migration/retention verification → HUMAN Gate 1
    ↓
TASK-218 Pure XP/Level domain
    ↓
TASK-219 Shared transaction-scoped reward repository
    ↓
TASK-220 Shared domain/persistence verification
    ├───────────────┐
    ↓               ↓
TASK-221 SRS      TASK-223 Quiz
    ↓               ↓
TASK-222          TASK-224
HUMAN Gate 2      HUMAN Gate 3
    └───────┬───────┘
            ↓
TASK-225 Mutation API projections
            ↓
TASK-226 Learning Progress compatibility
            ↓
TASK-227 Frontend validators/API gate → HUMAN Gate 4
            ↓
TASK-228 Dashboard summary
            ↓
TASK-229 Transient SRS/Quiz feedback
            ↓
TASK-230 Frontend verification + Focused UI/UX Review → HUMAN Gate 5
            ↓
TASK-231 Guarded integrated lifecycle/CI
            ↓
TASK-232 Verified documentation synchronization
            ↓
TASK-233 Formal TEST and AC-01–AC-26 evidence
            ↓
TASK-234 Formal REVIEW and HUMAN closure handoff → HUMAN Gate 6
```

TASK-221 and TASK-223 may begin independently after TASK-220 only when separate worktrees/agents are explicitly authorized and shared repository/wiring edits are coordinated. In the current shared worktree, execute them sequentially. No database-backed verification begins before the migration SQL receives the required review authorization.

## 4. Verification Levels

- **Document/static review:** source/diff/DDL inspection and `git diff --check`; no database access.
- **Pure focused verification:** DB-independent Node tests for domain, validators and UI state.
- **Guarded database verification:** only an approved isolated TEST database accepted by the repository guard. Never Preview, Production, `dev`, or an unverified URL.
- **Focused browser verification:** mocked browser checks during implementation; real-stack checks only with the guarded TEST backend/database.
- **Formal TEST/REVIEW:** separate workflow stages after implementation and focused evidence exist. An unexecuted or skipped check is `NOT RUN`, never PASS.

## Phase 1 — Database Schema and Guarded Migration

## TASK-215 — Define XP reward schema and forward migration

**Status:** `TODO`

**Objective / phase:** Phase 1. Add the minimum Prisma and forward-only SQL representation for approved positive rewards and restrictive retention.

**Dependencies / prerequisites:** Approved SPEC, PLAN and TASK. No implementation may start until this TASK document receives HUMAN approval.

**Files / modules expected to change:**

- `backend/prisma/schema.prisma` — reward enum/model and USER/Vocabulary reverse relations.
- New `backend/prisma/migrations/<timestamp>_add_xp_level_v1/migration.sql` — explicit PostgreSQL DDL.

**Implementation instructions:**

- Add exactly `SRS_INITIAL`, `QUIZ_FIRST_CORRECT`, and `SRS_DUE_REVIEW` reward types.
- Add append-only `XP_REWARD` fields from the SPEC; omit `updated_at`, Set identity and Level storage.
- Enforce unique `(user_id, vocabulary_id, reward_type, reward_cycle)` and `(user_id, source_event_id)`.
- Enforce positive amount, nonnegative cycle, and approved type/cycle/amount combinations with named database constraints.
- Use `ON DELETE RESTRICT` and `ON UPDATE CASCADE` for USER and Vocabulary.
- Add only the justified Vocabulary-leading index; avoid redundant indexes.
- Generate no data/backfill and preserve `USER.total_xp` exactly.

**Out of scope:** Repository/service code, migration execution, account/private-Vocabulary deletion, Set FK, reward history, Daily Goal placeholders.

**Acceptance criteria / evidence:** Schema and SQL express every approved field, unique/check/FK/index rule; no DML or historical reward generation exists; only schema and migration files change. Evidence is reviewed schema/SQL diff and constraint inventory.

**Focused verification:** Future implementation may run Prisma formatting/validation or client generation only after approval; at this task boundary perform static schema/SQL review and `git diff --check`. Do not connect to a database.

**HUMAN gate:** Prepares Gate 1; cannot pass Gate 1 alone.

## TASK-216 — Prove migration transaction boundaries and guarded negative-XP preflight

**Status:** `TODO`

**Objective / phase:** Phase 1. Explicitly determine and enforce safe PostgreSQL/Prisma migration atomicity so preflight or later DDL failure cannot leave partial schema changes or alter balances.

**Dependencies / prerequisites:** TASK-215 draft SQL complete; no migration execution yet.

**Files / modules expected to change:**

- The new XP/Level `migration.sql` from TASK-215.
- Focused migration-test helpers under `backend/test/xp-level/` only if needed to observe transaction behavior later.
- Existing migration preparation scripts only if a minimal guarded assertion is required; no guard weakening.

**Implementation instructions:**

- Inspect the repository's Prisma version, migration runner and existing migration conventions; do not assume each migration file is automatically transaction-wrapped.
- Confirm through official behavior/documented local tooling and an isolated TEST proof whether the target PostgreSQL runner wraps the migration.
- If atomicity is not guaranteed, add an explicit SQL transaction wrapper compatible with Prisma/PostgreSQL. If the runner already guarantees it, record concrete evidence and avoid unsafe nested assumptions.
- Place a read-only `IF EXISTS (SELECT 1 FROM "USER" WHERE total_xp < 0)` guard before all XP/Level DDL; raise a safe exception without identity disclosure.
- Add named `CHECK (total_xp >= 0)` only after the guard.
- Design a later failure-injection proof after at least one provisional DDL statement; verify rollback removes every partial XP/Level schema change and preserves balances.
- Never clamp, update, reset or backfill balances.

**Out of scope:** Resolving negative production data, running against Production/Preview, modifying migration history, destructive rollback scripts.

**Acceptance criteria / evidence:** A written migration-boundary finding cites the observed runner behavior; SQL has the necessary transaction boundary; negative preflight precedes DDL; failure at preflight and later DDL leaves no partial schema and changes no balance.

**Focused verification:** Static first. After explicit guarded TEST authorization, run the narrow migration transaction/preflight harness only; inspect schema objects and exact balance snapshots before/after failure. Do not count tool documentation alone as runtime proof.

**HUMAN gate:** Mandatory Gate 1 input. Failure or ambiguity stops migration work for HUMAN review.

## TASK-217 — Verify migration, constraints, retention and deletion regressions

**Status:** `TODO`

**Objective / phase:** Phase 1. Produce guarded TEST evidence for clean migration, negative preflight, schema parity, no-backfill and existing deletion behavior.

**Dependencies / prerequisites:** TASK-215 and TASK-216 complete; explicit authorization for isolated guarded TEST database use.

**Files / modules expected to change:**

- New/focused `backend/test/xp-level/xp-level-migration.test.js` or repository-consistent equivalent.
- Existing deletion/membership test files only where an XP-specific regression assertion belongs.
- Test helpers/CI script lists only as narrowly required to execute the new guarded tests.

**Implementation instructions:**

- Test clean legacy fixtures, preserved nonzero balances, zero generated rewards and Prisma/schema parity.
- Test negative fixture causes preflight failure with no data repair and no partial schema.
- Test every enum/check/unique/FK/index rule directly.
- Prove USER and Vocabulary reward references are restrictive.
- Prove removing final Set membership and deleting a Set retain Vocabulary, Progress and rewards.
- Prove an unreferenced canonical Vocabulary remains deletable and no USER-private/account hard-delete behavior is added.
- Restore/reset only the explicitly guarded TEST database through existing safe helpers.

**Out of scope:** Production migration, changing delete API semantics, broad backend suite.

**Acceptance criteria / evidence:** Guarded tests pass with exact commands/environment classification recorded; clean and negative/failure paths demonstrate atomicity; no skipped test is reported as PASS.

**Focused verification:** Run only the XP migration/retention suite through the existing guard-enabled TEST setup, then schema parity and `git diff --check`.

**HUMAN gate:** **Gate 1** — HUMAN reviews exact SQL, transaction proof, constraints, retention and guarded evidence before Phase 2 persistence is accepted.

## Phase 2 — Shared XP/Level Domain and Persistence

## TASK-218 — Implement pure XP/Level and reward eligibility domain

**Status:** `TODO`

**Objective / phase:** Phase 2. Centralize backend-authoritative Level projections and trusted reward-candidate derivation.

**Dependencies / prerequisites:** TASK-217 and Gate 1 acceptance.

**Files / modules expected to change:**

- New `backend/src/services/xp-level-service.js`.
- New `backend/test/xp-level/xp-level-service.test.js`.

**Implementation instructions:**

- Encode the approved Level 1–15 thresholds once in Backend; Level 15 begins at 5,250 and XP remains unbounded.
- Return `total_xp`, `level`, `level_min_xp`, `next_level_xp`, and `is_max_level`.
- Reject invalid internal negative/non-integer XP rather than clamp.
- Derive SRS initial, SRS due and Quiz first-correct candidates only from trusted inputs.
- Require the full due snapshot: exact identity, existing initial reward, stored `LEARNED`, supported interval, non-null due time at/before accepted time, positive pre-event revision.
- Keep Daily Goal extensibility limited to clear enum/service boundaries; implement no generic client reward command.

**Out of scope:** Prisma access, HTTP, frontend thresholds, Daily Goal/Streak/Achievement.

**Acceptance criteria / evidence:** Pure functions cover all Level boundaries and reward matrix cases without DB/framework state; no client values decide reward amount/type/Level.

**Focused verification:** `cd backend; node --test test/xp-level/xp-level-service.test.js` or the exact created pure-test path. No environment file or database.

**HUMAN gate:** Feeds Gates 2–4.

## TASK-219 — Implement shared transaction-scoped reward persistence

**Status:** `TODO`

**Objective / phase:** Phase 2. Provide reusable Prisma data access for positive rewards and atomic USER XP operations without nested transactions.

**Dependencies / prerequisites:** TASK-218; Gate 1 migration accepted.

**Files / modules expected to change:**

- New `backend/src/repositories/xp-reward-repository.js`.
- `backend/src/repositories/learning-repository.js` and `quiz-repository.js` — compose transaction-scoped methods.
- `backend/src/create-app.js` only for approved collaborator wiring.
- Focused repository test file under `backend/test/xp-level/`.

**Implementation instructions:**

- Accept the current Prisma/transaction client; never create another Prisma client or nested transaction.
- Support reward lookup by USER/source event, existence/lookup by composite identity, positive insert, USER XP read and atomic increment returning the balance.
- Select only required fields and always scope by authenticated USER.
- Let DB uniqueness be final authority; expose typed/internal collision classification for service conflict mapping without leaking constraint data.
- Do not expose reward list/update/delete operations.

**Out of scope:** Eligibility decisions, controllers/routes, history query, reversal.

**Acceptance criteria / evidence:** Both activity repositories use the same data-access implementation inside their existing transaction factories; atomic increment avoids lost updates; no nested client/transaction exists.

**Focused verification:** Pure mocked repository tests first; guarded repository integration is deferred to TASK-220. Static search verifies a single reward persistence implementation.

**HUMAN gate:** Feeds Gates 2–4.

## TASK-220 — Verify shared domain, persistence, replay lookup and atomic increments

**Status:** `TODO`

**Objective / phase:** Phase 2. Establish focused reusable evidence before activity-specific integration.

**Dependencies / prerequisites:** TASK-218 and TASK-219.

**Files / modules expected to change:**

- Focused XP domain/repository tests under `backend/test/xp-level/`.
- Backend package/CI test lists only if required for maintained execution.

**Implementation instructions:**

- Cover every Level boundary, MAX, above-MAX and invalid input.
- Cover positive lookup, absence-as-zero replay basis, composite identity, USER/event identity and exact Vocabulary UUID behavior.
- Prove atomic increments accumulate for different Vocabulary rewards.
- Prove duplicate insert cannot be followed by a second increment.
- Prove rollback when insert or increment fails.
- Separate DB-independent unit evidence from guarded integration evidence.

**Out of scope:** SRS/Quiz orchestration and UI.

**Acceptance criteria / evidence:** Pure suite passes; guarded repository suite passes in isolated TEST; duplicate/concurrency/rollback observations match the SPEC.

**Focused verification:** Run the narrow pure test command, then only the approved XP repository integration command under database guard. Record both separately.

**HUMAN gate:** Technical prerequisite for Gates 2 and 3.

## Phase 3 — Atomic SRS Reward Integration

## TASK-221 — Integrate atomic XP rewards into `recordMeaningfulEvent`

**Status:** `TODO`

**Objective / phase:** Phase 3. Extend accepted SRS events with initial/due rewards while preserving scheduler and request semantics.

**Dependencies / prerequisites:** TASK-220.

**Files / modules expected to change:**

- `backend/src/services/learning-service.js`.
- `backend/src/repositories/learning-repository.js`.
- `backend/src/create-app.js` if remaining injection is required.
- `backend/src/controllers/learning-controller.js` only if response envelope composition requires it.

**Implementation instructions:**

- Preserve Set/item locks, replay-first flow, accepted time, expected revision, scheduler calls, Progress create/CAS and existing errors.
- Capture reward eligibility from the same pre-event Progress snapshot used by revision validation.
- Award first pass +3, initial AGAIN +0, genuine due cycle +1 including due AGAIN, and immediate requeues +0.
- Apply approved legacy `NEEDS_REVIEW` and Quiz-unscheduled rules.
- Commit Progress, reward and increment in the existing transaction; any failure rolls all back.
- Compatible immediate replay looks up original positive amount or returns zero, sets `replayed: true`, and reads current total/Level without mutation.
- Map stale/losing/collision cases to existing safe Learning conflict behavior.
- Return additive reward data without changing the request.

**Out of scope:** Scheduler/interval changes, NORMAL events, Learning Session batching/storage, new endpoint.

**Acceptance criteria / evidence:** Every approved SRS case produces the correct reward and response; alternate Sets share exact UUID identity; no partial writes or scheduler delta occurs.

**Focused verification:** Run DB-independent Learning/service tests first. Database scenarios wait for TASK-222 guarded execution.

**HUMAN gate:** Prepares Gate 2.

## TASK-222 — Verify SRS eligibility, concurrency, replay and regressions

**Status:** `TODO`

**Objective / phase:** Phase 3. Produce focused correctness and guarded transaction evidence for the SRS integration.

**Dependencies / prerequisites:** TASK-221.

**Files / modules expected to change:**

- `backend/test/learning/srs-scheduler.test.js` only for regression assertions, not rule changes.
- `backend/test/learning/learning.test.js` and focused XP/SRS tests.
- Relevant frontend Learning service/state fixtures only if additive response compatibility requires later preparation.

**Implementation instructions:**

- Test multiple initial AGAIN attempts followed by each pass rating.
- Test legacy `NEEDS_REVIEW`, Quiz-unscheduled Progress, future schedule, exact due boundary and overdue schedule.
- Test due AGAIN once plus immediate requeue zeros and later genuinely due cycles.
- Test immediate replay, stale different events, same-revision concurrency, alternate Sets, rollback at all writes and current totals after unrelated rewards.
- Run unchanged scheduling/Learning Session/NORMAL regressions; assert NORMAL and Speaking create no XP.

**Out of scope:** Quiz reward implementation.

**Acceptance criteria / evidence:** Focused pure and guarded suites pass; scheduling outputs remain identical except additive reward projection; concurrency produces at most one transition/reward.

**Focused verification:** Narrow scheduler/service unit commands, then guarded `learning`/XP integration in isolated TEST. Do not run broad browser suites.

**HUMAN gate:** **Gate 2** — HUMAN reviews SRS transaction diff plus eligibility/concurrency/rollback evidence.

## Phase 4 — Atomic Quiz Reward Integration

## TASK-223 — Integrate atomic first-correct XP into authoritative Quiz answers

**Status:** `TODO`

**Objective / phase:** Phase 4. Award one independent first-correct Quiz reward downstream of authoritative grading.

**Dependencies / prerequisites:** TASK-220; coordinate after TASK-222 in a shared worktree.

**Files / modules expected to change:**

- `backend/src/services/quiz-service.js`.
- `backend/src/repositories/quiz-repository.js`.
- `backend/src/controllers/quiz-controller.js` only if response envelope composition requires it.

**Implementation instructions:**

- Preserve Set/item/Meaning locks, deterministic reconstruction, choice secrecy, question revision, grading and Progress semantics.
- Derive reward only after the backend determines correctness.
- Award first correct +3; incorrect and later correct answers return zero.
- Keep SRS/Quiz first rewards independent.
- Use exact USER/Vocabulary UUID across runs/Sets and distinct private UUIDs for identical headwords.
- Commit Progress, reward and increment atomically.
- Resolve compatible immediate replay from stored reward amount/current totals; preserve existing safe Quiz conflicts.

**Out of scope:** New Quiz type, answer/history table, changed distractors/grading, due-review XP from Quiz.

**Acceptance criteria / evidence:** Grading remains authoritative and unchanged; repeated/fresh/multi-Set runs cannot farm; transaction failure leaves all three state areas unchanged.

**Focused verification:** DB-independent Quiz answer/service tests first; database/concurrency scenarios in TASK-224.

**HUMAN gate:** Prepares Gate 3.

## TASK-224 — Verify combined Quiz/SRS anti-farming and transaction behavior

**Status:** `TODO`

**Objective / phase:** Phase 4. Prove Quiz rules and cross-source independence/races without grading regressions.

**Dependencies / prerequisites:** TASK-222 and TASK-223.

**Files / modules expected to change:**

- `backend/test/quiz/quiz-answer.test.js`, `quiz.integration.test.js`, and focused XP integration tests.
- Existing Learning tests only for cross-source sequences.

**Implementation instructions:**

- Test incorrect→correct→later correct, fresh runs and alternate Sets.
- Test Quiz-before-SRS and SRS-before-Quiz cumulative +6.
- Test same-headword independent private UUIDs.
- Test reused/duplicate event IDs, stale revisions, same-revision cross-source races, rollback and different-Vocabulary accumulation.
- Confirm Quiz mutations cannot themselves award/consume due-review XP and incomplete schedules remain ineligible.
- Re-run focused deterministic question/grading/choice secrecy regressions.

**Out of scope:** Frontend UI and full unrelated backend suite.

**Acceptance criteria / evidence:** Guarded evidence shows one Quiz reward per identity, independent SRS reward, safe races/rollback and unchanged grading.

**Focused verification:** Narrow Quiz unit tests, then guarded Quiz/XP integration and cross-source race cases.

**HUMAN gate:** **Gate 3** — HUMAN reviews combined SRS/Quiz anti-farming and transaction evidence.

## Phase 5 — API and Dashboard Read Contracts

## TASK-225 — Finalize additive mutation reward API projections

**Status:** `TODO`

**Objective / phase:** Phase 5. Expose the approved reward object consistently from both existing mutation endpoints.

**Dependencies / prerequisites:** TASK-222, TASK-224 and Gate 3 acceptance.

**Files / modules expected to change:**

- Learning/Quiz services and controllers only where response composition requires.
- Backend API tests for both mutations.
- `docs/API_SPEC.md` later in TASK-232, not here unless active-contract-first workflow is separately approved.

**Implementation instructions:**

- Return all seven approved fields on every accepted original/replay event, including zero XP.
- Return original event `xp_earned`, `replayed: true`, and current totals/Level for immediate replay.
- Preserve existing envelopes, status codes, request fields and safe error codes.
- Never expose reward ID/type/cycle/constraint detail.
- Maintain USER-only middleware; no reward-write route.

**Out of scope:** Progress read contract, frontend rendering, historical replay.

**Acceptance criteria / evidence:** Exact contract tests pass for original positive, original zero, immediate positive/zero replay, current-total drift and all conflict families.

**Focused verification:** Focused Learning/Quiz controller/service/API tests; guarded cases only where persistence is required.

**HUMAN gate:** Prepares Gate 4.

## TASK-226 — Extend Learning Progress read and prove all-consumer compatibility

**Status:** `TODO`

**Objective / phase:** Phase 5. Add backend-authoritative `xp_level` to the existing USER-only Progress response without a new request or consumer regression.

**Dependencies / prerequisites:** TASK-220 and TASK-225.

**Files / modules expected to change:**

- `backend/src/services/learning-service.js` and `repositories/learning-repository.js`.
- `frontend/src/services/learning-service.js`.
- `frontend/src/dashboard/dashboard-page.jsx` fixtures/mocks only as required for compatibility preparation.
- `frontend/src/learning-progress/learning-progress-page.jsx` and tests/mocks only if strict consumption needs adaptation.
- Every existing test/mock/fixture found to consume `GET /api/learning/progress`, including Dashboard and real-stack suites.

**Implementation instructions:**

- First inventory all production/test/mock consumers via repository search; explicitly record Dashboard, Learning Progress and any Learning Session indirect use.
- Add `xp_level` inside the existing repeatable-read USER snapshot and preserve every existing Progress field/query/pagination/filter meaning.
- Add no endpoint/request and do not change loading/error/retry behavior.
- Ensure strict frontend parsing accepts and validates the additive field.
- Confirm ADMIN Dashboard early return makes zero USER Progress/XP calls.
- Confirm read causes no Progress/reward/XP mutation.

**Out of scope:** `/api/auth/me` changes, new XP endpoint, Dashboard visual implementation.

**Acceptance criteria / evidence:** Consumer inventory is complete; old Progress data remains byte/semantically compatible aside from additive `xp_level`; Dashboard and Learning Progress loading/success/error mocks pass; ADMIN sees/makes no call.

**Focused verification:** `rg` consumer inventory plus focused backend Progress tests, `frontend/test/learning-service.test.js`, Dashboard mocked tests/config, Learning Progress unit/browser mocks. Database-backed isolation only in approved guarded environment.

**HUMAN gate:** Mandatory Gate 4 input.

## TASK-227 — Add shared frontend validators and freeze final API contracts

**Status:** `TODO`

**Objective / phase:** Phase 5. Validate authoritative reward/Level data consistently and complete contract evidence before UI work.

**Dependencies / prerequisites:** TASK-225 and TASK-226.

**Files / modules expected to change:**

- A minimal shared validator module in the existing frontend service layer if reuse warrants it.
- `frontend/src/services/learning-service.js`.
- `frontend/src/services/quiz-service.js`.
- `frontend/test/learning-service.test.js`, `quiz-service.test.js`, and focused validator tests.

**Implementation instructions:**

- Validate exact types/ranges and internally consistent MAX/null target behavior without copying authoritative threshold calculation.
- Preserve request bodies exactly.
- Treat malformed backend data as existing operational invalid-response errors.
- Return reward separately enough that pages can avoid persistence while retaining existing Progress/answer data.
- Document final backend/frontend shapes for Gate 4 review.

**Out of scope:** UI, global XP store, authentication profile changes.

**Acceptance criteria / evidence:** Both clients accept valid original/replay/zero/MAX projections, reject malformed data, and send unchanged requests; Progress consumers remain compatible.

**Focused verification:** `cd frontend; node --test test/learning-service.test.js test/quiz-service.test.js <validator-test-if-created>` and focused backend API contract tests.

**HUMAN gate:** **Gate 4** — HUMAN approves mutation/read shapes, replay semantics and Progress compatibility evidence.

## Phase 6 — USER Dashboard and Transient XP Feedback

## TASK-228 — Implement compact accessible USER Dashboard XP/Level summary

**Status:** `TODO`

**Objective / phase:** Phase 6. Present current backend-authoritative Level, total XP and next-level progress on the existing USER Dashboard.

**Dependencies / prerequisites:** TASK-227 and Gate 4 acceptance.

**Files / modules expected to change:**

- `frontend/src/dashboard/dashboard-page.jsx`.
- `frontend/src/dashboard/dashboard-page.css` only if existing Tailwind/token patterns cannot express a required scoped visual.
- Dashboard unit/browser mocks and real-stack fixtures.

**Implementation instructions:**

- Reuse the existing Progress source and DashboardSection loading/error/retry/focus behavior; issue no extra request.
- Render zero XP as successful data, normal intermediate progress, and `Level 15 — MAX` with no next target.
- Compute only display width from backend bounds and clamp for presentation; do not embed threshold table or decide Level.
- Provide visible text plus accessible progress semantics, keyboard focus, responsive layouts and reduced-motion compatibility.
- Leave ADMIN early return and neutral content unchanged.

**Out of scope:** Charts, Streak, Daily Goal, Achievement, history, global shell/profile display.

**Acceptance criteria / evidence:** USER states render accurately on desktop/mobile; progress is accessible without color; MAX/zero/error/retry work; ADMIN markup/network behavior is unchanged.

**Focused verification:** Focused Dashboard unit/mocked Playwright at approved widths; frontend lint for touched files where supported. No real-stack yet.

**HUMAN gate:** Prepares Gate 5.

## TASK-229 — Add non-persistent, non-replayed SRS/Quiz XP feedback

**Status:** `TODO`

**Objective / phase:** Phase 6. Reuse existing activity feedback to acknowledge newly committed positive XP without celebration farming or storage.

**Dependencies / prerequisites:** TASK-227; coordinate after TASK-228 in shared frontend files.

**Files / modules expected to change:**

- `frontend/src/learning/learning-foundation-page.jsx` and related focused state tests.
- `frontend/src/quiz/quiz-foundation-page.jsx`; `quiz-run-state.js` only to preserve/verify its whitelist boundary.
- Learning/Quiz presentation tests.

**Implementation instructions:**

- Announce/display concise `+N XP` only when `xp_earned > 0` and `replayed === false`.
- Reuse current live announcement/answer feedback; add no toast framework, animation, counter or global store.
- Separate reward from authoritative Progress before saving Learning run state.
- Preserve Quiz accepted-result whitelist and store no reward/celebration object.
- Assert replay, reload, restored session and zero XP do not trigger celebration.
- If focused UI/UX review finds visible Quiz embellishment disproportionate, omit optional visible feedback rather than create new infrastructure; API validation remains.

**Out of scope:** Persistent XP history, sound/confetti, cross-route celebration, sessionStorage migration.

**Acceptance criteria / evidence:** A newly committed positive response is announced at most once; zero/replay/restoration is silent; inspected session storage contains no reward feedback fields.

**Focused verification:** Focused Learning/Quiz state/presentation/page tests and session-storage assertions; no broad browser suite.

**HUMAN gate:** Prepares Gate 5.

## TASK-230 — Verify Dashboard/feedback UX and perform Focused UI/UX Review

**Status:** `TODO`

**Objective / phase:** Phase 6. Consolidate frontend correctness, accessibility and responsive evidence before HUMAN visual approval.

**Dependencies / prerequisites:** TASK-228 and TASK-229.

**Files / modules expected to change:**

- Focused Dashboard, Learning and Quiz frontend tests/specs.
- UI/UX review evidence location required by the `ui-ux-review` skill; production code only for findings within approved scope.

**Implementation instructions:**

- Verify loading, zero, intermediate, MAX, error/retry/focus, keyboard, accessible progress, reduced motion and responsive widths.
- Verify ADMIN makes zero USER XP/Progress calls.
- Verify positive original feedback, zero/replay silence and no persisted reward fields.
- Run the project `ui-ux-review` skill in Focused mode after tests; resolve in-scope blocking findings and rerun affected checks.
- Do not claim full visual approval without HUMAN review.

**Out of scope:** Full UI/UX audit, redesign, unrelated CSS migration.

**Acceptance criteria / evidence:** Focused frontend evidence is green; UI/UX verdict has no blocking regression; screenshots/observations cover approved widths and states; HUMAN receives an explicit visual checkpoint.

**Focused verification:** Targeted Node tests, Dashboard/Learning/Quiz mocked Playwright configurations, frontend lint/build if touched imports/styles require it, then Focused UI/UX Review.

**HUMAN gate:** **Gate 5** — HUMAN Dashboard visual approval. Do not proceed to closure claims without it.

## Phase 7 — Integrated Regression, Documentation and Closure

## TASK-231 — Run guarded full XP lifecycle and required CI integration

**Status:** `TODO`

**Objective / phase:** Phase 7. Prove the integrated SRS→Quiz→Dashboard lifecycle, authorization and zero-XP boundaries in approved guarded environments.

**Dependencies / prerequisites:** TASK-217, TASK-222, TASK-224, TASK-227, TASK-230 and Gates 1–5 accepted.

**Files / modules expected to change:**

- Focused backend integration and frontend real-stack specs.
- Existing CI test script lists only if new maintained tests are otherwise omitted.
- No workflow weakening or secret/config changes.

**Implementation instructions:**

- Exercise both first-reward orders, repeated Quiz runs, genuine due review including AGAIN/requeue, Level boundary and Dashboard refresh.
- Verify duplicate replay, stale/concurrent events, cross-user isolation, exact UUID/multi-Set behavior and rollback.
- Verify Guest/ADMIN denial and ADMIN Dashboard zero-call behavior.
- Verify NORMAL and Speaking cause no reward row or XP change; keep Speaking Gate R4 status unchanged.
- Run Backend DB Integration and Real Stack Browser through current serialized guarded CI against configured TEST database.
- Record job/head identity and prove required jobs executed; skipped jobs are not PASS.

**Out of scope:** Preview database testing, production migration, Speaking R4 closure, unrelated full manual suite.

**Acceptance criteria / evidence:** Required guarded jobs execute successfully at the implementation head; lifecycle totals/Levels are exact; no excluded activity writes XP; cleanup affects only controlled TEST fixtures.

**Focused verification:** Repository-required CI plus the focused guarded XP lifecycle specs. Local database-backed execution remains prohibited unless separately authorized with the guard.

**HUMAN gate:** Feeds Gate 6.

## TASK-232 — Synchronize verified XP/Level documentation

**Status:** `TODO`

**Objective / phase:** Phase 7. Update active sources of truth only to behavior proven by implementation evidence.

**Dependencies / prerequisites:** TASK-231 successful evidence; no unresolved implementation delta.

**Files / modules expected to change:**

- `docs/PROJECT_OVERVIEW.md`.
- `docs/DATABASE.md`.
- `docs/API_SPEC.md`.
- `docs/UI_UX_SPEC.md`.
- `docs/FEATURE_STATUS.md` — remain `IN_PROGRESS` until formal closure; later exact evidence update only after approval.
- `docs/ARCHITECTURE.md` only if an actual verified boundary change occurred; none is planned.

**Implementation instructions:**

- Document reward sources/exclusions, schema/retention/no-backfill, API projections/replay, USER Dashboard/MAX and deferred Daily Goal.
- Reconcile stale pre-XP exclusions only in their responsible domains; preserve historical closure records accurately.
- Do not mark XP/Level DONE or Speaking R4 closed.
- Keep SPEC/PLAN/TASK as historical approval artifacts unless HUMAN separately authorizes metadata synchronization.

**Out of scope:** New business rules, thesis deliverables, unrelated docs cleanup.

**Acceptance criteria / evidence:** Active docs agree with verified code/tests and each other; feature status is truthful; documentation diff contains no scope expansion.

**Focused verification:** Targeted stale-term/contract searches, link/path inspection, documentation consistency review and `git diff --check`.

**HUMAN gate:** Feeds Gate 6.

## TASK-233 — Perform formal TEST and build AC-01–AC-26 evidence matrix

**Status:** `TODO`

**Objective / phase:** Phase 7. Execute the project Test workflow and issue a truthful PASS/FAIL/BLOCKED verdict with complete acceptance traceability.

**Dependencies / prerequisites:** TASK-231 and TASK-232; HUMAN Gate 5 accepted.

**Files / modules expected to change:**

- Formal TEST report/evidence location selected by the Test skill.
- Source/tests only if a failure returns work to the relevant implementation task; do not patch silently during verdicting.

**Implementation instructions:**

- Run proportional backend/frontend unit, lint/build, focused mocked browser and required guarded integration checks.
- Separate DB-independent, guarded DB, real-stack and manual/HUMAN evidence.
- Map AC-01 through AC-26 to exact command/test/job evidence and head revision.
- Include migration atomicity/preflight, transaction rollback/concurrency, API compatibility, Dashboard accessibility and zero-XP regressions.
- Report skipped/unavailable commands as NOT RUN; any required missing evidence prevents PASS.
- Perform the Test skill's Legacy/Regression Impact Scan because existing SRS/Quiz/API behavior changes additively.

**Out of scope:** Formal code review, merge, status DONE.

**Acceptance criteria / evidence:** Every AC has credible executed evidence or an explicit blocking gap; required CI is executed; formal verdict is unambiguous and HUMAN-readable.

**Focused verification:** Commands are selected by the Test skill from maintained scripts and task evidence; do not invent PASS counts in advance.

**HUMAN gate:** HUMAN must accept formal TEST PASS before TASK-234. FAIL returns to the owning task and focused retest.

## TASK-234 — Perform formal REVIEW and prepare HUMAN closure handoff

**Status:** `TODO`

**Objective / phase:** Phase 7. Review the complete implementation against approved SPEC/PLAN/TASK, architecture, security, data and evidence before any DONE/merge action.

**Dependencies / prerequisites:** TASK-233 formal PASS explicitly accepted by HUMAN.

**Files / modules expected to change:**

- Formal REVIEW report/evidence location selected by the Review skill.
- `docs/FEATURE_STATUS.md` only after REVIEW approval and separate HUMAN closure authorization.
- No Git publication files/actions without separate authorization.

**Implementation instructions:**

- Review scope, backend authority, USER-only authorization, schema/retention, atomicity, replay, anti-farming, API, frontend authority boundary, accessibility, tests and docs.
- Perform the Review skill's Legacy/Regression Impact Scan.
- Confirm no Daily Goal/Streak/Achievement/history/Level column/second balance/new role/dependency/refactor entered the diff.
- Confirm Speaking fixture/stash ownership and Speaking R4 status remain unchanged.
- Issue APPROVE or CHANGES_REQUIRED; changes return to implementation→TEST→REVIEW.
- After APPROVE, stop for HUMAN acceptance. Do not commit, push, merge or mark DONE without separate explicit authorization.

**Out of scope:** Automatic Git closure, branch deletion, `dev`/`main` mutation, starting another feature.

**Acceptance criteria / evidence:** Formal review traces all requirements, finds no unresolved blocker, confirms clean scope and produces an exact closure handoff. Status changes occur only after required HUMAN approval.

**Focused verification:** Final scoped diff/file inventory, `git diff --check`, secret/environment scan, test-evidence audit, branch/base/fixture/stash verification.

**HUMAN gate:** **Gate 6** — final TEST/REVIEW acceptance. Only a later explicit HUMAN command may authorize commit/push/PR/merge or DONE status.

## 5. Acceptance-Criteria Coverage

| SPEC AC | Primary tasks | Evidence path |
|---|---|---|
| AC-01 | 221–227, 231 | USER authorization, Guest/ADMIN denial, ADMIN zero-call |
| AC-02 | 218, 221–222 | First SRS pass +3 |
| AC-03 | 218, 221–222 | Multiple initial AGAIN zero then pass |
| AC-04 | 215, 219, 221–222 | Composite uniqueness and later-pass zeros |
| AC-05 | 218, 223–224 | Incorrect zero, first correct +3, later zero |
| AC-06 | 221–224, 231 | Both source orderings total +6 |
| AC-07 | 218, 221–222 | Complete due snapshot and all ratings |
| AC-08 | 221–224, 231 | Requeue/future/legacy/NORMAL/Speaking zero |
| AC-09 | 221–222 | Due AGAIN once and requeue zeros |
| AC-10 | 215, 219–224 | Runs/Sets/events/concurrency anti-farming |
| AC-11 | 215, 219, 223–224 | Distinct private UUID identities |
| AC-12 | 219–224 | Three-write rollback |
| AC-13 | 219, 221–229 | Original XP replay, current totals, no celebration |
| AC-14 | 221–225 | Stale/losing safe conflicts |
| AC-15 | 219–220, 224 | Atomic different-Vocabulary accumulation |
| AC-16 | 215–217 | Preserved balances and no backfill |
| AC-17 | 218, 221–224 | Policy A legacy first rewards |
| AC-18 | 218, 225–230 | Level thresholds and MAX API/UI |
| AC-19 | 226, 228–231 | USER Dashboard authoritative/read-only |
| AC-20 | 218, 227–230, 234 | No frontend authority |
| AC-21 | 215–217, 219–224 | Database uniqueness independent of frontend |
| AC-22 | 217, 231 | Retention across Set/session lifecycle |
| AC-23 | All; audited 232–234 | Exclusion/diff review |
| AC-24 | 217, 220, 222, 224, 227, 230–234 | Focused and formal verification |
| AC-25 | 215–217 | Both RESTRICT; deletion behavior preserved |
| AC-26 | 216–217 | Guarded preflight and no-modification failure |

No approved acceptance criterion lacks an implementation or verification task.

## 6. Cross-Cutting Execution Rules

- Backend is the only authority for XP, eligibility, totals, Level and thresholds.
- USER identity comes from authenticated context; ADMIN cannot earn or read USER XP through learner routes.
- Database uniqueness is mandatory even when service prechecks exist.
- Progress/reward/XP writes are one transaction; reward work uses the transaction's Prisma client.
- Legacy Policy A means no backfill and no inference from historical `review_count`/status.
- Both reward foreign keys remain `RESTRICT`; Set removal remains membership-only.
- SRS scheduler, Quiz grading and Learning Session persistence boundaries remain intact.
- Speaking R4 remains open/unchanged; the manual fixture is neither executed nor added to feature scope.
- Database writes/tests use only approved isolated guard-enabled TEST databases.
- No skipped CI/test is PASS. No task is DONE until its own implementation and required evidence exist.
- Stop at each HUMAN gate. TASK approval alone does not approve migration execution, publication or merge.

## 7. Readiness

This TASK document is ready for HUMAN review. Implementation must not start until HUMAN explicitly approves the decomposition. After approval, execute tasks in dependency order and stop at every named gate.
