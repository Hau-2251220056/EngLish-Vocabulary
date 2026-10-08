# API SPECIFICATION

## 1. Document Purpose

Tài liệu này định nghĩa API contract của hệ thống:

> **Xây dựng hệ thống học từ vựng tiếng Anh**

API Specification mô tả:

- API phục vụ chức năng nào.
- Actor nào được phép sử dụng.
- Request cần gửi gì.
- Response trả về dữ liệu gì.
- Business rules nào phải được backend đảm bảo.
- Authorization và ownership rules.
- Validation và error handling.
- Quan hệ giữa API với Database và các feature khác.

Tài liệu này tập trung vào **business contract**, không khóa implementation cụ thể.

Các quyết định kỹ thuật chi tiết được xác định trong:

- `ARCHITECTURE.md`
- `DATABASE.md`
- PLAN của từng feature.

---

# 2. Source of Truth

Khi triển khai hoặc thay đổi API, Agent phải tham khảo:

1. `AGENTS.md`
2. `PROJECT_OVERVIEW.md`
3. `ARCHITECTURE.md`
4. `DATABASE.md`
5. `API_SPEC.md`
6. `UI_UX_SPEC.md`
7. `FEATURE_STATUS.md`

Trong đó:

- `PROJECT_OVERVIEW.md`: hệ thống cần làm gì.
- `DATABASE.md`: dữ liệu được tổ chức như thế nào.
- `API_SPEC.md`: frontend/backend giao tiếp như thế nào.
- `UI_UX_SPEC.md`: UI cần dữ liệu và hành vi gì.
- `FEATURE_STATUS.md`: trạng thái triển khai.
- Source code/tests: bằng chứng về implementation hiện tại, không tự động thay thế requirement contract.

Nếu phát hiện mâu thuẫn:

> Không tự ý chọn một phương án nếu mâu thuẫn ảnh hưởng đến business behavior hoặc API contract.

Phải báo cáo và xin quyết định.

---

# 3. API Base

API base path:

```text
/api

Ví dụ:

/api/auth/login
/api/admin/vocabulary
/api/vocabulary-sets

API sử dụng JSON cho request/response nếu endpoint không quy định khác.

4. Actors
4.1 Guest

Guest là người dùng chưa đăng nhập.

Guest có thể:

Xem Landing Page.
Đăng ký.
Đăng nhập.
Xem Vocabulary Set được phép public.
Xem chi tiết Vocabulary Set public.

Guest không thể:

Học và lưu Learning Progress.
Thực hiện Quiz có lưu kết quả.
Pronunciation Practice có lưu kết quả.
Tạo Vocabulary Set.
Copy Vocabulary Set.
Tham gia Community.
Xem dữ liệu cá nhân.
Sử dụng Admin API.
4.2 User

User là authenticated user thông thường.

User có thể:

Quản lý profile.
Xem và học Vocabulary Set.
Flashcard.
Pronunciation Practice.
Làm Quiz.
Theo dõi Learning Progress.
Nhận XP.
Level.
Daily Goal.
Streak.
Achievement.
Tạo Vocabulary Set cá nhân.
Chỉnh sửa Vocabulary Set cá nhân.
Chia sẻ Vocabulary Set thông qua Community.
Copy Vocabulary Set được chia sẻ.
Tham gia Community.
4.3 Admin

Admin cũng là một record trong USER.

Phân biệt bằng:

USER.role = ADMIN

Admin có quyền:

Quản lý User.
Quản lý Vocabulary.
Quản lý Topic.
Quản lý Vocabulary Set hệ thống.
Quản lý Community content khi cần.
Quản lý Achievement/system content.

Admin API phải kiểm tra authorization ở backend.

Không được xem role ở frontend như cơ chế bảo mật duy nhất.

5. Authentication
5.1 Register
POST /api/auth/register
Access

Guest.

Request
{
  "username": "minhhau",
  "email": "hau@example.com",
  "password": "password"
}
Success
{
  "success": true,
  "message": "Registration successful"
}
Rules
Username không được trùng.
Email không được trùng.
Password phải đáp ứng validation của hệ thống.
User mới mặc định có role:
USER
Daily XP Goal mặc định:
50 XP
6. Login
POST /api/auth/login
Access

Guest.

Request
{
  "email": "hau@example.com",
  "password": "password"
}
Success
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "minhhau",
      "email": "hau@example.com",
      "role": "USER"
    }
  }
}

Authentication mechanism cụ thể được quyết định trong ARCHITECTURE.md và PLAN.

7. Current User
7.1 Get Current User
GET /api/auth/me
Access

Authenticated User/Admin.

Response
{
  "success": true,
  "data": {
    "id": 1,
    "username": "minhhau",
    "email": "hau@example.com",
    "role": "USER"
  }
}
8. User Profile
8.1 Get Profile
GET /api/users/me
Access

Authenticated User.

Response

Có thể bao gồm:

{
  "success": true,
  "data": {
    "id": 1,
    "username": "minhhau",
    "email": "hau@example.com",
    "total_xp": 320,
    "level": 3,
    "streak": 7,
    "longest_streak": 12,
    "daily_xp_goal": 50
  }
}

level được backend tính từ total_xp.

Không lưu level như source of truth nếu Database Specification không yêu cầu.

9. Update Profile
PATCH /api/users/me
Access

Authenticated User.

Request
{
  "username": "newusername"
}

Các field được phép thay đổi phải được xác định trong implementation contract của feature.

User không được tự thay đổi:

role
total_xp
level
streak
achievement data
learning progress
10. Daily Goal
10.1 Get Daily Goal
GET /api/users/me/daily-goal
Response
{
  "success": true,
  "data": {
    "goal_xp": 50,
    "today_xp": 30,
    "progress_percent": 60,
    "goal_completed": false
  }
}
10.2 Update Daily Goal
PATCH /api/users/me/daily-goal
Request
{
  "goal_xp": 100
}
Rules

Daily Goal:

Đơn vị: XP/day.
Giá trị mặc định: 50 XP.
Giá trị hợp lệ: 50–200 XP.
Backend phải validate.
today_xp không bị reset khi user thay đổi goal.
Nếu giảm goal và XP hiện tại đã đạt goal:
goal_completed = true
bonus được trao nếu hôm đó chưa nhận bonus.
Nếu tăng goal:
XP đã có vẫn được giữ nguyên.
Chỉ thay đổi target.
11. Topic

Topic V1 classifies Vocabulary Sets conceptually, but returns and manages Topic metadata only.

Shared Topic representation:

```json
{
  "id": "UUID string",
  "name": "Daily Life",
  "description": "Common vocabulary used in daily life",
  "created_at": "ISO-8601 timestamp",
  "updated_at": "ISO-8601 timestamp"
}
```

`description` may be `null`.

11.1 Get Topics
GET /api/topics
Access

Guest/User.

Response: `200` with `{ "success": true, "data": Topic[] }`.

Topic V1 returns an unpaginated metadata list. Search/filter is client-side; no server search/filter is added.

11.2 Get Topic Detail
GET /api/topics/:topicId
Access

Guest/User.

`topicId` is a UUID string. Response: `200` with `{ "success": true, "data": Topic }`.

Topic V1 detail remains metadata-only. Vocabulary Set V1 adds discovery through dedicated Set routes; Topic responses do not embed Set counts, visibility data or Set collections.

11.3 Admin Create Topic
POST /api/admin/topics
Access

Admin.

Request: `{ "name": "Daily Life", "description": "Common vocabulary used in daily life" }`.

`name` is required, trimmed, non-empty after trim, maximum 100 characters and unique case-insensitively. `description` is optional and maximum 500 characters.

Success: `201` with `{ "success": true, "data": Topic }`.

11.4 Admin Update Topic
PATCH /api/admin/topics/:topicId
Access

Admin.

`topicId` is a UUID string. Omitted editable field remains unchanged. A supplied `name` must be a string and is trimmed, validated and updated; `name: null` is `400 VALIDATION_ERROR`. A supplied string `description` is validated and updated; `description: null` clears it. Empty body or no supported editable field is `400 VALIDATION_ERROR`. No field other than `name` and `description` is editable in V1.

Success: `200` with `{ "success": true, "data": Topic }`.

11.5 Admin Delete Topic
DELETE /api/admin/topics/:topicId
Access

Admin.

`topicId` is a UUID string. Success: `204` with no response body.

Topic V1 itself created no Vocabulary Set relation. Vocabulary Set V1 materializes `ON DELETE RESTRICT` / no cascade. An ADMIN delete blocked by any System or legacy Personal Set reference returns `409 TOPIC_IN_USE`; topicless Personal Sets create no Topic dependency.

Topic errors: `400 VALIDATION_ERROR`, `401 AUTHENTICATION_FAILED`, `403 FORBIDDEN`, `404 TOPIC_NOT_FOUND`, `409 TOPIC_NAME_ALREADY_EXISTS`, `409 TOPIC_IN_USE`, and safe `500 INTERNAL_SERVER_ERROR` without internal details.

12. Vocabulary V1

Vocabulary V1 is ADMIN-only and canonical-only (`VOCABULARY.owner_id IS NULL`). It provides no Guest/USER Vocabulary catalog, detail, search or discovery endpoint. ADMIN list/detail/create/update/delete never expose or mutate private Vocabulary; a private ID uses the same `VOCABULARY_NOT_FOUND` response as a nonexistent ID. Vocabulary Set V1 adds only an authenticated, bounded Set-editor picker with minimum selection metadata; it is not a catalog/detail exception. Every Vocabulary, Meaning and Example identifier is a UUID string.

12.1 Aggregate Representation

A Vocabulary detail returns `{ success: true, data: Vocabulary }`, where `Vocabulary` contains `id`, `word`, nullable `phonetic`, nullable `pronunciation_url`, timestamps and a non-empty `meanings` array. Each Meaning contains its UUID, `part_of_speech`, `meaning_vi`, nullable `context`, nullable Meaning-only `cefr_level`, timestamps and an `examples` array. Each Example is nested under its owning Meaning and contains its UUID, `example_en`, nullable `example_vi` and `created_at`.

12.2 ADMIN Vocabulary Routes

| Method / path | Success | Requirement |
|---|---:|---|
| `GET /api/admin/vocabulary` | `200` | Unpaginated canonical Vocabulary summaries; no server search/filter. |
| `GET /api/admin/vocabulary/:vocabularyId` | `200` | Complete canonical nested aggregate. |
| `POST /api/admin/vocabulary` | `201` | Create one canonical aggregate (`owner_id = NULL`) atomically with one or more Meanings. |
| `PATCH /api/admin/vocabulary/:vocabularyId` | `200` | Update approved canonical fields and optional complete-replacement `meanings` collection atomically. |
| `DELETE /api/admin/vocabulary/:vocabularyId` | `204` | Delete the canonical aggregate and its owned Meanings/Examples; no body. |

All routes require existing backend authentication and `ADMIN` authorization. `PATCH` permits only `word`, `phonetic`, `pronunciation_url` and `meanings`; omitted top-level fields are unchanged. When `meanings` is supplied, it is the complete desired collection; each retained Meaning supplies its complete desired Examples. Stable IDs must be owned by the addressed aggregate, and omission from supplied replacement data intentionally deletes owned children. No granular Meaning or Example route exists.

Known errors use `{ success: false, error: { code, message } }`: `400 VALIDATION_ERROR`, `404 VOCABULARY_NOT_FOUND`, `409 VOCABULARY_WORD_ALREADY_EXISTS`, existing `401 AUTHENTICATION_FAILED`, existing `403 FORBIDDEN`, and safe `500 INTERNAL_SERVER_ERROR`.
### 12.1 Personal Vocabulary V1 — Implemented Contract

#### Status Boundary

PV-02 through PV-08 implement the data foundation, canonical-only ADMIN compatibility, owner-private detail/update, owner-aware picker/Set reuse, atomic private create-plus-add behavior, frontend operation lifecycle, and complete editor UX. PV-09 through PV-11 verify Learning, Progress, Quiz, TTS, privacy and cross-feature compatibility. Personal Vocabulary V1 is complete and HUMAN approved; integration into `dev` has not yet occurred.

#### Owner-Aware Set-Editor Picker — Implemented in PV-05

`GET /api/vocabulary-set-picker?query=<word>` behaves as follows:

- USER results include canonical plus session-owner private Vocabulary, including zero-membership identities.
- ADMIN results include canonical Vocabulary only for System Set editing.
- Other USERs' private rows are filtered before limiting and never affect observable results.
- Bounded results contain `id`, `word`, nullable `phonetic`, source (`CANONICAL` or `PRIVATE`) and deterministic primary-Meaning context with `part_of_speech` and `meaning_vi`.
- Search is reuse-first discovery only; it never collapses or selects identities by spelling.

#### Atomic Private Create Plus Membership — Implemented in PV-06

USER-only command: `POST /api/my/vocabulary-sets/:setId/vocabulary`.

Request contains required opaque UUID `operation_id` for one intentional action and `vocabulary` with the approved private create fields. It cannot set owner, scope/source/type/visibility, server IDs/timestamps, `pronunciation_url` or the authoritative fingerprint.

The backend derives owner and target authorization from the session/path, computes a SHA-256 fingerprint from a fixed-key JSON projection of owner, target Set and accepted normalized create data, and atomically creates aggregate children, exact Set membership and operation result. The fixed projection is independent of incoming JSON property order. The transaction locks the owned private Set row before deriving the next append position.

First completion returns `201`; an equivalent retry returns `200` with the original exact Vocabulary and membership. The success body is `{ success: true, data: { vocabulary, membership } }`. Materially different operation-ID reuse returns `409 PRIVATE_VOCABULARY_OPERATION_CONFLICT`. A different operation ID permits intentional identical/same-headword creation. Validation returns `400`; missing, public or inaccessible target Sets use concealed `404 VOCABULARY_SET_NOT_FOUND`. Failure leaves no partial aggregate, membership or successful operation record.

#### Owner-Private Detail and Update — Implemented in PV-04

Implemented USER-only endpoints:

- `GET /api/my/vocabulary/:vocabularyId`
- `PATCH /api/my/vocabulary/:vocabularyId`

Both require authentication plus the `USER` role and predicate by exact ID plus session owner. Missing, canonical and other-owner IDs use the same concealed `404 VOCABULARY_NOT_FOUND`. GET returns `id`, `word`, nullable `phonetic` and nested Meanings/Examples; it omits owner and `pronunciation_url`. PATCH accepts only `word`, `phonetic` and a non-empty complete-replacement `meanings` collection with approved Meaning/Example fields. It permits same-spelling identities, preserves the exact Vocabulary ID, updates atomically, and rejects `pronunciation_url`, ownership, scope and server-managed fields. No private list, create or DELETE endpoint is implemented by PV-04.

#### Existing API Compatibility Requirements

- ADMIN Vocabulary list/detail/create/update/delete are canonical-only; duplicate-word behavior remains canonical-scoped.
- System Set picker and writes accept canonical IDs only.
- Private Set create/update accepts exact canonical or same-owner private IDs.
- Same exact ID cannot repeat in a Set; distinct same-spelling IDs may coexist.
- System Set copy continues to reuse canonical IDs.
- Learning/Quiz continue through exact Set Item `vocabulary_id`; Progress remains `(user_id, vocabulary_id)`.
- Existing envelopes, authentication and concealed-resource conventions remain; no new global error architecture is introduced.

PV-05 also enforces exact-ID Set references: System Set create/update and copy are canonical-only; owned private Set create/update accepts canonical or session-owner private IDs and conceals foreign-private IDs as `VOCABULARY_NOT_FOUND`. Removing Set membership does not delete Vocabulary or Progress.

13. Vocabulary Set — Legacy Draft (superseded for V1)

Vocabulary Set là đơn vị nội dung chính để User học.

Vocabulary Set có thể là:

System Vocabulary Set do Admin quản lý.
Personal Vocabulary Set do User tạo.
14. Public System Vocabulary Sets
14.1 List Vocabulary Sets
GET /api/vocabulary-sets
Access

Guest/User.

Có thể hỗ trợ filter:

topic
search
pagination
Response
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Daily Life",
      "description": "Common daily vocabulary",
      "topic": {
        "id": 1,
        "name": "Daily Life"
      },
      "word_count": 200
    }
  ]
}

Backend chỉ trả về những Set requester được phép truy cập.

14.2 Vocabulary Set Detail
GET /api/vocabulary-sets/:setId
Access

Guest/User.

Response

Có thể bao gồm:

Set information.
Topic.
Vocabulary count.
Vocabulary items.
Access information nếu cần.
15. Personal Vocabulary Sets
15.1 Create Set
POST /api/vocabulary-sets
Access

User.

Request
{
  "name": "My Daily Words",
  "description": "Words I want to learn",
  "topic_id": 1
}
Rules
Set mới thuộc User hiện tại.
Set mặc định là private.
User không được tự chuyển Set thành public system content.
Ownership được backend xác định từ authenticated user.
15.2 Update Personal Set
PATCH /api/vocabulary-sets/:setId
Access

Owner only.

Backend phải kiểm tra:

set.owner_id == authenticated_user.id
15.3 Delete Personal Set
DELETE /api/vocabulary-sets/:setId
Access

Owner only.

16. Vocabulary Set Items
16.1 Add Vocabulary to Set
POST /api/vocabulary-sets/:setId/items
Access

Set owner.

Request
{
  "vocabulary_id": 10
}

Backend phải kiểm tra:

Set tồn tại.
User là owner.
Vocabulary tồn tại.
Vocabulary chưa nằm trong Set.
16.2 Remove Vocabulary from Set
DELETE /api/vocabulary-sets/:setId/items/:vocabularyId — legacy, not a Vocabulary Set V1 endpoint
Access

Set owner.

17. Copy Vocabulary Set
POST /api/vocabulary-sets/:setId/copy
Access

Authenticated User.

Purpose

Cho phép User copy một Vocabulary Set mà họ được phép truy cập.

Rules

Copy phải tạo:

New Vocabulary Set
    ↓
Owned by authenticated User
    ↓
Private

Copy là một Set độc lập.

Sau khi copy:

Owner của Set mới là User hiện tại.
Set mới không phụ thuộc ownership của Set cũ.
Thay đổi Set mới không làm thay đổi Set gốc.
Không được mutate Set gốc.
Operation phải đảm bảo transaction integrity.
### 17.1 Vocabulary Set V1 API Contract

All Vocabulary Set identifiers are UUID strings. Success responses use `{ "success": true, "data": ... }`, except `204`; errors use `{ "success": false, "error": { "code": "...", "message": "safe message" } }`. Sections 13–17 above are legacy generic drafts and do not define V1 endpoints.

#### Public System Set Routes

| Method / path | Access | Success | Contract |
|---|---|---:|---|
| `GET /api/topics/:topicId/vocabulary-sets` | Guest/User/ADMIN | `200` | Unpaginated public System Set summaries for one Topic. |
| `GET /api/vocabulary-sets/:setId` | Guest/User/ADMIN | `200` | Complete public System Set with ordered minimum Item metadata. |

Set summaries/details include nullable Set-level `cefr_level` (`A1`–`C1`) and nullable `cover_image_url`. Public detail Items contain only `id`, `vocabulary_id`, `word`, nullable `phonetic`, `position` and `created_at`; Set-level CEFR is not Vocabulary/Meaning CEFR. Responses never expose `cover_storage_key`, provider credentials or object-key ownership data. Public detail returns no private User Set data, Vocabulary Meaning/Example/CEFR aggregate, learning state or access to a Vocabulary catalog.

#### Scoped Authenticated Vocabulary Picker

`GET /api/vocabulary-set-picker?query=<word>` requires an authenticated USER or ADMIN and a non-empty trimmed query of at most 100 characters. USER results contain canonical plus session-owner private identities; ADMIN results are canonical-only. Results are bounded to 20 and contain `{ id, word, phonetic, source, primary_meaning }`, where `source` is `CANONICAL` or `PRIVATE` and `primary_meaning` is nullable `{ part_of_speech, meaning_vi }`. Same-spelling identities remain separate exact IDs, including zero-membership private Vocabulary. The picker is discovery only, not a standalone catalog.

#### USER Private Set Routes

| Method / path | Access | Success |
|---|---|---:|
| `GET /api/my/vocabulary-sets` | USER | `200` |
| `POST /api/my/vocabulary-sets` | USER | `201` |
| `GET /api/my/vocabulary-sets/:setId` | owner USER | `200` |
| `PATCH /api/my/vocabulary-sets/:setId` | owner USER | `200` |
| `DELETE /api/my/vocabulary-sets/:setId` | owner USER | `204` |
| `POST /api/vocabulary-sets/:systemSetId/copy` | USER | `201` |
| `POST /api/my/vocabulary-sets/:setId/cover` | owner USER | `200` |
| `DELETE /api/my/vocabulary-sets/:setId/cover` | owner USER | `200` |
| `POST /api/my/vocabulary-sets/:setId/cover/cleanup` | owner USER | `200` |

USER create/update accepts `name`, optional `description`, optional nullable Set `cefr_level`, optional nullable external HTTPS `cover_image_url`, and optional complete `items` collection. `topic_id`, `owner_id`, `is_public`, and client-supplied `cover_storage_key` are unsupported; supplying them returns `400 VALIDATION_ERROR`. New User Sets are private with `topic_id: null`, require no Topic lookup, and may be empty. Updating supported fields on a legacy categorized Personal Set preserves its Topic reference. USER list/detail retains `topic_id: uuid | null`. Copy accepts an accessible System Set only and creates an independent topicless private aggregate with fresh Set/Item IDs and preserved exact Vocabulary IDs/order; external covers copy the URL, while managed covers are copied to a new destination Set-owned object.

Owned private Set detail Items additionally expose derived `source` (`CANONICAL` or `PRIVATE`) so Set Detail can authorize private editing without inferring identity from spelling. Each Item also exposes the read-only display projection `primary_meaning: { part_of_speech, meaning_vi, example: { example_en, example_vi } | null } | null`. The projection selects the first Meaning ordered by `created_at ASC, id ASC`, then the first Example of that Meaning in the same deterministic order. It does not CEFR-rank, fall back to another record, or generate missing data. Public System and ADMIN Set detail retain their existing Item projections and do not expose this USER-only field.

Personal Set Detail membership management reuses the existing complete `items` PATCH contract. Adding an existing exact `vocabulary_id` submits the current authoritative order followed by that ID; removing submits the remaining IDs in their existing relative order. Removing membership never deletes Vocabulary or Learning Progress. V1 intentionally retains last-write-wins behavior across concurrent tabs and adds no granular membership or version endpoint.

#### ADMIN System Set Routes

| Method / path | Access | Success |
|---|---|---:|
| `GET /api/admin/vocabulary-sets` | ADMIN | `200` |
| `POST /api/admin/vocabulary-sets` | ADMIN | `201` |
| `GET /api/admin/vocabulary-sets/:setId` | ADMIN | `200` |
| `PATCH /api/admin/vocabulary-sets/:setId` | ADMIN | `200` |
| `DELETE /api/admin/vocabulary-sets/:setId` | ADMIN | `204` |
| `POST /api/admin/vocabulary-sets/:setId/cover` | ADMIN | `200` |
| `DELETE /api/admin/vocabulary-sets/:setId/cover` | ADMIN | `200` |
| `POST /api/admin/vocabulary-sets/:setId/cover/cleanup` | ADMIN | `200` |

ADMIN routes manage System Sets only. Create requires a valid non-null `topic_id`, `name`, Set `cefr_level` (`A1`–`C1`), and one-or-more valid Items; `cover_image_url` is optional. PATCH accepts Topic reassignment but rejects clearing Topic or CEFR; it also accepts supported metadata and optional complete `items`. If supplied, `items` is the complete desired order and atomically replaces/reorders owned Items. Omitted supported PATCH fields remain unchanged; `description: null` clears it. There is no granular Set Item route.

Cover upload uses single-file `multipart/form-data` field `cover`. JPEG, PNG and WebP input is signature-validated, limited to 5 MiB and 4096×4096, auto-oriented, resized without enlargement to a longest edge of at most 1600 px, stripped of unnecessary metadata, and stored as WebP quality 82. Processing is bounded to 2 concurrent jobs plus 8 queued jobs with a 15-second deadline. External cover URLs must be HTTPS and are rendered directly; the backend does not fetch or optimize them.

Successful upload/remove/cleanup returns the current safe Set representation and `meta.storage_cleanup` (`complete` or `retry_required`). Metadata mutation remains authoritative if deletion of a superseded object fails; the exact Set-scoped cleanup route is the retry path. Create/upload/copy persistence failures compensate by removing only the exact newly created managed object. Delete fails safely before database deletion if managed-object cleanup cannot complete. Storage keys are server-generated, Set-scoped, never accepted from clients, and never serialized.

Known errors are `400 VALIDATION_ERROR`, `404 VOCABULARY_SET_NOT_FOUND`, `404 TOPIC_NOT_FOUND`, `404 VOCABULARY_NOT_FOUND`, `409 VOCABULARY_ALREADY_IN_SET`, existing `401 AUTHENTICATION_FAILED`, existing `403 FORBIDDEN`, and safe `500 INTERNAL_SERVER_ERROR`.

18. Community

Community V1 chỉ bao gồm:

Posts.
Comments.
Vocabulary Set sharing.

Không bao gồm:

Likes.
Reactions.
Followers.
Friends.
Direct messages.
Chat.
Leaderboard.
19. Community Posts
19.1 List Posts
GET /api/community/posts
Access

Guest/User tùy visibility rule.

19.2 Get Post
GET /api/community/posts/:postId
19.3 Create Post
POST /api/community/posts
Access

User.

Request
{
  "content": "This vocabulary set is useful for beginners.",
  "vocabulary_set_id": 12
}

vocabulary_set_id có thể nullable.

Nếu post chia sẻ Set:

User phải có quyền share Set đó.
User phải là owner của personal Set nếu Set là private.
Không được share private Set của User khác.

Sharing thông qua Community Post không làm thay đổi is_public của Vocabulary Set.

19.4 Update Post
PATCH /api/community/posts/:postId
Access

Post owner hoặc Admin theo authorization rule.

19.5 Delete Post
DELETE /api/community/posts/:postId
Access

Post owner hoặc Admin.

20. Community Comments
20.1 Create Comment
POST /api/community/posts/:postId/comments
Access

User.

Request
{
  "content": "Thanks for sharing!"
}
20.2 Update Comment
PATCH /api/community/comments/:commentId
Access

Comment owner hoặc Admin.

20.3 Delete Comment
DELETE /api/community/comments/:commentId
Access

Comment owner hoặc Admin.

21. Learning / Flashcard

### 21.0 Flashcard / Learning + SRS V1 Active Contract

The active SRS V1 contract supersedes the original two-outcome Flashcard contract and the generic numeric-ID and review/gamification drafts later in sections 21–25. All identifiers are UUID strings. Both endpoints require an authenticated `USER`; Guest receives the existing `401 AUTHENTICATION_FAILED`, and authenticated `ADMIN` receives the existing `403 FORBIDDEN`.

#### `GET /api/learning/sets/:setId`

The requested Set must be either a public System Set or a private Set owned by the current USER. Inaccessible private Sets use the not-found boundary. An accessible empty Set returns `409 LEARNING_SET_EMPTY`. The optional exact `mode` query defaults to `SRS`; supported values are `SRS` and `NORMAL`.

The response uses `{ "success": true, "data": ... }` and contains Set ID/name, a stable `topic` value (`TopicSummary | null`), `mode`, and mode-specific cards. `NORMAL` returns every Set Item in exact `position` order and is read-only. `SRS` returns a fixed snapshot of eligible NEW, LEARNING, legacy-compatible or due cards, evaluated at one backend-owned `evaluated_at`, together with total/eligible counts and nullable nearest future due time. Each card contains the approved Vocabulary aggregate and current USER progress projection; SRS cards additionally contain authoritative `rating_previews`.

```json
{
  "status": "NEW",
  "stored_status": null,
  "stage": 0,
  "interval_days": null,
  "next_review_at": null,
  "review_count": 0,
  "revision": 0,
  "last_reviewed_at": null
}
```

`NEW` means no persisted progress row; reads never create or update one. Responses expose no private owner internals, `last_event_id`, XP or reward data.

#### `POST /api/learning/events`

The exact request body is:

```json
{
  "event_id": "uuid",
  "set_id": "uuid",
  "vocabulary_id": "uuid",
  "expected_revision": 0,
  "rating": "GOOD"
}
```

Only `AGAIN`, `HARD`, `GOOD` and `EASY` are allowed. Former `outcome`, `REMEMBERED` and `STUDY_AGAIN` payloads are rejected. The backend derives the USER, revalidates Set access/current exact membership, applies the authoritative deterministic scheduler, and atomically writes status, interval, due/review timestamps, `review_count`, `revision` and `last_event_id`. `AGAIN` resets to immediately-due stage 0/`LEARNING`; passing ratings persist `LEARNED` on the 1/3/7/14/30-day ladder. NORMAL mode never calls this endpoint.

An immediate retry using the current `last_event_id` is idempotent and returns unchanged progress. A delayed/reordered different event with a stale revision returns `409 LEARNING_PROGRESS_CHANGED`. V1 has no event-history/ledger table and does not promise arbitrary historical replay idempotency.

Known safe errors are `400 VALIDATION_ERROR`, `404 LEARNING_SET_NOT_FOUND`, `409 LEARNING_SET_EMPTY`, `409 LEARNING_SET_ITEM_CHANGED`, `409 LEARNING_PROGRESS_CHANGED`, existing `401 AUTHENTICATION_FAILED`, existing `403 FORBIDDEN`, and safe `500 INTERNAL_SERVER_ERROR`.

Reveal, NORMAL navigation, audio playback, reload, restart and client-run completion are not meaningful backend events and must not create/update progress.

### 21.0.1 Learning Progress View V1 Active Read Contract

`GET /api/learning/progress` is an authenticated `USER`-only, read-only extension over the completed Learning Progress engine. Guest receives the existing `401 AUTHENTICATION_FAILED`; authenticated ADMIN receives the existing `403 FORBIDDEN`. The backend derives `user_id` from the session and accepts no user selector.

Supported query parameters are optional scalar `page` (default `1`), `page_size` (default `20`, maximum `100`) and exact `status` (`LEARNING`, `LEARNED` or `NEEDS_REVIEW`). Unknown, repeated, malformed or unsupported query values return `400 VALIDATION_ERROR`. Search and client-selectable sorting are not part of V1.

The success envelope contains an unfiltered current-USER summary (`total_started`, `learning`, `learned`, `needs_review`), the optionally status-filtered page, truthful filtered pagination (`page`, `page_size`, `total_items`, `total_pages`) and the applied nullable status filter. Each item returns only Vocabulary `id`, `word`, nullable `phonetic`, plus progress `status`, `review_count` and nullable `last_reviewed_at`.

Records are ordered by `last_reviewed_at` descending with nulls last, then progress `created_at` descending and progress `id` ascending. A positive out-of-range page succeeds with an empty item collection and truthful metadata.

Conceptual `NEW` is excluded because it has no persisted row and V1 defines no global eligible Vocabulary universe. Summary, filters and items derive effective due state at one backend `evaluated_at`: learned schedules with `next_review_at <= evaluated_at` appear as `NEEDS_REVIEW`, future schedules remain `LEARNED`, and immediately-due stage-0 rows remain `LEARNING`. Reads never create or mutate progress and expose no Meaning/Example, Set/Topic membership, revision/event ID or other USER's data.

Unexpected failures use the existing safe `500 INTERNAL_SERVER_ERROR` contract. This endpoint does not change `GET /api/learning/sets/:setId` or `POST /api/learning/events`.

### 21.0.2 SRS V1 Rating Preview Extension

This section gives the detailed rating-preview matrix for the active contract above. `GET /api/learning/sets/:setId?mode=SRS` evaluates eligibility and all rating previews at the response's single backend-owned `evaluated_at`. Each eligible card includes:

```json
{
  "rating_previews": {
    "AGAIN": { "kind": "SESSION_REQUEUE", "interval_days": null },
    "HARD": { "kind": "SCHEDULED", "interval_days": 1 },
    "GOOD": { "kind": "SCHEDULED", "interval_days": 3 },
    "EASY": { "kind": "SCHEDULED", "interval_days": 7 }
  }
}
```

`HARD`, `GOOD` and `EASY` preview values are calculated by the same pure deterministic scheduler used by `POST /api/learning/events`; they are not frontend estimates. For stages `0` through `5`, the respective `(HARD, GOOD, EASY)` interval-day matrix is `(1,3,7)`, `(1,3,7)`, `(3,7,14)`, `(7,14,30)`, `(14,30,30)`, and `(30,30,30)`. The 30-day cap applies. `AGAIN` is an immediate unresolved same-session requeue and therefore intentionally has no future interval.

`GET /api/learning/sets/:setId?mode=NORMAL` does not expose `rating_previews`. Rating mutation semantics, eligibility, idempotency and the no-schema-change persistence contract remain unchanged.

Flashcard là learning activity.

Không phải Quiz.

21.1 Start Learning Set

This subsection is a legacy generic illustration. The active UUID response and authorization contract is defined in section 21.0 above.
GET /api/learning/sets/:setId
Access

Authenticated User.

Response

Có thể bao gồm:

{
  "success": true,
  "data": {
    "set": {
      "id": 1,
      "name": "Daily Life"
    },
    "words": []
  }
}

Backend phải chỉ trả Vocabulary mà User được phép học.

22. Learning Progress

Sections 22–25 are retained as future conceptual background only. They do not define Flashcard / Learning V1 endpoints, gamification, SRS scheduling or a `POST /api/learning/review` route; section 21.0 is authoritative for V1.

Learning Progress được lưu theo:

User + Vocabulary

Không tạo V1 learning history table.

22.1 Progress States

Progress status gồm:

NEW
LEARNING
LEARNED
NEEDS_REVIEW

Ý nghĩa:

NEW

User chưa có learning progress thực tế với Vocabulary.

LEARNING

User đã bắt đầu học nhưng chưa đạt trạng thái learned.

LEARNED

User đã đạt trạng thái học thành công theo learning rules.

NEEDS_REVIEW

Vocabulary cần được ôn lại.

23. Review Learning Item
POST /api/learning/review
Access

Authenticated User.

Request

Conceptual structure:

{
  "vocabulary_id": 10,
  "activity_type": "FLASHCARD"
}

Exact request fields có thể được điều chỉnh trong PLAN.

Responsibilities

Backend quyết định:

Learning Progress.
XP.
Daily Goal progress.
Streak.
Achievement.
Spaced Repetition state nếu applicable.

Frontend không được tự tính các giá trị này.

23.1 Important Quiz Rule

For Quiz V1, `POST /api/quiz/answers` is the only command that evaluates an answer and mutates the current USER's Learning Progress for that answer.

The Frontend must not also call `POST /api/learning/events` for the same Quiz answer. This prevents duplicate Progress mutation and duplicate `review_count`/`revision` increments.

Quiz V1 does not update XP, streak, Daily Goal, Achievement or SRS state.
24. Spaced Repetition

Spaced Repetition dùng để xác định Vocabulary cần review.

Backend là source of truth.

Các field và thuật toán cụ thể phụ thuộc vào Database và PLAN.

Ví dụ dữ liệu có thể bao gồm:

next_review_at
interval_days
ease_factor

Không được tự ý thay đổi thuật toán hoặc field contract trong IMPLEMENT nếu chưa có PLAN/approval.

25. Words to Review
GET /api/learning/review
Access

Authenticated User.

Purpose

Lấy các Vocabulary đang đến hạn review.

Response
{
  "success": true,
  "data": {
    "items": [],
    "count": 0
  }
}

Backend quyết định Vocabulary nào thuộc nhóm:

NEEDS_REVIEW

và đã đến thời điểm review.

26. Quiz V1

Quiz V1 supports exactly two types for an authenticated `USER`:

- `VI_TO_ENGLISH`
- `UNSCRAMBLE_WORD`

`UNSCRAMBLE_WORD` replaces the historical `MISSING_LETTER` contract after TASK-086 visual review. Earlier completed-task evidence remains historical and must not be interpreted as the active API.

A run is scoped to one accessible, non-empty Vocabulary Set, uses one selected type and traverses every current Set Item once in explicit position order. Guest and ADMIN have no learner Quiz V1 API access. Missing or inaccessible Sets use the approved concealed not-found behavior.

Quiz V1 is transient. It creates no Quiz Session, Quiz Attempt, answer history, durable score or accuracy record.

27. Quiz: Vietnamese → English

`VI_TO_ENGLISH` presents the deterministic primary Vietnamese Meaning and approved prompt metadata. Primary Meaning selection matches Flashcard/Learning: choose the lowest recognized CEFR (`A1` through `C2`), preserving deterministic `created_at → id` order for ties or missing CEFR.

The pre-answer payload structurally excludes canonical-answer fields and directly answer-bearing Vocabulary fields such as `word`, `phonetic`, `pronunciation_url` and English Examples. V1 does not scan or rewrite administrator-authored Vietnamese Meaning/context text.

28. Quiz: Unscramble Word

`UNSCRAMBLE_WORD` presents the deterministic primary Vietnamese Meaning/context plus a safe shuffled projection of the canonical English headword. The projection contains opaque duplicate-safe selectable tile IDs/characters, a separator-only slot pattern and `shuffle_mode`; it contains no canonical word or canonical source indexes.

The Backend iterates NFC Unicode code points. Unicode letters/digits are selectable; collapsed spaces, apostrophes, hyphens and other punctuation remain fixed significant separators. Digest-backed ordering is deterministic for the same `run_id` and question and may change for a new run. When no visibly different permutation exists, `IDENTITY_FALLBACK` preserves the item rather than dropping it. No Quiz state is persisted.

29. Get Ordered Quiz Questions

`GET /api/quiz/sets/:setId/questions?type=<quizType>&run_id=<uuid>`

Access: authenticated `USER` only.

The response returns every current Set Item once in explicit position order. Each safe question projection includes UUID identity, selected type, position, display prompt data and an opaque `question_revision`. Unscramble questions include only the approved safe tile/slot projection. It does not expose a canonical answer.

`question_revision` is derived deterministically from authoritative fields relevant to the question, does not reveal the answer and is recomputed transactionally on answer submission. It is API-only and is not persisted.

30. Submit Quiz Answer

`POST /api/quiz/answers`

Access: authenticated `USER` only.

Request fields:

```json
{
  "event_id": "uuid",
  "set_id": "uuid",
  "vocabulary_id": "uuid",
  "run_id": "uuid",
  "question_revision": "opaque-value",
  "quiz_type": "VI_TO_ENGLISH",
  "expected_revision": 0,
  "answer": "work"
}
```

The Backend transactionally re-authorizes Set access and current membership, validates the question revision, normalizes and evaluates the answer, and mutates only the requesting USER's Learning Progress:

- correct → `LEARNED`;
- incorrect → `LEARNING`;
- either accepted outcome increments `review_count` and `revision` exactly once and updates `last_reviewed_at`/`last_event_id`;
- future SRS fields remain unchanged/null.

Answer normalization trims, applies Unicode NFC, collapses Unicode whitespace and applies locale-independent lowercase. For `VI_TO_ENGLISH` only, one normalized submitted ASCII space is accepted in place of one canonical ASCII hyphen; the equivalence is one-way and does not remove separators or relax apostrophes/other punctuation. `UNSCRAMBLE_WORD` fixed separators remain strict. Post-acceptance feedback uses deterministic minimum-edit alignment over Unicode code points and exposes explicit `correct`, `incorrect`, `missing` and `extra` states. A missing item has `submitted: null`; an accepted space/hyphen pair retains submitted space, expected hyphen and `correct` state for the shared accessible underline presentation.

`expected_revision` protects concurrency. Immediate retry with the same current `event_id` and identical logical request does not mutate Progress again. The Backend recomputes transient feedback; incompatible retry state and stale/reordered events return safe conflict responses. Exact historical response replay and an event ledger are outside V1.

Quiz V1 safe error contract:

| Condition | HTTP status | Error code |
|---|---:|---|
| Invalid UUID/type/body/query or unsupported extra input | `400` | `QUIZ_VALIDATION_ERROR` |
| Missing authentication | `401` | existing authentication error |
| Authenticated non-USER role | `403` | existing authorization error |
| Missing/inaccessible Set | `404` | `QUIZ_SET_NOT_FOUND` |
| Accessible empty Set | `409` | `QUIZ_SET_EMPTY` |
| Vocabulary is no longer a current Set Item | `409` | `QUIZ_ITEM_CHANGED` |
| `question_revision` no longer matches authoritative content | `409` | `QUIZ_QUESTION_CHANGED` |
| Stale revision, reordered event or incompatible immediate retry | `409` | `QUIZ_PROGRESS_CONFLICT` |

Errors expose no canonical answer, private Set existence, stack trace or database detail.

31. Quiz Character Feedback

The accepted answer response may include per-character feedback computed over Unicode code points. Each position is marked correct or incorrect without storing character feedback in the database.

32. Transient Quiz Result

An accepted response includes question identity, Quiz type, `is_correct`, canonical answer, normalized submitted answer, accessible character feedback and resulting Progress `status`, `review_count`, `revision` and `last_reviewed_at`.

The Frontend derives only the transient current-run total/correct/incorrect completion summary. No XP, streak, achievement, SRS schedule, durable result/history ID or accuracy record is returned or persisted.

33. XP

XP được backend quản lý.

V1 không có XP transaction/history table.

Universal XP Rules

Tất cả User sử dụng cùng một XP rule.

New Word
+3 XP
Review Previously Learned Word
+1 XP
Correct Quiz
+3 XP
Incorrect Quiz
+0 XP
Repeated Same Activity Without New Learning Event
+0 XP

Mục đích là ngăn XP farming bằng việc:

mở lại flashcard liên tục.
click lại cùng một action.
submit/repeat meaningless activity.

Backend phải xác định activity có thực sự tạo learning event hay không.

34. Daily Goal XP

Daily Goal tính dựa trên:

activity XP

Không tính bonus XP vào việc đạt goal.

Ví dụ:

Goal = 50 XP
Activity XP = 50 XP
Bonus = 10 XP

Kết quả:

today_xp = 50
goal_completed = true
bonus_xp = 10
total earned = 60

Không dùng bonus XP để tiếp tục kích hoạt Daily Goal.

35. Daily Goal Bonus

Khi User đạt Daily Goal lần đầu trong ngày:

bonus = 20% of Daily Goal

Có:

minimum = 10 XP
maximum = 40 XP

Ví dụ:

Goal	Bonus
50	10
100	20
150	30
200	40

Bonus chỉ được nhận một lần mỗi ngày.

36. Daily Progress

Daily progress được lưu theo ngày.

Conceptual resource:

USER_DAILY_PROGRESS

Key:

(user_id, date)
36.1 Get Today's Progress
GET /api/users/me/daily-progress
Response
{
  "success": true,
  "data": {
    "date": "2026-09-15",
    "activity_xp": 30,
    "bonus_xp": 0,
    "goal_xp": 50,
    "goal_completed": false
  }
}

Nếu chưa có record của ngày hiện tại:

activity_xp = 0
bonus_xp = 0
goal_completed = false

Backend không cần cron reset toàn bộ User mỗi ngày.

37. Level

Level được tính từ:

total_xp

Level không phải learning progress.

Level chỉ phục vụ gamification.

37.1 Level Rules
Level bắt đầu từ 1.
Level 2 đạt khi tổng XP đạt 50.
XP tiếp tục tăng theo hoạt động.
Level tăng theo threshold.
Level tối đa là 15.
XP không có giới hạn.
Khi đạt Level 15:
Level giữ nguyên 15.
XP vẫn tiếp tục tăng.
UI có thể hiển thị:
Level 15 — MAX

Level không tự động unlock/lock Vocabulary Set hoặc Topic trong V1.

38. Level Calculation

Threshold cụ thể của từng Level phải được xác định trong business configuration/PLAN.

Nguyên tắc:

level = highest level whose threshold <= total_xp

Ví dụ:

total_xp < 50
→ Level 1

total_xp >= 50
→ Level 2

Không hard-code threshold ở frontend.

39. Streak

Streak đo tính liên tục của learning activity.

Không dựa vào login.

39.1 Qualifying Activities

Có thể bao gồm:

Vocabulary learning.
Flashcard learning.
Quiz.
Pronunciation Practice.
Review.

Dashboard/login/profile/topic viewing không được tính streak.

39.2 Streak Rules

Nếu User có learning activity:

Yesterday + Today
→ streak +1

Nếu User đã được tính streak trong hôm nay:

No additional increment

Nếu User bỏ qua một hoặc nhiều ngày:

Next qualifying activity
→ streak = 1

Multiple activities trong cùng một ngày chỉ tính:

1 learning day

V1 không có Streak Freeze.

Streak không yêu cầu minimum XP threshold.

40. Streak API
40.1 Get Streak
GET /api/users/me/streak
Response
{
  "success": true,
  "data": {
    "current_streak": 7,
    "longest_streak": 12,
    "last_activity_date": "2026-09-15"
  }
}

Streak được cập nhật bởi backend khi qualifying learning activity xảy ra.

Frontend không tự tăng streak.

41. Achievement

Achievement được quản lý bởi backend.

41.1 List Achievements
GET /api/achievements
Access

Authenticated User.

Có thể trả:

Achievement definition.
User unlocked status.
41.2 User Achievements
GET /api/users/me/achievements
Response
{
  "success": true,
  "data": []
}
42. Achievement Unlock

Achievement có thể được kiểm tra sau qualifying activity.

Ví dụ:

Learning milestone.
Streak milestone.
XP milestone.
Quiz milestone.

Exact achievement list không được tự ý mở rộng trong IMPLEMENT nếu chưa có business requirement/PLAN.

43. Dashboard

### 43.0 Dashboard V1 Active Composition Contract

Dashboard V1 is a read-only frontend composition for authenticated users at `/dashboard`. It does not add a Dashboard backend endpoint.

For `USER`, the frontend composes only these completed sources:

- the existing Authentication context for `display_name` and role;
- `GET /api/learning/progress?page=1&page_size=1` for persisted `total_started`, `learning` and `learned` summary values;
- `GET /api/my/vocabulary-sets` for the exact owned private Set count and a UI preview of at most the first three records in existing deterministic server order.

The Dashboard sends no user selector. Existing session-derived USER authorization and ownership predicates remain authoritative. The two USER data sources load and retry independently; a failure in one source must not discard successful data from the other.

Authenticated `ADMIN` retains `/dashboard` as a safe neutral landing and must not call either USER-only endpoint. Guest access remains protected by the existing Authentication route behavior.

Dashboard reads create or update no Learning Progress, Vocabulary Set or Dashboard persistence. V1 adds no global/Topic/Set percentage, conceptual `NEW`, review queue, SRS, recency, Continue Learning, XP, Level, Streak, Daily Goal, achievement, activity/history, Quiz/Pronunciation metric or Admin Dashboard behavior.

### 43.1 Future Dashboard Aggregation — Deferred

The following aggregate endpoint and fields are retained as future conceptual background only. They are not an active V1 API contract and must not be implemented without a separately approved SPEC/PLAN/TASK.

Dashboard may eventually aggregate data from multiple domains. A separate Dashboard table is not necessarily required.

Conceptual endpoint: `GET /api/users/me/dashboard`

Access

Authenticated User (future scope).

Response

Conceptual:

{
  "success": true,
  "data": {
    "level": 3,
    "total_xp": 320,
    "streak": 7,
    "daily_goal": {
      "goal_xp": 50,
      "today_xp": 30,
      "goal_completed": false
    },
    "continue_learning": [],
    "topic_progress": [],
    "words_to_review": 5
  }
}

Future Dashboard API may aggregate:

Level.
Total XP.
Streak.
Daily Goal.
Today's XP.
Topic progress.
Continue Learning.
Words to Review.

Implementation remains deferred to a future approved workflow.

44. Topic Progress

Topic progress được tính từ Learning Progress.

Conceptual:

Topic
 ↓
Vocabulary Sets
 ↓
Vocabulary
 ↓
User Learning Progress

Ví dụ:

{
  "topic_id": 1,
  "topic_name": "Daily Life",
  "learned_words": 80,
  "total_words": 100,
  "progress_percent": 80
}

Không cần lưu một field progress percentage riêng nếu có thể tính từ dữ liệu nguồn.

Tránh duplicate derived data không cần thiết.

45. Continue Learning

Dashboard có thể trả các Set/Topic User đang học gần đây hoặc đang có progress.

Ví dụ:

{
  "set_id": 1,
  "set_name": "Daily Life",
  "progress_percent": 65,
  "learned_words": 130,
  "total_words": 200
}

Tiêu chí lựa chọn cụ thể phải được quyết định trong PLAN.

Không tự ý tạo thêm recommendation algorithm nếu chưa có requirement.

46. Pronunciation

Pronunciation là learning activity riêng.

Không phải:

Quiz Type #3

V1 có:

Flashcard
    ↓
Model Pronunciation
    ↓
Pronunciation Practice
    ↓
Quiz
47. Model Pronunciation

Flashcard cung cấp pronunciation của hệ thống.

UI có speaker button:

🔊

Model pronunciation đọc Vocabulary đang hiển thị.

Cách triển khai TTS cụ thể được quyết định trong PLAN.

API không nên khóa implementation vào một vendor cụ thể nếu chưa cần.

48. Pronunciation Practice

Pronunciation Practice gồm:

Display Word
    ↓
Listen Model
    ↓
Press Microphone
    ↓
Record User Voice
    ↓
Processing
    ↓
Evaluate
    ↓
Result / Feedback
    ↓
Retry
49. Pronunciation API

Conceptual endpoint:

POST /api/pronunciation/evaluate
Access

Authenticated User.

Request

Có thể bao gồm:

Vocabulary ID.
Audio recording.

Ví dụ conceptual:

multipart/form-data

Exact request/response contract phụ thuộc implementation được chọn trong PLAN.

50. Pronunciation Evaluation

Backend/system có thể trả:

{
  "success": true,
  "data": {
    "score": 82,
    "is_acceptable": true,
    "feedback": "Good pronunciation"
  }
}

Các metric chính xác:

Score.
Threshold.
Audio processing.
Speech recognition.
Pronunciation comparison.
External service/API nếu có.

được quyết định trong PLAN.

Không được tự ý cam kết sử dụng AI hoặc external pronunciation service chỉ vì API tồn tại.

51. Pronunciation History

V1 không lưu pronunciation attempt history.

Không tạo API:

GET /api/pronunciation/history

trừ khi feature này được phê duyệt bổ sung.

52. Progress Summary
GET /api/users/me/progress
Access

Authenticated User.

Có thể trả:

{
  "success": true,
  "data": {
    "total_words": 200,
    "learned_words": 120,
    "learning_words": 40,
    "needs_review_words": 20,
    "new_words": 20
  }
}

Có thể bổ sung summary theo Topic/Set nếu UI cần.

Không dùng các khái niệm chưa được định nghĩa trong Database Specification như một status riêng.

53. Admin - Users
53.1 List Users
GET /api/admin/users
Access

Admin.

53.2 Get User
GET /api/admin/users/:userId
Access

Admin.

53.3 Update User
PATCH /api/admin/users/:userId
Access

Admin.

Admin không được tùy tiện chỉnh:

total XP.
learning progress.
streak.

trừ khi có administrative requirement rõ ràng.

53.4 Delete / Disable User
DELETE /api/admin/users/:userId

Hoặc disable mechanism tương đương nếu được quyết định trong architecture.

Behavior phải tuân Database/PLAN.

54. Admin - Vocabulary

Vocabulary V1 ADMIN routes and aggregate semantics are defined in section 12. There is no public Vocabulary read, granular child endpoint, Vocabulary Set relation or external-reference delete policy in V1.

55. Admin - Vocabulary Sets
55.1 Create System Set
POST /api/admin/vocabulary-sets
Access

Admin.

System Set được Admin quản lý.

55.2 Update System Set
PATCH /api/admin/vocabulary-sets/:setId
Access

Admin.

55.3 Delete System Set
DELETE /api/admin/vocabulary-sets/:setId
Access

Admin.

56. Admin - Achievements

Admin có thể quản lý system Achievement definitions.

Conceptual endpoints:

POST   /api/admin/achievements
PATCH  /api/admin/achievements/:id
DELETE /api/admin/achievements/:id

Exact fields phụ thuộc Database/PLAN.

57. Admin - Community Moderation

Admin có thể xem/xử lý Community content khi cần.

Conceptual endpoints:

GET    /api/admin/community/posts
DELETE /api/admin/community/posts/:postId
DELETE /api/admin/community/comments/:commentId

Mục đích:

Remove inappropriate content.
Maintain system integrity.

V1 không xây dựng hệ thống moderation phức tạp nếu chưa có requirement.

58. Authorization Rules

Backend phải enforce authorization.

User-owned resource

User chỉ được sửa/xóa resource mà mình sở hữu.

Ví dụ:

Vocabulary Set
Community Post
Community Comment
Admin resource

Admin API yêu cầu:

authenticated
+
role = ADMIN
Public resource

Guest chỉ được truy cập resource được xác định là public.

59. Ownership Rules

Backend không tin:

{
  "owner_id": 123
}

từ frontend để xác định ownership.

Owner phải được lấy từ authenticated identity.

Ví dụ:

authenticated_user.id
60. Visibility Rules

System Vocabulary Set:

Public

Personal User Set:

Private by default

User không có quyền trực tiếp biến personal Set thành public system Set.

Community sharing:

Personal Set
    ↓
Community Post
    ↓
Other User
    ↓
Copy Set

Copy tạo Set mới độc lập.

61. Backend Source of Truth

Các giá trị sau phải được backend xác định:

correct_answer
is_correct
learning_status
learning_progress
xp_earned
total_xp
level
streak
daily_goal_progress
daily_goal_bonus
achievement unlock
spaced repetition state
ownership
visibility
authorization

Frontend chỉ hiển thị hoặc gửi input cần thiết.

62. Validation

Backend phải validate:

Required fields.
Data types.
String length.
Numeric range.
Enum values.
Resource existence.
Ownership.
Authorization.
Duplicate relationships.
Invalid IDs.
Invalid quiz type.
Invalid learning activity.
Daily Goal range.

Ví dụ:

daily_xp_goal < 50
→ 400 Bad Request
quiz_type = UNKNOWN
→ 400 Bad Request
63. Error Response

API sử dụng format thống nhất.

Ví dụ:

{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {}
  }
}
64. HTTP Status Codes

Có thể sử dụng:

200 OK
201 Created
204 No Content
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity
500 Internal Server Error

Chỉ sử dụng status code phù hợp với semantic của operation.

65. Pagination

Các endpoint trả danh sách lớn nên hỗ trợ pagination.

Ví dụ:

GET /api/vocabulary-sets?page=1&limit=20

Response:

{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "total_pages": 5
  }
}

Exact pagination implementation được quyết định trong PLAN.

66. Security Requirements

API phải đảm bảo:

Password không được trả về response.
Password phải được hash.
Authentication phải được kiểm tra ở backend.
Authorization phải được kiểm tra ở backend.
User không được tự thay đổi role.
User không được tự tăng XP.
User không được tự gửi is_correct=true.
User không được tự gửi xp_earned.
User không được truy cập private resource của User khác.
Admin endpoint phải được bảo vệ.
Input phải được validate.
Database query phải tránh injection.
Sensitive error details không được trả về production response.
67. Transaction Requirements

Các operation liên quan nhiều bảng phải đảm bảo transaction integrity khi cần.

Đặc biệt:

Copy Vocabulary Set
Create Set
+
Copy Set Items

phải thành công đồng bộ.

Nếu operation thất bại giữa chừng:

Rollback
Learning Activity

Một learning activity có thể đồng thời cập nhật:

Learning Progress
Daily Progress
XP
Streak
Achievement
Spaced Repetition

Nếu implementation yêu cầu atomic behavior, các thay đổi liên quan phải được xử lý transactionally.

Exact transaction boundary được xác định trong PLAN.

68. API Idempotency / Duplicate Activity

Backend phải tránh việc cùng một meaningful activity bị xử lý nhiều lần ngoài ý muốn.

Đặc biệt cần xem xét:

Double submit.
Retry request.
Network retry.
Repeated quiz submission.
Repeated learning review.

Mục tiêu:

Không double XP
Không double streak
Không double achievement
Không tạo duplicate progress

Cơ chế kỹ thuật cụ thể được quyết định trong PLAN.

69. API and Database Consistency

Mọi API liên quan đến database phải tuân theo:

DATABASE.md

Không được:

sử dụng field không tồn tại.
tạo relationship ngoài specification.
tự thêm table.
tự thêm status.
tự thêm enum.
tự thay đổi ownership model.

Nếu implementation phát hiện Database Specification chưa đủ:

STOP
→ REPORT
→ PLAN / DATABASE UPDATE
→ APPROVAL
→ IMPLEMENT
70. Out of Scope - V1

Các API sau không thuộc V1 nếu chưa được phê duyệt:

Likes
Reactions
Followers
Friends
Direct Messages
Chat
Leaderboard
Payment
Subscription
Free/Premium tier
XP transaction history
Learning history
Pronunciation attempt history
Download history
Third quiz type
Streak Freeze
AI tutor
Mandatory AI integration

AI có thể được xem xét như enhancement riêng, nhưng không phải dependency bắt buộc của core system.

71. API Endpoint Inventory
Authentication
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
User
GET    /api/users/me
PATCH  /api/users/me

GET    /api/users/me/daily-goal
PATCH  /api/users/me/daily-goal

GET    /api/users/me/daily-progress
GET    /api/users/me/streak
GET    /api/users/me/achievements
GET    /api/users/me/progress
GET    /api/users/me/dashboard
Topic
GET    /api/topics
GET    /api/topics/:topicId

POST   /api/admin/topics
PATCH  /api/admin/topics/:topicId
DELETE /api/admin/topics/:topicId
Vocabulary
GET    /api/admin/vocabulary
GET    /api/admin/vocabulary/:vocabularyId
POST   /api/admin/vocabulary
PATCH  /api/admin/vocabulary/:vocabularyId
DELETE /api/admin/vocabulary/:vocabularyId
Vocabulary Set
GET    /api/topics/:topicId/vocabulary-sets
GET    /api/vocabulary-sets/:setId
GET    /api/vocabulary-set-picker?query=<word>

GET    /api/my/vocabulary-sets
POST   /api/my/vocabulary-sets
GET    /api/my/vocabulary-sets/:setId
PATCH  /api/my/vocabulary-sets/:setId
DELETE /api/my/vocabulary-sets/:setId

POST   /api/vocabulary-sets/:systemSetId/copy

GET    /api/admin/vocabulary-sets
POST   /api/admin/vocabulary-sets
GET    /api/admin/vocabulary-sets/:setId
PATCH  /api/admin/vocabulary-sets/:setId
DELETE /api/admin/vocabulary-sets/:setId
Learning
GET    /api/learning/sets/:setId
POST   /api/learning/review
GET    /api/learning/review
Quiz
GET    /api/quiz/sets/:setId/questions?type=<quizType>&run_id=<uuid>
POST   /api/quiz/answers
Pronunciation
POST   /api/pronunciation/evaluate
Achievement
GET    /api/achievements

POST   /api/admin/achievements
PATCH  /api/admin/achievements/:id
DELETE /api/admin/achievements/:id
Community
GET    /api/community/posts
GET    /api/community/posts/:postId
POST   /api/community/posts
PATCH  /api/community/posts/:postId
DELETE /api/community/posts/:postId

POST   /api/community/posts/:postId/comments
PATCH  /api/community/comments/:commentId
DELETE /api/community/comments/:commentId
Admin
GET    /api/admin/users
GET    /api/admin/users/:userId
PATCH  /api/admin/users/:userId
DELETE /api/admin/users/:userId

GET    /api/admin/community/posts
DELETE /api/admin/community/posts/:postId
DELETE /api/admin/community/comments/:commentId
72. API Development Rules

Khi triển khai API:

Đọc AGENTS.md.
Đọc requirement liên quan.
Kiểm tra DATABASE.md.
Kiểm tra API_SPEC.md.
Kiểm tra implementation hiện tại.
Xác định reuse/extend/create.
Không tự ý thay đổi contract.
Không tự ý thêm endpoint.
Không tự ý thêm field.
Không tự ý thêm business rule.
Nếu cần thay đổi contract:
cập nhật SPEC/PLAN trước.
xin approval.
Sau implementation phải TEST.
Sau TEST phải REVIEW.
Chỉ đánh dấu feature DONE sau khi REVIEW đạt APPROVE.
73. Definition of Done for API

API feature chỉ được xem là hoàn thành khi:

Endpoint đúng API contract.
Request validation hoạt động.
Response đúng contract.
Authentication đúng.
Authorization đúng.
Ownership check đúng.
Business rules đúng.
Database interaction đúng.
Error handling đúng.
Edge cases được kiểm tra.
Không double XP hoặc double streak.
Không làm hỏng API hiện có.
Tests phù hợp đã PASS.
Documentation được đồng bộ.
REVIEW đạt APPROVE.
74. Final Principle

API của hệ thống phải ưu tiên:

Correctness
    ↓
Security
    ↓
Business Rule Consistency
    ↓
Maintainability
    ↓
Simplicity

Không over-engineer API khi requirement chưa cần.

Không thêm feature chỉ vì technically có thể làm được.

Nếu một quyết định ảnh hưởng đến:

Database.
API contract.
Business rule.
Authorization.
Core learning flow.

thì phải được đưa qua:

SPEC
→ PLAN
→ APPROVAL
→ TASK
→ IMPLEMENT
→ TEST
→ REVIEW

trước khi thay đổi implementation.
