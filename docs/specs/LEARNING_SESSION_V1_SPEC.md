# SPEC: Learning Session V1

**Feature status:** `CHANGE REQUEST — SPEC READY FOR HUMAN APPROVAL`

**SPEC status:** `READY FOR HUMAN APPROVAL`

**Implementation authorized:** `NO`

## 1. Problem Statement and Goals

The current learning activities have separate transient run behavior, but they do not share a complete, explicit contract for bounded batches, durable same-tab completion screens, full-Set completion, or safe reconciliation when Set membership changes.

Learning Session V1 defines that cross-mode contract for four authenticated USER activities:

1. NORMAL Flashcard;
2. SRS Flashcard;
3. Multiple Choice Quiz; and
4. Speaking Practice.

The goal is to let a USER open a learning mode and begin immediately with at most 10 distinct Vocabulary items, leave and return within the same browser tab, and continue or revisit the correct session state without creating a database-backed session model.

Learning Session V1 coordinates transient presentation state only. It does not redefine Vocabulary identity, Set authorization, Quiz correctness, SRS scheduling, Speaking recognition, or durable Learning Progress.

### 1.1 Actors and Authorization

- **USER:** May use sessions for a public System Set or an owned private Set under the existing mode-specific access rules.
- **Guest:** Cannot enter authenticated learning sessions.
- **ADMIN:** Does not receive the USER learning-session flows.

The Backend remains authoritative for authentication, USER role, Set access, current Set membership, Quiz grading, Learning Progress and SRS scheduling. Stored client session state is never an authorization source.

## 2. Scope and Non-Goals

### 2.1 In Scope

- Automatic start when the USER opens a learning mode; no session-selection screen.
- A maximum of 10 distinct Vocabulary IDs in one batch/session unit.
- Independent state for each authenticated USER, Set and learning mode.
- Ordered batching for NORMAL Flashcard, Quiz and Speaking using Vocabulary Set Item order.
- A bounded SRS session containing at most 10 distinct currently eligible Vocabulary IDs while preserving the approved SRS priority, scheduling and `AGAIN` behavior.
- Same-tab resume at the previous valid position.
- Preserved completed-batch and full-Set-completion screens on same-tab re-entry.
- Explicit USER action to advance from one completed batch to the next.
- Explicit restart as the only way to replace a preserved full-Set completion with a new latest-content session.
- One original ordered exact-ID snapshot for the complete NORMAL Flashcard, Quiz or Speaking run, including batches not yet started.
- Versioned, non-sensitive `sessionStorage` state containing ordered exact Vocabulary IDs and the current cursor plus the minimum mode-specific state needed for safe resume.
- In-memory page-lifetime fallback when `sessionStorage` is unavailable.
- Safe reconciliation when Set items are added, removed or reordered.
- Graceful handling of malformed, stale, unavailable or quota-blocked `sessionStorage`.
- Responsive, keyboard-accessible loading, active, completed, empty, stale and recovery states.

### 2.2 Out of Scope / Non-Goals

- XP, Level, Daily Goal, Streak, Achievement, leaderboard, ranking or rewards.
- Mastery or an assertion that finishing a batch/Set means the Vocabulary is mastered.
- Reminders, notifications or midnight/daily reset behavior.
- AI selection, adaptive item selection or a new correctness/scheduling algorithm.
- A database Learning Session, Quiz Session, attempt/history, event ledger or analytics model.
- Cross-tab, cross-browser, cross-device, account-level or offline session synchronization.
- New Quiz types, Quiz history, persistent Quiz scores or new Quiz XP behavior.
- New SRS stages, ratings, intervals, eligibility rules or forced inclusion of future-scheduled cards.
- Speaking transcript, recognition result, confidence, audio, attempt or pronunciation-score persistence.
- Learning Progress mutation from NORMAL Flashcard or Speaking Practice.
- Changes to Set ownership, visibility, Vocabulary identity, authentication, authorization, schema, API architecture or external services.

## 3. User Flows

### 3.1 Shared Entry and Restoration

1. An authenticated USER opens one learning mode for an accessible Set.
2. The mode begins directly; no session-selection screen is shown.
3. The frontend obtains fresh Backend-authorized Set/mode data before trusting stored session state.
4. The frontend loads the independent `sessionStorage` record for the current USER, Set and mode.
5. If the record is valid, unfinished, and reconcilable, the mode resumes at its previous valid exact Vocabulary ID/cursor.
6. If the current batch is completed, its completion screen is restored rather than starting or advancing automatically.
7. If the full Set snapshot is completed, the full-Set completion screen is restored until explicit restart.
8. If no valid session exists, a new session snapshot starts automatically from current authorized content.

### 3.2 NORMAL Flashcard

1. The mode snapshots current Set Vocabulary IDs in Set Item order and selects the first batch of at most 10 IDs.
2. The current card preserves the existing flip/reveal, reference audio and Previous/Next behavior.
3. Viewing, flipping, playing audio and navigating never create or update Learning Progress.
4. On the final available card of the current batch, the UI displays **Hoàn thành phiên**.
5. The batch becomes complete only after the USER activates **Hoàn thành phiên**; merely reaching or viewing the final card is insufficient.
6. The completed-batch screen is preserved on same-tab re-entry.
7. If unprocessed snapshot IDs remain, **Học tiếp N từ** explicitly opens the next ordered batch of at most 10 IDs, where `N` is its actual size.
8. If no snapshot IDs remain, the full-Set completion screen is preserved until the USER selects **Học lại từ đầu**.

NORMAL Flashcard adds no familiarity assessment, `REMEMBERED`/`STUDY_AGAIN` action, correctness decision, or Learning Progress mutation.

### 3.3 SRS Flashcard

1. Direct SRS entry uses the existing Backend-authoritative eligibility snapshot and ordering rules.
2. At most 10 distinct eligible Vocabulary IDs enter the SRS session snapshot.
3. Future-scheduled Vocabulary is not forced into the session and is not injected merely because time passes.
4. The USER reveals a card and submits one of the existing four ratings: `AGAIN`, `HARD`, `GOOD`, or `EASY`.
5. The Backend applies the existing authoritative scheduler, revision and idempotency rules.
6. `AGAIN` preserves the approved requeue behavior and does not increase the distinct-session denominator or complete that Vocabulary.
7. `HARD`, `GOOD`, or `EASY` completes that Vocabulary for the current review session.
8. When the fixed bounded snapshot is resolved, the current review-session completion screen is preserved on same-tab re-entry and uses **Hoàn thành ôn tập** as status text.
9. **Ôn tiếp** begins a further review session only through explicit USER action and a fresh Backend eligibility evaluation.
10. A non-empty Set with no currently eligible Vocabulary displays **Hoàn thành ôn tập** as status text, not as a forced restart action. This state is distinct from having just completed a bounded review session and distinct from a genuinely empty Set.
11. Future due reviews remain discoverable through the existing nearest-future-due/up-to-date contract and become eligible in a later fresh session at the authoritative time.

SRS has no full-Set mastery completion. Completion means only that the current bounded eligible review snapshot has been resolved.

### 3.4 Multiple Choice Quiz

1. Quiz begins directly in the sole active `MULTIPLE_CHOICE` mode.
2. The session snapshots ordered current Set Vocabulary IDs and selects at most 10 questions for the current batch.
3. Each question retains the existing Backend-constructed four-choice contract, hidden answer, authoritative grading, question revision, exact-ID checks, event retry protection and Progress mutation behavior.
4. Accepted answers and the current cursor are preserved for same-tab resume.
5. Completing the final question preserves the current batch result screen, including total, correct and incorrect counts.
6. The result screen presents separate actions to:
   - continue explicitly through **Học tiếp N từ**, where `N` is the actual next-batch size, when snapshot IDs remain; and
   - retry through **Làm lại nhóm này** using the same still-valid batch Vocabulary IDs.
7. A completed Quiz batch never resets automatically.
8. **Làm lại nhóm này** creates a fresh Quiz run with a new `run_id`, obtains fresh authoritative question data and revisions, and reuses no stale choice ID or previous submission. It preserves all already accepted Backend Learning Progress updates and does not advance to the next batch.
9. After all snapshot batches are completed, full-Set completion remains preserved until the USER selects **Học lại từ đầu**.

Retrying a batch does not reset durable Learning Progress and does not introduce Quiz history, a persistent score, XP, or a second grading path.

### 3.5 Speaking Practice

1. Speaking starts from the first ID in the current ordered batch of at most 10 Set Vocabulary IDs.
2. The existing target, nullable phonetic text, reference playback, microphone disclosure, browser recognition, feedback classification, retry, skip, Previous/Next and cleanup behavior remain in force.
3. The mode stores the current exact Vocabulary ID/cursor and batch/session lifecycle state for same-tab resume.
4. It does not store transcript alternatives, confidence, recognition outcome, raw audio, attempt state or pronunciation score in `sessionStorage` or persistent storage.
5. On resume, the target returns in a safe non-listening state. Recognition never auto-starts, and previous transient recognition feedback is not restored.
6. Completion of the current batch is preserved on re-entry.
7. **Luyện tiếp N từ** explicitly starts the next ordered batch, where `N` is its actual size.
8. Full-Set completion remains preserved until the USER selects **Học lại từ đầu**.

Speaking Practice never updates Learning Progress, SRS scheduling, XP or other gamification.

## 4. Business Rules

### Shared Session Rules

- **BR-LS-001:** Opening a learning mode starts or restores that mode automatically; V1 has no session-selection screen.
- **BR-LS-002:** One batch contains at most 10 distinct exact Vocabulary IDs.
- **BR-LS-003:** Session identity is scoped by authenticated USER, Vocabulary Set and learning mode; one scope cannot overwrite another.
- **BR-LS-004:** NORMAL Flashcard, Quiz and Speaking snapshot Vocabulary in authoritative Set Item order.
- **BR-LS-005:** SRS preserves its approved eligibility and non-NEW-before-NEW ordering and limits the resulting snapshot to at most 10 distinct IDs.
- **BR-LS-006:** Unfinished valid sessions resume at their previous valid exact Vocabulary ID/cursor in the same tab.
- **BR-LS-007:** A completed batch screen is preserved on re-entry and never advances automatically.
- **BR-LS-008:** Moving to another batch or starting another SRS review session requires explicit USER action.
- **BR-LS-009:** Full-Set completion for NORMAL Flashcard, Quiz and Speaking remains preserved until explicit restart.
- **BR-LS-010:** Session or batch completion is presentation state and does not imply Vocabulary mastery.
- **BR-LS-011:** Sessions have no midnight, calendar-day or inactivity reset.
- **BR-LS-012:** V1 session persistence uses `sessionStorage` only and gives no cross-tab or cross-device synchronization guarantee.
- **BR-LS-013:** Stored client state is non-authoritative and cannot grant Set access, establish membership, grade Quiz answers, calculate SRS schedules or mutate Learning Progress.
- **BR-LS-014:** An explicit restart discards only the selected transient mode session and starts from the latest authorized content; it never resets durable Progress or scheduling.
- **BR-LS-014A:** NORMAL Flashcard, Quiz and Speaking preserve the original ordered exact-ID snapshot for the whole current run, including unstarted batches; only **Học lại từ đầu** captures the latest Set order and membership for a new full run.

### Mode Rules

- **BR-LS-015:** NORMAL Flashcard preserves flip, reference audio and Previous/Next and requires **Hoàn thành phiên** on the final card to complete the batch.
- **BR-LS-016:** NORMAL Flashcard introduces no familiarity assessment and performs no Learning Progress mutation.
- **BR-LS-017:** SRS includes no more than 10 distinct currently eligible Vocabulary IDs and never forces a future-scheduled item into the current snapshot.
- **BR-LS-018:** SRS retains all four ratings, scheduling rules, Backend time, revision/idempotency protections and `AGAIN` requeue semantics.
- **BR-LS-019:** SRS current-session completion, no-currently-eligible state and genuinely empty Set are distinct states.
- **BR-LS-020:** Quiz contains at most 10 questions per batch and retains Backend-authoritative construction, grading, revisions, idempotency and retry protections.
- **BR-LS-021:** Quiz preserves a completed batch result and provides distinct continue-next-batch and retry-current-batch actions when applicable.
- **BR-LS-022:** Quiz never automatically resets a completed batch and adds no history or XP behavior.
- **BR-LS-022A:** **Làm lại nhóm này** creates a new Quiz `run_id` for the same still-valid current-batch Vocabulary IDs, fetches fresh authoritative questions/revisions, discards stale choices/submissions, preserves accepted Progress mutations and does not advance batches.
- **BR-LS-023:** Speaking contains at most 10 ordered Vocabulary IDs per batch and retains permission/disclosure, recognition, feedback, retry, skip and cleanup behavior.
- **BR-LS-024:** Speaking session storage never contains transcripts, alternatives, confidence, recognition results, audio, attempts or pronunciation scores.
- **BR-LS-025:** Speaking performs no Learning Progress, SRS or gamification mutation.

### Integrity and Reconciliation Rules

- **BR-LS-026:** Stored state includes the ordered exact Vocabulary IDs of the session snapshot, batch boundaries/current batch IDs and current cursor; spelling is never an identity key.
- **BR-LS-027:** Newly added Set items never enter an already-created current batch unexpectedly.
- **BR-LS-028:** A completed session remains completed when Set content is added, removed or reordered; only explicit restart adopts the latest content.
- **BR-LS-029:** An unfinished session reconciles stored IDs against fresh authorized content without treating stored state as proof of membership.
- **BR-LS-030:** Removed or unavailable IDs cannot be presented or submitted after reconciliation; their durable Progress, if any, is not deleted.
- **BR-LS-031:** Reordering does not silently replace or duplicate exact IDs in the active batch.
- **BR-LS-032:** Malformed, unsupported-version, wrong-identity or unrecoverable state is ignored safely and never blocks entry to a fresh authorized session.
- **BR-LS-033:** Storage read/write/remove failure degrades gracefully; the learning activity remains usable for the current page lifetime where possible.
- **BR-LS-034:** Authentication loss, logout or Set access loss overrides client resume state and preserves existing safe authorization behavior.
- **BR-LS-035:** If `sessionStorage` is inaccessible or a write fails, the mode falls back to in-memory page-lifetime state without blocking learning or showing a disruptive warning by default; reload may lose local position.
- **BR-LS-036:** Storage failure must never replay an already accepted Quiz answer or SRS rating; existing authoritative responses, retry identities, revisions and idempotency protections remain controlling.
- **BR-LS-037:** Approved new labels are exact: **Hoàn thành phiên**, **Học tiếp N từ**, **Làm lại nhóm này**, **Luyện tiếp N từ**, **Học lại từ đầu**, **Ôn tiếp**, and status text **Hoàn thành ôn tập**. Existing approved labels remain unchanged where these actions do not apply.

## 5. Session State Transitions

### 5.1 Shared State Model

```text
NO_SESSION
    -> LOADING_AUTHORIZED_CONTENT
    -> ACTIVE_BATCH

ACTIVE_BATCH
    -> ACTIVE_BATCH (cursor/action progress)
    -> RECOVERING (stale content, conflict or retryable failure)
    -> BATCH_COMPLETED (explicit mode-specific completion)

BATCH_COMPLETED
    -> ACTIVE_BATCH (explicit next-batch action, if items remain)
    -> FULL_SET_COMPLETED (final ordered batch for NORMAL/Quiz/Speaking)
    -> ACTIVE_BATCH (explicit retry-current-batch, Quiz only)

SRS_SESSION_COMPLETED
    -> LOADING_AUTHORIZED_CONTENT (explicit new-review-session action)
    -> SRS_UP_TO_DATE (no eligible items at fresh evaluation)
    -> ACTIVE_BATCH (eligible items exist)

FULL_SET_COMPLETED
    -> ACTIVE_BATCH (**Học lại từ đầu** using latest content/order)

ANY_STATE
    -> UNAVAILABLE (authorization/access/Set failure)
    -> NO_SESSION (explicit restart replacement or invalid unrecoverable state)
```

`BATCH_COMPLETED` and `FULL_SET_COMPLETED` are stored lifecycle states, not conclusions about mastery. For the final NORMAL/Quiz/Speaking batch, the completion presentation may represent both batch and full-Set completion without requiring an automatic intermediate transition.

### 5.2 Completion Triggers

- NORMAL Flashcard: explicit **Hoàn thành phiên** on the final available batch card.
- SRS: every distinct ID in the fixed session snapshot has a successful passing rating and no unresolved `AGAIN` occurrence remains.
- Quiz: every question in the current batch has one accepted authoritative answer.
- Speaking: the existing explicit navigation/skip completion path reaches the end of the current batch; recognition success is not required.

## 6. Storage Identity, Restoration and Expiration Semantics

### 6.1 Storage Identity

Each record is isolated by at least:

- schema/version;
- authenticated `user_id`;
- exact `set_id`;
- stable mode identity: `NORMAL_FLASHCARD`, `SRS_FLASHCARD`, `MULTIPLE_CHOICE_QUIZ`, or `SPEAKING_PRACTICE`.

Quiz may retain its internal `run_id`, and mode-specific retry tokens may be stored only where required by an already approved idempotency contract. Stored state must not include secrets, cookies, raw API responses beyond the required transient projection, or data belonging to another USER.

### 6.2 Minimum Restorable State

Shared minimum state:

- ordered full-session snapshot Vocabulary IDs where full-Set batching applies;
- ordered current batch Vocabulary IDs;
- batch index/boundary or equivalent deterministic position;
- current exact Vocabulary ID/cursor;
- lifecycle state: active, batch-completed or full-Set-completed;
- format version.

Mode-specific minimum state may include:

- SRS queue occurrences, fixed initial distinct IDs, passed IDs, snapshot time and inconclusive rating retry context;
- Quiz run ID, question revisions/progress revisions, accepted outcomes needed for the current result, and inconclusive answer retry context;
- Speaking/Flashcard card-side or presentation state only if later PLAN proves it necessary and it does not violate the privacy boundary.

### 6.3 Restoration

- Restoration always follows a fresh authentication and Set-access check.
- Exact Vocabulary IDs are reconciled with fresh mode data before display or mutation.
- A valid current ID is restored; otherwise reconciliation chooses a safe remaining position according to section 7 without duplicating or silently adding items to the current batch.
- SRS and Quiz retry contexts remain subject to their existing authoritative revision/conflict handling.
- Speaking restores only positional lifecycle state and returns to a safe idle/ready recognition state.

### 6.4 Expiration and Cleanup

- V1 defines no application TTL, inactivity timeout or midnight expiration.
- State lasts only for the browser's `sessionStorage` lifetime for that tab/window, subject to browser behavior and USER clearing site data.
- Logout or observed authentication invalidation clears only ELVocab-owned learning-session namespaces for the affected frontend session, preserving unrelated storage.
- Explicit restart replaces only the selected USER/Set/mode session state.
- Unsupported-version, malformed or wrong-identity records are ignored and may be removed from the owned namespace.
- Storage unavailability is not a fatal learning error and does not authorize fallback to `localStorage`, cookies or Backend persistence.
- When storage is unavailable, the mode uses in-memory state for the current page lifetime, does not show a disruptive warning by default, and documents that reload may lose local session position.
- In-memory fallback cannot infer mutation acceptance from UI position. Quiz/SRS retry state must preserve the current page's accepted/inconclusive distinction and use existing event identity/revision protections so a reload or storage failure never deliberately replays an accepted mutation.

## 7. Handling Set Changes and Stale Session State

### 7.1 Fresh Authorization Is Mandatory

Every entry/re-entry fetches or reuses only freshly authorized mode data under existing API rules. A stored Set ID or Vocabulary ID cannot bypass concealed not-found, role or membership checks.

### 7.2 Added Items

- Added items do not enter the current batch or any unstarted batch in the current run.
- For an unfinished full-Set snapshot, V1 never expands the stored snapshot. Only **Học lại từ đầu** captures the latest membership and order.
- A completed session remains completed; restart adopts the latest authorized order/content.

### 7.3 Removed Items

- Removed IDs are excluded from further presentation and mutation after fresh reconciliation.
- If the current ID was removed, the session moves to a safe remaining ID without duplicating completed work; if none remains, it reaches the appropriate completed or empty/unavailable presentation.
- Removal from a Set never deletes durable Learning Progress.
- A removed SRS queue occurrence is removed from the transient queue under the existing SRS contract.

### 7.4 Reordered Items

- The current run preserves its original ordered exact-ID snapshot across the current and all unstarted batches.
- Set reordering never changes current-run batch boundaries/order, repeats a valid ID or skips a valid still-accessible snapshot ID.
- Reconciliation removes only deleted/inaccessible items and preserves already completed/accepted work and the relative order of all remaining original snapshot IDs.
- Only **Học lại từ đầu** captures the latest authoritative Set order for a new full run.

### 7.5 Changed Content and Revisions

- Fresh card/question content remains authoritative.
- Quiz question/choice changes use existing revision conflict behavior; stale stored results cannot grade a changed question locally.
- SRS Progress changes use existing revision refresh/reconciliation behavior.
- Speaking discards transient recognition output and retries only against the current authoritative target.
- Completed session lifecycle remains preserved across content edits, additions, removals and reorders, but not across loss of authorization or deletion/unavailability of the Set itself.

## 8. Quiz and SRS Correctness / Integrity Constraints

### 8.1 Quiz

- The Backend remains the only authority for choice construction, hidden correct-choice identity and grading.
- Batching cannot expose a correct marker, move grading to the frontend or weaken `question_revision` reconstruction.
- Only the exact current batch Vocabulary IDs are questions; distractor fallback does not change batch count/order or become Progress targets.
- One accepted answer mutates only the asked Vocabulary under the existing exactly-once, revision and event retry boundary.
- Resume and retry never synthesize accepted answers from cursor position alone.
- **Làm lại nhóm này** creates a new `run_id` for the same still-valid current-batch Vocabulary IDs and requests fresh authoritative questions, choice IDs and revisions. It carries forward no previous selection, submission, accepted batch result or stale choice ID.
- Already accepted Backend Learning Progress mutations remain durable and are never reversed or resubmitted merely because the batch is retried.
- The fresh run preserves existing retry, question revision, Progress revision and event idempotency protections.
- Continue-next-batch cannot occur before the current batch result is complete and requires explicit action.

### 8.2 SRS

- Backend UTC time remains authoritative for eligibility, rating acceptance and `next_review_at`.
- The maximum-10 limit is applied after the existing eligibility and deterministic priority/order rules.
- The bounded session contains no future-scheduled item and does not dynamically gain items that become due after its snapshot.
- `AGAIN` may create repeated presentations but never a second distinct denominator entry or simultaneous duplicate pending occurrence.
- Passing ratings and `AGAIN` preserve the approved stage matrix, status mapping, event idempotency and optimistic revision behavior.
- Completing the current bounded review session neither marks the Set mastered nor suppresses future due reviews.
- A fresh subsequent review session re-evaluates eligibility; it does not consume a client-invented remainder queue.

## 9. Responsive UX, Accessibility and Empty States

### 9.1 Shared UX

- The activity starts/restores directly and identifies the current mode, Set and truthful batch/session progress.
- Completion screens distinguish **batch complete**, **full Set complete**, **current SRS review complete**, and **no reviews currently eligible**.
- Explicit next, retry and restart actions use these exact applicable labels and accessible names:
  - NORMAL final-card completion: **Hoàn thành phiên**;
  - Flashcard/Quiz next batch: **Học tiếp N từ**;
  - Quiz current-batch retry: **Làm lại nhóm này**;
  - Speaking next batch: **Luyện tiếp N từ**;
  - NORMAL/Quiz/Speaking full-run restart: **Học lại từ đầu**;
  - SRS new review session: **Ôn tiếp**;
  - SRS no-current-review/finished status text: **Hoàn thành ôn tập**, which is not a forced restart action.
- `N` always equals the actual number of valid IDs in the next batch after safe reconciliation.
- Existing approved labels remain unchanged where none of these new actions applies.
- A destructive-looking restart confirmation explains that transient session state changes while durable Learning Progress/scheduling is not reset.
- Loading does not render a premature empty or completed state.
- Storage degradation falls back silently to in-memory page-lifetime state by default, does not prevent learning, and may use non-disruptive explanatory copy where the reload limitation must be communicated.

### 9.2 Accessibility

- Native buttons/controls remain keyboard-operable with visible focus and correct disabled/pending semantics.
- Progress and completion meaning is communicated by text and semantics, never by color alone.
- Focus moves predictably to a restored target, next batch heading, result/completion heading or actionable error/recovery region.
- Status and error announcements are concise and do not repeatedly announce every storage write or interim Speaking transcript.
- Mode-specific radio, rating, reveal, playback and recognition semantics remain unchanged.
- Touch targets follow project conventions, content wraps without horizontal overflow, and reduced-motion preferences remain respected.

### 9.3 Empty and Unavailable States

- **Genuinely empty Set:** no Set Items; preserve existing safe empty-Set behavior.
- **SRS up to date:** non-empty Set but zero currently eligible items; show **Hoàn thành ôn tập** as status text and future-due information when the existing API provides it, without forcing restart.
- **SRS session completed:** the bounded eligible snapshot was resolved; preserve its completion screen with **Hoàn thành ôn tập** status text until explicit **Ôn tiếp** action.
- **Reconciled batch empty:** all stored batch IDs were removed/unavailable; safely reconcile to remaining snapshot content or a truthful completed/empty state without adding new items to that batch.
- **Inaccessible/missing Set:** existing concealed-not-found/authorization behavior overrides stored state.
- **Quiz choices unavailable:** preserve existing atomic safe failure; do not shrink the question, fabricate choices or mark the batch complete.
- **Speaking unsupported/permission/service failure:** preserve target/navigation/recovery behavior and never treat the session as a pronunciation failure.

## 10. Testable Acceptance Criteria and Edge Cases

### 10.1 Acceptance Criteria

- **AC-LS-001:** Opening any of the four modes starts a fresh valid session or restores its independent same-tab session without a session-selection screen.
- **AC-LS-002:** No batch/session snapshot contains more than 10 distinct Vocabulary IDs; SRS re-presentations after `AGAIN` do not violate this distinct-ID limit.
- **AC-LS-003:** NORMAL Flashcard, Quiz and Speaking batch IDs follow the captured authoritative Set Item order without duplicates.
- **AC-LS-004:** USER A/User B, Set A/Set B and all four mode states remain isolated in `sessionStorage`.
- **AC-LS-005:** Reload/re-entry restores an unfinished valid session to its previous valid exact ID/cursor and never uses spelling as identity.
- **AC-LS-006:** Re-entry to a completed batch or full-Set session preserves its completion/result screen and performs no automatic reset or advance.
- **AC-LS-007:** Next batch/new SRS review session begins only after explicit USER action.
- **AC-LS-008:** No session resets because of midnight, date change or inactivity while its same-tab `sessionStorage` remains available.
- **AC-LS-009:** NORMAL Flashcard completes only after **Hoàn thành phiên** is activated on the final available batch card; flip, audio and Previous/Next remain usable and cause no Progress write.
- **AC-LS-010:** SRS includes at most 10 currently eligible distinct IDs, preserves rating/scheduler/requeue integrity and excludes future-scheduled or newly-due-after-snapshot items.
- **AC-LS-011:** SRS session-completed, up-to-date/no-eligible and truly empty Set states are observably distinct; completed/up-to-date presentation uses **Hoàn thành ôn tập** as status text rather than a forced action, and future due reviews remain available to later fresh sessions.
- **AC-LS-012:** Quiz presents at most 10 questions, grades only on the Backend and retains question revision, event retry, stale/conflict and exactly-once Progress protections.
- **AC-LS-013:** A completed Quiz batch preserves its authoritative total/correct/incorrect result and offers separate applicable actions for next batch and retry-current-batch; it never resets automatically.
- **AC-LS-014:** Speaking restores position only in a non-listening safe state and never stores transcript, alternatives, confidence, result, attempt, audio or score.
- **AC-LS-015:** Speaking preserves permission/disclosure, recognition feedback, retry, skip and cleanup and causes no Progress/SRS/XP mutation.
- **AC-LS-016:** Added items do not enter the current batch; removed IDs cannot be presented/submitted; reordering cannot duplicate or replace active-batch identities.
- **AC-LS-017:** Completed sessions remain completed after Set content edits and adopt the latest content only after explicit restart, subject to continued Set access.
- **AC-LS-018:** Malformed JSON, unsupported version, wrong user/Set/mode identity, unavailable storage and quota/security failures degrade safely without authorization bypass or application crash.
- **AC-LS-019:** Explicit restart replaces only the selected transient mode session with latest authorized content and never resets durable Progress, SRS scheduling or another mode's session.
- **AC-LS-020:** Completion and progress copy never claims mastery solely from batch/session/full-Set completion.
- **AC-LS-021:** Guest, ADMIN, foreign-private Set and session-expiry boundaries retain the existing safe authorization behavior regardless of stored client state.
- **AC-LS-022:** Active, loading, recovery, empty, batch-completed, full-Set-completed and SRS-up-to-date states are keyboard/screen-reader usable, retain visible focus, avoid color-only meaning and remain responsive without horizontal overflow.
- **AC-LS-023:** V1 introduces no schema/migration, persistent session/history, cross-device sync, XP/gamification, AI selection, reminders, new dependency or correctness/scheduling algorithm change.
- **AC-LS-024:** The original ordered exact-ID snapshot remains authoritative for every current and unstarted NORMAL/Quiz/Speaking batch; reorder preserves remaining relative order, deletion/inaccessibility is reconciled safely, additions wait for **Học lại từ đầu**, and no valid remaining ID is repeated or skipped.
- **AC-LS-025:** **Làm lại nhóm này** creates a fresh Quiz `run_id` for the same valid current-batch IDs, loads fresh questions/choices/revisions, carries no stale submission, preserves accepted Progress, does not advance, and retains retry/revision/idempotency protections.
- **AC-LS-026:** All approved action/status labels appear exactly in their applicable contexts, and every `N` reports the actual reconciled next-batch size.
- **AC-LS-027:** When `sessionStorage` fails or is inaccessible, learning continues with in-memory page-lifetime state without a disruptive default warning; reload-position loss is documented, no mutation is auto-submitted during restoration, and accepted Quiz/SRS mutations are never replayed because of storage failure.

### 10.2 Required Edge Cases

- Set sizes of 0, 1, 9, 10, 11, 20 and 21 items.
- Duplicate spellings with different Vocabulary IDs.
- Reload on the first, middle and final item before completion.
- Reload after batch completion and after full-Set completion.
- Midnight/date change while a tab session remains active.
- New Set item added before, within or after the positions represented by the current batch.
- Current, completed and future-batch items removed.
- Set reordered while a batch is active and while the session is completed.
- Set deleted, made inaccessible or no longer owned.
- Corrupt JSON, wrong version, wrong USER/Set/mode key, partial arrays, duplicate IDs and invalid cursor.
- `sessionStorage` unavailable, full or throwing on read/write/remove.
- Quiz lost response, same-event retry, stale question, changed choice and concurrent Progress update.
- Quiz retry of a completed current batch and continue to an 11th question in a second batch.
- SRS with 0, 1, 10 and more than 10 eligible IDs.
- SRS `AGAIN` as the only unresolved card, repeated `AGAIN`, and future due time crossing during an active session.
- Speaking reload while recognition is active, permission denied, unsupported API, no speech, vendor/network failure and stale recognition events after target change.
- Logout/session invalidation with unrelated `sessionStorage` keys present.

## 11. Dependencies, Impact, Technical Boundary and Risks

### 11.1 Dependencies and Expected Impact

- **Frontend:** Existing Learning, Quiz and Speaking transient state will require coordinated versioned batching/restoration behavior in a later approved PLAN.
- **Backend/API:** Existing authorization, Learning/SRS and Quiz contracts remain authoritative. Whether the existing read payloads can bound Quiz/SRS sessions without contract changes must be determined in PLAN; this SPEC does not approve an API change.
- **Database:** No schema, migration or persistent session entity.
- **Learning Progress:** Existing Flashcard/SRS/Quiz mutation behavior remains authoritative; NORMAL Flashcard and Speaking remain read-only.
- **Documentation:** After SPEC approval, PLAN must identify necessary synchronization in `API_SPEC.md`, `UI_UX_SPEC.md`, `ARCHITECTURE.md` and `FEATURE_STATUS.md`. This SPEC stage changes none of those contracts/statuses.

### 11.2 Open Decisions and Technical Blockers

- **Unresolved business decisions:** None. HUMAN has resolved Set reorder behavior, Quiz current-batch retry identity, exact new Vietnamese labels and unavailable-storage fallback.
- **Known technical blockers:** None identified at SPEC stage.
- **PLAN boundary:** PLAN must determine the smallest safe storage/state shapes and whether existing read APIs can enforce bounded Quiz/SRS data without weakening Backend authority. If that investigation proves an API-contract change necessary, it must be proposed explicitly and approved under the normal API/documentation gate; this SPEC does not pre-approve such a change.

### 11.3 Risks

- Existing learning modes use different storage shapes and completion semantics; unsafe consolidation could regress idempotent retries or leak state across modes.
- Client snapshots can become stale while Backend content and Progress remain live; exact-ID reconciliation must never become authorization or correctness logic.
- Limiting SRS after eligibility/order selection must not accidentally make future-due cards eligible or break `AGAIN` queue behavior.
- Quiz batching may require careful Backend reconstruction so a client cannot select arbitrary question IDs or weaken deterministic grading.
- Browser `sessionStorage` lifetime, privacy modes and quota behavior vary; V1 cannot guarantee resume when storage is unavailable or cleared.
- Preserving completion across Set edits requires enough non-sensitive summary state to render truthfully without retaining prohibited Speaking data or trusting obsolete Quiz correctness.

## 12. Approval Gate

```text
LEARNING SESSION V1 SPEC STATUS: READY FOR HUMAN APPROVAL
PLAN AUTHORIZED: NO
TASK AUTHORIZED: NO
IMPLEMENTATION AUTHORIZED: NO
```

After HUMAN approval, the next allowed stage is PLAN. No application code, tests, API contract, schema, dependency or feature-status change is authorized by this SPEC.
