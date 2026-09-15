# IMPLEMENT Skill

## Purpose

This Skill defines how to execute an approved implementation task safely and consistently.

The goal is to implement the required change with the **smallest appropriate set of changes**, while respecting the approved SPEC, PLAN, TASK, project architecture, and existing code.

This Skill is the first stage in the workflow where modifying source code is allowed.

---

# When to Use

Use this Skill when:

* A SPEC has been approved.
* A PLAN has been approved.
* One or more TASKs are ready for implementation.
* The user asks to implement, code, fix, or modify the approved task.

Do not use this Skill when:

* The requirement is still ambiguous.
* The SPEC is incomplete.
* The PLAN is incomplete.
* The TASK is not defined clearly enough to implement safely.

If required information is missing, stop and return to the appropriate previous stage.

---

# Core Principles

## 1. Implement Only the Approved Task

Implement the requested TASK and nothing beyond it.

Do not:

* Add unrelated features.
* Refactor unrelated code.
* Change unrelated architecture.
* Rename unrelated files.
* Introduce speculative abstractions.
* Modify behavior outside the task without a clear reason.

If an additional change becomes necessary, explain why before expanding the scope.

---

## 2. Read Context Before Editing

Before modifying code, inspect the minimum relevant context.

Recommended order:

```text id="p7x3ym"
AGENTS.md
    ↓
Relevant docs
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
```

Do not read the entire repository by default.

Only inspect additional files when the implementation genuinely depends on them.

---

## 3. Existing Code First

Before creating new code, search for existing:

* Functions.
* Services.
* Repositories.
* Controllers.
* Routes.
* Components.
* Hooks.
* Utilities.
* Validation.
* API clients.
* Types.
* Tests.

Prefer:

```text id="e6av5g"
Reuse
  ↓
Extend
  ↓
Create new code only when necessary
```

Do not create duplicate functionality because an existing implementation was not inspected.

---

## 4. Follow the Existing Architecture

Respect the architecture defined by:

* `AGENTS.md`
* `docs/ARCHITECTURE.md`
* Approved PLAN
* Existing project conventions

### Backend

```text id="j8q2lw"
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
```

### Frontend

```text id="x5w1oz"
Page
  ↓
Component
  ↓
Hook / State
  ↓
Service
  ↓
Backend API
```

Do not bypass established layers unless the existing architecture explicitly allows it.

---

# Implementation Workflow

Follow this process:

```text id="v5y9ba"
Approved TASK
      ↓
Read Context
      ↓
Inspect Existing Code
      ↓
Confirm Implementation Boundary
      ↓
Implement
      ↓
Review Local Changes
      ↓
Run Relevant Verification
      ↓
Report Result
```

---

# Step 1 — Read the Task

Before coding, identify:

* Task objective.
* Dependencies.
* Files/modules involved.
* In-scope requirements.
* Out-of-scope requirements.
* Implementation requirements.
* Acceptance criteria.
* Verification requirements.

Do not begin implementation until the task is sufficiently clear.

---

# Step 2 — Verify Dependencies

Check that required prerequisite tasks are already complete.

For example:

```text id="r4p0zj"
TASK-001: Database
       ↓
TASK-002: Repository
       ↓
TASK-003: Service
```

Do not implement TASK-003 if TASK-001 or TASK-002 is required but unavailable.

If the task can safely be implemented independently, proceed.

---

# Step 3 — Inspect Existing Code

Inspect the relevant files before editing.

Determine:

* Existing patterns.
* Naming conventions.
* Error-handling conventions.
* Validation conventions.
* Authentication/authorization patterns.
* Database access patterns.
* API response conventions.
* Frontend state patterns.
* Existing tests.

Follow the project's existing conventions unless the approved PLAN explicitly changes them.

---

# Step 4 — Confirm the Change Boundary

Before editing, identify:

```text id="v3x4jz"
Files to create
Files to modify
Files that should remain untouched
```

Avoid modifying files that are not relevant to the task.

If an unexpected file must be changed:

1. Determine why.
2. Check whether the change is required by the task.
3. Keep the change minimal.
4. Report it afterward.

---

# Step 5 — Implement the Minimum Necessary Change

Implement only what is required by the TASK.

Prefer:

* Small changes.
* Existing patterns.
* Existing utilities.
* Existing dependencies.
* Clear code.
* Simple solutions.

Avoid:

* Overengineering.
* Premature abstractions.
* Unnecessary design patterns.
* Unnecessary dependencies.
* Large refactors.
* Future-proofing that is not required by the task.

The implementation should solve the current approved requirement, not hypothetical future requirements.

---

# Step 6 — Backend Implementation Rules

When implementing backend functionality:

### Route

Keep routes responsible for routing and middleware composition.

### Controller

Controllers should:

* Receive the request.
* Extract required input.
* Call the appropriate service.
* Return the appropriate response.

Do not place complex business logic in controllers.

### Service

Services should contain business logic such as:

* Business rules.
* Ownership checks.
* State transitions.
* Quiz correctness.
* XP calculation.
* Level calculation.
* Streak logic.
* Achievement logic.

### Repository / Data Access

Repositories should handle database access according to the project's architecture.

Do not duplicate database queries across unrelated services when an existing repository abstraction should be reused.

### Authorization

Critical authorization must be enforced on the backend.

Do not rely only on frontend restrictions.

---

# Step 7 — Frontend Implementation Rules

When implementing frontend functionality:

* Reuse existing components where appropriate.
* Follow existing page/component structure.
* Use existing API service patterns.
* Keep business-critical logic on the backend.
* Handle loading states where relevant.
* Handle error states where relevant.
* Handle empty states where relevant.
* Avoid duplicating backend business rules in the frontend.

Frontend validation may improve user experience, but it must not replace backend validation for protected or business-critical behavior.

---

# Step 8 — Database Changes

If the TASK requires database changes:

1. Follow the approved PLAN.
2. Modify the schema according to the task.
3. Create the required migration using the project's existing workflow.
4. Verify that the migration is valid.
5. Verify that existing data behavior is not unintentionally broken.

Do not make unrelated schema changes.

Do not manually modify the production database outside the project's established migration process unless explicitly required.

---

# Step 9 — API Changes

When implementing an API:

* Follow the approved API contract.
* Follow existing endpoint naming conventions.
* Apply required authentication.
* Apply required authorization.
* Validate input.
* Return appropriate HTTP status codes.
* Follow existing response/error conventions.
* Update API documentation when required by the project.

Do not silently change an existing API contract.

If changing an existing contract is necessary, identify the impact before proceeding.

---

# Step 10 — Error Handling

Use the project's existing error-handling approach.

Handle relevant cases such as:

* Invalid input.
* Missing required data.
* Unauthorized access.
* Forbidden access.
* Resource not found.
* Duplicate data.
* Business-rule violations.
* Database errors.

Do not expose:

* Passwords.
* Tokens.
* API keys.
* Secrets.
* Internal credentials.
* Sensitive implementation details.

---

# Step 11 — Security

Follow security requirements defined by `AGENTS.md`.

At minimum:

* Never hard-code secrets.
* Never commit credentials.
* Never expose private environment variables to the frontend.
* Enforce authorization on the backend.
* Validate untrusted input.
* Avoid unsafe query construction.
* Do not trust client-provided ownership or permission information.

For external AI or third-party services:

```text id="y4qz6k"
Frontend
   ↓
Backend
   ↓
External Service
```

Do not expose service secrets to the frontend.

---

# Step 12 — Testing During Implementation

After implementing a task, perform the relevant basic verification.

Depending on the task, this may include:

* Unit tests.
* Integration tests.
* API tests.
* Component tests.
* Type checking.
* Lint.
* Build.
* Database migration verification.

Do not claim that tests passed unless they were actually executed.

Detailed test creation and full verification belong to the `TEST` Skill.

---

# Step 13 — Review Local Changes

Before finishing implementation, inspect the changes.

Check:

* Only intended files changed.
* No accidental debug code remains.
* No temporary code remains.
* No secrets were added.
* No unrelated refactoring was introduced.
* Existing conventions are followed.
* Error handling is appropriate.
* Acceptance criteria are satisfied.

If the project uses Git, inspect the diff when appropriate.

---

# Step 14 — Handle Unexpected Problems

If implementation reveals a problem not covered by the TASK:

### Small and Local

If the issue is directly necessary to complete the task and does not change scope significantly:

* Make the minimal required change.
* Explain it in the final report.

### Significant

If the issue requires:

* New business rules.
* Major architecture changes.
* Database redesign.
* New external services.
* New roles.
* Significant scope expansion.

Stop implementation for that part and return to the appropriate SPEC or PLAN stage.

Do not make major decisions silently.

---

# Step 15 — Documentation

Update documentation only when required.

Possible documentation:

* `docs/PROJECT_OVERVIEW.md`
* `docs/ARCHITECTURE.md`
* `docs/DATABASE.md`
* `docs/API_SPEC.md`

Documentation should reflect the actual implemented behavior.

Do not rewrite documentation unrelated to the task.

---

# Completion Criteria

An implementation task is complete when:

* The task requirements are implemented.
* Acceptance criteria are satisfied.
* Only relevant files were changed.
* Existing architecture is respected.
* Existing code was reused where appropriate.
* Security requirements are satisfied.
* Relevant verification was executed.
* No unrelated feature was added.
* No unresolved blocking issue remains.

---

# Implementation Report

After completing the task, report the result using this structure:

```markdown id="f3q8ka"
## Implementation Report

### Task

TASK-XXX: <Task Name>

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

- AC-01: PASS / FAIL
- AC-02: PASS / FAIL
- AC-03: PASS / FAIL

### Notes

- ...

### Scope Changes

- None

or

- <Explain the required scope change>
```

Never report `PASS` for a verification step that was not actually executed.

---

# What IMPLEMENT Must Not Do

The IMPLEMENT stage must not:

* Redefine the requirement.
* Change the approved SPEC without identifying it.
* Change the approved PLAN without identifying it.
* Implement unrelated features.
* Perform broad refactoring.
* Add unnecessary dependencies.
* Introduce unnecessary architecture.
* Expose secrets.
* Bypass backend authorization.
* Assume frontend validation is sufficient.
* Claim tests passed without running them.

---

# Transition to TEST

After implementation:

1. Report the completed changes.
2. Report verification results honestly.
3. Identify any known limitations.
4. Do not claim the feature is fully verified if full testing has not been performed.
5. Proceed to the `TEST` Skill for systematic verification.

The next Skill is:

```text id="l7x3pk"
test/SKILL.md
```
