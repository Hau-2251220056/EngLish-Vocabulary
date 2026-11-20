# PLAN: Speaking Practice V1 — Browser Spoken-Word Recognition

**Approved SPEC:** `docs/specs/PRONUNCIATION_SPEAKING_PRACTICE_V1_SPEC.md`

**PLAN status:** `AMENDED — AWAITING HUMAN REVIEW`

**Implementation authorized:** `NO`

## 1. Summary

Implement Speaking Practice as a separate USER focus activity using the existing authorized Learning API and the browser Web Speech API. The active path is:

```text
GET /api/learning/sets/:setId?mode=NORMAL
→ exact ordered Set/Vocabulary target
→ stored reference audio or browser TTS
→ explicit SpeechRecognition start (`en-US`)
→ conservative pure transcript classifier
→ transient frontend outcome
→ recognition-specific feedback and retry/navigation
```

The route remains `/pronunciation/vocabulary-sets/:setId`. No pronunciation-specific Backend endpoint, database change, audio upload, Azure integration, FFmpeg runtime, scoring DTO, or Progress/gamification mutation is required.

Historical FFmpeg Gate A1 evidence remains intact but is superseded for the active architecture. The current TASK remains Azure-oriented and must be amended after this PLAN is approved.

## 2. Decision Record

### 2.1 Existing Learning API reuse

Reuse `GET /api/learning/sets/:setId?mode=NORMAL` through `learningService.getLearningSet(setId, { mode: "NORMAL" })`.

Rationale:

- Backend authentication, USER role, Set visibility/ownership, empty-Set handling, exact Vocabulary identity, and Set Item order already exist.
- NORMAL mode returns every ordered card rather than the SRS-eligible subset.
- Speaking Practice needs no new authoritative input or write operation.
- A new read or speech endpoint would duplicate authorization and expand the API without product value.

The page must not call `recordMeaningfulEvent`.

### 2.2 Route

Add the USER route `/pronunciation/vocabulary-sets/:setId` under the existing protected/authenticated shell and include it in focus-route handling where required. This route is compatible with existing route conventions and the approved SPEC; no incompatibility requiring HUMAN review was found.

### 2.3 Web Speech configuration

Resolve the constructor in this order:

1. `window.SpeechRecognition`;
2. `window.webkitSpeechRecognition`;
3. unsupported.

Configure each attempt with:

- `lang = "en-US"` — fixed approved locale;
- `continuous = false` — one isolated word and one terminal utterance per attempt;
- `interimResults = false` — interim text is unnecessary and would create noisy/stale UI updates;
- `maxAlternatives = 5` — bounded alternatives allow the approved uncertain `ALTERNATIVE_MATCH` outcome without collecting an unbounded result set.

The exact alternative bound may change only if implementation evidence shows a browser constraint; such a change must preserve bounded handling and does not authorize fuzzy matching. Constructor presence indicates capability only, not a guarantee that the microphone/vendor service works.

### 2.4 Result presentation

The learner-facing UI shows the primary recognized transcript when safe and useful. A later alternative exact match produces the approved uncertain message but need not expose the full alternatives list. Confidence remains internal diagnostic metadata and is not displayed as a learner score.

### 2.5 Reference playback during recognition

Starting Speak first cancels current HTML audio and browser speech synthesis, waits for synchronous cancellation/state ownership to be established, then starts recognition. The Listen control is disabled while recognition is starting, listening, or finalizing. This avoids deliberately feeding ELVocab reference audio into the learner attempt without creating a cancel-and-play ambiguity.

Stopping ELVocab playback cannot isolate the microphone from another application, nearby speaker, echo, or environmental audio. The product must not promise perfect speaker/microphone isolation.

## 3. Affected Areas

- **Database:** no migration, model, write, or history.
- **Backend:** no new code; existing Learning authorization/read behavior is a regression boundary.
- **API:** reuse NORMAL Learning read; no pronunciation evaluation endpoint.
- **Frontend:** route, Set Detail activity entry, recognition adapter, pure classifier, state/lifecycle controller, focus page/components, scoped styles.
- **Tests:** classifier, adapter, lifecycle, UI/accessibility, mocked browser, responsive, Learning/Flashcard/Quiz/Set Detail regressions, controlled real-browser evidence.
- **Dependencies:** no new dependency. Native browser API only.
- **Documentation:** reconcile canonical architecture/API/UI/status documents after verified implementation.

## 4. Existing Code and Evidence to Reuse

- `frontend/src/services/learning-service.js` — authenticated NORMAL Set load and response validation.
- `backend/src/routes/learning-routes.js`, `backend/src/controllers/learning-controller.js`, `backend/src/services/learning-service.js`, and `backend/src/repositories/learning-repository.js` — authoritative read and access boundary; no modification planned.
- `frontend/src/app-router.jsx` — add the approved USER route and focus-mode recognition.
- `frontend/src/vocabulary-sets/set-detail-primitives.jsx` — add a third real learning card and responsive three-card layout.
- `frontend/src/learning/learning-foundation-page.jsx` — reuse the established stored-audio/TTS preference and cleanup concepts; do not couple the pages.
- `frontend/test/learning-service.test.js`, `frontend/test/learning-*`, and `backend/test/learning/learning.test.js` — NORMAL mode, identity, ordering, safe access, and read-only regression evidence.
- Existing Quiz and Set Detail tests — regression boundaries.
- `frontend/spikes/web-speech-feasibility/speech-feasibility.js` — feasibility logic to promote into maintained feature modules rather than importing production behavior from `spikes/`.
- `frontend/test/web-speech-feasibility.test.js` — seven deterministic feasibility tests to preserve and migrate into maintained coverage.
- `backend/test/pronunciation/` and TASK Gate A1 text — historical FFmpeg evidence only, not active production architecture.

## 5. Database, Backend, and API Plan

### 5.1 Database

- No schema or migration.
- No audio, transcript, alternatives, confidence, attempt, or result record.
- No Learning Progress, SRS, XP, Streak, reward, or Achievement mutation.

### 5.2 Backend

- Do not add pronunciation routes, middleware, controllers, services, repositories, provider adapters, audio parsers, or transcoders.
- Preserve existing Learning authentication and authorization.
- Focused regression evidence must confirm public System Set, owned private Set, foreign private Set, empty Set, exact membership/order, and same-spelling distinct identities.
- Confirm the activity invokes no learning-event write API.

### 5.3 API contract

Request:

```text
GET /api/learning/sets/:setId?mode=NORMAL
```

- Existing authenticated USER contract and errors remain unchanged.
- The current validated response supplies Set ID/name and ordered `cards`, including exact `id`, `word`, `position`, meanings/progress, and any existing pronunciation fields already exposed by the API.
- No recognition result is posted to ELVocab.
- The conceptual `POST /api/pronunciation/evaluate` is retired from the V1 plan and later documentation reconciliation.

## 6. Frontend Module Plan

Create a small scoped feature area under `frontend/src/pronunciation/` (final filenames may follow existing naming conventions):

- `speech-recognition-adapter.js` — native API boundary and stable event/error normalization.
- `recognition-classifier.js` — pure normalization and four-outcome classification.
- `speaking-practice-state.js` — reducer/state transitions and ownership guards.
- `speaking-practice-page.jsx` — Learning load, playback/recognition coordination, navigation, and focus lifecycle.
- Small presentation components/styles only where separation improves testability; avoid unnecessary component fragmentation.

The page uses `learningService` directly for NORMAL reads. No new API service is required.

## 7. SpeechRecognition Adapter

### 7.1 Responsibilities

The injectable adapter must:

- detect standard/prefixed constructors and secure-context prerequisites;
- construct exactly one native recognizer per attempt;
- apply fixed configuration;
- expose controlled `start`, `stop`, `abort`, and `dispose` operations;
- convert final browser results into a bounded ordered alternatives array;
- normalize browser errors into stable feature issue codes;
- forward result/error/end events with attempt ownership metadata;
- guard duplicate native method calls and synchronous native exceptions;
- detach handlers and clear bounded timers during disposal.

It does not call a vendor endpoint, create a Blob, use `getUserMedia` directly, upload audio, or claim service availability from constructor presence.

### 7.2 Stable issue concepts

Normalize browser/runtime conditions into stable concepts such as:

- `UNSUPPORTED`
- `INSECURE_CONTEXT`
- `PERMISSION_DENIED`
- `SERVICE_NOT_ALLOWED`
- `NO_SPEECH`
- `AUDIO_CAPTURE_FAILED`
- `NETWORK_ERROR`
- `ABORTED`
- `NO_RESULT`
- `START_FAILED`
- `FINALIZATION_TIMEOUT`
- `RECOGNITION_ERROR`

Exact browser error strings remain adapter details and must not leak into learner copy or production logs.

### 7.3 Deterministic injection

Constructor resolution, clock/timers, and event delivery must be injectable. Unit and browser tests use fake constructors/instances that explicitly emit result, error, and end sequences. Ordinary CI never invokes a real microphone or vendor service.

## 8. `stop()` and `abort()` Policy

### 8.1 Intentional `stop()`

Use `stop()` only when the learner intentionally finishes the current utterance and requests evaluation of already captured speech.

Transition:

```text
LISTENING → FINALIZING → RESULT or INCONCLUSIVE
```

- Calling `stop()` marks the attempt as finalizing but keeps ownership valid.
- A delayed final `result` may still classify the attempt.
- `end` without a usable final result yields `INCONCLUSIVE/NO_RESULT`.
- A bounded injected finalization timer recovers with `INCONCLUSIVE/FINALIZATION_TIMEOUT` if neither usable final result nor terminal end/error arrives.
- After a usable terminal result, later `end` is cleanup-only and cannot overwrite it.

### 8.2 Context-cancelling `abort()`

Use `abort()` for retry supersession, target change, previous/next/skip, route exit, logout, unmount, and page/session invalidation.

- Invalidate ownership before or atomically with native `abort()`.
- Clear timers, detach/neutralize handlers, and ignore every late event.
- An aborted attempt cannot produce any match outcome.
- A browser-generated abort error/end event is cleanup-only for an already invalidated attempt.

### 8.3 Browser event ordering

The controller must handle without assumptions:

- result then end;
- error then end;
- end without result;
- result after intentional stop;
- result after abort;
- duplicate result/error/end;
- synchronous start/stop/abort exception;
- no terminal callback.

Only the first valid terminal outcome for the current owned attempt is accepted.

## 9. Attempt Ownership and Stale-Event Protection

Each attempt owns:

- a unique monotonically generated attempt token;
- current Set ID;
- current Vocabulary ID;
- a session generation incremented by target/session replacement;
- lifecycle phase;
- terminal flag;
- recognizer instance and timer handles.

Every callback verifies all ownership fields against current controller state before mutation. Terminal settlement is a compare-and-set operation: once terminal, further callbacks perform no result transition.

Required behavior:

- Retry after result/error invalidates and disposes the old attempt before creating a new token.
- Target change aborts first, advances generation, clears result, then changes target.
- Navigation/logout/unmount invalidates before async cleanup.
- Late result after abort is ignored.
- Late end after result cleans up only.
- Error followed by end creates one terminal outcome.
- Stop followed by delayed final result remains valid until settlement/timer expiry.
- Stop without usable result recovers to inconclusive.
- Rapid Start/Stop is serialized by legal-state guards; duplicate UI actions are disabled and ignored at controller level.

All finalization/start watchdog timers are bounded, injected for deterministic tests, cleared on every terminal/cancel/dispose path, and cannot keep controls permanently disabled.

## 10. Reference Audio and Recognition Coordination

Maintain separate playback and recognition ownership tokens.

### Starting Speak

1. Invalidate pending reference-play requests.
2. Pause current `Audio`, clear its handlers/reference, and cancel `speechSynthesis`.
3. Advance playback generation so late `play`, `ended`, `error`, or promise callbacks are ignored.
4. Establish the recognition attempt ownership.
5. Start recognition only if the target/session still matches.

### Starting Listen

- Listen is disabled during `STARTING`, `LISTENING`, and `FINALIZING`.
- It is therefore impossible to intentionally start ELVocab playback during an active attempt.
- If a browser/media race still exposes an active recognizer, playback start first aborts and invalidates recognition, then begins audio only after current ownership reflects cancellation.

### Target change and unmount

- Abort/invalidate recognition.
- Pause HTML audio, clear handlers, cancel speech synthesis, and advance playback generation.
- Ignore stale media promises/callbacks from the previous target.

Deterministic tests cover stored audio, TTS, start-speaking cancellation, disabled Listen, fallback race behavior, target change, and unmount. The UI disclosure must not promise isolation from external audio sources.

## 11. Pure Transcript Classifier

### 11.1 Normalization

For target and each candidate:

1. require a string;
2. normalize Unicode to NFC;
3. trim outer whitespace;
4. remove contiguous surrounding Unicode punctuation characters (`\p{P}`) from the beginning/end only;
5. trim again;
6. apply `toLocaleLowerCase("en-US")`.

Internal punctuation remains. No stemming, plural conversion, substring, fuzzy/edit-distance, or phonetic matching occurs.

### 11.2 Alternative sanitation

- Non-array input, missing target, or no usable alternative yields `INCONCLUSIVE`.
- Null, non-object, non-string, or normalized-empty alternatives are discarded.
- Preserve browser order for usable alternatives.
- Exact duplicate normalized alternatives after the first occurrence are removed for diagnostic clarity without changing which distinct candidate is primary.
- The first usable browser alternative is primary. If the raw primary is unusable, classify the attempt as `INCONCLUSIVE` rather than promoting a later candidate to primary; later valid candidates may remain diagnostic.
- Bound processing to configured `maxAlternatives`.
- Confidence is retained only when finite and within `[0, 1]`; otherwise `null`. It never influences classification.

### 11.3 Diagnostic contract

The pure result contains only transient diagnostic data:

- `classification`: four approved outcomes;
- sanitized primary transcript when available;
- bounded sanitized alternatives with nullable confidence;
- `matchedAlternativeIndex` when applicable;
- stable issue when inconclusive.

This contract is not an API DTO or persisted model. Presentation maps it to the approved Vietnamese copy and specific recovery guidance. `ALTERNATIVE_MATCH` remains uncertain and is not equivalent to primary success.

## 12. Frontend State Machine

Conceptual states:

- `LOADING`
- `READY`
- `DISCLOSURE`
- `UNSUPPORTED`
- `INSECURE_CONTEXT`
- `STARTING`
- `LISTENING`
- `FINALIZING`
- `RESULT`
- `INCONCLUSIVE`
- `RECOVERABLE_ERROR`
- `CANCELLING`
- `INACCESSIBLE`
- `EMPTY`

Key transitions:

```text
LOADING → READY | INACCESSIBLE | EMPTY | RECOVERABLE_ERROR
READY → DISCLOSURE (first use) → STARTING
READY → STARTING (disclosure already acknowledged in current flow)
STARTING → LISTENING | INCONCLUSIVE | RECOVERABLE_ERROR
LISTENING → FINALIZING (intentional stop)
LISTENING/FINALIZING → RESULT | INCONCLUSIVE | RECOVERABLE_ERROR
any active attempt → CANCELLING → READY/target change/exit
RESULT/INCONCLUSIVE/RECOVERABLE_ERROR → STARTING (explicit retry)
```

No automatic retry or carryover result occurs. Target change clears transient result before rendering the new target. Unsupported/error states retain reference playback and navigation where available.

Controls derive from state rather than ad hoc flags. Pending states disable duplicate Speak/navigation actions as necessary; exit remains available with safe cancellation. Terminal feedback receives focus through a heading/ref after state commit, while live regions announce concise status once and do not expose interim transcripts.

## 13. Page, Set Detail, and Responsive UI

### 13.1 Set Detail

- Add a third semantic `LearningCard` for Speaking Practice using the approved route.
- Preserve Flashcard/Quiz destinations and return state.
- Change the grid to a responsive three-card arrangement without horizontal overflow; compact widths may stack or use a single column according to the UI checkpoint.
- Empty Sets retain the established disabled-card behavior.

### 13.2 Focus page

The HUMAN UI checkpoint must approve, before final UI implementation:

- target/reference/speaking visual hierarchy;
- browser-vendor disclosure placement;
- READY, STARTING, LISTENING, FINALIZING, result, and fallback presentation;
- `PRIMARY_MATCH`, uncertain `ALTERNATIVE_MATCH`, `NO_MATCH`, and inconclusive copy;
- Listen/Speak separation and recognition-time disabled behavior;
- retry/previous/next/skip/exit placement;
- focus/live-region behavior;
- representative desktop, tablet, and mobile layouts.

No waveform, pronunciation score, confidence percentage, phoneme panel, PASS/FAIL badge, or automatic completion indicator is planned.

## 14. Browser and Mobile Support Strategy

Distinguish four facts in code, tests, and documentation:

1. **Product UI targets:** responsive desktop and mobile.
2. **Runtime capability:** standard/prefixed constructor, secure context, permission, device, network, and vendor service.
3. **Verified compatibility:** only exact tested browser/OS/device combinations.
4. **Academic baseline:** Chrome desktop.

Plan:

- Automated layout/accessibility coverage at representative desktop/mobile widths.
- Deterministic standard, prefixed, unsupported, insecure, and normalized-error tests.
- HUMAN-authorized real Chrome desktop microphone verification.
- When environments are available, separately test representative Android Chrome and iOS Safari/browser behavior; record device, OS, browser/version, constructor availability, permission, event ordering, results, and cleanup.
- Mark unavailable/unsupported/unverified combinations honestly; do not infer support from responsive layout or API detection.
- Verify deployed HTTPS/secure-context behavior. No mobile recognition claim precedes real evidence.

## 15. Privacy, Security, and Logging

- Disclosure precedes first microphone use and states browser-vendor processing may be local or remote.
- Do not claim offline-only recognition.
- Add no ELVocab raw-audio endpoint, upload, storage, temporary file, or object storage.
- Persist no transcripts, alternatives, confidence, attempts, or outcomes locally or on the Backend.
- Production logging and analytics must exclude recognition text, alternatives, confidence, attempt detail, and raw browser events.
- Add no provider secret or environment variable.
- Deliberately send no USER identity to browser-vendor services.
- Vendor/browser failure maps to an inconclusive/recoverable outcome without learner penalty.
- Existing Backend authorization protects authoritative targets; Frontend recognition is not an authorization boundary.

## 16. Revised Implementation Gates

### Gate R1 — Deterministic recognition foundation

Before page/UI integration, prove:

- pure normalization and all four classifications;
- malformed/empty/duplicate alternatives and optional confidence handling;
- standard/prefixed/unsupported detection;
- adapter configuration and stable error normalization;
- stop versus abort sequences;
- duplicate/stale callbacks and bounded no-terminal recovery;
- no real microphone/vendor call in tests.

The existing 7/7 feasibility harness is input evidence, not completion of the production-module gate. Promote the behavior into maintained modules and tests. Failure stops for HUMAN review rather than changing classification semantics.

### Gate R2 — Integrated frontend technical path

Before deep result presentation, prove with deterministic fakes:

```text
authorized NORMAL Learning payload
→ exact current target
→ reference playback cancellation
→ explicit recognition lifecycle
→ classifier
→ transient result/fallback
→ retry/navigation cleanup
```

Prove no `recordMeaningfulEvent`, persistence request, audio upload, or stale cross-target result. Failure stops for HUMAN review; it does not authorize a backend/provider substitute.

### Gate R3 — UI direction checkpoint

HUMAN approves the responsive/accessibility UI direction described in section 13 before final UI implementation.

### Gate R4 — Controlled real-browser and deployment verification

After mocked coverage passes:

- obtain explicit HUMAN authorization before using a real microphone;
- verify Chrome desktop permission, start, intentional stop/final result, retry, abort/navigation cleanup, representative match/no-match/inconclusive behavior, and reference-audio coordination;
- verify production build and deployed HTTPS/secure context;
- record exact browser/OS and avoid transcript/confidence logs in retained evidence;
- run mobile checks separately where available and make no unsupported claims.

#### HUMAN-Approved Closure Workflow Amendment

This amendment replaces Gate R4 Exception A. It changes sequencing only; it does not waive, delete, or pre-satisfy any Gate R4 criterion.

**Phase 1 — Local source closure**

1. Complete the remaining local/browser verification applicable to TASK-209–TASK-211.
2. Complete source-level Formal TEST and Formal REVIEW under TASK-212 and TASK-213.
3. Record deployed HTTPS Gate R4 as `PENDING`, never as PASS, throughout this phase.
4. TASK-209–TASK-213 may produce source-level PASS/APPROVE evidence from verified localhost and mocked/real-browser evidence, but those verdicts are not deployment acceptance or final feature closure.

**Phase 2 — Conditional Git integration**

5. After source-level TASK-212 PASS and TASK-213 APPROVE, and only with separate HUMAN Git authorization, TASK-214 may authorize one reviewed Speaking Practice V1 feature-branch commit and push.
6. Integration into `dev` is permitted only after verifying remote ancestry, exact file scope, a rollback plan, and isolation between CI/local reset-capable TEST databases and the Preview database without exposing secrets.
7. The normal `dev` push may trigger the existing GitHub Actions CI and Frontend/Backend Vercel Preview deployment workflows; no CI workflow or Vercel configuration change is implied.
8. This integration is explicitly `PROVISIONAL` until the matching deployed revision passes Gate R4. It is not final completion and does not authorize Production or `main` deployment.

**Phase 3 — HTTPS acceptance and final closure**

9. Verify the matching deployed Frontend and Backend revision, HTTPS secure context, authentication, microphone lifecycle, and every existing Gate R4 browser criterion.
10. Gate R4 closes only on actual HUMAN-operated real-browser evidence. CI or deployment success alone is insufficient.
11. If CI, deployment identity/routing, database isolation, or HTTPS verification fails, keep V1 acceptance `PENDING`, stop integration/closure work, and correct only the proven blocker through the approved workflow.
12. Reconcile final evidence, documentation, feature status, and TASK-214 closure only after all mandatory gates pass.

TASK-214 remains the sole authority for both the bounded provisional Git integration and final Git/status closure. Its provisional phase must not be reported as TASK-214 PASS. The historical Web Speech feasibility spike and seven-test harness remain retained reference evidence outside maintained production-test totals. The guarded database-mutating manual Speaking review fixture remains excluded from the provisional commit unless separately reviewed and authorized.

STOP on missing HUMAN Git authorization, incompatible ancestry, unexpected file scope, absent rollback evidence, failed required checks, revision or FE-to-BE routing mismatch, unproven Preview database isolation, unavailable secure HTTPS context, or any Gate R4 failure. Do not reset, force-push, rewrite history, bypass tests, deploy to Production/`main`, substitute a provider, or claim final acceptance.

### Retired gates

- Azure live REST contract Gate B is retired.
- Azure/FFmpeg Backend chain Gate C is replaced by R2.
- FFmpeg deployment Gate A2 is retired.
- Gate A1 remains preserved historical evidence but is not on the active critical path.

## 17. Testing Plan

### 17.1 Pure unit tests

- Normalization: NFC, case, whitespace, outer punctuation, internal punctuation.
- No plural, substring, fuzzy, edit-distance, or phonetic equivalence.
- Primary, later alternative, no-match, and inconclusive results.
- Null/empty/malformed/duplicate alternatives and unusable primary.
- Confidence valid/invalid/missing without classification impact.
- State-machine legal/illegal transitions and one terminal result.

### 17.2 Adapter/lifecycle tests

- Constructor resolution, secure context, fixed configuration, and start exceptions.
- Stop with delayed final result; stop with end/no result; stop timeout.
- Abort with late result/end; error then end; duplicate results/errors/end.
- Retry after result/error; target change; route exit; logout; unmount.
- Rapid Start/Stop and timer cleanup.

### 17.3 Playback coordination tests

- Loading and Listen never start recognition.
- Speak pauses HTML audio and cancels TTS before recognition start.
- Listen is disabled during active/finalizing recognition.
- Fallback abort-before-play behavior handles races.
- Stale playback callbacks cannot change new target/attempt state.
- Target change/unmount cleans both subsystems.

### 17.4 Component/browser tests

- NORMAL Learning load, target/order, route, Set Detail entry, return navigation.
- Disclosure before first use, explicit Speak, every result/error state, retry, previous/next/skip/exit.
- Keyboard-only operation, focus placement, concise live regions, reduced motion, non-color semantics.
- Responsive desktop/tablet/mobile widths and no overflow.
- Mock `SpeechRecognition`; no ordinary browser test uses real microphone/vendor service.

### 17.5 Backend and cross-feature regressions

- Focused existing Learning tests for auth, public/owned/foreign/empty Sets, NORMAL ordering, same-spelling IDs, and read-only behavior.
- Verify zero learning-event/progress/gamification writes from Speaking Practice.
- Existing Flashcard reference playback, Quiz, Learning route, and Set Detail behavior.
- Do not broaden into unsafe database reset paths without separate justification.

### 17.6 Final verification

- Focused frontend unit and mocked browser tests.
- Directly relevant backend read regressions only.
- Production frontend build.
- Touched-file ESLint.
- `git diff --check` and secret/transcript-log scan.
- HUMAN-authorized real Chrome desktop check.
- Deployed HTTPS check.
- Separately recorded mobile checks when environments are available.

## 18. FFmpeg and Historical Evidence Cleanup

Do not remove anything during PLAN.

After amended TASK approval, include a dedicated cleanup step that:

1. confirms no existing application or approved feature imports/requires `ffmpeg-static`;
2. preserves TASK-185/Gate A1 documentary evidence and its original result;
3. obtains the approved disposition for the executable Gate A1 harness—retain as clearly historical/archive evidence or retire it after its evidence is captured;
4. removes obsolete `ffmpeg-static@5.3.0` dependency and lockfile references together;
5. verifies lockfile consistency, dependency absence, focused tests, production builds, lint, and diff checks;
6. confirms no unrelated dependency or historical evidence is removed.

This cleanup must not rewrite history or imply Gate A1 did not occur.

## 19. TASK-184–TASK-214 Migration Preparation

The TASK amendment should preserve IDs and completed evidence while changing active semantics:

- **TASK-184:** keep completed baseline evidence.
- **TASK-185:** keep completed Gate A1 evidence, marked historical/superseded.
- **TASK-186:** replace Azure Gate B with Gate R1 deterministic recognition foundation.
- **TASK-187:** replace Backend/Azure Gate C with Gate R2 integrated frontend path.
- **TASK-188:** rewrite as Gate R3 UI checkpoint.
- **TASK-189:** replace Backend config/contracts with frontend recognition contracts/classifier.
- **TASK-190–TASK-196:** retire Azure/backend pipeline tasks; reuse selected IDs for narrowly scoped adapter, state/lifecycle, playback coordination, and approved FFmpeg cleanup without changing their historical record.
- **TASK-197:** rewrite as Learning authorization/read-only/no-side-effect regression verification.
- **TASK-198–TASK-200:** rewrite for pure state, recognition adapter, route/load/lifecycle.
- **TASK-201:** keep Set Detail entry with responsive three-card work.
- **TASK-202–TASK-204:** rewrite core UI, result/fallback, and accessibility for recognition semantics.
- **TASK-205–TASK-206:** rewrite unit and mocked-browser coverage.
- **TASK-207:** replace Azure smoke with HUMAN-authorized Chrome desktop check.
- **TASK-208:** retire Gate A2; use only for an approved remaining closure/cleanup responsibility if dependency graph remains clear.
- **TASK-209:** rewrite real-device/browser evidence with no pre-claimed mobile support.
- **TASK-210–TASK-211:** rewrite documentation reconciliation and consolidated verification.
- **TASK-212–TASK-214:** retain formal TEST, REVIEW, HUMAN closure, and Git integration gates against the amended artifacts.

The TASK amendment must contain a clear dependency graph and STOP boundaries. No retired task may remain an active prerequisite merely because it existed in the earlier architecture.

## 20. Documentation Reconciliation

After verified implementation, update only demonstrated behavior:

- `docs/PROJECT_OVERVIEW.md` — recognition purpose; remove active score/PASS and progress effects.
- `docs/ARCHITECTURE.md` — native browser recognition boundary and Learning API reuse.
- `docs/API_SPEC.md` — retire the conceptual pronunciation evaluation endpoint for V1.
- `docs/UI_UX_SPEC.md` — activity entry, states, disclosure, accessibility, responsive/device distinction.
- `docs/FEATURE_STATUS.md` — move to `IN_PROGRESS` only when implementation begins and `DONE` only after TEST/REVIEW/HUMAN closure.
- `docs/DATABASE.md` — change only if an explicit no-persistence clarification is needed; no schema change.
- SPEC/PLAN/TASK evidence — preserve historical Gate A1 and record retired/replacement gates truthfully.

## 21. Implementation Order

1. HUMAN approves this amended PLAN.
2. Amend and obtain HUMAN approval for TASK-184–TASK-214.
3. Establish safe baseline and preserve historical evidence.
4. Implement/promote pure classifier and recognition adapter; pass Gate R1.
5. Implement state/ownership controller and reference-playback coordination.
6. Prove Learning-to-transient-result path with deterministic fakes; pass Gate R2.
7. Produce UI checkpoint; obtain Gate R3 HUMAN approval.
8. Add route, Set Detail entry, focus page, result/fallback UI, responsive behavior, and accessibility.
9. Complete unit, mocked browser, directly relevant backend, and cross-feature regression tests.
10. Perform approved obsolete FFmpeg dependency/harness cleanup and verification.
11. Record TASK-209 local/browser support evidence with deployed HTTPS Gate R4 explicitly `PENDING`.
12. Reconcile source-level documentation without marking the feature DONE, then run TASK-211 consolidated source verification.
13. Perform TASK-212 source-level Formal TEST and TASK-213 source-level Formal REVIEW; neither verdict is deployed HTTPS acceptance.
14. Under TASK-214 and separate HUMAN Git authorization, verify ancestry, exact scope, rollback readiness, and CI/Preview database isolation; create and push one reviewed feature-branch commit, integrate it into `dev`, and allow the existing CI and Vercel Preview workflows to run.
15. Treat the integration as provisional; verify CI plus the matching deployed FE/BE revision and complete Gate R4 through HUMAN-operated HTTPS Chrome evidence.
16. On Gate R4 PASS, finalize TASK-209 evidence and reconcile final documentation/status; perform any required deployment-delta TEST/REVIEW confirmation.
17. Complete TASK-214 final Git/status closure only after all mandatory gates pass. Do not deploy Production or `main`.

## 22. Risks and Mitigations

- **Non-uniform browser API:** runtime detection, normalized adapter, honest support matrix.
- **Vendor/network dependence:** disclosure and recoverable inconclusive outcomes.
- **Recognition is not pronunciation assessment:** recognition-only copy and no scores/thresholds.
- **Reference audio leakage:** cancel playback before Speak and disable Listen during attempts.
- **External audio leakage:** explicitly avoid promising isolation.
- **Event races/stuck controls:** ownership tokens, one-terminal guard, bounded injected timers, exhaustive ordering tests.
- **False matches/nonmatches:** conservative exact comparison and unrestricted retry without penalty.
- **Misleading alternatives/confidence:** uncertain alternative outcome; confidence diagnostic only.
- **Privacy leakage:** no uploads/persistence and no production transcript/event logging.
- **Unsupported mobile behavior:** responsive UI remains, but verification claims require real evidence.
- **Obsolete dependency residue:** approved cleanup with import check, lockfile verification, and historical evidence preservation.

## 23. Scope and Complexity Check

- The solution stays within the approved separate USER activity.
- It reuses existing authorization, Learning data, route conventions, reference playback, and test boundaries.
- It adds no external service, dependency, role, schema, endpoint, persistence, or business-critical Frontend scoring.
- It does not change Flashcard, Quiz, Progress, SRS, or gamification behavior.
- It removes rather than replaces the obsolete server-side provider pipeline.

## 24. Open Questions and HUMAN Approval Boundary

No blocking technical question prevents TASK planning after HUMAN approval.

The PLAN recommends and asks HUMAN to approve these implementation choices:

1. `continuous = false`, `interimResults = false`, and bounded `maxAlternatives = 5`.
2. Listen disabled during recognition; any defensive playback race aborts recognition before playback.
3. Primary transcript may be shown; full alternatives and numeric confidence remain hidden from ordinary learner UI.
4. A bounded injected finalization watchdog converts a stuck intentional stop into recoverable inconclusive state.
5. Chrome desktop remains the required academic baseline; mobile compatibility is recorded only after real evidence.
6. Historical Gate A1 evidence is retained while obsolete FFmpeg dependency/harness disposition occurs in a later approved cleanup task.

Approval of this PLAN does not authorize implementation. The next stage is amendment and HUMAN approval of the TASK artifact.
