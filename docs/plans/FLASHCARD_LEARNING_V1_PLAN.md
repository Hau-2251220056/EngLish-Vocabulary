# PLAN: Flashcard / Learning V1

**Source SPEC:** `docs/specs/FLASHCARD_LEARNING_V1_SPEC.md` (`APPROVED`)

**PLAN status:** `APPROVED`

**Human approval:** `APPROVED`, including the guarded implementation order and the completed TASK-051 HUMAN-approved primary-Meaning UI/UX checkpoint before final Flashcard UI implementation.

**Implementation authorized:** `NO`

## 1. Summary

Flashcard / Learning V1 will add one backend-authoritative `LEARNING_PROGRESS` aggregate per USER plus Vocabulary and one USER learning flow that reads an accessible Vocabulary Set in Item position order.

The backend follows the existing route → authentication/USER authorization → controller → service → repository → Prisma architecture. It authorizes the Set and current membership for every meaningful event, owns state/counter/time transitions, and applies `event_id` plus optimistic `revision` atomically. No server-side Learning Session, event ledger or SRS service is introduced.

The frontend adds `/learn/vocabulary-sets/:setId` under the existing authenticated USER layout. It owns only transient same-tab run state in a dedicated `sessionStorage` namespace. A mandatory HUMAN UI/UX design checkpoint occurs after the service/route foundation and before final Flashcard UI implementation.

## 2. Scope and Acceptance Traceability

| Approved SPEC criteria | Planned implementation / evidence |
|---|---|
| AC-01 | USER route/API guards, System/owned-private Set access query, Guest/ADMIN/non-owner API and browser coverage. |
| AC-02–AC-03 | Ordered Set payload repository query, full nested Vocabulary projection, deterministic Meaning/Example ordering, accessible card content/audio states. |
| AC-04–AC-06 | Backend event service and transaction tests proving no mutation for reads/UI actions, meaningful outcome mapping, counter/revision update, immediate retry and stale-event rejection. |
| AC-07–AC-08 | Prisma model/migration constraints and service tests for per-USER/per-Vocabulary progress, conceptual NEW and null/deferred SRS fields. |
| AC-09–AC-10 | Learning-owned run-state helper plus browser tests for reload resume, stale reconciliation, restart and client-only completion. |
| AC-11–AC-12 | Backend authorization/reference validation, safe API errors, frontend retry/pending/error coverage and secret/error review. |
| AC-13–AC-14 | Existing UserRoute/AuthenticatedShell reuse, approved UI/UX checkpoint, keyboard/focus/responsive browser evidence and Auth/Set regressions. |
| AC-15 | Schema/API/UI scope audit confirms no deferred domain, standalone catalog, external service or dependency. |

## 3. Existing Code and Conventions to Reuse

- `backend/prisma/schema.prisma` and existing migrations — UUID, uppercase mapped model, timestamp and explicit migration-constraint conventions.
- `backend/test/helpers/test-environment.js`, `test-database.js` and guarded migration-status script — mandatory dedicated TEST DB safety entry points.
- `backend/src/create-app.js` — dependency composition and final safe error boundary.
- Vocabulary Set repository/service/routes — accessible System/private Set semantics, ordered Item projections, transaction and safe-known-error patterns.
- Vocabulary repository projections — complete Vocabulary/Meaning/Example shape and deterministic nested selection patterns where applicable.
- Existing authentication and role middleware — authoritative session and USER-only authorization; no new role or auth store.
- `frontend/src/services/http-client.js` and Vocabulary Set service — credential-aware API/error mapping conventions.
- `frontend/src/app-router.jsx`, `auth/ui/route-guards.jsx` and `authenticated-shell.jsx` — `ProtectedRoute`, `UserRoute`, shell and responsive drawer conventions.
- Public/My Vocabulary Set pages — entry-point placement, safe load/mutation states and completed Set ownership behavior.
- Existing Playwright guarded real-stack infrastructure — TEST DB setup, controlled fixtures, browser configurations and cleanup conventions.

## 4. Documentation Synchronization Gate

After HUMAN PLAN approval and before schema/source implementation, synchronize the approved contract:

1. **`docs/DATABASE.md`:** finalize the persisted Learning Progress subset, conceptual `NEW`, allowed persisted states, meaningful-assessment `review_count`, revision/current-event fields, nullable unused SRS fields, unique/FK/check constraints and Set-independent deletion behavior.
2. **`docs/API_SPEC.md`:** replace generic learning/review drafts with the two approved USER endpoints, ordered full card payload, event request, safe errors and immediate-retry/stale-revision boundary.
3. **`docs/UI_UX_SPEC.md`:** finalize route, card anatomy, deterministic primary-Meaning presentation from the complete payload, reveal/assessment lifecycle, resume/restart/completion, accessibility/responsive requirements and the mandatory design checkpoint.
4. **`docs/ARCHITECTURE.md`:** record the stateless server learning-run boundary, backend-owned progress transition and Learning-owned session-storage namespace without introducing an SRS service in V1.
5. **`docs/FEATURE_STATUS.md`:** move only the covered Vocabulary Learning Session, Flashcard Learning and Learning Progress V1 work to `PLANNED`; keep SRS, Words to Review, Topic Progress, Dashboard and deferred domains unchanged.

`docs/PROJECT_OVERVIEW.md` remains valid high-level scope and requires no business expansion.

## 5. Database and Migration Plan

### 5.1 Model

Add only `LEARNING_PROGRESS` with:

- UUID `id`, `user_id`, `vocabulary_id`;
- string status constrained to persisted values `LEARNING`, `LEARNED`, `NEEDS_REVIEW` (backend V1 writes only the first two); `NEW` remains absence of a row;
- non-negative `review_count` and `revision`, both default `0`;
- nullable UUID `last_event_id`;
- nullable `last_reviewed_at`, `next_review_at`, integer `interval_days` and numeric `ease_factor`;
- `created_at`, `updated_at`.

No `LEARNING_SESSION`, event/history/ledger, SRS, Set-progress, Topic-progress, XP or activity table is added.

### 5.2 Relations and Constraints

- `UNIQUE(user_id, vocabulary_id)` is the persistence identity.
- USER → Learning Progress uses an explicit non-cascade/restrict policy pending the separate User lifecycle feature.
- Vocabulary → Learning Progress uses `ON DELETE RESTRICT`.
- Add PostgreSQL CHECK constraints for allowed persisted status, `review_count >= 0`, `revision >= 0`, and nullable `interval_days > 0` when present.
- No Topic, Set, Set Item or Meaning FK exists on progress.
- Add only indexes justified by V1 lookup: the unique pair is sufficient for per-card progress; no future `next_review_at` queue index is needed before Words to Review/SRS.

### 5.3 Focused Migration and TEST DB Safety

- Create one new migration; never edit applied migrations.
- Generate/validate Prisma client through repo convention.
- Before every migration/reset/database command, call `configureTestEnvironment()` with explicit `NODE_ENV=test`, guarded `TEST_DATABASE_URL` mapping and existing reset authorization where required.
- Verify only the dedicated TEST DB: table/columns/defaults/checks/FKs/unique pair, Vocabulary delete restriction, Set/Item deletion independence, valid statuses/null SRS fields and rejection of invalid counters/revisions.
- Use controlled fixtures and targeted cleanup; never apply/reset Preview, development, Main or Production.

## 6. Backend Plan

### 6.1 Modules and Composition

Add focused learning repository, service, controller and routes following existing naming/responsibility boundaries. Compose them in `createApp` under `/api/learning` with existing authentication followed by existing `USER` role authorization for every endpoint.

No ADMIN learning endpoint, background scheduler, external audio integration or SRS service is added.

### 6.2 Repository Responsibilities

- Find one accessible Set for a USER: public System Set or private Set owned by that USER; inaccessible private data uses the not-found boundary.
- Return Items ordered by `position`, Vocabulary fields, all Meanings/Examples ordered by `created_at`, then `id`, and current progress for the requesting USER only.
- Confirm current Set membership for an event inside the write transaction.
- Read progress by `(user_id, vocabulary_id)` and perform conditional create/update using unique identity, expected revision and current event ID.
- Keep database access and transaction-scoped operations here; no authorization policy or outcome mapping in the repository.

### 6.3 Service Responsibilities

- Validate UUIDs, exact request fields, integer `expected_revision >= 0` and the two allowed outcomes.
- Enforce accessible, non-empty Set reads and current Item membership.
- Map missing progress to API status `NEW`, revision `0`, without creating a row.
- Map `REMEMBERED → LEARNED` and `STUDY_AGAIN → LEARNING`.
- For a new accepted event, atomically increment meaningful-assessment `review_count` and `revision`, set backend `last_reviewed_at` and `last_event_id`, while leaving SRS fields null.
- If `last_event_id` equals the immediately retried event ID, return current progress without mutation.
- If a different event carries a stale revision, return `LEARNING_PROGRESS_CHANGED`; do not claim historical replay support.
- Translate unique/concurrency/FK failures to stable safe domain errors without leaking Prisma details.

### 6.4 Controller and Routes

- Controller extracts authenticated identity, params/body, invokes service and returns approved envelopes/statuses.
- Routes only bind endpoint plus existing authentication/USER authorization middleware.
- Known Learning errors map to approved `400/404/409`; existing auth middleware owns `401/403`; unexpected errors reach the existing safe `500` handler.

## 7. API Contract Plan

### `GET /api/learning/sets/:setId`

- Access: authenticated USER.
- Returns Set ID/name/Topic metadata plus ordered cards.
- Each card contains Vocabulary metadata, all nested Meaning/Example content and `{ status, review_count, revision, last_reviewed_at }`; no row is exposed as `NEW` with zero revision/count.
- Excludes password/auth data, private ownership internals, SRS scheduling values and deferred rewards.

### `POST /api/learning/events`

- Access: authenticated USER.
- Exact body: `event_id`, `set_id`, `vocabulary_id`, `expected_revision`, `outcome`.
- Returns the resulting public progress projection.
- Backend derives USER, status, counters and timestamps.

### Safe Errors

- `400 VALIDATION_ERROR`
- `404 LEARNING_SET_NOT_FOUND`
- `409 LEARNING_SET_EMPTY`
- `409 LEARNING_SET_ITEM_CHANGED`
- `409 LEARNING_PROGRESS_CHANGED`
- existing `401 AUTHENTICATION_FAILED`
- existing `403 FORBIDDEN`
- safe `500 INTERNAL_SERVER_ERROR`

## 8. Backend and Database Verification Plan

- Migration/constraint tests for schema, unique pair, allowed status, non-negative counters/revision, nullable SRS fields and delete behavior.
- Learning payload tests for ordered Set traversal, complete multi-meaning nesting, deterministic child ordering and requesting-USER progress projection.
- Authorization tests for Guest/ADMIN, public System Set, owned private Set and non-owner/missing private Set non-disclosure.
- Empty Set, malformed ID/body, unsupported field, stale membership and safe unexpected-error tests.
- Transaction/concurrency tests for first progress creation, outcome transitions, both-outcome counter increments, immediate same-event retry, different stale event rejection and concurrent first events.
- Verify reads/reveal-equivalent fetches never create progress.
- Re-run relevant Authentication, Vocabulary and Vocabulary Set backend regressions after focused Learning tests.

## 9. Frontend Foundation Plan

This phase deliberately stops before the final Flashcard experience.

- Add a Learning API service using `httpClient` and safe error mapping.
- Add `/learn/vocabulary-sets/:setId` beneath `ProtectedRoute → AuthenticatedShell → UserRoute` with a minimal implemented loading/foundation page, not a completed visual design.
- Add learning entry actions only to authenticated USER views of public System Set detail and owned private Set detail when appropriate; Guest retains login path and ADMIN receives no learner action.
- Add a Learning-owned run-state helper with a namespaced `sessionStorage` schema. It stores only USER ID, Set ID, current Vocabulary ID and assessed Vocabulary IDs/outcomes needed for the current run.
- Learning observes shared auth state/session invalidation and clears only its namespace; no Flashcard key or cleanup logic is added inside Auth internals.
- Add focused service, route/guard and run-state serialization/reconciliation tests before design work.

## 10. Mandatory UI/UX HUMAN Checkpoint

After frontend foundation verification and before final UI implementation, create a focused repo-native design checkpoint artifact for HUMAN review. Implementation must pause at this gate.

The checkpoint must cover:

- desktop/mobile card front and revealed back;
- deterministic primary-Meaning/Example hierarchy while retaining the complete backend payload;
- progress/session header and pronunciation-control placement;
- reveal, remembered, study-again, previous/next, restart and completion flows;
- loading, empty, not-found, stale-item, event/audio failure and pending states;
- focus transitions, alert/status announcements, keyboard map and reduced-motion behavior;
- responsive overflow behavior within the existing App Layout.

The checkpoint must not redesign AuthenticatedShell, add Quiz/Pronunciation Practice/Dashboard, or authorize final frontend coding. HUMAN approval is an explicit dependency of the next phase.

## 11. Final Frontend Implementation Plan

Only after HUMAN approval of the UI/UX checkpoint:

- Replace the foundation page with the complete Flashcard learning page.
- Fetch a fresh learning payload, reconcile Learning-owned same-tab state by Vocabulary ID and discard invalid/stale state safely.
- Render one accessible card at a time with front/reveal behavior and the HUMAN-approved primary Meaning/Example hierarchy.
- Submit a single pending event at a time; reuse `event_id`/revision for an inconclusive retry, refresh on progress conflict and preserve revealed context on failure.
- Mark current-run completion only after every current card has one successful assessment; show counts without claiming XP/SRS rewards.
- Implement Previous/Next inspection, explicit restart confirmation, new-run behavior, summary and safe exit back to Set detail.
- Implement optional pronunciation URL playback only, with local safe error/retry and no progress mutation.
- Apply approved focus, keyboard, responsive and reduced-motion behavior.
- Do not add a generic Learn navigation/dashboard unless the approved checkpoint explicitly requires an entry already within this SPEC boundary.

## 12. Browser, Accessibility and Regression Plan

### Focused Learning Browser Coverage

- USER access from public/owned private Set; Guest login path; ADMIN/non-owner protection.
- Ordered traversal, complete nested payload handling and deterministic primary-Meaning/Example presentation.
- Reveal does not mutate; both outcomes update expected progress; pending prevents duplicate actions.
- Immediate retry uses the same event; stale progress conflict refreshes safely.
- Same-tab reload resume, stale cursor fallback, restart preservation of durable progress and completed-run summary/new run.
- Empty/load/not-found/stale-item/event/audio failure and retry states.
- Keyboard-only flow, focus movement, live alerts/status, reduced-motion and mobile/tablet/desktop overflow checks.

### Cross-Feature Regression

- Relevant frontend unit and Auth/App Layout browser suites.
- Topic, Vocabulary and public/USER/ADMIN Vocabulary Set real-stack suites because learning adds Set entry actions/routes and Vocabulary references.
- Frontend ESLint and production build.
- Guarded TEST fixture cleanup, orphan-process/listener check, `git diff --check`, secret and scope checks.

Do not run deferred Quiz/SRS/gamification suites that do not exist or broaden coverage beyond affected contracts.

## 13. Formal TEST, REVIEW and Closure Preparation

- Trace AC-01 through AC-15 to migration/backend/frontend/browser evidence.
- Review backend authorization, private Set non-disclosure, Set membership, progress ownership, optimistic concurrency, safe errors and secret handling.
- Review architecture separation, Learning-owned run-state cleanup, no Auth coupling and no frontend-authoritative progress logic.
- Review database constraints/delete behavior and absence of Session/event/SRS/deferred-domain schema.
- Review UI checkpoint conformance, accessibility/responsive evidence and cross-feature regression results.
- Record formal TEST and REVIEW outcomes, resolve findings through the approved workflow, and request separate HUMAN closure authorization before marking the feature `DONE`.

## 14. Implementation Order and Dependencies

1. HUMAN approves this PLAN.
2. Synchronize approved documentation and mark only covered work `PLANNED`.
3. Add Prisma Learning Progress model plus one migration; validate/generate and verify only through guarded TEST DB.
4. Implement repository/service/controller/routes and `createApp` composition.
5. Add/run database/backend/API/security tests and relevant backend regressions.
6. Implement frontend service, USER route/entry foundation and Learning-owned run-state helper; add focused foundation tests.
7. Produce the UI/UX design checkpoint artifact and STOP for HUMAN approval.
8. After checkpoint approval, implement the final Flashcard learning UI and approved interaction/accessibility states.
9. Add/run focused browser/accessibility coverage and required cross-feature regressions; complete cleanup/static/build/scope gates.
10. Execute formal TEST/REVIEW and prepare separate HUMAN-authorized closure.

This order stabilizes documentation, persistence and API behavior before frontend work, proves the route/session-state foundation before design, and prevents final UI implementation from preceding the required HUMAN experience decision.

## 15. Risks and Boundaries

- Optimistic revision/event handling must be transactionally tested under concurrent first-write and stale-write cases; frontend pending state is not the security boundary.
- `last_event_id` guarantees only immediate current-event retry. It is not an event ledger and must not be documented/tested as arbitrary historical replay support.
- Set content can change during a client run. Every event revalidates current membership, and the UI must refresh/restart rather than writing stale progress.
- Full nested card payloads are acceptable for focused V1 Sets but should not silently introduce pagination/partial Meaning selection. Performance findings beyond realistic project data require a later approved change.
- Session storage contains no credentials or full content. Namespace cleanup remains Learning-owned and must not modify Auth internals.
- `NEEDS_REVIEW` and nullable SRS fields preserve future compatibility but no service, index, due-date logic or queue is implemented now.
- No new dependency or external pronunciation provider is required.

## 16. Open Questions

None. The approved SPEC resolves actor, access, session, event, progress, SRS, API and UI-checkpoint boundaries. The approved PLAN is ready for TASK decomposition; TASK approval remains required before implementation.

## Approval Gate

```text
SPEC STATUS: APPROVED
PLAN STATUS: APPROVED
NEXT ALLOWED STAGE: TASK
TASK / IMPLEMENTATION AUTHORIZED: NO
```
