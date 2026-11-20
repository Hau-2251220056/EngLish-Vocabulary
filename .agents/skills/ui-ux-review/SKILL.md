---
name: ui-ux-review
description: Review changed ELVocab UI flows for objective interaction, responsive, accessibility, and visual-consistency regressions before HUMAN visual approval. Use Focused mode by default; use Full mode only when explicitly requested.
---

# UI/UX Review Skill

## Purpose

Review implemented UI changes against approved requirements, `docs/UI_UX_SPEC.md`, established ELVocab patterns, and observable browser evidence. This is a UI quality gate, not a product redesign or a replacement for the separate TEST and REVIEW stages.

## Modes

### Focused — default

Review only changed routes, components, states, user journeys, and directly related regressions. Determine this boundary from the approved task and actual diff.

### Full — explicit request only

Review the wider application surface named by the HUMAN. Never expand a small change into a full-site audit automatically.

State the selected mode and scope before reviewing.

## Safety and authority

- Prefer existing mocked Playwright fixtures or an explicitly isolated disposable environment.
- Never run automated database-writing browser flows against the protected Preview TEST database.
- Do not change backend logic, product requirements, or an approved visual direction during this review.
- Fix objective defects only when the current request authorizes implementation. Otherwise report findings and return to IMPLEMENT.
- Do not claim browser, screenshot, or viewport coverage that was not executed.

## Workflow

1. Read `AGENTS.md`, relevant approved UI requirements, feature status, and the actual diff.
2. Identify changed screens, dependent shared components, roles, states, and user journeys.
3. Inspect comparable ELVocab screens and reuse established components, tokens, breakpoints, and interaction conventions.
4. Build a proportional review matrix covering the relevant areas below.
5. Exercise the matrix with existing browser infrastructure where available.
6. Capture screenshots for meaningful viewport/state combinations, not every permutation.
7. Record objective evidence for each finding, fix authorized in-scope defects, and rerun affected checks.
8. Report the mode, scope, evidence, findings, fixes, limitations, and remaining HUMAN review items.

## Review areas

### Interactions

- Enabled clickable controls use appropriate pointer cursors; disabled controls do not imply interactivity.
- Hover, pressed, focus-visible, disabled, loading, pending, success, and error states remain distinct.
- Buttons, links, form controls, menus, and dialogs use correct semantics and accessible names.
- Pending actions prevent accidental duplicate submissions.
- Dropdowns, menus, modals, drawers, and bottom sheets handle open/close, Escape, backdrop interaction, focus containment, and focus restoration where applicable.

### Responsive layout

Test relevant content at 320, 375, 768, 1024, and 1440 CSS pixels, plus landscape and widths immediately around affected breakpoints. Also consider narrow content containers caused by sidebars and effective 200% zoom.

Verify:

- long Vietnamese labels and realistic long content wrap safely;
- controls are not clipped and the page has no unintended horizontal overflow;
- layout responds to available content width rather than only common device widths;
- touch targets are at least 44px where ELVocab requires interactive touch targets;
- scrolling remains local to the intended container when applicable.

Use fewer viewports only when the changed surface cannot be affected by the omitted dimensions, and report that choice.

### Accessibility

- Complete the flow using keyboard-only interaction.
- Check visible focus, logical focus order, and focus transitions after state changes.
- Verify roles, labels, grouped controls, error/status announcements, and non-color state cues.
- Check reduced-motion behavior for animated or transitioning UI.
- For dialogs and menus, verify initial focus, focus containment, Escape, close behavior, and focus return.

### Visual consistency

- Reuse ELVocab design tokens and established components.
- Compare width, density, spacing, padding, typography, and hierarchy with relevant existing screens.
- Inspect loading, empty, error, success, pending, and populated states that the changed flow supports.
- Treat clipping, broken wrapping, inconsistent control states, and disproportionate density as objective issues.
- Do not redesign a HUMAN-approved interface based on subjective preference.

## Browser evidence

Use existing Playwright configuration, fixtures, and selectors. Prefer semantic locators; use stable test-specific selectors only when semantics cannot identify the intended element.

When practical:

- exercise the real interaction sequence with mocked APIs;
- verify computed cursor, transition, visibility, size, and overflow properties;
- assert `document.documentElement.scrollWidth <= window.innerWidth` for page-overflow-sensitive states;
- measure touch targets and container bounds;
- capture screenshots around breakpoint transitions and important result/error states.

If browser execution or screenshots are unavailable, mark those checks `NOT RUN` and explain the limitation.

## Findings

Classify each finding:

- **BLOCKER** — prevents safe use, access, or required task completion.
- **MAJOR** — significant accessibility, interaction, responsive, or approved-flow regression.
- **MINOR** — objective localized issue that should be corrected but does not block the core flow.

For each finding provide location, affected state/viewport, reproducible evidence, impact, and recommended action. Rerun the affected interaction and regression checks after an authorized correction.

## Output

Report:

- Mode and reviewed scope.
- Routes, roles, states, viewports, containers, zoom/reduced-motion settings, and interactions exercised.
- Screenshot or artifact paths.
- PASS / FAIL / NOT RUN evidence by review area.
- Severity-ranked findings and authorized fixes.
- Automated checks executed and exact results.
- Remaining limitations and HUMAN visual-review items.

UI/UX Review does not replace TEST or REVIEW and does not by itself mark a feature DONE.
