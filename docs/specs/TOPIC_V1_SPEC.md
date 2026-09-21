# SPEC: Topic V1

**Feature status:** `PLANNED`

**SPEC status:** `APPROVED`

**Human approval:** `APPROVED` for Topic V1 scope and the deferred RESTRICT integration requirement.

## 1. Objective

Deliver the first Topic capability for ELVocab. Topics are system-managed categories that organize Vocabulary Sets. V1 allows guests and authenticated users to view Topic metadata, and allows ADMIN users to manage that metadata.

The conceptual relationship remains:

```text
Topic
  -> Vocabulary Set
  -> Vocabulary
```

Topic V1 does not implement Vocabulary Set discovery, Vocabulary Set data, learning, or progress.

## 2. Existing Context

- `docs/FEATURE_STATUS.md` records Topic Management and Topic Listing as `PLANNED` after this approved SPEC; Topic-based Vocabulary Set Discovery remains `TODO`.
- The current Prisma schema contains only `USER` and `AUTH_SESSION`; no Topic or Vocabulary Set data model exists.
- The backend currently exposes only Authentication routes; no Topic API implementation exists.
- The frontend has the completed authenticated App Layout, a protected `/dashboard` route, and no Topic page, route, navigation item, service or tests.
- Existing documentation defines Topic as a system-managed classifier for Vocabulary Sets, not as a direct classifier of individual Vocabulary.

## 3. Actors and Authorization

- **Guest:** May list Topics and view Topic detail. Guest access does not provide any management capability.
- **USER:** May list Topics and view Topic detail. A USER cannot create, edit or delete Topics.
- **ADMIN:** May list, search, view, create, edit and delete system Topics.

No role is added. Frontend role presentation or route hiding is only UX; backend authentication and `ADMIN` authorization are the security boundary for every management operation.

## 4. Scope

### In Scope

- Persist Topic with `id`, `name`, `description`, `created_at` and `updated_at`.
- Guest/User Topic listing and Topic detail containing Topic metadata.
- ADMIN Topic list, client-side search, view, create, edit and delete operations.
- Backend authentication and role authorization for every ADMIN mutation.
- Topic validation, case-insensitive uniqueness and safe error behavior.
- A delete confirmation in the ADMIN UI.
- Preserve RESTRICT/no-cascade as the mandatory deletion policy when a Vocabulary Set relation exists in a later approved feature.
- Frontend Topic integration into the existing authenticated App Layout where an authenticated route/navigation destination is introduced.
- Empty Topics: a Topic with no related Vocabulary Sets remains listable and viewable.
- V1 client-side search/filter over the unpaginated Topic result.

### Out of Scope / Deferred

- Real Vocabulary Set count.
- Topic-based Vocabulary Set discovery or rendering Topic-associated sets.
- Vocabulary Set visibility/access filtering.
- Defining or changing whether `VOCABULARY_SET.topic_id` is nullable or required.
- Creating Vocabulary Set models, migrations, fixture data or mock data solely for Topic.
- Vocabulary management, Vocabulary Set management and all Vocabulary Set ownership/visibility changes.
- Topic learning progress, dashboard Topic progress, XP, Level, Streak or Achievement changes.
- Pagination, server-side Topic search/filter, ordering rules beyond any existing database default, and additional Topic fields such as image, slug or icon.
- Public landing-page work, new roles, external services, deployment, and unrelated App Layout changes.

## 5. Data Requirements and Rules

### 5.1 Topic

The persisted Topic fields are:

| Field | Requirement |
|---|---|
| `id` | Persistent Topic identifier. Exact identifier representation is a PLAN/database-design decision consistent with existing project conventions. |
| `name` | Required; trim input before validation/persistence; non-empty after trim; maximum 100 characters; unique case-insensitively. |
| `description` | Optional; maximum 500 characters. |
| `created_at` | Creation timestamp. |
| `updated_at` | Last-update timestamp. |

### 5.2 Relationships and Deletion

- A Topic may have many Vocabulary Sets.
- Vocabulary does not receive a direct `topic_id` in V1.
- Topic deletion policy is **RESTRICT** when a Vocabulary Set relation exists: an ADMIN cannot delete a Topic that has related Vocabulary Sets. That future operation must fail safely and must not cascade-delete or reassign related data.
- An empty Topic is valid and remains visible.
- This SPEC intentionally does not decide the nullability of a future `VOCABULARY_SET.topic_id`.
- Topic V1 does not create a Vocabulary Set model, relation, fixture or mock solely to represent or test a related-set deletion state. Therefore, RESTRICT enforcement is a future integration requirement, not a V1-verifiable relation behavior.

### 5.3 Validation and Security Rules

- Validation must be authoritative on the backend; frontend validation is UX only.
- Whitespace-only names are invalid after trimming.
- Case-insensitive uniqueness is authoritative at the database/backend boundary and must be handled safely if concurrent requests collide.
- Invalid identifiers, malformed request bodies, validation failures, duplicate names, unauthenticated requests, non-ADMIN requests, missing Topics and restricted deletions must return safe errors without exposing internals.
- No secrets, credentials, session tokens or raw database errors may be returned or logged by Topic operations.

## 6. User Flows

### 6.1 Guest / USER Listing and Detail

1. A Guest or authenticated USER opens the approved Topic listing route/screen.
2. The application retrieves the unpaginated Topic list and may search/filter that loaded list client-side.
3. The visitor may open a Topic detail view.
4. The view presents the Topic metadata, including empty Topics.
5. Viewing must not create learning progress, XP, streak activity or other gamification state.

### 6.2 ADMIN Management

1. An authenticated ADMIN opens the approved Topic management area within the existing authenticated App Layout.
2. The ADMIN lists, searches and views Topics.
3. The ADMIN submits valid name/optional description data to create or edit a Topic.
4. The backend validates the data and enforces the ADMIN role before persisting a change.
5. Before deletion, the UI displays a confirmation describing the destructive action.
6. Topic V1 does not create related Vocabulary Set state for deletion testing. When a Vocabulary Set relation is introduced in an approved future feature, the backend must reject deletion of a related Topic without cascading changes.

## 7. API Requirements

Existing documented public contracts are retained as the Topic read foundation:

- `GET /api/topics` — Guest/User; returns an unpaginated Topic list with at least `id`, `name` and `description`.
- `GET /api/topics/:topicId` — Guest/User; V1 Topic metadata detail subject to the conflict note below.
- `POST /api/admin/topics` — ADMIN only; creates a Topic.
- `PATCH /api/admin/topics/:topicId` — ADMIN only; updates a Topic.
- `DELETE /api/admin/topics/:topicId` — ADMIN only; must preserve the future RESTRICT/no-cascade policy when the Vocabulary Set relation exists.

The request/response envelopes, exact status codes, validation-error shape, duplicate-name response and restricted-delete response must be specified in the later PLAN/API contract synchronization. No endpoint is implemented by this SPEC.

## 8. Frontend and UX Requirements

- Reuse the existing authenticated App Layout rather than adding a parallel application shell.
- Add a navigation destination only with a real approved Topic route; do not create fake future links.
- Guest access must use a public route/screen architecture that is decided consistently with existing React Router behavior; the current application redirects `/` and unknown routes to login, so public Topic routing needs explicit design during PLAN.
- ADMIN management UI provides list, client-side search, detail/view, create, edit and delete actions.
- Destructive deletion requires a clear confirmation with action, consequence, cancel and confirm choices.
- Provide loading, empty, validation-error, authorization-error, not-found, duplicate-name and restricted-delete states appropriate to the affected screen.
- Do not display a real Vocabulary Set count or Topic-associated Vocabulary Set discovery in V1.

## 9. Acceptance Criteria

- **AC-01:** A Topic persists exactly the V1 fields: `id`, `name`, `description`, `created_at` and `updated_at`.
- **AC-02:** Creating or updating a Topic rejects a missing, whitespace-only or over-100-character name after trimming.
- **AC-03:** Creating or updating a Topic rejects a description longer than 500 characters.
- **AC-04:** Topic names are unique case-insensitively; attempts to create or rename to a duplicate are safely rejected.
- **AC-05:** Guests and authenticated USERs can retrieve an unpaginated Topic list and Topic metadata detail.
- **AC-06:** A Topic with no related Vocabulary Sets is returned by listing and remains viewable in detail.
- **AC-07:** The V1 Topic views do not render real related Vocabulary Set discovery/count data and do not create fake Vocabulary Set data.
- **AC-08:** Viewing a Topic does not create or change XP, streak, learning progress, Level, Achievement or other learning state.
- **AC-09:** An authenticated ADMIN can list, client-search, view, create and edit Topics.
- **AC-10:** Every create, edit and delete request is rejected when unauthenticated or authenticated as USER; backend `ADMIN` authorization is enforced independently of frontend UI.
- **AC-11:** ADMIN deletion always requires UI confirmation before the delete request is sent.
- **AC-12:** Topic V1 does not create a Vocabulary Set model, relation, fixture or mock solely to test a related-set deletion state; no cascade or reassignment behavior is introduced.
- **Deferred future integration requirement (AC-13):** When an approved Vocabulary Set model/relation exists, deleting a Topic related to one or more Vocabulary Sets must be rejected by RESTRICT and must leave the Topic and related data unchanged. This is not a V1 test requirement while the schema cannot represent that state.
- **AC-14:** Topic API/UI paths provide safe, understandable handling for invalid input, duplicate name, missing Topic, unauthorized access and restricted deletion.
- **AC-15:** Authenticated Topic routes use the existing App Layout when appropriate; no second authenticated shell is created.
- **AC-16:** Topic V1 introduces no Vocabulary Set model/data, no Vocabulary direct-topic field, no pagination, no server-side search/filter and no Topic progress behavior.

## 10. Dependencies and Impact

- **Database:** Requires a future Topic schema/migration. A future Vocabulary Set relation is relevant only for the RESTRICT constraint; this SPEC does not authorize Vocabulary Set implementation.
- **Backend:** Requires Topic routes, controllers/services/data access, validation and ADMIN authorization integration following the documented architecture.
- **Frontend:** Requires public Topic views and authenticated ADMIN management views/routes, integrated into the existing App Layout where applicable.
- **Documentation:** `DATABASE.md`, `API_SPEC.md`, `UI_UX_SPEC.md` and `FEATURE_STATUS.md` require synchronization only after approval and when the corresponding change is confirmed.

## 11. Conflicts and Scope Notes

1. **Resolved API detail contract:** `docs/API_SPEC.md` now defines metadata-only Topic detail; Topic-based Vocabulary Set discovery and visibility filtering remain deferred.
2. **Resolved Admin count contract:** `docs/UI_UX_SPEC.md` now records that real Vocabulary Set count is deferred in Topic V1.
3. **Future Vocabulary Set FK nullability:** `docs/DATABASE.md` records `VOCABULARY_SET.topic_id` as future/deferred. This decision remains deferred and must not be made by Topic V1 implementation.
4. **Public routing implementation gap:** API documentation permits Guest Topic reads, while the current frontend router has no public Topic route. The approved PLAN/TASK defines explicit public route integration without changing the access rule.

## 12. Open Questions / Decisions for Human Review

No additional product decision is requested before SPEC review: the supplied V1 scope resolves field validation, actor permissions, empty Topic behavior, delete behavior, pagination/search and deferred work.

The four documentation/contract gaps above must be accepted and synchronized as part of approval/PLAN; they are not authorization to expand V1 into Vocabulary Set work.

## Approval Gate

```text
SPEC STATUS: APPROVED
NEXT ALLOWED STAGE: PLAN
IMPLEMENTATION AUTHORIZED: NO
```
