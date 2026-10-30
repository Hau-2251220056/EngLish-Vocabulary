# SPEC: Daily Goal V1 — Active Learning Time and In-App Notifications

**Feature status:** `TODO`

**SPEC status:** `HUMAN APPROVED`

**Authoring scope:** This document defines product behavior and testable boundaries only. It does not authorize PLAN, TASK, implementation, migration, deployment, or external-service configuration.

---

## 1. Objective

Daily Goal V1 gives an authenticated `USER` an account-scoped daily learning-time target, records cumulative valid Active Learning Time across the four approved learning activities, and provides motivating feedback without changing the activities' existing learning outcomes.

The feature must:

- measure learning time rather than XP earned;
- prevent overlapping time from being counted more than once across tabs or devices;
- pause safely when the learner becomes idle, hides the page, loses focus, sleeps the device, or loses authoritative recording ownership;
- continue recording valid time beyond the configured target;
- award exactly `+10 XP` at most once per USER/application day on the first eligible completion;
- preserve existing XP, Level, SRS, Quiz, Speaking Practice, Learning Session, and Streak rules;
- provide a persisted in-app Notification Center and a best-effort inactivity reminder while ELVocab remains running.

The application timezone is `Asia/Ho_Chi_Minh`. An application day begins at `00:00:00` and ends immediately before the next midnight in that timezone.

---

## 2. Actors and Authorization

- **USER:** May configure and read only their own Daily Goal, accrue only their own Active Learning Time, receive only their own Daily Goal reward and notifications, and mark only their own notifications as read.
- **Guest:** Cannot use Daily Goal tracking, settings, reward, reminder, or Notification Center APIs. Existing unauthenticated behavior remains authoritative.
- **ADMIN:** Does not receive USER Daily Goal tracking, USER Daily Goal reward, USER Daily Goal card, or USER Notification Center behavior in V1. The existing neutral ADMIN Dashboard remains unchanged.

Backend authentication and `USER` role authorization are mandatory. The frontend may control presentation but is not an authorization or accounting boundary.

Client requests must not choose another owner, authoritative elapsed seconds, application date, timezone, XP amount, Level, completion result, Streak state, notification owner, or notification eligibility.

---

## 3. Definitions

- **Active Learning Time:** Backend-accepted, non-overlapping seconds during an eligible, ready learning screen before idle, visibility, focus, ownership, lifecycle, or validation rules pause accounting.
- **Qualifying activity:** Normal Flashcard, SRS, Multiple Choice Quiz, or Speaking Practice.
- **Ready learning screen:** An authorized qualifying activity has finished its required load/reconciliation and is presenting an unfinished learning item that the USER can study or act upon.
- **Meaningful interaction:** An approved activity-specific learning action that demonstrates continued engagement and resets the 120-second idle window.
- **Idle threshold:** 120 consecutive seconds without a meaningful interaction while the learning screen would otherwise be eligible.
- **Tracking session:** An independent, server-recognized Daily Goal tracking identity for one qualifying activity instance in one tab/device context. It is separate from presentation-only browser storage and does not itself change learning results.
- **Active Time Owner:** The single tracking session currently authorized to add Active Learning Time for a USER.
- **Ownership generation/fence:** A server-authoritative value that invalidates delayed requests from an earlier owner after ownership changes.
- **Current goal-completion state:** Whether the current day's recorded seconds meet the currently effective target.
- **Reward-earned state:** Whether the USER has already received the one permitted Daily Goal `+10 XP` reward for the application day. This state is durable and independent of later target changes.
- **Inactivity reminder:** A persisted in-app notification that may be created after approximately ten minutes without qualifying learning activity while at least one authenticated ELVocab tab remains running.
- **Inactivity-reminder preference:** An account-scoped, persisted USER preference that defaults to enabled when no value has been saved and controls only creation of new inactivity reminders.
- **Completion notification:** A persisted in-app notification created for the first rewarded Daily Goal completion of an application day.

---

## 4. Scope

### 4.1 In Scope

- Account-scoped Daily Goal setup and editing from a Dashboard Daily Goal card.
- Presets of 10, 15, 20, 25, and 30 minutes.
- Custom integer targets from 10 through 240 minutes inclusive.
- Cumulative Active Learning Time for Normal Flashcard, SRS, Multiple Choice Quiz, and Speaking Practice.
- Cumulative eligible time before and after the USER configures their first target, without historical or offline backfill.
- One authoritative recorder per USER with non-overlap, idempotency, ownership transfer, and stale-request protection.
- Shared 120-second idle handling and an accessible Idle Pause Modal across all four activities.
- Immediate pause on hidden or blurred learning tabs.
- Correct Vietnam application-day allocation, including intervals spanning midnight.
- Continued time recording after target completion.
- Exactly one fixed `+10 XP` Daily Goal reward per USER/application day.
- Independent current completion and reward-earned projections.
- Persisted USER-owned in-app notifications, unread count, read/unread state, and authenticated-header Bell UI.
- An account-scoped inactivity-reminder toggle in the Dashboard Daily Goal card, enabled by default and persisted across sessions/devices.
- One best-effort inactivity reminder per USER/application day while ELVocab remains running.
- One completion notification per rewarded application day, independent of inactivity reminder limits.
- Loading, error, empty/unset, unsupported-storage, offline, retry, concurrency, responsive, and accessible states required for the approved flow.

### 4.2 Out of Scope

- XP-based Daily Goal targets or activity-XP progress.
- Reinterpreting legacy `USER.daily_xp_goal` as minutes.
- The historical percentage-based Daily Goal bonus.
- Email, Web Push, Browser Notifications permission, Service Worker notification delivery, VAPID, Cloudflare Workers, QStash, queues, or any external reminder scheduler.
- Notifications after every ELVocab tab has closed.
- Retroactive inactivity notifications after reopening the application or waking from a long device sleep.
- A full notification Settings module, a completion-notification toggle, or notification preferences beyond the narrow Daily Goal inactivity-reminder control.
- Notification email/SMS channels, marketing campaigns, social notifications, or ADMIN broadcast notifications.
- A product-visible activity timeline, time-entry history, XP transaction history, or surveillance/attention analytics.
- Offline elapsed-time backfill.
- Pronunciation scoring, audio upload, transcript persistence, confidence history, or Backend speech processing.
- New Quiz types, SRS algorithm changes, Flashcard assessment rules, Streak qualification changes, achievements, leaderboard, ranking, or additional XP reward sources.
- Persisted Level, a second XP balance, or changes to approved Level thresholds.

---

## 5. User Flows

### 5.1 First-use Dashboard setup

1. An authenticated USER opens Dashboard.
2. The Daily Goal card shows an unset state without blocking access to the rest of ELVocab.
3. Eligible same-day Active Learning Time may already exist because tracking operates before initial goal configuration.
4. The USER chooses a preset or enters a custom integer from 10 through 240 minutes.
5. Frontend validation provides an inline error for invalid input.
6. Backend independently validates the request.
7. A successful first save applies the target without resetting recorded time and immediately evaluates the current day's authoritative seconds.
8. If those seconds meet or exceed the new target, the first setup, completion evaluation, one reward, XP increment, and completion notification commit atomically and idempotently. Otherwise, the saved time remains and later eligible learning continues accumulating.

### 5.2 Active learning

1. The USER opens one of the four qualifying activities.
2. No time is counted while the activity is loading, unavailable, completed, or otherwise not ready.
3. When an unfinished item is ready and the screen is visible and focused, the tracking session requests recording ownership whether or not the USER has configured a target.
4. Valid reading/thinking time counts while the idle window remains active even if no interaction occurs during each individual second.
5. Meaningful activity-specific actions reset the idle window.
6. Hidden, blurred, idle, completed, inaccessible, or exited activity state pauses accounting.
7. Valid time continues to accumulate after the configured target is reached.

### 5.3 Idle pause and resume

1. At 120 seconds without a meaningful interaction, accounting pauses without discarding already confirmed time.
2. If the learning screen is visible, the shared Idle Pause Modal appears.
3. The modal heading is **Phiên học đang tạm dừng**.
4. The primary action is **Tiếp tục học**.
5. The learning activity's current card, question, rating state, target, transient result, and accepted Backend progress remain unchanged.
6. Explicit resume restarts the local idle window and requests valid ownership; it does not guarantee ownership if another session wins concurrently.

### 5.4 Goal completion and edits

1. Backend evaluates completion from authoritative current-day Active Learning Time and the currently effective target.
2. The first transition to eligible completion inserts the one Daily Goal reward, atomically increments `USER.total_xp` by 10, and creates a completion notification.
3. Reducing the goal may cause immediate completion and reward issuance if the reward has not already been earned that day.
4. Increasing the goal may make the current progress incomplete again.
5. A previously earned reward remains earned and is neither revoked nor issued again.

### 5.5 In-app notifications

1. The authenticated USER can open the Notification Center from a Bell icon in the authenticated header.
2. The Bell exposes an accessible unread count.
3. The USER can read their persisted notifications and mark them read.
4. While ELVocab remains running, an app-level monitor may request reminder eligibility after approximately ten minutes without qualifying learning activity.
5. The inactivity-reminder preference defaults to enabled, and the USER may disable or re-enable it from the Dashboard Daily Goal card across sessions/devices.
6. Backend creates a reminder only after authoritative preference, eligibility, and idempotency checks.
7. Disabling prevents new inactivity reminders without deleting existing notifications; re-enabling does not backfill reminders missed while disabled.
8. Closing every ELVocab tab ends V1 monitoring; reopening does not backfill a missed reminder.

---

## 6. Business Rules

### 6.1 Goal configuration and progress

- **BR-DG-001:** Daily Goal V1 measures Active Learning Time and never interprets activity XP as time progress.
- **BR-DG-002:** A target is account-scoped; browser session storage is not its source of truth.
- **BR-DG-003:** `NULL`/unset means the USER has not configured a Daily Goal; it does not prevent eligible Active Learning Time from being recorded.
- **BR-DG-004:** The UI offers presets 10, 15, 20, 25, and 30 minutes.
- **BR-DG-005:** A custom target must be an integer from 10 through 240 minutes inclusive.
- **BR-DG-006:** Frontend and Backend both validate the target, but Backend validation is authoritative.
- **BR-DG-007:** Setting or editing a goal applies immediately, does not reset current-day Active Learning Time, and reevaluates the authoritative current-day seconds against the saved target.
- **BR-DG-008:** Legacy `USER.daily_xp_goal` remains XP-denominated legacy data and is never read or migrated as learning minutes.
- **BR-DG-009:** Valid Active Learning Time continues accumulating after the current target is reached.
- **BR-DG-010:** Recorded Active Learning Time is not capped at 240 minutes or at the current goal.
- **BR-DG-011:** The displayed ratio uses actual time and current target, such as `30/15 phút`; only the visual progressbar is capped at 100%.

### 6.2 Qualifying activities and meaningful engagement

- **BR-DG-012:** Only Normal Flashcard, SRS, Multiple Choice Quiz, and Speaking Practice can accrue Active Learning Time.
- **BR-DG-013:** Dashboard use, Set browsing, loading states, unavailable/error screens, unrelated navigation, and post-completion screens accrue zero time.
- **BR-DG-014:** Opening an activity does not count until an authorized, unfinished learning item is ready.
- **BR-DG-015:** Legitimate reading and thinking time counts until the 120-second idle threshold while all other eligibility conditions remain true.
- **BR-DG-016:** Only meaningful activity-specific interactions reset the idle window.
- **BR-DG-017:** Mouse movement, generic scrolling, unrelated clicks, arbitrary keyboard events, timer callbacks, response arrival, and generic heartbeat do not reset the idle window.
- **BR-DG-018:** Normal Flashcard meaningful interactions include deliberate reveal, card navigation, and requested reference-pronunciation playback while the session/item is valid.
- **BR-DG-019:** SRS meaningful interactions include deliberate reveal, requested reference-pronunciation playback, and an eligible rating command. Existing rating acceptance, retry, and scheduling semantics remain authoritative.
- **BR-DG-020:** Multiple Choice Quiz meaningful interactions include selecting an answer, submitting an answer, and deliberately advancing to an unfinished question/batch. Existing Backend grading remains authoritative.
- **BR-DG-021:** Speaking Practice meaningful interactions include requested sample playback, requesting/stopping recognition, and deliberate current-target navigation. Merely receiving a late native event is not a meaningful interaction.
- **BR-DG-022:** Restart confirmations, operational retries, and navigation away do not independently prove learning engagement.

### 6.3 Idle, visibility, focus, and lifecycle

- **BR-DG-023:** At 120 seconds without meaningful interaction, time accounting stops prospectively; previously confirmed eligible seconds remain recorded.
- **BR-DG-024:** A visible unfinished learning screen shows the shared Idle Pause Modal after the idle threshold.
- **BR-DG-025:** The modal preserves the activity's current learning state and requires explicit **Tiếp tục học** action.
- **BR-DG-026:** Hidden or blurred learning tabs stop accounting immediately from the client's observable lifecycle boundary.
- **BR-DG-027:** Returning within 120 seconds may resume automatically only if the activity remains unfinished, valid, visible, focused, and locally non-idle.
- **BR-DG-028:** Returning after 120 seconds requires the Idle Pause Modal and explicit resume.
- **BR-DG-029:** A long sleep/wake gap counts no unverified sleep time, preserves confirmed activity state, and shows the modal on return to an unfinished learning screen.
- **BR-DG-030:** Completion, route exit, session invalidation, logout, inaccessible content, or unmount stops the corresponding tracking session without changing existing learning results.

### 6.4 Speaking Practice

- **BR-DG-031:** Speaking reuses its approved transient lifecycle, exact Vocabulary identity, cancellation behavior, and existing recognition watchdogs.
- **BR-DG-032:** Genuine requested sample playback may remain eligible only while bounded playback is active and the screen meets all other eligibility rules.
- **BR-DG-033:** Recognition `STARTING`, `LISTENING`, and `FINALIZING` may remain eligible only while their existing finite watchdog/lifecycle rules remain active.
- **BR-DG-034:** Playback and recognition never grant indefinite idle exemption; missing native completion events must be bounded by PLAN-defined finite safeguards.
- **BR-DG-035:** Daily Goal adds no pronunciation score, audio upload, transcript persistence, or Backend speech evaluation.

### 6.5 Multi-tab and multi-device accounting

- **BR-DG-036:** For one USER, one real elapsed second can contribute at most one second to Daily Goal regardless of tab or device count.
- **BR-DG-037:** Every tracking context has an independent server-recognized tracking-session identity.
- **BR-DG-038:** At most one tracking session is the authoritative Active Time Owner for a USER at a serialized Backend point.
- **BR-DG-039:** Another session may continue its normal learning behavior while non-owner, but it adds no Daily Goal time and shows a small non-blocking ownership status.
- **BR-DG-040:** A meaningful interaction in a visible eligible non-owner session may request immediate ownership transfer.
- **BR-DG-041:** A background heartbeat cannot take ownership from a different still-valid owner.
- **BR-DG-042:** A visible, focused, non-idle session may reclaim ownership through a heartbeat only after the prior ownership is expired or invalid.
- **BR-DG-043:** Ownership changes use a Backend-issued generation/fence; requests from an earlier generation add zero time after handoff.
- **BR-DG-044:** Time accounting uses bounded, idempotent, server-validated intervals and never trusts arbitrary client timestamps or durations.
- **BR-DG-045:** Eligible pre-handoff time is preserved only when server-verifiable, bounded, non-overlapping, and idempotent. Ambiguous time may be undercounted rather than double-counted.
- **BR-DG-046:** Hidden-tab, sleep, expired-lease, unsupported offline, or otherwise unverifiable elapsed time is never backfilled.

### 6.6 Day boundary

- **BR-DG-047:** Backend assigns time using `Asia/Ho_Chi_Minh`; the client cannot select the application date or timezone.
- **BR-DG-048:** A verified accounting interval crossing Vietnam midnight is split so each second belongs to the correct application day.
- **BR-DG-049:** Goal completion, reward uniqueness, and reminder uniqueness are evaluated independently for each application day.

### 6.7 Completion, XP, Level, and Streak

- **BR-DG-050:** Current completion is true only when a valid target exists and authoritative seconds for the application day meet or exceed that currently effective target.
- **BR-DG-051:** No Daily Goal completion reward is eligible while the target is unset. Once a valid target exists, the first eligible completion awards exactly `+10 XP`, independent of target length.
- **BR-DG-052:** At most one Daily Goal reward is awarded per USER/application day across goal edits, retries, tabs, devices, and concurrent requests.
- **BR-DG-053:** Completion evaluation, reward creation, `USER.total_xp` increment, and completion-notification creation are atomic and idempotent where they arise from the same first completion operation, including initial goal setup.
- **BR-DG-054:** Reducing the target can trigger completion and the one reward when current time meets the new target.
- **BR-DG-055:** Increasing the target above current time changes current completion to false but does not revoke or repeat an already earned reward.
- **BR-DG-056:** API/UI projections distinguish current completion from reward-earned state.
- **BR-DG-057:** Existing XP/Level thresholds and SRS/Quiz reward eligibility remain unchanged; Daily Goal adds only the approved fixed reward source.
- **BR-DG-058:** Daily Goal completion and reward create no Streak qualification or `STREAK_DAY` record.
- **BR-DG-059:** Existing NORMAL/SRS/Quiz Streak session evidence and completion rules remain unchanged, and Speaking remains non-qualifying for Streak.

### 6.8 Notification Center and reminders

- **BR-DG-060:** Notifications are persistent, USER-owned, Backend-authored records with read/unread state.
- **BR-DG-061:** The authenticated USER header contains a keyboard-accessible Bell control and an accessible unread count.
- **BR-DG-062:** A first rewarded Daily Goal completion creates at most one completion notification for that application day in the same authoritative completion transaction; no completion notification exists before a valid target produces completion.
- **BR-DG-063:** A completion notification is an achievement/system notification that is independent of both the inactivity-reminder preference and the inactivity-reminder daily limit.
- **BR-DG-064:** An inactivity reminder may be created only after approximately ten minutes without qualifying learning activity while at least one authenticated ELVocab tab has remained running.
- **BR-DG-065:** Background throttling may delay reminder creation; V1 promises no exact delivery timestamp.
- **BR-DG-066:** Backend creates an inactivity reminder only if the current goal is configured and incomplete, no valid qualifying learning activity is underway elsewhere, the account-scoped inactivity-reminder preference is enabled, and no inactivity reminder exists for the USER/application day. An unset target never permits an inactivity reminder even when the preference is enabled by default.
- **BR-DG-067:** An untouched Idle Pause Modal and navigation from learning to Dashboard do not suppress an otherwise eligible reminder.
- **BR-DG-068:** At most one inactivity reminder is created per USER/application day across tabs, devices, retries, and concurrent eligibility checks.
- **BR-DG-069:** Closing every ELVocab tab prevents later reminder creation for that closed interval; reopening does not create a retroactive reminder.
- **BR-DG-070:** A long sleep/wake gap does not create a retroactive inactivity reminder on wake.
- **BR-DG-071:** If learning resumes before reminder creation commits, current Backend activity invalidates the reminder candidate. A notification already committed before a nearly simultaneous resume may remain visible.
- **BR-DG-072:** V1 uses no email, Web Push, Browser Notifications permission, Service Worker push delivery, VAPID, or external scheduler.
- **BR-DG-073:** The inactivity-reminder preference defaults to enabled when the USER has never saved a preference.
- **BR-DG-074:** The USER may disable or re-enable inactivity reminders from the Dashboard Daily Goal card; the account-scoped value persists across sessions and devices.
- **BR-DG-075:** Disabling the preference prevents creation of new inactivity reminders while disabled but does not delete or alter existing persisted notifications.
- **BR-DG-076:** Re-enabling the preference affects future eligibility only and never backfills a reminder missed while disabled.
- **BR-DG-077:** The inactivity-reminder preference never suppresses the completion notification created with the first Daily Goal reward of an application day.
- **BR-DG-078:** V1 provides no separate completion-notification toggle and requires no full notification Settings module.

---

## 7. Data Requirements

Detailed table names and field layout belong to PLAN. The persisted model must nevertheless support these high-level invariants:

1. A nullable account-owned minute target independent of legacy `daily_xp_goal`, with Backend-enforced integer range 10–240.
2. One authoritative current-day aggregate per USER/application day with uncapped nonnegative active seconds and last qualifying-activity information; this aggregate may exist while the target remains `NULL`/unset.
3. Independent tracking-session identities for tabs/devices and one serialized USER-level owner lease/generation boundary.
4. Idempotent positive-time receipts or equivalent durable evidence sufficient to reject duplicate operations and stale generations without becoming a product-visible activity history.
5. One durable Daily Goal reward identity per USER/application day, suitable for atomic `+10 XP` issuance without weakening the existing Vocabulary-scoped `XP_REWARD` constraints.
6. Persistent USER-owned notifications with type, application day, creation time, and nullable read time.
7. One persisted account-scoped inactivity-reminder preference whose effective value is enabled when no preference has previously been saved.
8. Database uniqueness for one Daily Goal reward, one completion notification, and one inactivity reminder per USER/application day as applicable.
9. Indexes supporting owner lookup, due reminder eligibility, current-day progress, unread count/list, and bounded cleanup without broad scans.
10. A documented finite retention policy for ephemeral ownership/tracking receipts. Durable daily progress, reward, preference, and notification retention must be defined in PLAN consistently with account lifecycle and privacy requirements.

`XP_REWARD` currently requires a Vocabulary identity and constrains existing reward types/amounts. PLAN must prefer an additive Daily Goal reward boundary or explicitly prove that any generalization preserves all approved XP anti-farming constraints.

---

## 8. API Requirements

Exact paths and payload schemas belong to PLAN. The API surface must provide authenticated USER-only operations for:

- reading current Daily Goal settings, current-day actual seconds, current completion, reward-earned state, and display-ready XP/Level projection where relevant;
- creating/updating the minute target with 10–240 integer validation and immediate evaluation of already-recorded authoritative current-day seconds;
- establishing/reading a tracking session and current ownership state;
- requesting ownership through an eligible meaningful interaction;
- sending idempotent bounded heartbeats and explicit pause/close lifecycle signals;
- reading a paginated/reasonably bounded notification list and unread count;
- marking only current-USER notifications read;
- reading and updating the current USER's account-scoped inactivity-reminder preference;
- requesting an inactivity-reminder eligibility check from an app instance that has remained running.

API rules:

- Guest uses existing `401` behavior; authenticated non-USER roles use existing `403` behavior.
- Unknown fields, malformed identities, invalid activity types, invalid sequences/generations, and invalid target values are rejected safely.
- Replay of an identical accepted operation returns an idempotent current projection without adding time, XP, reward, or notifications again.
- Stale/fenced ownership commands return a safe conflict/current-owner projection and add zero time.
- Client requests contain no authoritative seconds, application date, reward amount, Level, Streak change, notification content/type selection, or foreign owner ID.
- Progress update, first completion reward, XP increment, Level projection source state, and completion-notification creation commit atomically where they arise from the same operation.
- First-time goal setup or later goal update and any resulting completion evaluation, first reward, XP increment, and completion notification are atomic and idempotent.
- Tracking operations may persist valid current-day time while the target is unset, but they return no completion reward and create no inactivity reminder until a valid target exists.
- Reminder eligibility uses the persisted preference, treating no saved preference as enabled; preference updates cannot delete notifications or request retroactive reminder creation.
- The inactivity-reminder preference has no effect on atomic completion-notification creation.
- Notification reads and mutations never expose another USER's records.

TASK-263 monitor delivery is staged without changing the approved final reminder behavior. B3 establishes, maintains, and closes authenticated owner-scoped monitor sessions and prepares the internal check lifecycle, including transactional server-authoritative continuity and eligibility-baseline transitions. A check gap exceeding 150 seconds resets both baselines without backfilling a reminder. B3 neither evaluates final reminder eligibility nor creates reminder notification rows, introduces no monitor generation/lease field, and does not publish the monitor check endpoint or return a placeholder `reminder_created: false`. B4 completes the public monitor-check contract, eligibility evaluation, reminder creation and deduplication before that route is exposed.

---

## 9. UI/UX and Accessibility Requirements

### 9.1 Dashboard Daily Goal card

- Appears only for authenticated USER.
- Provides non-blocking first-use setup; no mandatory onboarding route.
- Supports the five presets and an accessible custom integer input.
- Provides an accessible inactivity-reminder toggle that reflects the account-scoped value, defaults to enabled when unsaved, and exposes save-pending, success, and safe error/retry states.
- Associates labels, instructions, and inline validation errors with the input.
- Shows actual/target minutes, current completion, and reward-earned state without relying on color alone.
- Caps only visual progress at 100% and preserves actual values above the goal.
- Distinguishes an incomplete current target from an already-earned reward after a later goal increase.
- Has accessible loading, unset, success, stale/error, retry, and save-pending states.
- Avoids layout overflow at existing mobile breakpoints and supports zoom/reflow conventions.

### 9.2 Idle Pause Modal

- Uses an accessible modal-dialog pattern with labelled heading and focus containment.
- Moves focus to the resume action when opened and restores meaningful activity focus after resume.
- Prevents background learning controls from being operated while modal.
- Escape/cancel behavior must not silently resume accounting.
- Uses no required animation and respects reduced-motion settings.
- Does not clear or recreate the underlying learning run.

### 9.3 Non-owner status

- Is small, non-blocking, and understandable without color alone.
- Does not disable the activity's learning controls.
- Does not claim that learning progress, Quiz grading, SRS scheduling, or Speaking behavior has stopped.
- Updates when ownership is acquired, lost, expired, or restored.

### 9.4 Notification Center

- Bell is keyboard operable, has an accessible name, and exposes unread state/count without color alone.
- Panel/list has loading, empty, success, and safe error/retry states.
- Read/unread controls have explicit accessible names.
- Opening or reading notifications does not create learning time or reset learning idle state.
- Completion may also use the existing transient toast for immediate feedback, but toast is not the persisted notification source of truth.

---

## 10. Failure and Recovery Rules

- A network outage does not authorize offline elapsed-time reconstruction. Already confirmed Backend time remains intact.
- Delayed requests outside their valid owner generation/lease add zero time.
- A tab crash may lose a small unconfirmed interval; correctness favors bounded undercount over overlap or fabricated time.
- Hidden tabs and sleeping devices do not accumulate time through throttled timers.
- On wake after a long gap, the unfinished activity is paused and requires explicit resume.
- If browser storage is unavailable, activity presentation uses its existing fallback where available; authoritative Daily Goal state remains server-owned.
- If a heartbeat fails, learning activity behavior continues; Daily Goal shows a non-blocking tracking/retry state and does not fabricate progress.
- If reward/notification transaction fails, no partial XP, reward, completion notification, or aggregate mutation from that transaction may remain committed.
- If notification list loading fails, core learning and Daily Goal tracking remain usable.
- Malformed/stale tracking state is discarded or reconciled safely and cannot grant ownership or time.
- Logout/session invalidation stops local monitoring and clears only appropriate transient tracking coordination state; persisted USER data remains Backend-owned.

---

## 11. Privacy and Security

- Store only the minimum tracking evidence required for ownership, idempotency, daily accounting, and bounded operational investigation.
- Do not store raw mouse movement, scrolling, arbitrary keystrokes, microphone audio, Speaking transcripts, or pronunciation confidence as Daily Goal evidence.
- Do not expose internal owner/device identities, database constraints, receipts, or other USER data in public responses/errors.
- Tracking-session identities and fencing tokens are untrusted inputs until authenticated, owner-scoped, and validated by Backend state.
- Rate and payload limits must protect ownership and heartbeat endpoints from flooding.
- Notification title/body or structured content is Backend-authored; client-controlled HTML is not accepted.
- Existing password, session-cookie, authorization, Set ownership, and safe not-found boundaries remain unchanged.
- Retention and account-deletion behavior for tracking receipts, daily aggregates, rewards, and notifications must be finalized in PLAN and synchronized with `DATABASE.md`.

---

## 12. Acceptance Criteria

- **AC-DG-001:** An authenticated USER with an unset goal sees a non-blocking Dashboard setup card and can use the rest of ELVocab normally.
- **AC-DG-002:** Presets 10, 15, 20, 25, and 30 save successfully when Backend validation succeeds.
- **AC-DG-003:** Custom integer targets 10 and 240 are accepted; values below 10, above 240, non-integers, empty values, and invalid types are rejected inline and by Backend.
- **AC-DG-004:** Guest requests are rejected with existing authentication behavior and ADMIN receives no USER Daily Goal surface or mutation access.
- **AC-DG-005:** Goal edits apply immediately without resetting current-day recorded seconds.
- **AC-DG-006:** No Daily Goal logic interprets or migrates `USER.daily_xp_goal` as minutes.
- **AC-DG-007:** Ready unfinished Normal Flashcard, SRS, Multiple Choice Quiz, and Speaking Practice screens can accrue valid time; Dashboard, loading, error, inaccessible, and completed screens cannot.
- **AC-DG-008:** Reading/thinking time before the 120-second idle threshold counts while all other eligibility requirements hold.
- **AC-DG-009:** Approved activity-specific interactions reset idle, while mouse movement, scroll, unrelated clicks, arbitrary keys, and heartbeat alone do not.
- **AC-DG-010:** At exactly the idle boundary, further time stops without removing previously accepted seconds and the visible unfinished activity shows the shared modal.
- **AC-DG-011:** The modal shows **Phiên học đang tạm dừng** and **Tiếp tục học**, is keyboard/focus accessible, and preserves the exact learning run state.
- **AC-DG-012:** Hiding or blurring a learning tab pauses accounting immediately; a valid return under 120 seconds may resume automatically.
- **AC-DG-013:** A return after 120 seconds or a long sleep/wake gap requires explicit resume and adds no hidden/sleep time.
- **AC-DG-014:** Speaking sample playback and recognition phases count only while genuinely active, valid, bounded, visible, focused, and non-idle.
- **AC-DG-015:** Daily Goal introduces no audio upload, transcript persistence, pronunciation scoring, or changes to Speaking outcome classification.
- **AC-DG-016:** Two tabs or devices attempting to record concurrently result in at most one owner and no overlapping counted seconds.
- **AC-DG-017:** A meaningful interaction can transfer ownership; the prior tab continues learning normally but records no Daily Goal time and receives a non-blocking status.
- **AC-DG-018:** Background heartbeat cannot steal a still-valid owner; a visible non-idle session may reclaim only after expiry/invalidation.
- **AC-DG-019:** A delayed old-generation request, duplicate operation, or replay adds zero duplicate seconds and cannot renew stale ownership.
- **AC-DG-020:** Network-offline, hidden, sleep, expired, or unverifiable intervals are not backfilled.
- **AC-DG-021:** A verified interval spanning Vietnam midnight is allocated across the two correct application days.
- **AC-DG-022:** Actual time continues above target; `30/15 phút` is representable and only the visual progressbar is capped at 100%.
- **AC-DG-023:** The first time current-day seconds meet the effective target, exactly one `+10 XP` reward and one completion notification are committed atomically.
- **AC-DG-024:** Concurrent completion requests, duplicate heartbeats, multiple devices, and retry produce at most one Daily Goal reward and one XP increment per USER/application day.
- **AC-DG-025:** Reducing the goal below accumulated time can immediately complete and reward once; it does not reset time.
- **AC-DG-026:** Increasing the goal above accumulated time makes current completion false while reward-earned remains true and no XP is revoked or repeated.
- **AC-DG-027:** Daily Goal reward preserves existing Level thresholds and existing SRS/Quiz reward amounts, eligibility, replay, and anti-farming behavior.
- **AC-DG-028:** Daily Goal completion/reward inserts no Streak day and does not alter NORMAL/SRS/Quiz Streak evidence or Speaking's Streak exclusion.
- **AC-DG-029:** The USER header Bell exposes the current USER's unread count and opens a persisted owner-scoped notification list.
- **AC-DG-030:** A USER can mark only their own notification read; another USER's notification remains undisclosed and unchanged.
- **AC-DG-031:** First rewarded completion creates at most one completion notification for the day, regardless of whether an inactivity reminder also exists.
- **AC-DG-032:** While ELVocab remains running, an incomplete configured goal with no valid active learning elsewhere may create one inactivity reminder after approximately ten minutes.
- **AC-DG-033:** An active owner elsewhere, a completed current goal, a reminder preference that does not permit delivery, or an existing same-day inactivity reminder prevents reminder creation.
- **AC-DG-034:** Multiple open tabs or devices performing reminder eligibility checks concurrently create at most one persisted inactivity reminder per USER/application day after the current preference and all other eligibility conditions are evaluated authoritatively.
- **AC-DG-035:** Leaving an unfinished activity for Dashboard or leaving the Idle Pause Modal untouched does not by itself prevent later reminder eligibility.
- **AC-DG-036:** Closing all ELVocab tabs and later reopening creates no retroactive reminder for the closed interval.
- **AC-DG-037:** Waking after a long sleep creates no retroactive inactivity reminder.
- **AC-DG-038:** Background timer throttling may delay a reminder without causing duplicate notifications or a false exact-time claim.
- **AC-DG-039:** If learning resume commits before reminder eligibility evaluation, no reminder is created; an already committed reminder need not be revoked by a later resume.
- **AC-DG-040:** Time tracking, ownership loss, idle pause, and notification failures do not alter Quiz answers, SRS scheduling, Flashcard cursor/evidence, Speaking transient results, or activity completion semantics.
- **AC-DG-041:** Daily Goal tracking failures are non-destructive and do not fabricate time, XP, completion, Streak, or notifications.
- **AC-DG-042:** Dashboard card, modal, ownership status, Bell, and notification panel support keyboard operation, visible focus, non-color-only meaning, reduced motion, and responsive reflow.
- **AC-DG-043:** The feature uses no email, Web Push, Browser Notification permission, Service Worker push delivery, VAPID, Cloudflare, QStash, or external scheduler.
- **AC-DG-044:** Persisted tracking evidence excludes raw pointer/scroll/keystroke streams, microphone audio, transcripts, and pronunciation-confidence history.
- **AC-DG-045:** Given an authenticated USER with an unset target, eligible activity time is recorded under all existing idle, visibility, focus, ownership, concurrency, and validation rules, while no Daily Goal reward, completion notification, or inactivity reminder is created.
- **AC-DG-046:** Given an unset target and 20 recorded eligible minutes, when the USER first saves a 15-minute target, Dashboard can show `20/15 phút`, current completion becomes true, and exactly one `+10 XP` reward and one completion notification commit atomically.
- **AC-DG-047:** Given an unset target and 10 recorded eligible minutes, when the USER first saves a 15-minute target, Dashboard can show `10/15 phút`, no reward or completion notification is created, the 10 minutes remain unchanged, and subsequent eligible time continues accumulating.
- **AC-DG-048:** Replayed, retried, concurrent, or racing first-setup/update requests cannot duplicate the Daily Goal reward, XP increment, or completion notification for the application day.
- **AC-DG-049:** Time recorded before first setup never includes unverifiable historical, offline, hidden, sleep, expired-owner, or overlapping intervals and never reads legacy `USER.daily_xp_goal` as time.
- **AC-DG-050:** Given no previously saved inactivity-reminder preference, the authenticated USER sees the Dashboard Daily Goal toggle enabled and Backend evaluates future reminder eligibility as enabled.
- **AC-DG-051:** When the USER disables or re-enables inactivity reminders, the account-scoped choice remains effective after logout/login and on another device.
- **AC-DG-052:** While the preference is disabled, Backend creates no new inactivity reminder even when every other reminder condition is satisfied, and existing persisted notifications remain unchanged.
- **AC-DG-053:** Re-enabling inactivity reminders permits only future eligibility and creates no reminder for an inactivity interval missed while the preference was disabled.
- **AC-DG-054:** When the first Daily Goal `+10 XP` reward of an application day commits, exactly one completion notification is created even if inactivity reminders are disabled.
- **AC-DG-055:** Before a valid goal is configured, no inactivity reminder is created even though the effective default preference is enabled; eligible Active Learning Time may still accumulate under the approved pre-setup tracking rules.

---

## 13. Edge Cases and Concurrency Expectations

| Scenario | Required observable result |
|---|---|
| Two tabs start together | One becomes owner; the other remains usable and non-owner; no overlap is counted. |
| Two devices claim simultaneously | Backend serialization/fencing chooses one current owner. |
| Delayed heartbeat after handoff | It adds zero time and cannot restore the old generation. |
| Duplicate accepted operation | It returns/reconciles idempotently without another increment. |
| Owner expires while another session is active | The visible non-idle session may reclaim ownership without changing activity results. |
| Rapid handoffs | Only requests with the latest committed fence can add later time. |
| Network outage then delayed requests | Unverified offline elapsed time is discarded; confirmed time remains. |
| Owner tab becomes hidden | Accounting pauses; other valid sessions may acquire according to ownership rules. |
| Laptop sleeps | Sleep time is excluded; modal appears on visible return to unfinished learning. |
| Every tab closes | No reminder is produced during closure and none is backfilled later. |
| Learning route navigates to Dashboard | Learning accounting stops; app-level reminder monitoring may continue. |
| Idle modal remains untouched | No time accrues; one reminder may become eligible after approximately ten minutes. |
| Completion races with handoff | Daily aggregate/reward uniqueness permits at most one reward. |
| Goal edit races with completion | Serialized current target/time determines current state; reward uniqueness remains one/day. |
| Time crosses midnight | Verified seconds are split into the appropriate Vietnam dates. |
| Reminder races with resume | A committed resume prevents later eligibility; an already committed notification may remain. |
| Reward requests race | Exactly one `+10 XP` increment commits. |
| First setup after earlier same-day learning | Existing authoritative seconds are evaluated immediately; completion artifacts commit once or not at all. |
| Target remains unset | Eligible verified time may accumulate, but completion, reward, completion notification, and inactivity reminder remain ineligible. |
| Preference is disabled while reminder checks race | No new inactivity reminder commits; existing notifications remain unchanged. |
| Preference is re-enabled after missed inactivity | Only a future qualifying inactivity interval may create a reminder; no missed reminder is backfilled. |
| Completion occurs while reminders are disabled | The one reward and completion notification still commit atomically and idempotently. |

---

## 14. Dependencies and Impact

### Frontend

- Extend the authenticated USER Dashboard with one independent Daily Goal source/card.
- Add a shared tracker and Idle Pause Modal integrated into all four qualifying activity lifecycles.
- Add app-shell inactivity monitoring and a persisted Notification Center Bell/panel.
- Preserve existing activity run-state and storage ownership boundaries.

### Backend

- Add authenticated USER-only Daily Goal, tracking, notification, and read-state boundaries following existing route/controller/service/repository separation.
- Reuse Backend clock, safe authorization, transaction, XP projection, and Vietnam-date patterns without coupling Daily Goal completion to Streak qualification.

### Database

- Add approved persistence only after a reviewed PLAN and migration gate.
- Preserve legacy `daily_xp_goal` meaning and existing Vocabulary-scoped `XP_REWARD` constraints.

### Existing features

- XP & Level: additive fixed reward source only; thresholds and existing rewards unchanged.
- Streak: no Daily Goal qualification or mutation.
- Normal/SRS/Quiz: tracking integration only; learning/session/result semantics unchanged.
- Speaking: tracking integration only; privacy and recognition architecture unchanged.
- Dashboard: new USER section/source; ADMIN remains neutral.

---

## 15. Legacy Documentation Reconciliation

After SPEC approval and during the authorized documentation synchronization stage, the following active/deferred documents must be reconciled explicitly:

- `docs/PROJECT_OVERVIEW.md`: replace deferred XP-based Daily Goal direction with Active Learning Time and fixed `+10 XP` behavior.
- `docs/DATABASE.md`: retire `USER_DAILY_PROGRESS` XP-based Daily Goal direction, preserve the legacy meaning of `USER.daily_xp_goal`, and document approved new persistence after PLAN.
- `docs/API_SPEC.md`: supersede XP/day endpoints, activity-XP completion, and percentage bonus with approved time-based contracts.
- `docs/UI_UX_SPEC.md`: replace XP-based Daily Goal UI with Dashboard setup/progress, idle modal, ownership status, and in-app Notification Center behavior.
- `docs/FEATURE_STATUS.md`: replace obsolete activity-XP/20% bonus wording while retaining `TODO` until implementation, TEST, REVIEW, and HUMAN approval complete.

This SPEC does not modify those documents and does not combine their incompatible historical rules with the approved V1 contract.

---

## 16. PLAN-Level Technical Decisions

The following are not HUMAN-approved business constants and must be validated in PLAN rather than treated as immutable SPEC rules:

- exact heartbeat cadence;
- owner lease TTL;
- maximum accepted accounting delta;
- exact owner/session/receipt table layout;
- whether ownership state uses a dedicated row or an equivalent serialized boundary;
- pre-handoff receipt mechanics within the approved bounded/non-overlap rules;
- receipt retention and cleanup;
- notification pagination and retention;
- connection/backpressure strategy for Vercel and Supabase;
- exact API paths, response fields, status codes, and conflict codes;
- cross-tab coordination optimization such as `BroadcastChannel`;
- exact bounded timeout for reference playback when native completion events are absent.

Discovery estimates near 20-second heartbeat, 45-second lease, and 25-second maximum delta may be evaluated, changed, and justified in PLAN. They are not approved product requirements.

---

## 17. Risks and Assumptions

- Browser lifecycle signals are best-effort; bounded undercount is acceptable when the alternative would trust unverifiable overlap, sleep, or offline duration.
- An in-app reminder cannot be delivered while all tabs are closed and may be delayed by background timer throttling.
- Multiple concurrent active tabs/devices remain usable, but only one records Daily Goal time.
- Persisted notification creation can race closely with resumed learning; transaction order defines whether a just-committed reminder remains.
- Frequent heartbeats can create serverless invocation, connection, hot-row, and receipt-volume pressure. PLAN must validate expected concurrency against the actual Vercel/Supabase environment.
- Existing historical documents contain conflicting deferred Daily Goal rules and require deliberate synchronization after approval.

---

## 18. HUMAN Decisions and Open Questions

### OQ-DG-01 — Time before first goal setup — HUMAN RESOLVED

HUMAN approved recording eligible Active Learning Time before the USER configures their first target. No completion reward or inactivity reminder is eligible while the target is unset. First valid setup immediately evaluates preserved authoritative same-day time, and any resulting completion, one `+10 XP` reward, XP increment, and completion notification commit atomically and idempotently. No unverifiable historical/offline time is backfilled, and legacy `USER.daily_xp_goal` is never interpreted as time.

### OQ-DG-02 — Inactivity-reminder preference — HUMAN RESOLVED

HUMAN approved an account-scoped inactivity-reminder preference that defaults to enabled when no value has been saved, persists across sessions/devices, and is controlled from the Dashboard Daily Goal card. Disabling blocks only new inactivity reminders and leaves existing notifications intact. Re-enabling never backfills missed reminders. Completion notifications remain mandatory achievement/system notifications created with the first Daily Goal reward, independent of both this preference and the one-inactivity-reminder-per-day limit. V1 adds neither a completion-notification toggle nor a full Settings module.

No unresolved business decision is known. Technical constants and storage/API details are intentionally deferred to PLAN.

---

## 19. SPEC Approval Gate

HUMAN approved the complete SPEC, including all 78 Business Rules, all 55 Acceptance Criteria, and both resolved HUMAN decisions.

This approval authorizes the separate PLAN stage only. It does not authorize TASK creation, implementation, migration, testing, deployment, or broader documentation synchronization without their required approvals.
