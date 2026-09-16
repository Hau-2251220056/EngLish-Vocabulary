# TASKS: Authentication Implementation Tasks

## 1. Document Status

- Workflow: TASK
- SPEC: Được workflow xác nhận APPROVED.
- PLAN: Được workflow xác nhận APPROVED.
- Database documentation: Đã đồng bộ `AUTH_SESSION` và được workflow xác nhận APPROVED.
- Feature status trong `docs/FEATURE_STATUS.md`: `TODO`.
- TASK status: Technical implementation breakdown, chờ developer review/approval.

TASK này chỉ phân rã implementation. Không chứa implementation code và không tự chuyển sang IMPLEMENT.

## 2. Source Documents

- `AGENTS.md` — quy tắc repository và workflow.
- `docs/PROJECT_OVERVIEW.md` — product scope và actors.
- `docs/specs/AUTHENTICATION_SPEC.md` — Authentication business requirements.
- `docs/plans/AUTHENTICATION_PLAN.md` — approved technical direction.
- `docs/DATABASE.md` — approved data model, `AUTH_SESSION` và constraints.
- `docs/API_SPEC.md` — API endpoints và API contract hiện có.
- `docs/FEATURE_STATUS.md` — current feature status.
- `docs/ARCHITECTURE.md` — layered backend và frontend architecture.

`docs/SYSTEM_OVERVIEW.md` không tồn tại trong repository; `docs/PROJECT_OVERVIEW.md` là tài liệu system-level tương ứng được sử dụng.

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

## 4. Task Dependency / Execution Order

```text
TASK-001 Database / Prisma AUTH_SESSION
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

## 5. Detailed Tasks

### TASK-001 — Integrate USER and AUTH_SESSION database model

**Objective**

Đưa database model đã được phê duyệt vào Prisma/data-access layer để hỗ trợ server-side sessions.

**Dependencies**

- None.
- `docs/DATABASE.md` đã được đồng bộ trước task này.

**Files / Modules**

- Backend Prisma/database configuration và schema module hiện có hoặc sẽ được thiết lập theo architecture.
- Không đoán path mới khi source structure chưa có module tương ứng.

**In Scope**

- Reuse `USER`.
- Thêm entity `AUTH_SESSION` với đúng các field:
  - `id`
  - `user_id`
  - `session_identifier_hash`
  - `created_at`
  - `expires_at`
- Thiết lập `USER 1:N AUTH_SESSION`.
- Foreign key từ `AUTH_SESSION.user_id` tới `USER.id`.
- Unique constraint/index cho `session_identifier_hash`.
- Bảo đảm raw session token không có field persistence.
- Chuẩn bị migration cần thiết theo database workflow sau khi task được approve.

**Out of Scope**

- `revoked_at`.
- `last_used_at`.
- IP, user-agent, device name.
- Session/device history.
- Logout-all-devices.
- Redis hoặc JWT fields.
- Thay đổi entity khác.

**Implementation Requirements**

- Tuân thủ naming và relationship notation trong `DATABASE.md`.
- Không dùng cascade delete tùy tiện.
- `expires_at` phải hỗ trợ session lifetime recommendation 7 ngày.
- Chỉ tạo migration sau khi TASK và implementation được approve theo workflow.

**Acceptance Criteria**

- `AUTH_SESSION` có đúng năm field đã duyệt.
- Relationship `USER 1:N AUTH_SESSION` tồn tại.
- `session_identifier_hash` unique.
- `AUTH_SESSION.user_id` tham chiếu `USER.id`.
- Không có field session ngoài approved design.

**Testing Requirements**

- Prisma/schema validation hoặc tương đương pass.
- Migration/schema verification pass khi TEST stage thực hiện.
- Kiểm tra constraint unique và foreign key.

**Traceability**

- PLAN: `10. Tác động Database`, `15. Thứ tự Implementation`.
- DATABASE: `5. USER`, `5.6. AUTH_SESSION`, `25. Main Relationships`, `26. Indexing Strategy`, `27. Foreign Key Rules`, `38. Initial Database Scope`.

### TASK-002 — Implement password security utility

**Objective**

Cung cấp password hashing và verification dùng Node built-in crypto theo approved PLAN.

**Dependencies**

- TASK-001 có thể chạy song song về mặt data model, nhưng Auth Service phải chờ TASK-002.

**Files / Modules**

- Backend security/auth utility module trong source structure hiện có.

**In Scope**

- Dùng `node:crypto` với `crypto.scrypt` hoặc `crypto.scryptSync`.
- Tạo salt bằng cryptographically secure random generator.
- Lưu đủ metadata trong `password_hash` để verify:
  - thuật toán;
  - parameters;
  - salt;
  - derived key/hash.
- Constant-time comparison khi verify.
- Password tối thiểu 8 ký tự được backend kiểm tra.

**Out of Scope**

- bcrypt, argon2 hoặc password library khác.
- Password reset/recovery.
- Password policy ngoài minimum 8 ký tự nếu chưa được approve.

**Implementation Requirements**

- Không dùng SHA-256 trực tiếp làm password hash.
- Không tự dùng weaker/default scrypt parameters chỉ vì tiện.
- Scrypt parameters phải được technical-validate trước IMPLEMENT dựa trên security và performance deployment.
- Không log plaintext password hoặc password hash.

**Acceptance Criteria**

- Password hợp lệ được hash trước persistence.
- Password đúng verify thành công.
- Password sai verify thất bại.
- `password_hash` chứa metadata cần thiết.
- Plaintext password/hash không xuất hiện trong log hoặc API response.

**Testing Requirements**

- Minimum length validation.
- Hash/verify success.
- Wrong password failure.
- Salt uniqueness.
- Metadata parsing/verification.
- Constant-time comparison path.

**Traceability**

- SPEC: `BR-07` đến `BR-09`, `AC-04`, `AC-07`.
- PLAN: `7. Password Security`, `13. Chiến lược Testing`.
- DATABASE: `5. USER`.

### TASK-003 — Implement USER repository/data access

**Objective**

Cung cấp data access cho registration, login và current-user flow.

**Dependencies**

- TASK-001.

**Files / Modules**

- Backend User Repository/data-access module theo source structure hiện có.

**In Scope**

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

**Out of Scope**

- User profile management.
- Admin user management.
- Thay đổi XP, level, streak hoặc learning progress.
- Nhận `user_id`/`owner_id` từ client để xác định identity.

**Implementation Requirements**

- Repository chỉ làm data access, không chứa business rules.
- Email normalization authoritative nằm ở backend service/data flow.
- Không trả `password_hash` cho controller response.

**Acceptance Criteria**

- Registration query nhận email normalized.
- Duplicate email được phát hiện hoặc database constraint bảo vệ.
- User mới có đúng defaults đã duyệt.
- Current-user lookup trả được User cần thiết cho middleware/controller.

**Testing Requirements**

- Lookup normalized email.
- Duplicate email.
- New User defaults.
- User lookup by id.
- Không expose password hash qua response mapping.

**Traceability**

- SPEC: `BR-05`, `BR-06`, `BR-10` đến `BR-12`, `AC-02`, `AC-03`, `AC-08`.
- PLAN: `8. Thiết kế Backend`, `11. Kế hoạch triển khai API`.
- DATABASE: `5. USER`, `26. Indexing Strategy`.

### TASK-004 — Implement AUTH_SESSION repository/data access

**Objective**

Cung cấp persistence operations cho stateful sessions.

**Dependencies**

- TASK-001.

**Files / Modules**

- Backend Session Repository/data-access module theo source structure hiện có.

**In Scope**

- Tạo một `AUTH_SESSION` mới cho mỗi login thành công.
- Nhận và lưu SHA-256 hash của session token.
- Tìm session theo hash.
- Kiểm tra `expires_at`.
- Xóa current session khi Logout.
- Có thể cleanup expired sessions theo phạm vi tối giản của PLAN.

**Out of Scope**

- Raw session token persistence.
- `revoked_at`.
- `last_used_at`.
- IP/user-agent/device tracking.
- Logout-all-devices.
- Session management UI.

**Implementation Requirements**

- Session token tạo ở Auth Service/security utility, không tạo tùy ý trong repository.
- Repository không nhận `user_id` từ client.
- Mỗi User có thể có nhiều session.
- Delete current session không ảnh hưởng các session khác của User.

**Acceptance Criteria**

- Login lần mới tạo record `AUTH_SESSION` mới.
- Có thể lookup bằng SHA-256 hash.
- Expired session không được coi là hợp lệ.
- Logout xóa đúng current session.
- Session khác của cùng User vẫn tồn tại.

**Testing Requirements**

- Session creation.
- Hash lookup.
- Expiration check.
- Delete current session.
- Multiple sessions per User.
- Không lưu raw token.

**Traceability**

- SPEC: `BR-16`, `AC-16`.
- PLAN: `6. Credential Lifecycle`, `10. Tác động Database`, `11. Kế hoạch triển khai API`.
- DATABASE: `5.6. AUTH_SESSION`, `25. Main Relationships`, `27. Foreign Key Rules`.

### TASK-005 — Implement Authentication Service

**Objective**

Điều phối business flow registration, login, logout và current-user authentication ở Service layer.

**Dependencies**

- TASK-002.
- TASK-003.
- TASK-004.

**Files / Modules**

- Backend Auth Service module theo source structure hiện có.

**In Scope**

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

**Out of Scope**

- Set/clear HTTP cookie.
- HTTP response mapping.
- New authentication mechanism.
- JWT, refresh token, OAuth, Redis.
- Password reset/recovery.

**Implementation Requirements**

- Auth Service không trực tiếp thao tác HTTP cookie.
- Không trả raw session token cho frontend.
- Invalid email, wrong password và inactive account có public behavior nhất quán.
- Backend là authority cho account status và identity.

**Acceptance Criteria**

- Registration hợp lệ tạo User đúng defaults.
- Registration không tạo session.
- Login hợp lệ tạo session và trả internal authentication result.
- Inactive/invalid credentials bị từ chối mà không lộ account state.
- Logout hiện tại idempotent và chỉ xóa current session.

**Testing Requirements**

- Registration success/validation/duplicate email.
- Email normalization.
- Password verification.
- Inactive account.
- Generic authentication failure.
- Session creation and deletion.
- Logout idempotency.

**Traceability**

- SPEC: `4. User Flow`, `5. Business Rules`, `8. Acceptance Criteria`.
- PLAN: `6. Credential Lifecycle`, `7. Password Security`, `8. Thiết kế Backend`.

### TASK-006 — Implement authentication middleware

**Objective**

Xác thực `session_id` cookie trên protected requests và attach authenticated identity.

**Dependencies**

- TASK-004.
- TASK-005.

**Files / Modules**

- Backend authentication middleware module theo source structure hiện có.

**In Scope**

- Đọc raw token từ cookie `session_id`.
- SHA-256 hash token.
- Lookup `AUTH_SESSION`.
- Kiểm tra session existence và `expires_at`.
- Load User.
- Kiểm tra `is_active`.
- Attach authenticated identity vào request context.
- Trả `401 Unauthorized` cho protected endpoints khi credential thiếu/không hợp lệ.

**Out of Scope**

- Logout hard-401 flow.
- Role authorization.
- Ownership logic của từng domain.
- Frontend route protection.

**Implementation Requirements**

- Raw token không log.
- Không tin identity do client gửi.
- Chỉ dùng session đã xác thực và User hiện tại.
- `POST /api/auth/logout` không bị buộc qua hard-401 authentication flow.

**Acceptance Criteria**

- Session hợp lệ tạo authenticated identity.
- Token sai, malformed, expired hoặc User inactive bị từ chối trên protected endpoint.
- Missing credential bị từ chối trên protected endpoint.
- Logout vẫn xử lý idempotently ngoài hard-401 flow.

**Testing Requirements**

- Valid session.
- Missing/malformed/expired session.
- Deleted session.
- Inactive User.
- Raw token không xuất hiện trong log/test response.

**Traceability**

- SPEC: `BR-13`, `BR-19`, `AC-14`, `AC-15`, `AC-17`.
- PLAN: `6. Credential Lifecycle`, `8. Thiết kế Backend`, `9. Thiết kế Authorization`.

### TASK-007 — Implement role authorization and authenticated identity context

**Objective**

Enforce `USER`/`ADMIN` role access và cung cấp authenticated identity context cho domain features.

**Dependencies**

- TASK-006.

**Files / Modules**

- Backend authorization middleware/shared authorization module.
- Authenticated identity context used by domain features.

**In Scope**

- Authenticated active User access.
- `ADMIN`-only access.
- Reject authenticated `USER` from Admin endpoints with `403 Forbidden`.
- Attach the authenticated identity from the validated session.
- Reject client-supplied `user_id`, `owner_id` hoặc `role` as authentication/authorization authority.
- Keep frontend role visibility as UX only.

**Out of Scope**

- New roles.
- Admin user-management feature implementation.
- Ownership enforcement for Vocabulary Set, Community hoặc các domain resource cụ thể; domain feature tasks phải xử lý phần này.

**Implementation Requirements**

- Backend remains security boundary.
- Role read from current authenticated User.
- Authentication is responsible for identity authentication and role authorization only.
- Domain features are responsible for resource-specific ownership checks using the authenticated identity.
- Authoritative XP, level, streak and learning progress are not accepted from client.

**Acceptance Criteria**

- `ADMIN` endpoint accepts authenticated `ADMIN` only.
- Authenticated `USER` receives `403 Forbidden` on Admin-only endpoint.
- Unauthenticated requests are rejected before protected operation.
- Authenticated identity is available to downstream domain features.
- Authentication does not treat client-supplied `user_id`, `owner_id` or `role` as trusted identity/role data.

**Testing Requirements**

- USER authorization.
- ADMIN authorization.
- Authenticated identity context.
- Forged `user_id`, `owner_id`, `role` are not used as authentication/role authority.
- Backend-only enforcement independent of frontend visibility.

**Traceability**

- SPEC: `BR-01`, `BR-02`, `BR-20` to `BR-23`, `AC-17` to `AC-20`.
- PLAN: `9. Thiết kế Authorization`.
- API_SPEC: `4. Actors`, `58. Authorization Rules`, `59. Ownership Rules`, `66. Security Requirements`.

### TASK-008 — Implement Auth Controller and HTTP cookie transport

**Objective**

Expose HTTP behavior while keeping cookie transport in Controller/HTTP layer.

**Dependencies**

- TASK-005.
- TASK-006.
- TASK-007.

**Files / Modules**

- Backend Auth Controller/HTTP layer theo source structure hiện có.

**In Scope**

- Receive Auth Service result.
- Set cookie `session_id` after Login.
- Clear cookie `session_id` after Logout in every case.
- Return only approved User identity fields.
- Map errors to approved status/response format.
- Preserve raw session token only for cookie handling.

**Out of Scope**

- Business logic in Controller.
- Raw session token in JSON response.
- Cookie name khác `session_id`.
- Hard-401 Logout behavior.

**Implementation Requirements**

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

**Acceptance Criteria**

- Login sets only cookie `session_id`.
- Raw token is absent from JSON responses.
- Logout clears cookie whether session is valid, missing, malformed, expired or deleted.
- Logout returns `204 No Content` in all idempotent cases.
- Register/Login/Me return the approved identity and status behavior.

**Testing Requirements**

- Set-Cookie after Login.
- Cookie clearing after Logout.
- Raw token absence in JSON.
- Status and error mapping.
- Credentialed CORS configuration.
- Cookie topology configuration.

**Traceability**

- SPEC: `7. API Requirements`, `8. Acceptance Criteria`.
- PLAN: `4. Tác động kiến trúc`, `6. Credential Lifecycle`, `11. Kế hoạch triển khai API`.
- API_SPEC: `5. Authentication`, `6. Login`, `7. Current User`, `63. Error Response`, `64. HTTP Status Codes`, `71. API Endpoint Inventory`.

### TASK-009 — Register Authentication routes

**Objective**

Map the approved Authentication endpoints to Controller handlers without adding duplicate routes.

**Dependencies**

- TASK-008.

**Files / Modules**

- Backend route registration module in the existing Express application.

**In Scope**

- `POST /api/auth/register`.
- `POST /api/auth/login`.
- `POST /api/auth/logout`.
- `GET /api/auth/me`.
- Apply protected middleware to protected endpoints.
- Keep Logout outside hard-401 authentication flow.
- Connect routes to Controller only.

**Out of Scope**

- New endpoints.
- Duplicate endpoints.
- Business logic in route definitions.
- Profile, Daily Goal or Admin Management routes.

**Implementation Requirements**

- Preserve layered architecture.
- Use centralized error handling and validation.
- Keep endpoint names unchanged.

**Acceptance Criteria**

- All four endpoints are registered once.
- Guest access works for Register/Login.
- Protected Current User access requires valid session.
- Logout remains idempotent without hard-401 dependency.

**Testing Requirements**

- Route registration/integration tests for all four endpoints.
- Authenticated and unauthenticated access behavior.
- No duplicate route behavior.

**Traceability**

- SPEC: `7. API Requirements`.
- PLAN: `8. Thiết kế Backend`, `11. Kế hoạch triển khai API`.
- API_SPEC: `71. API Endpoint Inventory`.

### TASK-010 — Backend Authentication and security tests

**Objective**

Bao phủ backend unit, integration và security behavior của Authentication.

**Dependencies**

- TASK-009.

**Files / Modules**

- Existing backend test infrastructure if available.
- New Authentication test modules only after the test infrastructure decision is approved.

**In Scope**

- Registration success, validation, duplicate email and defaults.
- Email normalization.
- Password hashing/verification and metadata.
- Invalid credentials and inactive account.
- 32-byte session generation and SHA-256 hash persistence.
- Multiple sessions.
- Session expiration.
- Logout deletion and idempotency.
- Cookies and raw token exclusion.
- `/api/auth/me`.
- USER/ADMIN authorization and ownership.
- CORS/CSRF behavior based on verified deployment topology.

**Out of Scope**

- New testing framework without approval.
- Tests for unapproved features.
- Performance/security scope outside approved Authentication behavior.

**Acceptance Criteria**

- Backend tests cover all Authentication acceptance criteria and security boundaries.
- Invalid credentials do not reveal account state.
- Raw session token/password/hash are not returned or logged.
- Logout tests cover missing, malformed, expired and deleted sessions.
- Authorization and ownership tests pass.

**Testing Requirements**

- Run relevant backend unit/API/integration tests during TEST stage.
- Run build/lint checks where available.
- Record unavailable test infrastructure rather than assuming success.

**Traceability**

- SPEC: `8. Acceptance Criteria`, `9. Edge Cases`.
- PLAN: `13. Chiến lược Testing`.
- AGENTS: Testing Rules and Verification.

### TASK-011 — Implement frontend Auth API service and authentication state

**Objective**

Kết nối frontend với Authentication API và khởi tạo authenticated state từ backend.

**Dependencies**

- TASK-009.

**Files / Modules**

- Frontend service/state/context modules theo existing frontend structure.
- Không tự đoán path mới nếu source structure chưa có module tương ứng.

**In Scope**

- `authService.register`.
- `authService.login`.
- `authService.logout`.
- `authService.getCurrentUser`.
- App initialization bằng `GET /api/auth/me`.
- Authentication state:
  - `user`;
  - `isAuthenticated`;
  - `isLoading`;
  - authentication error state.
- Browser-managed cookie credentials.
- UX email normalization only.

**Out of Scope**

- Raw session token storage.
- Client-side security enforcement.
- XP/level/streak/progress calculation.
- New API endpoints.

**Implementation Requirements**

- Frontend không nhận hoặc lưu raw session token.
- Backend remains authoritative.
- Frontend validation không thay thế backend validation.
- Credential transport phù hợp với cookie topology đã verify.

**Acceptance Criteria**

- App initializes auth state from `/api/auth/me`.
- Valid session produces authenticated state.
- Missing/expired session produces Guest state.
- Login/register/logout service methods call approved endpoints.
- Frontend does not persist raw session token.

**Testing Requirements**

- Auth initialization success/error.
- API service success/error mapping.
- Session expiration state.
- UX email normalization without relying on it for security.

**Traceability**

- SPEC: `4. User Flow`, `8. Acceptance Criteria`.
- PLAN: `12. Thiết kế Frontend`, `6. Credential Lifecycle`.
- API_SPEC: `5. Authentication`, `6. Login`, `7. Current User`.

### TASK-012 — Implement Login and Register pages/forms

**Objective**

Tạo UI cho approved Login/Register flows và form validation.

**Dependencies**

- TASK-011.

**Files / Modules**

- Existing frontend pages/components structure.

**In Scope**

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

**Out of Scope**

- Username field.
- Password reset/recovery.
- Email verification.
- Social login/MFA.
- Profile or settings screens.

**Implementation Requirements**

- `confirm_password` is client-side only and is not persisted.
- Form errors must not expose sensitive account information.
- Use approved API service and shared UI patterns where available.

**Acceptance Criteria**

- Valid Register submission reaches `POST /api/auth/register`.
- Password mismatch is rejected client-side.
- Valid Login reaches `POST /api/auth/login`.
- Successful Register redirects to Login without auto-login.
- Successful Login redirects to Dashboard.
- Loading and API error states are visible and do not duplicate submissions.

**Testing Requirements**

- Required-field validation.
- Password length UX validation.
- `confirm_password` mismatch.
- Password visibility toggle.
- Register/Login success and error states.
- Redirect behavior.

**Traceability**

- SPEC: `2. Actors`, `4. User Flow`, `7. API Requirements`, `8. Acceptance Criteria`.
- PLAN: `12. Thiết kế Frontend`.
- UI/UX: Login and Register screen requirements.

### TASK-013 — Implement protected navigation, Admin visibility and Logout UI

**Objective**

Enforce frontend navigation behavior and present authenticated/Admin UI states without treating frontend as security boundary.

**Dependencies**

- TASK-011.
- TASK-012.

**Files / Modules**

- Existing app navigation/routes/layout modules.
- Existing shared UI components where available.

**In Scope**

- Protected navigation loading state.
- Guest redirect from protected screens to Login.
- Admin navigation visibility based on backend-provided identity.
- USER does not see Admin navigation.
- Logout action through `authService.logout`.
- Reset auth state after Logout.
- Session-expired UI state.

**Out of Scope**

- Backend authorization replacement.
- Admin user management.
- Logout-all-devices.
- Session management UI.
- Device history.

**Implementation Requirements**

- Hidden navigation is UX only; backend enforces access.
- Logout must work with the idempotent `204 No Content` behavior.
- No raw token access or storage in frontend.

**Acceptance Criteria**

- Auth initialization does not render protected content before state is known.
- Guest is redirected to Login.
- Admin navigation visibility follows authenticated identity.
- Logout clears local auth state and returns user to Guest/Landing or Login according to approved flow.
- Expired session returns user to Guest flow.

**Testing Requirements**

- Protected navigation.
- Guest redirect.
- USER/Admin navigation visibility.
- Logout success and repeated logout.
- Session expiration handling.

**Traceability**

- SPEC: `2. Actors`, `4. User Flow`, `8. Acceptance Criteria`.
- PLAN: `9. Thiết kế Authorization`, `12. Thiết kế Frontend`.
- UI/UX: authenticated navigation, Login/Register and global states.

### TASK-014 — Frontend Authentication tests

**Objective**

Kiểm thử frontend Authentication behavior sau khi service, state và UI được triển khai.

**Dependencies**

- TASK-012.
- TASK-013.

**Files / Modules**

- Existing frontend test infrastructure if available.
- Authentication component/service/state test modules.

**In Scope**

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

**Out of Scope**

- New frontend test framework without approval.
- Tests for unapproved UI features.
- Backend security implementation tests.

**Acceptance Criteria**

- Frontend tests cover approved Login/Register/auth state flows.
- Protected navigation and role visibility behavior are verified.
- Logout and expired-session behavior are verified.
- Frontend does not rely on UI checks as backend authorization.

**Testing Requirements**

- Run relevant frontend tests during TEST stage.
- Run frontend lint/build where available.
- Record missing test infrastructure honestly.

**Traceability**

- SPEC: `8. Acceptance Criteria`, `9. Edge Cases`.
- PLAN: `12. Thiết kế Frontend`, `13. Chiến lược Testing`.

### TASK-015 — Authentication integration and security verification

**Objective**

Verify the complete Authentication flow across backend, frontend, database session persistence and deployment-dependent security configuration.

**Dependencies**

- TASK-010.
- TASK-014.
- Database/schema implementation from TASK-001.

**Files / Modules**

- No new feature module required; verification spans approved implementation areas.

**In Scope**

- Register → Login → Dashboard flow.
- Login → `/api/auth/me` flow.
- Logout current session.
- Multiple sessions for one User.
- Expired/deleted/malformed session behavior.
- USER/ADMIN protected access.
- Ownership/security boundary.
- Cookie `session_id` and raw token exclusion.
- Deployment topology verification:
  - origins;
  - same-origin/cross-origin;
  - same-site/cross-site;
  - credentialed CORS;
  - cookie attributes;
  - CSRF requirement.
- API status recommendations and validation status.

**Out of Scope**

- Production deployment changes.
- New infrastructure.
- Performance platform work.
- Features outside Authentication.

**Acceptance Criteria**

- End-to-end approved Authentication flow works.
- Raw session token and password data are never returned or persisted incorrectly.
- Logout invalidates only current session and remains idempotent.
- Protected endpoints enforce authentication, role and ownership.
- Cookie/CORS/CSRF configuration matches verified topology.
- No scope expansion or unapproved mechanism is introduced.

**Testing Requirements**

- Run backend and frontend test suites.
- Run API/integration tests.
- Run build/lint checks where available.
- Record unresolved environment limitations.

**Traceability**

- SPEC: all Authentication acceptance criteria.
- PLAN: `4. Tác động kiến trúc`, `6. Credential Lifecycle`, `9. Thiết kế Authorization`, `13. Chiến lược Testing`, `16. Risks và Edge Cases`.
- DATABASE: `AUTH_SESSION`, relationship, constraints and 16-table scope.
- API_SPEC: Authentication endpoint inventory and authorization/security rules.

## 6. Cross-Cutting Security Requirements

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
- Logout chỉ xóa current session và không có logout-all-devices.

## 7. Out of Scope

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
- Các Authentication feature chưa được approved.

## 8. Open Issues / Conflicts

- `docs/SYSTEM_OVERVIEW.md` không tồn tại; `docs/PROJECT_OVERVIEW.md` được dùng làm tài liệu system-level tương ứng.
- Repository SPEC hiện hiển thị metadata `SPEC status: DRAFT`, và PLAN có metadata trạng thái proposal, trong khi workflow request xác nhận cả hai đã APPROVED. Đây là metadata conflict, không thay đổi source documents trong TASK.
- `API_SPEC.md` cũ còn dùng `username` trong phần Authentication, trong khi approved SPEC/PLAN dùng `display_name`. TASK theo approved SPEC/PLAN và không sửa `API_SPEC.md`.
- `API_SPEC.md` cho phép status code `422` trong danh sách chung và chưa quy định rõ success status Authentication; approved PLAN chốt validation `400 Bad Request` và success recommendations `201/200/204/200`. TASK theo PLAN và không sửa `API_SPEC.md`.
- `FEATURE_STATUS.md` vẫn ghi Authentication `TODO` dù workflow đã đi tới TASK. TASK không sửa status; status update thuộc workflow stage phù hợp.
- Testing framework, Prisma setup và exact module paths chưa tồn tại trong source hiện tại. TASK không tự chọn dependency hoặc invent path; implementation phải follow approved PLAN và existing structure.

Không có conflict nào làm thay đổi approved Authentication architecture trong TASK này.

## 9. Final Validation Checklist

### Scope

- [x] Tasks chỉ thuộc approved Authentication scope.
- [x] Không thêm JWT, refresh token, OAuth, MFA, Redis hoặc feature ngoài scope.
- [x] Không thêm role mới.
- [x] Không thêm `AUTH_SESSION` field ngoài `DATABASE.md`.

### Architecture

- [x] Stateful server-side session được bảo toàn.
- [x] Layering Route → Middleware → Controller → Service → Repository/Data Access → Prisma → PostgreSQL được bảo toàn.
- [x] Auth Service không set/clear HTTP cookie.
- [x] Controller/HTTP layer chịu trách nhiệm cookie transport.
- [x] Authorization và ownership được enforce ở backend.

### Security

- [x] Password `scrypt` và secure salt được phản ánh.
- [x] Raw session token không lưu database/frontend/log/response.
- [x] SHA-256 hash và 32-byte token được phản ánh.
- [x] Cookie `session_id` và HTTP-only được phản ánh.
- [x] CORS/CSRF/deployment topology requirements được phản ánh.
- [x] Không trust client identity hoặc authoritative business values.

### API

- [x] Bốn Authentication endpoints được trace.
- [x] Không tạo duplicate endpoint.
- [x] Status recommendations và validation status theo PLAN.
- [x] Không tự sửa API contract.

### Database

- [x] `USER` được reuse.
- [x] `AUTH_SESSION` khớp `DATABASE.md`.
- [x] `USER 1:N AUTH_SESSION` được trace.
- [x] Unique hash và foreign key được phản ánh.
- [x] Không thêm session metadata ngoài approved design.

### Testing

- [x] Backend unit tests được phân rã.
- [x] API/integration tests được phân rã.
- [x] Frontend Authentication tests được phân rã.
- [x] Security-sensitive behavior có test requirement.

### Traceability

- [x] Mỗi task có SPEC/PLAN/DATABASE/API traceability phù hợp.
- [x] Không tạo requirement ID giả.
- [x] Conflict được ghi nhận thay vì âm thầm sửa.

### Workflow

- [x] Không viết implementation code.
- [x] Không tạo migration.
- [x] Không cài dependency.
- [x] Không tạo file ngoài TASK này.
- [x] Không sửa SPEC, PLAN, DATABASE hoặc FEATURE_STATUS.
- [x] Không chuyển sang IMPLEMENT.
