# PLAN Skill

## Purpose

This Skill defines how to transform an approved SPEC into a clear, technically sound implementation plan.

The goal is to determine **how the approved requirement should be implemented within the existing project architecture** without writing implementation code or expanding the approved scope.

**This Skill does not implement code.**

---

## When to Use

Use this Skill when:

- A SPEC has been completed and approved by the user.

- The user asks how a feature should be implemented.

- A requirement requires changes across database, backend, frontend, API, or multiple layers.

- An existing feature needs architectural or technical changes.

Do not use this Skill to replace the SPEC stage.

If the requirement is still ambiguous or the SPEC is incomplete or not approved, return to the SPEC stage first.

---

# Core Principles

## 1. Plan From the Approved SPEC

The SPEC is the primary input for the PLAN stage.

The PLAN must not begin until the SPEC has been reviewed and approved by the user.

Do not:

- Change the approved business requirements.

- Add unrelated features.

- Invent new business rules.

- Expand the scope without user approval.

If the plan reveals a requirement that was not covered by the SPEC, identify it and return to the SPEC stage for clarification when necessary.

---

## 2. Understand the Existing System First

Before creating a plan, inspect the relevant existing project structure and implementation.

Read only what is necessary:

1. `AGENTS.md`

2. Relevant documentation under `docs/`

3. `docs/FEATURE_STATUS.md`

4. Relevant database schema

5. Relevant backend code

6. Relevant frontend code

7. Relevant tests

Do not read the entire repository by default.

The purpose is to understand what already exists, determine the current feature status, and identify what can be reused.

Use `docs/FEATURE_STATUS.md` to determine whether the related feature is:

- `TODO`

- `IN_PROGRESS`

- `DONE`

- `BLOCKED`

If the feature is `DONE`, do not plan a rebuild unless the approved SPEC explicitly requests a change.

If the feature is `IN_PROGRESS`, plan changes based on the existing implementation.

If the feature is `BLOCKED`, identify the blocking issue before continuing.

If the documented status conflicts with the actual implementation, identify the inconsistency instead of assuming either source is correct.

---

## 3. Reuse Before Creating

Before proposing new files, modules, services, components, endpoints, or utilities, check whether an existing implementation can be reused or extended.

Prefer:

```text
Existing implementation
        ↓
Extend / reuse

over:

Existing implementation
        ↓
Create duplicate implementation

Avoid introducing unnecessary abstractions.

4. Do Not Invent Technical Decisions

Do not introduce libraries, services, architecture patterns, database structures, external APIs, or infrastructure simply because they appear useful.

If a technical decision materially affects project scope, complexity, cost, security, or architecture and it has not been established by the project or approved SPEC, identify it and ask for clarification when necessary.

Prefer existing project conventions and the simplest technical solution that satisfies the approved SPEC.

5. Respect Existing Architecture

The project currently follows these architectural directions.

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

The plan should follow the existing architecture unless there is a clear reason to change it.

If an architectural change is required, explain:

Why it is required.
What will change.
What existing functionality may be affected.
Why the simpler existing approach is insufficient.

Do not introduce architectural changes only for theoretical future scalability.

PLAN Workflow

Follow this process:

Approved SPEC
      ↓
Read Project Context
      ↓
Check Feature Status
      ↓
Inspect Existing Implementation
      ↓
Identify Affected Areas
      ↓
Design Technical Approach
      ↓
Database Plan
      ↓
Backend Plan
      ↓
API Plan
      ↓
Frontend Plan
      ↓
Testing Plan
      ↓
Impact / Dependency Check
      ↓
Implementation Order
      ↓
Complexity / Scope Check
      ↓
Technical PLAN

Not every feature requires every section.

Only include areas actually affected by the requirement.

Step 1 — Validate the SPEC

Before planning, confirm that the SPEC contains enough information to plan the implementation.

Check:

Objective.
Actors.
Scope.
Business rules.
Permissions.
Acceptance criteria.
Relevant data requirements.
Relevant API requirements.

The SPEC must also have been reviewed and approved by the user.

If important information is missing or the SPEC is not approved, do not guess.

Return to the SPEC stage and ask for clarification or approval.

Step 2 — Inspect Existing Implementation

Determine:

Where the related feature currently exists.
Which files/modules are involved.
Which database models already exist.
Which API endpoints already exist.
Which frontend pages/components already exist.
Which services/utilities can be reused.
Which tests already cover related behavior.

The plan should reference actual existing files or modules whenever they are known.

Example:

backend/src/modules/vocabulary/

frontend/src/features/vocabulary/

Do not invent paths when the actual project structure can be inspected.

If the feature is already partially implemented, plan from the existing implementation rather than starting from scratch.

Step 3 — Identify Affected Areas

Determine which layers are affected.

Possible areas:

Database.
Backend routes.
Middleware.
Controllers.
Services.
Repositories / data access.
API contracts.
Frontend pages.
Components.
Hooks/state.
Validation.
Authentication.
Authorization.
Tests.
Documentation.

Clearly distinguish:

Required changes

from:

Potential future improvements

Future improvements should not be included in the implementation plan unless approved.

Step 4 — Database Plan

If the feature affects data, determine:

Existing tables/models to reuse.
New models required.
Fields required.
Relationships.
Foreign keys.
Required constraints.
Uniqueness requirements.
Nullability.
Ownership.
Delete/update behavior.
Indexes when justified.

Example:

Model: VocabularySet

Changes:

- Add ownerId.

- Add title.

- Add description.

- Add createdAt.

- Add updatedAt.

Relationship:

USER 1 ─── N VocabularySet

Do not write Prisma implementation code during PLAN.

The plan should describe what needs to change and why, not implement the schema.

Step 5 — Backend Plan

Determine the backend changes required.

For each affected area, specify:

Route
HTTP method.
Endpoint.
Authentication requirement.
Authorization requirement.
Controller
Responsibility.
Input passed to the service.
Response returned.
Service
Business logic.
Validation that belongs to the business layer.
Business-rule enforcement.
Repository / Data Access
Required database operations.
Queries or persistence responsibilities.
Middleware

Only include middleware changes when actually required.

Do not move business logic into controllers simply because it is convenient.

Business logic should remain in the service layer.

Step 6 — API Contract Plan

For each affected API, define the expected contract at a technical level.

Example:

POST /api/vocabulary-sets

Auth:

- Required

- USER

Request:

{
  title: string,
  description?: string
}

Success:

201 Created

Response:

{
  id: string,
  title: string,
  description: string
}

Errors:

- 400 Validation Error

- 401 Unauthorized

- 403 Forbidden

The API plan should remain consistent with docs/API_SPEC.md.

If the API contract changes, identify that documentation must be updated.

Do not write backend implementation code during this stage.

Step 7 — Frontend Plan

Determine:

Which page is affected.
Which existing components can be reused.
Which new components are actually required.
Required state.
Required form fields.
API service changes.
Loading state.
Error state.
Empty state when applicable.
Success behavior.
Navigation behavior.

Follow the existing frontend architecture.

Avoid creating components merely to split small pieces of UI without a practical reason.

The frontend plan should also remain consistent with docs/UI_UX_SPEC.md when the requirement affects UI/UX.

Step 8 — Authentication and Authorization Plan

For protected functionality, explicitly define:

Whether authentication is required.
Which role can perform the action.
Whether ownership must be checked.
Where authorization should be enforced.

For example:

USER
  ↓
Authenticated?
  ↓
Owns resource?
  ↓
Allowed

Critical authorization rules must be enforced by the backend.

Do not rely only on frontend restrictions.

Do not introduce new roles unless they are explicitly approved in the SPEC.

Step 9 — Validation Plan

Identify validation requirements.

Consider:

Required fields.
Data types.
Length limits.
Allowed values.
Duplicate data.
Invalid identifiers.
Ownership.
Business constraints.

Distinguish:

Input validation

from:

Business validation

Validation should be placed in the appropriate layer according to the existing architecture.

Do not invent validation rules that materially affect behavior if they were not defined in the SPEC.

If such a rule is necessary, return to SPEC clarification.

Step 10 — Testing Plan

Define what should be tested after implementation.

Include relevant:

Backend
Service tests.
API/integration tests.
Authorization tests.
Validation tests.
Frontend
Component tests.
User interaction tests.
API/error state tests when applicable.
Regression

Identify existing functionality that could be affected.

Do not write the actual tests during PLAN.

The test Skill handles test implementation and execution.

Step 11 — Impact and Dependency Check

Determine whether the feature affects existing functionality.

Check for:

Existing APIs.
Existing database relationships.
Existing frontend flows.
Authentication.
Authorization.
Quiz behavior.
Vocabulary learning.
Gamification.
Community.
Admin functionality.
External services.
Existing tests.

Clearly identify potential regressions.

If a dependency is not actually required, do not add it to the plan.

Step 12 — Documentation Impact

Determine whether implementation will require updates to:

docs/PROJECT_OVERVIEW.md
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/API_SPEC.md
docs/UI_UX_SPEC.md
docs/FEATURE_STATUS.md
Other project documentation

Only include documentation changes that are actually necessary.

Documentation must remain synchronized with the implemented system.

If the feature status changes after implementation, docs/FEATURE_STATUS.md must be updated during the appropriate later stage.

Step 13 — Implementation Order

Define the recommended implementation order.

A typical example:

1. Database

2. Repository / Data Access

3. Service

4. Controller

5. Route

6. API validation / authorization

7. Backend tests

8. Frontend API service

9. Frontend components / page

10. Frontend tests

11. Integration verification

12. Documentation update

Adjust the order according to the actual feature.

The order should minimize broken intermediate states and make dependencies clear.

Do not treat the example order as mandatory when the feature does not require all layers.

Step 14 — Complexity and Scope Check

Before finalizing the PLAN, verify:

The solution is proportional to the requirement.
Existing code is reused where appropriate.
No unnecessary library is introduced.
No unnecessary architectural pattern is introduced.
No unrelated refactoring is included.
No new role is introduced without approval.
No unrelated feature is bundled into the implementation.
The plan is realistic for the project's thesis scope.
The plan does not introduce unnecessary external services.

Prefer the simplest solution that satisfies the approved SPEC.

If a simpler solution exists, prefer it unless there is a clear technical reason not to.

PLAN Output Format

When the plan is complete, use the following structure:

# PLAN: <Feature Name>

## 1. Summary

<Short description of the technical approach.>

## 2. Affected Areas

- Database: ...

- Backend: ...

- API: ...

- Frontend: ...

- Tests: ...

- Documentation: ...

## 3. Existing Code to Reuse

- `<path>` — <what can be reused>

- `<path>` — <what can be extended>

## 4. Database Plan

### Existing Models

- ...

### Changes

- ...

### Relationships / Constraints

- ...

## 5. Backend Plan

### Routes

- ...

### Middleware

- ...

### Controllers

- ...

### Services

- ...

### Repository / Data Access

- ...

## 6. API Contract

### Endpoint

`METHOD /api/...`

### Authentication / Authorization

- ...

### Request

- ...

### Response

- ...

### Errors

- ...

## 7. Frontend Plan

### Pages

- ...

### Components

- ...

### State / Hooks

- ...

### API Services

- ...

### UI States

- Loading: ...

- Error: ...

- Empty: ...

- Success: ...

## 8. Validation & Business Logic

- ...

## 9. Testing Plan

### Backend

- ...

### Frontend

- ...

### Regression

- ...

## 10. Documentation Impact

- ...

## 11. Implementation Order

1. ...

2. ...

3. ...

## 12. Risks / Considerations

- ...

## 13. Open Questions

- None

Do not include implementation code in the PLAN.

PLAN Completion Rules

A PLAN is ready when:

It is based on an approved SPEC.
Relevant existing implementation has been inspected.
The current feature status has been checked.
Reusable code has been identified.
All affected layers are identified.
Database changes are understood.
API behavior is defined when applicable.
Backend responsibilities are clear.
Frontend responsibilities are clear.
Authentication and authorization are addressed when applicable.
Testing requirements are identified.
Documentation impact is identified.
Implementation order is clear.
No unnecessary scope has been added.
No unresolved technical ambiguity blocks implementation.
The proposed solution is proportional to the project's thesis scope.
What PLAN Must Not Do

The PLAN stage must not:

Implement code.
Modify source files.
Create database migrations.
Install dependencies.
Run implementation commands.
Create detailed coding tasks.
Rewrite unrelated existing code.
Add unapproved features.
Introduce new roles without approval.
Introduce external services without justification and approval when they materially affect scope, cost, security, or architecture.

Those responsibilities belong to later stages.

Transition to TASK

After the PLAN is completed:

Present the technical PLAN.
Do not implement code.
Do not silently change the approved SPEC.
Identify any remaining blocking decisions.
Wait for the user to review and approve the PLAN.
Proceed to the TASK stage only after the user approves the PLAN.

The next Skill is:

task/SKILL.md

The TASK stage will transform the approved PLAN into small, concrete implementation tasks.
```
