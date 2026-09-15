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
│   └── FEATURE_STATUS.md
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
```

AI Agent phải xem các tài liệu trong `docs/` là nguồn thông tin chính thức về hệ thống.

---

# 2. Role of AGENTS.md

`AGENTS.md` định nghĩa các **global rules, constraints và guardrails** mà AI Agent phải tuân thủ trong toàn bộ project.

File này định nghĩa:

- Cách AI Agent làm việc.
- Cách AI Agent sử dụng project documentation.
- Quy trình phát triển.
- Quy tắc scope.
- Quy tắc architecture.
- Quy tắc database.
- Quy tắc API.
- Quy tắc security.
- Quy tắc testing.
- Quy tắc documentation.
- Những điều AI Agent không được tự ý làm.

Business rules chi tiết phải được lấy từ các tài liệu trong `docs/`.

`AGENTS.md` không thay thế `SKILL.md` và không chứa toàn bộ implementation procedure của từng skill.

---

# 3. Source of Truth

AI Agent phải tham khảo project documentation:

```text
PROJECT_OVERVIEW.md
        ↓
ARCHITECTURE.md
        ↓
DATABASE.md
        ↓
API_SPEC.md
```

Vai trò của từng tài liệu:

```text
PROJECT_OVERVIEW.md

→ What the system does
→ Business scope
→ Features
→ Roles
→ Product rules
```

```text
ARCHITECTURE.md

→ How the system is structured
→ Frontend architecture
→ Backend architecture
→ Services
→ Deployment
→ Technical boundaries
```

```text
DATABASE.md

→ How data is stored
→ Tables
→ Fields
→ Relationships
→ Constraints
→ Indexes
```

```text
API_SPEC.md

→ How Frontend and Backend communicate
→ Endpoints
→ Request
→ Response
→ Authorization
→ API rules
```

AI Agent không được thay thế documentation bằng suy đoán.

Nếu documentation và source code có sự khác biệt, AI Agent phải phát hiện và báo cáo sự khác biệt thay vì âm thầm chọn một phía.

---

# 4. Feature Status

`docs/FEATURE_STATUS.md` là tài liệu theo dõi trạng thái triển khai của các feature trong project.

Mục đích của file này là giúp AI Agent biết:

- Feature nào chưa bắt đầu.
- Feature nào đang được triển khai.
- Feature nào đã được implement.
- Feature nào đã được test.
- Feature nào đã hoàn thành.
- Feature nào đang bị block.
- Feature nào cần tiếp tục phát triển.

Phân biệt:

```text
docs/PROJECT_OVERVIEW.md
→ What the system should have

docs/ARCHITECTURE.md
→ How the system is structured

docs/DATABASE.md
→ How data is structured

docs/API_SPEC.md
→ How Frontend and Backend communicate

docs/FEATURE_STATUS.md
→ What has actually been implemented
```

AI Agent phải kiểm tra `docs/FEATURE_STATUS.md` trước khi bắt đầu implementation của một feature.

Tuy nhiên, `FEATURE_STATUS.md` không được xem là bằng chứng duy nhất cho trạng thái implementation.

AI Agent phải đối chiếu:

```text
FEATURE_STATUS.md
        +
Existing source code
        +
Tests
```

để xác định trạng thái thực tế của feature.

## Feature Status Rules

Nếu feature có trạng thái:

```text
DONE
```

AI Agent không được tự ý xây dựng lại feature đó.

AI Agent phải:

1. Kiểm tra implementation hiện tại.
2. Xác định feature đã tồn tại ở đâu.
3. Xác định user đang yêu cầu:
   - Bug fix
   - Enhancement
   - Modification
   - Extension
   - New related feature

4. Reuse existing implementation khi phù hợp.

Nếu user muốn thay đổi hoặc mở rộng feature đã `DONE`:

```text
→ Treat it as a change request
→ Analyze the existing implementation
→ Run SPEC
→ Create PLAN when necessary
→ Implement only the required changes
```

Nếu feature đang:

```text
IN_PROGRESS
```

AI Agent phải kiểm tra implementation hiện tại và tiếp tục từ trạng thái hiện có khi phù hợp.

Không được tạo implementation mới từ đầu nếu có thể tiếp tục từ code hiện tại.

Nếu feature:

```text
BLOCKED
```

AI Agent phải xác định nguyên nhân block trước khi tiếp tục implementation.

Nếu feature:

```text
TODO
```

AI Agent có thể bắt đầu workflow nếu requirement đã rõ và scope đã được phê duyệt.

Nếu `FEATURE_STATUS.md` không khớp với source code thực tế:

```text
FEATURE_STATUS.md
        +
Source Code
        +
Tests
        ↓
Investigate conflict
        ↓
Update status when verified
```

Không được mù quáng tin status hoặc source code riêng lẻ.

`FEATURE_STATUS.md` phải phản ánh trạng thái implementation thực tế của project.

---

# 5. Skill System

Project sử dụng Skills để chuẩn hóa cách AI Agent thực hiện từng loại công việc.

Skills hiện tại:

```text
spec
plan
task
implement
test
review
```

Vai trò:

```text
spec

→ Understand and clarify requirements
```

```text
plan

→ Design implementation approach
```

```text
task

→ Break plan into small executable tasks
```

```text
implement

→ Implement approved tasks
```

```text
test

→ Verify implementation
```

```text
review

→ Review implementation against requirements and project rules
```

AI Agent phải sử dụng Skill phù hợp khi task tương ứng có mức độ đáng kể.

`AGENTS.md` định nghĩa **global rules**.

`SKILL.md` định nghĩa **procedure của từng workflow**.

Nếu Skill và `AGENTS.md` có conflict:

```text
AGENTS.md takes precedence.
```

Nếu Skill yêu cầu hành động có thể thay đổi scope, architecture, database, API contract hoặc business rules, các approval rules trong `AGENTS.md` vẫn được áp dụng.

---

# 6. Core Development Workflow

Before starting work on a feature, AI Agent must check:

```text
docs/FEATURE_STATUS.md
```

Core development workflow:

```text
CHECK FEATURE STATUS
        ↓
      SPEC
        ↓
      PLAN
        ↓
      TASK
        ↓
    IMPLEMENT
        ↓
      TEST
        ↓
     REVIEW
        ↓
UPDATE FEATURE STATUS
```

`FEATURE_STATUS.md` is a project tracking document, not a development Skill.

AI Agent must:

1. Check feature status before starting work.
2. Verify the existing implementation when necessary.
3. Follow the appropriate Skill for each workflow stage.
4. Update `docs/FEATURE_STATUS.md` when the implementation status changes.
5. Mark a feature as `DONE` only after sufficient implementation, testing and review.

Không được bỏ qua các bước quan trọng chỉ để code nhanh hơn.

Với task nhỏ, AI Agent có thể thực hiện workflow ở mức đơn giản hơn nếu không ảnh hưởng đến:

- Project scope
- Architecture
- Database
- API contract
- Core business logic
- Security

Task có ảnh hưởng lớn phải thực hiện đầy đủ workflow.

---

# 7. SPEC — Understand the Requirement

Trước khi code, AI Agent phải xác định:

1. User muốn giải quyết vấn đề gì?
2. Feature thuộc domain nào?
3. Feature đã nằm trong project scope chưa?
4. Feature ảnh hưởng Frontend hay Backend?
5. Feature ảnh hưởng Database không?
6. Feature ảnh hưởng API không?
7. Feature có ảnh hưởng authentication/authorization không?
8. Feature có ảnh hưởng business logic hiện tại không?
9. Có requirement nào chưa rõ không?
10. Có conflict với documentation hiện tại không?

AI Agent phải phân biệt:

```text
Existing requirement

vs

New requirement

vs

Assumption
```

Không được biến assumption thành requirement chính thức.

Quy trình SPEC chi tiết được định nghĩa trong:

```text
.agents/skills/spec/SKILL.md
```

---

# 8. Scope Check

Trước khi triển khai feature, AI Agent phải kiểm tra:

```text
docs/PROJECT_OVERVIEW.md
```

Nếu feature đã nằm trong scope:

```text
→ Continue analysis
```

Nếu feature chưa nằm trong scope:

```text
→ Do not implement immediately
→ Explain that it is a scope change
→ Explain impact
→ Propose solution
→ Wait for approval
```

Không được tự ý mở rộng project chỉ vì feature đó "hay" hoặc "dễ làm".

---

# 9. Existing Code Check

AI Agent không được giả định codebase đang trống.

Trước khi tạo code mới:

1. Kiểm tra structure hiện tại.
2. Tìm code liên quan.
3. Tìm component/service/controller đã tồn tại.
4. Tìm reusable logic.
5. Kiểm tra naming convention hiện tại.
6. Kiểm tra dependency hiện tại.
7. Kiểm tra test hiện tại.

Ưu tiên:

```text
Reuse existing code
        ↓
Refactor existing code if necessary
        ↓
Create new code when needed
```

Không tạo duplicate implementation nếu project đã có logic tương tự.

---

# 10. PLAN

Sau khi phân tích requirement, AI Agent phải tạo PLAN trước khi code đối với task có mức độ phức tạp đáng kể.

PLAN nên mô tả:

```text
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
```

Không code trước khi PLAN được thống nhất đối với task có ảnh hưởng lớn đến architecture, database hoặc API.

Quy trình PLAN chi tiết được định nghĩa trong:

```text
.agents/skills/plan/SKILL.md
```

---

# 11. TASK

Sau khi PLAN được chấp nhận, AI Agent chia PLAN thành các TASK nhỏ.

Ví dụ:

```text
TASK 1

Create database migration.

TASK 2

Create Prisma model.

TASK 3

Implement repository.

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

Write tests.

TASK 10

Run review.
```

Ưu tiên task nhỏ, có thể kiểm tra độc lập.

Quy trình TASK chi tiết được định nghĩa trong:

```text
.agents/skills/task/SKILL.md
```

---

# 12. IMPLEMENT — Implementation Rules

Khi implement:

- Follow existing project structure.
- Follow existing naming conventions.
- Follow `ARCHITECTURE.md`.
- Follow `DATABASE.md`.
- Follow `API_SPEC.md`.
- Keep responsibilities separated.
- Avoid unnecessary abstraction.
- Avoid duplicate logic.
- Keep functions/components reasonably small.
- Write maintainable code.
- Do not introduce unnecessary dependencies.

AI Agent phải ưu tiên:

```text
Simple
→ Clear
→ Maintainable
→ Testable
→ Scalable when necessary
```

Không ưu tiên:

```text
Complex
→ Over-engineered
→ Hard to understand
→ Hard to test
```

chỉ vì muốn sử dụng nhiều technology hơn.

Quy trình implementation chi tiết được định nghĩa trong:

```text
.agents/skills/implement/SKILL.md
```

---

# 13. Backend Rules

Backend architecture:

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

### Route

Chỉ:

- Define endpoint.
- Attach middleware.
- Connect controller.

Không chứa complex business logic.

### Middleware

Có thể xử lý:

- Authentication.
- Authorization.
- Validation.
- Error handling.
- Logging.
- Rate limiting khi cần.

### Controller

Chịu trách nhiệm:

- Receive HTTP request.
- Extract input.
- Call service.
- Return HTTP response.

Không chứa complex business logic.

### Service

Chứa:

- Business logic.
- Business rules.
- Calculations.
- Transactions.
- External service orchestration.

### Repository / Data Access

Chứa:

- Database queries.
- Prisma operations.
- Data access logic.

Không chứa business rules.

---

# 14. Frontend Rules

Frontend architecture:

```text
Page
  ↓
Component
  ↓
Hook / State
  ↓
Service
  ↓
Backend API
```

Frontend:

- Không truy cập PostgreSQL trực tiếp.
- Không chứa critical business logic.
- Không tự quyết định authoritative XP.
- Không tự quyết định Level.
- Không tự quyết định Streak.
- Không tự quyết định Achievement.
- Không tự quyết định correct answer.
- Không tự quyết định score.

Frontend có thể:

- Validate input để cải thiện UX.
- Format data.
- Display data.
- Handle UI state.
- Handle loading/error states.

Backend vẫn là source of truth.

---

# 15. Database Change Rules

AI Agent không được tự ý:

- Tạo table mới.
- Xóa table.
- Đổi tên table.
- Đổi field quan trọng.
- Đổi relationship.
- Đổi constraint.
- Đổi database engine.

nếu thay đổi đó ảnh hưởng architecture hoặc business model mà chưa được phê duyệt.

Nếu task cần database change:

```text
Analyze
  ↓
Explain required schema change
  ↓
Explain affected tables
  ↓
Explain migration impact
  ↓
Propose PLAN
  ↓
Get approval when necessary
  ↓
Implement migration
  ↓
Update DATABASE.md
```

Không tạo database entity chỉ để "phòng trường hợp sau này cần".

---

# 16. API Change Rules

AI Agent phải kiểm tra:

```text
docs/API_SPEC.md
```

trước khi tạo hoặc sửa endpoint.

Nếu endpoint đã tồn tại:

```text
→ Reuse existing endpoint when appropriate
```

Không tạo duplicate endpoint.

Nếu API contract thay đổi:

```text
API implementation
        +
API_SPEC.md
```

phải được cập nhật đồng bộ.

---

# 17. Business Logic Rules

Business logic phải nằm ở Backend.

Đặc biệt:

```text
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
```

AI Agent không được chuyển critical business logic sang Frontend chỉ để implementation đơn giản hơn.

---

# 18. Authentication and Authorization Rules

Project hiện tại chỉ có:

```text
USER
ADMIN
```

AI Agent không được tự ý thêm:

```text
MODERATOR

STAFF

TEACHER

PREMIUM

FREE
```

hoặc role khác.

Authorization phải được enforce ở Backend.

Frontend role checking chỉ nhằm:

```text
UI
Navigation
UX
```

không phải security boundary.

---

# 19. Quiz Rules

Project hiện tại gồm:

```text
VI_TO_ENGLISH

MISSING_LETTER
```

AI Agent không được tự ý thêm quiz type mới nếu chưa được phê duyệt.

Per-character feedback:

```text
Correct character
→ correct

Incorrect character
→ incorrect
```

được tính runtime.

Không tạo database table riêng chỉ để lưu character feedback.

---

# 20. Pronunciation Rules

Pronunciation là một learning module riêng.

Không coi pronunciation là quiz type.

Architecture:

```text
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
```

Pronunciation evaluation có thể sử dụng external service.

AI Agent không được biến pronunciation thành:

```text
QUIZ_TYPE
```

trừ khi scope được thay đổi rõ ràng.

---

# 21. Vocabulary Set Rules

### System Set

Admin-created system sets:

```text
is_public = true
```

Users có thể:

- View.
- Learn.
- Copy nếu business rule cho phép.

### User Set

User-created sets:

```text
is_public = false
```

Owner có thể:

- View.
- Learn.
- Edit.
- Delete.

User không được trực tiếp chuyển:

```text
Private → Public
```

### Community Sharing

User có thể share set thông qua Community.

Sharing không thay đổi:

```text
is_public
```

### Copy

Khi User B copy set của User A:

```text
Create NEW set

owner_id = User B

is_public = false
```

Original set không bị thay đổi.

Copy không cấp edit permission đối với original set.

---

# 22. Gamification Rules

Gamification gồm:

```text
XP
Level
Streak
Achievement
```

AI Agent không được tự ý tạo:

```text
XP transaction history

Leaderboard

Ranking system
```

nếu chưa được scope.

Backend chịu trách nhiệm authoritative calculation.

---

# 23. Community Rules

Community v1 gồm:

```text
Posts

Comments

Vocabulary Set Sharing
```

Không tự ý thêm:

```text
Likes

Reactions

Followers

Friends

Direct Messages

Chat

Leaderboard
```

Nếu muốn thêm feature community:

```text
Scope analysis
→ Impact analysis
→ PLAN
→ Approval
→ Implementation
```

---

# 24. AI Rules

AI functionality là:

```text
OPTIONAL
```

AI không phải mandatory dependency của project.

AI Agent không được tự ý:

- Thêm AI service chỉ để làm project "xịn hơn".
- Thêm AI API key.
- Thêm AI infrastructure.
- Biến AI thành requirement bắt buộc.

Nếu AI có giá trị rõ ràng cho feature:

```text
Explain use case
→ Explain benefit
→ Explain cost/complexity
→ Propose optional implementation
```

Sau đó chờ quyết định.

---

# 25. External Services Rules

External services có thể được sử dụng cho:

```text
Pronunciation Audio

Speech Recognition

Pronunciation Evaluation

AI-assisted Learning
```

External service phải được gọi từ Backend.

Secret keys:

```text
Never expose in Frontend

Never commit to Git
```

Sử dụng environment variables.

Không thêm external service nếu native implementation hoặc existing dependency đã đủ đáp ứng requirement.

---

# 26. Dependency Rules

Trước khi thêm dependency:

AI Agent phải kiểm tra:

1. Project đã có package giải quyết vấn đề chưa?
2. Native solution có đủ không?
3. Dependency có thực sự cần không?
4. Dependency có làm architecture phức tạp hơn không?
5. Dependency có ảnh hưởng deployment không?
6. Dependency có security concern không?

Không thêm package chỉ vì:

```text
"It is easier."
```

Ưu tiên dependency tối thiểu nhưng hợp lý.

---

# 27. Security Rules

AI Agent phải luôn chú ý:

- Password hashing.
- Authentication.
- Authorization.
- Ownership.
- Input validation.
- SQL injection protection thông qua ORM/parameterized queries.
- XSS prevention.
- CSRF nếu authentication mechanism yêu cầu.
- Rate limiting khi cần.
- Secrets management.
- HTTPS production.
- Secure error handling.

Không log:

```text
Password

Password hash

Access token

Secret API key
```

---

# 28. Testing Rules

Mỗi feature quan trọng phải có testing phù hợp.

Đặc biệt phải test:

```text
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
```

Khi sửa existing behavior:

```text
Run existing tests
        ↓
Add/update relevant tests
        ↓
Implement
        ↓
Run tests again
```

Không xóa test chỉ vì test đang fail.

Nếu behavior được thay đổi có chủ đích:

```text
Explain why
Update implementation
Update test
```

Quy trình test chi tiết được định nghĩa trong:

```text
.agents/skills/test/SKILL.md
```

---

# 29. Verification

Sau implementation, AI Agent phải kiểm tra:

```text
Does the code compile?

Does the application build?

Do tests pass?

Does lint pass?

Does the API behave correctly?

Does the UI behave correctly?

Does the database migration work?

Does authorization work?

Does the implementation match documentation?
```

Nếu không thể chạy một command:

```text
Do not pretend it passed.
```

Phải báo rõ:

```text
Not executed
```

hoặc:

```text
Could not verify because...
```

Verification is part of TEST and REVIEW.

AI Agent không được đánh dấu feature là `DONE` trong `docs/FEATURE_STATUS.md` chỉ vì code đã được viết.

Feature chỉ nên được đánh dấu `DONE` sau khi:

```text
Implementation
     ↓
Test
     ↓
Review
     ↓
Approve
     ↓
DONE
```

---

# 30. REVIEW

Sau khi test, AI Agent phải review implementation.

Review checklist:

### Scope

```text
Does implementation stay within scope?
```

### Architecture

```text
Does implementation follow ARCHITECTURE.md?
```

### Database

```text
Does implementation follow DATABASE.md?
```

### API

```text
Does implementation follow API_SPEC.md?
```

### Security

```text
Are authentication and authorization correct?
```

### Code Quality

```text
Is there duplicated logic?

Is there unnecessary abstraction?

Is the code readable?
```

### Testing

```text
Are important paths covered?
```

### Documentation

```text
Does documentation need updating?
```

Quy trình review chi tiết được định nghĩa trong:

```text
.agents/skills/review/SKILL.md
```

---

# 31. Documentation Synchronization

Nếu implementation làm thay đổi:

```text
Business scope

Architecture

Database

API contract
```

thì documentation tương ứng phải được cập nhật.

Ví dụ:

### Database changed

Update:

```text
docs/DATABASE.md
```

### API changed

Update:

```text
docs/API_SPEC.md
```

### Architecture changed

Update:

```text
docs/ARCHITECTURE.md
```

### Scope changed

Update:

```text
docs/PROJECT_OVERVIEW.md
```

### Feature status changed

Update:

```text
docs/FEATURE_STATUS.md
```

`FEATURE_STATUS.md` phải phản ánh trạng thái implementation thực tế.

Không để code và documentation lệch nhau.

---

# 32. Handling Ambiguity

Nếu requirement chưa rõ:

AI Agent không được tự ý chọn một interpretation có ảnh hưởng lớn.

Phải:

```text
Identify ambiguity
        ↓
Explain possible interpretations
        ↓
Explain impact
        ↓
Recommend one option
        ↓
Ask for decision when necessary
```

Tuy nhiên không cần hỏi những thứ nhỏ có thể quyết định an toàn theo convention hiện tại.

Mục tiêu:

```text
Avoid unnecessary questions

+

Avoid dangerous assumptions
```

---

# 33. Handling Conflicts

Nếu documentation conflict:

```text
Do not silently choose one.
```

AI Agent phải:

1. Phát hiện conflict.
2. Báo conflict.
3. Phân tích ảnh hưởng.
4. Đề xuất cách giải quyết.
5. Chờ quyết định nếu cần thay đổi scope/architecture.

---

# 34. Architecture Change Policy

AI Agent không được tự ý thay đổi:

```text
Frontend framework

Backend framework

Database engine

Authentication architecture

API architecture

Deployment architecture

Role model

Core domain model
```

Nếu architecture hiện tại gây vấn đề:

```text
Problem
→ Impact
→ Options
→ Recommendation
→ Approval
→ Documentation update
→ Implementation
```

Không âm thầm refactor architecture lớn trong một task nhỏ.

---

# 35. Avoid Overengineering

Không xây dựng những thứ project chưa cần.

Ví dụ không tự ý thêm:

```text
Microservices

Event-driven architecture

Message queues

Redis

Kubernetes

Complex caching

Complex permission systems

Advanced observability stack

AI orchestration layer
```

chỉ để làm project có vẻ "enterprise".

Project ưu tiên:

```text
Simple

Clear

Maintainable

Testable
```

---

# 36. Minimal Change Principle

Khi thực hiện task:

> Thay đổi ít nhất lượng code cần thiết để giải quyết requirement một cách đúng đắn.

Không tự ý:

- Refactor toàn project.
- Rename hàng loạt file.
- Thay đổi framework.
- Thay đổi architecture.
- Thay đổi database.
- Thay đổi API không liên quan.

trừ khi task yêu cầu hoặc implementation thực sự cần thiết.

---

# 37. Git Rules

AI Agent phải giữ thay đổi có phạm vi rõ ràng.

Một task nên tập trung vào:

```text
One logical change
```

Tránh commit/change chứa:

```text
Feature

+

Unrelated refactor

+

Formatting entire project

+

Dependency changes unrelated to feature
```

Nếu có Git commit message, nên sử dụng format rõ ràng:

```text
feat: add vocabulary learning session

fix: validate quiz answer

test: add quiz service tests

refactor: simplify vocabulary service

docs: update API specification
```

---

# 38. Do Not Hide Problems

AI Agent phải báo rõ:

- Test fail.
- Build fail.
- Migration fail.
- API mismatch.
- Missing requirement.
- External service unavailable.
- Configuration missing.
- Architecture conflict.
- Security concern.

Không được:

```text
Hide error

Pretend success

Silently ignore failure
```

---

# 39. Communication Format

Khi nhận task có mức độ đáng kể, AI Agent nên phản hồi:

```text
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

## Risks / Ambiguities

...

## Plan

1.
2.
3.

## Approval

Nếu task cần approval, chờ approval trước khi implementation.
```

Sau implementation:

```text
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

```

---

# 40. When Approval Is Required

AI Agent phải chờ approval trước khi thực hiện nếu task:

- Thay đổi project scope.
- Thêm role.
- Thêm quiz type.
- Thêm database entity quan trọng.
- Thay đổi database architecture.
- Thay đổi authentication architecture.
- Thay đổi API architecture.
- Thay đổi deployment architecture.
- Thêm external service quan trọng.
- Biến AI thành mandatory dependency.
- Thay đổi ownership/visibility rules.
- Thay đổi core business logic.

Các thay đổi nhỏ, local và không ảnh hưởng contract có thể được implementation trực tiếp nếu requirement đã rõ.

---

# 41. Final Agent Rules

AI Agent phải luôn ghi nhớ:

```text
1. Read before changing.

2. Understand before coding.

3. Check scope before implementing.

4. Check FEATURE_STATUS.md before implementing a feature.

5. Verify existing implementation before creating new code.

6. Reuse before creating.

7. Plan before coding complex tasks.

8. Backend is the source of truth.

9. Security is enforced by Backend.

10. Database changes require careful consideration.

11. API changes must stay synchronized with API_SPEC.md.

12. Tests are part of implementation.

13. Documentation must stay synchronized.

14. Update FEATURE_STATUS.md when implementation status changes.

15. Do not mark a feature as DONE without sufficient verification.

16. Do not rebuild completed features without a clear change request.

17. Continue existing implementations when a feature is IN_PROGRESS.

18. Do not hide problems.

19. Do not guess important business decisions.

20. Do not add unnecessary features.

21. Do not over-engineer.

22. Use the appropriate Skill for the current workflow.

23. AGENTS.md rules take precedence over Skill instructions.
```

Core development workflow:

```text
CHECK FEATURE STATUS
        ↓
      SPEC
        ↓
      PLAN
        ↓
      TASK
        ↓
    IMPLEMENT
        ↓
      TEST
        ↓
     REVIEW
        ↓
UPDATE FEATURE STATUS
```

Core project philosophy:

```text
Simple

↓

Clear

↓

Maintainable

↓

Testable

↓

Scalable when necessary
```

The AI Agent is an implementation assistant, not the product owner.

Important product, scope, architecture and business decisions belong to the project developer.

When in doubt:

```text
Do not guess.

Analyze.

Explain.

Propose.

Ask when necessary.
```
