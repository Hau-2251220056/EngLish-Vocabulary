# PLAN: Vocabulary V1

**Source SPEC:** `docs/specs/VOCABULARY_V1_SPEC.md` (`APPROVED`)

**PLAN status:** `APPROVED`

**Human approval:** `APPROVED`, including nullable string/text CEFR storage with an explicit PostgreSQL `CHECK` constraint.

**Implementation authorized:** `NO`

## 1. Summary

Vocabulary V1 will add an ADMIN-only normalized Vocabulary aggregate: `VOCABULARY`, owned `VOCABULARY_MEANING` children and owned `VOCABULARY_EXAMPLE` grandchildren. It will reuse the existing backend composition pattern:

```text
Vocabulary route -> existing authentication middleware -> existing ADMIN middleware
  -> controller -> service -> repository -> Prisma -> PostgreSQL
```

The service treats Vocabulary as the aggregate root. Create and nested update operations are transaction-safe. A supplied `meanings` collection is complete replacement data, with stable child-ID ownership validation and intentional deletion for omitted owned children.

The frontend will add only `/admin/vocabulary` under the existing authenticated shell and ADMIN UX guard. It will load a complete aggregate before editing, use client-side search over an unpaginated ADMIN list, and introduce no public Vocabulary route.

## 2. Scope Preservation and Acceptance-Criteria Traceability

| Approved SPEC criterion | Planned evidence / implementation area |
|---|---|
| AC-01–AC-02 | Three Prisma models/migration, UUID owned relations, schema and database tests. |
| AC-03–AC-05 | Backend aggregate validation, CEFR allow-list, free-form part of speech, functional unique word index and HTTP tests. |
| AC-06 | Service/repository transaction boundary and rollback coverage for failed nested create/update. |
| AC-07 | ADMIN list/detail APIs, client-side list search, ADMIN UI and browser coverage. |
| AC-08–AC-09 | PATCH parser/service semantics, complete-edit fetch, stable-ID ownership checks, replacement/delete transaction tests. |
| AC-10 | Delete confirmation, owned-child cascade verification and explicit absence of external-reference behavior. |
| AC-11 | Existing Authentication and `ADMIN` role middleware reuse; unauthenticated/USER/forged-input HTTP coverage. |
| AC-12 | Stable controller errors, final safe error handler regression, UI safe error states and validation tests. |
| AC-13 | `/admin/vocabulary` nests under `ProtectedRoute`, `AdminRoute` and `AuthenticatedShell`; App Layout/Auth regressions. |
| AC-14 | Schema/API/UI scope review and regression tests confirm no public catalog, Topic relation, Set/Set Item, learning, SRS, Quiz, gamification, practice or AI work. |

## 3. Existing Code and Conventions to Reuse

- `backend/src/create-app.js` — composition root and existing final safe `500 INTERNAL_SERVER_ERROR` handler; mount a Vocabulary ADMIN router without changing Authentication behavior.
- `backend/src/routes/topic-routes.js`, `controllers/topic-controller.js`, `services/topic-service.js` and `repositories/topic-repository.js` — module boundaries, known-error mapping and Prisma access conventions to extend with Vocabulary-specific modules.
- `backend/src/middleware/authentication-middleware.js` and `role-authorization-middleware.js` — existing session identity and authoritative `ADMIN` authorization; no role/middleware system is added.
- `backend/prisma/schema.prisma` — UUID, uppercase model/table and timestamp conventions.
- `backend/test/helpers/test-environment.js` and `test-database.js` — dedicated TEST DB and explicit reset protections; do not target development, Preview or Production databases.
- `frontend/src/services/http-client.js` and `services/topic-service.js` — credential-aware same-origin API calls and safe error mapping patterns.
- `frontend/src/app-router.jsx`, `auth/ui/route-guards.jsx`, `auth/ui/authenticated-shell.jsx` and `index.css` — existing authenticated route hierarchy, ADMIN UX guard, shell/navigation and responsive conventions.
- `frontend/src/topics/admin-topic-page.jsx` and `frontend/e2e/integration/topic-real-stack.spec.js` — existing ADMIN management/form/confirmation and real-stack test patterns, adapted without changing Topic behavior.

## 4. Documentation Synchronization Gate

After human PLAN approval and before implementation, synchronize the approved Vocabulary V1 contract. Implementation must not proceed against the older conflicting drafts.

1. **`docs/DATABASE.md`:** replace the draft `VOCABULARY.difficulty_level` direction with the approved three-entity aggregate; document UUIDs, nullable fields, Meaning-only CEFR, owned foreign keys, `LOWER(word)` uniqueness, and owned-child deletion. Keep all external Vocabulary reference policies deferred.
2. **`docs/API_SPEC.md`:** replace numeric-ID and conditional Guest/USER Vocabulary-read examples with ADMIN-only UUID aggregate routes, nested response/request semantics and the approved error codes/statuses. Remove any implication of granular Meaning/Example endpoints.
3. **`docs/UI_UX_SPEC.md`:** define the ADMIN-only Vocabulary management route, aggregate list/detail/form, complete-aggregate edit loading, client-side search, accessibility states and owned-child delete confirmation; preserve no public/User catalog in V1.
4. **`docs/FEATURE_STATUS.md`:** advance the approved Vocabulary V1 work to `PLANNED` consistently for the covered Vocabulary Management, Multiple Meanings, Context/Example, Search and pronunciation-information storage scope. Do not mark implementation/test/review complete.
5. **`docs/ARCHITECTURE.md`:** no structural architecture change is planned. Its older generic Vocabulary endpoint illustrations should be synchronized only if retained as a contract reference, so they do not contradict the ADMIN route contract.

`docs/PROJECT_OVERVIEW.md` remains high-level product direction and needs no scope change: Topic → Vocabulary Set → Vocabulary, multiple meanings and future learning behavior remain intact.

## 5. Database Plan

### 5.1 Models and Migration

- Add only `VOCABULARY`, `VOCABULARY_MEANING` and `VOCABULARY_EXAMPLE` Prisma models, mapped with the existing uppercase convention and UUID string identifiers.
- Materialize exactly the approved fields, nullability and timestamps. `VOCABULARY_EXAMPLE` has `created_at` only; no speculative ordering, soft-delete, audit, tag, image, synonym or future-domain field is added.
- Add required owned foreign keys: Meaning → Vocabulary and Example → Meaning. The migration uses cascade deletion only for these aggregate-owned children, never for future Vocabulary Set, progress, quiz or other external references.
- Generate one focused migration and Prisma client update. Add a PostgreSQL functional unique index on `LOWER(word)` and the approved Meaning CEFR `CHECK` constraint through migration SQL because normal Prisma field declarations are insufficient for these database guarantees.
- Do not add `difficulty_level`, `topic_id`, `VOCABULARY_SET`, `VOCABULARY_SET_ITEM`, learning or pronunciation-practice models.

### 5.2 Constraints and Data Access Shape

- `word` remains display-cased after trim; the functional index enforces case-insensitive uniqueness without a normalized duplicate column or extension.
- `cefr_level` is nullable string/text on Meaning only. The migration explicitly adds a PostgreSQL `CHECK` constraint permitting only `A1`, `A2`, `B1`, `B2`, `C1`, `C2` or `NULL`; V1 introduces no PostgreSQL or Prisma CEFR enum. Service validation remains authoritative. CEFR must not be placed on Vocabulary or Topic.
- Repository selects distinguish list summaries from full aggregates. Full aggregate reads nest `meanings` and each Meaning's `examples`, with a deterministic documented query order chosen without adding an unapproved ordering field.
- The repository exposes focused aggregate operations and a transaction-capable boundary. The service, not controller/UI, owns validation, child ownership checks and transaction orchestration.

### 5.3 Dedicated TEST DB Safety

- Run migration verification only through the existing test-environment bootstrap: `NODE_ENV=test`, a dedicated `TEST_DATABASE_URL`, and explicit `TEST_DATABASE_ALLOW_RESET=true` where reset is required.
- Never run reset helpers against Preview, development or Production. Use Vocabulary fixture prefixes/IDs and targeted cleanup in integration/browser tests; do not delete unrelated data.
- Apply the new migration to the dedicated TEST DB before database-dependent suites. Do not apply it to Preview or Production in this plan.

## 6. Backend and API Plan

### 6.1 Modules and Composition

- Add Vocabulary repository, service, controller and ADMIN router modules following the Topic module naming and responsibilities.
- In `createApp`, construct Vocabulary dependencies and mount only `/api/admin/vocabulary` after preserving existing auth and Topic routers. Reuse the existing final error handler unchanged.
- Configure the Vocabulary router with existing authentication middleware followed by existing `allowedRoles: ["ADMIN"]` middleware for every route, including list/detail reads.

### 6.2 Repository and Service Responsibilities

- **Repository:** Prisma-only list-summary, find-complete-by-ID, find-insensitive-word, create aggregate, update aggregate and delete aggregate operations. It must support transaction-scoped calls and avoid authorization/business validation.
- **Service:** UUID/body/field validation; trim/limits/CEFR validation; word duplicate detection and persistence-error translation; complete-replacement graph reconciliation; stable Meaning/Example ID ownership checks; and atomic create/update/delete behavior.
- **Controller:** Extract route/body data, call service, return the specified envelope/status and map known Vocabulary errors. Unexpected errors continue to the final safe handler without raw Prisma data.

### 6.3 Aggregate Semantics

- Create accepts a full graph with one-or-more Meanings and zero-or-more Examples per Meaning, validates all data first and writes it in one transaction.
- PATCH accepts only `word`, `phonetic`, `pronunciation_url`, `meanings`; omitted top-level fields remain unchanged and explicit optional `null` clears only phonetic/pronunciation URL.
- When PATCH includes `meanings`, the service treats it as a complete replacement collection. The frontend must have fetched the full aggregate first and submit all desired current Meanings; each retained Meaning submits its complete desired Examples collection.
- Submitted existing IDs must belong to the addressed aggregate; no-ID nodes are new. Unknown, duplicate, cross-parent or malformed IDs are `VALIDATION_ERROR`.
- Omitted owned Meaning/Example nodes are intentionally deleted in the transaction. There are no granular child CRUD routes.
- Delete removes the aggregate and owned children only. External-reference policy is deferred until a future approved feature creates an external relation.

### 6.4 API Contract

| Endpoint | Access | Success | Data |
|---|---|---:|---|
| `GET /api/admin/vocabulary` | ADMIN | `200` | Unpaginated Vocabulary summaries in `{ success, data }`. |
| `GET /api/admin/vocabulary/:vocabularyId` | ADMIN | `200` | Complete nested aggregate in `{ success, data }`. |
| `POST /api/admin/vocabulary` | ADMIN | `201` | Creates the full aggregate atomically. |
| `PATCH /api/admin/vocabulary/:vocabularyId` | ADMIN | `200` | Applies approved top-level and nested replacement semantics atomically. |
| `DELETE /api/admin/vocabulary/:vocabularyId` | ADMIN | `204` | Aggregate deletion with no body. |

Expected known errors are `400 VALIDATION_ERROR`, `404 VOCABULARY_NOT_FOUND`, `409 VOCABULARY_WORD_ALREADY_EXISTS`, existing `401 AUTHENTICATION_FAILED`, existing `403 FORBIDDEN`, and final safe `500 INTERNAL_SERVER_ERROR`.

## 7. Frontend Plan

### 7.1 Routing, Navigation and Service

- Add a Vocabulary API service beside `topic-service.js`, using the existing `httpClient` and a focused Vocabulary error mapper; do not alter Auth store/session state.
- Add `/admin/vocabulary` only under `ProtectedRoute` → `AuthenticatedShell` → `AdminRoute` in `app-router.jsx`.
- Add one ADMIN-only Vocabulary navigation item to the existing shell only alongside the implemented route. USERs see neither the navigation item nor an accessible management route.
- Keep public Topic layout/routes and all Guest/User routing unchanged. No Vocabulary public layout/page or USER sidebar destination is created.

### 7.2 Page, Form and State Boundaries

- Add an ADMIN Vocabulary page using the Topic management page as a behavioral reference, not a replacement. It owns list loading, client-side word search, selected aggregate detail, mutation status and delete confirmation.
- Load the complete aggregate by ID before opening edit mode. Do not edit from a partial list summary.
- Use focused form/list/confirmation components only where nested Meaning/Example state is materially separate or reused; do not introduce a form/state library.
- The aggregate editor maintains stable IDs for retained children, supports add/remove Meaning and Example controls, prevents removing the final Meaning, and serializes the complete desired graph when `meanings` is saved.
- After mutation, refresh or deterministically reconcile the list/detail state. Display safe success feedback and preserve user input/record state when a mutation fails.

### 7.3 UX, Accessibility and Responsive States

- Provide accessible loading, empty, network/safe-server-error, validation, duplicate-word, not-found, `401` and `403` states.
- Use labelled controls and associated validation errors for every Vocabulary, Meaning and Example field; use keyboard-accessible add/remove controls and clear nested group labels.
- Delete confirmation explicitly identifies the Vocabulary and its owned Meanings/Examples, supports cancel/confirm, restores focus appropriately and prevents duplicate submissions.
- Preserve existing responsive shell, drawer, logout, focus styles and Topic management behavior. Verify nested forms at the existing mobile/tablet/desktop breakpoints without a UI redesign.

## 8. Testing Strategy

### 8.1 Database, Backend and API

- Migration/model tests: UUID IDs, nullability, timestamps, owned foreign keys/cascade behavior, Meaning-only nullable string/text CEFR representation, the explicit CEFR `CHECK` constraint and functional `LOWER(word)` unique index.
- Repository/service tests: full list/detail, required nested graph, trimming/max lengths, optional fields/null clears, CEFR rejects, case-insensitive duplicates/concurrency translation, malformed UUID/body, not-found and unsupported fields.
- Transaction/replacement tests: failed create/update leaves no partial graph; retained IDs preserve children; no-ID children are created; unknown/cross-aggregate/duplicate IDs reject; omitted supplied nodes delete only owned children; final Meaning cannot be removed.
- HTTP/security tests: each ADMIN endpoint success contract; unauthenticated/USER requests; forged role/body/header cannot grant ADMIN; safe known/unexpected errors; no granular child endpoint is exposed.
- Re-run Authentication backend tests to prove `createApp`, session middleware, role middleware and final error behavior do not regress.

### 8.2 Frontend and Browser

- Unit tests for Vocabulary service error mapping and client-side search.
- Browser/component coverage for list loading/empty/error/retry, summary/detail presentation, and complete aggregate loading before edit.
- ADMIN form coverage: valid create, local/server validation, CEFR selection/validation, nested add/remove, required-one-Meaning guard, stable-ID replacement payload, duplicate/not-found/error recovery, delete confirmation/cancel/pending/success.
- Route/navigation coverage: ADMIN visible/accesses management; USER redirect/no nav; public Topic routes remain unaffected.
- Accessibility and responsive coverage for labelled nested fields, errors, keyboard/focus behavior, dialog operation and existing viewport matrix.

### 8.3 Regression and Test Environment

- Run Topic browser/regression coverage, full frontend Authentication/App Layout unit/browser checks, frontend lint and production build.
- Run backend Authentication suite plus Vocabulary backend/database tests after implementation.
- Use the established real-stack harness only with dedicated TEST DB fixtures and exact cleanup. No Preview database/deployment work belongs to this plan.

## 9. Implementation Order

1. After human PLAN approval, synchronize the approved Vocabulary documentation contract and move only the relevant feature status to `PLANNED`.
2. Add Prisma aggregate models, the focused migration/functional index and regenerated client; apply/verify only in the dedicated TEST DB.
3. Add transaction-capable Vocabulary repository, aggregate service validation/reconciliation, controller, ADMIN router and `createApp` composition.
4. Add database/backend/API/security coverage, then run Authentication backend regression.
5. Add frontend Vocabulary service, ADMIN route and conditional shell navigation.
6. Add list/detail/create/edit/delete UI, complete-aggregate edit loading, nested form behavior, client-side search and accessible responsive states.
7. Add frontend/browser/accessibility coverage; run Vocabulary, Topic, Auth/App Layout regression, lint and production build.
8. Perform later TEST, REVIEW and closure stages; update completed feature statuses only with their verified evidence and human approvals.

## 10. Risks, Assumptions and Boundaries

- Prisma field-level `@unique` cannot enforce case-insensitive word uniqueness; migration-managed `LOWER(word)` is mandatory and service mapping must handle concurrent collisions.
- Aggregate replacement is intentionally destructive for omitted supplied child nodes. Complete-detail loading and stable-ID validation are mandatory safeguards, not optional frontend behavior.
- Database cascade applies only to owned Meaning/Example children. Future Set, Progress, Quiz or other external references require a new approved deletion policy and must not be anticipated in this migration.
- Existing API/architecture documents include older numeric/public/generic Vocabulary examples. Documentation synchronization is a pre-implementation gate, not permission to implement against conflicting contracts.
- No external pronunciation service, new library, generic form engine, shared UI refactor, public catalog or workflow expansion is needed.

## 11. Open Questions

None. The approved SPEC and PLAN fix the V1 data, actor, nested-write, deletion, search, CEFR storage and deferred-domain boundaries. TASK approval remains required before implementation.

## Approval Gate

```text
SPEC STATUS: APPROVED
PLAN STATUS: APPROVED
NEXT ALLOWED STAGE: TASK
IMPLEMENTATION AUTHORIZED: NO
```
