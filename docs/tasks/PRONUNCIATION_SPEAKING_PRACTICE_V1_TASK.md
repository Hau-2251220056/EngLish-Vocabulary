# TASKS: Speaking Practice V1 — Browser Spoken-Word Recognition

**Approved SPEC:** `docs/specs/PRONUNCIATION_SPEAKING_PRACTICE_V1_SPEC.md`

**Approved PLAN:** `docs/plans/PRONUNCIATION_SPEAKING_PRACTICE_V1_PLAN.md`

**TASK status:** `AMENDED — AWAITING HUMAN REVIEW`

**Implementation authorized:** `NO`

## 1. Scope and Execution Boundary

TASK-184 through TASK-214 deliver only the approved separate USER Speaking Practice activity:

```text
authorized NORMAL Learning API
→ exact Set/Vocabulary identity and order
→ reference audio/TTS
→ explicit SpeechRecognition (`en-US`)
→ conservative transcript classifier
→ transient frontend outcome
→ truthful recognition feedback/retry/navigation
```

V1 evaluates browser recognition of isolated words, not pronunciation accuracy. It adds no pronunciation-specific Backend endpoint, audio upload/persistence, database change, score, phoneme assessment, fuzzy matching, Progress/SRS/XP/Streak/Achievement effect, new role, or new external dependency.

Historical TASK-184 and TASK-185 evidence is preserved. Superseded Azure/FFmpeg tasks do not count as replacement-gate completion. No implementation may begin until HUMAN approval of this amended TASK.

## 2. Status Vocabulary

- **COMPLETE — HISTORICAL:** executed evidence remains valid as history.
- **SUPERSEDED — HISTORICAL:** executed evidence is preserved but is not an active architecture prerequisite.
- **RETIRED — NOT EXECUTED:** old work is unnecessary and must not be implemented.
- **PENDING — ACTIVE:** approved work not yet started.
- **PENDING — HUMAN GATE:** work/evidence requires explicit HUMAN approval before proceeding.

`docs/FEATURE_STATUS.md` remains `TODO` for Pronunciation Practice and Speech Recognition. Status may move to `IN_PROGRESS` only when approved implementation starts and to `DONE` only after formal TEST, REVIEW, HUMAN closure, and authorized status reconciliation.

## 3. Dependency Graph and STOP Boundaries

```text
TASK-184 COMPLETE historical baseline
+ TASK-185 Gate A1 PASS historical/superseded
+ amended SPEC APPROVED
+ amended PLAN APPROVED
→ amended TASK HUMAN approval (pending)

After approval:
  TASK-189 classifier ─┐
  TASK-190 adapter ────┼→ TASK-186 Gate R1 → STOP R1
  TASK-191 lifecycle ──┘

  TASK-192 playback coordination ─┐
  TASK-197 Learning regressions ───┼→ TASK-198 integrated controller
  TASK-186 Gate R1 PASS ───────────┘
  TASK-198 → TASK-199 route/load → TASK-200 navigation/lifecycle
  TASK-199 + TASK-200 → TASK-187 Gate R2 → STOP R2

  TASK-187 PASS → TASK-194 Phase A presentation/copy preparation
  TASK-194 Phase A → TASK-188 Gate R3 UI checkpoint → STOP R3 HUMAN approval
  TASK-188 approval → TASK-194 Phase B final presentation implementation

  TASK-194 complete
    → TASK-201 Set Detail entry
    → TASK-202 core UI
    → TASK-203 outcomes/fallbacks
    → TASK-204 accessibility/responsive
    → TASK-205 consolidated unit coverage
    → TASK-206 mocked browser/regressions

  TASK-206 PASS → TASK-208 obsolete FFmpeg cleanup decision/work
  TASK-206 PASS → TASK-207 localhost/real-browser evidence; HTTPS Gate R4 remains PENDING
  TASK-207 local evidence + TASK-208 PASS → TASK-209 source evidence checkpoint
  TASK-209 source checkpoint → TASK-210 source docs → TASK-211 source verification
  TASK-211 source PASS → TASK-212 source-level formal TEST → STOP HUMAN TEST acceptance
  TASK-212 source PASS accepted → TASK-213 source-level formal REVIEW
  TASK-213 source APPROVE + separate HUMAN Git authorization
    → TASK-214 Phase A provisional feature commit/push and dev integration
    → existing CI + matching FE/BE Vercel Preview
    → TASK-207 deployed HTTPS Gate R4
  Gate R4 PASS → TASK-209 final evidence → final docs/status and deployment-delta verification
    → TASK-214 Phase B final closure
```

TASK-193, TASK-195, and TASK-196 are retired records and are not dependencies. Any gate failure stops for HUMAN review and does not authorize Azure, another provider, a Backend speech endpoint, fuzzy matching, or architecture substitution.

## 4. Historical Foundation

### TASK-184 — Preserve the Approved Baseline

**Status:** `COMPLETE — HISTORICAL PASS`

**Objective/scope:** Preserve the safe pre-implementation baseline and stash/worktree evidence. No rerun is implied by this amendment.

**Dependencies:** Original HUMAN authorization, completed.

**Historical work/evidence:** Branch was `dev`; `stash@{0}` was preserved. Flashcard/model-pronunciation tests passed 8/8, pure Quiz read/answer tests passed 20/20, and mocked Chromium Learning NORMAL/Quiz-back/owner Set Detail checks passed 3/3. The unsafe shared-database Quiz reset path was excluded. Initial sandbox-only `spawn EPERM` failures occurred before execution; identical focused commands passed with process permission.

**PASS/FAIL:** Historical PASS remains valid. Any future unexplained relevant baseline regression is a new failure, not a rewrite of this record.

**STOP:** Unexpected worktree/stash change or unsafe environment resolution during resumed implementation requires HUMAN review.

### TASK-185 — Preserve FFmpeg Gate A1 Evidence as Superseded History

**Status:** `COMPLETE — HISTORICAL GATE A1 PASS; SUPERSEDED`

**Objective/scope:** Preserve executed Windows FFmpeg feasibility facts without retaining them on the active critical path.

**Dependencies:** TASK-184, completed.

**Historical work/evidence:** Exact `ffmpeg-static@5.3.0` resolved FFmpeg 6.1.1; package license was `GPL-3.0-or-later`. A synthetic 350 ms Ogg/Opus fixture was generated in memory. Windows resolution/execution and stdin/stdout conversion to mono, 16 kHz, signed 16-bit PCM WAV passed 5/5. Corrupt input, missing executable (`ENOENT`), timeout termination, cleanup, and no persistent test audio were proven. The installed binary was 82,797,568 bytes and package 82,920,404 bytes. Linux/Vercel runtime, tracing, permissions, final Function size, and deployed behavior were not proven; the original combined gate therefore failed, after which HUMAN accepted the completed local evidence as `GATE A1: PASS`. Native security maintenance and GPL/license concerns were recorded.

**PASS/FAIL:** Historical Gate A1 PASS is preserved. It is not Gate R1/R2/R4 evidence and makes no Vercel compatibility claim.

**STOP:** Do not delete/rewrite evidence or remove the dependency/harness outside TASK-208.

### Historical Azure Disposition

- Original TASK-186 Azure Gate B was `PENDING` and never executed: no live provider request, provider cost, or configured Azure credential. It has no PASS result.
- Original TASK-187 Azure Gate C was not started and has no evidence.
- Original Gate A2 was not executed and is retired by the approved architecture.

## 5. Recognition Foundation and Gates

### TASK-186 — Gate R1: Verify the Deterministic Recognition Foundation

**Status:** `PENDING — ACTIVE REPLACEMENT GATE` (old Azure Gate B retired, not executed)

**Objective/scope:** Aggregate and verify production-ready pure classifier, adapter, lifecycle/watchdog, and deterministic fake coverage from TASK-189–191. No real microphone/vendor call.

**Dependencies:** HUMAN TASK approval; TASK-189, TASK-190, TASK-191 complete.

**Work/evidence required:** Exact commands/counts proving NFC/case/punctuation rules; four outcomes; malformed/empty/duplicate alternatives; confidence neutrality; standard/prefixed/unsupported constructors; fixed native configuration; stable issue codes; stop/abort; reordered/duplicate/stale callbacks; 5,000 ms startup and 4,000 ms finalization watchdogs; fake timers/recognizers; secret/network scan. The old 7/7 spike is reference evidence only.

**PASS/FAIL:** PASS only when all deterministic cases pass with one terminal outcome, complete timer/handler disposal, and no real device/service dependency. Any missing lifecycle case or nondeterminism is FAIL.

**STOP R1:** On FAIL, stop TASK-187/198 onward for HUMAN review; do not change matching semantics or add a provider to bypass the gate.

### TASK-187 — Gate R2: Verify the Authorized Integrated Frontend Path

**Status:** `PENDING — ACTIVE REPLACEMENT GATE` (old Azure Gate C not started and retired)

**Objective/scope:** Prove the authorized Learning-to-transient-feedback path using deterministic browser fakes before deep UI work.

**Dependencies:** Gate R1 PASS; TASK-192, TASK-197, TASK-198, TASK-199, TASK-200.

**Work/evidence required:** Authenticated public System Set and owned private Set; foreign private denial; empty Set; exact ordered/same-spelling distinct IDs; no client target substitution; reference playback stopped before Speak; fake primary/alternative/no-match/inconclusive results; retry/navigation cleanup; no cross-target stale outcome; no `recordMeaningfulEvent`, persistence, audio upload, speech endpoint, Progress/SRS/XP/gamification mutation.

**PASS/FAIL:** PASS when every path is deterministic, authorized by the existing Backend read, transient, and side-effect-free. Any identity/auth/stale/write violation is FAIL.

**STOP R2:** On FAIL, stop UI checkpoint/full implementation for HUMAN review; no Backend recognition substitute is authorized.

### TASK-188 — Gate R3: Obtain HUMAN UI/UX Direction Approval

**Status:** `PENDING — HUMAN GATE`

**Objective/scope:** Present a focused responsive direction before final UI implementation.

**Dependencies:** Gate R2 PASS.

**Work/evidence required:** Mockups or focused non-final evidence for distinct Listen/Speak; playback/TTS coordination; disclosure; loading/ready/starting/listening/finalizing; all four outcomes; permission/network/unsupported fallbacks; retry/previous/next/skip/exit; no pronunciation claims; keyboard/focus/live regions/reduced motion; desktop/tablet/mobile layouts.

**PASS/FAIL:** PASS only by explicit HUMAN approval. Comments requiring material revision mean pending/FAIL until re-reviewed.

**STOP R3:** No TASK-201–204 final UI work before approval.

## 6. Foundation Implementation Tasks

### TASK-189 — Implement the Pure Recognition Classifier

**Status:** `PENDING — ACTIVE`

**Objective/scope:** Promote spike behavior into maintained frontend code without importing production behavior from `spikes/`.

**Dependencies:** HUMAN TASK approval.

**Work:** Create the scoped classifier. Apply NFC, trim, leading/trailing contiguous Unicode `\p{P}` removal, second trim, `toLocaleLowerCase("en-US")`; preserve internal punctuation; reject missing target/no usable primary; bound five alternatives; discard malformed/empty candidates; de-duplicate later normalized duplicates without promoting an unusable raw primary; validate confidence only in `[0,1]`; return four transient outcomes.

**Evidence:** Focused unit tests including plural, substring, fuzzy/edit-distance exclusions and alternative uncertainty.

**PASS/FAIL:** PASS when classification exactly matches SPEC/PLAN and confidence never affects it. Any score/phonetic/fuzzy behavior is FAIL.

**STOP:** Contract ambiguity or required semantic change returns to HUMAN PLAN/SPEC review.

### TASK-190 — Implement the Injectable SpeechRecognition Adapter

**Status:** `PENDING — ACTIVE`

**Objective/scope:** Isolate native recognition capability and browser-specific events.

**Dependencies:** HUMAN TASK approval.

**Work:** Detect secure context and standard/prefixed constructors; configure `en-US`, `continuous=false`, `interimResults=false`, `maxAlternatives=5`; expose guarded start/stop/abort/dispose; bound alternatives; map native errors to stable codes; map a synchronous exception thrown by native `start()` to `START_FAILED`; detach handlers; support injected constructor/events/clock. No `getUserMedia`, Blob, upload, or direct vendor request.

**Evidence:** Fake-constructor tests for configuration, unsupported/insecure, synchronous method errors, stable error mapping, disposal, and API presence without service guarantee.

**PASS/FAIL:** PASS when tests are deterministic and native strings do not leak to UI/logs. Real service dependency or upload is FAIL.

**STOP:** Browser incompatibility requiring changed approved configuration returns to HUMAN review.

### TASK-191 — Implement Attempt Ownership, Stop/Abort, and Watchdogs

**Status:** `PENDING — ACTIVE`

**Objective/scope:** Provide one-terminal deterministic lifecycle behavior with no stuck controls.

**Dependencies:** TASK-190.

**Work:** Track attempt token, Set ID, Vocabulary ID, session generation, phase, terminal flag, recognizer, and timers. Implement compare-and-set settlement, invalidation, cleanup, and legal transitions.

**Watchdog contract:**

- A synchronous exception from native `start()` settles immediately as `INCONCLUSIVE/START_FAILED`; because `start()` did not return successfully, the startup watchdog is not armed.
- Arm startup watchdog immediately after native `start()` returns successfully. Duration: **5,000 ms**. Cancel on accepted start/listening evidence, valid terminal result/error/end, abort/invalidation, or dispose. Watchdog expiration yields `INCONCLUSIVE/START_TIMEOUT`, atomically settles/invalidate ownership, then aborts/disposes.
- Arm finalization watchdog immediately after an accepted intentional native `stop()` call. Duration: **4,000 ms**. Cancel on usable final result, terminal error/end, abort/invalidation, or dispose. Timeout yields `INCONCLUSIVE/FINALIZATION_TIMEOUT`, atomically settles/invalidate ownership, then aborts/disposes.
- `end` without usable result settles immediately as `INCONCLUSIVE/NO_RESULT`.
- Result versus timeout uses the single atomic terminal guard: whichever valid callback settles first wins. Timeout cannot overwrite a result; late result after timeout is ignored.
- Cancellation, retry, target change, route exit, logout, and unmount invalidate ownership first, clear both timers, then abort/dispose.

These are UI recovery bounds, not recording limits, scores, or responsiveness guarantees.

**Named evidence tests:** `stop allows delayed valid result`; `end without result`; `error then end`; `abort ignores stale result`; `result ignores duplicate end`; `rapid Start/Stop`; `retry after result`; `retry after error`; `target change while listening`; `logout during recognition`; `unmount while finalizing`; `startup watchdog expires`; `finalization watchdog expires`; `result immediately before timeout wins`; `result after timeout stays stale`. Every test asserts unique terminal settlement and cleanup.

**PASS/FAIL:** PASS when fake-timer tests prove all ordering and recovery paths with no stuck state. Duplicate outcomes, leaked timers, or resurrected attempts are FAIL.

**STOP:** If 5,000/4,000 ms proves unsuitable, stop for HUMAN PLAN review; do not silently change it.

### TASK-192 — Coordinate Reference Playback and Recognition

**Status:** `PENDING — ACTIVE`

**Objective/scope:** Prevent ELVocab reference audio/TTS from intentionally feeding the learner recognition attempt.

**Dependencies:** TASK-190, TASK-191.

**Work:** Maintain playback ownership generation. Speak invalidates pending playback, pauses/clears `Audio`, cancels TTS, then starts recognition only under current ownership. Listen is disabled in STARTING/LISTENING/FINALIZING. Defensive playback races invalidate/abort recognition before playback. Target change/unmount cleans both systems; stale play promises/events cannot restart playback or mutate current target.

**Evidence:** Deterministic stored-audio and TTS tests for no auto recognition, stop-before-start ordering, disabled Listen, defensive race, target change, and unmount.

**PASS/FAIL:** PASS when ordering/cleanup are proven. Any ELVocab playback overlap or stale restart is FAIL.

**STOP:** Do not claim isolation from external apps, speakers, echo, or environmental audio.

### TASK-193 — Retire the Azure Provider Adapter Work

**Status:** `RETIRED — NOT EXECUTED`

**Objective/scope:** Record that the former Azure adapter task is unnecessary.

**Dependencies:** Approved architecture amendment.

**Disposition/evidence:** No Azure code, credential, live call, DTO, or replacement provider is implemented. Verify final diff contains none.

**PASS/FAIL:** PASS as a retirement record when scope scans remain clean; any provider work is FAIL.

**STOP:** A server/provider proposal requires new HUMAN-approved SPEC/PLAN/TASK.

### TASK-194 — Prepare and Implement Presentation Mapping and Stable Recovery Copy

**Status:** `PENDING — ACTIVE`

**Objective/scope:** Separate pre-Gate-R3 presentation preparation from post-approval learner-facing implementation so the UI checkpoint can review proposed copy without creating a circular dependency.

**Dependencies:** Phase A requires TASK-189 and Gate R2 PASS. TASK-188 depends on Phase A evidence. Phase B requires explicit Gate R3 approval.

**Work:**

- **Phase A — pre-R3 preparation:** Define the proposed mapping from transient classifications/issues to the approved Vietnamese primary/alternative/no-match copy and proposed actionable recovery copy for unsupported, insecure, permission/service denial, no speech, audio capture, network, aborted, no-result, `START_FAILED`, `START_TIMEOUT`, `FINALIZATION_TIMEOUT`, and generic errors. Produce fixture/mapping evidence for TASK-188 review; do not implement final learner-facing presentation.
- **Phase B — post-R3 implementation:** After explicit Gate R3 approval, implement the approved mapping and copy. Alternative remains uncertain; primary transcript may display; full alternatives/confidence remain hidden from ordinary UI.

**Evidence:** Phase A mapping/copy review attached to the Gate R3 checkpoint; Phase B fixture-driven tests showing the approved mapping and no pronunciation-quality, PASS/FAIL, score, or raw browser error claim.

**PASS/FAIL:** Phase A is ready when every stable issue has proposed truthful recovery for HUMAN review. TASK-194 is complete only when Gate R3 is approved and Phase B tests pass. Misleading pronunciation claims or implementation before approval are FAIL.

**STOP:** New assessment/scoring semantics return to SPEC review.

### TASK-195 — Retire Backend Evaluation Service and Cost Guard Work

**Status:** `RETIRED — NOT EXECUTED`

**Objective/scope:** Record retirement of former Azure orchestration/rate-limit work.

**Dependencies:** Approved architecture amendment.

**Disposition/evidence:** No backend speech service, provider retry, concurrency/cost limiter, secret, or environment variable. Verify final diff/config.

**PASS/FAIL:** PASS when absent; any such addition is FAIL.

**STOP:** Do not add distributed or process-local speech guards for a nonexistent Backend call.

### TASK-196 — Retire the Pronunciation Evaluation Endpoint

**Status:** `RETIRED — NOT EXECUTED`

**Objective/scope:** Record retirement of former multipart endpoint work.

**Dependencies:** Approved architecture amendment.

**Disposition/evidence:** No `POST /api/pronunciation/evaluate`, multipart middleware, audio validation/parser, controller, repository, or persistence. Later API documentation retires the conceptual endpoint.

**PASS/FAIL:** PASS when route/app scans confirm absence. Any new speech endpoint/upload is FAIL.

**STOP:** Backend contract changes require HUMAN-approved workflow.

### TASK-197 — Verify Learning Authorization, Identity, and Read-Only Boundaries

**Status:** `PENDING — ACTIVE`

**Objective/scope:** Establish the existing Backend/API boundary reused by Speaking Practice.

**Dependencies:** HUMAN TASK approval; safe dedicated TEST configuration for database-backed cases.

**Work/evidence:** Focused existing tests for NORMAL public/owned access, foreign-private denial, empty Set, exact order, same-spelling distinct IDs, server words, and read-only behavior; frontend service response validation. Prove no client-authoritative target and no feature writes.

**PASS/FAIL:** PASS when existing contract supports the approved flow without modification and no data changes occur. Contract gap or unsafe test environment is FAIL.

**STOP:** Do not run the known unsafe shared-database reset path. Any required API change returns to PLAN/HUMAN review.

## 7. Integrated Frontend Tasks

### TASK-198 — Compose the Speaking Practice State Controller

**Status:** `PENDING — ACTIVE`

**Objective/scope:** Combine classifier, adapter, watchdog lifecycle, playback coordination, and transient state without UI styling.

**Dependencies:** Gate R1 PASS; TASK-192, TASK-197.

**Work:** Implement LOADING, READY, DISCLOSURE, UNSUPPORTED, INSECURE_CONTEXT, STARTING, LISTENING, FINALIZING, RESULT, INCONCLUSIVE, RECOVERABLE_ERROR, CANCELLING, INACCESSIBLE, EMPTY. Derive controls from state; no auto retry/history; clear result on target change; preserve attempt ownership.

**Evidence:** Reducer/controller tests for legal/illegal transitions, every issue, side-effect spies, and disposal.

**PASS/FAIL:** PASS when state is deterministic and no write/upload API is invoked. Ad hoc parallel flags or stale mutation is FAIL.

**STOP:** State behavior outside approved SPEC/PLAN requires HUMAN review.

### TASK-199 — Add the USER Route and Authorized NORMAL Load

**Status:** `PENDING — ACTIVE`

**Objective/scope:** Add `/pronunciation/vocabulary-sets/:setId` and load exact targets through `learningService` NORMAL mode.

**Dependencies:** TASK-198.

**Work:** Add protected USER route and focus-shell handling; preserve `returnTo`; load/validate existing payload; select exact ordered cards; handle auth/not-found/empty/error; never call `recordMeaningfulEvent`.

**Evidence:** Focused route/load tests for public/owned/foreign/empty/order/same-spelling IDs and protected role behavior.

**PASS/FAIL:** PASS when authorization remains Backend-owned and no new API exists. Client target substitution or Progress write is FAIL.

**STOP:** Any payload/API incompatibility returns to HUMAN review.

### TASK-200 — Complete Navigation and Page Lifecycle Cleanup

**Status:** `PENDING — ACTIVE`

**Objective/scope:** Make retry, previous, next, skip, exit, logout, route change, unmount, and relevant page lifecycle interruption safe.

**Dependencies:** TASK-198, TASK-199.

**Work:** Invalidate/abort recognition and playback before target/context changes; maintain ordered cursor; clear transient results; ignore late events; preserve exit return behavior; never automatically restart recognition.

**Evidence:** Deterministic lifecycle tests including background/visibility behavior supported by project conventions.

**PASS/FAIL:** PASS when no resource/event crosses context and controls recover. Any stale result/audio restart is FAIL.

**STOP:** Browser lifecycle limitation causing product contract change requires HUMAN review.

### TASK-201 — Add the Third Set Detail Activity Entry

**Status:** `PENDING — ACTIVE`

**Objective/scope:** Add Speaking Practice beside Flashcard and Quiz for eligible non-empty Sets.

**Dependencies:** Gate R3 approval; TASK-199.

**Work:** Extend existing `LearningCard` grid to responsive three-card layout; use approved route/return state and semantic control; preserve existing destinations and empty disabled behavior.

**Evidence:** Component/browser checks at desktop/tablet/mobile widths plus Flashcard/Quiz regression.

**PASS/FAIL:** PASS when entry is reachable, responsive, and existing cards unchanged. Overflow/regression is FAIL.

**STOP:** Unrelated Set Detail redesign is prohibited.

### TASK-202 — Implement the Core Listen/Speak Interaction UI

**Status:** `PENDING — ACTIVE`

**Objective/scope:** Build HUMAN-approved target, playback, disclosure, Speak, listening, finalizing, and navigation UI.

**Dependencies:** Gate R3 approval; TASK-194, TASK-199, TASK-200.

**Work:** Separate Listen/Speak; disclosure before first microphone use; explicit start; textual active status; intentional stop; pending/disabled controls; retry/previous/next/skip/exit; no waveform/score/confidence/phoneme/PASS UI.

**Evidence:** Focused component/browser tests from ready through finalizing and navigation cleanup.

**PASS/FAIL:** PASS when behavior matches approved checkpoint and reference playback never starts recognition. Any automatic capture or scoring UI is FAIL.

**STOP:** Material UI direction change returns to HUMAN checkpoint.

### TASK-203 — Implement Outcomes and Recovery UI

**Status:** `PENDING — ACTIVE`

**Objective/scope:** Present four outcomes and actionable browser/runtime fallbacks truthfully.

**Dependencies:** TASK-194, TASK-202.

**Work:** Render primary match, uncertain alternative, no match, and issue-specific inconclusive states; show primary transcript only when approved/safe; retain reference/retry/navigation; never display confidence as learner score or diagnose pronunciation.

**Evidence:** Fixture-driven tests for every classification/issue and copy assertions.

**PASS/FAIL:** PASS when all recovery paths remain useful and penalty-free. Alternative-as-success or pronunciation claim is FAIL.

**STOP:** New outcome semantics return to SPEC review.

### TASK-204 — Complete Accessibility and Responsive Behavior

**Status:** `PENDING — ACTIVE`

**Objective/scope:** Make full flow usable without pointer, color, waveform, or animation dependence.

**Dependencies:** TASK-202, TASK-203.

**Work:** Native controls, visible focus, keyboard flow, terminal focus placement, concise live regions without interim transcript spam, disabled/pending semantics, reduced motion, touch targets, fallback navigation, no focus trap/overflow, perceivable disclosure.

**Evidence:** Keyboard/focus/live-region assertions, automated accessibility checks where supported, reduced-motion and desktop/tablet/mobile layout checks.

**PASS/FAIL:** PASS when every state and recovery path is accessible at target widths. Blocking accessibility/overflow issue is FAIL.

**STOP:** Must-fix accessibility failures block later gates.

## 8. Verification, Cleanup, and Real-World Evidence

### TASK-205 — Consolidate Deterministic Unit Coverage

**Status:** `PENDING — ACTIVE`

**Objective/scope:** Complete maintained coverage for pure modules and lifecycle behavior.

**Dependencies:** TASK-189–204 as applicable.

**Work/evidence:** Exact commands/counts for classifier, adapter, watchdog named tests, state/controller, playback coordination, presentation mapping, navigation, timer/handler cleanup; migrate/preserve the 7/7 spike intent without counting it as production coverage; touched frontend lint/diff.

**PASS/FAIL:** PASS when all deterministic paths pass without device/vendor access. Flake, leak, or missing named ordering case is FAIL.

**STOP:** Failures return to the owning implementation task.

### TASK-206 — Complete Mocked Browser and Cross-Feature Regression Coverage

**Status:** `PENDING — ACTIVE`

**Objective/scope:** Verify integrated behavior with fake SpeechRecognition and the directly relevant regression boundary.

**Dependencies:** TASK-201–205; Gate R2 already PASS.

**Work/evidence:** Mocked primary/alternative/no-match/inconclusive, permissions/errors, stop/abort/watchdogs/stale events, disclosure, keyboard/focus/live regions, responsive widths, route/identity; directly relevant Learning, Flashcard audio, Quiz navigation/interactions, Set Detail, protected-route regressions; production build, touched lint, diff check. No real microphone/service.

**PASS/FAIL:** PASS when focused suites/build/lint/diff pass and no leaked processes remain. Relevant regression is FAIL.

**STOP:** Do not broaden to unsafe shared-database reset suites unless separately justified and approved.

### TASK-207 — Gate R4: HUMAN-Authorized Chrome Desktop and HTTPS Verification

**Status:** `PENDING — HUMAN GATE`

**Objective/scope:** Verify actual browser permission/recognition after deterministic coverage, first on an authorized local secure context where available and finally on the matching deployed HTTPS revision.

**Dependencies:** The local evidence checkpoint requires TASK-206 PASS and explicit HUMAN authorization before real microphone use. Final Gate R4 PASS additionally requires TASK-214 Phase A provisional integration and an available matching deployed/production-equivalent HTTPS environment.

**Work/evidence:** Record Chrome/OS/version; permission grant/denial; start, intentional stop/final result; representative match, mismatch, inconclusive; retry; abort/navigation/unmount; reference playback coordination; production frontend build; deployed HTTPS and secure-context behavior. Localhost evidence may support TASK-209–TASK-213 source readiness but must identify deployed HTTPS as `PENDING`. Retained evidence excludes raw audio, transcript/confidence logs, and identity.

**PASS/FAIL:** The local checkpoint passes when the applicable HUMAN-operated Chrome behavior is verified and its environment is recorded; that is not Gate R4 PASS. Gate R4 PASS requires baseline behavior and cleanup in real Chrome desktop on the matching deployed secure context. A verified build/deployment/critical lifecycle violation is FAIL; unavailable mandatory infrastructure is BLOCKED.

**STOP R4:** Without HUMAN authorization remain PENDING and make no real microphone call. Before TASK-214 Phase A, deployed HTTPS remains PENDING rather than blocking source-level formalization. On FAIL, stop final closure for HUMAN review; do not add a provider workaround.

#### HUMAN-Approved Pre-Gate-R4 Closure Workflow

**Phase 1 — Local source closure:** TASK-209–TASK-211 may proceed from TASK-208 PASS and verified localhost/mock/real-browser evidence while deployed HTTPS Gate R4 remains explicitly `PENDING`. TASK-212 and TASK-213 may issue source-level PASS/APPROVE verdicts only; those verdicts do not satisfy deployment acceptance, Gate R4, final feature acceptance, or TASK-214 PASS.

**Phase 2 — Conditional Git integration:** After HUMAN accepts TASK-212 source-level PASS and TASK-213 source-level APPROVE, a separate HUMAN Git authorization may activate TASK-214 Phase A. Phase A permits exactly one reviewed Speaking Practice V1 feature-branch commit and push, followed by integration into `dev` through the established workflow, solely to trigger existing GitHub Actions CI and matching Frontend/Backend Vercel Preview deployments. Before any Git/network operation, verify remote ancestry, exact file allowlist, rollback plan, secrets/environment exclusion, required checks, unrelated stash preservation, and CI/local-versus-Preview database isolation. No Production or `main` deployment is authorized.

**Phase 3 — HTTPS acceptance:** HUMAN performs the unchanged TASK-207 Gate R4 criteria against the matching deployed FE/BE revision in a secure HTTPS context. Gate R4 remains `PENDING` until that evidence exists. CI/deployment success alone is not Gate R4 PASS. A failure keeps V1 acceptance pending and returns only the proven blocker to its owning workflow.

**Preservation:** TASK-208 acceptance remains valid. TASK-214 remains the only authority for provisional integration and final Git/status closure; Phase A is recorded as `PROVISIONALLY INTEGRATED`, never PASS. The historical Web Speech spike and seven-test harness remain retained outside maintained totals. The database-mutating guarded manual review fixture is excluded from the provisional commit unless separately reviewed and authorized.

**PASS/FAIL/BLOCKED:** Phase 1 is source-ready only when its applicable evidence passes and HTTPS is truthfully pending. Phase 2 is provisionally integrated only when the authorized Git/CI/deployment preconditions pass. Phase 3 PASS requires every original Gate R4 criterion. Missing authorization or unavailable required infrastructure is BLOCKED; a verified contract violation is FAIL.

**STOP:** Stop on missing authorization, incompatible ancestry, unexpected files, absent rollback evidence, failed checks, revision/routing/configuration mismatch, unproven database isolation, unavailable secure context, or Gate R4 failure. Do not reset, force-push, rewrite history, bypass tests, change provider architecture, deploy Production/`main`, or claim final completion.

### TASK-208 — Resolve and Remove Obsolete FFmpeg Artifacts Safely

**Status:** `HUMAN ACCEPTED — cleanup complete; old Gate A2 RETIRED`

**Objective/scope:** Remove obsolete `ffmpeg-static@5.3.0` production dependency only after preserving history and approving harness disposition.

**Dependencies:** TASK-206 PASS; Gate A1 evidence preserved; HUMAN decision if harness archive/retirement disposition is not already explicit.

**Work:** Search all imports/dependencies; confirm no legitimate consumer; preserve TASK-185 facts; classify executable Gate A1 harness as clearly historical/archive or retire/remove it after evidence preservation; remove package and lockfile references consistently; change no unrelated dependency.

**Evidence:** Dependency/import scans, lockfile consistency, dependency absence, focused tests, backend/frontend production builds as relevant, touched lint, `git diff --check`, historical evidence review.

**PASS/FAIL:** PASS when obsolete runtime dependency is absent, builds/tests pass, and history remains. Any remaining consumer, lock inconsistency, lost evidence, or unrelated dependency change is FAIL.

**STOP:** If harness disposition lacks HUMAN approval or another consumer exists, stop; do not remove it. Do not execute legacy Gate A2.

### TASK-209 — Record Real Browser/Device Support Evidence

**Status:** `PENDING — ACTIVE EVIDENCE`

**Objective/scope:** Distinguish responsive UI, runtime API capability, and verified real recognition.

**Dependencies:** TASK-208 PASS and the available TASK-207 localhost/real-browser evidence. Deployed HTTPS Gate R4 may remain `PENDING` for the source checkpoint. Representative devices/environments remain subject to availability.

**Work/evidence:** Chrome desktop baseline plus separately recorded Android Chrome and iOS Safari/browser checks when available; exact device, OS, browser/version, constructor, secure context, permission, event ordering, outcomes, navigation cleanup, responsive layout. Record PASS/FAIL/UNSUPPORTED/NOT AVAILABLE honestly.

**PASS/FAIL:** Source-checkpoint PASS requires a truthful localhost/browser matrix with deployed HTTPS clearly `PENDING`; it is not final TASK-209 completion. Final PASS requires the unchanged Gate R4 Chrome/HTTPS baseline plus the truthful support matrix. Mobile absence is not silently converted to PASS and requires HUMAN acceptance of limitations before support claims/closure.

**STOP:** Material incompatibility or requested support claim without evidence returns to HUMAN review.

## 9. Documentation, Formal TEST, REVIEW, and Closure

### TASK-210 — Reconcile Verified Documentation

**Status:** `PENDING — ACTIVE`

**Objective/scope:** Synchronize official docs with implemented/verified behavior only.

**Dependencies:** TASK-209 source checkpoint for provisional source documentation; TASK-209 final PASS or explicitly HUMAN-accepted limitations for final reconciliation.

**Work:** Update PROJECT_OVERVIEW, ARCHITECTURE, API_SPEC, UI_UX_SPEC, FEATURE_STATUS (`IN_PROGRESS`, not DONE), and DATABASE only if no-persistence clarification is needed. During source closure, record deployed HTTPS Gate R4 as `PENDING`. Record browser recognition, Learning reuse, no endpoint/schema/persistence/progress, support evidence, privacy, retired Azure/FFmpeg path, and historical Gate A1 truthfully. Final status reconciliation occurs only after every mandatory gate passes.

**Evidence:** Cross-document comparison, link/path check, secret/transcript scan, diff check.

**PASS/FAIL:** PASS when no active Azure/scoring/endpoint contradiction or unverified support claim remains. Drift is FAIL.

**STOP:** Documentation cannot legitimize unapproved behavior.

### TASK-211 — Run Consolidated Pre-Formal Verification

**Status:** `PENDING — ACTIVE`

**Objective/scope:** Assemble reproducible evidence before independent formal TEST.

**Dependencies:** TASK-210.

**Work/evidence:** Gates R1–R3 plus available Gate R4 localhost evidence, focused unit/browser/backend regressions, production builds, touched lint, diff/secret/transcript-log scans, no persistence/progress proof, cleanup/dependency proof, device/support matrix, clean process/worktree/stash inventory. Source verification must list deployed HTTPS Gate R4 as `PENDING`. After deployment, verify the CI/deployment delta and completed Gate R4 evidence. Avoid unsafe shared reset paths.

**PASS/FAIL:** Source-level PASS requires every locally applicable check to pass, accepted limitations to be explicit, no unexpected files/processes, and HTTPS Gate R4 to be truthfully pending. Final closure PASS additionally requires CI and Gate R4 PASS. A failed applicable check is FAIL; unavailable mandatory evidence is BLOCKED.

**STOP:** Any failure returns to the owning implementation/verification task.

### TASK-212 — Perform Formal TEST

**Status:** `PENDING — FORMAL GATE`

**Objective/scope:** Apply `.agents/skills/test/SKILL.md` independently to SPEC AC-01–AC-24 and approved PLAN/TASK evidence; do not fix during TEST.

**Dependencies:** TASK-211 PASS.

**Evidence:** AC traceability matrix, exact commands/results, scope/privacy/auth/accessibility/device limitations, and a verdict explicitly scoped as source-level or final.

**PASS/FAIL:** Source-level PASS is permitted when all source-applicable criteria have objective evidence and deployed HTTPS criteria are explicitly `PENDING`; it is not overall feature PASS. Final PASS requires the deployment delta and every mandatory Gate R4 criterion. A verified violation is FAIL; missing mandatory evidence is BLOCKED.

**STOP:** HUMAN must accept the explicitly scoped TEST verdict before TASK-213. FAIL returns to IMPLEMENT and relevant retest. Source-level PASS does not authorize Git operations without separate HUMAN authorization.

### TASK-213 — Perform Formal REVIEW

**Status:** `PENDING — FORMAL GATE`

**Objective/scope:** Apply `.agents/skills/review/SKILL.md` to the source diff, scope, architecture, privacy, accessibility, tests, docs, historical evidence, and cleanup; review the deployment delta separately before final closure when required.

**Dependencies:** TASK-212 PASS accepted by HUMAN.

**Evidence:** Severity-ranked findings and `APPROVE`, `APPROVE WITH NOTES`, or `REQUEST CHANGES` verdict.

**PASS/FAIL:** Source-level APPROVE/APPROVE WITH NOTES without must-fix items establishes source readiness only. Final closure readiness additionally requires Gate R4 PASS and approval of any deployment-evidence delta. REQUEST CHANGES is FAIL for the reviewed checkpoint; missing mandatory evidence is BLOCKED.

**STOP:** REQUEST CHANGES returns to IMPLEMENT/TEST/REVIEW. Source approval requires separate HUMAN Git authorization before TASK-214 Phase A and cannot be reported as final feature approval.

### TASK-214 — Perform HUMAN-Authorized Closure and Git Integration

**Status:** `PENDING — HUMAN CLOSURE GATE`

**Objective/scope:** Own both the narrowly bounded provisional integration needed to obtain matching HTTPS evidence and the final Git/status closure after every gate passes.

**Dependencies:** Phase A requires HUMAN-accepted TASK-212 source-level PASS, TASK-213 source-level APPROVE, and separate explicit HUMAN Git authorization. Phase B requires CI PASS, matching deployed FE/BE identity, Gate R4 PASS, final evidence/status reconciliation, approval of any deployment delta, and explicit HUMAN closure authorization.

**Phase A work/evidence:** Confirm the reviewed Speaking-only allowlist; exclude secrets/environment files and the guarded database-mutating manual fixture unless separately approved; preserve the historical Web Speech spike; verify remote ancestry, rollback plan, required checks, Preview database isolation, and unchanged unrelated `stash@{0}`; create/push one reviewed feature-branch commit; integrate through the established `dev` workflow; push `dev` to trigger existing CI and Vercel Preview. No Production/`main`, force push, reset, history rewrite, CI workflow change, or Vercel configuration change.

**Phase B work/evidence:** After CI and Gate R4 PASS, reconcile final evidence and status, run required deployment-delta TEST/REVIEW confirmation, perform any separately authorized final closure commit/push, and verify hashes, ancestry, worktree ownership, and unchanged stash.

**PASS/FAIL:** Phase A success is recorded only as `PROVISIONALLY INTEGRATED`. TASK-214 PASS requires Phase B, all mandatory gates, documented hashes/pushes/ancestry, final status accuracy, preserved worktree ownership, and stash identity. A verified mismatch is FAIL; missing authorization or required infrastructure is BLOCKED.

**STOP:** Any incompatible ancestry, unexpected file, missing rollback plan, failed check, revision/routing/database-isolation mismatch, Gate R4 failure, or missing authorization stops the relevant phase. Do not report Phase A as final closure.

## 10. Acceptance-Criteria Traceability

| SPEC criteria | Primary tasks |
|---|---|
| AC-01–AC-04 | TASK-197, TASK-199, TASK-201, TASK-202, TASK-206 |
| AC-05–AC-08 | TASK-190–TASK-192, TASK-198–TASK-202, TASK-206 |
| AC-09–AC-14 | TASK-186, TASK-189, TASK-194, TASK-203, TASK-205–TASK-207 |
| AC-15–AC-17 | TASK-191, TASK-198, TASK-200, TASK-205–TASK-207 |
| AC-18–AC-19 | TASK-188, TASK-201–TASK-204, TASK-206, TASK-209 |
| AC-20–AC-21 | TASK-193, TASK-195–TASK-197, TASK-208, TASK-211 |
| AC-22–AC-24 | TASK-184, TASK-205–TASK-213 |

## 11. Mandatory STOP Summary

1. HUMAN approval of this amended TASK is required before any active task.
2. Gate R1 must PASS before integration; Gate R2 before UI direction; Gate R3 requires explicit HUMAN approval before final UI.
3. Real microphone use in Gate R4 requires explicit HUMAN authorization.
4. FFmpeg harness disposition must be authorized before removal if not already explicit.
5. Mobile recognition cannot be claimed verified without exact real-device evidence.
6. Formal TEST PASS requires HUMAN acceptance before REVIEW.
7. Formal REVIEW closure readiness requires explicit HUMAN closure authorization before Git/status closure.
8. Any required scope, API, schema, provider, matching, privacy, or architecture change returns to SPEC/PLAN/TASK approval.

## 12. Deferred / Non-Blocking Items

- Phonetic/acoustic scoring, phonemes, PASS/FAIL, bands, accent diagnosis, or certified assessment.
- Audio/transcript/attempt/result history and analytics.
- Progress/SRS/gamification coupling.
- Sentences, conversation, teacher review, or server-side/provider recognition.
- Browser/device support claims not backed by real evidence.
- Shared notification/toast refactor.

Creation of this TASK artifact authorizes no implementation, cleanup, microphone use, dependency change, commit, or push. STOP for HUMAN TASK review.
