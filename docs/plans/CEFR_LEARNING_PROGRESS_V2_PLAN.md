# PLAN: CEFR Learning Progress V2

**Source SPEC:** `docs/specs/CEFR_LEARNING_PROGRESS_V2_SPEC.md`

**SPEC approval:** `HUMAN APPROVED — 2026-11-12`

**Approved decisions:** `HD-V2-01` through `HD-V2-09`

**PLAN status:** `HUMAN APPROVED — 2026-11-12`

**TASK authorized:** `YES — DRAFT TASK AUTHORING ONLY`

**Implementation authorized:** `NO`

This document defines the HUMAN-approved implementation approach for the approved SPEC. Approval authorizes drafting the V2 TASK document only; it does not authorize source or test changes, Prisma schema edits, migration creation or execution, database access, dependency installation, CI, commit, push, merge or deployment.

## 1. Technical Objective and Boundaries

Extend the existing CEFR Learning Path V1 implementation so one active pass accumulates immutable first-credit evidence from either:

- an accepted pass-linked NORMAL reveal; or
- an accepted rating in a pass-linked CEFR-scoped SRS session, including `AGAIN`.

The implementation must preserve these boundaries:

- One pass owns one immutable ordered Set snapshot.
- One pass item contributes at most one CEFR credit.
- NORMAL, CEFR-scoped SRS or a mixture of both may cover the snapshot.
- Every Learning Session remains bounded to at most ten distinct items.
- Pass readiness and Learning Session resolution remain separate.
- Final Set completion remains an explicit USER operation.
- Existing earned entitlement is monotonic and C1 remains terminal.
- Ordinary SET SRS, Review Center, GLOBAL SRS, Quiz and Speaking do not provide CEFR credit.
- Existing SRS scheduling, revision, replay, Progress, reward, XP and Streak behavior remains authoritative.
- A completed Set supports a fresh independent NORMAL run without creating another pass.
- Dashboard Current Learning is simplified rather than expanded with analytics.

The implementation must not introduce a general learning-history product, a second scheduler, C2, mastery scoring, new roles, new dependencies, new external services or unrelated performance work.

Affected layers are limited to the existing Prisma data model and one additive migration, learning-path/session/SRS backend modules, their API projections, the Set Learning and Dashboard frontend flows, focused tests and synchronized active documentation.

## 2. V1 Compatibility and Migration Strategy

### 2.1 Contracts retained unchanged

- Existing pass identity, immutable Set snapshot, one active and one completed pass per USER/Set, restart and explicit completion operations remain.
- Existing A1–C1 current-curriculum projection, deterministic Set ordering, historical completion and monotonic entitlement remain.
- Existing seven-day Learning Session lifetime, fixed one-to-ten-item session snapshot, replay identities and session completion/Streak rules remain.
- Existing ordinary SET/SRS and GLOBAL/SRS candidate selection remains due/eligibility based.
- Existing SRS scheduler, rating transitions, receipt/revision checks and reward rules remain the only rating mutation logic.
- Existing NORMAL session completion continues to require all session items revealed and remains the Streak boundary.
- Existing authorization for public unlocked Sets and USER-owned private/copied Sets remains.
- Existing Quiz and Speaking contracts receive no CEFR evidence integration.

### 2.2 Intentional V2 changes

- Pass progress reads canonical first-credit fields instead of reconstructing evidence only from completed NORMAL sessions.
- A pass-linked NORMAL reveal credits its exact pass item in the same transaction as reveal acceptance.
- `LEARNING_SESSION.cefr_learning_pass_id` may identify a SET/NORMAL or SET/SRS session.
- Pass-session creation accepts optional `mode`; omission remains compatible as `NORMAL`.
- CEFR-scoped SRS selects remaining pass items rather than ordinary due candidates.
- Every accepted CEFR-scoped SRS rating can supply first credit; `AGAIN` remains unresolved in the session.
- Multiple compatible NORMAL/SRS sessions may remain active for one pass, with first-credit deduplication.
- Current Learning removes its numeric fraction and progress bar initially.
- Explicit completed-Set NORMAL relearning clears only stale presentation/session state for that independent intent.

### 2.3 Deployment compatibility

The migration is additive before V2 traffic:

1. Add nullable pass-item first-credit fields and their integrity constraints.
2. Relax only the pass/session mode constraint from SET/NORMAL to SET/NORMAL-or-SRS.
3. Backfill exact valid V1 pass-linked NORMAL evidence.
4. Verify that pass status and entitlement data did not change.
5. Deploy backend readers/writers that use the new fields.
6. Deploy frontend consumers after the additive API is available.

The old application can continue reading existing columns after the additive migration. V2 backend deployment must not occur before the migration because it depends on the new pass-item fields and relaxed constraint.

The authorized rollout procedure must guarantee that no V1 learning write is accepted between the backfill snapshot and activation of the V2 backend writer. A bounded write-quiescent cutover is the shortest safe path. If the deployment platform cannot guarantee that boundary, rollout must stop and return for a separately reviewed multi-release compatibility design; it must not accept a gap that could leave a valid late V1 reveal unbackfilled.

No compatibility window may dual-write two competing definitions of pass progress. Once the V2 backend is active, first-credit fields are canonical.

## 3. Existing Implementation Inventory

### 3.1 Persistence and migration foundation

- `backend/prisma/schema.prisma`
  - Reuse `CEFR_LEARNING_PASS`, `CEFR_LEARNING_PASS_ITEM`, `CEFR_LEARNING_PATH_STATE`, `LEARNING_SESSION`, `LEARNING_SESSION_ITEM` and `LEARNING_SESSION_SRS_RECEIPT`.
- `backend/prisma/migrations/20261103000000_add_cefr_learning_path_v1/migration.sql`
  - Preserve V1 pass/status/index design; supersede only the pass-linked NORMAL-only check through a new migration.
- `backend/test/learning/cefr-learning-path-migration-safety.test.js`
- `backend/test/learning/cefr-learning-path-migration-harness.js`
- `backend/test/learning/cefr-learning-path-migration-integration.test.js`
  - Reuse the established static and isolated PostgreSQL migration-safety patterns after later authorization.

### 3.2 Learning Path backend

- `backend/src/repositories/learning-path-repository.js`
  - Extend `PASS_SELECT`, owned/pass locks, active-session reads and pass projections with canonical first-credit fields.
- `backend/src/services/learning-path-service.js`
  - Extend pass projection, remaining-item selection, session creation, mode validation and readiness checks.
- `backend/src/controllers/learning-path-controller.js`
- `backend/src/routes/learning-path-routes.js`
  - Reuse existing USER-only path/pass endpoints and response/error conventions.

### 3.3 Learning Session and SRS backend

- `backend/src/services/learning-session-service.js`
  - Integrate immediate NORMAL first credit into the existing reveal transaction and extend pass-linked SRS safe reads.
- `backend/src/repositories/learning-session-repository.js`
  - Reuse session/item locks, exact evidence replay, SRS receipts, immutable snapshots and atomic evidence writes.
- `backend/src/services/learning-session-domain.js`
  - Reuse authoritative seven-day expiry and ACTIVE/EXPIRED/COMPLETED projection.
- `backend/src/services/learning-session-persistence.js`
  - Preserve bounded-session completion and Streak insertion; do not use it for pass readiness.
- `backend/src/services/learning-service.js`
  - Extend session-aware SRS processing only for backend-authored pass-linked SET/SRS sessions.
- `backend/src/services/srs-scheduler.js`
  - Reuse the scheduler unchanged.
- `backend/src/repositories/learning-repository.js`
  - Reuse Progress identity locks, revision checks, rating transitions, rewards and card reads.

### 3.4 Frontend learning and services

- `frontend/src/learning/learning-foundation-page.jsx`
  - Extend existing V1 NORMAL pass orchestration to both NORMAL and CEFR-scoped SRS.
- `frontend/src/learning/normal-learning-session.js`
  - Reuse reveal/session reconciliation and operation replay.
- `frontend/src/learning/srs-learning-session.js`
  - Reuse fixed-session state and exact-session resume.
- `frontend/src/learning/learning-path-run.js`
  - Reuse USER/Set/pass-scoped mutation identity persistence; include mode in session-creation identity where necessary.
- `frontend/src/learning/learning-run-state.js`
- `frontend/src/session-storage/learning-session-state.js`
  - Reuse presentation state only after backend reconciliation.
- `frontend/src/services/learning-path-service.js`
- `frontend/src/services/learning-session-service.js`
- `frontend/src/services/learning-service.js`
  - Extend validators for additive pass evidence, mode, cards and active-session projections.
- `frontend/src/vocabulary-sets/set-detail-primitives.jsx`
  - Provide the explicit fresh NORMAL relearning intent without changing other learning cards.

### 3.5 Dashboard and presentation

- `frontend/src/dashboard/dashboard-page.jsx`
- `frontend/src/dashboard/dashboard-current-learning.js`
  - Preserve the Current Learning card, cover, active pass identity and continuation link while removing the numeric bar/fraction.
- `frontend/src/learning/flashcard-presentation.jsx`
  - Separate safe audio availability from evidence-changing pending controls with no broad redesign.

### 3.6 Existing verification assets

- Backend: learning-path service/API/authorization/activity-boundary tests, Learning Session tests, SRS scheduler/XP/Streak tests and migration harnesses.
- Frontend unit/contract: learning-path service/run/UI contracts, NORMAL/SRS session state, Dashboard Current Learning and accessibility contracts.
- Browser: `frontend/e2e/auth/learning-path-full-pass.spec.js`, `frontend/e2e/auth/learning-srs.spec.js`, `frontend/e2e/auth/dashboard-foundation.spec.js` and relevant focus/loading coverage.
- Guarded real stack: `frontend/e2e/integration/cefr-learning-path-real-stack.spec.js` and learning/dashboard regression specs.

The implementation must extend these assets rather than establish a duplicate test framework.

## 4. Backend Evidence Architecture

### 4.1 Canonical authority

`CEFR_LEARNING_PASS_ITEM` becomes the canonical answer to whether an exact snapshot item has CEFR credit. Learning Session evidence and SRS receipts remain the immutable source event records, while the pass item stores the first accepted qualifying event identity.

The backend derives credit only from an accepted event in a session that is already linked to the pass. Clients cannot submit pass-item identity, evidence source, evidence timestamp, credited count or pass association.

### 4.2 Evidence-source mapping

Map accepted backend events as follows:

| Session/event | Pass-item source |
|---|---|
| SET/NORMAL `NORMAL_REVEALED` | `NORMAL_REVEALED` |
| CEFR SET/SRS `AGAIN` receipt | `SRS_AGAIN` |
| CEFR SET/SRS `HARD` resolution | `SRS_HARD` |
| CEFR SET/SRS `GOOD` resolution | `SRS_GOOD` |
| CEFR SET/SRS `EASY` resolution | `SRS_EASY` |

Ordinary SET/SRS and GLOBAL/SRS sessions have no pass relation and therefore never enter the credit path. Quiz and Speaking do not call it.

### 4.3 Shared credit operation

Add one internal service-level credit operation used from the existing NORMAL and SRS transactions. It must:

1. receive the already locked/authorized session, exact item, accepted source event and backend timestamp;
2. return without mutation when the session has no pass relation;
3. lock the owned active pass and exact pass item;
4. verify USER, pass, Set, session and Vocabulary identity alignment;
5. conditionally set first-credit fields only when all are null;
6. return whether this event won first credit plus an authoritative pass-evidence summary; and
7. leave ordinary session/SRS effects intact when another event already won or the pass is no longer active.

This operation belongs in the learning-path service/repository boundary and executes using the caller's existing Prisma transaction. Controllers and clients never call it directly.

## 5. Pass-Item First-Credit Persistence

### 5.1 Schema extension

Extend `CEFR_LEARNING_PASS_ITEM` with nullable fields equivalent to:

- first-credit evidence source enum;
- first-credit event UUID;
- first-credit Learning Session UUID;
- first-credit acceptance timestamp.

Use a focused enum containing exactly the five approved sources. The PLAN fixes responsibilities, while final Prisma identifier casing may follow current conventions during later TASK authoring.

### 5.2 Integrity constraints

- All four first-credit fields are null together or non-null together.
- A credited source event identifies at most one pass item.
- The credited session must exist; use a restrictive relationship because deleting source evidence would invalidate pass proof.
- Existing `(pass_id, vocabulary_id)` and `(pass_id, position)` uniqueness remains.
- Position and snapshot-size checks remain unchanged.
- A first credit is immutable through application code; no update path replaces it.
- No general encounter-history or repeated-rating rows are introduced.

### 5.3 Read semantics

- `studied_items` remains as a compatibility field but now means pass items with non-null first credit.
- `remaining_items` is `snapshot_size - credited_items`.
- Add source counts for NORMAL and SRS first credit only when needed by Learning flow/verification; Dashboard must not present them as analytics.
- Readiness is true only when every pass item is credited and the active pass remains compatible.
- Session completion is not queried to calculate credited count.

## 6. Transaction and Concurrency Design

### 6.1 Lock order

Use one stable lock order for credit-bearing mutations:

1. USER-scoped operation/event identity where currently used;
2. owned Learning Session;
3. exact session item;
4. Progress identity for SRS only;
5. active pass;
6. exact pass item;
7. path state/current curriculum only during explicit completion.

The later implementation must verify existing query lock order before finalizing SQL to avoid inversions with current replay and completion transactions.

### 6.2 First-credit race

- A conditional update sets first-credit fields only when all remain null.
- NORMAL and SRS events may both complete their ordinary accepted mutation, but only one update wins CEFR first credit.
- The loser returns the authoritative existing credit without changing the count.
- Exact event replay returns the original result and never creates another credit.
- Reusing one event identity for incompatible session/item/rating data remains a conflict.

### 6.3 Multiple tabs

- Pass row serialization prevents duplicate same-mode batch creation after rechecking active sessions and remaining items.
- Different-mode sessions may intentionally overlap when both snapshots were valid at creation.
- Frontends never increment locally; they accept additive `cefr_pass` summaries or refresh the pass.
- Stale tabs reconcile session and pass state before navigation, completion or retry.

### 6.4 Completion and restart races

- Explicit completion locks the active pass and rechecks all pass-item credits before status/entitlement writes.
- Restart serializes against evidence acceptance and completion.
- Events accepted before restart retain evidence on the invalidated pass but are not copied.
- Events reaching an invalidated/completed pass may retain valid ordinary session/SRS effects but cannot create CEFR credit.

## 7. NORMAL Reveal Integration

### 7.1 Backend path

Extend `acknowledgeNormalReveal` without changing its public event meaning:

1. preserve current owner, mode, Set access, snapshot, replay and expiry checks;
2. record `NORMAL_REVEALED` on the session item;
3. when the session is pass-linked, invoke canonical first credit in the same transaction;
4. return the existing reveal/session result plus an additive authoritative `cefr_pass` evidence summary; and
5. keep exact replay and already-acknowledged behavior idempotent.

Transaction rollback must include both reveal evidence and pass credit; neither may commit alone.

### 7.2 Frontend path

- Continue using the existing reveal operation identity and retry context.
- Accept the returned pass summary instead of waiting for bounded-session completion to refresh progress.
- Preserve explicit bounded NORMAL session completion for session lifecycle and Streak.
- After expiry, retain accepted pass credit and request a replacement batch containing only uncredited items.

### 7.3 Compatibility

Ordinary NORMAL sessions with no pass relation continue to record session evidence and Streak exactly as before and return no CEFR mutation.

## 8. CEFR-Scoped SRS Session Creation

### 8.1 Pass-session request

Extend `POST /api/learning-path/passes/:passId/sessions` to accept:

- required `operation_id`;
- optional `mode` with allowed values `NORMAL` and `SRS`;
- omitted `mode` normalized to `NORMAL` for V1 compatibility.

Strictly reject unknown fields. Replay matching includes pass and normalized mode.

### 8.2 Candidate selection

- Lock and verify the active owned pass and compatible current Set snapshot.
- For pass-level continuation, resume the newest active compatible session of the requested mode only when it still contains an uncredited pass item.
- Otherwise select the first at most ten uncredited pass items in immutable pass order.
- Never use ordinary SRS due eligibility for CEFR-scoped candidates.
- Never accept client-supplied Vocabulary IDs.
- Return `PASS_READY_TO_COMPLETE` instead of creating a session when no items remain.

### 8.3 SRS cards and previews

For an SRS session, return exact cards and authoritative four-rating previews for its immutable item IDs, including NEW and non-due Progress states. Reuse the current card projection and scheduler preview logic rather than duplicate it.

The existing safe session read must make the same cards available for exact-session resume. The additive projection is limited to pass-linked SET/SRS sessions; ordinary session callers retain current behavior.

### 8.4 Constraint and authorization

- Relax the database pass-scope check only to SET plus NORMAL/SRS.
- Only learning-path service creation can set the pass relation.
- Existing ordinary session creation continues to force a null pass relation.
- USER/pass/Set ownership, unlocked-level access and snapshot membership are revalidated in the backend.

## 9. SRS Rating Integration Including AGAIN

### 9.1 Existing mutation retained

Continue routing ratings through the current session-aware SRS transaction, scheduler, Progress revision, receipt, reward and session-completion logic.

For CEFR-scoped SRS only, allow a backend-snapshotted non-due or unseen item to be rated. This exception is derived exclusively from a valid pass-linked SET/SRS session and does not change ordinary SET or GLOBAL due-only behavior.

The existing transition calculator remains authoritative. Existing reward rules decide whether an early/non-due event earns zero or an existing allowed reward; V2 introduces no new reward.

### 9.2 First credit

- After accepting the rating and receipt, invoke canonical pass credit in the same transaction.
- `AGAIN` maps to `SRS_AGAIN` immediately even though the session item remains unresolved.
- `HARD`, `GOOD` and `EASY` retain their session evidence and resolution behavior and map to their corresponding pass sources.
- Repeated `AGAIN` receipts preserve existing requeue/scheduling behavior and cannot alter the first credit.
- Add the authoritative `cefr_pass` summary to pass-linked rating responses.

### 9.3 Independent session resolution

- A pass can become ready while its SRS session remains active.
- Completing the pass does not complete or delete that session.
- The exact session remains resumable while active and authorized; later ratings have ordinary effects but cannot mutate a completed pass.
- Expiry rejects later ratings and removes active resume while preserving accepted pass credit.
- No V2 code writes a new abandonment/supersession status.

## 10. Mixed-Mode Session Lifecycle

### 10.1 Session identity

The pass read projection must expose active session summaries sufficient to distinguish:

- mode;
- session ID;
- lifecycle and expiry;
- whether the session contains any uncredited pass item; and
- whether an unresolved SRS queue remains directly resumable.

It must not expose inaccessible card content.

### 10.2 UI choices

When an unresolved SRS session and remaining pass items coexist, display separate actions:

- **Continue this SRS review session** — resumes the exact session ID;
- **Continue remaining CEFR items** — requests a pass-level batch in the chosen mode.

When the pass is ready, replace the second action with **Complete Set**. Neither action mutates the other lifecycle.

### 10.3 Reconciliation rules

- Exact-session resume re-reads the backend session before restoring cursor/queue state.
- Pass-level continuation never selects an active session merely because it is unresolved if all its items are already credited.
- Mode switching preserves both backend sessions and clears/reconciles only presentation state for the entered mode.
- Expired sessions remain historical and are not rewritten as completed.
- Access loss uses existing inaccessible/restart-required behavior without disclosing content.

## 11. Batch Selection and Ten-Item Invariant

- Canonical remaining items are pass items with null first credit.
- Order by immutable pass position, never Progress status or client order.
- Slice only after authorization, compatibility and current active-session reconciliation.
- Create between one and ten distinct session items; zero produces ready state.
- 10-item Set: one batch may provide all evidence, then explicit completion.
- 11-item Set: at least two batches; first ten can never mark ready.
- 15-item Set: ten plus a final five-item batch.
- 20-item Set: at least two ten-item batches.
- Overlapping NORMAL/SRS snapshots created under the approved mixed-mode rule do not reduce session-local snapshots; first-credit deduplication controls pass counts.
- A session expiring after partial accepted evidence causes replacement selection only for still-uncredited items.

Repository queries and service tests must prove no eleventh item is silently omitted and no batch exceeds ten.

## 12. Explicit Completion and Unlock Behavior

### 12.1 Readiness

Replace V1 completed-NORMAL-session reconstruction with an all-pass-items-credited check. Readiness requires:

- active owned pass;
- compatible accessible snapshot;
- positive snapshot size;
- every pass item has a complete valid first-credit tuple.

Unresolved SRS session items, Progress status, XP, Streak and client state are not readiness inputs.

### 12.2 Final completion

Keep `POST /api/learning-path/passes/:passId/complete` and its operation replay contract. In one transaction:

1. lock/revalidate the active pass and all first-credit rows;
2. reject incomplete or incompatible snapshots;
3. mark exactly one historical completion;
4. evaluate current predecessor-level curriculum;
5. advance entitlement monotonically only when currently eligible; and
6. return refreshed pass/path projections.

### 12.3 Migration boundary

Backfill may make an incomplete active pass read as ready, but the migration never calls this completion path. The USER must explicitly invoke it later.

Existing completed passes, completion timestamps, highest unlocked level and terminal timestamp are preserved byte-for-byte by migration.

## 13. Independent Completed-Set NORMAL Relearning

### 13.1 Entry intent

Use the existing Set Detail NORMAL learning action with an explicit fresh-study intent when the Set already has historical completion. Do not create a new route, API or pass.

### 13.2 State handling

- On explicit independent relearning, clear only the matching USER/Set NORMAL learning-run and Learning Session presentation keys before opening content.
- Do not clear SRS, another Set, another USER or pending accepted-operation identities.
- Create/resume an ordinary non-pass NORMAL session through the existing Learning Session API.
- Do not restore a stale completed CEFR run screen.
- Do not modify or duplicate the completed pass, evidence or entitlement.

### 13.3 SRS after completion

Keep existing ordinary due-based SET/SRS behavior. Do not add independent non-due SRS relearning in V2.

## 14. Dashboard Simplification

Modify only Current Learning presentation:

- retain the backend-selected active RESUME pass, Set cover, Set name, truthful state and exact pass navigation;
- remove the numeric `studied_items / snapshot_size` copy and progress bar;
- display a concise backend-derived state such as continue learning, continue remaining words or ready to complete;
- never infer mastery, SRS resolution or completion from client data;
- keep Current Learning independent from Next Suggestion;
- keep Recommendation, CEFR completion counts, Review, metrics and right-column behavior unchanged; and
- preserve existing responsive order, loading, error, retry and focus behavior.

Backend evidence counts remain in the pass contract for Learning flow, migration verification and tests; this UI decision does not remove them from persistence.

## 15. Pending NORMAL Interaction UX

### 15.1 Current issue

`learning-foundation-page.jsx` currently applies one `eventState === "pending"` value to the toolbar, whole Flashcard, navigation, mode switch, restart and audio. Correctness-sensitive actions must remain blocked, but audio and passive reading do not mutate evidence.

### 15.2 Planned separation

- Keep reveal retry, previous/next navigation, session/pass completion, restart and mode switch disabled while reveal acceptance is unknown.
- Keep the current card visible and expose `aria-busy` plus a short live status such as **Recording study evidence…**.
- Allow pronunciation playback and passive reading/scrolling during evidence pending.
- Preserve one stable operation identity for retry.
- On success, update authoritative pass evidence and enable the next valid action immediately.
- On failure, retain the card and move/restore focus to the exact retry action under existing focus conventions.
- Honor reduced motion and avoid optimistic credit or arbitrary delay.

### 15.3 Explicit exclusion

Do not diagnose or optimize network/database latency in this feature. If measured latency remains unacceptable after the interaction correction, stop and propose a separate bounded performance investigation.

## 16. API, Controller, Service and Repository Contracts

### 16.1 Learning Path API

Keep existing routes and envelopes.

`GET /api/learning-path/passes/:passId`

- Add canonical credited/remaining/readiness state and active CEFR session summaries by mode.
- Keep `studied_items` and `remaining_items` compatible.

`POST /api/learning-path/passes/:passId/sessions`

- Body: `operation_id`, optional `mode` (`NORMAL` or `SRS`).
- Omitted mode normalizes to `NORMAL`.
- Response retains `session`, `reason`, `replayed` and `resumed` behavior.
- SRS response additionally includes exact cards and `evaluated_at`.

`POST /api/learning-path/passes/:passId/complete`

- Contract remains explicit and idempotent; readiness source changes to canonical first credit.

### 16.2 Existing session/event API additions

`PUT /api/learning-sessions/:sessionId/items/:vocabularyId/reveal`

- Pass-linked success adds an authoritative `cefr_pass` summary.

`GET /api/learning-sessions/:sessionId`

- Pass-linked SET/SRS safe resume adds validated cards and `evaluated_at` without changing ordinary session semantics.

`POST /api/learning/events`

- Pass-linked SET/SRS success adds `cefr_pass`.
- Existing request fields, rating values, session identity, revision and replay contracts remain.

No endpoint accepts client pass-item IDs, credit source or credit count.

### 16.3 Controllers and routes

- Extend existing learning-path controller status selection for normalized mode/replay/resume only.
- Keep authentication and USER-role middleware unchanged.
- Keep current error-envelope mapping; add a code only when a distinct migration/runtime conflict cannot use an existing stable pass/session conflict.
- Do not add a separate CEFR-SRS router.

### 16.4 Services

- Learning Path service owns pass selection, mode normalization, first credit, readiness, restart and completion.
- Learning Session service owns NORMAL event acceptance and session lifecycle.
- Learning service owns SRS event/scheduler/reward mutation.
- Both event services call the same internal learning-path credit operation inside their transaction.
- Frontend services strictly validate additive projections and reject mismatched pass/session/Set identities.

### 16.5 Repositories

- Learning Path repository adds first-credit selects, pass-item locks, conditional credit write and active-session summaries.
- Learning Session repository preserves current evidence/receipt primitives and exposes exact source identities required for migration/runtime validation.
- Learning repository preserves Progress and reward writes; it does not write pass items directly.

During later implementation, synchronize `docs/API_SPEC.md`, `docs/DATABASE.md`, `docs/ARCHITECTURE.md` and `docs/UI_UX_SPEC.md` with accepted contracts. Do not update status to DONE before authorized TEST, REVIEW and HUMAN acceptance.

## 17. Prisma Migration Strategy and Rollback Limitations

### 17.1 Additive schema work

One new forward migration should:

1. add the focused evidence-source enum;
2. add nullable first-credit fields to pass items;
3. add all-or-none, uniqueness, foreign-key and supporting index constraints;
4. replace the pass-scope check with SET plus NORMAL/SRS;
5. run pre-backfill validation;
6. backfill deterministic exact V1 NORMAL evidence;
7. run post-backfill invariants; and
8. leave pass, completion and entitlement columns untouched.

Do not edit the V1 migration.

### 17.2 Backfill source validation

A candidate must prove:

- SET/NORMAL pass-linked session;
- matching session USER and pass USER;
- matching session pass ID and pass-item pass ID;
- matching session Set snapshot and pass Set snapshot;
- matching session-item and pass-item Vocabulary identity;
- exact `NORMAL_REVEALED` evidence;
- valid non-null event UUID and acceptance timestamp; and
- acceptance consistent with V1 lifetime/evidence constraints.

Rank multiple valid candidates by `evidence_at`, then event UUID. Persist only rank one. Abort on foreign, malformed, ambiguous, incompatible or temporally invalid evidence rather than fabricate a value.

### 17.3 No migration side effects

The migration must not:

- change pass status, completion event or completion timestamp;
- call completion logic;
- update highest unlocked level or path-completed timestamp;
- create Progress, SRS, Quiz, Speaking, XP or Streak evidence;
- create new passes or sessions; or
- infer evidence from client storage.

An active pass may become ready after backfill but remains active pending explicit USER completion.

### 17.4 Verification and rollback limitation

Static and isolated PostgreSQL tests must compare before/after counts and immutable values, prove rerun-stable first-credit selection, and validate 10/11/15/20-item cases.

Once V2 accepts new NORMAL/SRS credits, automatically reverting to the V1 schema would discard canonical evidence and may make pass state unreadable. Therefore:

- no automatic destructive down migration is planned;
- migration rehearsal and backup/restore readiness are required before an authorized environment rollout;
- rollback before V2 writes may use the verified deployment recovery procedure;
- rollback after V2 writes requires a separately reviewed data-preservation plan; and
- any inability to prove source identity or preserve evidence is a release stop condition.

No Prisma command or database operation is authorized by this PLAN draft.

## 18. Test and Verification Strategy

Verification proceeds from offline/focused to guarded/integration only after the relevant HUMAN authorization.

### 18.1 Backend offline coverage

- First-credit field validation and source mapping.
- NORMAL accepted reveal, replay, already-acknowledged and concurrent cross-mode credit.
- SRS-only pristine pass with unseen/non-due cards.
- All ratings including repeated `AGAIN`.
- Ordinary SET/SRS and GLOBAL/SRS remain non-crediting and due-only.
- Same Vocabulary in two passes/Sets remains exact-pass scoped.
- Expired/inaccessible/foreign/private/copied sessions cannot credit.
- Pass readiness independent from session resolution.
- Explicit completion and monotonic unlock unchanged.

### 18.2 Boundary matrix

- 10-item Set: one batch plus explicit completion.
- 11-item Set: ten plus one, no premature readiness.
- 15-item Set: ten plus five.
- 20-item Set: two bounded batches.
- NORMAL-only, SRS-only and mixed-mode coverage.
- Partial accepted evidence followed by expiry and replacement.
- Concurrent NORMAL/SRS events and multiple-tab replay.
- Restart and invalidated-pass isolation.

### 18.3 Migration coverage

- Static SQL contract checks.
- Exact valid active, completed and expired-session backfill.
- Earliest timestamp/event tie-break.
- Missing/foreign/malformed/conflicting evidence abort.
- No ordinary SRS, GLOBAL, Quiz or Speaking backfill.
- No pass completion or entitlement change.
- Existing completed passes and entitlements preserved.
- Active fully backfilled pass projects ready but remains uncompleted.

### 18.4 Frontend unit/contract coverage

- Optional session mode serialization/default and strict response validation.
- Pass-linked SRS cards and exact session resume.
- Separate SRS queue versus remaining-CEFR actions.
- `AGAIN` credit with unresolved queue.
- Expiry and restart focus/state.
- Independent completed-Set NORMAL relearning and stale storage cleanup.
- Dashboard Current Learning without fraction/bar and with exact pass navigation.
- NORMAL pending safe audio, blocked mutations, live status, success and retry focus.

### 18.5 Browser coverage

- NORMAL-only, SRS-only and mixed-mode journeys.
- Direct SRS from pristine pass.
- Repeated `AGAIN`, exact SRS resume and continuing remaining CEFR items.
- Ready pass with unresolved SRS session.
- Reload/multiple-tab reconciliation.
- Responsive and keyboard behavior for Learning and Dashboard.
- Completed-Set fresh NORMAL relearning.
- Slow reveal response with audio availability and mutation locks.

Run relevant Playwright only when an existing browser is available; do not install one solely for a batch.

### 18.6 Guarded verification

Database migration integration, concurrent PostgreSQL transactions, real-stack browser tests and CI require later explicit HUMAN authorization. Never run them against Main, Preview, Production or an unverified shared database.

### 18.7 Regression coverage

Run focused existing suites for Learning Session, ordinary SRS, Review Center, GLOBAL SRS, Quiz, Speaking, XP, Streak, Dashboard, authorization and session storage. Assertions must remain meaningful; do not delete or weaken coverage to force PASS.

## 19. Implementation Phases and Dependencies

These are bounded PLAN phases, not TASK decomposition or authorization to execute.

### Batch 1 — Data foundation and evidence contract

Scope:

- additive Prisma model/migration design;
- pass-item first-credit repository projection and conditional-write contract;
- migration static harness updates;
- offline repository/service tests that do not require a database.

Dependencies: approved SPEC and PLAN. Database execution remains separately gated.

Review checkpoint: schema responsibilities, identity chain, no-completion/no-unlock backfill and rollback limits are accepted before event integration.

### Batch 2 — Backend NORMAL, SRS and pass-session APIs

Scope:

- immediate NORMAL credit;
- mode-aware pass session creation;
- CEFR-scoped SRS cards/non-due authorization;
- rating credit including `AGAIN`;
- pass read/readiness/session summaries;
- API/service/repository focused tests.

Dependency: Batch 1 contract stable. Migration must be available in isolated verification before database-backed tests.

Review checkpoint: ordinary/global SRS and reward/scheduler behavior remain unchanged while first-credit concurrency is proven.

### Batch 3 — Frontend continuation and relearning

Scope:

- service validators and mode-aware operations;
- NORMAL/SRS pass orchestration;
- exact SRS resume versus remaining CEFR continuation;
- expiry/retry/reconciliation;
- independent completed-Set NORMAL relearning;
- focused unit and mocked browser tests.

Dependency: Batch 2 API projections stable.

Review checkpoint: backend identity remains authoritative and client storage is presentation-only.

### Batch 4 — Dashboard, pending UX and focused regression

Scope:

- remove Current Learning numeric bar/fraction;
- preserve exact pass action and independent suggestion;
- allow safe audio during NORMAL evidence pending while blocking mutations;
- accessibility, responsive and focused regression tests;
- Focused UI/UX Review before HUMAN visual acceptance.

Dependency: Batch 3 pass state handling stable.

### Batch 5 — Migration validation and integrated verification

Scope after separate authorization:

- isolated guarded migration rehearsal;
- PostgreSQL concurrency and migration integration;
- focused real-stack journeys;
- regression scan;
- documentation synchronization;
- formal TEST and REVIEW evidence.

Dependency: Batches 1–4 reviewed; verified database target and explicit database/CI authorization.

No phase may commit, push, merge, deploy or dispatch CI without separate authorization.

## 20. Risk Register and Stop Conditions

| Risk | Mitigation | Stop condition |
|---|---|---|
| Backfill fabricates or misattributes credit | Exact identity chain, deterministic rank, pre/post assertions | Any source cannot be proven exactly |
| V1 reveal lands after backfill but before V2 writer activation | Controlled write-quiescent cutover | Platform cannot guarantee no-write boundary |
| Migration changes completion/unlock | Assert immutable pass/path-state columns and counts | Any status, completion or entitlement delta |
| NORMAL event commits without credit | One transaction and conditional first-credit write | Atomicity cannot be demonstrated |
| CEFR SRS weakens ordinary due rules | Gate non-due acceptance on pass-linked SET/SRS identity only | Ordinary/GLOBAL eligibility regression |
| `AGAIN` accidentally resolves session | Preserve null session evidence and existing receipt/requeue path | Queue or Streak semantics change |
| Cross-mode duplicate credit | Pass-item lock, conditional update and event uniqueness | Credited count exceeds unique pass items |
| Deadlock from new lock order | Inspect existing order and run guarded concurrency tests | Unresolved lock inversion or retry ambiguity |
| Multiple tabs create duplicate same-mode batches | Serialize pass creation and recheck active sessions | Same-mode overlapping creation remains possible |
| Completed pass blocks unresolved SRS resume | Keep session lifecycle independent and credit write inactive | Resume requires mutating completed pass |
| Stale client run traps relearning | Explicit fresh intent and scoped state cleanup | Cleanup risks another USER/Set/mode state |
| Dashboard copy implies mastery | Remove numeric fraction/bar and use backend state | UI still presents encounter credit as mastery |
| Pending UX permits duplicate mutation | Separate safe audio from evidence-changing controls | Exact retry identity or focus cannot be preserved |
| Rollback loses V2 evidence | Forward migration, rehearsal, backup and separate recovery plan | Rollback would discard accepted evidence |
| Scope expands into performance/history/analytics | Enforce SPEC exclusions | Fix requires new business rule or architecture |

Additional mandatory stops:

- approved SPEC and PLAN conflict;
- V1 completed pass lacks provable exact evidence;
- schema cannot enforce all-or-none first-credit identity;
- SRS scheduler/reward compatibility requires a business-rule change;
- implementation needs backend API or UI behavior outside approved V2;
- a database, migration, CI or deployment action lacks explicit HUMAN authorization;
- unrelated tracked changes or sibling-worktree conflicts appear.

No open business decision remains after approval of `HD-V2-01` through `HD-V2-09`. Exact identifiers and file-level grouping may be normalized during later TASK authoring only when they preserve this PLAN. Any responsibility, API behavior, persistence model or scope change returns to PLAN/SPEC review.

## 21. Approval Gate

```text
SOURCE SPEC: HUMAN APPROVED — 2026-11-12
HD-V2-01 THROUGH HD-V2-09: HUMAN APPROVED — 2026-11-12
PLAN STATUS: HUMAN APPROVED — 2026-11-12
HUMAN PLAN APPROVAL: GRANTED — 2026-11-12
TASK AUTHORIZED: YES — DRAFT TASK AUTHORING ONLY
IMPLEMENTATION AUTHORIZED: NO
SCHEMA / MIGRATION CREATION OR EXECUTION AUTHORIZED: NO
DATABASE / PRISMA AUTHORIZED: NO
DEPENDENCY INSTALLATION AUTHORIZED: NO
COMMIT / PUSH / MERGE / CI / DEPLOYMENT AUTHORIZED: NO
NEXT ALLOWED ACTION: HUMAN reviews and decides whether to approve the DRAFT V2 TASK document
```

The HUMAN approved this PLAN on 2026-11-12. No implementation may begin until the HUMAN separately approves the DRAFT TASK document and explicitly authorizes the relevant implementation batch.
