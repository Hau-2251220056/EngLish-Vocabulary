# FEATURE STATUS

## 1. Purpose

This document records the current implementation status of project features.

It is used to help the AI Agent and project developer understand:

- Which features are planned.
- Which features are currently being implemented.
- Which features have been implemented.
- Which features have been tested.
- Which features have passed final review.
- Which features are completed and should be reused instead of rebuilt.

This document describes **feature status only**.

Project requirements and business rules remain defined in:

```text
docs/PROJECT_OVERVIEW.md
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/API_SPEC.md
docs/UI_UX_SPEC.md
2. Status Definitions

Use the following statuses:

TODO
PLANNED
IN_PROGRESS
IMPLEMENTED
TESTED
DONE
BLOCKED
TODO

The feature is part of the approved project scope but development has not started.

TODO
PLANNED

The feature has an approved SPEC and/or PLAN but implementation has not started.

PLANNED
IN_PROGRESS

The feature is currently being implemented.

IN_PROGRESS
IMPLEMENTED

The planned implementation has been completed, but testing and/or final review is not yet complete.

IMPLEMENTED
TESTED

The implementation has passed the relevant testing stage, but final review has not yet been approved.

TESTED
DONE

The feature has completed:

SPEC
↓
PLAN
↓
TASK
↓
IMPLEMENT
↓
TEST
↓
REVIEW
↓
APPROVE

and is considered complete for the current project scope.

DONE

A feature must not be marked DONE merely because code exists.

BLOCKED

Development cannot continue because of:

unresolved requirement
architecture conflict
unavailable dependency
external service problem
environment problem
unresolved technical issue
pending approval
BLOCKED
3. Important Rules
3.1 DONE Does Not Mean Rebuild

If a feature is marked:

DONE

AI Agent must not rebuild the feature from scratch.

Instead:

Read FEATURE_STATUS.md
        ↓
Identify existing implementation
        ↓
Inspect actual code
        ↓
Reuse existing implementation
        ↓
Modify / extend / fix when required
3.2 Status Must Reflect Reality

The status must represent the actual state of the project.

Do not mark a feature as:

DONE

when:

implementation is incomplete
tests are failing
required behavior is missing
review has not been completed
important acceptance criteria are not satisfied
3.3 Code Is the Final Evidence

FEATURE_STATUS.md is a project tracking document.

It must not be treated as proof that implementation exists.

When a feature is marked:

IMPLEMENTED
TESTED
DONE

AI Agent should inspect the actual implementation and relevant tests when working on that feature.

If the status conflicts with the actual code:

Actual Code
    ↓
Investigate
    ↓
Update FEATURE_STATUS.md

Do not blindly trust an outdated status.

4. Feature Status

All features are initially marked TODO.

4.1 Authentication & User Management
Feature	Status	SPEC	PLAN	TASK	IMPLEMENT	TEST	REVIEW
User Registration	DONE	✓	✓	✓	IN_PROGRESS	—	—
User Login	DONE	✓	✓	✓	IN_PROGRESS	—	—
User Authentication	DONE	✓	✓	✓	IN_PROGRESS	—	—
User Authorization	DONE	✓	✓	✓	IN_PROGRESS	—	—
User Profile Management	TODO	—	—	—	—	—	—
Daily Goal Settings	TODO	—	—	—	—	—	—
Admin Access	TODO	—	—	—	—	—	—

Stage markers: `✓` = completed at feature level; `IN_PROGRESS` = partial implementation is in progress; `—` = not started or not determinable at feature level.

The system has two authenticated roles:

USER
ADMIN

Guest users are unauthenticated visitors and are not treated as an authenticated role.

## Authentication Backend Foundation and Routes

Status: DONE

### Description

Backend authentication foundation, HTTP route integration and the persistent backend Authentication/security test suite are complete through TASK-010. Together with completed frontend and integration work through TASK-015, the approved Authentication workflow is complete.

### Related Documentation

- SPEC: `docs/specs/AUTHENTICATION_SPEC.md`
- PLAN: `docs/plans/AUTHENTICATION_ROUTES_PLAN.md`
- TASK: `docs/tasks/AUTHENTICATION_ROUTES_TASK.md`
- TEST SPEC: `docs/specs/BACKEND_AUTHENTICATION_TESTS_SPEC.md`
- TEST PLAN: `docs/plans/BACKEND_AUTHENTICATION_TESTS_PLAN.md`
- TEST TASK: TASK-010 in `docs/tasks/AUTHENTICATION_TASK.md`

### TASK-010 Workflow Status

- TASK-010 status: DONE.
- SPEC-010: APPROVED.
- PLAN-010: APPROVED.
- TASK-010: APPROVED.
- IMPLEMENT: COMPLETE.
- TEST-010: PASS.
- REVIEW-010: APPROVED.
- Quality gate: PASSED.

### Backend

- `backend/src/services/authentication-service.js`
- `backend/src/middleware/authentication-middleware.js`
- `backend/src/middleware/role-authorization-middleware.js`
- `backend/src/controllers/auth-controller.js`
- `backend/src/repositories/user-repository.js`
- `backend/src/repositories/auth-session-repository.js`
- `backend/src/utils/password-security.js`
- `backend/src/routes/auth-routes.js`
- `backend/src/app.js`
- `backend/src/main.js`

### API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Database

- `USER` and `AUTH_SESSION` are materialized in the existing Prisma schema.
- No new database change was introduced by TASK-009.

### Tests

- TASK-005: inline Node assertions passed, 13/13.
- TASK-006: inline middleware tests passed, 12/12.
- TASK-007: inline middleware tests passed, 16/16.
- TASK-008: inline controller behavior tests passed, 15 behavior groups.
- TASK-009: route integration tests passed, 16/16, covering route registration, middleware ordering, public/protected flows, unauthorized `/me`, invalid method and health route.
- TASK-010: formal backend Authentication/security suite passed with 27 runnable tests, 0 failures, 6 approved deferred TODOs and 0 skipped tests in two consecutive Authentication runs and the full backend suite; dedicated test database cleanup left 0 `USER` and 0 `AUTH_SESSION` rows.

### Review

- TASK-005: approved with no findings.
- TASK-006: approved with no findings.
- TASK-007: approved with no findings.
- TASK-009: approved with no findings.
- TASK-010: REVIEW-010 approved; quality gate passed.

## Frontend Authentication Service, State, and Login/Register UI

Status: DONE

### Description

TASK-011 frontend Authentication infrastructure, TASK-012 ELVocab Login/Register experience, TASK-013 protected navigation/authenticated shell, TASK-014 frontend Authentication test suite and both phases of TASK-015 integration/security verification have completed IMPLEMENT, TEST and REVIEW quality gates. TASK-001 through TASK-015 are complete and the approved Authentication feature is DONE.

### TASK-011 Workflow Status

- TASK-011 status: DONE.
- TASK-011: APPROVED.
- IMPLEMENT: COMPLETE.
- TEST-011: PASS — 14/14 acceptance criteria.
- REVIEW-011: APPROVED.
- Quality gate: PASSED.

### TASK-012 Workflow Status

- TASK-012 status: DONE.
- TASK-012: APPROVED.
- IMPLEMENT: COMPLETE.
- TEST-012: PASS — all targeted corrections and regressions verified.
- REVIEW-012: APPROVED.
- `REVIEW012-01`, `TEST012-RESP-01`, `REVIEW012-02` and `REVIEW012-03`: RESOLVED.
- Human Visual Check: PASSED.
- Quality gate: PASSED.

### TASK-013 Workflow Status

- TASK-013 status: DONE.
- TASK-013: APPROVED.
- IMPLEMENT: COMPLETE.
- TEST-013: PASS — responsive runtime matrix and Authentication-state regressions verified.
- REVIEW-013: APPROVED.
- `TEST013-RESP-01`: RESOLVED.
- Quality gate: PASSED.

### TASK-014 Workflow Status

- TASK-014 status: DONE.
- TASK-014: APPROVED.
- IMPLEMENT: COMPLETE.
- TEST-014: PASS — 20 `node:test` tests and 18 Playwright Chromium tests; aggregate 38/38.
- REVIEW-014: APPROVED after corrective re-review.
- `REVIEW014-01` and `REVIEW014-02`: RESOLVED.
- Responsive Chromium matrix: PASSED at 375×812, 768×1024 and 1366×768.
- Quality gate: PASSED.

### TASK-015 Workflow Status

- TASK-015 deterministic contract: APPROVED.
- TASK-015 overall status: DONE.
- Phase A status: COMPLETE.
- Phase A IMPLEMENT: COMPLETE.
- Phase A TEST: PASS — real Browser → Vite → Express → Prisma → dedicated Supabase TEST DB flow and regressions passed.
- Phase A REVIEW: APPROVED after the AC-015-11 finding was resolved and verified.
- Phase A open findings: 0.
- Phase B Preview database adjustment: APPROVED — the existing dedicated non-production TEST database may be reused temporarily through Preview-scoped `DATABASE_URL`; production/main data is prohibited and destructive/reset tests may not run concurrently.
- Phase B final Human Gate: APPROVED — same-team protected Vercel Previews, backend branch-specific upstream rewrite and interactive real-stack verification are authorized.
- Phase B prerequisite IMPLEMENT: COMPLETE.
- Phase B TEST: PASS — AC-015-01 through AC-015-18 passed; `TEST015-PB-01` through `TEST015-PB-05` are closed.
- Phase B REVIEW: APPROVED — REVIEW-015 reported no findings or blockers.
- Phase B Preview USER, ADMIN and owned-session fixtures: CLEANED UP from the dedicated TEST DB; unrelated TEST data was preserved.
- Approved deferred TODOs: 3, preserved as deferred and not counted as TASK-015 failures.
- TASK-001 through TASK-015: COMPLETE.
- Authentication quality gate: PASSED.

### Frontend

- Reusable Axios client and Authentication service use relative `/api/auth/**` endpoints.
- Shared Authentication state owns bootstrap, register, login, logout and current-user refresh transitions.
- Browser-managed `HttpOnly` session-cookie architecture remains authoritative; frontend does not read or persist the raw session token.
- Vite proxies development `/api/**` requests to the local Express backend.
- ELVocab Login/Register routes use one persistent responsive Auth experience with accessible validation, loading, safe error and registration-success states.
- Registration does not auto-login; successful registration hands off to Login, while successful Login navigates to the minimum `/dashboard` destination.
- `/dashboard` is protected by the shared Authentication state; Guest and authenticated Guest-route redirects follow the approved route contract.
- The responsive authenticated shell provides ELVocab branding, Dashboard navigation, backend-provided account identity, conditional non-interactive Admin context and Logout/session-expiration UX.

### Tests

- TASK-011 automated Authentication suite passed with 12 tests and 0 failures.
- Frontend production build and lint passed during formal TEST-011.
- TASK-012 targeted verification passed after pronunciation semantics, tablet responsiveness and diff-hygiene corrections; the existing Auth suite remained at 12 passing tests with 0 failures.
- TASK-012 frontend production build, lint and responsive runtime checks passed; breakpoint boundaries at 899/900/901 pixels were verified.
- TASK-013 formal test re-run passed after closing `TEST013-RESP-01`; the required 375/768/900/1024/1366/1536 viewport matrix, routing/Auth states, USER/ADMIN presentation, Logout states and accessibility interactions were verified.
- TASK-013 retained the existing Authentication regression suite at 12 passing tests with 0 failures; frontend lint, production build and diff checks passed.
- TASK-014 added the approved two-layer frontend Authentication suite: 20 focused `node:test` tests and 18 isolated Playwright Chromium tests, all passing.
- TASK-014 aggregate Authentication tests, responsive viewport matrix, frontend lint, production build and diff checks passed.
- TASK-015 Phase A local real-stack integration passed 2/2; backend Authentication regression passed 29 runnable tests with 0 failures and 3 approved deferred TODOs.
- TASK-015 Phase B Vercel Preview verified the real USER and ADMIN flows, host-only secure cookie contract, same-origin rewrite, no-store Auth responses, leakage controls and exact TEST DB fixture cleanup.

### Pending Follow-ups

- `docs/ARCHITECTURE.md` deployment baseline synchronization with the selected two-project Vercel topology remains pending.
- Historical stale TASK-011 approval wording in the corrective Authentication PLAN footer remains pending documentation synchronization.
- Production deployment remains outside TASK-015 and was not performed.

4.2 Topics

Topics organize vocabulary sets.

Conceptual hierarchy:

Topic
  ↓
Vocabulary Set
  ↓
Vocabulary
Feature	Status	SPEC	PLAN	TASK	IMPLEMENT	TEST	REVIEW
Topic Management	DONE	✓	✓	✓	✓	✓	✓
Topic Listing	DONE	✓	✓	✓	✓	✓	✓
Topic-based Vocabulary Set Discovery	TESTED	✓	✓	✓	✓	✓	✓

Topic behavior and data rules are defined in the project documentation.

## Topic V1 Metadata, Public Reads and ADMIN Management

Status: DONE

### Description

Topic V1 is complete for the approved isolated Topic metadata model, public Topic list/detail and backend-authorized ADMIN CRUD. Vocabulary Set V1 separately materializes Topic-based Set discovery and the Topic `RESTRICT` relation; neither is retroactively included in Topic V1's DONE evidence.

### Workflow Status

- TASK-019 through TASK-020 and TASK-022 through TASK-023: COMPLETE.
- TASK-021 backend/database/API/security verification: PASS — 16 Topic tests; Authentication regression 29 passed, 0 failed, 3 approved existing TODOs.
- TASK-024 frontend/browser verification: PASS — 9 Topic browser tests, 25 Auth browser tests, 7 App Layout tests and 20 frontend unit tests; responsive/accessibility/lint/build gates passed.
- TASK-025 formal TEST: PASS — 15 applicable acceptance criteria passed; AC-13 remains explicitly deferred; 0 failed.
- TASK-025 formal REVIEW: APPROVE — no findings or blockers.
- Dedicated TEST DB fixture cleanup: PASS — 0 Topic fixtures and 0 Topic E2E account fixtures remained.
- Topic V1 quality gate: PASSED.

### Implemented Boundary

- Isolated five-field `TOPIC` model with UUID identifier, timestamps, nullable description and PostgreSQL functional uniqueness on `LOWER(name)`.
- Public `GET /api/topics` and `GET /api/topics/:topicId` metadata APIs and explicit public frontend routes.
- Backend-authorized ADMIN create/update/delete APIs and ADMIN management UI in the existing authenticated App Layout.
- Client-side Topic search, required safe UI states, responsive behavior and accessible forms/delete confirmation.

### Deferred / Unchanged

- AC-13 was completed separately by Vocabulary Set V1: Topic V1 itself created no relation/FK, RESTRICT state or relation-state test.
- Topic-based Vocabulary Set Discovery is `TESTED` through the Vocabulary Set V1 workflow.
- No Vocabulary Set model/data/count/mock, Vocabulary direct-topic field, pagination, server-side search, XP, streak, progress or learning behavior was added.
- Authentication and Authenticated App Layout `DONE` statuses remain unchanged.

4.3 Vocabulary
Feature	Status	SPEC	PLAN	TASK	IMPLEMENT	TEST	REVIEW
Vocabulary Management	DONE	✓	✓	✓	✓	✓	✓
Vocabulary Multiple Meanings	DONE	✓	✓	✓	✓	✓	✓
Vocabulary Context / Example	DONE	✓	✓	✓	✓	✓	✓
Vocabulary Search	DONE	✓	✓	✓	✓	✓	✓
Vocabulary Pronunciation Information	DONE	✓	✓	✓	✓	✓	✓
Personal Vocabulary V1	DONE — HUMAN APPROVED	HUMAN APPROVED	HUMAN APPROVED	HUMAN APPROVED	COMPLETE	PASS	APPROVED

Vocabulary may have multiple meanings depending on context.

Vocabulary pronunciation information may include model pronunciation information such as phonetic information and pronunciation audio.

## Vocabulary V1 ADMIN Catalog

Status: DONE

### Workflow Status

- TASK-026 through TASK-032: COMPLETE.
- TASK-033 formal TEST: PASS.
- TASK-033 formal REVIEW: APPROVE.
- TASK-033 closure: HUMAN AUTHORIZED; no blocker remains.
- Dedicated TEST DB fixture cleanup, diff, secret and scope checks: PASS.

### Implemented Boundary

- ADMIN-only `VOCABULARY → VOCABULARY_MEANING → VOCABULARY_EXAMPLE` aggregate with UUID identifiers, Meaning-only nullable CEFR metadata, owned-child deletion and case-insensitive word uniqueness.
- ADMIN aggregate list/detail/create/PATCH/delete API and management UI with client-side search, complete-aggregate editing, nested Meaning/Example replacement, accessible states and delete confirmation.

### Deferred / Unchanged

- No public or USER Vocabulary catalog, direct Topic relation, Vocabulary Set/Set Item, learning, SRS, Quiz, XP/Streak, pronunciation practice or AI functionality was introduced by Vocabulary V1.
- Vocabulary Set V1 separately materializes the first external Vocabulary reference and its `RESTRICT` policy; its scoped picker is editor-only and not a Vocabulary catalog.

4.4 Vocabulary Sets
Feature	Status	SPEC	PLAN	TASK	IMPLEMENT	TEST	REVIEW
System Vocabulary Set	DONE	✓	✓	✓	✓	✓	✓
User-Created Vocabulary Set	DONE	✓	✓	✓	✓	✓	✓
Vocabulary Set Ownership	DONE	✓	✓	✓	✓	✓	✓
Vocabulary Set Visibility	DONE	✓	✓	✓	✓	✓	✓
Edit Own Vocabulary Set	DONE	✓	✓	✓	✓	✓	✓
Delete Own Vocabulary Set	DONE	✓	✓	✓	✓	✓	✓
Copy Vocabulary Set	DONE	✓	✓	✓	✓	✓	✓
Vocabulary Set Discovery	DONE	✓	✓	✓	✓	✓	✓
Public Word to Personal Set	IN_PROGRESS	✓	✓	✓	✓	⏳	⏳

System vocabulary sets are created and managed by Admin.

User-created vocabulary sets are private by default.

Users cannot directly change their own vocabulary set to public.

Users can share their own vocabulary sets through Community.

A copied vocabulary set becomes a new private set owned by the user who copied it.

## Personal Vocabulary Set Topic Decoupling V1

Status: DONE — implementation, TEST and REVIEW complete; HUMAN-approved for closure.

- Public ADMIN-managed System Sets retain one required Topic, enforced by service validation and the database check `NOT is_public OR topic_id IS NOT NULL`.
- USER Personal Set writes reject `topic_id`; new and copied Personal Sets are topicless, while existing categorized Personal Sets remain readable and preserve their reference on supported updates.
- Topic deletion remains `RESTRICT`; referenced deletion returns `409 TOPIC_IN_USE` without cascade.
- Learning exposes `topic: TopicSummary | null`; Quiz, ordered exact-ID membership, ownership, visibility and public Topic discovery remain unchanged.
- Approved source: `docs/specs/PERSONAL_VOCABULARY_SET_TOPIC_DECOUPLING_V1_SPEC.md`; formal REVIEW result: APPROVE.

## Discovery V1 — Khám phá bộ từ

Status: DONE — TASK-141 formal TEST PASS, REVIEW APPROVE and HUMAN closure approval complete.

### Implemented Boundary

- `/topics` is the Set-first public System Set catalog. The frontend composes existing Topic and Topic-scoped Set APIs with concurrent requests (`1 + T`), publishes atomically, and performs client-side name/description search plus exact single-Topic filtering only after complete readiness.
- Authenticated USER remains inside the App Shell, Guest browsing remains public, and ADMIN remains browse-only. Public Set Detail is read-only, visually aligned with Personal Set Detail, and lets USER enter Flashcard or Quiz without copying; Save remains optional.
- The compact catalog provides a production-visible **Bộ từ nổi bật** section using the first 3 complete-catalog Sets in deterministic source order, a wider filter rail, responsive three-column cards where space permits, and nine normal Sets per client-side page. Featured selection remains independent of filters and does not consume page slots; filter changes reset to page 1 and page changes make no request.
- Cards provide deterministic cover visuals, overlaid Topic labels, aligned title/count, two-line descriptions, accessible Lucide actions and best-effort current-session saved feedback. Copy still creates a fresh independent private Set and repeated copies remain allowed.
- TASK-129 composition evidence was HUMAN accepted. Final evidence includes Discovery/Vocabulary Set unit and service `12/12`, Discovery/Auth/App Shell mocked browser `35/35`, Learning/Quiz/Personal Set Detail regression `51/51`, guarded real-stack `14/14`, all approved responsive widths, full frontend lint, production build and diff checks.
- TASK-141 formal TEST result is **PASS** and formal REVIEW verdict is **APPROVE**, with no remaining CRITICAL, HIGH, MEDIUM or LOW findings. Guarded TEST DB isolation preserved unrelated users/sessions at `5 → 5` / `8 → 8` and left no run-owned `E2E-` Topic, Set or user fixture.

### Deferred / Non-blocking

- Community-shared USER Sets, creator/social attribution, sorting, server-side global search/pagination, authoritative featured/curated ranking, and account-level saved-source recognition are not implemented.
- Discovery V1 originally shipped without per-Set CEFR/cover persistence; the separately completed Vocabulary Set Metadata Refactor below now supplies those capabilities.
- Discovery V1 itself introduced no backend, API, schema, migration, dependency, ownership, visibility, Learning, Quiz or copy semantic change.

## Vocabulary Set Metadata Refactor

Status: DONE — TASK-165 formal TEST PASS and HUMAN approved; TASK-166 formal REVIEW APPROVE. Pending separate HUMAN authorization for commit/push/integration.

- Added the forward-only nullable Set metadata migration: `cefr_level` (`A1`–`C1`), `cover_image_url`, and internal `cover_storage_key`, with no inference, default, historical backfill, blob/`bytea`, or rewrite of legacy null rows.
- Extended existing System/Personal Set contracts and forms. ADMIN System Sets require Set CEFR; USER Personal CEFR remains optional. External covers accept HTTPS only. API responses expose safe Set CEFR/display URL and never expose managed keys or credentials.
- Uploaded JPEG/PNG/WebP covers use bounded backend validation and Sharp optimization to WebP quality 82, longest edge at most 1600 px. One public-read Supabase bucket is backend-write/delete-only; lifecycle compensation, exact cleanup retry, managed copy and Set-owned key enforcement are implemented.
- TEST Storage fails closed on dedicated `TEST_SUPABASE_*` configuration and never falls back to ordinary Storage identity. Real-provider verification uses only exact run-owned TEST objects and no bucket-wide cleanup.
- My Sets/Discovery cards render persisted covers with deterministic broken/missing fallback. Detail headers intentionally omit cover duplication. Discovery provides client-side Set CEFR filtering and retains nine normal Sets per page plus the independent first-three Featured section.
- TASK-163 visual corrections are HUMAN approved. TASK-164 documentation reconciliation, TASK-165 formal TEST, and TASK-166 formal REVIEW are complete with no BLOCKER, MUST FIX, or SHOULD FIX findings.
- Approved deferred items are account-level saved-source recognition, authoritative Featured ranking, real-cover curation/content-policy improvements, broader ADMIN redesign/polish, and select/dropdown UI polish. Automatic Set CEFR inference, Set-level C2/ranges, image crop/editor/generation, remote-image proxying, Community/recommendations/ranking, and bulk import remain outside the approved V1 scope.

## Set Detail V1

Status: DONE — implementation, cumulative TEST, and REVIEW complete; ready for HUMAN commit approval.

- Personal Set Detail is implemented as the owner-scoped learning and vocabulary-management hub, including add/search/create/edit/remove Vocabulary flows with exact identity and ownership boundaries preserved.
- Populated Personal Sets enter Flashcard and Quiz through the approved focus-mode flows; empty Sets remain manageable without starting an invalid run.
- Authenticated USER mobile/tablet/desktop presentation includes the responsive ELVocab header branding and approved App Shell behavior.
- Relevant Set Detail, Learning Progress, Quiz, Dashboard, and shared USER presentation styles completed the approved CSS-to-Tailwind migration while retaining required global primitives.
- Focused and cumulative regression verification passed, including the guarded dedicated-TEST-database real-stack suites and reconciled accessible workflow assertions.
- SRS scheduling and Flashcard self-rating remain explicitly deferred to a separate future feature/branch; they are not part of Set Detail V1.
- Approved sources: `docs/specs/SET_DETAIL_V1_SPEC.md`, `docs/plans/SET_DETAIL_V1_PLAN.md`, and `docs/tasks/SET_DETAIL_V1_TASK.md`.

## Vocabulary Set V1 Closure Preparation

Status: DONE

### Workflow Status

- TASK-034 through TASK-044: COMPLETE.
- TASK-044 formal TEST: PASS — AC-01 through AC-14 passed.
- TASK-044 formal REVIEW: APPROVE — no findings or blockers.
- TASK-044 closure: HUMAN AUTHORIZED; no blocker remains.
- Dedicated TEST DB fixture cleanup, lint, production build, diff, secret and scope checks: PASS.

### Verified Evidence

- Vocabulary Set database/backend/API/security: 8/8 PASS; Authentication, Topic and Vocabulary backend regressions: 58 PASS with 3 existing approved TODOs.
- Frontend unit: 24/24 PASS; Auth/App Layout browser: 25/25 PASS.
- Vocabulary Set browser: public 3/3, USER 2/2 and ADMIN 3/3 PASS.
- Cross-feature real-stack: Authentication 2/2, Topic 9/9 and Vocabulary 5/5 PASS.

### Implemented Boundary

- Public ADMIN-managed System Sets, private owner-scoped USER Sets, independent System-to-private copy, ordered aggregate Items and Topic-based public discovery.
- Set Items reference Vocabulary only; complete Item replacement/reordering, reference validation and transactions remain backend-authoritative.
- The authenticated bounded Vocabulary picker is available only inside Set editors and returns minimal selection metadata.

### Deferred / Unchanged

- No standalone USER Vocabulary catalog, public User Sets, Community sharing, Flashcard, Learning Progress, SRS, Quiz, XP/Streak, pronunciation practice or AI behavior was introduced.
- Vocabulary Set V1 closure is complete; deferred features remain outside this DONE boundary.

4.5 Learning
Feature	Status	SPEC	PLAN	TASK	IMPLEMENT	TEST	REVIEW
Vocabulary Learning Session	DONE	✓	✓	✓	✓	✓	✓
Learning Session V1 Enhancement	DONE	✓	✓	✓	✓	✓	✓
Flashcard Learning	DONE	✓	✓	✓	✓	✓	✓
Learning Progress	DONE	✓	✓	✓	✓	✓	✓
Learning Progress View V1	DONE	✓	✓	✓	✓	✓	✓
Spaced Repetition	DONE	✓	✓	✓	✓	✓	✓
Words to Review	DONE	✓	✓	✓	✓	PASS	APPROVE
Topic Learning Progress	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Continue Learning	DONE	✓	✓	✓	✓	PASS	APPROVE

Review Experience V1	DONE	✓	✓	✓	✓	PASS	APPROVE

## Review Experience V1 Closure

Functional status: **HUMAN CLOSED WITH DOCUMENTED LIMITATIONS**

Closure date: 2026-11-09.

### Accepted Functional Scope

- Authenticated USER Review Center at `/review` remains non-mutating and presents backend-authoritative unique global due counts plus positive-due PUBLIC/PERSONAL Set entries.
- `/review/global` and `/review/sets/:setId` use focused review layouts while preserving separate GLOBAL and SET session controllers, storage identities, scheduler behavior and rating semantics.
- Review-context SET learning is URL-derived, SRS-only and returns to Review Center; standard learning preserves its existing Normal/SRS behavior.
- SET Review, GLOBAL Review and standard learning reuse the accepted shared Flashcard presentation without merging their authoritative controllers.
- Dashboard **Xem ôn tập**, USER learning navigation, loading/error/empty/retry behavior, responsive/accessibility behavior and the final compact Review Center UI are included in the accepted scope.

### Documented Limitations

- Database-backed and real-stack E2E were **NOT RUN** for Review Experience V1 closure.
- Preview TEST runtime verification gaps accepted for TASK-RE-A02 and TASK-RE-A07 remain; the historical global 12-to-zero transition and exact Set overlap/count assignment were not independently reconstructed.
- Strict cross-statement snapshot isolation was not established.
- The intermittent login HTTP 500 root cause remains unresolved.
- SET SRS initialization latency above ten seconds is deferred to Performance V3.

### Integration Status

- Functional closure does not imply production readiness. At closure, the Review Experience implementation remains uncommitted/untracked and is not integrated into `dev` or `main`.
- Commit, push, merge, deployment and post-deployment verification remain separate pending HUMAN gates.

## CEFR Learning Path V1 Closure

Status: DONE — HUMAN FINAL ACCEPTED on 2026-11-05; documentation publication is verified, while merge and deployment were not performed.

### Accepted Evidence

- Final Gate 2 run `41974809164` passed `149/149` executed assertions with `0 FAIL` and `0 SKIP` against tested source `309d46179ec05d4af429c27107080a4cedb1304a` using workflow `c3ec2b02f82e8cb50539c7b6c23f11f24aa2dac7`.
- TASK-014 documentation corrections were published at `2f82e0d22ba79c084dff40dcbfc4a28dbc56b3be`; MEDIUM-01 and MEDIUM-02 are resolved, TASK-014 acceptance criteria passed read-only re-review, and the prior HUMAN UI/UX approval is preserved.
- HUMAN final acceptance explicitly accepts the disclosed verification limitations and authorizes this separate DONE status record without authorizing merge or deployment.

### Accepted Limitations

- Actual Chrome browser-level 200% zoom remains unverified and is not claimed as PASS.
- Final Gate 2 did not select the dedicated Quiz/Speaking locked-state UI E2E specs. Earlier focused evidence covers those corrections with `62/62` offline PASS and `26/26` mocked Chromium PASS; it is not represented as final Gate 2 execution.

### Integration Status

- Verification publication is complete. Merge, deployment, Production verification and post-deployment smoke testing were not performed and remain separate from feature acceptance.

## CEFR Learning Progress V2

Status: IN_PROGRESS — ACCEPTANCE EVIDENCE PASS

### Scope and source

- Approved feature source: `7a212108c7ae63294ce43c97dffe6bb1270a7a84`.
- Approved SPEC: `docs/specs/CEFR_LEARNING_PROGRESS_V2_SPEC.md`.
- Approved PLAN: `docs/plans/CEFR_LEARNING_PROGRESS_V2_PLAN.md`.
- Approved TASK: `docs/tasks/CEFR_LEARNING_PROGRESS_V2_TASK.md`; TASK-010 documentation sync is implemented in this worktree.
- V2 combines immediate durable first credit from pass-linked NORMAL reveals and CEFR-scoped SRS ratings, including `AGAIN`, while preserving explicit final completion, bounded sessions, SRS scheduling, monotonic entitlement, and independent Quiz/Speaking/ordinary SRS boundaries.

### Verified CI evidence

- [PostgreSQL Integration run 43402432992](https://github.com/Hau-2251220056/EngLish-Vocabulary/actions/runs/43402432992): `SUCCESS`, attempt 1; 7/7 offline guards and 6/6 ephemeral PostgreSQL integration tests.
- [Browser run 43553259145](https://github.com/Hau-2251220056/EngLish-Vocabulary/actions/runs/43553259145): `SUCCESS`, attempt 1; 16/16 selected browser tests comprising 13 CEFR real-stack cases, two mocked SRS cases, and one global SRS non-credit regression.
- [Acceptance-gap run 43678604817](https://github.com/Hau-2251220056/EngLish-Vocabulary/actions/runs/43678604817): `SUCCESS`, attempt 1, job `132704119326`, artifact `14146963833`; workflow registration merge `2a282f119a05aa94501a9b61efdf12c0772d0986` checked out pinned feature source `7a212108c7ae63294ce43c97dffe6bb1270a7a84` and enforced three selected mocked browser outcomes plus one guarded PostgreSQL Quiz non-credit outcome.
- The initial TASK-010 audit recorded 28/30 acceptance criteria as PASS. Run `43678604817` supplies the previously missing runtime evidence for AC-V2-019 and AC-V2-024; it is not used as a substitute for the other 28 criteria.

### Acceptance matrix

Evidence abbreviations: `PG` = run `43402432992`; `BR` = run `43553259145`; `AG` = run `43678604817`; `AUDIT` = initial TASK-010 source/test traceability audit at the approved feature source.

| AC | Result | Evidence | Limitation / boundary |
|---|---|---|---|
| AC-V2-001 | PASS | AUDIT, PG, BR | NORMAL evidence is Backend-accepted; explicit completion remains separate. |
| AC-V2-002 | PASS | AUDIT, PG, BR | CEFR-scoped SRS only; ordinary/GLOBAL SRS does not credit. |
| AC-V2-003 | PASS | AUDIT, PG, BR | Mixed-mode first credit is deduplicated by exact pass item. |
| AC-V2-004 | PASS | AUDIT, PG, BR | `AGAIN` credits CEFR but remains unresolved in SRS. |
| AC-V2-005 | PASS | AUDIT, PG | Replays/repeated ratings do not increase unique credited count. |
| AC-V2-006 | PASS | AUDIT, PG, BR | Every immutable Learning Session batch remains at most ten items. |
| AC-V2-007 | PASS | AUDIT, PG, BR | Eleven-item boundary requires the final item. |
| AC-V2-008 | PASS | AUDIT, PG, BR | Replacement/next batches contain only uncredited items in pass order. |
| AC-V2-009 | PASS | AUDIT, PG, BR | Accepted evidence persists across recovery and later expiry. |
| AC-V2-010 | PASS | AUDIT, PG | Expired-session mutations are rejected. |
| AC-V2-011 | PASS | AUDIT, PG, BR | Ready state still requires explicit USER confirmation. |
| AC-V2-012 | PASS | AUDIT, PG, BR | Completion is idempotent and entitlement remains Backend-owned. |
| AC-V2-013 | PASS | AUDIT, PG, BR | A2 unlock is demonstrated only after required A1 completion. |
| AC-V2-014 | PASS | AUDIT, PG, BR | Earned/terminal entitlement remains monotonic after curriculum change. |
| AC-V2-015 | PASS | AUDIT, PG, BR | Restart preserves the invalidated attempt and does not transfer credit. |
| AC-V2-016 | PASS | AUDIT, PG, BR | Ordinary SET, Review Center, and GLOBAL SRS retain non-credit behavior. |
| AC-V2-017 | PASS | AUDIT, PG, BR | Existing SRS transitions, Progress, XP, and Streak remain authoritative. |
| AC-V2-018 | PASS | AUDIT, BR | Completed-Set relearning is fresh independent NORMAL, not a new pass. |
| AC-V2-019 | PASS | AG | Quiz frontend and Speaking frontend are mocked; Quiz backend non-credit uses PostgreSQL. No full real-stack Speaking backend claim. |
| AC-V2-020 | PASS | AUDIT, PG, BR | Only the exact active pass is resumable. |
| AC-V2-021 | PASS | AUDIT, BR | Next Suggestion remains independent and excludes the active Set. |
| AC-V2-022 | PASS | AUDIT, PG, BR | Foreign, locked, private, and malformed attempts do not credit. |
| AC-V2-023 | PASS | AUDIT, PG | Guarded concurrent NORMAL/SRS acceptance permits at most one first credit. |
| AC-V2-024 | PASS | AG | Focused mocked browser evidence verifies accessible pending/retry behavior; it is not a latency benchmark. |
| AC-V2-025 | PASS | AUDIT, PG | Guarded migration accepts only exact V1 pass-linked NORMAL evidence. |
| AC-V2-026 | PASS | AUDIT, PG, BR | First `AGAIN` credits once while ordinary requeue remains active. |
| AC-V2-027 | PASS | AUDIT, BR | Exact SRS resume and remaining-CEFR continuation remain distinct. |
| AC-V2-028 | PASS | AUDIT, PG, BR | Unresolved SRS remains resumable until completion/expiry; prior credit survives expiry. |
| AC-V2-029 | PASS | AUDIT, PG | Backfill can make a pass ready but cannot complete or unlock it. |
| AC-V2-030 | PASS | AUDIT, PG | Migration preserves completion/entitlement and fails closed on invalid evidence. |

### Verification limitations and status gate

- The acceptance matrix records acceptance evidence, not deployment. No Main, Preview, or Production migration/deployment is claimed.
- Acceptance-gap frontend coverage is intentionally mocked and selected; it does not expand into live Speaking recognition, device audio, or full Speaking backend real-stack coverage.
- Workflow runtime evidence passed, but formal HUMAN acceptance of TASK-010 and the CEFR V2 `DONE` transition has not occurred.
- Proposed final status remains `IN_PROGRESS — ACCEPTANCE EVIDENCE PASS` until HUMAN reviews this documentation, formal TEST/REVIEW results, and explicitly authorizes `DONE`.

Learning Progress represents the current learning state of a user for individual vocabulary.

Conceptual learning states include:

NEW
↓
LEARNING
↓
LEARNED
↓
NEEDS_REVIEW

Flashcard / Learning with SRS V1 originally shipped with transient client run state and backend-authoritative per-`(user_id, vocabulary_id)` progress but no persistent Learning Session. Streak V1 later supersedes that historical session boundary for qualifying NORMAL/SRS/Quiz groups with Backend-owned sessions, item evidence and daily qualification; it does not introduce a general learning-history/analytics product.

Learning Session V1 is `DONE` and HUMAN approved. NORMAL Flashcard, SRS Flashcard, Quiz and Speaking Practice use resilient USER/Set/mode-isolated same-tab sessions, stable ordered batches of at most 10 distinct Vocabulary IDs, safe Set reconciliation and explicit continuation/restart. Quiz bounded-read authorization remains backend-authoritative, SRS scheduling and mutation integrity are preserved, and Speaking recognition data remains transient. Formal TEST, focused UI/UX review, guarded Backend DB Integration and Real Stack Browser CI, and final REVIEW passed. Live Chrome microphone/vendor-recognition behavior and device-specific audio routing remain deferred manual verification because guarded mocked/browser CI does not establish those device-dependent paths.

## Flashcard / Learning V1 Closure

Status: DONE

### Workflow Status

- TASK-045 through TASK-054: COMPLETE and HUMAN APPROVED.
- TASK-054 formal TEST: PASS — AC-01 through AC-15 passed.
- TASK-054 formal REVIEW: APPROVE — no findings or blockers.
- Flashcard / Learning V1 closure: HUMAN AUTHORIZED.
- Guarded TEST fixtures and dedicated processes/listeners were cleaned; lint, production build, diff, secret and scope checks passed.

### Verified Evidence

- Learning database/backend/API/security: 9/9 PASS; required Authentication, Vocabulary and Vocabulary Set backend regressions passed.
- Frontend unit: 39/39 PASS; Auth/App Layout browser: 25/25 PASS.
- Dedicated Learning browser: 4/4 PASS.
- Combined real-stack: 28/28 PASS — Authentication 2, Learning 4, Topic 9, Vocabulary 5 and Vocabulary Set 8.

### Implemented Boundary

- Authenticated USER learning from a public System Set or owned private Set in explicit Item order.
- Durable backend-authoritative progress remains unique per `(user_id, vocabulary_id)`, with transactional meaningful events, revision protection and immediate-current-event retry behavior.
- At this historical Flashcard V1 closure, same-tab run state was Learning-owned and transient and no persistent Learning Session/history existed. Streak V1 later adds its narrowly scoped authoritative qualifying-session records while frontend recovery state remains transient.
- The HUMAN-approved Focus Mode Flashcard experience includes deterministic primary-Meaning presentation, accessible interaction, optional stored-audio/native-TTS pronunciation and responsive/reduced-motion behavior.
- Prompt 308 hardens the shared pronunciation lifecycle for Flashcard playback: intentional cancellation detaches native callbacks, stale card events are ignored by generation/target ownership, repeated playback cannot overlap, genuine failures remain non-blocking, and unsupported browser playback does not block learning. Automated Speech API coverage is mocked; real Chrome/Cốc Cốc/Edge/Firefox/Safari audio behavior remains a HUMAN cross-browser acceptance gate.

### Deferred / Non-blocking

- Spaced Repetition was delivered as the separately approved SRS V1 extension described below. At this historical Flashcard V1 closure, Words to Review, Topic Learning Progress and Continue Learning remained `TODO`; CEFR Learning Path V1 now implements Words to Review and Continue Learning, while Topic Learning Progress remains `TODO`.
- Quiz, XP/gamification, Dashboard, Pronunciation Practice, Community and AI remain outside this DONE boundary.
- Guarded remote TEST DB latency was separately diagnosed as database/network round-trip dominated. It is a non-blocking performance observation and no optimization was included in this closure.

## SRS V1 Closure

Status: DONE

### Workflow Status

- Approved SPEC, PLAN and TASK are synchronized with the final 1/3/7-day NEW timing revision.
- TASK-090 through TASK-106 and revision tasks TASK-105A through TASK-105D are complete; all mandatory HUMAN checkpoints through TASK-106 were approved.
- Formal TEST: PASS. Formal REVIEW: APPROVE. No blocking findings remain.
- This SRS V1 milestone itself added no Prisma schema/migration, package dependency or persistent Learning Session/history. The separately approved later Streak V1 migrations supersede only that historical persistence statement.

### Verified Scope

- Default fixed-snapshot SRS sessions include eligible NEW, LEARNING, legacy-compatible and due items; NORMAL returns all Set items and never mutates scheduling/progress.
- The backend-authoritative deterministic ladder is stage 0 then 1/3/7/14/30 days. NEW `HARD`/`GOOD`/`EASY` schedule 1/3/7 days; `AGAIN` resets to immediately-due stage 0 and remains unresolved in-session.
- Backend-provided rating previews map to **Trong phiên này**, **Ngày mai**, **1–3 ngày**, **1 tuần+**, **2 tuần**, and **30 ngày** without frontend scheduler duplication.
- Duplicate/retried events cannot advance scheduling twice. Exact-ID queue state preserves at most one pending occurrence; `AGAIN` reappears after three other presentations when possible, otherwise at queue end.
- Existing Flashcard 3D/pronunciation/focus shell, NORMAL Previous/Next, responsive/accessibility behavior, derived Learning Progress due state, Set access and USER-only authorization are preserved.

### Formal Evidence

- Pure scheduler: 5/5 PASS; guarded backend Learning integration: 20/20 PASS; focused frontend Learning unit tests: 20/20 PASS; mocked Flashcard Playwright: 22/22 PASS.
- Dedicated real stack: Learning 10/10, Learning Progress 5/5, Authentication/Quiz 5/5, Dashboard 2/2, public Set Detail 3/3 and USER Set Detail 2/2 PASS.
- Production build, full/touched-file ESLint and `git diff --check` PASS. TEST cleanup preserved unrelated/manual users and sessions.

### Deferred / Non-blocking

- At this historical SRS V1 closure, Words-to-Review/Dashboard review summaries, Topic progress and Continue Learning remained outside SRS V1. CEFR Learning Path V1 now implements the bounded global review, Dashboard review summary and next-learning recommendation without changing the SRS scheduler; Topic progress, persistent history/session analytics, FSRS/SM-2, gamification and pronunciation expansion remain deferred.
- `ease_factor` remains unused. The 30-day interval cap remains intentional.
- Configured development database migration parity remains `NOT VERIFIED — Supabase/Prisma schema-engine error`; dedicated `.env.test` migration parity passed with 7 migrations and none pending. No main database mutation was performed.

## Learning Progress View V1

Status: DONE

### Closure Preparation

- The existing Learning Progress persistence/mutation engine and Flashcard / Learning V1 closure remain `DONE`.
- The approved extension adds only a USER-facing read API and `/my/learning-progress` view over persisted current state.
- TASK-064 through TASK-072 are complete and HUMAN approved. TASK-072 formal TEST is `PASS` for AC-01 through AC-15 and formal REVIEW is `APPROVE`, with no findings or blockers.
- HUMAN final closure is approved; Learning Progress View V1 is `DONE` while the existing Learning Progress engine remains a separate completed capability.
- Summary covers persisted `LEARNING`, `LEARNED` and compatibility-only `NEEDS_REVIEW`; conceptual `NEW` is excluded.
- Status filtering and bounded pagination are included; search is deferred.
- This historical Learning Progress View V1 boundary authorized no schema migration, SRS/review queue, Topic/Set progress, Continue Learning, history, accuracy, Quiz/Pronunciation result, XP/gamification, Dashboard or Flashcard redesign. CEFR Learning Path V1 later authorizes and implements only its approved additive schema, bounded global review and next-learning recommendation; the other exclusions remain unchanged.

### Formal Evidence

- Guarded backend Learning coverage: 12/12 PASS, including USER-only authorization, current-user isolation, query validation, deterministic pagination/filter ordering, minimal projection, compatible `NEEDS_REVIEW`, consistent reads and repeated-read invariance.
- Focused frontend evidence: Learning service 4/4 PASS; mocked Learning Progress states and accessibility 6/6 PASS; scoped Auth/App Layout responsive regressions 16/16 PASS; ESLint and production build PASS.
- Guarded Learning Progress real-stack: 5/5 PASS. Complete sequential real-stack regression: 33/33 PASS — Auth 2, Learning Progress 5, Learning 4, Topic 9, Vocabulary 5 and Vocabulary Set 8.
- Final mocked Auth/App Layout/Progress browser regression: 32/32 PASS. Controlled TEST fixtures and scoped processes/listeners were cleaned; diff, secret and scope checks passed.

### Deferred / Non-blocking

- Word search and client-selectable sorting remain deferred.
- At this historical Learning Progress View V1 closure, conceptual `NEW` global counting, automatic `NEEDS_REVIEW` transitions, SRS scheduling, review queue/Words to Review, review actions, Topic/Set progress and Continue Learning remained deferred. CEFR Learning Path V1 now implements the bounded review queue/actions and next-learning recommendation; conceptual `NEW` global counting, automatic transitions and Topic/Set progress remain deferred.
- History/activity timeline, accuracy, Quiz/Pronunciation results, XP/gamification, Dashboard implementation, Flashcard redesign and a standalone USER Vocabulary catalog remain outside this extension.

4.6 Dashboard

The Dashboard provides a summary of the user's current learning state and activity.

Feature	Status	SPEC	PLAN	TASK	IMPLEMENT	TEST	REVIEW
User Dashboard	DONE	✓	✓	✓	✓	✓	✓
XP Summary	IN_PROGRESS	✓	✓	✓	✓	IN_PROGRESS	—
Level Summary	IN_PROGRESS	✓	✓	✓	✓	IN_PROGRESS	—
Streak Summary	DONE	✓	✓	✓	✓	PASS	APPROVE
Daily Goal Progress	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Topic Progress Summary	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Words to Review Summary	DONE	✓	✓	✓	✓	PASS	APPROVE
Continue Learning Summary	DONE	✓	✓	✓	✓	PASS	APPROVE

Dashboard V1 composes actual current-session data from the completed Authentication context, read-only Learning Progress summary and owner-scoped My Vocabulary Sets list. It adds no Dashboard endpoint, schema or migration.

The Dashboard must not become a separate source of truth for business data.

### Dashboard V1 Closure

- Related SPEC: `docs/specs/DASHBOARD_V1_SPEC.md` — HUMAN APPROVED.
- Related PLAN: `docs/plans/DASHBOARD_V1_PLAN.md` — HUMAN APPROVED.
- Related TASK: `docs/tasks/DASHBOARD_V1_TASK.md` — HUMAN APPROVED.
- TASK-073 through TASK-079 are complete and HUMAN approved. TASK-079 formal TEST is `PASS` for AC-01 through AC-15 and formal REVIEW is `APPROVE`, with no findings or blockers.
- USER V1 scope is limited to a personalized greeting, persisted total-started/`LEARNING`/`LEARNED` snapshot, exact private Set count, at most three Set previews, valid non-empty Set Learn actions and quick navigation to Topics, My Sets and detailed Learning Progress.
- At the Dashboard V1 closure, authenticated ADMIN retained a safe neutral `/dashboard` landing and made no USER-only Progress or My Sets request. The later Admin UI V2 workstream supersedes that historical presentation with a dedicated ADMIN content Dashboard while preserving the zero-USER-endpoint boundary.
- The original Dashboard V1 closure excluded XP/Level, Streak, Words to Review and Continue Learning. The later XP & Level V1 and Streak V1 workstreams are `DONE`, and CEFR Learning Path V1 now implements the bounded Words to Review summary and authoritative next-learning recommendation. Daily Goal, Topic/Set percentages, achievements, activity/history, Quiz/Pronunciation metrics, weekly calendar and charts remain `TODO` or deferred.
- HUMAN final closure is approved; User Dashboard V1 is `DONE`.

### Dashboard V1 Formal Evidence

- Greeting boundary: 1/1 PASS; mocked Dashboard states/accessibility/responsive coverage: 9/9 PASS; scoped Auth routing: 5/5 PASS.
- Guarded Dashboard real-stack: 2/2 PASS, including current-USER isolation, exact persisted summary, bounded owned-Set preview, valid Learn navigation, ADMIN zero-call and read-only snapshot invariance.
- Scoped regressions: Auth real-stack 2/2, Learning Progress 5/5, USER Vocabulary Set 2/2, Learning route 4/4 and App Layout 8/8 PASS.
- ESLint, production build, targeted TEST fixture cleanup, listener cleanup, diff, secret and scope checks PASS.
- No Dashboard endpoint, backend source change, schema, migration, dependency, fake data or deferred Dashboard/gamification capability was added.

4.7 Quiz

The sole active Quiz mode is Multiple Choice (English → Vietnamese). The replacement is currently `IN_PROGRESS` pending safe verification, guarded CI, formal review and HUMAN approval.
Feature	Status	SPEC	PLAN	TASK	IMPLEMENT	TEST	REVIEW
Multiple Choice Quiz	IN_PROGRESS	✅	✅	✅	✅	⏳	⏳
Transient Quiz Result	IN_PROGRESS	✅	✅	✅	✅	⏳	⏳

Accepted feedback identifies the selected and correct opaque choice IDs after Backend grading and uses visible text plus non-color semantics.

Quiz correctness must be determined by the Backend.

Only the approved `MULTIPLE_CHOICE` type should be implemented.

Do not add additional quiz types without explicit scope approval.

Quiz V1 is an authenticated USER-only, Vocabulary-Set-scoped workflow over every ordered Set Item once per run. The active contract is defined by `docs/specs/QUIZ_V1_SPEC.md`, `docs/plans/QUIZ_V1_PLAN.md` and `docs/tasks/QUIZ_V1_TASK.md`.

Current workflow evidence:

- The Multiple Choice Quiz SPEC, PLAN and TASK decomposition are HUMAN APPROVED.
- Backend, Frontend and documentation implementation is complete, including the HUMAN-approved compact single-column answer presentation and restart behavior.
- Formal offline TEST and REVIEW are in progress. Database-backed authorization, Progress, idempotency and concurrency verification remains reserved for guarded CI.
- Quiz runs/results remain transient and add no schema/migration or Quiz Session/Attempt/history persistence.
- At the Quiz V1 milestone, SRS/review queue, XP/Level/Streak/Daily Goal/Achievement, Pronunciation Practice, additional Quiz types and analytics were outside its scope. Later approved XP/Level and Streak workstreams supersede only those corresponding historical status statements.

4.8 Pronunciation

Pronunciation is a learning module and is not considered a quiz type.

Feature	Status	SPEC	PLAN	TASK	IMPLEMENT	TEST	REVIEW
Model Pronunciation Audio	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Pronunciation Practice	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Speech Recognition	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Pronunciation Evaluation	TODO	⏳	⏳	⏳	⏳	⏳	⏳

Conceptual flow:

Flashcard
   ↓
Model Pronunciation
   ↓
Pronunciation Practice
   ↓
User Speaks
   ↓
Speech Recognition
   ↓
Pronunciation Evaluation
   ↓
Result / Feedback
   ↓
Retry

The exact pronunciation evaluation technology/provider is not fixed yet.

It must be determined during PLAN.

Pronunciation attempt history is not a required v1 feature.

Pronunciation must not automatically become a third quiz type.

4.9 Gamification
Feature	Status	SPEC	PLAN	TASK	IMPLEMENT	TEST	REVIEW
XP	DONE	✓	✓	✓	✓	PASS	APPROVE
Level	DONE	✓	✓	✓	✓	PASS	APPROVE
Streak	DONE	✓	✓	✓	✓	PASS	APPROVE
Daily Goal	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Achievement	TODO	⏳	⏳	⏳	⏳	⏳	⏳
XP Rules

The current universal XP rules are:

New word first time       → +3 XP
Review learned word      → +1 XP
Quiz correct              → +3 XP
Incorrect quiz            → +0 XP
Repeated meaningless use → +0 XP

XP & Level V1 applies only to authenticated `USER` accounts. Initial SRS pass and first-correct Quiz each award +3 once per exact USER/Vocabulary UUID; a genuinely due scheduled SRS cycle awards +1 once per pre-event Progress revision, including due `AGAIN`. Initial `AGAIN`, immediate requeues, incorrect/later-correct Quiz, NORMAL and Speaking award zero. Backend owns eligibility, atomic persistence, replay and Level projections.

Level Rules

Level starts at:

Level 1

Level 2 is reached at:

50 XP

Level is capped at:

Level 15

XP remains unlimited.

At Level 15:

Level 15 — MAX

The Backend threshold table is implemented for Levels 1–15 using `25 × L × (L − 1)`; Level 15 starts at 5,250 XP and remains MAX while XP continues increasing.

### XP & Level V1 — Closure Evidence

- Related SPEC: `docs/specs/XP_LEVEL_V1_SPEC.md` — HUMAN APPROVED.
- Related PLAN: `docs/plans/XP_LEVEL_V1_PLAN.md` — HUMAN APPROVED.
- Related TASK: `docs/tasks/XP_LEVEL_V1_TASK.md` — TASK-231 through TASK-234 completed and HUMAN accepted.
- TASK-231 and Gate 5 are HUMAN accepted. GitHub Actions Run #58 at verified commit `648960a48c779286c0e11e7e2bd8679be55ef43b` passed Trust Gate, Backend DB Integration, Real Stack Browser and Summary.
- TASK-232 documentation synchronization is HUMAN accepted. TASK-233 formal TEST passed all 26/26 acceptance criteria and is HUMAN accepted. TASK-234 formal REVIEW returned `APPROVE` with no BLOCKER or MAJOR findings; its MINOR-01 stale-status finding is resolved by this synchronization.
- HUMAN Gate 6 final TEST/REVIEW acceptance is recorded as `ACCEPTED`. XP & Level V1 is `DONE` according to the project workflow.
- Verified implementation includes USER-only SRS initial/due-review and first-correct Quiz rewards, durable `XP_REWARD` deduplication, no-backfill migration, atomic Progress/reward/XP writes, immediate replay projections, Learning Progress `xp_level`, Dashboard Level/XP/MAX display and transient non-replay feedback.
- NORMAL Flashcard and Speaking remain zero-XP. At this XP & Level V1 closure, Daily Goal bonus, Streak, Achievement, leaderboard and XP-history product surfaces were outside that workstream; the later Streak V1 workstream supersedes only the Streak status.
- Evidence references: TASK-233 report `docs/testing/XP_LEVEL_V1_TEST_REPORT.md`; TASK-234 report `docs/reviews/XP_LEVEL_V1_REVIEW_REPORT.md`; GitHub Actions Run #58 for accepted backend DB/real-stack verification; Run #53 for guarded XP migration verification and cleanup.
- Closure records feature implementation acceptance only. The XP migration has **not** been applied to the Preview TEST DB, and the feature branch has **not** been merged into `dev`; those deployment/integration actions require their own authorization and release controls.

### Streak V1 — Closure Evidence

- Exactly NORMAL, SRS and Multiple Choice Quiz can qualify through a completed Backend-owned snapshot. Speaking, login, browsing, opening, abandoning, failing or expiring a session do not qualify.
- Accepted zero-correct Quiz completion qualifies without invented Quiz XP. Sessionless SRS/Quiz callers retain their approved Progress/XP behavior and never qualify.
- `STREAK_DAY` deduplicates one USER/application day using authoritative Backend completion time in `Asia/Ho_Chi_Minh`; current Streak is projected rather than stored on USER.
- V1 has no Daily Goal integration, Streak Freeze, longest Streak, weekly calendar or history/analytics UI. No historical backfill or scheduled retention cleanup was introduced.

#### Workflow and evidence status

- Gate ST-5: **HUMAN ACCEPTED**.
- Gate ST-6: **HUMAN ACCEPTED** with its recorded Chromium/mocked-API/manual-screen-reader limitations.
- TASK-249: **HUMAN ACCEPTED — PASS** at commit `189e1da9934758a87d88f19faa97db715376c0b1`; GitHub Actions Run `39394932196`, attempt `1`, passed Trust Gate, Foundation PostgreSQL `27/27` and focused real-stack Playwright `1/1`. Eleven migrations applied successfully to each isolated run-owned schema.
- Fixture cleanup was verified at fixture level. Foundation marker-validated cleanup and the integrated marker-validated cleanup routine were verified. Independent post-drop PostgreSQL catalog verification of integrated-schema absence was **NOT PERFORMED** and must not be inferred.
- TASK-250 documentation synchronization: **HUMAN ACCEPTED — Published** at commit `1df63db3674dd1cdf10f06da27f900809c1b7ad5`.
- TASK-251 formal TEST: **HUMAN ACCEPTED — Published** at commit `d1e04081dec59c43d04ec2fa35513275ea322ba3`. TASK-252 formal REVIEW: **HUMAN ACCEPTED — Published** at commit `94d4ee5e01207c820726addb269e132f3e6f056d`. Gate ST-7: **HUMAN ACCEPTED** for the reviewed implementation at `d1e04081dec59c43d04ec2fa35513275ea322ba3`.
- TASK-253 Preview TEST verification: **HUMAN ACCEPTED**. Gate ST-8: **HUMAN ACCEPTED**.
- Preview TEST migration verification passed with all `11/11` Prisma migrations applied. Both approved Streak migrations, four Streak tables and three enum types were verified with no historical Streak backfill. Migration-time aggregate counts were preserved for `USER` (`2 → 2`), `LEARNING_PROGRESS` (`14 → 14`) and `XP_REWARD` (`13 → 13`); this is aggregate preservation evidence, not row-by-row equality.
- Frontend and Backend Vercel Preview deployments completed at accepted revision `91b4ec4d27240e009a8e8f44108037c44d0a1803`. An authenticated Streak read returned HTTP `200`; one HUMAN-authorized 10-question Quiz smoke completed with 8 correct and 2 incorrect answers. API and Dashboard Streak changed from `0` to `1` day on `2026-10-21` in `Asia/Ho_Chi_Minh`.
- Streak V1 is **DONE** for its approved scope after formal TEST, formal REVIEW, Gate ST-7, TASK-253 and Gate ST-8 HUMAN acceptance.
- Preview acceptance does not imply Production deployment or merge into `dev`; neither occurred. The committed feature-specific Frontend API rewrite is temporary and must be restored to the Dev Backend destination, independently reviewed and separately authorized before any future merge into `dev`.
- Accepted limitations remain: no isolated backup restore rehearsal; the `pg_dump` numeric exit code was not captured; the PostgreSQL archive excludes external service resources; HUMAN accepted that recovery risk with archive retention for at least 30 days after Gate ST-8; no manual screen-reader verification; Chromium-focused browser evidence; equivalent viewport checks were not manual 200% browser zoom; independent integrated-schema post-drop catalog absence remains not verified; the XP migration had an LF/CRLF checksum provenance difference with normalized SQL equivalent and no dedicated Prisma LF/CRLF rehearsal; and the single Quiz smoke is not exhaustive activity coverage.

#### Documentation traceability

AC-ST-01–04 / BR-ST-001–008 cover role/mode/exclusion boundaries; AC-ST-05–15 / BR-ST-009–029 cover NORMAL/SRS/Quiz evidence; AC-ST-16–24 / BR-ST-030–038 cover daily projection; AC-ST-25–31 / BR-ST-039–046 cover lifecycle, expiry, concurrency and migration; AC-ST-32 covers the authoritative Streak read; AC-ST-33–34 cover Dashboard accessibility; AC-ST-35–36 preserve exclusions and sessionless compatibility.

Daily Goal Rules

Daily Goal is measured using daily activity XP.

Default goal:

50 XP / day

Allowed goal range:

50–200 XP / day

Daily Goal completion provides a bonus:

20% of Daily Goal
Minimum: 10 XP
Maximum: 40 XP

The bonus is granted at most once per day.

Daily Goal completion is evaluated using activity XP and does not include the bonus XP itself.

Daily progress is stored per calendar day.

The system must not require a global cron job to reset all users' daily XP.

Do not add leaderboard, ranking system, or an XP transaction/history product table. Internal `XP_REWARD` is the approved positive-reward deduplication boundary, not user-facing history.

4.10 Achievements

Achievement functionality is part of the gamification system.

Feature	Status	SPEC	PLAN	TASK	IMPLEMENT	TEST	REVIEW
Achievement Definition	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Achievement Evaluation	TODO	⏳	⏳	⏳	⏳	⏳	⏳
User Achievement Tracking	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Achievement Display	TODO	⏳	⏳	⏳	⏳	⏳	⏳

Achievement rules must be evaluated by the Backend.

4.11 Community

Community v1 currently includes:

Posts
Comments
Vocabulary Set Sharing
Feature	Status	SPEC	PLAN	TASK	IMPLEMENT	TEST	REVIEW
Community Posts	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Community Comments	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Vocabulary Set Sharing	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Shared Vocabulary Set Discovery	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Copy Shared Vocabulary Set	TODO	⏳	⏳	⏳	⏳	⏳	⏳

Vocabulary Set Sharing must respect Vocabulary Set ownership rules.

A user may share only a Vocabulary Set that they own.

Another user may copy the shared Vocabulary Set.

The copied set becomes a new private set owned by the receiving user.

The original Vocabulary Set must not be modified.

The following are not currently included:

Likes
Reactions
Followers
Friends
Direct Messages
Chat
Leaderboard

They require explicit scope approval before implementation.

4.12 Admin
Feature	Status	SPEC	PLAN	TASK	IMPLEMENT	TEST	REVIEW
Admin Dashboard	DONE	✓	✓	✓	✓	✓	✓
User Management	DONE	✓	✓	✓	✓	✓	✓
Vocabulary Management	DONE	✓	✓	✓	✓	✓	✓
Vocabulary Set Management	DONE	✓	✓	✓	✓	✓	✓
Topic Management	DONE	✓	✓	⏳	⏳	⏳	⏳
Community Management	TODO	⏳	⏳	⏳	⏳	⏳	⏳
System Achievement Management	TODO	⏳	⏳	⏳	⏳	⏳	⏳

Admin functionality must remain within the approved project scope.

### Admin UI V2 release checkpoint

- Prompts 251–266 implemented the Bright & Clean Admin shell, real-data Dashboard, Topic/Vocabulary/System Set management, routed System Set Detail, shared dialogs/toasts and the read-only Admin User backend. Prompt 267 User Management was HUMAN accepted.
- Prompt 268 pagination/streak audit is complete. Prompt 269 pagination and Vocabulary table refinement was HUMAN accepted with Topic deterministic ordering intentionally deferred. Prompt 270 Set Detail pagination was HUMAN accepted. Prompt 271 Admin User Current Streak was HUMAN accepted.
- Historical verification reported for Prompts 269–271: automated runs `100/100 PASS`, HUMAN localhost checks `27/27 PASS`, real-data multi-page and cross-page reorder `PASS`, and Admin/Dashboard Current Streak consistency `PASS`. These are retained historical reports, not newly executed verification in Prompt 273.
- Prompt 272 final integration audit completed with `REMEDIATION_REQUIRED` solely for active documentation drift, and Prompt 273 reconciled that documentation. Prompt 274 Final Integration Verification was historically `PARTIAL` because P272-03 delete-dialog trigger-focus restoration still failed on Topics and Vocabulary.
- Prompt 274-R completed the bounded focus-restoration remediation and was HUMAN accepted. P272-03 is `RESOLVED`: Cancel and Escape restore focus to the exact delete trigger for Topics, Vocabulary and System Sets, and all six dismissal flows pass without a delete mutation.
- Final Integration Verification is `CLOSED`. Final reported verification is Backend DB-free `44/44 PASS`, Frontend unit `43/43 PASS`, mocked Chromium `129/129 PASS`, total `216/216 PASS`; Frontend ESLint, production build, strict UTF-8 validation and `git diff --check` also pass.
- Prompt 278-R2 completed the remaining Admin UI V2 real-stack remediation. Focused real-stack verification is `8/8 PASS`.
- Admin UI V2 implementation is complete, tested, reviewed and HUMAN accepted. The accumulated changes were committed and merged into `dev` through PR #37. CI run `45450962963` and Guarded Integration run `45450956588` both passed against dev commit `0a6c4824cf6646cba84360d68f94049698ab25fb`.
- Main release and production deployment remain pending. The `DONE` feature statuses record development-cycle acceptance and do not claim a production release.
- Accepted deferred items remain open: Topic deterministic ordering; Streak history query volume; the unrelated USER `/review` same-route PUSH/hash scroll regression with unconfirmed causality; obsolete `AdminPlannedNavigationItem`; and large real-database performance (`NOT TESTED`). Earlier local DB-backed/real-stack verification limitations are preserved as historical context; the later guarded CI and focused real-stack results above provide the current release evidence without establishing large-production-dataset performance.

Admin APIs must be protected by authentication and role-based authorization.

4.13 AI-Assisted Features

AI functionality is optional.

Feature	Status	SPEC	PLAN	TASK	IMPLEMENT	TEST	REVIEW
AI-Assisted Vocabulary Explanation	TODO	⏳	⏳	⏳	⏳	⏳	⏳
AI-Assisted Learning Support	TODO	⏳	⏳	⏳	⏳	⏳	⏳

AI features must not become mandatory project dependencies without explicit approval.

If AI is not required by the final approved scope, these features may remain TODO.

4.14 Frontend Application Foundation

Feature	Status	SPEC	PLAN	TASK	IMPLEMENT	TEST	REVIEW
Authenticated App Layout Foundation	DONE	✓	✓	✓	✓	✓	✓

The approved App Layout foundation extends the existing Authentication `AuthenticatedShell` with a shared authenticated Header, primary Sidebar/navigation, route-rendered Main Content and minimal Footer.

This foundation is separate from User Dashboard business content, Topic and the public Landing Page. It is complete through TASK-018 closure.

Related SPEC: `docs/specs/AUTHENTICATED_APP_LAYOUT_FOUNDATION_SPEC.md`

## Authenticated App Layout Foundation

Status: DONE

### Related Documentation

- SPEC: `docs/specs/AUTHENTICATED_APP_LAYOUT_FOUNDATION_SPEC.md`
- PLAN: `docs/plans/AUTHENTICATED_APP_LAYOUT_FOUNDATION_PLAN.md`
- TASK: `docs/tasks/AUTHENTICATED_APP_LAYOUT_FOUNDATION_TASK.md`

### Workflow Status

- TASK-016: COMPLETE — shared responsive authenticated shell implemented.
- TASK-017: PASS — focused App Layout browser coverage, full frontend Authentication regression, lint and production build passed.
- TASK-018: COMPLETE — final review approved; AC-01 through AC-17 passed with no findings or blockers.

### Frontend

- `frontend/src/auth/ui/authenticated-shell.jsx`
- `frontend/src/index.css`
- `frontend/e2e/auth/app-layout.spec.js`

### Scope

- No backend, API, database, route, dependency or Authentication architecture change.
- User Dashboard remains a separate completed feature; the App Layout contract itself is unchanged.

## USER UI Polish Corrective Workstream

Status: DONE

### Workflow Status

- HUMAN-approved SPEC, PLAN and TASK are complete through TASK-182.
- Formal TEST: PASS. Formal REVIEW: APPROVE. HUMAN closure approval: APPROVED on 2026-10-09.
- TASK-183 is authorized only for the final commit, push and fast-forward-only `dev` integration recorded in the closure report.

### Verified Boundary

- Quiz uses one route-scoped outer vertical scroll owner while preserving backend-authoritative behavior. The former two-mode statement is historical; the active mode is `MULTIPLE_CHOICE`.
- Register error states remain content-safe; field errors stay inline and global failures use one responsive, non-focus-stealing Auth notification with keyboard-accessible dismissal and no hidden tab stop.
- Exactly the five approved USER-facing native selects share the presentation-only native-select primitive; ADMIN controls and native semantics remain unchanged.
- No backend, API, schema, migration, route, role, dependency, Storage or database behavior changed.

### Verification

- Frontend unit suite: 99/99 PASS; authoritative serial mocked browser matrix: 118/118 PASS.
- Corrective AuthNotification keyboard regressions: 2/2 PASS; focused Auth forms: 8/8 PASS.
- Production build, frontend ESLint, `git diff --check`, scope, secret and transient-artifact checks: PASS.

### Deferred / Non-blocking

- This completed workstream did not include notification-system replacement; the separately scoped UI Consistency V1 workstream below now owns React-Toastify integration.

## UI Consistency V1

Status: IN_PROGRESS

- HUMAN approved shared React-Toastify notifications, Public-consistent client-side pagination for Personal Set Detail, the compact two-column Personal mobile learning-card layout, and the teal Speaking-card accent.
- SPEC: `docs/specs/UI_CONSISTENCY_V1_SPEC.md`
- PLAN: `docs/plans/UI_CONSISTENCY_V1_PLAN.md`
- TASK: `docs/tasks/UI_CONSISTENCY_V1_TASK.md`
- No backend, API, schema, migration or database change is included.
- Status remains `IN_PROGRESS` until formal verification, HUMAN visual approval and guarded CI are complete.

4.15 Engineering Foundation

| Feature | Status | SPEC | PLAN | TASK | IMPLEMENT | TEST | REVIEW |
|---|---|---|---|---|---|---|---|
| CI Foundation | DONE | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## CI Foundation

Status: DONE

### Related Documentation

- SPEC: `docs/specs/CI_FOUNDATION_SPEC.md`
- PLAN: `docs/plans/CI_FOUNDATION_PLAN.md`
- TASK: `docs/tasks/CI_FOUNDATION_TASK.md`
- Operations: `docs/CI.md`

### Current Boundary

- TASK-055 through TASK-063 are complete with formal TEST `PASS` and formal REVIEW `APPROVE`.
- Secret-free and guarded GitHub Actions checks have authoritative same-repository PR evidence.
- The HUMAN-confirmed CI-exclusive PostgreSQL database and repository secret are configured without recording their values.
- HUMAN final closure approval is recorded and CI Foundation is `DONE`.
- CD, deployment, Main/Preview/Production migrations, Docker, coverage thresholds and unrelated automation remain deferred.

4.16 Performance

| Feature | Status | SPEC | PLAN | TASK | IMPLEMENT | TEST | REVIEW |
|---|---|---|---|---|---|---|---|
| App Loading & Runtime Baseline V1 | DONE | ✅ HUMAN APPROVED | ✅ HUMAN APPROVED | ✅ HUMAN APPROVED | COMPLETE | PASS | APPROVE |

## Performance V1 — App Loading & Runtime Baseline

Status: DONE — IMPLEMENTATION, TEST, AND FORMAL REVIEW COMPLETE; READY FOR HUMAN CLOSURE/COMMIT APPROVAL

### Scope Boundary

- Performance V1 is an audit-first, targeted-optimization workflow over representative existing ELVocab flows.
- A reproducible BEFORE baseline and HUMAN checkpoint are required before selecting or implementing optimizations.
- The existing production bundle-size advisory and remote TEST DB/Supabase latency observations are investigation signals, not proof of an application defect.
- No schema/index, API behavior, dependency, cache, broad refactor, product redesign, or deferred feature is authorized at this stage.
- TASK-109 through TASK-113 implemented a test/dev-only measurement harness on dedicated ports `4186`/`5012`. Production application behavior and dependencies are unchanged.
- Harness smoke verification passed against the guarded `.env.test` path with 7 migrations current, read-only query observation, scrubbed ignored artifacts, and unchanged unrelated TEST USER/session counts. These smoke values are not a Performance V1 baseline.
- HUMAN approved the TASK-109–113 harness checkpoint and authorized TASK-114–120.
- The earlier preflight blocker was diagnosed as an unsafe direct Prisma CLI env-loading path. HUMAN accepted the diagnosis; the authoritative run used only guarded TEST configuration.
- TASK-114–120 passed on 2026-10-06: 7/7 serial scenarios, one excluded warm-up and five complete measured samples per condition, with unrelated TEST users/sessions preserved at `5→5` and `8→8`.
- The authoritative measurements and ranked proposals are recorded in `docs/performance/PERFORMANCE_V1_BASELINE.md`. No optimization candidate is authorized until HUMAN baseline review selects an exact scope and target.
- HUMAN approved the baseline and selected candidates 1–3. TASK-121 materially reduced Dashboard Progress query work and readiness without changing its contract; focused backend/browser verification passed.
- TASK-122 uses the HUMAN-approved Prisma 6.19.3 PostgreSQL relation-join capability only on the Learning Set/SRS read. Six ordered relation queries became one joined query per read; BF-05 first-card/full-sequence medians improved from `2,998/8,505 ms` to `1,987/5,504 ms`, with required Learning/SRS regressions green.
- TASK-123 conservatively consolidated authenticated identity validation from two sequential remote reads to one joined session/user query. TASK-125 restored the original post-read expiry boundary while keeping the one-query result. `/api/auth/me` remained one query; Auth unit, real-stack, and focused BF-02 checks passed without cookie/session/API changes.
- HUMAN approved retaining the broader Prisma 6.19.3 generated relation-join behavior. The affected nested relation paths passed proportional real-stack ownership, ordering, visibility, mutation, SRS/NORMAL, Quiz, and Auth regression; no query required containment.
- TASK-124 completed a fresh authoritative AFTER run after that approval. Dashboard, authenticated restore, Owned Set Detail, BF-05, and BF-06 retained material median improvements despite documented remote TEST variance. Full evidence is in `docs/performance/PERFORMANCE_V1_AFTER.md`.
- TASK-125 formal review is APPROVE. The final focused Auth suite passed `16/16`, real-stack Auth `2/2`, and BF-02 retained one warm-up plus five measured samples per condition with cleanup preserving unrelated TEST users/sessions `5→5` / `8→8`.

### Related Documentation

- SPEC: `docs/specs/PERFORMANCE_V1_SPEC.md` — HUMAN APPROVED on 2026-10-05.
- PLAN: `docs/plans/PERFORMANCE_V1_PLAN.md` — HUMAN APPROVED on 2026-10-05.
- BASELINE: `docs/performance/PERFORMANCE_V1_BASELINE.md` — HUMAN APPROVED; candidates 1–3 selected, bundle work deferred.
- AFTER: `docs/performance/PERFORMANCE_V1_AFTER.md` — authoritative TASK-124 comparison accepted; TASK-125 closure verification recorded.
- TASK: `docs/tasks/PERFORMANCE_V1_TASK.md` — TASK-109–TASK-125 complete; formal TEST PASS and REVIEW APPROVE.

5. Feature Detail Records

When a feature reaches IN_PROGRESS, IMPLEMENTED, TESTED, or DONE, additional information may be recorded below.

Use this structure:

## <Feature Name>

Status: <STATUS>

### Description

<Short description>

### Related Documentation

- SPEC: <reference>
- PLAN: <reference>
- TASK: <reference>

### Backend

- <related files/modules>

### Frontend

- <related files/components>

### API

- <related endpoints>

### Database

- <related tables/models>

### Tests

- <related test files>

### Review

- Verdict: <APPROVE / CHANGES_REQUIRED / BLOCKED>

Only add implementation details that are actually known.

Do not invent file paths, endpoints, tables, or test files.

6. Updating Feature Status

The status should be updated as the feature progresses.

Recommended progression:

TODO
  ↓
PLANNED
  ↓
IN_PROGRESS
  ↓
IMPLEMENTED
  ↓
TESTED
  ↓
DONE

If a problem prevents progress:

IN_PROGRESS
    ↓
BLOCKED

After the problem is resolved:

BLOCKED
    ↓
IN_PROGRESS
7. Stage Completion Rules
After SPEC

When the SPEC is approved:

TODO → PLANNED
After PLAN

The feature may remain:

PLANNED

until implementation begins.

During IMPLEMENT

When implementation begins:

PLANNED → IN_PROGRESS
After IMPLEMENT

When the implementation described by the approved TASK is completed:

IN_PROGRESS → IMPLEMENTED

This does not mean the feature is complete.

After TEST

When relevant tests and verification pass:

IMPLEMENTED → TESTED

If tests fail:

IMPLEMENTED → IN_PROGRESS

when implementation changes are required.

After REVIEW

If review returns:

APPROVE

then:

TESTED → DONE

If review returns:

CHANGES_REQUIRED

then the feature returns to the appropriate development stage.

If review returns:

BLOCKED

the feature becomes:

BLOCKED
8. Status Update Rules

AI Agent may update this file when the status genuinely changes as a result of the current workflow.

However:

Do not mark a feature complete prematurely.
Do not mark untested code as TESTED.
Do not mark unreviewed code as DONE.
Do not remove historical status information unnecessarily.
Do not change unrelated feature statuses.
Do not mark features as completed based only on assumptions.
Do not create fake implementation references.

When uncertain, leave the status unchanged and report the uncertainty.

9. Existing Feature Check

Before implementing a requested feature, AI Agent should check this document.

If the requested feature is:

DONE

AI Agent should:

Identify the existing implementation.
Inspect the actual code.
Determine whether the request is:
a bug fix
an enhancement
a modification
a new related feature
Reuse the existing implementation where appropriate.

Do not rebuild an existing completed feature without a clear reason.

10. Related Feature Check

A new feature may depend on an existing feature.

Example:

Existing:

Vocabulary Set

Status: DONE

New:

Community Vocabulary Set Sharing

Status: TODO

The new feature should reuse the existing Vocabulary Set implementation where appropriate.

Do not duplicate:

models
services
controllers
components
API endpoints
business logic

when an existing implementation already provides the required behavior.

11. Conflict Handling

If this document says:

DONE

but the implementation appears incomplete:

FEATURE_STATUS
      ↓
Conflict detected
      ↓
Inspect actual implementation
      ↓
Report conflict
      ↓
Correct status when verified

Do not silently assume that the status is correct.

Likewise, do not downgrade a feature based only on a guess.

12. Scope Changes

If a requested feature does not exist in this document:

Do not automatically add it as an approved feature.

Instead:

Requested Feature
        ↓
Check PROJECT_OVERVIEW.md
        ↓
Within approved scope?
        ↓
YES → Add / update status
NO  → Treat as scope change

A scope change requires the normal approval process defined in AGENTS.md.

13. Current Project State

At the beginning of the project implementation phase, all features are intentionally marked:

TODO

This is expected.

As development progresses, this document must be updated to reflect the actual project state.

The goal is not to make this document look complete.

The goal is to make it accurate.

14. Final Principle

FEATURE_STATUS.md answers:

"What features of the project have actually been completed?"

It does not answer:

"How should the feature work?"

For feature behavior, consult:

PROJECT_OVERVIEW.md

For architecture, consult:

ARCHITECTURE.md

For database structure, consult:

DATABASE.md

For API contracts, consult:

API_SPEC.md

For UI/UX behavior and user flows, consult:

UI_UX_SPEC.md

For AI Agent behavior, consult:

AGENTS.md

For implementation workflow:

.agents/skills/

The project should maintain the following relationship:

AGENTS.md
    ↓
Defines how the Agent works

PROJECT_OVERVIEW.md
    ↓
Defines what the product is

ARCHITECTURE.md
    ↓
Defines system structure

DATABASE.md
    ↓
Defines data structure

API_SPEC.md
    ↓
Defines API contracts

UI_UX_SPEC.md
    ↓
Defines UI/UX behavior and user flows

FEATURE_STATUS.md
    ↓
Defines current implementation state

.agents/skills/
    ↓
Defines how each development stage is performed
```

## Prompt 302 local release implementation checkpoint (2026-11-25)

Status: **IN_PROGRESS — local implementation verified, not committed or released**.

- Public data-source attribution route and guest/authenticated discovery links are
  implemented locally.
- A CC BY-SA 4.0 distribution artifact containing exactly 145 Octanove-derived C1
  entries is isolated under `frontend/public/data-sources/`; CEFR-J entries and
  IPA are excluded from that artifact.
- Explore results use deterministic CEFR/name/ID ordering after filters and before
  pagination. Featured selection/order is preserved.
- Shared set flashcards use `Học tiếp` for ordinary learning and retain `Ôn tiếp`
  for review context. Global Review wording was not changed.
- Focused unit tests, mocked browser tests, targeted lint and the frontend
  production build passed locally. Focused UI/UX review is recorded separately in
  the Prompt 302 handoff.

This checkpoint does not mark the release DONE. Human visual approval, commit,
push, CI and deployment have not occurred. CEFR-J permission wording remains a
human/legal decision; full human semantic review and full independent dictionary
verification are still incomplete. Dataset flags remain `seed_ready = false`,
`full_human_semantic_review = false`, `full_dictionary_verification = false`, and
`DRAFT_NOT_FOR_IMPORT`.

## Prompt 302/302-R release implementation and acceptance (2026-11-26)

Status: **IN_PROGRESS — implementation and HUMAN acceptance complete; dev integration and CI pending**.

- Prompt 302 manual functional acceptance passed 4/4: attribution/download,
  Explore CEFR ordering, ordinary SRS `Học tiếp`, and review SRS `Ôn tiếp`.
- Initial HUMAN visual acceptance failed for the public attribution header;
  Prompt 302-R remediation subsequently passed 3/3 HUMAN visual checks.
- Total HUMAN acceptance is 7/7.
- The Landing footer Explore link was removed without removing `/topics` or the
  authenticated Explore navigation.
- The shared guest header now reuses the current Landing ELVocab logo, exposes
  deterministic `Trang chủ` and `Đăng nhập` navigation, and removes the legacy
  purple/indigo presentation and decorative page icon.
- The attribution heading and introduction now use compact spacing and type while
  preserving all licensing text and the existing download artifact.
- Focused unit, mocked browser, targeted lint, production build, UTF-8, diff,
  secret and artifact checksum checks passed locally. Responsive browser evidence
  covers 1440, 768, 390 and 320 CSS pixels.

Historical local verification remains: Prompt 302 focused unit 29/29 and mocked
browser 8/8 PASS; Prompt 302-R focused unit 4/4, mocked browser 8/8 and keyboard
focus rerun 1/1 PASS, with targeted ESLint, production build and Focused UI/UX
Review passing for both stages. These are historical results, not newly executed
Prompt 303 tests.

Prompt 303 committed and pushed the feature, merged PR #39 into `dev`, and
produced dev commit `ed400b29375955d6d823ebb628f2271ef9a52d3d`. CI run
`45741320072` and Guarded Integration run `45741320085` both passed against that
exact commit. The feature Preview failure is HUMAN-reported as a missing
`API_PROXY_TARGET` configuration; HUMAN confirms Dev Preview already has
`API_PROXY_TARGET` configured. Prompt 303-R does not investigate or remediate
that Preview configuration.

Prompt 303-R implements **HD-22**: remove the informational data-sources link
from the authenticated learner sidebar while preserving its divider, logout,
all learning navigation, direct authenticated `/data-sources` access, and both
public footer entry points. Focused Prompt 303-R verification is recorded with
the implementation commit; CI remains pending until the new dev run reports.

Production release and Production seed are not complete. CEFR-J
permission ambiguity, independently unverified ShareAlike completeness, 211
deferred IPA cases and existing dataset-quality flags remain unresolved. The
deferred Flashcard 9/10 issue and Supabase database-security remediation are not
part of this release and remain pending.

## Prompt 309 footer and layout checkpoint (2026-11-26)

Status: **IN_PROGRESS — local implementation and focused verification complete; HUMAN visual approval complete**.

- HD-24 adds shared learner and authentication footers without restoring the
  data-source link to the learner sidebar or changing public routing.
- Normal USER routes receive the learner footer from `AuthenticatedShell`; focus
  learning routes and all ADMIN routes remain footer-free.
- Login/Register receive the auth footer outside their existing card. Existing
  Landing and public discovery footers remain the public attribution surfaces.
- Account Settings is not currently represented by an application route and was
  therefore not invented as part of this layout task.
- Prompt 309 browser coverage passed 13/13. Related shared-layout, auth-responsive
  and data-source regression coverage passed 65/68 initially; three detected
  flex-scroll regressions were corrected and their focused reruns passed 3/3
  (including the final single-case confirmation). Targeted ESLint passed.
- HUMAN visual approval is complete. Prompt 308 speech lifecycle changes are
  preserved independently in the same local working tree.

## Prompt 311 Google Authentication checkpoint (2026-11-26)

Status: **IN_PROGRESS — local implementation and mocked/offline verification only**.

- HD-25–HD-32 approve GIS popup callback, a separate AUTH_IDENTITY model,
  nullable password hashes, deferred linking, environment-separated OAuth clients,
  verified origins, persistent strict single-use nonce protection,
  `google-auth-library`, and pre-Production publishing/privacy review.
- The prepared migration is not executed against TEST or Production. Real database
  concurrency, real Google credentials, popup behavior and environment acceptance
  remain NOT TESTED until separately authorized TEST migration/acceptance.
- Existing password Authentication, opaque AUTH_SESSION cookies, USER IDs, roles
  and learning relationships remain the compatibility boundary. Google never
  creates or links ADMIN accounts and matching email alone does not link users.
- Google Login must not be marked DONE before guarded TEST migration, real Google
  acceptance, review approval and the required Production Cloud configuration.
- Local evidence: Prisma schema validation PASS; Google/backend Authentication
  targeted regression 30/30 PASS; final Google-only backend rerun 7/7 PASS;
  frontend Authentication unit tests 22/22 PASS; mocked Google Chromium 11/11
  PASS; password/layout browser regression 20/20 PASS; targeted ESLint PASS.
  Prisma Client generation reached the engine replacement step but remained
  blocked locally by a Windows `EPERM` lock on the existing query-engine DLL;
  deployment/database behavior is not inferred from mocked evidence.

## Prompt 311-R Prisma generation and dependency-security checkpoint (2026-11-26)

Status: **IN_PROGRESS — offline generation verified; TEST and security remediation pending**.

- Prisma Client 6.19.3 generation completed offline with the repository's cached
  schema/query engines after the frontend/backend processes were stopped. The
  generated client contains `AUTH_IDENTITY`, `GOOGLE_AUTH_CHALLENGE`, the
  `AUTH_PROVIDER.GOOGLE` enum and nullable `USER.password_hash`; client
  initialization and disposal passed without a database connection.
- The focused Google Authentication backend suite passed 7/7. No database,
  migration, real Google credential, browser, CI or deployment operation was
  performed in this checkpoint. Guarded TEST migration and real Google
  Authentication acceptance therefore remain pending.
- Identically executed `npm audit --omit=dev` checks against baseline HEAD and
  the current lockfile both reported 11 findings: 1 critical, 7 high and 3
  moderate. The added `google-auth-library` 11.3.4 dependency tree introduced
  no reported advisory and did not change the baseline counts or severities.
- Baseline production-installed findings still require remediation assessment
  before release. They include critical `proxy-addr` through Express, high
  `body-parser` through Express, high direct `multer`, and high Prisma/config
  findings; other reported paths include `qs`, `nodemon`/`minimatch`/
  `brace-expansion`, `deepmerge-ts` and `effect`. Static inspection found that
  Google login protection resolves trusted addresses without Express `req.ip`,
  so exploitation of the `proxy-addr` advisory by this flow is not confirmed;
  denial-of-service exposure in production request-processing dependencies must
  nevertheless be resolved or explicitly risk-accepted before release.
- Google Login remains `IN_PROGRESS`. Production release is blocked on a bounded
  dependency-remediation/compatibility pass in addition to the existing TEST
  migration, real-provider acceptance and Production configuration gates.

## Prompt 312 guarded TEST migration checkpoint (2026-11-26)

Status: **BLOCKED — unexpected TEST schema drift detected before backup or apply**.

- The configured connection was fail-closed against the tenant-qualified TEST
  project reference `afyqslnhjiykkjogaqpy`; the Production reference was absent.
  A live bounded read-only transaction confirmed database `postgres`, an active
  server connection and `transaction_read_only=on` without exposing credentials.
- Migration history contains 15 completed migrations, no failed or rolled-back
  records, and only `20261126010000_add_google_authentication` is pending. The
  13 historical raw-checksum differences are CRLF checkout differences: each
  matches its recorded database checksum after LF normalization; the other two
  historical migrations match their raw checksums.
- The approved Google migration SQL is additive except for making
  `USER.password_hash` nullable. It creates `AUTH_PROVIDER`, `AUTH_IDENTITY`,
  `GOOGLE_AUTH_CHALLENGE`, their approved keys/indexes and the cascading USER
  foreign key; it contains no data rewrite, reset, seed or unrelated DDL.
- A read-only Prisma live-schema diff detected unexpected changes outside that
  artifact: default-expression changes on `CEFR_LEARNING_PASS.created_at`,
  `CEFR_LEARNING_PATH_STATE.created_at`, `LEARNING_SESSION.created_at` and
  `STREAK_DAY.created_at`, plus a rename of the
  `LEARNING_SESSION_SRS_RECEIPT_session_item_id_accepted_revision_` index.
  Prompt 312 therefore stopped before backup, baseline capture, migration apply,
  write fixtures or integration tests. No TEST data or schema was changed.
- Google Login remains `IN_PROGRESS`. The drift must be reconciled through a
  separately reviewed decision before guarded TEST migration resumes. Real
  PostgreSQL constraints/concurrency, real Google acceptance, dependency
  remediation, CI, Preview and Production release remain pending.

## Prompt 312-R schema-drift and migration-safety audit (2026-11-26)

Status: **IN_PROGRESS — five diff items classified equivalent; transaction wrapper decision pending**.

- The five Prompt 312 diff items were reconstructed from the 15 applied
  migration artifacts, Git history, the current Prisma schema and a bounded
  read-only TEST catalog transaction. No shadow database, DDL, DML or migration
  was used. The scoped five-item baseline is complete; a repository-wide schema
  reconstruction was intentionally not performed.
- `CEFR_LEARNING_PASS.created_at`, `CEFR_LEARNING_PATH_STATE.created_at`,
  `LEARNING_SESSION.created_at` and `STREAK_DAY.created_at` are all non-null
  `timestamp(3) without time zone` columns whose live default is
  `(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text)`. Their original migrations and
  Prisma `dbgenerated` definitions specify the same expression without the
  parser-added `::text` cast. All four are classified **SEMANTICALLY EQUIVALENT**;
  no CEFR, session or streak runtime behavior changes.
- The live SRS receipt index is a valid/ready, non-unique btree over
  `(session_item_id, accepted_revision)` with no predicate or expression and
  `uuid_ops,int4_ops`. Its migration-requested 66-character name was truncated
  by PostgreSQL to the 63-character live name; Prisma proposes another
  63-character name ending in `_idx`. This is classified **SEMANTICALLY
  EQUIVALENT** and has no query or receipt-integrity impact.
- The exact Prisma diff would re-set the four already-equivalent defaults and
  rename only that index. The recommended minimum is a documented exception
  limited to these five known items; do not mutate TEST or change the Prisma
  schema solely to make this representation-level diff empty.
- Prisma Migrate 6 does not wrap PostgreSQL migrations by default. Every SQL
  statement in the pending Google migration is transaction-compatible, while
  `ALTER USER.password_hash DROP NOT NULL` takes the normal strong ALTER TABLE
  lock. The recommended pending-file change is to add `BEGIN;` before its first
  statement and `COMMIT;` after the foreign key, matching the project's atomic
  migration convention. This does not change the intended end schema, but an
  actual rollback rehearsal remains NOT TESTED and separately authorized work.
- Google Login remains `IN_PROGRESS`. HUMAN approval is required for the exact
  five-item exception and transaction-wrapper edit before a guarded backup,
  baseline capture and TEST migration resume. The Prompt 311-R Production
  dependency-security blocker remains unchanged.

## Prompt 312-R2 atomic migration checkpoint (2026-11-26)

Status: **BLOCKED — disposable rehearsal harness failed before migration execution**.

- HD-33 approved the exact five-item equivalent-drift exception without changing
  TEST, Prisma schema or applied history. HD-34 was implemented by adding only
  `BEGIN;` before and `COMMIT;` after the unchanged pending Google migration DDL.
- A local PostgreSQL 17.6 disposable cluster was available without installation
  and was verified isolated from TEST/Production. The first supervised startup
  exposed a Windows `pg_ctl` output-pipe hang; that exact cluster was identified,
  stopped gracefully and removed. A corrected startup completed, but the harness
  then lost the quoted `"USER"` identifier while passing its minimal baseline to
  `psql`, so baseline creation failed before the wrapped migration ran.
- Both disposable cluster directories were removed after process/path validation;
  no rehearsal database, PostgreSQL process or injected artifact remains. The
  wrapped migration's success and rollback behavior therefore remain NOT TESTED.
- Prompt 312-R2 stopped at mandatory HD-35. No TEST connection, backup, baseline,
  migration, fixture or integration test occurred, and TEST schema/data remain
  unchanged. A separately authorized harness-invocation remediation and complete
  rehearsal are required before guarded TEST migration can resume.
- Google Login remains `IN_PROGRESS`; real Google acceptance and the Prompt 311-R
  Production dependency-security remediation remain pending.

## Prompt 312-R3 guarded migration resume checkpoint (2026-11-26)

Status: **BLOCKED — HD-35 passed; TEST backup failed before migration**.

- The wrapped migration checksum remained
  `F1A868F288C8FCF9C6B9F67B70BD39A7C0B5296307C7B2EC3DB3029D71500004`.
  A quoting-safe harness used UTF-8 temporary SQL files and `psql -X -v
  ON_ERROR_STOP=1 -f`; quoted `"USER"` identifiers were preserved.
- HD-35 passed on isolated localhost PostgreSQL 17.6. The exact wrapped migration
  exited 0; nullable password, enum, both tables, nine indexes, cascade/update
  cascade foreign key and the synthetic USER were verified through an independent
  connection. An injected pre-COMMIT division-by-zero exited 3; an independent
  connection verified full DDL rollback, original password NOT NULL and synthetic
  USER preservation. This verifies PostgreSQL rollback, not Prisma failed-history
  behavior. All temporary SQL, databases, cluster files and processes were removed.
- Guarded TEST preflight still showed 15 completed migrations, no failed/rolled
  back records, absent Google objects and only the Google migration pending. The
  comprehensive diff contained only its DDL plus the five approved HD-33 items;
  no other client session was active at the snapshot.
- The mandatory fresh `pg_dump` did not complete within the bounded execution
  window. Its process was stopped; the resulting 446,464-byte partial archive
  failed `pg_restore --list` and was removed. No valid Prompt 312-R3 backup exists.
- A Windows process-command diagnostic exposed the existing TEST connection URL
  in the HUMAN-visible tool transcript. TEST database credential rotation and
  guarded configuration replacement are required before further database work.
  No credential value is recorded in project documentation.
- Prompt 312-R3 stopped before baseline capture or migration apply. TEST schema
  and data remain unchanged. Google Login stays `IN_PROGRESS`; Production
  dependency-security remediation and real Google acceptance remain pending.

## Prompt 312-R4 secure backup checkpoint (2026-11-26)

Status: **BLOCKED — rotated credential verified; secure backup outcome not provable**.

- HUMAN reported that the TEST password and Vercel Preview `DATABASE_URL` were
  rotated; GitHub Actions uses a separate CI database and Production was
  unchanged. Actual local connectivity with the rotated credential was VERIFIED
  against the tenant-qualified TEST Session Pooler on port 5432 using a bounded
  read-only transaction. Vercel/GitHub/Production configuration statements remain
  HUMAN-REPORTED because those systems were not accessed.
- TEST still contained 15 completed migrations, no failed or rolled-back record,
  absent Google objects and no other active client session at the snapshot. The
  wrapped migration checksum remained
  `F1A868F288C8FCF9C6B9F67B70BD39A7C0B5296307C7B2EC3DB3029D71500004`.
- The secure backup harness used a protected temporary `PGPASSFILE`, separate
  non-secret host/port/user/database arguments, hidden redirected processes and
  a 120-second bound. No password or credential-bearing URL was placed in process
  arguments or diagnostic output. Temporary credential/log artifacts were
  removed in the `finally` path.
- The backup process ended within the bound, but Windows `Start-Process` did not
  yield a numeric exit code to the harness. Fail-closed handling therefore could
  not prove mandatory `pg_dump exit 0`; the unvalidated archive was removed and
  no automatic retry was attempted. No valid Prompt 312-R4 backup exists.
- Prompt 312-R4 stopped before pre-migration baseline or migration apply. TEST
  schema/data remain unchanged. Google Login remains `IN_PROGRESS`; a separately
  authorized backup-supervision correction is required before migration can resume.

## Prompt 312-R5 guarded TEST migration (2026-11-26)

Status: **IN_PROGRESS â€” migration applied and data preserved; real-stack transaction evidence partial**.

- HD-36 was HUMAN-approved as a TEST-only fresh-backup waiver. TEST data-loss risk
  was explicitly accepted because demo data is recoverable. Backup status is
  `WAIVED BY HUMAN`, not PASS; Production backup requirements are unchanged. No
  backup, reset, restore or reseed was executed.
- The guarded target was reverified as TEST project `afyqslnhjiykkjogaqpy` with
  15 completed migrations, no unresolved migration, absent Google objects and a
  controlled activity window. The wrapped artifact retained SHA-256
  `F1A868F288C8FCF9C6B9F67B70BD39A7C0B5296307C7B2EC3DB3029D71500004`.
- A `REPEATABLE READ, READ ONLY` baseline fingerprinted 19 existing public
  application tables and 4,201 rows. `prisma migrate deploy` applied
  `20261126010000_add_google_authentication` exactly once with exit code 0.
  Migration history is completed/not rolled back; the catalog contains both new
  tables, nine indexes and 17 constraints. Every existing table count and content
  fingerprint matched the baseline after migration and after fixture cleanup.
- Real PostgreSQL execution created one Google USER/identity/session from two
  concurrent nonce-consumption attempts, establishing one commit and one reject.
  The execution host did not return the remainder of the runner outcome, so the
  injected authentication-transaction rollback assertion is `INCONCLUSIVE` and
  was not retried. Bounded reconciliation found and removed exactly one session,
  one identity, one USER and two challenges; final residue counts were zero.
- Targeted Google Authentication backend tests passed 7/7. Google Login remains
  `IN_PROGRESS`: real Google acceptance is not tested, and the Production
  dependency-security blocker remains active.

## Prompt 313 transaction rollback and local acceptance checkpoint (2026-11-26)

Status: **LOCAL/TEST GOOGLE AUTHENTICATION ACCEPTANCE PASS â€” Production pending**.

- The tenant-qualified connection was revalidated as TEST project
  `afyqslnhjiykkjogaqpy`; the completed Google migration was verified and was not
  rerun. Production was not accessed.
- A deterministic failure was injected through the actual Google authentication
  service/repository transaction path after the synthetic challenge was consumed
  and the USER, AUTH_IDENTITY and AUTH_SESSION writes had executed. The failure
  was explicitly observed. Independent reads verified no partial USER, identity
  or session and an unconsumed challenge, proving transaction rollback semantics.
  Exact cleanup completed with zero fixture residue and unchanged pre-existing
  authentication-table fingerprints.
- Local Google variables are not yet configured. HUMAN must place the same Local/
  TEST Web Client ID in ignored `frontend/.env.local` as
  `VITE_GOOGLE_CLIENT_ID` and ignored `backend/.env` as `GOOGLE_CLIENT_ID`, plus
  set backend `GOOGLE_AUTH_ALLOWED_ORIGINS=http://localhost:5173`. No client
  secret is required. The local TEST database target is separately verified, but
  the normal backend `npm run dev` loads `.env`, not `.env.test`; guarded startup
  must explicitly map the verified `TEST_DATABASE_URL` to `DATABASE_URL`.
- The official GIS SDK endpoint returned HTTP 200 with JavaScript content during
  readiness verification. Actual frontend/backend runtime and real Google popup,
  first/returning login, session, cancellation, password compatibility and email
  collision acceptance remain `NOT TESTED` pending HUMAN configuration and test.
- Google Login remains `IN_PROGRESS`. Production dependency-security remediation
  remains a release blocker.
- HUMAN completed the real-provider Local/TEST acceptance checklist with `9/9
  PASS`: Login/Register presentation, first Google login, Dashboard navigation,
  returning-account reuse, refresh/protected navigation/logout, popup
  cancellation/form preservation/retry, existing password login, rejection of
  arbitrary password for a Google-only account and email-collision protection.
  These UI/runtime results are HUMAN-REPORTED and are not inferred from mocks.
- The actual local configuration uses ignored `frontend/.env` and `backend/.env`.
  Both Client ID variables are present and match, and the backend allowed origin
  is exactly `http://localhost:5173`; no values are recorded in documentation.
- A bounded `REPEATABLE READ, READ ONLY` TEST verification independently found
  exactly one Google AUTH_IDENTITY linked to exactly one active `USER` account,
  role `USER`, nullable `password_hash`, and no orphan identity. There are zero
  current sessions after the HUMAN's final logout, consistent with session
  invalidation. Two password-only accounts remain and zero password-based users
  are linked to Google, supporting collision protection without modifying an
  existing account. Historical creation/deletion of each individual session is
  not retained by the schema, so that detailed sequence remains HUMAN-REPORTED.
- The HUMAN-created Google TEST account was preserved. Preview acceptance,
  Production OAuth configuration, guarded Production migration and the active
  Production dependency-security remediation remain required. Google Login is
  not marked Production-ready or globally `DONE`.

## Prompt 314/314-R dependency security checkpoint (2026-11-26)

Verdict: **PARTIAL REMEDIATION — HUMAN DECISION REQUIRED**.
HD-37 through HD-40 are HUMAN APPROVED. Prompt 313 retains
**LOCAL/TEST GOOGLE AUTHENTICATION ACCEPTANCE PASS** (HUMAN 9/9).

- Registry-backed npm audits used `--offline=false`. The initial offline
  zero-count reports were invalid as security evidence. Backend full audit
  moved from 1 critical, 7 high, 3 moderate to 0 critical, 4 high, 2 moderate.
  Backend `--omit=dev` moved from the same baseline to 0 critical, 4 high,
  0 moderate. Frontend full and `--omit=dev` each moved from 4 high to
  3 high, with zero critical and moderate findings. Low counts were zero
  throughout. Distinct advisories fell from 10 to 3 (backend full),
  10 to 2 (backend omit-dev), and 2 to 1 (both frontend scopes).
  No new advisory IDs appeared.
- Backend direct changes: Express 5.2.1 → 5.3.0 and Multer 2.4.0 → 2.5.0.
  Express resolves proxy-addr 2.0.7 → 2.0.8, body-parser 2.3.0 → 2.4.0,
  and qs 6.16.0 → 6.17.1, clearing GHSA-jqcg-44mw-7w3h,
  GHSA-27r3-jxmh-p828 and GHSA-6pq8-jhm2-2vcw. Multer clears
  GHSA-q7qp-rjg7-q26m. Nodemon 3.1.14 moved to devDependencies because
  only the local watcher script uses it. Its brace-expansion 5.0.9 → 5.1.0
  clears GHSA-q2hr-2g5m-vwhr, GHSA-qhr7-859c-m2p7 and
  GHSA-6j4f-fj2g-mc7p. Google Auth Library stays at 11.3.4.
- Frontend @vercel/config 0.15.0 → 0.15.1 now resolves Zod 4.6.7
  and removes nested Zod 3.25.76, clearing GHSA-mrhx-c7xc-m3w5.
  Both projects installed successfully with lifecycle scripts disabled.
  Lockfile dry-runs and direct installed version checks passed. Generated
  Prisma 6.19.3 model and engine artifacts and offline client initialization
  passed. Frontend Vite, React/Tailwind plugins, Rolldown and Lightning CSS
  loaded successfully.
- Targeted regression passed: backend 47/47, frontend Vercel routing 4/4
  and loopback JSON/multipart checks 5/5. These checks used no live database
  or external storage. Full suites and deployment builds remain untested.

Open findings for HUMAN decision:

- **High, Prisma tooling present in omit-dev:** `@prisma/client@6.19.3`
  optionally peers with installed `prisma@6.19.3`, which pins
  `@prisma/config@6.19.3`. Config pins `deepmerge-ts@7.1.5`
  (GHSA-ggr8-5vv4-36mx, fixed in 8.0.0) and `effect@3.21.0`
  (GHSA-7589-6fvf-x4pw, fixed in 3.22.1). Neither package is directly
  imported by the application's request handlers. Runtime reachability is
  unconfirmed. No compatible Prisma 6 update was found. npm suggests
  Prisma 7.10.1, but its registry metadata still pins affected Effect 3.20.0.
  An audited upstream release or separately approved tooling change is needed.
- **High, Vercel config tooling present in omit-dev:**
  `@vercel/config@0.15.1 → @vercel/routing-utils@6.6.1 →
  path-to-regexp@6.1.0` (GHSA-9wv6-86v2-598j, fixed in 6.3.0).
  The package pins both legacy 6.1.0 and a patched 6.3.0 alias. The
  application uses the config helper for build-time route definitions.
  Deployed request-path reachability is unconfirmed. npm suggests an
  out-of-range rollback to config 0.0.32. A supported upstream release
  or a separately approved routing-tool change is needed.
- **Moderate, local dev tooling only:** `nodemon@3.1.14 →
  minimatch@10.2.6` (GHSA-g3hv-75wg-m249, fixed in 11.0.1).
  Nodemon's range excludes the patched major. npm proposes reverting
  Nodemon to 3.1.11 outside the declared range. Assess that older watcher
  or approve a supported alternative before changing the toolchain.

No open advisory has been accepted as risk. Google Login remains
`IN_PROGRESS`. Production dependency security, Preview acceptance,
Production OAuth configuration and guarded Production migration
remain release gates.

## Prompt 314-R2 residual dependency exposure review (2026-11-26)

**INCONCLUSIVE — RELEASE BLOCKED.** HD-41 preserves Prisma 6.19.3
pending HUMAN review of bounded risk. HD-42 keeps Vercel routing blocked.
HD-43 defers the development-only Nodemon finding. Prompt 313 Local/TEST
Google acceptance remains PASS (HUMAN 9/9).

- **deepmerge-ts 7.1.5, high ([GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)) — NOT REACHABLE within the assessed architecture.**
  The optional Prisma CLI peer of `@prisma/client@6.19.3` is installed
  as `prisma@6.19.3`. Its `@prisma/config@6.19.3` passes `deepmerge`
  to c12's local config loader (`dist/index.js:894`, `:917`).
  The call is part of install/build generation and operator CLI use.
  The advisory requires recursive object graphs at matching merge paths.
  `backend/prisma.config.ts:7` supplies an acyclic config and an
  operator-controlled URL string. The loader disables remote config,
  extension, RC and package.json config sources. The local config is still
  executable code and must remain trusted. HTTP inputs do not feed this
  loader. The application entries instantiate the generated Prisma Client.
- **Effect 3.21.0, high ([GHSA-7589-6fvf-x4pw](https://github.com/advisories/GHSA-7589-6fvf-x4pw)) — NOT REACHABLE within the assessed architecture.**
  The same Prisma CLI/config chain uses Effect's `Schema.decodeUnknownEither`
  to validate config exports (`@prisma/config/dist/index.js:708`, `:746`).
  The inspected config schemas do not use the affected `Schema.TemplateLiteral`
  decoder, which requires an ambiguous multi-string template and a long
  nonmatching input. The decoder receives CLI configuration, with no
  identified HTTP input path. For both Prisma findings, generated
  `client.ts:18` and `internal/class.ts:420` select the Prisma Client
  runtime API. `backend/src/index.js:9` and `src/main.js:6` do not load
  the CLI configuration. Registry metadata lists 6.19.3 as the newest
  Prisma 6. The upstream fixes require deepmerge-ts 8.0.0 and Effect 3.22.1
  or later, outside the exact config pins. Recommend HUMAN consideration
  of time-bounded risk acceptance limited to the reviewed pins and trusted
  config path, with reassessment on any build, runtime or config change.
- **path-to-regexp 6.1.0, high ([GHSA-9wv6-86v2-598j](https://github.com/advisories/GHSA-9wv6-86v2-598j)) — INCONCLUSIVE for hosted request-time exposure.**
  `@vercel/config@0.15.1 → @vercel/routing-utils@6.6.1 → path-to-regexp@6.1.0`.
  `frontend/vercel.mjs:42` validates a build-time destination origin.
  Plain `routes.rewrite` returns rewrite definitions. Routing utils'
  `getTransformedRoutes → convertRewrites → sourceToRegex → pathToRegexp`
  compiles them. `dist/superstatic.js:47` returns the legacy expression
  even though the patched 6.3.0 alias is compared. The two checked-in
  sources each contain a single catch-all and lack the advisory's
  ambiguous two-parameter segment. Public request paths are matched
  against deployed rules. No exploit condition was found in these two
  definitions. Effective hosted route output, platform-added rules and
  matcher behavior were not independently verified. Express uses a
  separate 8.4.2 copy via `router`. The latest compatible Vercel
  packages still pin 6.1.0. Keep HD-42 blocked. Review effective route
  artifacts and project routing settings under separate authorization,
  then evaluate an upstream fix or an approved routing-tool change.
- **Minimatch 10.2.6, moderate ([GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)) — NOT REACHABLE within the assessed architecture.**
  `nodemon@3.1.14 → minimatch@10.2.6` is used by the local backend
  `dev` script. `nodemon/lib/monitor/match.js:194` passes watcher
  rules with no `optimizationLevel` override. Minimatch defaults to 1,
  while this advisory needs an attacker-controlled glob and level 2
  or higher. No startup, deploy or HTTP code supplies watcher rules.
  Nodemon latest still uses `^10.2.1` and the fix starts at 11.0.1.
  HD-43's development-only deferral condition is met.

Static source and installed-package inspection only. Hosted artifacts
and exploit behavior were outside scope. No Prisma or Vercel risk was
accepted. Google Login stays `IN_PROGRESS` for Production, with
dependency security, Preview acceptance, Production OAuth configuration
and the guarded Production migration still pending.

## Prompt 314-R3 Vercel effective routing checkpoint (2026-11-26)

**INCONCLUSIVE — RELEASE BLOCKED.** HD-44 approves time-bounded acceptance
of GHSA-ggr8-5vv4-36mx and GHSA-7589-6fvf-x4pw for the current graduation
release under the Prisma 6.19.3 pins and trusted config/runtime boundary
verified in 314-R2. Reassess after this release or on a dependency, build,
runtime or config trust-boundary change, whichever comes first. HD-43
still defers Nodemon. HD-45 authorizes read-only Vercel inspection and
leaves Vercel risk acceptance pending.

- Control-plane GETs using the existing Vercel CLI session returned HTTP
  403 for team discovery, user identity and project listing. The cause
  of the refusal was unverified. Neither project's active deployment
  ID, source SHA, effective route table, project-level routing rules or
  hosted matcher provenance was available. No local
  `.vercel/output/config.json` existed in either project.
- The locally recorded `origin/main` ref
  `cc734cd22498799c8e6d2739b9d45e9e64855114` and the unreleased worktree
  have identical checked-in Vercel configuration. Frontend declares
  `/api/:path*` followed by `/:path*`, with no redirects. Backend
  declares an Express function and no explicit rewrites or redirects.
  The local main lockfile has `@vercel/config@0.15.0`, while the candidate
  has 0.15.1. Both snapshots pin routing-utils 6.6.1 and legacy
  path-to-regexp 6.1.0. The local ref is repository evidence only.
- Read-only local compilation of the candidate's two frontend literals
  through installed `@vercel/routing-utils` produced anchored expressions
  with one path capture each. Additional segments are separated by
  slashes. Neither rule has the ambiguous same-segment parameters covered
  by [GHSA-9wv6-86v2-598j](https://github.com/advisories/GHSA-9wv6-86v2-598j).
  The compiler uses 6.1.0 for its returned regex and compares against a
  6.3.0 alias. No exploit condition was found in the two local definitions.
  Participation of the affected dependency or a vulnerable generated regex
  in hosted request handling remains INCONCLUSIVE.
- Smallest next step is for a project owner with existing read access
  to provide the active Production deployment ID and Git SHA for each
  project, ordered sanitized route sources/regexes from the deployment
  manifests (including framework or platform routes), and published
  Routing Rules and bulk redirects or explicit empty-state evidence.
  Inspect existing artifacts only. If they cannot show which matcher
  serves the effective rules, request read-only confirmation from Vercel.
  Apply that evidence only to the identified deployment and review any
  future candidate artifact separately when available.

The Vercel security gate remains open. Prompt 313 Local/TEST acceptance
remains PASS (HUMAN 9/9). Preview acceptance, Production OAuth
configuration and guarded Production migration remain pending.

## Prompt 315 security closure and final integration (2026-11-26)

**SECURITY REMEDIATION COMPLETED WITH BOUNDED RESIDUAL RISK ACCEPTANCE.**
This supersedes the Prompt 314 Vercel security blocker for the current
graduation release under the conditions below. The Prompt 314-R audit
counts and Prompt 314-R2 exposure classifications remain the evidence
record. The four advisory IDs remain open in audit results.

- HD-37–HD-40 governed compatible updates, authoritative audit evidence,
  focused regression and explicit HUMAN risk decisions. HD-41 preserves
  Prisma 6.19.3. HD-42 held the Vercel gate pending assessment. HD-43
  defers the development-only Minimatch finding (GHSA-g3hv-75wg-m249).
  HD-44 accepts the two Prisma tooling findings (GHSA-ggr8-5vv4-36mx and
  GHSA-7589-6fvf-x4pw) for this release under the reviewed toolchain and
  trust-boundary constraints. HD-45 authorized the read-only inspection
  that could not verify effective hosted matchers.
- **HD-46, HUMAN APPROVED.** Bounded acceptance of Vercel's remaining
  GHSA-9wv6-86v2-598j for this release. On 2026-11-26 the HUMAN verified
  via Vercel Dashboard that frontend `frontend-elvocab` (deployment
  prefix `3q46CM5JX`) and backend `eng-lish-vocabulary` (prefix
  `2pih8PghQ`) were Production Ready / Current, both on `main` at
  commit prefix `cc734cd`. Both showed Routing Rules 0/100, Project Routes,
  Microfrontends, Skew Protection and Rolling Releases not configured,
  and Project Redirects restricted by Hobby. This evidence describes the
  deployed commit. Bulk Redirects, platform-generated routes and internal
  hosted matchers remain unverified. Hosted exposure stays INCONCLUSIVE.
- Preserve the assessed dependency graph and routing configuration.
  Inspect candidate routes in Preview acceptance, including generated
  artifacts where available. Reassess when a compatible fix is available
  or by 2026-12-26 (30 days), whichever comes first. Reopen the security
  blocker if new evidence indicates reachable exposure. Acceptance
  does not change advisory severity or the audit counts. The final
  Prompt 314-R counts remain backend full 4 high / 2 moderate, backend
  omit-dev 4 high, and frontend full and omit-dev 3 high each.

- Login passes GIS `signin_with` and Register passes `signup_with`, both
  with locale `vi`. The shared control still delegates button rendering
  and localized wording to GIS. The Google mock spec uses a dedicated
  loopback Playwright project with a synthetic Client ID. The ordinary
  browser project disables GIS so unrelated auth specs keep their original
  fixture contract, even on machines with a configured local Client ID.
- New verification: 91/91 targeted Node tests for speech coordination,
  learning presentation and auth state/services. Focused Chromium passed
  25/25 (12 GIS mocks and 13 footer cases) after separating the test
  environments. Login and Register were checked at 320, 375, 768, 1024
  and 1440 CSS px for button bounds, page overflow and footer placement.
  Mocked failure, cancellation/retry, form preservation and keyboard
  activation passed. Scoped ESLint and the frontend production build
  passed. The backend production-mode entry imported offline using
  synthetic settings. The generated Prisma client matches 6.19.3,
  exposes both Google models and the nullable password field, and has
  the expected Windows/Linux engine artifacts. The transaction wrapper
  and approved migration checksum matched.
- Reused the guarded TEST migration/data-preservation and rollback
  evidence, Prompt 313 real Google **LOCAL/TEST ACCEPTANCE PASS** (HUMAN
  9/9), and Prompt 314-R backend dependency regression results. No
  database, real Google login or deployed behavior was retested here.
  Real GIS wording with the new options, real cross-browser speech
  behavior and full dev CI remain to be verified separately.

**FINAL INTEGRATION PASS — READY FOR COMMIT/PUSH APPROVAL.** Google
Login remains `IN_PROGRESS` for Production. Preview routing and real
Google acceptance, Production OAuth configuration and the guarded
Production migration remain release gates.

## Prompt 315-R Google button visual acceptance (2026-11-26)

- The shared GIS button uses centered logo alignment on Login and
  Register. The approved text options, Vietnamese locale, dimensions
  and authentication flow remain unchanged.
- Both focused Chromium GIS configuration tests passed. Scoped ESLint,
  strict UTF-8 and diff hygiene passed. The HUMAN confirmed visual
  acceptance for the real Google button on Login and Register. Prompt
  315-R is closed.
- Prompt 313 Local/TEST Google Authentication acceptance remains PASS.
  HD-43, HD-44 and HD-46 continue to apply, including the 2026-12-26
  Vercel reassessment deadline or an earlier compatible fix. Full dev CI,
  Preview routing and real Google acceptance, Production OAuth
  configuration and the guarded Production migration remain release gates.
