# SPEC: Multiple Choice Quiz V1

**Feature status:** `IN_PROGRESS — IMPLEMENTED, AWAITING TEST/REVIEW`

**SPEC status:** `HUMAN APPROVED`

**Supersedes:** the active `VI_TO_ENGLISH` and `UNSCRAMBLE_WORD` contract. Their evidence remains historical in Git and must not be treated as active after this SPEC is implemented.

## 1. Objective

Replace the two existing Quiz modes with one Set-scoped `MULTIPLE_CHOICE` mode. Each question shows one English Vocabulary word and exactly four distinct Vietnamese meaning choices, exactly one of which is correct.

The backend remains authoritative for question construction, correct-choice identity, grading, authorization and Learning Progress mutation. Runs/results remain transient and require no database migration.

## 2. Actors and authorization

- **USER:** May run Quiz for a public System Set or a private Set they own.
- **Guest:** Has no Quiz route/API access and uses the existing login flow.
- **ADMIN:** Has no learner Quiz access and remains browse-only elsewhere.

The backend derives USER identity from the session and re-authorizes Set access/current membership on question load and every answer. Inaccessible private Sets use concealed not-found behavior.

## 3. Scope

### In scope

- Sole active type `MULTIPLE_CHOICE`.
- One transient run for one accessible Set; every eligible Item is asked once in Set position order.
- English word plus selected Meaning part of speech when available.
- Four Vietnamese labels with opaque choice IDs and one correct choice.
- Existing deterministic primary-Meaning rule.
- Set-first distractors; canonical outside-Set fallback only for deficits.
- Backend deterministic reconstruction/grading, opaque revision, idempotency and concurrency safeguards.
- Existing Progress mapping/SRS invariants, same-tab resume and transient completion totals.
- Loading, empty, unavailable-choice, error, conflict, feedback and completion UI.
- Responsive keyboard-accessible presentation in existing Quiz Focus Mode.

### Out of scope

- Typed answers, character feedback, letter tiles or unscrambling.
- Mixed/user-selected types or a type-selection screen.
- Random question subsets, adaptive difficulty or shuffled question order.
- Synonym/free-text grading or multiple correct choices.
- Another USER's private Vocabulary as a distractor.
- Persisted Quiz sessions, questions, attempts, answers, scores, history or analytics.
- Distractor/outside-Set Progress writes.
- SRS scheduling, XP, Level, Streak, Daily Goal or Achievement changes.
- Flashcard, Speaking or Set-detail redesign.
- AI, external services, new dependencies, schema changes or migrations.

## 4. Existing behavior to reuse

- `/quiz/vocabulary-sets/:setId`, USER guards and Focus Mode shell.
- Public-System/owned-private Set authorization and exact ordered Set Items.
- Primary Meaning: meanings ordered `created_at`, then `id`; select lowest recognized CEFR `A1 → A2 → B1 → B2 → C1 → C2`, preserving first for ties, otherwise first Meaning.
- Client `run_id`, Quiz-owned `sessionStorage`, reconciliation, restart and summary.
- Stateless opaque `question_revision`.
- Transactional answer path, `event_id`, expected revision, retry and concurrency behavior.
- Correct → `LEARNED`; incorrect → `LEARNING`.

## 5. User flow

1. An authenticated USER selects Quiz from a non-empty accessible Set.
2. `MULTIPLE_CHOICE` starts directly with no type-selection screen.
3. The frontend creates/resumes a `run_id` and requests ordered questions.
4. The backend authorizes the Set and constructs exactly four choices for every question.
5. The USER selects one choice and explicitly submits it.
6. The backend re-authorizes, verifies membership, reconstructs the question, validates revision/choice, grades, and transactionally updates only the question Vocabulary's Progress.
7. The UI locks choices, announces feedback, identifies the correct choice without color-only meaning, and exposes the next action.
8. Completion shows transient total/correct/incorrect counts and restart/return actions.
9. Restart creates a new run and never resets persisted Progress.

## 6. Business rules

- **BR-01:** Only `MULTIPLE_CHOICE` is accepted; legacy type values become inactive.
- **BR-02:** Questions are only current Set Items, once each in ascending position.
- **BR-03:** A question requires a deterministic primary Meaning with non-empty `meaning_vi`.
- **BR-04:** The correct label is that primary `meaning_vi`.
- **BR-05:** Every question has exactly four choices and one correct choice.
- **BR-06:** Labels are unique after trim, NFC, Unicode-whitespace collapse and lowercase comparison. Diacritics/punctuation stay significant.
- **BR-07:** A candidate matching the normalized correct label is excluded as ambiguous; duplicate distractor labels are also excluded.
- **BR-08:** Each candidate contributes only its primary Meaning and appears at most once.
- **BR-09:** Select distractors from eligible other Set Items first.
- **BR-10:** Fill only a deficit from eligible canonical Vocabulary (`owner_id = null`) outside the Set.
- **BR-11:** Never query/use another USER's private Vocabulary; own private Vocabulary outside the Set is not fallback either.
- **BR-12:** Outside Vocabulary is distractor-only: never a question, count/order change or Progress target.
- **BR-13:** Missing correct Meaning or fewer than three valid distractors fails the entire load safely; never omit questions, reduce choices or fabricate labels.
- **BR-14:** Candidate selection and final order are deterministic per run and inputs through a versioned backend digest, never client/`Math.random()` shuffle.
- **BR-15:** Choice IDs are opaque/stable for the same run/question and encode no correctness or source identity.
- **BR-16:** Restart may create another valid subset/order; reload of the same run reconstructs identically.
- **BR-17:** Pre-answer payload has no correctness marker. English `word` is intentionally exposed as the prompt.
- **BR-18:** Client submits only an opaque choice ID, never correctness/status/score.
- **BR-19:** Unknown, stale or tampered choice IDs fail safely with no Progress write.
- **BR-20:** Correct/incorrect both increment `review_count` and `revision` once and update `last_reviewed_at`/`last_event_id` with existing status mapping.
- **BR-21:** Quiz never modifies `next_review_at`, `interval_days`, `ease_factor` or other SRS fields.
- **BR-22:** Load, selection, navigation, retry display, restart and completion viewing are read-only.
- **BR-23:** `POST /api/quiz/answers` remains the sole Quiz grading/Progress command; frontend sends no duplicate Learning event.
- **BR-24:** Inconclusive retry reuses the identical event, choice, question revision and expected Progress revision.

## 7. Determinism and revision

For each Set-positioned question, build candidates from eligible other Set Items, then eligible canonical outside-Set Vocabulary. Exclude the question and normalized duplicate/ambiguous labels before deterministic ranking.

`question_revision` is an opaque digest covering the policy version, run, Set Item/position, question Vocabulary/version/word, correct Meaning identity/version, chosen distractor Vocabulary/Meaning identities/versions, and generated choice IDs/order. It is not authorization or persistence. Submission recomputes it inside the transaction.

## 8. Data requirements

Reuse `VOCABULARY_SET`, `VOCABULARY_SET_ITEM`, `VOCABULARY`, `VOCABULARY_MEANING` and `LEARNING_PROGRESS`. Progress remains unique by `(user_id, vocabulary_id)` and independent of Set/Meaning/distractors. No Quiz data is persisted.

**Schema conclusion:** no Prisma change or migration.

## 9. API requirements

Both endpoints retain authentication plus USER authorization.

### Get questions

`GET /api/quiz/sets/:setId/questions?type=MULTIPLE_CHOICE&run_id=<uuid>`

Returns Set identity/name, type, run and ordered questions. Each question has exact `vocabulary_id`, position, opaque revision, English word, available part of speech, exactly four `{ choice_id, label }` entries, and current USER Progress. It exposes no correct marker, distractor source identity or foreign-private data.

### Submit answer

`POST /api/quiz/answers`

Exact fields: `event_id`, `set_id`, `vocabulary_id`, `run_id`, `question_revision`, `quiz_type: "MULTIPLE_CHOICE"`, `expected_revision`, `selected_choice_id`.

Success returns submitted identities, `is_correct`, `selected_choice_id`, `correct_choice_id` and updated Progress. Typed normalization/character feedback fields are removed.

### Safe errors

- Invalid UUID/query/type/body/revision/extra field: `400 QUIZ_VALIDATION_ERROR`.
- Existing authentication `401` and role `403`.
- Missing/inaccessible Set: `404 QUIZ_SET_NOT_FOUND`.
- Empty Set: `409 QUIZ_SET_EMPTY`.
- Missing/currently changed question content: existing safe changed/unavailable conflict.
- Four choices unavailable: `409 QUIZ_CHOICES_UNAVAILABLE`.
- Revision changed: `409 QUIZ_QUESTION_CHANGED`.
- Unknown/stale choice: `409 QUIZ_CHOICE_CHANGED`.
- Existing retry/Progress conflicts.

Errors reveal no concealed Set, private Vocabulary, duplicate label or outside-candidate state.

## 10. UI/UX requirements

### Question and feedback

- Existing Set return/restart top bar, Set name and progress.
- English word heading with safe wrapping; part of speech only when available.
- Four semantic single-choice controls A–D and explicit submit disabled until selection.
- Lock controls while pending/after acceptance.
- Correct selection shows success icon/text/color; incorrect shows both selected-wrong and actual correct.
- Never rely on color alone; announce result through a polite live region.
- Keyboard submission focuses result heading; pointer submission preserves non-disruptive focus behavior.
- Next action is `Câu tiếp theo` or `Xem kết quả`.

### Other states

- Loading skeleton/status; empty Set; unavailable choices; retryable operational error; question/choice and Progress conflicts; transient completion; restart confirmation.
- Restart states that temporary results clear but saved Progress does not.
- Return resolves only to originating public/owned Set detail.

### Responsive/accessibility

- Respond to available Quiz container width, not viewport alone.
- One-column choices by default; two only when cards remain readable.
- Long words/labels wrap without clipping or fixed-height truncation.
- No page-level horizontal overflow across phone/tablet/laptop/desktop, landscape or zoom.
- Enabled controls have pointer cursor, hover/active and visible focus; disabled controls do not imply interaction.
- Minimum 44×44 CSS-pixel targets.
- Native radio semantics or equivalent radiogroup supports single selection, Tab, arrows and Space.
- Focus follows visual order; reduced motion is respected; announcements avoid duplication.

## 11. Acceptance criteria

- **AC-01:** USER public/owned success; Guest, ADMIN and foreign-private access safely rejected.
- **AC-02:** Every eligible Set Item is one question in position order; outside candidates never questions.
- **AC-03:** Exact English word and available selected-Meaning part of speech are shown.
- **AC-04:** Exactly four normalized-distinct labels/opaque IDs with no pre-answer correctness marker.
- **AC-05:** Correct Meaning matches existing deterministic selector for canonical/private Vocabulary.
- **AC-06:** Set-first distractors and canonical-only fallback are enforced.
- **AC-07:** Ambiguous duplicates, foreign-private and invalid candidates are excluded without leakage.
- **AC-08:** Sets of one to three items remain playable when canonical fallback is sufficient, without extra questions.
- **AC-09:** Unbuildable questions fail atomically and safely without partial/fabricated Quiz.
- **AC-10:** Same run/content reconstructs identically; restart may vary valid choices/order.
- **AC-11:** Backend accepts only a current reconstructed choice ID; tampered/stale IDs write no Progress.
- **AC-12:** Existing mapping, exactly-once write, idempotency, stale/concurrent protection and SRS invariants remain.
- **AC-13:** Only current USER/question Vocabulary changes; distractors and other USER remain unchanged.
- **AC-14:** Frontend starts directly and never grades locally.
- **AC-15:** Loading, empty, unavailable, operational, authorization and conflict states are accessible/actionable.
- **AC-16:** Keyboard, focus, announcements, cursor, touch, reduced motion, wrapping and overflow pass supported layouts/zoom.
- **AC-17:** Flashcard, Speaking, Set entry and exact return navigation remain unchanged.
- **AC-18:** No migration, persistence, external service, dependency or unrelated refactor.

## 12. Edge cases

- Sets with one to three items; duplicate Vietnamese labels; same-spelling canonical/private IDs.
- Missing/changed correct Meaning or changed/deleted distractor Meaning.
- Insufficient canonical fallback; unknown/cross-run/tampered choice ID.
- Progress changed by Flashcard/another tab; lost-response identical retry.
- Long content, 200% zoom, narrow containers and landscape mobile.

## 13. Dependencies and impact

Backend Quiz domain/service/repository and frontend service/run/page change materially. Authentication, Set authorization, Progress storage, routes, Focus Mode and navigation are reused. Active Quiz wording must be synchronized across project documentation. Obsolete mode-specific tests are replaced while their authorization, ordering, identity, retry and Progress invariants remain covered.

## 14. Open questions

None. HUMAN-approved requirements resolve the active mode, access, ordering, Meaning selection, distractor boundary, failure behavior, grading, Progress and UI direction.

## 15. Approval gate

HUMAN approved this SPEC and the accompanying PLAN. Implementation is complete and remains `IN_PROGRESS` pending formal TEST, REVIEW, guarded CI and final HUMAN approval.
