# PLAN: Learning Session V1

**Source SPEC:** `docs/specs/LEARNING_SESSION_V1_SPEC.md` — HUMAN APPROVED after `SPEC REVIEW: APPROVE`

**PLAN status:** `AWAITING HUMAN REVIEW`

**Implementation authorized:** `NO — TASK approval required before implementation`

## 1. Summary

Implement Learning Session V1 as a bounded, versioned frontend session layer over the existing Learning/SRS, Quiz and Speaking capabilities:

- preserve one immutable ordered exact-Vocabulary-ID snapshot for each NORMAL Flashcard, Quiz and Speaking full run;
- split that snapshot into stable batches of at most 10 IDs without refilling batch boundaries after Set-item removal;
- limit each SRS eligibility snapshot to the first 10 distinct IDs after the existing Backend-authoritative eligibility/order calculation;
- keep USER + Set + mode state isolated in `sessionStorage`, with a memory-only fallback when browser storage is unavailable;
- preserve active cursors, completed-batch/full-run screens and explicit continuation/restart semantics;
- reuse existing Learning reads, SRS rating mutations, Quiz answer mutations and browser-recognition lifecycle; and
- extend the existing Quiz question read contract only where the current all-Set response cannot safely implement bounded stable batches.

No database model, migration, dependency, external service, persistent session/history, XP, mastery, gamification, reminder or AI behavior is planned.

## 2. Scope, Status and Acceptance Traceability

### 2.1 Existing Status

- Vocabulary Learning Session, Flashcard Learning, Learning Progress and SRS are `DONE`; this is an approved change request over those capabilities.
- Multiple Choice Quiz is implemented and `IN_PROGRESS` pending its existing formal TEST/REVIEW closure.
- Speaking Practice browser-recognition implementation exists while its amended contract remains separately awaiting closure; this PLAN changes only batching/resume position and preserves that recognition/privacy boundary.
- The untracked manual Speaking fixture is unrelated evidence and must remain untouched.

### 2.2 Acceptance Traceability

| Approved SPEC area | Planned implementation/evidence |
|---|---|
| AC-LS-001–008 | Per-USER/Set/mode versioned state, automatic restore/create, stable lifecycle states, no time-based reset and explicit continuation. |
| AC-LS-009 | NORMAL batch helper plus final-card **Hoàn thành phiên** transition; no Learning mutation. |
| AC-LS-010–011 | Frontend cap after Backend SRS eligibility/order, unchanged rating endpoint/requeue logic, fresh **Ôn tiếp** evaluation and distinct empty/up-to-date/completed states. |
| AC-LS-012–013, 025 | Authorized Learning `NORMAL` membership manifest, stable-order reconciliation, atomic bounded Quiz read, current-run resume, fresh retry `run_id`, fresh revisions/choices, preserved Backend Progress/idempotency and result lifecycle. |
| AC-LS-014–015 | Speaking positional state only, safe idle restoration and mandatory recognition/playback cancellation around target/session transitions. |
| AC-LS-016–017, 024 | Immutable ordered ID/batch snapshot and deterministic intersection reconciliation without additions, reorder, duplicate or refill. |
| AC-LS-018–019, 027 | Defensive state validation, memory fallback, namespace cleanup, explicit mode-only/full-run restart and no automatic mutation replay. |
| AC-LS-020–023, 026 | Exact approved copy, accessibility/responsive states, authorization reuse and scope/regression audit. |

## 3. Existing Implementation to Reuse

### 3.1 Learning / SRS

- `backend/src/services/srs-scheduler.js` — retain every eligibility, effective-state, stage, interval and rating calculation unchanged.
- `backend/src/services/learning-service.js` — retain Backend-authoritative SRS sorting, single `evaluated_at`, rating previews, membership validation, revision checks and idempotent mutation; reuse its unchanged authorized `NORMAL` response as the current Set membership manifest for Quiz reconciliation.
- `backend/src/repositories/learning-repository.js`, controller and routes — reuse without expected behavior changes.
- `frontend/src/learning/learning-run-state.js` — evolve the existing versioned SRS queue and NORMAL cursor helpers rather than introducing a parallel Flashcard state engine.
- `frontend/src/learning/learning-foundation-page.jsx` — retain mode selection, card/flip/audio presentation, rating submission and focus shell.
- `frontend/src/learning/learning-presentation.js` — retain primary Meaning, pronunciation, keyboard and pending-rating presentation.
- `frontend/src/services/learning-service.js` — keep current `mode=SRS|NORMAL` and authoritative rating response validation.
- `frontend/src/learning/learning-session-storage-observer.jsx` — extend/reuse Learning-owned cleanup behavior.

### 3.2 Quiz

- `backend/src/services/quiz-domain.js` — retain deterministic question/choice construction and versioned digest.
- `backend/src/services/quiz-service.js` — extend question-read selection only; retain answer reconstruction, grading, retry and Progress mutation unchanged.
- `backend/src/repositories/quiz-repository.js` — reuse accessible-Set projection, canonical distractors, locking and Progress transaction operations.
- `backend/src/controllers/quiz-controller.js` and `backend/src/routes/quiz-routes.js` — retain endpoint and middleware; controller remains extraction/envelope only.
- `frontend/src/quiz/quiz-run-state.js` — evolve existing `run_id`, question revision, accepted result and pending-attempt helpers into batch-aware state.
- `frontend/src/quiz/quiz-foundation-page.jsx`, presentation and navigation helpers — retain question/feedback/result UI and Focus Mode.
- `frontend/src/services/quiz-service.js` — extend the existing question-read query/response validator.
- `frontend/src/quiz/quiz-session-storage-observer.jsx` — retain Quiz-owned cleanup behavior.

### 3.3 Speaking

- `frontend/src/pronunciation/speaking-practice-page-session.js` — retain page orchestration and explicit `NORMAL` Learning read.
- `frontend/src/pronunciation/speaking-practice-state.js` — retain controller ownership tokens, recognition phases, exact target identity and cancellation/disposal semantics.
- `frontend/src/pronunciation/recognition-attempt-controller.js`, `speech-recognition-adapter.js` and `reference-playback-coordinator.js` — unchanged recognition, disclosure, stale-event and playback boundaries.
- `frontend/src/pronunciation/speaking-practice-page.jsx` and presentation helpers — adapt only batch/continuation/completion UI.

### 3.4 Existing Verification Assets

- Backend: `backend/test/learning/learning.test.js`, `srs-scheduler.test.js`, and Quiz read/answer/integration suites.
- Frontend unit: Learning run/service/presentation, Quiz run/service/presentation/navigation, and Speaking page/state/presentation/accessibility suites.
- Mocked browser: `learning-srs.spec.js`, `quiz-flow.spec.js`, `quiz-focus.spec.js`, `speaking-practice-flow.spec.js`, `speaking-practice-focus.spec.js` and Auth/App Layout coverage.
- Guarded integration: Learning, Learning Progress and Quiz real-stack suites using the existing dedicated TEST database safeguards.

## 4. Session Architecture and Storage Plan

### 4.1 Stable Identity

Every stored mode record is keyed by:

```text
schema version + authenticated USER ID + Set ID + stable mode
```

Stable modes are:

- `NORMAL_FLASHCARD`;
- `SRS_FLASHCARD`;
- `MULTIPLE_CHOICE_QUIZ`; and
- `SPEAKING_PRACTICE`.

Each mode receives a distinct storage key/record. One corrupt or restarted mode cannot replace another mode or another Set/USER. Key material is URI-encoded as in the current Learning/Quiz helpers. No card content, credentials, cookies, raw API response, transcript, audio, confidence or Speaking result is stored.

The Flashcard route may keep one separate non-authoritative USER+Set preference key containing only the last selected `SRS` or `NORMAL` tab. Its absence/invalidity defaults to SRS. It never combines or replaces the two independent mode-session records.

### 4.2 Resilient Storage Adapter

Add one small dependency-free frontend adapter, proposed at:

- `frontend/src/session-storage/resilient-session-store.js`

The adapter will:

- attempt JSON read/write/remove against the supplied `window.sessionStorage` key;
- validate data only through the owning mode helper, not inside the generic adapter;
- use a module-owned in-memory `Map` when browser storage access or writes throw/fail;
- keep the memory value synchronized after every successful mutation so later write failure does not erase page-lifetime state;
- report only a non-UI persistence capability flag when useful to unit tests;
- never fall back to `localStorage`, cookies or Backend persistence; and
- clear only registered ELVocab session prefixes from both native and memory storage.

No disruptive warning is shown by default. UI documentation/copy may state non-disruptively that reload can lose position when storage is unavailable. The adapter never submits or replays a command.

### 4.3 Logout and Session Invalidation

Retain the current thin observer pattern as the smallest diff:

- keep the existing Learning and Quiz top-level observers and add one equivalent Speaking observer mounted once in `app-router.jsx`;
- on observed logout/session invalidation, call the Learning, Quiz and Speaking namespace clear functions;
- clear native and memory fallbacks while preserving unrelated storage keys;
- do not move mode-specific key knowledge into Auth internals; and
- retain safe no-throw behavior if storage is inaccessible.

The observers remain thin mode-owned adapters; shared storage/fallback mechanics stay in the resilient store rather than being duplicated in observer components.

### 4.4 Versioning and Legacy State

- Increment existing Learning/Quiz state versions and introduce a versioned Speaking position record.
- Reject older shapes that cannot represent stable batches/completion safely.
- Do not attempt risky partial migration from old cursors/runs; create a fresh authorized snapshot instead.
- Previously accepted Quiz/SRS mutations remain durable Backend state and are never rolled back or automatically resubmitted.
- Add static regression checks proving namespace cleanup still recognizes obsolete owned prefixes where those keys could remain in the same tab after deployment.

## 5. Shared Ordered-Run and Batch Design

### 5.1 Ordered Full-Run Shape

NORMAL Flashcard, Quiz and Speaking each store the equivalent of:

```text
version
user_id
set_id
mode
snapshot_ids: ordered unique exact Vocabulary IDs
batches: ordered arrays of at most 10 exact IDs
active_batch_index
current_vocabulary_id
batch_status: ACTIVE | COMPLETED
run_status: ACTIVE | COMPLETED
```

Mode-specific state is nested separately. Exact field names belong to implementation/TASK, but these invariants do not.

Initial batching chunks the Backend-authored Set Item order into fixed arrays of 10. Explicitly storing batch membership avoids shifting/refilling later batches after deletion. Duplicate/invalid IDs make the stored record malformed and trigger a fresh authorized run.

### 5.2 Reconciliation Algorithm

On every load/re-entry:

1. Fetch fresh authorized mode data.
2. Build the set/map of currently accessible exact Vocabulary IDs and current card/question projections.
3. If stored identity/version is invalid, create a new run from current Backend order.
4. Otherwise preserve stored batch order and boundaries, filtering only IDs no longer current/accessible.
5. Never append newly added IDs and never reorder remaining IDs by current Set position.
6. Preserve completed-batch/full-run lifecycle even if membership changed.
7. For an unfinished batch whose current ID was removed, choose the next remaining ID after the removed stored position; if none remains, choose the nearest previous remaining ID or complete/skip the now-empty batch deterministically.
8. Skip empty reconciled future batches only when the USER explicitly continues; calculate `N` from the next non-empty stored batch.
9. If all remaining snapshot IDs are removed, show the truthful completed/empty reconciled state without adopting new items.

The pure helper must prove that valid remaining IDs are visited at most once and are not skipped because of Set reorder.

### 5.3 Explicit Continuation and Restart

- Completed batch state is persisted before rendering its completion/result screen.
- Continue actions move only to the next non-empty stored batch and reset presentation-only state.
- Full-run completion persists until **Học lại từ đầu**.
- **Học lại từ đầu** replaces only the selected mode's full snapshot/batches using fresh current order/content.
- No midnight/inactivity timer exists.
- Completion never calls Progress/XP/gamification APIs or claims mastery.

## 6. NORMAL Flashcard Plan

### 6.1 State and Integration

Refactor the `normal` branch in `frontend/src/learning/learning-run-state.js` to hold the ordered full-run/batch lifecycle instead of only `current_vocabulary_id`.

- The existing `GET /api/learning/sets/:setId?mode=NORMAL` remains sufficient because it already returns every current Set Item in authoritative position order with exact IDs.
- On a fresh run, create fixed batches from that response.
- On resume, map the stored current batch IDs to fresh cards and render them in stored order.
- Preserve Previous/Next within the current batch, card face, audio behavior and `Thẻ X / N`-style truthfulness where still applicable.
- NORMAL never calls `POST /api/learning/events`.

### 6.2 Final-Card Completion

- On the final valid card of the batch, render **Hoàn thành phiên** as the explicit completion command.
- Reaching, revealing or navigating to that card does not complete the batch.
- Activating the command persists `batch_status=COMPLETED`, cancels audio/TTS and focuses the completion heading.
- If another valid batch remains, render **Học tiếp N từ** with reconciled `N`; otherwise persist/render full completion with **Học lại từ đầu**.
- Restart creates a new latest-content NORMAL full run without changing durable Progress/SRS.

## 7. SRS Bounded Session Plan

### 7.1 API Sufficiency and Selection

No Learning/SRS API adjustment is planned.

`GET /api/learning/sets/:setId?mode=SRS` already:

- captures one Backend time;
- applies authoritative current eligibility;
- excludes future-scheduled items;
- orders existing eligible progress before NEW and then by Set position; and
- returns nearest-future-due metadata.

The frontend will take the first 10 distinct cards from that already-authoritative order when creating a fresh SRS session. This is a presentation/session bound, not client eligibility logic. The stored SRS snapshot contains only those IDs.

### 7.2 Queue and Rating Integrity

Extend the existing SRS branch without changing `applySrsRating` semantics:

- fixed `initial_ids` contains at most 10 unique IDs;
- queue occurrences may exceed 10 presentations through `AGAIN` but never add a second distinct ID;
- `AGAIN` removes stale duplicates and inserts exactly one occurrence after three intervening presentations when possible, otherwise at tail/next when alone;
- only authoritative successful `HARD`/`GOOD`/`EASY` adds the ID to `passed_ids`;
- pending ratings retain the same `event_id`, rating and expected revision for inconclusive retry;
- no optimistic pass, requeue, count or schedule occurs before Backend success; and
- conflict/membership errors refresh authoritative data and reconcile exact IDs under the current SRS snapshot rules.

Existing `POST /api/learning/events`, scheduler, revision checks, Backend clock and immediate-current-event idempotency remain unchanged.

### 7.3 Completion, Future Due and Continuation

- Complete when all initial distinct IDs pass and the pending queue is empty.
- Persist **Hoàn thành ôn tập** completion status on same-tab re-entry.
- **Ôn tiếp** performs a fresh SRS GET and creates a new at-most-10 snapshot only after explicit action.
- A fresh response with no eligible cards renders the distinct up-to-date **Hoàn thành ôn tập** status, existing NORMAL switch/return actions and nearest future due when available.
- Items that become due while the active snapshot is open are never injected; future reviews remain available on later explicit fresh evaluation.

## 8. Quiz Batch and API Plan

### 8.1 Why an API Adjustment Is Required

The current `GET /api/quiz/sets/:setId/questions` always builds every Set Item and fails the entire load if any question cannot obtain four choices. Frontend-only slicing would:

- still construct and expose more than the active 10-question batch;
- allow an unavailable unstarted question to block the active batch;
- provide no bounded fresh-read contract for **Làm lại nhóm này**; and
- make stable original batch reconciliation depend on an all-current-order response.

Therefore, extend the existing endpoint rather than adding a duplicate Quiz endpoint or persistent server session. Use the existing authorized Learning `NORMAL` read as the membership manifest; do not make the Quiz question response double as a reconciliation manifest.

### 8.2 Authorized Membership Manifest and Frontend Reconciliation

Reuse the unchanged existing endpoint:

```text
GET /api/learning/sets/:setId?mode=NORMAL
```

Its existing USER guard and public-System/owned-private Set predicate authorize the Set, and its `cards` provide every current exact Vocabulary ID in Backend-authored Set Item `position` order. This is the concrete membership manifest; no new endpoint, schema or response field is required.

Before every bounded Quiz question read, including initial entry, same-tab restoration, next-batch continuation and retry-current-batch, the frontend must:

1. fetch this fresh authorized manifest;
2. for a new full run, capture its ordered IDs once as the immutable `snapshot_ids` and fixed at-most-10 batches;
3. for an existing run, intersect the original stored `snapshot_ids` and each fixed batch with the manifest's current-ID set while retaining original snapshot-relative order and batch boundaries;
4. exclude manifest IDs absent from the original snapshot, so newly added Set items never enter the current run;
5. remove deleted/inaccessible IDs without refill, repartition, substitution or adoption of the manifest's latest order; and
6. persist the reconciled client state before requesting the remaining non-empty active batch.

If reconciliation empties an active batch, the frontend advances only through the existing safe reconciliation transition to the next non-empty original batch or the truthful completed/empty state; it does not silently replace removed items. The Learning manifest is only a fresh authorization/membership input. It does not establish Quiz eligibility, construct questions or grade answers.

### 8.3 Bounded Question Read Contract

Retain:

```text
GET /api/quiz/sets/:setId/questions
```

with required `type=MULTIPLE_CHOICE` and `run_id=<uuid>`, and add one optional exact query field for bounded reads:

```text
vocabulary_ids=<uuid>,<uuid>,...   // one comma-separated scalar containing 1–10 unique IDs
```

Planned behavior:

- Learning Session V1 always supplies `vocabulary_ids` after the manifest reconciliation in §8.2. Omission retains the pre-feature all-Set read behavior only for compatibility with existing non-session callers; it is not used to create or restore a Learning Session V1 run.
- When present, parse exactly one non-empty comma-separated scalar containing one to ten unique UUIDs. Reject empty segments, repeated query keys, duplicates, malformed UUIDs, unknown fields and more than 10 IDs with `400 QUIZ_VALIDATION_ERROR`.
- Authorize the Set first using the existing concealed boundary. Missing or inaccessible Sets return `404 QUIZ_SET_NOT_FOUND` without evaluating or disclosing submitted-ID ownership.
- Independently require every requested ID to be a current item of that authorized Set. If any requested ID is absent—including a removed, foreign-private, or different-Set ID—reject the entire request with the existing generic `409 QUIZ_ITEM_CHANGED`. Do not identify the failing ID and do not return a partial question list.
- Independently construct and validate every requested question using current authoritative data before returning success. If any requested item lacks the data required to be a valid Quiz question, reject the entire request with `409 QUIZ_ITEM_CHANGED`; if four distinct safe choices cannot be generated, reject the entire request with the existing `409 QUIZ_CHOICES_UNAVAILABLE`. Neither error identifies a particular requested ID or reveals another Set/owner.
- On success, build questions for all and only the requested IDs in submitted original-snapshot order. The Backend never silently drops, substitutes, reorders or partially accepts requested IDs.
- Continue using all current authorized Set Vocabulary as the Set-first distractor candidate pool, so batching does not weaken distractor quality or turn outside candidates into questions.
- Keep exactly four choices, opaque IDs, one correct answer, deterministic question construction by `run_id`, and atomic failure for any question that remains in the requested active batch but cannot be built.
- The existing answer endpoint and its transaction, membership reauthorization, revision, choice, event-idempotency and Learning Progress rules remain unchanged.

The bounded success response retains the existing payload shape:

```text
id, name, quiz_type, run_id
questions: fresh questions for every requested ID in submitted order
```

There is no `removed_vocabulary_ids`, membership echo or successful reconciliation metadata. The frontend obtains current membership only from the authorized Learning manifest and treats every bounded-read conflict as an inconclusive refresh/reconcile/retry condition, never as proof that a particular foreign or private Vocabulary exists.

### 8.4 Backend Changes

- `quiz-service.js`: extend exact query validation; authorize the Set; atomically require membership and Quiz eligibility for every requested ID; build all and only the valid requested questions in submitted order; return no partial success or membership metadata.
- `quiz-repository.js`: existing accessible-Set projection is sufficient; no query/schema change is required initially. Optimize projection only if evidence shows a real issue.
- `quiz-domain.js`: no correctness/digest changes. It continues to build each selected question using the fresh run, exact item and full authorized distractor pools.
- Answer endpoint/service/repository: no contract or mutation change. It continues to reconstruct from current authoritative Set content inside the transaction and validate `run_id`, revision and choice ID.
- Controller/route/middleware: unchanged except normal passage of the extended query already occurs.

### 8.5 Frontend Quiz State

Evolve `quiz-run-state.js` to hold:

- immutable full `snapshot_ids` and fixed `batches`;
- active batch index and lifecycle;
- one current batch `run_id`;
- current batch question metadata/revisions;
- accepted results and inconclusive `pending_attempt` for only that current run;
- current completed result `{ total, correct, incorrect }`; and
- full-run completion marker.

Resume the same current `run_id` and accepted/pending state while the current batch is active. A normal reload first fetches the fresh authorized Learning manifest, reconciles the original snapshot without additions/refill/reorder, then requests the remaining current-batch IDs with the same `run_id`; unchanged content reconstructs identical choices/revisions. A `409 QUIZ_ITEM_CHANGED` or `409 QUIZ_CHOICES_UNAVAILABLE` from the bounded read triggers one fresh manifest reconciliation and a deliberate read retry only when a non-empty valid batch remains; it never submits an answer or infers which ID failed.

### 8.6 Continue and Retry

- **Học tiếp N từ** creates a fresh `run_id` for the next stored batch, requests fresh authoritative questions and advances only after the current result is complete.
- **Làm lại nhóm này** keeps the same valid current-batch IDs but clears its transient selections/result/pending state, generates a new `run_id`, and requests fresh questions/revisions/choice IDs.
- Never carry a selected choice, `event_id`, pending submission, `question_revision`, accepted result or choice ID across that new run.
- Accepted Backend Progress remains unchanged and is reflected in fresh question progress projections.
- A lost/inconclusive answer response within one run retains/reuses the identical existing pending attempt; retry-current-batch is a separate explicit action available only from completed result state.
- Storage fallback never auto-submits a pending/accepted answer. After reload without storage, a new session may begin, but no command is replayed automatically.

## 9. Speaking Batch and Lifecycle Plan

### 9.1 Position State

Add a focused `speaking-practice-run-state.js` (or equivalently scoped helpers beside the page-session module) containing only:

- USER/Set/mode/version identity;
- immutable ordered `snapshot_ids` and batches;
- active batch index/current exact ID;
- batch/full-run completion lifecycle.

Do not store disclosure acknowledgement, recognition phase, transcript, alternatives, confidence, result, issue details, raw audio, attempt token or playback state.

The existing `NORMAL` Learning response is sufficient for initial ordering and current membership reconciliation; no Speaking/Backend/API change is planned.

### 9.2 Page Session Integration

- Pass only the reconciled current-batch target projection to the existing Speaking controller, preserving its `NORMAL` payload validation shape.
- Restore the stored exact ID by selecting/replacing the controller target after load, before enabling user interaction.
- Restoration always lands in `READY`, `UNSUPPORTED` or `INSECURE_CONTEXT` as capability dictates; it never restores active recognition or prior feedback.
- Previous/Next/skip update the stored cursor only after the controller successfully cancels/invalidates the prior target and installs the next one.
- At batch end, cancel recognition/playback, persist completion and render the completion screen.
- **Luyện tiếp N từ** creates the next batch controller context only after explicit action; **Học lại từ đầu** fetches latest order and replaces the full run.
- Route exit, logout, page hidden, unmount, batch completion, continuation and restart all use existing cancel/dispose paths so late recognition/playback events cannot update a new target.

### 9.3 Privacy Boundary

No new provider call, upload, logging or persistence path is introduced. The browser-vendor processing disclosure, `en-US`, four recognition outcomes, conservative matching, Chrome desktop evidence boundary and no-Progress/no-XP rules remain unchanged.

## 10. Frontend UI, Responsive and Accessibility Plan

### 10.1 Exact New Labels

- NORMAL final card: **Hoàn thành phiên**.
- Flashcard/Quiz next batch: **Học tiếp N từ**.
- Quiz retry: **Làm lại nhóm này**.
- Speaking next batch: **Luyện tiếp N từ**.
- Full-run restart: **Học lại từ đầu**.
- SRS explicit fresh evaluation: **Ôn tiếp**.
- SRS completed/up-to-date status: **Hoàn thành ôn tập**, never a forced restart action.

`N` comes from the next non-empty reconciled stored batch, not from original count or current Set size. Preserve all other approved existing labels.

### 10.2 Focus and Semantics

- Persist completion before focus moves to its heading.
- Restore/reconcile focus to the current target heading without auto-reveal, playback, recognition or submission.
- Native buttons retain visible focus, pending/disabled semantics and minimum project touch targets.
- Completion status uses heading/status semantics; recoverable operational failures use existing alert patterns.
- Quiz result continues to identify correct/selected choices without color-only meaning.
- SRS requeue announcement, rating DOM order and focus behavior remain unchanged.
- Speaking disclosure remains perceivable before first microphone use; storage messages never compete with recognition live regions.
- No action depends on swipe/pointer gestures, and no automatic focus jump occurs merely because storage persistence failed.

### 10.3 Responsive Layout

- Reuse existing Focus Mode shells and page-local responsive classes.
- Completion action rows may wrap/stack on narrow containers without horizontal overflow.
- Dynamic `N` labels and long Set/word/choice content must wrap safely at mobile, tablet, desktop, landscape and 200% zoom.
- Preserve Quiz single scroll owner, Speaking cleanup during visibility changes, reduced motion and existing card flip behavior.

UI-changing implementation must run the repository `ui-ux-review` skill in Focused mode before HUMAN visual approval. Full UI/UX review is not planned unless HUMAN requests it.

## 11. Backend, API and Database Impact

### 11.1 Database

- No Prisma schema or migration change.
- No Learning Session, Quiz Session, attempt, history, result, Speaking or XP entity.
- Existing Learning Progress identity/constraints and SRS fields are unchanged.
- No database operation is needed merely to implement or verify transient session storage.

### 11.2 Backend

- Learning/SRS backend: no planned source behavior change.
- Quiz backend: bounded read/query validation plus atomic current-membership and question-eligibility enforcement; no new response metadata.
- Quiz answer mutation, scheduler, recognition architecture, authorization and ownership remain unchanged.

### 11.3 API

- `GET /api/learning/sets/:setId?mode=NORMAL|SRS`: unchanged; Quiz reuses the authorized `NORMAL` cards as its current Set membership manifest.
- `POST /api/learning/events`: unchanged.
- `POST /api/quiz/answers`: unchanged.
- `GET /api/quiz/sets/:setId/questions`: extend with the bounded ordered `vocabulary_ids` query; return questions only when every requested ID passes validation, current membership and question eligibility.
- No new endpoint is planned.

This bounded Quiz read adjustment is required by the actual all-Set construction contract. It must be synchronized in `docs/API_SPEC.md` before implementation under the approved TASK sequence.

## 12. Validation and Security Plan

- All stored records require exact version, USER, Set and mode identity plus unique string UUID arrays and valid lifecycle/cursor relationships.
- Stored IDs never establish authorization or current Set membership.
- Fresh Backend access checks precede every restoration; Quiz fetches the unchanged authorized Learning `NORMAL` manifest before each bounded read, and answer/rating mutations continue to revalidate current membership transactionally.
- Quiz bounded query accepts exactly one non-empty scalar containing 1–10 unique valid UUIDs; malformed, empty, repeated-key, duplicate and over-limit input returns `400 QUIZ_VALIDATION_ERROR` before question construction.
- The bounded Quiz service authorizes the Set and independently verifies every requested ID against current Set membership and current question eligibility. The request is atomic: one failing ID means no questions are returned.
- Missing/inaccessible Set returns concealed `404 QUIZ_SET_NOT_FOUND`. Any well-formed foreign-private, other-Set, removed or otherwise non-member requested ID returns generic `409 QUIZ_ITEM_CHANGED`; an ineligible current member returns generic `409 QUIZ_ITEM_CHANGED` or, specifically when four safe choices cannot be constructed, existing `409 QUIZ_CHOICES_UNAVAILABLE`. Errors never identify the failing ID, owner or other Set.
- No successful membership echo or `removed_vocabulary_ids` field exists. The frontend reconciles only from the separately authorized manifest and never treats client-stored IDs as authorization.
- Session state contains no authentication material, Backend secrets, correct-choice markers before acceptance, Speaking content/results or authoritative SRS calculations.
- No automatic API mutation is triggered by storage restoration, parse failure, fallback activation, continuation-screen rendering or completion-screen rendering.

## 13. Verification Strategy

No verification runs occur during PLAN. After approved implementation, use the TEST workflow and guarded environments.

### 13.1 Pure Frontend Unit Tests

Extend/add deterministic tests for:

- identity/key isolation across USER, Set and all four modes;
- storage success, malformed JSON, unsupported version, SecurityError/quota/read/write/remove failure and in-memory fallback;
- native plus memory namespace cleanup without touching unrelated keys;
- batching sizes `0,1,9,10,11,20,21`, stable boundaries and actual next-batch `N`;
- add/remove/reorder reconciliation, removed current ID, empty intermediate batch, duplicate/malformed IDs and full completion preservation;
- NORMAL final-card non-completion versus **Hoàn thành phiên**;
- SRS first-10 selection after Backend order, fixed denominator and unchanged `AGAIN` spacing/retry context;
- Quiz active resume, same-run deterministic reload, next batch, new-run retry, stale-state rejection, accepted/pending isolation and result preservation;
- Quiz manifest intersection preserves original snapshot order/boundaries, excludes additions, removes missing IDs without refill and never issues a bounded read before fresh authorized membership reconciliation;
- Speaking positional restore with zero recognition result persistence.

### 13.2 Backend Unit/Integration Tests

Extend Quiz read tests for:

- unchanged Learning `NORMAL` manifest authorization and exact Set Item ordering used by Quiz reconciliation;
- explicit ordered 1–10 subset success with all and only requested current eligible IDs returned in requested original-snapshot order;
- malformed UUID, empty scalar/segment, duplicate ID, repeated/ambiguous query key, unknown field and over-limit list rejection with `400 QUIZ_VALIDATION_ERROR`;
- atomic generic `409 QUIZ_ITEM_CHANGED` rejection, with no questions or identifier-specific details, for a foreign-private Vocabulary ID, a Vocabulary ID from another accessible Set, a removed ID, and every mixed valid/invalid variant;
- atomic question-eligibility rejection for a current member lacking required question data and mixed eligible/ineligible input; use generic `409 QUIZ_ITEM_CHANGED`, or existing `409 QUIZ_CHOICES_UNAVAILABLE` when the failure is specifically inability to construct four safe choices;
- no `removed_vocabulary_ids` or other successful membership/reconciliation metadata;
- question/distractor construction remains exactly four/one-correct and Backend deterministic;
- any unavailable question fails its entire requested active batch without affecting another batch or causing a write;
- Guest, ADMIN and foreign-private Set boundaries;
- answer reconstruction accepts only fresh run/revision/choice and writes Progress exactly once;
- retry current batch does not undo accepted Progress and stale old-run choice/revision cannot write.

Re-run existing Learning/SRS scheduler and guarded Learning integration tests unchanged to prove no scheduler/rating regression.

### 13.3 Mocked Playwright

Cover each mode across existing supported widths:

- direct automatic start and same-tab reload resume;
- 10/11/21-item batch boundaries and explicit continuation;
- completion-screen preservation and **Học lại từ đầu** latest-content reset;
- Set add/remove/reorder reconciliation without repeat/skip;
- NORMAL final-card button and no Progress requests;
- SRS `AGAIN` reappearance, no dynamic newly-due injection, **Ôn tiếp**, up-to-date/empty distinctions and future-due display;
- Quiz completed results, **Học tiếp N từ**, fresh **Làm lại nhóm này**, lost-response retry and conflict recovery;
- Speaking resume idle state, disclosure/permission flow, skip/continue and recognition cleanup on reload/navigation;
- storage denial fallback without disruptive warning or automatic mutation replay;
- keyboard, focus, live-region, disabled/pending, reduced-motion, touch target, wrapping and no-overflow behavior.

### 13.4 Guarded Real-Stack Integration

Use only the existing dedicated TEST database helpers/configuration:

- Quiz manifest reconciliation, atomic bounded question reads and fresh-run answer/revision/idempotency paths;
- Learning/SRS authorization, future due, `AGAIN`, revision and no-duplicate mutation regressions;
- USER isolation and public/owned/foreign-private Set access;
- Set Item removal between read and mutation;
- repeated reads/restores produce no writes;
- accepted Progress survives client retry/restart/storage loss.

Speaking recognition remains mocked in automation; no live microphone/vendor call is required. Preserve the manual fixture for separately controlled evidence.

### 13.5 Static and Build Gates

After implementation, run scoped/full ESLint as required, production build, `git diff --check`, secret scan, changed-file/scope audit, listener/process cleanup and relevant existing test suites. Report any command not run as `NOT RUN`.

## 14. Legacy / Regression Impact Scan

Because Learning Session V1 replaces active run/completion contracts, TEST and REVIEW must explicitly scan:

- old Learning state version/key assumptions and tests expecting one NORMAL cursor only;
- Flashcard tests/copy expecting immediate restart on re-entry or old NORMAL restart labels;
- SRS tests assuming all eligible cards enter one session rather than first 10;
- Quiz service/mocks/fixtures assuming every Set Item is returned in one questions response;
- Quiz selectors/copy expecting one full-Set result or one run for the entire Set;
- Speaking tests assuming `targetIndex=0` after every load or completing the entire Set in one controller payload;
- Auth observers and app-router mounts for duplicate/missing namespace cleanup;
- Set Detail/Discovery/My Sets entry and return navigation;
- Learning Progress/SRS invariants when Quiz questions are retried in a new run;
- `docs/API_SPEC.md`, `UI_UX_SPEC.md`, `ARCHITECTURE.md`, `FEATURE_STATUS.md`, active fixtures and mocked API helpers;
- intentional historical SPEC/PLAN evidence, which remains preserved and is not rewritten as current implementation evidence.

Do not delete an existing test merely because its former run-size expectation changes. Replace obsolete assertions with approved bounded behavior while retaining authorization, identity, correctness, retry, privacy and accessibility coverage.

## 15. Documentation Impact

After PLAN/TASK approval and in the authorized implementation sequence:

- `docs/API_SPEC.md` — document the unchanged Learning `NORMAL` manifest reuse plus bounded Quiz query, atomic validation/error response and preserve the unchanged answer/Learning contracts.
- `docs/UI_UX_SPEC.md` — document session states, exact labels, batch/full-run completion, storage fallback and responsive/accessibility behavior.
- `docs/ARCHITECTURE.md` — document client-owned per-mode transient session snapshots, memory fallback and absence of server persistence.
- `docs/FEATURE_STATUS.md` — record Learning Session V1 as the approved change workstream without prematurely downgrading completed foundations or marking the change DONE.
- `docs/PROJECT_OVERVIEW.md` and `docs/DATABASE.md` require no change unless implementation review finds stale high-level wording; no scope/schema change is planned.
- Preserve prior approved SPEC/PLAN/TASK documents as historical contracts; add explicit active-contract reconciliation rather than silently editing their approval history.

## 16. Implementation Phases and Order

1. **Approval gate:** HUMAN approves this PLAN; create/approve TASK before any implementation.
2. **Contract synchronization:** update active API/UI/architecture/status documentation for the approved bounded-session contract.
3. **Shared persistence foundation:** implement resilient storage adapter, versioned per-mode identities and safe logout/invalidation cleanup with pure tests.
4. **Shared ordered-run helpers:** implement stable batching/reconciliation/lifecycle primitives used through thin mode adapters; avoid coupling mode-specific mutation logic.
5. **NORMAL Flashcard:** integrate fixed batches, cursor restoration, explicit final-card completion, continuation/full restart and focused unit/UI coverage.
6. **SRS:** cap fresh authoritative snapshot to 10, preserve queue/retry logic, add explicit continuation/completion/up-to-date behavior and regress scheduler/event paths.
7. **Quiz Backend/API:** add atomic bounded read selection, validation, current-membership/question-eligibility enforcement and backend tests without touching answer correctness/mutation.
8. **Quiz frontend:** reuse the Learning `NORMAL` membership manifest before bounded reads; add stable batches, original-order reconciliation, same-run resume, fresh-run retry, result preservation and current/next/restart flows.
9. **Speaking:** add positional batch state, safe target reconciliation and lifecycle cleanup without persisting recognition data.
10. **Focused UI/UX review:** run `ui-ux-review` in Focused mode, resolve objective findings, then request HUMAN visual approval.
11. **Verification:** execute unit, mocked browser, guarded integration, lint/build/static and legacy/regression scans through the TEST skill.
12. **Formal REVIEW and closure:** review scope/security/contracts/evidence, resolve findings, request HUMAN closure, and update feature status only when the full workflow permits.

This order isolates storage/session mechanics before mode UI changes, proves the only Backend/API change independently, and preserves existing business-critical mutations throughout incremental implementation.

## 17. Dependencies, Risks and Rollback

### 17.1 Dependencies

- Existing Authentication context and USER guards.
- Existing authorized Learning `NORMAL`/`SRS` payloads and Learning-owned SRS mutation.
- Existing Quiz domain/repository/answer transaction.
- Existing Speaking controller/recognition/playback lifecycle.
- Existing Focus Mode shells, HTTP client and guarded TEST infrastructure.

No new package, schema, provider or infrastructure dependency is required.

### 17.2 Risks and Mitigations

- **State-version rollout:** old shapes cannot represent batches. Fail closed to a fresh read; retain old-prefix cleanup and never replay mutations.
- **Set reconciliation:** index-based logic can repeat/skip after deletion. Store exact batch ID arrays and test invariant/property-style matrices.
- **Quiz client-selected subset:** could be mistaken for authorization. Use the Learning `NORMAL` response only as a frontend reconciliation manifest, then independently authorize the Set and atomically validate every requested ID's current membership/question eligibility in Quiz; return no partial success or identifier-specific membership information.
- **Quiz stale run data:** new retry must not reuse choices/events. Create a new UUID and clear all run-bound fields before requesting fresh data.
- **SRS cap placement:** capping before Backend ordering would alter eligibility priority. Slice only the finalized authoritative response.
- **Storage failure:** fallback may be lost on reload. Do not auto-submit on restore; Backend idempotency/revisions remain the mutation safety boundary.
- **Speaking stale events:** batch transitions can outlive recognition events. Use existing cancel/dispose/generation ownership before changing target/session state.
- **Large current Sets:** full ID snapshots and existing NORMAL content remain bounded by current product behavior; no pagination/cache is introduced without separate evidence/approval.
- **Concurrent tabs:** no synchronization guarantee; Backend revisions/conflicts remain authoritative.

### 17.3 Rollback Strategy

- Keep schema and persisted data untouched, so rollback is frontend/API-code and documentation only.
- Version new storage keys/shapes; rollback code ignores/removes unknown owned state instead of interpreting it.
- The Quiz read extension remains on the existing endpoint. Omission retains the pre-feature all-Set read contract for compatibility, while Learning Session V1 always sends the bounded query after an unchanged Learning `NORMAL` manifest read. The bounded backend, frontend caller, mocks and API documentation should still be deployed/reverted together; rollback removes the bounded caller/validation without changing either existing read contract or accepted Progress.
- Do not roll back accepted Learning Progress/SRS/Quiz mutations; rollback affects only transient presentation/session behavior.
- Retain previous tests as regression history while reverting only the scoped change files if HUMAN authorizes rollback.

## 18. Technical Decisions and Open Questions

### 18.1 Resolved Technical Decisions

- Reuse existing Learning/SRS and Speaking APIs; no Backend changes for those modes.
- Reuse unchanged `GET /api/learning/sets/:setId?mode=NORMAL` as the sole authorized current-membership manifest for Quiz; do not add a manifest endpoint or Quiz reconciliation response.
- Extend the existing Quiz questions endpoint rather than create a new endpoint or persistent session.
- Use one comma-separated ordered 1–10 exact-ID scalar for bounded Quiz reads; validate every ID atomically and return the existing question response shape with no membership/reconciliation metadata.
- Use stable stored batch arrays so deletion does not refill/repartition the run.
- Use a small shared resilient storage adapter with per-mode validation/helpers.
- Invalidate incompatible old state rather than attempting unsafe migration.
- Retain three thin mode-owned logout observers, including a new Speaking observer, over the shared resilient adapter.
- Add one separate Flashcard last-mode preference key while keeping NORMAL and SRS session records independent.

### 18.2 Non-Blocking TASK-Level Choices

- Exact names of internal state fields and pure helper functions.
- Exact exported helper names and whether closely related pure batching functions live in the shared adapter folder or their owning mode module.
- Exact non-disruptive copy/placement explaining possible reload-position loss when storage is unavailable.

These choices do not change approved behavior, API semantics, security or scope and can be fixed in TASK. No unresolved technical decision blocks TASK decomposition.

## 19. Approval Gate

```text
SPEC STATUS: HUMAN APPROVED / REVIEW APPROVE
PLAN STATUS: AWAITING HUMAN REVIEW
TASK AUTHORIZED: NO
IMPLEMENTATION AUTHORIZED: NO
```

After HUMAN PLAN approval, the next allowed stage is TASK. Do not implement, modify tests, change APIs/schema/dependencies, or run verification before the separately approved TASK sequence authorizes those actions.
