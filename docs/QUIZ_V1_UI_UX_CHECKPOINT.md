# Quiz V1 — UI/UX Design Checkpoint

**Source SPEC:** `docs/specs/QUIZ_V1_SPEC.md` (HUMAN APPROVED)

**Source PLAN:** `docs/plans/QUIZ_V1_PLAN.md` (HUMAN APPROVED)

**Source TASK:** `docs/tasks/QUIZ_V1_TASK.md` (HUMAN APPROVED)

**Checkpoint status:** `HUMAN APPROVED`, including the revised Unscramble/underline direction

**Production revision authorized:** `BLOCKED` until TASK-086A HUMAN review approves implementation evidence.

> **Revision after TASK-086 visual review:** HUMAN requested `UNSCRAMBLE_WORD` to replace `MISSING_LETTER` and shared underline-based answer feedback. The original TASK-085 approval and TASK-086 implementation remain historical evidence. This revised checkpoint is `AWAITING HUMAN UI/UX APPROVAL`; production revision is assigned to TASK-086B after TASK-086A backend approval.

## 1. Design Intent and Shell

Quiz V1 is a focused answer-construction exercise over every ordered Item in one accessible Vocabulary Set: full typing for `VI_TO_ENGLISH` and deterministic character tiles for `UNSCRAMBLE_WORD`. It feels like a production ELVocab learning activity while remaining visibly distinct from the two-sided Flashcard interaction.

The Quiz route remains inside the existing authenticated `ProtectedRoute → AuthenticatedShell → UserRoute` composition. The normal authenticated Header, Sidebar, Footer, main-content scrolling and mobile drawer remain unchanged. Quiz does not introduce a second Focus Mode or redesign App Layout.

Within main content, Quiz uses a centered working column approximately `760–860px` wide. A compact Set context/header, ordered progress, one question card, the answer/result region and primary action form one stable vertical flow. No score, timer, streak, reward, review queue or analytics surface appears.

## 2. Screen and State Structure

```text
Authenticated Header / Sidebar
┌──────────────────────────────────────────────────────────┐
│ ← Quay lại bộ từ                         Bắt đầu lại     │
│ Quiz · {Set name}                                         │
├──────────────────────────────────────────────────────────┤
│ Type selection (before a run)                             │
│   [ Việt → Anh ] [ Điền chữ còn thiếu ]                  │
│                                                          │
│ Active run                                               │
│   Câu {X}/{N} · {selected type}                           │
│   [progress bar]                                          │
│   [question card]                                         │
│   [answer form OR accepted feedback]                      │
│                                                          │
│ Completion                                               │
│   Tổng số câu · Đúng · Chưa đúng                         │
│   [Làm lại Quiz] [Quay lại bộ từ]                        │
└──────────────────────────────────────────────────────────┘
Authenticated Footer
```

Only the state appropriate to the current run is rendered. Type selection, active question and completion are not shown simultaneously.

## 3. Entry and Quiz-Type Selection

- A USER enters from **Làm Quiz** on a non-empty public System Set or owned private Set.
- The page header exposes **Quay lại bộ từ** using the originating Set detail route when supplied by navigation state, with the existing safe My Sets fallback.
- Before a run starts, the single page `h1` is **Chọn loại Quiz**. The Set name and a concise explanation establish context.
- Present exactly two native, keyboard-operable choices:
  1. **Tiếng Việt → Tiếng Anh** — “Nhập từ tiếng Anh phù hợp với nghĩa tiếng Việt.”
  2. **Sắp xếp từ tiếng Anh** — “Chọn các ký tự theo đúng thứ tự để tạo thành từ hoặc cụm từ tiếng Anh.”
- Each choice may use a restrained icon and short description, but its text label remains authoritative. Selection is not communicated by color alone.
- A primary **Bắt đầu Quiz** button starts the selected type, creates/uses its new `run_id` and loads the fresh authorized questions. The button is unavailable until a type is selected.
- A restored valid same-tab run bypasses type selection and resumes after fresh reconciliation. It never silently changes Quiz type.
- No mixed mode, difficulty, item count, shuffle, timer or additional type control is shown.

## 4. Active-Run Header and Progress

- The active page `h1` is the Set name. A small eyebrow identifies **Quiz** and a compact badge names the selected type.
- A text indicator reads **Câu {current position} / {total}**.
- A linear progress bar reflects accepted questions only. It has an accessible name/value and is accompanied by text, so completion is not inferred from width or color.
- Ordered questions cannot be skipped, reordered or revisited for another answer. There are no Previous/Next controls before acceptance.
- **Bắt đầu lại** remains a secondary action. If the run contains an accepted answer or an in-progress typed answer, activation opens a confirmation dialog explaining that only the transient run/result is cleared; durable Learning Progress is not reset.
- Confirming restart creates a new `run_id`, fetches current questions and returns to the first question. Cancelling restores focus to **Bắt đầu lại**.

## 5. Shared Question Composition

The question card uses a white rounded surface, subtle border/shadow and restrained spacing within the centered column. Its anatomy is stable across both types:

1. type label and **Câu X**;
2. type-specific prompt;
3. answer form;
4. pending or accepted feedback;
5. explicit next action after an accepted result.

`VI_TO_ENGLISH` uses a native answer field with persistent visible label **Câu trả lời bằng tiếng Anh** and supporting text **Nhập đầy đủ từ hoặc cụm từ.** `UNSCRAMBLE_WORD` uses the accessible tile pool and answer slots in section 7 instead of a text field. The frontend never evaluates correctness for either input mechanism.

- Pressing `Enter` in the text field submits through the native form; in Unscramble, `Enter`/`Space` activates the focused tile and a separate native submit button submits the constructed complete answer.
- Empty or Unicode-whitespace-only typed input, or an incomplete/empty constructed tile answer, shows an inline validation message associated with the relevant input/group and moves focus appropriately without sending a request.
- While submitting, input and submit controls are protected from duplicate activation. The button reads **Đang kiểm tra…** and exposes pending state without replacing the whole question.
- No canonical answer, phonetic, English Example, pronunciation or hidden unmasked word exists in the pre-answer DOM/state.

## 6. Vietnamese → English Question

The question prompt uses only the approved safe projection:

- a small **NGHĨA TIẾNG VIỆT** label;
- the primary `meaning_vi` as the strongest centered or comfortably left-aligned prompt text;
- compact `part_of_speech` and optional CEFR badges;
- optional Vietnamese context below the meaning in a subdued supporting panel.

The UI does not reconstruct or request Vocabulary word, phonetic, pronunciation, English Examples or any other canonical-answer-bearing field before submission. Long Vietnamese meaning/context wraps naturally without clipping or horizontal scrolling.

## 7. Unscramble Word Question

The question prompt contains:

- a small **SẮP XẾP TỪ TIẾNG ANH** label;
- deterministic primary Vietnamese Meaning, compact POS/optional CEFR and optional context;
- the server-provided shuffled selectable tile pool;
- a server-provided answer-slot pattern whose fixed separators contain no canonical letters/digits;
- concise instruction **Chọn các ký tự theo đúng thứ tự.**

Each pool character is a native button with an opaque stable identity. Activating it appends that exact tile into the next selectable answer slot. Each selected answer tile remains a button; activating it removes that exact tile and restores it at its original shuffled-pool ordinal. Duplicate visible characters are therefore independent. Fixed spaces, apostrophes, hyphens and punctuation are rendered in their server-defined slots and are not selectable.

V1 has no drag-and-drop. Pointer, touch and keyboard use the same semantic controls. Long pools/answers wrap within the card without horizontal overflow; mobile targets remain at least `44px`. Movement is subtle and disabled/near-instant under reduced motion.

`IDENTITY_FALLBACK` remains a valid question and displays a restrained explanation that the available characters cannot be meaningfully reordered. It never drops or skips the ordered Set Item. Reloading retains identical tile identity/order after reconciliation; a confirmed restart may produce another valid order through a new `run_id`.

## 8. Accepted Correct / Incorrect Feedback

Feedback appears only after the backend accepts the answer and returns authoritative correctness/result data. The answer input becomes read-only/disabled for that accepted question; the USER cannot immediately re-answer it.

### 8.1 Correct

- A result heading and icon state **Chính xác**.
- Show the authoritative canonical answer as **Đáp án: {correct_answer}**.
- Use restrained green support styling, never color alone.

### 8.2 Incorrect

- A result heading and icon state **Chưa chính xác**; avoid punitive language.
- Show **Câu trả lời của bạn** and **Đáp án đúng** as explicit labelled values.
- Use restrained red/amber support styling, never color alone.

### 8.3 Shared Underline Character Feedback

- Render backend-provided Unicode code-point feedback in a semantic labelled region titled **Chi tiết ký tự**, shared by both Quiz types.
- Each character remains visible above an underline. `correct` uses a green underline; `incorrect`, `missing` and `extra` use an error underline/state. Explicit text, icon or accessible names expose **đúng**, **sai**, **thiếu** and **thừa**; boxed character cells are not used.
- Color and icons supplement, but do not replace, status text/accessible names.
- The sequence wraps across lines without horizontal overflow. It does not use a fixed-width desktop strip that becomes unreadable on mobile.
- The UI does not recompute correctness or normalize the answer independently.

After either accepted outcome, expose one primary **Câu tiếp theo** button. On the last question it reads **Xem kết quả**. Moving forward is explicit rather than timer-driven or automatic.

## 9. Retry, Conflict and Error Behavior

### 9.1 Initial Loading

- Render a stable question-page skeleton and one polite status **Đang chuẩn bị Quiz…**.
- Do not render empty, question or completion content prematurely.

### 9.2 Empty / Concealed / Not Found

- An accessible state panel explains that the Quiz cannot be started from this Set.
- Empty copy: **Bộ từ này chưa có từ vựng để làm Quiz.**
- Concealed/not-found uses safe wording: **Không thể mở Quiz này. Bộ từ có thể không còn khả dụng.**
- Offer only **Quay lại bộ từ** or the safe My Sets fallback; do not reveal ownership/existence details.

### 9.3 Question-Load Operational Error

- Show a scoped `role="alert"` with **Không thể tải Quiz. Vui lòng thử lại.**
- Provide **Thử lại** and **Quay lại bộ từ**. Retry preserves the intended type/run identity and prevents duplicate requests.

### 9.4 Inconclusive Answer Request

- Preserve the typed answer and exact pending event payload.
- Display a safe inline alert and change the primary action to **Thử gửi lại**.
- Retrying sends the identical `event_id`, answer, `question_revision`, type and `expected_revision`; the field remains locked against edits that would change the logical request.
- Do not submit `/api/learning/events` and do not fabricate a result.

### 9.5 Question Changed / Membership Changed

- Show an actionable conflict panel: **Nội dung câu hỏi đã thay đổi. Hãy tải lại Quiz để tiếp tục.**
- No correct/incorrect result is claimed and no automatic answer retry occurs.
- Primary action **Tải lại Quiz** fetches and reconciles fresh authorized questions. If reconciliation cannot safely retain the run, require a new run rather than silently grading stale content.

### 9.6 Progress / Retry Conflict

- Show **Tiến độ của từ này đã thay đổi ở một hoạt động khác. Hãy làm mới Quiz để tiếp tục.**
- Primary action **Làm mới Quiz** performs fresh reconciliation. It does not overwrite newer Progress.

All error copy is sanitized and never displays raw server/network details, IDs, revisions or ownership information.

## 10. Completion and Transient Result

Completion replaces the question region after every fetched question has one accepted assessment.

- Focusable `h1`: **Hoàn thành Quiz**.
- Supporting Set/type context.
- Exactly three truthful current-run values:
  - **Tổng số câu**;
  - **Chính xác**;
  - **Chưa chính xác**.
- Primary action **Làm lại Quiz** creates a new `run_id` and restarts the selected type.
- Secondary action **Quay lại bộ từ** returns to the originating Set/fallback.

The summary displays no percentage, grade, durable history, best score, XP, reward, streak, time, recommendation, review queue or share action. Reload in the same tab may restore this transient completion after fresh reconciliation.

## 11. Component Hierarchy

Production implementation should remain feature-scoped and may use this proportional hierarchy:

```text
QuizPage
├── QuizPageHeader
├── QuizTypeSelection
│   └── QuizTypeOption × 2
├── QuizRunView
│   ├── QuizRunProgress
│   ├── QuizQuestionCard
│   │   ├── VietnameseMeaningPrompt OR UnscrambleWordPrompt
│   │   │   └── UnscrambleTilePool + AnswerSlots
│   │   ├── QuizAnswerForm
│   │   └── QuizAnswerFeedback
│   │       └── CharacterFeedback
│   └── QuizRunActions
├── QuizCompletion
├── QuizStatePanel
└── QuizRestartDialog
```

Small components may remain local to the Quiz feature. Do not create a generic design system or rewrite the TASK-084 service/run-state foundation solely for this page.

## 12. Responsive Behavior

### 12.1 Desktop (`> 1024px` content availability)

- Use the existing App Layout main scroll region and a centered `760–860px` Quiz column.
- Type options form two equal cards; the question card remains a single readable column.
- Set context, type and restart action share a compact header row when space permits.
- Feedback and character details wrap within the same column; no document-horizontal scrolling.

### 12.2 Tablet (`641–1024px`)

- Preserve the same content order with approximately `24px` side padding.
- Type cards may remain two columns while readable, otherwise stack.
- Question metadata and actions wrap without changing semantic order.
- Existing App Layout drawer breakpoint remains authoritative.

### 12.3 Mobile (`≤ 640px`)

- Use approximately `16px` side padding and a full available-width question card.
- Type choices stack one per row.
- Set name, progress text and restart action wrap safely; no squeezed toolbar.
- Input and primary action use the available width; interactive targets are at least `44px` where appropriate.
- Character feedback and Unscramble tiles use wrapping semantic lists/groups, never a horizontally scrolling table.
- Long meanings, tile pools, constructed answers, canonical answers and user answers use safe code-point-aware wrapping without clipping.
- No desktop layout is scaled down and no horizontal overflow is introduced.

## 13. Focus, Keyboard and Announcements

- Exactly one page `h1`; question/result/state regions use ordered headings.
- Native radio/input/button/link/dialog semantics are preferred over custom interactive containers.
- Visible `:focus-visible` styling uses the existing ELVocab focus treatment.
- `Tab` order follows the visual order. No positive `tabindex` is used.
- `Enter` submits only from the answer form. No global character shortcut or timer-based transition is introduced.
- After type selection/start or explicit Next, focus moves to the new question heading; the answer field is the next logical control.
- After an accepted keyboard-originated response, focus moves to the result heading once and **Câu tiếp theo** follows in normal Tab order. Mouse/pointer/touch submission leaves focus unassigned after the submitted control disappears, without focusing the heading or next action. Both paths expose one concise polite atomic status containing only the correct/incorrect heading and supporting sentence; canonical answer and character detail remain available through normal document browsing and are not part of the live announcement.
- After completion, focus moves to **Hoàn thành Quiz**.
- Loading uses polite `role="status"`; operational errors/conflicts use scoped `role="alert"`; pending regions expose `aria-busy` and duplicate controls are disabled.
- Validation is visible, programmatically associated with the field and reflected through `aria-invalid` when applicable.
- Result meaning is available through text and icon semantics, not color or animation alone.
- Restart confirmation uses an accessible modal dialog, traps focus while open, supports `Escape`, and restores focus on cancel.

## 14. Motion and Feedback

- Question-to-question transition may use a subtle `180–220ms` fade with slight horizontal movement matching ordered forward progress.
- Result feedback may use a restrained `150–200ms` fade/scale; no shake, confetti, countdown or celebratory gamification.
- Loading skeleton shimmer is optional and non-essential.
- Under `prefers-reduced-motion: reduce`, transitions and shimmer become none or near-instant without removing status changes or focus movement.
- Pending feedback appears immediately and does not wait for animation.

## 15. Visual Direction

- Continue ELVocab's light interface, established typography, primary `#3B5BDB`, pale neutral background, white surfaces, subtle slate borders, rounded cards and restrained shadows.
- Question text uses high-contrast near-black; blue emphasizes primary actions and active progress.
- Correct uses a restrained green tint and explicit check/text; incorrect uses a restrained red/amber tint and explicit status text.
- Type badges and metadata remain compact. The prompt is visually dominant, not the progress chrome.
- Use the existing Lucide icon family; add no font, icon package or UI dependency.
- Avoid Flashcard flip visuals: Quiz is an answer-entry workflow, not another card-reveal activity.

## 16. Explicitly Deferred

- Third, mixed, adaptive or randomized Quiz types.
- Random subsets, question skipping/reordering or immediate re-answer.
- Timer, speed score, accuracy percentage, persistent result/history or answer review screen.
- SRS, `NEEDS_REVIEW`, Words to Review or scheduling.
- XP, Level, Streak, Daily Goal, Achievement, leaderboard or social sharing.
- Pronunciation, audio answer, speech recognition or pronunciation scoring.
- Analytics, charts, AI generation, Admin Quiz management or new backend/data behavior.

## 17. HUMAN Review Decision

No unresolved functional decision blocks this proposal. HUMAN approval is requested for this UI/UX baseline as one package:

1. Quiz remains inside the authenticated App Layout rather than Learning Focus Mode;
2. explicit two-option type selection with one Start action;
3. one centered question workflow with no pre-acceptance navigation;
4. type-specific prompt anatomy and one native answer form;
5. backend-authoritative, non-color correct/incorrect and character feedback;
6. explicit Next/View Result after acceptance;
7. transient three-value completion with Restart/Return only;
8. the stated retry/conflict, focus, responsive and reduced-motion behavior.

This revision has already returned through SPEC/PLAN/TASK because it changes an active Quiz type and question payload. Any further request for new data, persistence, scoring, additional type, rewards, SRS or Pronunciation must return to the appropriate approved workflow stage.

## Approval Gate

```text
ORIGINAL TASK-084 / TASK-085: COMPLETE — HUMAN APPROVED
TASK-086: COMPLETE — HISTORICAL BASELINE; CONTRACT REVISION REQUESTED DURING VISUAL REVIEW
REVISED UI/UX CHECKPOINT: HUMAN APPROVED
TASK-086A: COMPLETE — AWAITING HUMAN REVIEW
TASK-086B: NOT STARTED
TASK-087: BLOCKED UNTIL TASK-086A AND TASK-086B ARE HUMAN APPROVED
NEXT ALLOWED STAGE AFTER HUMAN REVIEW OF TASK-086A: TASK-086B
```
