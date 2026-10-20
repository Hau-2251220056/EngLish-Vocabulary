# Streak V1 Formal TEST Report

## 1. Document metadata and scope

- **Task:** TASK-251 — Streak V1 Formal TEST.
- **Report basis:** accepted, previously executed evidence only; no test was executed while preparing this report.
- **Implementation evidence SHA:** `189e1da9934758a87d88f19faa97db715376c0b1`.
- **Documentation SHA:** `1df63db3674dd1cdf10f06da27f900809c1b7ad5`.
- **Branch:** `feature/streak-v1`.
- **Feature status:** `IN_PROGRESS`.
- **HUMAN acceptance of this report:** **PENDING**.

This report evaluates the final acceptance wording in [STREAK_V1_SPEC.md](../specs/STREAK_V1_SPEC.md) and the final traceability guidance in [STREAK_V1_TASK.md](../tasks/STREAK_V1_TASK.md). It does not implement a feature, authorize Gate ST-7, authorize shared-environment work, or mark Streak V1 `DONE`.

The older test-strategy table in [STREAK_V1_PLAN.md](../plans/STREAK_V1_PLAN.md) contains historical acceptance-identifier wording that does not align one-for-one with the final SPEC numbering. This report therefore uses the final SPEC identifiers and meanings. The older PLAN rows are treated only as historical test-strategy context; SPEC, PLAN and TASK are not modified.

## 2. Evidence baseline and provenance

### 2.1 Guarded integrated evidence

TASK-249 was HUMAN accepted as PASS from GitHub Actions Run `39394932196` (Run #94), attempt `1`, workflow ID `365828702`, on `feature/streak-v1` at implementation SHA `189e1da9934758a87d88f19faa97db715376c0b1`:

- Trust Gate: `SUCCESS`.
- Foundation PostgreSQL: `27/27 PASS` through [streak-foundation.integration.test.js](../../backend/test/streak/streak-foundation.integration.test.js).
- Focused real-stack Chromium Playwright: `1/1 PASS` through [streak-real-stack.spec.js](../../frontend/e2e/integration/streak-real-stack.spec.js).
- Eleven migrations applied successfully to each isolated run-owned schema.
- Fixture cleanup: verified at fixture level.
- Foundation marker-validated cleanup: verified.
- Integrated marker-validated cleanup routine: verified.
- Independent post-drop PostgreSQL catalog confirmation of integrated-schema absence: **NOT PERFORMED**.

The current documentation SHA is a documentation-only child of the successful implementation SHA. No production, test, Prisma, migration or workflow behavior changed in TASK-250.

### 2.2 Earlier accepted evidence reused

| Evidence layer | Corroborated source | Execution provenance used here |
| --- | --- | --- |
| Pure time/projection domain | [streak-domain.test.js](../../backend/test/streak/streak-domain.test.js) | Accepted TASK-237–240 evidence; exact standalone count is not restated where no retained execution log was inspected |
| Repository/transaction contracts | [streak-repository.test.js](../../backend/test/streak/streak-repository.test.js) | Accepted foundation evidence and Run #94 PostgreSQL coverage |
| HTTP/API contracts | [streak-http-contract.test.js](../../backend/test/streak/streak-http-contract.test.js) | Accepted TASK-239–240 evidence and Run #94 auth/API coverage |
| SRS session behavior | [streak-srs-session.test.js](../../backend/test/streak/streak-srs-session.test.js), [learning-srs.spec.js](../../frontend/e2e/auth/learning-srs.spec.js) | Accepted TASK-243–244 evidence plus Run #94 foundation/real-stack coverage |
| Quiz session behavior | [quiz-answer.test.js](../../backend/test/quiz/quiz-answer.test.js), [quiz-flow.spec.js](../../frontend/e2e/auth/quiz-flow.spec.js) | Accepted TASK-245–246 evidence plus Run #94 foundation/real-stack coverage |
| Migration and receipt safety | [streak-migration-safety.test.js](../../backend/test/streak/streak-migration-safety.test.js), [streak-srs-receipt-migration-safety.test.js](../../backend/test/streak/streak-srs-receipt-migration-safety.test.js) | HUMAN-accepted TASK-236/Gate ST-1 evidence |
| Dashboard/UI | [dashboard-foundation.spec.js](../../frontend/e2e/auth/dashboard-foundation.spec.js) | TASK-248 mocked Dashboard `16/16 PASS`; additional screenshot/effective-200%-equivalent probes `3/3 PASS`; lint/build PASS; HUMAN Gate ST-6 accepted |
| Integrated real stack | [streak-real-stack.spec.js](../../frontend/e2e/integration/streak-real-stack.spec.js) | Run #94 `1/1 PASS` |
| Workflow and fixture safety | [streak-foundation-safety.test.js](../../backend/test/streak/streak-foundation-safety.test.js), [streak-real-stack-contract.test.js](../../backend/test/streak/streak-real-stack-contract.test.js) | Accepted offline safety reviews and guarded Run #94 execution |
| Documentation | `PROJECT_OVERVIEW.md`, `DATABASE.md`, `API_SPEC.md`, `UI_UX_SPEC.md`, `FEATURE_STATUS.md`, `ARCHITECTURE.md` | TASK-250 HUMAN accepted and published at the documentation SHA |

No historical recovery execution is used as product-behavior evidence.

## 3. Environment and methodology

| Environment | Purpose | Status and boundary |
| --- | --- | --- |
| Local Node/service tests | Pure domain, fake repository/service and static contracts | Reused accepted database-free evidence; not rerun for this report |
| Mocked Chromium | Learning, Quiz and Dashboard state/accessibility flows | Reused accepted evidence; no protected database |
| Isolated CI TEST PostgreSQL | Migration, constraints, transactions, concurrency and rollback | Reused guarded evidence only |
| Guarded CI TEST real stack | Browser → application → isolated PostgreSQL scenario | Reused Run #94 evidence only |
| Preview TEST | Release/deployment environment | **NOT DEPLOYED / NOT VERIFIED** for Streak V1 |
| Production | Production environment | **NOT DEPLOYED** |
| Historical schemas #87–#94 | Preserved incident evidence | Out of scope; not accessed by TASK-251 |

Static source inspection confirms that cited tests exist and contain the described assertions. Static inspection is not substituted for execution; VERIFIED results below depend on the accepted execution provenance identified above.

## 4. Acceptance traceability

| ID | Concise final requirement | Evidence | Type | Status / limitation |
| --- | --- | --- | --- | --- |
| AC-ST-01 | Guest/ADMIN cannot use USER Streak; cross-USER sessions are concealed | Foundation test `full HTTP auth matrix and Set authorization remain USER-only`; SRS foreign replay coverage | Guarded PostgreSQL/API | VERIFIED |
| AC-ST-02 | Immutable bounded authorized identities for all qualifying modes | Foundation snapshot validation and SRS/Quiz snapshot tests; migration constraints | Guarded PostgreSQL + migration | VERIFIED |
| AC-ST-03 | Non-learning actions and unfinished exit create no day | HTTP creation/read contracts and negative integrated counts | HTTP + guarded integration | VERIFIED |
| AC-ST-04 | Speaking creates no qualifying session or Streak effect | Real-stack scenario `NORMAL, SRS and zero-correct Quiz qualify once while Speaking remains non-qualifying` | Guarded real-stack | VERIFIED |
| AC-ST-05 | NORMAL requires all accepted reveals and explicit completion | HTTP test `NORMAL completion rejects incomplete groups then atomically returns authoritative Streak`; real-stack NORMAL flow | HTTP + real stack | VERIFIED |
| AC-ST-06 | Last-card navigation without all reveals remains incomplete | Same incomplete-group HTTP test; mocked NORMAL browsing/reveal flow | HTTP + mocked browser | VERIFIED |
| AC-ST-07 | Reveal replay is idempotent; NORMAL changes no Progress/XP | HTTP reveal replay test; foundation `successful NORMAL completion...without changing Progress or XP`; real-stack direct assertions | HTTP + PostgreSQL + real stack | VERIFIED |
| AC-ST-08 | SRS queue is Backend-authored, bounded and immutable | Foundation `SRS snapshot is authoritatively ordered, unique and bounded...` and later-due exclusion | Guarded PostgreSQL | VERIFIED |
| AC-ST-09 | Accepted AGAIN remains unresolved | Foundation `AGAIN receipts stay unresolved...`; SRS service test | Guarded PostgreSQL + service | VERIFIED |
| AC-ST-10 | SRS completes only after every initial item resolves with a passing rating | Foundation atomic passing-rating test; real-stack AGAIN then final resolution | Guarded PostgreSQL + real stack | VERIFIED |
| AC-ST-11 | Existing SRS Progress/schedule/XP outcomes remain unchanged | Foundation sessionless and session-aware SRS assertions; scheduler/XP regressions | PostgreSQL + unit/service | VERIFIED |
| AC-ST-12 | Quiz completes only after every snapshot question has an accepted answer | Foundation zero-correct multi-item Quiz test | Guarded PostgreSQL | VERIFIED |
| AC-ST-13 | Incorrect answers count; zero-correct completion qualifies without invented XP | Foundation zero-correct test and real-stack zero-correct summary/XP/Streak assertions | PostgreSQL + real stack | VERIFIED |
| AC-ST-14 | Completed Quiz revisit/replay cannot complete again | Foundation immutable final replay; mocked completed-result persistence | PostgreSQL + mocked browser | VERIFIED |
| AC-ST-15 | A retake uses a genuinely new Backend session/run | Foundation creates a distinct active retake after terminal completion; mocked fresh-run identity | PostgreSQL + mocked browser | VERIFIED |
| AC-ST-16 | First qualifying completion returns current Streak 1 | Foundation NORMAL completion and real-stack completion projection | PostgreSQL + real stack | VERIFIED |
| AC-ST-17 | Consecutive application days increment once per day | Domain test `projection counts consecutive dates through today or yesterday` | Pure domain | VERIFIED |
| AC-ST-18 | Same-day cross-mode completions create one ledger row | Foundation parallel-completion test; real-stack NORMAL/SRS/Quiz deduplication and stored counts | PostgreSQL + real stack | VERIFIED |
| AC-ST-19 | Yesterday-ending sequence remains while today is incomplete | Consecutive/yesterday projection domain test | Pure domain | VERIFIED |
| AC-ST-20 | A full missed day reads zero without deleting history | Domain test `a full missed day reads zero without deleting retained history` | Pure domain | VERIFIED |
| AC-ST-21 | Next qualification after break starts at one | Empty/first-day and missed-day projection tests plus completion insertion behavior | Domain + repository | VERIFIED |
| AC-ST-22 | Backend acceptance time and UTC+7 assign the day | Domain application-day/completion-time tests; request contracts accept no client date/timezone | Domain + API/static | VERIFIED |
| AC-ST-23 | Exact UTC+7 midnight boundary assigns correct dates | Domain boundary test and foundation `completion at UTC+7 midnight...` | Domain + guarded PostgreSQL | VERIFIED |
| AC-ST-24 | Valid session may cross midnight and qualifies on completion date | Domain `completion date comes from the accepted instant`; reconciliation/resume evidence | Domain + frontend/service | VERIFIED |
| AC-ST-25 | Exact seven-day equality is expired | Domain equality test and foundation post-lock expiry test | Domain + guarded PostgreSQL | VERIFIED |
| AC-ST-26 | Expiry does not undo committed Progress/SRS/XP | Expiry reconciliation and terminal rollback/preservation tests | Service + guarded PostgreSQL | VERIFIED |
| AC-ST-27 | Exact replay creates no duplicate completion/day/XP | Repository terminal replay plus foundation NORMAL/SRS/Quiz replay assertions | Repository + PostgreSQL | VERIFIED |
| AC-ST-28 | Concurrent terminal requests commit once; same-day sessions share one day | Foundation exact/competing SRS and Quiz concurrency plus parallel completed sessions | Guarded PostgreSQL | VERIFIED |
| AC-ST-29 | Terminal transaction rollback covers Progress/XP/evidence/completion/day | Foundation injected NORMAL, SRS and Quiz failure tests | Guarded PostgreSQL | VERIFIED |
| AC-ST-30 | Set/access/item changes cannot shrink or fabricate completion | Foundation immutable membership, Set deletion and revoked-access tests | Guarded PostgreSQL | VERIFIED |
| AC-ST-31 | Migration has no backfill and preserves existing USER/Progress/XP | Accepted Gate ST-1 migration/receipt harness and static migration safety contracts | Guarded migration + static | VERIFIED |
| AC-ST-32 | USER-isolated, side-effect-free Streak read returns all projections | HTTP test `Streak read is side-effect free...`; real-stack API/Dashboard checks | HTTP + real stack | VERIFIED |
| AC-ST-33 | Dashboard truthfully handles zero, positive/today and failure states | Dashboard completed/pending/broken, initial failure and stale/retry tests | Mocked browser + real stack | VERIFIED |
| AC-ST-34 | Dashboard is keyboard/screen-reader usable and responsive without redesign | TASK-248 automated semantics/focus/live-region, viewport/zoom/reduced-motion evidence and HUMAN visual acceptance | Mocked browser + HUMAN review | VERIFIED WITH LIMITATION — no manual screen-reader session |
| AC-ST-35 | Excluded features remain absent | Speaking real-stack negative assertion, Dashboard scope tests and legacy/static scan | Real stack + static | VERIFIED |
| AC-ST-36 | Local recovery cannot bypass Backend ownership/expiry/evidence | Frontend reconciliation/lost-response tests plus Backend owner/expiry/evidence rejection | Mocked browser + API/PostgreSQL | VERIFIED |

**Acceptance coverage:** 35 VERIFIED; 1 VERIFIED WITH LIMITATION; 0 NOT RUN; 0 BLOCKED.

## 5. Business-rule traceability

| ID | Evidence and boundary | Status |
| --- | --- | --- |
| BR-ST-001 | Foundation USER-only auth matrix and foreign-owner concealment | VERIFIED |
| BR-ST-002 | Migration enums, strict creation modes and three-mode real-stack scenario | VERIFIED |
| BR-ST-003 | Complete-snapshot validation across NORMAL/SRS/Quiz | VERIFIED |
| BR-ST-004 | Incomplete, expired, inaccessible and rollback-negative tests | VERIFIED |
| BR-ST-005 | Real-stack Speaking negative result; login/browse/open paths have no completion command | VERIFIED |
| BR-ST-006 | NORMAL zero XP, zero-correct Quiz zero invented XP, independent SRS XP rules | VERIFIED |
| BR-ST-007 | Unique USER/date migration constraint and same-day concurrency tests | VERIFIED |
| BR-ST-008 | Static/product-scope scan confirms no Freeze implementation | VERIFIED |
| BR-ST-009 | NORMAL ordered distinct bounded snapshot tests | VERIFIED |
| BR-ST-010 | NORMAL reveal endpoint and accepted-evidence tests | VERIFIED |
| BR-ST-011 | Incomplete completion rejection despite navigation/display | VERIFIED |
| BR-ST-012 | Explicit NORMAL completion command required | VERIFIED |
| BR-ST-013 | Foundation and real-stack no Progress/XP mutation assertions | VERIFIED |
| BR-ST-014 | Completed NORMAL replay/revisit tests | VERIFIED |
| BR-ST-015 | Backend SRS eligibility/order snapshot test | VERIFIED |
| BR-ST-016 | Initial SRS items start unresolved in session fixtures/assertions | VERIFIED |
| BR-ST-017 | AGAIN receipt remains unresolved and requeues in mocked browser | VERIFIED |
| BR-ST-018 | Passing SRS ratings resolve the exact session item | VERIFIED |
| BR-ST-019 | Only final initial-item resolution completes | VERIFIED |
| BR-ST-020 | Later-due item excluded from immutable active snapshot | VERIFIED |
| BR-ST-021 | Scheduler/revision/retry/XP regression evidence | VERIFIED |
| BR-ST-022 | SRS-up-to-date creates no session/day | VERIFIED |
| BR-ST-023 | Quiz bounded ordered session snapshot and run identity | VERIFIED |
| BR-ST-024 | Multi-item Quiz requires one accepted answer per snapshot item | VERIFIED |
| BR-ST-025 | Correct and incorrect evidence paths tested | VERIFIED |
| BR-ST-026 | Zero-correct qualifying completion tested in PostgreSQL and real stack | VERIFIED |
| BR-ST-027 | Grading, choice revision, Progress and XP regression tests | VERIFIED |
| BR-ST-028 | Terminal result replay/revisit is immutable | VERIFIED |
| BR-ST-029 | Distinct active retake session/run after completion | VERIFIED |
| BR-ST-030 | UTC+7 application-date domain and PostgreSQL boundary tests | VERIFIED |
| BR-ST-031 | One Backend instant per operation; no client award date/timezone | VERIFIED |
| BR-ST-032 | Empty-history projection returns zero | VERIFIED |
| BR-ST-033 | First-day projection and first completion return one | VERIFIED |
| BR-ST-034 | Consecutive-date projection increments once per day | VERIFIED |
| BR-ST-035 | Same-day deduplication across concurrent/cross-mode completions | VERIFIED |
| BR-ST-036 | Yesterday anchor retains current sequence while today is pending | VERIFIED |
| BR-ST-037 | Missed-day zero and subsequent first-day projection behavior | VERIFIED |
| BR-ST-038 | Missed-day projection is read-only and retains history | VERIFIED |
| BR-ST-039 | Backend-authored creation/expiry clock tests | VERIFIED |
| BR-ST-040 | Exact seven-day/equality expiry tests | VERIFIED |
| BR-ST-041 | Active-session reconciliation/resume coverage | VERIFIED |
| BR-ST-042 | Completion-date test uses accepted instant, not creation instant | VERIFIED |
| BR-ST-043 | Expired session rejects new evidence/completion | VERIFIED |
| BR-ST-044 | Expiry/rollback evidence preserves committed Progress/SRS/XP | VERIFIED |
| BR-ST-045 | Parallel independent session tests and immutable UUID/snapshot constraints | VERIFIED |
| BR-ST-046 | Same-session and same-day terminal concurrency tests | VERIFIED |

**Business-rule coverage:** 46 VERIFIED; 0 NOT RUN; 0 BLOCKED.

## 6. Edge cases and negative regression coverage

- Empty and no-eligible SRS Sets produce non-qualifying outcomes.
- Duplicate, malformed, over-limit, wrong-owner and changed-membership snapshots fail closed.
- Exact expiry equality and post-lock clock movement are rejected.
- UTC+7 midnight uses the eventual accepted instant.
- Repeated and competing SRS/Quiz terminal submissions serialize safely.
- Same-day different-session completions deduplicate at the database boundary.
- Injected terminal failures roll back evidence, Progress, XP, completion and day insertion.
- Lost responses reuse the same operation/event identity; stale or mismatched replay conflicts.
- Zero-correct Quiz completes without Quiz XP.
- Speaking remains read-only and does not create session/day effects.
- ADMIN and foreign USER paths cannot use USER Streak state.

## 7. Legacy-impact assessment

| Surface | Classification | Evidence |
| --- | --- | --- |
| XP and Level semantics | VERIFIED — NO REGRESSION IDENTIFIED | Foundation NORMAL/SRS/Quiz XP assertions, XP snapshots in real stack, existing reward tests |
| SRS Progress/scheduler | VERIFIED — NO REGRESSION IDENTIFIED | Scheduler/service tests, foundation session-aware and sessionless SRS tests |
| Quiz grading/results | VERIFIED — NO REGRESSION IDENTIFIED | Quiz read/answer tests, zero-correct foundation and real-stack flow |
| NORMAL learning | VERIFIED — NO REGRESSION IDENTIFIED | Mocked NORMAL interaction/recovery tests and real-stack explicit completion |
| Speaking | VERIFIED — READ-ONLY/NON-QUALIFYING | Real-stack before/after persisted counts and existing mocked Speaking flows |
| USER/ADMIN isolation | VERIFIED — NO REGRESSION IDENTIFIED | Foundation auth matrix and Dashboard ADMIN non-call evidence |
| Sessionless SRS/Quiz clients | VERIFIED — COMPATIBLE | Foundation sessionless SRS and Quiz tests |
| Database migration | VERIFIED — ADDITIVE/NO BACKFILL | Accepted Gate ST-1 harness and migration safety contracts |
| Documentation | VERIFIED — SYNCHRONIZED | TASK-250 Independent Re-review and published documentation SHA |

The TASK-249 legacy scan classified active stale references corrected within scope, intentional rejection coverage retained, historical documentation explicitly superseded, and unrelated references preserved. No unresolved active stale reference is carried into this report.

## 8. Accessibility, UI/UX and browser limitations

Reusable Gate ST-6 evidence covers Chromium, mocked APIs, keyboard navigation, visible/logical focus, semantic headings and control names, live-region/status behavior, reduced motion, responsive widths `320`, `375`, `667` landscape, `768`, `1024`, and `1440` CSS pixels, plus effective-200%-equivalent CSS viewport probes. HUMAN reviewed desktop, mobile, Streak states and overall usability.

Limitations:

- No manual screen-reader session was performed.
- Effective 200% zoom was represented by equivalent CSS viewport behavior.
- Gate ST-6 did not exercise a real authenticated Backend; Run #94 later supplied the focused authenticated real-stack scenario.
- Browser evidence is Chromium-specific.

These limitations are recorded without converting unperformed manual/device checks into PASS claims.

## 9. Database, migration and cleanup safety

- Migration evidence is from isolated, guarded CI TEST PostgreSQL—not Preview TEST or Production.
- Run-owned schemas and ownership markers were used by the guarded harnesses.
- Run #94 applied all eleven migrations successfully in the isolated foundation and integrated schemas.
- Fixture cleanup is VERIFIED at fixture level.
- Foundation marker-validated cleanup is VERIFIED.
- The integrated marker-validated cleanup routine is VERIFIED.
- Independent post-drop catalog verification that the integrated schema is absent is **NOT VERIFIED / NOT PERFORMED**.
- This report does not claim that job success alone proves independent schema absence.
- Historical schemas #87–#94 were not accessed or modified during TASK-251.

## 10. Unexecuted and deferred verification

The following are intentionally not claimed as executed by TASK-251:

- New unit, integration, browser, lint or build commands: **NOT RUN**; accepted applicable evidence was reused.
- New guarded PostgreSQL or real-stack CI: **NOT RUN**; Run #94 evidence remains applicable.
- Manual screen-reader verification: **NOT RUN**.
- Independent post-drop PostgreSQL catalog query: **NOT RUN**.
- Preview TEST migration/deployment: **NOT AUTHORIZED / NOT PERFORMED**.
- Production migration/deployment: **NOT AUTHORIZED / NOT PERFORMED**.
- TASK-252 formal REVIEW and TASK-253 release work: **NOT STARTED**.

No listed deferral contradicts a mandatory TASK-251 acceptance requirement. Any later environment or release verification remains subject to its own HUMAN gate.

## 11. Defects, residual risks and open findings

- No evidence-backed functional defect remains open from TASK-249.
- Residual accessibility confidence is limited by the absence of a manual screen-reader/device matrix.
- Cleanup confidence is limited to the verified marker-validated routine; independent catalog absence remains unverified.
- The historical PLAN acceptance-number mapping discrepancy must remain disclosed; this report uses final SPEC meanings.
- Evidence from earlier focused tasks sometimes has accepted outcome summaries without a retained standalone log/count in this worktree. Such evidence is used only alongside cited test source and accepted gate/run provenance; no missing count is invented.

## 12. Proposed Formal TEST verdict

All final acceptance criteria have applicable accepted evidence: 35 are VERIFIED and one is VERIFIED WITH LIMITATION because manual screen-reader verification was not performed. All 46 business rules are VERIFIED through direct focused, integration, real-stack, static or accepted manual evidence. No required criterion is NOT RUN or BLOCKED.

**Proposed verdict: FORMAL TEST EVIDENCE SUFFICIENT — READY FOR INDEPENDENT REVIEW.**

This is the TASK-251 TEST-stage verdict only. It does not constitute TASK-252 REVIEW approval, Gate ST-7 acceptance, Git publication authorization, Preview/Production authorization, or feature completion.

## 13. HUMAN acceptance status

**PENDING.** HUMAN must accept TASK-251 before TASK-252 may begin. Streak V1 remains `IN_PROGRESS`.
