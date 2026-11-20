# SPEC: Learning Progress View V1

**Feature status:** `DONE` — USER-facing read extension complete; the existing Learning Progress engine remains a separate `DONE` capability.

**SPEC status:** `APPROVED`

**Human approval:** `APPROVED`, including persisted-only summary semantics, status filtering, deferred search and compatibility-only `NEEDS_REVIEW` display.

**Implementation authorized:** `NO`

## 1. Objective

Provide an authenticated USER with a read-only view of their current persisted Vocabulary learning progress. The view summarizes started Vocabulary and presents a bounded, paginated list of the current state recorded for each `(user_id, vocabulary_id)` pair.

This is a presentation and read-API extension over the completed Flashcard / Learning V1 engine. It does not rebuild or change that engine, its meaningful-event rules, its optimistic concurrency behavior, or its persistence identity.

## 2. Existing Context and Reconciliation

- Flashcard / Learning V1 is `DONE` and already materializes `LEARNING_PROGRESS`, uniquely identified by `(user_id, vocabulary_id)`.
- Existing meaningful events authoritatively write `LEARNING` for `STUDY_AGAIN` and `LEARNED` for `REMEMBERED`; both increment `review_count` and `revision` once.
- `NEW` is conceptual and means that no `LEARNING_PROGRESS` row exists. It is not persisted.
- The database permits the future-compatible `NEEDS_REVIEW` value, but the completed Learning engine never assigns it because no SRS algorithm or review scheduling is implemented.
- Existing Set-scoped learning payloads project progress only while learning one accessible Set. There is no general current-USER progress-list or summary API and no USER progress page.
- `/dashboard` remains a placeholder. This feature does not implement or replace Dashboard.
- Legacy documentation that mentions accuracy, activity history, Topic/Set completion, XP, streaks, review queues or charts is future-product context and is not part of this V1.

## 3. Actors and Authorization

- **Guest:** Has no Learning Progress View route or API access.
- **USER:** Can view only their own persisted current Learning Progress summary and records.
- **ADMIN:** Has no Learning Progress View V1 route or API access.

The backend derives `user_id` exclusively from the authenticated session. The request cannot select or override a user. Existing authentication and USER-role middleware remain authoritative; frontend route guards and navigation visibility are UX only.

## 4. Scope

### In Scope

- One USER-only read API for the current USER's persisted Learning Progress.
- Summary counts for total started, `LEARNING`, `LEARNED` and existing `NEEDS_REVIEW` records.
- A paginated current-state list with optional status filtering.
- Minimal Vocabulary identity metadata sufficient to recognize the progress record.
- One authenticated USER route at `/my/learning-progress` under the existing App Layout.
- One USER-only navigation destination in the existing authenticated navigation.
- Loading, first-use empty, filtered-empty, safe-error, retry and pagination states.
- Responsive, keyboard-accessible and screen-reader-accessible presentation.
- Focused database-query, backend, authorization, frontend and browser verification in later stages.

### Out of Scope / Deferred

- Creating, updating, deleting or resetting Learning Progress from this view.
- Persisting or globally listing conceptual `NEW` Vocabulary.
- Defining an eligible Vocabulary universe or a percentage of all available Vocabulary.
- Topic progress, Set progress, completion percentage or progress grouped by Topic/Set.
- Words to Review, review queue, review eligibility, due counts or review actions.
- SRS scheduling, algorithms, grades, transitions or automatic `NEEDS_REVIEW` assignment.
- Continue Learning recommendations or resume links selected by the backend.
- Learning history, activity timeline, event ledger or persistent Learning Session.
- Accuracy, correct/incorrect counts, Quiz results or Pronunciation results.
- XP, Level, Daily Goal, Streak, Achievement or other gamification.
- User Dashboard or Admin Dashboard implementation.
- Flashcard redesign or changes to learning-event behavior.
- A standalone USER Vocabulary catalog/detail/discovery capability.
- Search in V1. The list may be filtered only by approved current progress status.
- New database entities, fields, indexes or migrations unless a later approved PLAN proves an implementation blocker and returns for HUMAN decision.

## 5. Data and Summary Semantics

### 5.1 Existing Persistence Boundary

V1 reads the existing `LEARNING_PROGRESS` and related `VOCABULARY` records. It introduces no duplicate aggregate, summary table or cached counter.

The current USER's persisted rows are the complete source for the V1 summary:

- `total_started`: count of all persisted Learning Progress rows for the USER;
- `learning`: count whose current status is `LEARNING`;
- `learned`: count whose current status is `LEARNED`;
- `needs_review`: count whose current status is `NEEDS_REVIEW`.

The invariant is:

```text
total_started = learning + learned + needs_review
```

Summary counts always cover all persisted rows for the current USER and are not narrowed by the list's optional status filter or current page.

### 5.2 `NEW` Boundary

Conceptual `NEW` is excluded from both the global summary and list because it has no persisted row and this feature does not define a global eligible Vocabulary universe. The UI must not label `total_started` as total available Vocabulary or calculate a global completion percentage from it.

Reading this feature must not create placeholder progress rows for `NEW` Vocabulary.

### 5.3 `NEEDS_REVIEW` Boundary

If an existing row has status `NEEDS_REVIEW`, V1 counts, filters and displays that current state. This is compatibility-oriented presentation only.

V1 does not:

- decide when a word needs review;
- inspect `next_review_at` to establish eligibility;
- expose a due queue or review action;
- transition any row to or from `NEEDS_REVIEW`; or
- imply that Words to Review or SRS is implemented.

### 5.4 Minimal Vocabulary Projection

Each list item contains only:

- `vocabulary.id`;
- `vocabulary.word`;
- nullable `vocabulary.phonetic`;
- `status`;
- `review_count`;
- `last_reviewed_at`.

The API does not return Meaning, Example, pronunciation URL, Set membership, Topic membership, owner data, revision, event ID or future SRS fields. This projection is a progress view, not a USER Vocabulary catalog.

## 6. API Contract

### 6.1 Endpoint

```text
GET /api/learning/progress
```

Access: authenticated `USER` only.

Supported query parameters:

| Parameter | Requirement |
|---|---|
| `page` | Optional positive integer; default `1`. |
| `page_size` | Optional positive integer; default `20`; maximum `100`. |
| `status` | Optional exact value `LEARNING`, `LEARNED` or `NEEDS_REVIEW`. Omission means all persisted statuses. |

Search and additional sorting/filter parameters are not supported in V1. Malformed, repeated, unknown or unsupported query parameters return the approved validation error rather than being silently interpreted.

### 6.2 Success Response

```json
{
  "success": true,
  "data": {
    "summary": {
      "total_started": 12,
      "learning": 4,
      "learned": 8,
      "needs_review": 0
    },
    "items": [
      {
        "vocabulary": {
          "id": "uuid",
          "word": "book",
          "phonetic": "/bʊk/"
        },
        "status": "LEARNED",
        "review_count": 3,
        "last_reviewed_at": "ISO-8601 timestamp"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total_items": 12,
      "total_pages": 1
    },
    "filter": {
      "status": null
    }
  }
}
```

`total_items` and `total_pages` describe the optionally filtered list. `summary` remains unfiltered.

An out-of-range page is successful with an empty `items` array and truthful pagination metadata; it is not a not-found error.

### 6.3 Deterministic Ordering

List records are ordered by:

1. `last_reviewed_at` descending, with `NULL` values last;
2. `created_at` descending;
3. Learning Progress `id` ascending.

The server owns this ordering. V1 exposes no client-selectable sort.

### 6.4 Safe Errors

Errors use the existing safe envelope:

```json
{
  "success": false,
  "error": {
    "code": "...",
    "message": "safe message"
  }
}
```

| Condition | Status | Code |
|---|---:|---|
| Invalid or unsupported query | `400` | `VALIDATION_ERROR` |
| Missing or invalid session | `401` | existing `AUTHENTICATION_FAILED` |
| Authenticated non-USER | `403` | existing `FORBIDDEN` |
| Unexpected failure | `500` | existing `INTERNAL_SERVER_ERROR` |

The response and logs must not expose database details, credentials, session values or another user's identifiers/data.

## 7. USER Route and Functional UX

- Add `/my/learning-progress` only beneath the existing `ProtectedRoute` → `AuthenticatedShell` → `UserRoute` hierarchy.
- Add a USER-only “Tiến độ học” destination to the existing authenticated navigation. ADMIN does not see it.
- The page presents the four persisted summary counts without presenting a global Vocabulary completion percentage.
- The default list shows all persisted progress statuses using server-provided deterministic order.
- A status control supports All, Learning, Learned and Needs Review. Changing status returns to page 1 and fetches the corresponding server-filtered page.
- Pagination exposes clear previous/next behavior and current-page context. Controls are disabled when unavailable or while the relevant request is pending, preventing duplicate navigation requests.
- First-use empty state explains that no learning progress has been recorded and may direct the USER to existing Vocabulary Set discovery/My Sets entry points. It must not fabricate recommendations.
- Filtered-empty state explains that no current records match the selected status without implying that the USER has no progress at all.
- Loading state is exposed accessibly and does not render a premature empty state.
- Safe operational/API failure is rendered as an accessible error with a retry action.
- If a previously valid page becomes out of range after data changes, the truthful empty page and pagination controls remain usable; the frontend may return to the nearest valid page only through a normal refetch, never by fabricating items.
- Visual styling remains flexible for a later HUMAN UI/UX Design Checkpoint. This SPEC defines information hierarchy, behavior and accessibility rather than pixel-level styling.

## 8. Accessibility and Responsive Requirements

- Summary regions, status filter, record list and pagination have clear accessible names and heading hierarchy.
- Status is communicated by text, not color alone.
- Native buttons/controls are keyboard operable and retain visible focus indication.
- Loading and error feedback use appropriate live-region/alert semantics without excessive announcements.
- Focus moves predictably after retry or page/filter changes and is not trapped.
- Touch targets remain usable on mobile, and summary/list metadata does not create horizontal overflow.
- The layout adapts across existing mobile, tablet and desktop breakpoints without changing the global App Layout.
- Reduced-motion preferences are respected for any non-essential transition introduced later.

## 9. Read-Only and Isolation Rules

- Summary and list queries are read-only and must never create, update or delete `LEARNING_PROGRESS`.
- They must not update `last_reviewed_at`, `review_count`, `revision`, `last_event_id` or future SRS fields.
- They must not create a persistent Learning Session, history or analytics record.
- All database predicates and counts are constrained by the authenticated `user_id` before filtering or pagination.
- A USER cannot request another USER's summary or records through path, query, body, header or forged client state.
- The frontend does not aggregate authoritative counts from independently fetched pages; it renders backend-provided summary and pagination values.

## 10. Business Rules

- **BR-01:** Only an authenticated `USER` can access Learning Progress View V1.
- **BR-02:** The backend returns only the authenticated USER's persisted Learning Progress.
- **BR-03:** `total_started` counts persisted rows and excludes conceptual `NEW`.
- **BR-04:** Summary counts cover all current persisted rows and remain independent of list filtering/pagination.
- **BR-05:** V1 displays existing `NEEDS_REVIEW` as a current status but creates no review eligibility, queue, scheduling or transition behavior.
- **BR-06:** The list supports only the approved status filter; search is deferred.
- **BR-07:** Progress reads are side-effect free.
- **BR-08:** Progress remains per `(user_id, vocabulary_id)` and independent of Topic, Set, Set Item or Meaning.
- **BR-09:** The page is a dedicated USER progress view and does not implement Dashboard.

## 11. Acceptance Criteria

- **AC-01:** An authenticated USER can open `/my/learning-progress` through a USER-only navigation entry under the existing authenticated App Layout.
- **AC-02:** Guest API access returns the existing safe `401`, authenticated ADMIN access returns the existing safe `403`, and neither role can access the USER page.
- **AC-03:** The API summary returns exact current-USER counts for total persisted rows and each of `LEARNING`, `LEARNED` and `NEEDS_REVIEW`, with their sum equal to `total_started`.
- **AC-04:** Conceptual `NEW` is absent from the summary/list and a read creates no placeholder progress row or other database write.
- **AC-05:** The API returns only the approved minimal Vocabulary projection and current progress fields; it exposes no Meaning/Example, Set/Topic membership, revision/event ID, SRS field or other USER's data.
- **AC-06:** The list is paginated with validated defaults/bounds, truthful filtered totals and deterministic approved ordering; an out-of-range page safely returns an empty list.
- **AC-07:** Omitting status returns all persisted statuses; each approved status filter returns only matching rows while the summary remains unfiltered.
- **AC-08:** Invalid, repeated, unknown or unsupported query parameters return `400 VALIDATION_ERROR`; unexpected failures use the existing safe `500` contract without internal leakage.
- **AC-09:** Existing `NEEDS_REVIEW` rows can be counted, filtered and displayed without adding automatic transitions, due logic, review actions or Words-to-Review behavior.
- **AC-10:** The UI provides distinct accessible loading, first-use empty, filtered-empty and safe error/retry states without premature empty rendering.
- **AC-11:** Pagination and filtering prevent duplicate pending actions, preserve truthful server state and are keyboard/screen-reader accessible.
- **AC-12:** The view is responsive without horizontal overflow, communicates status without color alone, preserves visible focus and respects reduced motion.
- **AC-13:** Repeated summary/list reads leave all Learning Progress fields and row counts unchanged.
- **AC-14:** Existing Flashcard learning payload/event behavior, sessionStorage run state, progress transitions, authorization and completed Auth/Topic/Vocabulary/Vocabulary Set behavior do not regress.
- **AC-15:** V1 adds no migration, Topic/Set progress, review queue, SRS, Continue Learning, history, accuracy, Quiz/Pronunciation result, gamification, Dashboard, Flashcard redesign or standalone USER Vocabulary catalog.

## 12. Edge Cases

- USER has no persisted progress: summary values are zero and the first-use empty state appears.
- Selected status has no records while other progress exists: summary remains populated and filtered-empty state appears.
- `last_reviewed_at` is unexpectedly null on an existing compatible row: it sorts after reviewed rows and remains safely displayable as unavailable.
- A valid page exceeds the filtered result's last page: response succeeds with no items and retains truthful totals.
- Data changes between summary/list requests are avoided by returning both from one API response; exact transaction isolation for concurrent event writes is an implementation concern, not permission to cache stale aggregates.
- Vocabulary display casing and nullable phonetic are preserved.
- Remote TEST database latency may lengthen loading during verification but does not change the functional contract.

## 13. Dependencies and Documentation Impact

- **Database:** Reuses existing `LEARNING_PROGRESS` and `VOCABULARY`; no approved migration.
- **Backend:** Extends the existing Learning route/controller/service/repository boundaries with a USER-isolated read operation.
- **Frontend:** Reuses the existing HTTP client, Authentication context, `ProtectedRoute`, `UserRoute`, `AuthenticatedShell` and responsive navigation.
- **Testing:** Reuses guarded TEST database helpers, Learning backend suite, frontend unit infrastructure and real-stack Playwright coverage.
- After SPEC/PLAN/TASK approval, synchronize the active read contract in `docs/API_SPEC.md`, `docs/UI_UX_SPEC.md`, `docs/ARCHITECTURE.md` and `docs/FEATURE_STATUS.md` as required before implementation. Preserve the completed Flashcard / Learning V1 boundary rather than relabeling it unfinished.

## 14. Open Questions / Human Review

No unresolved product decision blocks this proposed V1. HUMAN review is requested for these explicit decisions:

1. The feature is named Learning Progress **View** V1 to distinguish it from the completed persistence/mutation engine.
2. Summary/list cover persisted progress only and intentionally exclude conceptual `NEW`.
3. Status filtering is included; word search and client-selectable sorting are deferred.
4. `NEEDS_REVIEW` is compatibility display only and does not authorize Words to Review or SRS.
5. The default page size is 20 and maximum is 100.
6. The minimal Vocabulary projection is ID, word and nullable phonetic only.

## Approval Gate

```text
EXISTING LEARNING PROGRESS ENGINE: DONE
LEARNING PROGRESS VIEW V1 SPEC STATUS: APPROVED
HUMAN SPEC APPROVAL: APPROVED
PLAN / TASK: APPROVED
IMPLEMENTATION AUTHORIZED: YES — only through the approved task sequence
```
