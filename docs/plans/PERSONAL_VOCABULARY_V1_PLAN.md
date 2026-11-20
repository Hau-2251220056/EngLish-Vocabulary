# PLAN: Personal Vocabulary V1 — Private Capture and Set Reuse

**Approved SPEC:** `docs/specs/PERSONAL_VOCABULARY_V1_SPEC.md`

**PLAN status:** `HUMAN APPROVED`

**TASK / implementation authorized:** `NO`

## 1. Context and Summary

The approved feature extends the existing single-scope `VOCABULARY` aggregate into two identity scopes without changing the aggregate's Meaning/Example shape:

- canonical rows remain global and ADMIN-managed;
- private rows have exactly one USER owner and are owner-isolated;
- spelling is discovery data, never identity;
- Set membership, learning, Quiz and Progress continue to follow exact `vocabulary_id`.

The recommended implementation adds nullable Vocabulary ownership (`NULL` means canonical), replaces global word uniqueness with canonical-only case-insensitive uniqueness, adds a non-unique owner/search index, and introduces a narrowly scoped idempotency record for the atomic create-private-plus-add operation. Existing route/controller/service/repository layers are extended rather than replaced. No new dependency, role, external service or standalone Personal Vocabulary page is planned.

## 2. Current Architecture Findings

### 2.1 Database

- `backend/prisma/schema.prisma` contains one global `VOCABULARY` model with no owner/scope field.
- `backend/prisma/migrations/20260921000001_add_vocabulary_aggregate/migration.sql` creates global unique index `VOCABULARY_word_lower_key` on `LOWER(word)`.
- `VOCABULARY_SET_ITEM` already enforces exact identity uniqueness with `UNIQUE(vocabulary_set_id, vocabulary_id)` and explicit position uniqueness.
- `LEARNING_PROGRESS` already enforces `UNIQUE(user_id, vocabulary_id)`.
- Existing canonical rows can be safely interpreted as canonical because no USER-private creation path currently exists.

### 2.2 Backend

- ADMIN Vocabulary uses `vocabulary-routes.js -> vocabulary-controller.js -> vocabulary-service.js -> vocabulary-repository.js`.
- Set management and picker use the equivalent `vocabulary-set-*` modules.
- Learning and Quiz repositories load Vocabulary by relations from exact Set Items; event/answer mutations address exact `vocabulary_id`.
- Existing auth middleware derives the session USER, and role middleware already separates USER and ADMIN routes.

### 2.3 Frontend

- `MyVocabularySetsPage` owns the USER Set list/detail/editor and its current canonical picker.
- `VocabularySetEditor` stores items by `vocabulary_id`, already preventing only duplicate exact IDs and preserving order.
- ADMIN System Set editing reuses `VocabularySetEditor`, so picker behavior must remain role/scope-aware.
- Flashcard already displays primary-Meaning `part_of_speech` and uses stored audio before exact-word native TTS.
- Both Quiz prompts already validate and render `part_of_speech`.

## 3. Existing Feature Impact Audit

| Area | Classification | Actual modules | Current behavior / affected assumption | Required change and regression proof |
|---|---|---|---|---|
| A. Prisma/database | REFACTOR, REGRESSION RISK | `backend/prisma/schema.prisma`; Vocabulary/Set/Progress migrations | Vocabulary is globally unique by lowercased word and has no owner. | Add owner scope, canonical-only uniqueness, owner/search index and idempotency persistence; prove existing rows remain canonical and exact-ID FKs/Progress survive. |
| B. ADMIN Vocabulary CRUD/search | REFACTOR, REGRESSION RISK | `vocabulary-repository.js`, `vocabulary-service.js`, controller/routes; `admin-vocabulary-route.jsx`; services/tests | Repository list/detail/update/delete sees every Vocabulary row; duplicate lookup is global. UI list search is client-side. | Scope every ADMIN repository mutation/read to canonical rows; keep duplicate validation canonical-only; concealed/not-found behavior for private IDs; regress full ADMIN CRUD/search. |
| C. Vocabulary Set CRUD | EXTEND, REGRESSION RISK | `vocabulary-set-service.js`, repository/controller/routes | Reference validation only checks IDs exist. | Private Set writes accept canonical or same-owner private IDs; System Set writes accept canonical only; preserve aggregate replacement and ordering. |
| D. USER Set editor | EXTEND | `my-vocabulary-sets-page.jsx`, relevant CSS, frontend Set service | Picker shows only word/phonetic; no private create/edit; removal icon copy is generic. | Add context-rich source-labelled results, explicit reuse/create, private form/edit action, Remove from Set wording and safe states. |
| E. Picker/search | REFACTOR, REGRESSION RISK | Set repository/service/controller; `GET /api/vocabulary-set-picker`; frontend Set service/editor | Searches every current row by case-insensitive substring and returns `{id,word,phonetic}`; role/context is not passed to service. | USER projection is canonical + own private with primary Meaning context/source; ADMIN projection canonical-only; zero-membership private rows remain searchable; deterministic bounded ordering. |
| F. Item add/remove/reorder/replace | EXTEND | Set service/repository; `VocabularySetEditor` | Exact-ID duplicate prevention and complete replacement already work. | Keep exact-ID uniqueness/order; add scope/owner validation. Same-headword distinct IDs need no membership schema change. |
| G. System Sets | EXTEND, REGRESSION RISK | ADMIN Set routes/service/repository/page | Any existing Vocabulary ID can currently be referenced. | Enforce `owner_id IS NULL` for every System Set Item and canonical-only picker results. |
| H. System Set copy | EXTEND, REGRESSION RISK | `copySystemSet`; repository; copy tests | Copies exact source IDs into a private Set. | Preserve exact canonical IDs; validate/assume source is canonical-only; copied Set can later accept owner-private IDs normally. |
| I. Learning/Flashcard | NO CHANGE to identity architecture; EXTEND tests | `learning-repository.js`, `learning-service.js`, Learning controller/routes; `learning-foundation-page.jsx` | Resolves Set Item relation to exact Vocabulary ID, selects exact aggregate, displays POS and uses exact `word` for TTS. | Preserve paths; add defense against invalid cross-owner/private-in-System data if encountered and private-identity regression tests. No word lookup exists. |
| J. Learning Progress | NO CHANGE, REGRESSION RISK | `LEARNING_PROGRESS`; Learning repository/service/progress page | Progress lookup is exact `(user_id,vocabulary_id)`. | Preserve unchanged; test independent same-spelling IDs, shared reused ID and removal persistence. |
| K. Quiz `VI_TO_ENGLISH` | NO CHANGE to core; EXTEND tests | Quiz repository/service/domain/controller; Quiz frontend | Exact Set Item/Vocabulary, primary Meaning, POS prompt and exact word answer already used. | Preserve; verify private exact-ID prompt/answer/Progress and privacy. |
| L. Quiz `UNSCRAMBLE_WORD` | NO CHANGE to core; EXTEND tests | Same Quiz modules | Exact Vocabulary ID and word seed tiles/revision; POS already in prompt. | Preserve; verify same-spelling IDs do not substitute and private exact word drives tiles. |
| M. Pronunciation/TTS | NO CHANGE; REGRESSION RISK | `learning-foundation-page.jsx`, `learning-presentation.js` | Stored `pronunciation_url` preferred; otherwise `SpeechSynthesisUtterance(currentCard.word)`. | Private creation/update excludes URL; exact private word reaches current fallback; prove no spelling-based canonical lookup. |
| N. Auth/privacy | EXTEND, REGRESSION RISK | authentication/role middleware; new private service/repository paths; Set/Learning/Quiz repositories | USER/ADMIN role gates and private Set concealment exist; Vocabulary has no ownership authorization. | Reuse USER middleware, derive owner from session, owner-scope queries before lookup, conceal cross-user IDs, give ADMIN no private route/access. |
| O. Automated tests | EXTEND/REFACTOR | backend Vocabulary/Set/Learning/Quiz suites; frontend unit; real-stack Playwright | Existing tests assert global uniqueness and canonical-only picker assumptions. | Replace only obsolete assertions and add full approved scenarios; retain completed-feature regressions. |
| P. Routes/API clients | EXTEND | `create-app.js`, user Set routes, frontend Set service/router | No USER private Vocabulary endpoints; existing UI route is sufficient. | Add USER-only nested create-plus-add and private detail/update APIs; extend existing picker. No standalone frontend route. |

## 4. Word-Based Identity Assumption Audit

| Location | Classification | Finding and action |
|---|---|---|
| `backend/prisma/migrations/20260921000001_add_vocabulary_aggregate/migration.sql` | MUST REFACTOR | Global `UNIQUE LOWER(word)` blocks all approved coexistence. A new migration must replace it with canonical-only partial uniqueness. Historical migration remains immutable. |
| `backend/src/repositories/vocabulary-repository.js::findByWordInsensitive` | MUST REFACTOR | Global first-match lookup powers duplicate validation. Replace with explicit canonical-only lookup; private create/update must not call word uniqueness validation. |
| `backend/src/services/vocabulary-service.js::ensureUniqueWord` and `P2002` mapping | MUST REFACTOR | Current ADMIN create/update assumes every same-word row conflicts. Retain collision only among canonical rows and map only the canonical partial-index conflict. |
| `backend/src/repositories/vocabulary-repository.js::list/findCompleteById/update/delete` | NEEDS EXTENSION | Queries by ID/list are not word-based but currently unscoped; ADMIN must add canonical predicate so private rows never leak through aggregate APIs. |
| `backend/src/repositories/vocabulary-set-repository.js::searchVocabularyPicker` | NEEDS EXTENSION | Case-insensitive word contains is valid discovery, but it searches all rows and returns insufficient context. Add role/owner scope and Meaning/source projection; never choose one row by spelling. |
| `backend/src/repositories/vocabulary-set-repository.js::findVocabularyIds` | MUST REFACTOR | ID-based (safe identity) but scope-blind. Split canonical-only System validation from canonical-or-owner-private USER validation. |
| `frontend/src/vocabulary/admin-vocabulary-route.jsx` | SAFE after backend scope | Client-side lowercased substring filtering is display search only. It remains safe if backend list is canonical-only. |
| `frontend/src/vocabulary-sets/my-vocabulary-sets-page.jsx` | NEEDS EXTENSION | Exact-ID duplicate checks are safe; word-only picker display is ambiguous for same spelling. Add source/POS/meaning while keeping keys and membership by ID. |
| `backend/src/services/quiz-domain.js::normalizeQuizAnswer/createUnscrambleProjection` | SAFE | Word normalization is answer/tile behavior after exact-ID resolution, not identity lookup. Preserve it. |
| Learning repository/service | SAFE | No word re-resolution; Set Item relation and exact ID are used end-to-end. |
| Quiz repository/service | SAFE | No lookup by spelling; exact Set Item/Vocabulary ID and exact word are locked/evaluated. |
| `learning-foundation-page.jsx` TTS | SAFE | Uses `currentCard.word` from exact-ID payload; no pronunciation lookup by spelling. |
| Integration-test cleanup queries using `startsWith(word)` | NEEDS EXTENSION | Test cleanup discovery can collide across new scopes. Future fixtures should retain created IDs/owner IDs and delete in FK-safe exact-ID order, never assume word uniquely identifies a row. |

No production `findUnique` by word, canonical pronunciation lookup by word, or frontend map keyed by word was found. Exact-ID list keys and Set membership are already safe.

## 5. Data Model and Migration Strategy

### 5.1 Vocabulary ownership representation

Recommended minimal model:

- add nullable `VOCABULARY.owner_id -> USER.id`;
- `owner_id IS NULL` means canonical;
- non-null `owner_id` means USER-private owned by that USER;
- add inverse USER relation for owned private Vocabulary;
- do not add a redundant scope enum: nullability plus server-controlled routes fully distinguishes the two approved scopes.

Use `ON DELETE RESTRICT` for `owner_id`. User deletion/deactivation must not silently delete private learning content, Set references or Progress. No private hard-delete behavior is added.

### 5.2 Word constraints and indexes

- Drop the current global `VOCABULARY_word_lower_key` in the new forward migration.
- Create a unique partial functional index on `LOWER(word)` **where `owner_id IS NULL`** so canonical case-insensitive uniqueness remains intact.
- Create a non-unique search index suitable for owner-scoped private discovery, e.g. owner plus `LOWER(word)`. It must not enforce uniqueness.
- Do not create `(owner_id, normalized_word)` uniqueness or any canonical/private collision constraint.
- Keep `VOCABULARY_SET_ITEM(vocabulary_set_id,vocabulary_id)` and Progress uniqueness unchanged.

### 5.3 Scoped create-operation record

Recommend one narrowly scoped persistence model for create-plus-add idempotency, conceptually `PRIVATE_VOCABULARY_CREATE_OPERATION`:

- client-generated UUID `operation_id` as primary/unique operation identity;
- `owner_id`, target private `vocabulary_set_id`, created `vocabulary_id`;
- deterministic request fingerprint covering target Set and complete normalized create payload;
- creation timestamp;
- owner relation `RESTRICT`, target Set relation `CASCADE`, Vocabulary relation `RESTRICT`.

It is not a general audit/event system. It stores only what is needed to recognize a retry of the same operation and detect reuse of an operation ID with different input. No cleanup policy is required in V1; arbitrary expiration would weaken retry semantics.

### 5.4 Alternatives considered

1. **Frontend pending-button only:** rejected; cannot protect network retry or concurrent clients.
2. **Headword uniqueness:** rejected; violates approved same-headword identities.
3. **Idempotency field directly on Vocabulary:** smaller schema but does not cleanly bind/validate target Set and original request, and mixes operation metadata into the domain aggregate.
4. **Scoped operation record (recommended):** cleanly distinguishes same operation from intentional new operations while allowing identical payload/headword under new operation IDs.

### 5.5 Migration sequencing and safety

1. Add nullable ownership and idempotency structures without changing existing reads.
2. Verify existing Vocabulary rows all have `owner_id = NULL` by construction/migration default.
3. Replace the global word index with the canonical partial unique index in one reviewed migration.
4. Add FK and non-unique search indexes.
5. Regenerate Prisma client only during authorized implementation.
6. Validate constraints and current canonical counts on the dedicated TEST DB through guarded workflow.

The old global unique index guarantees existing canonical rows cannot conflict when the partial index is created. Rollback to the former schema is safe only before private duplicate-spelling rows exist. After private data is written, rollback requires data export/remediation; therefore deployment should use backup/restore readiness and forward-fix rather than a blind down migration.

## 6. Backend and API Strategy

### 6.1 Reuse and module boundaries

- Extend current repositories/services/controllers rather than create a parallel aggregate implementation.
- Extract shared Vocabulary aggregate validation/normalization and owned-child replacement helpers only if needed to keep ADMIN and private paths consistent; retain authorization/business decisions in their respective services.
- Add USER-private methods to the existing Vocabulary repository or a small private-focused repository facade over the same Prisma models. Do not duplicate Meaning/Example persistence logic.
- Wire USER-only routes through existing authentication and `USER` role middleware in `create-app.js`.

### 6.2 Extend picker

Keep `GET /api/vocabulary-set-picker?query=<word>` to avoid a duplicate search API.

- **USER:** return bounded canonical plus authenticated-owner-private matches, including zero-membership rows.
- **ADMIN:** return canonical matches only for System Set editing.
- Pass `req.user.id` and role to service; do not trust owner/scope query input.
- Deterministic ordering: case-insensitive word, canonical/private source discriminator, primary Meaning order, then Vocabulary ID. Exact ordering may be finalized in API documentation, but it must not collapse same-word results.
- Proposed result projection:
  - `id`, `word`, nullable `phonetic`;
  - `source: CANONICAL | PRIVATE`;
  - `primary_meaning: { part_of_speech, meaning_vi }`.
- Reuse existing primary-Meaning selection semantics; do not expose full aggregates in picker.

Errors remain existing `400`, `401`, `403`, safe `500`; search returns an empty array when no match. Another USER's data is filtered before limiting/counting.

### 6.3 Atomic create-private-plus-add

Add USER-only endpoint:

`POST /api/my/vocabulary-sets/:setId/vocabulary`

Purpose: create one intentional private identity and append its exact ID to the current owned private Set atomically.

Request:

- `operation_id`: required client-generated UUID identifying this user action;
- `vocabulary`: approved private create fields (`word`, nullable `phonetic`, non-empty `meanings` with optional nested fields); `pronunciation_url` and server fields rejected.

Success: `201` for first completion, returning the created private aggregate plus updated membership/position information sufficient for editor reconciliation. An identical retry returns the same representation with `200` (or an equivalent documented idempotent success chosen consistently before implementation).

Validation/authorization:

- USER session and role required;
- target Set must be an owned private Set, concealed otherwise;
- operation ID reuse with different target/payload returns a safe `409 PRIVATE_VOCABULARY_OPERATION_CONFLICT`;
- invalid aggregate returns `400 VALIDATION_ERROR`;
- failures roll back aggregate, children, Set Item and operation record;
- same word never causes conflict.

The service transaction locks/authorizes the target Set, claims the operation record, creates the owner-scoped aggregate with `pronunciation_url = NULL`, appends the next contiguous position, and completes the operation record. On unique operation-ID race, the service reloads the owner-scoped record and returns the same completed result only when fingerprint/target match.

### 6.4 Owner-private detail and update

Add minimal USER-only endpoints:

- `GET /api/my/vocabulary/:vocabularyId` — owner-only complete private aggregate for editing.
- `PATCH /api/my/vocabulary/:vocabularyId` — owner-only aggregate update.

The repository predicates by both `id` and session `owner_id`; missing/foreign/canonical IDs use concealed `404 VOCABULARY_NOT_FOUND`. PATCH permits only approved private editable fields, never `pronunciation_url` or server fields. It preserves at least one Meaning and stable owned-child validation/atomic replacement. Word matching is never a conflict.

No list, delete, standalone catalog or ADMIN-private route is added.

### 6.5 Existing Set API behavior

- Existing private Set create/PATCH bodies continue to submit exact item IDs.
- Private reference validation accepts only canonical (`owner_id NULL`) or requester-owned private rows.
- System create/PATCH validation accepts only canonical rows.
- Invalid/inaccessible private references are concealed as `VOCABULARY_NOT_FOUND` rather than exposing ownership.
- Complete replacement, ordering, empty private draft and exact-ID duplicate behavior remain unchanged.

## 7. Atomicity, Idempotency and Concurrency

Recommended algorithm, implemented later within one Prisma interactive transaction:

1. Validate request shape and UUIDs before transaction.
2. Lock/re-authorize the target private Set for the session USER.
3. Claim `operation_id` with owner, target Set and request fingerprint.
4. If the same completed operation exists with matching fingerprint/target, return its exact created Vocabulary/membership without another write.
5. If the ID exists with different input/target/owner, return a safe conflict/concealed result as applicable.
6. For a new operation, create owner-private Vocabulary and nested content, create the Set Item at append position, and record result identity in the same transaction.
7. Translate operation-record uniqueness races by re-reading and applying steps 4–5.

Position allocation must be concurrency-safe with existing `UNIQUE(set_id,position)`. PLAN recommends locking the target Set (or its ordered Item range through a supported repository query) before calculating append position; retry serialization/conflict handling remains scoped to the operation. No headword lock or uniqueness participates.

Frontend generates a fresh operation UUID only when the USER initiates a new intentional create. Pending/retry retains it; cancel/new create produces a new ID. UI disabling prevents casual double clicks but is not the security/integrity boundary.

## 8. Authorization and Privacy Strategy

- Derive `owner_id` only from authenticated session.
- USER routes require existing USER middleware; ADMIN routes remain ADMIN-only and canonical-scoped.
- Owner-private repository reads/updates always include `owner_id` in the predicate before returning content.
- Picker filters by `owner_id IS NULL OR owner_id = session user` for USER, and `owner_id IS NULL` for ADMIN.
- Private Set saves enforce canonical-or-same-owner references; System Set saves enforce canonical-only references.
- Learning/Quiz retain Set access checks and exact membership locks. Add repository/service integrity checks so corrupted cross-owner private Items or private Items in System Sets fail safely rather than leak.
- No client-supplied owner, scope or source value is authoritative.
- Cross-user direct IDs use the existing concealed not-found style.

## 9. ADMIN and System Set Compatibility

### ADMIN canonical Vocabulary

- Add `owner_id IS NULL` to list, detail, create collision lookup, update and delete paths.
- ADMIN create always writes canonical scope; request cannot set owner/scope.
- Canonical create/update retains case-insensitive canonical-only duplicate `409 VOCABULARY_WORD_ALREADY_EXISTS`.
- A private ID passed to ADMIN detail/PATCH/delete is indistinguishable from missing.
- Frontend ADMIN UI can remain functionally unchanged because backend results stay canonical-only.

### System Sets

- ADMIN picker returns canonical rows only.
- System Set create/PATCH validates every exact ID is canonical.
- Public System Set detail and learning remain safe because only canonical Items can enter.
- Copy preserves source canonical IDs; copy transaction does not duplicate Vocabulary.
- Add regression tests for forged private IDs and existing copy behavior.

## 10. Learning, Flashcard and Progress Compatibility

- Preserve `learning-repository.js` relation traversal from Set Item to exact Vocabulary; do not introduce word lookup.
- Preserve `lockSetItem(setId,vocabularyId)` and exact Progress lookup.
- Existing payload already contains full aggregate including `part_of_speech`.
- Existing Flashcard UI already displays primary-Meaning POS; extend fixtures/real-stack coverage to private identities rather than redesign UI.
- Existing TTS fallback already speaks `currentCard.word`; verify private rows always keep `pronunciation_url = NULL` and exact private word reaches the fallback.
- Add safe integrity handling for invalid scope/owner Set Items if repository filters cannot guarantee complete valid sets.
- Progress view may list multiple identical words because identities differ; key/state remains record/ID-based. Add regression ensuring it does not collapse by word.

## 11. Quiz Compatibility

- Preserve exact-ID repository joins and locks in `quiz-repository.js`.
- Preserve `selectPrimaryMeaning`, `question_revision` inputs including `vocabularyId`, exact word evaluation and `(user_id,vocabulary_id)` Progress.
- Backend question payload already contains `prompt.part_of_speech` for both types.
- Frontend service already requires it and `Prompt` already renders it.
- Required changes should therefore be limited to authorization-integrity checks and new private/same-word regression fixtures unless audit during implementation exposes a scope leak.
- No Quiz endpoint, type, normalization, tile algorithm, feedback or run-state redesign is planned.

## 12. Frontend Functional Plan

### 12.1 Private Set editor

Extend `my-vocabulary-sets-page.jsx` and `vocabulary-set-service.js`:

- Render picker result word, source label (System/Private), primary part of speech and Vietnamese meaning.
- Continue exact-ID added-state checks so same-word distinct IDs remain selectable.
- Offer explicit actions to reuse each result and to create another private Vocabulary regardless of matches.
- Add an embedded/modal private aggregate form reusing the ADMIN form's field behavior where practical but excluding `pronunciation_url` and all server fields.
- Generate and retain `operation_id` for pending/retry of create-plus-add; generate a new ID for a new intentional creation.
- Reconcile atomic response into editor Items without double-add.
- Offer edit only for `source: PRIVATE`; fetch complete private aggregate before edit and update shared content.
- Explain that editing a reused identity affects every Set referencing it, without locking final visual presentation.
- Change membership control accessible text/confirmation to unambiguously say **Remove from Set**, not delete Vocabulary.
- Preserve loading, empty, validation, operational error, concealed not-found and retry states.
- Zero-membership recovery requires no new page: owner-aware picker returns it.

### 12.2 ADMIN Set editor

The shared editor must receive an explicit mode/capability configuration so ADMIN sees canonical-only results and no private create/edit actions. Avoid role inference from visual state.

### 12.3 Learning and Quiz

Flashcard and Quiz already display primary Meaning POS. Add targeted assertions/fixtures for canonical and private identities; only adjust components if tests reveal missing accessible association or same-word ambiguity. No broad styling change.

## 13. Validation and Business Logic Placement

- **Controller:** extract params/body/session identity, call service, map known safe errors.
- **Service:** enforce role/ownership, allowed fields, at-least-one Meaning, private URL exclusion, scope-specific Set references, atomic/idempotent operation and concealment decisions.
- **Repository:** apply owner/canonical predicates, exact-ID queries, transaction operations and deterministic search projections.
- **Database:** enforce FK ownership existence, canonical word uniqueness, operation-ID uniqueness, exact Set membership/position uniqueness and Progress identity.
- **Frontend:** mirror validation for UX and prevent duplicate pending actions; never enforce authoritative ownership/scope.

Existing length/CEFR/child-ownership rules are reused. Private word equality is never validation failure.

## 14. Test Strategy

### A. Schema and migration safety

- Guarded dedicated TEST DB only: migrate from current baseline with canonical fixtures; verify all existing rows become canonical.
- Verify canonical case-insensitive duplicate rejection remains.
- Verify canonical plus multiple same-word private rows for one/different owners are permitted.
- Verify owner FK, canonical partial unique index, non-unique search index, idempotency constraints, exact Set membership and Progress constraints.
- Verify private owner delete is restricted and existing external delete behavior remains.
- Validate migration status and rollback limitation documentation; never run destructive checks against Main/Preview/Production.

### B. Backend component/service

- Aggregate validation for minimum/optional fields, final Meaning protection and `pronunciation_url` rejection.
- Owner update including same-word headword change and shared identity.
- ADMIN canonical scoping for every repository/service operation.
- Picker canonical+owner projection, deterministic bounded order, zero-membership inclusion and other-owner exclusion.
- Private/System Set exact-ID reference authorization.
- Atomic rollback at each create/Meaning/Example/Item/operation failure point.
- Same `operation_id` identical retry returns same result; mismatched reuse conflicts; concurrent same operation creates once; distinct operation IDs allow identical words/payloads.

### C. HTTP/API integration

- Guest/ADMIN rejection on USER private APIs; USER cannot reach another owner's ID.
- Canonical reuse, own-private reuse and intentional same-word create.
- Different-user same spelling without leakage.
- Private detail/PATCH concealment and canonical non-mutation.
- Exact duplicate membership conflict versus allowed same-spelling distinct IDs.
- System Set forged private ID rejection and copy preservation.
- Safe envelopes/statuses for validation, concealment, idempotency conflict and unexpected failure.

### D. Frontend unit/component

- Service endpoint/request/response/error mapping, including stable operation ID retry.
- Picker renders source, POS and meaning; same-word results remain independently keyed/selectable.
- Create form excludes URL/system fields and protects final Meaning.
- Private edit and shared-identity information.
- Remove from Set terminology.
- Loading/empty/error/retry/pending/accessibility behavior.
- Existing Flashcard and Quiz POS rendering/TTS helpers remain green with private fixtures.

### E. Browser/Playwright real-stack

- Create private identity and atomically add it; network-response retry/double-submit does not duplicate.
- Reuse same ID across Sets; edit propagates; remove/final remove preserves picker recovery and Progress.
- Canonical/private and multiple own-private same-word identities coexist and may share one private Set.
- Cross-user guessed IDs and search stay concealed.
- System Set rejects private ID; copy remains canonical then accepts owner-private addition.
- Flashcard exact private content, POS and exact-word TTS fallback.
- Both Quiz types use exact private content/POS and separate same-word identities.

### F. Existing-feature regression

- Full guarded backend Vocabulary, Set, Learning and Quiz suites.
- Frontend Vocabulary/Set/Learning/Quiz services and presentation suites.
- Auth/App Layout route regressions.
- Real-stack ADMIN Vocabulary, public/ADMIN/USER Set, Learning, Progress and Quiz suites.
- Update cleanup helpers to track exact fixture IDs rather than rely on unique words.

### Database safety

All migration/integration work in future stages must use the existing guarded dedicated TEST DB helpers and approved preparation scripts. Main, Preview and Production DBs are prohibited. No raw Prisma CLI bypass or unguarded reset is permitted.

## 15. Implementation Phases

### Phase 1 — Contract documentation and guarded data foundation

- Likely files: approved docs, Prisma schema/new migration only when authorized, generated client.
- Dependency: approved PLAN/TASK and guarded TEST DB.
- Gate: migration safety tests prove canonical preservation and same-word coexistence.
- Risk/rollback: highest data risk; deployment becomes forward-only after private duplicate-spelling data exists.

### Phase 2 — Canonical scoping and private aggregate backend

- Files: Vocabulary repository/service/controller/routes, `create-app.js`, focused backend tests.
- Deliver canonical-only ADMIN behavior plus owner-only private detail/update and shared aggregate validation.
- Gate: ADMIN regressions and private ownership/validation tests pass.

### Phase 3 — Picker, Set authorization and atomic create-plus-add

- Files: Set repository/service/controller/routes; idempotency repository logic; backend Set/private tests.
- Deliver role-aware picker, context projection, exact-ID authorization and atomic/idempotent operation.
- Gate: concurrency/rollback/privacy/System Set tests pass.

### Phase 4 — USER Set editor functional integration

- Files: frontend Set service/page/CSS and unit/browser tests.
- Deliver source/context results, reuse/create/edit, operation retry state, Remove from Set wording and zero-membership recovery.
- Gate: accessible component and real-stack Set workflows pass.

### Phase 5 — Learning/Progress/Quiz compatibility

- Files: primarily fixtures/tests; minimal repository/component changes only if integrity tests expose gaps.
- Verify exact-ID content, POS, TTS, independent/shared Progress and privacy for both Quiz types.
- Gate: focused and existing regression suites pass.

### Phase 6 — Full regression, documentation sync and closure preparation

- Synchronize database/API/UI/architecture/status docs with implemented behavior.
- Run guarded backend/frontend/browser matrix and inspect migration/data cleanup.
- Feature remains short of `DONE` until TEST, REVIEW and HUMAN approval.

## 16. Proposed Future Task Decomposition

No TASK file is created now. Suggested future boundaries:

1. **TASK-PV-01:** Approved contract documentation synchronization and migration design verification.
2. **TASK-PV-02:** Prisma migration plus guarded schema/data safety tests.
3. **TASK-PV-03:** Canonical-scoped ADMIN Vocabulary repository/service regression.
4. **TASK-PV-04:** Owner-private aggregate read/update backend and authorization tests.
5. **TASK-PV-05:** Owner-aware picker and scope-aware Set reference validation.
6. **TASK-PV-06:** Atomic/idempotent create-private-plus-add backend and concurrency tests.
7. **TASK-PV-07:** Frontend service and private aggregate form/editor integration.
8. **TASK-PV-08:** Context-rich picker, reuse/create workflow, removal wording and zero-membership UX.
9. **TASK-PV-09:** Flashcard/Progress exact-ID/POS/TTS compatibility verification and corrections.
10. **TASK-PV-10:** Both Quiz types exact-ID/POS compatibility verification and corrections.
11. **TASK-PV-11:** Cross-feature real-stack regression, documentation sync, formal TEST/REVIEW preparation.

Each boundary should receive HUMAN TASK approval before implementation; tasks may be combined if review finds the split unnecessarily granular.

## 17. Effort and Risk Assessment

| Area | Effort | Notes |
|---|---|---|
| Database/migration | HIGH | Global-to-partial uniqueness, ownership and idempotency persistence; rollback becomes constrained after private data. |
| Backend private Vocabulary | HIGH | Aggregate reuse, owner concealment, update and atomic operation. |
| Vocabulary Set integration | HIGH | Role-aware picker, scope validation, ordering concurrency and shared editor behavior. |
| ADMIN compatibility | MEDIUM | Queries must be comprehensively canonical-scoped; UI largely unchanged. |
| Learning/Flashcard | LOW | Exact-ID/POS/TTS architecture already matches SPEC; mostly integrity/regression coverage. |
| Quiz | LOW | Both types already use exact ID and render POS; mostly regression coverage. |
| Frontend | HIGH | Context-rich picker plus nested create/edit forms and idempotent retry state. |
| Regression/testing | HIGH | Feature crosses all completed Vocabulary/Set/Learning/Quiz boundaries. |

Highest technical risk: correctly distinguishing same intentional create from retry/concurrent repetition while allowing identical same-headword operations.

Highest regression risk: failing to scope existing ADMIN CRUD or System Set reference validation after private rows coexist in `VOCABULARY`.

Likely little/no refactor: Learning exact-ID flow, Learning Progress identity, Quiz question/answer algorithms, Flashcard POS presentation and exact-word TTS fallback.

## 18. Documentation Updates Required During Later Approved Work

- `docs/DATABASE.md`: ownership model, partial canonical uniqueness, non-unique search index, idempotency entity, relations/deletion rules.
- `docs/API_SPEC.md`: picker projection/scope, atomic create-plus-add, owner-private detail/update, safe errors.
- `docs/UI_UX_SPEC.md`: Set-editor reuse/create/edit behavior, context/source labels, Remove from Set and zero-membership recovery.
- `docs/ARCHITECTURE.md`: only if the idempotency transaction/data boundary needs an active architecture note; no framework change.
- `docs/FEATURE_STATUS.md`: advance only at approved workflow gates.
- `docs/PROJECT_OVERVIEW.md`: only if current scope text conflicts; no new product scope is introduced by this PLAN.

## 19. Open Questions

None block planning. The recommended operation-record approach and proposed API contracts require HUMAN approval as part of this PLAN before TASK decomposition. Exact implementation syntax remains for later authorized stages.

## 20. Approval Gate

```text
PRODUCT CONTRACT: HUMAN APPROVED
SPEC: HUMAN APPROVED
PLAN: HUMAN APPROVED
TASK: HUMAN APPROVED
IMPLEMENT / TEST: NOT STARTED — NOT AUTHORIZED
```
