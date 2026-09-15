TASK Skill
Purpose

This Skill defines how to transform an approved technical PLAN into a set of small, concrete, executable implementation tasks.

The goal is to make implementation predictable, traceable, and easy to verify.

This Skill does not implement code.

When to Use

Use this Skill when:

A SPEC has been approved.
A technical PLAN has been completed and approved.
The feature requires implementation work.
The user asks to break a PLAN into implementation tasks.

Do not use this Skill when:

The requirement is still ambiguous.
The SPEC is incomplete.
The PLAN has not been completed.
The user is only asking for technical analysis.

If the PLAN is incomplete or contains blocking ambiguity, return to the PLAN or SPEC stage before creating tasks.

Core Principles
1. Tasks Must Come From the PLAN

Every task must be traceable to an item in the approved PLAN.

Do not introduce unrelated work.

If implementation requires something that is not covered by the PLAN:

Identify the missing requirement.
Determine whether the PLAN needs to be updated.
Return to the appropriate stage when necessary.

Do not silently expand the scope.

2. One Task Should Have One Clear Responsibility

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
3. Tasks Must Be Executable

Each task should tell the implementation agent:

What to change.
Where to change it.
Why the change is needed.
What behavior is expected.
What dependencies must already be completed.
How the task can be verified.

The task should contain enough information that the implementation agent does not need to rediscover the entire feature.

4. Respect Existing Architecture

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
5. Respect Dependencies

Tasks should be ordered according to their dependencies.

For example:

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

Do not require a task to depend on work that has not been completed unless parallel execution is explicitly safe.

TASK Workflow

Follow this process:

Approved PLAN
      ↓
Identify Implementation Areas
      ↓
Identify Dependencies
      ↓
Break Work Into Tasks
      ↓
Order Tasks
      ↓
Define Task Details
      ↓
Define Verification
      ↓
Check Scope
      ↓
Produce TASK List
Step 1 — Read the Approved PLAN

Review:

AGENTS.md
Approved SPEC
Approved PLAN
Relevant project documentation
Relevant existing implementation when necessary

Do not reread the entire repository unless required.

The PLAN is the primary source for task creation.

Step 2 — Identify Implementation Areas

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

Only create tasks for areas actually affected by the PLAN.

Step 3 — Break the PLAN Into Tasks

Convert each meaningful implementation responsibility into a task.

A task should generally be small enough to:

Understand independently.
Implement independently when dependencies allow.
Test independently.
Review independently.

Do not create extremely tiny tasks that provide no meaningful unit of work.

For example, avoid:

TASK-001: Create a file.
TASK-002: Add an import.
TASK-003: Add one function.

unless those actions genuinely need to be separated.

Step 4 — Define Dependencies

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

If two tasks can safely be performed independently, they may share the same dependency level.

Step 5 — Define Task Scope

Every task should explicitly define:

In Scope

What this task must implement.

Out of Scope

What this task must not implement.

This prevents an implementation agent from expanding a task into unrelated work.

Example:

In Scope:
- Create the repository method for retrieving a vocabulary set.
- Return the required vocabulary set data.

Out of Scope:
- Create a new frontend page.
- Add comments.
- Add community sharing.
Step 6 — Define Files and Modules

When the relevant paths are known, specify them.

Example:

Files to modify:
- backend/src/modules/vocabulary/repository.ts
- backend/src/modules/vocabulary/service.ts

Files to create:
- backend/src/modules/vocabulary/vocabulary-set.controller.ts

Do not invent paths.

If the exact path is not yet known, describe the module responsibility instead of guessing.

Step 7 — Define Implementation Requirements

For each task, specify the important technical requirements.

Examples:

Database
Model fields.
Relationships.
Constraints.
Migration requirement.
Backend
Function/service responsibility.
Validation.
Authorization.
Error handling.
API
HTTP method.
Endpoint.
Request.
Response.
Error cases.
Frontend
Page/component responsibility.
State.
API interaction.
Loading state.
Error state.
Success behavior.

Do not write the implementation code inside the task.

Step 8 — Define Acceptance Criteria

Each task should have clear completion criteria.

Example:

Acceptance Criteria:

- VocabularySet can be created with valid data.
- Invalid input is rejected.
- A user cannot create a set without authentication.
- The repository returns the created record.

Acceptance criteria should be observable and testable.

Step 9 — Define Verification

Specify how the implementation agent can verify the task.

Examples:

Verification:
- Run backend unit tests.
- Run API integration tests.
- Run lint.
- Run build.

For database tasks:

Verification:
- Prisma schema generates successfully.
- Migration applies successfully.
- Existing tests remain passing.

For frontend tasks:

Verification:
- Component tests pass.
- Frontend build succeeds.
- Relevant user flow works.

Do not claim that verification has passed before it is actually executed.

Step 10 — Identify Parallel Work

When useful, indicate tasks that can safely be worked on in parallel.

Example:

TASK-005 and TASK-006

Dependencies:
- TASK-004

These tasks can be implemented independently.

Do not force parallelization when tasks share mutable dependencies or require sequential decisions.

Step 11 — Check Scope

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
...
Out of Scope
...
...
Implementation Requirements
...
...
Acceptance Criteria
...
...
Verification
...
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

---

# Task Quality Checklist

Before finalizing the task list, verify:

### Traceability

- [ ] Every task maps to the approved PLAN.
- [ ] Every PLAN requirement is represented.

### Scope

- [ ] No unrelated work was added.
- [ ] No unnecessary refactoring was added.
- [ ] In-scope and out-of-scope boundaries are clear.

### Dependencies

- [ ] Dependencies are explicit.
- [ ] Task order is logical.
- [ ] Parallel work is identified only when safe.

### Technical Clarity

- [ ] Relevant files/modules are identified.
- [ ] Implementation requirements are clear.
- [ ] Architecture is respected.
- [ ] Security and authorization requirements are included when relevant.

### Verification

- [ ] Each task has acceptance criteria.
- [ ] Each task has a verification method.

---

# What TASK Must Not Do

The TASK stage must not:

- Write implementation code.
- Modify source files.
- Run migrations.
- Install dependencies.
- Execute implementation commands.
- Change the approved SPEC.
- Change the approved PLAN without identifying the need for change.
- Add unrelated features.
- Perform large-scale refactoring.

The implementation agent handles the actual coding.

---

# Handling Missing Information

If a task cannot be defined without making a significant assumption:

1. Stop task generation for the affected area.
2. Identify the missing information.
3. Determine whether it belongs to SPEC or PLAN.
4. Request clarification or return to the appropriate stage.

Do not hide significant assumptions inside a task.

---

# Transition to IMPLEMENT

Once the TASK list is complete:

1. Present the task list.
2. Confirm that all tasks map to the approved PLAN.
3. Do not implement code.
4. Do not silently expand the scope.
5. Proceed to the IMPLEMENT stage.

The next Skill is:

```text
implement/SKILL.md

The IMPLEMENT stage will execute the approved tasks one at a time or in safe dependency groups.