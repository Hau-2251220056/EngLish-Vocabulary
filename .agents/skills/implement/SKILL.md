# IMPLEMENT Skill

## Purpose

This Skill defines how to execute an approved implementation task safely and consistently.

The goal is to implement the required change with the **smallest appropriate set of changes**, while respecting the approved SPEC, PLAN, TASK, project architecture, feature status, and existing code.

This Skill is the first stage in the workflow where modifying source code is allowed.

---

# When to Use

Use this Skill when:

- A SPEC has been approved.

- A PLAN has been approved.

- A TASK list has been created and approved by the user.

- One or more TASKs are ready for implementation.

- The user asks to implement, code, fix, or modify an approved task.

Do not use this Skill when:

- The requirement is still ambiguous.

- The SPEC is incomplete.

- The PLAN is incomplete.

- The TASK is not defined clearly enough to implement safely.

- The TASK list has not been approved.

If required information is missing, stop and return to the appropriate previous stage.

---

# Core Principles

## 1. Implement Only the Approved Task

Implement the requested TASK and nothing beyond it.

Do not:

- Add unrelated features.

- Refactor unrelated code.

- Change unrelated architecture.

- Rename unrelated files.

- Introduce speculative abstractions.

- Modify behavior outside the task without a clear reason.

- Implement future features that are not part of the approved TASK.

If an additional change becomes necessary, determine whether it is:

### Local and necessary

A small change directly required to make the approved TASK work and that does not materially change the approved scope.

### Significant

A change involving:

- New business rules.

- Major architecture changes.

- Database redesign.

- New external services.

- New roles.

- Significant scope expansion.

Significant changes must stop and return to the appropriate SPEC or PLAN stage.

Do not make major decisions silently.

---

## 2. Implement Only an Approved TASK

The implementation agent must not start coding based only on a SPEC or PLAN.

The required workflow is:

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
  ↓
User Approval
  ↓
IMPLEMENT

Before coding, confirm that the TASK being implemented belongs to the approved TASK list.

If the TASK has not been approved, do not implement it.

3. Check Feature Status Before Editing

Before modifying source code, check:

docs/FEATURE_STATUS.md

Determine the current status of the feature:

TODO
IN_PROGRESS
DONE
BLOCKED
TODO

Implement according to the approved TASK.

IN_PROGRESS

Inspect the current implementation carefully and continue from the existing state.

Do not rebuild completed portions.

DONE

Do not rebuild the feature.

If the approved TASK represents a bug fix, enhancement, or modification, change only what is required by that TASK.

BLOCKED

Identify the blocker before continuing.

Do not implement code that depends on an unresolved blocker.

If the documented status conflicts with the actual source code or tests, identify the inconsistency and resolve it before making substantial changes.

4. Read Context Before Editing

Before modifying code, inspect the minimum relevant context.

Recommended order:

AGENTS.md
    ↓
Relevant docs
    ↓
FEATURE_STATUS.md
    ↓
SPEC
    ↓
PLAN
    ↓
TASK
    ↓
Relevant existing source files
    ↓
Relevant tests

Do not read the entire repository by default.

Only inspect additional files when the implementation genuinely depends on them.

5. Existing Code First

Before creating new code, search for existing:

Functions.
Services.
Repositories.
Controllers.
Routes.
Components.
Hooks.
Utilities.
Validation.
API clients.
Types.
Tests.

Prefer:

Reuse
  ↓
Extend
  ↓
Create new code only when necessary

Do not create duplicate functionality because an existing implementation was not inspected.

6. Follow the Existing Architecture

Respect the architecture defined by:

AGENTS.md
docs/ARCHITECTURE.md
Approved PLAN
Existing project conventions
Backend
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
Frontend
Page
  ↓
Component
  ↓
Hook / State
  ↓
Service
  ↓
Backend API

Do not bypass established layers unless:

The existing architecture explicitly allows it, or
The approved PLAN explicitly defines the exception.

Do not redesign the architecture during implementation.

Implementation Workflow

Follow this process:

Approved TASK
      ↓
Check Feature Status
      ↓
Read Context
      ↓
Inspect Existing Code
      ↓
Confirm Implementation Boundary
      ↓
Verify Dependencies
      ↓
Implement
      ↓
Review Local Changes
      ↓
Run Relevant Verification
      ↓
Report Result
Step 1 — Read the TASK

Before coding, identify:

Task objective.
Dependencies.
Files/modules involved.
In-scope requirements.
Out-of-scope requirements.
Implementation requirements.
Acceptance criteria.
Verification requirements.

Do not begin implementation until the task is sufficiently clear.

Step 2 — Verify Dependencies

Check that required prerequisite tasks are already complete.

For example:

TASK-001: Database
       ↓
TASK-002: Repository
       ↓
TASK-003: Service

Do not implement TASK-003 if TASK-001 or TASK-002 is required but unavailable.

If the task can safely be implemented independently, proceed.

If a dependency is missing and cannot be safely bypassed, stop and report the blocker.

Step 3 — Inspect Existing Code

Inspect the relevant files before editing.

Determine:

Existing patterns.
Naming conventions.
Error-handling conventions.
Validation conventions.
Authentication/authorization patterns.
Database access patterns.
API response conventions.
Frontend state patterns.
Existing tests.

Follow the project's existing conventions unless the approved PLAN explicitly changes them.

Step 4 — Confirm the Change Boundary

Before editing, identify:

Files to create

Files to modify

Files that should remain untouched

Avoid modifying files that are not relevant to the task.

If an unexpected file must be changed:

Determine why.
Check whether the change is directly required by the task.
Keep the change minimal.
Report it afterward.

If the unexpected change materially expands the scope, stop and return to the appropriate previous stage.

Step 5 — Implement the Minimum Necessary Change

Implement only what is required by the TASK.

Prefer:

Small changes.
Existing patterns.
Existing utilities.
Existing dependencies.
Clear code.
Simple solutions.

Avoid:

Overengineering.
Premature abstractions.
Unnecessary design patterns.
Unnecessary dependencies.
Large refactors.
Future-proofing that is not required by the task.

The implementation should solve the current approved requirement, not hypothetical future requirements.

Step 6 — Backend Implementation Rules

When implementing backend functionality:

Route

Keep routes responsible for:

Routing.
Middleware composition.

Do not place business logic in routes.

Controller

Controllers should:

Receive the request.
Extract required input.
Call the appropriate service.
Return the appropriate response.

Do not place complex business logic in controllers.

Service

Services should contain business logic such as:

Business rules.
Ownership checks.
State transitions.
Quiz correctness.
XP calculation.
Level calculation.
Streak logic.
Achievement logic.

Only implement these responsibilities when required by the approved TASK.

Repository / Data Access

Repositories should handle database access according to the project's architecture.

Do not duplicate database queries across unrelated services when an existing repository abstraction should be reused.

Authorization

Critical authorization must be enforced on the backend.

Do not rely only on frontend restrictions.

Step 7 — Frontend Implementation Rules

When implementing frontend functionality:

Reuse existing components where appropriate.
Follow existing page/component structure.
Use existing API service patterns.
Keep business-critical logic on the backend.
Handle loading states where relevant.
Handle error states where relevant.
Handle empty states where relevant.
Avoid duplicating backend business rules in the frontend.

Frontend validation may improve user experience, but it must not replace backend validation for protected or business-critical behavior.

Follow the approved docs/UI_UX_SPEC.md when the TASK affects UI/UX.

Do not invent new UI flows that are not defined by the approved TASK or existing UI/UX specification.

Step 8 — Database Changes

If the TASK requires database changes:

Follow the approved PLAN.
Modify the schema according to the task.
Create the required migration using the project's existing workflow.
Verify that the migration is valid.
Verify that existing data behavior is not unintentionally broken.

Do not make unrelated schema changes.

Do not manually modify the production database outside the project's established migration process unless explicitly required by the project.

If the required database change differs materially from the approved PLAN, stop and return to PLAN.

Step 9 — API Changes

When implementing an API:

Follow the approved API contract.
Follow existing endpoint naming conventions.
Apply required authentication.
Apply required authorization.
Validate input.
Return appropriate HTTP status codes.
Follow existing response/error conventions.
Update API documentation when required by the project.

Do not silently change an existing API contract.

If changing an existing contract is necessary, identify the impact before proceeding.

If the change materially affects other consumers, return to the PLAN stage before implementation.

Step 10 — Error Handling

Use the project's existing error-handling approach.

Handle relevant cases such as:

Invalid input.
Missing required data.
Unauthorized access.
Forbidden access.
Resource not found.
Duplicate data.
Business-rule violations.
Database errors.

Do not expose:

Passwords.
Tokens.
API keys.
Secrets.
Internal credentials.
Sensitive implementation details.

Do not introduce a completely new error-handling system unless approved by the PLAN.

Step 11 — Security

Follow security requirements defined by AGENTS.md.

At minimum:

Never hard-code secrets.
Never commit credentials.
Never expose private environment variables to the frontend.
Enforce authorization on the backend.
Validate untrusted input.
Avoid unsafe query construction.
Do not trust client-provided ownership or permission information.

For external AI or third-party services:

Frontend
   ↓
Backend
   ↓
External Service

Do not expose service secrets to the frontend.

Do not introduce a new external service unless it is covered by the approved PLAN.

Step 12 — Testing During Implementation

After implementing a task, perform relevant basic verification.

Depending on the task, this may include:

Unit tests.
Integration tests.
API tests.
Component tests.
Type checking.
Lint.
Build.
Database migration verification.

Do not claim that tests passed unless they were actually executed.

The purpose of this step is basic implementation verification.

Detailed test creation and systematic verification belong to the TEST Skill.

Step 13 — Review Local Changes

Before finishing implementation, inspect the changes.

Check:

Only intended files changed.
No accidental debug code remains.
No temporary code remains.
No secrets were added.
No unrelated refactoring was introduced.
Existing conventions are followed.
Error handling is appropriate.
Acceptance criteria are satisfied.
The implementation matches the approved TASK.

If the project uses Git, inspect the diff when appropriate.

Step 14 — Handle Unexpected Problems

If implementation reveals a problem not covered by the TASK:

Small and Directly Necessary

A small change may be made only when:

It is directly required to complete the approved TASK.
It does not introduce a new business rule.
It does not materially change the architecture.
It does not materially expand the scope.

When this happens:

Make the minimum required change.
Record it in the implementation report.
Explain why it was necessary.
Significant

If the issue requires:

New business rules.
Major architecture changes.
Database redesign.
New external services.
New roles.
Significant scope expansion.

Stop implementation for that part.

Return to the appropriate SPEC or PLAN stage.

Do not make major decisions silently.

Step 15 — Documentation

Update documentation only when required.

Possible documentation:

docs/PROJECT_OVERVIEW.md
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/API_SPEC.md
docs/UI_UX_SPEC.md

Documentation should reflect the actual implemented behavior.

Do not rewrite documentation unrelated to the task.

Do not mark a feature as DONE merely because the implementation code has been written.

Feature status should be updated only after the appropriate testing and review stages confirm completion.

Completion Criteria

An implementation task is complete when:

The task requirements are implemented.
Acceptance criteria are satisfied as far as implementation verification can establish.
Only relevant files were changed.
Existing architecture is respected.
Existing code was reused where appropriate.
Security requirements are satisfied.
Relevant basic verification was executed.
No unrelated feature was added.
No unresolved implementation blocker remains.

A task being implemented successfully does not automatically mean the entire feature is DONE.

Full feature completion is determined after TEST and REVIEW.

Implementation Report

After completing the task, report the result using this structure:

## Implementation Report

### Task

TASK-XXX: <Task Name>

### Feature Status

Before: <TODO / IN_PROGRESS / DONE / BLOCKED>

After Implementation: <TODO / IN_PROGRESS>

Do not mark the feature as DONE at this stage unless the project explicitly defines implementation alone as completion.

### Changes

- `<path>` — <what changed>

- `<path>` — <what changed>

### Reused

- `<existing module>` — <how it was reused>

### Verification

- Tests: PASS / FAIL / NOT RUN

- Lint: PASS / FAIL / NOT RUN

- Build: PASS / FAIL / NOT RUN

- Other: ...

### Acceptance Criteria

- AC-01: PASS / FAIL / NOT VERIFIED

- AC-02: PASS / FAIL / NOT VERIFIED

- AC-03: PASS / FAIL / NOT VERIFIED

### Notes

- ...

### Scope Changes

- None

or

- <Explain the required scope change>

### Blockers

- None

or

- <Explain the blocker>

Never report PASS for a verification step that was not actually executed.

Never claim full feature completion based only on implementation.

What IMPLEMENT Must Not Do

The IMPLEMENT stage must not:

Redefine the requirement.
Change the approved SPEC without identifying it.
Change the approved PLAN without identifying it.
Implement unrelated features.
Perform broad refactoring.
Add unnecessary dependencies.
Introduce unnecessary architecture.
Expose secrets.
Bypass backend authorization.
Assume frontend validation is sufficient.
Claim tests passed without running them.
Rebuild completed functionality without an approved change.
Introduce new roles without approval.
Introduce new external services without approval.
Mark the entire feature as DONE before TEST and REVIEW.
Transition to TEST

After implementation:

Report the completed changes.
Report verification results honestly.
Identify any known limitations.
Identify any blockers.
Confirm whether the implementation matches the approved TASK.
Do not claim the feature is fully verified if full testing has not been performed.
Proceed to the TEST Skill for systematic verification.

The next Skill is:

test/SKILL.md