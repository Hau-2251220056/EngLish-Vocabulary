# PLAN: Review Experience V1

> Status: **HUMAN APPROVED — 2026-11-07**
> Basis: HUMAN-approved `docs/specs/REVIEW_EXPERIENCE_V1_SPEC.md`
> This PLAN approval does not authorize TASK approval, Batch 1 or Batch 2 implementation, tests, commit, push, merge, deployment, feature-status changes, or any other approval record.

## Approval Record

HUMAN approved this frontend-only two-batch technical PLAN on 2026-11-07: Batch 1 covers navigation, Review Center and GLOBAL/SET route functionality; Batch 2 covers presentation-only shared Flashcard reuse. TASK, Batch 1, Batch 2, commit/push and merge retain independent explicit HUMAN approval gates.

## 1. Technical Objective

Reorganize the existing frontend review experience around a non-mutating Review Center while preserving all backend-authoritative GLOBAL and SET SRS behavior. The implementation is frontend-only and split into a low-coupling navigation/routing batch followed by a presentation-reuse batch.

## 2. Existing Implementation to Reuse

| Responsibility | Existing implementation | Reuse decision |
|---|---|---|
| USER route protection | `frontend/src/app-router.jsx`, `UserRoute` | Keep unchanged; add/move USER routes inside the same guard |
| Sidebar link behavior | `frontend/src/auth/ui/authenticated-shell.jsx`, `navigationLink` | Reuse for HỌC TẬP links and mobile drawer behavior |
| Dashboard review data | `DashboardPage`, `ReviewSummary`, `learningService.getGlobalReviewSummary` | Keep independent source and API; change CTA destination/copy only |
| Global session logic | `global-review-page.jsx`, `global-review-session.js` | Preserve creation, restore, retry, queue and state handling; move route only in Batch 1 |
| SET SRS session logic | `LearningFoundationPage`, `srs-learning-session.js`, learning/session services | Reuse without backend or scheduler changes |
| Flashcard interaction | `LearningFoundationPage`, `learning-presentation.js`, existing CSS/Tailwind classes | Extract presentation-only UI in Batch 2 without moving authoritative state |
| API validation | `frontend/src/services/learning-service.js`, `learning-session-service.js` | No contract change |
| Existing tests | global-review, SRS learning, learning presentation/run state, Dashboard, route guards | Extend focused coverage; retain regression suites |

## 3. Route Plan

| Route | Component after change | Notes |
|---|---|---|
| `/review` | new `ReviewCenterPage` | Read/navigation-only; must not create a Global session |
| `/review/global` | existing `GlobalReviewPage` | Existing session behavior preserved |
| `/review/sets/:setId` | `LearningFoundationPage` through minimal route-derived review context | Dedicated SET SRS frontend alias; no new controller or backend session type |
| `/learn/vocabulary-sets/:setId` | existing `LearningFoundationPage` | Normal entry remains unchanged |
| `/my/learning-progress` | existing `LearningProgressPage` | No redesign |

No collision exists with `/review/global` or `/review/sets/:setId`. The wildcard route and public `/topics`/`/vocabulary-sets` routes remain unaffected.

### Dedicated SET review route and minimal adapter boundary

Register `/review/sets/:setId` as a second USER-guarded route rendering the existing `LearningFoundationPage`. The URL match, not `location.state`, must provide a stable `reviewContext` input on direct navigation/reload. The minimal adapter may be a small route wrapper or an explicit prop supplied by a dedicated lazy-route export; it must only establish presentation/orchestration context.

Source inspection establishes a required adaptation rather than drop-in compatibility: `LearningFoundationPage` currently derives initial mode from transient `location.state` and stored `active_mode`, exposes `switchMode`, renders the toggle unconditionally, offers **Ôn tập thường** in SRS up-to-date/completion state, and defaults return navigation from `location.state`. Therefore the review-context boundary must:

- override initial/requested mode to `SRS` even if stored run state says `NORMAL`;
- prevent `switchMode("NORMAL")` through review-context UI paths;
- omit the mode toggle and Normal CTA in review context;
- use `/review` as the stable default return path;
- continue using the same USER/Set/`SRS` storage/session identity and services;
- leave the standard learning route's state initialization, toggle and Normal/SRS behavior unchanged.

No separate SET controller/page state machine is created. The adapter cannot select cards, bypass authorization, change API payloads or become backend truth.

## 4. Review Center Data Plan

### Global option

- Reuse `GET /api/learning/review` only if the center needs to display the already-authoritative global due state.
- Starting Global Review is an explicit link/button to `/review/global`.
- Merely rendering `/review` must never call `POST /api/learning/review/sessions`.

### Review by Set option

- Load `vocabularySetService.listMySets()` for USER-owned personal/private Sets.
- Compose existing public discovery sources—`topicService.listTopics()` followed by topic-scoped `vocabularySetService.listPublicSystemSets(topicId)`—for public Set candidates.
- Existing public discovery does not expose one endpoint for all currently reviewable public Sets or an explicit exact-Set entitlement. A `cefr_level` value alone is not reliable lock evidence. Do not derive entitlement by joining CEFR metadata with another response or implementing a client-side authorization calculation.
- If an already-existing response inspected during implementation supplies explicit, sufficiently reliable lock state for the exact Set, display that state and disable its review action. Otherwise present the public Set with neutral candidate wording and let the SET SRS request enforce current access.
- Deduplicate combined/list-source results by exact Set UUID. Do not deduplicate by name or metadata.
- Keep personal and public source state independently observable: render successful sibling data on partial failure, show source-scoped retry/error, show a combined empty state only after both sources succeed empty, and a page-level error only when no usable source succeeds.
- Display only data already supplied by those sources, such as Set name/description/item count where available.
- Do not calculate or display a due count.
- Selection navigates to `/review/sets/:setId` and the backend revalidates access when the existing SET SRS flow opens.
- Loading, empty, error and retry states remain scoped to the Set option and do not disable the Global option.

### API gap

No endpoint returns due counts grouped by Set. This plan intentionally does not add one. If per-Set due counts become mandatory, stop and return to SPEC/PLAN for a separately approved backend/API change.

## 5. Batch 1 — Navigation, Center and Route Move

### 5.1 Files to modify

- `frontend/src/app-router.jsx`
  - lazy-load Review Center;
  - map `/review` to center;
  - map `/review/global` to existing Global Review page;
  - map `/review/sets/:setId` to the minimal review-context adapter around `LearningFoundationPage`.
- `frontend/src/auth/ui/authenticated-shell.jsx`
  - add USER-only HỌC TẬP heading;
  - add Ôn tập and Tiến độ học tập links using existing `navigationLink` behavior/icons.
- `frontend/src/dashboard/dashboard-page.jsx`
  - change CTA copy to **Xem ôn tập**;
  - render it for every successfully loaded summary, including zero due;
  - keep destination `/review`, accurate zero-due messaging and existing independent loading/error handling.
- `frontend/src/learning/global-review-page.jsx`
  - update return navigation to Review Center where appropriate;
  - do not change session/API behavior in Batch 1.
- `frontend/src/learning/learning-foundation-page.jsx`
  - accept/derive stable route context through the minimal adapter;
  - force SRS and remove Normal-switch paths only at `/review/sets/:setId`;
  - retain the current Flashcard presentation in Batch 1; shared presentation polish remains Batch 2.

### 5.2 File to create

- `frontend/src/learning/review-center-page.jsx`
  - Review Center heading and two options;
  - global navigation;
  - personal/private and public Set sources with UUID deduplication;
  - dedicated `/review/sets/:setId` links without per-Set due counts;
  - accessible loading/empty/error/retry states;
  - no session creation side effect.

### 5.3 Focused tests

- Add a Review Center UI/route contract test following current `frontend/test/*-ui-contract.test.js` conventions.
- Update Dashboard contract/smoke coverage for CTA copy/destination with positive due count, zero due count and failed summary loading.
- Update Global Review browser tests to enter `/review/global`.
- Add direct-entry/reload tests for `/review/sets/:setId`, including prior stored NORMAL mode, forced SRS, hidden toggle and no Normal CTA.
- Add personal/public source success, empty, partial error, total error, retry, UUID deduplication and access-change coverage.
- Add sidebar USER/ADMIN navigation assertions.
- Add a negative assertion that opening `/review` does not call `POST /api/learning/review/sessions`.

### 5.4 Batch 1 verification

- Frontend unit/contract tests relevant to router, shell, Dashboard and Global Review.
- Mocked browser tests for Review Center, route move, role boundary and direct/reload navigation.
- Frontend lint/build according to existing package scripts.
- No database-backed tests are required for the frontend-only route move; existing real-stack tests are considered only at formal TEST under separate authorization.
- Focused `ui-ux-review` before HUMAN visual approval.

### 5.5 Batch 1 rollback

- Restore `/review` to `GlobalReviewPage` and remove the center/global/SET alias route changes.
- Keep existing backend and storage contracts untouched, making rollback code-only.

### 5.6 Batch 1 usability boundary

Batch 1 creates a fully functional dedicated SET review route using the current `LearningFoundationPage` presentation. It is usable for create/resume/rating/`AGAIN`/completion before Batch 2. Batch 1 does not promise extracted shared primitives or final cross-context visual polish; Batch 2 performs presentation-only reuse while preserving the already-working alias route.

## 6. Batch 2 — Presentation-only Flashcard Reuse

### 6.1 Component boundary

Extract the smallest presentation-only primitives from the mature `LearningFoundationPage`, for example:

- toolbar/header shell configurable for context;
- progress presentation;
- two-face Flashcard card with word, phonetic, audio, meaning, context and example;
- four-rating control group consuming backend-provided previews and caller-provided pending/submit state.

The extracted components must receive state and callbacks. They must not:

- fetch data;
- create/read sessions;
- own session storage keys;
- calculate eligibility, schedule or progress;
- change queue behavior;
- infer XP/Streak;
- translate GLOBAL identity into SET identity.

### 6.2 Integration targets

- `LearningFoundationPage`
  - retain existing Normal and SET SRS controllers/state;
  - use shared presentation without behavior change;
  - hide the toggle only in explicit review context;
  - keep standard learning entry and Normal mode unchanged.
- `GlobalReviewPage`
  - retain `global-review-session.js` and current state machine;
  - render shared Flashcard presentation;
  - continue using GLOBAL-specific cards, queue, event replay and state screens.

### 6.3 Styling strategy

- Prefer extracting current classes/styles with selectors stable enough for current tests.
- Avoid copying scheduler or state logic to achieve visual similarity.
- Preserve focus-visible, keyboard reveal, disabled/pending, responsive two-column rating fallback, and reduced-motion behavior.
- Do not add a dependency or global redesign.

### 6.4 Batch 2 test strategy

- Shared presentation unit/contract tests for front/back content, reveal state, rating labels/previews, pending disablement and accessible names.
- GLOBAL regression: create, resume, idempotent retry, `AGAIN`, completion, empty/future, expired/inaccessible and explicit continuation.
- SET SRS regression: session create/resume, fixed snapshot, rating retry/conflict, `AGAIN`, completion, XP/Streak projection handling.
- Normal Flashcard regression: mode selection, reveal, previous/next, completion, restart, keyboard behavior and no SRS mutation.
- Route/context regression: standard learning route still exposes existing toggle; review-context SET session does not.
- Focused responsive/accessibility browser checks and `ui-ux-review`.

### 6.5 Batch 2 rollback

- Revert shared presentation integration while retaining original controllers and state modules.
- If Normal Flashcard behavior regresses, restore its original inline presentation first; GLOBAL can temporarily retain its existing simple presentation without backend impact.

## 7. Backend, Database and API Plan

No changes.

- No backend routes, middleware, controllers, services or repositories.
- No Prisma schema/client changes.
- No migration or database access.
- No API contract or error-code change.
- No authorization or ownership change.
- No scheduler, XP, Streak, CEFR or session-persistence change.

Any implementation discovery that requires one of these changes blocks the affected task and returns to SPEC/PLAN approval.

## 8. State and Identity Safeguards

- Preserve existing GLOBAL storage keys and restore validation.
- Preserve existing SET learning storage namespaces keyed by USER/Set/mode.
- Review-context presentation flags must not be persisted as backend truth.
- Direct navigation and reload must reconcile against backend session state as today.
- No automatic rating replay beyond the existing event-ID retry mechanism.
- Do not clear unrelated application/session-storage namespaces.

## 9. Documentation Impact

After implementation and verification—not during this draft-only stage—update only documents whose active UX/route statements became inaccurate:

- `docs/UI_UX_SPEC.md`: Review Center, sidebar and route mapping;
- `docs/PROJECT_OVERVIEW.md`: Dashboard action and review navigation if required;
- `docs/ARCHITECTURE.md`: frontend route/presentation composition only if material;
- `docs/API_SPEC.md`: no contract change; route-neutral frontend wording only if an active section incorrectly equates `/review` with session creation;
- `docs/FEATURE_STATUS.md`: only after TEST + REVIEW + HUMAN approval under separate authorization.

## 10. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| `/review` route move silently creates a session | Center has no create call; negative test asserts no POST |
| Old tests/bookmarks expect session at `/review` | Update active tests/docs; `/review` intentionally becomes center |
| GLOBAL resume breaks after URL move | Keep storage keys/session service unchanged; test reload/direct entry |
| SET alias accidentally duplicates learning logic | Route wrapper passes context only; delegate all controller/state/API behavior to `LearningFoundationPage` |
| Stored NORMAL mode leaks into direct SET review | URL-derived context overrides requested mode to SRS without deleting separate NORMAL state |
| Public discovery implies access it cannot prove | Use neutral candidate wording and let existing SET SRS authorization/CEFR gate decide on open |
| Frontend invents CEFR entitlement from metadata | Disable only from explicit reliable existing lock data; otherwise make no unlocked claim and perform no client entitlement calculation |
| Duplicate Set from multiple sources | Deduplicate by exact Set UUID and retain deterministic source presentation |
| Zero-due Dashboard hides Review Center | Render **Xem ôn tập** on every successful summary while preserving truthful zero-due copy |
| Review context accidentally changes Normal | Presentation flag is explicit and tested; standard route regression remains mandatory |
| Shared component couples GLOBAL and SET state | Components accept data/callbacks only; controllers remain separate |
| Per-Set count is misleading | Render no count; document API gap |
| Role/access regression | Keep routes under `UserRoute`; test ADMIN and Guest behavior |
| Visual extraction changes accessibility/selectors | Preserve semantics and focused UI/UX/browser checks |

## 11. Implementation Order and Gates

1. HUMAN reviews the resolved design inputs and explicitly approves SPEC.
2. HUMAN reviews/approves this PLAN.
3. HUMAN reviews/approves TASK draft and explicitly authorizes Batch 1.
4. Implement Batch 1 within its allowlist.
5. Run authorized non-DB verification, focused UI/UX review, formal TEST and REVIEW.
6. HUMAN accepts Batch 1 and explicitly authorizes Batch 2.
7. Implement Batch 2 within its allowlist.
8. Run regression verification, focused UI/UX review, formal TEST and REVIEW.
9. HUMAN separately authorizes any documentation/status update, commit and push.
10. HUMAN separately authorizes merge/deployment. No prior gate implies a later one.

## 12. Resolved Design Inputs and Remaining Gate

- RE-001 resolved: Review Center uses both USER-owned personal/private Sets and accessible public Set candidates through existing contracts, exact-UUID deduplication and backend-authoritative access on open.
- RE-002 resolved: `/review/sets/:setId` is the dedicated frontend alias and derives context from the URL while reusing `LearningFoundationPage` and existing SET SRS identity/state.

No material design question remains in these two areas. Implementation is still blocked until the SPEC, PLAN and TASK documents, followed by Batch 1, receive their separate explicit HUMAN approvals.

---

## DRAFT AMENDMENT — Due-only Review Center implementation plan

> Amendment status: **HUMAN APPROVED — 2026-11-08 / IMPLEMENTATION NOT AUTHORIZED**
> The approved 2026-11-07 PLAN and approval record above remain unchanged historical evidence. This plan amendment requires its own HUMAN approval and does not authorize backend, frontend, tests, commit, push or merge.

### Amendment Approval Checkpoint

HUMAN approved this PLAN Amendment on 2026-11-08 for the backend read-only `GET /api/learning/review/center`, the due-only Review Center frontend, the approved multi-Set attribution rule, authoritative due counts derived from persisted learning progress, removal of public/private Set groupings, the **Ôn tất cả** CTA, and the specified backend/frontend verification. Batch 2 shared Flashcard presentation remains separate and unauthorized. This approval does not approve the TASK Amendment, implementation, database or Prisma operations, tests, CI, commit, push, merge or deployment.

### PA.1 Audit conclusion and technical boundary

The current frontend-only plan cannot truthfully deliver the revised due-only Set list:

- existing `GET /api/learning/review` supplies the authoritative unique global count only;
- Set discovery supplies metadata but no USER due state;
- `GET /api/learning/sets/:setId?mode=SRS` includes unstarted `NEW` items and cannot be fanned out across candidate Sets to synthesize Review Center counts;
- session-creation endpoints remain prohibited as discovery mechanisms.

The smallest safe design is a dedicated authenticated read endpoint, `GET /api/learning/review/center`, that reuses the existing scheduler evaluation and GLOBAL reachability rules at one `evaluated_at`. It returns the global summary plus positive-due Set groups without creating a session. Extending the Dashboard's existing summary endpoint was rejected for this draft because it would add Set-group query cost and coupling to every Dashboard load.

### PA.2 Workstream A — Review Center due-only redesign

Dependencies: approved Workstream B contract and implementation, followed by separate frontend authorization.

Proposed frontend files:

- `frontend/src/learning/review-center-page.jsx` — replace source-group discovery UI with the approved title, global due section, ungrouped positive-due Set list, empty/error/retry states and learning return path.
- `frontend/src/services/learning-service.js` — add strict validation/client method for the approved center-summary contract.
- focused Review Center unit/browser contracts under existing frontend test locations.

Rules:

- fetch summary data only through the approved read endpoint;
- do not call Set discovery or per-Set learning endpoints to derive counts;
- do not create a GLOBAL or SET session on mount;
- render API error separately from zero due;
- preserve `/review/global`, `/review/sets/:setId`, route guards and existing Dashboard behavior;
- consume global `due_count` directly from the API and never calculate it by summing Set counts;
- use **Ôn tất cả**, not **Ôn tập toàn cục**, in user-facing Review Center copy.

Verification proposal:

- positive global count and positive-due Set groups;
- zero due and approved empty copy/navigation;
- endpoint loading/error/retry and malformed-response rejection;
- overlapping membership fixture consistent with the approved grouping rule;
- assertions that global count deduplicates by `vocabulary_id`, each Set count deduplicates by `(set_id, vocabulary_id)`, and summed Set counts may exceed but never derive the global count;
- no session POST or per-Set SRS fan-out on center load;
- USER/ADMIN/Guest routing, mobile, keyboard, focus and screen-reader states;
- focused `ui-ux-review` before HUMAN visual acceptance.

### PA.3 Workstream B — Read-only Review Center API extension

This workstream is **not part of the previously authorized Batch 1 implementation** and needs explicit backend/API authorization.

Proposed narrow backend allowlist:

- `backend/src/routes/learning-routes.js`
- `backend/src/controllers/learning-controller.js`
- `backend/src/services/learning-service.js`
- `backend/src/repositories/learning-repository.js`
- focused learning service/repository/HTTP tests
- `docs/API_SPEC.md` only after contract approval and under separate documentation authorization

No Prisma schema, generated client, migration or database change is planned.

Implementation outline:

1. Capture one backend `evaluated_at` and obtain current unlocked CEFR levels through the existing learning-path repository.
2. Query persisted USER progress joined to accessible Set memberships and minimal Set metadata. Do not include missing progress rows.
3. Reuse `evaluateProgress`; do not reproduce due logic in SQL or frontend.
4. Build a distinct global due vocabulary set deduplicated by `vocabulary_id` and positive-due Set groups deduplicated by `(set_id, vocabulary_id)`.
5. Apply the HUMAN-approved multi-Set attribution rule explicitly: include a vocabulary in every accessible containing Set only when persisted progress exists and the scheduler classifies it as due at the shared evaluation instant; do not introduce a canonical source Set.
6. Return the proposed read-only response without session creation or mutation.

Backend tests must cover authentication/USER authorization, public unlocked/private-owned reachability, locked/inaccessible exclusion, established-progress-only behavior, due/future/legacy schedules, zero due, overlap behavior, global `vocabulary_id` deduplication, per-Set `(set_id, vocabulary_id)` deduplication, non-additive Set totals, one evaluation instant and absence of writes/session creation. API contract and error-shape tests are required. Scheduler behavior, session semantics, shared `(user_id, vocabulary_id)` progress and the 1–10 due-word session limit remain unchanged.

### PA.4 Workstream C — Existing Batch 2 presentation work

The approved presentation-only extraction and GLOBAL/SET integration intent remains unchanged. It stays separately gated after the amended Review Center and API work are tested and accepted. Workstream C cannot absorb scheduler, API, grouping or due-count logic.

### PA.5 Ordering and rollback

```text
HUMAN AMENDED SPEC DECISIONS
            |
            v
HUMAN AMENDED PLAN + TASK APPROVAL
            |
            v
WORKSTREAM B: READ-ONLY API -> TEST/REVIEW
            |
            v
HUMAN FRONTEND GATE
            |
            v
WORKSTREAM A: DUE-ONLY CENTER -> UI/UX + TEST/REVIEW
            |
            v
HUMAN BATCH 2 GATE -> WORKSTREAM C
```

Rollback is code-only: remove the new GET route/client use and restore the already implemented Review Center. No database rollback exists because no persistence change is allowed. The original Batch 1 implementation remains preserved but unaccepted while the amendment is reviewed.

### PA.6 Decision checkpoint, remaining gates and risks

- **HUMAN DECISION APPROVED — 2026-11-08:** global due count deduplicates by `vocabulary_id`; each Set count deduplicates by `(set_id, vocabulary_id)` after persisted-progress, due-at-`evaluated_at`, membership and existing access checks. One vocabulary may contribute to every accessible containing Set, so Set totals may exceed the unique global count and the frontend must never sum them to derive it. Shared `(user_id, vocabulary_id)` progress remains authoritative; no canonical source Set is introduced.
- This is a decision-level checkpoint only. The amendment, read-only API contract, amended PLAN/TASK, implementation, tests and Git operations retain their separate HUMAN gates.
- A single read endpoint is required to avoid inconsistent evaluation instants and partial N+1 results.
- Query design must avoid multiplying global counts across memberships and must remain bounded without loading unnecessary Meaning/Example content.
- CEFR/access changes between center load and Set open remain possible; the existing SET request remains final authority and must show the existing inaccessible/empty state safely.
- The endpoint may become more expensive as membership grows; focused query-shape/performance review is required, without adding speculative caching.

No other design decision is marked OPEN in this amendment. No amended work may begin until the remaining amendment approval gates are explicit.

## AMENDMENT PLAN — Review Center Set scope and focused UI polish

> Amendment status: **HUMAN APPROVED — 2026-11-08 / IMPLEMENTATION NOT AUTHORIZED**
> This conditional plan is non-executable and preserves all prior approval gates.

### RP.1 Smallest technical boundary

The existing `GET /api/learning/review/center` flow remains the single data source. The change is additive: project existing Set visibility into `set_scope`, validate that field in the frontend service, and present it with explanatory copy and focused layout improvements.

No route, controller, authentication middleware, scheduler, session service, database schema or migration change is planned.

### RP.2 Backend and API work

- `backend/src/repositories/learning-repository.js`: include the existing `is_public` value in the internal accessible-Set projection used by Review Center.
- `backend/src/services/learning-service.js`: map each authorized Set to `set_scope: "PUBLIC" | "PERSONAL"`; retain existing due-count calculation and omit internal ownership data from the response.
- Preserve one evaluation timestamp, persisted-progress filtering, multi-Set attribution, CEFR/access enforcement and positive-due filtering.
- Extend the existing API response contract only; do not create a route or change request parameters/errors.

### RP.3 Frontend work and visual direction

- `frontend/src/services/learning-service.js`: require and validate the two-value `set_scope` enum without deriving it client-side.
- `frontend/src/learning/review-center-page.jsx`: render the corresponding Vietnamese scope label, lightweight count explanations and a focused ELVocab Review Center polish.
- Keep the statistics card compact on desktop and full-width on mobile; keep Set cards as the primary content with clear name/scope/count/action hierarchy.
- Use the existing typography and blue design language, restrained decoration, consistent spacing, resilient wrapping and aligned actions.
- Preserve semantic headings, focus-visible treatment, hover feedback and responsive layouts at 320px, 768px and desktop widths.
- Preserve loading, error, retry, empty and positive-due behavior, exact Set UUID keys and existing navigation.

The design guidance is intentionally bounded to `/review`; it does not authorize a Dashboard, Progress or Flashcard redesign.

### RP.4 Focused verification strategy

- Backend Review Center contract tests: enum derivation for accessible public and owned personal Sets, no owner leakage, unchanged count attribution and zero-due behavior.
- Frontend service tests: accept both enum values and reject missing/unknown values without synthesizing a classification.
- Frontend UI contract tests: labels, explanatory copy, long names, state preservation, exact Set navigation and backend-authoritative counts.
- Existing Review Center E2E assertions: scope labels, CTA destination and loading/empty/error coverage; execution remains subject to separate test authorization.
- Scoped lint/tests, responsive static review, focused `ui-ux-review` and `git diff --check` during an authorized implementation verification stage.
- Regression coverage must preserve the BUG-01 SET SRS loading repair and existing Normal/Global flows.

### RP.5 Rollback and gates

Rollback removes the additive service projection/validation and presentation changes; no data rollback is needed. HUMAN approved the SPEC, PLAN and additive API-contract direction on 2026-11-08. TASK-RE-A07 through TASK-RE-A10 execution, implementation, testing, HUMAN visual acceptance, commit/push and merge retain independent explicit gates. Batch 2 remains separate and unauthorized.
