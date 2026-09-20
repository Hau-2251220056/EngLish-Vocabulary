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

### Status

- TASK definition: `APPROVED`.
- Human UI Gate: `PASSED`.
- Human library decision: `APPROVED`.
- Human visual design and interaction model: `APPROVED`.
- Human product name decision: `APPROVED — ELVocab`.
- Routing decision: `APPROVED — React Router`.
- TASK-012: `APPROVED`.
- Human TASK approval: `APPROVED` on `2026-09-18`.
- IMPLEMENT: `COMPLETE`.
- TEST: `PASS`.
- REVIEW: `APPROVED`.
- TASK-012 status: `DONE`.

### Objective

Implement the approved ELVocab Login/Register experience on top of the completed TASK-011 Authentication service and shared state. Provide accessible form validation, loading, API-error and registration-success states without duplicating Authentication infrastructure or expanding into protected navigation.

### Dependencies

- TASK-011 — `DONE`.
- Approved Authentication SPEC and corrected PLAN.
- Human-approved ELVocab Auth visual design and interaction model.
- Human-approved UI/form dependencies listed below.
- Human-approved React Router foundation and route boundary defined in this task.

### Files / Modules

Modify:

- `frontend/package.json` — add only the approved TASK-012 UI/form dependencies.
- `frontend/package-lock.json` — lock the approved dependency versions installed during IMPLEMENT.
- `frontend/src/App.jsx` — remain the application composition root and compose the dedicated router without containing detailed form or Dashboard markup.
- `frontend/src/index.css` — retain Tailwind CSS 4 setup and add only minimal global/base styling if the approved design cannot be expressed locally.
- `frontend/src/app-router.jsx` — define the minimum application routes for `/`, `/login`, `/register` and `/dashboard` using React Router.

Create under the existing `frontend/src/auth/` feature boundary:

- `frontend/src/auth/ui/auth-page.jsx` — coordinate Login/Register UI mode, registration-success handoff and feature composition.
- `frontend/src/auth/ui/auth-shell.jsx` — persistent bounded Auth shell and responsive two-region layout.
- `frontend/src/auth/ui/vocabulary-experience.jsx` — approved `resilient`/`curious` learning preview and pronunciation affordance.
- `frontend/src/auth/ui/login-form.jsx` — Login form lifecycle and TASK-011 `login` integration.
- `frontend/src/auth/ui/register-form.jsx` — Register form lifecycle and TASK-011 `register` integration.
- `frontend/src/auth/ui/form-field.jsx` — shared labelled input, hint and inline-error presentation where repetition justifies it.
- `frontend/src/auth/ui/password-field.jsx` — accessible password input and visibility toggle.
- `frontend/src/auth/ui/form-alert.jsx` — form-level authentication/API/operational error presentation.
- `frontend/src/auth/ui/success-toast.jsx` — minimum custom registration-success toast; no toast library.
- `frontend/src/auth/validation/auth-schemas.js` — shared Login/Register Zod schemas and Vietnamese field-validation messages.
- `frontend/src/auth/ui/auth-error-messages.js` — stable backend error-code/kind to Vietnamese UI presentation mapping.
- `frontend/src/pages/dashboard-placeholder.jsx` — minimum semantic `/dashboard` destination required for the successful Login handoff; not a Dashboard feature implementation.

Existing TASK-011 modules remain in place and authoritative:

- `frontend/src/auth/auth-provider.jsx`.
- `frontend/src/auth/auth-store.js`.
- `frontend/src/auth/authentication-context.js`.
- `frontend/src/auth/use-authentication.js`.
- `frontend/src/services/auth-service.js`.
- `frontend/src/services/http-client.js`.

Exact file consolidation is allowed during IMPLEMENT only when it preserves these responsibilities and avoids trivial one-line components. TASK-011 modules must not be relocated merely for directory aesthetics.

### In Scope

- One persistent responsive Auth shell with Login and Register as internal UI states.
- Approved vocabulary learning experience using `resilient` for Login and `curious` for Register.
- Login fields: email and password.
- Register fields: `display_name`, email, password and frontend-only `confirm_password`.
- React Hook Form lifecycle and Zod validation through `zodResolver`.
- Accessible password visibility controls using Lucide `Eye`/`EyeOff`.
- Inline Vietnamese field-validation messages.
- Form-level Vietnamese Authentication/API/operational error presentation.
- Loading, disabled and duplicate-submit prevention states.
- Registration success toast followed by the approved Register → Login transition after approximately 1–1.5 seconds.
- Prefill the successfully registered email in Login and clear password values.
- React Router application foundation for `/login`, `/register` and the minimum `/dashboard` destination.
- Login-success navigation to `/dashboard`.
- Desktop coordinated panel exchange, mobile simplified transition and reduced-motion behavior.
- Minimum reusable Auth/form primitives required by actual repetition.

### Out of Scope

- Username field.
- Password reset/recovery.
- Email verification.
- Social login/MFA.
- Profile or settings screens.
- Google OAuth or a fake Google sign-in control.
- A fake or inactive “Forgot password” link.
- Protected route enforcement, Guest redirect, authenticated application navigation, Admin visibility, logout UI and expired-session navigation; these remain TASK-013.
- Formal frontend Authentication test coverage owned by TASK-014.
- Another Axios client, Auth service, global Auth store or token architecture.
- Raw `session_id` access, `document.cookie`, Authentication storage, JWT or Bearer tokens.
- Backend/API/database changes.
- SameSite/CORS/CSRF/deployment work.
- A general-purpose design system, UI component library, toast library or animation library.
- Real Dashboard feature content, authenticated application shell or navigation.

### Implementation Requirements

#### Integration boundary

- Forms consume `register` and `login` through the existing `useAuthentication()` public interface.
- Forms do not import Axios or create a second service/state layer.
- Backend identity returned through TASK-011 remains authoritative.
- Email lowercase normalization remains owned by the existing Auth service; forms must not create conflicting normalization.

#### Libraries

- Use React custom components, Tailwind CSS 4 and Lucide React.
- Use `react-hook-form`, `zod`, `@hookform/resolvers` and `zodResolver`.
- Do not add any dependency other than `lucide-react`, `react-hook-form`, `zod`, `@hookform/resolvers` and `react-router-dom` without new human approval.
- Do not add MUI, Ant Design, Chakra UI, shadcn/ui, Bootstrap, a toast library or an animation library under the current authorization.

#### Validation

- Login email: required and valid email.
- Login password: required and at least 8 characters.
- Register `display_name`: required/non-empty only; do not invent length or character restrictions.
- Register email: required and valid email.
- Register password: required and at least 8 characters; do not invent complexity rules.
- `confirm_password`: required, must match password, and must never be sent to the API.
- Frontend validation improves UX and does not replace backend validation.

#### Approved Vietnamese validation presentation

- Required email: `Vui lòng nhập email.`
- Invalid email: `Email không hợp lệ.`
- Required password: `Vui lòng nhập mật khẩu.`
- Short password: `Mật khẩu phải có ít nhất 8 ký tự.`
- Required display name: `Vui lòng nhập tên hiển thị.`
- Required confirmation: `Vui lòng xác nhận mật khẩu.`
- Password mismatch: `Mật khẩu xác nhận không khớp.`

#### Error presentation

- Do not render raw backend English messages directly.
- `AUTHENTICATION_FAILED` is a form-level Login error with title `Không thể đăng nhập` and message `Email hoặc mật khẩu không chính xác.`
- `EMAIL_ALREADY_EXISTS` is presented during Register as `Email này đã được đăng ký.`
- Operational/network failure uses title `Đã xảy ra lỗi` and message `Không thể kết nối đến máy chủ. Vui lòng thử lại.`
- Unknown API errors use a safe Vietnamese fallback.
- Invalid credentials must not be represented as an email field validation error.
- Error mapping has one coherent module rather than duplicated switches in both forms.

#### Visual and motion contract

- The bounded outer Auth shell remains mounted and visually stationary.
- Desktop Login composition: `[Vocabulary / resilient] [Login Form]`.
- Desktop Register composition: `[Register Form] [Vocabulary / curious]`.
- Internal regions exchange positions using transform/translate and opacity over approximately 450–600ms with `cubic-bezier(0.4, 0, 0.2, 1)`.
- No spring, bounce, rotation, 3D flip, dramatic zoom or dramatic blur.
- Mobile uses compact Vocabulary Experience above the form and a small local transition rather than the full desktop panel movement.
- `prefers-reduced-motion` removes large panel movement while preserving functionality.

#### Vocabulary experience

- Present the approved word, IPA, part of speech, Vietnamese meaning, English example, subtle linguistic fragments and ELVocab Learning Grid treatment.
- Use Lucide `Volume2` for the pronunciation affordance.
- Do not use emoji, stock illustrations, cartoons or random decorative blobs.
- TASK-012 does not add pronunciation playback infrastructure that is not already approved.

#### Registration success

- Successful registration does not authenticate the user.
- Show a lightweight custom toast containing `Tạo tài khoản thành công!`.
- After approximately 1–1.5 seconds, use the same Register → Login panel transition.
- Prefill Login email from the successful submission and clear all password values.
- The user must log in manually.

#### Accessibility

- Use visible labels with correct label/input association; placeholders are not labels.
- Preserve keyboard operation, visible focus, touch-friendly targets and appropriate autocomplete.
- Password toggles use `type="button"`, meaningful `aria-label` text and visible focus.
- Errors are not communicated by color alone; form alerts use appropriate semantics.
- Loading/disabled semantics prevent duplicate submission.
- Decorative motion yields to reduced-motion preference.

#### Routing contract

- Use the human-approved `react-router-dom` foundation for application-level navigation.
- `/login` and `/register` resolve through the same persistent `AuthPage` parent/layout and Auth shell.
- Login/Register mode is synchronized from the matched child route; changing between these URLs uses React Router navigation plus the approved local panel transition and must not remount the outer Auth shell.
- `/` redirects to `/login` as the minimum application entry behavior.
- Successful Login navigates to `/dashboard` only after the existing shared `login` operation succeeds.
- `/dashboard` renders only a minimum semantic destination/placeholder needed to make the handoff executable. It does not include real Dashboard content, sidebar, app shell, Admin UI, logout or protected-route behavior.
- React Router owns application navigation; `AuthPage` owns local Login/Register experience state and animation.
- Do not implement temporary `useState("login" | "register" | "dashboard")` application routing.
- Do not create routing-specific Auth state, a second AuthenticationProvider, or React Router loader/action Authentication architecture.
- TASK-013 remains responsible for protecting `/dashboard`, Guest redirects, authenticated navigation, Admin visibility, logout navigation and expired-session navigation.

### Acceptance Criteria

- **AC-012-01:** `/login` and `/register` use the approved React Router foundation and render the approved custom ELVocab design through one persistent Auth shell.
- **AC-012-02:** Navigating between `/login` and `/register` synchronizes Auth mode and exchanges the desktop internal regions without remounting or visibly moving the outer shell.
- **AC-012-03:** Mobile uses the approved compact single-column composition and avoids the desktop-scale panel swap.
- **AC-012-04:** Reduced-motion preference removes large decorative movement without changing functionality.
- **AC-012-05:** Login uses React Hook Form with Zod validation for required valid email and required minimum-eight-character password.
- **AC-012-06:** Register uses React Hook Form with Zod validation for non-empty `display_name`, valid email, minimum-eight-character password and matching confirmation.
- **AC-012-07:** `confirm_password` is frontend-only and the existing Auth interface receives only `display_name`, email and password.
- **AC-012-08:** No unapproved display-name constraint or password-complexity rule is introduced.
- **AC-012-09:** Forms reuse TASK-011 `useAuthentication()` operations; no duplicate Axios client, Auth service or shared state is created.
- **AC-012-10:** Login and Register expose visible pending states, disable duplicate submission and restore usable controls after failure.
- **AC-012-11:** Password visibility toggles are keyboard reachable, do not submit forms, expose meaningful labels and show focus.
- **AC-012-12:** Field validation is inline, Vietnamese, associated with its field and not represented only by color.
- **AC-012-13:** Invalid credentials are mapped to the approved form-level Vietnamese Authentication message without account-state disclosure.
- **AC-012-14:** Duplicate email and operational/server failures use the approved safe Vietnamese presentations without exposing raw backend messages.
- **AC-012-15:** Successful registration shows the custom success toast, does not auto-login and transitions to Login after approximately 1–1.5 seconds.
- **AC-012-16:** The registered email is prefilled in Login while Login/Register password values are cleared.
- **AC-012-17:** Valid Login uses the existing shared Auth state and then navigates to `/dashboard`; the destination is only a semantic placeholder and implements no TASK-013 protection/navigation behavior.
- **AC-012-18:** Desktop, tablet and mobile layouts remain usable with a bounded large-screen shell and touch-friendly controls.
- **AC-012-19:** Vocabulary Experience uses approved `resilient`/`curious` content and Lucide icons without emoji or unauthorized decorative assets.
- **AC-012-20:** Google sign-in and Forgot Password controls are omitted; no unauthorized functionality or misleading inactive control is shipped.
- **AC-012-21:** No component UI library, toast library, animation library or unauthorized dependency is added.
- **AC-012-22:** No raw session token/cookie handling, browser Authentication storage, JWT or Bearer mechanism is introduced.
- **AC-012-23:** No protected navigation, Guest redirect, Admin visibility, logout UI or expired-session navigation from TASK-013 is implemented.
- **AC-012-24:** `App.jsx` remains composition-level, routing is isolated in the minimum router module, no application-view `useState` router is introduced, and validation/error mapping is not unnecessarily duplicated.
- **AC-012-25:** Frontend build and lint pass, basic Login/Register interactions are verified, and no unrelated regression or backend change is introduced.

### Testing Requirements

- During IMPLEMENT, run frontend build and lint and perform focused verification of both UI modes, validation, submission locking, password toggles, errors, registration-success handoff, responsiveness and reduced motion.
- Verify Login/Register submissions reach the existing TASK-011 interface with only approved payload fields.
- Verify no direct Axios call, duplicate Auth service/state or raw credential storage is introduced.
- Do not absorb TASK-014 formal frontend Authentication test ownership into TASK-012.
- Formal TEST-012 and REVIEW-012 remain separate workflow stages after implementation.

### Traceability

- SPEC: `2. Actors`, `4. User Flow`, `7. API Requirements`, `8. Acceptance Criteria`.
- PLAN: `12. Thiết kế Frontend`, Login/Register flow, navigation foundation and frontend testing boundary.
- UI/UX: Login/Register requirements plus the human-approved ELVocab Auth design and interaction handoff.
- TASK-011: existing Auth service, state, provider, hook, bootstrap and relative API convention.

### Approved Implementation Dependencies

- `lucide-react`.
- `react-hook-form`.
- `zod`.
- `@hookform/resolvers`.
- `react-router-dom`.

No dependency is installed during TASK authoring.

### Design Gate

```text
HUMAN LIBRARY DECISION: APPROVED
HUMAN VISUAL DESIGN: APPROVED
HUMAN INTERACTION MODEL: APPROVED
DESIGN GATE: PASSED
```

Approved characteristics include the persistent Auth shell, vocabulary learning panel, coordinated Login/Register exchange, responsive adaptation, validation/error/loading states, custom success toast and reduced-motion behavior.

### Closure Gate

```text
ROUTING DECISION: APPROVED — REACT ROUTER
TASK-012: APPROVED
HUMAN TASK APPROVAL RECORDED: 2026-09-18
IMPLEMENT: COMPLETE
TEST: PASS
REVIEW: APPROVED
REVIEW012-01: RESOLVED
TEST012-RESP-01: RESOLVED
REVIEW012-02: RESOLVED
REVIEW012-03: RESOLVED
TASK-012 STATUS: DONE
```

TASK-012 completed its approved implementation, formal testing, corrective cycles and final review. Feature-status closure was recorded after REVIEW approval.

---

## TASK-013 — Implement protected navigation, Admin visibility and Logout UI

### Status

- TASK definition: `APPROVED`.
- Human clarification decisions: `APPROVED`.
- Human textual UI contract: `APPROVED`.
- Admin visibility interpretation: `APPROVED`.
- TASK-013: `APPROVED`.
- Human TASK approval: `APPROVED` on `2026-09-19`.
- IMPLEMENT: `COMPLETE`.
- TEST: `PASS`.
- REVIEW: `APPROVED`.
- `TEST013-RESP-01`: `RESOLVED`.
- TASK-013 status: `DONE`.

### Objective

Implement the approved ELVocab authenticated navigation shell, protect the existing Dashboard route, provide deterministic Guest/authenticated redirects, present backend-derived Admin context and complete Logout/session-expiration UX without treating frontend visibility as an authorization boundary.

### Dependencies

- TASK-011 — `DONE`.
- TASK-012 — `DONE`.
- Approved Authentication SPEC and corrected PLAN.
- Existing TASK-011 Auth service, shared Auth state/provider/hook and bootstrap.
- Existing TASK-012 React Router foundation, Login/Register experience and `/dashboard` placeholder.
- Human-approved TASK-013 clarification and textual UI contract.

### Files / Modules

- `frontend/src/app-router.jsx` — compose Guest-only and protected route behavior with the existing React Router foundation.
- `frontend/src/auth/auth-store.js` — preserve the approved distinction between initial Guest bootstrap and expiration of a previously authenticated session.
- Existing Authentication context/provider/hook modules — expose only shared state/actions required by the approved route and shell behavior; do not create a second Auth state.
- Existing `frontend/src/auth/ui/` modules plus focused authenticated-shell/route-guard UI modules created there when needed.
- `frontend/src/pages/dashboard-placeholder.jsx` — remain the minimum Dashboard content rendered inside the authenticated shell; do not turn it into the real Dashboard feature.
- `frontend/src/index.css` — only responsive/accessibility styling required by the approved shell and states.

### In Scope

- Protect `/dashboard` as the only protected route in TASK-013.
- Redirect Guest access to `/dashboard` to `/login` with `replace`.
- Treat `/login` and `/register` as Guest routes; redirect authenticated `USER`/`ADMIN` access to either route to `/dashboard` with `replace`.
- Preserve `/` → `/login` and the existing fallback behavior.
- Show a neutral accessible Auth-initialization state and never flash protected content before Auth state is known.
- Add the approved minimal responsive authenticated shell containing only:
  - `ELVocab` branding;
  - Dashboard navigation;
  - backend-provided `display_name` account identity;
  - approved Admin-specific navigation-context visibility;
  - Logout in the account area.
- Show non-interactive `Quản trị viên` text only when backend-provided `user.role === "ADMIN"`; omit it for `USER`.
- Perform Logout only through the existing shared `logout()` operation.
- Provide Logout normal, pending, success and safe inline-error states.
- On successful/idempotent Logout, transition shared Auth state to Guest and navigate to `/login` with `replace`, without a success toast.
- Distinguish normal initial unauthenticated bootstrap from expiration of a previously authenticated session.
- For a previously authenticated session that becomes invalid, clear shared identity, navigate to `/login` with `replace` and show the approved one-time expiration message.
- Provide responsive desktop, tablet and mobile behavior plus the approved accessibility and reduced-motion behavior.

### Out of Scope

- Any backend, API, database, schema, migration, cookie or Authentication architecture change.
- Replacing backend authentication/authorization with frontend route or role checks.
- New protected feature routes or future-feature pages.
- Landing Page implementation or changing `/` to a new destination.
- Real Dashboard content beyond the existing semantic placeholder.
- Search, Profile, Settings, Learn, Progress, Vocabulary, Community or other future navigation links.
- `/admin`, Admin Dashboard placeholder, Admin management UI or any actual Admin navigation destination.
- A clickable or disabled fake Admin control.
- Logout-all-devices.
- Session management UI.
- Device history.
- Global Axios `401` interceptor or automatic session polling.
- JWT, Bearer token, raw-cookie access or frontend Authentication storage.
- New UI, toast, animation, state, routing or Authentication dependency.
- TASK-014 formal frontend Authentication test-suite implementation.
- TASK-015 integration, security or deployment verification.
- Deployment or Vercel configuration.

### Route Behavior

```text
/             → /login
/login        → Guest Login experience; authenticated USER/ADMIN → /dashboard (replace)
/register     → Guest Register experience; authenticated USER/ADMIN → /dashboard (replace)
/dashboard    → protected USER/ADMIN destination; Guest → /login (replace)
*             → existing /login fallback
```

- `/dashboard` is the only protected route owned by TASK-013.
- Route decisions must use the existing shared Auth state and React Router; do not create component-local application routing state or a second Authentication provider.
- The protected guard must wait until Auth initialization completes before rendering either Dashboard or a redirect.
- Redirects after Guest rejection, authenticated Guest-route access, Logout and session expiration use `replace`.

### Authenticated Navigation and UI Contract

#### Desktop

- Use a minimal persistent sidebar.
- Place `ELVocab` branding at the top.
- Render Dashboard as the only real navigation link and clearly indicate its active state.
- Place account identity, the conditional Admin indicator and Logout in the account area.
- Render the existing Dashboard placeholder in the main content region.

#### Mobile and tablet

- Use a compact header/account composition plus a Dashboard navigation row.
- Do not add a hamburger menu while Dashboard is the only destination.
- Preserve touch-friendly controls and prevent clipping or horizontal overflow.

#### Account identity and Admin visibility

- Display backend-provided `display_name` for both approved roles.
- `ADMIN` sees non-interactive text `Quản trị viên` in the navigation/account context.
- `USER` does not see the Admin indicator; a general `USER` role badge is not required.
- The Admin indicator must not use anchor/button semantics, hover/cursor treatment or styling that implies it is clickable.
- Actual Admin navigation remains deferred until a separate task/feature has an approved Admin destination.
- Role-dependent presentation is UX only; backend authorization remains authoritative.

#### Loading

- During Auth initialization, show a neutral full-page state with `ELVocab` and concise status text such as `Đang kiểm tra phiên đăng nhập…`.
- Use accessible status semantics and reduced-motion-friendly presentation.
- Do not render authenticated navigation or Dashboard content until state is known.

#### Logout

- Normal: render an accessible `Đăng xuất` button in the account area.
- Pending: disable duplicate action and present `Đang đăng xuất…`.
- Success, including idempotent `204 No Content`: shared state becomes Guest and navigation replaces the current entry with `/login`; do not show a success toast.
- Failure: preserve authenticated state, re-enable Logout and show `Không thể đăng xuất lúc này. Vui lòng thử lại.` inline without raw backend/network details.

#### Session expiration

- Initial bootstrap without a valid session represents an ordinary Guest and must not show an expiration warning.
- When a previously authenticated session becomes invalid, clear shared identity and redirect to `/login` with `replace`.
- Show one accessible inline Login alert: `Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.`
- Do not show that alert after voluntary Logout.
- Clear the alert after dismissal or successful Login so it does not persist incorrectly.

### Architecture and Security Constraints

- Reuse TASK-011 `useAuthentication()` state/actions, Auth service and relative `/api/**` client; do not duplicate Authentication infrastructure.
- Reuse the existing React Router architecture; do not introduce Router loader/action Authentication or a custom router.
- Backend-provided identity, role, account state and session validity remain authoritative.
- Frontend route guards and Admin visibility are presentation/UX controls only and do not replace backend enforcement.
- Support only `USER` and `ADMIN`; Guest remains an unauthenticated state.
- Do not read, expose or persist the raw `session_id` cookie/token.
- Do not introduce JWT, Bearer credentials or browser Authentication storage.
- Do not expose raw API errors or sensitive Authentication details in UI.
- Keep branding `ELVocab` and reuse existing approved dependencies and visual language.

### Acceptance Criteria

- **AC-013-01:** Auth initialization renders a neutral accessible loading state and does not render authenticated navigation or Dashboard content before state is known.
- **AC-013-02:** Guest access to `/dashboard` redirects to `/login` with `replace`.
- **AC-013-03:** Authenticated `USER` and `ADMIN` can render `/dashboard` inside the authenticated shell.
- **AC-013-04:** Authenticated access to `/login` or `/register` redirects to `/dashboard` with `replace`; Guest can access both routes.
- **AC-013-05:** `/dashboard` is the only protected route added by TASK-013; `/` continues to redirect to `/login` and no future-feature route/page is created.
- **AC-013-06:** The responsive authenticated shell contains only `ELVocab`, Dashboard navigation, backend-provided `display_name`, conditional Admin context and Logout.
- **AC-013-07:** Dashboard is a real React Router link with a clear accessible active state; no inactive or fake future navigation control is rendered.
- **AC-013-08:** Backend-provided `ADMIN` identity shows non-interactive `Quản trị viên`; `USER` does not; no `/admin` route, link or page is introduced.
- **AC-013-09:** Logout uses the existing shared `logout()` operation, exposes pending state and prevents duplicate activation while pending.
- **AC-013-10:** Successful/idempotent Logout clears shared identity, transitions to Guest and navigates to `/login` with `replace` without a success toast.
- **AC-013-11:** Logout operational failure preserves authenticated state, restores the Logout control and shows only the approved safe inline error.
- **AC-013-12:** Initial `/api/auth/me` authentication failure is handled as an ordinary Guest state without an expiration warning.
- **AC-013-13:** Authentication failure after a previously authenticated state clears identity, redirects protected navigation to `/login` with `replace` and shows the approved one-time expiration message.
- **AC-013-14:** Voluntary Logout does not show the expiration message, and the message does not survive dismissal or successful Login.
- **AC-013-15:** Frontend presentation uses only backend-established identity/role and is not treated as authorization enforcement.
- **AC-013-16:** No raw token/cookie handling, browser Authentication storage, JWT, Bearer mechanism or new Authentication/routing/state dependency is introduced.
- **AC-013-17:** Desktop uses the approved minimal sidebar; tablet/mobile use the approved compact header/account and Dashboard-row composition without clipping or overflow.
- **AC-013-18:** Navigation, identity, Admin indicator, Logout, loading, inline errors and expiration alert satisfy approved semantic, keyboard, focus, touch-target, contrast and reduced-motion expectations.
- **AC-013-19:** Existing Login/Register flows and TASK-011 Auth contracts remain functional; no backend, API, database, deployment, TASK-014 or TASK-015 scope is absorbed.

### Implementation-Stage Verification

- Inspect route behavior for Guest, authenticated `USER`, authenticated `ADMIN` and unresolved initialization state.
- Verify `/dashboard`, `/login`, `/register`, `/` and fallback behavior against the approved route table.
- Verify USER/Admin shell differences using backend-shaped public identity fixtures only.
- Verify Logout normal, pending, success/idempotent and operational-error behavior without exposing raw errors.
- Verify initial Guest bootstrap separately from expiration after a previously authenticated state.
- Verify expiration-alert dismissal and successful-Login cleanup.
- Perform responsive runtime checks for representative desktop, tablet and mobile viewports, including overflow/clipping checks.
- Perform keyboard/focus and reduced-motion checks for the new shell and states.
- Run existing frontend Authentication regression tests; do not absorb TASK-014 formal test implementation.
- Run `npm run lint`, `npm run build` and `git diff --check`.
- Confirm no backend, API, schema, deployment or dependency change entered the TASK-013 diff.

### Traceability

- SPEC: `2. Actors`, `4. User Flow`, `8. Acceptance Criteria`.
- PLAN: `9. Thiết kế Authorization`, `12. Thiết kế Frontend`.
- UI/UX: authenticated navigation, responsive global layout, accessibility and global states.
- TASK-011: shared Authentication service/state/provider/hook and initialization behavior.
- TASK-012: React Router foundation, Guest Auth experience and minimum Dashboard destination.

### Closure Gate

```text
TASK-013 CLARIFICATION: APPROVED
TASK-013 TEXTUAL UI CONTRACT: APPROVED
TASK-013 ADMIN VISIBILITY INTERPRETATION: APPROVED
TASK-013: APPROVED
HUMAN TASK APPROVAL RECORDED: 2026-09-19
IMPLEMENT: COMPLETE
TEST: PASS
REVIEW: APPROVED
TEST013-RESP-01: RESOLVED
TASK-013 STATUS: DONE
```

TASK-013 completed its approved implementation, responsive corrective cycle, formal test re-run and final review. TASK-014, TASK-015 and deployment remain separate follow-up scope.

---

## TASK-014 — Frontend Authentication tests

### Status

- TASK definition: `APPROVED`.
- Human test-architecture decision: `APPROVED`.
- Human tooling/dependency decision: `APPROVED`.
- Human TASK approval: `APPROVED` on `2026-09-19`.
- IMPLEMENT: `COMPLETE`.
- TEST: `PASS` — 20 `node:test` tests and 18 Playwright Chromium tests passed; aggregate 38/38.
- REVIEW: `APPROVED` after `REVIEW014-01` and `REVIEW014-02` were resolved and verified.
- TASK-014 status: `DONE`.

### Objective

Implement a persistent, deterministic frontend Authentication test suite that combines the existing `node:test` layer with Chromium-only Playwright browser coverage for the approved TASK-011 through TASK-013 behavior, without absorbing real frontend/backend integration from TASK-015.

### Dependencies

- TASK-011 — `DONE`.
- TASK-012 — `DONE`.
- TASK-013 — `DONE`.
- Approved Authentication SPEC and PLAN.
- Human-approved TASK-014 clarification, test architecture, Playwright boundary and acceptance criteria.

### Approved Test Architecture

#### Existing `node:test` layer

Continue using `node:test` for deterministic logic that does not require browser rendering:

- Authentication service endpoints, payloads, public identity extraction and safe error mapping.
- Login/Register Zod schemas and `confirm_password` mismatch.
- Shared Auth-store initialization, Login, Logout, refresh, failure and cleanup transitions.
- Initial Guest versus previously authenticated session expiration.
- Expiration dismissal, successful-Login cleanup and voluntary-Logout distinction.
- Vite proxy configuration.
- Raw credential/token exclusion from returned or stored frontend state.

#### Playwright layer

Use `@playwright/test` with one Playwright-managed Chromium browser for observable browser behavior:

- Login/Register validation presentation, loading, submission locking, success and safe error states.
- Auth initialization UI and protected-content flash prevention.
- Protected/Guest route behavior and redirects.
- USER/ADMIN presentation.
- Logout pending, success and operational failure behavior.
- Keyboard, semantic, accessible-state and browser-storage guardrails relevant to Authentication.
- Critical Auth UI responsive regression at `375x812`, `768x1024` and `1366x768` without duplicating the complete browser suite at every viewport.

Browser tests must mock only relative `/api/auth/**` requests through Playwright routing. They must not contact a real backend, Supabase, production service or database. Real frontend/backend integration remains TASK-015.

Use a limited test-only Playwright gallery/component setup only for approved UI states that cannot be reached deterministically through the public application flow without adding a production test hook, particularly the session-expiration Login alert. Do not build a general component catalog.

### Files / Modules

- `frontend/package.json` — add approved unit/browser/aggregate Authentication test commands.
- `frontend/package-lock.json` — lock the approved test dependency.
- `.gitignore` — exclude Playwright reports, test results, screenshots and traces.
- `frontend/playwright.config.js` — configure Chromium, Vite `webServer`, dedicated strict port, relative `baseURL` and failure artifacts.
- Existing `frontend/test/auth-service.test.js`, `frontend/test/auth-store.test.js` and `frontend/test/vite-config.test.js` — retain and extend focused `node:test` coverage.
- `frontend/test/auth-validation.test.js` — focused schema validation tests.
- `frontend/e2e/auth/auth-forms.spec.js` — Login/Register browser flows.
- `frontend/e2e/auth/auth-routing.spec.js` — initialization, routes and USER/ADMIN presentation.
- `frontend/e2e/auth/auth-session.spec.js` — Logout, expiration presentation and security-state behavior.
- `frontend/e2e/auth/fixtures/auth-api.js` — backend-shaped public identities and deterministic Playwright network mocks.
- Minimal test-only gallery/story modules when required for unreachable expiration UI state.

### In Scope

- Install `@playwright/test` as a frontend dev dependency and install its managed Chromium browser.
- Preserve `node:test` for service, schema, store and configuration behavior.
- Add Chromium-only browser tests using the real Vite-rendered application.
- Add deterministic Login/Register required-field, email, password-length and confirmation-mismatch tests.
- Verify Register payload exclusion of `confirm_password`, no auto-login and Login handoff.
- Verify Login success, failure, loading and duplicate-submission prevention.
- Verify Auth initialization, initial Guest, authenticated state and operational error behavior.
- Verify `/`, `/login`, `/register`, `/dashboard` and fallback routing for Guest and authenticated identities.
- Verify USER/ADMIN visibility, the non-interactive Admin indicator and absence of `/admin`.
- Verify Logout pending, duplicate prevention, success/idempotent success and safe operational failure.
- Verify expired-session state, alert, dismissal, Login cleanup and voluntary-Logout distinction.
- Verify frontend Authentication does not persist raw credentials/tokens or treat role visibility as authorization.
- Verify Login/Register controls and authenticated Dashboard shell remain usable without horizontal overflow or clipping at the approved mobile, tablet and desktop viewports, including a long backend-provided `display_name` and visible Logout control.
- Provide separately identifiable unit and browser results plus one aggregate Authentication test command.
- Keep reports, traces, screenshots and test results untracked.

### Out of Scope

- Firefox or WebKit coverage.
- Jest, Vitest, Testing Library, jsdom or experimental Playwright component packages.
- Real frontend/backend, database, Supabase, cookie or deployment integration; these remain TASK-015.
- Backend Authentication/security implementation tests already owned by TASK-010.
- Production routes, production test hooks or changes made only to expose internal state.
- Production Authentication, routing, UI, API, backend, schema or deployment behavior changes.
- Visual snapshot baselines or broad responsive-design regression suites.
- Tests for unapproved UI or future features.
- TASK-015 implementation or deployment.

### Deterministic Scenarios

#### Login and Register

- Empty and invalid fields show the approved messages and send no request.
- Password shorter than eight characters and mismatched confirmation are rejected.
- Valid Register sends only `display_name`, normalized `email` and `password`, remains Guest and hands off to Login.
- Valid Login locks submission while pending and navigates to `/dashboard` on success.
- Duplicate email, invalid credentials, backend validation, API failure and network failure render only approved safe messages.

#### Auth initialization and routing

- A delayed `/api/auth/me` response keeps the neutral loading status visible and does not flash protected content.
- Valid current-user response renders the authenticated shell.
- Initial authentication failure produces ordinary Guest state without expiration warning.
- Guest `/dashboard` redirects to `/login`.
- Authenticated `/login` and `/register` redirect to `/dashboard`.
- `/` and unknown routes redirect to `/login`.
- Dashboard remains the only authenticated navigation destination.

#### Role presentation

- USER sees backend-provided `display_name` without the Admin indicator.
- ADMIN sees non-interactive `Quản trị viên`.
- No `/admin` route, link or page exists.
- Tests do not treat frontend visibility as backend authorization evidence.

#### Logout and expiration

- Pending Logout is disabled, exposes busy state and sends only one request.
- Successful/idempotent Logout becomes Guest, navigates to `/login` with replacement behavior and shows no success/expiration message.
- Operational failure preserves authenticated state, restores the control and hides raw failure details behind the approved safe alert.
- An expired authenticated session clears identity and sets the approved expiration state.
- The Login alert has approved text/semantics and can be dismissed.
- Successful Login and voluntary Logout clear expiration state correctly.

#### Security and isolation

- Service/state expose only public identity even if mocked responses contain unrelated credential-like data.
- Password, `confirm_password` and raw session values never enter shared state, browser storage or UI output.
- Every browser test uses an isolated context and registers API mocks before navigation.
- Tests do not depend on order, shared mutable server state, a database, production or external network access.

#### Responsive regression

- Run one focused critical Auth flow at `375x812`, `768x1024` and `1366x768` rather than duplicating the full browser suite for every viewport.
- At each viewport, Login/Register critical controls remain visible and usable without horizontal overflow.
- After Login with a long backend-provided `display_name`, the authenticated shell, Dashboard card and text fit the viewport; the name is safely constrained and Logout remains visible and usable.
- The focused flow exercises Login/Register navigation, successful Login to Dashboard and successful Logout back to Login.

### Fixture and Mocking Strategy

- Use backend-shaped public USER and ADMIN identity fixtures.
- Use per-test `page.route()` handlers for relative `/api/auth/**` requests.
- Provide explicit success, `400`, `401`, `409`, `500`, delayed and network-abort responses.
- Count intercepted requests for duplicate-submission/Logout assertions.
- Use delayed route fulfillment for deterministic pending/loading states.
- Start Vite through Playwright `webServer` on a dedicated strict port and use a relative `baseURL`.
- Use a fresh browser context per test; do not persist Authentication storage state.
- Do not use HAR files, a real backend, shared database fixtures or production credentials.

### Command and Artifact Contract

- Preserve a dedicated `node:test` Authentication command.
- Add a dedicated Playwright Authentication command.
- Provide one documented aggregate command that runs both layers and exits non-zero if either fails.
- Test output must keep unit and browser results separately identifiable.
- Playwright reports, traces, screenshots and test results are local/CI artifacts and must remain untracked.

### Acceptance Criteria

- **AC-014-01:** Existing service/store/config tests remain under `node:test`; browser behavior is tested with Playwright without duplicating pure state assertions.
- **AC-014-02:** Login and Register required-field, invalid-email, password-length and confirmation-mismatch behavior are tested.
- **AC-014-03:** Valid Register sends only `display_name`, normalized email and password, does not authenticate and hands off to Login.
- **AC-014-04:** Valid Login authenticates and navigates to `/dashboard`; invalid credentials and operational failures show approved safe messages.
- **AC-014-05:** Form submissions expose pending/disabled states and prevent duplicate requests.
- **AC-014-06:** Auth initialization prevents protected-content flash and distinguishes valid session, initial Guest and operational failure.
- **AC-014-07:** Guest/protected/Login/Register/root/fallback routing matches the approved TASK-013 route table.
- **AC-014-08:** USER and ADMIN receive correct backend-derived identity presentation; Admin context remains non-interactive and no `/admin` destination exists.
- **AC-014-09:** Logout pending, success, idempotent success and operational failure are verified, including request deduplication and safe error presentation.
- **AC-014-10:** Expired-session transition, alert, dismissal, Login cleanup and voluntary-Logout distinction are verified.
- **AC-014-11:** Tests prove no password, confirmation value or raw session credential enters shared state, browser storage or UI output.
- **AC-014-12:** Browser tests mock only relative `/api/auth/**` and do not contact production, Supabase or a real backend.
- **AC-014-13:** Tests are isolated, repeatable and independent of execution order.
- **AC-014-14:** A documented aggregate command exits zero on success and non-zero on failure; unit and browser results remain separately identifiable.
- **AC-014-15:** Authentication tests, frontend lint, production build and `git diff --check` pass.
- **AC-014-16:** No production behavior, backend/API/schema, deployment configuration, TASK-015 integration scope or unapproved feature is changed.
- **AC-014-17:** Chromium regression coverage at `375x812`, `768x1024` and `1366x768` proves critical Login/Register controls, Auth navigation, the Dashboard shell/card/text, a long backend-provided `display_name` and Logout remain usable without horizontal overflow or clipping.

### Implementation and Verification Requirements

- Install only the approved Playwright dependency/browser and keep package changes frontend-scoped.
- Reuse existing tests and production contracts; do not rewrite completed TASK-011 through TASK-013 behavior.
- During IMPLEMENT, run the focused unit and Playwright commands sufficiently to validate setup and test determinism.
- During formal TEST, run the aggregate Authentication suite, frontend lint, frontend build and `git diff --check`.
- Verify a repeated aggregate run produces the same result without leftover server/browser state.
- Verify generated Playwright artifacts are ignored and no secret/environment file is added.
- Report any unavailable Chromium/runtime infrastructure honestly; do not claim browser coverage that was not executed.

### Traceability

- SPEC: `8. Acceptance Criteria`, `9. Edge Cases`.
- PLAN: `12. Thiết kế Frontend`, `13. Chiến lược Testing`.
- TASK-011: Auth service, shared state/provider/bootstrap and relative API contract.
- TASK-012: Login/Register validation, submission and error UX.
- TASK-013: protected routing, role presentation, Logout and expiration UX.

### Approval Gate

```text
TASK-014 CLARIFICATION: APPROVED
TASK-014 TEST ARCHITECTURE: APPROVED
PLAYWRIGHT + MANAGED CHROMIUM: APPROVED
CHROMIUM-ONLY TASK-014 COVERAGE: APPROVED
RESPONSIVE VIEWPORT MATRIX: APPROVED (`375x812`, `768x1024`, `1366x768`)
MOCKED RELATIVE /api/auth/** BOUNDARY: APPROVED
TASK-014: APPROVED
HUMAN TASK APPROVAL RECORDED: 2026-09-19
IMPLEMENT: COMPLETE
TEST: PASS
REVIEW: APPROVED
REVIEW014-01: RESOLVED
REVIEW014-02: RESOLVED
TASK-014 STATUS: DONE
```

TASK-014 completed its approved implementation, formal testing, corrective review cycle and final review. TASK-015 integration/security/deployment verification remains separate follow-up scope.

---

## TASK-015 — Authentication integration and security verification

### Status

- TASK definition: `APPROVED`.
- Human deterministic-contract decision: `APPROVED` on `2026-09-19`.
- Two-phase execution model: `APPROVED`.
- Phase A status: `COMPLETE`.
- Phase A IMPLEMENT: `COMPLETE`.
- Phase A TEST: `PASS` — local real-stack integration, backend Authentication regression, TASK-014 regression, lint, build and security/isolation checks passed.
- Phase A REVIEW: `APPROVED` after the AC-015-11 synchronization finding was fixed and verified.
- Phase A open findings: `0`.
- Phase B IMPLEMENT/DEPLOY/VERIFY: `NOT AUTHORIZED — HUMAN GATE`.
- TASK-015 status: `IN_PROGRESS` — Phase B remains outstanding; TASK-015 is not `DONE`.

### Objective

Verify the complete real Authentication flow in two controlled phases without deploying to production:

- **Phase A — prerequisite implementation and local real-stack integration:** Browser → Vite → relative `/api/auth/**` → real Express → Prisma → dedicated Supabase TEST DB.
- **Phase B — Vercel Preview verification:** Browser → frontend Vercel origin → relative `/api/auth/**` → approved Vercel rewrite/proxy → backend Vercel project → approved non-production Supabase database.

Phase A must be independently implementable and verifiable before any Phase B external-state action is authorized.

### Dependencies

- TASK-001 database/schema implementation — `DONE`.
- TASK-010 backend Authentication/security test suite — `DONE`.
- TASK-014 frontend Authentication test suite — `DONE`.
- Approved Authentication SPEC and corrected Authentication PLAN.
- Dedicated Supabase TEST DB with the existing reset-safety contract.
- Phase B additionally depends on the separate Human Gate defined below.

### Phase Model and Gates

#### Phase A — Authorized

Phase A may implement only the approved prerequisites and local real-stack integration harness/tests. It must not create or configure Vercel projects, deploy a Preview, configure real Preview secrets, choose a Preview backend destination or select/reset a Preview database.

#### Phase B — Human Gate

Before Phase B begins, Human approval must separately provide or authorize:

- creation/configuration or use of the frontend and backend Vercel projects;
- the backend Preview destination mechanism used by the frontend rewrite;
- a dedicated non-production Supabase database/branch for Preview;
- Preview environment variables/secrets;
- Deployment Protection access/configuration;
- the actual Vercel Preview deployment and external verification run.

No Phase A success result may be presented as Phase B evidence.

### Files / Modules

- `backend/src/controllers/auth-controller.js` — add the approved explicit `SameSite=Lax` cookie behavior and keep set/clear options compatible.
- `backend/src/index.js` — Vercel-compatible default-export entry that reuses `createApp({ prisma })`, creates no listener and keeps Prisma at module scope.
- `backend/src/main.js` — modify only if narrowly required to share existing composition without changing local startup behavior.
- `backend/vercel.json` — only if required by verified Vercel runtime configuration; creation does not authorize deployment.
- `frontend/vercel.json` — Phase B prerequisite only after the backend destination mechanism is Human-approved; API rewrite must precede SPA fallback and must not cache Authentication responses.
- `backend/package.json`, `frontend/package.json` and their lockfiles — only scripts needed for approved integration orchestration; no new dependency unless separately approved.
- `backend/.env.example`, `frontend/.env.example` — variable names/documentation only; never values.
- `backend/test/**` — cookie/entry/integration helpers and safe database lifecycle support.
- `frontend/e2e/integration/**` — real-stack browser scenarios with no Authentication API mocks.
- `frontend/playwright.integration.config.js` — isolated real-stack Playwright orchestration/configuration.
- TASK-015 documentation/status artifacts when required by workflow.

Files outside this allowlist require a new Human decision before modification.

### In Scope

- Implement explicit `SameSite=Lax` for `session_id` while preserving `HttpOnly`, `Path=/`, seven-day lifetime, conditional `Secure` and no explicit `Domain`.
- Add the approved default-export backend entry without changing the local `main.js` listener contract.
- Add deterministic local process/database/browser setup and teardown.
- Verify real Register → Login → Dashboard → reload/bootstrap through `/me` → Logout → rejected `/me`.
- Verify initial registration remains Guest and does not create a session.
- Verify real persisted USER and controlled ADMIN identities through Login and `/me` without creating an Admin route/API/page.
- Verify browser-managed cookie attributes and raw-token exclusion.
- Verify relative same-origin `/api/auth/**` usage and absence of credentialed-CORS dependency.
- Verify the approved SameSite/same-origin/JSON CSRF baseline without adding a CSRF token or library.
- Re-run existing backend and frontend Authentication suites as regression evidence.
- After the Phase B gate only, verify the same flow and cookie/rewrite contract against Vercel Preview.

### Out of Scope

- Production deployment or promotion.
- Any Phase B external-state action before its Human Gate is satisfied.
- New schema, migration, API endpoint, role, `/admin`, Admin page or Admin management behavior.
- Credentialed CORS, CSRF token/library or a cross-site Authentication topology.
- JWT, Bearer credentials or frontend session-token storage.
- Centralized error-handler implementation and exact malformed-JSON/unexpected-error HTTP bodies.
- Postman/Thunder Client as required acceptance evidence.
- Performance/load testing and features outside Authentication.
- Resource-specific ownership rules owned by domain features.

### Local Integration Contract

- Run only with `NODE_ENV=test`, a dedicated `TEST_DATABASE_URL` and `TEST_DATABASE_ALLOW_RESET=true`.
- Prepare the database with existing migrations before browser integration.
- Start real Express on strict `127.0.0.1:5000` and Vite on a dedicated strict `127.0.0.1:4174` port so the existing `/api` proxy remains the browser boundary.
- Playwright opens only the Vite origin and must not register a route/mock for `/api/auth/**`.
- Use unique run-scoped email/identifier fixtures; create ordinary USER through Register and controlled ADMIN through Prisma test fixtures.
- Cleanup only suite-owned `AUTH_SESSION` records before suite-owned `USER` records.
- Browser, Vite, Express and Prisma resources must close on pass or failure; no process may remain running.
- Local HTTP cookie expectation: `HttpOnly`, `SameSite=Lax`, `Path=/`, no `Domain`, `Secure=false`.

### Vercel Preview Contract

Phase B may run only after its Human Gate. It must verify:

- the browser opens only the frontend Preview origin and calls relative `/api/auth/**`;
- browser-visible Authentication request URLs retain the frontend origin;
- the approved rewrite forwards all four endpoints to the backend Preview project without exposing that origin to application code;
- Authentication responses are not cached;
- Register/Login/reload/bootstrap/Logout operate against the approved non-production Supabase database;
- Preview HTTPS cookie is `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` and host-only/no explicit `Domain`;
- Logout removes the current session and subsequent `/me` returns `401`.

The backend Preview destination mechanism remains intentionally undecided until the Phase B Human Gate; Phase A must not hard-code one.

### Cookie Contract

| Environment | HttpOnly | Secure | SameSite | Path | Domain |
|---|---:|---:|---|---|---|
| Local HTTP | Yes | No | Lax | `/` | absent |
| Vercel Preview HTTPS | Yes | Yes | Lax | `/` | absent |

- The raw session token may exist only in the browser-managed cookie jar.
- JSON, DOM, local/session storage and captured output must not contain the raw token, password, password hash or persisted session hash.
- PostgreSQL/Supabase continues to persist only the SHA-256 session hash.

### Same-Origin, CORS and CSRF Contract

- Frontend Authentication remains relative `/api/auth/**` and browser-facing same-origin.
- Credentialed application CORS is not required and must not be introduced.
- `HttpOnly` is not treated as CSRF protection.
- Approved baseline: `SameSite=Lax`, same-origin requests, JSON request contract and backend-validated server-side session.
- Integration verification must demonstrate that a cross-site POST does not carry the Lax session cookie and cannot revoke the current authenticated session; the subsequent same-origin `/me` must remain valid.
- If observed Preview routing becomes cross-site or needs credentialed CORS, stop and return to PLAN; do not adapt TASK-015 silently.

### USER / ADMIN Boundary

- USER and ADMIN must each authenticate through the real Login endpoint and obtain identity through real `/me`.
- USER registration uses the public Register flow.
- ADMIN setup uses a controlled Prisma test fixture because no public role-elevation endpoint exists.
- Frontend role display remains UX only; backend remains the authorization boundary.
- Existing role-authorization component tests remain the evidence for Admin-only policy behavior because no approved real Admin endpoint exists.
- TASK-015 must not claim real Admin-endpoint authorization coverage or create an endpoint to obtain it.

### Test Database, Fixture and Cleanup Contract

- Local integration uses the existing dedicated Supabase TEST DB safety gate.
- Preview requires a separately Human-approved non-production database/branch.
- No broad reset may run against production or a shared Preview database not explicitly approved for reset.
- Fixtures use a unique run prefix and cleanup only their owned records in foreign-key-safe order.
- Setup/teardown must be repeatable after both successful and failed runs.
- Database URLs, credentials, passwords, raw tokens and hashes must never be printed or persisted in reports.

### Error Contract Decision

- Approved known Authentication `400`, `401` and `409` contracts remain in regression scope.
- Malformed JSON final response and unexpected-error final HTTP response remain explicitly deferred under the existing approved documents because a centralized error-handler contract is not approved/implemented.
- Existing component evidence must continue to prove unexpected errors are forwarded with `next(error)`.
- TASK-015 must not add a centralized error handler or count deferred behavior as passing evidence.

### Secret and Environment Safety

- Repository examples document variable names only.
- Local secrets remain in ignored environment files; Preview secrets remain in Vercel environment configuration.
- Preview backend requires a non-production `DATABASE_URL` and production-mode HTTPS cookie context.
- A Preview URL/access credential may be supplied to the verifier only after Human authorization and must not be committed, echoed or included in screenshots/reports.
- No frontend bundle may contain the backend database URL, Supabase credential, Vercel credential or raw backend project secret.

### Automated and Human Verification Boundary

#### Automated Phase A

- prerequisite unit/component regression;
- real local browser flow and database effects;
- local cookie/session/security invariants;
- process/database isolation and repeated execution;
- backend suite, TASK-014 suite, lint/build and diff checks.

#### Automated Phase B, after Human Gate

- real Preview browser flow, rewrite/origin behavior, HTTPS cookie attributes and safe CSRF baseline where infrastructure access permits automation.

#### Human-gated Phase B evidence

- correct Vercel project selection/linking;
- approved non-production database and environment-variable scope;
- backend destination mechanism;
- Preview deployment authorization and URL/access;
- Deployment Protection configuration/access.

Manual Postman/Thunder Client smoke is optional diagnostic work and is not required acceptance evidence.

### Acceptance Criteria

- **AC-015-01:** Local browser flow runs through Vite → real Express → Prisma → dedicated Supabase TEST DB without mocking Authentication API requests.
- **AC-015-02:** Real Register creates the expected USER/defaults, creates no session and does not auto-login.
- **AC-015-03:** Real Login creates a persisted hashed session, renders Dashboard and exposes no raw credential/session value through JSON, DOM, storage or logs.
- **AC-015-04:** Browser reload/bootstrap calls real `/me` and restores the correct persisted identity.
- **AC-015-05:** Real Logout removes only the current session and a subsequent `/me` returns `401` while idempotent behavior remains intact.
- **AC-015-06:** Persisted USER and controlled ADMIN fixtures each receive the correct server-derived Login/`/me` identity; no Admin route/API/page is created.
- **AC-015-07:** Local cookie is `HttpOnly`, `SameSite=Lax`, `Path=/`, has no explicit `Domain` and is not `Secure` over local HTTP.
- **AC-015-08:** After the Phase B gate, Preview cookie is `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` and host-only/no explicit `Domain`.
- **AC-015-09:** Frontend uses only relative `/api/auth/**`; browser-visible Authentication requests retain the frontend origin.
- **AC-015-10:** Selected topology operates without credentialed application CORS.
- **AC-015-11:** Approved CSRF baseline is verified; a cross-site POST cannot carry/revoke the authenticated Lax-cookie session.
- **AC-015-12:** After the Phase B gate, the approved Preview rewrite forwards all four endpoints without caching Authentication responses.
- **AC-015-13:** Supabase fixtures are isolated, safely cleaned and never use or reset production data.
- **AC-015-14:** Existing backend suite, TASK-014 suite, local integration suite, applicable lint/build commands and `git diff --check` pass.
- **AC-015-15:** Phase B is reported separately as `PASS`, `FAIL`, `BLOCKED` or `NOT RUN`; unavailable Preview infrastructure is never presented as passing evidence.
- **AC-015-16:** Known Authentication errors retain their approved contract; deferred centralized-error cases remain explicit and are not counted as pass.
- **AC-015-17:** No schema/migration, API/Auth architecture, Admin feature, new role, production deployment or unapproved mechanism is introduced.
- **AC-015-18:** No secret, raw password, raw session token, password hash, session hash or database credential is committed or exposed in test output/reports.

### Phase A Implementation and Verification Requirements

- Implement only the approved Phase A prerequisites and local integration harness.
- Add or update focused cookie and Vercel-entry component tests.
- Run targeted local real-stack integration, then repeat it to establish deterministic cleanup/process lifecycle.
- Run the existing backend Authentication suite and TASK-014 aggregate frontend Authentication suite.
- Run frontend lint/build and any repository-provided applicable backend checks; report unavailable commands honestly.
- Run `git diff --check` and audit tracked/untracked secrets and generated artifacts.
- Report Phase B as `NOT RUN — HUMAN GATE`; do not mark TASK-015 DONE after Phase A alone.

### Traceability

- SPEC: all Authentication acceptance criteria.
- PLAN: `4. Tác động kiến trúc`, `6. Credential Lifecycle`, `9. Thiết kế Authorization`, `13. Chiến lược Testing`, `16. Risks và Edge Cases`.
- DATABASE: `USER`, `AUTH_SESSION`, relationship, constraints and approved initial database scope.
- API_SPEC: Authentication endpoint inventory and authorization/security rules.

### Approval Gate

```text
TASK-015 DETERMINISTIC CONTRACT: APPROVED
TASK-015 TWO-PHASE MODEL: APPROVED
TASK-015 AC-015-01 THROUGH AC-015-18: APPROVED
PHASE A STATUS: COMPLETE
PHASE A IMPLEMENT: COMPLETE
PHASE A TEST: PASS
PHASE A REVIEW: APPROVED
TASK-015 STATUS: IN_PROGRESS — NOT DONE
PHASE B: NOT AUTHORIZED
PHASE B BLOCKER: HUMAN GATE
PRODUCTION DEPLOYMENT: NOT AUTHORIZED
```

Phase A completion does not close TASK-015. Phase B remains blocked until the Human Gate is explicitly satisfied.

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
