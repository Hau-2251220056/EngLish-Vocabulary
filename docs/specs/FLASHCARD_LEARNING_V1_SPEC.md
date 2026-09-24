# SPEC: Flashcard / Learning V1

**Feature status:** `TODO`

**SPEC status:** `APPROVED`

**Human approval:** `APPROVED`, including the clarified meaningful-assessment counter, current-event retry boundary, Learning-owned run-state cleanup and TASK-051 deterministic primary-Meaning presentation decision.

**Implementation authorized:** `NO`

## 1. Objective

Deliver a focused authenticated USER learning flow that consumes an accessible Vocabulary Set in its explicit Item order, presents each Vocabulary as a multi-meaning flashcard, and records an explicit learner self-assessment as durable per-Vocabulary Learning Progress.

Flashcard / Learning V1 establishes the smallest reliable boundary for later SRS, Words to Review, Quiz, Pronunciation Practice and gamification without implementing those features now.

## 2. Existing Context and Reconciliation

- Topic, Vocabulary and Vocabulary Set V1 are complete. The materialized content path is `TOPIC -> VOCABULARY_SET -> VOCABULARY_SET_ITEM -> VOCABULARY -> VOCABULARY_MEANING -> VOCABULARY_EXAMPLE`.
- Set Items reference Vocabulary, not a particular Meaning. Learning Progress remains unique per `(user_id, vocabulary_id)` and is independent of the Set through which the Vocabulary was learned.
- The current Prisma schema has no Learning Progress or Learning Session model. The backend/frontend have no `/api/learning` implementation or learning route.
- `docs/DATABASE.md` describes planned Learning Progress fields and the states `NEW`, `LEARNING`, `LEARNED`, `NEEDS_REVIEW`. V1 materializes the approved progress subset and preserves nullable future scheduling fields without implementing an SRS algorithm.
- `docs/API_SPEC.md` contains generic draft `/api/learning/sets/:setId` and review directions. This SPEC finalizes the V1 learning payload/event boundary; conflicting draft examples must be synchronized after approval and before implementation.
- Flashcard playback may use an existing `pronunciation_url` value. V1 does not generate audio, call an external provider, record the learner or evaluate pronunciation.

## 3. Actors and Authorization

- **Guest:** Cannot start or update a learning flow. Public System Set discovery/detail remains available through the completed Vocabulary Set feature.
- **USER:** Can learn an accessible non-empty System Set or an owned non-empty private User Set and can update only their own Learning Progress.
- **ADMIN:** Does not receive a learner flow in V1. ADMIN Vocabulary/Set management remains unchanged.

Backend authentication, accessible-Set checks, Set membership checks and ownership of progress are authoritative. Frontend route guards and hidden navigation are UX only.

An accessible Set for learning is exactly:

1. a public System Set; or
2. a private User Set whose `owner_id` is the authenticated USER.

Another USER's private Set is not disclosed and returns the same safe not-found result as a missing Set.

## 4. Scope

### In Scope

- USER-only Flashcard learning from one accessible, non-empty Vocabulary Set.
- Ordered traversal using `VOCABULARY_SET_ITEM.position`.
- Complete card payload with Vocabulary metadata and all owned Meanings/Examples.
- Explicit reveal followed by one self-assessment per visited card: `REMEMBERED` or `STUDY_AGAIN`.
- Durable Learning Progress per `(user_id, vocabulary_id)` with immediate-retry idempotency and stale-event revision protection.
- Previous/next navigation, progress indication, restart, same-tab resume and completed-run summary.
- Accessible loading, empty, stale-content, validation, authorization and operational error states.
- Keyboard and responsive behavior, plus a mandatory UI/UX design checkpoint before final frontend implementation.

### Out of Scope / Deferred

- Quiz and correctness scoring.
- Pronunciation Practice, speech recording, recognition or evaluation.
- XP, Level, Streak, Achievement, Daily Goal or Dashboard integration.
- Community and public User Sets.
- AI or external content generation.
- Full SRS/SM-2 algorithm, due-date calculation, review queue or Words to Review screen.
- Topic aggregate progress and Continue Learning dashboard cards.
- Persistent Learning Session/history tables, cross-device resume or learning analytics history.
- Adding/removing/reordering Vocabulary Set content from the learning screen.

## 5. Learning Session Lifecycle

### 5.1 Start

1. USER selects **Học bộ từ** from an accessible Set detail.
2. Frontend requests the complete learning payload from the backend.
3. Backend revalidates authentication, Set accessibility and that the Set has at least one Item.
4. Backend returns the Set metadata and cards sorted by one-based Item `position`.
5. The run starts at the first card unless a valid same-tab resume cursor exists.

Starting or merely viewing/revealing a card is not a meaningful learning event and does not create or update Learning Progress.

### 5.2 Active Run

- The front shows the English word, phonetic text when present and an optional model-pronunciation control when `pronunciation_url` exists.
- **Hiện đáp án** reveals the complete back. Self-assessment controls remain unavailable until reveal.
- The learner explicitly chooses `REMEMBERED` or `STUDY_AGAIN`. Only that explicit action is a meaningful learning event.
- A successful event updates progress and marks the current card completed for this run. The learner may then move forward; Previous remains available to inspect cards but does not create another event.
- If the learner submits a different outcome again for a previously assessed card in the same run, it is a new explicit event with a new event ID and replaces the current progress state according to the latest outcome.

### 5.3 Resume and Restart

- V1 has no persisted server-side Learning Session entity.
- The frontend may store only non-sensitive run state in `sessionStorage`, keyed by authenticated USER ID and Set ID: current Vocabulary ID/cursor and Vocabulary IDs assessed in the current run.
- On reload or return within the same browser tab, the frontend fetches a fresh authorized learning payload, reconciles the stored cursor by Vocabulary ID and resumes when that Vocabulary still exists.
- Invalid/stale resume state is discarded safely and the run starts from the first current Item.
- **Bắt đầu lại** clears only the current client run cursor/outcome markers and returns to the first card. It does not delete or reset durable Learning Progress.
- The Flashcard/Learning frontend owns a dedicated run-state namespace and clears that namespace when it observes logout or session invalidation. Auth internals do not know or manipulate Flashcard-specific storage keys.
- Cross-device/cross-browser resume is deferred.

### 5.4 Completion

- A run is complete when every card in the fetched learning payload has one successful explicit assessment in the current run.
- Completion is a client run state, not a persisted domain record and not a qualifying XP/Streak event in V1.
- The summary reports total cards, `REMEMBERED` count and `STUDY_AGAIN` count for this run and offers **Học lại bộ từ** and **Quay lại bộ từ**.
- Reopening a completed Set starts a new run while retaining existing durable Learning Progress.

## 6. Flashcard Content and Multi-Meaning Rules

Each card represents one Vocabulary and contains:

- `id`, `word`, nullable `phonetic`, nullable `pronunciation_url`;
- all Meanings with `id`, `part_of_speech`, `meaning_vi`, nullable `context`, nullable `cefr_level`;
- all Examples owned by each Meaning with `id`, `example_en`, nullable `example_vi`;
- the authenticated USER's current progress status for that Vocabulary, or conceptual `NEW` when no row exists.

The backend payload retains every Meaning and its owned Examples. The V1 Flashcard UI focuses each Vocabulary card on one deterministic primary Meaning: the lowest non-null CEFR in `A1 → A2 → B1 → B2 → C1 → C2` order; ties and Meanings without CEFR use the existing `created_at`, then `id`, order. The revealed back presents that primary Meaning's part of speech, CEFR, Vietnamese meaning, optional context and owned Examples. This is a presentation rule only: it does not create a primary flag, duplicate CEFR, alter the Vocabulary aggregate or create Set-specific Meaning selection.

Because the current content models have no approved display-order field, Meanings and Examples use deterministic `created_at`, then `id`, ordering. V1 does not add speculative ordering fields to Vocabulary content.

The model-pronunciation control is rendered only for a valid stored `pronunciation_url`. Playback failure produces safe retryable UI feedback and never changes progress.

## 7. Learning Progress Contract

### 7.1 Data Boundary

V1 materializes one `LEARNING_PROGRESS` row per USER plus Vocabulary:

- UUID `id`;
- UUID `user_id` foreign key to USER;
- UUID `vocabulary_id` foreign key to VOCABULARY;
- `status`: `LEARNING` or `LEARNED` for rows created by this V1;
- `review_count`, default `0`: the count of successful meaningful learning/review assessments recorded for this USER and Vocabulary. It is not an SRS-only counter; both V1 outcomes increment it once.
- non-negative `revision`, default `0`, for optimistic event ordering;
- nullable `last_reviewed_at`;
- nullable UUID `last_event_id` identifying the most recently accepted event for immediate-retry idempotency;
- nullable future SRS fields `next_review_at`, `interval_days`, `ease_factor`;
- `created_at`, `updated_at`;
- unique `(user_id, vocabulary_id)`.

`NEW` is the conceptual API/UI state when no progress row exists; V1 does not need to persist a row merely to represent `NEW`.

`NEEDS_REVIEW` remains an approved future state but Flashcard / Learning V1 never assigns it because no due-date/SRS algorithm is approved. Future SRS work may transition a learned word to `NEEDS_REVIEW` without changing the per-USER/per-Vocabulary identity rule.

`correct_count` and `incorrect_count` remain deferred because Flashcard self-assessment is not objective Quiz correctness. V1 must not misclassify `REMEMBERED`/`STUDY_AGAIN` as quiz answers.

### 7.2 Meaningful Event Rules

- `REMEMBERED` creates or updates progress to `LEARNED`.
- `STUDY_AGAIN` creates or updates progress to `LEARNING`.
- Both successful outcomes increment `review_count` once because each is a successful meaningful learning/review assessment, and set `last_reviewed_at` to backend time. The counter is not limited to future SRS reviews.
- A request supplies the progress `expected_revision` last returned by the backend. An immediate retry of the currently accepted client-generated UUID `event_id` returns the already-current progress without incrementing again.
- A delayed or reordered older event has a stale `expected_revision` and is rejected with `LEARNING_PROGRESS_CHANGED`; the frontend must refresh the card progress before offering a new assessment.
- V1 does not claim arbitrary historical event replay idempotency and adds no event-history/ledger table. Its safety boundary is immediate retry of the current event plus revision rejection of older/different stale events.
- A new `event_id` is a new explicit self-assessment, even for the same Vocabulary in the same run.
- Reveal, previous/next navigation, audio playback, reload, resume, restart and completion-summary viewing do not mutate progress.
- The backend derives `user_id`, validates Set accessibility and verifies that the Vocabulary is currently an Item of the addressed Set before any update.

### 7.3 Referential Behavior

- USER deletion behavior follows the project's future User lifecycle policy and is not redesigned here.
- Vocabulary deletion must be `RESTRICT` while Learning Progress references it, protecting learned-state integrity.
- Vocabulary Set deletion or Item removal does not delete Learning Progress because progress is Set-independent.
- No direct Learning Progress relation to Topic, Set, Set Item or Meaning is added.

## 8. SRS Boundary

Flashcard / Learning V1 creates the durable inputs later SRS can consume but implements no scheduling algorithm.

- `last_reviewed_at` and `review_count` are updated by meaningful events.
- `next_review_at`, `interval_days` and `ease_factor` remain `null` in V1.
- No SM-2 score, quality grade, due-date calculation, review queue, cron job or automatic `NEEDS_REVIEW` transition is introduced.
- No separate SRS table is created.
- A future approved SRS SPEC must define algorithm, grading inputs, transitions, date/timezone rules and migration/backfill behavior.

## 9. API Requirements

All V1 learning endpoints require an authenticated `USER`.

| Method / path | Success | Requirement |
|---|---:|---|
| `GET /api/learning/sets/:setId` | `200` | Return one currently accessible non-empty Set with ordered complete Flashcards and current per-card progress state. |
| `POST /api/learning/events` | `200` | Idempotently apply one explicit Flashcard self-assessment and return the resulting progress record. |

The event request contains only:

```json
{
  "event_id": "uuid",
  "set_id": "uuid",
  "vocabulary_id": "uuid",
  "expected_revision": 0,
  "outcome": "REMEMBERED"
}
```

`outcome` is exactly `REMEMBERED` or `STUDY_AGAIN`. The client cannot submit status, user ID, counters, timestamps, SRS values, XP, Streak or completion state.

Success bodies use `{ "success": true, "data": ... }`. Errors use `{ "success": false, "error": { "code": "...", "message": "safe message" } }`.

| Condition | Status | Code |
|---|---:|---|
| Invalid UUID/body/outcome/unsupported field | `400` | `VALIDATION_ERROR` |
| Missing or inaccessible Set | `404` | `LEARNING_SET_NOT_FOUND` |
| Empty accessible Set | `409` | `LEARNING_SET_EMPTY` |
| Vocabulary is no longer in the Set | `409` | `LEARNING_SET_ITEM_CHANGED` |
| A different event used a stale progress revision | `409` | `LEARNING_PROGRESS_CHANGED` |
| Missing/invalid session | `401` | existing `AUTHENTICATION_FAILED` |
| Authenticated non-USER | `403` | existing `FORBIDDEN` |
| Unexpected failure | `500` | `INTERNAL_SERVER_ERROR` |

The backend must not expose another USER's private Set, raw database errors, credentials, session values or internal persistence details.

## 10. Frontend and UI/UX Requirements

### 10.1 Route and Entry Points

- Add only `/learn/vocabulary-sets/:setId` beneath the existing `ProtectedRoute`, `UserRoute` and `AuthenticatedShell`.
- Public System Set detail shows a learning action only for authenticated USERs; Guest receives the existing login path and ADMIN receives no learner action.
- Owned private Set detail exposes the same USER learning action when the Set is non-empty.
- No standalone USER Vocabulary catalog or generic learning dashboard is introduced.

### 10.2 Required States

- authorization/session initialization;
- learning-payload loading;
- empty Set;
- inaccessible/not-found Set;
- stale Set Item requiring payload refresh/restart;
- safe operational load/event/audio error with retry;
- event pending with duplicate submission prevented;
- active front/back card;
- restart confirmation when current-run assessments exist;
- completed-run summary.

A failed event preserves the revealed card and chosen outcome context so the learner can retry safely with the same `event_id`.

### 10.3 Accessibility, Keyboard and Responsive Behavior

- Use one page `h1`, semantic progress/status text, labelled Meaning groups and ordered Example content.
- Reveal and assessment controls are native buttons with visible focus and disabled/pending semantics.
- Required keyboard operation does not depend on pointer gestures: `Enter`/`Space` activate focused controls; optional shortcuts may use `Space` to reveal, left/right arrows for navigation, and documented letter keys for outcomes only when focus is not inside an interactive control.
- Focus moves to the revealed-answer heading after reveal, to the next card heading after a successful outcome, and to the summary heading on completion. Error alerts are announced without losing retry context.
- The card, progress controls, meanings, examples and action area must avoid horizontal overflow at the existing mobile/tablet/desktop viewport conventions.
- Reduced-motion preferences must be respected; no flip animation is required for correctness.

### 10.4 Mandatory Design Checkpoint

Before final frontend implementation, the workflow must produce and receive HUMAN approval for a focused UI/UX checkpoint covering:

- desktop and mobile card anatomy;
- front/back information hierarchy for the deterministic primary Meaning and its Examples while preserving the complete backend payload;
- reveal, assessment, navigation, restart and completion interaction states;
- loading/error/empty/stale/pending states;
- keyboard/focus behavior and responsive constraints.

This checkpoint may use a repo-native wireframe or documented component-state design. It must not redesign the global App Layout or expand into Quiz/Pronunciation/Dashboard work.

## 11. Business Rules

- **BR-01:** Only authenticated USERs can use Flashcard / Learning V1.
- **BR-02:** A USER can learn only a public System Set or their own private Set.
- **BR-03:** Cards follow current Set Item position order and represent Vocabulary, not a selected Meaning.
- **BR-04:** Viewing, revealing, navigating or playing audio never creates progress.
- **BR-05:** Only an explicit successful self-assessment is a meaningful V1 learning event.
- **BR-06:** Learning Progress is unique per USER plus Vocabulary and survives Set/Item deletion.
- **BR-07:** Immediate retry of the current event ID is idempotent; delayed/reordered older events are rejected by revision protection, and backend controls all state/counter/time values without an event ledger.
- **BR-08:** Restart affects only the current UI run and never resets durable progress.
- **BR-09:** Run completion creates no XP, Streak, Achievement, Dashboard or persisted session record.
- **BR-10:** V1 does not calculate SRS scheduling or create a Words to Review queue.

## 12. Acceptance Criteria

- **AC-01:** An authenticated USER can start a run from a non-empty public System Set or owned private Set, while Guest, ADMIN and non-owner access are safely rejected according to the approved route/API behavior.
- **AC-02:** The backend returns cards in Set Item position order and each card includes the Vocabulary plus all owned Meaning/Example content without Set-specific Meaning links.
- **AC-03:** Front content, the deterministically selected primary-Meaning back content and optional model audio are presented accessibly; audio failure never changes progress and the selection rule adds no persisted primary field.
- **AC-04:** Reveal, navigation, reload, resume, restart and summary viewing produce no Learning Progress mutation.
- **AC-05:** `REMEMBERED` and `STUDY_AGAIN` are the only meaningful V1 events and map authoritatively to `LEARNED` and `LEARNING` respectively.
- **AC-06:** Each successful new `REMEMBERED` or `STUDY_AGAIN` assessment atomically increments the general meaningful-assessment `review_count` and `revision` once and updates backend time; immediate retry of the current event ID does not mutate twice, while delayed/reordered stale events are safely rejected without claiming historical replay support.
- **AC-07:** Progress is unique per `(user_id, vocabulary_id)`, is reused across Sets and has no Topic/Set/Set Item/Meaning foreign key.
- **AC-08:** V1 treats missing progress as `NEW`, never assigns `NEEDS_REVIEW`, leaves future SRS fields null and implements no review queue or scheduling algorithm.
- **AC-09:** Same-tab resume reconciles against a freshly authorized Set payload; stale cursor data falls back safely and a removed current Item yields an actionable refresh/restart path.
- **AC-10:** Restart clears only current-run UI state; completion requires an assessment for every current card, shows the approved summary and persists no Learning Session/history record.
- **AC-11:** Backend validates Set accessibility and current Set membership for every progress event and never accepts client-controlled identity, status, counters, timestamps or future-domain rewards.
- **AC-12:** API/UI safely handle invalid input, empty/missing/inaccessible Sets, changed Set Items, authentication/authorization failures and operational failures without leaking internals or losing retry context.
- **AC-13:** The USER route reuses the existing AuthenticatedShell/UserRoute and preserves completed Auth, Topic, Vocabulary and Vocabulary Set behavior, including logout/mobile drawer/public routes. The Learning frontend owns and clears only its run-state namespace when logout/session invalidation is observed; Auth internals remain uncoupled from Learning storage keys.
- **AC-14:** Keyboard, focus, announcement and responsive requirements pass focused accessibility/browser verification after the approved UI/UX design checkpoint.
- **AC-15:** V1 introduces no Quiz, Pronunciation Practice, XP/Level/Streak/Achievement, Dashboard, Community, AI, full SRS, Words to Review, standalone Vocabulary catalog or unrelated dependency.

## 13. Edge Cases

- Empty private draft Set: show an actionable empty state and do not create progress.
- Set becomes private/inaccessible before load: return safe not found.
- Set is edited after payload load: existing cards may remain visible in the client snapshot, but an event for a removed Vocabulary is rejected and prompts refresh/restart.
- Vocabulary content changes during a run: a refreshed/reopened run uses current content; V1 stores no content snapshot.
- Duplicate Vocabulary cannot occur in one Set because the completed Set database constraint remains authoritative.
- Missing Meanings: existing Vocabulary aggregate rules should prevent invalid catalog data; if encountered, UI shows a safe unavailable-content state and does not submit an event.
- Failed/current-event retry: reuse the same `event_id` and `expected_revision` until a conclusive success. An older request arriving after revision advancement is rejected rather than replayed.
- All cards previously `LEARNED`: a new run is still allowed and requires new explicit assessments for current-run completion.

## 14. Dependencies and Impact

- **Database:** Requires one Learning Progress model/table and the approved unique/FK/idempotency constraints; no Learning Session or SRS table.
- **Backend:** Requires learning repository/service/controller/routes using existing authentication, USER authorization, Set-access and transaction conventions.
- **Frontend:** Requires a learning service and one USER route/page under the existing shell, plus approved UI/UX checkpoint artifacts before final UI implementation.
- **Vocabulary Set:** Read-only learning consumption; no change to Set ownership, visibility, copy or editor contracts.
- **Vocabulary:** Read-only card content; deletion becomes restricted by durable Learning Progress.
- **Future SRS:** Can reuse the progress row and future nullable fields but requires its own approved SPEC/PLAN.

After approval and before implementation, synchronize the finalized contract in `docs/DATABASE.md`, `docs/API_SPEC.md`, `docs/UI_UX_SPEC.md`, `docs/ARCHITECTURE.md` and `docs/FEATURE_STATUS.md` as applicable.

## 15. Open Questions / Human Review Decisions

No unanswered decision blocks this SPEC. HUMAN approval includes these explicit V1 decisions:

1. No persistent Learning Session/history entity; resume is same-tab `sessionStorage` state reconciled against fresh server content, and the Learning frontend clears only its own run-state namespace on observed logout/session invalidation.
2. Explicit self-assessment maps immediately to `LEARNED` or `LEARNING`; `NEEDS_REVIEW` is reserved for future SRS.
3. `review_count` counts all successful meaningful learning/review assessments, including both V1 outcomes; quiz correctness counters and all SRS scheduling fields remain unused/null.
4. Client-generated `event_id` plus optimistic `revision` provides immediate-current-event retry safety and rejects delayed/reordered stale events. It does not provide arbitrary historical replay idempotency and adds no event-history/ledger table.
5. The backend payload includes the complete Vocabulary aggregate in deterministic creation order; the V1 card presentation selects one primary Meaning by lowest CEFR, then that existing deterministic order.
6. A HUMAN-approved UI/UX checkpoint is mandatory before final frontend implementation.

These decisions are approved for the PLAN stage. They do not authorize TASK or implementation.

## Approval Gate

```text
SPEC STATUS: APPROVED
NEXT ALLOWED STAGE: PLAN
TASK / IMPLEMENTATION AUTHORIZED: NO
```
