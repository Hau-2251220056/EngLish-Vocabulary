# Flashcard / Learning V1 — HUMAN-Approved UI/UX Checkpoint

**Source:** `docs/specs/FLASHCARD_LEARNING_V1_SPEC.md`

**Checkpoint status:** `HUMAN APPROVED`

**Implementation authorized by this checkpoint:** `TASK-052 ONLY`

## 1. Visual Direction

The learning route remains inside the existing authentication and `UserRoute` boundary, but `AuthenticatedShell` renders a dedicated full-viewport Focus Mode there: the normal authenticated Header, Sidebar and Footer are absent only while learning. Other authenticated routes retain the normal shell unchanged. The Focus Mode follows the approved ELVocab baseline: clean light surfaces, primary `#3B5BDB`, Plus Jakarta Sans, rounded cards, restrained shadows and restrained animation. It does not introduce a generic Learning dashboard.

The page uses a compact in-workspace toolbar, compact Set progress, one centered Flashcard and one stable shared action slot. Desktop and mobile preserve the same information order and avoid horizontal overflow. Motion is optional decoration; `prefers-reduced-motion` reduces non-essential transitions.

## 2. Card Content Contract

Each Set Item remains one Vocabulary card. The backend continues returning the complete Vocabulary aggregate with every Meaning and Example.

For V1 presentation, the card focuses on one primary Meaning selected without new persistence:

1. Meanings with CEFR are ordered `A1`, `A2`, `B1`, `B2`, `C1`, `C2`.
2. The lowest CEFR wins.
3. Equal CEFR values use the existing deterministic `created_at`, then `id`, order.
4. If no Meaning has CEFR, the first Meaning in that deterministic order wins.

No `primary_meaning_id`, Set-to-Meaning relation or duplicated CEFR field is introduced.

### Front

- Word as the card heading.
- Phonetic when available.
- Compact icon-only pronunciation button centered below the phonetic. It prefers `pronunciation_url` and falls back to browser English `speechSynthesis` when no URL exists and native TTS is supported.
- The safe card surface reveals the answer; there is no separate visible **Hiện nghĩa** button.
- Safe `Space` flips the card only when focus is not in an interactive/editable control.
- Front-to-back reveal starts pronunciation concurrently without waiting for playback; playback failure never blocks reveal. Back-to-front flip does not replay pronunciation.

Assessment actions are hidden before reveal.

### Revealed back

- A compact left-aligned header contains the word/phonetic metadata and an icon-only pronunciation control on the right.
- Primary Meaning part of speech and CEFR when present.
- Vietnamese meaning.
- Optional context.
- Only the first Example from the primary Meaning's deterministic payload order, including its optional Vietnamese translation. The backend payload remains complete.

## 3. Controls and State Transitions

The shared action slot below the card shows Previous/Next only on Front and the two assessment controls only on Back:

- **Học lại** submits `STUDY_AGAIN`.
- **Nhớ rồi** submits `REMEMBERED`.

Only a successful backend event response records the current-run assessment and permits automatic forward progression. While pending, both assessment controls are disabled and duplicate submission is prevented; only the submitted outcome button displays its pending indicator. An inconclusive retry reuses the same `event_id` and `expected_revision`; a progress conflict refreshes/reconciles before another assessment.

Previous/Next inspection, reveal, audio, reload, restart and summary viewing remain UI-only actions. Restart requires confirmation when assessments exist, clears only Learning-owned transient run state and returns to the first card without changing durable progress.

Completion occurs when every current card has a successful current-run assessment. The summary shows total, **Nhớ rồi** count and **Học lại** count, with actions to restart the current Set or return to its Set detail. It claims no XP, Streak, SRS schedule or persisted Learning Session.

## 4. Required Page States

- Authorized payload loading with an announced polite status.
- Safe load error with retry.
- Empty/inaccessible/not-found Set with an actionable return path.
- Front and revealed card states.
- Audio failure isolated from assessment state.
- Event pending with disabled duplicate actions.
- Event failure preserving revealed content and retry context.
- Stale Item/progress conflict with actionable refresh/reconciliation.
- Restart confirmation.
- Completed-run summary.

## 5. Accessibility and Keyboard

- One page `h1`; the current word is a clear card heading.
- Native buttons and links retain visible focus and proper disabled/`aria-busy` semantics.
- Status changes use `role="status"`; actionable failures use `role="alert"` without destroying retry context.
- Reveal moves focus to the revealed Meaning heading; successful assessment moves focus to the next card heading; completion moves focus to the summary heading.
- `Enter`/`Space` retain native activation. Card shortcuts never fire while focus is in a button, link, input, select, textarea or other editable control. Activating the speaker never flips the card.
- Left/right navigation, if implemented as shortcuts, mirrors visible Previous/Next controls and cannot submit an assessment.
- No information or action depends on color, hover, motion or pointer gestures alone.

## 6. Responsive Rules

- Desktop targets one no-document-scroll viewport for normal content, with toolbar, progress, card and action slot visible.
- Mobile preserves the Focus Mode, keeps paired controls compact and readable, and provides at least 44px touch targets.
- Long words scale/wrap safely; normal Back content fits without an internal scrollbar.
- Abnormally long content or unusually short viewports may use a safe internal/page overflow fallback rather than clipping information.
- The two-way card flip uses a 500ms Y-axis rotation; reduced-motion mode shortens it to a near-instant transition.

## 7. Explicit Boundaries

- No final UI is implemented by this document.
- No SRS algorithm, review queue, Quiz, XP, Dashboard, Pronunciation Practice, Community or AI is added.
- Future SRS may replace the two V1 assessment buttons with `Again / Hard / Good / Easy`; this checkpoint neither implements nor predefines that algorithm.
- Backend authorization, event validation, progress transitions and complete payload contracts remain unchanged.

## Approval Gate

```text
TASK-051 STATUS: COMPLETE
HUMAN UI/UX APPROVAL: APPROVED
NEXT ALLOWED TASK: TASK-052
FINAL FLASHCARD UI IMPLEMENTATION: AUTHORIZED ONLY TO THIS CHECKPOINT
```
