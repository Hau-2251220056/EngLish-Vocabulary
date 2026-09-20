# PLAN: Authenticated App Layout Foundation

**SPEC:** `docs/specs/AUTHENTICATED_APP_LAYOUT_FOUNDATION_SPEC.md`

**SPEC status:** `APPROVED`

**Feature status:** `PLANNED`

**PLAN status:** `APPROVED`

**Human approval:** `APPROVED` on `2026-09-20`

## 1. Summary

Extend the existing Authentication `AuthenticatedShell` into the approved shared authenticated App Layout without replacing its route, Authentication or Logout contracts.

The implementation will keep one shell, preserve the nested React Router `<Outlet />`, and add the approved Header, persistent desktop Sidebar, tablet/mobile drawer, route-owned Main Content and minimal Footer. Layout state will remain local UI state. No backend, API, database, Authentication architecture, new route, new dependency or business feature is required.

The minimum-change strategy is:

1. Modify the existing `AuthenticatedShell` rather than create a parallel layout.
2. Keep currently approved Dashboard navigation as the only route link.
3. Keep Logout in Sidebar/navigation and reuse the existing `logout()` flow unchanged.
4. Add drawer interaction only for tablet/mobile.
5. Extend the existing stylesheet and Playwright coverage using current project tooling.

## 2. Affected Areas

- **Database:** No change.
- **Backend:** No change.
- **API:** No endpoint or contract change.
- **Routing:** Preserve the current route tree; no new route or placeholder destination.
- **Frontend shell:** Extend the existing authenticated layout composition.
- **Authentication:** Reuse existing state, identity, Logout and protected-route behavior; no logic redesign.
- **Styles:** Update existing authenticated layout styles for the four-region layout and responsive drawer.
- **Tests:** Add focused App Layout browser coverage and retain Authentication regression coverage.
- **Documentation:** Update feature status as later workflow stages genuinely complete; no architecture update is currently required.

## 3. Existing Code to Reuse

- `frontend/src/auth/ui/authenticated-shell.jsx`
  - Remains the single authenticated shell.
  - Reuse `useAuthentication()`, `useNavigate()`, Logout state/error handling, backend-provided `user`, `NavLink` and `<Outlet />`.
- `frontend/src/auth/ui/route-guards.jsx`
  - Reuse without modification for Guest rejection, protected-content loading and authenticated rendering.
- `frontend/src/auth/auth-provider.jsx`
  - Reuse without modification; do not create layout-specific Auth state.
- `frontend/src/auth/use-authentication.js`
  - Reuse without modification as the shell's only Authentication integration.
- `frontend/src/auth/auth-store.js`
  - Reuse without modification; existing Login, Logout and session-expiration transitions remain authoritative.
- `frontend/src/app-router.jsx`
  - Preserve the existing nested `ProtectedRoute` → `AuthenticatedShell` → route element composition.
- `frontend/src/pages/dashboard-placeholder.jsx`
  - Preserve as route-owned placeholder content; do not convert it into Dashboard business content.
- `frontend/src/index.css`
  - Extend the existing authenticated layout class system and breakpoint conventions rather than add a styling dependency.
- `frontend/e2e/auth/fixtures/auth-api.js`
  - Reuse current USER/ADMIN fixtures and Auth request mocks.
- Existing Authentication Playwright suites
  - Retain route, identity, Logout, session and responsive regression assertions.

## 4. Planned File Changes

### Create

- `frontend/e2e/auth/app-layout.spec.js`
  - Focused browser-level coverage for Header, Sidebar/drawer, Main Content, Footer, responsive behavior, accessibility contract and absence of placeholder destinations.

### Modify

- `frontend/src/auth/ui/authenticated-shell.jsx`
  - Extend the existing shell structure and add local drawer interaction state.
- `frontend/src/index.css`
  - Implement the approved desktop grid and tablet/mobile drawer presentation using the current CSS/Tailwind stack.
- Existing Authentication Playwright assertions only where their selectors or layout expectations must follow the approved shell structure while preserving the same behavior.
  - Expected candidates: `frontend/e2e/auth/auth-routing.spec.js`, `frontend/e2e/auth/auth-session.spec.js`, and `frontend/e2e/auth/auth-responsive.spec.js`.

### Expected Unchanged

- `frontend/src/app-router.jsx`
- `frontend/src/auth/ui/route-guards.jsx`
- `frontend/src/auth/auth-store.js`
- `frontend/src/auth/auth-provider.jsx`
- `frontend/src/services/auth-service.js`
- `frontend/src/pages/dashboard-placeholder.jsx`
- Backend, Prisma, API and deployment files.

If implementation proves an expected-unchanged file must change, that change must remain within the approved SPEC and be reviewed before expanding the task scope.

## 5. Component and Layout Responsibilities

### 5.1 `AuthenticatedShell`

- Remains the only authenticated shell and top-level owner of layout composition.
- Reads the already-authenticated `user` and existing `logout()` action through `useAuthentication()`.
- Owns only ephemeral drawer UI state in addition to its existing Logout UI state.
- Composes semantic Header, Sidebar/navigation, Main Content and Footer regions.
- Preserves route content ownership by rendering `<Outlet />` only in Main Content.
- Does not fetch business data or make authoritative role/authorization decisions.

No second shell, new provider, global layout store or general-purpose navigation framework will be created.

### 5.2 Header

- Render a semantic shared Header.
- Display ELVocab branding/logo.
- Display account identity on the right using:
  - `user.avatar_url` only if the existing identity object supplies a usable value; otherwise
  - a deterministic default avatar presentation derived from the available `display_name` without persistence or API changes.
- Display backend-provided `display_name` with safe overflow handling.
- Optionally display the existing non-interactive ADMIN context when `user.role === "ADMIN"`.
- On tablet/mobile, host the accessible drawer toggle.
- Do not place Logout, Search, Profile, Settings, notifications or future feature controls in the Header.

### 5.3 Sidebar / Navigation

- Remain the primary authenticated navigation region.
- Desktop: stay persistently visible.
- Tablet/mobile: become the approved collapsible drawer.
- Keep Dashboard as the only current navigation link because it is the only implemented and approved authenticated destination.
- Continue using `NavLink` for active-route state and accessible `aria-current` behavior.
- Keep Logout in Sidebar/navigation and reuse the existing pending, success and safe-error implementation.
- Keep ADMIN context non-interactive; do not add `/admin` or any other destination.
- Do not render fake, disabled or placeholder menu items.

### 5.4 Main Content

- Render as the semantic `<main>` region.
- Preserve the existing nested React Router `<Outlet />` behavior.
- Use `min-width: 0` and responsive sizing so route-owned content cannot force layout-level horizontal overflow.
- Do not absorb loading, empty, error or business states owned by child routes.
- Leave `DashboardPlaceholder` unchanged as route content.

### 5.5 Footer

- Render as a semantic shared Footer outside route-owned content.
- Display exactly `© 2026 ELVocab` in V1.
- Add no links or interactive controls.
- Remain visually secondary and visible in compact form on mobile.
- Remain independent of the future public/Landing Footer.

### 5.6 New Component Decision

No new production component file is required initially. The existing shell is small and already owns the coupled Auth/navigation behavior; keeping the approved regions in that component is the least disruptive approach.

During implementation, extraction may occur only if the shell becomes materially difficult to read or test. Any extraction must remain presentation-only, co-located with the existing shell, and must not create another shell, state provider or abstraction layer.

## 6. Routing Plan

- Keep `frontend/src/app-router.jsx` functionally unchanged.
- Preserve the current route composition:

```text
ProtectedRoute
  → AuthenticatedShell
    → /dashboard route element
```

- Preserve `<Outlet />` as the child-route rendering mechanism.
- Add no Topic, Dashboard business, Admin or future-feature route.
- Preserve `/`, `/login`, `/register`, `/dashboard` and fallback redirect behavior.
- Navigation configuration remains limited to current approved destinations; a generalized route registry is unnecessary for one destination.

## 7. Drawer and Responsive Plan

### 7.1 Breakpoint Direction

- Continue using the existing `900px` authenticated-layout boundary unless implementation verification reveals a documented usability issue.
- Desktop above the boundary: persistent Sidebar and no functional drawer toggle.
- Tablet/mobile at or below the boundary: Header plus off-canvas/collapsible drawer; no bottom navigation.
- Preserve the existing smaller mobile refinement near `540px` where useful.

Exact dimensions, spacing and visual styling may be refined during implementation because visual styling is not frozen, but functional behavior must remain within the approved contract.

### 7.2 Drawer State

- Keep `isDrawerOpen` as local state in `AuthenticatedShell`; do not add Context, Redux or another global store.
- Drawer starts closed on tablet/mobile.
- The Header menu button toggles the drawer and exposes `aria-expanded` plus `aria-controls`.
- Opening the drawer makes the navigation and Logout controls available without changing route state.
- Close the drawer when:
  - the toggle/close control is activated;
  - the dismissing backdrop is activated;
  - `Escape` is pressed;
  - an available navigation link is selected;
  - successful Logout navigates away.
- Return focus to the drawer toggle after an explicit drawer dismissal where appropriate.
- Prevent the closed drawer from leaving keyboard-focusable hidden controls.
- Prevent background/body horizontal scrolling caused by the off-canvas presentation.
- Do not add a bottom-navigation fallback.

### 7.3 Viewport Transitions

- CSS controls persistent-versus-drawer presentation so the structure remains responsive without duplicating navigation.
- Returning to desktop makes the same Sidebar content persistently available regardless of prior mobile drawer state.
- Returning to tablet/mobile presents the drawer closed by default or in a state that cannot obscure content unexpectedly.
- No second copy of navigation links or Logout is rendered solely for responsive layout.

## 8. Authentication, Identity and Security Preservation

- Reuse the existing Auth context/provider/store and `useAuthentication()` hook.
- Do not change the Authentication service, session-cookie handling, `/api/auth/**` requests or credential storage behavior.
- Keep backend-provided identity and role authoritative.
- Header ADMIN presentation remains non-interactive UI context only.
- Frontend navigation visibility does not become a security boundary.
- Do not read or store raw tokens/cookies.
- Preserve Logout deduplication, disabled/pending state, idempotent success, safe inline failure and redirect behavior.
- Preserve session-expiration handling and the distinction from voluntary Logout.
- Do not require `avatar_url` to be added to the current Auth response. Use the approved default avatar when the field is unavailable.

## 9. Accessibility Plan

- Use distinct semantic `<header>`, `<aside>`, `<nav>`, `<main>` and `<footer>` landmarks.
- Keep one clearly named primary navigation region.
- Preserve `NavLink` active semantics and ensure visual active state is not color-only.
- Give the drawer toggle and close behavior explicit accessible names.
- Keep `aria-expanded` synchronized with drawer state and connect it to the drawer using `aria-controls`.
- Ensure the drawer is not keyboard reachable while closed.
- Support keyboard opening/closing, `Escape` dismissal and logical focus restoration.
- Preserve visible focus indicators for navigation, drawer and Logout controls.
- Keep controls touch-friendly on tablet/mobile.
- Preserve logical DOM/reading order across responsive transformations.
- Preserve reduced-motion behavior and extend it to drawer transitions.
- Keep account name truncation visually safe while retaining the full accessible text/title behavior.
- The decorative/default avatar must not create redundant screen-reader content.

## 10. Styling Plan

- Continue using the existing Tailwind-enabled stack plus the established custom class rules in `frontend/src/index.css`.
- Do not add CSS-in-JS, a component library or another styling dependency.
- Evolve `.authenticated-layout`, `.authenticated-sidebar`, `.authenticated-main`, account/navigation and breakpoint rules rather than create a parallel style system.
- Add narrowly scoped classes for Header, drawer toggle/backdrop/state, content wrapper and Footer.
- Use grid/flex sizing with `minmax(0, 1fr)` and `min-width: 0` to protect against overflow.
- Keep layout classes independent from Dashboard-specific styles.
- Extend the existing `prefers-reduced-motion` block for drawer transitions.
- Visual tokens, spacing and shadows may be refined without altering the approved functional contract.

## 11. Data, Backend and API Plan

### Database

- No model, field, relationship, constraint or migration change.

### Backend

- No route, middleware, controller, service or repository change.

### API

- No endpoint, request, response or authorization contract change.
- Continue consuming the current public Auth identity.
- Default-avatar behavior covers the current absence of `avatar_url` in Auth fixtures/responses; no API expansion is part of this feature.

## 12. Testing Strategy

### 12.1 Focused App Layout Browser Tests

Create `frontend/e2e/auth/app-layout.spec.js` using existing Playwright configuration and Auth mocks. Cover:

- USER renders one shared Header, primary navigation/Sidebar, Main Content and Footer.
- ADMIN renders non-interactive role/context and no Admin route/link.
- Header shows ELVocab, default avatar and exact backend-provided `display_name`.
- Footer displays exactly `© 2026 ELVocab` and contains no unapproved links.
- Main Content renders the existing Dashboard route through the shell.
- Navigation exposes only `/dashboard`, with correct active state and no placeholder links.
- Desktop viewport shows the persistent Sidebar and does not expose a functional mobile drawer presentation.
- Tablet and mobile viewports start with the drawer closed, open it through the Header control and close through the approved dismissal paths.
- Drawer toggle semantics (`aria-expanded`, `aria-controls`), keyboard access, `Escape` dismissal and focus restoration.
- Logout remains inside drawer/Sidebar and retains pending, success and safe-error behavior.
- Long `display_name`, Main Content, drawer and compact Footer do not cause horizontal overflow.
- Footer remains visible in compact mobile presentation.

### 12.2 Authentication Regression Tests

Run and preserve the existing frontend Authentication suite:

- focused Node tests;
- Playwright Authentication routing tests;
- Logout/session tests;
- responsive tests at the existing 375×812, 768×1024 and 1366×768 matrix;
- Login/Register browser flows.

Update selectors/assertions only where the approved layout changes semantic placement. Do not weaken route, identity, Admin, Logout, session-expiration, token-leakage or responsive assertions.

### 12.3 Static Verification

- Frontend lint.
- Frontend production build.
- `git diff --check`.
- Scope/diff review proving no backend, API, database, deployment or unrelated business feature change.

### 12.4 Not Required

- Backend test rerun is not required by the planned frontend-only implementation unless implementation unexpectedly touches backend/Auth contracts.
- No database or API integration fixture is required beyond existing Auth browser mocks and existing regression coverage.

## 13. Regression Protection

- Guest must still never see authenticated layout content.
- Auth initialization must still prevent protected-content flash.
- Authenticated access to Guest routes must still redirect to `/dashboard`.
- USER/ADMIN display differences must remain based only on backend identity.
- Logout pending/error/success and session-expiration behavior must remain unchanged.
- No raw session value may appear in UI or browser storage.
- Existing `/dashboard` placeholder remains route-owned and unchanged.
- No `/admin`, Topic or future route/link is introduced.
- Login/Register responsive behavior must remain unaffected by authenticated layout CSS.

## 14. Documentation Impact

- `docs/UI_UX_SPEC.md` is already synchronized with the approved functional contract; update only if implementation reveals an approved clarification that must be recorded.
- `docs/FEATURE_STATUS.md` remains `PLANNED` through PLAN/TASK preparation and changes only when the corresponding workflow stage genuinely begins or completes.
- After implementation, test and review approval, record actual implementation/test evidence and advance status according to project rules.
- `docs/ARCHITECTURE.md` does not require an update: extending the existing component-based shell, nested routing and current style architecture does not change documented frontend architecture.
- `docs/API_SPEC.md`, `docs/DATABASE.md` and `docs/PROJECT_OVERVIEW.md` require no change for this frontend foundation.

## 15. Implementation Order

1. Reconfirm approved SPEC, PLAN/TASK approval and clean branch scope before implementation.
2. Extend `AuthenticatedShell` semantic structure while preserving existing Logout logic and `<Outlet />`.
3. Add Header identity/default-avatar presentation and drawer controls.
4. Convert the same Sidebar/navigation into persistent desktop and collapsible tablet/mobile presentation; implement dismissal and focus behavior.
5. Add the Main Content wrapper and minimal shared Footer without modifying route content.
6. Update authenticated layout CSS, responsive breakpoints, overflow protection, focus states and reduced-motion behavior.
7. Add focused App Layout Playwright coverage.
8. Adjust existing Authentication browser assertions only where semantic placement changed.
9. Run focused layout tests, full frontend Authentication tests, lint and production build.
10. Review scope, accessibility, responsive behavior and Authentication regressions.
11. Update `docs/FEATURE_STATUS.md` only when verified workflow status changes; synchronize other documentation only if an approved implementation detail requires it.

This is an implementation sequence, not TASK decomposition. Detailed executable tasks belong to the TASK stage after PLAN approval.

## 16. Acceptance Criteria Traceability

| SPEC acceptance criterion | PLAN coverage |
|---|---|
| AC-01 | Sections 5 and 10 define one shell with Header, Sidebar, Main Content and Footer. |
| AC-02 | Sections 1, 3 and 5.1 require extending the existing `AuthenticatedShell` with no duplicate shell/provider. |
| AC-03 | Sections 3, 8 and 13 preserve `ProtectedRoute` and Guest rejection. |
| AC-04 | Sections 5.4 and 6 preserve nested route rendering through `<Outlet />`. |
| AC-05 | Sections 5.3, 6 and 12 verify shared layout persistence and active navigation. |
| AC-06 | Sections 5.3 and 6 limit navigation to implemented/approved `/dashboard`. |
| AC-07 | Sections 5.2, 8 and 12 cover branding, avatar/default avatar, `display_name` and optional non-interactive ADMIN context. |
| AC-08 | Sections 3, 8, 12 and 13 preserve Logout/session-expiration behavior. |
| AC-09 | Sections 5.3, 7 and 8 retain Logout in Sidebar/drawer using shared `logout()`. |
| AC-10 | Sections 7.2, 9 and 12 cover landmarks, navigation semantics, keyboard/focus/screen-reader/touch behavior. |
| AC-11 | Sections 2, 4, 6 and 17 exclude business content, Landing and placeholder features. |
| AC-12 | Sections 2, 8 and 11 define no backend/API/database/Auth architecture changes. |
| AC-13 | Sections 12.2 and 13 define Authentication regression protection. |
| AC-14 | Sections 7 and 10 implement persistent desktop Sidebar and tablet/mobile drawer with no bottom navigation. |
| AC-15 | Sections 5.4, 7, 10 and 12 cover responsive overflow/clipping verification. |
| AC-16 | Sections 5.5, 7 and 12 cover exact Footer content, no links and compact mobile visibility. |
| AC-17 | Sections 5.3, 6, 12 and 13 prevent placeholder routes/menu items. |

All approved SPEC acceptance criteria are covered without adding business scope.

## 17. Scope Validation

### Included

- Existing-shell extension.
- Shared Header, Sidebar/navigation, Main Content and Footer.
- Desktop persistent Sidebar.
- Tablet/mobile drawer.
- Existing Authentication/account/Logout integration.
- Accessibility, responsive styling and focused regression tests.

### Excluded

- Dashboard business content.
- Topic.
- Vocabulary/Vocabulary Set.
- Flashcard/Learning.
- Quiz/Pronunciation.
- Progress/gamification.
- Community/Admin business screens.
- Landing Page/public Footer.
- Backend/API/database/Auth architecture changes.
- Placeholder routes or future navigation items.
- New dependencies.

## 18. Risks and Mitigations

### Authentication regression

- **Risk:** Refactoring shell markup could move or break Logout/account behavior.
- **Mitigation:** Reuse the existing handler/state unchanged and retain focused session/routing regression tests.

### Drawer accessibility

- **Risk:** Hidden controls remain focusable or focus is lost on dismissal.
- **Mitigation:** Define closed-state keyboard exclusion, explicit toggle semantics, Escape behavior and focus restoration; verify with Playwright keyboard assertions.

### Responsive overflow

- **Risk:** Long identity text, off-canvas positioning or route content causes horizontal scroll.
- **Mitigation:** Retain `min-width: 0`, constrain identity text, isolate drawer transforms and run the established viewport/overflow matrix.

### Duplicate responsive controls

- **Risk:** Separate mobile/desktop markup duplicates navigation or Logout and drifts over time.
- **Mitigation:** Render one Sidebar/navigation content tree and change presentation through state and responsive CSS.

### Avatar contract mismatch

- **Risk:** Current Auth public identity does not include `avatar_url`.
- **Mitigation:** Default avatar is sufficient for this feature; consume `avatar_url` only if already available without changing the API.

### Scope creep from navigation illustration

- **Risk:** UI/UX examples are mistaken as approval for Search/Profile/future menu items.
- **Mitigation:** Render only current approved `/dashboard` navigation and assert absence of placeholder routes/links.

## 19. Dependencies

- Authentication TASK-011 through TASK-015: `DONE`.
- Approved App Layout SPEC and synchronized UI/UX/status documentation.
- Existing React, React Router, Tailwind CSS, Lucide React and Playwright dependencies.
- No new package, service, external API or infrastructure dependency.

## 20. Open Questions

None.

## Approval Gate

```text
PLAN STATUS: APPROVED
HUMAN APPROVAL: APPROVED ON 2026-09-20
NEXT ALLOWED STAGE: TASK
IMPLEMENTATION AUTHORIZED: NO
```
