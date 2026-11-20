# SPEC: Vocabulary Set Metadata Refactor

**Status:** HUMAN APPROVED

**Branch:** `refactor/vocabulary-set-metadata`

**Base:** `aee4fc8a68d9ca374f6c808b2dd22e0ca10c122b`

## 1. Objective

Extend the existing Vocabulary Set aggregate with an independent primary CEFR level and persisted cover-image metadata. ADMIN and USER Set forms may manage the new metadata, Discovery may filter and render it, and System-to-Personal copy must preserve it without weakening current ownership, visibility, membership, Learning, Quiz, or Progress contracts.

The refactor adds the minimum backend-controlled Supabase Storage integration required for uploaded covers. It does not infer CEFR from member words and does not redesign existing Set screens.

## 2. Actors and permissions

- **Guest:** may read public System Set CEFR and cover metadata through existing public endpoints. Cannot upload, replace, remove, or copy a cover.
- **USER:** may set optional CEFR and cover metadata only on a Personal Set they own; may copy an accessible System Set using the approved metadata-copy rules.
- **ADMIN:** may set required CEFR and cover metadata on System Sets through existing ADMIN authorization. ADMIN does not gain ownership operations over Personal Sets.
- Supabase Storage credentials and all storage writes remain backend-only. Frontend role checks are presentation behavior, not the authorization boundary.

## 3. Scope

### 3.1 In scope

- Nullable Set-level CEFR persistence with values `A1`, `A2`, `B1`, `B2`, `C1`.
- Nullable `cover_image_url` and `cover_storage_key` Set fields.
- Required System Set CEFR and optional Personal Set CEFR at product/API validation boundaries.
- External HTTPS cover URLs and backend-authorized JPEG/PNG/WebP uploads.
- Supabase Storage object ownership, upload, replacement, removal, copy duplication, cleanup, and failure semantics.
- Existing System and Personal create/edit forms: CEFR selector, URL input, upload control, preview, and remove/reset action.
- Public/Personal detail and existing card-family metadata presentation.
- Discovery persisted covers, deterministic fallback, and Set-level CEFR filtering.
- My Sets card/detail integration without broad redesign.
- Safe nullable migration and legacy-row compatibility.
- Contract, unit, integration, browser, storage-adapter, and rollback verification.

### 3.2 Out of scope

- Automatic or word-derived CEFR inference.
- CEFR ranges, Set-level `C2`, or changes to Meaning-level CEFR.
- Changes to Learning/Quiz primary-Meaning selection.
- Image generation, cropping/editor UI, arbitrary user-selected transformations, original-file retention, or a CDN optimization pipeline. The single approved upload normalization/optimization pass remains in scope.
- SVG, GIF, remote-image proxying, or backend fetching of external cover URLs.
- Community, recommendations, ranking, bulk import, or a broad Discovery/My Sets redesign.
- A `cover_source_type` field; the approved two-field model is sufficient.

## 4. Current compatibility baseline

- System Sets remain ADMIN-created, public, Topic-required aggregates.
- Personal Sets remain USER-owned, private, and topicless for new writes.
- Exact Vocabulary IDs and one-based Item order remain authoritative.
- A copied Set remains a fresh independent private aggregate.
- Discovery remains a complete client-composed catalog with Topic/search filters and nine normal Sets per page.
- Public reads remain read-only. Learning, Quiz, Progress, authentication, and authorization behavior do not change.
- Existing deterministic Topic artwork remains the fallback when no usable cover is available.

## 5. Business rules

### 5.1 Set-level CEFR

- **BR-01:** `cefr_level` represents the intended difficulty of the whole Set and is independent of every `VOCABULARY_MEANING.cefr_level`.
- **BR-02:** Valid Set values are exactly `A1`, `A2`, `B1`, `B2`, and `C1`; `C2` and ranges are invalid.
- **BR-03:** The backend must never calculate, infer, or update Set CEFR from Set Items or Meanings.
- **BR-04:** New System Set creation requires CEFR. A System Set update must leave the resulting Set with a valid CEFR; therefore editing a legacy System Set with null CEFR requires the ADMIN to select one.
- **BR-05:** Personal Set CEFR is optional and may be cleared to null. Legacy Personal Sets remain usable and editable without adding CEFR.
- **BR-06:** Copying a System Set copies its exact Set-level CEFR value. A legacy source with null CEFR produces a Personal copy with null CEFR rather than a fabricated value.
- **BR-07:** Meaning-level CEFR remains nullable `A1`–`C2` and all existing Learning/Quiz selection behavior remains unchanged.

### 5.2 Cover source semantics

- **BR-08:** `cover_image_url` is the only URL rendered by clients.
- **BR-09:** `cover_storage_key = null` with a non-null URL means an externally owned image. A non-null storage key means an ELVocab-managed Supabase Storage object.
- **BR-10:** `cover_storage_key` cannot be supplied or changed by a client. It is generated and persisted only by the backend.
- **BR-11:** A null URL requires a null storage key. A non-null storage key requires a non-null URL. The service and database must preserve this invariant.
- **BR-12:** Removing a cover sets both fields to null. External resources are never deleted by ELVocab.
- **BR-13:** A broken, unavailable, or rejected rendered cover falls back to existing deterministic artwork and does not make the Set unusable.

### 5.3 Copy ownership

- **BR-14:** An external cover copies its URL and keeps `cover_storage_key = null`.
- **BR-15:** A managed cover is duplicated to a newly generated object key owned by the destination Set. Source and destination Sets never share ownership of one managed object.
- **BR-16:** The backend generates the destination Set ID before storage duplication so the object can be placed under the destination-owned prefix.
- **BR-17:** Managed-cover duplication must complete before the destination Set transaction commits. Storage-copy failure creates no destination Set. Database failure triggers compensating deletion of the newly copied object.
- **BR-18:** A failed compensation may leave only an unreferenced object, never a half-created database Set. It must be reported through structured operational logging and remain discoverable by its deterministic destination prefix for retry cleanup.

## 6. Data requirements and migration

Add nullable fields to `VOCABULARY_SET`:

| Field | Persistence | Contract |
|---|---|---|
| `cefr_level` | nullable text | null or one of `A1`, `A2`, `B1`, `B2`, `C1` |
| `cover_image_url` | nullable `VARCHAR(2048)` | public/display URL or null |
| `cover_storage_key` | nullable `VARCHAR(512)` | backend-generated managed-object key or null |

Database constraints must enforce the allowed Set CEFR values and the cover pairing invariant. Set-level CEFR must use its own constraint and must not alter the Meaning-level `A1`–`C2` constraint.

PostgreSQL stores Set metadata only. Actual uploaded image bytes must never be stored in PostgreSQL, Prisma fields, a `bytea`/blob column, or another database record. Supabase Storage holds the optimized managed image object; PostgreSQL holds only its display URL and server-owned storage key.

Migration rules:

1. Add all three columns as nullable.
2. Add constraints without assigning default or inferred values.
3. Existing rows remain null and readable.
4. Do not backfill historical CEFR or covers in this refactor.
5. Any later historical System Set backfill is a separate explicit HUMAN-approved data task.
6. Update Prisma projections and generated client through the normal migration workflow only after PLAN/TASK approval.

No new Set type, cover source type, image table, or automatic data rewrite is authorized by this SPEC.

## 7. Supabase Storage contract

### 7.1 Environment and bucket

Backend configuration must provide, through environment variables:

- Supabase project/storage base URL.
- A server-only credential capable of the required object operations.
- A dedicated Vocabulary Set cover bucket name.

Secrets must never be returned by an API, logged, placed in frontend environment variables, or committed. Startup/config validation must fail safely when an upload/copy/delete operation needs missing storage configuration; ordinary reads and external-URL-only behavior need not server-fetch Storage.

The bucket contract is:

- public read through the persisted display URL;
- no unauthenticated/client write or delete;
- backend-only write, copy, list-for-cleanup, and delete;
- environment-separated bucket or key namespace;
- object keys under a server-controlled prefix such as `<environment>/vocabulary-sets/<set-id>/<random-id>.<approved-extension>`.

Only keys matching the exact environment, feature prefix, and addressed Set ID are owned by that Set and eligible for deletion. Client-supplied keys must never drive a storage delete.

### 7.2 Upload validation

- Reject a request that exceeds the 5 MB transport/upload limit before decoding or other expensive image work.
- One file per request under the documented multipart field.
- Maximum incoming file size: 5 MB.
- Maximum incoming dimensions: 4096 × 4096.
- Allowed formats: JPEG, PNG, WebP.
- Unsupported: SVG, GIF, or any other format.
- Validate declared MIME and independently inspect actual file signature/content.
- Reject MIME/signature mismatch, malformed/truncated images, excessive dimensions, and multiple files.
- Client filename, extension, and MIME are not authoritative.
- The server chooses the extension/object key from validated content.
- Failed validation or optimization performs no storage or database mutation.

After validation, the backend must normalize and optimize the image before final managed storage:

1. Decode with bounded resource behavior appropriate to the selected backend library.
2. Preserve aspect ratio and resize only when needed so the longest edge is at most approximately 1600 pixels; never upscale a smaller image merely to reach that size.
3. Remove unnecessary embedded metadata, including EXIF metadata.
4. Encode one optimized managed image, preferably WebP at approximately quality 80–85.
5. Persist only the optimized object to the final Set-owned Supabase Storage key.
6. Do not retain the original upload after successful optimized persistence.

The exact image-processing library, exact resize kernel, final quality within the approved range, and encoding implementation are PLAN-level decisions. V1 produces one managed display image rather than an original plus derivative family.

Request-body limits must stop abnormally large input before buffering or processing can consume excessive memory, disk, or CPU. Decode limits must reject oversized dimensions and malformed/decompression-bomb-style input. Processing concurrency, temporary buffering, timeout, and cleanup behavior must be bounded for the selected library/runtime. Temporary bytes must be discarded after success or failure and must not become durable Set data.

External HTTPS images do not enter this pipeline. The backend does not download, decode, inspect, resize, compress, optimize, or proxy an external cover in V1. The browser renders the persisted external URL directly and uses deterministic fallback artwork on load failure.

### 7.3 Replacement lifecycle

For managed upload replacement:

1. Validate authorization and file.
2. Normalize and optimize the validated image using the approved bounded pipeline.
3. Store the optimized new object under the addressed Set prefix.
4. Persist the new URL/key atomically in the database.
5. If persistence fails, delete the new object as compensation and keep old metadata.
6. After persistence succeeds, delete the previous managed object.

For managed-to-external replacement:

1. Validate and persist the HTTPS URL with a null storage key.
2. Delete the prior managed object afterward.

For external-to-managed replacement, store and persist the new managed cover; no operation is performed against the former external URL.

Old-object cleanup failure occurs after the new authoritative metadata is safe. The primary mutation remains successful, its response reports `storage_cleanup: "retry_required"`, and the backend emits a structured non-secret cleanup error. A repeatable authenticated cleanup action must sweep only non-current objects under that Set's owned prefix. Successful cleanup reports `storage_cleanup: "complete"`. Cleanup failure must never roll back to stale metadata or delete the current object.

### 7.4 Removal and Set deletion

- Removing a managed cover first persists null cover metadata, then deletes non-current objects under the Set-owned prefix.
- Removing an external cover only clears metadata.
- Deleting a Set with managed storage must delete all objects under the exact Set-owned prefix before deleting the database Set.
- If pre-delete storage cleanup fails, Set deletion fails with a retryable safe error and the Set remains intact.
- If storage deletion succeeds but database deletion fails, the Set remains with its prior key and a potentially broken image; retry is idempotent and fallback artwork remains available.
- No global bucket sweep or deletion outside the addressed Set prefix is permitted.

## 8. API contract

Existing response envelopes remain `{ success: true, data }` and safe `{ success: false, error }`. Set summary/detail responses add:

```text
cefr_level: "A1" | "A2" | "B1" | "B2" | "C1" | null
cover_image_url: string | null
```

`cover_storage_key` is persistence-internal and is never exposed through public, USER, or ADMIN Set responses. Backend services load it only where storage ownership/lifecycle operations require it. API clients never infer source or authorize deletion from a key.

### 8.1 Existing JSON create/update routes

- ADMIN System create adds required `cefr_level` and optional external `cover_image_url`.
- ADMIN System PATCH accepts `cefr_level` and external `cover_image_url`; the resulting System Set must have valid CEFR.
- USER Personal create/PATCH accepts optional nullable `cefr_level` and optional external `cover_image_url`.
- Omitted PATCH fields remain unchanged.
- `cover_image_url: null` removes the current cover using the lifecycle rules.
- `cover_storage_key`, storage credentials, and object keys are rejected client fields.
- A non-null JSON cover URL always represents an external cover and results in a null storage key.

External URL validation:

- absolute `https:` URL only;
- reject `http:`, `data:`, `javascript:`, `file:`, credentials, malformed URLs, and overlong values;
- backend performs syntax/protocol validation only and must not fetch, resolve, probe, or proxy the URL;
- external images are not resized, compressed, optimized, or copied into Supabase Storage by ELVocab;
- redirects/content served later are a browser concern; broken rendering uses frontend fallback.

### 8.2 Upload endpoints

Add authenticated multipart endpoints using field name `cover`:

| Method/path | Access | Behavior |
|---|---|---|
| `POST /api/admin/vocabulary-sets/:setId/cover` | ADMIN | Upload/replace System Set cover |
| `DELETE /api/admin/vocabulary-sets/:setId/cover` | ADMIN | Remove System Set cover |
| `POST /api/my/vocabulary-sets/:setId/cover` | owner USER | Upload/replace owned Personal Set cover |
| `DELETE /api/my/vocabulary-sets/:setId/cover` | owner USER | Remove owned Personal Set cover |
| `POST /api/admin/vocabulary-sets/:setId/cover/cleanup` | ADMIN | Retry owned-prefix orphan cleanup |
| `POST /api/my/vocabulary-sets/:setId/cover/cleanup` | owner USER | Retry owned-prefix orphan cleanup |

Upload/remove returns the updated Set representation plus response metadata:

```text
meta.storage_cleanup: "complete" | "retry_required"
```

Cleanup returns the current Set plus `storage_cleanup: "complete"`, or a safe retryable storage error. Cleanup must preserve the current referenced object.

File upload during Set creation is a deliberate two-step UI/API flow: first create the Set through the existing JSON endpoint, then upload against its server-returned ID. If upload fails, the valid Set remains created without a cover; the UI must say that the Set was created but cover upload failed and permit retry. It must not resubmit or duplicate the Set.

### 8.3 Copy route

`POST /api/vocabulary-sets/:systemSetId/copy` keeps its existing route and `201` response. It copies CEFR and applies BR-14 through BR-18 for the cover. A managed-cover storage failure returns a safe error and creates no destination Set.

### 8.4 Error categories

Use safe project envelopes and distinguish at least:

- invalid CEFR / URL / multipart structure;
- unsupported media type;
- file too large;
- invalid image content or excessive dimensions;
- Set not found/concealed owner mismatch;
- storage unavailable/upload/copy failure;
- storage cleanup failure or retry required;
- existing authentication/authorization failures;
- safe internal persistence failure.

No response or log may expose credentials, signed authorization headers, raw provider errors, or unrelated object keys.

## 9. Frontend UX contract

### 9.1 Shared form behavior

- CEFR uses a labelled native/select-style control with explicit values.
- Cover section offers mutually exclusive effective sources: external URL or one selected upload.
- Selecting a file supersedes an unsaved URL; entering/committing an external URL supersedes an unsaved file.
- Preview uses the pending selection first, otherwise persisted URL, otherwise deterministic fallback.
- File preview uses a local object URL only for preview and revokes it when replaced, removed, or unmounted.
- Remove/reset clearly distinguishes clearing an existing cover from discarding an unsaved selection.
- Loading, validation, upload progress/pending, cleanup-warning, success, retry, broken-preview, and disabled states are accessible.
- File input accepts JPEG/PNG/WebP hints, while backend validation remains authoritative.
- Preview image has appropriate alt behavior and a broken-image fallback without repeated error loops.

### 9.2 ADMIN System Set form

- CEFR is visibly required.
- Existing Topic/name/description/items behavior remains unchanged.
- Create with a file performs one Set create followed by one cover upload.
- Edit of a legacy null-CEFR System Set requires selection before saving any edit.

### 9.3 Personal Set form

- CEFR is optional and clearable.
- Existing name/description and membership behavior remains unchanged.
- Old Personal Sets remain editable and usable with null CEFR and no cover.

## 10. Discovery and Set presentation

- Discovery cards render `cover_image_url` when present and fall back to current deterministic Topic artwork when absent or when image loading fails.
- Add client-side Set CEFR filters for `A1`, `A2`, `B1`, `B2`, and `C1` only after the complete catalog load.
- CEFR filtering composes with existing search and Topic filtering before pagination.
- Any search, Topic, or CEFR filter change resets to page 1; invalid pages clamp safely.
- Featured previews remain excluded from normal pagination.
- Normal pagination remains nine Sets per page and page changes make no API requests.
- Null-CEFR legacy Sets remain discoverable under no CEFR filter and are excluded from a specific CEFR filter.
- Public and Personal detail may show the cover and CEFR within their existing header/metadata family.
- My Sets may show cover and CEFR on existing cards/details without changing navigation, actions, ownership, or page information architecture.

## 11. Failure and rollback matrix

| Operation/failure | Required outcome |
|---|---|
| Invalid external URL | Reject before DB/storage mutation |
| Invalid upload | Reject before storage/DB mutation |
| Validation or optimization fails | Persist no cover metadata or managed object; remove temporary bytes and preserve the prior cover |
| Optimized storage upload fails | Persist no new cover metadata; preserve the prior cover and discard temporary/original bytes |
| New upload succeeds, metadata persistence fails | Keep old metadata; compensate by deleting new object |
| New metadata persists, old-object deletion fails | New cover remains authoritative; report retry-required cleanup; never delete current object |
| Managed copy duplication fails | No destination Set |
| Managed copy DB transaction fails | No destination Set; compensate copied object |
| Copy compensation fails | No destination Set; structured orphan-cleanup evidence retained by deterministic prefix |
| Managed cover removal cleanup fails | Null metadata remains authoritative; report retry-required cleanup |
| Pre-delete managed cleanup fails | Do not delete Set; return retryable error |
| DB Set deletion fails after storage deletion | Set remains; fallback may render; retry remains idempotent |
| External image breaks in browser | Show deterministic fallback; no backend fetch |

## 12. Acceptance criteria

- **AC-01:** Schema accepts null legacy metadata and rejects invalid non-null Set CEFR or invalid cover field pairing.
- **AC-02:** New System Set create and any System Set edit require a valid `A1`–`C1` Set CEFR.
- **AC-03:** Personal Set CEFR is optional, clearable, and independent from Meaning CEFR.
- **AC-04:** No workflow infers Set CEFR from Vocabulary or Meaning data.
- **AC-05:** Public, ADMIN, and owner USER reads expose the approved Set metadata without changing visibility rules.
- **AC-06:** External cover writes accept valid credential-free HTTPS URLs, reject forbidden URL forms, and never server-fetch them.
- **AC-07:** Upload rejects oversized input before expensive processing, accepts only verified JPEG/PNG/WebP files no larger than 5 MB or 4096 × 4096, and rejects spoofed MIME/signature input, malformed images, SVG, and GIF.
- **AC-08:** Guest, USER non-owner, and wrong-role upload/remove/cleanup attempts are rejected by backend authorization.
- **AC-09:** Managed replacement persists the new cover before old-object deletion and safely compensates a failed persistence write.
- **AC-10:** Cleanup failures are observable, retryable, scoped to the addressed Set prefix, and never silently delete the current or unrelated objects.
- **AC-11:** Set deletion removes only its managed objects; external URLs are never deleted.
- **AC-12:** System copy preserves CEFR; copies external URLs without a key; duplicates managed objects to an independent destination-owned key.
- **AC-13:** Managed-copy failure creates no destination Set or partial membership aggregate.
- **AC-14:** Create-with-upload failure leaves exactly one usable Set without a cover and offers upload retry without duplicate Set creation.
- **AC-15:** ADMIN and Personal forms provide accessible CEFR, URL, file, preview, remove, pending, error, cleanup-warning, and retry states.
- **AC-16:** Old null-metadata rows remain readable; old Personal Sets remain normally usable/editable.
- **AC-17:** Discovery cover fallback works for absent and broken images.
- **AC-18:** Discovery CEFR combines with complete-load search/Topic filtering, resets/clamps pagination, retains nine normal Sets per page, and performs no request on page changes.
- **AC-19:** My Sets and detail integrations remain within existing card/detail architecture without broad redesign.
- **AC-20:** Learning, Quiz, Progress, Item identity/order, ownership, visibility, and public read-only regressions remain green.
- **AC-21:** Storage adapter tests use mocks/fakes; guarded integration uses dedicated TEST configuration/bucket namespace and cleans only run-owned objects/data.
- **AC-22:** Documentation synchronizes database, API, architecture, UI/UX, environment, and feature status contracts after verified implementation.
- **AC-23:** PostgreSQL stores no uploaded image bytes; the managed object in Supabase Storage is a single optimized output with aspect ratio preserved, longest edge at most approximately 1600 pixels, unnecessary metadata stripped, and preferred WebP quality approximately 80–85.
- **AC-24:** Validation, decoding, optimization, buffering, concurrency, timeout, and temporary-file/memory handling are bounded so abnormal input cannot cause unbounded memory, disk, or CPU use.
- **AC-25:** External HTTPS covers bypass all backend download and optimization behavior and continue to render directly with deterministic browser fallback.

## 13. Testability requirements

Required coverage includes:

- schema/check/migration compatibility and legacy null rows;
- backend normalization, allowlists, CEFR and URL validation;
- image signature, MIME, size, dimension, and format validation;
- optimized-output format, dimensions, aspect ratio, metadata stripping, size-oriented encoding, original non-retention, and PostgreSQL no-blob guarantees;
- request-limit, decode-limit, processing-concurrency, timeout, temporary-resource cleanup, and malformed/decompression-bomb-style input behavior;
- storage key scoping and adapter behavior without real production credentials;
- upload/replacement/removal failure ordering and compensation;
- external and managed copy semantics, including no half-created copy;
- deletion and cleanup retry behavior with unrelated-object preservation;
- frontend service response parsing and multipart requests;
- ADMIN/Personal form validation, preview lifecycle, retry, and accessibility;
- Discovery cover fallback, CEFR filter composition, nine-per-page pagination, and no-request page changes;
- public/owner/non-owner/role authorization;
- existing Set, Learning, Quiz, Progress, and copy regressions;
- guarded TEST-only real-stack/storage verification with explicit environment safety checks.

Tests must not access or mutate Main/Preview/Production databases or storage buckets and must never globally clear a shared TEST bucket/database.

## 14. Documentation and impact

Implementation will require synchronized updates to:

- `docs/DATABASE.md`
- `docs/API_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/UI_UX_SPEC.md`
- `docs/FEATURE_STATUS.md`
- environment/example deployment documentation, without real credentials

Primary implementation areas will include Prisma schema/migration, Vocabulary Set repository/service/controller/routes, a minimal storage adapter/config boundary, frontend Set service/forms, Discovery catalog/cards/filtering, Set details, fixtures, and affected tests. Exact files and dependency selection belong to PLAN.

## 15. Mandatory STOP conditions

Stop for HUMAN review before implementation expands to any of the following:

- a `cover_source_type`, image/blob table, cleanup-job table, queue, CDN, proxy, derivative family, original-retention store, or transformation pipeline beyond the single approved normalization/optimization pass;
- a storage provider other than Supabase Storage;
- public/client-side storage write credentials;
- automatic CEFR inference or historical default/backfill;
- a change to ownership, visibility, Meaning CEFR, Learning, Quiz, Progress, or Discovery pagination contracts;
- an inability to enforce signature/dimension validation with the approved dependency boundary;
- a copy design that shares one managed object between independently owned Sets;
- any schema/API behavior materially different from this SPEC.

## 16. Open questions

None. Implementation-level library choice, exact environment variable names, and internal adapter organization may be finalized in PLAN provided they preserve this contract and add no broader infrastructure.
