# TASK-009 — Authentication Routes / Route Integration

## 1. Objective

Tích hợp Authentication hiện có vào Express application bằng Authentication Router và application-level dependency composition.

TASK-009 phải cung cấp đúng bốn endpoint:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

TASK-009 không thay đổi behavior của Authentication Service, Authentication Middleware, Role Authorization Middleware, Auth Controller hoặc repositories.

## 2. Preconditions

- SPEC-009: APPROVED.
- PLAN-009: APPROVED.
- TASK-005 Authentication Service: đã implement/verify theo workflow trước đó.
- TASK-006 Authentication Middleware: đã implement/test/review.
- TASK-007 Role Authorization Middleware: đã implement/test/review.
- TASK-008 Auth Controller: đã implement/test theo workflow trước đó.
- `cookie-parser` đã tồn tại trong backend dependencies.
- Prisma schema và generated client hiện có là dependency nền tảng của project.

Current source inspection cho thấy:

- `backend/src/main.js` mới có Express, `cookie-parser`, health route và `app.listen()`.
- Chưa có `express.json()`.
- Chưa có application dependency composition.
- Chưa có Authentication Router.
- Chưa có centralized error handler.

Integration gap của centralized error handler được ghi nhận nhưng không được triển khai trong TASK-009.

## 3. Scope

### In Scope

- Tạo Authentication Router.
- Đăng ký đúng bốn authentication routes.
- Tạo dependency graph một lần tại application composition root.
- Inject cùng Authentication Service vào Controller và Authentication Middleware.
- Thêm `express.json()` trước Authentication Router.
- Giữ `cookieParser()` trước Authentication Router.
- Mount router tại `/api/auth`.
- Giữ health route `/`.
- Giữ `app.listen()` nếu không cần thay đổi để route integration hoạt động.
- Verify route/middleware ordering và composition boundaries.

### Out of Scope

- Authentication Service behavior.
- Authentication Middleware behavior.
- Role Authorization Middleware behavior.
- Auth Controller behavior.
- Repository behavior.
- Password hashing.
- Session token generation/hashing.
- Database/schema/migration changes.
- Centralized error handler.
- CORS.
- CSRF.
- JWT, refresh token, `express-session`, `cookie-session`, Redis.
- Frontend authentication.
- New roles, ACL, ownership hoặc permission system.
- New authentication endpoints.

## 4. Files

### CREATE

```text
backend/src/routes/auth-routes.js
```

Purpose:

- Tạo Express Router cho Authentication.
- Đăng ký đúng bốn route.
- Gắn Authentication Middleware chỉ cho `/me`.
- Reuse injected Controller và Middleware.

### MODIFY

```text
backend/src/main.js
```

Purpose:

- Tạo application dependency graph một lần.
- Đăng ký `express.json()`.
- Giữ `cookieParser()` trước auth router.
- Tạo và mount Authentication Router tại `/api/auth`.
- Giữ health route và application startup hiện tại.

### DO NOT MODIFY

```text
backend/src/services/authentication-service.js
backend/src/middleware/authentication-middleware.js
backend/src/middleware/role-authorization-middleware.js
backend/src/controllers/auth-controller.js
backend/src/repositories/user-repository.js
backend/src/repositories/auth-session-repository.js
backend/src/utils/password-security.js
backend/prisma/schema.prisma
backend/prisma/migrations/*
backend/package.json
backend/package-lock.json
frontend/*
docs/API_SPEC.md
Authentication SPEC
Authentication PLAN
```

Nếu source inspection trong IMPLEMENT phát hiện discrepancy ngoài hai file CREATE/MODIFY, phải dừng và báo cáo; không tự mở rộng scope.

## 5. Task Breakdown

### TASK-009-01 — Create Authentication Router

#### Purpose

Tạo router module chịu trách nhiệm route declaration và middleware composition.

#### Files

Create:

```text
backend/src/routes/auth-routes.js
```

#### Dependencies

- TASK-005.
- TASK-006.
- TASK-007.
- TASK-008.

#### Implementation Requirements

Export factory:

```text
createAuthenticationRouter({
  authenticationController,
  authenticationMiddleware,
})
```

Factory trả về Express Router.

Router phải khai báo:

```text
POST /register  → authenticationController.register
POST /login     → authenticationController.login
POST /logout    → authenticationController.logout
GET  /me        → authenticationMiddleware → authenticationController.getCurrentUser
```

Router không được:

- Tạo Prisma client.
- Tạo repository/service/controller instance.
- Chứa business logic.
- Xử lý cookie trực tiếp.
- Dùng Role Authorization Middleware.

#### Acceptance Criteria

- Factory/export contract đúng.
- Có đúng bốn route.
- Method/path đúng.
- Chỉ `/me` gắn Authentication Middleware.
- Không route nào gắn Role Authorization Middleware.
- `/me` gọi Authentication Middleware trước Controller.
- Router không tạo dependency mới.

#### Scope Constraints

Chỉ tạo router module. Không mount router vào Express trong task này.

---

### TASK-009-02 — Compose Authentication Dependencies

#### Purpose

Tạo dependency graph duy nhất tại application composition root.

#### Files

Modify:

```text
backend/src/main.js
```

#### Dependencies

- TASK-009-01.
- Existing generated Prisma client.
- Existing repositories, service, middleware và controller.

#### Implementation Requirements

Reuse Prisma generated client hiện tại; không tạo Prisma architecture mới.

Composition order:

```text
PrismaClient
    ↓
createUserRepository(prisma)
createAuthSessionRepository(prisma)
    ↓
createAuthenticationService({
  userRepository,
  authSessionRepository,
  passwordSecurity
})
    ↓
createAuthenticationMiddleware({ authenticationService })
createAuthenticationController({ authenticationService })
    ↓
createAuthenticationRouter({
  authenticationController,
  authenticationMiddleware
})
```

Instance rules:

- Một Prisma client instance.
- Một User Repository instance.
- Một Auth Session Repository instance.
- Một Authentication Service instance.
- Một Authentication Middleware instance.
- Một Authentication Controller instance.
- Một Authentication Router instance.
- Không tạo dependency trong request handler.
- Controller và Authentication Middleware dùng cùng Authentication Service instance.

#### Acceptance Criteria

- Dependency graph được tạo tại application composition root.
- Không có duplicate service/repository creation cho mỗi request.
- Controller và Authentication Middleware nhận cùng service instance.
- Router nhận injected dependencies.
- Không sửa behavior của các dependency hiện có.

#### Scope Constraints

Không sửa service, middleware, controller, repository, schema hoặc package files.

---

### TASK-009-03 — Register Public Routes

#### Purpose

Đăng ký các public authentication endpoints không yêu cầu authentication.

#### Files

Modify:

```text
backend/src/main.js
```

Router module từ TASK-009-01 được mount bởi application.

#### Dependencies

- TASK-009-01.
- TASK-009-02.

#### Routes

```text
POST /api/auth/register
POST /api/auth/login
```

#### Implementation Requirements

Register:

```text
authController.register
```

Login:

```text
authController.login
```

Cả hai route:

- Không dùng Authentication Middleware.
- Không dùng Role Authorization Middleware.
- Đọc body sau `express.json()`.
- Không chứa business logic trong route.

#### Acceptance Criteria

- `POST /api/auth/register` tồn tại.
- `POST /api/auth/login` tồn tại.
- Register/Login không bị hard-401 middleware chặn.
- `express.json()` được đăng ký trước auth router.
- Route handler đúng Controller method.
- Không duplicate service/session logic trong router.

---

### TASK-009-04 — Register Idempotent Logout Route

#### Purpose

Đăng ký logout route mà không chặn request bằng hard-401 authentication flow.

#### Files

Modify:

```text
backend/src/main.js
```

Router module từ TASK-009-01 được mount bởi application.

#### Dependencies

- TASK-009-01.
- TASK-009-02.

#### Route

```text
POST /api/auth/logout
```

#### Implementation Requirements

Handler:

```text
authController.logout
```

Route:

- Không dùng Authentication Middleware.
- Không dùng Role Authorization Middleware.
- Không đọc hoặc clear cookie trực tiếp.
- Delegate cookie/session behavior cho Auth Controller và Authentication Service.
- Giữ idempotent behavior của TASK-008.

#### Acceptance Criteria

- Route tồn tại đúng method/path.
- Logout không yêu cầu hard-401 middleware.
- Cookie thiếu/expired/invalid không bị route-level middleware chặn.
- Router không xử lý cookie trực tiếp.
- Handler đúng `authController.logout`.

---

### TASK-009-05 — Register Protected Current-User Route

#### Purpose

Đăng ký `/me` với Authentication Middleware đúng thứ tự.

#### Files

Modify:

```text
backend/src/main.js
```

Router module từ TASK-009-01 được mount bởi application.

#### Dependencies

- TASK-009-01.
- TASK-009-02.
- TASK-009-03.
- TASK-009-04.

#### Route

```text
GET /api/auth/me
```

#### Middleware Order

Application-level:

```text
express.json()
    ↓
cookieParser()
    ↓
authRouter
```

Route-level:

```text
authenticationMiddleware
    ↓
authenticationController.getCurrentUser
```

`cookieParser()` là application-level middleware, không được thêm vào `auth-routes.js` như route-level middleware.

#### Implementation Requirements

- `/me` dùng Authentication Middleware trước Controller.
- `/me` không dùng Role Authorization Middleware.
- Controller dùng `req.user` do Authentication Middleware tạo.
- Không gọi Authentication Service lần hai trong Controller.
- Không lấy identity từ body/query/params/headers.

#### Acceptance Criteria

- `GET /api/auth/me` tồn tại.
- Authentication Middleware chạy trước `getCurrentUser`.
- Thiếu/invalid session bị Authentication Middleware xử lý.
- USER và ADMIN đều có thể tiếp tục nếu authentication hợp lệ.
- Không có Role Authorization Middleware trên `/me`.
- Không có global Authentication Middleware.

---

### TASK-009-06 — Mount Router and Preserve Health Route

#### Purpose

Hoàn tất Express application integration.

#### Files

Modify:

```text
backend/src/main.js
```

#### Dependencies

- TASK-009-01 đến TASK-009-05.

#### Implementation Requirements

Application order:

```text
express.json()
    ↓
cookieParser()
    ↓
app.use("/api/auth", authRouter)
```

Health route `/` phải vẫn tồn tại.

Không đăng ký:

```text
app.use(authenticationMiddleware)
app.use(roleAuthorizationMiddleware)
```

toàn cục.

Không triển khai centralized error handler.

#### Acceptance Criteria

- Router được mount chính xác bằng `/api/auth`.
- Final endpoints đúng:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- Health route `/` vẫn hoạt động.
- `express.json()` đứng trước auth router.
- `cookieParser()` đứng trước auth router.
- Không có global authentication/role middleware.
- `app.listen()` vẫn được giữ nếu không có yêu cầu kỹ thuật trực tiếp để thay đổi.

## 6. Dependency Graph

```text
TASK-009-01
Create Authentication Router
        ↓
TASK-009-02
Compose Prisma/Application dependencies
        ↓
TASK-009-03
Register public register/login routes
        ↓
TASK-009-04
Register logout route
        ↓
TASK-009-05
Register protected /me route
        ↓
TASK-009-06
Mount router and preserve health route
```

Dependency composition inside TASK-009-02:

```text
PrismaClient
  ↓
User Repository
Auth Session Repository
  ↓
Authentication Service
  ↓
Authentication Middleware
Authentication Controller
  ↓
Authentication Router
  ↓
app.use("/api/auth", authRouter)
```

## 7. Acceptance Criteria

### Routing

- Exactly four Authentication routes exist.
- `POST /api/auth/register` exists.
- `POST /api/auth/login` exists.
- `POST /api/auth/logout` exists.
- `GET /api/auth/me` exists.
- Router is mounted at `/api/auth`.
- Health route `/` remains available.

### Middleware

- Authentication Middleware applies only to `/me`.
- Role Authorization Middleware is not applied to `/me`.
- Register/Login/Logout are not blocked by hard-401 Authentication Middleware.
- No global Authentication Middleware exists.
- No global Role Authorization Middleware exists.
- `express.json()` runs before auth handlers that read request bodies.
- `cookieParser()` runs before auth router.
- `cookieParser()` is not added as route-level middleware in `auth-routes.js`.
- `/me` order is Authentication Middleware then Controller.

### Dependency

- Prisma client is created once.
- User Repository is created once.
- Auth Session Repository is created once.
- Authentication Service is created once.
- Authentication Middleware and Auth Controller share the same Authentication Service instance.
- Router receives injected dependencies.
- No dependency is created per request.

### Security

- No raw session token is exposed or logged by route integration.
- Stateful session architecture is unchanged.
- No JWT, refresh token, `express-session`, `cookie-session` or Redis is added.
- No new role is added.
- No identity is read from client-controlled body/query/params/headers for authentication.

### Scope

- Authentication Service is not modified.
- Authentication Middleware is not modified.
- Role Authorization Middleware is not modified.
- Auth Controller is not modified.
- Repositories are not modified.
- Prisma schema and migrations are not modified.
- API contract is not changed.
- CORS is not implemented.
- Centralized error handler is not implemented.
- No unrelated file is modified.

## 8. Security Constraints

- Public routes: register, login and logout.
- Protected route: `/me` through Authentication Middleware.
- `/me` does not require Role Authorization Middleware because both approved roles may access it.
- Do not apply authentication or role middleware globally.
- Preserve `cookie-parser` before auth router.
- Do not expose raw session tokens.
- Do not log raw session tokens.
- Do not trust client-supplied identity.
- Do not alter cookie architecture or session lifecycle.

## 9. Out of Scope

- Authentication Service changes.
- Authentication Middleware changes.
- Role Authorization Middleware changes.
- Auth Controller changes.
- Repository changes.
- Prisma/schema/migration changes.
- Centralized error handler.
- New error response format.
- CORS.
- CSRF.
- JWT.
- Refresh token.
- `express-session`.
- `cookie-session`.
- Redis.
- New roles.
- Ownership/ACL/permission systems.
- Frontend authentication.
- New authentication endpoints.
- API business contract changes.

CORS is intentionally out of scope for TASK-009.

Integration Gap:
Centralized error handler is not implemented in TASK-009.

## 10. Testing Handoff

TEST-009 must verify:

1. Router factory/export contract.
2. Exactly four route registrations.
3. HTTP methods and paths.
4. Router mount path `/api/auth`.
5. Public vs protected route behavior.
6. Middleware ordering:
   - `express.json()` before auth router.
   - `cookieParser()` before auth router.
   - Authentication Middleware before `/me` controller.
7. Register/Login/Logout do not use hard-401 Authentication Middleware.
8. `/me` does not use Role Authorization Middleware.
9. No global Authentication Middleware.
10. No global Role Authorization Middleware.
11. Dependency instance sharing.
12. Health route remains available.
13. Unexpected errors continue to use `next(error)`.
14. No raw token exposure or logging introduced by route integration.
15. No database/schema/package changes.
16. Syntax and import correctness.
17. Changed files remain within approved scope.

Không viết test code trong TASK stage và không thêm test framework.

## 11. Implementation Boundary

IMPLEMENT stage chỉ được implement các task đã được APPROVED trong TASK-009.

Nếu implementation phát hiện cần:

- Sửa Authentication Service.
- Sửa Authentication Controller.
- Sửa Authentication Middleware.
- Sửa Role Authorization Middleware.
- Sửa repository.
- Sửa database/schema/migration.
- Thêm CORS.
- Thêm centralized error handler.
- Thay đổi authentication architecture.
- Thêm endpoint hoặc role.

thì phải STOP và quay lại SPEC/PLAN/TASK phù hợp.

Không tự ý mở rộng scope.

## 12. Approval Gate

```text
TASK STATUS: READY FOR REVIEW

SPEC-009: APPROVED
PLAN-009: APPROVED
IMPLEMENTATION: NOT STARTED
SOURCE CODE: NOT MODIFIED
```
