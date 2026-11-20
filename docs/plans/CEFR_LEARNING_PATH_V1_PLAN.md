# PLAN: CEFR Learning Path V1

**Source SPEC:** `docs/specs/CEFR_LEARNING_PATH_V1_SPEC.md`

**SPEC approval:** `HUMAN-APPROVED — 2026-11-03`

**PLAN status:** `APPROVED`

**HUMAN PLAN approval:** `APPROVED — 2026-11-03`

**TASK authorized:** `YES — TASK authoring only`

**Implementation authorized:** `NO`

This document defines the proposed technical approach only. It does not authorize source changes, TASK decomposition, migration execution, database access, Prisma generation, tests, builds, CI, commit, push, merge, or deployment.

## 1. Technical Objective and Approved Scope

Implement the approved CEFR Learning Path V1 by extending the existing ELVocab monolith and its completed Learning Session, Learning Progress/SRS, Vocabulary Set, Quiz, Speaking, Dashboard, XP, and Streak boundaries.

The implementation must provide:

1. a backend-owned full NORMAL pass over the exact ordered Vocabulary snapshot of each required public System Set;
2. sequential, backend-authoritative A1 → A2 → B1 → B2 → C1 access with persistent monotonic unlock and terminal path-complete entitlement;
3. one authoritative Dashboard recommendation at the highest unlocked CEFR level;
4. backend enforcement of locked public-Set activities without changing private/copied Set authorization; and
5. one bounded global SRS review flow that reuses the current scheduler, rating, event, XP, Streak, replay, and session semantics.

Every public System Set with Set-level A1–C1 participates. There is no `is_required` flag, no C2 Set behavior, no legacy completion backfill, and no Daily Goal dependency.

## 2. Existing Architecture and Reuse Map

### 2.1 Database and persistence

- `backend/prisma/schema.prisma`
  - Reuse `VOCABULARY_SET`, `VOCABULARY_SET_ITEM`, `LEARNING_PROGRESS`, `LEARNING_SESSION`, `LEARNING_SESSION_ITEM`, and `LEARNING_SESSION_SRS_RECEIPT`.
  - Preserve Set-level `cefr_level`, `is_public`, exact Set Item identity/order, session owner scoping, immutable session snapshots, and SRS receipts.
- `backend/prisma/migrations/20261007000000_add_vocabulary_set_metadata/migration.sql`
  - Reuse the existing Set CEFR constraint permitting only null or A1–C1; do not add C2.
- `backend/prisma/migrations/20261017000000_add_streak_v1/migration.sql`
  - Reuse session lifecycle, 1–10 snapshot constraint, evidence integrity, idempotent operation identities, and timestamp conventions.
- `backend/prisma/migrations/20261018000000_add_streak_srs_receipt/migration.sql`
  - Preserve session-aware SRS receipt/revision guarantees.

### 2.2 Backend Learning Session and SRS

- `backend/src/services/learning-session-service.js`
  - Extend `createLearningSessionService`, `createSession`, `readSession`, `acknowledgeNormalReveal`, `completeNormalSession`, `selectSnapshot`, and `toSessionProjection`.
  - Reuse authoritative time, exact replay matching, expiry, inaccessible-snapshot handling, and at-most-ten session selection.
- `backend/src/services/learning-session-persistence.js`
  - Reuse `completeLearningSessionAtomically` for bounded session completion and Streak insertion.
  - Do not make full-pass completion another meaning of bounded session completion.
- `backend/src/services/learning-session-domain.js`
  - Reuse seven-day bounded-session expiry and lifecycle projection.
- `backend/src/repositories/learning-session-repository.js`
  - Extend existing owner locks, session/item locks, evidence replay, completion replay, atomic evidence writes, and projection selects.
- `backend/src/services/srs-scheduler.js`
  - Reuse `evaluateProgress`, `calculateRatingTransition`, `SRS_RATINGS`, and existing interval behavior unchanged.
- `backend/src/services/learning-service.js`
  - Reuse `getLearningSet`, `getLearningProgress`, `recordMeaningfulEvent`, and session-aware SRS processing.
  - Add path authorization at public Set activity boundaries and scope-aware global-session validation; do not duplicate rating logic.
- `backend/src/repositories/learning-repository.js`
  - Reuse progress reads/writes, transactions, consistent reads, Set/Vocabulary locks, and effective due-state semantics.
  - Extend data access for required curriculum, Set completion, unlock state, and accessible global-review candidates.

### 2.3 Backend routes, authorization, and other activities

- `backend/src/routes/learning-session-routes.js` and `backend/src/controllers/learning-session-controller.js`
  - Preserve bounded session endpoints and response envelope/error mapping.
- `backend/src/routes/learning-routes.js` and `backend/src/controllers/learning-controller.js`
  - Preserve Progress and SRS event contracts; add only the approved global-review read/session entry surface.
- `backend/src/services/quiz-service.js` and `backend/src/repositories/quiz-repository.js`
  - Reuse Quiz generation/grading, exact Set access, session-aware snapshot, Progress, XP, and Streak behavior.
  - Insert the same locked-public-Set path authorization before both question generation and answer mutation.
- `backend/src/create-app.js`
  - Wire one focused learning-path repository/service/controller/router and inject its authorization/query capability into Learning Session, Learning, and Quiz services.
  - Preserve existing Authentication and USER-role middleware.
- Speaking Practice has no backend scoring/persistence endpoint and reads authorized Set data through the Learning `NORMAL` contract. Enforcing the lock in that backend read/session boundary blocks Speaking against locked public Sets without changing browser speech behavior.

### 2.4 Frontend

- `frontend/src/dashboard/dashboard-page.jsx`
  - Reuse `useDashboardSource`, independent section loading/error/retry, retry focus, USER/ADMIN role split, and current Dashboard composition.
  - Add independent learning-path and global-review summary sources; do not relabel private Set previews or Discovery Featured Sets.
- `frontend/src/dashboard/dashboard-page.css`
  - Extend existing responsive Dashboard styling only as needed for the two approved sections.
- `frontend/src/learning/learning-foundation-page.jsx`
  - Extend NORMAL mode to orchestrate a full pass across bounded sessions and explicit final completion.
  - Preserve existing SRS per-Set mode behavior subject to locked-level authorization.
- `frontend/src/learning/normal-learning-session.js`
  - Reuse bounded NORMAL session creation/reconciliation and reveal behavior as the per-batch unit.
- `frontend/src/learning/srs-learning-session.js`
  - Reuse fixed-snapshot SRS interaction, `AGAIN` requeue, resolved-item handling, and completion presentation for global review.
- `frontend/src/services/learning-session-service.js`
  - Reuse bounded session create/read/reveal/complete methods and error normalization.
- `frontend/src/services/learning-service.js`
  - Reuse Learning and SRS event methods; add global review summary/session calls or keep them in one focused `learning-path-service.js` according to endpoint ownership.
- `frontend/src/app-router.jsx`
  - Add one authenticated USER global-review route and keep existing Dashboard, Set learning, Quiz, Speaking, and Progress routes.
- `frontend/src/quiz/quiz-foundation-page.jsx` and `frontend/src/pronunciation/speaking-practice-page.jsx`
  - Reuse existing API-error states to present backend lock responses; frontend checks remain advisory only.

### 2.5 Existing verification assets

- Backend: `backend/test/learning/learning.test.js`, `backend/test/learning/srs-scheduler.test.js`, `backend/test/streak/streak-srs-session.test.js`, `backend/test/quiz/quiz-read.test.js`, `backend/test/quiz/quiz-answer.test.js`, `backend/test/quiz/quiz.integration.test.js`, and `backend/test/vocabulary-set/vocabulary-set.test.js`.
- Frontend unit: `frontend/test/normal-learning-session.test.js`, `frontend/test/learning-session-state.test.js`, `frontend/test/learning-session-service.test.js`, `frontend/test/srs-learning-session.test.js`, `frontend/test/quiz-service.test.js`, and Speaking Practice state/page/accessibility tests.
- Browser/real stack: `frontend/e2e/auth/dashboard-foundation.spec.js`, `frontend/e2e/auth/learning-srs.spec.js`, `frontend/e2e/integration/dashboard-real-stack.spec.js`, `frontend/e2e/integration/learning-real-stack.spec.js`, and `frontend/e2e/integration/quiz-real-stack.spec.js`.
- Migration safety conventions: existing XP/Streak migration-safety harnesses and `backend/test/scripts/check-test-database-migration-status.js` are patterns to extend later; they are not run during PLAN.

## 3. Chosen Architecture and Alternatives

### 3.1 Recommended persistence design

Add three focused persistence concepts and minimally extend `LEARNING_SESSION`:

1. `CEFR_LEARNING_PASS`
   - One backend-owned attempt/run for one USER and exact Set identity.
   - Stores current nullable Set relation plus immutable Set ID snapshot, status, operation identities, snapshot size, and lifecycle timestamps.
   - A completed pass is the durable learner-scoped historical Set completion.
2. `CEFR_LEARNING_PASS_ITEM`
   - Stores exact immutable Vocabulary ID and position for the full ordered Set snapshot.
   - It does not duplicate reveal evidence; accepted evidence remains in linked bounded `LEARNING_SESSION_ITEM` records.
3. `CEFR_LEARNING_PATH_STATE`
   - One optional row per USER storing the highest earned unlocked level and nullable terminal path-completed timestamp.
   - Absence means initial A1 entitlement and no terminal completion; reads remain side-effect-free.
4. `LEARNING_SESSION` extension
   - Optional pass relation for bounded NORMAL batches.
   - Explicit session scope supporting existing Set sessions and global SRS sessions.
   - Global SRS sessions have no Set identity; existing Set sessions retain their exact Set snapshot.

This separates historical Set completion, current curriculum projection, and persistent unlock entitlement as required by the SPEC without creating a general activity-history product.

### 3.2 Alternatives considered

| Alternative | Benefit | Rejection reason |
|---|---|---|
| Infer full-pass completion from `LEARNING_PROGRESS` or completed bounded sessions | No new tables | Cannot prove one coherent full NORMAL pass; violates no-backfill and memorization-independent rules. |
| Store a JSON array of full-pass item IDs on one row | Fewer relations | Weak relational integrity/queryability, awkward exact coverage and mutation checks, and inconsistent with current normalized session items. |
| Extend one `LEARNING_SESSION` to more than 10 items | Fewer concepts | Breaks the approved bounded-session contract, existing checks, UI assumptions, expiry, and Streak semantics. |
| Add only a Set-completion table without run/items | Minimal row count | Cannot resume, freeze an active snapshot, partition batches, or prove exact evidence coverage. |
| Create a separate global-review session framework | Avoid changing Set session nullability | Duplicates snapshot, replay, rating, expiry, and Streak logic; higher regression and maintenance cost. |
| Recompute unlocks entirely from current counts | No path-state row | Violates monotonic entitlement and terminal achievement preservation after curriculum mutation. |

The recommended design is the smallest option that satisfies every approved invariant while maximizing reuse.

## 4. Database and Migration Plan

### 4.1 New enum and models

Add a pass-status enum with exactly `ACTIVE`, `INVALIDATED`, and `COMPLETED`. Add a session-scope enum with exactly `SET` and `GLOBAL`, defaulting existing/new ordinary sessions to `SET`.

`CEFR_LEARNING_PASS` fields:

- UUID primary key.
- `user_id` required FK to `USER`, restrictive delete/update behavior consistent with session ownership.
- nullable current `vocabulary_set_id` FK using `SET NULL` on Set deletion.
- immutable required `set_id_snapshot` UUID.
- `status`, unique create operation identity per USER, nullable unique completion event identity per USER, positive `snapshot_size`, backend timestamps, nullable completion/invalidated timestamps.
- No CEFR snapshot is authoritative for current projection; current Set classification is read from the current curriculum. The Set ID snapshot preserves historical identity.

`CEFR_LEARNING_PASS_ITEM` fields:

- UUID primary key, required pass FK, immutable Vocabulary UUID without a Vocabulary FK, zero-based position.
- Unique `(pass_id, vocabulary_id)` and `(pass_id, position)`.
- Cascade only when deleting its owning pass; V1 provides no pass-delete API.

`CEFR_LEARNING_PATH_STATE` fields:

- `user_id` as primary/unique FK.
- `highest_unlocked_level` constrained to A1–C1.
- nullable `path_completed_at` and ordinary update timestamp.
- No percentages, analytics, history, C2, XP, Streak, or Daily Goal columns.

### 4.2 Existing `LEARNING_SESSION` changes

- Add `scope` with default `SET` so existing rows retain current meaning.
- Make `set_id_snapshot` nullable only to represent `GLOBAL` SRS sessions.
- Add nullable `cefr_learning_pass_id` relation/index.
- Database checks enforce:
  - `SET` scope requires `set_id_snapshot`;
  - `GLOBAL` scope requires mode `SRS`, null current/snapshot Set identities, and no pass relation;
  - a pass relation requires `SET` scope and mode `NORMAL`;
  - existing snapshot size, status, evidence, completion, expiry, and operation constraints remain unchanged.

### 4.3 Uniqueness and concurrency

- A partial unique index permits at most one `ACTIVE` pass per `(user_id, set_id_snapshot)`.
- A partial unique index permits at most one accepted `COMPLETED` pass per `(user_id, set_id_snapshot)`; restart attempts may coexist only as invalidated history.
- Keep USER-scoped unique create/completion operation identities for exact replay and cross-resource collision rejection.
- Use transaction locks/advisory identity locking consistent with current repositories when starting/restarting/completing a pass and advancing path state.
- Final pass completion locks the pass, pass items, associated bounded sessions/items, current curriculum projection inputs needed for the immediate unlock decision, and learner path state in one transaction.

### 4.4 Forward-only migration

- Create one additive forward-only migration; do not edit prior migrations.
- Add enums/models/relations/checks/indexes and backfill only `LEARNING_SESSION.scope = SET` through the non-null default before making the scope contract active.
- Do not create pass, completion, unlock, or path-complete rows from historical Progress, Quiz, XP, Streak, Learning Session, or client state.
- Do not alter existing Set CEFR values, public/private ownership, Learning Progress, rewards, Streak days, or Daily Goal work.
- Later TEST authorization must validate the migration only against an isolated guarded TEST database using repository migration-safety conventions. Main, Preview, Production, shared development, and Daily Goal databases remain prohibited.

## 5. Backend Plan

### 5.1 Focused learning-path module

Create repository/service/controller/route files following existing naming conventions, tentatively:

- `backend/src/repositories/learning-path-repository.js`
- `backend/src/services/learning-path-service.js`
- `backend/src/controllers/learning-path-controller.js`
- `backend/src/routes/learning-path-routes.js`

The later TASK may adjust names only to match repository conventions; it must not split this into extra infrastructure layers.

Repository responsibilities:

- Query currently required public System Sets with non-null A1–C1 Set CEFR, ordered by CEFR rank then `created_at`, then ID.
- Project per-level required/completed counts by joining learner completed-pass Set identities to current qualifying Sets.
- Read/lock path state; treat no row as A1.
- Read/create/lock/invalidate/complete passes and full ordered pass items.
- Read linked bounded sessions/evidence and calculate unresolved pass items without interpreting SRS or mastery.
- Preserve historical scalar identities when Set/Vocabulary rows are removed.
- Provide current locked-public-Set authorization facts without exposing another USER's state.

Service responsibilities:

- Produce one authoritative A1–C1 projection, current counts, unlock entitlements, terminal entitlement, configuration states, active pass, and primary recommendation.
- Start a pass only for an unlocked required public Set with at least one item; exact operation replay returns the same pass.
- Resume the valid active pass rather than silently creating a second run.
- Create the next bounded NORMAL session from the first at most ten unresolved ordered pass items by invoking/reusing Learning Session creation inside the same authorization boundary.
- Reconcile completed/expired linked sessions. Expired sessions may be replaced for unresolved items; they do not invalidate the pass by themselves.
- Detect frozen-snapshot mutation/access loss. Return restart-required without protected content; explicit restart invalidates the old pass and creates a new authoritative snapshot.
- Accept explicit final completion only after every pass item has `NORMAL_REVEALED` evidence in a completed linked NORMAL session.
- Make completion idempotent and transactionally mark the pass complete, then advance only monotonic path state when current predecessor requirements are satisfied.
- Preserve completed Set identity and earned unlock/path-complete state across later Set edits, deletion, privacy/null-CEFR conversion, or CEFR reassignment.
- Never use Learning Progress, SRS, Quiz, XP, Streak, Daily Goal, or remembered state as pass/unlock evidence.

### 5.2 Shared public-Set activity authorization

Add one reusable service-level predicate/projection, backed by the learning-path repository:

- Owned private/copied Set: preserve current authorization; never path-lock and never award progression credit.
- Public Set with null CEFR: preserve existing access and exclude it from progression.
- Public A1–C1 Set: allow NORMAL, Quiz, Speaking data access, and per-Set SRS only when its level is unlocked for the USER.
- Public detail/discovery/copy endpoints remain unchanged.
- Missing/foreign-private resources retain existing concealed not-found behavior; locked public activity returns one stable non-disclosing conflict/forbidden business error documented in the API.

Apply this check in all authoritative entry points:

- `learning-session-service.createSession` for Set-scoped NORMAL, SRS, and QUIZ sessions;
- `learning-service.getLearningSet` for `NORMAL` and `SRS`;
- session read/reveal/completion when current access must still be valid;
- `quiz-service.getQuestions` and `quiz-service.recordAnswer`, including sessionless paths;
- full-pass start/resume/batch/final completion.

Speaking remains blocked through its dependency on authorized Learning NORMAL data/session creation. Frontend route checks may improve messaging but are not security controls.

### 5.3 Global review extension

Extend Learning repository/service/session behavior rather than create another scheduler:

- Candidate universe begins with existing learner `LEARNING_PROGRESS` rows, then requires current reachability through at least one unlocked public A1–C1 Set or USER-owned private Set.
- Exclude null-CEFR public Sets from “unlocked public” reachability, locked-only public reachability, foreign/private/inaccessible content, and orphan-only Progress.
- Deduplicate by exact Vocabulary ID in the data query; distinct IDs with the same spelling remain distinct.
- Evaluate due state with existing `evaluateProgress` and authoritative backend time.
- Preserve existing deterministic SRS priority from `selectSnapshot`/`compareSrsItems`; select at most ten.
- Create a `GLOBAL`/`SRS` Learning Session with the fixed candidate snapshot and no Set identity.
- Extend scope-aware session access validation so every unresolved global item remains reachable through an allowed source before mutation; loss of access fails safely.
- Continue using `learningService.recordMeaningfulEvent` with `session_id`, current SRS receipts, ratings, revision/replay, XP, and Streak behavior.
- `AGAIN` remains unresolved; `HARD`, `GOOD`, and `EASY` resolve. Completion never expands the snapshot.
- A new explicit **Ôn tiếp** request creates/replays a fresh global session and reevaluates current eligibility.
- No review action calls pass or path-state mutations.

## 6. API Contract Plan

All new endpoints require existing Authentication and USER-role middleware, derive USER identity from the session, use current success/error envelopes, strictly allowlist input, and accept no user ID, CEFR unlock, count, timestamp, or completion claim from the client.

### 6.1 Learning-path read

`GET /api/learning-path`

Returns:

- ordered A1–C1 level projections with `locked`, `unlocked`, current required/completed counts, configuration state, and terminal entitlement;
- highest unlocked primary level;
- at most one primary recommendation containing Set summary and either `START` or `RESUME` action with owned active-pass identity;
- earlier unlocked-level incomplete summaries/access indicators without making them the primary recommendation;
- authoritative evaluation timestamp.

The read is side-effect-free. ADMIN/Guest use existing 403/401 behavior.

### 6.2 Full-pass lifecycle

`POST /api/learning-path/sets/:setId/passes`

- Body: exact `operation_id` only.
- Starts the authoritative pass or returns the valid active pass/exact replay.
- Rejects missing, private, copied, null-CEFR, empty, locked, or invalid required Sets with stable validation/not-found/locked/configuration errors.

`GET /api/learning-path/passes/:passId`

- Owner-only projection with lifecycle, snapshot size, studied/remaining counts, current bounded session when present, and restart reason/action.
- Does not expose inaccessible item content.

`POST /api/learning-path/passes/:passId/sessions`

- Body: exact `operation_id` only.
- Creates or replays the next bounded NORMAL session of at most ten unresolved ordered pass items.
- Returns an existing still-active batch where appropriate instead of overlapping it.

`POST /api/learning-path/passes/:passId/restart`

- Body: exact `operation_id` only.
- Explicitly invalidates the incompatible active run and creates a new pass snapshot transactionally when the Set remains eligible/authorized.

`POST /api/learning-path/passes/:passId/complete`

- Body: exact `operation_id` only.
- Represents explicit **Hoàn thành bộ từ**.
- Returns completed-pass projection, refreshed path projection/recommendation, replay flag, and any newly earned level/path entitlement.
- Missing evidence, incomplete bounded sessions, expiry/inaccessibility, stale snapshot, foreign identity, and incompatible replay fail without credit.

### 6.3 Existing bounded-session endpoints

Keep these paths and core contracts:

- `POST /api/learning-sessions`
- `GET /api/learning-sessions/:sessionId`
- `PUT /api/learning-sessions/:sessionId/items/:vocabularyId/reveal`
- `POST /api/learning-sessions/:sessionId/complete`
- `POST /api/learning/events`

Only projections required for orchestration may add optional `scope`/pass identity fields. Existing Set-scoped callers remain compatible. Clients cannot attach an arbitrary session to a pass; only the learning-path service creates pass-linked sessions.

### 6.4 Global review

`GET /api/learning/review`

- Side-effect-free summary with exact due count, `has_due_items`, authoritative evaluation time, and nearest future review when available from accessible studied candidates.

`POST /api/learning/review/sessions`

- Body: exact `operation_id` only.
- Creates/replays one `GLOBAL` SRS session of at most ten exact-ID-deduplicated eligible items.
- Returns `session: null` with stable up-to-date/future-due reason when empty.
- Explicit **Ôn tiếp** is another call with a fresh operation ID after the fixed snapshot completes.

### 6.5 Error contract

Define stable domain codes in `docs/API_SPEC.md` during implementation documentation synchronization:

- validation: malformed/unknown fields or UUIDs;
- not found: missing/foreign pass/session without ownership disclosure;
- locked public Set activity;
- curriculum not configured / empty required Set;
- pass snapshot changed / restart required;
- pass incomplete / final completion conflict;
- expired/inaccessible bounded session;
- operation/replay conflict.

Use current 400/401/403/404/409 conventions. Exact names and mappings must be consistent across controller and docs; no client string parsing.

## 7. Frontend and UX Plan

### 7.1 Dashboard

Add two independent `useDashboardSource` instances for learning path and global review summary. Preserve Progress, Streak, and My Sets behavior and ADMIN neutrality.

Learning-path section states:

- loading skeleton and section-scoped accessible status;
- start/resume primary recommendation at highest unlocked level;
- level newly unlocked;
- locked/open/completed level summary without color-only meaning;
- curriculum-not-configured or empty-required-Set state;
- current path complete;
- preserved path-complete achievement plus truthful newly incomplete current curriculum;
- scoped error/retry retaining successful sibling sections.

Global-review section states:

- authoritative due count and action;
- up to date;
- future review time when returned;
- independent loading/error/retry.

Do not change private Set preview meaning, Discovery Featured semantics, global App Shell, or ADMIN Dashboard.

### 7.2 Full-pass Learning UI

Extend NORMAL Set learning to:

- start/read/resume the backend pass before creating bounded sessions;
- render the current at-most-ten-card batch through existing Learning UI/session logic;
- acknowledge every reveal through the existing endpoint;
- explicitly complete each bounded session;
- request the next unresolved batch and show authoritative full-pass studied/remaining counts;
- show **Hoàn thành bộ từ** only when the backend says all snapshot items and required batches are complete;
- submit explicit final completion and navigate/render the refreshed recommendation/level result;
- reconcile reload/logout/login from pass and session APIs, not `sessionStorage` authority;
- show expired batch recovery, restart-required mutation state, safe explicit restart, replay/conflict, locked, and inaccessible states.

Keep client session storage presentation-only. Do not convert reveal into memorization or emit additional Progress/SRS/XP events.

### 7.3 Locked activities

- Public discovery/detail and authorized copy remain enabled.
- Entry links may display locked state and explanation based on the path projection.
- Learning, Quiz, Speaking, and per-Set SRS pages must render the backend locked error safely if directly navigated.
- Owned private/copied Set routes retain current behavior and never display progression credit.

### 7.4 Global review page

Add one USER route, tentatively `/review`, and one focused page that reuses SRS card/session helpers:

- load/create a bounded global session;
- display fixed-snapshot progress;
- send existing SRS events with session identity;
- retain `AGAIN` requeue and rating accessibility;
- show complete/up-to-date/future-due/error/retry states;
- show **Ôn tiếp** only after completion and request a fresh backend snapshot;
- never show CEFR completion effects.

A Focused `ui-ux-review` remains required after UI implementation and functional tests, before HUMAN visual approval. It is separate from TEST and formal REVIEW.

## 8. Validation, Authorization, and Edge Cases

- Strict UUID/field allowlists and current response envelope conventions apply to every new mutation.
- Backend USER identity owns passes, path state, sessions, and completion; all foreign/missing identities remain concealed.
- Required Set query uses current public System status and non-null A1–C1 Set CEFR only.
- Zero required Sets block forward unlock and produce configuration state.
- Empty required Sets cannot start/complete a pass or unlock.
- Active full snapshots are immutable. New Set items do not enter; removed/inaccessible items require restart.
- Completed Set passes survive later item edits, Set deletion/privacy/null CEFR, and CEFR reassignment.
- Current counts use current qualifying Set classification; completed exact Set identity follows a Set to its new level.
- Earned highest level and terminal path completion only advance; they never decrement.
- Earlier-level additions after unlock remain accessible incomplete study but cannot become primary Dashboard recommendation.
- Bounded session expiry permits safe unresolved-batch replacement; it never grants full-pass credit.
- Exact operation replay succeeds idempotently; incompatible reuse conflicts.
- Concurrency cannot create two active passes, two accepted completions, duplicate unlock effects, or overlapping active batch credit.
- Global review filters access before snapshot creation and before rating mutation, deduplicates exact IDs, excludes locked-only/orphan-only candidates, and retains same-spelling/different-ID identities.
- Dashboard and summary reads produce no state mutation.

## 9. Verification Strategy for Later Authorized TEST Stage

No tests are run during PLAN. Later work must add the smallest focused coverage and reuse existing harnesses.

### 9.1 Backend unit/service coverage

- Full-pass start/resume, exact ordered snapshot, 1/10/>10 partitioning, reveal coverage, bounded completion prerequisite, explicit final completion, replay, concurrency, expiry replacement, mutation restart, and no Progress/XP mutation.
- Required Set query for public A1–C1 versus null CEFR/private/copied sets.
- Sequential unlock, zero/empty configuration, new Set before/after unlock, monotonic state, CEFR reassignment, deletion/private/null conversion, and terminal entitlement/current-count separation.
- Locked public activity rejection across Learning Session, Learning read/event, Quiz questions/answers, and Speaking’s Learning dependency; private copies remain authorized.
- Global review access universe, exact-ID dedupe, deterministic due order, at-most-ten snapshot, all four ratings, fresh continuation, empty/future state, replay/revision, access loss, and CEFR independence.

Extend existing suites where their domain is affected; create focused learning-path repository/service/API tests rather than overloading unrelated files.

### 9.2 Migration and PostgreSQL integration

- Static migration-safety test for additive objects, checks, indexes, defaults, old-session compatibility, and no-backfill statements.
- Guarded isolated PostgreSQL integration for partial uniqueness, pass completion transaction, path-state monotonic update, global session constraints, deletion/reclassification behavior, and concurrent requests.
- Use only the repository’s guarded TEST database checks. Never access Main, Preview, Production, shared development, or Daily Goal databases.

### 9.3 Frontend unit/component coverage

- Service request/response/error normalization for path, pass, and review endpoints.
- NORMAL full-pass orchestration, remaining count, resume/reload, next batch, explicit completion, restart-required, expiry/retry, stale response, and no client authority.
- Dashboard independent sources, highest-level recommendation, earlier-level incomplete content, terminal entitlement/current-count distinction, ADMIN no-USER calls, partial failure, retry focus, and duplicate-request protection.
- Global review fixed snapshot, rating behavior, completion, explicit **Ôn tiếp**, empty/future/error states, and accessibility.
- Locked direct-route states for Learning, Quiz, Speaking, and per-Set SRS.

### 9.4 Browser and real-stack coverage

- A1 first use through multi-batch Set completion and A2 unlock.
- Direct URL/API lock bypass attempts and private-copy preservation.
- Dashboard recommendation/resume and independent failure/retry.
- New earlier-level Set after later unlock and new Set after terminal completion.
- Global review across unlocked public/private reachability with exact-ID dedupe and explicit continuation.
- Cross-user isolation, reload/logout/login resume, and mutation/restart.

### 9.5 Legacy/regression impact scan

Run focused existing suites for Learning Session, per-Set SRS, Quiz, Speaking, Dashboard, Vocabulary Set ownership/copy, XP, and Streak. Verify active API callers, fixtures, route mocks, selectors, and docs. Daily Goal V1 remains untouched and is not a test dependency.

Record exact PASS/FAIL/NOT RUN evidence. Do not delete or weaken existing tests to accommodate the feature.

## 10. Documentation Synchronization

During later approved implementation, update only documentation affected by implemented contracts:

- `docs/ARCHITECTURE.md` — learning-path orchestration and reuse boundaries.
- `docs/DATABASE.md` — new pass/path-state models and Learning Session scope extension.
- `docs/API_SPEC.md` — path/pass/global-review endpoints, lock/error contracts, and replacement of deferred Continue Learning/Words to Review wording.
- `docs/UI_UX_SPEC.md` — Dashboard path/review sections, full-pass, locked, restart, and global-review states.
- `docs/PROJECT_OVERVIEW.md` — only if the approved feature list needs synchronization.
- `docs/FEATURE_STATUS.md` — set this change request to `IN_PROGRESS` only when implementation begins; mark `DONE` only after IMPLEMENT, TEST, REVIEW, HUMAN approval, and documentation synchronization.

Do not modify Daily Goal V1 documentation or claim it as merged/dependent.

## 11. Workstreams, Dependencies, and Acceptance Checkpoints

### Workstream 1 — Full-pass completion, CEFR projection, and locks

Scope:

- additive schema/migration;
- pass/path-state repositories and service;
- bounded session linkage;
- full-pass APIs;
- current curriculum projection and monotonic unlock;
- shared locked-public-Set authorization across Learning, Quiz, and Speaking dependency;
- backend, migration-safety, and focused frontend service/orchestration coverage.

Dependency: none beyond approved SPEC and later PLAN/TASK approval.

Acceptance checkpoint:

- a USER can complete exact multi-batch NORMAL evidence once, resume/restart safely, unlock sequentially, and cannot bypass locks;
- private/copied behavior and existing Learning Session/Quiz/Streak contracts remain compatible.

### Workstream 2 — Dashboard and Learning UI

Scope:

- Dashboard authoritative path source and highest-level recommendation;
- full-pass NORMAL UI and explicit completion;
- locked/configuration/mutation/terminal states;
- independent loading/error/retry and accessibility;
- focused UI tests and later Focused UI/UX Review.

Dependency: Workstream 1 API/projection and pass lifecycle contracts must be stable.

Acceptance checkpoint:

- Dashboard and Learning UI render all approved states without client-derived authority, backward recommendation, sibling-section failure, or relabelled private/Featured content.

### Workstream 3 — Global SRS review

Scope:

- Learning Session global scope and accessible candidate query;
- due summary/global session endpoints;
- global review page and Dashboard review section;
- SRS, access, dedupe, continuation, empty/future, and regression coverage.

Dependency: Workstream 1 path projection/authorization is required to decide unlocked public reachability. It may proceed in parallel with Workstream 2 after that backend contract stabilizes.

Acceptance checkpoint:

- at most ten accessible due exact IDs use unchanged rating/schedule/replay semantics; explicit continuation reevaluates eligibility; review never mutates CEFR completion.

### Integrated closure

After all three workstreams:

1. run the authorized focused/real-stack verification and Legacy/Regression Impact Scan;
2. run Focused UI/UX Review for changed UI flows;
3. synchronize active documentation;
4. perform formal REVIEW against the approved SPEC and PLAN;
5. request HUMAN final approval before any `DONE` status.

These are implementation groups, not TASK decomposition or authorization to execute them.

## 12. Risks and Fallback Options

- **Session-schema regression:** nullable Set snapshot for global scope could weaken existing assumptions. Mitigation: explicit scope/default/check constraints, unchanged Set-session projections, and targeted legacy tests. Fallback: if constraints cannot preserve compatibility, return to PLAN review before considering a separate global session model.
- **Pass/session concurrency:** retries could create overlapping batches or duplicate completion. Mitigation: partial unique indexes, row/advisory locks, operation IDs, and one completion transaction.
- **Mutable curriculum:** current counts can diverge from earned state. Mitigation: separate completed-pass identity, current projection query, and monotonic path-state row.
- **Authorization drift:** Learning, Quiz, Speaking, and SRS may disagree. Mitigation: one reusable backend path-authorization capability injected into each service; frontend checks are presentation only.
- **Global review query cost:** reachability joins may duplicate rows. Mitigation: exact-ID distinct query, justified indexes after query-plan verification in isolated TEST, at-most-ten snapshot; add no cache/background job in V1.
- **Set deletion/privacy disclosure:** historical scalar IDs must not reveal content. Mitigation: nullable current relation, scalar-only history, and projections that omit inaccessible Set/Vocabulary details.
- **Dashboard complexity:** new sections could couple failure states. Mitigation: existing independent `useDashboardSource` pattern and section-scoped retry/focus.
- **Creation-time pedagogy:** `created_at`, then ID is approved deterministic ordering but may not be ideal curriculum order. Preserve it; do not add an Admin order field in V1.
- **Migration overlap with Daily Goal/unmerged work:** do not assume, merge, edit, or depend on Daily Goal. Rebase/integration assessment belongs to a later explicitly authorized Git workflow.

## 13. Non-Goals

- C2 Set support or progression.
- `is_required` or Admin curriculum ordering.
- New scheduler, adaptive algorithm, AI, notifications, analytics/history, background jobs, cache, or external service.
- Quiz type, Speaking architecture, XP, Level, Streak, Achievement, Daily Goal, ownership, visibility, copy, Community, or role redesign.
- Legacy completion backfill.
- Client-authoritative progress/unlock/review calculation.
- Broad refactor of Learning, Dashboard, App Shell, or session infrastructure.

## 14. Approved Technical Decisions

The HUMAN approved these concrete technical decisions on 2026-11-03:

1. three focused persistence concepts (`CEFR_LEARNING_PASS`, pass items, and per-USER path state);
2. optional pass linkage plus explicit `SET`/`GLOBAL` scope on existing Learning Sessions;
3. one focused learning-path backend module and API namespace;
4. global review implemented through existing SRS Learning Sessions rather than a duplicate framework;
5. highest-unlocked-level Dashboard projection served by the learning-path read;
6. one shared backend authorization capability applied at every affected public-Set activity service boundary;
7. one additive no-backfill migration and guarded isolated verification in a later authorized TEST stage.

All seven decisions are accepted. No unresolved business-rule question remains. Exact identifier names may be normalized during TASK authoring to established conventions, but any change to model responsibilities, endpoint behavior, persistence alternative, or approved scope requires renewed PLAN review.

## 15. PLAN Approval Record and Next Gate

```text
SOURCE SPEC: HUMAN-APPROVED — 2026-11-03
PLAN STATUS: APPROVED
HUMAN PLAN APPROVAL: GRANTED — 2026-11-03
SEVEN TECHNICAL DECISIONS: ACCEPTED
TASK AUTHORIZED: YES — TASK AUTHORING ONLY
IMPLEMENTATION AUTHORIZED: NO
TEST / MIGRATION EXECUTION AUTHORIZED: NO
NEXT ALLOWED ACTION: Author and submit the TASK document for HUMAN review
```
