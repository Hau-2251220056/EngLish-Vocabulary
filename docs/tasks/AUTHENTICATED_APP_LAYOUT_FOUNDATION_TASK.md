# TASKS: Authenticated App Layout Foundation

## 1. Document Status

- SPEC: `APPROVED` — `docs/specs/AUTHENTICATED_APP_LAYOUT_FOUNDATION_SPEC.md`.
- PLAN: `APPROVED` — `docs/plans/AUTHENTICATED_APP_LAYOUT_FOUNDATION_PLAN.md`.
- Feature status: `PLANNED`.
- TASK status: `APPROVED`.
- Human approval: `APPROVED` on `2026-09-20`.
- Implementation authorized: `YES` for TASK-016 according to the approved dependency order.

## 2. Objective

Extend the existing Authentication `AuthenticatedShell` into the approved shared authenticated App Layout, verify it with focused browser coverage and existing Authentication regressions, then complete formal review/documentation closure only after all quality gates pass.

The task set preserves one shell/provider, the current route tree, `/dashboard` as the only authenticated destination, existing Auth/Logout behavior and the nested React Router `<Outlet />`.

## 3. Source Documents

- `AGENTS.md`
- `docs/specs/AUTHENTICATED_APP_LAYOUT_FOUNDATION_SPEC.md`
- `docs/plans/AUTHENTICATED_APP_LAYOUT_FOUNDATION_PLAN.md`
- `docs/UI_UX_SPEC.md`
- `docs/FEATURE_STATUS.md`
- `docs/ARCHITECTURE.md`

## 4. Task Overview

| Task | Responsibility | Workflow stage |
|---|---|---|
| TASK-016 | Extend the existing authenticated shell into the complete responsive App Layout | IMPLEMENT |
| TASK-017 | Add focused App Layout tests and run frontend/Auth regression verification | TEST |
| TASK-018 | Perform final scope/review gate and close documentation/status only after approval | REVIEW / closure |

## 5. Task Dependency Graph

```text
TASK-016 — App Layout implementation
    ↓
TASK-017 — Focused tests and regression verification
    ↓
TASK-018 — Review and documentation/status closure
```

Tasks are intentionally sequential. TASK-017 verifies TASK-016 output, and TASK-018 requires completed test evidence. No parallel implementation is planned.

## TASK-016 — Extend the Existing Authenticated Shell

### Objective

Implement the approved Header, persistent desktop Sidebar, tablet/mobile accessible drawer, route-rendered Main Content and minimal Footer by extending the current `AuthenticatedShell` without changing routing, Authentication architecture or business-feature content.

### Dependencies

- Authentication TASK-011 through TASK-015: `DONE`.
- App Layout SPEC: `APPROVED`.
- App Layout PLAN: `APPROVED`.
- This TASK document: human-approved before implementation starts.

### Files / Modules

Expected modifications:

- `frontend/src/auth/ui/authenticated-shell.jsx` — extend the single existing shell and own local drawer state.
- `frontend/src/index.css` — extend authenticated layout, drawer, responsive, focus and reduced-motion styles.

Expected unchanged files:

- `frontend/src/app-router.jsx`
- `frontend/src/auth/ui/route-guards.jsx`
- `frontend/src/auth/auth-store.js`
- `frontend/src/auth/auth-provider.jsx`
- `frontend/src/services/auth-service.js`
- `frontend/src/pages/dashboard-placeholder.jsx`
- All backend, Prisma, API and deployment files.

If an expected-unchanged file must change, stop and verify that the change is required by the approved PLAN before expanding the implementation diff.

### In Scope

- Reuse and extend the existing `AuthenticatedShell` as the only authenticated shell.
- Add semantic Header, Sidebar/navigation, Main Content and Footer regions.
- Preserve `<Outlet />` inside Main Content.
- Header:
  - ELVocab branding/logo;
  - available avatar or deterministic default avatar;
  - backend-provided `display_name`;
  - optional non-interactive ADMIN context.
- Sidebar/navigation:
  - Dashboard remains the only route link;
  - active-route behavior remains accessible;
  - Logout remains in Sidebar/navigation;
  - no placeholder or future menu item.
- Desktop persistent Sidebar.
- Tablet/mobile off-canvas collapsible drawer with local UI state.
- Drawer toggle, close/backdrop, `Escape`, navigation-selection and successful-Logout dismissal behavior.
- Closed-drawer keyboard exclusion and appropriate focus return.
- Main Content overflow protection.
- Footer containing exactly `© 2026 ELVocab`, no links, and compact mobile visibility.
- Existing Logout pending, success, safe-error and session-expiration behavior.
- Existing reduced-motion and responsive conventions.

### Out of Scope

- A second shell, provider or global layout state system.
- Routing changes or new routes.
- Placeholder navigation/menu items.
- Dashboard business content.
- Topic, Vocabulary, Vocabulary Set, learning, quiz, pronunciation, progress or gamification.
- Landing Page or public Footer.
- Backend, API, database, Authentication or authorization architecture changes.
- New dependencies.
- Pixel-perfect frozen visual styling.
- Unnecessary production component extraction.

### Implementation Requirements

1. Keep `AuthenticatedShell` as the single layout composition root.
2. Preserve the current `useAuthentication()`, `useNavigate()`, Logout handler/state and `<Outlet />` behavior.
3. Keep drawer state local to the shell; do not add Context or another store.
4. Render one Sidebar/navigation content tree and change its presentation responsively; do not duplicate navigation or Logout for different viewport sizes.
5. Keep `/dashboard` as the only `NavLink` and preserve its active semantics.
6. Render default avatar presentation from available `display_name` when `avatar_url` is unavailable; do not require an Auth API change.
7. Keep ADMIN context non-interactive and do not add an Admin route/control.
8. Keep Logout in Sidebar/drawer and preserve the existing shared `logout()` operation and error-sanitization behavior.
9. Desktop uses a persistent Sidebar; tablet/mobile use a drawer and never bottom navigation.
10. Drawer controls expose appropriate accessible names, `aria-expanded` and `aria-controls` state.
11. The closed drawer must not leave hidden interactive controls keyboard-focusable.
12. Support approved dismissal paths and logical focus restoration without adding a navigation library.
13. Use semantic landmarks and preserve logical reading order.
14. Prevent horizontal overflow caused by layout, long identity text or drawer positioning.
15. Extend the existing custom class/Tailwind styling approach and `prefers-reduced-motion` behavior.
16. Keep visual refinements flexible as long as the approved functional and accessibility contract remains satisfied.
17. Do not extract production components unless implementation demonstrates a concrete readability/testability need; any extraction remains presentation-only and must not create another shell or state layer.

### Acceptance Criteria

- **T16-AC-01 / SPEC AC-01:** Authenticated USER and ADMIN views render one shared Header, Sidebar/navigation, Main Content and Footer.
- **T16-AC-02 / SPEC AC-02:** Existing `AuthenticatedShell` is extended; no second shell/provider is created.
- **T16-AC-03 / SPEC AC-04:** Main Content still renders matched nested route content through `<Outlet />`.
- **T16-AC-04 / SPEC AC-06, AC-17:** Dashboard is the only navigation destination; no placeholder route/menu item exists.
- **T16-AC-05 / SPEC AC-07:** Header contains ELVocab branding plus avatar/default avatar and exact backend-provided `display_name`; ADMIN context remains non-interactive.
- **T16-AC-06 / SPEC AC-08, AC-09:** Logout stays in Sidebar/navigation and retains approved pending, success and safe-error behavior.
- **T16-AC-07 / SPEC AC-14:** Desktop uses persistent Sidebar; tablet/mobile use a collapsible drawer and no bottom navigation.
- **T16-AC-08 / SPEC AC-10:** Layout landmarks, active navigation, drawer controls, keyboard behavior, focus handling and touch targets meet the approved accessibility contract.
- **T16-AC-09 / SPEC AC-15:** Layout and Main Content remain usable without unintended horizontal overflow or clipping.
- **T16-AC-10 / SPEC AC-16:** Footer displays exactly `© 2026 ELVocab`, contains no links and remains compact/visible on mobile.
- **T16-AC-11 / SPEC AC-11, AC-12:** No business feature, route, backend/API/database/Auth architecture or dependency change is included.

### Verification

Implementation-stage checks before TASK-017:

- Inspect actual diff for one-shell reuse and absence of route/backend/dependency changes.
- Manually inspect semantic landmarks and drawer state attributes.
- Confirm `/dashboard` remains the only authenticated navigation link.
- Confirm `<Outlet />`, account identity, ADMIN context and Logout remain connected to existing Auth behavior.
- Confirm Footer text and absence of Footer links.
- Run only narrowly necessary local checks while implementing; formal test evidence belongs to TASK-017.

### Traceability

- PLAN: Sections 3–11 and implementation order steps 1–6.
- SPEC: AC-01, AC-02, AC-04, AC-06 through AC-12, AC-14 through AC-17.

## TASK-017 — App Layout Tests and Frontend Regression Verification

### Objective

Add focused browser coverage for the approved layout and produce truthful verification evidence that the new shell behavior works without regressing Authentication, responsive behavior, lint or production build.

### Dependencies

- TASK-016 implementation complete and ready for testing.

### Files / Modules

Expected creation:

- `frontend/e2e/auth/app-layout.spec.js` — focused App Layout Playwright coverage using existing Auth mocks/configuration.

Possible focused updates when semantic placement changes:

- `frontend/e2e/auth/auth-routing.spec.js`
- `frontend/e2e/auth/auth-session.spec.js`
- `frontend/e2e/auth/auth-responsive.spec.js`

Reuse:

- `frontend/e2e/auth/fixtures/auth-api.js`
- Existing frontend Node tests, Playwright configuration and npm scripts.

### In Scope

- Browser verification of Header, account identity/default avatar, ADMIN context, Sidebar/drawer, Main Content, Footer and route link constraints.
- Desktop/tablet/mobile behavior at the established viewport matrix.
- Drawer open/close, keyboard, focus and accessibility-state coverage.
- Horizontal-overflow and long-display-name coverage.
- Logout placement and behavior regression coverage.
- Existing frontend Authentication unit/browser regression suite.
- Frontend lint and production build.
- Diff/scope and secret checks appropriate to the implementation.

### Out of Scope

- Weakening existing Authentication assertions to make failures disappear.
- Backend or database tests unless an unexpected approved contract impact is first identified.
- Visual snapshot/pixel-perfect testing.
- Tests for Dashboard business content, Topic, Landing or future routes.
- Adding test libraries or dependencies.

### Test Requirements

1. Verify semantic Header, primary navigation, Main Content and Footer exist for authenticated USER and ADMIN.
2. Verify Header branding, default avatar/current available avatar behavior and exact `display_name`.
3. Verify ADMIN context is non-interactive and no `/admin` link exists.
4. Verify navigation has only `/dashboard` and exposes active state.
5. Verify route content renders inside the shared shell and Guest never sees authenticated layout content.
6. At desktop viewport, verify Sidebar is persistently available and mobile drawer behavior is not presented as the navigation mode.
7. At tablet/mobile viewports, verify drawer starts closed and can open/close via approved mouse/touch and keyboard paths.
8. Verify drawer `aria-expanded`/`aria-controls`, closed-state focus exclusion, `Escape` dismissal and focus return.
9. Verify Logout remains in Sidebar/drawer and existing pending, success and failure flows remain correct.
10. Verify Footer exact text, no links and compact mobile visibility.
11. Verify no bottom navigation, placeholder links or unintended horizontal overflow.
12. Preserve existing 375×812, 768×1024 and 1366×768 responsive checks.
13. Run full frontend Authentication tests, lint and production build.
14. Report every command as PASS, FAIL or NOT RUN; do not infer success.

### Acceptance Criteria

- **T17-AC-01 / SPEC AC-01–AC-10:** Focused browser tests cover the shared regions, identity, route rendering, navigation, drawer, Logout and accessibility contracts.
- **T17-AC-02 / SPEC AC-03:** Guest/protected-route regression proves authenticated layout does not flash or render for Guest.
- **T17-AC-03 / SPEC AC-11, AC-17:** Tests prove no business content, placeholder destination or future menu item was added.
- **T17-AC-04 / SPEC AC-13:** Existing Login/Register, route-guard, Auth state, Logout and session-expiration regressions pass.
- **T17-AC-05 / SPEC AC-14–AC-16:** Responsive matrix proves persistent desktop Sidebar, tablet/mobile drawer, no bottom navigation, no overflow and compact Footer behavior.
- **T17-AC-06:** Frontend lint passes.
- **T17-AC-07:** Frontend production build passes.
- **T17-AC-08:** Diff/scope review shows no backend, API, database, deployment, dependency or unrelated business-feature change.

### Verification Commands / Evidence

Use existing project scripts and tooling:

- Focused App Layout Playwright test command targeting `app-layout.spec.js`.
- `npm run test:auth` from `frontend/` for the full frontend Authentication suite.
- `npm run lint` from `frontend/`.
- `npm run build` from `frontend/`.
- `git diff --check`.
- Final changed-file and secret scan.

Record exact command outputs/counts during TEST. A command that cannot run must be reported as `NOT RUN` with the reason.

### Traceability

- PLAN: Sections 9, 10, 12 and 13; implementation order steps 7–9.
- SPEC: AC-01 through AC-17.

## TASK-018 — Final Review and Documentation/Status Closure

### Objective

Review the completed implementation and test evidence against the approved SPEC/PLAN/TASK scope, resolve any findings through the required workflow, and update documentation/status only after the implementation earns final approval.

### Dependencies

- TASK-016 implementation complete.
- TASK-017 formal test evidence complete and passing for required checks.

### Files / Modules

Review scope:

- Actual TASK-016/TASK-017 changed files.
- Approved SPEC, PLAN and this TASK document.
- Relevant Authentication regression evidence.

Documentation eligible for closure updates only after approval:

- `docs/FEATURE_STATUS.md`
- This TASK document or other workflow evidence location if the repository records completed TEST/REVIEW results here.

Expected unchanged documentation:

- `docs/ARCHITECTURE.md`
- `docs/API_SPEC.md`
- `docs/DATABASE.md`
- `docs/PROJECT_OVERVIEW.md`

### In Scope

- Formal scope, architecture, accessibility, security, regression and code-quality review.
- AC-01 through AC-17 traceability against implementation and test evidence.
- Confirmation that one `AuthenticatedShell` remains and no duplicate Auth/navigation infrastructure exists.
- Confirmation that no new route, placeholder item, dependency or business feature was introduced.
- Findings classified and returned to IMPLEMENT → TEST → REVIEW when changes are required.
- Update App Layout workflow evidence and feature status only after TEST passes and REVIEW returns `APPROVE`.

### Out of Scope

- Marking the feature `DONE` before formal approval.
- Editing unrelated feature status or historical Authentication evidence.
- Architecture documentation changes without an approved PLAN change.
- Topic or any next-feature work.
- Commit, push, merge or deployment unless separately requested after closure.

### Review and Closure Requirements

1. Compare actual diff against approved SPEC, PLAN and TASK files.
2. Verify all required TEST evidence is present and truthful.
3. Review single-shell reuse, route preservation, Authentication boundaries and absence of scope creep.
4. Review drawer accessibility, responsive overflow protection and Footer/navigation contracts.
5. Classify findings using the repository review workflow.
6. If findings require code changes, return to TASK-016 implementation scope, rerun TASK-017 verification and review again.
7. Only after verdict `APPROVE`, update `docs/FEATURE_STATUS.md` from the actual pre-review state to `DONE` and record relevant implementation/test/review evidence.
8. Keep User Dashboard, Topic and all unrelated feature statuses unchanged.
9. Confirm `docs/ARCHITECTURE.md` remains accurate; do not edit it unless the approved PLAN is formally changed.

### Acceptance Criteria

- **T18-AC-01:** Every SPEC AC-01 through AC-17 has implementation and verification evidence.
- **T18-AC-02:** No unresolved BLOCKER/HIGH finding remains for approval.
- **T18-AC-03:** Final review confirms scope, architecture, accessibility, security and Authentication regression expectations.
- **T18-AC-04:** App Layout is marked `DONE` only after IMPLEMENT complete, required TEST PASS and REVIEW APPROVE.
- **T18-AC-05:** Dashboard, Topic, Authentication history and unrelated feature statuses are unchanged.
- **T18-AC-06:** Documentation reflects actual verified state without claiming unexecuted tests or unimplemented behavior.

### Verification

- Produce the formal TEST report/evidence from TASK-017.
- Produce a REVIEW verdict: `APPROVE`, `CHANGES_REQUIRED` or `BLOCKED`.
- Inspect final documentation diff and feature-status transition.
- Run `git diff --check` and final secret/scope scan after any documentation closure update.
- Confirm working tree contains only approved feature/workflow changes.

### Traceability

- PLAN: Sections 12–17 and implementation order steps 9–11.
- SPEC: AC-01 through AC-17 and documentation follow-up requirements.
- AGENTS.md: TEST → REVIEW → APPROVE → FEATURE_STATUS `DONE` gate.

## 6. Cross-Task Scope Guardrails

The complete task set must not:

- Create another authenticated shell or Auth provider.
- Change the current route table or add placeholder routes/menu items.
- Implement Dashboard business content, Topic or another product feature.
- Implement Landing Page/public Footer.
- Change backend, API, database, Authentication or authorization architecture.
- Add dependencies.
- Freeze visual styling beyond the approved functional, responsive and accessibility contract.
- Extract components merely to increase abstraction.
- Update `docs/ARCHITECTURE.md` unless an approved PLAN change later requires it.
- Mark the feature `DONE` before TEST and REVIEW approval.

## 7. SPEC / PLAN Traceability Matrix

| Requirement | TASK-016 | TASK-017 | TASK-018 |
|---|---:|---:|---:|
| AC-01 Shared four-region layout | Implement | Verify | Review |
| AC-02 Reuse one `AuthenticatedShell` | Implement | Scope-check | Review |
| AC-03 Guest protection | Preserve | Regress | Review |
| AC-04 Nested `<Outlet />` | Preserve | Verify | Review |
| AC-05 Shared layout and active navigation | Implement | Verify | Review |
| AC-06 Only approved destinations | Implement | Verify absence | Review |
| AC-07 Header identity/Admin context | Implement | Verify | Review |
| AC-08 Logout/session behavior | Preserve | Regress | Review |
| AC-09 Logout in Sidebar/navigation | Implement | Verify | Review |
| AC-10 Accessibility contract | Implement | Verify | Review |
| AC-11 No unrelated business feature | Guard | Scope-check | Review |
| AC-12 No backend/API/database/Auth change | Guard | Diff-check | Review |
| AC-13 Auth regressions | Preserve | Full regression | Review |
| AC-14 Desktop Sidebar/mobile drawer | Implement | Viewport verification | Review |
| AC-15 No overflow/clipping | Implement | Viewport verification | Review |
| AC-16 Exact compact Footer | Implement | Verify | Review |
| AC-17 No placeholder route/menu item | Guard | Verify absence | Review |

PLAN coverage:

- Existing-code reuse and file scope → TASK-016.
- Routing, Authentication, layout, drawer, accessibility and styling → TASK-016.
- Focused tests, regressions, lint/build and scope checks → TASK-017.
- Documentation impact, final review and truthful status transition → TASK-018.

## 8. Approval Gate

```text
TASK STATUS: APPROVED
HUMAN APPROVAL: APPROVED ON 2026-09-20
NEXT ALLOWED STAGE: IMPLEMENT TASK-016
IMPLEMENTATION AUTHORIZED: YES — TASK-016 ONLY
```
