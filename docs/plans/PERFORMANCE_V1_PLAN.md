# PLAN: Performance V1 — App Loading & Runtime Baseline

**Status:** `HUMAN APPROVED — IMPLEMENTED / VERIFIED`

**Approved source:** `docs/specs/PERFORMANCE_V1_SPEC.md` — HUMAN APPROVED on 2026-10-05.

**Workflow result:** HUMAN approved this PLAN on 2026-10-05. Its gated baseline, selected optimization, AFTER comparison, regression, and formal review stages completed through TASK-125 on 2026-10-06. Commit and push remain separately gated.

## 1. Objective

Establish a reproducible BEFORE baseline for the six approved benchmark flows, attribute observed cost to the browser, frontend request orchestration, backend processing, database/query work, or remote network where evidence permits, and stop for HUMAN selection of optimization candidates and numeric targets. Only approved, evidence-backed candidates may then be implemented in small batches and compared against the same baseline.

The plan preserves current product behavior and treats the existing bundle advisory, mocked-suite proxy noise, and earlier remote TEST DB latency as signals to measure rather than predetermined defects.

## 2. Assumptions and Boundaries

- Current baseline commit at PLAN creation is `a00f5c5be919e6ab1dacf8ac92c0b4778d85ab95`; every executed benchmark must record its actual commit and dirty-worktree state.
- React/Vite, Express, Prisma, PostgreSQL, the current API contracts, and the USER/ADMIN role model remain unchanged by default.
- The measurement harness must use test-owned browser contexts, sessions, users, and bounded fixtures. It must not invalidate or delete unrelated manual TEST users or sessions.
- Any DB-backed measurement uses only the dedicated database configured by `backend/.env.test`. Main, Preview, Production, and the database configured by `backend/.env` are forbidden.
- No persistent performance entity, schema migration, index, dependency, cache, external service, durable telemetry, or API behavior change is planned.
- Measurements must redact cookies, authorization/session identifiers, database URLs, passwords, personal data, and secrets before an artifact is retained.
- Development-server results are diagnostic only. User-facing loading and bundle conclusions use a production frontend build served locally.
- No optimization candidate, implementation file list, or numeric target is selected before the BEFORE baseline checkpoint.

## 3. Existing Project Facilities to Reuse

- `frontend/package.json` — existing Vite build, preview, lint, Node test, and Playwright commands.
- `frontend/vite.config.js` — current build and local API proxy behavior; build output is the source for entry/chunk/asset sizes.
- `frontend/src/app-router.jsx` — current eager route graph to inspect and measure, not an authorization to introduce lazy loading.
- `frontend/playwright.config.js` — mocked browser coverage and isolated Playwright contexts.
- `frontend/playwright.integration.config.js` and focused real-stack configs — serial real-stack orchestration patterns, dedicated ports, traces, and test isolation.
- `frontend/e2e/integration/global-setup.js` and backend test helpers — guarded TEST environment setup and run-owned cleanup patterns.
- `backend/test/scripts/start-integration-server.js` — `.env.test`-guarded application startup through the normal Express/Prisma architecture.
- Existing accessible headings, regions, lists, cards, and status states in Auth, Dashboard, Sets, Learning, and Topics — route-specific usable-content markers.
- Existing frontend services and backend controller/service/repository boundaries — request and query attribution surfaces.
- Existing mocked browser, backend integration, and real-stack suites — regression evidence; they are not substituted for performance measurements.

Reuse does not require modifying these production modules during Phase A. Test-only measurement adapters or scripts are preferred when existing facilities do not expose sufficient evidence.

## 4. Affected Areas

- **Database:** read-only observation through normal application requests against `.env.test`; no schema or data-model change planned. Bounded fixture setup/cleanup may write only run-owned TEST records.
- **Backend:** initially observed, not changed. Test-only timing/query instrumentation may wrap the integration runtime without changing production responses or logging.
- **API:** no contract change planned. Browser-observed timing, request count, payload size, and test-runtime processing/query timing are measurement concerns only.
- **Frontend:** initially observed, not changed. Production build output and browser behavior are measured; later changes require an approved candidate.
- **Tests:** a dedicated, serial performance harness may be added after TASK approval; existing functional suites remain authoritative for regression.
- **Documentation:** baseline, candidate decision, AFTER comparison, and final status artifacts will be synchronized as their checkpoints are reached.

## 5. Environment Matrix

| Environment | Purpose | Runtime and data | Permitted conclusions |
|---|---|---|---|
| Local production frontend, mocked API | BF-01 asset/parse/render baseline and controlled frontend request/render diagnostics | `vite build` output served locally; deterministic intercepted responses; fresh isolated contexts | Frontend delivery, browser work, route readiness, controlled waterfall; not backend/DB latency |
| Local production frontend + local backend + TEST DB | Primary real-stack BF-02–BF-06 evidence | Built frontend on a dedicated port; Express integration server on a dedicated port; `backend/.env.test`; test-owned USER/session/fixtures | End-to-end browser timing and request behavior, plus separately captured test-runtime backend/query evidence |
| Local dev frontend + local backend + TEST DB | Diagnostic comparison only | Vite dev server and the same guarded backend/fixtures | HMR/dev-mode anomalies and debugging; never the production-loading baseline |
| Direct guarded API runner + TEST DB | API and query attribution | Normal controllers/services/repositories through `createApp`; serial bounded requests | Backend elapsed time, query count/order/duration, payload size; label remote DB/network contribution limits |
| Mocked browser regression | Contract and UI regression | Existing Playwright mocks, no database | Behavior preservation only, not real-stack performance |

If `.env.test` points to remote Supabase, the artifact must label the result “remote TEST path.” It must not claim that network/provider variance is local backend processing. No alternate database may be silently substituted.

## 6. Benchmark Fixtures and Isolation

Phase A will define one deterministic fixture manifest before execution:

- one test-owned USER with a test-owned session strategy;
- a bounded representative owned-Set list;
- one non-empty owned Set with stable ordered vocabulary and meanings for Set Detail and SRS;
- explicit SRS states sufficient to load an eligible snapshot without altering scheduler semantics;
- one Topic with representative public Sets and one public Set Detail;
- fixture IDs/names tagged by the performance run so cleanup targets only run-owned records.

The manifest records counts and data shape but contains no credentials or session values. Fixture setup and cleanup reuse guarded `.env.test` patterns and run serially. A failed cleanup must stop DB-backed measurement and must never trigger broad deletion.

The manual-review account and unrelated TEST records are outside the cleanup scope. Authentication measurements use a separate browser context and session from any HUMAN browser.

## 7. Measurement Methodology

### 7.1 Repetition and Cache Rules

- Record commit SHA, worktree state, OS/machine context, browser/version, viewport, build mode, runtime ports, TEST-path classification, timestamp, and fixture manifest revision.
- Use one warm-up run per flow and cache condition, excluded from summaries.
- Capture at least five measured samples per approved flow/condition. Retain all samples and report median plus min/max; do not delete outliers. Explain identifiable environmental anomalies alongside the complete sample set.
- A cold browser case uses a fresh Playwright browser context with cache disabled or cleared before navigation. A warm case reuses the explicitly documented context/cache state.
- Run benchmark flows serially to avoid cross-flow CPU, port, fixture, and remote DB contention.
- Use a fixed primary desktop viewport for numeric comparison. Approved responsive breakpoints remain regression coverage rather than separate performance populations unless baseline evidence requires a narrower follow-up.

### 7.2 Browser and Network Evidence

Use Playwright and browser Performance APIs/CDP capabilities already available through the installed browser stack to capture:

- navigation and resource timings;
- request URL category, method, status, start order, browser-observed duration, transferred/resource size where available, and initiator context where reliable;
- duplicate requests defined as the same method plus normalized path/query and same semantic purpose during one flow;
- route start and a route-specific usable-content marker timestamp;
- DOM/content and loading-state observations, accessible status announcements, layout shift or flash evidence, and blocking versus localized loading;
- screenshots only at useful readiness/failure boundaries and traces only for diagnosis or retained representative samples.

Timing scripts must use stable readiness markers, not arbitrary sleeps. Raw cookies, request bodies containing secrets, and sensitive headers must not be attached to artifacts.

### 7.3 Bundle and Asset Evidence

- Run the existing production build without changing chunk configuration.
- Record Vite output filenames and raw sizes; produce deterministic gzip sizes with a lightweight repository script only if the existing build output does not provide them.
- Map entry and route-used JS/CSS/assets from browser resource evidence rather than assuming every emitted chunk blocks a route.
- Record the existing advisory verbatim as an observation. Evaluate entry delivery and frequent-route readiness together so a smaller entry bundle cannot mask a new route waterfall.
- Do not install a bundle analyzer unless the baseline cannot answer an approved question and HUMAN separately approves the dependency.

### 7.4 API and Backend Timing

- Capture browser-observed API duration for each benchmark request.
- Repeat important endpoints through the guarded API runner under the same fixture and serial conditions to capture total server-side elapsed time without bypassing routes, middleware, authentication, authorization, controllers, or services.
- Compare browser-observed and server-observed samples only as attribution evidence; do not subtract unmatched samples as if the remainder were exact network time.
- Record response payload bytes, status, request ordering, and whether independent work overlaps or forms a waterfall.
- If production-code instrumentation would be required to split a duration further, record the limitation and request approval rather than altering responses or global logging.

### 7.5 Prisma and Query Observation

- Configure query events only on the test-owned Prisma client used by the dedicated measurement runtime, when supported by the current Prisma version.
- Record per-request query count, normalized operation/model or redacted query shape, order, and Prisma-reported duration. Never retain parameter values containing user data or secrets.
- Correlate a bounded request to its query sequence in a serial run. Do not infer N+1 from elapsed duration alone.
- Classify repeated query shapes as N+1 only when count scales with the bounded result set or one request demonstrably repeats dependent work.
- Query observation must not use the main `.env`, raw database access, destructive load, or broad production logging.

### 7.6 Render and Perceived-Performance Evidence

- Record first stable usable content for each route and whether old usable content remains during a background refresh.
- Note full-page loading, independent section loading, error/empty-state transitions, duplicate flashes, focus behavior, and layout instability.
- Use React render/commit tooling only for a flow with evidence of a render bottleneck; do not add permanent render counters preemptively.
- For flip/navigation interactions, collect a small controlled interaction sample and visual/trace evidence only where browser timing suggests delay.
- Performance changes must preserve accessible live/status behavior, keyboard/focus semantics, reduced motion, and responsive layout.

## 8. Benchmark Flow Matrix

| ID | Exact flow and usable marker | Required evidence |
|---|---|---|
| BF-01 | Fresh context → direct `/login` → Login form is visible, interactive, and stable | Production entry JS/CSS/font/image requests and sizes; navigation/resource timing; route readiness; blocking assets; request count; loading/layout observations |
| BF-02 | Isolated USER login → Dashboard usable; then direct authenticated `/dashboard` reload in the test-owned session → shell and route content usable | Login/auth calls, `/api/auth/me`, redirects/guards, duplicate calls, shell/content readiness, session restore flashes, browser vs guarded backend timing |
| BF-03 | Direct authenticated `/dashboard` → greeting plus independently usable Progress and owned-Set sections | Progress/Set request start and completion order, overlap/waterfall, payload/timing, section readiness, duplicate calls, loading isolation, related query summaries |
| BF-04 | `/my/vocabulary-sets` usable list → open representative owned Set → Set Detail actions/content usable | List/detail calls, transition readiness, refetch/duplicates, payloads, localized/full loading, query count/order for list and detail |
| BF-05 | Representative Set Detail → `/learn/vocabulary-sets/:setId` → first SRS card usable; flip once; inspect pronunciation resource; restart/re-enter without rating | Route/module/assets, SRS snapshot call, first-card readiness, duplicate/re-entry calls, interaction observation, query summary; no scheduling mutation in baseline setup |
| BF-06 | `/topics` usable → Topic → public Set discovery → public Set Detail usable | Request sequence/count, repeated Topic/Set calls, route readiness, payloads, assets, loading continuity, backend/query summaries |

For every row, store raw samples separately from the written conclusion. Quiz, ADMIN, Learning Progress pagination, registration, and private Vocabulary editing remain regression surfaces unless a confirmed shared bottleneck expands focused measurement with HUMAN approval.

## 9. Evidence Artifacts

Artifacts are created only after TASK approval and execution authorization.

### 9.1 Versioned Documents

- `docs/performance/PERFORMANCE_V1_BASELINE.md`
  - environment and fixture manifest summaries;
  - exact commands and readiness markers;
  - BF-01–BF-06 median/min/max tables;
  - request/duplicate/query summaries;
  - loading/render observations;
  - limitations and remote anomalies;
  - observation-versus-conclusion labels;
  - ranked candidate table and proposed numeric targets;
  - HUMAN baseline decision record.
- `docs/performance/PERFORMANCE_V1_AFTER.md`
  - approved candidate and target references;
  - same-method BEFORE/AFTER comparison;
  - per-batch regression evidence;
  - unexplained regressions and limitations;
  - rollback/keep decision.

### 9.2 Machine-Readable Evidence

- A deterministic JSON summary under a later TASK-approved performance artifact path, containing metadata, samples, normalized request metrics, readiness timings, build assets, API timings, and query counts.
- JSON is preferred over CSV because each flow contains nested samples and request/query sequences. A derived CSV may be generated only when it materially aids review.
- Large Playwright traces, screenshots, raw build output, and transient query logs remain in an ignored run directory such as `frontend/test-results/performance/`; only small, scrubbed evidence needed for reproducibility is versioned.

### 9.3 Evidence Classes

- **Repeatable benchmark data:** controlled samples meeting the environment, fixture, cache, and repetition rules.
- **One-off diagnostic notes:** traces or observations used to explain a sample; never promoted to a baseline statistic alone.
- **Remote-environment anomalies:** TEST DB/network/provider events recorded with timestamp and context, excluded only with an explicit explanation while raw samples remain visible.

The TASK stage must confirm artifact paths against existing ignore rules before producing data.

## 10. Phase Sequence

### Phase A — Baseline Harness / Measurement Setup

1. Record the environment matrix, fixture manifest, safety guards, ports, browser project, cache rules, readiness markers, and repetition policy.
2. Add the smallest test/dev-only orchestration needed to serve the production build with a guarded local backend; keep the existing dev-server path as a labeled diagnostic comparison.
3. Add or extend serial Playwright measurement helpers for navigation/resource timing, normalized request counting, readiness markers, and scrubbed outputs.
4. Add guarded API timing and test-only Prisma query observation only where existing test facilities cannot provide the required attribution.
5. Capture production build/chunk sizes with existing tooling or one dependency-free script.
6. Prove harness isolation with a smoke run: `.env.test` guard active, dedicated ports, separate browser context/session, run-owned cleanup, no sensitive artifact fields, and no product behavior mutation.

**STOP if:** `.env.test` cannot be proven, measurement requires main/Preview/Production access, cleanup cannot be scoped to run-owned data, secrets appear in output, or meaningful attribution requires production/API/schema/dependency changes.

### Phase B — BEFORE Baseline

1. Prepare the bounded TEST fixtures once per documented run strategy.
2. Build the frontend and record asset output.
3. Execute BF-01 through BF-06 serially with the approved warm-up, sample, cache, and readiness rules.
4. Capture browser/network, API, query, asset, and perceived-loading evidence applicable to each flow.
5. Repeat or label environmental anomalies without hiding raw samples.
6. Populate the baseline document and machine-readable summary; verify redaction and reproducibility.

**Mandatory HUMAN BEFORE baseline STOP:** present evidence, limitations, bottleneck classifications, ranked candidates, proposed numeric targets, and recommended candidate set. No optimization planning or implementation proceeds without explicit HUMAN approval.

### Phase C — Bottleneck Classification

Classify each observation as one of:

- frontend/network waterfall;
- duplicate or redundant fetch;
- unnecessary rerender or render blocking;
- bundle/chunk/loading asset issue;
- backend processing;
- DB/query/N+1/sequential database work;
- remote Supabase/database/network latency;
- perceived-loading UX issue;
- no meaningful issue/not worth optimizing;
- inconclusive—requires a narrower measurement.

Each classification must cite flow, sample evidence, responsible layer confidence, user impact, and measurement limitation. Duration alone is insufficient evidence for duplicate work, N+1, or a specific remedy.

### Phase D — Optimization Candidate Selection

Rank only confirmed issues using:

1. measurable user impact on an approved flow;
2. confidence that evidence identifies the responsible layer;
3. expected benefit and an available comparable AFTER measure;
4. change size, architecture/security/contract risk, and rollback simplicity;
5. regression-test feasibility and coverage of shared surfaces;
6. whether the issue is application-controlled rather than remote variance.

For each candidate propose a baseline-derived numeric target, exact scope boundary, likely affected areas, regression matrix, and rollback condition. “No optimization worth implementing” is a valid outcome.

**Mandatory HUMAN candidate-selection STOP:** HUMAN chooses candidates and targets. Any chosen work that changes schema/index, API behavior, dependency, cache, durable instrumentation, authentication, authorization, or architecture requires a separate explicit approval and documentation reconciliation before TASK/implementation.

### Phase E — Targeted Optimization

1. Convert only HUMAN-selected candidates into TASK entries.
2. Implement one small logical batch at a time using the existing architecture.
3. Add focused regression coverage before or with the batch.
4. Run the candidate-specific measurement immediately after the batch under the same conditions.
5. Retain, revise, or roll back the batch based on its approved target and regressions.

Possible techniques such as removing duplicate fetches, parallelizing proven-independent work, removing demonstrated N+1 queries, route-code lazy loading, asset reduction, localized loading, or repeated-computation removal remain examples only. This PLAN does not assert that any is necessary.

**STOP before implementation** if the selected technique expands beyond the HUMAN-approved candidate or requires a contract/architecture approval listed above.

### Phase F — AFTER Measurement / Regression

1. Rebuild and rerun the same relevant benchmark samples, environment, fixtures, cache rules, and readiness markers.
2. Compare all relevant BEFORE and AFTER samples, not only the best run.
3. Rerun BF-01–BF-06 sufficiently to detect an unexplained material regression outside the optimized flow.
4. Run focused unit/browser/backend/real-stack regressions proportional to changed surfaces, then production build, touched-file lint, and `git diff --check`.
5. Explicitly verify Auth/session behavior, USER/ADMIN boundaries, ownership and ordering, Dashboard independent loading, Topic discovery, SRS authority/idempotency/AGAIN requeue/NORMAL isolation, accessibility, focus/keyboard, responsive behavior, and test cleanup isolation where affected.
6. Populate the AFTER document, separate application changes from remote TEST variance, reconcile relevant docs/status, and perform final TEST and REVIEW.

**Mandatory HUMAN optimization checkpoint:** HUMAN reviews each retained batch, AFTER comparison, regression evidence, limitations, and rollback decision before closure.

## 11. Regression Strategy

The exact command set depends on selected files, but the following mapping is mandatory:

- Router/auth/session changes: auth unit tests, auth-routing/session/responsive browser specs, BF-01/BF-02, and guarded auth real-stack coverage.
- Dashboard request/render changes: Dashboard mocked spec, Learning Progress service/contract coverage, Dashboard real-stack scenario, BF-03.
- Owned Set/list/detail changes: relevant service tests, mocked owned-Set specs, guarded personal Set real-stack coverage, BF-04.
- Learning/SRS changes: scheduler/service unit tests, Learning integration, mocked SRS browser spec, TASK-106-equivalent real-stack lifecycle coverage, BF-05.
- Topic/public discovery changes: Topic and public Set mocked/real-stack coverage, BF-06.
- Backend repository/query changes: focused backend integration tests using `.env.test`, query-count evidence, authorization/ownership regression, and affected real-stack flow.
- Build or asset-loading changes: production build comparison, direct cold route checks, frequent-route transition checks, and full mocked browser suite.

All retained changes require touched-file ESLint and `git diff --check`. Full build is required for frontend changes. No DB test may use `backend/.env`.

## 12. Risks and Controls

- **Measurement variance:** serial execution, warm-up, multiple retained samples, median/min/max, fixed fixtures, and explicit remote labels.
- **Dev/prod distortion:** production build is primary; dev-server results are labeled diagnostic.
- **Fixture contamination:** run-owned identifiers, guarded `.env.test`, narrow cleanup, and separate manual/test sessions.
- **Sensitive artifacts:** allowlisted fields, redaction inspection, no headers/cookies/bodies/URLs with credentials.
- **Observer overhead:** keep instrumentation test-only and minimal; document overhead and compare like with like.
- **False attribution:** correlate requests and queries; record “inconclusive” when layers cannot be separated reliably.
- **Metric gaming:** readiness means usable route content; retain functional loading/error states and measure frequent-route tradeoffs.
- **Parallelization risk:** compare elapsed time and query/load behavior; never assume parallel is automatically better.
- **Remote TEST anomalies:** preserve samples and distinguish provider/network variance from code cost.
- **Regression from shared changes:** use the proportional matrix above plus complete mocked browser coverage when router/shared services are touched.

## 13. Rollback Strategy

- Keep measurement-harness work separate from each optimization batch so diagnostic facilities do not obscure product changes.
- Each optimization batch must be independently reversible and must identify the pre-change commit/worktree plus affected files.
- Roll back a batch if it misses its approved target, causes an unexplained material regression, weakens contracts/accessibility/security, or makes evidence less reliable.
- Reverting an optimization must not delete the BEFORE evidence; record the rejected candidate and reason.
- Schema/index/API/dependency/cache changes cannot use this generic rollback plan and require their own approved migration/compatibility strategy before implementation.

## 14. Documentation and Status Plan

- `docs/specs/PERFORMANCE_V1_SPEC.md` — retain the approved requirement and checkpoint record.
- `docs/plans/PERFORMANCE_V1_PLAN.md` — record PLAN approval without changing scope.
- `docs/tasks/PERFORMANCE_V1_TASK.md` — create only after PLAN approval; separate harness/baseline tasks from post-checkpoint candidate tasks.
- `docs/performance/PERFORMANCE_V1_BASELINE.md` — create during approved measurement execution.
- `docs/performance/PERFORMANCE_V1_AFTER.md` — create only for HUMAN-approved optimizations.
- `docs/FEATURE_STATUS.md` — advance status only at completed workflow gates.
- Update `ARCHITECTURE.md`, `API_SPEC.md`, `DATABASE.md`, or `UI_UX_SPEC.md` only if a separately approved retained change affects their domain.

## 15. Dependencies

- A stable dedicated `.env.test` database and guarded test setup.
- Existing Node/npm, Vite, Playwright Chromium, Express, and Prisma installations.
- Dedicated local ports not shared with HUMAN manual-review runtimes.
- Deterministic test-owned USER, Set, vocabulary, SRS, Topic, and public Set fixtures.
- Sufficiently stable machine conditions and recorded remote TEST network conditions for comparable samples.
- HUMAN availability for the baseline/candidate, contract/architecture, optimization, and final closure checkpoints.

No new package or external service is assumed.

## 16. Deferred Items

- Continuous performance budgets or CI gating.
- Production RUM/APM or durable observability.
- Load, stress, soak, capacity, or high-concurrency testing.
- CDN, service-worker/offline strategy, Redis, speculative caching, queues, or microservices.
- Schema/index redesign without evidence and separate approval.
- Gamification, Dashboard V2 additions, Community, pronunciation expansion, SRS V2, and unrelated redesign/refactor.

## 17. HUMAN Approval Gates

1. **PLAN approval:** approve this environment, fixture, methodology, artifact, and safety design before TASK creation.
2. **Harness safety checkpoint:** stop if safe `.env.test` isolation, scoped cleanup, redaction, or non-invasive attribution cannot be demonstrated.
3. **BEFORE baseline checkpoint:** approve classifications, numeric targets, and selected candidates before any optimization.
4. **Contract/architecture checkpoint:** separately approve any schema/index, API behavior, dependency, cache, durable instrumentation, auth, or architecture change.
5. **Implementation checkpoint:** approve candidate-specific TASK scope before each optimization batch.
6. **AFTER/optimization checkpoint:** review target attainment, regressions, and keep/rollback decision.
7. **Final TEST/REVIEW:** approve documentation, status, and closure independently.

## 18. Exit Criteria

Performance V1 is ready for final closure only when:

- BF-01 through BF-06 have reproducible, scrubbed BEFORE evidence satisfying AC-01 through AC-04;
- HUMAN has reviewed the baseline and either approved a bounded candidate set or accepted that no optimization is justified;
- every retained optimization has comparable AFTER evidence and meets its approved target;
- no protected flow has an unexplained material regression;
- required functional, accessibility, security, build, lint, and real-stack checks pass;
- remote/environment limitations are documented honestly;
- no unapproved schema/index/API/dependency/cache/architecture change exists;
- final TEST and REVIEW are approved before status becomes `DONE`.

## 19. Open Decisions

No decision blocks PLAN approval. Numeric targets and optimization candidates intentionally remain unresolved until the HUMAN BEFORE baseline checkpoint.
