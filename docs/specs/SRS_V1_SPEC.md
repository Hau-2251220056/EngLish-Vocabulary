# SPEC: SRS V1 — Dual-Mode Flashcard Review

**Feature status:** `DONE — FORMAL TEST PASS / REVIEW APPROVE; PENDING HUMAN CLOSURE APPROVAL`

**SPEC status:** `APPROVED`

**Human approval:** `APPROVED`, including the dual-mode boundary, four-rating stage scheduler, eligibility/session rules, and data/API contract.

**Implementation authorized:** `NO`

**HUMAN-approved contract revision (2026-10-05):** NEW/stage-0 passing ratings use the existing integer-day model: `HARD` = 1 day, `GOOD` = 3 days and `EASY` = 7 days. No schema or migration change is authorized.

## 1. Objective

Extend the completed Flashcard / Learning foundation with two explicit review modes that reuse the same Set context, card content, flip behavior and pronunciation presentation while keeping their session semantics separate:

1. **Ôn tập SRS** — the default mode, containing only SRS-eligible Vocabulary and persisting one of four scheduling ratings.
2. **Ôn tập thường** — a manual browsing mode containing every Vocabulary in the current Set and never mutating Learning Progress or SRS scheduling.

SRS V1 uses a small deterministic stage scheduler. It preserves exact Vocabulary identity, backend-authoritative progress and the completed authorization boundaries without introducing adaptive scheduling, gamification, pronunciation expansion or a broad Flashcard redesign.

## 2. Existing Context and Reconciliation

### 2.1 Feature Status

- Vocabulary Learning Session, Flashcard Learning, Learning Progress and Learning Progress View V1 are `DONE`.
- Set Detail V1 is `DONE` and explicitly deferred SRS scheduling to a separate feature.
- Spaced Repetition SRS V1 is implemented, tested and formally reviewed; Words to Review remains `TODO` in `docs/FEATURE_STATUS.md`.
- This SPEC extends completed behavior; it does not rebuild Set Detail, Flashcard presentation or Learning Progress identity.

### 2.2 Existing Contracts Reused

- The route is `/learn/vocabulary-sets/:setId` under the existing authenticated USER-only Focus Mode.
- A USER may learn a public System Set or an owned private Set. Another USER's private Set is concealed by the safe not-found boundary.
- Cards use exact Set Item `vocabulary_id`, explicit Set Item position and deterministic primary-Meaning presentation.
- Card front/back content, flip, stored-audio/native-TTS behavior, responsive behavior and reduced-motion support remain the completed Flashcard contract.
- Learning Progress is unique by `(user_id, vocabulary_id)` and independent of Set membership.
- Existing event mutation already provides backend-owned timestamps, optimistic revision checks and immediate-current-event idempotency.
- `LEARNING_PROGRESS` already has nullable `next_review_at`, `interval_days` and `ease_factor` fields.

### 2.3 Superseded Assumptions

This SPEC supersedes these parts of the existing Flashcard / Learning V1 contract for the Flashcard route:

- one combined run model;
- two assessment outcomes, `STUDY_AGAIN` and `REMEMBERED`;
- Previous/Next navigation and rating actions sharing one session;
- every Set Item requiring assessment for run completion; and
- SRS fields always remaining null.

SRS V1 instead defines two modes. Existing Previous/Next behavior moves to **Ôn tập thường**. SRS mode has four ratings and no Previous/Next or skip path.

## 3. Actors and Authorization

- **USER:** Can use both modes for a public System Set or an owned private Set. Only SRS ratings may mutate that USER's Learning Progress.
- **Guest:** Cannot enter either authenticated Flashcard mode or mutate progress.
- **ADMIN:** Does not receive the USER Flashcard review flow in V1.

Backend authentication, USER-role authorization, Set access, current Set membership, progress ownership and scheduling are authoritative. Frontend guards and hidden controls are UX only.

## 4. Scope

### 4.1 In Scope

- Default **Ôn tập SRS** and optional **Ôn tập thường** modes within the existing Flashcard route.
- A deterministic stage scheduler with four ratings: **Lại**, **Khó**, **Tốt**, **Dễ**.
- Read-time SRS eligibility and derived due state.
- SRS queue snapshot, `Lại` requeue, completion and same-tab resume/restart behavior.
- Normal review of every current Set Vocabulary with Previous/Next navigation and no mutation.
- Existing Learning Progress persistence extended with real scheduling values.
- Deterministic API, validation, idempotency, failure and concurrency behavior.
- Accessible mode switching, reveal, rating and focus behavior.

### 4.2 Out of Scope

- A global/cross-Set Words to Review page or Dashboard review widget.
- Persistent Learning Session, review history, event ledger or cross-device session resume.
- FSRS, SM-2, adaptive ease/stability/difficulty or lapse history.
- User-configurable schedules, custom intervals or daily new-word limits.
- Undo or changing a rating after successful submission.
- XP, Level, Streak, Daily Goal, Achievement, leaderboard or other gamification.
- Pronunciation Practice, speech recording, recognition or evaluation changes.
- Quiz scheduling integration or new Quiz types.
- Notifications, background schedulers or cron jobs.
- Topic/Set aggregate progress, analytics or broad Flashcard visual redesign.

## 5. Vocabulary and Progress Identity

- Every card and queue entry is keyed by exact `vocabulary_id`; spelling is never an identity or deduplication key.
- Durable progress remains one row per `(user_id, vocabulary_id)`.
- The same exact Vocabulary referenced by multiple Sets shares one progress record and schedule.
- Canonical and private Vocabulary with different UUIDs remain independent even when their text is identical.
- Removing a Vocabulary from a Set, or deleting a Set, does not delete Learning Progress.
- No Set, Set Item, Topic or Meaning foreign key is added to Learning Progress.

## 6. Mode Contract

### 6.1 Mode Selection

- The Flashcard header exposes two labelled mode controls: **Ôn tập SRS** and **Ôn tập thường**.
- **Ôn tập SRS** is selected by default on a direct route entry with no valid same-tab mode state.
- The active mode is programmatically exposed and visually distinguishable without relying on color.
- Switching modes does not change the route or refetch unauthorized data.
- Switching never rolls back or alters a successfully persisted SRS rating.
- Each mode keeps separate transient same-tab state for the same USER and Set.

### 6.2 Shared Presentation

Both modes reuse:

- the current Focus Mode and Set context;
- exact card content and deterministic primary Meaning;
- front-to-back reveal behavior;
- pronunciation behavior and error isolation;
- responsive/mobile/tablet/desktop structure;
- visible focus, reduced motion and safe overflow behavior.

SRS V1 changes the mode/session/action area only. It does not authorize unrelated visual redesign.

## 7. Normal Review Contract

- **Ôn tập thường** contains all current Set Items in explicit `position ASC` order.
- It uses **Thẻ trước** and **Thẻ sau** for positional browsing. Navigation may remain available on both sides as permitted by the current implementation contract.
- It displays no SRS rating buttons.
- Reveal, navigation, pronunciation, mode switching, reload and restart create no Learning Progress row and mutate no status, count, revision or scheduling field.
- Positional progress is displayed deterministically as **Thẻ X / N**, where `N` is the current normal-mode snapshot size and `X` is the one-based current position.
- Restart returns to the first current card and front side. It never resets durable progress.
- Normal-mode reload/return in the same tab may restore a valid current exact Vocabulary ID; otherwise it starts at the first current card.
- A genuinely empty Set uses the existing accessible empty-Set behavior and return/manage action.

## 8. SRS V1 Scheduler

### 8.1 Authoritative Time

- Backend UTC time is authoritative for eligibility, accepted rating time and `next_review_at`.
- Equality is due: `next_review_at <= evaluated_at` is eligible.
- Client time is display-only and cannot submit or calculate authoritative schedule fields.
- Tests must use an injected/fixed backend clock.

### 8.2 Stages and Intervals

SRS V1 uses these exact stages:

| Stage | Stable interval |
|---:|---:|
| 0 | none / NEW or reset LEARNING |
| 1 | 1 day |
| 2 | 3 days |
| 3 | 7 days |
| 4 | 14 days |
| 5 | 30 days |

One day is exactly 24 hours after backend acceptance. Stage 5 is capped at 30 days.

The existing nullable `interval_days` encodes the stable stage:

- `null` = stage 0;
- `1` = stage 1;
- `3` = stage 2;
- `7` = stage 3;
- `14` = stage 4;
- `30` = stage 5.

No separate `srs_stage` field is required for V1. `ease_factor` remains unused and null/unchanged.

### 8.3 Rating Semantics

#### `AGAIN` — **Lại**

- Means the learner did not remember.
- Sets persisted status to `LEARNING`.
- Resets `interval_days` to null/stage 0.
- Sets `next_review_at` to the backend acceptance time, so it is immediately due.
- Does not complete that Vocabulary for the current SRS session.
- Requeues it according to section 10.

#### `HARD` — **Khó**

- Means the learner remembered with difficulty.
- Retains the current stable stage.
- For NEW, stage 0, reset or legacy-unscheduled progress, schedules stage 1 / 1 day.
- Sets persisted status to `LEARNED` and completes the Vocabulary for the current session.
- Does not requeue it in the same session.

#### `GOOD` — **Tốt**

- Means normal successful recall.
- Advances one stage.
- NEW/stage 0 is the explicit first-review exception and becomes stage 2 / 3 days.
- Stage 5 remains stage 5 / 30 days.
- Sets persisted status to `LEARNED` and completes the Vocabulary for the current session.

#### `EASY` — **Dễ**

- Means very strong recall.
- Advances two stages.
- NEW/stage 0 is the explicit first-review exception and becomes stage 3 / 7 days.
- Stage 5 remains stage 5 / 30 days.
- Sets persisted status to `LEARNED` and completes the Vocabulary for the current session.

For `HARD`, `GOOD` and `EASY`, the backend sets `next_review_at = accepted_at + resulting interval`. After `AGAIN`, a later passing rating starts from stage 0 according to the selected rating.

### 8.4 Deterministic Rating Matrix

| Current stage | `AGAIN` | `HARD` | `GOOD` | `EASY` |
|---:|---:|---:|---:|---:|
| 0 / NEW | 0 / due now | 1 / 1d | 2 / 3d | 3 / 7d |
| 1 / 1d | 0 / due now | 1 / 1d | 2 / 3d | 3 / 7d |
| 2 / 3d | 0 / due now | 2 / 3d | 3 / 7d | 4 / 14d |
| 3 / 7d | 0 / due now | 3 / 7d | 4 / 14d | 5 / 30d |
| 4 / 14d | 0 / due now | 4 / 14d | 5 / 30d | 5 / 30d |
| 5 / 30d | 0 / due now | 5 / 30d | 5 / 30d | 5 / 30d |

Every newly accepted rating increments existing `review_count` and `revision` once and updates backend-owned `last_reviewed_at` and `last_event_id` once.

### 8.5 Learner-Facing Rating Preview Wording

The backend-authoritative rating preview for the current card supplies the exact resulting interval from the same deterministic scheduler used by mutation. The UI maps only that authoritative result to these approved learner-facing subtexts:

| Preview result | Vietnamese subtext |
|---|---|
| `AGAIN` / same-session requeue / no future interval | `Trong phiên này` |
| 1 day | `Ngày mai` |
| 3 days | `1–3 ngày` |
| 7 days | `1 tuần+` |
| 14 days | `2 tuần` |
| 30 days | `30 ngày` |

`1–3 ngày` and `1 tuần+` are intentionally learner-friendly categories; they do not replace or loosen the exact persisted 3-day and 7-day schedules. `2 tuần` and `30 ngày` are exact, unambiguous descriptions of the 14-day and 30-day results. The frontend must not derive scheduler transitions or hardcode a fixed rating-to-day mapping.

## 9. Eligibility and Effective Status

### 9.1 States

- **NEW:** No Learning Progress row exists. Eligible now at stage 0.
- **LEARNING:** Persisted after `AGAIN`, with stage 0 and immediate due time. Always eligible for the next snapshot until passed.
- **LEARNED:** Persisted after `HARD`, `GOOD` or `EASY` while `next_review_at` is in the future. Not eligible.
- **NEEDS_REVIEW / DUE:** Effective read state for scheduled learned progress where `next_review_at <= evaluated_at`. Eligible without requiring a database rewrite.

`NEEDS_REVIEW` is derived at read time. Merely becoming due or reading progress does not mutate status, revision, counters or timestamps and requires no cron job.

### 9.2 Legacy Progress

Existing rows enter SRS V1 deterministically without bulk backfill:

- A persisted `LEARNING` row is eligible at effective stage 0, regardless of legacy scheduling values.
- A persisted `NEEDS_REVIEW` row is eligible. A valid ladder `interval_days` supplies its stable stage; a null/non-ladder interval uses stage 0.
- A persisted `LEARNED` row with both a valid ladder interval and `next_review_at` uses that schedule: future means not eligible and due/past means eligible at the encoded stage.
- A persisted `LEARNED` row missing either part of a valid schedule is legacy-unscheduled and eligible immediately. A valid ladder interval, if present, supplies its stage; otherwise it uses stage 0.
- The next accepted rating writes a complete valid V1 schedule from that effective stage.
- Existing identity, `review_count`, `revision` and `last_reviewed_at` remain unchanged until that explicit rating.

## 10. SRS Session and Queue

### 10.1 Snapshot

- An eligibility snapshot is established when SRS mode first loads or explicitly restarts.
- The snapshot includes only current Set Items that are NEW, LEARNING, DUE or legacy-unscheduled at one backend `evaluated_at` timestamp.
- Vocabulary that becomes due only because time passes during the active session is not injected dynamically.
- Initial ordering is deterministic:
  1. eligible items with existing progress (LEARNING, DUE and legacy), in Set Item `position ASC` order;
  2. NEW items, in Set Item `position ASC` order.
- Set Item position is unique within a Set; exact `vocabulary_id ASC` is the defensive final tie-breaker.
- No persistent server Learning Session is created.

### 10.2 SRS Interaction

- The learner first recalls from the front and reveals the back.
- The four rating controls appear only after reveal.
- SRS mode provides no **Thẻ trước**, **Thẻ sau**, skip or browse-around-rating path.
- Selecting a rating submits immediately. A successful response commits the result and advances to the next queue occurrence.
- A successfully rated occurrence cannot be rated again, undone or changed in V1.

### 10.3 `AGAIN` Requeue

- `AGAIN` inserts one pending occurrence of the exact Vocabulary after at least three other card presentations when possible.
- The distance counts presentations, not unique Vocabulary IDs.
- When fewer than three other presentations remain, the occurrence is placed at the end of the current queue.
- When it is the only unresolved Vocabulary, it becomes the next occurrence after the card resets to its front.
- The queue must contain at most one pending occurrence for a given Vocabulary. Before inserting, any stale pending duplicate for that exact ID is removed/reconciled.
- Repeated `AGAIN` repeats the rule but never creates simultaneous duplicate pending entries.
- The Vocabulary becomes complete only after a later `HARD`, `GOOD` or `EASY` succeeds.
- Exiting after `AGAIN` but before reappearance loses no durable result: it remains immediately due and is eligible next time.

### 10.4 SRS Progress Representation

SRS V1 displays **Đã hoàn thành X / N**:

- `N` is the fixed number of unique eligible Vocabulary IDs in the initial snapshot.
- `X` is the number of those unique IDs whose latest successful rating in this session is `HARD`, `GOOD` or `EASY`.
- `AGAIN` does not increment `X` and requeue does not increase `N`.
- Presentation count may be announced as supporting status text but is not the completion denominator.
- The session completes when `X = N` and no unresolved pending occurrence remains.

This representation stays truthful even as `AGAIN` changes the number of presentations.

### 10.5 Resume and Reconciliation

- Same-tab transient state may store the mode, snapshot timestamp, ordered exact IDs, queue occurrences, cursor, completed exact IDs and pending rating retry context in the existing Learning-owned `sessionStorage` namespace.
- Reload/return fetches fresh authorization/current membership, then reconciles transient state by exact `vocabulary_id` without adding newly due items to the active snapshot.
- A removed Set Item is removed from the active queue; its Learning Progress remains.
- A newly added Set Item waits for restart/new snapshot.
- Invalid/corrupt state fails closed to a fresh SRS snapshot.
- Logout/session invalidation clears only the Learning-owned namespace as already required.

## 11. Mode Switching, Restart and Empty States

### 11.1 Switching Modes

- Switching from SRS to normal review preserves the current transient SRS queue in the same tab.
- Switching back resumes that valid SRS snapshot; it does not recompute eligibility merely because time passed.
- Switching does not cancel an in-flight rating. Mode controls are disabled while a rating is pending.
- Normal review maintains its own positional cursor independently.

### 11.2 Restart

- **SRS restart:** after confirmation when the session has accepted ratings, clears only transient SRS state and requests a new eligibility snapshot at current backend time. Durable ratings remain. A recent `AGAIN` remains eligible; a recent passing rating is normally future-due and excluded.
- **Normal restart:** returns to the first current Set Item/front side without confirmation unless existing generic UX requires it. It performs no progress mutation.
- Restart in either mode never resets Learning Progress or SRS fields.

### 11.3 Empty and Up-to-Date States

- A Set with zero Set Items preserves the existing accessible empty-Set state in both modes.
- A non-empty Set with zero SRS-eligible items shows an accessible completed/up-to-date state, not an empty or broken card.
- The SRS up-to-date state provides a clear **Ôn tập thường** action and return-to-Set action. It may show the nearest future due time returned by the backend.
- Normal review for that same non-empty Set still contains every Set Item.

### 11.4 Direct Route

- Direct entry to `/learn/vocabulary-sets/:setId` selects SRS by default and performs the same backend access checks as entry from Set Detail.
- Guest follows the existing authentication path; ADMIN is forbidden; inaccessible/missing private Sets remain concealed.
- Malformed/missing Set, truly empty Set, non-empty up-to-date SRS and operational failure remain distinct safe states.

## 12. Persistence and Data Requirements

### 12.1 Reused Fields

SRS V1 reuses `LEARNING_PROGRESS`:

- `user_id`, `vocabulary_id` and their existing unique constraint;
- `status`;
- `interval_days` as the V1 stable-stage encoding;
- `next_review_at`;
- `last_reviewed_at`;
- `review_count`, `revision`, `last_event_id`;
- existing timestamps.

`ease_factor` remains unused. No SRS history, lapse, session or event-ledger table is added.

### 12.2 Minimum Schema Impact

- No new domain entity is required.
- No new `srs_stage` column is required because the approved intervals map one-to-one to stages.
- The current positive-if-present `interval_days` rule remains valid. PLAN must determine whether strengthening it to the exact ladder values is safe for existing data; this SPEC requires service-level normalization/validation regardless.
- Index changes are not assumed. PLAN may propose a due-query index only with query evidence and migration analysis.
- Existing foreign keys and deletion rules remain unchanged.

## 13. API Contract

All Learning endpoints remain authenticated USER-only, derive `user_id` from the session and return the existing success/error envelopes.

### 13.1 Read/Session Contract

Retain `GET /api/learning/sets/:setId` and add an exact optional `mode` query:

- omitted or `mode=SRS`: return the default SRS snapshot;
- `mode=NORMAL`: return all current Set cards in Set Item position order;
- repeated, empty, unknown or unsupported mode values: `400 VALIDATION_ERROR`.

Shared response data retains Set ID/name/topic and approved complete card content. Mode-specific metadata is:

**SRS response:**

- `mode: "SRS"`;
- backend `evaluated_at`;
- total Set Item count;
- fixed initial eligible unique count;
- eligible cards in section 10.1 order;
- nullable nearest future `next_review_at` for the up-to-date state;
- per-card exact ID plus effective status, stored status, stable stage/interval, `next_review_at`, `review_count`, `revision` and `last_reviewed_at`.
- per-card `rating_previews` for `AGAIN`, `HARD`, `GOOD` and `EASY`, calculated at the response's single `evaluated_at` by the same pure scheduler used by mutation; each preview exposes the authoritative resulting stage/interval while `AGAIN` exposes no future interval.

**NORMAL response:**

- `mode: "NORMAL"`;
- total Set Item count;
- all cards in Set Item position order;
- no requirement for SRS mutation controls.

Both reads are mutation-free. They expose no other USER's data, private owner internals, `last_event_id`, rewards or client-editable schedule.

An accessible Set with no Items retains `409 LEARNING_SET_EMPTY`. A non-empty Set with zero SRS eligibility succeeds with an empty SRS card collection and truthful up-to-date metadata.

### 13.2 Rating Mutation Contract

Retain `POST /api/learning/events`, but the SRS V1 request replaces obsolete `outcome` values with an exact `rating`:

```json
{
  "event_id": "uuid",
  "set_id": "uuid",
  "vocabulary_id": "uuid",
  "expected_revision": 0,
  "rating": "GOOD"
}
```

Allowed ratings are exactly `AGAIN`, `HARD`, `GOOD`, `EASY`. Unknown or extra fields, invalid UUIDs, invalid revision or any former `STUDY_AGAIN`/`REMEMBERED` payload return `400 VALIDATION_ERROR` after SRS V1 activation.

The backend transactionally:

1. authenticates/authorizes USER;
2. revalidates accessible Set and current exact membership;
3. validates expected revision;
4. derives current stage from authoritative progress;
5. calculates status, interval and timestamp from the rating and backend clock;
6. updates all progress/schedule fields atomically; and
7. returns the authoritative accepted result.

The success response includes exact `vocabulary_id`, stored/effective status, stage, `interval_days`, `next_review_at`, `last_reviewed_at`, `review_count` and `revision`. The frontend uses this authoritative response, not local schedule calculation, to advance/requeue; the submitted rating remains the client command context.

Normal review never calls this endpoint.

### 13.3 Idempotency and Conflicts

- The first accepted current `event_id` wins.
- Immediate retry with that current event ID returns the already-stored authoritative result without another increment or schedule recalculation.
- Changing the payload while reusing an already-accepted event ID does not change the accepted result; the client must treat the returned authoritative result as final.
- A different event with stale `expected_revision` returns `409 LEARNING_PROGRESS_CHANGED`.
- No arbitrary historical replay guarantee or event ledger is added.
- Existing `LEARNING_SET_NOT_FOUND`, `LEARNING_SET_EMPTY`, `LEARNING_SET_ITEM_CHANGED`, authentication, authorization and safe internal-error boundaries remain.

### 13.4 Learning Progress Read Compatibility

`GET /api/learning/progress` remains read-only and must evaluate its summary, filter and items at one backend `evaluated_at` timestamp:

- scheduled learned rows due at/before that timestamp are represented/countable/filterable as effective `NEEDS_REVIEW`;
- future scheduled rows are `LEARNED`;
- reset/immediately-due stage-0 rows remain `LEARNING`;
- legacy-unscheduled rows keep a documented compatibility presentation but are SRS-eligible;
- reading never writes an automatic status transition.

Detailed response-shape synchronization belongs to PLAN, but the Progress page and SRS session must not disagree about whether a learned scheduled word is due.

## 14. Failure and Optimistic-Update Behavior

- A rating is incomplete until the backend confirms success.
- While pending, all four ratings and both mode controls are disabled; duplicate submission and navigation away within the Flashcard UI are prevented.
- The frontend may show pending feedback but must not increment completion, advance, requeue or display a new schedule optimistically.
- Network/unknown failure preserves the revealed card, selected rating, event ID and expected revision. Retry reuses that event ID.
- `LEARNING_PROGRESS_CHANGED` discards inconclusive local assumptions, refreshes authoritative progress and reconciles the SRS session by exact ID. If still eligible, the learner deliberately rates again with a new event ID.
- `LEARNING_SET_ITEM_CHANGED` removes the stale queue item after refresh without deleting progress.
- Audio failure never blocks reveal, rating or navigation and never mutates progress.
- Mode switch or page exit after confirmed success cannot undo the persisted rating.

## 15. Accessibility and Keyboard Contract

- Both mode controls have accessible names, expose selected state and support standard keyboard activation.
- The card remains keyboard-revealable using its existing accessible interaction. No new shortcut keys are required.
- On reveal, focus moves according to the existing revealed-answer heading contract, after which the four native rating buttons are reachable in DOM order: **Lại**, **Khó**, **Tốt**, **Dễ**.
- Each rating button presents its primary rating name and the section 8.5 subtext. Its accessible name or description must communicate both without relying on color or tooltip-only content.
- `Enter` and `Space` activate the focused native rating button. A rating is impossible before reveal or while pending.
- After a successful rating, focus moves to the next card's front/heading; on completion, focus moves to the completion heading.
- When an `AGAIN` card returns, an appropriate live status announces that it is being shown again.
- Normal Previous/Next controls retain standard keyboard behavior and visible focus.
- Mode switching places focus at the selected mode's primary heading/state without unexpected card mutation.
- Pending, error, up-to-date, empty, requeue and completion messages use appropriate `status`/`alert` semantics and never rely only on color.
- Existing reduced-motion, mobile touch-target, responsive no-overflow and pronunciation accessibility requirements remain.

## 16. Business Rules

- **BR-SRS-01:** SRS is the default Flashcard mode; normal review is explicitly selectable.
- **BR-SRS-02:** SRS mode has four ratings and no Previous/Next, skip, undo or rating change after success.
- **BR-SRS-03:** Normal review contains all Set Vocabulary and never mutates Learning Progress or scheduling.
- **BR-SRS-04:** Backend time, progress, eligibility and scheduling responses are authoritative.
- **BR-SRS-05:** `AGAIN` resets to stage 0, remains unresolved and requeues once at the deterministic distance.
- **BR-SRS-06:** `HARD`, `GOOD` and `EASY` complete the current Vocabulary and schedule according to the fixed matrix.
- **BR-SRS-07:** An active snapshot does not dynamically acquire items that become due through time passage.
- **BR-SRS-08:** Effective `NEEDS_REVIEW` is derived without cron or read-time mutation.
- **BR-SRS-09:** Exact `vocabulary_id` and `(user_id, vocabulary_id)` identity rules remain unchanged across Sets and private/canonical Vocabulary.
- **BR-SRS-10:** Set membership removal never deletes progress.
- **BR-SRS-11:** Switching modes/restarting affects transient state only and never rolls back accepted ratings.
- **BR-SRS-12:** SRS V1 adds no adaptive algorithm, history, gamification, pronunciation expansion or unrelated redesign.

## 17. Acceptance Criteria

- **AC-SRS-01:** Direct Flashcard entry selects SRS and returns only NEW, LEARNING, DUE and legacy-eligible exact Set Vocabulary in deterministic non-NEW-before-NEW order.
- **AC-SRS-02:** Normal review returns every current Set Item in position order, provides Previous/Next positional browsing and causes zero progress/schedule mutation.
- **AC-SRS-03:** SRS ratings appear only after reveal; SRS exposes no Previous/Next or skip path.
- **AC-SRS-04:** `AGAIN`, `HARD`, `GOOD` and `EASY` produce exactly the approved stage/status/due results for every matrix row, including NEW = 1/3/7 days for `HARD`/`GOOD`/`EASY`, and the 30-day cap; their UI previews use section 8.5 wording from backend-authoritative preview results.
- **AC-SRS-05:** `AGAIN` requeues after three other presentations when possible, otherwise at queue end, and never creates simultaneous duplicate pending entries.
- **AC-SRS-06:** Repeated `AGAIN` stays unresolved until a later passing rating; exiting early leaves it due for a future session.
- **AC-SRS-07:** SRS progress uses fixed unique snapshot denominator `N`; only passed unique items increment `X`; requeues do not inflate either value.
- **AC-SRS-08:** Items becoming due after snapshot time are not injected until restart/new session.
- **AC-SRS-09:** A non-empty Set with no eligible SRS items shows up-to-date state and can switch clearly to normal review; a true empty Set remains distinct.
- **AC-SRS-10:** Legacy-unscheduled rows enter immediately at effective stage 0 without bulk backfill and receive valid scheduling only after explicit rating.
- **AC-SRS-11:** Due equality uses backend time, and Learning Progress reads agree with SRS eligibility without read-time writes.
- **AC-SRS-12:** Immediate same-event retry does not increment or recalculate; stale different events conflict; failed events do not advance/requeue optimistically.
- **AC-SRS-13:** Mode switching preserves separate transient state and all accepted durable ratings; each restart follows its mode-specific contract.
- **AC-SRS-14:** Exact shared Vocabulary progress is reused across Sets, membership removal preserves it, and same-spelling different UUIDs remain independent.
- **AC-SRS-15:** Guest, ADMIN, non-owner, stale membership and malformed request boundaries retain safe existing authorization/error behavior.
- **AC-SRS-16:** Reveal, mode selection, four ratings, navigation and focus flows are keyboard/assistive-technology operable without new custom shortcuts.
- **AC-SRS-17:** No XP, streak, Daily Goal, Achievement, persistent session/history, adaptive SRS, pronunciation expansion or broad redesign is introduced.

## 18. Deterministic Verification Requirements

Tests must use fixed backend timestamps and explicit UUIDs. Coverage must include:

- every stage/rating matrix cell and due-time result;
- immediately before, exactly at and after `next_review_at`;
- NEW, reset LEARNING, future LEARNED, derived DUE and each legacy-unscheduled variant;
- priority/order of existing eligible items before NEW;
- one-, two-, three- and larger-queue `AGAIN` spacing;
- repeated `AGAIN` duplicate prevention and later pass from stage 0;
- fixed SRS completion denominator under requeue;
- no dynamic injection after snapshot;
- SRS versus normal read and mutation isolation;
- mode switch, reload reconciliation and both restart behaviors;
- same-event retry, changed/stale event, concurrency and operational failure;
- exact-ID cross-Set sharing, same-spelling identity separation and membership removal;
- empty Set versus up-to-date SRS state;
- authorization and keyboard/focus/live-region behavior;
- unchanged card content, pronunciation isolation and no gamification side effects.

## 19. Documentation and Dependency Impact

SRS V1 depends on completed Authentication, Vocabulary, Vocabulary Set, Set Detail, Flashcard / Learning and Learning Progress capabilities.

After HUMAN SPEC approval, a later PLAN must assess and synchronize:

- `docs/DATABASE.md` for active stage/scheduling semantics;
- `docs/API_SPEC.md` for dual-mode reads and four-rating mutation;
- `docs/UI_UX_SPEC.md` and the existing Flashcard checkpoint for the two-mode action contract;
- `docs/FEATURE_STATUS.md` for the approved workflow state;
- existing backend/frontend implementation and relevant tests.

This draft does not authorize those changes.

## 20. Explicitly Deferred to V2+

- FSRS, SM-2 or any adaptive scheduler.
- Per-user configurable scheduler or custom intervals.
- Review history, analytics, lapse history or arbitrary historical event replay.
- Undo/change rating after submission.
- Daily new-word/review limits, bury, suspend or leech behavior.
- Global/cross-Set review queue and duplicate-consolidation UX.
- Persistent/cross-device sessions and offline synchronization.
- XP, Streak, Daily Goal, Achievement or other gamification.
- Pronunciation Practice expansion.
- Quiz-to-SRS scheduling integration.
- Notifications, reminders and broad Flashcard redesign.

## 21. Open Questions

None. The HUMAN-approved product direction resolves the material V1 product decisions. Detailed file/schema/index mechanics belong to a separately authorized PLAN.

The SPEC and its HUMAN-approved timing revision were implemented through the approved PLAN/TASK workflow. Formal TEST is PASS and formal REVIEW is APPROVE; commit/integration remain gated by HUMAN closure approval.
