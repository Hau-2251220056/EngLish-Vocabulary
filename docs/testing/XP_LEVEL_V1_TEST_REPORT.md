# TEST REPORT: XP & Level V1

**Task:** TASK-233 — Perform formal TEST and build AC-01–AC-26 evidence matrix

**Verified implementation HEAD:** `648960a48c779286c0e11e7e2bd8679be55ef43b`

**Branch:** `feature/xp-level-v1`

**Report date:** 2026-10-17 (Asia/Saigon)

**Final TEST result:** `PASS`

## 1. Scope

This formal TEST verifies the approved XP & Level V1 SPEC, PLAN and TASK through AC-01–AC-26. It covers backend-authoritative Level/reward rules, USER authorization, migration and retention, atomic SRS/Quiz rewards, replay/concurrency/rollback behavior, additive API projections, Dashboard/feedback behavior, zero-XP exclusions and relevant regressions.

TASK-234 formal REVIEW, feature closure, status `DONE`, Git publication, production database work, Streak and Daily Goal are outside this report.

## 2. Feature Status

- Before TEST: `IN_PROGRESS`.
- After TEST: `IN_PROGRESS` pending TASK-234 formal REVIEW and HUMAN Gate 6 acceptance.
- TASK-231 and Gate 5: HUMAN ACCEPTED.
- TASK-232 documentation synchronization: HUMAN ACCEPTED and preserved as five uncommitted documentation changes.

## 3. Evidence Classification

### 3.1 Current local DB-independent execution

| Check | Exact command | Result |
|---|---|---|
| Backend XP domain/repository/service/API/static migration safety | `cd backend; node --test --test-concurrency=1 test/xp-level/xp-level-service.test.js test/xp-level/xp-reward-repository.test.js test/xp-level/xp-progress-read.test.js test/xp-level/xp-mutation-api-contract.test.js test/xp-level/srs-xp-integration.test.js test/xp-level/xp-level-migration-safety.test.js` | PASS — 46/46 |
| Frontend XP/service/state | `cd frontend; node --test test/xp-level-response.test.js test/learning-service.test.js test/quiz-service.test.js test/quiz-run-state.test.js` | PASS — 32/32 |
| Mocked Dashboard/SRS/Quiz browser | `cd frontend; npx playwright test e2e/auth/dashboard-foundation.spec.js e2e/auth/learning-srs.spec.js e2e/auth/quiz-flow.spec.js` | PASS — 46/46 |
| Frontend lint | `cd frontend; npm run lint` | PASS |
| Frontend production build | `cd frontend; npm run build` | PASS; non-blocking existing chunk-size warning only |
| Documentation/worktree whitespace | `git diff --check` | PASS |

The first sandboxed Node/build attempt could not spawn child processes (`EPERM`). The same exact tests/build were rerun outside that process sandbox and passed; no test assertion failed in the executed runs.

### 3.2 Guarded database and real-stack evidence

HUMAN-provided and accepted evidence is reused rather than rerun:

- GitHub Actions Run #58: `https://github.com/Hau-2251220056/EngLish-Vocabulary/actions/runs/39005360955`.
- Verified head: `648960a48c779286c0e11e7e2bd8679be55ef43b`.
- Trust Gate: PASS.
- Backend DB Integration: PASS.
- Real Stack Browser: PASS.
- Summary: PASS.
- TASK-231: HUMAN ACCEPTED.

Read-only GitHub API inspection confirmed that Run #58's `XP Migration Verification` and `XP Migration Cleanup` jobs were `skipped`; they are not counted as PASS evidence. Migration evidence is inherited from successful CI Guarded Integration Run #53 (`38990445153`) at ancestor commit `55ebad82c811fad0edb62c6e89cdd24ad179e08b`, where both jobs completed successfully. Git ancestry verification passed, and `git diff` found no changes from that commit to the verified HEAD in the migration/schema/harness/repository PostgreSQL/SRS PostgreSQL/Quiz PostgreSQL/workflow evidence surfaces.

- Run #53: `https://github.com/Hau-2251220056/EngLish-Vocabulary/actions/runs/38990445153`.
- XP Migration Verification: PASS.
- XP Migration Cleanup: PASS.

TASK-233 did not access a database or dispatch/repeat CI.

### 3.3 HUMAN/manual evidence

- Gate 5 Dashboard visual approval: HUMAN ACCEPTED.
- TASK-232 synchronized documentation: HUMAN ACCEPTED.
- Speaking live microphone/vendor behavior remains outside XP & Level V1 and does not alter its zero-XP boundary.

## 4. Acceptance-Criteria Traceability

| AC | Result | Evidence |
|---|---|---|
| AC-01 | PASS | Run #58 Backend DB Integration/Real Stack; backend authorization coverage; mocked Dashboard ADMIN zero-call and Quiz Guest/ADMIN denial. |
| AC-02 | PASS | `xp-level-service.test.js` and `srs-xp-integration.test.js`: first `HARD`/`GOOD`/`EASY` each +3; guarded Learning verification in Run #58. |
| AC-03 | PASS | Pure/service tests: repeated initial `AGAIN` remains zero and later pass earns +3; guarded Learning evidence. |
| AC-04 | PASS | Composite reward uniqueness and duplicate-initial service cases; guarded repository/Learning verification. |
| AC-05 | PASS | Pure Quiz candidate matrix plus guarded Quiz verification: incorrect 0, first correct +3, later correct 0. |
| AC-06 | PASS | `xp-lifecycle.integration.test.js` in Run #58 verifies Quiz-first and SRS-first cumulative +6. |
| AC-07 | PASS | Pure due snapshot matrix covers equality/overdue and all four ratings; guarded SRS verification covers persisted due cycles. |
| AC-08 | PASS | Pure/service future, legacy-unscheduled and requeue zeros; lifecycle NORMAL invariant; Run #58 accepted zero-XP NORMAL/Speaking regression evidence. |
| AC-09 | PASS | Service test proves due `AGAIN` +1 once and immediate `LEARNING` requeue 0; guarded lifecycle corroborates. |
| AC-10 | PASS | DB uniqueness, replay/service duplicate model and Run #58 guarded concurrent/fresh-run/alternate-Set evidence. |
| AC-11 | PASS | Service test proves identical-headword distinct UUID independence; guarded Quiz/repository evidence. |
| AC-12 | PASS | Service rollback injection plus Run #58 repository/SRS/Quiz transaction rollback evidence. |
| AC-13 | PASS | Backend replay tests return original positive/zero amount and current total; frontend unit plus mocked SRS/Quiz browser prove zero/replay silence and no reward persistence. |
| AC-14 | PASS | Service conflict/rollback coverage, API error-family test and guarded stale/losing concurrency evidence. |
| AC-15 | PASS | Run #58 guarded repository verification covers atomic accumulation for different Vocabulary UUIDs. |
| AC-16 | PASS | Run #53 isolated migration verification: preserved balances, zero generated rewards and no backfill; migration evidence surfaces are unchanged through the verified HEAD. |
| AC-17 | PASS | Pure legacy `NEEDS_REVIEW`/Quiz-unscheduled Policy A matrix plus guarded Learning/Quiz evidence. |
| AC-18 | PASS | Backend boundary tests below/at/above all Levels and MAX; frontend unit and mocked Dashboard Level 15/MAX; real-stack evidence. |
| AC-19 | PASS | Progress-read test, Dashboard mocked states/ADMIN zero-call/read-only cases, Gate 5 acceptance and Run #58 Real Stack Browser. |
| AC-20 | PASS | Static scan found no frontend threshold table or reward eligibility constants; frontend validates backend projections and computes presentation width only. |
| AC-21 | PASS | Migration/schema static checks plus Run #53 constraint and adversarial guarded verification; relevant surfaces unchanged through HEAD. |
| AC-22 | PASS | Run #58 migration/retention and lifecycle evidence covers membership removal, Set deletion, reload/restart/session behavior. |
| AC-23 | PASS | Scope/legacy scan found no Streak, Daily Goal, Achievement, leaderboard, XP-history UI or extra reward source implementation. |
| AC-24 | PASS | Current 46 backend + 32 frontend + 46 mocked browser checks, lint/build, Gate 5, and accepted Run #58 guarded DB/real-stack evidence. |
| AC-25 | PASS | Static migration shows both reward FKs; Run #53 verifies `ON DELETE RESTRICT`, membership-only removal and unchanged deletion boundaries. |
| AC-26 | PASS | Static migration guard precedes DDL; Run #53 isolated migration harness verifies clean preflight and negative/later-DDL rollback without modification. |

## 5. Coverage Summary

### Happy path and business rules

- Level boundaries, MAX and above-MAX XP.
- SRS initial reward, due review and due `AGAIN`.
- Quiz first-correct reward and independent SRS/Quiz channels.
- Dashboard current XP/Level projection and transient feedback.

### Validation and errors

- Invalid XP/projection forms and forbidden internal reward fields.
- Existing Learning/Quiz validation and safe error families.
- Stale revision, collision and rollback paths.

### Authentication and authorization

- USER-only learning/Quiz/Progress contracts.
- Guest/ADMIN denial and ADMIN Dashboard zero USER-data calls.
- Exact USER/Vocabulary identity and cross-user isolation.

### Edge cases and concurrency

- Initial `AGAIN`, due `AGAIN`, immediate requeue, future/incomplete/legacy schedule.
- Duplicate/replayed/different events, fresh Quiz runs and alternate Sets.
- Same-revision races and different-Vocabulary atomic accumulation.
- Preserved legacy balances and no-backfill Policy A.

### UI and accessibility

- Dashboard loading, zero, intermediate, MAX, error/retry/focus.
- Keyboard, responsive widths, no horizontal overflow and reduced motion.
- Positive original XP feedback; zero/replay/reload restoration silence.
- Learning/Quiz session storage excludes reward feedback.

## 6. Legacy / Regression Impact Scan

The additive SRS/Quiz/Progress response changes were scanned across backend/frontend production code, tests, browser fixtures and active documentation.

- **Active consumers:** Dashboard, Learning Progress, Learning service, Quiz service and all active mocks/fixtures carry or validate the additive projection.
- **Intentional rejection coverage:** frontend `reward_type`/`reward_cycle` references are malformed-response tests proving internal fields are rejected.
- **Historical artifacts:** older feature SPEC/PLAN/TASK exclusions remain valid statements about those features at their original closure boundary and do not override the later approved XP & Level extension.
- **Unrelated retained references:** Speaking explicitly remains zero-XP; conceptual Daily Goal/Streak documentation is marked deferred.
- **Removed/obsolete surfaces:** no obsolete XP endpoint, route, navigation, selector, mock or active caller was found.
- **Frontend authority:** no Level threshold table or SRS/Quiz reward type/eligibility constants exist in frontend production code.
- **Excluded scope:** no active Streak, Daily Goal, Achievement, leaderboard, ranking or XP-history persistence/product surface was found.

Result: `PASS`; no active stale reference requiring correction was found.

## 7. Automated Verification Status

- Unit/service tests: PASS.
- Guarded database integration: PASS — reused accepted Run #58 evidence; not rerun locally.
- API tests: PASS.
- Frontend tests: PASS.
- Mocked browser tests: PASS.
- Real-stack E2E: PASS — reused accepted Run #58 evidence; not rerun locally.
- Lint: PASS.
- Type check: NOT APPLICABLE — repository defines no standalone type-check command.
- Build: PASS.
- Database migration/constraint verification: PASS — reused successful Run #53 guarded evidence after ancestry and unchanged-surface verification; Run #58 migration jobs were skipped and were not counted.
- Manual device-specific Speaking verification: NOT APPLICABLE to XP & Level V1; Speaking remains excluded and zero-XP.

## 8. Failures and Blockers

- Functional/test failures: none.
- Required missing evidence: none.
- TASK-233 blocker: none.
- Non-blocking build observation: Vite emitted its existing large-chunk advisory.

## 9. Regression Result

`PASS`

## 10. Final TEST Verdict

`PASS`

All AC-01–AC-26 have credible executed evidence at verified HEAD `648960a48c779286c0e11e7e2bd8679be55ef43b`. This TEST PASS does not constitute formal REVIEW, feature `DONE`, merge approval or Gate 6 closure.

## 11. Next Stage

Stop for HUMAN acceptance of TASK-233. TASK-234 remains unauthorized and must not begin unless separately authorized after this TEST PASS is accepted.
