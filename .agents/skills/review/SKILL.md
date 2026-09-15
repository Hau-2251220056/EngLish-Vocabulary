# Review Skill

## 1. Purpose

The Review Skill is the final quality gate of the development workflow.

Its purpose is to review an implemented and tested change against:

* `AGENTS.md`
* approved `SPEC`
* approved `PLAN`
* approved `TASK`
* acceptance criteria
* project architecture
* security requirements
* testing evidence
* documentation requirements

The goal is to determine whether the implementation is:

* complete
* correct
* within approved scope
* consistent with the project architecture
* secure
* maintainable
* sufficiently tested
* ready to be accepted

Review is a quality-control stage, not a new implementation stage.

---

## 2. When to Use

Use the Review Skill after the TEST stage when:

* a feature has been implemented
* tests have been executed
* a bug fix has been completed
* a database/API change has been implemented
* a multi-layer change has been completed
* a significant refactor has been performed
* a release-ready change needs final verification

Do not use Review as a replacement for SPEC, PLAN, TASK, or TEST.

---

## 3. Core Principles

### 3.1 Review Against Approved Requirements

Review the actual implementation against the approved:

```text
SPEC
  ↓
PLAN
  ↓
TASK
  ↓
IMPLEMENTATION
  ↓
TEST
  ↓
REVIEW
```

Do not approve a change only because it appears to work.

---

### 3.2 Evidence-Based Review

Every important review conclusion should be supported by evidence from:

* changed files
* implementation code
* tests
* test results
* API behavior
* database schema or migration
* configuration
* documentation
* git diff when available

Do not claim that something is correct without sufficient evidence.

---

### 3.3 Review the Change, Not the Entire Repository

Do not inspect the entire repository by default.

Prioritize:

1. changed files
2. directly related files
3. related tests
4. relevant architecture/documentation
5. affected dependencies

Inspect additional files only when necessary to verify behavior.

---

### 3.4 Scope Discipline

The implementation must remain within the approved scope.

Check for:

* unrelated features
* unnecessary refactors
* unnecessary dependencies
* architectural changes not approved
* database changes not included in the plan
* API changes not included in the plan
* UI changes unrelated to the task
* behavior changes affecting existing features

If significant out-of-scope work is found, do not silently accept it.

---

### 3.5 Minimal and Maintainable Changes

Prefer implementation that is:

* simple
* understandable
* consistent with existing patterns
* easy to test
* easy to maintain
* appropriately separated by responsibility

Avoid approving complexity that does not provide meaningful value.

---

## 4. Required Context

Before starting a review, read:

1. `AGENTS.md`
2. relevant project documentation
3. approved `SPEC`
4. approved `PLAN`
5. approved `TASK`
6. relevant implementation files
7. relevant tests
8. TEST report or test results
9. relevant git diff when available

Do not assume that the implementation matches the plan.

Verify it.

---

# 5. Review Workflow

## Step 1 — Read the Approved Context

Understand:

* feature objective
* actors
* scope
* business rules
* acceptance criteria
* affected layers
* expected API behavior
* expected database changes
* expected frontend behavior
* testing requirements

If the requirement itself is unclear or contradictory, stop the review and return to SPEC or PLAN.

---

## Step 2 — Inspect the Actual Changes

Review:

* changed files
* created files
* deleted files
* modified configuration
* database schema changes
* migrations
* API changes
* frontend changes
* tests

When git diff is available, use it to understand the actual change boundary.

Determine:

```text
Expected Changes
vs
Actual Changes
```

---

## Step 3 — Trace Requirements to Implementation

For every important acceptance criterion, determine whether the implementation satisfies it.

Example:

```text
AC-01
→ Service implementation
→ API endpoint
→ Frontend usage
→ Test evidence
→ PASS
```

A requirement should not be considered complete only because related code exists.

Verify actual behavior.

---

## 6. Requirement Completeness Review

Check whether:

* every acceptance criterion is implemented
* every required business rule is enforced
* required validation exists
* required error behavior exists
* required authorization exists
* required UI states exist
* required database behavior exists
* required tests exist
* no required behavior was accidentally omitted

Classify each important criterion as:

* PASS
* FAIL
* PARTIAL
* NOT VERIFIED

---

# 7. Architecture Review

## 7.1 Backend

Verify that implementation follows the approved architecture:

```text
Request
→ Route
→ Middleware
→ Controller
→ Service
→ Repository / Data Access
→ Prisma
→ PostgreSQL
```

Check that:

* routes remain responsible for routing
* middleware handles cross-cutting concerns such as authentication/authorization
* controllers handle request/response concerns
* services contain business logic
* repositories/data-access code handles database access
* Prisma is not unnecessarily exposed across unrelated layers
* business logic is not duplicated across controllers
* database access is not unnecessarily placed inside controllers

Do not require a new layer if the existing project architecture does not need it.

---

## 7.2 Frontend

Verify the approved frontend architecture:

```text
Page
→ Component
→ Hook / State
→ Service
→ Backend API
```

Check that:

* existing components are reused when appropriate
* API communication follows existing service patterns
* business-critical decisions are not incorrectly duplicated on the frontend
* loading states are handled
* error states are handled
* empty states are handled when relevant
* successful states are handled
* unnecessary component duplication is avoided

---

# 8. Database Review

When the change affects the database, verify:

* schema matches the approved plan
* relationships are correct
* foreign keys are appropriate
* ownership rules are represented correctly
* required constraints exist
* nullable/non-nullable fields are intentional
* uniqueness constraints are intentional
* indexes are added only when justified
* migrations are safe and consistent
* existing data is not unnecessarily put at risk
* database behavior matches business rules

Do not approve undocumented database changes.

---

# 9. API Review

For API-related changes, verify:

* endpoint path
* HTTP method
* authentication requirements
* authorization requirements
* request validation
* request structure
* response structure
* status codes
* error handling
* ownership checks
* business rule enforcement

Check that frontend expectations match the actual backend contract.

The backend remains the source of truth for critical business behavior.

---

# 10. Business Logic Review

Pay special attention to business-critical logic.

Verify:

* quiz correctness
* score calculation
* XP calculation
* level progression
* streak behavior
* achievement conditions
* vocabulary ownership
* vocabulary set permissions
* community sharing behavior
* copy behavior
* pronunciation-related rules
* authentication and authorization rules

The frontend must not be trusted as the final authority for critical business rules.

---

# 11. Security Review

Check for:

* authentication bypass
* authorization bypass
* missing ownership checks
* insecure direct object access
* trusting user-controlled identifiers
* missing input validation
* unsafe database queries
* sensitive information in API responses
* secrets committed to source control
* API keys exposed to the frontend
* unsafe external-service integration
* inappropriate logging of sensitive information
* insecure error messages

For external services:

```text
Frontend
→ Backend
→ External Service
```

Sensitive credentials must remain server-side.

---

# 12. Authentication and Authorization Review

Verify that:

* protected routes require authentication
* public routes remain accessible where intended
* user-only resources require the correct user
* admin-only operations require `ADMIN`
* users cannot modify resources they do not own
* copying another user's vocabulary set does not grant ownership of the original
* community sharing does not unexpectedly change vocabulary-set ownership or visibility

Do not introduce additional roles without explicit approval.

Current project roles:

* `USER`
* `ADMIN`

---

# 13. Quiz Review

For quiz-related changes, verify:

* answer validation occurs on the backend where required
* case-sensitivity behavior matches the specification
* missing-letter behavior matches the specification
* character-position feedback is consistent with the approved behavior
* score behavior is deterministic
* XP behavior is correct
* invalid submissions are handled safely
* repeated submissions do not create unintended rewards

Do not approve quiz logic based only on frontend behavior.

---

# 14. Gamification Review

For XP, level, streak, and achievement changes, verify:

* XP cannot be arbitrarily manipulated by the client
* level calculation is consistent
* streak rules match the specification
* achievements are granted only when conditions are satisfied
* duplicate achievement rewards are prevented where required
* edge cases around repeated actions are handled
* critical calculations occur on the backend

Do not add leaderboard, ranking, XP transaction history, or other gamification systems unless explicitly approved.

---

# 15. Vocabulary Set Review

Verify:

### System/Admin Sets

* admin/system-created sets behave according to the specification
* public visibility is correct
* ownership rules are respected

### User-Created Sets

* users can modify only their own sets
* private sets remain private unless explicitly shared
* sharing does not unexpectedly mutate `is_public`

### Copying

When a user copies another user's set:

```text
Original Set
    ↓
Copy
    ↓
New Set owned by Copier
```

The copier must not receive edit permissions over the original set.

---

# 16. Community Review

For Community v1, verify only approved features:

* Posts
* Comments
* Vocabulary Set Sharing

Do not approve unrelated social features such as:

* likes
* reactions
* followers
* friends
* direct messaging
* chat
* leaderboard

unless they were explicitly approved.

---

# 17. AI and External Services Review

AI is optional.

If AI is used, verify:

* it solves an approved requirement
* it does not unnecessarily replace deterministic database content
* API keys remain server-side
* external calls are handled safely
* failures are handled gracefully
* the application remains usable when the external service fails where required
* AI output is not blindly trusted for critical business rules

Do not approve AI simply because it makes the implementation appear more advanced.

---

# 18. Test Evidence Review

Review the TEST report and actual test evidence.

Verify:

* acceptance criteria have corresponding tests or valid verification evidence
* important business rules are tested
* validation failures are tested
* authorization is tested
* edge cases are tested
* regression tests are considered
* build/lint/type checks are considered where applicable
* database changes are verified
* external service failures are considered when relevant

Distinguish between:

```text
Test Passed
```

and:

```text
Review Approved
```

Passing tests do not automatically mean the implementation is approved.

---

# 19. Regression Review

Check whether the change could affect existing functionality.

Consider:

* shared services
* shared components
* authentication
* database relations
* API contracts
* existing quiz behavior
* gamification
* vocabulary sets
* community features

If regression risk is significant, require additional verification before approval.

---

# 20. Code Quality Review

Review for:

* clear naming
* reasonable function size
* appropriate separation of responsibility
* consistent project conventions
* duplicated logic
* unnecessary complexity
* dead code
* unused imports
* unnecessary dependencies
* unclear abstractions
* hard-coded values that should be configurable
* maintainability problems

Do not demand stylistic perfection.

Prioritize correctness, security, maintainability, and consistency.

---

# 21. Documentation Review

Check whether relevant documentation remains accurate.

Potential documentation affected:

* `PROJECT_OVERVIEW.md`
* `ARCHITECTURE.md`
* `DATABASE.md`
* `API_SPEC.md`
* other approved project documentation

If implementation changes architecture, database structure, API behavior, or important business rules, documentation should be updated when required.

Do not create unnecessary documentation.

---

# 22. Findings Severity

Classify review findings using the following levels.

## BLOCKER

A critical problem that prevents safe acceptance.

Examples:

* authentication bypass
* authorization bypass
* exposed secret
* critical data corruption risk
* implementation fundamentally violates an approved requirement
* application cannot perform the core feature

Action:

```text
CHANGES_REQUIRED
```

---

## HIGH

A significant problem that should be fixed before approval.

Examples:

* important business rule is incorrect
* ownership check is missing
* critical acceptance criterion is incomplete
* major API contract mismatch
* important regression
* significant database inconsistency

Action:

```text
CHANGES_REQUIRED
```

---

## MEDIUM

A meaningful issue that should normally be fixed but does not necessarily block the feature if explicitly accepted.

Examples:

* incomplete edge-case handling
* moderate maintainability problem
* missing non-critical test
* documentation inconsistency
* unnecessary duplication

Action:

Usually fix before final approval.

---

## LOW

A minor improvement or non-critical issue.

Examples:

* small naming improvement
* minor code cleanup
* minor documentation wording
* low-risk refactor opportunity

Action:

May be deferred if it does not affect correctness, security, or maintainability.

---

## INFO

An observation or recommendation that does not require a change.

---

# 23. Finding Format

Each finding should contain:

```text
Severity:
Location:
Problem:
Why it matters:
Recommended action:
```

Example:

```text
Severity: HIGH
Location: backend/services/quiz.service.ts
Problem: Quiz reward is calculated from a client-provided score.
Why it matters: A client can manipulate the score and receive incorrect XP.
Recommended action: Calculate the score and reward on the backend.
```

Do not report vague findings such as:

```text
"This could be improved."
```

Explain the concrete problem and its impact.

---

# 24. Review Decision

The review must end with one of these verdicts.

## APPROVE

Use when:

* requirements are satisfied
* implementation is within scope
* architecture is respected
* security is acceptable
* tests provide sufficient evidence
* no blocking findings remain

---

## CHANGES_REQUIRED

Use when:

* implementation needs fixes
* important requirements are incomplete
* security issues exist
* significant architecture problems exist
* important tests are missing
* scope violations need correction

Return the work to IMPLEMENT when the issue is an implementation problem.

---

## BLOCKED

Use when review cannot be completed because required information or verification is unavailable.

Examples:

* required tests cannot run
* environment is unavailable
* required database state cannot be verified
* approved SPEC or PLAN is missing
* requirements contain unresolved conflicts

Do not treat an unverified condition as PASS.

---

# 25. Handling Findings

If a finding is an implementation issue:

```text
REVIEW
  ↓
Finding
  ↓
IMPLEMENT
  ↓
TEST
  ↓
REVIEW
```

If a finding reveals a requirement or design problem:

```text
REVIEW
  ↓
Requirement / Design Conflict
  ↓
SPEC or PLAN
  ↓
TASK
  ↓
IMPLEMENT
  ↓
TEST
  ↓
REVIEW
```

Do not silently modify the approved requirement during review.

---

# 26. Review Output

The Review report should use the following structure:

```text
# REVIEW REPORT: <Feature Name>

## 1. Summary

## 2. Scope Reviewed

## 3. Requirement Traceability

| Requirement | Result | Evidence |
|------------|--------|----------|
| AC-01 | PASS | ... |
| AC-02 | PASS | ... |
| AC-03 | PARTIAL | ... |

## 4. Architecture Review

### Backend
...

### Frontend
...

## 5. Database Review

...

## 6. API Review

...

## 7. Business Logic Review

...

## 8. Security Review

...

## 9. Testing Evidence

...

## 10. Regression Review

...

## 11. Documentation Review

...

## 12. Findings

| Severity | Location | Problem | Action |
|----------|----------|---------|--------|
| HIGH | ... | ... | ... |

## 13. Verdict

APPROVE / CHANGES_REQUIRED / BLOCKED

## 14. Recommended Next Action

...
```

---

# 27. Review Checklist

Before finalizing the review, verify:

### Requirements

* [ ] SPEC was reviewed
* [ ] PLAN was reviewed
* [ ] TASK was reviewed
* [ ] acceptance criteria were checked
* [ ] all important requirements are implemented

### Scope

* [ ] no significant unrelated changes
* [ ] no unapproved features
* [ ] no unnecessary refactor
* [ ] no unnecessary dependency

### Architecture

* [ ] backend architecture is respected
* [ ] frontend architecture is respected
* [ ] responsibilities are correctly separated
* [ ] existing patterns are reused

### Database

* [ ] schema is correct
* [ ] relations are correct
* [ ] ownership is correct
* [ ] constraints are correct
* [ ] migrations are verified

### API

* [ ] authentication is correct
* [ ] authorization is correct
* [ ] validation is correct
* [ ] request/response contract is correct
* [ ] error handling is correct

### Security

* [ ] no authentication bypass
* [ ] no authorization bypass
* [ ] ownership checks exist
* [ ] no secrets are exposed
* [ ] external-service credentials remain server-side

### Business Logic

* [ ] quiz behavior is correct
* [ ] score behavior is correct
* [ ] XP behavior is correct
* [ ] level behavior is correct
* [ ] streak behavior is correct
* [ ] achievement behavior is correct
* [ ] vocabulary ownership is correct
* [ ] community behavior is within scope

### Testing

* [ ] acceptance criteria have evidence
* [ ] important business rules are tested
* [ ] validation is tested
* [ ] authorization is tested
* [ ] edge cases are considered
* [ ] regression is considered
* [ ] test results are truthful

### Documentation

* [ ] affected documentation is updated
* [ ] no important project information is outdated

### Final Decision

* [ ] all findings are classified
* [ ] no blocker remains for APPROVE
* [ ] verdict is explicit
* [ ] next action is explicit

---

# 28. Prohibited Actions

The Review Skill must not:

* rewrite requirements during review
* silently change the SPEC
* silently change the PLAN
* add new features
* expand project scope
* perform unrelated refactoring
* approve unverified behavior
* claim tests passed without evidence
* ignore security issues
* ignore authorization issues
* ignore ownership issues
* approve exposed secrets
* require unnecessary technologies
* introduce unnecessary dependencies
* judge quality only by code style
* replace testing with subjective inspection

If implementation changes are required, return the work to IMPLEMENT.

---

# 29. Completion Criteria

Review is complete when:

1. approved requirements have been checked
2. actual changes have been inspected
3. architecture has been reviewed
4. security has been reviewed
5. business logic has been reviewed
6. database/API/frontend changes have been reviewed where applicable
7. test evidence has been reviewed
8. regression risk has been considered
9. documentation impact has been checked
10. findings have been classified
11. a clear verdict has been given
12. the next action is explicit

The Review stage must always end with:

```text
APPROVE
```

or

```text
CHANGES_REQUIRED
```

or

```text
BLOCKED
```

---

# 30. Workflow Completion

When Review returns:

```text
APPROVE
```

the feature can be considered complete for the current development cycle.

The overall workflow is:

```text
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
```

If problems are found:

```text
REVIEW
  ↓
IMPLEMENT
  ↓
TEST
  ↓
REVIEW
```

If requirements or architecture must change:

```text
REVIEW
  ↓
SPEC / PLAN
  ↓
TASK
  ↓
IMPLEMENT
  ↓
TEST
  ↓
REVIEW
```

Never bypass the workflow merely to finish a feature faster.
