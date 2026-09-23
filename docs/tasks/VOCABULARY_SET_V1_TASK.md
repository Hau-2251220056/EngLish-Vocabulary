# TASKS: Vocabulary Set V1

**Source SPEC:** `docs/specs/VOCABULARY_SET_V1_SPEC.md` (`APPROVED`)

**Source PLAN:** `docs/plans/VOCABULARY_SET_V1_PLAN.md` (`APPROVED`)

**TASK status:** `APPROVED`

**Human approval:** `APPROVED` for the Vocabulary Set V1 task sequence.

**Implementation authorized:** `YES`, only according to the approved task sequence and current task boundary.

## 1. Overview and Feature Status

Vocabulary Set V1 adds the approved `TOPIC -> VOCABULARY_SET -> VOCABULARY_SET_ITEM -> VOCABULARY` relationship. It provides public System Set discovery, ADMIN System Set management, private USER Set ownership and System Set copy. It must not create a standalone USER Vocabulary catalog, link Items to Meanings, or introduce learning/community scope.

`docs/FEATURE_STATUS.md` records all Vocabulary Set work as `TODO`, and current source/schema contain no Set implementation. The tasks below follow the approved PLAN and do not recreate completed Topic, Vocabulary, Authentication or App Layout work.

Formal TEST and REVIEW remain separate quality gates. Passing task-level checks never by itself changes the feature to `DONE`.

## 2. Dependency Graph

```text
TASK-034 — Approved Vocabulary Set documentation synchronization
    ↓
TASK-035 — Prisma Set aggregate migration and TEST DB verification
    ↓
TASK-036 — System Set backend aggregate and public discovery
    ↓
TASK-037 — Private Set, copy and scoped picker backend integration
    ↓
TASK-038 — Database/backend/API/security verification and regressions
    ↓
TASK-039 — Frontend Set service, routes and navigation foundation
    ↓
TASK-040 — Public Topic-based System Set discovery/detail UI
    ↓
TASK-041 — USER My Sets, Set editor and scoped picker UI
    ↓
TASK-042 — ADMIN System Set management UI
    ↓
TASK-043 — Browser, accessibility and cross-feature regression coverage
    ↓
TASK-044 — Formal Vocabulary Set TEST, REVIEW and closure preparation
```

No task is designated parallel. Each later task consumes a contract or reusable UI boundary that its predecessor verifies.

## 3. Acceptance-Criteria Mapping

| SPEC AC | Primary task(s) |
|---|---|
| AC-01–AC-03 | TASK-035, TASK-038 |
| AC-04 | TASK-036, TASK-038, TASK-042, TASK-043 |
| AC-05 | TASK-037, TASK-038, TASK-041, TASK-043 |
| AC-06 | TASK-036, TASK-038, TASK-040, TASK-043 |
| AC-07 | TASK-037, TASK-038, TASK-041, TASK-043 |
| AC-08–AC-09 | TASK-036, TASK-037, TASK-038, TASK-041, TASK-042, TASK-043 |
| AC-10 | TASK-037, TASK-038, TASK-041, TASK-043 |
| AC-11–AC-12 | TASK-036–TASK-039, TASK-041–TASK-043 |
| AC-13 | TASK-039–TASK-043 |
| AC-14 | TASK-034 through TASK-044 scope gates |

## 4. Tasks

### TASK-034 — Synchronize Approved Vocabulary Set V1 Documentation Contract

**Objective:** Replace active legacy Vocabulary Set drafts with the approved V1 contract before schema or source implementation begins.

**Dependencies:** Human approval of this TASK document.

**Expected files / areas:** `docs/DATABASE.md`, `docs/API_SPEC.md`, `docs/UI_UX_SPEC.md`, `docs/FEATURE_STATUS.md`; `docs/ARCHITECTURE.md` only if an active Set contract conflicts with the approved routes/domain boundary.

**In scope:** Document the two new aggregate entities, required Topic/owner/Vocabulary relationships, Set Item order/constraints, Set deletion restrictions, System/User capability boundaries, copy, public System discovery, scoped authenticated picker, aggregate Item replacement, and relevant `PLANNED` statuses.

**Out of scope:** Schema/source/test changes; marking implementation/test/review complete; standalone USER Vocabulary access; Community/learning documentation expansion.

**Implementation requirements:** Reconcile legacy public/shared User Set, pagination, generic item routes and generic Vocabulary browsing language. Explicitly distinguish the picker from a standalone Vocabulary catalog and preserve completed Topic/Vocabulary contracts.

**Completion criteria:** The affected documentation presents one approved V1 Set contract; covered statuses are `PLANNED`, while Community, learning and future domains remain deferred.

**Verification:** Documentation consistency review; targeted search for Set conflicts; `git diff --check`; secret/scope check.

**Mapped AC:** AC-01–AC-14.

**Completion gate/status:** `COMPLETE` — approved Vocabulary Set contract synchronization is complete; human review is required before TASK-035.

### TASK-035 — Materialize Set Aggregate and Verify Dedicated TEST DB Migration

**Objective:** Add the approved Set/Item Prisma schema, focused migration and generated client, then prove constraints only against the guarded TEST DB.

**Dependencies:** TASK-034 complete.

**Expected files / areas:** `backend/prisma/schema.prisma`, one new migration under `backend/prisma/migrations/`, generated Prisma client artifacts when normal workflow updates them, and existing TEST DB reset support only if ordering must change.

**In scope:** `VOCABULARY_SET` / `VOCABULARY_SET_ITEM`, UUID fields/timestamps, owner/Topic/Vocabulary relations, Item position, aggregate-owned cascade, Topic/Vocabulary restrictions, unique Item constraints, positive-position CHECK, client generation and TEST DB verification.

**Out of scope:** Meaning/Example reference, CEFR field/enum, direct Topic-Vocabulary relation, Set type/source table, seed data, Preview/Production migration or any future external relation.

**Implementation requirements:** Use one focused migration. Explicitly represent `RESTRICT` for Topic→Set and Vocabulary→Item, cascade only Set→Item, and migration SQL for `position > 0` if Prisma cannot express the guarantee. Update reset order only as needed to delete child Set Items before parents.

**Completion criteria:** The dedicated TEST DB accepts valid models/relations and enforces UUID/FK/nullability/timestamp/unique/CHECK/delete contracts without unrelated schema objects.

**Verification:** Existing safety bootstrap confirms `NODE_ENV=test`, guarded dedicated test URL and reset authorization; Prisma generation/migration succeeds; targeted fixtures prove constraints/restrictions/cascade and are cleaned.

**Mapped AC:** AC-01–AC-03, AC-08, AC-14.

**Completion gate/status:** `COMPLETE` — Prisma validation/client generation, guarded migration deployment/status, TEST DB constraint/cascade verification, fixture cleanup and existing backend regression passed; human review is required before TASK-036.

### TASK-036 — Implement System Set Backend Aggregate and Public Discovery

**Objective:** Implement System Set repository/service/controller/routes, public Topic-based discovery/detail and ADMIN System aggregate management using existing backend composition.

**Dependencies:** TASK-035 complete.

**Expected files / areas:** new Set repository/service/controller/router modules in existing `backend/src` conventions; `backend/src/create-app.js`; no Authentication middleware redesign.

**In scope:** ADMIN System list/detail/create/PATCH/delete, public System summary-by-Topic/detail, validation, server-controlled public/owner classification, non-empty System Item requirement, complete supplied Item replacement/reorder, safe errors and transaction use.

**Out of scope:** USER private CRUD/copy, picker, granular Item API, User Set moderation, public User Sets, any learning/community behavior.

**Implementation requirements:** Public reads disclose System Sets only. ADMIN routes use existing authentication then ADMIN middleware. The service validates Topic and every Item Vocabulary, persists contiguous one-based positions atomically, rejects duplicate/malformed submitted Items and maps expected errors safely. No controller may expose raw database data.

**Completion criteria:** Public callers can discover/view only System Set metadata/items; ADMIN can safely manage complete non-empty System aggregates; supplied Items replace/reorder the owned collection transactionally.

**Verification:** Focused implementation checks/API harness only against local or guarded TEST environment; lint/diff/secret/scope checks. Formal backend coverage belongs to TASK-038.

**Mapped AC:** AC-04, AC-06, AC-08–AC-09, AC-11–AC-12, AC-14.

**Completion gate/status:** `COMPLETE` — focused guarded HTTP verification passed for public discovery/detail, ADMIN aggregate create/update/delete, ordered replacement, reference validation and authorization boundaries; human review is required before TASK-037.

### TASK-037 — Implement Private Set, System Copy and Scoped Picker Backend Integration

**Objective:** Extend the Set aggregate backend with USER ownership, independent System copy and the approved authenticated Set-editor-only Vocabulary picker.

**Dependencies:** TASK-036 complete.

**Expected files / areas:** Set repository/service/controller/router modules created in TASK-036; `backend/src/create-app.js`; no completed Vocabulary service/controller/route behavior change.

**In scope:** authenticated USER My Sets list/detail/create/PATCH/delete; private ownership/non-disclosure; System copy; bounded word-query picker returning only `id`, `word`, optional `phonetic`; save-time referenced Vocabulary checks; transaction-safe copy/replacement.

**Out of scope:** USER System mutation, ADMIN private Set management, standalone Vocabulary list/detail/search routes, picker Meaning/Example/CEFR response fields, granular Item route, Community sharing or learning work.

**Implementation requirements:** Derive USER owner and private visibility from session/operation, never client body. Allow empty User drafts but not empty System Sets. Treat non-owned/private resources as not found. Copy creates new Set/Item IDs, preserves source Topic/name/description/order, sets private ownership and leaves source unchanged. Picker requires non-empty bounded word query and has no unfiltered catalog behavior.

**Completion criteria:** USER can safely manage only their private Sets and copy System Sets; picker is authenticated, minimal and editor-integration-ready; direct persistence validates submitted Item vocabulary IDs.

**Verification:** Focused service/controller/router checks against guarded TEST/local data; role/ownership manual harness where appropriate; lint/diff/secret/scope checks. Full security coverage belongs to TASK-038.

**Mapped AC:** AC-05, AC-07–AC-12, AC-14.

**Completion gate/status:** `COMPLETE` — focused guarded TEST DB HTTP verification passed for USER private aggregate CRUD, strict cross-owner non-disclosure, System-to-private copy independence and ordered Items, authenticated bounded picker access/shape, and save-time Vocabulary reference validation; human review is required before TASK-038.

### TASK-038 — Add Set Database, Backend, API and Security Coverage

**Objective:** Prove the database, public/System/User/picker contracts, transactional semantics, authorization boundaries and shared backend regressions.

**Dependencies:** TASK-037 complete.

**Expected files / areas:** focused Set backend/database test file(s) under `backend/test/`; existing TEST helpers/scripts only where test safety/reset order requires it; no unrelated production feature work.

**In scope:** migration constraints, FK restrictions/cascade, validation, aggregate replacement/reorder/rollback, User drafts, System required Items, copy independence, picker shape/query, HTTP success/errors, visibility/ownership/role security and shared backend regression.

**Out of scope:** frontend/browser coverage, Preview/Production, Community, learning, full USER Vocabulary browsing or speculative external-reference tests.

**Implementation requirements:** Cover concurrent duplicate Item persistence boundary, missing Topic/Vocabulary, forged owner/public/role input, unauthenticated routes, USER System denial, ADMIN private-management denial, cross-owner non-disclosure, unexpected safe `500`, and absence of granular Item/catalog routes. Use only controlled TEST DB fixtures and clean them exactly.

**Completion criteria:** Approved database/backend/API/security cases pass; Authentication, Topic and Vocabulary backend regressions remain green after `createApp`/FK/reset changes.

**Verification:** Focused Set suite; relevant Auth/Topic/Vocabulary backend suites; migration preparation; explicit fixture cleanup evidence; `git diff --check`; secret/scope checks.

**Mapped AC:** AC-01–AC-12, AC-14.

**Completion gate/status:** `COMPLETE` — guarded dedicated TEST DB coverage passed: 8 Vocabulary Set database/API/security tests plus 58 existing Authentication, Topic and Vocabulary backend regressions (0 failures; 3 existing approved TODOs). Fixture cleanup, ownership/privacy, public/System boundaries, aggregate replacement/rollback, copy ordering/independence, picker boundaries and safe contracts were verified; human review is required before TASK-039.

### TASK-039 — Add Frontend Set Service, Routes and Navigation Foundation

**Objective:** Connect frontend routing/navigation to approved Set APIs while retaining current layouts, guards and completed feature behavior.

**Dependencies:** TASK-038 complete.

**Expected files / areas:** a Set service beside existing frontend services; `frontend/src/app-router.jsx`; `frontend/src/auth/ui/authenticated-shell.jsx`; focused CSS only where an implemented navigation/route needs it.

**In scope:** same-origin API/error mapping, public System routes, USER My Sets protected routes/navigation, ADMIN System management protected/Admin routes/navigation, and no generic Vocabulary route.

**Out of scope:** full Set screen/editor behavior, a second shell, Auth provider/store changes, new guard system, User Vocabulary navigation or dependency installation.

**Implementation requirements:** Reuse `httpClient`, public Topic layout composition, `ProtectedRoute`, `AdminRoute`, AuthenticatedShell and existing role state. USER-only/ADMIN-only navigation is UX only; backend authorization stays authoritative. Unknown/User-protected route behavior follows current safe redirect conventions.

**Completion criteria:** The real route hierarchy/navigational visibility matches public, USER and ADMIN responsibilities without modifying existing Topic/Vocabulary/Auth behavior.

**Verification:** Focused service error-mapping and route/navigation checks; relevant lightweight Auth/App Layout regression; lint/build as applicable.

**Mapped AC:** AC-04–AC-07, AC-10–AC-14.

**Completion gate/status:** `COMPLETE` — focused Vocabulary Set service endpoint/error-mapping checks, public/USER/ADMIN route composition, role-gated navigation, frontend unit regression, lint and production build passed; human review is required before TASK-040.

### TASK-040 — Implement Public Topic-Based System Set Discovery and Detail UI

**Objective:** Deliver the Guest/User/ADMIN public System Set discovery/detail experience without embedding Set data into completed Topic responses.

**Dependencies:** TASK-039 complete.

**Expected files / areas:** new Set public pages/components under the current frontend feature convention; public Topic route/layout extension only as necessary; `frontend/src/index.css` only for required responsive/accessibility styling.

**In scope:** Topic-scoped System Set summaries, client-side Set-name search, public System detail, ordered minimal Item rendering, loading/empty/error/not-found states and Guest authentication path for copy.

**Out of scope:** User private Set data, copy mutation implementation, public User Sets, learning action, generic Vocabulary browsing/detail, Topic API contract change or layout redesign.

**Implementation requirements:** Use the Set service only. Show only approved minimal Item fields, not Meaning/Example/CEFR. Keep public Topic list/detail metadata-only; discovery is a dedicated Set route. Ensure semantic headings/links/landmarks, accessible feedback and existing public layout responsiveness.

**Completion criteria:** All visitor types can discover/view public System Sets by Topic, while private data and Vocabulary catalog behavior remain absent.

**Verification:** Focused component/browser smoke coverage and public route checks; responsive/accessibility smoke checks; lint/diff/secret/scope checks.

**Mapped AC:** AC-04, AC-06, AC-10, AC-12–AC-14.

**Completion gate/status:** `COMPLETE` — public Topic-based System Set discovery/detail, client-side search, ordered minimal Item rendering, Guest authentication path, accessible loading/empty/error/not-found/retry states and responsive keyboard smoke behavior passed in the guarded dedicated TEST DB Playwright suite (3/3); human review is required before TASK-041.

### TASK-041 — Implement USER My Sets, Aggregate Editor, Copy and Scoped Picker UI

**Objective:** Deliver USER private Set management and System copy through an accessible aggregate editor with the editor-contained Vocabulary picker.

**Dependencies:** TASK-040 complete.

**Expected files / areas:** Set USER pages/components and shared editor primitives as needed; existing Set frontend service; `frontend/src/index.css` only for required accessible/responsive presentation.

**In scope:** owner list/search/detail/create/edit/delete, valid empty draft UX, Topic selection, complete Item replacement/reorder controls, picker search/add/remove, copy from System detail, validation/safe errors/pending states and delete confirmation.

**Out of scope:** ADMIN System management UI, user publishing, other-user access, standalone Vocabulary screen, drag-and-drop dependency, granular Item screens/routes, Community or learning work.

**Implementation requirements:** Picker is rendered only while a Set editor is active and sends an actual word query before results. It preserves complete desired ordered Items, prevents duplicate adds, supports keyboard add/remove/move controls and never displays Meaning/Example detail. Copy success points to the new private Set; mutation failure preserves actionable form state. USER may not create public state in UI payload.

**Completion criteria:** USER can manage only owned private Sets and copy a System Set while the editor’s serialized Item collection follows complete replacement/reorder semantics.

**Verification:** Focused UI/component checks, local TEST-backed flow as appropriate, keyboard/focus/responsive smoke checks; lint/diff/secret/scope checks.

**Mapped AC:** AC-05, AC-07–AC-12, AC-14.

**Completion gate/status:** `COMPLETE` — human-authoritative local guarded dedicated TEST DB Playwright verification passed 2/2: USER create → picker → reorder → save → delete, and public System Set copy into an independent private Set. Human review approved TASK-041; TASK-042 may begin.

### TASK-042 — Implement ADMIN System Set Management UI

**Objective:** Deliver ADMIN-only System Set list/detail/create/edit/delete using the verified shared Set editor while enforcing System-specific UI rules.

**Dependencies:** TASK-041 complete.

**Expected files / areas:** Set ADMIN page/components; shared editor primitives from TASK-041; `frontend/src/index.css` only if required by an implemented state.

**In scope:** ADMIN management list/search/detail/create/edit/delete, Topic selection, required one-or-more Items, editor-contained picker, safe state/error feedback and delete confirmation.

**Out of scope:** private User Set moderation, separate ADMIN editor architecture, public User Set exposure, direct client public/owner control, Topic/Vocabulary management changes.

**Implementation requirements:** Reuse the Set service, routes, current shell and editor boundary rather than duplicating USER form logic. Block save when no Items exist; show safe server errors, disabled pending controls and accessible confirmation/focus behavior. The UI must not imply ADMIN authority over private Sets.

**Completion criteria:** Only ADMIN can reach/manage real System Set screens; every saved System aggregate contains valid ordered Items and remains public only through server contract.

**Verification:** Focused ADMIN UI/component checks, route/navigation role checks, responsive/accessibility smoke coverage; lint/diff/secret/scope checks.

**Mapped AC:** AC-04, AC-08–AC-14.

**Completion gate/status:** `COMPLETE` — ADMIN System Set list/search/detail/create/edit/delete, System-required ordered Items, shared editor-contained picker, validation/pending/delete-confirmation states and ADMIN route integration are implemented. Focused Vocabulary Set service regression passed 2/2; frontend lint, production build, diff, secret and scope checks passed. Human review is required before TASK-043.

### TASK-043 — Add Set Browser, Accessibility and Cross-Feature Regression Coverage

**Objective:** Automate end-to-end Set behavior and prove it does not regress completed Auth/App Layout, Topic or Vocabulary flows.

**Dependencies:** TASK-042 complete.

**Expected files / areas:** focused Set unit tests and real-stack browser tests/configuration; existing Auth/App Layout/Topic/Vocabulary test fixtures only where a regression command requires them.

**In scope:** public discovery/detail, Guest copy path, USER ownership/private CRUD/copy/picker/reorder, ADMIN management, error/loading/empty states, confirmation, authorization, keyboard/focus and responsive browser evidence.

**Out of scope:** Preview deployment verification, Production, unrelated feature expansion or replacement of existing test infrastructure.

**Implementation requirements:** Use unique controlled TEST DB fixture data, accounts and sessions. Cover no standalone USER Vocabulary catalog/route and minimal picker payload behavior where observable. Verify cleanup removes only controlled Set/Item/Topic/Vocabulary/User/session fixtures.

**Completion criteria:** Set-focused browser/accessibility/responsive tests pass, relevant Auth/App Layout/Topic/Vocabulary regression suites remain green, and fixtures leave no controlled data behind.

**Verification:** Dedicated Set browser suite; applicable frontend unit, Auth/App Layout, Topic and Vocabulary regression suites; frontend lint/production build; TEST DB cleanup evidence; `git diff --check`; secret/scope checks.

**Mapped AC:** AC-04–AC-14.

**Completion gate/status:** `COMPLETE` — human-authoritative guarded Playwright evidence passes for public System Sets (3/3), USER private Sets/copy (2/2) and ADMIN System Set management (3/3). Cross-feature regressions pass for frontend unit (24/24), Auth/App Layout browser (25/25), Auth real-stack (2/2), Topic real-stack (9/9) and Vocabulary real-stack (5/5). Frontend lint, production build, diff, secret and scope checks pass; controlled TEST fixtures were cleaned and verified. Human review is required before TASK-044.

### TASK-044 — Formal Vocabulary Set V1 TEST, REVIEW and Closure Preparation

**Objective:** Execute formal TEST/REVIEW workflow, reconcile evidence and prepare human closure without marking the feature complete prematurely.

**Dependencies:** TASK-043 complete.

**Expected files / areas:** formal test/review records and status documentation only when their verified outcomes and later human authorization permit it; no unrelated code/deployment work.

**In scope:** SPEC→PLAN→TASK traceability, implementation/test evidence audit, authorization/security/scope review, documentation consistency, fixture cleanup confirmation and review-remediation loop if needed.

**Out of scope:** automatic human approval, feature status `DONE` without formal outcomes/authorization, Preview/Production work, Vocabulary Set follow-on learning/community work.

**Implementation requirements:** Treat prior task tests as input rather than a substitute for formal TEST/REVIEW. Return to the appropriate earlier stage for any discovered design or implementation finding; do not conceal failures.

**Completion criteria:** Formal TEST is PASS and formal REVIEW is APPROVE with no unresolved blocker. Only separately authorized closure may mark Vocabulary Set work `DONE`.

**Verification:** Documented quality-gate evidence, final documentation/diff/secret/scope checks, guarded TEST DB cleanup proof and human review/closure approval.

**Mapped AC:** AC-01–AC-14.

**Completion gate/status:** `COMPLETE` — formal TEST passed AC-01 through AC-14; formal REVIEW verdict is `APPROVE` with no findings or blockers. Database/API/ownership/privacy/aggregate/copy/picker/UI/accessibility/scope evidence and all required cross-feature regressions were reconciled. Vocabulary Set V1 is ready for separate human closure authorization; this task does not itself mark the feature `DONE`.

## 5. Execution and Scope Guards

- Execute strictly in sequence. TASK-034 is the documentation synchronization gate; do not start migration or source work before it is complete and human-reviewed.
- Every database operation uses the existing guarded dedicated TEST DB mechanism. Preview/Production migration, data writes, deployments and configuration changes are excluded.
- The authenticated picker is a Set-editor-only integration. No task may create a USER Vocabulary catalog, detail route, unfiltered picker, Meaning/Example picker response or generic Vocabulary navigation.
- Set Items reference Vocabulary only. No task may add direct Topic-Vocabulary, CEFR, Flashcard, Learning, SRS, Progress, Quiz, XP/Streak, pronunciation practice, Community or AI work.
- Ownership/visibility remains backend-authoritative. Frontend guards and navigation are UX only.
- Task completion is not feature completion: formal TEST, REVIEW and explicit human closure are required before `FEATURE_STATUS.md` can move this feature to `DONE`.

## Approval Gate

```text
SPEC STATUS: APPROVED
PLAN STATUS: APPROVED
TASK STATUS: APPROVED
TASK-034: COMPLETE
TASK-035: COMPLETE
TASK-036: COMPLETE
TASK-037: COMPLETE
TASK-038: COMPLETE
TASK-039: COMPLETE
TASK-040: COMPLETE
TASK-041: COMPLETE
TASK-042: COMPLETE
TASK-043: COMPLETE
TASK-044: COMPLETE — FORMAL TEST PASS / FORMAL REVIEW APPROVE
VOCABULARY SET V1 CLOSURE: HUMAN AUTHORIZED — FEATURE STATUS DONE
NEXT ALLOWED STAGE: FEATURE COMMIT / HUMAN INTEGRATION REVIEW
IMPLEMENTATION AUTHORIZED: NO — Vocabulary Set V1 workflow is closed
```
