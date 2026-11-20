# SPEC: Authenticated App Layout Foundation

**Feature status:** `TODO` (not yet recorded as a standalone entry in `docs/FEATURE_STATUS.md`)

**SPEC status:** `APPROVED`

**Human approval:** `APPROVED` on `2026-09-20`

## Existing Implementation

- Authentication is `DONE` through TASK-015.
- `frontend/src/auth/ui/authenticated-shell.jsx` is the existing authenticated shell and must be reused and extended.
- The existing shell already provides ELVocab branding, a minimal Dashboard navigation link, backend-provided account identity, conditional Admin context, Logout, a responsive presentation and a React Router `<Outlet />` inside the main content region.
- `frontend/src/app-router.jsx` composes the authenticated shell around the protected `/dashboard` route.
- `frontend/src/pages/dashboard-placeholder.jsx` is only a semantic destination; it is not the User Dashboard feature.
- Authentication TASK-013 owns the completed authentication, route-guard, account, logout and session-expiration behavior. This feature must preserve those contracts.

## 1. Objective

Establish the shared responsive layout foundation for the authenticated area of ELVocab:

```text
HEADER

SIDEBAR | MAIN CONTENT
        | route content
----------------------
FOOTER
```

The foundation provides consistent application chrome around current and future authenticated routes. It extends the existing `AuthenticatedShell`; it does not create a second shell and does not implement the business content of any route.

## 2. Actors

- **USER:** Can use the shared authenticated layout after Authentication has established a valid USER identity.
- **ADMIN:** Can use the same shared authenticated layout after Authentication has established a valid ADMIN identity. Any role-specific presentation remains UI context only and is not an authorization boundary.
- **Guest:** Cannot render the authenticated layout. Existing route guards and Guest redirects remain authoritative for frontend navigation behavior.

No new role is introduced.

## 3. Scope

### In Scope

- Reuse and extend the existing `AuthenticatedShell` as the single shared shell for authenticated routes.
- Provide the shared structural regions: Header, Sidebar, Main Content and Footer.
- Preserve React Router nested-route rendering through the existing `<Outlet />` pattern.
- Preserve the existing Authentication state, protected-route behavior, account identity, conditional Admin context, Logout states and session-expiration behavior.
- Provide responsive desktop, tablet and mobile layout behavior for the shared regions.
- Provide accessible landmarks, navigation semantics, focus behavior and controls within the shared layout.
- Keep the layout ready to host approved authenticated feature routes without rendering fake or inactive future-feature controls.
- Reuse the existing ELVocab visual language and dependencies.

### Out of Scope

- User Dashboard business content, dashboard data or dashboard summaries.
- Topic.
- Vocabulary or Vocabulary Set.
- Flashcard, Learning Session or other learning activities.
- Quiz or Pronunciation.
- XP, Level, Streak, Daily Goal, Achievement or Learning Progress.
- Community or Admin management screens.
- Landing Page or any other public-facing page.
- New protected business routes or placeholder pages for future features.
- Search functionality, Profile functionality or Settings functionality.
- Backend, API, database, Authentication or authorization architecture changes.
- Authentication redesign or replacement of existing route guards/Auth state.
- New roles or permissions.
- A second authenticated shell parallel to `AuthenticatedShell`.
- New dependencies or an over-engineered component/folder abstraction.
- PLAN, task decomposition or implementation decisions.

## 4. Layout Responsibilities

### 4.1 Header

- Provides a consistent top-level visual region for the authenticated application.
- Displays ELVocab branding/logo.
- Displays account identity on the right using an avatar, or a default avatar when no avatar is available, together with the backend-provided `display_name`.
- May display appropriate non-interactive ADMIN role/context when the backend-established identity has role `ADMIN`; this does not introduce an Admin feature or authorization boundary.
- Does not make Logout a primary Header action; Logout remains in Sidebar/navigation.
- Must not implement Search, Profile, Settings, notifications or other future functionality in this feature.
- Must remain visible and usable without obscuring route content at supported viewport sizes.

### 4.2 Sidebar

- Provides the primary authenticated navigation region on viewport sizes where a sidebar is appropriate.
- Reuses the existing navigation behavior and accessible active-route indication.
- Shows only real routes approved and available at implementation time; it must not show fake, disabled or non-functional future feature links.
- Keeps the existing Logout action within Sidebar/navigation and continues to use the approved shared Authentication behavior.
- Remains visually simple and must not become a source of authorization enforcement.
- Must preserve the existing backend-derived Admin context without introducing an Admin destination unless separately approved.
- Adds future menu items only when their corresponding route/feature has been implemented and approved.

### 4.3 Main Content

- Is the route-controlled content region of the authenticated layout.
- Continues to render the matched nested route through React Router `<Outlet />`.
- Must allow route content to manage its own loading, empty, error and business states.
- Must not embed Dashboard, Topic or other feature-specific business content in the layout.
- Must avoid clipping and unintended horizontal overflow at supported viewport sizes.

### 4.4 Footer

- Provides a shared bottom region for the authenticated application, separate from route business content.
- Displays only `© 2026 ELVocab` in V1.
- Must remain visually secondary and must not interfere with primary navigation or learning content.
- Remains visible on mobile in a compact presentation.
- Must not be copied from or coupled to the future public Landing Page footer.
- Must not contain marketing navigation, Terms, Privacy, Contact or other unapproved links, legal claims, contact details, version information or business functionality.

## 5. User Flow

1. Authentication resolves the current visitor using the existing shared Auth state.
2. A Guest continues through the existing Guest redirect behavior and does not see the authenticated layout.
3. An authenticated USER or ADMIN enters an approved protected route.
4. The existing `AuthenticatedShell` renders the shared Header, responsive navigation/Sidebar, Main Content and Footer.
5. React Router renders the matched route inside Main Content through `<Outlet />`.
6. Navigation to another approved authenticated route updates the active navigation state and route content without replacing the shared layout.
7. Account and Logout interactions continue to use the existing Authentication behavior.

## 6. Responsive Behavior

- **Desktop:** Present the complete shared layout with a persistent Sidebar, a distinct Header, route-driven Main Content and Footer.
- **Tablet:** Replace the persistent Sidebar with collapsible/drawer navigation while preserving access to navigation and Logout; Header identity, Main Content and compact Footer remain usable without clipping or horizontal overflow.
- **Mobile:** Use collapsible/drawer navigation, not bottom navigation. Main Content uses the available width, Footer remains visible in compact form and all controls remain touch-friendly.
- Responsive behavior must preserve the same available route destinations and Authentication actions across supported viewport sizes.
- Breakpoint values and implementation mechanics belong to PLAN/implementation.

## 7. Navigation and Authentication Integration

- React Router remains the application navigation mechanism.
- The existing `ProtectedRoute`, Authentication provider/state and `AuthenticatedShell` remain the integration foundation.
- Only approved, implemented routes appear as navigation destinations.
- Active navigation state must be programmatically and visually identifiable.
- Account identity and role context must come from the existing backend-established Authentication state.
- Header identity uses the available avatar or a default avatar plus backend-provided `display_name`; optional ADMIN context remains non-interactive.
- Logout must call the existing shared `logout()` operation and preserve its approved pending, success and safe-error behavior.
- Logout remains in Sidebar/navigation across responsive presentations rather than becoming a primary Header action.
- Successful Logout and session expiration retain the existing navigation and message contracts.
- Frontend role-dependent presentation remains UX only; backend authorization remains the security boundary.
- Raw session cookies/tokens must not be read, exposed or persisted by layout code.

## 8. Business and UI Rules

- **BR-01:** There is exactly one shared authenticated shell; this feature extends `AuthenticatedShell`.
- **BR-02:** Only authenticated USER and ADMIN identities may render the authenticated layout.
- **BR-03:** Route-specific business content is rendered by the matched child route, not owned by the layout.
- **BR-04:** The layout exposes only real, approved navigation destinations.
- **BR-05:** The layout does not make authoritative authentication or authorization decisions beyond using the existing approved frontend Auth contracts.
- **BR-06:** Layout regions remain shared presentation infrastructure and must not become a substitute for Dashboard or other business features.
- **BR-07:** Public Landing Page structure and its Footer remain independent from the authenticated layout.
- **BR-08:** Tablet/mobile navigation uses a collapsible/drawer pattern; bottom navigation is not used.
- **BR-09:** The authenticated Footer contains only `© 2026 ELVocab` in V1 and remains visible in compact form on mobile.

## 9. Data Requirements

- No new database entity, field, relationship, constraint or migration is required.
- The layout may display only the already-approved public Authentication identity fields supplied by existing shared Auth state.
- No new persistent client-side state is required by this SPEC.

## 10. API Requirements

- No new endpoint or API contract is required.
- Existing Authentication endpoints and relative `/api/auth/**` integration remain unchanged.
- The layout must not call business APIs for Dashboard, Topic or any future feature.

## 11. Accessibility Expectations

- Use appropriate semantic landmarks for Header, navigation, Main Content and Footer.
- Navigation must have an accessible name and expose the active destination without relying on color alone.
- Interactive controls must support keyboard use, visible focus and appropriate accessible names.
- Mobile controls must provide usable touch targets.
- Layout and text must maintain sufficient contrast and remain usable under content zoom and supported viewport sizes.
- Responsive transformations must preserve logical reading and focus order.
- Existing Logout loading/error semantics and reduced-motion behavior must not regress.

## 12. Acceptance Criteria

- **AC-01:** Authenticated USER and ADMIN routes render within one shared layout containing distinct Header, navigation/Sidebar, Main Content and Footer regions.
- **AC-02:** The feature reuses and extends the existing `AuthenticatedShell`; no second authenticated shell or duplicate Auth provider/state is introduced.
- **AC-03:** Guest access continues to be rejected by the existing protected-route behavior and never renders authenticated layout content.
- **AC-04:** Main Content renders the matched nested route using the existing React Router `<Outlet />` pattern.
- **AC-05:** Changing between approved authenticated routes preserves the shared layout and correctly identifies the active navigation destination.
- **AC-06:** Navigation contains only routes that are implemented and approved at that point; no fake future destination is rendered.
- **AC-07:** Header displays ELVocab branding/logo and, on the right, an available avatar or default avatar with the backend-provided `display_name`; an ADMIN may additionally receive non-interactive role/context presentation without creating an Admin feature.
- **AC-08:** Existing Logout pending, success, error and session-expiration behavior remains functionally unchanged.
- **AC-09:** Logout remains in Sidebar/navigation, uses the existing shared `logout()` operation and does not become a primary Header action.
- **AC-10:** Header, navigation, Main Content and Footer use appropriate landmarks; navigation and controls support keyboard, focus, screen-reader and touch interaction expectations.
- **AC-11:** No User Dashboard business content, Topic, Vocabulary, learning, gamification, Landing Page or future-feature placeholder is implemented.
- **AC-12:** No backend, API, database, Authentication architecture, authorization rule or deployment configuration changes.
- **AC-13:** The existing Login/Register, protected-route and authenticated-session flows do not regress.
- **AC-14:** Desktop uses a persistent Sidebar; tablet/mobile use collapsible/drawer navigation and do not use bottom navigation.
- **AC-15:** Main Content remains usable without unintended horizontal overflow or layout clipping on desktop, tablet and mobile.
- **AC-16:** The authenticated Footer displays only `© 2026 ELVocab` in V1, has no unapproved links and remains visible in compact form on mobile.
- **AC-17:** Navigation contains no placeholder route or menu item; future menu items are added only with their implemented and approved feature.

## 13. Edge Cases

- Authentication is still initializing: existing neutral Auth loading behavior remains responsible for preventing protected-content flash.
- Display name is long: account controls and route content remain usable without layout overflow.
- ADMIN context is present: it remains non-interactive unless a separately approved Admin route exists.
- Only one authenticated route exists: navigation must not invent additional destinations or add unnecessary mobile-menu complexity.
- A tablet/mobile drawer is closed or open: route content and controls must not create unintended horizontal overflow, and navigation remains keyboard-accessible.
- Route content is short or tall: Footer and Main Content must remain structurally coherent without overlapping content.
- Route content has its own loading/error/empty state: layout landmarks remain stable and do not replace that state.
- Logout is pending or fails: existing control state and safe inline feedback remain accessible within the approved layout placement.
- Viewport changes between desktop, tablet and mobile: navigation remains reachable and focus order stays logical.

## 14. Dependencies / Impact

### Dependencies

- Authentication TASK-011 through TASK-015: `DONE`.
- Existing `AuthenticatedShell`, `ProtectedRoute`, shared Authentication state/actions and React Router composition.
- Existing UI/UX global-layout and responsive/accessibility guidance.

### Frontend Impact

- Shared authenticated layout composition and presentation.
- Existing responsive navigation/account arrangement.
- Existing route outlet and current Dashboard placeholder placement.
- No decision about exact files or component decomposition is made in this SPEC.

### Backend / API / Database Impact

- None.

### Related Feature Boundaries

- User Dashboard remains `TODO` and supplies its own business content later.
- Topic remains the next core business feature after this foundation.
- Landing Page remains a separate public feature and is not a dependency.

## 15. Documentation Follow-up After SPEC Approval

- Update `docs/UI_UX_SPEC.md` to record the approved authenticated Header, Sidebar, Main Content, Footer and responsive behavior without changing Landing Page scope.
- Update `docs/FEATURE_STATUS.md` to track Authenticated App Layout Foundation separately from User Dashboard and Authentication.
- Review `docs/ARCHITECTURE.md` during PLAN; update it only if the approved shared-layout organization materially changes the documented frontend architecture.
- Do not perform these documentation updates before human approval of this SPEC.

## 16. Open Questions / Human Decisions Required

None. Header ownership, Sidebar/Logout ownership, tablet/mobile drawer navigation and authenticated Footer content/visibility have been resolved by human decision.

## 17. Conflicts / Scope Notes

- There is no conflict with the documented core-feature order: repository documentation does not require Topic to begin immediately after Authentication.
- `docs/UI_UX_SPEC.md` describes a global authenticated layout but does not yet reflect the approved authenticated Footer and drawer-only tablet/mobile navigation decisions; synchronization remains a required follow-up after SPEC approval.
- Authentication TASK-013 intentionally delivered only a minimal shell. This feature extends that completed implementation without reopening or redesigning Authentication.
- The broader UI/UX illustration includes Search/Profile and future navigation destinations, but those functions are outside this SPEC and must not be rendered as fake controls.

## Approval Gate

```text
SPEC STATUS: APPROVED
HUMAN APPROVAL: APPROVED ON 2026-09-20
NEXT ALLOWED STAGE: DOCUMENTATION SYNC, THEN PLAN
IMPLEMENTATION AUTHORIZED: NO
```
