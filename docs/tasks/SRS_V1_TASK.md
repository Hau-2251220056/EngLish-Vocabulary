# TASKS: SRS V1 — Dual-Mode Flashcard Review

**SPEC:** `docs/specs/SRS_V1_SPEC.md` — HUMAN APPROVED

**PLAN:** `docs/plans/SRS_V1_PLAN.md` — HUMAN APPROVED

**TASK status:** `HUMAN APPROVED`

**Implementation authorized:** `YES — execute in approved task order and stop at declared checkpoints`

**HUMAN-approved contract revision (2026-10-05):** NEW/stage-0 `HARD`/`GOOD`/`EASY` results are 1/3/7 days. HUMAN approved the `TASK-105D` checkpoint and authorized `TASK-106`; dedicated real-stack verification is complete and pending HUMAN review.

## 1. Overview

These tasks implement the approved SRS V1 extension to the completed Flashcard / Learning stack. The work reuses the existing `LEARNING_PROGRESS` persistence and Learning endpoints, adds a dependency-free deterministic stage scheduler, introduces SRS and NORMAL modes, replaces the two-outcome event contract with four ratings, derives due state consistently for Learning Progress, and verifies the complete behavior from pure unit tests through guarded real-stack browser tests.

The tasks do not authorize a database migration, new persistence entity, server-side Learning Session/history, FSRS/SM-2, gamification, pronunciation expansion, new role, dependency, endpoint, or unrelated Flashcard redesign.

## 2. Feature Status and Existing Implementation

Current feature status: `DONE — FORMAL TEST PASS / REVIEW APPROVE; PENDING HUMAN CLOSURE APPROVAL`.

- `docs/FEATURE_STATUS.md` records Spaced Repetition as `DONE` after implementation, formal TEST PASS and formal REVIEW APPROVE.
- Vocabulary Learning Session, Flashcard Learning, Learning Progress and Learning Progress View V1 are `DONE` and must be extended rather than rebuilt.
- The current implementation contains the one-mode/two-outcome Learning API, transient run state, Focus Mode Flashcard UI, Learning Progress read model, guarded backend tests, mocked browser tests and dedicated real-stack harness that this work must reuse.
- SRS V1 implementation and verification are complete. Existing user-owned changes and `stash@{0}` remain outside this task workflow and were not altered.

## 3. Global Scope and Safety Gates

All tasks must preserve these boundaries:

- Use exact `(user_id, vocabulary_id)` progress identity and current Set access/membership authorization.
- NORMAL is read-only: it must never call the event mutation endpoint or mutate SRS/progress fields.
- A duplicate/retried rating submission must never advance scheduling, `review_count`, or `revision` twice.
- Use the approved ladder only: stage 0/null, then 1, 3, 7, 14 and 30 days. Do not introduce FSRS, SM-2 or adaptive fields.
- Apply the approved NEW/stage-0 exceptions exactly: `HARD` → stage 1/1 day, `GOOD` → stage 2/3 days and `EASY` → stage 3/7 days. Later stable stages retain `HARD`/`GOOD +1`/`EASY +2`, capped at 30 days.
- Do not add a schema migration, history/event table, Learning Session table, index, dependency, endpoint, external service, role, gamification behavior, pronunciation expansion or unrelated Flashcard redesign.
- Do not modify `backend/prisma/schema.prisma`, existing migrations, `backend/src/routes/learning-routes.js`, dependency manifests/lockfiles, authentication middleware, Vocabulary/Vocabulary Set ownership code, Quiz, pronunciation or gamification modules unless a newly discovered approved-plan conflict is first returned to PLAN and HUMAN approved.
- Every risky STOP below is mandatory. Do not work around a failed checkpoint by silently expanding scope.

### Mandatory STOP conditions

1. If the actual TEST/development schemas do not match the committed migration state, STOP for HUMAN review and PLAN revision; do not create or alter a migration.
2. If existing persistence fields cannot satisfy the approved scheduler contract or safe immediate-current-event idempotency, STOP for HUMAN review; do not add fields, tables or fingerprints.
3. If implementation requires a new endpoint, changed route/middleware architecture, persistent session/history, or a materially different API response/request contract from the approved SPEC/PLAN, STOP before making that change.
4. If effective Learning Progress summary, filters and items cannot share one timestamp/predicate boundary using the approved architecture, STOP before introducing an alternative data model.
5. If the existing UI checkpoint cannot support the dual-mode controls and four-button action group without a major flow/redesign, STOP for HUMAN UI/UX review.

## 4. Task Dependency Graph

```text
TASK-090 Contract/schema baseline checkpoint
   ↓
TASK-091 Pure deterministic scheduler
   ↓
TASK-092 Legacy progress compatibility
   ↓
TASK-093 Repository projections + derived Learning Progress due state
   ↓
TASK-094 SRS eligibility snapshot/order + NORMAL read-only backend
   ↓
TASK-095 Four-rating backend mutation
   ↓
TASK-096 Duplicate-submit/idempotency + concurrency protection
   ↓
TASK-097 Backend verification checkpoint
   ↓
TASK-098 Frontend service contracts
   ↓
TASK-099 Versioned dual-mode state + stale-state invalidation
   ↓
TASK-100 SRS queue/requeue without duplicates
   ↓
TASK-101 Mode switch/restart/exit-resume behavior
   ↓
TASK-102 Dual-mode Flashcard UI + four-button back side
   ↓
TASK-103 Accessibility, focus and responsive behavior
   ↓
TASK-104 Frontend unit verification checkpoint
   ↓
TASK-105 Focused mocked Playwright coverage
   ↓
TASK-105A Revise deterministic first-review timing
   ↓
TASK-105B Synchronize authoritative rating previews
   ↓
TASK-105C Synchronize rating-button preview wording
   ↓
TASK-105D Revision verification checkpoint
   ↓
TASK-106 Dedicated real-stack and regression coverage
   ↓
TASK-107 Documentation/API synchronization
   ↓
TASK-108 Formal TEST, REVIEW and closure preparation
```

No implementation task may start until this complete TASK document is HUMAN approved. Later HUMAN checkpoints remain required where explicitly stated.

## TASK-090 — Establish the Contract and No-Migration Baseline

**Objective:** Confirm the approved API/data/UI boundary and verify that the existing schema can support SRS V1 before source implementation begins.

**Dependencies:** Approved SPEC, approved PLAN, and HUMAN approval of this TASK document.

**Expected files / modules:**

- `backend/prisma/schema.prisma` — inspect only; no planned modification.
- `backend/prisma/migrations/20260923000000_add_learning_progress/migration.sql` — inspect only.
- `docs/FEATURE_STATUS.md` — mark SRS V1 `IN_PROGRESS` only when implementation actually starts and HUMAN has authorized it.
- Existing Learning tests/contracts — establish regression baseline.

**In scope:** Verify columns, nullability, positive-interval constraint, uniqueness, revision and `last_event_id`; verify the configured development and guarded TEST schemas match migrations; record the old two-outcome contract tests that must change atomically with implementation.

**Out of scope:** Migration creation/application beyond existing guarded preparation, schema edits, implementation logic, production/preview database access, or feature status beyond the actual workflow stage.

**Implementation requirements:** Use only approved guarded database commands and the dedicated TEST database. Preserve `ease_factor` unchanged. Confirm no global due-query index is required because reads remain bounded to the current Set.

**Acceptance criteria:** Existing persistence demonstrably supports the approved fields and constraints; baseline tests/contracts are identified; no database/source mutation is introduced by the checkpoint.

**Verification checkpoint:**

- `cd backend; npm run test:db:prepare`
- `cd backend; npx prisma validate`
- `cd backend; npx prisma migrate status`
- Inspect `git diff -- backend/prisma` and confirm no schema/migration change.

**Mandatory STOP:** If schema drift exists or the approved contract cannot be represented safely with existing fields, STOP for HUMAN review and return to PLAN. Do not create a migration.

**Checkpoint evidence/status:** `COMPLETE — HUMAN REVIEWED`. Prisma schema validation passed. The dedicated TEST database from `.env.test` prepared successfully and reported all 7 migrations applied with none pending. The configured development database migration parity is `NOT VERIFIED — Supabase/Prisma schema-engine error`; HUMAN confirmed this is not current evidence of schema drift or a persistence-contract blocker and authorized continuation. No migration was run/applied against, and no mutation was made to, the main database configured in `.env`. All further database/integration verification must use `.env.test` only.

## TASK-091 — Implement the Pure Deterministic Scheduler

**Objective:** Add the dependency-free authoritative stage/rating/due calculation module with an injected timestamp.

**Dependencies:** TASK-090 passed and HUMAN checkpoint approval where required.

**Expected files / modules:**

- Create `backend/src/services/srs-scheduler.js`.
- Create `backend/test/learning/srs-scheduler.test.js`.

**In scope:** Ladder constants; interval-to-stage normalization; effective stage/state/due derivation; eligibility; `AGAIN`, `HARD`, `GOOD`, `EASY` transitions; UTC millisecond calculation from one supplied `acceptedAt`/`evaluatedAt`.

**Out of scope:** Prisma, Express, authorization, HTTP validation, repository access, configurable algorithms, local-calendar arithmetic or persistence.

**Implementation requirements:** Implement exactly stage 0/null and stable 1/3/7/14/30-day stages; `AGAIN` resets to immediate stage 0/`LEARNING`; `HARD` retains a stable stage with stage 0→1; `GOOD` advances one stable stage with the explicit stage 0→2 exception; `EASY` advances two stable stages with the explicit stage 0→3 exception; cap at stage 5; passing ratings produce `LEARNED` and exact 24-hour multiples.

**Acceptance criteria:** Every stage/rating combination is deterministic; 30-day cap and due boundaries are exact; module remains pure and dependency-free.

**Verification:** `cd backend; node --test test/learning/srs-scheduler.test.js`.

## TASK-092 — Implement Legacy Progress Compatibility

**Objective:** Make existing and incomplete legacy Learning Progress rows safely consumable without read-time persistence changes.

**Dependencies:** TASK-091.

**Expected files / modules:**

- `backend/src/services/srs-scheduler.js` — legacy normalization helpers.
- `backend/test/learning/srs-scheduler.test.js` — legacy mapping matrix.

**In scope:** Stored `LEARNING`, persisted `NEEDS_REVIEW`, valid scheduled `LEARNED`, incomplete scheduled `LEARNED`, non-ladder intervals, null timestamps and due-boundary behavior.

**Out of scope:** Bulk repair/backfill, rejecting readable legacy rows, schema tightening, migration or history recovery.

**Implementation requirements:** `LEARNING` is eligible stage 0; `NEEDS_REVIEW` is eligible and retains a valid ladder interval, otherwise stage 0; valid `LEARNED` schedules are future/due at the encoded stage; incomplete/non-ladder `LEARNED` is eligible, retaining a valid interval stage if available, otherwise stage 0. Only an accepted rating normalizes stored values.

**Acceptance criteria:** Every approved legacy shape maps deterministically; reads do not write; future valid learned schedules remain ineligible until due.

**Verification:** Re-run `cd backend; node --test test/learning/srs-scheduler.test.js` with explicit immediately-before/equal/after boundary and legacy matrix cases.

## TASK-093 — Extend Repository Projections and Derive Learning Progress Due State

**Objective:** Expose existing scheduling fields and make Learning Progress summary, filters and items derive effective due state consistently at one timestamp.

**Dependencies:** TASK-092.

**Expected files / modules:**

- `backend/src/repositories/learning-repository.js`.
- `backend/src/services/learning-service.js`.
- `backend/src/create-app.js` — optional test clock threading.
- `backend/test/learning/learning.test.js`.
- `frontend/src/services/learning-service.js` and `frontend/src/learning-progress/learning-progress-page.jsx` only later/if consumption requires them.

**In scope:** Add `interval_days`/`next_review_at` and idempotent-response fields to projections; shared effective-state Prisma predicates; one captured `evaluated_at`; repeatable-read summary/count/page consistency; read-only derived `NEEDS_REVIEW`; Dashboard consumer compatibility.

**Out of scope:** NEW/global availability, review action on Progress, Dashboard redesign/behavior change, write-on-read, global due queue or new index.

**Implementation requirements:** Keep stored `LEARNING` in the Learning bucket; include persisted `NEEDS_REVIEW` and scheduled `LEARNED` due at/before the timestamp in effective `NEEDS_REVIEW`; exclude derived-due rows from effective `LEARNED`; preserve specified legacy stored-state presentation. Capture `now()` once per operation and use shared conditions for summary, filter count and page items.

**Acceptance criteria:** Summary totals, filtered totals and returned item states agree at a single boundary; repeated reads are invariant; due learned rows become effective `NEEDS_REVIEW` without persistence mutation; existing Dashboard pagination call remains compatible.

**Verification:** Focused Learning integration cases in `backend/test/learning/learning.test.js`, including fixed-clock summary/filter/page equality and byte-for-byte read invariance.

**Mandatory STOP:** If consistent derived state cannot be achieved with the approved repository/service approach and current schema, STOP for HUMAN review before changing architecture or persistence.

## TASK-094 — Implement SRS Eligibility Snapshot/Ordering and NORMAL Read-Only Mode

**Objective:** Extend the existing Set-learning read endpoint with validated SRS/NORMAL modes and authoritative mode-specific payloads.

**Dependencies:** TASK-093.

**Expected files / modules:**

- `backend/src/services/learning-service.js`.
- `backend/src/controllers/learning-controller.js`.
- `backend/src/repositories/learning-repository.js` as narrowly required.
- `backend/src/create-app.js` for optional clock injection.
- `backend/test/learning/learning.test.js`.
- `backend/src/routes/learning-routes.js` inspection only; no planned change.

**In scope:** Omitted mode defaults to SRS; accept scalar `SRS`/`NORMAL`; reject empty/repeated/unknown values; SRS fixed timestamp, eligibility and nearest-future-due metadata; existing eligible before NEW, each group by Set position with exact UUID fallback; NORMAL returns every current card in Set order and performs no writes.

**Out of scope:** New route/endpoint, server session, cross-Set/global due queue, mutation during read, or client-provided clock.

**Implementation requirements:** Preserve USER-only access, public/owned-private boundaries, non-owner concealment and empty Set `409`. A non-empty Set with no eligible SRS items returns `200` with an empty card array and truthful metadata. Each SRS card exposes `rating_previews` calculated by the authoritative scheduler at the snapshot's single `evaluated_at`; NORMAL must not create/update progress or touch scheduling/counter/revision fields.

**Acceptance criteria:** SRS snapshots are deterministic and ordered; future cards are excluded but nearest due is reported; NORMAL returns all cards in Set order; all reads remain mutation-free.

**Verification:** Focused backend cases for omitted/SRS/NORMAL validation and shape, ordering, empty versus up-to-date state, exact UUID identity, and before/after database snapshots for NORMAL.

**Mandatory STOP:** Any required endpoint/route/middleware change outside the approved contract requires HUMAN PLAN review before implementation.

## TASK-095 — Implement the Four-Rating Backend Mutation

**Objective:** Replace the old two-outcome event mutation with the exact four-rating authoritative scheduling command.

**Dependencies:** TASK-094.

**Expected files / modules:**

- `backend/src/services/learning-service.js`.
- `backend/src/repositories/learning-repository.js`.
- `backend/src/controllers/learning-controller.js` only if envelope pass-through changes are required.
- `backend/test/learning/learning.test.js`.

**In scope:** Exact `event_id`, `set_id`, `vocabulary_id`, `expected_revision`, `rating` validation; reject old `outcome` and extra fields; transactionally recheck user access/current membership/eligibility; schedule from one accepted timestamp; atomically update approved existing fields; return authoritative progress/scheduling data.

**Out of scope:** Client-submitted schedule/status/user/completion/reward fields, undo/change-rating, event history, fingerprint field, gamification or NORMAL mutation.

**Implementation requirements:** Only `AGAIN`, `HARD`, `GOOD`, `EASY` are accepted. One accepted command updates `status`, `interval_days`, `next_review_at`, `last_reviewed_at`, `last_event_id`, `review_count + 1` and `revision + 1`. The response exposes exact vocabulary identity, stored/effective state, stage, interval, due/review timestamps, count and revision.

**Acceptance criteria:** Each rating persists the scheduler result atomically; invalid/stale/future-ineligible commands fail safely; authorization and exact membership remain transactional; no unrelated field changes.

**Verification:** Focused guarded backend tests for all ratings, stage transitions, exact validation, persisted fields, access/membership, stale eligibility and rollback on failure.

## TASK-096 — Enforce Duplicate-Submit, Retry and Concurrency Idempotency

**Objective:** Guarantee that duplicate/retried submissions never advance scheduling twice while preserving approved first-wins semantics.

**Dependencies:** TASK-095.

**Expected files / modules:**

- `backend/src/services/learning-service.js`.
- `backend/src/repositories/learning-repository.js`.
- `backend/test/learning/learning.test.js`.

**In scope:** Check current `last_event_id` before eligibility/revision calculation; reconstruct unchanged authoritative response; same ID with altered content returns the first accepted state; different stale ID returns `409 LEARNING_PROGRESS_CHANGED`; preserve row locking, compare-at-revision update and first-write race handling.

**Out of scope:** Request fingerprints, history/ledger, arbitrary historical replay, undo or a new idempotency store.

**Implementation requirements:** Immediate current-event retry must not recompute schedule or increment `review_count`/`revision`; concurrent first events may accept only one transition; subsequent response/error must reflect the approved contract without leaking inaccessible resources.

**Acceptance criteria:** Same-event retries are byte-for-byte authoritative and invariant in persisted counters/schedule; altered same-event payload is first-wins; stale and concurrent alternatives cannot double-advance.

**Verification:** Guarded backend tests for immediate retry, altered same ID, different stale ID, concurrent same event and concurrent distinct first events with persisted before/after assertions.

**Mandatory STOP:** If safe idempotency cannot be guaranteed with `last_event_id`, revision and existing transaction semantics, STOP for HUMAN review. Do not add schema or a history/fingerprint table.

## TASK-097 — Complete the Backend Verification Checkpoint

**Objective:** Establish cumulative backend/domain/API/security evidence before frontend code consumes the changed contract.

**Dependencies:** TASK-091 through TASK-096 complete.

**Expected files / modules:**

- `backend/test/learning/srs-scheduler.test.js`.
- `backend/test/learning/learning.test.js`.
- Existing Authentication, Vocabulary, Vocabulary Set, Quiz and related integration suites as regression consumers.

**In scope:** Scheduler matrix; modes; eligibility/order; legacy compatibility; Learning Progress due derivation; NORMAL invariance; four ratings; idempotency/concurrency; USER isolation; Set access/membership; exact vocabulary identity; shared Vocabulary across Sets; removal preserving progress; fixture cleanup.

**Out of scope:** Frontend tests, production database, weakening assertions or changing contracts solely to satisfy failures.

**Acceptance criteria:** Targeted and full sequential backend integration suites pass with exact counts reported; controlled TEST fixtures are cleaned; no schema/migration/dependency/scope drift exists.

**Verification checkpoint:**

- `cd backend; node --test test/learning/srs-scheduler.test.js`
- `cd backend; npm run test:db:prepare`
- `cd backend; npm run test:learning`
- `cd backend; npm run test:integration:ci` using the guarded TEST environment required by the repository workflow.
- `cd backend; npx prisma validate`
- `cd backend; npx prisma migrate status`
- `git diff --check` plus schema, secret, fixture and scope inspection.

**Checkpoint:** STOP for HUMAN backend checkpoint review before starting the frontend contract migration if a contract, persistence, authorization or concurrency finding remains unresolved.

## TASK-098 — Update Frontend Learning Service Contracts

**Objective:** Make the frontend service validate and serialize the approved dual-mode reads, four-rating mutation and derived Progress responses.

**Dependencies:** TASK-097 passed and reviewed.

**Expected files / modules:**

- `frontend/src/services/learning-service.js`.
- `frontend/test/learning-service.test.js`.
- `frontend/src/learning-progress/learning-progress-page.jsx` only if the synchronized response requires a consumption change.

**In scope:** Explicit mode serialization for switches/restarts; omitted-mode SRS contract coverage; mode-specific payload guards; `rating` request; authoritative response guard; `evaluated_at`/schedule fields for Progress if present; existing error mapping.

**Out of scope:** API authority in the browser, local schedule calculation, new endpoint, Progress review action, Dashboard behavior change or UI redesign.

**Implementation requirements:** Reject malformed cross-mode responses; never send old `outcome`; keep server-returned progress fields authoritative; preserve existing authentication/error behavior.

**Acceptance criteria:** Valid SRS/NORMAL/rating/Progress responses are accepted; malformed or mismatched payloads fail safely; all four ratings serialize exactly; old/extra mutation fields are absent.

**Verification:** `cd frontend; node --test test/learning-service.test.js`.

## TASK-099 — Add Versioned Dual-Mode State and Invalidate Old Two-Outcome Storage

**Objective:** Replace the current transient run shape with safe, Learning-owned, versioned SRS and NORMAL state.

**Dependencies:** TASK-098.

**Expected files / modules:**

- `frontend/src/learning/learning-run-state.js`.
- `frontend/test/learning-run-state.test.js`.
- `frontend/src/learning/learning-session-storage-observer.jsx` — reuse/modify only if namespace cleanup requires it.

**In scope:** State version; user/Set binding; active mode; SRS snapshot time/unique IDs/queue/passed IDs/presentation count; NORMAL exact current ID; safe retry context; namespace-compatible serialization/reconciliation.

**Out of scope:** Card content, auth data, authoritative schedule fields/calculation, cross-device/server session, offline sync or reinterpretation of v1 two-outcome payloads.

**Implementation requirements:** Old v1/two-outcome, corrupt, wrong-user or wrong-Set storage must fail closed and create fresh mode state. Logout/session invalidation must continue clearing only Learning-owned keys.

**Acceptance criteria:** New state round-trips safely; stale v1 state is rejected rather than migrated semantically; mode states remain isolated yet coexist under the approved namespace; no sensitive/full card data is persisted.

**Verification:** Focused unit tests for version rejection, corrupted storage, user/Set mismatch, fresh state, serialization and namespace cleanup.

## TASK-100 — Implement the SRS Queue/Requeue Without Duplicate Vocabulary Entries

**Objective:** Add pure fixed-snapshot queue operations for pass and `AGAIN` behavior.

**Dependencies:** TASK-099.

**Expected files / modules:**

- `frontend/src/learning/learning-run-state.js`.
- `frontend/test/learning-run-state.test.js`.

**In scope:** Exact-ID snapshot reconciliation; unique initial IDs; applying authoritative pass; `AGAIN` removal of pending duplicate and one reinserted occurrence after three intervening presentations when possible, otherwise tail; fixed unique denominator; passed set; presentation count.

**Out of scope:** Newly due injection into an existing snapshot, duplicate simultaneous occurrences, local scheduling, optimistic advancement, random ordering or server queue persistence.

**Implementation requirements:** Use the submitted rating only to select pass versus requeue after backend success. Use authoritative returned fields for persistence-related state. Drop removed members; do not inject newly added/newly due cards until restart.

**Acceptance criteria:** At most one pending occurrence exists per exact vocabulary ID; repeated `AGAIN` never duplicates it; requeue spacing works for 0, 1, 2, 3 and 3+ intervening presentations; completion uses passed unique IDs over the initial unique total.

**Verification:** Unit matrix for queue distances, repeated `AGAIN`, exact-ID collisions/same spelling, pass completion, fixed denominator and membership reconciliation.

## TASK-101 — Implement Mode Switch, Restart and Exit/Resume Semantics

**Objective:** Complete pure/session behavior for switching modes, restarting each mode and resuming after reload or route exit.

**Dependencies:** TASK-100.

**Expected files / modules:**

- `frontend/src/learning/learning-run-state.js`.
- `frontend/test/learning-run-state.test.js`.
- `frontend/src/learning/learning-foundation-page.jsx` later consumes these helpers.

**In scope:** Preserve both states across mode switch; SRS restart replaces state from a newly fetched snapshot; NORMAL restart returns to first card/front; exact-ID NORMAL cursor movement; reload/return restores valid SRS pending requeues and NORMAL cursor; conflict/membership reconciliation.

**Out of scope:** Rollback API, cross-device state, server session, injecting newly due cards without SRS restart, or retaining optimistic completion after conflict.

**Implementation requirements:** Switching never mutates accepted SRS progress. Missing local state after accepted `AGAIN` is safely recovered by a fresh SRS read where the item is immediately due. Removed IDs are dropped; conflict refresh reconciles exactly.

**Acceptance criteria:** Mode switching restores destination state; restart semantics are mode-correct; exit/reload resumes pending work; conflict reconciliation removes stale items and no accepted mutation is rolled back.

**Verification:** Focused unit scenarios for switch isolation, SRS/NORMAL restart, exit/resume, lost state after `AGAIN`, membership removal and conflict refresh.

## TASK-102 — Implement the Dual-Mode Flashcard UI and Four-Button Back Side

**Objective:** Adapt the existing Focus Mode page to the approved SRS/NORMAL interaction without redesigning shared card presentation.

**Dependencies:** TASK-098 through TASK-101.

**Expected files / modules:**

- `frontend/src/learning/learning-foundation-page.jsx`.
- `frontend/src/learning/learning-presentation.js`.
- A narrowly extracted mode selector or four-button action component only if it materially improves readability.
- Existing scoped styles/Tailwind usage in the page.

**In scope:** Labelled compact segmented control `Ôn tập SRS | Ôn tập thường` in the existing Flashcard learning header; SRS default; fixed snapshot progress; reveal-first flow; back-side native buttons in order `Lại`, `Khó`, `Tốt`, `Dễ`; pending/retry/conflict/stale/completion/up-to-date states; NORMAL all-card Previous/Next browsing; restart and return-to-Set actions; existing audio behavior.

**Out of scope:** Card visual redesign, skip in SRS, Previous/Next in SRS, rating controls in NORMAL, new content hierarchy, pronunciation practice, gamification or other learning entry redesign.

**Implementation requirements:** Rating buttons appear only after reveal and use authoritative preview results for their second line: `AGAIN` = `Trong phiên này`; 1 day = `Ngày mai`; 3 days = `1–3 ngày`; 7 days = `1 tuần+`; 14 days = `2 tuần`; 30 days = `30 ngày`. Do not calculate transitions in the frontend. Submit immediately, but do not advance, requeue or increment completion until success. Disable mode/rating controls while pending. NORMAL must never invoke the event endpoint. Preserve deterministic primary Meaning, safe flip, audio/TTS isolation and current error handling.

**Acceptance criteria:** SRS and NORMAL render the approved distinct controls/states; four ratings send exact commands; SRS has no navigation/skip; NORMAL preserves Previous/Next and does zero mutations; existing card/presentation behavior remains intact.

**Verification:** Focused component/browser tests plus service-call assertions; inspect network mocks to prove zero NORMAL event calls and no optimistic SRS advancement.

**Mandatory STOP:** If these controls require a major UI flow or card redesign beyond the approved checkpoint, STOP for HUMAN UI/UX review.

## TASK-103 — Complete Accessibility, Focus and Responsive Behavior

**Objective:** Make the dual-mode experience keyboard-safe, focus-predictable, announced and overflow-free at supported viewports.

**Dependencies:** TASK-102.

**Expected files / modules:**

- `frontend/src/learning/learning-foundation-page.jsx`.
- Existing scoped presentation/styles.
- `frontend/src/learning/learning-presentation.js` only for generic pending-rating naming/safety.
- Focused frontend tests.

**In scope:** Labelled tab/radio-like selected semantics; standard keyboard activation; reveal focus; predictable rating DOM order; pending disabled semantics; next-card/completion focus; polite live updates including returned `AGAIN`; mode-switch focus; NORMAL button labels/focus; status/alert semantics; reduced motion; 44px touch targets; desktop/tablet/mobile wrapping/no horizontal overflow. On mobile, the compact mode control may wrap to a second row within the existing Flashcard learning header when needed.

**Out of scope:** Custom keyboard shortcuts beyond the approved contract, color-only status, animation redesign or global shell redesign.

**Implementation requirements:** Enter/Space activates only the focused native button; speaker interaction remains isolated from reveal; mode switch cannot accidentally flip/rate; all safe states are exposed semantically.

**Acceptance criteria:** Keyboard and focus sequence matches the SPEC; live/status feedback is meaningful; visible focus and touch targets pass; four ratings and mode controls remain usable without horizontal overflow at supported widths; reduced motion remains honored.

**Verification:** Focused unit/browser assertions for accessible roles/names/selection, keyboard activation, focus movement, live regions, reduced motion, bounding boxes, touch target size and horizontal scroll.

## TASK-104 — Complete the Frontend Unit Verification Checkpoint

**Objective:** Establish cumulative pure/service/presentation evidence before browser-level suites.

**Dependencies:** TASK-098 through TASK-103 complete.

**Expected files / modules:**

- `frontend/test/learning-service.test.js`.
- `frontend/test/learning-run-state.test.js`.
- `frontend/test/learning-presentation.test.js`.
- Full existing frontend Node unit suite.

**In scope:** All approved service guards, stale-state rejection, queue/requeue, mode isolation, restart/resume, presentation regression and malformed/error handling.

**Out of scope:** Database assertions, weakening existing tests or browser-only evidence.

**Acceptance criteria:** Focused and full frontend unit suites pass; obsolete two-outcome constants/helpers are removed or renamed without presentation regression; lint/build pass.

**Verification checkpoint:**

- `cd frontend; node --test test/learning-service.test.js test/learning-run-state.test.js test/learning-presentation.test.js`
- `cd frontend; npm test`
- `cd frontend; npm run lint`
- `cd frontend; npm run build`
- `git diff --check` plus secret and scope checks.

## TASK-105 — Add Focused Mocked Playwright Coverage

**Objective:** Verify dual-mode behavior, failures, accessibility and responsive presentation in the default mocked-browser harness.

**Dependencies:** TASK-104 passed.

**Expected files / modules:**

- Create `frontend/e2e/auth/learning-srs.spec.js` or extend the equivalent focused mocked spec if repository conventions make that safer.
- Reuse `frontend/playwright.config.js` and existing mocked fixtures/helpers.

**In scope:** Default SRS; mode selection; reveal-gated four ratings; no SRS Previous/Next/skip; keyboard/focus; NORMAL navigation and zero event requests; pending/error/retry/conflict with no optimistic movement; empty versus up-to-date; fixed progress under `AGAIN`; responsive/reduced-motion behavior.

**Out of scope:** Real database persistence claims, duplicating real-stack cases, broad unrelated browser rewrites or screenshot-only assertions.

**Implementation requirements:** Assert exact requests and absence of NORMAL event requests; use native accessibility semantics; cover desktop/tablet/mobile and reduced motion using current harness conventions.

**Acceptance criteria:** Focused mocked scenarios pass and prove UI state/interaction/accessibility boundaries independently of the database.

**Verification:** `cd frontend; npx playwright test e2e/auth/learning-srs.spec.js --config=playwright.config.js`, followed by the scoped existing mocked Auth/App Layout/Learning Progress regressions identified by the implementation diff.

## TASK-105A — Revise the Deterministic First-Review Timing

**Objective:** Reconcile the implemented pure scheduler with the HUMAN-approved integer-day first-review contract before real-stack closure begins.

**Dependencies:** TASK-105 checkpoint evidence; explicit HUMAN implementation authorization for this revision.

**Expected files / modules:**

- `backend/src/services/srs-scheduler.js`.
- `backend/test/learning/srs-scheduler.test.js`.

**In scope:** Change only NEW/stage-0 passing transitions to `HARD` = stage 1/1 day, `GOOD` = stage 2/3 days and `EASY` = stage 3/7 days; retain the existing stable-stage rules and 30-day cap.

**Out of scope:** Schema/migration changes, fractional intervals, timestamp encoding tricks, adaptive scheduling, eligibility/queue semantic changes or unrelated backend work.

**Acceptance criteria:** The complete six-row/four-rating matrix matches the revised SPEC; `AGAIN` remains immediately due; all passing due timestamps use exact 24-hour multiples; later stages are unchanged.

**Verification:** `cd backend; node --test test/learning/srs-scheduler.test.js`.

## TASK-105B — Synchronize Authoritative Rating Previews and Backend Contract Tests

**Objective:** Ensure SRS reads and mutations share the revised scheduler results without duplicating scheduling logic.

**Dependencies:** TASK-105A.

**Expected files / modules:**

- `backend/src/services/learning-service.js` only if preview wiring requires adjustment.
- `backend/test/learning/learning.test.js`.

**In scope:** Regenerate each card's `rating_previews` using the same scheduler and snapshot `evaluated_at`; verify NEW 1/3/7-day previews, all stable-stage rows, exact persisted mutation results and the 30-day cap.

**Out of scope:** Response-shape expansion beyond the already approved `rating_previews`, new endpoint, schema/migration work, NORMAL mutation or scheduler duplication.

**Acceptance criteria:** Preview and accepted mutation agree for every stage/rating; `AGAIN` has no future interval and remains same-session due; reads stay mutation-free and NORMAL stays read-only.

**Verification:** Focused scheduler and guarded Learning integration tests using only the dedicated `.env.test` database.

## TASK-105C — Synchronize Rating-Button Preview Wording

**Objective:** Present the revised authoritative timing in concise, accessible two-line SRS rating buttons.

**Dependencies:** TASK-105B.

**Expected files / modules:**

- `frontend/src/services/learning-service.js` only if response fixtures/guards require synchronization.
- `frontend/src/learning/learning-foundation-page.jsx`.
- Focused Learning service/presentation/component and mocked Playwright tests.

**In scope:** Map returned preview results to `Trong phiên này`, `Ngày mai`, `1–3 ngày`, `1 tuần+`, `2 tuần` and `30 ngày`; preserve primary labels, accessibility, pending behavior, queue semantics and the approved visual architecture.

**Out of scope:** Frontend scheduler logic, hardcoded rating-to-day mappings, UI redesign, NORMAL behavior changes or unrelated polish.

**Acceptance criteria:** Every possible authoritative interval renders the approved wording; `AGAIN` never shows a fake future interval; accessible naming communicates primary and secondary text; existing SRS/NORMAL interactions remain unchanged.

**Verification:** Focused Learning unit/component tests and focused mocked Flashcard Playwright coverage at approved breakpoints.

## TASK-105D — Verify the Timing Revision Before Real-Stack Closure

**Objective:** Establish a clean backend/frontend checkpoint for the revised contract before TASK-106.

**Dependencies:** TASK-105A through TASK-105C.

**Expected files / modules:** Verification evidence only; no unrelated source changes.

**In scope:** Focused and cumulative scheduler/Learning tests, frontend Learning tests, mocked Flashcard Playwright, production build, touched-file ESLint and diff/scope checks.

**Out of scope:** TASK-106 real-stack closure, documentation synchronization in TASK-107, commit/push, stash operations or main `.env` database access.

**Acceptance criteria:** Revised scheduler, previews, persisted mutation agreement, wording and accessibility all pass; no schema/migration/API-shape drift exists.

**Verification checkpoint:** Run the focused backend and frontend commands identified above, `cd frontend; npm run build`, touched-file ESLint and `git diff --check`.

**Mandatory STOP:** STOP for HUMAN review. Do not start TASK-106 until HUMAN accepts this revision checkpoint and explicitly authorizes continuation. If integer-day persistence proves insufficient, STOP before any schema/migration change.

## TASK-106 — Extend Dedicated Real-Stack and Cross-Feature Coverage

**Objective:** Prove authoritative persistence, exact identity, authorization, resume and NORMAL invariance against the guarded TEST stack.

**Dependencies:** TASK-097 and TASK-105 passed; TASK-105D passed and HUMAN approved continuation.

**Expected files / modules:**

- `frontend/e2e/integration/learning-real-stack.spec.js`.
- `frontend/e2e/integration/learning-progress-real-stack.spec.js`.
- `frontend/playwright.learning.config.js`.
- Existing Set Detail, Dashboard, Quiz and Authentication regression specs/configs as affected.
- Existing guarded fixture/process helpers only where narrowly needed.

**In scope:** NEW and representative stable-stage transitions; `AGAIN` then exit/reload/resume/reappearance/pass; repeated `AGAIN` no simultaneous duplicate; mode switch without rollback; NORMAL all-card traversal and byte-for-byte progress invariance; up-to-date/empty states; canonical/private same-spelling exact IDs; shared Vocabulary and membership removal; Guest/ADMIN/non-owner boundaries; fixture/process/listener cleanup.

**Out of scope:** Preview/Production, persistent server session, unrelated full-product expansion or changing contracts to mask test failures.

**Implementation requirements:** Use only guarded dedicated TEST DB/process conventions. Seed explicit timestamps rather than wall-clock assumptions. Execute real-stack suites sequentially where shared database/process isolation requires it.

**Acceptance criteria:** Dedicated Learning and Learning Progress real-stack suites pass; affected Set Detail, Dashboard, Quiz and Authentication regressions remain green; NORMAL produces no persisted delta; duplicate submissions never double-advance; all fixtures/listeners/processes are cleaned.

**Verification checkpoint:**

- `cd backend; npm run test:db:prepare`
- `cd frontend; node --env-file=../backend/.env.test ./node_modules/@playwright/test/cli.js test --config=playwright.learning.config.js`
- Run the Learning Progress real-stack config and scoped Set Detail/Dashboard/Quiz/Auth regressions selected from actual consumers.
- Report exact pass/fail/skip counts, fixture cleanup and listener/process cleanup.
- `cd frontend; npm run lint`; `cd frontend; npm run build`; `git diff --check`.

**Checkpoint:** Any persistence, authorization, idempotency, NORMAL-invariance or cleanup failure must be resolved through IMPLEMENT→TEST before documentation/final review. Contract/design findings return to PLAN/TASK as required.

## TASK-107 — Synchronize Confirmed Database, API, UI and Feature Documentation

**Objective:** Update project documentation to match only the behavior verified by implementation and tests.

**Dependencies:** TASK-106 passed with no unresolved contract finding.

**Expected files / modules:**

- `docs/DATABASE.md`.
- `docs/API_SPEC.md`.
- `docs/UI_UX_SPEC.md`.
- `docs/FLASHCARD_LEARNING_V1_UI_UX_CHECKPOINT.md`.
- `docs/FEATURE_STATUS.md`.
- `docs/PROJECT_OVERVIEW.md` and `docs/ARCHITECTURE.md` only if an approved real delta exists; none is planned.

**In scope:** Active ladder/stage encoding and derived due semantics; no-migration/no-history boundary; exact dual-mode GET with authoritative `rating_previews`; exact four-rating POST; authoritative/idempotent response; effective Progress reads; verified two-line preview wording and dual-mode/action/session/accessibility UI; honest workflow status.

**Out of scope:** Using documentation to authorize an unapproved change, future/V2 features, marking `DONE` before formal TEST/REVIEW/HUMAN approval, or speculative architecture/scope updates.

**Implementation requirements:** `docs/API_SPEC.md` must exactly match request validation, response fields, error/idempotency semantics and NORMAL read-only behavior. Status may move only to the stage actually evidenced (`IN_PROGRESS`, then implementation/test states used by the project); final `DONE` remains gated by TASK-108 and HUMAN closure approval.

**Acceptance criteria:** Documentation and verified implementation agree with no stale two-outcome active contract; deferred boundaries remain explicit; no unverified status claim appears.

**Verification:** Documentation-to-code/test traceability review; `rg` for stale active `REMEMBERED`, `STUDY_AGAIN`, one-mode and old payload references; `git diff --check`; scope/status audit.

**Mandatory STOP:** Any documentation update that reveals a real SPEC/PLAN/API conflict must return to the correct approval stage instead of being silently reconciled.

## TASK-108 — Perform Formal TEST, REVIEW and Closure Preparation

**Objective:** Run the project TEST and REVIEW workflows, resolve findings correctly, and prepare SRS V1 for separate HUMAN closure approval.

**Dependencies:** TASK-090 through TASK-107 complete and checkpoint-approved as required.

**Expected files / modules:**

- All changed implementation/tests/docs for evidence review.
- `docs/FEATURE_STATUS.md` only for status supported by completed gates and HUMAN approval.
- Formal evidence recorded using the project’s established documentation convention.

**In scope:** Complete SPEC acceptance-criteria traceability; scheduler correctness; legacy behavior; API/auth/security; idempotency/concurrency; NORMAL invariance; state/queue/resume; UI/accessibility/responsive; Learning Progress/Dashboard compatibility; database/migration status; regression/scope/secret/fixture cleanup; documentation consistency.

**Out of scope:** Automatic `DONE`, deployment, commit/push, stash operations, V2/deferred work or silent fixes outside their approved workflow stage.

**Implementation requirements:** Use `.agents/skills/test/SKILL.md` for formal TEST and `.agents/skills/review/SKILL.md` for formal REVIEW. A failed criterion returns to IMPLEMENT→TEST; a requirement/design issue returns to SPEC/PLAN/TASK. Report every command not run as `NOT RUN` with reason.

**Acceptance criteria:** Formal TEST is `PASS`; formal REVIEW is `APPROVE`; all approved requirements have evidence; no unresolved blocker/security/scope/documentation mismatch remains; controlled TEST resources are clean; HUMAN receives a closure package for approval.

**Verification:** Re-run the cumulative commands/checkpoints required by the final test plan, record exact results, inspect final diff and Git status, verify no Prisma/dependency/route/unrelated-module drift, and obtain explicit HUMAN approval before marking SRS V1 `DONE`.

**Final STOP:** Stop for HUMAN formal review/closure. Do not commit, push, touch `stash@{0}`, or mark `DONE` without explicit HUMAN authorization.

## 5. Coverage and Traceability Summary

### Backend implementation checkpoint evidence

- `TASK-090`: `COMPLETE — HUMAN REVIEWED`; schema validation and dedicated TEST DB parity passed, while configured development DB parity remains accurately `NOT VERIFIED — Supabase/Prisma schema-engine error`.
- `TASK-091`: `COMPLETE`; pure dependency-free stage scheduler implemented with fixed-clock matrix coverage.
- `TASK-092`: `COMPLETE`; legacy `LEARNING`, persisted `NEEDS_REVIEW`, valid scheduled, incomplete and non-ladder `LEARNED` mappings implemented without read-time writes.
- `TASK-093`: `COMPLETE`; repository projections and one-timestamp effective Learning Progress summary/filter/item behavior implemented.
- `TASK-094`: `COMPLETE`; omitted/SRS/NORMAL reads, deterministic eligibility ordering, nearest future due and NORMAL read-only behavior implemented.
- `TASK-095`: `COMPLETE`; exact four-rating validation and atomic authoritative scheduling mutation implemented.
- `TASK-096`: `COMPLETE`; current-event retry, altered same-event first-wins, stale revision and concurrent first-event protections verified without schema expansion.
- `TASK-097`: `COMPLETE — HUMAN REVIEWED`. Scheduler tests passed 5/5; expanded guarded Learning integration passed 18/18. The full sequential backend integration run passed 82/83 with one unrelated Vocabulary ADMIN update receiving a safe 500 after an anomalous ~238-second remote TEST DB operation; the exact failed test immediately passed 1/1 on focused rerun. HUMAN accepted the failure as a non-reproducible remote TEST DB latency anomaly. Prisma validation and dedicated TEST DB preparation/parity passed with 7 migrations and none pending. Development DB parity remains NOT VERIFIED and was not retried or mutated after HUMAN authorization to continue.

- `TASK-098`: `COMPLETE`; frontend Learning service sends explicit modes, retains omitted-SRS coverage, validates mode-specific reads, uses exact four-rating commands and validates authoritative scheduling/derived Progress fields.
- `TASK-099`: `COMPLETE`; versioned dual-mode transient state is implemented and old v1 two-outcome session storage fails closed while the existing Learning-owned namespace remains intact.
- `TASK-100`: `COMPLETE`; pure fixed-snapshot pass/`AGAIN` queue behavior preserves a fixed unique denominator and at most one pending occurrence per exact Vocabulary ID.
- `TASK-101`: `COMPLETE`; mode state, NORMAL cursor, SRS/NORMAL restart, exit/reload resume and conflict retry context are isolated and persisted safely.
- `TASK-102`: `COMPLETE`; the existing Focus Mode/3D Flashcard/pronunciation presentation now hosts the compact `Ôn tập SRS | Ôn tập thường` header segment, four revealed-side rating controls and unchanged NORMAL Previous/Next browsing with zero mutation calls.
- `TASK-103`: `COMPLETE`; selected semantics, keyboard reveal/rating, deterministic answer/next/completion focus, polite announcements, responsive wrapping, 44px primary controls and reduced-motion behavior are implemented without a broad Flashcard redesign.
- `TASK-104`: `COMPLETE`; focused Learning unit tests passed 18/18, the full frontend Node suite passed 83/83, touched-file ESLint passed and the production build passed with only the existing bundle-size advisory.
- `TASK-105`: `COMPLETE — HUMAN REVIEWED`; focused mocked Flashcard/SRS Playwright passed 8/8 across desktop, tablet and mobile, including default SRS, accessible mode switching, reveal-gated ratings, `AGAIN` requeue, legacy-state invalidation/resume, NORMAL zero-event browsing, pending/conflict invariance, up-to-date actions, no horizontal overflow and reduced motion.
- `TASK-105A`: `COMPLETE`; the pure scheduler and full matrix test now use NEW `HARD`/`GOOD`/`EASY` results of stage 1/2/3 and 1/3/7 days while preserving later stages, immediate `AGAIN` and the 30-day cap.
- `TASK-105B`: `COMPLETE`; SRS reads expose the revised full authoritative `rating_previews` matrix and guarded TEST DB integration proves preview/mutation agreement, persistence, idempotency, eligibility and NORMAL read-only behavior.
- `TASK-105C`: `COMPLETE`; the existing two-line rating buttons map backend preview results to `Trong phiên này`, `Ngày mai`, `1–3 ngày`, `1 tuần+`, `2 tuần` and `30 ngày`, with accessible names containing both lines and no frontend scheduler transition logic.
- `TASK-105D`: `COMPLETE — HUMAN REVIEWED`; scheduler unit tests passed 5/5, guarded Learning integration passed 20/20, focused frontend Learning unit tests passed 20/20, focused mocked Flashcard Playwright passed 22/22, production build, touched-file ESLint and `git diff --check` passed.

`TASK-106`: `COMPLETE — HUMAN APPROVED`; TEST DB preparation passed with all 7 migrations and none pending. The Learning real-stack scenarios passed 10/10 across the complete sequential scenario set, Learning Progress passed 5/5, scoped Authentication/Quiz passed 5/5, Dashboard passed 2/2, public Set Detail passed 3/3 and USER Set Detail passed 2/2. Verification used guarded `.env.test` runtimes on isolated ports; no product behavior, schema or migration changed in TASK-106.

`TASK-107`: `COMPLETE`; active Database, API, UI/UX and feature-status documentation is synchronized with the verified four-rating dual-mode contract. Historical Flashcard V1 documents remain identifiable as superseded history rather than active contract.

`TASK-108`: `COMPLETE — CLOSURE PREP PENDING HUMAN APPROVAL`; formal TEST is PASS and formal REVIEW is APPROVE. Scope, architecture, security, persistence, idempotency, NORMAL invariance, queue/requeue, documentation, repository hygiene and carried-forward real-stack evidence were reviewed with no blocking finding.

| Approved requirement | Primary tasks |
|---|---|
| Pure deterministic scheduler | TASK-091 |
| Legacy progress compatibility | TASK-092 |
| Learning Progress derived due state | TASK-093 |
| SRS eligibility snapshot/order | TASK-094 |
| NORMAL backend read-only guarantee | TASK-094, TASK-097, TASK-106 |
| Four-rating backend mutation | TASK-095 |
| Duplicate-submit/idempotency protection | TASK-096 |
| Backend/unit coverage | TASK-091–TASK-097 |
| Frontend service and dual-mode state | TASK-098–TASK-099 |
| Stale old two-outcome sessionStorage invalidation | TASK-099 |
| SRS queue/requeue without duplicate entries | TASK-100 |
| Mode switch/restart/exit-resume | TASK-101 |
| Four-button back-side UI | TASK-102 |
| NORMAL Previous/Next preservation | TASK-102 |
| Accessibility/focus | TASK-103 |
| Responsive behavior | TASK-103 |
| Frontend unit coverage | TASK-104 |
| Mocked Playwright coverage | TASK-105 |
| Revised NEW 1/3/7-day timing and preview wording | TASK-105A–TASK-105D |
| Dedicated real-stack/regression coverage | TASK-106 |
| Database/API/UI/status documentation synchronization | TASK-107 |
| Final TEST and REVIEW | TASK-108 |

## 6. Execution Notes

- Execute tasks in order. A later task may be prepared in parallel only when its dependencies are complete and it does not touch the same contract/files; no parallel execution is assumed by this document.
- HUMAN approval of this TASK document authorizes entry to IMPLEMENT only; it does not waive the mandatory STOP/checkpoint conditions.
- The active API replacement must be atomic across backend, frontend and tests. Do not temporarily preserve the old `outcome` contract as an undocumented compatibility path.
- Existing completed Flashcard/Learning behavior is regression scope, not a target for broad refactoring.
- Every command listed here is a future verification checkpoint. No command is claimed as passed by the TASK stage.

## 7. Approval Gate

```text
SPEC STATUS: HUMAN APPROVED
PLAN STATUS: HUMAN APPROVED
TASK STATUS: HUMAN APPROVED
FEATURE STATUS: DONE — FORMAL TEST PASS / REVIEW APPROVE
IMPLEMENTATION AUTHORIZED: YES — TASK-090 onward in approved order
NEXT ALLOWED ACTION: HUMAN CLOSURE APPROVAL, THEN COMMIT / FF-ONLY INTEGRATION AS SEPARATELY AUTHORIZED
```
