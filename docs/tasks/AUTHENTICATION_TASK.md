# TASKS: Authentication Implementation Tasks

## 1. Document Status

- Workflow: TASK
- SPEC: Được workflow xác nhận APPROVED.
- PLAN: Được workflow xác nhận APPROVED.
- Database documentation: `AUTH_SESSION` và các database entity liên quan đã được định nghĩa trong `docs/DATABASE.md` và được workflow xác nhận APPROVED.
- Feature status trong `docs/FEATURE_STATUS.md`: `TODO`.
- TASK status: Technical implementation breakdown, chờ developer review/approval.

TASK này chỉ phân rã implementation. Không chứa implementation code và không tự chuyển sang IMPLEMENT.

---

## 2. Source Documents

- `AGENTS.md` — quy tắc repository và workflow.
- `docs/PROJECT_OVERVIEW.md` — product scope và actors.
- `docs/specs/AUTHENTICATION_SPEC.md` — Authentication business requirements.
- `docs/plans/AUTHENTICATION_PLAN.md` — approved technical direction.
- `docs/DATABASE.md` — approved data model, `USER`, `AUTH_SESSION` và constraints.
- `docs/API_SPEC.md` — API endpoints và API contract hiện có.
- `docs/FEATURE_STATUS.md` — current feature status.
- `docs/ARCHITECTURE.md` — layered backend và frontend architecture.

`docs/SYSTEM_OVERVIEW.md` không tồn tại trong repository; `docs/PROJECT_OVERVIEW.md` là tài liệu system-level tương ứng được sử dụng.

---

## 3. Task Overview

Authentication sẽ được triển khai theo các boundaries đã approve:

- Stateful server-side session authentication được transport bằng HTTP-only cookie.
- Cookie name duy nhất: `session_id`.
- Session token: 32 random bytes (256-bit) từ cryptographically secure random generator.
- Chỉ SHA-256 hash của session token được lưu trong `AUTH_SESSION`.
- `USER 1:N AUTH_SESSION`.
- Session lifetime: 7 ngày.
- Logout chỉ terminate/delete current session và idempotent.
- Password hashing dùng `node:crypto` với `scrypt`.
- Backend là security boundary.
- Frontend không nhận hoặc lưu raw session token.

---

## 4. Task Dependency / Execution Order

```text
TASK-001 Database / Prisma USER + AUTH_SESSION

   ├──→ TASK-002 Password security
   ├──→ TASK-003 User data access
   └──→ TASK-004 Session data access
              └──→ TASK-005 Auth Service

TASK-002 ────────→ TASK-005
TASK-003 ────────→ TASK-005

TASK-005 ────────→ TASK-006 Authentication middleware

TASK-006 ────────→ TASK-007 Role authorization / authenticated identity context

TASK-005 ────────→ TASK-008 Auth Controller / HTTP cookie transport
TASK-006 ────────→ TASK-008
TASK-007 ────────→ TASK-009 Auth routes
TASK-008 ────────→ TASK-009

TASK-009 ────────→ TASK-010 Backend tests

TASK-009 ────────→ TASK-011 Frontend auth service / state

TASK-011 ────────→ TASK-012 Frontend pages / forms
TASK-011 ────────→ TASK-013 Protected navigation / logout UI

TASK-012 ────────→ TASK-014 Frontend tests
TASK-013 ────────→ TASK-014

TASK-010 ────────→ TASK-015 Integration / security verification
TASK-014 ────────→ TASK-015
```

---

# 5. Detailed Tasks

## TASK-001 — Implement USER and AUTH_SESSION database models

### Objective

Materialize các database entity đã được approved trong `docs/DATABASE.md` vào Prisma schema/data-access foundation để Authentication có thể sử dụng server-side sessions.

`USER` đã được định nghĩa và approved ở mức database design trong `docs/DATABASE.md`, nhưng hiện chưa được materialize trong Prisma schema.

`AUTH_SESSION` cũng đã được định nghĩa và approved trong `docs/DATABASE.md`.

TASK-001 chỉ materialize đúng database design hiện có và không redesign domain model.

### Dependencies

- None.
- `docs/DATABASE.md` đã được approved và là source of truth cho database model.

### Files / Modules

- Backend Prisma/database configuration và schema module hiện có hoặc sẽ được thiết lập theo architecture.
- Prisma migration thuộc database implementation.
- Không đoán path module mới nếu source structure chưa có module tương ứng.

### In Scope

- Materialize entity `USER` vào Prisma schema đúng theo `docs/DATABASE.md`.
- Materialize entity `AUTH_SESSION` vào Prisma schema đúng theo `docs/DATABASE.md`.
- Thiết lập relationship `USER 1:N AUTH_SESSION`.
- Thiết lập foreign key từ `AUTH_SESSION.user_id` tới `USER.id`.
- Thiết lập unique constraint/index cho `session_identifier_hash` theo `docs/DATABASE.md`.
- Bảo đảm raw session token không có field persistence.
- Bảo đảm các field, type, constraint, default và relationship của `USER` khớp approved database design.
- Bảo đảm `AUTH_SESSION` có đúng các field đã approved:
  - `id`
  - `user_id`
  - `session_identifier_hash`
  - `created_at`
  - `expires_at`

- Tạo Prisma migration cần thiết để materialize database model sau khi TASK-001 được approved và bước IMPLEMENT bắt đầu.

### Out of Scope

- Redesign entity `USER`.
- Thêm, xóa hoặc đổi field của `USER` ngoài `docs/DATABASE.md`.
- Thay đổi role model.
- Thay đổi relationship của `USER` với các entity khác.
- `revoked_at`.
- `last_used_at`.
- IP, user-agent, device name.
- Session/device history.
- Logout-all-devices.
- Redis hoặc JWT fields.
- Các entity hoặc database feature khác ngoài phạm vi TASK-001.
- Authentication business logic.
- Password hashing.
- Authentication Service.
- Middleware, Controller hoặc API implementation.

### Implementation Requirements

- `docs/DATABASE.md` là source of truth cho `USER` và `AUTH_SESSION`.
- Không tự suy diễn hoặc thiết kế lại database model nếu thông tin đã có trong `docs/DATABASE.md`.
- Nếu Prisma schema và `docs/DATABASE.md` có conflict, phải dừng và report conflict thay vì tự chọn một phương án.
- `USER` phải được materialize đúng database design đã approved; không được coi `USER` là một model có sẵn nếu Prisma schema thực tế chưa có model này.
- `AUTH_SESSION` phải có đúng năm field đã approved.
- `session_identifier_hash` phải được bảo vệ bằng unique constraint/index theo database design.
- Không lưu raw session token trong database.
- Không dùng cascade delete tùy tiện; tuân thủ foreign-key rules trong `docs/DATABASE.md`.
- `expires_at` phải hỗ trợ session lifetime 7 ngày được định nghĩa trong Authentication PLAN.
- Migration chỉ được tạo trong bước IMPLEMENT sau khi TASK-001 được developer approve.
- Không cài thêm dependency nếu không có requirement được approved.

### Acceptance Criteria

- Prisma schema có model `USER` khớp `docs/DATABASE.md`.
- Prisma schema có model `AUTH_SESSION` với đúng năm field:
  - `id`
  - `user_id`
  - `session_identifier_hash`
  - `created_at`
  - `expires_at`

- Relationship `USER 1:N AUTH_SESSION` tồn tại.
- `AUTH_SESSION.user_id` tham chiếu `USER.id`.
- `session_identifier_hash` có unique constraint/index theo approved database design.
- Không có raw session token field.
- Không có session metadata ngoài approved design.
- Không có thay đổi ngoài database scope của TASK-001.
- Prisma schema validation/generation có thể được thực hiện thành công trong IMPLEMENT/TEST stage.

### Testing Requirements

- Prisma schema validation pass.
- Prisma client generation pass.
- Migration validation/verification pass khi TEST stage thực hiện.
- Verify `USER` fields, types, defaults và constraints khớp `docs/DATABASE.md`.
- Verify `AUTH_SESSION` fields, types và constraints khớp `docs/DATABASE.md`.
- Verify unique constraint/index của `session_identifier_hash`.
- Verify foreign key giữa `AUTH_SESSION.user_id` và `USER.id`.
- Verify relationship `USER 1:N AUTH_SESSION`.

### Traceability

- PLAN: `10. Tác động Database`, `15. Thứ tự Implementation`.
- DATABASE: `5. USER`, `5.6. AUTH_SESSION`, `25. Main Relationships`, `26. Indexing Strategy`, `27. Foreign Key Rules`, `38. Initial Database Scope`.
- SPEC: Authentication database/session requirements where applicable.

---

## TASK-002 — Implement password security utility

### Objective

Cung cấp password hashing và verification dùng Node built-in crypto theo approved PLAN.

### Dependencies

- TASK-001 có thể chạy song song về mặt data model, nhưng Auth Service phải chờ TASK-002.

### Files / Modules

- Backend security/auth utility module trong source structure hiện có.

### In Scope

- Dùng `node:crypto` với `crypto.scrypt` hoặc `crypto.scryptSync`.
- Tạo salt bằng cryptographically secure random generator.
- Lưu đủ metadata trong `password_hash` để verify:
  - thuật toán;
  - parameters;
  - salt;
  - derived key/hash.

- Constant-time comparison khi verify.
- Password tối thiểu 8 ký tự được backend kiểm tra.

### Out of Scope

- bcrypt, argon2 hoặc password library khác.
- Password reset/recovery.
- Password policy ngoài minimum 8 ký tự nếu chưa được approve.

### Implementation Requirements

- Không dùng SHA-256 trực tiếp làm password hash.
- Không tự dùng weaker/default scrypt parameters chỉ vì tiện.
- Scrypt parameters phải được technical-validate trước IMPLEMENT dựa trên security và performance deployment.
- Không log plaintext password hoặc password hash.

### Acceptance Criteria

- Password hợp lệ được hash trước persistence.
- Password đúng verify thành công.
- Password sai verify thất bại.
- `password_hash` chứa metadata cần thiết.
- Plaintext password/hash không xuất hiện trong log hoặc API response.

### Testing Requirements

- Minimum length validation.
- Hash/verify success.
- Wrong password failure.
- Salt uniqueness.
- Metadata parsing/verification.
- Constant-time comparison path.

### Traceability

- SPEC: `BR-07` đến `BR-09`, `AC-04`, `AC-07`.
- PLAN: `7. Password Security`, `13. Chiến lược Testing`.
- DATABASE: `5. USER`.

---

## TASK-003 — Implement USER repository/data access

### Objective

Cung cấp data access cho registration, login và current-user flow.

### Dependencies

- TASK-001.

### Files / Modules

- Backend User Repository/data-access module theo source structure hiện có.

### In Scope

- Tìm User theo email đã normalize.
- Tìm User theo `id`.
- Tạo User mới với:
  - `display_name`;
  - normalized `email`;
  - `password_hash`;
  - `role = USER`;
  - `is_active = true`;
  - `daily_xp_goal = 50`.

- Đọc role và `is_active` cho authentication/authorization.
- Bảo vệ email uniqueness.

### Out of Scope

- User profile management.
- Admin user management.
- Thay đổi XP, level, streak hoặc learning progress.
- Nhận `user_id`/`owner_id` từ client để xác định identity.

### Implementation Requirements

- Repository chỉ làm data access, không chứa business rules.
- Email normalization authoritative nằm ở backend service/data flow.
- Không trả `password_hash` cho controller response.

### Acceptance Criteria

- Registration query nhận email normalized.
- Duplicate email được phát hiện hoặc database constraint bảo vệ.
- User mới có đúng defaults đã duyệt.
- Current-user lookup trả được User cần thiết cho middleware/controller.

### Testing Requirements

- Lookup normalized email.
- Duplicate email.
- New User defaults.
- User lookup by id.
- Không expose password hash qua response mapping.

### Traceability

- SPEC: `BR-05`, `BR-06`, `BR-10` đến `BR-12`, `AC-02`, `AC-03`, `AC-08`.
- PLAN: `8. Thiết kế Backend`, `11. Kế hoạch triển khai API`.
- DATABASE: `5. USER`, `26. Indexing Strategy`.

---

## TASK-004 — Implement AUTH_SESSION repository/data access

### Objective

Cung cấp persistence operations cho stateful sessions.

### Dependencies

- TASK-001.

### Files / Modules

- Backend Session Repository/data-access module theo source structure hiện có.

### In Scope

- Tạo một `AUTH_SESSION` mới cho mỗi login thành công.
- Nhận và lưu SHA-256 hash của session token.
- Tìm session theo hash.
- Kiểm tra `expires_at`.
- Xóa current session khi Logout.
- Có thể cleanup expired sessions theo phạm vi tối giản của PLAN.

### Out of Scope

- Raw session token persistence.
- `revoked_at`.
- `last_used_at`.
- IP/user-agent/device tracking.
- Logout-all-devices.
- Session management UI.

### Implementation Requirements

- Session token tạo ở Auth Service/security utility, không tạo tùy ý trong repository.
- Repository không nhận `user_id` từ client.
- Mỗi User có thể có nhiều session.
- Delete current session không ảnh hưởng các session khác của User.

### Acceptance Criteria

- Login lần mới tạo record `AUTH_SESSION` mới.
- Có thể lookup bằng SHA-256 hash.
- Expired session không được coi là hợp lệ.
- Logout xóa đúng current session.
- Session khác của cùng User vẫn tồn tại.

### Testing Requirements

- Session creation.
- Hash lookup.
- Expiration check.
- Delete current session.
- Multiple sessions per User.
- Không lưu raw token.

### Traceability

- SPEC: `BR-16`, `AC-16`.
- PLAN: `6. Credential Lifecycle`, `10. Tác động Database`, `11. Kế hoạch triển khai API`.
- DATABASE: `5.6. AUTH_SESSION`, `25. Main Relationships`, `27. Foreign Key Rules`.

---

## TASK-005 — Implement Authentication Service

### Objective

Điều phối business flow registration, login, logout và current-user authentication ở Service layer.

### Dependencies

- TASK-002.
- TASK-003.
- TASK-004.

### Files / Modules

- Backend Auth Service module theo source structure hiện có.

### In Scope

- Registration:
  - validate input;
  - normalize email lowercase;
  - check uniqueness;
  - hash password;
  - create `USER` defaults;
  - không auto-login.

- Login:
  - normalize email;
  - tìm User;
  - verify password;
  - kiểm tra `is_active`;
  - tạo 32-byte session token;
  - SHA-256 hash và persist session;
  - trả authentication result nội bộ cho Controller.

- Logout:
  - xử lý current session;
  - delete session nếu hợp lệ;
  - idempotent với cookie thiếu/malformed/expired/deleted.

- Current-user identity resolution.

### Out of Scope

- Set/clear HTTP cookie.
- HTTP response mapping.
- New authentication mechanism.
- JWT, refresh token, OAuth, Redis.
- Password reset/recovery.

### Implementation Requirements

- Auth Service không trực tiếp thao tác HTTP cookie.
- Không trả raw session token cho frontend.
- Invalid email, wrong password và inactive account có public behavior nhất quán.
- Backend là authority cho account status và identity.

### Acceptance Criteria

- Registration hợp lệ tạo User đúng defaults.
- Registration không tạo session.
- Login hợp lệ tạo session và trả internal authentication result.
- Inactive/invalid credentials bị từ chối mà không lộ account state.
- Logout hiện tại idempotent và chỉ xóa current session.

### Testing Requirements

- Registration success/validation/duplicate email.
- Email normalization.
- Password verification.
- Inactive account.
- Generic authentication failure.
- Session creation and deletion.
- Logout idempotency.

### Traceability

- SPEC: `4. User Flow`, `5. Business Rules`, `8. Acceptance Criteria`.
- PLAN: `6. Credential Lifecycle`, `7. Password Security`, `8. Thiết kế Backend`.

---

## TASK-006 — Implement authentication middleware

### Objective

Xác thực `session_id` cookie trên protected requests và attach authenticated identity.

### Dependencies

- TASK-004.
- TASK-005.
- `cookie-parser` — dependency đã được developer approve cho TASK-006 để parse HTTP Cookie. Không chốt version package trong TASK.

### Files / Modules

- Backend authentication middleware module theo source structure hiện có.

### In Scope

- Sử dụng `cookie-parser` và đọc raw token từ `req.cookies.session_id`.
- SHA-256 hash token.
- Lookup `AUTH_SESSION`.
- Kiểm tra session existence và `expires_at`.
- Load User.
- Kiểm tra `is_active`.
- Attach authenticated public user identity vào `req.user`, chỉ gồm:
  - `id`;
  - `email`;
  - `display_name`;
  - `role`.
- Trả `401 Unauthorized` cho protected endpoints khi credential thiếu/không hợp lệ.

Flow được approve:

```text
HTTP Request
  ↓
cookie-parser
  ↓
req.cookies.session_id
  ↓
Authentication Middleware
  ↓
authenticationService.getCurrentUser(sessionToken)
  ↓
req.user
  ↓
next()
```

### Out of Scope

- Logout hard-401 flow.
- Role authorization.
- Ownership logic của từng domain.
- Frontend route protection.

### Implementation Requirements

- Raw token không log.
- `cookie-parser` chỉ parse Cookie header; không thay thế `AUTH_SESSION` hoặc stateful server-side session architecture.
- Không lưu raw token vào database.
- Không tin identity do client gửi.
- Chỉ dùng session đã xác thực và User hiện tại từ `authenticationService.getCurrentUser(sessionToken)`.
- Không duplicate session token hashing, session lookup, session expiry, user lookup, `is_active` check hoặc public identity mapping trong middleware nếu không cần thiết.
- Không đưa `password_hash`, raw session token, `session_identifier_hash`, `expires_at` hoặc authentication secret vào `req.user`.
- Role authorization và `403 Forbidden` thuộc TASK-007, không implement trong TASK-006.
- `POST /api/auth/logout` không bị buộc qua hard-401 authentication flow.

### Acceptance Criteria

- Session hợp lệ tạo authenticated identity.
- Token sai, malformed, expired hoặc User inactive bị từ chối trên protected endpoint.
- Missing credential bị từ chối trên protected endpoint.
- Logout vẫn xử lý idempotently ngoài hard-401 flow.

### Testing Requirements

- Valid session.
- Missing/malformed/expired session.
- Deleted session.
- Inactive User.
- `req.user` chỉ chứa `id`, `email`, `display_name` và `role`.
- Raw token không xuất hiện trong log/test response.

### Traceability

- SPEC: `BR-13`, `BR-19`, `AC-14`, `AC-15`, `AC-17`.
- PLAN: `6. Credential Lifecycle`, `8. Thiết kế Backend`, `9. Thiết kế Authorization`.

---

## TASK-007 — Implement role authorization and authenticated identity context

### Objective

Enforce `USER`/`ADMIN` role access và cung cấp authenticated identity context cho domain features.

### Dependencies

- TASK-006.

### Files / Modules

- Backend authorization middleware/shared authorization module.
- Authenticated identity context used by domain features.

### In Scope

- Authenticated active User access.
- `ADMIN`-only access.
- Reject authenticated `USER` from Admin endpoints with `403 Forbidden`.
- Attach the authenticated identity from the validated session.
- Reject client-supplied `user_id`, `owner_id` hoặc `role` as authentication/authorization authority.
- Keep frontend role visibility as UX only.

### Out of Scope

- New roles.
- Admin user-management feature implementation.
- Ownership enforcement for Vocabulary Set, Community hoặc các domain resource cụ thể; domain feature tasks phải xử lý phần này.

### Implementation Requirements

- Backend remains security boundary.
- Role read from current authenticated User.
- Authentication is responsible for identity authentication and role authorization only.
- Domain features are responsible for resource-specific ownership checks using the authenticated identity.
- Authoritative XP, level, streak and learning progress are not accepted from client.

### Acceptance Criteria

- `ADMIN` endpoint accepts authenticated `ADMIN` only.
- Authenticated `USER` receives `403 Forbidden` on Admin-only endpoint.
- Unauthenticated requests are rejected before protected operation.
- Authenticated identity is available to downstream domain features.
- Authentication does not treat client-supplied `user_id`, `owner_id` or `role` as trusted identity/role data.

### Testing Requirements

- USER authorization.
- ADMIN authorization.
- Authenticated identity context.
- Forged `user_id`, `owner_id`, `role` are not used as authentication/role authority.
- Backend-only enforcement independent of frontend visibility.

### Traceability

- SPEC: `BR-01`, `BR-02`, `BR-20` to `BR-23`, `AC-17` to `AC-20`.
- PLAN: `9. Thiết kế Authorization`.
- API_SPEC: `4. Actors`, `58. Authorization Rules`, `59. Ownership Rules`, `66. Security Requirements`.

---

## TASK-008 — Implement Auth Controller and HTTP cookie transport

### Objective

Expose HTTP behavior while keeping cookie transport in Controller/HTTP layer.

### Dependencies

- TASK-005.
- TASK-006.
- TASK-007.

### Files / Modules

- Backend Auth Controller/HTTP layer theo source structure hiện có.

### In Scope

- Receive Auth Service result.
- Set cookie `session_id` after Login.
- Clear cookie `session_id` after Logout in every case.
- Return only approved User identity fields.
- Map errors to approved status/response format.
- Preserve raw session token only for cookie handling.

### Out of Scope

- Business logic in Controller.
- Raw session token in JSON response.
- Cookie name khác `session_id`.
- Hard-401 Logout behavior.

### Implementation Requirements

- Cookie attributes follow verified deployment topology.
- `HttpOnly` always required; `Secure` in production/HTTPS.
- Domain/SameSite/Path are not hard-coded before topology verification.
- Register success recommendation: `201 Created`.
- Login success recommendation: `200 OK`.
- Logout success: `204 No Content`.
- Current-user success: `200 OK`.
- Validation errors: `400 Bad Request`.
- Credentialed CORS must not use wildcard origin.
- CSRF requirement follows deployment topology verification.

### Acceptance Criteria

- Login sets only cookie `session_id`.
- Raw token is absent from JSON responses.
- Logout clears cookie whether session is valid, missing, malformed, expired or deleted.
- Logout returns `204 No Content` in all idempotent cases.
- Register/Login/Me return the approved identity and status behavior.

### Testing Requirements

- Set-Cookie after Login.
- Cookie clearing after Logout.
- Raw token absence in JSON.
- Status and error mapping.
- Credentialed CORS configuration.
- Cookie topology configuration.

### Traceability

- SPEC: `7. API Requirements`, `8. Acceptance Criteria`.
- PLAN: `4. Tác động kiến trúc`, `6. Credential Lifecycle`, `11. Kế hoạch triển khai API`.
- API_SPEC: `5. Authentication`, `6. Login`, `7. Current User`, `63. Error Response`, `64. HTTP Status Codes`, `71. API Endpoint Inventory`.

---

## TASK-009 — Register Authentication routes

### Objective

Map the approved Authentication endpoints to Controller handlers without adding duplicate routes.

### Dependencies

- TASK-008.

### Files / Modules

- Backend route registration module in the existing Express application.

### In Scope

- `POST /api/auth/register`.
- `POST /api/auth/login`.
- `POST /api/auth/logout`.
- `GET /api/auth/me`.
- Apply protected middleware to protected endpoints.
- Keep Logout outside hard-401 authentication flow.
- Connect routes to Controller only.

### Out of Scope

- New endpoints.
- Duplicate endpoints.
- Business logic in route definitions.
- Profile, Daily Goal or Admin Management routes.

### Implementation Requirements

- Preserve layered architecture.
- Use centralized error handling and validation.
- Keep endpoint names unchanged.

### Acceptance Criteria

- All four endpoints are registered once.
- Guest access works for Register/Login.
- Protected Current User access requires valid session.
- Logout remains idempotent without hard-401 dependency.

### Testing Requirements

- Route registration/integration tests for all four endpoints.
- Authenticated and unauthenticated access behavior.
- No duplicate route behavior.

### Traceability

- SPEC: `7. API Requirements`.
- PLAN: `8. Thiết kế Backend`, `11. Kế hoạch triển khai API`.
- API_SPEC: `71. API Endpoint Inventory`.

---

## TASK-010 — Backend Authentication and security tests

### Objective

Triển khai persistent automated test suite cho backend Authentication và minimal application testability infrastructure đã được approved trong SPEC-010/PLAN-010.

TASK-010 phải chứng minh observable HTTP contract, persistence effects và security invariants của Authentication hiện có mà không thay đổi Authentication business behavior, API contract, database schema hoặc session architecture.

Primary test boundary là real Express application chạy trên loopback/ephemeral port. Focused component tests chỉ dùng cho security/error paths không thể chứng minh đầy đủ hoặc ổn định qua HTTP boundary.

### Preconditions / Dependencies

- SPEC-010 — Backend Authentication Tests: APPROVED.
- PLAN-010 — Backend Authentication Tests: APPROVED.
- TASK-009 — Authentication Routes / Route Integration: completed and closed.
- Authentication implementation hiện tại qua TASK-001 đến TASK-009.
- Node.js 22 runtime với built-in `node:test`, `node:assert/strict` và native `fetch`.
- PostgreSQL test database riêng do developer/CI provision.
- Existing Prisma schema và migrations cho `USER`/`AUTH_SESSION`.
- `TEST_DATABASE_URL` chỉ tới dedicated test database.
- `TEST_DATABASE_ALLOW_RESET=true` được set rõ ràng trước mọi destructive preparation/cleanup.

Không có third-party test framework/library dependency mới.

### Approved Technical Decisions

- Test runner: Node.js built-in `node:test`.
- Assertions: `node:assert/strict`.
- HTTP client: native `fetch`.
- HTTP integration: real Express app trên `127.0.0.1` với OS-assigned ephemeral port.
- Application boundary: `createApp({ prisma })`; listener startup vẫn nằm trong `main.js`.
- Database: real Prisma/PostgreSQL dedicated test database, reuse existing migrations.
- Database test concurrency: sequential qua `--test-concurrency=1`.
- Isolation: FK-safe cleanup `AUTH_SESSION` trước `USER`, unique fixtures, before/after/finally cleanup.
- Time: fixed expired fixtures và bounded timestamp tolerance; không sleep.
- Deferred contracts: visible `test.todo()` entries, không false PASS.

### Files / Modules

#### CREATE

```text
backend/src/app.js
backend/test/helpers/test-environment.js
backend/test/helpers/test-database.js
backend/test/helpers/http-test-server.js
backend/test/helpers/auth-fixtures.js
backend/test/scripts/prepare-test-database.js
backend/test/auth/auth-http.test.js
backend/test/auth/auth-components.test.js
backend/test/auth/password-security.test.js
backend/test/auth/deferred-contracts.test.js
backend/test/README.md
backend/.env.test.example
```

Responsibilities:

- `src/app.js`: export importable `createApp({ prisma })`, compose existing Authentication graph, middleware/routes và health route; không gọi `listen()`.
- `test-environment.js`: enforce/redact test environment and destructive-reset guards before Prisma-bound imports/actions.
- `test-database.js`: test Prisma lifecycle, connectivity, direct evidence queries và FK-safe reset.
- `http-test-server.js`: ephemeral loopback server lifecycle, JSON/raw requests, cookie extraction/forwarding and safe response inspection.
- `auth-fixtures.js`: minimal unique USER/ADMIN/inactive/session fixtures; không tạo fixture framework tổng quát.
- `prepare-test-database.js`: validate safety guard và apply existing migrations qua existing Prisma CLI.
- `auth-http.test.js`: primary HTTP/API and persistence coverage for four Authentication endpoints.
- `auth-components.test.js`: focused service/controller/middleware/role/error/security-boundary coverage.
- `password-security.test.js`: focused password primitive/security coverage.
- `deferred-contracts.test.js`: explicit TODO inventory for contracts chưa approved/implemented.
- `test/README.md`: environment, commands, safety, lifecycle and deferred coverage documentation.
- `.env.test.example`: variable names/placeholders only; không chứa credential thật.

#### MODIFY

```text
backend/src/main.js
backend/package.json
```

- `main.js`: tạo Prisma client, gọi `createApp({ prisma })`, rồi giữ startup/listener behavior hiện tại.
- `package.json`: thay placeholder test script và thêm approved commands; không thêm dependency.

#### EXPECTED UNCHANGED / DO NOT MODIFY

```text
backend/package-lock.json
backend/prisma/schema.prisma
backend/prisma/migrations/*
backend/src/routes/auth-routes.js
backend/src/controllers/auth-controller.js
backend/src/services/authentication-service.js
backend/src/repositories/user-repository.js
backend/src/repositories/auth-session-repository.js
backend/src/middleware/authentication-middleware.js
backend/src/middleware/role-authorization-middleware.js
backend/src/utils/password-security.js
frontend/*
docs/API_SPEC.md
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/PROJECT_OVERVIEW.md
docs/UI_UX_SPEC.md
TASK-001 ... TASK-009
TASK-011 ... TASK-015
```

Nếu IMPLEMENT cần thay đổi một expected-unchanged production component, API behavior, schema/migration, dependency hoặc substantive scope của task khác, phải STOP và quay lại PLAN/SPEC approval.

### In Scope

- Minimal `createApp({ prisma })` extraction without production behavior change.
- Node built-in test infrastructure and package scripts.
- Dedicated test database preparation, safety guards, reset and fixture lifecycle.
- Registration, login, logout and `/api/auth/me` HTTP integration tests.
- Password security focused tests.
- Authentication Service/Controller/Middleware focused error and edge tests.
- Role Authorization Middleware focused tests.
- Persistence/security assertions for USER/AUTH_SESSION.
- Multiple-session, expiration and current-session-only logout behavior.
- Identity authority and client-forgery resistance.
- Sensitive data response/persistence/log checks.
- Repeatability and sequential execution.
- Explicit TODO reporting for approved deferred contracts.

### Out of Scope

- Authentication business/API behavior changes.
- New endpoint, role, permission or ownership system.
- Prisma schema/migration changes or test-only schema.
- Third-party test runner/assertion/HTTP library.
- Centralized error handler implementation.
- CORS/CSRF implementation or deployment-topology decision.
- `SameSite`/cookie `Domain` decision.
- JWT, refresh token, OAuth, MFA, password reset or session-management features.
- Frontend Authentication/tests.
- Load, performance, penetration or full-platform security testing.
- Resource-specific ownership rules belonging to other domains.
- Feature status transition to DONE before TEST/REVIEW/human approval.

### Test Command Contract

`backend/package.json` phải cung cấp:

```text
npm run test:db:prepare
npm run test:auth
npm test
```

Required behavior:

- `test:db:prepare`: safety-check environment rồi apply existing migrations vào dedicated test database.
- `test:auth`: chạy Authentication tests bằng Node test runner, sequentially.
- `test`: chạy full backend discovered test suite, sequentially.
- Runnable assertion/setup failure trả non-zero exit code.
- All runnable tests pass trả zero; TODO count vẫn hiển thị riêng.
- Database configuration thiếu/unsafe phải fail rõ, không silently skip.
- Current missing build/lint commands được report `NOT AVAILABLE`, không coi là PASS.

### Test Database Safety Contract

- `TEST_DATABASE_URL` là bắt buộc cho database preparation/integration tests.
- `TEST_DATABASE_ALLOW_RESET` phải bằng string `true` trước migration/reset/delete action.
- `NODE_ENV` phải được kiểm soát là `test` trước dynamic import module tạo Prisma-bound app.
- `TEST_DATABASE_URL` được map process-locally sang `DATABASE_URL`; không sửa `.env` production/development.
- Error output không in full database URL hoặc credentials.
- Suite không tự tạo database; chỉ apply existing migrations vào database đã provision.
- Cleanup theo thứ tự `AUTH_SESSION` rồi `USER`.
- Cleanup chạy trước stateful scenario và trong after/finally phù hợp.
- Database tests/subtests không chạy song song.
- Fixtures dùng unique identifiers và không phụ thuộc dữ liệu từ lần chạy trước.
- Hai lần chạy liên tiếp phải cho cùng result và không để lại fixture rows.

### Task Breakdown

#### TASK-010-01 — Extract importable Express application boundary

**Dependencies:** TASK-009.

**Files:**

- Create `backend/src/app.js`.
- Modify `backend/src/main.js`.

**Implementation Requirements:**

- Move current dependency composition, `express.json()`, `cookieParser()`, auth router mount và health route into `createApp({ prisma })`.
- Factory trả Express app và không listen.
- `main.js` giữ one Prisma client, `PORT`, startup listener và startup log behavior.
- Preserve exact dependency graph, singleton instances, middleware order and four routes from TASK-009.
- Không thêm injection hooks/general abstraction chỉ phục vụ mocking.

**Acceptance Criteria:**

- Import `app.js` không mở network listener.
- `main.js` startup behavior không đổi.
- Health route và bốn Authentication endpoints vẫn registered đúng.
- Controller và Authentication Middleware vẫn share cùng Authentication Service instance.
- Không thay đổi Authentication module behavior/API.

**Verification:**

- Syntax/import check.
- Health and route regression through later HTTP suite.
- Diff review against TASK-009 composition order.

---

#### TASK-010-02 — Add Node test scripts and test environment contract

**Dependencies:** None; integrate with TASK-010-01 before HTTP tests.

**Files:**

- Modify `backend/package.json`.
- Create `backend/.env.test.example`.
- Create `backend/test/README.md`.
- Create `backend/test/helpers/test-environment.js`.

**Implementation Requirements:**

- Use `node:test`, `node:assert/strict` and native APIs only.
- Add approved `test`, `test:auth`, `test:db:prepare` command names.
- Use `--test-concurrency=1` for test commands.
- Validate dedicated DB URL/reset opt-in before destructive action.
- Redact database URL/credentials in errors.
- Document exact prerequisites, commands, cleanup and TODO semantics.
- Do not add package dependency; package lock remains unchanged.

**Acceptance Criteria:**

- Placeholder `npm test` is removed.
- Commands use Node 22 built-in test stack and sequential execution.
- Missing/unsafe environment fails before database action.
- Example environment contains no real secret.
- README distinguishes PASS, FAIL, TODO and NOT AVAILABLE.

**Verification:**

- Inspect package scripts and dependency diff.
- Exercise guard failure with no database action during IMPLEMENT verification.
- Confirm package lock has no diff.

---

#### TASK-010-03 — Add dedicated test database preparation and lifecycle

**Dependencies:** TASK-010-02.

**Files:**

- Create `backend/test/scripts/prepare-test-database.js`.
- Create `backend/test/helpers/test-database.js`.

**Implementation Requirements:**

- Reuse existing Prisma CLI and migrations; do not generate or modify migration.
- Map verified `TEST_DATABASE_URL` process-locally for Prisma.
- Preparation script applies `prisma migrate deploy` only after safety validation.
- Database helper creates/disconnects test Prisma client and exposes minimal evidence/reset operations.
- Reset `AUTH_SESSION` before `USER`.
- Cleanup must run reliably after failures and must not log connection credentials.
- No transaction strategy that falsely assumes HTTP requests share a test-owned transaction.

**Acceptance Criteria:**

- Missing URL or allow-reset guard prevents migrate/reset/delete action with non-zero exit.
- Approved dedicated database can receive existing migration and connect through Prisma.
- Reset is FK-safe and repeatable.
- Test Prisma client disconnects in teardown/finally.
- No schema/migration file changes.

**Verification:**

- Guard-path verification without DB mutation.
- During authorized IMPLEMENT/TEST environment: run `npm run test:db:prepare`, connectivity/reset check and repeat cleanup.

---

#### TASK-010-04 — Add HTTP server and Authentication fixture helpers

**Dependencies:** TASK-010-01, TASK-010-03.

**Files:**

- Create `backend/test/helpers/http-test-server.js`.
- Create `backend/test/helpers/auth-fixtures.js`.

**Implementation Requirements:**

- Start real Express app on `127.0.0.1` port `0`; obtain actual assigned port.
- Always close server in teardown/finally.
- Support JSON and raw requests, response body/status/header inspection and single `session_id` cookie forwarding.
- Use `Headers.getSetCookie()`/Node 22 behavior to inspect all cookie headers.
- Do not build a generalized cookie jar.
- Fixtures create unique email identifiers and only approved USER/ADMIN/inactive/session states.
- Use public endpoints for normal flows; direct Prisma only for otherwise unreachable states such as ADMIN/inactive/expired/missing-user/corrupt-hash.
- Helpers must not print request secrets/cookies on failure.

**Acceptance Criteria:**

- HTTP helper opens/closes ephemeral loopback server deterministically.
- Cookie extraction preserves only required transport value/attributes.
- Fixture reruns do not collide.
- No test-only production endpoint/backdoor is introduced.

**Verification:**

- Helper lifecycle check through health endpoint.
- Teardown confirms listener closed and database fixtures cleaned.

---

#### TASK-010-05 — Implement password-security focused tests

**Dependencies:** TASK-010-02.

**Files:**

- Create `backend/test/auth/password-security.test.js`.

**Coverage:**

- Password length 7 rejected; length 8 accepted.
- Hash/verify correct password success.
- Wrong and non-string password failure per current contract.
- Same plaintext produces independently salted serialized hashes.
- Required scrypt algorithm/parameter/salt/key metadata.
- Malformed algorithm, part count, base64url, parameter and size formats return `PASSWORD_HASH_INVALID`.
- Unsafe/unbounded scrypt parameters rejected before expensive derivation.
- Constant-time helper equal/mismatch/length/type behavior.

**Acceptance Criteria:**

- All approved password invariants have deterministic tests.
- Tests do not assert exact random salt/hash.
- Failure messages/logs do not expose plaintext/hash values.
- No production utility change is made to accommodate tests.

**Verification:**

- Run password-security test file via Node test runner.

---

#### TASK-010-06 — Implement Registration and Login HTTP/persistence tests

**Dependencies:** TASK-010-01 through TASK-010-04, TASK-010-05.

**Files:**

- Create/extend `backend/test/auth/auth-http.test.js`.

**Registration Coverage:**

- `201` and exact approved success body for valid `display_name`, email, password.
- Lowercase normalization before lookup/persistence.
- USER defaults: role, active state, XP and daily goal.
- No session, no authentication cookie, no auto-login.
- Missing/wrong-type/empty required values and password under 8 → `400/VALIDATION_ERROR`.
- Duplicate normalized email → `409/EMAIL_ALREADY_EXISTS`.
- Concurrent duplicate race/DB uniqueness: one persisted user and approved public conflict behavior.
- Failed registration creates no partial user/session state.
- Password persisted as verifiable scrypt hash, never plaintext.

**Login Coverage:**

- Valid active login → `200`, exact public `data.user` identity.
- Normalized email lookup and correct password.
- Cookie name `session_id`, `HttpOnly`, `Path=/`, `Max-Age=604800`, conditional `Secure` per current controller contract.
- Raw token decodes to 32 bytes; DB stores matching SHA-256 hash only.
- `expires_at` within bounded tolerance of 7-day lifetime.
- Unknown email, wrong password and inactive account produce identical public `401/AUTHENTICATION_FAILED` behavior.
- Missing/non-string credentials follow current approved `401` behavior.
- Failed login creates no session/cookie.
- Repeated valid login creates two different, simultaneously valid sessions.

**Acceptance Criteria:**

- SPEC-010 AC-02 through AC-08 evidence is produced.
- HTTP and database assertions are kept in the same logical scenarios without redundant repository-call tests.
- Response JSON excludes password/hash/session fields and raw token.
- Time assertions use request window/tolerance; no sleep.

**Verification:**

- Run `npm run test:auth` against authorized dedicated database.
- Confirm session/user row counts and cleanup after pass/fail.

---

#### TASK-010-07 — Implement `/me`, logout and session lifecycle tests

**Dependencies:** TASK-010-06.

**Files:**

- Extend `backend/test/auth/auth-http.test.js`.

**Current User Coverage:**

- Valid USER and ADMIN session → `200` public identity under `data`.
- Missing, empty, malformed, unknown, expired and deleted session → same `401/AUTHENTICATION_FAILED`.
- Existing session pointing to inactive or missing user is rejected.
- Client body/query/header values for `user_id`, `owner_id`, `role` cannot replace session owner identity.
- End-to-end register → login → `/me` identity.

**Logout Coverage:**

- Valid logout deletes only current session, clears `session_id` at `Path=/`, returns empty `204`.
- Other session for same user remains valid through `/me`.
- Missing, empty, malformed, unknown, expired, deleted and repeated logout are idempotent `204` and clear cookie.
- Logout response excludes raw/persisted session identifiers.
- After logout, invalidated cookie fails `/me`.

**Session/Time Coverage:**

- Expired state uses fixed past timestamp fixture.
- Valid state uses login or sufficiently future timestamp.
- No sleep or timing race.

**Acceptance Criteria:**

- SPEC-010 AC-09 through AC-13 evidence is produced.
- Multiple sessions persist independently.
- Current-session deletion leaves unrelated session rows intact.
- Middleware prevents success/controller behavior after auth failure.

**Verification:**

- Run Authentication suite twice consecutively.
- Verify both runs pass and leave no test fixture rows.

---

#### TASK-010-08 — Implement focused Authentication component, role and error tests

**Dependencies:** TASK-010-02, existing Authentication factories.

**Files:**

- Create `backend/test/auth/auth-components.test.js`.

**Service/Controller Coverage:**

- Prisma-style registration `P2002` maps to `EMAIL_ALREADY_EXISTS`.
- Logout delete race `P2025` remains idempotent.
- Unexpected repository/password error propagates unchanged.
- Controller forwards unexpected register/login errors.
- Logout controller clears cookie before forwarding unexpected persistence error.
- Do not assert unapproved final HTTP error response.

**Authentication Middleware Coverage:**

- Valid session result assigns only public `id`, `email`, `display_name`, `role` identity and calls downstream once.
- Known auth failure returns `401` and does not call downstream controller.
- Unexpected service error reaches `next(error)` unchanged.
- Client-controlled identity does not establish or override `req.user`.

**Role Authorization Coverage:**

- Allowed USER and ADMIN continue.
- USER receives `403/FORBIDDEN` for ADMIN-only policy.
- ADMIN continues for ADMIN-only policy.
- Unknown/unapproved role receives `403` even when caller-provided allowed list includes it.
- Role authority is authenticated `req.user`, not body/query/header.
- Missing `req.user` forwards approved programming/composition error.

**Sensitive Log Coverage:**

- Temporarily capture console log/info/warn/error around representative flows.
- Assert unique synthetic password/raw token markers absent.
- Restore all console methods in `finally`; tests remain sequential.
- Assertion messages do not interpolate secret markers.

**Acceptance Criteria:**

- SPEC-010 AC-11, AC-14, AC-15 and AC-16 focused evidence is produced.
- Focused tests cover behavior not already adequately proven by HTTP suite.
- No implementation-detail call-order assertions without security/state justification.

**Verification:**

- Run component tests through `npm run test:auth`.
- Inject unexpected errors and confirm exact error object reaches `next`/rejection.

---

#### TASK-010-09 — Add deferred contract inventory

**Dependencies:** TASK-010-02.

**Files:**

- Create `backend/test/auth/deferred-contracts.test.js`.
- Update `backend/test/README.md` created within TASK-010.

**Required TODO Entries:**

- Malformed JSON final JSON response.
- Unexpected HTTP error final JSON response.
- Credentialed CORS policy/headers.
- CSRF mechanism/behavior.
- Cookie `SameSite`.
- Cookie `Domain`.

**Implementation Requirements:**

- Use explicit `test.todo()` with missing approval/dependency named.
- TODO must be reported separately and never represented as passing evidence.
- Current cookie attributes (`session_id`, `HttpOnly`, `Path`, `Max-Age`, conditional `Secure`) remain normal required tests, not TODO.
- No centralized handler, CORS, CSRF or topology implementation.

**Acceptance Criteria:**

- Deferred items are visible in runner output and README.
- Activation condition is documented: approved contract/topology plus corresponding implementation.
- No invented expected value/body/policy.

**Verification:**

- Run Authentication suite and confirm TODO count/labels are visible separately from pass count.

---

#### TASK-010-10 — Verify complete suite, repeatability, safety and scope

**Dependencies:** TASK-010-01 through TASK-010-09.

**Files:**

- No additional production module expected.
- Only correct files created/modified earlier in TASK-010 if verification finds an in-scope defect.

**Implementation Requirements:**

- Prepare only explicitly authorized test database.
- Run Authentication suite twice, then full backend suite.
- Verify fail-safe guard paths before destructive operations.
- Verify health route/startup behavior after app extraction.
- Verify no sensitive output and no residual fixture rows.
- Inspect Git diff for schema/API/business behavior/package-lock scope.
- Report build/lint as `NOT AVAILABLE` because scripts do not currently exist.

**Acceptance Criteria:**

- All runnable AC-01 through AC-20 tests pass.
- TODOs remain clearly deferred, not PASS.
- Consecutive runs are deterministic and cleanup succeeds.
- Unsafe/missing DB configuration fails before mutation.
- Package lock, schema/migrations and expected-unchanged Authentication modules have no diff.
- Production startup, health route and four Authentication endpoints remain behaviorally unchanged.

**Verification Commands:**

```text
npm run test:db:prepare
npm run test:auth
npm run test:auth
npm test
```

Formal execution results belong to TEST-010; TASK stage does not claim these commands passed.

### Dependency Graph

```text
TASK-010-01 App boundary ───────────────┐
                                       ├──→ TASK-010-04 HTTP/fixtures
TASK-010-02 Runner/environment ──┬─────┘             │
                                ├──→ TASK-010-03 DB lifecycle
                                ├──→ TASK-010-05 Password tests
                                └──→ TASK-010-09 Deferred TODOs

TASK-010-03 + TASK-010-04 + TASK-010-05
                    ↓
              TASK-010-06 Register/Login
                    ↓
              TASK-010-07 Me/Logout/Sessions

TASK-010-02 + existing auth factories
                    ↓
              TASK-010-08 Components/Role/Errors

TASK-010-01 ... TASK-010-09
                    ↓
              TASK-010-10 Full verification
```

TASK-010-05, TASK-010-08 and TASK-010-09 may be implemented independently after TASK-010-02 because they do not require the database HTTP flow. Database-mutating work remains sequential.

### SPEC-010 Acceptance Criteria Traceability

| SPEC-010 AC | Executable responsibility |
|---|---|
| AC-01 | TASK-010-06/07 real HTTP coverage for register, login, logout and `/me` |
| AC-02 | TASK-010-06 valid registration, defaults, normalized persistence, no cookie/session |
| AC-03 | TASK-010-06 invalid matrix, normalized duplicate and DB race/P2002 behavior |
| AC-04 | TASK-010-05/06 scrypt format/verify and persisted non-plaintext hash |
| AC-05 | TASK-010-06 valid active login identity and current cookie attributes |
| AC-06 | TASK-010-06 32-byte raw token, SHA-256-only persistence and 7-day expiry |
| AC-07 | TASK-010-06 identical unknown/wrong/inactive failure and no session |
| AC-08 | TASK-010-06 two independent simultaneous sessions |
| AC-09 | TASK-010-07 `/me` for persisted USER/ADMIN identity |
| AC-10 | TASK-010-07 invalid/expired/deleted/inactive/missing-user session matrix |
| AC-11 | TASK-010-07/08 forged identity/role cannot replace session identity |
| AC-12 | TASK-010-07 current-session-only logout and second-session survival |
| AC-13 | TASK-010-07/08 idempotent logout matrix and P2025 race |
| AC-14 | TASK-010-08 USER/ADMIN/disallowed/unknown role matrix |
| AC-15 | TASK-010-06/07/08 response, persistence and captured-output leak checks |
| AC-16 | TASK-010-06/08 known mappings and unchanged unexpected-error propagation |
| AC-17 | TASK-010-02/03/04/10 dedicated DB, cleanup, sequential repeat runs |
| AC-18 | TASK-010-02/09/10 exit codes and explicit PASS/FAIL/TODO/NOT AVAILABLE reporting |
| AC-19 | TASK-010-06/07 primary HTTP ownership; TASK-010-05/08 only focused added-value coverage |
| AC-20 | TASK-010-01/10 minimal app extraction and schema/API/business/package-lock diff checks |

All SPEC-010 AC-01 through AC-20 map to at least one executable subtask. No new business acceptance criterion is introduced.

### Overall Acceptance Criteria

- Importable Express app boundary exists without listener side effect or production behavior change.
- Node built-in test suite and approved commands are available without new dependency.
- Dedicated test DB guards fail safely and redact credentials.
- Backend tests cover four endpoints, persistence, password/session security, middleware, authorization and identity boundary.
- Invalid credential variants do not reveal account state.
- Plaintext password, password hash, session hash and raw token do not leak outside approved boundaries.
- Logout covers valid, missing, malformed, unknown, expired, deleted and repeated sessions.
- Database cleanup is FK-safe, repeatable and leaves no fixture data.
- All runnable SPEC-010 ACs have passing evidence after IMPLEMENT/TEST.
- Centralized-error and topology-dependent items remain explicit TODOs until separately approved.
- No API/schema/migration/Auth behavior/frontend/unrelated change is introduced.

### Verification Handoff

TEST-010 must record:

- Node/npm/runtime versions.
- Dedicated database preparation result without revealing URL.
- First and second `npm run test:auth` results.
- Full `npm test` result.
- Passed/failed/TODO counts.
- Database guard and cleanup evidence.
- Sensitive-data checks.
- Health/startup/API regression result.
- `git diff --check` and scope review.
- Build: `NOT AVAILABLE` unless a script exists under separately approved work.
- Lint: `NOT AVAILABLE` unless a script exists under separately approved work.

### Traceability

- Feature SPEC: `docs/specs/AUTHENTICATION_SPEC.md`.
- Feature PLAN: `docs/plans/AUTHENTICATION_PLAN.md`.
- Feature TASK: TASK-001 through TASK-009 implementation dependencies in this document.
- SPEC-010: `docs/specs/BACKEND_AUTHENTICATION_TESTS_SPEC.md`, AC-01 through AC-20.
- PLAN-010: `docs/plans/BACKEND_AUTHENTICATION_TESTS_PLAN.md`, technical decisions, layer allocation, file plan, commands and verification strategy.
- TASK-009: `docs/tasks/AUTHENTICATION_ROUTES_TASK.md`, final route/composition contract.
- Architecture: `docs/ARCHITECTURE.md`, backend layering/testing/error boundary.
- Database: `docs/DATABASE.md`, `USER`/`AUTH_SESSION` relationship and constraints.
- API: `docs/API_SPEC.md`, Authentication endpoint/status/security contract and known discrepancies recorded by SPEC-010.
- Feature status: `docs/FEATURE_STATUS.md`, Authentication remains `IN_PROGRESS`.
- AGENTS: Testing, Verification, Security, Minimal Change and approval rules.

### Approval Gate

```text
TASK-010 STATUS: READY FOR HUMAN REVIEW
IMPLEMENTATION: NOT STARTED
TEST-010: NOT STARTED
REVIEW-010: NOT STARTED
```

Human approval is required before IMPLEMENT. TASK-010 authoring does not approve or execute any subtask.

---

## TASK-011 — Implement frontend Auth API service and authentication state

### Status

- TASK definition: `CLARIFIED`.
- Corrective PLAN `TASK011-B01`: `APPROVED` on `2026-09-18`.
- TASK-011 human approval: `APPROVED` on `2026-09-18`.
- IMPLEMENT: `AUTHORIZED AS NEXT STAGE`, not started by this approval action.

### Objective

Kết nối frontend với Authentication API bằng relative `/api/**`, cung cấp shared Authentication state và khởi tạo authoritative identity từ backend mà không mở rộng sang UI, navigation hoặc production deployment.

### Dependencies

- TASK-009.
- Human-approved corrective Authentication PLAN resolving `TASK011-B01`.

### Files / Modules

- `frontend/vite.config.js` — minimum development proxy configuration for `/api/**`.
- Existing frontend application bootstrap entry (`frontend/src/main.jsx` and/or the narrow bootstrap integration point required by the selected shared-state structure).
- Frontend Auth API service module according to the implementation structure established under `frontend/src/`.
- Frontend shared Authentication state/context module according to the implementation structure established under `frontend/src/`.
- TASK-011 frontend test files and minimal test configuration.
- `frontend/package.json` and `frontend/package-lock.json` only when required to add the minimum approved test tooling.
- Do not invent page/component paths or create UI structure for TASK-012/TASK-013.

### In Scope

- `authService.register` using `POST /api/auth/register`.
- `authService.login` using `POST /api/auth/login`.
- `authService.logout` using `POST /api/auth/logout`.
- `authService.getCurrentUser` using `GET /api/auth/me`.
- All browser-facing Authentication calls use relative `/api/**` paths.
- App initialization using authoritative `GET /api/auth/me`.
- Authentication state:
  - `user`;
  - `isAuthenticated`;
  - `isLoading`;
  - authentication/operational error state.
- Explicit initialization and service-driven state transitions.
- Browser-managed cookie credentials.
- UX email normalization only.
- Minimum Vite development proxy for `/api/**` to the local Express backend.
- Minimum frontend test infrastructure needed to verify TASK-011.

### Out of Scope

- Reading, extracting, synthesizing or persisting the raw session token.
- `localStorage`, `sessionStorage` or bearer-token Authentication.
- Client-side security enforcement.
- XP/level/streak/progress calculation.
- New API endpoints.
- Backend Authentication business/API changes.
- CORS middleware or credentialed browser CORS.
- CSRF token/library.
- JWT or refresh-token architecture.
- Login/Register pages, forms, layout, styling or visual state presentation; these belong to TASK-012.
- Protected navigation, authenticated navigation and logout UI; these belong to TASK-013.
- Vercel project creation/configuration, production rewrite configuration, backend Vercel entry point, deployment secrets, production Supabase setup and production deployment verification.
- `docs/ARCHITECTURE.md` synchronization; the known deployment-baseline conflict follows a separate approved documentation/architecture workflow.

### Implementation Requirements

#### API base and credential transport

- Authentication does not consume `VITE_API_URL` as a browser backend origin.
- Authentication endpoint paths remain relative `/api/auth/**` in development and production.
- The backend Vercel project origin must not be embedded in the browser Authentication client.
- Browser manages `session_id`; frontend code does not read the HttpOnly cookie.
- No `Authorization` bearer token is created from cookie/session state.
- Same-origin requests may use the browser's same-origin credential behavior; implementation must not introduce cross-origin credential configuration as an architectural dependency.

#### Development proxy

- Configure Vite to proxy `/api/**` to the local Express backend.
- Default local proxy target aligns with the existing backend default: `http://localhost:5000`.
- Any optional proxy-target override must remain Vite server-side development configuration and must not become a browser-facing Auth API base URL.
- Browser continues to request relative `/api/**`; it must not call the local backend origin directly.
- No application CORS implementation is required for this development flow.

#### Register

- Send only approved backend registration fields: `display_name`, `email`, `password`.
- Frontend may lowercase email for UX; backend remains authoritative for normalization and validation.
- Successful registration does not create a session and must not set authenticated state, fabricate a user session or persist a token.
- `confirm_password` handling and Register presentation belong to TASK-012.

#### Login

- Backend owns credential validation and session creation.
- Frontend consumes only approved public identity from the response.
- Successful login may populate shared `user` and set `isAuthenticated = true` from the backend response.
- Frontend must never extract, read, persist or synthesize `session_id`.

#### Logout

- Call the approved idempotent logout endpoint without a raw token.
- After successful logout, clear shared identity: `user = null`, `isAuthenticated = false`.
- Logout UI and post-logout navigation belong to TASK-013.

#### Current user and bootstrap

- Initial state starts unresolved with `isLoading = true`.
- Valid `/api/auth/me` response sets `user` to backend public identity, `isAuthenticated = true`, `isLoading = false` and clears stale auth error state.
- Missing, invalid or expired Authentication sets `user = null`, `isAuthenticated = false`, `isLoading = false` and represents Guest rather than an operational failure.
- Unexpected network/server/operational failure sets `user = null`, `isAuthenticated = false`, `isLoading = false` and preserves an operational error state; it must not fabricate authenticated identity or silently classify every failure as a valid session.
- A later authentication failure/session expiration transitions shared state to Guest.

#### Authority and security

- Backend remains authoritative for authentication, identity, role, account state and session validity.
- Frontend role/state is presentation input only and is not an authorization boundary.
- Frontend validation and lowercase normalization do not replace backend validation.
- Selected topology uses `HttpOnly`, production `Secure`, `SameSite=Lax`, `Path=/` and no explicit `Domain`; TASK-011 does not modify backend cookie behavior.
- Do not add credentialed CORS or a CSRF token/library for the approved same-origin topology.
- If implementation discovers a required backend correction, stop and route it through the appropriate workflow instead of expanding TASK-011.

#### Test tooling

- Repository currently has no frontend test runner/script.
- Implementation may choose the minimum Node/React-compatible frontend test tooling allowed by the approved PLAN.
- Only required package metadata, lockfile, minimal test configuration and TASK-011 tests may be added.
- Do not create a broad frontend testing platform or select tooling during TASK clarification.

### Acceptance Criteria

- **AC-011-01:** Auth service exposes register, login, logout and getCurrentUser using exactly the approved relative `/api/auth/**` endpoints.
- **AC-011-02:** Authentication service does not use an absolute backend origin or `VITE_API_URL` as its browser API base.
- **AC-011-03:** Vite development configuration proxies `/api/**` to the local Express backend while browser requests remain same-origin and relative.
- **AC-011-04:** App bootstrap starts loading and resolves valid `/api/auth/me` identity to `user`, `isAuthenticated = true`, `isLoading = false`.
- **AC-011-05:** Missing, invalid or expired session resolves to Guest with `user = null`, `isAuthenticated = false`, `isLoading = false`.
- **AC-011-06:** Unexpected bootstrap operational failure resolves loading, keeps unauthenticated state and exposes operational error state without fabricating identity.
- **AC-011-07:** Registration success does not authenticate, create frontend session state or persist a credential.
- **AC-011-08:** Login success derives shared authenticated state only from approved backend public identity while the browser manages the cookie.
- **AC-011-09:** Logout calls the idempotent endpoint and successful completion clears shared identity without implementing logout UI/navigation.
- **AC-011-10:** Session expiration/authentication failure after initialization transitions shared state to Guest.
- **AC-011-11:** Frontend lowercase email behavior is UX normalization only and does not replace backend authority.
- **AC-011-12:** Frontend does not read, return, log, persist or synthesize raw session tokens and does not create bearer-token Authentication.
- **AC-011-13:** No backend Authentication behavior, CORS/CSRF mechanism, production deployment configuration, Login/Register UI or protected-navigation UI is added.
- **AC-011-14:** Relevant TASK-011 automated tests pass, frontend build succeeds and frontend lint succeeds when available.

### Testing Requirements

- Bootstrap with valid session.
- Bootstrap with missing, invalid and expired session.
- Unexpected operational bootstrap failure.
- Register service success/error behavior and no-auto-login invariant.
- Login service success/error behavior and public-identity state transition.
- Logout service behavior and state cleanup.
- getCurrentUser success/error behavior.
- Session-expiration transition to Guest.
- UX email lowercase normalization without treating it as security enforcement.
- Raw session token is never persisted or exposed by frontend state/service.
- Relative `/api/**` endpoint construction.
- Development proxy boundary/config behavior where the selected test approach can verify it deterministically.
- Frontend build and lint.

### Traceability

- SPEC: `4. User Flow`, `8. Acceptance Criteria`.
- PLAN: `6. Credential Lifecycle`, `12. Thiết kế Frontend`, `Corrective topology decision — TASK011-B01`.
- API_SPEC: `5. Authentication`, `6. Login`, `7. Current User`.

### Design Gate

- Classification: `B — FRONTEND without material UI/UX decisions`.
- Design Gate before TASK-011 IMPLEMENT: `NOT REQUIRED`.
- This classification does not apply automatically to TASK-012 or TASK-013.

### Verification Gate

- Confirm only approved frontend service/state/bootstrap, Vite development proxy and minimum test surfaces changed.
- Confirm no backend production source or production deployment configuration changed.
- Run relevant TASK-011 frontend automated tests.
- Run frontend build.
- Run frontend lint.
- Verify no raw credential appears in frontend storage, state or test output.
- Formal TEST and REVIEW remain separate workflow stages after IMPLEMENT.

### Approval Gate

```text
TASK-011: APPROVED
HUMAN APPROVAL RECORDED: 2026-09-18
IMPLEMENT: AUTHORIZED AS NEXT STAGE
IMPLEMENTATION: NOT STARTED
```

Human approval has been recorded for the clarified TASK-011 boundary. Approval authorizes IMPLEMENT as the next workflow stage but does not start implementation.

---

## TASK-012 — Implement Login and Register pages/forms

### Objective

Tạo UI cho approved Login/Register flows và form validation.

### Dependencies

- TASK-011.

### Files / Modules

- Existing frontend pages/components structure.

### In Scope

- Login page:
  - email;
  - password;
  - show/hide password;
  - validation/error/loading states.

- Register page:
  - `display_name`;
  - email;
  - password;
  - `confirm_password`;
  - client-side mismatch validation;
  - success/error/loading states.

- Redirects:
  - Register success → Login;
  - Login success → Dashboard.

### Out of Scope

- Username field.
- Password reset/recovery.
- Email verification.
- Social login/MFA.
- Profile or settings screens.

### Implementation Requirements

- `confirm_password` is client-side only and is not persisted.
- Form errors must not expose sensitive account information.
- Use approved API service and shared UI patterns where available.

### Acceptance Criteria

- Valid Register submission reaches `POST /api/auth/register`.
- Password mismatch is rejected client-side.
- Valid Login reaches `POST /api/auth/login`.
- Successful Register redirects to Login without auto-login.
- Successful Login redirects to Dashboard.
- Loading and API error states are visible and do not duplicate submissions.

### Testing Requirements

- Required-field validation.
- Password length UX validation.
- `confirm_password` mismatch.
- Password visibility toggle.
- Register/Login success and error states.
- Redirect behavior.

### Traceability

- SPEC: `2. Actors`, `4. User Flow`, `7. API Requirements`, `8. Acceptance Criteria`.
- PLAN: `12. Thiết kế Frontend`.
- UI/UX: Login and Register screen requirements.

---

## TASK-013 — Implement protected navigation, Admin visibility and Logout UI

### Objective

Enforce frontend navigation behavior and present authenticated/Admin UI states without treating frontend as security boundary.

### Dependencies

- TASK-011.
- TASK-012.

### Files / Modules

- Existing app navigation/routes/layout modules.
- Existing shared UI components where available.

### In Scope

- Protected navigation loading state.
- Guest redirect from protected screens to Login.
- Admin navigation visibility based on backend-provided identity.
- USER does not see Admin navigation.
- Logout action through `authService.logout`.
- Reset auth state after Logout.
- Session-expired UI state.

### Out of Scope

- Backend authorization replacement.
- Admin user management.
- Logout-all-devices.
- Session management UI.
- Device history.

### Implementation Requirements

- Hidden navigation is UX only; backend enforces access.
- Logout must work with the idempotent `204 No Content` behavior.
- No raw token access or storage in frontend.

### Acceptance Criteria

- Auth initialization does not render protected content before state is known.
- Guest is redirected to Login.
- Admin navigation visibility follows authenticated identity.
- Logout clears local auth state and returns user to Guest/Landing or Login according to approved flow.
- Expired session returns user to Guest flow.

### Testing Requirements

- Protected navigation.
- Guest redirect.
- USER/Admin navigation visibility.
- Logout success and repeated logout.
- Session expiration handling.

### Traceability

- SPEC: `2. Actors`, `4. User Flow`, `8. Acceptance Criteria`.
- PLAN: `9. Thiết kế Authorization`, `12. Thiết kế Frontend`.
- UI/UX: authenticated navigation, Login/Register and global states.

---

## TASK-014 — Frontend Authentication tests

### Objective

Kiểm thử frontend Authentication behavior sau khi service, state và UI được triển khai.

### Dependencies

- TASK-012.
- TASK-013.

### Files / Modules

- Existing frontend test infrastructure.
- Authentication component/service/state test modules.

### In Scope

- Register form validation.
- Login form validation.
- `confirm_password` mismatch.
- Auth initialization.
- Protected navigation and Guest redirect.
- Login/Register redirects.
- Logout state cleanup.
- Admin navigation visibility.
- API error/loading states.
- No raw session token in frontend storage or response handling.

### Out of Scope

- New frontend test framework without approval.
- Tests for unapproved UI features.
- Backend security implementation tests.

### Acceptance Criteria

- Frontend tests cover approved Login/Register/auth state flows.
- Protected navigation and role visibility behavior are verified.
- Logout and expired-session behavior are verified.
- Frontend does not rely on UI checks as backend authorization.

### Testing Requirements

- Run relevant frontend tests during TEST stage.
- Run frontend lint/build where available.
- Record missing test infrastructure honestly.

### Traceability

- SPEC: `8. Acceptance Criteria`, `9. Edge Cases`.
- PLAN: `12. Thiết kế Frontend`, `13. Chiến lược Testing`.

---

## TASK-015 — Authentication integration and security verification

### Objective

Verify the complete Authentication flow across backend, frontend, database session persistence and deployment-dependent security configuration.

### Dependencies

- TASK-010.
- TASK-014.
- Database/schema implementation from TASK-001.

### Files / Modules

- No new feature module required; verification spans approved implementation areas.

### In Scope

- Register → Login → Dashboard flow.
- Login → `/api/auth/me` flow.
- Logout current session.
- Multiple sessions for one User.
- Expired/deleted/malformed session behavior.
- USER/ADMIN protected access.
- Authenticated identity/security boundary.
- Cookie `session_id` and raw token exclusion.
- Deployment topology verification:
  - origins;
  - same-origin/cross-origin;
  - same-site/cross-site;
  - credentialed CORS;
  - cookie attributes;
  - CSRF requirement.

- API status recommendations and validation status.

### Out of Scope

- Production deployment changes.
- New infrastructure.
- Performance platform work.
- Features outside Authentication.
- Resource-specific ownership rules implemented by individual domain features.

### Acceptance Criteria

- End-to-end approved Authentication flow works.
- Raw session token and password data are never returned or persisted incorrectly.
- Logout invalidates only current session and remains idempotent.
- Protected endpoints enforce authentication and role authorization.
- Authenticated identity is established only from validated server-side session state.
- Cookie/CORS/CSRF configuration matches verified topology.
- No scope expansion or unapproved mechanism is introduced.

### Testing Requirements

- Run backend and frontend test suites.
- Run API/integration tests.
- Run build/lint checks where available.
- Record unresolved environment limitations.

### Traceability

- SPEC: all Authentication acceptance criteria.
- PLAN: `4. Tác động kiến trúc`, `6. Credential Lifecycle`, `9. Thiết kế Authorization`, `13. Chiến lược Testing`, `16. Risks và Edge Cases`.
- DATABASE: `USER`, `AUTH_SESSION`, relationship, constraints and approved initial database scope.
- API_SPEC: Authentication endpoint inventory and authorization/security rules.

---

# 6. Cross-Cutting Security Requirements

- Backend là security boundary.
- Chỉ có role `USER` và `ADMIN`; Guest là unauthenticated state.
- Password dùng `node:crypto` `scrypt`, salt cryptographically secure, không plaintext và không log.
- `password_hash` chứa metadata cần thiết để verify.
- Session token là 32 random bytes từ cryptographically secure random generator.
- Chỉ SHA-256 hash của session token được lưu trong `AUTH_SESSION`.
- Raw session token không được log, lưu database, lưu frontend hoặc trả trong JSON.
- Cookie name duy nhất là `session_id`.
- Cookie là HTTP-only; `Secure` bật trong production/HTTPS.
- Domain/SameSite/Path không hard-code trước deployment topology verification.
- Credentialed CORS không dùng wildcard origin.
- `HttpOnly` không phải CSRF protection.
- Nếu frontend/backend khác site và credentialed cookie requests, CSRF protection là bắt buộc trước IMPLEMENT.
- Không tin `user_id`, `owner_id` hoặc `role` do client gửi.
- Backend authoritative với account status, role, ownership và business data.
- Authentication cung cấp authenticated identity; domain feature chịu trách nhiệm resource-specific ownership.
- Logout chỉ xóa current session và không có logout-all-devices.

---

# 7. Out of Scope

- JWT.
- Refresh token.
- OAuth/social login.
- MFA.
- Password reset/recovery.
- Email verification.
- Premium/subscription.
- Redis.
- Microservice.
- Background worker phức tạp.
- Session history.
- Device history.
- Logout-all-devices.
- IP/user-agent/device tracking.
- Account deletion.
- Role mới.
- Admin user management.
- Session management UI.
- Resource-specific ownership implementation của các domain feature khác.
- Các Authentication feature chưa được approved.

---

# 8. Open Issues / Conflicts

- `docs/SYSTEM_OVERVIEW.md` không tồn tại; `docs/PROJECT_OVERVIEW.md` được dùng làm tài liệu system-level tương ứng.
- Repository SPEC có thể còn hiển thị metadata `SPEC status: DRAFT` nếu chưa được đồng bộ metadata, trong khi workflow đã xác nhận SPEC APPROVED. Đây là metadata conflict, không thay đổi source documents trong TASK.
- `API_SPEC.md` cũ còn dùng `username` trong phần Authentication, trong khi approved SPEC/PLAN dùng `display_name`. TASK theo approved SPEC/PLAN và không sửa `API_SPEC.md`.
- `API_SPEC.md` cho phép status code `422` trong danh sách chung và chưa quy định rõ success status Authentication; approved PLAN chốt validation `400 Bad Request` và success recommendations `201/200/204/200`. TASK theo PLAN và không sửa `API_SPEC.md`.
- `FEATURE_STATUS.md` vẫn ghi Authentication `TODO` dù workflow đã đi tới TASK. TASK không sửa status; status update thuộc workflow stage phù hợp.
- Testing framework, exact module paths và một số implementation details chưa tồn tại trong source hiện tại. TASK không tự chọn dependency hoặc invent path; implementation phải follow approved PLAN và existing structure.
- `USER` đã được approved trong `docs/DATABASE.md` nhưng hiện chưa được materialize trong Prisma schema. TASK-001 chịu trách nhiệm materialize `USER` cùng với `AUTH_SESSION`.
- `AUTH_SESSION` đã được approved và documented trong `docs/DATABASE.md`; không cần tạo hoặc đồng bộ lại entity này trong database documentation.

Không có conflict nào làm thay đổi approved Authentication architecture trong TASK này.

---

# 9. Final Validation Checklist

## Scope

- [x] Tasks chỉ thuộc approved Authentication scope.
- [x] Không thêm JWT, refresh token, OAuth, MFA, Redis hoặc feature ngoài scope.
- [x] Không thêm role mới.
- [x] Không thêm `AUTH_SESSION` field ngoài `DATABASE.md`.
- [x] Không redesign `USER` ngoài approved database design.
- [x] Resource-specific ownership không bị kéo vào Authentication implementation.

## Architecture

- [x] Stateful server-side session được bảo toàn.
- [x] Layering Route → Middleware → Controller → Service → Repository/Data Access → Prisma → PostgreSQL được bảo toàn.
- [x] Auth Service không set/clear HTTP cookie.
- [x] Controller/HTTP layer chịu trách nhiệm cookie transport.
- [x] Authentication chịu trách nhiệm identity và role authorization.
- [x] Domain feature chịu trách nhiệm resource-specific ownership.
- [x] Authorization được enforce ở backend.

## Security

- [x] Password `scrypt` và secure salt được phản ánh.
- [x] Raw session token không lưu database/frontend/log/response.
- [x] SHA-256 hash và 32-byte token được phản ánh.
- [x] Cookie `session_id` và HTTP-only được phản ánh.
- [x] CORS/CSRF/deployment topology requirements được phản ánh.
- [x] Không trust client identity hoặc authoritative business values.

## API

- [x] Bốn Authentication endpoints được trace.
- [x] Không tạo duplicate endpoint.
- [x] Status recommendations và validation status theo PLAN.
- [x] Không tự sửa API contract.

## Database

- [x] `USER` được materialize theo approved `DATABASE.md`.
- [x] `AUTH_SESSION` khớp `DATABASE.md`.
- [x] `USER 1:N AUTH_SESSION` được trace.
- [x] Unique hash và foreign key được phản ánh.
- [x] Không thêm session metadata ngoài approved design.
- [x] Không yêu cầu thay đổi database documentation trong TASK.

## Testing

- [x] Backend unit tests được phân rã.
- [x] API/integration tests được phân rã.
- [x] Frontend Authentication tests được phân rã.
- [x] Security-sensitive behavior có test requirement.
- [x] Resource-specific ownership testing không bị gán nhầm cho Authentication.

## Traceability

- [x] Mỗi task có SPEC/PLAN/DATABASE/API traceability phù hợp.
- [x] Không tạo requirement ID giả.
- [x] Conflict được ghi nhận thay vì âm thầm sửa.

## Workflow

- [x] Không viết implementation code.
- [x] Không tạo migration trong TASK authoring stage.
- [x] Không cài dependency.
- [x] Không tạo file implementation ngoài TASK này.
- [x] Không sửa SPEC, PLAN, DATABASE hoặc FEATURE_STATUS.
- [x] Không chuyển sang IMPLEMENT.
- [x] TASK chỉ được chuyển sang IMPLEMENT sau khi developer review và approve.
