# ELVocab USER UI Polish Brief

## Purpose and boundary

This brief records the HUMAN-approved visual direction for a later USER-facing UI polish pass. It does not change backend, API, database, authorization, identity, membership, Learning, or Quiz contracts. ADMIN, Public/System Set Detail, and feature-status closure remain outside this brief.

## 1. Visual direction

The USER experience should feel clean, educational, modern, mildly playful, and friendly—softer and less industrial, AI-like, or admin-dashboard-like. Retain ELVocab blue/indigo as the brand anchor and introduce harmonious light periwinkle, lavender, blue, and subtle teal supporting tints. Prefer warm/light surfaces, soft borders, restrained shadows, and rounded shapes. Avoid glassmorphism, heavy gradients, neon treatments, and enterprise-analytics styling.

## 2. USER sidebar

Redesign only the USER sidebar as a floating card-style panel with approximately 16–24px outer viewport margins, a rounded container, subtle border/shadow, softer spacing, clearer active and hover states, and a friendlier account/profile block. Preserve responsive mobile/tablet drawer behavior. ADMIN UI is unchanged.

## 3. Personal Set Detail header

The top area contains only:

- `← Bộ từ của tôi`
- Set name

Remove the Set description, standalone vocabulary count, Set-level Edit/Delete actions, tall metadata spacing, and unnecessary divider from this area. Learning cards follow immediately after the Set name.

## 4. Learning modes

Render compact rectangular tiles that do not stretch across the full content width. Center the icon above the title; include a short description only when it remains compact. The entire enabled tile is clickable.

Current modes only:

- `Thẻ ghi nhớ` / Flashcard
- Quiz

The layout may accommodate a future Pronunciation tile, but no future feature or placeholder is rendered now. Hover uses a card-specific border tint, subtle surface/shadow/lift, pointer cursor, and a 150–200ms transition. Empty-Set tiles remain disabled with the approved guidance.

## 5. Vocabulary section

Use `Từ vựng trong bộ (N)` as the section title, moving the authoritative count into it. Place `+ Thêm từ vựng` on the right on desktop; stack responsively on mobile when needed.

## 6. Desktop vocabulary table

Columns, in order:

1. Từ vựng
2. Phiên âm
3. Từ loại
4. Nghĩa
5. Ví dụ
6. Thao tác

Use compact readable rows, subtle borders, secondary styling for example text, and a centered action column. Do not render audio/speaker controls. The action cell contains only a ≥44px kebab trigger, and its menu must not clip.

Menu rules:

- Canonical Vocabulary: `Gỡ khỏi bộ`
- Owner-private Vocabulary: `Chỉnh sửa`, `Gỡ khỏi bộ`

## 7. Mobile vocabulary table

Keep semantic table/row presentation rather than cards. Show exactly:

- Từ vựng
- Nghĩa
- Thao tác

Hide Phiên âm, Từ loại, and Ví dụ. Retain the compact kebab trigger and prevent horizontal overflow.

## 8. My Sets management

Each My Sets card has one primary `Xem` CTA, opening the Set Detail learning hub, and one compact `⋯` menu. Do not restore `Chi tiết`.

The menu contains:

- `Chỉnh sửa`—reuse the existing metadata-only modal with name and description; no Topic or membership controls.
- `Xóa bộ từ`—open an accessible confirmation with clear destructive copy, Cancel, and destructive confirmation while preserving pending, safe-error, and focus-restoration behavior.

## 9. Add Vocabulary modal

Desktop uses a centered, balanced-width dialog. Mobile uses near-full width with safe margins and clearer vertical spacing. At both sizes, place the search input and an icon-only magnifying-glass button in one row.

Mobile content order:

1. Search row
2. Results
3. `Tạo từ mới`
4. `Hủy`

Preserve the single-dialog step workflow, focus lifecycle, `aria-busy`, duplicate-submit protection, and pending dismissal rules.

## 10. Private Vocabulary form/editor

Use a centered, constrained-width modal with internal scrolling when tall and balanced spacing. Render `Loại từ` as a proper select/dropdown using the already approved options and unchanged data contract. Preserve create/edit, pending, errors, values, and focus behavior.

## 11. Button system

- Primary: filled ELVocab brand color.
- Secondary: light/bordered.
- Neutral cancel: gray/light bordered, never red.
- Destructive: explicit red semantics.

Apply consistently to Học, Thêm từ vựng, Lưu thay đổi, Hủy, Xóa, Gỡ, menu items, and icon buttons.

## 12. Interactive affordances

USER-facing controls use pointer cursors, meaningful hover, clear `:focus-visible`, appropriate active states, and approximately 150–200ms transitions. Disabled controls must not animate as active controls.

- Primary hover: slightly stronger/darker.
- Secondary hover: light tint and/or stronger border.
- Destructive hover: soft red tint with darker emphasis.

## 13. Shared kebab-menu pattern

Use one consistent rounded menu pattern for My Sets cards and Vocabulary rows: subtle shadow, comfortable spacing, distinct destructive items, meaningful hover/focus-visible states, Escape and outside-click dismissal, reliable focus restoration, and no clipping.

## 14. Preserved contracts and non-goals

Do not change backend/API/schema/migrations, exact `vocabulary_id` identity, canonical/private rules, picker privacy, membership-only removal, Learning Progress preservation, full-list PATCH V1 semantics, Flashcard/Quiz routes, return hierarchy, accessibility/focus fixes, or empty-Set behavior.

Do not implement Pronunciation/Luyện nói, audio controls, XP/Streak/Daily Goal, SRS, reorder/drag-drop, granular membership APIs, optimistic concurrency, Public/System Set Detail redesign, or Topic in Personal Set Create/Edit.

## 15. Intended Set Detail composition

```text
← Bộ từ của tôi

Du lịch

[ Thẻ ghi nhớ ] [ Quiz ]

Từ vựng trong bộ (3)                 + Thêm từ vựng

| Từ vựng | Phiên âm | Từ loại | Nghĩa | Ví dụ | Thao tác |
```

## 16. Later implementation verification

The implementation pass must verify desktop/tablet/mobile layouts; USER sidebar responsiveness; hover, focus, active, and disabled states; My Sets card menus; compact Set Detail header and learning tiles; table columns/actions; Add Vocabulary desktop/mobile composition; private editor and part-of-speech select; no clipping or horizontal overflow; absence of audio, reorder, and future placeholders; and preservation of existing accessibility and business contracts.
