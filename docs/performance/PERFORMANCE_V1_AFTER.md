# Performance V1 — Authoritative AFTER Measurement

**Status:** `HUMAN APPROVED — TASK-124 AUTHORITATIVE / TASK-125 REVIEW APPROVED`

**Measured:** 2026-10-06
**Branch / commit:** `dev` / `a00f5c5be919e6ab1dacf8ac92c0b4778d85ab95`
**Compared with:** `docs/performance/PERFORMANCE_V1_BASELINE.md`

## 1. Environment and method

- Windows x64, Node `22.20.0`, Playwright `1.63.0`, Chromium `153.0.8010.12`.
- Production frontend on `127.0.0.1:4186`; guarded TEST backend on `127.0.0.1:5012`.
- Dedicated `.env.test` datasource only. The safety guard and ordinary Prisma Client connectivity passed; 7 migrations were present with none pending.
- The Performance runner loads `.env.test`, then `configureTestEnvironment()` validates `TEST_DATABASE_URL` and maps it to `DATABASE_URL`; it cannot fall back to `.env`.
- Viewport `1366 × 768`, one excluded warm-up and five retained measured samples for every condition, one worker, serial execution.
- Readiness definitions, cold/warm handling, browser isolation, route behavior, cache behavior, and the 250 ms post-measurement observer drain match the approved BEFORE methodology.
- BF-02 waits for Progress and owned Sets. BF-05 is non-mutating. BF-06 uses SPA navigation.
- Every retained response completed with an HTTP status. No sample was rejected or cherry-picked.

## 2. Approved relation-loading scope audit

Prisma 6.19.3 `relationJoins` changes the default strategy for existing nested relation projections. HUMAN approved retaining that project-wide generated-query behavior while keeping the explicit `relationLoadStrategy: "join"` only on the Learning Set/SRS read.

| Production path | Nested projection / joined behavior | Contract assumptions verified |
|---|---|---|
| `learning-repository.listProgress` | Progress items join Vocabulary identity | Progress order remains `last_reviewed_at DESC NULLS LAST`, `created_at DESC`, `id ASC`; filters, pagination, scheduling fields, and `evaluated_at` are unchanged and USER-isolated. |
| `learning-repository.findAccessibleSetForUser` | Explicit joined Topic, ordered membership, Vocabulary, meanings, examples, and USER Progress | Public-or-owner access remains in the root predicate; membership uses `position ASC`; meanings/examples use `created_at ASC, id ASC`; exact Vocabulary identity and SRS/NORMAL payloads remain unchanged. |
| `vocabulary-set-repository` summary reads | Existing public, system, and owner-private lists join `_count.items` | Top-level `created_at ASC`, public/private filters, owner isolation, and count values remain unchanged. |
| `vocabulary-set-repository` detail reads | Public detail joins ordered items/Vocabulary; private detail additionally joins first deterministic Meaning/Example | Root public or owner predicate remains authoritative; membership uses `position ASC`; Meaning/Example use `created_at ASC, id ASC` with existing `take: 1`; no foreign-private content is exposed. |
| Vocabulary Set picker and create-result reads | Picker joins first ordered Meaning; idempotent create-result joins exact Vocabulary/Meanings/Examples | Picker owner/canonical predicate and `word ASC, id ASC` order remain unchanged; nested Meaning/Example order and exact vocabulary identity remain unchanged. |
| Vocabulary repository detail reads | Canonical/private detail joins Meanings and Examples | Canonical or owner predicate remains at the root; existing Meaning/Example order and response shape remain unchanged. |
| Quiz accessible Set read | Set joins ordered items, exact Vocabulary, ordered Meanings, and current USER Progress | Public-or-owner access, `position ASC`, Meaning `created_at ASC, id ASC`, exact identity, selected POS/meaning, and per-USER Progress isolation remain unchanged. |
| Nested projections returned by existing create operations | Existing Vocabulary/Set create responses may use joined nested result projection | Create/edit/remove semantics and response shapes passed existing real-stack regressions; no mutation logic or transaction boundary changed. |
| Authenticated identity lookup | One `AUTH_SESSION` lookup joins its related USER projection | The service preserves the original post-read expiry check and active-USER check; cookie, lifetime, logout, role, and public Auth contracts are unchanged. |

No query required explicit containment or rollback. Raw-SQL lock/mutation paths were not changed by `relationJoins` and remain outside this optimization.

## 3. BEFORE and AFTER measured facts

All durations are milliseconds. Values in brackets are retained sample minimum and maximum. Negative deltas are improvements.

| Flow | BEFORE readiness median | AFTER readiness median `[min, max]` | Absolute delta | Percent delta | BEFORE queries | AFTER queries `[min, max]` |
|---|---:|---:|---:|---:|---:|---:|
| BF-01 cold Login | 359 | 398 `[367, 662]` | +39 | +10.8% | 0 | 0 `[0, 0]` |
| BF-01 warm Login reload | 161 | 168 `[164, 174]` | +7 | +4.2% | 0 | 0 `[0, 0]` |
| BF-02 Login → Dashboard | 4,382 | 2,859 `[2,838, 2,879]` | −1,523 | −34.7% | 16 | 10 `[10, 10]` |
| BF-02 authenticated restore | 4,400 | 2,421 `[2,389, 2,902]` | −1,979 | −45.0% | 16 `[16, 18]` | 9 `[9, 11]` |
| BF-03 Dashboard | 4,100 | 2,590 `[2,579, 2,605]` | −1,510 | −36.8% | 16 `[16, 18]` | 9 `[9, 11]` |
| BF-04A owned Sets | 2,055 | 1,546 `[1,021, 1,561]` | −509 | −24.8% | 5 | 3 `[3, 4]` |
| BF-04B owned Set Detail | 3,102 | 1,058 `[1,051, 1,600]` | −2,044 | −65.9% | 9 | 3 `[3, 4]` |
| BF-05 Flashcard/SRS sequence | 8,843 | 3,922 `[3,409, 4,935]` | −4,921 | −55.7% | 28 | 8 `[8, 8]` |
| BF-06 Topics → public Set Detail | 3,335 | 2,438 `[1,884, 3,439]` | −897 | −26.9% | 7 | 5 `[4, 5]` |

Frontend request counts remained identical to BEFORE for every flow: Cold/Warm `8`, Login submission `6`, restore/Dashboard `13`, Owned Sets/Detail `11`, BF-05 `19`, and BF-06 `12`.

Cold Login's `+39 ms` median change is a small absolute local/browser variance on a query-free route, not evidence of an application regression. Warm Login changed by only `+7 ms`.

## 4. Optimized-area evidence and attribution

### TASK-121 — Learning Progress

- Progress server median: approximately `3,125 → 1,654 ms` on standalone Dashboard (`−47.1%`).
- Dashboard query median: `16 → 9`; the reduction is shared between TASK-121 summary work, TASK-123's three authenticated identity checks, and the approved joined Progress→Vocabulary projection.
- Dashboard readiness: `4,100 → 2,590 ms` (`−36.8%`).
- Summary, filters, pagination, exact Vocabulary identity, scheduling fields, and derived due state passed real-stack regression.

### TASK-122 — Learning/SRS and broader approved relation joins

- Learning Set relation work: `6 → 1` query per read.
- Learning Set server median: approximately `2,231 → 628 ms` (`−71.8%`), with `[531, 1,073]` remote spread across 15 reads.
- BF-05 total query median: `28 → 8` after combined relation and Auth improvements.
- First-card median: `3,042 → 1,480 ms` (`−51.3%`).
- Full BF-05 sequence: `8,843 → 3,922 ms` (`−55.7%`).
- Owned Set Detail's `9 → 3` query reduction includes joined nested items/Vocabulary/Meanings/Examples plus TASK-123 Auth consolidation.
- BF-06's `7 → 4–5` queries reflects joined existing public Set count/detail relations. Topic metadata queries themselves are unchanged.

### TASK-123 — Authenticated identity

- Authenticated identity: `2 → 1` database query per check.
- `/api/auth/me` server median: approximately `569 → 275 ms` (`−51.7%`) in authenticated restore.
- Authenticated restore readiness: `4,400 → 2,421 ms` (`−45.0%`), also benefiting from TASK-121 and joined Progress relations.
- Auth USER/ADMIN identity, expiry/logout flow, protected-route authorization, and private-resource ownership passed focused regression.

## 5. Regression and long-tail observations

- No product contract, ordering, ownership, authorization, visibility, SRS/NORMAL, Quiz, or response-shape regression was observed.
- The broadened real-stack matrix covered 51 scenarios. Two initial failures were test isolation defects: a globally unique hardcoded canonical word and an unscoped nullable-Topic locator. Run-unique/scoped test-only corrections passed focused reruns.
- Remote TEST latency remains bimodal in some conditions. Authenticated restore retained a `2,902 ms` maximum; Owned Sets had `[1,021, 1,561]`; Owned Set Detail `[1,051, 1,600]`; BF-05 `[3,409, 4,935]`; BF-06 `[1,884, 3,439]`.
- Query and server sums remain remote/pooler observations and are not production latency forecasts.
- The complete AFTER run was analyzed and promoted into this durable aggregate; faster provisional samples were discarded and not promoted. The ignored raw JSON was subsequently cleared by the later mocked Playwright run's shared `test-results` cleanup, as expected for a transient artifact.

## 6. Conclusions and deferred opportunities

- TASK-121, TASK-122, the broadened approved `relationJoins` behavior, and TASK-123 remain justified by material query and readiness reductions with green contract regression.
- No affected query required containment. There is no evidence supporting a schema/index/migration, raw SQL rewrite, cache, API change, or additional query refactor.
- Route-level code splitting remains deferred. The production build is unchanged at approximately `668.60 kB` entry JavaScript (`194.11 kB` gzip), and the query-free Login route remains locally ready in hundreds of milliseconds.
- Large static images remain outside the measured Login request set and are not selected for optimization.
- HUMAN accepted TASK-124 as authoritative. TASK-125 formal review is `APPROVE`; Performance V1 is ready for the separately gated closure/commit decision.

## 7. Isolation and artifact result

- Pre-run and post-cleanup unrelated records remained `5 → 5` TEST users and `8 → 8` TEST sessions.
- No stale benchmark fixture existed before the authoritative run.
- Run-owned benchmark cleanup reported `unchanged: true`.
- Raw benchmark, trace, screenshot, fixture, and cleanup artifacts use ignored `frontend/test-results/` storage. The authoritative raw JSON passed the harness safety assertion and was fully analyzed before a later mocked Playwright run cleared that transient directory; this document is the retained authoritative aggregate.
- Persisted documentation contains no password, cookie, token, session identifier, database URL, or personal fixture data.

## 8. TASK-125 closure verification

- Formal review detected and corrected one TASK-123 expiry-boundary issue while retaining the approved one-query Auth optimization: expiry is evaluated after the remote session/user read, as it was before Performance V1.
- Focused Auth component tests passed `16/16`; focused real-stack Auth passed `2/2`.
- A fresh focused BF-02 check passed with one excluded warm-up and five retained samples for each condition. Authenticated restore measured `2,448–2,480 ms`, `/api/auth/me` remained one query, and cleanup preserved unrelated TEST users/sessions `5→5` / `8→8`.
- The full authoritative AFTER table above remains the accepted comparison. The focused closure check is regression evidence, not a replacement or cherry-picked new aggregate.
