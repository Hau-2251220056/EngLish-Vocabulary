# SPEC: Personal Vocabulary V1 — Private Capture and Set Reuse

**Feature status:** `TODO` — SPEC revised/finalized draft

**SPEC status:** `HUMAN APPROVED`

**Implementation authorized:** `NO`

## 1. Objective

Personal Vocabulary V1 allows an authenticated `USER` to capture owner-private English Vocabulary, add those identities to owned private Vocabulary Sets, reuse them across owned private Sets, and learn them through existing Flashcard and Quiz flows.

Canonical Vocabulary and USER-private Vocabulary are independent scopes. Matching spelling helps discovery but does not define identity. The exact `vocabulary_id` selected through a Set Item determines learning content and Learning Progress.

This SPEC defines observable product behavior only. It does not authorize or select a schema, migration, endpoint, transaction or implementation.

## 2. Existing Context and Required Extension

- `VOCABULARY` is currently global, has no ownership/source/visibility field, and has global PostgreSQL `LOWER(word)` uniqueness.
- Canonical Vocabulary is an ADMIN-managed `VOCABULARY -> VOCABULARY_MEANING -> VOCABULARY_EXAMPLE` aggregate.
- Every valid Vocabulary has one or more Meanings. Each Meaning requires `part_of_speech` and `meaning_vi`; context, CEFR and Examples are optional.
- Private Sets are owner-scoped. Ordered Set Items reference exact Vocabulary IDs and prevent the same ID appearing twice in one Set.
- Flashcard and both Quiz V1 types traverse ordered Set Items. Progress is identified by `(user_id, vocabulary_id)`, not Set, spelling or Meaning.
- Removing a Set Item does not delete Progress.

Personal Vocabulary V1 extends these completed capabilities. Current global word uniqueness cannot represent the approved coexistence rules and requires a later approved data-model change. No such change is authorized here.

## 3. Vocabulary Identity Model

### 3.1 Canonical Vocabulary

- Canonical Vocabulary is global/system-owned and remains under existing ADMIN authority.
- USER cannot mutate canonical Vocabulary.
- Canonical Vocabulary may be reused in owned private Sets.
- System Sets may contain canonical Vocabulary only.

### 3.2 USER-Private Vocabulary

- Every private Vocabulary belongs to exactly one USER.
- Only its owner may discover, read, update, reuse or add it to an owned private Set.
- This feature grants ADMIN no new private-Vocabulary authority.
- Private Vocabulary cannot enter a System Set or another USER's Set.

### 3.3 Independent Same-Headword Identities

Canonical and private Vocabulary are independent learning identities. Canonical existence never blocks private creation. One USER may intentionally own multiple private identities with the same spelling, including identities with different Meanings or parts of speech.

For example, canonical `book / noun / sách`, private `book / verb / đặt chỗ`, and another private `book / noun / quyển sách` may coexist. The system must not merge, reject or substitute identities solely because normalized spelling matches. Independent content and Progress require separate identities.

## 4. Actors and Authorization

### Guest

A Guest cannot search, create, read, update, reuse or directly reference private Vocabulary or access owned-private-Set management.

### USER

An authenticated USER may:

- search canonical and all own-private Vocabulary while editing an owned private Set;
- reuse a canonical or own-private result, including a zero-membership private result;
- intentionally create another private identity despite matching results;
- add canonical or own-private identities to an owned private Set;
- update private Vocabulary they own; and
- remove Set membership without deleting Vocabulary or Progress.

A USER may not mutate canonical Vocabulary; discover, read, update or reuse another USER's private Vocabulary; place private Vocabulary in another USER's Set or a System Set; or permanently delete private Vocabulary in V1.

Backend authentication, ownership and Set-kind checks are authoritative. Frontend guards/filtering are UX only.

### ADMIN

Existing ADMIN canonical Vocabulary and System Set authority remains intact. No new discovery, read, update, delete or moderation authority over USER-private Vocabulary is granted. Future moderation requires separate approval.

## 5. Scope

### In Scope

- Canonical/private identity distinction and owner-private creation/update.
- Reuse-first, context-rich search that permits intentional same-headword creation.
- Recovery/reuse of zero-membership private Vocabulary through Set-editor search.
- Reuse of one private identity across multiple owned private Sets.
- Private Sets mixing canonical and owner-private identities.
- Atomic observable create-private-plus-add outcome.
- Retry/concurrency protection for repeated execution of the same operation without headword uniqueness.
- Compatibility/regression coverage for affected canonical, Set, Flashcard, Progress, Quiz, TTS and authorization behavior.

### Out of Scope

- Permanent private Vocabulary deletion or a dedicated Personal Vocabulary Library.
- Cross-user sharing, Community publication or promotion into canonical.
- USER mutation/customization of canonical Vocabulary.
- Private Vocabulary in System Sets or ADMIN private-content moderation.
- Pronunciation upload/generation or USER-managed pronunciation URL.
- Progress per Meaning, Set or spelling; Meaning-level Quiz redesign.
- Broad visual redesign, unrelated routing/UI polish, new roles/types/services.
- Exact schema/index, endpoint, transaction, idempotency, locking or retry design.

## 6. Search, Reuse and Create Flow

1. USER searches by English headword from an owned private Set editor.
2. Search returns matching canonical Vocabulary and all matching private Vocabulary owned by that USER, including zero-membership identities.
3. Another USER's private Vocabulary never appears or affects observable results.
4. Results expose enough learning context to distinguish same-headword identities, including the relevant Meaning's `part_of_speech` and `meaning_vi`.
5. USER may reuse a canonical identity, reuse an own-private identity, or intentionally create another private identity.
6. Reuse adds that exact `vocabulary_id`, subject to exact-membership validation.
7. Creation persists the complete private aggregate and adds that exact identity to the current Set as one product operation.

Search is reuse-first to reduce accidental duplication, but reuse is never mandatory based only on spelling. Final visual design remains a UI decision.

## 7. Private Vocabulary Content Contract

| Field | Classification | Contract |
|---|---|---|
| `word` | Required | Trimmed, non-empty English headword; existing maximum 100 and display-casing behavior remain. Spelling does not establish identity. |
| `meanings` | Required | One or more Meanings; at least one must always remain. |
| `meaning.part_of_speech` | Required | Trimmed, non-empty free-form value; existing maximum 50 remains. |
| `meaning.meaning_vi` | Required | Trimmed, non-empty Vietnamese meaning; existing maximum 500 remains. |
| `phonetic` | Optional | Existing nullable maximum-100 behavior remains. |
| `meaning.context` | Optional | Existing nullable maximum-500 behavior remains. |
| `meaning.cefr_level` | Optional | Existing Meaning-only `A1`–`C2` values or absent. |
| `meaning.examples` | Optional | Zero or more; existing required `example_en`, optional `example_vi` and 1,000-character limits remain. |
| `pronunciation_url` | USER-unavailable | USER cannot provide/update it; private Vocabulary needs no stored audio. |
| ID, owner, scope/source/type/visibility, timestamps | Server-managed | USER cannot provide or mutate them. |

No new validation limit is introduced. Invalid, missing, whitespace-only or over-limit required content follows existing safe validation conventions.

## 8. Owner Update Contract

- Owner may update private `word`, `phonetic`, Meanings, `part_of_speech`, `meaning_vi`, context, CEFR and Examples.
- Owner may add/edit/remove Meanings provided at least one valid Meaning remains.
- Examples remain children of their Meaning.
- USER cannot modify ID, owner, scope/source/type/visibility, timestamps or `pronunciation_url`, and cannot update canonical Vocabulary.
- Changing a private word to spelling used by canonical or another own-private identity is allowed; spelling alone is not a conflict.
- Every Set referencing the same exact identity observes its updated content.
- Update never merges identities, transfers memberships or combines Progress.

Exact update request/endpoint design belongs to PLAN. Observable requirements are owner-only mutation, valid aggregate preservation and shared-identity propagation.

## 9. Set Membership and Ordering

- An owned private Set may mix canonical and private Vocabulary owned by that Set's owner.
- One private identity may be reused across multiple owned private Sets.
- The same exact `vocabulary_id` cannot occur twice in one Set.
- Distinct Vocabulary IDs with identical spelling may coexist in one private Set.
- Set Items retain explicit contiguous order and reference Vocabulary, never a selected Meaning.
- Add/remove/reorder remains backend-authoritative under the existing Set aggregate contract.
- Direct-ID validation enforces ownership and Set kind independently of picker UI.
- System Sets and their picker remain canonical-only.

System Set copy continues to reuse source canonical IDs. The resulting private Set may later receive the copying USER's private Vocabulary normally.

## 10. Remove and Zero-Membership Behavior

- The supported action is **Remove from Set**, not **Delete Vocabulary**.
- Removal deletes only the current Set membership.
- Other memberships, the exact Vocabulary and Progress remain unchanged.
- At zero memberships, private Vocabulary remains owned, stored, reusable and discoverable to its owner through private-Set picker/search.
- It remains hidden from other USERs and absent from Set-scoped learning until re-added.
- Permanent deletion and a dedicated Personal Vocabulary Library are unavailable in V1.

## 11. Create-Plus-Add Atomic Product Behavior

Creating private Vocabulary while adding it to a Set is one product operation: create the complete aggregate plus add its exact ID to the current owned private Set.

Either the complete operation succeeds or failure leaves no unintended partial aggregate or membership. Retry/concurrent repetition of the same USER operation must not accidentally duplicate that operation or leave partial state.

This does not impose headword uniqueness. Separate intentional operations may create same-headword identities. How an intentional operation is distinguished from retry, and the transaction/idempotency/locking mechanism, belong to PLAN.

## 12. Privacy, Concealment and Errors

- Backend data access is owner-scoped before returning private data or accepting references.
- Another USER's private Vocabulary is excluded from search and cannot affect counts, create choices or errors.
- Direct cross-user read/update/add/reuse/learning attempts use concealed resource behavior consistent with existing private Set, Learning and Quiz conventions.
- Responses do not expose owner, content, existence, constraints or internals.
- System Set writes reject private references without disclosing private content.
- Existing authentication, validation and safe error envelopes remain authoritative; no new global error architecture is introduced.
- Exact endpoint paths and feature-specific error-code names are deferred to PLAN.

## 13. Exact Learning Identity

Flashcard and Quiz resolve content through `Selected Set -> Set Item -> exact vocabulary_id -> exact Vocabulary -> relevant Meaning`. They never substitute, merge or borrow from another identity because spelling matches.

This applies to displayed content, pronunciation/TTS input, Quiz answer and question revision, and Learning Progress. A System Set's canonical `book` and a private Set's private `book` always use their respective exact content.

## 14. Meaning and Part-of-Speech Context

- Vocabulary may retain multiple Meanings.
- Existing deterministic primary-Meaning selection may continue when one Meaning is presented.
- Whenever Flashcard or either Quiz presents a Meaning, it also exposes that Meaning's `part_of_speech`.
- This applies to canonical and private Vocabulary.
- Display style such as `noun` versus `n.` remains a UI choice.
- No Meaning-level Progress or per-Meaning Quiz architecture is introduced.

Users needing independent content/Progress for different senses may create separate private identities.

## 15. Flashcard Compatibility

- Flashcard follows exact Set Items in persisted position order and consumes the exact referenced aggregate.
- Existing deterministic primary-Meaning behavior remains, and the presented Meaning includes its corresponding `part_of_speech`.
- Optional phonetic, context, CEFR and Examples retain existing behavior.
- Private Vocabulary requires no stored audio and may use existing native TTS fallback with the exact private `word`.
- It never borrows canonical pronunciation or content by spelling.
- Assessment mutates Progress for the exact ID.

Card navigation, Meaning selection, audio interaction and assessment events are not redesigned.

## 16. Quiz V1 Compatibility

### `VI_TO_ENGLISH`

- Uses the exact referenced Vocabulary's deterministic primary Meaning.
- Prompt exposes that Meaning's `meaning_vi` and `part_of_speech`; existing optional context/CEFR behavior may continue.
- The exact referenced `word` is the backend-only answer until evaluation.
- Existing normalization, feedback, revision protection and Progress mutation remain.

### `UNSCRAMBLE_WORD`

- Uses the same exact Vocabulary and deterministic primary Meaning.
- Prompt exposes that Meaning's `meaning_vi` and `part_of_speech`; existing optional context/CEFR behavior may continue.
- Tiles/slots derive from the exact referenced `word`, never a same-spelling identity.
- Existing Unicode, separator, deterministic shuffle/fallback, evaluation, feedback and Progress behavior remain.

Required word, Meaning, `meaning_vi` and `part_of_speech` make a valid private aggregate compatible with both types. Other optional content and stored audio are not prerequisites.

## 17. Learning Progress

- Progress remains `USER + exact vocabulary_id`.
- Canonical and private IDs have independent Progress despite identical spelling/content.
- Separate same-headword private IDs have independent Progress.
- Reusing the same private ID across Sets reuses Progress.
- Membership removal, including final removal, never resets/deletes Progress.
- No Progress identity by normalized word, Set or Meaning is introduced.
- Learning/Quiz re-authorizes the selected Set and exact current Item; removed/inaccessible Items follow existing changed-item/conflict behavior.

## 18. API and Data Capability Requirements

The future approved design must support canonical/private scope, exact private ownership, multiple same-headword identities, owner-isolated search/mutation, context-rich result projections, atomic create-plus-add, exact-ID membership validation, canonical-only System Sets and existing exact-ID Progress.

Later APIs must expose owner-aware picker search, explicit reuse, intentional create-plus-add and owner-only update. Clients never control authoritative ID, owner, scope or visibility.

This SPEC does not select fields, enums, tables, indexes, normalized columns, endpoints, HTTP shapes, transaction boundaries, idempotency tokens, locks or retry algorithms.

## 19. Business Rules

- **BR-01:** Canonical/private Vocabulary are independent identities; spelling never requires substitution/reuse.
- **BR-02:** Canonical Vocabulary remains global/ADMIN-managed and USER cannot mutate it.
- **BR-03:** Every private Vocabulary belongs to exactly one USER and is owner-isolated.
- **BR-04:** One USER may intentionally own multiple same-headword private identities.
- **BR-05:** Search is reuse-first, but USER chooses canonical reuse, own-private reuse or intentional creation.
- **BR-06:** One private ID may be reused across owned Sets; edits are visible through all exact-ID references.
- **BR-07:** Private Sets may mix canonical and own-private IDs, including distinct same-headword IDs.
- **BR-08:** The same exact ID occurs at most once in a Set; System Sets are canonical-only.
- **BR-09:** Create-plus-add is atomic as a product outcome and same-operation repetition causes no accidental duplicate/partial work.
- **BR-10:** Remove deletes membership only; zero-membership Vocabulary and Progress persist.
- **BR-11:** Learning content, answers, TTS input and Progress follow exact ID, never spelling.
- **BR-12:** Each presented Meaning in Flashcard/Quiz exposes its corresponding part of speech.
- **BR-13:** Progress remains per `(user_id, vocabulary_id)`, not spelling, Set or Meaning.
- **BR-14:** ADMIN receives no new private-content authority.

## 20. Edge Cases

- Missing, malformed, unsupported, whitespace-only or over-limit required input is safely rejected.
- Empty Meanings or removal of the final Meaning is rejected.
- Matching canonical/own-private spelling does not block create or headword update.
- Context-rich search distinguishes same-headword identities.
- Duplicate exact-ID membership is prevented; distinct same-spelling IDs may coexist.
- Cross-user private IDs are concealed and unusable; private IDs are rejected from System Sets.
- Failed create-plus-add leaves no unintended partial state.
- Same-operation retry avoids accidental duplication without prohibiting intentional same-headword creation.
- Zero-membership private Vocabulary remains owner-searchable and excluded from learning until re-added.
- Update affects all exact-ID references without merging identities/Progress.
- Membership changes during active learning use existing authorization/conflict behavior.

## 21. Acceptance Criteria

- **AC-01:** Canonical and private Vocabulary are independent; matching spelling causes no automatic substitution, merge or rejection.
- **AC-02:** Canonical `book` and multiple private `book` identities may coexist with distinct IDs/content.
- **AC-03:** One USER may intentionally create multiple same-headword private identities.
- **AC-04:** Guest has no private capability and USER access is restricted to own private Vocabulary/Sets.
- **AC-05:** Cross-user private Vocabulary is absent from search, unusable by direct ID and concealed.
- **AC-06:** Creation requires word and at least one Meaning with valid `part_of_speech` and `meaning_vi`; optional fields retain existing limits.
- **AC-07:** At least one valid Meaning always remains; invalid creation/final-Meaning removal is rejected.
- **AC-08:** Owner can update approved learning-content fields including headword but not system-managed fields or `pronunciation_url`.
- **AC-09:** Updating to an existing spelling is allowed and never merges identities, memberships or Progress.
- **AC-10:** Search returns canonical and own-private matches including zero-membership identities, with part of speech and meaning sufficient to distinguish them.
- **AC-11:** USER may choose canonical reuse, own-private reuse or intentional new creation; spelling never forces reuse.
- **AC-12:** Reused exact private identity is shared across owned Sets and its updates appear through all references.
- **AC-13:** Private Sets mix canonical/own-private IDs and preserve explicit order.
- **AC-14:** Same exact ID cannot repeat in a Set, while distinct same-headword IDs may coexist.
- **AC-15:** System Set picker/writes are canonical-only and reject private IDs.
- **AC-16:** System Set copy continues to reuse canonical IDs; copied private Set may later receive owner-private IDs.
- **AC-17:** Remove from Set affects only current membership; Vocabulary, other memberships and Progress remain.
- **AC-18:** Zero-membership private Vocabulary remains owner-searchable/reusable without a dedicated library.
- **AC-19:** Create-plus-add fully succeeds or leaves no unintended partial state.
- **AC-20:** Retry/concurrent repetition of the same operation creates no accidental duplicate operation, while intentional same-headword creation remains valid.
- **AC-21:** Flashcard/Quiz resolve exact `Set -> Item -> vocabulary_id` content without same-spelling substitution.
- **AC-22:** Flashcard presents each selected Meaning with corresponding `part_of_speech` for canonical/private Vocabulary.
- **AC-23:** `VI_TO_ENGLISH` uses the exact referenced primary Meaning/answer and exposes corresponding part of speech.
- **AC-24:** `UNSCRAMBLE_WORD` uses the exact referenced Meaning/word tile source and exposes corresponding part of speech.
- **AC-25:** Private Vocabulary without stored audio uses existing exact-word TTS fallback and never borrows canonical pronunciation/content.
- **AC-26:** Distinct IDs have independent Progress; reused same ID shares Progress; removal preserves Progress.
- **AC-27:** USER cannot mutate canonical Vocabulary through any private flow.
- **AC-28:** No hard delete, private library, sharing/publication, private System Set content, Meaning/Set Progress or ADMIN private moderation is added.
- **AC-29:** Existing safe envelopes cover validation, inaccessible resources, System Set protection, duplicate exact membership and unexpected failures without leakage.
- **AC-30:** Before DONE, regression verification covers canonical ADMIN CRUD/search, Set CRUD/editor/picker, System Set safety/copy, Flashcard, Progress, both Quiz types, TTS and authorization/privacy.

## 22. Existing-Feature Compatibility and Regression Obligation

This feature owns contract updates and regression verification at affected integration points before it can be `DONE`, without unrelated redesign:

- ADMIN canonical CRUD/search remains canonical-scoped.
- Set CRUD/editor/picker supports exact owner-private IDs while preserving ownership/order/exact-ID uniqueness.
- System Sets remain canonical-only and copy reuses canonical IDs.
- Flashcard uses exact content, displays Meaning part of speech and preserves assessments.
- Progress remains USER plus exact ID.
- Both Quiz types use exact identity and display Meaning part of speech.
- Native TTS fallback uses the exact private word without borrowing canonical content.
- Backend authentication, owner isolation and concealment remain enforced.

## 23. Dependencies and Documentation Impact

- **Database:** A future approved migration is required; none is authorized here.
- **Backend:** Vocabulary, picker/Set validation, Learning and Quiz data access need scope/ownership-aware extension.
- **Frontend:** Private Set editor needs context-rich reuse/create choices, private content create/update and explicit Remove from Set wording; pixel design is not fixed.
- **Testing:** Later approved work covers aggregate validity, privacy, exact-ID behavior, same-headword coexistence, atomic/retry outcomes and Section 22 regressions.
- **Documentation:** After the appropriate approvals, synchronize `DATABASE.md`, `API_SPEC.md`, `UI_UX_SPEC.md`, `ARCHITECTURE.md` where affected, and status at workflow gates. Do not present unimplemented behavior as current.

## 24. Open Questions / Human Review

None. This revised draft reflects the HUMAN-approved Product Contract. Exact schema/index, endpoint and transaction/idempotency/locking/retry mechanisms remain deferred to PLAN.

## Approval Gate

```text
PRODUCT DISCOVERY / CONTRACT: HUMAN APPROVED
PERSONAL VOCABULARY V1 SPEC: HUMAN APPROVED
PLAN / TASK / IMPLEMENT / TEST: NOT STARTED — NOT AUTHORIZED
```
