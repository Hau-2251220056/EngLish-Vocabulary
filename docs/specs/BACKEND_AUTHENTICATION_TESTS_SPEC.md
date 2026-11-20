# SPEC-010: Backend Authentication Tests

**Giai đoạn workflow:** SPEC
**Feature status:** `IN_PROGRESS`
**SPEC status:** `READY FOR HUMAN REVIEW`

## Existing Implementation

Authentication backend foundation và HTTP integration đã được triển khai qua TASK-009.

- Express mount đúng bốn endpoint tại `/api/auth`.
- Backend sử dụng stateful server-side session lưu trong PostgreSQL qua Prisma.
- Raw session token 32 byte được gửi bằng cookie `session_id`; database chỉ lưu SHA-256 hash.
- Authentication Service xử lý register, login, logout và current-user lookup.
- Authentication Middleware xác thực cookie và gắn public identity vào `req.user`.
- Role Authorization Middleware hỗ trợ đúng hai role `USER` và `ADMIN`.
- Auth Controller chịu trách nhiệm HTTP status, response body và set/clear cookie.
- `USER` và `AUTH_SESSION` đã tồn tại trong Prisma schema và migration hiện tại.
- Các verification inline của TASK-005 đến TASK-009 đã được ghi nhận trong `FEATURE_STATUS.md`, nhưng repository chưa có persistent automated test suite.
- `backend/package.json` vẫn có script `npm test` dạng placeholder và không có test framework/library trong dependencies.

SPEC-010 không mở lại TASK-009 và không thay đổi behavior production hiện có.

## 1. Objective

Xác định các behavior backend Authentication phải được chứng minh bằng một automated, repeatable test suite trước khi backend Authentication có thể được xem là đã kiểm thử đầy đủ.

Test suite phải ưu tiên observable contract tại Express HTTP boundary, đồng thời kiểm tra có chọn lọc các security invariant và persistence effect không thể chứng minh đầy đủ chỉ qua response HTTP.

SPEC này định nghĩa **WHAT must be proven**. Test runner, HTTP test client, database isolation mechanism, file layout và cách tạo fixture thuộc PLAN-010.

## 2. Actors and Security Subjects

### Guest

- Có thể register và login.
- Có thể gọi logout theo behavior idempotent mà không bị hard-`401`.
- Không thể lấy current-user identity qua `/api/auth/me` nếu không có valid session.

### USER

- Có thể login, logout và lấy current-user identity của chính mình.
- Có thể qua role authorization khi endpoint cho phép `USER`.
- Không thể qua Admin-only authorization.

### ADMIN

- Dùng cùng Authentication flow với `USER`.
- Có thể lấy current-user identity của chính mình.
- Có thể qua role authorization khi endpoint cho phép `ADMIN`.

### Backend/Test Environment

- Backend là nguồn xác lập identity, account status và role.
- Client-supplied `user_id`, `owner_id`, `role` hoặc identity data không được thay thế identity lấy từ valid server-side session.

## 3. Scope

### In Scope

- Automated backend tests cho:
  - `POST /api/auth/register`;
  - `POST /api/auth/login`;
  - `POST /api/auth/logout`;
  - `GET /api/auth/me`.
- Registration validation, normalization, duplicate handling và persistence effects.
- Password policy, hashing, verification và serialized hash metadata.
- Login success; invalid, missing và inactive-account credentials.
- Session generation, hashing, persistence, expiration và multiple-session behavior.
- Cookie set/clear behavior và raw-token exclusion khỏi JSON/database/log output quan sát được trong test.
- Authentication Middleware behavior.
- Role Authorization Middleware behavior cho `USER` và `ADMIN`.
- Authenticated identity boundary.
- Known-error mapping và unexpected-error propagation của các Authentication components hiện có.
- Test isolation, repeatability và controlled time/state requirements.
- Ghi nhận deployment-dependent CORS/CSRF/cookie topology behavior chưa thể chốt trước khi topology được xác minh.

### Testing Boundary

- HTTP/API integration tests là boundary chính cho endpoint, middleware order, status, body, cookie và end-to-end Authentication state.
- Database-dependent integration tests chỉ cần dùng khi phải chứng minh persistent effects hoặc security invariant như password hash, session hash, expiration và current-session deletion.
- Focused unit/component tests chỉ cần dùng cho behavior khó quan sát ổn định qua HTTP hoặc cần kiểm soát dependency/time, gồm password-security primitives, service edge cases, middleware error propagation và role authorization.
- Không yêu cầu duplicate test ở mọi layer nếu một test ở boundary cao hơn đã chứng minh cùng behavior một cách deterministic và đủ rõ.
- Repository query syntax hoặc private helper implementation không phải contract cần khóa cứng bằng test, trừ khi cần chứng minh một security/data invariant đã được phê duyệt.

### Out of Scope

- Frontend Authentication, UI, auth state, navigation hoặc frontend tests.
- Endpoint mới hoặc thay đổi API contract.
- Sửa/refactor production code chỉ để test dễ hơn.
- Thay đổi Authentication architecture, cookie/session mechanism hoặc session lifetime.
- JWT, refresh token, OAuth/social login, MFA, password reset, email verification.
- Logout-all-devices, device/session history hoặc account management.
- Resource-specific ownership rules của domain khác.
- Rate limiting, penetration testing, load/performance testing hoặc security audit toàn hệ thống.
- Production deployment/configuration changes.
- Database schema hoặc migration mới.
- CORS/CSRF implementation khi deployment topology chưa được xác minh.
- Chọn/cài Jest, Vitest, Mocha, Supertest hoặc bất kỳ test dependency cụ thể nào trong SPEC.
- Khôi phục hoặc viết lại các inline verification của TASK-005 đến TASK-009 chỉ để tăng số lượng test.

## 4. Authentication Behaviors to Prove

### 4.1 Registration

- Request hợp lệ dùng `display_name`, `email`, `password` trả `201 Created` với:

```json
{
  "success": true,
  "message": "Registration successful"
}
```

- Registration không set session cookie và không auto-login.
- Email được lowercase trước lookup và persistence.
- Email trùng sau lowercase normalization trả `409 Conflict` với code `EMAIL_ALREADY_EXISTS`.
- Required value thiếu, sai type, chuỗi bắt buộc rỗng hoặc password ngắn hơn 8 ký tự trả `400 Bad Request` với code `VALIDATION_ERROR`.
- User mới có database defaults đã phê duyệt: role `USER`, `is_active = true`, `total_xp = 0`, `daily_xp_goal = 50`.
- Password được lưu dưới dạng scrypt hash có metadata; plaintext password không được persist hoặc trả trong HTTP response.
- Duplicate-email race được database unique constraint bảo vệ và được map về cùng public conflict behavior khi Prisma trả `P2002`.

SPEC-010 không tự bổ sung email-format, trim-whitespace hoặc giới hạn `display_name` mới vì implementation contract hiện chỉ yêu cầu string không rỗng và lowercase email.

### 4.2 Login

- Email/password hợp lệ của active user trả `200 OK`.
- Response chứa đúng public identity dưới `data.user`: `id`, `email`, `display_name`, `role`.
- Login set duy nhất credential cookie tên `session_id` với `HttpOnly`, `Path=/`, lifetime 7 ngày và `Secure` khi request/production context yêu cầu theo implementation hiện tại.
- JSON response không chứa raw session token, password, `password_hash`, `session_identifier_hash` hoặc `expires_at`.
- Mỗi login thành công tạo một session mới; nhiều session của cùng user có thể đồng thời tồn tại.
- Raw token có 32 random bytes trước base64url encoding; database chỉ lưu unique SHA-256 hash, không lưu raw token.
- Session `expires_at` tương ứng lifetime 7 ngày theo approved contract.
- Email lookup dùng lowercase normalization.
- Email không tồn tại, password sai và account inactive cùng trả `401 Unauthorized`, code/message public giống nhau và không tiết lộ account state.
- Missing hoặc non-string login credential cũng dùng public invalid-credentials behavior hiện tại (`401`), không được tự đổi thành registration-style validation behavior trong SPEC-010.
- Login failure không tạo session và không set authentication cookie.

### 4.3 Logout

- `POST /api/auth/logout` không dùng hard-`401` Authentication Middleware.
- Valid cookie xóa đúng current session và clear cookie `session_id` tại `Path=/`.
- Session khác của cùng user không bị xóa.
- Missing, empty, malformed, unknown, expired hoặc already-deleted session vẫn trả `204 No Content`, clear cookie và không có response body.
- Logout lặp lại là idempotent.
- Raw token/session data không xuất hiện trong response.
- Nếu unexpected persistence error xảy ra, controller vẫn clear cookie và forward error; SPEC không tự định nghĩa response body cuối cùng khi centralized error handler chưa tồn tại.

### 4.4 Current User

- Valid, unexpired session của active `USER` hoặc `ADMIN` trả `200 OK`.
- Response chứa public identity trực tiếp dưới `data`: `id`, `email`, `display_name`, `role`.
- Identity được lấy từ session → persisted user, không từ body, query, params, headers hoặc client-supplied identity/role values.
- Missing, empty, malformed, unknown, expired hoặc deleted session trả `401 Unauthorized` với code `AUTHENTICATION_FAILED`.
- Session của missing hoặc inactive user cũng bị từ chối bằng cùng public behavior.
- Protected request không đi tới current-user controller khi Authentication Middleware đã từ chối credential.
- Authentication Middleware forward unexpected service error bằng `next(error)` thay vì đổi thành Authentication failure.

### 4.5 Role Authorization

- Middleware cho phép request khi authenticated role nằm trong `allowedRoles` và role thuộc tập approved `USER`/`ADMIN`.
- Authenticated `USER` bị trả `403 Forbidden` trên Admin-only policy.
- Authenticated `ADMIN` được tiếp tục trên Admin-only policy.
- Unknown/unapproved role bị trả `403 Forbidden` dù có xuất hiện trong `allowedRoles` đầu vào.
- Role lấy từ authenticated `req.user`; client-supplied role không phải security authority.
- Nếu role middleware bị gọi mà không có authenticated `req.user`, nó forward programming/composition error thay vì giả lập authenticated identity.

### 4.6 Password Security

- Password dưới 8 ký tự bị từ chối.
- Password hợp lệ tạo scrypt hash có salt và parameter metadata theo implementation contract.
- Cùng plaintext password không bắt buộc tạo cùng serialized hash vì salt phải random.
- Correct password verify thành công; wrong hoặc non-string password verify thất bại theo contract.
- Malformed/unsafe serialized hash bị từ chối bằng `PASSWORD_HASH_INVALID` thay vì được chấp nhận hoặc gây unbounded scrypt work.
- Constant-time comparison helper không coi buffer khác độ dài/type là bằng nhau.

## 5. Persistence and State Requirements

- Test phải chứng minh successful registration tạo đúng một `USER` và không tạo `AUTH_SESSION`.
- Failed registration không tạo partial user/session state.
- Successful login tạo đúng một `AUTH_SESSION` gắn với đúng user.
- Failed login không tạo session.
- Persisted session identifier là SHA-256 hash dài 64 hex characters và khác raw cookie token.
- Expired session không được coi là authenticated.
- Valid logout xóa đúng current session; missing/invalid logout không xóa session không liên quan.
- Multiple-session tests phải chứng minh logout một session không revoke session còn lại.
- Test data phải dùng environment/database state dành cho test hoặc isolation tương đương; không được làm ô nhiễm development/production data.

## 6. Test Isolation and Repeatability

- Suite phải chạy lại được với cùng expected results, kể cả sau một lần chạy thành công hoặc thất bại.
- Test không phụ thuộc dữ liệu còn sót từ lần chạy trước.
- Test không phụ thuộc thứ tự thực thi, trừ flow nhiều bước được cô lập rõ trong cùng một test/scenario.
- Mỗi test/scenario kiểm soát user, session, cookie và database records mà nó sử dụng.
- Email/identifier fixture phải tránh collision khi suite chạy lại hoặc chạy song song.
- Time-dependent behavior như 7-day expiration và expired session phải deterministic; cơ chế clock control được quyết định trong PLAN-010.
- Random token assertions kiểm tra invariant (entropy source/decoded length/hash relationship), không khóa cứng một token cụ thể.
- Suite không được gửi request đến production service hoặc sử dụng production database.
- Secrets, raw password, raw session token hoặc password/session hash không được in trong test report/log khi test pass hoặc fail.
- Cleanup/rollback/reset/fixture/mocking strategy cụ thể thuộc PLAN-010.

## 7. Test Environment Expectations

- Node.js/runtime phải tương thích với backend hiện tại.
- Test command phải có exit code `0` khi pass và non-zero khi fail.
- Test suite phải chạy được từ documented backend command sau khi PLAN/TASK được phê duyệt và implementation hoàn tất.
- Environment phải cung cấp controlled `NODE_ENV` và database configuration khi database integration được chạy.
- Test setup phải fail clearly nếu vô tình trỏ tới production database hoặc thiếu required test configuration.
- Không giả định `npm test` hiện hoạt động; hiện tại script là placeholder.
- Không giả định test framework, HTTP client hoặc database-reset strategy đã tồn tại.
- Build/lint chỉ được chạy nếu project có command tương ứng; command không tồn tại phải được báo `NOT AVAILABLE`, không được coi là pass.

## 8. Error and Security Expectations

- Known Authentication errors phải giữ đúng status/code/message đã được implementation phê duyệt.
- Invalid login variants phải có cùng public response để tránh account-state disclosure.
- HTTP response không được chứa password, password hash, raw session token hoặc persisted session hash.
- Captured application output trong exercised Authentication flows không được chứa plaintext password hoặc raw session token.
- Unexpected dependency errors phải được forward tới Express error boundary; suite không được bắt controller/service nuốt lỗi.
- Malformed JSON request behavior và final unexpected-error JSON response chưa thể có exact assertion cho đến khi centralized error handling contract được giải quyết.
- CORS, `SameSite`, `Domain` và CSRF assertions chỉ trở thành required khi deployment topology được xác minh và contract tương ứng được phê duyệt; không được đoán policy trong SPEC-010.

## 9. Acceptance Criteria

- **AC-01:** Automated suite có coverage cho cả bốn Authentication endpoints qua observable HTTP behavior.
- **AC-02:** Valid registration trả `201`, tạo đúng user defaults, lưu normalized email và không tạo session/cookie.
- **AC-03:** Invalid registration trả `400/VALIDATION_ERROR`; duplicate normalized email trả `409/EMAIL_ALREADY_EXISTS`.
- **AC-04:** Persisted password là valid scrypt serialized hash, verify đúng password và không bằng plaintext.
- **AC-05:** Valid active-user login trả `200`, public identity đúng và set cookie `session_id` theo approved attributes hiện có.
- **AC-06:** Login tạo session token 32 byte, chỉ persist unique SHA-256 hash và đặt expiration 7 ngày.
- **AC-07:** Email không tồn tại, wrong password và inactive account trả cùng `401/AUTHENTICATION_FAILED` public response và không tạo session.
- **AC-08:** Hai login hợp lệ tạo hai session độc lập cho cùng user.
- **AC-09:** Valid `/me` trả persisted identity của đúng session owner cho cả role `USER` và `ADMIN`.
- **AC-10:** Missing, malformed, unknown, expired, deleted hoặc inactive-user session bị `/me` từ chối bằng `401/AUTHENTICATION_FAILED`.
- **AC-11:** Client-supplied identity/role values không thay đổi identity xác lập từ server-side session.
- **AC-12:** Valid logout xóa chỉ current session, clear cookie và trả `204` không body; session khác vẫn hợp lệ.
- **AC-13:** Missing, malformed, expired, unknown, deleted và repeated logout đều idempotently trả `204` và clear cookie.
- **AC-14:** Role authorization cho phép approved role, trả `403/FORBIDDEN` cho disallowed/unknown role và không tin client-supplied role.
- **AC-15:** Public HTTP responses và captured application output không chứa plaintext password, password hash, raw session token hoặc session hash.
- **AC-16:** Known errors được map đúng; unexpected errors được forward thay vì bị che giấu.
- **AC-17:** Suite có isolation khỏi development/production data, không phụ thuộc test order và có thể chạy lặp lại.
- **AC-18:** Test command/report phân biệt rõ pass, fail, skipped/deferred và unavailable infrastructure.
- **AC-19:** Coverage không khóa test vào private implementation details hoặc duplicate cùng behavior ở mọi layer nếu không tạo thêm bằng chứng có ý nghĩa.
- **AC-20:** Không có production source, schema, migration hoặc API behavior nào bị thay đổi trong phạm vi Backend Authentication Tests.

## 10. Edge Cases

- `req.body` absent hoặc `null`.
- Registration field missing, wrong type hoặc empty string.
- Password đúng 8 ký tự và ngắn hơn 8 ký tự.
- Email khác casing nhưng cùng normalized value.
- Concurrent duplicate registration dẫn tới Prisma `P2002`.
- Login missing/non-string email hoặc password.
- Login email unknown, wrong password hoặc inactive account.
- Corrupt password hash từ persistence gây unexpected error propagation, không làm lộ hash.
- Session cookie empty, malformed, unknown, expired hoặc already deleted.
- Session trỏ tới missing/inactive user.
- Logout persistence delete race trả `P2025` và vẫn idempotent.
- Logout gặp unexpected repository failure.
- Multiple active sessions của một user.
- `/me` nhận client-controlled identity fields đồng thời với valid cookie.
- Role middleware nhận `USER`, `ADMIN`, disallowed role, unknown role hoặc thiếu `req.user`.
- Production/HTTPS context bật cookie `Secure`; non-secure development request không tự bật theo behavior hiện tại.
- Malformed JSON body tại Express boundary (known unresolved response-format gap).

## 11. Dependencies and Impact

### Backend

- Test targets gồm app/router, Auth Controller, Authentication Service, Authentication Middleware, Role Authorization Middleware, repositories và password-security utility.
- `backend/src/main.js` hiện tự khởi động listener khi import; testability impact và cách tạo HTTP test boundary phải được PLAN-010 phân tích mà không mặc định refactor production code.

### Database

- Dùng existing `USER` và `AUTH_SESSION`; không thay đổi schema.
- Database-backed tests cần môi trường tách biệt và lifecycle có thể kiểm soát.

### API

- Không tạo endpoint hoặc contract mới.
- Test phải phản ánh contract đã approved và ghi rõ các discrepancy ở Mục 12.

### Frontend/UI

- Không ảnh hưởng và không thuộc SPEC-010.

### Tooling

- Repository chưa có active test runner, HTTP testing library hoặc test scripts thực sự.
- Lựa chọn native `node:test` hay dependency khác, test file layout, coverage tooling và package changes phải được phân tích/approve ở PLAN-010 trước implementation.

## 12. Known Discrepancies and Ambiguities

### D-01 — `username` versus `display_name`

`docs/API_SPEC.md` phần Authentication vẫn minh họa `username`, trong khi approved Authentication SPEC/PLAN, database và implementation dùng `display_name`.

- SPEC-010 ghi test target theo approved/current contract là `display_name`.
- Đây là documentation discrepancy không chặn SPEC-010.
- Không sửa `API_SPEC.md` trong workflow SPEC-010; cần đồng bộ documentation ở workflow được phê duyệt.

### D-02 — Logout access wording

Authentication SPEC mô tả logout dành cho authenticated `USER`/`ADMIN`, nhưng approved PLAN/TASK-009 và implementation cố ý không gắn hard-`401` middleware để logout luôn idempotent.

- SPEC-010 yêu cầu chứng minh behavior idempotent hiện đã approved: missing/invalid/expired/deleted credential vẫn `204` và clear cookie.
- Đây không phải yêu cầu mở logout thành feature mới cho Guest; đó là recovery/cleanup behavior của endpoint hiện tại.

### D-03 — Centralized error handling chưa tồn tại

`ARCHITECTURE.md` yêu cầu centralized error handling và API JSON error structure, nhưng TASK-009 ghi rõ phần này ngoài scope; `main.js` hiện chưa đăng ký centralized error middleware.

- Known Authentication errors hiện có exact assertions.
- Component tests phải chứng minh unexpected errors được `next(error)`.
- Exact HTTP body cho unexpected error và malformed JSON được defer; không được tự sửa production code trong TASK-010 chỉ để làm test pass.
- Cần quyết định scope/error-handler dependency trước khi PLAN-010 chốt HTTP assertions cho hai trường hợp này.

### D-04 — Error `details` field

`API_SPEC.md` đưa `details` trong ví dụ error chung; Authentication implementation trả `success`, `error.code`, `error.message` mà không có `details`.

- SPEC-010 không tự yêu cầu thêm `details` vì API document trình bày đây là ví dụ và approved Authentication implementation đã dùng format hiện tại.
- Nếu `details` được xác định là bắt buộc toàn API, đó là API/production change ngoài SPEC-010 và cần approval riêng.

### D-05 — Validation boundaries

Approved documents nêu email/display-name validation ở mức khái quát, nhưng implementation hiện chỉ kiểm tra required string không rỗng, lowercase email và password length; trim/email-format/display-name limits chưa được chốt.

- SPEC-010 không sáng tạo validation rule mới.
- Tests phải khóa behavior đã được phê duyệt/triển khai, không hợp thức hóa các rule chưa quyết định.

### D-06 — Deployment-dependent cookie/CORS/CSRF contract

Approved PLAN yêu cầu xác minh topology trước khi chốt `SameSite`, `Domain`, credentialed CORS và CSRF. Implementation hiện chưa có CORS/CSRF và không set `SameSite`/`Domain`.

- PLAN-010 phải xác định liệu topology đã có đủ evidence để test các behavior này hay chỉ ghi deferred.
- SPEC-010 không chọn policy hoặc library.

## 13. Decisions Deferred to PLAN-010

- Test runner/framework và có cần thêm dependency hay không.
- HTTP request/testing mechanism.
- Test module/file layout và naming.
- Cách tạo importable Express app khi `main.js` hiện gắn composition với `app.listen()`.
- Dedicated test database, transaction rollback, reset, fixtures hay mocking strategy.
- Clock control cho expiration và cookie max-age assertions.
- Mức phân bổ cụ thể giữa HTTP integration, database integration và focused unit/component tests, theo boundary ở Mục 3.
- Cách capture/sanitize logs để kiểm tra sensitive-data invariant.
- Có chạy song song hay tuần tự các database-dependent tests.
- Cách report skipped/deferred deployment-topology assertions.
- Xử lý dependency đối với centralized error handler trước khi assert malformed JSON/unexpected HTTP error response.

Các quyết định trên không được thay đổi Authentication business/API contract.

## 14. Traceability

- `AGENTS.md`: Testing Rules, Verification, Security Rules, Minimal Change Principle.
- `docs/specs/AUTHENTICATION_SPEC.md`: Authentication business/API acceptance criteria.
- `docs/plans/AUTHENTICATION_PLAN.md`: stateful session, password security, cookie lifecycle, test strategy.
- `docs/plans/AUTHENTICATION_ROUTES_PLAN.md`: route integration và known error-boundary/CORS exclusions.
- `docs/tasks/AUTHENTICATION_TASK.md`: TASK-010 scope và upstream TASK-001 đến TASK-009 requirements.
- `docs/tasks/AUTHENTICATION_ROUTES_TASK.md`: final route/middleware composition contract.
- `docs/API_SPEC.md`: endpoint inventory, general response/status/security rules.
- `docs/ARCHITECTURE.md`: backend layering, centralized error handling và testing principles.
- `docs/DATABASE.md`: `USER`, `AUTH_SESSION`, constraints và relationship.
- `docs/FEATURE_STATUS.md`: Authentication `IN_PROGRESS`, implementation/test history through TASK-009.
- Current backend source and Prisma schema/migration.

## 15. SPEC Completion Checklist

- [x] Chỉ đặc tả Backend Authentication Tests.
- [x] Không mở rộng Authentication feature.
- [x] Không thêm requirement không được docs/implementation support.
- [x] Không chọn test framework sớm.
- [x] Phân biệt WHAT với HOW.
- [x] Cover đủ bốn Authentication endpoints.
- [x] Cover auth state, cookie/session/token behavior.
- [x] Cover validation, error propagation và security behavior.
- [x] Cover database effects, isolation và repeatability.
- [x] Acceptance Criteria observable và testable.
- [x] Discrepancy được ghi rõ, không âm thầm chọn một phía.
- [x] Không mở lại hoặc sửa TASK-009.
- [x] Không viết production code hoặc test implementation.
- [x] Không chuyển sang PLAN-010.

## Approval Gate

```text
SPEC-010: READY FOR HUMAN REVIEW
PLAN-010: NOT STARTED
TASK-010: NOT STARTED
IMPLEMENTATION: NOT STARTED
```

Human approval là bắt buộc trước khi chuyển sang PLAN-010.
