# PLAN-009 — Authentication Routes / Route Integration

## 1. Understanding

TASK-009 tích hợp Authentication hiện có vào Express application bằng:

- Authentication Router.
- Dependency composition tại application root.
- Mount router tại `/api/auth`.
- Middleware order đúng theo từng route.
- Không thay đổi behavior của Service, Middleware hoặc Controller.

Bốn endpoint cần đăng ký:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

## 2. Current Architecture

### Existing implementation

Đã có:

- `createAuthenticationService(...)`
- `createAuthenticationMiddleware({ authenticationService })`
- `createRoleAuthorizationMiddleware({ allowedRoles })`
- `createAuthenticationController({ authenticationService })`
- `createUserRepository(prisma)`
- `createAuthSessionRepository(prisma)`
- `cookie-parser`
- Prisma schema và generated Prisma client

### Current gap

`backend/src/main.js` hiện chỉ:

- Import Express.
- Import/wire `cookie-parser`.
- Đăng ký health route `/`.
- Gọi `app.listen()`.

Chưa có:

- `express.json()`.
- Prisma client instance.
- Repository composition.
- Authentication Service composition.
- Authentication Middleware composition.
- Auth Controller composition.
- Auth Router.
- Router mount.
- Centralized error handler.
- Đang gọi `app.listen()` trực tiếp.
- Chưa export app hoặc composition root.

Đây là integration gap cần xử lý trong TASK-009, ngoại trừ centralized error handler và CORS đã được xác định là ngoài scope.

## 3. Target Architecture

```text
PrismaClient
    ↓
User Repository
Auth Session Repository
    ↓
Authentication Service
    ↓
Authentication Middleware
Auth Controller
    ↓
Authentication Router
    ↓
app.use("/api/auth", authRouter)
    ↓
Express Application
```

Application middleware order:

```text
express.json()
    ↓
cookieParser()
    ↓
authRouter
```

Route-specific order:

```text
POST /api/auth/register
    ↓
controller.register

POST /api/auth/login
    ↓
controller.login

POST /api/auth/logout
    ↓
controller.logout

GET /api/auth/me
    ↓
authenticationMiddleware
    ↓
authenticationController.getCurrentUser
```

Không áp dụng Authentication Middleware hoặc Role Authorization Middleware toàn cục.

## 4. Files to Create

### `backend/src/routes/auth-routes.js`

Đề xuất export:

```text
createAuthenticationRouter({
  authenticationController,
  authenticationMiddleware
})
```

Factory trả về một Express Router.

Router có trách nhiệm:

- Khai báo đúng bốn route.
- Gắn Authentication Middleware chỉ cho `/me`.
- Gắn đúng controller handler.
- Không tạo service/repository.
- Không chứa business logic.
- Không xử lý cookie trực tiếp.

## 5. Files to Modify

### `backend/src/main.js`

Chỉ sửa để:

1. Import Prisma client từ generated client hiện tại.
2. Import repositories.
3. Import password security module.
4. Import Authentication Service.
5. Import Authentication Middleware.
6. Import Auth Controller.
7. Import Auth Router.
8. Tạo dependency graph một lần khi application khởi tạo.
9. Đăng ký `express.json()` trước router.
10. Giữ `cookieParser()` trước router.
11. Mount router:

```text
app.use("/api/auth", authRouter)
```

12. Giữ health route `/`.
13. Không thêm centralized error handler.
14. Giữ `app.listen()` theo cấu trúc hiện tại, trừ khi việc composition yêu cầu thay đổi tối thiểu để wiring hoạt động.

## 6. Files Not to Touch

Không sửa:

- `backend/src/services/authentication-service.js`
- `backend/src/middleware/authentication-middleware.js`
- `backend/src/middleware/role-authorization-middleware.js`
- `backend/src/controllers/auth-controller.js`
- `backend/src/repositories/user-repository.js`
- `backend/src/repositories/auth-session-repository.js`
- `backend/src/utils/password-security.js`
- `backend/prisma/schema.prisma`
- Prisma migrations
- `backend/package.json`
- `backend/package-lock.json`
- Frontend files
- API documentation
- Authentication SPEC/PLAN/TASK

## 7. Dependency Composition Plan

Composition root là `backend/src/main.js`.

Thứ tự tạo dependency:

1. Tạo một Prisma client instance:

```text
new PrismaClient()
```

từ generated client hiện tại.

2. Tạo User Repository:

```text
createUserRepository(prisma)
```

3. Tạo Auth Session Repository:

```text
createAuthSessionRepository(prisma)
```

4. Tạo Authentication Service:

```text
createAuthenticationService({
  userRepository,
  authSessionRepository,
  passwordSecurity
})
```

5. Tạo Authentication Middleware:

```text
createAuthenticationMiddleware({
  authenticationService
})
```

6. Tạo Auth Controller:

```text
createAuthenticationController({
  authenticationService
})
```

7. Tạo Authentication Router:

```text
createAuthenticationRouter({
  authenticationController,
  authenticationMiddleware
})
```

8. Mount Router:

```text
app.use("/api/auth", authRouter)
```

Instance rules:

- Một Prisma client instance cho application.
- Một User Repository instance.
- Một Auth Session Repository instance.
- Một Authentication Service instance.
- Một Authentication Middleware instance.
- Một Auth Controller instance.
- Một Authentication Router instance.
- Không tạo dependency trong từng request.
- Controller và Authentication Middleware phải dùng cùng Authentication Service instance.

## 8. Route Registration Plan

Router base path:

```text
/api/auth
```

### Register

Router path:

```text
POST /register
```

Final API:

```text
POST /api/auth/register
```

Handler:

```text
authenticationController.register
```

Middleware:

- Không Authentication Middleware.
- Không Role Authorization Middleware.

### Login

Router path:

```text
POST /login
```

Final API:

```text
POST /api/auth/login
```

Handler:

```text
authenticationController.login
```

Middleware:

- Không Authentication Middleware.
- Không Role Authorization Middleware.

### Logout

Router path:

```text
POST /logout
```

Final API:

```text
POST /api/auth/logout
```

Handler:

```text
authenticationController.logout
```

Middleware:

- Không hard-401 Authentication Middleware.
- Không Role Authorization Middleware.

Lý do:

- Logout phải hoạt động khi cookie thiếu, expired, invalid hoặc session đã bị xóa.
- Controller và Authentication Service đã có logout idempotency contract.

### Current User

Router path:

```text
GET /me
```

Final API:

```text
GET /api/auth/me
```

Handler:

```text
authenticationController.getCurrentUser
```

Middleware order:

```text
authenticationMiddleware
    ↓
authenticationController.getCurrentUser
```

Không dùng Role Authorization Middleware vì cả `USER` và `ADMIN` được phép truy cập `/me`.

## 9. Middleware Ordering

Application-level order:

```text
express.json()
    ↓
cookieParser()
    ↓
authRouter
```

Route-level order:

```text
GET /api/auth/me
    ↓
authenticationMiddleware
    ↓
authenticationController.getCurrentUser
```

Public routes:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
```

Không sử dụng Authentication Middleware hoặc Role Authorization Middleware toàn cục.

## 10. Error Boundary

Known errors:

```text
Authentication Service
    ↓
Auth Controller maps known service codes
    ↓
HTTP response
```

Expected known mappings đã tồn tại trong Controller:

- `VALIDATION_ERROR` → `400`
- `EMAIL_ALREADY_EXISTS` → `409`
- `AUTHENTICATION_FAILED` → `401`

Authentication Middleware tự xử lý authentication failure thành `401`.

Role Authorization Middleware tự xử lý forbidden role thành `403`.

Unexpected errors:

```text
Controller/Middleware
    ↓
next(error)
```

TASK-009 không triển khai centralized error handler theo quyết định scope đã chốt.

Hiện tại `main.js` chưa có centralized error handler. Đây là integration gap được ghi nhận, nhưng:

- Không tạo error handler trong TASK-009.
- Không tự thiết kế response format mới.
- Không thay đổi behavior của Controller/Middleware.
- Không coi thiếu centralized error handler là lý do mở rộng TASK-009.

## 11. Security Considerations

- Register, login và logout không đi qua Authentication Middleware.
- `/me` bắt buộc đi qua Authentication Middleware.
- `/me` không yêu cầu Role Authorization Middleware.
- Không áp dụng authentication toàn cục.
- Không áp dụng role authorization toàn cục.
- Không lấy identity từ body, query, params hoặc headers.
- Không expose raw session token.
- Không log raw session token.
- Không thay đổi cookie architecture.
- Không thêm JWT, refresh token, `express-session`, `cookie-session` hoặc Redis.
- Không thay đổi Service, Repository hoặc Middleware behavior.
- Không tạo route-level business logic.
- Không thêm CORS hoặc CSRF.
- Không thêm roles hoặc permission system.
- Giữ `cookie-parser` trước `/me`.
- Giữ `express.json()` trước register/login handlers.

## 12. CORS Scope

CORS is intentionally out of scope for TASK-009.

Không:

- Cài package CORS.
- Gọi `cors()`.
- Thêm allowed origins.
- Thêm credentials configuration.
- Thay đổi cookie `SameSite`.
- Thay đổi cookie `Secure`.
- Thêm CORS headers.

CSRF cũng không thuộc TASK-009.

## 13. Implementation Sequence

### Step 1 — Inspect existing composition

- Xác nhận Prisma generated client import path.
- Xác nhận repository/service/controller/middleware exports.
- Xác nhận `main.js` hiện chưa có composition root.
- Xác nhận `cookie-parser` đã được wire.

### Step 2 — Create auth router

Tạo:

```text
backend/src/routes/auth-routes.js
```

Với factory:

```text
createAuthenticationRouter({
  authenticationController,
  authenticationMiddleware
})
```

Khai báo đúng bốn routes.

### Step 3 — Build authentication dependencies

Trong `main.js`:

- Tạo một Prisma client.
- Tạo repositories.
- Tạo Authentication Service.
- Tạo Authentication Middleware.
- Tạo Auth Controller.
- Tạo Auth Router.

Không tạo instance theo request.

### Step 4 — Add required body parsing

Đăng ký:

```text
express.json()
```

trước Authentication Router.

Không thêm validation middleware mới.

### Step 5 — Mount router

Mount:

```text
app.use("/api/auth", authRouter)
```

Giữ health route hiện tại.

### Step 6 — Verify middleware order

Xác nhận:

- `cookieParser()` chạy trước router.
- `/me` dùng Authentication Middleware trước controller.
- Register/login/logout không dùng hard-401 middleware.
- Không có global authentication/role middleware.

### Step 7 — Verify health route remains

Health route `/` tiếp tục hoạt động sau route integration.

### Step 8 — Verify composition boundary

Kiểm tra:

- Không duplicate service/repository creation.
- Controller và Authentication Middleware dùng cùng service instance.
- Router không tạo dependencies.
- Route không chứa business logic.
- Không có thay đổi Service/Repository/Schema/API business contract.

### Step 9 — Static and syntax verification

- Syntax check router.
- Syntax check `main.js`.
- Import smoke check.
- Verify Prisma client import.
- `git diff --check`.
- Kiểm tra changed files.
- Không chạy migration.
- Không triển khai centralized error handler.
- Không chạy CORS/CSRF integration.

## PLAN STATUS: READY FOR REVIEW

Implementation has NOT started.  
No source files were modified.
