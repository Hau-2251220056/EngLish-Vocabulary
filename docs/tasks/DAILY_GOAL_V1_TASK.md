# TASKS: Daily Goal V1 — Active Learning Time and In-App Notifications

**TASK status:** `HUMAN APPROVED`

**Feature status:** `TODO`

**Approved inputs:**

- `docs/specs/DAILY_GOAL_V1_SPEC.md` — HUMAN APPROVED; BR-DG-001–078 and AC-DG-001–055.
- `docs/plans/DAILY_GOAL_V1_PLAN.md` — HUMAN APPROVED Revision R1.
- Planning baseline: `feature/daily-goal-v1` at `b0d89157f4e4d81fb81449c861bd0ec7c9d8e40a`.

**Implementation authorized:** `TASK-256 OFFLINE CI INTEGRATION ONLY`

**TASK-256 Phase B/C/D live execution / migration / database access / TASK-258–277 execution / commit / push / deployment authorized:** `NO`

## 1. Overview and scope gate

TASK-254 through TASK-277 decompose the approved backend-authoritative Daily Goal V1 design. They add millisecond Active Learning Time, one fenced owner per USER, pre-goal tracking, atomic once/day `+10 XP`, persisted notifications, an app-running inactivity monitor, four thin activity adapters, and the approved Dashboard/Header UI.

No task changes existing learning outcomes, SRS/Quiz rewards, Level thresholds, Streak qualification, legacy `USER.daily_xp_goal`, or Vocabulary-scoped `XP_REWARD`. No task adds email, Web Push, Browser Notification permission, Service Worker delivery, an external scheduler/service, a full notification Settings module, analytics history, or a new role/dependency. Technical defaults remain PLAN decisions, not SPEC constants.

HUMAN accepted TASK-254, TASK-255, the migration-quarantine amendment, TASK-256 Phase A, and TASK-257 within their offline scopes. Only TASK-256 offline CI integration is currently authorized for implementation. Phase B/C/D live execution and TASK-258–277 remain unauthorized, Gate DG-1 remains unpassed, and database access, migration execution, commit/push, and deployment remain prohibited.

## 2. Phase and gate distribution

| Phase | Tasks | Gate |
|---|---|---|
| Safety and persistence | TASK-254–256 | DG-1 migration design and isolated-database authorization |
| Time/accounting protocol | TASK-257–260 | DG-2 backend correctness/concurrency evidence |
| Goal, reward, notifications | TASK-261–265 | DG-3 atomicity/security/reminder evidence |
| Shared frontend foundation | TASK-266–268 | DG-4 tracker/modal review |
| Four activity adapters | TASK-269–273 | DG-5 activity regression review |
| Dashboard and Notification Center | TASK-274–275 | DG-6 Focused UI/UX + HUMAN visual approval |
| Integrated validation and closure | TASK-276–277 | DG-7 formal TEST/REVIEW; separate deployment readiness |

Total: **24 tasks**, TASK-254 through TASK-277.

## 3. Dependency graph

```text
TASK-254 → TASK-255 → TASK-256 → STOP DG-1
                         ↓
TASK-257 → TASK-258 → TASK-259 → TASK-260 → STOP DG-2
                         ↓
              TASK-261 → TASK-262
                         ↓
              TASK-263 → TASK-264 → TASK-265 → STOP DG-3
                         ↓
              TASK-266 → TASK-267 → TASK-268 → STOP DG-4
                         ↓
        TASK-269 → TASK-270 → TASK-271 → TASK-272 → TASK-273 → STOP DG-5
                                                        ↓
                                              TASK-274 → TASK-275 → STOP DG-6
                                                                  ↓
                                              TASK-276 → TASK-277 → STOP DG-7
```

Tasks may be parallelized only after their dependencies are satisfied and HUMAN explicitly authorizes coordinated work. Shared schema, repository, `create-app.js`, tracker, shell, and activity-page edits must not be parallelized in one worktree.

## 4. Verification and database boundaries

- Static/pure verification may use source inspection, fake clocks, mocks, lint/build, and DB-independent tests when execution is later authorized.
- Any migration, reset, concurrency, failure-injection, or state-changing database test is `BLOCKED` until an explicitly identified CI-exclusive database and fail-closed guard are HUMAN-authorized.
- `backend/.env.test` points to Vercel Preview TEST and is never a disposable fixture. Preview, Production, shared development, and manual TEST databases are prohibited for destructive/state-changing verification.
- There is no fallback database. Missing identity, credentials, ownership proof, or reset authorization produces `NOT RUN`, never PASS.
- UI changes require Focused `ui-ux-review` and HUMAN desktop/mobile visual approval. Formal TEST and REVIEW remain separate stages. Deployment requires separate authorization.

## 5. Implementation tasks

### TASK-254 — Freeze safety baseline and migration contract

**Status:** `HUMAN ACCEPTED — OFFLINE SCOPE; LIVE DATABASE VALIDATION NOT RUN`\
**Objective:** Prepare the reviewed persistence change set without executing it.\
**Dependencies:** HUMAN-approved TASK document.\
**Files / modules:** `backend/prisma/schema.prisma`; new migration draft; database guard/config helpers; PLAN §6, §12.2.\
**In scope:** inventory current USER deletion semantics and test guards; define nullable goal/preference/re-enable fields, all six new persistence groups, enums, checks, indexes, FKs, `RESTRICT` receipt parents, and additive rollback/disable strategy. Preserve `daily_xp_goal` and `XP_REWARD`.\
**Out of scope:** applying migrations or accessing a database.\
**SPEC / PLAN:** BR-DG-001–011, 036–049, 050–078; AC-DG-005–006, 016–024, 029–034, 045–055; PLAN §§6, 10, 14 Phase 1.\
**Acceptance / evidence:** reviewed schema/SQL diff maps every field/constraint/index and proves no legacy reinterpretation, destructive rollback, or unrelated model change; static Prisma/migration review is recorded.

**Focused R1 evidence:** Operation receipts store exact accepted duration as `credited_milliseconds BIGINT`; replay returns that stored millisecond value and the stored response projection without converting it into an authoritative seconds input. Request fingerprints include the command boundary and normalized command fields, so reuse of an operation ID for a different endpoint, session, event, generation, preference value, or goal value conflicts.

| API/service command | Receipt operation type |
|---|---|
| `PUT /api/daily-goal` | `GOAL_UPDATE` |
| `PUT /api/daily-goal/reminder-preference` | `REMINDER_PREFERENCE_UPDATE` |
| Establish tracking session | `CREATE` |
| Engagement `READY` | `READY` |
| Timely activity-specific engagement while retaining current ownership | `INTERACTION` |
| Eligible engagement that claims/transfers ownership | `CLAIM` |
| Explicit post-idle engagement `RESUME` | `RESUME` |
| Owner/reclaim heartbeat | `HEARTBEAT` |
| Tracking pause | `PAUSE` |
| Tracking close | `CLOSE` |
| Establish monitor session | `MONITOR_CREATE` |
| Monitor eligibility check | `MONITOR_CHECK` |
| Monitor close | `MONITOR_CLOSE` |

Read-only goal/notification APIs and notification mark-read do not create operation receipts: their approved contracts carry no operation ID, and mark-read is idempotent from current persisted state. USER-scoped services must verify receipt/session/monitor/owner identities under the same USER transaction lock; the individual foreign keys intentionally do not add composite cross-USER FKs. Account deletion requires explicit child-first removal of operation receipts before their `RESTRICT` tracking/monitor parents, followed by the remaining account-owned cascades.

### TASK-255 — Implement fail-closed database safety gates

**Status:** `HUMAN ACCEPTED — OFFLINE SCOPE; LIVE DATABASE VALIDATION NOT RUN`\
**Objective:** Make unsafe database execution impossible by default.\
**Dependencies:** TASK-254.\
**Files / modules:** existing test-environment/guard helpers, CI test configuration, migration-test harness; no secrets.\
**In scope:** require explicit CI-exclusive identity and reset/migration authorization; reject Preview TEST, Production, shared/manual targets; emit `NOT RUN` when prerequisites are absent.\
**Out of scope:** provisioning credentials, running migration/concurrency tests, or modifying infrastructure.\
**SPEC / PLAN:** PLAN §§2.1, 6.5, 12.2, 14 Phase 1.\
**Acceptance / evidence:** pure guard tests/static evidence show fail-closed behavior and no fallback to `backend/.env.test`.

**Focused R1 evidence:** Daily Goal uses the isolated `prepareDailyGoalDatabase()` authorization → connected-identity → protected-operation sequence; the shared legacy preparation path is preserved. Thirteen offline tests cover missing/mismatched/prohibited configuration, cross-operation authorization, secret-safe diagnostics, mock connected identity, mutation ordering, and legacy structural compatibility. Live identity observation and every database operation remain `NOT RUN`; see `backend/test/README.md` for the audited call-path matrix.

### DG-1 MIGRATION QUARANTINE SAFETY AMENDMENT

**Status:** `HUMAN ACCEPTED — OFFLINE SCOPE; ACTIVATION AND DATABASE EXECUTION NOT RUN`\
**Authorization:** Separate HUMAN-approved offline safety amendment; it does not authorize TASK-256 or database mutation.\
**Reason:** Prisma `migrate deploy` applies every pending migration in its configured active migration directory. The unapplied Daily Goal draft was therefore moved out of `backend/prisma/migrations` so shared preparation and the existing XP/Streak migration-copy harnesses cannot discover it before DG-1 authorization.\
**Artifact:** Original migration name `20261022000000_add_daily_goal_v1`; original path `backend/prisma/migrations/20261022000000_add_daily_goal_v1/migration.sql`; quarantined path `backend/prisma/migration-drafts/daily-goal-v1/20261022000000_add_daily_goal_v1/migration.sql`; 11,487 bytes; SHA-256 `8e468739c3f60693e9ff53d1c3d4107124ac1feaa9d95ac3a665ea8b8c89edb6`. Byte-for-byte preservation and exclusion from Prisma/XP/Streak discovery are verified by offline tests.\
**Activation contract:** Future TASK-256 work requires separate HUMAN authorization for the exact operation and target, a genuinely isolated CI-exclusive database, configured and connected-target identity verification, checksum verification, review of every pending migration, and restoration of these exact reviewed bytes to the original path through an approved procedure. Restoring the file makes it visible to shared migration runners; activation alone never authorizes `migrate deploy` or any database mutation.\
**Gate:** DG-1 remains `NOT PASSED`; activation, live identity observation, Prisma commands, database access, migration execution, reset, rollback, and database-dependent verification remain `NOT RUN`.

### TASK-256 — Verify migration design and stop at Gate DG-1

**Status:** `PHASE A + PRIOR OFFLINE AMENDMENTS HUMAN ACCEPTED; PRISMA SCOPED READ-ONLY BINDING — IMPLEMENTED, AWAITING HUMAN REVIEW; PHASE B LIVE/C/D BLOCKED`\
**Objective:** Validate migration safety only on an approved isolated target.\
**Dependencies:** TASK-254–255 and explicit database identity/authorization.\
**Files / modules:** migration/schema tests and evidence report.\
**In scope:** generate client, apply/inspect migration, verify checks/FKs/indexes/cascades and safe rollback-before-data assumptions.\
**Out of scope:** Preview/Production migration, deployment, or destructive rollback after durable data.\
**SPEC / PLAN:** AC-DG-004, 016, 019, 024, 030, 034, 048; PLAN §§6.5, 12.2.\
**Acceptance / evidence:** guarded results are PASS or honestly `NOT RUN`; HUMAN accepts Gate DG-1 before persistence-dependent work.

**Phase A offline evidence:** A dedicated dependency-injected harness now enforces configuration authorization, independent connected-target evidence and same-handle binding, quarantine checksum verification, ephemeral activation outside the source repository, exact ordered migration-history/pending-set approval, and immediate reauthorization before a mockable executor boundary. No live observer, PostgreSQL adapter, Prisma executor, database credential, workflow mutation path, or repository-active migration copy exists. Phase B target observation/history access, Phase C pending-set HUMAN approval, and Phase D mutation remain separately blocked; DG-1 remains `NOT PASSED`.

**Offline CI integration status:** `IMPLEMENTED — AWAITING HUMAN REVIEW`. Existing Trust Gate, shared concurrency and dispatch mutual exclusion now include dormant Daily Goal Phase B/Phase D routes. Observation has a distinct fail-closed permission, mocked connected-target mapping, and destination-bound Context A/Context B migration-history approval. Both workflow jobs are literally disabled and contain no credential, live adapter, Prisma or mutation path. Base-target ownership evidence remains unavailable; Phase B/C/D stay `BLOCKED`, and DG-1 remains `NOT PASSED`.

**Phase B offline implementation evidence:** Added a dependency-injected read-only observer contract with no import-time connection, driver, environment loading, Prisma command, or executable workflow path. Its static `SELECT` queries observe the connected database/schema/server identity, independently stored CI-exclusive database marker, and `_prisma_migrations` history through the same injected handle before closing it safely. Missing/malformed ownership evidence, identity mismatch, non-observation authorization, mutating SQL, invalid history, and connection errors fail closed without exposing credentials. Offline mock/static tests cover this boundary only; no live marker has been observed and no database has been accessed. `TASK-256 PHASE B LIVE`, Phase C/D, and DG-1 remain blocked/not passed.

**Phase B read-only safety-fix evidence:** The observer now owns its connection for the full observation, requires a verified `POSTGRESQL_TRANSACTION_READ_ONLY` attestation before any target/history query, and gives downstream code only a deeply frozen data snapshot with no connection, query, factory, SQL executor, or executable nested value. Phase A target continuity now uses a frozen plain-data binding token; raw handles, functions, accessors, custom prototypes, missing/read-write attestation, and verification errors fail closed. Static SQL checks remain defense-in-depth. These offline mocks do not prove live PostgreSQL role privileges or marker provisioning; Phase B live and Phase C/D remain blocked, and DG-1 remains not passed.

**Phase B PUBLIC TEMPORARY exception and schema-qualification evidence:** HUMAN accepts that a role dedicated exclusively to Phase B observation may inherit PostgreSQL `TEMPORARY` solely through the existing `PUBLIC` grant on the CI-only `postgres` database. V1 neither grants `TEMPORARY` directly nor revokes it globally. This narrow exception applies only if the role owns no database, schema, or application table; has no admin or mutation-role membership, database/schema `CREATE`, permanent-table mutation privilege, unnecessary application-table privilege, or sequence privilege; and has exact `SELECT` on `public."_prisma_migrations"`. Observer queries must remain internally predefined and schema-qualified where needed, accept no caller-provided arbitrary SQL, expose no raw connection/query capability to callbacks, and use the same PostgreSQL connection and transaction after server-enforced `READ ONLY` is verified and before target identity and migration-history observation. The observer must not create, access, or depend on temporary objects. After future provisioning, effective privileges—including inherited and `PUBLIC` privileges—must be checked; the dedicated credential may be exposed only to the future Phase B observation job and grants no Phase C, Phase D, migration, reset, or cleanup authority. This is not blanket acceptance of wider privileges. Context A now names exactly `public."_prisma_migrations"`; offline static/mocked evidence does not verify live role permissions, marker provisioning, or connected database state. Phase B live and Phase C/D remain blocked, and DG-1 remains not passed.

**Phase B database-marker reader fix evidence:** PostgreSQL database comments belong to the shared-object catalog, so the observer now reads the current database OID's marker with `shobj_description(..., 'pg_database')` instead of `obj_description(..., 'pg_database')`. The OID still comes from `pg_database` for `current_database()`, full marker equality remains required through the existing connected-target validation, and Context A remains fixed to `public."_prisma_migrations"`. Offline static/mock tests cover the shared-comment function, current-database OID derivation, exact valid marker acceptance, and fail-closed NULL, mismatched, and extra-suffix markers while preserving read-only ordering and capability isolation. HUMAN reports that separately authorized Operation A observed a non-NULL comment beginning with the approved marker through `shobj_description`; its complete byte-for-byte equality has not been independently verified and this is not Phase B connected-target evidence. Operation B role/credential provisioning remains unperformed and unauthorized. Phase B live and Phase C/D remain blocked, and DG-1 remains not passed.

**Offline connection-factory and dormant-wiring evidence:** Observation authorization now selects only `DAILY_GOAL_OBSERVER_DATABASE_URL` and rejects reuse of the existing `CI_TEST_DATABASE_URL`. A driver-neutral, dependency-injected session adapter requires one dedicated session, begins a server-side read-only transaction, verifies `SHOW transaction_read_only` returns `on`, permits only the predefined target query followed by the exact schema-qualified Context A history query, and then rolls back and closes with redacted failures. It exposes neither arbitrary SQL nor a raw session downstream and rejects missing configuration, wrong mode/order, repeated/stale use, read-write state, and driver errors. Because the approved no-new-dependency stack has no separate session-pinned PostgreSQL driver, the concrete driver binding remains a later offline review item rather than using unsafe independent Prisma calls. The dormant Phase B job names only the dedicated observer secret and remains unreachable through its literal `false`; Phase D remains unchanged and dormant. HUMAN has accepted Operation A exact marker evidence and the Operation B `NOLOGIN` privilege-role foundation, but no credential exists and no connected run occurred. Phase B live and Phase C/D remain blocked, and DG-1 remains not passed.

**Prisma scoped read-only binding evidence:** The concrete offline binding reuses installed Prisma Client 6.19.3 with a new client per invocation and a deferred generated-client import. One bounded interactive transaction executes the fixed internal `SET TRANSACTION READ ONLY` literal first, verifies `SHOW transaction_read_only` on the same transaction client, and then composes the existing observer so identity/marker and schema-qualified Context A history reads remain on that client. No Prisma client, transaction client, SQL executor, or caller-provided SQL reaches the callback. A private per-invocation sentinel deliberately rejects the interactive transaction after a successful immutable snapshot so Prisma rolls it back; only exact sentinel identity with a completed result is accepted, while rollback replacement errors and all unexpected failures remain redacted failures. Prisma disconnect runs in `finally`. The dormant composition authorizes only `DAILY_GOAL_OBSERVER_DATABASE_URL`; no credential has been provisioned, no workflow was enabled, and no live connection was attempted. Phase B live and Phase C/D remain blocked, and DG-1 remains not passed.

**Phase B offline execution-path evidence:** Added a CLI composition that requires the HUMAN-approved non-secret identity contract and delegates to the existing authorization guard and Prisma read-only binding. It rejects missing mandatory identity fields or any non-exact ownership marker, never infers the backend endpoint from the pooler hostname, and emits only an allowlisted summary without URLs, usernames, raw driver errors, migration logs, or executable capabilities. The dormant workflow contains the future checkout, Node/npm, configuration-validation, and CLI steps using only the dedicated observer secret; its literal `false` remains unchanged and Phase D remains disabled. Offline deterministic tests cover complete/missing identity configuration, marker equality, connected diagnostic evidence, credential/error redaction, CLI invocation, guard variables, dedicated-secret isolation, and dormant routing. The endpoint matching portion of this historical evidence is superseded by Amendment A1 below. No database, secret, GitHub Action, Prisma command, migration, commit, or push was used; Phase B live and Phase C/D remain blocked, and DG-1 remains not passed.

#### TASK-256 Endpoint Contract Amendment A1 — HUMAN APPROVED

Supabase Session Pooler does not guarantee that independent sessions observe the same PostgreSQL backend endpoint. Phase B therefore keeps `targetIdentity`, `databaseName`, `schemaName`, and `ownershipMarker` as mandatory exact-match identity fields, while `serverEndpoint` and `serverPort` are mandatory diagnostic evidence rather than stable cross-session identity invariants. The diagnostics must still be collected from the connected backend on the same server-verified read-only transaction as identity and `public."_prisma_migrations"`, must contain a valid IPv4/IPv6 address and an integer port from 1 through 65535, and must remain present in the immutable observation and sanitized allowlisted CLI evidence. Missing or malformed diagnostics fail closed; valid backend changes alone do not create an identity mismatch, and endpoint/port are never inferred from the Session Pooler URL.

Phase B authorization additionally requires the exact approved Session Pooler principal `elvocab_daily_goal_observer.fmosmonrivuoacjfbmov`, preserves separation from XP/Streak write credentials, and continues rejecting runtime/legacy database URL injection or fallback. The obsolete `daily_goal_approved_server_endpoint` dispatch input and expected backend endpoint/port configuration are removed. Exact ownership-marker verification, repository/HUMAN identity agreement, Trust Gate, shared CI concurrency, Context A/Context B separation, rollback/disconnect failure handling, redaction, migration quarantine, and the literal `false` gates for Phase B and Phase D remain unchanged. HUMAN acceptance of A1 authorizes no live observation, migration, Phase C/D work, Gate DG-1 passage, or TASK-258+ execution.

### TASK-257 — Implement pure Daily Goal time domain

**Status:** `HUMAN ACCEPTED — OFFLINE SCOPE`\
**Objective:** Encode deterministic accounting rules independently of Prisma/HTTP.\
**Dependencies:** TASK-254 design accepted; may precede TASK-256 execution.\
**Files / modules:** create `backend/src/services/daily-goal-domain.js` and focused unit tests; extend shared Vietnam date helpers in `streak-domain.js` without changing Streak.\
**In scope:** UTC millisecond half-open intervals, Vietnam-midnight conservation, 120-second deadline, 20/45/25 defaults, full over-limit rejection, cursor burning, lease expiry, fence transitions, projections and allowlists.\
**Out of scope:** database writes, routes, or client-duration trust.\
**SPEC / PLAN:** BR-DG-012–049; AC-DG-007–021, 044, 049; PLAN §§5.2–5.3, 6.4, 7.2.\
**Acceptance / evidence:** fake-clock tests cover normal 20s, live 30s rejection, expired lease, stale/replay, idle ordering, exact midnight/subsecond conservation.

**Implementation evidence:** Added a database-independent Daily Goal domain module and focused Node tests for the approved timing defaults, exact 25-second acceptance boundary, full over-limit/expired-lease rejection, cursor burning, idle ordering, generation helpers, BigInt millisecond projections, activity/event allowlists, and lossless half-open Vietnam-midnight splitting. Verification is offline only; TASK-256 Phase B/C/D remains blocked and Gate DG-1 is not passed.

### TASK-258 — Implement transaction-scoped persistence and cleanup primitives

**Status:** `TODO`\
**Objective:** Provide repository operations under one USER advisory transaction lock.\
**Dependencies:** TASK-256 Gate DG-1, TASK-257.\
**Files / modules:** create `backend/src/repositories/daily-goal-repository.js`; reuse transaction patterns from Quiz/Learning repositories.\
**In scope:** owner/session/day/receipt/reward/preference/monitor/notification CRUD, generation fencing, atomic upserts, exact fingerprint replay, 30-day receipts, 31-day parents, child-first bounded cleanup and cleanup advisory lock.\
**Out of scope:** business orchestration or scheduler.\
**SPEC / PLAN:** BR-DG-036–049, 052–053, 060–078; AC-DG-016–024, 029–039, 048; PLAN §§6.2–6.5, 7.5.\
**Acceptance / evidence:** repository tests prove owner serialization, uniqueness, `RESTRICT` cleanup order, durable reward/notification evidence, and cross-user filtering.

### TASK-259 — Implement tracking service and USER-only APIs

**Status:** `TODO`\
**Objective:** Expose the approved tracking state machine through existing backend layers.\
**Dependencies:** TASK-257–258.\
**Files / modules:** create daily-goal service/controller/routes; extend `backend/src/create-app.js`; reuse auth/role and learning-access services.\
**In scope:** establish, READY, meaningful events, distinct RESUME, heartbeat, pause, close, context authorization, safe conflict DTOs, exact field validation and rate-bound behavior. No tail credit on pause/close/handoff.\
**Out of scope:** reward, reminders, frontend, or learning-result mutations.\
**SPEC / PLAN:** BR-DG-012–046; AC-DG-004, 007–020, 040–041; PLAN §§7.1–7.2, 8.2, 10.\
**Acceptance / evidence:** unit/API tests prove `401/403/404`, activity allowlists, stale fence zero credit, explicit resume, inaccessible context safety, and no accepted client time/date.

### TASK-260 — Prove tracking concurrency and stop at Gate DG-2

**Status:** `BLOCKED — REQUIRES APPROVED ISOLATED DATABASE`\
**Objective:** Demonstrate non-overlap and retry correctness under races/failures.\
**Dependencies:** TASK-259 and Gate DG-1.\
**Files / modules:** guarded integration/concurrency suites and evidence report.\
**In scope:** simultaneous tabs/devices, transfer/reclaim, delayed generations, duplicate/mismatched operations, sleep/offline, midnight, transaction rollback.\
**Out of scope:** Preview TEST or capacity claims.\
**SPEC / PLAN:** AC-DG-016–021, 024, 040–041, 048–049; PLAN §§12.1–12.2.\
**Acceptance / evidence:** no overlap/fabrication and deterministic idempotency are demonstrated or marked `NOT RUN`; HUMAN accepts DG-2.

### TASK-261 — Implement goal settings, progress, reward, and XP projection

**Status:** `TODO`\
**Objective:** Add read/update and atomic first-completion behavior.\
**Dependencies:** TASK-258–260.\
**Files / modules:** daily-goal service/repository/controller/routes; reuse `xp-level-service.js`; additive reward ledger only.\
**In scope:** unset/pre-goal accumulation, 10–240 validation, uncapped milliseconds, current completion versus reward-earned, atomic one/day reward + `USER.total_xp` + completion notification, idempotent edits.\
**Out of scope:** `XP_REWARD` generalization, Streak mutation, persisted Level, XP history.\
**SPEC / PLAN:** BR-DG-001–011, 047–059, 062–063; AC-DG-001–006, 021–028, 045–049, 054–055; PLAN §§7.3, 8.1.\
**Acceptance / evidence:** failure-injection and race tests prove exactly `+10 XP`, atomic rollback, initial setup above/below target, goal increase/decrease behavior, unchanged SRS/Quiz/Streak.

### TASK-262 — Verify reward compatibility and atomicity

**Status:** `BLOCKED — REQUIRES APPROVED ISOLATED DATABASE`\
**Objective:** Close XP-sensitive backend evidence before frontend reliance.\
**Dependencies:** TASK-261.\
**Files / modules:** guarded API/integration regression suites.\
**In scope:** concurrent setup/heartbeat/edit reward races, completion notification uniqueness, Level projection, SRS/Quiz reward and Streak regressions.\
**Out of scope:** UI or deployment.\
**SPEC / PLAN:** AC-DG-023–028, 031, 046–048, 054; PLAN §§12.2, 14 Phase 3.\
**Acceptance / evidence:** atomicity/compatibility results are accepted; unsafe prerequisites yield `NOT RUN`.

### TASK-263 — Implement notification, preference, and monitor backend

**Status:** `TODO`\
**Objective:** Deliver persisted owner-scoped notifications and server-observed reminder eligibility.\
**Dependencies:** TASK-261.\
**Files / modules:** daily-goal service/repository/controller/routes plus `/api/notifications` mounting.\
**In scope:** default-ON nullable preference/re-enable instant; monitor establish/check/close; continuity reset; origin=max(day start, continuity, re-enable, latest engagement); one reminder/day; list/cursor/unread/read APIs; completion independence.\
**Out of scope:** external scheduler/push/email, retroactive reminders, mark-all-read.\
**SPEC / PLAN:** BR-DG-060–078; AC-DG-029–039, 050–055; PLAN §§7.4, 8.3–8.5.\
**Acceptance / evidence:** API tests cover auth isolation, default/OFF/ON, no goal, active eligible owner, idle-modal timing, close/sleep gaps, concurrency, pagination and idempotent read.

### TASK-264 — Implement and verify bounded operational cleanup

**Status:** `TODO`\
**Objective:** Retain replay correctness while bounding ephemeral growth.\
**Dependencies:** TASK-258, TASK-263.\
**Files / modules:** repository cleanup helpers, opportunistic trigger, maintenance documentation/tests.\
**In scope:** max-100 child-first batches, 30/31-day horizons, parent-reference protection, expired-owner fencing, non-fatal logging, manual guarded fallback.\
**Out of scope:** cron, queue, external scheduler, durable aggregate/reward/notification deletion.\
**SPEC / PLAN:** BR-DG-044–046, 052, 068; PLAN §§5.2, 7.5, 11.\
**Acceptance / evidence:** retained receipt replays; cleaned parent is safe-not-found; durable uniqueness remains; cleanup races are serialized.

### TASK-265 — Verify notification/reminder backend and stop at Gate DG-3

**Status:** `BLOCKED — REQUIRES APPROVED ISOLATED DATABASE`\
**Objective:** Prove reminder/reward security and concurrency before UI work consumes it.\
**Dependencies:** TASK-262–264.\
**Files / modules:** guarded integration/failure-injection evidence.\
**In scope:** multi-device checks, preference races, midnight, monitor long gaps, transaction failures, cross-user reads, cleanup horizons.\
**Out of scope:** browser visuals or deployment.\
**SPEC / PLAN:** AC-DG-029–039, 050–055; PLAN §§12.2, 14 Phase 4.\
**Acceptance / evidence:** HUMAN accepts DG-3 or unavailable checks remain explicitly `NOT RUN`.

### TASK-266 — Implement frontend Daily Goal API service and shared tracker

**Status:** `TODO`\
**Objective:** Build the reusable client protocol without changing activity algorithms.\
**Dependencies:** TASK-259 API contract and DG-2; notification methods may follow TASK-263.\
**Files / modules:** create `frontend/src/services/daily-goal-service.js`, `daily-goal-tracker.jsx`, `daily-goal-activity-adapter.js`.\
**In scope:** DTO validation, stable operation IDs, local monotonic idle clock, heartbeat/generation state, visibility/focus/drift, non-owner/retry state, teardown, no offline synthesis.\
**Out of scope:** activity-specific scoring/navigation or browser-storage authority.\
**SPEC / PLAN:** BR-DG-012–046; AC-DG-007–020, 040–041; PLAN §§9.1–9.2.\
**Acceptance / evidence:** fake-timer/component tests cover approved/generic interactions, focus/hidden, drift, conflicts, retry IDs, logout/unmount and zero backfill.

### TASK-267 — Implement shared Idle Pause Modal and owner status

**Status:** `TODO`\
**Objective:** Provide accessible explicit resume without resetting learning state.\
**Dependencies:** TASK-266.\
**Files / modules:** create `idle-pause-dialog.jsx`; tracker/status presentation styles/tests.\
**In scope:** approved Vietnamese copy, focus containment/restoration, inert background, Escape remains paused, RESUME command, non-color non-owner status.\
**Out of scope:** recreating runs or disabling learning controls.\
**SPEC / PLAN:** BR-DG-023–030, 039–042; AC-DG-010–013, 017–018, 042; PLAN §§9.2, 9.5.\
**Acceptance / evidence:** keyboard/focus/reduced-motion tests and preserved child activity state.

### TASK-268 — Verify shared frontend foundation and stop at Gate DG-4

**Status:** `TODO`\
**Objective:** Review tracker/modal correctness before attaching activities.\
**Dependencies:** TASK-266–267.\
**Files / modules:** focused frontend unit/component suites and review evidence.\
**In scope:** all lifecycle boundaries, server conflict handling, failure isolation and accessibility semantics.\
**Out of scope:** full activity E2E.\
**SPEC / PLAN:** AC-DG-008–013, 016–020, 040–042; PLAN §12.3.\
**Acceptance / evidence:** focused tests/build/lint pass when authorized and HUMAN accepts DG-4.

### TASK-269 — Integrate Normal Flashcard tracking

**Status:** `TODO`\
**Objective:** Attach the shared tracker to ready unfinished Normal runs.\
**Dependencies:** DG-4.\
**Files / modules:** `learning-foundation-page.jsx`, `normal-learning-session.js`, related focused tests.\
**In scope:** READY, reveal, deliberate navigation and requested pronunciation; stop on complete/error/exit.\
**Out of scope:** changing cursor/evidence/completion/XP/Streak.\
**SPEC / PLAN:** BR-DG-012–018, 023–030; AC-DG-007–013, 040; PLAN §9.3.\
**Acceptance / evidence:** Normal regressions pass and tracking failures leave run state unchanged.

### TASK-270 — Integrate SRS tracking

**Status:** `TODO`\
**Objective:** Attach tracking without changing scheduling or rewards.\
**Dependencies:** TASK-269.\
**Files / modules:** `srs-learning-session.js`, Learning page integration, focused tests.\
**In scope:** reveal, requested pronunciation and eligible rating command; retry/response is not meaningful.\
**Out of scope:** scheduler, revision, receipt, XP or Streak changes.\
**SPEC / PLAN:** BR-DG-012–017, 019, 057–059; AC-DG-007–013, 027–028, 040; PLAN §9.3.\
**Acceptance / evidence:** SRS atomic/retry/scheduling/XP/Streak regressions pass with tracker failures injected.

### TASK-271 — Integrate Multiple-choice Quiz tracking

**Status:** `TODO`\
**Objective:** Attach tracking without changing authoritative grading.\
**Dependencies:** TASK-270.\
**Files / modules:** `quiz-foundation-page.jsx`, `quiz-run-state.js`, focused tests.\
**In scope:** choice selection, submit and deliberate unfinished advance; stop after completion/error/exit.\
**Out of scope:** answer disclosure, grading, replay/XP/Streak changes or new Quiz types.\
**SPEC / PLAN:** BR-DG-012–017, 020, 057–059; AC-DG-007–013, 027–028, 040; PLAN §9.3.\
**Acceptance / evidence:** Quiz grading/restart/reward regressions pass and response/retry alone never resets idle.

### TASK-272 — Integrate Speaking Practice tracking

**Status:** `TODO`\
**Objective:** Attach tracking within existing transient recognition/privacy boundaries.\
**Dependencies:** TASK-271.\
**Files / modules:** Speaking page/session, recognition controller, playback coordinator, focused tests.\
**In scope:** exact Set/Vocabulary identity; sample request, recognition start/stop request and target navigation; existing watchdog phases; reviewed 15–60s/30s playback safeguard.\
**Out of scope:** audio/transcript/confidence upload, scoring, backend speech processing, XP/Streak.\
**SPEC / PLAN:** BR-DG-021, 031–035; AC-DG-014–015, 040, 044; PLAN §9.3.\
**Acceptance / evidence:** privacy/lifecycle/watchdog tests pass; late native events are not meaningful; tracking failure cannot affect outcomes.

### TASK-273 — Verify all activity adapters and stop at Gate DG-5

**Status:** `TODO`\
**Objective:** Provide independent and combined regression evidence for four activities.\
**Dependencies:** TASK-269–272.\
**Files / modules:** adapter unit tests, focused mocked Playwright flows, regression report.\
**In scope:** ready/unfinished, idle/focus/exit/completion, ownership conflict and failure isolation per adapter.\
**Out of scope:** visual approval or real database access without DG-1.\
**SPEC / PLAN:** AC-DG-007–020, 027–028, 040–044; PLAN §§12.3–12.4.\
**Acceptance / evidence:** each adapter has separately attributable evidence; HUMAN accepts DG-5.

### TASK-274 — Implement Dashboard card, shell monitor, and Notification Center

**Status:** `TODO`\
**Objective:** Deliver the approved USER surfaces without redesigning Dashboard.\
**Dependencies:** DG-3, DG-5.\
**Files / modules:** create Daily Goal card/monitor and Notification Center modules; extend `dashboard-page.jsx` and `authenticated-shell.jsx`; reuse `http-client` and transient toast utilities.\
**In scope:** unset/configured/edit/over-target states, presets/custom 10–240, earned distinction, pending preference toggle, USER-only monitor, Bell/unread/paginated list/explicit read, loading/error/empty/retry states.\
**Out of scope:** ADMIN surfaces, mark-all-read, full settings, Dashboard redesign, notification-triggered idle reset.\
**SPEC / PLAN:** BR-DG-001–011, 060–078; AC-DG-001–006, 022–039, 042, 050–055; PLAN §§9.4, 9.6.\
**Acceptance / evidence:** component tests verify independent Dashboard source, atomic reward toast once, persistence/error states, shell focus-learning monitor continuity and owner-scoped UI.

### TASK-275 — Complete accessibility/responsive review and stop at Gate DG-6

**Status:** `BLOCKED — AWAITING UI IMPLEMENTATION AND HUMAN VISUAL REVIEW`\
**Objective:** Validate all new visual flows before acceptance.\
**Dependencies:** TASK-274.\
**Files / modules:** component/Playwright evidence; Focused `ui-ux-review` report.\
**In scope:** keyboard/focus, accessible names/count/status, non-color meaning, reduced motion, zoom/reflow, desktop/mobile card/modal/status/Bell/panel, no layout overflow.\
**Out of scope:** Full UI/UX Review unless HUMAN requests it.\
**SPEC / PLAN:** AC-DG-011, 017, 029–030, 042; PLAN §§9, 12.4–12.5.\
**Acceptance / evidence:** Focused review has no unresolved blocker and HUMAN grants desktop/mobile visual approval.

### TASK-276 — Run guarded integrated regression, cleanup, and performance validation

**Status:** `BLOCKED — REQUIRES APPROVED INFRASTRUCTURE`\
**Objective:** Validate the complete feature under realistic concurrency without making unsupported capacity claims.\
**Dependencies:** DG-1 through DG-6.\
**Files / modules:** guarded backend/E2E/load suites and evidence report.\
**In scope:** all 55 AC; tab/device races; midnight; retries; injected rollback; cleanup; XP/Level/Streak/four-activity regressions; one-hot-USER and many-USER probes; record Vercel/Supabase region, pool, limits, latency, lock wait, receipt size/invocations.\
**Out of scope:** Preview/Production destructive tests, SLA claims, tuning defaults without PLAN review, or deployment.\
**SPEC / PLAN:** all BR/AC; PLAN §§11–13, 14 Phase 8.\
**Acceptance / evidence:** formal evidence is PASS/FAIL/NOT RUN with infrastructure facts and unresolved risks; no skipped check is reported as pass.

### TASK-277 — Reconcile documentation, formal TEST/REVIEW, and deployment-readiness handoff

**Status:** `BLOCKED — REQUIRES VERIFIED IMPLEMENTATION AND SEPARATE APPROVALS`\
**Objective:** Close the workflow without prematurely marking the feature DONE or deploying it.\
**Dependencies:** TASK-276 accepted.\
**Files / modules:** `PROJECT_OVERVIEW.md`, `ARCHITECTURE.md`, `DATABASE.md`, `API_SPEC.md`, `UI_UX_SPEC.md`, `FEATURE_STATUS.md`; formal TEST/REVIEW reports.\
**In scope:** synchronize verified contracts, perform Legacy/Regression Impact Scans, trace BR/AC evidence, formal TEST then REVIEW, request HUMAN closure; update status only after approval.\
**Out of scope:** commit/push/deploy or Production/Preview migration without separate authorization.\
**SPEC / PLAN:** SPEC §§15, 19; all BR/AC; PLAN §§15, 17–18.\
**Acceptance / evidence:** docs match verified implementation; TEST and REVIEW verdicts are explicit; HUMAN decides closure; deployment readiness remains a distinct gate.

## 6. Traceability matrix

| Requirement group | Business rules | Acceptance criteria | Primary tasks |
|---|---|---|---|
| Goal/setup/progress/legacy isolation | BR-DG-001–011 | AC-DG-001–006, 022, 045–049 | 254, 257, 261–262, 274, 276 |
| Activities, idle, Speaking | BR-DG-012–035 | AC-DG-007–015, 040, 044 | 257, 259, 266–273, 276 |
| Ownership, fencing, day split | BR-DG-036–049 | AC-DG-016–021 | 254, 257–260, 266–273, 276 |
| Reward, XP, Level, Streak | BR-DG-050–059 | AC-DG-023–028, 046–048 | 254, 261–262, 276–277 |
| Notifications/reminders/preferences | BR-DG-060–078 | AC-DG-029–039, 050–055 | 254, 263–265, 274–276 |
| Failure/accessibility/no external delivery/privacy | BR-DG-017, 035, 044–046, 057–060, 072 | AC-DG-040–044, 049 | 255–260, 264–277 |

Every BR-DG-001–078 and AC-DG-001–055 appears in at least one row and is implemented or verified by the listed tasks. The matrix groups approved identifiers; it does not add acceptance criteria.

## 7. Execution and HUMAN gates

1. **Task approval:** HUMAN approved this document, accepted TASK-254/TASK-255 for offline scope, and authorized only the separate migration-quarantine safety amendment. Every numbered task from TASK-256 onward requires separate authorization.
2. **DG-1 Database:** schema/SQL review plus explicit CI-exclusive database identity before migration execution.
3. **DG-2 Backend accounting:** fake-clock and guarded concurrency evidence before frontend reliance.
4. **DG-3 Reward/reminder:** atomicity, authorization and dedupe evidence before Notification UI reliance.
5. **DG-4 Shared tracker:** focused lifecycle/accessibility review before activity attachment.
6. **DG-5 Activities:** independent Normal/SRS/Quiz/Speaking regression acceptance.
7. **DG-6 UI:** Focused UI/UX Review and HUMAN desktop/mobile visual approval.
8. **DG-7 Closure:** guarded full regression/performance facts, formal TEST, formal REVIEW and HUMAN acceptance.
9. **Deployment:** separate authorization; no prior gate authorizes commit, push, Preview/Production migration, or deployment.

## 8. Remaining unknowns and stop condition

Vercel runtime/region/invocation budget, Supabase plan/region/pool/timeouts/storage, CI-exclusive database readiness, real concurrency/session duration, and an approved maintenance mechanism remain UNKNOWN. They block database/load evidence or deployment claims where applicable, not this decomposition. Any implementation discovery that requires changing a PLAN default, architecture, database/API contract, or business rule returns to PLAN/SPEC review.

**STOP: HUMAN TASK-256 OFFLINE CI INTEGRATION REVIEW. DG-1 is NOT PASSED. Do not begin live Phase B/C/D, activate or execute a real migration, access a database, run database-dependent tests, begin TASK-258+, commit, push, or deploy.**
