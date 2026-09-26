# PLAN: Dashboard V1

**Source SPEC:** `docs/specs/DASHBOARD_V1_SPEC.md` (HUMAN APPROVED)

**PLAN status:** `APPROVED`

**Human approval:** `APPROVED`, including the no-backend/no-migration conclusion and mandatory pre-production UI/UX checkpoint.

**Implementation authorized:** `NO` — the approved Dashboard V1 workflow is complete.

## 1. Summary

Dashboard V1 will replace the current authenticated `/dashboard` placeholder with a read-only USER overview composed in the frontend from three completed capabilities:

1. the existing Authentication context for identity and role;
2. `learningService.getLearningProgress({ page: 1, pageSize: 1 })` for the persisted, unfiltered Learning Progress summary;
3. `vocabularySetService.listMySets()` for the complete owner-scoped private Set list.

The Dashboard will make the two USER data requests independently, retain successful section data when the other request fails, and provide section-scoped retry with stale-response and duplicate-request protection. It will derive only the approved private Set count and a preview capped at three records in existing server order.

No backend route, controller, service, repository, Prisma model, migration, dependency or App Layout redesign is planned. The shared `/dashboard` route remains available to both authenticated roles, but the production USER data composition runs only for `USER`; `ADMIN` receives a neutral authenticated landing and triggers neither USER-only request.

A mandatory HUMAN UI/UX Design Checkpoint follows the functional composition foundation and precedes all production Dashboard presentation work.

## 2. Scope and Acceptance-Criteria Traceability

| Approved SPEC criterion | Planned implementation / evidence |
|---|---|
| AC-01 | Replace the placeholder at the existing protected `/dashboard` route; use Authentication context identity for the USER greeting. |
| AC-02 | Role-conditional Dashboard orchestration plus Guest/Auth routing tests proving ADMIN makes no USER-only requests. |
| AC-03–AC-05 | Render only server summary `total_started`, `learning` and `learned`; unit/browser assertions exclude conceptual `NEW`, percentage and review-queue semantics. |
| AC-06–AC-08 | Existing owner-scoped My Sets service, exact array count, `slice(0, 3)` preview, real metadata and conditional non-empty Learn action. |
| AC-09 | Existing route links to Topics, My Sets and detailed Learning Progress. |
| AC-10–AC-11 | Independent section state, accessible loading/empty/error/retry and pending/stale-response tests. |
| AC-12 | HUMAN UI/UX checkpoint followed by keyboard, focus, reduced-motion and responsive browser verification. |
| AC-13 | GET-only composition and guarded real-stack before/after invariance evidence. |
| AC-14 | Scoped Auth/App Layout, Learning Progress and Vocabulary Set frontend/real-stack regressions. |
| AC-15 | Diff, documentation and formal review proving no endpoint, migration, fake data or deferred feature was added. |

## 3. Affected Areas

- **Database:** None. Existing data is read through completed APIs; no Prisma schema or migration change.
- **Backend/API:** None. Reuse current Authentication, `GET /api/learning/progress` and `GET /api/my/vocabulary-sets` contracts unchanged.
- **Frontend:** Replace the Dashboard placeholder with a role-safe page; compose existing services; add feature-scoped presentation/state styling after design approval.
- **App Layout:** Reuse `AuthenticatedShell` and its existing Dashboard navigation unchanged.
- **Tests:** Add focused Dashboard component/browser coverage, guarded real-stack verification and scoped shared-boundary regressions.
- **Documentation:** Synchronize active Dashboard V1 API/UI/status wording after PLAN and TASK approval; retain broad future concepts as explicitly deferred.

## 4. Existing Code and Conventions to Reuse

- `frontend/src/app-router.jsx` — preserve `/dashboard` under `ProtectedRoute` and `AuthenticatedShell`; replace only the placeholder route element.
- `frontend/src/pages/dashboard-placeholder.jsx` — current replacement boundary; remove or supersede only when the production Dashboard route exists.
- `frontend/src/auth/use-authentication.js` and the Authentication provider/store — consume the already-loaded `user` identity and role without another `/api/auth/me` request.
- `frontend/src/auth/ui/authenticated-shell.jsx` — preserve existing Dashboard navigation, desktop scrolling and mobile drawer behavior without redesign.
- `frontend/src/services/learning-service.js` — reuse `getLearningProgress` and its validated/safe error contract.
- `frontend/src/services/vocabulary-set-service.js` — reuse `listMySets` and its owner-scoped list/error contract.
- `frontend/src/learning-progress/learning-progress-page.jsx` — behavioral reference for safe loading/error/retry, stale-response and accessible focus handling; Dashboard must not duplicate the detailed page.
- `frontend/src/vocabulary-sets/my-vocabulary-sets-page.jsx` — reference for Set metadata, empty/pending behavior and existing routes.
- `frontend/e2e/auth/app-layout.spec.js`, `frontend/e2e/auth/learning-progress.spec.js` and service unit tests — reuse mocked route/service and accessibility conventions.
- `frontend/e2e/integration/learning-progress-real-stack.spec.js` and `vocabulary-set-user-real-stack.spec.js` — reuse guarded fixture, login, owner-isolation and cleanup infrastructure.

No new frontend state library, data-fetching library or Dashboard API service is required. The page should call the two existing domain services directly so their contracts remain independently testable.

## 5. Documentation Synchronization Gate

After HUMAN PLAN and TASK approval, synchronize only the approved Dashboard V1 contract before implementation:

1. **`docs/API_SPEC.md`:** mark the broad conceptual `/api/users/me/dashboard` and its gamification/recency fields as deferred; record that V1 composes the existing Progress and My Sets reads without a Dashboard endpoint.
2. **`docs/UI_UX_SPEC.md`:** replace active Dashboard assumptions with the approved functional hierarchy, role behavior and state boundaries while leaving detailed visuals to the checkpoint.
3. **`docs/FEATURE_STATUS.md`:** advance only User Dashboard to the workflow-appropriate in-progress state; leave XP, Level, Streak, review, Continue Learning and Admin Dashboard `TODO`.
4. **`docs/ARCHITECTURE.md`:** no architecture change is expected. Update only if an active Dashboard contract contradicts frontend composition through existing services.
5. **`docs/DATABASE.md`:** no change is required because Dashboard adds no persistence.

Documentation synchronization does not authorize production implementation and must not mark Dashboard `DONE`.

## 6. Database, Backend and API Plan

### 6.1 Schema and Persistence Conclusion

- Create no model, field, relation, index or migration.
- Create no cached Dashboard aggregate and no direct frontend database access.
- Do not read dormant XP/daily-goal fields or infer recency, eligible vocabulary totals or Set progress.
- Dashboard rendering and retry must not create or mutate Authentication, Learning Progress, Vocabulary Set or session-domain data beyond ordinary existing session reads.

### 6.2 Existing API Composition

For an authenticated `USER`, perform these independent reads:

| Existing source | Dashboard usage |
|---|---|
| Authentication context | `display_name` greeting and role-safe rendering; no duplicate identity request. |
| `GET /api/learning/progress?page=1&page_size=1` | Consume only `summary.total_started`, `summary.learning` and `summary.learned`; ignore the list item and compatibility `needs_review` value. |
| `GET /api/my/vocabulary-sets` | Exact total from array length; preview first three records in returned deterministic order. |

The Dashboard sends no user identifier or ownership selector. Existing backend session identity and USER authorization remain authoritative.

For authenticated `ADMIN`, render the neutral landing before starting USER data effects. No request may be sent to either USER-only endpoint. Guest behavior remains owned by `ProtectedRoute`.

If implementation reveals that either completed API cannot satisfy the approved contract, stop and return for HUMAN review. Do not add a Dashboard endpoint, query option or backend change within this PLAN.

## 7. Frontend Implementation Plan

### 7.1 Functional Composition Foundation

Create a focused Dashboard feature/page area and update the existing route element. The page will:

- consume `user` from the existing Authentication hook;
- branch on the authenticated role before any USER request starts;
- maintain separate Progress and My Sets states (`idle/loading/success/error`) rather than one all-or-nothing request state;
- start USER requests concurrently while keeping their resolution and retries independent;
- retain a successful section while the failed section retries;
- protect retries from duplicate activation;
- ignore stale responses after a newer request or unmount;
- store no duplicated authoritative business state outside the page lifecycle.

Derived presentation values are limited to:

- the three approved Progress summary fields;
- owned private Set total as the returned array length;
- private Set preview as at most the first three returned summaries;
- Learn-action eligibility as `item_count > 0`.

Do not sort by timestamps, infer recency/recommendation, calculate percentages or turn `NEEDS_REVIEW` into visible review behavior.

### 7.2 Mandatory HUMAN UI/UX Design Checkpoint

After the functional state/composition contract is testable, but before production Dashboard UI implementation, record a repo-native checkpoint covering:

- USER greeting and page information hierarchy;
- the three-count learning snapshot without global percentage or `NEW`;
- bounded private Set preview and distinction between Set management/detail and Learn actions;
- quick navigation to Topics, My Sets and detailed Learning Progress;
- independent initial loading, first-use Progress empty, no-private-Set empty and partial-error/retry states;
- neutral ADMIN landing with no USER statistics;
- desktop/tablet/mobile composition within the existing App Layout;
- keyboard order, focus after retry, live-region semantics, touch targets, long text and reduced motion.

HUMAN approval of this checkpoint is a hard dependency. Production Dashboard presentation must not begin before approval. The checkpoint may decide visual composition only; it cannot add charts, metrics, APIs, actions or other deferred behavior.

### 7.3 Production Dashboard After Checkpoint Approval

Implement the approved page presentation using feature-scoped components/styles only where they improve clarity or testability. It will render:

- one clear Dashboard heading and personalized greeting;
- compact cards/regions for total started, Learning and Learned;
- private Set total and no more than three Set summaries with real name, optional description and Item count;
- Set management/detail navigation for each preview and a Learn link only for `item_count > 0`;
- quick links to `/topics`, `/my/vocabulary-sets` and `/my/learning-progress`;
- section-specific loading, first-use/no-Set empty, safe error and retry/pending states;
- a neutral ADMIN landing that preserves existing management navigation through the shell.

Use semantic headings, native links/buttons, textual labels independent of color and existing ELVocab tokens/patterns. Do not alter `AuthenticatedShell`, add Sidebar destinations, or copy the detailed Progress list into Dashboard.

## 8. State, Error and Accessibility Plan

- **Initial load:** Render section loading semantics immediately; never show zero/empty content before its request settles.
- **Independent success/error:** Each section owns its data and error. A later failure must not erase its last successful data unless the approved checkpoint explicitly chooses a safe refresh presentation.
- **Retry:** Retry only the failed source, expose `aria-busy`/disabled protection, and restore predictable focus to the section result or error control.
- **Stale response:** Associate each source with its current request generation or abort lifecycle so an older response cannot replace newer retry data.
- **First use:** Distinguish zero persisted Progress from zero private Sets; never invent `NEW` or total available Vocabulary.
- **ADMIN:** Render without mounting or invoking USER data loaders.
- **Responsive:** Preserve the existing App Layout breakpoints, scrolling and drawer; no horizontal overflow or fixed content that hides the footer.
- **Reduced motion:** Any optional visual transition follows existing reduced-motion behavior; motion is not required for comprehension.

## 9. Testing Strategy

### 9.1 Focused Frontend Unit / Component Coverage

Add focused Dashboard coverage for:

- USER greeting from Authentication context and absence of a duplicate identity request;
- exact server-authoritative three-count snapshot and exclusion of `NEW`, percentage and review language;
- exact private Set count, maximum-three preview and preserved server order;
- non-empty versus empty Set Learn-action eligibility;
- quick-link destinations;
- independent initial loading, first-use Progress empty and no-private-Set empty states;
- one source succeeding while the other fails;
- source-scoped retry, duplicate-pending protection and stale-response rejection;
- safe errors without backend detail leakage;
- ADMIN neutral rendering with zero Progress/My Sets calls;
- semantic headings, live/alert/status behavior, keyboard focus and reduced-motion-safe presentation.

Reuse existing service tests as contract evidence; add Dashboard service tests only if implementation introduces a helper with meaningful logic. Do not duplicate completed Learning/Vocabulary Set service coverage.

### 9.2 Mocked Browser and Responsive Coverage

Extend the existing Auth/App Layout browser infrastructure or add one focused Dashboard spec covering:

- Guest redirect, USER Dashboard and safe ADMIN landing;
- USER partial-error/retry behavior and role-safe request interception;
- keyboard navigation and retry focus;
- mobile/tablet/desktop layout, long names, touch targets and no horizontal overflow;
- preservation of shell Header/Sidebar/Main/Footer and mobile drawer behavior.

### 9.3 Guarded Real-Stack Verification

Use the existing guarded dedicated TEST DB and real-stack fixture conventions to verify:

- authenticated USER sees their exact persisted Progress counts and only their private Sets;
- more than three Sets remain an exact total with a three-record preview;
- empty Sets omit Learn while non-empty Sets link to the existing learning route;
- another USER's private Sets/progress never appear;
- ADMIN reaches `/dashboard` without USER-only API requests or authorization noise;
- repeated Dashboard load/retry causes no Progress/Set mutation;
- controlled fixtures are removed with targeted cleanup.

No migration/reset beyond the already guarded test harness is introduced by Dashboard work. Never use Main, Preview or Production data.

### 9.4 Scoped Regression Coverage

Run only the shared-boundary regressions justified by Dashboard changes:

- frontend Auth routing and App Layout/navigation/browser coverage;
- Learning Progress service/page and guarded real-stack coverage;
- USER Vocabulary Set service/page and guarded real-stack coverage;
- Learning route access for the preview Learn action;
- frontend lint, focused unit suite, production build and `git diff --check`.

Record exact PASS/FAIL/TODO/NOT RUN counts. Do not rerun unrelated backend suites when no backend code or contract changed unless formal review identifies an evidence gap.

## 10. Documentation and Status Strategy

- Keep the approved SPEC and later PLAN/TASK metadata consistent with HUMAN approvals.
- Track User Dashboard separately from XP, Level, Streak, Daily Goal, Words to Review, Continue Learning and Admin Dashboard.
- During implementation, mark only User Dashboard `IN_PROGRESS` according to repository workflow.
- At formal closure, record AC evidence and mark User Dashboard `DONE` only after IMPLEMENT, TEST, REVIEW and HUMAN final approval.
- Preserve completed Authentication, Learning Progress, Vocabulary Set, App Layout and Flashcard histories unchanged.

## 11. Implementation Order and Dependencies

1. After HUMAN PLAN and TASK approval, synchronize the active Dashboard V1 documentation and set only User Dashboard to the appropriate in-progress workflow state.
2. Add the minimal role-safe Dashboard composition/state foundation using existing Auth, Progress and My Sets contracts; keep the placeholder-level presentation only.
3. Add focused functional tests for request isolation, ADMIN no-call behavior, bounded derivation and read-only composition.
4. Record the Dashboard V1 UI/UX Design Checkpoint and obtain explicit HUMAN approval.
5. Implement the production USER Dashboard and neutral ADMIN landing according to the approved checkpoint.
6. Add/complete frontend unit, mocked browser, accessibility and responsive coverage.
7. Run guarded real-stack verification, targeted cleanup and scoped Auth/App Layout, Learning Progress, Vocabulary Set and Learning-route regressions.
8. Perform formal TEST and REVIEW against AC-01 through AC-15; prepare closure/status evidence and wait for HUMAN final approval before marking `DONE`.

Dependency chain:

```text
Approved SPEC / PLAN / TASK
    -> Documentation synchronization
    -> Role-safe composition foundation + focused tests
    -> HUMAN UI/UX DESIGN APPROVAL
    -> Production Dashboard UI
    -> Browser / guarded real-stack / regressions
    -> Formal TEST / REVIEW
    -> HUMAN closure approval
    -> DONE
```

## 12. Safety and Rollback Boundaries

- Every phase is frontend/documentation-only until guarded verification; no schema/backend rollback is needed.
- The route replacement can be reverted together with the feature page without changing existing APIs or stored data.
- Keep all Dashboard derivation local and simple; do not introduce shared global state or a premature generic aggregation layer.
- Do not commit local environment files, fixture credentials, Playwright reports, screenshots, traces, logs or generated artifacts.
- Any discovered need for a new endpoint, schema change, App Layout redesign, eligible Vocabulary universe, recency signal or new business metric stops the workflow for HUMAN contract review.

## 13. Risks and Considerations

- **Role-shared route:** `/dashboard` must remain a valid post-login target for ADMIN, so wrapping the whole route in `UserRoute` would regress Authentication/Admin behavior. Branch inside the page before USER effects instead.
- **Independent asynchronous state:** A single `Promise.all`/single error state would violate partial-success requirements. Keep source lifecycles separate and cover stale retry behavior.
- **Remote TEST DB latency:** Loading states may remain visible longer in guarded verification. Do not treat latency alone as a UI defect or add caching/fake fallback data.
- **Set preview meaning:** Existing list order is deterministic but not approved as recency. Preserve it and avoid recent/recommended language.
- **Progress compatibility:** `total_started` can exceed `learning + learned` when `NEEDS_REVIEW` rows exist. Do not label the difference as `NEW`, due or erroneous.
- **Broad legacy Dashboard docs:** Synchronization must narrow the active V1 contract without deleting future product direction or implementing deferred gamification.
- **Regression surface:** Dashboard is a common post-login route used by USER and ADMIN tests, so mocked API setup must make role-specific requests explicit rather than relying on incidental interception.

## 14. Open Questions

None. The approved SPEC fixes the data sources, three-Set limit, role behavior, read-only boundary, independent error semantics and deferred scope. Visual composition remains intentionally gated by the mandatory HUMAN UI/UX Design Checkpoint.

## Approval Gate

```text
DASHBOARD V1 SPEC STATUS: HUMAN APPROVED
DASHBOARD V1 PLAN STATUS: APPROVED
DASHBOARD V1 TASK STATUS: APPROVED
IMPLEMENTATION AUTHORIZED: YES — APPROVED TASK SEQUENCE ONLY
CURRENT TASK: TASK-073
```
