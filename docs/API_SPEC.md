# API SPECIFICATION — English Vocabulary Learning Platform

> Tài liệu đặc tả API chính thức của hệ thống.
> API là contract giữa Frontend và Backend.
> Backend là source of truth đối với business logic, quyền truy cập, dữ liệu và kết quả học tập.

---

# 1. Purpose

`API_SPEC.md` định nghĩa cách Frontend giao tiếp với Backend thông qua REST API.

Tài liệu này mô tả:

- API endpoint
- HTTP method
- Authentication
- Authorization
- Request
- Response
- Error handling
- Business rules liên quan đến API
- Quyền truy cập
- Validation
- Các API thuộc từng domain

API phải phù hợp với:

- `docs/PROJECT_OVERVIEW.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE.md`

Không được tự ý tạo API cho feature chưa được xác định trong phạm vi dự án.

---

# 2. API Architecture

Kiến trúc giao tiếp:

```text
Frontend
React + Vite
      |
      | HTTPS / REST API
      ↓
Backend
Node.js + Express
      |
      | Prisma
      ↓
PostgreSQL / Supabase
```

Frontend:

- Chỉ giao tiếp với Backend thông qua API.
- Không được truy cập trực tiếp Database.
- Không chứa business logic quan trọng.
- Không tự quyết định dữ liệu authoritative từ Backend.

Backend:

- Xác thực người dùng.
- Phân quyền.
- Validation.
- Business logic.
- Database access.
- Tính toán kết quả học tập.
- Tính XP, Level, Streak, Achievement.
- Xử lý Spaced Repetition.
- Kiểm soát ownership của Vocabulary Set.
- Giao tiếp với external services nếu cần.

---

# 3. Base URL

API sử dụng prefix:

```text
/api
```

Ví dụ:

```text
GET /api/vocabulary
POST /api/quiz/submit
GET /api/progress
```

Production Base URL được cấu hình thông qua environment variable.

Frontend không hard-code production URL trong source code.

---

# 4. API Versioning

Versioning chưa được sử dụng trong v1.

Không tự ý chuyển API sang:

```text
/api/v1
```

Nếu sau này cần API versioning, phải có quyết định kiến trúc rõ ràng trước khi thay đổi.

---

# 5. Authentication

Hệ thống có hai role:

```text
USER
ADMIN
```

Authentication mechanism cụ thể có thể được quyết định trong quá trình implementation.

Ví dụ conceptual:

```http
Authorization: Bearer <access_token>
```

Frontend không được tự quyết định quyền truy cập bằng cách chỉ dựa vào UI.

Backend phải kiểm tra authentication đối với các protected endpoints.

---

# 6. Authorization

Backend là nơi enforce authorization.

Các quyền chính:

```text
USER
- Quản lý profile của chính mình
- Học vocabulary
- Làm quiz
- Xem progress của chính mình
- Tạo vocabulary set
- Quản lý vocabulary set của chính mình
- Chia sẻ vocabulary set thông qua Community
- Copy vocabulary set được chia sẻ
- Tạo và quản lý Community Post của chính mình
- Comment Community Post
```

```text
ADMIN
- Có quyền của USER
- Quản lý users
- Quản lý vocabulary
- Quản lý system vocabulary sets
- Quản lý achievements
- Moderation Community
```

Frontend authorization chỉ nhằm mục đích UX.

Backend vẫn phải kiểm tra quyền ở mọi protected endpoint.

---

# 7. Standard Response Format

## 7.1 Success Response

```json
{
  "success": true,
  "data": {}
}
```

---

## 7.2 List Response

```json
{
  "success": true,
  "data": [],
  "meta": {}
}
```

`meta` có thể chứa:

```json
{
  "page": 1,
  "limit": 20,
  "total": 100
}
```

Nếu API không cần pagination thì không bắt buộc phải có `meta`.

---

## 7.3 Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

`details` có thể chứa thông tin validation hoặc dữ liệu bổ sung.

Không trả về:

- Password
- Password hash
- Secret key
- Access token của người khác
- Sensitive internal information
- Stack trace trong production

---

# 8. HTTP Status Codes

API sử dụng các HTTP status code phù hợp:

| Status | Meaning                                           |
| ------ | ------------------------------------------------- |
| `200`  | Request thành công                                |
| `201`  | Resource được tạo thành công                      |
| `204`  | Thành công nhưng không có response body           |
| `400`  | Bad Request                                       |
| `401`  | Chưa authentication / authentication không hợp lệ |
| `403`  | Không có quyền                                    |
| `404`  | Resource không tồn tại                            |
| `409`  | Conflict                                          |
| `422`  | Validation error / business validation            |
| `500`  | Internal Server Error                             |

Không sử dụng status code tùy tiện.

---

# 9. Error Handling

Backend sử dụng centralized error handling.

Flow:

```text
Request
   ↓
Route
   ↓
Middleware
   ↓
Controller
   ↓
Service
   ↓
Error
   ↓
Central Error Handler
   ↓
Standard Error Response
```

Controller không nên tự xử lý mọi loại error một cách riêng lẻ nếu có thể sử dụng centralized error handling.

---

# 10. Validation

Input phải được validate ở Backend.

Có thể validate:

- Required fields
- Data type
- String length
- Email format
- Enum values
- ID format
- Ownership
- Business constraints

Frontend validation chỉ cải thiện UX.

Frontend validation không thay thế Backend validation.

---

# 11. API Domains

API được chia thành các domain:

```text
/api/auth
/api/users
/api/vocabulary
/api/vocabulary-sets
/api/learning
/api/quiz
/api/pronunciation
/api/progress
/api/streak
/api/achievements
/api/community
/api/admin
```

---

# 12. Authentication API

## 12.1 Register

```http
POST /api/auth/register
```

Access:

```text
Public
```

Request:

```json
{
  "email": "user@example.com",
  "password": "password",
  "display_name": "John"
}
```

Backend phải:

1. Validate input.
2. Kiểm tra email đã tồn tại.
3. Hash password.
4. Tạo USER.
5. Không cho client tự truyền `role`.
6. Không cho client tự truyền `total_xp`.
7. Không cho client tự truyền `level`.
8. Không cho client tự truyền `is_active`.

Response:

```http
201 Created
```

Example:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "display_name": "John",
      "role": "USER"
    }
  }
}
```

---

## 12.2 Login

```http
POST /api/auth/login
```

Access:

```text
Public
```

Request:

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

Backend:

- Validate credentials.
- Kiểm tra account status.
- Tạo authentication session/token theo cơ chế được chọn.

Response có thể chứa authentication credential theo implementation.

Không trả password hoặc password hash.

---

## 12.3 Get Current Authentication User

```http
GET /api/auth/me
```

Access:

```text
Authenticated
```

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "display_name": "John",
      "avatar_url": null,
      "role": "USER"
    }
  }
}
```

---

# 13. User API

## 13.1 Get Current User

```http
GET /api/users/me
```

Access:

```text
Authenticated
```

---

## 13.2 Update Current User

```http
PUT /api/users/me
```

Access:

```text
Authenticated
```

User có thể cập nhật:

```text
display_name
avatar_url
```

Không cho phép User thay đổi:

```text
id
email
role
is_active
total_xp
level
password_hash
```

Nếu có password change trong tương lai, phải có API riêng và được scope rõ ràng.

---

## 13.3 Get Gamification Information

```http
GET /api/users/me/gamification
```

Access:

```text
Authenticated
```

Response có thể bao gồm:

```json
{
  "success": true,
  "data": {
    "total_xp": 1200,
    "level": 5
  }
}
```

XP và Level được Backend quản lý.

Client không được gửi request để tự tăng XP hoặc Level.

---

# 14. Vocabulary API

Vocabulary là dữ liệu từ vựng của hệ thống.

Vocabulary structure:

```text
VOCABULARY
├── VOCABULARY_MEANING
│   └── VOCABULARY_EXAMPLE
└── pronunciation information
```

---

## 14.1 Get Vocabulary List

```http
GET /api/vocabulary
```

Access:

```text
Public / Authenticated
```

Có thể hỗ trợ:

```text
?page=1
&limit=20
&search=work
&difficulty_level=A1
```

Response:

```json
{
  "success": true,
  "data": [],
  "meta": {}
}
```

---

## 14.2 Get Vocabulary Detail

```http
GET /api/vocabulary/:id
```

Access:

```text
Public / Authenticated
```

Response có thể bao gồm:

```json
{
  "success": true,
  "data": {
    "id": "vocabulary-id",
    "word": "work",
    "phonetic": "/wɜːrk/",
    "pronunciation_url": "...",
    "difficulty_level": "A1",
    "meanings": [
      {
        "id": "meaning-id",
        "part_of_speech": "verb",
        "meaning_vi": "làm việc",
        "context": "general",
        "examples": [
          {
            "example_en": "I work every day.",
            "example_vi": "Tôi làm việc mỗi ngày."
          }
        ]
      }
    ]
  }
}
```

---

## 14.3 Create Vocabulary

```http
POST /api/vocabulary
```

Access:

```text
ADMIN
```

User không được tự tạo system vocabulary thông qua API này.

---

## 14.4 Update Vocabulary

```http
PUT /api/vocabulary/:id
```

Access:

```text
ADMIN
```

---

## 14.5 Delete Vocabulary

```http
DELETE /api/vocabulary/:id
```

Access:

```text
ADMIN
```

Backend phải kiểm tra các relationship liên quan trước khi xóa.

Không được vô tình xóa learning progress hoặc historical quiz data của user.

---

# 15. Vocabulary Set API

Vocabulary Set là collection của các vocabulary.

Có hai loại chính:

```text
System Set
User Set
```

---

## 15.1 Get Vocabulary Set List

```http
GET /api/vocabulary-sets
```

Access:

```text
Public / Authenticated
```

Có thể trả về:

- Public system sets.
- Các set public theo business rule.
- Thông tin cơ bản của set.

Private set của User khác không được hiển thị.

---

## 15.2 Get My Vocabulary Sets

```http
GET /api/vocabulary-sets/me
```

Access:

```text
Authenticated
```

Trả về các set thuộc quyền sở hữu của current user.

---

## 15.3 Get Vocabulary Set Detail

```http
GET /api/vocabulary-sets/:id
```

Access phụ thuộc visibility/ownership.

Backend phải kiểm tra:

```text
Public set
→ allowed

Own private set
→ allowed

Another user's private set
→ forbidden
```

Admin có thể có quyền quản lý theo policy của hệ thống.

---

## 15.4 Create Vocabulary Set

```http
POST /api/vocabulary-sets
```

Access:

```text
Authenticated
```

Request:

```json
{
  "name": "Daily English",
  "description": "Common words for daily communication"
}
```

User-created set mặc định:

```text
is_public = false
```

Client không được tự ý tạo:

```json
{
  "is_public": true
}
```

để biến private set thành public.

Backend phải kiểm soát ownership và visibility.

---

## 15.5 Update Vocabulary Set

```http
PUT /api/vocabulary-sets/:id
```

Access:

```text
Owner / ADMIN theo policy
```

User chỉ được sửa set của chính mình.

Không được sửa private set của User khác.

---

## 15.6 Delete Vocabulary Set

```http
DELETE /api/vocabulary-sets/:id
```

Access:

```text
Owner / ADMIN theo policy
```

Khi xóa set:

- Có thể xóa các `VOCABULARY_SET_ITEM` liên quan.
- Không được xóa `VOCABULARY`.
- Không được vô tình xóa `LEARNING_PROGRESS`.

---

# 16. Vocabulary Set Items API

## 16.1 Add Vocabulary to Set

```http
POST /api/vocabulary-sets/:id/items
```

Access:

```text
Owner / ADMIN theo policy
```

Request:

```json
{
  "vocabulary_id": "vocabulary-id"
}
```

Backend phải kiểm tra:

- Set tồn tại.
- User có quyền chỉnh sửa set.
- Vocabulary tồn tại.
- Vocabulary chưa tồn tại trong set.

Database đảm bảo unique:

```text
(vocabulary_set_id, vocabulary_id)
```

---

## 16.2 Remove Vocabulary from Set

```http
DELETE /api/vocabulary-sets/:id/items/:vocabularyId
```

Access:

```text
Owner / ADMIN theo policy
```

Chỉ xóa relationship trong `VOCABULARY_SET_ITEM`.

Không xóa Vocabulary.

---

# 17. Copy Vocabulary Set API

## 17.1 Copy Vocabulary Set

```http
POST /api/vocabulary-sets/:id/copy
```

Access:

```text
Authenticated
```

Flow:

```text
User A's shared set
        ↓
User B clicks Copy
        ↓
Create NEW VOCABULARY_SET
        ↓
owner_id = User B
        ↓
is_public = false
        ↓
Copy VOCABULARY_SET_ITEM
```

Backend phải sử dụng transaction.

Copying không:

- Chuyển ownership.
- Cho User B quyền sửa original set.
- Thay đổi original set.
- Làm original set thành public.

---

# 18. Learning API

Learning API xử lý learning session và learning result.

---

## 18.1 Get Learning Session

```http
GET /api/learning/session
```

Access:

```text
Authenticated
```

Backend có thể sử dụng:

- User progress.
- `next_review_at`.
- Vocabulary availability.
- Spaced Repetition rules.

Mục đích là trả về vocabulary phù hợp cho phiên học.

---

## 18.2 Submit Learning Review

```http
POST /api/learning/review
```

Access:

```text
Authenticated
```

Request concept:

```json
{
  "vocabulary_id": "vocabulary-id",
  "result": "correct"
}
```

Backend có thể cập nhật:

```text
LEARNING_PROGRESS
        ↓
Spaced Repetition
        ↓
next_review_at
interval_days
ease_factor
        ↓
XP
        ↓
Streak
        ↓
Achievement
```

Business logic không được để Frontend tự tính authoritative result.

---

# 19. Quiz API

Hệ thống chỉ có **2 loại Quiz**:

```text
VI_TO_ENGLISH
MISSING_LETTER
```

Không tự ý thêm quiz type thứ ba.

Pronunciation không phải quiz type.

---

# 20. Get Quiz Question

```http
GET /api/quiz/question
```

Access:

```text
Authenticated
```

Backend có thể chọn vocabulary dựa trên:

- Learning progress.
- Spaced repetition.
- Quiz type.
- Difficulty.
- Learning session.

Response ví dụ:

```json
{
  "success": true,
  "data": {
    "vocabulary_id": "vocabulary-id",
    "quiz_type": "VI_TO_ENGLISH",
    "question": {
      "meaning_vi": "làm việc"
    }
  }
}
```

Backend không nên gửi `correct_answer` trong question response nếu điều đó làm lộ đáp án.

---

# 21. Submit Quiz

```http
POST /api/quiz/submit
```

Access:

```text
Authenticated
```

Request:

```json
{
  "vocabulary_id": "vocabulary-id",
  "quiz_type": "VI_TO_ENGLISH",
  "user_answer": "work",
  "response_time_ms": 3200
}
```

Backend chịu trách nhiệm:

1. Validate request.
2. Validate vocabulary.
3. Validate quiz type.
4. Xác định correct answer.
5. Kiểm tra user answer.
6. Tính correctness.
7. Tính score.
8. Tạo per-character feedback nếu cần.
9. Lưu `QUIZ_ATTEMPT`.
10. Update `LEARNING_PROGRESS`.
11. Tính Spaced Repetition.
12. Update XP.
13. Update Streak.
14. Kiểm tra Achievement.
15. Trả kết quả.

Client không được gửi:

```text
correct_answer
is_correct
score
xp_earned
level
streak
```

để Backend tin tưởng trực tiếp.

---

# 22. Quiz Type: Vietnamese → English

Enum:

```text
VI_TO_ENGLISH
```

Question:

```text
Công việc → ______
```

Expected answer:

```text
work
```

User phải nhập đáp án đầy đủ.

Backend xác định đáp án đúng dựa trên Vocabulary/Meaning data hoặc business rule đã được định nghĩa.

---

# 23. Quiz Type: Missing Letter

Enum:

```text
MISSING_LETTER
```

Ví dụ:

```text
w_rk
```

Expected:

```text
work
```

Backend kiểm tra đáp án dựa trên vocabulary word.

---

# 24. Per-character Feedback

Đối với các quiz dạng typing:

```text
VI_TO_ENGLISH
MISSING_LETTER
```

Backend có thể trả feedback theo từng character.

Ví dụ conceptual:

```json
{
  "feedback": [
    {
      "position": 0,
      "expected": "w",
      "actual": "w",
      "status": "correct"
    },
    {
      "position": 1,
      "expected": "o",
      "actual": "e",
      "status": "incorrect"
    }
  ]
}
```

Frontend dùng dữ liệu này để hiển thị:

```text
Correct → green
Incorrect → red
```

Feedback này được tính runtime.

Không tạo database table riêng cho từng character feedback.

---

# 25. Quiz Result Response

Ví dụ:

```json
{
  "success": true,
  "data": {
    "is_correct": false,
    "score": 70,
    "correct_answer": "dessert",
    "feedback": [
      {
        "position": 0,
        "expected": "d",
        "actual": "d",
        "status": "correct"
      },
      {
        "position": 1,
        "expected": "e",
        "actual": "e",
        "status": "correct"
      }
    ],
    "xp_earned": 5,
    "learning_progress": {},
    "streak": {},
    "achievement_updates": []
  }
}
```

Response thực tế có thể được tinh chỉnh trong implementation nhưng phải giữ nguyên nguyên tắc:

```text
Backend = source of truth
```

---

# 26. Pronunciation API

Pronunciation là một learning module riêng.

Không coi pronunciation là Quiz Type.

Flow:

```text
Vocabulary
    ↓
Model Pronunciation
    ↓
User listens
    ↓
User speaks
    ↓
Speech Recognition / Pronunciation Evaluation
    ↓
Pronunciation Result
```

---

## 26.1 Get Pronunciation Information

```http
GET /api/pronunciation/:vocabularyId
```

Access:

```text
Public / Authenticated
```

Response:

```json
{
  "success": true,
  "data": {
    "vocabulary_id": "vocabulary-id",
    "phonetic": "/wɜːrk/",
    "pronunciation_url": "..."
  }
}
```

---

## 26.2 Evaluate Pronunciation

```http
POST /api/pronunciation/evaluate
```

Access:

```text
Authenticated
```

Mục đích:

- Nhận pronunciation input của User.
- Gửi tới external pronunciation/speech service nếu được sử dụng.
- Nhận evaluation result.
- Trả kết quả cho Frontend.

Pronunciation evaluation là optional dependency.

Nếu external service chưa được tích hợp thì endpoint có thể chưa được triển khai.

V1 không lưu pronunciation attempt thành database entity.

---

# 27. Progress API

## 27.1 Get Learning Progress

```http
GET /api/progress
```

Access:

```text
Authenticated
```

Chỉ trả progress của current user.

Không cho User truy cập progress của User khác.

---

## 27.2 Get Vocabulary Progress

```http
GET /api/progress/:vocabularyId
```

Access:

```text
Authenticated
```

Trả progress của current user đối với vocabulary tương ứng.

---

## 27.3 Get Progress Summary

```http
GET /api/progress/summary
```

Access:

```text
Authenticated
```

Có thể trả:

```text
Total vocabulary learned
Reviewed vocabulary
Mastered vocabulary
Quiz accuracy
Learning statistics
```

Exact calculation có thể được xác định trong implementation.

---

# 28. Streak API

## 28.1 Get Current Streak

```http
GET /api/streak
```

Access:

```text
Authenticated
```

Response:

```json
{
  "success": true,
  "data": {
    "current_streak": 5,
    "longest_streak": 12,
    "last_activity_date": "2026-09-14"
  }
}
```

Streak được cập nhật bởi Backend.

Client không được gửi:

```text
current_streak
longest_streak
last_activity_date
```

để tự thay đổi dữ liệu.

---

# 29. Achievement API

## 29.1 Get All Achievements

```http
GET /api/achievements
```

Access:

```text
Authenticated
```

Có thể public tùy implementation.

---

## 29.2 Get My Achievements

```http
GET /api/achievements/me
```

Access:

```text
Authenticated
```

Trả về achievements của current user.

---

# 30. Community API

Community v1 bao gồm:

```text
Posts
Comments
Vocabulary Set Sharing
```

Không bao gồm:

```text
Likes
Reactions
Followers
Friends
Direct Messages
Chat
Leaderboard
```

---

# 31. Get Community Posts

```http
GET /api/community/posts
```

Access:

```text
Public / Authenticated
```

Có thể hỗ trợ:

```text
?page=1
&limit=20
```

---

# 32. Get Community Post Detail

```http
GET /api/community/posts/:id
```

Access:

```text
Public / Authenticated
```

Có thể trả:

```text
Post
Author information
Shared vocabulary set information nếu có
Comments
```

---

# 33. Create Community Post

```http
POST /api/community/posts
```

Access:

```text
Authenticated
```

Request:

```json
{
  "title": "Useful words for travel",
  "content": "Here are some words I learned.",
  "vocabulary_set_id": "set-id"
}
```

`vocabulary_set_id` là optional.

Nếu không có:

```text
Normal community post
```

Nếu có:

```text
Vocabulary Set sharing post
```

Backend phải kiểm tra User có ownership hợp lệ đối với vocabulary set được chia sẻ.

User không được dùng API để chia sẻ private set của người khác.

---

# 34. Update Community Post

```http
PUT /api/community/posts/:id
```

Access:

```text
Post Owner / ADMIN
```

User không được chỉnh sửa post của User khác.

---

# 35. Delete Community Post

```http
DELETE /api/community/posts/:id
```

Access:

```text
Post Owner / ADMIN
```

---

# 36. Create Community Comment

```http
POST /api/community/posts/:id/comments
```

Access:

```text
Authenticated
```

Request:

```json
{
  "content": "This set is useful!"
}
```

Comment được tạo dưới Community Post tương ứng.

---

# 37. Update Community Comment

```http
PUT /api/community/comments/:id
```

Access:

```text
Comment Owner / ADMIN
```

---

# 38. Delete Community Comment

```http
DELETE /api/community/comments/:id
```

Access:

```text
Comment Owner / ADMIN
```

---

# 39. Admin API

Admin API được bảo vệ bởi:

```text
Authentication
+
ADMIN authorization
```

USER không được truy cập các endpoint Admin.

---

# 40. Admin User Management

## 40.1 Get Users

```http
GET /api/admin/users
```

Access:

```text
ADMIN
```

Có thể hỗ trợ:

```text
?page=1
&limit=20
&search=
&status=
```

---

## 40.2 Get User Detail

```http
GET /api/admin/users/:id
```

Access:

```text
ADMIN
```

Có thể bao gồm:

- Basic user information
- Account status
- Learning statistics
- Gamification information

Không trả password hash hoặc sensitive credentials.

---

## 40.3 Update User Status

```http
PATCH /api/admin/users/:id/status
```

Access:

```text
ADMIN
```

Request:

```json
{
  "is_active": false
}
```

Mục đích:

```text
Activate
Deactivate
```

Admin không được thông qua endpoint này để tự ý thay đổi:

```text
total_xp
level
password_hash
```

---

# 41. Admin Vocabulary Set API

## 41.1 Create System Vocabulary Set

```http
POST /api/admin/vocabulary-sets
```

Access:

```text
ADMIN
```

System set phải:

```text
is_public = true
```

và được xem là set do Admin quản lý.

---

## 41.2 Update System Vocabulary Set

```http
PUT /api/admin/vocabulary-sets/:id
```

Access:

```text
ADMIN
```

---

## 41.3 Delete System Vocabulary Set

```http
DELETE /api/admin/vocabulary-sets/:id
```

Access:

```text
ADMIN
```

---

# 42. Admin Achievement API

## 42.1 Get Achievements

```http
GET /api/admin/achievements
```

Access:

```text
ADMIN
```

---

## 42.2 Create Achievement

```http
POST /api/admin/achievements
```

Access:

```text
ADMIN
```

Request concept:

```json
{
  "name": "First Step",
  "description": "Complete your first learning activity.",
  "icon_url": "...",
  "condition_type": "LEARNING_COUNT",
  "condition_value": 1
}
```

---

## 42.3 Update Achievement

```http
PUT /api/admin/achievements/:id
```

Access:

```text
ADMIN
```

---

## 42.4 Delete Achievement

```http
DELETE /api/admin/achievements/:id
```

Access:

```text
ADMIN
```

---

# 43. Admin Community Moderation

## 43.1 Delete Community Post

```http
DELETE /api/admin/community/posts/:id
```

Access:

```text
ADMIN
```

Admin có thể xóa Community Post vi phạm quy định hệ thống.

---

## 43.2 Delete Community Comment

```http
DELETE /api/admin/community/comments/:id
```

Access:

```text
ADMIN
```

Admin có thể xóa comment vi phạm quy định hệ thống.

---

# 44. API Permission Matrix

| Domain                           | USER | ADMIN |
| -------------------------------- | ---: | ----: |
| Register/Login                   |    ✓ |     ✓ |
| Own Profile                      |    ✓ |     ✓ |
| Vocabulary Read                  |    ✓ |     ✓ |
| Vocabulary Create/Update/Delete  |    ✗ |     ✓ |
| Own Vocabulary Set               |    ✓ |     ✓ |
| Other Private Set                |    ✗ |   ✓\* |
| System Set                       |    ✓ |     ✓ |
| Copy Shared Set                  |    ✓ |     ✓ |
| Learning                         |    ✓ |     ✓ |
| Quiz                             |    ✓ |     ✓ |
| Pronunciation                    |    ✓ |     ✓ |
| Own Progress                     |    ✓ |     ✓ |
| Other User Progress              |    ✗ |   ✓\* |
| Streak                           |    ✓ |     ✓ |
| Achievement                      |    ✓ |     ✓ |
| Community Post                   |    ✓ |     ✓ |
| Community Comment                |    ✓ |     ✓ |
| User Management                  |    ✗ |     ✓ |
| System Vocabulary Set Management |    ✗ |     ✓ |
| Achievement Management           |    ✗ |     ✓ |
| Community Moderation             |    ✗ |     ✓ |

`*` Admin access depends on the management policy of the corresponding feature.

---

# 45. Backend Source of Truth

Backend là source of truth cho các dữ liệu sau:

```text
correct_answer
is_correct
score
XP
Level
Streak
Achievement
Learning Progress
Spaced Repetition
Ownership
Visibility
Authorization
```

Frontend không được tự quyết định authoritative values.

Ví dụ không được làm:

```text
User submits quiz
↓
Frontend tự tính XP = 100
↓
Frontend gửi XP = 100
↓
Backend lưu trực tiếp
```

Thay vào đó:

```text
User submits answer
↓
Backend validates
↓
Backend calculates result
↓
Backend calculates XP
↓
Backend updates database
↓
Backend returns result
```

---

# 46. Ownership Rules

Backend phải enforce ownership.

Ví dụ:

```text
User A
└── Set A
```

User B không thể:

```http
PUT /api/vocabulary-sets/set-a
```

để sửa Set A.

Backend phải trả:

```http
403 Forbidden
```

hoặc status phù hợp theo implementation.

Ownership không được kiểm tra chỉ ở Frontend.

---

# 47. Vocabulary Set Visibility Rules

Rules:

```text
Admin-created System Set
→ Public

User-created Set
→ Private by default
```

User không được trực tiếp chuyển:

```text
Private → Public
```

thông qua `PUT /api/vocabulary-sets/:id`.

Muốn chia sẻ:

```text
Private Vocabulary Set
        ↓
Community Post
        ↓
Other User
        ↓
Copy
        ↓
New Private Vocabulary Set
```

Community sharing không làm thay đổi `is_public` của original set.

---

# 48. Transaction Requirements

Các operation có nhiều bước database phải sử dụng transaction khi cần.

Ví dụ:

```text
Copy Vocabulary Set
```

Flow:

```text
BEGIN TRANSACTION

Create new set
        ↓
Copy set items
        ↓
COMMIT
```

Nếu một bước thất bại:

```text
ROLLBACK
```

Không để database rơi vào trạng thái copy không hoàn chỉnh.

---

# 49. External Services

External services có thể được sử dụng cho:

```text
Pronunciation Audio
Speech Recognition
Pronunciation Evaluation
AI-assisted Learning
```

External service phải được gọi từ Backend.

Frontend không được chứa secret key của external service.

Ví dụ:

```text
Frontend
   ↓
Backend
   ↓
External Service
```

Không:

```text
Frontend
   ↓
External Service
   ↓
Secret API Key exposed
```

AI là optional.

AI không được trở thành dependency bắt buộc của hệ thống nếu chưa có quyết định thay đổi scope.

---

# 50. API Security Principles

Backend phải:

- Validate mọi input.
- Hash password.
- Protect authenticated endpoints.
- Enforce role authorization.
- Enforce ownership.
- Không expose secrets.
- Không trả password hash.
- Không trust client-side authorization.
- Không trust client-provided XP.
- Không trust client-provided correct answer.
- Không trust client-provided score.
- Không log sensitive information.
- Sử dụng HTTPS trong production.
- Sử dụng environment variables cho secrets.

---

# 51. Pagination

Các API trả danh sách lớn nên hỗ trợ pagination.

Ví dụ:

```http
GET /api/vocabulary?page=1&limit=20
```

Response:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

Exact pagination strategy có thể được quyết định trong implementation.

Không cần ép pagination cho endpoint có dữ liệu nhỏ.

---

# 52. Filtering and Search

Các list API có thể hỗ trợ filtering/search khi cần.

Ví dụ:

```text
Vocabulary
- search
- difficulty_level

Community
- page
- limit

Admin Users
- search
- status
```

Không thêm filter chỉ để làm API phức tạp hơn nếu UI/business requirement không cần.

---

# 53. API Naming Rules

Endpoint sử dụng:

- Noun-based resource names.
- HTTP method để biểu diễn action cơ bản.
- kebab-case cho multi-word resources.

Ví dụ:

```text
/api/vocabulary
/api/vocabulary-sets
/api/community/posts
/api/community/comments
```

Tránh:

```text
/api/getVocabulary
/api/createVocabulary
/api/deleteVocabulary
```

---

# 54. HTTP Method Rules

Sử dụng:

```text
GET
```

cho read.

```text
POST
```

cho create hoặc command/action cần xử lý.

```text
PUT
```

cho update resource.

```text
PATCH
```

cho partial update.

```text
DELETE
```

cho delete.

Ví dụ:

```text
POST /api/quiz/submit
POST /api/vocabulary-sets/:id/copy
```

là action endpoints hợp lệ vì chúng thực hiện business operation.

---

# 55. API and Database Relationship

API không được phá vỡ database rules.

Ví dụ:

```text
API
POST /api/vocabulary-sets/:id/items
```

phải tuân thủ:

```text
VOCABULARY_SET_ITEM
UNIQUE(vocabulary_set_id, vocabulary_id)
```

API:

```text
POST /api/quiz/submit
```

phải tạo dữ liệu phù hợp với:

```text
QUIZ_ATTEMPT
```

API:

```text
POST /api/learning/review
```

phải cập nhật:

```text
LEARNING_PROGRESS
```

theo business rules.

---

# 56. API and Architecture Relationship

API flow:

```text
Request
   ↓
Route
   ↓
Middleware
   ↓
Controller
   ↓
Service
   ↓
Repository / Data Access
   ↓
Prisma
   ↓
PostgreSQL
```

Không được:

```text
Route
  ↓
Huge Business Logic
```

Không được:

```text
Controller
  ↓
Complex Prisma Queries + Business Logic
```

Không được:

```text
Frontend
  ↓
PostgreSQL
```

Business logic nên nằm trong Service Layer.

---

# 57. Business Logic Examples

## Quiz

```text
POST /api/quiz/submit
        ↓
QuizController
        ↓
QuizService
        ↓
Check Answer
        ↓
Calculate Score
        ↓
Save Quiz Attempt
        ↓
Update Learning Progress
        ↓
Spaced Repetition
        ↓
XP
        ↓
Streak
        ↓
Achievement
        ↓
Response
```

---

## Learning Review

```text
POST /api/learning/review
        ↓
LearningController
        ↓
LearningService
        ↓
Update Progress
        ↓
Spaced Repetition
        ↓
XP
        ↓
Streak
        ↓
Achievement
```

---

## Vocabulary Set Copy

```text
POST /api/vocabulary-sets/:id/copy
        ↓
VocabularySetController
        ↓
VocabularySetService
        ↓
Check Permission
        ↓
Transaction
        ↓
Create New Set
        ↓
Copy Items
        ↓
Commit
```

---

# 58. Testing Requirements

API cần được test đối với các business-critical flows.

Tối thiểu nên test:

## Authentication

- Register
- Duplicate email
- Login success
- Login failure
- Protected endpoint

## Authorization

- USER accessing ADMIN endpoint
- Ownership violation
- Unauthorized resource access

## Vocabulary

- Get vocabulary
- Get vocabulary detail
- Admin create/update/delete

## Vocabulary Set

- Create private set
- Update own set
- Cannot edit another user's set
- Add item
- Remove item
- Copy set
- Copy creates independent private set

## Learning

- Submit review
- Progress update
- Spaced repetition update

## Quiz

- Correct answer
- Incorrect answer
- Invalid quiz type
- Score calculation
- Per-character feedback
- Quiz attempt persistence

## Gamification

- XP
- Level
- Streak
- Achievement

## Community

- Create post
- Edit own post
- Cannot edit another user's post
- Comment
- Admin moderation
- Vocabulary set sharing

---

# 59. OpenAPI / Swagger

Có thể sử dụng OpenAPI/Swagger để document API.

Ví dụ:

```text
/api-docs
```

Tuy nhiên việc sử dụng Swagger UI không phải business requirement.

Nếu triển khai:

- Specification phải đồng bộ với API thực tế.
- Không tạo documentation sai với implementation.
- API_SPEC.md vẫn là project-level contract.

---

# 60. Environment Configuration

API URL phải được cấu hình thông qua environment variables.

Frontend:

```text
VITE_API_URL
```

Backend:

```text
DATABASE_URL
```

và các external service keys nếu cần.

Không commit:

```text
.env
```

chứa secret thật lên GitHub.

Nên có:

```text
.env.example
```

---

# 61. API Logging

Backend có thể log:

- Request method
- Endpoint
- Status code
- Response time
- Error code

Không log:

- Password
- Password hash
- Access token
- External API secret
- Sensitive user information

---

# 62. Rate Limiting

Rate limiting có thể được áp dụng cho các endpoint nhạy cảm như:

```text
Login
Register
Quiz submit
Pronunciation evaluation
```

Chỉ triển khai khi cần thiết.

Không thêm infrastructure phức tạp nếu không cần cho v1.

---

# 63. API Performance

API nên:

- Query database hiệu quả.
- Sử dụng pagination khi cần.
- Tránh N+1 queries.
- Chỉ select dữ liệu cần thiết.
- Sử dụng indexes phù hợp với `DATABASE.md`.
- Không thực hiện external API calls không cần thiết.

Performance optimization không được làm thay đổi business behavior.

---

# 64. API Out of Scope

Các API sau không thuộc phạm vi v1:

```text
Likes
Reactions
Followers
Friends
Direct Messages
Chat
Leaderboard
Payment
Subscription
Premium tiers
XP transaction history
Learning history
Pronunciation attempt history
Download history
Third quiz type
Mandatory AI
```

Không tự ý tạo endpoint cho các feature trên.

---

# 65. Architecture Change Rules

Không tự ý thay đổi:

- Authentication architecture.
- API architecture.
- Database architecture.
- Role model.
- Vocabulary Set ownership rules.
- Vocabulary Set visibility rules.
- Quiz types.
- Pronunciation architecture.
- AI dependency.
- Deployment architecture.

Nếu implementation phát sinh vấn đề:

```text
Identify problem
        ↓
Explain impact
        ↓
Propose solution
        ↓
Explain trade-offs
        ↓
Wait for approval if architectural change is required
        ↓
Update documentation
        ↓
Implement
```

---

# 66. Source of Truth

Khi làm việc với API, AI Agent phải tham khảo:

```text
PROJECT_OVERVIEW.md
        ↓
ARCHITECTURE.md
        ↓
DATABASE.md
        ↓
API_SPEC.md
```

Trong đó:

```text
PROJECT_OVERVIEW.md
→ Business scope

ARCHITECTURE.md
→ System architecture

DATABASE.md
→ Data model

API_SPEC.md
→ Frontend ↔ Backend contract
```

Nếu phát hiện conflict:

```text
Không tự đoán.
Không tự sửa.
Không âm thầm thay đổi.
```

AI Agent phải thông báo conflict và đề xuất cách xử lý.

---

# 67. Final Principles

API của hệ thống phải tuân theo:

```text
Simple
    ↓
Clear
    ↓
Consistent
    ↓
Secure
    ↓
Testable
    ↓
Maintainable
```

Các nguyên tắc quan trọng:

1. Backend là source of truth.
2. Frontend không truy cập Database trực tiếp.
3. Business logic nằm ở Backend Service Layer.
4. Authorization phải được enforce ở Backend.
5. Ownership phải được kiểm tra ở Backend.
6. Client không được tự quyết định XP, Level, Streak, Score hoặc Correct Answer.
7. Chỉ có 2 quiz types.
8. Pronunciation là module riêng.
9. Vocabulary Set copy phải tạo resource mới.
10. AI là optional.
11. Không tạo API cho feature ngoài scope.
12. Không over-engineer API.
13. API phải đồng bộ với Database và Architecture.
14. Mọi thay đổi lớn phải được xem xét và cập nhật documentation.
15. Ưu tiên:

```text
Simple → Clear → Maintainable → Testable → Scalable when necessary
```
