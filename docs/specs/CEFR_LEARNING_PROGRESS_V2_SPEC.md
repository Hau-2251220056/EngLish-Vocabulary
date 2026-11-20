# SPEC: CEFR Learning Progress V2

**Status: HUMAN APPROVED — 2026-11-12**

This document is the HUMAN-approved change to the CEFR Learning Path V1 contract. It defines approved requirements and architecture boundaries only. Approval authorizes drafting the V2 PLAN but does not authorize TASK creation, implementation, schema change, migration execution, database access, or deployment.

## 1. Objective

CEFR Learning Progress V2 lets an authenticated `USER` satisfy each item in an active qualifying CEFR Set pass by encountering that exact snapshot item through either:

1. a backend-accepted NORMAL Flashcard reveal; or
2. a backend-accepted rating in a CEFR-scoped SRS session.

NORMAL and CEFR-scoped SRS contribute to one backend-owned set of pass-item evidence. Each pass item contributes at most once, regardless of mode, retry, repeated rating, browser tab, or session count.

Learning a word for CEFR progression means encountering it through an approved activity. It does not mean remembering the word correctly. Therefore all accepted SRS ratings, including `AGAIN`, are eligible CEFR evidence while retaining their existing and independent SRS scheduling meanings.

V2 also corrects two continuity problems:

- partial accepted NORMAL evidence must remain useful when a learner leaves before completing the bounded session; and
- a historically completed Set must remain available for a fresh independent study run without resetting or duplicating its CEFR completion.

Quiz and Speaking Practice remain independent activities and never provide CEFR pass evidence in V2.

## 2. V1 Compatibility and Intentional Changes

### 2.1 V1 invariants preserved

V2 preserves all of the following approved V1 rules:

- Supported Set progression levels are exactly `A1`, `A2`, `B1`, `B2`, and `C1`.
- A1 is initially unlocked and C1 is terminal. V2 introduces no C2 Set progression.
- Only qualifying public System Sets with valid Set-level A1–C1 classification participate in progression.
- Private, copied, personal, null-CEFR, missing, and inaccessible Sets never earn CEFR completion.
- Each pass owns an immutable ordered snapshot of exact Vocabulary identities.
- Each snapshot item contributes at most once to that pass.
- Bounded Learning Sessions contain at most ten distinct items.
- A completed bounded session is not equivalent to completed Set passage.
- Every snapshot item must have accepted evidence before the Set is ready to complete.
- The USER must explicitly confirm final Set completion.
- Historical Set completion is durable and learner-scoped.
- Current curriculum completion, historical completion, and earned unlock entitlement remain separate concepts.
- Earned level and terminal C1 entitlements are monotonic.
- Later curriculum additions do not relock earned levels or revoke terminal achievement.
- Earlier-level additions do not replace the primary recommendation at the highest unlocked level.
- Restarting an unfinished pass invalidates its attempt without transferring evidence into the replacement pass.
- Existing completed passes remain immutable.
- There is no automatic retrospective credit from historical Learning Progress, ordinary SRS, GLOBAL SRS, Quiz, Speaking, XP, Streak, Daily Goal, or client storage.
- The backend remains the authority for evidence, completion readiness, completion, and unlocking.

### 2.2 Intentional V1 business-rule changes

V2 intentionally changes these V1 rules and only these rules:

1. **NORMAL evidence timing:** an accepted pass-linked `NORMAL_REVEALED` event may credit its pass item immediately. V1 waited for the entire bounded NORMAL session to complete before treating its reveals as pass progress.
2. **SRS evidence eligibility:** a backend-created CEFR-scoped SET/SRS session may credit pass items. V1 allowed only pass-linked NORMAL sessions to contribute.
3. **AGAIN semantics for CEFR:** accepted `AGAIN` proves that the item was encountered and may credit the pass item, even though it leaves the SRS session item unresolved and retains its existing scheduling behavior.
4. **Remaining-item selection:** the next CEFR batch is selected from pass items without accepted V2 evidence, rather than from items absent from completed NORMAL sessions.
5. **Independent relearning:** entering a historically completed Set for fresh study must create or resume an independent learning run, not restore a stale completed CEFR presentation run.

These changes do not convert CEFR study evidence into mastery, memorization, correctness, certification, XP, or SRS resolution.

### 2.3 Current implementation being superseded

The current implementation stores each NORMAL reveal durably on `LEARNING_SESSION_ITEM`, but the pass projection counts evidence only from `COMPLETED` pass-linked NORMAL sessions. Consequently, three accepted reveals in an active ten-item session remain visible to the session but the pass reports `0 / 10`.

The current database also permits a pass relation only when a Learning Session is `SET` scope and `NORMAL` mode. V2 requires an additive change to support backend-created pass-linked SET/SRS sessions.

## 3. Terminology

- **Qualifying Set:** A current public System Vocabulary Set with Set-level CEFR A1–C1 that is accessible under the learner's earned entitlement.
- **Pass:** One backend-owned attempt by one USER to encounter every exact Vocabulary identity in one qualifying Set snapshot.
- **Pass item:** One immutable `(pass_id, vocabulary_id, position)` member of the pass snapshot.
- **CEFR evidence:** The first accepted qualifying event attached to a pass item.
- **Evidence source:** The qualifying event kind: `NORMAL_REVEALED`, `SRS_AGAIN`, `SRS_HARD`, `SRS_GOOD`, or `SRS_EASY`.
- **Credited item:** A pass item with accepted CEFR evidence. Later qualifying events cannot increment its credit count.
- **Remaining item:** A pass item without accepted CEFR evidence.
- **CEFR-scoped session:** A backend-created SET/NORMAL or SET/SRS Learning Session associated with one exact active pass. Clients cannot attach a session to a pass.
- **Ordinary SET SRS:** Existing due/eligibility-based SRS for one Set without a CEFR pass association.
- **GLOBAL SRS:** Existing cross-Set global review. It never contributes CEFR evidence.
- **Batch:** One immutable bounded Learning Session snapshot of one to ten items.
- **Session resolution:** Completion of the Learning Session under its mode rules. This is independent from pass-item credit.
- **Ready to complete:** Every pass item is credited, but explicit final Set completion has not yet been accepted.
- **Independent relearning:** A fresh non-CEFR study run for a historically completed Set.
- **Pristine pass:** An active pass with no accepted pass-item evidence.
- **Historical completion:** The immutable completed pass for one USER and exact Set identity.
- **Current curriculum completion:** Whether all currently qualifying Sets at a level have historical completion.
- **Earned entitlement:** The highest unlocked CEFR level and terminal completion state, which never decrement.

## 4. Scope

### 4.1 In scope

- Immediate pass-item credit for backend-accepted pass-linked NORMAL reveals.
- A distinct CEFR-scoped SRS purpose for active qualifying passes.
- CEFR evidence from all four accepted SRS ratings.
- Exact per-item deduplication across NORMAL and SRS.
- Mixed-mode pass continuation across bounded batches.
- Durable partial evidence across reload, exit, safe retry, mode switch, and session expiry.
- Explicit pass completion after all snapshot items have evidence.
- Fresh independent NORMAL relearning after historical Set completion.
- Backend projections sufficient to distinguish pristine, partial, ready, restart-required, invalidated, and completed states.
- Truthful Dashboard Current Learning and independent Next Suggestion behavior.
- Focused reduction of unrelated interaction blocking during pending NORMAL evidence where correctness permits.
- Migration of exact existing pass-linked NORMAL evidence into the approved canonical pass-item evidence fields.
- Focused compatibility and regression coverage across Learning, SRS, Quiz, Speaking, Dashboard, sessions, migration, authorization, retries, and concurrency.

### 4.2 Explicitly outside scope

- C2 Set progression.
- CEFR mastery scores, certification, correctness thresholds, or weighted percentages.
- Quiz or Speaking evidence for CEFR completion.
- GLOBAL SRS evidence for CEFR completion.
- Historical ordinary SRS or Learning Progress backfill.
- Changes to SRS interval calculation, due rules, rating transitions, revision rules, XP, or Streak.
- New Quiz types, Speaking recognition behavior, or Quiz/Speaking batch changes.
- Independent non-due SRS relearning after historical completion unless separately approved.
- Learning history, analytics, timelines, accuracy charts, or activity feeds.
- Broad Dashboard, Flashcard, Review Center, or App Shell redesign.
- Unrelated performance work or claims about backend latency without measurement.
- New roles, AI services, notifications, reminders, achievements, or Daily Goal rules.

## 5. Actors and Authorization

### 5.1 Authenticated USER

A `USER` may:

- start one active pass for an eligible qualifying Set;
- choose NORMAL or CEFR-scoped SRS for a pristine or partial pass;
- switch between those modes while preserving accepted pass evidence;
- resume the exact backend-selected active pass;
- explicitly complete a ready pass;
- explicitly restart an incompatible unfinished pass;
- independently relearn a historically completed Set without earning duplicate CEFR credit; and
- use ordinary Review Center, ordinary SET SRS, and GLOBAL SRS under their existing contracts.

### 5.2 ADMIN

An `ADMIN` retains existing Set-management and neutral Dashboard behavior. ADMIN cannot own learner passes, receive CEFR evidence, call USER-only pass/session APIs, or receive USER learning projections.

### 5.3 Guest

A Guest retains current public Discovery and Set Detail visibility but cannot start or mutate a pass, create a CEFR-scoped session, receive progression data, or submit evidence.

### 5.4 Authorization invariants

- Every mutation derives USER identity from the authenticated session.
- A client cannot submit a USER identity, unlock level, evidence count, completion count, pass status, or entitlement.
- A client cannot attach an ordinary session to a pass.
- A pass-linked event must match the session owner, pass owner, Set identity, pass snapshot and exact session item.
- Missing and foreign pass/session identities use concealed not-found behavior.
- Locked public levels reject all existing protected learning activities consistently.
- Owned private/copied Sets retain current learning behavior but never create pass evidence.

## 6. NORMAL Evidence

### 6.1 Qualifying event

A NORMAL event credits a pass item only when all of the following are true:

1. the session is backend-created and linked to the exact active pass;
2. the session has `SET` scope and `NORMAL` mode;
3. the session is active and unexpired at backend acceptance time;
4. current activity authorization remains valid;
5. the exact Vocabulary identity belongs to both the immutable session snapshot and pass snapshot;
6. the backend accepts `NORMAL_REVEALED` with an idempotent event identity; and
7. the pass is still active and compatible.

Opening, loading, navigating to, focusing, or playing audio for a card never credits it.

### 6.2 Immediate durable credit

The same transaction that accepts `NORMAL_REVEALED` must attempt to credit the corresponding pass item. The first accepted qualifying event wins. Replays and later events return authoritative state but do not increment the pass count.

Credit does not wait for bounded-session completion. Therefore, after three accepted reveals in a ten-item batch, the pass has three credited items even if the bounded session remains active.

### 6.3 Session completion remains meaningful

NORMAL bounded-session completion retains its current requirements and Streak behavior. All items in that session must have accepted NORMAL reveal evidence before it can complete.

Pass readiness no longer depends on every prior NORMAL session being completed. It depends on every pass item having accepted CEFR evidence. This distinction is necessary so exact evidence accepted before expiry remains useful.

An incomplete or expired session does not qualify for Streak merely because some pass items were credited.

### 6.4 Expiry and recovery

- Expired sessions reject new reveals.
- Evidence accepted before expiry remains attached to the pass item.
- Replacement batches select only remaining uncredited pass items.
- The learner is not required to repeat an already credited item solely because its original session later expired.
- An expired session remains historical session evidence and is not rewritten as completed.
- Restarting the pass creates new pass items without copying old evidence.

## 7. SRS Evidence

### 7.1 Qualifying ratings

The following backend-accepted ratings in a CEFR-scoped SET/SRS session are eligible evidence:

- `AGAIN`
- `HARD`
- `GOOD`
- `EASY`

Opening or revealing the SRS card without an accepted rating does not count.

### 7.2 CEFR credit versus SRS resolution

CEFR credit and SRS session resolution are independent:

- Every first accepted rating, including `AGAIN`, immediately qualifies as CEFR evidence and may credit the pass item.
- `AGAIN` continues to leave the SRS session item unresolved and requeues it under existing behavior; CEFR credit does not convert it into a passing rating.
- `HARD`, `GOOD`, and `EASY` continue to resolve the SRS session item.
- Repeated `AGAIN` events may update scheduling according to the existing authoritative rules but never add another CEFR credit.
- A pass may become ready to complete while one or more CEFR-scoped SRS sessions remain unresolved because of `AGAIN`.
- Unresolved SRS sessions do not block explicit pass completion once every pass item has accepted CEFR evidence.
- Pass completion does not silently mark an unresolved SRS session completed or abandoned.
- An unresolved or incomplete SRS session does not qualify for Streak until its existing completion contract is satisfied.

### 7.3 Scheduling compatibility

CEFR-scoped SRS does not weaken or bypass the rating mutation contract. Accepted ratings continue to use existing backend-owned transitions, revisions, replay checks, Progress mutations, rewards and Streak rules.

CEFR-scoped selection may include NEW, currently due, future-due or otherwise non-due snapshot items because its selection purpose is pass encounter coverage rather than Review Center eligibility. Rating those items intentionally applies the existing rating transition at the backend acceptance time.

The implementation must document and test this early-review effect; it must not invent a separate scheduler or silently suppress normal Progress effects.

## 8. CEFR-Scoped SRS

### 8.1 Distinct purpose

CEFR-scoped SRS is pass-oriented study, not ordinary due review. Its candidate universe is the ordered remaining items from one exact active pass snapshot.

It differs from ordinary SET SRS as follows:

| Property | CEFR-scoped SRS | Ordinary SET SRS |
|---|---|---|
| Pass association | Required, backend-owned | None |
| Candidate source | Remaining uncredited pass items | Existing SRS eligibility/due rules |
| Prior NORMAL required | No | No |
| Can include unseen/non-due items | Yes | Existing contract only |
| CEFR evidence | Yes | No |
| GLOBAL scope | Never | Separate existing GLOBAL contract |

### 8.2 Creation and snapshot

- The USER requests a session through the pass lifecycle API and identifies only the requested mode and operation identity.
- The backend resolves pass, USER, Set and remaining item identities.
- The client cannot submit Vocabulary IDs or attach a pass.
- A session contains the first at most ten remaining items in immutable pass order.
- The backend returns exact card data and authoritative rating previews for those session items, including unseen and non-due items.
- A pristine pass may begin directly in CEFR-scoped SRS.

### 8.3 Continuation after AGAIN

When `AGAIN` credits an item but leaves it unresolved for SRS:

- the current SRS queue may continue to present that item under existing SRS behavior;
- the pass no longer considers the item remaining;
- the UI must offer separate, explicit actions for **Continue this SRS review session** and **Continue remaining CEFR items**;
- **Continue this SRS review session** resumes the exact unresolved session and its existing queue, rating, revision, replay and completion behavior;
- **Continue remaining CEFR items** leaves the unresolved SRS session unchanged and requests a bounded batch from only the pass items that remain uncredited;
- when no pass items remain, the CEFR action becomes **Complete Set**, while the unresolved SRS session remains independently resumable;
- navigation away from the SRS session must preserve its exact session identity and must not emit a completion, abandonment or replacement mutation;
- returning through an exact safe resume route must re-read backend session state before restoring the queue; and
- neither path may award another CEFR credit for an already credited pass item.

An unresolved CEFR-scoped SRS session remains available under the existing owner, access, activity and safe-resume rules until it is completed or expires. While active, its exact session route may be resumed even when all of its items already have CEFR credit. Explicit pass completion does not delete or complete that session; while access remains valid, the USER may finish its ordinary SRS queue before expiry, and later ratings cannot mutate the immutable completed pass. At expiry, the backend rejects new ratings, the UI removes the active-resume action and presents the existing expired-session recovery state, and any CEFR evidence accepted before expiry remains durable. Expiry does not complete or abandon the session and does not prevent continuing remaining CEFR items through a new bounded batch.

### 8.4 Existing active sessions and mode switching

The approved V2 rule is:

- Multiple unexpired CEFR-scoped sessions may exist for one pass when the USER deliberately switches mode or uses another browser tab.
- Session snapshots remain immutable and may overlap only for items that were uncredited when each snapshot was created.
- The first accepted qualifying event credits the pass item; later accepted events retain their ordinary session/SRS effects but do not add CEFR credit.
- An exact session-resume action resumes the requested active session under its existing lifecycle even if its items are already credited.
- A pass-level **Continue remaining CEFR items** request may resume the newest compatible session of the requested mode only when that session still contains an uncredited item.
- If every item in an unresolved SRS session is already credited, the pass-level continuation may create the next remaining batch without completing, abandoning or replacing that SRS session.
- Frontend state must reconcile from backend pass and session projections rather than assuming only one active session exists.

This rule avoids adding a new session terminal status solely for mode switching and is approved by `HD-V2-02`.

## 9. Bounded Sessions

### 9.1 Size and ordering

- Every CEFR-scoped session contains one to ten distinct pass items.
- Candidate order follows immutable pass position.
- Set size, not session count, determines total evidence required.
- An 11-item Set requires evidence for all eleven items across at least two snapshots.
- A 20-item Set requires evidence for all twenty items across at least two snapshots.
- A 15-item Set includes a final batch of five remaining items.
- No mode may silently omit an item after the first ten.

### 9.2 Lifecycle

An active pass follows these conceptual states:

1. `PRISTINE`: no credited pass items.
2. `NORMAL_ACTIVE`: at least one effective NORMAL session contains a remaining item.
3. `SRS_ACTIVE`: at least one effective CEFR-scoped SRS session contains a remaining item.
4. `MIXED_ACTIVE`: both modes have contributed or both have effective sessions.
5. `PARTIAL`: at least one but fewer than all pass items are credited.
6. `BETWEEN_BATCHES`: remaining items exist and no current resumable session contains them.
7. `READY_TO_COMPLETE`: every pass item is credited and final completion is not accepted.
8. `RESTART_REQUIRED`: frozen snapshot content is no longer safely accessible or compatible.
9. `INVALIDATED`: an explicit restart replaced the pass.
10. `COMPLETED`: explicit final completion was accepted.

Presentation may combine compatible states, but backend projections must expose enough facts to distinguish them without frontend inference from catalog or Progress data.

### 9.3 Interruption and recovery

- Reload and logout/login recover from backend pass and session state.
- Client storage may restore presentation cursor only after backend reconciliation.
- Lost responses reuse the original operation/event identity.
- Expired sessions reject mutation while preserving previously accepted pass-item evidence.
- An unresolved SRS session with only credited pass items remains directly resumable until completion or expiry but is not selected as the next remaining CEFR batch.
- Choosing another CEFR batch never changes the lifecycle status of an existing unresolved SRS session.
- Inaccessible content returns restart-required without exposing protected content.
- A session error never rolls back evidence already committed by a prior transaction.
- A ready pass does not create another study session.

## 10. Completion and Unlock

### 10.1 Readiness

A pass is ready to complete only when:

- it is active and compatible;
- every pass item has exactly one accepted CEFR evidence record; and
- the credited count equals the immutable snapshot size.

Session completion count, SRS resolution count, Learning Progress status, XP, Streak and client presentation state are not readiness inputs.

### 10.2 Explicit final completion

- The USER must select **Complete Set** after readiness.
- Completion locks the pass and current authoritative evidence set.
- Completion is idempotent by USER-scoped operation identity.
- Concurrent completion attempts produce one accepted historical completion.
- Completion atomically marks the pass completed and advances only eligible monotonic entitlement.
- A completed pass cannot receive new CEFR evidence or be restarted.

### 10.3 Level progression

- A2 unlocks only when every currently required A1 Set has accepted historical completion.
- B1, B2 and C1 follow the same sequential rule.
- C1 completion records terminal entitlement and never creates C2.
- A level with zero required Sets or an empty required Set cannot unlock the next level.
- New earlier-level requirements block only entitlements not yet earned.
- Existing entitlement and terminal achievement never decrement.

## 11. Continuation and Relearning

### 11.1 Continue an unfinished pass

- Dashboard Current Learning and qualifying Set entry resume the exact active pass.
- The backend selects only remaining uncredited pass items for new batches.
- Switching mode does not restart the pass or repeat already credited items.
- A 20-item pass with ten credits continues with the remaining ten.
- Restart is available only through the explicit pass restart contract when required or intentionally approved; it is never inferred from mode change.

### 11.2 Relearn a historically completed Set

- Set Detail must offer a fresh independent NORMAL study action.
- That action creates or resumes an ordinary non-pass NORMAL session/run.
- It clears or replaces only the stale client presentation state for that USER/Set/mode intent.
- It does not create another CEFR pass.
- It does not modify the completed pass, current curriculum credit or entitlement.
- It does not award duplicate CEFR evidence.
- Reopening a completed ten-item Set must show study content rather than the prior completed-pass screen.

The approved V2 boundary for independent SRS relearning is to retain existing ordinary due-based SET SRS only. Non-due independent SRS after completion remains outside V2 under `HD-V2-05`.

### 11.3 Required UI actions

The UI must distinguish:

- **Continue batch** — resume the current compatible session.
- **Continue remaining words** — request the next pass batch, optionally choosing NORMAL or CEFR-scoped SRS.
- **Complete Set** — explicit final pass completion after readiness.
- **Study again** — fresh independent NORMAL learning after historical completion.
- **Return to Set Detail** — leave without mutating completion or evidence.

## 12. Dashboard Requirements

### 12.1 Current Learning

Current Learning must:

- use the backend-selected active `RESUME` pass;
- retain exact pass and Set identity;
- never render completed or invalidated passes as active;
- show restart-required state separately;
- navigate with exact pass identity;
- remain independent from Next Suggestion; and
- avoid deriving evidence from catalog, ordinary SRS, Learning Progress or client storage.

Numeric progress is not an acceptance requirement. The approved initial V2 UX removes the numeric fraction and progress bar from Current Learning and shows a concise truthful state such as **Continue learning**, **Continue remaining words**, or **Ready to complete**. Backend evidence counts remain available for Learning flow and verification.

Retaining numeric progress is not part of approved V2 and would require a later SPEC amendment. Any later copy would have to describe credited encounters rather than mastery or completed bounded sessions.

### 12.2 Next Suggestion

Next Suggestion retains the existing contract:

- highest unlocked CEFR level only;
- eligible unfinished public Set only;
- excludes Sets with an active pass or active SET learning/review context;
- never duplicates Current Learning;
- preserves historical entitlement after curriculum additions;
- reports active-only and no-eligible states truthfully; and
- never advertises a locked next level as an actionable lesson.

V2 evidence changes must not alter recommendation ordering or completion requirements.

## 13. Flashcard Pending UX Considerations

### 13.1 Current boundary

The current NORMAL flow sets the shared event state to `pending` while awaiting backend reveal acceptance. During this state it blocks:

- another reveal;
- card Previous/Next actions and arrow shortcuts;
- mode switching;
- batch completion;
- restart;
- toolbar back action;
- card interaction; and
- pronunciation audio because the whole Flashcard component receives `disabled`.

No fixed six- or seven-second timer was found. The observed delay may be request, database, deployment or network latency and requires measurement before attribution.

### 13.2 Required correctness boundary

The following must remain blocked for the item whose evidence result is unknown:

- a duplicate reveal with a different event identity;
- navigation that would discard the visible retry/error context;
- batch completion;
- pass completion;
- restart;
- mode switching that would replace the pending item context; and
- another evidence mutation for that same interaction slot.

Removing every pending guard would permit ambiguous current-item state, duplicate operations, lost retry identity and incorrect focus transitions.

### 13.3 Proposed V2 interaction behavior

- The pending control displays **Recording study evidence…** and exposes `aria-busy`.
- The original operation identity remains durable for exact retry.
- Success announces acceptance and enables progression immediately.
- Failure keeps the current card and offers exact retry.
- Pronunciation playback may remain available because it does not mutate evidence, cursor, pass or session state.
- Purely visual back-face reading and scrolling remain available.
- Focus remains on a stable card/status target and is restored to the retry or next valid action.
- Reduced-motion preferences remain honored.
- No arbitrary client delay is introduced.

Separating the audio-disabled state from evidence-pending state is within V2 because the current broad lock directly affects the new evidence flow. Measuring and optimizing a six- or seven-second backend/network delay is a separate bounded performance audit.

## 14. Backend Data and API Requirements

### 14.1 Proposed canonical evidence model

The approved minimal model extends each existing `CEFR_LEARNING_PASS_ITEM` with nullable first-credit fields:

- evidence source kind;
- evidence event UUID;
- evidence Learning Session UUID;
- evidence acceptance timestamp.

The first accepted credit is immutable. A pass item without these fields is remaining. This avoids a general activity-history table and matches the rule that one item contributes at most once.

Proposed evidence source values are exactly:

- `NORMAL_REVEALED`
- `SRS_AGAIN`
- `SRS_HARD`
- `SRS_GOOD`
- `SRS_EASY`

The PLAN must use this extension. A separate focused evidence table or a history of repeated encounters is outside approved V2 and would require a SPEC amendment.

### 14.2 Session association changes

The existing database constraint allowing a pass relation only for SET/NORMAL sessions must be relaxed narrowly:

- a pass relation still requires `SET` scope;
- mode may be `NORMAL` or `SRS`;
- `GLOBAL` sessions never have a pass relation;
- QUIZ sessions never have a pass relation; and
- only the learning-path service may create pass-linked sessions.

No ordinary session API accepts a client-supplied pass ID.

### 14.3 Transactional evidence recording

For every qualifying event, the backend must transactionally:

1. authenticate and authorize the USER;
2. lock/read the owned session and exact item;
3. verify session activity, mode, scope and pass association;
4. lock/read the active pass and matching pass item;
5. verify immutable Set and snapshot membership;
6. perform the existing NORMAL or SRS event mutation;
7. set first-credit fields only when still null; and
8. return the authoritative pass evidence summary.

If another request credited the pass item first, the ordinary event may still succeed under its existing session contract, but the CEFR count remains unchanged.

### 14.4 Read projection

The pass read should add an evidence projection sufficient to expose:

- credited item count;
- remaining item count;
- evidence counts by NORMAL and SRS first-credit source;
- readiness for explicit completion;
- restart compatibility;
- effective active CEFR-scoped session summaries by mode; and
- a stable conceptual activity state.

The projection must not expose inaccessible Vocabulary content or derive mastery.

### 14.5 Session API proposal

The existing pass session endpoint should accept an additive requested mode:

`POST /api/learning-path/passes/:passId/sessions`

Proposed body:

```json
{
  "operation_id": "uuid",
  "mode": "NORMAL"
}
```

or:

```json
{
  "operation_id": "uuid",
  "mode": "SRS"
}
```

For backward compatibility, omission of `mode` means `NORMAL`. The PLAN must preserve this compatibility default while adding explicit `NORMAL` and `SRS` mode support.

The backend, not the client, selects exact remaining IDs. SRS success must include or make available exact card projections and backend rating previews for its immutable session snapshot.

Existing reveal, rating, session-read and explicit pass-completion endpoints remain the mutation boundaries. Their responses may add an authoritative pass evidence summary.

### 14.6 Migration and backfill policy

The approved migration is additive and forward-only.

It may backfill CEFR pass-item evidence only from exact accepted V1 `NORMAL_REVEALED` session-item evidence. Every candidate must satisfy all of the following:

- the Learning Session is pass-linked, `SET` scoped and `NORMAL` mode;
- the session USER equals the pass USER;
- the session pass ID equals the candidate pass-item pass ID;
- the session Set snapshot equals the pass Set snapshot;
- the session-item Vocabulary identity equals the pass-item Vocabulary identity;
- the evidence kind is exactly `NORMAL_REVEALED`;
- the evidence event identity and acceptance timestamp are present and structurally valid; and
- the accepted event is consistent with the V1 session lifetime and stored session evidence contract.

This includes valid accepted partial reveals from active or expired V1 pass-linked sessions because they already have exact durable pass attribution. Session expiry after acceptance does not invalidate that evidence, but an event that cannot be proven to have been accepted before expiry is not backfilled.

For multiple valid V1 reveals of the same pass item, the earliest accepted event becomes the immutable first credit using acceptance timestamp and then event UUID as deterministic tie-breakers. Once selected, that first-credit source, event, session and timestamp are immutable. The migration never synthesizes an event ID, timestamp, session association or evidence source.

The migration must not backfill from:

- `LEARNING_PROGRESS`;
- ordinary SET SRS;
- GLOBAL SRS;
- Quiz;
- Speaking;
- XP, Streak or Daily Goal;
- client storage; or
- sessions without exact pass linkage.

Backfill changes evidence projection only. It must not invoke pass completion, write a completion event, advance `highest_unlocked_level`, write `path_completed_at`, or otherwise create a new CEFR entitlement. An existing incomplete pass may project `READY_TO_COMPLETE` after all of its exact evidence is backfilled, but it remains active until the USER explicitly confirms final Set completion through the normal authoritative operation.

Existing completed passes, completion events and earned entitlements remain preserved. Every completed V1 pass must be proven to have valid exact evidence for all snapshot items before a new completeness invariant is enforced. Missing, foreign, ambiguous, malformed, duplicated-incompatibly or temporally invalid evidence is a migration conflict: validation must stop and report the affected identity without fabricating credit, changing pass status or recomputing entitlement.

Migration verification must prove, before and after applying the data transformation, that:

- every credited pass item has one exact valid source event and identity chain;
- the deterministic first-credit result is stable under rerun;
- no prohibited activity source contributed evidence;
- pass status, completion event and completion timestamp counts are unchanged;
- entitlement level and terminal completion timestamps are unchanged;
- no incomplete pass became automatically completed; and
- any newly ready incomplete pass still requires explicit USER confirmation.

No migration or Prisma command is authorized by this SPEC.

## 15. Concurrency, Retry and Security

- Evidence event identities are immutable and replay-safe.
- One pass item has at most one first-credit event.
- Database uniqueness and conditional updates prevent duplicate credits.
- NORMAL reveal retry reuses the same operation identity.
- SRS retry retains the existing event ID and expected Progress revision.
- Cross-mode races may produce two accepted ordinary events but only one CEFR first credit.
- Multiple tabs reconcile against backend counts and must not add client-side increments.
- Pass completion locks/rechecks every required pass item after concurrent events settle.
- Restart locks the active pass, invalidates it once, and creates an empty-evidence replacement snapshot.
- Events targeting invalidated or completed passes cannot create CEFR credit.
- Expired sessions cannot accept new events.
- Snapshot mutation or access loss produces restart-required without silent credit.
- A shared Vocabulary identity in two Sets is represented by two different pass items; an event credits only its exact session-associated pass.
- Foreign USER, Set, pass, session or item combinations are rejected without disclosure.
- Private/copied Sets cannot be associated with a CEFR pass.
- Clients never submit evidence source, evidence timestamp, credited count or pass-item identity as authority.

## 16. Quiz and Speaking Compatibility

- Quiz and Speaking keep their existing ordered batches of at most ten items.
- Their existing session, grading, recognition, storage, focus, retry, XP and Streak contracts remain unchanged.
- Quiz evidence remains `QUIZ_CORRECT` or `QUIZ_INCORRECT` only for Quiz/session behavior and never credits a CEFR pass item.
- Speaking recognition remains transient and never credits a CEFR pass item.
- Shared ordered-session utilities must remain backward compatible.
- Public locked-level authorization remains enforced at current backend boundaries.
- No new reward or Learning Progress effect is introduced for NORMAL, Quiz or Speaking by V2.

## 17. Edge Cases

1. **New ten-item Set:** one NORMAL or CEFR-SRS batch may credit all ten; explicit final completion is still required.
2. **Eleven-item Set:** evidence for the first ten leaves one remaining item and cannot complete the pass.
3. **Twenty-item Set:** all twenty exact pass items require evidence across bounded sessions.
4. **Fifteen-item Set:** the final batch contains the last five uncredited items.
5. **Mixed modes:** NORMAL and SRS first credits combine into one deduplicated evidence set.
6. **Pristine SRS-only pass:** CEFR-scoped SRS may select the first ten pass items with no prior Progress.
7. **AGAIN-only encounters:** every distinct accepted item receives one CEFR credit while the SRS session remains unresolved.
8. **Repeated AGAIN:** scheduling/revision behavior continues; CEFR credit remains one.
9. **NORMAL then SRS same item:** the NORMAL first credit remains; SRS performs ordinary effects without increasing CEFR count.
10. **Same Vocabulary in two Sets:** credit is scoped to the exact pass; the other Set remains uncredited.
11. **Repeated encounter:** count remains one for that pass item.
12. **Switch during unfinished batch:** accepted credits remain; new mode selection uses remaining items and may coexist with the earlier active session.
13. **Existing active session:** exact-session resume remains available for an unresolved active SRS queue; pass-level continuation resumes a compatible session only when it contains uncredited items, otherwise it creates the next bounded batch without mutating the existing session.
14. **Partial NORMAL exit/resume:** accepted reveals remain credited and are not selected again.
15. **SRS unresolved after AGAIN:** the UI offers exact SRS resume and remaining-CEFR continuation separately; pass readiness or completion does not complete the queue, and expiry rejects later ratings without removing prior CEFR credit.
16. **Expired sessions:** reject new events, retain prior credits, and replace only remaining items.
17. **Restart:** old evidence remains only on the invalidated pass and is not copied.
18. **Concurrent retry:** exact replay is idempotent; incompatible reuse conflicts.
19. **Multiple tabs:** backend conditional credit prevents double counting; clients refresh authoritative state.
20. **Set membership mutation:** additions do not enter the frozen pass; removals/inaccessibility trigger restart-required under the existing policy.
21. **Locked level:** pass and activity entry are denied even by direct API/URL.
22. **New earlier-level Set after unlock:** current counts become incomplete without relocking or moving primary recommendation backward.
23. **C1 terminal entitlement:** remains durable; no C2 state is created.
24. **Private/copied Set:** ordinary study remains available, CEFR-scoped session creation is rejected.
25. **Completed Set independent NORMAL:** begins fresh content and cannot change the completed pass.
26. **Completed Set ordinary SRS:** follows existing due-based behavior and supplies no CEFR credit.
27. **Slow reveal response:** pending evidence is announced; no arbitrary timer or optimistic credit is used.
28. **Keyboard/focus pending:** evidence-changing actions remain blocked, safe audio remains usable, and retry restores meaningful focus.
29. **Quiz/Speaking activity:** creates no CEFR evidence.
30. **Cross-user attempt:** returns concealed authorization failure and performs no mutation.

## 18. Acceptance Criteria

- **AC-V2-001:** Given an active eligible pass, accepted NORMAL reveals for every snapshot item make the pass ready to complete without requiring SRS.
- **AC-V2-002:** Given an active eligible pass, accepted CEFR-scoped SRS ratings for every snapshot item make the pass ready to complete without requiring NORMAL.
- **AC-V2-003:** A mixture of NORMAL reveals and CEFR-scoped SRS ratings satisfies one deduplicated evidence set.
- **AC-V2-004:** Accepted `AGAIN` credits its exact pass item while retaining unresolved SRS-session behavior.
- **AC-V2-005:** Repeated events for one pass item never increase credited count above one.
- **AC-V2-006:** No Learning Session contains more than ten items.
- **AC-V2-007:** An eleven-item pass cannot be ready after evidence for only ten items.
- **AC-V2-008:** The next batch contains only remaining uncredited items in pass order.
- **AC-V2-009:** Accepted evidence survives reload, exit, mode switch and later session expiry.
- **AC-V2-010:** Expired sessions accept no new evidence.
- **AC-V2-011:** Ready state never marks the Set complete without explicit final confirmation.
- **AC-V2-012:** One accepted final operation creates one historical completion and appropriate monotonic entitlement.
- **AC-V2-013:** A2 unlocks only after every required current A1 Set has historical completion.
- **AC-V2-014:** Later curriculum additions never revoke earned entitlement or terminal C1 completion.
- **AC-V2-015:** Restart creates a new empty-evidence pass and preserves the invalidated pass without credit transfer.
- **AC-V2-016:** Ordinary SET SRS, Review Center and GLOBAL SRS preserve existing due/eligibility behavior and never credit a pass.
- **AC-V2-017:** SRS scheduling, ratings, revisions, Progress, XP and Streak outcomes remain compatible for CEFR-scoped events.
- **AC-V2-018:** A completed Set can start a fresh independent NORMAL run without creating a new pass or restoring stale completed presentation state.
- **AC-V2-019:** Quiz and Speaking create no CEFR evidence and retain existing batch behavior.
- **AC-V2-020:** Current Learning uses the exact active pass and never presents completed/invalidated passes as resumable.
- **AC-V2-021:** Next Suggestion remains independent and does not duplicate an active pass Set.
- **AC-V2-022:** Foreign, locked, private and malformed evidence attempts perform no credit mutation.
- **AC-V2-023:** Concurrent cross-mode events may produce at most one first credit per pass item.
- **AC-V2-024:** Pending NORMAL evidence exposes accessible status, preserves retry identity and blocks only correctness-sensitive actions.
- **AC-V2-025:** Migration preserves only exact accepted V1 pass-linked `NORMAL_REVEALED` evidence with matching USER, pass, Set, session and Vocabulary identities and performs no prohibited historical backfill.
- **AC-V2-026:** The first accepted `AGAIN` immediately credits its exact pass item, repeated `AGAIN` does not add credit, and the existing SRS requeue remains unresolved.
- **AC-V2-027:** After `AGAIN`, choosing **Continue this SRS review session** resumes the exact active queue, while choosing **Continue remaining CEFR items** leaves that session unchanged and selects only uncredited pass items.
- **AC-V2-028:** An unresolved CEFR-scoped SRS session is never silently completed or abandoned, remains directly resumable until completion or expiry, and rejects new ratings after expiry without losing previously accepted CEFR evidence.
- **AC-V2-029:** Backfill alone never completes an active pass or advances CEFR entitlement; a pass made ready by valid backfill still requires explicit USER confirmation.
- **AC-V2-030:** Migration verification preserves existing completed passes and entitlements and stops on missing, foreign, ambiguous or invalid source evidence instead of fabricating credit.

Required later verification must include:

- backend domain/service/repository unit coverage;
- controller/API authorization and validation coverage;
- migration static and isolated PostgreSQL safety coverage;
- frontend service and presentation contract tests;
- mocked Playwright for NORMAL-only, SRS-only, mixed, AGAIN, expiry, restart, relearning, pending focus and responsive states;
- guarded real-stack tests for transactionality, concurrency, multi-tab replay, 10/11/15/20-item boundaries, unlock monotonicity and cross-user isolation; and
- regression coverage for ordinary SRS, GLOBAL review, Review Center, Quiz, Speaking, XP and Streak.

Database-backed and guarded real-stack verification requires separate HUMAN authorization.

## 19. Out of Scope

- C2 progression or Set-level C2.
- CEFR mastery, scoring, accuracy or certification.
- Quiz-based or Speaking-based pass evidence.
- GLOBAL SRS pass evidence.
- Ordinary historical SRS backfill.
- General learning history or per-event analytics.
- SRS algorithm, interval, rating or reward redesign.
- Independent non-due SRS relearning after completion unless separately approved.
- XP, Level, Streak, Daily Goal, Achievement, leaderboard or notification redesign.
- AI recommendations or external services.
- Broad UI redesign or Dashboard analytics.
- General performance optimization unrelated to pending evidence interaction.
- New roles, curriculum ordering UI or `is_required` flag.

## 20. Open HUMAN Decisions

This section is retained as the decision record required by the original draft structure. The HUMAN approved all nine recommended candidates on 2026-11-12; none remains open for PLAN.

| Decision | Proposed resolution candidate | Approval state |
|---|---|---|
| `HD-V2-01` | Extend existing pass-item first-credit fields. | `HUMAN APPROVED — 2026-11-12` |
| `HD-V2-02` | Allow safe concurrent NORMAL/SRS active sessions with immutable snapshots and first-credit deduplication. | `HUMAN APPROVED — 2026-11-12` |
| `HD-V2-03` | Reuse Flashcard presentation and all four SRS ratings for CEFR-scoped SRS. | `HUMAN APPROVED — 2026-11-12` |
| `HD-V2-04` | Credit `AGAIN` immediately for CEFR while its unresolved SRS session remains independent and resumable. | `HUMAN APPROVED — 2026-11-12` |
| `HD-V2-05` | Retain ordinary due-based SRS after historical completion and require independent NORMAL relearning support. | `HUMAN APPROVED — 2026-11-12` |
| `HD-V2-06` | Initially remove the Dashboard Current Learning numeric bar and fraction. | `HUMAN APPROVED — 2026-11-12` |
| `HD-V2-07` | Preserve correctness-sensitive pending locks while allowing safe audio and accessible status. | `HUMAN APPROVED — 2026-11-12` |
| `HD-V2-08` | Add optional pass-session mode with omitted mode defaulting to `NORMAL` for compatibility. | `HUMAN APPROVED — 2026-11-12` |
| `HD-V2-09` | Backfill exact accepted partial V1 NORMAL evidence only after migration-safety validation. | `HUMAN APPROVED — 2026-11-12` |

### HD-V2-01 — Evidence persistence shape

**HUMAN-approved resolution:** extend `CEFR_LEARNING_PASS_ITEM` with immutable first-credit fields.

**Alternative:** add a separate focused pass-item evidence table.

The extension is smaller and matches one-credit semantics. A separate table is justified only if future per-event history is intentionally added, which is outside V2.

### HD-V2-02 — Mixed-mode active sessions

**HUMAN-approved resolution:** allow compatible active sessions from both modes, rely on immutable snapshots and first-credit deduplication, directly resume an exact unresolved SRS session until expiry, and use only sessions containing uncredited items for pass-level CEFR continuation.

**Alternative:** introduce explicit session abandonment/supersession before switching modes.

The alternative produces a cleaner single-active-session invariant but requires a new session lifecycle state and broader regression work.

### HD-V2-03 — Previously unseen CEFR SRS presentation

**HUMAN-approved resolution:** reuse the existing Flashcard card and four ratings with a visible **CEFR SRS study** context. The backend supplies previews even for NEW/non-due items.

**Alternative:** create a separate encounter-only control. This would reduce scheduling side effects but would no longer be SRS and would expand the interaction model.

### HD-V2-04 — AGAIN and pass continuation

**HUMAN-approved resolution:** `AGAIN` credits the pass item immediately; the UI offers separate exact-session and remaining-CEFR continuation actions, and the unresolved SRS session remains independently resumable until completion or expiry.

**Alternative:** require SRS session resolution before another CEFR batch. That conflicts with the approved rule that remembering correctly is not required and may trap AGAIN-only learners.

### HD-V2-05 — Independent SRS after historical completion

**HUMAN-approved resolution:** retain existing due-based ordinary SRS only. Guarantee fresh independent NORMAL relearning in V2.

**Alternative:** add a separate non-due independent SRS purpose. This is useful but not required for CEFR progression and materially enlarges scope.

### HD-V2-06 — Dashboard numeric progress

**HUMAN-approved resolution:** remove the numeric progress bar and fraction from Current Learning initially and show a concise backend-authored state.

**Alternative:** show credited encounters over snapshot size with explicit wording. Numeric display adds validation and copy complexity but can be truthful.

### HD-V2-07 — Pending NORMAL interaction scope

**HUMAN-approved resolution:** keep evidence-changing navigation, completion, restart and mode switch blocked; allow pronunciation playback and passive reading; implement accessible pending/success/error states within V2.

**Alternative:** leave all current controls disabled and move every interaction change to a separate UX task.

Latency measurement and backend performance optimization remain a separate bounded audit under either option.

### HD-V2-08 — Pass-session API compatibility

**HUMAN-approved resolution:** add optional `mode`, defaulting omitted V1 requests to `NORMAL` for compatibility.

**Alternative:** add a separate CEFR-SRS session endpoint. This avoids changing the existing input shape but duplicates lifecycle routing.

### HD-V2-09 — V1 partial NORMAL migration

**HUMAN-approved resolution:** backfill only exact pass-linked accepted `NORMAL_REVEALED` events, including valid partial evidence from active or expired sessions, into immutable first-credit pass-item fields. Backfill must not complete passes or advance entitlement.

**Alternative:** backfill only evidence from completed V1 sessions. This preserves old counted progress but discards exact partial evidence that V2 is specifically intended to honor.

## 21. Approval Gate

```text
DOCUMENT STATUS: HUMAN APPROVED — 2026-11-12
SOURCE FEATURE: CEFR Learning Path V1 — DONE / HUMAN ACCEPTED
CHANGE TYPE: New V2 business rules and additive architecture proposal
SPEC APPROVAL: GRANTED — 2026-11-12
HD-V2-01 THROUGH HD-V2-09: HUMAN APPROVED — 2026-11-12
PLAN AUTHORIZED: YES — DRAFT PLAN AUTHORING ONLY
TASK AUTHORIZED: NO
IMPLEMENTATION AUTHORIZED: NO
SCHEMA / MIGRATION AUTHORIZED: NO
DATABASE / PRISMA AUTHORIZED: NO
COMMIT / PUSH / MERGE / CI AUTHORIZED: NO
NEXT ALLOWED ACTION: HUMAN reviews and decides whether to approve the DRAFT V2 PLAN
```

The HUMAN approved the intentional V1 changes in Section 2.2 and all resolutions in Section 20 on 2026-11-12. No TASK authoring or implementation may begin from SPEC approval alone.
