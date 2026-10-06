# TASKS: Performance V1 — App Loading & Runtime Baseline

**Status:** `HUMAN APPROVED — TASK-109..TASK-125 COMPLETE / REVIEW APPROVED`

**Approved sources:**

- `docs/specs/PERFORMANCE_V1_SPEC.md` — HUMAN APPROVED on 2026-10-05.
- `docs/plans/PERFORMANCE_V1_PLAN.md` — HUMAN APPROVED on 2026-10-05.

**Execution boundary:** TASK approval authorizes work only in the order and between the gates below. It does not authorize automatic progression from the BEFORE baseline into optimization. No commit, push, Main/Preview/Production DB access, destructive load, or `stash@{0}` operation is included.

## 1. Overview

These tasks establish a minimally invasive performance-measurement harness, prove its isolation, collect a reproducible BEFORE baseline for seven review flows representing the six approved SPEC benchmark groups, and stop for HUMAN candidate selection. Post-baseline optimization tasks are conditional placeholders: they have no executable scope until HUMAN selects a measured problem, target, files, and regression boundary.

No task assumes that the existing bundle advisory, `/api/topics` mocked proxy noise, or prior remote TEST DB/Supabase latency is an application defect.

## 2. Global Execution Guardrails

- DB-backed commands must load `backend/.env.test` explicitly and pass the existing TEST-environment guard. Never load or mutate `backend/.env`, Main, Preview, or Production.
- Use dedicated local ports, serial performance runs, isolated Playwright contexts, and test-owned sessions/fixtures. Preserve manual and unrelated TEST users/sessions.
- Fixture cleanup may target only run-owned identifiers. No broad reset, destructive load, high concurrency, or cleanup by shared role/email pattern.
- Raw traces/logs belong in an ignored transient directory. Versioned artifacts must be scrubbed of passwords, hashes, cookies, tokens, session IDs, sensitive headers/bodies, database URLs, and personal data.
- Use one excluded warm-up and at least five retained measured samples per required condition. Keep all samples; report median and min/max spread without cherry-picking.
- Production-build measurements and dev-server diagnostics must be labeled separately.
- Do not install a dependency or change schema/index, API behavior, caching architecture, auth, durable telemetry, or major architecture without the separate checkpoint in TASK-121–TASK-123.
- Do not modify production behavior during TASK-109–TASK-120. If reliable measurement requires such a change, stop for HUMAN review.

## 3. Dependency and Gate Map

```text
TASK-109 Environment/fixture contract
   ↓
TASK-110 Production build + isolated browser harness
   ↓
TASK-111 API/request/readiness evidence
   ↓
TASK-112 TEST-only Prisma/query + artifact pipeline
   ↓
TASK-113 Harness safety verification
   ↓
HUMAN HARNESS CHECKPOINT — STOP
   ↓ approval
TASK-114 Cold Guest/Login
   ↓
TASK-115 Login + session restore
   ↓
TASK-116 Dashboard
   ↓
TASK-117 Owned Sets
   ↓
TASK-118 Set Detail
   ↓
TASK-119 Flashcard Learning/SRS
   ↓
TASK-120 Topics/public discovery + baseline consolidation
   ↓
HUMAN BASELINE + CANDIDATE-SELECTION CHECKPOINT — STOP
   ↓ explicit candidate authorization
TASK-121 Conditional frontend optimization
TASK-122 Conditional backend/query optimization
TASK-123 Conditional perceived-loading optimization
   ↓ only selected tasks execute
TASK-124 AFTER measurement/comparison
   ↓
TASK-125 Final regression, TEST, REVIEW and closure preparation
   ↓
HUMAN CLOSURE REVIEW — STOP
```

TASK-121–TASK-123 are not parallel by default. Their final order and dependencies must follow the HUMAN-selected candidate set and overlapping files/contracts.

## 4. Ordered Tasks

### TASK-109 — Freeze Measurement Environment and Fixture Contract

**Purpose:** Define a reproducible, safe execution manifest before writing or running measurement tooling.

**Prerequisites:** TASK document HUMAN approved; branch/HEAD/worktree recorded.

**Environment:** Read-only repository inspection. `.env.test` may be validated without connecting; no database access.

**Likely files/artifacts:** performance harness configuration or manifest under existing test infrastructure; future `docs/performance/PERFORMANCE_V1_BASELINE.md` metadata outline; ignore rules only if an approved transient path is not already ignored.

**Exact scope:** Record production/dev runtime commands, dedicated ports, browser/version/viewport, cache rules, readiness markers, one warm-up plus five-sample policy, fixture shapes/counts, run-owned naming, cleanup ownership, and remote-TEST labeling. Map the seven review flows to SPEC BF-01–BF-06 without changing the approved benchmark boundary.

**Out of scope:** Creating fixtures, connecting to DB, measurement execution, targets, candidate selection, production changes.

**Required evidence / acceptance criteria:** Manifest identifies every environment and marker; no secret value is recorded; manual users/sessions are explicitly excluded from cleanup; Main/Preview/Production and `backend/.env` are explicitly forbidden.

**Verification:** Inspect paths/config references; secret-pattern review; `git diff --check`.

**STOP condition:** Any required environment, representative fixture, or cleanup boundary cannot be defined without unsafe access or a product-contract decision.

### TASK-110 — Build Production Frontend and Isolated Browser Harness

**Purpose:** Provide production-build serving and isolated browser execution without changing application behavior.

**Prerequisites:** TASK-109 complete.

**Environment:** Local production frontend build on a dedicated port; mocked API for frontend-only smoke checks; no DB.

**Likely files/artifacts:** new performance-specific Playwright config/helpers/scripts under `frontend/`; existing `frontend/package.json` only if a narrowly scoped script is useful; ignored `frontend/test-results/performance/`; no production component/router modification.

**Exact scope:** Build with existing Vite; serve emitted assets locally; launch serial Chromium with fresh contexts; support explicit cold/warm cache state; capture browser/version, navigation/resource timing, production asset requests, route readiness markers, screenshots/traces only when useful.

**Out of scope:** Route lazy loading, chunk configuration changes, bundle optimization, dependencies, full baseline.

**Required evidence / acceptance criteria:** Harness reaches Login using built assets; fresh contexts do not share auth/cache unintentionally; production and dev modes are distinguishable; dedicated ports do not disturb manual runtime.

**Verification:** Production build; one non-baseline smoke invocation; harness lint; inspect transient outputs and process cleanup.

**STOP condition:** Built frontend cannot reach required routes without changing production/API behavior, port isolation fails, or browser state leaks across contexts.

### TASK-111 — Add Request, Duplicate, API and Route-Readiness Observation

**Purpose:** Capture consistent browser/network and usable-route evidence for every benchmark.

**Prerequisites:** TASK-110 complete.

**Environment:** Local isolated production frontend; mocked responses for deterministic smoke proof; guarded real-stack wiring may be configured but not baseline-measured.

**Likely files/artifacts:** performance Playwright helpers/spec skeleton; scrubbed JSON schema/serializer; transient trace directory.

**Exact scope:** Record normalized method/path/query category, status, request order, browser duration, resource/payload size where reliable, duplicate semantic requests, waterfall/overlap, route start, route-specific usable marker, blocking/local loading, layout/flash observations, and perceived responsiveness notes. Exclude sensitive headers/bodies.

**Out of scope:** Declaring a duplicate a bug, adding production headers, modifying services/components, benchmark conclusions.

**Required evidence / acceptance criteria:** A deterministic smoke flow produces stable request/readiness records; duplicate detection rules are documented; readiness uses usable content rather than URL/spinner-only markers; output allowlist contains no auth secrets.

**Verification:** Focused helper tests or fixture-driven smoke; artifact schema validation; lint; manual redaction inspection; `git diff --check`.

**STOP condition:** Correlation or timing requires production instrumentation/API response changes, or sensitive data cannot be reliably excluded.

### TASK-112 — Add Bundle/Gzip, Guarded API Timing, Prisma Query and Artifact Pipeline

**Purpose:** Complete minimally invasive build/backend/query attribution and reproducible artifact generation.

**Prerequisites:** TASK-111 complete.

**Environment:** Build-size work is DB-free. Backend smoke uses only a dedicated integration runtime explicitly loaded from `.env.test`, serial requests, and a test-owned Prisma client.

**Likely files/artifacts:** dependency-free bundle-size script if required; performance integration runner/helpers; TEST-only Prisma query observer; scrubbed JSON output; baseline document skeleton; ignore-rule update where necessary.

**Exact scope:** Record raw/gzip emitted sizes; guarded API total elapsed time and response bytes; TEST-only per-request query count/order/redacted shape/duration where Prisma supports it; separate browser, server, query, and remote/unattributed time honestly; generate deterministic scrubbed summaries.

**Out of scope:** New package, raw DB bypass, production logging/telemetry, exact network subtraction from unmatched samples, schema/index/query changes.

**Required evidence / acceptance criteria:** `.env.test` guard is demonstrated before connection; no destructive reset; query parameters and secrets are absent; a bounded smoke request maps to a serial query sequence; remote contribution limitations remain explicit.

**Verification:** Guard-failure check without `.env.test`; one bounded TEST-owned smoke request; build-size script check; redaction scan; scoped cleanup verification; lint/diff check.

**STOP condition:** Guard cannot prove TEST DB identity, observation would expose sensitive values, cleanup could affect unrelated data, or production code/dependency/schema/API change appears necessary.

### TASK-113 — Verify Harness Safety and Stop for HUMAN Approval

**Purpose:** Prove the harness is reproducible, isolated, minimally invasive, and safe before full measurements.

**Prerequisites:** TASK-109 through TASK-112 complete.

**Environment:** Local production build plus dedicated TEST runtime only for bounded smoke proof; `.env.test` mandatory.

**Likely files/artifacts:** harness files from prior tasks; a small scrubbed smoke report; TASK evidence/status updates.

**Exact scope:** Verify ports/process cleanup, fresh browser contexts, separate test session, run-owned fixture cleanup, manual/unrelated session preservation, cache control, sample metadata, request/readiness records, bundle sizes, API/query observation, ignored raw output, and versioned artifact redaction.

**Out of scope:** BF-01–BF-06 baseline collection, bottleneck classification, any optimization.

**Required evidence / acceptance criteria:** Harness smoke succeeds; production code/API/schema/dependencies are unchanged; unrelated TEST users/sessions remain; every guardrail has recorded evidence.

**Verification:** Focused harness checks, production build, touched-file lint, `git diff --check`, `git status`, scope/secret scan.

**Mandatory HUMAN checkpoint:** **STOP after reporting harness files, commands/results, TEST isolation, fixture cleanup, artifact example, redaction result, and limitations. TASK-114 is forbidden until HUMAN explicitly approves the harness.**

**Checkpoint evidence (2026-10-05):** `COMPLETE — PENDING HUMAN APPROVAL`. The production-build/browser harness uses dedicated frontend port `4186`; the guarded TEST backend/query observer uses port `5012`. Missing TEST configuration fails closed with `UNSAFE_TEST_DATABASE_CONFIGURATION`. Dedicated TEST migration status reported 7 migrations and schema up to date. The read-only smoke passed 1/1, captured Login readiness/resources plus GET `/api/topics` API/request/query evidence, and recorded unrelated TEST USER/session counts unchanged (`4→4`, `7→7`). Scrubber unit tests passed 2/2; generated raw evidence is ignored and a sensitive-pattern scan found no match. Production build, touched frontend lint, syntax/static checks and `git diff --check` passed. Smoke timings are explicitly not baseline findings.

### TASK-114 — Measure Cold Guest/Login (BF-01)

**Purpose:** Establish the cold initial application/Login production baseline.

**Prerequisites:** TASK-113 HUMAN approved.

**Environment:** Local production frontend build, fresh isolated Guest contexts, deterministic mocked API where auth initialization requires control; no DB unless separately justified and approved.

**Likely files/artifacts:** scrubbed raw JSON; transient traces/screenshots; BF-01 section of `docs/performance/PERFORMANCE_V1_BASELINE.md`.

**Exact scope:** One excluded warm-up plus at least five cold measured runs to `/login`; record entry JS/CSS/font/image assets, raw/gzip mapping, request count/order/duration, usable-form readiness, loading/layout stability, and blocking assets. Warm cache may be recorded as a clearly separate comparison.

**Required evidence / acceptance criteria:** All samples and environment/cache metadata retained; median/min/max reported; measured facts, symptoms, and inferences separated.

**Verification:** Rerun reproducibility spot-check; artifact redaction and schema validation.

**STOP condition:** Uncontrolled cache/runtime variance invalidates comparison, or measurement exposes sensitive data.

### TASK-115 — Measure Login and Authenticated Session Restore (BF-02)

**Purpose:** Baseline successful login-to-Dashboard and authenticated reload behavior.

**Prerequisites:** TASK-114 complete.

**Environment:** Local production frontend + dedicated backend + `.env.test`; isolated test-owned USER/session; serial execution.

**Likely files/artifacts:** BF-02 baseline section, scrubbed samples, ignored representative trace.

**Exact scope:** One warm-up plus at least five measured login→Dashboard runs and five direct authenticated `/dashboard` restore runs under documented cache conditions; capture `/api/auth/me`, login calls, redirects/guards, duplicate auth requests, shell and route readiness, loading flashes, browser/API/server/query timing where measurable.

**Required evidence / acceptance criteria:** HUMAN/manual session remains authenticated; test session cleanup is scoped; login credentials/session identifiers are absent from artifacts; medians/spreads and attribution limitations recorded.

**Verification:** Authenticated `/api/auth/me` smoke for the test-owned session; cleanup verification; sample/redaction validation.

**STOP condition:** Auth measurement affects unrelated sessions, fixture is unstable, or auth/security behavior would need modification.

### TASK-116 — Measure Dashboard (BF-03)

**Purpose:** Baseline Dashboard independent sources and perceived readiness.

**Prerequisites:** TASK-115 complete.

**Environment:** Production frontend + dedicated backend + `.env.test`; same documented representative USER fixture.

**Likely files/artifacts:** BF-03 baseline section and scrubbed request/API/query samples.

**Exact scope:** Warm-up plus five measured Dashboard loads; record Learning Progress and owned-Set request start/order/overlap, duplicates, durations, payload sizes, section-specific usable markers, partial loading behavior, render/loading observations, backend/query counts/order, and remote anomalies.

**Required evidence / acceptance criteria:** Independent section semantics are preserved; no existing request is called redundant without repeated semantic evidence; browser, server/query, and remote/unattributed cost are distinguished.

**Verification:** Sample completeness check; compare request/query sequence across runs; no data mutation beyond test session/fixture lifecycle.

**STOP condition:** Representative data changes mid-run or attribution is too weak to support a conclusion; classify as inconclusive rather than inventing a cause.

### TASK-117 — Measure Owned Sets List (BF-04A)

**Purpose:** Baseline `/my/vocabulary-sets` list loading and route usability.

**Prerequisites:** TASK-116 complete.

**Environment:** Production frontend + dedicated backend + `.env.test`; fixed test-owned USER and bounded owned Sets.

**Likely files/artifacts:** BF-04 Owned Sets subsection and scrubbed samples.

**Exact scope:** Warm-up plus five measured navigations under documented cache state; record list request count/order/duration/payload, repeated fetches, usable-list readiness, assets, localized/full loading, layout stability, perceived transition, and relevant query count/order.

**Required evidence / acceptance criteria:** Set order/count fixture remains stable; median/spread and anomalies recorded; no ownership or identity contract is altered.

**Verification:** Fixture shape before/after; artifact redaction/schema check.

**STOP condition:** Run-owned cleanup or ownership isolation cannot be proven.

### TASK-118 — Measure Owned Set Detail (BF-04B)

**Purpose:** Baseline transition from owned Sets to one representative Set Detail.

**Prerequisites:** TASK-117 complete.

**Environment:** Same guarded real stack and fixed owned Set fixture.

**Likely files/artifacts:** BF-04 Set Detail subsection and scrubbed samples.

**Exact scope:** Warm-up plus five measured list→detail transitions; record detail/refetch calls, request waterfall and duplicates, payload/API/query evidence, route/action/content readiness, blocking versus localized loading, assets, and layout/perceived continuity.

**Required evidence / acceptance criteria:** Exact Set/vocabulary identity and order remain unchanged; observations distinguish intentional refetch from proven redundancy; median/spread reported.

**Verification:** Fixture identity/order check; repeated sequence comparison; no mutations performed.

**STOP condition:** Measurement would require changing Set contracts or ownership behavior.

### TASK-119 — Measure Flashcard Learning / SRS (BF-05)

**Purpose:** Baseline first-card readiness and non-mutating Flashcard interactions without weakening SRS guarantees.

**Prerequisites:** TASK-118 complete.

**Environment:** Production frontend + dedicated backend + `.env.test`; representative non-empty owned Set and controlled eligible SRS snapshot; isolated session.

**Likely files/artifacts:** BF-05 baseline section, scrubbed samples, optional representative trace.

**Exact scope:** Warm-up plus five measured entries; record route/assets, SRS snapshot request, first-card readiness, query evidence, one flip interaction, pronunciation-resource behavior where present, and restart/re-entry fetching. Do not rate cards in the baseline unless a later HUMAN-approved narrower measurement explicitly requires mutation.

**Required evidence / acceptance criteria:** No rating mutation is submitted; SRS eligibility, idempotency, AGAIN semantics, queue uniqueness, and NORMAL read-only behavior remain unchanged; session/manual data is preserved.

**Verification:** Before/after progress-row comparison for the fixture; request log proves zero rating mutation; focused state sanity check; redaction validation.

**STOP condition:** Baseline changes scheduling/progress, creates duplicate pending items, or requires scheduler/API changes.

### TASK-120 — Measure Topics/Public Discovery, Consolidate BEFORE Baseline, and Stop

**Purpose:** Complete BF-06, consolidate all BEFORE evidence, classify findings, and obtain HUMAN candidate selection.

**Prerequisites:** TASK-114 through TASK-119 complete with valid artifacts.

**Environment:** Production frontend + dedicated backend + `.env.test`; fixed public Topic/System Set fixtures; serial isolated browser.

**Likely files/artifacts:** `docs/performance/PERFORMANCE_V1_BASELINE.md`; optional scrubbed JSON summary; ignored traces; TASK evidence/status update.

**Exact scope:** Run one warm-up plus five measured `/topics`→Topic→public Sets→public Set Detail flows; capture request sequence/count/duplicates, API/query timings, payloads, readiness, assets, loading/layout continuity. Then consolidate BF-01–BF-06 facts, symptoms, inferred causes, remote anomalies, inconclusive items, and issues not worth optimizing. Rank candidate proposals by user impact, confidence, expected benefit, implementation risk, regression risk, and comparable AFTER feasibility; propose baseline-derived targets.

**Required evidence / acceptance criteria:** Every approved flow has complete environment/cache/sample metadata, median/min/max, request/readiness evidence, relevant assets/API/query observations, and honest limitations. `/api/topics` mocked ECONNREFUSED noise, bundle advisory, and remote latency are contextual unless baseline proves impact. Secrets scan passes.

**Verification:** Artifact completeness/traceability against SPEC AC-01–AC-06 and AC-11–AC-12; sample-count validator; redaction/scope review; production build record; lint and `git diff --check` for harness/docs.

**Mandatory HUMAN checkpoint:** **STOP and report per-flow measurements, strongest bottlenecks, root-cause confidence, non-actionable findings, remote anomalies, ranked candidates, proposed targets, and candidate-specific risk. No TASK-121, TASK-122, or TASK-123 work may begin until HUMAN explicitly selects a candidate and authorizes its exact scope. “No optimization justified” is a valid decision and skips directly to appropriate closure evidence.**

### TASK-121 — Conditional Selected Frontend/Delivery Optimization

**Purpose:** Implement only a HUMAN-selected, baseline-proven frontend/network/bundle candidate.

**Prerequisites:** TASK-120 HUMAN approval naming the candidate, target, files/surfaces, regression scope, and order.

**Environment:** Development and test runtime appropriate to the selected candidate; DB only through `.env.test` when its regression flow requires it.

**Likely files/artifacts:** **Conditional and unknown until selection**—may include existing router/page/service/assets/tests plus baseline decision record. TASK must be amended with exact paths before implementation.

**Exact scope:** Only the approved candidate, such as proven duplicate-fetch removal, approved route delivery change, or oversized-asset reduction. Preserve API/auth/ownership/accessibility/product behavior.

**Required evidence / acceptance criteria:** Candidate-specific tests pass; comparable measurement meets the approved target without shifting cost unacceptably to frequent routes.

**Verification:** Focused unit/browser/real-stack checks mapped in PLAN, build/bundle comparison, touched-file lint, `git diff --check`.

**Separate STOP:** Schema/index, dependency, API behavior, cache architecture, auth, durable telemetry, significant contract, or major architecture impact requires HUMAN approval before any edit. Stop on a real regression or missed target; do not broaden scope.

### TASK-122 — Conditional Selected Backend/Query Optimization

**Purpose:** Implement only a HUMAN-selected, baseline-proven backend processing or query candidate.

**Prerequisites:** TASK-120 HUMAN approval and any earlier selected task whose output is a real dependency; exact target/scope documented.

**Environment:** Guarded `.env.test` only, serial focused integration and real-stack verification.

**Likely files/artifacts:** **Conditional and unknown until selection**—existing service/repository/tests and baseline decision record; exact paths required before implementation.

**Exact scope:** Only demonstrated repeated/sequential/N+1 or processing work with request/query evidence. Preserve route/controller/service/repository boundaries, authorization, ordering, transactions, response shape, and business rules.

**Required evidence / acceptance criteria:** Query/API evidence improves to the approved target; payload and semantic results remain identical; run-owned cleanup preserves unrelated records.

**Verification:** Focused backend integration, authorization/ownership checks, affected real-stack flow, query-count comparison, lint/diff checks.

**Separate STOP:** Any index/schema/migration, raw DB bypass, API behavior, dependency/cache, or transaction/contract change requires distinct HUMAN approval. Remote latency alone cannot authorize code changes.

### TASK-123 — Selected Authenticated Identity Lookup Improvement

**Purpose:** Consolidate the HUMAN-selected redundant authenticated session/user lookup while preserving the complete Auth and authorization contract.

**Prerequisites:** TASK-120 HUMAN approval and exact affected state/target/tests documented.

**Environment:** Isolated mocked browser plus guarded `.env.test` real stack; same BF-02 readiness markers as baseline.

**Likely files/artifacts:** Existing Authentication service/user repository and focused Auth tests; baseline decision/evidence records.

**Exact scope:** Use existing Prisma capabilities to combine demonstrably redundant per-request session and user reads. Preserve token hashing, active-user and unexpired-session validation, USER/ADMIN authorization, cookies, session lifetime, logout behavior, response shape, and uniform authentication failure behavior. No cross-request cache or architectural Auth change.

**Required evidence / acceptance criteria:** `/api/auth/me` query count and server timing improve materially; valid, missing, expired, deleted, and inactive identity semantics remain equivalent; no authorization or public-contract regression.

**Verification:** Focused Auth unit/contract checks, mocked Auth browser checks, affected guarded real-stack BF-02 route, query-count/timing comparison, build/lint/diff.

**Separate STOP:** Any Auth architecture, cache, cookie, session-lifetime, schema/index/migration, dependency, authorization, or API contract change requires HUMAN approval.

### TASK-124 — Repeat AFTER Measurements and Publish Comparison

**Purpose:** Measure retained HUMAN-approved optimizations with the same methodology and record an honest BEFORE/AFTER comparison.

**Prerequisites:** All selected TASK-121–TASK-123 batches individually verified and HUMAN allowed to proceed; or HUMAN selected no optimization, in which case record that decision and skip inapplicable AFTER samples.

**Environment:** Same production build, browser/version/viewport, fixtures, cache rules, ports, `.env.test`, warm-up, and five-sample policy used by the corresponding BEFORE flow.

**Likely files/artifacts:** `docs/performance/PERFORMANCE_V1_AFTER.md`; scrubbed AFTER JSON; ignored traces; updated baseline decision links.

**Exact scope:** Repeat every changed-area benchmark plus sufficient BF-01–BF-06 coverage to expose shared regressions; retain all samples; compare medians and spread, request/query counts, assets, readiness, and perceived behavior; explain environmental differences and keep/rollback recommendation per batch.

**Required evidence / acceptance criteria:** No cherry-picking; approved targets evaluated; unexplained material regressions identified; application gains separated from remote TEST variance; every retained batch has comparable evidence.

**Verification:** Sample/method equivalence review, target calculation check, artifact redaction, production build, focused regressions, lint/diff.

**Mandatory HUMAN checkpoint:** Stop for HUMAN keep/revise/rollback decision if any candidate misses target, creates regression, or comparison conditions are not equivalent.

### TASK-125 — Final Regression, Formal TEST/REVIEW, and Closure Preparation

**Purpose:** Verify complete Performance V1 scope and prepare evidence for HUMAN closure approval.

**Prerequisites:** TASK-124 complete and all keep/rollback decisions resolved.

**Environment:** Mocked regression suites plus `.env.test`-only focused/real-stack tests; no Main/Preview/Production.

**Likely files/artifacts:** SPEC/PLAN/TASK evidence; baseline/AFTER docs; `docs/FEATURE_STATUS.md`; API/architecture/database/UI docs only if separately approved retained changes require synchronization.

**Exact scope:** Trace SPEC AC-01–AC-12; confirm product/API/security/accessibility contracts; run proportional focused tests and full mocked browser suite when shared frontend surfaces changed; verify Auth/session, USER/ADMIN, Sets, Topics, Quiz regression surface, SRS authority/idempotency/AGAIN/NORMAL isolation, cleanup isolation, production build, touched-file lint, `git diff --check`, status/scope/secret/temp review. Use TEST then REVIEW skills.

**Required evidence / acceptance criteria:** Formal TEST `PASS`; formal REVIEW `APPROVE`; baseline and AFTER/decision artifacts complete; no unexplained material regression or unapproved schema/index/API/dependency/cache/architecture change; feature status remains not `DONE` until HUMAN approval.

**Verification:** Record every exact command/result and every `NOT RUN` reason; inspect final branch/HEAD/diff and artifact hygiene.

**Final HUMAN checkpoint:** **STOP for HUMAN closure review. Do not mark `DONE`, commit, push, deploy, integrate, or touch `stash@{0}` without separate authorization.**

## 5. Acceptance-Criteria Traceability

| Approved criterion | Primary tasks |
|---|---|
| AC-01 reproducible BF-01–BF-06 BEFORE baseline | TASK-109–TASK-120 |
| AC-02 requests/readiness/assets per flow | TASK-110–TASK-120 |
| AC-03 browser/backend/DB/network attribution | TASK-111–TASK-120 |
| AC-04 safe query evidence | TASK-112–TASK-120 |
| AC-05 evidence-backed ranking | TASK-120 |
| AC-06 HUMAN baseline/candidate approval | TASK-120 mandatory STOP |
| AC-07 comparable AFTER evidence/targets | TASK-121–TASK-124 |
| AC-08 no unexplained regression | TASK-124–TASK-125 |
| AC-09 product/API/security/accessibility preserved | TASK-109–TASK-125 guardrails and regression gates |
| AC-10 no unapproved architecture/schema/dependency/cache work | TASK-113, TASK-120–TASK-125 STOP rules |
| AC-11 secret-free artifacts | TASK-109–TASK-125 redaction checks |
| AC-12 honest remote/app separation | TASK-112, TASK-114–TASK-125 |

## 6. Known Context, Not Preselected Problems

- Full mocked browser suite recently passed 116/116 after stale Learning Progress fixture repair.
- SRS V1 real-stack and CI Guarded Integration passed.
- `/api/topics` ECONNREFUSED output in mocked tests is known non-blocking proxy noise.
- The production build emits a bundle-size advisory.
- Remote TEST DB/Supabase latency anomalies have occurred.

These facts guide measurement controls but authorize no optimization.

## 7. Approval Gate

```text
SPEC STATUS: HUMAN APPROVED
PLAN STATUS: HUMAN APPROVED
TASK STATUS: HUMAN APPROVED — TASK-109..TASK-125 COMPLETE / REVIEW APPROVED
HARNESS CHECKPOINT: HUMAN APPROVED
IMPLEMENTATION AUTHORIZED: TASK-114..TASK-120 ONLY — COMPLETE
BLOCKER (2026-10-05): dedicated remote TEST DB/Supabase pooler returned repeated Prisma P1001 connectivity failures (one TASK-119 fixture operation, then two backend-start attempts). Partial/rejected samples are not authoritative baseline evidence. No product optimization is authorized.
RETRY EVIDENCE (2026-10-06): `.env.test` safety guard passed, but the read-only Prisma migration-parity preflight reached the dedicated TEST datasource and returned `Schema engine error`; parity and stable connectivity were not verified. The authoritative baseline was not started, no partial baseline was generated, and protected TEST user/session counts were not read.
DIAGNOSIS (2026-10-06): HUMAN accepted incorrect direct Prisma CLI env loading as the preflight root cause. The guarded wrapper and Prisma Client path both selected the dedicated TEST datasource successfully.
AUTHORITATIVE BASELINE (2026-10-06): 7/7 serial benchmark tests passed; every condition retained five complete samples after one excluded warm-up. Guarded cleanup preserved unrelated TEST users `5→5` and sessions `8→8`. Results and candidate ranking are recorded in `docs/performance/PERFORMANCE_V1_BASELINE.md`.
NEXT ALLOWED ACTION: HUMAN closure/commit decision. TASK-109 through TASK-125 are complete; no additional optimization is authorized.
MANDATORY BEFORE-BASELINE STOP: TASK-120
```

### Selected-candidate checkpoint evidence (2026-10-06)

- HUMAN approved the authoritative baseline and selected Learning Progress, Learning Set/SRS read, and authenticated identity lookup in that order. Bundle/code-splitting work remains deferred.
- TASK-121 Learning Progress replaced three effective-status count queries with one minimal-field summary read and derives the unfiltered total from the authoritative summary inside the existing repeatable-read transaction. API shape and derived due semantics are unchanged.
- TASK-121 measurement: Dashboard query count `16 → 13–14`; readiness median `4,100 → 3,146 ms`; Progress server median approximately `3,125 → 2,119 ms`. This is a material improvement, but narrowly misses the proposed `3,000/2,000 ms` targets.
- TASK-121 verification: scheduler unit `5/5`, guarded Learning integration `21/21`, Dashboard/Learning Progress mocked browser `18/18`, focused BF-03 `1/1`; cleanup preserved unrelated TEST users/sessions `5→5` / `8→8`.
- TASK-122 inspection/measurement: each Learning Set read is six sequential Prisma relation queries (Set, membership, Vocabulary, Meaning, Example, Progress). Focused non-mutating BF-05 remained 28–29 total queries, first-card median `2,998 ms`, and full sequence median `8,505 ms`.
- A meaningful TASK-122 query-count reduction requires enabling Prisma relation joins in generator/schema configuration and regenerating the client, or using forbidden raw SQL. The no-schema alternative merely rearranges six queries and adds assembly/over-fetch risk. Per HUMAN guardrails, TASK-122 stopped before any such change.
- This earlier checkpoint stopped before TASK-123 while TASK-122 awaited approval; the subsequent approved implementation evidence is recorded below.

### TASK-122/TASK-123 implementation evidence (2026-10-06)

- HUMAN approved Prisma 6.19.3's PostgreSQL `relationJoins` capability for the Learning Set/SRS read only. Generator/client regeneration required no database migration or persisted-schema change.
- TASK-122 retained result: each Learning Set read collapsed from six ordered remote relation queries to one PostgreSQL joined relation query. Focused BF-05 total query count fell from `28–29` to `13–14`; first-card median improved from `2,998 ms` to `1,987 ms`; full-sequence median improved from `8,505 ms` to `5,504 ms`.
- TASK-122 regression: Prisma schema validation/client generation passed; scheduler unit `5/5`, guarded Learning integration `21/21`, frontend Learning service unit `4/4`, and full mocked Learning/SRS browser `22/22` passed. No payload, ordering, eligibility, scheduling, or NORMAL-mode contract difference was observed.
- HUMAN also approved conservative TASK-123 consolidation. Authenticated identity now loads the session and its user in one Prisma query, then preserves the original post-read expiry and active-user checks; cookie, session lifetime, logout, authorization, and public API behavior are unchanged.
- TASK-123 measurement: authenticated `/api/auth/me` changed from two sequential remote queries to one. Its server median improved from approximately `568 ms` in the authoritative BEFORE baseline to `269 ms`; focused authenticated-restore readiness was `2,409 ms` after the change. Unit Auth `15/15`, mocked Auth browser `9/9`, and focused real-stack BF-02 `1/1` passed.
- At the TASK-122/TASK-123 checkpoint, cleanup preserved unrelated TEST users/sessions `5→5` / `8→8`; TASK-124 was still gated. Its later authorized evidence follows.

### TASK-124 authoritative AFTER evidence (2026-10-06)

- HUMAN approved retaining Prisma 6.19.3's broader generated join behavior for existing nested relation reads. The audited paths and contract assumptions are recorded in `docs/performance/PERFORMANCE_V1_AFTER.md`.
- Proportional real-stack regression covered Auth, Dashboard/Progress, Learning/SRS/NORMAL, private Vocabulary, Quiz, Topics, public/private/admin Sets, ownership, isolation, ordering, and create/edit/remove behavior. All 51 intended scenarios passed across the initial run and focused reruns; two shared-TEST fixture assumptions required test-only isolation corrections.
- A fresh post-approval AFTER run—not the provisional run—passed 7/7 serial benchmark scenarios with one excluded warm-up and five complete retained samples for all nine conditions.
- Material readiness medians versus BEFORE: Dashboard `4,100→2,590 ms`, authenticated restore `4,400→2,421 ms`, Owned Set Detail `3,102→1,058 ms`, BF-05 `8,843→3,922 ms`, BF-06 `3,335→2,438 ms`.
- Cleanup preserved unrelated TEST users/sessions `5→5` / `8→8`. No query required containment. HUMAN subsequently authorized TASK-125 formal closure review.

### TASK-125 formal TEST / REVIEW evidence (2026-10-06)

- Formal review found one genuine TASK-123 expiry-boundary regression: the optimized predicate captured the comparison time before the remote query completed. The approved in-scope correction retains one joined `AUTH_SESSION → USER` query and restores the original post-read expiry decision.
- The corrected Auth component suite passed `16/16`, including an exact expired-after-read regression test. Focused real-stack Auth passed `2/2` for USER and ADMIN identity.
- Focused BF-02 passed `1/1`: login→Dashboard and authenticated restore each retained one excluded warm-up plus five measured samples. `/api/auth/me` remained one query; restore samples were `2,448–2,480 ms`, consistent with the accepted AFTER result.
- The previously accepted TASK-124 evidence is carried forward: intended real-stack matrix `51/51`, affected mocked browser matrix `89/89`, Auth/Scheduler unit `20/20`, harness artifact unit `2/2`, Prisma validate/generate PASS, and production build PASS with only the existing bundle advisory.
- Final lint/syntax, secret scan, transient-artifact policy, `git diff --check`, status/scope, and documentation checks passed. No schema migration, index, API contract, dependency, cache, raw-SQL, or unrelated product change was introduced.
- Durable harness source/config/tests and aggregate BEFORE/AFTER documents are retained. Raw benchmark JSON, traces, screenshots, build output, and Playwright results remain ignored transient artifacts; no temporary diagnostic script is retained.
- Formal severity verdict: no unresolved CRITICAL, HIGH, MEDIUM, or LOW product finding. TEST `PASS`; REVIEW `APPROVE`; Performance V1 is ready for HUMAN closure/commit approval.
