# PLAN: Discovery V1 — Khám phá bộ từ

**Status:** `HUMAN APPROVED — TASK AUTHORIZED` (client-side pagination amendment approved)

**Approved source:** `docs/specs/DISCOVERY_V1_SPEC.md` — HUMAN APPROVED.

**Branch / base:** `feature/discovery-v1` / `ee378beaf7e91ae522e47d0c1c28686ce2a59bbd`.

## 1. Summary

Discovery V1 will extend the existing Topic and public Vocabulary Set frontend instead of creating a parallel discovery system. `/topics` becomes a Set-first catalog assembled from the current public Topic list and Topic-scoped Set-list endpoints. Topic Set requests will start concurrently or through a small explicit bounded-concurrency coordinator; they must never form a sequential request waterfall.

The implementation will preserve all existing backend, database, API, visibility, copy, Learning and Quiz contracts. An adaptive route layout will select the authenticated App Shell after auth resolution for signed-in users and the existing public shell for Guests while retaining all current public URLs.

The first implementation checkpoint will record catalog request count, readiness timing and Topic-count scaling. If the current `1 + T` API composition is materially unsuitable for the current dataset, work stops for HUMAN review before any endpoint, server-side pagination, server search/filter or response-contract proposal.

The final HUMAN-approved presentation uses a compact Featured row containing the first 3 Sets from the complete catalog in existing source order in every environment, a wider search/exact-Topic filter rail, three-column normal catalog where width permits, and nine filtered Sets per client-side page. Featured selection is independent of filters, carries no ranking semantics, makes no extra request, and does not consume normal page slots. Cards use deterministic local covers because no image contract exists, and saved feedback is current-session presentation rather than authoritative source-copy data. Set-level CEFR filtering and real Set cover storage remain future follow-up work.

## 2. Affected Areas

- **Database:** No change. Existing `TOPIC`, `VOCABULARY_SET` and `VOCABULARY_SET_ITEM` models and constraints are sufficient.
- **Backend:** No production change planned. Existing public reads and USER copy mutation remain authoritative.
- **API:** No endpoint or response change. Unified catalog composition is frontend-owned and consumes current APIs.
- **Frontend routing:** Public Discovery routes move beneath an auth-aware layout that renders the existing authenticated or public shell without requiring authentication.
- **Frontend data/state:** `/topics` composes the complete public catalog, then exposes client-side search, exact Topic filtering and 9-item client-side pagination.
- **Frontend UI:** Existing Topic-first landing becomes the Set-first Discovery page; public detail is retained and shell-integrated.
- **Tests:** Existing Topic/Vocabulary Set tests are migrated where `/topics` presentation changes; focused composition, role, copy, state, responsive and timing coverage is added.
- **Documentation:** Discovery UI/architecture/status descriptions are synchronized after verified implementation.

## 3. Existing Code to Reuse

- `frontend/src/app-router.jsx` — existing public and protected route tree.
- `frontend/src/topics/public-topic-layout.jsx` — Guest/public shell and existing auth-state awareness.
- `frontend/src/auth/ui/authenticated-shell.jsx` — authenticated USER/ADMIN App Shell and Discovery navigation.
- `frontend/src/auth/ui/route-guards.jsx` — established auth-loading presentation and role boundaries; Discovery remains public and must not be placed behind `ProtectedRoute`.
- `frontend/src/topics/topic-list-page.jsx` — current `/topics` page to evolve into the Set-first landing rather than creating a second catalog route.
- `frontend/src/topics/topic-detail-page.jsx` — retained Topic metadata deep link.
- `frontend/src/vocabulary-sets/public-vocabulary-set-pages.jsx` — existing Topic-scoped discovery, public detail, role actions and copy behavior.
- `frontend/src/vocabulary-sets/my-vocabulary-sets-page.jsx` — visual family for cards, controls and states; ownership menus are not copied.
- `frontend/src/services/topic-service.js` — existing public Topic list/detail reads.
- `frontend/src/services/vocabulary-set-service.js` — existing Topic-scoped Set list, public detail and copy calls.
- `frontend/src/index.css` and existing Tailwind utilities — current public Topic/Set and My Sets responsive styles; no broad CSS cleanup.
- `frontend/test/vocabulary-set-service.test.js` — existing endpoint and response/error contract coverage.
- `frontend/e2e/integration/topic-real-stack.spec.js` — Topic route, state and ADMIN regression coverage.
- `frontend/e2e/integration/vocabulary-set-public-real-stack.spec.js` — Guest public discovery/detail/order/state/responsive coverage.
- `frontend/e2e/integration/vocabulary-set-user-real-stack.spec.js` and `personal-vocabulary-real-stack.spec.js` — USER copy and resulting private Set coverage.
- `frontend/e2e/auth/app-layout.spec.js`, `auth-routing.spec.js`, and `auth-responsive.spec.js` — authenticated shell/navigation behavior.
- `frontend/performance/measurement.js` — test-side measurement/redaction patterns may be reused where useful; no production telemetry is added.

## 4. Database Plan

### Existing models

- `TOPIC` provides stable Topic identities and names.
- `VOCABULARY_SET.topic_id` links each public System Set to its required Topic.
- `VOCABULARY_SET.is_public` remains the public/System discriminator.
- `VOCABULARY_SET_ITEM.position` remains the authoritative detail order.

### Changes

- None.
- No migration, constraint, index, materialized catalog or search persistence is planned.

### STOP condition

Any proposed schema/index change must stop for HUMAN approval and return to the appropriate contract workflow.

## 5. Backend Plan

### Routes, middleware, controllers, services and repositories

- Retain without production changes:
  - `GET /api/topics`
  - `GET /api/topics/:topicId`
  - `GET /api/topics/:topicId/vocabulary-sets`
  - `GET /api/vocabulary-sets/:setId`
  - `POST /api/vocabulary-sets/:setId/copy`
- Preserve public access to read routes.
- Preserve authentication plus USER authorization on copy.
- Preserve `is_public`, Topic existence, canonical Vocabulary, transaction, ownership and safe not-found enforcement.
- Do not introduce an aggregation controller/service/repository query pre-emptively.

### Backend verification

- Run existing Topic and Vocabulary Set backend suites as regression evidence where frontend implementation does not require a backend edit.
- If current API composition fails the performance checkpoint, stop and report evidence. Do not implement a backend alternative during Discovery V1 without a separately approved contract revision.

## 6. API Contract Plan

### Unified catalog request graph

1. Request `GET /api/topics` once.
2. After a successful Topic response, request `GET /api/topics/:topicId/vocabulary-sets` once for every returned Topic.
3. Start Topic-scoped requests concurrently or bounded-concurrently. Never `await` one Topic response before starting the next.
4. Join each Set summary to the already-loaded Topic identity/name in frontend state.

For `T` Topics, the expected catalog-specific request count is `1 + T`. Authentication restoration such as `/api/auth/me` is measured separately and must not be misreported as a catalog request.

### Completion and failure

- Catalog readiness occurs only when the Topic response and every required Topic-scoped Set response have completed successfully and the Set grid or legitimate global-empty state is rendered.
- Search/filter controls must not operate on an incomplete catalog.
- Any required Topic-scoped request failure rejects the composed load, withholds partial results and displays the Discovery error/retry state.
- Retry starts a new complete composition attempt. Stale results from an older attempt must not replace the newest state.

### Contract boundary

- No request body, response field, status code or error mapping changes.
- No global catalog endpoint, server-side pagination, server-side search/filter or sorting endpoint.
- Materially poor readiness, excessive request count or unacceptable scaling is a mandatory HUMAN checkpoint before any API alternative.

## 7. Frontend Plan

### Phase A — Route and App Shell integration

- Introduce or evolve one small auth-aware Discovery layout at the public Discovery route boundary.
- While authentication restoration is unresolved, render the established accessible auth-loading state so the page does not flash the wrong shell.
- When authenticated, render existing `AuthenticatedShell` for USER and ADMIN.
- When unauthenticated, render existing `PublicTopicLayout`.
- Keep `/topics`, `/topics/:topicId`, `/topics/:topicId/vocabulary-sets` and `/vocabulary-sets/:setId` in one compatible route branch.
- Do not put Guest-accessible routes behind `ProtectedRoute` and do not duplicate page implementations by role.

### Phase B — Unified catalog composition

- Extend the existing frontend service/orchestration boundary with a Discovery catalog loader rather than adding a backend endpoint.
- Fetch Topics first because their identities define the existing Set-list requests.
- Dispatch the derived Set-list requests without sequential awaits. Choose direct concurrency for the current bounded dataset unless implementation measurement justifies an explicit small concurrency limit.
- Preserve stable ordering by Topic list order and, within each Topic, existing Set response order.
- Associate each card model with its exact Topic ID and name.
- Public System Sets belong to one Topic under the existing contract; no general-purpose deduplication is expected. Tests should detect unexpected duplicate Set IDs rather than silently changing business identity.
- Use an attempt token/cancellation guard consistent with current pages so stale completion cannot overwrite retry or route changes.
- Publish data to search/filter state only after the entire attempt succeeds.

### Phase C — Search and Topic filter

- Replace the Topic-card-first `/topics` body with an accessible **Khám phá bộ từ** page identity; omit the oversized in-content intro so the visible catalog begins with the compact featured preview, filter rail and Set results.
- Provide an all-Topics option and one exact Topic selection at a time inside a viewport-aware, vertically scrollable options region; keep the surrounding search, heading, CEFR and result summary stable as Topic count grows.
- Normalize search through trim plus locale-aware lowercase and match Set name/description only.
- Combine Topic and search predicates with AND semantics.
- Keep control state page-local; no query-string or session persistence.
- Preserve source ordering; add no sort control.
- Keep the reset action permanently mounted beside the search heading. Disable it only when search, Topic and CEFR are all default; otherwise it clears all three controls and returns normal pagination to page 1 without a request.
- Select the first 3 Sets from the complete source-ordered catalog as Featured before filtering. Keep that section independent of search/Topic controls, remove those IDs from the normal collection, then paginate the filtered remainder at 9 Sets per page. Reset to page 1 on search/Topic changes, clamp to a valid page and issue no page-change request.

### Phase D — Discovery Set cards

- Reuse the My Sets card visual language—surface, radius, border, spacing and responsive grid—without private ownership menus.
- Render Set name, description fallback, `item_count`, and Topic badge/name.
- **Xem** links to the existing public detail.
- USER receives save/copy; Guest receives a named login path; ADMIN receives browse-only actions.
- Do not add Progress, SRS, edit/delete, creator or social UI.

### Phase E — Public Set detail integration

- Preserve the current public detail data load, metadata and `position`-ordered word/phonetic preview.
- Preserve USER Learning, Quiz and copy actions only where current contracts permit them.
- Preserve Guest login prompt and ADMIN browse-only behavior.
- Ensure the adaptive shell applies to direct/deep-linked detail navigation.
- Keep the surface read-only with no edit/delete actions or richer payload request.

### Phase F — Copy/save UX

- Reuse `vocabularySetService.copySystemSet` and existing success navigation to `/my/vocabulary-sets/:id`.
- Maintain one pending state per active Set action so the same card cannot double-submit while pending.
- Repeated copies after completion remain allowed.
- Keep a failed copy local to its card/detail action, retain the loaded catalog and permit retry.
- Do not add idempotency tokens, duplicate detection or response changes.

### Phase G — Responsive and accessibility

- Prefer existing Tailwind utilities and scoped existing style families; avoid broad `index.css` refactoring.
- Verify representative mobile `375/390`, tablet `768/820`, and desktop `1366/1536` viewports.
- Ensure search, filter, Set cards and action groups wrap without horizontal overflow.
- Use native buttons/links/select semantics where possible, accessible labels, result-count live region and clear selected/filter state.
- Preserve deterministic keyboard order and visible focus treatment.
- Loading, global-empty, filtered-empty, error/retry, not-found and copy-pending/error states must be distinguishable and accessible.
- Respect reduced-motion behavior already established by the shells and loading patterns.

## 8. Validation and Business Logic

- Frontend validates only response shape and UI state; backend remains authoritative for visibility, Topic existence, role and copy behavior.
- Topic filter values come only from loaded Topic identities; no free-form Topic ID is accepted from the user.
- Existing service error mapping continues to distinguish not-found, authorization, validation, operational and API failures.
- No partial-success mode is added.
- No frontend business logic may infer public status, ownership, canonical eligibility or copy authorization beyond presenting role-appropriate controls.

## 9. Performance and Composition Verification

### Required evidence

- Record browser-visible catalog readiness from `/topics` navigation/start of the load through successful Set-grid or legitimate global-empty readiness.
- Record catalog-specific HTTP requests and separate auth/bootstrap traffic.
- For fixtures with `T` Topics, assert one Topics request plus one Topic-scoped Set request per Topic (`1 + T`).
- Record whether Set requests overlap in time or are simultaneously pending, proving absence of a sequential waterfall.
- Compare at least a single-Topic and multi-Topic controlled fixture so linear request-count scaling is explicit.
- Retain enough timing/request evidence in tests or the TASK checkpoint report; do not add production analytics.

### Evaluation

- Correctness requires complete successful composition before readiness and search/filter enablement.
- Concurrent timing should be dominated by the Topics request plus the slowest Set-request batch, not the sum of every Topic request.
- The PLAN does not invent a numeric performance threshold. HUMAN reviews measured current-dataset readiness, request count and scaling at the declared checkpoint.
- If evidence is materially poor or unstable, stop before proposing or implementing a global endpoint, server-side pagination, server-side search/filter or response change.

## 10. Testing Plan

### Unit/service

- Extend frontend service tests for the exact current endpoint graph and safe error propagation.
- Add focused pure orchestration tests, if composition is extracted, proving:
  - Set requests start concurrently/bounded-concurrently;
  - stable Topic/Set ordering;
  - complete-success publication;
  - any-request failure rejects the catalog;
  - stale attempts cannot win;
  - request count is `1 + T`.
- No backend unit test changes are expected unless a genuine existing regression is found.

### Mocked browser/component

- Add focused Discovery browser coverage for:
  - Set-first `/topics` landing;
  - all-Topics and exact Topic filtering;
  - combined search/filter and reset semantics;
  - loading, global-empty, filtered-empty and atomic error/retry;
  - delayed requests proving controls/results wait for complete load;
  - Guest login action with no copy call;
  - USER App Shell, save pending guard, success navigation, retryable error and repeated-copy allowance;
  - ADMIN authenticated shell with browse-only actions;
  - public detail read-only behavior and Learning/Quiz/copy role actions;
  - deep-link compatibility;
  - keyboard/focus/accessibility names and responsive overflow at approved breakpoints.
- Update existing `/topics` expectations only where the approved Set-first presentation supersedes the Topic-card landing.

### Real-stack

- Migrate existing Topic/public Set scenarios to preserve Topic detail and Topic-scoped deep links while validating the new `/topics` catalog.
- Verify real public visibility, stable ordering, detail not-found behavior and Guest access.
- Verify authenticated USER shell continuity and real copy transaction/navigation without changing cleanup isolation.
- Preserve ADMIN management, private My Sets, Learning and Quiz regressions.
- Use dedicated `.env.test` only for database-dependent tests; never Main/Preview/Production data.

### Performance checkpoint

- Execute the focused request-count/readiness scenario before declaring frontend implementation complete.
- Report the current Topic count, catalog request count, Set-request overlap/concurrency, readiness samples and remote/environment caveats.
- STOP for HUMAN review if the evidence triggers the approved scaling concern.

### Final verification

- Focused unit/service suites.
- Focused mocked Discovery/auth-shell browser suite.
- Focused guarded real-stack Topic/public Set/USER copy suite.
- Relevant existing Topic, Vocabulary Set, Auth shell, Learning and Quiz regression as proportionate to touched routing/actions.
- Production frontend build.
- Touched-file ESLint and backend syntax/tests if backend files unexpectedly become involved.
- `git diff --check`, secret/artifact scan and status/scope review.

## 11. Documentation Impact

- `docs/specs/DISCOVERY_V1_SPEC.md` — retain approved contract and evidence status.
- `docs/plans/DISCOVERY_V1_PLAN.md` — record approved technical approach and checkpoint outcomes.
- `docs/tasks/DISCOVERY_V1_TASK.md` — create only after PLAN approval.
- `docs/UI_UX_SPEC.md` — replace legacy ambiguity with the verified Set-first Discovery interaction and shell behavior.
- `docs/ARCHITECTURE.md` — document client-composed catalog and adaptive public/authenticated route shell if retained.
- `docs/FEATURE_STATUS.md` — track Discovery V1 through IN_PROGRESS and mark DONE only after TEST, REVIEW and HUMAN approval.
- `docs/API_SPEC.md` and `docs/DATABASE.md` require no contract change; update only if a separately approved later decision changes their domain.
- `docs/PROJECT_OVERVIEW.md` requires no scope change because public System Set discovery already belongs to the project scope.

## 12. Implementation Order

1. Mark approved workflow state and establish focused Discovery test fixtures without changing production behavior.
2. Add composition unit tests and mocked request-count/concurrency/failure checkpoints against current behavior.
3. Implement the current-API catalog loader with stable complete-result publication.
4. Run the mandatory composition/readiness checkpoint; stop if current API scaling is materially unsuitable.
5. Integrate the adaptive Discovery route shell while preserving Guest access and existing deep links.
6. Evolve `/topics` into the Set-first landing with search, Topic filter and complete state model.
7. Reuse/adapt the My Sets visual family for public cards and role-specific actions.
8. Integrate public detail with the adaptive shell and preserve read-only/Learning/Quiz/copy behavior.
9. Complete copy pending/error/success and repeated-copy coverage.
10. Complete accessibility and responsive behavior.
11. Run focused unit, mocked browser and guarded real-stack regression.
12. Synchronize approved documentation/status evidence.
13. Stop for HUMAN implementation-completion review before formal final TEST/REVIEW.
14. Perform final TEST/REVIEW only after the required approval, then stop for HUMAN closure approval before commit/push.

## 13. Expected Files / Modules

### Expected modifications

- `frontend/src/app-router.jsx`
- `frontend/src/topics/public-topic-layout.jsx` or a narrowly named adaptive Discovery layout beside it
- `frontend/src/topics/topic-list-page.jsx`
- `frontend/src/topics/topic-detail-page.jsx` only if shell-compatible navigation requires a small adjustment
- `frontend/src/vocabulary-sets/public-vocabulary-set-pages.jsx`
- `frontend/src/services/vocabulary-set-service.js`
- `frontend/src/index.css` only for existing public/My Sets style integration not expressible with current utilities
- `frontend/test/vocabulary-set-service.test.js`
- `frontend/e2e/integration/topic-real-stack.spec.js`
- `frontend/e2e/integration/vocabulary-set-public-real-stack.spec.js`
- `frontend/e2e/integration/vocabulary-set-user-real-stack.spec.js` or existing copy-focused equivalent
- `frontend/e2e/auth/app-layout.spec.js`
- focused mocked Discovery spec/fixture, preferably alongside current auth/browser specs rather than a parallel test framework
- `docs/UI_UX_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/FEATURE_STATUS.md`
- Discovery SPEC/PLAN/TASK evidence files as their gates authorize

### Not expected

- Backend production files
- Prisma schema or migrations
- Package manifests or lockfiles
- API/database documentation changes
- New dependencies

## 14. Risks and Mitigations

- **`1 + T` request growth:** measure current data and controlled scaling; concurrent/bounded-concurrent dispatch; mandatory HUMAN stop before API redesign.
- **Remote latency variance:** record individual request overlap and readiness samples; distinguish app orchestration from remote TEST variance.
- **Partial catalog misrepresentation:** publish only after all required requests succeed; fail atomically and retry the whole attempt.
- **Wrong-shell flash:** wait for existing auth restoration before selecting public versus authenticated shell.
- **Duplicate route/page architecture:** use one adaptive route boundary and shared page implementations.
- **Stale async results:** use attempt/cancellation guards so retry or route changes remain authoritative.
- **Copy double-submit:** retain per-action pending guard; repeated completed copies remain permitted.
- **Role leakage:** backend remains authoritative; tests cover Guest, USER and ADMIN surfaces separately.
- **Legacy test assumptions:** migrate only approved `/topics` presentation assertions; preserve underlying contracts.
- **Style divergence:** reuse My Sets visual tokens/family without importing ownership controls or broadly redesigning public detail.

## 15. HUMAN Checkpoints

1. **PLAN approval:** no TASK creation before HUMAN approves this PLAN.
2. **TASK approval:** no implementation before HUMAN approves the implementation-ready TASK breakdown.
3. **Contract expansion STOP:** any proposed endpoint, API response, schema, server-side pagination or server-side search/filter change requires HUMAN review before work.
4. **Composition performance STOP:** materially poor readiness, excessive requests or unacceptable current-dataset scaling stops implementation before any alternative contract.
5. **Security/copy STOP:** any change to copy, visibility, authentication, authorization or ownership semantics requires HUMAN review.
6. **Implementation-completion checkpoint:** stop after approved implementation and focused evidence, before final TEST/REVIEW if the TASK workflow declares that gate.
7. **Final closure checkpoint:** no commit, push or integration until formal TEST/REVIEW passes and HUMAN authorizes closure.

## 16. Open Questions

None. The current-API composition is the only authorized implementation path; evidence that it is unsuitable triggers the mandatory HUMAN checkpoint rather than an assumed alternative.
