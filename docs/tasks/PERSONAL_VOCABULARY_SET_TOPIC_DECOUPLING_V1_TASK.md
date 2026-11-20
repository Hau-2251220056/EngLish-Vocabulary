# TASKS: Personal Vocabulary Set Topic Decoupling V1

**Source SPEC:** `docs/specs/PERSONAL_VOCABULARY_SET_TOPIC_DECOUPLING_V1_SPEC.md` (`HUMAN APPROVED`)

**Source PLAN:** `docs/plans/PERSONAL_VOCABULARY_SET_TOPIC_DECOUPLING_V1_PLAN.md` (`HUMAN APPROVED` by the current task request)

**TASK status:** `HUMAN APPROVED`

**Implementation authorized:** `YES`

## Overview

These tasks implement the approved contract correction in which public ADMIN-managed System Sets continue to require Topic, while private USER Personal Sets no longer accept or require Topic. The work preserves the existing Set model, ownership and visibility rules, exact-ID ordered membership, public Topic discovery, Learning Progress identity, both approved Quiz types, and the guarded dedicated TEST database workflow.

This is a focused change to completed Vocabulary Set and Topic behavior, not a rebuild. No task may apply or alter the preserved Create/Edit UI stash, redesign Set Detail, add a Set-type model, introduce a new endpoint, or change authentication architecture.

## Feature Status

Current Status: `DONE` domains with an approved contract revision pending implementation.

`docs/FEATURE_STATUS.md` records Topic Management and the Vocabulary Set ownership, visibility, CRUD, copy, and discovery capabilities as complete. These tasks cover only the approved Personal Set / Topic decoupling delta and the regression evidence needed to keep those completed behaviors valid.

## Task Dependency Graph

```text
TASK-001 Database relation and invariant
   ↓
TASK-002 USER/ADMIN backend contract split
   ├──→ TASK-003 Copy and Topic deletion behavior
   ├──→ TASK-004 Learning and Quiz compatibility
   └──→ TASK-005 Minimum frontend contract compatibility
                  ↓
       TASK-006 Guarded real-stack and regression verification
                  ↓
       TASK-007 Documentation, review, and closure
```

TASK-003, TASK-004, and TASK-005 may proceed after TASK-002, but they should not be implemented concurrently when doing so would create overlapping fixture or test-file edits. TASK-006 requires all implementation tasks to be complete.

## TASK-001: Make Topic Optional for Private Sets and Enforce the Public-Set Invariant

### Objective

Make the Set-to-Topic relation nullable for private Personal Sets while retaining database-enforced Topic integrity for every public System Set and every non-null Topic reference.

### Dependencies

- None.
- The implementation branch must be `feature/personal-set-topic` with the approved SPEC, PLAN, and TASK available.

### Files / Components

Files to modify:

- `backend/prisma/schema.prisma` — make `VOCABULARY_SET.topic_id` and its Prisma relation optional.
- `backend/test/personal-vocabulary/personal-vocabulary-schema.test.js` — extend guarded schema evidence where its existing scope is appropriate.
- `backend/test/vocabulary-set/vocabulary-set.test.js` — add focused persistence/invariant coverage where service or fixture support belongs with Set tests.

File to create:

- `backend/prisma/migrations/<timestamp>_decouple_personal_set_topic/migration.sql` — one new forward migration; the timestamp is generated during implementation by the repository-approved workflow.

### In Scope

- Drop `NOT NULL` from `VOCABULARY_SET.topic_id`.
- Keep the existing Topic foreign key with `ON DELETE RESTRICT` and `ON UPDATE CASCADE` for non-null values.
- Add a named PostgreSQL check equivalent to `NOT is_public OR topic_id IS NOT NULL`.
- Preserve all existing rows and references without backfill, reassignment, or deletion.
- Regenerate the existing Prisma client through the repository workflow.
- Verify migration/schema behavior only against the guarded dedicated TEST database.

### Out of Scope

- Editing old migrations.
- Removing Topic or its reverse relation.
- Adding a Set-type column, default Topic, tag/category model, or dependency.
- Applying schema or migration commands to Main, Preview, or Production databases.
- Inventing a rollback backfill for null Personal Set rows.

### Implementation Requirements

1. Update only the nullability of the Topic scalar/relation in Prisma; preserve owner, visibility, Item, index, and relation definitions.
2. Inspect generated SQL before applying it. Stop if it drops or weakens the Topic foreign key actions.
3. Add the public-Set check constraint in the focused forward migration.
4. Record pre/post TEST DB row counts and representative Topic references; no existing row may be rewritten.
5. Prove directly that a private Set with null Topic is accepted and a public Set with null Topic is rejected.
6. Preserve a non-null unknown Topic failure through the existing foreign key.
7. Document rollback as conditional: restoring `NOT NULL` is safe only while no null rows exist.

### Acceptance Criteria Covered

- AC-06, AC-07, AC-14, AC-18, AC-23.

### Required Tests / Verification

- Guard must identify the database as the dedicated TEST database before any migration/reset action.
- Migration applies successfully through the approved TEST DB preparation workflow.
- Prisma schema/client generation succeeds.
- Schema inspection confirms nullable `topic_id`, retained FK actions, and the named check constraint.
- Direct persistence test: private/null succeeds.
- Direct persistence test: public/null fails.
- Existing categorized System and Personal rows retain their IDs and Topic references.
- Focused schema and Vocabulary Set backend tests pass.

### Stop / Review Condition

Stop for review before TASK-002 if existing TEST data violates the public-Topic invariant, generated SQL changes the FK actions, any existing row would require mutation, the TEST DB guard cannot be proven, or rollback requires an unapproved data policy.

## TASK-002: Split USER Personal and ADMIN System Set Write Contracts

### Objective

Separate the authoritative backend write contracts so USER Personal Set create/update rejects Topic and never depends on Topic lookup, while ADMIN System Set create/update continues to require and validate Topic.

### Dependencies

- TASK-001 complete and reviewed.

### Files / Components

Files to modify:

- `backend/src/services/vocabulary-set-service.js` — separate allowed fields, normalization, Topic validation, and persistence behavior by existing USER/System service operation.
- `backend/test/vocabulary-set/vocabulary-set.test.js` — focused USER/ADMIN API/service contract, read-shape, authorization, and legacy preservation tests.
- `backend/test/personal-vocabulary/private-vocabulary-create-add.test.js` — preserve exact-ID private Vocabulary eligibility and lifecycle regressions affected by shared Personal Set fixtures.

Expected unchanged components to verify:

- `backend/src/controllers/vocabulary-set-controller.js`
- `backend/src/routes/vocabulary-set-routes.js`
- `backend/src/repositories/vocabulary-set-repository.js`

### In Scope

- USER create accepts only `name`, optional `description`, and optional `items` under the existing aggregate rules.
- USER create persists `topic_id: null` and performs no Topic lookup.
- USER update accepts only supported Personal fields and leaves any legacy Topic reference untouched.
- USER create/update rejects `topic_id`, including null or a valid UUID, as `400 VALIDATION_ERROR`.
- USER list/detail retains `topic_id: uuid | null`.
- ADMIN create still requires a valid non-null Topic; ADMIN update may reassign but not clear Topic.
- Preserve existing ownership concealment, role enforcement, visibility, Item validation, atomic replacement, and error distinctions.

### Out of Scope

- New routes, controller contracts, repository abstractions, or response objects.
- USER control over `owner_id`, `is_public`, or legacy Topic metadata.
- ADMIN authorization/UI changes.
- Copy behavior and Topic deletion mapping, which belong to TASK-003.

### Implementation Requirements

1. Replace shared create/patch allowlists with explicit System and Personal allowlists without changing route authorization.
2. Ensure USER creation does not call Topic lookup even when Topic APIs are unavailable.
3. Set Topic to null server-side for new Personal Sets; do not trust client visibility/ownership fields.
4. Exclude Topic from USER update data so an unrelated legacy Personal Set update preserves its Topic UUID.
5. Keep ADMIN missing/null Topic as validation failure and a well-formed nonexistent Topic as `TOPIC_NOT_FOUND`.
6. Preserve System `is_public: true`, authenticated ADMIN ownership, and canonical-only membership.
7. Keep ordered exact-ID membership replacement and same-spelling identity behavior unchanged.

### Acceptance Criteria Covered

- AC-01, AC-02, AC-03, AC-04, AC-05, AC-07, AC-08, AC-11, AC-19, AC-20, AC-21, AC-22, AC-23.

### Required Tests / Verification

- USER create without `topic_id` succeeds and returns `topic_id: null`.
- USER create with `topic_id` returns `400 VALIDATION_ERROR`.
- USER update without Topic succeeds for metadata and complete ordered membership.
- USER update with `topic_id` returns `400 VALIDATION_ERROR`.
- A Topic repository/service spy proves USER creation performs no Topic lookup.
- Updating a categorized legacy Personal Set preserves its original `topic_id`.
- USER list/detail serializes both null and legacy UUID Topic values.
- ADMIN create with missing/null Topic fails validation.
- ADMIN create with a well-formed nonexistent Topic returns `404 TOPIC_NOT_FOUND`.
- ADMIN update with null Topic fails; valid reassignment succeeds.
- Ownership concealment, USER/ADMIN role boundaries, System visibility, exact-ID eligibility, duplicate membership, contiguous order, aggregate replacement, and same-spelling coexistence regressions pass.

### Stop / Review Condition

Stop if separating allowlists requires a route/API redesign, repository response change, ownership/visibility change, or if legacy Topic preservation cannot be achieved without exposing Topic management to USER.

## TASK-003: Make System Copies Topicless and Formalize Topic Deletion Conflict

### Objective

Create independent topicless Personal copies of System Sets and return the approved safe conflict when any remaining Set reference prevents Topic deletion.

### Dependencies

- TASK-002 complete.

### Files / Components

Files to modify:

- `backend/src/services/vocabulary-set-service.js` — set copied Personal Set Topic to null while preserving the existing transaction and copy invariants.
- `backend/src/services/topic-service.js` — map the relevant FK-reference persistence failure to `TOPIC_IN_USE`.
- `backend/src/controllers/topic-controller.js` — translate `TOPIC_IN_USE` to HTTP 409 with a safe response.
- `backend/test/vocabulary-set/vocabulary-set.test.js` — copy identity, content, order, independence, and null-Topic coverage.
- `backend/test/topic/topic.test.js` — referenced/unreferenced Topic deletion, authorization, and no-cascade coverage.

### In Scope

- Set copied Personal `topic_id` explicitly to null.
- Preserve copied name, description, exact Vocabulary IDs, positions, fresh Set/Item IDs, USER ownership, and private visibility.
- Retain the FK as the concurrency-safe Topic delete restriction.
- Return `409 TOPIC_IN_USE` for System or legacy Personal Set references.
- Prove a topicless Personal Set does not block deletion of an unrelated Topic.

### Out of Scope

- Source-link or synchronization behavior.
- Pre-count checks that replace the FK boundary.
- Cascade deletion, legacy-reference cleanup, Topic endpoint changes, or a new remediation API.

### Implementation Requirements

1. Change only Topic propagation within the existing copy transaction.
2. Ensure source Set and Items remain unchanged after copying and after later copy mutations.
3. Map only the applicable known persistence conflict; preserve existing duplicate/not-found and unexpected-error handling.
4. Do not expose database details in the 409 response.
5. Keep Topic CRUD ADMIN-only.

### Acceptance Criteria Covered

- AC-13, AC-15, AC-19, AC-22, AC-23.

### Required Tests / Verification

- Copy response and persisted copy have `topic_id: null`.
- Copy has fresh Set/Item IDs, exact Vocabulary identities and source order, copied text, USER owner, and private visibility.
- Source remains unchanged and copy/source updates remain independent.
- Deleting a Topic referenced by a System Set returns `409 TOPIC_IN_USE` and deletes no Set/Item.
- Deleting a Topic referenced by a legacy Personal Set returns `409 TOPIC_IN_USE` and deletes no Set/Item.
- A topicless Personal Set does not block deletion of an otherwise unreferenced Topic.
- Existing Topic not-found, duplicate, authentication, and ADMIN authorization tests remain passing.

### Stop / Review Condition

Stop if reliable conflict mapping cannot distinguish the relevant FK failure safely, if the change would require weakening `RESTRICT`, or if copy independence/order cannot be preserved within the existing transaction.

## TASK-004: Verify Topicless Learning and Quiz Compatibility

### Objective

Prove that Learning and both approved Quiz types operate on topicless owned Personal Sets without changing their existing authorization, membership, Progress, concurrency, or answer rules.

### Dependencies

- TASK-002 complete.
- TASK-003 should be complete before copy-origin Learning/Quiz real-stack scenarios are finalized.

### Files / Components

Test files to modify:

- `backend/test/learning/learning.test.js` — topicless Set response, cards, event, Progress, authorization, and concurrency coverage.
- `backend/test/quiz/quiz.integration.test.js` — topicless fixtures and both approved Quiz-type answer/Progress coverage.

Production files to inspect and leave unchanged unless runtime verification proves normalization is required:

- `backend/src/repositories/learning-repository.js`
- `backend/src/services/learning-service.js`
- `backend/src/repositories/quiz-repository.js`
- `backend/src/services/quiz-service.js`

### In Scope

- Keep a stable Learning `topic` key that is Topic summary or null.
- Exercise Learning load and meaningful event recording for a topicless owned Personal Set.
- Exercise `VI_TO_ENGLISH` and `MISSING_LETTER` loading/answer recording for a topicless owned Personal Set.
- Preserve exact Set membership, question revision, idempotency/concurrency, and per-USER/per-Vocabulary Progress rules.

### Out of Scope

- New Learning or Quiz endpoint, type, algorithm, scoring, Topic progress, SRS, or response redesign.
- Production edits made merely to reflect optionality if the existing Prisma projection already returns null correctly.

### Implementation Requirements

1. Confirm regenerated Prisma makes the selected Learning Topic relation optional.
2. Preserve `topic: set.topic` or the smallest equivalent stable normalization; do not omit the key.
3. Keep Quiz entirely Set/membership-scoped with no Topic lookup or Topic field.
4. Reuse existing Progress and event paths; do not create Topic-dependent progress.
5. Make a Learning production edit only if a failing runtime contract proves it is necessary; any such edit must be reviewed against the approved PLAN before proceeding.

### Acceptance Criteria Covered

- AC-08, AC-09, AC-10, AC-11, AC-23.

### Required Tests / Verification

- Learning response for a topicless Personal Set contains `topic: null`, ordered cards, and unchanged empty/non-empty behavior.
- Learning access concealment and ownership tests pass.
- Learning event validation, Set membership, revision/idempotency/concurrency, and Progress updates pass.
- Both `VI_TO_ENGLISH` and `MISSING_LETTER` load questions and accept/reject answers under existing rules for the topicless Set.
- Quiz membership, revision, authorization, answer validation, and Progress regressions pass.
- No Topic lookup is introduced into Quiz.

### Stop / Review Condition

Stop if Learning or Quiz actually depends on Topic for authorization, identity, Progress, or question generation, or if meeting the contract requires a response/API redesign not approved by the SPEC and PLAN.

## TASK-005: Apply the Minimum USER/ADMIN Frontend Contract Change

### Objective

Remove Topic from the current committed USER Personal Set editor path while preserving the existing human-readable ADMIN Topic selector and all other current Set editor behavior.

### Dependencies

- TASK-002 complete and backend request/response behavior verified.

### Files / Components

File to modify:

- `frontend/src/vocabulary-sets/my-vocabulary-sets-page.jsx` — condition Topic loading, rendering, validation, serialization, and error handling on the existing ADMIN/System editor context.

Existing component to inspect and leave unchanged unless the approved condition cannot be expressed through its current invocation:

- `frontend/src/vocabulary-sets/admin-vocabulary-sets-page.jsx`

Focused browser coverage is implemented or updated in TASK-006 in:

- `frontend/e2e/integration/vocabulary-set-user-real-stack.spec.js`
- `frontend/e2e/integration/vocabulary-set-admin-real-stack.spec.js`

### In Scope

- USER create/edit renders no Topic selector.
- USER create/edit performs no Topic list request and is not blocked by Topic loading/failure.
- USER validation and request serialization omit `topic_id` entirely.
- ADMIN create/edit continues to load/display Topic names, require selection, and submit the selected ID internally.
- Preserve current committed editor structure, membership behavior, focus, errors, navigation, and responsive behavior.

### Out of Scope

- Applying or copying work from `stash@{0}`.
- Create/Edit drawer/modal redesign, Set Detail redesign, or new Personal membership UX.
- Frontend service/API abstraction changes unless separately reviewed as unavoidable.
- Raw UUID entry for USER or ADMIN.

### Implementation Requirements

1. Reuse the shared editor and add the smallest explicit System/ADMIN condition, such as the PLAN's `requiresTopic` boundary.
2. Derive System mode from the trusted existing ADMIN invocation, not editable client payload data.
3. Skip Topic fetch/effect state entirely for USER mode.
4. Remove `TOPIC_NOT_FOUND` write handling only from USER mode; retain distinct ADMIN Topic failures.
5. Continue accepting nullable `topic_id` in USER list/detail data without displaying a management control.
6. Do not change search, sort, list states, routes, create navigation, Set Detail navigation, or API service contracts.

### Acceptance Criteria Covered

- AC-02, AC-16, AC-17, AC-19, AC-21, AC-23.

### Required Tests / Verification

- USER editor has no Topic selector or raw UUID input.
- Network evidence shows USER editor makes no Topic-list request.
- USER create/update payloads omit `topic_id`.
- USER create/edit remains usable when the Topic API is unavailable.
- USER list/detail renders with `topic_id: null` and with a legacy UUID.
- ADMIN editor displays human-readable Topics, requires a selection, and submits its mapped UUID.
- Existing editor accessibility, keyboard focus, touch-target, responsive, and no-horizontal-overflow behavior remains valid.

### Stop / Review Condition

Stop if the minimum contract change requires applying the WIP stash, redesigning the editor, changing frontend service contracts, inferring Set kind from user-controlled payload, or altering unrelated list/detail UX.

## TASK-006: Run Guarded Real-Stack and Regression Verification

### Objective

Validate the complete contract against the migrated dedicated TEST database and prove that shared public discovery, authorization, Personal Vocabulary identity, Learning, Quiz, and frontend behavior have not regressed.

### Dependencies

- TASK-001 through TASK-005 complete.

### Files / Components

Real-stack test files to modify only as required for the approved contract or fixtures:

- `frontend/e2e/integration/vocabulary-set-user-real-stack.spec.js`
- `frontend/e2e/integration/vocabulary-set-admin-real-stack.spec.js`
- `frontend/e2e/integration/vocabulary-set-public-real-stack.spec.js`
- `frontend/e2e/integration/topic-real-stack.spec.js`
- `frontend/e2e/integration/learning-real-stack.spec.js`
- `frontend/e2e/integration/quiz-real-stack.spec.js`

Regression suites to run include the backend test files from TASK-001 through TASK-004, relevant frontend unit tests, and existing Authentication, Topic, Vocabulary, Vocabulary Set, Personal Vocabulary, Learning, and Quiz suites that cover shared paths.

### In Scope

- Execute the approved scenario matrix through real HTTP/UI and the dedicated TEST database.
- Update only fixtures/assertions that must represent the approved nullable Personal Topic contract.
- Run focused suites first, then shared-path regressions, lint, build, and whitespace checks.
- Confirm no browser horizontal overflow in the affected existing USER/ADMIN editor flows.

### Out of Scope

- Weakening or deleting existing tests to obtain a pass.
- Capturing/committing generated reports, screenshots, traces, videos, or test results.
- Running destructive preparation against any database other than the guarded TEST database.
- Product or UI redesign discovered during verification.

### Implementation Requirements

1. Verify TEST DB identity and reset permission before every database preparation path.
2. Exercise USER create/update rejection and success, legacy preservation, ADMIN enforcement, topicless copy, Topic deletion conflict, Learning, and both Quiz types.
3. Exercise public Topic discovery and prove private Personal Sets remain excluded.
4. Preserve exact-ID Personal Vocabulary rules and same-spelling coexistence.
5. Use current package scripts/configuration at implementation time; do not bypass repository guards with raw reset/migration commands.
6. Keep generated artifacts ignored and remove any temporary capture/spec file after use.

### Acceptance Criteria Covered

- End-to-end evidence for AC-01 through AC-23, with special regression emphasis on AC-08, AC-11, AC-12, AC-18, AC-22, and AC-23.

### Required Scenario Matrix

| Scenario | Expected result |
|---|---|
| USER create without Topic | Success; private owner Set; `topic_id: null`; no Topic request/lookup |
| USER create with `topic_id` | `400 VALIDATION_ERROR` |
| USER update without Topic | Success; supported metadata/membership updated |
| USER update with `topic_id` | `400 VALIDATION_ERROR` |
| Legacy Personal update | Existing Topic UUID preserved |
| ADMIN create missing/null Topic | `400 VALIDATION_ERROR` |
| ADMIN create nonexistent Topic | `404 TOPIC_NOT_FOUND` |
| ADMIN valid create/reassignment | Success; public Set remains categorized |
| ADMIN clear Topic | `400 VALIDATION_ERROR` |
| Direct private/null persistence | Allowed |
| Direct public/null persistence | Rejected by database constraint |
| Copy System Set | Independent private copy; null Topic; exact IDs/order preserved |
| Learning topicless Personal Set | Stable `topic: null`; cards/events/Progress unchanged |
| Quiz topicless Personal Set | Both approved types and answer/Progress paths work |
| Delete referenced Topic | `409 TOPIC_IN_USE`; no cascading Set/Item deletion |
| Delete unrelated Topic with topicless Personal Sets present | Success |
| Public Topic discovery | Existing grouping works; private Sets excluded |
| Personal Vocabulary exact identity | Canonical/private eligibility and same-spelling rules unchanged |

### Required Tests / Verification

- Focused backend Vocabulary Set, Topic, Learning, Quiz, schema, and Personal Vocabulary suites pass.
- Focused USER, ADMIN, and public Vocabulary Set real-stack suites pass.
- Topic, Learning, and Quiz real-stack suites pass against the migrated TEST database.
- Relevant Authentication, Vocabulary, Personal Vocabulary, and frontend unit regressions pass.
- Applicable backend/frontend lint passes.
- Applicable backend/frontend build succeeds.
- `git diff --check` passes.
- Final status contains no generated artifact or temporary spec intended for commit.

### Stop / Review Condition

Stop and report exact evidence if a DB guard is absent/ambiguous, a migration or required suite fails, an existing test would need weakening, a regression exposes a new product decision, or generated artifacts cannot be separated safely from checkpoint files.

## TASK-007: Synchronize Canonical Documentation and Prepare Closure Review

### Objective

Align canonical documentation with the verified contract, record truthful feature status/evidence, and prepare the implementation checkpoint for HUMAN review without merging, committing, pushing, or touching the UI WIP stash unless separately authorized.

### Dependencies

- TASK-006 complete with all required evidence recorded.

### Files / Components

Canonical documentation to modify where the implemented contract changes its domain statements:

- `docs/PROJECT_OVERVIEW.md` — only if it states or implies Topic is mandatory for every Set.
- `docs/ARCHITECTURE.md` — nullable Personal relation and retained System categorization boundary.
- `docs/DATABASE.md` — nullable column, FK actions, check constraint, existing-data and rollback conditions.
- `docs/API_SPEC.md` — split USER/ADMIN writes, nullable USER reads, topicless copy/Learning, and `TOPIC_IN_USE`.
- `docs/UI_UX_SPEC.md` — no USER Topic control/dependency and retained ADMIN selector.
- `docs/FEATURE_STATUS.md` — record this approved revision and verification status accurately; do not mark completion before review/approval.

Historical SPEC/PLAN/TASK artifacts remain immutable records except for their normal approval-status handling when explicitly authorized.

### In Scope

- Synchronize only statements superseded by the implemented contract.
- Link/reference the approved superseding SPEC where useful for traceability.
- Record actual verification commands/results and any residual risk.
- Perform final scope, security, migration, API, UI, and test-integrity review.
- Prepare an exact changed-file and artifact inventory for HUMAN review.

### Out of Scope

- Rewriting historical Topic or Vocabulary Set V1 decisions as if they never existed.
- Marking the revision DONE before TEST + REVIEW + HUMAN approval.
- Merging to `dev`, committing, pushing, deploying, or applying/popping/editing the UI stash.
- Starting Create/Edit drawer or Set Detail redesign.

### Implementation Requirements

1. Keep business scope, database, API, architecture, UI/UX, and feature-status documents mutually consistent.
2. State that Topic remains required for public System Sets and optional/unmanaged for private Personal Sets.
3. Document the breaking USER write correction: `topic_id` is rejected, while USER reads retain `uuid | null`.
4. Document migration/rollback constraints and dedicated TEST DB evidence without implying production deployment.
5. Review the final diff for unexpected source, test, dependency, lockfile, generated, or stash-related changes.
6. Stop for HUMAN approval after presenting the verified checkpoint.

### Acceptance Criteria Covered

- Documentation and closure evidence for AC-01 through AC-23; explicit scope confirmation for AC-18 and AC-23.

### Required Tests / Verification

- Cross-check every SPEC acceptance criterion against implementation and TASK-006 evidence.
- Cross-check all affected canonical docs for contradictory mandatory-Topic statements.
- Run `git diff --check` after documentation edits.
- Run `git status --short` and inventory exact intended files.
- Confirm no package/lockfile, unrelated API, generated artifact, temporary spec, or stash mutation is present.
- Confirm the stash containing Create/Edit UI WIP remains present and unapplied.

### Stop / Review Condition

Stop for HUMAN review. Do not mark the feature revision DONE, commit, push, merge, deploy, or manipulate the preserved UI stash without explicit subsequent authorization.

## Acceptance-Criteria Traceability Summary

| Acceptance criteria | Primary task(s) |
|---|---|
| AC-01–AC-05 | TASK-002, TASK-006 |
| AC-06–AC-07 | TASK-001, TASK-002, TASK-006 |
| AC-08 | TASK-002, TASK-004, TASK-006 |
| AC-09–AC-10 | TASK-004, TASK-006 |
| AC-11–AC-12 | TASK-002, TASK-006 |
| AC-13 | TASK-003, TASK-006 |
| AC-14 | TASK-001, TASK-006 |
| AC-15 | TASK-003, TASK-006 |
| AC-16–AC-17 | TASK-005, TASK-006 |
| AC-18 | TASK-001, TASK-006, TASK-007 |
| AC-19–AC-21 | TASK-002, TASK-003, TASK-005, TASK-006 |
| AC-22 | TASK-002, TASK-003, TASK-006 |
| AC-23 | Every task; final audit in TASK-007 |

## Execution Boundaries

- Execute tasks in dependency order and satisfy each stop/review gate before proceeding.
- Use the existing architecture; do not add routes, roles, models, packages, external services, or unrelated abstractions.
- Database work and real-stack verification must use only the guarded dedicated TEST database.
- Do not weaken tests, authorization, ownership concealment, exact-ID identity, or Set Item ordering.
- Do not apply, pop, drop, edit, or depend on the preserved UI WIP stash.
- The next stage is IMPLEMENT only after this TASK document receives HUMAN approval.

## Approval Gate

This TASK decomposition requires HUMAN review and approval before any implementation, test modification, migration creation/application, or canonical documentation update begins.
