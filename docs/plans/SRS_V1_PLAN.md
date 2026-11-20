# PLAN: SRS V1 — Dual-Mode Flashcard Review

**Feature status:** `DONE — FORMAL TEST PASS / REVIEW APPROVE; PENDING HUMAN CLOSURE APPROVAL`

**SPEC:** `docs/specs/SRS_V1_SPEC.md` — HUMAN APPROVED

**PLAN status:** `HUMAN APPROVED`

**Implementation authorized:** `NO — TASK approval required before implementation`

**HUMAN-approved contract revision (2026-10-05):** Preserve integer-day persistence and revise NEW/stage-0 results to `HARD` = 1 day, `GOOD` = 3 days and `EASY` = 7 days. No schema/migration change is planned.

## 1. Summary

Implement SRS V1 by extending the completed Learning stack rather than creating a parallel learning subsystem:

- reuse `LEARNING_PROGRESS` and its scheduling, revision and idempotency fields with no schema migration;
- add a small pure backend scheduler for stage/rating/due calculations with an injected clock;
- extend the existing Learning repository/service/controller contracts for `SRS` and `NORMAL` reads and four-rating mutations;
- make effective `NEEDS_REVIEW` consistent in the existing Learning Progress read model;
- replace the current two-outcome transient run state with versioned, mode-specific SRS queue state and normal positional state;
- adapt the existing Flashcard page action/header area while reusing its card, flip, Meaning, pronunciation, focus and responsive presentation; and
- update focused unit, backend integration, mocked browser and dedicated TEST-database real-stack coverage before final review.

No new role, dependency, external service, persistent session, event history or SRS history model is planned.

## 2. Affected Areas

- **Database:** existing `LEARNING_PROGRESS` data only; no model or migration expected.
- **Backend domain:** new deterministic scheduler and effective-state helpers; injected backend clock.
- **Backend data access:** expose scheduling fields and support time-aware effective Progress queries.
- **API:** extend `GET /api/learning/sets/:setId`, replace two-outcome event body with four ratings, and synchronize effective due reads.
- **Frontend:** mode-aware service validation, versioned run state/queue helpers, and dual-mode behavior in the existing Flashcard page.
- **Tests:** scheduler unit tests, Learning backend tests, frontend unit tests, focused mocked Playwright, dedicated TEST DB real-stack tests and affected regressions.
- **Documentation:** synchronize active Database/API/UI contracts after implementation is verified; update feature status only at the appropriate later workflow stage.

## 3. Existing Code to Reuse

### 3.1 Backend

- `backend/prisma/schema.prisma` — reuse `LEARNING_PROGRESS`, exact `(user_id, vocabulary_id)` uniqueness, existing FKs and scheduling fields.
- `backend/prisma/migrations/20260923000000_add_learning_progress/migration.sql` — confirms current status/revision/positive-interval constraints already support V1 values.
- `backend/src/repositories/learning-repository.js` — extend existing Set authorization/content projection, progress reads, transactions, row locking and compare-at-revision update.
- `backend/src/services/learning-service.js` — retain validation/error mapping, Set access, membership validation, optimistic concurrency and immediate-current-event retry boundary.
- `backend/src/controllers/learning-controller.js` — pass validated query input to the service and preserve response/error envelopes.
- `backend/src/routes/learning-routes.js` — retain the same three Learning endpoints and existing authentication/USER middleware order.
- `backend/src/create-app.js` — retain assembly and add optional clock injection for Learning without changing production callers.
- `backend/test/learning/learning.test.js` — extend the guarded TEST-database suite and existing fixture/cleanup/auth patterns.

### 3.2 Frontend

- `frontend/src/learning/learning-foundation-page.jsx` — reuse the Focus Mode page, card faces, pronunciation, loading/error handling and focus refs.
- `frontend/src/learning/learning-run-state.js` — replace the current two-outcome state shape with mode-specific versioned state and pure SRS queue operations.
- `frontend/src/learning/learning-presentation.js` — retain primary-Meaning, safe flip, speech voice and pronunciation helpers; adapt pending-rating naming only where needed.
- `frontend/src/learning/learning-session-storage-observer.jsx` — retain Learning-owned namespace cleanup on logout/session invalidation.
- `frontend/src/services/learning-service.js` — extend the existing HTTP client and response guards for mode-specific reads and authoritative rating responses.
- `frontend/test/learning-run-state.test.js`, `frontend/test/learning-presentation.test.js`, `frontend/test/learning-service.test.js` — extend current pure unit coverage.
- `frontend/e2e/integration/learning-real-stack.spec.js` and `frontend/playwright.learning.config.js` — extend the existing dedicated Learning real-stack harness and cleanup.
- `frontend/e2e/auth/` with `frontend/playwright.config.js` — reuse mocked browser conventions for focused UI/accessibility cases.

## 4. Data and Persistence Plan

### 4.1 Existing Model

Continue using one `LEARNING_PROGRESS` row per `(user_id, vocabulary_id)`:

- `status` stores `LEARNING` after `AGAIN` and `LEARNED` after passing ratings;
- `interval_days` encodes the stable stage as `null`, `1`, `3`, `7`, `14` or `30`;
- `next_review_at` stores immediate due time or the next stable review time;
- `last_reviewed_at`, `review_count`, `revision` and `last_event_id` preserve current event semantics;
- `ease_factor` remains unused and unchanged.

Set/Set Item deletion continues to have no cascade path to progress. Vocabulary deletion remains restricted while referenced. Canonical/private Vocabulary remain independent exact UUIDs.

### 4.2 Migration Decision

No migration is planned:

- all required columns already exist and are nullable where stage 0/legacy compatibility requires it;
- the existing `interval_days IS NULL OR interval_days > 0` constraint accepts all approved ladder values;
- strengthening the database constraint to only ladder values would conflict with the approved requirement to consume possible legacy non-ladder rows safely;
- no new index is justified because SRS V1 reads progress only through the bounded current Set aggregate, not a global due queue.

Before implementation begins, the data task should verify the actual TEST and configured development schemas match migrations. If that check finds schema drift, stop and revise the PLAN rather than silently creating a migration.

### 4.3 Atomic Writes

The existing transaction remains the mutation boundary. One accepted rating atomically updates:

- `status`;
- `interval_days`;
- `next_review_at`;
- `last_reviewed_at`;
- `last_event_id`;
- `review_count + 1`; and
- `revision + 1`.

No server session/history record is written. NORMAL mode performs reads only.

## 5. Backend Domain and Scheduler Plan

### 5.1 Pure Scheduler Module

Create `backend/src/services/srs-scheduler.js` as a dependency-free pure domain module. It will own:

- ladder constants and interval-to-stage normalization;
- effective stage derivation for NEW, LEARNING, LEARNED, persisted NEEDS_REVIEW and legacy rows;
- effective state/due derivation at a supplied `evaluatedAt`;
- eligibility determination;
- rating transition calculation for `AGAIN`, `HARD`, `GOOD`, `EASY`; and
- next timestamp calculation from one supplied acceptance time.

Keep authorization, repository calls and HTTP validation in the existing Learning service; keep scheduler functions unaware of Express/Prisma.

### 5.2 Stage and Rating Rules

Implement the approved exact ladder:

```text
stage 0 = null interval
stage 1 = 1 day
stage 2 = 3 days
stage 3 = 7 days
stage 4 = 14 days
stage 5 = 30 days (cap)
```

- `AGAIN`: stage 0, `LEARNING`, `interval_days = null`, `next_review_at = acceptedAt`.
- `HARD`: retain stable stage; stage 0 becomes stage 1.
- `GOOD`: advance one stable stage; stage 0 is the explicit first-review exception and becomes stage 2; cap stage 5.
- `EASY`: advance two stable stages; stage 0 is the explicit first-review exception and becomes stage 3; cap stage 5.
- Passing ratings write `LEARNED` and `acceptedAt + interval * 24h`.

Use millisecond duration arithmetic in UTC. Do not use local calendar-day mutation.

The complete revised transition matrix is:

| Current stage | `AGAIN` | `HARD` | `GOOD` | `EASY` |
|---:|---:|---:|---:|---:|
| 0 / NEW | 0 / due now | 1 / 1d | 2 / 3d | 3 / 7d |
| 1 / 1d | 0 / due now | 1 / 1d | 2 / 3d | 3 / 7d |
| 2 / 3d | 0 / due now | 2 / 3d | 3 / 7d | 4 / 14d |
| 3 / 7d | 0 / due now | 3 / 7d | 4 / 14d | 5 / 30d |
| 4 / 14d | 0 / due now | 4 / 14d | 5 / 30d | 5 / 30d |
| 5 / 30d | 0 / due now | 5 / 30d | 5 / 30d | 5 / 30d |

Generate `rating_previews` with this same pure scheduler and the read response's single `evaluated_at`; do not duplicate transition logic in the frontend. Keep the existing response shape and replace only superseded preview values.

### 5.3 Clock Injection

Extend `createLearningService` with an optional `now` dependency defaulting to `() => new Date()`. Thread an optional clock through `createApp({ prisma, ... })` only for tests while keeping existing production/test callers valid.

Each service operation captures `now()` exactly once:

- one `evaluated_at` for a Set snapshot;
- one `evaluated_at` for a Learning Progress list/summary consistent read; or
- one `accepted_at` for a rating transaction.

Do not call the clock separately for status, interval and timestamp fields.

### 5.4 Eligibility and Ordering

The service receives current Set Items in position order and partitions them at the captured timestamp:

1. existing eligible progress — LEARNING, derived DUE/persisted NEEDS_REVIEW and legacy-unscheduled — in `position ASC`;
2. NEW — in `position ASC`.

Use exact UUID as a defensive final tie-breaker only if malformed/non-unique position data reaches the service. Future LEARNED items are excluded from SRS cards but contribute to nearest-future-due metadata. NORMAL returns all cards unchanged in Set position order.

### 5.5 Legacy Normalization

Implement the approved deterministic mapping:

- stored `LEARNING` -> eligible stage 0;
- stored `NEEDS_REVIEW` -> eligible, valid ladder interval retained, otherwise stage 0;
- stored `LEARNED` with valid interval plus timestamp -> future or due at that encoded stage;
- incomplete/non-ladder LEARNED schedule -> eligible, retaining a valid interval stage if present, otherwise stage 0.

Only an explicit accepted rating normalizes persistence. Reads never backfill or mutate.

## 6. Backend Repository, Service, Controller and Route Plan

### 6.1 Repository

Update `backend/src/repositories/learning-repository.js` to:

- add `interval_days` and `next_review_at` to Set-card and `progressSelect()` projections;
- return all existing fields needed for immediate idempotent response reconstruction;
- accept effective-state predicates/timestamp inputs for Progress summary/count/list;
- keep Progress summary/page reads inside the current repeatable-read transaction; and
- preserve Set and Set Item locks, exact membership checks and compare-at-revision updates.

For `GET /api/learning/progress`, build reusable Prisma conditions for effective states:

- `LEARNING`: stored `LEARNING`;
- `NEEDS_REVIEW`: persisted `NEEDS_REVIEW` plus valid scheduled `LEARNED` rows due at/before `evaluated_at`;
- `LEARNED`: stored `LEARNED` excluding derived-due scheduled rows, including legacy compatibility rows under their stored presentation.

Ensure these conditions are shared by summary, filter count and page query so totals cannot disagree.

### 6.2 Learning Service

Update `backend/src/services/learning-service.js` to:

- validate scalar `mode`; default omission to `SRS`, reject repeated/empty/unknown values;
- build mode-specific Set responses and truthful `total_items`, `eligible_count`, `evaluated_at` and nearest due metadata;
- replace exact event field `outcome` with exact `rating` and allowed four values;
- validate the current progress is still eligible before a new rating; reuse `LEARNING_PROGRESS_CHANGED` when an externally changed/current future state invalidates the snapshot;
- check current `last_event_id` before eligibility/revision calculation so immediate retry returns unchanged authoritative scheduling data;
- calculate one transition using the pure scheduler and one acceptance timestamp;
- preserve first-write race handling and current transaction/concurrency strategy; and
- expose exact vocabulary ID, stored/effective state, stage, interval, due time, review time, count and revision.

Do not let the client submit status, stage, interval, timestamps, USER ID, completion or rewards.

### 6.3 Controller and Route

- Update `backend/src/controllers/learning-controller.js` so `getSet` passes `req.query` to the service.
- Preserve controller responsibility as extraction/envelope/error mapping only.
- Keep `backend/src/routes/learning-routes.js` endpoint paths and middleware unchanged.
- Preserve existing USER-only middleware, Guest 401, ADMIN 403 and inaccessible-private-Set 404 behavior.

## 7. Backend API Plan

### 7.1 `GET /api/learning/sets/:setId?mode=SRS|NORMAL`

- Omitted mode and `mode=SRS` return an SRS eligibility snapshot.
- `mode=NORMAL` returns all ordered Set cards.
- Both modes remain authenticated USER-only and mutation-free.
- Empty Set remains `409 LEARNING_SET_EMPTY`.
- Non-empty/no-eligible SRS returns `200` with empty cards, zero eligible count and nullable nearest future due.
- Reject unknown, repeated or empty query values with `400 VALIDATION_ERROR`.

The response validators and API documentation will use a shared base plus explicit mode-specific metadata so the frontend cannot confuse an up-to-date SRS response with a true empty Set.

### 7.2 `POST /api/learning/events`

Exact body:

```json
{
  "event_id": "uuid",
  "set_id": "uuid",
  "vocabulary_id": "uuid",
  "expected_revision": 0,
  "rating": "GOOD"
}
```

- Only `AGAIN`, `HARD`, `GOOD`, `EASY` are accepted.
- Old `outcome`, unknown or extra fields fail validation.
- Authorization, Set access and current membership are rechecked transactionally.
- The response is authoritative and sufficient for frontend queue advancement/requeue.
- Same current event ID returns stored state without recomputation or counter increment; a different stale event returns `409 LEARNING_PROGRESS_CHANGED`.
- The first accepted command wins if a caller reuses the current event ID with altered content; no history/fingerprint field is added.

### 7.3 `GET /api/learning/progress`

Keep existing query fields, pagination envelope and read-only behavior. Add one response-level `evaluated_at` if needed so derived-state output is auditable and deterministic. Items and summary/filter counts must use the same effective-state boundary. Do not add NEW/global availability or a review action.

## 8. Frontend Session and Queue Plan

### 8.1 Versioned State

Refactor `frontend/src/learning/learning-run-state.js` to a versioned dual-mode structure. Reject old v1 two-outcome payloads during reconciliation and create fresh SRS state; keep the Learning-owned key prefix so logout cleanup remains complete.

Store only non-sensitive transient values:

- USER/Set IDs and state version;
- active mode;
- SRS snapshot timestamp and fixed unique snapshot IDs;
- ordered pending presentation queue/current occurrence;
- passed exact IDs and presentation count;
- NORMAL current exact Vocabulary ID; and
- retry context only where already safe/required by the page.

Do not persist card content, auth data or authoritative schedule calculations.

### 8.2 Pure Queue Operations

Implement/test pure helpers for:

- fresh SRS and NORMAL state creation;
- exact-ID reconciliation against current membership without injecting newly due cards;
- selecting/switching modes;
- applying an authoritative passing result;
- applying `AGAIN` by removing any pending duplicate and inserting one occurrence after three intervening presentations when possible, otherwise at tail;
- fixed `completed / initial total` summary;
- SRS restart to a newly fetched snapshot; and
- NORMAL restart/cursor movement.

The frontend uses the submitted rating only to choose pass versus requeue after the backend response; it uses returned progress fields for all persisted state.

### 8.3 Resume, Exit and Conflict

- Reload/return restores a valid fixed snapshot and pending `AGAIN` queue.
- Removed items are dropped; new or newly due items are not injected until SRS restart.
- If local state is absent after an accepted `AGAIN`, a fresh server SRS read includes that immediately-due Vocabulary.
- Switching mode preserves both transient states and never calls a rollback API.
- Conflict/stale membership triggers a fresh authorized read and exact-ID reconciliation; no optimistic completion remains.

## 9. Frontend UI Plan

### 9.1 Page and Service

Update `frontend/src/services/learning-service.js` to:

- send explicit `mode` for page switches/restarts while supporting omitted mode as SRS contract coverage;
- validate mode-specific Set metadata and scheduling projections;
- send `rating` rather than `outcome`; and
- validate authoritative rating/progress and derived Progress-read fields.

Update `frontend/src/learning/learning-foundation-page.jsx` in place. Extract a component only if the four-button action group or mode selector materially improves readability; do not split the card visuals or redesign the page.

### 9.2 Header and Mode Switch

- Add labelled **Ôn tập SRS** / **Ôn tập thường** controls in the Flashcard header.
- Default a new direct entry to SRS.
- Disable mode controls while a rating is pending.
- Switching restores the destination mode's transient state and loads the correct mode payload without altering accepted SRS progress.
- Preserve compact, wrapping/no-overflow behavior at existing desktop/tablet/mobile breakpoints and 44px touch targets.

### 9.3 SRS Mode

- Front: retain recall-first card and existing reveal interaction.
- Back: render native buttons in order **Lại**, **Khó**, **Tốt**, **Dễ** only after reveal.
- Render two-line labels from authoritative per-card `rating_previews`: `AGAIN` = **Trong phiên này**; 1 day = **Ngày mai**; 3 days = **1–3 ngày**; 7 days = **1 tuần+**; 14 days = **2 tuần**; 30 days = **30 ngày**. The UI maps returned interval values to wording but never calculates rating transitions.
- Remove Previous/Next and any skip path in SRS.
- Submit immediately; do not advance/requeue/completion-count until success.
- Render **Đã hoàn thành X / N** using unique fixed snapshot semantics.
- Render up-to-date state for zero eligible cards with NORMAL switch and return-to-Set actions.
- Preserve empty, loading, safe error, conflict, stale item, audio error, retry and completion states.

### 9.4 NORMAL Mode

- Render every card from the NORMAL response in Set position order.
- Preserve **Thẻ trước** / **Thẻ sau** browsing and existing card-face behavior.
- Render no rating controls and never call the event endpoint.
- Display **Thẻ X / N**.
- Restart returns to the first card/front only.

### 9.5 Shared Presentation

Retain `frontend/src/learning/learning-presentation.js` behavior for:

- deterministic primary Meaning;
- Space/click reveal safety;
- stored audio/native TTS and isolated playback errors;
- reduced motion and card flip; and
- responsive card content.

Rename two-outcome pending helpers to rating terminology or replace them with a generic pending-rating helper; remove obsolete outcome constants without changing unrelated presentation behavior.

## 10. Accessibility Plan

- Implement mode controls as a labelled tab/radio-like single-selection control using appropriate native/ARIA selected semantics; use standard keyboard activation only.
- Preserve existing keyboard reveal and speaker isolation.
- After reveal, keep focus on the revealed-answer heading; four native rating buttons follow in predictable DOM order.
- Enter/Space activates only the focused button; pending/disabled semantics prevent duplicate activation.
- After successful rating, focus the next card front/heading; after final pass, focus completion heading.
- Announce returned `AGAIN` cards and progress changes through the existing polite live region.
- On mode switch, focus the destination mode heading/state without flipping or rating a card.
- NORMAL Previous/Next retain labelled native button behavior and visible focus.
- Up-to-date, empty, loading, retryable error, conflict and completion states expose appropriate `status`/`alert` semantics without color-only meaning.
- Re-run reduced-motion, mobile touch target and no-horizontal-overflow checks.

## 11. Learning Progress Compatibility Plan

- Extend `backend/src/repositories/learning-repository.js` and `backend/src/services/learning-service.js` so derived due status is calculated consistently for summary, filters and page items at one timestamp.
- Keep stored `LEARNING` in the Learning bucket even though it is SRS-eligible.
- Treat due learned/persisted review rows as effective `NEEDS_REVIEW` without writing on read.
- Preserve legacy stored-state presentation where specified while making incomplete schedules SRS-eligible.
- Update `frontend/src/services/learning-service.js` response guard if `evaluated_at` or additional schedule fields become part of the Progress response.
- Update `frontend/src/learning-progress/learning-progress-page.jsx` only if needed to consume the synchronized derived-state response; do not add review actions, global NEW counts or redesign.
- Verify Dashboard calls to `GET /api/learning/progress?page=1&page_size=1` continue to receive consistent totals and require no Dashboard behavior change.

## 12. Test Strategy

### 12.1 Unit / Domain Scheduler

Create `backend/test/learning/srs-scheduler.test.js` for pure fixed-clock coverage:

- NEW/stage 0 + HARD/GOOD/EASY;
- assert NEW/stage 0 exactly produces 1/3/7 days for HARD/GOOD/EASY;
- every stable stage + every rating;
- AGAIN reset and immediate due;
- 30-day cap;
- exact accepted timestamp plus 24-hour multiples;
- immediately before/equal/after due boundary;
- stored LEARNING, persisted NEEDS_REVIEW and all legacy incomplete/non-ladder mappings.

No database is needed for this suite.

### 12.2 Backend API / Dedicated TEST DB

Extend `backend/test/learning/learning.test.js` to cover:

- omitted/SRS/NORMAL mode validation and payload shape;
- priority ordering of existing eligible items before NEW;
- fixed snapshot timestamp and nearest future due;
- per-card `rating_previews` use the same scheduler/evaluation timestamp and cover every stage/rating matrix row;
- non-empty/no-eligible versus empty Set;
- NORMAL reads leaving progress byte-for-byte invariant;
- four exact rating payloads and rejection of old/extra fields;
- transactionally persisted scheduler fields;
- current membership, USER isolation, public/owned-private access and non-owner concealment;
- immediate retry, altered same event first-wins response, stale revision and concurrent first events;
- progress summary/filter/list derived due consistency;
- canonical/private same spelling with distinct UUID schedules;
- shared exact vocabulary across Sets and membership removal preserving progress; and
- cleanup of all fixtures from the dedicated TEST database.

Run the dedicated preparation and Learning suite, then the full backend integration suite sequentially.

### 12.3 Frontend Unit Tests

Update:

- `frontend/test/learning-run-state.test.js` — version rejection, snapshot reconciliation, queue distances of 0–3+ intervening presentations, repeated AGAIN deduplication, fixed denominator, pass completion, exit/resume, restart and mode isolation.
- `frontend/test/learning-service.test.js` — query serialization/default contract, mode-specific response and `rating_previews` validation, four-rating request and authoritative response validation, malformed/error mapping.
- `frontend/test/learning-presentation.test.js` — retain flip/pronunciation behavior and adapt pending-rating helpers.
- Focused UI tests assert all six approved preview wordings, including `AGAIN` with no fake future interval, and accessible two-line button naming.

Run the full frontend Node unit suite, not only new files.

### 12.4 Focused Mocked Playwright

Add or extend a focused spec under `frontend/e2e/auth/` (planned new file: `frontend/e2e/auth/learning-srs.spec.js`) using the existing default mocked-browser harness for:

- default SRS and accessible mode selection;
- rating buttons only after reveal and no SRS Previous/Next/skip;
- keyboard reveal, rating activation and focus advancement;
- NORMAL all-card navigation and zero event requests;
- pending/error/retry/conflict behavior without optimistic advancement;
- up-to-date versus empty state;
- fixed progress under AGAIN requeue;
- desktop/tablet/mobile no-overflow and reduced-motion behavior.

Avoid duplicating real database assertions in mocked tests.

### 12.5 Dedicated Real-Stack Playwright

Update `frontend/e2e/integration/learning-real-stack.spec.js` and reuse `frontend/playwright.learning.config.js` for guarded TEST-database flows:

- persisted NEW rating transitions and each representative stable-stage transition;
- AGAIN, exit/reload/resume, reappearance and later pass;
- repeated AGAIN without simultaneous duplicate occurrence;
- mode switching without rollback;
- NORMAL all-card traversal with database progress invariance;
- empty SRS/up-to-date behavior;
- exact identity for canonical/private same-spelling Vocabulary;
- membership removal preserving progress;
- Guest/ADMIN/non-owner boundaries; and
- fixture/process/listener cleanup.

Run the Learning Progress real-stack suite and relevant Set Detail, Dashboard, Quiz and Authentication regressions because they consume Learning progress, Learning routes or Set entry points.

### 12.6 Quality Gates

After implementation:

- backend targeted unit/integration and full integration suites;
- frontend unit suite;
- focused mocked Playwright;
- dedicated Learning and Learning Progress real-stack suites;
- scoped Set Detail/Dashboard/Quiz/Auth regressions;
- frontend ESLint and production build;
- Prisma validation/migration-status verification without creating an unnecessary migration;
- diff, secret, scope and TEST fixture cleanup checks.

Any command not run must be reported as `NOT RUN`; no feature status moves beyond its verified workflow stage prematurely.

## 13. Documentation Plan

During implementation, synchronize only confirmed changes:

- `docs/DATABASE.md` — active interval/stage encoding, derived due semantics and no-migration/no-history boundary.
- `docs/API_SPEC.md` — dual-mode GET, authoritative `rating_previews`, four-rating POST, authoritative response and effective Progress reads.
- `docs/UI_UX_SPEC.md` — synchronize the approved two-line rating wording and up-to-date-state presentation after implementation verification.
- `docs/UI_UX_SPEC.md` — dual-mode header/action/session/accessibility contract.
- `docs/FLASHCARD_LEARNING_V1_UI_UX_CHECKPOINT.md` — amend only the affected action/header/state diagrams; preserve card visual contract.
- `docs/FEATURE_STATUS.md` — move through `IN_PROGRESS`, `IMPLEMENTED`, `TESTED`, `DONE` only when each later gate is actually satisfied and HUMAN-approved.

`docs/PROJECT_OVERVIEW.md` and `docs/ARCHITECTURE.md` require changes only if implementation reveals a real scope/architecture delta; none is planned.

## 14. Implementation Order and Checkpoints

1. **Contract baseline checkpoint:** record approved API/data/UI deltas and protect existing regression expectations; no status beyond PLANNED until implementation starts.
2. **Scheduler domain:** add pure scheduler plus exhaustive fixed-clock unit tests.
3. **Persistence/repository:** expose scheduling fields and implement effective-state query predicates; verify no migration is required.
4. **Backend service/API:** inject clock, add modes, eligibility/order, four-rating transactions and authoritative responses; update controller query pass-through.
5. **Backend checkpoint:** run scheduler and guarded Learning API/Progress tests, including auth, concurrency and NORMAL invariance.
6. **Frontend service/state:** update response guards and implement versioned dual-mode SRS queue/NORMAL cursor helpers with unit tests.
7. **Frontend UI:** add accessible mode switch, SRS four-rating flow, NORMAL navigation, progress, empty/up-to-date/restart/failure states while preserving shared card presentation.
8. **Frontend checkpoint:** run unit, lint, build and focused mocked Playwright across responsive/accessibility states.
9. **Real-stack integration:** update fixtures and execute dedicated Learning/Learning Progress scenarios and scoped consumers/regressions.
10. **Documentation synchronization:** update active database/API/UI/checkpoint documents to verified behavior.
11. **Formal TEST and REVIEW:** use the project test/review skills, resolve findings, obtain HUMAN approval, then update final feature status. TASK decomposition must occur before implementation and only after this PLAN is approved.

## 15. Expected File Changes

### 15.1 Expected Existing Files

- `backend/src/create-app.js`
- `backend/src/services/learning-service.js`
- `backend/src/repositories/learning-repository.js`
- `backend/src/controllers/learning-controller.js`
- `backend/test/learning/learning.test.js`
- `frontend/src/services/learning-service.js`
- `frontend/src/learning/learning-run-state.js`
- `frontend/src/learning/learning-presentation.js`
- `frontend/src/learning/learning-foundation-page.jsx`
- `frontend/src/learning-progress/learning-progress-page.jsx` only if response consumption requires it
- `frontend/test/learning-service.test.js`
- `frontend/test/learning-run-state.test.js`
- `frontend/test/learning-presentation.test.js`
- `frontend/e2e/integration/learning-real-stack.spec.js`
- `docs/DATABASE.md`
- `docs/API_SPEC.md`
- `docs/UI_UX_SPEC.md`
- `docs/FLASHCARD_LEARNING_V1_UI_UX_CHECKPOINT.md`
- `docs/FEATURE_STATUS.md`

### 15.2 Expected New Files

- `backend/src/services/srs-scheduler.js`
- `backend/test/learning/srs-scheduler.test.js`
- `frontend/e2e/auth/learning-srs.spec.js`

### 15.3 Files Not Expected to Change

- `backend/prisma/schema.prisma`
- existing Prisma migrations or a new migration
- `backend/src/routes/learning-routes.js`
- authentication/role middleware
- Vocabulary/Vocabulary Set schema and ownership services
- Quiz, pronunciation or gamification source modules
- dependency manifests/lockfiles

If implementation proves any item in this section wrong, revise/approve the PLAN before expanding scope.

## 16. Risks and Compatibility Considerations

- **Active contract replacement:** existing tests and clients use `outcome: REMEMBERED/STUDY_AGAIN`; backend and frontend must switch atomically within the feature change, and old payloads intentionally become validation errors.
- **Effective-state query consistency:** summary, filter count and list page can diverge if they use different timestamps or predicates; capture one clock value and share predicate builders.
- **Legacy ambiguity:** null/non-ladder scheduling values must be normalized in service logic, not rejected or bulk rewritten.
- **Idempotency boundary:** `last_event_id` stores no request fingerprint. V1 deliberately retains first-wins immediate-current-event semantics; it cannot prove an altered retry payload matched the original rating.
- **No server session:** fixed snapshot and AGAIN queue resume depend on validated same-tab state. Lost state safely creates a fresh due snapshot, but cross-device resume is intentionally unavailable.
- **Frontend state migration:** current v1 sessionStorage contains two outcomes and must fail closed; attempting to reinterpret it could create false completion.
- **SRS eligibility enforcement:** reject a currently future-due item using the existing progress-changed conflict boundary; idempotent retry must be checked first.
- **NORMAL invariance:** current Flashcard always assesses progress; the new NORMAL path needs explicit network and database invariance tests to prevent accidental event calls.
- **Progress consumers:** Dashboard and Learning Progress tests may change when learned rows become due-derived NEEDS_REVIEW; seed timestamps must be explicit rather than relying on wall-clock timing.
- **Responsive density:** four ratings plus two mode controls increase action density; use wrapping/grid behavior without changing the approved card visual hierarchy.
- **Test clock:** app-level optional injection must not become a production-configurable user clock or leak into API input.

## 17. Non-Goals / Deferred

- FSRS, SM-2 or adaptive ease/stability/difficulty.
- Review/lapse history, analytics or arbitrary historical replay.
- Undo or change-rating-after-submit.
- Custom/per-user intervals.
- Daily new-word/review limits, bury, suspend or leech behavior.
- Global/cross-Set Words to Review UI.
- Persistent server session or cross-device/offline resume.
- XP, Streak, Daily Goal, Achievement or other gamification.
- Pronunciation Practice expansion.
- Quiz-to-SRS integration.
- Notifications, reminders, external services or broad Flashcard redesign.

## 18. SPEC Conflict Check

No blocking conflict was found. Current implementation/documentation still encode the superseded one-mode/two-outcome contract, but the approved SPEC explicitly authorizes replacing that contract. The existing schema supports the approved V1 scheduler without a migration.

## 19. Open Questions

None. HUMAN approved this PLAN for TASK decomposition. Implementation remains unauthorized until the resulting TASK document is HUMAN approved.
