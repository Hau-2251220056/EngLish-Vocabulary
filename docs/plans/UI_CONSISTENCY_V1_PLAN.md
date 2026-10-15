# PLAN: UI Consistency V1

Source: `docs/specs/UI_CONSISTENCY_V1_SPEC.md`

Status: HUMAN APPROVED

## Approach

1. Add React-Toastify to the existing frontend package and mount one themed container at the application root.
2. Expose a small project notification adapter so call sites share IDs, durations, and safe message variants without introducing a second system.
3. Replace page-level mutation banners only in the approved vocabulary flows; preserve modal/form validation and destructive confirmations.
4. Reuse `paginateSetDetailItems`, `SET_DETAIL_PAGE_SIZE`, and the Public Set pagination control pattern in Personal Set Detail.
5. Keep the full Personal Set aggregate client-side, slice only rendered rows, and clamp page state after mutations.
6. Opt Personal Set Detail into a compact two-column mobile learning-card grid and apply the approved shared teal Speaking accent without changing learning destinations or behavior.
7. Extend existing unit and mocked Playwright coverage for notification states, deduplication, pagination boundaries, learning-card layout and colors, focus, touch targets, and overflow.

## Affected files

- Frontend package manifest/lockfile.
- Application root and global styles.
- New shared notification adapter/component.
- Public and Personal Vocabulary Set detail pages and their focused tests.
- Existing pagination helper/tests where a reusable clamp assertion is needed.
- UI Consistency SPEC/PLAN/TASK documentation; feature status remains `IN_PROGRESS`.

## Risks and controls

- Duplicate notifications: stable toast IDs and pending guards.
- Toast obstruction: responsive top/right placement with bounded width and mobile offsets.
- Pagination/focus after removal: compute the next valid page before restoring focus; do not focus a removed control.
- Regression in mutation error recovery: keep retryable form/dialog errors inline when user input must be preserved.

No backend, API, schema, migration, or external service change is planned.
