# PLAN: XP & Level V1

**Feature status:** `TODO`

**SPEC:** `docs/specs/XP_LEVEL_V1_SPEC.md` — HUMAN APPROVED in the 2026-10-16 PLAN authorization

**Baseline:** `dev` at `5a6699a87d26a5ac0f77b7ce9165769b8be2e6fc`

**Implementation authorized:** `NO`

## 1. Summary

XP & Level V1 will extend the existing USER-only SRS and Multiple Choice Quiz transactions with one shared, append-only positive-reward persistence boundary. A successful qualifying transaction will mutate Progress, insert exactly one deduplication record, atomically increment `USER.total_xp`, and return one backend-authoritative reward/Level projection. Level remains derived from the approved 1–15 threshold table.

The implementation will reuse the existing Learning and Quiz routes, controllers, optimistic Progress revision checks, immediate-current-event replay behavior, role middleware, Dashboard data loading, and frontend design tokens. It will add no public reward-write endpoint, persisted Level, XP history, new dependency, new role, new Quiz type, SRS scheduling change, or Daily Goal behavior.

For Dashboard reads, the smallest compatible contract is an additive `xp_level` projection in the existing USER-only `GET /api/learning/progress` response. Dashboard already requests that resource, its loading/error/retry behavior is established, and ADMIN already avoids it. Extending `/api/auth/me` would couple learner gamification to session restoration for both roles and would not provide an independently retryable Dashboard source; a new endpoint would add an unnecessary request and route.

## 2. Scope and Affected Areas

### Required changes

- **Database:** one `XP_REWARD` model/table, one reward-type enum, foreign keys, unique identities, checks, indexes, and a guarded nonnegative `USER.total_xp` check.
- **Backend domain:** shared reward eligibility/identity and Level/projection functions.
- **Backend persistence:** transaction-local reward lookup/insertion, USER XP read/increment, and relation projections reusable by Learning and Quiz repositories.
- **SRS:** extend only the accepted event transaction and response; preserve request, scheduling, queue, and conflict semantics.
- **Quiz:** extend only the authoritative answer transaction and response; preserve question generation, grading, request, and conflict semantics.
- **API:** additive `reward` fields on two mutation responses and additive `xp_level` on the Learning Progress read response.
- **Frontend:** validate/consume the additive projections, render compact USER Dashboard XP/Level content, and optionally announce newly committed XP in existing feedback regions.
- **Tests:** pure domain tests, focused service/API tests, guarded database integration/concurrency/migration tests, frontend state/component tests, and proportional real-stack regression.
- **Documentation after verified implementation:** synchronize `PROJECT_OVERVIEW.md`, `DATABASE.md`, `API_SPEC.md`, `UI_UX_SPEC.md`, and eventually `FEATURE_STATUS.md` through the later TEST/REVIEW/approval workflow.

### Explicit exclusions

- Streak, Daily Goal or bonus, Achievement, leaderboard, ranking, XP history, reward management, reversal, spending, expiration, or manual/admin adjustment.
- XP for Speaking, NORMAL Flashcard, reference audio, navigation, page views, session completion, or non-authoritative client activity.
- Persisted Level, a second XP balance, Quiz Session/Attempt history, general event ledger, or arbitrary historical replay.
- ADMIN Dashboard changes, new roles, new dependencies, external services, SRS algorithm changes, additional Quiz types, or unrelated refactoring.

## 3. Existing Code to Reuse and Exact Integration Points

| Existing path/module | Reuse or extension |
|---|---|
| `backend/prisma/schema.prisma` | Retain `USER.total_xp`, exact USER/Vocabulary UUIDs, and `LEARNING_PROGRESS` uniqueness/revision fields; add reward relations only. |
| `backend/prisma/migrations/*/migration.sql` | Follow forward-only PostgreSQL DDL, explicit constraint naming, and restrictive FK conventions. |
| `backend/src/services/srs-scheduler.js` | Reuse `evaluateProgress` and the accepted backend time to classify complete scheduled/due versus legacy/unscheduled state; do not change scheduling. |
| `backend/src/services/learning-service.js::recordMeaningfulEvent` | Extend the current locked Set/item, replay-first, expected-revision, transition, and transaction flow. |
| `backend/src/repositories/learning-repository.js` | Keep transaction factory, Set locks, Progress CAS and latest-state queries; compose shared reward/XP data access into the same Prisma transaction client. |
| `backend/src/services/quiz-service.js::recordAnswer` | Extend the current transactionally reconstructed, backend-graded answer flow after correctness and pre-event Progress are known. |
| `backend/src/repositories/quiz-repository.js` | Keep question locks, deterministic source reads, Progress CAS and transaction factory; compose the same reward/XP data access. |
| `backend/src/routes/learning-routes.js`, `quiz-routes.js` | Reuse authentication plus USER authorization; add no reward-write route. |
| `backend/src/controllers/learning-controller.js`, `quiz-controller.js` | Preserve status/error envelopes; service return values carry additive success projections. |
| `backend/src/create-app.js` | Wire shared XP/Level collaborators into Learning and Quiz without changing route authorization. |
| `frontend/src/services/learning-service.js` | Validate additive mutation `reward` and Progress-read `xp_level` projections. |
| `frontend/src/services/quiz-service.js` | Validate additive answer `reward` projection without changing the request body. |
| `frontend/src/learning/learning-foundation-page.jsx` | Consume committed reward feedback in the existing live announcement; strip reward data before durable learning-session state is stored. |
| `frontend/src/quiz/quiz-foundation-page.jsx` and `quiz-run-state.js` | Use the immediate response for concise feedback; retain the existing accepted-result whitelist so reward/celebration state is not stored in session storage. |
| `frontend/src/dashboard/dashboard-page.jsx` | Reuse its USER-only Learning Progress source, section loading/error/retry/focus patterns, and responsive Tailwind/token conventions. |
| Existing Learning, Quiz, Dashboard, Auth and real-stack tests | Extend focused fixtures and expectations; retain current conflict, authorization, scheduling and grading regression coverage. |

## 4. Architecture and Shared Business Logic

### 4.1 Proposed backend modules

- Add `backend/src/services/xp-level-service.js` as a dependency-free business module containing:
  - the immutable approved Level thresholds;
  - strict nonnegative-integer input validation;
  - Level 1–15/MAX derivation;
  - the reusable authoritative XP/Level projection;
  - pure SRS and Quiz reward-candidate derivation from trusted pre-event state;
  - reward response construction from a committed/replayed event.
- Add `backend/src/repositories/xp-reward-repository.js` as shared Prisma data access containing:
  - reward lookup by `(user_id, source_event_id)` for immediate replay;
  - reward existence/lookup by composite reward identity;
  - positive reward insertion;
  - USER `total_xp` read;
  - atomic `total_xp: { increment: amount }` returning the new balance.
- Compose that repository into both Learning and Quiz transaction-scoped repository factories. No nested transaction and no second Prisma client may be used for reward work.

The service layer decides eligibility and amount; the repository only reads/writes exact identities. Controllers remain transport-only. Level is always recomputed from the committed authoritative balance and never stored.

### 4.2 Reward eligibility matrix

| Source/pre-event state | Candidate | Cycle | XP |
|---|---|---:|---:|
| SRS `AGAIN`, no initial reward | none | — | 0 |
| First accepted SRS `HARD`/`GOOD`/`EASY`, no initial reward | `SRS_INITIAL` | 0 | 3 |
| Any SRS pass after `SRS_INITIAL` exists but not a genuine due cycle | none | — | 0 |
| Stored `LEARNED`, supported interval, non-null due time at/before accepted time, `SRS_INITIAL` exists | `SRS_DUE_REVIEW` | pre-event revision | 1 |
| Due state above with `AGAIN` | `SRS_DUE_REVIEW`, then scheduler writes immediate `LEARNING` | pre-event revision | 1 |
| Immediate `LEARNING` requeue or incomplete/legacy-unscheduled state | initial pass only if still unearned; never due reward | 0 or — | 3 or 0 |
| First correct authoritative Quiz answer without Quiz reward | `QUIZ_FIRST_CORRECT` | 0 | 3 |
| Incorrect Quiz or later correct Quiz | none | — | 0 |

Due-review classification must use the same pre-event Progress row and accepted time used for revision validation. It requires exact USER/Vocabulary identity, an existing `SRS_INITIAL`, stored `LEARNED`, a supported ladder interval, non-null `next_review_at`, and `next_review_at <= accepted_at`. Revision alone is never treated as eligibility.

### 4.3 Future extensibility boundary

The reward type is an enum and shared insertion/projection logic accepts only server-derived candidates. A future Daily Goal feature may add an approved reward type and identity later, but V1 will not add generic client-driven reward input, daily tables, placeholder columns, or unused abstractions.

## 5. Database and Migration Plan

### 5.1 Prisma model

Add `XP_REWARD` with:

- `id UUID` primary key with generated UUID;
- `user_id UUID` required;
- `vocabulary_id UUID` required;
- `reward_type XP_REWARD_TYPE` required with exactly `SRS_INITIAL`, `QUIZ_FIRST_CORRECT`, `SRS_DUE_REVIEW`;
- `reward_cycle INTEGER` required;
- `source_event_id UUID` required;
- `xp_amount INTEGER` required;
- `created_at TIMESTAMP(3)` required, default current time;
- required relations to USER and Vocabulary, both `onDelete: Restrict`, `onUpdate: Cascade`;
- reverse relation arrays on USER and Vocabulary.

Do not add `updated_at`: reward rows are append-only. Do not add a Level column or Set relationship.

### 5.2 Database identities, checks and indexes

- Unique `(user_id, vocabulary_id, reward_type, reward_cycle)` prevents duplicate initial, Quiz and due-cycle rewards across Sets/runs/events.
- Unique `(user_id, source_event_id)` prevents a positive event identity from being rewarded twice.
- Check `xp_amount > 0` enforces positive-only storage.
- Check `reward_cycle >= 0`.
- Cross-field check:
  - `SRS_INITIAL` and `QUIZ_FIRST_CORRECT` require cycle `0` and amount `3`;
  - `SRS_DUE_REVIEW` requires cycle `> 0` and amount `1`.
- Add an index beginning with `vocabulary_id` to support restrictive deletion checks and exact Vocabulary investigation. The two unique indexes already cover USER-first reward/event lookups; do not add redundant USER-only or timestamp indexes without measured need.
- Both foreign keys use `ON DELETE RESTRICT`. Removing Set membership or deleting a Set has no relation to reward rows.

### 5.3 Guarded nonnegative-XP preflight

The single forward-only migration must begin with a read-only PostgreSQL guard that checks whether any `USER.total_xp < 0` exists. A procedural guard may perform `IF EXISTS (SELECT 1 ...) THEN RAISE EXCEPTION` before any XP/Level DDL. Only when the query finds no negative balance may the migration add the named `CHECK (total_xp >= 0)` constraint and reward schema.

The guard must:

- report failure without listing user identity or rewriting values;
- run before the new constraint and reward DDL;
- rely on migration transaction rollback if any later statement fails;
- never clamp, reset, backfill or otherwise repair balances;
- stop deployment/migration for HUMAN review on failure.

Migration tests later prove both a clean target and a controlled negative fixture. No preflight or migration command is run during PLAN.

### 5.4 Migration invariants

- No reward rows are created from existing Progress.
- Every pre-existing `total_xp` value is preserved byte-for-byte/numerically.
- No Vocabulary, Set, Progress, session or ownership row is rewritten.
- Existing authorized deletion behavior remains: unreferenced canonical Vocabulary can be deleted; durable Progress/reward references restrict deletion; private hard deletion and account deletion are not introduced.

## 6. Transaction, Idempotency and Concurrency Design

### 6.1 Common transaction algorithm

For each accepted SRS/Quiz command, inside the existing transaction:

1. Reauthorize USER Set access and exact current Vocabulary membership.
2. Preserve the activity-specific locks/reconstruction.
3. Read the current Progress.
4. If `last_event_id` equals the command event:
   - preserve the existing compatibility checks;
   - look up a positive reward by `(user_id, source_event_id)`;
   - set original `xp_earned` to its stored amount, or `0` when no row exists;
   - read current `USER.total_xp`, derive Level, and return `replayed: true` without mutation.
5. Validate `expected_revision` and activity eligibility against current pre-event state.
6. Derive the activity transition and optional reward candidate from trusted data.
7. Create/update Progress through the existing create/CAS path.
8. Insert the positive reward candidate, if any.
9. Increment `USER.total_xp` atomically only after a new reward insert and by exactly the stored amount.
10. Read/use the returned current balance, derive Level, and return `replayed: false`.

Any Progress CAS loss, reward uniqueness collision, missing USER, or XP update failure rolls back Progress, reward, and XP. A positive reward uniqueness collision from a non-replay request is mapped to the endpoint's existing safe Progress conflict family (`LEARNING_PROGRESS_CHANGED` or `QUIZ_PROGRESS_CONFLICT`) rather than exposing database details. Same-event races that resolve to the newly current event return the replay projection after confirming request compatibility.

Atomic Prisma numeric increment prevents lost updates when different Vocabulary rewards commit concurrently. Database uniqueness, not frontend state or a prior application read alone, is the final anti-farming boundary.

### 6.2 Replay boundary

Only immediate replay of the current `last_event_id` is promised. The reward row supplies the original positive `xp_earned`; absence of such a row means the original event earned zero. Current `total_xp` and Level are returned, so they may be newer than the original response. Arbitrary historical response replay remains unsupported.

## 7. SRS Integration Plan

### Exact integration

Extend `learning-service.js::recordMeaningfulEvent` and the transaction-scoped Learning repository. Preserve request validation, Set/item locks, `evaluateProgress`, `calculateRatingTransition`, Progress create/CAS, retry reconciliation, accepted time, and error codes.

### Technical behavior

- Capture the pre-event Progress and evaluation before applying the scheduler transition.
- Check `SRS_INITIAL` existence for exact USER/Vocabulary.
- If absent, only `HARD`/`GOOD`/`EASY` propose the cycle-0 +3 reward; `AGAIN` remains zero and preserves eligibility.
- Only when initial reward already exists may the complete due snapshot propose cycle=`preEvent.revision`, +1, including `AGAIN`.
- Legacy stored `NEEDS_REVIEW` and incomplete/unscheduled `LEARNED` rows cannot earn due XP. Without an initial reward, their first later SRS pass earns +3 and establishes the schedule; earlier `AGAIN` earns zero.
- Quiz-created unscheduled Progress follows the same rule.
- A due `AGAIN` earns once, then existing scheduling writes immediate `LEARNING`; later same-session requeues fail the stored-`LEARNED` due predicate.
- Alternate Sets cannot change identity because neither Set ID nor session/run ID enters the reward key.
- Return the existing authoritative Progress fields plus `reward`; do not change the event request.

### Regression boundary

No modification to interval ladder, effective-state calculation, accepted timestamp ownership, SRS queue ordering, retry event generation, NORMAL mode, or Learning Session batch behavior.

## 8. Quiz Integration Plan

### Exact integration

Extend `quiz-service.js::recordAnswer` and the transaction-scoped Quiz repository after authoritative question reconstruction and grading. Preserve request validation, opaque choice identity, question revision, Set/item/Meaning locks, Progress status semantics, and existing error codes.

### Technical behavior

- Incorrect accepted answers mutate Progress exactly as today, create no reward, and return `xp_earned: 0`.
- A correct accepted answer proposes `QUIZ_FIRST_CORRECT`, cycle 0, +3 only when absent for exact USER/Vocabulary.
- SRS reward existence is irrelevant to Quiz eligibility; Quiz reward existence is irrelevant to initial SRS eligibility.
- Fresh `run_id`, different Sets, repeated correct answers, and new valid event IDs cannot bypass composite uniqueness.
- Same-headword private Vocabulary remains independent because keys use exact UUID.
- Quiz continues to mutate shared Progress revision/status but does not construct SRS scheduling fields. Such mutation can change the revision used by a later genuine SRS due event but cannot itself award/consume due-review XP.
- Return existing answer/progress fields plus `reward`; do not change the answer request or add Quiz types/history.

## 9. API Contract Plan

### 9.1 `POST /api/learning/events`

- **Auth:** existing authenticated USER middleware.
- **Request:** unchanged.
- **Success:** existing Progress projection plus required `reward` object.
- **Errors:** preserve `400 VALIDATION_ERROR`, concealed Set/item errors, and `409 LEARNING_PROGRESS_CHANGED`; reward persistence failures expose no constraint detail.

### 9.2 `POST /api/quiz/answers`

- **Auth:** existing authenticated USER middleware.
- **Request:** unchanged.
- **Success:** existing Quiz answer/Progress projection plus required `reward` object.
- **Errors:** preserve current validation, Set/item/question/choice/retry/Progress conflict contracts.

### 9.3 Shared mutation reward projection

Every accepted response, including zero-XP events, contains:

- `source_event_id` — validated request event UUID;
- `xp_earned` — `0`, `1`, or `3`;
- `replayed` — false on original acceptance, true only for compatible immediate replay;
- `total_xp` — current committed authoritative balance;
- `level`, `level_min_xp`, `next_level_xp`, `is_max_level` — backend-derived.

No reward row ID/type/cycle is exposed. Conflict/error responses contain no success reward object.

### 9.4 Dashboard read projection choice

Extend `GET /api/learning/progress` data with:

- `xp_level.total_xp`;
- `xp_level.level`;
- `xp_level.level_min_xp`;
- `xp_level.next_level_xp`;
- `xp_level.is_max_level`.

Read it inside the existing repeatable-read Learning Progress transaction so the response uses one consistent USER snapshot. The endpoint remains authenticated USER-only; ADMIN's neutral Dashboard makes no call. This is additive, retains all query/pagination semantics, and avoids both a new request and role-dependent changes to `/api/auth/me`.

Update `docs/API_SPEC.md` later with all three additive contracts after implementation is verified.

## 10. Frontend and UX Plan

### 10.1 Service validation

- Add one shared frontend validator for the exact XP/Level projection shape and mutation reward wrapper, reused by Learning and Quiz services where practical without introducing a framework.
- Reject negative/non-integer totals, out-of-range Level, inconsistent MAX/null-next-level combinations, unsupported `xp_earned`, malformed source event IDs, or non-boolean replay values as invalid backend responses.
- Keep authoritative threshold/eligibility calculation out of frontend code. Frontend may compute only bounded visual percentage from backend `level_min_xp`, `next_level_xp`, and `total_xp`.

### 10.2 USER Dashboard

- Add an XP/Level summary within the existing USER Dashboard composition and existing Learning Progress source.
- Show current Level, total XP, and a compact progress bar/value toward `next_level_xp`.
- At Level 15 show `Level 15 — MAX`, omit a next target, and render a complete/max state without implying XP stops.
- Treat total XP `0` as normal successful data, not an empty/error condition.
- Reuse `DashboardSection` loading/error/retry/focus behavior. The XP block loads and retries with Learning Progress because both share one response.
- Use semantic text plus a native/ARIA progress role with accessible label/value semantics; do not rely on color alone.
- Use current Tailwind utilities and ELVocab tokens. Extend `dashboard-page.css` only if an existing scoped visual primitive cannot express the approved layout; add no new stylesheet or dependency.
- Preserve mobile single-column behavior, reduced motion, keyboard focus, and current ADMIN early return unchanged.

### 10.3 Optional concise mutation feedback

- Reuse existing SRS live announcements and Quiz answer feedback rather than adding toast infrastructure, animations, counters, or a global XP store.
- Announce/display `+N XP` only when `xp_earned > 0 && replayed === false`.
- Do not celebrate zero-XP or replay responses.
- Keep reward feedback transient. For SRS, remove/separate `reward` before passing Progress into persisted learning run state. Quiz run state already whitelists accepted result fields; retain that boundary and do not persist reward feedback.
- If focused UI review finds that inline Quiz feedback adds disproportionate complexity, omit the optional visible embellishment while retaining service validation and API behavior; AC-13 remains satisfied because no celebration is replayed.

UI-changing implementation must receive Focused UI/UX Review before HUMAN visual approval, per `AGENTS.md`.

## 11. Validation and Authorization

- Existing authentication and USER role middleware remain the backend boundary for both mutation routes and the selected read projection.
- ADMIN cannot reach Learning/Quiz USER routes and receives no XP data through the unchanged neutral Dashboard.
- Client requests cannot supply XP amount, reward type/cycle, total, Level, threshold, or reward owner.
- Repository operations always scope reward and USER balance reads/writes to authenticated `req.user.id` passed by the service.
- Exact Vocabulary UUID is derived from the already-authorized Set item and validated request; spelling never participates.
- Shared Level logic accepts only safe nonnegative integers. Invalid internal values fail safely rather than being clamped.
- Database checks and enums independently enforce the persisted reward domain.

## 12. Implementation Phases

### Phase 1 — Database contract and migration

1. **Objective:** establish durable positive reward identity and nonnegative XP constraints without data conversion.
2. **Likely files:** `backend/prisma/schema.prisma`; new `backend/prisma/migrations/<timestamp>_add_xp_level_v1/migration.sql`; focused migration/schema tests under `backend/test/xp-level/`.
3. **Prerequisites:** approved SPEC/PLAN; HUMAN database review gate before any migration execution.
4. **Approach:** add enum/model/relations, exact constraints/indexes/FKs, read-only negative-balance guard, and no-backfill DDL.
5. **Verification:** static migration review first; later guarded isolated TEST migration apply/parity, clean/negative preflight cases, constraint/FK/retention assertions, preserved balances and zero reward rows.
6. **Risks/rollback:** negative legacy balance stops migration; incorrect DDL blocks deployment. Keep one forward-only transactional migration and never repair data automatically. Rollback before release is code/migration correction on isolated TEST, not destructive target reset.
7. **Completion:** schema and migration match approved identity/retention rules and guarded migration evidence passes.

**HUMAN Gate 1:** approve exact migration, constraints, preflight, and retention evidence before broader transaction integration proceeds.

### Phase 2 — Shared XP/Level domain and persistence

1. **Objective:** create one authoritative Level/reward implementation reusable by both activities.
2. **Likely files:** new `backend/src/services/xp-level-service.js`; new `backend/src/repositories/xp-reward-repository.js`; `backend/src/create-app.js`; new pure tests such as `backend/test/xp-level/xp-level-service.test.js`.
3. **Prerequisites:** Phase 1 model/constraint contract fixed.
4. **Approach:** implement pure thresholds/projections/candidate derivation and transaction-client reward/XP operations; inject/compose without nested transactions.
5. **Verification:** DB-independent threshold and eligibility matrices; repository tests later in guarded TEST DB.
6. **Risks/rollback:** duplicated eligibility or threshold tables. Enforce one backend module and no frontend copy.
7. **Completion:** all Level boundaries and pure candidate cases pass; both transaction repositories can reuse one persistence implementation.

### Phase 3 — SRS atomic reward integration

1. **Objective:** award initial/due SRS XP without changing scheduler or request semantics.
2. **Likely files:** `backend/src/services/learning-service.js`; `backend/src/repositories/learning-repository.js`; `backend/src/create-app.js`; focused existing/new Learning and XP integration tests.
3. **Prerequisites:** Phases 1–2; exact replay projection available.
4. **Approach:** derive from pre-event state, execute Progress/reward/increment atomically, handle replay and uniqueness/CAS races, return additive reward.
5. **Verification:** pure/service tests, then guarded integration for initial AGAIN/pass, legacy/unscheduled, due pass/AGAIN, immediate requeue, stale/replay/concurrency/rollback/multi-Set cases.
6. **Risks/rollback:** accidental scheduler change, double reward after due AGAIN, or partial commit. Keep scheduler untouched and inject controlled repository failures to prove rollback.
7. **Completion:** complete SRS matrix and current SRS regression suite pass in approved environments.

**HUMAN Gate 2:** review SRS transaction diff and concurrency/rollback evidence before Quiz integration is accepted.

### Phase 4 — Quiz atomic reward integration

1. **Objective:** add independent first-correct Quiz XP without changing grading.
2. **Likely files:** `backend/src/services/quiz-service.js`; `backend/src/repositories/quiz-repository.js`; focused Quiz/XP tests.
3. **Prerequisites:** shared domain/repository and proven transaction pattern from Phases 2–3.
4. **Approach:** derive candidate only after authoritative grading; atomically mutate Progress/reward/XP; resolve compatible replay from reward row; preserve conflicts.
5. **Verification:** incorrect/first correct/later correct, fresh run, alternate Set, Quiz-before-SRS, SRS-before-Quiz, same-headword distinct IDs, stale/replay/concurrency/rollback, and grading regression.
6. **Risks/rollback:** reward code influencing correct answer or exposing it early. Keep reward derivation strictly downstream of existing grading and preserve response timing.
7. **Completion:** Quiz reward matrix and authoritative Quiz regressions pass.

**HUMAN Gate 3:** approve both activity transaction behaviors and anti-farming evidence before freezing API integration.

### Phase 5 — API and Dashboard read projection

1. **Objective:** finalize additive response contracts and one efficient USER read path.
2. **Likely files:** Learning/Quiz services/controllers only if envelope adaptation is needed; `backend/src/services/learning-service.js`; `backend/src/repositories/learning-repository.js`; `frontend/src/services/learning-service.js`; `frontend/src/services/quiz-service.js`; service/API tests; later `docs/API_SPEC.md`.
3. **Prerequisites:** committed transaction result shape from Phases 3–4.
4. **Approach:** validate exact reward fields; add `xp_level` to repeatable-read Progress response; preserve requests/status/errors.
5. **Verification:** API shape, replay-current-total semantics, invalid response handling, USER isolation, Guest/ADMIN rejection, and no internal reward fields.
6. **Risks/rollback:** breaking strict frontend validators or adding inconsistent projections. Use one projection builder and additive validation updates.
7. **Completion:** mutation and read contracts are consistent across backend, frontend and API documentation.

**HUMAN Gate 4:** approve final API shapes and replay semantics before UI completion.

### Phase 6 — USER Dashboard and transient feedback

1. **Objective:** present authoritative XP/Level accessibly without changing ADMIN or persisting celebrations.
2. **Likely files:** `frontend/src/dashboard/dashboard-page.jsx`; `frontend/src/dashboard/dashboard-page.css` only if necessary; `frontend/src/learning/learning-foundation-page.jsx`; `frontend/src/quiz/quiz-foundation-page.jsx`; focused frontend tests and Dashboard browser specs; later `docs/UI_UX_SPEC.md`.
3. **Prerequisites:** Phase 5 stable service contracts.
4. **Approach:** render compact summary from `progress.data.xp_level`; calculate display width only; MAX state; use existing loading/error/focus patterns; transient positive non-replay announcements.
5. **Verification:** unit/component tests plus focused browser checks at approved responsive widths, keyboard/focus, accessible progress semantics, reduced motion, retry, USER success/zero/MAX/error, ADMIN zero-call, and no persisted reward feedback.
6. **Risks/rollback:** visual crowding or duplicate celebration after reload/replay. Keep compact composition, no animation/global store, and strip reward from persisted state.
7. **Completion:** focused UI/UX review passes and HUMAN accepts Dashboard visuals.

**HUMAN Gate 5:** Focused UI/UX review followed by HUMAN visual approval.

### Phase 7 — Integrated regression, documentation and closure evidence

1. **Objective:** prove full contract without broad unrelated changes and synchronize sources of truth.
2. **Likely files:** focused backend/frontend/real-stack tests; `docs/PROJECT_OVERVIEW.md`, `docs/DATABASE.md`, `docs/API_SPEC.md`, `docs/UI_UX_SPEC.md`; `docs/FEATURE_STATUS.md` only after TEST + REVIEW + HUMAN approval.
3. **Prerequisites:** Phases 1–6 complete and reviewed.
4. **Approach:** run proportional unit/lint/build, guarded sequential DB integration, and targeted real-stack flows; perform TEST, focused UI/UX review, then REVIEW. Update docs to verified behavior.
5. **Verification:** required CI jobs execute rather than skip; migration/reward/authorization/UI evidence retained; Speaking/NORMAL zero-XP regressions included.
6. **Risks/rollback:** shared TEST DB contention or false evidence from skipped guarded jobs. Use current CI serialization/guard and never count skipped jobs as PASS.
7. **Completion:** all AC evidence is available; no blocker remains; HUMAN decides closure before `FEATURE_STATUS.md` becomes `DONE`.

**HUMAN Gate 6:** final TEST/REVIEW and end-to-end evidence approval. No merge or DONE status before this gate.

## 13. Test and Verification Strategy

### 13.1 Pure DB-independent tests

- Level thresholds below/at/above every boundary, Level 1, Level 15/MAX, XP beyond 5,250, and invalid negative/non-integer inputs.
- SRS candidate matrix across no Progress, `LEARNING`, legacy `NEEDS_REVIEW`, unscheduled `LEARNED`, future schedule, exact due boundary, overdue schedule, existing/missing initial reward, and four ratings.
- Quiz candidate matrix for correct/incorrect and existing/missing Quiz reward.
- Projection/replay builders and allowed XP values.
- Frontend response validators, display percentage clamping for presentation only, MAX state, and transient feedback predicate.

### 13.2 Guarded database-backed integration tests

Run only against an isolated database accepted by existing test guards:

- migration apply/parity and no-backfill/preserved-balance assertions;
- negative preflight stop without data modification;
- enum/check/unique/FK enforcement and USER/Vocabulary `RESTRICT`;
- reward-bearing versus unreferenced canonical Vocabulary deletion behavior and membership-only removal;
- SRS/Quiz atomic success and injected rollback at Progress, reward, and XP boundaries;
- duplicate event, fresh event, stale revision, same-revision concurrency, cross-source races, and distinct-Vocabulary atomic increments;
- multi-Set same UUID and same-headword distinct private UUIDs;
- Legacy Policy A and both activity orderings;
- USER isolation and ADMIN/Guest denial.

Do not use Vercel Preview or any non-guarded database for local integration tests.

### 13.3 Frontend and browser tests

- Learning/Quiz service additive validation and unchanged request bodies.
- No reward fields persisted in Learning/Quiz session storage.
- Dashboard loading, zero-XP success, intermediate Level, MAX, API error/retry/focus, responsive layout and accessible progress semantics.
- ADMIN Dashboard makes zero USER Progress/XP calls.
- Positive original mutation may announce once; replay and zero XP do not celebrate.
- Targeted real-stack sequence: first rewards in either order, repeated Quiz run, due review including AGAIN/requeue, Dashboard updated balance/Level, reload invariance, and logout/cross-user isolation.

### 13.4 Regression boundaries

- Existing SRS interval/status/due behavior and Learning Session batching.
- Existing authoritative Quiz grading, choice secrecy and transient results.
- NORMAL Flashcard and Speaking produce no XP writes or reward feedback.
- Auth/session restore and ADMIN neutral Dashboard.
- Vocabulary ownership, Set membership, removal and deletion restrictions.

No broad unrelated suite is required during individual phases. Final CI must still satisfy repository-required CI, guarded Backend DB Integration, and Real Stack Browser checks.

## 14. Acceptance-Criteria Traceability

| SPEC AC | Phase(s) | Intended coverage | Required evidence |
|---|---|---|---|
| AC-01 | 3–6 | USER middleware/API tests; Guest/ADMIN denial; ADMIN zero-call UI | Focused API + Dashboard browser results |
| AC-02 | 2–3 | Initial SRS pass matrix and integration | +3 row/balance/response evidence |
| AC-03 | 2–3 | Repeated initial AGAIN then pass | Zero rows before pass; later +3 |
| AC-04 | 1–3 | Composite uniqueness; later Set/session/event passes | One initial row and unchanged later XP |
| AC-05 | 2, 4 | Incorrect then first/later correct Quiz | 0 then +3 then 0 evidence |
| AC-06 | 3–4 | Quiz-first and SRS-first sequences | Independent rows and cumulative +6 |
| AC-07 | 2–3 | Full stored-LEARNED complete-due snapshot; all ratings | One +1 per pre-event revision |
| AC-08 | 2–4, 7 | Requeue/future/legacy/NORMAL/Speaking matrices | No reward row or XP increment |
| AC-09 | 3 | Due AGAIN then immediate requeues | One +1 and later zeros |
| AC-10 | 1, 3–4 | Fresh runs, alternate Sets, duplicates, races | DB uniqueness + concurrent integration |
| AC-11 | 1, 4 | Identical headword, distinct private UUIDs | Independent reward rows/balances |
| AC-12 | 3–4 | Failure injection at three write boundaries | Transaction rollback evidence |
| AC-13 | 3–6 | Immediate replay lookup and UI feedback predicate | Original XP returned, current total, no write/celebration |
| AC-14 | 3–5 | Stale and losing CAS requests | Existing 409 contracts; unchanged DB |
| AC-15 | 2–4 | Concurrent different-Vocabulary rewards | Atomic accumulated balance |
| AC-16 | 1 | Migration against legacy fixtures | Exact preserved balances; zero rewards |
| AC-17 | 2–4 | Historical Progress with Policy A | First post-release rewards without inference |
| AC-18 | 2, 5–6 | Pure thresholds and API/UI MAX | Boundary results and Level 15 display |
| AC-19 | 5–6 | USER Dashboard success/MAX/read-only; ADMIN zero-call | Component + real-stack evidence |
| AC-20 | 2, 6 | Code review and frontend tests | Thresholds exist only in backend; display-only width |
| AC-21 | 1, 3–4 | Constraint inspection and adversarial inserts/races | Migration/schema tests |
| AC-22 | 1, 7 | Remove membership/delete Set/reload/restart | Reward count/identity remains unchanged |
| AC-23 | All | Scope/diff/documentation review | No excluded model/route/UI/source introduced |
| AC-24 | 1–7 | All approved focused and guarded verification | TEST report, CI jobs, UI/UX review, final REVIEW |
| AC-25 | 1, 7 | FK definitions, deletion/membership regression | Both RESTRICT; existing flows preserved |
| AC-26 | 1 | Clean and negative guarded migration fixtures | Constraint only after pass; failure changes no data |

Every approved acceptance criterion has a credible implementation and verification path. AC-25 and AC-26 are included because the finalized approved SPEC added them after the original AC-01–AC-24 traceability request.

## 15. Documentation Impact

After implementation evidence exists:

- `docs/PROJECT_OVERVIEW.md`: approved reward sources, exclusions, Level/MAX and deferred Daily Goal.
- `docs/DATABASE.md`: `XP_REWARD`, constraints, FKs, retention, no-backfill and nonnegative XP guard.
- `docs/API_SPEC.md`: additive mutation reward projections and Learning Progress `xp_level` projection.
- `docs/UI_UX_SPEC.md`: USER Dashboard summary and any retained concise feedback behavior; ADMIN unchanged.
- `docs/FEATURE_STATUS.md`: keep XP/Level non-DONE until IMPLEMENT + TEST + REVIEW + HUMAN approval; then record exact evidence.
- `docs/ARCHITECTURE.md`: update only if implementation reveals an actual architectural boundary change. The planned shared service/repository extension fits current architecture and does not presently require one.

## 16. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Legacy negative `total_xp` blocks constraint | Read-only migration guard stops before DDL; HUMAN decides remediation separately. |
| Progress commits but XP fails | One transaction, no nested client, injected rollback tests. |
| Duplicate reward under race | Database composite/event uniqueness plus Progress CAS; increment only after successful insert. |
| Quiz revision changes due-cycle number | Due eligibility uses complete current pre-event snapshot; Quiz cannot award due XP. |
| Due AGAIN farms immediate requeues | Rewarded transition writes `LEARNING`; due rule requires stored scheduled `LEARNED`. |
| Replay cannot recover original positive amount | Persist amount with source event; replay lookup returns it. Absence means original zero. |
| Cross-source event-ID misuse | USER/event uniqueness rolls back a second positive reward and maps to safe existing conflict. |
| Lost XP under different-Vocabulary concurrency | Atomic database increment and concurrency test. |
| Frontend becomes authoritative | Backend sends all Level bounds; frontend computes display width only. |
| Celebration repeats after reload/session restore | Never persist reward feedback; only announce positive non-replay immediate response. |
| Dashboard extra request/ADMIN leakage | Extend existing USER-only Progress payload; retain ADMIN early return. |
| Vocabulary/account retention expands silently | Both reward FKs RESTRICT; no delete endpoint/lifecycle changes. |
| Guarded CI is skipped | Treat skipped jobs as no evidence; final gate requires executed Backend DB Integration and Real Stack Browser. |

## 17. Assumptions and Blockers

- The HUMAN approval in the PLAN request is the authoritative approval of the finalized SPEC content. The SPEC's embedded status line still says “FINAL DRAFT — PENDING HUMAN SPEC APPROVAL”; this PLAN does not modify the approved SPEC because the task permits only the PLAN document.
- The existing PostgreSQL/Prisma transaction and raw-SQL migration conventions remain available; no dependency is needed.
- The selected additive Learning Progress read projection is compatible with the approved requirement allowing an existing endpoint instead of a new one.
- No current technical blocker or SPEC contradiction was found.

## 18. PLAN Completion and Next Gate

This PLAN is ready for HUMAN review. It authorizes no migration, schema edit, source/test implementation, database command, TASK creation, commit, push or merge. After explicit PLAN approval, the next workflow stage is a separate TASK decomposition using the project TASK skill.
