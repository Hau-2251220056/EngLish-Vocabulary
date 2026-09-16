# TEST Skill

## Purpose

This Skill defines how to systematically verify that an implemented change works correctly and satisfies the approved SPEC, PLAN, TASK, and acceptance criteria.

The goal is to detect functional errors, regressions, security issues, and incomplete implementation before the change moves to the REVIEW stage.

The TEST stage answers:

> Does the implementation behave correctly according to the approved requirements?

The TEST stage does not approve code quality, architecture quality, or overall project quality. Those responsibilities belong to the REVIEW stage.

**This Skill does not redesign, implement, or silently fix features. If testing reveals a problem, return to the appropriate previous stage.**

---

# When to Use

Use this Skill when:

- An implementation task has been completed.
- The user asks to test or verify a feature.
- A feature needs regression testing.
- An implementation needs validation against its acceptance criteria.
- The project is preparing for review.
- A bug fix needs verification.

Do not use this Skill to:

- Define new requirements.
- Expand feature scope.
- Perform unrelated refactoring.
- Silently fix implementation problems.
- Redesign the feature.
- Introduce unnecessary testing infrastructure.
- Approve overall code quality.

If testing reveals an implementation problem, report it and return to the `IMPLEMENT` stage.

If testing reveals an unclear requirement or technical decision, return to `SPEC` or `PLAN` as appropriate.

---

# Core Principles

## 1. Test Against Approved Requirements

Tests must be based on:

- Approved SPEC.
- Approved PLAN.
- Approved TASK.
- TASK acceptance criteria.
- Existing project behavior where relevant.
- `docs/FEATURE_STATUS.md`.

Do not test only whether the code runs.

The primary question is:

> Does the implementation behave as required?

Do not invent new requirements during testing.

---

## 2. Check Feature Status Before Testing

Before testing, inspect:

```text
docs/FEATURE_STATUS.md

Relevant statuses include:

TODO
IN_PROGRESS
DONE
BLOCKED

Apply the following rules:

TODO

The feature may not have a complete implementation.

Verify whether the current TASK actually contains an approved implementation scope.

Do not treat missing functionality as a test failure if it is explicitly outside the current TASK.

IN_PROGRESS

Test the current implementation against the approved TASK.

Do not assume unfinished areas are bugs unless they are required by the current TASK.

DONE

Do not rebuild or retest the entire feature unnecessarily.

If the current task is a bug fix, enhancement, or modification, test the changed behavior and relevant regression areas.

BLOCKED

Identify the blocker before attempting normal verification.

Do not mark the feature as passing while a required dependency or decision remains blocked.

If FEATURE_STATUS.md conflicts with the actual implementation or tests, report the mismatch instead of making assumptions.

3. Test Behavior, Not Implementation Details

Prefer testing observable behavior.

For example:

User submits valid vocabulary set
        ↓
API succeeds
        ↓
Vocabulary set exists
        ↓
Expected response is returned

rather than testing private implementation details that users cannot observe.

Implementation details may be tested when they represent important isolated business logic, security behavior, or technical constraints.

4. Test the Important Failure Cases

Do not test only the happy path.

When relevant, test:

Invalid input.
Missing required fields.
Unauthorized access.
Forbidden access.
Resource not found.
Duplicate data.
Business-rule violations.
Invalid state transitions.
Database constraint failures.
External service failures.
Unexpected or malformed requests.

Only test cases relevant to the feature and approved scope.

5. Do Not Test Beyond the Approved Scope

Testing must remain aligned with the approved SPEC, PLAN, and TASK.

Do not introduce unrelated test scenarios merely because they are technically possible.

For example:

If the current TASK implements:

VI_TO_ENGLISH quiz

do not require:

MISSING_LETTER quiz
Pronunciation Practice
Community
Achievement

unless those behaviors are affected by the current change or are explicitly included in the approved regression scope.

Testing should be thorough but proportional.

6. Do Not Claim Untested Results

Never report:

PASS

unless the test or verification was actually executed.

Use:

PASS
FAIL
NOT RUN
BLOCKED
NOT APPLICABLE

when appropriate.

Never claim:

Tests passed when they were not run.
Build passed when it was not executed.
Database verification passed when it was not checked.
An acceptance criterion passed based only on code inspection when execution was required.
7. Reuse Existing Testing Infrastructure

Prefer existing:

Test framework.
Test scripts.
Test utilities.
Fixtures.
Factories.
Mocks.
Test database.
Authentication helpers.
API helpers.
Frontend testing utilities.

Do not introduce a new testing framework or infrastructure unless the feature genuinely requires it and the decision is approved in the PLAN.

TEST Workflow

Follow this process:

Approved TASK / Implementation
        ↓
Check Feature Status
        ↓
Read SPEC + PLAN + TASK
        ↓
Inspect Existing Implementation
        ↓
Identify Acceptance Criteria
        ↓
Inspect Existing Tests
        ↓
Define Test Coverage
        ↓
Run / Add Relevant Tests
        ↓
Run Validation
        ↓
Check Regression
        ↓
Analyze Failures
        ↓
Re-test After Fixes
        ↓
Produce Test Report
        ↓
REVIEW
Step 1 — Check Project Context

Before testing, review the relevant project context:

AGENTS.md
Relevant documentation.
docs/FEATURE_STATUS.md
Approved SPEC.
Approved PLAN.
Relevant TASK.
Relevant implementation.
Existing tests.

Do not read the entire repository unless necessary.

Focus on the affected feature and its dependencies.

Step 2 — Read the Requirements

Review:

Feature objective.
Actors.
Scope.
User flow.
Business rules.
Data requirements.
API requirements.
Acceptance criteria.
Edge cases.
Security requirements.
Dependencies.

The TASK acceptance criteria are the primary verification target for the current implementation task.

If the TASK conflicts with the approved SPEC or PLAN, do not silently choose one.

Report the conflict and return to the appropriate planning stage.

Step 3 — Inspect Existing Implementation

Before designing tests, inspect the current implementation.

Determine:

What was changed.
What existing functionality was reused.
What modules are affected.
What APIs are affected.
What database behavior is affected.
What frontend behavior is affected.
What existing tests already cover.

Do not assume the implementation matches the TASK.

Verify it.

Step 4 — Build a Test Matrix

Map acceptance criteria to verification.

Example:

AC-01 → Create vocabulary set with valid data

AC-02 → Reject unauthenticated request

AC-03 → Reject modification of another user's set

AC-04 → Reject invalid input

Then determine how each criterion will be tested.

Example:

Criterion	Test Type	Expected
AC-01	Integration	201 Created
AC-02	API	401 Unauthorized
AC-03	API	403 Forbidden
AC-04	Validation	400 Bad Request

Every important acceptance criterion should have a verification path.

If an acceptance criterion cannot currently be tested, report:

NOT RUN

or:

BLOCKED

with an explanation.

Step 5 — Inspect Existing Tests

Before creating tests, search for existing:

Test files.
Test utilities.
Fixtures.
Factories.
Mocks.
Test database setup.
Authentication helpers.
API test helpers.
Component test utilities.

Reuse existing testing infrastructure.

Do not create duplicate test utilities without a reason.

Step 6 — Determine Test Scope

Choose the appropriate test types.

Possible levels:

Unit Tests

Use when isolated business logic can be tested independently.

Examples:

Quiz answer evaluation.
XP calculation.
Level calculation.
Streak calculation.
Validation logic.
Character-position comparison.
Integration Tests

Use when multiple modules interact.

Examples:

Service + repository.
Database operations.
Authentication + authorization.
Business logic + persistence.
API Tests

Use when verifying endpoint behavior.

Examples:

Request validation.
Authentication.
Authorization.
Response status.
Response body.
Error responses.
Frontend Tests

Use when verifying:

User interactions.
Component behavior.
Form validation.
Loading states.
Error states.
Success states.
UI state transitions.
End-to-End Tests

Use only when:

The project already supports E2E testing, or
The feature genuinely requires full user-flow verification.

Do not introduce an E2E framework solely for a small feature without justification and approval.

Step 7 — Test Happy Paths

Verify normal successful behavior.

Example:

Given:

- authenticated USER
- valid vocabulary set data

When:

- USER creates the set

Then:

- request succeeds
- set is persisted
- response contains expected data

Happy-path tests should cover the core functionality.

Step 8 — Test Validation

When relevant, verify:

Missing fields.
Empty values.
Invalid types.
Invalid formats.
Values outside allowed ranges.
Excessively long values.
Invalid identifiers.
Duplicate values.

Do not create arbitrary validation rules that are not part of the approved requirements.

Step 9 — Test Authentication and Authorization

For protected functionality, verify:

Authentication
No authentication
        ↓
Request rejected
Authorization
Authenticated user
        ↓
Correct permission?
        ↓
YES → allowed
NO  → rejected

For ownership-based resources, verify:

Owner can access the resource.
Non-owner cannot perform protected actions.
Admin behavior matches the approved rules.

Authorization must be verified at the backend.

Frontend restrictions alone are not sufficient.

Step 10 — Test Business Rules

Business-critical rules must be explicitly tested.

Examples relevant to this project:

Quiz
Correct answer.
Incorrect answer.
Missing-letter answer.
Character-position comparison when applicable.
Score calculation.
Quiz completion behavior.
Vocabulary Sets
Ownership.
Public/private behavior.
Copy behavior.
Edit permissions.
Delete permissions.
Gamification
XP calculation.
Level progression.
Streak rules.
Achievement conditions.
Community
Post creation.
Comment permissions.
Vocabulary set sharing rules.

Only test features that are actually part of the current implementation or affected regression scope.

Step 11 — Test Edge Cases

Identify realistic edge cases based on the SPEC and TASK.

Examples:

Empty collections.
First-time user.
Last remaining item.
Duplicate records.
Deleted related resource.
Boundary values.
Invalid state.
Repeated requests when relevant.
Concurrent requests when relevant.

Do not generate large numbers of theoretical edge cases without practical value.

Prioritize cases that could realistically cause incorrect behavior.

Step 12 — Test Error Handling

Verify that expected failures:

Return the correct status.
Return the expected error format.
Do not expose sensitive information.
Do not leave inconsistent database state.
Do not crash the application.
Follow existing project error-handling conventions.

Check both backend and frontend behavior when relevant.

Step 13 — Regression Testing

Identify existing functionality that could be affected by the change.

Run relevant existing tests.

Regression testing should be proportional to the scope of the change.

Example:

Changed:

Vocabulary Set

Potentially affected:

- Vocabulary learning
- Community sharing
- User ownership
- Admin management

For a major cross-cutting change, run the broader test suite.

For a localized change, a targeted regression suite may be sufficient.

Do not run every possible test blindly when targeted verification provides sufficient confidence.

Step 14 — Static and Build Verification

When appropriate, run:

Lint.
Type checking.
Build.
Database schema validation.
Migration verification.

Follow the commands and tooling already defined by the project.

Do not invent new verification tooling unless necessary and approved.

If a check is not applicable to the project, report:

NOT APPLICABLE

rather than:

NOT RUN
Step 15 — Database Verification

When database changes are involved, verify:

Schema is valid.
Migration succeeds.
Required constraints work.
Relationships behave correctly.
Existing functionality remains compatible.
Required data is persisted correctly.
Invalid data is rejected appropriately.

For destructive or potentially data-loss operations, verify carefully before considering the task complete.

Never modify production data merely for testing convenience.

Step 16 — External Services

If the feature depends on an external service:

Verify configuration safely.
Test successful interaction when possible.
Test expected failure behavior.
Do not expose credentials.
Do not commit secrets.
Do not make unnecessary real external requests during automated tests.

Prefer:

Mocks.
Stubs.
Test environments.
Existing project test utilities.

Follow the external-service strategy approved in the PLAN.

Do not introduce a new external service during TEST.

Step 17 — Analyze Failures

If a test fails:

Identify the failing test or verification.
Identify the related acceptance criterion.
Determine whether the problem is:
Implementation bug.
Test bug.
Environment issue.
Existing regression.
Incorrect assumption.
Requirement/design issue.
Report the evidence.
Do not hide or ignore the failure.

If the implementation is incorrect:

TEST
 ↓
FAIL
 ↓
IMPLEMENT
 ↓
Fix
 ↓
TEST again

If the failure reveals an unclear requirement or design decision:

TEST
 ↓
BLOCKED / REQUIREMENT ISSUE
 ↓
SPEC or PLAN

Do not silently change requirements to make tests pass.

Step 18 — Re-run After Fixes

After an implementation fix:

Re-run the failing test.
Re-run relevant tests.
Re-run relevant regression tests.
Re-run lint/build if affected.
Verify that the fix did not introduce another regression.

Do not stop after confirming only the originally failing test.

If the fix materially changes the implementation approach or scope, return to PLAN before continuing.

Step 19 — Determine TEST Result

Use the following interpretation:

PASS

Use when:

Relevant acceptance criteria were verified.
Required tests were executed.
No critical failures remain.
Relevant regression checks passed.
There are no known blockers affecting the tested scope.

PASS means:

The tested implementation satisfies the verified requirements.

It does not mean:

The code has been fully reviewed or approved.

That decision belongs to REVIEW.

FAIL

Use when:

A required acceptance criterion fails.
A critical functional problem remains.
A relevant regression fails.
Required verification exposes incorrect behavior.

Return to IMPLEMENT when the issue is an implementation problem.

BLOCKED

Use when:

Required verification cannot be performed because of an environment/dependency issue.
A required requirement or technical decision is unresolved.
Necessary test infrastructure is unavailable and cannot reasonably be bypassed.

Explain the blocker clearly.

Test Output Format

Use the following structure:

# TEST REPORT: <Feature Name>

## 1. Scope

<What was tested.>

## 2. Feature Status

- Before TEST: TODO / IN_PROGRESS / DONE / BLOCKED
- Current status: ...

## 3. Environment

- Backend: ...
- Frontend: ...
- Database: ...
- Test environment: ...

## 4. Acceptance Criteria

| Criterion | Result | Evidence |
|---|---|---|
| AC-01 | PASS | ... |
| AC-02 | PASS | ... |
| AC-03 | FAIL | ... |

## 5. Test Coverage

### Happy Path

- ...

### Validation

- ...

### Authentication / Authorization

- ...

### Business Rules

- ...

### Edge Cases

- ...

### Error Handling

- ...

### Regression

- ...

## 6. Automated Verification

- Unit tests: PASS / FAIL / NOT RUN / NOT APPLICABLE
- Integration tests: PASS / FAIL / NOT RUN / NOT APPLICABLE
- API tests: PASS / FAIL / NOT RUN / NOT APPLICABLE
- Frontend tests: PASS / FAIL / NOT RUN / NOT APPLICABLE
- E2E tests: PASS / FAIL / NOT RUN / NOT APPLICABLE
- Lint: PASS / FAIL / NOT RUN / NOT APPLICABLE
- Type check: PASS / FAIL / NOT RUN / NOT APPLICABLE
- Build: PASS / FAIL / NOT RUN / NOT APPLICABLE
- Database verification: PASS / FAIL / NOT RUN / NOT APPLICABLE

## 7. Failures

- None

or

- <Failure description>
- <Related requirement>
- <Evidence>
- <Likely cause>
- <Required next stage>

## 8. Regression Result

PASS / FAIL / BLOCKED

## 9. Final Result

PASS / FAIL / BLOCKED

## 10. Notes

- ...

## 11. Next Stage

REVIEW / IMPLEMENT / SPEC / PLAN
Test Quality Checklist

Before completing the TEST stage, verify:

Requirements
 SPEC was reviewed.
 PLAN was reviewed.
 TASK acceptance criteria were reviewed.
 FEATURE_STATUS.md was checked.
 Important acceptance criteria have verification.
 Testing stayed within approved scope.
Functional Testing
 Happy path tested.
 Relevant validation tested.
 Relevant business rules tested.
 Relevant edge cases tested.
 Relevant error cases tested.
Security
 Authentication tested when required.
 Authorization tested when required.
 Ownership rules tested when required.
 Sensitive information is not exposed.
Regression
 Relevant existing tests were run.
 Potentially affected behavior was checked.
 Regression scope was proportional to the change.
Technical Verification
 Relevant automated tests were run.
 Lint checked when applicable.
 Build checked when applicable.
 Database/migration checked when applicable.
 External service behavior checked when applicable.
Reporting
 Results are truthful.
 Failures are documented.
 Evidence is provided.
 No unexecuted test is reported as PASS.
 TEST result is separated from REVIEW approval.
What TEST Must Not Do

The TEST stage must not:

Change requirements to make tests pass.
Hide failures.
Mark unexecuted tests as PASS.
Add unrelated features.
Perform unrelated refactoring.
Modify production data for convenience.
Ignore authorization failures.
Ignore regression failures.
Introduce unnecessary testing infrastructure.
Silently modify the SPEC.
Silently modify the PLAN.
Silently expand TASK scope.
Redesign the feature.
Approve code quality or architecture quality.
Fix production code directly as part of testing.

If a code change is required to fix a failure, return to the IMPLEMENT stage.

If a technical approach must change materially, return to PLAN.

If a business requirement must change, return to SPEC.

Completion Criteria

Testing is complete when:

Relevant acceptance criteria have been verified.
Important functional behavior has been tested.
Relevant security and authorization behavior has been tested.
Relevant regression checks have been completed.
Automated verification has been executed where applicable.
Failures have been resolved or clearly reported.
No verification result is falsely reported as passing.
The final TEST result is clearly reported.

A feature with unresolved critical test failures must not be reported as fully passing.

A PASS result means the tested behavior is verified. It does not mean the implementation is fully approved.

Transition to REVIEW

After testing is complete:

Produce the TEST REPORT.
Clearly identify PASS, FAIL, or BLOCKED status.
Identify unresolved issues.
Identify any verification that was not run.
Do not declare the overall implementation approved solely because tests pass.
Do not modify implementation code during the TEST stage.
Proceed to the REVIEW Skill for final quality and scope review.

The next Skill is:

review/SKILL.md
```
