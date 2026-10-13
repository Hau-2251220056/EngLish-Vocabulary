# SPEC: Speaking Practice V1 — Browser Spoken-Word Recognition

**Feature status:** `TODO`

**SPEC status:** `AMENDED — AWAITING HUMAN REVIEW`

**Implementation authorized:** `NO`

## 1. Objective

Deliver a separate authenticated USER activity for practicing isolated English vocabulary words. The learner hears the existing reference pronunciation, explicitly starts browser speech recognition, speaks the displayed target, and receives feedback about whether the browser recognized that target.

V1 evaluates spoken-word recognition only. It does not measure phonetic correctness, pronunciation accuracy, accent quality, or articulation. A match is not a pronunciation score, and a mismatch is not proof of incorrect pronunciation.

The activity preserves exact Vocabulary identity, remains separate from Flashcard and Quiz, stores no learner audio, transcript, or attempt history, and creates no Learning Progress, SRS, XP, Streak, reward, or Achievement effect.

## 2. Amendment Context

The HUMAN-approved architecture is browser-based recognition through `SpeechRecognition` or `webkitSpeechRecognition`, with locale fixed to `en-US`.

Earlier Azure Pronunciation Assessment, Backend audio upload, FFmpeg normalization, and numeric/phoneme assessment requirements are superseded for active V1. Completed feasibility and Gate A1 evidence remains historical evidence and must not be overwritten or deleted. The PLAN and TASK still describe the superseded architecture and must be amended and separately approved before implementation resumes.

## 3. Existing Context and Reconciliation

- Pronunciation/Speaking Practice is within thesis scope as a separate learning activity, not a Quiz type.
- Flashcard already prefers stored `pronunciation_url` audio and falls back to browser English speech synthesis. Speaking Practice reuses this listening behavior without adding microphone behavior to Flashcard.
- The existing authenticated Learning API returns an authorized Set and ordered exact Vocabulary identities. Speaking Practice reuses this read boundary without mutating progress.
- Canonical and USER-private Vocabulary with the same spelling remain separate identities; spelling never replaces Set/Vocabulary identity.
- The current schema requires no recording, transcript, attempt, score, or result entity. V1 adds none.
- Documentation describing a pronunciation evaluation endpoint, Azure, numeric scores, a `>50%` PASS rule, persistence, or Progress/gamification conflicts with this amendment and must be reconciled downstream.
- `docs/FEATURE_STATUS.md` records the related capabilities as `TODO`; this amendment does not advance status.
- The Web Speech feasibility harness demonstrates conservative normalization, four diagnostic outcomes, confidence handling, and standard/prefixed capability detection through deterministic tests. Manual Chrome desktop evidence does not establish mobile or cross-browser compatibility.

## 4. Actors and Authorization

- **Guest:** Cannot enter Speaking Practice.
- **USER:** Can practice a non-empty public System Set or an owned non-empty private User Set, using only exact Vocabulary identities currently in that Set.
- **ADMIN:** Does not receive the USER Speaking Practice flow in V1.

Backend authentication and existing Learning API authorization remain authoritative. Frontend route guards and entry visibility are UX only. Another USER's private data remains undisclosed through existing safe access behavior.

## 5. Scope

### 5.1 In Scope

- A separate USER Speaking Practice activity entered from Set Detail alongside Flashcard and Quiz.
- A responsive focus-mode route for one accessible, non-empty Set.
- Existing authorized Learning API data and authoritative Set Item order.
- One isolated English target at a time with locale fixed to `en-US`.
- Target word, nullable phonetic text, stored reference audio, and browser TTS fallback.
- Explicit USER-initiated recognition through `SpeechRecognition` or `webkitSpeechRecognition` when available.
- Runtime capability detection and graceful unsupported behavior.
- Conservative transcript normalization and exact target comparison.
- `PRIMARY_MATCH`, `ALTERNATIVE_MATCH`, `NO_MATCH`, and `INCONCLUSIVE` outcomes.
- Permission, no-speech, network, vendor-service, abort, and other browser error handling.
- Retry, previous, next, skip, exit, cleanup, and stale-event protection.
- Responsive desktop/mobile UI, keyboard access, reduced motion, and assistive-technology semantics.
- Deterministic mocked tests and separately controlled real-browser verification.

### 5.2 Out of Scope / Deferred

- Phonetic, acoustic, articulatory, accent, or pronunciation-quality assessment.
- Pronunciation, accuracy, word, phoneme, completeness, fluency, or prosody scores.
- Numeric scoring, score bands, PASS/FAIL, or a `50%` threshold.
- Sentences, free speaking, conversation, or certified assessment.
- Fuzzy, substring, edit-distance, stemming, plural-equivalence, or phonetic matching.
- Automatic success based solely on an alternative transcript.
- Learner audio, transcript, confidence, attempt, or result persistence.
- Progress, SRS, XP, Level, Daily Goal, Streak, rewards, or Achievements.
- Server-side speech recognition or pronunciation evaluation.
- A pronunciation-specific Backend evaluation endpoint.
- `MediaRecorder`, multipart learner-audio upload, Azure, provider DTOs, FFmpeg, native deployment gates, or provider cost limiting.
- Microphone behavior inside Flashcard or a new Quiz type.
- Guaranteed offline recognition or compatibility across all browser/device combinations.
- Shared notification/toast refactoring.

## 6. User Flow

### 6.1 Entry and Load

1. An authenticated USER opens an accessible Set Detail.
2. A non-empty eligible Set presents **Speaking Practice** as a separate activity once implemented.
3. Empty or inaccessible Sets follow existing safe learning boundaries.
4. The USER enters the focus route, which loads the Set and ordered exact Vocabulary identities through the existing Learning API.
5. The first target displays its word, optional phonetic text, reference-listening control, and speaking control.

### 6.2 Reference Listening

- Loading, changing targets, and reference playback never start recognition or request microphone permission.
- Listening and speaking are separate controls with distinct visible and accessible names.
- Playback uses stored `pronunciation_url` first and supported English browser TTS otherwise.
- Playback failure is non-blocking and does not remove navigation or an otherwise supported speaking action.

### 6.3 Disclosure and Recognition

1. Before first microphone use, the UI discloses that recognition is supplied by the browser and its vendor may process audio locally or remotely.
2. The disclosure states that ELVocab has no raw-audio upload endpoint for this activity and persists no audio, transcripts, or attempt history.
3. Recognition starts only after explicit USER action—never on load, playback, target change, or retry rendering.
4. Runtime resolves `SpeechRecognition` or `webkitSpeechRecognition`; otherwise the activity enters an unsupported state.
5. One `en-US` session is associated with the current transient attempt token and exact Vocabulary identity. Duplicate starts are prevented.
6. Final alternatives from the current valid result are normalized and classified against the authoritative target.
7. The UI displays recognition-specific feedback and preserves retry, reference listening, and navigation.
8. Result, error, abort, target change, exit, logout, route change, or unmount invalidates late events and releases the current session.

No raw audio is exposed to or uploaded by ELVocab in this flow.

### 6.4 Retry and Navigation

- Retry creates a new local attempt token and never automatically starts recognition or reuses a prior result.
- Starting a new attempt invalidates late `result`, `error`, and `end` events from the previous attempt.
- Previous, next, and skip abort or invalidate recognition before changing exact target identity.
- Exit returns to Set Detail. Returning to a word does not restore persistent or authoritative history.

## 7. Recognition Outcome Contract

Outcomes are transient frontend session results, not persisted learning results or pronunciation scores.

### 7.1 `PRIMARY_MATCH`

The normalized primary transcript exactly equals the normalized authoritative target.

Feedback: **“Đã nhận diện đúng từ mục tiêu.”**

This means the browser recognized the target as its primary result; it does not certify pronunciation quality.

### 7.2 `ALTERNATIVE_MATCH`

The primary transcript differs, but a later normalized alternative exactly equals the target.

Feedback: **“Từ mục tiêu xuất hiện trong một kết quả nhận diện khác. Hãy thử lại để xác nhận.”**

This is uncertain diagnostic evidence and must not automatically be treated or presented as success.

### 7.3 `NO_MATCH`

Recognition returned usable transcripts, but none exactly matched the target.

Feedback: **“Hệ thống chưa nhận diện được từ mục tiêu. Hãy nghe mẫu và thử lại.”**

This reports recognition behavior only; it must not say the learner pronounced the word incorrectly.

### 7.4 `INCONCLUSIVE`

A reliable comparison cannot be produced because of capability, permission, no speech, network/vendor failure, abort, empty/unusable results, stale events, or another recognition error. The UI shows a safe actionable explanation. This is not learner failure and creates no penalty.

## 8. Business and Comparison Rules

- **BR-01:** Speaking Practice is a separate authenticated USER activity, not Flashcard behavior or a Quiz type.
- **BR-02:** The target comes only from the Backend-authorized Learning payload for the current accessible Set.
- **BR-03:** Traversal follows exact Vocabulary identity and authoritative Set Item order; spelling never substitutes for identity.
- **BR-04:** V1 recognition locale is fixed to `en-US`.
- **BR-05:** Target and transcripts use Unicode NFC normalization, outer-whitespace trimming, approved surrounding Unicode punctuation removal, and locale-aware case-insensitive equality.
- **BR-06:** Normalization applies no stemming, singular/plural equivalence, substring, fuzzy, edit-distance, or invented phonetic matching.
- **BR-07:** Alternative index `0` is primary. Exact primary match yields `PRIMARY_MATCH`; exact later match yields `ALTERNATIVE_MATCH`; usable nonmatches yield `NO_MATCH`; no reliable comparison yields `INCONCLUSIVE`.
- **BR-08:** Optional browser confidence is diagnostic metadata only. It never affects classification, success, learner feedback, ranking, or pronunciation quality.
- **BR-09:** Missing, invalid, or out-of-range confidence is unavailable, never converted to zero or another score.
- **BR-10:** Only one current recognition lifecycle exists. Duplicate and stale events cannot change the current target or outcome.
- **BR-11:** ELVocab stores no raw audio, transcript, alternatives, confidence, attempt, or result history.
- **BR-12:** Speaking Practice performs no Progress, SRS, or gamification mutation.

Exact internal field names and whether learner UI displays alternatives are PLAN/UI decisions. Numeric confidence remains hidden from ordinary learner feedback unless a later HUMAN-approved requirement establishes a non-misleading use.

## 9. Browser and Device Boundary

### 9.1 Product Device Targets

- The responsive interface targets desktop and mobile.
- Layout support does not imply browser recognition availability.
- Target, playback, disclosure, feedback, and navigation remain usable at supported widths without horizontal overflow.

### 9.2 Runtime Capability

- Detection checks both `SpeechRecognition` and `webkitSpeechRecognition`.
- Recognition controls are offered only when the required API and secure microphone context are available.
- Unsupported clients retain accessible target viewing, reference listening where available, and navigation.
- Permission denial, service denial, no speech, audio-capture failure, network/vendor failure, and abort cause no automatic retry loop.
- The product assumes neither identical event ordering nor identical permission/service behavior across browsers and devices.

### 9.3 Verified Compatibility

- Compatibility claims require recorded real-device/browser evidence; API presence alone is insufficient.
- Chrome desktop is the academic demo baseline.
- Existing Chrome desktop evidence does not establish mobile recognition support.
- Each mobile/browser combination must be separately tested and documented before being claimed as verified.
- Unverified combinations may use capability detection and graceful behavior but cannot be advertised as verified.

## 10. Privacy, Security, Data, and API Requirements

- ELVocab provides no raw-audio upload endpoint for V1 and does not receive, log, or persist raw learner audio.
- Production logging does not capture transcripts, alternatives, confidence, or attempts.
- Browser vendors may process audio locally or remotely; disclosure precedes microphone use and never claims guaranteed offline processing.
- Existing Backend authentication and Learning authorization are authoritative for target data.
- No direct USER identifier is deliberately supplied by ELVocab to a recognition provider.
- Session results remain transient in page memory and are discarded on replacement, exit, or unmount.
- No database migration or schema change is required.
- Reuse the existing authenticated Learning API; do not add `POST /api/pronunciation/evaluate` or another server speech-evaluation endpoint.
- Do not send recognized transcripts, confidence, or raw audio to ELVocab during ordinary evaluation.
- Existing safe unauthenticated, non-USER, inaccessible/not-found, and empty-Set behavior remains authoritative.

## 11. UI and State Requirements

Required conceptual states:

- **Loading**, **Ready**, and required pre-use **Disclosure**.
- **Starting/requesting permission** with duplicate start disabled.
- **Listening/recognizing** with textual, non-color-only status.
- **Result** for `PRIMARY_MATCH`, `ALTERNATIVE_MATCH`, or `NO_MATCH`.
- **Inconclusive**, **Permission denied/service not allowed**, **No speech**, **Network/vendor-service error**, **Unsupported**, **Insecure context**, **Aborted**, and safe generic **Error**.
- Existing **Inaccessible/not found** and **Empty** states.

Non-assessing states preserve target, optional phonetic text, reference playback, meaningful retry, navigation, and exit where technically available. UI copy describes recognition, never pronunciation quality.

## 12. Lifecycle and Reliability

- One start creates at most one active recognition session.
- Duplicate start, stop, abort, result, error, and end events are idempotently handled.
- A current attempt token plus exact Vocabulary ID protects against stale events.
- Recognition is stopped/aborted or invalidated before retry, target change, exit, route change, logout, unmount, and relevant lifecycle interruption.
- Late obsolete events are ignored.
- Normal `end` after a terminal result does not erase or duplicate it; error followed by `end`, or `end` without usable results, creates at most one terminal state.
- No automatic restart follows denial, no speech, network failure, abort, or result.
- Reference audio and speech synthesis retain independent existing cleanup behavior.

## 13. Accessibility Requirements

- Reference and speaking controls have distinct visible labels and accessible names.
- Start, stop/cancel where supported, retry, skip, previous, next, and exit use native accessible controls.
- Controls have visible focus and correct disabled/pending semantics; the whole flow is keyboard-operable.
- Listening, result, inconclusive, and error states use concise appropriate status/live-region behavior without announcing interim transcripts repeatedly.
- Focus moves predictably to terminal feedback and back to target/start context for retry/navigation.
- Meaning does not depend on color, waveform, or animation; reduced-motion preferences are respected.
- Touch targets follow project conventions, and fallback states do not trap focus.
- Browser-vendor processing disclosure is perceivable before microphone use.

A focused UI/UX checkpoint requires HUMAN approval before final UI implementation.

## 14. Testability Requirements

Ordinary automated tests require no real microphone or live vendor service.

- Browser recognition is behind a testable adapter.
- Standard, prefixed, and unsupported capability detection is deterministic.
- Normalization covers NFC, case, outer whitespace, and allowed punctuation; plural, substring, fuzzy, and unrelated values remain nonmatches.
- All four outcomes and optional/invalid confidence are covered deterministically.
- Permission/service denial, no speech, network failure, audio-capture failure, abort, and empty results are covered.
- Duplicate and stale events after retry, target change, exit, and unmount are suppressed.
- Existing Learning authorization and exact identity remain covered.
- No recognition path calls persistence, Progress/SRS, or gamification services.
- Production logging captures neither transcripts nor raw recognition data.
- Keyboard, focus, live regions, reduced motion, pending semantics, and responsive widths are covered without claiming mobile recognition verification.
- Existing Flashcard, Learning, Quiz, and Set Detail behavior remains unchanged except for the separate activity entry.
- A controlled real Chrome desktop check verifies permission, lifecycle, and representative outcomes.
- Mobile recognition is claimed only after evidence records the exact device, OS, and browser/version.

## 15. Acceptance Criteria

- **AC-01:** An authenticated USER can enter Speaking Practice for a non-empty public System Set or owned private Set; other access follows safe existing boundaries.
- **AC-02:** Set Detail presents a separate activity only when implemented; Flashcard retains reference playback only.
- **AC-03:** The activity uses the existing authorized Learning API and exact Set Item Vocabulary IDs in authoritative order.
- **AC-04:** Each target shows its word, optional phonetic text, stored audio when present, and supported English TTS fallback.
- **AC-05:** Loading, target changes, and playback never request microphone access or start recognition.
- **AC-06:** Before first microphone use, disclosure explains possible browser-vendor processing and ELVocab's no-upload/no-persistence boundary.
- **AC-07:** Recognition starts only explicitly, uses `en-US`, and prevents duplicate concurrent start.
- **AC-08:** Runtime detection supports standard and prefixed constructors and provides a graceful unsupported state.
- **AC-09:** A normalized primary exact match produces `PRIMARY_MATCH` and approved recognition feedback without a pronunciation claim.
- **AC-10:** A later-alternative exact match produces `ALTERNATIVE_MATCH`, requests retry confirmation, and is not automatic success.
- **AC-11:** Usable nonmatching alternatives produce `NO_MATCH` without declaring incorrect pronunciation.
- **AC-12:** Capability, permission, service, no-speech, network, abort, and unusable-result cases produce actionable inconclusive/recovery states with no learner penalty.
- **AC-13:** Comparison uses the conservative normalization rules and no stemming, plural equivalence, substring, fuzzy, or edit-distance matching.
- **AC-14:** Confidence is optional diagnostic metadata, never changes classification, and never becomes a learner score.
- **AC-15:** Retry creates a new transient attempt and never automatically restarts or reuses stale output.
- **AC-16:** Duplicate/stale events cannot create multiple outcomes or update a superseded attempt or target.
- **AC-17:** Navigation, logout, unmount, and lifecycle interruption stop/abort or invalidate recognition and prevent late updates.
- **AC-18:** Responsive desktop/mobile UI preserves core content and controls without overflow; runtime recognition capability remains independent.
- **AC-19:** The flow and recovery states are keyboard-operable with visible focus, concise live status, and non-color/non-motion meaning.
- **AC-20:** ELVocab exposes no raw-audio upload endpoint and does not log or persist audio, transcripts, confidence, attempts, or results.
- **AC-21:** No database record/schema change, Progress/SRS update, XP, Streak, reward, or Achievement effect occurs.
- **AC-22:** Deterministic automated tests use mocked recognition and no real microphone, vendor service, Azure credential, or live call.
- **AC-23:** Real Chrome desktop evidence verifies actual behavior; no mobile combination is claimed verified before separate recorded testing.
- **AC-24:** Existing Flashcard, Learning, Quiz, Set Detail, identity, and reference-pronunciation behavior remains unchanged except for the approved activity entry.

## 16. Dependencies and Impact

### Frontend

- New focus activity and Set Detail entry.
- Reuse of existing Learning service and reference playback.
- New recognition adapter, conservative classifier, and transient state.

### Backend / API / Database

- Reuse existing authenticated Learning reads and authorization.
- No new speech route, service, repository, multipart handling, provider integration, ingestion, migration, or table.

### Deployment

- Production remains HTTPS for microphone-dependent browser functionality where supported.
- No Azure credential, provider egress, FFmpeg binary, or native speech-processing deployment requirement.
- Recognition availability remains browser/vendor dependent.

### Documentation

After approval, the downstream workflow must reconcile `PROJECT_OVERVIEW.md`, `ARCHITECTURE.md`, `API_SPEC.md`, `UI_UX_SPEC.md`, `FEATURE_STATUS.md`, and `DATABASE.md` only if an explicit no-schema clarification is needed. The existing PLAN and TASK must replace the Azure/FFmpeg/backend pipeline before implementation resumes.

## 17. Risks and Browser Limitations

- The recognition API is not uniformly implemented across browsers.
- Some implementations use remote vendor services and depend on network availability.
- Recognition varies with microphone, environment, accent, speech rate, device, and vendor model.
- Correct/incorrect transcripts do not prove pronunciation quality.
- Confidence may be absent or misleading and cannot be a score or threshold.
- Alternative matches remain uncertain and require retry rather than automatic success.
- Permission and event ordering differ across browsers and mobile lifecycles.
- API presence does not prove verified compatibility; responsive mobile UI does not imply verified mobile recognition.
- Persistence, consequential scoring, server recognition, or another provider requires a separate approved workflow.

## 18. PLAN Decisions

PLAN may resolve without changing this contract:

1. Exact focus route and return navigation.
2. Exact reuse shape of the Learning payload.
3. Recognition adapter and safe issue-code names.
4. Recognition settings other than fixed `en-US`, including interim results and maximum alternatives.
5. Stop/cancel behavior within runtime capabilities.
6. Exact allowed surrounding Unicode punctuation.
7. Whether learner UI displays alternatives; confidence remains diagnostic by default.
8. Exact actionable copy for each inconclusive cause.
9. Disclosure placement and browser-vendor wording.
10. Same-tab transient cursor/result behavior without history.
11. Automated matrix and real-device evidence format.
12. Focused responsive/accessibility UI checkpoint.
13. Historical Gate A1 evidence retention and approved cleanup/archive treatment for obsolete `ffmpeg-static`; no cleanup occurs at SPEC stage.

## 19. Deferred Follow-Up

- Phonetic/acoustic assessment, numeric scoring, PASS/FAIL, or score bands.
- Audio, transcript, attempt, or result history.
- Progress/SRS/gamification coupling.
- Sentence, conversation, analytics, teacher review, or certified scoring.
- Server-side recognition or another provider.
- Verified browser/device support claims without evidence.
- Shared notification/toast refactoring.

## 20. Open Questions and Approval Boundary

There is no blocking ambiguity preventing HUMAN review.

Approval confirms:

1. V1 is browser spoken-word recognition practice, not pronunciation-quality assessment.
2. `SpeechRecognition`/`webkitSpeechRecognition` with `en-US` replaces Azure, Backend audio evaluation, and FFmpeg in active V1.
3. The four outcomes are approved, and alternative matches are uncertain rather than automatic success.
4. Confidence is optional diagnostic metadata; no numeric learner score or threshold exists.
5. The responsive product targets desktop and mobile, while recognition is runtime-dependent; Chrome desktop is the academic demo baseline, and mobile recognition is unverified until separately evidenced.
6. Browser-vendor local or remote processing is disclosed; ELVocab uploads, logs, and persists no raw audio or recognition history.
7. Existing Learning authorization and reference playback are reused, with no new evaluation endpoint or database change.
8. No Progress, SRS, or gamification effects occur.
9. Historical Azure/FFmpeg evidence remains preserved, while PLAN and TASK require separate amendment and approval.

No PLAN, TASK, implementation, dependency change, or Git integration is authorized by this amendment. After HUMAN approval, the next stage is PLAN amendment.
