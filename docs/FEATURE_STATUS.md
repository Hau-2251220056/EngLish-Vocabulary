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
Flashcard Learning	DONE	✓	✓	✓	✓	✓	✓
Learning Progress	DONE	✓	✓	✓	✓	✓	✓
Learning Progress View V1	DONE	✓	✓	✓	✓	✓	✓
Spaced Repetition	DONE	✓	✓	✓	✓	✓	✓
Words to Review	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Topic Learning Progress	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Continue Learning	TODO	⏳	⏳	⏳	⏳	⏳	⏳

Learning Progress represents the current learning state of a user for individual vocabulary.

Conceptual learning states include:

NEW
↓
LEARNING
↓
LEARNED
↓
NEEDS_REVIEW

Flashcard / Learning with SRS V1 is a USER-only Set learning flow with transient client state and backend-authoritative per-`(user_id, vocabulary_id)` progress. SRS is the default mode; NORMAL preserves read-only all-card traversal. The backend owns the four-rating schedule, and immediate retry of the current event ID is idempotent while stale different events are rejected by revision protection. No persistent Learning Session/history or event ledger is introduced.

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
- Same-tab run state remains Learning-owned and transient; no persistent Learning Session/history or event ledger was introduced.
- The HUMAN-approved Focus Mode Flashcard experience includes deterministic primary-Meaning presentation, accessible interaction, optional stored-audio/native-TTS pronunciation and responsive/reduced-motion behavior.

### Deferred / Non-blocking

- Spaced Repetition was delivered as the separately approved SRS V1 extension described below. Words to Review, Topic Learning Progress and Continue Learning remain `TODO`.
- Quiz, XP/gamification, Dashboard, Pronunciation Practice, Community and AI remain outside this DONE boundary.
- Guarded remote TEST DB latency was separately diagnosed as database/network round-trip dominated. It is a non-blocking performance observation and no optimization was included in this closure.

## SRS V1 Closure

Status: DONE

### Workflow Status

- Approved SPEC, PLAN and TASK are synchronized with the final 1/3/7-day NEW timing revision.
- TASK-090 through TASK-106 and revision tasks TASK-105A through TASK-105D are complete; all mandatory HUMAN checkpoints through TASK-106 were approved.
- Formal TEST: PASS. Formal REVIEW: APPROVE. No blocking findings remain.
- No Prisma schema/migration, package dependency, persistent Learning Session/history or event ledger was added.

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

- Words-to-Review/Dashboard review summaries, Topic progress, Continue Learning, persistent history/session analytics, FSRS/SM-2, gamification and pronunciation expansion remain outside SRS V1.
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
- No schema migration, SRS/review queue, Topic/Set progress, Continue Learning, history, accuracy, Quiz/Pronunciation result, XP/gamification, Dashboard or Flashcard redesign is authorized.

### Formal Evidence

- Guarded backend Learning coverage: 12/12 PASS, including USER-only authorization, current-user isolation, query validation, deterministic pagination/filter ordering, minimal projection, compatible `NEEDS_REVIEW`, consistent reads and repeated-read invariance.
- Focused frontend evidence: Learning service 4/4 PASS; mocked Learning Progress states and accessibility 6/6 PASS; scoped Auth/App Layout responsive regressions 16/16 PASS; ESLint and production build PASS.
- Guarded Learning Progress real-stack: 5/5 PASS. Complete sequential real-stack regression: 33/33 PASS — Auth 2, Learning Progress 5, Learning 4, Topic 9, Vocabulary 5 and Vocabulary Set 8.
- Final mocked Auth/App Layout/Progress browser regression: 32/32 PASS. Controlled TEST fixtures and scoped processes/listeners were cleaned; diff, secret and scope checks passed.

### Deferred / Non-blocking

- Word search and client-selectable sorting remain deferred.
- Conceptual `NEW` global counting, automatic `NEEDS_REVIEW` transitions, SRS scheduling, review queue/Words to Review, review actions, Topic/Set progress and Continue Learning remain deferred.
- History/activity timeline, accuracy, Quiz/Pronunciation results, XP/gamification, Dashboard implementation, Flashcard redesign and a standalone USER Vocabulary catalog remain outside this extension.

4.6 Dashboard

The Dashboard provides a summary of the user's current learning state and activity.

Feature	Status	SPEC	PLAN	TASK	IMPLEMENT	TEST	REVIEW
User Dashboard	DONE	✓	✓	✓	✓	✓	✓
XP Summary	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Level Summary	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Streak Summary	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Daily Goal Progress	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Topic Progress Summary	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Words to Review Summary	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Continue Learning Summary	TODO	⏳	⏳	⏳	⏳	⏳	⏳

Dashboard V1 composes actual current-session data from the completed Authentication context, read-only Learning Progress summary and owner-scoped My Vocabulary Sets list. It adds no Dashboard endpoint, schema or migration.

The Dashboard must not become a separate source of truth for business data.

### Dashboard V1 Closure

- Related SPEC: `docs/specs/DASHBOARD_V1_SPEC.md` — HUMAN APPROVED.
- Related PLAN: `docs/plans/DASHBOARD_V1_PLAN.md` — HUMAN APPROVED.
- Related TASK: `docs/tasks/DASHBOARD_V1_TASK.md` — HUMAN APPROVED.
- TASK-073 through TASK-079 are complete and HUMAN approved. TASK-079 formal TEST is `PASS` for AC-01 through AC-15 and formal REVIEW is `APPROVE`, with no findings or blockers.
- USER V1 scope is limited to a personalized greeting, persisted total-started/`LEARNING`/`LEARNED` snapshot, exact private Set count, at most three Set previews, valid non-empty Set Learn actions and quick navigation to Topics, My Sets and detailed Learning Progress.
- Authenticated ADMIN retains a safe neutral `/dashboard` landing and must not invoke USER-only Progress or My Sets APIs. Admin Dashboard remains `TODO`.
- XP, Level, Streak, Daily Goal, Topic/Set percentages, Words to Review/SRS, Continue Learning/recency, achievements, activity/history, Quiz/Pronunciation metrics and charts remain `TODO` or deferred.
- HUMAN final closure is approved; User Dashboard V1 is `DONE`.

### Dashboard V1 Formal Evidence

- Greeting boundary: 1/1 PASS; mocked Dashboard states/accessibility/responsive coverage: 9/9 PASS; scoped Auth routing: 5/5 PASS.
- Guarded Dashboard real-stack: 2/2 PASS, including current-USER isolation, exact persisted summary, bounded owned-Set preview, valid Learn navigation, ADMIN zero-call and read-only snapshot invariance.
- Scoped regressions: Auth real-stack 2/2, Learning Progress 5/5, USER Vocabulary Set 2/2, Learning route 4/4 and App Layout 8/8 PASS.
- ESLint, production build, targeted TEST fixture cleanup, listener cleanup, diff, secret and scope checks PASS.
- No Dashboard endpoint, backend source change, schema, migration, dependency, fake data or deferred Dashboard/gamification capability was added.

4.7 Quiz

The system currently supports exactly two quiz types:

1. Vietnamese → English
2. Unscramble Word
Feature	Status	SPEC	PLAN	TASK	IMPLEMENT	TEST	REVIEW
Vietnamese → English Quiz	DONE	✅	✅	✅	✅	✅	✅
Unscramble Word Quiz	DONE	✅	✅	✅	✅	✅	✅
Per-Character Feedback	DONE	✅	✅	✅	✅	✅	✅
Transient Quiz Result	DONE	✅	✅	✅	✅	✅	✅

For both active Quiz types, accepted per-character feedback uses visible characters above underlines plus non-color semantics:

Correct position → Green underline + `correct`
Incorrect/missing/extra → Error underline + explicit semantic state

Quiz correctness must be determined by the Backend.

Only the approved quiz types should be implemented.

Do not add additional quiz types without explicit scope approval.

Quiz V1 is an authenticated USER-only, Vocabulary-Set-scoped workflow over every ordered Set Item once per run. The active contract is defined by `docs/specs/QUIZ_V1_SPEC.md`, `docs/plans/QUIZ_V1_PLAN.md` and `docs/tasks/QUIZ_V1_TASK.md`.

Current workflow evidence:

- Original Quiz V1 SPEC, PLAN and TASK decomposition are HUMAN APPROVED; TASK-080 through TASK-085 are HUMAN APPROVED and TASK-086 preserves completed historical `MISSING_LETTER` implementation evidence.
- During TASK-086 visual review, HUMAN requested and approved the active `UNSCRAMBLE_WORD` replacement and shared underline feedback revision.
- TASK-086A, TASK-086B, TASK-087 and TASK-088 are complete and HUMAN APPROVED. TASK-089 formal TEST is `PASS` for AC-01 through AC-16 and formal REVIEW is `APPROVE`, with no findings or blockers.
- TASK-089 is `COMPLETE — HUMAN APPROVED`; HUMAN final closure is authorized and Quiz V1 is `DONE — HUMAN APPROVED`.
- Quiz runs/results remain transient and add no schema/migration or Quiz Session/Attempt/history persistence.
- SRS/review queue, XP/Level/Streak/Daily Goal/Achievement, Pronunciation Practice, additional Quiz types and analytics remain deferred.

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
XP	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Level	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Streak	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Daily Goal	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Achievement	TODO	⏳	⏳	⏳	⏳	⏳	⏳
XP Rules

The current universal XP rules are:

New word first time       → +3 XP
Review learned word      → +1 XP
Quiz correct              → +3 XP
Incorrect quiz            → +0 XP
Repeated meaningless use → +0 XP

XP rules are universal for all users.

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

The exact level threshold table must follow the approved business rules and must not be invented during implementation.

Streak Rules

Streak is based on qualifying learning activity, not login.

Qualifying activities may include:

Vocabulary learning
Flashcard learning
Quiz
Pronunciation practice
Review

Multiple qualifying activities on the same calendar day count as one streak day.

Skipping one or more days resets the streak to 1 when the user returns to a qualifying learning activity.

No Streak Freeze is required in v1.

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

Do not add leaderboard, ranking system, or XP transaction/history tables unless explicitly approved.

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
Admin Dashboard	TODO	⏳	⏳	⏳	⏳	⏳	⏳
User Management	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Vocabulary Management	DONE	✓	✓	✓	✓	✓	✓
Vocabulary Set Management	DONE	✓	✓	✓	✓	✓	✓
Topic Management	DONE	✓	✓	⏳	⏳	⏳	⏳
Community Management	TODO	⏳	⏳	⏳	⏳	⏳	⏳
System Achievement Management	TODO	⏳	⏳	⏳	⏳	⏳	⏳

Admin functionality must remain within the approved project scope.

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

- Quiz uses one route-scoped outer vertical scroll owner while preserving both approved Quiz types and backend-authoritative behavior.
- Register error states remain content-safe; field errors stay inline and global failures use one responsive, non-focus-stealing Auth notification with keyboard-accessible dismissal and no hidden tab stop.
- Exactly the five approved USER-facing native selects share the presentation-only native-select primitive; ADMIN controls and native semantics remain unchanged.
- No backend, API, schema, migration, route, role, dependency, Storage or database behavior changed.

### Verification

- Frontend unit suite: 99/99 PASS; authoritative serial mocked browser matrix: 118/118 PASS.
- Corrective AuthNotification keyboard regressions: 2/2 PASS; focused Auth forms: 8/8 PASS.
- Production build, frontend ESLint, `git diff --check`, scope, secret and transient-artifact checks: PASS.

### Deferred / Non-blocking

- A future separately scoped notification-system refactor may evaluate a shared toast library such as React-Toastify. It is not part of this completed workstream.

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
