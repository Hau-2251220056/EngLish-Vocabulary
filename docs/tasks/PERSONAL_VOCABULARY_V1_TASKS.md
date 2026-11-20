# TASKS: Personal Vocabulary V1 — Private Capture and Set Reuse

**Product contract:** `HUMAN APPROVED`

**SPEC:** `HUMAN APPROVED`

**PLAN:** `HUMAN APPROVED`

**TASK status:** `HUMAN APPROVED`

**Implementation status:** `COMPLETE — HUMAN APPROVED`

## 1. Overview

These tasks implement the approved canonical/private Vocabulary identity model, owner-isolated private aggregate management, context-rich reuse/create flow, atomic and idempotent create-plus-add behavior, exact-ID Set/Learning/Quiz compatibility, and required cross-feature regression coverage.

The decomposition follows the existing Express service/repository architecture and React service/page architecture. It adds no new role, external service, private library, hard delete, Quiz type or Meaning-level Progress.

## 2. Feature Status

Current feature status: `DONE — HUMAN APPROVED`.

- Product Contract: HUMAN APPROVED.
- SPEC: HUMAN APPROVED.
- PLAN: HUMAN APPROVED.
- TASK: HUMAN APPROVED.
- TASK-PV-01: COMPLETE — HUMAN APPROVED.
- TASK-PV-02: COMPLETE — HUMAN APPROVED.
- TASK-PV-03: COMPLETE — HUMAN APPROVED.
- TASK-PV-04: COMPLETE — HUMAN APPROVED.
- TASK-PV-05: COMPLETE — HUMAN APPROVED.
- TASK-PV-06: COMPLETE — HUMAN APPROVED.
- TASK-PV-07: COMPLETE — HUMAN APPROVED.
- TASK-PV-08: COMPLETE — HUMAN APPROVED.
- TASK-PV-09: COMPLETE — HUMAN APPROVED.
- TASK-PV-10: COMPLETE — HUMAN APPROVED.
- TASK-PV-11: COMPLETE — HUMAN APPROVED.
- IMPLEMENT: COMPLETE.
- TEST: PASS — AC-01 through AC-30 have passing evidence.
- REVIEW: APPROVED.
- Integration into `dev`: NOT YET.

Completed ADMIN Vocabulary, Vocabulary Set, Learning/Progress and Quiz features are treated as approved integration points to extend or regression-test, not rebuild.

## 3. Task Dependency Graph

```text
TASK-PV-01
    |
    v
TASK-PV-02
    |
    +----------+
    v          v
TASK-PV-03  TASK-PV-04
    |          |
    +----+-----+
         v
     TASK-PV-05
         |
         v
     TASK-PV-06
         |
         v
     TASK-PV-07
         |
         v
     TASK-PV-08
         |
         +------------+
         v            v
     TASK-PV-09    TASK-PV-10
         |            |
         +------+-----+
                v
            TASK-PV-11
```

`TASK-PV-03` and `TASK-PV-04` may proceed in parallel after `TASK-PV-02` only if their shared Vocabulary repository/validation edits are coordinated to avoid conflicting patches. `TASK-PV-09` and `TASK-PV-10` may proceed in parallel after the complete private Set workflow is usable.

## TASK-PV-01 — Contract Synchronization and Migration Design Verification

### Objective

Synchronize approved active documentation and verify the migration/API design against the current repository before any implementation begins.

### Why this task exists

The active database/API/UI documents still describe a single global Vocabulary scope. A reviewed implementation contract is required before changing a high-risk shared aggregate.

### Dependencies

None beyond HUMAN approval of this TASK document.

### Exact scope

- Reconcile approved SPEC/PLAN with current `DATABASE.md`, `API_SPEC.md`, `UI_UX_SPEC.md` and, only where required, `ARCHITECTURE.md`.
- Record nullable `owner_id`, canonical-only partial word uniqueness, non-unique private search indexing, scoped operation-record design, proposed APIs and guarded migration sequence as approved future behavior—not completed behavior.
- Review current migration names/constraints and TEST DB guard workflow.
- Document rollback limitation after private duplicate-spelling data exists.

### Out of scope

- Prisma/schema/migration edits, generated code, DB commands, source code, tests or implementation status changes.

### Expected files/modules

- `docs/DATABASE.md`
- `docs/API_SPEC.md`
- `docs/UI_UX_SPEC.md`
- `docs/ARCHITECTURE.md` only if the transaction/idempotency boundary requires it
- Approved SPEC/PLAN/TASK documents for traceability only

### Implementation requirements

- Historical migrations remain immutable.
- Document `owner_id NULL = canonical`, non-null = owner-private.
- Explicitly prohibit private headword uniqueness and canonical collision blocking.
- Define operation ID/fingerprint semantics without selecting hash/serialization implementation.

### Security/privacy requirements

Document owner-derived scope, canonical-only ADMIN/System Set access, concealed cross-user IDs and no ADMIN moderation.

### Database safety requirements

Main, Preview and Production DBs are prohibited for tests. Future migration work uses only the dedicated TEST DB, existing reset guard and approved preparation workflow; no raw Prisma CLI bypass.

### Acceptance criteria

- Documentation contains one consistent approved future contract and no obsolete global-identity assumption.
- Migration prerequisites, forward-only limitation and DB safety rules are explicit.
- No implementation is represented as complete.

### Test requirements

Documentation/diff checks only; no database or implementation tests.

### Regression requirements

Verify documentation preserves completed canonical, Set, Learning and Quiz contracts except for approved integration changes.

### Completion evidence

Reviewed documentation diff, word-assumption search results and `git diff --check`.

### STOP / HUMAN approval gate

STOP after review evidence. `TASK-PV-02` requires separate HUMAN authorization.

## TASK-PV-02 — Prisma Ownership, Canonical Uniqueness and Operation Schema

### Objective

Implement the approved forward migration and guarded schema/data safety tests.

### Why this task exists

The current schema cannot represent private ownership, same-headword identities or durable operation idempotency.

### Dependencies

- `TASK-PV-01` complete and HUMAN approved.

### Exact scope

- Add nullable `VOCABULARY.owner_id` and inverse USER relation.
- Add the narrowly scoped private-create operation model with operation ID, owner, target Set, resulting Vocabulary, request fingerprint and timestamp.
- Create a new forward migration: preserve existing rows as canonical, replace global `LOWER(word)` uniqueness with canonical-only partial uniqueness, add non-unique owner/search index and approved FKs.
- Preserve Set Item and Progress exact-ID constraints.
- Add guarded schema/migration safety coverage.

### Out of scope

- Repository/service/API/frontend behavior, private hard delete, generic idempotency platform or modification of historical migrations.

### Expected files/modules

- `backend/prisma/schema.prisma`
- New `backend/prisma/migrations/<timestamp>_.../migration.sql`
- Generated Prisma client only through approved workflow
- Relevant guarded schema tests/helpers under `backend/test/`

### Implementation requirements

- `owner_id IS NULL` means canonical; non-null means exactly one USER owner.
- `ON DELETE RESTRICT` protects owner-private Vocabulary.
- Canonical word remains unique case-insensitively via partial functional index.
- Private spelling is non-unique, including multiple identical rows for one owner.
- Operation record supports one opaque `operation_id` per intentional action; no word-based identity.

### Security/privacy requirements

Ownership FK exists, but application authorization remains mandatory; schema must not imply public/private visibility from client input.

### Database safety requirements

- Dedicated TEST DB only; Main/Preview/Production prohibited.
- Existing TEST DB reset guard and approved migration-preparation script mandatory.
- No raw Prisma CLI bypass.
- Verify existing rows remain canonical.
- Document that rollback to global uniqueness is unsafe after duplicate-spelling private data exists.

### Acceptance criteria

- Canonical `book`, multiple User A private `book`, and User B private `book` coexist as distinct IDs.
- Canonical case-insensitive duplicates remain rejected.
- No owner/headword unique constraint exists.
- Existing Set/Progress constraints and relations remain valid.
- Operation ID uniqueness and FKs match the approved PLAN.

### Test requirements

Guarded migration-from-baseline, constraint, FK, index and existing-data compatibility tests.

### Regression requirements

Existing canonical schema, Meaning/Example, Set Item and Progress database tests remain green after intentionally obsolete global-uniqueness assertions are replaced.

### Completion evidence

Reviewed migration/schema diff, guarded migration logs, constraint evidence, generated-client check and focused backend results.

### STOP / HUMAN approval gate

STOP after schema/migration review. No dependent production work until HUMAN approval.

## TASK-PV-03 — Canonical-Scoped ADMIN Vocabulary Regression

### Objective

Keep every existing ADMIN Vocabulary operation strictly canonical after private rows coexist.

### Why this task exists

Current ADMIN repositories list and mutate all Vocabulary rows and use a global same-word lookup.

### Dependencies

- `TASK-PV-02` complete and HUMAN approved.

### Exact scope

- Scope ADMIN list/detail/create/update/delete and duplicate lookup to `owner_id IS NULL`.
- Ensure ADMIN create always writes canonical scope.
- Retain canonical-only case-insensitive duplicate error behavior.
- Treat private IDs as inaccessible/not-found.
- Preserve the current ADMIN UI/API contract.

### Out of scope

- Private moderation, USER private endpoints, ADMIN UI redesign or change to canonical aggregate fields.

### Expected files/modules

- `backend/src/repositories/vocabulary-repository.js`
- `backend/src/services/vocabulary-service.js`
- Controller/routes only if safe error mapping needs adjustment
- `backend/test/vocabulary/vocabulary.test.js`
- ADMIN frontend/service and real-stack tests for regression only

### Implementation requirements

- Replace global `findByWordInsensitive` semantics with explicit canonical lookup.
- All ID mutation predicates include canonical scope.
- Map only canonical partial-index collisions to `VOCABULARY_WORD_ALREADY_EXISTS`.

### Security/privacy requirements

ADMIN must receive no signal that a supplied private ID exists; no private content may appear in list/search/detail/errors.

### Database safety requirements

DB-backed tests use guarded dedicated TEST DB only and exact fixture IDs for cleanup.

### Acceptance criteria

- ADMIN list/detail/create/update/delete operate on canonical rows only.
- Canonical duplicate behavior is unchanged.
- Private same-word rows do not block canonical reads/updates except a real canonical collision.
- Private IDs are concealed as not found.
- USER cannot access ADMIN routes.

### Test requirements

Backend repository/service/HTTP tests plus existing frontend ADMIN and real-stack regression.

### Regression requirements

All existing ADMIN aggregate validation, owned-child replacement, delete restriction and safe-error cases remain valid.

### Completion evidence

Focused backend results, ADMIN frontend/real-stack results, diff review and no private leakage evidence.

### STOP / HUMAN approval gate

STOP after focused TEST/REVIEW evidence; await approval before downstream integration closure.

## TASK-PV-04 — Owner-Private Aggregate Read and Update Backend

### Objective

Add owner-only private Vocabulary detail/update while reusing the existing aggregate rules.

### Why this task exists

The approved feature permits owners to edit private learning content but forbids cross-owner/canonical mutation and hard delete.

### Dependencies

- `TASK-PV-02` complete and HUMAN approved.

### Exact scope

- Implement USER-only `GET/PATCH /api/my/vocabulary/:vocabularyId`.
- Reuse/refactor aggregate validation and nested Meaning/Example persistence without duplicating business rules.
- Permit approved editable fields and same-headword updates.
- Preserve at least one Meaning and stable child ownership validation.
- Add authorization and atomic update tests.

### Out of scope

- Private list/catalog, private DELETE, `pronunciation_url`, ownership transfer, canonical update or UI.

### Expected files/modules

- Vocabulary repository/service/controller/routes or a small private facade over them
- `backend/src/create-app.js`
- Focused backend private Vocabulary tests

### Implementation requirements

- Repository queries predicate on both ID and session owner.
- Requests reject ID/owner/scope/timestamps/URL fields.
- Word equality with canonical/other private rows is allowed.
- Nested update is one atomic aggregate operation; final Meaning cannot be removed.
- Shared identity means all Set references observe updated content automatically.

### Security/privacy requirements

Guest/ADMIN denied; canonical, missing and other-owner IDs use safe concealed not-found behavior. No owner ID is accepted from client.

### Database safety requirements

Guarded dedicated TEST DB only; fixture cleanup uses exact IDs and preserves referenced data.

### Acceptance criteria

- Owner reads/updates all approved content fields.
- Matching-spelling headword update succeeds without merge.
- Final-Meaning removal and unsupported fields fail atomically.
- Cross-owner/canonical access is concealed.
- No hard-delete endpoint exists.

### Test requirements

Service/repository and HTTP integration tests covering aggregate validation, nested ownership, transaction rollback and role/owner isolation.

### Regression requirements

Canonical ADMIN aggregate behavior remains covered by `TASK-PV-03`; existing Meaning/Example ordering remains unchanged.

### Completion evidence

Focused backend pass, authorization matrix, rollback invariance checks and API diff review.

### STOP / HUMAN approval gate

STOP after focused TEST/REVIEW and HUMAN approval.

## TASK-PV-05 — Owner-Aware Picker and Scope-Aware Set Validation

### Objective

Extend search and Set membership validation for canonical plus same-owner private exact IDs while protecting System Sets.

### Why this task exists

Current picker searches all Vocabulary with minimal metadata, and Set validation accepts any existing ID.

### Dependencies

- `TASK-PV-03` and `TASK-PV-04` complete and HUMAN approved.

### Exact scope

- Extend existing authenticated picker with role/session scope and context-rich projection.
- USER results: canonical plus own private, including zero-membership identities.
- ADMIN results: canonical only.
- Split System Set reference validation from private Set canonical-or-same-owner validation.
- Preserve exact-ID duplicate, ordering, complete replacement, empty private draft and System copy semantics.
- Add safe integrity checks for invalid scope references.

### Out of scope

- Private creation, private form UI, standalone search page, full aggregate picker response or fuzzy-search redesign.

### Expected files/modules

- `backend/src/repositories/vocabulary-set-repository.js`
- `backend/src/services/vocabulary-set-service.js`
- Set controller/routes and `create-app.js` as needed to pass session role/ID
- `frontend/src/services/vocabulary-set-service.js` response validation where appropriate
- Backend/frontend Set tests

### Implementation requirements

- Projection includes exact ID, word, phonetic, `CANONICAL|PRIVATE`, and deterministic primary `part_of_speech/meaning_vi`.
- Search normalization is discovery only and never collapses matches.
- Apply owner filtering before limit/order.
- Same exact ID remains unique per Set; distinct same-spelling IDs remain allowed.
- System Set copy reuses canonical IDs only.

### Security/privacy requirements

Another owner's private row affects neither results nor errors. Forged cross-owner/private-in-System IDs return safe concealed/reference errors.

### Database safety requirements

Guarded TEST DB only for integration coverage; cleanup tracks exact IDs.

### Acceptance criteria

- USER sees canonical and all own matches with distinguishing context, including zero-membership rows.
- ADMIN sees canonical results only.
- Private Sets accept canonical and same-owner private IDs.
- System Sets reject private IDs; copy remains canonical.
- Duplicate exact ID is prevented while different same-word IDs coexist and reorder correctly.

### Test requirements

Repository/service/HTTP tests for visibility, bounded deterministic projection, reference authorization, replace/reorder/remove and copy.

### Regression requirements

Existing public/USER/ADMIN Set APIs, empty drafts, ordering and copy tests remain green.

### Completion evidence

Focused Set/picker results, forged-ID authorization evidence, System copy regression and diff review.

### STOP / HUMAN approval gate

STOP after focused TEST/REVIEW; `TASK-PV-06` requires HUMAN authorization.

## TASK-PV-06 — Atomic and Idempotent Create-Private-Plus-Add Backend

### Objective

Implement the single observable operation that creates a private aggregate and appends its exact ID to an owned private Set safely under failure, retry and concurrency.

### Why this task exists

UI-only duplicate prevention cannot distinguish a retry from a new intentional same-headword creation.

### Dependencies

- `TASK-PV-05` complete and HUMAN approved.

### Exact scope

- Add USER-only `POST /api/my/vocabulary-sets/:setId/vocabulary`.
- Implement operation-record repository/service behavior, request fingerprinting, transaction, append-position serialization and safe responses/errors.
- Add rollback, retry, conflict and concurrency tests.

### Out of scope

- Frontend integration, generic idempotency framework, headword uniqueness, create without Set membership, private delete or arbitrary insertion/reorder redesign.

### Expected files/modules

- Vocabulary/Set repositories and services
- Set or private Vocabulary controller/routes
- `backend/src/create-app.js`
- Focused backend and HTTP integration tests

### Implementation requirements

- `operation_id` is an opaque client-generated UUID for one intentional action.
- Server computes the authoritative fingerprint from a deterministic canonicalized representation of target Set plus accepted normalized create payload.
- Client cannot supply/control the fingerprint.
- Same operation ID plus equivalent canonicalized request returns the original Vocabulary/membership without another write.
- Same operation ID plus materially different request conflicts safely.
- Different operation ID permits intentional identical/same-headword creation.
- Aggregate, children, Set Item and operation result commit in one transaction or all roll back.
- Lock/serialize append position without word locking.
- Exact serialization/hash implementation remains an implementation choice reviewed within this task.

### Security/privacy requirements

Derive owner from session; target must be owned private Set; cross-owner/missing target is concealed; stored fingerprint/result must not leak private payload.

### Database safety requirements

Concurrency and rollback tests only on guarded dedicated TEST DB. No raw Prisma CLI/reset bypass.

### Acceptance criteria

- First valid operation creates one private identity and one membership.
- Failure at any persistence step leaves neither unintended aggregate nor membership/operation residue.
- Equivalent retry returns original result with no duplicate writes.
- Concurrent identical operation commits once and converges on one result.
- Mismatched reuse conflicts; new operation ID creates a distinct same-word identity.
- Existing exact-ID membership/position constraints remain valid.

### Test requirements

Service transaction fault injection, HTTP success/error/idempotency tests and real DB concurrency tests.

### Regression requirements

Private Set replacement/reordering and independent intentional same-headword creation remain valid.

### Completion evidence

Transaction invariance counts, concurrent test results, safe response/error evidence and focused diff review.

### STOP / HUMAN approval gate

STOP after high-risk focused TEST/REVIEW and HUMAN approval before frontend work.

## TASK-PV-07 — Frontend Service and Private Aggregate Form Integration

### Objective

Add typed/validated frontend API operations and reusable private create/edit form behavior without implementing the full picker workflow.

### Why this task exists

The USER Set editor needs safe private aggregate input and stable operation retry state before interaction orchestration.

### Dependencies

- `TASK-PV-06` complete and HUMAN approved.

### Exact scope

- Extend frontend service for picker projection, atomic create-plus-add and private GET/PATCH.
- Build/reuse a private aggregate form for approved fields, excluding `pronunciation_url`.
- Add client-side validation, final-Meaning protection, safe loading/error/pending states and operation-ID lifecycle utility/state.
- Add unit/component tests.

### Out of scope

- Final picker/create/reuse orchestration, broad visual polish, new route/library, Learning/Quiz changes.

### Expected files/modules

- `frontend/src/services/vocabulary-set-service.js`
- New or existing private Vocabulary frontend service/module as justified by endpoint ownership
- `frontend/src/vocabulary-sets/my-vocabulary-sets-page.jsx` and/or a focused form component
- Relevant CSS and frontend tests

### Implementation requirements

- Form supports word, phonetic, Meanings, POS, Vietnamese meaning, context, CEFR and Examples.
- It sends no URL/owner/scope/system fields.
- Retry retains operation ID and equivalent payload; cancel/new intentional action generates a new ID.
- Response validation keeps exact IDs and source/context fields.
- Shared ADMIN form logic may be extracted only when it reduces duplication without coupling permissions.

### Security/privacy requirements

Frontend restrictions are UX only; do not infer authority or persist private content/idempotency data beyond necessary in-memory editor state.

### Database safety requirements

None; use mocked frontend tests. No DB access in this task unless separately approved real-stack verification is explicitly included later.

### Acceptance criteria

- Service sends exact approved requests and maps safe errors.
- Form enforces minimum aggregate UX and prevents final Meaning removal.
- Private edit supports all approved fields and explains shared-identity effect.
- Stable retry/new-operation ID behavior is testable.

### Test requirements

Frontend service and component/unit tests for payloads, validation, errors, pending state, accessibility and operation-ID lifecycle.

### Regression requirements

Existing ADMIN Vocabulary form/service and USER Set service tests remain green.

### Completion evidence

Frontend tests, lint/build, accessibility assertions and reviewed UI/service diff.

### STOP / HUMAN approval gate

STOP after focused frontend TEST/REVIEW and HUMAN approval.

## TASK-PV-08 — Context-Rich Picker and Private Set Workflow UX

### Objective

Complete the USER Set editor workflow for reuse, intentional create, edit, removal wording and zero-membership recovery.

### Why this task exists

The approved behavior must be usable without a standalone Personal Vocabulary Library and must distinguish same-headword identities.

### Dependencies

- `TASK-PV-07` complete and HUMAN approved.

### Exact scope

- Render source, word, primary POS and meaning for picker results.
- Allow reuse of selected exact IDs and intentional creation regardless of matches.
- Integrate atomic create-plus-add response without duplicate editor items.
- Offer edit only for own-private results/items and surface shared-identity information.
- Use explicit **Remove from Set** terminology.
- Support zero-membership rediscovery, loading/empty/error/retry/pending and accessible keyboard/focus behavior.
- Keep ADMIN System Set editor canonical-only through explicit capability configuration.

### Out of scope

- Standalone library, hard delete, final pixel redesign, drag-and-drop dependency, sharing/publication or new routes.

### Expected files/modules

- `frontend/src/vocabulary-sets/my-vocabulary-sets-page.jsx`
- `frontend/src/vocabulary-sets/admin-vocabulary-sets-page.jsx` where shared editor configuration is passed
- Relevant service/form modules, CSS, unit and Playwright tests

### Implementation requirements

- Key selection/added state by exact ID, never word.
- Same-word distinct IDs remain separately selectable and may coexist.
- Search is reuse-first but create remains available.
- Failed/retried atomic create preserves the same operation ID; a new intentional create does not.
- Removal updates only Set items and copy makes no deletion claim.

### Security/privacy requirements

Do not render or cache another owner's content; safe concealed errors reveal no private existence. UI role controls never replace backend enforcement.

### Database safety requirements

Real-stack tests, if run, use guarded dedicated TEST DB and exact-ID cleanup only.

### Acceptance criteria

- USER can distinguish and reuse canonical/own-private matches or intentionally create another.
- Same-word identities coexist in one Set by exact ID.
- Owner can edit shared private content and observe it across referencing Sets.
- Final removal preserves picker recovery and Progress.
- ADMIN editor exposes no private create/edit/result behavior.

### Test requirements

Component tests plus targeted USER/ADMIN real-stack Playwright for all UI states, keyboard/focus and retry behavior.

### Regression requirements

Existing Set create/edit/reorder/copy, responsive layout and accessibility remain green.

### Completion evidence

Frontend tests, lint/build, guarded browser evidence, responsive/accessibility review and exact-ID fixture cleanup.

### STOP / HUMAN approval gate

STOP after HUMAN functional/visual review and focused TEST/REVIEW.

## TASK-PV-09 — Flashcard, Progress, POS and TTS Compatibility

### Objective

Verify first—and minimally correct only if necessary—the existing Learning architecture for private exact identities.

### Why this task exists

The audit found compatible exact-ID/POS/TTS behavior, but new private scope and invalid-reference integrity require regression proof.

### Dependencies

- `TASK-PV-08` complete and HUMAN approved.

### Exact scope

- Test exact Set Item resolution for canonical/private same spelling.
- Verify exact private content and primary Meaning POS display.
- Verify native TTS receives exact private word and never borrows canonical URL/content.
- Verify independent Progress for distinct IDs, shared Progress for reused same ID and persistence after removal.
- Verify cross-owner/corrupt scope references fail safely.
- Make production changes only for demonstrated compatibility/integrity defects.

### Out of scope

- Flashcard redesign, new audio provider, Progress redesign, SRS, per-Set/per-Meaning Progress or speculative refactor.

### Expected files/modules

- Primarily `backend/test/learning/learning.test.js`, frontend Learning tests and `learning-real-stack.spec.js`
- `learning-repository.js`, service or Learning page only if a failing approved case proves a gap
- Progress view tests where identical display words must not collapse identities

### Implementation requirements

Begin with tests/audit. Preserve exact-ID repositories, event revision/idempotency and existing primary-Meaning selection.

### Security/privacy requirements

Set access and exact Item membership remain backend-authoritative; foreign private content must never enter payloads.

### Database safety requirements

Guarded dedicated TEST DB only; exact-ID fixture cleanup and existing reset guard mandatory.

### Acceptance criteria

- Same-spelling canonical/private cards never substitute.
- Correct POS/private content is displayed.
- TTS uses exact private word.
- Progress identity/sharing/removal semantics match SPEC.
- No unnecessary production refactor occurs.

### Test requirements

Backend Learning/Progress tests, frontend presentation/service tests and focused real-stack Playwright.

### Regression requirements

Existing Learning payload, events, retry/conflict, run state, Progress view and accessibility suites remain green.

### Completion evidence

Before/after compatibility audit, test results, any minimal corrective diff and guarded cleanup evidence.

### STOP / HUMAN approval gate

STOP after focused TEST/REVIEW; production edits require demonstrated evidence and review.

## TASK-PV-10 — Quiz V1 Exact-Identity and POS Compatibility

### Objective

Verify both completed Quiz types against private identities and make only evidence-driven compatibility corrections.

### Why this task exists

Quiz already uses exact IDs and POS, but private scope must not introduce substitution, leakage or Progress coupling.

### Dependencies

- `TASK-PV-08` complete and HUMAN approved. May run in parallel with `TASK-PV-09`.

### Exact scope

- Verify `VI_TO_ENGLISH` exact private Meaning/word/POS and Progress.
- Verify `UNSCRAMBLE_WORD` exact private Meaning/word tile source/POS and Progress.
- Test canonical/private and multiple private same-spelling identities independently.
- Verify authorization, stale Item behavior and question revision remain exact-ID based.
- Change production Quiz only for demonstrated defects.

### Out of scope

- New Quiz types, algorithm/run-state/feedback redesign, Meaning-level Quiz, TTS or Progress redesign.

### Expected files/modules

- Primarily backend Quiz tests, frontend Quiz tests and `quiz-real-stack.spec.js`
- Quiz repository/service/domain/page only if a failing approved case proves a gap

### Implementation requirements

Begin with verification. Preserve current normalization, shuffle, feedback, question revision and event idempotency contracts.

### Security/privacy requirements

Foreign private Set/Item IDs remain concealed and cause no Progress mutation or content disclosure.

### Database safety requirements

Guarded dedicated TEST DB only; exact-ID cleanup and no raw reset/migration command.

### Acceptance criteria

- Both Quiz types use exact selected identity and display corresponding POS.
- Same-spelling identities produce independent questions/answers/Progress.
- Cross-owner and removed Item cases fail safely.
- No unnecessary Quiz production change occurs.

### Test requirements

Backend read/answer/integration, frontend service/presentation/run-state and focused real-stack tests.

### Regression requirements

All current Quiz normalization, shuffle, feedback, concurrency and transient-run behavior remains green.

### Completion evidence

Compatibility test matrix, regression results, any minimal corrective diff and cleanup evidence.

### STOP / HUMAN approval gate

STOP after focused TEST/REVIEW; no Quiz redesign is authorized.

## TASK-PV-11 — Cross-Feature Regression, Documentation Sync and Closure Preparation

### Objective

Run the complete guarded integration matrix, synchronize authoritative documentation to verified implementation, and prepare formal TEST/REVIEW evidence.

### Why this task exists

Personal Vocabulary changes a shared aggregate consumed by several completed features and cannot be considered complete from focused task tests alone.

### Dependencies

- `TASK-PV-01` through `TASK-PV-10` complete, individually tested/reviewed and HUMAN approved.

### Exact scope

- Run consolidated schema/backend/frontend/browser regression matrix.
- Verify all SPEC AC-01 through AC-30 and close the traceability matrix.
- Confirm exact fixture cleanup and no unintended writes/leaks.
- Synchronize `DATABASE.md`, `API_SPEC.md`, `UI_UX_SPEC.md`, `ARCHITECTURE.md` if applicable and `FEATURE_STATUS.md` to verified stage only.
- Produce formal TEST/REVIEW preparation evidence; do not self-approve `DONE`.

### Out of scope

- New functionality, unrelated refactor, production deployment, feature status `DONE` without HUMAN approval, commit or push unless separately authorized.

### Expected files/modules

- Existing backend/frontend/Playwright test suites and guarded helpers
- Project source only for approved defect corrections followed by re-test
- Relevant authoritative docs and feature status

### Implementation requirements

- Execute focused suites before aggregate real-stack runs.
- Preserve completed feature contracts and record any failure honestly.
- Return defects to their owning task or appropriate SPEC/PLAN gate; do not hide or waive them.

### Security/privacy requirements

Complete role/owner/direct-ID leakage matrix, System/ADMIN isolation and safe error review are mandatory.

### Database safety requirements

Dedicated TEST DB only; Main/Preview/Production prohibited; guard/preparation workflow and exact cleanup required; no raw Prisma bypass.

### Acceptance criteria

- Every AC has passing evidence at an appropriate layer.
- Canonical, Set, Learning, Progress, Quiz, TTS and authorization regressions pass.
- Documentation matches verified implementation without premature `DONE`.
- No test fixtures/listeners/processes remain.

### Test requirements

Full approved backend, frontend unit/lint/build and real-stack Playwright matrix plus diff/secret/scope checks.

### Regression requirements

All affected completed features listed in PLAN Section 22 must pass; unrelated failures are reported, not concealed.

### Completion evidence

Command/results ledger, AC matrix, cleanup evidence, final diff, formal TEST report and REVIEW findings/status.

### STOP / HUMAN approval gate

STOP at `TESTED`/review result. HUMAN approval is required before updating Personal Vocabulary V1 to `DONE` or committing/pushing.

## 4. SPEC Acceptance-Criteria Traceability

| SPEC AC | Owning task(s) | Planned primary test layer |
|---|---|---|
| AC-01 | PV-02, PV-03, PV-04 | Schema + backend integration |
| AC-02 | PV-02, PV-06 | Migration safety + HTTP concurrency |
| AC-03 | PV-02, PV-06, PV-08 | Schema + backend + browser |
| AC-04 | PV-04, PV-06 | HTTP authorization integration |
| AC-05 | PV-04, PV-05, PV-09, PV-10 | Backend/HTTP + learning/quiz regression |
| AC-06 | PV-04, PV-06, PV-07 | Backend validation + frontend component |
| AC-07 | PV-04, PV-07 | Backend transaction + frontend validation |
| AC-08 | PV-04, PV-07, PV-08 | HTTP + component/browser |
| AC-09 | PV-04 | Backend/HTTP integration |
| AC-10 | PV-05, PV-08 | Picker integration + browser |
| AC-11 | PV-05, PV-06, PV-08 | Backend + browser workflow |
| AC-12 | PV-04, PV-05, PV-08 | Backend + real-stack browser |
| AC-13 | PV-05, PV-08 | Set integration + browser |
| AC-14 | PV-05, PV-08 | Constraint/service + browser |
| AC-15 | PV-05 | Backend Set/picker integration |
| AC-16 | PV-05, PV-08 | Backend + real-stack copy workflow |
| AC-17 | PV-05, PV-08, PV-09 | Set + browser + Progress integration |
| AC-18 | PV-05, PV-08 | Picker integration + browser recovery |
| AC-19 | PV-06 | Transaction fault-injection/integration |
| AC-20 | PV-06, PV-07, PV-08 | Backend concurrency + frontend retry/browser |
| AC-21 | PV-09, PV-10 | Learning/Quiz integration and real-stack |
| AC-22 | PV-09 | Frontend Learning + browser |
| AC-23 | PV-10 | Quiz read/frontend/browser |
| AC-24 | PV-10 | Quiz read/frontend/browser |
| AC-25 | PV-09 | Learning presentation/browser TTS stub |
| AC-26 | PV-09 | Learning Progress backend/real-stack |
| AC-27 | PV-03, PV-04 | ADMIN/USER HTTP authorization |
| AC-28 | PV-04, PV-05, PV-08 | Route/scope assertions + UI regression |
| AC-29 | PV-03, PV-04, PV-05, PV-06 | HTTP safe-error integration |
| AC-30 | PV-11 | Full cross-feature regression matrix |

`TASK-PV-11` verifies the complete matrix but does not replace focused ownership by earlier tasks.

## 5. Task Size Review

| Task | Size | Review assessment |
|---|---|---|
| PV-01 | SMALL | Documentation/design verification only. |
| PV-02 | LARGE | High-risk but cohesive schema/migration unit; use migration and constraint checkpoints rather than split before implementation. |
| PV-03 | MEDIUM | Canonical repository/service boundary with focused regressions. |
| PV-04 | LARGE | Complete owner-private aggregate plus authorization; cohesive because nested persistence and concealment must be reviewed together. |
| PV-05 | LARGE | Picker and Set validation touch shared boundaries; retain together to prevent scope mismatch, with picker and Set sub-checkpoints. |
| PV-06 | LARGE | Highest-risk atomic/idempotent transaction; should remain one integrity unit, implemented with explicit transaction/concurrency checkpoints. |
| PV-07 | MEDIUM | Frontend service/form foundation without full workflow orchestration. |
| PV-08 | LARGE | Integrated editor workflow; coherent browser-review boundary, with reuse/create/edit/removal sub-checkpoints. |
| PV-09 | MEDIUM | Verification-first Learning/Progress compatibility. |
| PV-10 | MEDIUM | Verification-first Quiz compatibility. |
| PV-11 | LARGE | Broad closure task but mostly orchestration/evidence; splitting would fragment the final regression gate. |

No formal split is recommended before implementation. PV-02, PV-04, PV-05, PV-06 and PV-08 require internal checkpoints and individual HUMAN gates. If any exceeds its approved boundary during implementation, stop and return to TASK review instead of silently expanding it.

## 6. Execution and Safety Notes

- No task begins until this TASK document is HUMAN approved; each task then stops at its own gate.
- Historical migrations are immutable.
- All DB work uses only the guarded dedicated TEST DB; Main, Preview and Production are prohibited.
- Never use word/headword as private identity or idempotency control.
- Do not add dependencies unless an approved PLAN revision establishes necessity.
- Preserve user changes and keep each implementation diff scoped to one task.
- Feature status advances only with verified evidence and HUMAN approval.

## 7. Approval Gate

```text
PRODUCT CONTRACT: HUMAN APPROVED
SPEC: HUMAN APPROVED
PLAN: HUMAN APPROVED
TASK: HUMAN APPROVED
TASK-PV-01: COMPLETE — HUMAN APPROVED
TASK-PV-02: COMPLETE — HUMAN APPROVED
TASK-PV-03: COMPLETE — HUMAN APPROVED
TASK-PV-04: COMPLETE — HUMAN APPROVED
TASK-PV-01 THROUGH TASK-PV-11: COMPLETE — HUMAN APPROVED
IMPLEMENT: COMPLETE
TEST: PASS — AC-01 THROUGH AC-30
REVIEW: APPROVED
PERSONAL VOCABULARY V1: DONE — HUMAN APPROVED
INTEGRATION INTO DEV: NOT YET
```
