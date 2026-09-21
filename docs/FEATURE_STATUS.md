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
Topic Management	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Topic Listing	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Topic-based Vocabulary Set Discovery	TODO	⏳	⏳	⏳	⏳	⏳	⏳

Topic behavior and data rules are defined in the project documentation.

4.3 Vocabulary
Feature	Status	SPEC	PLAN	TASK	IMPLEMENT	TEST	REVIEW
Vocabulary Management	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Vocabulary Multiple Meanings	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Vocabulary Context / Example	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Vocabulary Search	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Vocabulary Pronunciation Information	TODO	⏳	⏳	⏳	⏳	⏳	⏳

Vocabulary may have multiple meanings depending on context.

Vocabulary pronunciation information may include model pronunciation information such as phonetic information and pronunciation audio.

4.4 Vocabulary Sets
Feature	Status	SPEC	PLAN	TASK	IMPLEMENT	TEST	REVIEW
System Vocabulary Set	TODO	⏳	⏳	⏳	⏳	⏳	⏳
User-Created Vocabulary Set	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Vocabulary Set Ownership	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Vocabulary Set Visibility	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Edit Own Vocabulary Set	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Delete Own Vocabulary Set	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Copy Vocabulary Set	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Vocabulary Set Discovery	TODO	⏳	⏳	⏳	⏳	⏳	⏳

System vocabulary sets are created and managed by Admin.

User-created vocabulary sets are private by default.

Users cannot directly change their own vocabulary set to public.

Users can share their own vocabulary sets through Community.

A copied vocabulary set becomes a new private set owned by the user who copied it.

4.5 Learning
Feature	Status	SPEC	PLAN	TASK	IMPLEMENT	TEST	REVIEW
Vocabulary Learning Session	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Flashcard Learning	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Learning Progress	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Spaced Repetition	TODO	⏳	⏳	⏳	⏳	⏳	⏳
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

The exact Spaced Repetition algorithm will be determined during PLAN and must not be invented during implementation.

4.6 Dashboard

The Dashboard provides a summary of the user's current learning state and activity.

Feature	Status	SPEC	PLAN	TASK	IMPLEMENT	TEST	REVIEW
User Dashboard	TODO	⏳	⏳	⏳	⏳	⏳	⏳
XP Summary	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Level Summary	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Streak Summary	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Daily Goal Progress	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Topic Progress Summary	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Words to Review Summary	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Continue Learning Summary	TODO	⏳	⏳	⏳	⏳	⏳	⏳

Dashboard data should be derived from the user's actual learning and gamification state.

The Dashboard must not become a separate source of truth for business data.

4.7 Quiz

The system currently supports exactly two quiz types:

1. Vietnamese → English
2. Missing Letter
Feature	Status	SPEC	PLAN	TASK	IMPLEMENT	TEST	REVIEW
Vietnamese → English Quiz	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Missing Letter Quiz	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Per-Character Feedback	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Quiz Result	TODO	⏳	⏳	⏳	⏳	⏳	⏳

For typing-based quizzes, per-character feedback may indicate:

Correct position → Green
Incorrect position → Red

Quiz correctness must be determined by the Backend.

Only the approved quiz types should be implemented.

Do not add additional quiz types without explicit scope approval.

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
Vocabulary Management	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Vocabulary Set Management	TODO	⏳	⏳	⏳	⏳	⏳	⏳
Topic Management	TODO	⏳	⏳	⏳	⏳	⏳	⏳
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
- User Dashboard remains a separate unfinished feature.

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
