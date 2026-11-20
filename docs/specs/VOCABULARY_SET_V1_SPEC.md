# SPEC: Vocabulary Set V1

**Feature status:** `TODO`

**SPEC status:** `PENDING HUMAN APPROVAL`

**Implementation authorized:** `NO`

## 1. Objective

Deliver the first Vocabulary Set capability as a Topic-organized collection of existing Vocabulary records. Vocabulary Set V1 introduces two deliberately distinct kinds of set:

- **System Sets:** created and managed by an ADMIN, publicly discoverable by Topic, and copyable by an authenticated USER.
- **User Sets:** created, owned and managed by one USER, and private in V1.

The feature establishes the durable relationship:

```text
TOPIC
  -> VOCABULARY_SET
      -> VOCABULARY_SET_ITEM
          -> VOCABULARY
```

A Set Item references a Vocabulary only, never a particular Meaning. CEFR remains Vocabulary Meaning metadata. The result is a Set shape that future Flashcard and Learning work can consume without implementing any learning behavior now.

## 2. Existing Context and Reconciliation

- Topic V1 is complete as an independent metadata feature. It deliberately has no current Set relation, but records that a future materialized `VOCABULARY_SET.topic_id` relation must use Topic deletion `RESTRICT` / no cascade. Vocabulary Set V1 materializes that approved future boundary.
- Vocabulary V1 is complete as an ADMIN-managed aggregate. Its public contract correctly has no Guest/USER Vocabulary catalog, detail, search or discovery feature.
- Vocabulary Set editing needs a user to select an existing Vocabulary. This SPEC adds one narrowly scoped, authenticated **Vocabulary picker** integration contract for Set editors only. It is not a reopening of Vocabulary V1: it has no standalone route or screen, returns only selection metadata, and never returns Meaning/Example aggregates.
- The current Prisma schema contains `USER`, `AUTH_SESSION`, `TOPIC`, `VOCABULARY`, `VOCABULARY_MEANING` and `VOCABULARY_EXAMPLE`; it contains no Set or Set Item model.
- Existing generic Vocabulary Set API/UI/database drafts are future-oriented and include public/shared/user-set behavior beyond this V1. After SPEC/PLAN approval, the relevant documentation must be synchronized to this approved V1 contract before implementation.

## 3. Actors and Authorization

### 3.1 Guest

A Guest may:

- discover System Sets by Topic;
- view a System Set detail and its ordered Vocabulary selection metadata.

A Guest may not:

- create, edit, delete or copy a Set;
- access a User Set;
- use the authenticated Vocabulary picker;
- access a standalone Vocabulary catalog or Vocabulary detail route.

### 3.2 USER

A USER may:

- discover and view System Sets;
- create, list, view, update and delete only their own private User Sets;
- copy a System Set into a new private User Set they own;
- use the scoped Vocabulary picker while editing a Set.

A USER may not:

- access another USER's private Set;
- create, edit or delete a System Set;
- change a User Set to public;
- browse a standalone Vocabulary catalog or retrieve a Vocabulary aggregate through the picker.

### 3.3 ADMIN

An ADMIN may:

- create, list, view, update and delete System Sets;
- use the same scoped Vocabulary picker while editing a System Set;
- discover and view System Sets as any other visitor.

An ADMIN has no implicit V1 authority to manage private User Sets. Moderation of User Sets is deferred. Existing backend authentication and role authorization remain authoritative; frontend navigation/route guards are UX only.

## 4. Scope

### 4.1 In Scope

- Persist `VOCABULARY_SET` and `VOCABULARY_SET_ITEM` with UUID identifiers.
- Require every Set to belong to exactly one existing Topic.
- ADMIN System Set aggregate CRUD, public Topic-based System Set discovery/detail and USER private Set aggregate CRUD.
- Copy a System Set into an independent private User Set, retaining its item order.
- Ordered Set Items that each reference one existing Vocabulary, with at most one occurrence of a Vocabulary per Set.
- A bounded, word-based, authenticated Vocabulary picker used only inside System/User Set editors.
- Backend ownership, visibility, input validation, transactions, safe errors and reference integrity.
- Public System Set screens, USER My Sets/editor screens and ADMIN System Set management screens using current route/layout conventions.
- Focused database, backend/API/security, frontend, browser, accessibility and regression tests in later workflow stages.

### 4.2 Out of Scope / Deferred

- A Guest/USER standalone Vocabulary catalog, Vocabulary detail route, Vocabulary discovery page or full Vocabulary aggregate access.
- Returning Meaning or Example data through the Set-editor picker.
- Direct `TOPIC -> VOCABULARY` linkage, Topic-level CEFR, Set-level CEFR or copying CEFR from Meaning.
- Community sharing, public User Sets, copying another USER's Set, User Set publishing and Set moderation.
- Flashcards, learning sessions, Learning Progress, SRS, review queues, Quiz, XP, Level, Streak, Achievement and Dashboard learning changes.
- Pronunciation Practice, audio hosting, recordings, scoring, AI, imports/exports, tags, images, favorites, soft delete and audit history.
- Pagination. V1 lists use bounded/unpaginated Set results with client-side Set-name search; the picker is the explicitly approved server-side word-search exception.
- Granular Set Item CRUD endpoints, drag-and-drop libraries, and any new role or authorization system.

## 5. Data Model and Integrity

### 5.1 `VOCABULARY_SET`

| Field | Requirement |
|---|---|
| `id` | UUID primary identifier. |
| `topic_id` | Required UUID foreign key to `TOPIC.id`. |
| `owner_id` | Required UUID foreign key to `USER.id`; the server derives it from the authenticated creator/copying USER or ADMIN. |
| `name` | Required string; trimmed, non-empty, maximum 100 characters. |
| `description` | Optional string, maximum 500 characters; `null` means absent. |
| `is_public` | Required boolean. System Sets are `true`; User Sets are always `false` in V1. |
| timestamps | `created_at`, `updated_at`. |

There is no separate Set-type enum. A System Set is a Set created by an ADMIN with `is_public: true`; service authorization enforces that invariant. A User Set is owned by a USER with `is_public: false`. Client input never controls `owner_id` or `is_public` outside the applicable server-controlled operation.

### 5.2 `VOCABULARY_SET_ITEM`

| Field | Requirement |
|---|---|
| `id` | UUID primary identifier. |
| `vocabulary_set_id` | Required UUID foreign key to `VOCABULARY_SET.id`. |
| `vocabulary_id` | Required UUID foreign key to `VOCABULARY.id`. |
| `position` | Required positive integer; unique within its Set and persisted as contiguous one-based order. |
| `created_at` | Creation timestamp. |

Required database constraints:

- `UNIQUE(vocabulary_set_id, vocabulary_id)` prevents a Vocabulary appearing twice in one Set.
- `UNIQUE(vocabulary_set_id, position)` preserves an unambiguous order.
- A PostgreSQL check requires `position > 0`.
- `VOCABULARY_SET -> VOCABULARY_SET_ITEM` is aggregate ownership and may cascade on Set deletion.
- `TOPIC -> VOCABULARY_SET` uses `ON DELETE RESTRICT` / no cascade.
- `VOCABULARY -> VOCABULARY_SET_ITEM` uses `ON DELETE RESTRICT` / no cascade, so a catalog Vocabulary already used by a Set cannot be removed accidentally.

No Set Item may reference a Meaning or Example. A Vocabulary may occur in many different Sets.

### 5.3 Item and Aggregate Rules

- System Sets must contain at least one Item when created or updated.
- A User Set may be created or retained as an empty private draft, and may later receive Items. This supports an owner-controlled draft without fabricating Vocabulary data.
- Create receives the complete desired `items` array. Each item is `{ "vocabulary_id": "uuid" }`, in the intended order.
- `PATCH` supports `topic_id`, `name`, `description` and `items` only. Omitted supported fields remain unchanged; supplied `description: null` clears it; `name: null` and `topic_id: null` are invalid.
- If `items` is supplied, it is the complete desired ordered item collection. The service validates every referenced Vocabulary and atomically replaces/reorders the owned Item collection, assigning positions `1..N` from the submitted order.
- There is no independent Set Item route. A duplicate, malformed or missing `vocabulary_id` is rejected before persistence; the database uniqueness constraint remains the concurrent-write integrity boundary.

### 5.4 Copy and Delete Semantics

- Copying a System Set creates a new independent User Set with `owner_id` set from the authenticated USER, `is_public: false`, the source Topic/name/description copied, and fresh Set Item records preserving Vocabulary IDs and item order.
- The original System Set is never changed. A copied Set has no source-link, version, ownership link or automatic synchronization in V1.
- Deleting a System Set or an owned User Set deletes only its owned Set Items through the aggregate cascade.
- An attempt to delete a Topic with Sets is restricted. An attempt to delete a Vocabulary referenced by any Set is restricted. The Topic/Vocabulary delete endpoints and their final external-reference error codes must be synchronized with these materialized constraints in the implementation feature work.
- No policy is defined here for future Learning, Flashcard, Quiz, Community or other external Set references; each future feature must approve its own foreign-key/delete behavior.

## 6. API Requirements

All identifiers are UUID strings. Success bodies use `{ "success": true, "data": ... }`, except `204`; errors use `{ "success": false, "error": { "code": "...", "message": "safe message" } }`.

### 6.1 Shared Representations

System/User Set summary:

```json
{
  "id": "uuid",
  "topic_id": "uuid",
  "name": "Daily Life Basics",
  "description": "Starter words for daily conversations",
  "is_public": true,
  "item_count": 12,
  "created_at": "ISO-8601 timestamp",
  "updated_at": "ISO-8601 timestamp"
}
```

Complete accessible Set detail additionally returns ordered items with minimal Vocabulary display metadata:

```json
{
  "id": "uuid",
  "topic_id": "uuid",
  "name": "Daily Life Basics",
  "description": null,
  "is_public": false,
  "items": [
    {
      "id": "uuid",
      "vocabulary_id": "uuid",
      "word": "book",
      "phonetic": "/bʊk/",
      "position": 1,
      "created_at": "ISO-8601 timestamp"
    }
  ],
  "created_at": "ISO-8601 timestamp",
  "updated_at": "ISO-8601 timestamp"
}
```

`word` and optional `phonetic` identify an Item for display/selection only. No Meaning, Example, CEFR or full Vocabulary aggregate is included.

### 6.2 Public System Set Discovery

| Method / path | Access | Success | Requirement |
|---|---|---:|---|
| `GET /api/topics/:topicId/vocabulary-sets` | Guest/User/ADMIN | `200` | Unpaginated summaries of public System Sets for the Topic only; no private Set or Vocabulary catalog data. |
| `GET /api/vocabulary-sets/:setId` | Guest/User/ADMIN | `200` | Complete public System Set detail with ordered minimal Item metadata. Private Sets are not disclosed. |

The current public Topic list/detail remain metadata-only; this feature adds System Set discovery as explicit Set routes, not embedded arbitrary Set data into Topic V1 responses.

### 6.3 Scoped Vocabulary Picker

| Method / path | Access | Success | Requirement |
|---|---|---:|---|
| `GET /api/vocabulary-set-picker?query=<word>` | Authenticated USER/ADMIN | `200` | Bounded word-search results for Set editor selection only. |

The request requires a non-empty trimmed `query` of at most 100 characters. Its response is a bounded array of:

```json
{
  "id": "uuid",
  "word": "book",
  "phonetic": "/bʊk/"
}
```

This endpoint must not return `meanings`, `examples`, `cefr_level`, a Vocabulary detail shape, or an unfiltered/all-Vocabulary catalog. It has no standalone frontend route, and a Set save remains responsible for validating every submitted `vocabulary_id` against the database.

### 6.4 USER Private Set Routes

| Method / path | Access | Success | Requirement |
|---|---|---:|---|
| `GET /api/my/vocabulary-sets` | USER | `200` | The current USER's private Set summaries only. |
| `POST /api/my/vocabulary-sets` | USER | `201` | Creates a private Set owned by the session USER; body `{ topic_id, name, description?, items }`. |
| `GET /api/my/vocabulary-sets/:setId` | Owner USER | `200` | Owner-only complete private Set detail. |
| `PATCH /api/my/vocabulary-sets/:setId` | Owner USER | `200` | Applies approved aggregate patch/replacement semantics. |
| `DELETE /api/my/vocabulary-sets/:setId` | Owner USER | `204` | Deletes the private Set and its owned Items; no body. |
| `POST /api/vocabulary-sets/:systemSetId/copy` | USER | `201` | Copies an accessible System Set into a new independent private Set. |

User create/update bodies cannot set `owner_id` or `is_public`. An unowned/private/nonexistent resource is handled as not found to avoid disclosing another User's private Set.

### 6.5 ADMIN System Set Routes

| Method / path | Access | Success | Requirement |
|---|---|---:|---|
| `GET /api/admin/vocabulary-sets` | ADMIN | `200` | Unpaginated System Set summaries for management. |
| `POST /api/admin/vocabulary-sets` | ADMIN | `201` | Creates a public System Set; body `{ topic_id, name, description?, items }`. |
| `GET /api/admin/vocabulary-sets/:setId` | ADMIN | `200` | Complete System Set aggregate detail. |
| `PATCH /api/admin/vocabulary-sets/:setId` | ADMIN | `200` | Updates a System Set with aggregate semantics. |
| `DELETE /api/admin/vocabulary-sets/:setId` | ADMIN | `204` | Deletes the System Set and owned Items; no body. |

These routes manage System Sets only. They do not become an ADMIN interface for private User Sets in V1.

### 6.6 Validation and Error Contract

| Condition | Status | Stable code |
|---|---:|---|
| Invalid UUID, body, field, query, Item graph, duplicate Item, invalid order or validation failure | `400` | `VALIDATION_ERROR` |
| Missing/inaccessible Set | `404` | `VOCABULARY_SET_NOT_FOUND` |
| Missing Topic | `404` | `TOPIC_NOT_FOUND` |
| Referenced Vocabulary is missing | `404` | `VOCABULARY_NOT_FOUND` |
| Concurrent duplicate Set Item collision | `409` | `VOCABULARY_ALREADY_IN_SET` |
| Missing or invalid session | `401` | existing `AUTHENTICATION_FAILED` |
| Authenticated caller lacks applicable role/action | `403` | existing `FORBIDDEN` |
| Unexpected failure | `500` | existing `INTERNAL_SERVER_ERROR` |

Controllers/services must translate expected errors safely and leave unexpected failures to the existing minimal final error handler. Neither response nor log output may expose database internals, session data, credentials or private resource existence.

## 7. Frontend Requirements

### 7.1 Routes, Layout and Navigation

- Add public System Set discovery routes for Topic-based discovery and System Set detail outside `GuestRoute`, so Guest and authenticated visitors can access them.
- Add USER My Sets routes under the existing `ProtectedRoute` and `AuthenticatedShell`; show the My Sets navigation entry only to USER alongside real routes.
- Add `/admin/vocabulary-sets` under the existing `ProtectedRoute`, `AdminRoute` and `AuthenticatedShell`; show its ADMIN-only navigation entry only alongside the real management route.
- Retain existing public Topic pages, AuthenticatedShell ownership of sidebar/drawer/logout, existing Topic management and ADMIN Vocabulary management. No second shell or role system is created.
- Do not add a route or menu entry for a generic USER Vocabulary catalog/detail screen.

### 7.2 Screens and Workflows

- **Public Topic-based System Sets:** show System Set summaries for a selected Topic, client-side Set-name search, accessible loading/empty/error/not-found states, and links to public System Set detail.
- **Public System Set detail:** show Topic/Set metadata and ordered minimum Vocabulary item display. An authenticated USER is offered Copy; a Guest is directed to authenticate. No learning action is added.
- **USER My Sets:** list/search the owner's private Sets, create/edit/view/delete an owned Set and show an explicit delete confirmation. An empty private draft is valid.
- **ADMIN System Set management:** list/search, create/edit/view/delete System Sets and select a Topic. System Set save requires at least one Item.
- **Set editor Vocabulary picker:** appears only inside a User/Admin Set editor. It sends a word query only after the editor is active, shows bounded selection metadata, supports add/remove, prevents duplicate Vocabulary selection, and offers keyboard-accessible move-up/move-down ordering. It never links to or renders a standalone Vocabulary catalog/detail or Vocabulary Meaning/Example data.
- **Copy:** a USER can invoke copy from a System Set detail, receives safe success/error feedback, and is directed to the independent copied private Set.

### 7.3 State, Accessibility and Responsive Behavior

- All list, detail, picker and mutation flows provide accessible loading/status, empty, validation, safe error, not-found, authentication and authorization states.
- Inputs have associated labels/errors. Item collections expose clear semantic grouping, item positions, add/remove/reorder controls and keyboard/focus behavior without relying only on drag-and-drop.
- Delete dialogs identify the affected Set, explain that its owned Items are removed, support cancel/confirm, restore focus and prevent duplicate pending actions.
- Responsive layouts preserve current public Topic and authenticated App Layout behaviors at existing mobile/tablet/desktop breakpoints.

## 8. Acceptance Criteria

- **AC-01:** V1 materializes only `VOCABULARY_SET` and `VOCABULARY_SET_ITEM` for this feature, with approved UUID fields, timestamps and no speculative model.
- **AC-02:** Every Set belongs to exactly one Topic; every Item belongs to exactly one Set and references exactly one Vocabulary, never a Meaning; a Vocabulary appears at most once per Set and Item order is explicit.
- **AC-03:** Topic deletion is restricted while Sets exist; Vocabulary deletion is restricted while Set Items reference it; deleting a Set deletes only its owned Items. No future external-reference policy is invented.
- **AC-04:** ADMIN can create, view, update and delete public System Sets; System Sets require one-or-more valid ordered Items and remain ADMIN-managed.
- **AC-05:** USER can create, view, update and delete only their own private User Sets; USER Sets remain private and cannot be published directly.
- **AC-06:** Guest/User/ADMIN can discover public System Sets by Topic and view public System Set detail without exposure of private User Sets.
- **AC-07:** USER can copy a System Set into an independent private owned Set with new IDs and preserved Item order; neither source nor future changes are coupled to the copy.
- **AC-08:** Set create/update validates UUIDs, Topic/Vocabulary existence, field limits, Item uniqueness and order; aggregate Item writes/replacement/reordering are atomic and safe under concurrent duplicate attempts.
- **AC-09:** Set PATCH preserves omitted fields, clears only optional `description` with explicit `null`, and treats a supplied `items` array as the complete desired ordered collection with no granular Item API.
- **AC-10:** The authenticated picker supports bounded word-based selection metadata only inside a Set editor; it exposes no standalone USER Vocabulary catalog/detail/discovery and no Meaning/Example aggregate.
- **AC-11:** Backend authorization independently protects System management, private Set ownership, copy and picker access; frontend guards/navigation do not replace it.
- **AC-12:** API/UI safely handle validation, duplicates, missing/inaccessible resources, authentication/authorization failures, picker/load/mutation errors and unexpected failures without exposing internals.
- **AC-13:** Public/System, USER and ADMIN routes reuse existing public/authenticated layouts, session state and navigation conventions without regressing Topic, Vocabulary, dashboard, logout or mobile drawer behavior.
- **AC-14:** V1 introduces no direct Topic-Vocabulary relation, CEFR duplication, public User Set/community sharing, Flashcard, learning, progress, SRS, Quiz, XP, Streak, pronunciation practice, AI or unrelated dependency.

## 9. Dependencies, Documentation and Future Integration

- **Database:** requires a focused migration for the two Set models, their foreign keys, unique/check constraints and only the approved owned/external deletion rules.
- **Backend:** requires Set repository/service/controller/routes, scoped picker data access and existing session/role middleware integration. Item replacement/copy must use transactions.
- **Frontend:** requires public System Set views, User My Sets/editor, ADMIN System Set management and editor-contained picker components using the existing shells/routes.
- **Topic:** this is the feature that materializes the previously deferred Topic-to-Set `RESTRICT` relation; it does not introduce Topic-to-Vocabulary.
- **Vocabulary:** this is the feature that materializes the first external Vocabulary reference with `RESTRICT`; the picker is limited to selection metadata and does not alter completed ADMIN Vocabulary management.
- **Future Flashcard/Learning:** may consume a Set and its ordered Vocabulary IDs. They must define their own learning/progress side effects and reference/delete rules; none occur in V1.

After SPEC approval and before implementation, synchronize the approved contract in `docs/DATABASE.md`, `docs/API_SPEC.md`, `docs/UI_UX_SPEC.md`, `docs/FEATURE_STATUS.md` and, only if needed for an active contract conflict, `docs/ARCHITECTURE.md`. That synchronization must explicitly distinguish the Set-editor picker from a USER Vocabulary catalog and remove conflicting legacy Set routes/visibility assumptions.

## 10. Human Review Decisions

No further product question blocks this SPEC. The following explicit V1 decisions require human review together:

1. A System Set is represented by server-enforced ADMIN creation plus `is_public: true`; a User Set is server-enforced `is_public: false`, without a new type enum.
2. Every Set has a required Topic. System Sets require one-or-more Items; User Sets may be empty private drafts.
3. Set Item order is one-based and contiguous; a supplied `items` collection fully replaces/reorders the owned collection atomically.
4. The only USER-facing Vocabulary access is the authenticated, bounded, word-query Set-editor picker returning `{ id, word, phonetic }`; no page, detail or aggregate access is created.
5. `RESTRICT` is materialized for Topic-to-Set and Vocabulary-to-Set-Item; cascade is limited to Set-to-owned-Item deletion.

These decisions do not authorize planning or implementation until this SPEC is approved.

## Approval Gate

```text
SPEC STATUS: PENDING HUMAN APPROVAL
NEXT ALLOWED STAGE: HUMAN SPEC REVIEW
PLAN / TASK / IMPLEMENTATION AUTHORIZED: NO
```
