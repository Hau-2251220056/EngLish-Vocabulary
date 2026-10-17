# TASKS: Streak V1

**Document status:** `DRAFT — PENDING HUMAN TASK APPROVAL`

**Feature status:** `TODO`

**Approved inputs:**

- `docs/specs/STREAK_V1_SPEC.md` — HUMAN APPROVED; 46 business rules and 36 acceptance criteria.
- `docs/plans/STREAK_V1_PLAN.md` — HUMAN APPROVED, including all eight section 16 decisions.
- Planning baseline: `origin/dev` at `e3f5dd18193fbfee23c1ea5cdc2aa3fdee150e59`.

**Implementation / migration / database / CI / deployment authorized:** `NO`

## 1. Overview and scope gate

TASK-235 through TASK-253 decompose the approved Streak V1 PLAN into seven incremental phases. They introduce Backend-owned qualifying sessions for NORMAL, SRS and Multiple Choice Quiz; durable per-item evidence; one Streak Day per USER/application date; a read-only current-Streak projection; and one compact USER Dashboard card.

The tasks extend the existing Learning and Quiz flows. They do not change SRS scheduling, Quiz grading, Progress rules, XP eligibility/deduplication, the Level/XP card or Speaking Practice. Existing sessionless SRS/Quiz requests remain compatible and never qualify for Streak.

No task authorizes implementation merely by appearing in this document. HUMAN must approve this TASK document, then explicitly authorize task execution and each named database/deployment gate. No task may add Daily Goal, Streak Freeze, Achievement, leaderboard, weekly calendar, `USER.current_streak`, surveillance, view-duration rules, a new role, an external service or an unrelated refactor.

## 2. Phase and gate distribution

| Phase | Tasks | Count | Required gate |
|---|---|---:|---|
| 1. Persistence and additive migration | TASK-235–TASK-236 | 2 | Gate ST-1: migration design and isolated DB evidence |
| 2. Backend session/Streak foundation | TASK-237–TASK-240 | 4 | Gate ST-2: lifecycle/API/security foundation |
| 3. NORMAL integration | TASK-241–TASK-242 | 2 | Gate ST-3: NORMAL interaction and no-XP proof |
| 4. SRS integration | TASK-243–TASK-244 | 2 | Gate ST-4: Learning/XP-sensitive acceptance |
| 5. Quiz integration | TASK-245–TASK-246 | 2 | Gate ST-5: Quiz/XP-sensitive acceptance |
| 6. Streak read and Dashboard | TASK-247–TASK-248 | 2 | Gate ST-6: Focused UI/UX and HUMAN browser review |
| 7. Integrated verification and release readiness | TASK-249–TASK-253 | 5 | Gate ST-7: formal acceptance; Gate ST-8: Preview deployment |

Total: **19 tasks**, TASK-235 through TASK-253.

## 3. Dependency graph

```text
TASK-235 Schema + migration draft
    ↓
TASK-236 Guarded migration verification → STOP Gate ST-1
    ↓
TASK-237 Time/session/Streak domain
    ↓
TASK-238 Session/Streak repositories and transactions
    ↓
TASK-239 Session + Streak HTTP contracts
    ↓
TASK-240 Foundation integration/security verification → STOP Gate ST-2
    ↓
TASK-241 Shared frontend session/reconciliation layer
    ↓
TASK-242 NORMAL integration and focused verification → STOP Gate ST-3
    ↓
TASK-243 SRS session integration
    ↓
TASK-244 SRS atomic/regression verification → STOP Gate ST-4
    ↓
TASK-245 Quiz session integration
    ↓
TASK-246 Quiz atomic/regression verification → STOP Gate ST-5
    ↓
TASK-247 Streak read + compact Dashboard card
    ↓
TASK-248 Frontend/browser/accessibility verification → STOP Gate ST-6
    ↓
TASK-249 Guarded integrated concurrency and legacy regression
    ↓
TASK-250 Documentation synchronization
    ↓
TASK-251 Formal TEST (AC-ST-01–36)
    ↓ HUMAN accepts TEST
TASK-252 Formal REVIEW and release recommendation → STOP Gate ST-7
    ↓ separate Git/release/database authorization
TASK-253 Preview TEST migration/deployment and closure → STOP Gate ST-8
```

All work uses the current shared worktree unless HUMAN separately authorizes worktrees/agents. Do not parallelize tasks that touch Learning/Quiz repositories, `create-app.js`, shared frontend state or migration files.

## 4. Verification levels and environment boundaries

- **Static/document verification:** schema/SQL/source review, traceability, secret/generated-artifact scan and `git diff --check`; no database.
- **Pure verification:** deterministic Node/frontend tests with injected clock and fakes; no database.
- **Guarded DB verification:** only the repository-approved dedicated CI TEST database after explicit authorization and identity guard. Never substitute Development or Preview TEST.
- **Mocked browser verification:** existing Playwright fixtures and mocked APIs; no protected database writes.
- **Guarded real-stack verification:** existing isolated CI TEST workflow only after authorization. An unexecuted job is `NOT RUN`, never PASS.
- **Preview TEST:** backup/preflight/migration/deployment require separate HUMAN authorization at TASK-253. Never reset, seed or use it as a CI fixture.
- **Production:** wholly separate future approval and release procedure; TASK-253 does not authorize it.

## Phase 1 — Persistence and additive migration

## TASK-235 — Define the three-model Prisma schema and additive migration

**Objective:** Implement the approved persistence shape and forward migration without backfill.

**Dependencies / prerequisites:** HUMAN approval of this TASK document and separate authorization to implement TASK-235. No database execution.

**Expected files/modules:**

- `backend/prisma/schema.prisma` — enums, models and relations.
- New `backend/prisma/migrations/<timestamp>_add_streak_v1/migration.sql` — reviewed PostgreSQL DDL.

**In scope:**

- Add exactly `LEARNING_SESSION`, `LEARNING_SESSION_ITEM` and `STREAK_DAY` plus the approved session-mode/status/item-evidence enums.
- Apply approved UUID, timestamp/date, nullable completion/evidence and immutable snapshot fields.
- Keep `evidence_event_id` globally unique and specific to one accepted durable item evidence; terminal completion retains its separate `completion_event_id`.
- Use the approved UTC persistence convention for new Streak `TIMESTAMP(3)` defaults through explicit `CURRENT_TIMESTAMP AT TIME ZONE 'UTC'` database expressions; do not alter defaults on existing feature models.
- Add exact unique constraints, checks, indexes and FK actions from PLAN section 4.
- Preserve a nullable Set relation plus immutable Set/Vocabulary UUID snapshots.
- Store no `USER.current_streak`; derive expiry and current Streak.
- Make USER `RESTRICT` an explicit future account-lifecycle dependency, not an undocumented permanent prohibition.
- Generate no sessions, items or Streak Days from historical data.

**Out of scope:** Repository/service code, migration execution, cleanup scheduler, retention purge, account deletion implementation, Progress/XP changes.

**AC / BR mapping:** Primary persistence ownership: AC-ST-02, AC-ST-18, AC-ST-25, AC-ST-28, AC-ST-31; BR-ST-003, BR-ST-007, BR-ST-009, BR-ST-015–016, BR-ST-023, BR-ST-030–031, BR-ST-039–040, BR-ST-042, BR-ST-045–046; PLAN decisions 1–4.

**Focused verification:** Static Prisma/SQL review, constraint inventory and `git diff --check`. Prisma generation/validation may run only when separately authorized as implementation verification; no connection or migration command.

**Risks / rollback:** Wrong FK/check semantics can block deletion or allow false completion. Migration remains additive; shared-environment rollback is never automatic or destructive.

**Review gate:** Prepares Gate ST-1. HUMAN reviews exact schema and SQL before any database execution.

## TASK-236 — Prove migration safety, constraints and no-backfill behavior

**Objective:** Verify the migration in the dedicated guarded TEST database and produce environment-specific evidence.

**Dependencies / prerequisites:** TASK-235 reviewed; explicit HUMAN authorization for the guarded CI TEST database. Confirm target identity before access.

**Expected files/modules:** Focused migration harness/tests under `backend/test/streak/`; existing guarded test helpers only if a minimal registration change is necessary; one narrowly scoped guarded GitHub Actions `workflow_dispatch` entry point for this isolated Streak migration harness.

**In scope:**

- Verify clean apply, Prisma/schema parity and successful migration history.
- Verify seven-day, lifecycle, evidence, uniqueness and FK constraints directly.
- Verify zero backfilled sessions/items/days and unchanged USER/Progress/XP values.
- Verify duplicate USER/date and invalid snapshot/evidence data are rejected.
- Verify Set deletion behavior preserves snapshot evidence and USER deletion dependency is explicit.
- Verify failure leaves no partial migration under the repository's approved PostgreSQL/Prisma transaction convention.
- Register only the TASK-236 Streak migration harness in the guarded GitHub Actions workflow. Map the protected `CI_TEST_DATABASE_URL` secret process-locally to `TEST_DATABASE_URL`; do not hardcode, print or persist its value.
- Before any connection, require `CI=true`, `GITHUB_ACTIONS=true`, `NODE_ENV=test`, `TEST_DATABASE_ALLOW_RESET=true`, explicit Streak harness authorization and valid GitHub repository/run identity. Require an exact three-way match between the target identity derived from `TEST_DATABASE_URL`, `CI_TEST_DATABASE_IDENTITY` and the separately HUMAN-approved `STREAK_MIGRATION_APPROVED_TARGET_IDENTITY`.
- Keep workflow preparation, verification dispatch/database execution and recovery-only cleanup as separate authorization decisions. Workflow presence never grants permission to run either database command.
- Limit this entry point to isolated migration/constraint/no-backfill verification and its owned-schema cleanup. TASK-249 retains ownership of integrated Backend/real-stack CI registration and complete regression orchestration.
- In recovery-only mode, require separately authorized non-secret `STREAK_CLEANUP_TARGET_RUN_ID` and `STREAK_CLEANUP_TARGET_RUN_ATTEMPT`. Accept only positive-decimal-integer strings and validate them without conversion to a JavaScript number or any representation that can lose precision. Verification mode continues to use the real GitHub run ID and attempt and must reject recovery-target inputs.
- Never overwrite or simulate `GITHUB_REPOSITORY`, `GITHUB_RUN_ID` or `GITHUB_RUN_ATTEMPT`. Recovery cleanup must match the actual repository and the explicitly targeted historical run/attempt in both the schema name and ownership marker.
- Expose separate `workflow_dispatch` authorization paths for verification and recovery cleanup. Recovery inputs are invalid outside cleanup-only mode.

**Out of scope:** Preview/Development/Production access, seed/reset outside guarded CI workflow, application session behavior.

**AC / BR mapping:** Primary migration/constraint verification: AC-ST-02, AC-ST-18, AC-ST-25, AC-ST-28–31; BR-ST-007, BR-ST-030–031, BR-ST-039–040, BR-ST-042, BR-ST-045–046.

**Focused verification:** Statically validate the narrow workflow registration and fail-closed secret/identity wiring without dispatch. Offline tests cover valid historical targeting, invalid or missing target input, wrong run/attempt, wrong ownership marker and missing cleanup authorization. After separate explicit HUMAN authorization, run only the migration/constraint suite in the isolated guarded database and record command, identity class and results. No skipped case is PASS. Recovery cleanup is not implied by verification authorization and requires separate HUMAN approval if needed.

**Risks / rollback:** Migration harnesses are destructive by nature and must fail closed outside CI TEST. Normal harness finalization may remove only schemas created and ownership-registered by that run. A later recovery-only cleanup command may target only schemas whose exact repository/run/attempt ownership marker matches, and may run only under separate HUMAN authorization. Recovery cleanup must fail before deletion when any candidate ownership marker differs; an empty exact target is a successful no-op, not permission to broaden discovery. Do not create a down migration or automatically drop shared schema.

**HUMAN Gate ST-1:** STOP. HUMAN must accept exact DDL, constraint/no-backfill evidence and rollback preparation before Backend persistence implementation proceeds.

## Phase 2 — Backend session and Streak foundation

## TASK-237 — Implement deterministic session time and Streak projection domain

**Objective:** Add pure Backend domain logic for exact expiry, UTC+7 day assignment, lifecycle validation and current-Streak projection.

**Dependencies / prerequisites:** Gate ST-1 accepted.

**Expected files/modules:** New session/Streak service-domain modules under `backend/src/services/`; focused pure tests under `backend/test/streak/`.

**In scope:**

- Use exactly one authoritative server instant per operation for every time decision in its transaction: production uses the server clock and tests may inject that clock; do not mix time sources.
- Enforce validity only while `accepted_at < expires_at`; equality is expired.
- Convert Backend instant using explicit `Asia/Ho_Chi_Minh` and return ISO calendar dates.
- Preserve the UTC persistence convention for Streak `TIMESTAMP(3)` values and derive `activity_date` from that same authoritative instant.
- Project `0`, first day `1`, consecutive series, yesterday-active, missed-day `0`, restart at `1`, today completion and last qualified date.
- Keep projection mutation-free and omit `longest_streak`.

**Out of scope:** Prisma access, HTTP, frontend date calculation, cron/reset writes.

**AC / BR mapping:** Primary time/projection ownership: AC-ST-16–26; BR-ST-030–044.

**Focused verification:** Pure deterministic clock tests around `16:59:59.999Z`/`17:00:00.000Z`, expiry equality and date gaps. No database.

**Risks / rollback:** Implicit host timezone is a blocker. Keep functions isolated so they can be corrected without data migration.

**Review gate:** Domain review feeds Gate ST-2.

## TASK-238 — Implement session/Streak repositories and atomic lifecycle operations

**Objective:** Add transaction-scoped data access, locking, replay and daily uniqueness without duplicating existing Learning/Quiz persistence.

**Dependencies / prerequisites:** TASK-237 and Gate ST-1.

**Expected files/modules:** New `learning-session-repository` and `streak-repository` modules; `backend/src/create-app.js` for dependency wiring only when needed; focused repository tests.

**In scope:**

- Create session/items atomically; read by authenticated owner.
- Before commit, enforce item count equals immutable `snapshot_size`, positions are contiguous `0..snapshot_size - 1`, and no business repository update path can mutate snapshot fields or item membership/order.
- Lock session then item in the approved order; re-read state/expiry after lock.
- Enforce mode-compatible evidence and complete-group evidence in the service/repository boundary before terminal completion.
- Record evidence, terminal completion and `STREAK_DAY ... ON CONFLICT DO NOTHING` in a caller-provided transaction, deriving `STREAK_DAY.user_id` from the validated locked session owner rather than request data.
- Support exact creation/evidence/completion replay and reject mismatched identity reuse.
- Read descending Streak dates through the approved index.
- Preserve long-term records and terminal immutability.

**Out of scope:** SRS/Quiz business rules, controllers, new Prisma client, nested transactions, event-sourcing/analytics tables.

**AC / BR mapping:** Primary persistence/lifecycle ownership: AC-ST-02, AC-ST-07, AC-ST-14, AC-ST-18, AC-ST-24–30; supports AC-ST-32 read projection; BR-ST-003–007, BR-ST-014, BR-ST-028–029, BR-ST-035, BR-ST-038–046.

**Focused verification:** Fake transaction/unit tests first; guarded repository concurrency/rollback verification is consolidated in TASK-240 and TASK-249.

**Risks / rollback:** Lock-order mistakes can deadlock; partial writes can corrupt XP/session consistency. Repository accepts the existing transaction client and adds no autonomous commit.

**Review gate:** Feeds Gate ST-2.

## TASK-239 — Implement session lifecycle and Streak HTTP contracts

**Objective:** Expose authenticated USER create/read/NORMAL reveal/complete and Streak-read contracts exactly as approved.

**Dependencies / prerequisites:** TASK-237–238.

**Expected files/modules:** New session/Streak services, controllers and routes; existing auth/USER middleware; `backend/src/create-app.js`; focused HTTP tests.

**In scope:**

- Implement `POST /api/learning-sessions`, `GET /api/learning-sessions/:id`, NORMAL reveal/complete operations and the authoritative `GET /api/users/me/streak` read contract. Do not add `/api/streak` as an alias.
- Strict field allowlists, UUID/enums, mode-specific fields and unknown-field rejection.
- Backend Set access, ownership, membership, uniqueness, size and authoritative-order validation.
- Reject any normalized snapshot whose item count differs from `snapshot_size` or whose positions are not exactly contiguous; expose no business update path for immutable snapshot fields/items.
- Backend-authored SRS eligible snapshot; normalized proposed NORMAL/Quiz group.
- Empty/up-to-date outcomes without a qualifying session.
- Non-disclosing ownership errors, precise conflict mapping and terminal authoritative Streak response.
- Recheck Set existence/access/item membership before mutation; never shrink snapshot.

**Out of scope:** SRS/Quiz optional association, frontend, card content redesign, session list/history API.

**AC / BR mapping:** Primary API/session ownership: AC-ST-01–03, AC-ST-05–08, AC-ST-12, AC-ST-22, AC-ST-25, AC-ST-27, AC-ST-30 and AC-ST-32; BR-ST-001–005, BR-ST-009–012, BR-ST-015–016, BR-ST-022–024, BR-ST-030–031, BR-ST-039–043, BR-ST-045–046.

**Focused verification:** Controller/service validation and auth tests without DB first; guarded HTTP integration belongs to TASK-240.

**Risks / rollback:** Client-proposed IDs must never become trusted snapshot state. Routes are additive and can be reverted while additive tables remain.

**Review gate:** Feeds Gate ST-2.

## TASK-240 — Verify Backend foundation, security, lifecycle and concurrency

**Objective:** Establish guarded evidence before any frontend or Learning/Quiz integration.

**Dependencies / prerequisites:** TASK-237–239; explicit isolated CI TEST database authorization.

**Expected files/modules:** Focused service/HTTP/PostgreSQL tests under `backend/test/streak/`; existing auth/Set fixtures reused.

**In scope:**

- USER/Guest/ADMIN and cross-USER ownership matrix.
- Public System Set and owned private Set authorization.
- Normalized snapshot ordering/bounds/duplicates and SRS up-to-date behavior.
- Exact expiry, resume, completed immutability, Set deletion/item removal/access revocation.
- Duplicate reveal/completion, mismatched event reuse, parallel sessions and same-day unique insertion.
- Forced failures prove full rollback.

**Out of scope:** SRS/Quiz mutation integration and frontend browser tests.

**AC / BR mapping:** Foundation verification coverage: AC-ST-01–03, AC-ST-05–08, AC-ST-12, AC-ST-18, AC-ST-22–32; BR-ST-001–007, BR-ST-009–016, BR-ST-022–024, BR-ST-030–046.

**Focused verification:** Consolidated pure + guarded Backend foundation suite. Do not rerun unrelated full repository suites.

**Risks / rollback:** Any auth bypass, false completion, partial transaction or time-boundary failure is a STOP finding.

**HUMAN Gate ST-2:** STOP for review of schema-aligned behavior, authorization, idempotency, concurrency and error contracts.

## Phase 3 — NORMAL integration

## TASK-241 — Add shared frontend session service and reconciliation state

**Objective:** Bind existing mode-owned presentation state to Backend session identity without making the frontend authoritative.

**Dependencies / prerequisites:** Gate ST-2 accepted.

**Expected files/modules:** New frontend session/Streak API services; existing learning/Quiz run-state and sessionStorage modules; focused service/state tests.

**In scope:**

- Validate create/read/reveal/complete/Streak responses.
- Persist only Backend session UUID, expiry and presentation cursor/state.
- Version storage and safely discard incompatible old records.
- Reconcile Backend-ahead evidence after lost responses; never downgrade Backend state.
- Represent active, expired, inaccessible and completed states with restart/read behavior.

**Out of scope:** Qualification decisions, client dates, generic global session framework, Dashboard visual work.

**AC / BR mapping:** Primary frontend reconciliation ownership: AC-ST-14–15, AC-ST-24–27, AC-ST-30, AC-ST-36; supports all mode completion criteria without replacing their mode owners; BR-ST-003–004, BR-ST-014, BR-ST-028–029, BR-ST-039–046.

**Focused verification:** DB-independent API validator and state reducer/storage tests, including malformed responses and refresh/navigation replay.

**Risks / rollback:** Storage-version bugs can strand existing runs. Old records are discarded safely; they are never converted into qualifying evidence.

**Review gate:** Prerequisite for mode UI tasks.

## TASK-242 — Integrate and verify NORMAL reveal and explicit completion

**Objective:** Make current NORMAL groups qualifying only through Backend-accepted reveal evidence and explicit finish.

**Dependencies / prerequisites:** TASK-241 and Gate ST-2.

**Expected files/modules:** Existing learning page/run-state/API modules; focused unit and mocked Playwright learning tests.

**In scope:**

- Create a Backend NORMAL session for the current bounded ordered group.
- Send acknowledgement only on front-to-back reveal; retry failed acknowledgement without false completion.
- Enable finish from reconciled Backend evidence, not card position.
- Explicitly complete, consume authoritative terminal Streak and preserve navigation.
- Explain expiry/inaccessibility and allow explicit restart.
- Prove no Progress, SRS, XP reward, XP Toast or `total_xp` change.

**Out of scope:** Minimum view duration, attention proof, camera, scoring, SRS/Quiz changes.

**AC / BR mapping:** Primary NORMAL ownership: AC-ST-05–07; cross-cutting verification: AC-ST-16, AC-ST-18, AC-ST-24–30, AC-ST-36; BR-ST-006, BR-ST-009–014, BR-ST-039–046.

**Focused verification:** Learning state/service tests plus mocked browser flow for reveal, duplicate, failed request, finish, refresh/revisit and keyboard/focus behavior. One guarded DB assertion verifies no Progress/XP mutation; consolidate it with TASK-249 if Gate ST-3 does not require earlier DB evidence.

**Risks / rollback:** Request volume increases and failed acknowledgements can confuse local reveal state. Keep evidence status visible/retryable and never infer acceptance.

**HUMAN Gate ST-3:** STOP for NORMAL behavior, no-XP proof and focused interaction review.

## Phase 4 — SRS integration

## TASK-243 — Associate accepted SRS ratings with qualifying sessions atomically

**Objective:** Extend `recordMeaningfulEvent` with optional session association while preserving all current scheduling/Progress/XP behavior.

**Dependencies / prerequisites:** Gate ST-3 accepted; TASK-238 transaction API available.

**Expected files/modules:** Existing Learning service/repository/controller/route and frontend Learning service/page/state; focused SRS/Streak tests.

**In scope:**

- Add optional `session_id`; absent follows the unchanged legacy path.
- Validate same USER/session/mode/Set/unresolved snapshot item before current event logic.
- Keep existing replay-first, revision, scheduler, Progress and XP semantics.
- `AGAIN` stays unresolved; HARD/GOOD/EASY stores resolution.
- Final resolution completes session and inserts Streak Day inside the existing transaction.
- Exact replay returns original learning/reward plus current authoritative session/Streak projection.
- Preserve frontend requeue, retry, focus and XP Toast behavior.

**Out of scope:** Scheduler/rating/XP rule changes, automatic completion request, NORMAL or Quiz behavior.

**AC / BR mapping:** Primary SRS ownership: AC-ST-08–11; cross-cutting transaction/recovery ownership: AC-ST-18, AC-ST-24–30, AC-ST-36; BR-ST-006, BR-ST-015–022, BR-ST-039–046; PLAN decisions 7–8.

**Focused verification:** Pure/mocked Learning tests during implementation; DB concurrency/rollback and broader regression in TASK-244.

**Risks / rollback:** Highest risk is partial Progress/XP/session writes. The sessionless branch is the rollback-compatible behavior and must not call Streak persistence.

**Review gate:** Prepares Gate ST-4.

## TASK-244 — Verify SRS atomicity, replay, legacy compatibility and XP regressions

**Objective:** Produce focused evidence for Learning/XP-sensitive integration.

**Dependencies / prerequisites:** TASK-243; explicit guarded CI TEST database authorization.

**Expected files/modules:** Focused Streak/SRS integration tests plus existing Learning, SRS scheduler and XP suites where assertions belong.

**In scope:**

- Initial queue order/bound, AGAIN requeue, every passing rating and final resolution.
- Items becoming due after creation remain excluded.
- Lost response replay, stale revisions, concurrent tabs and cross-session rejection.
- Atomic rollback at Progress, XP, evidence, completion and Streak writes.
- Positive/zero XP outcomes remain independent from Streak.
- Sessionless request/response/Progress/XP behavior remains unchanged and creates no Streak Day.

**Out of scope:** Quiz integration or full browser regression.

**AC / BR mapping:** Primary SRS verification: AC-ST-08–11; regression/atomic evidence: AC-ST-18, AC-ST-24–30, AC-ST-36; BR-ST-006, BR-ST-015–022, BR-ST-039–046.

**Focused verification:** Consolidated SRS/Streak/XP pure and guarded integration suites; unchanged scheduler suite; one focused mocked browser SRS regression. Avoid a full real-stack run until TASK-249.

**Risks / rollback:** Any XP identity, scheduler, revision or rollback regression is blocking and returns to TASK-243.

**HUMAN Gate ST-4:** STOP. HUMAN must accept Learning/XP atomicity and legacy evidence before Quiz integration.

## Phase 5 — Quiz integration

## TASK-245 — Bind Quiz questions and answers to Backend sessions

**Objective:** Use the Learning Session UUID as session-aware Quiz `run_id` and record every accepted answer atomically.

**Dependencies / prerequisites:** Gate ST-4 accepted.

**Expected files/modules:** Existing Quiz service/domain/repository/controller/route and frontend Quiz service/page/state; focused Quiz/Streak tests.

**In scope:**

- Session-aware questions use immutable session snapshot and `run_id = session_id`.
- Legacy `run_id`/`vocabulary_ids` query remains valid without `session_id`.
- Optional answer `session_id` must equal `run_id` and identify an unanswered snapshot item.
- Preserve question revision, four-choice validation, hidden answer, grading, Progress and XP.
- Both correct and incorrect accepted answers store evidence; final answer completes atomically.
- Zero-correct run qualifies; revisit does not resubmit; retake creates a genuinely new session/run.
- Preserve feedback, focus/live region, result summary and XP Toast semantics.

**Out of scope:** New Quiz types, answer history API, score persistence, XP changes.

**AC / BR mapping:** Primary Quiz ownership: AC-ST-12–15; cross-cutting transaction/recovery ownership: AC-ST-18, AC-ST-24–30, AC-ST-36; BR-ST-006, BR-ST-023–029, BR-ST-039–046; PLAN decisions 5, 7 and 8.

**Focused verification:** Unit/mocked API/browser tests during implementation; DB atomicity and regression in TASK-246.

**Risks / rollback:** A run/session mismatch could expose or grade the wrong question. Fail closed before current grading; sessionless compatibility remains available.

**Review gate:** Prepares Gate ST-5.

## TASK-246 — Verify Quiz zero-correct, replay, retake and XP regressions

**Objective:** Produce focused Quiz/XP-sensitive evidence before Dashboard work.

**Dependencies / prerequisites:** TASK-245; explicit guarded CI TEST database authorization.

**Expected files/modules:** Focused Streak/Quiz integration tests plus existing Quiz, XP and browser suites.

**In scope:**

- Correct/incorrect evidence and an all-incorrect completed qualifying session.
- Deterministic questions bound to the session; invalid choice/revision/run rejected.
- Exact answer replay, concurrent submissions, completed-result revisit and fresh retake.
- Atomic rollback across Progress, reward, evidence, completion and Streak.
- First-correct XP dedupe remains unchanged and independent of Streak.
- Sessionless questions/answers remain compatible and create no Streak Day.

**Out of scope:** Dashboard, broad real-stack regression.

**AC / BR mapping:** Primary Quiz verification: AC-ST-12–15; regression/atomic evidence: AC-ST-18, AC-ST-24–30, AC-ST-36; BR-ST-006, BR-ST-023–029, BR-ST-039–046.

**Focused verification:** Consolidated Quiz/Streak/XP unit, guarded integration and focused mocked browser suites. Reuse current fixtures; do not add a new framework.

**Risks / rollback:** Any grading, answer secrecy, Progress or XP regression is blocking and returns to TASK-245.

**HUMAN Gate ST-5:** STOP for Quiz/XP atomicity, zero-correct and legacy compatibility acceptance.

## Phase 6 — Streak read and Dashboard

## TASK-247 — Add the compact USER Dashboard Streak card

**Objective:** Integrate the dedicated Streak read into Dashboard without redesigning Level/XP.

**Dependencies / prerequisites:** Gate ST-5 accepted; TASK-239 Streak endpoint and TASK-241 frontend service complete.

**Expected files/modules:** Existing Dashboard page/styles and focused Dashboard tests; frontend Streak service as needed.

**In scope:**

- USER-only independent read source; ADMIN must not call it.
- Compact value/status card using existing tokens and layout conventions.
- Truthful loading, completed-today, pending-today, broken/zero and stale/error/retry states.
- Accessible semantic heading/value, non-color status, live announcements and keyboard retry.
- Consume Backend fields only; never calculate Streak or day in frontend.

**Out of scope:** Weekly calendar, history, longest Streak, Daily Goal, Level/XP redesign, charts.

**AC / BR mapping:** Primary Streak-read/Dashboard ownership: AC-ST-16–21, AC-ST-32–34; BR-ST-030–038.

**Focused verification:** Component/service tests and mocked Dashboard browser states. Build/lint wait for consolidated TASK-248 unless a failure needs earlier diagnosis.

**Risks / rollback:** Independent source failure must not break other Dashboard cards. Card can be reverted without deleting durable data.

**Review gate:** Prepares Gate ST-6.

## TASK-248 — Complete focused frontend, accessibility and responsive verification

**Objective:** Verify all changed NORMAL/SRS/Quiz/Dashboard frontend surfaces and obtain HUMAN visual acceptance.

**Dependencies / prerequisites:** TASK-242, TASK-244, TASK-246 and TASK-247 complete.

**Expected files/modules:** Existing frontend unit/E2E fixtures/tests; UI/UX review evidence paths outside generated/committed artifacts unless approved.

**In scope:**

- Run focused state/service/browser tests for reconciliation, expiry/restart, lost response and completed revisit.
- Run frontend lint and production build once for the integrated frontend delta.
- Apply `ui-ux-review` in **Focused** mode at 320, 375, 768, 1024 and 1440 CSS px, affected breakpoint edges, narrow content container and effective 200% zoom.
- Keyboard-only flow, visible/logical focus, live regions, reduced motion, 44px targets where required, Vietnamese wrapping and horizontal overflow.
- Capture meaningful screenshots for NORMAL recovery/completion and Dashboard state/layout; do not claim unexecuted viewports.
- Confirm no duplicate XP/Streak feedback and no change to Level/XP card.

**Out of scope:** Full-site UI audit, subjective redesign, protected-database browser writes.

**AC / BR mapping:** Primary UI/accessibility verification: AC-ST-33–34; mode/recovery regression coverage: AC-ST-05–15, AC-ST-24–27, AC-ST-36; BR-ST-009–029, BR-ST-039–045.

**Focused verification:** One consolidated frontend unit/lint/build/browser run plus Focused UI/UX report. Mocked APIs by default.

**Risks / rollback:** UI may imply completion before Backend acceptance. Any misleading state, inaccessible control or overflow is corrected before gate review.

**HUMAN Gate ST-6:** STOP for HUMAN browser/visual approval. Approval is not release acceptance.

## Phase 7 — Integrated verification, documentation and release readiness

## TASK-249 — Run guarded integrated concurrency, compatibility and regression verification

**Objective:** Verify complete real-stack behavior and affected legacy surfaces once, after all integrations converge.

**Dependencies / prerequisites:** Gate ST-6 accepted; explicit isolated CI TEST environment authorization.

**Expected files/modules:** Guarded backend/real-stack tests, existing fixtures/helpers and CI workflow registration only when required by established conventions.

**In scope:**

- One successful real-stack path per NORMAL, SRS and Quiz; zero-correct Quiz and SRS AGAIN/final resolution.
- UTC+7 midnight, exact expiry, parallel sessions, concurrent same-session and same-day completions.
- Failure injection proves atomic rollback including XP/Progress.
- Dashboard projection and same-day dedupe.
- Sessionless SRS/Quiz compatibility and Speaking read-only/non-qualifying behavior.
- Legacy impact scan across callers, mocks, fixtures, validators, parameters, selectors, docs and maintained tests; classify stale/negative/historical/unrelated references.
- Run affected Authentication, Set authorization, Learning, SRS, Quiz, XP/Level, Dashboard and Speaking regressions proportionally; avoid unrelated full-suite duplication unless integration failures justify it.

**Out of scope:** Preview TEST, Production, manual XP writes, migration deployment.

**AC / BR mapping:** Integrated regression coverage for AC-ST-01–36 and BR-ST-001–046; this task is not primary implementation ownership.

**Focused verification:** Guarded backend DB integration and real-stack browser suites, plus one consolidated quality summary. Static compatibility review is `NOT RUN` for runtime behavior until the guarded suite executes.

**Risks / rollback:** CI fixture cleanup must remain isolated. Any environment identity mismatch stops before database access.

**Review gate:** Required evidence for TASK-251; not itself formal TEST acceptance.

## TASK-250 — Synchronize verified Streak documentation

**Objective:** Update official documentation to match only verified implementation behavior.

**Dependencies / prerequisites:** TASK-249 evidence available; Gate ST-6 accepted.

**Expected files/modules:** `docs/PROJECT_OVERVIEW.md`, `DATABASE.md`, `API_SPEC.md`, `UI_UX_SPEC.md`, `FEATURE_STATUS.md`; `ARCHITECTURE.md` only if a verified boundary changed.

**In scope:**

- Record qualifying modes, session lifecycle, schema/constraints/retention, API compatibility, UTC+7 projection and Dashboard card.
- Explicitly exclude Speaking, Daily Goal, Freeze, longest Streak and weekly calendar.
- Record no-backfill and environment/deployment state truthfully.
- Keep Streak `IN_PROGRESS`; do not mark `DONE` before formal TEST, REVIEW and HUMAN acceptance.

**Out of scope:** Rewriting approved SPEC/PLAN/TASK, documenting unimplemented behavior, unrelated feature status changes.

**AC / BR mapping:** Documentation trace for AC-ST-01–36 and BR-ST-001–046, including the authoritative `GET /api/users/me/streak` contract.

**Focused verification:** Documentation consistency, local link/path checks, stale terminology scan, secrets/generated-artifact scan and `git diff --check`.

**Risks / rollback:** Documentation can incorrectly imply Preview migration/deployment. Distinguish implementation acceptance, merge status and database deployment status.

**Review gate:** Required input to formal TEST/REVIEW.

## TASK-251 — Perform formal Streak V1 TEST

**Objective:** Produce an evidence-backed TEST verdict against every approved criterion and rule.

**Dependencies / prerequisites:** TASK-249 PASS evidence and TASK-250 documentation; no unresolved required implementation failure.

**Expected files/modules:** New formal report under `docs/testing/`; no production changes during TEST.

**In scope:**

- Map AC-ST-01–36 individually to executed evidence or truthful `NOT RUN/BLOCKED` status.
- Confirm all BR-ST-001–046 through grouped and edge-case evidence.
- Separate unit, HTTP integration, guarded PostgreSQL, mocked browser, guarded real-stack, lint and build results.
- Record environment identity and legacy/regression scan classifications.
- FAIL returns to the owning implementation task; design issue returns to PLAN; requirement conflict returns to SPEC.

**Out of scope:** Fixing source during TEST, claiming skipped checks PASS, Preview migration/deployment.

**AC / BR mapping:** Formal verification coverage for AC-ST-01–36 and BR-ST-001–046; this task does not own implementation.

**Focused verification:** Reuse TASK-249 and TASK-248 evidence; rerun only missing, stale or failure-affected checks. No redundant full suite without cause.

**Risks / rollback:** Evidence age or commit mismatch invalidates reuse. TEST cannot mark the feature `DONE`.

**HUMAN gate:** HUMAN must accept formal TEST before TASK-252 starts.

## TASK-252 — Perform formal REVIEW and prepare release recommendation

**Objective:** Review scope, architecture, security, database/API/frontend consistency, regression impact and release readiness.

**Dependencies / prerequisites:** TASK-251 PASS accepted by HUMAN.

**Expected files/modules:** New formal report under `docs/reviews/`; `FEATURE_STATUS.md` remains `IN_PROGRESS` until final HUMAN acceptance.

**In scope:**

- Review SPEC/PLAN/TASK traceability, actual diff and expected file inventory.
- Review auth/ownership, Backend authority, DB constraints/FKs, API compatibility, transaction/replay/concurrency and deletion/retention implications.
- Review XP/SRS/Quiz/Speaking regressions and Dashboard accessibility evidence.
- Classify findings by repository severity and issue APPROVE, CHANGES_REQUIRED or BLOCKED.
- Prepare exact migration/deployment preconditions, backup/recovery needs and rollback options.

**Out of scope:** Source fixes, merge, Preview migration/deployment, status `DONE` without HUMAN Gate ST-7 acceptance.

**AC / BR mapping:** Independent review coverage for AC-ST-01–36 and BR-ST-001–046; this task does not own implementation.

**Focused verification:** Review evidence and targeted static checks only; do not automatically rerun passing suites.

**Risks / rollback:** Passing tests do not override architecture/security findings. Any BLOCKER/HIGH issue returns to the correct workflow stage.

**HUMAN Gate ST-7:** STOP. HUMAN decides final implementation acceptance and any Git publication. No merge or database action is implied.

## TASK-253 — Execute separately authorized Preview TEST migration/deployment and closure

**Objective:** Provide a gated release task for Preview TEST only after source acceptance and separate explicit authorization.

**Dependencies / prerequisites:** Gate ST-7 accepted; reviewed commit/PR/checks; separate HUMAN authorization for Git operations, backup/preflight, Preview TEST migration and deployment; verified Preview identity and current recoverable backup.

**Expected files/modules:** Normally no application changes. Deployment/status evidence and final documentation only when explicitly authorized.

**In scope, only when separately authorized:**

1. Confirm exact branch/commit/PR/check state and no unexpected worktree files.
2. Perform read-only Preview TEST preflight: identity, migration history, compatibility and current data snapshots without credentials disclosure.
3. Verify current backup checksum/archive listing and recovery readiness.
4. Apply only the committed Streak migration using approved Prisma deploy procedure; no reset/db push/seed/manual SQL.
5. Read-only post-migration verification of history, constraints, zero backfill and preserved records.
6. Deploy compatible Backend before/with Frontend; confirm revision routing and health without learning submissions.
7. Run only separately authorized non-destructive smoke/read checks; record residual risks.
8. Synchronize deployment status. Mark `DONE` only after all required gates and explicit HUMAN closure acceptance.

**Out of scope:** Production, destructive rollback, automatic restore, branch deletion, force push, database test writes, Streak/XP farming.

**AC / BR mapping:** Deployment/regression evidence for AC-ST-01–36 and preservation of BR-ST-001–046; this task introduces no implementation ownership or new behavior.

**Focused verification:** Exact target SHA, migration status, schema inventory, zero historical session/day rows immediately after migration, preserved USER/Progress/XP counts and service health. Stop on any mismatch.

**Risks / rollback:** Backup without restore proof leaves residual recovery risk for HUMAN acceptance. Failure stops without retry/reset/restore; present sanitized recovery options.

**HUMAN Gate ST-8:** STOP before every database/deployment action unless explicitly authorized. Preview success does not authorize Production.

## 5. Acceptance-criteria traceability

The table distinguishes implementation ownership from later regression/formal evidence. TASK-249, TASK-251 and TASK-252 cover the whole approved set only as integrated verification, formal TEST and formal REVIEW; they do not replace the primary owners below.

| Acceptance criterion meaning | Primary implementation / focused verification owner |
|---|---|
| AC-ST-01 authorization and USER isolation | TASK-239–240 |
| AC-ST-02 immutable bounded authorized sessions | TASK-235, TASK-239–240 |
| AC-ST-03 non-learning actions/unfinished exit do not qualify | TASK-239–240 |
| AC-ST-04 Speaking has no Streak effect | TASK-249 regression scan/verification; no production integration task |
| AC-ST-05–07 NORMAL reveal, explicit completion, idempotency and zero XP/Progress | TASK-239, TASK-242 |
| AC-ST-08–11 SRS snapshot, AGAIN, final resolution and unchanged Progress/SRS/XP | TASK-239, TASK-243–244 |
| AC-ST-12–15 Quiz answers, zero-correct, result replay and genuine retake | TASK-239, TASK-245–246 |
| AC-ST-16–21 first/consecutive/same-day/yesterday/break projection | TASK-237–238, TASK-247 |
| AC-ST-22–23 Backend UTC+7 completion date and midnight boundary | TASK-237, TASK-239–240 |
| AC-ST-24 cross-midnight session completes on eventual date | TASK-237–241 plus mode tasks TASK-242–246 |
| AC-ST-25 exact seven-day expiry boundary | TASK-235–240 |
| AC-ST-26 expiry preserves committed Progress/SRS/XP | TASK-237–240, TASK-244, TASK-246 |
| AC-ST-27 exact replay has no duplicate completion/day/XP | TASK-238–246 |
| AC-ST-28 concurrent completion and same-day uniqueness | TASK-235–240, TASK-244, TASK-246 |
| AC-ST-29 terminal transaction rollback | TASK-236, TASK-238–240, TASK-244, TASK-246 |
| AC-ST-30 Set/access/item changes cannot shrink completion | TASK-238–241 |
| AC-ST-31 no-backfill migration and preserved existing data | TASK-235–236 |
| AC-ST-32 isolated side-effect-free `GET /api/users/me/streak` contract | TASK-239 and TASK-247 |
| AC-ST-33–34 truthful, accessible and responsive Dashboard | TASK-247–248 |
| AC-ST-35 excluded features remain absent | TASK-249–250 scope/regression verification |
| AC-ST-36 local recovery cannot bypass Backend authority | TASK-241–246, TASK-248–249 |

Formal individual evidence for all 36 criteria is produced by TASK-251 and independently reviewed by TASK-252.

## 6. Business-rule traceability

| Business rules | Primary tasks |
|---|---|
| BR-ST-001–008 | Primary: TASK-239–240; exclusions/regression: TASK-249 |
| BR-ST-009–014 | Primary: TASK-239, TASK-241–242; regression: TASK-248–249 |
| BR-ST-015–022 | Primary: TASK-239, TASK-243–244; regression: TASK-249 |
| BR-ST-023–029 | Primary: TASK-239, TASK-245–246; regression: TASK-249 |
| BR-ST-030–038 | Primary: TASK-235–240, TASK-247; regression: TASK-249 |
| BR-ST-039–046 | Primary: TASK-235–246 according to mode/lifecycle responsibility; regression: TASK-249 |

Formal rule coverage for all 46 rules is confirmed in TASK-251 and TASK-252.

## 7. Mandatory STOP gates

1. **ST-1:** No database execution before exact migration review and explicit isolated CI TEST authorization.
2. **ST-2:** No mode integration before Backend lifecycle/auth/concurrency foundation is accepted.
3. **ST-3:** NORMAL must prove explicit completion and zero Progress/XP before SRS integration proceeds.
4. **ST-4:** SRS/XP-sensitive transaction evidence requires HUMAN acceptance before Quiz integration.
5. **ST-5:** Quiz/XP-sensitive grading/transaction evidence requires HUMAN acceptance before Dashboard integration.
6. **ST-6:** Focused UI/UX and HUMAN browser approval are required before integrated final verification.
7. **ST-7:** Formal TEST and REVIEW plus HUMAN acceptance are required before Git publication/merge or shared-environment work.
8. **ST-8:** Preview TEST backup, migration and deployment each require separate explicit HUMAN authorization. No Production action is included.

## 8. Preservation and execution rules

- Preserve untracked Speaking fixture, approved documents, unrelated worktree changes, stash, worktrees and private backups.
- Do not switch branches, clean, reset, auto-stash, force-push or stage unrelated files.
- Use existing dependencies, test framework, fixtures, auth middleware, sessionStorage conventions and Toast behavior.
- Stop on PLAN/SPEC conflict; do not hide a new technical decision inside a task.
- No task removes sessionless compatibility in V1.
- No task marks Streak `DONE` before TEST, REVIEW, all mandatory gates and explicit HUMAN acceptance.
- Documentation/task approval is not implementation, database, Git, CI or deployment authorization.

## 9. TASK readiness

This document maps all 19 tasks to the HUMAN-approved PLAN, all 36 acceptance criteria and all 46 business rules. It is ready for HUMAN TASK review. Implementation must not start until HUMAN explicitly approves this decomposition and authorizes the relevant task/gate.
