# PLAN: Authentication

**Giai đoạn workflow:** PLAN

**Trạng thái:** Đã được developer approve

**SPEC status:** Đã được developer approve theo workflow hiện tại

---

# 1. Mục tiêu PLAN

Xây dựng phương án kỹ thuật cho Authentication theo SPEC đã được developer phê duyệt, gồm:

- Registration.
- Login.
- Logout.
- Current authenticated user.
- Backend authentication middleware.
- Backend role-based authorization.
- Frontend authentication state và protected navigation.
- Password security.
- Stateful server-side session authentication được transport bằng HTTP-only cookie.
- Kiểm thử backend, frontend, API và security boundary.

PLAN này mô tả phương án kỹ thuật và implementation direction cho Authentication.

**PLAN không trực tiếp thực hiện:**

- Implement code.
- Tạo migration.
- Cài dependency cho Authentication.
- Tạo hoặc approve TASK.

PLAN đã được developer approve. Giai đoạn tiếp theo là hoàn thiện `AUTHENTICATION_TASK.md`, approve TASK và sau đó mới chuyển sang IMPLEMENT.

---

# 2. Phạm vi SPEC đã được phê duyệt

## In Scope

- Registration với `display_name`, `email`, `password`, `confirm_password`.
- Email normalization về lowercase.
- Password tối thiểu 8 ký tự.
- Password hashing.
- Login bằng email và password.
- Logout.
- `GET /api/auth/me`.
- Authentication và authorization ở backend.
- Hai role: `USER`, `ADMIN`.
- Account inactive không được authenticate.
- Frontend Login/Register/auth state/protected navigation.
- Error handling không tiết lộ thông tin nhạy cảm.

## Out of Scope

- Password reset/recovery.
- Email verification.
- Social login.
- MFA.
- Premium/subscription.
- Session history.
- Device history.
- Account deletion.
- Role mới.
- Admin user management.
- Authentication feature chưa được phê duyệt.
- Hỗ trợ user data cũ trong v1.
- Logout all devices.
- IP tracking.
- User-agent tracking.

---

# 3. Phân tích implementation hiện tại

## Backend

Hiện chỉ có:

`backend/src/main.js`

- Khởi tạo Express.
- Khai báo route `/`.
- Chưa có API `/api`.
- Chưa có middleware, controller, service, repository hoặc database access trong application layer.

`backend/package.json` hiện có các dependency nền tảng hiện tại như:

- `express`
- `nodemon`

Chưa có implementation hoàn chỉnh cho:

- Prisma data access trong application layer.
- User repository.
- Session repository.
- Password hashing.
- Cookie/session handling.
- Validation library.
- Test infrastructure.
- Authentication middleware.

## Frontend

Hiện chỉ có:

`frontend/src/App.jsx`

- Render nội dung tối thiểu.

`frontend/src/main.jsx`

- Khởi tạo React application.

`frontend/package.json` hiện có React, Vite và Tailwind.

Chưa có:

- Login Page.
- Register Page.
- Auth API service.
- Auth state/context.
- Protected route/navigation.
- Logout flow.
- Admin navigation visibility.

## Feature status

Authentication và các feature User Management trong `docs/FEATURE_STATUS.md` hiện vẫn đang `TODO`.

Đây là trạng thái đúng vì Authentication chưa được implement.

Không có implementation Authentication hiện tại cần reuse. PLAN sẽ xác định các layer cần thiết theo kiến trúc đã được phê duyệt.

---

# 4. Tác động kiến trúc

## Backend

Tuân thủ flow:

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
PostgreSQL / Supabase
```

Các phần bị ảnh hưởng:

- Authentication routes.
- Authentication middleware.
- Authorization middleware.
- Auth controller.
- Auth service.
- User repository.
- Session repository.
- Centralized error handling.
- Environment configuration.

### Phân tách trách nhiệm cookie

Auth Service:

- Verify credentials.
- Create/delete session.
- Trả authentication result ở mức nội bộ.

Auth Service **không** set hoặc clear HTTP cookie.

Controller/HTTP layer:

- Nhận result từ Auth Service.
- Set HTTP-only cookie.
- Clear HTTP-only cookie.
- Mapping service result thành HTTP response.

Raw session identifier không được đưa vào response body.

---

## Frontend

Tuân thủ flow:

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

Các phần bị ảnh hưởng:

- Login Page.
- Register Page.
- Auth API service.
- Authentication state.
- Protected navigation.
- Guest/authenticated UI separation.
- Admin UI visibility.
- Logout interaction.

Frontend không nhận hoặc lưu raw session identifier.

---

## Database

Authentication sử dụng các entity database đã được định nghĩa và phê duyệt trong `docs/DATABASE.md`.

### USER

`USER` là database entity đã được định nghĩa trong `DATABASE.md`.

Thiết kế `USER` đã được phê duyệt ở mức database design nhưng hiện chưa được materialize trong Prisma schema.

Authentication implementation phải materialize `USER` vào Prisma schema theo đúng `DATABASE.md`.

Không được:

- Redesign `USER`.
- Bổ sung field ngoài database design đã được phê duyệt.
- Thay đổi role model.
- Thay đổi relationship ngoài scope đã được phê duyệt.
- Tạo entity `USER` thứ hai.

### AUTH_SESSION

`AUTH_SESSION` đã được định nghĩa trong `DATABASE.md` và là một phần của database design đã được phê duyệt.

Authentication sử dụng đúng cấu trúc `AUTH_SESSION` đã được định nghĩa.

Implementation phải materialize `AUTH_SESSION` vào Prisma schema theo đúng database design.

Relationship:

```text
USER 1 ─── N AUTH_SESSION
```

PLAN không thay đổi database design.

PLAN chỉ xác định cách Authentication sử dụng các entity đã được định nghĩa trong `DATABASE.md`.

---

## API

Tái sử dụng các endpoint:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

Không tạo duplicate endpoint.

---

## Security

Backend là security boundary duy nhất.

Frontend chỉ điều khiển UI/navigation, không được dùng để enforce security.

Cookie-based authentication phải được xem xét CSRF.

HttpOnly chỉ ngăn JavaScript đọc cookie, không tự chống CSRF.

---

# 5. Phân tích Authentication Mechanism

## Phương án A: JWT

### Cách hoạt động

Sau Login, backend tạo JWT.

Credential được transport qua HttpOnly cookie.

Backend verify JWT ở mỗi protected request.

Backend vẫn load user hiện tại để kiểm tra `is_active` và role mới nhất.

### Ưu điểm

- Không cần session table nếu không yêu cầu server-side revocation.
- Phù hợp với REST API.
- Dễ mở rộng khi có nhiều backend instance.
- Có thể tránh lưu token trong localStorage.

### Nhược điểm

- Logout không thể thu hồi token đã bị sao chép nếu không có revocation mechanism.
- Refresh token làm tăng complexity.
- Token bị replay có thể tiếp tục hợp lệ đến khi hết hạn.
- Revocation bằng denylist hoặc token version sẽ phát sinh persistence/schema impact.

### Logout

Xóa cookie phía client.

Nếu không có server-side revocation, credential bị sao chép vẫn có thể dùng tới khi hết hạn.

Điều này có rủi ro không đáp ứng đầy đủ yêu cầu invalidation sau Logout.

---

## Phương án B: Stateful server-side session authentication

Credential được transport bằng HTTP-only cookie.

### Cách hoạt động

Sau Login:

1. Backend tạo session token bằng cryptographically secure random generator với độ dài 32 random bytes (256-bit).
2. Backend tạo SHA-256 hash của session token.
3. Backend lưu hash trong `AUTH_SESSION`.
4. Raw session token được đưa vào cookie `session_id`.
5. Backend không lưu raw session token.
6. Khi protected request:
   - Đọc raw token từ cookie.
   - Hash token bằng SHA-256.
   - Tìm session tương ứng.
   - Kiểm tra session tồn tại.
   - Kiểm tra session chưa hết hạn.
   - Load user.
   - Kiểm tra user tồn tại.
   - Kiểm tra `is_active`.
   - Đọc role hiện tại của user.

### Ưu điểm

- Logout có thể invalidate session ngay lập tức.
- Không đưa password hoặc business data vào cookie.
- Dễ xử lý account inactive, expiration và revocation.
- Credential không thể được đọc bởi JavaScript khi dùng HttpOnly.
- Phù hợp với deployment nhiều instance nếu sử dụng shared PostgreSQL/Supabase.

### Nhược điểm

- Cần persistence cho session.
- Cần `AUTH_SESSION`.
- Mỗi protected request cần kiểm tra session persistence.
- Cần xử lý cleanup session hết hạn.

### Logout

Auth Service xóa session hiện tại.

Controller/HTTP layer clear cookie.

Credential cũ không còn sử dụng được sau Logout.

Không triển khai Logout all devices trong v1.

---

## So sánh

| Tiêu chí                       | JWT                            | Stateful server-side session |
| ------------------------------ | ------------------------------ | ---------------------------- |
| Complexity ban đầu             | Trung bình                     | Trung bình                   |
| Logout tức thời                | Cần revocation bổ sung         | Có                           |
| Database impact                | Thấp nếu không revoke          | Cần AUTH_SESSION             |
| Credential exposure ở frontend | Có thể tránh bằng cookie       | Có thể tránh bằng cookie     |
| Credential expiration          | JWT `exp`                      | `expires_at`                 |
| Account inactive               | Kiểm tra mỗi request           | Kiểm tra mỗi request         |
| Revocation                     | Phức tạp hơn                   | Trực tiếp                    |
| Deployment nhiều instance      | Tốt                            | Tốt với shared database      |
| Phù hợp yêu cầu Logout         | Có limitation nếu không revoke | Phù hợp                      |

## Phương án được chọn

Sử dụng **stateful server-side session authentication được transport bằng HTTP-only cookie**, với session persistence trong PostgreSQL/Supabase.

Lý do:

- Đáp ứng tốt yêu cầu Logout và credential invalidation.
- Không expose credential cho JavaScript.
- Cho phép vô hiệu hóa credential ngay lập tức.
- Dễ kiểm tra `is_active` và role hiện tại.
- Phù hợp với Node/Express + PostgreSQL/Supabase.
- Tránh replay window của JWT sau Logout.
- Phù hợp với phạm vi đồ án khi session được thiết kế tối giản.

Đây là authentication mechanism đã được developer approve cho implementation.

---

# 6. Credential Lifecycle

## Credential creation

Sau Login thành công:

1. Auth Service normalize email.
2. Auth Service tìm user theo email.
3. Auth Service kiểm tra `is_active`.
4. Auth Service verify password hash.
5. Auth Service tạo session token bằng cryptographically secure random generator với độ dài 32 random bytes (256-bit).
6. Auth Service tạo SHA-256 hash của session token.
7. Session Repository lưu session record với hash, không lưu raw token.
8. Auth Service trả authentication result cho Controller ở mức nội bộ.
9. Controller/HTTP layer set raw session token vào cookie `session_id` với thuộc tính HTTP-only.
10. Controller trả user identity được phép.

Raw session token:

- Chỉ tồn tại trong quá trình tạo và xử lý cookie.
- Không được lưu database.
- Không được log.
- Không xuất hiện trong response body.

---

## Credential transport

Credential được transport bằng cookie `session_id`.

Cookie attributes gồm:

- `HttpOnly`.
- `Secure`.
- `SameSite`.
- `Domain`.
- `Path`.

### Quy tắc thiết kế

- `HttpOnly` là bắt buộc để JavaScript không đọc được credential.
- `Secure` được bật trong production/HTTPS.
- `SameSite` và `Path` được xác định dựa trên deployment topology thực tế và CORS configuration.
- `Domain` chỉ được cấu hình nếu deployment topology thực sự yêu cầu.
- Không đặt `Domain` rộng hơn cần thiết.
- Không tự ý chốt một giá trị `SameSite` chỉ vì frontend và backend khác origin.
- Cross-origin và cross-site là hai khái niệm khác nhau.
- Không dùng `localStorage` hoặc `sessionStorage` để lưu raw credential.

Cookie name duy nhất của Authentication là:

```text
session_id
```

Không sử dụng tên cookie khác.

---

## CSRF consideration

HttpOnly không phải biện pháp chống CSRF.

Cookie-based authentication phải được xem xét CSRF trước IMPLEMENT.

Quy tắc:

- Cookie `SameSite` phải phù hợp với deployment topology thực tế.
- Backend CORS không được dùng wildcard origin khi xử lý credentialed requests.
- Backend chỉ cho phép các frontend origin được cấu hình.
- Nếu deployment topology cuối cùng sử dụng frontend/backend khác site và credentialed cookie requests, CSRF protection là bắt buộc trước IMPLEMENT.
- Nếu deployment thực tế yêu cầu cross-site credentialed requests, phải bổ sung CSRF protection phù hợp trước IMPLEMENT.
- PLAN không chốt một CSRF library cụ thể.

---

## Pre-implementation Deployment Topology Verification

Trước IMPLEMENT phải kiểm tra:

- Frontend origin thực tế.
- Backend origin thực tế.
- Frontend/backend là cùng-origin hay cross-origin.
- Nếu cross-origin, có đồng thời cross-site hay không.
- Credentialed CORS có cần thiết hay không.
- CORS allow-origin.
- CORS credentials.
- Cookie name `session_id`.
- Cookie Domain.
- Cookie Path.
- SameSite.
- Secure.
- HttpOnly.
- CSRF requirement.
- Frontend HTTP client có cần gửi credentials hay không.

Không hard-code Domain hoặc SameSite policy khi topology thực tế chưa được verification.

---

## Credential storage phía frontend

Frontend chỉ lưu authentication state không nhạy cảm:

- `user`.
- `isAuthenticated`.
- `isLoading`.

Frontend không lưu raw session identifier trong:

- `localStorage`.
- `sessionStorage`.
- React context.
- Redux hoặc state store khác.

Browser quản lý cookie credential.

---

## Credential verification

Mỗi protected request:

1. Authentication middleware đọc raw session token từ cookie `session_id`.
2. Hash token bằng SHA-256.
3. Tìm `AUTH_SESSION`.
4. Kiểm tra session tồn tại.
5. Kiểm tra `expires_at` chưa qua.
6. Load `USER`.
7. Kiểm tra `is_active`.
8. Gắn authenticated identity vào request context.
9. Chuyển tiếp tới authorization hoặc controller.

---

## Credential lifetime

Session lifetime được approve là:

**7 ngày.**

Không triển khai:

- Remember-device.
- Refresh-token.
- Idle timeout trong v1.

Session hết hiệu lực khi `expires_at` đã qua.

---

## Credential renewal

Không triển khai refresh-token rotation hoặc remember-device trong v1.

Không triển khai idle timeout trong v1.

Nếu cần gia hạn session khi user đang hoạt động, phải xử lý như một thay đổi kỹ thuật riêng và không được mở rộng scope ngoài SPEC.

---

## Logout

`POST /api/auth/logout`

Logout không phụ thuộc vào authentication middleware theo kiểu hard `401 Unauthorized`.

Controller/HTTP layer:

- Đọc cookie nếu có.
- Chuyển credential ở mức nội bộ cho Auth Service.
- Clear HTTP-only cookie trong mọi trường hợp.
- Trả success response cho client.

Auth Service:

- Nếu credential/session hợp lệ, xóa session hiện tại thông qua Session Repository.
- Nếu credential thiếu, malformed, expired hoặc session đã bị xóa, xử lý idempotently.
- Không tạo lỗi authentication cho các trường hợp trên.
- Không set hoặc clear HTTP cookie.

Frontend:

- Reset authentication state.
- Đưa user về trạng thái Guest.

Logout lặp lại phải idempotent:

- Không tạo lỗi hệ thống.
- Cookie vẫn được clear.
- Client trở về trạng thái Guest.

Logout chỉ xóa session hiện tại được xác định từ credential cookie.

Không triển khai Logout all devices.

---

# 7. Password Security

## Thuật toán

Sử dụng `node:crypto` với `scrypt` bất đồng bộ.

Lý do:

- Có sẵn trong Node.js.
- Không cần dependency hashing riêng.
- Phù hợp cho password hashing nếu cấu hình đúng.
- Giảm dependency và complexity.

Không sử dụng hash thông thường như SHA-256 trực tiếp cho password.

Không tự thay bằng bcrypt hoặc argon2.

---

## Password hash format

`password_hash` phải chứa đủ thông tin cần thiết để verify password về sau, tối thiểu gồm:

- Thuật toán hashing.
- Các parameters cần thiết.
- Salt.
- Derived key/hash.

Format lưu trữ cụ thể không được chốt ở PLAN.

Cost parameters của scrypt phải được technical-validate trước IMPLEMENT dựa trên:

- Security requirement.
- Backend performance.
- Deployment environment.
- Khả năng chịu tải phù hợp với scope đồ án.

PLAN không tự chốt giá trị parameters cụ thể.

---

## Hashing flow

Password hashing nằm ở Auth Service hoặc security utility được Auth Service sử dụng.

```text
Auth Controller
      ↓
Auth Service
      ↓
Validate password
      ↓
Hash password with metadata
      ↓
User Repository
      ↓
USER.password_hash
```

Repository chỉ nhận `password_hash` đã được tạo để lưu.

---

## Verification flow

Password verification nằm trong Auth Service/security utility:

1. Đọc `password_hash`.
2. Đọc thuật toán, parameters, salt và derived key/hash.
3. Hash password input với cùng metadata.
4. So sánh bằng constant-time comparison.

Không trả password ra khỏi service.

Không log password hoặc hash.

---

## Security requirements

- Password tối thiểu 8 ký tự.
- Password phải được hash trước khi lưu.
- Không lưu plaintext password.
- Không trả password hoặc `password_hash`.
- Không log password, password hash, raw session token hoặc secret.
- Salt phải random và unique cho mỗi password.
- Hash parameters phải có khả năng nâng cấp trong tương lai.
- Backend phải validate lại password.
- Client-side validation chỉ phục vụ UX.

Session token phải được tạo bằng cryptographically secure random generator với 32 random bytes (256-bit).

Backend chỉ lưu SHA-256 hash của token trong `AUTH_SESSION`.

Raw token không được log hoặc lưu ở frontend.

---

# 8. Thiết kế Backend

## Routes

Các route cần được bổ sung:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

Route chỉ:

- Khai báo HTTP method và endpoint.
- Gắn middleware.
- Gọi controller.

Route không chứa business logic.

Logout là ngoại lệ về authentication middleware: không gắn middleware theo kiểu hard 401 để có thể clear cookie và trả success khi credential thiếu hoặc không còn hợp lệ.

---

## Authentication middleware

Trách nhiệm:

- Sử dụng dependency đã được developer approve là `cookie-parser` để parse HTTP Cookie.
- Đọc raw session token từ `req.cookies.session_id`.
- Xác thực session.
- Kiểm tra expiration.
- Load user.
- Kiểm tra `is_active`.
- Gắn authenticated public user identity vào `req.user`, gồm tối thiểu:
  - `id`;
  - `email`;
  - `display_name`;
  - `role`.
- Không đưa `password_hash`, raw session token, `session_identifier_hash`, `expires_at` hoặc authentication secret vào `req.user`.
- Trả `401 Unauthorized` nếu credential thiếu hoặc không hợp lệ.

Middleware áp dụng cho protected endpoints.

`POST /api/auth/logout` không dùng flow hard 401 này.

### Developer-approved technical decisions for TASK-006

- Cookie parser: `cookie-parser`.
- Raw session token source: `req.cookies.session_id`.
- Request identity property: `req.user`.

`cookie-parser` chỉ parse HTTP Cookie; không thay thế stateful server-side session architecture. Session vẫn được lưu trong `AUTH_SESSION`, raw session token chỉ tồn tại ở runtime/request cookie và không được lưu vào database.

TASK-006 không chuyển sang `express-session`, `cookie-session` hoặc JWT. Role authorization và `403 Forbidden` thuộc TASK-007.

---

## Authorization middleware

Trách nhiệm:

- Kiểm tra role yêu cầu.
- Cho phép `USER` hoặc `ADMIN` theo endpoint.
- Trả `403 Forbidden` nếu user authenticated nhưng không đủ quyền.

---

## Validation middleware

Trách nhiệm:

- Kiểm tra request shape.
- Kiểm tra required fields.
- Kiểm tra data types.
- Kiểm tra password length.

Không xử lý persistence hoặc session lifecycle.

---

## Error middleware

Trách nhiệm:

- Chuẩn hóa error response.
- Không trả stack trace production.
- Không trả password, hash, raw session identifier hoặc thông tin nội bộ.
- Không tạo response khác biệt rõ ràng làm lộ trạng thái account.

---

## Controllers

Auth Controller chịu trách nhiệm:

- Nhận request.
- Đọc input.
- Gọi Auth Service.
- Nhận authentication result ở mức nội bộ.
- Set HTTP-only cookie sau Login.
- Clear HTTP-only cookie sau Logout.
- Mapping service result/error thành HTTP response.

Không:

- Truy vấn database trực tiếp.
- Hash password trực tiếp.
- Tự xác định role.
- Tự xác định ownership.
- Đưa raw session identifier vào response body.

---

## Services

### Auth Service

Chịu trách nhiệm:

- Normalize email.
- Validate registration/login input.
- Kiểm tra email uniqueness.
- Hash và verify password.
- Kiểm tra account active.
- Tạo session.
- Kết thúc hoặc xóa session.
- Trả authentication result cho Controller ở mức nội bộ.

Không:

- Set hoặc clear HTTP cookie.
- Phụ trách HTTP response.
- Trả raw session identifier cho frontend.

### Authorization logic

Role authorization có thể đặt trong middleware dùng chung.

Business service của từng domain vẫn phải kiểm tra ownership khi xử lý resource cụ thể.

---

## Repository / Data Access

### User Repository

Trách nhiệm:

- Tìm user theo normalized email.
- Tìm user theo user id.
- Tạo user mới.
- Đọc role, `is_active` và các field cần thiết.

Không:

- Nhận owner_id từ client để xác định identity.
- Chứa password policy.
- Chứa authorization business rule.

### Session Repository

Trách nhiệm:

- Tạo session record.
- Tìm session theo SHA-256 hash của raw token từ cookie `session_id`.
- Kiểm tra expiration.
- Xóa session khi Logout.
- Cleanup session hết hạn khi cần.

Không lưu raw session token.

---

## Validation

### Registration

Backend bắt buộc validate:

- `display_name`.
- `email`.
- `password`.

`confirm_password` chỉ phục vụ client-side validation và không phải field nghiệp vụ.

### Login

Backend bắt buộc validate:

- `email`.
- `password`.

SPEC đã chốt:

- Email lowercase.
- Password tối thiểu 8 ký tự.
- `confirm_password` chỉ client-side.
- `confirm_password` không lưu database.

Các giới hạn chi tiết của `display_name`, trim và email input cần được chốt trong implementation contract nếu chưa được xác định trong SPEC.

---

## Error Handling

Technical mapping:

| Tình huống                   |               HTTP status |
| ---------------------------- | ------------------------: |
| Validation failure           |           400 Bad Request |
| Duplicate email              |              409 Conflict |
| Invalid credentials          |          401 Unauthorized |
| Missing credential           |          401 Unauthorized |
| Expired/malformed credential |          401 Unauthorized |
| Authenticated nhưng sai role |             403 Forbidden |
| Resource không tồn tại       |             404 Not Found |
| Database failure             | 500 Internal Server Error |
| Unexpected failure           | 500 Internal Server Error |

Login phải dùng behavior public nhất quán cho:

- Email không tồn tại.
- Password sai.
- Account inactive.

Không được tạo logic response khác biệt rõ ràng làm lộ trạng thái account.

Timing side-channel không cần tối ưu hóa quá mức ngoài scope đồ án, nhưng implementation không được tạo branch response công khai khác nhau cho các trường hợp trên.

---

# 9. Thiết kế Authorization

## Authentication-required endpoint

```text
Request
   ↓
Authentication middleware
   ↓
Authenticated identity
   ↓
Controller / Service
```

Nếu không có identity hợp lệ:

```text
401 Unauthorized
```

## USER access

USER được phép truy cập chức năng user-facing khi:

- Credential hợp lệ.
- Account active.
- Endpoint không yêu cầu ADMIN.
- Ownership check thành công nếu resource thuộc user.

## ADMIN access

Admin endpoint yêu cầu:

- Authenticated.
- `USER.role = ADMIN`.
- Account active.

Frontend có thể ẩn hoặc hiện Admin navigation, nhưng backend vẫn phải kiểm tra role ở mỗi request.

## Ownership check

Client không được quyết định ownership.

Không tin các field như:

- `user_id`.
- `owner_id`.
- `role`.

Backend phải:

1. Lấy user id từ authenticated session.
2. Truy vấn resource.
3. So sánh resource owner với authenticated user id.
4. Từ chối nếu không khớp.
5. Chỉ cho phép Admin khi business rule của endpoint cho phép.

Các authoritative values như XP, level, streak và learning progress không được lấy từ client.

---

# 10. Tác động Database

## USER

`USER` đã được định nghĩa trong `docs/DATABASE.md`.

Các field được sử dụng:

- `id`
- `email`
- `password_hash`
- `display_name`
- `avatar_url`
- `role`
- `is_active`
- `total_xp`
- `daily_xp_goal`
- `created_at`
- `updated_at`

`USER` là database entity đã được phê duyệt về mặt thiết kế nhưng hiện chưa được materialize trong Prisma schema.

Implementation phải materialize `USER` theo đúng `DATABASE.md`.

Không được:

- Redesign entity.
- Bổ sung field ngoài database design đã phê duyệt.
- Thay đổi role.
- Thay đổi business rule.
- Tạo entity USER thứ hai.

Email cần được bảo vệ bằng:

```text
UNIQUE(USER.email)
```

Email phải được normalize trước khi insert hoặc lookup.

---

## AUTH_SESSION

`AUTH_SESSION` đã được định nghĩa trong `docs/DATABASE.md`.

Entity v1 gồm đúng:

- `id`
- `user_id`
- `session_identifier_hash`
- `created_at`
- `expires_at`

Implementation phải materialize `AUTH_SESSION` theo đúng database design.

### id

Mục đích:

- Primary key nội bộ cho session record.

Constraint:

- Primary key.

### user_id

Mục đích:

- Liên kết session với account sở hữu session.

Constraint:

- Foreign key tới `USER.id`.
- Index trên `user_id` nếu cần truy vấn session theo user.

Không nhận `user_id` từ client.

### session_identifier_hash

Mục đích:

- Lưu SHA-256 hash của raw session token nhận từ cookie `session_id`.
- Cho phép backend tìm session mà không lưu raw session token.

Constraint:

- Unique constraint hoặc unique index.
- Index để lookup nhanh.
- Không lưu raw session token.

### created_at

Mục đích:

- Ghi nhận thời điểm session được tạo.
- Hỗ trợ session lifecycle và debugging an toàn.

Constraint:

- Not null.
- Không nhất thiết cần index riêng trong v1.

### expires_at

Mục đích:

- Xác định thời điểm session hết hiệu lực.
- Cho phép backend từ chối credential expired.
- Hỗ trợ cleanup expired session.

Constraint:

- Not null.
- Có thể index để cleanup hiệu quả.

---

## Relationship

```text
USER 1 ─── N AUTH_SESSION
```

Quy tắc:

- Một user có thể có nhiều session đồng thời.
- Mỗi session thuộc về đúng một user.
- Mỗi login thành công tạo một `AUTH_SESSION` mới.
- Logout chỉ terminate/delete session hiện tại được xác định từ cookie `session_id`.
- Không triển khai Logout all devices trong v1.
- Không triển khai session management trong v1.
- Không triển khai device history trong v1.

---

## Database design boundary

`USER` và `AUTH_SESSION` đã được định nghĩa trong `docs/DATABASE.md`.

Do đó:

- PLAN không cần bổ sung `AUTH_SESSION` vào `DATABASE.md`.
- PLAN không thay đổi database design.
- Không tạo duplicate database documentation.
- Implementation phải materialize các entity đã được database design phê duyệt vào Prisma schema.
- Migration chỉ được tạo ở IMPLEMENT stage thông qua TASK đã được approve.
- Nếu implementation phát hiện Prisma schema không khớp với `DATABASE.md`, AI Agent phải dừng và báo developer thay vì tự redesign database.

---

## Fields không thêm trong v1

### revoked_at

Không thêm trong v1.

Lý do:

- Logout xóa session record ngay.
- Không có requirement về audit hoặc giữ session record sau Logout.
- Session history nằm ngoài scope.

### last_used_at

Không thêm trong v1.

Lý do:

- Không có requirement về idle timeout.
- Cập nhật field trên mỗi request làm tăng write load.

### IP và user-agent

Không thêm trong v1.

Lý do:

- Không có requirement về IP tracking.
- Không có requirement về user-agent tracking.
- Không triển khai device history hoặc anomaly tracking.

---

## Cleanup expired session

Đề xuất v1:

- Không tạo background worker hoặc cron job riêng.
- Khi Login, có thể cleanup một batch nhỏ các session đã hết hạn nếu cần.
- Khi authentication lookup, session có `expires_at` đã qua được xem là invalid.
- Khi Logout, xóa session hiện tại.
- Cleanup toàn bộ expired session có thể thực hiện bằng maintenance operation sau này nếu cần.

Không mở rộng thành background infrastructure phức tạp.

---

## Foreign key và delete behavior

`AUTH_SESSION.user_id` tham chiếu `USER.id`.

Không dùng cascade delete tùy tiện.

Nếu account bị disable, authentication middleware vẫn từ chối session dựa trên `USER.is_active`.

Hành vi xóa account và các session liên quan nằm ngoài scope Authentication hiện tại.

---

## Existing user data

V1 không yêu cầu hỗ trợ user data cũ.

Nếu phát hiện dữ liệu user đã tồn tại cần migration hoặc compatibility:

1. Dừng phần xử lý liên quan.
2. Báo developer.
3. Phân tích riêng migration/compatibility impact.

Không tự ý migrate hoặc transform dữ liệu.

---

# 11. Kế hoạch triển khai API

## Register

`POST /api/auth/register`

### Access

Guest.

### Request nghiệp vụ

```json
{
  "display_name": "Minh Hau",
  "email": "hau@example.com",
  "password": "password"
}
```

`confirm_password` chỉ được kiểm tra ở frontend và không gửi như field nghiệp vụ tới backend.

### Controller responsibility

- Nhận request.
- Gọi Auth Service.
- Nhận service result.
- Mapping result thành HTTP response.

### Service responsibility

- Validate input.
- Normalize email.
- Kiểm tra email unique.
- Hash password với metadata cần thiết để verify về sau.
- Tạo account:
  - `role = USER`.
  - `is_active = true`.
  - `daily_xp_goal = 50`.

- Không tạo session.
- Không auto-login.
- Không set HTTP cookie.

### Repository responsibility

- Query email normalized.
- Insert user.
- Bảo vệ unique constraint ở database.

### Success

Giữ response body theo API contract hiện tại:

```json
{
  "success": true,
  "message": "Registration successful"
}
```

Success status recommendation:

```text
201 Created
```

API_SPEC.md hiện không quy định success status cụ thể cho endpoint này; đây là technical recommendation của PLAN.

Response body hiện tại không được tự ý thay đổi.

### Errors

- `400 Bad Request`: validation.
- `409 Conflict`: duplicate email.
- `500`: database/unexpected failure.

---

## Login

`POST /api/auth/login`

### Access

Guest.

### Request

```json
{
  "email": "hau@example.com",
  "password": "password"
}
```

### Controller responsibility

- Nhận credentials.
- Gọi Auth Service.
- Nhận authentication result ở mức nội bộ.
- Set cookie `session_id` với raw session token từ result ở mức nội bộ.
- Trả user identity được phép.
- Không đưa raw session token vào response body.

### Service responsibility

- Normalize email.
- Tìm user.
- Kiểm tra `is_active`.
- Verify password.
- Tạo session.
- Lưu session thông qua Session Repository.
- Trả authentication result cho Controller ở mức nội bộ.
- Không set cookie.
- Không trả raw session token cho frontend.

### Success

API response chỉ trả user identity được phép, tối thiểu:

- `id`.
- `display_name`.
- `email`.
- `role`.

Raw session token không xuất hiện trong JSON response.

Frontend không nhận hoặc lưu raw session identifier.

Success status recommendation:

```text
200 OK
```

### Errors

- `401 Unauthorized` cho email không tồn tại, password sai hoặc account inactive.
- `400 Bad Request` cho request không hợp lệ.

Response body và status phải nhất quán để giảm account enumeration.

---

## Logout

`POST /api/auth/logout`

### Access

Endpoint phục vụ authenticated clients nhưng không yêu cầu authentication middleware theo kiểu hard 401.

Request có thể:

- Thiếu cookie.
- Có cookie malformed.
- Có cookie expired.
- Có session đã bị xóa.

Tất cả được xử lý idempotently.

### Controller responsibility

- Nhận request.
- Đọc cookie nếu có.
- Chuyển credential ở mức nội bộ cho Auth Service.
- Clear HTTP-only cookie.
- Trả `204 No Content`.
- Không đưa raw session identifier vào response body.

### Service responsibility

Nếu credential/session hợp lệ:

- Xác định session hiện tại.
- Xóa session thông qua Session Repository.

Nếu credential:

- Thiếu.
- Malformed.
- Expired.
- Đã bị xóa.

Thì:

- Trả kết quả idempotent.
- Không tạo lỗi authentication.

Auth Service không clear cookie.

### Success

Success status:

```text
204 No Content
```

Response không chứa session state hoặc raw session identifier.

Logout lặp lại hoặc credential đã expired không tạo lỗi authentication.

Controller vẫn clear cookie và trả `204 No Content`.

Client được đưa về trạng thái Guest.

---

## Current User

`GET /api/auth/me`

### Access

Authenticated USER hoặc ADMIN.

### Middleware responsibility

- Xác thực session.
- Load user.
- Kiểm tra active status.
- Gắn identity vào request context.

### Controller responsibility

Trả identity từ request context.

Không trả:

- Password.
- Password hash.
- Session data.
- Raw session identifier.

### Success

```json
{
  "success": true,
  "data": {
    "id": 1,
    "display_name": "Minh Hau",
    "email": "hau@example.com",
    "role": "USER"
  }
}
```

Success status:

```text
200 OK
```

### Errors

- `401 Unauthorized` nếu credential thiếu, malformed, expired hoặc không còn session.
- `500` nếu backend/database failure.

---

## API status recommendations và contract note

PLAN recommendation:

| Endpoint                  | Success status |
| ------------------------- | -------------: |
| `POST /api/auth/register` |    201 Created |
| `POST /api/auth/login`    |         200 OK |
| `POST /api/auth/logout`   | 204 No Content |
| `GET /api/auth/me`        |         200 OK |

`API_SPEC.md` hiện không quy định success status cụ thể cho các Authentication endpoint này.

Vì vậy đây là technical recommendations của PLAN, không phải thay đổi API contract.

Endpoint names và response body contract hiện có vẫn được giữ nguyên.

Nếu phát hiện `API_SPEC.md` sau này có status contract khác, phải ghi nhận conflict và không tự sửa `API_SPEC.md`.

---

# 12. Thiết kế Frontend

## Pages

Hiện chưa có page structure thực tế.

Dự kiến bổ sung:

- Login Page.
- Register Page.

Các page giao tiếp với backend thông qua `authService`, không gọi API trực tiếp trong UI nếu có thể tách service.

---

## Components

Có thể tái sử dụng hoặc bổ sung:

- Input.
- Password input.
- Button.
- Alert/error message.
- Loading state.
- Form validation message.
- Password visibility toggle.

Không tạo abstraction lớn khi component chỉ được dùng một lần và không tăng khả năng maintain.

---

## State / Hooks

Authentication state dùng chung:

- `user`.
- `isAuthenticated`.
- `isLoading`.
- `authError`.

State được khởi tạo bằng `GET /api/auth/me` khi app bắt đầu.

Không lưu raw credential trong React state.

---

## API Services

`authService` chịu trách nhiệm:

- `register`.
- `login`.
- `logout`.
- `getCurrentUser`.

Request phải gửi credential cookie phù hợp với cookie-based authentication.

Service không chứa business logic như:

- Tự xác định role authoritative.
- Tự xác định ownership.
- Tự xác định account active.
- Tự tính XP hoặc level.

---

## Protected navigation

Protected navigation cần:

- Chờ auth initialization hoàn tất.
- Hiển thị loading trong thời gian gọi `GET /api/auth/me`.
- Redirect Guest khỏi protected screen.
- Hiển thị Admin navigation dựa trên identity đã được backend xác thực.
- Không dùng việc ẩn UI thay cho backend authorization.

### Redirect behavior

- Registration thành công → Login.
- Login thành công → Dashboard.
- Logout thành công → Guest/Landing hoặc Login theo UI flow được duyệt.
- Guest truy cập protected route → Login.
- USER truy cập Admin UI → không hiển thị Admin navigation; backend vẫn là security boundary.

### UI states

Login/Register:

- Initial.
- Loading.
- Validation error.
- API error.
- Success.
- Disabled submit khi đang gửi request.
- Password show/hide.
- Duplicate email.
- Invalid credentials.

Application auth state:

- Auth initialization loading.
- Authenticated.
- Guest.
- Session expired.
- Logout success.
- Logout failure.

---

# 13. Chiến lược Testing

Chỉ lập kế hoạch test trong giai đoạn PLAN.

## Backend unit tests

### Auth Service

- Normalize email trước lookup/insert.
- Registration validation.
- Password minimum length.
- Duplicate email.
- Password hash chứa metadata cần thiết.
- Password verification.
- New account defaults.
- Inactive account rejection.
- Generic invalid-credential behavior.
- Session token được tạo bằng cryptographically secure random generator với đúng 32 random bytes.
- Chỉ SHA-256 hash của session token được lưu trong AUTH_SESSION.
- Raw session token không được log, lưu database hoặc lưu frontend.
- Session creation.
- Session expiration.
- Session deletion khi Logout.
- Logout idempotency.

### Authorization

- USER được phép truy cập user endpoint.
- USER bị từ chối Admin endpoint.
- ADMIN được phép truy cập Admin endpoint.
- Ownership lấy từ authenticated identity.
- Client không thể giả mạo `owner_id`, `user_id` hoặc `role`.

---

## Backend API/integration tests

- Register success.
- Duplicate email.
- Backend normalize email trước lookup/insert.
- Email viết hoa/lowercase được xử lý nhất quán.
- Password dưới 8 ký tự.
- Không auto-login sau registration.
- Login success.
- Email không tồn tại và password sai có response public nhất quán.
- Inactive account có response public nhất quán.
- Controller set cookie sau Login.
- JSON response không chứa raw session identifier.
- `GET /api/auth/me` với credential hợp lệ.
- `GET /api/auth/me` thiếu credential.
- Credential malformed.
- Credential expired.
- `POST /api/auth/logout`.
- Controller clear cookie sau Logout.
- Logout lặp lại.
- Logout không có cookie vẫn trả `204 No Content`.
- Logout với cookie malformed vẫn trả `204 No Content`.
- Logout với session expired vẫn trả `204 No Content`.
- Logout với session đã bị xóa vẫn trả `204 No Content`.
- Credential không còn dùng được sau Logout.
- Không trả password/hash/raw session credential.
- Error response không tiết lộ account enumeration.
- CORS không cho phép wildcard origin khi credentialed requests.
- CSRF behavior theo deployment configuration và protection được approve.

---

## Frontend tests

- Register form validation.
- `confirm_password` mismatch.
- Frontend có thể normalize email cho UX.
- Frontend validation không thay thế backend validation.
- Password visibility toggle.
- Register success redirect tới Login.
- Login validation.
- Login success redirect tới Dashboard.
- Login error state.
- Auth initialization.
- Protected navigation.
- Guest redirect.
- Logout state cleanup.
- Admin navigation visibility.
- Frontend không nhận hoặc lưu raw session identifier.

---

## Regression tests

Kiểm tra không ảnh hưởng:

- Public Landing Page.
- Public Vocabulary Set access.
- Các API Guest được phép truy cập.
- Admin route protection.
- Frontend build/lint.
- API error handling dùng chung.

---

## Test infrastructure

Hiện repository chưa thể hiện testing framework hoặc test files liên quan Authentication.

Nếu chưa có testing infrastructure, implementation preparation cần lựa chọn framework tối thiểu phù hợp với Node/React hiện tại.

Đây là dependency impact kỹ thuật, không phải product scope decision.

Không tự ý mở rộng thành testing infrastructure phức tạp.

---

# 14. Dependencies

## Đã có

### Backend

- Express.

### Frontend

- React.
- React DOM.
- Vite.
- Tailwind-related packages.

---

## Có thể cần

### Prisma

Mục đích:

- Data access theo `ARCHITECTURE.md`.

Prisma là dependency nền tảng cần được materialize trong backend nếu application layer chưa có data access implementation.

### Cookie handling

Mục đích:

- Parse và set cookie an toàn.

`cookie-parser` là dependency đã được developer approve cho TASK-006 để parse HTTP Cookie. Không chốt version package ở giai đoạn PLAN. Việc thêm dependency sẽ thực hiện trong IMPLEMENT TASK-006, không thực hiện trong PLAN.

Cookie parser chỉ chịu trách nhiệm parse Cookie header. Nó không thay thế `AUTH_SESSION`, không lưu session và không thay đổi stateful server-side session architecture.

Đây là technical implementation detail.

### React Router

Mục đích:

- Protected navigation.
- Redirect.

Phù hợp nếu frontend chuyển sang route-based navigation.

Nếu không thêm router, cần một cơ chế navigation tương đương nhưng không được tạo routing abstraction phức tạp.

### Password hashing

Đề xuất:

- `node:crypto` + `scrypt`.

Không cần dependency hashing riêng nếu technical validation xác nhận phù hợp.

### CSRF protection

Chưa chốt library cụ thể.

Chỉ bổ sung CSRF protection phù hợp nếu deployment thực tế yêu cầu cross-site credentialed requests.

### Testing

Hiện chưa thấy test framework.

Cần chọn framework phù hợp với Node/React hiện tại trong implementation preparation.

Không tự ý mở rộng scope hoặc thêm testing infrastructure phức tạp.

---

## Không cần

- AI service.
- External authentication provider.
- OAuth.
- Redis.
- Microservice.
- Session/device history service.
- JWT library.
- Refresh-token library.
- Session history.
- Device history.
- IP tracking.
- User-agent tracking.
- Background worker phức tạp.

---

# 15. Thứ tự Implementation

Không tạo TASK ID ở giai đoạn PLAN.

Thứ tự implementation ở mức technical dependency:

1. Xác minh deployment topology thực tế.
2. Xác định CORS và cookie policy dựa trên topology.
3. Xác định CSRF requirement nếu topology là cross-site credentialed.
4. Thiết lập backend configuration và environment contract.
5. Thiết lập Prisma/database access theo architecture đã phê duyệt.
6. Materialize `USER` theo `DATABASE.md`.
7. Materialize `AUTH_SESSION` theo `DATABASE.md`.
8. Thiết lập relationship và constraints.
9. Tạo migration trong IMPLEMENT stage sau khi TASK tương ứng được approve.
10. Thiết lập password security utility bằng `node:crypto`.
11. Thiết lập User Repository.
12. Thiết lập Session Repository.
13. Thiết lập Auth Service.
14. Thiết lập centralized validation và error mapping.
15. Thiết lập authentication middleware.
16. Thiết lập authorization middleware.
17. Thiết lập Auth Controller.
18. Thiết lập Authentication routes.
19. Thiết lập backend API tests.
20. Thiết lập frontend route/navigation foundation nếu cần.
21. Thiết lập `authService`.
22. Thiết lập authentication state/context.
23. Thiết lập Register Page.
24. Thiết lập Login Page.
25. Thiết lập protected navigation.
26. Thiết lập Logout flow.
27. Tích hợp frontend/backend.
28. Chạy test, build và security verification ở TEST stage.
29. Cập nhật documentation/status ở workflow stage phù hợp sau khi implementation được verify.

Các bước trên là implementation dependency order, không thay thế TASK.

Không bắt đầu IMPLEMENT cho đến khi TASK tương ứng được developer approve.

---

# 16. Risks và Edge Cases

- Stateful session cần `AUTH_SESSION`, dẫn tới schema impact.
- Nếu không có session persistence, Logout không thể invalidate credential bị sao chép ngay lập tức.
- `API_SPEC.md` cũ còn chứa `username`; approved SPEC đã chốt `display_name`.
- `API_SPEC.md` chưa mô tả mechanism cụ thể.
- `ARCHITECTURE.md` chưa cố định JWT hoặc HTTP-only Cookie Session.
- `DATABASE.md` có thể có reference cũ liên quan JWT; không được xem đó là quyết định dùng JWT nếu database design hiện tại đã xác định `AUTH_SESSION`.
- Không được trả error khác biệt làm lộ email tồn tại, password sai hoặc account inactive.
- Timing side-channel không cần tối ưu hóa quá mức ngoài scope đồ án, nhưng response branch công khai phải nhất quán.
- Cookie attributes phải phù hợp với deployment topology và CORS.
- Cross-origin không đồng nghĩa với cross-site; cần kiểm tra deployment thực tế.
- HttpOnly không thay thế CSRF protection.
- Credentialed CORS không được dùng wildcard origin.
- Nếu cần cross-site credentialed requests, phải có CSRF protection phù hợp trước IMPLEMENT.
- Cookie cleanup và session cleanup không được biến thành background infrastructure phức tạp.
- Account role có thể bị thay đổi; middleware phải đọc role hiện tại thay vì tin role cũ.
- Database design đã có USER và AUTH_SESSION, nhưng Prisma schema hiện chưa materialize các entity này.
- Không được nhầm database design với implementation state.
- Nếu Prisma schema không khớp với `DATABASE.md`, AI Agent phải dừng và báo developer.
- Database configuration có thể là dependency nền tảng lớn hơn Authentication.
- SPEC metadata trong repository có thể vẫn hiển thị `DRAFT` dù workflow đã xác nhận SPEC `APPROVED`; không tự sửa SPEC trong PLAN này.
- Không có testing infrastructure hiện tại; không được giả định test có thể chạy ngay.
- Không hỗ trợ user data cũ trong v1.
- Nếu phát hiện cần migration hoặc compatibility cho user data cũ, phải dừng và báo developer.

---

# 17. Approved Technical Decisions và Implementation-time Verification

PLAN đã được developer approve với các technical decisions sau.

## Approved Technical Decisions

### 1. Authentication mechanism

Sử dụng:

**Stateful server-side session authentication được transport bằng HTTP-only cookie.**

JWT chỉ được giữ ở phần phân tích so sánh và không thuộc implementation scope.

### 2. Session persistence

Sử dụng `AUTH_SESSION` theo database design hiện tại trong `DATABASE.md`.

### 3. Session identifier mechanism

- Session token: 32 random bytes (256-bit).
- Cryptographically secure random generator.
- Cookie name duy nhất: `session_id`.
- Database lưu SHA-256 hash của token.
- Không lưu raw token.

### 4. Session lifetime

- Session lifetime: 7 ngày.
- Không remember-device.
- Không refresh-token.
- Không idle timeout trong v1.

### 5. Logout invalidation

Logout xóa session record hiện tại.

Không thêm `revoked_at`.

### 6. Database implementation boundary

Implementation được phép materialize:

- `USER`.
- `AUTH_SESSION`.

Cả hai phải tuân thủ `docs/DATABASE.md`.

Không redesign database.

TASK-001 sẽ chịu trách nhiệm database foundation cho cả `USER` và `AUTH_SESSION`.

---

## Implementation-time Verification

Các nội dung sau cần được kiểm chứng trong quá trình chuẩn bị IMPLEMENT, không phải product scope decisions mới:

### Cookie/deployment policy

Phải xác minh:

- Frontend origin.
- Backend origin.
- Same-origin/cross-origin.
- Same-site/cross-site.
- Credentialed CORS.
- Cookie Domain.
- Cookie Path.
- SameSite.
- Secure.
- HttpOnly.

Không hard-code policy trước khi topology được kiểm chứng.

### CSRF

Nếu deployment thực tế yêu cầu cross-site credentialed requests, phải bổ sung CSRF protection phù hợp trước IMPLEMENT.

PLAN không chốt library CSRF cụ thể.

### Password hashing parameters

Sử dụng `node:crypto` + `scrypt`.

Cost parameters phải được technical validation trước IMPLEMENT dựa trên security requirement và deployment environment.

### Dependencies

Các lựa chọn như:

- Cookie handling package.
- React Router.
- Testing framework.

Là technical implementation details và có thể được xác định trong TASK/IMPLEMENT preparation.

---

# 18. Traceability: SPEC → PLAN

| SPEC requirement                                         | PLAN mapping                                     |
| -------------------------------------------------------- | ------------------------------------------------ |
| BR-01, BR-02: Hai role và Guest không phải role          | Mục 8, Mục 9                                     |
| BR-03, BR-04: display_name, confirm_password client-side | Mục 11 Register, Mục 12 Frontend                 |
| BR-05, BR-06: Email unique và lowercase                  | Mục 7, Mục 8, Mục 11 Register, Mục 13 Testing    |
| BR-07, BR-08, BR-09: Password security                   | Mục 7                                            |
| BR-10, BR-11, BR-12: Account defaults                    | Mục 11 Register                                  |
| BR-13, BR-14: Inactive account và chống enumeration      | Mục 6, Mục 8, Mục 11 Login                       |
| BR-15: Không auto-login                                  | Mục 11 Register, Mục 12 Frontend                 |
| BR-16: Logout trong scope                                | Mục 6, Mục 11 Logout, Mục 12 Frontend            |
| BR-17, BR-18: Mechanism và credential lifetime           | Mục 5, Mục 6, Mục 17                             |
| BR-19, BR-20: Backend authentication/authorization       | Mục 8, Mục 9                                     |
| BR-21, BR-22: Role protection                            | Mục 8, Mục 9                                     |
| BR-23: Ownership từ authenticated identity               | Mục 9                                            |
| AC-01 đến AC-09: Registration                            | Mục 11 Register, Mục 13 Testing                  |
| AC-10 đến AC-15: Login và Current User                   | Mục 6, Mục 11 Login/Current User, Mục 13 Testing |
| AC-16: Logout invalidation                               | Mục 5, Mục 6, Mục 11 Logout                      |
| AC-17 đến AC-20: Protected/Admin authorization           | Mục 8, Mục 9, Mục 13 Testing                     |
| AC-21, AC-22: Frontend state và security boundary        | Mục 12                                           |
| AC-23: Test coverage                                     | Mục 13                                           |

---

# 19. Tóm tắt PLAN

## Sẽ implement

- Registration bằng `display_name`, `email` và `password`.
- Email lowercase normalization ở backend.
- Frontend có thể normalize email cho UX nhưng không phải security boundary.
- Password hashing bằng `node:crypto/scrypt`.
- Metadata cần thiết trong `password_hash` để verify password về sau.
- Login và current-user identification.
- Stateful server-side session authentication được transport bằng HTTP-only cookie.
- Session persistence trong `AUTH_SESSION`.
- Relationship `USER 1 ─── N AUTH_SESSION`.
- Auth Service tạo và xóa session.
- Controller/HTTP layer set và clear cookie.
- Logout bằng cách xóa session record và cookie.
- Authentication middleware.
- Role-based authorization middleware.
- Ownership check dựa trên authenticated identity.
- Backend error handling và account enumeration protection.
- CSRF analysis và deployment-dependent protection nếu cần.
- Frontend Login/Register.
- Frontend authentication state.
- Protected navigation.
- Admin navigation visibility.
- Logout state cleanup.
- Backend và frontend tests theo testing plan.

## Không implement

- Password reset/recovery.
- Email verification.
- Social login.
- MFA.
- Premium/subscription.
- Session history.
- Device history.
- Account deletion.
- Role mới.
- Admin user management.
- User data migration/compatibility trong v1.
- AI hoặc external authentication service.
- JWT.
- Refresh-token flow.
- `revoked_at`.
- `last_used_at`.
- IP tracking.
- User-agent tracking.
- Logout all devices.
- Redis.
- Microservice.
- Background worker phức tạp.

---

## Technical decisions

- Dùng `node:crypto` + `scrypt` cho password hashing.
- `password_hash` lưu kèm thuật toán, parameters, salt và derived key/hash.
- Dùng stateful server-side session authentication được transport bằng HTTP-only cookie.
- Session token được tạo bằng cryptographically secure random generator với 32 random bytes (256-bit).
- Cookie name duy nhất là `session_id`.
- `AUTH_SESSION.session_identifier_hash` lưu SHA-256 hash của session token.
- `AUTH_SESSION` gồm `id`, `user_id`, `session_identifier_hash`, `created_at`, `expires_at`.
- Relationship là `USER 1 ─── N AUTH_SESSION`.
- Xóa session hiện tại khi Logout thay vì thêm `revoked_at`.
- Session lifetime là 7 ngày.
- Không remember-device, refresh-token hoặc idle timeout trong v1.
- Cookie attributes được xác định theo deployment topology và CORS configuration thực tế.
- Không chốt cứng SameSite, Domain hoặc Path trước khi topology được kiểm chứng.
- CSRF phải được xem xét; nếu cần cross-site credentialed requests thì phải có protection phù hợp trước IMPLEMENT.
- Validation errors dùng `400 Bad Request`.
- `USER` và `AUTH_SESSION` được materialize từ database design đã được định nghĩa trong `DATABASE.md`.
- PLAN không thay đổi database design.

---

# Workflow Status

**PLAN đã được developer approve.**

Đã hoàn thành:

- Authentication SPEC.
- Authentication PLAN.
- Phân tích authentication mechanism.
- Chọn stateful server-side session authentication.
- Xác định `AUTH_SESSION` persistence theo database design hiện tại.
- Xác định session identifier mechanism.
- Xác định session lifetime 7 ngày.
- Đồng bộ PLAN với `DATABASE.md`.
- Xác định implementation boundary cho `USER` và `AUTH_SESSION`.

Chưa thực hiện:

- Implement code.
- Tạo migration.
- Cài dependency cho Authentication ngoài baseline cần thiết.
- Cập nhật `FEATURE_STATUS` sang trạng thái implementation.
- Review implementation.

## Next workflow stage

1. Cập nhật `AUTHENTICATION_TASK.md`.
2. Điều chỉnh `TASK-001` để chịu trách nhiệm materialize cả `USER` và `AUTH_SESSION`.
3. Developer approve `TASK-001`.
4. Chuyển sang IMPLEMENT theo workflow trong `AGENTS.md`.

**Không bắt đầu IMPLEMENT chỉ dựa trên PLAN. TASK tương ứng phải được approve trước.**
