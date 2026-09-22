# SPEC: Vocabulary V1

**Feature status:** `TODO`

**SPEC status:** `APPROVED`

**Human approval:** `APPROVED` with the complete-replacement nested PATCH clarification.

**Implementation authorized:** `NO`

## 1. Objective

Deliver the first Vocabulary capability as an ADMIN-managed catalog. An ADMIN can create, inspect, search, update and delete a Vocabulary aggregate with its normalized Meanings and Examples. Vocabulary V1 establishes durable vocabulary data for future Vocabulary Set, Flashcard and learning work without implementing those domains.

The future conceptual direction remains:

```text
Topic
  -> Vocabulary Set
  -> Vocabulary
      -> Meaning
          -> Example
```

Vocabulary V1 does not provide a standalone public Vocabulary catalog, Guest/USER discovery, Vocabulary Set membership, or learning activity.

## 2. Existing Context and Reconciliation

- `docs/FEATURE_STATUS.md` records Vocabulary Management, Multiple Meanings, Context / Example, Search and Pronunciation Information as `TODO`; no Vocabulary implementation exists.
- The current Prisma schema materializes `USER`, `AUTH_SESSION` and `TOPIC` only. It contains no Vocabulary-related model, route, service, frontend page or test.
- Current persistence identifiers are UUID strings. V1 uses UUID strings for every Vocabulary aggregate identifier and API path parameter.
- `docs/DATABASE.md` contains an older draft `VOCABULARY.difficulty_level`; the approved V1 direction replaces it with optional `VOCABULARY_MEANING.cefr_level`.
- Existing API examples use numeric identifiers and describe conditional Guest/USER reads. They do not apply to this ADMIN-only V1 and require synchronization after approval before implementation.
- Existing API examples sometimes show Examples at Vocabulary level. V1 persists and returns each Example under its owning Meaning; a Vocabulary detail nests its Meanings, each with Examples.

## 3. Actors and Authorization

- **Guest:** Has no Vocabulary V1 route or API access.
- **USER:** Has no Vocabulary V1 route or API access.
- **ADMIN:** Can list, client-search, view, create, update and delete Vocabulary aggregates.

Every V1 API operation is authenticated and backend-authorized for `ADMIN`. Frontend route guards and navigation visibility are UX only; they do not replace existing session authentication and role middleware. No role is added.

## 4. Scope

### In Scope

- Persist `VOCABULARY`, `VOCABULARY_MEANING` and `VOCABULARY_EXAMPLE` with the approved UUID relationships.
- ADMIN-only aggregate list, detail, create, update and delete operations.
- At least one Meaning for every persisted Vocabulary; zero or more Examples for each Meaning.
- Optional phonetic and model-pronunciation URL metadata storage only.
- Backend validation, word normalization, case-insensitive word uniqueness, safe errors and transaction-safe nested writes.
- ADMIN UI in the existing authenticated App Layout with client-side search, aggregate form editing, loading/empty/error states and delete confirmation.
- Focused database, backend, authorization, frontend, accessibility and regression verification in later stages.

### Out of Scope / Deferred

- Guest or USER Vocabulary list, detail, catalog search or discovery.
- `TOPIC.topic_id`, `VOCABULARY.topic_id`, `VOCABULARY_SET`, `VOCABULARY_SET_ITEM`, Topic discovery, set visibility or ownership.
- Flashcards, learning sessions, Learning Progress, SRS, review queues, Quiz, XP, Level, Streak, Achievement and Dashboard changes.
- Pronunciation Practice, audio hosting/generation, user recordings, scoring, history or external pronunciation services.
- A `difficulty_level` field, CEFR on Vocabulary or Topic, a part-of-speech enum/catalog, synonyms, images, tags, import/export, AI, soft delete and audit history.
- Pagination and server-side search/filter. V1 search is client-side over an unpaginated ADMIN list.

## 5. Data Requirements and Rules

### 5.1 Vocabulary Aggregate

| Entity / field | Requirement |
|---|---|
| `VOCABULARY.id` | UUID primary identifier. |
| `word` | Required string; trim before validation/persistence; non-empty after trim; maximum 100 characters; unique case-insensitively; preserve the submitted reasonable display casing after trim. |
| `phonetic` | Optional string; maximum 100 characters; `null` means absent. |
| `pronunciation_url` | Optional URL string; maximum 2048 characters; `null` means absent. V1 stores it only and does not fetch, validate reachability or expose an audio feature. |
| timestamps | `created_at` and `updated_at`. |
| `VOCABULARY_MEANING.id` | UUID primary identifier. |
| `vocabulary_id` | Required UUID foreign key to `VOCABULARY`. |
| `part_of_speech` | Required string; trim; non-empty; maximum 50 characters. V1 uses a free-form, display-preserving string rather than an enum or separate table. |
| `meaning_vi` | Required string; trim; non-empty; maximum 500 characters. |
| `context` | Optional string; maximum 500 characters; `null` means absent. |
| `cefr_level` | Optional value: exactly `A1`, `A2`, `B1`, `B2`, `C1` or `C2`; `null` means absent. It belongs to Meaning only. |
| Meaning timestamps | `created_at` and `updated_at`. |
| `VOCABULARY_EXAMPLE.id` | UUID primary identifier. |
| `meaning_id` | Required UUID foreign key to `VOCABULARY_MEANING`. |
| `example_en` | Required string; trim; non-empty; maximum 1,000 characters. |
| `example_vi` | Optional string; maximum 1,000 characters; `null` means absent. |
| Example timestamp | `created_at`. |

`VOCABULARY 1:N VOCABULARY_MEANING` and `VOCABULARY_MEANING 1:N VOCABULARY_EXAMPLE`. A Vocabulary must result in one or more Meanings; a Meaning may result in zero or more Examples. Examples cannot belong directly to Vocabulary.

### 5.2 Validation, Uniqueness and Integrity

- Backend validation is authoritative; frontend validation is UX only.
- Whitespace-only required strings are invalid after trimming. Optional text is not silently transformed into a different value; explicit `null` clears an optional field on update.
- A PostgreSQL functional unique index on `LOWER(word)` is required as the concurrency-safe, case-insensitive uniqueness boundary. No `normalized_word` field or database extension is introduced.
- A duplicate create or rename, including concurrent writes, returns a stable duplicate-word error rather than raw database details.
- Identifier syntax, malformed bodies, unsupported fields, invalid nested ownership/IDs, validation failures, duplicates, missing Vocabulary, unauthenticated and non-ADMIN requests return safe errors. Responses and logs must not expose internals, credentials or session values.

### 5.3 Aggregate Write and Deletion Semantics

- Create receives one complete Vocabulary aggregate and must include a non-empty `meanings` array. Each Meaning may include an `examples` array, including `[]`.
- Create and every nested aggregate update are atomic: either the Vocabulary and all requested children persist, or no requested change persists.
- `PATCH` supports only `word`, `phonetic`, `pronunciation_url` and `meanings`. Omitted supported top-level fields remain unchanged. An empty body or a body without a supported editable field is `400 VALIDATION_ERROR`.
- A supplied optional `phonetic` or `pronunciation_url` string is validated and saved; explicit `null` clears it. `word: null` is invalid.
- If `meanings` is supplied in a PATCH, it is the complete desired Meaning collection and must be a non-empty array. Each submitted Meaning must include its full `examples` array (which may be empty).
- Existing Meaning and Example IDs are stable: an ID may be used only for an existing child of the addressed aggregate and retains that child. A child without an ID is created. A supplied unknown, duplicate, cross-aggregate or malformed child ID is invalid.
- The ADMIN edit workflow must load the complete current Vocabulary aggregate before editing. When its frontend submits `meanings`, it must submit the complete desired current Meaning collection; every retained submitted Meaning must include its complete desired Example collection.
- Omission from a supplied replacement collection intentionally means deletion: omitted existing Meanings are deleted with their owned Examples, and omitted existing Examples of a retained Meaning are deleted. Backend stable-ID ownership validation and atomic transaction requirements remain authoritative.
- V1 provides no granular Meaning or Example CRUD endpoint; no child is independently writable outside the Vocabulary aggregate routes.
- Deleting a Vocabulary deletes its owned Meanings and Examples as one aggregate operation. V1 has no Vocabulary Set, progress, quiz or other external reference, so it introduces no external-reference deletion rule or fabricated restriction test.
- Any future feature that introduces an external Vocabulary reference must define its own approved foreign-key/delete policy and integration tests. V1 does not pre-decide cascade, restrict or reassignment for those future references.

## 6. API Requirements

All endpoints are ADMIN-only and use UUID string `:vocabularyId` parameters.

| Method / path | Success | Requirement |
|---|---:|---|
| `GET /api/admin/vocabulary` | `200` | Returns an unpaginated list of Vocabulary summaries; no server search/filter. |
| `GET /api/admin/vocabulary/:vocabularyId` | `200` | Returns the complete Vocabulary aggregate with nested Meanings and Examples. |
| `POST /api/admin/vocabulary` | `201` | Creates one valid complete aggregate atomically. |
| `PATCH /api/admin/vocabulary/:vocabularyId` | `200` | Applies the approved aggregate PATCH semantics atomically. |
| `DELETE /api/admin/vocabulary/:vocabularyId` | `204` | Deletes the aggregate; no response body. |

Success bodies use `{ "success": true, "data": ... }`, except `204`. A full aggregate has this shape:

```json
{
  "id": "uuid",
  "word": "book",
  "phonetic": "/bʊk/",
  "pronunciation_url": null,
  "created_at": "ISO-8601 timestamp",
  "updated_at": "ISO-8601 timestamp",
  "meanings": [
    {
      "id": "uuid",
      "part_of_speech": "noun",
      "meaning_vi": "quyển sách",
      "context": null,
      "cefr_level": "A1",
      "created_at": "ISO-8601 timestamp",
      "updated_at": "ISO-8601 timestamp",
      "examples": [
        {
          "id": "uuid",
          "example_en": "This is a book.",
          "example_vi": "Đây là một quyển sách.",
          "created_at": "ISO-8601 timestamp"
        }
      ]
    }
  ]
}
```

Errors use `{ "success": false, "error": { "code": "...", "message": "safe message" } }`.

| Condition | Status | Code |
|---|---:|---|
| Invalid UUID, body, field, nested graph or validation failure | `400` | `VALIDATION_ERROR` |
| Missing Vocabulary | `404` | `VOCABULARY_NOT_FOUND` |
| Case-insensitive duplicate word | `409` | `VOCABULARY_WORD_ALREADY_EXISTS` |
| Missing or invalid session | `401` | existing `AUTHENTICATION_FAILED` |
| Authenticated non-ADMIN | `403` | existing `FORBIDDEN` |
| Unexpected failure | `500` | `INTERNAL_SERVER_ERROR` |

## 7. ADMIN UI and UX Requirements

- Add only an implemented `/admin/vocabulary` route beneath the existing `ProtectedRoute`, ADMIN UX guard and `AuthenticatedShell`; do not create a second authenticated shell.
- Show the ADMIN Vocabulary navigation destination only to ADMIN users and only with the real route. USERs are redirected to the existing safe authenticated destination; direct API requests remain backend-protected.
- Provide a list, client-side word search, detail/view, create, edit and delete workflow. The unpaginated list must provide an accessible loading, empty and error state.
- The create/edit form supports Vocabulary metadata, one-or-more Meaning editors and zero-or-more nested Example editors. It exposes field-level validation and safe server errors.
- Before editing, the form loads the complete Vocabulary aggregate. A save that includes `meanings` submits the complete desired Meaning and retained-Meaning Example collections, so an intentionally omitted child is removed according to the aggregate replacement contract.
- The delete flow identifies the Vocabulary, explains that its owned Meanings and Examples are removed, provides cancel/confirm actions and prevents duplicate submission while pending.
- Preserve dashboard, logout, mobile drawer, existing Topic management and public Topic routes. Do not add a USER Vocabulary sidebar entry or public Vocabulary route in V1.

## 8. Acceptance Criteria

- **AC-01:** V1 materializes only `VOCABULARY`, `VOCABULARY_MEANING` and `VOCABULARY_EXAMPLE` for this feature, with UUID identifiers, approved fields and timestamps.
- **AC-02:** A Vocabulary has one or more Meanings; each Meaning belongs to exactly one Vocabulary; each Example belongs to exactly one Meaning and a Meaning may have zero or more Examples.
- **AC-03:** Create/update rejects missing, whitespace-only or over-limit required fields, invalid optional-field lengths, invalid CEFR values and invalid aggregate nested data.
- **AC-04:** `word` is trimmed, non-empty and unique case-insensitively, including safe handling of concurrent duplicate writes, while preserving reasonable display casing.
- **AC-05:** `part_of_speech` is required only on Meaning and is a validated free-form V1 string; `cefr_level` is optional and belongs only on Meaning.
- **AC-06:** ADMIN can create a complete valid Vocabulary aggregate atomically; failed aggregate creation leaves no partial Vocabulary, Meaning or Example data.
- **AC-07:** ADMIN can retrieve an unpaginated Vocabulary summary list and a complete nested aggregate detail, and can client-search the loaded list without server-side filtering or pagination.
- **AC-08:** ADMIN PATCH preserves omitted supported fields, clears optional top-level fields only with explicit `null`, rejects `word: null` and rejects an empty/unsupported-only body.
- **AC-09:** Nested PATCH retains valid submitted child IDs, creates no-ID children, safely rejects invalid child IDs, and applies supplied Meaning/Example collections atomically according to the replacement rules.
- **AC-10:** ADMIN deletion requires UI confirmation and deletes only the Vocabulary aggregate's owned Meanings and Examples; no Vocabulary Set, progress or other future reference behavior is created or claimed.
- **AC-11:** Every V1 endpoint rejects unauthenticated and non-ADMIN callers through existing backend authorization, independently of frontend navigation or guards.
- **AC-12:** API and UI safely handle invalid input, duplicates, invalid identifiers, not-found records, authentication/authorization failures and unexpected failures without exposing internals.
- **AC-13:** The ADMIN route and navigation reuse the existing authenticated App Layout without changing Authentication, Topic behavior, dashboard, logout or public routes.
- **AC-14:** V1 introduces no public/USER Vocabulary discovery, Topic link, Vocabulary Set model/item, learning, Flashcard, SRS, Quiz, XP, Streak, pronunciation practice, AI or unrelated dependency.

## 9. Dependencies, Documentation and Deferred Integration

- **Database:** Requires future Prisma models and a migration for the three approved aggregate entities, their owned foreign keys and case-insensitive word uniqueness only.
- **Backend:** Requires aggregate repository/service/controller/routes and existing ADMIN authorization integration; no new authentication or role system.
- **Frontend:** Requires an ADMIN management route/service/forms under the existing App Layout; no public Vocabulary view.
- **Future Vocabulary Set:** May later relate to Vocabulary through an approved set-item model. It must not create a direct Topic relation or alter this aggregate's current behavior without its own scope and delete-policy decisions.
- **Future learning:** Learning Progress remains per USER plus Vocabulary and independent of the set through which it is learned; no learning record is created by V1 catalog operations.

After approval and before implementation, synchronize the approved V1 contract in `docs/DATABASE.md`, `docs/API_SPEC.md`, `docs/UI_UX_SPEC.md` and `docs/FEATURE_STATUS.md` as applicable. This includes replacing the obsolete difficulty-level/numeric-id/public-read directions rather than silently implementing against them.

## 10. Open Questions / Human Review

No further product decision blocks this SPEC. The following are explicit V1 technical decisions for human review:

1. Field limits: word 100; phonetic 100; pronunciation URL 2048; part of speech 50; meaning/context 500; example English/Vietnamese 1,000 characters.
2. `part_of_speech` is a validated free-form string rather than an enum/table.
3. Nested PATCH uses complete replacement collections when `meanings` is supplied, preserving stable submitted child IDs and deleting omitted owned children atomically.
4. The ADMIN list is unpaginated and searched client-side in V1.

These decisions are approved for the next PLAN stage. They do not authorize implementation.

## Approval Gate

```text
SPEC STATUS: APPROVED
NEXT ALLOWED STAGE: PLAN
IMPLEMENTATION AUTHORIZED: NO
```
