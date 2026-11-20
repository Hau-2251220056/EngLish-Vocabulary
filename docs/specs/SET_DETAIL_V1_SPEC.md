# SPEC: ELVocab Set Detail V1

## 1. Objective

Set Detail V1 turns an owned Personal Vocabulary Set into a focused learning hub. From **Bộ từ của tôi**, a USER enters one owner-scoped detail page to see authoritative Set metadata and ordered vocabulary membership, start the real Flashcard or Quiz features, and manage membership without returning vocabulary controls to the Create/Edit metadata modal.

This revision extends the completed Vocabulary Set foundation. It does not redefine System Set discovery, ADMIN Set management, Learning, Quiz, or the Personal Set Topic contract.

## 2. Actors and authorization

- **USER**: may open and manage only a Personal Vocabulary Set they own.
- **ADMIN**: is not given access to this USER route by this feature. Existing ADMIN/System Set screens and contracts remain unchanged.
- **Unauthenticated visitor**: follows the existing authentication redirect behavior and cannot read or mutate Personal Set data.
- A missing Set and a Set inaccessible to the current USER must retain the existing safe not-found/authorization behavior; the UI must not disclose another USER's private Set.
- All ownership and identity rules remain enforced by the backend. Frontend route checks are UX, not an authorization boundary.

## 3. Scope

### 3.1 In scope

- Change each **Bộ từ của tôi** card to one primary CTA, **Xem**, which navigates to `/my/vocabulary-sets/:setId`; keep metadata edit and Set delete in the card's secondary management menu.
- Replace the current inline Personal Set detail presentation at that route with a dedicated learning-hub page.
- Show the authoritative Set name in a compact Detail header containing only back navigation and the Set name; show the derived membership count in **Từ vựng trong bộ (N)**.
- Show only the two implemented learning activities: Flashcard and Quiz.
- Show the Set's vocabulary in authoritative membership order.
- Extend the owner-scoped Personal Set detail read contract with a deterministic, read-only `primary_meaning` projection for each item.
- Add existing canonical or owned-private Vocabulary to the Set by exact `vocabulary_id` through the existing picker and ordered replacement contract.
- Create a private Vocabulary atomically inside this Set through the existing Set-scoped endpoint.
- Remove a membership without deleting its Vocabulary or Learning Progress.
- Allow editing an owned private Vocabulary through the existing Personal Vocabulary contract.
- Preserve existing metadata edit and Set delete behavior in **Bộ từ của tôi** management, not in the Set Detail header.
- Cover loading, error, retry, not-found/inaccessible, empty, mutation-pending, and mutation-error states.
- Responsive and accessible behavior for desktop, tablet, and mobile.

### 3.2 Out of scope

- Topic controls or `topic_id` in Personal Set UI or USER writes.
- Vocabulary membership controls inside Personal Set Create/Edit.
- Manual reorder, drag-and-drop, or new reorder endpoints.
- Granular add/remove membership endpoints, optimistic locking, or version fields.
- Deleting a Vocabulary when removing it from a Set.
- Editing canonical Vocabulary or private Vocabulary owned by another USER.
- System/Public Set detail redesign or ADMIN editor redesign.
- Pronunciation/Luyện nói cards, audio/speaker controls, XP, streak, mastery, analytics, spaced-repetition UI, or unimplemented learning modes.
- Changes to Flashcard or Quiz business logic, scoring, progress, question order, or contracts.
- New database tables, fields, relations, migrations, roles, dependencies, or external services.
- Pagination or virtualization of the membership list in V1.

## 4. Navigation and user flow

### 4.1 My Sets entry

1. A USER opens `/my/vocabulary-sets`.
2. Every populated or empty Personal Set card exposes one primary CTA: **Xem**.
3. **Xem** navigates to `/my/vocabulary-sets/:setId`.
4. **Chỉnh sửa** and **Xóa bộ từ** remain in the card's secondary management menu; the retired card-level **Chi tiết** and direct-learning CTAs are not rendered.

An empty Set remains navigable because Set Detail is where the USER can add its first Vocabulary. It must not start an invalid learning run.

### 4.2 Detail hub

1. The page loads the owner-scoped Set detail.
2. The compact header contains only back navigation to **Bộ từ của tôi** and the authoritative Set name. It does not show description, count, Topic, edit, or delete controls.
3. The membership count appears in the section heading **Từ vựng trong bộ (N)** and is derived from the complete returned `items` array.
4. For a non-empty Set, the USER may start:
   - **Flashcard** at `/learn/vocabulary-sets/:setId`.
   - **Quiz** at `/quiz/vocabulary-sets/:setId`, which is the existing Quiz selection page.
5. Flashcard and Quiz both use a dedicated focus-mode learning shell without the authenticated app header/sidebar, and their back navigation resolves directly to `/my/vocabulary-sets/:setId`.
6. The USER reviews the ordered Vocabulary list and may add, create, edit, or remove entries according to ownership rules.

For an empty Set, both real activity cards remain visible as non-interactive unavailable states with the clear guidance **“Thêm từ vựng để bắt đầu”**. They do not expose navigable learning links until the Set is non-empty. Set Detail otherwise remains fully usable, including its vocabulary-management workflow.

### 4.3 Add existing Vocabulary

1. **+ Thêm từ vựng** opens a Detail-owned accessible centered modal, not a drawer. Its desktop target width is approximately 640–720px; on smaller viewports it fits the available width without horizontal overflow.
2. The USER searches through `GET /api/vocabulary-set-picker?query=...`.
3. Results preserve exact identity and distinguish canonical Vocabulary from private Vocabulary owned by the current USER.
4. Foreign private Vocabulary is never returned or accepted.
5. Selecting an eligible result appends that exact `vocabulary_id` after the current final item through the existing full ordered-items PATCH contract.
6. An exact Vocabulary identity already in the Set cannot be added twice. A different Vocabulary with the same spelling remains a distinct eligible identity.

The modal searches canonical and owner-private Vocabulary by exact identity and includes a **Tạo từ mới** entry. Private Vocabulary creation is a step within the same modal workflow; it must not open a second modal over the first. The workflow must remain owned by Set Detail, be keyboard accessible, and must not reintroduce membership controls into Create/Edit.

### 4.4 Create private Vocabulary in the Set

1. From the Detail-owned add workflow, the USER may choose to create a private Vocabulary.
2. The existing editor collects the supported private Vocabulary aggregate.
3. Submission uses `POST /api/my/vocabulary-sets/:setId/vocabulary`.
4. Success creates a fresh USER-owned private Vocabulary and atomically appends it to the Set.
5. Duplicate spelling is allowed because identity is UUID-based.
6. Existing idempotency behavior is preserved.

No standalone private-Vocabulary creation endpoint is introduced.

### 4.5 Edit and remove

- A canonical Vocabulary exposes **Gỡ khỏi bộ** only; its edit control remains unavailable with an accessible explanation.
- A private Vocabulary owned by the current USER exposes **Chỉnh sửa** and **Gỡ khỏi bộ**.
- Editing loads and updates the authoritative aggregate through `GET/PATCH /api/my/vocabulary/:vocabularyId`; the Set stores the same exact identity rather than a copy.
- Removing rewrites the remaining ordered item list through the existing metadata/items PATCH endpoint. It deletes only the Set membership.
- After a successful add, create, edit, or remove, the detail view refreshes its authoritative projection and count.

## 5. Business rules

- **BR-01**: `/my/vocabulary-sets/:setId` is authenticated, USER-only, and owner-scoped.
- **BR-02**: Personal Set Detail displays no Topic control or Topic-derived label.
- **BR-03**: The My Sets card has exactly one primary CTA, **Xem**, and it enters Set Detail for both empty and non-empty Sets; Set metadata edit/delete remain in its secondary management menu.
- **BR-04**: Only real Flashcard and Quiz activities are presented. An empty Set cannot start either activity.
- **BR-05**: Set metadata edit remains metadata-only and must omit `topic_id` and `items`, preserving exact membership/order through backend omission semantics.
- **BR-06**: Membership identity is always `vocabulary_id`; word spelling is never used as identity.
- **BR-07**: The same exact Vocabulary identity cannot occur twice in one Set, while distinct IDs with the same spelling are valid.
- **BR-08**: Membership display order is ascending authoritative `position`. UI sorting must not replace that order.
- **BR-09**: New membership is appended after the last current item. The submitted ordered list preserves existing relative order and places the new exact ID last; backend normalization remains authoritative.
- **BR-10**: Removal preserves the relative order of all remaining items and does not delete Vocabulary, meanings, examples, or Learning Progress.
- **BR-11**: Only USER-owned private Vocabulary may be edited from this page. Canonical and foreign private Vocabulary are not editable.
- **BR-12**: Creating a private Vocabulary is atomic with membership insertion and preserves existing idempotency semantics.
- **BR-13**: The full-list PATCH behavior has its existing last-write-wins concurrency limitation. V1 adds no optimistic concurrency contract; after each mutation the client reloads authoritative state rather than assuming a local list is final.
- **BR-14**: The list has no audio or speaker control.
- **BR-15**: Personal Set Create/Edit remains the existing centered, metadata-only modal.
- **BR-16**: ADMIN/System Set Topic and vocabulary-management behavior is unchanged.
- **BR-17**: Set Detail has no Set metadata edit/delete controls; those actions remain in My Sets management.
- **BR-18**: Flashcard and Quiz are focus-mode routes and return directly to the current Personal Set Detail route.

## 6. Read contract and deterministic projection

### 6.1 Existing response extension

`GET /api/my/vocabulary-sets/:setId` remains the owner-scoped source for Set Detail. Its existing Set and item fields remain compatible. Each returned item gains:

```json
{
  "primary_meaning": {
    "part_of_speech": "noun",
    "meaning_vi": "...",
    "example": {
      "example_en": "...",
      "example_vi": "..."
    }
  }
}
```

The exact shape is:

```text
primary_meaning: {
  part_of_speech: string,
  meaning_vi: string,
  example: {
    example_en: string,
    example_vi: string | null
  } | null
} | null
```

This projection is display-only. It introduces no new persisted field and requires no database migration.

### 6.2 Selection rules

1. Candidate meanings use the existing authoritative deterministic order: `created_at ASC`, then `id ASC`.
2. `primary_meaning` is the first meaning in that order. CEFR does not re-rank the Set Detail display projection.
3. If the Vocabulary has no meanings, `primary_meaning` is `null`.
4. Examples of the selected meaning use the existing authoritative deterministic order: `created_at ASC`, then `id ASC`.
5. The displayed example is the first example in that order.
6. If the selected meaning has no examples, `example` is `null`.
7. Nullable fields remain null; Set Detail does not invent, generate, or fall back to data from another meaning or example.

Set Detail derives this projection directly from the owner detail query and remains independent of the Learning API. This display rule does not change the independent Learning or Quiz meaning-selection contracts.

### 6.3 Set and item fields

- Set metadata continues to include authoritative `id`, `name`, nullable `description`, and the existing ownership/private metadata allowed by the contract.
- The UI derives the displayed item count from the complete returned `items` array; V1 does not require a duplicate `item_count` field on detail.
- Items retain authoritative membership `id`, `vocabulary_id`, `position`, `created_at`, `word`, nullable `phonetic`, and `source`, plus `primary_meaning`.
- `source` continues to drive allowed vocabulary-level actions; the client must not infer ownership from spelling.
- The endpoint does not expose Topic as editable metadata and does not add Learning Progress, XP, mastery, or analytics.

## 7. Write contracts

### 7.1 Set metadata

- Existing USER `PATCH /api/my/vocabulary-sets/:setId` metadata-only behavior is reused.
- Requests from the Set metadata modal contain only `name` and `description`.
- `topic_id` and `items` are omitted so membership and legacy Topic references remain untouched.

### 7.2 Add and remove membership

- Existing USER `PATCH /api/my/vocabulary-sets/:setId` full ordered `items` replacement is reused.
- Add submits every current exact `vocabulary_id` in authoritative order followed by the selected ID.
- Remove submits every remaining exact `vocabulary_id` in preserved relative order.
- Recreated membership row IDs are accepted as current contract behavior; consumers must rely on `vocabulary_id` for Vocabulary identity.
- No granular membership endpoint is added in V1.

### 7.3 Picker, private create, and private edit

- Search: `GET /api/vocabulary-set-picker?query=...`.
- Atomic private create-and-append: `POST /api/my/vocabulary-sets/:setId/vocabulary`.
- Owned private detail/edit: `GET /api/my/vocabulary/:vocabularyId` and `PATCH /api/my/vocabulary/:vocabularyId`.
- Existing validation, privacy, ownership, safe error, idempotency, and aggregate replacement rules remain authoritative.

## 8. UI and content requirements

### 8.1 Page composition

The page uses the approved authenticated USER App Shell and warm educational visual language:

1. Compact Set header containing only back navigation to **Bộ từ của tôi** and the Set name.
2. No description, count, edit, or delete controls in the Detail header.
3. A compact learning section with Flashcard and Quiz cards only.
4. Vocabulary section headed **Từ vựng trong bộ (N)** with **+ Thêm từ vựng** and the ordered membership list.

Below `lg`, the authenticated USER header uses a true left/right flex structure. Mobile below `sm` shows the logo mark only; tablet from `sm` to below `lg` shows the mark and **ELVocab** wordmark. At `lg+`, the existing three-column desktop header with truly centered navigation remains in use. Flashcard and Quiz suppress that app shell entirely through their focus-mode routes.

It must not use an admin/SaaS eyebrow, fake analytics, heavy glassmorphism, or decorative data unsupported by the API.

### 8.2 Vocabulary columns

Desktop/tablet where space permits:

- **Từ vựng**
- **Phiên âm**
- **Từ loại**
- **Nghĩa**
- **Ví dụ**
- **Hành động**

Mobile:

- **Từ vựng**
- **Nghĩa**
- **Hành động**

Mobile reduction hides secondary display fields rather than fabricating alternate data. The layout must not horizontally overflow at the supported mobile viewport. Long content wraps safely, and action labels remain understandable.

### 8.3 Empty and error states

- **Initial loading**: a page-level loading state distinct from empty content.
- **Load failure**: safe message and retry action.
- **Missing/inaccessible**: safe state with navigation back to My Sets and no private-data disclosure.
- **Empty Set**: retains metadata, unavailable learning cards, and a clear first-use action to add Vocabulary.
- **Picker loading/no result/error**: distinct states; no-result may offer the explicit private-create path.
- **Mutation pending**: affected controls prevent duplicate submission and unsafe dismissal where an editor/confirmation is active.
- **Mutation failure**: safe, actionable feedback appears in the active workflow and preserves entered values or selection for retry.
- **Mutation success**: closes the relevant transient workflow when appropriate and reloads authoritative detail state.

## 9. Accessibility requirements

- One descriptive page-level `h1` containing the Set name.
- Learning activities are semantic links only when available; unavailable empty-Set cards are not misleading links.
- Vocabulary data uses an appropriate semantic table/list pattern with programmatic labels at each responsive presentation.
- Add, row edit/remove, My Sets metadata edit/delete, close, cancel, restart, and retry controls are native links/buttons with visible focus.
- Interactive targets are at least 44px where appropriate for touch.
- Dialogs/overlays have accessible names, focus entry, Escape/cancel behavior, focus restoration, scroll handling, and pending-state dismissal protection consistent with existing approved patterns.
- Status and error feedback uses appropriate live/status or alert semantics without raw backend detail.
- Reduced-motion preferences are honored.
- Color is not the sole carrier of meaning.

## 10. Compatibility and impact

### 10.1 Backend/API

- One backward-compatible response extension to the existing owner detail endpoint.
- Existing USER write endpoints and authorization rules are reused unchanged.
- No database migration or schema change.
- Existing clients that ignore `primary_meaning` continue to work.

### 10.2 Frontend

- My Sets card routing changes from direct Flashcard/detail dual actions to one **Xem** Detail entry, with metadata edit/delete retained in its secondary management menu.
- Existing Personal Set metadata modal is reused unchanged.
- Existing private Vocabulary editor and picker contracts may be reused inside the new Detail-owned workflow.
- Flashcard and Quiz use the dedicated focus-mode shell and return directly to the current Personal Set Detail without changing their learning/quiz business behavior.
- ADMIN pages remain isolated from this USER feature.

### 10.3 Documentation

After implementation is approved, active `API_SPEC.md`, `UI_UX_SPEC.md`, and `FEATURE_STATUS.md` must be synchronized with the verified behavior. This feature SPEC remains the approved change record; it does not itself mark the feature DONE.

## 11. Acceptance criteria

- **AC-01**: An authenticated USER sees exactly one primary **Xem** CTA on each My Sets card, and it opens `/my/vocabulary-sets/:setId`, including for an empty Set; edit/delete remain in the card management menu.
- **AC-02**: The owner detail page renders a compact back-and-name-only header and **Từ vựng trong bộ (N)** with the count derived from ordered items, without description, Topic, Set actions, or fake metrics in the header.
- **AC-03**: A USER cannot read or mutate another USER's Personal Set, and safe inaccessible behavior leaks no private data.
- **AC-04**: A non-empty Set exposes valid Flashcard and Quiz navigation; an empty Set starts neither.
- **AC-05**: Flashcard uses `/learn/vocabulary-sets/:setId`, Quiz uses `/quiz/vocabulary-sets/:setId`, both use a focus-mode shell, and both back actions resolve directly to the current detail hub.
- **AC-06**: The detail API returns items in authoritative position order with the exact nullable `primary_meaning` shape.
- **AC-07**: Primary meaning and example selection uses the first record in authoritative `created_at` then `id` order, including deterministic multiple-meaning/example and no-meaning/no-example cases, without CEFR re-ranking or fallback data.
- **AC-08**: Desktop shows the six approved vocabulary columns; mobile shows the three approved columns with no horizontal overflow and no audio control.
- **AC-09**: Picker search returns only canonical and current-USER private identities; foreign private identities remain inaccessible.
- **AC-10**: Adding an existing result appends its exact ID, preserves prior relative order, rejects duplicate exact membership, and allows a same-spelling distinct ID.
- **AC-11**: Set-scoped private creation permits duplicate spelling, creates a new USER-owned identity, appends atomically, and preserves idempotency.
- **AC-12**: An owned private Vocabulary can be loaded and edited; canonical and foreign private Vocabulary cannot be edited.
- **AC-13**: Removing a membership preserves remaining order and does not delete Vocabulary or Progress.
- **AC-14**: Metadata edit still sends only name and description and preserves exact membership/order.
- **AC-15**: Loading, load error/retry, inaccessible, empty, picker-empty, mutation-pending, mutation-error, and success-refresh states are visibly and semantically distinct.
- **AC-16**: Keyboard users can reach and operate all available actions; dialogs and menus have accessible naming, focus entry/containment, Escape/backdrop/cancel behavior, trigger focus restoration, and pending/duplicate-submit protection.
- **AC-17**: Existing ADMIN/System Set Topic and vocabulary-management behavior remains unchanged.
- **AC-18**: Existing Personal Vocabulary exact-ID, privacy, Learning, Quiz, copy, idempotency, and Progress regressions continue to pass.
- **AC-19**: No Set Detail code introduces manual reorder, granular membership endpoints, database changes, fake learning modes, or vocabulary controls in Create/Edit.

## 12. Required test coverage

- Owner detail success, empty, not-found/inaccessible, load error, and retry.
- Detail read projection: first deterministic meaning and example, multiple-record ordering, and null cases; prove that CEFR does not re-rank the Set Detail projection.
- My Sets single-**Xem** routing plus secondary management-menu behavior for populated and empty Sets.
- Flashcard and Quiz focus shells, direct Set Detail back behavior, and empty-Set guards.
- Desktop/mobile column behavior, 3-to-reduced-field presentation as applicable, touch targets, focus behavior, reduced motion, and horizontal-overflow guard.
- Picker privacy and exact-ID behavior, including duplicate spelling and duplicate exact membership.
- Existing-ID append, private create-and-append idempotency, owned-private edit, canonical non-editability, removal, and preserved order.
- Guarded real-stack proof that metadata edit preserves exact membership/order and membership removal preserves Vocabulary/Progress.
- USER ownership/authorization regression and ADMIN/System Set regression.
- Existing My Sets, Personal Vocabulary, Flashcard/Learning, Quiz, lint, build, and diff checks required by the approved implementation task.

## 13. Risks and constraints

- Full ordered-list replacement can overwrite a concurrent membership edit. V1 accepts this existing limitation and mitigates stale UI by reloading authoritative detail after mutation.
- Membership row IDs may be recreated by replacement. Tests and UI must not treat them as durable Vocabulary identity.
- Editing one owned private Vocabulary updates the same identity wherever the USER uses it; the editor must retain the existing shared-identity warning/semantics.
- The unpaginated detail payload grows with Set size. Pagination is deferred unless real data demonstrates a V1 performance problem.
- Meaning projection must preserve the approved Set Detail ordering rule without accidentally importing the separate CEFR-aware Learning/Quiz selection policy.
- Responsive table reduction must preserve semantic labels and action reachability without horizontal overflow.

## 14. Deferred work

- Manual membership reorder and drag-and-drop.
- Granular membership mutation endpoints and optimistic concurrency/versioning.
- Pagination/virtualization.
- Pronunciation/Luyện nói and audio controls.
- Progress, mastery, XP, streak, analytics, or spaced-repetition presentation on Set Detail.
- Additional learning modes.
- System/Public Set detail or ADMIN Set editor redesign.
- Any broader Personal Vocabulary catalog redesign.

## 15. Open questions and approval decisions

There is no blocking ambiguity preventing this SPEC from review. Human approval of this SPEC explicitly confirms these V1 decisions:

1. Empty Sets show the two real learning cards in a non-interactive unavailable state with **“Thêm từ vựng để bắt đầu”**, while all Set Detail vocabulary-management functions remain available.
2. Set Detail uses the first meaning and first example in their existing authoritative `created_at` then `id` order; it does not CEFR-rank, invent, generate, or fall back to other display data.
3. Set Detail uses a compact back-and-name-only header. Set edit and delete remain in the My Sets card management menu and do not appear in the Detail header.
4. Existing full ordered-list PATCH semantics, including recreated membership IDs and last-write-wins concurrency, are accepted for V1.
5. The Detail-owned add workflow is a centered modal (desktop target 640–720px), with picker search and a **Tạo từ mới** step inside the same workflow; it is not a drawer and must not create nested modal-on-modal behavior.
