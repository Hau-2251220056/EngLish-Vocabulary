# Leaderboard V1 technical design and integration

**Status: local implementation and integration complete. HUMAN visual acceptance PASS. Dev CI, Preview and Production release pending.**

Prompt 330 records HD-65 through HD-69 and reuses the static evidence from Prompts 329 and 329-R. The planning baseline is `dev` at `4597116d282bba4c8f1f300acdf7d28493c0738e`. Remote `main` is `7ab9a963bf357379e88c3d2cf5e0ff332b3383c1`. Guarded Integration #154 completed successfully for the baseline. [Workflow run](https://github.com/Hau-2251220056/EngLish-Vocabulary/actions/runs/45952806038)

## Scope and evidence

| Decision | Scope |
| --- | --- |
| HD-65 | HUMAN approved cross-learner display of privacy-filtered names and safe avatars in Prompt 331. HD-71 defines the avatar implementation. The privacy limitations below remain open. |
| HD-66 | Rank active `USER` accounts with positive XP. Use weekly by default, monthly and all-time as alternatives, competition ranks, three podium rows, and ten rows per page. Zero XP is unranked. |
| HD-67 | Show rank, learner identity, XP, current streak and the signed-in learner's summary and page. Preserve XP, SRS, streak and CEFR behavior. Rank history, mastery, badges and public profiles are outside V1. |
| HD-68 | Refresh automatically while visible and on restoration. Invalidate after validated new XP or eligible streak-changing completion. Keep authenticated caches isolated and poll about every 60 seconds in TEST before choosing a Production interval. Two visible windows may poll independently. |
| HD-69 | Add `/my/leaderboard` and **Bảng xếp hạng** after **Tiến độ học tập** in the shared learner sidebar and mobile drawer. Follow Bright & Clean at 320, 390, 768 and 1440px. |
| HD-70 | Implement on local `dev`. Feature Freeze was reopened for Leaderboard V1 only. Publishing the changes requires a separate approval. |
| HD-71 | Use local initials and deterministic pastel colors derived solely from privacy-filtered display labels. Use neutral styling for generic labels. No external avatar fetch or new storage. |
| HD-72 | Retain approximately 60-second visible-page polling on current TEST evidence. Production performance and concurrent capacity remain pending. |
| HD-73 | HUMAN accepted the Gemini-derived design and compact mobile podium. The accepted display uses actual server ranks and preserves ties. |

V1 uses existing tables and indexes, Express, Prisma and the existing Vercel HTTP route. Scope excludes schema, indexes, migrations, dependencies, Redis, scheduled jobs, streaming, Supabase Realtime, Data API changes and unrelated refactoring.

**Verified in source.** `XP_REWARD` records positive awards and deduplicates by source event and reward identity. The reward insert and `USER.total_xp` increment run in the owning activity transaction. The ledger migration preserves legacy totals without backfilling historical rewards. `STREAK_DAY` supports the existing Vietnam-day streak projection. [Prisma models](../../backend/prisma/schema.prisma) · [XP migration](../../backend/prisma/migrations/20261016000000_add_xp_level_v1/migration.sql) · [XP repository](../../backend/src/repositories/xp-reward-repository.js) · [Streak domain](../../backend/src/services/streak-domain.js)

XP fairness follows the existing reward rules. Quiz and eligible SRS can award independently for the same vocabulary, valid later review cycles can award again, and distinct vocabulary IDs can earn separately even if their headwords match. V1 preserves this behavior. All-time XP includes any retained legacy total, so it cannot be partitioned exactly by vocabulary source.

## Backend design and API

`GET /api/leaderboard?period=weekly|monthly|all&page=1` requires an authenticated, active learner with role `USER`. Read identity from the session. Allow only `period` and `page`, once each. Default to `weekly` and page 1. Validate `page` as a positive base-10 integer no larger than 2,147,483,647. Page size is fixed at 10. Apply `Cache-Control: private, no-store` before auth so errors carry the same policy.

Return the existing `{ success: true, data: … }` envelope.

| Data field | Contract |
| --- | --- |
| `period`, `timezone`, `xp_basis` | Requested period, `Asia/Ho_Chi_Minh` and `period_rewards` for week/month or `lifetime_total` for all-time. |
| `window`, `as_of` | `window: { start, end }` contains ISO 8601 UTC instants for a bounded period and two `null` values for all-time. `as_of` is the UTC evaluation instant for this snapshot. |
| `top`, `items` | First 0–3 ranked rows in the full ranking and the 0–10 rows on the requested page. Each has `rank`, `position`, `display_name`, `avatar_url` (nullable), `xp`, `current_streak` and `is_me`. The privacy projection below governs names and avatars. |
| `me` | Same fields plus `page`. If unranked, `xp` is 0 and `rank`, `position` and `page` are `null`. Streak is still returned. |
| `pagination` | `page`, `page_size: 10`, `total_items`, `total_pages`. No ranked learners means zero total pages. A valid page past the end returns an empty `items` array and retains `top`, `me` and totals. |

Use the existing error envelope with `400 VALIDATION_ERROR`, `401 AUTHENTICATION_FAILED` and `403 FORBIDDEN`. Map unexpected repository failures to sanitized `500 INTERNAL_SERVER_ERROR`. An empty ranking is a successful response.

**Time and scoring.** Weekly starts Monday at 00:00 Vietnam time. Monthly starts on day 1 at 00:00 Vietnam time. Compute half-open bounds `[start, end)` from one authoritative clock instant and exclude future ledger timestamps beyond `as_of`. Weekly and monthly sum `XP_REWARD.xp_amount` at the stored reward creation timestamp. The ledger uses `TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP`. PostgreSQL converts the transaction timestamp to the database session timezone before storing it without a timezone. Prompt 332 supported the UTC interpretation for all 15 existing TEST rewards by matching each timestamp to its event evidence. Production timestamp history has not been independently verified. Verify it before releasing the bounded periods to Production. All-time uses `USER.total_xp` directly.

**Ranking and snapshot.** Filter active `USER` accounts and positive period score. Use `RANK() OVER (ORDER BY xp DESC)` for competition ranking (1, 1, 3). Use `ROW_NUMBER() OVER (ORDER BY xp DESC, user_id ASC)` for position and page, keeping the UUID internal. Rank the full candidate set before selecting podium, page and `me`. Page 1 includes the podium rows in the list. Tie order is deterministic within a snapshot. Independent reads can see different ranks as XP or eligibility changes.

Use one short read-only Prisma repeatable-read transaction, with bounded pool wait, transaction and statement timeouts to be tuned in TEST. Read the ranked projections and totals in one parameterized query and batch streak reads for only the displayed IDs and `me` in the same snapshot. Use the existing streak domain with the same evaluation instant and enough activity history to identify the first gap. Convert database counts and aggregate XP to JSON integers only after verifying safe representation. Avoid per-row queries, writes and lock-taking queries. The learning repository already uses `RepeatableRead` for consistent reads. [Learning repository](../../backend/src/repositories/learning-repository.js) · [Streak repository](../../backend/src/repositories/streak-repository.js)

**Responsibilities.** Reuse session and `USER` authorization middleware. Route wires middleware and the endpoint, controller passes validated query and session identity, service defines score windows and privacy projection, and repository performs bounded reads. Use tagged Prisma `$queryRaw` with bound values and static SQL alternatives for period and all-time. Never interpolate request-controlled SQL or publish ranking UUIDs. [App wiring](../../backend/src/create-app.js) · [Learner route example](../../backend/src/routes/learner-notification-routes.js)

**Cost.** The ledger indexes support user/reward identity and vocabulary lookups, with no timestamp-leading index. Week/month may scan a substantial portion of the ledger and sort eligible learners. All-time still ranks the eligible accounts. Ten rows per page reduce response size only. The nominal 60-second poll adds approximately one GET per minute per visible page, or about 1,000 GETs/minute for 1,000 visible pages before other refresh triggers. This is a request estimate. Prompt 332 observed sequential scans on the small TEST dataset and service p50 near 1.56 seconds with p95 near 1.65–1.78 seconds from six sequential samples per period (18 total). Production performance, concurrent load and pool saturation are untested.

## Privacy safeguards and limitations

1. HD-65 limits the audience to authenticated learners. Before release, keep the disclosure review in scope and explain which learners can see the name, initials, XP and streak. An existing profile value alone grants no disclosure permission. V1 has no persistent opt-out.
2. Use a dedicated server-side projection. For names, suppress blank values, email-like text and names matching the account email's local part after normalization. Use email only inside the backend to make this comparison. Suppress known fallback labels when origin is available, and use a neutral label such as `Học viên 12` for suppressed names. Render accepted names as plain text. Existing rows do not reliably identify how a name was chosen, so filtering cannot prove a name contains no personal information. [Google name fallback](../../backend/src/security/google-id-token-verifier.js) · [User schema](../../backend/prisma/schema.prisma)
3. Return `avatar_url: null` for all rows. HD-71 derives initials from the last two words, or the first two letters of a single-word label, and selects deterministic pastel colors. Generic privacy fallbacks use neutral initials. External images and any associated storage or URL allowlist remain deferred.
4. Return only the fields defined in the contract. Omit emails, account IDs, profile links, raw reward events and extra account data. Use synthetic identities in mocked pre-release tests. Any future change to the approved disclosure scope remains a separate HUMAN decision.

## Frontend lifecycle and visual brief

The learner shell, drawer and credentialed HTTP client are shared. The Leaderboard view store owns period, page and lifecycle. The API client validates the envelope, window, totals and row shapes and accepts an `AbortSignal`. Snapshots are held in memory per authenticated session generation, with period and page keys and a window expiry. Tab session signals, logout and account changes close the old cache. Request cancellation and closed-session guards prevent stale responses from restoring it. On successful USER verification, Prompt 333-R creates a new cache when the previous one is missing, including recovery after a failed cross-tab verification. Routine verification preserves an existing healthy cache. [App router](../../frontend/src/app-router.jsx) · [Auth store](../../frontend/src/auth/auth-store.js) · [Leaderboard view](../../frontend/src/leaderboard/leaderboard-view.js)

- Fetch on entry and visible restoration. While mounted and visible, schedule the next poll approximately 60 seconds after the current request settles, with light jitter and bounded backoff on transient errors. Pause when hidden. Cancel timers, abort obsolete requests and remove listeners on disposal. Coalesce concurrent triggers into one in-flight request and allow one follow-up when a new invalidation arrived during that request.
- Emit a stale signal from validated `recordMeaningfulEvent` and `submitAnswer` results when `reward.xp_earned > 0` and `reward.replayed === false`, regardless of session state. Include successful non-replayed completion that can change streak. Compare the existing streak projection when available, otherwise treat a qualifying completion as a stale signal. Coalesce completion and reward from the same response. When the page is absent or hidden, mark stale without issuing a GET. Bind signals to the initiating auth session so late learning responses cannot invalidate a different account. Keep the notification interceptor's completion behavior. [Learning API](../../frontend/src/services/learning-service.js) · [Quiz API](../../frontend/src/services/quiz-service.js) · [Normal completion API](../../frontend/src/services/learning-session-service.js) · [Existing interceptor](../../frontend/src/services/http-client.js)
- Reset to page 1 on period change or rollover. Use server `window.end` and `as_of` to schedule a visible rollover check, with backend authoritative on the returned window. Check on restoration after sleep. If a poll makes the current page invalid, fetch the last valid page once, or show the empty state at page 1 when the total is zero. Keep `me.page` available for personal rank navigation.
- Start with an initial skeleton. During background refresh, keep the current snapshot visible and show a quiet progress state. Display **Cập nhật lúc** from the last successful `as_of`. On transient failure, preserve a valid same-session snapshot and mark it stale with **Thử lại**. If retaining the previous period's snapshot during rollover, identify its old date range. Errors without a snapshot use a full error state. Use backend rank for ties in the podium, and update rows in place without moving focus unnecessarily.

**Gemini reference.** Prompt 332-R inspected the supplied prototype outside the repository. HUMAN accepted the resulting visual design and the compact mobile podium in Prompt 332-R2. The final page uses **Tuần này / Tháng này / Toàn thời gian**, a Vietnam date range and update status, personal summary and rank-page link, podium, semantic table and bounded pagination. Three podium entries occupy a bottom-aligned 2–1–3 row by entry position, two use balanced columns and one is compact and centered on mobile. Avatar sizing is reduced and names visually truncate on mobile. Server ranks determine medals. Focus, keyboard access and layout at 320, 390, 768 and 1440px were verified with mocks. [UI/UX specification](../UI_UX_SPEC.md)

## Implementation tasks and acceptance gates

The original task criteria are retained below. Prompt 333-R completed local integration after the cache regression passed. The real-data coverage gaps and deployment gates remain open.

| Task | Dependencies and scope | Acceptance and future verification |
| --- | --- | --- |
| TASK-001 Backend read endpoint | PLAN/TASK and implementation approval. Add leaderboard repository, service, controller and route under existing Backend structure. Use synthetic identities until disclosure is approved. | Exact API envelope, validation, session/role checks, private no-store and privacy projection. Week/month, all-time, streak, podium, page and personal rank agree within one snapshot. No DB or learning-rule changes. |
| TASK-002 Frontend page and refresh | TASK-001 contract. Add page, API client and cache lifecycle, wire router and shell, and integrate validated learning/quiz/completion signals. | Correct route and nav. Page opens, refreshes and rolls over automatically, updates personal rank and preserves current screen on transient failures. No stale or cross-session data. |
| TASK-003 Focused automated verification | TASK-001 and TASK-002. Use existing Backend and Frontend test conventions. | Backend covers week/month boundaries including Monday and first of month in Vietnam, all-time legacy totals, ties, deterministic order, zero/inactive/ADMIN exclusion, personal rank beyond page 1, invalid pagination, unauthorized access, safe projection and a concurrent snapshot case. Frontend covers period/page switches, personal navigation, tied podium, hidden/restore, timer cleanup, overlapping triggers, XP mid-session and without session, streak-only completion, replay, account switch/logout, stale responses and network failure. Check 320, 390, 768 and 1440px. |
| TASK-004 Guarded real TEST verification | TASK-003 and separate TEST authorization. Use representative TEST volume and isolated fixtures as approved. | Verify writer/session timezone and historical timestamp evidence, exercise exact boundary rows and run real PostgreSQL snapshot checks. Record query plans, p50/p95 latency, connection usage, wait/timeouts and competing learning traffic for representative concurrent poll loads. HUMAN decides whether the 60-second interval meets the Production budget using this evidence. |
| TASK-005 HUMAN interface acceptance | TASK-002 and TASK-003, with real-stack acceptance after TASK-004. | Compare with the approved visual reference if available. Accept mobile and desktop layouts, keyboard flow, ties, personal rank, recovery and rollover using safe test identities. Clearly record any untested deployment behavior. |
| TASK-006 Integration and release review | TASK-003 through TASK-005, explicit privacy approval, Feature Freeze decision and separate integration/release authorization. | Confirm zero schema/index/dependency changes and passing scoped regression. Reconcile API and UI contracts with implementation, carry forward graduation release limitations, and approve the release scope and polling interval. Release stays blocked if privacy, time semantics or measured cost are unresolved for the proposed scope. |

## Evidence and release gates

- Prompt 331 passed 15/15 backend tests, 33/33 frontend tests and 7/7 mock Chromium cases.
- Prompt 332 matched independent calculations for all three periods and verified a read-only repeatable-read snapshot on TEST. The data did not cover ties, a full podium, a populated later page, personal rank beyond page one, inactive accounts or unsafe display-label fallbacks.
- Prompt 332-R passed 9/9 focused frontend tests and 12/12 mock Chromium cases. Prompt 332-R2 passed 13/13 focused mock Chromium cases. HUMAN accepted the final visuals.
- Prompt 333-R reproduced the recovery defect before remediation and passed the same browser case afterward. Frontend/auth 27/27, focused Chromium 3/3, scoped ESLint and production build passed. The prior runs overlap with these checks and are reported separately.

Separate commit/push approval, Dev CI, Preview and Production release remain
pending. Confirm the Production XP timestamp convention, performance and
polling budget before release. Concurrent request load, pool saturation and
snapshot behavior under a concurrent writer remain **NOT TESTED**. See the
[local integration record](../FEATURE_STATUS.md) for the evidence and limits.
