# SPEC: Personal Vocabulary Set Topic Decoupling V1

**Feature status:** `IN_PROGRESS`

**SPEC status:** `HUMAN APPROVED`

**Implementation authorized:** `YES — through approved PLAN and TASK`

## 1. Objective

Correct the ELVocab V1 Vocabulary Set contract so that `TOPIC` remains the system-managed category for public System Sets while private Personal Sets no longer require or expose Topic management to a USER.

This SPEC supersedes only the Vocabulary Set V1 rule that **every Vocabulary Set belongs to exactly one Topic**, including the corresponding required-`topic_id` requirements for USER create/update and System-to-Personal copy. It does not replace the remainder of `TOPIC_V1_SPEC.md` or `VOCABULARY_SET_V1_SPEC.md`.

The resulting relationship is:

```text
TOPIC 1 -> N public System VOCABULARY_SET

private Personal VOCABULARY_SET -> no required Topic

VOCABULARY_SET 1 -> N VOCABULARY_SET_ITEM -> VOCABULARY
```

## 2. Existing Context and Reconciliation

- Topic V1 and Vocabulary Set V1 are implemented. This is a product-rule change to completed behavior, not a rebuild of either domain.
- `VOCABULARY_SET.topic_id` is currently a required UUID foreign key with `ON DELETE RESTRICT`.
- Both System and Personal Sets currently have a required `owner_id`. The existing service and authorized route determine Set kind: ADMIN-created System Sets use `is_public: true`; USER-created or copied Personal Sets use `is_public: false`. This SPEC does not change ownership or introduce a Set-type enum.
- Current USER and ADMIN Set writes share validation that accepts `topic_id`; current USER create requires it. The contracts must be separated without weakening ADMIN System Set validation.
- Current System-to-Personal copy carries `topic_id` to the copy.
- Current Learning Set responses always contain Topic metadata, although Learning authorization, membership and Progress do not depend on Topic. Quiz does not use Topic.
- Canonical documentation remains unchanged until this SPEC is approved and implemented. Historical specs remain records of their approved checkpoints and must not be silently rewritten.

## 3. Actors

### 3.1 Guest

- May continue to list Topics, discover public System Sets by Topic and view public System Set detail.
- Has no access to private Personal Sets.

### 3.2 USER

- May create, read, update and delete only their own private Personal Sets.
- Does not select, assign, change or clear Topic through Personal Set APIs or UI.
- May copy an accessible System Set into an independent, topicless Personal Set.
- May continue to discover public System Sets through system-managed Topics.

### 3.3 ADMIN

- Continues to manage Topics.
- Continues to create and update public System Sets with exactly one Topic.
- Selects a Topic by human-readable name in the UI; the selected Topic ID is transported internally.
- Does not manually type a Topic UUID.

Existing authentication, role authorization, private ownership concealment and server-controlled visibility remain authoritative.

## 4. Scope

### 4.1 In Scope

- Make `VOCABULARY_SET.topic_id` nullable while retaining its foreign key for non-null values.
- Require every `is_public: true` System Set to have a non-null valid Topic at both database and service boundaries.
- Remove `topic_id` from accepted USER Personal Set create/update fields.
- Retain `topic_id: uuid | null` in Set summary/detail representations for compatibility with existing rows and consumers.
- Create new Personal Sets without a Topic.
- Make System-to-Personal copies topicless while preserving all existing copy ownership, independence and ordered membership rules.
- Define Learning response behavior for topicless Personal Sets.
- Preserve Topic-based public System Set discovery and ADMIN Topic management.
- Preserve Topic deletion restriction for every remaining Set reference.
- Define migration, existing-data, rollback, frontend-contract and verification requirements.

### 4.2 Out of Scope

- Removing the `TOPIC` table or Topic domain.
- Renaming `TOPIC` to Category in database or code.
- Redesigning the complete “Khám phá bộ từ” UI.
- Implementing Topic checkbox filters.
- Redesigning Set Detail.
- Adding or managing Vocabulary membership inside the Personal Set Create/Edit modal or drawer.
- Public USER-created Sets or USER-controlled visibility.
- A new Set-type enum.
- A new tags/category system.
- Backend pagination or search redesign.
- Topic cascade deletion.
- Hardcoded categories.
- Changing Set Item ordering, exact-ID membership, private Vocabulary, Learning Progress or Quiz behavior.
- Creating a PLAN, TASK, migration or production implementation in this SPEC stage.

## 5. Business Rules

- **BR-01:** `TOPIC` is a system-managed category used to organize public System Sets for discovery and filtering.
- **BR-02:** Every public System Set (`is_public: true`) must reference exactly one existing Topic.
- **BR-03:** A private Personal Set (`is_public: false`) does not require a Topic.
- **BR-04:** A USER cannot assign, change or clear `topic_id` through Personal Set create/update APIs.
- **BR-05:** ADMIN System Set create requires a valid `topic_id`; update may replace it with another valid Topic but may not clear it.
- **BR-06:** Topic selection in ADMIN UI is human-readable. Raw UUID entry is not a user interaction; the selector maps the chosen Topic to its ID internally.
- **BR-07:** Personal Set UI contains no Topic selector and does not depend on successful Topic loading to create or edit a Set.
- **BR-08:** Copying a System Set creates a new independent Personal Set with `topic_id: null`. The copy does not inherit system categorization.
- **BR-09:** Existing System Sets retain their current Topic.
- **BR-10:** Existing Personal Sets may retain their current Topic as readable legacy metadata. USER cannot manage that legacy reference through normal Personal Set writes.
- **BR-11:** A Topic referenced by any Set, including a legacy Personal Set, cannot be deleted. Topic deletion never cascades to Sets.
- **BR-12:** Removing a legacy Personal Set Topic reference is not part of this change. A later approved migration or ADMIN remediation policy may address those references.
- **BR-13:** Set ownership, visibility, ordered membership, exact Vocabulary identity, copy independence, Learning authorization/Progress and Quiz behavior remain unchanged.

## 6. Data Requirements

### 6.1 Vocabulary Set Relation

`VOCABULARY_SET.topic_id` becomes nullable:

```text
topic_id: UUID NULL -> TOPIC.id
```

The existing foreign key remains authoritative when `topic_id` is non-null and retains `ON DELETE RESTRICT` / no cascade.

### 6.2 System Set Invariant

The authoritative invariant is:

```text
is_public = true  -> topic_id IS NOT NULL
is_public = false -> topic_id MAY be NULL
```

Both layers enforce it:

- Database: a conditional check prevents any `is_public: true` row with `topic_id: null`; the Topic foreign key validates every non-null reference.
- Service: ADMIN System create requires `topic_id`; System update rejects `null` and never persists a topicless System Set; Topic existence is validated before persistence.

The database rule uses the existing `is_public` discriminator. `owner_id` remains required for both ADMIN-created System Sets and USER-created Personal Sets and is not a Set-kind discriminator.

### 6.3 Preserved Set Data Rules

- `name`, `description`, ownership, visibility and timestamps are unchanged.
- System Sets continue to require one-or-more canonical Vocabulary Items.
- Personal Sets may remain empty.
- Item IDs, Vocabulary IDs, unique membership, contiguous one-based order and aggregate replacement semantics are unchanged.
- No new table, Set type, tag or category entity is introduced.

## 7. API Requirements

### 7.1 USER Create

`POST /api/my/vocabulary-sets` accepts only:

```json
{
  "name": "Du lịch Nhật Bản",
  "description": "Từ vựng cần thiết cho chuyến đi",
  "items": []
}
```

- `name` remains required.
- `description` remains optional and nullable.
- `items` remains optional and defaults to an empty collection under the existing Personal Set rule.
- `topic_id`, `owner_id` and `is_public` are unsupported USER fields.
- Supplying `topic_id`, including `null`, returns `400 VALIDATION_ERROR` under the existing unsupported-field policy.
- Creation performs no Topic lookup.

Removing `topic_id` from USER writes is an intentional contract correction. Older USER clients that still submit it must update; accepting it as optional metadata would contradict the rule that USER does not manage Topic.

### 7.2 USER Update

`PATCH /api/my/vocabulary-sets/:setId` supports only:

- `name`;
- `description`;
- complete ordered `items` when applicable to the existing aggregate API.

At least one supported field remains required. `topic_id` is unsupported and returns `400 VALIDATION_ERROR`. A metadata or membership update neither clears nor changes an existing legacy Personal Set Topic reference.

### 7.3 USER Read

USER list/detail responses retain:

```json
"topic_id": "uuid | null"
```

This stable nullable field:

- minimizes read-contract breakage;
- represents new and copied topicless Personal Sets as `null`;
- permits existing Personal Set Topic references to remain readable;
- does not grant USER authority to manage Topic.

No embedded Topic object is added to Personal Set list/detail responses.

### 7.4 ADMIN System Set Contract

`POST /api/admin/vocabulary-sets` continues to require:

```json
{
  "topic_id": "uuid",
  "name": "Tiếng Anh ở sân bay",
  "description": null,
  "items": [
    { "vocabulary_id": "uuid" }
  ]
}
```

- Missing or null `topic_id` is `400 VALIDATION_ERROR`.
- A well-formed but nonexistent Topic is `404 TOPIC_NOT_FOUND`.
- `PATCH /api/admin/vocabulary-sets/:setId` may replace `topic_id` with another existing Topic.
- `PATCH` with `topic_id: null` is invalid and cannot clear the relation.
- ADMIN summary/detail responses retain non-null `topic_id`.

### 7.5 Copy System Set to Personal Set

`POST /api/vocabulary-sets/:systemSetId/copy` creates a new Personal Set with:

- current authenticated USER ownership;
- `is_public: false`;
- `topic_id: null`;
- copied name and description;
- fresh Set and Set Item IDs;
- exact Vocabulary identities and order preserved;
- no source link or synchronization.

### 7.6 Learning Contract

The Learning Set response retains a stable `topic` key:

```json
{
  "id": "set-uuid",
  "name": "Set name",
  "topic": null,
  "cards": []
}
```

- For a System Set or legacy Personal Set with Topic, `topic` remains `{ "id": "uuid", "name": "string" }`.
- For a topicless Personal Set, `topic` is `null`.
- The field is not omitted conditionally.
- Learning access, empty-Set behavior, ordered cards, meaningful events, concurrency and per-USER/per-Vocabulary Progress remain unchanged.

### 7.7 Quiz Contract

Quiz remains Set-scoped and Topic-independent. Question loading, access checks, answer validation, question revision, Set membership verification and Learning Progress updates must work identically for topicless Personal Sets. No Topic field or Topic-specific Quiz rule is introduced.

### 7.8 Topic Delete Contract

- `DELETE /api/admin/topics/:topicId` succeeds only when no Set references the Topic.
- Any non-null System or legacy Personal Set reference blocks deletion.
- The database FK remains the final concurrency-safe restriction boundary.
- A referenced Topic deletion returns `409 TOPIC_IN_USE` with a safe message and no database details.
- No Set or Set Item is cascade-deleted through Topic deletion.

`TOPIC_IN_USE` formalizes the previously deferred relation-conflict contract; the current generic unexpected-error behavior is not the desired final contract.

## 8. Existing Data, Migration and Rollback

### 8.1 Existing Data

- Existing System Set rows remain unchanged and retain valid Topic references.
- Existing Personal Set rows remain unchanged and may retain their Topic references.
- No row requires destructive backfill or reassignment.
- New USER-created Personal Sets use `topic_id: null`.
- New copies of System Sets use `topic_id: null`.
- Legacy Personal Topic references remain readable but unmanaged and continue to restrict Topic deletion.

### 8.2 Migration

- A new forward migration is required; old migration history must not be rewritten.
- The migration makes `VOCABULARY_SET.topic_id` nullable, retains its foreign key and delete restriction, and adds the public-System non-null check.
- Migration verification is allowed only through the guarded dedicated TEST database workflow.
- Automated tests must never use Main, Preview or Production databases.

### 8.3 Rollback

- Schema rollback is straightforward only before a topicless Personal Set exists.
- Once null rows exist, restoring `NOT NULL` requires an explicit approved remediation or backfill policy before rollback.
- Rollback must not invent a default Topic, delete Personal Sets or copy arbitrary categorization.
- Deployment planning must account for the USER API contract change and database compatibility across application versions.

## 9. Frontend Contract Consequences

### 9.1 USER

- Personal Set Create/Edit does not render or validate a Topic selector.
- Personal Set submission sends no `topic_id`.
- Topic list failure or unavailability cannot block Personal Set create/edit.
- Personal Set list search remains limited to supported Set metadata such as name and description.
- Raw Topic IDs are never requested from or entered by USER.

### 9.2 ADMIN

- System Set Create/Edit retains the Topic selector.
- The selector displays human-readable Topic names and submits the selected ID internally.
- Missing Topic, stale Topic and safe mutation errors remain distinct.
- Topic CRUD remains valid.

### 9.3 Discovery

- Topic remains authoritative for public System Set grouping and filtering.
- Existing Topic-based discovery remains functional.
- A future discovery UI may add Topic checkbox filters and Set name/description search under a separate approved SPEC/PLAN.
- This SPEC defines no discovery page redesign or filter implementation.

## 10. Edge Cases and Failure Behavior

- A USER request containing `topic_id` is rejected rather than silently ignored.
- Updating a legacy Personal Set without `topic_id` preserves its existing Topic reference.
- A copied System Set is topicless even though its source remains categorized.
- Deleting the source System Set or changing its Topic never changes the independent Personal copy.
- A concurrently deleted ADMIN-selected Topic produces the existing safe `404 TOPIC_NOT_FOUND` behavior during Set save.
- Direct persistence of a public Set with null Topic is rejected by the database check.
- Direct persistence of a non-null unknown Topic is rejected by the foreign key.
- Topic deletion racing with System Set creation/reassignment remains protected by the foreign key and transaction/persistence error handling.
- Topic deletion remains blocked by legacy Personal references until those references are removed under a separately approved policy.
- Topicless Personal Sets continue to require non-empty membership before Learning or Quiz can start under existing empty-Set rules.

## 11. Acceptance Criteria

- **AC-01:** An authenticated USER can create an owned private Personal Set without `topic_id`.
- **AC-02:** Personal Set creation performs no Topic lookup and remains available when Topic listing is unavailable.
- **AC-03:** An owner USER can update supported Personal Set metadata or membership without submitting Topic.
- **AC-04:** ADMIN cannot create a public System Set without a valid non-null Topic.
- **AC-05:** ADMIN cannot clear Topic from an existing System Set.
- **AC-06:** The database permits `topic_id: null` for a valid `is_public: false` Personal Set.
- **AC-07:** Service validation and a database constraint both prevent an `is_public: true` System Set with `topic_id: null`.
- **AC-08:** Existing Set Item exact IDs, uniqueness, contiguous order and aggregate replacement behavior are unaffected.
- **AC-09:** Learning loads and records Progress for a topicless owned Personal Set with the same authorization, membership and concurrency rules; its response contains `topic: null`.
- **AC-10:** Both approved Quiz types load and record answers for a topicless owned Personal Set without Topic-dependent behavior.
- **AC-11:** Canonical/private Vocabulary exact-ID eligibility, ownership, same-spelling coexistence and Personal Vocabulary lifecycle rules remain unchanged.
- **AC-12:** Topic-based public System Set discovery and grouping remain functional and exclude private Personal Sets.
- **AC-13:** Deleting a Topic referenced by any System or legacy Personal Set is blocked without cascading Set deletion and returns `409 TOPIC_IN_USE`.
- **AC-14:** Existing Topic and System Set rows require no destructive rewrite or synthetic backfill.
- **AC-15:** Copying a System Set creates an independent topicless Personal Set while preserving name, description, exact Vocabulary identities and order with fresh Set/Item IDs.
- **AC-16:** USER Personal Set UI/API never requires or permits manual raw Topic UUID input and USER create/update does not accept `topic_id`.
- **AC-17:** ADMIN System Set UI uses a human-readable selector that maps Topic name to internal ID; ADMIN never manually enters a raw UUID.
- **AC-18:** Migration and database-dependent automated verification use only the guarded dedicated TEST database, never Main, Preview or Production.
- **AC-19:** USER list/detail responses retain `topic_id: uuid | null`; new and copied topicless Sets return `null`, while legacy references remain readable.
- **AC-20:** Updating a legacy Personal Set through supported USER fields does not silently clear or alter its existing Topic reference.
- **AC-21:** USER submission of unsupported `topic_id` returns `400 VALIDATION_ERROR`; ADMIN missing/null Topic and nonexistent Topic retain their specified validation/not-found distinction.
- **AC-22:** Topic CRUD remains ADMIN-only and System Set ownership/visibility authorization remains unchanged.
- **AC-23:** No new role, Set-type enum, Topic alias, tag/category model, external service, package or unrelated API is introduced.

## 12. Dependencies and Impact

- **Database:** nullable Set Topic relation, retained FK/`RESTRICT`, and a public-System Topic check constraint.
- **Backend:** separate USER and ADMIN accepted-field/normalization paths; topicless copy; nullable read serialization; safe Topic-in-use conflict; nullable Learning Topic projection.
- **Frontend:** remove Topic dependency from USER Personal Set editor only; preserve ADMIN selector and Topic management/discovery.
- **Testing:** schema/migration constraints, USER/ADMIN contracts, legacy data preservation, copy, Topic deletion, Learning, Quiz, Personal Vocabulary and real-stack regression coverage.
- **Documentation after implementation:** synchronize `DATABASE.md`, `API_SPEC.md`, `ARCHITECTURE.md`, `UI_UX_SPEC.md`, `FEATURE_STATUS.md` and any active project overview statements. Historical specs remain intact with supersession traceability.
- **Security:** no authentication, authorization, ownership or visibility boundary changes.

## 13. Supersession

Upon HUMAN approval, this SPEC supersedes these specific prior Vocabulary Set V1 rules:

- “Every Set belongs to exactly one Topic.”
- Required `topic_id` on USER Personal Set create.
- USER ability to patch `topic_id` on a Personal Set.
- Copying the source Topic into a new Personal Set.
- A non-null Topic object for every Learning Set response.

All other approved Topic V1, Vocabulary Set V1, Personal Vocabulary, Learning and Quiz rules remain in force unless explicitly changed above.

## 14. Open Questions

None. The product decisions required for PLAN are explicit in this SPEC.

## 15. Approval Gate

This SPEC requires HUMAN review and approval before PLAN, TASK, migration or implementation work begins.
