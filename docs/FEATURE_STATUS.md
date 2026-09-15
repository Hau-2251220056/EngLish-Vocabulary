# FEATURE STATUS

## 1. Purpose

This document records the current implementation status of project features.

It is used to help the AI Agent and project developer understand:

* Which features are planned.
* Which features are currently being implemented.
* Which features have been implemented.
* Which features have been tested.
* Which features have passed final review.
* Which features are completed and should be reused instead of rebuilt.

This document describes **feature status only**.

Project requirements and business rules remain defined in:

```text
docs/PROJECT_OVERVIEW.md
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/API_SPEC.md
```

---

# 2. Status Definitions

Use the following statuses:

```text
TODO
PLANNED
IN_PROGRESS
IMPLEMENTED
TESTED
DONE
BLOCKED
```

## TODO

The feature is part of the approved project scope but development has not started.

```text
TODO
```

---

## PLANNED

The feature has an approved SPEC and/or PLAN but implementation has not started.

```text
PLANNED
```

---

## IN_PROGRESS

The feature is currently being implemented.

```text
IN_PROGRESS
```

---

## IMPLEMENTED

The planned implementation has been completed, but testing and/or final review is not yet complete.

```text
IMPLEMENTED
```

---

## TESTED

The implementation has passed the relevant testing stage, but final review has not yet been approved.

```text
TESTED
```

---

## DONE

The feature has:

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

and is considered complete for the current project scope.

```text
DONE
```

A feature must not be marked `DONE` merely because code exists.

---

## BLOCKED

Development cannot continue because of:

* unresolved requirement
* architecture conflict
* unavailable dependency
* external service problem
* environment problem
* unresolved technical issue
* pending approval

```text
BLOCKED
```

---

# 3. Important Rules

## 3.1 DONE Does Not Mean Rebuild

If a feature is marked:

```text
DONE
```

AI Agent must not rebuild the feature from scratch.

Instead:

```text
Read FEATURE_STATUS.md
        ↓
Identify existing implementation
        ↓
Inspect actual code
        ↓
Reuse existing implementation
        ↓
Modify / extend / fix when required
```

---

## 3.2 Status Must Reflect Reality

The status must represent the actual state of the project.

Do not mark a feature as:

```text
DONE
```

when:

* implementation is incomplete
* tests are failing
* required behavior is missing
* review has not been completed
* important acceptance criteria are not satisfied

---

## 3.3 Code Is the Final Evidence

`FEATURE_STATUS.md` is a project tracking document.

It must not be treated as proof that implementation exists.

When a feature is marked:

```text
IMPLEMENTED
TESTED
DONE
```

AI Agent should inspect the actual implementation and relevant tests when working on that feature.

If the status conflicts with the actual code:

```text
Actual Code
    ↓
Investigate
    ↓
Update FEATURE_STATUS.md
```

Do not blindly trust an outdated status.

---

# 4. Feature Status

## 4.1 Authentication & User Management

| Feature             | Status | SPEC | PLAN | TASK | IMPLEMENT | TEST | REVIEW |
| ------------------- | ------ | ---- | ---- | ---- | --------- | ---- | ------ |
| User Registration   | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |
| User Login          | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |
| User Authentication | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |
| User Authorization  | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |
| Admin Access        | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |

---

# 4.2 Vocabulary

| Feature                      | Status | SPEC | PLAN | TASK | IMPLEMENT | TEST | REVIEW |
| ---------------------------- | ------ | ---- | ---- | ---- | --------- | ---- | ------ |
| Vocabulary Management        | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |
| Vocabulary Multiple Meanings | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |
| Vocabulary Context / Example | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |
| Vocabulary Search            | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |

---

# 4.3 Vocabulary Sets

| Feature                     | Status | SPEC | PLAN | TASK | IMPLEMENT | TEST | REVIEW |
| --------------------------- | ------ | ---- | ---- | ---- | --------- | ---- | ------ |
| System Vocabulary Set       | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |
| User-Created Vocabulary Set | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |
| Vocabulary Set Ownership    | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |
| Vocabulary Set Visibility   | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |
| Edit Own Vocabulary Set     | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |
| Delete Own Vocabulary Set   | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |
| Copy Vocabulary Set         | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |

---

# 4.4 Learning

| Feature                     | Status | SPEC | PLAN | TASK | IMPLEMENT | TEST | REVIEW |
| --------------------------- | ------ | ---- | ---- | ---- | --------- | ---- | ------ |
| Vocabulary Learning Session | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |
| Flashcard Learning          | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |
| Learning Progress           | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |
| Spaced Repetition           | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |

---

# 4.5 Quiz

| Feature                   | Status | SPEC | PLAN | TASK | IMPLEMENT | TEST | REVIEW |
| ------------------------- | ------ | ---- | ---- | ---- | --------- | ---- | ------ |
| Vietnamese → English Quiz | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |
| Missing Letter Quiz       | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |
| Per-Character Feedback    | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |
| Quiz Result               | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |

Only the approved quiz types should be implemented.

Do not add additional quiz types without explicit scope approval.

---

# 4.6 Pronunciation

| Feature                        | Status | SPEC | PLAN | TASK | IMPLEMENT | TEST | REVIEW |
| ------------------------------ | ------ | ---- | ---- | ---- | --------- | ---- | ------ |
| Vocabulary Pronunciation Audio | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |
| Speech Recognition             | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |
| Pronunciation Evaluation       | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |

Pronunciation is a learning module.

It must not automatically become a new quiz type.

---

# 4.7 Gamification

| Feature     | Status | SPEC | PLAN | TASK | IMPLEMENT | TEST | REVIEW |
| ----------- | ------ | ---- | ---- | ---- | --------- | ---- | ------ |
| XP          | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |
| Level       | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |
| Streak      | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |
| Achievement | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |

Do not add leaderboard, ranking system, or XP transaction history unless explicitly approved.

---

# 4.8 Community

Community v1 currently includes:

```text
Posts
Comments
Vocabulary Set Sharing
```

| Feature                | Status | SPEC | PLAN | TASK | IMPLEMENT | TEST | REVIEW |
| ---------------------- | ------ | ---- | ---- | ---- | --------- | ---- | ------ |
| Community Posts        | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |
| Community Comments     | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |
| Vocabulary Set Sharing | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |

The following are not currently included:

```text
Likes
Reactions
Followers
Friends
Direct Messages
Chat
Leaderboard
```

They require explicit scope approval before implementation.

---

# 4.9 Admin

| Feature                   | Status | SPEC | PLAN | TASK | IMPLEMENT | TEST | REVIEW |
| ------------------------- | ------ | ---- | ---- | ---- | --------- | ---- | ------ |
| Admin Dashboard           | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |
| Vocabulary Management     | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |
| Vocabulary Set Management | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |
| User Management           | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |

Admin functionality must remain within the approved project scope.

---

# 4.10 AI-Assisted Features

AI functionality is optional.

| Feature                            | Status | SPEC | PLAN | TASK | IMPLEMENT | TEST | REVIEW |
| ---------------------------------- | ------ | ---- | ---- | ---- | --------- | ---- | ------ |
| AI-Assisted Vocabulary Explanation | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |
| AI-Assisted Learning Support       | TODO   | ⏳    | ⏳    | ⏳    | ⏳         | ⏳    | ⏳      |

AI features must not become mandatory project dependencies without explicit approval.

---

# 5. Feature Detail Records

When a feature reaches `IN_PROGRESS`, `IMPLEMENTED`, `TESTED`, or `DONE`, additional information may be recorded below.

Use this structure:

```markdown
## <Feature Name>

Status: <STATUS>

### Description

<Short description>

### Related Documentation

- SPEC: <reference>
- PLAN: <reference>
- TASK: <reference>

### Backend

- <related files/modules>

### Frontend

- <related files/components>

### API

- <related endpoints>

### Database

- <related tables/models>

### Tests

- <related test files>

### Review

- Verdict: <APPROVE / CHANGES_REQUIRED / BLOCKED>
```

Only add implementation details that are actually known.

Do not invent file paths, endpoints, tables, or test files.

---

# 6. Updating Feature Status

The status should be updated as the feature progresses.

Recommended progression:

```text
TODO
  ↓
PLANNED
  ↓
IN_PROGRESS
  ↓
IMPLEMENTED
  ↓
TESTED
  ↓
DONE
```

If a problem prevents progress:

```text
IN_PROGRESS
    ↓
BLOCKED
```

After the problem is resolved:

```text
BLOCKED
    ↓
IN_PROGRESS
```

---

# 7. Stage Completion Rules

## After SPEC

When the SPEC is approved:

```text
TODO → PLANNED
```

---

## After PLAN

The feature may remain:

```text
PLANNED
```

until implementation begins.

---

## During IMPLEMENT

When implementation begins:

```text
PLANNED → IN_PROGRESS
```

---

## After IMPLEMENT

When the implementation described by the approved TASK is completed:

```text
IN_PROGRESS → IMPLEMENTED
```

This does not mean the feature is complete.

---

## After TEST

When relevant tests and verification pass:

```text
IMPLEMENTED → TESTED
```

If tests fail:

```text
IMPLEMENTED → IN_PROGRESS
```

when implementation changes are required.

---

## After REVIEW

If review returns:

```text
APPROVE
```

then:

```text
TESTED → DONE
```

If review returns:

```text
CHANGES_REQUIRED
```

then the feature returns to the appropriate development stage.

If review returns:

```text
BLOCKED
```

the feature becomes:

```text
BLOCKED
```

---

# 8. Status Update Rules

AI Agent may update this file when the status genuinely changes as a result of the current workflow.

However:

* Do not mark a feature complete prematurely.
* Do not mark untested code as `TESTED`.
* Do not mark unreviewed code as `DONE`.
* Do not remove historical status information unnecessarily.
* Do not change unrelated feature statuses.
* Do not mark features as completed based only on assumptions.
* Do not create fake implementation references.

When uncertain, leave the status unchanged and report the uncertainty.

---

# 9. Existing Feature Check

Before implementing a requested feature, AI Agent should check this document.

If the requested feature is:

```text
DONE
```

AI Agent should:

1. Identify the existing implementation.
2. Inspect the actual code.
3. Determine whether the request is:

   * a bug fix
   * an enhancement
   * a modification
   * a new related feature
4. Reuse the existing implementation where appropriate.

Do not rebuild an existing completed feature without a clear reason.

---

# 10. Related Feature Check

A new feature may depend on an existing feature.

Example:

```text
Existing:
Vocabulary Set
Status: DONE

New:
Community Vocabulary Set Sharing
Status: TODO
```

The new feature should reuse the existing Vocabulary Set implementation where appropriate.

Do not duplicate:

* models
* services
* controllers
* components
* API endpoints
* business logic

when an existing implementation already provides the required behavior.

---

# 11. Conflict Handling

If this document says:

```text
DONE
```

but the implementation appears incomplete:

```text
FEATURE_STATUS
        ↓
Conflict detected
        ↓
Inspect actual implementation
        ↓
Report conflict
        ↓
Correct status when verified
```

Do not silently assume that the status is correct.

Likewise, do not downgrade a feature based only on a guess.

---

# 12. Scope Changes

If a requested feature does not exist in this document:

Do not automatically add it as an approved feature.

Instead:

```text
Requested Feature
        ↓
Check PROJECT_OVERVIEW.md
        ↓
Within approved scope?
        ↓
YES → Add / update status
NO  → Treat as scope change
```

A scope change requires the normal approval process defined in `AGENTS.md`.

---

# 13. Current Project State

At the beginning of the project implementation phase, all features are intentionally marked:

```text
TODO
```

This is expected.

As development progresses, this document must be updated to reflect the actual project state.

The goal is not to make this document look complete.

The goal is to make it accurate.

---

# 14. Final Principle

`FEATURE_STATUS.md` answers:

> "What features of the project have actually been completed?"

It does not answer:

> "How should the feature work?"

For feature behavior, consult:

```text
PROJECT_OVERVIEW.md
```

For architecture, consult:

```text
ARCHITECTURE.md
```

For database structure, consult:

```text
DATABASE.md
```

For API contracts, consult:

```text
API_SPEC.md
```

For AI Agent behavior, consult:

```text
AGENTS.md
```

For implementation workflow:

```text
.agents/skills/
```

The project should maintain the following relationship:

```text
AGENTS.md
    ↓
Defines how the Agent works

PROJECT_OVERVIEW.md
    ↓
Defines what the product is

ARCHITECTURE.md
    ↓
Defines system structure

DATABASE.md
    ↓
Defines data structure

API_SPEC.md
    ↓
Defines API contracts

FEATURE_STATUS.md
    ↓
Defines current implementation state

.agents/skills/
    ↓
Defines how each development stage is performed
```
