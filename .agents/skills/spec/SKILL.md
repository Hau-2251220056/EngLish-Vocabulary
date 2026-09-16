# SPEC Skill

## Purpose

This Skill defines how to analyze a new feature, change request, bug-related requirement, or product requirement before implementation.

The goal is to ensure that the requirement is clearly understood, correctly scoped, consistent with the existing project, and ready for planning.

**This Skill does not implement code.**

---

## When to Use

Use this Skill when the user asks to:

* Add a new feature.

* Modify an existing feature.

* Change business behavior.

* Add or modify an API.

* Add or modify database behavior.

* Add a new user flow.

* Change permissions or roles.

* Add a quiz, vocabulary, pronunciation, gamification, community, or AI-related capability.

* Make a requirement that may affect multiple parts of the system.

For very small and unambiguous changes, the full SPEC process may be simplified, but the same principles still apply.

---

## Core Principles

### 1. Understand Before Implementing

Do not start coding immediately after receiving a requirement.

First determine:

* What the user wants.

* Why the feature is needed.

* Who can use it.

* What behavior is expected.

* What is inside the scope.

* What is outside the scope.

* What existing functionality may be affected.

---

### 2. Ask Before Assuming

If important information is missing or ambiguous, ask the user before finalizing the SPEC.

Do not silently invent:

* Business rules.

* User permissions.

* Data behavior.

* Validation rules.

* UI behavior.

* API behavior.

* Database relationships.

* Edge-case behavior.

Prefer a small number of focused questions over a long list of unnecessary questions.

Only ask questions whose answers can materially change the implementation or scope.

---

### 3. Do Not Invent Requirements

Do not create new requirements, features, business rules, roles, permissions, or technical constraints simply because they appear reasonable.

If a decision is not defined and materially affects scope or implementation, ask the user.

Do not expand the project based on assumptions.

---

### 4. Check Existing Project Context

Before finalizing a SPEC, inspect the relevant project context.

Read only what is necessary:

1. `AGENTS.md`

2. Relevant files under `docs/`

3. `docs/FEATURE_STATUS.md`

4. Existing implementation related to the requirement

Do not read the entire repository by default.

Relevant documentation may include:

* `docs/PROJECT_OVERVIEW.md`

* `docs/ARCHITECTURE.md`

* `docs/DATABASE.md`

* `docs/API_SPEC.md`

* `docs/UI_UX_SPEC.md`

If these documents conflict with the user's explicit new requirement, identify the conflict instead of silently choosing one.

Before proposing a new implementation, use `docs/FEATURE_STATUS.md` to determine whether the related feature is:

* `TODO`

* `IN_PROGRESS`

* `DONE`

* `BLOCKED`

Do not rebuild a feature marked `DONE` unless the user explicitly requests a change to that feature.

---

## SPEC Workflow

Follow this process:

```text
Requirement
    ↓
Understand Intent
    ↓
Check Project Context
    ↓
Check Feature Status
    ↓
Check Existing Implementation
    ↓
Identify Ambiguities
    ↓
Ask Clarifying Questions if Necessary
    ↓
Define Scope
    ↓
Define Business Rules
    ↓
Define Acceptance Criteria
    ↓
Check for Conflicts / Overengineering
    ↓
Produce SPEC
Step 1 — Understand the Requirement

Identify the core request.

Determine:

Feature or change name.
User goal.
Problem being solved.
Expected result.
Relevant actor(s).

Do not expand the requirement with additional features simply because they seem useful.

Step 2 — Identify Actors

Determine which roles are affected.

Current project roles are:

USER
ADMIN

Do not introduce additional roles unless the user explicitly approves them.

For each relevant actor, determine:

What they can do.
What they cannot do.
Whether authentication is required.
Step 3 — Inspect Existing Functionality

Before proposing a new implementation, determine whether the project already contains:

A similar feature.
Existing API endpoints.
Existing database models.
Existing services.
Existing components.
Existing reusable utilities.
Existing validation or authorization logic.

Prefer extending or reusing existing functionality instead of creating duplicate systems.

Also check docs/FEATURE_STATUS.md to determine the current implementation status of the related feature.

If the feature is marked DONE, inspect the existing implementation before proposing any changes.

If the feature is marked IN_PROGRESS, continue from the existing implementation when appropriate.

If the feature is marked BLOCKED, identify the blocking issue before continuing.

If the documented status conflicts with the actual implementation, identify the inconsistency instead of assuming either source is correct.

Step 4 — Identify Ambiguities

Look for decisions that could materially affect implementation.

Typical ambiguity categories:

Business Rules
When does an action succeed?
When does it fail?
What conditions are required?
What happens in edge cases?
Permissions
Who can access the feature?
Who can create?
Who can edit?
Who can delete?
Who can view?
Data
What information must be stored?
What information is temporary?
What relationships are required?
What happens when related data is deleted?
API
What endpoint is required?
What HTTP method?
What request data?
What response?
What validation?
What error cases?
UI / UX
What information must be displayed?
What actions are available?
What happens after success or failure?
What loading, empty, or error states are required?
Scope
Is this required for the current feature?
Is it a separate feature?
Would adding it significantly increase project complexity?
Step 5 — Ask Clarifying Questions

If important ambiguity exists, stop the SPEC process and ask the user.

Questions should be:

Specific.
Easy to answer.
Relevant to the requirement.
Limited to decisions that matter.

Prefer offering concrete options when possible.

Example:

For user-created Vocabulary Sets, should the default visibility be:

A. Private

B. Public

C. User chooses visibility

Do not continue to implementation planning until important unresolved decisions are confirmed.

If the requirement is already sufficiently clear, do not ask unnecessary questions.

Step 6 — Define Scope

Clearly separate:

In Scope

What this requirement includes.

Out of Scope

What this requirement explicitly does not include.

This prevents scope creep.

Example:

In Scope:

- User creates a vocabulary set.

- User adds vocabulary items.

- User can edit their own set.

- User can delete their own set.

Out of Scope:

- Likes.

- Followers.

- Leaderboards.

- Private messaging.

- AI-generated vocabulary.

Do not add out-of-scope functionality unless the user explicitly requests it.

Step 7 — Define Business Rules

Write the rules in a way that can later be implemented and tested.

Example:

BR-01:

A USER can create a vocabulary set.

BR-02:

A USER can edit only vocabulary sets they own.

BR-03:

A USER cannot modify another user's vocabulary set.

BR-04:

An ADMIN can manage system-created vocabulary sets.

Rules should be:

Explicit.
Testable.
Consistent with AGENTS.md.
Consistent with project documentation.
Step 8 — Define Data Requirements

Determine whether the requirement affects data.

If it does, identify:

Existing entities involved.
New entities required.
Fields required.
Relationships.
Constraints.
Ownership.
Required indexes or uniqueness rules when relevant.

Do not design the complete database schema during SPEC unless necessary to clarify the requirement.

Detailed database design belongs to the PLAN stage.

Step 9 — Define API Requirements

If the feature requires backend communication, identify the expected API behavior at a high level:

Endpoint.
HTTP method.
Authentication requirement.
Authorization requirement.
Main request data.
Main response data.
Important error cases.

Do not write implementation code.

Detailed API design belongs to PLAN.

Step 10 — Define Acceptance Criteria

Acceptance criteria must describe observable behavior.

Use clear, testable statements.

Example:

AC-01:

Given an authenticated USER,

when they submit valid vocabulary set information,

then the vocabulary set is created successfully.

AC-02:

Given an unauthenticated user,

when they attempt to create a vocabulary set,

then the request is rejected.

AC-03:

Given a USER who does not own a vocabulary set,

when they attempt to edit it,

then the request is rejected.

Acceptance criteria should cover important:

Success cases.
Validation failures.
Authorization failures.
Not-found cases.
Relevant business-rule failures.
Step 11 — Check Scope and Complexity

Before finalizing the SPEC, check whether the requirement:

Fits the current thesis scope.
Conflicts with existing project decisions.
Introduces unnecessary complexity.
Requires a new role.
Requires a new external service.
Requires a major architectural change.
Expands an existing feature into several unrelated features.

If the requirement significantly expands the scope, tell the user before proceeding.

Do not automatically reject the idea. Explain the impact and ask whether the expanded scope is intentional.

Step 12 — Check for Conflicts

Check the requirement against:

AGENTS.md
docs/PROJECT_OVERVIEW.md
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/API_SPEC.md
docs/UI_UX_SPEC.md
docs/FEATURE_STATUS.md
Existing relevant implementation

If a conflict exists:

Identify it.
Explain why it matters.
Ask the user to decide when necessary.
Do not silently override existing project rules.

AGENTS.md has higher priority than this Skill.

SPEC Output Format

Once the requirement is sufficiently clear, produce a concise SPEC using the following structure:

# SPEC: <Feature Name>

## 1. Objective

<What problem this feature solves and what the expected result is.>

## 2. Actors

- USER: ...

- ADMIN: ...

## 3. Scope

### In Scope

- ...

### Out of Scope

- ...

## 4. User Flow

1. ...

2. ...

3. ...

## 5. Business Rules

- BR-01: ...

- BR-02: ...

- BR-03: ...

## 6. Data Requirements

- ...

- ...

## 7. API Requirements

- ...

- ...

## 8. Acceptance Criteria

- AC-01: ...

- AC-02: ...

- AC-03: ...

## 9. Edge Cases

- ...

- ...

## 10. Dependencies / Impact

- ...

## 11. Open Questions

- None

Do not include implementation code in the SPEC.

Completion Rules

A SPEC is ready when:

The user's goal is clear.
Relevant actors are identified.
Scope is defined.
Important business rules are defined.
Important permissions are defined.
Data requirements are understood at a high level.
API requirements are understood at a high level when applicable.
Acceptance criteria are testable.
Important ambiguities are resolved.
Existing project rules are respected.
No unnecessary features have been added.
The relevant feature status has been checked.
Existing implementation has been inspected when applicable.

If important questions remain unanswered, do not pretend the SPEC is complete.

Transition to PLAN

After the SPEC is finalized:

Present the completed SPEC.
Do not implement code.
Do not create detailed implementation tasks.
Do not start PLAN automatically.
Wait for the user to review and approve the SPEC.

After the user approves the SPEC, the next Skill is:

plan/SKILL.md

The PLAN stage will transform the approved SPEC into a technical implementation plan.