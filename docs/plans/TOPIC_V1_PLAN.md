# PLAN: Topic V1

**Source SPEC:** `docs/specs/TOPIC_V1_SPEC.md` (`APPROVED`)

**PLAN status:** `APPROVED`

**Human approval:** `APPROVED` for Topic V1, including UUID identifiers, PATCH semantics, and the minimal safe unexpected-error strategy.

**Implementation authorized:** `NO`

## 1. Summary

Topic V1 will add a standalone `TOPIC` Prisma model and migration, public metadata reads, and ADMIN-only metadata CRUD. It will follow the existing backend composition pattern:

```text
Topic route -> authentication/role middleware when required -> controller
  -> service -> repository -> Prisma -> PostgreSQL
```

The frontend will add real public Topic list/detail routes and an ADMIN Topic management route inside the existing authenticated App Layout. Topic list search is client-side over the unpaginated public list.

This plan deliberately does not create `VOCABULARY_SET`, a Topic-to-Vocabulary Set relation, data fixtures, discovery, visibility filtering, set counts, learning progress, or any RESTRICT relation test. RESTRICT/no-cascade is retained only as a future integration requirement once the relation exists.

## 2. Scope Preservation and Acceptance-Criteria Traceability

| Approved SPEC criterion | Planned evidence / implementation area |
|---|---|
| AC-01 | `TOPIC` Prisma model and migration with only the five approved fields. |
| AC-02–AC-04 | Backend Topic validation, normalization and database-backed case-insensitive uniqueness; validation and HTTP tests. |
| AC-05–AC-07 | Public list/detail API plus public frontend pages; empty Topic display; no set data/count/discovery. |
| AC-08 | Topic reads/services perform no learning, progress, XP, streak, Level or Achievement writes/calls; regression tests confirm no such integration. |
| AC-09–AC-11 | ADMIN management UI, authenticated ADMIN CRUD endpoints, existing role middleware, and delete confirmation. |
| AC-12 | No Vocabulary Set model/relation/fixture/mock or cascade/reassignment mechanism is introduced. |
| Deferred AC-13 | Recorded only as a future integration test requirement when an approved Vocabulary Set relation is materialized; excluded from V1 implementation and test scope. |
| AC-14 | Defined error contracts and UI states for validation, duplicate, not-found, authentication, authorization and operational errors. |
| AC-15 | Authenticated ADMIN route nests under the existing `AuthenticatedShell`; no replacement Auth/App Layout. |
| AC-16 | Scope review, migration/schema review, tests and documentation synchronization explicitly exclude deferred work. |

## 3. Existing Code and Architecture to Reuse

- `backend/src/create-app.js` — composition root; instantiate Topic dependencies and mount Topic routers without changing the completed Authentication composition.
- `backend/src/middleware/authentication-middleware.js` — attaches the server-derived identity and returns the existing `AUTHENTICATION_FAILED` response; reuse for ADMIN mutations.
- `backend/src/middleware/role-authorization-middleware.js` — reuse with `allowedRoles: ["ADMIN"]`; no new role or authorization system.
- `backend/src/controllers/auth-controller.js`, `services/authentication-service.js`, and `repositories/user-repository.js` — reference pattern for controller/service/repository separation and known-error mapping; Topic receives its own focused modules rather than modifying Authentication behavior.
- `backend/prisma/schema.prisma` — current PostgreSQL/Prisma schema baseline using UUID identifiers and timestamp naming conventions.
- `frontend/src/services/http-client.js` — credential-aware Axios client for Topic service calls.
- `frontend/src/app-router.jsx` — extend with explicit public Topic routes and one authenticated ADMIN management route.
- `frontend/src/auth/ui/route-guards.jsx` — preserve `ProtectedRoute`; add a focused frontend ADMIN route guard only for UX routing, while retaining backend authorization as the boundary.
- `frontend/src/auth/ui/authenticated-shell.jsx` and `frontend/src/index.css` — extend only as required to expose the real ADMIN Topic route in the existing shell; preserve current dashboard, logout, mobile drawer and ADMIN context behavior.
- Existing backend HTTP/component tests and frontend Playwright Auth fixtures — extend patterns for Topic API, route and authenticated UI regression coverage.

## 4. Database Plan

### 4.1 Model and Migration

- Add a `TOPIC` Prisma model mapped by the existing uppercase model/table convention.
- Use a UUID-backed string `id`, matching the existing `USER` persistence convention. `Topic.id` and `:topicId` use UUID strings; API documentation synchronization must replace its numeric illustration with this approved contract.
- Add exactly: `name` (non-null, maximum 100), optional `description` (maximum 500), `created_at`, and `updated_at`.
- Generate a Prisma migration that creates only the `TOPIC` table and its required indexes/constraints. Regenerate the existing generated Prisma client as the normal migration workflow requires.
- Do not add `VOCABULARY_SET`, `topic_id`, relationship fields, fake seed data, soft delete, image, slug, ordering or progress columns.

### 4.2 Case-Insensitive Name Uniqueness

- Normalize API input by trimming `name`; reject empty names after trimming and values longer than 100 characters.
- Enforce correctness at the database boundary with a PostgreSQL functional unique index on `LOWER(name)`. This avoids adding a new extension or non-approved persistent normalization field solely for uniqueness.
- Keep the normal `name` field for display. The service maps an index/Prisma unique violation, including a concurrent-write collision, to the documented duplicate-name error.
- Validate optional `description` as a string when supplied and reject a value longer than 500 characters. The approved SPEC does not require trimming, normalizing or uniqueness for description.

### 4.3 Future Relation Boundary

- No foreign key or delete relation can be implemented in Topic V1 because no Vocabulary Set schema exists.
- When a later approved Vocabulary Set feature creates that relation, its plan/migration must implement `ON DELETE RESTRICT` (or the equivalent database constraint) and add the Deferred AC-13 integration test. It must not be retroactively fabricated in Topic V1.

## 5. Backend Plan

### 5.1 Modules and Composition

- Add dedicated Topic repository, service, controller and route modules following the current Auth module responsibilities.
- In `createApp`, construct the Topic repository/service/controller and mount public Topic and ADMIN Topic routers. Continue to mount Authentication unchanged.
- Use the existing JSON parser. Topic controllers map expected service errors and forward unexpected errors to one minimal, final application error handler registered after routes in `createApp`.
- The minimal handler returns a stable safe `500` response (for example, `INTERNAL_SERVER_ERROR`) without database, stack, credential or session details. It does not remap known Authentication errors, which continue to use their existing controller/middleware contracts. Authentication regression coverage is required whenever it is introduced.

### 5.2 Routes and Middleware

| Route group | Middleware | Responsibility |
|---|---|---|
| Public Topic router (`/api/topics`) | No authentication middleware | List Topic metadata and get Topic metadata detail for Guest/User. |
| ADMIN Topic router (`/api/admin/topics`) | Existing authentication middleware, then existing role authorization middleware with `ADMIN` | Create, update and delete Topic metadata. |

Public reads must not trust a requested user id, role header or client-provided identity. ADMIN mutations use only `req.user` established by the existing session middleware.

### 5.3 Controller, Service and Repository Responsibilities

- **Controller:** Extract path/body input, call the service, select the agreed HTTP response, translate known Topic errors, and forward unexpected errors.
- **Service:** Validate/trim input; apply create/update semantics; convert duplicate and not-found data outcomes to stable domain errors; never evaluate learning/gamification data; never invent relation checks without a relation.
- **Repository:** Provide Prisma-only list, find-by-id, create, update and delete operations with an explicit public Topic field selection. It must not contain business validation or access rules.
- **Error behavior:** Use stable Topic errors for validation, duplicate name, missing Topic and operational failure. Existing middleware supplies `401 AUTHENTICATION_FAILED` and `403 FORBIDDEN` for protected mutations.

## 6. API Contract Strategy

Before implementation, synchronize `docs/API_SPEC.md` to make the approved V1 contract unambiguous. The implementation must follow the synchronized contract.

### 6.1 Shared Topic Representation

```json
{
  "id": "uuid",
  "name": "Daily Life",
  "description": "Common vocabulary used in daily life",
  "created_at": "ISO-8601 timestamp",
  "updated_at": "ISO-8601 timestamp"
}
```

`description` may be `null`. List and detail return metadata only: no Vocabulary Set collection, visibility data or count.

### 6.2 Endpoints

| Method / path | Access | Success | Request / response summary |
|---|---|---|---|
| `GET /api/topics` | Guest/User | `200` | `{ success: true, data: Topic[] }`; unpaginated; no server search/filter. |
| `GET /api/topics/:topicId` | Guest/User | `200` | `{ success: true, data: Topic }`; metadata only. |
| `POST /api/admin/topics` | ADMIN | `201` | Body `{ name, description? }`; returns `{ success: true, data: Topic }`. |
| `PATCH /api/admin/topics/:topicId` | ADMIN | `200` | Partial body with only approved editable fields: omitted field is unchanged; supplied `name` is trimmed, validated and updated; supplied string `description` is validated and updated; `description: null` clears it. |
| `DELETE /api/admin/topics/:topicId` | ADMIN | `204` | No response body; V1 has no relation check because no relation exists. |

### 6.3 Error Contract

| Condition | Status | Stable code |
|---|---:|---|
| Invalid identifier/body/name/description | `400` | `VALIDATION_ERROR` |
| Missing Topic | `404` | `TOPIC_NOT_FOUND` |
| Case-insensitive duplicate name | `409` | `TOPIC_NAME_ALREADY_EXISTS` |
| Missing/invalid authenticated session | `401` | Existing `AUTHENTICATION_FAILED` |
| Authenticated non-ADMIN mutation | `403` | Existing `FORBIDDEN` |
| Future related-Topic deletion | Deferred | `TOPIC_DELETE_RESTRICTED` may be finalized only with the future Vocabulary Set relation contract. |

Unexpected errors follow the planned minimal safe final application error handler; neither responses nor logs expose raw database information, credentials or session values.

### 6.4 Approved PATCH Semantics

- A PATCH body must contain at least one supported editable field (`name` or `description`); an empty body or a body with no supported editable field returns `400 VALIDATION_ERROR`.
- Omitted `name` or `description` is unchanged.
- A supplied `name` must be a string and is trimmed, validated and persisted under the approved case-insensitive uniqueness rule. `name: null` returns `400 VALIDATION_ERROR`.
- A supplied string `description` is validated against the approved maximum length and persisted. `description: null` clears the persisted value to `null`.
- No field other than `name` and `description` is editable in Topic V1.

## 7. Frontend Plan

### 7.1 Routing and Layout

- Add explicit public routes for `/topics` and `/topics/:topicId` outside `GuestRoute` and `ProtectedRoute`, so Guest and authenticated visitors can view the same metadata without the current unknown-route-to-login fallback.
- Add an authenticated `/admin/topics` management route under `ProtectedRoute` and the existing `AuthenticatedShell`.
- Add a focused ADMIN UX guard inside the protected hierarchy: an authenticated non-ADMIN is redirected to the existing safe authenticated destination. It is not a security boundary; direct mutation attempts remain protected by backend middleware.
- Add the ADMIN Topic navigation entry to the existing shell only for an ADMIN and only together with the implemented `/admin/topics` route. Keep USER navigation, dashboard behavior, logout, drawer accessibility and existing App Layout behavior unchanged.

### 7.2 Pages, Components, State and Service

- Create a Topic API service beside the existing frontend services, using `httpClient` and a Topic-specific error mapper; do not alter Auth service/session state.
- Add public Topic list/detail pages that retrieve metadata, expose client-side search on the loaded list, link to detail, and present loading/error/empty/not-found states.
- Add an ADMIN Topic management page that loads the same Topic metadata, offers client-side search, creates/edits through a validated form, and offers a view action plus a confirmation dialog before delete.
- Keep components proportional: extract form, list and confirmation UI only where state/behavior is reused or materially distinct; do not introduce a new state library or component framework.
- After create/update/delete, refresh or deterministically reconcile the in-memory Topic list and present accessible success/error feedback. No fabricated counts or Vocabulary Set content is shown.

### 7.3 UI and Accessibility States

- **Loading:** Stable accessible loading/status state for list, detail and management mutations.
- **Empty:** Explicitly show that no Topics exist; an empty individual Topic is still a valid detail record.
- **Errors:** Map validation, duplicate, not-found, `401`, `403`, network and safe server failures to actionable UI feedback without raw server details.
- **Delete:** Clearly identify the Topic/action, provide cancel/confirm controls, disable duplicate submission while pending, and preserve the record on error.
- **Accessibility:** Semantic headings/landmarks, labelled form fields, associated validation messages, keyboard-accessible search/links/dialog controls, focus handling for dialog open/close, visible focus and mobile-responsive layout consistent with the existing App Layout.

## 8. Validation, Authorization and Business Boundaries

- Frontend enforces the same field limits for responsive UX; backend remains authoritative.
- The service trims name before all validation and persistence. The functional database index is the final uniqueness guard.
- No ownership rule applies: Topics are system-managed and mutation permission is solely `ADMIN`.
- Existing authenticated identity/session resolution stays unchanged. The new frontend ADMIN guard cannot be treated as authorization.
- Topic reads and writes must not call or mutate learning, Quiz, pronunciation, XP, Level, Streak, Achievement, Dashboard or Vocabulary Set services.

## 9. Testing Strategy

### 9.1 Database and Backend

- Verify migration/model creation, field nullability/length representation, UUID contract, timestamps and the functional case-insensitive unique index against the dedicated test database.
- Repository/service tests: list/detail, empty Topic, trim/required/max-length validation, optional description, duplicate create/rename including case variants, not-found update/delete, and concurrent/database duplicate translation.
- HTTP tests: public `GET` list/detail; ADMIN create/update/delete; expected success envelopes/statuses; malformed identifiers/body; not-found; duplicate; unauthenticated and USER mutation requests; forged role/header/input cannot grant ADMIN access; safe unexpected-error handling.
- Do not write a related-Vocabulary-Set RESTRICT test in V1. Add it only in the future feature that materializes the relation.

### 9.2 Frontend

- Unit tests for Topic service error mapping and client-side search behavior.
- Browser/component coverage for public list/detail loading, empty, error and not-found states; Topic metadata display; and no Vocabulary Set discovery/count rendering.
- ADMIN coverage for route UX guard, visible navigation only for ADMIN, list/search, form validation, create/edit success and error behavior, delete confirmation/cancel/pending/success/error states.
- Accessibility checks for form labels/errors, navigation, dialog focus/keyboard interaction and responsive list/form behavior.

### 9.3 Regression

- Run existing backend Authentication suite to ensure `createApp`, session middleware and role middleware composition do not regress.
- Run frontend Authentication/App Layout unit, browser, lint and production-build checks to verify dashboard, USER/ADMIN shell presentation, logout, protected routing and mobile drawer behavior remain unchanged.
- Run Topic-focused backend/frontend suites after their implementation. No deployment verification is part of this plan.

## 10. Documentation Synchronization

The approved Topic V1 contract is synchronized before implementation in these sources. Implementation must preserve these documented boundaries:

1. **`docs/API_SPEC.md`:** Topic detail is metadata-only; UUID identifier representation, unpaginated reads, mutation bodies/responses and 400/401/403/404/409/500 errors are defined; RESTRICT remains a deferred future relation contract.
2. **`docs/DATABASE.md`:** Topic V1 field definitions, UUID convention and functional case-insensitive uniqueness are defined; no Vocabulary Set relation/FK or deletion constraint exists in V1.
3. **`docs/UI_UX_SPEC.md`:** public Topic list/detail, metadata-only rendering, ADMIN V1 management states and confirmation are defined; real Vocabulary Set count is deferred.
4. **`docs/FEATURE_STATUS.md`:** Topic Management and Topic Listing are `PLANNED`; Topic-based Vocabulary Set Discovery remains `TODO`; Auth/App Layout remain `DONE`.

`docs/PROJECT_OVERVIEW.md` and `docs/ARCHITECTURE.md` need no requirement change; update Architecture only if the implemented Topic module organization materially changes the documented architecture.

## 11. Implementation Order

1. After human PLAN approval, synchronize the Topic API/database/UI documentation conflicts to the approved V1 contract.
2. Add the isolated Topic Prisma model, functional unique-index migration and generated client update; verify migration in the dedicated test database.
3. Add Topic repository, service, controller, routes and `createApp` composition using existing authentication and ADMIN role middleware.
4. Add backend unit/HTTP/security coverage and run the existing Authentication regression suite.
5. Add Topic frontend service, public routing/pages and client-side search/states.
6. Add the authenticated ADMIN route/UX guard, App Layout navigation integration and management form/confirmation flow.
7. Add frontend unit/browser/accessibility coverage; run Topic, Auth/App Layout regressions, lint and production build.
8. Perform TEST and REVIEW workflow stages; update Feature Status only after their verified outcomes and human approvals.

## 12. Risks and Considerations

- A Prisma `@unique` field is not sufficient for the approved case-insensitive rule; the migration must preserve the functional database index and the service must translate its collision safely.
- The synchronized V1 API contract uses UUID identifiers; implementation/tests must retain that representation rather than reverting to the former numeric illustration.
- Public Topic access requires explicit routes because the current router redirects unknown paths to login; implementation must not accidentally place public Topic routes under `GuestRoute` (which redirects authenticated users).
- The minimal final application error handler must be added after routes only for unexpected failures. Known Authentication and Topic errors retain their explicit contracts; Authentication regression coverage verifies this boundary.
- No current Vocabulary Set relation exists. Attempting to prove RESTRICT in V1 would violate approved scope and create misleading coverage.

## 13. Open Questions / Human Decisions

None. UUID representation, PATCH semantics and the minimal safe unexpected-error strategy have been approved. PLAN approval remains required before TASK or implementation.

## Approval Gate

```text
SPEC STATUS: APPROVED
PLAN STATUS: APPROVED
NEXT ALLOWED STAGE: TASK
TASK / IMPLEMENTATION AUTHORIZED: NO
```
