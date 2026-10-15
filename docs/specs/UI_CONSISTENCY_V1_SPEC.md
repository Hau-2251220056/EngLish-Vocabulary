# SPEC: UI Consistency V1

Status: HUMAN APPROVED

## Objective

Provide one shared React-Toastify notification experience for approved vocabulary mutations and add client-side pagination to Personal Vocabulary Set Detail consistent with Public Set Detail.

## Scope

In scope:

- One application-level toast container with ELVocab styling, accessible announcements, visible auto-dismiss progress, responsive placement, deduplication, and appropriate success/error/warning durations.
- Toast feedback after confirmed public-word add, personal membership add/remove, and explicit private-vocabulary create/update actions.
- Client-side pagination of ordered Personal Set items using the existing page size and pagination convention.
- Page clamping after mutations, including moving to the previous valid page after removing the last row on the final page.
- A compact two-column mobile learning-card layout on Personal Set Detail, preserving card order with Speaking in the lower-left cell.
- A distinct shared teal accent for the Speaking learning card across supported viewports.
- Mocked unit/browser coverage and Focused UI/UX review.

Out of scope:

- Backend, API, schema, authentication, authorization, ordering, Learning Progress, Quiz, SRS, XP, Streak, Speaking, or navigation changes.
- Toasts for reads, ordinary navigation, Quiz answers, or cancelled actions.
- Replacing required destructive confirmation dialogs or field-level validation.

## Rules and acceptance

- USER-only mutation permissions remain backend-authoritative and unchanged.
- Success appears only after API confirmation; failures never emit success.
- Duplicate or permission failures use safe, actionable feedback without exposing internals.
- Equivalent inline global mutation feedback is removed where a toast replaces it; field/form errors remain inline.
- Personal rows retain Set Item order and exact Vocabulary identity.
- Pagination uses 10 items per page, exposes current/total context, and has keyboard-visible, disabled-aware controls with 44px touch targets.
- Adding preserves the current page when still valid; removing clamps to a valid page.
- Empty, one-page, multi-page, and exact-boundary Sets remain correct with no page-level horizontal overflow.
- At 480px and below, Personal Set learning cards use two columns, compact equal-height cards, and hidden secondary descriptions; wider layouts retain the approved existing grid.
- Speaking uses the approved teal border, icon, and icon-background tokens without changing Flashcard or Quiz styling.
- No data model, API contract, or database operation is required.

## Open questions

None.
