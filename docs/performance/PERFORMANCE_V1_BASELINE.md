# Performance V1 — Authoritative BEFORE Baseline

**Status:** `HUMAN APPROVED — CANDIDATES 1–3 SELECTED`

**Measured:** 2026-10-06
**Branch / commit:** `dev` / `a00f5c5be919e6ab1dacf8ac92c0b4778d85ab95`
**Scope:** TASK-114 through TASK-120 only; no optimization was implemented.

## 1. Environment and methodology

- Windows x64, Node `22.20.0`, Playwright `1.63.0`, Chromium `153.0.8010.12`.
- Production frontend build served on `127.0.0.1:4186`; guarded TEST backend on `127.0.0.1:5012`.
- Dedicated `.env.test` datasource only. Both backend startup and global setup call `configureTestEnvironment()` before Prisma use; migration parity uses the guarded inherited `DATABASE_URL` mapping.
- TEST safety guard passed; ordinary Prisma Client connectivity passed; 7 migrations were present with none pending.
- Viewport `1366 × 768`, one excluded warm-up followed by five retained runs for every condition, one worker, serial execution.
- Readiness means the approved usable marker is visible. BF-02 requires both Progress and owned Sets. The 250 ms backend-observer drain occurs after the measured action and is excluded from readiness.
- BF-05 performs no rating mutation. BF-06 uses client-side navigation. Authentication/setup traffic is settled and the backend observer reset before the measured route.
- Machine-readable benchmark outputs are scrubbed, schema-checked transient files under ignored `frontend/test-results/`; this document is the durable authoritative aggregate.

## 2. Measured facts

All values are median `[minimum, maximum]` across five retained samples. Durations are milliseconds. Request count includes document, assets, fonts, and API traffic. Query time is the sum of Prisma-reported query durations for the measured flow, so parallel query time must not be interpreted as wall time.

| Flow | Usable readiness | Requests | Queries | Summed query time | Summed server time | CLS |
|---|---:|---:|---:|---:|---:|---:|
| BF-01 cold Login | 359 `[345, 364]` | 8 `[8, 8]` | 0 | 0 | 0.84 `[0.65, 1.17]` | 0 |
| BF-01 warm Login reload | 161 `[155, 170]` | 8 `[8, 8]` | 0 | 0 | 0.57 `[0.50, 0.59]` | 0.001 `[0, 0.001]` |
| BF-02 Login → Dashboard | 4,382 `[4,380, 4,410]` | 6 `[6, 6]` | 16 `[16, 16]` | 4,501 `[4,473, 4,819]` | 4,622 `[4,592, 4,944]` | 0 |
| BF-02 authenticated restore | 4,400 `[3,916, 4,421]` | 13 `[13, 13]` | 16 `[16, 18]` | 4,490 `[4,333, 5,024]` | 4,511 `[4,354, 5,046]` | 0.004 |
| BF-03 Dashboard | 4,100 `[4,072, 4,589]` | 13 `[13, 13]` | 16 `[16, 18]` | 4,489 `[4,466, 5,017]` | 4,508 `[4,485, 5,039]` | 0.004 |
| BF-04A owned Sets | 2,055 `[2,045, 2,057]` | 11 `[11, 11]` | 5 `[5, 5]` | 1,412 `[1,408, 1,422]` | 1,421 `[1,417, 1,430]` | 0.001 |
| BF-04B owned Set Detail | 3,102 `[3,051, 7,129]` | 11 `[11, 11]` | 9 `[9, 9]` | 2,562 `[2,547, 4,340]` | 2,574 `[2,559, 6,498]` | 0 |
| BF-05 Flashcard/SRS full measured sequence | 8,843 `[8,500, 10,093]` | 19 `[19, 19]` | 28 `[28, 28]` | 7,768 `[7,736, 8,698]` | 7,823 `[7,795, 8,741]` | 0 |
| BF-06 Topics → public Set Detail | 3,335 `[2,875, 4,864]` | 12 `[12, 12]` | 7 `[7, 7]` | 1,951 `[1,865, 3,421]` | 1,971 `[1,884, 3,440]` | 0.036 `[0.036, 0.039]` |

### Endpoint and interaction facts

- Dashboard Progress was the slowest Dashboard source: median server time about `3,125 ms`; owned Sets was about `814 ms`; authenticated `/api/auth/me` was about `569 ms`.
- Login itself was about `681 ms`; Dashboard data, not credential submission, governed BF-02 readiness.
- Owned Set Detail was about `1,998 ms` median and had one `5,897 ms` server outlier.
- Each Learning Set read was about `2,231 ms` median. BF-05 intentionally reads on initial SRS entry, NORMAL switch, and re-entry.
- BF-05 interaction medians: first card `3,042 ms`, flip `54 ms`, NORMAL switch `2,482 ms`, restart `73 ms`, re-entry `3,047 ms`.
- BF-05 produced zero `/api/learning/events` requests and therefore no rating/progress mutation.
- BF-06 endpoint medians were approximately: Topics `280 ms`, Topic `279 ms`, public Sets `557 ms`, public Set Detail `839 ms`.
- No repeated request identity was observed in BF-01 through BF-04 or BF-06. BF-05 repeats document/assets/auth and NORMAL Learning reads because the approved sequence deliberately performs a full re-entry; these are not classified as accidental duplicates.

### Delivery facts

The production build emitted the existing chunk advisory:

| Asset | Raw | Gzip where available |
|---|---:|---:|
| Entry JavaScript | 668.60 kB | 194.11 kB |
| Entry CSS | 152.08 kB | 26.60 kB |
| Desktop logo | 406.22 kB | — |
| Mobile logo | 599.61 kB | — |
| Banner | 939.18 kB | — |

Cold Login requested the entry JavaScript, entry CSS, Google Fonts stylesheet/three font files, and guest `/api/auth/me`; it did not request the three large image assets. Local cold readiness remained `359 ms`, so the advisory alone does not establish user impact on a constrained production network.

## 3. Observed symptoms

1. Authenticated Dashboard readiness consistently clusters near 4.1–4.4 seconds even for a bounded fixture.
2. First SRS card readiness is about 3 seconds; a complete entry/switch/re-entry measurement is about 8.8 seconds.
3. Protected routes repeatedly pay authenticated session/user lookup cost, visible as two recurring remote queries per authenticated request.
4. Owned Set Detail and BF-06 show isolated long-tail samples while medians remain materially lower.
5. Layout shift is low in every measured flow; BF-06 is highest at only `0.036` median.

## 4. Root-cause inference

These are inferences, not measured facts:

- **High confidence:** Remote query round trips dominate authenticated flow latency. Common TEST queries are roughly 270–300 ms each, and summed query time closely tracks summed backend time.
- **High confidence:** Dashboard Progress is the principal Dashboard critical-path source. The independently loaded owned-Set request completes much earlier.
- **High confidence:** Repeated AUTH_SESSION then USER lookups add cross-cutting cost to every protected request. Whether they can be safely combined must be reviewed against authentication semantics.
- **Medium confidence:** Learning Set assembly has enough sequential database work to make first-card entry a meaningful backend/query candidate. Exact consolidation opportunities require code-level candidate review.
- **Low confidence:** The eager entry bundle may hurt constrained-network users, but the local baseline does not demonstrate a current Login usability bottleneck.

No evidence supports a frontend scheduler, SRS contract, API-response, schema, or correctness defect.

## 5. Remote/environment anomalies and limitations

- The dedicated TEST database is remote; absolute times include network/pooler latency and must not be generalized to local or production infrastructure.
- Before this accepted run, the remote pooler produced Prisma P1001 failures. The accepted run itself had stable connectivity and complete samples.
- One Set Detail and some public-discovery samples show remote/server long tails. They are retained rather than discarded.
- Browser and backend clocks are independent; summed server/query time can exceed wall readiness when requests overlap.
- This is a desktop primary-viewport baseline, not a mobile-network simulation or production RUM study.
- Raw/gzip build output is known, but route-level unused-code attribution requires a separately approved candidate investigation.

## 6. Ranked candidate proposals — no implementation authorized

| Rank | Candidate | User impact | Confidence | Expected benefit | Implementation / regression risk | Proposed comparable target |
|---:|---|---|---|---|---|---|
| 1 | Reduce Dashboard Learning Progress query round trips while preserving response/order semantics | High | High | High for login, restore, and Dashboard | Medium; critical SRS-derived state and pagination must remain exact | Progress endpoint median ≤ `2,000 ms`; BF-03 readiness median ≤ `3,000 ms`; no query-count or semantic regression elsewhere |
| 2 | Reduce Learning Set/SRS read round trips without changing scheduler, eligibility, ordering, or NORMAL isolation | High | Medium | Medium–high for first-card and re-entry | High because SRS correctness is protected | Learning read median ≤ `1,600 ms`; first-card median ≤ `2,250 ms`; TASK-106-equivalent lifecycle remains PASS |
| 3 | Consolidate authenticated session + user lookup work per protected request | Broad/medium | High | Medium across all protected routes | High authentication/security regression risk | `/api/auth/me` median ≤ `350 ms`; affected route medians improve ≥15%; auth/session regression remains PASS |
| 4 | Investigate route-level delivery/code splitting for the 668.60 kB entry JavaScript | Medium on constrained networks; low locally | Low–medium | Unknown until throttled evidence | Medium router/loading risk | First add comparable throttled evidence; if selected, reduce entry gzip ≥25% without adding a frequent-route waterfall or readiness regression |

### Separate approvals required

- Candidates 1–3 are backend/query or authentication changes. Any schema/index, cache, API/response, transaction, or authentication-contract change requires separate HUMAN approval before editing.
- Candidate 4 requires separate approval if it adds a dependency, changes router architecture, or changes loading behavior/contracts.
- No current evidence authorizes an index or migration. Remote latency by itself is insufficient justification.

## 7. Findings not worth optimizing now

- Cold/warm Login readiness and guest `/api/auth/me`: already fast locally and query-free.
- Flip and restart interactions: tens of milliseconds and not bottlenecks.
- BF-06 layout shift: below the usual `0.1` good-experience boundary.
- Large image files: not requested by the measured Login route; optimize only if a route-specific baseline proves impact.
- BF-05 repeated requests caused by the deliberate full re-entry measurement: expected test sequence, not proven redundant production work.
- One-off Set Detail/public-flow outliers: retain as remote variability; do not optimize from isolated maxima alone.
- Mocked-suite `/api/topics` ECONNREFUSED noise: absent from this real-stack baseline and remains unrelated test log noise.

## 8. Isolation, completeness, and artifact result

- Nine benchmark conditions completed, each with one warm-up and five retained samples.
- All browser responses were complete; no null status remained.
- Cleanup returned unrelated TEST records from `5 → 5` users and `8 → 8` sessions.
- Run-owned fixture cleanup targets exact generated identifiers; post-run cleanup reported `unchanged: true`.
- Persisted evidence is scrubbed and ignored. No password, cookie, session identifier, token, or database URL is retained.
- TASK-120 result: `COMPLETE — PENDING HUMAN BASELINE/CANDIDATE REVIEW`.
- TASK-121 remains forbidden until HUMAN selects an exact candidate, target, scope, and regression boundary.

## 9. HUMAN candidate decision

HUMAN approved this baseline and selected Learning Progress, Learning Set/SRS read, and authenticated session/user lookup optimization in that order. Route-level code splitting and bundle work remain deferred pending constrained-network evidence. Candidate implementation evidence belongs to the TASK checkpoint and does not alter these BEFORE values.
