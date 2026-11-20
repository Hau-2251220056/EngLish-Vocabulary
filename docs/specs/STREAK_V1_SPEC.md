# SPEC: Streak V1

**Feature status:** `TODO`

**SPEC status:** `HUMAN APPROVED`

**Baseline:** `origin/dev` at `e3f5dd18193fbfee23c1ea5cdc2aa3fdee150e59`

**Implementation authorized:** `NO`

## 1. Objective

Streak V1 records consecutive application calendar days on which an authenticated `USER` completes at least one trustworthy qualifying learning session. It extends the existing NORMAL Flashcard, SRS and Multiple Choice Quiz flows without changing their approved learning, scheduling, grading or XP rules.

The Backend is authoritative for session identity, session membership, accepted completion evidence, completion time, calendar-day assignment and Streak projection. Frontend navigation, `sessionStorage`, result screens and client-supplied dates are never sufficient evidence for a Streak day.

## 2. Existing Context and Reconciliation

- Streak and Streak Summary are currently `TODO`.
- NORMAL, SRS and Quiz already use transient, same-tab run state with groups of at most 10 distinct Vocabulary IDs.
- No persistent Learning Session, Quiz Session, answer history, completion ledger or Streak entity currently exists.
- NORMAL currently creates no Backend mutation. Its completion and reveal state are frontend-only.
- SRS persists each accepted rating through `LEARNING_PROGRESS`, but has no durable session identity or authoritative initial-queue record.
- Quiz persists Progress for every accepted correct or incorrect answer, but its `run_id`, accepted-answer collection and completion result are frontend-only.
- `LEARNING_PROGRESS.last_event_id` retains only the latest event for a USER/Vocabulary and cannot prove a complete session.
- `XP_REWARD` is intentionally sparse and cannot prove NORMAL completion, zero-correct Quiz completion or all SRS queue resolutions.
- XP & Level V1 is `DONE`. Streak is independent and must not reinterpret, backfill or alter XP rewards.
- Existing deferred Streak text that includes Speaking Practice or broad unspecified learning activity is superseded for this feature by the exact qualifying modes in this SPEC after HUMAN approval and later documentation synchronization.

### 2.1 HUMAN-Approved Architecture Decisions

The following decisions are approved requirements for this SPEC amendment:

1. **NORMAL reveal evidence — HUMAN APPROVED:** The Backend records an authenticated reveal acknowledgement for every card in a valid NORMAL session. All cards must be acknowledged and the USER must explicitly complete the session. This is interaction evidence only, not proof of attention or retention; V1 adds no camera monitoring, minimum viewing duration or unrelated anti-cheating mechanism.
2. **Persistence boundary — HUMAN APPROVED:** V1 uses three conceptual data groups: Learning Session for ownership/snapshot/lifecycle/expiry, Session Item for per-item evidence/completion, and Streak Day for durable USER/calendar-date qualification. Exact Prisma models, fields, relations, indexes and constraints belong to PLAN.
3. **API boundary — HUMAN APPROVED:** V1 introduces Backend-managed learning-session APIs, associates qualifying SRS ratings and Quiz answers with valid sessions, and adds NORMAL reveal and explicit completion operations. Exact routes and payload schemas belong to PLAN.
4. **Legacy compatibility — HUMAN APPROVED:** Existing sessionless SRS/Quiz requests remain supported, retain existing Progress/XP behavior and create no Streak qualification. Removing that compatibility requires separate HUMAN approval.

## 3. Actors and Authorization

- **USER:** May create, resume and complete only their own qualifying sessions for an accessible public System Set or owned private Set, and may read only their own Streak.
- **Guest:** Cannot create or mutate a qualifying session and cannot read USER Streak state.
- **ADMIN:** Does not receive USER learning sessions or USER Streak state in V1. The neutral ADMIN Dashboard remains unchanged.

Authentication and `USER` role authorization are enforced by the Backend. The request body cannot select a different owner, completion date, Streak value or timezone.

## 4. Terminology

- **Application day:** A calendar date in `Asia/Ho_Chi_Minh` (UTC+7), derived from a Backend-authoritative instant.
- **Qualifying session:** One server-owned NORMAL, SRS or Quiz group containing at most 10 distinct Vocabulary IDs.
- **Session snapshot:** The immutable ordered Vocabulary identity set authored by the Backend when the session is created.
- **Completion evidence:** Backend-accepted, session-bound evidence required for every item in the snapshot.
- **Completion instant:** The Backend time at which all mode requirements and any explicit completion requirement are accepted transactionally.
- **Streak day:** One durable record that a USER completed at least one qualifying session on an application day.
- **Current Streak:** Consecutive Streak days ending today, or ending yesterday when today is not yet complete. It is `0` when neither today nor yesterday is a Streak day.
- **Replay:** Re-submission of an already accepted event or terminal completion identity.
- **Genuinely new session:** A newly Backend-created immutable session identity; reopening or restoring an earlier completed session is not new.

## 5. Scope

### 5.1 In Scope

- USER-only qualifying sessions for NORMAL Flashcard, SRS and Multiple Choice Quiz.
- Backend-owned session identities and authoritative snapshots of at most 10 distinct Vocabulary IDs.
- Per-item evidence sufficient to establish mode-specific completion.
- A maximum session lifetime of exactly `7 × 24 hours` from Backend creation.
- Atomic session completion and durable daily Streak recording.
- `Asia/Ho_Chi_Minh` day assignment from Backend completion acceptance time.
- Current Streak, last qualifying date and today-completed read projection.
- A small functional USER Dashboard Streak card with accessible loading, success and error behavior.
- Idempotency, concurrency and replay protection.
- Additive migration with no historical backfill.
- Compatibility with existing Progress, SRS scheduling, Quiz grading and XP rules.

### 5.2 Out of Scope

- Speaking Practice, login, page views, browsing, opening an activity or abandoning an unfinished session as qualifying activity.
- Daily Goal, Daily Goal bonus, Achievement, leaderboard, ranking or social comparison.
- Streak Freeze, grace days, repair, purchase, manual adjustment or admin editing.
- Monday–Sunday activity calendar, heat map, detailed activity history or analytics timeline.
- XP changes, new XP sources or coupling Streak qualification to positive XP.
- New Quiz types or changes to authoritative grading.
- SRS scheduler, interval, rating or XP reward changes.
- Cross-device restoration of the existing frontend presentation cursor.
- Proving through biometric or surveillance mechanisms that a human visually perceived Flashcard content.
- Retrospective Streak awards from historical XP, Progress or timestamps.
- Redesign of the existing Level/XP Dashboard card or final three-card Dashboard polish.

## 6. Approved Business Rules

### 6.1 General

- **BR-ST-001:** Only an authenticated `USER` may earn Streak.
- **BR-ST-002:** Exactly three modes qualify: NORMAL Flashcard, SRS Flashcard and Multiple Choice Quiz.
- **BR-ST-003:** A session qualifies only after its complete server-owned snapshot satisfies the applicable mode contract.
- **BR-ST-004:** Unfinished, failed, abandoned, expired or inaccessible sessions do not qualify.
- **BR-ST-005:** Speaking Practice, login, browsing, Set/detail viewing and opening an activity do not qualify.
- **BR-ST-006:** XP and Streak are independent. Positive XP is neither required nor sufficient for a Streak day.
- **BR-ST-007:** At most one Streak day exists per USER/application day, regardless of the number or type of completed sessions.
- **BR-ST-008:** No Streak Freeze exists in V1.

### 6.2 NORMAL Completion

- **BR-ST-009:** One NORMAL group contains at most 10 distinct Backend-authorized Vocabulary IDs in Set Item order.
- **BR-ST-010:** Every card in the group must have a Backend-accepted back-reveal acknowledgement for that session.
- **BR-ST-011:** Navigation to, or display of, the final card is insufficient.
- **BR-ST-012:** After all reveal acknowledgements exist, the USER must explicitly request session completion.
- **BR-ST-013:** NORMAL completion awards no XP and creates no Learning Progress mutation.
- **BR-ST-014:** Reopening a completed NORMAL screen or replaying its completion cannot create another session or another Streak day.

### 6.3 SRS Completion

- **BR-ST-015:** The Backend authors the immutable initial queue from at most 10 distinct items that are eligible at session creation under the existing SRS order.
- **BR-ST-016:** Every initial item begins unresolved.
- **BR-ST-017:** An accepted `AGAIN` remains unresolved and follows the existing requeue behavior.
- **BR-ST-018:** An item resolves only after an accepted `HARD`, `GOOD` or `EASY` associated with the same session.
- **BR-ST-019:** The session completes only after every initial item is resolved.
- **BR-ST-020:** Items that become due after snapshot creation do not enter the active session.
- **BR-ST-021:** Existing Progress, scheduling, optimistic revision, event retry and XP rules remain unchanged.
- **BR-ST-022:** A non-empty Set with no eligible SRS item is up to date, not a completed qualifying session, and creates no Streak day.

### 6.4 Quiz Completion

- **BR-ST-023:** One Quiz session contains at most 10 distinct Backend-authorized questions in current group order.
- **BR-ST-024:** Every snapshot question must receive one Backend-accepted answer associated with the session.
- **BR-ST-025:** Correct and incorrect accepted answers both count as completed questions.
- **BR-ST-026:** A completed zero-correct Quiz qualifies.
- **BR-ST-027:** Existing grading, question revision, choice validation, Progress mutation and XP deduplication remain authoritative and unchanged.
- **BR-ST-028:** Reopening or restoring a previous result screen cannot create a new completion.
- **BR-ST-029:** Retrying a completed group can qualify on a later application day only through a genuinely new Backend-created session with fresh question/run identity.

### 6.5 Calendar Day and Streak Calculation

- **BR-ST-030:** Application timezone is `Asia/Ho_Chi_Minh` (UTC+7).
- **BR-ST-031:** The qualifying date is calculated from Backend completion acceptance time. The Backend accepts no client date or timezone for awarding Streak.
- **BR-ST-032:** A USER with no qualifying day has current Streak `0`.
- **BR-ST-033:** The first qualifying day produces current Streak `1`.
- **BR-ST-034:** Consecutive application days increase current Streak by one per day.
- **BR-ST-035:** Multiple completions on one application day do not increment current Streak repeatedly.
- **BR-ST-036:** If today is incomplete but yesterday belongs to the active consecutive sequence, current Streak retains that sequence value.
- **BR-ST-037:** After one full missed application day, current Streak reads `0` until another qualifying completion starts a new sequence at `1`.
- **BR-ST-038:** Breaking current Streak does not delete retained qualifying-day records.

### 6.6 Session Lifetime

- **BR-ST-039:** Session creation and expiry instants are Backend-authored.
- **BR-ST-040:** A session is valid only while `accepted_at < created_at + 7 × 24 hours`; equality with the expiry instant is expired.
- **BR-ST-041:** Unfinished sessions may be resumed across application-day boundaries while valid.
- **BR-ST-042:** A valid session qualifies only on its Backend-confirmed completion day, never its creation day.
- **BR-ST-043:** An expired unfinished session cannot accept further qualifying evidence or completion; the USER must start a new session.
- **BR-ST-044:** Expiration never deletes or reverses previously committed Learning Progress, SRS scheduling or XP.
- **BR-ST-045:** Independent sessions may coexist across tabs. Each has an immutable server-owned UUID and independent snapshot.
- **BR-ST-046:** Concurrent completion attempts are idempotent and cannot create duplicate session completion or Streak days.

## 7. Mode Flows and Completion Contracts

### 7.1 Session Creation

1. The authenticated USER enters NORMAL, SRS or Quiz for an accessible Set.
2. The Frontend requests a Backend-owned qualifying session for the exact mode and Set.
3. The Backend validates role, Set access, Set membership and mode-specific eligibility.
4. The Backend creates an immutable session identity, creation/expiry instants and bounded snapshot.
5. The Frontend stores only the returned identity and presentation state in its existing mode-owned `sessionStorage` namespace.
6. Re-entry uses fresh Backend authorization and reads session state before trusting local presentation state.

An empty NORMAL/Quiz Set or an SRS up-to-date result does not create a qualifying completed session.

### 7.2 NORMAL

1. Reveal of a card submits an idempotent acknowledgement bound to session and Vocabulary identity.
2. Backend accepts it only for an active, unexpired session item in the authoritative snapshot.
3. Revealing the same item again is a successful no-op.
4. Navigation remains frontend presentation behavior and does not itself qualify.
5. Explicit completion succeeds only after all snapshot items have accepted reveal evidence.
6. Completion and daily Streak insertion commit atomically.

**HUMAN-approved practical trust boundary:** Backend-recorded reveal acknowledgement proves that the authenticated client requested the reveal transition for the correct server-owned item. It cannot prove human attention, minimum viewing time, retention or perception. V1 must not add camera monitoring or other invasive/unrelated anti-cheating mechanisms to claim otherwise.

### 7.3 SRS

1. Every existing rating submission includes the server session identity.
2. The Backend validates that the Vocabulary is unresolved in that session and continues to apply existing eligibility/revision checks.
3. The Progress/XP transaction and session-item evidence update commit atomically.
4. `AGAIN` records the accepted event association but leaves the item unresolved.
5. `HARD`, `GOOD` or `EASY` resolves the item.
6. The final resolving rating atomically completes the session and attempts daily Streak insertion.
7. Same-event replay returns the original authoritative outcome and current Streak projection without another mutation.

### 7.4 Quiz

1. Questions are generated only for the server session snapshot and use the session's authoritative run identity.
2. Every existing answer submission includes the server session identity.
3. Existing reconstruction, correctness and Progress/XP behavior executes first within the same transaction boundary.
4. The accepted result records the corresponding session item as answered, including when incorrect.
5. The final distinct accepted answer atomically completes the session and attempts daily Streak insertion.
6. Same-event replay does not answer another item or complete another session.
7. Retry-current-group begins a genuinely new Backend session and obtains fresh questions/revisions; the previous completed session remains immutable.

## 8. Backend Session Lifecycle

### 8.1 Effective States

- `ACTIVE`: Created, unexpired and incomplete.
- `COMPLETED`: All required evidence was accepted and the terminal completion instant is immutable.
- `EXPIRED`: Incomplete and Backend time is at or after `expires_at`.

### 8.2 Allowed Transitions

```text
CREATE → ACTIVE

ACTIVE → ACTIVE
  accepted non-terminal evidence or idempotent replay

ACTIVE → COMPLETED
  final required evidence, plus explicit NORMAL completion where applicable

ACTIVE → EXPIRED
  authoritative time reaches expires_at before completion

COMPLETED → COMPLETED
  read or exact replay only

EXPIRED → EXPIRED
  read/rejection only
```

No transition reopens, rewrites or extends a completed or expired session. Starting again creates a new identity.

Set deletion, loss of access or removal of a snapshot item prevents further mutation and completion. V1 does not shrink the authoritative denominator to manufacture completion.

## 9. Persistence and Integrity Requirements

### 9.1 Required Durable Concepts

**HUMAN-approved conceptual persistence boundary:** The eventual PLAN must provide the smallest relational representation that satisfies exactly these three data groups. Exact Prisma models, relations, indexes and constraints remain PLAN-stage design:

1. **Qualifying session**
   - immutable UUID;
   - USER owner and Set identity;
   - exact mode;
   - lifecycle status;
   - Backend `created_at`, `expires_at` and nullable immutable `completed_at`;
   - authoritative ordered snapshot/fingerprint;
   - mode/run identity where required.

2. **Session item evidence**
   - unique `(session_id, vocabulary_id)` identity and authoritative ordinal;
   - mode-appropriate state: NORMAL revealed, SRS unresolved/resolved, Quiz unanswered/answered;
   - accepted source event identity where applicable;
   - no transcript, audio, general analytics or unrelated history.

3. **Streak day ledger**
   - USER identity;
   - application `DATE`;
   - first qualifying session identity and authoritative creation instant;
   - unique `(user_id, activity_date)` constraint.

### 9.2 Integrity

- Session owner, mode, Set and snapshot cannot be supplied as trusted state after creation.
- Every item belongs to the session snapshot and is unique within it.
- Session completion is terminal and occurs at most once.
- Daily insertion uses database uniqueness rather than read-then-write alone.
- Existing SRS/Quiz Progress mutation, positive XP reward, session evidence, terminal completion and new Streak day commit atomically where the final event is involved.
- NORMAL evidence/completion and new Streak day commit atomically at terminal completion.
- Transaction rollback leaves no partial completion or daily award.
- Deleting referenced USER, Set or Vocabulary data must not silently erase retained proof; exact FK deletion policy is a PLAN decision.

### 9.3 No Backfill

- Migration creates no historical sessions or Streak days.
- Existing `LEARNING_PROGRESS`, `XP_REWARD`, `last_reviewed_at`, `created_at` or `USER.total_xp` values are not interpreted as completed sessions.
- All USER accounts begin with Streak `0` until a post-deployment qualifying session completes.

## 10. Idempotency, Replay and Concurrency

- Every session mutation uses a UUID event/operation identity scoped to the authenticated USER and session.
- Exact replay returns the already accepted projection without extending expiry, changing completion date or adding a Streak day.
- Reusing an event identity with a different session, item, mode or payload is rejected as conflict.
- Two terminal requests for one session produce one immutable completion.
- Two different sessions completing concurrently on the same USER/day may both become completed sessions but create only one Streak day.
- Concurrent sessions cannot submit evidence for one another.
- Existing SRS/Quiz revision conflicts remain authoritative and cannot be bypassed by session state.
- Server transaction time determines whether an attempt precedes expiry and which application day receives completion.

## 11. Streak Projection

Given durable Streak dates and Backend `now` converted to `Asia/Ho_Chi_Minh`:

1. `completed_today` is true exactly when today's ledger row exists.
2. If today exists, current Streak is the consecutive sequence ending today.
3. Otherwise, if yesterday exists, current Streak is the consecutive sequence ending yesterday.
4. Otherwise current Streak is `0`.
5. `last_qualified_date` is the latest ledger date or `null`.

The projection must not depend on the Frontend clock. A read does not create, update or reset rows merely because a day was missed.

## 12. API Requirements

Backend-managed learning-session APIs and their integration with qualifying SRS/Quiz mutations are **HUMAN APPROVED**. The exact routing and payload examples below remain proposed PLAN-stage shapes and may be refined without changing approved behavior.

### 12.1 Create Session

`POST /api/learning-sessions`

Authenticated role: `USER` only.

Request:

```json
{
  "set_id": "uuid",
  "mode": "NORMAL | SRS | QUIZ",
  "operation_id": "uuid"
}
```

Response includes only authoritative session identity, mode, Set identity, ordered bounded Vocabulary identities, creation/expiry instants, effective state and mode data required by the existing flow. Creation replay with the same operation identity returns the same session.

### 12.2 NORMAL Reveal

`POST /api/learning-sessions/:sessionId/normal-reveals`

Request contains exact `event_id` and `vocabulary_id`; no completion date or reveal timestamp is accepted. Response returns accepted/replayed status and authoritative revealed/total count.

### 12.3 NORMAL Complete

`POST /api/learning-sessions/:sessionId/complete`

Request contains a terminal `operation_id` only. Completion succeeds only for an active unexpired NORMAL session with all items revealed. Response includes session completion and current Streak projection.

### 12.4 Existing SRS and Quiz Mutations

- Existing `POST /api/learning/events` adds required `session_id` association for Streak-participating SRS flow.
- Existing `POST /api/quiz/answers` adds required `session_id` association for Streak-participating Quiz flow.
- Existing request authority, validation and response behavior remain; response may add a `session`/`streak` projection after accepted terminal evidence.
- A sessionless legacy request preserves existing Progress/XP behavior but creates no session evidence and cannot qualify for Streak.
- Legacy sessionless SRS/Quiz compatibility remains supported throughout Streak V1 and cannot be removed without separate HUMAN approval.

### 12.5 Read Streak

`GET /api/users/me/streak`

Authenticated role: `USER` only.

Proposed response:

```json
{
  "success": true,
  "data": {
    "current_streak": 4,
    "completed_today": false,
    "last_qualified_date": "2026-10-16",
    "timezone": "Asia/Ho_Chi_Minh",
    "evaluated_at": "2026-10-17T03:00:00.000Z"
  }
}
```

The read is side-effect free and accepts no USER selector, date or timezone.

### 12.6 Error Outcomes

- `401 AUTHENTICATION_FAILED`: Missing/invalid session authentication.
- `403 FORBIDDEN`: Authenticated non-USER role.
- Concealed `404`: Session/Set is missing, inaccessible or belongs to another USER.
- `409 SESSION_EXPIRED`: The unfinished session is expired.
- `409 SESSION_ITEM_MISMATCH`: Item is not part of the authoritative snapshot.
- `409 SESSION_EVIDENCE_INCOMPLETE`: Explicit NORMAL completion lacks reveal evidence.
- `409 SESSION_EVENT_CONFLICT`: Event identity was reused with incompatible data.
- Existing SRS/Quiz validation, stale-item, question, choice and Progress conflict codes remain unchanged.

Exact replay of an already completed terminal operation is success, not a second award or a generic conflict.

## 13. Dashboard Integration

### 13.1 Scope

- Authenticated USER Dashboard adds one small functional Streak card.
- ADMIN Dashboard remains unchanged and performs no USER Streak request.
- The existing Level/XP card is not redesigned.
- No weekly calendar, Daily Goal card, history or decorative activity grid is added.

### 13.2 Required States

- New USER/no retained sequence: `0 ngày`.
- Active sequence ending yesterday, today incomplete: `N ngày` with truthful text indicating today is not yet complete.
- Today completed: `N ngày` with truthful completed-today state.
- Broken sequence after a missed full day: `0 ngày`.
- Loading, API failure and retry must not display fake `0` success data.

### 13.3 Accessibility and Responsiveness

- The card has a semantic heading/region and textual state independent of color or icon.
- Loading uses status semantics; failure uses an actionable error/retry pattern consistent with the current Dashboard.
- Current and today-completed meaning is announced without animation dependence.
- It remains usable without horizontal overflow on existing mobile, tablet and desktop Dashboard widths.
- Final `Level & XP | Streak | Daily Goal` single-row desktop polish remains deferred until Daily Goal implementation.

## 14. Security Requirements

- Backend authentication, USER authorization and Set access are mandatory for every session operation.
- Session identifiers are opaque UUIDs and never authorize access by themselves.
- Requests cannot provide owner, status, snapshot, Streak count, completion time, application date or timezone.
- Session lookup for another USER is concealed.
- NORMAL reveal acknowledgement is accepted only for an item in the server snapshot.
- SRS/Quiz evidence is recorded only after the existing authoritative mutation is accepted.
- Client `sessionStorage`, navigation position and completion UI are presentation state only.
- Safe errors expose no foreign USER/Set/session data.
- No new external service, browser tracking API or secret is introduced.

## 15. Compatibility Requirements

- Existing `LEARNING_PROGRESS` identity and SRS scheduler remain authoritative.
- Existing SRS/Quiz event idempotency and optimistic revision behavior remain intact.
- XP reward types, amounts, deduplication, `USER.total_xp` and Level projection remain unchanged.
- NORMAL remains zero-XP/read-only with respect to Learning Progress.
- Quiz incorrect answers continue to persist their approved Progress outcome and qualify toward session completion.
- Speaking Practice remains isolated and creates no session, Progress, XP or Streak effect.
- Existing same-tab presentation recovery may continue, but must reconcile against Backend session status and expiry.
- A completed Backend session remains completed even if local presentation storage is cleared; clearing storage cannot award it again.

## 16. Acceptance Criteria

- **AC-ST-01:** Guest and ADMIN cannot create, mutate or read USER Streak sessions/state; USER A cannot access USER B's session.
- **AC-ST-02:** The Backend creates immutable NORMAL, SRS and Quiz session identities containing at most 10 distinct authorized Vocabulary IDs.
- **AC-ST-03:** Login, browsing, Set viewing, activity entry and unfinished exit create no Streak day.
- **AC-ST-04:** Speaking Practice creates no qualifying session or Streak effect.
- **AC-ST-05:** NORMAL cannot complete until every snapshot card has a Backend-accepted reveal acknowledgement and explicit completion is requested.
- **AC-ST-06:** NORMAL navigation to the last card without revealing every card is rejected as incomplete.
- **AC-ST-07:** Repeated NORMAL reveal acknowledgement is idempotent and NORMAL completion awards no XP or Progress mutation.
- **AC-ST-08:** SRS initial queue is Backend-authored, bounded after existing eligibility/order and remains fixed for the session.
- **AC-ST-09:** Accepted SRS `AGAIN` keeps the item unresolved and cannot complete the session.
- **AC-ST-10:** SRS completes only after every initial item receives an accepted `HARD`, `GOOD` or `EASY` within the session.
- **AC-ST-11:** SRS Progress, schedule and XP outcomes are identical to the approved behavior with or without non-terminal Streak evidence.
- **AC-ST-12:** Quiz completes only after every snapshot question has one accepted answer associated with the session.
- **AC-ST-13:** Incorrect Quiz answers count toward completion, and a zero-correct completed group produces a qualifying session without inventing XP.
- **AC-ST-14:** Reopening/reloading a completed Quiz result does not create another session completion or Streak day.
- **AC-ST-15:** Retrying a completed Quiz group uses a genuinely new server session/run and may qualify on a later day.
- **AC-ST-16:** One qualifying completion creates the USER's first Streak day and returns current Streak `1`.
- **AC-ST-17:** Consecutive application-day completions increase current Streak once per day.
- **AC-ST-18:** Multiple NORMAL/SRS/Quiz completions on the same day create exactly one daily ledger row and no repeated increment.
- **AC-ST-19:** If today is incomplete and yesterday ends the active sequence, current Streak remains the sequence length and `completed_today` is false.
- **AC-ST-20:** Missing a full application day makes current Streak `0` without deleting retained qualifying-day history.
- **AC-ST-21:** The next qualifying completion after a break starts current Streak at `1`.
- **AC-ST-22:** Day assignment uses Backend completion acceptance time converted to `Asia/Ho_Chi_Minh`; client dates/timezones are rejected or ignored.
- **AC-ST-23:** A session completed immediately before and immediately after the UTC+7 midnight boundary is assigned to the correct application date.
- **AC-ST-24:** A valid unfinished session may cross midnight and qualifies only on its eventual completion date.
- **AC-ST-25:** At `created_at + 7 × 24 hours`, an unfinished session is expired and cannot accept qualifying evidence or completion.
- **AC-ST-26:** Session expiry does not remove or roll back existing Progress, SRS scheduling or XP.
- **AC-ST-27:** Exact event/completion replay returns the authoritative existing result and creates no new session completion, daily row or XP.
- **AC-ST-28:** Concurrent terminal requests for one session commit one completion; concurrent different sessions on one USER/day commit one Streak day.
- **AC-ST-29:** Progress/XP/session evidence/session completion/daily insertion roll back together when the terminal transaction fails.
- **AC-ST-30:** Set deletion, lost ownership/access or removed snapshot items cannot be exploited to shrink or fabricate completion.
- **AC-ST-31:** Migration creates no historical sessions or Streak days and preserves all existing USER, Progress and XP data.
- **AC-ST-32:** `GET /api/users/me/streak` is USER-isolated, side-effect free and returns current, today-completed, last-date, timezone and evaluated-at projections.
- **AC-ST-33:** Dashboard displays `0 ngày` and `N ngày` states truthfully, distinguishes today-completed from today-incomplete textually, and never renders API failure as successful zero data.
- **AC-ST-34:** Dashboard Streak UI is keyboard/screen-reader usable, responsive and does not redesign Level/XP or add a weekly calendar.
- **AC-ST-35:** Speaking, Daily Goal, Achievement, leaderboard, analytics/history and Streak Freeze remain absent.
- **AC-ST-36:** Existing Learning/Quiz same-tab recovery cannot use local state to bypass Backend session ownership, expiry or completion evidence.

## 17. Required Edge Cases

- Session groups of 1, 9 and 10 items; Set sizes of 0, 10 and 11.
- Duplicate spellings backed by distinct Vocabulary UUIDs.
- NORMAL cards revealed out of order, repeatedly, or all except one.
- NORMAL explicit completion replay and completion from another tab.
- SRS repeated `AGAIN`, `AGAIN` as the final unresolved item and same-event replay after lost response.
- SRS item becoming inaccessible or Progress revision changing mid-session.
- Quiz all incorrect, mixed answers, duplicate answer event, stale question, changed choice and lost response retry.
- Completed Quiz result reload, retry on the same day and retry after a day boundary.
- Two qualifying modes complete simultaneously for one USER.
- Two USERs complete sessions for the same Set simultaneously.
- Completion one millisecond before, at and after expiry.
- Completion around `Asia/Ho_Chi_Minh` midnight while the client clock is wrong.
- Read on today, yesterday-only, one missed day, long gap and no-history states.
- Migration with existing Progress/XP but no Streak records.
- `sessionStorage` cleared or malformed while the Backend session remains active/completed.

## 18. Migration and Deployment Considerations

- Migration must be additive and transaction-safe.
- Required uniqueness, check and foreign-key constraints must be validated against PostgreSQL.
- No existing record is rewritten or backfilled into Streak.
- Deployment order should permit migration before code use and preserve existing learning behavior during rollout.
- Backend should be deployed before the session-aware Frontend.
- Legacy sessionless SRS/Quiz requests retain existing Progress/XP behavior but create no Streak. This compatibility has no automatic Streak V1 removal date.
- Rollback planning must distinguish code rollback from irreversible accepted post-deployment Streak data; no destructive rollback is automatic.
- Preview TEST migration, backup and deployment require separate HUMAN authorization under existing database safety rules.

## 19. Documentation Reconciliation After SPEC Approval

Only this draft SPEC is modified now. A later approved documentation task should:

- Update `PROJECT_OVERVIEW.md` to limit Streak V1 qualifiers to completed NORMAL, SRS and Quiz sessions and explicitly exclude Speaking.
- Replace deferred broad qualifying examples and activate the approved read contract in `API_SPEC.md`.
- Keep deferred `longest_streak` out of the active V1 contract unless HUMAN separately approves that expansion.
- Add the minimal Dashboard card and states to `UI_UX_SPEC.md` without final Daily Goal layout polish.
- Add the approved session/Streak persistence model to `DATABASE.md`.
- Update `ARCHITECTURE.md` only if the approved persistent session boundary is confirmed.
- Move Streak from `TODO` to `IN_PROGRESS` in `FEATURE_STATUS.md` only after the appropriate workflow authorization; do not mark it `DONE` before TEST, REVIEW and HUMAN approval.
- Preserve all XP & Level V1 rules and evidence.

## 20. Approved Architecture Boundary

The following architecture boundary is **HUMAN APPROVED** and must be carried into PLAN:

1. One Backend-managed Learning Session concept owns USER/Set/mode identity, authoritative snapshot, lifecycle and seven-day expiry for NORMAL, SRS and Quiz.
2. Session Item evidence tracks only the per-item state required to prove completion; it is not a general analytics or activity-history system.
3. A durable Streak Day concept records qualifying application dates with one effective row per USER/date.
4. NORMAL uses authenticated reveal acknowledgements plus explicit completion, with no human-attention claim or invasive anti-cheating behavior.
5. Qualifying SRS ratings and Quiz answers are associated with valid sessions while their existing scheduling, grading, Progress and XP semantics remain unchanged.
6. Sessionless SRS/Quiz requests remain compatible for Progress/XP and never qualify for Streak; compatibility removal is outside Streak V1.
7. `longest_streak` remains deferred and is not part of the active V1 read or Dashboard contract.

## 21. Remaining PLAN-Stage Technical Choices

### 21.1 Data and Transaction Design

PLAN must propose for later HUMAN review:

1. Exact Prisma model/table names, fields, enums, relations, indexes, check constraints, unique constraints and FK deletion behavior for the three approved data groups.
2. Whether effective expiry is calculated lazily, also persisted after an attempted mutation, or supported by a later cleanup mechanism. Streak V1 does not implicitly authorize a new cron.
3. Retention duration for completed/expired session proof and the policy that keeps Streak Day records available for accurate current/history behavior.
4. The transaction/locking strategy that preserves existing Progress/XP atomicity and makes terminal completion plus Streak Day insertion concurrency-safe.

### 21.2 API and Rollout Design

PLAN must propose:

5. Exact route names, HTTP methods, request/response schemas and error mappings for session creation/read, NORMAL reveal and NORMAL completion.
6. Exact backward-compatible SRS/Quiz request and response extensions for optional session association.
7. Whether terminal mutation responses embed the full Streak projection or return completion/day status followed by the read API.
8. Deployment sequencing and observability that keep legacy sessionless requests functional without implying that they earned Streak.

### 21.3 Dashboard Detail

PLAN/UI checkpoint must select:

9. Exact Vietnamese helper copy distinguishing “completed today” from an active Streak not yet continued today.
10. Whether the Streak card has an independent retry or participates in the Dashboard's existing section-level retry composition.

### 21.4 Remaining HUMAN Business Decisions

**None at SPEC stage.** The four previously blocking architecture decisions are HUMAN approved. The choices above are technical PLAN/UI details and must be presented through the normal PLAN approval gate; they do not block final HUMAN approval of this SPEC.

## 22. Risks

- Adding a persistent session boundary to formerly transient flows can regress reload/retry behavior if frontend presentation state and Backend completion state are conflated.
- Extending SRS/Quiz transactions can break XP atomicity if session evidence is written outside the existing mutation transaction.
- NORMAL reveal calls increase request volume and still cannot prove human attention beyond an authenticated interaction acknowledgement.
- Compatibility support for sessionless clients can create confusing but safe “learning succeeded, Streak not counted” behavior if rollout messaging is poor.
- Session snapshots can become stale after Set changes; silently shrinking them would enable false completion.
- Incorrect timezone conversion or database session timezone assumptions could misassign days around midnight.
- Deriving current Streak from a growing ledger requires indexing and query review in PLAN.
- Aggressive cleanup could destroy proof needed for replay, audit or current-Streak calculation.

## 23. Approval Gate

```text
STREAK V1 SPEC STATUS: HUMAN APPROVED
PLAN AUTHORIZED: HUMAN APPROVED
TASK AUTHORIZED: DRAFTING ONLY
IMPLEMENTATION AUTHORIZED: NO
```

The SPEC and PLAN direction are HUMAN approved. TASK drafting is authorized for HUMAN review; application code, schema or migration changes, API implementation, database access, test execution, branch creation, commit and deployment remain unauthorized.
