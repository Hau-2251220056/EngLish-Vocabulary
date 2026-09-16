# AGENTS.md — AI Agent Instructions

> Đây là tài liệu hướng dẫn AI Agent khi làm việc trong dự án English Vocabulary Learning Platform.
>
> AI Agent phải đọc và tuân thủ tài liệu này trước khi phân tích, lập kế hoạch hoặc triển khai thay đổi trong project.

---

# 1. Project Context

Project:

**English Vocabulary Learning Platform**

Graduation thesis:

**Xây dựng hệ thống học từ vựng tiếng Anh**

Project structure:

```text
English Vocabulary/

│
├── AGENTS.md
│
├── backend/
├── frontend/
│
├── docs/
│   ├── PROJECT_OVERVIEW.md
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── API_SPEC.md
│   ├── FEATURE_STATUS.md
│   └── UI_UX_SPEC.md
│
└── .agents/
    └── skills/
        ├── spec/
        │   └── SKILL.md
        ├── plan/
        │   └── SKILL.md
        ├── task/
        │   └── SKILL.md
        ├── implement/
        │   └── SKILL.md
        ├── test/
        │   └── SKILL.md
        └── review/
            └── SKILL.md

AI Agent phải xem các tài liệu trong docs/ là nguồn thông tin chính thức về hệ thống.

2. Role of AGENTS.md

AGENTS.md định nghĩa các global rules, constraints và guardrails mà AI Agent phải tuân thủ trong toàn bộ project.

File này định nghĩa:

Cách AI Agent làm việc.
Cách AI Agent sử dụng project documentation.
Quy trình phát triển.
Quy tắc approval.
Quy tắc scope.
Quy tắc architecture.
Quy tắc database.
Quy tắc API.
Quy tắc security.
Quy tắc testing.
Quy tắc documentation.
Những điều AI Agent không được tự ý làm.

Business rules chi tiết phải được lấy từ các tài liệu trong docs/.

AGENTS.md không thay thế SKILL.md và không chứa toàn bộ implementation procedure của từng Skill.

Nếu một Skill yêu cầu hành động có thể ảnh hưởng:

project scope
architecture
database
API contract
business rules
authentication
authorization

thì các approval rules trong AGENTS.md phải được tuân thủ.

3. Source of Truth

Project documentation gồm:

PROJECT_OVERVIEW.md
ARCHITECTURE.md
DATABASE.md
API_SPEC.md
UI_UX_SPEC.md
FEATURE_STATUS.md

Các tài liệu này có trách nhiệm khác nhau:

PROJECT_OVERVIEW.md

→ What the system does
→ Business scope
→ Features
→ Roles
→ Product rules
ARCHITECTURE.md

→ How the system is structured
→ Frontend architecture
→ Backend architecture
→ Services
→ Deployment
→ Technical boundaries
DATABASE.md

→ How data is stored
→ Tables
→ Fields
→ Relationships
→ Constraints
→ Indexes
API_SPEC.md

→ How Frontend and Backend communicate
→ Endpoints
→ Request
→ Response
→ Authorization
→ API rules
UI_UX_SPEC.md

→ User experience
→ Information architecture
→ Screens
→ User flows
→ Components
→ UI states
→ Interaction behavior
FEATURE_STATUS.md

→ Current implementation status
→ Feature progress
→ Verification status
→ Blocked features

Các tài liệu trên không phải là một hierarchy cứng.

Mỗi tài liệu là source of truth cho domain mà nó phụ trách.

Ví dụ:

Project scope
→ PROJECT_OVERVIEW.md

Architecture
→ ARCHITECTURE.md

Database
→ DATABASE.md

API contract
→ API_SPEC.md

UI/UX
→ UI_UX_SPEC.md

Implementation status
→ FEATURE_STATUS.md

AI Agent không được thay thế documentation bằng suy đoán.

Nếu documentation và source code có sự khác biệt:

Documentation
      +
Source Code
      +
Tests
      ↓
Investigate conflict
      ↓
Report conflict
      ↓
Determine correct source
      ↓
Update documentation/status when verified

AI Agent không được âm thầm chọn một phía khi conflict có ảnh hưởng đến requirement, architecture hoặc business behavior.

4. Feature Status

docs/FEATURE_STATUS.md là tài liệu theo dõi trạng thái triển khai của các feature trong project.

Các trạng thái chuẩn:

TODO
IN_PROGRESS
DONE
BLOCKED

Ý nghĩa:

TODO
→ Chưa bắt đầu hoặc chưa có implementation đáng kể.

IN_PROGRESS
→ Đang được triển khai.

DONE
→ Đã implement, test và review/approve đầy đủ.

BLOCKED
→ Không thể tiếp tục do blocker chưa được giải quyết.

FEATURE_STATUS.md không phải là bằng chứng duy nhất về trạng thái implementation.

AI Agent phải đối chiếu:

FEATURE_STATUS.md
        +
Existing source code
        +
Tests

để xác định trạng thái thực tế.

Feature Status Rules
DONE

Nếu feature có trạng thái:

DONE

AI Agent không được tự ý xây dựng lại feature đó.

Phải:

Kiểm tra implementation hiện tại.
Xác định feature đã tồn tại ở đâu.
Xác định user đang yêu cầu:
Bug fix
Enhancement
Modification
Extension
New related feature
Reuse existing implementation khi phù hợp.

Nếu user muốn thay đổi feature đã DONE:

Treat as change request
        ↓
Analyze existing implementation
        ↓
SPEC
        ↓
PLAN when necessary
        ↓
TASK
        ↓
IMPLEMENT
        ↓
TEST
        ↓
REVIEW
IN_PROGRESS

Nếu feature đang:

IN_PROGRESS

AI Agent phải kiểm tra implementation hiện tại và tiếp tục từ trạng thái hiện có khi phù hợp.

Không được tạo implementation mới từ đầu nếu có thể tiếp tục từ code hiện tại.

BLOCKED

Nếu feature:

BLOCKED

AI Agent phải xác định blocker trước khi tiếp tục implementation.

Không được bỏ qua blocker bằng cách tự đưa ra một quyết định quan trọng chưa được phê duyệt.

TODO

Nếu feature:

TODO

AI Agent có thể bắt đầu workflow nếu requirement rõ và scope đã được phê duyệt.

DONE Rule

AI Agent không được đánh dấu feature là DONE chỉ vì code đã được viết.

Feature chỉ được đánh dấu:

DONE

sau khi:

IMPLEMENT
    ↓
TEST
    ↓
REVIEW
    ↓
APPROVE
    ↓
UPDATE FEATURE_STATUS.md
    ↓
DONE
5. Skill System

Project sử dụng các Skills:

spec
plan
task
implement
test
review

Vai trò:

spec
→ Understand and clarify requirements
plan
→ Design implementation approach
task
→ Break approved plan into executable tasks
implement
→ Implement approved tasks
test
→ Verify implementation
review
→ Review implementation against requirements and project rules

AGENTS.md định nghĩa:

Global Rules

SKILL.md định nghĩa:

Workflow Procedure

Nếu Skill và AGENTS.md có conflict:

AGENTS.md takes precedence.

Tuy nhiên, AI Agent không được dùng rule này để tự ý mở rộng scope hoặc bỏ qua approval.

6. Core Development Workflow

Trước khi bắt đầu work trên một feature, AI Agent phải kiểm tra:

docs/FEATURE_STATUS.md

Workflow chuẩn:

CHECK FEATURE STATUS
        ↓
      SPEC
        ↓
   SPEC APPROVAL
        ↓
      PLAN
        ↓
   PLAN APPROVAL
        ↓
      TASK
        ↓
   TASK APPROVAL
        ↓
    IMPLEMENT
        ↓
      TEST
        ↓
     REVIEW
        ↓
     APPROVE
        ↓
UPDATE FEATURE STATUS

Nếu review không approve:

REVIEW
   ↓
CHANGES_REQUIRED
   ↓
IMPLEMENT
   ↓
TEST
   ↓
REVIEW

Nếu phát hiện vấn đề về requirement hoặc design:

REVIEW / TEST
      ↓
Requirement / Design Issue
      ↓
SPEC or PLAN
      ↓
TASK
      ↓
IMPLEMENT
      ↓
TEST
      ↓
REVIEW

Không được bỏ qua các approval gate quan trọng chỉ để code nhanh hơn.

Small Task Exception

Với task nhỏ, local và ít rủi ro, AI Agent có thể sử dụng workflow đơn giản hơn nếu task không ảnh hưởng:

Project scope.
Architecture.
Database structure.
API contract.
Core business logic.
Authentication.
Authorization.
Security.

Nếu có nghi ngờ rằng task không còn là thay đổi nhỏ:

Do not guess.

Use the appropriate Skill workflow.
7. SPEC — Understand the Requirement

Trước khi code, AI Agent phải xác định:

User muốn giải quyết vấn đề gì?
Feature thuộc domain nào?
Feature đã nằm trong project scope chưa?
Feature ảnh hưởng Frontend hay Backend?
Feature ảnh hưởng Database không?
Feature ảnh hưởng API không?
Feature có ảnh hưởng authentication/authorization không?
Feature có ảnh hưởng business logic hiện tại không?
Có requirement nào chưa rõ không?
Có conflict với documentation hiện tại không?

AI Agent phải phân biệt:

Existing requirement

vs

New requirement

vs

Assumption

Không được biến assumption thành requirement chính thức.

Quy trình SPEC chi tiết được định nghĩa trong:

.agents/skills/spec/SKILL.md
8. Scope Check

Trước khi triển khai feature, AI Agent phải kiểm tra:

docs/PROJECT_OVERVIEW.md

Nếu feature đã nằm trong scope:

→ Continue analysis

Nếu feature chưa nằm trong scope:

→ Do not implement immediately
→ Explain that it is a scope change
→ Explain impact
→ Propose solution
→ Wait for approval

Không được tự ý mở rộng project chỉ vì feature:

"hay"
"thú vị"
"dễ làm"
"trông advanced"
9. Existing Code Check

AI Agent không được giả định codebase đang trống.

Trước khi tạo code mới:

Kiểm tra structure hiện tại.
Tìm code liên quan.
Tìm component/service/controller đã tồn tại.
Tìm reusable logic.
Kiểm tra naming convention hiện tại.
Kiểm tra dependency hiện tại.
Kiểm tra test hiện tại.

Ưu tiên:

Reuse existing code
        ↓
Extend existing code
        ↓
Refactor only when necessary
        ↓
Create new code when needed

Refactor chỉ được thực hiện khi:

nằm trong approved scope; hoặc
thực sự cần thiết để hoàn thành task một cách đúng đắn.

Không tạo duplicate implementation nếu project đã có logic tương tự.

10. PLAN

Sau khi requirement được xác định và SPEC đã được approve, AI Agent phải tạo PLAN trước khi code đối với task có mức độ phức tạp đáng kể.

PLAN nên mô tả:

1. What will change?
2. Which files will change?
3. Which files will be created?
4. Backend changes
5. Frontend changes
6. Database changes
7. API changes
8. Business logic changes
9. Testing strategy
10. Potential risks

Không code trước khi PLAN được approve đối với task có ảnh hưởng lớn đến:

Architecture.
Database.
API.
Authentication.
Authorization.
Core business logic.

Quy trình PLAN chi tiết được định nghĩa trong:

.agents/skills/plan/SKILL.md
11. TASK

Sau khi PLAN được approve, AI Agent chia PLAN thành các TASK nhỏ.

Ví dụ:

TASK 1
Create database migration.

TASK 2
Update Prisma model.

TASK 3
Implement repository/data access.

TASK 4
Implement service.

TASK 5
Implement controller.

TASK 6
Implement route.

TASK 7
Implement frontend service.

TASK 8
Implement UI.

TASK 9
Add relevant tests.

Các task trên chỉ là ví dụ.

Actual tasks phải được tạo theo:

Approved SPEC
        ↓
Approved PLAN
        ↓
Actual Project Architecture

Không mặc định rằng mọi feature đều cần migration, repository, service hoặc controller riêng.

Quy trình TASK chi tiết được định nghĩa trong:

.agents/skills/task/SKILL.md
12. IMPLEMENT — Implementation Rules

Khi implement:

Follow existing project structure.
Follow existing naming conventions.
Follow ARCHITECTURE.md.
Follow DATABASE.md.
Follow API_SPEC.md.
Follow UI_UX_SPEC.md.
Keep responsibilities separated.
Avoid unnecessary abstraction.
Avoid duplicate logic.
Keep functions/components reasonably small.
Write maintainable code.
Do not introduce unnecessary dependencies.

AI Agent phải ưu tiên:

Simple
→ Clear
→ Maintainable
→ Testable
→ Scalable when necessary

Không ưu tiên:

Complex
→ Over-engineered
→ Hard to understand
→ Hard to test

chỉ vì muốn sử dụng nhiều technology hơn.

Quy trình implementation chi tiết được định nghĩa trong:

.agents/skills/implement/SKILL.md
13. Backend Rules

Backend architecture:

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
Route

Chỉ:

Define endpoint.
Attach middleware.
Connect controller.

Không chứa complex business logic.

Middleware

Có thể xử lý:

Authentication.
Authorization.
Validation.
Error handling.
Logging.
Rate limiting khi cần.
Controller

Chịu trách nhiệm:

Receive HTTP request.
Extract input.
Call service.
Return HTTP response.

Không chứa complex business logic.

Service

Chứa:

Business logic.
Business rules.
Calculations.
Transactions.
External service orchestration.
Repository / Data Access

Chứa:

Database queries.
Prisma operations.
Data access logic.

Không chứa business rules nếu business rule có thể được đặt ở service.

Không bắt buộc phải tạo Repository cho mọi trường hợp nếu project architecture hoặc approved PLAN không yêu cầu.

14. Frontend Rules

Frontend architecture:

Page
  ↓
Component
  ↓
Hook / State
  ↓
Service
  ↓
Backend API

Frontend:

Không truy cập PostgreSQL trực tiếp.
Không chứa critical business logic.
Không tự quyết định authoritative XP.
Không tự quyết định Level.
Không tự quyết định Streak.
Không tự quyết định Achievement.
Không tự quyết định correct answer.
Không tự quyết định score.

Frontend có thể:

Validate input để cải thiện UX.
Format data.
Display data.
Handle UI state.
Handle loading/error states.

Backend vẫn là source of truth cho critical business behavior.

15. Database Change Rules

AI Agent không được tự ý:

Tạo table mới.
Xóa table.
Đổi tên table.
Đổi field quan trọng.
Đổi relationship.
Đổi constraint.
Đổi database engine.

nếu thay đổi đó ảnh hưởng architecture hoặc business model mà chưa được approve.

Nếu task cần database change:

Analyze
  ↓
Explain required schema change
  ↓
Explain affected tables
  ↓
Explain migration impact
  ↓
PLAN
  ↓
Approval
  ↓
Implement migration
  ↓
Test
  ↓
Review
  ↓
Update DATABASE.md when required

Không tạo database entity chỉ để:

"phòng trường hợp sau này cần"
16. API Change Rules

AI Agent phải kiểm tra:

docs/API_SPEC.md

trước khi tạo hoặc sửa endpoint.

Nếu endpoint đã tồn tại:

→ Reuse existing endpoint when appropriate

Không tạo duplicate endpoint.

Nếu API contract thay đổi:

API implementation
        +
API_SPEC.md

phải được cập nhật đồng bộ.

API contract changes require appropriate approval before implementation.

17. Business Logic Rules

Business-critical logic phải nằm ở Backend.

Đặc biệt:

Quiz
Learning Progress
Spaced Repetition
XP
Level
Streak
Achievement
Vocabulary Set Ownership
Vocabulary Set Visibility
Community Permissions

AI Agent không được chuyển critical business logic sang Frontend chỉ để implementation đơn giản hơn.

18. Authentication and Authorization Rules

Project hiện tại chỉ có:

USER
ADMIN

AI Agent không được tự ý thêm:

MODERATOR
STAFF
TEACHER
PREMIUM
FREE

hoặc role khác.

Authorization phải được enforce ở Backend.

Frontend role checking chỉ nhằm:

UI
Navigation
UX

không phải security boundary.

19. Quiz Rules

Project hiện tại gồm:

VI_TO_ENGLISH
MISSING_LETTER

AI Agent không được tự ý thêm quiz type mới nếu chưa được approve.

Per-character feedback:

Correct character
→ correct

Incorrect character
→ incorrect

được tính runtime theo approved behavior.

Không tạo database table riêng chỉ để lưu character feedback nếu không có approved requirement.

20. Pronunciation Rules

Pronunciation là một learning module/activity riêng.

Không coi pronunciation là quiz type.

Architecture:

Vocabulary
    ↓
Pronunciation Model
    ↓
User listens
    ↓
User speaks
    ↓
Speech Recognition / Pronunciation Evaluation
    ↓
Result
    ↓
Feedback / Retry

Pronunciation Practice là hoạt động học riêng trong learning flow.

Flashcard sử dụng model/system pronunciation.

Pronunciation Practice cho phép user nghe mẫu, nói và nhận kết quả/feedback.

Công nghệ và scoring/evaluation mechanism phải được quyết định trong PLAN khi implementation bắt đầu.

AI Agent không được tự ý biến pronunciation thành:

QUIZ_TYPE

trừ khi scope được thay đổi rõ ràng và approved.

21. Vocabulary Set Rules
System Set

Admin-created system sets:

is_public = true

Users có thể:

View.
Learn.
Copy nếu business rule cho phép.
User Set

User-created sets:

is_public = false

Owner có thể:

View.
Learn.
Edit.
Delete.

User không được trực tiếp chuyển:

Private → Public
Community Sharing

User có thể share set thông qua Community.

Sharing không thay đổi:

is_public
Copy

Khi User B copy set của User A:

Create NEW set

owner_id = User B
is_public = false

Original set không bị thay đổi.

Copy không cấp edit permission đối với original set.

22. Gamification Rules

Gamification gồm:

XP
Level
Streak
Achievement

AI Agent không được tự ý tạo:

XP transaction history
Leaderboard
Ranking system

nếu chưa được scope.

Backend chịu trách nhiệm authoritative calculation.

23. Community Rules

Community v1 gồm:

Posts
Comments
Vocabulary Set Sharing

Không tự ý thêm:

Likes
Reactions
Followers
Friends
Direct Messages
Chat
Leaderboard

Nếu muốn thêm feature community:

Scope analysis
→ Impact analysis
→ SPEC
→ PLAN
→ Approval
→ TASK
→ Implementation
24. AI Rules

AI functionality là:

OPTIONAL

AI không phải mandatory dependency của project.

AI Agent không được tự ý:

Thêm AI service chỉ để làm project "xịn hơn".
Thêm AI API key.
Thêm AI infrastructure.
Biến AI thành requirement bắt buộc.

Nếu AI có giá trị rõ ràng cho feature:

Explain use case
→ Explain benefit
→ Explain cost / complexity
→ Propose optional implementation
→ Wait for approval
25. External Services Rules

External services có thể được sử dụng cho:

Pronunciation Audio
Speech Recognition
Pronunciation Evaluation
AI-assisted Learning

External service phải được gọi từ Backend.

Secret keys:

Never expose in Frontend
Never commit to Git

Sử dụng environment variables.

Không thêm external service nếu native implementation hoặc existing dependency đã đủ đáp ứng requirement.

External service mới có ảnh hưởng đáng kể đến architecture, cost, security hoặc deployment phải được approve trước.

26. Dependency Rules

Trước khi thêm dependency:

AI Agent phải kiểm tra:

Project đã có package giải quyết vấn đề chưa?
Native solution có đủ không?
Dependency có thực sự cần không?
Dependency có làm architecture phức tạp hơn không?
Dependency có ảnh hưởng deployment không?
Dependency có security concern không?

Không thêm package chỉ vì:

"It is easier."

Ưu tiên dependency tối thiểu nhưng hợp lý.

27. Security Rules

AI Agent phải luôn chú ý:

Password hashing.
Authentication.
Authorization.
Ownership.
Input validation.
SQL injection protection thông qua ORM/parameterized queries.
XSS prevention.
CSRF nếu authentication mechanism yêu cầu.
Rate limiting khi cần.
Secrets management.
HTTPS production.
Secure error handling.

Không log:

Password
Password hash
Access token
Secret API key

Không commit secrets vào Git.

28. Testing Rules

Mỗi feature quan trọng phải có testing phù hợp.

Đặc biệt phải test khi liên quan:

Authentication
Authorization
Quiz
Learning Progress
Spaced Repetition
Streak
XP
Achievement
Vocabulary Set Ownership
Vocabulary Set Copy
Community Permissions

Khi sửa existing behavior:

Run existing tests
        ↓
Add/update relevant tests
        ↓
Implement
        ↓
Run tests again

Không xóa test chỉ vì test đang fail.

Nếu behavior được thay đổi có chủ đích:

Explain why
Update implementation
Update test

Quy trình test chi tiết được định nghĩa trong:

.agents/skills/test/SKILL.md
29. Verification

Sau implementation, AI Agent phải kiểm tra khi applicable:

Does the code run?

Does the application build?

Do tests pass?

Does lint pass?

Does the API behave correctly?

Does the UI behave correctly?

Does the database migration work?

Does authorization work?

Does the implementation match documentation?

Nếu không thể chạy một command:

Do not pretend it passed.

Phải báo rõ:

NOT RUN

hoặc:

Could not verify because...

Verification thuộc TEST và REVIEW.

AI Agent không được đánh dấu feature là DONE chỉ vì code đã được viết.

Feature chỉ nên được đánh dấu DONE sau:

Implementation
     ↓
Test
     ↓
Review
     ↓
Approve
     ↓
Update FEATURE_STATUS.md
30. REVIEW

Sau khi test, AI Agent phải review implementation.

Review checklist:

Scope
Does implementation stay within scope?
Architecture
Does implementation follow ARCHITECTURE.md?
Database
Does implementation follow DATABASE.md?
API
Does implementation follow API_SPEC.md?
UI/UX
Does implementation follow UI_UX_SPEC.md?
Security
Are authentication and authorization correct?
Code Quality
Is there duplicated logic?

Is there unnecessary abstraction?

Is the code readable?
Testing
Are important paths covered?
Documentation
Does documentation need updating?

Quy trình review chi tiết được định nghĩa trong:

.agents/skills/review/SKILL.md
31. Documentation Synchronization

Nếu implementation làm thay đổi:

Business scope
Architecture
Database
API contract
UI/UX behavior

thì documentation tương ứng phải được cập nhật.

Ví dụ:

Database changed

Update:

docs/DATABASE.md
API changed

Update:

docs/API_SPEC.md
Architecture changed

Update:

docs/ARCHITECTURE.md
Scope changed

Update:

docs/PROJECT_OVERVIEW.md
UI/UX changed

Update:

docs/UI_UX_SPEC.md
Feature status changed

Update:

docs/FEATURE_STATUS.md

Documentation chỉ được cập nhật để phản ánh thay đổi đã được xác nhận/approved.

Không dùng documentation update để hợp thức hóa một thay đổi chưa được approve.

32. Handling Ambiguity

Nếu requirement chưa rõ:

AI Agent không được tự ý chọn một interpretation có ảnh hưởng lớn.

Phải:

Identify ambiguity
        ↓
Explain possible interpretations
        ↓
Explain impact
        ↓
Recommend one option
        ↓
Ask for decision when necessary

Tuy nhiên không cần hỏi những thứ nhỏ có thể quyết định an toàn theo convention hiện tại.

Mục tiêu:

Avoid unnecessary questions

+

Avoid dangerous assumptions
33. Handling Conflicts

Nếu documentation conflict:

Do not silently choose one.

AI Agent phải:

Phát hiện conflict.
Báo conflict.
Phân tích ảnh hưởng.
Xác định tài liệu/domain bị ảnh hưởng.
Đề xuất cách giải quyết.
Chờ quyết định nếu cần thay đổi scope/architecture/business rules.

Nếu conflict chỉ là implementation documentation đã lỗi thời và có đủ evidence để xác định trạng thái thực tế, AI Agent có thể đề xuất documentation update.

34. Architecture Change Policy

AI Agent không được tự ý thay đổi:

Frontend framework
Backend framework
Database engine
Authentication architecture
API architecture
Deployment architecture
Role model
Core domain model

Nếu architecture hiện tại gây vấn đề:

Problem
→ Impact
→ Options
→ Recommendation
→ Approval
→ Documentation update
→ Implementation
→ Test
→ Review

Không âm thầm refactor architecture lớn trong một task nhỏ.

35. Avoid Overengineering

Không xây dựng những thứ project chưa cần.

Ví dụ không tự ý thêm:

Microservices
Event-driven architecture
Message queues
Redis
Kubernetes
Complex caching
Complex permission systems
Advanced observability stack
AI orchestration layer

chỉ để làm project có vẻ "enterprise".

Project ưu tiên:

Simple
Clear
Maintainable
Testable
36. Minimal Change Principle

Khi thực hiện task:

Thay đổi ít nhất lượng code cần thiết để giải quyết requirement một cách đúng đắn.

Không tự ý:

Refactor toàn project.
Rename hàng loạt file.
Thay đổi framework.
Thay đổi architecture.
Thay đổi database.
Thay đổi API không liên quan.

trừ khi task yêu cầu hoặc implementation thực sự cần thiết.

37. Git Rules

AI Agent phải giữ thay đổi có phạm vi rõ ràng.

Một task nên tập trung vào:

One logical change

Tránh change chứa:

Feature

+

Unrelated refactor

+

Formatting entire project

+

Dependency changes unrelated to feature

Nếu có Git commit message, nên sử dụng format rõ ràng:

feat: add vocabulary learning session

fix: validate quiz answer

test: add quiz service tests

refactor: simplify vocabulary service

docs: update API specification

Không yêu cầu commit nếu user chưa yêu cầu hoặc workflow hiện tại không cần.

38. Do Not Hide Problems

AI Agent phải báo rõ:

Test fail.
Build fail.
Migration fail.
API mismatch.
Missing requirement.
External service unavailable.
Configuration missing.
Architecture conflict.
Security concern.
Documentation conflict.

Không được:

Hide error
Pretend success
Silently ignore failure
39. Communication Format

Khi nhận task có mức độ đáng kể, AI Agent nên phản hồi:

## Understanding

Tóm tắt requirement.

## Scope Check

Feature có nằm trong scope hay không.

## Feature Status

Feature hiện đang ở trạng thái nào trong docs/FEATURE_STATUS.md.

## Existing Implementation

Có implementation nào đã tồn tại không.

## Impact

Frontend:
...

Backend:
...

Database:
...

API:
...

UI/UX:
...

## Risks / Ambiguities

...

## Next Stage

SPEC / PLAN / TASK / IMPLEMENT / TEST / REVIEW

## Approval

Nếu task cần approval, chờ approval trước khi chuyển sang stage tiếp theo.

Sau implementation:

## Implemented

...

## Tests

...

## Review

...

## Documentation

...

## Feature Status

...
40. When Approval Is Required

AI Agent phải chờ approval trước khi thực hiện nếu task:

Thay đổi project scope.
Thêm role.
Thêm quiz type.
Thêm database entity quan trọng.
Thay đổi database architecture.
Thay đổi authentication architecture.
Thay đổi API architecture.
Thay đổi deployment architecture.
Thêm external service quan trọng.
Biến AI thành mandatory dependency.
Thay đổi ownership/visibility rules.
Thay đổi core business logic.
Thay đổi major UI/UX flow.
Thay đổi pronunciation architecture/evaluation approach theo hướng có ảnh hưởng đáng kể.

Các thay đổi nhỏ, local và không ảnh hưởng contract có thể được implementation trực tiếp nếu:

requirement đã rõ;
scope đã rõ;
không cần thay đổi architecture;
không cần thay đổi database/API contract;
không ảnh hưởng critical business logic;
không tạo security risk.

Khi không chắc task có cần approval hay không:

Prefer asking before making a significant decision.
41. Final Agent Rules

AI Agent phải luôn ghi nhớ:

1. Read before changing.

2. Understand before coding.

3. Check scope before implementing.

4. Check FEATURE_STATUS.md before implementing a feature.

5. Verify existing implementation before creating new code.

6. Reuse before creating.

7. Plan before coding complex tasks.

8. Obtain required approval before implementation.

9. Backend is the source of truth for critical business logic.

10. Security is enforced by Backend.

11. Database changes require careful consideration.

12. API changes must stay synchronized with API_SPEC.md.

13. UI changes must follow UI_UX_SPEC.md.

14. Tests are part of the development workflow.

15. Documentation must stay synchronized.

16. Update FEATURE_STATUS.md when verified implementation status changes.

17. Do not mark a feature as DONE before Test + Review + Approve.

18. Do not rebuild completed features without a clear change request.

19. Continue existing implementations when a feature is IN_PROGRESS.

20. Do not hide problems.

21. Do not guess important business decisions.

22. Do not add unnecessary features.

23. Do not over-engineer.

24. Use the appropriate Skill for the current workflow.

25. AGENTS.md rules take precedence over Skill instructions.

26. Never silently change approved scope, architecture, API, database or business rules.

27. When uncertain about an important decision:
    Analyze.
    Explain.
    Propose.
    Ask when necessary.
Core Development Workflow
CHECK FEATURE STATUS
        ↓
      SPEC
        ↓
   SPEC APPROVAL
        ↓
      PLAN
        ↓
   PLAN APPROVAL
        ↓
      TASK
        ↓
   TASK APPROVAL
        ↓
    IMPLEMENT
        ↓
      TEST
        ↓
     REVIEW
        ↓
     APPROVE
        ↓
UPDATE FEATURE STATUS
        ↓
      DONE

If implementation problems are found:

REVIEW
   ↓
CHANGES_REQUIRED
   ↓
IMPLEMENT
   ↓
TEST
   ↓
REVIEW

If requirement/design problems are found:

TEST / REVIEW
      ↓
SPEC or PLAN
      ↓
TASK
      ↓
IMPLEMENT
      ↓
TEST
      ↓
REVIEW
Core Project Philosophy
Simple
   ↓
Clear
   ↓
Maintainable
   ↓
Testable
   ↓
Scalable when necessary

The AI Agent is an implementation assistant, not the product owner.

Important product, scope, architecture and business decisions belong to the project developer.

When in doubt:

Do not guess.

Analyze.

Explain.

Propose.

Ask when necessary.