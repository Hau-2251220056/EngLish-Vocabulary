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
- `docs/UI_UX_SPEC.md`

`docs/FEATURE_STATUS.md` được sử dụng để kiểm tra trạng thái triển khai của feature.

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

Frontend:

Chỉ giao tiếp với Backend thông qua API.
Không được truy cập trực tiếp Database.
Không chứa business logic quan trọng.
Không tự quyết định dữ liệu authoritative từ Backend.

Backend:

Xác thực người dùng.
Phân quyền.
Validation.
Business logic.
Database access.
Tính toán kết quả học tập.
Tính XP, Level, Streak, Achievement.
Xử lý Spaced Repetition.
Kiểm soát ownership của Vocabulary Set.
Giao tiếp với external services nếu cần.
3. Base URL

API sử dụng prefix:

/api

Ví dụ:

GET /api/vocabulary
POST /api/quiz/submit
GET /api/progress

Production Base URL được cấu hình thông qua environment variable.

Frontend không hard-code production URL trong source code.

4. API Versioning

Versioning chưa được sử dụng trong v1.

Không tự ý chuyển API sang:

/api/v1

Nếu sau này cần API versioning, phải có quyết định kiến trúc rõ ràng trước khi thay đổi.

5. Authentication

Hệ thống có hai role:

USER

ADMIN

Authentication mechanism cụ thể có thể được quyết định trong quá trình implementation.

Ví dụ conceptual:

Authorization: Bearer <access_token>

Frontend không được tự quyết định quyền truy cập bằng cách chỉ dựa vào UI.

Backend phải kiểm tra authentication đối với các protected endpoints.

6. Authorization

Backend là nơi enforce authorization.

Các quyền chính:

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
ADMIN

- Có quyền của USER
- Quản lý users
- Quản lý vocabulary
- Quản lý system vocabulary sets
- Quản lý achievements
- Moderation Community

Frontend authorization chỉ nhằm mục đích UX.

Backend vẫn phải kiểm tra quyền ở mọi protected endpoint.

7. Standard Response Format
7.1 Success Response
{
  "success": true,
  "data": {}
}
7.2 List Response
{
  "success": true,
  "data": [],
  "meta": {}
}

meta có thể chứa:

{
  "page": 1,
  "limit": 20,
  "total": 100
}

Nếu API không cần pagination thì không bắt buộc phải có meta.

7.3 Error Response
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}

details có thể chứa thông tin validation hoặc dữ liệu bổ sung.

Không trả về:

Password
Password hash
Secret key
Access token của người khác
Sensitive internal information
Stack trace trong production
8. HTTP Status Codes

API sử dụng các HTTP status code phù hợp:

Status	Meaning
200	Request thành công
201	Resource được tạo thành công
204	Thành công nhưng không có response body
400	Bad Request
401	Chưa authentication / authentication không hợp lệ
403	Không có quyền
404	Resource không tồn tại
409	Conflict
422	Validation error / business validation
500	Internal Server Error

Không sử dụng status code tùy tiện.

9. Error Handling

Backend sử dụng centralized error handling.

Flow:

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

Controller không nên tự xử lý mọi loại error một cách riêng lẻ nếu có thể sử dụng centralized error handling.

10. Validation

Input phải được validate ở Backend.

Có thể validate:

Required fields
Data type
String length
Email format
Enum values
ID format
Ownership
Business constraints

Frontend validation chỉ cải thiện UX.

Frontend validation không thay thế Backend validation.

11. API Domains

API được chia thành các domain:

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
12. Authentication API
12.1 Register
POST /api/auth/register

Access:

Public

Request:

{
  "email": "user@example.com",
  "password": "password",
  "display_name": "John"
}

Backend phải:

Validate input.
Kiểm tra email đã tồn tại.
Hash password.
Tạo USER.
Không cho client tự truyền role.
Không cho client tự truyền total_xp.
Không cho client tự truyền level.
Không cho client tự truyền is_active.

Response:

201 Created

Example:

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
12.2 Login
POST /api/auth/login

Access:

Public

Request:

{
  "email": "user@example.com",
  "password": "password"
}

Backend:

Validate credentials.
Kiểm tra account status.
Tạo authentication session/token theo cơ chế được chọn.

Response có thể chứa authentication credential theo implementation.

Không trả password hoặc password hash.

12.3 Get Current Authentication User
GET /api/auth/me

Access:

Authenticated

Response:

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
13. User API
13.1 Get Current User
GET /api/users/me

Access:

Authenticated
13.2 Update Current User
PUT /api/users/me

Access:

Authenticated

User có thể cập nhật:

display_name

avatar_url

Không cho phép User thay đổi:

id

email

role

is_active

total_xp

level

password_hash

Nếu có password change trong tương lai, phải có API riêng và được scope rõ ràng.

13.3 Get Gamification Information
GET /api/users/me/gamification

Access:

Authenticated

Response có thể bao gồm:

{
  "success": true,
  "data": {
    "total_xp": 1200,
    "level": 5
  }
}

XP và Level được Backend quản lý.

Client không được gửi request để tự tăng XP hoặc Level.

14. Vocabulary API

Vocabulary là dữ liệu từ vựng của hệ thống.

Vocabulary structure:

VOCABULARY

├── VOCABULARY_MEANING
│   └── VOCABULARY_EXAMPLE
│
└── pronunciation information
14.1 Get Vocabulary List
GET /api/vocabulary

Access:

Public / Authenticated

Có thể hỗ trợ:

?page=1
&limit=20
&search=work
&difficulty_level=A1

Response:

{
  "success": true,
  "data": [],
  "meta": {}
}
14.2 Get Vocabulary Detail
GET /api/vocabulary/:id

Access:

Public / Authenticated

Response có thể bao gồm:

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
14.3 Create Vocabulary
POST /api/vocabulary

Access:

ADMIN

User không được tự tạo system vocabulary thông qua API này.

14.4 Update Vocabulary
PUT /api/vocabulary/:id

Access:

ADMIN
14.5 Delete Vocabulary
DELETE /api/vocabulary/:id

Access:

ADMIN

Backend phải kiểm tra các relationship liên quan trước khi xóa.

Không được vô tình xóa learning progress hoặc historical quiz data của User.

15. Vocabulary Set API

Vocabulary Set là collection của các vocabulary.

Có hai loại chính:

System Set

User Set
15.1 Get Vocabulary Set List
GET /api/vocabulary-sets

Access:

Public / Authenticated

Có thể trả về:

Public system sets.
Các set public theo business rule.
Thông tin cơ bản của set.

Private set của User khác không được hiển thị.

15.2 Get My Vocabulary Sets
GET /api/vocabulary-sets/me

Access:

Authenticated

Trả về các set thuộc quyền sở hữu của current user.

15.3 Get Vocabulary Set Detail
GET /api/vocabulary-sets/:id

Access phụ thuộc visibility/ownership.

Backend phải kiểm tra:

Public set
→ allowed

Own private set
→ allowed

Another user's private set
→ forbidden

Admin có thể có quyền quản lý theo policy của hệ thống.

15.4 Create Vocabulary Set
POST /api/vocabulary-sets

Access:

Authenticated

Request:

{
  "name": "Daily English",
  "description": "Common words for daily communication"
}

User-created set mặc định:

is_public = false

Client không được tự ý tạo:

{
  "is_public": true
}

để biến private set thành public.

Backend phải kiểm soát ownership và visibility.

15.5 Update Vocabulary Set
PUT /api/vocabulary-sets/:id

Access:

Owner / ADMIN theo policy

User chỉ được sửa set của chính mình.

Không được sửa private set của User khác.

15.6 Delete Vocabulary Set
DELETE /api/vocabulary-sets/:id

Access:

Owner / ADMIN theo policy

Khi xóa set:

Có thể xóa các VOCABULARY_SET_ITEM liên quan.
Không được xóa VOCABULARY.
Không được vô tình xóa LEARNING_PROGRESS.
16. Vocabulary Set Items API
16.1 Add Vocabulary to Set
POST /api/vocabulary-sets/:id/items

Access:

Owner / ADMIN theo policy

Request:

{
  "vocabulary_id": "vocabulary-id"
}

Backend phải kiểm tra:

Set tồn tại.
User có quyền chỉnh sửa set.
Vocabulary tồn tại.
Vocabulary chưa tồn tại trong set.

Database đảm bảo unique:

(vocabulary_set_id, vocabulary_id)
16.2 Remove Vocabulary from Set
DELETE /api/vocabulary-sets/:id/items/:vocabularyId

Access:

Owner / ADMIN theo policy

Chỉ xóa relationship trong VOCABULARY_SET_ITEM.

Không xóa Vocabulary.

17. Copy Vocabulary Set API
17.1 Copy Vocabulary Set
POST /api/vocabulary-sets/:id/copy

Access:

Authenticated

Flow:

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

Backend phải sử dụng transaction.

Copying không:

Chuyển ownership.
Cho User B quyền sửa original set.
Thay đổi original set.
Làm original set thành public.
18. Learning API

Learning API xử lý learning activity và learning result.

18.1 Get Learning Session
GET /api/learning/session

Access:

Authenticated

Backend có thể sử dụng:

User progress.
next_review_at.
Vocabulary availability.
Spaced Repetition rules.

Mục đích là trả về vocabulary phù hợp cho phiên học.

18.2 Submit Learning Review
POST /api/learning/review

Access:

Authenticated

Learning Review được sử dụng cho các learning activity không phải Quiz, ví dụ hoàn thành Flashcard hoặc hoạt động học vocabulary khác được hệ thống xác định.

Request concept:

{
  "vocabulary_id": "vocabulary-id",
  "result": "correct"
}

Backend có thể cập nhật:

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

Business logic phải đảm bảo một learning activity không bị ghi nhận nhiều lần ngoài business rule đã định nghĩa.

Quiz result được xử lý thông qua:

POST /api/quiz/submit

và không yêu cầu Frontend gọi thêm /api/learning/review cho cùng một Quiz attempt.

19. Quiz API

Hệ thống chỉ có 2 loại Quiz:

VI_TO_ENGLISH

MISSING_LETTER

Không tự ý thêm quiz type thứ ba.

Pronunciation không phải quiz type.

20. Get Quiz Question
GET /api/quiz/question

Access:

Authenticated

Backend có thể chọn vocabulary dựa trên:

Learning progress.
Spaced repetition.
Quiz type.
Difficulty.
Learning session.

Response ví dụ:

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

Backend không nên gửi correct_answer trong question response nếu điều đó làm lộ đáp án.

Backend có quyền lựa chọn quiz type dựa trên learning session và business rules.

Nếu sau này UI cần yêu cầu một quiz type cụ thể, query parameter có thể được bổ sung thông qua SPEC/PLAN.

21. Submit Quiz
POST /api/quiz/submit

Access:

Authenticated

Request:

{
  "vocabulary_id": "vocabulary-id",
  "quiz_type": "VI_TO_ENGLISH",
  "user_answer": "work",
  "response_time_ms": 3200
}

Backend chịu trách nhiệm:

Validate request.
Validate vocabulary.
Validate quiz type.
Xác định correct answer.
Kiểm tra user answer.
Tính correctness.
Tính score.
Tạo per-character feedback nếu cần.
Lưu QUIZ_ATTEMPT.
Update LEARNING_PROGRESS.
Tính Spaced Repetition.
Update XP.
Update Streak.
Kiểm tra Achievement.
Trả kết quả.

Client không được gửi:

correct_answer

is_correct

score

xp_earned

level

streak

để Backend tin tưởng trực tiếp.

22. Quiz Type: Vietnamese → English

Enum:

VI_TO_ENGLISH

Question:

Công việc → ______

Expected answer:

work

User phải nhập đáp án đầy đủ.

Backend xác định đáp án đúng dựa trên Vocabulary/Meaning data hoặc business rule đã được định nghĩa.

23. Quiz Type: Missing Letter

Enum:

MISSING_LETTER

Ví dụ:

w_rk

Expected:

work

Backend kiểm tra đáp án dựa trên vocabulary word.

24. Per-character Feedback

Đối với các quiz dạng typing:

VI_TO_ENGLISH

MISSING_LETTER

Backend có thể trả feedback theo từng character.

Ví dụ conceptual:

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

Frontend dùng dữ liệu này để hiển thị:

Correct → green

Incorrect → red

Feedback này được tính runtime.

Không tạo database table riêng cho từng character feedback.

25. Quiz Result Response

Ví dụ:

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

Response thực tế có thể được tinh chỉnh trong implementation nhưng phải giữ nguyên nguyên tắc:

Backend = source of truth
26. Pronunciation API

Pronunciation là một learning module riêng.

Không coi pronunciation là Quiz Type.

Flow:

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
26.1 Get Pronunciation Information
GET /api/pronunciation/:vocabularyId

Access:

Public / Authenticated

Response:

{
  "success": true,
  "data": {
    "vocabulary_id": "vocabulary-id",
    "phonetic": "/wɜːrk/",
    "pronunciation_url": "..."
  }
}
26.2 Evaluate Pronunciation
POST /api/pronunciation/evaluate

Access:

Authenticated

Mục đích:

Nhận pronunciation input của User.
Gửi tới external pronunciation/speech service nếu được sử dụng.
Nhận evaluation result.
Trả kết quả cho Frontend.

Request concept:

vocabulary_id

pronunciation input

Pronunciation input format sẽ được xác định trong PLAN/implementation sau khi lựa chọn pronunciation evaluation approach.

Pronunciation evaluation là optional dependency.

Nếu external service chưa được tích hợp thì endpoint có thể chưa được triển khai.

V1 không lưu pronunciation attempt thành database entity.

27. Progress API
27.1 Get Learning Progress
GET /api/progress

Access:

Authenticated

Chỉ trả progress của current user.

Không cho User truy cập progress của User khác.

27.2 Get Vocabulary Progress
GET /api/progress/:vocabularyId

Access:

Authenticated

Trả progress của current user đối với vocabulary tương ứng.

27.3 Get Progress Summary
GET /api/progress/summary

Access:

Authenticated

Có thể trả:

Total vocabulary learned

Reviewed vocabulary

Mastered vocabulary

Quiz accuracy

Learning statistics

Exact calculation có thể được xác định trong implementation.

28. Streak API
28.1 Get Current Streak
GET /api/streak

Access:

Authenticated

Response:

{
  "success": true,
  "data": {
    "current_streak": 5,
    "longest_streak": 12,
    "last_activity_date": "2026-09-14"
  }
}

Streak được cập nhật bởi Backend.

Client không được gửi:

current_streak

longest_streak

last_activity_date

để tự thay đổi dữ liệu.

29. Achievement API
29.1 Get All Achievements
GET /api/achievements

Access:

Authenticated
29.2 Get My Achievements
GET /api/achievements/me

Access:

Authenticated

Trả về achievements của current user.

30. Community API

Community v1 bao gồm:

Posts

Comments

Vocabulary Set Sharing

Không bao gồm:

Likes

Reactions

Followers

Friends

Direct Messages

Chat

Leaderboard
31. Get Community Posts
GET /api/community/posts

Access:

Public / Authenticated

Có thể hỗ trợ:

?page=1
&limit=20
32. Get Community Post Detail
GET /api/community/posts/:id

Access:

Public / Authenticated

Có thể trả:

Post

Author information

Shared vocabulary set information nếu có

Comments
33. Create Community Post
POST /api/community/posts

Access:

Authenticated

Request:

{
  "title": "Useful words for travel",
  "content": "Here are some words I learned.",
  "vocabulary_set_id": "set-id"
}

vocabulary_set_id là optional.

Nếu không có:

Normal community post

Nếu có:

Vocabulary Set sharing post

Backend phải kiểm tra User có quyền truy cập hợp lệ đối với Vocabulary Set được chia sẻ.

User không được dùng API để chia sẻ private set của User khác.

Việc tạo Community Post để chia sẻ Vocabulary Set không làm thay đổi is_public của Vocabulary Set.

34. Update Community Post
PUT /api/community/posts/:id

Access:

Post Owner / ADMIN

User không được chỉnh sửa post của User khác.

35. Delete Community Post
DELETE /api/community/posts/:id

Access:

Post Owner / ADMIN
36. Create Community Comment
POST /api/community/posts/:id/comments

Access:

Authenticated

Request:

{
  "content": "This set is useful!"
}

Comment được tạo dưới Community Post tương ứng.

37. Update Community Comment
PUT /api/community/comments/:id

Access:

Comment Owner / ADMIN
38. Delete Community Comment
DELETE /api/community/comments/:id

Access:

Comment Owner / ADMIN
39. Admin API

Admin API được bảo vệ bởi:

Authentication

+

ADMIN authorization

USER không được truy cập các endpoint Admin.

40. Admin User Management
40.1 Get Users
GET /api/admin/users

Access:

ADMIN

Có thể hỗ trợ:

?page=1
&limit=20
&search=
&status=
40.2 Get User Detail
GET /api/admin/users/:id

Access:

ADMIN

Có thể bao gồm:

Basic user information
Account status
Learning statistics
Gamification information

Không trả password hash hoặc sensitive credentials.

40.3 Update User Status
PATCH /api/admin/users/:id/status

Access:

ADMIN

Request:

{
  "is_active": false
}

Mục đích:

Activate

Deactivate

Admin không được thông qua endpoint này để tự ý thay đổi:

total_xp

level

password_hash
41. Admin Vocabulary Set API
41.1 Create System Vocabulary Set
POST /api/admin/vocabulary-sets

Access:

ADMIN

System set phải:

is_public = true

và được xem là set do Admin quản lý.

41.2 Update System Vocabulary Set
PUT /api/admin/vocabulary-sets/:id

Access:

ADMIN
41.3 Delete System Vocabulary Set
DELETE /api/admin/vocabulary-sets/:id

Access:

ADMIN
42. Admin Achievement API
42.1 Get Achievements
GET /api/admin/achievements

Access:

ADMIN
42.2 Create Achievement
POST /api/admin/achievements

Access:

ADMIN

Request concept:

{
  "name": "First Step",
  "description": "Complete your first learning activity.",
  "icon_url": "...",
  "condition_type": "LEARNING_COUNT",
  "condition_value": 1
}
42.3 Update Achievement
PUT /api/admin/achievements/:id

Access:

ADMIN
42.4 Delete Achievement
DELETE /api/admin/achievements/:id

Access:

ADMIN
43. Admin Community Moderation
43.1 Delete Community Post
DELETE /api/admin/community/posts/:id

Access:

ADMIN

Admin có thể xóa Community Post vi phạm quy định hệ thống.

43.2 Delete Community Comment
DELETE /api/admin/community/comments/:id

Access:

ADMIN

Admin có thể xóa comment vi phạm quy định hệ thống.

44. API Permission Matrix
Domain	USER	ADMIN
Register/Login	✓	✓
Own Profile	✓	✓
Vocabulary Read	✓	✓
Vocabulary Create/Update/Delete	✗	✓
Own Vocabulary Set	✓	✓
Other Private Set	✗	✓*
System Set	✓	✓
Copy Shared Set	✓	✓
Learning	✓	✓
Quiz	✓	✓
Pronunciation	✓	✓
Own Progress	✓	✓
Other User Progress	✗	✓*
Streak	✓	✓
Achievement	✓	✓
Community Post	✓	✓
Community Comment	✓	✓
User Management	✗	✓
System Vocabulary Set Management	✗	✓
Achievement Management	✗	✓
Community Moderation	✗	✓

* Admin access depends on the management policy of the corresponding feature.

45. Backend Source of Truth

Backend là source of truth cho các dữ liệu sau:

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

Frontend không được tự quyết định authoritative values.

Ví dụ không được làm:

User submits quiz

↓

Frontend tự tính XP = 100

↓

Frontend gửi XP = 100

↓

Backend lưu trực tiếp

Thay vào đó:

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
46. Ownership Rules

Backend phải enforce ownership.

Ví dụ:

User A

└── Set A

User B không thể:

PUT /api/vocabulary-sets/set-a

để sửa Set A.

Backend phải trả:

403 Forbidden

hoặc status phù hợp theo implementation.

Ownership không được kiểm tra chỉ ở Frontend.

47. Vocabulary Set Visibility Rules

Rules:

Admin-created System Set

→ Public

User-created Set

→ Private by default

User không được trực tiếp chuyển:

Private → Public

thông qua PUT /api/vocabulary-sets/:id.

Muốn chia sẻ:

Private Vocabulary Set

        ↓

Community Post

        ↓

Other User

        ↓

Copy

        ↓

New Private Vocabulary Set

Community sharing không làm thay đổi is_public của original set.

48. Transaction Requirements

Các operation có nhiều bước database phải sử dụng transaction khi cần.

Ví dụ:

Copy Vocabulary Set

Flow:

BEGIN TRANSACTION

Create new set

        ↓

Copy set items

        ↓

COMMIT

Nếu một bước thất bại:

ROLLBACK

Không để database rơi vào trạng thái copy không hoàn chỉnh.

49. External Services

External services có thể được sử dụng cho:

Pronunciation Audio

Speech Recognition

Pronunciation Evaluation

AI-assisted Learning

External service phải được gọi từ Backend.

Frontend không được chứa secret key của external service.

Ví dụ:

Frontend

   ↓

Backend

   ↓

External Service

Không:

Frontend

   ↓

External Service

   ↓

Secret API Key exposed

AI là optional.

AI không được trở thành dependency bắt buộc của hệ thống nếu chưa có quyết định thay đổi scope.

50. API Security Principles

Backend phải:

Validate mọi input.
Hash password.
Protect authenticated endpoints.
Enforce role authorization.
Enforce ownership.
Không expose secrets.
Không trả password hash.
Không trust client-side authorization.
Không trust client-provided XP.
Không trust client-provided correct answer.
Không trust client-provided score.
Không log sensitive information.
Sử dụng HTTPS trong production.
Sử dụng environment variables cho secrets.
51. Pagination

Các API trả danh sách lớn nên hỗ trợ pagination.

Ví dụ:

GET /api/vocabulary?page=1&limit=20

Response:

{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}

Exact pagination strategy có thể được quyết định trong implementation.

Không cần ép pagination cho endpoint có dữ liệu nhỏ.

52. Filtering and Search

Các list API có thể hỗ trợ filtering/search khi cần.

Ví dụ:

Vocabulary

- search
- difficulty_level

Community

- page
- limit

Admin Users

- search
- status

Không thêm filter chỉ để làm API phức tạp hơn nếu UI/business requirement không cần.

53. API Naming Rules

Endpoint sử dụng:

Noun-based resource names.
HTTP method để biểu diễn action cơ bản.
kebab-case cho multi-word resources.

Ví dụ:

/api/vocabulary

/api/vocabulary-sets

/api/community/posts

/api/community/comments

Tránh:

/api/getVocabulary

/api/createVocabulary

/api/deleteVocabulary
54. HTTP Method Rules

Sử dụng:

GET

cho read.

POST

cho create hoặc command/action cần xử lý.

PUT

cho update resource.

PATCH

cho partial update.

DELETE

cho delete.

Ví dụ:

POST /api/quiz/submit

POST /api/vocabulary-sets/:id/copy

là action endpoints hợp lệ vì chúng thực hiện business operation.

55. API and Database Relationship

API không được phá vỡ database rules.

Ví dụ:

API

POST /api/vocabulary-sets/:id/items

phải tuân thủ:

VOCABULARY_SET_ITEM

UNIQUE(vocabulary_set_id, vocabulary_id)

API:

POST /api/quiz/submit

phải tạo dữ liệu phù hợp với:

QUIZ_ATTEMPT

API:

POST /api/learning/review

phải cập nhật:

LEARNING_PROGRESS

theo business rules.

56. API and Architecture Relationship

API flow:

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

Không được:

Route

 ↓

Huge Business Logic

Không được:

Controller

 ↓

Complex Prisma Queries + Business Logic

Không được:

Frontend

 ↓

PostgreSQL

Business logic nên nằm trong Service Layer.

57. Business Logic Examples
Quiz
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
Learning Review
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

Learning Review không được dùng để ghi nhận lại cùng một Quiz attempt.

Vocabulary Set Copy
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
58. Testing Requirements

API cần được test đối với các business-critical flows.

Tối thiểu nên test:

Authentication
Register
Duplicate email
Login success
Login failure
Protected endpoint
Authorization
USER accessing ADMIN endpoint
Ownership violation
Unauthorized resource access
Vocabulary
Get vocabulary
Get vocabulary detail
Admin create/update/delete
Vocabulary Set
Create private set
Update own set
Cannot edit another user's set
Add item
Remove item
Copy set
Copy creates independent private set
Learning
Submit review
Progress update
Spaced repetition update
Prevent duplicate processing of the same learning activity when required by business rules
Quiz
Correct answer
Incorrect answer
Invalid quiz type
Score calculation
Per-character feedback
Quiz attempt persistence
Client-provided authoritative values are not trusted
Gamification
XP
Level
Streak
Achievement
Community
Create post
Edit own post
Cannot edit another user's post
Comment
Admin moderation
Vocabulary set sharing
59. OpenAPI / Swagger

Có thể sử dụng OpenAPI/Swagger để document API.

Ví dụ:

/api-docs

Tuy nhiên việc sử dụng Swagger UI không phải business requirement.

Nếu triển khai:

Specification phải đồng bộ với API thực tế.
Không tạo documentation sai với implementation.
API_SPEC.md vẫn là project-level contract.
60. Environment Configuration

API URL phải được cấu hình thông qua environment variables.

Frontend:

VITE_API_URL

Backend:

DATABASE_URL

và các external service keys nếu cần.

Không commit:

.env

chứa secret thật lên GitHub.

Nên có:

.env.example
61. API Logging

Backend có thể log:

Request method
Endpoint
Status code
Response time
Error code

Không log:

Password
Password hash
Access token
External API secret
Sensitive user information
62. Rate Limiting

Rate limiting có thể được áp dụng cho các endpoint nhạy cảm như:

Login

Register

Quiz submit

Pronunciation evaluation

Chỉ triển khai khi cần thiết.

Không thêm infrastructure phức tạp nếu không cần cho v1.

63. API Performance

API nên:

Query database hiệu quả.
Sử dụng pagination khi cần.
Tránh N+1 queries.
Chỉ select dữ liệu cần thiết.
Sử dụng indexes phù hợp với DATABASE.md.
Không thực hiện external API calls không cần thiết.

Performance optimization không được làm thay đổi business behavior.

64. API Out of Scope

Các API sau không thuộc phạm vi v1:

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

Không tự ý tạo endpoint cho các feature trên.

65. Architecture Change Rules

Không tự ý thay đổi:

Authentication architecture.
API architecture.
Database architecture.
Role model.
Vocabulary Set ownership rules.
Vocabulary Set visibility rules.
Quiz types.
Pronunciation architecture.
AI dependency.
Deployment architecture.

Nếu implementation phát sinh vấn đề:

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
66. Source of Truth

Khi làm việc với API, AI Agent phải tham khảo các tài liệu liên quan:

PROJECT_OVERVIEW.md

        ↓

ARCHITECTURE.md

        ↓

DATABASE.md

        ↓

API_SPEC.md

        ↓

UI_UX_SPEC.md

        ↓

FEATURE_STATUS.md

Trong đó:

PROJECT_OVERVIEW.md
→ Business scope và phạm vi hệ thống

ARCHITECTURE.md
→ System architecture và technical boundaries

DATABASE.md
→ Data model và database rules

API_SPEC.md
→ Frontend ↔ Backend API contract

UI_UX_SPEC.md
→ User flow và UI/UX behavior

FEATURE_STATUS.md
→ Trạng thái hiện tại của từng feature

FEATURE_STATUS.md dùng để xác định feature đang ở trạng thái:

TODO

IN_PROGRESS

DONE

BLOCKED

và không thay thế các tài liệu đặc tả về requirement hoặc technical design.

Implementation và source code là bằng chứng về trạng thái thực tế của hệ thống, nhưng không được tự động xem là thay thế cho requirement hoặc API contract đã được phê duyệt.

Nếu phát hiện conflict:

Không tự đoán.

Không tự sửa.

Không âm thầm thay đổi.

AI Agent phải thông báo conflict, phân tích ảnh hưởng và đề xuất cách xử lý.

Nếu conflict ảnh hưởng scope, business rule, architecture hoặc API contract, phải được làm rõ và phê duyệt trước khi implementation.

67. Final Principles

API của hệ thống phải tuân theo:

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
15. Learning Review không được ghi nhận lại cùng một Quiz attempt.
16. API contract phải được giữ nhất quán với UI/UX và business rules đã được phê duyệt.

Ưu tiên:

Simple
    →
Clear
    →
Maintainable
    →
Testable
    →
Scalable when necessary