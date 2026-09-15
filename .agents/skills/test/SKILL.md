# TEST Skill

## Purpose

This Skill defines how to systematically verify that an implemented change works correctly and satisfies the approved SPEC, PLAN, TASK, and acceptance criteria.

The goal is to detect functional errors, regressions, security issues, and incomplete implementation before the change is considered ready for review.

**This Skill does not redesign or implement features unless a test reveals a problem that must be returned to the implementation stage.**

---

# When to Use

Use this Skill when:

* An implementation task has been completed.
* The user asks to test or verify a feature.
* A feature needs regression testing.
* An implementation needs validation against its acceptance criteria.
* The project is preparing for review.

Do not use this Skill to:

* Define new requirements.
* Expand feature scope.
* Perform unrelated refactoring.
* Silently fix significant implementation problems.

If testing reveals a significant issue, report it and return to the IMPLEMENT stage.

---

# Core Principles

## 1. Test Against Requirements

Tests must be based on:

* Approved SPEC.
* Approved PLAN.
* TASK acceptance criteria.
* Existing project behavior.

Do not test only whether the code runs.

The primary question is:

> Does the implementation behave as required?

---

## 2. Test Behavior, Not Implementation Details

Prefer testing observable behavior.

For example:

```text id="uj2q1w"
User submits valid vocabulary set
        ↓
API succeeds
        ↓
Vocabulary set exists
        ↓
Expected response is returned
```

rather than testing private implementation details that users cannot observe.

---

## 3. Test the Important Failure Cases

Do not test only the happy path.

When relevant, test:

* Invalid input.
* Missing required fields.
* Unauthorized access.
* Forbidden access.
* Resource not found.
* Duplicate data.
* Business-rule violations.
* Invalid state transitions.
* Database constraint failures.
* External service failures.

Only test cases relevant to the feature.

---

## 4. Do Not Claim Untested Results

Never report:

```text
PASS
```

unless the test or verification was actually executed.

Use:

```text
PASS
FAIL
NOT RUN
BLOCKED
```

when reporting results.

---

# TEST Workflow

Follow this process:

```text id="z7k5wq"
Approved TASK / Implementation
          ↓
Read SPEC + PLAN + TASK
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
Produce Test Report
```

---

# Step 1 — Read the Requirements

Before testing, review:

1. `AGENTS.md`
2. Approved SPEC.
3. Approved PLAN.
4. Relevant TASK.
5. Acceptance criteria.
6. Relevant implementation.
7. Existing tests.

Do not read the entire repository unless necessary.

---

# Step 2 — Build a Test Matrix

Map acceptance criteria to verification.

Example:

```text id="b7r6xq"
AC-01 → Create vocabulary set with valid data
AC-02 → Reject unauthenticated request
AC-03 → Reject modification of another user's set
AC-04 → Reject invalid input
```

Then determine how each criterion will be tested.

Example:

| Criterion | Test Type   | Expected         |
| --------- | ----------- | ---------------- |
| AC-01     | Integration | 201 Created      |
| AC-02     | Integration | 401 Unauthorized |
| AC-03     | Integration | 403 Forbidden    |
| AC-04     | Validation  | 400 Bad Request  |

Every important acceptance criterion should have a verification path.

---

# Step 3 — Inspect Existing Tests

Before creating tests, search for existing:

* Test files.
* Test utilities.
* Fixtures.
* Factories.
* Mocks.
* Test database setup.
* Authentication helpers.
* API test helpers.
* Component test utilities.

Reuse existing testing infrastructure.

Do not create duplicate test utilities without a reason.

---

# Step 4 — Determine Test Scope

Choose the appropriate test types.

Possible levels:

### Unit Tests

Use when isolated business logic can be tested independently.

Examples:

* Quiz answer evaluation.
* XP calculation.
* Level calculation.
* Streak calculation.
* Validation logic.

### Integration Tests

Use when multiple modules interact.

Examples:

* Service + repository.
* Database operations.
* Authentication + authorization.

### API Tests

Use when verifying endpoint behavior.

Examples:

* Request validation.
* Authentication.
* Authorization.
* Response status.
* Response body.

### Frontend Tests

Use when verifying:

* User interactions.
* Component behavior.
* Form validation.
* Loading states.
* Error states.
* Success states.

### End-to-End Tests

Use only when the project already supports them or the feature genuinely requires full user-flow verification.

Do not introduce an E2E framework solely for a small feature without justification.

---

# Step 5 — Test Happy Paths

Verify normal successful behavior.

Example:

```text id="8f9x5p"
Given:
- authenticated USER
- valid vocabulary set data

When:
- USER creates the set

Then:
- request succeeds
- set is persisted
- response contains expected data
```

Happy-path tests should cover the core functionality.

---

# Step 6 — Test Validation

When relevant, verify:

* Missing fields.
* Empty values.
* Invalid types.
* Invalid formats.
* Values outside allowed ranges.
* Excessively long values.
* Invalid identifiers.
* Duplicate values.

Do not create arbitrary validation rules that are not part of the approved requirements.

---

# Step 7 — Test Authentication and Authorization

For protected functionality, verify:

### Authentication

```text
No authentication
    ↓
Request rejected
```

### Authorization

```text
Authenticated user
      ↓
Correct permission?
      ↓
YES → allowed
NO  → rejected
```

For ownership-based resources, verify:

* Owner can access the resource.
* Non-owner cannot perform protected actions.
* Admin behavior matches the approved rules.

Authorization must be verified at the backend.

---

# Step 8 — Test Business Rules

Business-critical rules must be explicitly tested.

Examples relevant to this project:

### Quiz

* Correct answer.
* Incorrect answer.
* Missing-letter answer.
* Character-position comparison when applicable.
* Score calculation.

### Vocabulary Sets

* Ownership.
* Public/private behavior.
* Copy behavior.
* Edit permissions.
* Delete permissions.

### Gamification

* XP calculation.
* Level progression.
* Streak rules.
* Achievement conditions.

### Community

* Post creation.
* Comment permissions.
* Vocabulary set sharing rules.

Only test features that are actually part of the current implementation.

---

# Step 9 — Test Edge Cases

Identify realistic edge cases based on the SPEC.

Examples:

* Empty collections.
* First-time user.
* Last remaining item.
* Duplicate records.
* Deleted related resource.
* Boundary values.
* Invalid state.
* Concurrent or repeated requests when relevant.

Do not generate large numbers of theoretical edge cases without practical value.

Prioritize cases that could realistically cause incorrect behavior.

---

# Step 10 — Test Error Handling

Verify that expected failures:

* Return the correct status.
* Return the expected error format.
* Do not expose sensitive information.
* Do not leave inconsistent database state.
* Do not crash the application.

Check that errors are handled consistently with existing project conventions.

---

# Step 11 — Regression Testing

Identify existing functionality that could be affected by the change.

Run relevant existing tests.

Regression testing should be proportional to the scope of the change.

Examples:

```text id="xq0v8e"
Changed:
Vocabulary Set

Potentially affected:
- Vocabulary learning
- Community sharing
- User ownership
- Admin management
```

Do not run every possible test blindly when a targeted regression suite is sufficient.

For major cross-cutting changes, run the broader test suite.

---

# Step 12 — Static and Build Verification

When appropriate, run:

* Lint.
* Type checking.
* Build.
* Database schema validation.
* Migration verification.

Follow the commands and tooling already defined by the project.

Do not invent new verification tooling unless necessary.

---

# Step 13 — Database Verification

When database changes are involved, verify:

* Schema is valid.
* Migration succeeds.
* Required constraints work.
* Relationships behave correctly.
* Existing functionality remains compatible.

For destructive or potentially data-loss operations, verify carefully before considering the task complete.

---

# Step 14 — External Services

If the feature depends on an external service:

* Verify configuration safely.
* Test successful interaction when possible.
* Test expected failure behavior.
* Do not expose credentials.
* Do not commit secrets.
* Do not make unnecessary real external requests during automated tests.

Prefer mocks or test-safe environments when appropriate.

---

# Step 15 — Analyze Failures

If a test fails:

1. Identify the failing requirement.
2. Determine whether the problem is:

   * Implementation bug.
   * Test bug.
   * Environment issue.
   * Existing regression.
   * Incorrect assumption.
3. Report the evidence.
4. Do not hide or ignore the failure.

If the implementation is incorrect:

```text id="v4l5bd"
TEST
 ↓
FAIL
 ↓
IMPLEMENT
 ↓
Fix
 ↓
TEST again
```

If the failure reveals an unclear requirement or design decision:

```text id="f8h2tz"
TEST
 ↓
BLOCKED / REQUIREMENT ISSUE
 ↓
SPEC or PLAN
```

Do not silently change requirements to make tests pass.

---

# Step 16 — Re-run After Fixes

After an implementation fix:

1. Re-run the failing test.
2. Re-run relevant tests.
3. Re-run regression tests when appropriate.
4. Re-run lint/build if affected.

Do not stop after confirming only the originally failing test.

---

# Test Output Format

Use the following structure:

```markdown id="x6c1qv"
# TEST REPORT: <Feature Name>

## 1. Scope

<What was tested.>

## 2. Environment

- Backend: ...
- Frontend: ...
- Database: ...
- Test environment: ...

## 3. Acceptance Criteria

| Criterion | Result | Evidence |
|---|---|---|
| AC-01 | PASS | ... |
| AC-02 | PASS | ... |
| AC-03 | FAIL | ... |

## 4. Test Coverage

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

## 5. Automated Verification

- Unit tests: PASS / FAIL / NOT RUN
- Integration tests: PASS / FAIL / NOT RUN
- API tests: PASS / FAIL / NOT RUN
- Frontend tests: PASS / FAIL / NOT RUN
- Lint: PASS / FAIL / NOT RUN
- Type check: PASS / FAIL / NOT RUN
- Build: PASS / FAIL / NOT RUN
- Database verification: PASS / FAIL / NOT RUN

## 6. Failures

- None

or

- <Failure description>
- <Related requirement>
- <Likely cause>

## 7. Regression Result

PASS / FAIL / BLOCKED

## 8. Final Result

PASS / FAIL / BLOCKED

## 9. Notes

- ...
```

---

# Test Quality Checklist

Before completing the TEST stage, verify:

### Requirements

* [ ] SPEC was reviewed.
* [ ] PLAN was reviewed.
* [ ] TASK acceptance criteria were reviewed.
* [ ] Important acceptance criteria have verification.

### Functional Testing

* [ ] Happy path tested.
* [ ] Relevant validation tested.
* [ ] Relevant business rules tested.
* [ ] Relevant edge cases tested.
* [ ] Relevant error cases tested.

### Security

* [ ] Authentication tested when required.
* [ ] Authorization tested when required.
* [ ] Ownership rules tested when required.
* [ ] Sensitive information is not exposed.

### Regression

* [ ] Relevant existing tests were run.
* [ ] Potentially affected behavior was checked.

### Technical Verification

* [ ] Relevant automated tests were run.
* [ ] Lint checked when applicable.
* [ ] Build checked when applicable.
* [ ] Database/migration checked when applicable.

### Reporting

* [ ] Results are truthful.
* [ ] Failures are documented.
* [ ] No unexecuted test is reported as PASS.

---

# What TEST Must Not Do

The TEST stage must not:

* Change requirements to make tests pass.
* Hide failures.
* Mark unexecuted tests as PASS.
* Add unrelated features.
* Perform unrelated refactoring.
* Ignore authorization failures.
* Ignore regression failures.
* Introduce unnecessary testing infrastructure.
* Modify production data for convenience.

If a code change is required to fix a failure, return to the IMPLEMENT stage.

---

# Completion Criteria

Testing is complete when:

* Relevant acceptance criteria have been verified.
* Important functional behavior has been tested.
* Relevant security and authorization behavior has been tested.
* Relevant regression checks have been completed.
* Automated verification has been executed where applicable.
* Failures have been resolved or clearly reported.
* No verification result is falsely reported as passing.

A feature with unresolved critical test failures must not be reported as fully passing.

---

# Transition to REVIEW

After testing is complete:

1. Produce the TEST REPORT.
2. Clearly identify PASS, FAIL, or BLOCKED status.
3. Identify unresolved issues.
4. Do not declare the overall implementation approved solely because tests pass.
5. Proceed to the `REVIEW` Skill for final quality and scope review.

The next Skill is:

```text id="5q2w8m"
review/SKILL.md
```
