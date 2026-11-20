# SPEC: USER UI Polish — Quiz Scroll, Register Containment, and Native Select Consistency

**Feature status:** Existing affected features remain `DONE`; this document defines a focused corrective workstream.

**SPEC status:** `HUMAN APPROVED — amended at TASK-167 STOP A`

## 1. Objective

Correct three bounded USER-facing presentation defects without changing product behavior:

1. remove the Quiz page's unnecessary nested vertical scroll region so expanding result and character feedback participates in the existing authenticated page flow;
2. keep expanded inline Register validation and the bottom **Đăng nhập** handoff visible or naturally reachable without clipping, while presenting global/API/system failures through an accessible toast;
3. give current USER-facing native `<select>` controls one consistent ELVocab presentation while preserving native semantics and accessibility.

This is a UI bugfix and polish batch over completed features. It does not reopen their business, API, authorization, persistence, or routing contracts.

## 2. Actors

- **Guest:** Receives the Register error-state containment correction.
- **USER:** Receives the Quiz scrolling correction and consistent native select presentation across Discovery, Learning Progress, My Sets, Personal Set metadata, and private Vocabulary editing.
- **ADMIN:** No ADMIN redesign or ADMIN-only form normalization is authorized. A shared primitive may remain technically compatible with shared code, but this SPEC requires no ADMIN presentation change.

## 3. Current-State Audit and Root Causes

### 3.1 Quiz result / feedback scrolling

- `frontend/src/quiz/quiz-foundation-page.jsx` assigns the Quiz root `h-full overflow-y-auto` through `PAGE_CLASSES` for selection, loading/error, active, and completion states.
- Quiz routes bypass `.authenticated-main` through the focus-route branch in `frontend/src/auth/ui/authenticated-shell.jsx`. The shared `.learning-focus-shell` is viewport-height and `overflow-hidden`, while the Quiz root is `h-full overflow-y-auto`.
- The Quiz root is therefore the current internal scroll owner. Correct/incorrect feedback, long character feedback, contextual prompts, and the next action expand inside that nested panel instead of a route-scoped outer shell/page owner.
- TASK-167 evidence proved that removing the Quiz root overflow alone would clip content. HUMAN therefore authorizes a narrowly scoped Quiz outer-shell scroll owner; Flashcard/Learning focus-shell behavior must remain unchanged.
- Existing Quiz responsive coverage verifies horizontal overflow, touch targets, focus, feedback, and completion, but does not assert that the Quiz root is not an independent vertical scroller.

### 3.2 Register error-state containment

- `frontend/src/auth/ui/auth-shell.jsx` uses absolutely positioned half-width desktop panels inside a container whose height is established by `min-h-[min(600px,calc(100vh-4rem))]` and `overflow-hidden`.
- Because the desktop form panel is absolute, expanded form content does not increase the containing panel's layout height. The Register form already contains four fields, descriptive content, submit action, and the bottom Login handoff.
- Inserting client-validation content can exceed the available desktop panel height. The ancestor's clipping then makes the bottom handoff partially or completely unreachable, especially at common low-height desktop viewports.
- At widths up to 900px the panels return to relative flow, so the risk is primarily the desktop absolute-panel transition architecture rather than Register validation or API behavior.
- Existing Auth responsive tests validate the normal Login/Register forms at mobile, tablet, and desktop sizes. They do not repeat viewport containment assertions with expanded inline field errors or cover the approved global-error toast behavior.
- The repository has an Auth-specific `SuccessToast`, but no reusable general notification system. HUMAN approves a hybrid Register error strategy: field-specific client validation remains inline, while global/API/system failures use a small reusable in-app toast notification without a new dependency.

### 3.3 USER-facing native selects

The audit found these active USER-facing native selects:

1. Discovery CEFR filter — `frontend/src/topics/topic-list-page.jsx`;
2. Learning Progress status filter — `frontend/src/learning-progress/learning-progress-page.jsx`;
3. My Sets sorting — `frontend/src/vocabulary-sets/my-vocabulary-sets-page.jsx`;
4. Personal Set CEFR — shared `frontend/src/vocabulary-sets/vocabulary-set-metadata-controls.jsx`;
5. private Vocabulary part-of-speech — `frontend/src/vocabulary-sets/private-vocabulary-editor.jsx`.

They use separate padding, height, border, focus, font-weight, and disabled-state utilities. Browser-native indicators also reserve space differently, so selected text can sit inconsistently or too close to the arrow.

The Topic selector in `AdminVocabularySetEditor`, although located in `my-vocabulary-sets-page.jsx`, is ADMIN-only and is not a required surface in this USER batch. Other ADMIN Vocabulary selects are likewise out of scope.

No existing shared USER native-select presentation primitive was found. Native `<select>` behavior itself is correct and remains the preferred semantic control; no custom listbox is justified.

## 4. Scope

### 4.1 In Scope

- Quiz selection, loading/error, active-question, accepted-feedback, and completion page height/overflow behavior.
- Correct and incorrect Quiz results, long per-character feedback, contextual prompts, both approved Quiz types, and the existing authenticated shell scroll relationship.
- Register normal, inline client-validation, global/API-error toast, pending, and successful handoff presentation.
- Desktop Login/Register sliding-panel compatibility where affected by content-safe sizing.
- One reusable native-select presentation pattern for the five audited USER surfaces.
- Responsive, keyboard, focus-visible, disabled, screen-reader, reduced-motion, and no-horizontal-overflow regressions for the affected surfaces.
- Focused tests and documentation synchronization required for these corrections.

### 4.2 Out of Scope

- Speaking Practice, speech recognition, or pronunciation evaluation.
- Any backend, API, schema, migration, storage, session, authorization, or validation-contract change.
- New routes or route removals.
- A third Quiz type, Quiz business-logic change, broad Quiz redesign, or persistent Quiz results.
- Authentication architecture, error-message, registration-validation, or broad Auth visual redesign.
- Custom listbox/combobox behavior, searchable selects, multi-selects, or third-party dropdown dependencies.
- ADMIN redesign or normalization of ADMIN-only selects.
- Discovery ranking, filtering semantics, request behavior, or pagination changes.
- Profile Management, gamification, Dashboard expansion, or unrelated visual cleanup.

## 5. UX Behavior

### 5.1 Quiz

1. The Quiz page root must not establish an independent vertical scrolling panel inside the authenticated main content area.
2. When feedback increases content height, the existing page/shell scroll owner must expose the full prompt, feedback, character details, and next action naturally.
3. Content must not be clipped or hidden to remove a scrollbar.
4. Type selection, question loading, answer entry/tile selection, accepted feedback, retry/conflict, restart, completion, and Back behavior remain unchanged.
5. Focus movement after keyboard submission and completion remains deterministic and may cause the existing outer scroll owner to reveal the focused target.

### 5.2 Register

1. Register content must remain in normal document/layout flow or use another content-safe layout boundary that cannot clip expanded errors.
2. The **Đăng nhập** handoff remains visible in normal desktop state and remains naturally reachable in every supported error/pending state.
3. If content genuinely exceeds the viewport, the page may scroll naturally; the form must not become an awkward independent nested scroll region.
4. The desktop panel transition may be retained, but it must not depend on a brittle fixed content height.
5. Field-specific validation errors remain inline and programmatically associated with their fields.
6. Global/API/system failures use a non-focus-stealing, responsive toast with an appropriate live region, readable duration, keyboard-safe dismissal where appropriate, and protection against duplicate toast spam from repeated failed submissions.
7. Moving global errors to a toast does not replace the content-safe Auth layout correction and does not change validation, safe error mapping, pending locking, delayed success handoff, Login behavior, or motion-reduction behavior.

### 5.3 Native selects

1. Every audited USER select remains a labelled native `<select>` with its existing options, value, events, validation, and disabled behavior.
2. A shared presentation pattern normalizes control height, border, radius, background, typography, horizontal padding, focus-visible treatment, and disabled state.
3. A Lucide `ChevronDown` is decorative, `aria-hidden`, pointer-transparent, and positioned consistently at the trailing edge.
4. The native indicator may be hidden only when the decorative replacement is present. Sufficient trailing padding must prevent selected text from overlapping or crowding the chevron.
5. Native keyboard navigation, touch behavior, operating-system option popup, form semantics, accessible name, and screen-reader announcement remain intact.
6. The pattern must not cause layout shift, horizontal overflow, or loss of usable width on mobile.

## 6. Responsive Behavior

- **Mobile:** Quiz feedback wraps without horizontal overflow and uses natural page scrolling. Register fields, errors, submit action, and Login handoff remain reachable. Select text and chevrons remain contained at 375px and 390px widths.
- **Tablet:** The same behavior holds at representative 768px and 820px widths, including the Auth breakpoint transition and select controls inside responsive rows/dialogs.
- **Desktop:** At 1366×768 and wider layouts, Quiz has one intended vertical scroll owner, normal Register content fits stably, expanded errors remain reachable, and select geometry is visually consistent.
- Long translated text, long Set names, long selected labels, Quiz character feedback, browser zoom, and reduced-motion preferences must not introduce horizontal overflow or clipping.

## 7. Accessibility Requirements

- Preserve all semantic headings, form labels, native controls, alerts, `aria-live` announcements, result focus targets, and Back/restart dialog behavior.
- Removing Quiz's nested scroller must not break focus revelation when feedback or completion receives programmatic focus.
- Register field errors remain programmatically associated and announced inline. Global/API/system errors are announced through an appropriate toast live region without stealing focus.
- The Login handoff remains a keyboard-reachable native button with an unchanged accessible name.
- Native selects retain their current accessible names, option semantics, keyboard operation, touch behavior, and disabled exposure.
- Decorative chevrons must not become focusable or be announced.
- Focus-visible indication must remain clear without relying on color alone where an outline/ring is already part of the design language.
- No correction may introduce a keyboard trap or require pointer-only interaction.

## 8. Regression Constraints

- Preserve `VI_TO_ENGLISH` and `UNSCRAMBLE_WORD`, authoritative answer submission, result content, completion totals, transient session state, retry/idempotency, and Learning Progress behavior.
- Preserve Quiz focus announcements, character-feedback non-color semantics, restart dialog, public/owned Set return routing, and reduced-motion behavior.
- Preserve registration request shape, validation rules, error sanitization, pending deduplication, success handoff, session behavior, and Login layout/behavior.
- Preserve Discovery client-only CEFR filtering, page reset, Featured independence, nine-item pagination, and zero-request filter/page behavior.
- Preserve Learning Progress filter requests, pending locking, page reset, and focus restoration.
- Preserve My Sets sorting and responsive toolbar behavior.
- Preserve optional Personal Set CEFR semantics and cover workflows.
- Preserve private Vocabulary part-of-speech values, multi-Meaning/Example behavior, edit preservation, and pending/error behavior.
- Add no production dependency and make no backend/database/API change.

## 9. Data and API Requirements

- No data model, persistence, migration, fixture contract, or backend behavior changes.
- No API endpoint, request, response, validation, authentication, or authorization changes.
- Existing selected values and Quiz/Auth state remain the only data used by these presentation corrections.

## 10. Test Strategy

### 10.1 Quiz

- Extend focused Quiz browser coverage for correct and incorrect feedback with long prompt/answer/character content.
- Assert the Quiz root is not an independent vertical scroll container and the outer page/shell flow can reach the next action.
- Cover both Quiz types, completion, keyboard-result focus, Back routing, desktop/tablet/mobile widths, and no horizontal overflow.
- Retain focused Quiz unit/service and route-navigation regressions where presentation changes touch their boundary.

### 10.2 Register

- Extend Auth responsive browser coverage with expanded inline field-validation and global/API-error toast states at mobile, tablet, and 1366×768 desktop.
- Assert the Login handoff is visible or naturally reachable, there is no clipped content or horizontal overflow, and no nested form scroller is introduced.
- Retain validation, safe-error, pending deduplication, success handoff, keyboard focus, reduced-motion, and panel-transition coverage; verify repeated failed submissions do not create duplicate toast spam.

### 10.3 Native selects

- Exercise all five audited USER selects using their existing semantic locators and native `selectOption` behavior.
- Assert consistent control/chevron containment, adequate text clearance, focus-visible and disabled states, and no horizontal overflow across responsive widths.
- Retain each surface's behavior assertions: Discovery local filtering/no requests, Learning Progress filtering/pagination, My Sets sorting, optional Set CEFR, and private Vocabulary part of speech.

### 10.4 Closure checks

- Focused frontend unit/component tests where affected.
- Focused mocked Playwright specs for Quiz, Auth, Discovery, Learning Progress, My Sets, Personal Set metadata, and private Vocabulary editing.
- Production frontend build.
- Touched-file ESLint.
- `git diff --check`.
- A real-stack rerun is not required unless implementation changes behavior beyond the presentation boundary or focused evidence reveals a real contract regression.

## 11. Acceptance Criteria

- **AC-01:** Quiz selection, loading/error, active, feedback, and completion roots do not create a nested vertical scroll region inside the authenticated main content area.
- **AC-02:** Long correct/incorrect feedback and character details remain fully reachable through the intended page/shell scroll owner with no clipping or horizontal overflow.
- **AC-03:** Both Quiz types, answer feedback, completion, keyboard focus/announcements, restart, and public/owned Back routing retain their approved behavior.
- **AC-04:** Normal Register content remains visually stable at approved mobile, tablet, and desktop viewports.
- **AC-05:** Expanded inline field errors do not clip the Register form or make the bottom **Đăng nhập** handoff unreachable.
- **AC-06:** Register containment uses natural content/page flow when overflow is genuinely necessary and introduces no independent nested form scroller.
- **AC-07:** Field-specific validation remains inline; global/API/system errors use an accessible, non-focus-stealing, duplicate-safe toast; registration request behavior, safe error semantics, pending deduplication, success toast/handoff, and Login behavior remain unchanged.
- **AC-08:** Discovery CEFR, Learning Progress status, My Sets sort, Personal Set CEFR, and private Vocabulary part-of-speech use one consistent native-select visual contract.
- **AC-09:** Each normalized select retains its exact options, value, events, label, native keyboard/touch/screen-reader behavior, and disabled semantics.
- **AC-10:** Each normalized select shows one decorative Lucide chevron, has sufficient trailing text clearance, and has no native/custom double-arrow presentation.
- **AC-11:** The corrections produce no layout shift, clipping, or horizontal overflow at representative 375, 390, 768, 820, 1366×768, and wider desktop viewports.
- **AC-12:** Focus-visible, alert, announcement, reduced-motion, and keyboard requirements pass focused accessibility verification.
- **AC-13:** Existing Quiz, Auth, Discovery, Learning Progress, My Sets, Personal Set metadata, and private Vocabulary behavior regressions remain green.
- **AC-14:** No backend, API, schema, migration, route, role, dependency, product behavior, or ADMIN redesign is introduced.
- **AC-15:** Production build, touched-file ESLint, and `git diff --check` pass.

## 12. Exact Affected Surfaces and Files Discovered

### Production surfaces

- `frontend/src/quiz/quiz-foundation-page.jsx` — Quiz root sizing/overflow and feedback/completion presentation.
- `frontend/src/auth/ui/authenticated-shell.jsx` — existing outer scroll-owner boundary to preserve; change only if implementation evidence proves it necessary.
- `frontend/src/auth/ui/auth-shell.jsx` — desktop absolute panel and clipping boundary.
- `frontend/src/auth/ui/register-form.jsx` — Register error/pending/content surface to preserve.
- `frontend/src/auth/ui/success-toast.jsx` and/or a small adjacent Auth notification primitive — reuse the existing toast presentation foundation while removing its hard-coded success-only limitation for global Register errors.
- `frontend/src/auth/ui/login-form.jsx` — shared form frame and Login handoff presentation.
- `frontend/src/topics/topic-list-page.jsx` — Discovery CEFR select.
- `frontend/src/learning-progress/learning-progress-page.jsx` — Learning Progress status select.
- `frontend/src/vocabulary-sets/my-vocabulary-sets-page.jsx` — My Sets sort select and Personal Set CEFR consumer.
- `frontend/src/vocabulary-sets/vocabulary-set-metadata-controls.jsx` — shared Set CEFR select.
- `frontend/src/vocabulary-sets/private-vocabulary-editor.jsx` — private Vocabulary part-of-speech select.

The exact shared native-select component/module location is a PLAN decision. The implementation should reuse one small presentation primitive instead of duplicating page-specific arrow markup.

### Focused test surfaces

- `frontend/e2e/auth/quiz-flow.spec.js`
- `frontend/e2e/auth/quiz-focus.spec.js`
- `frontend/test/quiz-presentation.test.js`
- `frontend/test/quiz-navigation.test.js`
- `frontend/e2e/auth/auth-forms.spec.js`
- `frontend/e2e/auth/auth-responsive.spec.js`
- `frontend/e2e/auth/discovery-v1.spec.js`
- `frontend/e2e/auth/learning-progress.spec.js`
- `frontend/e2e/auth/my-vocabulary-sets-foundation.spec.js`
- `frontend/e2e/auth/my-vocabulary-set-modal.spec.js`
- `frontend/e2e/auth/my-vocabulary-set-detail.spec.js`

## 13. Risks and Compatibility Notes

- Removing the Quiz root scroller without preserving the authenticated shell's desktop scroll owner could make content unreachable; focused computed-overflow and long-content checks are mandatory.
- Altering the authenticated shell globally would carry broader regression risk. The authorized change must be route-scoped to Quiz and leave Flashcard/Learning focus-shell behavior unchanged.
- The Auth desktop sliding animation depends on absolute positioning and clipping. A content-safe correction must preserve normal transition behavior or deliberately constrain any adjustment to the Register content boundary.
- Toast lifetime and repeated submission handling must avoid missed announcements and duplicate stacks without stealing focus or changing the registration request contract.
- CSS `appearance` behavior differs across browsers. A decorative chevron requires enough reserved inline space and verification that no double indicator remains in the supported browser baseline.
- Native option popups remain browser/OS controlled and are not expected to become visually identical. This work normalizes the closed control, not the native popup menu.
- Shared Set metadata controls are used by USER and ADMIN forms. PLAN must avoid accidental ADMIN redesign while preventing duplicate USER-only implementations.

## 14. Open Questions

None. The approved direction is sufficiently bounded for PLAN after HUMAN approval of this SPEC.
