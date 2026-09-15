# ARCHITECTURE — English Vocabulary Learning Platform

> Tài liệu định nghĩa kiến trúc kỹ thuật và các nguyên tắc xây dựng hệ thống.
>
> AI Agent MUST read this document together with `PROJECT_OVERVIEW.md` before planning or implementing technical changes.
>
> `PROJECT_OVERVIEW.md` defines **WHAT** the system does.
>
> `ARCHITECTURE.md` defines **HOW** the system is structured.
>
> AI Agent MUST NOT change the architecture, technology direction, or architectural principles defined in this document without explicit approval from the developer.


---

# 1. Architecture Overview

English Vocabulary Learning Platform sử dụng mô hình **Client–Server Architecture**.

Hệ thống được chia thành các thành phần chính:

```text
┌─────────────────────────────┐
│          Frontend           │
│        React + Vite         │
└──────────────┬──────────────┘
               │
               │ HTTPS / REST API
               ▼
┌─────────────────────────────┐
│           Backend           │
│      Node.js + Express      │
└──────────────┬──────────────┘
               │
               │ Database Access
               ▼
┌─────────────────────────────┐
│        PostgreSQL DB        │
│          Supabase           │
└─────────────────────────────┘

Frontend chịu trách nhiệm về giao diện và trải nghiệm người dùng.

Backend chịu trách nhiệm xử lý business logic, authentication, authorization, validation và giao tiếp với database.

PostgreSQL chịu trách nhiệm lưu trữ dữ liệu của hệ thống và được triển khai trên Supabase.

Nguyên tắc tổng quát:

Frontend
    ↓
Backend API
    ↓
Business Logic
    ↓
Database / External Services

Frontend MUST NOT truy cập trực tiếp PostgreSQL database.

Mọi thao tác liên quan đến business data phải thông qua Backend API.

2. Technology Stack
2.1. Frontend

Công nghệ chính:

React
Vite
JavaScript
Tailwind CSS

Frontend chịu trách nhiệm:

Rendering UI
User interaction
Client-side state
Gọi Backend API
Hiển thị vocabulary
Flashcard
Quiz
Pronunciation learning
Learning progress
Streak / XP / Level
Achievement
Vocabulary Set
Community features
Admin interface

Hệ thống hiện tại chỉ có 2 quiz type:

Vietnamese → English
Missing Letter

Pronunciation là một learning module riêng, không được xem là quiz type thứ ba.

Frontend MUST NOT truy cập trực tiếp PostgreSQL database.

Mọi thao tác liên quan đến business data phải thông qua Backend API.

2.2. Backend

Công nghệ chính:

Node.js
Express.js
RESTful API
Prisma ORM

Backend chịu trách nhiệm:

Authentication
Authorization
Business logic
Request validation
Vocabulary management
Vocabulary meanings and examples
Pronunciation-related processing
Learning progress
Quiz processing
Spaced Repetition
XP / Level / Streak
Achievement
Vocabulary Set
Community features
Admin operations
External service integration khi được phê duyệt
Error handling

Backend là nơi thực thi các business rules quan trọng của hệ thống.

Backend MUST là security boundary của hệ thống.

2.3. Database

Database chính:

PostgreSQL
Supabase PostgreSQL

PostgreSQL được sử dụng vì hệ thống có nhiều dữ liệu có quan hệ rõ ràng giữa các domain.

Ví dụ:

User

 ├── Learning Progress
 ├── Quiz Attempts
 ├── Streak
 ├── Achievements
 └── Vocabulary Sets


Vocabulary

 ├── Meanings
 ├── Examples
 └── Learning Progress


Vocabulary Set

 └── Vocabulary Set Items
      └── Vocabulary

Pronunciation information của vocabulary được lưu trong VOCABULARY, ví dụ:

VOCABULARY

 ├── phonetic
 └── pronunciation_url

Database schema chi tiết được định nghĩa trong:

docs/DATABASE.md
3. Layered Backend Architecture

Backend sử dụng Layered Architecture nhằm tách biệt trách nhiệm giữa các thành phần.

Luồng xử lý chính:

HTTP Request
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
 PostgreSQL

Các layer MUST có trách nhiệm rõ ràng và không nên chứa logic thuộc về layer khác.

Không bắt buộc mọi feature phải tạo đầy đủ một layer riêng nếu điều đó không mang lại giá trị thực tế.

Ưu tiên giữ architecture nhất quán nhưng tránh tạo abstraction không cần thiết.

3.1. Route Layer

Route chịu trách nhiệm:

Định nghĩa endpoint
Mapping endpoint tới controller
Gắn middleware cần thiết

Route MUST NOT chứa business logic phức tạp.

Ví dụ:

GET    /api/vocabulary
GET    /api/vocabulary/:id
POST   /api/vocabulary
PUT    /api/vocabulary/:id
DELETE /api/vocabulary/:id
3.2. Middleware Layer

Middleware xử lý các concern dùng chung.

Các middleware có thể bao gồm:

Authentication
Authorization
Request validation
Error handling
Logging
Rate limiting nếu cần

Middleware MUST được sử dụng cho các logic có tính cross-cutting thay vì lặp lại logic ở nhiều controller.

Không tạo middleware riêng nếu logic chỉ phục vụ một business case đơn giản và có thể xử lý rõ ràng ở layer phù hợp.

3.3. Controller Layer

Controller chịu trách nhiệm:

Nhận HTTP request
Đọc parameters / body / query
Gọi service tương ứng
Trả HTTP response
Mapping error thành HTTP response phù hợp

Controller MUST NOT chứa business logic phức tạp.

Controller MUST NOT trực tiếp thực hiện các database query phức tạp.

3.4. Service Layer

Service là nơi chứa business logic của hệ thống.

Ví dụ:

VocabularyService
QuizService
LearningService
SpacedRepetitionService
PronunciationService
StreakService
AchievementService
VocabularySetService
CommunityService
AdminService

Service có thể:

Kiểm tra business rules
Tính toán kết quả
Điều phối nhiều repository
Thực hiện transaction khi cần
Gọi external service thông qua abstraction phù hợp

Business logic MUST được ưu tiên đặt tại Service Layer.

Không nên tạo service chỉ vì muốn tăng số lượng abstraction.

Service chỉ nên được tách khi có trách nhiệm nghiệp vụ rõ ràng.

3.5. Repository / Data Access Layer

Repository/Data Access chịu trách nhiệm giao tiếp với database thông qua Prisma hoặc abstraction phù hợp.

Repository có thể:

Query data
Insert data
Update data
Delete data
Thực hiện database operations cần transaction

Ví dụ:

UserRepository
VocabularyRepository
LearningProgressRepository
QuizRepository
AchievementRepository
VocabularySetRepository
CommunityRepository

Repository MUST NOT chứa business rules của application.

Business decisions phải được xử lý tại Service Layer.

Không bắt buộc mọi database operation đơn giản phải tạo một repository riêng.

Repository nên được sử dụng khi việc tách data access mang lại lợi ích về:

Reusability
Testability
Maintainability
Separation of concerns

Tránh tạo repository chỉ để tăng số lượng abstraction.

4. Frontend Architecture

Frontend sử dụng component-based architecture.

Luồng xử lý cơ bản:

Page
  ↓
Component
  ↓
Hook / State
  ↓
Service
  ↓
Backend API

Suggested structure:

src/

├── assets/
├── components/
├── pages/
├── layouts/
├── hooks/
├── services/
├── contexts/
├── utils/
├── constants/
├── routes/
└── ...

Cấu trúc thực tế có thể thay đổi trong phạm vi hợp lý nếu không phá vỡ architectural principles.

4.1. Pages

Pages đại diện cho các màn hình hoặc route chính của hệ thống.

Ví dụ:

Home
Login
Register
Vocabulary
VocabularySet
Learning
Quiz
Progress
Profile
Community
Admin

Pronunciation có thể là một screen/module bên trong Learning flow và không bắt buộc phải là một main navigation page hoặc route riêng.

Không nhất thiết mỗi component nhỏ phải trở thành một page.

Chi tiết user flow và UI behavior được định nghĩa trong:

docs/UI_UX_SPEC.md
4.2. Components

Components chịu trách nhiệm cho các UI element có thể tái sử dụng.

Ví dụ:

Flashcard
QuizInput
VocabularyCard
ProgressCard
StreakCard
AchievementCard
VocabularySetCard
PronunciationPractice

Components SHOULD be reusable khi cùng một UI hoặc behavior xuất hiện ở nhiều nơi.

Không tạo abstraction chỉ để tránh vài dòng code nếu abstraction đó làm code khó hiểu hơn.

4.3. Services

Frontend services chịu trách nhiệm giao tiếp với Backend API.

Ví dụ:

authService
vocabularyService
quizService
learningService
pronunciationService
achievementService
vocabularySetService
communityService
adminService

API calls SHOULD NOT được viết trực tiếp trong các UI components nếu có thể tách thành service hoặc hook phù hợp.

Frontend service không được chứa business rules quan trọng của hệ thống.

Frontend chỉ thực hiện client-side logic phục vụ UI/UX.

Backend vẫn là source of truth cho business logic.

5. Authentication and Authorization

Hệ thống có hai role:

USER
ADMIN

Role được lưu trong database.

Authentication

Authentication dùng để xác định danh tính người dùng.

Các API yêu cầu đăng nhập MUST kiểm tra authentication trước khi xử lý request.

Authorization

Authorization dùng để kiểm tra quyền truy cập.

Ví dụ:

USER

├── Learning
├── Quiz
├── Pronunciation
├── Vocabulary Set
├── Progress
├── Streak
├── Achievement
└── Community


ADMIN

├── User Management
├── Vocabulary Management
├── Vocabulary Set Management
├── Community Management
└── System Data Management

Backend MUST là security boundary.

Frontend chỉ dùng authorization để điều khiển UI/UX và navigation.

Không được coi frontend authorization là cơ chế bảo mật duy nhất.

6. API Architecture

Backend cung cấp RESTful API cho frontend.

API sử dụng prefix:

/api

Ví dụ:

/api/auth
/api/users
/api/vocabulary
/api/vocabulary-sets
/api/learning
/api/quiz
/api/progress
/api/streak
/api/achievements
/api/community
/api/admin

API MUST:

Sử dụng HTTP methods phù hợp.
Sử dụng HTTP status codes nhất quán.
Validate input.
Kiểm tra authentication đối với protected endpoints.
Kiểm tra authorization đối với role-protected endpoints.
Trả response có cấu trúc nhất quán.
Sử dụng centralized error handling.

API contract chi tiết được định nghĩa riêng trong:

docs/API_SPEC.md

API design MUST phù hợp với business requirements trong PROJECT_OVERVIEW.md.

7. Database Architecture

Database sử dụng relational model của PostgreSQL.

Các domain chính:

Users

Vocabulary

Vocabulary Meanings

Vocabulary Examples

Vocabulary Sets

Vocabulary Set Items

Learning Progress

Quiz Attempts

Streak

Achievement

User Achievement

Community Posts

Community Comments

Database MUST đảm bảo:

Referential integrity
Appropriate constraints
Appropriate indexes
Consistent naming
Data validation ở mức database khi phù hợp

Không nên sử dụng database constraint để thay thế hoàn toàn business validation tại Backend.

Chi tiết entity, field, relationship, constraint và index được định nghĩa trong:

docs/DATABASE.md

AI Agent MUST NOT tự ý tạo thêm database entity chỉ để phục vụ implementation convenience nếu entity đó chưa được xác định trong scope hoặc approved PLAN.

8. Business Logic Architecture

Business logic phải được xử lý chủ yếu tại Backend Service Layer.

Ví dụ:

Quiz
Request

  ↓

Quiz Controller

  ↓

Quiz Service

  ↓

Check Answer

  ↓

Calculate Result

  ↓

Update Learning Progress

  ↓

Update XP / Streak / Achievement

  ↓

Response

Hệ thống hiện tại chỉ hỗ trợ:

1. Vietnamese → English
2. Missing Letter

Đối với các quiz dạng nhập đáp án, per-character feedback có thể được tính toán bằng cách so sánh câu trả lời của người dùng với đáp án đúng.

Thông tin feedback này không yêu cầu một database table riêng trong v1.

Spaced Repetition
Quiz / Learning Result
        ↓
Learning Service
        ↓
Spaced Repetition Service
        ↓
Calculate next review
        ↓
Update Learning Progress
Streak
Learning Activity
       ↓
Streak Service
       ↓
Check today's activity
       ↓
Update streak
       ↓
Evaluate achievement / XP

Business rules MUST NOT được duplicate giữa Frontend và Backend.

Frontend có thể thực hiện validation phục vụ UX, nhưng Backend MUST luôn validate lại dữ liệu quan trọng.

9. Pronunciation Architecture

Pronunciation là một learning module riêng, không phải quiz type.

Luồng cơ bản:

Vocabulary

    ↓

Model Pronunciation

    ↓

User listens

    ↓

User speaks / records

    ↓

Pronunciation Evaluation

    ↓

Pronunciation Result

Hệ thống có thể hỗ trợ:

Phát âm mẫu.
Người dùng nghe phát âm mẫu.
Người dùng tự phát âm.
Speech recognition.
Pronunciation evaluation.

Các công nghệ hoặc external providers cụ thể cho pronunciation chưa được cố định trong tài liệu này.

Việc lựa chọn technology/provider phải được xác định trong PLAN và được phê duyệt khi cần thiết.

Model pronunciation information được lưu trong VOCABULARY, ví dụ:

phonetic
pronunciation_url

User pronunciation attempt không được lưu thành database entity riêng trong v1.

Nếu sau này cần lưu lịch sử pronunciation attempt, việc bổ sung entity/table phải được developer phê duyệt trước.

Pronunciation functionality có thể sử dụng external services khi cần.

10. External Services

Hệ thống có thể tích hợp external services cho các chức năng đã được phê duyệt, ví dụ:

Pronunciation audio
Speech recognition
Pronunciation evaluation
AI-assisted learning

Các external services khác chỉ được thêm khi có requirement rõ ràng và được developer phê duyệt.

External service integration SHOULD được đặt sau một abstraction/service layer khi điều đó mang lại lợi ích thực tế.

Ví dụ:

Application
     ↓
PronunciationService
     ↓
External Provider

Business logic không nên phụ thuộc trực tiếp vào implementation cụ thể của một external provider nếu abstraction giúp dễ thay thế hoặc kiểm thử.

Nếu thay đổi provider, phần lớn application logic SHOULD không cần thay đổi.

AI features chỉ được triển khai trong phạm vi đã được xác định trong PROJECT_OVERVIEW.md hoặc được developer phê duyệt bổ sung.

AI là optional, không phải dependency bắt buộc của hệ thống.

11. Spaced Repetition Architecture

Spaced Repetition là một business feature quan trọng của hệ thống.

Logic Spaced Repetition SHOULD được tách thành service riêng:

SpacedRepetitionService

Service này chịu trách nhiệm:

Đánh giá kết quả học.
Xác định trạng thái ghi nhớ.
Tính toán thời điểm ôn tập tiếp theo.
Cập nhật learning progress.

Thuật toán cụ thể sẽ được xác định trong tài liệu thiết kế/PLAN khi implementation được bắt đầu.

AI Agent MUST NOT tự ý thay đổi thuật toán hoặc thêm thuật toán mới nếu chưa được developer phê duyệt.

Không tạo thêm database table chỉ để lưu các thông số trung gian của thuật toán nếu DATABASE.md chưa yêu cầu.

12. Learning Progress Architecture

Learning progress được quản lý theo từng user và vocabulary.

Conceptual flow:

User

  ↓

Vocabulary

  ↓

Learning Progress

  ↓

Spaced Repetition

  ↓

Next Review

Learning progress có thể được cập nhật thông qua:

Flashcard learning
Quiz
Pronunciation practice
Other approved learning activities

Mỗi activity phải được xử lý thông qua business logic của Backend.

LEARNING_PROGRESS là trạng thái học tập hiện tại của user đối với vocabulary.

V1 không yêu cầu một bảng LEARNING_HISTORY riêng.

13. Gamification Architecture

Các tính năng:

XP
Level
Streak
Achievement

nên được thiết kế thành các domain/service riêng biệt nhưng có thể phối hợp với nhau.

Ví dụ:

Learning Activity
      │
      ├── XP Logic
      │
      ├── Streak Service
      │
      └── Achievement Service

Level được quản lý dựa trên XP theo business rules của hệ thống.

Trong v1:

USER.total_xp lưu tổng XP.
USER.level lưu level hiện tại.
STREAK lưu trạng thái streak hiện tại và streak cao nhất.
USER_ACHIEVEMENT lưu achievement mà user đã đạt.

V1 không yêu cầu XP transaction/history table.

Không nên đặt toàn bộ logic XP, Level, Streak và Achievement vào một service duy nhất nếu làm tăng coupling.

14. Vocabulary Set Architecture

Vocabulary Set là một domain riêng và có quan hệ với Vocabulary.

Cấu trúc:

Vocabulary Set

      ↓

Vocabulary Set Items

      ↓

Vocabulary

Hệ thống có hai nguồn vocabulary set:

ADMIN

  ↓

System Vocabulary Set

  ↓

Public

và:

USER

  ↓

Private Vocabulary Set

Business rules:

Vocabulary Set do Admin tạo là public.
Tất cả user có thể xem và học system vocabulary set.
Vocabulary Set do User tạo là private mặc định.
User chỉ có thể xem, học, chỉnh sửa và xóa vocabulary set của chính mình.
User không được trực tiếp chuyển vocabulary set của mình thành public.
User có thể chia sẻ vocabulary set của mình thông qua Community.
User khác có thể copy vocabulary set được chia sẻ thành một vocabulary set mới thuộc quyền sở hữu của họ.
Vocabulary set được copy trở thành một set riêng của user mới và mặc định là private.
User nhận bản copy không có quyền chỉnh sửa vocabulary set gốc.

Backend MUST thực thi các business rules trên.

Frontend không được tự quyết định quyền sở hữu hoặc visibility của vocabulary set.

Flow copy:

User A

  ↓

Private Vocabulary Set

  ↓

Share via Community

  ↓

User B views Community Post

  ↓

Copy Vocabulary Set

  ↓

Backend Transaction

  ↓

Create NEW Vocabulary Set

(owner_id = User B)

  ↓

Copy Vocabulary Set Items

  ↓

User B owns the new set

Set gốc của User A không bị thay đổi.

V1 không yêu cầu download/copy history table.

15. Community Architecture

Community là một domain riêng.

Phạm vi v1 tập trung vào:

Community

├── Posts
├── Comments
└── Vocabulary Set Sharing

Community Post có thể:

Là một bài viết/thảo luận thông thường.
Hoặc tham chiếu tới một Vocabulary Set để chia sẻ set đó.

COMMUNITY_POST.vocabulary_set_id là nullable.

Conceptual flow:

User

  ↓

Create Community Post

  ↓

Optional Vocabulary Set Reference

  ↓

Other Users View Post

  ↓

Copy Vocabulary Set

Community functionality MUST NOT làm thay đổi các business rules cốt lõi của vocabulary learning nếu không cần thiết.

Việc chia sẻ vocabulary set phải tuân thủ ownership rules được định nghĩa trong PROJECT_OVERVIEW.md và DATABASE.md.

V1 không yêu cầu các community interaction entities như:

Like
Reaction
Follow
Friend
Private Message

trừ khi developer phê duyệt bổ sung.

Admin có quyền quản lý/moderate community theo phạm vi được định nghĩa trong PROJECT_OVERVIEW.md.

16. Admin Architecture

Admin functionality được xây dựng như một phần riêng của hệ thống.

Admin có thể quản lý các domain được hệ thống cho phép:

Admin

├── Users
├── Vocabulary
├── Vocabulary Sets
├── Community
└── System Data

Admin API MUST được bảo vệ bằng:

Authentication

      +

Role-based Authorization

Không được chỉ ẩn Admin UI ở frontend mà bỏ qua authorization ở Backend.

Admin có thể quản lý nội dung hệ thống nhưng không được làm thay đổi business data của user ngoài phạm vi được quy định.

17. Error Handling

Backend sử dụng centralized error handling.

Application errors SHOULD được phân loại phù hợp, ví dụ:

400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity
500 Internal Server Error

Không nhất thiết mọi lỗi phải sử dụng tất cả các status code trên.

Error response SHOULD có cấu trúc nhất quán.

Không expose:

Database credentials
Internal stack traces
Sensitive system information
Secrets

cho client trong production.

18. Validation

Validation được thực hiện ở nhiều layer khi cần.

Frontend

   ↓

Backend Validation

   ↓

Business Logic

   ↓

Database Constraints

Frontend validation phục vụ UX.

Backend validation là bắt buộc đối với dữ liệu từ client.

Database constraints bảo vệ data integrity.

Không được tin tưởng dữ liệu chỉ vì frontend đã validate.

Các business rules quan trọng như:

Ownership
Role
Vocabulary Set visibility
Quiz correctness
Learning progress
XP
Streak

MUST được kiểm tra tại Backend.

19. Security Principles

Hệ thống MUST tuân thủ các nguyên tắc:

Không commit secrets vào Git.
Sử dụng environment variables cho sensitive configuration.
Không expose database credentials.
Authentication phải được xử lý tại Backend.
Authorization phải được kiểm tra tại Backend.
Validate tất cả dữ liệu từ client.
Không trust client-side role information.
Không expose sensitive error information.
Không lưu password dạng plaintext.
Sử dụng HTTPS trong production.

Các external API key hoặc credentials cũng MUST được quản lý bằng environment variables.

20. Environment Configuration

Các environment-specific configuration phải được quản lý bằng environment variables.

Ví dụ:

NODE_ENV

PORT

DATABASE_URL

AUTH_SECRET

API_URL

Sensitive values MUST NOT được commit vào repository.

Repository SHOULD cung cấp:

.env.example

để mô tả các biến môi trường cần thiết mà không chứa giá trị secret thực tế.

Production environment variables phải được cấu hình tại nền tảng deployment tương ứng.

21. Deployment Architecture

Production deployment dự kiến:

                    Internet

                       │

             ┌─────────▼─────────┐
             │      Vercel       │
             │  React + Vite FE  │
             └─────────┬─────────┘
                       │
                     HTTPS
                       │
             ┌─────────▼─────────┐
             │      Render       │
             │ Node + Express BE │
             └─────────┬─────────┘
                       │
                     HTTPS
                       │
             ┌─────────▼─────────┐
             │     Supabase      │
             │   PostgreSQL DB   │
             └───────────────────┘

Deployment responsibilities:

Vercel

Frontend hosting.

Render

Backend API hosting.

Supabase

Managed PostgreSQL database.

GitHub / GitHub Actions

Source code repository và CI/CD automation.

Deployment configuration MUST sử dụng environment variables.

Production secrets MUST NOT được lưu trong source code.

Deployment architecture được xem là baseline và không được tự ý thay đổi.

22. Development Environment

Local development SHOULD có kiến trúc tương tự production:

React Frontend

      ↓

Node + Express Backend

      ↓

PostgreSQL

Database local có thể sử dụng:

PostgreSQL local
PostgreSQL thông qua Docker

tùy development setup.

Local environment MUST NOT yêu cầu production credentials.

Local development SHOULD có thể chạy độc lập với production services ngoại trừ các external service integration cần thiết cho development.

23. Testing Architecture

Testing phải được thực hiện ở các layer phù hợp.

Expected testing levels:

Unit Test

    ↓

Integration Test

    ↓

API Test

    ↓

Frontend Test

    ↓

E2E Test when valuable

Không nhất thiết mọi feature phải có đầy đủ tất cả các loại test.

E2E chỉ nên được sử dụng khi mang lại giá trị rõ ràng cho feature hoặc user flow quan trọng.

Test scope phải phù hợp với độ quan trọng và độ phức tạp của feature.

Các business logic quan trọng SHOULD có automated tests, đặc biệt:

Authentication
Authorization
Quiz evaluation
Learning progress
Spaced Repetition
Streak
XP
Achievement
Vocabulary Set ownership
Vocabulary Set copy rules
24. Code Organization Principles

Code SHOULD tuân thủ:

Separation of concerns
Single responsibility
Reusability
Maintainability
Testability
Clear naming
Consistent project structure

Avoid:

Giant components
Giant controllers
Giant services
Duplicated business logic
Direct database access from UI
Business logic inside route definitions
Unnecessary abstractions
Premature optimization

Không tạo abstraction chỉ vì "best practice" nếu abstraction đó không giải quyết một vấn đề thực tế.

Ưu tiên code dễ đọc và dễ bảo trì hơn code quá phức tạp.

25. Dependency Principles

Dependencies SHOULD flow theo hướng:

Presentation

     ↓

Application / Service

     ↓

Data Access

     ↓

Infrastructure

Higher-level business logic SHOULD NOT tightly depend on specific infrastructure implementations khi việc tách abstraction mang lại giá trị thực tế.

External services SHOULD được cô lập sau services/adapters khi phù hợp.

Dependency injection hoặc abstraction chỉ nên được sử dụng khi mang lại lợi ích thực tế cho:

Testability
Replaceability
Reduced coupling

Không over-engineer dependency architecture.

26. Architecture Change Rules

AI Agent MUST NOT tự ý:

Thay đổi database engine.
Thay đổi frontend framework.
Thay đổi backend framework.
Thay đổi deployment architecture.
Thay đổi authentication architecture.
Thay đổi API architecture.
Thay đổi layered architecture.
Thêm infrastructure không cần thiết.
Thêm external service mới.
Thêm database entity mới cho feature chưa được phê duyệt.
Thêm quiz type mới.
Biến Pronunciation thành quiz type.
Thay đổi ownership/visibility rules của Vocabulary Set.
Thêm AI dependency bắt buộc cho hệ thống.

Nếu implementation thực tế cho thấy architecture hiện tại không phù hợp, Agent phải:

Giải thích vấn đề.
Đề xuất phương án.
Nêu trade-off.
Chờ developer approval.
Chỉ thay đổi sau khi được phê duyệt.
27. Documentation Consistency

Các tài liệu kỹ thuật phải được giữ nhất quán với implementation.

Khi thay đổi architecture, các tài liệu liên quan phải được xem xét và cập nhật, bao gồm khi phù hợp:

ARCHITECTURE.md

DATABASE.md

API_SPEC.md

UI_UX_SPEC.md

FEATURE_STATUS.md

Không được để source code và documentation cố tình tồn tại ở trạng thái mâu thuẫn mà không ghi nhận.

Nếu phát hiện documentation đã lỗi thời:

Báo rõ phần không còn chính xác.
Xác định tài liệu nào bị ảnh hưởng.
Đề xuất cập nhật.
Chỉ cập nhật theo workflow phù hợp.
28. Core Architectural Principle

Hệ thống ưu tiên:

Simple

   ↓

Clear

   ↓

Maintainable

   ↓

Testable

   ↓

Scalable when necessary

Không xây dựng architecture phức tạp chỉ để làm hệ thống trông "professional".

Mọi abstraction, library, service hoặc infrastructure mới phải có lý do kỹ thuật rõ ràng.

Đối với một feature mới, Agent SHOULD ưu tiên:

Existing Architecture

        ↓

Existing Pattern

        ↓

Simple Implementation

        ↓

Refactor when necessary

thay vì tạo một architecture mới cho từng feature.

Build what the project needs, not what the technology makes possible.