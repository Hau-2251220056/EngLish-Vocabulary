# PLAN: Daily Goal V1 — Active Learning Time and In-App Notifications

**PLAN status:** `HUMAN APPROVED`

**Approved input:** `docs/specs/DAILY_GOAL_V1_SPEC.md` (`HUMAN APPROVED`, 78 BR, 55 AC)

**Planning boundary:** This document defines the proposed implementation architecture. It does not authorize TASK creation, source changes, migrations, tests, database access, deployment, or external-service configuration.

---

## 1. Summary

Daily Goal V1 will be added as a backend-authoritative vertical slice that follows the existing Express route → middleware → controller → service → repository → Prisma/PostgreSQL structure and the existing React page/component → hook/state → API service structure.

The design has five cooperating boundaries:

1. A durable Daily Goal account/day model stores the nullable target, reminder preference, uncapped daily seconds, one reward identity, and persistent notifications.
2. A short-lived tracking protocol gives one learning tab/device an expiring USER-scoped owner lease with a monotonic fencing generation.
3. Server timestamps and a server-held engagement deadline determine the maximum creditable interval. Heartbeats renew liveness but never reset the 120-second idle deadline.
4. A lightweight authenticated-shell monitor proves that an ELVocab tab is currently running before Backend evaluates an inactivity reminder; there is no scheduler or delivery after all tabs close.
5. Shared frontend tracking state and thin activity adapters translate existing Normal, SRS, Quiz, and Speaking lifecycle events without changing their learning algorithms or outcomes.

No new dependency or external service is required. Daily Goal reward persistence is deliberately separate from the Vocabulary-scoped `XP_REWARD` model, while `USER.total_xp` and `projectXpLevel()` remain authoritative for XP/Level projection.

---

## 2. Verified Context, Assumptions, and Unknowns

### 2.1 Verified repository facts

- Backend is Express 5 and mounts authenticated routers in `backend/src/create-app.js`.
- Authentication is stateful cookie authentication through `createAuthenticationMiddleware()` in `backend/src/middleware/authentication-middleware.js`; USER-only authorization uses `createRoleAuthorizationMiddleware()` from `backend/src/middleware/role-authorization-middleware.js`.
- Persistence uses Prisma with PostgreSQL in `backend/prisma/schema.prisma`; deployment documentation identifies Supabase PostgreSQL and Vercel.
- Existing transaction patterns include caller-provided Prisma transaction clients, row locks (`FOR UPDATE`), unique-constraint replay handling, and PostgreSQL advisory transaction locks in `backend/src/repositories/quiz-repository.js`.
- XP is stored in `USER.total_xp`. `XP_REWARD` is Vocabulary-scoped and cannot represent Daily Goal without weakening its required Vocabulary identity and existing uniqueness contract.
- `projectXpLevel()` in `backend/src/services/xp-level-service.js` computes the response projection; Level is not persisted separately.
- Vietnam application dates are already derived by `toApplicationDate()` with `STREAK_TIME_ZONE = "Asia/Ho_Chi_Minh"` in `backend/src/services/streak-domain.js`.
- `LEARNING_SESSION` covers NORMAL, SRS, and QUIZ; Speaking is a separate frontend activity and has no equivalent persisted learning session.
- `AuthenticatedShell`, `DashboardPage`, the four learning pages/controllers, Axios `httpClient`, React-Toastify, Playwright, and Node test conventions already exist.
- `backend/vercel.json` packages the Express entry as a Vercel function; `frontend/vercel.json` rewrites `/api/*` to the backend deployment.
- Existing documentation requires guarded, CI-exclusive database infrastructure for destructive/state-changing database tests. Preview TEST and production-like databases are prohibited.

### 2.2 Planning assumptions to validate before implementation

- Expected traffic is graduation-capstone scale, not a documented production SLA.
- A typical active learning period is approximately 30 minutes per active USER/day; a typical authenticated app-open period is approximately 60 minutes/day. These are sizing examples only.
- Vercel function concurrency, Supabase pool size, database compute tier, connection mode, and actual active-user count are currently UNKNOWN and must be measured or confirmed before load claims.
- Browser lifecycle and timer delivery remain best-effort; bounded undercount is accepted by the SPEC when exact verification is impossible.

### 2.3 No SPEC blocker found

The approved business rules are mutually implementable. Technical constants selected below remain PLAN decisions and may be revised during HUMAN PLAN review without changing business behavior.

---

## 3. Affected Areas

- **Database:** extend `USER`; add daily aggregate, owner/session, operation receipt, monitor, reward, and notification persistence.
- **Backend:** add Daily Goal domain/time helpers, repository, service, controller, router, notification projection, and bounded cleanup path.
- **API:** add USER-only goal/progress, tracking, monitor/reminder, preference, and notification contracts.
- **Frontend:** extend authenticated shell/header and Dashboard; add shared tracking provider/hook, idle dialog, activity adapters, non-owner state, monitor, Bell, and Notification Center.
- **Tests:** add deterministic domain/unit, guarded integration, frontend unit/component, Playwright, concurrency, accessibility, and manual visual checks.
- **Documentation:** after implementation approval, reconcile the legacy Daily Goal sections identified by the SPEC in `PROJECT_OVERVIEW.md`, `DATABASE.md`, `API_SPEC.md`, `UI_UX_SPEC.md`, and `FEATURE_STATUS.md`; update `ARCHITECTURE.md` for the accepted tracking boundary.

---

## 4. Existing Code to Reuse or Extend

### Backend

- `backend/src/create-app.js` — extend `createApp()` for dependency construction and router mounting.
- `backend/src/middleware/authentication-middleware.js` — session-cookie authentication and existing `401` envelope.
- `backend/src/middleware/role-authorization-middleware.js` — USER-only `403` enforcement.
- `backend/src/services/streak-domain.js` — reuse/export the Vietnam application-date boundary logic; extend with a helper that returns exact UTC instants for the surrounding Vietnam midnights rather than duplicating timezone arithmetic.
- `backend/src/services/xp-level-service.js` — reuse `projectXpLevel()` after atomic `USER.total_xp` updates; do not add Daily Goal to Vocabulary reward-candidate functions.
- `backend/src/repositories/xp-reward-repository.js` — reuse only the transaction style and XP increment concept; do not reuse or generalize `XP_REWARD` identity.
- `backend/src/repositories/learning-session-repository.js` and `backend/src/services/learning-session-persistence.js` — follow transaction-client, `FOR UPDATE`, replay, and atomic-completion conventions.
- `backend/src/repositories/quiz-repository.js` — follow the PostgreSQL advisory transaction-lock approach inside `createQuizRepository()` for a USER-scoped Daily Goal critical section.
- `backend/src/repositories/learning-repository.js` — reuse queries exposed by `createLearningRepository()` for accessible Set/Vocabulary checks in Speaking tracking context.
- `backend/src/services/learning-session-service.js` — reuse `createLearningSessionService()`/`toSessionProjection()` semantics to validate NORMAL/SRS/QUIZ tracking contexts without changing learning-session completion.

### Frontend

- `frontend/src/auth/ui/authenticated-shell.jsx` — extend `AuthenticatedShell()` with the USER-only Bell and app monitor; its focus-learning branch must also keep the nonvisual monitor mounted.
- `frontend/src/dashboard/dashboard-page.jsx` — extend `DashboardPage()` and its local `useDashboardSource()` independent-section loading/error pattern with a Daily Goal card; avoid coupling failure to progress, streak, or sets.
- `frontend/src/services/http-client.js` — reuse credentialed Axios client and current error handling style.
- `frontend/src/learning/learning-foundation-page.jsx`, `normal-learning-session.js`, `srs-learning-session.js`, and `learning-run-state.js` — integrate at `LearningFoundationPage()`, `canCompleteNormalLearningSession()`, `persistNormalLearningCursor()`, and `acceptSrsRatingProjection()` boundaries without changing their state rules.
- `frontend/src/quiz/quiz-foundation-page.jsx` and `quiz-run-state.js` — integrate at `QuizFoundationPage()`, `beginQuizAnswer()`, `acceptQuizAnswer()`, `continueQuizRun()`, and `summarizeQuizRun()` lifecycle boundaries.
- `frontend/src/pronunciation/speaking-practice-page.jsx`, `speaking-practice-page-session.js`, `recognition-attempt-controller.js`, and `reference-playback-coordinator.js` — integrate at `SpeakingPracticePage()`, `createSpeakingPracticePageSession()`, `bindSpeakingPracticeVisibility()`, `createRecognitionAttemptController()`, and `createReferencePlaybackCoordinator()` boundaries.
- `frontend/src/components/notification-service.js`, `notifications.jsx`, and `xp-reward-notification.js` — retain transient toast behavior for immediate feedback; persistent Notification Center data remains a separate server source.
- Existing Tailwind/design tokens, `dialog` focus patterns in Quiz, responsive Playwright conventions, and `motion-reduce:*` classes — reuse for card, status, Bell/panel, and idle dialog.

---

## 5. Technical Defaults and Alternatives

### 5.1 Compared ownership designs

| Design | Advantages | Problems | Decision |
|---|---|---|---|
| Browser-only leader election (`BroadcastChannel`/storage) | Cheap and responsive in one browser | Cannot coordinate devices; storage can fail; not authoritative | Optional UX optimization only, never correctness boundary |
| Optimistic aggregate updates without an owner lease | Simple endpoints | Concurrent tabs can credit overlapping seconds; retries are hard to fence | Rejected |
| PostgreSQL USER-scoped serialization + owner lease + generation + receipts | Coordinates tabs/devices; supports deterministic fencing and idempotency; fits existing PostgreSQL patterns | More rows and writes; requires careful cleanup | Recommended |

### 5.2 Selected timing defaults

- Heartbeat interval: **20 seconds** while the local tracker is eligible and owns or is attempting to reclaim an expired lease.
- Owner lease TTL: **45 seconds** from the Backend receipt time of an accepted claim/heartbeat.
- Maximum acceptable server-observed interval per crediting operation: **25 seconds**; an over-limit interval is rejected in full rather than truncated and partially credited.
- Idle threshold: **120 seconds**, fixed by SPEC, represented by a server-held `engagement_expires_at` deadline.
- Sleep/wake drift threshold on the client: **greater than 45 seconds beyond the expected 20-second tick** triggers local pause/modal and sends no catch-up duration. Exact drift detection code belongs to implementation review.
- Shell monitor check cadence: **60 seconds**, with a **10-minute** server-observed inactivity threshold from the latest eligible baseline.
- Notification refresh: on shell mount, Bell/panel open, successful mark-read, window focus, and at most every **60 seconds** while visible. Polling pauses while hidden.
- Supported idempotent retry horizon and operation-receipt retention: **30 days** after creation. Closed tracking/monitor sessions remain at least **31 days** and cannot be deleted while retained receipts reference them. Daily aggregates, rewards, and notifications are durable until account deletion/retention policy says otherwise.

Rationale: a 20-second heartbeat bounds normal interruption loss to roughly one interval, the 45-second lease tolerates one delayed tick without allowing long overlap, and the 25-second acceptance ceiling covers normal jitter while rejecting a longer unverifiable gap in full. The engagement deadline is independent, so a browser sending heartbeats without meaningful interaction stops receiving credit at 120 seconds even if its lease remains temporarily live.

These values require fake-clock tests and a small load probe before implementation approval. They are not business constants and can be tuned without changing the SPEC.

### 5.3 Exact accepted-interval algorithm

All comparisons use Backend-observed UTC instants at millisecond precision. Let `A` be the current owner's `last_accounted_at`, `N` the current command receipt time, `L` the existing lease expiry, `E` the existing engagement deadline, and `D = N - A`. Receipt replay is checked before this algorithm.

For an owner heartbeat or a meaningful engagement received while the previous window is still valid:

1. Lock the USER boundary and re-read session, owner, generation, `A`, `L`, and `E`.
2. If session/generation is stale, return conflict with zero credit and do not change the current owner's accounting cursor.
3. If `N >= L`, reject the entire unconfirmed interval `[A,N)`; never credit its first 25 seconds. Invalidate the expired owner by advancing the fence. A still locally active session may reclaim under a new generation, but its new `last_accounted_at` is `N`, so the expired gap is permanently excluded.
4. Otherwise, if `D > 25 seconds`, reject the entire `[A,N)` even though the lease may still be live. Advance `last_accounted_at` to `N` to burn the invalid gap permanently. A valid current heartbeat may renew the lease, but it receives zero credit for that gap.
5. Otherwise, the maximum candidate is `[A,min(N,E))`. If nonempty, credit that whole interval at millisecond precision and advance `last_accounted_at` to its end.
6. If `N >= E`, permanently exclude `[E,N)`, transition the session to idle/paused, clear ownership, and advance the fence. Ordinary meaningful events cannot reopen it; an explicit resume is required.
7. If `N < E`, advance `last_accounted_at` to `N`. Heartbeat may renew `L` but never changes `E`. A meaningful interaction may extend `E` only after steps 1–5 account or reject the interval under the old deadline.

Pause, close, hidden, blur, route-exit, and logout commands credit no new tail; they fence the owner and leave the last accepted eligible operation as the final credit boundary. Thus network latency after a client lifecycle signal cannot become learning time.

Deterministic examples, with an engagement deadline later than all shown normal/delayed instants unless stated otherwise:

- **Normal:** claim at `T=0`; heartbeat received at `T=20s`; live lease and `D=20s` permit exactly 20,000 ms. Cursor becomes `T=20s`; lease becomes `T=65s`.
- **Delayed but lease-live:** next heartbeat at `T=50s`; `D=30s > 25s` while lease expires at `T=65s`. Credit is zero for the entire `[20s,50s)`; cursor becomes `T=50s`; a valid current-owner heartbeat may renew lease to `T=95s`.
- **Expired lease:** next heartbeat at `T=100s` with lease `T=95s`. Credit is zero for the entire `[50s,100s)`; generation advances and old in-flight requests are fenced. If the session is still within its engagement deadline and asserts eligible visible/focused state, the same command may reclaim with a new generation, cursor `T=100s`, and no retroactive credit.
- **Retry:** retrying any example with the same operation ID and matching fingerprint returns the stored result without moving cursor, lease, generation, aggregate, XP, or notifications. Reusing the ID with different input returns `409 OPERATION_CONFLICT`.

---

## 6. Database Plan

### 6.1 Existing model changes

`USER` gains:

| Field | Type / default | Purpose |
|---|---|---|
| `daily_goal_minutes` | nullable integer | `NULL` means unset; service validates 10–240 |
| `daily_goal_reminders_enabled` | nullable boolean | `NULL` means never saved and is projected as effective `true`; explicit `true/false` persists across sessions/devices |
| `daily_goal_reminders_enabled_at` | `timestamptz` nullable | Server instant of the latest explicit re-enable; establishes future-only reminder eligibility without relying on general `updated_at` |

Do not read, rename, backfill, or reinterpret `daily_xp_goal`.

### 6.2 New models

#### `DAILY_GOAL_DAY`

One durable aggregate per USER/application date.

| Field | Type | Constraint / purpose |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK → USER, cascade on account deletion |
| `activity_date` | PostgreSQL `date` | Vietnam application date |
| `active_milliseconds` | bigint default 0 | Nonnegative, uncapped accepted duration; database check `>= 0`; API derives whole seconds without discarding stored remainder |
| `last_credited_at` | `timestamptz` nullable | Last server-confirmed credit end; diagnostic/accounting state, not the reminder clock |
| `last_engagement_at` | `timestamptz` nullable | Last accepted READY, meaningful interaction, or explicit resume; authoritative learning-side reminder baseline |
| `last_activity_type` | enum nullable | NORMAL, SRS, QUIZ, SPEAKING |
| timestamps | `timestamptz` | Created/updated audit |

Unique `(user_id, activity_date)`; index `(user_id, activity_date DESC)`.

#### `DAILY_GOAL_TRACKING_SESSION`

One short-lived identity for an activity instance/tab/device.

| Field | Type | Constraint / purpose |
|---|---|---|
| `id` | UUID | Server-generated primary key |
| `user_id` | UUID | FK → USER, cascade on account deletion |
| `activity_type` | enum | Approved four activities only |
| `learning_session_id` | UUID nullable | Required for NORMAL/SRS/QUIZ; no new FK if lifecycle retention would create improper coupling, otherwise FK with `SET NULL` |
| `set_id` / `vocabulary_id` | UUID nullable | Speaking authorization context; validation determines required combination |
| `status` | enum | ACTIVE, PAUSED, CLOSED |
| `engagement_expires_at` | `timestamptz` nullable | 120-second deadline; heartbeat cannot move it |
| `last_meaningful_at` | `timestamptz` nullable | Backend receipt time of READY/meaningful event |
| `created_at`, `updated_at`, `closed_at` | `timestamptz` | Lifecycle |

Indexes `(user_id, status, updated_at)` and cleanup index on `updated_at`.

#### `DAILY_GOAL_OWNER`

At most one current owner row per USER.

| Field | Type | Constraint / purpose |
|---|---|---|
| `user_id` | UUID | Primary key and FK → USER, cascade on deletion |
| `tracking_session_id` | UUID nullable | FK → tracking session, `SET NULL` |
| `generation` | bigint default 0 | Monotonically increases on every owner change/invalidation |
| `lease_expires_at` | `timestamptz` nullable | Owner liveness boundary |
| `last_accounted_at` | `timestamptz` nullable | Server cursor for the next interval; advances across accepted intervals and across rejected gaps so invalid time cannot be reconsidered |
| `updated_at` | `timestamptz` | Diagnostics/cleanup |

The service serializes owner changes with a PostgreSQL transaction advisory lock derived from `user_id`; it does not rely on a read-then-write race.

#### `DAILY_GOAL_OPERATION_RECEIPT`

| Field | Type | Constraint / purpose |
|---|---|---|
| `operation_id` | UUID | Primary key supplied per retryable command |
| `user_id` | UUID | FK → USER, cascade on deletion |
| `tracking_session_id` | UUID nullable | FK → tracking session with `RESTRICT`; cleanup must delete expired receipts before their closed parent |
| `monitor_session_id` | UUID nullable | FK → monitor session with `RESTRICT` for monitor operations |
| `generation` | bigint nullable | Fence observed by the operation |
| `operation_type` | enum | CREATE/READY/INTERACTION/CLAIM/HEARTBEAT/PAUSE/CLOSE/GOAL_UPDATE/MONITOR_CHECK |
| `request_fingerprint` | text | Detect operation-ID reuse with different input |
| `credited_seconds` | integer default 0 | Audit/replay result, nonnegative and bounded per interval |
| `response_projection` | JSONB or normalized minimal replay fields | Exact safe replay without a second mutation; PLAN review should prefer minimal JSONB because retention is short and response schemas are versioned |
| `created_at` | `timestamptz` | Retention anchor |

Indexes `(user_id, created_at)` and `(created_at)` support diagnostics/cleanup. Duplicate `operation_id` with matching fingerprint replays; mismatch returns conflict.

#### `DAILY_GOAL_REWARD`

| Field | Type | Constraint / purpose |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK → USER, cascade on account deletion |
| `activity_date` | `date` | Vietnam application date |
| `source_operation_id` | UUID | Unique idempotency link |
| `xp_amount` | integer | Check equals 10 for V1 |
| `created_at` | `timestamptz` | Audit |

Unique `(user_id, activity_date)` and unique `(user_id, source_operation_id)`. This additive ledger does not alter `XP_REWARD` or its constraints.

#### `USER_NOTIFICATION`

| Field | Type | Constraint / purpose |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK → USER, cascade on account deletion |
| `type` | enum | DAILY_GOAL_COMPLETED or DAILY_GOAL_INACTIVITY_REMINDER |
| `application_date` | `date` | Dedupe boundary |
| `title`, `body` | bounded text | Backend-authored plain text |
| `created_at` | `timestamptz` | Ordering |
| `read_at` | `timestamptz` nullable | Read state |

Unique `(user_id, type, application_date)`; indexes `(user_id, read_at, created_at DESC)` and `(user_id, created_at DESC)`.

#### `DAILY_GOAL_MONITOR_SESSION`

One server-recognized authenticated app-tab monitor identity.

| Field | Type | Constraint / purpose |
|---|---|---|
| `id` | UUID | Server-generated primary key |
| `user_id` | UUID | FK → USER, cascade on deletion |
| `started_at` | `timestamptz` | Server-observed baseline |
| `last_seen_at` | `timestamptz` | Previous visible monitor check |
| `continuity_started_at` | `timestamptz` | Server-observed start/reset of this tab's uninterrupted app-running proof |
| `eligible_baseline_at` | `timestamptz` | Effective per-monitor reminder origin: later of continuity start, preference re-enable, and latest qualifying engagement |
| `closed_at` | `timestamptz` nullable | Best-effort close |

Index `(user_id, last_seen_at)` and cleanup index on `last_seen_at`. A check received after a long cadence gap resets the baseline and cannot create a retroactive reminder.

### 6.3 Transaction and locking strategy

All commands that can credit time, change owner, change goal, issue reward, or create a reminder execute inside one Prisma interactive transaction:

1. acquire a USER-keyed PostgreSQL advisory transaction lock;
2. read/validate the current session, owner generation, target/preference, and relevant daily row;
3. apply the exact accepted-interval algorithm in §5.3, either accepting the complete provable interval or permanently burning the complete invalid gap;
4. split the interval at Vietnam midnight if needed and upsert each affected day;
5. evaluate completion only when a valid goal exists;
6. insert `DAILY_GOAL_REWARD` with unique day identity, increment `USER.total_xp`, and insert the completion notification in the same transaction;
7. write the operation receipt and return `projectXpLevel(total_xp)`.

A unique collision is handled as replay only after the stored identity/fingerprint is verified. No caught collision may trigger a second XP increment.

Reminder checks use the same USER lock and unique notification key. They require enabled effective preference, configured/incomplete goal, no unexpired eligible owner, a live monitor with no long-gap reset, ten server-observed minutes since the latest eligible baseline, and no same-day inactivity notification.

### 6.4 Midnight precision

- The single accounting unit is the integer **millisecond**, matching JavaScript `Date`/Prisma timestamp precision. Store instants as `timestamptz`/Prisma `DateTime`, durable duration as bigint milliseconds, and application day as PostgreSQL `date`.
- Derive boundaries from `Asia/Ho_Chi_Minh` using the shared domain helper, never client date/timezone.
- Treat every accepted interval as half-open `[start,end)`. Split it at exact Vietnam-midnight instants before aggregate updates.
- For every split, compute `part_ms = end_ms - start_ms`; the sum of all parts must exactly equal the original accepted interval milliseconds. No per-heartbeat flooring occurs.
- API `active_seconds` is `floor(total_active_milliseconds / 1000)` only at projection time. The subsecond remainder remains stored and can contribute to later displayed seconds; visual minutes derive from the same durable total.

Deterministic examples:

- `[10:00:00.100,10:00:20.350)` is 20,250 ms and is stored in full. If the next accepted interval adds 750 ms, the aggregate grows by exactly 21,000 ms; API projects 21 seconds.
- Vietnam midnight interval `[23:59:59.600,00:00:00.400)` is 800 ms: 400 ms belongs to the earlier application date and 400 ms to the next. The two parts conserve 800 ms with neither overlap nor loss.
- An interval ending exactly at `00:00:00.000` belongs wholly to the earlier date because the interval is half-open; an interval starting at that instant belongs wholly to the new date.

### 6.5 Migration and rollback plan

Forward migration:

1. Add nullable USER fields without reading `daily_xp_goal`.
2. Create enums/tables/checks/FKs/indexes and explicit database constraints Prisma cannot express directly.
3. Existing users retain unset goal and effective reminder preference ON (`NULL` projection). Existing daily aggregates require no conversion because this is a new table.
4. Generate Prisma client and run migration-safety verification only on a confirmed CI-exclusive database. For Gate DG-1 migration correctness, the approved target class is a fresh PostgreSQL service/container and database created exclusively for one CI run under the ephemeral-target contract below; the existing Supabase CI project/database is not a prerequisite for DG-1.

#### 6.5.1 Gate DG-1 ephemeral PostgreSQL target contract — HUMAN APPROVED

- Create a new PostgreSQL service/container and fresh database for each CI run. It must contain no Production, Preview, DEV, shared/manual, or application-user data and must not reuse persistent database state, a schema/database from another run, or any external database credential.
- The ephemeral path must not read or fall back to `CI_TEST_DATABASE_URL`, `DATABASE_URL`, `TEST_DATABASE_URL`, a Supabase URL, or any other external database URL. The database, volume, and job-scoped network must be destroyed when the job ends.
- Pin the PostgreSQL major version and match it to the intended Supabase PostgreSQL major. Until that intended major is independently confirmed, otherwise complete DG-1 evidence is provisional and cannot support final HUMAN DG-1 passage.
- Install no extension outside the explicit allowlist required by the 11 reviewed baseline migration artifacts. Missing or unexpected extensions fail closed rather than broadening the environment.
- Bind authorization and evidence to the exact repository, source SHA, CI run ID, run attempt, and reviewed migration-inventory digest. Do not accept a caller-supplied arbitrary migration path, inventory, database, or schema.
- Keep the workflow terminally disabled by default. Implementation/review and each real CI execution require separate HUMAN authorizations; this PLAN amendment authorizes neither.

#### 6.5.2 Exact DG-1 migration-correctness evidence

Before the Daily Goal migration, the guarded run must prove a fresh database, execute exactly the 11 reviewed baseline migration artifacts in order, and report exactly 11 `APPLIED` records with 11 matching checksums and zero unexpected pending migrations.

The Daily Goal migration must use the exact approved artifact: 11,487 raw bytes with SHA-256 `8e468739c3f60693e9ff53d1c3d4107124ac1feaa9d95ac3a665ea8b8c89edb6`. After applying it, evidence must report exactly 12 `APPLIED` records, 12 matching checksums, correct order, and zero pending migrations. Verification must cover the expected schemas, tables, columns, SQL types, defaults, primary keys, foreign keys, unique constraints, checks, indexes, and cascade behavior, and must prove the complete sequence works from the fresh database. Any missing, extra, reordered, divergent, failed, or unresolved state fails closed.

Passing this path proves only portable PostgreSQL migration correctness, compatibility with the 11 reviewed baseline migrations, and the expected schema/constraint behavior. It does not prove compatibility with a Supabase project, Session Pooler behavior, Supabase roles/extensions/default ACL/`PUBLIC` state, Vercel–Supabase connectivity, Preview/Production migration readiness, or deployment readiness.

Those platform-specific facts are classified as **SUPABASE PLATFORM VALIDATION — REQUIRED BEFORE PREVIEW/PRODUCTION DEPLOYMENT**. Existing Phase B/Context B evidence remains valid historical/platform-specific work, but it is not a prerequisite for DG-1 and must not be relabeled as ephemeral DG-1 evidence.

Rollback before production data exists may drop the new tables/enums/columns in reverse dependency order. After real Daily Goal data exists, rollback is application-disable/forward-fix: preserve tables and data, disable new routes/UI, and deploy a corrective migration rather than destructively dropping rewards, notifications, or aggregates.

---

## 7. Backend Plan

### 7.1 Proposed files

- `backend/src/services/daily-goal-domain.js` — constants, activity/event allowlists, Vietnam interval splitting, projections, idle/lease/accounting calculations, and pure validation helpers.
- `backend/src/repositories/daily-goal-repository.js` — transaction-only persistence, advisory lock, owner/session/receipt/day/reward/preference/monitor/notification operations.
- `backend/src/services/daily-goal-service.js` — orchestration, authorization-context validation, transaction boundaries, reward and reminder rules.
- `backend/src/controllers/daily-goal-controller.js` — request extraction, service call, success status/DTO mapping, known error mapping.
- `backend/src/routes/daily-goal-routes.js` — USER-only endpoints.
- Extend `backend/src/create-app.js` to construct dependencies and mount `/api/daily-goal` and `/api/notifications` without changing existing routers.

Keeping one service/repository pair for V1 avoids artificial micro-modules while separating pure domain logic for deterministic testing.

### 7.2 Tracking state machine

#### Establish

- Validate activity type and context ownership/access.
- NORMAL/SRS/QUIZ must reference an owned, accessible, ACTIVE existing `LEARNING_SESSION` whose mode matches.
- SPEAKING must reference an exact accessible Set/Vocabulary pair using existing learning-access queries; no audio/transcript data is accepted.
- Create a tracking session without credit. This works whether goal is unset, incomplete, or complete.

#### Ready / meaningful interaction

- `READY` is allowed once when an unfinished item becomes render-ready. With no prior engagement window it credits nothing, records `last_engagement_at = serverNow`, sets `engagement_expires_at = serverNow + 120s`, sets the accounting cursor to `serverNow`, and may claim ownership.
- For an activity-specific meaningful interaction received before the old deadline, Backend first executes §5.3 against the **old** `engagement_expires_at`. Only after the old interval is accepted/rejected does it record the interaction and set the new deadline to `serverNow + 120s`.
- If an ordinary meaningful interaction arrives at or after the old deadline, Backend may credit only a still-provable prefix ending at the old deadline, then fences/pauses the owner and returns `409 IDLE_RESUME_REQUIRED`. It does not treat that interaction as resume and does not extend the deadline.
- `RESUME` is a distinct engagement event allowed only after the visible Idle Pause Modal's explicit **Tiếp tục học** action (or equivalent fresh validation after a fenced/expired state). Backend revalidates that the activity remains authorized, ready, unfinished, visible/focused as asserted, and non-completed; it credits no expired gap, assigns a fresh generation/cursor at `serverNow`, records `last_engagement_at`, and creates a new 120-second deadline.
- Accepted READY, meaningful interaction, and RESUME update the USER/day `last_engagement_at`; heartbeat and response arrival never do.
- A visible/focused local tracker may claim/transfer owner on READY, a timely meaningful interaction, or explicit RESUME.
- Before transfer, do not infer or settle an unconfirmed tail for the previous owner. Its last accepted eligible heartbeat/meaningful operation is the final credit boundary; then increment generation and assign the new session. This intentionally prefers bounded undercount when the prior tab may have hidden, slept, or disconnected.

Ordering examples:

- Deadline is `T=120s`; meaningful interaction is received at `T=110s`. Backend first accounts `[last_accounted,110s)` using the old deadline, then extends the deadline to `T=230s`.
- Deadline is `T=120s`; ordinary interaction is received at `T=125s`. Backend never credits `[120s,125s)`, fences the owner, and returns `IDLE_RESUME_REQUIRED`; deadline remains expired.
- Explicit RESUME is received at `T=130s` after UI confirmation. Backend credits none of `[120s,130s)`, starts a new generation/cursor at `T=130s`, and sets deadline `T=250s`.

#### Heartbeat

- Requires session ID, operation ID, current generation, and an eligibility assertion enum; it contains no elapsed seconds or client timestamp.
- When generation/session match and the session is not paused/closed, apply §5.3 from `last_accounted_at`; a gap over 25 seconds is rejected in full, not partially capped.
- Renew lease to `serverNow + 45s` only for the current eligible owner.
- Never modify `last_meaningful_at` or `engagement_expires_at`.
- A non-owner heartbeat cannot steal an unexpired owner. It may reclaim only if the old lease is expired and the requesting session's engagement deadline is still valid.
- If `serverNow >= engagement_expires_at`, accept only a provable interval ending no later than that deadline, stop credit, fence the owner, and project `IDLE`; further heartbeats add zero until explicit RESUME.

#### Pause / close / route exit

- Best-effort pause/close uses operation ID and generation, credits no new tail after the last accepted eligible operation, invalidates ownership by incrementing generation, and marks the session PAUSED/CLOSED. This prevents network delay after a hidden/blur lifecycle boundary from becoming learning time.
- `sendBeacon` may be attempted during unload, but correctness does not depend on delivery; lease expiry bounds the failure.
- Hidden/blurred client state stops local heartbeat immediately and sends pause. Returning within the local 120-second window uses a fresh eligibility/claim operation; returning after idle or drift requires explicit resume.

#### Sleep/wake

- Frontend compares monotonic tick drift, visibility, and focus. A long gap pauses locally and shows the modal.
- Backend evaluates every interval independently; a delayed request cannot claim the gap because request payloads carry no duration and any server-observed gap over 25 seconds or beyond lease is rejected in full.

#### Provable invariants versus browser hints

- Backend can prove authenticated USER ownership, command receipt time, transaction order, lease/deadline values, generation, prior cursor, operation replay, aggregate/reward/notification uniqueness, and the absence of overlapping committed credit.
- Backend cannot independently observe human attention, DOM readiness, tab visibility/focus, or the exact client moment a page hid. Those are best-effort browser assertions accepted only through the constrained state machine; they never supply elapsed duration or timestamps.
- A heartbeat/interaction queued before a client boundary but received after lease/deadline expiration is judged by Backend receipt time. It receives no exception for being in flight. Ordinary interaction after idle still requires explicit RESUME.
- When client evidence and Backend timing cannot prove eligibility, the interval is discarded. This is deliberate bounded undercount, not a claim of perfect attention measurement.

### 7.3 Reward and projection

- Every accepted time/goal mutation evaluates current completion from stored seconds and current target.
- Initial goal setup and edits run under the USER lock.
- If day seconds meet target and no day reward exists, insert reward, increment `USER.total_xp` by 10, and insert completion notification atomically.
- If the unique reward already exists, project `reward_earned: true` without increment.
- Increasing a goal can project `completed: false` while the reward row remains.
- Never call streak repositories or create `STREAK_DAY`.
- Return current actual seconds, target, completion, reward-earned, XP/Level projection, owner state, and application date from the committed state.

### 7.4 Notification and monitor logic

- The authenticated shell establishes a monitor session on mount for USER only.
- Visible 60-second checks update `last_seen_at`. A gap exceeding the PLAN-defined monitor continuity tolerance (recommended 2 check intervals plus normal jitter: 150 seconds) resets both `continuity_started_at` and `eligible_baseline_at` to `serverNow` and returns without notification.
- Three timestamps have separate meanings: `last_engagement_at` is the last accepted READY/meaningful/RESUME and drives learning inactivity; `last_credited_at` is only the end of accepted accounting and never postpones a reminder; `continuity_started_at` proves that this monitor tab has remained running without a close/sleep gap.
- For a caller monitor, the authoritative reminder origin is `max(current_application_day_start, continuity_started_at, preference_eligible_since, latest last_engagement_at)`. If there has been no current-day learning engagement, monitor continuity/day start is the origin. Reminder due time is origin + approximately ten minutes; previous-day inactivity cannot immediately create the new day's reminder at midnight.
- The idle transition at engagement +120 seconds does not reset the reminder origin. Therefore an untouched Idle Pause Modal becomes eligible approximately ten minutes after the last qualifying engagement, not ten minutes after the modal appears. Navigating to Dashboard also leaves the learning engagement timestamp unchanged while the shell monitor continues.
- An unexpired owner blocks a reminder only when its session is still eligible (`serverNow < engagement_expires_at`). A merely live lease for an already idle session does not add an extra delay; the idle transition fences that owner.
- Disabling reminders takes effect in the USER transaction and blocks later inserts. Re-enabling sets `preference_eligible_since = serverNow` and resets each active monitor's future effective baseline; no missed interval can qualify.
- Completion notification creation ignores reminder preference and the inactivity unique key.
- Notification list/read APIs always filter by authenticated `user_id`; mark-read is idempotent and returns safe not-found for foreign/unknown IDs.
- Transient React toast may mirror a newly returned completion but is not persistence or deduplication authority.

Reminder examples:

- Last meaningful interaction at `10:00`, idle modal at `10:02`, monitor continuously live: earliest reminder eligibility is approximately `10:10`, not `10:12`.
- USER navigates from learning to Dashboard at `10:03` without another meaningful learning event: the shell monitor remains live and the origin remains `10:00`, so eligibility is still approximately `10:10`.
- All tabs close at `10:05` and one reopens at `10:20`: the new monitor continuity origin is `10:20`; no reminder is backfilled from `10:00`.
- Preference is re-enabled at `10:20`: `preference_eligible_since` becomes `10:20`; no disabled-period reminder is created.

### 7.5 Cleanup

- No external scheduler is introduced.
- The supported operation replay horizon is 30 days. Within that horizon, a matching receipt must remain readable and its parent tracking/monitor session must remain addressable; parent FKs use `RESTRICT`, not receipt-erasing cascades.
- Cleanup order is transactional and child-first: (1) delete operation receipts older than 30 days in a bounded batch; (2) delete CLOSED/expired tracking and monitor sessions older than 31 days only when no receipt references them and they are not the current owner; (3) optionally clear an owner pointer only after fencing it and proving its lease/session expired. Never delete daily aggregates, reward rows, or notification uniqueness evidence through operational cleanup.
- Active-but-abandoned sessions are first marked/fenced expired; their row is retained until the same 31-day parent horizon. A long-delayed request then either finds a retained stale generation and receives conflict or, after parent deletion, receives safe not-found; neither path credits time.
- Reward and completion/reminder uniqueness remain durable independently of receipt retention. A goal/preference operation arriving after the 30-day supported retry horizon is revalidated as a new current-state command, but unique reward/notification keys still prevent duplicate XP/notifications. Frontend never retries an operation beyond its active request/session lifecycle.
- Initial implementation may execute a small opportunistic batch (maximum 100 child rows then eligible parents, no more than once per process warm window) after successful commands, outside the user-visible transaction. Cleanup uses a database advisory cleanup lock so concurrent Vercel instances do not delete the same batch. Failure is logged safely and never fails learning.
- Before implementation, review whether Vercel process churn makes opportunistic cleanup insufficient. If so, manual guarded maintenance is the V1 fallback; any automated scheduler requires separate approval.

---

## 8. API Contract Plan

All endpoints require the existing authenticated session cookie and USER role. Existing envelopes remain `{ success, data }` / `{ success: false, error: { code, message } }`. Unknown fields are rejected. UUIDs must be valid. Controllers do not contain business logic.

### 8.1 Goal and progress

#### `GET /api/daily-goal`

- Response `200`: `{ application_date, target_minutes, active_seconds, actual_minutes, completed, reward_earned, reminder_enabled, xp_level }`.
- `target_minutes` may be null; `reminder_enabled` resolves null storage to true.
- Errors: existing `401`, `403`; `503` safe availability error.

#### `PUT /api/daily-goal`

- Request: `{ operation_id, target_minutes }`, integer 10–240.
- Response `200`: same projection plus `{ reward: { earned_now, xp_earned } }`.
- Idempotency: repeated matching operation replays; mismatched reuse returns `409 OPERATION_CONFLICT`.
- The target update, reevaluation, reward, XP, and completion notification are one transaction.

#### `PUT /api/daily-goal/reminder-preference`

- Request: `{ operation_id, enabled: boolean }`.
- Response `200`: `{ reminder_enabled, updated_at }`.
- Re-enable resets future reminder baseline; disable/re-enable never deletes notifications or backfills.

### 8.2 Tracking

#### `POST /api/daily-goal/tracking-sessions`

- Request: `{ operation_id, activity_type, learning_session_id?, set_id?, vocabulary_id? }`.
- Response `201` or replay `200`: `{ tracking_session_id, status, owner: false, generation: null, projection }`.
- Validate context/mode/access; inaccessible resources use existing safe not-found/forbidden conventions.

#### `POST /api/daily-goal/tracking-sessions/:id/engagement`

- Request: `{ operation_id, generation?, event_type }` where event type is READY, RESUME, or an activity-specific allowlisted meaningful event.
- Response `200`: `{ tracking_session_id, status, owner, generation, lease_expires_at, engagement_expires_at, projection }`.
- May transfer owner. Mismatched activity event returns `400 VALIDATION_ERROR`; an ordinary interaction received after the old deadline returns `409 IDLE_RESUME_REQUIRED` after zero expired-gap credit.

#### `POST /api/daily-goal/tracking-sessions/:id/heartbeat`

- Request: `{ operation_id, generation, eligibility: "VISIBLE_FOCUSED_ACTIVE" }`.
- Response `200`: current owner/projection and credited seconds for this operation.
- Stale generation or live different owner: `409 TRACKING_OWNERSHIP_CONFLICT` with safe `{ owner: false, current_generation, retry_after_ms }`; zero credit.
- Gap greater than 25 seconds while lease remains live: `200` with zero credited time and an advanced cursor/renewed lease. Expired lease: zero credit, advanced fence, and either safe reclaim under a new generation when engagement remains valid or `409` requiring READY/RESUME.
- Rate protection: accept at most one useful heartbeat per session inside a short lower bound (recommended 10 seconds); early calls replay/return zero without extending engagement.

#### `POST /api/daily-goal/tracking-sessions/:id/pause`

- Request: `{ operation_id, generation, reason }`, reason allowlist HIDDEN, BLURRED, IDLE, ROUTE_EXIT, LOGOUT, SLEEP, COMPLETED, ERROR.
- Response `200`: `{ status: "PAUSED"|"CLOSED", owner: false, projection }`.
- Duplicate safe; stale request adds zero.

#### `POST /api/daily-goal/tracking-sessions/:id/close`

- Request: `{ operation_id, generation }`.
- Response `200`: `{ status: "CLOSED", owner: false, projection }`; closes idempotently and credits no unconfirmed tail.

### 8.3 Monitor and reminder eligibility

Implementation is staged. B3 implements authenticated owner-scoped monitor establish/close lifecycle and the internal transactional check-state machinery for server-authoritative `last_seen_at`, continuity and eligibility-baseline transitions. A check gap exceeding 150 seconds resets `continuity_started_at` and `eligible_baseline_at` to Backend `serverNow` without backfill. B3 does not evaluate final reminder eligibility, create reminder notification rows, or introduce a monitor generation/lease field. The check route remains unpublished during B3, and B3 must not return `reminder_created: false` as a placeholder for behavior not yet implemented. B4 completes the public check response, including `reminder_created`, `unread_count` and `next_check_after_seconds`, together with reminder eligibility, creation and deduplication before exposing the route. The final public check contract below remains unchanged.

#### `POST /api/daily-goal/monitor-sessions`

- Request: `{ operation_id }`.
- Response `201/200`: `{ monitor_session_id, reminder_enabled, target_configured, unread_count, check_after_seconds }`.

#### `POST /api/daily-goal/monitor-sessions/:id/check`

- Request: `{ operation_id }`; no client inactivity duration or timestamp.
- Response `200`: `{ reminder_created, unread_count, next_check_after_seconds }`.
- Long check gap/sleep resets baseline and returns `reminder_created: false`.
- Concurrent checks serialize and unique constraint permits one inactivity reminder/day.

#### `POST /api/daily-goal/monitor-sessions/:id/close`

- Request: exactly `{ operation_id }`; both `:id` and `operation_id` are UUIDs, and missing or additional fields are rejected.
- Response `200`, using the standard success envelope: `{ monitor_session_id, closed_at }`, where `closed_at` is the Backend-generated canonical timestamp persisted by the initial close.
- Authentication and USER-role authorization use the existing safe `401`/`403` behavior. Ownership derives only from the authenticated USER; a foreign or unknown monitor returns safe `404` without ownership disclosure.
- A matching operation retry returns its persisted response without mutation. Reusing the operation ID with different content or operation type returns `409 OPERATION_CONFLICT`.
- A different operation ID closing an already closed owned monitor returns the existing closed projection without changing `closed_at`, under the same USER transaction and receipt conventions. A check with a new operation ID after close returns safe `404`.
- Close does not evaluate reminder eligibility or create a notification. No later server work happens because no scheduler exists.

### 8.4 Notifications

#### `GET /api/notifications?cursor=<opaque>&page_size=<n>`

- Default 20, maximum 50.
- Response `200`: `{ items: [{ id, type, title, body, application_date, created_at, read_at }], unread_count, next_cursor }`.
- Stable order `(created_at DESC, id DESC)`; opaque cursor.

#### `GET /api/notifications/unread-count`

- Response `200`: `{ unread_count }`.

#### `PATCH /api/notifications/:id/read`

- Request: `{ read: true }` only in V1.
- Response `200`: notification projection and updated unread count.
- Repeated call is idempotent; foreign/unknown ID returns safe `404`.

### 8.5 Error and abuse rules

- `400 VALIDATION_ERROR`: malformed/unknown fields, invalid enum/context, target outside 10–240.
- `401 AUTHENTICATION_FAILED` and `403 FORBIDDEN`: existing middleware responses.
- `404 NOT_FOUND`: inaccessible tracking/notification identity without ownership leakage.
- `409 OPERATION_CONFLICT`, `TRACKING_OWNERSHIP_CONFLICT`, or `TRACKING_STATE_CONFLICT`: deterministic non-mutating conflicts.
- `429` may be used for sustained endpoint flooding; normal early heartbeats should return a safe zero-credit projection to avoid retry storms.
- Payload size remains Express JSON default unless existing global limits are tightened separately. Per-route field/length allowlists are mandatory.

---

## 9. Frontend Plan

### 9.1 Proposed modules

- `frontend/src/services/daily-goal-service.js` — validate DTOs and expose goal, preference, tracking, monitor, and notification methods through `httpClient`.
- `frontend/src/daily-goal/daily-goal-tracker.jsx` — provider/hook owning local eligibility, idle deadline, heartbeat schedule, visibility/focus/drift handling, server session/generation, retry, and teardown.
- `frontend/src/daily-goal/daily-goal-activity-adapter.js` — activity/event allowlists and adapter interface; no activity scoring logic.
- `frontend/src/daily-goal/idle-pause-dialog.jsx` — shared accessible modal and explicit resume.
- `frontend/src/daily-goal/daily-goal-card.jsx` — first-use/configured/edit states and reminder toggle.
- `frontend/src/daily-goal/daily-goal-monitor.jsx` — shell monitor session/check lifecycle.
- `frontend/src/notifications/notification-center.jsx` — Bell, unread badge, panel/list, mark-read, loading/empty/error states.

Exact file grouping may be simplified during TASK review, but responsibilities must remain separated from activity algorithms.

### 9.2 Shared tracker behavior

- Mount only inside authenticated USER learning routes; ADMIN and Guest never call APIs.
- Activity page supplies `ready`, `unfinished`, exact activity context, playback/recognition phases where applicable, and explicit meaningful event calls.
- On ready: establish session then send READY engagement. Loading/error/completed states stay paused.
- Maintain local monotonic `lastMeaningfulAt`; generic mousemove, scroll, arbitrary key, response arrival, timer, and heartbeat never update it.
- At 120 seconds, stop heartbeat immediately, best-effort pause, and show modal if the activity remains visible.
- `visibilitychange`, window `blur`, route exit, logout, component unmount, and activity completion pause/close immediately.
- On focus/visible return under 120 seconds, revalidate and reclaim; after 120 seconds or drift, show modal and require **Tiếp tục học**.
- Track server conflicts as a small non-blocking non-owner status; never disable learning controls.
- Keep last confirmed projection for non-destructive stale/error display. Never synthesize seconds offline.
- Optional `BroadcastChannel` can reduce duplicate calls and speed owner-status propagation, but all tabs must remain correct if unavailable.

### 9.3 Activity adapters

#### Normal Flashcard

- Integrate at ready card reconciliation in `learning-foundation-page.jsx`/`normal-learning-session.js`.
- Meaningful events: reveal, deliberate previous/next navigation, requested reference pronunciation.
- Stop on completed/empty/error/route exit; do not change reveal evidence or learning-session completion.

#### SRS

- Integrate with existing `srs-learning-session.js` state.
- Meaningful events: reveal, requested pronunciation, eligible rating command.
- Rating retry/response alone does not reset idle. Existing scheduler, revision, receipt, XP, and Streak flow remains authoritative.

#### Multiple-choice Quiz

- Integrate into `quiz-foundation-page.jsx` at ready question, choice selection, submit, and deliberate advance.
- Server response arrival, operational retry, restart confirmation, and completed screen do not count as meaningful on their own.
- Do not expose correct answer early or change grading/reward behavior.

#### Speaking Practice

- Integrate with `speaking-practice-page.jsx` and session controller using exact Set/Vocabulary identity.
- Meaningful events: requested sample playback, recognition start/stop request, target navigation.
- Eligibility can remain active only during bounded playback phases and existing STARTING/LISTENING/FINALIZING watchdog phases.
- Add a finite playback safety timeout wrapper because `reference-playback-coordinator.js` currently relies on native end/error. Proposed initial cap: `max(15 seconds, min(60 seconds, known media duration + 5 seconds))`; when duration is unknown, 30 seconds. This is a PLAN safeguard subject to focused review, not a pronunciation behavior change.
- Late native events do not reset idle; no audio/transcript/confidence is sent to Backend.

### 9.4 Dashboard card

- Add an independent `useDashboardSource`-style source so Daily Goal failure cannot block progress/streak/sets.
- Unset state shows already accumulated current-day time where available, presets, custom integer input, inline validation, and reminder toggle.
- Configured state shows actual/target minutes, capped visual progress, current completion, reward-earned, edit action, and toggle.
- Goal save uses a stable operation UUID across retry and consumes the atomic reward projection; it may display the existing XP toast once when `earned_now` is true.
- Toggle uses optimistic UI only if rollback/error is explicit; safer initial implementation is pending-disabled control until authoritative response.
- Use labelled inputs, `role=status` for save feedback, non-color status, 44px controls, reduced motion, and responsive reflow.

### 9.5 Idle Pause Modal

- Use native `<dialog>` or the established accessible dialog pattern.
- Heading **Phiên học đang tạm dừng**, primary action **Tiếp tục học**.
- Focus primary action on open, trap/contain focus, make background inert, and restore meaningful activity focus after successful resume.
- Escape/cancel leaves tracking paused. Modal never recreates or clears the underlying run.

### 9.6 Authenticated shell, monitor, and Notification Center

- Keep the USER monitor mounted at the `AuthenticatedShell` level, including focus-learning shell rendering and Dashboard navigation.
- Pause checks while document is hidden; on long return establish/reset rather than request a retroactive reminder.
- Stop/close on logout/session invalidation/unmount.
- Add Bell beside the USER account control on desktop/mobile; ADMIN shell remains unchanged.
- Bell has accessible name and unread text/count, opens keyboard-operable panel, restores focus on close, and uses loading/empty/error/retry states.
- Paginate on explicit “load more”; mark-read is explicit and idempotent. Opening the panel does not automatically mark everything read unless separately approved (not in scope).

---

## 10. Security and Validation

- Backend authentication and USER role middleware guard every endpoint; frontend role checks are presentation only.
- Every query/mutation filters by authenticated `user_id`; tracking, monitor, operation, and notification IDs alone never authorize access.
- Client cannot submit credited seconds, timestamps, application date, timezone, XP amount, completion, Level, Streak, notification text/type, or another owner.
- Validate exact request fields and activity/event/state transitions in service/domain layers.
- Use server-generated session IDs, opaque cursor values, monotonic database generation, request fingerprints, and unique constraints.
- Plain backend-authored notification content only; no client HTML.
- Rate protect tracking/session creation, engagement, heartbeat, monitor check, and notification mutation per authenticated USER/IP using an existing/simple in-process boundary only if it is already available. Because Vercel instances do not share memory, database protocol limits and uniqueness remain authoritative; adding distributed rate-limit infrastructure is out of scope.
- Do not log cookie/session tokens, fencing values in full, raw notification content containing user data, microphone data, or secrets. Structured diagnostics may include hashed/truncated operation/session identifiers and credited count.
- Account deletion cascades new USER-owned Daily Goal data. Existing USER deletion behavior must be checked before selecting database `CASCADE`; if users are soft-disabled only, retention follows that lifecycle.

---

## 11. Operational Feasibility

### 11.1 Illustrative request/write volume

Assumption: 100 daily active USERs, each learns 30 minutes and keeps the app open for 60 minutes.

- Tracking heartbeats: `100 × 30 × 60 / 20 ≈ 9,000` requests/day.
- Monitor checks: `100 × 60 / 1 ≈ 6,000` requests/day before cross-tab optimization.
- Notification unread polling at 60 seconds for 60 visible minutes: up to another 6,000 reads/day; focus/open refreshes add a small amount.
- Tracking receipts: roughly 9,000 heartbeat rows/day plus engagement/lifecycle operations; 30-day retention is approximately 270,000 heartbeat receipts at this assumption.
- Daily aggregate writes: up to one per accepted owner heartbeat, also about 9,000/day.

These are arithmetic scenarios, not measured traffic or capacity guarantees.

### 11.2 Pressure and mitigation

- **Vercel invocations:** each heartbeat/check is one invocation. Do not shorten cadence without evidence. Suspend calls while hidden/idle/non-owner where possible.
- **Supabase connections:** Prisma interactive transactions plus serverless concurrency can pressure the pool. Keep USER-locked transactions short, avoid external calls inside them, and confirm pooled `DATABASE_URL`/connection settings before load testing.
- **Hot rows:** only one owner writes a USER/day aggregate; advisory lock serializes same-user races. Different users proceed independently.
- **Receipt growth:** bounded 30-day retry horizon, indexed child-first cleanup, and minimal replay data; validate measured row size before accepting the retention cost.
- **Polling:** consolidate unread count with monitor-check response when possible; the Bell endpoint remains available for explicit refresh.
- **Timer throttling:** delayed checks/heartbeats never convert elapsed client time into credit or retroactive reminders; they undercount/reset.
- **Degradation:** if tracking API fails, learning continues with non-blocking status; no fabricated time/XP. If notification APIs fail, learning and tracking continue.

### 11.3 Required evidence before production claim

- Confirm Vercel function limits/runtime and backend region.
- Confirm Supabase plan, database region, connection pool mode/size, statement/transaction timeouts, and storage budget.
- Measure transaction latency and contention with an approved isolated database.
- Measure real receipt size and browser request cadence.
- Until verified, capacity remains UNKNOWN; the PLAN makes no concurrency SLA claim.

---

## 12. Testing and Validation Strategy

No tests run during PLAN authoring. Future execution must use the Test Skill and approved infrastructure.

### 12.1 Backend unit/domain tests (database-independent)

- Fake-clock 120-second boundary: account under the old deadline before extension, ordinary post-deadline interaction requires RESUME, zero expired-gap credit, and heartbeat never extends engagement.
- Exact §5.3 cases: 20-second accepted interval; 30-second gap rejected in full despite live lease; expired lease rejected/fenced; cursor advancement burns invalid gaps; matching retry has no second mutation.
- Millisecond conservation across repeated intervals and Vietnam midnight splitting, including the 800 ms boundary example and exact half-open midnight edges; no per-heartbeat flooring.
- Goal validation 10/240 accepted and invalid values rejected; uncapped actual seconds.
- Completion versus reward-earned projection after goal increase/decrease.
- Reminder effective-default ON, OFF, re-enable baseline, long-gap reset, completion independence, and due time measured from last qualifying engagement rather than idle-modal time or last credit.
- Activity/event allowlists and Speaking bounded phases/watchdogs.

### 12.2 Guarded backend integration/API tests

- Schema constraints, FKs, cascades, unique reward/notification/day identities, indexes, and migration rollback assumptions.
- Authentication `401`, ADMIN `403`, ownership isolation, safe not-found, unknown fields, malformed UUID/enums.
- Two simultaneous claims/heartbeats produce one owner and no overlap.
- Stale generation and delayed/over-limit/expired-lease heartbeat add zero; full invalid gap is permanently excluded; matching retry replays; mismatched operation conflicts.
- Atomic daily aggregate + reward + XP + completion notification under injected transaction failure.
- First setup after pre-goal time above/below target; concurrent setup/update awards once.
- SRS/Quiz XP tables and amounts unchanged; no `STREAK_DAY` from Daily Goal.
- Reminder preference races, multi-device eligibility dedupe, no goal/no reminder, active owner block, long sleep/tab close no backfill.
- Receipt cleanup is child-first and respects the 30-day replay/31-day parent horizons; retained replay works, removed stale parent returns safe not-found, and durable reward/notification uniqueness survives cleanup.
- Notification pagination/unread/read idempotency and cross-user isolation.

**Database guard:** never use the current `backend/.env.test` Preview TEST target for reset, migration, concurrency, or failure-injection work. Gate DG-1 migration correctness uses only the fresh per-run ephemeral target in §6.5.1 and has no external URL fallback. Other future state-changing database tests still require their separately approved CI-exclusive identity, credential/ownership proof, and reset authorization; if those prerequisites are unavailable, those tests remain `NOT RUN`. Preview TEST, Main, Production, shared development, manual TEST, and application-user data remain untouched.

### 12.3 Frontend unit/component tests

- Tracker fake timers: meaningful versus generic input, 120 seconds, focus/visibility, drift, explicit resume, route exit/logout cleanup.
- Stable operation ID retry, owner conflict/non-owner display, no offline accumulation.
- Four adapters emit only approved events and stop on completion/error.
- Speaking playback/recognition phase mapping and timeout cleanup.
- Dashboard unset/configured/edit/over-target/reward-earned and toggle pending/error states.
- Bell unread count, panel states, mark-read focus, and no automatic learning-idle reset.

### 12.4 Playwright/E2E

- Deterministic deferred/fake Daily Goal API clock fixtures for idle, owner handoff, reminder, and retry flows.
- Multi-page browser context for two tabs; separate contexts for device-like races.
- Normal, SRS, Quiz, and Speaking ready/interaction/completion integrations.
- Hidden/focus return, sleep-gap simulation, midnight fixture, first goal setup, increase/decrease, and one toast/notification.
- Dashboard→learning→Dashboard monitor continuity; all pages closed/reopened yields no retroactive reminder.
- Preference default ON, persist OFF/ON across restored auth contexts, no reminder OFF, no backfill, completion still created.
- Mobile widths, zoom/reflow, keyboard-only dialog/Bell/panel, focus restoration, accessible names/status, non-color state, and reduced motion.

### 12.5 Manual and performance review

- HUMAN visual review of Dashboard card, modal, non-owner status, Bell/panel at desktop/mobile.
- Focused UI/UX Review before visual approval.
- Small isolated load probe for one hot USER and many independent USERs; inspect p95 transaction time, pool saturation, lock wait, receipt growth, and invocation count.
- Full regression is deferred until implementation reaches authorized TEST/REVIEW stages.

---

## 13. Acceptance-Criteria Traceability

| Coverage group | Acceptance Criteria | PLAN sections |
|---|---|---|
| Goal setup, validation, roles, legacy isolation | AC-DG-001–006 | 6.1, 7.3, 8.1, 9.4, 10 |
| Eligible activities and idle semantics | AC-DG-007–015 | 5.2, 7.2, 9.2–9.3, 12.1–12.4 |
| Ownership, fencing, offline safety, midnight | AC-DG-016–021 | 5, 6.2–6.4, 7.2, 8.2, 12 |
| Uncapped progress, XP/reward, goal edits, Streak | AC-DG-022–028 | 6.2–6.3, 7.3, 8.1, 12.1–12.2 |
| Notification Center and reminder core | AC-DG-029–039 | 6.2–6.3, 7.4, 8.3–8.4, 9.6, 12 |
| Failure isolation, accessibility, no external delivery, privacy | AC-DG-040–044 | 9, 10, 11.2, 12.3–12.5 |
| Pre-goal tracking and atomic first setup | AC-DG-045–049 | 6.1–6.4, 7.2–7.3, 8.1–8.2, 12.1–12.2 |
| Reminder preference and completion independence | AC-DG-050–055 | 6.1–6.3, 7.4, 8.1/8.3, 9.4/9.6, 12 |

All BR-DG-001–078 are implemented through the same grouped boundaries: BR 001–011 in goal/aggregate/projection, BR 012–035 in adapters/idle/Speaking, BR 036–049 in ownership/accounting/day splitting, BR 050–059 in atomic reward/XP/Streak isolation, and BR 060–078 in notification/monitor/preference design.

---

## 14. Implementation Roadmap and Gates

This is phased planning, not a TASK document.

### Phase 1 — Persistence and safety foundation

- Add reviewed migration/schema, domain constants, Vietnam interval helpers, repository transaction lock, and guarded migration tests.
- Gate: schema/constraints reviewed; the §6.5 per-run ephemeral PostgreSQL contract and exact 11→12 migration evidence are proven; no legacy field reinterpretation; rollback plan accepted; HUMAN accepts DG-1. Supabase platform validation remains a separate pre-Preview/Production deployment gate.

### Phase 2 — Ownership and accounting protocol

- Implement tracking session, owner lease/fence, operation receipts, bounded interval/midnight aggregation, and API contracts.
- Gate: fake-clock unit tests plus concurrent guarded integration prove no overlap, idle extension, stale credit, or offline backfill.

### Phase 3 — Goal, reward, and projection

- Implement read/update, pre-goal aggregate, first setup reevaluation, additive reward ledger, XP increment, Level projection, and Streak isolation.
- Gate: failure injection proves atomicity and once/day behavior; SRS/Quiz XP and Streak regressions pass.

### Phase 4 — Notifications and monitor

- Implement notification table/API, preference, monitor sessions, eligibility/dedupe, completion transaction, cleanup.
- Gate: preference/default/re-enable, closed/sleep/no-retroactive, concurrent-device, and authorization tests pass.

### Phase 5 — Shared frontend tracker and idle modal

- Implement service, provider/hook, local idle/focus/visibility/drift state, conflict status, and accessible modal.
- Gate: fake-timer/component tests; no activity integration yet enabled without adapter tests.

### Phase 6 — Four activity integrations

- Integrate Normal, SRS, Quiz, then Speaking with focused tests after each adapter.
- Gate per adapter: existing activity tests pass; tracking failure cannot change learning outcome; Speaking privacy/watchdogs unchanged.

### Phase 7 — Dashboard and Notification Center

- Add card, preference toggle, shell monitor, Bell/panel, toast bridge, responsive/accessibility states.
- Gate: focused Playwright and UI/UX Review, then HUMAN desktop/mobile visual approval.

### Phase 8 — Concurrency, performance, and regression validation

- Run approved isolated concurrency/load checks and focused full-stack regressions.
- Gate: capacity facts documented; no unsafe DB target; known limitations accepted.

### Phase 9 — Documentation and deployment readiness

- Synchronize project/API/database/UI/architecture/status docs only after verified implementation and review.
- Gate: TEST + REVIEW + HUMAN approval before FEATURE_STATUS can become DONE; deployment remains separately authorized.

Each phase should remain independently reviewable and use feature flags or unmounted routes/components where necessary to avoid exposing a partially integrated flow. No phase should delete prior schema/data as rollback.

---

## 15. Documentation Impact

After implementation is verified and explicitly authorized:

- `docs/PROJECT_OVERVIEW.md` — replace XP-target/percentage-bonus legacy direction.
- `docs/ARCHITECTURE.md` — add Daily Goal tracking, owner/fence, monitor, notification, and transaction boundaries.
- `docs/DATABASE.md` — document exact approved models, constraints, retention, deletion, and migration.
- `docs/API_SPEC.md` — replace deferred XP Daily Goal endpoints with the final contracts.
- `docs/UI_UX_SPEC.md` — document card, toggle, modal, status, Bell/panel, responsive/accessibility flows.
- `docs/FEATURE_STATUS.md` — keep TODO/IN_PROGRESS during implementation and mark DONE only after TEST, REVIEW, HUMAN approval, and documentation synchronization.

---

## 16. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Heartbeats accidentally extend idle | Separate immutable engagement deadline from lease; heartbeat never updates meaningful time |
| Concurrent overlap | USER advisory lock, one owner row, generation fence, server-derived bounded intervals |
| Duplicate XP/notifications | Separate unique reward/day and notification/type/day constraints inside one transaction |
| Client fabricates duration/focus | Accept no client duration/timestamp; reject over-limit intervals; client signals are eligibility hints, not independently observable attention |
| Browser close/sleep loses final interval | Accept bounded undercount; lease/deadline and full rejection beyond the 25-second ceiling prevent fabricated catch-up |
| Serverless connection pressure | Short transactions, no external calls, pooled connection verification, measured load gate |
| Receipt/monitor growth or FK cleanup error | 30-day receipt/31-day parent horizons, `RESTRICT` FKs, child-first guarded cleanup, durable reward/notification rows |
| Opportunistic cleanup unreliable on Vercel | Measure; keep manual guarded maintenance fallback; request separate approval before scheduler |
| Notification polling cost | Pause hidden polling, combine unread count with monitor response, 60-second default |
| Speaking native event hangs | Existing recognition watchdogs plus reviewed finite playback safeguard |
| Preview/production data damage in tests | Fail-closed CI-exclusive guard; mark database tests NOT RUN when proof/credentials absent |
| Legacy docs conflict | Reconcile only after approved implementation; never use `daily_xp_goal` as minutes |

---

## 17. PLAN Review Decisions and Remaining Unknowns

### Decisions proposed for HUMAN PLAN approval

- PostgreSQL owner lease/fencing design with USER-scoped advisory transaction locking.
- Timing defaults: 20-second heartbeat, 45-second lease, 25-second maximum delta, 60-second monitor/poll, 150-second monitor continuity tolerance.
- Separate `DAILY_GOAL_REWARD` rather than altering Vocabulary-scoped `XP_REWARD`.
- Nullable reminder preference (`NULL` projects to enabled) and separate short-lived monitor sessions.
- Durable aggregate/reward/notification data plus the specified ephemeral owner, tracking, monitor, and receipt records; no external scheduler.
- Thirty-day operation retry/receipt horizon and 31-day closed-session horizon with `RESTRICT` FKs and bounded child-first opportunistic/manual cleanup.

### Infrastructure UNKNOWN, not business blockers

- Vercel runtime limits/region and realistic invocation budget.
- Supabase plan/region/pool mode/pool size/timeouts, exact intended PostgreSQL major, and platform-target readiness.
- Actual active-user concurrency and typical session duration.
- Whether deployment operations already provide an approved maintenance mechanism for retention cleanup.

These unknowns block capacity claims, Supabase platform validation, and Preview/Production deployment readiness. They do not make the existing Supabase target a prerequisite for the §6.5 ephemeral DG-1 migration-correctness path, although the intended Supabase PostgreSQL major must be confirmed before otherwise complete ephemeral evidence can receive final DG-1 acceptance.

### Business blockers

None. The approved SPEC contains no unresolved business decision.

---

## 18. Approval Gate

This PLAN Revision R1 is `HUMAN APPROVED` in full.

This approval authorizes TASK authoring only. It does not authorize source, schema, migration, test, database, infrastructure, documentation-synchronization, deployment, or other implementation changes; those remain subject to the subsequent TASK review and explicit execution gates.
