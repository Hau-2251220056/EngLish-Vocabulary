# SPEC: Discovery V1 — Khám phá bộ từ

**Status:** `HUMAN APPROVED — PLAN AUTHORIZED` (includes HUMAN-approved client-side pagination amendment)

**Feature type:** Enhancement of the completed Topic and Vocabulary Set discovery foundation.

**Base:** `feature/discovery-v1` at `ee378beaf7e91ae522e47d0c1c28686ce2a59bbd`.

## 1. Objective

Discovery V1 evolves the existing public Topic-first flow into a learner-facing **Khám phá bộ từ** experience where public System Vocabulary Sets are the primary discovery object and Topics provide filtering and compatible navigation.

The feature reuses the existing Topic, public System Set, public Set detail, Learning, Quiz and copy contracts. It does not rebuild those domains or introduce a new public-content model.

## 2. Actors

- **Guest:** May browse Discovery and public System Set detail. Authenticated-only actions lead to the existing login flow and must not perform a protected mutation.
- **USER:** May browse, view public detail, start existing Learning or Quiz flows for a supported non-empty public System Set, and save a Set through the existing copy contract.
- **ADMIN:** May safely browse the public experience. Discovery V1 adds no learner-facing management action; existing ADMIN management remains on its existing protected routes.

No new role is introduced.

## 3. Existing Behavior Reused

### Backend and data contracts

- `GET /api/topics` returns the unpaginated public Topic metadata list.
- `GET /api/topics/:topicId` returns public Topic metadata.
- `GET /api/topics/:topicId/vocabulary-sets` returns public System Set summaries for that Topic.
- `GET /api/vocabulary-sets/:setId` returns a public System Set and its ordered minimum Vocabulary preview.
- `POST /api/vocabulary-sets/:setId/copy` creates an independent private copy for an authenticated USER.
- Public visibility remains determined by the existing authoritative `is_public` rule.
- A public System Set retains a required Topic. A copied Personal Set remains private and topicless.
- System Set membership continues to use canonical Vocabulary identities and deterministic `position` order.
- Existing transactions, ownership checks, not-found concealment and canonical-reference validation remain authoritative.

### Frontend foundations

- Existing routes `/topics`, `/topics/:topicId`, `/topics/:topicId/vocabulary-sets` and `/vocabulary-sets/:setId` are retained.
- Existing Topic/public Set services, authenticated navigation, public Set detail, Learning/Quiz entry and copy-to-My-Sets behavior are reused.
- Existing Topic, Vocabulary Set, public discovery, copy, responsive and accessibility tests are retained where their approved behavior remains applicable.

## 4. Scope

### In Scope

- Evolve `/topics` into the unified **Khám phá bộ từ** landing.
- Make public System Vocabulary Set cards the main content of that landing.
- Load Topics and their public System Set summaries through existing public APIs.
- Provide client-side Set search and Topic filtering, including an **all Topics** state.
- Display public Set cards in the established My Sets visual family with public-context actions.
- Preserve existing Topic detail, Topic-scoped Set discovery and public Set detail deep links.
- Keep authenticated USER browsing inside the existing authenticated App Shell.
- Preserve public Guest browsing and appropriate login prompting.
- Preserve USER Learning, Quiz and copy/save actions where existing contracts permit them.
- Provide accessible loading, empty, filtered-empty, error/retry and pending states.
- Support desktop, tablet and mobile layouts without horizontal overflow.
- Synchronize obsolete generic Discovery wording so it cannot silently authorize Community discovery or server-side pagination.

### Out of Scope / Non-goals

- Community-shared USER Sets, Community publishing or social discovery.
- Creator/social attribution, likes, followers or recommendations.
- Server-side search, server-side pagination or sorting.
- A new global public Set endpoint or changed API response shape.
- New copy semantics, duplicate-copy prevention or a copy idempotency key.
- Progress indicators or recommendations on Discovery cards.
- Meaning, Example, CEFR or pronunciation expansion in the public detail payload.
- Editing or deleting from public Discovery/detail.
- Database schema, migration, index or ownership/visibility changes.
- Dashboard, Gamification, SRS, Quiz, Learning or ADMIN-management redesign.
- New dependencies, external services or roles.

## 5. Route and Navigation Behavior

- `/topics` becomes the canonical unified Discovery landing and uses the page title **Khám phá bộ từ**.
- Existing authenticated navigation labelled **Khám phá bộ từ** continues to target `/topics`.
- An authenticated USER browsing `/topics`, `/topics/:topicId`, `/topics/:topicId/vocabulary-sets` or `/vocabulary-sets/:setId` remains within the authenticated App Shell.
- An authenticated ADMIN may browse the same public routes safely inside the authenticated shell, without new management controls.
- A Guest may open the same routes using the existing public browsing shell.
- `/topics/:topicId` remains a compatible metadata/detail route.
- `/topics/:topicId/vocabulary-sets` remains a compatible Topic-scoped public System Set route.
- `/vocabulary-sets/:setId` remains the canonical public Set detail route.
- Existing bookmarks and deep links must continue resolving without redirecting to private or ADMIN routes.

## 6. Discovery Landing Behavior

### Data composition

- The unified `/topics` load composes `GET /api/topics` with the existing `GET /api/topics/:topicId/vocabulary-sets` response for every returned Topic.
- Topic-scoped Set requests must not form a sequential Topic-by-Topic waterfall. They may be dispatched concurrently or bounded-concurrently using the current APIs.
- The client associates each Set with its already-known Topic metadata for display and filtering; it does not invent or persist a new relationship.
- V1 treats the complete composed result as one page load. Search and Topic filtering become available only after the complete current catalog dataset for that load is available.
- If any required Topic-scoped Set request fails, the UI must not present the successfully returned subset as though it were the complete catalog. It shows the Discovery error/retry state. Partial-success catalog behavior requires separate HUMAN approval.
- Retry repeats the Discovery load using the current public contracts.
- Discovery implementation and tests must record the initial unified-catalog HTTP request count, catalog readiness timing, and whether request count scales directly with Topic count.
- This SPEC authorizes no new catalog endpoint, server-side pagination, server-side search/filter or API response change.
- If implementation evidence shows that current API composition causes materially poor readiness, excessive request volume or unacceptable scaling for the current dataset, implementation must STOP for HUMAN review before introducing a global Set endpoint, server-side pagination, server-side search/filter or any API response change.

### Search and Topic filtering

- Search is client-side and case-insensitive after trimming the input.
- Search and Topic filtering operate only on the complete catalog dataset for the current successful load, never on an incomplete in-flight or partial-success subset.
- Search matches public Set `name` and non-null `description` only.
- The Topic filter supports **all Topics** and one exact Topic identity at a time.
- Search and Topic selection combine with AND semantics.
- Changing either control updates visible cards without another search-specific API request.
- Search/filter state is page-local; Discovery V1 does not require URL query persistence or cross-session persistence.
- No sorting control is added. Results preserve deterministic source order: Topic API order, then the Set order returned for each Topic.
- After complete load, the first 3 public System Sets in deterministic source order form the Featured section independently of search/Topic filtering. Those IDs are removed before the remaining normal catalog is filtered and paginated client-side at exactly 9 Sets per page.
- Search or Topic changes reset pagination to page 1; the active page is clamped to the filtered result's valid range. Page changes issue no API request.

## 7. Set Card Contract

### Final catalog presentation amendment

- The visible content begins with a compact **Bộ từ nổi bật** visual preview, then a wider mini filter sidebar and normal catalog. V1 renders the first 3 Sets from the complete loaded catalog in existing source order in every environment. This temporary deterministic selection is not an authoritative ranking and must not claim popularity or recommendation semantics.
- The filter sidebar uses labelled search and exact single-Topic radio controls. Search, Topic heading, CEFR and result count remain fixed within the panel while only a viewport-bounded Topic-options region scrolls when needed. **Xóa bộ lọc** is always present beside the search heading and is disabled only while search, Topic and CEFR are all at their defaults. Normal desktop targets three columns and nine normal Sets per page (three rows where width permits); responsive layouts fall back without horizontal overflow.
- Featured IDs are excluded from normal filtering and pagination. The Featured section remains independent of search/Topic controls; search/Topic changes reset normal-catalog page 1, valid-page clamping is mandatory and page navigation is frontend-only.
- Cards use deterministic local cover presentation because no Set cover field exists: Topic badge overlays the cover, title/count share one row, descriptions clamp to two lines and compact **Lưu**/**Xem** actions align left using Lucide icons.
- Successful copy may expose best-effort current-session **Đã lưu** feedback but repeated copies remain allowed. The current API provides no authoritative account-level source-copy recognition.

Each Discovery card represents one public System Set and displays:

- Set name.
- Short description, with a safe fallback when absent.
- Vocabulary count from the existing summary.
- Topic name as a badge or label, derived from the loaded Topic metadata.

Actions:

- **Xem** opens `/vocabulary-sets/:setId`.
- An authenticated USER may use **Lưu** / **Lưu vào Bộ từ của tôi**, invoking the existing copy endpoint.
- A Guest receives a clearly named login action for saving rather than a protected API call.
- An ADMIN receives no copy, Learning, Quiz, edit or delete action on the card; Discovery V1 adds none.
- Copy/save pending state disables repeat submission. On success, the USER opens the resulting private Set through the existing My Sets detail route. On failure, the card exposes a safe retryable error without losing the Discovery results.

Cards use the same visual family as **Bộ từ của tôi**, but ownership-specific menus and private edit/delete actions are not reused.

## 8. Public Set Detail

- Public Set Detail remains read-only and continues using `GET /api/vocabulary-sets/:setId`.
- It displays existing Set metadata and the ordered Vocabulary preview already provided by the API: word and optional phonetic.
- It does not expose Meaning, Example or CEFR data.
- A USER may enter existing Learning and Quiz flows when the current contracts permit them and the Set is non-empty.
- A USER may copy/save through the existing copy contract.
- A Guest receives the existing login path for authenticated-only actions.
- An ADMIN gains no learner-facing management action.
- No actor receives public-detail edit or delete controls.

## 9. Copy / Save Business Rules

- **BR-01:** Only an authenticated `USER` may execute the copy endpoint.
- **BR-02:** Copy creates a fresh, independent, private Personal Set owned by that USER.
- **BR-03:** The copied Set is topicless, uses fresh Set/Item identifiers and preserves the source Set's exact canonical Vocabulary identities and order.
- **BR-04:** Backend canonical-reference validation and the existing transaction remain authoritative.
- **BR-05:** Repeated intentional copies are allowed.
- **BR-06:** Discovery V1 adds no backend idempotency key or duplicate-copy policy.
- **BR-07:** The frontend prevents rapid duplicate clicks only while the current copy request is pending.
- **BR-08:** Copy does not modify the public source Set or grant edit permission over it.
- **BR-09:** API request and response shapes remain unchanged.

## 10. Other Business Rules

- **BR-10:** Discovery exposes public System Sets only; private Personal Sets and Community-shared content are excluded.
- **BR-11:** Topic identity, System Set visibility and USER authorization remain backend-enforced.
- **BR-12:** Search and filter affect presentation only and never mutate Topics, Sets, Vocabulary or Learning Progress.
- **BR-13:** Public Set detail and Discovery are read-only except for the explicit authenticated copy action.
- **BR-14:** Learning and Quiz entry reuse their existing access, empty-Set and authorization contracts.
- **BR-15:** Discovery does not calculate or display progress, SRS eligibility, XP, Level, Streak or recommendations.

## 11. Data and API Requirements

- Existing `TOPIC`, `VOCABULARY_SET` and `VOCABULARY_SET_ITEM` data is sufficient.
- No schema or migration change is planned.
- No new persistence is required for search, filter or Discovery UI state.
- No new endpoint or response field is planned.
- Topic labels on cards are produced by joining existing client-loaded Topic metadata to each existing `topic_id`.
- If implementation proves the existing endpoints cannot safely or practically produce the approved unified catalog, implementation must stop for HUMAN contract review before adding or changing an endpoint.

## 12. UI States and Accessibility

- Initial loading must not render a premature empty state.
- Global empty state: no public System Set exists across the loaded Topics.
- Filtered-empty state: public Sets exist, but none matches the current search and Topic filter.
- A Topic with no public Sets remains valid and may produce a filtered-empty state.
- Operational failure exposes a safe error and keyboard-operable retry action without internal details.
- Copy pending and failure states are distinguishable from catalog loading failure.
- Search has a persistent associated label and an accessible result count.
- Topic filtering uses natively operable controls or an equivalent accessible named control with clear selected state.
- Cards, badges and actions have meaningful accessible names and deterministic keyboard order.
- All interactive elements expose clear focus-visible treatment.
- Desktop, tablet and mobile layouts must preserve readable cards and usable actions without horizontal overflow.
- Responsive wrapping must not hide search, Topic filtering or primary card actions.
- Reduced-motion preferences must be respected by any reused loading or transition treatment.

## 13. Backward Compatibility and Documentation

- Existing Topic and public Set API contracts remain compatible.
- Existing public URLs remain valid.
- Existing Topic metadata pages remain available even though `/topics` becomes Set-first.
- Existing My Sets, ADMIN Set management, Learning and Quiz routes remain unchanged.
- Existing tests are migrated only where the approved `/topics` presentation changes; their underlying Topic, visibility, ordering, access and copy assertions remain valid.
- The older generic Discovery description mentioning Community-shared USER Sets, creator attribution and server-side pagination is superseded for Discovery V1 by this SPEC and the implemented Vocabulary Set V1 boundary. Those capabilities remain deferred and unauthorized.

## 14. Acceptance Criteria

- **AC-01:** Any visitor opening `/topics` sees **Khám phá bộ từ** with public System Set cards as the primary content.
- **AC-02:** Successful existing Topic and Topic-scoped Set responses compose all public System Sets with correct Topic labels without a new API contract or sequential Topic-by-Topic request waterfall.
- **AC-03:** Search is trimmed, case-insensitive, limited to Set name/description and causes no search API request.
- **AC-04:** Topic filtering uses exact Topic identity; an all-Topics option restores the cross-Topic result.
- **AC-05:** Search and Topic filter combine with AND semantics.
- **AC-06:** No public System Sets produces a clear global empty state only after loading completes.
- **AC-07:** Existing Sets with no current match produce a distinct filtered-empty state.
- **AC-08:** Any required Discovery request failure withholds unexplained partial results and provides a safe working retry.
- **AC-09:** Cards display name, description fallback, count and Topic label; **Xem** opens existing public detail.
- **AC-10:** A Guest selecting save causes no copy request and receives the existing login route.
- **AC-11:** A USER save issues only one request while pending, creates the existing independent topicless private copy and opens its My Sets detail on success.
- **AC-12:** A later intentional repeat copy remains allowed.
- **AC-13:** Copy failure retains loaded results and exposes a safe retryable card-level error.
- **AC-14:** Public Set detail remains read-only, ordered and limited to existing metadata plus word/optional phonetic preview.
- **AC-15:** A USER can reach existing Learning and Quiz actions for an eligible non-empty public Set; Guest and ADMIN behavior remains unchanged.
- **AC-16:** No public Discovery/detail surface exposes edit/delete controls.
- **AC-17:** An authenticated USER remains inside the authenticated App Shell throughout Discovery and public Set detail navigation.
- **AC-18:** Guest public browsing remains available without authentication.
- **AC-19:** Existing Topic detail, Topic-scoped Set and public Set detail deep links remain valid.
- **AC-20:** Search, Topic filter, cards, retry, login, Learning, Quiz and save actions are keyboard accessible, correctly named and visibly focused.
- **AC-21:** Desktop, tablet and mobile layouts have no horizontal overflow or inaccessible wrapped action.
- **AC-22:** Discovery reads/filtering never mutate Set, Vocabulary or Learning Progress data.
- **AC-23:** Only public System Sets appear; private and Community-shared USER Sets do not.
- **AC-24:** Existing authorization, visibility, canonical validation, copy transaction and safe not-found tests remain green.
- **AC-25:** No schema/migration, new endpoint, API response change, dependency, role, progress UI, sorting or server-side pagination is introduced.
- **AC-26:** Discovery evidence records initial catalog HTTP request count, catalog readiness timing and the relationship between request count and Topic count.
- **AC-27:** Search/filter controls operate only after all required responses for the current catalog load have completed successfully.
- **AC-28:** Failure of any required Topic-scoped Set request produces the Discovery error/retry state and never an apparently complete partial catalog.
- **AC-29:** Materially poor readiness, excessive requests or unacceptable current-dataset scaling triggers the mandatory HUMAN STOP before any global endpoint, server-side pagination, server-side search/filter or API response change.
- **AC-30:** After complete load, at most the first 3 source-ordered Sets render as Featured in every environment. Their IDs do not consume normal-catalog slots; the filtered normal catalog shows at most 9 Sets per client-side page with working `Trước`/`Sau` controls, valid reset/clamping and no page-change request.

## 15. Edge Cases

- Topic list is empty.
- Topics exist but none contains a public System Set.
- A selected Topic contains no public System Set.
- A Set has a null description.
- A legacy public Set has no Items; detail remains safe and Learning/Quiz actions remain unavailable under existing contracts.
- A Topic or Set becomes unavailable between Discovery loading and navigation.
- One Topic-scoped request fails while others succeed; partial results are withheld and retry is offered.
- A USER copy request fails or is slow; the action remains single-pending and retryable.
- A source disappears or becomes inaccessible before copy; the existing safe API error is shown.
- Long Topic/Set names and descriptions wrap without horizontal overflow.

## 16. Dependencies and Impact

- **Frontend:** Discovery data composition, authenticated/public shell selection, Set-first landing, filters, reusable cards/states and browser tests.
- **Backend:** Existing endpoints and business rules are reused; no behavior change is currently required.
- **Database:** No change.
- **API:** No contract change planned.
- **Security:** Existing public-read boundaries and authenticated USER-only copy remain authoritative at the backend.
- **Documentation:** Discovery UI/status documentation must align with this enhancement while retaining Topic/Vocabulary Set history.

## 17. Open Questions

None. Evidence requiring a new endpoint, server-side pagination, schema change or altered copy/security contract is a STOP condition for HUMAN review.

Deferred follow-ups include Set-level CEFR metadata/filtering and real per-Set cover-image storage. Community-shared USER Sets, creator/social attribution, sorting, production featured ranking, server-side global search/pagination and authoritative persistent saved-source recognition remain outside Discovery V1.
