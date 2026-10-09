# PLAN: USER UI Polish — Quiz Scroll, Register Containment, and Native Select Consistency

**Approved input:** `docs/specs/USER_UI_POLISH_SPEC.md`

**PLAN status:** `HUMAN APPROVED — amended at TASK-167 STOP A`

## 1. Summary

Implement the three approved USER presentation corrections entirely in the frontend:

1. make a narrowly scoped Quiz focus shell the outer vertical scroll owner and make the Quiz root content-driven, without changing Flashcard/Learning focus-shell behavior;
2. replace the Auth desktop panels' absolute-positioned height isolation with an overlapping/translated grid arrangement whose content contributes to container height, preserve inline field validation, and present global/API/system Register errors through a small reusable in-app toast;
3. add one small native-select presentation component with a decorative Lucide chevron and migrate exactly the five approved USER surfaces, using an explicit USER presentation option at the shared Set CEFR boundary so ADMIN rendering is not migrated.

No backend, API, database, route, authentication behavior, product logic, dependency, or ADMIN redesign is required.

## 2. Affected Areas

- **Database:** No change.
- **Backend:** No change.
- **API:** No change.
- **Authentication/authorization:** Existing contracts remain unchanged; only Auth page layout is affected.
- **Frontend:** Quiz root and route-scoped focus-shell layout, Auth shell layout, a small reusable Auth notification primitive, one reusable native-select component, and five USER select call sites.
- **Tests:** Focused Quiz, Auth, Discovery, Learning Progress, My Sets, Personal Set metadata, and private Vocabulary browser/unit coverage.
- **Documentation:** Keep the approved SPEC unchanged; record PLAN/TASK/evidence through the workflow and synchronize the relevant UI/UX corrective note at implementation closure if required.
- **Dependencies:** No package installation or manifest/lockfile change.

## 3. Existing Code to Reuse

- `frontend/src/auth/ui/authenticated-shell.jsx` — add only the authorized Quiz-scoped outer scroll ownership; preserve Flashcard/Learning focus-shell behavior.
- `frontend/src/quiz/quiz-foundation-page.jsx` — retain all current Quiz state, feedback, focus, restart, completion, and navigation components; change only the shared root layout classes.
- `frontend/src/auth/ui/auth-shell.jsx` — retain the two-panel structure, mode-driven transforms, responsive breakpoint, and visual clipping needed for horizontal transitions while changing how panel content contributes to height.
- `frontend/src/auth/ui/login-form.jsx` — retain `AuthFormFrame` and `ModeSwitch`; adjust shared form-frame sizing/spacing only if focused viewport evidence requires it.
- `frontend/src/auth/ui/register-form.jsx` — retain field order, inline field validation, submit state, and Login handoff; route global/API/system failures to the reusable notification.
- `frontend/src/auth/ui/success-toast.jsx` — existing Auth-specific success presentation to reuse/generalize where practical; it is not currently a reusable general toast system.
- `frontend/src/components/` — existing location for small reusable UI primitives; place the native-select presentation component here rather than duplicating markup across feature folders.
- Existing labels and native `<select>` values/events in Discovery, Learning Progress, My Sets, Personal Set metadata, and private Vocabulary editing.
- Existing semantic Playwright locators (`getByRole("combobox")`, labels, result headings, alerts, and actions) to prove behavior remains native and accessible.

## 4. Database, Backend, and API Plan

No database, migration, backend route, middleware, controller, service, repository, request, response, validation, session, or authorization change is planned.

If implementation appears to require any such change, stop and return for HUMAN review because it would exceed the approved SPEC.

## 5. Frontend Plan

### 5.1 Quiz layout ownership

**Primary files:**

- `frontend/src/quiz/quiz-foundation-page.jsx`
- `frontend/src/auth/ui/authenticated-shell.jsx`

1. Remove `h-full` and `overflow-y-auto` from the shared Quiz `PAGE_CLASSES` root.
2. Keep the Quiz root content-driven with full available width and, if necessary for short states, a non-clipping `min-h-full`/equivalent minimum-height rather than a fixed height.
3. Do not add `overflow-hidden`, a fixed content height, a feedback-specific scroller, or an additional wrapper that can become a scroll owner.
4. Preserve the existing `max-w-[860px]`, padding, typography, cards, feedback structure, and completion structure.

**Vertical scroll ownership after correction:**

- Quiz continues using the focus-route shell, but that shell receives a Quiz-only content-safe vertical-scroll variant and becomes the single outer owner when content exceeds the viewport.
- Flashcard/Learning retain their current fixed focus-shell overflow behavior unchanged.
- `.quiz-page` remains content-sized/overflow-visible at every breakpoint and never owns vertical scrolling.

When result or character feedback expands, normal layout increases the Quiz root height. Keyboard-directed focus on the result/completion heading relies on standard browser scrolling of the existing outer owner, so the focused target and subsequent action remain reachable.

No change is planned to:

- `VI_TO_ENGLISH` or `UNSCRAMBLE_WORD` selection/submission;
- result data or per-character feedback;
- live announcements or result/completion focus refs;
- restart behavior;
- transient session storage;
- public/owned Set Back resolution.

TASK-167 supplied the required evidence and HUMAN approved this route-scoped shell boundary. Do not turn it into a global authenticated-shell or Flashcard/Learning behavior change.

### 5.2 Register content-safe containment

**Primary files:**

- `frontend/src/auth/ui/auth-shell.jsx`
- `frontend/src/auth/ui/login-form.jsx` only if shared form-frame sizing/spacing requires a narrow adjustment
- `frontend/src/auth/ui/register-form.jsx`
- `frontend/src/auth/ui/success-toast.jsx` and/or one small adjacent reusable Auth notification component

**Desktop strategy:**

1. Replace the inner desktop container's absolute-panel layout with a two-column CSS grid/equivalent normal-flow layout.
2. Keep the visual panel in column 1 and the form panel in column 2. Each panel contributes its intrinsic height to the shared grid row.
3. Preserve the existing mode transforms:
   - Login: visual remains left, form remains right;
   - Register: visual translates one column right and form translates one column left.
4. Keep horizontal transition clipping at the outer rounded card boundary, but ensure the grid row grows to the taller panel/content. `overflow-hidden` may remain only for the rounded horizontal animation boundary after intrinsic height ownership is fixed; it must no longer clip vertical form content.
5. Retain the current normal-state minimum height for visual balance, but do not impose a fixed/max height that prevents error-expanded content from increasing the card/page height.
6. The outer `.auth-stage` remains natural document flow with page padding. If expanded errors exceed viewport height, the document scrolls; neither the form panel nor form becomes independently scrollable.

**Tablet/mobile strategy:**

- Preserve the existing `max-[900px]` stacked layout with panels in normal flow and transforms disabled.
- Ensure any desktop grid declarations are explicitly neutralized at the existing breakpoint so there is no overlapping content, fixed height, or horizontal overflow.
- Keep current responsive padding and full-width form behavior unless focused evidence requires a minimal spacing reduction.

**State preservation:**

- Normal Login/Register: same panel content, order, styling, transition, and handoff.
- Client validation errors: field messages expand the form/card naturally.
- Global/API/system errors: replace the persistent form-level block with a reusable toast that uses an appropriate live region, does not steal focus, remains readable long enough, supports keyboard-safe dismissal where appropriate, is responsive, and cannot stack duplicate messages from repeated failed submissions.
- Loading/submitting: existing disabled/pending state and deduplication remain unchanged.
- Success: existing toast and delayed navigation to Login remain unchanged.

Field-specific errors must not move into the toast. No third-party toast dependency, Auth service, schema, error-message mapping, validation rule, or authentication state change is planned.

### 5.3 Shared native-select presentation

**New reusable component:** `frontend/src/components/native-select.jsx`

Create a small presentation-only wrapper around a native `<select>`:

- render a `relative` inline/block wrapper;
- forward normal select props, IDs, names, values, `onChange`, required/disabled/ARIA attributes, and children unchanged;
- keep the native element as the only interactive/focusable control;
- apply the shared closed-control baseline with Tailwind utilities: `min-h-11`, full available width, `appearance-none`, ELVocab border/radius/background/text, consistent left padding, and enough trailing padding for the icon;
- render one absolutely positioned Lucide `ChevronDown` at the trailing edge with `aria-hidden="true"`, `pointer-events-none`, and disabled-state visual inheritance;
- accept narrowly scoped wrapper/select class extensions for width/layout differences without allowing each caller to recreate arrow or focus behavior;
- use native focus and disabled semantics with a consistent focus-visible border/ring and `disabled:cursor-not-allowed`/reduced opacity;
- introduce no custom listbox state, portal, keyboard handler, option renderer, dependency, or custom CSS unless a verified browser-specific issue cannot be expressed clearly in Tailwind.

**Exact USER migrations:**

1. `frontend/src/topics/topic-list-page.jsx`
   - replace only the Discovery CEFR `<select>` presentation;
   - preserve filter value, page-1 reset, client-only behavior, and request count.
2. `frontend/src/learning-progress/learning-progress-page.jsx`
   - replace only the status filter presentation;
   - preserve visible label, pending disable, request parameters, pagination reset, and focus behavior.
3. `frontend/src/vocabulary-sets/my-vocabulary-sets-page.jsx`
   - replace only the My Sets sort presentation;
   - preserve the screen-reader label, search/sort layout, and client sorting;
   - pass an explicit USER-native-select presentation option to the Personal Set CEFR control.
4. `frontend/src/vocabulary-sets/vocabulary-set-metadata-controls.jsx`
   - extend `VocabularySetCefrControl` with a narrow presentation option/component boundary so Personal Set CEFR uses the shared USER primitive;
   - keep the default existing select rendering for `AdminVocabularySetEditor`, preventing an ADMIN migration in this batch;
   - do not change CEFR values, optional/required behavior, metadata state, or cover controls.
5. `frontend/src/vocabulary-sets/private-vocabulary-editor.jsx`
   - replace only the part-of-speech select presentation;
   - preserve unknown existing-value fallback, Meaning indexing, errors, pending state, and Example behavior.

No other native select—including the ADMIN Topic selector or ADMIN Vocabulary CEFR selector—is migrated.

## 6. Validation and Behavior Preservation

- No new input validation is added.
- Existing native required/disabled and `aria-invalid` attributes pass through unchanged.
- The shared select primitive must not normalize, coerce, reorder, or filter options/values.
- The Quiz and Auth corrections change layout ownership only; state transitions and events remain untouched.
- Existing role/ownership checks remain backend-authoritative and unaffected.

## 7. Testing Plan

### 7.1 Quiz focused verification

**Primary specs:**

- `frontend/e2e/auth/quiz-flow.spec.js`
- `frontend/e2e/auth/quiz-focus.spec.js`
- existing unit boundaries in `frontend/test/quiz-presentation.test.js` and `frontend/test/quiz-navigation.test.js`

Add or extend focused browser scenarios to verify:

1. At desktop, the Quiz-only focus shell is scrollable when long feedback requires it, while `.quiz-page` computed `overflow-y` is not `auto`/`scroll` and is not an independent scroll owner.
2. At tablet/mobile, the same Quiz-only outer owner exposes long feedback and the next action without a nested Quiz scroller or horizontal overflow.
3. Long incorrect answers and character feedback remain fully reachable; correct feedback and completion remain reachable as well.
4. Keyboard submission still focuses the result heading, result announcement remains present, Tab reaches the next action, and the outer owner reveals focused content.
5. Both `VI_TO_ENGLISH` and `UNSCRAMBLE_WORD`, restart, completion, and public/owned Back paths retain current behavior.
6. Run at representative 375, 390, 768, 820, 1366×768, and 1536 desktop widths where the focused suite can do so without redundant full-flow duplication.

### 7.2 Register focused verification

**Primary specs:**

- `frontend/e2e/auth/auth-forms.spec.js`
- `frontend/e2e/auth/auth-responsive.spec.js`

Add or extend scenarios for:

1. Normal Login/Register mode transitions and unchanged bounds at desktop where content fits.
2. Register field-validation errors with the bottom Login handoff reachable.
3. Global/API/system error toast at 1366×768 and responsive widths with correct live-region behavior, no focus theft, no duplicate spam, and the handoff still reachable; if inline field content exceeds a smaller viewport, natural document scrolling reaches the handoff.
4. Pending registration keeps controls disabled/deduplicated without layout collapse.
5. Mobile 375/390 and tablet 768/820 stacked forms have no horizontal overflow and no nested form/panel vertical scroller.
6. Existing safe error text, success toast/handoff, keyboard focus, reduced motion, and desktop slide transition remain green.

Tests should inspect relevant bounding rectangles and scroll ownership rather than relying only on element existence.

### 7.3 Native-select focused verification

**Affected specs:**

- `frontend/e2e/auth/discovery-v1.spec.js`
- `frontend/e2e/auth/learning-progress.spec.js`
- `frontend/e2e/auth/my-vocabulary-sets-foundation.spec.js`
- `frontend/e2e/auth/my-vocabulary-set-modal.spec.js`
- `frontend/e2e/auth/my-vocabulary-set-detail.spec.js`
- a focused unit/source test for `frontend/src/components/native-select.jsx` if needed to assert the reusable native structure without duplicating browser checks

Verify on all five surfaces:

1. the control remains a native `combobox` and existing `selectOption` interactions work;
2. exactly one decorative, non-interactive chevron is present and clicking/tapping the trailing region still targets the select rather than the icon;
3. selected text does not overlap the chevron, including long options;
4. focus-visible styling is clear and disabled semantics/styles remain correct;
5. mobile/tablet/desktop layouts do not overflow;
6. existing behavior remains unchanged:
   - Discovery filters locally, resets pagination, and makes no extra request;
   - Learning Progress filter/pending/pagination behavior remains authoritative;
   - My Sets sort order remains correct;
   - Personal Set CEFR remains optional and metadata create/edit flows remain unchanged;
   - private Vocabulary part-of-speech and multi-Meaning/Example workflows remain unchanged;
7. ADMIN-only selects retain their current markup/presentation and are not accidentally migrated.

### 7.4 Final verification

- Run only affected frontend unit/component suites.
- Run the focused mocked browser specs above in a stable mode.
- Run the frontend production build.
- Run ESLint for every touched source/test file.
- Run `git diff --check`.
- Do not run real-stack/backend/database suites unless a focused failure indicates behavior escaped the frontend presentation boundary.

## 8. Documentation Impact

- Preserve `docs/specs/USER_UI_POLISH_SPEC.md` exactly as approved.
- Create and maintain `docs/tasks/USER_UI_POLISH_TASK.md` only after PLAN approval and TASK-stage authorization.
- At implementation closure, update `docs/UI_UX_SPEC.md` only with the verified one-scroll-owner, content-safe Auth, and native-select presentation rules if the project workflow requires synchronization.
- Existing feature rows remain `DONE`; do not relabel Quiz, Authentication, Discovery, Learning Progress, or Vocabulary Set features as incomplete. A concise corrective-workstream evidence note in `docs/FEATURE_STATUS.md` may be added only after implementation, TEST, REVIEW, and HUMAN approval.
- No `DATABASE.md`, `API_SPEC.md`, `ARCHITECTURE.md`, or `PROJECT_OVERVIEW.md` change is expected.

## 9. Implementation Phases and Order

### Phase 1 — Focused regression tests and current-state assertions

1. Add/adjust the smallest tests that reproduce Quiz nested scrolling, Register error clipping, and select presentation inconsistency.
2. Confirm these fail for the intended current-state reasons without changing behavioral assertions.

### Phase 2 — Quiz scroll ownership correction

3. Make the Quiz root content-driven and apply the authorized Quiz-only outer focus-shell scroll ownership without changing Flashcard/Learning.
4. Run focused Quiz flow/focus/responsive tests before continuing.

### Phase 3 — Register containment correction

5. Convert desktop Auth panels to the normal-flow two-column grid/translated arrangement.
6. Keep field validation inline and route global/API/system failures through the small reusable Auth toast without changing error semantics.
7. Preserve the existing stacked breakpoint and mode transition.
8. Run Auth normal/error/pending/responsive tests before continuing.

### Phase 4 — Shared USER native-select presentation

9. Add `frontend/src/components/native-select.jsx`.
10. Migrate Discovery CEFR and Learning Progress status.
11. Migrate My Sets sorting, Personal Set CEFR through the explicit USER option, and private Vocabulary part-of-speech.
12. Verify ADMIN-only selects are unchanged.
13. Run each affected focused suite after its call site is migrated.

### Phase 5 — Consolidated verification and documentation

14. Run the combined focused browser matrix, affected unit tests, build, touched-file ESLint, and diff check.
15. Reconcile only the approved corrective-workstream documentation/evidence.
16. Stop for formal TEST/REVIEW according to the later approved TASK workflow.

## 10. Expected Files

### Planned production changes

- `frontend/src/quiz/quiz-foundation-page.jsx`
- `frontend/src/auth/ui/authenticated-shell.jsx` — Quiz-only focus-shell variant
- `frontend/src/auth/ui/auth-shell.jsx`
- `frontend/src/auth/ui/login-form.jsx` — only if a narrow shared form-frame spacing/sizing adjustment is proven necessary
- `frontend/src/auth/ui/register-form.jsx`
- `frontend/src/auth/ui/success-toast.jsx` and/or one small adjacent Auth notification component
- `frontend/src/components/native-select.jsx` — new
- `frontend/src/topics/topic-list-page.jsx`
- `frontend/src/learning-progress/learning-progress-page.jsx`
- `frontend/src/vocabulary-sets/my-vocabulary-sets-page.jsx`
- `frontend/src/vocabulary-sets/vocabulary-set-metadata-controls.jsx`
- `frontend/src/vocabulary-sets/private-vocabulary-editor.jsx`

### Verification-only production files

- `frontend/src/auth/ui/register-form.jsx`
- `frontend/src/auth/ui/authenticated-shell.jsx`

These should remain unchanged unless focused evidence establishes that the planned owning-file correction cannot satisfy the approved contract. A need for broader shell modification is a STOP condition for scope review.

### Planned test changes

- `frontend/e2e/auth/quiz-flow.spec.js`
- `frontend/e2e/auth/quiz-focus.spec.js` only if the existing focus scenario needs an outer-scroll assertion
- `frontend/e2e/auth/auth-forms.spec.js`
- `frontend/e2e/auth/auth-responsive.spec.js`
- `frontend/e2e/auth/discovery-v1.spec.js`
- `frontend/e2e/auth/learning-progress.spec.js`
- `frontend/e2e/auth/my-vocabulary-sets-foundation.spec.js`
- `frontend/e2e/auth/my-vocabulary-set-modal.spec.js`
- `frontend/e2e/auth/my-vocabulary-set-detail.spec.js`
- a focused frontend unit test for the native-select primitive only if browser coverage cannot efficiently establish its reusable structural contract

### Planned documentation changes

- `docs/plans/USER_UI_POLISH_PLAN.md`
- `docs/tasks/USER_UI_POLISH_TASK.md` only in the later TASK stage
- `docs/UI_UX_SPEC.md` and/or `docs/FEATURE_STATUS.md` only at the later verified closure boundary described above

## 11. Risks and Rollback

### 11.1 Quiz/shell coupling

- **Risk:** A focus-shell change could unintentionally alter Flashcard/Learning viewport behavior.
- **Mitigation:** Apply and test an explicit Quiz-only shell variant, plus focused ownership and reachability checks at all approved breakpoints.
- **Rollback:** Revert the Quiz root and Quiz-only shell variant together. Do not add a replacement nested scroller or alter the shared Learning behavior.

### 11.2 Auth animation and positioning

- **Risk:** Moving panels from absolute positioning to grid flow could alter translation distance, card height, transition events, rounded clipping, or stacked breakpoint layout.
- **Mitigation:** Keep two equal desktop columns, the existing one-column-width transforms and transition utilities; retain normal-state geometry and test both directions before testing errors.
- **Rollback:** Revert the Auth layout batch as one unit. Do not fall back to a larger hard-coded height or form-internal scrollbar; return for HUMAN review if normal-flow grid cannot preserve the approved transition.

### 11.3 Register notification behavior

- **Risk:** Repeated failed submissions could stack duplicate notifications, a short lifetime could hide useful error information, or an assertive implementation could disrupt keyboard/screen-reader flow.
- **Mitigation:** Reuse the current Auth toast visual foundation in one small dependency-free primitive, keep one current global error notification, use appropriate live-region semantics without focus transfer, and cover dismissal/retry/repeated failure behavior.
- **Rollback:** Restore the prior form-level global alert while retaining the independent content-safe layout fix, then return for HUMAN review; do not move field errors out of their inline locations.

### 11.4 Native-select/browser compatibility

- **Risk:** `appearance-none` and native-control metrics vary by browser; insufficient trailing padding can overlap the chevron, and a positioned icon can block pointer input.
- **Mitigation:** Use a pointer-transparent decorative icon, a native select as the sole control, explicit trailing padding, and Chromium responsive/keyboard checks while retaining standards-based markup.
- **Rollback:** Revert callers to their original native selects and remove the new primitive as one isolated batch. Do not replace it with a custom listbox or dependency without a new approval.

### 11.5 Shared Set CEFR boundary

- **Risk:** `VocabularySetCefrControl` is shared with ADMIN System Set forms, so changing its default presentation would expand scope.
- **Mitigation:** Make USER styling explicit and opt-in from the Personal Set caller; preserve the current default for ADMIN.
- **Rollback:** Revert the Personal opt-in and shared option without affecting metadata behavior.

## 12. Scope and Dependency Check

- No new product behavior or role.
- No backend/data/API/auth contract change.
- No package or external service.
- No custom dropdown/listbox.
- No ADMIN redesign.
- No unrelated Quiz/Auth refactor.
- No real-stack or database dependency expected.
- Existing completed features remain the source of truth and are extended only at their presentation boundaries.

## 13. Open Questions / SPEC Ambiguity

None. The approved SPEC defines enough behavior to implement this plan without inventing product or architecture decisions.
