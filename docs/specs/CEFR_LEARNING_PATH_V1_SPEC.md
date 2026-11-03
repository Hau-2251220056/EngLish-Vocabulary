# SPEC: CEFR Learning Path V1

**Feature status:** `CHANGE REQUEST / NEW FEATURE — SPEC APPROVED`

**SPEC status:** `APPROVED`

**Business-rule direction:** `HUMAN-APPROVED`

**Final Human SPEC approval:** `APPROVED — 2026-11-03`

**PLAN authorized:** `YES — PLAN authoring only`

**Implementation authorized:** `NO`

This document defines product requirements only. It does not authorize a PLAN, TASK decomposition, source change, API or database change, migration, test execution, commit, push, merge, or deployment.

## 1. Purpose and Background

CEFR Learning Path V1 adds one coherent learner journey across three lecturer-requested capabilities:

1. sequential learning through `A1 -> A2 -> B1 -> B2 -> C1`;
2. an authenticated USER Dashboard recommendation for the next required public Vocabulary Set; and
3. a minimal global vocabulary review flow that reuses the existing backend-authoritative SRS foundation.

ELVocab already has public System Vocabulary Sets with Set-level CEFR, bounded backend Learning Sessions, durable NORMAL reveal evidence, per-Vocabulary Learning Progress, per-Set SRS, and a read-only USER Dashboard. Those capabilities do not currently provide an authoritative full-Set learning pass, CEFR unlocking, a next-required-Set recommendation, or a global review queue.

The feature must distinguish **studied once** from **memorized**. A learner progresses by completing one full NORMAL learning pass through every required public Set in the current CEFR level. Quiz results, SRS ratings, memorization state, XP, Level, Streak, Daily Goal, and Learning Progress status do not determine CEFR completion or unlocking.

## 2. Existing Context and Reconciliation

### 2.1 Completed capabilities to extend

- Vocabulary Set ownership, public/private visibility, ordered Set Items, public discovery, and Set-level CEFR `A1`–`C1` are `DONE`.
- Flashcard Learning, Learning Progress, Learning Session V1, and per-Set SRS are `DONE`.
- USER Dashboard is `DONE` as a read-only composition surface.
- Existing backend Learning Sessions are bounded to at most 10 distinct Vocabulary IDs.
- NORMAL session items can carry durable `NORMAL_REVEALED` evidence, and NORMAL session completion requires accepted evidence for every item in that bounded snapshot.
- Existing SRS eligibility, deterministic priority, four ratings, scheduling, revision checks, and replay protection remain backend-authoritative.

### 2.2 Deferred capabilities activated by this change request

- `Words to Review` is currently `TODO`.
- Dashboard `Words to Review Summary` is currently `TODO`.
- `Continue Learning` / next-learning recommendation is currently `TODO`.
- Topic/Set aggregate progression is not currently an active product contract.

### 2.3 Contract conflicts resolved by selected V1 direction

- Set-level C2 remains outside V1. Meaning-level C2 remains valid content metadata but never controls Set progression.
- Existing Dashboard private Set previews and Discovery Featured Sets are not recommendations and must not be relabelled as such.
- One completed backend session of at most 10 items does not prove completion of a larger Set.
- `LEARNING_PROGRESS.status`, `review_count`, and SRS fields are vocabulary-level learning/review state and cannot prove a Set-level NORMAL pass.
- Client `sessionStorage` may support presentation recovery but is not authorization or authoritative completion evidence.

## 3. Actors and Affected Surfaces

### 3.1 USER

An authenticated `USER` may:

- view their authoritative CEFR learning-path state;
- enter eligible required public Sets through NORMAL learning;
- complete a required Set through one authoritative full-Set pass;
- unlock later CEFR levels according to approved progression rules;
- see the next eligible required Set on Dashboard;
- enter a global SRS review flow and rate eligible vocabulary with existing ratings.

### 3.2 ADMIN

An `ADMIN` retains existing System Set management behavior. V1 introduces no Admin Dashboard. ADMIN-authored public System Sets with a valid Set-level CEFR automatically participate in the required curriculum under the approved rule; no separate required flag is added.

Any future ADMIN warning or validation related to curriculum mutation must follow the selected mutation policies in Section 15 without introducing a curriculum-order UI or general Set-versioning system.

### 3.3 Guest

A Guest retains existing public discovery and public Set-detail visibility under existing authorization rules. A Guest cannot receive USER progression, recommendation, completion, or global-review data and cannot mutate any learner state.

### 3.4 Affected product surfaces

- authenticated USER Dashboard;
- public System Set discovery/detail and learner activity entry points;
- NORMAL Flashcard learning and bounded Learning Session lifecycle;
- CEFR learning-path read and authorization behavior;
- global SRS review entry and interaction;
- relevant backend read/mutation contracts and durable learner state;
- relevant database/API/UI documentation after later approved implementation.

## 4. Scope

### 4.1 In Scope

- CEFR levels `A1`, `A2`, `B1`, `B2`, and `C1` only.
- A1 initially available to every authenticated USER.
- Sequential unlocking: `A1 -> A2 -> B1 -> B2 -> C1`.
- C1 as the terminal V1 level.
- Required curriculum derived from public System Set status plus valid Set-level CEFR.
- Authoritative completion of one full NORMAL learning pass per required Set.
- Multi-batch full-Set completion while retaining the existing maximum of 10 items per backend Learning Session.
- Backend-authoritative CEFR progress and unlock projection.
- USER Dashboard next-required-Set recommendation.
- Minimal global SRS review using existing SRS eligibility, ordering, ratings, scheduling, and safety rules.
- Locked, empty, loading, error, retry, resumed, level-complete, and path-complete states.
- Preservation of existing ownership, visibility, Quiz, Speaking, XP/Level, Streak, and Daily Goal boundaries except for the selected backend-enforced activity restrictions on locked public CEFR Sets.

### 4.2 Explicit Non-Goals

- C2 Set support, C2 progression, or C2 schema/API/validation changes.
- A separate required/optional curriculum flag in V1.
- Memorization/mastery scoring or minimum Quiz score.
- A new SRS scheduler, FSRS/SM-2 replacement, adaptive algorithm, or client-side eligibility logic.
- Review history, learning analytics, trends, charts, accuracy, or activity timeline.
- Notifications, reminders, emails, or Daily Goal integration.
- New XP, Level, Streak, Daily Goal, Achievement, leaderboard, or ranking rules.
- AI recommendations or adaptive content selection.
- New roles or changes to USER/ADMIN role semantics.
- Public Personal Sets, Community sharing changes, or private Set progression.
- Cross-account, offline, or anonymous learner progression.
- Redesign of the global App Shell, Discovery, Quiz, Speaking, or Set management.
- Prescribing exact tables, columns, indexes, endpoint paths, or payloads before PLAN approval.

## 5. HUMAN-Selected Business Rules and Invariants

Rules in this section and the HD-01 through HD-18 directions in Section 15 are **HUMAN-APPROVED — 2026-11-03**. They define the approved business contract for PLAN authoring but do not authorize TASK or implementation.

- **BR-CLP-001:** Supported progression levels are exactly `A1`, `A2`, `B1`, `B2`, and `C1`.
- **BR-CLP-002:** The progression order is exactly `A1 -> A2 -> B1 -> B2 -> C1`.
- **BR-CLP-003:** A1 is initially available to every authenticated USER; C1 is terminal in V1.
- **BR-CLP-004:** Every public System Vocabulary Set with Set-level CEFR `A1`, `A2`, `B1`, `B2`, or `C1` is required for progression.
- **BR-CLP-005:** V1 adds no separate required flag.
- **BR-CLP-006:** Curriculum membership derives from both public System status and a valid Set-level CEFR. `is_public` continues to mean visibility only.
- **BR-CLP-007:** Public Sets with null Set-level CEFR are excluded from progression.
- **BR-CLP-008:** Personal, private, and copied Sets never count toward CEFR progression, even when their metadata contains CEFR.
- **BR-CLP-009:** Meaning-level CEFR never determines a Set's curriculum level or progression membership.
- **BR-CLP-010:** A required Set is not completed by opening its detail or learning route.
- **BR-CLP-011:** Required Set completion requires encountering/revealing every required Vocabulary item through NORMAL learning.
- **BR-CLP-012:** One bounded session cannot prove full-Set completion when the authoritative Set snapshot contains more than 10 items.
- **BR-CLP-013:** Backend evidence and backend acceptance are authoritative for Set completion and CEFR unlocking. Client storage and UI state are not authoritative.
- **BR-CLP-014:** Memorization, SRS rating, Quiz result/score, XP, Level, Streak, Daily Goal, and `LEARNING_PROGRESS.status` never determine Set completion or CEFR unlocking.
- **BR-CLP-015:** Existing private Set behavior, ownership, copy semantics, and visibility remain unchanged.
- **BR-CLP-016:** Global review reuses existing backend SRS eligibility, ratings, scheduling, event integrity, and time authority.
- **BR-CLP-017:** Global review has no effect on Set completion, CEFR completion, or unlocking.
- **BR-CLP-018:** Dashboard recommendation data is read-only and originates from authoritative learning-path state.
- **BR-CLP-019:** Existing private Set previews and Discovery Featured content must not be relabelled or inferred as recommendations.
- **BR-CLP-020:** Daily Goal V1 remains frozen/unmerged and is not a dependency or completion source for this feature.
- **BR-CLP-021:** Accepted historical Set completion is scoped to one USER and exact Set identity and is not erased by later item, visibility, deletion, or CEFR-classification changes.
- **BR-CLP-022:** Current curriculum membership and progress are evaluated from currently qualifying required Sets and their current CEFR classification; current counts do not revoke previously earned unlock entitlement.
- **BR-CLP-023:** A CEFR level once earned by a USER remains unlocked for that USER when the curriculum later changes.
- **BR-CLP-024:** The primary Dashboard path level is the USER's highest currently unlocked CEFR level. The primary next-Set recommendation may target eligible required study only within that level. Newly added incomplete Sets in earlier unlocked levels remain accessible current study content but do not move the primary recommendation backward.
- **BR-CLP-025:** Once terminal C1/path-complete entitlement is accepted, later curriculum changes do not revoke that achievement. Current curriculum counts and newly incomplete Sets must still be reported truthfully and must not be represented as all currently complete.

## 6. Required Curriculum and Level State

At one authoritative backend evaluation time, a Set belongs to the required V1 curriculum only when all of the following are true:

1. it is a public System Vocabulary Set under the existing Set contract;
2. its Set-level `cefr_level` is one of `A1`, `A2`, `B1`, `B2`, or `C1`; and
3. it is currently a valid Set record under existing visibility and lifecycle rules.

The backend must expose enough read information for the USER experience to distinguish:

- available current level;
- locked later levels;
- required Set count per level;
- completed required Set count per level;
- incomplete required Sets;
- next eligible required Set when one exists;
- level-complete state;
- terminal C1/path-complete state;
- configuration/legacy state that prevents a truthful conclusion.

Three related concepts must remain distinct:

1. **Accepted historical Set completion:** immutable learner-scoped credit that the USER completed the accepted full pass for that exact Set identity. It is never shared with another USER.
2. **Current curriculum progress:** current required and completed counts computed from Sets that presently qualify at their current CEFR classification. A currently qualifying Set counts as completed for the USER when that exact Set has accepted historical completion, including after CEFR reassignment.
3. **Previously earned CEFR unlock entitlement:** persistent learner-scoped access earned when the prior level satisfied its requirements. Later additions, deletion, reclassification, or count changes cannot relock an earned level.

Terminal path-complete entitlement is the C1 completion form of previously earned unlock entitlement. It remains accepted after later curriculum changes, while current curriculum progress may separately show newly incomplete required Sets. The product must not equate preserved entitlement with a claim that every current required Set remains complete.

For a USER who has not yet earned the next level, the current required curriculum remains authoritative: every currently required Set in the current level must have accepted completion. A level with zero required Sets or a required Set with zero Vocabulary items produces a curriculum-not-configured state and cannot trigger an unlock.

The frontend may display this projection but must not calculate authoritative unlocks by combining catalog responses, local completion state, Learning Progress rows, or remembered/reviewed counts.

## 7. Full-Set NORMAL Learning Pass

### 7.1 Qualification boundary

A qualifying Set pass concerns one authenticated USER, one required public Set, and an authoritative ordered snapshot of the Set's Vocabulary identities. It is a study-completion record, not mastery, correctness, or review history.

A qualifying pass must satisfy all of the following:

1. the Set is authorized for the USER under the locked-level policy in Sections 11 and 15;
2. the Set qualifies as required curriculum when the pass begins;
3. the backend establishes the exact ordered Vocabulary identity snapshot for the pass;
4. every snapshot item is presented through NORMAL learning in bounded sessions of at most 10 distinct items;
5. every snapshot item receives accepted durable NORMAL reveal evidence associated with the qualifying pass;
6. no missing, removed, foreign, duplicated, or client-invented item can satisfy the snapshot;
7. after all required bounded sessions are complete, the USER explicitly selects **Hoàn thành bộ từ** and the backend accepts final pass completion; and
8. an accepted completion is idempotent and cannot be credited twice through retry or concurrency.

### 7.2 Bounded sessions

- The existing backend maximum of 10 items per Learning Session remains unchanged.
- A Set with 1–10 items may require one bounded NORMAL session.
- A Set with more than 10 items requires multiple ordered bounded sessions.
- Every bounded session retains current owner, Set access, immutable item snapshot, evidence, expiry, conflict, and replay protections.
- Completion of a bounded session means only that its bounded group is complete unless it also satisfies the separately accepted full-pass completion contract.
- The backend must not infer full-Set completion merely because a session's `completed_items` equals its `snapshot_size`.
- The learning UI must show the authoritative number of snapshot items that remain unstudied and must not present final completion while required reveal evidence or bounded-session completion is missing.

### 7.3 Evidence and exclusions

Existing durable `NORMAL_REVEALED` evidence is the required item-level proof. Bounded NORMAL sessions belong to one backend-owned full-pass run for the learning journey. The later PLAN must determine the smallest compatible persistence design without weakening current Learning Session or Streak guarantees or adding general Set versioning.

The following never count as item or pass completion:

- opening a Set or learning URL;
- loading a card without reveal;
- moving the cursor or reaching the last card;
- playing pronunciation audio;
- revealing an item only in Speaking, Quiz, or SRS mode;
- answering a Quiz question;
- submitting any SRS rating;
- existing `LEARNING_PROGRESS`, XP reward, Streak, or Daily Goal records;
- client-only completion flags without accepted backend evidence.

### 7.4 Persistence boundary

Completion and unlocking must survive reload, logout/login, and later Dashboard reads. Therefore the authoritative result cannot live only in `sessionStorage` or component state.

This SPEC deliberately does not prescribe a new table or exact schema. PLAN must compare reuse/extension of existing Learning Session persistence with the minimum additional durable identity needed to prove a full pass, preserve replay safety, and avoid turning completion storage into a general analytics ledger.

### 7.5 Resume and active-snapshot mutation

- An incomplete full-pass run may be resumed using backend-authoritative run state; client storage cannot select or reconstruct the run.
- Dashboard recommendation prioritizes the USER's active incomplete qualifying pass within the highest currently unlocked CEFR level; active passes in earlier unlocked levels remain resumable from their own study surfaces but do not replace the primary recommendation.
- Session expiry, stale retry, and replay behavior continue to fail safely under existing bounded-session rules.
- The ordered Set snapshot is frozen for the active run. Newly added items do not silently enter it.
- If an item in the frozen snapshot is removed or becomes inaccessible, the run cannot receive silent completion credit. The backend must report that continuation is no longer valid and provide an explicit restart path using a new authoritative snapshot.

## 8. CEFR Progression and Unlocking

### 8.1 Level completion

A level is currently complete only when the USER has accepted historical completion for every Set that currently belongs to that level's required curriculum. A previously earned unlock remains valid even if later curriculum changes make the current completed count lower than the current required count.

No weighted percentage, minimum score, remembered-word threshold, review count, or partial Set count can substitute for complete required-Set coverage.

### 8.2 Sequential unlock

- A1 is initially available.
- A2 may unlock only after A1 is complete.
- B1 may unlock only after A2 is complete.
- B2 may unlock only after B1 is complete.
- C1 may unlock only after B2 is complete.
- Completing C1 produces the terminal V1 learning-path-complete state and unlocks no C2 level.
- A later level cannot be unlocked by directly completing or accessing one of its Sets out of sequence.
- Unlock entitlement is monotonic. Once earned, it cannot be revoked by adding, deleting, privatizing, reclassifying, or changing a required Set.
- A new required Set blocks a not-yet-earned next-level unlock until completed. If the next level was already earned, the new Set remains visible as incomplete current study content but does not relock access.
- Accepted terminal C1/path-complete entitlement is also monotonic. A later required Set remains visible as incomplete current study content without removing the earned achievement or falsely preserving an all-current-Sets-complete status.

### 8.3 Backend authority

Backend reads and activity-entry authorization must use the same authoritative progression rules. The UI may hide or disable actions for clarity, but frontend checks are not the security boundary.

Unlock evaluation must be scoped to the authenticated USER. A client cannot submit an unlocked level, completion count, required count, completion timestamp, or another USER's identity as authority.

## 9. Dashboard Next-Set Recommendation

The authenticated USER Dashboard adds one learning-path recommendation based on the authoritative CEFR projection. It does not change ADMIN's neutral Dashboard and is not shown to Guests.

The recommendation must:

- identify the USER's highest currently unlocked CEFR level as the primary path level;
- select only an eligible incomplete required public Set;
- prioritize an active incomplete qualifying pass at that primary recommendation level and provide its truthful resume action;
- otherwise select the earliest eligible incomplete required Set by authoritative `created_at`, then Set ID;
- update after authoritative pass or curriculum changes;
- keep newly added incomplete Sets and resumable passes in earlier unlocked levels accessible as current study content without forcing the primary recommendation backward;
- never infer recommendation from private Set order, Set timestamps in the browser, Learning Progress status, Discovery Featured selection, Quiz results, or SRS state.

Dashboard must preserve established section behavior:

- immediate page identity with independent data-backed loading;
- safe empty/completed/configuration states;
- section-scoped operational error and retry;
- successful existing sections remain usable when the learning-path or review source fails;
- duplicate pending retries are prevented;
- no Dashboard view or retry mutates learner progress.

Required success states are:

1. next required Set available;
2. current level complete and next level newly available;
3. terminal C1/path-complete entitlement with all current required Sets complete;
4. preserved terminal C1/path-complete entitlement with newly incomplete current study content reported truthfully;
5. no truthful primary recommendation because the highest unlocked level has no eligible incomplete Set, has zero required Sets, or contains an empty required Set; earlier-level incomplete study remains available separately.

## 10. Global Vocabulary Review

### 10.1 Reused SRS contract

Global review must reuse the existing backend-authoritative definitions of:

- eligible/due Vocabulary;
- accepted backend time;
- deterministic eligibility priority/order;
- maximum bounded review snapshot;
- `AGAIN`, `HARD`, `GOOD`, and `EASY`;
- `AGAIN` requeue behavior;
- schedule/status transition;
- revision and idempotent retry safety;
- resolved versus unresolved session items;
- up-to-date and nearest-future-review state where applicable.

No client may calculate due eligibility, schedule timestamps, rating outcomes, or completion.

### 10.2 Minimal interaction

- An authenticated USER may enter global review from Dashboard and an approved existing navigation surface if later UI design requires it.
- The backend selects at most 10 distinct eligible Vocabulary identities that are currently accessible, studied, due under existing SRS rules, and reachable through an unlocked public Set or USER-owned private Set.
- Vocabulary reachable only through locked public Sets, inaccessible content, and orphan-only Progress are excluded. Reachability through any unlocked public Set or authorized USER-owned private Set makes the exact Vocabulary identity eligible when all other SRS conditions hold.
- Exact Vocabulary IDs are deduplicated within the snapshot; distinct IDs remain distinct even when their spelling matches.
- The USER uses the existing SRS card and four-rating interaction.
- `AGAIN` remains unresolved and follows existing requeue behavior.
- `HARD`, `GOOD`, and `EASY` resolve the item for the current review snapshot.
- Resolving the fixed snapshot shows a truthful review-complete state.
- After completion, explicit **Ôn tiếp** requests a fresh backend eligibility evaluation; the queue never expands silently and the client cannot invent a remainder queue.
- No eligible vocabulary produces an up-to-date/empty state and, when supported by existing data, the nearest future review information.
- Dashboard may show an authoritative due summary/action but does not derive it from compatibility-only `NEEDS_REVIEW` text or client time.

### 10.3 Independence from progression

Global review cannot:

- complete a required Set;
- create a NORMAL full-pass item credit;
- unlock or relock a CEFR level;
- change curriculum membership;
- imply mastery or CEFR completion.

## 11. Locked-Level UX and Authorization

The system must present locked state truthfully and must enforce the HUMAN-selected permissions on the backend for every affected activity endpoint. At minimum:

- locked levels are distinguishable from available and completed levels without relying on color alone;
- the UI does not offer an action that the backend will reject without explanation;
- direct URL/API access cannot bypass the approved lock;
- missing, foreign, and locked-resource errors do not expose another USER's progression or private data;
- Guest, USER, and ADMIN behavior remains role-correct;
- unlocking changes only the affected USER's progression access.

Public discovery and public Set detail remain visible. Existing copy-to-private behavior remains available where already authorized. For an authenticated USER directly targeting a locked public CEFR Set, the backend must block NORMAL learning, Quiz, Speaking Practice, and per-Set SRS review. These CEFR restrictions do not apply to independently owned private/copied Sets, and a private copy never earns progression credit.

## 12. Empty, Error, Retry, and Legacy Scenarios

### 12.1 Empty and configuration states

The product must distinguish:

- no required Sets at a CEFR level;
- a required Set with zero Items;
- public legacy Set with null CEFR, which is excluded from progression;
- all required Sets complete at the current level;
- complete terminal C1 path;
- no currently eligible global review items;
- global review items scheduled for a future time;
- Dashboard source failure versus a valid empty/completed result.

No empty or error state may fabricate an unlock, recommendation, completion, review count, or future date.

### 12.2 Error and retry

- Reads fail safely without learner-state mutation.
- Failed reveal/batch/pass completion preserves retry identity and enough context for a safe retry under the approved session contract.
- Repeated completion requests are idempotent.
- Concurrent completion/unlock evaluation cannot create duplicate credit or contradictory level state.
- Stale Set membership, access loss, deletion, or CEFR change produces the explicit recoverable or terminal result defined by Sections 7.5, 14, and 15.
- Dashboard section retry does not discard other successful sections.
- Review retries preserve existing SRS revision/idempotency behavior.

### 12.3 Legacy data

- Existing `LEARNING_PROGRESS`, `review_count`, `LEARNED`, `LEARNING`, `NEEDS_REVIEW`, Quiz answers, XP rewards, Streak days, and Daily Goal data do not backfill Set completion.
- Existing completed bounded Learning Sessions do not automatically become full-Set completions unless a later HUMAN-approved migration/backfill policy explicitly authorizes it.
- No automatic completion backfill is part of V1.
- Public null-CEFR Sets remain readable under their existing contract but are excluded from progression.
- Existing private/copied Sets remain private and never become required curriculum.
- C2 Meaning metadata remains valid and unrelated to this V1 path.

## 13. Data and API Requirements at SPEC Level

### 13.1 Data requirements

The feature requires durable, owner-scoped evidence sufficient to represent:

- one USER's full-pass identity and lifecycle;
- the authoritative required-Set and ordered Vocabulary snapshot used by that pass;
- association of bounded NORMAL session evidence with that pass;
- one accepted full-Set completion without duplicate credit;
- current learning-path projection while preserving the mutation and monotonic-unlock rules in Sections 8 and 14.

The feature should reuse existing Set, Set Item, Learning Session, Session Item, and SRS persistence where correct. It must not use `LEARNING_PROGRESS` as Set-completion evidence or introduce a general learning-history/analytics ledger.

Exact schema, constraints, indexes, retention, and migration/backfill mechanics belong to PLAN after SPEC approval.

### 13.2 API requirements

At a high level, authenticated USER backend behavior must support:

- reading authoritative learning-path state and next recommendation;
- starting or restoring a qualifying NORMAL full pass;
- accepting bounded NORMAL reveal evidence through the existing safe boundary;
- accepting bounded-session completion and explicit full-pass completion under Sections 7 and 15;
- enforcing locked activity access consistently;
- reading a global review summary;
- starting/continuing a bounded global SRS review session using existing rating behavior.

The API must preserve existing envelopes and authentication/USER-role middleware, conceal inaccessible identities, strictly validate identifiers and fields, reject stale/incompatible operations safely, and expose no internal credentials or another USER's state.

Exact endpoint reuse/addition, methods, payloads, error codes, and response projections belong to PLAN and require separate approval.

## 14. Curriculum Mutation and Historical Completion

ADMIN Set changes alter current derived curriculum without rewriting accepted learner history:

- An active run uses its frozen ordered snapshot. Added items wait for a future run; a removed or inaccessible snapshot item invalidates continuation and requires an explicit restart rather than silent credit.
- Item additions or removals after accepted completion do not erase that learner's completion for the exact Set.
- A newly qualifying public Set enters current required counts. It blocks progression only for a USER who has not already earned the next-level unlock.
- A Set that is deleted, made private, or assigned null CEFR leaves current required counts and recommendations. Historical completion is retained without disclosing content that is no longer accessible.
- If a completed Set changes CEFR, its learner-scoped completion remains accepted for the same Set identity. The currently qualifying Set contributes as completed under its current CEFR classification; it must not be relearned merely because its CEFR changed.
- Previously earned unlock entitlement is never revoked. Current required/completed counts describe present curriculum progress, not whether already-earned access should be removed.
- Dashboard treats the highest currently unlocked CEFR level as the primary path level. At that level it first prioritizes a resumable active pass; otherwise it recommends the earliest eligible incomplete required Set by `created_at`, then Set ID. Incomplete Sets and resumable passes in earlier unlocked levels remain accessible but do not pull the primary recommendation backward.
- An accepted terminal C1/path-complete entitlement remains earned after curriculum mutation. Newly added required Sets remain visible as incomplete current study content and current counts must reflect them; the UI must not claim that all current required Sets are complete.

These policies require durable distinctions between historical Set completion, current curriculum projection, and earned unlock entitlement, but this SPEC does not prescribe their schema.

## 15. HUMAN-Selected Direction for HD-01 through HD-18

Every row below is **HUMAN-APPROVED — 2026-11-03**. The selected direction is part of the approved SPEC. This approval authorizes PLAN authoring only, not TASK or implementation.

| ID | Decision | Selected V1 policy | User-visible behavior | Compatibility / security implications |
|---|---|---|---|---|
| HD-01 | Full-pass identity | Require one backend-owned full-pass run whose ordered Set snapshot is completed through one or more bounded NORMAL sessions. | Learner resumes one named Set journey and finishes it once; unrelated visits do not combine silently. | Needs durable run association but avoids trusting client state or accidental cumulative credit. |
| HD-02 | Explicit final completion | Require explicit final **Hoàn thành bộ từ** after every snapshot item has accepted reveal evidence and every required bounded session is complete. | Remaining unstudied items are shown clearly; reaching/revealing the last card alone is insufficient. | Matches existing explicit bounded NORMAL completion and prevents navigation from crediting a pass. |
| HD-03 | Incomplete-run resume | Dashboard recommends resuming the latest active qualifying pass before a new Set; only one active pass per USER/Set. | **Tiếp tục học** returns to the next unresolved item/batch. | Backend must own resume state; stale/expired batches require safe reconciliation. |
| HD-04 | Items added/removed during an active pass | Freeze the pass snapshot; removed/inaccessible items block safe continuation and require an explicit restart, while newly added items enter only a new pass. Do not add general Set versioning. | Content does not change underneath an active run; a clear restart action appears when required content vanished. | Preserves immutable evidence and prevents clients presenting stale protected content. |
| HD-05 | Items changed after accepted Set completion | Preserve the accepted completion against its completed snapshot; later item edits do not revoke it. | A completed Set stays completed. | Avoids retroactive relocking; new content may be learned voluntarily but does not rewrite history. |
| HD-06 | New required Set added to an earlier level | Unlocks are monotonic. Before the next level is earned, the new Set is required; after it is earned, the Set remains accessible incomplete current study content without relocking or moving the primary recommendation backward from the highest unlocked level. | Learners never lose access already earned, while current counts still show the new requirement. | Requires separate current curriculum progress, primary recommendation state, and persistent unlock entitlement. |
| HD-07 | Zero required Sets in a level | Treat as curriculum configuration incomplete and block automatic progression beyond that level. | Dashboard explains that the path is not yet configured instead of auto-skipping a level. | Prevents accidental mass unlock from missing content; ADMIN/configuration observability may be needed later. |
| HD-08 | Required Set with zero Items | Treat as invalid progression configuration; do not mark it complete and do not unlock through it. | USER sees a safe unavailable message rather than an impossible empty learning pass. | Existing public reads may remain; learning-path backend must not fabricate completion. |
| HD-09 | Locked content permissions | Keep public discovery/detail and currently authorized copy-to-private behavior. Backend-block NORMAL, Quiz, Speaking, and per-Set SRS only when an authenticated USER directly targets a locked public Set. Do not lock owned private copies. | Learner can preview or copy what comes next, but cannot run activities against the locked public Set. | Private authorization remains unchanged; a copied Set never grants progression credit. |
| HD-10 | Next-Set ordering | Use the highest currently unlocked CEFR level as the primary path level. Within that level, resume an active pass first, then choose the earliest incomplete Set by authoritative `created_at`, then `id`. Do not fall back to an earlier unlocked level for the primary recommendation. | Stable forward-path recommendation without a new curriculum-order field; earlier incomplete study and resumable passes remain accessible separately. | Reuses existing deterministic data and preserves monotonic access; creation order becomes product order. |
| HD-11 | Global review source universe | Include currently accessible, studied, SRS-due Vocabulary reachable through unlocked public Sets or USER-owned private Sets; exclude inaccessible/orphan-only Progress. | One review entry covers due studied vocabulary without bypassing locks. | Requires backend access filtering; private content remains owner-scoped. |
| HD-12 | Duplicate Vocabulary in global review | Deduplicate by exact Vocabulary ID and show it once per bounded review snapshot. | The same word identity is not repeated merely because several Sets contain it. | Matches Set-independent `LEARNING_PROGRESS`; same spelling with different IDs remains distinct. |
| HD-13 | Review of locked-level vocabulary | If HD-09 blocks locked activities, exclude vocabulary reachable only through locked public Sets; retain it when also reachable through an unlocked/owned Set. | Global review never becomes a lock bypass. | Requires exact backend reachability checks at snapshot creation and safe handling after access changes. |
| HD-14 | Set deletion/private conversion/null CEFR after completion | Retain learner-scoped historical completion, remove the Set from current required counts/recommendation, never revoke an earned unlock, and disclose no inaccessible content. | Removed/reclassified content leaves the current path without erasing learner history. | Durable historical identity must not become a content-disclosure path. |
| HD-15 | Set CEFR change after completion | Accepted completion belongs to the USER and exact Set identity. At its new CEFR, that currently qualifying Set contributes as completed for the USER; no relearning is required and earned unlocks remain. | A moved completed Set remains completed while appearing under its current level classification. | Prevents contradictory requalification and requires separation of Set completion, current classification, and unlock entitlement. |
| HD-16 | Legacy Progress and sessions | No automatic completion backfill from historical Progress or bounded sessions. | Existing learners start the formal path at A1 with no fabricated completed Sets. | Safest evidence boundary; avoids false credit from modes that were never full-pass proof. |
| HD-17 | C1 terminal behavior | Once every current A1–C1 requirement needed for the learner's path has accepted completion, preserve the earned terminal path-complete entitlement and introduce no C2 action. Later required Sets remain visible as incomplete current study without revoking that entitlement. | Show **Đã hoàn thành lộ trình hiện tại** as an earned achievement while separately reporting any newly incomplete current curriculum; never claim all current Sets are complete when they are not. | Must not infer completion from pre-feature data; requires distinct earned entitlement and current counts; preserves C2 exclusion. |
| HD-18 | Global review continuation | After one bounded snapshot completes, require explicit **Ôn tiếp** and a fresh backend eligibility evaluation. | Review never expands silently while the learner is in a fixed session. | Preserves current SRS snapshot and newly-due behavior. |

## 16. User Flows

### 16.1 First-time USER

1. USER opens Dashboard.
2. Backend reports A1 available and later levels locked.
3. Dashboard shows the earliest eligible required A1 Set by authoritative `created_at`, then Set ID.
4. USER enters NORMAL learning and receives a backend-authorized full-pass snapshot divided into bounded sessions as needed.
5. Opening alone creates no completion.
6. USER reveals every item and completes every bounded group.
7. The UI shows no remaining unstudied items; USER explicitly selects **Hoàn thành bộ từ**, and the backend accepts the full pass once after verifying bounded-session completion.
8. Dashboard/progression read shows that Set complete and recommends the next incomplete A1 Set.
9. After all required A1 Sets complete, A2 becomes available.

### 16.2 Resume

1. USER leaves an incomplete qualifying pass.
2. Dashboard later receives authoritative active-pass state.
3. It displays a resume recommendation rather than inferring progress from local state.
4. USER resumes at the backend-authorized unresolved position/batch.
5. If frozen snapshot content was removed or became inaccessible, the backend rejects silent continuation and offers an explicit restart with a new snapshot; stored client IDs cannot bypass this result.

### 16.3 Global review

1. USER opens Dashboard and receives an authoritative review summary/action.
2. USER enters global review.
3. Backend selects at most 10 exact-ID-deduplicated, currently accessible, studied, due Vocabulary IDs reachable through unlocked public Sets or USER-owned private Sets.
4. USER reveals and submits existing SRS ratings.
5. Backend applies existing schedule, revision, replay, and session evidence behavior.
6. Resolving the fixed snapshot shows review complete.
7. Explicit **Ôn tiếp** performs a fresh eligibility evaluation.
8. None of these actions changes CEFR completion or unlock state.

### 16.4 Curriculum added after unlock or path completion

1. USER has already unlocked A2 or later; the highest earned level remains the primary Dashboard path level.
2. ADMIN adds a required Set to an earlier unlocked level.
3. Current counts show that earlier-level Set as incomplete, and the USER may open or resume it from that level's study surface.
4. The primary Dashboard recommendation does not move backward and no earned level is relocked.
5. If terminal C1/path-complete entitlement was already accepted, the achievement remains visible while current curriculum state separately reports the newly incomplete Set and does not claim all current Sets are complete.

## 17. Acceptance Criteria

### 17.1 Curriculum and progression

- **AC-CLP-001:** A1 is available to every authenticated USER, while A2, B1, B2, and C1 follow the exact sequential unlock order.
- **AC-CLP-002:** Required curriculum includes every and only public System Sets whose Set-level CEFR is A1–C1, subject to current valid-record rules.
- **AC-CLP-003:** Public null-CEFR Sets, private/personal/copied Sets, and Meaning-level CEFR do not contribute to required counts or completion.
- **AC-CLP-004:** C1 is terminal; no C2 Set validation, level, unlock, recommendation, or action is introduced.
- **AC-CLP-005:** A not-yet-earned level unlocks only from authoritative accepted completion of every currently required Set in its immediate predecessor level; once earned, the unlock is not revoked by later curriculum changes.
- **AC-CLP-006:** A direct client claim, local storage value, Quiz result, SRS event, Learning Progress row, XP, Streak, or Daily Goal record cannot unlock a level.
- **AC-CLP-006A:** Reads distinguish accepted historical Set completion, current curriculum required/completed counts, and previously earned unlock entitlement; current counts alone cannot relock an earned level.
- **AC-CLP-006B:** A level with zero required Sets or containing an empty required Set cannot automatically unlock the next level and produces a curriculum-not-configured state.

### 17.2 Full-Set pass

- **AC-CLP-007:** Opening or loading a required Set produces no Set completion.
- **AC-CLP-008:** A qualifying pass snapshots exact ordered current Set Vocabulary identities and presents them only through NORMAL learning.
- **AC-CLP-009:** Every snapshot item requires accepted durable NORMAL reveal evidence; evidence from Quiz, Speaking, or SRS cannot substitute.
- **AC-CLP-010:** A Set containing more than 10 items is completed across multiple backend sessions, each retaining the existing maximum of 10 distinct items.
- **AC-CLP-011:** Completing one bounded session does not mark a larger Set complete.
- **AC-CLP-012:** Full-pass acceptance verifies complete exact-ID reveal coverage, completion of every required bounded session, current USER ownership, authorized Set/run identity, compatible state, and explicit **Hoàn thành bộ từ** confirmation.
- **AC-CLP-013:** Exact completion retries return the accepted result without duplicate completion or unlock effects; incompatible/stale reuse fails safely.
- **AC-CLP-014:** Completion survives reload and later authenticated reads without relying on client-only state.
- **AC-CLP-014A:** An active pass resumes from backend-authoritative state, reports remaining unstudied items, and is prioritized over another recommendation in the current path.
- **AC-CLP-014B:** Active snapshots remain frozen; newly added items do not enter silently, while removed/inaccessible items require explicit restart and cannot be credited silently.

### 17.3 Dashboard

- **AC-CLP-015:** USER Dashboard shows at most one authoritative primary next-learning recommendation for the highest currently unlocked CEFR level, or one truthful empty/completed/configuration state for that primary level.
- **AC-CLP-016:** Within the highest unlocked level, recommendation first selects a valid active incomplete pass; otherwise it selects the earliest eligible incomplete required public Set by authoritative `created_at`, then Set ID. Incomplete study or active passes in earlier unlocked levels remain accessible separately and cannot replace the primary recommendation.
- **AC-CLP-017:** Existing private Set previews and Discovery Featured Sets retain their existing meaning and are not represented as recommendations.
- **AC-CLP-018:** ADMIN retains a neutral Dashboard and makes no USER learning-path/global-review request; Guest cannot access USER Dashboard data.
- **AC-CLP-019:** Learning-path and review sections preserve independent loading, safe error, scoped retry, stale-response protection, accessible focus/status, and successful-sibling-section behavior.
- **AC-CLP-020:** Dashboard reads and retries create no completion, review event, unlock, Progress, XP, Streak, or Daily Goal mutation.

### 17.4 Global review

- **AC-CLP-021:** Global review uses existing backend SRS eligibility and accepted time rather than client time or raw displayed status.
- **AC-CLP-022:** One global review snapshot contains at most 10 exact-ID-deduplicated, currently accessible, studied, due Vocabulary IDs reachable through unlocked public Sets or USER-owned private Sets; same spelling with distinct IDs remains distinct.
- **AC-CLP-023:** `AGAIN`, `HARD`, `GOOD`, and `EASY` retain existing schedule, requeue, revision, replay, XP, and session semantics.
- **AC-CLP-024:** Resolving a fixed snapshot never expands its queue; explicit **Ôn tiếp** requests a fresh backend eligibility evaluation.
- **AC-CLP-025:** No-eligible and future-review states are truthful and cause no scheduling mutation.
- **AC-CLP-026:** Global review never creates Set-pass evidence, completes a Set, unlocks/relocks a level, or changes recommendation except through independent refreshed reads.
- **AC-CLP-027:** Guest, ADMIN, foreign-user, inaccessible, and malformed global-review requests follow existing safe authentication, authorization, concealment, and validation conventions.

### 17.5 Compatibility and mutation

- **AC-CLP-028:** Existing public/private Set ownership, visibility, copy, ordered Item, and exact Vocabulary identity contracts remain intact.
- **AC-CLP-029:** Existing NORMAL bounded-session evidence, SRS scheduling, Quiz grading, Speaking privacy, XP/Level, and Streak behavior do not regress.
- **AC-CLP-030:** Daily Goal V1 receives no change and contributes no completion/unlock authority.
- **AC-CLP-031:** Item membership, visibility, deletion, or CEFR mutation follows Section 15 without exposing inaccessible content, erasing accepted Set completion, or revoking an earned unlock.
- **AC-CLP-032:** Historical Progress, rewards, streaks, bounded sessions, and client state receive no completion backfill unless separately approved.
- **AC-CLP-032A:** A completed Set reassigned to another CEFR level remains completed for that USER and contributes to current progress under its current classification without requiring relearning.
- **AC-CLP-032B:** An accepted terminal C1/path-complete entitlement remains earned after later curriculum additions, while current counts and newly incomplete Sets are reported truthfully without claiming that all current required Sets remain complete.
- **AC-CLP-033:** Public discovery/detail and currently authorized copying remain available, while backend boundaries block NORMAL, Quiz, Speaking, and per-Set SRS against locked public Sets; owned private/copied Sets retain existing authorization and never earn progression credit.
- **AC-CLP-034:** Relevant implementation verification, when later authorized, includes a Legacy/Regression Impact Scan across APIs, callers, fixtures, routes, selectors, documentation, and active tests.

## 18. Required Future Test Scenarios

This section defines testable requirements; no tests have been run for this draft.

- first USER state with A1 available and later levels locked;
- one-item, exactly-ten-item, and more-than-ten-item required Sets;
- opening only, reveal without bounded completion, partial batches, all batches, and final completion;
- duplicate/replayed/concurrent reveal, bounded completion, and full-pass completion;
- remaining-item display, explicit **Hoàn thành bộ từ**, active-run resume priority, session expiry, stale retry, and explicit restart after a frozen-snapshot item becomes unavailable;
- cross-user, Guest, ADMIN, private Set, copied Set, null-CEFR Set, wrong-level Set, and direct URL/API access;
- exact-ID coverage, same-spelling/different-ID vocabulary, removed/reordered/added items, deleted/private/null-CEFR Set, and CEFR reassignment without relearning an already completed Set;
- zero required Sets, empty required Set, all Sets complete, and terminal C1;
- new required Set before versus after the next-level unlock, current count changes, and proof that previously earned access remains unlocked;
- new earlier-level required Set after A2-or-later unlock, proof that primary recommendation stays at the highest unlocked level, and separate access/resume for the earlier incomplete Set;
- new required Set after accepted terminal C1/path completion, preserved earned achievement, truthful current incomplete counts, and no false all-current-Sets-complete message;
- Dashboard first load, independent failures, retry, resume recommendation, next Set, level transition, terminal completion, and configuration error;
- global review zero/fewer-than-10/exactly-10/more-than-10 eligible items;
- global duplicate exact IDs, same spelling/different IDs, inaccessible/orphaned Progress, locked-only reachability, unlocked public reachability, and USER-owned private reachability;
- all four SRS ratings, `AGAIN` requeue, retry/revision conflict, fresh continuation, future-due boundary, and concurrent eligibility changes;
- proof that Quiz score, Speaking, SRS, remembered state, Progress status, XP, Streak, and Daily Goal never affect unlock;
- preservation of Set ownership/copy, per-Set SRS, Quiz grading, Speaking non-persistence, XP rewards, Streak qualification, Dashboard existing sections, and ADMIN neutral behavior;
- static and guarded migration/authorization/real-stack verification only in later approved isolated environments.

## 19. Compatibility and Impact

### 19.1 Learning Session

- Reuse bounded immutable snapshots, owner scoping, `NORMAL_REVEALED`, completion, expiry, conflict, and replay protections.
- Preserve the maximum of 10 items per backend session.
- Add no assumption that one bounded completion equals full-Set completion.
- Do not turn sessions into general analytics/history.

### 19.2 Vocabulary Set

- Preserve `is_public` as visibility.
- Derive V1 curriculum membership from public System status plus Set-level A1–C1.
- Preserve private ownership and copy behavior.
- Add no C2 or required flag.

### 19.3 SRS and Learning Progress

- Reuse existing scheduler and rating semantics.
- Keep Learning Progress Set-independent.
- Do not derive Set completion from Progress status, count, or schedule.
- Global review must not become a second scheduler.

### 19.4 Dashboard and UI/UX

- Extend Dashboard as a read-only consumer of authoritative domains.
- Preserve existing independent section loading/error/retry and ADMIN behavior.
- Keep private previews and Featured discovery semantics unchanged.
- A later UI-changing implementation requires a Focused UI/UX Review before HUMAN visual approval, separate from TEST and formal REVIEW.

### 19.5 API and database

- Existing contracts remain active until separately approved implementation changes them.
- Any new durable full-pass or read behavior requires synchronized DATABASE/API/ARCHITECTURE/UI documentation in later stages.
- Existing migrations remain immutable; any approved persistence change requires a forward-only migration and guarded isolated verification.
- No Main, Preview, Production, shared development, or protected Daily Goal database/worktree may be used for feature testing.

## 20. Risks

- Mutable public Sets can make current curriculum counts differ from historical completion and unlock entitlement; implementations must preserve all three concepts rather than deriving earned access from current counts alone.
- Treating a bounded session as a full pass would incorrectly complete Sets larger than 10 items.
- Treating Learning Progress/SRS/Quiz data as completion would violate the lecturer rule.
- Frontend-derived unlocks could be bypassed by direct API access.
- Global review could disclose private or locked content without backend access filtering.
- Incorrectly recomputing unlock entitlement from current counts could revoke earned access; monotonic unlocks are required.
- Creation-time next-Set ordering may not reflect intended pedagogy.
- Combining historical bounded sessions could fabricate a coherent pass that never occurred.
- Overextending persistence could create an unnecessary learning analytics/history product.
- Daily Goal and other active branch work may later overlap schema/session integration; no dependency or merge assumption is authorized here.

## 21. HUMAN Review Checklist

Final HUMAN review confirmed:

- [x] HUMAN-approved rules BR-CLP-001 through BR-CLP-025 are represented correctly.
- [x] A1–C1 only and C2 exclusion are correct.
- [x] All valid-CEFR public System Sets are required without a separate flag.
- [x] NORMAL reveal/full-pass semantics match the lecturer requirement.
- [x] HD-01 through HD-18 selected directions are incorporated correctly.
- [x] Locked visibility and activity permissions are explicit.
- [x] Curriculum mutation and monotonic-unlock behavior are explicit.
- [x] Primary recommendation remains at the highest unlocked CEFR level; earlier incomplete study stays accessible without pulling it backward.
- [x] Terminal path-complete entitlement is preserved separately from truthful current curriculum counts.
- [x] Next-Set ordering and resume priority within the primary level are explicit.
- [x] Global review universe, deduplication, and locked-content behavior are explicit.
- [x] Legacy/no-backfill and terminal C1 behavior are explicit.
- [x] Scope remains proportional and introduces no analytics, notification, adaptive, AI, or gamification expansion.

## 22. SPEC Approval Record and Next Gate

The HUMAN explicitly approved this final SPEC in the conversation on 2026-11-03, including HD-01 through HD-18. PLAN authoring is authorized. TASK authoring and implementation remain unauthorized until the PLAN receives separate HUMAN approval and the repository workflow advances through its later gates.

```text
CEFR LEARNING PATH V1 FEATURE STATUS: CHANGE REQUEST / NEW FEATURE — SPEC APPROVED
SPEC STATUS: APPROVED
HUMAN SPEC APPROVAL: GRANTED — 2026-11-03
PLAN AUTHORIZED: YES — PLAN AUTHORING ONLY
TASK AUTHORIZED: NO
IMPLEMENTATION AUTHORIZED: NO
NEXT ALLOWED ACTION: Author and submit the technical PLAN for HUMAN review
```
