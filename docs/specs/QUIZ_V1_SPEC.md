# SPEC: Quiz V1

**Feature status:** `DONE — HUMAN APPROVED`

**SPEC status:** `HUMAN APPROVED`, including the post-TASK-086 `UNSCRAMBLE_WORD` revision

**Human approval:** `APPROVED`, including the `UNSCRAMBLE_WORD` replacement and shared underline-feedback contract.

**Implementation authorized:** `YES` — only according to TASK-086A/TASK-086B gates.

## 1. Objective

Quiz V1 gives an authenticated USER a bounded practice run over every Vocabulary item in one currently accessible Vocabulary Set. A run uses exactly one of the two approved types:

- `VI_TO_ENGLISH`;
- `UNSCRAMBLE_WORD`.

> **HUMAN-requested contract revision (after TASK-086 visual review):** `UNSCRAMBLE_WORD` replaces the previously approved and implemented `MISSING_LETTER` type. References to `MISSING_LETTER` in completed TASK-080 through TASK-086 evidence describe historical work only and are not part of the active Quiz V1 product contract.

The backend exclusively generates question data, evaluates correctness and applies the one authoritative per-Vocabulary Learning Progress mutation. The frontend owns only transient run/navigation/result state. V1 persists no Quiz Session, Quiz Attempt, history, score, accuracy or answer record and requires no database migration.

## 2. Existing Context and Active-Contract Boundary

- Vocabulary Set V1 is `DONE` and provides ordered Set Items, public System Sets, private owner-scoped USER Sets and backend-authoritative access rules.
- Flashcard / Learning V1 is `DONE` and provides per-`(user_id, vocabulary_id)` Learning Progress, revision protection, immediate-current-event retry idempotency and deterministic complete Vocabulary content.
- Current Learning content orders Meanings by `created_at`, then `id`. The actual Flashcard selector scans that ordered collection, chooses the lowest recognized CEFR in `A1 → A2 → B1 → B2 → C1 → C2`, and preserves the first existing item for a tie. If no Meaning has a recognized CEFR, it selects the first Meaning in that deterministic order. Quiz V1 uses exactly this rule.
- `docs/API_SPEC.md` and `docs/DATABASE.md` contain older conceptual Quiz examples, including numeric IDs, possible XP/gamification output and a possible `QUIZ_ATTEMPT` table. Those passages are legacy drafts, not the active Quiz V1 contract. They must be synchronized only after this SPEC and its implementation workflow are approved.
- No current Quiz route, service, repository, frontend page, model or migration exists.

## 3. Actors and Authorization

- **USER:** May run a Quiz from a public System Set or a private Set they own.
- **Guest:** Has no Quiz API or route access.
- **ADMIN:** Has no learner Quiz V1 access. Quiz V1 does not add Quiz administration.

The backend derives `user_id` only from the authenticated session and re-authorizes Set access for question loading and every submitted answer. Missing Sets, other USERs' private Sets and inaccessible Sets use the same safe concealment behavior as Learning. Frontend role guards are UX only.

## 4. Scope

### 4.1 In Scope

- One transient ordered Quiz run over all current Set Items exactly once.
- One explicitly selected Quiz type for the entire run.
- Backend-generated question projections that structurally expose no canonical-answer field or directly answer-bearing Vocabulary field.
- Backend-authoritative answer normalization, correctness and per-character feedback.
- Exactly one accepted answer per question in the normal client run; an accepted question advances and cannot be immediately answered again in that run.
- Correct answers map Learning Progress to `LEARNED`; incorrect answers map it to `LEARNING`.
- Every accepted correct or incorrect assessment increments `review_count` and `revision` exactly once and updates backend time.
- Immediate retry idempotency and stale-revision protection consistent with the completed Learning engine.
- Transient correct/incorrect completion totals for the current run.
- Accessible loading, safe error/retry, empty, active, feedback, pending, conflict and completion states.

### 4.2 Explicitly Out of Scope

- Any third Quiz type, mixed-type run or adaptive question selection.
- Random/bounded subsets, difficulty selection or question reordering.
- Persistent Quiz Session, `QUIZ_ATTEMPT`, answer history, activity timeline or cross-device resume.
- Durable score, accuracy, response time, timer, leaderboard or analytics.
- Immediate re-answer/retry of an accepted question within the same run.
- SRS scheduling, due dates, `NEEDS_REVIEW` transitions or Words to Review.
- XP, Level, Streak, Daily Goal, Achievement or Dashboard Quiz metrics.
- Pronunciation Practice, speech scoring or pronunciation as a Quiz type.
- AI question generation, external services or new dependencies.
- Schema/model/index changes or database migration.
- Quiz administration or fixed reusable Quiz definitions.

## 5. User Flow and Run Lifecycle

1. An authenticated USER chooses Quiz from a non-empty accessible Vocabulary Set.
2. The USER selects exactly `VI_TO_ENGLISH` or `UNSCRAMBLE_WORD` before the run starts.
3. The frontend creates a client UUID `run_id` and requests the ordered question payload for that Set, type and run.
4. The backend authorizes the Set and returns one question for every Set Item in explicit `position` order.
5. The USER enters one answer and submits it. Navigation cannot mark a question complete without an accepted backend response.
6. The backend re-authorizes the Set, verifies current Set membership, evaluates the answer and transactionally applies the corresponding Learning Progress event.
7. The UI presents correct/incorrect and character feedback, then exposes an explicit next-question action. The accepted question cannot be submitted again in the current client run.
8. The run completes after every fetched question has one accepted assessment. The summary shows only total, correct and incorrect counts for this run.
9. Restart discards transient run state, creates a new `run_id`, regenerates deterministic Unscramble tile order and begins again from the first current Set Item. Durable Learning Progress is not reset.

Reload in the same tab may resume Quiz-owned non-sensitive run state from `sessionStorage`, reconciled against a fresh authorized payload for the same Set, type and `run_id`. Invalid or stale state is discarded safely. Quiz owns and clears only its own namespace when logout/session invalidation is observed; Auth internals remain uncoupled from Quiz storage keys.

## 6. Question Contract

### 6.1 Shared Rules

- Questions follow current `VOCABULARY_SET_ITEM.position` order with no shuffle.
- The payload contains stable identifiers needed for submission, the selected Quiz type, position, an opaque `question_revision` and display-only prompt data.
- Structural non-disclosure is mandatory: the payload must not include a canonical-answer field, `VOCABULARY.word`, answer-normalization output, hidden unmasked content, Learning revision fields unrelated to the current USER, or another USER's data except where the selected question type intentionally reveals characters in its masked prompt.
- V1 does not scan, rewrite or censor administrator-authored Vietnamese `meaning_vi` or `context` text. Such trusted prompt content is not a canonical-answer field, but content authors remain responsible for not placing the English answer in the Vietnamese prompt.
- Question loading is read-only and never creates or updates Learning Progress.
- A Set must be non-empty and every Item must resolve to valid Vocabulary content required by the selected type; otherwise the backend returns a safe actionable error rather than a partial run.

### 6.2 Vietnamese → English

- The prompt uses the deterministic primary Meaning's `meaning_vi` and optional `context`.
- It may include the primary Meaning's `part_of_speech` and nullable `cefr_level` as non-answer metadata.
- It does not expose English examples, phonetic text, pronunciation URL or Vocabulary word because those can reveal the answer.
- The canonical answer is the referenced current `VOCABULARY.word` and is available only after answer evaluation.

### 6.3 Unscramble Word

- The prompt uses the same deterministic primary Meaning's `meaning_vi`, optional `context`, `part_of_speech` and nullable `cefr_level` as `VI_TO_ENGLISH`.
- The backend returns an ordered pool of selectable character tiles plus a non-answer slot pattern. It never returns `VOCABULARY.word`, an assembled canonical answer, original character indexes or other directly answer-bearing Vocabulary aggregate fields.
- The USER constructs and submits the complete English headword by selecting tiles. Correctness remains backend-authoritative; tile order is not evaluated by the frontend.
- Every selectable tile has a stable opaque `tile_id`, including duplicate visible characters. The identifier is deterministic for the same run/question and must not encode or reveal the tile's canonical position.
- Selecting a pool tile appends that exact tile to the next selectable answer slot. Selecting an answer tile removes that exact tile and restores it at its original position in the shuffled pool. V1 uses click/tap and keyboard activation, not drag-and-drop.

### 6.4 Character, Separator and Shuffle Policy

- The backend normalizes the canonical headword to NFC and iterates Unicode code points, never UTF-16 code units.
- Unicode letters and decimal digits are selectable tiles. Unicode whitespace is first collapsed to one ordinary space by the approved answer-normalization rule and is represented as a fixed separator in the slot pattern.
- Apostrophes, hyphens and all other punctuation remain significant but are fixed, non-selectable separators at their canonical slot positions. They are included automatically when the frontend constructs the complete submitted answer and are never silently removed.
- The slot pattern may reveal answer length and separator positions, which is intrinsic to this Quiz type, but it contains no canonical letters/digits. Opaque tile IDs and response ordering reveal no original selectable-character positions.
- Tile order is derived deterministically from a versioned algorithm over authoritative question inputs and `run_id`, using backend cryptographic digest material rather than client randomness or `Math.random()`.
- The backend must choose a visibly different selectable-character sequence from canonical order whenever one exists. Duplicate-character permutations are compared by visible Unicode code-point sequence, not tile identity alone.
- If no meaningfully different visible permutation exists—fewer than two selectable tiles, or all selectable characters are identical—the backend returns the deterministic canonical selectable sequence with `shuffle_mode: IDENTITY_FALLBACK`. The item remains in the ordered run; the UI explains the fallback without treating it as an error.
- The same run/question reconstructs identical tile IDs, pool order, slot pattern and fallback mode. A new/restarted `run_id` may produce a different valid order. No shuffle state is persisted.
- No server-side Quiz Session, cache, ledger, secret answer token or database row is introduced. Shuffle presentation never determines correctness.

### 6.5 Stateless Question Revision

- Every question contains an opaque `question_revision`. It is an API concurrency token, not a database identity, answer token or authorization credential.
- The backend derives it deterministically from non-answer version metadata for all authoritative fields relevant to that question. For `VI_TO_ENGLISH`, this includes the Set/Vocabulary identity, selected type, current Vocabulary version and deterministic primary Meaning identity/version. For `UNSCRAMBLE_WORD`, it additionally includes `run_id`, the deterministic primary Meaning identity/version and the versioned shuffle/slot-policy identifier. It must change when any authoritative prompt, canonical answer, Set position or shuffle-relevant input changes.
- The token must not embed or expose the canonical word. An application digest of the version metadata may be used; the exact encoding belongs to PLAN while the observable equality/change behavior is fixed here.
- Answer submission must return the exact `question_revision` received with the question. Inside the answer transaction, the backend reselects the current authoritative question inputs, recomputes the token and compares it before accepting any assessment.
- A mismatch returns the documented question-changed conflict and performs no Learning Progress mutation. No question revision is persisted and no schema/migration change is required.

## 7. Answer and Correctness Contract

### 7.1 Normalization

The backend applies the same pipeline to submitted and canonical answers:

1. require a bounded string and reject unsupported fields;
2. trim leading and trailing whitespace;
3. normalize Unicode to NFC;
4. collapse each sequence of Unicode whitespace to one ordinary ASCII space;
5. apply locale-independent Unicode lowercase conversion and compare the resulting strings.

Apostrophes, other punctuation and letter order remain significant. For `VI_TO_ENGLISH` only, one normalized submitted ASCII space is accepted in place of one canonical ASCII hyphen; this is one-way, does not remove separators and does not apply to canonical spaces, apostrophes, other punctuation or `UNSCRAMBLE_WORD`. The stored/displayed canonical answer remains unchanged. V1 accepts no synonym, alternate spelling or Meaning-specific answer list. An empty normalized answer is invalid input rather than an incorrect assessment.

### 7.2 Result and Character Feedback

- Correctness is true only when normalized submitted and canonical answers match, except for the approved one-way `VI_TO_ENGLISH` space-for-canonical-hyphen equivalence.
- The response may reveal the canonical answer only after evaluation.
- Runtime character feedback iterates Unicode code points (not UTF-16 code units) and uses deterministic minimum-edit alignment. Exact/equivalent pairs are `correct`, substitutions are `incorrect`, submitted-only code points are `extra`, and canonical-only code points are `missing`. Minimum-cost ties prefer a direct substitution unless a gap exposes an immediate exact/equivalent match; remaining ties prefer `missing` then `extra`, preserving stable, HUMAN-meaningful duplicate-character feedback.
- A `missing` item carries `submitted: null` and the canonical `expected` code point for accessibility, but the UI renders a blank/underscore error slot rather than presenting the canonical character as learner input. An accepted submitted space against a canonical hyphen carries the submitted space, expected hyphen and `correct` state with explicit accessible equivalence wording.
- Feedback must retain the submitted/canonical text required for accessible non-color explanation. It is response/UI data only and is never persisted.
- Character feedback is not a separate score and creates no per-character database entity.
- Both Quiz types render the same accepted underline-based feedback: characters remain visible above their underline; `correct` uses a green underline and `incorrect`/`missing`/`extra` use an error underline plus textual/icon semantics. Feedback wraps safely and never relies on color alone. Boxed per-character feedback is no longer the active V1 presentation.

## 8. Learning Progress and Double-Count Prevention

### 8.1 Authoritative Mapping

- Correct → `LEARNED`.
- Incorrect → `LEARNING`.
- Both are meaningful accepted Quiz assessments and increment `review_count` and `revision` exactly once, set `last_reviewed_at` to backend time and record the submitted `event_id` as the current `last_event_id`.
- Existing nullable future SRS fields remain unchanged/null. Quiz V1 never assigns `NEEDS_REVIEW`.

### 8.2 Event and Revision Contract

Each answer submission includes a client-generated UUID `event_id`, `set_id`, `vocabulary_id`, `run_id`, opaque `question_revision`, selected `quiz_type`, current `expected_revision` and learner `answer`.

- The backend derives identity/status/correctness/counters/timestamps and never accepts them from the client.
- Set accessibility, current Set membership and `question_revision` are revalidated transactionally inside the meaningful-operation boundary before an assessment can be accepted.
- Progress creation requires `expected_revision = 0`; updates require an exact current revision.
- V1 guarantees exactly-once Learning Progress mutation for the current event; it does not guarantee byte-identical historical Quiz-result replay. A retry must represent the identical logical request and the client reuses the same event ID, question revision, answer, Quiz type and expected Progress revision until success is conclusive.
- When the current Progress row has a matching `last_event_id`, the backend performs no mutation. It recomputes transient correctness, canonical answer and character feedback from the retry payload and current authoritative answer. The recomputed correct/incorrect mapping must be compatible with the current stored Progress status (`LEARNED`/`LEARNING`); otherwise the backend returns a safe conflict rather than presenting a contradictory result.
- A delayed/reordered different event with a stale revision is rejected with the existing safe progress-conflict behavior.
- `last_event_id` is shared per USER/Vocabulary with Flashcard Learning. A later accepted Flashcard or Quiz event supersedes it; V1 does not claim arbitrary historical replay idempotency.
- Frontend must never call `POST /api/learning/events` for the same Quiz answer. Quiz answer submission is the sole mutation command.
- Question loading, typing, navigation, feedback display, reload, restart and completion viewing never mutate progress.

The normal client permits one accepted answer per question per run. Because V1 deliberately has no persistent Quiz Session/attempt ledger, it does not claim server-side detection of a malicious client presenting a fresh run and fresh event as historical duplicate work; such a submission is treated as a new meaningful assessment subject to current authorization and revision rules.

## 9. Data Requirements and Referential Behavior

- Reuse `VOCABULARY_SET`, `VOCABULARY_SET_ITEM`, `VOCABULARY`, `VOCABULARY_MEANING` and `LEARNING_PROGRESS` only.
- Add no Quiz table, enum, foreign key, ordering column, attempt record or content snapshot.
- Learning Progress remains unique per `(user_id, vocabulary_id)` and Set-independent.
- Set/Item deletion does not delete Learning Progress.
- Existing Vocabulary deletion `RESTRICT` behavior through Learning Progress and Set Items remains unchanged.
- V1 stores no learner answer, correct answer, mask, Quiz type, run result or run ID.

**Schema/migration conclusion:** No Prisma schema change or migration is required or authorized.

## 10. API Requirements

All Quiz V1 endpoints require existing authentication and USER-role authorization.

| Method / path | Success | Requirement |
|---|---:|---|
| `GET /api/quiz/sets/:setId/questions?type=...&run_id=...` | `200` | Authorize one non-empty Set and return all ordered safe question projections for exactly one approved type and transient run. |
| `POST /api/quiz/answers` | `200` | Re-authorize Set/membership, evaluate one answer and transactionally apply exactly one meaningful Progress event. |

Question success includes Set identity/name, selected type, `run_id`, ordered questions, each opaque `question_revision` and each current USER progress projection needed for `expected_revision`. It structurally excludes canonical-answer fields and unrelated Vocabulary aggregate fields.

Answer success includes question identity, Quiz type, `is_correct`, canonical answer, normalized submitted answer, accessible character feedback and resulting `status`, `review_count`, `revision`, `last_reviewed_at`. It includes no XP, streak, SRS, durable score or history ID.

Success uses `{ "success": true, "data": ... }`; errors use the existing safe `{ "success": false, "error": { "code": "...", "message": "..." } }` envelope.

| Condition | Status | Required behavior/code direction |
|---|---:|---|
| Invalid UUID, type, answer, query/body shape or unsupported field | `400` | `VALIDATION_ERROR` |
| Missing/inaccessible Set | `404` | Safe concealed Quiz Set not found |
| Accessible empty Set | `409` | Quiz Set empty |
| Vocabulary removed from Set after load | `409` | Set Item changed; refresh/restart required |
| Submitted `question_revision` no longer matches current question content | `409` | Question changed; refresh/restart required |
| Matching current `event_id` is retried with an outcome incompatible with stored Progress | `409` | Safe retry conflict; refresh required |
| Different event uses stale Progress revision | `409` | Existing progress-changed conflict semantics |
| Missing/invalid session | `401` | Existing Authentication contract |
| Authenticated non-USER | `403` | Existing role authorization contract |
| Unexpected failure | `500` | Existing safe internal-error contract |

Exact Quiz-specific code names may be finalized in PLAN but must remain stable, safe and distinguish actionable empty/item-changed/conflict states.

## 11. Frontend and UI/UX Requirements

### 11.1 Route and Entry

- Provide one USER-only route at `/quiz/vocabulary-sets/:setId`, with the selected type represented in controlled route/query state.
- Reuse existing `ProtectedRoute`, `UserRoute`, authenticated identity/session behavior and Vocabulary Set entry points.
- Show Quiz actions only where a USER can start from a currently accessible non-empty Set.
- Do not add a standalone USER Vocabulary catalog or ADMIN Quiz route.

### 11.2 Required States

- type selection;
- authorization/question loading;
- accessible empty Set;
- missing/inaccessible Set;
- active unanswered question;
- validation feedback;
- submission pending with duplicate action protected;
- accepted correct/incorrect feedback;
- item-changed refresh/restart;
- stale-progress conflict refresh;
- safe load/submission error with retry context;
- completed transient summary;
- restart confirmation when accepted answers exist.

Successful answer state disables re-answer for that question and exposes the explicit next action. Restart never resets durable Progress.

### 11.3 Accessibility and Responsive Behavior

- Use a single page heading, labelled type selection, semantic form labels/instructions and native input/button controls.
- Enter may submit only the current valid unanswered question; global shortcuts must not fire from interactive/editable controls.
- Pending controls expose disabled and busy semantics. Error/result changes use appropriate alert/status announcements.
- After an accepted keyboard-originated submission, focus moves predictably to the result heading/summary and normal Tab order reaches the explicit next action. Pointer/touch submission does not reassign focus or create an unexpected focus ring. In both cases, a concise polite atomic status announces correct/incorrect acceptance; canonical answer and character detail remain available through normal browsing rather than joining the live region. Moving next focuses the next question heading; completion focuses the summary heading.
- Character correctness is communicated with text/icon semantics in addition to color.
- Both Quiz types remain operable by keyboard and screen reader without time limits or pointer-only gestures.
- Mobile/tablet/desktop layouts avoid horizontal overflow, keep touch targets usable and preserve long-word/multi-character feedback readability.
- Motion is non-essential and respects `prefers-reduced-motion`.

Final visual composition remains for a later HUMAN UI/UX design checkpoint before production Quiz UI implementation.

## 12. Business Rules

- **BR-01:** Only an authenticated USER may run Quiz V1.
- **BR-02:** A USER may quiz only a public System Set or their own private Set; inaccessible private Sets are concealed.
- **BR-03:** A run uses exactly one approved Quiz type and every current Set Item exactly once in position order.
- **BR-04:** Backend question payloads structurally disclose no canonical-answer field or directly answer-bearing Vocabulary field; V1 does not sanitize administrator-authored Vietnamese Meaning/context text.
- **BR-05:** Primary Meaning selection exactly reuses the current Flashcard CEFR-first selection over deterministic `created_at → id` ordering.
- **BR-06:** Backend exclusively applies NFC, Unicode-whitespace collapse and locale-independent lowercase normalization and evaluates every answer; `VI_TO_ENGLISH` alone accepts one normalized submitted space for one canonical ASCII hyphen, while runtime feedback uses deterministic minimum-edit alignment over Unicode code points.
- **BR-07:** Correct maps to `LEARNED`; incorrect maps to `LEARNING`; both increment the general meaningful-assessment `review_count` once.
- **BR-08:** Quiz submission is the only mutation for a Quiz answer; no parallel Learning event may be sent.
- **BR-09:** Immediate identical-logical-request retry is idempotent for Progress mutation, transient feedback is recomputed, incompatible retry outcome and stale different events conflict, and no event ledger or exact historical-response replay guarantee exists.
- **BR-10:** One accepted answer completes that question in the normal transient run; immediate re-answer is unavailable.
- **BR-11:** Completion totals are transient and create no Session, Attempt, score, history or analytics record.
- **BR-12:** Restart creates a new run/masks but never resets Progress.
- **BR-13:** Quiz V1 changes no future SRS field and creates no gamification/pronunciation outcome.

## 13. Acceptance Criteria

- **AC-01:** Authenticated USERs can start either approved single-type Quiz from a non-empty public System Set or owned private Set; Guest, ADMIN and non-owner access are safely rejected/concealed.
- **AC-02:** One run contains every current Set Item once in explicit position order, with no random subset, shuffle or mixed Quiz type.
- **AC-03:** `VI_TO_ENGLISH` uses the exact current Flashcard primary-Meaning rule and structurally excludes the canonical word, phonetic, pronunciation and English Example fields; administrator-authored Vietnamese prompt text is not scanned or rewritten.
- **AC-04:** `UNSCRAMBLE_WORD` returns the safe Vietnamese prompt, opaque stable duplicate-safe tiles and separator-only slot pattern; the same run/question reconstructs identical ordering without persistence, while a new run may produce a different valid ordering.
- **AC-05:** Backend applies trim, NFC, Unicode-whitespace collapse and locale-independent lowercase comparison; `VI_TO_ENGLISH` accepts only the approved one-way space-for-canonical-hyphen equivalence, while apostrophes/other punctuation and all `UNSCRAMBLE_WORD` fixed separators remain strict.
- **AC-06:** Backend returns authoritative correctness, canonical answer and deterministic minimum-edit `correct`/`incorrect`/`missing`/`extra` Unicode-code-point feedback only after submission; missing canonical characters are not visually presented as submitted input, accepted space/hyphen equivalence is accessible, both types use the shared wrapping underline presentation and no character-result persistence is added.
- **AC-07:** Correct answers atomically map to `LEARNED`; incorrect answers atomically map to `LEARNING`; every accepted answer increments `review_count` and `revision` exactly once and updates backend review time.
- **AC-08:** Immediate retry of the current `event_id` for the identical logical request does not double-count; transient result data is recomputed, incompatible retry outcome conflicts, and stale/reordered different events are rejected without promising byte-identical historical replay.
- **AC-09:** Every submission derives current USER identity and transactionally re-authorizes Set access, validates current Vocabulary membership and matches the opaque `question_revision` before evaluation/mutation; changed questions and client-controlled status, counters, timestamps or rewards are rejected.
- **AC-10:** Frontend sends no second Learning event for a Quiz answer, protects pending/accepted questions from duplicate submission and advances only after an accepted backend result.
- **AC-11:** Question loading, typing, navigation, feedback, reload, restart and completion display are read-only; restart changes only transient run state and masks.
- **AC-12:** Completion occurs after one accepted answer for every fetched question and reports only transient total/correct/incorrect counts; no Quiz Session, Attempt, history, accuracy or durable result is created.
- **AC-13:** Validation, empty/inaccessible Set, changed Item, conflict and unexpected failures use safe actionable API/UI states without leaking another USER's data or internal errors.
- **AC-14:** Keyboard, focus, announcement, non-color feedback, responsive and reduced-motion requirements pass focused unit/browser/real-stack verification.
- **AC-15:** Existing Auth, Vocabulary, Vocabulary Set, Learning and Learning Progress behavior remains compatible, including per-USER isolation and Set-independent Progress.
- **AC-16:** V1 adds no schema migration, third Quiz type, mixed/adaptive quiz, SRS/review queue, XP/Level/Streak/Daily Goal/Achievement, Dashboard Quiz metric, Pronunciation Practice, AI, analytics or unrelated dependency.

## 14. Edge Cases

- Empty private draft Set: reject as an actionable empty Quiz; create no Progress.
- Set becomes inaccessible before load/submission: return concealed not found and mutate nothing.
- Vocabulary is removed after payload load: reject the answer as changed Set membership and require refresh/restart.
- Vocabulary word, selected primary Meaning or relevant prompt content changes during a run: recomputed `question_revision` differs, submission mutates nothing and the client must refresh/restart.
- No Meaning exists for `VI_TO_ENGLISH`: reject payload creation safely rather than exposing an answer-only or partial question.
- Empty/whitespace-only normalized answer: validation error, not an accepted incorrect event.
- `VI_TO_ENGLISH` canonical `mother-in-law` accepts normalized submissions `mother-in-law`, `mother in law` and `mother  in   law`; `motherinlaw` remains incorrect with two aligned missing-hyphen positions, while apostrophes and other punctuation remain strict.
- Middle insertion/deletion feedback uses minimum-edit alignment so following exact characters remain correct; ambiguous duplicate-character paths are resolved deterministically without increasing edit cost.
- One selectable code point or all-identical selectable code points: return `IDENTITY_FALLBACK`, retain the ordered Set Item and keep the question answerable.
- Duplicate characters: opaque tile identities remain distinct; removing a selected duplicate restores that exact tile to its original shuffled-pool position.
- Multi-word/punctuated headword: collapsed spaces, apostrophes, hyphens and other punctuation remain fixed significant separators; only Unicode letters/digits are selectable.
- Network result is uncertain: retry the identical logical request with the same event ID, question revision, answer, type and expected Progress revision; Progress does not mutate twice, transient feedback is recomputed and exact historical-response replay is not promised.
- A matching current event ID is retried with an answer whose correctness maps to a different stored status: return a safe retry conflict and mutate nothing.
- Another Learning/Quiz event advances the same Vocabulary revision: stale submission conflicts and must refresh rather than overwrite.
- All words already `LEARNED`: Quiz remains available; each accepted assessment is a new meaningful event.

## 15. Dependencies and Impact

- **Database:** No change. Existing Set/Vocabulary/Progress models and constraints are sufficient.
- **Backend:** New Quiz route/controller/service/repository composition may reuse existing authentication, USER middleware, Set authorization, deterministic content ordering and Progress transaction patterns without changing Learning APIs.
- **Frontend:** New USER Quiz service/run state/routes/pages and Set entry actions; no App Layout, Flashcard or Progress redesign.
- **Testing:** Guarded database/API/security tests plus focused frontend, accessibility, responsive and real-stack regression coverage.
- **Documentation:** After SPEC/PLAN/TASK approval and before implementation, synchronize active Quiz contracts in `API_SPEC.md`, `DATABASE.md`, `UI_UX_SPEC.md`, `ARCHITECTURE.md` and `FEATURE_STATUS.md` without reviving legacy gamification/SRS scope.

## 16. Open Questions / Human Review

None. HUMAN direction has resolved run scope, type selection, correctness/progress mapping, transient result boundary, answer normalization, deterministic Unscramble behavior, unshufflable fallback and deferred domains.

HUMAN approval of this coordinated revision permits only TASK-086A next; it does not authorize schema changes, TASK-086B, TASK-087 or later work without their documented gates.

## Approval Gate

```text
ORIGINAL SPEC / PLAN / TASK: HUMAN APPROVED
HUMAN-REQUESTED CONTRACT REVISION: HUMAN APPROVED
TASK-080..TASK-086: HISTORICAL EVIDENCE PRESERVED
TASK-087: BLOCKED
TASK-086A: COMPLETE — HUMAN APPROVED
TASK-086B: COMPLETE — AWAITING HUMAN VISUAL REVIEW
TASK-087: BLOCKED UNTIL TASK-086B HUMAN APPROVAL
```
