# PLAN-010 — Backend Authentication Tests

**Giai đoạn workflow:** PLAN
**SPEC dependency:** `SPEC-010 — Backend Authentication Tests` — HUMAN APPROVED
**Feature status:** `IN_PROGRESS`
**PLAN status:** `READY FOR HUMAN REVIEW`

## 1. Summary

PLAN-010 chuyển các yêu cầu đã approved trong SPEC-010 thành một backend test suite dùng công cụ có sẵn của Node.js 22:

- `node:test` làm test runner;
- `node:assert/strict` làm assertion API;
- native `fetch` làm HTTP client;
- Express server thật chạy trên loopback và OS-assigned ephemeral port trong HTTP integration tests;
- Prisma/PostgreSQL thật trên một dedicated test database để chứng minh persistence behavior;
- dependency stubs chỉ dùng trong focused component tests cho error/edge paths khó hoặc không an toàn khi tạo qua HTTP.

Không thêm test dependency mới. Production change duy nhất được dự kiến là tách việc tạo Express app khỏi `app.listen()` thành một app factory nhỏ, để test import application mà không tự khởi động server. Route, middleware, service, repository, database và API behavior không đổi.

Suite chạy database-dependent tests tuần tự, reset đúng hai bảng `AUTH_SESSION` và `USER` trong dedicated test database, dùng fixture identifier unique, không dùng development/production database và không phụ thuộc test order.

## 2. Current State and Constraints

### Runtime and module system

- Local runtime đã xác minh: Node.js `v22.20.0`, npm `10.9.3`.
- Backend dùng ESM qua `"type": "module"`.
- Express: `5.2.1`.
- Prisma Client/CLI: `6.19.3`.
- Node 22 cung cấp ổn định `node:test`, `node:assert/strict`, native `fetch`, `Headers.getSetCookie()`, crypto và HTTP server APIs cần thiết.

### Existing test infrastructure

- `backend/package.json` có `npm test` placeholder và luôn exit `1`.
- Không có persistent `.test.js`/`.spec.js` files.
- Không có Jest, Vitest, Mocha, Supertest hoặc assertion library trong dependency tree.
- TASK-005 đến TASK-009 đã có inline verification history, nhưng không tạo reusable automated suite.

### Existing application boundary

- `backend/src/main.js` vừa compose dependencies, vừa tạo Express app, vừa gọi `app.listen()`.
- Import `main.js` trong test hiện sẽ khởi động server ngoài ý muốn và không cung cấp lifecycle handle rõ ràng để teardown.
- Authentication modules đã dùng factory/dependency injection, nên có thể reuse trực tiếp cho focused component tests.

### Workflow constraints

- Không thay đổi Authentication behavior hoặc API contract.
- Không thêm endpoint, role, schema hoặc migration.
- Không sửa TASK-009.
- Không làm frontend.
- Không tự chốt CORS, CSRF, `SameSite` hoặc cookie `Domain`.
- Centralized error handler không được thêm chỉ để test pass.

## 3. Technical Decisions

### 3.1 Test runner and assertions

**Decision:** dùng Node built-in `node:test` và `node:assert/strict`.

Rationale:

- Runtime Node 22 hiện tại đã cung cấp đầy đủ runner, hooks, subtests, concurrency control, mock utilities và exit-code behavior.
- Phù hợp trực tiếp với ESM hiện tại.
- Không thêm dependency hoặc lockfile churn.
- Đủ cho HTTP, component và database integration scope của SPEC-010.
- Giảm configuration và maintenance so với Jest/Vitest/Mocha trong codebase hiện chưa có test convention.

Không chọn Jest/Vitest/Mocha vì SPEC-010 không cần browser transforms, snapshot system hoặc framework-specific mocking; lợi ích bổ sung không bù cho dependency/configuration mới.

### 3.2 HTTP request mechanism

**Decision:** dùng native `fetch` của Node 22 và manual cookie forwarding có kiểm soát.

Rationale:

- Không cần Supertest hoặc HTTP client dependency mới.
- Gửi request qua HTTP stack thật tới Express server, chứng minh route/middleware/controller integration có ý nghĩa.
- `Headers.getSetCookie()` cho phép đọc `Set-Cookie`; test helper chỉ trích xuất cookie pair cần gửi lại, không tạo general-purpose cookie jar.
- Auth flow chỉ dùng một cookie `session_id`, nên helper nhỏ đủ rõ và maintainable.

HTTP helper phải:

- bind server vào `127.0.0.1` với port `0`;
- lấy actual assigned port từ `server.address()`;
- đóng server trong teardown/finally;
- hỗ trợ JSON body, raw malformed body, request cookie và response `Set-Cookie` inspection;
- không log request body/cookie hoặc secret khi assertion fail.

### 3.3 Express application boundary

**Decision:** tạo `backend/src/app.js` export một `createApp({ prisma })` factory; giữ `app.listen()` duy nhất trong `backend/src/main.js`.

Planned extraction:

- `app.js` nhận existing Prisma client instance.
- `app.js` compose User Repository, Auth Session Repository, Authentication Service, Authentication Middleware, Auth Controller và Auth Router đúng dependency graph hiện tại.
- `app.js` đăng ký `express.json()`, `cookieParser()`, `/api/auth` router và health route theo đúng order hiện tại.
- Factory trả Express app, không gọi `listen()` và không tạo network listener.
- `main.js` vẫn tạo đúng một Prisma client, gọi `createApp({ prisma })`, rồi listen trên `PORT` như hiện tại.

Tại sao thay đổi này cần thiết:

- Import `main.js` hiện gây side effect khởi động server và không thể teardown deterministic.
- Spawn process để test sẽ làm port/lifecycle/database coordination phức tạp hơn và khó inspect persistence cùng một test.
- Dựng app riêng trong test sẽ duplicate production composition và có nguy cơ test topology khác production.

Production behavior không đổi vì dependency graph, middleware order, routes, health response và startup command được giữ nguyên; chỉ tách composition thành importable factory.

Không thêm optional dependency override vào app factory. Focused error tests tiếp tục gọi existing controller/service/middleware factories trực tiếp với stubs, tránh biến production composition thành test framework.

### 3.4 Database strategy

**Decision:** dùng PostgreSQL database riêng cho test, được chỉ định rõ bằng `TEST_DATABASE_URL`, với explicit reset opt-in.

Safety contract:

- Database tests chỉ chạy khi có `TEST_DATABASE_URL`.
- Test bootstrap set `NODE_ENV=test` và map `TEST_DATABASE_URL` sang `DATABASE_URL` trước khi dynamic-import Prisma/application modules.
- Destructive cleanup chỉ được phép khi `TEST_DATABASE_ALLOW_RESET=true`.
- Nếu process đã có `DATABASE_URL` và giá trị đó bằng `TEST_DATABASE_URL`, setup phải từ chối trừ khi explicit reset opt-in có mặt; opt-in vẫn là bắt buộc trong mọi trường hợp.
- URL/credentials không được in nguyên văn khi guard fail.
- Dedicated test database phải được provision riêng bên ngoài suite; suite không tạo database.
- Existing migrations được apply vào test database trước suite; không tạo/sửa migration.

Isolation method:

- Database tests chạy tuần tự bằng `--test-concurrency=1`.
- Global/per-file setup kiểm tra connectivity và expected Prisma models.
- Trước mỗi stateful scenario, xóa `AUTH_SESSION` trước rồi `USER` để tuân foreign key.
- Sau mỗi scenario hoặc file, cleanup lại theo cùng thứ tự trong `finally`/test hook để phục hồi cả khi assertion fail.
- Vì database dedicated chỉ dành cho suite, full cleanup hai bảng hiện có là rõ ràng và ít fragile hơn transaction wrapping qua nhiều HTTP requests/Prisma operations.
- Không dùng transaction rollback cho end-to-end HTTP flow vì application queries dùng client lifecycle riêng và không tự tham gia test-owned transaction.
- Fixture email/id sử dụng deterministic scenario prefix cộng random UUID để tránh collision khi rerun.

Multiple-session scenario dùng một user fixture, thực hiện hai login HTTP độc lập, lưu hai cookie pair trong memory, xác nhận hai persisted session hashes, logout cookie thứ nhất rồi xác nhận cookie thứ hai vẫn truy cập `/me` được.

### 3.5 Database preparation

**Decision:** tạo một test database preparation script nhỏ dùng existing Prisma CLI.

- Script đọc và validate cùng safety environment contract.
- Script chạy existing `prisma migrate deploy` với `DATABASE_URL` process-local trỏ tới `TEST_DATABASE_URL`.
- Script không tạo database, không tạo migration và không sửa schema.
- Developer/CI phải provision empty/dedicated PostgreSQL database và cung cấp variables trước.

Rationale: npm environment assignment phải hoạt động nhất quán trên Windows; Node wrapper tránh shell-specific syntax và tập trung safety guard tại một chỗ.

### 3.6 Time control

Không dùng sleep hoặc fake-clock framework.

- Session creation: ghi timestamp ngay trước/sau login, assert `expires_at` nằm trong tolerance nhỏ quanh `created_at + 7 days` hoặc request window + 7 days.
- Login cookie: assert `Max-Age=604800` từ `Set-Cookie`; không so sánh absolute `Expires` exact millisecond.
- Expired session: insert fixture trực tiếp với `expires_at` cố định trong quá khứ, rồi gọi `/me`/logout.
- Valid session: insert hoặc login với future expiry đủ xa.
- Password/session crypto không phụ thuộc wall-clock.

Cách này deterministic, không thêm fake-timer abstraction và không cần thay production code. Tolerance chỉ áp dụng cho timestamp được tạo runtime; expired behavior dùng timestamp fixture cố định nên không có timing race.

### 3.7 Parallelism

- Toàn suite mặc định chạy với `--test-concurrency=1` vì hiện tất cả database tests chia sẻ một dedicated database và reset tables.
- Subtests trong cùng database scenario không bật concurrency.
- Pure password/component tests có thể chạy nhanh nhưng vẫn theo suite sequential để sensitive-log spies và global environment không race.
- Parallelization có thể xem xét sau khi có database-per-worker isolation; không thuộc TASK-010.

### 3.8 Sensitive-data verification

HTTP assertions:

- Dùng unique synthetic password và token markers chỉ tồn tại trong test memory.
- Serialize response body/headers cần kiểm tra và assert không chứa plaintext password, `password_hash`, raw token hoặc session hash.
- Chỉ `Set-Cookie` được phép chứa raw session token; JSON/body và unrelated headers không được chứa.
- Assertion message chỉ nêu loại leak, không interpolate secret value.

Persistence assertions:

- Query database trực tiếp để xác nhận `password_hash !== plaintext` và session hash khác raw cookie token.
- Recompute SHA-256 từ cookie token trong test để xác nhận exact persisted relationship mà không in hai giá trị.

Log capture:

- Production source hiện không có Authentication logging; chỉ có startup log trong `main.js`, còn HTTP tests dùng `app.js` nên startup log không phát sinh.
- Focused helper tạm capture `console.log`, `console.info`, `console.warn`, `console.error` quanh exercised auth flow, restore trong `finally`, rồi kiểm tra captured text không chứa synthetic password/raw token.
- Suite chạy sequential để console interception không ảnh hưởng test khác.
- Không thêm logging dependency hoặc production logger chỉ để kiểm tra absence.

### 3.9 Deferred and unavailable reporting

Node test statuses được dùng như sau:

- Implemented requirement: normal pass/fail test.
- Approved but blocked by missing contract: `test.todo()` với mô tả dependency cụ thể; TODO không được báo như PASS.
- Environment prerequisite thiếu: setup fail rõ ràng đối với database suite, không silently skip persistence coverage.
- Command không tồn tại (lint/build hiện chưa có): báo `NOT AVAILABLE` trong TEST-010 report, không coi là pass.

Deferred TODO groups:

- exact final HTTP JSON response cho unexpected error;
- exact final JSON response cho malformed JSON;
- CORS allow-origin/credentials;
- CSRF mechanism;
- cookie `SameSite` và `Domain`.

Điều kiện kích hoạt: contract/error middleware hoặc deployment topology tương ứng được human approve và triển khai. Cookie attributes đã tồn tại (`session_id`, `HttpOnly`, `Path=/`, `Max-Age`, conditional `Secure`) không deferred và phải test ngay.

## 4. Affected Areas

- **Database:** reuse `USER` và `AUTH_SESSION`; không đổi schema/migration; thêm test setup/cleanup trên dedicated database.
- **Backend production:** minimal extraction từ `main.js` sang importable `app.js`; không đổi behavior.
- **API:** không đổi contract; test bốn endpoint hiện có.
- **Authentication/Authorization:** không đổi implementation; exercise existing service/middleware/controller/role middleware.
- **Frontend/UI:** không ảnh hưởng.
- **Tests:** tạo infrastructure, helpers, HTTP/database integration và focused component suites.
- **Package scripts:** thay placeholder bằng runnable commands; không thêm dependency.
- **Documentation:** thêm test usage/deferred-contract documentation; chưa đổi feature status thành DONE.

## 5. Existing Code to Reuse

- `backend/src/routes/auth-routes.js` — route definitions và middleware order.
- `backend/src/controllers/auth-controller.js` — HTTP response/cookie behavior và focused error propagation target.
- `backend/src/services/authentication-service.js` — business flow, normalization, session lifecycle.
- `backend/src/middleware/authentication-middleware.js` — `/me` authentication boundary.
- `backend/src/middleware/role-authorization-middleware.js` — focused USER/ADMIN/unknown-role tests.
- `backend/src/repositories/user-repository.js` — real Prisma access trong integration tests.
- `backend/src/repositories/auth-session-repository.js` — real session persistence trong integration tests.
- `backend/src/utils/password-security.js` — direct focused security tests và hash verification.
- `backend/prisma/schema.prisma` — existing test database schema source.
- `backend/prisma/migrations/20260916042441_init_user_auth_session/migration.sql` — existing migration applied to test database.
- Node 22 built-ins — runner, assertions, fetch, crypto, UUID, child process và server lifecycle.

## 6. Planned File Changes

### CREATE

`backend/src/app.js`

- Export `createApp({ prisma })`.
- Move existing dependency composition, middleware/router registration và health route từ `main.js`.
- Không listen và không thay Authentication behavior.

`backend/test/helpers/test-environment.js`

- Validate `TEST_DATABASE_URL` and explicit reset opt-in.
- Set controlled `NODE_ENV=test`/process-local database URL before dynamic imports.
- Redact URLs in errors.

`backend/test/helpers/test-database.js`

- Create/disconnect test Prisma client.
- Reset `AUTH_SESSION` then `USER`.
- Provide minimal direct-query helpers needed for evidence; không duplicate repositories.

`backend/test/helpers/http-test-server.js`

- Start/stop Express app on `127.0.0.1:0`.
- Send JSON/raw requests, parse JSON safely, inspect `Set-Cookie`, forward cookie pair.

`backend/test/helpers/auth-fixtures.js`

- Generate unique emails and approved user/session fixtures.
- Keep fixture creation explicit; không tạo broad fixture framework.

`backend/test/scripts/prepare-test-database.js`

- Reuse safety validation.
- Apply existing migrations to dedicated test database through existing Prisma CLI.

`backend/test/auth/auth-http.test.js`

- Primary four-endpoint HTTP flows and observable contract.
- Database assertions adjacent to flows when needed to prove persistence effects.

`backend/test/auth/auth-components.test.js`

- Focused Authentication Service, Authentication Middleware, Auth Controller error propagation và Role Authorization scenarios not efficiently proven through public HTTP routes.

`backend/test/auth/password-security.test.js`

- Password policy/hash/verify/format/constant-time edge cases.

`backend/test/auth/deferred-contracts.test.js`

- Explicit `test.todo()` entries for centralized-error and topology-dependent contracts; no false PASS.

`backend/test/README.md`

- Required environment variables, dedicated database warning, preparation/run commands, cleanup behavior and deferred items.

`backend/.env.test.example`

- Placeholder names only: `TEST_DATABASE_URL`, `TEST_DATABASE_ALLOW_RESET`; no credentials/secrets.

### MODIFY

`backend/src/main.js`

- Keep Prisma creation and startup.
- Import/use `createApp({ prisma })`.
- Preserve `PORT`, health route behavior, routes and startup log behavior.

`backend/package.json`

- Replace placeholder `test` command.
- Add Authentication-only and test-database preparation commands.
- No dependency changes.

Planned scripts:

- `test`: `node --test --test-concurrency=1`
- `test:auth`: `node --test --test-concurrency=1 test/auth`
- `test:db:prepare`: run the Node database-preparation wrapper.

Exact script path syntax must be verified on Node 22/Windows during implementation; behavior and command names above are fixed by this PLAN.

### EXPECTED UNCHANGED

- `backend/package-lock.json` — no dependency change, so no lockfile modification expected.
- `backend/prisma/schema.prisma`.
- `backend/prisma/migrations/*`.
- Authentication routes, controller, service, repositories, middleware and password utility behavior.
- `docs/API_SPEC.md`, `docs/DATABASE.md`, `docs/ARCHITECTURE.md`, `docs/PROJECT_OVERVIEW.md`, `docs/UI_UX_SPEC.md`.
- Frontend files.
- TASK-009 artifacts.
- `docs/FEATURE_STATUS.md` during PLAN/IMPLEMENT; status update only after later TEST + REVIEW + human approval when appropriate.

If implementation requires changing an expected-unchanged production component or API behavior, TASK-010 must stop and return to PLAN/SPEC approval rather than expand scope.

## 7. Test Layer Allocation and Scenario Groups

### 7.1 HTTP/API + database integration — `auth-http.test.js`

Registration:

- valid registration response, no cookie/no auto-login;
- normalized email persistence and default fields;
- password hash persistence/metadata and no plaintext;
- missing/wrong-type/empty fields and short password;
- duplicate email after normalization;
- simulated concurrent duplicate requests proving one success/one conflict and one user record;
- failed requests leave no session/partial user state.

Login:

- active-user success response and public identity shape;
- `session_id` cookie name and current attributes;
- 32-byte decoded raw token, SHA-256 persisted hash, 7-day expiry tolerance;
- raw token and sensitive field exclusion;
- lowercase lookup;
- unknown email/wrong password/inactive account have identical public response and no new session/cookie;
- missing/non-string credentials use current `401` contract;
- two login requests create two independent sessions.

Current user:

- valid USER and ADMIN sessions;
- missing, empty, malformed, unknown, expired and deleted session;
- session linked to inactive user;
- identity comes from server-side session despite client-controlled identity/role values;
- rejected request does not produce success/controller response.

Logout:

- valid current-session deletion, cookie clear and empty `204` response;
- second session remains valid;
- missing, malformed, unknown, expired, deleted and repeated logout remain idempotent;
- raw token/session details absent from response.

End-to-end regression:

- register → login → `/me` → logout → `/me` rejected;
- health route remains available after app extraction;
- unsupported method/path behavior from TASK-009 remains unchanged where relevant.

### 7.2 Focused components — `auth-components.test.js`

Authentication Service:

- Prisma-style `P2002` create race maps to `EMAIL_ALREADY_EXISTS`;
- logout delete race `P2025` remains idempotent;
- unexpected repository/password error propagates;
- expired/missing/deleted session behavior with deterministic stub state;
- current-session-only deletion and multiple-session semantics where HTTP/database test does not expose internal call selection clearly.

Authentication Middleware:

- valid identity assigned to `req.user` before `next()`;
- known auth failure maps `401` and does not call downstream handler;
- unexpected service error calls `next(error)` unchanged;
- client body/query/header identity cannot create/replace `req.user`.

Auth Controller:

- unexpected logout persistence error clears cookie then calls `next(error)`;
- unexpected register/login error calls `next(error)`;
- no exact final HTTP error-body assertion without centralized handler.

Role Authorization Middleware:

- allowed USER and ADMIN;
- USER denied on Admin-only rule with `403/FORBIDDEN`;
- unknown role denied even if included in `allowedRoles`;
- missing `req.user` forwarded as composition error;
- client-supplied role outside authenticated `req.user` ignored.

Sensitive output:

- capture console methods around representative success/failure component flows;
- assert synthetic password/raw token absent;
- always restore console functions.

### 7.3 Password primitives — `password-security.test.js`

- minimum boundary: length 7 reject, length 8 accept;
- hash/verify success and wrong/non-string password failure;
- salted hashes differ for same plaintext while both verify;
- serialized scrypt metadata and safe configured parameters;
- malformed algorithm/parts/base64/parameter/size rejection with `PASSWORD_HASH_INVALID`;
- unsafe/unbounded parameter rejection before derivation;
- constant-time helper true for equal buffers, false for content mismatch, length mismatch and non-buffer input.

### 7.4 Deferred contracts — `deferred-contracts.test.js`

Use explicit TODO, each linked to approval prerequisite:

- malformed JSON final JSON contract — requires centralized error-handler contract;
- unexpected HTTP error final JSON contract — requires centralized error-handler contract;
- CORS/credential policy — requires approved deployment origins/topology;
- CSRF behavior — requires approved same-site/cross-site decision and mechanism;
- cookie `SameSite`/`Domain` — requires approved deployment topology.

These TODOs are visible but are not counted as passing evidence for current implemented behavior.

## 8. Acceptance Criteria Traceability

| AC | Boundary | Planned scenario/group | Dependency / fixture | Expected evidence |
|---|---|---|---|---|
| AC-01 | HTTP integration | Route-specific register/login/logout/me plus end-to-end flow | Importable app, ephemeral server, test DB | All four endpoints exercised through real Express HTTP boundary |
| AC-02 | HTTP + DB | Valid registration | Unique email/password fixture | `201`, exact success body, one USER with normalized/default values, zero sessions, no Set-Cookie |
| AC-03 | HTTP + DB/component | Invalid inputs; normalized duplicate; P2002 race | Invalid payload matrix, duplicate fixture/stub | `400/VALIDATION_ERROR` or `409/EMAIL_ALREADY_EXISTS`; no unintended state |
| AC-04 | DB + password component | Persisted hash and direct verify/metadata tests | Registered user; password utility | Hash differs from plaintext, parses safely and verifies only correct password |
| AC-05 | HTTP | Valid active login | Active user fixture | `200`, exact public identity, approved `session_id` attributes |
| AC-06 | HTTP + DB | Session creation and expiry | Valid user; before/after timestamps | Decoded token is 32 bytes, stored value is matching SHA-256 only, expiry ~7 days |
| AC-07 | HTTP + DB | Unknown email, wrong password, inactive user | Three controlled users/states | Identical `401/AUTHENTICATION_FAILED`, no cookie, session count unchanged |
| AC-08 | HTTP + DB | Two independent logins | One active user | Two different cookies and two session hashes remain valid |
| AC-09 | HTTP + DB | `/me` for USER and ADMIN | Two role fixtures and sessions | `200` public identity matches persisted session owner |
| AC-10 | HTTP + DB | Missing/malformed/unknown/expired/deleted/inactive-user sessions | Direct session fixtures | Each returns same `401/AUTHENTICATION_FAILED` |
| AC-11 | HTTP + component | Send fake identity/role with valid session; middleware source check | Valid session plus malicious body/query/header | Returned/downstream identity remains persisted session owner |
| AC-12 | HTTP + DB | Logout first of two sessions | Two-session fixture | First row deleted, cookie cleared, `204` empty; second `/me` still succeeds |
| AC-13 | HTTP + DB/component | Missing/malformed/expired/unknown/deleted/repeated logout; P2025 | Session-state matrix | Every idempotent case returns `204`, clears cookie and preserves unrelated sessions |
| AC-14 | Component | Role middleware matrix | `req.user` fixtures and response spy | Allowed roles call next; disallowed/unknown return `403/FORBIDDEN`; client role ignored |
| AC-15 | HTTP + DB + log capture | Sensitive-field scan and persistence relation | Unique synthetic secrets | No secret in public output/log; only cookie carries raw token; DB stores hashes only |
| AC-16 | HTTP + component | Known error mappings and injected unexpected failures | Service/repository stubs | Known exact status/body; unexpected error object reaches `next` unchanged |
| AC-17 | Infrastructure + repeat run | Reset hooks, unique fixtures, sequential execution | Dedicated DB and safety opt-in | Two consecutive full runs pass with no residual rows/order dependency |
| AC-18 | Runner/reporting | Intentional runner behavior and TODO inventory | `node:test`, setup guards | Exit 0 only when runnable tests pass; failures non-zero; TODO/unavailable explicitly separate |
| AC-19 | Review of suite allocation | Coverage ownership by highest useful boundary | Traceability matrix | No repository/private-helper tests without security evidence; no redundant layer matrix |
| AC-20 | Git diff + regression | Scope verification and current API regression | Baseline source/docs | Only planned app-boundary/package/test/docs changes; API/schema/behavior unchanged |

## 9. API Contract Preservation

No API contract changes are planned.

The suite asserts current approved behavior:

- `POST /api/auth/register`: `201`, registration success JSON; `400` validation; `409` duplicate.
- `POST /api/auth/login`: `200`, `data.user`, `session_id` cookie; `401` invalid/inactive/missing credentials per current contract.
- `POST /api/auth/logout`: idempotent `204`, no body, clear cookie.
- `GET /api/auth/me`: `200` with `data` public identity; `401` invalid authentication.

Known discrepancies from SPEC-010 remain recorded and are not silently fixed by tests:

- API documentation `username` example versus approved `display_name`.
- Generic error example `details` versus current Authentication error body.
- Logout access wording versus approved idempotent cleanup behavior.
- Missing centralized final HTTP error contract.

## 10. Database and Fixture Lifecycle

### Preconditions

1. Developer/CI provisions a PostgreSQL database used only for tests.
2. `TEST_DATABASE_URL` points to that database.
3. `TEST_DATABASE_ALLOW_RESET=true` explicitly authorizes cleanup.
4. `npm run test:db:prepare` applies existing migrations.

### Per-suite lifecycle

1. Validate environment before importing Prisma-bound application modules.
2. Create one Prisma client for the test process/file lifecycle.
3. Confirm connection.
4. Reset sessions then users.
5. Start app/server only after database readiness.
6. Execute sequential scenarios; reset around each stateful scenario.
7. Close HTTP server.
8. Final reset in teardown.
9. Disconnect Prisma even after failure.

### Fixture principles

- Use actual password utility for persisted user fixtures unless a test specifically targets malformed hash.
- Use Prisma direct insertion only to create states unavailable via public API: ADMIN, inactive user, expired/deleted session, corrupt hash.
- Use public HTTP endpoints for normal user registration/login/logout flows.
- Never add test-only endpoint or production backdoor.
- Do not store real credentials in fixtures or repository.

## 11. Commands and Scripts

Planned developer/CI workflow from `backend/`:

1. Configure `TEST_DATABASE_URL` and `TEST_DATABASE_ALLOW_RESET=true` outside source control.
2. Prepare schema:

```text
npm run test:db:prepare
```

3. Run full backend suite:

```text
npm test
```

4. Run Authentication suite only:

```text
npm run test:auth
```

Runner behavior:

- runnable assertion failure or unsafe/missing database configuration → non-zero exit;
- all runnable tests pass and only explicitly approved TODOs remain → zero exit with TODO count visible;
- no silent skip for database tests;
- repeated `npm test` must produce the same result.

Current repository has no build/lint scripts. TEST-010 must report them as `NOT AVAILABLE`; it must not invent a passing result.

## 12. Centralized Error Handler Plan

### Test now

- Known service errors mapped by Auth Controller.
- Authentication Middleware known failure response.
- Role Authorization known forbidden response.
- Controller/service/middleware call `next(error)` or reject with the original unexpected error.
- Logout clears cookie before forwarding unexpected error.

### Deferred

- Final HTTP status/body/content type for unexpected error.
- Final HTTP status/body/content type for malformed JSON parser error.

Reason: Express default handling is not the approved centralized JSON contract, and no approved error-handler implementation exists. TASK-010 must add visible TODO entries, not expected-pass assertions against a temporary/default response.

Activation condition: a separately approved centralized error handler defines and implements the final contract. At that point TODOs become normal HTTP integration tests.

PLAN-010 does not add or modify an error handler.

## 13. CORS, CSRF and Cookie Topology

### Test now

- Cookie name `session_id`.
- `HttpOnly`.
- `Path=/`.
- `Max-Age=604800`.
- `Secure` present when `NODE_ENV=production` or request is secure according to current controller behavior.
- Logout clear-cookie targets the same name/path.
- Raw token absent from JSON/frontend-style storage contract.

### Deferred

- `SameSite`.
- `Domain`.
- CORS origin/credentials headers.
- CSRF token/origin protection behavior.

No policy/library/value is selected until deployment topology is approved. Deferred entries remain visible as TODO and are not PASS.

## 14. Implementation Sequence

1. **Establish scripts and safety contract**
   - Replace placeholder test script and add `test:auth`/`test:db:prepare` commands.
   - Add `.env.test.example` and test README without secrets.
   - Verify runner discovers a minimal temporary infrastructure check, then remove any scaffold not part of final suite.

2. **Extract importable Express app boundary**
   - Create `src/app.js` from current composition/registration.
   - Reduce `main.js` to Prisma creation + app creation + listen.
   - Verify `npm start`/health route and static imports behave as before.

3. **Implement protected test environment and database preparation**
   - Add URL/reset guards and redacted errors.
   - Add migration preparation wrapper using existing Prisma CLI.
   - Prove refusal when opt-in/config is missing before any cleanup.

4. **Implement lifecycle/helpers**
   - Database client/reset lifecycle.
   - Ephemeral HTTP server/fetch/cookie helper.
   - Minimal auth fixtures.

5. **Implement password-security focused tests**
   - Establish fast, database-independent confidence in security primitives and runner.

6. **Implement primary HTTP/database Authentication suite**
   - Registration, login, `/me`, logout and end-to-end flow.
   - Add persistence assertions adjacent to each flow.
   - Add multiple-session and identity-boundary scenarios.

7. **Implement focused component/error/role tests**
   - Cover `next(error)`, P2002/P2025, role edges and sensitive log capture without duplicating HTTP success matrices.

8. **Add deferred-contract TODO inventory**
   - Centralized errors and topology-dependent behavior only.

9. **Verification and repeatability run**
   - Prepare dedicated test DB.
   - Run Authentication suite twice.
   - Run full backend suite.
   - Confirm cleanup and no leaked secrets.
   - Inspect diff for scope/API/schema invariance.

10. **TEST-010 handoff**
   - Record commands, pass/fail/TODO counts and unavailable lint/build.
   - Do not update feature to DONE before REVIEW + human approval.

## 15. Verification Strategy

### Automated verification

- `npm run test:db:prepare` succeeds only against explicitly authorized dedicated test DB.
- `npm run test:auth` returns zero only when all runnable Authentication tests pass.
- Run `npm run test:auth` twice consecutively to prove cleanup/repeatability.
- `npm test` runs the full discovered backend suite and returns zero under the same conditions.

### Database safety verification

- Missing `TEST_DATABASE_URL` fails before Prisma application import/cleanup.
- Missing or non-true reset opt-in fails before delete/migrate action.
- Error output redacts connection URL/credentials.
- After suite teardown, `AUTH_SESSION` and `USER` contain no suite fixture rows in the dedicated database.
- No command targets configured development/production database implicitly.

### Regression verification

- Health endpoint still returns its current response.
- Four Authentication endpoint methods/paths and middleware behavior remain unchanged.
- `npm start` still starts on configured/default port.
- Prisma schema/migration diff is empty.
- Authentication production modules other than mechanical app composition remain unchanged.
- Package lock remains unchanged because no dependency is installed.

### Security verification

- Response/header/body scans and log capture find no prohibited sensitive data.
- Database assertions prove hash-only persistence.
- Test failure messages do not print synthetic secrets.
- Unknown/inactive/wrong-password login responses are structurally identical.

### Unavailable checks

- Backend build: `NOT AVAILABLE` unless a build script exists by TEST-010 for an independently approved reason.
- Backend lint: `NOT AVAILABLE` unless a lint script exists by TEST-010 for an independently approved reason.
- These absences do not become silent PASS.

## 16. Documentation Impact

- Create `backend/test/README.md` for executable test-environment instructions and deferred contract list.
- Do not change API/database/architecture documentation because PLAN-010 does not change those contracts.
- Keep SPEC-010 as approved source of truth; do not rewrite it during implementation.
- `FEATURE_STATUS.md` remains `IN_PROGRESS`. Any later test history/status update occurs only after TEST-010/REVIEW-010 and human approval according to workflow.

## 17. Risks and Mitigations

### Dedicated database misconfiguration

- **Risk:** destructive cleanup points to non-test data.
- **Mitigation:** require separate variable plus explicit reset opt-in, validate before import/action, redact errors, document dedicated-only prerequisite.

### App extraction changes startup behavior

- **Risk:** middleware/route order or singleton composition changes accidentally.
- **Mitigation:** mechanical move only, health/routing regression tests, diff review against TASK-009 dependency graph.

### Native fetch cookie handling

- **Risk:** fetch does not maintain a browser cookie jar automatically.
- **Mitigation:** explicit single-cookie extraction/forwarding helper; inspect all `Set-Cookie` values and avoid general cookie abstraction.

### Time assertions become flaky

- **Risk:** exact timestamp equality races.
- **Mitigation:** fixed past fixtures for expiration, Max-Age assertion, bounded request-window tolerance for generated expiry, no sleep.

### Shared global state in tests

- **Risk:** console capture/environment/database reset races.
- **Mitigation:** `--test-concurrency=1`, no concurrent stateful subtests, restore globals in `finally`.

### Test locks implementation details

- **Risk:** excessive repository/helper mocking makes safe refactors fail.
- **Mitigation:** HTTP boundary owns normal behavior; component tests limited to approved security/error invariants; no Prisma call-order assertions unless required for state correctness.

### Deferred items appear complete

- **Risk:** TODO tests are mistaken for passing coverage.
- **Mitigation:** separate deferred file/README section and TEST-010 counts; never label deferred item PASS.

## 18. Scope Validation

- No new Authentication feature, role or endpoint.
- No API, database schema or migration change.
- No frontend work.
- No test framework dependency.
- No centralized error handler implementation.
- No CORS/CSRF/SameSite/Domain decision.
- No TASK-009 rework.
- Only one narrowly scoped production refactor: importable app factory with unchanged behavior.
- Testing strategy directly traces every SPEC-010 acceptance criterion.

## 19. Open Questions / Non-Blocking Preconditions

No unresolved business or API decision blocks PLAN-010.

Implementation prerequisites controlled by the developer/CI environment:

- provision a dedicated PostgreSQL test database;
- supply `TEST_DATABASE_URL` without committing it;
- explicitly set `TEST_DATABASE_ALLOW_RESET=true` only for that database.

The following remain intentionally deferred because their governing contracts are not approved:

- centralized final HTTP response for unexpected/malformed JSON errors;
- deployment-dependent CORS, CSRF, `SameSite` and `Domain` behavior.

TASK-010 can be authored directly from this PLAN without resolving those deferred contracts; it must preserve them as visible TODOs and must not invent expected behavior.

## 20. PLAN Completion Checklist

- [x] SPEC-010 approval confirmed.
- [x] Current feature status and implementation inspected.
- [x] Test runner selected with repository-specific rationale.
- [x] HTTP mechanism selected without new dependency.
- [x] Importable Express boundary defined with minimal production change.
- [x] Dedicated database/isolation/cleanup safety strategy defined.
- [x] Deterministic time strategy defined without sleep.
- [x] HTTP, database and focused component responsibilities separated.
- [x] Sensitive-data response/persistence/log strategy defined.
- [x] Sequential execution and repeatability strategy defined.
- [x] Deferred/unavailable reporting defined without false PASS.
- [x] Centralized error-handler discrepancy handled without scope expansion.
- [x] CORS/CSRF/topology remains deferred.
- [x] AC-01 through AC-20 traced to planned evidence.
- [x] CREATE/MODIFY/unchanged files identified.
- [x] Commands and implementation order defined.
- [x] No implementation/test code written and no dependency installed.
- [x] TASK-010 not created.

## Approval Gate

```text
PLAN-010: READY FOR HUMAN REVIEW
TASK-010: NOT STARTED
IMPLEMENTATION: NOT STARTED
TEST-010: NOT STARTED
```

Human approval is required before proceeding to TASK-010.
