# SPEC: Review Experience V1

> Status: **HUMAN APPROVED — 2026-11-07**
> Draft base: `origin/dev` at `99dccd84d0806823cb119cce61ccc79dd4e294e4`
> This SPEC approval does not authorize PLAN/TASK approval, implementation, tests, commit, push, merge, deployment, feature-status changes, or any other approval record.

## Approval Record

HUMAN approved this SPEC on 2026-11-07 for the frontend-only Review Experience V1 scope defined below, including resolved decisions RE-001 (personal/private and accessible public Set candidates with backend-authoritative access) and RE-002 (dedicated URL-derived SRS-only route `/review/sets/:setId`). This approval does not approve the PLAN, TASK, implementation, tests, commit, push, merge, deployment, or feature-status changes.

## 1. Objective

Review Experience V1 gives an authenticated `USER` one clear entry point for vocabulary review without changing the existing SRS scheduler, persistence, API, or Normal Flashcard experience.

The change introduces a Review Center at `/review`, moves the existing Global Review session UI to `/review/global`, exposes review and learning-progress navigation in the USER sidebar, and makes the Dashboard review action open the center instead of creating a session immediately.

## 2. Existing Capability and Feature Status

The underlying capabilities are already `DONE` in `docs/FEATURE_STATUS.md`:

- Flashcard / Learning with SRS V1;
- Learning Session V1;
- Words to Review and its Dashboard summary;
- Learning Progress View V1;
- the GLOBAL review session delivered by CEFR Learning Path V1.

This SPEC is an approved-design-intent change request over completed capabilities. It does not rebuild or replace their backend behavior.

## 3. Actors and Access

- `USER`: can open Review Center, enter Global Review, enter an accessible Set's existing SRS flow, and open Learning Progress.
- `ADMIN`: receives no Review Experience navigation or USER review access; existing `UserRoute` and backend USER authorization remain authoritative.
- Guest: cannot access Review Center or review sessions; existing protected-route behavior remains unchanged.

No role or permission-model change is in scope.

## 4. Scope

### 4.1 In Scope

- Add USER sidebar group **HỌC TẬP** with:
  - **Ôn tập** → `/review`;
  - **Tiến độ học tập** → `/my/learning-progress`.
- Preserve the existing Learning Progress route and page without redesign.
- Change the Dashboard review CTA from **Ôn ngay** to **Xem ôn tập**, navigate to `/review`, and render it whenever the review summary loads successfully, including `due_count = 0`.
- Add Review Center at `/review` with two clearly separated options:
  - **Toàn cục**;
  - **Theo bộ từ**.
- Move the current Global Review session route from `/review` to `/review/global`.
- Add `/review/sets/:setId` as the dedicated frontend SET review route.
- Preserve Global Review creation, idempotent replay, same-tab resume, rating retry, empty/future-due, inaccessible, expired, completion, explicit continuation, and `AGAIN` requeue behavior.
- Show both USER-owned personal/private Sets and accessible public Sets under **Theo bộ từ**, subject to existing backend authorization and CEFR gating.
- Reuse `LearningFoundationPage`, the existing per-Set SRS state machine, storage identity, APIs and backend contract at `/review/sets/:setId`; do not create a second SET review engine.
- Make the URL establish review context on direct entry/reload, force/retain SRS, hide the mode toggle and prevent switching to Normal.
- Make GLOBAL and SET review-session presentation visually consistent with the current Flashcard UI, without showing the `SRS | Thường` toggle in review context.
- Preserve Normal Flashcard mode and its existing `/learn/vocabulary-sets/:setId` behavior.
- Deliver work in two implementation batches:
  - Batch 1: navigation/sidebar, Review Center, Dashboard CTA, route move, focused tests;
  - Batch 2: presentation-only Flashcard UI reuse for GLOBAL and SET review, plus regression tests.

### 4.2 Out of Scope

- Backend, controller, service, repository, Prisma, schema, migration, database, or API-contract changes.
- A new SRS scheduler, new intervals, new ratings, or client-authored due calculations.
- Fabricated or client-derived per-Set due counts.
- Changes to `(user_id, vocabulary_id)` Learning Progress identity.
- Merging GLOBAL and SET session identity, storage, or backend scope.
- Dashboard redesign, Learning Progress redesign, or general sidebar redesign.
- Changes to XP, Level, Streak, CEFR completion, authorization, Set ownership, or Set visibility.
- Changes to Normal Flashcard behavior or its mode toggle.
- New dependencies, external services, roles, analytics, history, or notifications.

## 5. Existing and Proposed Route Mapping

| Purpose | Existing route | Proposed route | Result |
|---|---|---|---|
| Review Center | None | `/review` | New USER page; no session is created merely by opening it |
| Global Review session | `/review` | `/review/global` | Existing behavior moved to a distinct route |
| Set SRS/Normal learning | `/learn/vocabulary-sets/:setId` | Unchanged | Existing learning entry remains intact |
| Set review context | Existing SRS flow within learning route | `/review/sets/:setId` | Dedicated frontend alias renders `LearningFoundationPage` in URL-derived SRS-only review context; no new backend contract |
| Learning Progress | `/my/learning-progress` | Unchanged | Linked from HỌC TẬP sidebar group |

No existing route collides with `/review/global` or `/review/sets/:setId`. `/review` cannot remain both the Review Center and the Global Review session, so the route move is required. Direct entry or reload on `/review/sets/:setId` must derive context from the matched URL, not transient `location.state`.

## 6. User Flows

### 6.1 Sidebar to Review Center

1. An authenticated USER opens the application shell.
2. The sidebar shows **HỌC TẬP**.
3. USER selects **Ôn tập**.
4. The application opens `/review` without creating a review session.
5. USER chooses **Toàn cục** or **Theo bộ từ**.

### 6.2 Dashboard to Review Center

1. Dashboard independently loads the existing global-review summary.
2. The review card displays the authoritative due state already returned by the backend.
3. When the summary succeeds, the card always displays **Xem ôn tập**, whether `due_count` is positive or zero.
4. A zero-due result retains accurate completed/up-to-date messaging and does not imply that review items exist.
5. USER selects **Xem ôn tập**.
6. The application opens `/review`; it does not create or resume a session until the USER selects a review option.

### 6.3 Global Review

1. USER selects **Toàn cục** from Review Center.
2. The application navigates to `/review/global`.
3. The existing Global Review flow creates or restores a fixed `GLOBAL`/`SRS` session.
4. If zero words are due, the existing empty/future-due state is shown and no session is created.
5. For 1–9 due words, the snapshot contains that number; for 10 or more, it contains at most 10.
6. USER reveals each card and chooses `AGAIN`, `HARD`, `GOOD`, or `EASY`.
7. `AGAIN` remains unresolved and requeues according to existing behavior; a passing rating resolves the item.
8. The final resolved item completes the existing backend session.
9. **Ôn tiếp** explicitly requests a fresh eligibility evaluation.

### 6.4 Review by Vocabulary Set

1. USER selects **Theo bộ từ** from Review Center.
2. The center loads USER-owned personal/private Sets and accessible public Set candidates through existing list/discovery contracts.
3. Public candidates remain subject to existing CEFR access rules. If an existing response provides explicit, sufficiently reliable lock state for that exact Set, the center displays the locked state and prevents starting review. Otherwise it uses neutral candidate wording and does not claim that the Set is unlocked or currently reviewable.
4. Results from multiple list sources are deduplicated by exact Set UUID before display. Personal/private and public sections remain distinguishable; one exact Set is rendered once.
5. USER selects a Set and navigates to `/review/sets/:setId`.
6. The matched URL establishes SET review context even on direct entry or reload.
7. `LearningFoundationPage` reuses the existing SET SRS state/session identity, forces/retains SRS, hides the `SRS | Thường` toggle, and prevents switching to Normal.
8. Backend revalidates access and CEFR gating when SRS data/session operations occur. If access changed or an uncertain candidate is denied, the existing locked/not-found/inaccessible frontend state is shown safely.
9. Backend selects eligible items, limits the fixed session to at most 10, and remains authoritative for ratings, scheduling, XP, Streak, access, and completion.

Personal and public list sources load independently where practical. A failure in one source must not erase a successful sibling source. If both succeed with no eligible candidates, show an empty state. If both fail, show an error with retry. No Set card displays a due count.

### 6.5 Learning Progress

1. USER selects **Tiến độ học tập** in the sidebar.
2. The existing `/my/learning-progress` page opens unchanged.

## 7. Business and State Invariants

- BR-RE-001: Opening Review Center must not create, resume, rate, complete, or mutate a learning session.
- BR-RE-002: Backend remains authoritative for SRS eligibility, order, previews, transitions, timestamps, Progress, XP, Level, Streak, access, and completion.
- BR-RE-003: Learning Progress remains identified by exact `(user_id, vocabulary_id)`, independent of Set.
- BR-RE-004: GLOBAL sessions remain `scope = GLOBAL`, `mode = SRS`, and have no Set identity.
- BR-RE-005: SET sessions remain Set-scoped and must never reuse GLOBAL presentation/storage identity.
- BR-RE-006: Review Center must not combine, translate, or silently resume one scope as the other.
- BR-RE-007: The four ratings and existing scheduler behavior are unchanged.
- BR-RE-008: `AGAIN` remains unresolved and follows the existing requeue/retry/idempotency rules.
- BR-RE-009: A review snapshot has 1–10 items; zero due items produce an empty/future-due state rather than an empty persisted session.
- BR-RE-010: The frontend must not fabricate per-Set due counts from Set size, global summary, cached cards, or Learning Progress rows.
- BR-RE-011: Normal Flashcard remains unchanged, including its route, toggle, navigation, read-only behavior, and session handling.
- BR-RE-012: Review-context UI omits the Normal/SRS toggle but does not weaken backend mode/scope validation.
- BR-RE-013: Route relocation must preserve current Global Review same-tab state and safe event replay semantics; no rating is auto-submitted during navigation or restoration.
- BR-RE-014: ADMIN and Guest access boundaries remain unchanged.
- BR-RE-015: `/review/sets/:setId` derives review context from the route match, always requests SRS and cannot switch to Normal, including after direct navigation or reload.
- BR-RE-016: `/review/sets/:setId` reuses the same USER/Set/SRS run and session-storage identity as the existing SET SRS flow; route context is presentation/orchestration state, not a new backend identity.
- BR-RE-017: Both personal/private and public Set candidates may be offered, but backend authorization and CEFR gating remain final; locked, inaccessible or unauthorized Sets must not be represented as reviewable.
- BR-RE-018: Multi-source Set results are deduplicated by exact Set UUID without merging unrelated Sets that merely share a name.
- BR-RE-019: Explicit reliable lock information supplied by an existing API may disable a public Set review action; absent such information, the frontend uses neutral wording and must not derive entitlement by combining CEFR metadata or inventing an authorization rule.
- BR-RE-020: A successfully loaded Dashboard review summary always exposes **Xem ôn tập**, including zero due; loading/error states do not fabricate a CTA-backed success state or due count.

## 8. Data Requirements

- No new entities, fields, indexes, constraints, relationships, or migrations.
- Reuse `LEARNING_PROGRESS`, `LEARNING_SESSION`, session items/receipts, and existing session-storage namespaces.
- No per-Set review summary is persisted or synthesized.

## 9. API Reuse and Gap

### 9.1 Reused APIs

- `GET /api/learning/review`: global authoritative due summary.
- `POST /api/learning/review/sessions`: GLOBAL fixed-session create/replay.
- `GET /api/learning/sets/:setId?mode=SRS`: existing SET SRS payload.
- Existing Learning Session create/read endpoints for SET SRS resume and lifecycle.
- `POST /api/learning/events`: both SET and GLOBAL rating boundary using distinct `set_id`/session scope.
- Existing Set-list/detail APIs for names and navigation where their current authorization and response are sufficient.

Existing frontend evidence shows `listMySets()` provides the USER-owned personal/private collection. Public discovery currently composes `listTopics()` with topic-scoped `listPublicSystemSets(topicId)`; there is no single USER-ready endpoint that returns only reviewable public Sets or an explicit per-Set review entitlement. A public Set's CEFR metadata alone is not sufficient authorization evidence, and the frontend must not calculate entitlement by joining or inferring across responses. Discovery data can supply neutral candidates, but only the existing Learning/SRS request can authoritatively accept or reject current CEFR/access eligibility. If an existing response inspected during implementation already contains explicit exact-Set lock state, it may be presented without changing the contract.

### 9.2 Explicit Gap

There is no approved API that returns authoritative due counts grouped by vocabulary Set. Review Center must therefore show Set choices without a due count, or use neutral wording such as entering that Set's review. Adding per-Set due summaries is a separate future API/business requirement and is not authorized by this SPEC.

## 10. Acceptance Criteria

- AC-RE-001: USER sidebar contains HỌC TẬP with Ôn tập and Tiến độ học tập links.
- AC-RE-002: ADMIN sidebar does not receive USER review navigation.
- AC-RE-003: `/review` renders Review Center and does not call the Global Review session-creation endpoint on page entry.
- AC-RE-004: Review Center presents Toàn cục and Theo bộ từ as distinct choices.
- AC-RE-005: After a successful Dashboard review-summary load, the CTA always reads **Xem ôn tập** and navigates to `/review` without creating a session, for both positive and zero due counts.
- AC-RE-006: `/review/global` preserves current Global Review creation, replay and restoration behavior.
- AC-RE-007: Global zero-due state creates no session; 1–9 due words create that-sized snapshot; 10+ creates at most 10.
- AC-RE-008: Global `AGAIN` remains unresolved/requeued; passing ratings resolve; final resolution completes the backend session.
- AC-RE-009: Empty, future-due, pending, retry, conflict, expired, inaccessible, complete and explicit continuation states remain available.
- AC-RE-010: Theo bộ từ does not display a fabricated due count.
- AC-RE-011: Review Center offers both USER-owned personal/private Sets and public Set candidates, deduplicated by exact Set UUID; it disables explicitly locked Sets only when existing API data reliably says so and otherwise uses neutral wording without claiming reviewability.
- AC-RE-012: Selecting a Set navigates to `/review/sets/:setId`, which uses existing SET SRS APIs and retains SET identity, authorization, resume, rating and completion behavior.
- AC-RE-013: Direct entry and reload at `/review/sets/:setId` retain SRS review context without relying on React Router navigation state.
- AC-RE-014: SET review context forces/retains SRS, hides the toggle and prevents switching to Normal.
- AC-RE-015: Personal/public loading, partial failure, total failure, empty and retry states are truthful; access changes fail through existing backend-authoritative states.
- AC-RE-016: Review session presentation visually follows the current Flashcard card/reveal/rating language and responsive behavior.
- AC-RE-017: The existing `/learn/vocabulary-sets/:setId` toggle and Normal/SRS behavior remain unchanged.
- AC-RE-018: GLOBAL and SET storage/session state cannot be restored into each other's scope.
- AC-RE-019: No backend, database, Prisma, migration, API-contract, dependency, or role change is introduced.
- AC-RE-020: Focused accessibility behavior covers keyboard reveal, focus restoration, accessible rating names, pending disablement, mobile layout, and reduced motion.
- AC-RE-021: Dashboard focused coverage includes positive due count, zero due count with accurate messaging and visible CTA, and failed summary loading with existing independent error behavior.

## 11. Edge Cases

- Direct navigation or reload at `/review/global` with no stored state.
- Reload with a valid, completed, expired, inaccessible, malformed, or unavailable-storage session state.
- A stored Global Review event whose result was accepted but whose response was interrupted.
- Same-card transition after `AGAIN` and focus restoration.
- Exactly 0, 1, 9, 10, and more than 10 globally due words.
- Set list empty, loading, failed, or containing an empty/up-to-date Set.
- One Set-list source succeeds while the other fails; both sources fail; or the same exact Set UUID is encountered more than once.
- A Set becomes locked, deleted, private to another owner, or loses membership after selection.
- Direct navigation/reload at `/review/sets/:setId` when stored mode was previously NORMAL; review context must still select SRS without deleting unrelated NORMAL state.
- Dashboard review summary fails while sibling Dashboard sections remain usable.
- Dashboard review summary succeeds with `due_count = 0`; the message remains accurate and **Xem ôn tập** still opens the non-mutating center.
- Mobile drawer closes and focus behavior remains correct after navigation.
- Old bookmarks to `/review` now intentionally open the center; no automatic redirect into a session.

## 12. Rollback Considerations

- Route/UI rollback can restore `/review` to `GlobalReviewPage` because no backend or data migration is involved.
- Existing GLOBAL `sessionStorage` keys should remain stable during route relocation so rollback does not orphan otherwise valid same-tab state.
- Presentation extraction must retain existing selectors/semantics where tests or accessibility behavior depend on them; if Batch 2 regresses Normal Flashcard, revert the presentation reuse while retaining Batch 1 routing/center changes.
- No data rollback is required because the feature does not alter persistence contracts.

## 13. Dependencies and Impact

- Frontend router and authenticated shell.
- Dashboard review card.
- Existing Global Review page/session state/service.
- Existing Learning Foundation SRS and Normal flows.
- Existing Set-list sources and route authorization.
- Existing frontend unit/contract tests and mocked browser tests.
- Focused `ui-ux-review` is required after UI implementation and before HUMAN visual approval.

## 14. Approval Gates

1. **Draft gate:** HUMAN reviews this SPEC draft. No implementation is authorized.
2. **SPEC approval gate:** HUMAN explicitly approves or requests changes.
3. **PLAN approval gate:** after SPEC approval, HUMAN explicitly approves the technical PLAN.
4. **TASK approval gate:** after PLAN approval, HUMAN explicitly approves executable tasks and Batch 1 start.
5. **Batch gates:** Batch 1 TEST/REVIEW/HUMAN acceptance precedes Batch 2 implementation unless HUMAN explicitly authorizes a different sequence.
6. **Commit/push gate:** implementation approval does not authorize commit or push; each requires explicit HUMAN authorization.
7. **Merge/deployment gate:** commit/push does not authorize merge, deployment, database work, or approval-record changes.

## 15. Resolved Design Decisions

- RE-001: **Theo bộ từ** includes both USER-owned personal/private Sets and accessible public Set candidates. Existing authorization and CEFR gating remain authoritative, results are deduplicated by exact Set UUID, and no per-Set due count is shown.
- RE-002: SET review uses dedicated frontend route `/review/sets/:setId`. The route reuses `LearningFoundationPage` and the existing SET SRS engine/storage identity, derives review context from the URL, forces SRS and hides/prevents Normal switching. Standard `/learn/vocabulary-sets/:setId` behavior remains unchanged.

These decisions resolve the prior product/route questions but do not approve this SPEC or authorize implementation.

---

## DRAFT AMENDMENT — Due-only Review Center redesign

> Amendment status: **HUMAN APPROVED — 2026-11-08 / IMPLEMENTATION NOT AUTHORIZED**
> Drafted after the 2026-11-08 HUMAN product-direction decision.
> The original 2026-11-07 approval record and approved content above remain immutable historical evidence. This amendment supersedes conflicting Review Center requirements only if HUMAN separately approves the amended SPEC, PLAN, TASK and implementation batch.

### Amendment Approval Checkpoint

HUMAN approved this SPEC Amendment on 2026-11-08 for the due-only Review Center UX and proposed read-only endpoint: **Ôn tất cả** is the global CTA; **Ôn theo bộ từ** shows only Sets with authoritative positive due counts and removes public/private source groupings; the approved multi-Set attribution rule applies; and existing SRS scheduler and session semantics remain unchanged. This approval does not approve the PLAN Amendment, TASK Amendment, implementation, API changes, tests, commit, push or merge.

### A.1 Revised objective and UX

The Review Center focuses only on vocabulary that the current USER has already established Learning/SRS progress for and that is authoritatively due at one backend-owned `evaluated_at`.

- Page title: **Ôn tập từ vựng**.
- Subtitle: **Ôn lại những từ đã học để ghi nhớ lâu hơn.**
- Primary section: **Cần ôn hôm nay**, authoritative global due count and CTA **Ôn tất cả** to `/review/global`.
- Secondary section: **Ôn theo bộ từ**, one ungrouped list containing only Sets whose authoritative due count is greater than zero. Each item shows the Set name and due count and links to `/review/sets/:setId`.
- Empty state: **Bạn đã ôn xong các từ đến hạn!**, with a non-mutating path back to learning.
- Public/private source headings and discovery-candidate wording are removed from the center.
- Loading, zero-due and error states must remain truthful. The proposed endpoint is atomic: a grouping failure is a total error unless an approved future contract explicitly declares partial completeness. No count may be inferred from Set size, visibility, access, cached cards or client-side joins.

Opening `/review` remains side-effect-free. A GLOBAL or SET session is created only through the existing explicit session/learning flow after the USER selects an action. Routes, storage/session identity, the four ratings, scheduler, session limit, Normal learning route and Batch 2 Flashcard presentation intent remain unchanged.

### A.2 Verified API and source audit

- `GET /api/learning/review` is read-only and returns `due_count`, `has_due_items`, `evaluated_at` and `nearest_future_review_at`, but no Set grouping or Set metadata (`backend/src/routes/learning-routes.js`, `getReviewSummary`; `backend/src/services/learning-service.js`, `getGlobalReviewSummary` and `summarizeEvaluatedGlobalReview`).
- Its repository universe is existing `LEARNING_PROGRESS` rows for the USER that are reachable through an unlocked public Set or a USER-owned private Set (`backend/src/repositories/learning-repository.js`, `listReachableReviewCandidates`). Because progress is unique by `(user_id, vocabulary_id)`, the global count counts an accessible due vocabulary once even when it belongs to multiple Sets.
- `GET /api/learning/sets/:setId?mode=SRS` returns `eligible_count`, Set metadata and eligible cards for one selected Set (`projectLearningSet`). It is not a Review Center summary contract: `evaluateProgress(undefined, evaluated_at)` intentionally treats an unstarted Set item as eligible `NEW`, so calling it for every Set would violate the amendment's established-progress-only rule, create an N+1 discovery flow and still require a separate candidate list.
- `POST /api/learning/review/sessions` and other session endpoints are mutating boundaries and cannot populate the center.
- Existing Set-list/discovery APIs expose Set metadata, not authoritative USER due eligibility. Public visibility or Set access does not prove prior learning.
- No existing read-only API returns due count per Set or a due-word preview. No preview is required by this amendment.
- Existing global summary data can distinguish due-now from no-due and exposes an authoritative nearest future review timestamp. The amended center does not add a **Ngày mai** forecast.

Therefore a frontend-only due-only center is **not sufficient** under current contracts.

### A.3 Proposed minimal read-only API extension

Subject to separate API/backend approval, add:

```http
GET /api/learning/review/center
```

Access: authenticated active `USER`; existing authentication, USER-role authorization and CEFR path rules apply. Guest/ADMIN behavior follows the existing Learning router boundary.

Proposed response:

```json
{
  "success": true,
  "data": {
    "evaluated_at": "2026-11-08T00:00:00.000Z",
    "due_count": 3,
    "has_due_items": true,
    "nearest_future_review_at": null,
    "sets": [
      {
        "set_id": "00000000-0000-0000-0000-000000000000",
        "name": "Academic English",
        "due_count": 2
      }
    ]
  }
}
```

Proposed API semantics, requiring complete amendment/API approval before implementation:

1. Evaluate all results at one backend-owned instant and reuse the existing `evaluateProgress` scheduler semantics.
2. The candidate universe contains only persisted `LEARNING_PROGRESS` rows for the current USER; an absent progress row never contributes to center counts.
3. Apply the existing GLOBAL reachability rule: an unlocked public Set membership or USER-owned private Set membership makes a progressed vocabulary globally reachable. Backend authorization remains final when a Set route opens.
4. Global `due_count` deduplicates by `vocabulary_id`, consistent with shared progress keyed by `(user_id, vocabulary_id)` and the existing global summary.
5. Each Set `due_count` deduplicates by `(set_id, vocabulary_id)`. A vocabulary contributes only when the USER has persisted `LEARNING_PROGRESS`, the existing backend SRS scheduler classifies it as due at `evaluated_at`, it belongs to that Set, and the Set is accessible under existing backend ownership, public-visibility and CEFR-authorization rules.
6. One due vocabulary may contribute once to every accessible containing Set. Therefore the sum of Set counts may exceed global `due_count`; the frontend must never derive the global count by summing Set counts.
7. Shared progress remains keyed by `(user_id, vocabulary_id)`; no canonical source Set is introduced.
8. The GET performs no session creation, row lock for mutation, progress write, scheduler transition, XP/Streak action or other mutation.
9. V1 returns no due-word preview. Adding preview content requires a separate privacy/payload decision.

The dedicated endpoint avoids making every Dashboard summary request load Set group data and keeps the existing `GET /api/learning/review` contract stable.

### A.4 Multi-Set source-of-truth decision — HUMAN DECISION APPROVED

> Decision-level checkpoint: **HUMAN DECISION APPROVED — 2026-11-08**. This approval resolves only multi-Set attribution. It does not approve this amendment, its API contract, PLAN, TASK, implementation, tests, commit, push or merge.

Verified current state:

- Progress identity is USER + Vocabulary, not USER + Set + Vocabulary.
- `VOCABULARY_SET_ITEM` allows one Vocabulary to belong to multiple Sets while remaining unique within each Set.
- The current system has no canonical learning-source Set stored on `LEARNING_PROGRESS` and no rule assigning a due vocabulary to exactly one Set.

Approved attribution semantics:

- Global due count deduplicates by `vocabulary_id`.
- Per-Set due count deduplicates by `(set_id, vocabulary_id)`.
- A vocabulary contributes to a Set only when the USER has persisted `LEARNING_PROGRESS` for it, the existing backend SRS scheduler classifies it as due at the shared evaluation timestamp, it belongs to the Set, and the Set is accessible under existing backend ownership, public-visibility and CEFR-authorization rules.
- A vocabulary in multiple accessible Sets may contribute once to each containing Set. The sum of per-Set counts may therefore exceed the unique global due count.
- The frontend must never calculate global due count by summing Set counts.
- Shared progress remains keyed by `(user_id, vocabulary_id)`; no canonical source Set is introduced.
- Scheduler behavior, session semantics and the existing 1–10 due-word session limit remain unchanged.

### A.5 Amended acceptance criteria

- `/review` renders the revised title/subtitle and never creates a session on load.
- **Cần ôn hôm nay** shows only an authoritative count; **Ôn tất cả** navigates to `/review/global`.
- **Ôn theo bộ từ** contains no public/private grouping and shows only authoritative positive-due Set entries with name and count.
- Zero due shows the approved completion message and a path back to learning without creating an empty session.
- API failure is never rendered as zero. The atomic draft contract renders a retryable total error rather than unmarked partial data; any future partial response must label completeness explicitly.
- No unstarted/`NEW` Set item is counted merely because `GET /api/learning/sets/:setId?mode=SRS` would consider it eligible for learning.
- No public visibility, ownership, CEFR metadata or Set access alone is treated as proof that the USER studied a word.
- Global count is deduplicated by `vocabulary_id`; each Set count is deduplicated by `(set_id, vocabulary_id)` and includes only persisted, due, belonging and accessible vocabulary.
- A multi-Set vocabulary may contribute to every accessible containing Set, so Set counts are non-additive; the frontend never sums them to obtain the global count.
- Shared `(user_id, vocabulary_id)` progress, scheduler/session semantics and the 1–10 due-word session limit remain unchanged; no canonical source Set is created.
- No **Ngày mai** forecast is introduced.
- Existing GLOBAL and SET session behavior and Batch 2 presentation scope remain unchanged.

### A.6 Amendment approval gates and unresolved decisions

The multi-Set attribution decision is resolved at the decision level. Remaining gates are:

1. HUMAN approves the amended SPEC and the new read-only API contract.
2. HUMAN separately approves the amended PLAN and TASK definitions.
3. HUMAN separately authorizes backend/API implementation and the revised Review Center batch.
4. TEST, REVIEW and HUMAN visual acceptance remain required before commit/push/merge gates.

Until those gates pass, the original Batch 1 implementation remains **unaccepted pending HUMAN review**, and this amendment authorizes no implementation.

## AMENDMENT — Review Center Set scope, count guidance and UI polish

> Amendment status: **HUMAN APPROVED — 2026-11-08 / IMPLEMENTATION NOT AUTHORIZED**
> This documentation draft does not authorize implementation, tests, API execution, database access, commit, push or merge. All earlier approval records and decisions remain unchanged.

### RC.1 Bounded objective

Improve Review Center clarity without changing review eligibility or session behavior:

- identify each returned Set as public or personal using authoritative existing Set data;
- explain the relationship between due counts and SET SRS session contents;
- polish only the `/review` layout, hierarchy, responsive behavior and interaction presentation.

### RC.2 Set classification contract

Each Review Center Set entry adds `set_scope` with exactly one of these values:

- `PUBLIC`: the existing Set has `is_public = true`;
- `PERSONAL`: the existing Set has `is_public = false` and is owned by the authenticated USER.

The backend derives this classification from authoritative Set visibility and access data. The response must not expose `owner_id`, infer copied-from ancestry or add a new entitlement rule. Existing ownership, public visibility and CEFR authorization remain authoritative. No schema migration is required.

The Review Center renders **Bộ từ công khai** for `PUBLIC` and **Bộ từ cá nhân** for `PERSONAL`. It preserves exact `set_id` identity for rendering and `/review/sets/:setId` navigation.

### RC.3 Review-count guidance

The page must explain, concisely and accessibly, that:

- Review Center due counts include previously studied vocabulary that is currently due;
- a SET SRS session may additionally contain unstarted `NEW` vocabulary;
- the global due count deduplicates a vocabulary across Sets;
- per-Set counts are not necessarily additive and must not be summed by the frontend.

All displayed numbers remain unchanged backend-provided values. This amendment does not alter the approved global or per-Set attribution rules.

### RC.4 Focused presentation requirements

- Keep the statistics card compact on desktop and full-width on small screens.
- Give Set name, scope label, due count and CTA a clear hierarchy without decorative excess.
- Use restrained ELVocab blue accents, consistent spacing and aligned CTAs.
- Preserve semantic heading order, visible keyboard focus, meaningful hover states and accessible action names.
- Allow long Set names to wrap without obscuring count, scope or action.
- Preserve loading, error, retry, zero-due and positive-due states.
- Do not redesign Dashboard, Progress, Flashcard or unrelated pages.

### RC.5 Invariants and acceptance criteria

- `GET /api/learning/review/center` remains read-only and adds only the authoritative `set_scope` field to each Set entry.
- Every returned Set has a valid `PUBLIC` or `PERSONAL` value consistent with existing backend access rules.
- No owner identifier or source/copy ancestry is exposed.
- Set cards retain their original UUID keys and navigate to the same SET SRS route.
- Explanatory copy distinguishes due studied vocabulary from possible `NEW` session items and explains non-additive counts.
- The frontend neither recalculates counts nor changes SRS eligibility.
- SRS scheduling, learning progress, session persistence, CEFR authorization, Normal learning, Global Review and the existing BUG-01 loading repair remain unchanged.
- No Prisma/schema/migration, dependency or new endpoint is introduced.

### RC.6 Approval gate

HUMAN approved this amendment's SPEC, PLAN and additive API-contract direction on 2026-11-08. TASK-RE-A07 through TASK-RE-A10 remain implementation-unauthorized; implementation, tests, commit/push and merge retain separate explicit HUMAN gates.
