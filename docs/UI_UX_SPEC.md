# UI_UX_SPEC.md

# 1. Document Purpose

This document defines the UI/UX requirements for the English Vocabulary Learning System.

The purpose is to provide a single source of truth for designing the user interface and user experience before frontend implementation.

The design should be:

- Modern
- Clean
- Educational
- Friendly
- Professional
- Easy to use
- Responsive
- Suitable for an English vocabulary learning platform

The UI/UX must follow the project's approved scope.

Do not invent additional features that are not defined in this document or other project documentation.

# 2. Product Overview

The system is an English vocabulary learning platform.

The main goal is to help users:

- Learn English vocabulary.
- Practice vocabulary through interactive exercises.
- Track their learning progress.
- Build learning habits.
- Create and manage personal vocabulary sets.
- Share vocabulary-related content with the community.

The system has two authenticated roles:

- User
- Admin

Guest users are unauthenticated visitors.

Guest users can access public content and authentication-related pages.

User accounts can learn vocabulary, manage personal vocabulary sets, participate in the community, and track learning progress.

Admins manage users, topics, vocabulary data, vocabulary sets, achievements, and community content.

# 3. Design Direction

## 3.1 Visual Style

Use a:

**Modern Educational SaaS**

design style.

The interface should feel:

- Clean
- Bright
- Friendly
- Trustworthy
- Motivating
- Professional

Avoid:

- Childish visual styles
- Excessive animations
- Excessive gradients
- Excessive gamification
- Overly complicated layouts
- Visual clutter

## 3.2 Design Principles

Follow these principles:

1. Clarity first
2. Simple navigation
3. Strong visual hierarchy
4. Consistent components
5. Clear feedback
6. Accessible interactions
7. Responsive design
8. Minimal cognitive load
9. Encourage learning progress
10. Keep important actions obvious

# 4. Information Architecture

The application should be organized into the following main areas:

```text
Guest

│
├── Landing Page
├── Login
├── Register
├── Public Vocabulary Sets
└── Vocabulary Set Detail


User

│
├── Dashboard
├── Learn Vocabulary
│   ├── Flashcard
│   ├── Pronunciation Practice
│   ├── Vietnamese → English Quiz
│   ├── Missing Letter Quiz
│   └── Quiz Result
│
├── Progress
├── Achievements
│
├── Vocabulary Sets
│   ├── My Sets
│   ├── Public / Shared Sets
│   ├── Create Set
│   └── Edit Set
│
├── Community
│   ├── Post List
│   ├── Post Detail
│   └── Create Post
│
├── Profile
└── Settings


Admin

│
├── Admin Dashboard
├── User Management
├── Topic Management
├── Vocabulary Management
├── Vocabulary Set Management
├── Achievement Management
└── Community Management

Vocabulary Set Detail is a shared screen that may be accessed by Guest and authenticated users according to the system's access rules.

5. Global Layout
5.1 Desktop Layout

The application should use a modern dashboard layout.

For authenticated users:

The approved shared authenticated layout contains:

- Header.
- Primary Sidebar navigation.
- Main Content rendered by the matched nested route through React Router `<Outlet />`.
- Shared authenticated Footer.

Header responsibilities:

- Display ELVocab branding/logo.
- Display authenticated account identity on the right using an avatar, or a default avatar when no avatar is available, plus the backend-provided `display_name`.
- ADMIN context may be displayed as non-interactive context; it does not add an Admin feature or replace backend authorization.
- Logout is not a primary Header action.

Sidebar responsibilities:

- Remain the primary authenticated navigation on desktop.
- Contain Logout using the existing Authentication behavior.
- Show only routes/features that are implemented and approved.
- Do not render placeholder routes or menu items for future features.

Main Content responsibilities:

- Render route-owned content through the shared route outlet.
- Remain separate from User Dashboard or other feature-specific business content.

Footer responsibilities:

- Display only `© 2026 ELVocab` in V1.
- Remain visually secondary and contain no unapproved links.
- Remain visible in compact form on mobile.

The existing Authentication `AuthenticatedShell` must be reused and extended. The application must not create a second authenticated shell.

The following diagram is an information-architecture illustration. Search, Profile and future navigation items are not part of the App Layout foundation until their routes/features are separately implemented and approved.

┌─────────────────────────────────────────────────────┐
│ ELVocab                  Account Identity           │
├──────────────┬──────────────────────────────────────┤
│              │                                      │
│ Sidebar      │           Main Content               │
│              │                                      │
│ Dashboard    │                                      │
│ Learn        │                                      │
│ Progress     │                                      │
│ Vocabulary   │                                      │
│ Community    │                                      │
│ Achievement  │                                      │
│              │                                      │
│ Profile      │                                      │
│ Settings     │                                      │
│              │                                      │
└──────────────┴──────────────────────────────────────┘

The sidebar should remain visually simple. Only implemented and approved destinations may be shown.

The active navigation item must be clearly highlighted.

5.2 Tablet and Mobile Layout

On tablet and mobile devices:

The persistent desktop Sidebar becomes collapsible/drawer navigation.

Do not use bottom navigation.

Main content uses full available width.

The authenticated Footer remains visible in compact form.

Cards should stack vertically.

Buttons should remain easy to tap.

Avoid horizontal scrolling whenever possible.

6. Design System
6.1 Color System

Use a professional educational color palette.

Define:

Primary
Primary Hover
Secondary
Background
Surface
Text Primary
Text Secondary
Border
Success
Warning
Error
Info

The exact colors can be selected during Figma design.

The color system must remain consistent throughout the application.

6.2 Typography

Use a modern sans-serif font.

Recommended hierarchy:

Display
H1
H2
H3
Body Large
Body
Body Small
Caption
Button

Typography should provide clear hierarchy without excessive font sizes.

6.3 Spacing

Use a consistent spacing system.

Recommended base unit:

4px
8px
12px
16px
24px
32px
48px
64px

Avoid arbitrary spacing values whenever possible.

6.4 Border Radius

Use consistent rounded corners.

Suggested:

Small: 8px
Medium: 12px
Large: 16px
Extra Large: 20px

Do not overuse extremely rounded elements.

6.5 Shadows

Use subtle shadows.

Cards should feel elevated without looking heavy.

Avoid strong or excessive shadows.

7. Global Components

The design system should include reusable components.

Required components:

Button
Icon Button
Input
Textarea
Select
Checkbox
Radio
Search Input
Avatar
Badge
Tag
Card
Modal
Drawer
Dropdown
Tooltip
Toast
Alert
Tabs
Pagination
Breadcrumb
Navbar
Sidebar
Mobile Navigation
Loading Spinner
Skeleton Loader
Empty State
Error State
Confirmation Dialog
8. Global UI States

Every important page and component should consider:

Default
Loading
Empty
Error
Success
Disabled

For learning activities additionally support:

Correct
Incorrect
Completed
Reward

The UI must clearly communicate what happened after every important user action.

9. Guest Screens
9.1 Landing Page

Purpose:

Introduce the platform and encourage users to start learning.

Required sections:

Hero section
Product introduction
Learning feature overview
Vocabulary learning preview
Quiz preview
Progress / achievement preview
Community preview
Call-to-action
Footer

This Footer belongs to the public Landing Page. It is separate from the shared authenticated Footer defined in Global Layout.

Primary actions:

Start Learning
Login
Register
9.2 Login

Elements:

Email
Password
Show/hide password
Login button
Link to Register
Validation messages
Error state
9.3 Register

Elements:

Username
Email
Password
Confirm Password
Register button
Link to Login
Validation messages
9.4 Public Vocabulary Sets — Legacy Draft (superseded for V1)

The remaining legacy content in sections 9.4–9.5 is retained as future-product context only. The active Vocabulary Set V1 public behavior is defined in section 11.5 and excludes public User Sets, Community sharing, pagination and learning actions.

Purpose:

Allow guests to discover publicly available vocabulary sets.

Public vocabulary sets include:

System-created vocabulary sets
User-created vocabulary sets shared through the Community according to the system's sharing rules

Elements:

Page title
Search
Topic filters
Vocabulary set cards
Pagination
Empty state
9.5 Vocabulary Set Detail

Display:

Set name
Description
Topic
Number of vocabulary words
Vocabulary preview
Creator information
Start Learning button
Copy Set button when copying is permitted

The page must clearly distinguish between:

System-created vocabulary sets
User-created vocabulary sets shared through the Community

Copy Set is available only when the vocabulary set is accessible for copying according to the system's sharing rules.

Copied vocabulary sets become private sets owned by the copying user.

9.6 Public Topic Listing and Detail (Topic V1)

Guest and authenticated users can view Topic metadata through public Topic list and detail routes.

Listing elements:

Page title
Client-side search
Topic name
Optional description
Loading state
Empty state
Error state

Detail displays Topic metadata only. An empty Topic remains visible. Topic V1 does not display Vocabulary Set cards, Vocabulary Set counts, visibility/access information, learning progress, XP or streak effects.

10. User Screens
10.1 Dashboard

The dashboard is the main home screen after login.

Display:

Welcome message
Current level
XP
Current streak
Daily XP Goal progress
Topic learning progress
Words to review
Continue Learning
Current learning progress
Recent learning activity
Achievement preview

Topic progress should provide a concise overview of the user's learning progress by topic.

Each topic progress item may display:

Topic name
Progress percentage
Learned words / total words
Words to review
Continue Learning action

The dashboard should focus on encouraging the user to continue learning.

Do not overload the dashboard with too many statistics.

The dashboard is a summary view and is not the source of truth for learning progress.

10.2 Learn Vocabulary

Purpose:

Entry point for vocabulary learning.

Display available vocabulary sets.

Each set card should contain:

Set name
Topic
Word count
Learning progress
Start / Continue button
10.3 Flashcard

Purpose:

Help users learn and remember new vocabulary.

A flashcard should display:

Front:

English word or learning prompt

Back:

Vietnamese meaning
Part of speech
Example sentence
Contextual meaning
Pronunciation information if available

Pronunciation:

A speaker icon should be displayed inside the flashcard when pronunciation audio is available.

The user can press the speaker button to listen to the model pronunciation.

The flashcard should only provide model pronunciation playback.

User voice recording and pronunciation evaluation belong to the separate Pronunciation Practice activity.

Actions:

Show Answer
Previous
Next
Finish

The interaction should feel focused and distraction-free.

10.4 Pronunciation Practice

Purpose:

Allow users to practice pronouncing vocabulary words and receive pronunciation feedback.

The Pronunciation Practice activity is separate from the Flashcard activity.

The activity should display:

Vocabulary word
IPA pronunciation
Model pronunciation button
Record pronunciation button
Recording state
Processing state
Pronunciation result
Feedback
Retry button

Example flow:

Display vocabulary word
        ↓
Listen to model pronunciation
        ↓
Press microphone button
        ↓
User pronounces the word
        ↓
System records and analyzes the pronunciation
        ↓
Display pronunciation result and feedback
        ↓
Retry if needed

UI states:

Ready
Recording
Processing
Result
Error / Unsupported

Example:

┌──────────────────────────────┐
│       Pronunciation          │
│                              │
│           work               │
│          /wɜːrk/             │
│                              │
│             🔊               │
│      Listen to model         │
│                              │
│             🎙️               │
│      Practice speaking       │
│                              │
│     [ Press to start ]       │
└──────────────────────────────┘

The exact pronunciation analysis technology and scoring mechanism will be determined during the PLAN phase.

The system should not assume a specific AI or external pronunciation service at the UI/UX stage.

10.5 Vietnamese → English Quiz

Quiz type:

VI_TO_ENGLISH

Example:

Công việc

[ w _ r k ]

Check

The user must type the complete English answer.

Important UX requirement:

Provide character-level feedback.

Example:

Correct character → green
Incorrect character → red

Feedback should help the user understand which character or position is incorrect.

Do not reveal the full answer before the user submits unless explicitly designed as a hint.

10.6 Missing Letter Quiz

Quiz type:

MISSING_LETTER

Example:

w_rk

[ w o r k ]

Check

The user fills in the missing characters.

Provide immediate visual feedback after submission.

Correct positions:

Green

Incorrect positions:

Red

The interaction should be simple and fast.

10.7 Quiz Result

After completing a learning session, display:

Score
Correct answers
Incorrect answers
Accuracy
XP earned
Streak update if applicable
Achievement earned if applicable
Review incorrect answers
Continue Learning button

The result page should feel rewarding but remain professional.

10.8 Learning Progress

Display:

Total vocabulary learned
Learning accuracy
Learning activity
Progress by vocabulary set
Current learning progress
Current streak
XP progress

Use charts or visual progress indicators where useful.

Do not create overly complex analytics.

10.9 Achievements

Display achievements using cards.

Each achievement should contain:

Icon
Name
Description
Progress
Locked / Unlocked state
Date earned if available

Example categories:

Learning milestones
Streak milestones
Practice milestones
10.10 Vocabulary Sets — Legacy Draft (superseded for V1)

The remaining legacy content in sections 10.10–10.12 is retained for future Community/Learning work only. Vocabulary Set V1 USER behavior is defined in section 11.5 and is limited to private My Sets plus copying a System Set.

Tabs:

My Sets
Public / Shared Sets

My Sets should display:

Set name
Word count
Visibility
Created date
Edit
Delete
Start Learning

Public / Shared Sets should display vocabulary sets accessible to the user according to the system's sharing rules.

Users must clearly understand which sets they own.

User-created vocabulary sets are private by default and cannot be directly changed to public visibility.

Vocabulary sets can be shared through the Community according to the system's sharing rules.

10.11 Create Vocabulary Set

Fields:

Set name
Description
Topic
Vocabulary words

Each vocabulary item may contain:

English word
Vietnamese meaning
Part of speech
Example sentence
Context
Pronunciation information

User-created vocabulary sets are private by default.

Actions:

Add word
Remove word
Save
Cancel

The form should provide clear validation.

10.12 Edit Vocabulary Set

Reuse the Create Vocabulary Set design.

Only the owner or authorized system role may edit the set.

Clearly show:

Existing vocabulary
Add vocabulary
Remove vocabulary
Save changes
Cancel

User-created vocabulary sets remain private and are not directly converted to public sets through this screen.

10.13 Community

Community v1 contains:

Posts
Comments
Vocabulary Set Sharing

Do not include:

Likes
Followers
Friends
Direct messages
Chat
Leaderboards
Competitive ranking

The community page should contain:

Post list
Search
Create Post button
Post cards
Author
Created time
Comments count
10.14 Post Detail

Display:

Post title
Author
Created time
Post content
Shared vocabulary set if applicable
Comments
Comment input

Users should be able to participate in discussions through comments.

10.15 Create Post

Fields:

Title
Content
Optional vocabulary set

Actions:

Publish
Cancel

Provide validation and clear success/error feedback.

10.16 Profile

Display:

Avatar
Username
Basic profile information
Level
XP
Streak
Achievement summary
Vocabulary set summary

Keep the profile simple.

10.17 Settings

Settings should focus only on necessary account and learning preferences.

Sections:

Account
Password
Learning Preferences
Daily Goal

Daily Goal allows the user to configure their target XP per day.

The default goal is 50 XP/day.

Allowed values and detailed business rules are defined by the project's business rules and should not be changed at the UI/UX stage.

11. Admin Screens
11.1 Admin Dashboard

Display:

Total users
Total vocabulary
Total vocabulary sets
Community activity
Recent activity

Use simple dashboard cards and charts where useful.

11.2 User Management

Display:

User list
Search
Filters
User details
Account status
Role

Admin actions should be clearly separated from destructive actions.

Use confirmation dialogs for destructive operations.

11.3 Topic Management

Admin can manage system topics used to organize vocabulary sets.

Display:

Topic list
Search
Topic details

Topic V1 displays metadata only; real Vocabulary Set count is deferred.

Actions:

Create
Edit
Delete
View

Use confirmation dialogs for destructive operations.

Topic V1 management additionally requires create/edit form validation, loading/empty/error/success states, accessible labelled controls and a delete confirmation with action, consequence, cancel and confirm choices. An ADMIN-only navigation entry is shown only with the implemented management route in the existing authenticated App Layout; frontend route guarding is UX, while backend ADMIN authorization remains authoritative.

11.4 Vocabulary Management

Vocabulary V1 is an ADMIN-only `/admin/vocabulary` route inside the existing authenticated App Layout. It has no Guest/USER Vocabulary catalog, public route or USER sidebar entry.

Display and actions:

- Unpaginated Vocabulary summary list with client-side word search; no server-side filter or pagination.
- Complete Vocabulary detail with nested Meanings and each Meaning's Examples.
- Create, edit, view and delete a Vocabulary aggregate.
- Optional phonetic/pronunciation URL metadata, one-or-more Meaning editors and zero-or-more Example editors per Meaning.

Before edit, the UI loads the complete aggregate rather than editing a list summary. A save containing `meanings` sends the complete desired Meaning collection and the complete desired Example collection for every retained Meaning; visible remove controls intentionally omit owned children from replacement data. The UI prevents removing the final Meaning.

Provide accessible loading, empty, validation, duplicate-word, not-found, authorization and safe server-error states. Delete confirmation identifies the Vocabulary and owned Meanings/Examples, provides cancel/confirm controls, prevents duplicate submission and restores focus appropriately. Existing dashboard, logout, mobile drawer, Topic routes and Topic management remain unchanged.
11.5 Vocabulary Set V1

Vocabulary Set V1 provides separate public System Set, USER private Set and ADMIN System management flows. It did not itself add a standalone USER Vocabulary catalog, full Vocabulary detail page, public User Set/community sharing screen or learning action. Flashcard / Learning V1 may add only its approved authenticated USER learning entry while preserving these Set-management boundaries.

#### Public Topic-based System Sets

Guest and authenticated visitors can open dedicated Topic-scoped System Set discovery and public System Set detail routes. Topic V1 list/detail remain metadata-only and do not embed Set counts or collections.

- Discovery shows public System Set summaries for one Topic, client-side Set-name search, loading, empty, safe error and not-found states.
- Detail shows Set/Topic metadata and ordered Item selection metadata only: Vocabulary word and optional phonetic, never Meaning, Example or CEFR data.
- An authenticated USER sees Copy and, after Flashcard / Learning V1 is implemented, its approved learning entry. A Guest receives a route to authenticate and cannot start learning while unauthenticated.

#### USER My Sets and Editor

Inside the existing authenticated App Layout, USER navigation exposes My Sets only with implemented routes. A USER can list/search/view/create/edit/delete only owned private Sets and may retain an empty draft.

- The Set editor has labelled Set metadata and Topic controls plus a semantic ordered Item collection.
- Its authenticated Vocabulary picker exists only while editing, requires a word query, displays bounded `{ word, phonetic }` selection metadata, prevents duplicate additions and never links to a Vocabulary catalog/detail screen.
- Item add/remove and keyboard-accessible move-up/move-down controls make complete replacement order explicit.
- Copy success opens the independent private copy. Loading, validation, safe mutation/network error, pending, empty and delete-confirmation states are required.

#### ADMIN System Set Management

`/admin/vocabulary-sets` is inside the existing `ProtectedRoute`, `AdminRoute` and `AuthenticatedShell`; its navigation appears only to ADMIN users. ADMIN can list/search/view/create/edit/delete System Sets. A System Set editor uses the same approved picker/editor boundary but must prevent save with zero Items.

All Set screens preserve current dashboard, logout, mobile drawer, Topic routes/management and Vocabulary management. Forms use associated labels/errors; dialogs restore focus and block duplicate pending actions; ordered Item controls remain keyboard-accessible and responsive at existing breakpoints.
11.6 Achievement Management

Admin can manage system achievement definitions.

Display:

Achievement name
Description
Icon
Achievement condition
Status

Actions:

Create
Edit
Delete
View

Achievement definitions are managed by the system administrator.

User achievement progress is generated by the learning system.

Use confirmation dialogs for destructive operations.

11.7 Community Management

Admin can review and manage community content.

Display:

Posts
Comments
Content details

Actions:

View
Delete post
Delete comment

Provide clear actions for content management.

Do not introduce a separate Moderator role.

12. Learning Experience

The learning experience is the most important part of the product.

The interface should minimize distractions.

During learning:

Keep the main question visually dominant.
Keep controls simple.
Show progress through the session.
Provide immediate feedback.
Clearly distinguish correct and incorrect answers.
Show only progress and outcomes approved for the current learning feature; XP and achievements remain deferred unless separately approved.
Avoid unnecessary navigation.
12.1 Learning Session Header

Display:

Vocabulary Set
Question 5 / 10
Progress

Optional:

XP indicator
Streak indicator
12.2 Correct Answer

Use:

Positive visual feedback
Clear success message
Continue button

Do not use excessive animations.

12.3 Incorrect Answer

Use:

Clear error indication
Character-level feedback when applicable
Correct answer after submission when appropriate
Continue / Retry action

### 12.4 Flashcard / Learning V1 Active UX Contract

The V1 route is `/learn/vocabulary-sets/:setId` under the existing `ProtectedRoute`, `AuthenticatedShell` and `UserRoute`. On this route only, the shell provides a dedicated full-viewport Focus Mode without the normal authenticated Header, Sidebar or Footer; all other authenticated routes retain the normal App Layout. Only an authenticated USER can enter from a public System Set or an owned private Set. Guest follows the existing login path; ADMIN and non-owners receive the existing safe route/API behavior.

The USER traverses current Set Items in explicit `position` order. One two-faced card is shown at a time. Its front emphasizes the Vocabulary word, optional phonetic, an icon-only pronunciation control and a safe clickable/Space-enabled reveal surface; there is no separate visible reveal button. Reveal focuses on one deterministic primary Meaning: lowest CEFR in `A1 → A2 → B1 → B2 → C1 → C2` order, with ties and null CEFR resolved by the payload's existing deterministic `created_at`, then `id`, order. The back shows word, phonetic, part of speech, CEFR, primary Vietnamese meaning, optional context and only the first Example in deterministic payload order. The backend still returns the complete Vocabulary aggregate; the one-Example rule is presentation-only and V1 adds no persisted primary field.

Reveal, Previous/Next inspection and audio playback do not update progress. The shared action slot shows Previous/Next only on Front and **Học lại** (`STUDY_AGAIN`) plus **Nhớ rồi** (`REMEMBERED`) only on Back. Only a successful backend event response marks the current card assessed for the current run. A pending event disables duplicate assessment and displays pending feedback only on the submitted outcome; retry reuses the inconclusive current event ID/revision, and a progress conflict refreshes/reconciles safely.

The server stores no Learning Session. The frontend owns same-tab transient run state in a Flashcard/Learning-specific `sessionStorage` namespace containing only USER ID, Set ID, current Vocabulary ID and assessed Vocabulary IDs/outcomes. It reconciles against a fresh payload, clears invalid/stale state, and owns clearing its namespace on logout/session invalidation without adding Flashcard-specific cleanup keys to Auth internals.

Reload resumes a valid same-tab run. Restart requires confirmation, clears only transient run state and never resets durable progress. Completion is a client-run summary reached only when every current card has one successful assessment; starting a new run does not erase progress.

Pronunciation prefers stored `pronunciation_url`; when absent, supported browsers may use native English `speechSynthesis`. Front-to-back reveal begins playback concurrently, playback failure never blocks reveal or progress, Back-to-front flip does not replay audio, and the speaker remains independently keyboard-operable without flipping the card.

Required states include accessible loading, empty, not-found, stale-item, event/audio failure, progress-conflict and pending feedback. The final UI must provide semantic headings/groups, keyboard-operable flip/outcome/navigation/restart controls, managed focus, `status`/`alert` announcements as appropriate, a 500ms two-way flip with reduced-motion override, responsive no-overflow Focus Mode and safe overflow fallback for abnormal content/short viewports.

The HUMAN-approved repo-native checkpoint is recorded in `docs/FLASHCARD_LEARNING_V1_UI_UX_CHECKPOINT.md`. It defines card front/back, primary-Meaning hierarchy, run header, external assessment controls, all state transitions, focus/keyboard map, reduced motion and mobile/desktop behavior. Final UI implementation must remain within that checkpoint.

Flashcard / Learning V1 does not add Quiz, Pronunciation Practice, XP/Level/Streak/Achievements, Dashboard, Words to Review, a full SRS algorithm, Community or AI behavior. Model audio playback is optional presentation only and never a progress event.

### 12.5 Learning Progress View V1 Active UX Contract

Learning Progress View V1 adds `/my/learning-progress` under the existing authenticated App Layout and `UserRoute`, plus a USER-only **Tiến độ học** navigation destination. Guest and ADMIN cannot use the route. This is a read-only view over the completed per-USER/per-Vocabulary progress engine, not Dashboard or a standalone Vocabulary catalog.

The page presents persisted counts for total started, Learning, Learned and compatibility-only Needs Review. Conceptual New is excluded and the UI must not present total started as total available Vocabulary or calculate a global completion percentage.

The server-paginated current-state list displays only word, optional phonetic, textual status, review count and last-reviewed time. A status control supports All, Learning, Learned and Needs Review; changing it returns to page 1. Search, client sorting, charts, review actions, recommendations, Topic/Set progress and gamification are deferred.

Required states are accessible loading without premature empty rendering, first-use empty, filtered-empty, safe error with retry, success and pending pagination/filter feedback. Pagination exposes current-page context, disables unavailable or pending actions and prevents stale responses from replacing the latest selection.

The final page must preserve semantic headings/labels, textual status independent of color, native keyboard controls, visible focus, appropriate live regions, reduced motion, mobile touch targets and no horizontal overflow across existing breakpoints. A dedicated HUMAN UI/UX Design Checkpoint is mandatory before production page implementation; this active contract intentionally does not prescribe pixel-level styling.

Viewing or filtering never creates, updates, resets or recommends Learning Progress. Existing Flashcard Focus Mode, sessionStorage run state, event transitions and completion behavior remain unchanged.

13. Gamification UI

Gamification features:

XP
Level
Streak
Daily Goal
Achievements

Gamification should support learning rather than dominate the interface.

Use:

Progress bars
Small reward animations
Achievement cards
Level indicators
Streak indicators
Daily goal progress

Avoid:

Leaderboards
Competitive ranking
Excessive game mechanics
14. Vocabulary Context UX

A vocabulary word may have multiple meanings depending on context.

The UI must avoid presenting all meanings as if they are interchangeable.

When appropriate, display:

Word
Part of Speech
Meaning
Example sentence
Context

Example:

work

verb

Meaning:

làm việc

Example:

I work every day.

Context:

Daily activities
15. Pronunciation UX

Pronunciation is a learning activity, not a quiz type.

The pronunciation experience consists of two distinct interactions:

15.1 Model Pronunciation

The system provides:

Pronunciation text / IPA
Audio button

The audio button is placed inside the Flashcard or Pronunciation Practice screen.

Its purpose is to let users listen to the model pronunciation.

15.2 User Pronunciation Practice

The Pronunciation Practice activity provides:

Microphone button
Recording state
Processing state
Pronunciation result
Feedback
Retry action

The microphone interaction must be visually distinct from the model pronunciation button.

The UI should clearly communicate:

🔊 Listen to pronunciation

🎙️ Practice pronunciation

The pronunciation feature should not be presented as a third quiz type.

The exact pronunciation analysis technology and scoring mechanism will be determined during the PLAN phase.

16. Responsive Design

The application must support:

Desktop
Tablet
Mobile

Recommended breakpoints can be defined during implementation.

Responsive behavior should include:

Flexible cards
Responsive grids
Collapsible navigation
Stacked forms
Mobile-friendly quiz input
Mobile-friendly flashcards
Accessible touch targets
17. Accessibility

The design should consider:

Sufficient color contrast
Keyboard navigation
Visible focus states
Accessible form labels
Error messages
Clear button labels
Screen-reader-friendly structure

Do not rely on color alone to communicate correctness.

For quiz feedback, combine color with visual indicators or text.

18. Loading / Empty / Error States

Every important data-driven screen must define these states.

Loading

Use:

Skeleton
Spinner
Disabled actions where appropriate

Empty

Example:

No vocabulary sets yet.

Create your first vocabulary set.

Provide a relevant action.

Error

Example:

Something went wrong.

Please try again.

Provide retry action where appropriate.

Success

Use:

Toast
Alert
Inline success message

Avoid unnecessary popups.

19. Important Confirmation States

Destructive actions should require confirmation.

Examples:

Delete vocabulary set?
Delete post?
Delete vocabulary?
Delete topic?
Delete achievement?

Confirmation dialog should clearly show:

Action
Consequence
Cancel
Confirm
20. Figma Design Structure

Create the Figma project with the following pages:

01 - Cover
02 - Design System
03 - Components
04 - Guest
05 - User
06 - Learning
07 - Vocabulary Sets
08 - Community
09 - Admin
10 - Responsive
11 - Prototype

The Design System page should contain:

Colors
Typography
Spacing
Radius
Shadows
Icons

The Components page should contain reusable components and their states.

21. Required Component Variants

At minimum, create variants for:

Button
Primary
Secondary
Outline
Ghost
Danger
Disabled
Loading
Input
Default
Focus
Filled
Error
Disabled
Quiz Answer
Default
Correct
Incorrect
Disabled
Vocabulary Card
Default
Hover
Selected
Completed
Achievement
Locked
Progress
Unlocked
Navigation
Default
Hover
Active
Disabled
22. Prototype Flows

The Figma prototype should demonstrate the most important user journeys.

Flow 1 - Authentication
Landing
   ↓
Register
   ↓
Login
   ↓
Dashboard
Flow 2 - Learn Vocabulary
Dashboard
   ↓
Learn Vocabulary
   ↓
Vocabulary Set
   ↓
Flashcard
   ↓
Pronunciation Practice
   ↓
Quiz
   ↓
Quiz Result
   ↓
Dashboard
Flow 3 - Create Vocabulary Set
Vocabulary Sets
   ↓
Create Set
   ↓
Add Vocabulary
   ↓
Save
   ↓
My Sets
Flow 4 - Community
Community
   ↓
Post Detail
   ↓
Comment
23. UI/UX Scope Control

The design must not introduce features outside the approved project scope.

Do not add:

Payment
Premium plans
Subscription
Friends
Followers
Direct messaging
Chat
Leaderboard
Competitive ranking
Teacher role
Moderator role
Staff role
Complex social reactions
Unapproved AI features

If a new feature is proposed, it must be reviewed before being added to the design.

24. AI Design Instructions

When using an AI design tool such as Figma AI, provide this document as the primary design specification.

The AI must:

Follow the defined screen inventory.
Follow the defined navigation.
Reuse the defined design system.
Maintain consistent components.
Respect the two authenticated roles: User and Admin.
Keep Guest access separate from authenticated User features.
Prioritize the learning experience.
Create responsive layouts.
Include loading, empty, error, success, and disabled states.
Avoid inventing features outside this specification.
Avoid changing business rules.
Ask for clarification when a required design decision is not defined rather than inventing a major feature.
25. Initial Screen Inventory

The initial UI/UX scope contains approximately:

Guest
Landing
Login
Register
Public Vocabulary Sets
Vocabulary Set Detail
User
Dashboard
Learn Vocabulary
Flashcard
Pronunciation Practice
Vietnamese → English Quiz
Missing Letter Quiz
Quiz Result
Learning Progress
Achievements
Vocabulary Sets
Create Vocabulary Set
Edit Vocabulary Set
Community
Post Detail
Create Post
Profile
Settings
Admin
Admin Dashboard
User Management
Topic Management
Vocabulary Management
Vocabulary Set Management
Achievement Management
Community Management

Total initial screens:

29 screens

Some screens such as Vocabulary Set Detail may be shared between Guest and authenticated users and should be implemented as reusable screens where appropriate.

26. Design Completion Criteria

UI/UX is considered complete when:

All required screens are designed.
Navigation between screens is defined.
Design system is established.
Components are reusable.
Responsive layouts are considered.
Loading states are defined.
Empty states are defined.
Error states are defined.
Success states are defined.
Quiz feedback states are defined.
Learning flow is prototyped.
Authentication flow is prototyped.
Vocabulary Set flow is prototyped.
Community flow is prototyped.
Admin flow is prototyped.
No major feature outside the approved scope is introduced.
27. Primary Goal

The primary goal of the UI/UX is to create a modern, clear, motivating, and easy-to-use English vocabulary learning experience.

The interface should help users focus on learning vocabulary rather than navigating a complicated application.

The design should look professional enough for a graduation thesis project while remaining realistic to implement within the project's available development time.
```
