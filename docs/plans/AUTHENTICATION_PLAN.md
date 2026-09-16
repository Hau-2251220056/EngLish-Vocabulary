# PLAN: Authentication

**Giai đoạn workflow:** PLAN  
**Trạng thái:** Technical proposal, chờ developer review/approval  
**SPEC status:** Đã được developer approve theo workflow hiện tại

## 1. Mục tiêu PLAN

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

PLAN này là technical proposal. Chưa implement code, chưa tạo migration, chưa cài dependency và chưa tạo TASK.

## 2. Phạm vi SPEC đã được phê duyệt

### In Scope

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

### Out of Scope

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

## 3. Phân tích implementation hiện tại

### Backend

Hiện chỉ có:

- `backend/src/main.js`
  - Khởi tạo Express.
  - Khai báo route `/`.
  - Chưa có API `/api`.
  - Chưa có middleware, controller, service, repository hoặc database connection.

`backend/package.json` hiện chỉ có:

- `express`
- `nodemon`

Chưa có:

- Prisma setup.
- User repository.
- Session repository.
- Password hashing.
- Cookie/session handling.
- Validation library.
- Test infrastructure.
- Authentication middleware.

### Frontend

Hiện chỉ có:

- `frontend/src/App.jsx`
  - Render nội dung tối thiểu.
- `frontend/src/main.jsx`
  - Khởi tạo React application.
- `frontend/package.json`
  - Có React, Vite và Tailwind.
  - Chưa có routing library.

Chưa có:

- Login Page.
- Register Page.
- Auth API service.
- Auth state/context.
- Protected route/navigation.
- Logout flow.
- Admin navigation visibility.

### Feature status

Authentication và các feature User Management trong `docs/FEATURE_STATUS.md` đều đang `TODO`.

Feature chưa có implementation cần reuse. PLAN sẽ xây dựng các layer cần thiết theo kiến trúc hiện có.

## 4. Tác động kiến trúc

### Backend

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

Phân tách trách nhiệm cookie:

- Auth Service không set hoặc clear HTTP cookie.
- Auth Service verify credentials, create/delete session và trả authentication result ở mức nội bộ.
- Controller/HTTP layer nhận result từ Auth Service, set hoặc clear HTTP-only cookie và mapping response.
- Raw session identifier không được đưa vào response body.

### Frontend

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

### Database

Tái sử dụng entity `USER` hiện có trong `DATABASE.md`.

Phương án đề xuất cần thêm session persistence bằng entity `AUTH_SESSION`. Đây là database impact mới và cần developer approval trước TASK/IMPLEMENT.

Relationship dự kiến:

```text
USER 1 ─── N AUTH_SESSION
```

### API

Tái sử dụng các endpoint:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

Không tạo duplicate endpoint.

### Security

Backend là security boundary duy nhất.

Frontend chỉ điều khiển UI/navigation, không được dùng để enforce security.

Cookie-based authentication phải được xem xét CSRF. `HttpOnly` chỉ ngăn JavaScript đọc cookie, không tự chống CSRF.

## 5. Phân tích Authentication Mechanism

### Phương án A: JWT

#### Cách hoạt động

- Sau Login, backend tạo JWT.
- Credential được transport qua `HttpOnly` cookie.
- Backend verify JWT ở mỗi protected request.
- Backend vẫn load user hiện tại để kiểm tra `is_active` và role mới nhất.

#### Ưu điểm

- Không cần session table nếu không yêu cầu server-side revocation.
- Phù hợp với REST API.
- Dễ mở rộng khi có nhiều backend instance.
- Có thể tránh lưu token trong `localStorage`.

#### Nhược điểm

- Logout không thể thu hồi token đã bị sao chép nếu không có revocation mechanism.
- Refresh token làm tăng complexity.
- Token bị replay có thể tiếp tục hợp lệ đến khi hết hạn.
- Revocation bằng denylist hoặc token version sẽ phát sinh persistence/schema impact.

#### Logout

- Xóa cookie phía client.
- Nếu không có server-side revocation, credential bị sao chép vẫn có thể dùng tới khi hết hạn.
- Có rủi ro không đáp ứng đầy đủ yêu cầu invalidation sau Logout.

### Phương án B: Stateful server-side session authentication được transport bằng HTTP-only cookie

#### Cách hoạt động

- Sau Login, backend tạo session token bằng cryptographically secure random generator với độ dài 32 random bytes (256-bit).
- Backend lưu SHA-256 hash của session token trong `AUTH_SESSION`.
- Raw session token chỉ tồn tại trong quá trình tạo session và xử lý cookie.
- Controller/HTTP layer set raw session token vào cookie `session_id` với thuộc tính HTTP-only.
- Backend đọc raw token từ cookie `session_id`, hash token bằng SHA-256 và tìm session tương ứng.
- Backend kiểm tra:
  - Session tồn tại.
  - Session chưa hết hạn.
  - User tồn tại.
  - User đang active.
  - Role hiện tại của user.

#### Ưu điểm

- Logout có thể invalidate session ngay lập tức.
- Không đưa password hoặc business data vào cookie.
- Dễ xử lý account inactive, expiration và revocation.
- Credential không thể được đọc bởi JavaScript khi dùng `HttpOnly`.
- Phù hợp với deployment nhiều instance nếu sử dụng shared PostgreSQL/Supabase.

#### Nhược điểm

- Cần persistence cho session.
- Cần thêm `AUTH_SESSION` model/table.
- Mỗi protected request cần kiểm tra session persistence.
- Cần xử lý cleanup session hết hạn.

#### Logout

- Auth Service xóa session hiện tại.
- Controller/HTTP layer clear cookie.
- Credential cũ không còn sử dụng được sau Logout.
- Không triển khai Logout all devices trong v1.

### So sánh

| Tiêu chí                       | JWT                        | Stateful server-side session |
| ------------------------------ | -------------------------- | ---------------------------- |
| Complexity ban đầu             | Trung bình                 | Trung bình                   |
| Logout tức thời                | Cần revocation bổ sung     | Có                           |
| Database impact                | Thấp nếu không revoke      | Cần `AUTH_SESSION`           |
| Credential exposure ở frontend | Có thể tránh bằng cookie   | Có thể tránh bằng cookie     |
| Credential expiration          | JWT `exp`                  | `expires_at`                 |
| Account inactive               | Kiểm tra mỗi request       | Kiểm tra mỗi request         |
| Revocation                     | Phức tạp hơn               | Trực tiếp                    |
| Deployment nhiều instance      | Tốt                        | Tốt với shared database      |
| Phù hợp AC-16                  | Có rủi ro nếu không revoke | Phù hợp                      |
| Phù hợp scope đồ án            | Ít database hơn            | Rõ ràng hơn về security      |

### Phương án đề xuất

Đề xuất **stateful server-side session authentication được transport bằng HTTP-only cookie**, với session persistence trong PostgreSQL/Supabase.

Lý do:

1. Đáp ứng tốt hơn yêu cầu Logout và credential invalidation.
2. Không expose credential cho JavaScript.
3. Cho phép vô hiệu hóa credential ngay lập tức.
4. Dễ kiểm tra `is_active` và role hiện tại.
5. Phù hợp với Node/Express + PostgreSQL/Supabase.
6. Tránh replay window của JWT sau Logout.
7. Phù hợp với phạm vi đồ án nếu thiết kế session tối giản.

## 6. Credential Lifecycle

### Credential creation

Sau Login thành công:

1. Auth Service normalize email.
2. Auth Service tìm user theo email.
3. Auth Service kiểm tra `is_active`.
4. Auth Service verify password hash.
5. Auth Service tạo session token bằng cryptographically secure random generator với độ dài 32 random bytes (256-bit).
6. Auth Service tạo SHA-256 hash của session token.
7. Session Repository lưu session record với hash, không lưu raw token.
8. Auth Service trả authentication result cho Controller ở mức nội bộ.
9. Controller/HTTP layer set raw session token trong cookie `session_id` với thuộc tính HTTP-only.
10. Controller trả user identity được phép.

Raw session token chỉ tồn tại trong quá trình tạo và xử lý cookie, không được lưu database, không được log và không xuất hiện trong response body.

### Credential transport

Credential được transport bằng cookie `session_id`.

Cookie attributes gồm:

- `HttpOnly`.
- `Secure`.
- `SameSite`.
- `Domain`.
- `Path`.

Quy tắc thiết kế:

- `HttpOnly` là bắt buộc để JavaScript không đọc được credential.
- `Secure` được bật trong production/HTTPS.
- `SameSite` và `Path` được xác định dựa trên deployment topology thực tế và CORS configuration.
- `Domain` chỉ được cấu hình nếu deployment topology thực sự yêu cầu; không đặt Domain rộng hơn cần thiết.
- Không tự ý chốt một giá trị `SameSite` chỉ vì frontend và backend khác origin.
- `cross-origin` và `cross-site` là hai khái niệm khác nhau; cấu hình cookie phải dựa trên topology thực tế.
- Không dùng `localStorage` hoặc `sessionStorage` để lưu raw credential.

Cookie name duy nhất của Authentication là `session_id`. Không sử dụng tên cookie khác.

### CSRF consideration

- `HttpOnly` không phải biện pháp chống CSRF.
- Cookie-based authentication phải được xem xét CSRF trước IMPLEMENT.
- Cookie `SameSite` phải phù hợp với deployment topology thực tế.
- Backend CORS không được dùng wildcard origin khi xử lý credentialed requests.
- Backend chỉ cho phép các frontend origin được cấu hình.
- Nếu deployment topology cuối cùng sử dụng frontend/backend khác site và credentialed cookie requests, CSRF protection là bắt buộc trước IMPLEMENT.
- Nếu deployment thực tế yêu cầu cross-site credentialed requests, phải bổ sung CSRF protection phù hợp trước IMPLEMENT.
- CORS credential configuration phải chặt chẽ và chỉ cho phép các frontend origin được cấu hình.
- PLAN không tự chọn một CSRF library cụ thể.

### Pre-implementation Deployment Topology Verification

Trước IMPLEMENT phải kiểm tra deployment topology thực tế, không để implementation tự suy đoán cookie, CORS hoặc CSRF configuration:

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
- `SameSite`.
- `Secure`.
- `HttpOnly`.
- CSRF requirement.
- Frontend HTTP client có cần gửi credentials hay không.

Không hard-code Domain hoặc SameSite policy khi topology thực tế chưa được verification.

`HttpOnly` bảo vệ cookie khỏi JavaScript access nhưng không tự nó là CSRF protection. SameSite, CORS và CSRF phải được quyết định dựa trên deployment topology thực tế.

### Credential storage phía frontend

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

### Credential verification

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

### Credential lifetime

Technical recommendation của PLAN:

- Session lifetime: **7 ngày**.
- Không remember-device.
- Không refresh-token.
- Không idle timeout trong v1.
- Session hết hiệu lực khi `expires_at` đã qua.

**7 ngày là technical recommendation của PLAN và vẫn cần developer approval trước IMPLEMENT.**

### Credential renewal

Không triển khai refresh-token rotation hoặc remember-device trong v1.

Không triển khai idle timeout trong v1.

Nếu cần gia hạn session khi user đang hoạt động, phải xử lý như một thay đổi kỹ thuật riêng và không được mở rộng scope ngoài SPEC.

### Logout

`POST /api/auth/logout`:

1. Route Logout không phụ thuộc vào authentication middleware theo kiểu hard `401 Unauthorized`.
2. Controller/HTTP layer đọc cookie nếu có và chuyển credential ở mức nội bộ cho Auth Service.
3. Nếu cookie/session hợp lệ, Auth Service xóa session hiện tại thông qua Session Repository.
4. Nếu cookie thiếu, malformed, expired hoặc session đã bị xóa, Auth Service trả kết quả idempotent và không tạo lỗi authentication.
5. Auth Service không set hoặc clear HTTP cookie.
6. Controller/HTTP layer clear HTTP-only cookie trong mọi trường hợp.
7. Controller trả success response cho client.
8. Frontend reset authentication state.
9. User trở về trạng thái Guest.

Logout lặp lại phải được xử lý idempotently:

- Không tạo lỗi hệ thống.
- Cookie vẫn được clear.
- Client trở về trạng thái Guest.
- Cookie/session thiếu, malformed, expired hoặc đã bị xóa vẫn trả success.

Logout chỉ xóa session hiện tại được xác định từ credential cookie.

Không triển khai Logout all devices.

## 7. Password Security

### Thuật toán đề xuất

Sử dụng `node:crypto` với `scrypt` bất đồng bộ.

Lý do:

- Có sẵn trong Node.js.
- Không cần dependency hashing riêng.
- Phù hợp cho password hashing nếu cấu hình đúng.
- Giảm dependency và complexity.

Không sử dụng hash thông thường như SHA-256 trực tiếp cho password.
Không tự thay bằng bcrypt hoặc argon2 nếu chưa được approve.

Implementation phải dùng `crypto.scrypt` hoặc `crypto.scryptSync`.

Salt phải được tạo bằng cryptographically secure random generator.

### Nội dung của `password_hash`

`password_hash` phải chứa đủ thông tin cần thiết để verify password về sau, tối thiểu gồm:

- Thuật toán hashing.
- Các parameters cần thiết của thuật toán.
- Salt.
- Derived key/hash.

Format lưu trữ cụ thể không được chốt ở PLAN.

Cost parameters của `scrypt` không được tự ý chốt cứng khi chưa có technical validation. Không sử dụng weaker/default parameters chỉ vì tiện. Các parameters phải được xác định và technical-validate trước IMPLEMENT dựa trên:

- Security requirement.
- Backend performance.
- Deployment environment.
- Khả năng chịu tải phù hợp với scope đồ án.

Đây là technical decision cần được xác nhận trước IMPLEMENT; PLAN không tự chốt giá trị parameters cụ thể.

### Hashing flow

Password hashing nằm ở Auth Service hoặc security utility được Auth Service sử dụng.

Repository chỉ nhận `password_hash` đã được tạo để lưu.

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

### Verification flow

Password verification nằm trong Auth Service/security utility:

1. Đọc `password_hash`.
2. Đọc thuật toán, parameters, salt và derived key/hash.
3. Hash password input với cùng metadata.
4. So sánh bằng constant-time comparison.
5. Không trả password ra khỏi service.
6. Không log password hoặc hash.

### Security requirements

- Password tối thiểu 8 ký tự.
- Password phải được hash trước khi lưu.
- Không lưu plaintext password.
- Không trả password hoặc `password_hash`.
- Không log password, password hash, raw session token hoặc secret.
- Salt phải random và unique cho mỗi password.
- Hash parameters phải có khả năng nâng cấp trong tương lai.
- Backend phải validate lại password.
- Client-side validation chỉ phục vụ UX.

Session token phải được tạo bằng cryptographically secure random generator với 32 random bytes (256-bit). Backend chỉ lưu SHA-256 hash của token trong `AUTH_SESSION`; raw token không được log hoặc lưu ở frontend.

## 8. Thiết kế Backend

### Routes

Các route cần được bổ sung:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Route chỉ:

- Khai báo HTTP method và endpoint.
- Gắn middleware.
- Gọi controller.
- Không chứa business logic.

Route Logout là ngoại lệ về authentication middleware: không gắn middleware theo kiểu hard `401`, để có thể clear cookie và trả success khi credential thiếu hoặc không còn hợp lệ.

### Middleware

#### Authentication middleware

Trách nhiệm:

- Đọc cookie `session_id`.
- Xác thực session.
- Kiểm tra expiration.
- Load user.
- Kiểm tra `is_active`.
- Gắn authenticated identity vào request context.
- Trả `401 Unauthorized` nếu credential thiếu hoặc không hợp lệ.

Middleware này áp dụng cho protected endpoints. `POST /api/auth/logout` không dùng flow hard `401` này.

#### Authorization middleware

Trách nhiệm:

- Kiểm tra role yêu cầu.
- Cho phép `USER` hoặc `ADMIN` theo endpoint.
- Trả `403 Forbidden` nếu user authenticated nhưng không đủ quyền.

#### Validation middleware

Trách nhiệm:

- Kiểm tra request shape.
- Kiểm tra required fields.
- Kiểm tra data types.
- Kiểm tra password length.
- Không xử lý persistence hoặc session lifecycle.

#### Error middleware

Trách nhiệm:

- Chuẩn hóa error response.
- Không trả stack trace production.
- Không trả password, hash, raw session identifier hoặc thông tin nội bộ.
- Không tạo response khác biệt rõ ràng làm lộ trạng thái account.

### Controllers

Auth Controller chịu trách nhiệm:

- Nhận request.
- Đọc input.
- Gọi Auth Service.
- Nhận authentication result ở mức nội bộ.
- Set HTTP-only cookie sau Login.
- Clear HTTP-only cookie sau Logout.
- Mapping service result/error thành HTTP response.
- Không truy vấn database trực tiếp.
- Không hash password trực tiếp.
- Không tự xác định role hoặc ownership.
- Không đưa raw session identifier vào response body.

### Services

#### Auth Service

Chịu trách nhiệm:

- Normalize email.
- Validate registration/login input.
- Kiểm tra email uniqueness.
- Hash và verify password.
- Kiểm tra account active.
- Tạo session.
- Kết thúc hoặc xóa session.
- Trả authentication result cho Controller ở mức nội bộ.
- Không set hoặc clear HTTP cookie.
- Không phụ trách HTTP response.
- Không trả raw session identifier cho frontend.

#### Authorization logic

Role authorization có thể đặt trong middleware dùng chung.

Business service của từng domain vẫn phải kiểm tra ownership khi xử lý resource cụ thể.

### Repository / Data Access

#### User Repository

Trách nhiệm:

- Tìm user theo normalized email.
- Tìm user theo user id.
- Tạo user mới.
- Đọc role, `is_active` và các field cần thiết.
- Không nhận `owner_id` từ client để xác định identity.
- Không chứa password policy hoặc authorization business rule.

#### Session Repository

Trách nhiệm:

- Tạo session record.
- Tìm session theo SHA-256 hash của raw token từ cookie `session_id`.
- Kiểm tra expiration.
- Xóa session khi Logout.
- Cleanup session hết hạn khi cần.
- Không lưu raw session token.

### Validation

Backend bắt buộc validate:

Registration:

- `display_name`.
- `email`.
- `password`.
- Không xử lý `confirm_password` như field nghiệp vụ.

Login:

- `email`.
- `password`.

SPEC đã chốt:

- Email lowercase.
- Password tối thiểu 8 ký tự.
- `confirm_password` chỉ client-side.
- `confirm_password` không lưu database.

Các giới hạn chi tiết của `display_name`, trim và email input cần được chốt trong implementation contract nếu chưa được xác định trong SPEC.

### Error Handling

Đề xuất mapping:

| Tình huống                   |                 HTTP status |
| ---------------------------- | --------------------------: |
| Validation failure           |           `400 Bad Request` |
| Duplicate email              |              `409 Conflict` |
| Invalid credentials          |          `401 Unauthorized` |
| Missing credential           |          `401 Unauthorized` |
| Expired/malformed credential |          `401 Unauthorized` |
| Authenticated nhưng sai role |             `403 Forbidden` |
| Resource không tồn tại       |             `404 Not Found` |
| Database failure             | `500 Internal Server Error` |
| Unexpected failure           | `500 Internal Server Error` |

Login phải dùng behavior public nhất quán cho:

- Email không tồn tại.
- Password sai.
- Account inactive.

Không được tạo logic response khác biệt rõ ràng làm lộ trạng thái account.

Timing side-channel không cần tối ưu hóa quá mức ngoài scope đồ án, nhưng implementation không được tạo branch response công khai khác nhau cho các trường hợp trên.

## 9. Thiết kế Authorization

### Authentication-required endpoint

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

### USER access

`USER` được phép truy cập chức năng user-facing khi:

- Credential hợp lệ.
- Account active.
- Endpoint không yêu cầu `ADMIN`.
- Ownership check thành công nếu resource thuộc user.

### ADMIN access

Admin endpoint yêu cầu:

```text
Authenticated
  +
USER.role = ADMIN
  +
Account active
```

Frontend có thể ẩn hoặc hiện Admin navigation, nhưng backend vẫn phải kiểm tra role ở mỗi request.

### Ownership check

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

## 10. Tác động Database

### Existing model

Tái sử dụng `USER` với các field:

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

### Changes

Không thay đổi schema trong bước PLAN đối với `USER`.

Email cần được bảo vệ bằng:

```text
UNIQUE(USER.email)
```

Email phải được normalize trước khi insert hoặc lookup.

### Dự kiến entity `AUTH_SESSION`

Đây là database impact mới, chỉ là thiết kế đề xuất ở mức PLAN và cần developer approval trước TASK/IMPLEMENT.

Entity v1 tối thiểu gồm:

- `id`
- `user_id`
- `session_identifier_hash`
- `created_at`
- `expires_at`

#### `id`

Mục đích:

- Primary key nội bộ cho session record.

Cần thiết:

- Có, để định danh record và tạo quan hệ rõ ràng.

Constraint/index:

- Primary key.

#### `user_id`

Mục đích:

- Liên kết session với account sở hữu session.

Cần thiết:

- Có, để backend xác định user sau khi session được verify.

Constraint/index:

- Foreign key tới `USER.id`.
- Index trên `user_id` nếu cần truy vấn session theo user.
- Không nhận `user_id` từ client.

#### `session_identifier_hash`

Mục đích:

- Lưu SHA-256 hash của raw session token nhận từ cookie `session_id`.
- Cho phép backend tìm session mà không lưu raw session token.

Cần thiết:

- Có, đây là field chính để verify session.

Constraint/index:

- Unique constraint hoặc unique index.
- Index để lookup nhanh.
- Không lưu raw session token.

#### `created_at`

Mục đích:

- Ghi nhận thời điểm session được tạo.
- Hỗ trợ session lifecycle và debugging an toàn.

Cần thiết:

- Có.

Constraint/index:

- Not null.
- Không nhất thiết cần index riêng trong v1.

#### `expires_at`

Mục đích:

- Xác định thời điểm session hết hiệu lực.
- Cho phép backend từ chối credential expired.
- Hỗ trợ cleanup expired session.

Cần thiết:

- Có.

Constraint/index:

- Not null.
- Có thể index để cleanup hiệu quả.

### Relationship

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

### Database documentation synchronization

`AUTH_SESSION` là entity mới được Authentication PLAN sử dụng nhưng chưa có trong `DATABASE.md`.

Sau khi PLAN được APPROVED:

1. Đồng bộ `DATABASE.md` để bổ sung `AUTH_SESSION`.
2. Xác định relationship `USER 1:N AUTH_SESSION` trong database documentation.
3. Sau đó mới lập kế hoạch migration/implementation.

PLAN hiện tại không sửa `DATABASE.md` và không tạo migration.

### Fields không thêm trong v1

#### `revoked_at`

Không thêm trong v1.

Lý do:

- Logout xóa session record ngay.
- Không có requirement về audit hoặc giữ session record sau Logout.
- Session history nằm ngoài scope.

#### `last_used_at`

Không thêm trong v1.

Lý do:

- Không có requirement về idle timeout.
- Cập nhật field trên mỗi request làm tăng write load.

#### IP và user-agent

Không thêm trong v1.

Lý do:

- Không có requirement về IP tracking.
- Không có requirement về user-agent tracking.
- Không triển khai device history hoặc anomaly tracking.

### Cleanup expired session

Đề xuất v1:

- Không tạo background worker hoặc cron job riêng.
- Khi Login, có thể cleanup một batch nhỏ các session đã hết hạn nếu cần.
- Khi authentication lookup, session có `expires_at` đã qua được xem là invalid.
- Khi Logout, xóa session hiện tại.
- Cleanup toàn bộ expired session có thể thực hiện bằng maintenance operation sau này nếu cần.

Không mở rộng thành background infrastructure phức tạp.

### Foreign key và delete behavior

- `AUTH_SESSION.user_id` tham chiếu `USER.id`.
- Không dùng cascade delete tùy tiện.
- Nếu account bị disable, authentication middleware vẫn từ chối session dựa trên `USER.is_active`.
- Hành vi xóa account và các session liên quan nằm ngoài scope Authentication hiện tại.

### Existing user data

V1 không yêu cầu hỗ trợ user data cũ.

Nếu phát hiện dữ liệu user đã tồn tại cần migration hoặc compatibility:

- Dừng phần xử lý liên quan.
- Báo developer.
- Phân tích riêng migration/compatibility impact.
- Không tự ý migrate hoặc transform dữ liệu.

## 11. Kế hoạch triển khai API

### Register

`POST /api/auth/register`

#### Access

- Guest.

#### Request nghiệp vụ

```json
{
  "display_name": "Minh Hau",
  "email": "hau@example.com",
  "password": "password"
}
```

`confirm_password` chỉ được kiểm tra ở frontend và không gửi như field nghiệp vụ tới backend.

#### Controller responsibility

- Nhận request.
- Gọi Auth Service.
- Nhận service result.
- Mapping result thành HTTP response.

#### Service responsibility

- Validate input.
- Normalize email.
- Kiểm tra email unique.
- Hash password với metadata cần thiết để verify về sau.
- Tạo account:
  - role `USER`.
  - `is_active = true`.
  - `daily_xp_goal = 50`.
- Không tạo session.
- Không auto-login.
- Không set HTTP cookie.

#### Repository responsibility

- Query email normalized.
- Insert user.
- Bảo vệ unique constraint ở database.

#### Success

Giữ response body theo API contract hiện tại:

```json
{
  "success": true,
  "message": "Registration successful"
}
```

Success status recommendation: `201 Created`.

`API_SPEC.md` hiện không quy định success status cụ thể cho endpoint này; đây là technical recommendation của PLAN. Response body hiện tại không được tự ý thay đổi.

#### Errors

- `400 Bad Request`: validation.
- `409 Conflict`: duplicate email.
- `500`: database/unexpected failure.

### Login

`POST /api/auth/login`

#### Access

- Guest.

#### Request

```json
{
  "email": "hau@example.com",
  "password": "password"
}
```

#### Controller responsibility

- Nhận credentials.
- Gọi Auth Service.
- Nhận authentication result ở mức nội bộ.
- Set cookie `session_id` với raw session token từ result ở mức nội bộ.
- Trả user identity được phép.
- Không đưa raw session token vào response body.

#### Service responsibility

- Normalize email.
- Tìm user.
- Kiểm tra `is_active`.
- Verify password.
- Tạo session.
- Lưu session thông qua Session Repository.
- Trả authentication result cho Controller ở mức nội bộ.
- Không set cookie.
- Không trả raw session token cho frontend.

#### Success

API response chỉ trả user identity được phép, tối thiểu:

- `id`.
- `display_name`.
- `email`.
- `role`.

Raw session token không xuất hiện trong JSON response.

Frontend không nhận hoặc lưu raw session identifier.

Success status recommendation: `200 OK`.

#### Errors

- `401 Unauthorized` cho email không tồn tại, password sai hoặc account inactive.
- `400 Bad Request` cho request không hợp lệ.
- Response body và status phải nhất quán để giảm account enumeration.

### Logout

`POST /api/auth/logout`

#### Access

- Endpoint phục vụ authenticated clients nhưng không yêu cầu authentication middleware theo kiểu hard `401`.
- Request có thể thiếu cookie hoặc có cookie malformed, expired hoặc session đã bị xóa.
- Tất cả các trường hợp trên đều được xử lý idempotently.

#### Controller responsibility

- Nhận request.
- Đọc cookie nếu có và chuyển credential ở mức nội bộ cho Auth Service.
- Nhận authentication result ở mức nội bộ.
- Clear HTTP-only cookie.
- Trả `204 No Content` cho client.
- Không đưa raw session identifier vào response body.

#### Service responsibility

- Nếu credential/session hợp lệ, xác định và xóa session hiện tại thông qua Session Repository.
- Nếu credential thiếu, malformed, expired hoặc session đã bị xóa, trả kết quả idempotent và không tạo lỗi authentication.
- Trả authentication result cho Controller ở mức nội bộ.
- Không clear cookie.
- Không tạo business data.

#### Success

Success status: `204 No Content`.

Response không chứa session state hoặc raw session identifier.

#### Errors

Logout lặp lại hoặc credential đã expired không tạo lỗi authentication; Controller vẫn clear cookie và trả `204 No Content`, client được đưa về trạng thái Guest.

### Current User

`GET /api/auth/me`

#### Access

- Authenticated `USER` hoặc `ADMIN`.

#### Middleware responsibility

- Xác thực session.
- Load user.
- Kiểm tra active status.
- Gắn identity vào request context.

#### Controller responsibility

- Trả identity từ request context.
- Không trả password hoặc session data.
- Không đưa raw session identifier vào response body.

#### Success

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

Success status: `200 OK`.

#### Errors

- `401 Unauthorized` nếu credential thiếu, malformed, expired hoặc không còn session.
- `500` nếu backend/database failure.

### API status recommendations và contract note

PLAN recommendation cho success status:

| Endpoint                  | Success status   |
| ------------------------- | ---------------- |
| `POST /api/auth/register` | `201 Created`    |
| `POST /api/auth/login`    | `200 OK`         |
| `POST /api/auth/logout`   | `204 No Content` |
| `GET /api/auth/me`        | `200 OK`         |

`API_SPEC.md` hiện không quy định success status cụ thể cho các Authentication endpoint này. Vì vậy, đây là technical recommendations của PLAN, không phải thay đổi API contract. Endpoint names và response body contract hiện có vẫn được giữ nguyên. Nếu phát hiện API_SPEC sau này có status contract khác, phải ghi nhận conflict và không tự sửa `API_SPEC.md`.

## 12. Thiết kế Frontend

### Pages

Hiện chưa có page structure thực tế. Dự kiến bổ sung theo frontend architecture:

- Login Page.
- Register Page.

Các page giao tiếp với backend thông qua `authService`, không gọi API trực tiếp trong UI nếu có thể tách service.

### Components

Có thể tái sử dụng hoặc bổ sung:

- Input.
- Password input.
- Button.
- Alert/error message.
- Loading state.
- Form validation message.
- Password visibility toggle.

Không tạo abstraction lớn khi component chỉ được dùng một lần và không tăng khả năng maintain.

### State / Hooks

Cần có authentication state dùng chung:

- `user`.
- `isAuthenticated`.
- `isLoading`.
- `authError`.

State được khởi tạo bằng `GET /api/auth/me` khi app bắt đầu.

Không lưu raw credential trong React state.

### API Services

Dự kiến có `authService` chịu trách nhiệm:

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

### Protected navigation

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

#### Login/Register

- Initial.
- Loading.
- Validation error.
- API error.
- Success.
- Disabled submit khi đang gửi request.
- Password show/hide.
- Duplicate email.
- Invalid credentials.

#### Application auth state

- Auth initialization loading.
- Authenticated.
- Guest.
- Session expired.
- Logout success.
- Logout failure.

## 13. Chiến lược Testing

Chỉ lập kế hoạch test trong giai đoạn PLAN.

### Backend unit tests

Auth Service:

- Normalize email trước lookup/insert.
- Registration validation.
- Password minimum length.
- Duplicate email.
- Password hash chứa metadata cần thiết.
- Password verification.
- New account defaults.
- Inactive account rejection.
- Generic invalid-credential behavior.
- Session token được tạo bằng cryptographically secure random generator với đúng 32 random bytes (256-bit).
- Chỉ SHA-256 hash của session token được lưu trong `AUTH_SESSION`.
- Raw session token không được log, lưu database hoặc lưu frontend.
- Session creation.
- Session expiration.
- Session deletion khi Logout.
- Logout idempotency.

Authorization:

- `USER` được phép truy cập user endpoint.
- `USER` bị từ chối Admin endpoint.
- `ADMIN` được phép truy cập Admin endpoint.
- Ownership lấy từ authenticated identity.
- Client không thể giả mạo `owner_id`, `user_id` hoặc `role`.

### Backend API/integration tests

- `POST /api/auth/register` success.
- Duplicate email.
- Backend normalize email trước lookup/insert.
- Email viết hoa/lowercase được xử lý nhất quán.
- Password dưới 8 ký tự.
- Không auto-login sau registration.
- `POST /api/auth/login` success.
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
- Logout không có cookie vẫn trả `204 No Content` và clear cookie.
- Logout với cookie malformed vẫn trả `204 No Content` và clear cookie.
- Logout với session expired vẫn trả `204 No Content` và clear cookie.
- Logout với session đã bị xóa vẫn trả `204 No Content` và clear cookie.
- Credential không còn dùng được sau Logout.
- Không trả password/hash/raw session credential.
- Error response không tiết lộ account enumeration.
- CORS không cho phép wildcard origin khi credentialed requests.
- CSRF behavior theo deployment configuration và protection được approve.

### Frontend tests

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

### Regression tests

Kiểm tra không ảnh hưởng:

- Public Landing Page.
- Public Vocabulary Set access.
- Các API Guest được phép truy cập.
- Admin route protection.
- Frontend build/lint.
- API error handling dùng chung.

### Test infrastructure

Hiện repository chưa thể hiện testing framework hoặc test files liên quan Authentication.

Nếu chưa có testing infrastructure, PLAN đề xuất lựa chọn framework tối thiểu phù hợp với Node/React hiện tại trong implementation preparation. Đây là dependency impact kỹ thuật, không phải product scope decision.

## 14. Dependencies

### Đã có

- Backend: `express`.
- Frontend: `react`, `react-dom`, `vite`, Tailwind-related packages.

### Có thể cần

#### Prisma

- Mục đích: data access theo `ARCHITECTURE.md`.
- Hiện chưa có trong `backend/package.json`.
- Cần nếu project chưa có data access implementation.
- Đây là baseline dependency theo kiến trúc.

#### Cookie handling

- Mục đích: parse và set cookie an toàn.
- Có thể dùng package nhỏ phù hợp với Express nếu implementation hiện tại chưa có cookie handling.
- Đây là technical implementation detail.
- Không biến lựa chọn package cụ thể thành product decision.

#### React Router

- Mục đích: protected navigation và redirect.
- Hiện chưa có trong frontend dependencies.
- Phù hợp nếu frontend chuyển sang route-based navigation.
- Nếu không thêm router, cần một cơ chế navigation tương đương nhưng không được tạo routing abstraction phức tạp.

#### Password hashing

- Đề xuất dùng `node:crypto` với `scrypt`.
- Không cần dependency hashing riêng nếu technical validation xác nhận phù hợp.

#### CSRF protection

- Chưa chốt library cụ thể.
- Chỉ bổ sung CSRF protection phù hợp nếu deployment thực tế yêu cầu cross-site credentialed requests.

#### Testing

- Hiện chưa thấy test framework.
- Đề xuất chọn framework phù hợp với Node/React hiện tại khi chuẩn bị implementation.
- Không tự ý mở rộng scope hoặc thêm testing infrastructure phức tạp.

### Không cần

- AI service.
- External authentication provider.
- OAuth.
- Redis.
- Microservice.
- Session/device history service.
- JWT library nếu stateful session được approve.
- Refresh-token library.
- Session history.
- Device history.
- IP tracking.
- User-agent tracking.
- Background worker phức tạp.

## 15. Thứ tự Implementation

Không tạo TASK ID ở giai đoạn PLAN.

1. Developer review authentication mechanism và session persistence.
2. Developer review thiết kế dự kiến của `AUTH_SESSION`.
3. Developer review session identifier mechanism: 32 random bytes, SHA-256 hash và cookie `session_id`.
4. Developer review session lifetime recommendation 7 ngày.
5. Xác nhận database impact và migration boundary.
6. Xác minh deployment topology, CORS và cookie attributes.
7. Xác nhận CSRF requirement nếu topology là cross-site credentialed.
8. Thiết lập backend configuration và environment contract.
9. Thiết lập Prisma/database access theo architecture đã phê duyệt.
10. Thiết lập password security utility bằng `node:crypto`.
11. Thiết lập `USER` data access.
12. Đồng bộ `DATABASE.md` sau PLAN approval nếu được approve.
13. Thiết lập `AUTH_SESSION` data access sau khi database documentation/migration boundary được approve.
14. Thiết lập Auth Service.
15. Thiết lập centralized validation và error mapping.
16. Thiết lập authentication middleware.
17. Thiết lập authorization middleware.
18. Thiết lập Auth Controller.
19. Thiết lập Authentication routes.
20. Thiết lập backend API tests.
21. Thiết lập frontend route/navigation foundation nếu cần.
22. Thiết lập `authService`.
23. Thiết lập authentication state/context.
24. Thiết lập Register Page.
25. Thiết lập Login Page.
26. Thiết lập protected navigation.
27. Thiết lập Logout flow.
28. Tích hợp frontend/backend.
29. Chạy test, build và security verification ở TEST stage.
30. Cập nhật documentation/status ở workflow stage phù hợp sau khi implementation được verify.

## 16. Risks và Edge Cases

- Stateful session cần `AUTH_SESSION`, dẫn tới schema impact.
- Nếu không có session persistence, Logout không thể invalidate credential bị sao chép ngay lập tức.
- `API_SPEC.md` cũ còn chứa `username`; approved SPEC đã chốt `display_name`.
- `API_SPEC.md` chưa mô tả mechanism cụ thể.
- `ARCHITECTURE.md` chưa cố định JWT hoặc HTTP-only Cookie Session.
- `DATABASE.md` nhắc `JWT_SECRET`, nhưng không được xem là quyết định dùng JWT.
- Không được trả error khác biệt làm lộ email tồn tại, password sai hoặc account inactive.
- Timing side-channel không cần tối ưu hóa quá mức ngoài scope đồ án, nhưng response branch công khai phải nhất quán.
- Cookie attributes phải phù hợp với deployment topology và CORS.
- `cross-origin` không đồng nghĩa với `cross-site`; cần kiểm tra deployment thực tế.
- `HttpOnly` không thay thế CSRF protection.
- Credentialed CORS không được dùng wildcard origin.
- Nếu cần cross-site credentialed requests, phải có CSRF protection phù hợp trước IMPLEMENT.
- Cookie cleanup và session cleanup không được biến thành background infrastructure phức tạp.
- Account role có thể bị thay đổi bởi Admin; middleware nên đọc role hiện tại thay vì tin role cũ.
- Database chưa hiện diện trong source code; Prisma/database configuration có thể là dependency nền tảng lớn hơn Authentication.
- SPEC file trong repository hiện vẫn hiển thị `SPEC status: DRAFT` dù workflow request xác nhận SPEC đã APPROVED; không sửa SPEC trong PLAN này và cần developer xác nhận metadata khi đồng bộ tài liệu.
- Không có testing infrastructure hiện tại; không được giả định test có thể chạy ngay.
- Không hỗ trợ user data cũ trong v1.
- Nếu phát hiện cần migration hoặc compatibility cho user data cũ, phải dừng và báo developer.

## 17. Open Decisions / Developer Approval Required

1. **Authentication mechanism**
   - Đề xuất: stateful server-side session authentication được transport bằng HTTP-only cookie.

- JWT chỉ được giữ ở phần phân tích so sánh, không phải cơ chế được implement.
- Cần developer approve phương án stateful session chính thức.

2. **Session persistence**
   - Đề xuất bổ sung `AUTH_SESSION`.
   - Cần developer approve việc bổ sung entity/table này.
   - Nếu không approve, cần đánh giá lại JWT và logout limitation.

3. **Session identifier mechanism**

- Session token: 32 random bytes (256-bit) từ cryptographically secure random generator.
- Cookie name duy nhất: `session_id`.
- Database lưu SHA-256 hash của token, không lưu raw token.
- Cần developer approve trước IMPLEMENT cùng với `AUTH_SESSION`.

4. **Session lifetime**
   - Technical recommendation: 7 ngày.
   - Không remember-device.
   - Không refresh-token.
   - Không idle timeout trong v1.
   - **7 ngày là technical recommendation của PLAN và vẫn cần developer approval trước IMPLEMENT.**

5. **Logout invalidation**
   - Đề xuất delete session record khi Logout.
   - Cần xác nhận delete là đủ cho v1 thay vì thêm `revoked_at`.

6. **Cookie/deployment policy**
   - Cookie attributes gồm `HttpOnly`, `Secure`, `SameSite`, `Domain`, `Path`.
   - Giá trị cụ thể phụ thuộc deployment topology và CORS configuration.
   - Không chốt cứng `SameSite`, `Domain` hoặc `Path` trước khi topology được kiểm chứng.

7. **CSRF protection**
   - `HttpOnly` không chống CSRF.
   - Nếu deployment yêu cầu cross-site credentialed requests, cần bổ sung CSRF protection phù hợp trước IMPLEMENT.
   - Không chốt library CSRF cụ thể ở PLAN này.

8. **Deployment topology verification**

- Phải xác minh frontend/backend origins, same-origin/cross-origin, same-site/cross-site, credentialed CORS, cookie attributes và CSRF requirement trước IMPLEMENT.
- Không hard-code Domain hoặc SameSite trước khi topology được verification.

9. **Database documentation synchronization**

- Sau khi PLAN được APPROVED, phải đồng bộ `DATABASE.md` với `AUTH_SESSION` và relationship `USER 1:N AUTH_SESSION` trước migration/implementation planning.
- Không sửa `DATABASE.md` hoặc tạo migration trong PLAN hiện tại.

10. **Validation status code**

- Authentication request validation errors dùng duy nhất `400 Bad Request`.
- `API_SPEC.md` không quy định cụ thể status này; đây là contract decision của PLAN và implementation phải tuân thủ.

Các nội dung sau là technical implementation details, không phải product scope decision riêng:

- `node:crypto` + `scrypt` là password hashing recommendation.
- Cookie handling library là technical implementation detail.
- React Router là dependency recommendation dựa trên frontend architecture.
- Testing framework là dependency impact kỹ thuật.
- Không thêm `revoked_at`, `last_used_at`, IP hoặc user-agent trong v1 là design recommendation để giữ scope tối giản.

## 18. Traceability: SPEC → PLAN

| SPEC requirement                                             | PLAN mapping                                     |
| ------------------------------------------------------------ | ------------------------------------------------ |
| BR-01, BR-02: Hai role và Guest không phải role              | Mục 8, Mục 9                                     |
| BR-03, BR-04: `display_name`, `confirm_password` client-side | Mục 11 Register, Mục 12 Frontend                 |
| BR-05, BR-06: Email unique và lowercase                      | Mục 7, Mục 8, Mục 11 Register, Mục 13 Testing    |
| BR-07, BR-08, BR-09: Password security                       | Mục 7                                            |
| BR-10, BR-11, BR-12: Account defaults                        | Mục 11 Register                                  |
| BR-13, BR-14: Inactive account và chống enumeration          | Mục 6, Mục 8, Mục 11 Login                       |
| BR-15: Không auto-login                                      | Mục 11 Register, Mục 12 Frontend                 |
| BR-16: Logout trong scope                                    | Mục 6, Mục 11 Logout, Mục 12 Frontend            |
| BR-17, BR-18: Mechanism và credential lifetime               | Mục 5, Mục 6, Mục 17                             |
| BR-19, BR-20: Backend authentication/authorization           | Mục 8, Mục 9                                     |
| BR-21, BR-22: Role protection                                | Mục 8, Mục 9                                     |
| BR-23: Ownership từ authenticated identity                   | Mục 9                                            |
| AC-01 đến AC-09: Registration                                | Mục 11 Register, Mục 13 Testing                  |
| AC-10 đến AC-15: Login và Current User                       | Mục 6, Mục 11 Login/Current User, Mục 13 Testing |
| AC-16: Logout invalidation                                   | Mục 5, Mục 6, Mục 11 Logout                      |
| AC-17 đến AC-20: Protected/Admin authorization               | Mục 8, Mục 9, Mục 13 Testing                     |
| AC-21, AC-22: Frontend state và security boundary            | Mục 12                                           |
| AC-23: Test coverage                                         | Mục 13                                           |

## 19. Tóm tắt PLAN

### Sẽ implement

- Registration bằng `display_name`, email và password.
- Email lowercase normalization ở backend.
- Frontend có thể normalize email cho UX nhưng không phải security boundary.
- Password hashing bằng `node:crypto`/`scrypt`.
- Metadata cần thiết trong `password_hash` để verify password về sau.
- Login và current-user identification.
- Stateful server-side session authentication được transport bằng HTTP-only cookie.
- Session persistence tối giản trong `AUTH_SESSION`.
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

### Không implement

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

### Technical decisions được đề xuất

- Dùng `node:crypto` + `scrypt` cho password hashing.
- `password_hash` lưu kèm thuật toán, parameters, salt và derived key/hash.
- Dùng stateful server-side session authentication được transport bằng HTTP-only cookie.
- Session token được tạo bằng cryptographically secure random generator với 32 random bytes (256-bit).
- Cookie name duy nhất là `session_id`.
- `AUTH_SESSION.session_identifier_hash` lưu SHA-256 hash của session token.
- Lưu session tối thiểu trong `AUTH_SESSION`.
- `AUTH_SESSION` gồm `id`, `user_id`, `session_identifier_hash`, `created_at`, `expires_at`.
- Relationship là `USER 1 ─── N AUTH_SESSION`.
- Xóa session hiện tại khi Logout thay vì thêm `revoked_at`.
- Session lifetime recommendation là 7 ngày.
- Không remember-device, refresh-token hoặc idle timeout trong v1.
- Cookie attributes được xác định theo deployment topology và CORS configuration thực tế.
- Không chốt cứng `SameSite`, `Domain` hoặc `Path` trước khi topology được kiểm chứng.
- CSRF phải được xem xét; nếu cần cross-site credentialed requests thì phải có protection phù hợp trước IMPLEMENT.
- Validation errors dùng duy nhất `400 Bad Request`.
- Sau PLAN approval, `DATABASE.md` phải được đồng bộ với `AUTH_SESSION` trước migration/implementation planning.

### Developer Approval Required

- Xác nhận stateful server-side session authentication là cơ chế chính thức; JWT không thuộc implementation scope.
- Cho phép bổ sung entity/table `AUTH_SESSION`.
- Session lifetime recommendation 7 ngày.
- Logout invalidation bằng delete session.
- Cookie/deployment policy sau khi topology và CORS được kiểm chứng.
- CSRF requirement nếu deployment thực tế là cross-site credentialed.

### Workflow status

PLAN hiện tại chưa được developer approve.

Chưa:

- Tạo TASK.
- Implement code.
- Tạo migration.
- Cài dependency.
- Sửa `FEATURE_STATUS.md`.
- Sửa Authentication SPEC.

Chỉ sau khi developer approve PLAN mới được chuyển sang TASK.
