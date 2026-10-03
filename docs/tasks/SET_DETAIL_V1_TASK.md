# TASKS: ELVocab Set Detail V1

## Overview

These tasks implement the approved owner-scoped Personal Vocabulary Set learning hub at `/my/vocabulary-sets/:setId`. Work extends the existing completed Vocabulary Set, Personal Vocabulary, Learning, and Quiz foundations. It adds one private-detail read projection and a dedicated frontend page while reusing all approved write endpoints and preserving exact Vocabulary identity.

The tasks deliberately exclude database changes, new endpoints, manual reorder, optimistic concurrency, System/ADMIN redesign, and unimplemented learning modes.

## Feature status

Current Status: **DONE — implementation, cumulative TEST, and REVIEW completed; ready for HUMAN closure and commit approval**

- `docs/FEATURE_STATUS.md` records Vocabulary Set V1, Personal Vocabulary, Learning, Quiz, and Personal Set Topic Decoupling as completed foundations.
- Set Detail implementation tasks are present in the working tree and the HUMAN UI review corrections have been integrated.
- Focused backend, frontend unit, browser, guarded TEST-database real-stack, lint/build, and diff checks completed successfully.
- Stale real-stack assertions were reconciled with the approved accessible UI and current My Sets management workflow without weakening their data or workflow assertions.
- `docs/FEATURE_STATUS.md` records the completed Set Detail V1 checkpoint; commit and push remain subject to separate HUMAN approval.

### Progress snapshot

- **TASK-001 through TASK-013**: implemented and verified.
- **TASK-014**: completed; cumulative verification and evidence handoff finished.
- **Formal TEST / REVIEW**: completed with no remaining product-regression blocker.
- **HUMAN closure/commit approval**: pending; no commit or push has occurred on this feature branch.
- Set Detail V1 has an approved SPEC, PLAN, completed implementation, and completed verification.
- Do not rewrite completed foundation behavior. Extend and reuse it.
- The current HUMAN closure request authorizes the DONE status update; commit and push remain separately gated.

## Task dependency graph

```text
TASK-001 Backend contract tests
    ↓
TASK-002 Private detail projection
    ↓
TASK-003 Frontend service contract
    ├──────────────┐
    ↓              ↓
TASK-004       TASK-005
Shared UI      List/route separation
    └──────┬───────┘
           ↓
        TASK-006 Detail hub foundation
           ├───────────────┐
           ↓               ↓
        TASK-007        TASK-008
        Add modal       Learning navigation
           ↓               │
        TASK-009            │
        Row mutations       │
           └───────┬────────┘
                   ↓
                TASK-010 My Sets management + Detail states/a11y
                   ↓
                TASK-011 Mocked browser coverage
                   ↓
                TASK-012 Guarded real-stack/regressions
                   ↓
                TASK-013 Active documentation sync
                   ↓
                TASK-014 Implementation verification handoff
```

TASK-004 and TASK-005 may proceed in parallel after TASK-003 only if they are coordinated to avoid conflicting edits in `my-vocabulary-sets-page.jsx`. All later tasks use the integrated result.

---

## TASK-001: Add private Set detail projection contract tests

### Objective

Establish failing backend tests for the approved USER-only `primary_meaning` projection and the unchanged public/ADMIN response boundaries before changing production code.

### Dependencies

- Approved SPEC and PLAN.

### Files / modules

- `backend/test/vocabulary-set/vocabulary-set.test.js` — primary owner/private and public/System contract coverage.
- `backend/test/personal-vocabulary/private-vocabulary-api.test.js` — only if existing fixture helpers are required for private aggregate/null scenarios.

### In scope

- Owner-private Set detail projection tests.
- Deterministic meaning/example ordering and null behavior.
- Public/ADMIN contract regression assertions.
- Owner/inaccessible behavior regression.

### Out of scope

- Production implementation.
- Learning/Quiz meaning-selection changes.
- Database migration or fixtures outside dedicated TEST DB conventions.

### Implementation requirements

- Build fixtures with multiple meanings whose `created_at`/`id` order conflicts with CEFR rank, proving Set Detail uses the first authoritative record rather than CEFR ranking.
- Build multiple examples and prove the first by `created_at ASC`, then `id ASC` is projected.
- Cover no meanings, meaning with no examples, and nullable `example_vi`.
- Assert exact projected fields only: `part_of_speech`, `meaning_vi`, and nullable `example` containing `example_en` and nullable `example_vi`.
- Assert item `position`, `source`, and exact `vocabulary_id` behavior is unchanged.
- Assert public and ADMIN detail items do not gain the private-only projection.

### Acceptance criteria

- Tests define the exact nullable projection shape.
- Tests fail against the pre-feature private-detail implementation for the expected missing projection, not because of invalid setup.
- Public/ADMIN boundary assertions represent current approved contracts.
- Foreign/missing owner detail remains safely inaccessible.

### Verification

- Run the focused backend Vocabulary Set test file against the dedicated TEST DB.
- Confirm fixture cleanup follows existing helpers and does not touch Main/Preview/Production.

---

## TASK-002: Implement the USER owner-detail read projection

### Objective

Extend only the owner-private Set detail repository/service response with deterministic `primary_meaning` while preserving every System/public/ADMIN contract.

### Dependencies

- TASK-001.

### Files / modules

- `backend/src/repositories/vocabulary-set-repository.js` — private-only nested read selection.
- `backend/src/services/vocabulary-set-service.js` — private item projection mapping.
- `backend/test/vocabulary-set/vocabulary-set.test.js` — complete focused coverage from TASK-001.

### In scope

- Private repository selection for first ordered meaning/example.
- Service mapping and removal of repository-only nested data.
- Existing owner authorization and safe errors.

### Out of scope

- Controller, route, middleware, Prisma schema, or migration changes.
- CEFR-aware selection for Set Detail.
- Full Meaning/Example aggregate exposure.
- Learning or Quiz response changes.

### Implementation requirements

- Keep the shared public/System detail selection unchanged; introduce or use a private-only selection for `findPrivateByIdForOwner` and private detail responses.
- Order meanings by `created_at ASC`, then `id ASC`, selecting only the first required record.
- Order that meaning's examples by `created_at ASC`, then `id ASC`, selecting only the first required record.
- Map no meaning to `primary_meaning: null`.
- Map no example to `example: null`.
- Preserve nullable `example_vi` without fallback, generation, or substitution.
- Preserve current item ordering, `source`, ownership, exact identity, create/update/copy behavior, and safe errors.
- Ensure private create/update responses returned as details satisfy the same projection or reload authoritative private detail if necessary.

### Acceptance criteria

- `GET /api/my/vocabulary-sets/:setId` returns the approved projection for every item.
- A later lower-CEFR meaning does not displace the first authoritative meaning.
- Public and ADMIN detail responses remain byte-shape compatible apart from unrelated timestamps/data values.
- No schema or migration file changes.
- All focused backend tests pass on TEST DB.

### Verification

- Run focused Vocabulary Set and Personal Vocabulary backend suites on TEST DB.
- Run relevant public/ADMIN Vocabulary Set regression tests.
- Confirm `git diff` contains no Prisma schema or migration file.

---

## TASK-003: Validate and consume the private detail projection in the frontend service

### Objective

Give the frontend a strict, safe representation of the extended USER detail contract without using Learning API data or fabricating display fields.

### Dependencies

- TASK-002.

### Files / modules

- `frontend/src/services/vocabulary-set-service.js` — owner-detail normalization/validation.
- `frontend/test/vocabulary-set-service.test.js` — response and error contract tests.

### In scope

- USER detail item validation for `primary_meaning` and nested example.
- Null preservation.
- Existing service calls and error mapping.

### Out of scope

- Learning service calls for display data.
- Public/ADMIN response expansion.
- Fake phonetic, part-of-speech, meaning, or example values.

### Implementation requirements

- Route `getMySet` through USER-detail validation that checks existing fields, `source`, and exact nullable projection shape.
- Preserve `null` for absent meaning/example/translation.
- Do not validate public/ADMIN aggregates against the private-only shape.
- Keep existing picker validation distinct; picker `primary_meaning` has its existing smaller shape.
- Preserve safe `VocabularySetApiError` mapping.

### Acceptance criteria

- Valid complete and null projections are accepted without mutation or invented values.
- Malformed nested projections fail as `INVALID_VOCABULARY_SET_RESPONSE`.
- Public, ADMIN, picker, create, update, copy, and delete service behavior remains compatible.
- No Learning API is called or imported.

### Verification

- Run `frontend/test/vocabulary-set-service.test.js` and relevant service unit tests.
- Confirm payload and endpoint assertions remain exact.

---

## TASK-004: Extract reusable Personal Set and private Vocabulary form UI

### Objective

Prepare existing approved forms for reuse by Set Detail without behavior changes and without nested dialog stacks.

### Dependencies

- TASK-003.

### Files / modules

- `frontend/src/vocabulary-sets/my-vocabulary-sets-page.jsx` — remove internal-only metadata modal definition after extraction.
- `frontend/src/vocabulary-sets/personal-vocabulary-set-modal.jsx` — proposed shared metadata modal module.
- `frontend/src/vocabulary-sets/private-vocabulary-editor.jsx` — separate reusable form content from its wrapper.
- `frontend/src/vocabulary-sets/private-vocabulary-form-model.js` — reuse without contract changes unless a small export is required.
- `frontend/e2e/auth/my-vocabulary-set-modal.spec.js` — metadata modal regression.
- `frontend/test/private-vocabulary-ui.test.js` and form/action unit tests — legitimate reusable form coverage.

### In scope

- Extract the existing centered metadata modal unchanged.
- Expose private Vocabulary form content that can render inside one parent modal.
- Preserve create/edit validation, serialization, pending, errors, and shared-identity warning.

### Out of scope

- New form fields.
- Membership controls in metadata Create/Edit.
- ADMIN editor refactor.
- Opening a private editor over an already open modal.

### Implementation requirements

- Preserve metadata request shape: name and description only; no `topic_id` or `items`.
- Preserve native dialog lifecycle, focus entry/restoration, Escape/backdrop/close, body scroll lock, server-error persistence, duplicate-submit guard, mobile layout, and current button order.
- Separate private Vocabulary fields/form from the current wrapper so the add workflow can switch steps inside one dialog.
- Keep a single-dialog edit entry available for owned-private rows and keep the existing shared-identity warning.
- Avoid unrelated component architecture refactors.

### Acceptance criteria

- Existing Personal Set modal behavior and focused tests remain unchanged in observable terms.
- Private Vocabulary form can be embedded without rendering another backdrop or `role=dialog`.
- No nested modal-on-modal path exists.
- No USER membership picker returns to Personal Set metadata Create/Edit.

### Verification

- Run metadata modal Playwright and relevant private form/action unit tests.
- Inspect DOM in focused coverage to confirm only one modal dialog is present.

---

## TASK-005: Separate list/detail routing and convert My Sets cards to one CTA

### Objective

Keep My Sets list responsibility separate and route all card learning entry through the dedicated Set Detail URL.

### Dependencies

- TASK-003.

### Files / modules

- `frontend/src/app-router.jsx` — dedicated detail page route target.
- `frontend/src/vocabulary-sets/my-vocabulary-sets-page.jsx` — list-only responsibility and card CTA.
- `frontend/src/vocabulary-sets/my-vocabulary-set-detail-page.jsx` — create route component shell for subsequent tasks.
- `frontend/e2e/auth/my-vocabulary-sets-foundation.spec.js` — single-CTA regression.
- `frontend/e2e/auth/my-vocabulary-set-modal.spec.js` — update detail-route edit setup after separation.

### In scope

- Retain `/my/vocabulary-sets/:setId` under existing USER guards.
- Route it to a dedicated component.
- Remove inline detail loading/rendering from list page.
- Make every Set card, including empty Sets, expose exactly one primary **Xem** link to Detail and retain edit/delete in the secondary management menu.

### Out of scope

- Direct card navigation to Flashcard.
- A **Chi tiết** card CTA.
- Dashboard link changes unless later regression evidence proves the approved Set Detail scope explicitly requires them.

### Implementation requirements

- Keep `/my/vocabulary-sets` search, sort, loading/error/first-use/search-empty states unchanged.
- Preserve create success navigation to `/my/vocabulary-sets/:setId`.
- Card **Xem** must be available for `item_count: 0` because Detail owns first Vocabulary addition.
- Remove retired inline `MySetDetail` paths and styles only where no longer used.

### Acceptance criteria

- List and detail URLs render separate page responsibilities.
- Every card has one **Xem** CTA, a secondary edit/delete management menu, and no **Chi tiết** or direct Flashcard link.
- Empty Set CTA opens Detail rather than showing a non-interactive card label.
- Existing 3/2/1 grid, search/sort, create, and no-overflow behavior remains intact.

### Verification

- Run My Sets foundation and metadata-modal Playwright suites.
- Run router/auth unit/browser regression relevant to protected USER routes.

---

## TASK-006: Build the Set Detail hub and responsive vocabulary presentation

### Objective

Implement the dedicated owner Set Detail page foundation, authoritative states, learning hub layout, and ordered responsive membership view.

### Dependencies

- TASK-004.
- TASK-005.

### Files / modules

- `frontend/src/vocabulary-sets/my-vocabulary-set-detail-page.jsx` — page orchestration and presentation.
- Tailwind utilities in `frontend/src/vocabulary-sets/my-vocabulary-set-detail-page.jsx` — scoped Set Detail responsive/accessibility styling.
- `frontend/e2e/auth/my-vocabulary-set-detail.spec.js` — proposed focused browser spec created initially for page states/presentation.

### In scope

- Owner detail loading, safe operational error/retry, inaccessible/not-found, populated, and empty states.
- Compact back-and-name-only header and section-heading count placement.
- Flashcard/Quiz card presentation.
- Ordered desktop/mobile Vocabulary data.

### Out of scope

- Add/edit/remove mutations, implemented in later tasks.
- Luyện nói, audio controls, fake analytics, manual sorting/reorder.

### Implementation requirements

- Load `getMySet(setId)` and ignore stale completion after route change/unmount.
- Use one page-level `h1` with Set name in a compact header containing only back navigation and the name; do not show description, count, Topic, edit, or delete there.
- Render the count derived from complete `items.length` in **Từ vựng trong bộ (N)**.
- Distinguish retryable operational failure from safe missing/inaccessible state.
- Render only Flashcard and Quiz cards.
- Empty Set keeps both cards visible but non-interactive with **“Thêm từ vựng để bắt đầu”** and keeps vocabulary management area usable.
- Preserve response `position` order without UI sorting.
- Desktop columns: **Từ vựng**, **Phiên âm**, **Từ loại**, **Nghĩa**, **Ví dụ**, **Hành động**.
- Mobile fields: **Từ vựng**, **Nghĩa**, **Hành động** with semantic labels and no horizontal overflow.
- Null data gets a quiet unavailable presentation; never copy/fallback/generate data.
- No speaker/audio control.
- Use semantic table/list behavior, visible focus, reduced motion, safe long-text wrapping, and at least 44px appropriate controls.

### Acceptance criteria

- Populated and empty owner Sets render the approved hub.
- Items and display projection match API order/data exactly.
- Desktop/tablet/mobile content remains semantically understandable and horizontally contained.
- No Topic, CEFR-derived fake display, audio, Luyện nói, XP, streak, mastery, or fake progress appears.
- State transitions preserve App Shell behavior and do not leak another USER's data.

### Verification

- Run focused mocked Set Detail state/presentation tests at 1440×900, tablet, and 375×812.
- Verify no horizontal overflow and inspect semantic roles/headings/labels.

---

## TASK-007: Implement the centered Add Vocabulary modal

### Objective

Add the single-dialog search/select/create workflow owned by Set Detail, reusing existing picker and atomic private-create contracts.

### Dependencies

- TASK-006.

### Files / modules

- `frontend/src/vocabulary-sets/add-vocabulary-modal.jsx` — proposed centered modal and internal steps.
- `frontend/src/vocabulary-sets/my-vocabulary-set-detail-page.jsx` — open/close and authoritative refresh integration.
- `frontend/src/vocabulary-sets/private-vocabulary-editor.jsx` — embedded form content from TASK-004.
- `frontend/src/vocabulary-sets/private-vocabulary-action.js` — reuse stable operation/deduplication behavior.
- Tailwind utilities in the modal/editor components — 640–720px modal, mobile, focus, pending, and reduced-motion styling.
- `frontend/test/private-vocabulary-action.test.js` — stable retry/deduplication regression.
- `frontend/e2e/auth/my-vocabulary-set-detail.spec.js` — modal interaction coverage.

### In scope

- Search canonical/current-owner private results.
- Exact-ID eligibility and append.
- Same-spelling identity preservation.
- Inline **Tạo từ mới** step using atomic create-and-add.
- Accessible modal lifecycle and scoped states.

### Out of scope

- Drawer UI.
- Nested modal.
- Foreign private search/results.
- Standalone private Vocabulary create endpoint.
- Manual position selection or reorder.

### Implementation requirements

- Use one centered native modal, approximately 640–720px desktop and safe-margin near-full width mobile, with bounded height/internal scrolling.
- Initial focus enters the search workflow; close restores the trigger.
- Escape, backdrop, explicit close, and cancel work only when no unsafe pending operation exists.
- Body scroll handling and pending `aria-busy` behavior follow approved modal patterns.
- Search uses `GET /api/vocabulary-set-picker?query=...`; distinguish idle, validation, loading, results, empty, and safe error.
- Do not expose raw UUIDs; source labels distinguish canonical/private while identity logic uses ID.
- Disable or clearly mark exact IDs already in the Set. Do not disable a distinct same-spelling ID.
- Add existing Vocabulary with full ordered PATCH: current authoritative IDs followed by selected exact ID.
- **Tạo từ mới** switches the same modal to embedded private-create form content.
- Use stable `operation_id` and existing atomic endpoint; duplicate submission is guarded and retry retains the same safe operation identity where required.
- Success closes and reloads detail; failure preserves search/form state and provides retry/cancel.

### Acceptance criteria

- Existing canonical and owner-private exact IDs can be appended at the end.
- Duplicate exact membership cannot be added; distinct same-spelling identity can.
- Private create happens in the same dialog and appends atomically.
- At most one dialog is open throughout the workflow.
- Pending/error/focus/mobile behavior satisfies the approved contract.

### Verification

- Run private action unit tests and focused add-modal Playwright.
- Assert one named dialog, payload order/shape, stable retry, focus restoration, 375px no overflow, and no raw UUID display.

---

## TASK-008: Align Flashcard and Quiz focus shells and direct return behavior

### Objective

Connect non-empty Set Detail learning cards to the two real learning features and return them to their owner Set hub.

### Dependencies

- TASK-006.

### Files / modules

- `frontend/src/vocabulary-sets/my-vocabulary-set-detail-page.jsx` — activity links and route state.
- `frontend/src/learning/learning-foundation-page.jsx` — only if existing return behavior needs a minimal compatibility correction.
- `frontend/src/quiz/quiz-foundation-page.jsx` — focus-mode top bar and direct back behavior.
- `frontend/src/quiz/quiz-navigation.js` — resolve the current Set Detail return route safely.
- `frontend/test/quiz-navigation.test.js` — detail `returnTo` scenarios.
- Relevant Learning/Quiz browser specs — navigation regression.

### In scope

- Flashcard link `/learn/vocabulary-sets/:setId` with detail `returnTo`.
- Quiz link `/quiz/vocabulary-sets/:setId` with detail `returnTo` and Set name.
- Flashcard and Quiz focus-mode shells with direct back navigation to current Set Detail.

### Out of scope

- Learning/Quiz business logic, question order, scoring, progress, or UI redesign.
- Empty Set learning runs.
- Luyện nói placeholder.

### Implementation requirements

- Use existing React Router state contracts rather than new global/session navigation state.
- Preserve direct-route safe fallbacks when history state is absent.
- Empty Set cards remain non-links.
- Suppress the authenticated app header/sidebar for both learning routes while preserving their compact learning top bars.
- Ensure both Flashcard and Quiz back actions resolve directly to `/my/vocabulary-sets/:setId`, with safe direct-route fallback behavior.

### Acceptance criteria

- Non-empty Flashcard and Quiz entries use the exact current routes.
- Back actions return directly to `/my/vocabulary-sets/:setId`.
- Direct Learning/Quiz route fallbacks remain safe.
- No behavior changes to System/Public entry flows beyond shared regression compatibility.

### Verification

- Run Quiz navigation unit tests and focused Learning/Quiz browser tests.
- Verify Personal Set entry/return in guarded real-stack coverage later in TASK-012.

---

## TASK-009: Implement row-level private edit and membership removal

### Objective

Provide exact source-based Vocabulary actions while preserving Vocabulary identity, Learning Progress, and authoritative Set order.

### Dependencies

- TASK-007.
- TASK-008 may run independently, but must be integrated before TASK-010.

### Files / modules

- `frontend/src/vocabulary-sets/my-vocabulary-set-detail-page.jsx` — row actions, mutation state, refresh.
- `frontend/src/vocabulary-sets/private-vocabulary-editor.jsx` — single-dialog edit mode.
- `frontend/src/services/vocabulary-service.js` — reuse existing owner-private GET/PATCH; modify only if response validation requires an in-scope correction.
- Tailwind utilities in the Detail/editor components — scoped row action/confirmation styling.
- `frontend/e2e/auth/my-vocabulary-set-detail.spec.js` — mocked edit/remove behavior.
- `frontend/test/private-vocabulary-ui.test.js` and relevant service/form tests — legitimate private editor regression.

### In scope

- Canonical: **Gỡ khỏi bộ** only.
- Owned private: **Chỉnh sửa** and **Gỡ khỏi bộ**.
- Owner-private GET/PATCH edit and post-success detail reload.
- Membership-only removal through complete ordered PATCH.

### Out of scope

- Canonical editing.
- Deleting Vocabulary rows.
- Progress deletion/reset.
- Manual reorder or granular membership endpoint.

### Implementation requirements

- Determine actions from trusted `source`, not spelling.
- Load owned private aggregate via `GET /api/my/vocabulary/:vocabularyId` and update it via PATCH.
- Preserve the shared-identity warning and exact Vocabulary ID/order after edit.
- Remove by submitting every remaining current authoritative `vocabulary_id` in relative order.
- Use safe confirmation/inline feedback as appropriate; pending blocks duplicate removal and unsafe dismissal.
- Failed edit/removal keeps actionable context and safe retry/cancel.
- Successful edit/removal reloads owner detail.
- Never call Vocabulary delete and never alter Learning Progress.

### Acceptance criteria

- Canonical rows never expose edit.
- Owned private edit updates authoritative displayed fields without changing membership identity/order.
- Removal removes only selected membership, preserves remaining relative order, Vocabulary record, and Progress.
- Same-spelling rows remain independently targetable by ID.
- No reorder control is rendered.

### Verification

- Run focused mocked row-action tests and relevant private Vocabulary unit tests.
- Prove database preservation in TASK-012 guarded real-stack.

---

## TASK-010: Preserve My Sets management and finalize Detail states/accessibility

### Objective

Keep Set metadata/delete management on My Sets and complete the Set Detail state/accessibility behavior.

### Dependencies

- TASK-008.
- TASK-009.

### Files / modules

- `frontend/src/vocabulary-sets/my-vocabulary-set-detail-page.jsx` — compact header and state/accessibility integration.
- `frontend/src/vocabulary-sets/my-vocabulary-sets-page.jsx` — metadata edit/delete management and action-menu integration.
- `frontend/src/vocabulary-sets/personal-vocabulary-set-modal.jsx` — reuse unchanged metadata behavior.
- `frontend/src/index.css` — state, focus, touch, motion, and responsive polish only where not represented by Tailwind.
- `frontend/e2e/auth/my-vocabulary-set-detail.spec.js` — action/state/accessibility coverage.
- `frontend/e2e/auth/my-vocabulary-set-modal.spec.js` — metadata-only regression.

### In scope

- Compact Detail header with back navigation and Set name only.
- My Sets secondary menu actions **Chỉnh sửa** and **Xóa bộ từ**.
- Safe native confirmation/error lifecycle in My Sets and membership workflows.
- Complete page/mutation states and accessibility pass.

### Out of scope

- Metadata modal redesign or new fields.
- Set Detail layout expansion beyond approved hub.
- Broad App Shell refactor.

### Implementation requirements

- Detail header renders no description, count, metadata edit, or Set delete; count belongs in **Từ vựng trong bộ (N)**.
- My Sets metadata edit sends only `name` and `description`; omit `topic_id` and `items`.
- Success closes modal and reloads detail; failure preserves entered values.
- Delete uses accessible named native modal/top-layer lifecycle, safe confirmation, pending dismissal protection, error inside active dialog, retry/cancel, and navigation to My Sets on success.
- Keep card-menu edit/delete visually secondary to **Xem**; do not duplicate them on Set Detail.
- Ensure initial page loading, safe error/retry, inaccessible/not-found, empty, and scoped mutation errors are semantically distinct.
- Ensure keyboard order, visible focus, focus restoration, 44px targets, reduced motion, semantic table/list, and no horizontal overflow.
- Remove stale inline-detail CSS/dead paths only when proven unused.

### Acceptance criteria

- Metadata and deletion behavior remains available from My Sets and matches existing approved contracts.
- Delete failures remain safely actionable within confirmation without raw details.
- All active dialogs protect pending operations and restore focus.
- Detail remains usable for adding/managing Vocabulary when empty.
- Responsive and accessibility checks pass across desktop/tablet/mobile.

### Verification

- Run focused Set Detail and Personal Set modal Playwright.
- Perform keyboard, semantic role, focus, touch-size, reduced-motion, and overflow assertions where supported.

---

## TASK-011: Complete focused mocked browser and frontend unit coverage

### Objective

Create meaningful, contract-level frontend coverage for the full approved Set Detail behavior without overmocking away request/payload/navigation rules.

### Dependencies

- TASK-010.

### Files / modules

- `frontend/e2e/auth/my-vocabulary-set-detail.spec.js` — complete focused mocked suite.
- `frontend/e2e/auth/my-vocabulary-sets-foundation.spec.js` — one-CTA/list regression.
- `frontend/e2e/auth/my-vocabulary-set-modal.spec.js` — metadata-only regression after extraction.
- Relevant Learning/Quiz auth specs — entry/back regression.
- `frontend/test/vocabulary-set-service.test.js`
- `frontend/test/private-vocabulary-action.test.js`
- `frontend/test/private-vocabulary-ui.test.js`
- `frontend/test/quiz-navigation.test.js`
- Additional small pure unit test file only if state/payload logic was extracted.

### In scope

- All approved USER UI/service behavior and request shapes.
- Desktop/tablet/mobile behavior.
- Accessibility and safe failure states.

### Out of scope

- Static source-pattern assertions for behavior better covered through runtime tests.
- Tests coupled to incidental class names or component internals without contract value.
- Deleting tests merely to obtain green CI.

### Implementation requirements

- Assert USER detail uses the owner API, not Learning API.
- Assert no fake fields or fallback display data.
- Assert exact PATCH payloads for append/remove and metadata omission.
- Cover same-spelling distinct IDs and duplicate exact ID behavior.
- Cover one dialog during inline private create, focus lifecycle, pending guard, preserved error values, retry/cancel, and authoritative reload.
- Cover empty learning disabled state and usable Add action.
- Cover action rules by source, no audio, no reorder, and no Luyện nói.
- Cover 1440×900, representative tablet, and 375×812 without overflow.

### Acceptance criteria

- Focused suite meaningfully maps to SPEC acceptance criteria AC-01 through AC-19.
- Existing My Sets/modal/ADMIN boundaries are not weakened.
- Tests fail for actual contract regressions rather than incidental implementation structure.
- Frontend unit and focused browser suites pass.

### Verification

- Run all affected frontend unit tests.
- Run focused Set Detail, My Sets, modal, Learning, and Quiz browser specs.

---

## TASK-012: Add guarded real-stack coverage and run affected regressions

### Objective

Prove authoritative API/database behavior across the real USER workflow and preserve ADMIN/public/Learning/Quiz boundaries using only the dedicated TEST DB.

### Dependencies

- TASK-011.

### Files / modules

- `frontend/e2e/integration/personal-vocabulary-real-stack.spec.js` — extend existing identity/privacy/create/Learning/Quiz scenarios, or
- `frontend/e2e/integration/vocabulary-set-detail-real-stack.spec.js` — create if separation produces clearer fixtures without duplicating contracts.
- `frontend/e2e/integration/vocabulary-set-user-real-stack.spec.js` — metadata/order regression as appropriate.
- `frontend/e2e/integration/vocabulary-set-admin-real-stack.spec.js` — ADMIN Topic/picker/reorder regression.
- `frontend/e2e/integration/vocabulary-set-public-real-stack.spec.js` — public response/navigation boundary.
- Existing Learning/Quiz real-stack specs — focus-shell/direct-return and topic-independent behavior.

### In scope

- Owner/private real API and DB behavior.
- Exact identity, privacy, append/create/edit/remove, order, idempotency, and Progress preservation.
- Learning/Quiz navigation and empty guards.
- ADMIN/public regression boundaries.

### Out of scope

- Main/Preview/Production DB.
- Temporary UI restoration of retired Create/Edit membership controls.
- Set Detail implementation for ADMIN/public.

### Implementation requirements

- Use the repository guard and dedicated TEST database only.
- Prove owner loads detail and a foreign USER cannot.
- Prove canonical/current-owner picker visibility and foreign-private exclusion.
- Prove exact ID append order, duplicate exact rejection, and same-spelling distinct identity.
- Prove private **Tạo từ mới** is atomic/idempotent and appends last.
- Prove private edit retains exact membership ID reference/order and refreshes projection.
- Prove **Gỡ khỏi bộ** removes membership only while Vocabulary and Learning Progress remain.
- Prove metadata edit preserves exact membership/order.
- Prove Flashcard/Quiz focus-shell entry and direct Set Detail return behavior.
- Prove empty Set remains manageable but starts no invalid run.
- Preserve existing System-copy, privacy, Learning, Quiz, and ADMIN Topic/vocabulary-management assertions.

### Acceptance criteria

- Guarded USER flow passes against real backend/DB.
- Identity/privacy/idempotency/order/Progress contracts are not replaced by mocks.
- ADMIN Topic selector and picker/add/remove/reorder behavior remains intact.
- Public detail does not expose private projection.
- Fixtures clean up deterministically.

### Verification

- Run the focused USER Set Detail real-stack suite first.
- Run affected Personal Vocabulary, USER/ADMIN/public Set, Learning, and Quiz real-stack suites.
- Run the repository-required full real-stack integration suite on TEST DB.

---

## TASK-013: Synchronize active API and UI documentation

### Objective

Update active canonical documentation and reconcile the formal Set Detail artifacts with the final HUMAN-approved behavior while preserving closure gating.

### Dependencies

- TASK-012 implementation and affected regression evidence available.

### Files / modules

- `docs/API_SPEC.md` — private detail projection and unchanged write contracts.
- `docs/UI_UX_SPEC.md` — dedicated learning hub, modal, membership actions, states, responsive/accessibility contract.
- `docs/FEATURE_STATUS.md` — closure-only; do not update to DONE in this task before formal approval.
- Approved `docs/specs/SET_DETAIL_V1_SPEC.md`, `docs/plans/SET_DETAIL_V1_PLAN.md`, and this TASK — reconciled records of the final HUMAN-approved implementation and remaining closure work.

### In scope

- API and UI/UX synchronization for implemented approved behavior.
- Explicit null/order/concurrency and deferred-scope documentation.

### Out of scope

- Marking feature DONE before TEST/REVIEW/human approval.
- Unrelated PROJECT_OVERVIEW/ARCHITECTURE/DATABASE rewrites.
- Rewriting unrelated historical completed specs.

### Implementation requirements

- Document USER-only `primary_meaning`, first `created_at/id` meaning/example rule, null behavior, and unchanged public/ADMIN responses.
- Document centered add modal, single-dialog create step, exact-ID actions, six/three-column presentation, empty disabled activities, compact Detail header, section-heading count, My Sets management actions, and focus-shell return behavior.
- Preserve Personal Set Create/Edit as metadata-only and ADMIN editor behavior unchanged.
- Keep last-write-wins limitation and deferred work explicit.
- Leave `FEATURE_STATUS.md` unchanged until authorized closure; at closure add/update the precise Set Detail V1 entry only, without marking broader unfinished work DONE.

### Acceptance criteria

- Active API/UI docs contain no contradiction with implementation or approved artifacts.
- No broader feature is marked complete.
- SPEC/PLAN/TASK remain available as approved records and accurately describe the final implementation contract.

### Verification

- Search active docs for retired contradictory USER editor/detail rules.
- Compare documented routes/payloads/fields against tests and implementation.

---

## TASK-014: Complete implementation verification and hand off to formal TEST

### Objective

Verify implementation readiness, repository integrity, and scope before the separate formal TEST stage.

### Dependencies

- TASK-013.

### Files / modules

- No planned production changes; resolve only defects directly within approved tasks through the IMPLEMENT loop.
- Repository scripts/configuration define authoritative commands.

### In scope

- Focused and affected implementation verification.
- Lint, build, diff, artifact, migration, branch, and stash checks.
- Evidence handoff to TEST.

### Out of scope

- Formal TEST-stage approval or REVIEW verdict.
- Commit/push unless separately authorized.
- Applying/popping/dropping `stash@{0}`.

### Implementation requirements

- Use dedicated TEST DB for every database-backed test.
- Run focused backend Vocabulary Set/Personal Vocabulary tests.
- Run affected frontend unit tests and focused browser suites.
- Run guarded USER/ADMIN/public/Learning/Quiz real-stack and required full integration regression.
- Run browser smoke, lint, build, and `git diff --check`.
- Confirm no Prisma schema/migration, backend route/controller, package, or lockfile changes unless a previously approved task explicitly required them; none are expected.
- Confirm no generated test-results, Playwright reports, screenshots, traces, videos, or temporary specs are tracked.
- Confirm `stash@{0}` remains untouched and no Set Detail deferred scope was introduced.
- If a real defect or approved-contract conflict is found, return to IMPLEMENT or SPEC/PLAN as appropriate rather than hiding it.

### Acceptance criteria

- All required implementation verification passes or is reported accurately as failed/not run.
- Worktree contains only intended approved files and no generated artifacts.
- No migration exists for this feature.
- Evidence is sufficient to begin the separate TEST stage.
- No commit or push occurs without explicit authorization.

### Verification

- Record exact commands, pass counts, failures/TODOs, TEST DB guard evidence, lint/build/diff results, final status, and stash status in the IMPLEMENT handoff report.

### Completion evidence

- The guarded migration/database check passed against the dedicated ELVocab TEST PostgreSQL target; no Main, Preview, or Production database was used.
- The previously blocked `private-vocabulary-create-add.test.js` verification passed.
- The required real-stack suites passed sequentially with the TEST DB guard active: Authentication, USER Vocabulary Set, Personal Vocabulary, Learning, Quiz, Learning Progress, and Dashboard.
- Three stale real-stack assumptions were updated to the approved accessible UI: the My Sets navigation/action locator, the `Tìm kiếm` button name, and the current USER sidebar/profile/session structure.
- The remaining USER Set metadata workflow assertion now edits through the My Sets management menu rather than matching vocabulary-row controls in Set Detail; both serial scenarios execute.
- Focused backend, frontend unit, browser, ESLint, production build, and `git diff --check` verification completed; subsequent USER header logo and responsive-alignment checks also passed.
- HUMAN UI review items were completed, including Set Detail polish, Flashcard/Quiz focus-mode behavior, responsive App Shell/header branding, and the relevant CSS-to-Tailwind migrations.
- No product regression remained at closure handoff, and assertions were not weakened.

---

## Stage gates

### Gate A — TASK approval

- Human approves this TASK document before implementation.

### Gate B — IMPLEMENT completion

- TASK-001 through TASK-014 are implemented and verified.
- Focused and cumulative in-scope verification passed.
- Set Detail V1 alone is marked DONE; no commit/push occurs without separate authorization.

### Gate C — Formal TEST

- Read and follow `.agents/skills/test/SKILL.md`.
- Approved matrix completed using the dedicated TEST DB only.
- A real defect returns to IMPLEMENT before proceeding.

### Gate D — REVIEW

- Read and follow `.agents/skills/review/SKILL.md`.
- Cumulative diff reviewed against SPEC/PLAN/TASK, contract boundaries, test integrity, docs, and repository integrity.
- Findings return through IMPLEMENT→TEST→REVIEW.

### Gate E — Human approval and closure

- REVIEW is complete and the precise Set Detail V1 checkpoint is recorded as DONE; HUMAN commit approval remains pending.
- Commit/push/integration require separate explicit authorization.

## Explicit non-goals for every task

- No Topic control or `topic_id` in Personal Set UI/writes.
- No membership picker/add/remove/reorder inside Personal Set Create/Edit.
- No manual reorder, drag/drop, granular membership endpoints, version field, or optimistic concurrency.
- No Vocabulary deletion when removing membership and no Learning Progress deletion/reset.
- No canonical or foreign-private Vocabulary editing.
- No System/Public Set Detail or ADMIN editor redesign.
- No Luyện nói/Pronunciation card, audio/speaker list control, XP, streak, mastery, analytics, SRS UI, fake progress, or new learning mode.
- No Learning/Quiz scoring, question, ordering, or progress behavior changes.
- No pagination/virtualization in V1.
- No database table/field/constraint/index/migration, package, lockfile, external service, role, or architecture change.
- No Dashboard redesign or unrelated App Shell refactor.
- No application/pop/drop of `stash@{0}`.

## Task quality checklist

- Every approved PLAN area maps to at least one task.
- Existing completed foundations are reused rather than rebuilt.
- Backend private projection cannot leak into public/ADMIN contracts.
- Frontend never uses Learning API as a Set Detail data shortcut.
- Exact UUID identity and same-spelling behavior remain explicit.
- Empty Set management, responsive/accessibility, and safe states are covered.
- Test work spans backend, unit/service, mocked browser, guarded real-stack, regression, lint/build/diff, and artifacts.
- Dedicated TEST DB requirement is explicit everywhere applicable.
- Documentation and closure status obey stage gates.
- No unresolved blocker remains.
