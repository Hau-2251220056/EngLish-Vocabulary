# SPEC: Dashboard V1

**Feature status:** `DONE` — production USER Dashboard V1 is implemented, tested, reviewed and HUMAN closure approved.

**SPEC status:** `APPROVED`

**Human approval:** `APPROVED`

**Implementation authorized:** `NO` — the approved Dashboard V1 workflow is complete.

## 1. Objective

Dashboard V1 replaces the authenticated USER placeholder at `/dashboard` with a concise overview built only from current persisted data and completed feature contracts. It helps a USER understand their current learning state and reach the next relevant area without duplicating the detailed Learning Progress page or presenting unfinished gamification, review or analytics concepts.

Dashboard is a read-only composition surface. It does not become a source of truth, calculate global completion percentages or create learning activity.

## 2. Actors and Access

- **USER:** May open the production Dashboard V1 at `/dashboard` and see only their authenticated identity, persisted Learning Progress summary and owned private Vocabulary Set summaries.
- **ADMIN:** May continue to reach `/dashboard` as the existing safe authenticated landing. ADMIN receives no USER Dashboard data, makes no USER-only Progress/My Sets requests and gains no Admin Dashboard feature in V1.
- **Guest:** Cannot access `/dashboard`; existing authentication redirect behavior remains authoritative.

No new role or permission model is introduced.

## 3. Scope

### 3.1 In Scope

- A production USER overview at the existing `/dashboard` route inside `ProtectedRoute` and `AuthenticatedShell`.
- Personalized greeting from the authenticated identity already held by the Auth context.
- A compact persisted learning snapshot containing exactly:
  - total started;
  - `LEARNING` count;
  - `LEARNED` count.
- An owned private Vocabulary Set overview containing:
  - total owned private Set count from the complete existing USER list;
  - a bounded preview of at most three Set summaries;
  - name, optional description and real Item count;
  - a My Sets/detail action;
  - a Learn action only when `item_count > 0`.
- Quick navigation to public Topics, My Sets and the detailed Learning Progress view.
- Accessible initial loading, first-use empty, section-level partial error/retry and responsive states.
- Existing Auth, App Layout, Learning Progress and Vocabulary Set service/route contracts.

### 3.2 Explicitly Out of Scope

- Global, Topic or Set completion percentages.
- An eligible Vocabulary-universe count or conceptual `NEW` count.
- Continue Learning, recently learned/recently used Sets or learning-recency ranking.
- Words to Review, review queue, due counts, SRS schedules or review actions.
- XP, Level, Streak, Daily Goal or their summaries.
- Achievements or achievement preview.
- Activity/history timeline, accuracy or trend data.
- Quiz or Pronunciation metrics/results.
- Charts, analytics or decorative fake statistics.
- Admin Dashboard or admin statistics.
- New database fields, entities, indexes or migrations.
- A new Dashboard backend endpoint in V1.
- Redesign of `AuthenticatedShell`, Learning Progress, Flashcard, Vocabulary Set or public Topic pages.

## 4. Existing Data and Composition Contract

Dashboard V1 composes three existing authoritative sources:

1. **Authentication context** supplies the authenticated `id`, `display_name`, `email` and `role`. The Dashboard uses `display_name` for the greeting and does not issue a duplicate identity request.
2. **`GET /api/learning/progress?page=1&page_size=1`** supplies the current USER's persisted, unfiltered summary. Dashboard consumes `total_started`, `learning` and `learned` only. The single returned list item, if any, is not used by Dashboard.
3. **`GET /api/my/vocabulary-sets`** supplies the complete current USER-owned private Set summary list. Dashboard derives the total count from the array length and renders at most the first three records in the existing deterministic server order.

The Dashboard must not:

- combine these values into an invented percentage;
- infer Set learning recency from `created_at`, `updated_at` or Vocabulary progress;
- claim that a preview Set is the last learned or recommended Set;
- expose another USER's Set or progress;
- create/update `LEARNING_PROGRESS`, Vocabulary Sets or Authentication state;
- treat compatibility-only `NEEDS_REVIEW` as a due/review queue.

The persisted `NEEDS_REVIEW` count may remain part of the source response but is not rendered as a Dashboard V1 statistic or action. Users can inspect all current statuses in the detailed Learning Progress view.

## 5. User and Admin Flows

### 5.1 USER with Existing Data

1. USER authenticates and reaches `/dashboard` through the existing post-login flow or Sidebar link.
2. Dashboard immediately renders its page identity and accessible loading states for data-backed sections.
3. The Auth context supplies the personalized greeting.
4. The learning snapshot renders server-authoritative persisted counts.
5. The private Set section renders total count and at most three owned Set summaries.
6. USER may navigate to Topics, My Sets, detailed Learning Progress, a Set editor/detail, or directly learn a non-empty owned Set.

### 5.2 First-Use USER

1. A USER with zero persisted progress receives zero learning counts and a clear first-use explanation; no conceptual `NEW` total or percentage is shown.
2. A USER with no private Sets receives a distinct empty Set state with existing navigation to discover Topics or manage My Sets.
3. The two empty conditions are independent.

### 5.3 Partial Failure

1. Progress and My Sets load independently.
2. If one request fails, the other successfully loaded section remains visible.
3. The failed section renders a safe accessible error and a retry action scoped to that section.
4. Retry cannot create duplicate concurrent requests and does not discard the other section's successful data.

### 5.4 ADMIN

1. ADMIN authentication and existing redirect to `/dashboard` remain valid.
2. ADMIN receives a neutral authenticated landing with access to existing management navigation.
3. No request is made to `/api/learning/progress` or `/api/my/vocabulary-sets` for ADMIN.
4. The landing does not display USER learning statistics and does not imply an implemented Admin Dashboard.

## 6. Business Rules

- **BR-01:** Dashboard V1 is a USER-facing read-only overview; existing backend domains remain authoritative.
- **BR-02:** All displayed counts and Set summaries must originate from successful current-session API responses; no fallback sample/fake data is permitted.
- **BR-03:** `total_started`, `LEARNING` and `LEARNED` retain the exact semantics of Learning Progress View V1.
- **BR-04:** Dashboard does not display a global completion percentage because no approved eligible Vocabulary universe exists.
- **BR-05:** Dashboard does not display conceptual `NEW` or derive it by subtraction.
- **BR-06:** Dashboard does not render `NEEDS_REVIEW` as a review queue, due count or SRS CTA.
- **BR-07:** Private Set total equals the length of the owner-scoped list returned by the backend; the UI preview is capped at three.
- **BR-08:** A private Set with `item_count > 0` may expose a Learn action to `/learn/vocabulary-sets/:setId`; an empty Set must not expose that action.
- **BR-09:** Dashboard must not describe Set previews as recent, recommended or in progress.
- **BR-10:** Dashboard reads never create or mutate progress, Sets, sessions or user fields.
- **BR-11:** ADMIN behavior remains safe and does not call USER-only data APIs.
- **BR-12:** Viewing Dashboard is not a meaningful learning event and affects no progress, XP or future streak behavior.

## 7. API Requirements

### 7.1 New API

No new Dashboard endpoint is required or approved for V1.

The conceptual `GET /api/users/me/dashboard` currently present in the broad API documentation is not an implemented V1 contract. It must not be implemented implicitly because its conceptual response includes deferred XP, streak, daily-goal, Topic-progress, Continue-Learning and review-queue fields.

### 7.2 Reused API Contracts

| Source | Access | Dashboard use |
|---|---|---|
| Auth context backed by existing Authentication APIs | Authenticated identity | Greeting and role-safe rendering. |
| `GET /api/learning/progress?page=1&page_size=1` | USER only | Persisted unfiltered summary: total started, Learning and Learned. |
| `GET /api/my/vocabulary-sets` | USER only | Total owned private Set count and bounded preview. |

Existing safe `401`, `403`, validation and `500` behavior remains unchanged. Dashboard maps operational/API failures to safe learner-facing section errors without exposing backend internals.

If implementation planning discovers an unavoidable need for a new endpoint, it must stop and return for HUMAN approval rather than expanding this SPEC silently.

## 8. Data and Database Requirements

- Reuse `USER`, `LEARNING_PROGRESS`, `VOCABULARY_SET` and existing relationships only through their completed APIs.
- No direct frontend database access.
- No Dashboard aggregate/cache table.
- No schema or migration change.
- No new per-Set activity, last-learned, completion, XP, streak, daily activity, achievement or review schedule data.
- Existing `USER.total_xp` and `USER.daily_xp_goal` are not displayed because their full authoritative feature behavior is not implemented.

## 9. UI/UX Functional Contract

### 9.1 Information Hierarchy

1. Page heading and personalized greeting.
2. Compact learning snapshot for total started, Learning and Learned.
3. Private Vocabulary Set overview with total count and bounded preview.
4. Quick navigation to Topics, My Sets and detailed Learning Progress.

Dashboard is an overview, not a copy of the paginated Learning Progress page. It must remain visually consistent with the existing ELVocab App Layout while final composition and styling remain subject to an explicit later UI/UX Design Checkpoint.

### 9.2 States

- **Initial loading:** Data-backed sections communicate loading without rendering premature empty content.
- **First-use progress:** Zero persisted progress is explained without inventing a total or percentage.
- **No private Sets:** The Set section provides a concise empty explanation and existing navigation choices.
- **Partial error:** Each failed section provides an accessible safe message and retry while other successful content remains usable.
- **Pending retry:** Retry control is protected against duplicate activation and communicates pending state.
- **ADMIN landing:** Neutral, non-fake and free of USER-only data loading.

### 9.3 Accessibility and Responsive Requirements

- One clear page heading and semantic section headings.
- Counts are conveyed through text, not color alone.
- Native links/buttons/selectable controls with visible focus and meaningful accessible names.
- Loading and error changes use appropriate live/status/alert semantics without excessive announcements.
- Retry focus remains predictable after completion.
- Set Learn actions are not rendered for empty Sets and are distinguishable from Set management links.
- Desktop, tablet and mobile layouts have no horizontal overflow and preserve current App Layout scrolling/drawer behavior.
- Touch controls meet existing project target-size conventions.
- Any non-essential motion respects `prefers-reduced-motion`.

## 10. Authorization and Security

- Guest access remains blocked by `ProtectedRoute` and authoritative backend authentication.
- USER data APIs remain protected by existing backend USER-role middleware and session-derived `user_id` predicates.
- Dashboard sends no user ID selector and trusts no client-provided ownership field.
- ADMIN must not call USER-only Dashboard sources; frontend role handling is UX protection, while backend `403` remains the security boundary.
- Private Set previews must never include System Sets or another USER's Sets.
- Safe UI errors must not expose raw Prisma, connection, session or stack information.

## 11. Acceptance Criteria

- **AC-01:** An authenticated USER reaches the production Dashboard at `/dashboard` inside the existing App Layout and sees a personalized greeting derived from authenticated identity.
- **AC-02:** Guest access follows existing login redirect behavior; ADMIN receives a safe neutral authenticated landing and triggers no USER-only Progress or My Sets request.
- **AC-03:** Dashboard displays exact server-authoritative persisted values for total started, `LEARNING` and `LEARNED`.
- **AC-04:** Dashboard displays no conceptual `NEW`, global completion percentage or eligible-universe total.
- **AC-05:** Dashboard does not present `NEEDS_REVIEW` as a review queue, due metric, SRS behavior or review CTA.
- **AC-06:** Dashboard displays the exact current USER private Set count and at most three owner-scoped Set summaries from the existing API.
- **AC-07:** Each preview preserves real name, optional description and Item count; it makes no recency, recommendation or learning-progress claim.
- **AC-08:** A non-empty owned Set exposes a valid Learn action; an empty Set exposes no Learn action.
- **AC-09:** Quick navigation reaches Topics, My Sets and detailed Learning Progress using existing routes.
- **AC-10:** Progress and Set sections provide accessible loading and independent first-use/no-Set empty states without premature empty rendering.
- **AC-11:** Failure of either data request leaves the successful section usable and presents a safe accessible scoped retry with duplicate-pending protection.
- **AC-12:** The Dashboard is keyboard-accessible, preserves visible focus, communicates state without color alone, respects reduced motion and has no desktop/mobile horizontal overflow.
- **AC-13:** Repeated Dashboard loads and retries create no Learning Progress, Set, user or session mutation beyond ordinary existing session reads.
- **AC-14:** Existing Authentication, App Layout, Learning/Flashcard, Learning Progress, Topic, Vocabulary and Vocabulary Set behavior does not regress.
- **AC-15:** V1 adds no endpoint, migration, fake data, global/Topic/Set percentage, Continue Learning/recency, review queue/SRS, XP/Level/Streak/Daily Goal, achievement, activity/history, Quiz/Pronunciation metric, chart/analytics or Admin Dashboard behavior.

## 12. Edge Cases

- Progress exists only as `NEEDS_REVIEW`: total started remains the authoritative persisted total, while the visible Learning and Learned counts may both be zero. Dashboard must not mislabel the difference as `NEW` or a due queue.
- USER has progress but no private Sets, or private Sets but no progress: each section renders independently.
- USER has more than three Sets: total remains exact; only the bounded preview is shown.
- A preview Set is empty: management/detail navigation remains available, but Learn is absent.
- Nullable Set description is displayed with safe neutral fallback text or omitted consistently.
- Long display names and Set names wrap/truncate accessibly without horizontal overflow.
- One request resolves after a retry or route change: stale results must not overwrite newer state or update an unmounted page.
- Remote TEST database latency may extend loading states but does not change the functional contract.

## 13. Dependencies and Impact

- **Authentication:** Reuses current identity/session context and role guards.
- **Learning Progress:** Reuses the completed read-only summary semantics; Dashboard never mutates progress.
- **Vocabulary Set:** Reuses the owner-scoped private Set list and existing Learn route authorization.
- **App Layout:** Reuses the existing Header/Sidebar/Main/Footer and scrolling/drawer behavior without redesign.
- **Backend/API:** No new endpoint or contract change planned.
- **Database:** No schema/migration change.
- **Testing:** Reuse frontend service mocks, Auth/App Layout browser tests, guarded Learning Progress and Vocabulary Set fixtures, and combined real-stack infrastructure.
- **Documentation:** After SPEC/PLAN/TASK approval, active Dashboard wording in API/UI/status docs must be narrowed from broad future concepts to this V1 without deleting the deferred product direction.

## 14. Deferred Scope

- Global, Topic and Set progress percentages.
- Continue Learning, recent Set/activity inference and learning-recency persistence.
- Words to Review, due-review count, SRS algorithm/schedule and review actions.
- XP, Level, Streak, Daily Goal and all gamification summaries.
- Achievements.
- Activity/history and accuracy.
- Quiz and Pronunciation metrics/results.
- Charts, trends and analytics.
- Admin Dashboard.
- Dashboard-specific backend aggregation endpoint unless a future approved contract establishes concrete need.

## 15. Open Questions / HUMAN Review

None. This proposed SPEC makes these reviewable V1 decisions explicit:

1. Compose Dashboard from existing Auth, Progress and My Sets contracts; add no endpoint or migration.
2. Cap private Set preview at three using existing deterministic API order without recency claims.
3. Do not render `NEEDS_REVIEW` as a Dashboard statistic or action.
4. Preserve `/dashboard` for both authenticated roles while rendering production overview data only for USER and a neutral safe landing for ADMIN.

## Approval Gate

```text
DASHBOARD V1 FEATURE STATUS: IN_PROGRESS
DASHBOARD V1 SPEC STATUS: APPROVED
DASHBOARD V1 PLAN STATUS: APPROVED
DASHBOARD V1 TASK STATUS: APPROVED
IMPLEMENTATION AUTHORIZED: YES — APPROVED TASK SEQUENCE ONLY
CURRENT TASK: TASK-073
```
