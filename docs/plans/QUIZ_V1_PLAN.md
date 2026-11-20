# PLAN: Multiple Choice Quiz V1

**Source SPEC:** `docs/specs/QUIZ_V1_SPEC.md`

**PLAN status:** `HUMAN APPROVED`

**Implementation authorized:** `YES — HUMAN approved TASK + implementation`

## 1. Summary

Evolve the existing Quiz stack in place from two typed/unscramble modes to one `MULTIPLE_CHOICE` mode. Retain USER-only routes, Set authorization, ordered exact-ID traversal, transient run state, opaque revisions, transactional grading, Progress concurrency controls, Focus Mode and Set navigation.

The backend will construct four deterministic opaque choices per Set question, preferring Set items and filling only deficits from canonical outside-Set Vocabulary. Submission reconstructs and grades the selected choice inside the existing transaction and updates only the question Vocabulary's Progress. The frontend removes type selection and replaces text/tile controls with an accessible responsive single-choice group.

No schema migration, dependency, external service, role or parallel Quiz architecture is planned.

## 2. Affected areas

- **Database:** Existing models unchanged; no migration.
- **Backend:** Quiz domain helpers, repository projections/locks, service generation/grading and safe errors.
- **API:** Existing paths; replaced type, question, answer and result shapes.
- **Frontend:** Quiz API validation, run-state attempt shape, page/presentation and mocked fixtures. Route/shell/navigation/restart/completion remain.
- **Tests:** Replace obsolete mode assertions while retaining security, identity, Progress, retry and concurrency coverage.
- **Documentation:** Synchronize active Quiz sources during implementation; status stays `IN_PROGRESS` until TEST/REVIEW/HUMAN approval.

## 3. Existing code to reuse

- `backend/src/routes/quiz-routes.js` — USER middleware order and endpoint paths.
- `backend/src/controllers/quiz-controller.js` — thin delegation, envelopes and safe error mapping.
- `backend/src/services/quiz-service.js` — validation, ordered mapping, answer transaction/retry and Progress mapping.
- `backend/src/services/quiz-domain.js` — primary-Meaning selection, digest and canonical serialization.
- `backend/src/repositories/quiz-repository.js` — Set authorization, transactions, locks and Progress access.
- `backend/prisma/schema.prisma` — Set, Item, Vocabulary, Meaning and Progress models.
- `frontend/src/services/quiz-service.js` — endpoint client, exact request/response validation and error mapping.
- `frontend/src/quiz/quiz-run-state.js` — run identity, pending attempt, reconciliation, restart and summary.
- `frontend/src/quiz/quiz-presentation.js` — load deduplication and safe state classification.
- `frontend/src/quiz/quiz-foundation-page.jsx` — load/submit/retry/conflict/feedback/completion flow and focus modality.
- `frontend/src/quiz/quiz-navigation.js` and `frontend/src/auth/ui/authenticated-shell.jsx` — exact return path and Focus Mode.
- Existing Quiz unit, mocked browser and guarded integration suites — preserve invariants and replace removed-mode assertions.

## 4. Database plan

### Existing models

- `VOCABULARY_SET`/`VOCABULARY_SET_ITEM`: accessible questions and order.
- `VOCABULARY`: exact identities, English words and canonical/private boundary.
- `VOCABULARY_MEANING`: deterministic Vietnamese labels and part of speech.
- `LEARNING_PROGRESS`: unique `(user_id, vocabulary_id)` state.

### Changes and boundaries

- No Prisma/migration/index change and no Quiz persistence.
- Only the selected Set Item Vocabulary can reach Progress writes.
- Distractor identities are transient reconstruction/revision inputs only.
- Existing deletion and `RESTRICT` behavior remains.

## 5. Backend plan

### Routes, middleware and controller

Keep `GET /api/quiz/sets/:setId/questions` and `POST /api/quiz/answers`, with authentication before USER authorization. Keep thin controllers; add safe mappings for `QUIZ_CHOICES_UNAVAILABLE` and `QUIZ_CHOICE_CHANGED` without exposing candidate details.

### Domain helpers

Extend `quiz-domain.js` with pure helpers for normalized Vietnamese-label comparison, candidate deduplication/ambiguity exclusion, versioned digest ranking, opaque choice IDs/order and Multiple Choice revision derivation. Reuse primary-Meaning selection.

Remove typed normalization/equivalence/character feedback and Unscramble tile helpers only after callers/tests migrate.

### Repository/data access

Revise the accessible Set projection to return ordered question Vocabulary ID/word/version, ordered Meanings and current USER Progress.

Add a narrow canonical fallback query that:

- enforces `owner_id = null`;
- excludes selected Set/question Vocabulary IDs;
- returns only candidate identity/version and ordered Meaning fields;
- never reads private fallback candidates;
- uses bounded deterministic over-fetch and permits a safe unavailable result.

Extend transaction reads/locks to reconstruct current Set membership/position, word/version, correct Meaning and the same candidate inputs. Read and answer paths must share one deterministic builder.

### Question generation

1. Validate exact query/UUID and `MULTIPLE_CHOICE`.
2. Authorize/load Set; reject empty Set.
3. Resolve a valid primary Meaning for every question or fail atomically.
4. Build normalized-unique local candidates from other Set items.
5. Fill only deficits from canonical outside-Set candidates.
6. Fail with `QUIZ_CHOICES_UNAVAILABLE` if fewer than three remain.
7. Generate opaque choices/order/revision.
8. Return all questions in Set order with exactly four safe choices.

### Answer transaction

1. Validate exact body and active type.
2. Lock/re-authorize Set and current membership.
3. Reconstruct correct Meaning, candidates, choices and revision inside the transaction.
4. Reject changed revision before Progress work.
5. Resolve selected ID only against reconstructed choices; reject unknown/stale IDs.
6. Compare with reconstructed correct choice.
7. Apply existing status/idempotency/revision/concurrency logic only to question Vocabulary.
8. Return choice feedback and Progress; never mutate distractors/SRS/another USER.

## 6. API contract

### Get questions

`GET /api/quiz/sets/:setId/questions?type=MULTIPLE_CHOICE&run_id=<uuid>`

Authenticated USER; public or owned private Set. Each question returns `vocabulary_id`, contiguous `position`, opaque `question_revision`, `prompt.word`, available `prompt.part_of_speech`, four `{ choice_id, label }`, and current Progress.

Frontend validation rejects missing/extra fields, other types, duplicate IDs/normalized labels and correctness/source leakage.

### Submit answer

`POST /api/quiz/answers`

Exact request: `event_id`, `set_id`, `vocabulary_id`, `run_id`, `question_revision`, `quiz_type`, `expected_revision`, `selected_choice_id`.

Success: submitted identities, `is_correct`, `selected_choice_id`, `correct_choice_id`, Progress.

Remove active `answer`, `correct_answer`, `normalized_answer`, `character_feedback`, tile, slot and shuffle fields. Retain existing auth/not-found/empty/changed/retry/Progress errors and add only the two approved choice errors.

## 7. Frontend plan

### Route and service

- Keep route, `UserRoute`, Focus Mode and exact return path.
- Remove type-selection UI/query dependency; initialize/resume `MULTIPLE_CHOICE` directly.
- Service accepts only active type, serializes selected choice ID, validates four safe choices/results and rejects leakage.

### Run state

- Keep identity scoped by USER/Set/type/run.
- Pending retry stores selected choice ID plus current event/revisions.
- Accepted state stores only correctness/revision needed for summary/reconciliation.
- Do not persist correct labels, full choices, distractor identities or durable history.

### Page/presentation

- Replace type selection, typed form, Unscramble form and character feedback with one accessible choice group/feedback component.
- Retain top bar, progress, question card, pending/retry/conflict, restart and completion structures.
- Render English heading and optional part of speech.
- Four radio-card choices A–D; explicit submit; lock while pending/accepted.
- Feedback distinguishes selected/correct via icon, text and color.
- Preserve pointer-versus-keyboard focus behavior, live announcement and restart-dialog focus return.

### Responsive strategy and states

- Fluid bounded Focus Mode; one choice column by default, two only at sufficient container width using existing CSS/Tailwind conventions without dependencies.
- No fixed card heights; long content wraps; no page overflow.
- ≥44px targets, correct cursor semantics, visible focus, hover/active and reduced motion.
- Cover loading, empty, choices-unavailable, retryable failure, question/choice changed, Progress conflict, active, pending, feedback and completion.

## 8. Validation and security

- Exact fields; reject extras on both sides.
- Backend session/USER/visibility/ownership/current-membership enforcement.
- Never accept correctness, score, status, counters or distractor identity from client.
- Canonical-only fallback and no foreign-private query/response.
- Revision/choice validation before Progress mutation.
- Safe errors reveal no candidate/count/private details.
- Loading and all non-accepted interactions remain read-only.

## 9. Test and UI/UX acceptance matrix

| Area | Evidence | Boundary |
|---|---|---|
| Primary Meaning | CEFR priority/ties/fallback and matching POS | Backend unit |
| Label uniqueness | NFC/whitespace/case dedupe; punctuation/diacritics retained | Backend unit |
| Set-first/small Sets | Local preference; 1–3 item fallback fills only deficits | Unit + guarded integration |
| Canonical privacy | `owner_id=null`; no own/foreign private outside fallback | Repository unit + guarded integration |
| Unbuildable | Atomic safe error; no partial questions/Progress | Service/API |
| Contract/leakage | Four opaque unique choices; English prompt; no correct/source marker | Backend + frontend service |
| Determinism | Same run stable; restart may vary; content change alters revision | Backend unit |
| Choice tampering | Unknown/stale/cross-question ID rejected pre-write | Backend answer unit |
| Authorization | Guest 401, ADMIN 403, foreign concealed, public/owned success | Mocked + guarded integration |
| Progress/SRS | Mapping, single increment, SRS unchanged | Unit + guarded integration |
| Retry/concurrency | Identical retry no-write; competing events accept one | Unit + guarded integration |
| Isolation | Only current USER/question Vocabulary changes | Guarded integration |
| Run state | Resume/reconcile/restart/pending retry/no answer persistence | Frontend unit |
| Direct start | No type selector; route reload/Set entry works | Unit + mocked Playwright |
| Selection/pending | Single choice, disabled submit, lock/double-submit | Mocked Playwright |
| Keyboard/focus | Tab/arrows/Space; keyboard result focus; pointer stability | Mocked Playwright |
| Feedback/states | Non-color result/live status plus all load/error/conflict/completion states | Unit + mocked Playwright |
| Responsive | 320, 375, 390, 430, 600, 768, 820, 1024, 1280, 1440 plus transition-adjacent/narrow containers | Screenshots/layout assertions |
| Landscape/zoom/content | Relevant landscape, 200% zoom, long labels, no clipping/page overflow, ≥44px | Browser/manual review |
| Cursor/motion | Enabled pointer; disabled non-interactive; focus/hover/active/reduced motion | Computed browser checks |
| Navigation/regression | Exact public/private return; Flashcard/Speaking/Set detail unchanged | Unit + mocked + guarded CI |

Local verification is database-free: backend units, frontend units, mocked Playwright, ESLint, build, syntax and `git diff --check`. Real authorization, Progress, retry and concurrency verification runs only in guarded CI against its confirmed TEST environment.

## 10. Test replacement map

Retain/adapt backend authorization, ordering, exact identity, transaction, retry, rollback and concurrency; frontend service errors, run reconciliation, restart, navigation, load deduplication and focus behavior; real-stack access/Progress isolation.

Replace—not skip—free-text normalization/hyphen, character alignment, Unscramble tile/slot/shuffle/fallback, and type-selection assertions with Multiple Choice generation, contract, interaction and feedback coverage.

## 11. Documentation impact

During implementation synchronize:

- this SPEC/PLAN status;
- `docs/PROJECT_OVERVIEW.md` active single-mode description;
- `docs/ARCHITECTURE.md` deterministic construction/backend grading;
- `docs/DATABASE.md` unchanged no-persistence boundary;
- `docs/API_SPEC.md` exact active contract/errors;
- `docs/UI_UX_SPEC.md` direct entry, choices, feedback, responsive/accessibility;
- `docs/FEATURE_STATUS.md` as `IN_PROGRESS` until guarded TEST/REVIEW/HUMAN approval;
- `docs/tasks/QUIZ_V1_TASK.md` only through the later TASK skill.

Historical modes may remain only when explicitly labelled historical.

## 12. Ordered implementation stages

1. After approval, synchronize active contract terminology/status without claiming completion.
2. Implement domain choice helpers and deterministic unit tests.
3. Implement repository Set/canonical candidate projections and privacy tests.
4. Replace service/API modes/payloads, all-or-nothing generation and transactional grading/error mapping.
5. Run database-free backend verification; reserve DB assertions for guarded CI.
6. Replace frontend service/run-state contracts while retaining retry/reconciliation.
7. Remove type selection and implement accessible responsive choice/feedback UI.
8. Run one consolidated mocked visual checkpoint across widths/transitions/landscape/zoom/long content for HUMAN review.
9. Replace obsolete tests, preserve cross-feature regressions and synchronize docs while status stays `IN_PROGRESS`.
10. Execute formal TEST and REVIEW skills plus guarded CI; resolve findings.
11. Mark `DONE` only after guarded CI, review approval and HUMAN acceptance.

Detailed executable decomposition belongs to TASK after PLAN approval.

## 13. Risks and mitigations

- **Read/answer drift:** one shared deterministic builder; transactional reconstruction/revision.
- **Large canonical pool:** bounded deterministic projection/over-fetch; measure in guarded CI; safe failure before caching/schema work.
- **Duplicate labels:** normalize before selection; include chosen Meaning versions in revision.
- **Privacy:** repository canonical predicate and no candidate detail in errors.
- **ID inference:** digest-backed opaque IDs with no source/correctness data.
- **Concurrent content/Progress:** locks/current reads, revision and expected Progress revision before mutation.
- **Responsive regressions:** consolidated container-transition, long-content and zoom pass.
- **Historical confusion:** synchronize active docs and label removed modes historical.

## 14. Scope/dependency check

No migration, dependency, external service, role, endpoint proliferation, Quiz history, SRS/gamification change, or unrelated Flashcard/Speaking/Set redesign. Existing architecture is extended rather than replaced.

## 15. Open questions

None blocking. Implementation may choose the smallest query/CSS mechanism consistent with existing conventions while preserving all observable rules.

## 16. Approval gate

HUMAN approved this PLAN and the accompanying SPEC. The ordered TASK and implementation are complete; formal TEST, REVIEW, guarded CI and final HUMAN approval remain before closure.
