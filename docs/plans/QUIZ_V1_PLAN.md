# PLAN: Quiz V1

**Source SPEC:** `docs/specs/QUIZ_V1_SPEC.md` (HUMAN APPROVED, including revision)

**PLAN status:** `HUMAN APPROVED`

**Human approval:** `APPROVED`, including the post-TASK-086 revision.

**Implementation authorized:** `YES` — according to the TASK-086A/TASK-086B HUMAN gates.

## 1. Summary

Quiz V1 will provide a USER-only, Set-scoped Quiz flow for exactly `VI_TO_ENGLISH` and `UNSCRAMBLE_WORD`. It reuses completed Authentication, Vocabulary Set authorization, ordered Set Items, Vocabulary content and per-USER/per-Vocabulary Learning Progress.

This PLAN was revised by HUMAN request after TASK-086 visual review. TASK-080 through TASK-086 evidence for the former `MISSING_LETTER` implementation remains historical; the active contract replaces that type and requires TASK-086A/TASK-086B before TASK-087.

The backend follows the existing route → authentication/USER authorization → controller → service → repository → Prisma composition. Question loading is read-only. Answer submission re-authorizes and locks the current Set/Item/question inputs, validates an opaque stateless `question_revision`, evaluates the normalized answer and applies the one authoritative Learning Progress mutation in one transaction. `event_id` and `expected_revision` provide exactly-once mutation for the current event without claiming historical Quiz-result replay.

The frontend adds a Quiz service and USER route, owns a transient same-tab run in a Quiz-specific `sessionStorage` namespace and completes every ordered Set Item once. A mandatory HUMAN UI/UX Design Checkpoint follows the functional route/run-state foundation and precedes the production Quiz page. No Prisma change, Quiz Session/Attempt persistence, SRS, gamification, Pronunciation or third Quiz type is planned.

## 2. Scope and Acceptance-Criteria Traceability

| Approved SPEC criteria | Planned implementation / evidence |
|---|---|
| AC-01 | Existing authentication/USER middleware, public-System/owned-private Set predicates, concealed non-owner tests and USER browser route guards. |
| AC-02 | Repository Item `position` ordering, single-type validation and run/completion tests covering every Item once. |
| AC-03 | Backend primary-Meaning selector matching current CEFR-first scan over `created_at → id`; safe `VI_TO_ENGLISH` projection and leakage-shape tests. |
| AC-04 | Stateless digest-derived Unscramble tiles/slot pattern keyed by run and authoritative question inputs, opaque duplicate-safe tile IDs, deterministic fallback and restart/reload tests. |
| AC-05–AC-06 | Backend NFC/Unicode-whitespace/lowercase normalization and Unicode-code-point feedback unit/API coverage. |
| AC-07–AC-10 | Transactional Progress mutation, question revision, current-event retry, stale revision, concurrent request and no-secondary-Learning-event coverage. |
| AC-11–AC-12 | Quiz-owned run-state helper, same-tab reconciliation, restart and transient completion tests proving non-assessment actions are read-only. |
| AC-13 | Stable safe error mapping for invalid, concealed, empty, changed-question/item, retry-conflict and unexpected failures. |
| AC-14 | HUMAN UI/UX checkpoint followed by keyboard, focus, non-color feedback, responsive and reduced-motion browser evidence. |
| AC-15 | Scoped Auth/Learning/Progress/Set backend and frontend/real-stack regressions. |
| AC-16 | Schema/diff/dependency/documentation review confirms no deferred domain, persistence or additional Quiz type. |

## 3. Affected Areas

- **Database:** No schema, model, constraint, migration or persisted Quiz data. Reuse current Set, Vocabulary, Meaning and Learning Progress tables.
- **Backend:** Add Quiz repository, service, controller and routes; compose them in `create-app.js`; use built-in `node:crypto` only.
- **API:** Add the two approved USER endpoints under `/api/quiz`; preserve Learning APIs unchanged.
- **Frontend:** Add a Quiz API service, transient run-state helpers/observer, guarded route foundation and—only after design approval—the production Quiz UI and Set entry actions.
- **Tests:** Add deterministic pure-logic tests, guarded API/database/security tests, frontend unit/browser coverage and guarded real-stack integration.
- **Documentation:** Synchronize active Quiz database/API/UI/architecture/status wording after PLAN and TASK approval, before implementation.

## 4. Existing Code and Conventions to Reuse

- `backend/src/create-app.js` — dependency composition, existing authentication/role middleware and final safe error handler.
- `backend/src/routes/learning-routes.js`, `controllers/learning-controller.js`, `services/learning-service.js`, `repositories/learning-repository.js` — USER route layering, Set concealment, Progress projection, transaction timeout and current-event/revision semantics to reproduce without changing the Learning API.
- `backend/src/repositories/vocabulary-set-repository.js` — System/public versus private-owner authorization predicates and explicit Item ordering conventions.
- `backend/prisma/schema.prisma` — existing UUID Set/Vocabulary/Meaning/Progress fields, timestamps, ownership and `RESTRICT` behavior; it remains unchanged.
- `backend/test/helpers/test-environment.js`, `test-database.js` and `backend/test/scripts/prepare-test-database.js` — mandatory guarded dedicated TEST DB preparation/reset/cleanup paths.
- `backend/test/learning/learning.test.js` and `vocabulary-set/vocabulary-set.test.js` — real HTTP, security, transaction/concurrency and controlled-fixture patterns.
- `frontend/src/services/http-client.js` and `services/learning-service.js` — same-origin credential/error/response-validation conventions.
- `frontend/src/learning/learning-presentation.js` — authoritative current primary-Meaning behavior reference; backend Quiz selection must match its observable result rather than depend on frontend authority.
- `frontend/src/learning/learning-run-state.js` and `learning-session-storage-observer.jsx` — feature-owned same-tab state, reconciliation and logout/session-invalidation cleanup patterns.
- `frontend/src/app-router.jsx`, `auth/ui/route-guards.jsx` and `auth/ui/authenticated-shell.jsx` — existing `ProtectedRoute → AuthenticatedShell → UserRoute` structure.
- `frontend/src/vocabulary-sets/public-vocabulary-set-pages.jsx` and `my-vocabulary-sets-page.jsx` — accessible Set actions and empty/non-empty Set distinctions.
- Existing frontend unit, mocked Auth/App Layout Playwright and `frontend/e2e/integration/global-setup.js` infrastructure — guarded browser and cleanup conventions.

No hashing, state-management, form or UI dependency is added. Node's built-in crypto and existing React/browser primitives are sufficient.

## 5. Documentation Synchronization Gate

After HUMAN PLAN and TASK approval, synchronize only the approved active Quiz V1 contract:

1. **`docs/API_SPEC.md`:** replace legacy numeric/gamification Quiz examples with the two USER endpoints, UUID/run/question revision, safe projections, normalization, result and Progress mutation semantics. Explicitly defer XP/SRS/history and remove any implication of parallel Learning submission.
2. **`docs/DATABASE.md`:** mark `QUIZ_ATTEMPT` as deferred/not materialized for V1; record reuse of `LEARNING_PROGRESS` and no schema migration. Preserve future product direction without presenting it as current storage.
3. **`docs/UI_UX_SPEC.md`:** record the functional USER route, type selection, ordered question/run states, feedback, completion, accessibility and mandatory later design checkpoint. Do not invent final visuals.
4. **`docs/ARCHITECTURE.md`:** retain layered architecture and document Quiz as a backend-authoritative domain only where active generic Quiz illustrations conflict.
5. **`docs/FEATURE_STATUS.md`:** advance only the four covered Quiz rows to the workflow-appropriate status. Keep SRS, Pronunciation, gamification and additional types `TODO`.

Documentation synchronization is not implementation authorization and must not mark Quiz V1 `DONE`.

## 6. Database and Persistence Plan

### 6.1 Schema Conclusion

- Make no change to `backend/prisma/schema.prisma` or migrations.
- Create no `QUIZ`, `QUIZ_SESSION`, `QUIZ_ATTEMPT`, result, mask, question, score or character-feedback table.
- Persist no `run_id`, `question_revision`, learner answer, canonical answer, type or completion total.
- Keep Learning Progress unique per `(user_id, vocabulary_id)` and use its existing `status`, `review_count`, `revision`, `last_reviewed_at` and `last_event_id` fields.
- Leave `next_review_at`, `interval_days` and `ease_factor` unchanged/null and never assign `NEEDS_REVIEW`.

### 6.2 Referential and Read-Only Boundaries

- Existing Set/Item and Progress foreign-key/delete behavior remains unchanged.
- Question loading performs only reads and must pass before/after invariance tests.
- Quiz completion/restart creates no durable record.
- All DB-dependent verification uses only `configureTestEnvironment()` and existing TEST reset authorization. No raw unguarded Prisma database command is planned.

## 7. Backend Design

### 7.1 Route and Middleware

Add `backend/src/routes/quiz-routes.js` mounted at `/api/quiz`:

- `GET /sets/:setId/questions`;
- `POST /answers`.

Apply existing Authentication middleware and `USER` role middleware to the router. No public or ADMIN Quiz router is added.

### 7.2 Controller

Add `backend/src/controllers/quiz-controller.js` with thin handlers that:

- extract authenticated `req.user.id`, params/query/body;
- call the Quiz service;
- return the existing `{ success, data }` envelope;
- map only documented known Quiz validation/not-found/empty/item-changed/question-changed/retry/progress-conflict errors;
- delegate all unexpected errors to the existing final safe handler.

### 7.3 Pure Quiz Domain Helpers

Keep deterministic, side-effect-free functions in the Quiz service module or one focused helper module when independent testing improves clarity:

- primary Meaning selection: consume repository order `created_at`, then `id`; scan once using `A1, A2, B1, B2, C1, C2` rank and keep the first tie, matching current Flashcard behavior;
- answer normalization: require bounded string, trim, NFC, replace Unicode-whitespace runs with ASCII space, apply locale-independent Unicode lowercase;
- correctness: exact normalized comparison;
- character feedback: compare arrays of Unicode code points, including missing/extra positions, and emit textual state data;
- Unscramble projection: NFC/code-point iteration; selectable Unicode letters/digits; fixed significant spaces/apostrophes/hyphens/other punctuation; opaque duplicate-safe tile IDs; separator-only slot pattern; deterministic digest-backed pool ordering; visibly different permutation when possible; explicit `IDENTITY_FALLBACK` otherwise;
- deterministic mask positions: derive SHA-256 bytes from a versioned serialization of `(run_id, set_id, vocabulary_id, canonical word)` and select unique eligible positions without external randomness. Use a fixed hide-count rule documented and tested during implementation so the same tuple is stable across processes;
- question revision: SHA-256/base64url digest of a versioned canonical serialization containing only opaque authoritative version metadata. Include Set Item identity/position, type, current Vocabulary `updated_at` and primary Meaning ID/`updated_at`; for Unscramble also include `run_id` and shuffle/slot-policy version. Never embed the canonical word in the response token.

Use explicit domain/version prefixes in mask/revision serialization so later algorithm changes cannot silently reinterpret current runs.

### 7.4 Repository / Read Payload

Add `backend/src/repositories/quiz-repository.js` for Quiz-specific Prisma access:

- find one currently accessible Set using `is_public = true OR (is_public = false AND owner_id = userId)`;
- return Items by `position`, Vocabulary ID/version and only the fields required by the selected question type;
- for Vietnamese questions, return Meanings by `created_at`, then `id`, including ID/version, Vietnamese content, context, POS and CEFR;
- include only the current USER's Progress projection needed for expected revision;
- never return or serialize unrelated owner/session/other-USER Progress data;
- expose transaction-scoped Set/Item/question-content lock/read operations and Progress create/conditional-update/read operations.

Repository projections may read the canonical word internally for mask/evaluation but controllers and pre-answer serializers must never expose it.

### 7.5 Question Loading Service

Validate exact query fields `type` and `run_id`, UUIDs and approved type. Then:

1. authorize the Set with the current USER predicate;
2. reject an accessible empty Set;
3. build every question in Item position order;
4. choose primary Meaning for `VI_TO_ENGLISH`, rejecting invalid content safely rather than returning a partial run;
5. generate stable tiles, slot pattern and fallback mode for `UNSCRAMBLE_WORD`;
6. calculate opaque question revision and current Progress revision;
7. serialize only the SPEC-approved question projection.

The service never mutates Progress or creates transient server state.

### 7.6 Transactional Answer Service

Validate an exact body containing `event_id`, `set_id`, `vocabulary_id`, `run_id`, `question_revision`, `quiz_type`, `expected_revision` and `answer`. Execute one Prisma interactive transaction with existing max-wait/timeout conventions:

1. lock/re-authorize the accessible Set;
2. lock/verify the addressed current Set Item;
3. lock/read the current Vocabulary and, for Vietnamese, current deterministic primary Meaning required for evaluation/versioning;
4. recompute and compare `question_revision`; mismatch produces question-changed conflict before mutation;
5. normalize/evaluate the current canonical word and produce the target status;
6. read current USER/Vocabulary Progress;
7. if `last_event_id` matches, perform no write, require the recomputed target status to match current stored status, and return recomputed transient feedback plus current Progress; incompatible retry returns a safe retry conflict;
8. otherwise require expected revision (`0` for absent row, exact revision for existing row), then create or conditionally update Progress once with target status, incremented review count/revision, backend time and event ID;
9. if a unique/serialization race occurs, reload current Progress: return the no-write retry path only for the matching current event, otherwise return progress conflict.

Locks and/or transaction isolation must keep question-version validation, correctness evaluation and Progress mutation within one authoritative snapshot. Do not refactor the completed Learning endpoint unless a concrete shared defect proves necessary; shared semantics are protected through equivalent contract tests.

## 8. API Contract Plan

### 8.1 Question Endpoint

`GET /api/quiz/sets/:setId/questions?type=<type>&run_id=<uuid>`

Success contains:

- Set `id`, `name`;
- selected `quiz_type`, echoed `run_id`;
- ordered questions with `vocabulary_id`, position, opaque `question_revision`, prompt shape and current Progress `{ status, review_count, revision, last_reviewed_at }` or conceptual `NEW` projection.

Both prompts include primary Vietnamese meaning and optional context/POS/CEFR. `UNSCRAMBLE_WORD` additionally returns only opaque shuffled selectable tiles, a separator-only slot pattern and fallback mode. Neither returns canonical answer, word, phonetic, pronunciation URL or English Examples before evaluation.

### 8.2 Answer Endpoint

`POST /api/quiz/answers`

Request is exactly the eight SPEC fields. Success returns:

- addressed identity/type;
- `is_correct`;
- canonical and normalized submitted answer;
- Unicode-code-point feedback;
- resulting Progress status/count/revision/time.

An immediate identical logical retry may recompute this transient result but cannot mutate twice and is not guaranteed to reproduce a historical response byte-for-byte.

### 8.3 Safe Error Mapping

Finalize stable Quiz codes during documentation synchronization/implementation for:

- `400 VALIDATION_ERROR`;
- concealed `404` Set not found;
- `409` empty Set;
- `409` changed Set Item;
- `409` changed question revision;
- `409` incompatible current-event retry;
- `409` stale/different Progress event;
- existing `401`, `403` and safe `500` behavior.

The service must distinguish these cases for actionable frontend states without exposing raw Prisma errors or whether another USER owns a private Set.

## 9. Frontend Foundation Plan

### 9.1 Service and Route

- Add `frontend/src/services/quiz-service.js` with strict request serialization, response validation and safe error-kind mapping for the two endpoints.
- Add `/quiz/vocabulary-sets/:setId` under existing `ProtectedRoute → AuthenticatedShell → UserRoute`.
- Add Quiz entry actions only to applicable public/owned Set detail surfaces; Guest follows existing login behavior, ADMIN sees no learner action and empty private Sets cannot start.
- Do not add a Sidebar Quiz catalog/navigation destination unless the later HUMAN design checkpoint explicitly places an already-approved Set-scoped entry; no standalone Quiz discovery route exists.

### 9.2 Quiz-Owned Run State

Add feature-scoped pure helpers and a Quiz storage observer patterned after Learning:

- key by authenticated USER, Set, selected type and transient `run_id`;
- store only cursor/current Vocabulary, type, accepted transient results required for completion and question identities/revisions; store no session token or canonical answer beyond the already-revealed transient result needed for same-tab feedback;
- reconcile on every fresh authorized payload by ordered Vocabulary ID and question revision;
- discard/restart safely when Set/type/run data or an unanswered question revision is invalid;
- prevent accepted question resubmission in the normal run;
- restart clears only the current Quiz run, creates a new run ID and fetches regenerated Unscramble tile ordering;
- logout/session invalidation clears the Quiz namespace through a Quiz-owned observer, without coupling Auth internals to storage keys.

Question loading, typing, navigation, reload, feedback, restart and completion state perform no secondary Progress request.

### 9.3 Functional Foundation Boundary

Before the design checkpoint, implement only testable service, route, run-state and neutral state scaffolding. Do not finalize visual card/question composition, motion or production responsive styling.

## 10. Mandatory HUMAN UI/UX Design Checkpoint

After backend verification and frontend foundation, but before production Quiz UI, record and obtain HUMAN approval for a focused checkpoint covering:

- Set/type selection and entry flow;
- `VI_TO_ENGLISH` and `UNSCRAMBLE_WORD` question anatomy without answer leakage;
- typed-answer and tile-construction inputs, submit, pending, correct/incorrect and shared underline-based Unicode per-character feedback;
- explicit next-question behavior and accepted-question lockout;
- ordered progress, restart confirmation and transient completion summary;
- loading, empty, concealed/not-found, validation, item/question-changed, retry-conflict and operational retry states;
- keyboard/focus/live-region/non-color semantics;
- mobile/tablet/desktop behavior, long words/feedback and reduced motion;
- visual consistency with ELVocab and existing AuthenticatedShell without redesigning App Layout or Flashcard.

HUMAN approval is a hard dependency for production UI implementation. The checkpoint cannot add a third/mixed type, timer, durable score/history, SRS, rewards, Pronunciation, analytics or new API.

## 11. Production Frontend Plan After Design Approval

Implement the approved UI with small feature-scoped components/helpers where they materially improve state isolation or accessibility:

- single selected-type run and ordered progress;
- labelled native answer form for `VI_TO_ENGLISH`; accessible click/tap/keyboard tile pool and answer slots for `UNSCRAMBLE_WORD`; pending duplicate protection for both;
- stable opaque tile identity, append-next-slot selection, exact-tile removal and restoration to original pool order without drag-and-drop;
- correct/incorrect result with canonical answer and shared wrapping underline feedback carrying explicit `correct`/`incorrect`/`missing`/`extra` semantics, not dependent on color;
- explicit next action; no immediate re-answer of accepted question;
- focus transitions to result, next question and completion heading;
- safe retry using the identical logical event request until conclusive;
- changed-item/question/progress conflict refresh/restart behavior;
- transient total/correct/incorrect completion and restart/return actions;
- responsive layout, visible focus, adequate touch targets, no horizontal overflow and reduced-motion handling.

Preserve successful state during retry where safe, never fabricate results and never calculate authoritative correctness/Progress in the frontend.

## 12. Testing and Verification Strategy

### 12.1 Pure Backend Unit Coverage

Cover without database access:

- both allowed types and rejection of unknown types/extra fields;
- primary Meaning equivalence to current Flashcard behavior across CEFR, tie and null cases;
- NFC, Unicode whitespace, locale-independent lowercase, apostrophe/hyphen and empty-answer rules;
- Unicode-code-point feedback including missing/extra characters;
- stable Unscramble tile identity/order and slot-pattern invariants, restart seed variation, duplicate tiles, fixed separators and `IDENTITY_FALLBACK` edge cases;
- opaque revision stability/change behavior and absence of answer material in its inputs/output projection;
- safe question serialization and structural non-disclosure.

### 12.2 Guarded Backend/API/Security Coverage

Using only the dedicated guarded TEST DB, cover:

- public System/owned-private success and Guest/ADMIN/non-owner concealment;
- ordered all-Item payload for both types and no canonical/direct answer-bearing fields;
- read-only question-load invariance;
- current membership and question revision validation under Set/Vocabulary/Meaning changes;
- correct/incorrect status mapping, counters, timestamps and per-USER isolation;
- immediate identical retry no-write behavior and recomputed feedback;
- incompatible retry, stale revision and concurrent different-event conflicts;
- rollback on validation/reference/question/transaction failure;
- future SRS fields unchanged and no Quiz persistence objects;
- controlled fixture cleanup.

Add Quiz to `backend/package.json` focused and complete guarded integration commands only when tests exist; preserve explicit sequential execution and current CI guard behavior.

### 12.3 Frontend Unit / Mocked Browser Coverage

Cover:

- service request/response validation and safe error mapping;
- run creation, same-tab resume/reconciliation, accepted lockout, restart and completion totals;
- storage namespace cleanup on observed logout/session invalidation;
- type selection and exact ordered traversal;
- loading/empty/error/pending/result/conflict/completion states;
- retry reuses the identical event payload and sends no Learning event;
- keyboard submission, focus restoration, announcements, non-color feedback, reduced motion and responsive no-overflow behavior;
- Guest/ADMIN route guards and Set entry-action eligibility.

### 12.4 Guarded Real-Stack Browser Coverage

Reuse existing integration global setup and targeted fixtures to verify both complete flows against Express/Prisma/PostgreSQL:

- USER starts from System and owned Sets;
- each type traverses every Item once;
- Unscramble tile order/identity is stable on reload, duplicate-safe and regenerated from a new run;
- correct/incorrect submission, result, next and completion;
- uncertain-response retry does not double-count;
- changed question/conflict is actionable;
- non-owner/ADMIN/Guest access remains protected;
- responsive/keyboard/accessibility behavior and targeted cleanup.

### 12.5 Scoped Regressions and Quality Gates

- Backend: Authentication, Vocabulary Set, Learning and Learning Progress suites because Quiz shares authorization/data/progress boundaries.
- Frontend/browser: Auth/App Layout, USER Vocabulary Set entry/detail, Learning run and Learning Progress views.
- Static: focused unit tests, ESLint, production build, `git diff --check`, secret/scope scan.
- Guarded DB: exact fixture cleanup and no Main/Preview/Production access.

Record exact PASS/FAIL/TODO/NOT RUN evidence. Do not substitute task tests for later formal TEST/REVIEW.

## 13. Implementation Order and Dependencies

1. Preserve completed TASK-080 through TASK-086 evidence as the original approved/implemented `MISSING_LETTER` baseline.
2. Obtain HUMAN approval for this revised SPEC/PLAN/TASK/UI checkpoint before changing implementation.
3. TASK-086A replaces the backend/domain/API `MISSING_LETTER` contract with `UNSCRAMBLE_WORD`, adds focused guarded coverage and updates frontend service/run-state contract shapes without production presentation work.
4. After TASK-086A HUMAN approval, TASK-086B replaces the production Missing Letter UI with the accessible tile interaction, adopts shared underline feedback for both types, completes focused frontend verification and obtains renewed HUMAN visual approval.
5. Only then unblock TASK-087 frontend/browser/accessibility coverage.
6. Continue TASK-088 guarded real-stack/regressions and TASK-089 formal TEST/REVIEW/closure in the existing order.

Dependency chain:

```text
HUMAN-approved contract revision
    → TASK-086A backend/domain/API + guarded verification
    → HUMAN approval of TASK-086A
    → TASK-086B frontend tile/feedback UI + focused verification
    → HUMAN visual approval of TASK-086B
    → Browser / guarded real-stack / regressions
    → Formal TEST / REVIEW
    → HUMAN closure approval
    → DONE
```

## 14. Safety and Rollback Boundaries

- No schema/migration rollback exists because persistence is unchanged.
- Quiz router/composition can be removed without changing Learning APIs or stored data.
- Quiz Progress mutations use existing rows/semantics and must be regression-tested before frontend exposure.
- Feature-specific sessionStorage is disposable and must never contain credentials or session tokens.
- Never commit environment files, fixture credentials, browser reports/traces/screenshots, logs or generated artifacts.
- Any need for durable retry replay, Quiz history/accuracy, additional type, SRS/reward logic, external service, new schema or different ownership behavior stops work and returns for HUMAN SPEC review.

## 15. Risks and Assumptions

- **Retry response boundary:** Existing Progress stores only the current event ID/state, not historical Quiz response data. Tests must distinguish exactly-once mutation from exact response replay and exercise incompatible retries.
- **Question-version races:** Validation must be inside the answer transaction with content locks/snapshot discipline; validating before the transaction could grade stale content.
- **Structural leakage:** Direct answer fields must be absent. Administrator-authored Vietnamese prompt text is trusted content and is not rewritten.
- **Shuffle determinism:** Cross-process stability requires canonical serialization, opaque tile identities and a versioned digest-backed algorithm, not runtime-random or implementation-dependent iteration.
- **Unicode:** JavaScript string indexing is UTF-16; helpers must explicitly iterate code points and test composed/decomposed forms.
- **Shared Progress:** Quiz and Flashcard events update the same row/`last_event_id`; cross-domain concurrency and immediate-current-event semantics need regression coverage.
- **Remote TEST latency:** Use existing transaction timeouts and sequential guarded suites; latency alone is not a correctness failure.
- **No server run identity:** One-answer-per-question is a normal-client invariant. A malicious fresh run/event is a new meaningful assessment because V1 intentionally has no Session/ledger.

## 16. Open Questions / Blockers

None. The revised SPEC fixes actors, two types, ordered run, content selection, separator/tile policy, deterministic fallback, normalization, retry/revision boundary, transient results, Progress mapping and deferred domains.

## Approval Gate

```text
ORIGINAL SPEC / PLAN / TASK: HUMAN APPROVED
HUMAN-REQUESTED CONTRACT REVISION: HUMAN APPROVED
TASK-086A: COMPLETE — HUMAN APPROVED
TASK-086B: COMPLETE — HUMAN APPROVED
TASK-087: COMPLETE — HUMAN APPROVED
TASK-088: COMPLETE — HUMAN APPROVED
TASK-089: COMPLETE — HUMAN APPROVED
QUIZ V1 CLOSURE: DONE — HUMAN APPROVED
```
