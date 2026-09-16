# TASK Skill

## Purpose

This Skill defines how to transform an approved technical PLAN into a set of small, concrete, executable implementation tasks.

The goal is to make implementation predictable, traceable, and easy to verify.

**This Skill does not implement code.**

---

# When to Use

Use this Skill when:

- A SPEC has been approved.

- A technical PLAN has been completed and approved by the user.

- The feature requires implementation work.

- The user asks to break an approved PLAN into implementation tasks.

Do not use this Skill when:

- The requirement is still ambiguous.

- The SPEC is incomplete.

- The SPEC has not been approved.

- The PLAN has not been completed.

- The PLAN has not been approved.

- The user is only asking for technical analysis.

If the PLAN is incomplete, not approved, or contains blocking ambiguity, return to the PLAN or SPEC stage before creating tasks.

---

# Core Principles

## 1. Tasks Must Come From the Approved PLAN

Every task must be traceable to an item in the approved PLAN.

The TASK stage must not change the approved business or technical direction.

Do not:

- Introduce unrelated work.

- Add new features.

- Change business rules.

- Change architecture.

- Add new roles.

- Add unnecessary dependencies.

If implementation requires something that is not covered by the PLAN:

1. Identify the missing requirement or technical decision.

2. Determine whether the PLAN or SPEC needs to be updated.

3. Return to the appropriate stage when necessary.

4. Do not silently expand the scope.

---

## 2. PLAN Must Be Approved Before TASK

The TASK stage must only begin when:

```text
SPEC
  ↓
User Approval
  ↓
PLAN
  ↓
User Approval
  ↓
TASK

If the PLAN has not been approved:

Do not generate implementation tasks.
Ask the user to review and approve the PLAN first.
3. Check Feature Status Before Creating Tasks

Before generating tasks, check:

docs/FEATURE_STATUS.md

Determine the current status of the feature:

TODO
IN_PROGRESS
DONE
BLOCKED

Rules:

TODO

Create tasks according to the approved PLAN.

IN_PROGRESS

Inspect the existing implementation and create only the remaining or changed tasks.

Do not recreate completed work.

DONE

Do not generate a full rebuild task list.

If the approved SPEC describes a modification, enhancement, or bug fix, create tasks specifically for that change.

BLOCKED

Identify the blocker first.

Do not create implementation tasks that depend on an unresolved blocker.

If the documented status conflicts with the actual implementation, identify the inconsistency and resolve it before creating tasks.

4. One Task Should Have One Clear Responsibility

A task should represent one meaningful unit of work.

Avoid tasks that are:

Too broad.
Too vague.
Unrelated collections of changes.
Large enough to require multiple independent decisions.

Prefer:

TASK-001: Add VocabularySet database model

TASK-002: Implement VocabularySet repository

TASK-003: Implement createVocabularySet service

TASK-004: Add POST /api/vocabulary-sets

TASK-005: Add CreateVocabularySetPage

over:

TASK-001: Implement the entire Vocabulary Set feature

However, do not create extremely tiny tasks that provide no meaningful unit of work.

Avoid:

TASK-001: Create a file.

TASK-002: Add an import.

TASK-003: Add one function.

unless those actions genuinely need to be separated.

5. Tasks Must Be Executable

Each task should provide enough information for the implementation agent to understand:

What to change.
Where to change it.
Why the change is needed.
What behavior is expected.
What dependencies must already be completed.
How the task can be verified.

The task should contain enough context that the implementation agent does not need to rediscover the entire feature.

However, the task should not repeat the entire SPEC or PLAN unnecessarily.

6. Respect Existing Architecture

Tasks must follow the architecture defined by:

AGENTS.md
docs/ARCHITECTURE.md
The approved PLAN

Do not introduce a different architecture inside an individual task.

For backend work, respect:

Request
  ↓
Route
  ↓
Middleware
  ↓
Controller
  ↓
Service
  ↓
Repository / Data Access
  ↓
Prisma
  ↓
PostgreSQL

For frontend work, respect:

Page
  ↓
Component
  ↓
Hook / State
  ↓
Service
  ↓
Backend API

If the approved PLAN intentionally uses a different structure for a specific reason, follow the approved PLAN.

Do not redesign the architecture during TASK creation.

7. Respect Dependencies

Tasks should be ordered according to their actual dependencies.

A common dependency flow may be:

Database
   ↓
Repository
   ↓
Service
   ↓
Controller
   ↓
Route
   ↓
Frontend API
   ↓
Frontend UI
   ↓
Tests

But this is only an example.

Do not force this order when the feature does not require all of these layers.

For each task, identify its actual prerequisites.

Do not require a task to depend on work that has not been completed unless parallel execution is explicitly safe.

8. Do Not Invent Technical Decisions

Do not make significant technical decisions that were not established by:

The existing project.
AGENTS.md.
Project documentation.
The approved SPEC.
The approved PLAN.

Examples of decisions that should not be invented:

New libraries.
New external services.
New database structures.
New architecture patterns.
New authentication mechanisms.
New roles.
New infrastructure.
New APIs.

If a task cannot be defined without making a significant technical assumption:

Identify the missing decision.
Determine whether it belongs to SPEC or PLAN.
Return to the appropriate stage.

Do not hide significant technical assumptions inside a task.

TASK Workflow

Follow this process:

Approved PLAN
      ↓
Check Feature Status
      ↓
Identify Implementation Areas
      ↓
Inspect Existing Implementation
      ↓
Identify Dependencies
      ↓
Break Work Into Tasks
      ↓
Order Tasks
      ↓
Define Task Details
      ↓
Define Acceptance Criteria
      ↓
Define Verification
      ↓
Check Scope
      ↓
Produce TASK List
      ↓
User Review / Approval
      ↓
IMPLEMENT
Step 1 — Read the Approved PLAN

Review:

AGENTS.md
Approved SPEC
Approved PLAN
docs/FEATURE_STATUS.md
Relevant project documentation
Relevant existing implementation when necessary

Do not reread the entire repository unless required.

The approved PLAN is the primary source for task creation.

If the PLAN and existing implementation appear inconsistent, inspect the relevant implementation and identify the discrepancy.

Do not silently rewrite the PLAN.

Step 2 — Check Feature Status

Check the current feature status before generating tasks.

Determine:

What has already been completed.
What is currently being implemented.
What remains to be implemented.
Whether the feature is blocked.

If the feature is IN_PROGRESS, inspect the source code and tests to avoid creating duplicate tasks.

If the feature is DONE and the approved SPEC represents a change, generate tasks only for the requested change.

Step 3 — Identify Implementation Areas

Determine which implementation areas require tasks.

Possible areas include:

Database.
Prisma schema.
Migration.
Repository.
Service.
Controller.
Route.
Middleware.
Validation.
Authorization.
API.
Frontend service.
Hook/state.
Page.
Component.
Tests.
Documentation.

Only create tasks for areas actually affected by the approved PLAN.

Step 4 — Inspect Existing Implementation

When necessary, inspect the relevant existing source code before creating tasks.

Determine:

Existing files that can be modified.
Existing modules that can be extended.
Existing functions that can be reused.
Existing API endpoints.
Existing components.
Existing database models.
Existing tests.

Do not create duplicate implementations when an existing implementation can be extended.

Do not invent file paths when the actual project structure can be inspected.

If the exact path is not known, describe the module responsibility rather than guessing.

Step 5 — Break the PLAN Into Tasks

Convert each meaningful implementation responsibility into a task.

A task should generally be small enough to:

Understand independently.
Implement independently when dependencies allow.
Test independently.
Review independently.

Good task boundaries usually correspond to a meaningful responsibility such as:

Database change
Repository behavior
Service behavior
API endpoint
Frontend API integration
UI behavior
Test coverage
Documentation update

Do not split tasks merely because multiple files are involved.

One task may modify several closely related files when those changes represent one coherent responsibility.

Step 6 — Define Dependencies

For each task, identify prerequisites.

Example:

TASK-001
Database model

Dependencies:
- None
TASK-002
Repository

Dependencies:
- TASK-001
TASK-003
Service

Dependencies:
- TASK-002
TASK-004
API endpoint

Dependencies:
- TASK-003

If two tasks can safely be performed independently:

TASK-005
TASK-006

Dependencies:
- TASK-004

Do not mark tasks as parallel merely for convenience.

Parallel work must be technically safe and must not create conflicting changes.

Step 7 — Define Task Scope

Every task should explicitly define:

In Scope

What this task must implement.

Out of Scope

What this task must not implement.

This prevents the implementation agent from expanding a task into unrelated work.

Example:

In Scope:

- Create the repository method for retrieving a vocabulary set.
- Return the required vocabulary set data.

Out of Scope:

- Create a new frontend page.
- Add comments.
- Add community sharing.

The Out of Scope section does not need to list every unrelated feature in the project.

Only mention boundaries that are relevant to preventing scope creep.

Step 8 — Define Files and Modules

When the relevant paths are known, specify them.

Example:

Files to modify:

- backend/src/modules/vocabulary/repository.ts
- backend/src/modules/vocabulary/service.ts

Files to create:

- backend/src/modules/vocabulary/vocabulary-set.controller.ts

For each path, briefly describe its purpose.

Do not invent paths.

If the exact path is not yet known, describe the expected module responsibility instead of guessing.

Step 9 — Define Implementation Requirements

For each task, specify the important technical requirements.

Database

Include when applicable:

Model fields.
Relationships.
Constraints.
Migration requirement.
Indexes when justified.
Backend

Include when applicable:

Function/service responsibility.
Validation.
Authorization.
Error handling.
Data access behavior.
API

Include when applicable:

HTTP method.
Endpoint.
Authentication.
Authorization.
Request.
Response.
Error cases.
Frontend

Include when applicable:

Page/component responsibility.
State.
API interaction.
Loading state.
Error state.
Empty state.
Success behavior.

Do not write implementation code inside the task.

Step 10 — Define Acceptance Criteria

Each task must have clear completion criteria.

Acceptance criteria should be:

Observable.
Specific.
Testable.
Consistent with the approved PLAN.

Example:

Acceptance Criteria:

- A vocabulary set can be created with valid data.
- Invalid input is rejected.
- An unauthenticated user cannot create a vocabulary set.
- The repository returns the created record.

Do not add acceptance criteria that introduce new business rules not defined in the approved SPEC or PLAN.

Step 11 — Define Verification

Specify how the implementation agent can verify the task.

Examples:

Verification:

- Run relevant backend tests.
- Run lint.
- Run build.

For database tasks:

Verification:

- Prisma schema generates successfully.
- Migration applies successfully.
- Existing tests remain passing.

For API tasks:

Verification:

- Relevant API tests pass.
- Authentication and authorization behavior is verified.
- Expected success and error responses are verified.

For frontend tasks:

Verification:

- Relevant component tests pass.
- Frontend build succeeds.
- Relevant user flow works.

Do not claim that verification has passed before it is actually executed.

The TASK stage defines verification criteria; the TEST stage performs formal testing.

Step 12 — Identify Parallel Work

When useful, indicate tasks that can safely be worked on in parallel.

Example:

TASK-005
TASK-006

Dependencies:
- TASK-004

Parallel:
- Yes

Parallel work should only be identified when:

Dependencies are satisfied.
Tasks do not require each other's output.
They do not modify the same code in conflicting ways.
The implementation agent can safely execute them independently.

Do not force parallelization.

Step 13 — Check Scope

Before finalizing the TASK list, verify:

Every task belongs to the approved PLAN.
Every PLAN requirement is covered.
No unrelated feature was added.
No unnecessary refactoring was added.
No unnecessary dependency was introduced.
No new role was introduced.
No architecture change was introduced without approval.
Tasks are appropriately sized.
Dependencies are correct.
Parallel work is identified only when safe.
Existing implementation is reused where appropriate.
FEATURE_STATUS.md was considered.
Task ID Convention

Use sequential identifiers:

TASK-001
TASK-002
TASK-003
...

Task IDs must be unique within the current feature.

If the project already has a task-tracking convention, follow that convention instead.

TASK Output Format

Use the following structure:

# TASKS: <Feature Name>

## Overview

<Short description of what these tasks implement.>

## Feature Status

Current Status: <TODO / IN_PROGRESS / DONE / BLOCKED>

<Brief explanation when relevant.>

## Task Dependency Graph

```text
TASK-001
   ↓
TASK-002
   ↓
TASK-003
   ↓
TASK-004
   ├──→ TASK-005
   └──→ TASK-006
          ↓
       TASK-007
TASK-001: <Task Name>
Objective
<What this task accomplishes.>
Dependencies

None

Files / Modules
<path> — <purpose>
In Scope
...
Out of Scope
...
Implementation Requirements
...
Acceptance Criteria
...
Verification
...
TASK-002: <Task Name>
Objective

...

Dependencies
TASK-001
Files / Modules
...
In Scope
...
Out of Scope
...
Implementation Requirements
...
Acceptance Criteria
...
Verification
...

Repeat for all required tasks.

Task Execution Notes
<Optional notes about safe ordering or parallel execution.> ```
Task Quality Checklist

Before finalizing the task list, verify:

Traceability
 Every task maps to the approved PLAN.
 Every PLAN requirement is represented.
 No task introduces an unapproved requirement.
Feature Status
 docs/FEATURE_STATUS.md was checked.
 Existing completed work is not unnecessarily recreated.
 IN_PROGRESS features are planned from their current implementation.
 DONE features are treated as modifications/enhancements when applicable.
Scope
 No unrelated work was added.
 No unnecessary refactoring was added.
 In-scope and out-of-scope boundaries are clear.
Dependencies
 Dependencies are explicit.
 Task order is logical.
 Parallel work is identified only when safe.
Technical Clarity
 Relevant files/modules are identified.
 Implementation requirements are clear.
 Architecture is respected.
 Security and authorization requirements are included when relevant.
 No significant technical decision was invented.
Verification
 Each task has acceptance criteria.
 Each task has a verification method.
 Verification is observable and testable.
What TASK Must Not Do

The TASK stage must not:

Write implementation code.
Modify source files.
Run migrations.
Install dependencies.
Execute implementation commands.
Change the approved SPEC.
Silently change the approved PLAN.
Add unrelated features.
Perform large-scale refactoring.
Introduce new roles without approval.
Introduce new architecture without approval.
Invent significant technical decisions.
Rebuild an already completed feature without an approved change request.

The IMPLEMENT stage handles the actual coding.

Handling Missing Information

If a task cannot be defined without making a significant assumption:

Stop task generation for the affected area.
Identify the missing information.
Determine whether it belongs to SPEC or PLAN.
Return to the appropriate stage.
Request clarification or approval when necessary.

Do not hide significant assumptions inside a task.

Minor implementation details that are already determined by the existing architecture or approved PLAN may be left for the IMPLEMENT stage.

Handling PLAN Changes

If task creation reveals that the approved PLAN is incomplete or incorrect:

Do not silently modify the PLAN.

Instead:

TASK discovery
      ↓
Identify PLAN issue
      ↓
Return to PLAN
      ↓
Update PLAN
      ↓
User Approval
      ↓
Resume TASK

If the PLAN change also affects business requirements, return to SPEC before continuing.

Transition to IMPLEMENT

Once the TASK list is complete:

Present the complete task list.
Confirm that every task maps to the approved PLAN.
Confirm that feature status has been checked.
Identify any remaining blocking decisions.
Do not implement code.
Do not silently expand the scope.
Wait for the user to review and approve the TASK list.
Proceed to the IMPLEMENT stage only after the user approves the TASK list.

The next Skill is:

implement/SKILL.md

The IMPLEMENT stage will execute the approved tasks according to their dependencies and scope.