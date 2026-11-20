# PLAN: Vocabulary Set Metadata Refactor

**Status:** HUMAN APPROVED

**Approved SPEC:** `docs/specs/VOCABULARY_SET_METADATA_REFACTOR_SPEC.md`

**Branch:** `refactor/vocabulary-set-metadata`

**Base:** `aee4fc8a68d9ca374f6c808b2dd22e0ca10c122b`

## 1. Summary

Extend the existing `VOCABULARY_SET` aggregate and its current REST/UI flows rather than creating a parallel Set system. Implementation proceeds from a backward-compatible nullable migration, through JSON metadata support, into an isolated Supabase Storage adapter and bounded image pipeline, and only then into form and read/display integration.

The plan selects:

- PostgreSQL nullable text/URL/key fields with explicit CHECK constraints;
- official `@supabase/supabase-js` for backend-only Storage operations;
- one public-read, server-write-only Vocabulary Set cover bucket/model shared by System and Personal Sets within each environment;
- route-scoped Multer memory storage with strict one-file/5 MiB limits;
- Sharp for signature-aware metadata/decode, bounded resize, metadata stripping, and WebP quality 82 output;
- dependency-injected fake Storage in normal automated tests and a separately guarded TEST bucket for real Storage verification.

No implementation begins until the dependency/configuration checkpoint is HUMAN approved.

## 2. Affected areas

- **Database:** nullable Set CEFR and cover metadata, independent CHECK constraints, no backfill/blob/index.
- **Backend:** Set repository/service/controller/routes, upload middleware, image processor, Storage adapter/config, lifecycle orchestration, copy compensation.
- **API:** Set projections and JSON fields; upload/remove/cleanup routes and safe error mappings.
- **Frontend:** Vocabulary Set service, ADMIN and Personal forms, shared cover controls, Set card/detail metadata, Discovery filter/fallback.
- **Tests:** schema, backend, adapter/processor, API, frontend unit/browser, guarded TEST DB/Storage, direct-Prisma and performance fixtures.
- **Documentation:** database, API, architecture, UI/UX, environment/deployment, feature status, recovery notes.

## 3. Existing code to reuse

- `backend/prisma/schema.prisma` and existing migrations — extend the materialized Set aggregate.
- `backend/src/repositories/vocabulary-set-repository.js` — extend summary/detail projections and transaction helpers; add internal storage-lifecycle projection.
- `backend/src/services/vocabulary-set-service.js` — retain authoritative allowlists, normalization, ownership, copy, and transaction orchestration.
- `backend/src/controllers/vocabulary-set-controller.js` — retain safe response/error delegation.
- `backend/src/routes/vocabulary-set-routes.js` — retain public/ADMIN/USER route and authorization boundaries; attach multipart parsing only to upload routes after auth middleware.
- `frontend/src/services/vocabulary-set-service.js` — extend existing Set client and response normalization.
- `frontend/src/vocabulary-sets/my-vocabulary-sets-page.jsx` — extend existing Personal modal and shared ADMIN editor without moving unrelated UI.
- `frontend/src/vocabulary-sets/admin-vocabulary-sets-page.jsx` — retain management/list/detail behavior.
- `frontend/src/topics/discovery-catalog.js` and `topic-list-page.jsx` — extend complete-load client filtering and existing card fallback.
- `frontend/src/vocabulary-sets/public-vocabulary-set-pages.jsx` and Set detail primitives — display metadata within current layouts.
- `backend/test/helpers/test-environment.js` — pattern for TEST-only configuration mapping and no-production fallback.
- Existing Set, Discovery, Learning, Quiz, Progress, copy, fixture-cleanup, and guarded integration suites — regression baseline.

## 4. Technical decisions

### 4.1 Database representation

Add nullable columns to `VOCABULARY_SET`:

| Column | Prisma/PostgreSQL | Constraint |
|---|---|---|
| `cefr_level` | `String? @db.Text` / `TEXT NULL` | `NULL` or `IN ('A1','A2','B1','B2','C1')` |
| `cover_image_url` | `String? @db.VarChar(2048)` / `VARCHAR(2048) NULL` | metadata only |
| `cover_storage_key` | `String? @db.VarChar(512)` / `VARCHAR(512) NULL` | key non-null implies URL non-null |

Use named CHECK constraints:

- `VOCABULARY_SET_cefr_level_check`
- `VOCABULARY_SET_cover_pair_check` enforcing `cover_storage_key IS NULL OR cover_image_url IS NOT NULL`

Do not create a Prisma/PostgreSQL enum, default, index, blob column, image table, source-type column, or backfill. HTTPS and key-prefix validity remain service rules because SQL checks cannot safely establish URL/object ownership.

### 4.2 Supabase Storage client

Choose official `@supabase/supabase-js` rather than hand-written REST:

- official upload, copy, list, remove, and public URL operations;
- centralized provider errors and easier dependency injection;
- avoids maintaining authorization headers, URL encoding, response parsing, and API-version details;
- works with small standard uploads well below Supabase's recommended large-file threshold.

Reject direct frontend SDK/storage access and S3 credentials. The backend creates one narrowly wrapped client; domain services depend on the wrapper, not Supabase APIs.

### 4.3 Bucket and delivery model

- One pre-provisioned public-read bucket dedicated to all Vocabulary Set covers per environment; System and Personal Sets use the same delivery and object-management model.
- No application-side bucket creation or policy mutation.
- Public delivery uses `getPublicUrl()` and persists that stable URL.
- All writes/list/copy/remove use the server-only service credential.
- Public bucket status grants read delivery only; no anonymous/client write policy.
- Personal Set API authorization still protects private Set data and mutations, but the cover object is a presentation asset accessible to anyone who possesses its public URL.
- Form/help and deployment documentation must warn that cover uploads are not appropriate for sensitive/private images.
- V1 has no private cover bucket, signed/expiring URL flow, or role-specific bucket split.
- Unique paths and `upsert: false`; never overwrite a current object path.

Exact environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_VOCABULARY_SET_COVERS_BUCKET`
- `SUPABASE_STORAGE_NAMESPACE` (for example `dev` or `production`)

Dedicated automated real-storage verification uses only:

- `TEST_SUPABASE_URL`
- `TEST_SUPABASE_SERVICE_ROLE_KEY`
- `TEST_SUPABASE_VOCABULARY_SET_COVERS_BUCKET`
- `TEST_SUPABASE_STORAGE_NAMESPACE`

`configureTestEnvironment()` must validate/map TEST names explicitly and reject missing, equal-to-production, or non-test bucket/namespace values. No TEST path may fall back to ordinary Supabase variables. Normal unit/API/browser CI uses a fake adapter and needs no provider credential.

Storage config is lazily required for managed upload/copy/delete/cleanup. Missing config does not prevent ordinary reads or external-URL-only writes, but managed operations fail safely with `503 COVER_STORAGE_UNAVAILABLE`.

### 4.4 Multipart handling

Choose current patched Multer 2.x, route-scoped only:

- `memoryStorage()` is acceptable because exactly one input is capped at 5 MiB and no original is retained;
- `single("cover")` after authentication/authorization middleware;
- limits: `fileSize = 5 * 1024 * 1024`, `files = 1`, `fields = 0`, `parts = 1`, bounded field/header settings supported by the selected version;
- MIME filter permits only `image/jpeg`, `image/png`, `image/webp` as an early hint; service-level signature/decode checks remain authoritative;
- reject unexpected fields/files and map Multer errors safely;
- never use global upload middleware, client filename, or client extension.

Multer was chosen over direct Busboy because it follows the existing Express middleware structure and provides maintained limit/error handling with less custom parser code. Its memory-storage warning is addressed by one-file, route-local, early size/parts limits plus bounded image concurrency.

### 4.5 Image processing

Choose Sharp:

- supports Node-API v9 runtimes including Node 22;
- prebuilt binaries for common Windows/Linux CI/deployment targets;
- native JPEG/PNG/WebP decode, metadata inspection, resize, and WebP encode;
- `limitInputPixels` and fail-on-invalid-input behavior support resource constraints;
- metadata is excluded unless explicitly retained.

Exact processing contract:

1. Multer rejects transport input over 5 MiB before processing.
2. Verify magic bytes for JPEG/PNG/WebP and require agreement with declared MIME.
3. Initialize Sharp with `limitInputPixels = 4096 * 4096`, reject malformed input, unsupported format, animation/multiple pages, zero/unknown dimensions, or either dimension above 4096.
4. Apply EXIF orientation before dimension-preserving output.
5. Resize inside `1600 × 1600`, `fit: inside`, `withoutEnlargement: true`.
6. Do not call metadata-retention methods; output WebP at quality `82`, one non-animated image.
7. Upload only the optimized Buffer as `image/webp`; release input/output references immediately afterward.

Resource bounds:

- application semaphore: at most 2 concurrent image processors per backend process;
- bounded waiting queue of 8; reject overflow with `503 COVER_PROCESSING_BUSY`;
- 15-second processing deadline; timeout returns a safe retryable failure and persists nothing;
- no disk temp file in the selected memory path, so there is no temp-directory lifecycle;
- do not log buffers, filenames, EXIF, provider credentials, or raw provider errors.

Sharp is preferred over pure-JavaScript codecs for mature format support, bounded native processing, smaller custom security surface, and cross-platform prebuilds. `jimp` is not selected due to weaker fit for the required format/resource pipeline; ImageMagick subprocesses are not selected due to deployment and command/process complexity.

### 4.6 New dependencies — mandatory checkpoint

Proposed backend production dependencies:

- `@supabase/supabase-js`
- current patched Multer 2.x
- Sharp

**STOP CHECKPOINT A:** Before modifying `package.json`/lockfiles or implementing Storage/image code, HUMAN must approve these dependencies, the public-read bucket model, exact environment contract, and bounded-memory approach. If deployment cannot install Sharp's required prebuilt binary, STOP rather than switching libraries or adding a subprocess tool silently.

## 5. Phase 1 — Schema and migration foundation

### Work

1. Add the three nullable Prisma fields and one forward-only migration with the two named CHECK constraints.
2. Generate the Prisma client through the repository's normal supported command.
3. Validate existing seven migrations plus the new migration against the dedicated TEST DB only.
4. Verify an old row with all-null metadata remains readable through public, ADMIN, and Personal projections.
5. Inventory and migrate direct-Prisma fixtures only where new assertions need explicit metadata; retain nulls where testing legacy compatibility is intentional.

Expected files:

- `backend/prisma/schema.prisma`
- new `backend/prisma/migrations/<timestamp>_add_vocabulary_set_metadata/migration.sql`
- generated Prisma client artifacts according to current repository convention
- schema/migration tests under existing Vocabulary Set/Personal Vocabulary suites

### Checkpoint

- Prisma schema validation PASS.
- Guarded TEST migration parity: eight migrations, none pending after preparation.
- Null legacy rows PASS; invalid CEFR/pairing rejected.
- Schema diff contains no Meaning, Learning, Quiz, ownership, Item, blob, default, or backfill changes.

**STOP CHECKPOINT B:** HUMAN reviews migration SQL and dedicated TEST evidence before backend contract implementation. Never apply or inspect migration state through an unguarded `.env` command.

## 6. Phase 2 — Backend JSON metadata contracts

### Repository

- Add CEFR and `cover_image_url` to public/API summary/detail selects.
- Keep `cover_storage_key` out of serialized projections.
- Add an internal Set lifecycle select containing the key for authorized mutation/copy/delete only.
- Permit caller-supplied destination UUID for compensated managed-copy creation.

### Service

- Extend System allowlists/normalizers with required `cefr_level` and optional `cover_image_url`.
- Extend Personal allowlists/normalizers with nullable/optional values.
- Validate Set CEFR independently from Meaning CEFR.
- Validate external URL via WHATWG `URL`: absolute HTTPS, no username/password, length ≤ 2048; perform no DNS/network call.
- Any non-null JSON cover URL clears the managed key; null requests removal lifecycle rather than arbitrary key mutation.
- System PATCH computes/reads resulting CEFR so legacy-null System edits cannot remain null.
- Extend copy metadata for CEFR and external covers while deferring managed cover copy to Phase 5.

### Controller/API

- Return `cefr_level` and `cover_image_url` through existing summaries/details/mutations.
- Never serialize `cover_storage_key`.
- Preserve existing envelopes and authorization.
- Represent post-persistence cleanup state through optional `meta.storage_cleanup` without weakening `data` validation.

### Checkpoint

- JSON-only CEFR/external URL create, patch, reads, and external-cover copy pass.
- Legacy null reads pass; Personal null edits pass; legacy System edits require CEFR.
- Unsupported client `cover_storage_key`, invalid protocols, credentials, C2/ranges, and unknown fields fail safely.
- No Storage dependency is needed to read or save a purely external cover unless replacing a managed cover that needs cleanup.

**STOP CHECKPOINT C:** HUMAN reviews the JSON/API compatibility checkpoint before upload routes or frontend contract consumption.

## 7. Phase 3 — Storage infrastructure

### Work

1. Add a small config loader that validates exact variables only when managed operations are invoked.
2. Add `backend/src/storage/vocabulary-set-cover-storage.js` (final filename may follow repository naming) exposing only:
   - upload optimized bytes to a new key;
   - copy one validated owned key to a new destination key;
   - list a Set-owned prefix;
   - remove exact validated keys;
   - derive/get a public URL.
3. Centralize key construction and parsing; every operation receives server-derived Set IDs and rejects paths outside `<namespace>/vocabulary-sets/<set-id>/`.
4. Wrap provider errors into internal typed errors without leaking provider details.
5. Inject the adapter into the Set service. Unit/API tests inject a deterministic fake; no network mocking is scattered across domain tests.
6. Add TEST configuration guard for optional real-storage verification; never auto-create or empty a bucket.

### Checkpoint

- Adapter unit tests prove unique keys, `upsert: false`, public URLs, exact-prefix copy/list/delete, unrelated-key rejection, provider error mapping, and no secret output.
- Fake-adapter backend tests pass without Supabase credentials.
- If a dedicated TEST bucket is unavailable or cannot be distinguished safely, mark real-storage verification BLOCKED and STOP before any real provider call.

## 8. Phase 4 — Image processing and upload API

### Processing module

- Add one image processor responsible only for signature/MIME/decode/dimension/resize/strip/encode behavior.
- Keep it independent from Express, Storage, and Prisma for fixture-based unit testing.
- Add a bounded semaphore/queue wrapper and deterministic busy/timeout errors.

### Routes and middleware

Add exactly:

- `POST /api/admin/vocabulary-sets/:setId/cover`
- `DELETE /api/admin/vocabulary-sets/:setId/cover`
- `POST /api/admin/vocabulary-sets/:setId/cover/cleanup`
- `POST /api/my/vocabulary-sets/:setId/cover`
- `DELETE /api/my/vocabulary-sets/:setId/cover`
- `POST /api/my/vocabulary-sets/:setId/cover/cleanup`

Authentication and ADMIN/USER role middleware run before Multer. USER service methods additionally query by exact Set ID, owner ID, and private visibility before processing.

Upload request is multipart with exactly one `cover` file and no text fields. DELETE/cleanup have no body. Upload success returns updated Set `data` plus `meta.storage_cleanup`.

Safe error mapping:

- `400 VALIDATION_ERROR`: malformed multipart, unexpected/missing field, invalid dimensions/content.
- `401 AUTHENTICATION_FAILED`, `403 FORBIDDEN`, concealed `404 VOCABULARY_SET_NOT_FOUND`: existing rules.
- `413 COVER_FILE_TOO_LARGE`.
- `415 UNSUPPORTED_COVER_MEDIA_TYPE`.
- `503 COVER_PROCESSING_BUSY` or `COVER_STORAGE_UNAVAILABLE`.
- `502 COVER_STORAGE_FAILED` / `COVER_STORAGE_CLEANUP_FAILED` for provider operations.
- safe `500 INTERNAL_SERVER_ERROR` for unexpected persistence errors.

### Checkpoint

- Processor and upload API pass independently using buffers/fixtures and fake Storage.
- Verify no DB row contains image bytes and no rejected/failed upload leaves metadata/object state.
- Verify authorization happens before body processing.

**STOP CHECKPOINT D:** HUMAN reviews upload security, optimized output evidence, resource-bound tests, endpoint behavior, and dependency footprint before forms use upload APIs.

## 9. Phase 5 — Storage lifecycle and copy compensation

### Managed replacement

1. Authorize/load internal current metadata.
2. Keep the current cover active while the replacement is selected, previewed, validated, processed, and uploaded to a fresh Set-owned key.
3. Transactionally persist the new URL/key only after the optimized object is stored successfully.
4. On DB failure, remove only the new exact key; preserve old metadata.
5. Only after DB success, list the exact Set prefix and remove every non-current key, including the prior managed object.
6. Cleanup failure keeps the new cover authoritative and returns `retry_required`; cleanup endpoint repeats step 5 idempotently.

### Managed to external

1. Validate/authorize external URL.
2. Keep the managed cover active during editing; persist the validated external URL and null key with other requested metadata only on Save.
3. Only after metadata success, sweep non-current objects under the exact Set prefix.
4. Report retry-required cleanup without reverting the external metadata.

### External to managed

- Keep the external cover active while the new file is selected/previewed and while upload processing runs. Upload/process/persist managed metadata in that order; do not fetch or delete the former external resource.

### External to external

- Keep the old external URL active until Save successfully persists the validated replacement URL; update metadata only and perform no Storage delete.

### Remove cover

1. Authorize/load current internal metadata.
2. Persist both cover fields as null only when the user saves/confirms removal.
3. If the old cover was managed, sweep all objects under the exact Set prefix only after metadata success; if it was external, perform no Storage delete.
4. Return cleanup state; retry endpoint may repeat safely.

### Cancel editing

- Cover URL/file/removal changes remain local draft state until Save; Cancel restores/displays the persisted cover and performs no metadata mutation or deletion.
- Revoke local object URLs and discard selected file bytes on Cancel.
- The selected implementation does not upload edit-form files before Save, so ordinary Cancel creates no managed temporary object. If a later implementation would stage an object before Save, STOP unless it can immediately delete only that newly created exact key without touching the persisted cover.

### Set deletion

1. Authorize/load exact Set and internal key.
2. If managed/current prefix objects exist, remove all objects under only that prefix.
3. Abort DB deletion on provider cleanup failure.
4. Delete Set through the existing transaction.
5. DB failure after storage removal leaves the Set readable with fallback; repeating delete treats absent objects as success.

External-only/null-cover Set deletion performs no Storage call.

### Managed copy

1. Authorize/load public source and internal metadata.
2. Generate destination Set UUID and destination key under its prefix.
3. Use Supabase server-side Storage copy from the exact validated source key to destination key; do not download/re-encode.
4. Derive destination public URL.
5. In one DB transaction create the private Set with explicit destination ID, copied CEFR/name/description, independent key/URL, and fresh ordered Items.
6. If Storage copy fails, create no DB Set.
7. If DB transaction fails, remove the exact destination key. If compensation fails, emit structured cleanup evidence containing safe operation/destination IDs, not credentials; a guarded run-owned-prefix cleanup tool/test path may retry.

### Checkpoint

- Failure-injection matrix proves operation order, no arbitrary deletes, current-object preservation, idempotent cleanup, independent managed copies, and no half-created DB copy.
- Existing repeated-copy behavior remains allowed.

## 10. Phase 6 — Frontend form integration

### Shared form model/component

- Extract only the genuinely shared CEFR/cover controls and validation from the current ADMIN editor and Personal modal; do not consolidate unrelated Topic/item form logic.
- State: persisted URL, URL draft, selected file, local object URL, removal intent, broken-preview flag, metadata save state, upload state, cleanup warning, retry target.
- Both ADMIN and Personal create/edit forms expose current-cover preview, external HTTPS URL input, file selection, replace/change, remove, pending, validation/upload error, retry, and Cancel behavior. “Edit image” means replace or remove only.
- Preview precedence is newly selected file/local URL, then valid URL draft when chosen, then persisted cover, then deterministic fallback; the persisted cover remains authoritative until Save succeeds.
- Revoke every replaced/unmounted object URL.
- Client validation mirrors allowed CEFR, HTTPS/no-credential URL, MIME hint, and 5 MiB limit for UX; backend remains authoritative.
- Do not add crop, filter, rotation, image-editor, or manual-transform controls.

### Exact sequencing

**Create with external URL:** include CEFR/URL in the existing JSON POST; no upload request.

**Create with file:**

1. POST Set metadata with CEFR and `cover_image_url: null`.
2. Store returned Set ID in component state.
3. POST multipart upload once to the Set-scoped route.
4. On upload failure, keep/navigate to exactly that created Set, show “Set created; cover upload failed,” and retry only upload using the saved ID.

**Edit with external URL:** keep the old cover displayed/active until Save; issue one existing JSON PATCH for the validated replacement, then surface optional cleanup status. Failure leaves the prior cover unchanged.

**Edit with file:** PATCH non-cover metadata first (omitting cover URL), then POST upload. The upload endpoint stores/validates the optimized object before replacing metadata and only then cleans the former managed object. If upload fails, show that metadata saved but the prior cover remains; retry only upload.

**Edit/remove:** PATCH other metadata first if changed, then DELETE cover. DELETE clears both cover fields before managed cleanup and never deletes an external resource; refetch authoritative Set after partial failure.

**Cancel:** discard URL/file/removal drafts, revoke local preview resources, restore the persisted preview, and issue no PATCH/upload/remove/cleanup request.

Disable duplicate submit during each stage. Never replay a successful create when upload retry is requested.

### Files

- extend `frontend/src/services/vocabulary-set-service.js` with upload/remove/cleanup methods and optional response meta parsing;
- extend `my-vocabulary-sets-page.jsx` and `admin-vocabulary-sets-page.jsx` in place;
- add at most one focused shared metadata-controls module if size/reuse justifies it;
- preserve existing accessibility, focus restoration, modal/editor behavior, and current Set navigation.

### Checkpoint

- ADMIN required CEFR and Personal optional CEFR pass.
- Existing-cover preview, external/file replacement, newly selected preview, remove, Cancel/no-request, pending, validation/upload failure, prior-cover preservation, retry, cleanup warning, broken fallback, keyboard/focus, and responsive states pass for both ADMIN and Personal forms.
- No unrelated Set UI redesign.

**STOP CHECKPOINT E:** HUMAN functional/visual review before Discovery/My Sets read-display integration.

## 11. Phase 7 — Read/display integration

### Discovery

- Extend catalog Set objects with CEFR/cover URL from current Topic-scoped responses.
- Add `cefrLevel` to `filterDiscoveryCatalog` after complete catalog load.
- Add labelled All/A1/A2/B1/B2/C1 client control alongside existing filters.
- Reset page on CEFR/search/Topic changes; retain clamping, featured exclusion, and nine normal Sets per page.
- Page changes remain local and issue no requests.
- Card uses persisted image first; `onError` switches once to current deterministic Topic artwork without request loops.
- Null CEFR appears only in unfiltered results.

### Public/Personal/ADMIN display

- Add compact CEFR metadata and cover/fallback to existing detail/header/card families.
- My Sets cards may render the cover and CEFR without changing actions or grid architecture.
- ADMIN list/detail may show CEFR/cover status needed to manage metadata.
- Do not alter Learning/Quiz route payload semantics or duplicate Meaning CEFR logic.

### Checkpoint

- Discovery filter composition, reset/clamp, 9/page, zero page requests, fallback, responsive, and accessibility coverage pass.
- Existing public read-only and My Sets behavior pass.

## 12. Phase 8 — Copy-flow UI verification

- Verify copied CEFR immediately appears on destination Personal detail/card.
- External source URL is identical and destination key remains internal null.
- Managed source copy has a distinct URL/key under destination ID; deleting/replacing either Set does not affect the other.
- The source and destination objects may live in the same public-read bucket, but never share managed ownership or one object key.
- Copy Storage failure shows safe error and creates no destination/navigation target.
- Repeated copies remain independent and allowed.
- Preserve existing Discovery/Public Detail save wording and routing.

## 13. Phase 9 — Test and fixture migration

### Backend/schema

- Extend `backend/test/vocabulary-set/vocabulary-set.test.js` for schema, JSON contracts, legacy nulls, copy, auth, and lifecycle.
- Extend Personal Vocabulary schema/API tests where Set fixtures cross the new columns.
- Add focused pure image processor tests with small checked-in binary fixtures generated/verified as test assets, including spoofed MIME, corrupt files, SVG/GIF, dimensions, orientation, EXIF, and output WebP.
- Add adapter unit tests against an injected fake Supabase client.
- Add failure-injection service tests for each Phase 5 ordering branch.
- Cover lifecycle coverage must include managed-to-managed, managed-to-external, external-to-managed, external-to-external, managed/external removal, Set deletion, and failure at each storage/persistence/cleanup boundary, proving the prior cover remains authoritative until replacement metadata succeeds.

### Frontend

- Extend `frontend/test/vocabulary-set-service.test.js` for new fields, FormData methods, response metadata, and errors.
- Extend ADMIN/Personal unit/source/component coverage for current/new previews, URL/file replacement, removal, Cancel with zero mutation requests, pending/errors/retry, local object-URL cleanup, prior-cover preservation, and two-step create sequencing.
- Extend mocked Discovery browser tests for CEFR composition, covers/fallback, 9/page, and request counts.
- Extend public/My Sets and copy browser tests without weakening existing assertions.

### Direct-Prisma and performance fixtures

Audit and update all direct `vOCABULARY_SET.create` sites in backend tests, guarded frontend integration, performance fixture/composition, and manual Learning fixture. Leave metadata null where legacy compatibility is intended; add explicit metadata only where the scenario consumes it. Do not globally seed fake CEFR.

### Guarded real stack

- Prepare/migrate only dedicated `.env.test` DB through existing guarded scripts.
- Run existing Set/Discovery/Learning/Quiz/Progress real-stack suites.
- Add unique run-owned DB prefixes and Storage namespace prefixes.
- Cleanup only run-owned objects/rows and compare unrelated TEST counts before/after.
- Real Storage suite is conditional on a separately verified dedicated TEST bucket; it must not silently use production/preview credentials.

## 14. Phase 10 — Performance and security validation

- Prove >5 MiB rejection occurs at multipart parsing before Sharp/Storage invocation.
- Measure five representative valid uploads after warm-up and record parse/process/upload stages without treating remote Storage latency as CPU work.
- Verify output is WebP quality 82 configuration, ≤1600 longest edge, no upscale, aspect ratio preserved, EXIF absent, and one final object only.
- Exercise maximum allowed input, excessive dimensions, malformed/truncated/decompression-bomb-style input, MIME mismatch, SVG/GIF, multiple/unexpected files, busy queue, and processing timeout.
- Verify unauthenticated/wrong-role/non-owner requests reach neither processor nor Storage.
- Verify exact Set-prefix checks reject traversal, foreign Set IDs, malformed keys, and unrelated objects.
- Verify both System and Personal managed covers use the same public-read bucket model while every mutation remains backend-authorized; document/test that possession of a cover URL permits asset read and that no private/signed URL behavior exists.
- Verify external URL validation rejects forbidden forms and triggers zero backend network/Storage calls.
- Inspect schema/API/log artifacts for no image bytes, secrets, service keys, provider authorization headers, or raw provider errors.
- Verify memory/process behavior remains bounded at concurrency 2 and queue 8 under controlled load; if deployment limits cannot support the selected bounds, STOP for HUMAN review rather than silently weakening them.

## 15. Phase 11 — Documentation and closure

Update only after verified behavior exists:

- `docs/DATABASE.md` — fields, constraints, nullable rollout, no blob/backfill.
- `docs/API_SPEC.md` — projections, JSON fields, multipart/remove/cleanup endpoints, errors, response meta.
- `docs/ARCHITECTURE.md` — backend-only adapter/processor/lifecycle and two-step create boundary.
- `docs/UI_UX_SPEC.md` — form states, covers/fallback, CEFR filter, My Sets boundaries.
- `docs/FEATURE_STATUS.md` — remain `IN_PROGRESS` until formal TEST/REVIEW/HUMAN approval, then `DONE`.
- `.env.example` or repository-equivalent non-secret environment documentation — exact variables and bucket provisioning.
- deployment/storage runbook — one public-read cover model for System and Personal Sets, server-only writes, non-sensitive-upload warning, policies, cleanup/recovery, TEST separation, and explicit exclusion of signed/private cover delivery.
- migration note — nullable fields, no historical backfill.

Run final targeted/full verification required by TASK, secret/artifact scans, build, lint, `git diff --check`, formal TEST, formal REVIEW, and HUMAN closure approval. Do not commit/push without separate authorization.

## 16. Implementation order and checkpoints

1. **Checkpoint A:** approve dependencies, bucket model, environment contract, memory/resource bounds.
2. Phase 1 schema/migration and guarded TEST validation.
3. **Checkpoint B:** approve migration evidence.
4. Phase 2 backend JSON metadata.
5. **Checkpoint C:** approve JSON/API compatibility.
6. Phase 3 Storage adapter/config with fake tests.
7. Phase 4 image processor and upload/remove/cleanup API.
8. **Checkpoint D:** approve independent upload/security evidence.
9. Phase 5 lifecycle/copy compensation.
10. Phase 6 frontend forms and two-step sequencing.
11. **Checkpoint E:** HUMAN functional/visual form review.
12. Phase 7 read/display and Discovery integration.
13. Phase 8 copy UI verification.
14. Phase 9 fixture/test migration and guarded real-stack coverage.
15. Phase 10 performance/security validation.
16. Phase 11 documentation, formal TEST/REVIEW, and closure.

No phase may cross a declared checkpoint without HUMAN approval. A missing safely isolated TEST bucket blocks only real-provider verification until HUMAN resolves it; it never authorizes production/preview access or a local-storage fallback.

## 17. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Native Sharp binary unavailable in deployment/CI | Checkpoint A installation probe; use supported prebuilds; STOP before alternative architecture |
| Multer memory pressure | one 5 MiB file, auth-first route scope, concurrency 2, queue 8, immediate buffer release |
| Provider/database non-atomicity | ordered writes, exact-key compensation, idempotent prefix cleanup, observable response meta |
| Service credential leakage | backend-only config, redacted errors/logs, secret scan, no frontend env |
| Public bucket misunderstood as public write | pre-provisioned public-read bucket; service-only writes; policy/config verification |
| Personal cover mistaken for private media | in-form/docs warning that possession of the public cover URL permits read; authorization continues to protect Set APIs, not asset secrecy |
| CDN stale overwrite | unique keys and `upsert: false`; persist new URL before old deletion |
| Replacement/cancel loses current cover | keep persisted cover authoritative until replacement metadata succeeds; draft-only edit state; Cancel sends no mutation and revokes local preview |
| Orphaned objects after failed compensation | deterministic destination prefix, structured operation evidence, guarded cleanup |
| Accidental unrelated deletion | server-derived exact namespace/Set prefix and current-key exclusion |
| Legacy null System records | readable; explicit CEFR required only when edited; no fabricated backfill |
| Two-step create partial success | retain returned Set ID; retry upload only; communicate exact state |
| External tracking/broken content | HTTPS/no-credentials validation, no backend fetch, deterministic client fallback |
| Fixture explosion | nullable fields by default; explicit metadata only for consuming tests |

## 18. Human checkpoints and blockers

### Required approvals

1. **Dependency/config checkpoint:** approve `@supabase/supabase-js`, current patched Multer 2.x, Sharp, public-read bucket, exact environment variables, and memory/concurrency bounds.
2. **Migration checkpoint:** approve SQL and dedicated TEST migration/legacy-row evidence.
3. **JSON contract checkpoint:** approve API compatibility before upload subsystem migration.
4. **Upload checkpoint:** approve security/resource/optimization evidence before frontend forms consume it.
5. **Form checkpoint:** approve functional and visual form behavior before Discovery/My Sets presentation.
6. **Formal TEST/REVIEW/closure:** required before DONE or commit/push.

### Known external prerequisite

A dedicated Supabase TEST Storage bucket and TEST-only server credential/namespace have not yet been verified. Normal implementation and fake-adapter tests can proceed after approval, but any real-provider call and final guarded Storage evidence are blocked until the safety guard proves isolation. No Production/Preview bucket may be inspected or used to resolve this prerequisite.

## 19. Open questions

None at product-contract level. The dedicated TEST Storage prerequisite is an environment checkpoint, not permission to change the approved architecture.
