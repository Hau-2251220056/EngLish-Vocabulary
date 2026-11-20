# TASKS: Vocabulary Set Metadata Refactor

**Status:** COMPLETE — FORMAL TEST PASS / FORMAL REVIEW APPROVE; PENDING HUMAN CLOSURE AUTHORIZATION

**Approved SPEC:** `docs/specs/VOCABULARY_SET_METADATA_REFACTOR_SPEC.md`

**Approved PLAN:** `docs/plans/VOCABULARY_SET_METADATA_REFACTOR_PLAN.md`

**Branch:** `refactor/vocabulary-set-metadata`

**Base:** `aee4fc8a68d9ca374f6c808b2dd22e0ca10c122b`

## Overview

These tasks extend the existing DONE Vocabulary Set and Discovery foundations with nullable Set-level CEFR metadata, external and managed covers, backend-controlled Supabase Storage, bounded image optimization, lifecycle compensation, existing-form integration, and compatible presentation/filtering. They do not rebuild Set ownership, visibility, membership, Learning, Quiz, Progress, or Discovery architecture.

Implementation is strictly ordered. Work must stop at every declared HUMAN checkpoint. Fake-adapter/unit work may precede real-provider verification where stated, but no real Supabase Storage call is authorized until the dedicated TEST Storage checkpoint passes and is HUMAN approved.

## Feature Status

Current status: `DONE` after complete implementation, HUMAN-approved visual review, formal TEST PASS, and TASK-166 formal REVIEW APPROVE. Commit, push, and integration remain separately HUMAN-authorized closure actions.

## Execution status

- **TASK-142:** HUMAN APPROVED at STOP A.
- **TASK-143:** COMPLETE — nullable schema and forward migration implemented and verified against the guarded dedicated TEST database.
- **TASK-144:** HUMAN APPROVED at STOP B; deleted non-authoritative manual/shared fixtures will not be guessed or reconstructed.
- **TASK-145:** COMPLETE — backward-compatible JSON metadata contract implemented.
- **TASK-146:** HUMAN APPROVED at STOP C.
- **TASK-147:** COMPLETE — backend Storage adapter/config and deterministic fake implemented without provider access.
- **TASK-148:** COMPLETE — bounded Sharp image processor implemented.
- **TASK-149:** COMPLETE — authenticated System/Personal upload, remove, and cleanup API implemented.
- **TASK-150:** HUMAN APPROVED at STOP D.
- **TASK-151:** COMPLETE — failure-safe cover lifecycle implemented with exact Set-owned cleanup.
- **TASK-152:** COMPLETE — managed-cover copy creates an independent destination object with compensation.
- **TASK-153:** COMPLETE — shared frontend metadata state, controls, and service contract implemented.
- **TASK-154:** COMPLETE — ADMIN System Set form integration implemented.
- **TASK-155:** COMPLETE — Personal Set form integration implemented.
- **TASK-156:** HUMAN APPROVED at STOP E.
- **TASK-157:** COMPLETE — Public/Personal Set detail and card metadata projection implemented.
- **TASK-158:** COMPLETE — Discovery cover projection and client-side CEFR filtering implemented without request-contract changes.
- **TASK-159:** COMPLETE — My Sets metadata presentation integrated into the existing card/detail architecture.
- **TASK-160:** COMPLETE — nullable fixture/mock/harness contract migration and focused verification complete.
- **TASK-161:** HUMAN APPROVED at STOP F.
- **TASK-162:** HUMAN APPROVED — broad guarded feature/regression verification accepted.
- **TASK-163:** HUMAN APPROVED — functional and visual review accepted.
- **TASK-164:** COMPLETE — official database/API/architecture/UI/status and non-secret environment contracts reconciled; feature remains IN_PROGRESS.
- **TASK-165:** HUMAN APPROVED — formal TEST PASS and complete authoritative matrix accepted.
- **TASK-166:** COMPLETE — formal REVIEW APPROVE; no BLOCKER, MUST FIX, or SHOULD FIX finding remains. Pending HUMAN closure authorization before commit/push/integration.

### TASK-143/144 evidence

- Migration: `20261007000000_add_vocabulary_set_metadata`.
- Guarded preflight: 7 migrations found, database up to date before the change.
- Prisma schema validation: PASS.
- Prisma Client 6.19.3 generation: PASS.
- Guarded migration deployment: PASS; 8 migrations applied in total.
- Guarded post-deploy parity: 8 migrations found, none pending.
- Existing TEST Sets after migration: 12; rows with any new metadata populated: 0.
- Historical null row read: PASS with `cefr_level`, `cover_image_url`, and `cover_storage_key` all null.
- Rolled-back constraint probes: A1/A2/B1/B2/C1 accepted; C2 and arbitrary CEFR rejected; key without URL rejected; null/null and external URL with null key accepted.
- Probe residue: 0 rows.
- No default, inference, backfill, blob/image bytes, index, Meaning CEFR, ownership, Topic, Item, API, or UI change.
- **TEST isolation incident:** after the valid rollback-only probes, the existing `backend/test/vocabulary-set/vocabulary-set.test.js` suite was invoked for regression evidence. Its shared `createTestDatabase().reset()` helper globally deleted shared TEST rows and violated this checkpoint's no-global-reset guardrail. The immediate post-command guarded read found users/sessions/Topics/Vocabulary/Sets/Items/Progress all at zero.
- **Recovery audit:** the fixed-ID Personal Vocabulary baseline in `backend/test/scripts/seed-personal-vocabulary-baseline.js` was the only deleted shared fixture with an exact authoritative identity/content definition. It was restored through that guarded script and verified as one canonical Vocabulary with its one Meaning and one Example. The previously present users, sessions, Topics, and 12 Sets (including manual-review Sets) had no exact authoritative identity/content source in the repository or retained artifacts, so they were not guessed or recreated.
- **Isolation remediation:** `backend/test/vocabulary-set/vocabulary-set.test.js` no longer invokes the global reset helper. The suite now gives every user, Topic, Vocabulary, and Set a process-run ownership marker and deletes only those exact run-owned records in dependency order. It does not truncate tables or delete unrelated/manual TEST data.
- **Remediation evidence:** the repaired focused suite passed 11/11. Guarded before/after counts remained users 0, sessions 0, Topics 0, Vocabulary 1, Sets 0, Items 0, Progress 0; the fixed-ID baseline remained present; run-owned residue was users 0, Topics 0, Vocabulary 0, Sets 0. A rollback-only probe reconfirmed that a Set with all three new metadata fields null remains valid/readable and left no residue. Guarded parity reconfirmed 8 migrations found and none pending.

### TASK-145/146 evidence

- Repository summary/detail projections now load Set `cefr_level`, `cover_image_url`, and the internal lifecycle key; response mapping strips `cover_storage_key` from every public, USER, and ADMIN representation.
- System JSON create requires exactly A1/A2/B1/B2/C1. System PATCH must leave a non-null valid CEFR, including when editing a legacy null row. Personal JSON create/PATCH accepts optional A1–C1 or null and supports clearing to null.
- JSON covers accept only non-empty absolute credential-free HTTPS URLs up to 2048 characters. External URL set/clear writes a null internal storage key and performs no fetch, DNS resolution, proxy, or download.
- External cover URL and exact CEFR copy to the independent Personal Set with a null storage key. Managed-cover duplication remains deferred to the approved Storage lifecycle tasks.
- Focused guarded Vocabulary Set integration: 14/14 PASS, including metadata validation/projections, omitted PATCH preservation, legacy-null reads/edit rule, external copy, storage-key rejection/non-exposure, ownership, visibility, ordering, membership, and copy independence. A final focused projection/metadata rerun after adding summary assertions passed 3/3.
- Backend non-DB unit regressions: 24 tests, 21 PASS, 3 pre-existing TODO, 0 FAIL. The first sandboxed invocation failed to spawn workers with `EPERM`; the same command passed outside the restricted process sandbox.
- TEST preservation: before/after counts remained users 0, sessions 0, Topics 0, Vocabulary 1, Sets 0, Items 0, Progress 0; the fixed baseline retained one Meaning and one Example; run-owned Set residue was 0.
- The unrelated Quiz integration suite was not invoked because it still uses the known global shared TEST reset helper. No result is claimed for that suite at this checkpoint.
- No controller/route, frontend, dependency, package, environment, upload, image-processing, or Supabase Storage change/call was made.

### TASK-147–150 evidence

- Dependencies installed: `@supabase/supabase-js` 2.117.2 (`^2.117.2`), Multer 2.4.0 (`^2.4.0`), and corrected approved Sharp 0.35.5 (`^0.35.5`). Node 22 loaded Sharp/libvips 8.18.7 and produced a WebP successfully.
- `npm audit --omit=dev` no longer reports the Sharp 0.34.5 advisory. Remaining 7 high/1 critical findings are pre-existing in `brace-expansion`/nodemon, Prisma tooling, and `proxy-addr`; no unrelated audit fix was applied.
- Storage configuration is lazy and backend-only. TEST reads only the four `TEST_SUPABASE_*` variables, requires explicit test-scoped bucket/namespace, rejects equality with ordinary values, and never falls back to ordinary Storage configuration.
- The Storage adapter generates `<namespace>/vocabulary-sets/<set-id>/<uuid>.webp`, uploads with `upsert:false`, derives public URLs, copies server-owned keys, and lists/removes only the exact Set prefix. Malformed, traversal, and cross-Set keys are rejected; provider details are redacted. All verification used injected provider/fake clients and made no real Supabase call.
- Image processing accepts signature/MIME-matched JPEG/PNG/WebP up to 5 MiB and 4096×4096; rejects mismatch, SVG/GIF, malformed/truncated, excessive dimension, and multipage input; applies orientation, resizes inside 1600×1600 without enlargement, strips metadata, and emits one WebP at quality 82. Runtime bounds are two active processors, queue eight, and 15-second deadline.
- Six authenticated endpoints were added for ADMIN System and owner-only Personal upload/remove/cleanup. Router-level authentication and role authorization precede route-scoped Multer `single("cover")`; owner/private loading precedes Sharp/Storage. Safe errors cover 400/401/403/concealed 404/413/415/502/503.
- Foundation unit suite: 6/6 PASS. Evidence covers config fail-closed behavior, generated/scoped keys, `upsert:false`, public URL, fake upload/copy/list/remove, provider redaction, three image formats, output bounds/format, no upscale, orientation/metadata stripping, invalid inputs, queue overflow, and deadline.
- Focused guarded cover API: PASS, including auth/role before multipart, System and exact-owner Personal access, wrong-owner concealment, one-file/no-field rules, MIME/signature errors, 5 MiB transport rejection, fake provider failure, no rejected DB mutation, no storage-key exposure, remove, and cleanup.
- Full repaired guarded Vocabulary Set suite: 15/15 PASS. Backend non-DB unit regressions: 24 tests, 21 PASS, 3 pre-existing TODO, 0 FAIL.
- TEST preservation after the full run: users 0, sessions 0, Topics 0, Vocabulary 1, Sets 0, Items 0, Progress 0; the fixed baseline retained one Meaning and one Example; run-owned Set residue 0.
- At the accepted STOP D checkpoint, no image bytes were represented in Prisma/PostgreSQL, no frontend file had changed, and TASK-151 had not started.

### TASK-151–156 evidence

- Managed replacement stores the optimized new object before metadata, compensates the exact new key on persistence failure, and removes only non-current Set-owned objects after success. Cleanup failure leaves new/null metadata authoritative and returns `meta.storage_cleanup: retry_required`; cleanup retry preserves the current and unrelated Set objects.
- Managed→external and remove transitions never fetch or delete external resources. Managed Set deletion clears the exact Set prefix before deleting the row; cleanup failure leaves the row intact and retry is idempotent.
- Managed System→Personal copy allocates the destination UUID first, server-copies into the destination prefix, and persists that independent key. Storage failure creates no row; persistence failure removes the destination object; failed compensation exposes only a safe `orphan_set_id`.
- Pure fake-adapter lifecycle/failure matrix: 10/10 PASS. Guarded TEST-DB Vocabulary Set integration with the fake adapter: 16/16 PASS, including managed replacement, retry cleanup, independent copy, external transition, delete failure/retry, ownership, and API non-exposure.
- Frontend service supports FormData upload plus remove/cleanup and consumes cleanup metadata without any Supabase client or credentials. Shared controls provide A1–C1 selection, mutually exclusive HTTPS/file drafts, current/new preview, explicit remove, 5 MiB/type hints, accessible labels/focus, and object-URL revocation.
- ADMIN requires CEFR on create/edit; Personal CEFR remains optional/clearable and displays the public-cover/non-sensitive-image warning. File create persists the Set once, then uploads by returned ID; a failed upload retains the created Set and retries only upload. Unchanged managed covers are omitted from JSON PATCH so metadata is preserved.
- Focused frontend service/state tests: 8/8 PASS. Focused Personal mocked browser coverage: 12/12 PASS across modal lifecycle, upload-only retry, responsive 375 px behavior, accessibility/focus, list regressions, and no duplicate create. Focused ADMIN mocked metadata form: 1/1 PASS. Guarded ADMIN real-stack: 3/3 PASS; no cover endpoint was called.
- At STOP E, frontend production build and touched-file ESLint passed, no real Supabase Storage call had been made, and TASK-157 had not started.

### TASK-157–160 evidence

- Shared Set metadata presentation prefers a persisted cover and switches once to the existing deterministic artwork when the URL is null or fails. Compact CEFR badges are omitted for legacy null metadata.
- Public and Personal detail/card consumers preserve Learning, Quiz, copy/save, ownership, and read-only behavior; no API, backend, schema, or Storage contract changed in these tasks.
- Discovery CEFR filtering supports All/A1/A2/B1/B2/C1 after the complete client-composed catalog load and before nine-item pagination. It composes with Topic/search, resets to page one, preserves featured exclusion, and page/filter changes make no API requests.
- My Sets cards/details display cover/CEFR while preserving the clipping-safe action menu, create/edit/delete/open flows, responsive grid, and legacy-null fallback.
- Relevant mocked fixtures now cover persisted, broken, missing, and null covers plus multiple CEFR levels. Unrelated direct Prisma fixtures remain intentionally nullable; no default/backfill or fabricated historical metadata was added.
- Deterministic manual TEST fixtures provide System A2/persisted, System B1/broken, System C1/missing, Personal A2/persisted, and Personal legacy-null examples. Upserts and cleanup are limited to fixed manual-review IDs and use the fake in-memory Storage adapter.
- Focused frontend unit tests: 14/14 PASS. Focused mocked browser coverage: 42/42 PASS, with a final Discovery/detail rerun 27/27 PASS across 375/390/768/820/1366/1536 viewports.
- Guarded real-stack public Set coverage: 3/3 PASS. Guarded USER Set coverage: 2/2 PASS after migrating one stale test assertion from “no combobox” to optional Set CEFR plus no Topic selector. Run-owned cleanup remained scoped.
- Frontend production build and touched-file ESLint: PASS. No real Supabase Storage call was made; TASK-161 has not started.

### TASK-161 evidence

- The guarded TEST configuration required all four dedicated variables, rejected missing/blank values, ordinary-only fallback, equality with corresponding ordinary Storage values, and non-test bucket/namespace identities before provider client construction. The adapter received a TEST-only environment snapshot.
- Sanitized identity: project-host fingerprint `d0503e2d1237`; bucket `vocabulary-set-covers-test`; namespace fingerprint `c9cb3e7b32eb`, explicitly TEST-identifiable. No URL or service credential was printed or persisted.
- Real-provider exact-object lifecycle: 1/1 PASS. One run-owned WebP uploaded under the TEST namespace, its public bytes verified, copied to a second run-owned Set prefix, and both exact objects removed. Repeating cleanup for both exact Set prefixes succeeded with zero residue.
- A separate run-owned marker object remained listed and publicly readable while source/destination cleanup ran, proving cleanup stayed within the requested exact prefixes. The marker was then removed exactly; final counts for all three run-owned prefixes were zero.
- Cross-Set deletion and a foreign namespace key were both rejected before deletion. Existing fake-provider coverage reconfirmed provider-detail redaction and `upsert:false`.
- Changed/untracked-file scan found zero occurrences of the configured TEST project URL or service-role credential. Bucket/namespace identifiers appear only as non-secret contract/test identity. No frontend TEST/Supabase credential reference was introduced.
- No database was accessed, no bucket/policy was created or changed, and no bucket-wide listing, sweep, or deletion occurred.
- Focused Storage foundation suite: 7/7 PASS. `git diff --check`: PASS.

### TASK-162 evidence

- Guarded TEST database preflight: 8 migrations found, none pending. Before/after counts were identical: users 2, sessions 6, Topics 1, Vocabulary 2, Sets 6, Items 6, Progress 0.
- Focused backend unit/security/resource regression: 56/56 PASS. This covered Storage fail-closed/config/key/error behavior; JPEG/PNG/WebP processing and size/dimension/signature/metadata/output/resource bounds; lifecycle/copy compensation; authentication; SRS; and non-DB Quiz contracts. The sandboxed first invocation produced only environment `spawn EPERM`; the identical authorized invocation passed.
- Guarded run-owned backend integration: 37/37 PASS across Learning/Progress and Vocabulary Set metadata/API/lifecycle/ownership/copy regressions. The run used exact ownership markers and no global reset.
- Frontend unit/service regressions: 51/51 PASS. Focused mocked browser regressions: 97/97 PASS across ADMIN/Personal metadata forms, cover preview/remove/replace/retry, Discovery, Public/Personal detail, My Sets/action menu, Learning, Progress, Quiz, auth, responsive, keyboard, focus, and Escape behavior.
- Guarded run-owned real-stack browser regression: 26/26 PASS across ADMIN/USER/public Set flows, Learning, Progress, and the separately audited run-owned Quiz browser spec. Migration setup again reported 8/8 with none pending. The known unsafe backend `quiz.integration.test.js` global-reset suite was not run.
- Dedicated TEST Storage lifecycle/measurement: 1/1 PASS. One excluded warm-up plus five retained 2400×1600 JPEG samples (2,610,507 input bytes) each produced an 862,326-byte WebP with 1600-pixel longest edge. Processing was 301.96–325.60 ms; remote upload was 662.21–1,224.92 ms; public-read verification was measured separately at 1,253.47–2,166.75 ms.
- Real Storage cleanup removed the six measurement objects and lifecycle source/destination objects only from their unique run-owned prefixes; repeated cleanup returned zero objects and the separate marker remained readable until its own exact deletion.
- Production build: PASS with only the existing non-blocking large-chunk advisory. Touched frontend ESLint: PASS. Secret/artifact scan and `git diff --check`: PASS.
- TASK-162 changed only its real-Storage test harness and TASK evidence. No production behavior, API, schema, dependency, environment, bucket, or policy changed.

### TASK-163 evidence

- HUMAN corrected My Sets cover clipping during visual review: the existing rounded card now provides the final `overflow: hidden` boundary around persisted images and fallback/decorative cover layers. Cover height/object-fit and card layout remain unchanged, while the portaled action menu retains clipping-safe viewport placement.
- HUMAN corrected Discovery mini-sidebar scalability during visual review: Topic radio options now use the only internal vertical scroll region with native keyboard/wheel behavior and light cross-browser scrollbar styling. Search, Topic heading, CEFR and result count remain stable; the always-rendered reset action is disabled only at the all-default state and clears all filters/page state without requests.
- HUMAN corrected the inherited Discovery Featured mismatch during visual review: the section now uses the first 3 complete-catalog Sets in deterministic source order in DEV and production, requires no test/manual marker, remains filter-independent, and excludes those IDs before nine-item normal pagination. No backend ranking, endpoint, schema or extra request was introduced.
- The manual-review harness uses guarded `.env.test` database and Storage configuration only. It starts the existing application on backend `127.0.0.1:5000` with the dedicated TEST Storage adapter; the frontend Vite review runtime is available on `127.0.0.1:5173`.
- Deterministic fixed-ID fixtures provide two review accounts, two Topics, three featured public Sets, ten non-featured public catalog Sets for nine-item pagination, and five Personal Sets. Cover variants include managed TEST Storage WebP, external HTTPS, broken URL, missing cover, and legacy-null metadata; CEFR examples span A1–C1.
- Fixture writes are limited to exact fixed IDs. Vocabulary membership replacement targets only those exact Set IDs, and managed-cover replacement/cleanup targets only the two exact Set-owned TEST prefixes. There is no global database reset, bucket-wide listing, sweep, or cleanup.
- Both USER and ADMIN login plus `/api/auth/me` returned 200. Public Topic catalog, public managed detail, My Sets, Personal managed detail, and ADMIN Set-list APIs returned 200. The run-owned public managed cover returned 200 as `image/webp`; all target SPA deep links returned 200.
- Focused mocked browser review: 44/44 PASS across Discovery, My Sets, Personal detail/modal, ADMIN metadata form, managed/external/broken/missing/null cover states, nine-item pagination, modal scroll behavior, action-menu placement, keyboard/focus/Escape behavior, and 375/390/768/820/1366/1536 viewport widths.
- The first fixture attempt exposed Prisma's default interactive-transaction timeout against the remote TEST database; the TEST-only harness now gives its exact-ID transaction a 30-second timeout. A later fresh read-only connection intermittently returned remote `P1001`, while the already-running guarded backend and all route/API checks remained healthy. No alternate datasource or production environment was used.
- No production source, API, schema, dependency, bucket, or policy changed for TASK-163. HUMAN accepted the visual checkpoint before TASK-164 began.

### TASK-164/165 evidence

- TASK-164 reconciled `DATABASE.md`, `API_SPEC.md`, `ARCHITECTURE.md`, `UI_UX_SPEC.md`, `FEATURE_STATUS.md`, SPEC/PLAN approval state, and non-secret ordinary/TEST environment examples. The feature remains `IN_PROGRESS`; no early REVIEW/DONE claim was made.
- Guarded migration status: 8 migrations found, none pending. Pre/post TEST DB counts were identical: Users `2 -> 2`, Sessions `12 -> 12`, Topics `2 -> 2`, Vocabulary `2 -> 2`, Sets `20 -> 20`, Items `20 -> 20`, Progress `0 -> 0`.
- Backend unit/security/resource matrix: 57 PASS, 0 FAIL, with 3 pre-existing approved TODOs. Guarded run-owned Learning/Vocabulary Set integration: 37/37 PASS. The known unsafe backend Quiz global-reset integration suite was not run.
- Dedicated TEST Storage: 1/1 PASS against the TEST-identifiable project/bucket/namespace. Exact run-owned upload, public read, managed copy, removal, repeated idempotent cleanup, foreign/cross-Set rejection, marker preservation, and redacted error behavior passed; no bucket/policy mutation or broad cleanup occurred.
- Frontend unit/service matrix: 96/96 PASS. Full mocked browser matrix: 140/140 PASS in stable single-worker mode; unchanged Quiz isolation was also 14/14 PASS. Earlier 8-worker and 4-worker aggregate runs encountered only page/navigation saturation timeouts (`132/140` and `136/140`) and no product assertion failure.
- Guarded real-stack matrix: 51/51 scenarios have authoritative passing evidence. The aggregate run passed 39 unaffected scenarios and exposed two stale test contracts; focused reruns passed Personal Vocabulary `7/7` and Topic/Discovery `9/9`, covering the 12 scenarios that had failed or been skipped serially.
- Stale-test corrections only: System Set fixtures now carry required `A1` CEFR so the intended concealed private-Vocabulary-ID assertion reaches `404`; the Discovery search assertion is scoped to the normal catalog because filter-independent Featured cards remain visible by contract.
- Production build: PASS with only the pre-existing large-chunk advisory. Full frontend ESLint: PASS. `git diff --check`, documentation consistency, secret/placeholder scan, ignored transient artifact check, and branch/status review: PASS.
- No Main/Preview/Production database or Storage was accessed; no unsafe global reset, real non-TEST Storage call, commit, push, or stash operation occurred.

### TASK-166 evidence

- Formal review traced the accumulated diff from base `aee4fc8a68d9ca374f6c808b2dd22e0ca10c122b` through the approved SPEC, PLAN, TASK, migration, backend/API/storage/image lifecycle, frontend UX, tests, and official documentation.
- Schema and API review confirmed independent Set CEFR (`A1`–`C1`), legacy-null compatibility, required System/optional Personal product rules, metadata-only PostgreSQL persistence, internal-only managed keys, and unchanged Meaning CEFR/Learning/Quiz ownership contracts.
- Storage/security review confirmed bounded JPEG/PNG/WebP optimization, exact Set-owned namespaces, backend-only credentials and mutations, fail-closed TEST identity, redacted provider failures, lifecycle compensation/retry, and independent managed-copy ownership.
- Frontend review confirmed approved ADMIN/Personal metadata flows, Discovery Featured/Topic/CEFR behavior, shared session save lock, My Sets cover/fallback/clipping/action menu, detail-header cover omission, responsive/accessibility coverage, and hidden-but-preserved USER Meaning CEFR values.
- Scope/artifact review found no unapproved endpoint, schema, role, persistence model, production-only/test-only behavior, package/framework upgrade, secret, build output, raw artifact, or unsafe shared-TEST reset in the final feature diff.
- Carried-forward formal evidence remains authoritative: backend `57 PASS` plus 3 approved TODOs; guarded integration `37/37`; dedicated TEST Storage `1/1`; frontend unit/service `96/96`; stable mocked browser `140/140`; guarded real stack `51/51`; production build, full frontend ESLint, secret scan, and diff checks PASS.
- Findings: BLOCKER `0`, MUST FIX `0`, SHOULD FIX `0`. Notes are limited to approved deferred product polish/capabilities and pre-existing unrelated dependency advisories; neither changes this feature's acceptance.

## Dependency graph

```text
TASK-142 [STOP A]
   ↓
TASK-143 → TASK-144 [STOP B]
                   ↓
                TASK-145 → TASK-146 [STOP C]
                                      ↓
                                   TASK-147 → TASK-148 → TASK-149 → TASK-150 [STOP D]
                                                                         ↓
                                                        TASK-151 → TASK-152
                                                                         ↓
                                                        TASK-153 → TASK-154 → TASK-155 → TASK-156 [STOP E]
                                                                                                    ↓
                                                        TASK-157 → TASK-158 → TASK-159 → TASK-160
                                                                                         ├→ TASK-161 [STOP F]
                                                                                         └→ fake/mocked verification
                                                                                                    ↓
                                                        TASK-162 → TASK-163 [HUMAN VISUAL STOP]
                                                                         ↓
                                                        TASK-164 → TASK-165 [FORMAL TEST STOP]
                                                                         ↓
                                                        TASK-166 [FORMAL REVIEW/CLOSURE STOP]
```

## TASK-142 — Dependency, configuration, and storage-model approval checkpoint

### Goal

Freeze the approved dependency/configuration boundary before any package or Storage/image implementation change.

### Dependencies

- Approved SPEC and PLAN only.

### Exact scope / expected files or modules

- Read-only compatibility/installability audit for backend Node/runtime and current package layout.
- Record proposed versions/ranges for patched Multer 2.x, Sharp, and `@supabase/supabase-js` without installing them.
- Confirm exact ordinary and TEST environment-variable contracts from the PLAN.
- Confirm one public-read, backend-write/delete cover bucket model for both System and Personal Sets.
- Confirm limits: one file, 5 MiB, 4096 × 4096, two processors, queue eight, 15-second deadline, WebP quality 82.
- Expected evidence belongs in this TASK file/checkpoint report; package/config/source files remain unchanged.

### Acceptance criteria

- Runtime compatibility, dependency footprint, public-read implications, backend-only credentials, lazy managed-operation configuration, and TEST isolation are explicit.
- No private bucket, signed URL, frontend credential, local-storage fallback, or provider other than Supabase is introduced.
- The non-sensitive-image warning is retained.

### Required tests/evidence

- Read-only Node/npm/package inspection.
- Package availability/security/compatibility evidence appropriate to the selected versions.
- Current branch/status/stash and no-change evidence.

### STOP / HUMAN checkpoint

**MANDATORY STOP A:** HUMAN must approve dependencies, public-read bucket model, exact environment contract, and resource bounds before TASK-143 or any dependency installation/Storage implementation.

### Exclusions

- No install, lockfile edit, environment edit, bucket access/creation, code, migration, or test creation.

## TASK-143 — Nullable schema and forward migration

### Goal

Add the backward-compatible metadata representation without backfilling historical rows.

### Dependencies

- TASK-142 HUMAN approved.

### Exact scope / expected files or modules

- `backend/prisma/schema.prisma`.
- One new `backend/prisma/migrations/<timestamp>_add_vocabulary_set_metadata/migration.sql`.
- Prisma generation artifacts only through the repository-supported workflow.
- Add nullable `cefr_level`, `cover_image_url`, and `cover_storage_key` with the exact PLAN types.
- Add `VOCABULARY_SET_cefr_level_check` for null or A1–C1 and `VOCABULARY_SET_cover_pair_check` for key-implies-URL.

### Acceptance criteria

- Existing rows remain null/readable; there is no default, inference, data rewrite, enum, index, blob, image/source table, or Meaning CEFR change.
- PostgreSQL stores metadata only.

### Required tests/evidence

- Prisma schema validation and generation.
- Guarded `.env.test` migration preparation/status only.
- Legacy-null read plus invalid CEFR/pairing constraint checks.
- Migration/schema diff review proving only approved columns/constraints.

### STOP / HUMAN checkpoint

- Stop immediately if the approved constraints cannot be expressed safely or any schema expansion is required.

### Exclusions

- No historical backfill and no Main/Preview/Production database access.

## TASK-144 — Migration evidence checkpoint

### Goal

Present the schema/migration evidence before backend contract work begins.

### Dependencies

- TASK-143 complete.

### Exact scope / expected files or modules

- Reconcile TASK-143 evidence in this TASK document only if workflow requires it.
- Confirm guarded TEST parity is eight migrations with none pending after preparation.

### Acceptance criteria

- SQL, schema, legacy-null behavior, and TEST-only execution are reviewable and complete.

### Required tests/evidence

- Guarded safety/parity outputs, focused schema tests, and diff scope.

### STOP / HUMAN checkpoint

**MANDATORY STOP B:** HUMAN must approve migration evidence before TASK-145.

### Exclusions

- No API/backend implementation and no unguarded Prisma CLI.

## TASK-145 — Backward-compatible JSON metadata contract

### Goal

Extend existing repository/service/controller JSON behavior for Set CEFR and external HTTPS covers.

### Dependencies

- TASK-144 HUMAN approved.

### Exact scope / expected files or modules

- `backend/src/repositories/vocabulary-set-repository.js` projections and internal lifecycle select.
- `backend/src/services/vocabulary-set-service.js` allowlists, normalization, validation, create/PATCH/copy metadata.
- `backend/src/controllers/vocabulary-set-controller.js` only as needed for existing envelopes/meta.
- Existing Vocabulary Set routes remain unchanged in this task.
- Public/API projections expose `cefr_level` and `cover_image_url`; never expose `cover_storage_key`.

### Acceptance criteria

- System create/edit leaves valid required A1–C1 CEFR; Personal CEFR is optional/clearable.
- Legacy null reads work; editing legacy null System Sets requires CEFR.
- External cover accepts only absolute credential-free HTTPS within length and performs no fetch/DNS/proxy.
- Non-null external URL clears the internal key; null requests use approved removal orchestration when applicable.
- Existing response envelopes, ownership, visibility, ordering, copy route, Learning/Quiz/Progress remain compatible.

### Required tests/evidence

- Focused repository/service/API tests for valid/invalid CEFR, URL forms, omitted PATCH fields, old rows, external copy, projections, and rejected client key/unknown fields.
- Existing Set authorization/copy regressions.

### STOP / HUMAN checkpoint

- Stop if compatibility requires a materially different API/schema contract.

### Exclusions

- No multipart, managed Storage, image processing, frontend consumption, or real provider call.

## TASK-146 — JSON/API compatibility checkpoint

### Goal

Confirm the backward-compatible metadata API before managed-cover infrastructure.

### Dependencies

- TASK-145 complete.

### Exact scope / expected files or modules

- TASK evidence/status only.

### Acceptance criteria

- JSON create/PATCH/read/external-copy contracts and old-row compatibility are proven.
- No storage key leaks and no external image fetch occurs.

### Required tests/evidence

- Focused backend/API results, relevant regressions, lint, and diff check.

### STOP / HUMAN checkpoint

**MANDATORY STOP C:** HUMAN must approve the API contract before TASK-147.

### Exclusions

- No upload or frontend work.

## TASK-147 — Backend Storage adapter and fake foundation

### Goal

Create the narrow backend-only Supabase Storage boundary and deterministic fake without making real provider calls.

### Dependencies

- TASK-146 HUMAN approved.

### Exact scope / expected files or modules

- Backend package manifest/lockfile for the approved Supabase dependency.
- Storage configuration module with exact normal/TEST variables and lazy managed-operation validation.
- `backend/src/storage/vocabulary-set-cover-storage.js` or repository-convention equivalent.
- Existing TEST environment helper for guarded TEST-variable mapping.
- Test-only fake adapter module.

### Acceptance criteria

- Adapter exposes only upload, copy, exact-prefix list/remove, and public URL behavior.
- Keys are server-generated under `<namespace>/vocabulary-sets/<set-id>/`, unique, and `upsert:false`.
- It rejects traversal, malformed/foreign prefixes, client keys, and unrelated deletes.
- Provider errors are typed/redacted; ordinary reads/external-only writes do not require Storage config.
- System and Personal covers use the same public-read model; all mutations remain backend-only.

### Required tests/evidence

- Fake-client adapter/config unit tests for key scoping, copy, list/remove, URL, missing config, provider errors, and secret redaction.
- No real network/provider call.

### STOP / HUMAN checkpoint

- Stop if TEST mapping can fall back to ordinary variables or if provider semantics cannot preserve exact-key ownership.

### Exclusions

- No real bucket access, image processing, API route, or frontend SDK.

## TASK-148 — Bounded image-processing pipeline

### Goal

Implement deterministic validation and one optimized managed output with bounded resources.

### Dependencies

- TASK-147 complete.

### Exact scope / expected files or modules

- Backend package manifest/lockfile for approved Sharp and patched Multer 2.x dependencies.
- Pure image processor module independent of Express/Prisma/Storage.
- Bounded semaphore/queue wrapper.
- Small safe checked-in image fixtures under the existing backend test-fixture convention.

### Acceptance criteria

- Early 5 MiB rejection; JPEG/PNG/WebP only; declared MIME must match signature/content.
- Reject malformed/truncated, SVG/GIF, animated/multipage, zero/unknown or >4096 × 4096, and decompression-bomb-style inputs.
- Apply orientation; preserve aspect ratio; longest edge ≤1600; never upscale; strip metadata; encode one WebP quality 82 output.
- At most two processors, queue eight, 15-second deadline, no disk temp/original retention/logged buffers.

### Required tests/evidence

- Pure processor tests for every format/limit/output/resource case.
- Output metadata/dimension/format checks and repeatable busy/timeout behavior.

### STOP / HUMAN checkpoint

- Stop if Sharp/runtime cannot enforce signature, decode, dimension, metadata, or resource boundaries.

### Exclusions

- No Storage upload, database mutation, route, or alternate transformation feature.

## TASK-149 — Authorized cover upload/remove/cleanup API

### Goal

Add the approved System and Personal cover endpoints on top of the stable adapter and processor.

### Dependencies

- TASK-147 and TASK-148 complete.

### Exact scope / expected files or modules

- `backend/src/routes/vocabulary-set-routes.js` with auth before route-scoped `single("cover")` parsing.
- `backend/src/controllers/vocabulary-set-controller.js`.
- `backend/src/services/vocabulary-set-service.js` orchestration entry points.
- Focused multipart middleware/error module if repository structure warrants it.
- Exact six POST/DELETE upload, remove, and cleanup routes from the PLAN.

### Acceptance criteria

- ADMIN routes mutate System Sets only; USER routes require exact owner/private Personal Set.
- One `cover` file, no text fields/multiple files; safe 400/401/403/concealed-404/413/415/502/503/500 mapping.
- Upload/remove return updated Set plus `meta.storage_cleanup`; cleanup preserves current object.
- Unauthorized requests reach neither Multer processing nor Storage.
- Rejected/failed input persists no object or metadata and no DB image bytes.

### Required tests/evidence

- Controller/service/API tests with fake Storage and in-memory buffers.
- Authorization-before-body, ownership, validation/error-envelope, no-leak, and no-mutation assertions.

### STOP / HUMAN checkpoint

- Stop if endpoint authorization or safe failure behavior cannot match the approved contract.

### Exclusions

- No frontend form, real provider call, signed URL, or global upload middleware.

## TASK-150 — Upload/security evidence checkpoint

### Goal

Review dependencies, processor safety, endpoints, and fake-adapter behavior before lifecycle/frontend work.

### Dependencies

- TASK-149 complete.

### Exact scope / expected files or modules

- TASK evidence/status only.

### Acceptance criteria

- Upload security, optimized output, bounds, authorization, errors, package footprint, and zero rejected-state mutation are proven.

### Required tests/evidence

- Focused backend/unit/API results, dependency audit as required, lint, build/runtime loading, and diff check.

### STOP / HUMAN checkpoint

**MANDATORY STOP D:** HUMAN must approve before TASK-151 and any frontend upload consumption.

### Exclusions

- No lifecycle expansion, UI, or real Storage call.

## TASK-151 — Cover replacement, removal, cleanup, and Set-delete lifecycle

### Goal

Implement failure-safe authoritative cover transitions and Set-owned cleanup.

### Dependencies

- TASK-150 HUMAN approved.

### Exact scope / expected files or modules

- Existing Vocabulary Set service/repository transaction and delete paths.
- Storage adapter calls and optional `meta.storage_cleanup` propagation.
- Managed→managed, managed→external, external→managed, external→external, remove, cleanup retry, and Set deletion.

### Acceptance criteria

- Existing cover stays authoritative while replacement is prepared.
- New managed object is validated/stored before metadata; old managed object is deleted only after metadata success.
- DB failure compensates only the new exact key and preserves old metadata.
- Cleanup failure keeps new/null metadata authoritative and reports retry required; retry never deletes current/unrelated objects.
- External resources are never fetched/deleted.
- Set deletion clears its exact managed prefix before DB deletion; cleanup failure preserves Set; retry is idempotent.

### Required tests/evidence

- Failure-injection matrix at upload, persistence, cleanup, compensation, and delete boundaries.
- Exact-prefix/unrelated-object preservation and idempotency tests.

### STOP / HUMAN checkpoint

- Stop on any design that requires arbitrary-key/global deletion, shared ownership, or a cleanup queue/table.

### Exclusions

- No scheduled cleanup worker, new table, CDN, proxy, or frontend behavior.

## TASK-152 — Independent managed-cover copy

### Goal

Preserve metadata while keeping every copied Set and managed cover independently owned.

### Dependencies

- TASK-151 complete.

### Exact scope / expected files or modules

- Existing copy service/repository transaction.
- Storage adapter server-side copy and compensation.
- Existing `POST /api/vocabulary-sets/:systemSetId/copy` contract.

### Acceptance criteria

- Exact CEFR copies, including legacy null.
- External URL copies directly with null key.
- Managed cover duplicates into destination Set prefix/key before DB transaction; source/destination never share one key.
- Storage failure creates no destination; DB failure compensates destination object; failed compensation produces safe deterministic orphan evidence.
- Ordered membership, private ownership, repeated copy, and 201 response remain unchanged.

### Required tests/evidence

- Service/API success and failure-injection tests for external/managed/null sources.
- Independence after source/destination replace/delete and unrelated-object preservation.

### STOP / HUMAN checkpoint

- Stop if managed copy would share the source object or partially create the destination aggregate.

### Exclusions

- No copy-route change, remote external fetch, or cross-provider copy.

## TASK-153 — Shared frontend metadata controls and service contract

### Goal

Create the reusable frontend state/service foundation only after the managed backend contract is stable.

### Dependencies

- TASK-152 complete.

### Exact scope / expected files or modules

- `frontend/src/services/vocabulary-set-service.js` projections, FormData upload, remove, cleanup, and response-meta handling.
- At most one focused shared metadata-controls module if justified.
- Shared state for persisted/draft URL, selected file/local preview, removal, pending/error/retry/cleanup warning.

### Acceptance criteria

- Accessible CEFR selector and mutually exclusive URL/file drafts.
- Preview priority follows PLAN; object URLs are revoked when replaced/removed/cancelled/unmounted.
- Replace/remove/Cancel are explicit; Cancel issues no mutation and preserves persisted cover.
- Client hints mirror MIME/5 MiB/HTTPS rules; backend remains authoritative.
- No crop, rotation, filters, editor, Supabase frontend client, or scheduler/business logic.

### Required tests/evidence

- Frontend service/unit/component tests for parsing, FormData, state transitions, object URL cleanup, no-request Cancel, errors, retry, accessibility.

### STOP / HUMAN checkpoint

- Stop if frontend requires storage credentials/keys or duplicates backend-authoritative validation.

### Exclusions

- No ADMIN/Personal page integration yet and no broad form redesign.

## TASK-154 — ADMIN System Set form integration

### Goal

Integrate required Set CEFR and full cover management into the existing ADMIN editor.

### Dependencies

- TASK-153 complete.

### Exact scope / expected files or modules

- `frontend/src/vocabulary-sets/admin-vocabulary-sets-page.jsx` and shared controls/service.
- Existing create/edit modal/editor behavior, Topic, description, Items, focus, and navigation.

### Acceptance criteria

- CEFR required for create and every edit result; legacy null edit prompts selection.
- Create external uses one JSON create; create file creates once then uploads by returned ID and retries upload only.
- Edit supports current/new preview, all approved replacements, remove, Cancel, pending/errors/retry/cleanup warning.
- Existing Topic/items and ADMIN authorization behavior remain unchanged.

### Required tests/evidence

- Focused ADMIN unit/component/mocked browser coverage including duplicate-create prevention and partial success.

### STOP / HUMAN checkpoint

- Stop if integration changes Topic/item or ADMIN permission contracts.

### Exclusions

- No Personal, Discovery, My Sets, or broad ADMIN redesign.

## TASK-155 — Personal Set form integration

### Goal

Integrate optional CEFR and full cover management into the existing owner Personal Set flow.

### Dependencies

- TASK-154 complete.

### Exact scope / expected files or modules

- `frontend/src/vocabulary-sets/my-vocabulary-sets-page.jsx` and shared controls/service.
- Existing Personal create/edit/membership/modal behavior.

### Acceptance criteria

- CEFR is optional and clearable; old null-metadata Sets remain usable/editable.
- Create/edit/replace/remove/Cancel/retry match TASK-154 sequencing and preserve prior cover on failure.
- Non-sensitive public-cover warning is visible/accessible without implying the private Set itself is public.
- Ownership, private visibility, membership, focus, and navigation remain unchanged.

### Required tests/evidence

- Focused Personal unit/component/mocked browser coverage, old-row compatibility, owner/non-owner behavior, and no duplicate create.

### STOP / HUMAN checkpoint

- Stop if Personal cover management changes Set visibility or ownership.

### Exclusions

- No sharing/publication feature or private/signed cover delivery.

## TASK-156 — Form functional checkpoint

### Goal

Obtain HUMAN approval of ADMIN/Personal metadata forms before read/display integration.

### Dependencies

- TASK-154 and TASK-155 complete.

### Exact scope / expected files or modules

- Manual-review runtime/evidence only; no new feature behavior.

### Acceptance criteria

- Required/optional CEFR, current/new previews, URL/file replacement, remove, Cancel, pending/errors/retry, cleanup warnings, responsive layout, keyboard/focus, and no broad redesign are demonstrable.

### Required tests/evidence

- Focused frontend tests/build/lint/diff plus documented manual routes/fixtures.

### STOP / HUMAN checkpoint

**MANDATORY STOP E:** HUMAN functional/visual approval is required before TASK-157.

### Exclusions

- No Discovery/My Sets presentation work before approval.

## TASK-157 — Public/Personal detail and card projection

### Goal

Render approved metadata through existing Set detail/card primitives with deterministic fallback.

### Dependencies

- TASK-156 HUMAN approved.

### Exact scope / expected files or modules

- `frontend/src/vocabulary-sets/public-vocabulary-set-pages.jsx`.
- Existing Set detail primitives and Personal detail/card consumers.
- Shared image/fallback behavior only if existing architecture supports reuse.

### Acceptance criteria

- CEFR and cover render where approved; missing/broken covers switch once to deterministic Topic/current fallback without loops.
- Public detail remains read-only while Learning/Quiz/copy actions and return routing remain intact.
- Personal ownership actions remain unchanged.

### Required tests/evidence

- Focused component/mocked browser tests for external/managed/null/broken cover and CEFR/null.
- Learning/Quiz/public-detail regressions.

### STOP / HUMAN checkpoint

- Stop if display integration requires a new API or changes Learning/Quiz contracts.

### Exclusions

- No page redesign or image proxy.

## TASK-158 — Discovery CEFR and persisted-cover integration

### Goal

Extend the complete client-composed catalog without changing its request/pagination architecture.

### Dependencies

- TASK-157 complete.

### Exact scope / expected files or modules

- `frontend/src/topics/discovery-catalog.js`.
- `frontend/src/topics/topic-list-page.jsx` and existing Discovery card/filter primitives.

### Acceptance criteria

- Cards prefer persisted cover and fall back deterministically on missing/broken images.
- All/A1/A2/B1/B2/C1 filter operates after complete catalog load and composes with Topic/search before pagination.
- Filter changes reset page one; invalid pages clamp; featured remains excluded; normal page size remains nine; page changes issue no requests.
- Null CEFR appears only without a specific CEFR filter.

### Required tests/evidence

- Pure filter/pagination tests and mocked browser coverage for composition, reset/clamp, 9/page, request counts, fallback, responsive/accessibility.

### STOP / HUMAN checkpoint

- Stop before any global endpoint, server pagination/search/filter, or request-contract change.

### Exclusions

- No new catalog endpoint or broad Discovery redesign.

## TASK-159 — My Sets metadata presentation

### Goal

Add cover/CEFR to the existing My Sets card/detail family without changing its information architecture.

### Dependencies

- TASK-158 complete.

### Exact scope / expected files or modules

- Existing My Sets cards/detail areas in `frontend/src/vocabulary-sets/my-vocabulary-sets-page.jsx` and shared primitives.

### Acceptance criteria

- Metadata/fallback integrates into current cards/details and remains usable with legacy nulls.
- Existing create/edit/delete/open/Learning/Quiz behavior and responsive grid remain unchanged.

### Required tests/evidence

- Focused My Sets component/browser tests plus existing owner CRUD/navigation regressions.

### STOP / HUMAN checkpoint

- Stop on any broad My Sets redesign or behavior expansion.

### Exclusions

- No new navigation/action or sharing behavior.

## TASK-160 — Fixture, mock, and harness contract migration

### Goal

Update existing test infrastructure minimally for nullable metadata without fabricating historical data.

### Dependencies

- TASK-159 complete.

### Exact scope / expected files or modules

- Direct `vOCABULARY_SET.create` sites in backend tests.
- Frontend mocked API fixtures and guarded integration fixtures.
- Performance benchmark composition/fixtures and manual Learning fixture where Set projections are consumed.

### Acceptance criteria

- Nullable legacy fixtures remain null unless a scenario explicitly consumes metadata.
- No global/default CEFR backfill; existing semantics/assertions remain intact.
- Run-owned cleanup continues to preserve unrelated TEST users, sessions, Topics, Sets, and Storage objects.

### Required tests/evidence

- Focused fixture-dependent backend/frontend suites, lint, and artifact/diff review.

### STOP / HUMAN checkpoint

- Stop if fixture migration would alter production behavior or globally reset shared TEST state.

### Exclusions

- No benchmark optimization or unrelated fixture refactor.

## TASK-161 — Dedicated guarded TEST Storage isolation checkpoint

### Goal

Prove real-provider verification cannot access Main/Preview/Production Storage or unrelated TEST assets.

### Dependencies

- TASK-147 adapter/config complete and TASK-160 harness migration complete.

### Exact scope / expected files or modules

- Existing guarded TEST environment helper and real-storage test harness/config only.
- Verify dedicated TEST URL/project, bucket, credential, namespace, and run-owned prefix.
- Do not auto-create, empty, or globally list/delete a bucket.

### Acceptance criteria

- Missing/equal/non-TEST values fail closed with no provider call.
- Pre/post unrelated TEST object/data counts or exact markers are preserved.
- Cleanup targets only run-owned keys/rows and succeeds idempotently.
- No secrets appear in output/artifacts.

### Required tests/evidence

- Guard result, scrubbed identity/isolation evidence, read/write/copy/remove probe confined to a unique run prefix, and cleanup proof.

### STOP / HUMAN checkpoint

**MANDATORY STOP F:** HUMAN approval is required before any broader real Supabase TEST Storage suite. If isolation cannot be proven, mark real-provider work BLOCKED; fake/mocked verification may remain valid, but do not use another environment.

### Exclusions

- No Main/Preview/Production access, bucket creation/policy mutation, global sweep, or credential printing.

## TASK-162 — Security, browser, and guarded real-stack regression coverage

### Goal

Verify the complete approved feature and its unaffected contracts after TEST Storage isolation approval.

### Dependencies

- TASK-160 complete.
- TASK-161 HUMAN approved for real Storage portions.

### Exact scope / expected files or modules

- Backend security/resource suites.
- ADMIN, Personal, public/copy, Discovery, My Sets mocked and guarded real-stack specs.
- Existing Learning, Quiz, Progress, authentication/authorization regressions.

### Acceptance criteria

- Unsupported/oversized/spoofed/malformed/over-dimension inputs, busy/timeout, unauthorized/wrong-owner, invalid URL, key traversal/foreign key, and no-fetch/no-DB-bytes cases pass.
- ADMIN and Personal create/edit/replace/remove/Cancel/retry pass.
- System→Personal external/managed copy is independent and compensated on failure.
- Discovery CEFR/cover/fallback and My Sets/detail pass; Learning/Quiz/Progress remain unchanged.
- Real-provider cleanup removes only run-owned assets and preserves unrelated TEST state.

### Required tests/evidence

- Focused backend/unit/component/mocked Playwright.
- Guarded TEST DB migration parity and guarded real-stack suites.
- Five representative post-warm-up upload measurements with processing vs remote latency separated.
- Production build, touched/full lint as required, secret/artifact scan, and `git diff --check`.

### STOP / HUMAN checkpoint

- Stop before changing production code if a remaining failure exposes a new contract/design decision rather than an implementation defect.

### Exclusions

- No optimization, new endpoint, schema expansion, or shared-data reset.

## TASK-163 — Final functional and visual HUMAN checkpoint

### Goal

Provide the complete feature for HUMAN review before documentation closure.

### Dependencies

- TASK-162 complete.

### Exact scope / expected files or modules

- Existing TEST-only manual-review runtime/fixtures and evidence.

### Acceptance criteria

- HUMAN can inspect ADMIN and Personal create/edit, current/new preview, replace/remove/Cancel, errors/retry, public/personal cards/details, copy, Discovery CEFR filter/fallback, My Sets, responsive behavior, keyboard/focus, and non-sensitive-cover warning.

### Required tests/evidence

- Review URLs/account/fixtures, desktop/tablet/mobile checks, and confirmation unrelated TEST state remains intact.

### STOP / HUMAN checkpoint

**MANDATORY HUMAN VISUAL STOP:** Do not proceed to closure documentation until HUMAN approves the complete functional/visual result.

### Exclusions

- No polish outside approved metadata integration and no production environment access.

## TASK-164 — Documentation and feature-status reconciliation

### Goal

Synchronize official contracts with the verified implementation without prematurely marking the feature DONE.

### Dependencies

- TASK-163 HUMAN approved.

### Exact scope / expected files or modules

- `docs/DATABASE.md`, `docs/API_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/UI_UX_SPEC.md`, `docs/FEATURE_STATUS.md`.
- Non-secret environment example and deployment/storage runbook or repository-equivalent documentation.
- SPEC/PLAN/TASK evidence/status reconciliation.

### Acceptance criteria

- Docs record nullable migration/no backfill/no blob, JSON/upload/remove/cleanup/copy contracts, one public-read/backend-write model, sensitive-image warning, exact envs, lifecycle/compensation, forms, Discovery/My Sets, and TEST isolation.
- Feature remains `IN_PROGRESS` until formal TEST, REVIEW, and HUMAN closure approval.

### Required tests/evidence

- Documentation consistency/search for stale contracts, secret scan, links/paths review, and diff check.

### STOP / HUMAN checkpoint

- Stop on any implementation/doc drift requiring product or architecture reconsideration.

### Exclusions

- No behavior change or early `DONE` status.

## TASK-165 — Formal TEST

### Goal

Execute the formal project TEST workflow against the final approved scope.

### Dependencies

- TASK-164 complete.

### Exact scope / expected files or modules

- Read/follow `.agents/skills/test/SKILL.md`.
- Execute the final matrix required by the approved SPEC/PLAN/TASK, using guarded `.env.test` only for DB/Storage integration.
- Record results/evidence in the TASK/status documents as workflow requires.

### Acceptance criteria

- Schema/migration, backend/API/security/resource, storage/lifecycle/copy, frontend/unit/browser, guarded real stack, regressions, build, lint, secret/artifact scan, and diff checks all have accurate PASS/FAIL/NOT RUN evidence.
- Unrelated TEST data/assets remain preserved.

### Required tests/evidence

- Complete formal matrix and environment/isolation evidence; no claimed pass without executed output.

### STOP / HUMAN checkpoint

**MANDATORY FORMAL TEST STOP:** Report failures/blockers and await HUMAN authorization before review if formal acceptance is not satisfied.

### Exclusions

- No test weakening, Main/Preview/Production access, commit, or push.

## TASK-166 — Formal REVIEW and closure preparation

### Goal

Review implementation against all approved contracts and prepare—not perform—closure.

### Dependencies

- TASK-165 formal TEST accepted.

### Exact scope / expected files or modules

- Read/follow `.agents/skills/review/SKILL.md` and applicable closure workflow.
- Review SPEC/PLAN/TASK traceability, implementation diff, schema/API/UI/docs/security, tests, artifacts, and repository status.
- Reconcile `docs/FEATURE_STATUS.md` to DONE only after TEST + REVIEW + HUMAN approval evidence supports it.

### Acceptance criteria

- Findings are severity-classified and no unresolved issue is hidden.
- No stale contract, secret, temp/build/raw benchmark artifact, unintended dependency/schema/API/UI change, or unrelated refactor remains.
- Working tree is ready for a separately authorized commit; proposed commit/integration path is reported but not executed.

### Required tests/evidence

- Lightweight closure verification as needed, carried-forward formal evidence, `git diff --check`, status, branch/base comparison, and stash identity.

### STOP / HUMAN checkpoint

**MANDATORY FORMAL REVIEW/CLOSURE STOP:** HUMAN approval is required before any commit, push, or integration.

### Exclusions

- No commit, push, merge, rebase, or unapproved remediation.

## Execution guardrails

- Execute strictly in task/dependency order; checkpoint approval authorizes only the tasks explicitly released afterward.
- Frontend upload work cannot start until TASK-150 is HUMAN approved.
- Real Supabase Storage calls cannot start until TASK-161 is HUMAN approved.
- Use fake adapters for ordinary unit/API/browser tests; never silently fall back to real credentials.
- No schema/API/dependency/provider/resource-bound change beyond the approved SPEC/PLAN without returning to the appropriate approval stage.
- Never access Main/Preview/Production databases or Storage during TEST work; never globally reset shared TEST state.
- Do not touch `stash@{0}`.

## Unresolved blockers

- None. TASK-164 documentation reconciliation, HUMAN-approved TASK-165 formal TEST, and TASK-166 formal REVIEW are complete.
- No unresolved product-contract decision remains; commit, push, and integration await separate HUMAN closure authorization.
