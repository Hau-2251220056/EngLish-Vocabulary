# SPEC: XP & Level V1

**Feature status:** `TODO`

**SPEC status:** `FINAL DRAFT — PENDING HUMAN SPEC APPROVAL`

**Baseline:** `dev` at `5a6699a87d26a5ac0f77b7ce9165769b8be2e6fc`

**Implementation authorized:** `NO`

## 1. Objective

XP & Level V1 gives authenticated USER accounts bounded gamification feedback for authoritative SRS and Multiple Choice Quiz learning events. It must reward meaningful activity without allowing duplicate requests, repeated Quiz runs, alternate Set membership, same-session SRS requeues or concurrent requests to farm XP.

The Backend owns reward eligibility, persistence, total XP and Level. V1 extends the existing Learning/SRS, Quiz and USER Dashboard contracts; it does not create a parallel learning event system or allow the Frontend to award or calculate authoritative XP or Level.

## 2. Existing Context and Reconciliation

- `USER.total_xp` already exists with default `0`; existing balances must be preserved.
- Level is not stored and is derived by the Backend from `total_xp`.
- `LEARNING_PROGRESS` is unique by `(user_id, vocabulary_id)` and already supplies `revision` and `last_event_id` for Progress concurrency and immediate-current-event idempotency.
- SRS ratings and Quiz answers already update Progress inside Backend transactions.
- SRS, Quiz and Dashboard are existing features to extend, not replace.
- Current SRS and Quiz contracts intentionally exclude XP. This SPEC supersedes only that exclusion for the exact reward events defined here.
- Speaking Practice V1 and NORMAL Flashcard remain zero-XP activities.
- XP, Level, XP Summary and Level Summary remain `TODO` until this feature completes the approved workflow.
- Speaking Practice V1 Gate R4 remains open and is unaffected by this feature.

## 3. Actors and Authorization

- **USER:** May earn and view only their own XP and Level through authenticated, authorized learning activity.
- **Guest:** Cannot access USER reward state or submit reward-bearing activity.
- **ADMIN:** Is excluded from XP earning and the USER XP/Level Dashboard surface in V1. The existing neutral ADMIN Dashboard remains unchanged.

Backend authentication and USER-role authorization are mandatory. A request cannot supply or override reward owner, XP amount, Level, reward type or reward cycle.

## 4. Scope

### 4.1 In Scope

- First qualifying SRS reward per exact USER/Vocabulary identity.
- First-correct Multiple Choice Quiz reward per exact USER/Vocabulary identity, independent of SRS.
- Repeatable genuine due-review SRS reward, at most once per eligible review cycle.
- Durable reward deduplication records and atomic `USER.total_xp` increments.
- Backend-authoritative Level 1–15 calculation.
- Reward projections on accepted SRS and Quiz responses.
- USER Dashboard XP/Level summary and progress toward the next Level.
- Legacy cutover Policy A without backfill.
- Focused unit, API, transaction, concurrency, migration, frontend and guarded real-stack verification.

### 4.2 Out of Scope

- Streak, Daily Goal, Daily Goal bonus or daily XP persistence.
- Achievement evaluation or rewards.
- Leaderboard, ranking, competition or social comparison.
- XP history, activity timeline, transaction list or reward-management UI.
- Manual/admin XP adjustment, reward reversal or refund.
- Retroactive XP calculation or reward-record backfill.
- XP for Speaking Practice, NORMAL Flashcard, reference audio, page views, reload, navigation or session completion.
- New Quiz types, SRS scheduling changes or learning-content unlocks.
- Level-based authorization, Set/Topic locking or premium roles.
- XP expiration, negative rewards or XP spending.
- Daily Goal integration. Daily Goal is a future independent XP source requiring a separate approved workflow.

## 5. Identity and Reward Types

- Vocabulary identity is the exact UUID. Word spelling is never a reward identity or deduplication key.
- The same Vocabulary UUID in multiple Sets shares one Progress record and one reward identity per USER.
- Independent private Vocabulary records with identical headwords have independent UUIDs, Progress and rewards.
- SRS and Quiz first rewards are independent reward channels.

V1 defines exactly three positive reward types:

| Reward type | Amount | Durable cycle |
|---|---:|---:|
| `SRS_INITIAL` | 3 XP | `0` |
| `QUIZ_FIRST_CORRECT` | 3 XP | `0` |
| `SRS_DUE_REVIEW` | 1 XP | Pre-event Progress revision |

Zero-XP activity creates no reward row.

## 6. Business Rules

### 6.1 General Rules

- **BR-01:** XP belongs only to authenticated USER accounts.
- **BR-02:** `USER.total_xp` is the authoritative cumulative balance and never decreases in V1.
- **BR-03:** A reward is created only by an accepted authoritative Backend SRS rating or Quiz answer.
- **BR-04:** Progress mutation, reward insertion and `total_xp` increment commit atomically or all roll back.
- **BR-05:** Frontend state, Set ID, run ID, headword text, client totals and client Level never establish reward eligibility.
- **BR-06:** Reopening, reloading, listening, revealing, navigating, restarting a run or completing a transient session earns zero XP.
- **BR-07:** No historical Progress, `review_count` or status is converted into XP during migration.

### 6.2 Initial SRS Reward

- **BR-08:** `AGAIN` never awards `SRS_INITIAL` XP.
- **BR-09:** The first accepted eligible SRS `HARD`, `GOOD` or `EASY` for a USER/Vocabulary without an existing `SRS_INITIAL` reward awards 3 XP.
- **BR-10:** Earlier accepted `AGAIN` events do not consume initial SRS eligibility.
- **BR-11:** The initial reward may be earned after Quiz activity or on pre-existing Progress under Policy A.
- **BR-12:** After `SRS_INITIAL` exists, no Set, session, restart, event ID or later passing rating may award it again.

### 6.3 Quiz First-Correct Reward

- **BR-13:** The first accepted correct `MULTIPLE_CHOICE` Quiz answer for a USER/Vocabulary without `QUIZ_FIRST_CORRECT` awards 3 XP.
- **BR-14:** Incorrect answers award zero and do not consume first-correct eligibility.
- **BR-15:** SRS rewards do not consume Quiz first-correct eligibility, and Quiz rewards do not consume initial SRS eligibility.
- **BR-16:** Fresh Quiz runs, batch retry, full restart, different Set membership and different valid event IDs cannot award a second Quiz first-correct reward.

### 6.4 Due SRS Review Reward

- **BR-17:** `SRS_DUE_REVIEW` requires an existing `SRS_INITIAL` reward for the same USER/Vocabulary.
- **BR-18:** The pre-event Progress must be stored `LEARNED`, have a complete supported SRS schedule and be genuinely due according to one Backend-owned accepted time.
- **BR-19:** The first accepted rating for that due Progress revision awards 1 XP for `AGAIN`, `HARD`, `GOOD` or `EASY`.
- **BR-20:** A due `AGAIN` earns its one due-cycle XP, changes Progress to immediately-due `LEARNING`, and every immediate same-session requeue earns zero.
- **BR-21:** `LEARNING`, future `LEARNED`, incomplete/legacy-unscheduled and otherwise non-due Progress cannot earn due-review XP.
- **BR-22:** A later genuine due cycle may earn another 1 XP only after Progress has returned to a scheduled `LEARNED` state and becomes due at a later revision.

For `SRS_DUE_REVIEW`, `reward_cycle` is the positive pre-event `LEARNING_PROGRESS.revision` of the accepted SRS command. Revision is the durable cycle identity only together with the full pre-event eligibility snapshot: the exact USER/Vocabulary identity, an existing `SRS_INITIAL` reward, stored `LEARNED` status, a complete supported schedule, and `next_review_at <= accepted_at` at the single Backend-owned acceptance time. Quiz revision increments may change the eventual cycle number but cannot award or consume due-review XP.

A due `AGAIN` consumes that eligible revision and transitions Progress to immediate `LEARNING`. That transition and its immediate requeues are ineligible for another due-review reward. A later due-review reward requires a subsequent SRS pass to establish a complete future schedule and that schedule to become genuinely due.

### 6.5 Legacy Policy A

- **BR-23:** Migration creates no reward rows and changes no existing `total_xp` balance.
- **BR-24:** Existing Progress is not treated as proof that either first reward was historically consumed.
- **BR-25:** After release, a USER/Vocabulary with historical Progress may independently earn its first post-release qualifying `SRS_INITIAL` and `QUIZ_FIRST_CORRECT` rewards.
- **BR-26:** Historical `review_count`, status, timestamps and SRS fields never generate XP without a new accepted qualifying event.
- **BR-27:** A legacy `NEEDS_REVIEW` or unscheduled/legacy-compatible Progress row without `SRS_INITIAL` earns zero for `AGAIN` and 3 XP for its first later accepted `HARD`, `GOOD` or `EASY`; it cannot earn due-review XP before `SRS_INITIAL` exists and a complete subsequent schedule becomes genuinely due.
- **BR-28:** Quiz-created unscheduled `LEARNED` Progress follows the same rule: Quiz may award its independent 3 XP; first SRS `AGAIN` earns zero; first SRS `HARD`/`GOOD`/`EASY` earns initial SRS 3 XP and establishes the SRS schedule.

## 7. Level Contract

- Level is calculated only by a shared Backend business function from authoritative `total_xp`.
- Level is the highest threshold less than or equal to `total_xp`.
- Level starts at 1 and is capped at 15.
- XP continues increasing without a Level-based cap.
- Level does not unlock, lock or authorize content.

| Level | Minimum total XP |
|---:|---:|
| 1 | 0 |
| 2 | 50 |
| 3 | 150 |
| 4 | 300 |
| 5 | 500 |
| 6 | 750 |
| 7 | 1,050 |
| 8 | 1,400 |
| 9 | 1,800 |
| 10 | 2,250 |
| 11 | 2,750 |
| 12 | 3,300 |
| 13 | 3,900 |
| 14 | 4,550 |
| 15 | 5,250 |

For Level `L`, the approved thresholds follow `25 × L × (L − 1)`. At Level 15, `next_level_xp` is `null` and the UI displays `Level 15 — MAX`.

## 8. Data Requirements

### 8.1 `XP_REWARD`

V1 requires one append-only durable reward-deduplication entity with:

- UUID `id`.
- `user_id` referencing the rewarded USER.
- `vocabulary_id` referencing the exact Vocabulary.
- enum `reward_type`: `SRS_INITIAL`, `QUIZ_FIRST_CORRECT` or `SRS_DUE_REVIEW`.
- integer `reward_cycle`.
- UUID `source_event_id`.
- positive integer `xp_amount`.
- immutable `created_at`.

Required database guarantees:

1. Unique `(user_id, vocabulary_id, reward_type, reward_cycle)`.
2. Unique `(user_id, source_event_id)` for positive reward events.
3. Initial SRS and Quiz rewards use cycle `0` and amount `3`.
4. Due-review rewards use a positive pre-event Progress revision and amount `1`.
5. `XP_REWARD.user_id` references `USER.id` with `ON DELETE RESTRICT`, consistent with the current USER lifecycle and other durable USER-owned learning data.
6. `XP_REWARD.vocabulary_id` references `VOCABULARY.id` with `ON DELETE RESTRICT`, preserving exact Vocabulary UUID reward identity and remaining consistent with the existing restrictive Learning Progress relationship.
7. Application behavior exposes no update/delete reward command.

`XP_REWARD` stores only awarded positive XP. Zero-XP events create no reward row and retain the existing Progress `last_event_id` and revision behavior for immediate retry and concurrency safety. `XP_REWARD` is internal deduplication evidence, not a V1 XP-history product surface. Its aggregate sum is not declared equal to `USER.total_xp`, because Policy A preserves possible pre-existing balances without backfill.

### 8.2 Existing Entities

- `USER.total_xp` remains the authoritative balance and is incremented atomically.
- Level remains derived and is not added to `USER` or a `LEVEL` table.
- Existing `LEARNING_PROGRESS.revision` remains the due-cycle identity and concurrency boundary.
- Existing `last_event_id` remains the immediate-current-event retry boundary.
- No Daily Progress, Streak or Achievement entity is added by this feature.
- XP & Level V1 adds no USER account deletion or USER-private Vocabulary hard-delete behavior.

## 9. Transaction, Idempotency and Concurrency

### 9.1 SRS Transaction

The existing authorized SRS transaction must:

1. Revalidate USER, Set access and exact current membership.
2. Read current Progress and applicable rewards inside the transaction.
3. Detect the immediate current `event_id` replay before mutation.
4. Validate eligibility and `expected_revision` against the same current pre-event Progress state.
5. Derive the Progress transition, complete reward-eligibility snapshot and reward cycle at one Backend-owned time.
6. Create/update Progress with its revision increment.
7. Insert the positive reward when eligible.
8. Atomically increment `USER.total_xp` only when a new reward row was inserted.
9. Return Progress and authoritative reward/Level projection only after the transaction commits.

The eligibility snapshot and `reward_cycle` must come from the same transactionally current pre-event Progress used for `expected_revision` validation. Progress mutation, unique reward insertion and conditional atomic `USER.total_xp` increment form one transaction. A stale or losing command performs none of those mutations; any later failure rolls all of them back.

### 9.2 Quiz Transaction

The existing authoritative Quiz transaction must retain Set/membership authorization, deterministic question reconstruction, question revision validation and Backend grading, then update Progress, insert `QUIZ_FIRST_CORRECT` when eligible and increment `total_xp` within the same transaction.

### 9.3 Duplicate and Conflict Rules

- **BR-29:** An immediate replay of the current accepted `event_id` mutates neither Progress, reward nor XP.
- **BR-30:** Immediate replay returns the original event `xp_earned`, current authoritative total/Level and `replayed: true`; the original response uses `replayed: false`. The current balance is not promised to equal the balance in the original response if other rewards have since committed.
- **BR-31:** Frontend reward celebration occurs only when `xp_earned > 0` and `replayed` is false.
- **BR-32:** A delayed/reordered different event with a stale revision retains the existing safe conflict behavior and creates no reward.
- **BR-33:** Arbitrary historical response replay is not promised.
- **BR-34:** Concurrent commands from the same Progress revision allow at most one Progress transition. Losing commands conflict and create no reward.
- **BR-35:** Concurrent valid rewards for different Vocabulary IDs use atomic increments and must accumulate without lost updates.
- **BR-36:** A reward uniqueness collision can never be followed by another XP increment.
- **BR-37:** Any failure in Progress mutation, reward insertion or XP increment rolls back the entire transaction.

## 10. API Contract

### 10.1 Existing Mutation Endpoints

No separate public reward-write endpoint is added. These existing USER-only commands become the only V1 reward sources:

- `POST /api/learning/events`
- `POST /api/quiz/answers`

Their existing request bodies remain unchanged. The successful response retains its existing Progress/Quiz fields and adds:

```json
{
  "reward": {
    "source_event_id": "uuid",
    "xp_earned": 3,
    "replayed": false,
    "total_xp": 150,
    "level": 3,
    "level_min_xp": 150,
    "next_level_xp": 300,
    "is_max_level": false
  }
}
```

Rules:

- `xp_earned` is `0`, `1` or `3`.
- `source_event_id` echoes the validated event identity.
- `total_xp` and Level fields are authoritative after the accepted transaction.
- Immediate duplicate replay returns the original event's `xp_earned`, sets `replayed: true`, and reports the current authoritative total/Level without adding XP again. It does not promise the original response's historical balance after other rewards have committed.
- Conflict/error responses contain no success reward projection.
- Reward ID, reward type, reward cycle and internal deduplication fields are not exposed.

### 10.2 XP/Level Read Projection

The Backend must expose a shared authenticated USER-only read projection containing:

```json
{
  "total_xp": 150,
  "level": 3,
  "level_min_xp": 150,
  "next_level_xp": 300,
  "is_max_level": false
}
```

PLAN must prefer extending the existing authenticated identity/profile contract when it can do so without duplicating requests; otherwise it may define one minimal read endpoint. The final choice must be reflected consistently in `API_SPEC.md` and used by Dashboard. No client-supplied USER ID is accepted.

## 11. Dashboard and Frontend Contract

- The authenticated USER Dashboard adds a compact XP/Level summary using the Backend projection.
- It displays total XP, current Level and progress between `level_min_xp` and `next_level_xp`.
- At Level 15 it displays `Level 15 — MAX` and no next-level target.
- It does not display Streak, Daily Goal, Achievement, leaderboard, reward history or fake metrics.
- Dashboard reads never create Progress, rewards or XP.
- ADMIN retains the existing neutral Dashboard and must not call the USER XP/Level read contract.
- The Frontend may calculate only presentation width from Backend-provided bounds; it must not contain the authoritative threshold table or determine Level.
- SRS and Quiz may display concise successful XP feedback from the mutation response. Zero-XP and replay responses do not produce duplicate reward celebration.
- Existing Progress, Quiz feedback, retry, conflict, focus, keyboard, responsive and reduced-motion behavior remains intact.

## 12. Migration and Retention

- Add the `XP_REWARD` entity, enum, foreign keys, unique constraints, checks and necessary indexes in one forward-only migration.
- Generate no reward rows and add no XP during migration.
- Preserve every existing `USER.total_xp` value exactly.
- Do not infer rewards from historical Progress, status, timestamps or `review_count`.
- Migration must be safe with existing USER, Vocabulary and Progress rows.
- Reward rows are durable anti-farming evidence and are not deleted merely because a Vocabulary is removed from a Set, a Set is deleted, a session restarts or Progress presentation changes.
- Removing a Vocabulary from a Set, including its final Set membership, deletes only the Set membership. It does not delete the Vocabulary, Learning Progress or XP reward records. Deleting a Set likewise does not delete Vocabulary, Progress or rewards.
- `XP_REWARD.user_id` and `XP_REWARD.vocabulary_id` both use `ON DELETE RESTRICT`. XP & Level V1 preserves the current USER lifecycle and existing Vocabulary deletion contract rather than introducing cascade deletion.
- XP & Level V1 adds no USER-private Vocabulary hard-delete operation. Existing ADMIN canonical Vocabulary deletion remains available only where durable external references do not restrict it.
- Future account deletion, Vocabulary hard deletion, anonymization or different retention behavior requires a separate approved contract.
- Before adding `CHECK (total_xp >= 0)`, a guarded read-only preflight must confirm that every target-environment balance is nonnegative. If any negative balance exists, migration work stops for HUMAN review and must not clamp, rewrite or otherwise repair data silently.
- No destructive migration, XP recalculation or broad database reset is permitted.

## 13. Security and Privacy

- USER identity comes only from authenticated Backend context.
- USER cannot read or mutate another USER's balance or reward state.
- ADMIN cannot use learner mutation endpoints to earn XP.
- XP amount, reward type, Level and thresholds are not accepted from the client.
- Reward persistence contains identifiers, amount and timestamp only; it stores no answer label, transcript, audio, confidence, pronunciation result or sensitive credential.
- Error responses follow existing safe contracts and expose no internal uniqueness or database details.

## 14. Acceptance Criteria

- **AC-01:** Only an authenticated USER can earn or read USER XP/Level; Guest and ADMIN cannot earn XP.
- **AC-02:** First accepted SRS `HARD`, `GOOD` or `EASY` awards exactly 3 XP when no `SRS_INITIAL` reward exists.
- **AC-03:** One or more earlier SRS `AGAIN` events award zero and preserve initial SRS eligibility.
- **AC-04:** After initial SRS reward, no later Set, session, passing rating or event ID can award it again.
- **AC-05:** First correct Quiz answer awards exactly 3 XP; incorrect answers award zero and preserve first-correct eligibility.
- **AC-06:** SRS and Quiz first rewards are independent and may each be awarded once for the same USER/Vocabulary in either order.
- **AC-07:** A stored `LEARNED` Progress row with an existing `SRS_INITIAL`, a complete supported schedule and `next_review_at <= accepted_at` awards exactly 1 XP once for its pre-event revision for every accepted SRS rating, including `AGAIN`.
- **AC-08:** An immediate `LEARNING` requeue, future learned item, legacy-unscheduled item without initial reward, NORMAL activity and Speaking activity award zero XP.
- **AC-09:** A due `AGAIN` earns at most one due-cycle reward; subsequent same-session requeues earn zero.
- **AC-10:** Fresh Quiz runs, alternate Sets containing the same Vocabulary UUID, duplicate requests and concurrent commands cannot duplicate any reward.
- **AC-11:** Distinct private Vocabulary UUIDs with identical headwords retain independent reward eligibility.
- **AC-12:** Progress, reward and total XP commit atomically; any failure rolls back all three.
- **AC-13:** Immediate duplicate event replay adds zero XP, returns original `xp_earned`, sets `replayed: true` and cannot repeat frontend celebration.
- **AC-14:** Stale revisions and losing concurrent commands return existing safe conflicts with no reward or XP mutation.
- **AC-15:** Concurrent valid rewards for different Vocabulary IDs accumulate without a lost update.
- **AC-16:** Migration preserves existing balances and creates no historical reward or retroactive XP.
- **AC-17:** After release, existing Progress may earn each first post-release reward according to Policy A without using `review_count` as reward evidence.
- **AC-18:** Level is backend-derived according to the approved table, starts at 1, reaches Level 15 at 5,250 XP and remains 15 while XP continues increasing.
- **AC-19:** Dashboard shows only authenticated USER authoritative XP/Level data, uses MAX behavior at Level 15 and never mutates reward state.
- **AC-20:** Frontend contains no authoritative XP amount, eligibility or Level threshold calculation.
- **AC-21:** Database uniqueness enforces initial/due reward identities and positive event identity independent of frontend state.
- **AC-22:** Reward rows are retained across Set membership/removal, Set deletion, reload, restart and session cleanup.
- **AC-23:** No Streak, Daily Goal, Achievement, leaderboard, XP-history UI or additional reward source is introduced.
- **AC-24:** Focused unit, authorization, migration, transaction, rollback, idempotency, concurrency, API, Dashboard and affected SRS/Quiz regression tests pass in their approved environments.
- **AC-25:** Both reward foreign keys use `ON DELETE RESTRICT`; Set membership removal remains membership-only, existing authorized deletion behavior is not broadened, and no account or private-Vocabulary deletion flow is added.
- **AC-26:** The nonnegative `total_xp` database check is added only after a guarded read-only preflight succeeds; any negative target balance stops migration work without automatic data modification.

## 15. Required Test Categories

- Pure Level threshold boundaries, below/at/above Level 15 and invalid defensive inputs.
- Complete SRS and Quiz reward eligibility matrix.
- Legacy Policy A, legacy `NEEDS_REVIEW`, unscheduled Progress and Quiz-before-SRS behavior.
- Same event retry, stale revision, different event IDs and fresh Quiz runs.
- Same Vocabulary through multiple Sets and identical-headword distinct private Vocabulary.
- Same-revision concurrency, cross-source SRS/Quiz races and different-Vocabulary atomic accumulation.
- Transaction rollback at Progress, reward and USER XP write boundaries.
- Migration apply/parity, exact no-backfill behavior, constraints, foreign keys and preserved balances.
- Guarded nonnegative-balance preflight success and stop-without-modification behavior when a negative fixture exists.
- USER isolation, Guest/ADMIN rejection and client-field rejection.
- API response/replay projection and no internal reward-field exposure.
- Dashboard loading/success/error/MAX, keyboard, focus, responsive and reduced-motion behavior.
- SRS scheduling, Quiz authoritative grading, Learning Progress, Dashboard, Auth and Speaking/NORMAL zero-XP regressions.

Database-backed and concurrency verification must use an isolated guarded TEST database. Production/Main/Preview data is not a test target.

## 16. Dependencies and Impact

- **Database:** one new durable reward entity and enum; existing USER and Vocabulary relations; no Level column/table.
- **Backend:** shared Level calculation, reward eligibility/persistence, atomic USER increment, SRS/Quiz transaction extension and USER read projection.
- **API:** additive reward projection on existing SRS/Quiz success responses and one reusable USER XP/Level read projection.
- **Frontend:** SRS/Quiz feedback consumption and USER Dashboard XP/Level summary; no authoritative calculations.
- **Documentation:** synchronize PROJECT_OVERVIEW, DATABASE, API_SPEC, UI_UX_SPEC and FEATURE_STATUS only after approved implementation evidence.
- **Unchanged:** authentication architecture, role model, SRS scheduler, Quiz type, Speaking architecture and Learning Session persistence boundary.

## 17. Decision Table

| Topic | Draft decision | Status |
|---|---|---|
| Legacy cutover | Policy A: no backfill; first post-release qualifying rewards remain available | HUMAN APPROVED |
| SRS initial `AGAIN` | 0 XP; eligibility preserved | HUMAN APPROVED |
| SRS initial pass | First `HARD`/`GOOD`/`EASY` = 3 XP | HUMAN APPROVED |
| Quiz first correct | 3 XP, independent of SRS | HUMAN APPROVED |
| Due review | 1 XP once per genuinely due cycle, including due `AGAIN` | HUMAN APPROVED |
| Immediate requeue | 0 XP | HUMAN APPROVED |
| Identity | Exact USER/Vocabulary UUID; Set and spelling are not identity | HUMAN APPROVED |
| Levels | Levels 1–15; Level 15 at 5,250; XP continues | HUMAN APPROVED |
| Persistence | One internal append-only positive-reward deduplication table with database uniqueness | HUMAN APPROVED |
| Duplicate response | Original `xp_earned`, current totals, `replayed: true`; no new XP | HUMAN APPROVED |
| Legacy `NEEDS_REVIEW` | No due XP before initial reward; `AGAIN` 0, first later pass 3 | HUMAN APPROVED |
| Quiz-created unscheduled Progress | Quiz reward independent; first SRS pass 3; due XP only after a later complete schedule becomes due | HUMAN APPROVED |
| Due-review identity | Pre-event Progress revision plus the complete pre-event eligibility snapshot | HUMAN APPROVED |
| Retention | USER and Vocabulary reward references both `RESTRICT`; Set removal remains membership-only | HUMAN APPROVED |
| Dashboard | Compact USER XP/Level summary and optional concise reward feedback; ADMIN unchanged | HUMAN APPROVED |
| Nonnegative XP constraint | Add only after guarded read-only preflight; stop on any negative balance without modifying data | HUMAN APPROVED |
| Daily Goal | Future independent XP source | HUMAN APPROVED DEFERRED |

## 18. Open Questions

None. All XP & Level V1 business and technical contracts in this SPEC are HUMAN-approved. PLAN must not begin until HUMAN completes final review and explicitly approves this SPEC as a whole.
