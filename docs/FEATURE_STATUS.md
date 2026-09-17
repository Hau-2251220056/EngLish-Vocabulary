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
User Registration	IN_PROGRESS	✓	✓	✓	IN_PROGRESS	—	—
User Login	IN_PROGRESS	✓	✓	✓	IN_PROGRESS	—	—
User Authentication	IN_PROGRESS	✓	✓	✓	IN_PROGRESS	—	—
User Authorization	IN_PROGRESS	✓	✓	✓	IN_PROGRESS	—	—
User Profile Management	TODO	—	—	—	—	—	—
Daily Goal Settings	TODO	—	—	—	—	—	—
Admin Access	TODO	—	—	—	—	—	—

Stage markers: `✓` = completed at feature level; `IN_PROGRESS` = partial implementation is in progress; `—` = not started or not determinable at feature level.

The system has two authenticated roles:

USER
ADMIN

Guest users are unauthenticated visitors and are not treated as an authenticated role.

## Authentication Backend Foundation and Routes

Status: IN_PROGRESS

### Description

Backend authentication foundation and HTTP route integration have been implemented through TASK-009. The overall Authentication feature remains in progress because frontend authentication flows/state and remaining user-management capabilities are not complete.

### Related Documentation

- SPEC: `docs/specs/AUTHENTICATION_SPEC.md`
- PLAN: `docs/plans/AUTHENTICATION_ROUTES_PLAN.md`
- TASK: `docs/tasks/AUTHENTICATION_ROUTES_TASK.md`

### Backend

- `backend/src/services/authentication-service.js`
- `backend/src/middleware/authentication-middleware.js`
- `backend/src/middleware/role-authorization-middleware.js`
- `backend/src/controllers/auth-controller.js`
- `backend/src/repositories/user-repository.js`
- `backend/src/repositories/auth-session-repository.js`
- `backend/src/utils/password-security.js`
- `backend/src/routes/auth-routes.js`
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

### Review

- TASK-005: approved with no findings.
- TASK-006: approved with no findings.
- TASK-007: approved with no findings.
- TASK-009: approved with no findings.

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
