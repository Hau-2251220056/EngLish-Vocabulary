# PLAN: Learning Progress View V1

**Source SPEC:** `docs/specs/LEARNING_PROGRESS_VIEW_V1_SPEC.md` (HUMAN APPROVED)

**PLAN status:** `APPROVED`

**Human approval:** `APPROVED`, including the no-migration conclusion and mandatory pre-production UI/UX checkpoint.

**Implementation authorized:** `NO`

## 1. Summary

Learning Progress View V1 will extend the completed Learning domain with one read-only, USER-isolated progress query and one authenticated page. It will reuse the existing `LEARNING_PROGRESS` model, Learning route/controller/service/repository chain, frontend HTTP service, authentication guards and App Layout.

The backend will return an unfiltered persisted-state summary together with a validated, optionally status-filtered page from one consistent read boundary. The frontend will render those server-authoritative values without deriving global `NEW`, Topic/Set completion, review eligibility or gamification.

No schema migration, new dependency or change to the completed Flashcard/event engine is planned. A mandatory HUMAN UI/UX Design Checkpoint will approve the page composition and responsive behavior after service/route foundation and before production page implementation.

## 2. Scope and Acceptance-Criteria Traceability

| Approved SPEC criterion | Planned implementation / evidence |
|---|---|
| AC-01–AC-02 | USER route/navigation, existing `ProtectedRoute`/`UserRoute`, backend authentication and USER middleware, route/browser authorization tests. |
| AC-03–AC-04 | Current-USER summary query, conceptual-`NEW` exclusion and database before/after read-only assertions. |
| AC-05 | Explicit repository select and API-shape tests for the minimal Vocabulary/progress projection. |
| AC-06–AC-08 | Service query validation, deterministic repository ordering, pagination/filter metadata and safe HTTP error coverage. |
| AC-09 | Controlled `NEEDS_REVIEW` fixture coverage proving display/count/filter compatibility without transition or due behavior. |
| AC-10–AC-12 | HUMAN UI/UX checkpoint, page state implementation, frontend unit/browser accessibility and responsive verification. |
| AC-13 | Repeated-read database invariance tests covering row count and all progress fields. |
| AC-14 | Existing Learning, Auth/App Layout, Topic, Vocabulary and Vocabulary Set regression suites. |
| AC-15 | Schema/diff/API/UI review proving all deferred domains remain absent. |

## 3. Affected Areas

- **Database:** Existing `LEARNING_PROGRESS` and `VOCABULARY` reads only; no Prisma model or migration change.
- **Backend:** Extend existing Learning repository, service, controller and router with one current-USER read operation.
- **API:** Add `GET /api/learning/progress` under the existing USER-only Learning router.
- **Frontend:** Extend the Learning API service; add `/my/learning-progress`, USER navigation and the approved progress page.
- **Tests:** Add focused backend/API/security, frontend service/state and real-stack browser coverage; run scoped cross-feature regressions.
- **Documentation:** Synchronize active API, architecture, UI/UX and feature-extension status before implementation; preserve the completed Learning engine status.

## 4. Existing Code to Reuse

- `backend/prisma/schema.prisma` and `backend/prisma/migrations/20260923000000_add_learning_progress/migration.sql` — authoritative existing persistence, constraints and relationships; inspect only.
- `backend/src/repositories/learning-repository.js` — extend with current-USER grouped counts, filtered count and minimal paginated selection.
- `backend/src/services/learning-service.js` — extend with exact query validation and response assembly without changing Set payload/event behavior.
- `backend/src/controllers/learning-controller.js` — add one thin request/response method and reuse safe known-error mapping.
- `backend/src/routes/learning-routes.js` — add the read route under existing authentication and USER authorization middleware.
- `backend/src/create-app.js` — existing Learning dependency composition requires no new subsystem.
- `backend/test/learning/learning.test.js` and guarded TEST helpers — reuse controlled fixtures, database safety and HTTP/security conventions.
- `frontend/src/services/learning-service.js` — add the progress read method and response validation/error mapping.
- `frontend/src/app-router.jsx` — add the approved route beneath the existing USER guard.
- `frontend/src/auth/ui/authenticated-shell.jsx` — add one USER-only navigation entry while preserving ADMIN/Auth behavior.
- `frontend/src/pages/dashboard-placeholder.jsx` — remain unchanged; it confirms Dashboard is a separate boundary.
- Existing frontend Learning unit/real-stack infrastructure — reuse service, accessibility, guarded server and cleanup patterns.

## 5. Documentation Synchronization Gate

After HUMAN PLAN and TASK approval, synchronize only the approved active contract before implementation:

1. **`docs/API_SPEC.md`:** add the USER-only paginated read endpoint, exact query/response shape and safe errors; do not change event endpoints or activate legacy review APIs.
2. **`docs/UI_UX_SPEC.md`:** add the functional progress-view route/states and explicitly supersede legacy analytics expectations for this V1 without implementing Dashboard.
3. **`docs/ARCHITECTURE.md`:** record reuse of the Learning pipeline and server-authoritative read projection; no architecture change.
4. **`docs/FEATURE_STATUS.md`:** track Learning Progress View V1 as a distinct extension at the workflow-appropriate status while leaving the completed Learning Progress engine and Flashcard feature `DONE`.
5. **`docs/DATABASE.md`:** no schema update is required. Amend it only if needed to clarify that this view reads the existing model without new persistence; do not introduce a migration direction.

Documentation synchronization is not implementation authorization and must not mark the extension `DONE`.

## 6. Database and Query Plan

### 6.1 Schema / Migration Conclusion

- Reuse the existing composite unique index on `(user_id, vocabulary_id)`, whose leading `user_id` supports isolation predicates.
- Reuse existing status, non-negative count and foreign-key constraints.
- Do not change Prisma schema, edit historical migrations or create a new migration.
- Do not populate conceptual `NEW`, calculate SRS fields or add cached summary columns/tables.
- If implementation measurement proves the existing index insufficient, stop and return for HUMAN approval rather than silently adding an index or migration.

### 6.2 Repository Read Shape

Add a focused repository operation that receives trusted `userId` plus validated pagination/status input and obtains:

- grouped counts for all persisted rows of that USER;
- total item count using the same USER predicate plus optional status filter;
- the requested page using an explicit minimal `VOCABULARY` selection;
- deterministic order: `last_reviewed_at DESC NULLS LAST`, `created_at DESC`, `id ASC`.

Every query must carry the authenticated `user_id` predicate. The summary must not inherit the optional list status filter.

Execute summary, filtered count and page reads within one read-only consistent-snapshot transaction supported by the current Prisma/PostgreSQL stack. This avoids internally inconsistent response metadata during a concurrent learning event without adding locks or writes. Keep query count minimal and avoid per-item/N+1 reads.

Map absent grouped statuses to zero and calculate `total_started` from the persisted status counts. Return no internal progress ID, user ID, revision, event ID or SRS field.

## 7. Backend and API Plan

### 7.1 Route and Middleware

- Add `GET /progress` to the existing router mounted at `/api/learning`, producing `GET /api/learning/progress`.
- Register the static `/progress` route without changing `/sets/:setId` or `/events` behavior.
- Reuse the existing authentication middleware followed by existing USER-role authorization for all Learning endpoints.
- Add no user path/query parameter and no new role or middleware.

### 7.2 Controller

- Pass `req.user.id` and the raw query object to the service.
- Return `200` with the existing `{ success: true, data }` envelope.
- Map `VALIDATION_ERROR` through the existing safe known-error mechanism; unexpected errors continue to the final safe handler.
- Perform no aggregation, authorization or database access in the controller.

### 7.3 Service Validation and Assembly

- Accept only `page`, `page_size` and `status`.
- Treat missing pagination as page 1/page size 20; cap accepted page size at 100 rather than silently coercing larger values.
- Require scalar canonical positive-integer query strings and exact uppercase approved statuses.
- Reject arrays/repeated keys, unknown keys, empty values, unsafe integers, decimals, signs and unsupported statuses with `VALIDATION_ERROR`.
- Validate the authenticated UUID using existing conventions.
- Ask the repository for the consistent read result and assemble the approved summary, items, pagination and echoed filter.
- Calculate `total_pages` as zero when `total_items` is zero; an out-of-range positive page remains a successful empty page.
- Keep all read logic side-effect free and separate from `recordMeaningfulEvent`.

### 7.4 API Response and Errors

The implementation follows the approved SPEC exactly:

- minimal Vocabulary: `id`, `word`, nullable `phonetic`;
- progress: `status`, `review_count`, nullable `last_reviewed_at`;
- unfiltered summary and filtered pagination totals;
- no conceptual `NEW`, Meaning/Example, pronunciation, Set/Topic, revision/event or SRS data;
- `400 VALIDATION_ERROR`, existing `401 AUTHENTICATION_FAILED`, existing `403 FORBIDDEN`, and safe `500 INTERNAL_SERVER_ERROR`.

No not-found condition is introduced for an empty or out-of-range collection.

## 8. Frontend Plan

### 8.1 Service and Route Foundation

- Extend `frontend/src/services/learning-service.js` with `getLearningProgress({ page, pageSize, status })`.
- Serialize only approved query parameters and validate the complete success envelope defensively, including summary, item projection, filter and pagination integers.
- Reuse `LearningApiError` and safe operational/API error behavior.
- Add `/my/learning-progress` under `ProtectedRoute` → `AuthenticatedShell` → `UserRoute`.
- Add a USER-only “Tiến độ học” navigation entry beside existing USER destinations; ADMIN navigation remains unchanged.
- Before the UI checkpoint, use only a minimal route/page foundation sufficient for service and access testing. Do not implement or pre-approve the final visual page.

### 8.2 Mandatory HUMAN UI/UX Design Checkpoint

After backend contract verification and frontend service/route foundation, create a repo-native UI/UX checkpoint documenting:

- summary information hierarchy without a global completion percentage;
- status labels and filter semantics, including compatibility-only `NEEDS_REVIEW` wording;
- desktop/tablet/mobile list and pagination composition;
- first-use empty versus filtered-empty content;
- loading, error/retry and pending pagination/filter behavior;
- keyboard flow, focus restoration, live-region behavior and reduced motion;
- relationship to the existing authenticated shell without changing Dashboard or Flashcard.

HUMAN approval of this checkpoint is a hard dependency for production page implementation. The checkpoint may refine presentation but cannot change the approved API/business contract.

### 8.3 Production Page Implementation After Checkpoint Approval

Create a focused Learning Progress page/component area that owns:

- current page and selected status;
- loading/success/error state;
- server summary/items/filter/pagination response;
- request replacement protection so a slower stale filter/page response cannot overwrite newer selection;
- retry using the current page/filter;
- page reset to 1 on filter change;
- duplicate-action protection while a request is pending.

Render:

- the four persisted summary values with explicit labels;
- approved text status for each row;
- word, optional phonetic, review count and safe last-reviewed formatting;
- first-use empty when `total_started` is zero;
- filtered-empty when summary is nonzero but the page/filter has no items;
- previous/next controls and page context derived only from server pagination;
- accessible loading and actionable safe error states.

Do not add charts, search, sorting, vocabulary detail links, review actions, recommendations or Dashboard widgets.

## 9. Validation, Authorization and Safety

- Backend session identity is the only source of `user_id`.
- The repository applies `user_id` to summary, count and item queries independently.
- Frontend role visibility never replaces backend USER authorization.
- Query validation is authoritative in the backend; frontend parameter construction is UX only.
- API output uses explicit selections to prevent accidental private/internal-field exposure.
- Read-only tests snapshot row count and every stored progress field before/after repeated calls.
- All DB-backed development/test work uses `configureTestEnvironment()` and the guarded dedicated TEST database. No Main, Preview or Production access.
- No raw or unguarded Prisma migration/reset command is required because the schema does not change.

## 10. Testing Strategy

### 10.1 Backend / API / Database

Extend focused Learning coverage or add a narrowly named progress-view suite for:

- USER-only success, unauthenticated `401`, ADMIN `403` and forged-user isolation;
- zero-row summary and first page;
- exact summary counts including a controlled `NEEDS_REVIEW` compatibility fixture;
- summary independence from status filter/page;
- default, boundary and out-of-range pagination;
- all three status filters and filtered-empty results;
- approved deterministic ordering including tied timestamps and nullable `last_reviewed_at`;
- minimal projection and absence of internal/SRS/aggregate fields;
- malformed, repeated, unknown and unsupported query validation;
- safe unexpected `500` behavior;
- repeated reads causing no row or field mutation;
- no regression to learning Set payload or meaningful event semantics.

Use controlled fixtures and targeted cleanup through existing guarded helpers. Do not reset or migrate an unverified database.

### 10.2 Frontend Unit / Component

- Learning service query serialization, response validation and safe error mapping.
- Page state transitions for initial loading, first-use empty, filtered-empty, retry and success.
- Filter resets page 1; pagination boundaries and pending duplicate protection.
- Stale-response protection for rapid filter/page changes.
- Status textual semantics, nullable phonetic/date handling and accessible labels/focus behavior.
- Route and navigation visibility for USER versus ADMIN/Guest.

### 10.3 Browser / Real Stack

Add a focused guarded real-stack flow covering:

- USER navigation and current-user-only summary/list;
- status filter and pagination with deterministic records;
- loading, empty and safe-error/retry behavior where existing interception conventions are appropriate;
- keyboard navigation, focus, responsive mobile/desktop layout and no horizontal overflow;
- direct Guest/ADMIN route protection;
- verification that page reads leave progress unchanged.

### 10.4 Regression

Run the scoped existing suites affected by shared code:

- Learning backend and Learning real-stack;
- Authentication/session/role middleware;
- Auth/App Layout route/navigation browser coverage;
- Vocabulary and Vocabulary Set integration where the Learning payload composition shares repository/application wiring;
- frontend lint, focused unit tests and production build.

Do not rerun unrelated expensive suites without a concrete shared-boundary reason. Record exact PASS/FAIL/TODO/NOT RUN evidence.

## 11. Safety, Diff and Rollback Boundaries

- Each implementation phase remains independently reviewable: docs, backend/API, backend tests, frontend foundation, UI checkpoint, page UI, browser/regression, formal closure.
- The API is additive and can be reverted without changing existing Learning endpoints or stored data.
- Frontend navigation is added only with a real guarded route; it can be reverted with the page/service additions without affecting Dashboard or Flashcard.
- No migration rollback exists or is needed.
- Keep commits/tasks free of generated Playwright reports, local environment files, fixtures, logs and secrets.
- Verify `git diff --check`, scope, secret safety and controlled fixture cleanup at applicable gates.
- Any need for schema/index changes, a different user-visible aggregate, or SRS/Words-to-Review behavior stops implementation and returns for HUMAN contract review.

## 12. Implementation Order and Dependencies

1. After HUMAN PLAN/TASK approval, synchronize the approved active documentation contract and establish a distinct extension status without reopening the completed Learning engine.
2. Implement the read-only repository/service/controller/router operation using the existing schema and USER authorization.
3. Add and pass focused backend/database/API/security coverage; run the required Learning/Auth backend regressions.
4. Add the frontend service, guarded route and USER navigation foundation only.
5. Record the Learning Progress View UI/UX Design Checkpoint and obtain explicit HUMAN approval.
6. Implement the production page and all approved functional/responsive/accessibility states from the checkpoint.
7. Add frontend unit and guarded real-stack browser coverage; run scoped Auth/App Layout, Learning and relevant Vocabulary Set regressions, lint and production build.
8. Perform formal TEST and REVIEW against AC-01 through AC-15, prepare closure evidence and update status to `DONE` only after HUMAN final approval.

Dependency chain:

```text
Approved docs
    → Backend read contract
    → Backend verification
    → Frontend service/route foundation
    → HUMAN UI/UX DESIGN APPROVAL
    → Production page
    → Browser/regression verification
    → Formal TEST/REVIEW
    → HUMAN closure approval
```

## 13. Risks and Considerations

- **Completed-feature naming:** Treat this as Learning Progress View V1; do not change the existing engine from `DONE` to unfinished.
- **Summary consistency:** Separate unconstrained reads could disagree during concurrent events; use one consistent read snapshot without introducing write locks.
- **Remote TEST DB latency:** Keep reads bounded and avoid N+1 queries. Latency is an environment observation, not permission to cache progress or weaken tests.
- **`NEW` ambiguity:** Never derive a global `NEW` count from Vocabulary or Set membership.
- **`NEEDS_REVIEW` interpretation:** Label it as current stored status only; do not present due dates, queue actions or an implemented review recommendation.
- **Legacy documentation:** Do not implement legacy accuracy, history, Topic progress, Dashboard or gamification text while synchronizing the active V1 contract.
- **Route sharing:** Extend existing Learning modules carefully so Set payload/event behavior and Focus Mode remain unchanged.
- **No new dependency:** Existing React, router, HTTP, Prisma and Playwright capabilities are sufficient.

## 14. Open Questions

None. The approved SPEC fixes actors, API shape, summary semantics, filter/search boundary, projection, ordering, UX states and deferred domains. The PLAN and TASK decomposition are HUMAN approved; implementation remains constrained to the active approved task boundary.

## Approval Gate

```text
EXISTING LEARNING PROGRESS ENGINE: DONE
LEARNING PROGRESS VIEW V1 SPEC: HUMAN APPROVED
LEARNING PROGRESS VIEW V1 PLAN: APPROVED
HUMAN PLAN APPROVAL: APPROVED
LEARNING PROGRESS VIEW V1 TASK: APPROVED
IMPLEMENTATION AUTHORIZED: YES — only through the approved task sequence
```
