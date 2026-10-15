# TASKS: UI Consistency V1

Status: IN_PROGRESS

## TASK-001 — Shared notification infrastructure

- Add React-Toastify and one root container.
- Add a minimal adapter for success, error, and warning notifications with dedupe IDs and suitable durations.
- Align responsive styling, focus, close controls, progress bars, and reduced motion with ELVocab.
- Verify adapter behavior, accessibility surface, and build integration.

## TASK-002 — Approved vocabulary notifications

Depends on TASK-001.

- Notify after confirmed public canonical-word addition.
- Notify after confirmed Personal Set membership add/remove and private-vocabulary create/update.
- Notify relevant safe failures without duplicating form errors that must remain visible for correction.
- Preserve pending guards, duplicate handling, confirmation dialogs, identity, ordering, and Progress behavior.

## TASK-003 — Personal Set Detail pagination

- Reuse the existing 10-item pagination helper and Public Set control convention.
- Render only the active Personal Set page while keeping counts based on the full aggregate.
- Preserve current page after additions when valid and clamp after removals or refreshes.
- Cover empty, one-page, multiple-page, exact-boundary, and last-row removal behavior.

## TASK-004 — Personal Set learning-card consistency

- Use a compact two-column grid at narrow mobile widths while preserving Flashcard, Quiz, Speaking order.
- Keep Speaking in the lower-left cell and preserve the approved wider layouts.
- Apply the shared teal Speaking accent without altering Flashcard, Quiz, navigation, or learning behavior.
- Cover representative mobile/desktop widths, card height, alignment, focus, cursor, and overflow.

## TASK-005 — Verification and Focused UI/UX review

Depends on TASK-001 through TASK-003.

- Run frontend units, focused mocked Playwright, ESLint, production build, and `git diff --check`.
- Review 320, 375, 768, 1024, and 1440px plus narrow/landscape cases.
- Verify keyboard flow, announcements, pointer/disabled cursors, 44px targets, progress visibility, toast stacking/dismissal, pagination controls, and no page overflow.
- Capture review screenshots and report guarded-CI-only risks.

No task may modify backend code, API contracts, database schema, or unrelated learning features.
