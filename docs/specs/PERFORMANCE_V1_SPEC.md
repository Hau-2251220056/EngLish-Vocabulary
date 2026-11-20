# SPEC: Performance V1 — App Loading & Runtime Baseline

**Feature status:** `HUMAN APPROVED — IMPLEMENTED / TESTED / REVIEWED`

**Workflow result:** HUMAN approved this SPEC on 2026-10-05. The approved measurement, selected optimization, regression, and formal review workflow completed through TASK-125 on 2026-10-06. Commit and push remain separately gated.

## 1. Problem Statement

ELVocab does not yet have one reproducible performance baseline that separates frontend loading, application/server processing, remote database/network latency, and user-perceived responsiveness. The production build currently reports a bundle-size advisory, the router eagerly imports route modules, and prior guarded integration work observed occasional remote TEST DB/Supabase latency. These are investigation signals, not proof of a product bottleneck.

Performance V1 establishes evidence first, identifies the highest-value confirmed bottlenecks, and permits only targeted optimizations that preserve approved product behavior and contracts.

## 2. Objective

Create a reproducible baseline for a bounded set of representative ELVocab flows, classify measured cost by layer, and improve only bottlenecks supported by that baseline. The result must improve or preserve user-perceived loading and measured runtime behavior without redesigning the product.

## 3. Actors and Environments

- **Guest:** initial application/login loading and public Topic/Set discovery measurements.
- **USER:** session restoration, authenticated shell, Dashboard, owned Sets, Set Detail, and Flashcard/SRS measurements.
- **ADMIN:** not a primary benchmark actor; existing authorization and Admin regressions remain protected.
- **Developer/test operator:** runs controlled measurements and records environment, build, fixture, and network conditions.

Every measurement must identify whether it uses a local production frontend build, local frontend/backend runtime, guarded `.env.test` database, or remote Supabase/database/network path. Remote cost must not be presented as local application cost.

## 4. Goals

- Establish a reproducible BEFORE baseline before selecting an optimization.
- Measure frontend loading, route transitions, requests, bundle/assets, backend/API latency, query behavior, and perceived loading.
- Distinguish browser/render cost, request orchestration, backend processing, database work, and remote network latency where reasonably possible.
- Find proven redundant requests, waterfalls, repeated backend work, unnecessary rerenders, obvious N+1 queries, or oversized eager delivery.
- Select a small number of high-value, low-risk optimizations from evidence.
- Produce comparable AFTER measurements and relevant regression evidence.

## 5. Non-Goals

Performance V1 does not include:

- Gamification, Dashboard V2, Community, pronunciation expansion, SRS V2, FSRS/SM-2, or new product features.
- A broad UI redesign or replacement of existing accessible loading/error/empty states.
- A database schema migration, index, or constraint change without measured evidence and separate HUMAN approval.
- Speculative caching, Redis, service workers, CDN architecture, microservices, queues, or new observability infrastructure.
- Broad refactoring or micro-optimization without demonstrated performance value.
- Destructive, high-volume, or production-like load testing against a remote database.
- Changing API, authentication, authorization, ownership, or business behavior merely to improve a metric.

## 6. Benchmark Set

The V1 benchmark set is deliberately bounded. The PLAN may refine exact fixtures and tooling, but it must preserve these flows unless baseline evidence and HUMAN approval justify a change.

### BF-01 — Initial Guest Application Load

- Direct cold navigation to `/login` in a fresh browser context.
- Observe initial JS/CSS/image/font delivery, parse/evaluation, first usable page presentation, layout stability, and request count.
- Record the production build entry chunk and assets required before Login is usable.

### BF-02 — Login and Authenticated Session Restore

- Successful USER login followed by Dashboard navigation.
- Direct authenticated reload at `/dashboard` using an isolated test-owned session.
- Observe `/api/auth/me`, redirects/guards, shell readiness, duplicate auth requests, and loading flashes.

### BF-03 — Dashboard

- Load `/dashboard` for a representative USER fixture.
- Measure independent Learning Progress and owned-Set requests, total requests, overlap/waterfall, section readiness, rerender evidence where measurable, and partial loading behavior.

### BF-04 — Owned Sets and Set Detail

- Navigate to `/my/vocabulary-sets` and open one representative `/my/vocabulary-sets/:setId`.
- Measure route responsiveness, list/detail request counts, payload timing, repeated/refetched data, and localized versus full-page loading.

### BF-05 — Flashcard Learning / SRS

- Enter `/learn/vocabulary-sets/:setId` for a representative non-empty Set.
- Measure route/module readiness, SRS snapshot request, initial-card readiness, flip responsiveness, pronunciation-resource behavior where present, and restart/re-entry fetching.
- Rating idempotency and authoritative scheduling are regression requirements and cannot be weakened for speed.

### BF-06 — Topics and Public Discovery

- Load `/topics`, open one Topic, discover its public Sets, and open one public Set Detail.
- Measure transitions, request order/count, repeated Topic/Set fetches, assets, and loading continuity.

Quiz, Admin CRUD, Learning Progress pagination, registration, and private Vocabulary editing remain regression surfaces but are not primary benchmarks unless a shared bottleneck is found.

## 7. BEFORE Baseline Requirements

No optimization is eligible until a reproducible BEFORE record exists. Each benchmark record must include:

- commit SHA, build mode, runtime commands, browser/version, viewport, machine context, and timestamp;
- safe fixture shape, cold/warm and cache conditions, authentication state, and repetitions;
- request names, counts, start order, duplicated requests, status, and browser-observed duration;
- route/readiness markers and visible loading observations;
- build asset/chunk raw and gzip sizes;
- backend processing and query evidence where available;
- known environmental noise, especially remote TEST DB/network variance.

Cold loads use fresh browser contexts and explicit cache conditions. Repeated measurements include a warm-up and multiple samples; report the sample set and median rather than presenting one run as representative. Outliers must be retained or explained.

The baseline must distinguish observations from conclusions. A bundle advisory, slow remote request, or rerender count alone does not prove the proposed remedy.

## 8. Measurement Methodology

### 8.1 Frontend Loading and Runtime

Collect as applicable:

- production Vite build output, entry/chunk graph, raw and gzip sizes;
- browser navigation/resource timing and controlled Playwright traces;
- request count, initiator/order, duplicate calls, and waterfall/overlap;
- route start to a route-specific usable-content marker;
- React render/commit evidence only where a suspected rerender bottleneck exists;
- long-task or interaction-delay evidence supported by selected tooling;
- layout shifts, full-page versus localized loading, transient flashes, and stale refetching;
- image, font, audio, and other asset behavior relevant to the benchmark.

Readiness markers represent usable content, not merely URL change or disappearance of a spinner.

### 8.2 API and Backend

For benchmark requests, capture browser-observed duration, backend processing time where safely measurable, request count, repeated service/repository work, query count/order, independent parallel versus sequential work, and relevant payload size. Authentication and authorization remain intact.

Temporary instrumentation must avoid secrets, tokens, passwords, personal data, and production logging expansion. Whether instrumentation becomes permanent is a PLAN decision.

### 8.3 Database and Remote-Network Attribution

- Use Prisma through existing application/test architecture; no raw Prisma bypass.
- Inspect query count, repetition, shape, and dependencies before considering indexes or schema changes.
- Compare application processing with database/network time when reliable separation is possible.
- Label Supabase/remote TEST latency as environment/database/network evidence until application-side work is independently demonstrated.
- Do not infer N+1 from duration alone; show repeated query shape/count tied to one request.
- Do not run destructive or high-concurrency tests against remote TEST, Preview, Main, or Production data.

### 8.4 User-Perceived Performance

Review blocking full-page loading, independent usable content, redundant loading flashes, layout shift, navigation responsiveness, accessible status announcements, reduced motion, and preservation of usable content during background refresh or recoverable failure.

Perceived-performance changes must not hide legitimate pending/error states or weaken accessibility.

## 9. Optimization Eligibility Rule

An optimization may enter implementation planning only when:

1. The BEFORE baseline reproduces the bottleneck or redundant work.
2. Evidence identifies the responsible layer with reasonable confidence.
3. The proposed change has a comparable measurement method.
4. Existing product, API, authorization, accessibility, and persistence contracts remain protected.
5. Expected value justifies complexity and regression risk.

If evidence is inconclusive, record an observation or narrower measurement task—not an optimization.

Numeric acceptance targets must be proposed from baseline evidence and approved at the baseline checkpoint. Until then, relative criteria are: remove proven redundant work, materially improve a confirmed bottleneck, and introduce no measured regression in protected flows.

## 10. Data, API, and Architecture Constraints

- No new persistent performance entity, database migration, or index is planned.
- Existing API shapes, status codes, authentication, authorization, and business rules remain unchanged by default.
- Existing React/Vite, Express, Prisma, and PostgreSQL architecture remains.
- A dependency, cache, API/schema change, durable telemetry, or major architecture change requires evidence, impact analysis, and separate HUMAN approval.
- Measurement artifacts must not contain credentials, session identifiers, database URLs, or personal data.

## 11. Regression Requirements

Optimizations must preserve applicable authentication/session restore, USER/ADMIN boundaries, Dashboard independent sections, Set ownership/order/exact identity, SRS authority/idempotency/requeue/NORMAL isolation, Topic discovery, accessible loading/error/focus/keyboard/responsive behavior, and test cleanup isolation.

The PLAN must map each selected optimization to focused regressions plus build, lint, and bundle comparison. Shared router/auth/service changes require proportional cross-feature coverage.

## 12. Acceptance Criteria

- **AC-01:** A reproducible BEFORE baseline exists for BF-01 through BF-06 with environment, fixture, cache, repetition, and commit details.
- **AC-02:** Every benchmark reports request counts/order/durations, readiness, loading observations, and relevant bundle/assets.
- **AC-03:** Important APIs distinguish browser-observed time from backend/database/network contribution as reliably as the environment permits.
- **AC-04:** Suspected backend bottlenecks have query count/repetition/sequencing evidence without unsafe DB access or mutation.
- **AC-05:** Confirmed bottlenecks are ranked by user value, evidence strength, benefit, complexity, and regression risk.
- **AC-06:** No optimization occurs before HUMAN reviews the baseline and approves candidates and final targets.
- **AC-07:** Every implemented optimization has comparable AFTER evidence and meets its approved target.
- **AC-08:** No protected benchmark or regression flow has an unexplained material regression.
- **AC-09:** Product/API/security/accessibility behavior remains unchanged unless separately approved.
- **AC-10:** No unapproved schema, migration, index, dependency, cache, external service, or broad refactor is introduced.
- **AC-11:** Artifacts/logs contain no secrets, session tokens, database URLs, passwords, or personal data.
- **AC-12:** Final documentation separates application improvements from remote TEST DB/Supabase variability and records limitations honestly.

## 13. Edge Cases and Measurement Risks

- Browser cache, development-mode React, source maps, and hot reload can distort results.
- Authentication expiry or fixture recreation can add unrelated redirects/requests.
- Remote TEST DB cold starts, pooling, TLS, network path, and provider load can dominate samples.
- Tiny fixtures can hide scaling; larger fixtures must remain bounded, run-owned, safe, and representative.
- Audio, speech synthesis, image cache, and font cache can alter resource timing.
- A faster spinner is not proof that usable content is ready sooner.
- Code splitting can shrink entry size while delaying a frequent route; measure both.
- Parallel requests can lower elapsed time while increasing database load; evaluate both user latency and query behavior.

## 14. Deferred Items

- Continuous performance budgets/CI gates and production real-user monitoring/APM.
- Load, stress, soak, capacity, and concurrency-limit testing.
- CDN, service-worker/offline strategy, and advanced caching.
- Database indexes/schema redesign without separately approved evidence.
- Performance work for deferred product features.

## 15. HUMAN Checkpoints

1. **SPEC approval:** approve benchmark boundary and methodology before PLAN.
2. **PLAN approval:** approve exact tools, fixtures, commands, artifacts, and safety controls before measurement.
3. **BEFORE baseline STOP:** review evidence, candidate ranking, proposed targets, and selected optimization set before optimization implementation.
4. **Contract/architecture STOP:** separately approve any schema/index, API behavior, dependency, cache, durable instrumentation, or architecture change.
5. **Optimization checkpoint:** review implementation and comparable AFTER evidence before broader closure.
6. **Final TEST/REVIEW:** approve regression evidence, documentation, feature status, and closure separately.

## 16. Dependencies and Impact

Performance V1 reuses the production build, Playwright, guarded TEST DB, route tests, and existing architecture. Likely inspection surfaces include the router, authentication restore, Dashboard sources, Set services/pages, Learning/SRS, Topic discovery, backend service/repository queries, and Vite output. Exact files, tools, fixtures, and candidates belong to the PLAN after SPEC approval.

## 17. Open Questions

No decision blocks SPEC approval. Exact numeric targets and optimization candidates intentionally remain open until the reproducible BEFORE baseline is reviewed by HUMAN.
