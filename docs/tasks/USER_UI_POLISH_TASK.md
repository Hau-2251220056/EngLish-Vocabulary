# TASKS: USER UI Polish — Quiz Scroll, Register Containment, and Native Select Consistency

**Approved SPEC:** `docs/specs/USER_UI_POLISH_SPEC.md`

**Approved PLAN:** `docs/plans/USER_UI_POLISH_PLAN.md`

**TASK status:** `HUMAN APPROVED — amended at TASK-167 STOP A`

## 1. Overview

These tasks implement only the approved corrective batch for:

1. Quiz result/feedback vertical scroll ownership;
2. Register expanded-error containment;
3. consistent native-select presentation on five USER surfaces.

The affected product features remain `DONE`; this is a bounded modification workflow. No backend, API, schema, route, role, dependency, business behavior, custom listbox, ADMIN redesign, or unrelated UI refactor is authorized.

## 2. Feature Status and Execution Boundary

- Quiz V1, Authentication, Discovery, Learning Progress, My Vocabulary Sets, Personal Set metadata, and Personal Vocabulary are completed features.
- TASK-167 through TASK-183 cover only the approved presentation corrections, regression evidence, formal TEST/REVIEW, and HUMAN-authorized Git closure.
- Implementation may begin only after HUMAN approves this TASK document.
- Implement tasks in dependency order and stop at every mandatory checkpoint.
- A conditional STOP is required whenever current evidence materially contradicts the approved PLAN, even if not repeated under an individual task.

## 3. Task Dependency Graph

```text
TASK-167  Focused reproduction and regression baselines
   ├──→ TASK-168  Quiz scroll ownership correction
   │        ↓
   │     TASK-169  Quiz focused verification
   │
   └──→ TASK-170  Register expanded-error regression coverage
            ↓
         TASK-171  Register containment correction
            ↓
         TASK-172  Register focused verification

TASK-169 + TASK-172
          ↓
   STOP B — HUMAN Quiz/Auth visual review
          ↓
       TASK-173  Shared USER native-select primitive
          ├──→ TASK-174  Discovery CEFR migration
          ├──→ TASK-175  Learning Progress status migration
          ├──→ TASK-176  My Sets sort migration
          │        ↓
          │     TASK-177  Personal Set CEFR migration
          └──→ TASK-178  Private Vocabulary POS migration

TASK-174 + TASK-175 + TASK-177 + TASK-178
          ↓
       TASK-179  Select matrix and ADMIN-boundary verification
          ↓
   STOP C — HUMAN select visual review
          ↓
       TASK-180  Consolidated implementation verification/docs evidence
          ↓
       TASK-181  Formal TEST
          ↓
   STOP D — HUMAN formal TEST review
          ↓
       TASK-182  Formal REVIEW and closure preparation
          ↓
   STOP E — HUMAN closure approval
          ↓
       TASK-183  Authorized commit/push and FF-only dev integration
```

TASK-168 and TASK-170 may proceed independently after TASK-167 only when one agent can keep their separate source/test files conflict-free. TASK-174, TASK-175, TASK-176, and TASK-178 are independently scoped after TASK-173; TASK-177 follows TASK-176 because both affect `my-vocabulary-sets-page.jsx`.

## 4. Implementation Tasks

## TASK-167 — Reproduce and Freeze the Three Regression Boundaries

### Objective

Add the smallest focused failing regression coverage that proves the audited Quiz scroll, Register error-containment, and native-select presentation boundaries before production changes.

### Dependencies

None after HUMAN TASK approval.

### Files / Surfaces

- `frontend/e2e/auth/quiz-flow.spec.js`
- `frontend/e2e/auth/quiz-focus.spec.js` only if needed for outer-scroll/focus interaction
- `frontend/e2e/auth/auth-forms.spec.js`
- `frontend/e2e/auth/auth-responsive.spec.js`
- affected select browser specs only for reusable-structure/current-state assertions that can be expressed without implementation coupling

### In Scope

- Long Quiz feedback fixture and scroll-owner assertions.
- Expanded Register API/validation error fixtures and handoff containment assertions.
- Shared-select contract assertions that distinguish a native select from the future decorative icon.
- Recording current root-cause evidence.

### Out of Scope

- Production source changes.
- Relaxing existing behavioral assertions.
- Snapshotting browser-specific native popup appearance.

### Implementation Requirements

- Quiz assertions must distinguish an independent `.quiz-page` scroller from the intended outer owner; element existence alone is insufficient.
- Register assertions must inspect bounding/reachability and scroll ownership under expanded errors.
- Select assertions must continue using semantic native combobox locators.
- Tests may fail only for the three approved presentation defects, not because of stale fixtures or unrelated behavior.

### Acceptance Criteria

- Each approved defect has a deterministic focused reproduction or a precise current-state assertion.
- Existing Quiz/Auth/select behavior assertions remain intact.
- No product source file is changed.

### Verification

- Run only the new/affected focused cases and capture expected pre-fix failures.
- Confirm failures map exactly to the approved root causes.

### STOP A — Conditional Direction Checkpoint

If evidence shows any of the following, STOP for HUMAN review before production changes:

- Quiz requires a global authenticated-shell ownership change rather than the planned Quiz-local correction;
- the normal-flow two-column Auth grid cannot preserve the approved slide/containment behavior;
- native semantics cannot be preserved without a custom control/dependency;
- shared Set CEFR cannot keep ADMIN presentation unchanged.

If evidence matches the approved PLAN, record it and continue without an additional approval round.

**HUMAN resolution after TASK-167 evidence:** Quiz may use a narrowly scoped outer focus-shell scroll owner while `.quiz-page` becomes content-driven; Flashcard/Learning focus-shell behavior must remain unchanged. Register uses hybrid errors: field validation remains inline, global/API/system failures use a small reusable dependency-free toast, and the Auth layout must still be made content-safe.

---

## TASK-168 — Correct Quiz Vertical Scroll Ownership

### Objective

Make the Quiz root content-driven so it no longer creates a nested vertical scroll region.

### Dependencies

TASK-167 and no STOP A blocker.

### Files / Surfaces

- `frontend/src/quiz/quiz-foundation-page.jsx`
- `frontend/src/auth/ui/authenticated-shell.jsx` — Quiz-scoped outer ownership only

### In Scope

- Shared Quiz root sizing/overflow classes for selection, loading/error, active feedback, and completion states.
- Preservation of the existing width, padding, cards, and content hierarchy.

### Out of Scope

- Quiz behavior, service, state, feedback content, routes, shell redesign, or visual redesign.
- `overflow-hidden`, fixed-height, or feedback-specific scrollbar workarounds.

### Implementation Requirements

- Remove the Quiz root's `h-full overflow-y-auto` ownership.
- Make the Quiz-specific outer focus shell the single vertical scroll owner when content exceeds the viewport.
- Preserve Flashcard/Learning focus-shell behavior exactly.
- Use content-driven height and a non-clipping minimum height only if needed for short states.
- Do not broaden the shell change beyond Quiz routing.

### Acceptance Criteria

- `.quiz-page` is not an independent vertical scroller at any approved breakpoint.
- Long feedback increases normal page content height and remains reachable.
- No content is clipped and no horizontal overflow appears.

### Verification

- Run the focused scroll reproduction from TASK-167.
- Inspect computed overflow and actual outer-owner reachability at desktop/tablet/mobile.

---

## TASK-169 — Verify Quiz Feedback, Focus, Keyboard, and Responsive Regressions

### Objective

Prove the Quiz layout correction preserves the complete approved Quiz interaction contract.

### Dependencies

TASK-168.

### Files / Surfaces

- `frontend/e2e/auth/quiz-flow.spec.js`
- `frontend/e2e/auth/quiz-focus.spec.js`
- `frontend/test/quiz-presentation.test.js`
- `frontend/test/quiz-navigation.test.js`

### In Scope

- Both Quiz types.
- Correct/incorrect and long character feedback.
- Completion, restart, announcements, keyboard-result focus, next action, and Back routing.
- Representative 375, 390, 768, 820, 1366×768, and 1536 widths without unnecessary scenario duplication.

### Out of Scope

- Backend or real-stack Quiz changes.
- New Quiz types or result behavior.

### Acceptance Criteria

- `VI_TO_ENGLISH` and `UNSCRAMBLE_WORD` behave unchanged.
- Keyboard submission focuses/announces the result and the intended outer owner reveals it.
- Tab/navigation reaches the next action.
- Public and owned Set return paths remain correct.
- No internal vertical scroll or horizontal overflow remains.

### Verification

- Focused Quiz unit/navigation tests.
- Focused mocked Quiz flow and focus specs.
- Record exact pass/fail counts and viewport evidence.

---

## TASK-170 — Add Expanded Register Error-State Regression Coverage

### Objective

Cover the exact Register clipping failure across normal, validation, API-error, and pending states before changing layout.

### Dependencies

TASK-167 and no STOP A blocker.

### Files / Surfaces

- `frontend/e2e/auth/auth-forms.spec.js`
- `frontend/e2e/auth/auth-responsive.spec.js`

### In Scope

- Global/API/system error toast presentation.
- Multiple client-validation messages.
- Pending submission state.
- Bottom **Đăng nhập** handoff reachability.
- Desktop/tablet/mobile geometry and scroll ownership.

### Out of Scope

- Error copy, validation rules, Auth service/state, or Login behavior changes.

### Implementation Requirements

- Assert content is not clipped by the panel/card boundary.
- Assert the handoff is visible in normal desktop state and naturally reachable in expanded states.
- Assert no nested form/panel vertical scroller and no horizontal overflow.
- Preserve safe-error and pending-deduplication assertions; verify repeated failures do not create duplicate toast spam.

### Acceptance Criteria

- The current defect is reproducible at the approved low-height desktop condition.
- Tests also define valid behavior for mobile/tablet natural page flow.
- Failures are presentation-only.

### Verification

- Run only affected Auth browser cases before the production correction.

---

## TASK-171 — Implement Content-Safe Register Containment

### Objective

Allow desktop Auth panel content to determine container height while preserving the existing two-panel transition and responsive stack.

### Dependencies

TASK-170.

### Files / Surfaces

- `frontend/src/auth/ui/auth-shell.jsx`
- `frontend/src/auth/ui/login-form.jsx` only if focused evidence requires a narrow shared frame spacing/sizing adjustment
- `frontend/src/auth/ui/register-form.jsx`
- `frontend/src/auth/ui/success-toast.jsx` and/or one small adjacent reusable Auth notification component

### In Scope

- Normal-flow two-column desktop grid/equivalent.
- Existing one-column-width Login/Register transforms.
- Intrinsic content height and natural document scroll.
- Existing stacked layout at `max-[900px]`.

### Out of Scope

- Auth behavior/API/validation/error-copy changes.
- Nested form scrolling, larger hard-coded height, or broad Auth redesign.

### Implementation Requirements

- Remove desktop absolute positioning as the height-isolating mechanism.
- Keep visual and form panels in equal desktop columns that contribute to one row's intrinsic height.
- Preserve Login and Register transform directions and transition/reduced-motion behavior.
- Retain rounded-card horizontal transition clipping only after vertical containment is content-safe.
- Keep normal-state minimum height for visual balance without a fixed/max content height.
- Expanded content must use document flow rather than panel/form overflow.
- Keep tablet/mobile panels relative/stacked with transforms neutralized.
- Keep field-specific validation messages inline.
- Present global/API/system failures through one responsive, non-focus-stealing toast with appropriate live-region semantics, readable duration, keyboard-safe dismissal where appropriate, and no duplicate toast stacking.
- Reuse/generalize the current Auth success-toast foundation where practical; do not add a dependency.

### Acceptance Criteria

- Expanded inline validation errors cannot be vertically clipped.
- Bottom Login handoff remains keyboard reachable.
- Normal desktop slide remains visually stable in both directions.
- Mobile/tablet remain stacked without overlap or horizontal overflow.
- No Auth contract changes occur.

### Verification

- Run the TASK-170 focused error/viewport cases during implementation.
- Confirm transition events still occur in normal desktop mode.

---

## TASK-172 — Verify Register Normal, Error, Pending, and Responsive States

### Objective

Complete focused Auth regression evidence before HUMAN visual review.

### Dependencies

TASK-171.

### Files / Surfaces

- `frontend/e2e/auth/auth-forms.spec.js`
- `frontend/e2e/auth/auth-responsive.spec.js`
- existing Auth unit tests as needed for unchanged behavior evidence

### In Scope

- Normal Login/Register transition.
- Inline field errors, global/API/system error toast, pending lock, success toast/handoff.
- Handoff focus/reachability.
- 375, 390, 768, 820, 1366×768, and representative wider desktop behavior.

### Out of Scope

- Full unrelated Auth/real-stack reruns unless a focused failure shows behavioral risk.

### Acceptance Criteria

- Normal, error, pending, and success states pass.
- No clipping, nested form scroll, or horizontal overflow remains.
- Existing validation, sanitized errors, request deduplication, navigation, and motion behavior remain unchanged.
- Error toast uses correct live-region behavior, does not steal focus, remains keyboard-safe/responsive, and does not duplicate on repeated failed submissions.

### Verification

- Focused Auth unit tests where relevant.
- Full affected mocked Auth form/responsive specs.
- Record exact results and visual geometry evidence.

### STOP B — MANDATORY HUMAN QUIZ/AUTH VISUAL REVIEW

After TASK-169 and TASK-172:

- report production/test files changed;
- report Quiz scroll ownership evidence;
- report Register normal/error/pending containment evidence;
- provide desktop/tablet/mobile visual-review runtime if requested;
- report any deviation from the approved PLAN.

Do not start TASK-173 until HUMAN approves STOP B.

---

## TASK-173 — Create the Shared USER Native-Select Primitive

### Objective

Create one presentation-only wrapper around a real native `<select>` with consistent ELVocab styling and a decorative Lucide chevron.

### Dependencies

HUMAN approval of STOP B.

### Files / Surfaces

- Create `frontend/src/components/native-select.jsx`
- Add a focused unit/source test only if browser callers cannot efficiently prove the structural contract

### In Scope

- Wrapper, native select prop/children forwarding, Tailwind styling, and one decorative `ChevronDown`.
- Narrow wrapper/select class extension points for layout differences.

### Out of Scope

- Custom listbox state, option rendering, keyboard handlers, portal, search, multi-select, custom CSS, or dependency installation.

### Implementation Requirements

- The `<select>` remains the only interactive/focusable control.
- Preserve IDs, names, values, events, required/disabled/ARIA attributes, and children.
- Use `appearance-none`, consistent minimum height/border/radius/background/text/padding, and sufficient trailing icon space.
- Chevron must be `aria-hidden`, non-focusable, and `pointer-events-none`.
- Focus-visible and disabled states must be consistent and native semantics intact.

### Acceptance Criteria

- Primitive exposes one native combobox and exactly one decorative chevron.
- Pointer interaction over the trailing icon region reaches the select.
- Keyboard/screen-reader semantics require no custom behavior.
- No dependency or global CSS change is introduced.

### Verification

- Focused component/source assertion if created.
- Minimal browser harness through the first migrated caller in TASK-174.

---

## TASK-174 — Migrate Discovery CEFR to the Shared Native Select

### Objective

Adopt the shared primitive for the Discovery CEFR filter without changing catalog behavior.

### Dependencies

TASK-173.

### Files / Surfaces

- `frontend/src/topics/topic-list-page.jsx`
- `frontend/e2e/auth/discovery-v1.spec.js`

### In Scope

- Discovery CEFR closed-control presentation and responsive fit.

### Out of Scope

- Topic control, search, ranking, Featured, pagination, request composition, or filtering logic changes.

### Acceptance Criteria

- CEFR remains a labelled native combobox with unchanged options/value.
- Changing CEFR resets to page 1, filters locally, and makes no API request.
- Text and chevron do not overlap; no horizontal overflow appears.

### Verification

- Focused Discovery filter/pagination/no-request tests at responsive widths.

---

## TASK-175 — Migrate Learning Progress Status to the Shared Native Select

### Objective

Adopt the shared primitive for the Learning Progress status filter.

### Dependencies

TASK-173.

### Files / Surfaces

- `frontend/src/learning-progress/learning-progress-page.jsx`
- `frontend/e2e/auth/learning-progress.spec.js`

### In Scope

- Status filter presentation, pending-disabled style, and responsive width.

### Out of Scope

- Progress API, status semantics, pagination, due-state, search, or sorting changes.

### Acceptance Criteria

- Existing label/options/value and native semantics remain unchanged.
- Filter request/page reset, pending lock, focus restoration, and responsive layout remain correct.
- Chevron is decorative and pointer-transparent.

### Verification

- Focused populated/filter/pagination/disabled/responsive Learning Progress tests.

---

## TASK-176 — Migrate My Sets Sorting to the Shared Native Select

### Objective

Adopt the shared primitive for My Sets sorting while preserving toolbar geometry and client ordering.

### Dependencies

TASK-173.

### Files / Surfaces

- `frontend/src/vocabulary-sets/my-vocabulary-sets-page.jsx`
- `frontend/e2e/auth/my-vocabulary-sets-foundation.spec.js`

### In Scope

- Sort select presentation, screen-reader label, trailing icon spacing, and responsive toolbar fit.

### Out of Scope

- Search, Set cards, action menu, CRUD, or sorting semantics.

### Acceptance Criteria

- All existing sort options and client order behavior remain unchanged.
- Control remains labelled and native.
- Search/sort toolbar fits mobile/tablet/desktop without layout shift or overflow.

### Verification

- Focused My Sets list/search/sort/responsive tests.

---

## TASK-177 — Migrate Personal Set CEFR Without Changing ADMIN Controls

### Objective

Use the shared USER select for optional Personal Set CEFR through an explicit opt-in while preserving the shared component's existing ADMIN default.

### Dependencies

TASK-176.

### Files / Surfaces

- `frontend/src/vocabulary-sets/my-vocabulary-sets-page.jsx`
- `frontend/src/vocabulary-sets/vocabulary-set-metadata-controls.jsx`
- `frontend/e2e/auth/my-vocabulary-set-modal.spec.js`
- ADMIN Set focused structural assertion only as needed to prove non-migration

### In Scope

- Narrow USER presentation option/component boundary.
- Personal Set create/edit optional CEFR presentation.
- Explicit preservation of ADMIN System Set select markup/presentation.

### Out of Scope

- CEFR values/rules, cover workflow, metadata API/state, ADMIN redesign, or ADMIN-wide select migration.

### Implementation Requirements

- Default `VocabularySetCefrControl` behavior must remain the current ADMIN-compatible select.
- Personal Set caller explicitly opts into the USER native-select primitive.
- Required/optional semantics and values remain unchanged.

### Acceptance Criteria

- Personal Set CEFR uses the shared USER control and remains optional.
- Create/edit payloads and cover preview/replace/remove/Cancel/retry behavior are unchanged.
- ADMIN System Set CEFR and Topic controls are not unintentionally migrated.

### Verification

- Focused Personal Set metadata modal tests.
- Narrow ADMIN structural/regression check proving the boundary.

---

## TASK-178 — Migrate Private Vocabulary Part of Speech

### Objective

Adopt the shared primitive for every private Meaning's part-of-speech selector.

### Dependencies

TASK-173.

### Files / Surfaces

- `frontend/src/vocabulary-sets/private-vocabulary-editor.jsx`
- `frontend/e2e/auth/my-vocabulary-set-detail.spec.js`
- existing private Vocabulary unit/component tests where relevant

### In Scope

- Part-of-speech presentation for create/edit and responsive dialog fit.

### Out of Scope

- Meaning CEFR, values, validation, private Vocabulary API, Learning/Quiz, or ADMIN Vocabulary forms.

### Acceptance Criteria

- Existing and fallback part-of-speech values remain supported.
- Create/edit validation, pending/error preservation, multi-Meaning, and nested Example behavior remain unchanged.
- Select height/alignment and responsive dialog containment remain correct.

### Verification

- Focused private Vocabulary create/edit/multi-Meaning/Example/responsive tests.

---

## TASK-179 — Verify the Five-Select Matrix and ADMIN Boundary

### Objective

Prove all and only the five approved USER select surfaces share the native-select presentation contract.

### Dependencies

TASK-174, TASK-175, TASK-177, and TASK-178.

### Files / Surfaces

- `frontend/src/components/native-select.jsx`
- the five migrated production surfaces
- their focused mocked browser specs
- ADMIN Set/Vocabulary select surfaces as non-migration checks only

### In Scope

- Native structure, icon pointer behavior, text clearance, focus-visible, disabled, responsive, and no-overflow matrix.
- ADMIN exclusion evidence.

### Out of Scope

- OS/browser native popup restyling or broader select cleanup.

### Acceptance Criteria

- Exactly the five approved USER surfaces use the shared primitive.
- Every control remains a native accessible combobox.
- Every chevron is decorative and pointer-transparent.
- Long selected text does not collide with the icon.
- Disabled/focus states and responsive layouts pass.
- ADMIN-only selects retain their prior presentation.

### Verification

- Run all five focused caller specs in stable mocked mode.
- Run any focused primitive unit/source test.
- Record desktop/tablet/mobile visual evidence.

### STOP C — MANDATORY HUMAN SELECT VISUAL REVIEW

After TASK-179:

- report primitive and caller files changed;
- provide visual evidence for all five USER surfaces;
- report native keyboard/focus/disabled/pointer behavior;
- confirm ADMIN-only selectors were not migrated;
- provide manual-review runtime if requested.

Do not start TASK-180 until HUMAN approves STOP C.

---

## TASK-180 — Consolidated Implementation Verification and Documentation Evidence

### Objective

Run the complete approved focused implementation matrix and reconcile corrective-workstream evidence without entering formal TEST prematurely.

### Dependencies

HUMAN approval of STOP C.

### Files / Surfaces

- All production/test files changed by TASK-167 through TASK-179
- `docs/UI_UX_SPEC.md` only if verified UI contract synchronization is required
- `docs/tasks/USER_UI_POLISH_TASK.md` for implementation evidence/status

### In Scope

- Affected unit/component tests.
- All focused mocked browser specs.
- Responsive matrix.
- Production build, touched-file ESLint, and diff check.
- Scope, secret, dependency, and source-change review.

### Out of Scope

- Broad real-stack/backend/database runs without evidence of escaped behavior.
- Marking formal TEST/REVIEW complete.

### Acceptance Criteria

- All implementation-stage focused checks pass.
- No backend/API/schema/package/route/ADMIN-scope change exists.
- Documentation reflects only verified corrective behavior.
- SPEC and approved PLAN remain unchanged except workflow status only if explicitly authorized later.

### Verification

- Affected frontend unit/component suites.
- Focused mocked Playwright specs.
- `npm run build` in `frontend`.
- ESLint over touched frontend source/test files.
- `git diff --check`.
- Git scope/status and secret/artifact scan.

---

## TASK-181 — Formal TEST

### Objective

Execute an independent formal test pass against every approved acceptance criterion and regression constraint.

### Dependencies

TASK-180.

### Files / Surfaces

- Approved SPEC/PLAN/TASK acceptance criteria
- Final implementation/test diff
- Focused USER frontend suites

### In Scope

- Quiz single-owner/reachability and behavior matrix.
- Register containment/state/responsive matrix.
- Five USER selects/native accessibility/ADMIN exclusion matrix.
- Build, lint, diff, scope, artifact, and secret checks.

### Out of Scope

- New fixes without first classifying the failure.
- Database/provider access unless an unexpected test dependency requires separate approval.

### Acceptance Criteria

- Formal TEST reports exact PASS/FAIL/NOT RUN counts.
- Every SPEC acceptance criterion is traceable to evidence.
- Any failure is classified as product defect, stale test, environment issue, or scope issue before correction.
- No unresolved blocker is hidden.

### Verification

- Follow `.agents/skills/test/SKILL.md`.
- Reuse authoritative implementation evidence when unchanged and rerun the final focused aggregate needed for confidence.

### Formal TEST Status — PASS (2026-10-09)

- **AC-01 through AC-03 — Quiz:** PASS. The Quiz route receives the scoped outer `quiz-focus-shell`; `.quiz-page` is content-driven rather than an independent vertical scroll owner. Both Quiz modes, long correct/incorrect feedback, canonical answer, completion/restart, Enter/Space focus behavior, announcements, and public/owned Back routing passed.
- **AC-04 through AC-07 — Register/Auth:** PASS. Inline validation and field-specific email conflict mapping remain associated with their fields. Global/API/system failures use one dismissible `AuthNotification` without focus theft or duplicate stacking. Success handoff, pending deduplication, Login/Register transitions, natural page scrolling, and Login handoff reachability passed.
- **AC-08 through AC-10 — Native selects:** PASS. Exactly the five approved USER surfaces use the shared native `<select>` primitive with preserved options/values/events, labels, disabled behavior, keyboard semantics, sufficient trailing space, and one pointer-transparent, accessibility-hidden Lucide chevron. ADMIN controls retain their prior presentation.
- **AC-11 and AC-12 — Responsive/accessibility:** PASS. The authoritative browser matrix covered representative 375, 390, 768, 820, 1366×768, and 1536 widths across affected surfaces with no scoped clipping or horizontal-overflow failure. Focus-visible, live-region, keyboard, pointer, and responsive checks passed.
- **AC-13 — Regressions:** PASS. Flashcard NORMAL, SRS, Learning focus-shell behavior, Discovery filtering/pagination, Learning Progress filtering, My Sets sorting, Personal Set metadata, private Vocabulary editing, and the focused ADMIN boundary remained green.
- **AC-14 — Scope:** PASS. No backend, API, schema, migration, package/dependency, route-contract, role, Storage, database, custom-listbox, or ADMIN-redesign change exists in this workstream.
- **AC-15 — Technical gates:** PASS. Full frontend unit suite: **99/99**. Authoritative serial mocked Playwright matrix: **118/118**. Production build: **PASS**. Full frontend ESLint: **PASS**. `git diff --check`: **PASS**. Secret and transient-artifact scans: **PASS**.
- The mocked Quiz fallback-route checks emitted expected Vite proxy `ECONNREFUSED` log noise while exercising mocked responses; no assertion failed. This is classified as non-blocking environment noise, not a product failure.
- The production build retained the existing bundle-size advisory for a chunk above 500 kB; the build completed successfully and this is outside the approved corrective scope.
- Database, backend, and Storage verification are **NOT APPLICABLE** to this frontend-only presentation batch and were not accessed.
- Formal TEST result is `PASS`; formal REVIEW has not started and remains gated by HUMAN approval at STOP D.

### STOP D — MANDATORY HUMAN FORMAL TEST REVIEW

Report the formal verdict, commands/results, responsive/accessibility evidence, changed files, scope/secret checks, and any finding. Do not begin TASK-182 until HUMAN approves formal TEST.

---

## TASK-182 — Formal REVIEW and Closure Preparation

### Objective

Review the completed batch against the approved SPEC/PLAN/TASK and prepare a closure-ready repository state.

### Dependencies

HUMAN approval of STOP D.

### Files / Surfaces

- Approved documents
- Complete implementation/test diff
- `docs/UI_UX_SPEC.md` / `docs/FEATURE_STATUS.md` only if closure synchronization is required by the approved workflow

### In Scope

- Scope, architecture, accessibility, responsiveness, test quality, maintainability, documentation, dependency, secret, and Git review.
- Confirm existing feature rows remain `DONE` and record the corrective workstream without misrepresenting new product behavior.
- Prepare proposed commit message and FF-only integration path.

### Out of Scope

- Commit, push, merge, or new feature work.

### Acceptance Criteria

- Review verdict is explicit with severity-classified findings.
- No unapproved backend/API/schema/route/dependency/ADMIN change exists.
- Worktree contains only approved files and is ready for HUMAN closure decision.

### Verification

- Follow `.agents/skills/review/SKILL.md`.
- Lightweight final build/lint/diff/status checks only as needed; do not repeat expensive unchanged evidence without cause.

### Formal REVIEW Status — APPROVE (2026-10-09)

- The earlier hidden-focusable-dismiss finding is resolved: hidden, dismissed and timed-out `AuthNotification` states expose no dismiss control, while visible dismissal remains keyboard accessible.
- The temporary untracked backend manual-review fixture was removed; the final worktree contains only approved USER UI polish documentation, frontend source and frontend tests.
- Scope, architecture, accessibility, responsiveness, security, test evidence, documentation, dependency and Git checks pass with no blocker or must-fix finding.
- No backend/API/schema/route/dependency/ADMIN behavior change exists.

### STOP E — MANDATORY HUMAN REVIEW / CLOSURE APPROVAL

Report formal REVIEW, closure readiness, proposed commit message, branch/base state, and FF-only integration path. Do not commit, push, or integrate until HUMAN explicitly approves closure.

**HUMAN closure approval: APPROVED (2026-10-09). TASK-183 is authorized.**

---

## TASK-183 — HUMAN-Authorized Git Closure and FF-Only Integration

### Objective

Commit and publish the approved batch, then integrate into `dev` by fast-forward only when repository invariants still hold.

### Dependencies

Explicit HUMAN closure and commit/push/integration authorization after STOP E.

### Files / Surfaces

- Only the final approved USER UI polish documents, source, and tests.

### In Scope

- Confirm branch/base/clean staged scope and stash presence.
- Stage only approved files.
- Review staged diff and secret/artifact scope.
- Commit with the HUMAN-approved message.
- Push `fix/user-ui-polish`.
- Confirm local/remote `dev` did not advance unexpectedly.
- Switch to `dev`, `git merge --ff-only fix/user-ui-polish`, and push `dev` only when explicitly authorized and FF remains valid.

### Out of Scope

- Force push, rebase, squash, merge commit, branch deletion, stash modification, or post-closure code changes.

### Acceptance Criteria

- Feature commit contains only approved scope.
- Feature branch push succeeds.
- Integration is fast-forward only and local `dev` equals `origin/dev` after push.
- Working tree is clean and `stash@{0}` remains untouched.
- If base/divergence/staging/secret invariant fails, stop without forcing.

### Verification

- Report commit SHA/message, staged/committed files, branch push, FF result, final local/remote SHAs, Git status, and stash confirmation.

## 5. Global Out-of-Scope Guardrails

Across every task, do not:

- change backend, API, database, Prisma schema/migrations, authentication/authorization, or route contracts;
- add a package, external service, custom listbox, searchable select, or multi-select;
- redesign Quiz/Auth, add Quiz types, or change Quiz correctness/progress/session behavior;
- change Discovery search/filter/ranking/Featured/pagination/request behavior;
- change Learning Progress status/due/pagination behavior;
- change Set/Vocabulary metadata semantics, ownership, cover behavior, or Learning/Quiz behavior;
- migrate ADMIN-only controls or redesign ADMIN UI;
- include Speaking Practice, Profile, gamification, Community, Dashboard expansion, or unrelated polish;
- access or mutate any database/provider merely for this frontend presentation batch;
- commit/push/integrate before the corresponding HUMAN authorization;
- touch `stash@{0}`.

## 6. Task Execution Notes

- Preserve the approved SPEC and PLAN exactly unless HUMAN explicitly returns the workflow to those stages.
- Use Tailwind utilities for ordinary presentation; do not broaden `index.css` cleanup.
- Keep production edits minimal and prefer verification-only treatment for `authenticated-shell.jsx` and `register-form.jsx`.
- A focused failure must be classified before any fix. Product defects may be corrected only within the approved task; stale tests may be updated only to the approved contract; environment failures must be reported rather than disguised.
- Formal status may transition to DONE only after IMPLEMENT, formal TEST, formal REVIEW, HUMAN closure approval, and documentation synchronization.
