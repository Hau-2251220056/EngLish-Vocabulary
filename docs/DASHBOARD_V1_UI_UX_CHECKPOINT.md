# Dashboard V1 — UI/UX Design Checkpoint

**Source SPEC:** `docs/specs/DASHBOARD_V1_SPEC.md` (HUMAN APPROVED)

**Source PLAN:** `docs/plans/DASHBOARD_V1_PLAN.md` (HUMAN APPROVED)

**Source TASK:** `docs/tasks/DASHBOARD_V1_TASK.md` (HUMAN APPROVED)

**Checkpoint status:** `HUMAN APPROVED`

**Production UI authorized:** `TASK-076 ONLY`

## 1. Design Intent

Dashboard V1 is a calm, useful landing overview for an authenticated learner. It answers only:

1. Who is signed in?
2. How many persisted Vocabulary records have been started, are Learning, or are Learned?
3. Which private Vocabulary Sets does the learner own, and which of the first three can be learned now?
4. Where can the learner go next using already implemented features?

It is not an analytics screen, detailed progress list, review queue or gamification surface. It uses real current-session data only and makes no claim about recent activity, completion percentage, recommendation or due review.

The page remains inside the existing `AuthenticatedShell`. Header, Sidebar, Main Content scrolling, Footer and mobile drawer remain unchanged.

## 2. USER Page Structure

```text
Authenticated Header
┌──────────────────────────────────────────────────────────────┐
│ Page introduction                                            │
│ Dashboard                                                    │
│ Xin chào, {display_name}                                     │
│ Tổng quan ngắn về hành trình học từ vựng hiện tại.           │
├──────────────────────────────────────────────────────────────┤
│ Tiến độ học tập                                              │
│ [ Tổng đã bắt đầu ] [ Đang học ] [ Đã thuộc ]               │
├──────────────────────────────────────────────────────────────┤
│ Bộ từ riêng của bạn                      {N} bộ từ | Xem tất cả│
│ [ Set preview ] [ Set preview ] [ Set preview ]              │
├──────────────────────────────────────────────────────────────┤
│ Khám phá và quản lý                                          │
│ [ Chủ đề ] [ Bộ từ của tôi ] [ Tiến độ chi tiết ]           │
└──────────────────────────────────────────────────────────────┘
Authenticated Footer
```

The order is stable across breakpoints: introduction, learning snapshot, private Sets, then quick navigation. Responsive layouts reflow these regions rather than changing their meaning or order.

## 3. Page Introduction

- A small eyebrow reads **Dashboard**.
- The single page `h1` reads **Xin chào, {display_name}**.
- A short subtitle reads **Tổng quan ngắn về hành trình học từ vựng hiện tại của bạn.**
- The full authenticated display name remains in the accessible text. Long names wrap naturally on mobile and may use a sensible two-line visual clamp on wider layouts without changing the accessible name.
- No time-of-day greeting is used, avoiding inconsistent client time behavior.

This header is visible immediately and does not wait for either data source.

## 4. Persisted Learning Snapshot

### 4.1 Content

The section heading is **Tiến độ học tập** with an existing-route text link **Xem tiến độ chi tiết** to `/my/learning-progress`.

It contains exactly three equal-priority summary cards:

1. **Tổng đã bắt đầu** — `summary.total_started`.
2. **Đang học** — `summary.learning`.
3. **Đã thuộc** — `summary.learned`.

Each card contains a compact existing Lucide-style icon, a text label, the numeric value and the unit **từ vựng**. Color supports scanning but labels carry the full meaning:

- Total started: ELVocab primary blue.
- Learning: restrained amber.
- Learned: restrained green.

The cards contain no progress ring, progress bar, denominator or percentage. `NEEDS_REVIEW` is not rendered, subtracted, renamed or turned into a queue/action. It is valid for total started to exceed Learning plus Learned.

### 4.2 First-Use State

When `total_started` is zero:

- all three truthful persisted values remain `0`;
- a compact explanatory panel below them says **Bạn chưa bắt đầu học từ vựng nào. Hãy khám phá chủ đề hoặc bộ từ của bạn để bắt đầu.**;
- the existing quick-navigation region remains available;
- no conceptual `NEW` total or fake illustration statistic is introduced.

## 5. Private Vocabulary Sets

### 5.1 Section Header

- `h2`: **Bộ từ riêng của bạn**.
- Supporting text/count: **{N} bộ từ** using the exact returned array length.
- Existing-route link: **Xem tất cả** to `/my/vocabulary-sets`.

### 5.2 Preview Limit and Order

- Render at most the first three Sets from the existing deterministic API order.
- Do not client-sort by `created_at`, `updated_at`, name or Item count.
- Do not label the cards recent, recommended, active or in progress.

### 5.3 Preview Card Anatomy

Each card/row contains:

- Set name as `h3` with safe wrapping;
- optional description, visually limited to two lines while retaining full DOM text;
- real Item count: **{item_count} từ vựng**;
- secondary **Xem bộ từ** link to `/my/vocabulary-sets/:setId`;
- primary **Học bộ từ** link to `/learn/vocabulary-sets/:setId` only when `item_count > 0`.

For an empty Set, retain **Xem bộ từ**, display **0 từ vựng**, and omit the Learn action entirely. Do not render a disabled Learn control that implies the action is otherwise available.

### 5.4 No-Sets State

When the exact total is zero, replace the preview collection with a restrained empty panel:

- heading: **Bạn chưa có bộ từ riêng**;
- description: **Các bộ từ bạn tạo hoặc sao chép sẽ xuất hiện tại đây.**;
- no fake preview card;
- the existing **Xem tất cả**/My Sets navigation and quick links remain available.

## 6. Quick Navigation

The final USER section is **Khám phá và quản lý**, rendered as three compact link tiles:

1. **Khám phá chủ đề** → `/topics`.
2. **Bộ từ của tôi** → `/my/vocabulary-sets`.
3. **Tiến độ chi tiết** → `/my/learning-progress`.

Each tile uses an existing icon family, a clear title and one short descriptive line. The entire visible tile may be the native link target. No tile points to Quiz, review queue, Pronunciation, Profile, Dashboard analytics or an unimplemented route.

## 7. Independent Runtime States

The page introduction and quick navigation render immediately. Progress and My Sets remain separate semantic sections with separate state lifecycles.

### 7.1 Initial Loading

- Progress displays three fixed-height skeleton cards plus one polite status: **Đang tải tóm tắt học tập…**.
- My Sets displays up to three fixed-height skeleton previews plus one polite status: **Đang tải bộ từ riêng…**.
- Empty-state copy is not rendered until the corresponding request succeeds.
- Skeleton geometry approximates final content to reduce layout shift; shimmer is non-essential and disabled under reduced motion.

### 7.2 Partial Success / Partial Error

If only one request fails:

- the successful section renders normally and remains usable;
- only the failed section becomes a compact inline error panel;
- the page does not become a full-screen error;
- quick navigation remains usable.

Progress error copy: **Không thể tải tóm tắt học tập. Vui lòng thử lại.**

My Sets error copy: **Không thể tải bộ từ riêng. Vui lòng thử lại.**

Each failed section exposes its own **Thử lại** button. Retry affects only that source, communicates pending state, and prevents duplicate activation. The other section does not reload or lose successful data.

### 7.3 Retry Focus

- Activating Retry keeps focus predictable within that section.
- While pending, the Retry control is disabled or replaced by a status in the same stable region.
- On success, focus moves to the section heading only when necessary to announce the changed result; otherwise the live region announces completion without forcing unexpected focus.
- On repeated failure, focus returns to the available Retry button after the alert updates.

Exact focus movement will be verified in TASK-077 and may choose the least disruptive of heading focus or retained retry focus, provided keyboard users are never stranded.

## 8. ADMIN `/dashboard`

Authenticated ADMIN receives a neutral landing inside the unchanged `AuthenticatedShell`:

- eyebrow: **Dashboard**;
- `h1`: **Xin chào, {display_name}**;
- one neutral panel: **Chọn một khu vực quản lý từ thanh điều hướng để bắt đầu.**;
- no USER learning cards, Set previews, USER quick-navigation tiles or fake Admin statistics;
- no request to `/api/learning/progress` or `/api/my/vocabulary-sets`.

Existing ADMIN Sidebar navigation remains the only management navigation. This checkpoint does not design an Admin Dashboard.

## 9. Responsive Behavior

### 9.1 Desktop (`> 1024px` content availability)

- Main content uses the existing scroll region and a centered maximum width around `1120–1200px`.
- Introduction is compact and left aligned.
- Three learning summary cards occupy one equal-width row.
- Up to three Set previews occupy one equal-width row.
- Three quick links occupy one equal-width row.
- Section spacing is approximately `28–32px`; card gaps approximately `16–20px`.
- The page may scroll within existing Main Content when necessary; Sidebar remains stable under the completed App Layout contract.

### 9.2 Tablet (`641–1024px`)

- Content keeps comfortable `24px` side padding when available.
- Summary cards remain three columns when each can preserve readable labels; otherwise they use a two-column grid with the last card spanning or occupying the next row without compression.
- Set previews and quick links use two columns; the third item flows naturally to the next row.
- The existing off-canvas/drawer shell behavior remains authoritative around the current `900px` shell breakpoint.

### 9.3 Mobile (`≤ 640px`)

- Content padding reduces to approximately `16px`.
- Greeting wraps without horizontal overflow.
- Summary cards stack as one column or use a readable compact single-column list; values remain prominent and labels never truncate critically.
- Set previews and quick links stack one per row.
- Card actions wrap safely; each interactive target remains at least `44px` high where appropriate.
- Section header links wrap below headings when needed rather than squeezing text.
- No desktop grid is scaled down and no horizontal scrolling is introduced.

## 10. Component Hierarchy

The production implementation should remain feature-scoped and proportional:

```text
DashboardPage
├── DashboardUserView
│   ├── DashboardIntroduction
│   ├── LearningSnapshotSection
│   │   ├── DashboardSectionState
│   │   └── LearningSummaryCard × 3
│   ├── PrivateSetsSection
│   │   ├── DashboardSectionState
│   │   └── PrivateSetPreview × 0..3
│   └── DashboardQuickLinks
└── DashboardAdminLanding
```

Small components may remain local to the Dashboard module. Do not create a generic application-wide card/state framework solely for this page. TASK-074 request/state logic remains authoritative and should be preserved rather than rewritten for presentation.

## 11. Accessibility and Interaction Contract

- Exactly one page `h1`; every data region has an `h2` associated with its section through `aria-labelledby`.
- Learning values use a semantic `dl`; Set previews use a semantic `ul`.
- Native links and buttons preserve visible `:focus-visible` treatment and logical DOM order matching visual order.
- Loading uses one polite `role="status"` per active source; errors use scoped `role="alert"` without announcing raw API details.
- Section containers expose `aria-busy` while their request is pending.
- Count/status meaning never depends on color, icons, hover or motion.
- Long names/descriptions do not obscure controls or accessible names.
- Empty Sets omit Learn rather than exposing a misleading disabled action.
- Stale/unmounted requests never update the current page.
- Retry and navigation remain keyboard operable; no custom keyboard shortcut is introduced.
- Optional hover/elevation transitions are subtle and disabled or near-instant under `prefers-reduced-motion: reduce`.

## 12. Visual Direction

- Continue the current ELVocab light interface: pale neutral page background, white surfaces, soft slate borders and restrained shadows.
- Primary interaction color uses existing ELVocab indigo/blue (`#3B5BDB` or the established equivalent token).
- Use current project typography and weight hierarchy; do not add a font or dependency.
- Cards use the existing rounded language (`12–16px` radius) without excessive decoration.
- Summary cards may use very light blue/amber/green tinted icon surfaces, but numeric data remains high-contrast near-black.
- Quick links and actions use consistent primary/secondary treatment already present in the application.
- Avoid charts, circular progress, gradients implying completion, celebratory gamification, oversized hero art and decorative fake data.

## 13. Explicitly Deferred

- Global, Topic or Set completion percentage.
- Conceptual `NEW` and eligible Vocabulary universe.
- `NEEDS_REVIEW` display, review queue, due count or SRS action.
- Continue Learning, recent activity, recent/recommended Set ordering or recency persistence.
- XP, Level, Streak, Daily Goal and achievements.
- Quiz or Pronunciation results.
- Charts, trends, analytics and history.
- Admin Dashboard/statistics.
- New API, schema, migration, global state or UI dependency.

## 14. HUMAN Review Decision

No unresolved functional decision blocks implementation. HUMAN approval is requested for this presentation baseline as one package:

1. personalized `h1` greeting with a small Dashboard eyebrow;
2. three snapshot cards in the order Total Started → Learning → Learned;
3. maximum-three Set card grid/list with conditional Learn action;
4. three quick-navigation tiles after the Set section;
5. section-level skeleton/error/retry treatment;
6. neutral ADMIN greeting/panel without USER data;
7. the stated desktop/tablet/mobile reflow and ELVocab visual direction.

If HUMAN review changes only visual composition within the approved data/actions, update this checkpoint before TASK-076. Any request for new data, semantics, route, API or business behavior must return to SPEC/PLAN review.

## Approval Gate

```text
TASK-075 STATUS: COMPLETE — HUMAN UI/UX APPROVED
PRODUCTION DASHBOARD UI: AUTHORIZED FOR TASK-076 ONLY
TASK-076: COMPLETE — HUMAN APPROVED
TASK-077: COMPLETE — HUMAN APPROVED
TASK-078: COMPLETE — HUMAN APPROVED
TASK-079: COMPLETE — HUMAN APPROVED / FORMAL TEST PASS / FORMAL REVIEW APPROVE
TASK-073 THROUGH TASK-079: COMPLETE — HUMAN APPROVED
USER DASHBOARD STATUS: DONE
FEATURE CLOSURE AUTHORIZED: YES
NEXT ALLOWED STAGE: FEATURE COMMIT, THEN SEPARATE PUSH/INTEGRATION REVIEW
```
