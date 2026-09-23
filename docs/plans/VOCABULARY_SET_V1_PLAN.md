# PLAN: Vocabulary Set V1

**Source SPEC:** `docs/specs/VOCABULARY_SET_V1_SPEC.md` (`APPROVED`)

**PLAN status:** `PENDING HUMAN APPROVAL`

**Implementation authorized:** `NO`

## 1. Summary

Vocabulary Set V1 will add two Set types through one normalized aggregate: public ADMIN-managed System Sets and private USER-owned User Sets. It will materialize the approved relationship:

```text
TOPIC --RESTRICT--> VOCABULARY_SET --CASCADE--> VOCABULARY_SET_ITEM --RESTRICT--> VOCABULARY
```

Set Items are ordered links to Vocabulary only. They do not link to Meaning or Example, and no CEFR is copied outside `VOCABULARY_MEANING`.

Backend implementation will reuse the existing composition pattern:

```text
route -> existing authentication / role middleware -> controller
  -> service -> repository -> Prisma -> PostgreSQL
```

The Set service owns visibility, ownership, copy and full ordered-item-replacement rules. A limited authenticated Vocabulary picker is implemented as a Set-editor integration endpoint only; it returns small selection records and is neither a public nor a USER Vocabulary catalog.

Frontend implementation will use the existing public Topic composition and existing `ProtectedRoute` / `AuthenticatedShell` / `AdminRoute` hierarchy. It adds public System Set discovery/detail, USER My Sets, and ADMIN System Set management without changing the completed Topic or Vocabulary management contracts.

## 2. Scope Preservation and Acceptance-Criteria Traceability

| Approved SPEC criterion | Planned implementation and evidence |
|---|---|
| AC-01 | Focused Prisma models/migration, generated client and dedicated TEST DB schema checks for only Set and Set Item models. |
| AC-02 | UUID/FK/unique/check constraints; service aggregate validation; database/repository tests for Vocabulary-only Item references and deterministic position ordering. |
| AC-03 | Explicit Topic/Vocabulary `RESTRICT` FKs, owned Set Item cascade, migration tests and deletion API regression coverage. |
| AC-04 | ADMIN System Set routes/service/UI, required non-empty Items and authorization/browser coverage. |
| AC-05 | USER-owned private Set routes/service/UI, ownership checks, server-controlled privacy and security tests. |
| AC-06 | Public System Set-by-Topic/detail APIs and public frontend screens; private-resource non-disclosure tests. |
| AC-07 | Transactional System Set copy operation, independent ID/order persistence and USER browser/API coverage. |
| AC-08 | Backend validation, transactional aggregate item replacement, Topic/Vocabulary existence checks, constraints and concurrent-duplicate tests. |
| AC-09 | PATCH parser/service semantics, explicit `description: null`, full supplied item replacement/reorder behavior and no Item router tests. |
| AC-10 | Authenticated bounded word-picker repository/service/router, Set-editor-only UI component, response-shape/security tests and explicit absence of a Vocabulary catalog route. |
| AC-11 | Existing session/role middleware plus service ownership/visibility checks; unauthenticated, USER, ADMIN, cross-owner and forged-input HTTP tests. |
| AC-12 | Known-error controller mapping, existing final safe handler, UI loading/error/retry/validation states and browser tests. |
| AC-13 | Existing public Topic layout and authenticated shell/guards/navigation reuse, responsive/accessibility coverage, and Auth/Topic/Vocabulary regressions. |
| AC-14 | Scope/schema/API/UI review plus regression assertions confirm no direct Topic-Vocabulary relation, CEFR duplication, community/public User Set, learning, practice, AI or unrelated work. |

## 3. Existing Code and Conventions to Reuse

- `backend/src/create-app.js` — composition root, existing final safe `500 INTERNAL_SERVER_ERROR` handler and current auth/Topic/Vocabulary router mounting convention.
- `backend/src/routes/topic-routes.js` and `routes/vocabulary-routes.js` — public and ADMIN Express router composition patterns.
- `backend/src/controllers/topic-controller.js`, `services/topic-service.js`, `repositories/topic-repository.js` and their Vocabulary equivalents — controller/service/repository separation, expected-error mapping, field selections and transaction-capable repository conventions.
- `backend/src/middleware/authentication-middleware.js` and `role-authorization-middleware.js` — authoritative existing session identity and `ADMIN` role protection; no role system is added.
- `backend/prisma/schema.prisma` — UUID, uppercase model/table, foreign-key and timestamp conventions.
- `backend/test/helpers/test-environment.js`, `test-database.js` and `test/scripts/prepare-test-database.js` — guarded dedicated TEST DB configuration/reset/migration procedure.
- `frontend/src/services/http-client.js`, `services/topic-service.js` and `services/vocabulary-service.js` — credential-aware same-origin HTTP client and safe error mapping conventions.
- `frontend/src/app-router.jsx`, `auth/ui/route-guards.jsx`, `auth/ui/authenticated-shell.jsx` and `index.css` — current public/protected/Admin routing, role-conditional navigation, shell, drawer, logout and responsive conventions.
- `frontend/src/topics/public-topic-layout.jsx`, Topic pages and `frontend/src/vocabulary/admin-vocabulary-route.jsx` — existing public metadata pages, management list/detail/form/confirmation patterns and safe async UI states.
- Existing Topic/Vocabulary backend suites and real-stack Playwright configurations — TEST DB fixture, authenticated route and browser regression patterns.

## 4. Documentation Synchronization Gate

After human PLAN approval and before any implementation, synchronize the approved Set contract. Current generic Set drafts are future-oriented and must not be implemented as-is.

1. **`docs/DATABASE.md`:** materialize `VOCABULARY_SET` / `VOCABULARY_SET_ITEM`, required Topic/owner/Vocabulary FKs, UUIDs, fields, unique constraints, positive ordered positions, aggregate cascade and Topic/Vocabulary restrictions. Replace deferred Topic relation wording with the actual approved relation while keeping all non-Set external-reference policies deferred.
2. **`docs/API_SPEC.md`:** replace legacy generic/public/shared Set examples with V1 public System discovery/detail, owner-only User Set CRUD, ADMIN-only System management, System copy, aggregate Item replacement and the bounded authenticated Set-editor picker. Explicitly retain no standalone USER Vocabulary catalog/detail.
3. **`docs/UI_UX_SPEC.md`:** define public Topic-based System Set discovery/detail, USER My Sets/editor, ADMIN management and Set-editor picker behavior; remove V1 implications of public User sharing, pagination, Flashcards or generic Vocabulary browsing.
4. **`docs/FEATURE_STATUS.md`:** move only the Vocabulary Set scope covered by this approved work to `PLANNED`: System Set, User-Created Set, ownership, visibility, own-edit/delete, System copy and discovery. Keep Community sharing, learning and all implementation/test/review completion states unchanged.
5. **`docs/ARCHITECTURE.md`:** synchronize only active Set endpoint/domain descriptions that conflict with this contract; retain its high-level future Vocabulary Set/Flashcard/Learning direction.

`docs/PROJECT_OVERVIEW.md` remains valid high-level direction and needs no V1 requirement change.

## 5. Database Plan

### 5.1 Models and Migration

- Add only uppercase Prisma models `VOCABULARY_SET` and `VOCABULARY_SET_ITEM` with UUID-backed string IDs, mapped under existing conventions.
- Add `VOCABULARY_SET` fields exactly as approved: `topic_id`, `owner_id`, `name`, nullable `description`, `is_public`, `created_at`, `updated_at`.
- Add `VOCABULARY_SET_ITEM` fields exactly as approved: `vocabulary_set_id`, `vocabulary_id`, positive `position`, `created_at`.
- Add necessary reverse relations to the existing `USER`, `TOPIC` and `VOCABULARY` models. Do not alter Vocabulary Meaning/Example relations or add a direct Topic-to-Vocabulary relation.
- Generate one focused migration and regenerate the existing Prisma client. Do not edit historical migrations.

### 5.2 Database Integrity

- Require Set → Topic with explicit `ON DELETE RESTRICT` / no cascade, implementing Topic V1's deferred relation boundary.
- Require Item → Vocabulary with explicit `ON DELETE RESTRICT` / no cascade, thereby protecting catalog Vocabulary referenced by any Set.
- Require Item → Set with cascade deletion only because Items are aggregate-owned children.
- Add `UNIQUE(vocabulary_set_id, vocabulary_id)`, `UNIQUE(vocabulary_set_id, position)`, and an explicit PostgreSQL `CHECK (position > 0)` through migration SQL where Prisma declarations are insufficient.
- Preserve application-level contiguous one-based ordering through transaction-safe service replacement/reorder logic; do not add a trigger, ordering table, source-copy relation, Set type enum or CEFR field.

### 5.3 Dedicated TEST DB Safety

- Before migration/reset/database verification, require current existing protections: `NODE_ENV=test`, a non-empty PostgreSQL `TEST_DATABASE_URL`, and `TEST_DATABASE_ALLOW_RESET=true` when reset is needed.
- Update the existing reset order only during implementation as necessary so Set Items are removed before Vocabulary/Topic/User parent records. Never reset Preview, development or Production.
- Apply and verify the migration only through the dedicated TEST DB preparation path; use controlled Set/Vocabulary/User fixtures with targeted cleanup.

## 6. Backend and API Plan

### 6.1 Modules and Composition

- Add Vocabulary Set repository, service, controller and focused public/User/ADMIN router modules.
- In `createApp`, construct the Set dependencies and mount routes after preserving existing Authentication, Topic and Vocabulary composition. Reuse the final error handler unchanged.
- Reuse authentication middleware for picker, USER private/copy actions and ADMIN management. Reuse existing `allowedRoles: ["ADMIN"]` middleware for System management. USER ownership/visibility remains service-authoritative, not a frontend or route-only rule.

### 6.2 Repository Responsibilities

- Read public System summaries by Topic and complete System detail with deterministic ordered Item selection metadata.
- Read current-owner private Set summaries/detail and ADMIN System management summaries/detail without broad private-resource queries.
- Provide transaction-scoped aggregate create/update/replace-items/delete/copy operations, Topic/Vocabulary existence lookups and bounded word-picker queries.
- Select only `id`, `word`, optional `phonetic` from Vocabulary for Item display and picker records. Do not select Meaning/Example/CEFR aggregates for picker use.
- Contain Prisma access only; no authorization/business validation is placed in the repository.

### 6.3 Service Responsibilities and Aggregate Rules

- Validate UUIDs, bodies, trimmed name/query limits, nullable description, allowed fields, non-negative/required Item rules and duplicate submitted Vocabulary IDs.
- Derive `owner_id` and System/User visibility server-side from authenticated identity and route operation. Do not accept client-set owner/public state.
- Enforce ADMIN System Set scope, USER own-private-Set scope, public System visibility and copy source eligibility. Treat inaccessible private Sets as not found.
- Validate every submitted `topic_id` and `vocabulary_id` against database data at save time, even when selected through the picker.
- Create and update aggregate Items atomically. A supplied `items` array fully replaces/reorders owned Items and maps submitted order to contiguous positions. Omitted `items` stays unchanged; `description: null` clears only description.
- Require System Sets to contain Items; allow private User draft Sets to contain none. Copy System source into an independent private aggregate using new IDs and source ordering in one transaction.
- Translate FK, uniqueness/concurrent collision and not-found persistence outcomes to documented safe domain errors. Never expose raw Prisma/database data.

### 6.4 Routes and Contract Boundary

| Route group | Middleware | Responsibility |
|---|---|---|
| `/api/topics/:topicId/vocabulary-sets`, `/api/vocabulary-sets/:setId` | none | Guest/User/ADMIN public System discovery/detail only. |
| `/api/vocabulary-set-picker` | existing authentication | Bounded word query, minimal selection metadata, only for Set editors. |
| `/api/my/vocabulary-sets` and `/api/vocabulary-sets/:systemSetId/copy` | existing authentication | USER-owned private aggregate operations and System copy. |
| `/api/admin/vocabulary-sets` | existing authentication then existing ADMIN authorization | ADMIN System Set aggregate management only. |

Controllers return approved envelopes/statuses and map `VALIDATION_ERROR`, `VOCABULARY_SET_NOT_FOUND`, `TOPIC_NOT_FOUND`, `VOCABULARY_NOT_FOUND`, `VOCABULARY_ALREADY_IN_SET`, existing `AUTHENTICATION_FAILED` / `FORBIDDEN`, and final `INTERNAL_SERVER_ERROR`. No granular Set Item endpoints are mounted.

## 7. Frontend Plan

### 7.1 Service, Routing and Navigation

- Add a Vocabulary Set service beside existing frontend services using `httpClient` and a focused safe-error mapper for public discovery, private/User operations, ADMIN operations, copy and picker calls.
- Add public System Set discovery/detail routes outside `GuestRoute`, associated with the existing public Topic composition but without changing Topic list/detail response contracts.
- Add USER My Sets routes inside `ProtectedRoute` and `AuthenticatedShell`; add a USER-only navigation item only with the implemented route.
- Add `/admin/vocabulary-sets` inside existing `ProtectedRoute` → `AuthenticatedShell` → `AdminRoute`, and add ADMIN-only navigation only with the real management route.
- Do not add a generic Vocabulary navigation item, standalone catalog page, second authenticated shell, new role guard or state library.

### 7.2 Screen and Component Boundaries

- **Public System Set discovery/detail:** Topic-scoped summaries, client-side Set-name search, ordered minimal Item presentation and USER copy affordance. A Guest receives an authentication path rather than a copy mutation.
- **USER My Sets:** own-list/search/detail/create/edit/delete behavior, including valid empty drafts; private resources are never exposed by path or navigation to another user.
- **ADMIN System management:** System list/search/detail/create/edit/delete and Topic selection; editor blocks saving an empty System Set.
- **Shared Set editor primitives where genuinely reused:** metadata fields, Topic selector, ordered Item collection, delete confirmation and editor-contained picker. The picker searches only after a word query, renders bounded selection records, prevents duplicate additions and supports accessible add/remove/move-up/move-down controls without drag-and-drop dependencies.
- The editor serializes the complete desired ordered Item collection when `items` changes, preserves user input on safe mutation failure and refreshes/reconciles lists/details after successful create/update/copy/delete.

### 7.3 UX, Accessibility and Responsive States

- Implement accessible loading/status, empty, validation, duplicate, safe server/network, not-found, `401` and `403` feedback across list/detail/picker/mutation flows.
- Use labelled fields and associated errors; semantic Item groups; visible positions; keyboard-accessible reorder/remove/add actions; and robust focus behavior for dialogs/retry/copy feedback.
- Delete dialogs identify Set and owned Item effect, disable duplicate confirmation while pending and restore focus on close.
- Preserve existing desktop/mobile AuthenticatedShell drawer/logout behavior and public Topic layout. Test Set editor and ordered Items at existing breakpoints without broad visual redesign.

## 8. Testing Strategy

### 8.1 Database, Backend and API

- Verify migration/model existence, UUIDs, nullability, timestamps, Set/Item FK targets, required Topic, reverse relation integrity, constraints, `RESTRICT` behavior, owned Item cascade and absence of unapproved schema objects.
- Test valid/invalid System and User aggregate creation, item uniqueness/order, Topic/Vocabulary validation, `description` null clear, PATCH omission/replacement/reorder, System non-empty requirement, User empty-draft rule and atomic rollback.
- Test System copy independently recreates IDs/items/order and retains private ownership while leaving source unchanged.
- Test picker query validation, authenticated access, bounded minimal result shape, no meanings/examples and save-time referenced-Vocabulary validation.
- HTTP/security coverage: Guest public discovery/detail; unauthenticated picker/User/copy/ADMIN routes; USER System-mutation denial; ADMIN private-set-management denial; cross-owner private-resource concealment; forged body/role/header resistance; no Item route; safe expected/unexpected error contracts.
- Re-run existing Authentication, Topic and Vocabulary backend regressions affected by shared `createApp`, relation restrictions and TEST DB reset ordering.

### 8.2 Frontend, Browser and Accessibility

- Unit tests for service error mapping, client-side Set search and editor item payload/order serialization.
- Browser/real-stack tests for public Topic System discovery/detail, Guest copy prompt, USER picker/private CRUD/copy, ADMIN navigation/System CRUD, and visibility/route guard behavior.
- Cover loading/empty/error/retry, field validation, duplicate Item prevention, move controls/replacement effects, delete confirmation/cancel/pending/error and copy success/error.
- Accessibility/responsive coverage for navigation visibility, labels/errors, semantic ordered Item groups, keyboard picker/reorder actions, dialog focus and mobile/tablet/desktop layouts.

### 8.3 Test Environment and Regression

- Use only the guarded dedicated TEST DB, existing test-environment bootstrap and fixture prefixes. Verify cleanup for controlled Set, Item, Topic, Vocabulary, User and session fixtures without broad deletion outside test helpers.
- Run focused Set backend/frontend/browser suites, then relevant Auth/App Layout, Topic public/admin and Vocabulary ADMIN regressions, lint and production build.
- Preview/Production deployment, migration and manual verification are not implementation-plan work; they remain later approved operational steps.

## 9. Implementation Order

1. After human PLAN approval, synchronize the approved Set documentation contract and move only the relevant Set statuses to `PLANNED`.
2. Add Prisma Set/Item models, focused migration/FKs/constraints/client generation; apply and verify only through the dedicated TEST DB guard.
3. Add transaction-capable repository and Set service rules for validation, ownership/visibility, aggregate replacement, copy, picker and safe data-error translation.
4. Add controllers, public/User/ADMIN routers and `createApp` composition; retain existing Authentication/Topic/Vocabulary behavior.
5. Add database/backend/API/security tests, update guarded reset sequencing if required and run shared Auth/Topic/Vocabulary backend regressions.
6. Add frontend Set service, public/protected/Admin routes and role-conditional authenticated-shell navigation.
7. Build public discovery/detail, USER My Sets/editor/copy, ADMIN System management and editor-contained picker with accessible responsive states.
8. Add unit/browser/accessibility coverage; run Set-focused, Auth/App Layout, Topic and Vocabulary regressions, lint and production build.
9. Perform formal TEST and REVIEW stages, then update final feature status only after verified evidence and human approval.

## 10. Risks and Considerations

- Set Items introduce the first material external Vocabulary reference. Migration FK directions and TEST cleanup ordering must be correct before any test reset; neither Topic nor Vocabulary deletion behavior may be silently weakened.
- The picker is deliberately an exception to Vocabulary V1's no USER catalog boundary. Its repository selection, response shape, authentication and UI containment must be continuously tested to prevent scope drift.
- Aggregate `items` replacement/reordering can remove items intentionally. The UI must make the current collection/order visible, serialize the complete desired collection and surface mutation errors safely.
- System/public classification must be server-enforced, not inferred from UI navigation, client `is_public` or client owner IDs.
- Legacy database/API/UI drafts describe Community/shared/public User Set behavior and pagination. Documentation synchronization is a pre-implementation gate; those drafts must not drive V1 code.
- No new dependency, external service, generic form engine or drag-and-drop package is required.

## 11. Open Questions

None. The approved SPEC decides ownership, visibility, copy, ordering, picker scope, deletion boundaries and deferred domains. Human approval of this PLAN remains required before TASK creation or implementation.

## Approval Gate

```text
SPEC STATUS: APPROVED
PLAN STATUS: PENDING HUMAN APPROVAL
NEXT ALLOWED STAGE: HUMAN PLAN REVIEW
TASK / IMPLEMENTATION AUTHORIZED: NO
```
