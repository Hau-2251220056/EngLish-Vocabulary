# TASKS: CEFR Learning Path V1

**Source SPEC:** `docs/specs/CEFR_LEARNING_PATH_V1_SPEC.md` — `HUMAN-APPROVED 2026-11-03`

**Source PLAN:** `docs/plans/CEFR_LEARNING_PATH_V1_PLAN.md` — `HUMAN-APPROVED 2026-11-03`

**TASK status:** `HUMAN APPROVED — 2026-11-03`

**HUMAN TASK approval:** `GRANTED — TASK-001 THROUGH TASK-015`

**Final closure status:** `DONE — HUMAN FINAL ACCEPTED 2026-11-05`

**Implementation authorization at task-authoring time:** `NO — historical record; later bounded stages were separately authorized`

**Formal TEST, migration execution, database access, CI, commit, push, merge, and deployment authorization at task-authoring time:** `NO — historical record; this closure record grants no new operational authority`

This document originally defined executable implementation slices for later approval. It did not itself authorize executing any task; the final closure record in Section 10 records the later explicit HUMAN decision without authorizing integration or deployment.

## 1. Overview and Feature Status

At task-authoring time, CEFR Learning Path V1 was an approved change request extending completed ELVocab capabilities rather than rebuilding them:

- Vocabulary Set ownership, visibility, copying, Set CEFR, Learning Session V1, Flashcard Learning, Learning Progress/SRS, USER Dashboard, Quiz, Speaking, XP, and Streak are existing `DONE` foundations to preserve.
- `Continue Learning`, `Words to Review`, and their Dashboard summaries were `TODO` in `docs/FEATURE_STATUS.md` and were activated by the approved SPEC/PLAN.
- No implementation for the new full-Set pass, CEFR unlock state, primary next-Set recommendation, or global review existed yet.
- `docs/FEATURE_STATUS.md` had to remain unchanged until implementation was separately authorized and began.

The tasks are grouped into three coherent workstreams. Cross-cutting documentation, formal TEST/UI review, formal REVIEW, and HUMAN closure remain separate gates after implementation.

## 2. Dependency Graph

```text
WORKSTREAM 1 — CEFR BACKEND FOUNDATION

TASK-001 Schema and forward-only migration implementation
   ↓
TASK-002 Pass/path persistence and curriculum queries
   ↓
TASK-003 Full-pass and CEFR projection service
   ├──→ TASK-004 Learning-path API and app wiring
   └──→ TASK-005 Shared locked-activity authorization integration
                 ↓
              TASK-006 Backend/migration verification implementation

WORKSTREAM 2 — DASHBOARD AND LEARNING UI

TASK-004 + TASK-005
   ↓
TASK-007 Frontend path API and orchestration state
   ├──→ TASK-008 Multi-batch NORMAL full-pass UI
   └──→ TASK-009 Dashboard path recommendation UI
                 ↓
              TASK-010 Focused frontend/browser coverage

WORKSTREAM 3 — GLOBAL SRS REVIEW

TASK-001 + TASK-002 + TASK-005
   ↓
TASK-011 Global review backend and SET/GLOBAL compatibility
   ↓
TASK-012 Global review page and Dashboard summary
   ↓
TASK-013 Global review/regression coverage

INTEGRATED CLOSURE — separately gated

TASK-006 + TASK-010 + TASK-013
   ↓
TASK-014 Documentation synchronization and impact scan
   ↓
TASK-015 Formal TEST, Focused UI/UX Review, formal REVIEW, and HUMAN acceptance
```

Workstreams 2 and 3 may proceed in parallel only after their listed backend contracts are stable. Tasks that touch shared Learning Session, Learning service, Dashboard, fixtures, or route wiring must be coordinated rather than implemented concurrently against the same files.

## 3. Workstream 1 — CEFR Backend Foundation

### TASK-001: Add the approved persistence foundation and forward-only migration

#### Objective

Materialize the approved full-pass, ordered pass-item, path-state, and Learning Session scope/linkage model without backfilling learner completion or changing existing Set/Progress/reward/Streak data.

#### Dependencies

- Approved SPEC and PLAN
- Separate HUMAN authorization to enter IMPLEMENT before execution
- Migration execution and database verification remain separately prohibited until an authorized TEST stage

#### Files / Modules

- `backend/prisma/schema.prisma` — models, enums, relations, defaults, and indexes
- one new timestamped directory under `backend/prisma/migrations/` — additive forward-only SQL
- migration-safety test/harness files following existing XP/Streak conventions, only when implementation is authorized

#### In Scope

- `CEFR_LEARNING_PASS`, `CEFR_LEARNING_PASS_ITEM`, and `CEFR_LEARNING_PATH_STATE`.
- Pass status `ACTIVE`, `INVALIDATED`, `COMPLETED`.
- Learning Session scope `SET`, `GLOBAL`, defaulting ordinary/existing sessions to `SET`.
- Nullable Set snapshot only for valid global SRS sessions.
- Optional pass relation for Set-scoped NORMAL sessions.
- Approved checks, partial unique indexes, ownership relations, immutable scalar snapshot identities, and no-backfill behavior.

#### Out of Scope

- Running Prisma, applying migrations, accessing a database, or changing prior migrations.
- C2, `is_required`, analytics/history, Daily Goal, or retention jobs.

#### Implementation Requirements

- Preserve every existing Learning Session size, lifecycle, evidence, expiry, completion, replay, SRS receipt, XP, and Streak constraint.
- Enforce global scope as SRS-only with null Set/pass identity.
- Enforce pass linkage as SET/NORMAL-only.
- Enforce at most one ACTIVE and one accepted COMPLETED pass per USER/exact Set snapshot through approved partial uniqueness.
- Absence of path-state means A1 initial entitlement; reads must not create a row.
- Add no historical pass, unlock, or terminal row from existing data.

#### Acceptance Criteria

- Schema and SQL represent exactly the approved models and constraints.
- Existing session rows retain `SET` meaning.
- Invalid scope/mode/Set/pass combinations are database-rejected.
- Migration contains no completion/unlock backfill and does not mutate Daily Goal or unrelated domain data.

#### Development Verification

- Static schema/migration review and migration-safety assertions may be authored.
- Do not execute Prisma or database commands until a separately authorized guarded TEST stage.

### TASK-002: Implement pass/path persistence and current curriculum queries

#### Objective

Provide transactional data access for immutable passes, exact ordered items, current required curriculum, historical completion, monotonic path state, and pass-linked session evidence.

#### Dependencies

- TASK-001 implementation complete

#### Files / Modules

- create `backend/src/repositories/learning-path-repository.js`
- extend `backend/src/repositories/learning-session-repository.js`
- extend `backend/src/repositories/learning-repository.js` only where shared current queries belong there
- focused repository test files under `backend/test/learning/`

#### In Scope

- Current public System Set query for non-null A1–C1 CEFR, ordered by CEFR rank, `created_at`, then ID.
- USER-scoped path-state reads/locks and monotonic updates.
- Pass/item creation, lookup, locks, invalidation, completion, replay identities, and current nullable Set relation.
- Exact linked-session/evidence query for unresolved and completed pass items.
- Exact-ID-deduplicated global review candidate reachability query support.

#### Out of Scope

- Business projection, controller behavior, frontend, or scheduler duplication.
- Treating private/copied/null-CEFR Sets as required curriculum.

#### Implementation Requirements

- Use existing transaction/locking conventions and conceal foreign identities.
- Preserve historical scalar Set/Vocabulary IDs without returning inaccessible content.
- Join accepted completed Set identity to the Set’s current CEFR for current counts.
- Distinguish current curriculum membership from earned unlock/path entitlement.
- Make concurrent start/restart/complete operations compatible with partial uniqueness and idempotency.

#### Acceptance Criteria

- Required counts exclude private, copied, null-CEFR, deleted, and nonqualifying Sets.
- Completed exact Set identity follows current CEFR reassignment without relearning.
- Deleted/private/null-CEFR Sets leave current counts while historical completion remains queryable without content disclosure.
- Cross-user pass/path rows cannot be read or mutated.

#### Development Verification

- Focused repository unit tests with fakes/mocks may run only after IMPLEMENT authorization.
- PostgreSQL constraints/concurrency remain formal TEST evidence and must not run under this TASK authorization.

### TASK-003: Implement full-pass lifecycle and CEFR projection service

#### Objective

Implement backend-authoritative start, resume, bounded-batch orchestration, explicit restart/final completion, current progress projection, and monotonic unlock/path-complete behavior.

#### Dependencies

- TASK-002

#### Files / Modules

- create `backend/src/services/learning-path-service.js`
- extend `backend/src/services/learning-session-service.js`
- reuse `backend/src/services/learning-session-persistence.js`
- reuse `backend/src/services/learning-session-domain.js`
- focused service tests under `backend/test/learning/`

#### In Scope

- Side-effect-free A1–C1 path projection.
- Start/resume one active pass per USER/Set.
- Frozen exact ordered pass snapshot.
- First unresolved batches of at most ten linked NORMAL session items.
- Safe replacement of expired unresolved batches.
- Explicit restart after removed/inaccessible frozen items.
- Explicit **Hoàn thành bộ từ** after every linked bounded session and reveal is accepted.
- Transactional completed pass plus monotonic unlock/path state.
- Highest-unlocked-level recommendation with active-pass priority and deterministic Set order.

#### Out of Scope

- Memorization/mastery logic, Progress mutation, SRS rating, Quiz score, XP, Streak, Daily Goal, or client authority as completion evidence.
- Earlier-level Sets replacing the highest-level primary recommendation.

#### Implementation Requirements

- Use `NORMAL_REVEALED` from completed pass-linked sessions as the only item proof.
- Never infer full completion from one bounded session when the pass has more than ten items.
- Exact retries return accepted state; incompatible operation reuse conflicts.
- Zero required Sets and empty required Sets return configuration states and cannot unlock.
- New required Sets block only not-yet-earned next levels; existing unlock and terminal entitlement never decrement.
- Path completion and current all-Sets-complete status remain separate.

#### Acceptance Criteria

- A 1-item, 10-item, and >10-item Set complete correctly through exact bounded evidence.
- Opening, revealing without bounded completion, SRS, Quiz, Speaking, Progress, XP, or Streak cannot complete a pass.
- Resume/restart/replay/concurrency behavior is deterministic and owner-scoped.
- A1→A2→B1→B2→C1 unlocks sequentially; C1 terminal entitlement introduces no C2.
- Current counts remain truthful after curriculum mutation without relocking earned access.

#### Development Verification

- Focused service tests may be executed only after IMPLEMENT authorization.
- Concurrency and real database proof remain separately gated formal TEST work.

### TASK-004: Expose the learning-path API and wire the backend module

#### Objective

Expose the approved path/pass lifecycle through authenticated USER-only API contracts and standard ELVocab envelopes/errors.

#### Dependencies

- TASK-003

#### Files / Modules

- create `backend/src/controllers/learning-path-controller.js`
- create `backend/src/routes/learning-path-routes.js`
- modify `backend/src/create-app.js`
- focused route/controller tests under `backend/test/learning/`

#### In Scope

- `GET /api/learning-path`.
- Start/read/next-session/restart/final-complete pass endpoints approved in PLAN Section 6.
- Existing Authentication and USER-role middleware.
- Strict body/identifier validation, replay status behavior, and stable error codes.

#### Out of Scope

- Dashboard aggregation endpoint, Admin path API, user selector, or endpoint redesign beyond the approved PLAN.

#### Implementation Requirements

- Derive USER identity only from authenticated session.
- Conceal missing/foreign pass identities.
- Return authoritative counts, states, recommendation, remaining items, restart reason, and replay flags.
- Do not allow clients to attach arbitrary Learning Sessions to passes or submit unlock/completion counts.
- Reads remain mutation-free.

#### Acceptance Criteria

- Guest receives existing 401 behavior; ADMIN receives existing USER-route 403 behavior.
- USER success/error responses match repository envelope conventions.
- Foreign identifiers disclose no other learner state.
- Exact replay succeeds without duplicate pass/session/unlock effects.

#### Development Verification

- Focused controller/route tests after IMPLEMENT authorization.
- Formal API integration and real-stack checks remain gated to TEST.

### TASK-005: Apply shared locked-public-Set authorization to every activity boundary

#### Objective

Prevent direct route/API bypass for locked public A1–C1 Sets while preserving public browsing/copy and independently owned private/copied Set activities.

#### Dependencies

- TASK-002 path-state/current-Set authorization query
- TASK-003 projection rules

#### Files / Modules

- `backend/src/services/learning-session-service.js`
- `backend/src/services/learning-service.js`
- `backend/src/services/quiz-service.js`
- relevant repository injection/wiring in `backend/src/create-app.js`
- existing Learning/Quiz/Speaking-dependent test fixtures

#### In Scope

- Set-scoped NORMAL, per-Set SRS, and QUIZ session creation.
- Learning `NORMAL`/`SRS` reads and current session read/reveal/completion access.
- Quiz question generation and answer mutation, including sessionless paths.
- Speaking lock through its authoritative Learning NORMAL dependency.
- Stable locked-activity error contract.

#### Out of Scope

- Public discovery/detail/copy changes.
- Private/copied Set locking or progression credit.
- Speaking recognition architecture changes.

#### Implementation Requirements

- One shared backend authorization capability must be reused rather than copied across services.
- Public null-CEFR access remains unchanged and excluded from progression.
- Missing/foreign private Set concealment remains unchanged.
- Frontend visibility checks are advisory and cannot substitute for backend enforcement.

#### Acceptance Criteria

- Locked public NORMAL, Quiz, Speaking dependency, and per-Set SRS fail consistently by direct API/URL.
- The same USER can still use an owned private copy, but it never earns CEFR completion.
- Public detail/discovery/copy remain compatible.
- Existing unlocked public and private activity behavior does not regress.

#### Development Verification

- Extend focused Learning/Quiz/Speaking contract tests after IMPLEMENT authorization.
- Cross-user and direct-bypass integration remains formal TEST evidence.

### TASK-006: Add focused backend and migration verification coverage

#### Objective

Implement the focused automated evidence needed for Workstream 1 without executing prohibited migration/database/formal TEST operations prematurely.

#### Dependencies

- TASK-001 through TASK-005

#### Files / Modules

- focused new learning-path tests under `backend/test/learning/`
- extensions to existing Learning Session, Quiz, SRS, XP, and Streak suites only where contracts changed
- migration-safety test/harness patterned after existing XP/Streak assets

#### In Scope

- Pass correctness, exact coverage, 1/10/>10 batches, resume/restart, idempotency, concurrency expectations.
- Current curriculum, sequential/monotonic unlock, terminal entitlement, mutation, zero/empty states.
- Cross-user isolation and locked-activity enforcement.
- Static additive migration/no-backfill/constraint compatibility checks.
- Existing caller/fixture/route impact scan.

#### Out of Scope

- Running Prisma, database migration, guarded PostgreSQL, full CI, or declaring formal TEST PASS.
- Weakening completed Learning Session/SRS/Quiz/XP/Streak tests.

#### Acceptance Criteria

- Focused tests exist for every Workstream 1 acceptance path and failure boundary.
- Legacy SET session fixtures explicitly include/default scope compatibility.
- No test assumes historical completion backfill or Daily Goal integration.
- Formal database/concurrency scenarios are clearly identified as NOT RUN until authorized.

#### Development Verification

- Development unit/static checks may run only after implementation authorization.
- Guarded database and formal regression execution requires separate TEST authorization.

## 4. Workstream 2 — Dashboard and Learning UI

### TASK-007: Implement frontend learning-path API and orchestration state

#### Objective

Provide typed/validated frontend service boundaries and reusable state orchestration for authoritative path/pass responses without moving business authority into the client.

#### Dependencies

- TASK-004 API contract stable
- TASK-005 locked error stable

#### Files / Modules

- create `frontend/src/services/learning-path-service.js`
- extend `frontend/src/services/learning-session-service.js` only for optional pass/scope projections
- create focused learning-path run-state/presentation modules under `frontend/src/learning/`
- frontend unit tests under `frontend/test/`

#### In Scope

- Path read; pass start/read/next-session/restart/final completion.
- Response/error normalization and stale-request/retry protection.
- Backend operation-ID generation/reuse boundaries consistent with existing session services.
- Presentation-only storage/reconciliation keys isolated by USER, Set, pass, and mode where retained.

#### Out of Scope

- Client unlock calculations, current curriculum aggregation, due scheduling, or inferred completion.
- New state/data-fetching dependency.

#### Acceptance Criteria

- Services call only approved endpoints and submit no user/unlock/count authority.
- Exact retries reuse operation identity; new operations receive fresh identity.
- Reload state reconciles against backend pass/session truth.
- Locked/restart/configuration errors are distinguishable without string parsing.

#### Development Verification

- Focused service/state unit tests after IMPLEMENT authorization.

### TASK-008: Implement multi-batch NORMAL full-pass Learning UI

#### Objective

Let a USER start/resume and finish an entire required public Set through bounded NORMAL sessions and explicit final completion.

#### Dependencies

- TASK-007

#### Files / Modules

- `frontend/src/learning/learning-foundation-page.jsx`
- `frontend/src/learning/normal-learning-session.js`
- existing learning presentation/session storage modules as needed
- related styles and focused tests

#### In Scope

- Start/resume pass before bounded session creation.
- Existing card/reveal navigation per batch.
- Explicit bounded-session completion, next batch, authoritative studied/remaining counts.
- **Hoàn thành bộ từ** only when backend permits.
- Reload/logout/login reconciliation, expired batch replacement, incompatible snapshot restart, locked/inaccessible/error/retry states.
- Accessible focus/status and reduced-motion/responsive compatibility.

#### Out of Scope

- Memorization threshold, Progress/XP mutation from NORMAL, UI redesign, or client-computed unlock.

#### Acceptance Criteria

- >10-item Set progresses across multiple bounded groups without losing exact order or evidence.
- Opening/reaching final card alone does not show accepted Set completion.
- Resume uses backend active pass and unresolved batch.
- Explicit completion displays refreshed Set/level/path result exactly once.
- Restart is explicit and does not silently credit removed/inaccessible items.

#### Development Verification

- Focused component/session tests and mocked browser flow after IMPLEMENT authorization.
- Formal real-stack/UI approval remains gated.

### TASK-009: Add Dashboard CEFR path recommendation and truthful progress states

#### Objective

Extend the existing USER Dashboard with one independently loaded authoritative learning-path section while preserving all current sections and ADMIN neutrality.

#### Dependencies

- TASK-007

#### Files / Modules

- `frontend/src/dashboard/dashboard-page.jsx`
- `frontend/src/dashboard/dashboard-page.css`
- Dashboard unit/browser fixtures and tests

#### In Scope

- Independent `useDashboardSource` for path read.
- Highest-unlocked-level recommendation with active-pass priority and `created_at`/ID backend order.
- Locked/open/completed/configuration states.
- Current path complete versus preserved terminal entitlement with newly incomplete Sets.
- Earlier unlocked-level incomplete content visibility/access without replacing primary recommendation.
- Section loading/error/retry, stale-response prevention, retry focus, and sibling-source preservation.

#### Out of Scope

- Relabelling My Sets previews or Featured discovery.
- Admin Dashboard expansion, charts, percentages, Daily Goal, or frontend recommendation sorting.

#### Acceptance Criteria

- USER sees at most one primary recommendation from the highest unlocked level.
- Earlier additions do not pull recommendation backward or relock access.
- Zero/empty configuration and terminal states are truthful.
- ADMIN makes no path/review USER request; Guest remains route-protected.
- Failures do not discard Progress, Streak, or My Sets sections.

#### Development Verification

- Focused Dashboard component/mock-browser tests after IMPLEMENT authorization.

### TASK-010: Add focused Learning/Dashboard browser and accessibility coverage

#### Objective

Implement Workstream 2 test coverage and prepare the UI flows for later Focused UI/UX Review without running formal TEST under this authorization.

#### Dependencies

- TASK-008 and TASK-009

#### Files / Modules

- `frontend/test/normal-learning-session.test.js` and focused new path tests
- `frontend/e2e/auth/dashboard-foundation.spec.js`
- `frontend/e2e/integration/dashboard-real-stack.spec.js`
- `frontend/e2e/integration/learning-real-stack.spec.js`
- related fixtures/selectors

#### In Scope

- Loading, success, empty, configuration, error, retry, stale response, focus, responsive, and accessible status cases.
- Start/resume/remaining/next batch/final completion/restart paths.
- Highest-level recommendation and terminal/current-count distinctions.
- Route/fixture/caller impact scan for Learning, Dashboard, Quiz, and Speaking locked errors.

#### Out of Scope

- Running guarded real-stack, formal TEST, full build/lint/CI, or issuing a UI/UX verdict.

#### Acceptance Criteria

- Tests cover every approved Workstream 2 state and do not duplicate backend business calculations.
- Existing Dashboard sections and role behavior remain asserted.
- Accessibility checks include semantic status/error, keyboard focus, non-color lock meaning, and reduced-motion compatibility.
- Formal TEST and UI/UX Review remain explicitly NOT RUN.

#### Development Verification

- Development unit/mock checks only after IMPLEMENT authorization.

## 5. Workstream 3 — Global SRS Review

### TASK-011: Implement global review backend and SET/GLOBAL session compatibility

#### Objective

Create the authoritative global due summary and bounded global SRS session using existing scheduler, event, rating, receipt, XP, Streak, replay, and completion behavior.

#### Dependencies

- TASK-001 schema/session scope
- TASK-002 reachability/path queries
- TASK-005 shared activity authorization

#### Files / Modules

- `backend/src/repositories/learning-repository.js`
- `backend/src/services/learning-service.js`
- `backend/src/services/learning-session-service.js`
- `backend/src/repositories/learning-session-repository.js`
- `backend/src/routes/learning-routes.js`
- `backend/src/controllers/learning-controller.js`
- `backend/src/create-app.js`

#### In Scope

- Accessible studied candidate universe from unlocked public A1–C1 Sets or USER-owned private Sets.
- Exclusion of locked-only, null-CEFR-public-only, inaccessible, foreign-private, and orphan-only Progress.
- Exact Vocabulary-ID deduplication and existing deterministic due priority.
- `GET /api/learning/review` summary.
- `POST /api/learning/review/sessions` fixed snapshot of at most ten.
- Scope-aware access revalidation before SRS mutation.
- Existing `AGAIN`/`HARD`/`GOOD`/`EASY`, revision, replay, XP, Streak, and session completion semantics.

#### Out of Scope

- New scheduler, cross-snapshot silent expansion, CEFR completion mutation, review analytics/history, or public null-CEFR review reachability.

#### Implementation Requirements

- Reads use authoritative backend time and are side-effect-free.
- Global session has scope `GLOBAL`, mode `SRS`, and no Set/pass identity.
- Same spelling with different Vocabulary IDs remains distinct.
- Explicit continuation requires a new/replayed session request and fresh eligibility evaluation.
- Existing SET sessions and sessionless SRS callers retain their behavior.

#### Acceptance Criteria

- Summary and snapshot include only accessible studied due exact IDs.
- Snapshot contains 0–10 distinct IDs with truthful empty/future-due result.
- `AGAIN` remains unresolved; other ratings resolve under existing semantics.
- Review changes no pass, Set completion, current curriculum, unlock, or terminal entitlement.
- Existing SET SRS/Quiz/NORMAL session contracts remain compatible.

#### Development Verification

- Focused backend unit/service/API tests after IMPLEMENT authorization.
- PostgreSQL/real-stack verification remains formal TEST work.

### TASK-012: Implement the global review USER page and Dashboard due summary

#### Objective

Provide one global review entry and fixed-snapshot UI while adding an independently loaded Dashboard review summary/action.

#### Dependencies

- TASK-011 stable API
- TASK-009 Dashboard composition conventions

#### Files / Modules

- extend `frontend/src/services/learning-service.js` or add the approved focused review methods without duplicating learning-path ownership
- create one focused global review page/module under `frontend/src/learning/`
- reuse `frontend/src/learning/srs-learning-session.js`
- modify `frontend/src/app-router.jsx`
- modify `frontend/src/dashboard/dashboard-page.jsx` and scoped styling

#### In Scope

- USER route, session creation, fixed-snapshot card/rating interaction, completion, empty/future/error/retry states.
- Explicit **Ôn tiếp** fresh request after completion.
- Independent Dashboard due summary/action source and retry behavior.
- Accessible keyboard/focus/status behavior.

#### Out of Scope

- New navigation/App Shell redesign unless an existing approved entry surface requires one minimal link.
- Scheduler calculations, infinite queue, review charts/history, or CEFR progress messaging.

#### Acceptance Criteria

- USER can review one bounded snapshot through existing four ratings.
- Queue does not expand silently; **Ôn tiếp** reevaluates through backend.
- Dashboard due failure does not affect other sections.
- ADMIN makes no USER review request; Guest cannot enter the route.
- UI never claims review completes a Set or unlocks CEFR.

#### Development Verification

- Focused component/service/mock-browser tests after IMPLEMENT authorization.

### TASK-013: Add global review and shared-session regression coverage

#### Objective

Implement focused evidence for global candidate access, deduplication, ratings, continuation, and compatibility with existing SET sessions and affected domains.

#### Dependencies

- TASK-011 and TASK-012

#### Files / Modules

- `backend/test/learning/learning.test.js`
- `backend/test/learning/srs-scheduler.test.js` only if existing scheduler regression evidence needs extension, not behavior change
- `backend/test/streak/streak-srs-session.test.js`
- `frontend/test/srs-learning-session.test.js`
- `frontend/e2e/auth/learning-srs.spec.js`
- focused real-stack fixtures/specs for later guarded execution

#### In Scope

- Accessible public/private reachability, locked-only/orphan exclusion, exact-ID dedupe, same-spelling/different-ID behavior.
- 0/<10/10/>10 due candidates, future boundary, concurrent eligibility/access change.
- Four ratings, `AGAIN` requeue, revision/replay, explicit continuation, XP/Streak preservation.
- SET/GLOBAL fixture and caller compatibility.
- Proof of no CEFR completion/unlock mutation.

#### Out of Scope

- Running formal TEST/CI/database verification now.
- Replacing scheduler tests or introducing a new harness without documented need.

#### Acceptance Criteria

- Focused tests represent all approved global review success/failure paths.
- Existing per-Set SRS and sessionless callers remain covered.
- No test relies on client time, raw displayed status, or Daily Goal.
- Formal guarded evidence is listed as NOT RUN pending authorization.

#### Development Verification

- Development unit/mock checks only after IMPLEMENT authorization.

## 6. Integrated Documentation and Closure Gates

### TASK-014: Synchronize active documentation and complete the Legacy/Regression Impact Scan

#### Objective

After implementation stabilizes, synchronize authoritative documentation with actual verified contracts and inventory every affected caller, fixture, route, selector, schema assumption, and legacy behavior.

#### Dependencies

- TASK-006, TASK-010, and TASK-013 implementation complete
- Actual implementation behavior available for documentation; do not pre-document unimplemented deviations

#### Files / Modules

- `docs/ARCHITECTURE.md`
- `docs/DATABASE.md`
- `docs/API_SPEC.md`
- `docs/UI_UX_SPEC.md`
- `docs/PROJECT_OVERVIEW.md` only if required
- `docs/FEATURE_STATUS.md` according to workflow status, never prematurely `DONE`
- affected test fixtures/routes/selectors identified by the scan

#### In Scope

- Pass/path/session scope, endpoints/errors, UI states, deferred-to-active Dashboard/Review wording.
- Explicit no-backfill, A1–C1, no `is_required`, no Daily Goal dependency.
- Legacy impact inventory for Learning Session, Learning, SRS, Quiz, Speaking, XP, Streak, Dashboard, Set ownership/copy, and existing API callers.

#### Out of Scope

- Rewriting unrelated docs or changing Daily Goal V1.
- Marking the feature `DONE` before formal TEST, REVIEW, and HUMAN acceptance.

#### Acceptance Criteria

- Documentation matches implemented/verified behavior with no speculative contract.
- All active callers and fixtures understand SET/GLOBAL session scope.
- Deferred Continue Learning/Words to Review wording is reconciled only for implemented V1 scope.
- FEATURE_STATUS reflects the correct workflow state and preserves completed feature evidence.

#### Development Verification

- Static cross-reference, link, status, diff, and terminology checks.

### TASK-015: Execute separately authorized formal TEST, UI/UX Review, formal REVIEW, and HUMAN closure

#### Objective

Provide the final evidence and approval gates required before closure. This task is defined now but cannot execute without separate authorization for each applicable stage.

#### Dependencies

- TASK-001 through TASK-014 complete
- Explicit HUMAN authorization for guarded migration/database/formal TEST execution

#### Files / Modules

- existing and new focused test suites identified above
- guarded isolated migration/PostgreSQL/real-stack harnesses
- future TEST report and REVIEW report paths following repository conventions
- `ui-ux-review` skill in Focused mode for changed UI flows

#### In Scope

- Guarded isolated migration verification and no-backfill/data-preservation checks.
- Backend/frontend/browser/real-stack focused suites and scoped regressions.
- Concurrency, cross-user, direct-bypass, mutable curriculum, terminal entitlement, global review, XP/Streak/session compatibility.
- Focused UI/UX Review after functional evidence.
- Formal TEST verdict, formal REVIEW including Legacy/Regression Impact Scan, and HUMAN final acceptance.

#### Out of Scope

- Main, Preview, Production, shared development, or Daily Goal database use unless separately and explicitly authorized in a later deployment workflow.
- Commit, push, merge, deployment, or automatic `DONE` status.

#### Acceptance Criteria

- Exact PASS/FAIL/NOT RUN counts and environment identity are recorded truthfully.
- Migration and cleanup preserve unrelated TEST data and prove no historical completion backfill.
- Formal REVIEW finds implementation consistent with approved SPEC/PLAN/TASK and security boundaries.
- UI/UX Review remains a separate verdict from TEST/REVIEW.
- Feature becomes eligible for `DONE` only after HUMAN accepts all required evidence and documentation.

#### Formal Verification

- NOT RUN and NOT AUTHORIZED by this TASK-authoring request.
- Execute only after explicit HUMAN authorization and required implementation approvals.

## 7. Cross-Cutting Execution Rules

- TASK-001 through TASK-015 are HUMAN-approved as a structure, but executing any task requires separate explicit HUMAN authorization for a bounded IMPLEMENT scope.
- Approval/execution of one workstream does not authorize another.
- Development checks performed during IMPLEMENT do not replace formal TEST.
- Migration creation may occur only during approved IMPLEMENT; migration application, Prisma generation, and database verification require their explicitly authorized guarded stage.
- Preserve unrelated tracked/untracked files and coordinate shared-file work.
- Do not modify, merge, depend on, or test against Daily Goal V1.
- Do not add dependencies, roles, services, C2, `is_required`, analytics/history, notifications, scheduler changes, or unrelated refactors.
- Stop and return to PLAN if implementation requires changing model responsibilities, endpoint behavior, session-scope architecture, or any of the seven approved technical decisions.
- Stop and return to SPEC if a business rule becomes ambiguous or must change.

## 8. Traceability Checklist

- [x] Full ordered NORMAL pass and bounded batches: TASK-001–004, TASK-008.
- [x] Durable reveal evidence, explicit completion, resume/restart/idempotency: TASK-002–004, TASK-008.
- [x] A1–C1 sequential/monotonic projection and terminal entitlement: TASK-001–004.
- [x] Current curriculum mutation, zero/empty states, and no backfill: TASK-001–006.
- [x] Shared locked public activity authorization and private-copy preservation: TASK-005–006.
- [x] Highest-unlocked Dashboard recommendation and truthful states: TASK-007, TASK-009–010.
- [x] Global accessible exact-ID-deduplicated SRS review: TASK-011–013.
- [x] Existing Learning Session/SRS/Quiz/Speaking/XP/Streak compatibility: TASK-005–006, TASK-011–015.
- [x] Documentation, Legacy/Regression Impact Scan, UI/UX Review, formal TEST/REVIEW, HUMAN acceptance: TASK-014–015.
- [x] No C2, `is_required`, Daily Goal dependency, or unapproved scope expansion: all tasks.

## 9. Historical HUMAN TASK Approval Gate — 2026-11-03

```text
SOURCE SPEC: HUMAN-APPROVED — 2026-11-03
SOURCE PLAN: HUMAN-APPROVED — 2026-11-03
TASK STATUS: HUMAN APPROVED — 2026-11-03
HUMAN TASK APPROVAL: GRANTED — TASK-001 THROUGH TASK-015
IMPLEMENTATION AUTHORIZED: NO
TEST / DATABASE / MIGRATION EXECUTION AUTHORIZED: NO
COMMIT / PUSH / MERGE / DEPLOYMENT AUTHORIZED: NO
NEXT ALLOWED ACTION: Obtain separate explicit HUMAN authorization for a bounded IMPLEMENT scope
```

## 10. HUMAN Final Acceptance and Closure — 2026-11-05

The HUMAN explicitly decided:

> HUMAN FINAL ACCEPTED — CEFR Learning Path V1, accepting the publicly disclosed verification limitations. Prepare the separate DONE status update. Do not merge or deploy.

### Accepted evidence

- Final Gate 2 run `41974809164`: `149/149 PASS`, `0 FAIL`, `0 SKIP` across backend offline, frontend offline, mocked Chromium, backend PostgreSQL 17, and real-stack Chromium.
- Final tested source: `309d46179ec05d4af429c27107080a4cedb1304a`.
- Final workflow: `c3ec2b02f82e8cb50539c7b6c23f11f24aa2dac7`.
- Final TASK-014 documentation publication: `2f82e0d22ba79c084dff40dcbfc4a28dbc56b3be` on `refs/heads/verification/cefr-learning-path-v1-phase-c`.
- Formal REVIEW documentation findings MEDIUM-01 and MEDIUM-02 are resolved; the final TASK-014 read-only re-review found its acceptance criteria satisfied and returned `READY_FOR_HUMAN_FINAL_ACCEPTANCE`.
- The prior HUMAN UI/UX approval within the documented reviewed scope is accepted as part of final closure.

### Accepted disclosed limitations

- Actual Chrome browser-level 200% zoom remains unverified and is not represented as PASS.
- The dedicated Quiz and Speaking locked-state UI E2E specs were not selected by final Gate 2 run `41974809164`.
- Earlier focused verification evidence exists for those UI corrections: `62/62` focused offline PASS and `26/26` focused mocked Chromium PASS. This earlier evidence is not represented as newly executed final Gate 2 coverage.

### Integration boundary

- This HUMAN acceptance closes the approved CEFR Learning Path V1 feature workflow and authorizes the separate local DONE status record only.
- No merge, deployment, Production verification, additional CI dispatch, or database operation is recorded or implied.
- Publication and integration of this closure documentation require separate authorization.
