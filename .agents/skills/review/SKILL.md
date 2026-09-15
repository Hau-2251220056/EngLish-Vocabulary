# REVIEW Skill

## 1. Purpose

The REVIEW Skill is the final quality gate of the development workflow.

Its purpose is to review an implemented and tested change against:

- `AGENTS.md`
- approved SPEC
- approved PLAN
- approved TASK
- acceptance criteria
- project architecture
- security requirements
- testing evidence
- documentation requirements
- `docs/FEATURE_STATUS.md`

The goal is to determine whether the implementation is:

- complete
- correct
- within approved scope
- consistent with project architecture
- secure
- maintainable
- sufficiently tested
- ready to be accepted

The REVIEW stage answers:

> Is this implementation ready to be accepted?

REVIEW is a quality-control stage, not a new implementation stage.

---

# 2. When to Use

Use the REVIEW Skill after the TEST stage when:

- a feature has been implemented
- relevant tests have been executed
- a bug fix has been completed
- a database/API change has been implemented
- a multi-layer change has been completed
- a significant refactor has been performed
- a release-ready change needs final verification

Do not use REVIEW as a replacement for:

- SPEC
- PLAN
- TASK
- IMPLEMENT
- TEST

If the implementation is not ready for review, return to the appropriate previous stage.

---

# 3. Core Principles

## 3.1 Review Against Approved Requirements

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

Do not approve a change only because:

the application starts
the feature appears to work
tests pass

The implementation must also satisfy the approved requirements and project constraints.

3.2 Evidence-Based Review

Important review conclusions should be supported by evidence from:

changed files
implementation code
tests
test results
API behavior
database schema or migration
configuration
documentation
git diff when available
FEATURE_STATUS.md

Do not claim that something is correct without sufficient evidence.

If evidence is unavailable, use:

NOT VERIFIED

rather than assuming correctness.

3.3 Review the Change, Not the Entire Repository

Do not inspect the entire repository by default.

Prioritize:

changed files
directly related files
related tests
relevant architecture/documentation
affected dependencies

Inspect additional files only when necessary to verify behavior, architecture, or regression risk.

3.4 Scope Discipline

The implementation must remain within the approved scope.

Check for:

unrelated features
unnecessary refactors
unnecessary dependencies
architectural changes not approved
database changes not included in the PLAN
API changes not included in the PLAN
UI changes unrelated to the TASK
behavior changes affecting existing features

Compare:

Approved Scope
      ↓
Actual Changes

If significant out-of-scope work is found, do not silently accept it.

3.5 Minimal and Maintainable Changes

Prefer implementation that is:

simple
understandable
consistent with existing patterns
easy to test
easy to maintain
appropriately separated by responsibility

Avoid approving complexity that does not provide meaningful value.

Do not demand stylistic perfection when it does not affect correctness, security, maintainability, or project consistency.

3.6 Do Not Invent Requirements

Review must not introduce requirements that were not approved.

Do not reject an implementation merely because it lacks:

an unrequested feature
an unapproved technology
an optional optimization
an unrelated refactor
a personal stylistic preference

If a new requirement is genuinely necessary, return to SPEC.

4. Required Context

Before starting a review, read:

AGENTS.md
relevant project documentation
docs/FEATURE_STATUS.md
approved SPEC
approved PLAN
approved TASK
relevant implementation files
relevant tests
TEST report or test results
relevant git diff when available

Do not assume that the implementation matches the plan.

Verify it.

5. Feature Status Review

Before reviewing the implementation, check:

docs/FEATURE_STATUS.md

Relevant statuses include:

TODO
IN_PROGRESS
DONE
BLOCKED

Apply the following rules:

TODO

Verify whether the current TASK actually represents the approved implementation scope.

Do not reject missing functionality that is explicitly outside the current TASK.

IN_PROGRESS

Review the current implementation against the current TASK.

Do not assume the entire feature is complete if only part of the feature is being implemented.

DONE

If the current change is a bug fix, enhancement, or modification, review only the relevant changed behavior and regression impact.

Do not rebuild the feature unnecessarily.

BLOCKED

Determine the blocker before attempting final approval.

A blocked feature must not be approved while a critical dependency, requirement, or verification remains unresolved.

If FEATURE_STATUS.md conflicts with the actual implementation or test evidence, report the mismatch.

Do not silently overwrite the status.

6. REVIEW Workflow

Follow this process:

TEST Completed
      ↓
Check Feature Status
      ↓
Read Approved Context
      ↓
Inspect Actual Changes
      ↓
Compare Expected vs Actual
      ↓
Trace Requirements
      ↓
Review Architecture
      ↓
Review Database / API / Frontend
      ↓
Review Business Logic
      ↓
Review Security
      ↓
Review Test Evidence
      ↓
Review Regression Risk
      ↓
Review Documentation
      ↓
Classify Findings
      ↓
Determine Verdict
      ↓
Update Feature Status if APPROVED
7. Step 1 — Read the Approved Context

Understand:

feature objective
actors
scope
user flow
business rules
acceptance criteria
affected layers
expected API behavior
expected database changes
expected frontend behavior
testing requirements
documentation impact

If the requirement itself is unclear or contradictory:

REVIEW
  ↓
Requirement Issue
  ↓
SPEC / PLAN

Do not resolve business requirements silently during REVIEW.

8. Step 2 — Inspect the Actual Changes

Review:

changed files
created files
deleted files
modified configuration
database schema changes
migrations
API changes
frontend changes
tests

When git diff is available, use it to understand the actual change boundary.

Determine:

Expected Changes
       vs
Actual Changes

Look for:

missing expected changes
unexpected changes
unnecessary files
accidental modifications
unrelated refactors
unapproved dependencies
unapproved architecture changes
9. Step 3 — Trace Requirements to Implementation

For every important acceptance criterion, determine whether the implementation satisfies it.

Example:

AC-01
  ↓
Implementation
  ↓
API / UI behavior
  ↓
Test evidence
  ↓
PASS

A requirement should not be considered complete only because related code exists.

Verify actual behavior and supporting evidence.

Classify each important criterion as:

PASS
FAIL
PARTIAL
NOT VERIFIED
10. Requirement Completeness Review

Check whether:

every acceptance criterion is implemented
every required business rule is enforced
required validation exists
required error behavior exists
required authorization exists
required UI states exist
required database behavior exists
required tests exist or have valid verification evidence
no required behavior was accidentally omitted

Do not require unrelated functionality.

Review only the current feature and relevant regression scope.

11. Architecture Review
11.1 Backend

Verify that implementation follows the approved architecture:

Request
→ Route
→ Middleware
→ Controller
→ Service
→ Repository / Data Access
→ Prisma
→ PostgreSQL

Check that:

routes remain responsible for routing
middleware handles cross-cutting concerns such as authentication/authorization
controllers handle request/response concerns
services contain business logic
repositories/data-access code handles database access
Prisma is not unnecessarily exposed across unrelated layers
business logic is not duplicated across controllers
database access is not unnecessarily placed inside controllers

Do not require a new layer if the existing project architecture does not need it.

11.2 Frontend

Verify the approved frontend architecture:

Page
→ Component
→ Hook / State
→ Service
→ Backend API

Check that:

existing components are reused when appropriate
API communication follows existing service patterns
business-critical decisions are not incorrectly duplicated on the frontend
loading states are handled
error states are handled
empty states are handled when relevant
success states are handled
unnecessary component duplication is avoided

Do not reject implementation solely because it uses a different internal component structure when that structure remains consistent with the approved architecture and project conventions.

12. Database Review

Only perform this section when the change affects the database.

Verify:

schema matches the approved PLAN
relationships are correct
foreign keys are appropriate
ownership rules are represented correctly
required constraints exist
nullable/non-nullable fields are intentional
uniqueness constraints are intentional
indexes are justified
migrations are safe and consistent
existing data is not unnecessarily put at risk
database behavior matches business rules

Do not approve undocumented database changes when documentation is required by the project.

For potentially destructive changes, require appropriate migration and verification evidence.

13. API Review

Only perform this section when the change affects APIs.

Verify:

endpoint path
HTTP method
authentication requirements
authorization requirements
request validation
request structure
response structure
status codes
error handling
ownership checks
business-rule enforcement

Check that frontend expectations match the actual backend contract.

The backend remains the source of truth for critical business behavior.

Do not silently accept an API contract change that was not approved in the PLAN.

14. Business Logic Review

Review business-critical logic that is actually affected by the current change.

Potential areas include:

quiz correctness
score calculation
XP calculation
level progression
streak behavior
achievement conditions
vocabulary ownership
vocabulary set permissions
community sharing behavior
copy behavior
pronunciation-related rules
authentication and authorization rules

Do not automatically review every business area for every feature.

Only inspect unrelated business logic when the current change could affect it.

The frontend must not be trusted as the final authority for critical business rules.

15. Security Review

Check for:

authentication bypass
authorization bypass
missing ownership checks
insecure direct object access
trusting user-controlled identifiers
missing input validation
unsafe database queries
sensitive information in API responses
secrets committed to source control
API keys exposed to the frontend
unsafe external-service integration
inappropriate logging of sensitive information
insecure error messages

For external services:

Frontend
   ↓
Backend
   ↓
External Service

Sensitive credentials must remain server-side.

Do not approve exposed secrets or security-critical bypasses.

16. Authentication and Authorization Review

When authentication or authorization is affected, verify:

protected routes require authentication
public routes remain accessible where intended
user-only resources require the correct user
admin-only operations require ADMIN
users cannot modify resources they do not own
copying another user's vocabulary set does not grant ownership of the original
community sharing does not unexpectedly change vocabulary-set ownership or visibility

Current project roles:

USER
ADMIN

Do not introduce additional roles without explicit approval.

17. Quiz Review

Only apply this section when quiz functionality is affected.

Verify:

answer validation occurs on the backend where required
case-sensitivity behavior matches the specification
missing-letter behavior matches the specification
character-position feedback is consistent with approved behavior
score behavior is deterministic
XP behavior is correct
invalid submissions are handled safely
repeated submissions do not create unintended rewards

Do not approve quiz logic based only on frontend behavior.

18. Gamification Review

Only apply this section when gamification functionality is affected.

Verify:

XP cannot be arbitrarily manipulated by the client
level calculation is consistent
streak rules match the specification
achievements are granted only when conditions are satisfied
duplicate achievement rewards are prevented where required
edge cases around repeated actions are handled
critical calculations occur on the backend

Do not add:

leaderboard
ranking
XP transaction history
unrelated gamification systems

unless explicitly approved.

19. Vocabulary Set Review

Only apply this section when vocabulary-set behavior is affected.

System/Admin Sets

Verify:

admin/system-created sets behave according to the specification
public visibility is correct
ownership rules are respected
User-Created Sets

Verify:

users can modify only their own sets
private sets remain private unless explicitly shared
sharing does not unexpectedly mutate is_public
Copying

When a user copies another user's set:

Original Set
      ↓
    Copy
      ↓
New Set owned by Copier

The copier must not receive edit permissions over the original set.

20. Community Review

Only apply this section when Community functionality is affected.

For Community v1, review only approved features:

Posts
Comments
Vocabulary Set Sharing

Do not require unrelated social features such as:

likes
reactions
followers
friends
direct messaging
chat
leaderboard

unless explicitly approved.

21. AI and External Services Review

AI is optional.

Only review AI when it is actually used or affected.

If AI is used, verify:

it solves an approved requirement
it does not unnecessarily replace deterministic database content
API keys remain server-side
external calls are handled safely
failures are handled gracefully
the application remains usable when the external service fails where required
AI output is not blindly trusted for critical business rules

Do not approve AI simply because it makes the implementation appear more advanced.

Do not introduce a new external service during REVIEW.

22. Test Evidence Review

Review the TEST report and actual test evidence.

Verify:

acceptance criteria have corresponding tests or valid verification evidence
important business rules are tested
validation failures are tested when relevant
authorization is tested when relevant
edge cases are considered
regression tests are considered
build/lint/type checks are considered where applicable
database changes are verified where applicable
external-service behavior is considered when relevant

Distinguish between:

TEST PASS

and:

REVIEW APPROVE

Passing tests do not automatically mean the implementation is approved.

Tests provide evidence.

REVIEW makes the final quality decision.

23. Regression Review

Check whether the change could affect existing functionality.

Consider only areas relevant to the change, such as:

shared services
shared components
authentication
database relations
API contracts
existing quiz behavior
gamification
vocabulary sets
community features

If regression risk is significant, require additional verification before approval.

Do not demand a full repository-wide regression test for every small change.

24. Code Quality Review

Review for:

clear naming
reasonable function size
appropriate separation of responsibility
consistent project conventions
duplicated logic
unnecessary complexity
dead code
unused imports
unnecessary dependencies
unclear abstractions
hard-coded values that should be configurable
maintainability problems

Prioritize:

correctness
security
maintainability
architecture consistency
project conventions

Do not reject a feature merely because of minor stylistic preferences.

25. Documentation Review

Check whether relevant documentation remains accurate.

Potential documentation includes:

PROJECT_OVERVIEW.md
ARCHITECTURE.md
DATABASE.md
API_SPEC.md
UI_UX_SPEC.md
FEATURE_STATUS.md

If implementation changes:

architecture
database structure
API behavior
important business rules
feature status

update the relevant documentation when required.

Do not create unnecessary documentation.

26. Finding Severity

Classify review findings using the following levels.

BLOCKER

A critical problem that prevents safe acceptance.

Examples:

authentication bypass
authorization bypass
exposed secret
critical data corruption risk
implementation fundamentally violates an approved requirement
application cannot perform the core feature

Action:

CHANGES_REQUIRED
HIGH

A significant problem that should be fixed before approval.

Examples:

important business rule is incorrect
ownership check is missing
critical acceptance criterion is incomplete
major API contract mismatch
important regression
significant database inconsistency

Action:

CHANGES_REQUIRED
MEDIUM

A meaningful issue that should normally be fixed but does not necessarily make the feature unusable.

Examples:

incomplete edge-case handling
moderate maintainability problem
missing non-critical test
documentation inconsistency
unnecessary duplication

Action:

Usually fix before final approval.

If explicitly accepted as technical debt, document it.

LOW

A minor improvement or non-critical issue.

Examples:

small naming improvement
minor code cleanup
minor documentation wording
low-risk refactor opportunity

Action:

May be deferred if it does not affect correctness, security, or maintainability.

INFO

An observation or recommendation that does not require a change.

27. Finding Format

Each finding should contain:

Severity:

Location:

Problem:

Why it matters:

Recommended action:

Example:

Severity: HIGH

Location: backend/services/quiz.service.js

Problem: Quiz reward is calculated from a client-provided score.

Why it matters: A client can manipulate the score and receive incorrect XP.

Recommended action: Calculate the score and reward on the backend.

Do not report vague findings such as:

"This could be improved."

Explain the concrete problem and its impact.

28. Review Decision

The review must end with one of these verdicts.

APPROVE

Use when:

requirements are satisfied
implementation is within scope
architecture is respected
security is acceptable
tests provide sufficient evidence
no blocking findings remain
known issues are acceptable for the current scope

APPROVE means:

The implementation is accepted for the current development cycle.

After APPROVE, the feature may be marked DONE in docs/FEATURE_STATUS.md.

CHANGES_REQUIRED

Use when:

implementation needs fixes
important requirements are incomplete
security issues exist
significant architecture problems exist
important tests are missing
scope violations need correction

Return to IMPLEMENT when the issue is an implementation problem.

BLOCKED

Use when review cannot be completed because required information or verification is unavailable.

Examples:

required tests cannot run
environment is unavailable
required database state cannot be verified
approved SPEC or PLAN is missing
requirements contain unresolved conflicts

Do not treat an unverified condition as PASS.

29. Handling Findings

If a finding is an implementation issue:

REVIEW
   ↓
Finding
   ↓
IMPLEMENT
   ↓
TEST
   ↓
REVIEW

If a finding reveals a technical/design problem:

REVIEW
   ↓
Technical / Design Conflict
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

If a finding reveals a business requirement problem:

REVIEW
   ↓
Requirement Conflict
   ↓
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

Do not silently modify approved requirements during REVIEW.

30. Feature Status Update

Only after the verdict is:

APPROVE

may the feature be considered complete for the current development cycle.

Then update:

docs/FEATURE_STATUS.md

from the appropriate previous state to:

DONE

Do not mark a feature as DONE when:

TEST has unresolved critical failures
REVIEW has unresolved BLOCKER/HIGH findings
required verification is still blocked
implementation is incomplete
approved requirements are not satisfied

The status update must reflect the actual project state.

31. Review Output

The Review report should use the following structure:

# REVIEW REPORT: <Feature Name>

## 1. Summary

<Short summary of the review.>

## 2. Feature Status

- Before Review: TODO / IN_PROGRESS / DONE / BLOCKED
- Review Result: ...
- Final Status: ...

## 3. Scope Reviewed

<What was reviewed and what was intentionally excluded.>

## 4. Requirement Traceability

| Requirement | Result | Evidence |
|------------|--------|----------|
| AC-01 | PASS | ... |
| AC-02 | PASS | ... |
| AC-03 | PARTIAL | ... |

## 5. Actual vs Expected Changes

### Expected

- ...

### Actual

- ...

### Scope Result

PASS / FAIL

## 6. Architecture Review

### Backend

...

### Frontend

...

## 7. Database Review

PASS / FAIL / NOT APPLICABLE

...

## 8. API Review

PASS / FAIL / NOT APPLICABLE

...

## 9. Business Logic Review

...

## 10. Security Review

...

## 11. Testing Evidence

...

## 12. Regression Review

...

## 13. Documentation Review

...

## 14. Findings

| Severity | Location | Problem | Action |
|----------|----------|---------|--------|
| HIGH | ... | ... | ... |

## 15. Verdict

APPROVE / CHANGES_REQUIRED / BLOCKED

## 16. Recommended Next Action

...
32. Review Checklist

Before finalizing the review, verify:

Requirements
 SPEC was reviewed.
 PLAN was reviewed.
 TASK was reviewed.
 acceptance criteria were checked.
 FEATURE_STATUS.md was checked.
 all important requirements are implemented.
 no new requirements were invented during review.
Scope
 expected changes are present.
 no significant unrelated changes exist.
 no unapproved features exist.
 no unnecessary refactor exists.
 no unnecessary dependency exists.
 no unapproved architecture change exists.
Architecture
 backend architecture is respected.
 frontend architecture is respected.
 responsibilities are correctly separated.
 existing patterns are reused where appropriate.
Database
 schema is correct when applicable.
 relations are correct when applicable.
 ownership is correct when applicable.
 constraints are correct when applicable.
 migrations are verified when applicable.
API
 authentication is correct when applicable.
 authorization is correct when applicable.
 validation is correct when applicable.
 request/response contract is correct.
 error handling is correct.
Security
 no authentication bypass.
 no authorization bypass.
 ownership checks exist where required.
 no secrets are exposed.
 external-service credentials remain server-side.
 sensitive information is not unnecessarily exposed.
Business Logic
 affected quiz behavior is correct.
 affected score behavior is correct.
 affected XP behavior is correct.
 affected level behavior is correct.
 affected streak behavior is correct.
 affected achievement behavior is correct.
 affected vocabulary ownership is correct.
 affected community behavior is within scope.
Testing
 TEST report was reviewed.
 acceptance criteria have evidence.
 important business rules are tested.
 validation is tested when relevant.
 authorization is tested when relevant.
 edge cases are considered.
 regression is considered.
 test results are truthful.
Documentation
 affected documentation is updated when required.
 no important project information is outdated.
 FEATURE_STATUS.md reflects the actual state.
Final Decision
 all findings are classified.
 no blocker remains for APPROVE.
 verdict is explicit.
 next action is explicit.
 feature status is updated only after APPROVE.
33. Prohibited Actions

The REVIEW Skill must not:

rewrite requirements during review
silently change the SPEC
silently change the PLAN
add new features
expand project scope
perform unrelated refactoring
approve unverified behavior
claim tests passed without evidence
ignore security issues
ignore authorization issues
ignore ownership issues
approve exposed secrets
require unnecessary technologies
introduce unnecessary dependencies
judge quality only by code style
replace testing with subjective inspection
directly fix production code
mark a feature DONE before final approval
bypass SPEC → PLAN → TASK → IMPLEMENT → TEST when a material change is required

If implementation changes are required, return the work to IMPLEMENT.

34. Completion Criteria

REVIEW is complete when:

approved requirements have been checked
actual changes have been inspected
expected vs actual scope has been compared
architecture has been reviewed
security has been reviewed
relevant business logic has been reviewed
database/API/frontend changes have been reviewed where applicable
test evidence has been reviewed
regression risk has been considered
documentation impact has been checked
findings have been classified
a clear verdict has been given
the next action is explicit
FEATURE_STATUS.md has been updated appropriately when the verdict is APPROVE

The REVIEW stage must always end with:

APPROVE

or:

CHANGES_REQUIRED

or:

BLOCKED
35. Workflow Completion

When REVIEW returns:

APPROVE

the feature can be considered complete for the current development cycle.

The overall workflow is:

FEATURE_STATUS
      ↓
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
      ↓
FEATURE_STATUS = DONE

If problems are found:

REVIEW
   ↓
IMPLEMENT
   ↓
TEST
   ↓
REVIEW

If technical/design decisions must change:

REVIEW
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

If business requirements must change:

REVIEW
   ↓
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

Never bypass the workflow merely to finish a feature faster.
```
