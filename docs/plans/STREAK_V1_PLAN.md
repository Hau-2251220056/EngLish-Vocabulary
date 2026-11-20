# PLAN: Streak V1

**PLAN status:** `HUMAN APPROVED`

**Approved input:** `docs/specs/STREAK_V1_SPEC.md` (HUMAN approved; 46 business rules and 36 acceptance criteria)

**Planning baseline:** `origin/dev` at `e3f5dd18193fbfee23c1ea5cdc2aa3fdee150e59`

**TASK drafting authorized:** `YES — FOR HUMAN REVIEW ONLY`

**Implementation / migration creation or execution authorized:** `NO`

## 1. Summary

Streak V1 will add a small, Backend-authoritative session layer around the existing NORMAL, SRS and Multiple Choice Quiz flows. Each qualifying group receives an immutable server-owned snapshot of at most 10 Vocabulary identities. Per-item evidence is persisted, session completion is terminal, and the first completed session for a USER on an `Asia/Ho_Chi_Minh` calendar day inserts one durable Streak Day. A narrow SRS operation receipt is auxiliary idempotency metadata owned by the Session Item data group; it is not qualification evidence, activity analytics or a fourth conceptual business-data group.

The implementation will extend, rather than replace, the current learning and Quiz services. Existing SRS scheduling, optimistic revisions, Quiz grading, Progress mutations and XP reward transactions remain authoritative. Session-aware mutations add evidence and, on the terminal event, session completion plus the daily ledger insert to the same PostgreSQL transaction. Existing sessionless SRS and Quiz requests remain supported and retain their current Progress/XP behavior, but never qualify for Streak.

Current Streak is a read projection over durable day rows. It is not persisted on `USER`; `longest_streak` remains deferred. NORMAL reveal acknowledgement is interaction evidence only and introduces no surveillance, duration requirement, Progress mutation or XP.

## 2. Scope, status and current baseline

### 2.1 Approved requirements versus proposed PLAN decisions

- **Approved SPEC requirements:** all behavior identified by `BR-ST-001` through `BR-ST-046` and `AC-ST-01` through `AC-ST-36`, including the three qualifying modes, seven-day lifetime, UTC+7 calendar assignment, three conceptual persistence groups, legacy sessionless compatibility and minimal Dashboard card.
- **Proposed PLAN decisions requiring HUMAN approval:** the exact Prisma fields/enums/constraints, endpoint names and payloads, reuse of the existing event identity for SRS/Quiz evidence, response embedding, deletion policy, indefinite V1 ledger retention and deferred cleanup mechanism described below.
- **Not authorized by this document:** TASK creation, code/schema/migration changes, database access, test/CI execution, deployment or status promotion.

### 2.2 Feature status

`docs/FEATURE_STATUS.md` currently records Streak and Streak Summary as `TODO`. XP & Level V1 is `DONE`; Flashcard/SRS are closed workstreams, while the current Quiz implementation is present and must be treated as an existing dependency. This PLAN does not change feature status.

### 2.3 Existing implementation to reuse

- `backend/prisma/schema.prisma` — current `USER`, `VOCABULARY_SET`, `VOCABULARY_SET_ITEM`, `LEARNING_PROGRESS` and `XP_REWARD` relations and naming conventions.
- `backend/src/services/learning-service.js` and `backend/src/repositories/learning-repository.js` — Set authorization, authoritative SRS eligibility/order, optimistic revision, replay handling, row locks and atomic Progress/XP mutation.
- `backend/src/services/quiz-service.js`, `quiz-domain.js` and `backend/src/repositories/quiz-repository.js` — authoritative question reconstruction, four-choice validation, grading, Progress/XP and transaction boundary.
- `backend/src/routes/learning-routes.js`, `quiz-routes.js`, their controllers and `backend/src/create-app.js` — authenticated `USER` middleware, controller conventions and dependency wiring.
- `frontend/src/learning/learning-run-state.js` and `learning-foundation-page.jsx` — current ordered groups, SRS `AGAIN` requeue, explicit NORMAL finish and retry UX.
- `frontend/src/quiz/quiz-run-state.js`, `quiz-foundation-page.jsx` and the learning/Quiz API services — transient run state, answer retry, result view and response validation.
- `frontend/src/session-storage/ordered-session-run.js` — bounded groups of at most 10 distinct identities.
- `frontend/src/dashboard/dashboard-page.jsx` and its existing independent-source loading pattern — location for one compact Streak card without changing the Level/XP card.
- Existing learning, Quiz and XP unit/integration/browser suites — regression foundation to extend, not replace.

### 2.4 Affected areas

- **Database:** the three approved business models and three enums, plus one narrow child receipt model for accepted session-bound SRS operation identity; additive constraints/indexes; no backfill and no `USER.current_streak`.
- **Backend:** new session/Streak repository and service boundary; new session routes; optional session association in existing SRS/Quiz mutations; Streak read endpoint.
- **API:** additive session contracts and optional fields on existing SRS/Quiz requests/responses. Sessionless contracts stay valid.
- **Frontend:** bind existing NORMAL/SRS/Quiz run state to Backend session identity; reconcile on resume; display expiry/restart; add compact Dashboard Streak card.
- **Tests:** deterministic clock unit coverage, isolated PostgreSQL HTTP integration, focused browser E2E and existing XP/SRS/Quiz regression.
- **Documentation after verified implementation:** `DATABASE.md`, `API_SPEC.md`, `UI_UX_SPEC.md`, `PROJECT_OVERVIEW.md`, and only after TEST/REVIEW/HUMAN approval, `FEATURE_STATUS.md`; `ARCHITECTURE.md` only if the final implementation establishes a new documented boundary.

## 3. Technical architecture

### 3.1 Component flow

```text
Authenticated USER client
  -> create/read Backend learning session
  -> Backend authorizes Set and creates immutable <= 10-item snapshot
  -> client stores session UUID plus presentation cursor only
  -> mode mutation with session UUID + event/operation UUID
  -> existing Learning/Quiz business validation
  -> one PostgreSQL transaction:
       existing Progress/SRS/XP mutation (SRS/Quiz only)
       + session-item evidence
       + terminal session completion when eligible
       + INSERT Streak Day ON CONFLICT (USER, application_date) DO NOTHING
  -> response returns original learning result and session projection
  -> terminal response also returns current Streak projection
```

NORMAL differs only in that reveal acknowledgement mutates session evidence, and a later explicit completion transaction completes the session and inserts the Streak Day. It never touches Progress or XP.

### 3.2 Responsibility boundaries

- Route and validation middleware accept only documented fields and retain the existing authentication plus `USER` authorization boundary.
- Controllers translate request/response only.
- A new `learning-session-service` owns creation, authorization, expiry, snapshot lifecycle, NORMAL operations and session reconciliation.
- Existing `learning-service` and `quiz-service` continue to own SRS and Quiz business logic. They call session validation/evidence operations inside their existing transaction only when `session_id` is present.
- A `streak-service` owns UTC+7 date conversion and read projection. It never accepts a client date/timezone and performs no reset mutation.
- Repositories own row locks, unique-conflict handling and database reads/writes. No Frontend state can award a Streak day.

## 4. Proposed Prisma and PostgreSQL design

The names below follow the repository's uppercase model/table convention. They are PLAN proposals, not schema changes in this stage.

### 4.1 Enums

```text
LEARNING_SESSION_MODE
  NORMAL
  SRS
  QUIZ

LEARNING_SESSION_STATUS
  ACTIVE
  COMPLETED

SESSION_ITEM_EVIDENCE
  NORMAL_REVEALED
  SRS_HARD
  SRS_GOOD
  SRS_EASY
  QUIZ_CORRECT
  QUIZ_INCORRECT
```

`EXPIRED` is an effective state, not a stored state: an incomplete `ACTIVE` row is expired exactly when Backend transaction time is greater than or equal to `expires_at`. This avoids a write/cron merely to make time passage visible.

### 4.2 `LEARNING_SESSION`

| Field | Prisma / PostgreSQL type | Purpose |
|---|---|---|
| `id` | `String @id @default(uuid()) @db.Uuid` | Immutable server session/run identity. |
| `user_id` | `String @db.Uuid` | Owner; derived from authentication. |
| `vocabulary_set_id` | `String? @db.Uuid` | Current Set relation; nullable only after Set deletion. |
| `set_id_snapshot` | `String @db.Uuid` | Immutable Set identity retained for evidence and replay. |
| `mode` | `LEARNING_SESSION_MODE` | Exact qualifying mode. |
| `status` | `LEARNING_SESSION_STATUS @default(ACTIVE)` | Persisted terminal lifecycle. |
| `create_operation_id` | `String @db.Uuid` | Idempotent creation identity supplied by the client. |
| `snapshot_size` | `Int` | Immutable denominator, 1–10. |
| `created_at` | `DateTime @default(dbgenerated("(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')")) @db.Timestamp(3)` | Backend creation instant stored by the Streak persistence boundary as UTC without depending on the PostgreSQL session timezone. |
| `expires_at` | `DateTime @db.Timestamp(3)` | Exactly `created_at + interval '7 days'`. |
| `completed_at` | `DateTime? @db.Timestamp(3)` | Immutable Backend completion instant. |
| `completion_event_id` | `String? @db.Uuid` | Terminal operation/event identity for exact replay. |

Relations and indexes:

- `USER 1—N LEARNING_SESSION`, FK `user_id -> USER.id ON DELETE RESTRICT ON UPDATE CASCADE`.
- Optional current Set relation `vocabulary_set_id -> VOCABULARY_SET.id ON DELETE SET NULL ON UPDATE CASCADE`. `set_id_snapshot` is not a second FK; it preserves the authorized identity after deletion.
- Unique `(user_id, create_operation_id)` for idempotent creation.
- Unique nullable `(user_id, completion_event_id)` for terminal replay identity.
- Index `(user_id, status, expires_at)` for owner resume/list checks.
- Index `(vocabulary_set_id)` for deletion/access impact.
- Checks: `snapshot_size BETWEEN 1 AND 10`; `expires_at = created_at + INTERVAL '7 days'`; `ACTIVE` requires `completed_at` and `completion_event_id` null; `COMPLETED` requires both non-null and `created_at <= completed_at < expires_at`.

No mutable `updated_at` is proposed because the immutable lifecycle is fully represented by evidence rows and `completed_at`.

### 4.3 `LEARNING_SESSION_ITEM`

| Field | Prisma / PostgreSQL type | Purpose |
|---|---|---|
| `id` | `String @id @default(uuid()) @db.Uuid` | Row identity. |
| `session_id` | `String @db.Uuid` | Parent snapshot. |
| `vocabulary_id` | `String @db.Uuid` | Immutable snapshot identity, deliberately not a mutable Vocabulary FK. |
| `position` | `Int` | Immutable zero-based Set/group order. |
| `evidence` | `SESSION_ITEM_EVIDENCE?` | Null means unresolved/unacknowledged/unanswered. |
| `evidence_event_id` | `String? @db.Uuid` | Accepted terminal item event or NORMAL reveal operation. |
| `evidence_at` | `DateTime? @db.Timestamp(3)` | Backend acceptance instant. |

Relations and constraints:

- FK `session_id -> LEARNING_SESSION.id ON DELETE CASCADE ON UPDATE CASCADE`. Session deletion is allowed only by a future separately approved retention operation; child evidence follows its parent.
- No direct Vocabulary FK. This intentional snapshot scalar prevents later Vocabulary/Set item deletion from silently changing the denominator or making historical sessions block existing deletion flows. Every active mutation still re-authorizes the current Set and Vocabulary membership before acceptance.
- Unique `(session_id, vocabulary_id)` and `(session_id, position)`.
- Unique nullable `evidence_event_id`; UUID identities are globally single-use for durable item evidence. Exact replay must match the same session, item and payload; otherwise return conflict.
- Checks: `position BETWEEN 0 AND 9`; the three evidence columns are either all null or all non-null.
- Service-level mode/evidence compatibility is mandatory because a PostgreSQL check cannot inspect the parent mode without a trigger, and V1 deliberately avoids triggers.

For SRS `AGAIN`, the session item stays unresolved and `LEARNING_PROGRESS.last_event_id` remains authoritative for whether the accepted outcome is still the current replayable Progress event. The auxiliary receipt below durably binds its UUID and exact payload identity without becoming qualification evidence or a general event-history API. Once a later revision is accepted, an older event becomes stale and cannot mutate the item, while its UUID remains reserved. HARD/GOOD/EASY stores both the operation receipt and the resolving item evidence. Quiz and NORMAL each retain their existing durable evidence identity behavior.

### 4.3.1 Auxiliary `LEARNING_SESSION_SRS_RECEIPT`

**HUMAN-approved amendment:** this narrow child record closes the durable identity gap for accepted session-bound SRS events. It belongs to the Session Item conceptual data group and is not qualification evidence, a learning result/history API, analytics or event-sourcing infrastructure.

| Field | Prisma / PostgreSQL type | Purpose |
|---|---|---|
| `event_id` | `String @id @db.Uuid` | Globally single-use SRS operation identity. |
| `session_item_id` | `String @db.Uuid` | Exact authoritative Session Item that received the operation. |
| `rating` | `String @db.VarChar(5)` | Exact accepted `AGAIN`, `HARD`, `GOOD` or `EASY` payload identity. |
| `expected_revision` | `Int` | Exact optimistic revision submitted with the accepted request. |
| `accepted_revision` | `Int` | Resulting authoritative Progress revision; must equal `expected_revision + 1`. |
| `accepted_at` | `DateTime @db.Timestamp(3)` | The same authoritative operation instant used by Progress/evidence/completion. |

Relations and constraints:

- FK `session_item_id -> LEARNING_SESSION_ITEM.id ON DELETE CASCADE ON UPDATE CASCADE`; receipts therefore follow the approved long-term Learning Session/Item lifecycle.
- Primary-key uniqueness on `event_id` prevents reuse across USERs, sessions, items or ratings. The parent item/session supplies authoritative Vocabulary, session, mode and USER identity; those values are not duplicated from the request.
- Index `(session_item_id, accepted_revision)` supports item-scoped reconciliation without exposing a history API.
- Checks require `rating IN ('AGAIN', 'HARD', 'GOOD', 'EASY')`, non-negative revisions and `accepted_revision = expected_revision + 1`.
- No update/delete business path exists. No receipt is created for sessionless SRS.

This model and its constraints are introduced by a new forward-only additive migration after `20261017000000_add_streak_v1`; the accepted migration is not edited or replaced. The focused migration harness must prove clean sequential apply and no receipt backfill before the refreshed Gate ST-1 delta can be accepted.

Every accepted session-bound SRS rating writes one receipt in the existing Progress transaction. An `AGAIN` receipt leaves `LEARNING_SESSION_ITEM.evidence`, `evidence_event_id` and `evidence_at` null, awards no XP merely because the receipt exists, and cannot contribute to completion. `HARD`, `GOOD` and `EASY` additionally write their existing resolving Session Item evidence. Receipt lookup is replay/conflict metadata only.

Exact replay first looks up `event_id` and requires the same authenticated USER, session, item, rating and expected revision. It returns the original learning/reward projection only while `LEARNING_PROGRESS.last_event_id` and its resulting revision still identify that operation as authoritative. After a later accepted revision, the earlier event is stale and cannot mutate state, but its retained receipt still prevents UUID reuse with any payload or session.

### 4.4 `STREAK_DAY`

| Field | Prisma / PostgreSQL type | Purpose |
|---|---|---|
| `id` | `String @id @default(uuid()) @db.Uuid` | Ledger row identity. |
| `user_id` | `String @db.Uuid` | USER owner. |
| `activity_date` | `DateTime @db.Date` | Backend-derived `Asia/Ho_Chi_Minh` date. |
| `first_session_id` | `String? @db.Uuid` | First qualifying session for traceability; nullable if sessions are later purged. |
| `created_at` | `DateTime @default(dbgenerated("(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')")) @db.Timestamp(3)` | Authoritative insertion instant stored by the Streak persistence boundary as UTC without depending on the PostgreSQL session timezone. |

Relations and constraints:

- FK `user_id -> USER.id ON DELETE RESTRICT ON UPDATE CASCADE`.
- FK `first_session_id -> LEARNING_SESSION.id ON DELETE SET NULL ON UPDATE CASCADE`.
- Unique `(user_id, activity_date)` is the concurrency boundary; terminal transactions use `INSERT ... ON CONFLICT DO NOTHING` rather than read-then-write.
- Index `(user_id, activity_date DESC)`; the unique index may satisfy this query after PostgreSQL plan verification, so do not add a duplicate index unless `EXPLAIN` in a later authorized environment proves it useful.

### 4.5 Deletion and retention

- Streak Day is durable product state and is retained for the USER account lifetime. No V1 API edits or deletes it.
- Sessions/items are retained in V1 for replay, audit and recovery. No scheduled cleanup, analytics/event infrastructure or cron is introduced.
- A later retention feature may purge completed/expired sessions only after an approved policy. `STREAK_DAY.first_session_id ON DELETE SET NULL` permits that without losing a qualifying day.
- Set deletion nulls only the current relation; immutable Set/Vocabulary snapshot scalars remain. Active sessions whose Set is deleted, item removed or access revoked become inaccessible and reject further mutation. Their denominator never shrinks.
- USER deletion remains restricted while Streak data exists. This is an explicit dependency, not a silent permanent prohibition: any future authorized account-deletion/anonymization flow must deliberately delete or anonymize the dependent Session/Streak records in an approved transaction before deleting the USER. Streak V1 does not design or implement that separate lifecycle.

## 5. Backend session lifecycle

### 5.1 Creation and immutable snapshot

1. Require an authenticated `USER`; Guest/ADMIN use the existing 401/403 middleware behavior.
2. Validate `mode`, Set UUID and client-generated `operation_id`; never accept owner, timestamps, status, completion date, timezone or Streak value.
3. Reuse current Set authorization: public System Set or USER-owned private Set only.
4. Resolve an authoritative ordered snapshot in one transaction:
   - NORMAL: resolve the requested current UI group against Set Item order; accept only 1–10 distinct current members in the exact server order.
   - SRS: ignore client item selection; compute the current eligible queue using existing Backend eligibility/order and take at most 10.
   - Quiz: resolve the requested current group against server Set Item order, then bind question generation to the returned session UUID.
5. Insert the session and all item rows atomically. Empty NORMAL/Quiz groups and no-eligible-item SRS outcomes create no session and return an explicit non-qualifying empty/up-to-date response.
6. On exact `(user_id, operation_id)` replay, return the existing session only if mode, Set and normalized group request match; otherwise return `409 SESSION_OPERATION_CONFLICT`.

Accepting a requested NORMAL/Quiz group preserves the existing bounded navigation while the Backend remains authoritative: the client proposes identities, but the Backend re-reads membership/order, rejects omissions/reordering relative to that current group, and persists its own normalized snapshot. SRS remains fully Backend-selected.

Before commit, the service/repository must verify that the inserted item count equals immutable `snapshot_size`, positions are exactly contiguous `0..snapshot_size - 1`, and no business update path can mutate the persisted snapshot fields or item membership/order. These are service/repository invariants; V1 adds no trigger or cross-row constraint for them.

### 5.2 Effective lifecycle and precise expiry

- `ACTIVE`: stored active and transaction time `< expires_at`.
- `EXPIRED`: stored active and transaction time `>= expires_at`.
- `COMPLETED`: stored completed; later reads/replays do not compare it to expiry.
- Use exactly one authoritative server instant per operation for all expiry, evidence, completion and calendar-day decisions in that transaction. Production obtains it from the server clock; tests may inject the clock. Do not mix database, process or injected time sources within one operation. Acceptance is valid only when `accepted_at < expires_at`; equality is rejected.
- Persist all Streak `TIMESTAMP(3)` values using the UTC convention. Database-generated defaults use `CURRENT_TIMESTAMP AT TIME ZONE 'UTC'`, so they do not depend on PostgreSQL session timezone. Derive `activity_date` from the same authoritative instant converted to `Asia/Ho_Chi_Minh`.
- `expires_at` never extends on read, evidence, retry or replay.
- Read/reconcile returns effective state, counts, ordered item evidence and immutable timestamps. It never turns expiry into a database write.

### 5.3 Ownership, authorization and changing Set state

- Every session lookup is scoped by authenticated `user_id`; a missing, foreign or unauthorized identity returns the same non-disclosing 404.
- Before a new mutation, confirm the Set still exists, remains accessible and each targeted snapshot Vocabulary still belongs to it. Deletion, removal or revoked access returns `409 SESSION_INACCESSIBLE`; no evidence/completion/Streak write occurs.
- Reads may return a sanitized inaccessible terminal/restart state to the owner without exposing deleted Set content. Completed proof remains immutable.
- Independent active sessions are permitted across tabs. Evidence is always scoped to one session UUID and cannot satisfy another snapshot.

### 5.4 Locking, idempotency and recovery

- Mutation transaction lock order: session row (`FOR UPDATE`), authoritative session-item rows in stable order, SRS receipt/event-identity serialization, current Set/snapshot revalidation locks, existing USER/Vocabulary advisory Progress lock and Progress/XP rows in their current order, then evidence/completion/Streak Day persistence. All session-aware SRS paths use this order; sessionless Learning and Quiz retain their established Set then USER/Vocabulary advisory-lock order. The receipt step must not introduce a reverse wait from a Progress-locked writer back to a session row.
- Re-read status/expiry after acquiring the lock.
- Replay classification occurs only after the requested session has been scoped to the authenticated USER. A missing session, a session owned by another USER, or a receipt/event identity belonging to a foreign USER/session returns the same concealed `404 LEARNING_SESSION_NOT_FOUND`; the Backend must not reveal receipt or event existence through a `409`. After ownership is valid, exact receipt/evidence/completion replay returns the stored authoritative projection, while same-owner identity reuse with a different session/item/mode/rating/revision/answer returns `409 LEARNING_SESSION_EVENT_CONFLICT`.
- Constraint handling is target-specific. Progress identity and typed XP collisions retain their existing reconciliation; SRS receipt, item-evidence and completion-event collisions reconcile only an exact stored identity. An unrelated or unidentified Prisma `P2002` propagates fail-closed and is never relabelled as a generic Progress conflict.
- A competing final request observes the locked completed session and returns its immutable completion. Different sessions may both complete; `(user_id, activity_date)` permits one daily row.
- Insert `STREAK_DAY.user_id` only from the validated locked session owner, never from request data. Mode/evidence compatibility and complete-group evidence remain service-enforced before terminal completion.
- Any failure rolls back Progress/XP, the SRS operation receipt, item evidence, completion and Streak Day together. The client keeps the current card/question and retries with the same event UUID.
- A stale SRS/Quiz revision returns the existing conflict and does not advance session evidence. Frontend reconciles both Progress/question state and Backend session before continuing.

## 6. Mode integration

### 6.1 NORMAL Flashcard

- Preserve current groups of at most 10 and card navigation. Creation binds the current ordered group to a Backend session.
- First back reveal sends `{ operation_id, vocabulary_id }`. The service checks owner, mode, active/unexpired state, access and membership, then stores `NORMAL_REVEALED`.
- Repeating the same operation or revealing an already acknowledged item is a successful no-op and returns the current evidence projection. Reusing the operation UUID for another item conflicts.
- Navigation alone never sends completion. The existing finish action calls explicit completion only after the server reports every item revealed.
- Explicit completion uses its own `operation_id`, locks the session, verifies all items have evidence, writes `completed_at`, and inserts Streak Day in one transaction.
- If local reveal state is ahead after a failed request, the UI shows retry and does not treat the card as acknowledged until Backend acceptance.
- No `LEARNING_PROGRESS`, SRS, `XP_REWARD` or `USER.total_xp` call occurs.

### 6.2 SRS

- Session creation calls the same Backend eligibility/order logic as the current SRS read and snapshots at most the first 10 eligible items. Later-due items never join it.
- Add optional `session_id` to the existing rating request. With it, verify that the Vocabulary is an unresolved snapshot item before executing current revision, scheduling and XP rules.
- Every accepted session-bound rating commits a durable SRS operation receipt with the Progress mutation in the same transaction.
- `AGAIN` commits current Progress/SRS/XP behavior and its operation receipt, leaves qualification evidence null and requeues exactly as today.
- `HARD`, `GOOD` or `EASY` commits existing mutation plus the receipt and corresponding resolving evidence. The last unresolved item additionally completes the session and inserts Streak Day in the same transaction.
- Lost response: persist the complete pending payload before submission and retry the same `event_id`, `session_id`, Set, item, rating and revision after refresh/navigation. The UI must not create a replacement event until that pending operation is authoritatively reconciled. Current exact replay returns the original Progress/reward and reconstructed session/Streak projection. Stale or cross-tab competing revisions retain the current 409 behavior and cannot resolve a session item accidentally.
- Sessionless request: follow the current code path unchanged and omit all session/Streak writes and response additions.

### 6.3 Multiple Choice Quiz

- Quiz session creation snapshots 1–10 current group identities in Set Item order. Use `session.id` as the authoritative `run_id`; no second run identifier is stored.
- Session-aware question read accepts `session_id`, re-authorizes it and generates questions only for its immutable snapshot. Existing deterministic revisions, hidden answer and four-choice behavior remain.
- Add optional `session_id` to answer submission. When present it must equal `run_id`; validate unresolved snapshot membership before current question reconstruction/grading.
- Correct or incorrect accepted answers store `QUIZ_CORRECT` or `QUIZ_INCORRECT` in the same Progress/XP transaction. Thus a zero-correct run completes normally.
- The final distinct answer completes the session and inserts Streak Day atomically. Replaying an accepted answer returns the same result and never advances another item.
- Retry-current-group requests a new session with a new create operation UUID; it gets a fresh session/run identity and question revisions. Revisiting a completed result only reads the old terminal session.
- Sessionless questions/answers preserve the present `run_id`, optional `vocabulary_ids`, Progress and XP semantics and create no Streak evidence.

## 7. Proposed API contracts

All endpoints require the existing authenticated `USER` middleware. Response envelopes continue to use `{ "data": ... }`; errors continue to use the project error envelope. UUIDs shown are illustrative.

### 7.1 Create a qualifying session

`POST /api/learning-sessions`

```json
{
  "operation_id": "11111111-1111-4111-8111-111111111111",
  "set_id": "22222222-2222-4222-8222-222222222222",
  "mode": "NORMAL",
  "vocabulary_ids": ["33333333-3333-4333-8333-333333333333"]
}
```

- `vocabulary_ids` is required for the current NORMAL/Quiz group and forbidden for SRS. The Backend validates exact current Set order and bounds; SRS authors its own eligible list.
- Success `201`; exact creation replay `200` with the same object.
- Empty/up-to-date `200`: `{ "data": { "session": null, "reason": "EMPTY_SET" | "SRS_UP_TO_DATE" } }`.

```json
{
  "data": {
    "session": {
      "id": "44444444-4444-4444-8444-444444444444",
      "set_id": "22222222-2222-4222-8222-222222222222",
      "mode": "NORMAL",
      "state": "ACTIVE",
      "created_at": "2026-10-17T03:00:00.000Z",
      "expires_at": "2026-10-24T03:00:00.000Z",
      "completed_at": null,
      "snapshot_size": 1,
      "completed_items": 0,
      "items": [{ "vocabulary_id": "33333333-3333-4333-8333-333333333333", "position": 0, "evidence": null }]
    }
  }
}
```

### 7.2 Read/reconcile a session

`GET /api/learning-sessions/:sessionId`

- `200` returns the same authoritative projection with effective `ACTIVE`, `COMPLETED` or `EXPIRED` state.
- For an inaccessible active snapshot, include `can_continue: false` and `restart_reason: "SESSION_INACCESSIBLE"`; do not return protected card content.
- Foreign/missing session: `404 LEARNING_SESSION_NOT_FOUND`.

### 7.3 NORMAL reveal acknowledgement

`PUT /api/learning-sessions/:sessionId/items/:vocabularyId/reveal`

```json
{ "operation_id": "55555555-5555-4555-8555-555555555555" }
```

Success `200` returns the item evidence and current session projection. Duplicate reveal is `200` with `replayed: true` (same operation) or `already_acknowledged: true` (new operation, same item), without a second write.

### 7.4 NORMAL explicit completion

`POST /api/learning-sessions/:sessionId/complete`

```json
{ "operation_id": "66666666-6666-4666-8666-666666666666" }
```

Success/replay `200`:

```json
{
  "data": {
    "session": { "id": "...", "state": "COMPLETED", "completed_at": "2026-10-17T03:05:00.000Z" },
    "streak": { "current_streak": 1, "completed_today": true, "last_qualified_date": "2026-10-17", "timezone": "Asia/Ho_Chi_Minh" },
    "replayed": false
  }
}
```

Only NORMAL may use this endpoint. SRS/Quiz complete on their final accepted mutation.

### 7.5 Session-aware SRS rating

Existing `POST /api/learning/events`, additive request field:

```json
{
  "event_id": "77777777-7777-4777-8777-777777777777",
  "session_id": "44444444-4444-4444-8444-444444444444",
  "set_id": "22222222-2222-4222-8222-222222222222",
  "vocabulary_id": "33333333-3333-4333-8333-333333333333",
  "expected_revision": 0,
  "rating": "GOOD"
}
```

The existing Progress and `reward` response fields remain unchanged. Session-aware success adds:

```json
{
  "session": { "id": "...", "state": "COMPLETED", "completed_items": 1, "snapshot_size": 1 },
  "streak": { "current_streak": 1, "completed_today": true, "last_qualified_date": "2026-10-17", "timezone": "Asia/Ho_Chi_Minh" }
}
```

`streak` is present only when the response observes terminal completion; nonterminal responses include `session` only. Omitting `session_id` selects the unchanged legacy path and omits both additions.

### 7.6 Session-aware Quiz questions and answers

- New session-aware read: `GET /api/quiz/sets/:setId/questions?type=MULTIPLE_CHOICE&session_id=<uuid>`; response `run_id` equals `session_id`.
- Existing legacy `run_id` and `vocabulary_ids` query remains accepted when `session_id` is absent.
- Existing `POST /api/quiz/answers` adds optional `session_id`; when present it must equal `run_id`. The existing result, Progress and reward fields stay unchanged, with the same optional `session`/terminal `streak` additions as SRS.

### 7.7 Read current Streak

`GET /api/users/me/streak`

```json
{
  "data": {
    "current_streak": 4,
    "completed_today": false,
    "last_qualified_date": "2026-10-16",
    "timezone": "Asia/Ho_Chi_Minh",
    "evaluated_at": "2026-10-17T02:00:00.000Z"
  }
}
```

New USER/no qualifying day returns `0`, `false`, `null`. The read is mutation-free.

### 7.8 Error mapping

| HTTP | Code | Meaning / client action |
|---|---|---|
| 400 | `LEARNING_SESSION_VALIDATION_ERROR` | Invalid UUID, mode, field set, duplicate/out-of-order group or over 10 items. |
| 401 | existing auth code | Login/session invalid. |
| 403 | existing USER-role code | ADMIN/unauthorized role. |
| 404 | `LEARNING_SESSION_NOT_FOUND` | Missing, foreign or non-disclosable session/Set. |
| 409 | `LEARNING_SESSION_EXPIRED` | At/after exact expiry; reconcile and start new session. |
| 409 | `LEARNING_SESSION_INACCESSIBLE` | Set removed, membership changed or access revoked; restart only if currently authorized. |
| 409 | `LEARNING_SESSION_INCOMPLETE` | NORMAL explicit completion before every reveal. |
| 409 | `LEARNING_SESSION_EVENT_CONFLICT` | Reused operation/event with different payload or wrong item/session. |
| 409 | existing SRS/Quiz revision code | Stale Progress/question; no evidence or Streak mutation. |
| 500/503 | existing operational envelope | Keep current item and retry same identity after reconciliation. |

Request validators must use explicit field allowlists, UUID validation, enum validation and mode-specific presence/absence rules. Unknown fields—including owner, status, timestamps, completion date, timezone, Streak value, evidence state and XP—are rejected rather than ignored. Business validation (ownership, Set access, ordered membership, expiry, state transition and revision) remains in services after syntactic validation.

## 8. Streak projection algorithm

### 8.1 Calendar conversion

- Inject one Backend clock (`now`) into service operations and tests.
- Convert the instant to the IANA zone `Asia/Ho_Chi_Minh`; never use client locale or process-local timezone. Prefer the runtime's built-in `Intl.DateTimeFormat` with explicit `timeZone` rather than a new dependency.
- Persist only the resulting ISO `YYYY-MM-DD` in PostgreSQL `DATE`. Completion uses the transaction acceptance instant, not session creation time.

### 8.2 Projection query

1. Derive `today` and `yesterday` in `Asia/Ho_Chi_Minh`.
2. Query that USER's `STREAK_DAY.activity_date <= today` in descending order using the `(user_id, activity_date)` index.
3. Choose the anchor: today if present; otherwise yesterday if present; otherwise return `0`.
4. Walk descending dates, counting while each next date equals the preceding calendar day. Stop at the first gap.
5. Return the count, whether today exists, most recent qualifying date and fixed timezone label.

This is a read-only projection. For V1 scale, one row per active calendar day per USER is bounded and simple; if measurements later justify it, the repository may page consecutive rows without changing the contract. Do not persist or reset a counter.

Expected cases:

- No rows: `0`.
- First completion today: `1`.
- Consecutive through today: sequence length through today.
- No today row but yesterday is the sequence end: retain that length.
- Neither today nor yesterday: `0`; retained history remains.
- Completion after a break: new anchor exists today and count stops at the gap, therefore `1`.
- Multiple same-day completions: unique insert no-op; projection unchanged.
- A completion accepted at 16:59:59.999Z belongs to the current UTC+7 date; one at 17:00:00.000Z belongs to the next date.

## 9. Frontend and Dashboard plan

### 9.1 Shared session integration

- Add a narrow API service for create/read/reveal/complete/Streak read; do not add a global event bus or general learning framework.
- Extend each mode-owned sessionStorage record with `backend_session_id`, `expires_at`, and creation operation identity. Bump storage versions and safely discard incompatible old records.
- Local state remains presentation-only (cursor, visible face, retry queue/result screen). On page entry/resume, read the Backend session before trusting local evidence or completion.
- If Backend state is ahead after a lost response, merge authoritative completed item identities into presentation state. Never downgrade Backend evidence from local state.
- `EXPIRED` or inaccessible sessions display a concise Vietnamese explanation and a restart action. Restart creates a new Backend session; it never reopens or clones completion.
- Do not auto-create a new session when merely revisiting a completed result screen. Explicit “retry group” is the new-session action.

### 9.2 NORMAL

- Send reveal acknowledgement only on the front-to-back transition. Disable/indicate pending acknowledgement for that card; on failure keep normal card UX but require retry before final completion.
- The finish button becomes enabled from authoritative reconciled evidence, not just the local last-card position.
- Completion success preserves current navigation/result behavior and may update the local Streak source; it shows no XP Toast.

### 9.3 SRS

- Start from the Backend session snapshot rather than reconstructing qualification from sessionStorage.
- Include `session_id` in current rating calls; retain identical `AGAIN` requeue, keyboard/focus, Progress and reward Toast behavior. Persist a pending rating operation before transport; after refresh/navigation expose an actionable exact retry and block creation of a replacement event until reconciliation succeeds or returns an authoritative terminal/stale outcome.
- Only accepted responses advance/requeue. Terminal response marks the Backend session complete; no extra completion request.

### 9.4 Quiz

- Use Backend `session_id` as `run_id` for session-aware questions and answers.
- Preserve authoritative feedback, keyboard focus, announcements, XP Toast and zero-correct result summary.
- Result restore reads the completed session and does not resubmit answers. Retry explicitly creates a new session.

### 9.5 Dashboard Streak card

- Add one independent USER-only data source using the existing Dashboard loading/retry pattern. ADMIN remains neutral and does not call the endpoint.
- Compact content: flame/icon with hidden decorative semantics, `N ngày` value and one truthful status line.
- States:
  - loading skeleton/status with `aria-live="polite"`;
  - completed today: “Bạn đã duy trì chuỗi hôm nay.”;
  - pending today with yesterday active: prompt to complete a qualifying activity today;
  - broken/no active sequence: `0 ngày` and neutral restart copy;
  - error: preserve any last successful value if present, label it stale, and provide a keyboard-accessible retry.
- Use existing card tokens and responsive grid conventions. No Monday–Sunday calendar, heat map, Level/XP redesign or Daily Goal.
- Focus order, visible focus, semantic heading/value, screen-reader status and narrow-width wrapping must be covered in focused UI review during implementation.
- The later `ui-ux-review` gate uses **Focused** mode for only the changed learning/Quiz/Dashboard surfaces. Its browser matrix covers 320, 375, 768, 1024 and 1440 CSS pixels, widths immediately around any affected breakpoint, a narrow sidebar/content container, effective 200% zoom, keyboard-only interaction and reduced-motion behavior. It checks 44px touch targets where required, Vietnamese wrapping, overflow, focus restoration after pending/success/error transitions and accessible status announcements. Screenshot/browser evidence is required at meaningful boundary states; omitted combinations must be reported rather than assumed.

## 10. Transaction details and failure recovery

| Operation | Atomic work |
|---|---|
| Create | authorize and compute snapshot; insert session + all items, or nothing. |
| NORMAL reveal | lock session/item; re-authorize; insert evidence, or return exact no-op/replay. |
| NORMAL completion | lock session; verify all reveals; set terminal timestamp/event; insert daily row; return projection. |
| SRS rating | current Progress/SRS/XP work + session evidence for passing rating + possible terminal completion + daily insert. |
| Quiz answer | current grading/Progress/XP work + answer evidence + possible terminal completion + daily insert. |

- Compute `accepted_at` once per transaction and use it for expiry, evidence, completion and day conversion.
- Database uniqueness resolves daily races. A unique conflict is expected success, not an error.
- Existing positive XP deduplication remains independent. A zero-XP SRS/Quiz completion can still create a Streak day.
- If Streak insertion or evidence fails, roll back the existing Progress/XP mutation as well; returning success with partial evidence is prohibited.
- If response delivery fails after commit, exact event replay reconstructs the accepted response. Frontend reconciliation handles cases where the current Progress revision has advanced.
- Do not automatically restore or destructively roll back data on deployment failure. Stop rollout, capture sanitized evidence, and use the separately approved recovery procedure.

## 11. Migration and deployment safety

### 11.1 Baseline and follow-up additive migrations

- The reviewed baseline migration `20261017000000_add_streak_v1` adds the approved enums and three business tables with their foreign keys, checks, unique constraints and indexes. That completed migration remains unchanged and its accepted evidence is not invalidated.
- A separate forward-only follow-up migration adds only `LEARNING_SESSION_SRS_RECEIPT` and its receipt-specific FK, checks, uniqueness and index described in section 4.3.1. It must not rewrite or replace the baseline migration.
- Neither migration alters or backfills `USER`, `LEARNING_PROGRESS`, `XP_REWARD`, SRS dates, Quiz data or XP. The follow-up creates no historical receipt rows.
- All existing accounts project Streak `0` because `STREAK_DAY` starts empty.
- Baseline migration evidence remains accepted. Focused receipt-delta safety evidence verifies sequential apply, exact receipt constraints/delete behavior/global event uniqueness, no receipt backfill and preservation of existing USER/Progress/XP/session data before refreshed Gate ST-1 acceptance.

### 11.2 Rollout order

1. Review and approve SPEC/PLAN/TASK separately. The SRS receipt amendment reopens only its additive schema/constraint delta for Gate ST-1 evidence; it does not invalidate the accepted three-model baseline or prior TASK-235/236 results.
2. Implement and verify against local development plus a dedicated isolated CI TEST database.
3. Produce a current recoverable backup of each target before any authorized migration.
4. Apply additive migration to the target using the repository's approved Prisma deploy command under separate HUMAN authorization.
5. Verify migration history/schema/data counts read-only.
6. Deploy Backend capable of both session-aware and sessionless requests.
7. Deploy Frontend session integration and Dashboard.
8. Monitor sanitized error rates; do not remove legacy compatibility in V1.

Backend must be deployed before or with the new Frontend. The additive schema may exist before the Backend is deployed without changing old behavior. Rolling the Frontend back remains safe because sessionless APIs remain supported. Backend rollback after new sessions exist must be assessed at release time; old code ignores additive tables, while retained rows remain for a later corrected deploy.

### 11.3 Environment separation

- **Local Development DB:** developer-only iteration; never treated as release evidence by itself.
- **Dedicated CI TEST DB:** isolated fixture/migration/rollback/concurrency verification; reset is allowed only inside its already approved guarded workflow.
- **Preview TEST DB:** migration/deployment requires explicit HUMAN authorization, target identity verification and current backup; never substituted for CI destructive tests.
- **Production DB:** entirely separate authorization, backup/recovery and release gate; no assumption that Preview approval authorizes Production.

For TASK-236 only, a narrowly scoped guarded GitHub Actions `workflow_dispatch`
entry point may be added to run the Streak migration harness against the
dedicated CI TEST database. The protected GitHub secret
`CI_TEST_DATABASE_URL` is mapped process-locally to `TEST_DATABASE_URL`; its
value is never hardcoded, printed or written to a repository file. Before the
first connection, the harness must require the CI/runtime authorization guards
and prove an exact three-way match between the identity derived from
`TEST_DATABASE_URL`, the configured non-secret `CI_TEST_DATABASE_IDENTITY` and
the separately HUMAN-approved `STREAK_MIGRATION_APPROVED_TARGET_IDENTITY`.
Adding this entry point does not authorize dispatch or database access. The
verification execution and any recovery-only cleanup execution require
separate explicit HUMAN authorizations. TASK-249 continues to own the later
integrated CI/real-stack registration and regression lifecycle; TASK-236 owns
only its isolated migration-verification entry point and owned-schema cleanup.
The verification run uses GitHub's actual repository, run ID and run attempt.
Recovery-only cleanup accepts separately authorized non-secret
`STREAK_CLEANUP_TARGET_RUN_ID` and
`STREAK_CLEANUP_TARGET_RUN_ATTEMPT`. Both must remain strings and match the
positive-decimal-integer form exactly; validation must not convert them to a
JavaScript number or otherwise risk precision loss. These target values may be
consumed only in `--cleanup-only` mode and must never overwrite or simulate
`GITHUB_REPOSITORY`, `GITHUB_RUN_ID` or `GITHUB_RUN_ATTEMPT`. Cleanup derives
candidate schema names from the approved historical target run/attempt while
requiring every ownership marker to match the actual `GITHUB_REPOSITORY` plus
that exact target run and attempt.

No database access, migration, backup action, deployment or CI dispatch is authorized by this PLAN request.

## 12. Verification strategy and AC matrix

Tests are planned only; none are executed at PLAN stage. Backend services receive a deterministic clock. PostgreSQL behavior uses isolated fixtures and transaction rollback/cleanup in the dedicated CI TEST environment. Browser tests mock APIs for UX branches and use guarded real-stack coverage only for critical persistence paths.

### 12.1 Test layers

- **Pure unit:** timezone/date conversion, expiry equality, state transitions, projection sequences, request validation and response parsing.
- **Backend service/repository unit:** snapshot selection, ownership, mode evidence, receipt identity, idempotency and legacy branching with fakes, including two-session UUID reuse and multiple `AGAIN` operations.
- **HTTP/PostgreSQL integration:** auth/ownership, receipt/constraint metadata, locks, concurrent same/cross-session event collisions, rollback, Set changes, Progress/XP preservation and exact replay.
- **Frontend component/browser:** resume/reconcile, reveal/finish, SRS requeue, lost response followed by actual reload and exact pending-event retry, Quiz zero-correct/retake, expiry UI, focus/live regions and Dashboard states/responsiveness.
- **Guarded real-stack E2E:** one successful path per mode plus XP/Progress/Streak persistence and sessionless compatibility against the dedicated CI database only.
- **Legacy/regression impact scan:** search all active callers, mocks, fixtures, response validators, route parameters, selectors, integration/E2E assertions and official documentation affected by optional `session_id` and additive response fields. Classify matches as active stale references, intentional rejection coverage, explicitly superseded history or unrelated references. Static review is not reported as an executed PASS when guarded database tests are unavailable.

### 12.2 Acceptance-criteria traceability

Business-rule coverage is preserved by rule group before the criterion-level matrix:

| Business rules | PLAN coverage |
|---|---|
| BR-ST-001–008 | USER authorization, exact qualifying modes, completion boundary, non-qualifying actions, XP independence, daily uniqueness and no Freeze: sections 3, 5, 7 and 10. |
| BR-ST-009–014 | NORMAL bounded snapshot, reveal evidence, explicit completion, zero Progress/XP and replay: sections 4, 6.1, 7.3–7.4 and 10. |
| BR-ST-015–022 | Backend SRS queue, unresolved/AGAIN/resolution semantics, immutable membership, current scheduling/XP and up-to-date outcome: sections 5.1, 6.2 and 7.5. |
| BR-ST-023–029 | Quiz snapshot, correct/incorrect evidence, zero-correct completion, current grading/XP, replay and genuine retake: sections 6.3 and 7.6. |
| BR-ST-030–038 | UTC+7 authoritative dates, uniqueness, current sequence, yesterday retention, break/reset projection and retained history: sections 4.4 and 8. |
| BR-ST-039–046 | Backend timestamps, exact seven-day boundary, resume/completion day, expiry, preserved mutations, parallel sessions and concurrent idempotency: sections 4.2, 5 and 10. |

| AC | Planned verification |
|---|---|
| AC-ST-01 | HTTP auth matrix: USER allowed; Guest 401; ADMIN 403 for create/read/mutate/Streak. |
| AC-ST-02 | Integration ownership tests hide foreign sessions and prevent cross-session evidence. |
| AC-ST-03 | Schema/service tests prove immutable UUID, Set/mode/owner, 1–10 distinct ordered snapshot. |
| AC-ST-04 | Deterministic clock tests prove exact seven 24-hour periods and equality expiry. |
| AC-ST-05 | Resume integration test reconciles active state across application-day boundary. |
| AC-ST-06 | Expired/failed/abandoned/inaccessible sessions produce no Streak Day. |
| AC-ST-07 | NORMAL HTTP/browser test acknowledges every revealed back through Backend. |
| AC-ST-08 | Duplicate NORMAL reveal is an idempotent no-op; conflicting operation is 409. |
| AC-ST-09 | NORMAL completion before all reveals is rejected with no partial write. |
| AC-ST-10 | Explicit NORMAL completion atomically completes and inserts the day. |
| AC-ST-11 | NORMAL regression asserts no Progress, XP reward or `total_xp` mutation. |
| AC-ST-12 | Reopen/replay completed NORMAL returns immutable result and no new day/session. |
| AC-ST-13 | SRS creation integration matches existing eligible order and caps at 10. |
| AC-ST-14 | SRS `AGAIN` preserves unresolved evidence and existing frontend requeue. |
| AC-ST-15 | HARD/GOOD/EASY resolve exactly the targeted session item. |
| AC-ST-16 | Only the final initial-item resolution completes and inserts Streak atomically. |
| AC-ST-17 | Items becoming due later are absent from immutable active snapshot. |
| AC-ST-18 | No eligible SRS item returns up-to-date, creates no session/day. |
| AC-ST-19 | Existing revision, scheduling, reward dedupe and XP projection regression suites remain green. |
| AC-ST-20 | Quiz session snapshot/order/bound and session run identity integration test. |
| AC-ST-21 | Correct and incorrect accepted answers both create one answer evidence row. |
| AC-ST-22 | All-incorrect real/service flow completes and qualifies with zero Quiz XP. |
| AC-ST-23 | Result revisit/replay cannot answer or complete again. |
| AC-ST-24 | Explicit retake creates new session/run/questions; old session remains terminal. |
| AC-ST-25 | Existing grading, choice validation, Progress and XP regression suites remain green. |
| AC-ST-26 | UTC+7 boundary tests around 16:59:59.999Z/17:00:00.000Z assign dates correctly. |
| AC-ST-27 | PostgreSQL concurrent completions for same USER/date create one unique ledger row. |
| AC-ST-28 | Projection unit/integration: no rows 0; first day 1; consecutive days increment. |
| AC-ST-29 | Yesterday anchor retains active count while today is pending. |
| AC-ST-30 | Full missed day reads 0 without mutation; next completion starts at 1. |
| AC-ST-31 | Concurrent same-session terminal requests produce one immutable completion and replay result. |
| AC-ST-32 | Forced repository failures roll back Progress/XP/evidence/completion/day together. |
| AC-ST-33 | Sessionless SRS/Quiz HTTP regressions preserve old responses/mutations and create no Streak rows. |
| AC-ST-34 | Speaking/NORMAL distinction and negative route scans prove Speaking cannot create sessions/days. |
| AC-ST-35 | Dashboard browser tests cover loading, today complete, pending, broken/zero, stale/error/retry and ADMIN non-call. |
| AC-ST-36 | Responsive/accessibility browser checks at project breakpoints; no weekly calendar, Daily Goal or Level/XP redesign. |

**Coverage:** 36/36 acceptance criteria planned. The mode, integrity, calendar and compatibility tests collectively cover all 46 business rules; the later TASK document must retain this traceability rather than renumbering requirements.

## 13. Incremental implementation phases and review gates

Each phase requires a separately approved TASK before implementation. Passing a phase does not authorize the next one.

### Phase 1 — Persistence and migration design

- **Prerequisites:** PLAN approval and TASK authorization.
- **Scope:** Prisma enums/models, additive SQL migration, constraints/indexes and migration safety tests only.
- **Validation:** schema generation, migration lint/safety harness, isolated CI PostgreSQL apply/rollback feasibility and no-backfill assertions.
- **Rollback consideration:** migration is additive; do not auto-drop tables in shared environments. Failed shared rollout stops for HUMAN recovery decision.
- **Gate:** HUMAN reviews exact SQL, FKs, checks, backup and target procedure.

### Phase 2 — Backend session foundation

- **Scope:** session/Streak repositories/services, create/read/reveal/complete routes, UTC+7 projection and auth/ownership/concurrency tests.
- **Validation:** unit + HTTP/PostgreSQL integration with deterministic time.
- **Rollback:** feature remains unused by current Frontend; additive code can be reverted while tables remain.
- **Gate:** review lifecycle, idempotency, expiry and NORMAL no-XP boundary.

### Phase 3 — NORMAL integration

- **Scope:** frontend session creation/reconciliation, reveal acknowledgements, explicit finish, expiry/restart UX.
- **Validation:** focused component/browser tests and UI/UX Focused review; verify zero Progress/XP.
- **Rollback:** frontend can return to old local NORMAL flow only before release acceptance; do not claim Streak for that legacy flow.
- **Gate:** HUMAN visual review of interaction, accessibility and error recovery.

### Phase 4 — SRS integration

- **Scope:** optional session association in existing event API, atomic evidence/finalization, frontend binding.
- **Validation:** AGAIN/final resolution/replay/stale revision/concurrency plus complete SRS and XP regression.
- **Rollback:** omit `session_id` to preserve legacy behavior; no schema rollback.
- **Gate:** formal review of transaction ordering and XP identity.

### Phase 5 — Quiz integration

- **Scope:** session-bound questions/answers, run identity, zero-correct completion, retake flow.
- **Validation:** grading/choice/Progress/XP regression, replay and focused keyboard/accessibility browser tests.
- **Rollback:** legacy question/answer contract remains supported.
- **Gate:** formal review of hidden-answer integrity and run replay.

### Phase 6 — Streak projection and Dashboard

- **Scope:** read endpoint, compact USER card, all truthful states and responsive/accessibility behavior.
- **Validation:** projection boundary tests, Dashboard mocked browser tests, guarded real-stack read, Focused UI/UX review.
- **Rollback:** card can be hidden/reverted without changing durable sessions/days; API remains additive.
- **Gate:** HUMAN visual approval. Future `Level & XP | Streak | Daily Goal` redesign remains deferred.

### Phase 7 — Regression, documentation and final review

- **Scope:** full targeted backend/frontend/real-stack matrix; docs synchronization; formal TEST and REVIEW reports.
- **Validation:** 36/36 AC traceability, all 46 rules, migration evidence, auth/security, regression and deployment preflight.
- **Rollback:** release gate stops before shared DB/deployment on any BLOCKER/MAJOR finding.
- **Gate:** final HUMAN acceptance before status becomes `DONE` or any merge/deployment.

## 14. Expected file impact (not implementation authorization)

Likely new files:

- `backend/src/services/learning-session-service.js`
- `backend/src/services/streak-service.js`
- `backend/src/repositories/learning-session-repository.js`
- `backend/src/repositories/streak-repository.js`
- `backend/src/controllers/learning-session-controller.js`
- `backend/src/controllers/streak-controller.js`
- `backend/src/routes/learning-session-routes.js`
- `backend/src/routes/streak-routes.js`
- `frontend/src/services/learning-session-service.js`
- `frontend/src/services/streak-service.js`
- focused backend/frontend test files and one Prisma migration directory

Likely extensions:

- `backend/prisma/schema.prisma`
- existing Learning/Quiz service, repository, controller, route and app-wiring files
- existing learning/Quiz frontend state, pages and API response validators
- Dashboard page/styles
- existing learning/Quiz/XP and browser integration suites
- official project documentation listed in section 2.4

Exact test filenames and whether small controllers/routes are combined must be decided during TASK decomposition from the then-current tree; no unrelated refactor is planned.

## 15. Risks and mitigations

| Risk | Mitigation / gate |
|---|---|
| Atomic session work changes mature SRS/Quiz transactions | Extend their existing transaction client; regression-test reward identity, revisions, schedules and forced rollback. |
| Deadlock from concurrent tabs | Fixed lock order, short transactions, same-session row lock and bounded retry only for recognized serialization/deadlock errors. |
| Duplicate Streak at midnight/race | Single transaction timestamp, explicit UTC+7 conversion and DB unique `(user_id, activity_date)`. |
| Client local state disagrees after lost response | Same event UUID retry followed by authoritative session read; local state never awards completion. |
| Set/Vocabulary changes break snapshots | Immutable scalar identities, current-access recheck and reject rather than shrink denominator. |
| Legacy clients accidentally earn Streak | Branch exclusively on validated `session_id`; sessionless path cannot call session/Streak repository. |
| XP regression or duplicate Toast | Keep reward response/source unchanged; additive session fields only; use existing backend reward amount and Toast tests. |
| Stored sessions grow indefinitely | Accept bounded V1 storage for correctness; measure before proposing separately approved retention cleanup. |
| Timezone depends on host settings | Explicit IANA timezone and injected clock; never use implicit local time or client dates. |
| Migration/deploy mismatch | Additive migration first, backward-compatible Backend, Frontend last, backup and environment-specific gates. |

## 16. HUMAN-approved PLAN decisions

HUMAN approved the following technical choices for TASK drafting. Approval does not authorize implementation or database work:

| # | Decision | Recommended option | Trade-off / rejected alternative |
|---|---|---|---|
| 1 | Persistence shape | **HUMAN APPROVED:** use the three business models `LEARNING_SESSION`, `LEARNING_SESSION_ITEM` and `STREAK_DAY`, their proposed enums/checks, and no `USER.current_streak`. The later approved SRS amendment adds only an auxiliary receipt child owned by the Session Item group; it is not a fourth conceptual business-data group. | Read projection costs a small indexed date query, but avoids counter drift, reset writes and a redundant source of truth. General analytics/event history remains unnecessary and out of scope. |
| 2 | Expiry representation | **HUMAN APPROVED:** derive effective `EXPIRED` from stored `ACTIVE` plus Backend time `>= expires_at`; do not persist expiry or schedule cleanup. | Reads perform a timestamp comparison, but the boundary is immediately correct without a cron, delayed state or extra writes. |
| 3 | Snapshot relations/deletion | **HUMAN APPROVED:** preserve immutable Set/Vocabulary UUID scalars; use optional Set FK with `ON DELETE SET NULL`, no Vocabulary FK, and USER `ON DELETE RESTRICT` for V1. | This preserves proof and existing Set/Vocabulary deletion behavior. Vocabulary validity is service-enforced. A future authorized account-deletion flow must explicitly handle dependent records before USER deletion rather than being silently broken or introduced by Streak V1. |
| 4 | Retention | **HUMAN APPROVED:** retain sessions, items and Streak Days long-term in V1; defer cleanup until measured and separately approved. | Storage grows by bounded session items, but replay/audit proof remains intact and V1 avoids an unapproved scheduler. Retention optimization is future work, not a V1 requirement. |
| 5 | Quiz identity | **HUMAN APPROVED:** use `LEARNING_SESSION.id` as the session-aware Quiz `run_id`. | This removes duplicate identity/state and naturally refreshes deterministic questions on retake. It couples the two concepts intentionally; legacy sessionless `run_id` remains supported. |
| 6 | Snapshot selection | **HUMAN APPROVED:** for NORMAL/Quiz, let the client propose its current bounded group while the Backend verifies access, membership, uniqueness, size and authoritative order before persisting it; SRS remains Backend-selected. | This minimally preserves current grouped navigation. A new server cursor protocol would add state/API complexity without improving completion integrity, because client choice never proves completion. |
| 7 | Streak response discovery | **HUMAN APPROVED:** embed authoritative Streak projection in terminal responses; use separate `GET /api/users/me/streak` for Dashboard and refresh. | Adds a small terminal payload but avoids a second race-prone request during completion. A single read endpoint remains the general source for unrelated screens. |
| 8 | API compatibility | **HUMAN APPROVED:** use the routes/error mapping in section 7 and optional `session_id` on existing SRS/Quiz contracts. | Optional association requires strict branching and regression coverage, but enables incremental rollout and preserves approved legacy clients. Compatibility removal remains outside V1. |
| 9 | Item evidence identity | **HUMAN APPROVED:** each accepted durable item evidence receives its own globally unique `evidence_event_id`; terminal completion uses the separate `completion_event_id`. | A batch cannot reuse one UUID across items. Global single-use makes exact replay/conflict detection unambiguous without adding an event-history table. |
| 10 | Timestamp convention | **HUMAN APPROVED:** retain `TIMESTAMP(3)` and persist Streak timestamps using the UTC convention; database defaults use `CURRENT_TIMESTAMP AT TIME ZONE 'UTC'`. Each production operation uses one server-clock instant, while tests may inject that clock, and `activity_date` is derived from the same instant in `Asia/Ho_Chi_Minh`. | Avoids a type change while removing PostgreSQL session-timezone dependence and mixed-clock boundary decisions. |
| 11 | Cross-row integrity ownership | **HUMAN APPROVED:** service/repository code enforces item count equals `snapshot_size`, contiguous positions, mode-compatible evidence, complete-group completion, Streak Day ownership from the validated session and immutable snapshot write paths. Do not add triggers or new cross-table constraints in V1. | Keeps the additive schema straightforward; guarded service/repository tests must prove invariants that ordinary PostgreSQL checks cannot express across rows/tables. |
| 12 | SRS operation receipt | **HUMAN APPROVED:** retain a globally unique immutable receipt for every accepted session-bound SRS event, linked to the exact Session Item with rating/revision identity. It shares transaction/retention with the session, is replay metadata only, and never resolves `AGAIN` or qualifies Streak. Add it through a new additive migration and refresh Gate ST-1 evidence for this delta. | Adds one narrow child table and bounded write per session-aware rating, but is the minimal relational design that supports repeated `AGAIN`, cross-session mismatch rejection and permanent UUID non-reuse without changing Progress or conflating operation identity with qualification evidence. |

## 17. Open issues and SPEC reconciliation

- **No blocking SPEC contradiction was found.** The approved SPEC's three persistence groups, session APIs and legacy compatibility are mutually implementable with the current architecture.
- Current deferred broad Streak wording elsewhere in project documentation can mention Speaking Practice. The approved SPEC explicitly supersedes that for Streak V1. Documentation synchronization must state that Speaking does not qualify; implementation must not silently treat the older product direction as active behavior.
- Account deletion behavior with durable Streak history remains outside Streak V1. The approved `RESTRICT` policy exposes the dependency; a future authorized account-lifecycle feature must explicitly resolve it rather than silently failing or deleting evidence.

## 18. PLAN readiness

This PLAN covers all 46 approved business rules and maps all 36 acceptance criteria. HUMAN has approved its direction and section 16 decisions. TASK drafting is authorized for HUMAN review; implementation, migration creation/execution, tests, CI and deployment remain unauthorized until their respective approvals.
