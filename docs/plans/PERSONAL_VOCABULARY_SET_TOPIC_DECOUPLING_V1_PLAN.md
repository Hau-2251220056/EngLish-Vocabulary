# PLAN: Personal Vocabulary Set Topic Decoupling V1

**Source SPEC:** `docs/specs/PERSONAL_VOCABULARY_SET_TOPIC_DECOUPLING_V1_SPEC.md` (`HUMAN APPROVED`)

**PLAN status:** `HUMAN APPROVED`

**Implementation authorized:** `YES — through approved TASK`

## 1. Objective and Technical Summary

Implement the smallest safe contract correction that keeps Topic mandatory for public ADMIN-managed System Sets and removes Topic from USER Personal Set writes.

The implementation will reuse the existing Set model, `is_public` discriminator, owner/role checks, Set service/repository, Topic domain, shared frontend Set editor, Learning/Quiz paths and dedicated TEST DB workflow. It introduces no Set-type column, role, endpoint, package or alternate category system.

The data relationship becomes:

```text
TOPIC --RESTRICT--> public System VOCABULARY_SET
                    private Personal VOCABULARY_SET may have no Topic

VOCABULARY_SET --CASCADE--> ordered VOCABULARY_SET_ITEM --RESTRICT--> VOCABULARY
```

## 2. Scope and Non-Goals

### 2.1 In Scope

- Make `VOCABULARY_SET.topic_id` nullable without rewriting existing rows.
- Retain the Topic foreign key and `ON DELETE RESTRICT` for every non-null reference.
- Add database and service enforcement that `is_public: true` Sets always have Topic.
- Split USER and ADMIN Set write-field validation.
- Reject `topic_id` on USER create/update while retaining nullable `topic_id` on reads.
- Create new Personal Sets and System copies with `topic_id: null`.
- Support `topic: null` in Learning Set responses.
- Preserve Topic deletion protection and expose referenced deletion as `409 TOPIC_IN_USE`.
- Apply the minimum committed USER editor change required by the contract while preserving the ADMIN Topic selector.
- Update focused tests and canonical documentation.

### 2.2 Non-Goals

- Removing or renaming Topic.
- New Set type/category/tag models.
- Public discovery redesign or checkbox filters.
- Set Detail redesign.
- Create/Edit drawer or modal redesign.
- Adding Vocabulary management to Personal Set Create/Edit UI.
- Applying or altering the UI WIP stash.
- Public USER Sets, new search/pagination, cascade Topic deletion or hardcoded categories.
- Changes to auth/session architecture, exact-ID Vocabulary rules, Set Item order, Learning Progress identity or Quiz algorithms.

## 3. Existing Code and Invariants to Reuse

- `backend/prisma/schema.prisma` — one Set model; `owner_id` is required for both kinds, `is_public` is required, and Topic currently uses `RESTRICT`.
- `backend/src/services/vocabulary-set-service.js` — authoritative ADMIN/System versus USER/private creation, allowed-field validation, reference checks, copy and atomic membership replacement.
- `backend/src/repositories/vocabulary-set-repository.js` — public/private predicates, nullable-safe scalar projections after schema regeneration, Topic lookup and ordered Item reads.
- `backend/src/services/topic-service.js` and `controllers/topic-controller.js` — existing Topic deletion and safe known-error translation boundary.
- `backend/src/repositories/learning-repository.js` and `services/learning-service.js` — existing Topic relation projection and stable `topic` response key; an optional Prisma relation naturally returns `null`.
- `backend/src/repositories/quiz-repository.js` and `services/quiz-service.js` — Set/membership-only Quiz behavior; no Topic logic is added.
- `frontend/src/vocabulary-sets/my-vocabulary-sets-page.jsx` — shared USER/ADMIN Set editor and current Topic selector. Reuse its existing `requireItems`/System context or introduce the smallest explicit System-mode condition rather than a second editor.
- `frontend/src/vocabulary-sets/admin-vocabulary-sets-page.jsx` — existing ADMIN editor invocation that must continue to require Topic.
- Existing TEST DB guards and preparation scripts — the only allowed database verification path.

Current V1 Set identity is service- and route-controlled:

- ADMIN System operation -> `is_public: true`, authenticated ADMIN owner ID, canonical Items only.
- USER create/copy -> `is_public: false`, authenticated USER owner ID, owner-authorized reusable Items.

Because `owner_id` is intentionally non-null for both kinds, it must not be used to distinguish them. The approved database invariant is based on `is_public`.

## 4. Affected Files and Components

### 4.1 Expected Production Files

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/<timestamp>_decouple_personal_set_topic/migration.sql` — created only during IMPLEMENT after approval
- `backend/src/services/vocabulary-set-service.js`
- `backend/src/services/topic-service.js`
- `backend/src/controllers/topic-controller.js`
- `frontend/src/vocabulary-sets/my-vocabulary-sets-page.jsx`

No route, middleware, Set controller, Set repository, frontend service, Quiz production file, package or lockfile change is expected. Learning repository/service should require no logic edit because the existing selected optional relation and response key naturally produce `null`; this must be verified before leaving them unchanged.

### 4.2 Expected Canonical Documentation Files

- `docs/PROJECT_OVERVIEW.md` only where it implies Topic applies to all Sets
- `docs/ARCHITECTURE.md`
- `docs/DATABASE.md`
- `docs/API_SPEC.md`
- `docs/UI_UX_SPEC.md`
- `docs/FEATURE_STATUS.md`

Historical Topic/Vocabulary Set specs, plans and tasks remain unchanged. Canonical docs will reference the approved superseding SPEC where traceability is needed.

### 4.3 Expected Test Files

- `backend/test/vocabulary-set/vocabulary-set.test.js`
- `backend/test/topic/topic.test.js`
- `backend/test/learning/learning.test.js`
- `backend/test/quiz/quiz.integration.test.js`
- `backend/test/personal-vocabulary/personal-vocabulary-schema.test.js`
- `backend/test/personal-vocabulary/private-vocabulary-create-add.test.js`
- `frontend/e2e/integration/vocabulary-set-user-real-stack.spec.js`
- `frontend/e2e/integration/vocabulary-set-admin-real-stack.spec.js`
- `frontend/e2e/integration/vocabulary-set-public-real-stack.spec.js`
- `frontend/e2e/integration/topic-real-stack.spec.js`
- `frontend/e2e/integration/learning-real-stack.spec.js`
- `frontend/e2e/integration/quiz-real-stack.spec.js`

Tests should be changed only when needed for the approved contract or fixtures. The stashed `frontend/e2e/auth/my-vocabulary-set-drawer.spec.js` is not present on this branch and is not part of this plan.

## 5. Database and Migration Plan

### 5.1 Prisma Model

- Change `VOCABULARY_SET.topic_id` to nullable UUID.
- Change the `topic` relation to optional.
- Keep the `TOPIC.vocabulary_sets` reverse relation.
- Keep required `owner_id`, `is_public`, name, visibility and membership fields unchanged.
- Add no Set-type field or new model.

### 5.2 PostgreSQL Integrity

Create one forward migration that performs, in order:

1. Drop `NOT NULL` from `VOCABULARY_SET.topic_id`.
2. Preserve the existing `VOCABULARY_SET_topic_id_fkey` to `TOPIC.id` with `ON DELETE RESTRICT` and `ON UPDATE CASCADE`; recreate it only if the generated migration would otherwise weaken those actions.
3. Add a named check constraint equivalent to:

   ```text
   NOT is_public OR topic_id IS NOT NULL
   ```

This permits both legacy categorized and new topicless private Sets, while rejecting every public/System row without Topic. A private Set with Topic is intentionally still valid for legacy-data compatibility.

### 5.3 Existing Rows

- Do not update, clear, reassign or backfill any current `topic_id`.
- Existing System and Personal rows satisfy the new, weaker nullability plus public check.
- Verify row counts and existing references are unchanged before/after TEST DB migration.

### 5.4 Prisma Generation and TEST DB Verification

- Do not edit `20260922000000_add_vocabulary_set` or any older migration.
- Create the migration through the repository's approved migration workflow during IMPLEMENT.
- Regenerate the existing Prisma client after schema/migration creation; generated ignored output is not added unless repository policy changes.
- Apply/verify only with `backend/.env.test`, `NODE_ENV=test`, guarded `TEST_DATABASE_URL` and reset permission through the existing test-database preparation path.
- Verify column nullability, FK actions, check constraint, valid topicless private insertion, invalid topicless public insertion, and unchanged legacy rows.
- Never run automated migration tests against Main, Preview or Production.

### 5.5 Rollback

- Dropping the new check and restoring `NOT NULL` is safe only while no null rows exist.
- After topicless Personal Sets exist, rollback requires an separately approved data-remediation decision; do not invent a default Topic, delete Sets or copy arbitrary categorization.
- Deployment order must keep database, backend and frontend contract compatibility explicit; the PLAN does not authorize production deployment.

## 6. Backend and API Plan

### 6.1 USER Write Contract

In `vocabulary-set-service.js`:

- Replace shared create/patch field sets with separate System and Personal allowed-field sets.
- `POST /api/my/vocabulary-sets` accepts `name`, optional `description`, and optional `items`; it rejects `topic_id`, `owner_id`, `is_public` and any other unsupported field with existing `400 VALIDATION_ERROR` behavior.
- Personal create persists `topic_id: null` and performs no `findTopicById` lookup.
- `PATCH /api/my/vocabulary-sets/:setId` accepts only the approved Personal fields and rejects `topic_id` even when null or valid.
- Personal PATCH must not include Topic in the update projection, so legacy Topic references remain unchanged.
- Ownership concealment, private visibility, description clearing, optional/complete Items behavior and exact-ID reference validation remain unchanged.

### 6.2 USER Read Contract

- Keep `topic_id` in repository summary/detail selections.
- Prisma/select serialization naturally returns `uuid | null`.
- Do not embed Topic metadata in My Sets responses.
- Add API evidence that new/copied Sets return `null` and legacy categorized Personal Sets retain their UUID after unrelated updates.

### 6.3 ADMIN/System Contract

- Retain System create requirements for `topic_id`, `name` and non-empty `items`.
- Retain UUID and Topic existence checks.
- Retain System PATCH support for reassignment to another valid Topic.
- Continue rejecting `topic_id: null` through UUID validation.
- Keep `is_public: true`, authenticated ADMIN owner, canonical-only Item validation and System route authorization unchanged.
- Add database-check regression proof so persistence outside the service still cannot create a topicless public Set.

No ADMIN route/controller contract change is needed.

### 6.4 Copy Contract

- In `copySystemSet`, replace source Topic propagation with explicit `topic_id: null`.
- Keep the existing transaction, source accessibility, canonical Vocabulary validation, authenticated USER ownership, private visibility, name/description copy, fresh Set/Item creation and exact source position order.
- Verify the source remains unchanged and later source Topic changes/deletion behavior cannot mutate the copy.

### 6.5 Learning

- Regenerate Prisma so `VOCABULARY_SET.topic` is optional.
- Confirm the existing Learning repository relation selection returns `null` for a topicless Set without throwing.
- Preserve the existing service projection `topic: set.topic`, yielding a stable Topic summary or `null`.
- Make a production edit only if generated Prisma/runtime behavior or response normalization requires it; otherwise keep Learning code unchanged.
- Test authorization, ordered cards, empty handling, event membership, revision/idempotency and Progress behavior against a topicless Personal Set.

### 6.6 Quiz

- Make no Topic-related production change.
- Update fixtures to permit/create topicless Personal Sets.
- Add a regression proving both approved Quiz types and answer/Progress behavior remain valid without Topic.

### 6.7 Topic Delete Conflict

- Keep repository deletion and FK `RESTRICT` as the concurrency-safe boundary.
- Extend `topic-service.js` persistence error mapping so the relevant FK-reference failure maps to a new safe `TOPIC_IN_USE` service error while preserving duplicate/not-found mapping.
- Extend `topic-controller.js` known errors so `TOPIC_IN_USE` returns `409`.
- Verify System and legacy Personal references both block deletion, while a topicless Personal Set creates no dependency.
- Do not add pre-count authorization logic, cascade behavior or a new Topic endpoint.

## 7. Frontend Contract Plan

### 7.1 Contract-Required Change

Modify the current committed shared editor in `my-vocabulary-sets-page.jsx` minimally:

- USER Personal create/edit renders no Topic selector.
- USER editor performs no Topic list request and has no Topic loading/error dependency.
- USER validation does not require Topic.
- USER serialization omits `topic_id` entirely.
- USER error mapping need not present `TOPIC_NOT_FOUND` for writes.
- ADMIN editor continues loading Topics, rendering the human-readable selector, validating selection, and serializing the ID internally.
- Existing My Sets name/description search, list/detail, membership editor behavior, navigation, focus, errors and ownership UX remain unchanged except where the current committed editor conditionally separates USER/ADMIN Topic handling.

Prefer an explicit `requiresTopic`/System-editor condition derived from the existing ADMIN invocation over duplicating the component. Do not infer System status from client-controlled data.

No frontend service change is expected because it transports caller-provided objects without imposing a Topic shape.

### 7.2 Later UI Foundation Redesign

The Create/Edit UI redesign remains separate WIP in `stash@{0}` on `feature/ui-foundation-v1`. This branch will not apply, pop, edit or depend on that stash.

After this contract checkpoint is implemented, tested, reviewed, approved and integrated into `dev`:

1. update `feature/ui-foundation-v1` from the new `dev` state using the project's approved integration workflow;
2. inspect the preserved stash before applying it;
3. reconsider/rework only the still-valid UI changes against the new topicless USER contract;
4. keep the final drawer/modal redesign under its own approval and review checkpoint.

## 8. Validation and Authorization Preservation

- Authentication middleware and `USER`/`ADMIN` role middleware remain unchanged.
- Backend remains authoritative for owner ID, visibility, private ownership and System scope.
- Unsupported USER `topic_id` is rejected, not ignored.
- ADMIN missing/null Topic is validation failure; well-formed missing Topic remains `TOPIC_NOT_FOUND`.
- Public discovery still filters `is_public: true` by Topic.
- Personal exact-ID Vocabulary eligibility remains canonical plus owner-private only.
- System Item eligibility remains canonical-only.
- No word/spelling-based identity resolution is introduced.

## 9. Ordered Implementation Phases

### Phase 1 — Documentation and Contract Baseline

- Confirm approved SPEC/PLAN and clean implementation branch.
- Synchronize canonical contract statements or stage them alongside implementation so no merged code contradicts docs.
- Record pre-migration TEST DB schema/data expectations.

**Gate:** no production implementation before PLAN and TASK approval.

### Phase 2 — Database Migration

- Update Prisma nullability/relation.
- Create one focused forward migration.
- Preserve FK actions and add public-Topic check.
- Regenerate Prisma client.
- Verify only through guarded TEST DB preparation and schema tests.

**Gate:** stop if existing TEST data violates the proposed invariant or generated SQL weakens the FK.

### Phase 3 — Backend Contract

- Split Personal/System allowed fields and normalizers.
- Create/update Personal Sets without Topic lookup or Topic writes.
- Make copy topicless.
- Map referenced Topic deletion to `409 TOPIC_IN_USE`.
- Confirm nullable Learning projection; avoid unnecessary Learning/Quiz changes.

**Gate:** focused backend suites and migration checks pass before frontend work.

### Phase 4 — Minimum Frontend Contract Change

- Make Topic conditional to ADMIN/System editor use.
- Omit Topic from USER validation/serialization and Topic loading.
- Preserve existing UI structure; do not implement the stashed redesign.

**Gate:** focused USER and ADMIN browser behavior passes at desktop/mobile sizes where existing suites require it.

### Phase 5 — Real-Stack and Regression Verification

- Verify new Personal create/update/copy, legacy preservation, System enforcement, Topic deletion, Learning and Quiz on dedicated TEST DB.
- Run unaffected Auth, public Topic discovery, ADMIN Topic CRUD, canonical Vocabulary and Personal Vocabulary regression suites proportionate to shared-path risk.
- Run lint, build and `git diff --check`.

### Phase 6 — Documentation, Review and Handoff

- Finalize canonical documentation and FEATURE_STATUS accurately.
- Review scope, migration safety, API compatibility, authorization and evidence.
- Stop for HUMAN approval; do not merge or manipulate the UI stash as part of this checkpoint.

## 10. Test Strategy

### 10.1 Database and Backend

- Inspect `information_schema`/PostgreSQL constraints for nullable Topic, retained FK actions and named public-Topic check.
- Directly prove private-null succeeds and public-null fails.
- Prove existing categorized rows are unchanged.
- API-test USER accepted/rejected fields, no Topic lookup, reads, legacy preservation and owner concealment.
- API-test ADMIN required/reassignable/non-clearable Topic.
- Transactionally verify copy contents and null Topic.
- API-test `TOPIC_IN_USE` for System and legacy Personal references.

### 10.2 Learning and Quiz

- Backend Learning tests use a topicless owned Personal Set for response/cards/events and assert `topic: null`.
- Guarded Learning real-stack coverage verifies the same against migrated TEST DB.
- Quiz backend/real-stack fixtures include a topicless Personal Set and prove both types, Set access, questions, answer processing and Progress are unchanged.

### 10.3 Frontend and Real Stack

- USER editor has no Topic selector/request and sends no `topic_id`.
- USER list/detail accepts `topic_id: null` without presentation failure.
- ADMIN editor still displays Topic names and sends the selected ID.
- Public Topic discovery/System detail remains functional.
- Copy opens/returns an independent topicless Personal Set.
- Existing responsive, accessibility and no-overflow expectations remain in their current suites; no new UI redesign assertions are added.

### 10.4 Required Verification Commands

The later TEST stage should use repository scripts/configuration and include:

- focused backend Vocabulary Set, Topic, Learning, Quiz and Personal Vocabulary suites;
- frontend unit tests;
- focused USER/ADMIN/public Set browser suites;
- guarded TEST DB real-stack suites for Set, Topic, Learning and Quiz;
- `npm run lint` and `npm run build` in affected packages as applicable;
- `git diff --check`;
- migration-status/prepare verification using only the dedicated TEST DB.

Exact commands must follow current package scripts at implementation time; no raw migration/reset command may bypass TEST DB guards.

## 11. Acceptance-Criteria Traceability

| SPEC AC | Planned implementation evidence |
|---|---|
| AC-01 | USER API create test without `topic_id`; guarded USER real-stack create. |
| AC-02 | Service/repository spy or HTTP regression proving no Topic lookup; frontend request interception proving no Topic list dependency. |
| AC-03 | Owner-only PATCH tests and real-stack metadata/membership update without Topic. |
| AC-04 | ADMIN create missing/null/nonexistent Topic tests plus existing role protection. |
| AC-05 | ADMIN PATCH `topic_id: null` rejection and valid reassignment test. |
| AC-06 | Dedicated TEST DB direct insertion/schema test for private null Topic. |
| AC-07 | Service validation plus direct TEST DB rejection by named check for public null Topic. |
| AC-08 | Existing Set Item uniqueness/order/replacement tests run unchanged or minimally fixture-adjusted. |
| AC-09 | Backend and guarded real-stack Learning tests using topicless Personal Set and asserting `topic: null`, cards and Progress. |
| AC-10 | Backend and guarded real-stack Quiz tests for both approved types on topicless Personal Set. |
| AC-11 | Existing Personal Vocabulary schema/action/Set exact-ID suites retained and rerun. |
| AC-12 | Existing public Topic/System discovery backend and browser suites retained as regression. |
| AC-13 | Topic service/API and real-stack deletion tests for System and legacy Personal references, `409 TOPIC_IN_USE`, no cascade. |
| AC-14 | Migration test compares existing rows/relations and proves no data rewrite. |
| AC-15 | Backend and USER real-stack copy assertions for null Topic, fresh IDs, content and exact order. |
| AC-16 | USER editor browser/request assertions and backend unsupported-field test. |
| AC-17 | ADMIN real-stack selector assertion: visible Topic name maps to submitted ID; no raw UUID input. |
| AC-18 | Test environment guards plus use of approved TEST DB preparation/configuration only. |
| AC-19 | USER summary/detail API and frontend fixture tests for both null and legacy UUID response values. |
| AC-20 | Legacy categorized Personal PATCH test verifies Topic UUID remains unchanged. |
| AC-21 | USER unsupported `topic_id`, ADMIN missing/null and missing-reference error-code/status assertions. |
| AC-22 | Existing Topic ADMIN authorization and Set ownership/visibility regression suites. |
| AC-23 | Schema/diff/review check confirms no new role, type, model, service, package or unrelated endpoint. |

All 23 acceptance criteria have direct planned evidence.

## 12. Documentation Synchronization

- `DATABASE.md`: nullable relation, conditional System invariant, retained FK/delete behavior, existing-data and rollback policy.
- `API_SPEC.md`: separate USER/ADMIN write fields, nullable reads, topicless copy, nullable Learning Topic and `TOPIC_IN_USE`.
- `ARCHITECTURE.md`: Topic categorizes System Sets only; private Set and Learning/Quiz boundaries.
- `UI_UX_SPEC.md`: no USER Topic selector/dependency; ADMIN selector and discovery retained.
- `PROJECT_OVERVIEW.md`: clarify Topic/System categorization only if current general wording implies all Sets.
- `FEATURE_STATUS.md`: record this approved change as implemented/tested/reviewed only at the corresponding verified stages; do not mark DONE during implementation alone.
- Preserve historical `TOPIC_V1_*` and `VOCABULARY_SET_V1_*` files. Add a concise supersession pointer only if repository review requires discoverability, without rewriting their historical requirements.

## 13. Integration Safety and Regression Boundary

The final review must confirm no behavior change to:

- authentication, sessions or role model;
- owner-only Personal Set access and concealed cross-owner not-found behavior;
- ADMIN System Set authorization and public visibility;
- canonical Vocabulary CRUD and canonical-only System membership;
- private Vocabulary ownership, same-spelling exact identities and operation idempotency;
- Set Item exact membership, one-based order and transaction behavior;
- Learning Progress identity `(user_id, vocabulary_id)`, event idempotency and revision checks;
- Quiz question generation, scoring, character feedback, revision and Progress mutation;
- public Topic metadata routes and Topic-based System discovery;
- ADMIN Topic CRUD except the newly finalized referenced-delete conflict;
- Topic names/descriptions and all existing Set Topic values.

No Main, Preview or Production database is used for automated verification.

## 14. Risks and Mitigations

- **Mixed application/schema versions:** older backend requires Topic for USER creates. Mitigate through coordinated migration/backend/frontend rollout planning and pre-deployment compatibility review.
- **Database invariant drift:** nullable schema alone would permit invalid public Sets. Mitigate with named check plus service validation and direct database tests.
- **Legacy Topic mutation:** shared patch logic could accidentally clear/change a legacy Personal reference. Mitigate with separate Personal allowed fields/update projection and preservation test.
- **Read consumer assumptions:** clients may assume `topic_id` or Learning `topic` is non-null. Mitigate with explicit nullable docs and frontend/backend response tests.
- **Topic delete error mapping:** broad handling of all FK errors could misclassify unrelated persistence failures. Mitigate by mapping only the relevant Prisma FK/reference failure in the Topic delete path and retaining safe fallback behavior.
- **Copy regression:** removing Topic propagation could disturb aggregate construction. Mitigate with transaction and exact ID/order/source immutability assertions.
- **Shared editor regression:** removing USER Topic must not remove ADMIN Topic. Mitigate with explicit System condition and separate USER/ADMIN browser coverage.
- **Rollback after null rows:** `NOT NULL` cannot be restored without remediation. Document and require separate approval before any rollback backfill.
- **UI branch conflict:** later stash application may reintroduce Topic fields. Keep stash untouched now and require re-review after updating the UI branch from integrated `dev`.

## 15. Stop and Review Gates

1. Stop after this PLAN for HUMAN review; do not create TASK or implement.
2. Stop migration work if TEST DB guards are absent or the generated migration alters existing values/FK actions.
3. Stop backend work if separating USER/ADMIN fields would require an unapproved API or ownership change.
4. Stop before integration if any System Set can persist without Topic or any USER write can mutate Topic.
5. Stop before approval if Learning/Quiz, public discovery, Topic CRUD, exact-ID membership or auth regressions remain.
6. Do not apply/pop the UI stash in any phase of this contract branch.

## 16. Open Questions

None. The approved SPEC provides all decisions required to proceed to TASK after HUMAN PLAN approval.
