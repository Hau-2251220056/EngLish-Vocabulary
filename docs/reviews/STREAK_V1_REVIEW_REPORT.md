# REVIEW REPORT: Streak V1

## 1. Metadata and reviewed SHAs

- **Task:** TASK-252 — Formal REVIEW and release recommendation.
- **Repository / branch:** `Hau-2251220056/EngLish-Vocabulary` / `feature/streak-v1`.
- **Feature baseline:** `e3f5dd18193fbfee23c1ea5cdc2aa3fdee150e59`.
- **Reviewed HEAD:** `d1e04081dec59c43d04ec2fa35513275ea322ba3`.
- **Accepted implementation evidence SHA:** `189e1da9934758a87d88f19faa97db715376c0b1`.
- **Documentation SHA:** `1df63db3674dd1cdf10f06da27f900809c1b7ad5`.
- **Formal TEST report SHA:** `d1e04081dec59c43d04ec2fa35513275ea322ba3`.
- **Review method:** independent static inspection of the complete committed feature diff, source context, tests, accepted evidence and official documentation. No test, CI, browser, Prisma, migration or PostgreSQL command was executed during TASK-252.
- **Feature state:** `IN_PROGRESS`.
- **Gate ST-7:** `PENDING`.

The final HUMAN-approved [SPEC](../specs/STREAK_V1_SPEC.md), [PLAN](../plans/STREAK_V1_PLAN.md) and [TASK](../tasks/STREAK_V1_TASK.md) are authoritative. Final SPEC meanings are used for AC-ST-01–36 and BR-ST-001–046. The older PLAN test-strategy numbering drift is historical and is not silently substituted.

## 2. Scope and evidence

This review covers scope, architecture, Backend authority, authentication/authorization/ownership, database and migration safety, API compatibility, frontend state/accessibility, regression impact, CI/data safety, documentation consistency and release readiness.

Accepted execution evidence is reused, not claimed as rerun:

- TASK-249: HUMAN ACCEPTED — PASS.
- Run #94, ID `39394932196`, attempt `1`: Trust Gate PASS; Foundation PostgreSQL `27/27 PASS`; focused real-stack Chromium Playwright `1/1 PASS`; eleven migrations applied in each isolated run-owned schema.
- Gate ST-5 and Gate ST-6: HUMAN ACCEPTED.
- TASK-250: HUMAN ACCEPTED and published.
- TASK-251: Independent Review PASS with zero findings; HUMAN ACCEPTED and published.
- Fixture cleanup, foundation marker-validated cleanup and the integrated marker-validated cleanup routine: VERIFIED by accepted evidence.
- Independent post-drop catalog confirmation of integrated-schema absence: **NOT VERIFIED / NOT PERFORMED**.

Static inspection was used to judge whether implementation and tests support those results. Source inspection is not represented as runtime PASS evidence.

## 3. Feature diff and file inventory

Git reports 87 tracked files, 15,993 insertions and 287 deletions from baseline through reviewed HEAD. No tracked file was deleted; no binary artifact or unexpected dependency was added.

| Responsibility | Count | Reviewed inventory |
|---|---:|---|
| Database / Prisma / migration | 3 | `backend/prisma/schema.prisma`; both `20261017...add_streak_v1` and `20261018...add_streak_srs_receipt` migrations |
| Backend domain | 5 | Learning-session and Streak repositories; session domain/persistence; Streak domain |
| Backend service / API | 11 | `backend/package.json`; Learning/Quiz/session controllers, routes, app wiring, repositories and services |
| Frontend / UI | 12 | Dashboard, Learning and Quiz pages/state; session storage; Learning/Quiz/session services |
| Tests and fixtures | 44 | Backend Streak/Quiz/XP tests and harnesses; frontend unit, mocked-browser and real-stack fixtures/configuration |
| CI / workflow safety | 2 | Guarded integration workflow and read-only historical verification workflow |
| Documentation / evidence | 10 | Six official documents, SPEC, PLAN, TASK and Formal TEST report |
| Unclassified | 0 | None |

The complete path inventory was enumerated and inspected by responsibility. The implementation matches the PLAN’s expected service/repository/session/API/Dashboard/migration footprint. Small combined controller/route choices are permitted by PLAN section 14. The committed historical read-only verification workflow is test-safety tooling and does not change product behavior. The six uncommitted recovery/bootstrap paths are excluded from this verdict.

## 4. AC/BR traceability

### 4.1 Acceptance criteria

| ID | Independent source judgment | Evidence judgment | Result |
|---|---|---|---|
| AC-ST-01 | USER middleware plus owned-session queries conceal guest/ADMIN/foreign identities | Auth matrix and foreign replay evidence | PASS |
| AC-ST-02 | Server validates bounded ordered snapshots and stores immutable scalar identities | Migration constraints and snapshot tests | PASS |
| AC-ST-03 | Only terminal qualifying completion calls atomic day insertion | HTTP negatives and integrated persisted counts | PASS |
| AC-ST-04 | Speaking has no session/Streak mutation path | Real-stack before/after assertion | PASS |
| AC-ST-05 | NORMAL completion requires complete durable reveal evidence | HTTP and real-stack NORMAL evidence | PASS |
| AC-ST-06 | Navigation does not create reveal evidence | Mocked NORMAL and incomplete-group rejection | PASS |
| AC-ST-07 | Reveal event identity is idempotent; NORMAL bypasses Progress/XP | HTTP, PostgreSQL and real-stack assertions | PASS |
| AC-ST-08 | Backend selects, orders and bounds SRS snapshot | Foundation snapshot/later-due tests | PASS |
| AC-ST-09 | `AGAIN` writes a receipt but no resolving session evidence | Foundation/service/browser evidence | PASS |
| AC-ST-10 | Only all-passing initial SRS items complete the session | Foundation and real-stack final-resolution path | PASS |
| AC-ST-11 | Session-aware branch preserves scheduler/Progress/XP transaction | SRS and XP regression evidence | PASS |
| AC-ST-12 | Quiz completes only after all snapshot items have evidence | Foundation multi-item zero-correct path | PASS |
| AC-ST-13 | Incorrect evidence qualifies terminal zero-correct Quiz without fabricated XP | PostgreSQL and real-stack assertions | PASS |
| AC-ST-14 | Completed Quiz replay reconciles immutable terminal state | Foundation and mocked revisit evidence | PASS |
| AC-ST-15 | Retake creates a distinct Backend session/run | Foundation and mocked identity evidence | PASS |
| AC-ST-16 | First qualifying day projects one | Domain, foundation and real-stack evidence | PASS |
| AC-ST-17 | Consecutive application dates increment once | Domain projection evidence | PASS |
| AC-ST-18 | DB uniqueness deduplicates same USER/date across modes | Concurrency and real-stack stored-count evidence | PASS |
| AC-ST-19 | Yesterday-ending sequence remains while today is pending | Domain projection evidence | PASS |
| AC-ST-20 | Missed application day projects zero without deletion | Domain projection evidence | PASS |
| AC-ST-21 | Next qualification after a break starts at one | Domain and insertion behavior | PASS |
| AC-ST-22 | Backend operation time and IANA UTC+7 conversion own award date | Domain/API static evidence | PASS |
| AC-ST-23 | Exact UTC+7 midnight boundary is explicitly tested | Domain and guarded PostgreSQL evidence | PASS |
| AC-ST-24 | Completion date comes from accepted instant, not creation/client time | Domain and reconciliation evidence | PASS |
| AC-ST-25 | Equality at seven days is rejected (`acceptedAt < expiresAt`) | Domain and post-lock expiry evidence | PASS |
| AC-ST-26 | Expiry rejection does not reverse previously committed Progress/SRS/XP | Service and guarded rollback evidence | PASS |
| AC-ST-27 | Creation/evidence/completion identities prevent duplicate day/XP | Repository and mode replay evidence | PASS |
| AC-ST-28 | Owned row/item locks plus DB uniqueness serialize terminal races | Guarded SRS/Quiz/same-day concurrency | PASS |
| AC-ST-29 | Evidence, Progress, XP, completion and day share the terminal transaction | Injected failure/rollback evidence | PASS |
| AC-ST-30 | Completion revalidates current Set access and every snapshot item | Foundation deletion/revocation tests | PASS |
| AC-ST-31 | Additive migrations create no backfill and preserve legacy data | Gate ST-1 migration evidence | PASS |
| AC-ST-32 | USER-isolated Streak read projects dates without writes | HTTP and real-stack API/Dashboard evidence | PASS |
| AC-ST-33 | Dashboard implements zero, positive, pending, failure, stale and retry states | Mocked Dashboard plus real-stack projection | PASS |
| AC-ST-34 | Semantics, keyboard/focus, reduced motion and responsive layouts are implemented | Gate ST-6 automated/HUMAN evidence | PASS WITH LIMITATION |
| AC-ST-35 | Freeze, Daily Goal, longest Streak, calendar/history and Speaking qualification remain absent | Static, documentation and real-stack exclusions | PASS |
| AC-ST-36 | Stored frontend state only reconciles/retries Backend identities and cannot award locally | Mocked recovery plus Backend rejection evidence | PASS |

AC coverage: **35 PASS; 1 PASS WITH LIMITATION; 0 FINDING; 0 NOT VERIFIED**. AC-ST-34 retains the no-manual-screen-reader limitation.

### 4.2 Business rules

Every final rule was independently checked against its implementing boundary:

| IDs | Source-level judgment | Result |
|---|---|---|
| BR-ST-001, BR-ST-002, BR-ST-003, BR-ST-004, BR-ST-005, BR-ST-006, BR-ST-007, BR-ST-008 | USER/mode boundaries, immutable complete snapshot, exclusions, independent XP and same-day uniqueness match SPEC | PASS |
| BR-ST-009, BR-ST-010, BR-ST-011, BR-ST-012, BR-ST-013, BR-ST-014 | NORMAL ordered snapshot, reveal evidence, explicit completion, zero Progress/XP and replay behavior match SPEC | PASS |
| BR-ST-015, BR-ST-016, BR-ST-017, BR-ST-018, BR-ST-019, BR-ST-020, BR-ST-021, BR-ST-022 | SRS Backend queue, unresolved AGAIN, passing resolution, completion, later-due exclusion, scheduler/XP and no-eligible behavior match SPEC | PASS |
| BR-ST-023, BR-ST-024, BR-ST-025, BR-ST-026, BR-ST-027, BR-ST-028, BR-ST-029 | Quiz run/snapshot identity, all-answer completion, correct/incorrect evidence, zero-correct qualification, grading/XP, replay and retake match SPEC | PASS |
| BR-ST-030, BR-ST-031, BR-ST-032, BR-ST-033, BR-ST-034, BR-ST-035, BR-ST-036, BR-ST-037, BR-ST-038 | UTC+7 Backend time, empty/first/consecutive/same-day/yesterday/missed-day projections and retained history match SPEC | PASS |
| BR-ST-039, BR-ST-040, BR-ST-041, BR-ST-042, BR-ST-043, BR-ST-044, BR-ST-045, BR-ST-046 | Backend clock, exact expiry, reconciliation, completion date, expiry rejection, committed-state preservation and concurrency match SPEC | PASS |

BR coverage: **46 explicitly covered; 46 PASS; 0 FINDING; 0 NOT VERIFIED**.

## 5. Scope and architecture review

- Backend flow remains route → middleware → controller → service → repository/Prisma. Controllers only translate requests/results; critical decisions remain in services/repositories.
- Frontend flow remains page/state → service → authenticated API. Client validators reject malformed projections but do not calculate authoritative Streak, grade answers or award XP.
- Exactly NORMAL, SRS and Multiple Choice Quiz can qualify. Speaking and deferred gamification/UI features remain outside scope.
- No new role, external service, analytics/history product, cron, leaderboard, Streak Freeze, Daily Goal integration or `longest_streak` was introduced.
- Official architecture documents the verified persistent Learning Session boundary. No undocumented architecture change was found.

No scope or architecture finding.

## 6. Backend authority and domain logic

- Session creation validates strict fields, USER/Set access, ordered membership, distinct bounded IDs and replay identity (`learning-session-service.js:37-101`, `372-387`).
- Current Set access and all snapshot items are locked/revalidated before evidence or completion; changed membership rejects rather than shrinks a denominator (`learning-session-service.js:251-285`).
- NORMAL reveal is durable and mode-compatible; completion delegates to the shared atomic terminal function (`learning-session-service.js:124-194`).
- SRS locks the owned session and items, preserves `AGAIN` as unresolved, records durable event/revision receipts and completes only after every initial item resolves (`learning-service.js:294-497`).
- Quiz requires `session_id === run_id`, validates the exact item, records authoritative correct/incorrect evidence and completes on the last resolved item (`quiz-service.js:101-149`).
- Atomic completion locks the owned session/items, validates the complete evidence group, captures one authoritative instant, updates terminal state and inserts the Streak day in the caller transaction (`learning-session-persistence.js:9-81`).
- Streak uses `Asia/Ho_Chi_Minh` and derives today/yesterday/missed-day projection from durable dates (`streak-domain.js:2-70`).

No Backend-authority or domain-logic finding.

## 7. Authentication, authorization and ownership

- All Learning Session and Streak routes compose authentication plus USER-role middleware (`learning-session-routes.js:4-18`; `create-app.js:165-188`).
- Controllers derive USER identity exclusively from `req.user.id`; no owner ID is accepted from request bodies.
- Session read/lock queries include both session ID and USER ID (`learning-session-repository.js:72-75`, `165-175`).
- Set access is revalidated during terminal work. Foreign/missing sessions share the non-disclosing not-found path.
- Event, operation, run, Set and vocabulary identities are strictly validated; replay identity mismatch fails closed.
- API projections contain session state/evidence and safe Streak fields, not credentials, password data or hidden Quiz correctness before submission.

No credible privilege escalation, cross-USER disclosure or unauthorized Streak-qualification path was found.

## 8. Database, migrations and transactions

- The first migration adds the three bounded enums, `LEARNING_SESSION`, `LEARNING_SESSION_ITEM` and `STREAK_DAY` in an explicit transaction. It adds lifecycle, expiry, snapshot-size, position and evidence-consistency checks; USER/date and operation/event uniqueness; and intentional `RESTRICT`, `CASCADE` and `SET NULL` relationships.
- The receipt migration adds `LEARNING_SESSION_SRS_RECEIPT`, rating/revision checks, event primary-key identity and item FK in an explicit transaction.
- Prisma schema matches physical migration names, types, indexes and relations.
- No `INSERT ... SELECT`, historical inference or UPDATE backfill exists.
- Session row is locked before item rows. SRS/Quiz subsequently use the established Set/item/progress ordering. The guarded concurrency suite is accepted corroboration for deadlock/replay behavior.
- Progress/XP/evidence/completion/day writes share one caller-provided interactive transaction. Any exception rolls back the unit.
- `STREAK_DAY(user_id, activity_date)` is the final same-day concurrency boundary.
- Sessions/items/receipts/days are retained in V1; no scheduled cleanup exists. USER deletion is intentionally blocked until a separately approved account-deletion policy handles retained records.

Real PostgreSQL constraint, concurrency and rollback behavior is supported by accepted isolated CI TEST evidence, not rerun here. No database finding.

## 9. API and compatibility

- `/api/learning-sessions` provides create/read/NORMAL reveal/NORMAL complete; `/api/users/me/streak` is USER-only and side-effect-free.
- SRS adds optional `session_id`; absence selects the unchanged sessionless scheduler/Progress/XP path and cannot call session/Streak persistence.
- Quiz adds optional session association. Session-aware reads and answers require authoritative run/session equality and exact ordered snapshot IDs; absence retains the legacy path.
- Controllers preserve existing success/error envelopes and map validation/not-found/conflict outcomes consistently.
- Active frontend callers, mocks, fixtures and official API documentation match the implemented additive contracts.

No API compatibility finding.

## 10. Frontend, UI and accessibility

- Pending creation and operation identities are persisted before requests, enabling exact retry after lost responses. Reconciliation accepts only validated Backend projections.
- NORMAL readiness, reveal acknowledgement, explicit completion and authoritative terminal Streak announcement are state-bound; local navigation cannot qualify a session.
- SRS requests card focus after authoritative ACTIVE reconciliation, preserves AGAIN requeue/focus behavior and ignores stale navigation responses.
- Quiz reconciles the authoritative session ID before question loading, binds pending attempts to the run/event, ignores stale async results and preserves exact accessible feedback/summary semantics.
- Dashboard calls Streak only for USER, provides loading/success/zero/pending/failure/stale/retry states, and does not alter Progress, XP, Level or My Sets.
- Semantic headings, status/alert regions, control names, focus destinations and reduced-motion/responsive styles are present in source and supported by accepted Gate ST-6 evidence.

Limitations remain: Chromium only; no manual screen-reader session; effective 200% zoom used equivalent CSS viewport probing. No frontend finding beyond those accepted limitations.

## 11. Regression and legacy impact

| Surface | Review result |
|---|---|
| XP / Level | PASS — Backend reward calculation and deduplication remain authoritative; NORMAL and zero-correct Quiz invent no XP |
| SRS Progress / scheduler | PASS — existing event path and scheduler semantics are preserved; session association is additive |
| Quiz grading / results | PASS — hidden-answer grading and reward path remain Backend-owned; session identity is additive |
| NORMAL learning | PASS — existing card shell/navigation remains; only accepted reveal and explicit completion are added |
| Speaking | PASS — read-only and non-qualifying |
| USER/ADMIN isolation | PASS — Backend USER middleware and Dashboard zero-call ADMIN boundary remain |
| Sessionless clients | PASS — SRS/Quiz Progress/XP compatibility remains, without Streak qualification |
| Dashboard | PASS — additive read-only card; existing sections remain unchanged |
| Existing data/migrations | PASS — additive, no backfill and accepted isolated migration evidence |
| Routes/navigation | PASS — existing endpoints remain and new routes are additive |

The legacy scan found no active stale production caller or obsolete selector/fixture. Intentional rejection coverage and explicitly historical documentation are not defects. Focused evidence is not represented as exhaustive repository-wide compatibility proof.

## 12. Documentation and acceptance records

`PROJECT_OVERVIEW.md`, `DATABASE.md`, `API_SPEC.md`, `UI_UX_SPEC.md`, `FEATURE_STATUS.md` and `ARCHITECTURE.md` accurately describe the implemented product boundary, persistence, contracts, UI states and deployment separation.

Two acceptance-record observations remain:

1. `docs/testing/STREAK_V1_FORMAL_TEST_REPORT.md:248` says TASK-251 HUMAN acceptance is PENDING.
2. `docs/FEATURE_STATUS.md:821-822` still records TASK-250 as under review and TASK-251 as pending.

The authorized HUMAN record establishes that TASK-250 and TASK-251 were accepted and published. The stale wording does not change implementation correctness, and both documents correctly keep TASK-252, Gate ST-7 and Streak V1 unresolved. Synchronization must occur only under separate authorization; this review does not edit existing files.

## 13. CI and data safety

- Protected TASK-249 execution requires explicit `workflow_dispatch`, an affirmative integrated-mode flag, all conflicting modes false and empty historical-cleanup inputs.
- Trust Gate, repository/run identity, configured target identity, HUMAN-approved identity and parsed URL identity fail closed before protected database work.
- Foundation and integrated schemas use unique repository/run/attempt-derived names plus marker ownership validation. Migration, server, fixtures and direct assertions receive the scoped schema URL.
- Integrated cleanup is awaited and cleanup failure prevents PASS. Fixture cleanup is scoped to generated USER/prefix ownership and verifies zero controlled fixtures.
- Push/PR paths cannot select protected TASK-249 jobs. The shared concurrency group serializes protected CI TEST use.
- No committed real credential or database URL was found. Apparent URL/password strings are explicit invalid/sanitization test fixtures.

The cleanup claims remain bounded: fixture cleanup VERIFIED; foundation marker cleanup VERIFIED; integrated cleanup routine VERIFIED; independent post-drop catalog absence NOT VERIFIED. Uncommitted historical recovery/bootstrap files and schemas #87–#94 are excluded.

## 14. Findings by severity

### BLOCKER

None.

### HIGH / MAJOR

None.

### MEDIUM / MINOR

None.

### LOW

**LOW-01 — Accepted TASK-250/TASK-251 decisions are not synchronized in two published status records.**

- **Locations:** `docs/testing/STREAK_V1_FORMAL_TEST_REPORT.md:248`; `docs/FEATURE_STATUS.md:821-822`.
- **Actual:** both retain pre-acceptance wording.
- **Expected:** later, explicitly authorized status synchronization should record TASK-250/TASK-251 acceptance while leaving TASK-252 and Gate ST-7 pending until HUMAN acts.
- **Impact:** provenance/reader clarity only; no runtime, security, data or AC/BR impact. It does not block this review verdict.
- **Action:** synchronize during a separately authorized post-Gate documentation/status step; do not rewrite the historical evidence body.

### INFO

- AC-ST-34 retains no manual screen-reader verification, Chromium-only coverage and equivalent-CSS-viewport zoom evidence.
- Independent integrated-schema post-drop catalog absence remains unverified.
- Historical PLAN AC numbering drift remains disclosed; final SPEC numbering controls.

## 15. Release recommendation

### Recommendation

The reviewed source is suitable for HUMAN Gate ST-7 consideration. An `APPROVE` review verdict permits planning TASK-253 only after HUMAN accepts Gate ST-7; it does not authorize publication, merge, database activity or deployment.

### Preconditions and sequencing

1. HUMAN reviews this report and explicitly accepts or rejects Gate ST-7.
2. Any Git publication/merge receives separate authorization and identifies the exact reviewed source SHA.
3. TASK-253 remains not authorized until Gate ST-7 is accepted.
4. Preview TEST identity must be verified read-only and must not be CI TEST, DEV or Production.
5. A current recoverable Preview TEST backup must exist. Record checksum/archive identity, responsible operator and restore procedure; backup availability is currently **NOT VERIFIED**.
6. Perform read-only migration-history, schema-compatibility and relevant record-count preflight.
7. Apply only committed additive migrations with the approved Prisma deploy procedure—no reset, db push, seed or manual cleanup SQL.
8. Deploy compatible Backend before or together with the session-aware Frontend; sessionless compatibility must remain during rollout.
9. Authorized post-migration checks must verify migration history, constraints, zero Streak backfill, preserved USER/Progress/XP counts and service health before any write smoke flow.
10. Any functional smoke or test write requires separate authorization and isolated controlled fixtures.

### Rollback boundaries

- Application code can be rolled back while sessionless SRS/Quiz compatibility remains available, but older code must be checked against additive schema and any accepted Streak records.
- Migration/data rollback is not automatically safe after sessions or days exist. No destructive down migration, reset, schema drop or restore is authorized by this report.
- A failed migration/deployment stops. HUMAN must choose among forward repair, application rollback or verified backup restore after sanitized evidence review.

### NO-GO conditions

- Gate ST-7 not explicitly HUMAN accepted.
- Exact source/target SHA mismatch or unexpected worktree/PR/check state.
- Preview identity mismatch or any possibility of DEV/Production/CI TEST targeting.
- Missing, stale or unverified backup/recovery ownership.
- Migration-history drift, unexpected schema/object/data state or failed preflight.
- Any unresolved BLOCKER/HIGH finding or newly failing required check.
- Missing separate authorization for backup, migration, deployment or smoke actions.

## 16. Limitations and NOT VERIFIED items

- TASK-252 ran no tests, browser, lint, build, Prisma, migration, CI or database command.
- Accepted Run #94 and earlier evidence were not independently rerun.
- No manual screen-reader or non-Chromium browser session was performed.
- Effective 200% zoom was not a manual browser zoom session.
- Independent post-drop catalog absence is not verified.
- Backup existence, restore readiness, Preview TEST identity/state and deployment infrastructure are not verified.
- Preview TEST and Production migration/deployment remain not performed.
- The review excludes the six uncommitted historical recovery/bootstrap files and all historical schemas.

## 17. Formal REVIEW verdict

`APPROVE`

The complete committed Streak V1 feature diff conforms to the approved scope and architecture. Backend authority, USER ownership, migrations, transaction/replay/concurrency behavior, API compatibility, frontend reconciliation/accessibility, regression boundaries and guarded CI safety have implementation plus accepted evidence adequate for Formal REVIEW. No BLOCKER, HIGH/MAJOR or MEDIUM/MINOR finding remains. LOW-01 is documentation provenance synchronization and does not block Gate ST-7 consideration.

This verdict is TASK-252’s independent review judgment only. It is not HUMAN Gate ST-7 acceptance and does not mark Streak V1 `DONE`.

## 18. HUMAN Gate ST-7 handoff — PENDING

HUMAN must decide whether to accept the implementation and this review at Gate ST-7. Until that explicit decision:

- Gate ST-7 remains `PENDING`.
- Streak V1 remains `IN_PROGRESS`.
- TASK-253 and Gate ST-8 remain pending/not authorized.
- No merge, shared-environment migration, deployment or Production action is implied.
