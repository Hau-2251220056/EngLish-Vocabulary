# TASKS: Review Experience V1

> Status: **HUMAN APPROVED — 2026-11-07 / IMPLEMENTATION NOT AUTHORIZED**
> Depends on explicit HUMAN approval of the SPEC and PLAN.
> Task preparation does not authorize implementation, tests, commit, push, merge, deployment, database access, CI dispatch, or approval-record updates.

## Approval Record

HUMAN approved the eight task definitions TASK-RE-001 through TASK-RE-008 on 2026-11-07. This approval does not authorize Batch 1, Batch 2, implementation, tests, commit, push, merge, deployment, database access, CI dispatch, or any other approval-record update.

## 1. Overview

These conditional tasks implement the frontend-only Review Experience V1 in two gated batches. Existing SRS, session, API, persistence and Normal Flashcard behavior are reused rather than rebuilt.

Related capabilities are currently `DONE`; this task list covers only the proposed enhancement after its resolved design inputs and approval gates are satisfied.

## 2. Preconditions

- HUMAN approves `REVIEW_EXPERIENCE_V1_SPEC.md`.
- HUMAN approves `REVIEW_EXPERIENCE_V1_PLAN.md`.
- HUMAN approves this task list and explicitly authorizes Batch 1.

Design inputs RE-001 and RE-002 are resolved: the center includes both personal/private and accessible public Set candidates, and SET review uses `/review/sets/:setId`. These design selections do not satisfy any document or implementation approval gate.

No task below may begin before these preconditions are met.

## 3. Dependency Graph

```text
HUMAN SPEC + PLAN + TASK APPROVAL
                 |
                 v
TASK-RE-001 -> TASK-RE-002 -> TASK-RE-003
                                  |
                                  v
                             TASK-RE-004
                                  |
                         BATCH 1 TEST/REVIEW
                                  |
                         HUMAN BATCH 2 GATE
                                  |
                                  v
TASK-RE-005 -> TASK-RE-006 -> TASK-RE-007
                                  |
                                  v
                             TASK-RE-008
                                  |
                         FORMAL TEST/REVIEW
                                  |
                 HUMAN COMMIT/PUSH/MERGE GATES
```

## TASK-RE-001: Add Review Center and dedicated GLOBAL/SET review routes

### Objective

Make `/review` a non-mutating Review Center, relocate Global Review to `/review/global`, and add `/review/sets/:setId` as a URL-stable alias into the existing SET SRS flow.

### Dependencies

- HUMAN approval preconditions.

### Files / Allowlist

- Modify `frontend/src/app-router.jsx`.
- Create `frontend/src/learning/review-center-page.jsx`.
- Modify `frontend/src/learning/global-review-page.jsx` only for route-facing return navigation/copy.
- Modify `frontend/src/learning/learning-foundation-page.jsx` only for the minimal route-derived review-context boundary in Batch 1.
- Add a narrowly scoped route wrapper/helper under `frontend/src/learning/` only if needed to pass explicit context without duplicating the page controller.

### In Scope

- Lazy-load and protect both Review routes under existing USER guards.
- Review Center shows Toàn cục and Theo bộ từ sections.
- Global option navigates explicitly to `/review/global`.
- Theo bộ từ loads both USER-owned personal/private Sets and public Set candidates through existing list/discovery contracts.
- Deduplicate results by exact Set UUID; never by name.
- Disable a public Set action only when an existing response provides explicit, sufficiently reliable lock state for that exact Set; otherwise use neutral wording and do not claim it is unlocked or reviewable.
- Do not calculate client-side CEFR entitlement from Set metadata or combined responses.
- Set selection navigates to `/review/sets/:setId` without a per-Set due count.
- URL-derived SET review context survives direct navigation/reload, forces SRS, hides the toggle and removes Normal-switch actions.
- Reuse the existing `LearningFoundationPage`, SET SRS run/session storage identity, services and API payloads.
- Preserve Global page state machine and API calls.

### Out of Scope

- Shared Flashcard presentation extraction.
- Backend/API/session changes.
- Per-Set due counts.
- A duplicate SET review controller or state machine.

### Acceptance Criteria

- `/review` renders the center and performs no Global session-creation request.
- `/review/global` renders the existing Global flow.
- `/review/sets/:setId` renders the existing SET SRS flow in review context on link navigation, direct navigation and reload.
- Standard `/learn/vocabulary-sets/:setId` keeps its existing SRS/Normal toggle and behavior.
- Prior stored NORMAL mode cannot switch the dedicated SET review route out of SRS and is not destructively erased.
- Personal/public sources provide truthful loading, empty, partial-error, total-error and retry behavior; successful sibling data remains usable.
- Public discovery candidates are not described as authoritatively reviewable before the existing SRS access check succeeds.
- Explicitly locked candidates are non-actionable only when supported by reliable existing API data; uncertain candidates remain neutrally described and backend denial maps to existing locked/not-found/inaccessible states.
- ADMIN/Guest behavior follows existing guards.
- No route collision or wildcard regression is introduced.

### Verification

- Focused router/Review Center contract tests.
- Mocked browser direct-navigation and role-boundary tests.
- Direct-entry/reload test for `/review/sets/:setId`, including stored NORMAL mode, forced SRS and hidden Normal controls.
- Personal/public source and exact-UUID deduplication tests.
- Public candidate tests cover explicit reliable lock state, uncertain neutral state, disabled locked action and backend access denial without client-side entitlement inference.
- Static check that Review Center imports/calls no session-creation operation on mount.

## TASK-RE-002: Add USER HỌC TẬP sidebar navigation

### Objective

Expose Review Center and the existing Learning Progress page through a dedicated USER sidebar group.

### Dependencies

- TASK-RE-001.

### Files / Allowlist

- Modify `frontend/src/auth/ui/authenticated-shell.jsx`.
- Modify/add only focused shell/navigation tests.

### In Scope

- Add HỌC TẬP heading.
- Add Ôn tập → `/review`.
- Add Tiến độ học tập → `/my/learning-progress`.
- Reuse `navigationLink`, active-state, drawer-close and focus conventions.

### Out of Scope

- Shell/sidebar redesign.
- ADMIN navigation changes.
- Learning Progress page changes.

### Acceptance Criteria

- USER sees both links with correct destinations and active states.
- ADMIN sees neither USER learning link.
- Mobile drawer navigation remains keyboard/focus usable.

### Verification

- Focused USER/ADMIN shell tests.
- Responsive mocked browser navigation check.

## TASK-RE-003: Redirect Dashboard review CTA to Review Center

### Objective

Change the Dashboard review action from immediate-session language to always-available Review Center navigation after a successful summary load.

### Dependencies

- TASK-RE-001.

### Files / Allowlist

- Modify `frontend/src/dashboard/dashboard-page.jsx`.
- Modify focused Dashboard unit/browser tests.

### In Scope

- CTA label **Xem ôn tập**.
- CTA destination `/review`.
- Render the CTA for positive and zero due counts whenever summary loading succeeds.
- Preserve accurate zero-due copy and existing independent loading/error behavior.
- Preserve existing independent global-review summary loading/error behavior and authoritative displayed data.

### Out of Scope

- Dashboard redesign.
- New Dashboard endpoint or data.
- SRS session creation from Dashboard.

### Acceptance Criteria

- Selecting the CTA opens Review Center.
- Positive due count shows authoritative due messaging and **Xem ôn tập**.
- Zero due count shows accurate completed/up-to-date messaging and still shows **Xem ôn tập**.
- Failed summary loading retains the existing scoped error/retry behavior and does not fabricate due data or a successful-summary state.
- No Global session POST occurs because of CTA navigation alone.
- Dashboard sibling sections remain independent on review-summary failure.

### Verification

- Dashboard contract tests for text/destination with positive due count and zero due count.
- Dashboard failure test for existing independent scoped error behavior.
- Mocked browser assertion that navigation does not create a session.

## TASK-RE-004: Complete Batch 1 focused tests and review evidence

### Objective

Verify navigation, role boundaries, center states, route relocation, and preservation of current Global behavior before Batch 2.

### Dependencies

- TASK-RE-001 through TASK-RE-003.

### Files / Allowlist

- Relevant existing/new files under `frontend/test/`.
- Relevant existing/new mocked specs under `frontend/e2e/auth/`.
- No DB integration test or CI configuration changes.

### In Scope

- Center no-side-effect test.
- `/review/global` create/resume/retry/empty/future/expired/inaccessible/completion tests.
- `/review/sets/:setId` link entry, direct entry, reload, create/resume, retry, access-change, up-to-date and completion tests using the existing SET SRS contracts.
- 0, 1, 9, 10 and 10+ boundary coverage at the frontend contract/mocked-browser level where proportional.
- Personal/private and public candidate loading, independent partial failure, total failure, empty, retry and exact-UUID deduplication coverage.
- Public candidate coverage for explicit reliable lock state, uncertain neutral state, disabled locked action, backend access denial and absence of client-side entitlement inference.
- Sidebar and Dashboard regression, including positive due, zero due and failed summary loading.
- Legacy route/reference scan for active `/review` session assumptions and marker-only review-context assumptions.
- Focused `ui-ux-review` and formal TEST/REVIEW reporting after authorization.

### Out of Scope

- Database-backed or real-stack execution without separate authorization.
- Approval-record or feature-status updates.

### Acceptance Criteria

- Authorized Batch 1 checks pass or failures are reported truthfully.
- No unresolved BLOCKER/HIGH finding proceeds to Batch 2.
- HUMAN explicitly accepts Batch 1 before TASK-RE-005.

### Verification

- Existing frontend test/lint/build commands as authorized.
- Focused mocked browser suite.
- Focused UI/UX review.
- Formal TEST and REVIEW reports; execution status remains `NOT RUN` for anything not authorized.

## TASK-RE-005: Extract presentation-only Flashcard primitives

### Objective

Create reusable visual components from the current mature Flashcard UI without moving session, queue, scheduler or API logic.

### Dependencies

- TASK-RE-004 completed and HUMAN Batch 2 approval.

### Files / Allowlist

- Create narrowly named presentation component file(s) under `frontend/src/learning/`.
- Modify presentation helpers/styles only when directly required.
- Add focused presentation tests.

### In Scope

- Card front/back, reveal affordance, word/phonetic/audio, primary meaning/context/example.
- Progress presentation.
- Four-rating presentation consuming caller-supplied previews, state and callbacks.
- Configurable toolbar that can omit the mode toggle.

### Out of Scope

- Data fetching, session storage, session creation/read, rating submission or queue updates.
- Scheduler calculations or rating-preview inference.
- New dependency or global CSS redesign.

### Acceptance Criteria

- Components remain stateless regarding authoritative learning behavior.
- Rating accessible names include label and backend-provided schedule label.
- Keyboard, focus-visible, responsive and reduced-motion behavior is preserved.

### Verification

- Focused component/contract tests.
- Static review that components do not import API/session services or storage modules.

## TASK-RE-006: Integrate shared presentation with Global Review

### Objective

Make `/review/global` visually match the Flashcard experience while preserving its distinct GLOBAL controller/state behavior.

### Dependencies

- TASK-RE-005.

### Files / Allowlist

- Modify `frontend/src/learning/global-review-page.jsx`.
- Modify `frontend/src/learning/global-review-session.js` only if presentation integration requires a non-behavioral adapter; otherwise leave unchanged.
- Update focused Global tests.

### In Scope

- Render GLOBAL cards through shared presentation.
- Keep existing create/restore/event replay/queue/state screens.
- No mode toggle.
- Preserve `AGAIN`, passing resolution, completion and Ôn tiếp.

### Out of Scope

- GLOBAL backend/API/storage-key changes.
- SET state reuse.

### Acceptance Criteria

- GLOBAL identity and `set_id: null` rating payload remain unchanged.
- Same-tab resume and interrupted-event replay remain safe.
- Empty/future, retry, conflict, expired, inaccessible and completion states remain reachable.
- Same-card `AGAIN` transition restores usable focus.

### Verification

- Global unit, service and mocked browser regression suites.
- Accessibility/focus checks on changed-ID and same-ID transitions.

## TASK-RE-007: Integrate shared presentation with dedicated SET review route

### Objective

Polish the already-functional `/review/sets/:setId` flow with shared presentation without changing standard Normal Flashcard or SET SRS contracts.

### Dependencies

- TASK-RE-005.
- TASK-RE-001 Batch 1 alias route and context boundary.

### Files / Allowlist

- Modify `frontend/src/learning/learning-foundation-page.jsx`.
- Modify the Batch 1 route/context wrapper only for presentation integration if required.
- Update focused learning/SRS/Normal tests.

### In Scope

- URL-derived review context continues to start/retain existing SRS behavior on direct entry/reload.
- Hide mode toggle only in review context.
- Preserve existing SET session storage identity, create/resume/rating/retry/completion.
- Preserve standard learning entry and Normal mode unchanged.
- Replace only presentation composition; Batch 1 route/controller behavior remains intact.

### Out of Scope

- New route/API/backend session kind.
- GLOBAL state reuse.
- Removal of Normal mode from standard Flashcard learning.

### Acceptance Criteria

- Review-context SET session has no SRS/Thường toggle.
- Standard learning route retains its existing toggle and Normal behavior.
- `/review/sets/:setId` remains usable independently of transient React Router state.
- Backend continues selecting at most 10 eligible SET items.
- `AGAIN` and session completion remain unchanged.

### Verification

- Existing SRS learning/session/run-state regression tests.
- Existing Normal Flashcard regression tests.
- Mocked browser comparison of standard vs `/review/sets/:setId` presentation, including direct entry/reload.

## TASK-RE-008: Complete Batch 2 regression, UI/UX review and documentation impact scan

### Objective

Verify the shared presentation did not change either behavioral contract and identify only the documentation updates justified by accepted implementation.

### Dependencies

- TASK-RE-006 and TASK-RE-007.

### Files / Allowlist

- Relevant frontend tests and mocked browser specs.
- Documentation updates only after separate HUMAN authorization and successful TEST/REVIEW.
- `docs/FEATURE_STATUS.md` excluded unless specifically authorized after approval.

### In Scope

- GLOBAL and SET regression matrix.
- Normal Flashcard regression.
- Route/navigation legacy scan.
- Accessibility, responsive and visual-consistency review.
- Report unrun DB/real-stack checks as `NOT RUN`.
- Propose synchronized UX/overview/architecture wording after behavior is verified.

### Out of Scope

- DB tests, migrations, CI dispatch, backend edits.
- Automatic status change to DONE.
- Commit, push, merge or deployment.

### Acceptance Criteria

- Formal TEST and REVIEW produce explicit results.
- Focused `ui-ux-review` completes before HUMAN visual approval.
- No accepted requirement or active contract is contradicted.
- Documentation/status changes occur only under their own authorization.

### Verification

- Authorized frontend test/lint/build commands.
- Authorized mocked browser suites.
- Formal Legacy/Regression Impact Scan across routes, navigation, selectors, fixtures, tests and active docs.
- HUMAN acceptance gate.

## 4. File Boundaries Summary

### Batch 1 application allowlist

- `frontend/src/app-router.jsx`
- `frontend/src/auth/ui/authenticated-shell.jsx`
- `frontend/src/dashboard/dashboard-page.jsx`
- `frontend/src/learning/review-center-page.jsx` (new)
- `frontend/src/learning/global-review-page.jsx` (route-facing changes only)
- `frontend/src/learning/learning-foundation-page.jsx` (minimal URL-derived SRS-only context boundary)
- one narrowly scoped route/context wrapper under `frontend/src/learning/` if required (new)
- focused frontend tests/specs

### Batch 2 application allowlist

- narrowly scoped presentation component file(s) under `frontend/src/learning/` (new)
- `frontend/src/learning/learning-foundation-page.jsx`
- `frontend/src/learning/global-review-page.jsx`
- directly related presentation helper/style file only if justified
- focused and regression frontend tests/specs

### Always excluded

- `backend/**`
- `backend/prisma/**`
- database/migration files
- API contract implementation
- dependencies/lockfiles unless separately approved
- CI workflows
- approval records and `FEATURE_STATUS.md` without separate post-review authorization

## 5. Execution and Approval Notes

- These eight task definitions are HUMAN approved; implementation remains unauthorized until the applicable Batch 1 or Batch 2 gate is explicitly approved.
- HUMAN design decisions RE-001 and RE-002 are resolved, and their execution remains subject to the batch and implementation gates below.
- SPEC approval does not approve PLAN, TASK, implementation, commit or push.
- Batch 1 approval does not approve Batch 2.
- Implementation approval does not approve commit or push.
- Commit/push approval does not approve merge or deployment.
- Any need for backend, database, Prisma, API, authorization or scheduler change stops work and returns to SPEC/PLAN.

---

## DRAFT AMENDMENT TASKS — Due-only Review Center

> Amendment status: **HUMAN APPROVED — 2026-11-08 / IMPLEMENTATION NOT AUTHORIZED**
> The approved TASK-RE-001 through TASK-RE-008 definitions and their approval record remain unchanged historical evidence. No task below is started, completed or authorized. The original Batch 1 implementation remains unaccepted pending HUMAN review.

### Amendment Approval Checkpoint

HUMAN approved the TASK Amendment definitions TASK-RE-A01 through TASK-RE-A06 on 2026-11-08, covering the read-only `GET /api/learning/review/center`, the due-only Review Center with **Ôn tất cả**, positive-due Set groups without public/private grouping, the approved multi-Set attribution rule, and required backend/frontend tests and regression verification. Existing Batch 2 shared Flashcard presentation remains separately gated and unauthorized. This approval does not start, authorize execution of, or complete any amendment task and does not authorize implementation, database or Prisma operations, tests, CI, commit, push, merge or deployment.

### Amendment gate

Before any amendment task:

1. Multi-Set due attribution is resolved by the **HUMAN DECISION APPROVED — 2026-11-08** checkpoint below; this does not authorize a task or the amendment.
2. HUMAN approves the amended SPEC, including the read-only API contract.
3. HUMAN approves the amended PLAN and these amendment tasks.
4. HUMAN explicitly authorizes the relevant backend or frontend workstream.

### TASK-RE-A01: Record multi-Set due attribution decision

**Decision checkpoint:** **HUMAN DECISION APPROVED — 2026-11-08**. This records the attribution rule only; TASK-RE-A01 is not started, authorized or completed, and the amendment remains draft.

**Approved rule:**

- Global due count deduplicates by `vocabulary_id`.
- Per-Set due count deduplicates by `(set_id, vocabulary_id)`.
- A vocabulary contributes to a Set only when persisted USER `LEARNING_PROGRESS` exists, the existing backend SRS scheduler classifies it as due at the evaluation timestamp, it belongs to the Set, and the Set is accessible under existing backend ownership, public-visibility and CEFR-authorization rules.
- One vocabulary may contribute to every accessible containing Set. Set-count sums may exceed the unique global count, and the frontend must never calculate global count by summing Set counts.
- Shared progress remains keyed by `(user_id, vocabulary_id)`; no canonical source Set is introduced.
- Scheduler behavior, session semantics and the 1–10 due-word session limit remain unchanged.

**Deliverable:** Decision wording recorded. No implementation or test execution is authorized.

### TASK-RE-A02: Add read-only Review Center summary API

**Dependencies:** TASK-RE-A01 and explicit backend/API authorization.

**Allowlist proposal:**

- `backend/src/routes/learning-routes.js`
- `backend/src/controllers/learning-controller.js`
- `backend/src/services/learning-service.js`
- `backend/src/repositories/learning-repository.js`
- focused backend learning tests

**Acceptance criteria:**

- authenticated USER-only `GET /api/learning/review/center` returns one `evaluated_at`, unique global due count and positive-due Set groups;
- only persisted USER progress participates; unstarted `NEW` vocabulary is excluded;
- existing GLOBAL reachability, CEFR entitlement and private ownership rules are reused;
- global count deduplicates by `vocabulary_id`, while each Set count deduplicates by `(set_id, vocabulary_id)` after persisted-progress, due, membership and access checks;
- one due vocabulary may contribute to every accessible containing Set, Set totals may exceed global count, and no canonical source Set is introduced;
- zero due returns an empty Set array and truthful summary;
- no session, progress, XP, Streak or other mutation occurs;
- no schema, Prisma generated-client or migration change occurs.

**Verification proposal:** service/repository/HTTP tests for authorization, due/future/legacy progress, visibility/access, global `vocabulary_id` deduplication, per-Set `(set_id, vocabulary_id)` deduplication, multi-Set contribution, non-additive Set totals, zero due, error behavior and explicit absence of mutation/session creation.

### TASK-RE-A03: Update API documentation after contract approval

**Dependencies:** TASK-RE-A02 verified and separate documentation authorization.

**Allowlist proposal:** `docs/API_SPEC.md` only, plus synchronized active architecture/UX wording only if separately authorized.

**Acceptance criteria:** Active documentation states exact request/response, authentication, established-progress-only semantics, grouping/overlap behavior, CEFR reachability, no mutation and no due-word preview.

### TASK-RE-A04: Redesign Review Center around authoritative due data

**Dependencies:** TASK-RE-A02 TEST/REVIEW acceptance and explicit frontend authorization.

**Allowlist proposal:**

- `frontend/src/learning/review-center-page.jsx`
- `frontend/src/services/learning-service.js`
- focused Review Center tests/specs

**Acceptance criteria:**

- title is **Ôn tập từ vựng** and subtitle is **Ôn lại những từ đã học để ghi nhớ lâu hơn.**;
- **Cần ôn hôm nay** displays authoritative due count and **Ôn tất cả** links to `/review/global`;
- **Ôn theo bộ từ** has no public/private groups and contains only positive-due Sets with name/count linking to `/review/sets/:setId`;
- global count is consumed directly from the API and is never calculated by summing Set counts;
- zero due shows **Bạn đã ôn xong các từ đến hạn!** and a safe learning path;
- loading, error and retry states never fabricate counts; the atomic endpoint cannot be presented as successful partial data;
- mounting/navigating the center creates no session and performs no SRS mutation;
- no Set-list/SRS N+1 requests are used to synthesize counts;
- routes and standard Normal learning behavior remain unchanged.

### TASK-RE-A05: Amended Review Center TEST/REVIEW gate

**Dependencies:** TASK-RE-A04.

**Acceptance criteria:** Authorized frontend/backend focused tests, Legacy/Regression Impact Scan and focused `ui-ux-review` pass; GLOBAL/SET engines and Dashboard behavior remain unchanged; HUMAN visually accepts the amended center. Unrun DB/real-stack checks remain explicitly `NOT RUN` unless separately authorized.

### TASK-RE-A06: Continue existing Batch 2 presentation work

**Dependencies:** TASK-RE-A05 accepted and separate HUMAN Batch 2 authorization.

TASK-RE-005 through TASK-RE-008 remain the governing presentation tasks. This amendment adds no scheduler, session, API or grouping responsibility to shared Flashcard components.

### Amendment exclusions and gates

- No database, Prisma schema/client or migration change.
- No session/scheduler/rating/XP/Streak behavior change.
- No due forecast or due-word preview.
- Backend/API implementation, frontend implementation, tests, documentation synchronization, commit/push and merge each retain separate HUMAN gates.

## AMENDMENT TASKS — Review Center Set scope and UI polish

> Amendment status: **HUMAN APPROVED — 2026-11-08 / IMPLEMENTATION NOT AUTHORIZED**
> TASK-RE-A07 through TASK-RE-A10 are definitions only. They are not executable, started or approved for implementation.

### TASK-RE-A07: Add authoritative Set scope to the Review Center projection

**Dependencies:** Separate HUMAN approval of this SPEC/PLAN/TASK amendment and explicit backend implementation authorization.

**Allowlist:**

- `backend/src/repositories/learning-repository.js`
- `backend/src/services/learning-service.js`
- focused backend Review Center contract tests

**Acceptance criteria:**

- each returned positive-due Set includes `set_scope: "PUBLIC" | "PERSONAL"` derived from existing authoritative Set data;
- `PUBLIC` maps only from `is_public = true`; `PERSONAL` maps only from an accessible owned private Set;
- `owner_id` and copied-from ancestry are not returned or inferred;
- due counts, multi-Set attribution, one evaluation timestamp, CEFR/access behavior and zero-due response remain unchanged;
- no route, controller, schema, migration, scheduler or session change is introduced.

### TASK-RE-A08: Validate the additive Review Center client contract

**Dependencies:** TASK-RE-A07 completed and accepted at its implementation gate.

**Allowlist:**

- `frontend/src/services/learning-service.js`
- focused frontend Review Center service tests

**Acceptance criteria:**

- client validation accepts exactly `PUBLIC` and `PERSONAL` for every Set entry;
- missing or unknown values follow existing invalid-response handling;
- the client never derives scope from names, UUIDs or other metadata;
- all backend-provided counts and Set IDs remain unchanged.

### TASK-RE-A09: Present Set scope, count guidance and focused Review Center polish

**Dependencies:** TASK-RE-A08.

**Allowlist:**

- `frontend/src/learning/review-center-page.jsx`
- focused Review Center UI contract tests
- existing `frontend/e2e/auth/review-center.spec.js` assertions

**Acceptance criteria:**

- `PUBLIC` and `PERSONAL` render as **Bộ từ công khai** and **Bộ từ cá nhân** respectively;
- concise copy explains due studied vocabulary, possible `NEW` SET SRS items, unique global counting and non-additive Set totals;
- statistics card is compact on desktop and full-width on mobile;
- Set cards have clear hierarchy, aligned CTA, resilient long-name wrapping and restrained ELVocab styling;
- semantic headings, focus-visible and hover states remain accessible;
- loading, error, retry, empty and positive-due states, exact UUID navigation and existing routes are preserved;
- Dashboard, Progress, Flashcard and BUG-01 implementation are not changed.

### TASK-RE-A10: Focused verification and HUMAN visual gate

**Dependencies:** TASK-RE-A07 through TASK-RE-A09 and separate test authorization.

**Acceptance criteria:**

- authorized focused backend/frontend tests and scoped lint pass or are reported truthfully;
- existing Review Center E2E assertions are updated and run only under their own execution authorization;
- responsive review covers 320px, 768px and desktop, including long names and keyboard focus;
- focused `ui-ux-review` reports no blocking interaction, accessibility, responsive or visual-consistency regression;
- regression evidence covers unchanged SRS/Normal/Global behavior and the BUG-01 loading repair;
- no amendment task is marked complete and no commit/push/merge occurs before its separate HUMAN gates.

### Amendment exclusions

No backend/frontend implementation, test execution, Batch 2 work, Dashboard change, performance optimization, database/Prisma operation or Git publication is authorized by these draft task definitions.

---

## Batch 1 HUMAN Acceptance Checkpoint

> **HUMAN ACCEPTED — 2026-11-08**

HUMAN accepted the verified Review Experience V1 Batch 1 scope on 2026-11-08. This checkpoint records acceptance for TASK-RE-004 and for the implemented Review Center amendment verification gates TASK-RE-A05 and TASK-RE-A10. It does not retroactively alter the historical approval markers above or assert completion of any other amendment task.

Acceptance evidence:

- backend offline contracts: 13/13 PASS;
- frontend offline contracts/unit tests: 85/85 PASS;
- isolated mocked-browser regression: 90/90 PASS;
- scoped ESLint and `git diff --check`: PASS;
- formal TEST verdict: PASS;
- formal REVIEW verdict: APPROVE, with no unresolved BLOCKER/HIGH finding in the verified scope;
- prior HUMAN visual confirmation covered the Review Center UI, SET review-context badge and BUG-01 loading correction.

The accepted amendment scope includes the due-only Review Center verification represented by TASK-RE-A05 and the authoritative `set_scope`, responsive/accessibility and regression verification represented by TASK-RE-A10. Browser evidence used mocked APIs; database-backed and real-stack integration checks were not executed and remain `NOT RUN`.

This acceptance does not authorize TASK-RE-005 through TASK-RE-008, TASK-RE-A06, Batch 2 implementation, any other pending implementation task, commit, push, merge or deployment. Batch 2 remains closed until separate explicit HUMAN authorization.

---

## Batch 2 HUMAN Acceptance Checkpoint

> **HUMAN ACCEPTED — 2026-11-09**

HUMAN accepted the implemented Review Experience V1 Batch 2 scope covering TASK-RE-005 through TASK-RE-008 on 2026-11-09. This later checkpoint records the separately authorized implementation, technical verification, technical review and HUMAN manual visual confirmation; it does not alter the historical gate state recorded above.

Acceptance evidence:

- offline regression: 73/73 PASS;
- isolated mocked-browser regression: 65/65 PASS;
- scoped ESLint: PASS;
- production build: PASS;
- `git diff --check`: PASS;
- formal TEST verdict: PASS;
- formal REVIEW verdict: APPROVE;
- HUMAN manual verification: PASS on 2026-11-09.

HUMAN visually accepted the shared Flashcard presentation across SET Review, standard NORMAL learning and GLOBAL Review; the focused GLOBAL Review layout without the application sidebar; and the Review Center → SET Review navigation and interaction flow. SET and GLOBAL session controllers, identities and behavioral contracts remain separate as required.

Database-backed and real-stack E2E suites were not executed for this Batch 2 acceptance and remain `NOT RUN`; the accepted browser evidence used isolated mocked APIs. The intermittent login HTTP 500 remains unresolved at root-cause level despite a later successful guarded reproduction. SET SRS initialization latency greater than 10 seconds remains deferred to Performance V3. Any previously reported review-count discrepancy remains unresolved unless separately verified.

This acceptance does not authorize any later task, Dashboard implementation, Performance V3 work, commit, push, merge, deployment or feature-status update. Those actions retain their own explicit HUMAN gates.

---

## Documentation Reconciliation Checkpoint — 2026-11-09

> **STATUS RECONCILED — NOT FEATURE CLOSURE**

This checkpoint reconciles the historical task-definition gates with the implementation, verification and HUMAN acceptance evidence present on 2026-11-09. It does not rewrite the earlier authorization records, grant retrospective implementation authority, extend either HUMAN acceptance checkpoint, or mark Review Experience V1 complete or closed.

| Task | Reconciled status | Evidence and remaining boundary |
|---|---|---|
| TASK-RE-001 | **IMPLEMENTED / VERIFICATION EVIDENCE PRESENT** | Review Center and the dedicated GLOBAL/SET routes exist with focused contract and mocked-browser coverage. The Batch 1 checkpoint accepts the verified Batch 1 scope but explicitly records task-level acceptance for TASK-RE-004, not a separate acceptance for TASK-RE-001. |
| TASK-RE-002 | **IMPLEMENTED / VERIFICATION EVIDENCE PRESENT** | USER learning navigation and role-boundary coverage exist. No separate HUMAN acceptance record names TASK-RE-002. |
| TASK-RE-003 | **IMPLEMENTED / VERIFICATION EVIDENCE PRESENT** | Dashboard **Xem ôn tập** behavior and positive/zero/error coverage exist. No separate HUMAN acceptance record names TASK-RE-003. |
| TASK-RE-004 | **HUMAN ACCEPTED — 2026-11-08** | Explicitly covered by the Batch 1 HUMAN Acceptance Checkpoint and its recorded TEST PASS / REVIEW APPROVE evidence. |
| TASK-RE-005 through TASK-RE-008 | **HUMAN ACCEPTED — 2026-11-09** | Explicitly covered by the Batch 2 HUMAN Acceptance Checkpoint, including technical verification, REVIEW APPROVE and HUMAN manual visual confirmation. |
| TASK-RE-A01 | **HUMAN DECISION APPROVED — 2026-11-08** | The multi-Set attribution decision is recorded. This is a decision-level checkpoint, not task implementation acceptance. |
| TASK-RE-A02 | **IMPLEMENTED / VERIFICATION EVIDENCE PRESENT** | The read-only Review Center summary endpoint and focused backend contract coverage exist. No separate HUMAN acceptance record names TASK-RE-A02. |
| TASK-RE-A03 | **IMPLEMENTED / VERIFICATION EVIDENCE PRESENT** | The implemented Review Center API contract is documented in `docs/API_SPEC.md`. No separate HUMAN acceptance record names TASK-RE-A03. |
| TASK-RE-A04 | **IMPLEMENTED / VERIFICATION EVIDENCE PRESENT** | The due-only Review Center and focused frontend coverage exist. No separate HUMAN acceptance record names TASK-RE-A04. |
| TASK-RE-A05 | **HUMAN ACCEPTED — 2026-11-08** | Explicitly covered by the Batch 1 HUMAN Acceptance Checkpoint. |
| TASK-RE-A06 | **IMPLEMENTED / VERIFICATION EVIDENCE PRESENT** | Its transition to the separately authorized Batch 2 work is evidenced by the accepted TASK-RE-005 through TASK-RE-008 outcome; TASK-RE-A06 has no separate HUMAN acceptance record. |
| TASK-RE-A07 | **IMPLEMENTED / VERIFICATION EVIDENCE PRESENT** | Authoritative `PUBLIC` / `PERSONAL` projection and focused backend coverage exist. No separate HUMAN acceptance record names TASK-RE-A07. |
| TASK-RE-A08 | **IMPLEMENTED / VERIFICATION EVIDENCE PRESENT** | Strict frontend `set_scope` validation and focused service coverage exist. No separate HUMAN acceptance record names TASK-RE-A08. |
| TASK-RE-A09 | **IMPLEMENTED / VERIFICATION EVIDENCE PRESENT** | Scope labels and bounded Review Center presentation evidence exist. No separate HUMAN acceptance record names TASK-RE-A09. |
| TASK-RE-A10 | **HUMAN ACCEPTED — 2026-11-08** | Explicitly covered by the Batch 1 HUMAN Acceptance Checkpoint. |

Formal feature closure remains unresolved. It requires separate HUMAN direction on the disposition of implemented-but-not-separately-accepted tasks, authorized synchronization of any active product/architecture/UX/status documentation that is now inaccurate, and separate commit, integration and feature-status gates. Database-backed and real-stack E2E remain **NOT RUN** and are not represented as passing evidence.

The following risks remain open without reclassification: the intermittent login HTTP 500 root cause is unresolved; SET SRS initialization latency above 10 seconds is deferred to Performance V3; the previously reported review-count discrepancy has not been independently resolved; and the Review Experience implementation remains uncommitted with tracked and untracked worktree changes. This reconciliation authorizes no implementation, test execution, approval extension, feature closure or Git operation.

---

## TASK-RE-A02 HUMAN Acceptance Checkpoint

> **HUMAN ACCEPTED WITH EXPLICIT LIMITATIONS — TASK-RE-A02 — 2026-11-09**

HUMAN accepts TASK-RE-A02 based on the existing source audit and previously recorded offline contract verification. This acceptance covers the implemented Review Center authoritative due-count aggregation and projection behavior within that verified scope: the global due count deduplicates by `vocabulary_id`; per-Set counts deduplicate by `(set_id, vocabulary_id)`; copied PUBLIC/PERSONAL Sets may share vocabulary identities; SRS progress is scoped to USER and vocabulary rather than independently to each Set; and Review Center excludes unstarted `NEW` vocabulary while SET SRS sessions may include eligible `NEW` cards. Previously observed aggregate counts are consistent with these implemented semantics but were not independently reconstructed against historical database rows.

HUMAN consciously accepts the following verification limitations for TASK-RE-A02:

- Preview TEST runtime/database reconciliation was not executed for TASK-RE-A02.
- Database-backed and real-stack E2E remain `NOT RUN`.
- The historical transition from 12 globally due vocabulary items to zero was not independently reconstructed or attributed to a specific sequence of rating actions.
- Historical per-Set count-to-UUID assignments and the exact vocabulary overlap were not verified.
- Strict transaction-wide snapshot isolation was not established from the source implementation.
- The historical discrepancy is not classified as conclusively resolved, passed, fixed or verified through runtime evidence.

This checkpoint supersedes the earlier requirement to complete Preview TEST runtime verification before TASK-RE-A02 acceptance. It does not accept TASK-RE-A04 or TASK-RE-A09, alter their historical definitions, or restore the superseded visible title/subtitle, **Ôn tất cả** action or removed explanatory count paragraphs. The final HUMAN-approved Review Center UI direction confirmed on 2026-11-09 remains controlling.

The Batch 1 and Batch 2 HUMAN acceptance checkpoints remain unchanged. The intermittent login HTTP 500 root cause remains unresolved; SET SRS initialization latency above 10 seconds remains deferred to Performance V3; real-stack/database E2E remain `NOT RUN`; and documentation reconciliation, integration, feature-status and formal feature-closure gates remain separate and unresolved. This acceptance authorizes no implementation, test execution, database or Prisma operation, feature closure, commit, push, merge or deployment.

---

## Final Remaining Task HUMAN Acceptance Checkpoint

> **HUMAN AUTHORIZED — 2026-11-09 — CONSOLIDATED TASK ACCEPTANCE ONLY**

### HUMAN ACCEPTED — 2026-11-09

HUMAN accepts TASK-RE-001, TASK-RE-002, TASK-RE-003, TASK-RE-A03, TASK-RE-A06 and TASK-RE-A08 based on the existing implementation evidence, previously recorded offline/unit/contract and isolated mocked-browser verification as applicable, existing formal TEST/REVIEW evidence where applicable, and applicable HUMAN visual verification. This consolidated decision does not assert that every listed task received an independent task-specific test run or TEST/REVIEW checkpoint, does not claim database-backed or real-stack E2E evidence, and does not grant retrospective implementation authorization.

### HUMAN ACCEPTED WITH EXPLICIT LIMITATIONS — TASK-RE-A07 — 2026-11-09

HUMAN accepts TASK-RE-A07 based on the implemented authoritative backend `PUBLIC` / `PERSONAL` classification, existing offline backend contract evidence, frontend mocked consumption of both scopes, and the previously accepted TASK-RE-A10 verification evidence. Actual Preview TEST classification was not verified, database-backed and real-stack E2E remain `NOT RUN`, and no runtime database proof is claimed. HUMAN consciously accepts these limitations; they are not classified as resolved.

### HUMAN ACCEPTED — TASK-RE-A04 AND TASK-RE-A09 — 2026-11-09

HUMAN accepts the final implemented Review Center UI based on the existing source implementation, recorded offline and isolated mocked-browser UI verification, and HUMAN visual verification of the current Review Center. The later final HUMAN direction supersedes only the following historical criteria while preserving their original wording as an audit trail:

- For TASK-RE-A04, the visible large title/subtitle and the **Ôn tất cả** action are not required and must not be restored.
- For TASK-RE-A09, the previously required explanatory count paragraphs are not required and must not be restored.

This supersession does not extend to any unrelated TASK-RE-A04 or TASK-RE-A09 requirement.

The Batch 1 HUMAN acceptance dated 2026-11-08, Batch 2 HUMAN acceptance dated 2026-11-09 and TASK-RE-A02 acceptance with explicit limitations dated 2026-11-09 remain unchanged. TASK-RE-A01 remains **HUMAN DECISION APPROVED ONLY** and is not converted into task acceptance by this checkpoint.

The following limitations and risks remain open: the intermittent login HTTP 500 root cause is unresolved; SET SRS initialization latency above 10 seconds remains deferred to Performance V3; historical global/per-Set count observations were not independently reconstructed; Preview TEST/database-backed real-stack E2E remain `NOT RUN`; the accepted limitations of TASK-RE-A02 and TASK-RE-A07 remain in force; and the Review Experience implementation remains uncommitted/untracked and not integrated.

This checkpoint records task acceptance only. It does not close Review Experience V1, change feature publication status, synchronize remaining documentation, authorize retrospective implementation, or authorize database/Prisma operations, tests, builds, process operations, commit, push, merge or deployment. Documentation reconciliation, feature closure, feature-status and integration retain separate HUMAN gates.

---

## Review Experience V1 Formal Closure Checkpoint

> **HUMAN CLOSED WITH DOCUMENTED LIMITATIONS — REVIEW EXPERIENCE V1 — 2026-11-09**

HUMAN formally closes Review Experience V1 after the implementation and applicable acceptance gates were satisfied within the accepted functional scope. The accepted scope includes the non-mutating Review Center, dedicated focused GLOBAL and SET Review routes, backend-authoritative Review Center due-count and Set-scope projection, Review Center navigation and presentation, and the shared Flashcard presentation across SET Review, GLOBAL Review and preserved standard learning behavior.

The final Review Center UI direction supersedes only the previously identified conflicting TASK-RE-A04 requirements for a large visible title/subtitle and **Ôn tất cả**, and the TASK-RE-A09 requirement for explanatory count paragraphs. All other accepted requirements and historical records remain unchanged. TASK-RE-A01 remains a decision-approved administrative record and is not converted into invented implementation acceptance.

TASK-RE-A02 and TASK-RE-A07 retain their explicit verification limitations. At closure:

- database-backed and real-stack E2E remain **NOT RUN**;
- Preview TEST runtime verification gaps for TASK-RE-A02 and TASK-RE-A07 remain;
- the historical transition from 12 globally due vocabulary items to zero was not independently reconstructed;
- strict cross-statement snapshot isolation was not established;
- the intermittent login HTTP 500 root cause remains unresolved;
- SET SRS initialization latency above ten seconds remains deferred to Performance V3; and
- the implementation remains uncommitted/untracked and not integrated.

HUMAN consciously accepts these limitations for functional closure; none is represented as fixed or independently verified. Formal functional closure does not imply production readiness, Git integration, deployment or post-deployment verification, and authorizes no commit, push, merge or deployment.
