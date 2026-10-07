# TASKS: Discovery V1 — Khám phá bộ từ

**Status:** `HUMAN CLOSURE APPROVED — TASK-126..TASK-141 COMPLETE / TEST PASS / REVIEW APPROVE`

**Approved sources:**

- `docs/specs/DISCOVERY_V1_SPEC.md` — HUMAN APPROVED.
- `docs/plans/DISCOVERY_V1_PLAN.md` — HUMAN APPROVED.

**Execution boundary:** TASK-141 formal TEST/REVIEW and HUMAN closure approval are complete. Commit, feature-branch push and FF-only integration to `dev` are authorized; database mutation, backend/API/schema/dependency change and any `stash@{0}` operation remain unauthorized.

## 1. Overview

These tasks enhance the completed Topic/Vocabulary Set discovery foundation. They reuse current public APIs and existing UI modules, establish composition evidence before broader UI work, preserve Guest and deep-link behavior, keep authenticated users inside the App Shell, and stop before any unapproved backend or contract expansion.

## 2. Feature Status

Current status: **Discovery V1 implementation complete; formal TEST PASS and REVIEW APPROVE**.

Topic listing, Topic-scoped public System Set discovery, public Set detail and USER copy are already complete. Discovery V1 modifies only the approved Set-first landing, adaptive shell, client composition and related UX/tests; it does not rebuild those domains.

## 3. Task Types

- **TEST-ONLY:** fixtures, contract tests or regression tests; no production behavior change.
- **PRODUCTION:** approved frontend production implementation.
- **MEASUREMENT/EVIDENCE:** request/readiness evidence and checkpoint reporting; no product redesign.
- **DOCUMENTATION/STATUS:** approved documentation and workflow evidence only.
- **FORMAL TEST/REVIEW:** closure verification after implementation approval.

## 4. Dependency Graph

```text
TASK-126 Test fixtures/current behavior
   ↓
TASK-127 Composition/concurrency contract tests
   ↓
TASK-128 Current-API catalog implementation
   ↓
TASK-129 Request-count/readiness measurement
   ↓
MANDATORY HUMAN COMPOSITION CHECKPOINT
   ↓
TASK-130 Adaptive Guest/authenticated route shell
   ↓
TASK-131 Set-first /topics landing and state model
   ↓
TASK-132 Search and Topic filtering
   ↓
TASK-133 Discovery Set cards and role actions
   ↓
TASK-134 Public Set Detail shell/action integration
   ↓
TASK-135 Copy/save lifecycle
   ↓
TASK-136 Responsive/accessibility completion
   ↓
TASK-137 Focused unit and mocked-browser regression
   ↓
TASK-138 Focused guarded real-stack regression
   ↓
TASK-139 Implementation-completion checkpoint
   ↓
MANDATORY HUMAN IMPLEMENTATION REVIEW
   ↓
TASK-140 Documentation/status reconciliation
   ↓
TASK-141 Final TEST/REVIEW and closure preparation
   ↓
MANDATORY HUMAN CLOSURE APPROVAL BEFORE COMMIT/PUSH
```

## TASK-126 — Prepare Discovery Fixtures and Capture Current Behavior

**Type:** TEST-ONLY

### Objective

Establish deterministic reusable Topic/public System Set fixtures and document the existing `/topics`, Topic-scoped discovery, public detail, role and copy behavior before production changes.

### Dependencies

- HUMAN TASK approval.

### Files / Modules

- Existing `frontend/e2e/integration/topic-real-stack.spec.js`
- Existing `frontend/e2e/integration/vocabulary-set-public-real-stack.spec.js`
- Existing mocked auth fixtures under `frontend/e2e/auth/fixtures/`
- New focused Discovery mocked spec/fixture under the existing frontend E2E structure if reuse is insufficient

### In Scope

- Multi-Topic fixture with public System Sets, a Topic with no Sets, null descriptions, stable item counts and deterministic order.
- Guest, USER and ADMIN identities using existing auth mocks/helpers.
- Current route/request assertions needed to migrate `/topics` safely.
- Run-owned `.env.test` real-stack fixture ownership/cleanup design.

### Out of Scope

- Production UI changes.
- New backend fixtures/endpoints or global catalog contract.

### Acceptance Criteria

- Fixtures express public System Sets only and cannot expose private/Community content.
- Existing deep links, role surfaces and copy destination are recorded in assertions or task evidence.
- Real-stack fixtures use run-unique identifiers and cleanup only run-owned data.

### Verification

- Run the focused existing Topic/public Set tests required to establish the pre-change result.
- Confirm no production file changed in this task.

## TASK-127 — Add Catalog Composition and Concurrency Contract Tests

**Type:** TEST-ONLY

### Objective

Define failing-first tests for the approved current-API composition before implementing it.

### Dependencies

- TASK-126.

### Files / Modules

- `frontend/test/discovery-catalog.test.js` (expected new focused unit test)
- `frontend/test/vocabulary-set-service.test.js`
- Existing frontend Topic/Vocabulary Set service test helpers

### In Scope

- One `/api/topics` request plus one Topic-scoped Set request per Topic.
- Proof that Topic Set requests start concurrently or under an explicit concurrency bound, never sequentially.
- Stable Topic order followed by existing Set response order.
- Topic metadata association for the card model.
- Complete-success publication only.
- Any required request failure rejects the catalog.
- Stale attempt/retry protection if orchestration owns request lifecycle.
- Explicit expected request count `1 + T`.

### Out of Scope

- Numeric performance target.
- New endpoint, server-side pagination or partial-success mode.

### Acceptance Criteria

- Tests fail against missing composition behavior for the intended reason.
- Deferred request gates prove overlap/start behavior rather than inferring concurrency from fast timings.
- Tests prove search/filter cannot receive an incomplete catalog result.

### Verification

- Run the focused Node test files and record the expected pre-implementation failures.

## TASK-128 — Implement Unified Current-API Catalog Composition

**Type:** PRODUCTION

### Objective

Implement a reusable frontend catalog loader using only approved public APIs.

### Dependencies

- TASK-127.

### Files / Modules

- `frontend/src/services/vocabulary-set-service.js`
- Expected focused helper such as `frontend/src/topics/discovery-catalog.js`, only if extraction keeps orchestration pure/testable
- `frontend/test/discovery-catalog.test.js`
- `frontend/test/vocabulary-set-service.test.js`

### In Scope

- Fetch Topics once, then dispatch derived Topic Set reads concurrently or bounded-concurrently.
- Produce complete card models with exact Topic ID/name.
- Preserve stable Topic/Set ordering.
- Reject the entire attempt when a required request fails.
- Prevent stale attempts from becoming authoritative where the loader owns lifecycle state.

### Out of Scope

- Rendering `/topics`.
- Backend/API/schema/package changes.
- Silent Set-ID deduplication that could hide inconsistent server data.

### Acceptance Criteria

- Contract tests from TASK-127 pass.
- No sequential Topic request waterfall exists.
- No data is returned as a successful catalog until every required request succeeds.
- No existing service method or response contract regresses.

### Verification

- Focused catalog/service unit tests.
- Touched-file ESLint.
- `git diff --check`.

## TASK-129 — Measure Request Count, Readiness and Scaling

**Type:** MEASUREMENT/EVIDENCE — MANDATORY CHECKPOINT

### Objective

Measure the authorized current-API composition before broader Discovery production migration.

### Dependencies

- TASK-128.

### Files / Modules

- Focused mocked Playwright measurement scenario under `frontend/e2e/`
- Existing Playwright/performance measurement helpers where directly reusable
- TASK evidence in this file after execution

### In Scope

- Measure controlled single-Topic and multi-Topic fixtures.
- Record current real TEST-data Topic count when guarded real-stack measurement is authorized.
- Separate catalog requests from `/api/auth/me` and unrelated asset/bootstrap traffic.
- Demonstrate Set-request overlap/concurrency.
- Measure navigation/load start through Set-grid or legitimate global-empty readiness.
- Record remote TEST/network caveats separately from application orchestration.

### Required checkpoint report

- Topic count `T`.
- Expected catalog request count `1 + T`.
- Actual catalog request count.
- Whether Topic Set requests overlap/concurrently execute.
- Catalog readiness samples/timing.
- Single-Topic versus multi-Topic scaling.
- Any remote TEST latency caveat.

### Acceptance Criteria

- No invalid, incomplete or partial-success sample is promoted.
- Request count and concurrency evidence are explicit.
- Search/filter readiness begins only after complete successful composition.
- Evidence contains no secrets or personal fixture data.

### Verification

- Run the focused measurement scenario with documented environment and readiness definition.
- Artifact/secret scan and transient-artifact check.

### Mandatory HUMAN STOP

Stop after reporting this checkpoint. If evidence shows materially poor readiness, excessive requests or unacceptable current-dataset scaling, do not proceed and do not propose/implement a new endpoint, server-side pagination, server-side search/filter or API response change without HUMAN review.

## TASK-130 — Integrate Adaptive Guest and Authenticated Discovery Shell

**Type:** PRODUCTION

### Objective

Use one route/page implementation while rendering the correct existing shell after auth restoration.

### Dependencies

- HUMAN acceptance of TASK-129 checkpoint.

### Files / Modules

- `frontend/src/app-router.jsx`
- `frontend/src/topics/public-topic-layout.jsx`
- Expected narrow adaptive layout beside existing Topic/auth UI if required
- Existing auth loading/shell modules

### In Scope

- Guest routes remain public.
- Authenticated USER and ADMIN use `AuthenticatedShell` for all approved Discovery/public detail routes.
- Auth resolution prevents wrong-shell flash.
- Existing route URLs and page implementations are retained.

### Out of Scope

- New authentication mechanism or route guard semantics.
- Duplicated Guest/USER page trees.

### Acceptance Criteria

- Guest can open every retained public deep link without login.
- Authenticated USER remains inside the App Shell across `/topics`, Topic detail/scoped discovery and public Set detail.
- ADMIN browses safely in the App Shell without learner management actions.
- Auth loading is accessible and does not flash the public shell for a restoring session.

### Verification

- Focused auth routing/App Shell mocked tests.
- Direct deep-link checks for Guest, USER and ADMIN.

## TASK-131 — Build the Set-first `/topics` Landing and Complete State Model

**Type:** PRODUCTION

### Objective

Evolve the existing Topic list page into the unified **Khám phá bộ từ** Set-first landing.

### Dependencies

- TASK-130.

### Files / Modules

- `frontend/src/topics/topic-list-page.jsx`
- Catalog loader/helper from TASK-128
- `frontend/src/index.css` only where existing utilities/style families cannot express the scoped layout

### In Scope

- Page heading and Set-first information hierarchy.
- Complete-catalog loading.
- Global empty, atomic error/retry and successful Set-grid state.
- Retry starts a fresh authoritative attempt.
- No controls/results published from incomplete data.

### Out of Scope

- Search/filter internals, card copy behavior or public-detail redesign.

### Acceptance Criteria

- Loading never flashes empty/results.
- Any required request failure withholds all partial results and exposes retry.
- Global empty is shown only after a complete successful load with zero Sets.
- Page uses existing catalog APIs only.

### Verification

- Focused mocked state tests and touched-file ESLint.

## TASK-132 — Implement Search and Topic Filtering

**Type:** PRODUCTION

### Objective

Add the approved complete-dataset client-side search/filter behavior.

### Dependencies

- TASK-131.

### Files / Modules

- `frontend/src/topics/topic-list-page.jsx`
- Focused pure helper only if required for testability
- Focused Discovery browser/unit tests

### In Scope

- Trimmed case-insensitive Set name/description search.
- All-Topics plus exact one-Topic selection.
- AND semantics.
- Page-local state and specified reset behavior.
- Filtered-empty state distinct from global empty.
- Source ordering preservation.

### Out of Scope

- URL persistence, sorting, server-side pagination or server requests on control/page changes.

### Acceptance Criteria

- Controls appear only after the complete successful catalog is available.
- Changing controls makes no search/filter API request.
- Clearing search restores Sets within the selected Topic.
- Selecting all Topics preserves the current search across Topics.
- The filtered normal catalog is sliced client-side at 9 Sets per page; search/Topic changes reset to page 1, invalid pages clamp safely, featured previews are excluded and page navigation makes no API request.

### Verification

- Focused unit/mocked interaction tests, including filtered-empty behavior.

## TASK-133 — Implement Discovery Set Cards and Role Actions

**Type:** PRODUCTION

### Objective

Render public System Set cards in the My Sets visual family with Discovery-specific content/actions.

### Dependencies

- TASK-132.

### Files / Modules

- `frontend/src/topics/topic-list-page.jsx`
- Reusable/scoped card component only if it prevents duplication with public Set pages
- Existing My Sets/public Set styles and Tailwind utilities

### In Scope

- Name, description fallback, `item_count`, Topic label.
- **Xem** public-detail link.
- USER save action, Guest login action, ADMIN browse-only behavior.
- No private ownership menu.

### Out of Scope

- Progress/recommendations, creator/social UI, edit/delete or richer vocabulary data.

### Acceptance Criteria

- Only public System Set summaries render.
- Action names are role-appropriate and accessible.
- Cards share the visual family without copying private controls.
- Topic labels use exact loaded Topic metadata.

### Verification

- Focused role/card mocked tests and structural responsive check.

## TASK-134 — Integrate Public Set Detail with Adaptive Shell and Existing Actions

**Type:** PRODUCTION

### Objective

Preserve public detail behavior while making it shell-compatible for authenticated browsing.

### Dependencies

- TASK-133.

### Files / Modules

- `frontend/src/vocabulary-sets/public-vocabulary-set-pages.jsx`
- `frontend/src/topics/topic-detail-page.jsx` only if navigation adjustment is required
- `frontend/src/app-router.jsx` only for the already-approved adaptive route boundary

### In Scope

- Ordered word/optional phonetic preview.
- Guest login prompt.
- USER Learning, Quiz and copy actions on eligible Sets.
- ADMIN browse-only state.
- Existing not-found/error/retry and compatible back links.

### Out of Scope

- Payload enrichment, edit/delete, Learning/Quiz behavior changes or detail redesign.

### Acceptance Criteria

- Detail remains read-only and uses the current endpoint.
- Existing `position` order is preserved.
- Empty legacy public Set does not expose Learning/Quiz entry.
- All retained deep links work in the correct shell.

### Verification

- Focused public detail and route-role tests.

## TASK-135 — Complete Copy/Save Lifecycle and Coverage

**Type:** PRODUCTION + FOCUSED TEST

### Objective

Reuse the existing copy mutation consistently from cards/detail without changing its semantics.

### Dependencies

- TASK-134.

### Files / Modules

- `frontend/src/topics/topic-list-page.jsx` or scoped card action component
- `frontend/src/vocabulary-sets/public-vocabulary-set-pages.jsx`
- `frontend/src/services/vocabulary-set-service.js` only if existing method reuse needs no contract change
- Focused mocked and real-stack copy tests

### In Scope

- Per-action pending guard.
- Safe local failure with retry.
- Preserve loaded catalog on failure.
- Success navigation to copied My Sets detail.
- Repeated completed copies allowed.
- Guest makes no protected copy request.

### Out of Scope

- Idempotency key, duplicate-copy policy or mutation response change.

### Acceptance Criteria

- Rapid clicks issue one request while pending.
- A failed attempt can retry without reloading the catalog.
- A later intentional copy creates another independent copy.
- Backend remains authoritative for USER authorization and canonical validation.

### Verification

- Focused mocked lifecycle tests.
- Guarded `.env.test` copy integration with run-owned cleanup.

## TASK-136 — Complete Responsive and Accessibility Behavior

**Type:** PRODUCTION + FOCUSED TEST

### Objective

Make the complete Discovery flow usable across approved breakpoints and input methods.

### Dependencies

- TASK-135.

### Files / Modules

- Touched Discovery/public detail components
- `frontend/src/index.css` only for scoped necessary styles
- Focused Discovery browser tests

### In Scope

- Widths `375`, `390`, `768`, `820`, `1366`, `1536`.
- Keyboard search/filter/cards/actions.
- Visible focus and clear selected filter state.
- Accessible labels, action names, live result count and state announcements.
- No horizontal overflow or inaccessible wrapped action.
- Reduced-motion compatibility.

### Out of Scope

- Broad App Shell, Auth, Dashboard or My Sets redesign.

### Acceptance Criteria

- Every approved viewport passes overflow and action reachability checks.
- Tab/keyboard order is deterministic.
- Loading/empty/filtered-empty/error/not-found/copy states are distinguishable to assistive technology.

### Verification

- Focused mocked Playwright at all approved widths.
- Touched-file ESLint.

## TASK-137 — Run Focused Unit and Mocked-Browser Regression

**Type:** TEST-ONLY

### Objective

Verify the frontend contract and relevant existing UI regressions after production work.

### Dependencies

- TASK-136.

### Files / Modules

- Discovery unit/service tests
- Focused mocked Discovery spec
- Existing Auth routing/App Shell, Topic and Vocabulary Set browser specs affected by `/topics`

### In Scope

- Composition, states, roles, actions, deep links, accessibility and breakpoints.
- Update only stale expectations superseded by approved Set-first behavior.
- Preserve unrelated test intent.

### Acceptance Criteria

- Focused unit/service and mocked browser suites pass.
- No test relaxes public visibility, role, complete-load or atomic-failure rules.
- Test auth/session isolation does not affect manual or unrelated sessions.

### Verification

- Run recorded focused commands, build, touched-file ESLint and `git diff --check`.

## TASK-138 — Run Focused Guarded Real-stack Regression

**Type:** TEST-ONLY

### Objective

Verify Discovery against real frontend/backend/Prisma behavior using only the dedicated TEST database.

### Dependencies

- TASK-137.

### Files / Modules

- Existing Topic/public Set/USER copy real-stack specs
- Minimal fixture/isolation updates proven necessary by the Set-first route

### In Scope

- Guest catalog/detail.
- USER authenticated shell continuity and real copy result.
- ADMIN safe browse and unchanged management boundaries.
- Public-only visibility, Topic identity, ordering, not-found and deep links.
- Learning/Quiz entry presence without exercising unrelated full learning suites unless required.
- Run-owned cleanup and unrelated TEST user/session preservation.

### Out of Scope

- Main/Preview/Production DB access.
- Full unrelated real-stack suite absent evidence of impact.

### Acceptance Criteria

- Guarded TEST safety and migration parity pass before DB tests.
- Focused real-stack scenarios pass.
- Cleanup preserves unrelated users/sessions and leaves no run-owned fixtures.
- No backend production change is needed.

### Verification

- Guarded `.env.test` commands only.
- Pre/post isolation counts, lint and `git diff --check`.

## TASK-139 — Implementation-completion Review Checkpoint

**Type:** MEASUREMENT/EVIDENCE — MANDATORY HUMAN STOP

### Objective

Report completed implementation and focused evidence before final documentation closure and formal TEST/REVIEW.

### Dependencies

- TASK-138.

### Required report

- Tasks completed and files changed.
- Production versus test-only changes.
- TASK-129 request/readiness evidence and HUMAN disposition.
- Unit, mocked browser, real-stack, build, lint and diff results.
- Role, copy, shell, deep-link, responsive and accessibility findings.
- TEST DB isolation evidence.
- Any deviation, regression, remote anomaly or STOP condition.

### Acceptance Criteria

- No unresolved product regression or unapproved scope change is hidden.
- Current APIs remain sufficient or work is explicitly stopped.
- Implementation is ready for HUMAN decision on final TEST/REVIEW continuation.

### Mandatory HUMAN STOP

Do not continue to TASK-140 or TASK-141 until HUMAN approves the implementation checkpoint.

## TASK-140 — Reconcile Documentation and Feature Status

**Type:** DOCUMENTATION/STATUS

### Objective

Synchronize verified Discovery behavior and workflow evidence without expanding scope.

### Dependencies

- HUMAN approval of TASK-139.

### Files / Modules

- `docs/specs/DISCOVERY_V1_SPEC.md`
- `docs/plans/DISCOVERY_V1_PLAN.md`
- `docs/tasks/DISCOVERY_V1_TASK.md`
- `docs/UI_UX_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/FEATURE_STATUS.md`

### In Scope

- Verified adaptive shell, current-API composition, Set-first UX and test evidence.
- Remove/supersede contradictory legacy Discovery wording.
- Keep feature `IN_PROGRESS` until final TEST/REVIEW/HUMAN closure criteria are met.

### Out of Scope

- `API_SPEC.md`, `DATABASE.md` or `PROJECT_OVERVIEW.md` changes absent a separately approved contract/scope change.

### Acceptance Criteria

- Documentation matches tested implementation.
- No document implies Community discovery, server-side pagination, server search or new API behavior.
- Status evidence is accurate and not prematurely `DONE`.

### Verification

- Documentation consistency search and `git diff --check`.

## TASK-141 — Final TEST, Formal REVIEW and Closure Preparation

**Type:** FORMAL TEST/REVIEW

### Objective

Perform final scoped verification and review Discovery V1 against the approved SPEC/PLAN/TASK.

### Dependencies

- TASK-140.

### In Scope

- Review scope, architecture, data/API immutability, security, roles, copy semantics, accessibility, responsiveness and documentation.
- Carry forward valid TASK-129/137/138 evidence and rerun only checks needed for closure.
- Final unit/browser/build/lint/diff/status/secret/artifact verification.
- Classify all findings by severity and resolve only approved in-scope regressions through the project workflow.
- Mark Discovery V1 `DONE` only after formal TEST PASS, REVIEW APPROVE and required HUMAN approval under project rules.

### Out of Scope

- New optimization or feature work.
- Commit, push or integration.

### Acceptance Criteria

- Formal TEST result is explicit.
- Formal REVIEW result is explicit.
- No unexplained regression, secret, raw artifact or unapproved file exists.
- Closure report includes exact files, evidence, deferred items, branch/HEAD and commit readiness.

### Verification

- Commands defined by the project test/review skills and proportional final regression.

### Mandatory HUMAN STOP

Stop for HUMAN closure approval. Do not commit, push or integrate until explicitly authorized.

## 5. Global STOP Rules

Stop immediately before any:

- Backend production change.
- New endpoint or API response/contract change.
- Prisma schema, migration or index change.
- New dependency.
- Server-side pagination or server-side search/filter.
- Copy, visibility, ownership, authentication, authorization or security contract change.
- Community/shared USER Set inclusion.

Report the evidence and return to HUMAN review instead of adding the work to an implementation task implicitly.

## 6. Scope Guardrails

- Public System Sets only.
- No Community, creator/social, progress/recommendation, sorting or server-side pagination UI.
- No richer public detail payload.
- Repeated copies remain allowed.
- Public detail remains read-only.
- Existing Guest access and deep links remain compatible.
- USER remains inside the authenticated App Shell.
- ADMIN remains browse-only on learner-facing public routes.
- Existing Learning, Quiz and copy contracts are reused, not redesigned.
- Existing modules are extended before any new abstraction is introduced.

## 7. Approval Gate

```text
SPEC STATUS: HUMAN APPROVED
PLAN STATUS: HUMAN APPROVED
TASK STATUS: HUMAN APPROVED — TASK-126..TASK-141 COMPLETE
FORMAL TEST: PASS
FORMAL REVIEW: APPROVE
NEXT ALLOWED ACTION: AUTHORIZED COMMIT, FEATURE PUSH AND FF-ONLY INTEGRATION TO DEV
```

## 8. TASK-126..TASK-129 Checkpoint Evidence (2026-10-06)

- TASK-126 preserved the existing Topic/public System Set baseline: focused guarded real-stack Topic, public Set and USER Set suites passed `14/14`, covering `/topics`, Topic metadata/search/states, Guest browsing, USER/ADMIN boundaries, Topic-scoped Set discovery, public detail/order, deep links, keyboard access, mobile responsiveness and copying a public System Set into an independent private USER Set.
- TASK-127 added focused composition contract tests. The failing-first check confirmed the helper did not yet exist; after TASK-128, Discovery plus existing Vocabulary Set service units passed `10/10`.
- TASK-128 added one frontend-only catalog composer using the existing Topic and Vocabulary Set services. It requests Topics first, starts all derived Topic Set reads through one `Promise.all`, preserves Topic order then Set response order, attaches exact Topic identity/name and rejects atomically on any required failure. No page/shell redesign was started.
- TASK-129 used guarded `.env.test`, current migrations (`7`, none pending), existing isolated Performance ports and run-owned fixtures. One warm-up was excluded and five measured samples were retained for each condition.
- Single-Topic condition: expected/actual catalog requests `2 / 2` for every sample; readiness `837.282–864.656 ms`, median `855.237 ms`; maximum active Topic Set requests `1`.
- Current multi-Topic TEST condition: `T=5`; expected/actual catalog requests `6 / 6` for every sample; all five Topic Set requests overlapped (`max_active_set_requests=5`); readiness `866.504–1,175.326 ms`, median `899.502 ms`.
- The multi-Topic median was approximately `44 ms` (`5.2%`) above the single-Topic median rather than scaling with the sum of five Topic Set latencies. No accidental sequential request or duplicate/unnecessary catalog request was observed.
- Atomic failure and fresh-retry behavior passed focused units; the composer publishes no partial result. Search/filter production work remains unstarted and therefore cannot consume an incomplete catalog.
- Remote Supabase/TEST latency remains an environmental component of the absolute readiness values. Request-overlap evidence distinguishes the concurrent application behavior from that latency.
- Run-owned cleanup preserved unrelated TEST users/sessions at `5→5` / `8→8`. No backend, API, schema, migration, dependency, copy, authorization, Learning, Quiz or SRS contract changed.

## 9. TASK-130..TASK-139 Implementation Checkpoint Evidence (2026-10-06)

- TASK-130 introduced one adaptive parent route that waits for auth restoration, then renders the existing `AuthenticatedShell` for signed-in USER/ADMIN actors or the existing `PublicTopicLayout` for Guests. The existing public URLs and one shared child route tree remain unchanged.
- TASK-131..TASK-133 converted `/topics` into the Set-first **Khám phá bộ từ** catalog using the approved complete concurrent composition helper. Loading, atomic error/retry, global empty, filtered empty, deterministic results, Set cards, Topic labels and role-specific actions are implemented.
- TASK-132 filtering is page-local, trimmed and case-insensitive across Set name/description, uses exact Topic identity and AND semantics, preserves source order, and generates no search/filter request.
- TASK-134 preserved the existing public Set detail endpoint, ordered word/optional-phonetic preview, deep links, safe states and role actions; adaptive routing now keeps authenticated browsing inside the App Shell.
- TASK-135 reuses the existing copy endpoint and service. The catalog has a per-Set pending guard, retains the loaded catalog on failure, permits retry, and navigates to the resulting private Set on success; backend copy semantics are unchanged.
- TASK-136 mocked browser verification passed at `375`, `390`, `768`, `820`, `1366` and `1536` with no horizontal overflow. Native labelled search/radio controls, live result counts, keyboard-reachable actions, visible focus, semantic states and reduced-motion-safe loading are retained.
- TASK-137 focused unit/service tests passed `11/11`; focused Discovery mocked browser tests passed `10/10`; affected Auth routing/App Shell mocked regression passed `22/22`; production build and touched-file lint passed.
- TASK-138 guarded `.env.test` migration parity passed with `7` migrations and none pending. Migrated Topic/Discovery real-stack tests passed `9/9`; public Set detail plus USER copy real-stack tests passed `5/5`, for `14/14` focused scenarios. Post-run counts remained `5` unrelated TEST users and `8` sessions, with `0` run-owned `E2E-` Topics/Sets.
- Test migrations were limited to expectations superseded by the approved Set-first route and run-owned public Set fixture creation/cleanup. No production backend, API, database, schema, migration, package, authorization, Learning, SRS or Quiz change was required.
- TASK-129 current-API composition evidence remains HUMAN accepted. TASK-140 is complete; TASK-141 has not started.
- Evidence classification: **acceptable for the current Discovery V1 scope**. The implementation checkpoint through TASK-139 is HUMAN approved; TASK-140 is complete and TASK-141 remains pending authorization.

## 10. TASK-140 Documentation/Status Evidence (2026-10-06)

- SPEC, PLAN and TASK now record the final HUMAN-approved catalog: current-API atomic `1 + T` composition, exact Topic filtering, nine-item client pagination, manual-preview featured limitation, compact cards, session-local saved feedback and unchanged copy/Learning/Quiz/public-read contracts.
- `UI_UX_SPEC.md` now defines the active Set-first landing, adaptive actor shells, mini filter rail, responsive catalog/detail behavior and accessibility boundary. `ARCHITECTURE.md` records concurrent frontend composition and explicitly excludes backend/API/schema redesign.
- At the TASK-140 checkpoint, `FEATURE_STATUS.md` correctly retained `IN_PROGRESS` while TASK-141 was pending. TASK-141 evidence below now supersedes that checkpoint state with formal TEST PASS, REVIEW APPROVE and `DONE` status pending HUMAN closure approval before commit/push.
- Deferred items are explicit: Community/creator-social discovery, sorting, server-side pagination/global search, production featured ranking, per-Set cover storage, authoritative account-level saved-source recognition and Set-level CEFR metadata/filtering. Set covers and CEFR are future follow-up work, not TASK-140 implementation.

## 11. TASK-141 Formal TEST/REVIEW Evidence (2026-10-07)

- Guarded `.env.test` preflight passed: dedicated TEST safety and Prisma Client connectivity passed; Prisma found `7` migrations with none pending.
- Discovery/Vocabulary Set unit and service regression passed `12/12`. Mocked Discovery plus Auth/App Shell regression passed `35/35` across Guest, USER, ADMIN and widths `375`, `390`, `768`, `820`, `1366`, `1536`.
- Existing Learning, Quiz and Personal Set Detail mocked regression passed `51/51`. The expected mocked-suite Vite proxy `ECONNREFUSED` noise did not fail or bypass any assertion.
- Guarded focused real-stack regression passed `14/14`: Topic/Discovery `9/9`, public Set `3/3`, and USER Set/copy `2/2`. Two legacy loading-state tests received test-only shared release gates after formal verification exposed per-request resolver races; no production behavior changed.
- Requirement traceability found and corrected one in-scope catalog projection defect: manual-preview Featured Sets are now removed from the normal filtered/paginated collection and cannot consume any of its nine page slots. Focused Discovery/Auth routing rerun passed `18/18`. Review also removed the obsolete authenticated branch from the Guest-only `PublicTopicLayout`; the adaptive parent remains the single authenticated-shell authority.
- TEST DB isolation passed: unrelated users/sessions remained `5 → 5` / `8 → 8`; post-run run-owned `E2E-` Topics, Sets and users were all `0`.
- Full frontend ESLint and production build passed. The build retained only the known non-blocking chunk-size advisory. Documentation consistency, scoped secret/debug/artifact checks and `git diff --check` passed.
- Formal TEST verdict: **PASS**. Formal REVIEW verdict: **APPROVE**. Findings remaining by severity: CRITICAL `0`, HIGH `0`, MEDIUM `0`, LOW `0`.
- Discovery V1 satisfies the approved current-API, frontend-only composition boundary. HUMAN closure approval was granted on 2026-10-07; the approved next action is commit, feature push and FF-only integration to `dev`.
