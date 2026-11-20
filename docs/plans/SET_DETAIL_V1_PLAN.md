# PLAN: ELVocab Set Detail V1

## 1. Summary

Implement Set Detail V1 as a dedicated USER page at `/my/vocabulary-sets/:setId`, backed by the existing owner-scoped Personal Set API. Extend only the private detail query/response with the approved first-meaning/first-example display projection. Reuse the existing full-list Set PATCH, scoped picker, atomic private-Vocabulary create-and-add endpoint, private Vocabulary edit endpoints, metadata modal, Learning route, and Quiz route.

The frontend will separate list and detail routing, replace the current inline detail block with a responsive learning hub, and introduce one centered add-Vocabulary modal with two internal steps: search/select and create-new. No database migration, new endpoint, dependency, role, drawer, nested modal, or Set Create/Edit membership UI is planned.

## 2. Affected areas

- **Database**: no schema or migration change; existing `VOCABULARY`, `VOCABULARY_MEANING`, `VOCABULARY_EXAMPLE`, `VOCABULARY_SET`, and `VOCABULARY_SET_ITEM` relations are reused.
- **Backend repository**: extend only the owner-private Set detail selection with ordered meanings and one ordered example.
- **Backend service**: map the selected nested records to nullable `primary_meaning`; keep public and ADMIN detail payloads unchanged.
- **Controller/routes**: no new route or controller behavior; existing owner-scoped `GET /api/my/vocabulary-sets/:setId` returns the backward-compatible extension.
- **API**: add `primary_meaning` to private detail items; reuse all existing write contracts.
- **Frontend routing**: route the list and detail paths to separate page components.
- **Frontend UI/state**: dedicated hub with compact back-and-name-only header, learning cards, ordered responsive list and count heading, one add workflow, private edit, membership removal, and state/error handling; Set metadata edit/delete remain in My Sets management.
- **Learning/Quiz navigation**: use the shared focus-mode shell and resolve both Flashcard and Quiz back actions directly to the current Set Detail URL.
- **Tests**: backend contract/integration, frontend service/unit, focused mocked browser, guarded real-stack, and affected regressions.
- **Documentation**: synchronize active API/UI/status documents after verified implementation and approval.

## 3. Existing code to reuse

- `backend/src/routes/vocabulary-set-routes.js` — existing authenticated USER detail, PATCH, delete, picker, and Set-scoped private-create routes.
- `backend/src/controllers/vocabulary-set-controller.js` — existing USER identity forwarding and safe service-error mapping; no planned change.
- `backend/src/repositories/vocabulary-set-repository.js` — owner-scoped private query, deterministic nested ordering conventions, reusable-ID validation, transactional ordered replacement, and atomic append.
- `backend/src/services/vocabulary-set-service.js` — owner checks, exact-ID validation, private/source projection, full-list replacement, picker behavior, and idempotent private create-and-add.
- `frontend/src/services/vocabulary-set-service.js` — list/detail/update/delete, picker, and private create-and-add calls plus safe error mapping.
- `frontend/src/services/vocabulary-service.js` — owner-private Vocabulary GET/PATCH and response validation.
- `frontend/src/vocabulary-sets/my-vocabulary-sets-page.jsx` — approved list UI, metadata modal behavior, Set summary refresh rules, and existing delete semantics.
- `frontend/src/vocabulary-sets/private-vocabulary-editor.jsx` and `private-vocabulary-form-model.js` — supported private Vocabulary fields, validation, serialization, and shared-identity edit warning.
- `frontend/src/vocabulary-sets/private-vocabulary-action.js` — stable operation ID and duplicate-submit/idempotent retry coordination for atomic create-and-add.
- `frontend/src/learning/learning-foundation-page.jsx` — existing `returnTo` navigation contract.
- `frontend/src/quiz/quiz-foundation-page.jsx` and `frontend/src/quiz/quiz-navigation.js` — focus-mode Quiz shell and direct Set Detail return resolution.
- `frontend/src/auth/ui/authenticated-shell.jsx` and existing My Sets styles in `frontend/src/index.css` — authenticated shell suppression for learning focus routes; flex USER header below `lg`, mobile mark-only branding, tablet full branding, desktop centered navigation, focus styles, touch sizing, and reduced-motion conventions.
- Existing Vocabulary Set, Personal Vocabulary, Learning, and Quiz unit/browser/real-stack fixtures and helpers — extend rather than duplicate where their scope already matches.

## 4. Database plan

### 4.1 Existing models

- `VOCABULARY_SET` and ordered `VOCABULARY_SET_ITEM` remain the authoritative Set aggregate.
- `VOCABULARY` identity remains UUID-based and may be canonical (`owner_id = null`) or USER-private.
- `VOCABULARY_MEANING` and `VOCABULARY_EXAMPLE` already contain the display fields and deterministic timestamps/IDs required for the read projection.
- Existing uniqueness and ownership constraints continue to reject duplicate exact membership and foreign private Vocabulary.

### 4.2 Changes

- None to Prisma schema, constraints, indexes, data, or migrations.
- The repository read query will select existing related rows only.
- Migration verification consists of confirming that no migration is generated or added.

### 4.3 Ordering and concurrency

- Membership remains ordered by `position ASC`.
- Meanings and examples are ordered by `created_at ASC`, then `id ASC`, each limited to the first record needed for display.
- Existing full-list PATCH remains last-write-wins across concurrent tabs. No version column, lock token, or optimistic-concurrency mechanism is added.

## 5. Backend plan

### 5.1 Repository/data access

Update `backend/src/repositories/vocabulary-set-repository.js`:

1. Keep the existing public/System detail selection unchanged so public and ADMIN API contracts do not accidentally gain private display data.
2. Add a private-detail selection, or an equivalent private-only query extension, that selects each item's Vocabulary:
   - existing `word`, `phonetic`, and `owner_id`;
   - meanings ordered by `created_at ASC`, `id ASC`, `take: 1`;
   - for that meaning, examples ordered by `created_at ASC`, `id ASC`, `take: 1`;
   - only `part_of_speech`, `meaning_vi`, `example_en`, and nullable `example_vi` required by the projection, plus no unnecessary aggregate fields.
3. Use that selection only in `findPrivateByIdForOwner` and private create/update responses where the private detail contract is returned. If shared create/select helpers make that impractical, reload the owner-private detail before returning rather than broadening System payloads.
4. Preserve owner and `is_public: false` predicates and membership `position` ordering.

### 5.2 Service

Update `backend/src/services/vocabulary-set-service.js`:

1. Keep `getPrivateSet`, create, update, copy, and authorization behavior intact.
2. Map a private item's first selected meaning to:

   ```text
   primary_meaning: {
     part_of_speech,
     meaning_vi,
     example: { example_en, example_vi } | null
   } | null
   ```

3. Do not CEFR-rank, fall back to another meaning/example, or synthesize missing data.
4. Strip repository-only nested arrays/ownership fields from the response while retaining existing `source` calculation.
5. Avoid changing public/System projection, Learning selection rules, Quiz selection rules, or write normalization.

### 5.3 Routes/controllers/middleware

- Reuse `GET /api/my/vocabulary-sets/:setId` through the current authentication and USER authorization middleware.
- Reuse session USER ID for owner scoping; no frontend-supplied owner field.
- No new controller method, route, middleware, or error code is needed.
- Existing safe `404 VOCABULARY_SET_NOT_FOUND`, validation, authorization, and operational errors remain authoritative.

## 6. API contract plan

### 6.1 Extended endpoint

`GET /api/my/vocabulary-sets/:setId`

**Authentication/authorization**

- Authenticated USER only.
- Backend returns only an owned private Set.
- Missing, foreign, and otherwise inaccessible Sets preserve safe current behavior.

**Request**

- Existing UUID path parameter only.
- No query/body changes.

**Response extension**

- Preserve existing Set fields and item order/fields.
- Add `primary_meaning` to every item with the exact approved nullable shape.
- Derive it from the first meaning and first example in `created_at ASC`, `id ASC` order.
- Do not expose full Meaning/Example aggregates, CEFR, Topic-derived UI data, progress, or analytics.

### 6.2 Reused write/read endpoints

- `PATCH /api/my/vocabulary-sets/:setId`
  - metadata edit sends only `name` and `description`;
  - add/remove sends the complete ordered `items: [{ vocabulary_id }]` list;
  - omission semantics and exact-ID/owner validation remain unchanged.
- `DELETE /api/my/vocabulary-sets/:setId` — existing owner delete.
- `GET /api/vocabulary-set-picker?query=...` — bounded canonical plus current-owner private search.
- `POST /api/my/vocabulary-sets/:setId/vocabulary` — existing idempotent private create and atomic append.
- `GET/PATCH /api/my/vocabulary/:vocabularyId` — existing owner-private aggregate edit.

No granular membership endpoint or standalone private Vocabulary create endpoint is added.

## 7. Frontend plan

### 7.1 Routing and page separation

Update `frontend/src/app-router.jsx`:

- Keep `/my/vocabulary-sets` on `MyVocabularySetsPage`.
- Route `/my/vocabulary-sets/:setId` to a new dedicated `MyVocabularySetDetailPage` under the existing `ProtectedRoute`, `AuthenticatedShell`, and `UserRoute`.

Update `frontend/src/vocabulary-sets/my-vocabulary-sets-page.jsx`:

- Remove URL-param detail fetching and the inline `MySetDetail` block.
- Keep list, search, sort, empty/error states, and metadata create modal behavior.
- Render exactly one primary **Xem** link on every Set card, including empty Sets, targeting the detail URL.
- Keep **Chỉnh sửa** and **Xóa bộ từ** in the card's secondary action menu; remove card-level direct Flashcard and **Chi tiết** actions.
- Preserve successful create navigation to the new detail route.

### 7.2 Shared Set metadata and deletion UI

- Extract the approved centered metadata modal into a small reusable component module, proposed `frontend/src/vocabulary-sets/personal-vocabulary-set-modal.jsx`, so list create and detail edit share one implementation without importing page internals.
- Preserve name/description-only serialization, focus entry/restoration, Escape/backdrop handling, body scroll lock, pending protection, server-error persistence, and mobile sizing.
- Provide the detail page with an accessible Set delete confirmation using the existing approved native-dialog lifecycle pattern. Keep delete subtle in a danger/menu control and keep its error inside the active confirmation when applicable.
- On successful metadata edit, reload the authoritative detail. On successful Set deletion, navigate to `/my/vocabulary-sets` with no attempt to preserve the deleted detail.

### 7.3 Dedicated detail page

Create `frontend/src/vocabulary-sets/my-vocabulary-set-detail-page.jsx` with page-level orchestration:

- Read `setId`, load `vocabularySetService.getMySet(setId)`, and discard stale async results on route/unmount.
- Track explicit page load state, authoritative detail, per-workflow pending/error state, add modal step, private edit target, and membership-removal confirmation.
- Use a compact header containing only the My Sets back link and one `h1` with the Set name. Render the derived count in **Từ vựng trong bộ (N)**; do not render description, metadata edit, or Set delete in this header.
- Keep mutation state scoped so an add/remove/edit failure does not replace the whole loaded page.
- After each successful mutation, reload owner detail and use that response as authoritative rather than manually assuming membership IDs/positions.
- Render safe not-found/inaccessible separately from retryable operational load error based on existing `VocabularySetApiError.kind/code`.

### 7.4 Learning cards and return hierarchy

- Render Flashcard and Quiz cards only; no placeholder modes.
- For non-empty Sets:
  - Flashcard links to `/learn/vocabulary-sets/:setId` with `state.returnTo` set to the detail URL.
  - Quiz links to `/quiz/vocabulary-sets/:setId` with `state.returnTo` and `state.setName`.
- For empty Sets, render both cards as non-link disabled/unavailable presentations with **“Thêm từ vựng để bắt đầu”** while leaving all detail management controls enabled.
- Both activities use the dedicated focus-mode learning shell: no authenticated header/sidebar, a compact top bar with Set name, and back navigation directly to `/my/vocabulary-sets/:setId`.
- Reuse the authenticated-shell focus-route detection and the Quiz Set Detail resolver rather than duplicate shell/navigation logic.

### 7.5 Responsive vocabulary presentation

- Render items in ascending response `position`; do not add client sorting or reorder controls.
- Desktop/tablet table columns: **Từ vựng**, **Phiên âm**, **Từ loại**, **Nghĩa**, **Ví dụ**, **Hành động**.
- Mobile presentation exposes **Từ vựng**, **Nghĩa**, **Hành động** with programmatic labels and no horizontal overflow. Prefer one semantic table with scoped responsive column hiding if it remains accessible; otherwise use equivalent desktop table/mobile semantic list views without duplicating interactive state.
- Render only supplied data. Null phonetic, meaning, or example receives a quiet missing-value presentation, not generated fallback content.
- No audio/speaker control.
- Canonical row: remove-membership action only.
- `PRIVATE` row: edit and remove actions. Since the owner-private endpoint admits only canonical/current-owner private IDs, do not infer editability from spelling.

### 7.6 Add-Vocabulary modal

Create a centered native modal component, proposed `frontend/src/vocabulary-sets/add-vocabulary-modal.jsx`:

- Width target 640–720px on desktop; near-full available width on mobile with safe margins and internal vertical scrolling.
- One dialog/top-layer lifecycle, accessible name/description, initial focus, focus trap supplied by native dialog, Escape/backdrop/close/cancel, focus restoration, body scroll handling, and pending-state dismissal protection.
- Internal step `search`:
  - search through `vocabularySetService.searchVocabularyPicker`;
  - distinguish loading, validation, results, no-result, and safe error states;
  - show canonical/private source labels without raw UUID display;
  - disable or label an exact ID already present;
  - append an eligible selected ID by PATCHing the current authoritative IDs followed by the selected ID.
- Internal step `create`:
  - entered by **Tạo từ mới** within the same dialog;
  - reuse the private Vocabulary form fields/validation and provide a back/cancel path inside the same dialog;
  - use `createPrivateVocabularyAction`/`createPrivateVocabularySubmitter` so one stable operation ID survives safe retry and duplicate submit is deduplicated;
  - call the existing atomic create-and-add endpoint;
  - do not mount another dialog or backdrop.
- Success closes the add modal and refreshes detail. Failure stays in the relevant step and preserves query/form values for retry.

### 7.7 Private Vocabulary editor reuse

Refine `frontend/src/vocabulary-sets/private-vocabulary-editor.jsx` only as needed to separate reusable form content from its current backdrop/dialog wrapper:

- Provide form content usable inside the add modal's create step without nesting a modal.
- Preserve existing fields, validation model, serialization, server-error visibility, pending guard, and shared-identity warning for edit mode.
- For row edit, either use the same single-dialog shell in edit mode or a separate invocation when the add modal is closed; never layer dialogs.
- Load the authoritative aggregate with `vocabularyService.getPrivateVocabulary`, save with `updatePrivateVocabulary`, and refresh Set detail so changed display projection is visible.
- Do not expose edit for canonical rows.

### 7.8 Remove membership

- Start from the latest loaded authoritative `detail.items` order.
- Submit all IDs except the selected exact `vocabulary_id` through `updateMySet(setId, { items })`.
- Prevent duplicate removal submission and retain a safe inline/confirmation error with retry/cancel behavior.
- Reload detail after success; do not delete the Vocabulary or alter Learning Progress.
- No manual reorder controls.

### 7.9 Styling

Use Tailwind utilities in the Set Detail, My Sets, shared action-menu, modal, and editor components for ordinary layout and styling:

- reuse the authenticated content width and warm educational tokens;
- give learning cards primary visual emphasis while keeping My Sets management actions secondary;
- provide responsive six/three-column behavior and safe wrapping;
- ensure all relevant controls meet 44px touch targets and visible-focus expectations;
- size the add modal per the approved desktop/mobile constraints;
- support dialog top layer/backdrop and reduced motion;
- do not add Set Detail ordinary layout rules to `frontend/src/index.css`; retained global custom CSS is limited to previously approved special behavior such as Auth animation and Flashcard 3D transforms.

## 8. Validation and business logic

- Backend remains authoritative for USER role, Set ownership, private Vocabulary ownership, reusable identity, duplicate exact membership, and transaction behavior.
- Frontend prevents obvious duplicate exact IDs for UX, but handles backend `VOCABULARY_ALREADY_IN_SET`, not-found, validation, authorization, conflict, and operational errors safely.
- Same spelling with different IDs remains valid throughout UI keys, selection, PATCH payloads, and tests.
- Picker query uses the current non-empty/max-length contract; no client-only catalog semantics are introduced.
- Metadata writes continue to omit `topic_id` and `items`.
- Membership writes include only ordered `vocabulary_id` objects and accept recreated membership IDs.
- A stale concurrent tab may overwrite membership. The page reloads after mutations, but V1 does not claim conflict detection.
- Pending operations block duplicate submission and unsafe modal dismissal without globally disabling unrelated read content unnecessarily.

## 9. Testing plan

All database-backed verification must use the repository's dedicated TEST DB safeguards. Main, Preview, and Production databases are prohibited.

### 9.1 Backend/unit and integration

Update `backend/test/vocabulary-set/vocabulary-set.test.js` and focused supporting tests as needed to prove:

- owner private detail returns the exact `primary_meaning` shape;
- first `created_at/id` meaning wins even when a later meaning has a lower CEFR;
- first ordered example wins;
- no meanings produces `primary_meaning: null`;
- selected meaning with no examples produces `example: null`;
- nullable translation remains null and no fallback is invented;
- item order and source remain unchanged;
- foreign/missing private Set remains safely inaccessible;
- public and ADMIN detail shapes do not gain the private projection;
- full-list append/remove exact-ID, duplicate exact identity, same-spelling distinct identity, ownership, and Progress-preservation regressions remain green;
- atomic private create-and-add idempotency/order remains green.

No migration test is required beyond asserting no schema/migration change; existing database invariant suites still run as regression.

### 9.2 Frontend unit/service

Update/add focused tests in the existing `frontend/test` structure:

- `vocabulary-set-service.test.js`: validate private detail projection, picker, PATCH shape, and safe error mapping without changing public/ADMIN behavior.
- private Vocabulary form/action tests: same-modal create step, stable operation ID, pending deduplication, retry, and edit serialization.
- `quiz-navigation.test.js`: selection and active back behavior resolves to the detail URL for explicit `returnTo` and safe fallback remains intact.
- Add small pure presentation/state tests only where logic warrants extraction (ordered payload construction, exact-ID eligibility, or responsive field model); avoid testing implementation-only markup through brittle source assertions.

### 9.3 Mocked browser coverage

Add a focused spec, proposed `frontend/e2e/auth/my-vocabulary-set-detail.spec.js`, and update current My Sets/modal specs:

- single **Xem** card CTA for populated and empty Sets, with edit/delete in the management menu and no **Chi tiết** or direct Flashcard CTA;
- compact back-and-name-only detail header, section-heading count, and owner-safe loading/error/retry/not-found states;
- populated Flashcard/Quiz links, focus shells, and direct Set Detail return behavior;
- empty cards visible, disabled, and showing **“Thêm từ vựng để bắt đầu”** while add remains usable;
- desktop six-column and mobile three-column presentation, long-content wrapping, 375px no-overflow check, and no audio control;
- centered add modal dimensions, search state, exact-ID duplicate handling, same-spelling IDs, source actions, create-step transition without nested dialogs, pending guard, error persistence, Escape/backdrop/close/focus restoration;
- private row edit, canonical non-editability, remove success/failure, authoritative refresh;
- My Sets metadata modal stays name/description-only and card-menu delete remains secondary/safe;
- keyboard focus and 44px interaction checks where Playwright can meaningfully observe them.

### 9.4 Guarded real-stack

Extend `frontend/e2e/integration/personal-vocabulary-real-stack.spec.js` or add a focused Set Detail real-stack spec using TEST DB fixtures to prove:

- owner can load the projected ordered detail and foreign USER cannot;
- picker returns canonical/current-owner private only;
- exact existing identity append, duplicate exact rejection, and same-spelling distinct identity;
- **Tạo từ mới** creates one private identity and atomically appends at the end with retry/idempotency protection;
- owned private edit updates the displayed projection without changing membership identity/order;
- remove rewrites membership order but preserves Vocabulary row and existing Learning Progress;
- metadata-only edit preserves exact membership/order;
- Flashcard and Quiz launch from detail and return to detail;
- empty Set exposes management but cannot launch an invalid activity.

Run existing guarded USER and ADMIN Vocabulary Set regressions to prove ADMIN Topic/picker/reorder behavior is unchanged.

### 9.5 Full verification matrix

- Focused backend Vocabulary Set and Personal Vocabulary suites.
- Relevant database/schema invariant regression on dedicated TEST DB.
- Frontend unit suite.
- Focused Set Detail, My Sets, metadata modal, Learning, and Quiz browser specs.
- Guarded USER/ADMIN real-stack suites and the repository-required full real-stack matrix.
- Browser smoke suite.
- `npm run lint` and `npm run build` from the correct repository/frontend context per package scripts.
- `git diff --check`.
- Verify no screenshots, traces, videos, Playwright reports, test-results, or temporary fixture/spec artifacts are tracked.

## 10. Documentation impact

After implementation behavior is verified:

- `docs/API_SPEC.md` — document private detail `primary_meaning`, deterministic first-record rule, null behavior, and unchanged write endpoints.
- `docs/UI_UX_SPEC.md` — replace the deferred Set Detail placeholder with the approved hub, modal, learning, responsive list, state, and accessibility contracts; keep Personal Set Create/Edit metadata-only and ADMIN behavior intact.
- `docs/FEATURE_STATUS.md` — mark Set Detail V1 `IN_PROGRESS` during implementation if repository convention requires; mark `DONE` only after TEST, REVIEW, human approval, and authorized closure.
- `docs/PROJECT_OVERVIEW.md`, `docs/ARCHITECTURE.md`, and `docs/DATABASE.md` require no change unless implementation reveals a verified active-document mismatch; no scope, architecture, or schema change is planned.
- Reconcile this feature's SPEC/PLAN/TASK with final HUMAN-approved behavior; do not rewrite unrelated historical documents.

## 11. Proposed file impact

Expected new files:

- `frontend/src/vocabulary-sets/my-vocabulary-set-detail-page.jsx`
- `frontend/src/vocabulary-sets/add-vocabulary-modal.jsx`
- `frontend/src/vocabulary-sets/personal-vocabulary-set-modal.jsx` if extracted as planned
- `frontend/e2e/auth/my-vocabulary-set-detail.spec.js`

Expected modified files:

- `backend/src/repositories/vocabulary-set-repository.js`
- `backend/src/services/vocabulary-set-service.js`
- `backend/test/vocabulary-set/vocabulary-set.test.js`
- `frontend/src/app-router.jsx`
- `frontend/src/vocabulary-sets/my-vocabulary-sets-page.jsx`
- `frontend/src/vocabulary-sets/private-vocabulary-editor.jsx`
- `frontend/src/services/vocabulary-set-service.js`
- `frontend/src/index.css`
- relevant existing frontend unit tests named in Section 9
- `frontend/e2e/auth/my-vocabulary-sets-foundation.spec.js`
- `frontend/e2e/auth/my-vocabulary-set-modal.spec.js`
- relevant guarded real-stack specs named in Section 9
- active documentation named in Section 10

The TASK stage must confirm the final exact list against the then-current tree. Controller, route, Prisma schema, migration, package, and lock files are not expected to change.

## 12. Implementation order

1. Add focused backend tests for the private detail projection and unchanged public/ADMIN shapes.
2. Split the private repository detail selection and implement service projection mapping.
3. Extend frontend service validation/normalization and unit tests for the new private detail shape.
4. Extract the reusable Personal Set metadata modal without changing behavior; update existing focused tests.
5. Separate list/detail routes and change My Sets cards to the single Detail **Xem** CTA with secondary edit/delete management.
6. Build the dedicated detail page shell, page states, compact header, learning cards, section count, and responsive ordered vocabulary presentation.
7. Refactor private Vocabulary editor content for safe single-modal composition.
8. Build the centered add modal search/create steps with picker, exact-ID append, idempotent private create-and-add, focus, pending, and error behavior.
9. Integrate private edit and membership removal on Detail while preserving metadata edit and Set deletion in My Sets management; reload authoritative detail after every successful Detail mutation.
10. Align Flashcard/Quiz focus-mode entry and direct Set Detail return behavior and update navigation tests.
11. Add/adjust focused mocked browser and guarded real-stack coverage.
12. Run the approved TEST matrix on dedicated TEST DB only and resolve only in-scope defects through the normal IMPLEMENT→TEST loop.
13. Synchronize active API/UI documentation and status according to workflow stage.
14. Run final lint, build, diff/artifact checks, then proceed to REVIEW only after TEST passes.

## 13. Risks and considerations

- A shared repository select currently serves public, ADMIN, and private details; careless extension would broaden public contracts. The private query must be isolated.
- The approved display projection intentionally differs from CEFR-aware Learning/Quiz selection. Reusing the wrong selector would violate the SPEC.
- Full-list PATCH can overwrite concurrent-tab membership changes. This is documented and accepted for V1; reloading does not eliminate the race.
- Replacing items recreates membership row IDs. UI/tests must key Vocabulary behavior by `vocabulary_id`, not assume membership IDs are stable across writes.
- The current private editor owns a backdrop/dialog-like wrapper. It must be decomposed before reuse to avoid modal-on-modal behavior while preserving its validated form logic.
- Large private forms inside a 640–720px modal require bounded height/internal scrolling and careful mobile reachability.
- Editing a private Vocabulary changes the shared exact identity in every Set that references it; preserve the existing warning.
- Delete and remove errors must remain inside the active workflow and never leak raw backend detail.
- Existing Dashboard links may still navigate directly to Learning. This SPEC changes My Sets cards only; unrelated Dashboard behavior must not be silently expanded unless an active canonical contract explicitly requires alignment during TASK review.

## 14. Scope and dependency check

- No new package or external service.
- No database migration or schema/constraint/index change.
- No new API endpoint or architecture layer.
- No new role or authorization model.
- No Set Detail for System/Public or ADMIN.
- No Set Create/Edit membership regression.
- No manual reorder, pagination, optimistic concurrency, fake activity, or analytics.
- Backend remains authoritative for ownership, identity, validation, and persistence.

## 15. Open questions

None blocking. The approved SPEC fixes the modal form factor, deterministic projection, empty-Set behavior, My Sets secondary management actions, compact Detail header, focus-shell return behavior, and V1 concurrency boundary. Exact component splitting may be adjusted during TASK/implementation only when it preserves these contracts and the minimal-change principle.
