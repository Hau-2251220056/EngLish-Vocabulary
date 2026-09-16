# SPEC: Authentication

**Giai đoạn workflow:** SPEC  
**Trạng thái feature:** `TODO`  
**SPEC status:** `DRAFT`

## Existing Implementation

Authentication hiện chưa được triển khai trong source code.

- Backend hiện chỉ có route kiểm tra trạng thái trong `backend/src/main.js`.
- Chưa có authentication route, controller, service, middleware, user repository, password hashing, credential/session handling hoặc authorization logic.
- Frontend hiện chỉ có React shell tối thiểu trong `frontend/src/App.jsx`.
- Chưa có Login, Register, auth state, route protection hoặc auth API service.
- Tất cả hạng mục Authentication và User Management đang ở trạng thái `TODO` trong `docs/FEATURE_STATUS.md`.

## 1. Objective

Cung cấp nền tảng cho việc đăng ký tài khoản, đăng nhập, logout, xác định authenticated identity và backend-enforced authorization cho English Vocabulary Learning Platform.

Feature hỗ trợ đúng hai authenticated role đã được phê duyệt:

- `USER`
- `ADMIN`

Guest là trạng thái chưa authenticated và không được lưu như một database role.

## 2. Actors

### Guest

Có thể:

- Truy cập Landing Page.
- Đăng ký.
- Đăng nhập.
- Truy cập nội dung public được cho phép.

Không thể:

- Truy cập chức năng học tập yêu cầu tài khoản.
- Truy cập dữ liệu cá nhân.
- Tạo hoặc quản lý Vocabulary Set cá nhân.
- Truy cập Admin API.

### USER

Có thể:

- Authentication bằng email và password.
- Logout.
- Truy cập current-user identity.
- Sử dụng các chức năng dành cho User trong approved project scope.
- Truy cập resource thuộc quyền sở hữu của mình theo ownership rules.

Không thể:

- Tự thay đổi role.
- Truy cập private resource của User khác.
- Truy cập Admin-only endpoint.
- Tự thiết lập XP, level, streak, achievement hoặc learning progress authoritative values.

### ADMIN

Là một record trong entity `USER` với role `ADMIN`.

Có thể:

- Authentication và logout thông qua cùng hệ thống Authentication.
- Truy cập Admin API khi đã authenticated và được authorized.
- Quản lý các resource quản trị trong approved project scope.

## 3. Scope

### In Scope

- User registration.
- User login bằng `email` và `password`.
- Logout.
- Xác định authenticated identity cho protected API request.
- Current authenticated-user endpoint.
- Backend authorization dựa trên role `USER` và `ADMIN`.
- Kiểm tra tài khoản active thông qua field `is_active`.
- Email normalization về lowercase trước khi xử lý và lưu.
- Password validation với tối thiểu 8 ký tự.
- Secure password hashing.
- Các frontend screen và state liên quan đến Authentication:
  - Login
  - Register
  - Validation feedback
  - Error feedback
  - Password visibility toggle
- Bảo vệ authenticated API và Admin API.
- Error response nhất quán cho Authentication.
- Phân tích và quyết định authentication mechanism trong PLAN.

### Out of Scope

- Password reset hoặc recovery.
- Email verification.
- Social login.
- Multi-factor authentication (MFA).
- Session history hoặc device history.
- Premium hoặc subscription.
- Thêm role mới.
- Các Authentication feature chưa được developer phê duyệt.
- Thay đổi database schema hoặc tạo migration trong giai đoạn SPEC.
- User Profile và Daily Goal ngoài các dependency cần thiết cho Authentication.
- Bản thân chức năng Admin Management.

## 4. User Flow

### Registration

1. Guest mở Register.
2. Guest nhập `display_name`, `email`, `password` và `confirm_password`.
3. Frontend normalize email về lowercase và thực hiện client-side validation.
4. Frontend kiểm tra `confirm_password` khớp với `password`; field này chỉ phục vụ client-side validation.
5. Frontend không gửi `confirm_password` như một field nghiệp vụ tới backend.
6. Backend normalize email về lowercase trước khi xử lý và lưu.
7. Backend validate request, gồm password tối thiểu 8 ký tự.
8. Backend kiểm tra email uniqueness.
9. Backend hash password và tạo account mới với role `USER`, active mặc định và `daily_xp_goal = 50`.
10. Registration thành công.
11. User chuyển sang Login; không auto-login.

### Login

1. Guest mở Login.
2. Guest nhập email và password.
3. Frontend gửi credentials tới backend.
4. Backend normalize email về lowercase trước khi xác thực.
5. Backend xác thực account và password.
6. Backend từ chối account inactive mà không tiết lộ thông tin nhạy cảm về trạng thái account.
7. Backend tạo hoặc trả về credential/session theo authentication mechanism được quyết định trong PLAN.
8. Backend trả về user identity được phép.
9. Frontend chuyển sang authenticated application flow, hướng tới Dashboard.

### Current User

1. Authenticated client gọi `GET /api/auth/me`.
2. Backend kiểm tra credential/session.
3. Backend xác định authenticated user.
4. Backend trả về current-user identity được phép.
5. Credential thiếu, không hợp lệ hoặc không còn hiệu lực bị từ chối.

### Logout

1. Authenticated user yêu cầu logout.
2. Backend xử lý việc vô hiệu hóa hoặc kết thúc credential/session theo authentication mechanism được chọn.
3. Frontend xóa trạng thái Authentication cục bộ.
4. User trở về trạng thái Guest.
5. Chi tiết implementation và credential lifecycle được quyết định trong PLAN.

### Authorization

1. Client gửi request tới protected endpoint.
2. Backend authentication middleware xác định user.
3. Backend authorization kiểm tra role hoặc ownership cần thiết.
4. Request chỉ được tiếp tục khi authorization thành công.
5. Frontend role check chỉ điều khiển UI/navigation, không phải security boundary.

## 5. Business Rules

- **BR-01:** Hệ thống có chính xác hai authenticated role: `USER` và `ADMIN`.
- **BR-02:** Guest là trạng thái chưa authenticated, không phải role được lưu trong database.
- **BR-03:** Registration sử dụng `display_name`, `email`, `password` và `confirm_password` ở client.
- **BR-04:** `confirm_password` chỉ phục vụ client-side validation và không phải field nghiệp vụ cần lưu trong database.
- **BR-05:** Email là phương thức Authentication và phải unique.
- **BR-06:** Email phải được normalize về lowercase trước khi xử lý và lưu.
- **BR-07:** Password phải có tối thiểu 8 ký tự.
- **BR-08:** Password phải được hash trước khi lưu.
- **BR-09:** Plaintext password không được lưu, trả về hoặc ghi log.
- **BR-10:** Account đăng ký mới nhận role `USER`.
- **BR-11:** Account đăng ký mới active mặc định.
- **BR-12:** Account đăng ký mới có `daily_xp_goal = 50`.
- **BR-13:** Account inactive không được authenticate hoặc truy cập protected resource.
- **BR-14:** Khi account inactive, response không được tiết lộ thông tin nhạy cảm về trạng thái account.
- **BR-15:** Sau registration thành công, user chuyển sang Login và không auto-login.
- **BR-16:** Logout thuộc Authentication scope.
- **BR-17:** Authentication mechanism là `TBD` trong SPEC và phải được phân tích, quyết định trong PLAN dựa trên `ARCHITECTURE.md`, security, complexity và project scope.
- **BR-18:** Credential lifetime và renewal là `TBD` và do PLAN quyết định.
- **BR-19:** Authentication phải được kiểm tra ở backend trước khi xử lý protected request.
- **BR-20:** Authorization phải được enforce ở backend.
- **BR-21:** User không được tự thay đổi role.
- **BR-22:** Admin endpoint yêu cầu authentication và `role = ADMIN`.
- **BR-23:** Ownership phải được xác định từ authenticated identity, không lấy từ owner identifier do client gửi.
- **BR-24:** Sensitive Authentication details không được trả về trong production error response.
- **BR-25:** Sensitive configuration phải được quản lý bằng environment variables.

## 6. Data Requirements

Entity dữ liệu liên quan là `USER` đã được định nghĩa trong `DATABASE.md`.

Các field liên quan gồm:

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

Yêu cầu dữ liệu:

- `email` là unique.
- Email được normalize lowercase trước khi lưu.
- `password_hash` là bắt buộc.
- `display_name` được sử dụng thay cho `username`.
- `role` chỉ được là `USER` hoặc `ADMIN`.
- `is_active` xác định account có được authenticate hay không.
- `daily_xp_goal` của account mới mặc định là `50`.
- `confirm_password` không được lưu trong database.
- Không tạo entity `ADMIN` riêng.
- Không tạo authentication table riêng trong SPEC.
- Không đề xuất thay đổi schema hoặc migration trong SPEC.

Chi tiết schema, kiểu dữ liệu, constraint bổ sung và migration impact sẽ chỉ được phân tích trong PLAN nếu cần.

## 7. API Requirements

API base path là `/api`.

### Register

`POST /api/auth/register`

Access: Guest

Request nghiệp vụ:

```json
{
  "display_name": "Minh Hau",
  "email": "hau@example.com",
  "password": "password"
}
```

`confirm_password` chỉ phục vụ client-side validation và không được gửi như một field nghiệp vụ tới backend; field này không được lưu trong database.

Success response giữ mục tiêu theo API contract hiện tại:

```json
{
  "success": true,
  "message": "Registration successful"
}
```

Backend responsibilities:

- Validate required fields và data types.
- Validate `display_name` theo rule được phê duyệt.
- Normalize email về lowercase trước khi xử lý và lưu.
- Validate password tối thiểu 8 ký tự.
- Enforce email uniqueness.
- Hash password.
- Gán role `USER`.
- Gán account active mặc định.
- Gán `daily_xp_goal = 50`.
- Không trả về password hoặc password hash.
- Không auto-login sau registration.

Các lỗi quan trọng:

- Input không hợp lệ: `400` hoặc `422`.
- Email đã tồn tại: `409`.
- Server failure không mong muốn: `500`, không chứa sensitive details.

### Login

`POST /api/auth/login`

Access: Guest

Request:

```json
{
  "email": "hau@example.com",
  "password": "password"
}
```

Success response phải trả về user identity được phép, gồm tối thiểu:

- `id`
- `display_name`
- `email`
- `role`

Authentication credential/session result phụ thuộc authentication mechanism được quyết định trong PLAN.

Các lỗi quan trọng:

- Credentials không hợp lệ: `401`.
- Account inactive: phải bị từ chối bằng response phù hợp theo security principle và không được tiết lộ trạng thái nhạy cảm của account.
- Request không đúng cấu trúc: `400` hoặc `422`.
- Không để lộ khác biệt nhạy cảm giữa email không tồn tại, password sai và account inactive nếu điều đó tiết lộ trạng thái account.

### Logout

`POST /api/auth/logout`

Access: Authenticated `USER` hoặc `ADMIN`, tùy credential/session mechanism.

Mục tiêu:

- Kết thúc hoặc vô hiệu hóa credential/session hiện tại theo mechanism được chọn.
- Trả response success phù hợp.
- Không tạo business data mới.

Request, response và server-side invalidation behavior là `TBD` trong SPEC và phải được quyết định trong PLAN.

### Current User

`GET /api/auth/me`

Access: Authenticated `USER` hoặc `ADMIN`

Success response trả về current-user identity được phép, gồm tối thiểu:

- `id`
- `display_name`
- `email`
- `role`

Authentication không hợp lệ hoặc bị thiếu:

- `401 Unauthorized`.

### Protected API Authorization

Tất cả protected endpoint phải:

- Authenticate request ở backend.
- Enforce role nếu endpoint yêu cầu role cụ thể.
- Enforce ownership khi cần.
- Từ chối truy cập không được phép bằng `403 Forbidden`.
- Không phụ thuộc duy nhất vào frontend role information.

### Error Format

Authentication-related failure nên tuân theo format được tài liệu hóa:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {}
  }
}
```

Error code cụ thể, credential transport, logout behavior và field contract cuối cùng cần được chốt trong PLAN.

## 8. Acceptance Criteria

- **AC-01:** Guest có thể nhập registration data hợp lệ gồm `display_name`, `email`, `password` và `confirm_password`; frontend chỉ gửi các field nghiệp vụ cần thiết tới backend.
- **AC-02:** Email được normalize về lowercase trước khi kiểm tra uniqueness và lưu.
- **AC-03:** Registration từ chối email đã tồn tại sau normalization.
- **AC-04:** Registration từ chối password ngắn hơn 8 ký tự.
- **AC-05:** Frontend từ chối `confirm_password` không khớp với `password`.
- **AC-06:** `confirm_password` không được lưu trong database.
- **AC-07:** Password được lưu dưới dạng hash và plaintext password không được lưu.
- **AC-08:** Account mới nhận role `USER`, active mặc định và `daily_xp_goal = 50`.
- **AC-09:** Registration thành công không auto-login và user được chuyển sang Login.
- **AC-10:** Guest có thể login bằng email đã normalize và password hợp lệ.
- **AC-11:** Credentials không hợp lệ không thể authenticate.
- **AC-12:** Account inactive không thể authenticate và response không tiết lộ trạng thái nhạy cảm của account.
- **AC-13:** Login thành công trả về user identity được phê duyệt và credential/session result theo mechanism được chọn trong PLAN.
- **AC-14:** Authenticated client có thể lấy identity thông qua `GET /api/auth/me`.
- **AC-15:** Credentials thiếu, không hợp lệ hoặc hết hiệu lực bị từ chối tại `GET /api/auth/me`.
- **AC-16:** Authenticated user có thể yêu cầu `POST /api/auth/logout` theo mechanism được chọn và sau đó không còn truy cập protected resource bằng credential/session đã logout.
- **AC-17:** Protected API từ chối unauthenticated request.
- **AC-18:** Admin API từ chối account có role `USER`.
- **AC-19:** Admin API cho phép account có role `ADMIN` khi các validation khác thành công.
- **AC-20:** User không thể thay đổi role của mình qua user-facing API input.
- **AC-21:** Frontend Login và Register flow hiển thị validation, loading, success và error state được phê duyệt.
- **AC-22:** Frontend không truy cập trực tiếp PostgreSQL hoặc Supabase.
- **AC-23:** Authentication behavior được bao phủ bởi backend và frontend test phù hợp trước khi feature có thể chuyển sang `DONE`.

## 9. Edge Cases

- Registration thiếu field.
- `display_name` rỗng hoặc không hợp lệ theo validation rule được phê duyệt.
- Email không hợp lệ.
- Email có chữ hoa hoặc khoảng trắng cần được normalize theo rule đã chốt.
- Email trùng sau normalization.
- Password ngắn hơn 8 ký tự.
- Password và `confirm_password` không khớp.
- Client cố gắng gửi `confirm_password` như một field nghiệp vụ tới backend.
- Login bằng email không tồn tại.
- Login bằng password không đúng.
- Login bằng account inactive.
- Authentication credential bị thiếu.
- Credential expired, malformed hoặc revoked, tùy mechanism được chọn trong PLAN.
- Logout khi credential không còn hợp lệ.
- Logout lặp lại.
- Authenticated `USER` gọi Admin endpoint.
- Authenticated user truy cập private data của user khác.
- Client cố gắng gửi hoặc thay đổi role.
- Client cố gắng gửi owner identity để vượt ownership check.
- Authentication backend không khả dụng.
- Database không khả dụng trong registration hoặc login.
- Nhiều login attempt liên tiếp và behavior rate limiting, nếu security design được PLAN phê duyệt yêu cầu.
- Không tiết lộ account tồn tại hay account inactive thông qua error message hoặc response khác biệt không cần thiết.

## 10. Dependencies / Impact

### Backend

Authentication ảnh hưởng tới:

- Express route registration.
- Validation.
- Authentication middleware.
- Authorization middleware hoặc service logic.
- User data access.
- Password hashing.
- Credential/session handling.
- Logout handling.
- Error handling.
- Environment configuration.
- Enforcement trên protected endpoint.

Backend hiện chưa có các Authentication surface này.

### Frontend

Authentication ảnh hưởng tới:

- Login page.
- Register page.
- Auth API service.
- Authenticated state handling.
- Protected navigation.
- Redirect sau login thành công tới Dashboard.
- Chuyển sang Login sau registration thành công.
- Guest/authenticated UI separation.
- Loading, validation, success và error state.
- Logout interaction.

Frontend hiện chưa có các surface này.

### Database

Authentication sử dụng entity `USER` đã được tài liệu hóa. SPEC này không đề xuất entity mới, schema change hoặc migration.

### API

API contract liên quan gồm:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Field naming đã được chốt là `display_name`, không sử dụng `username`. Chi tiết credential transport và logout contract phụ thuộc PLAN.

### Security

Authentication là core security boundary. Authentication mechanism, credential lifetime/renewal, logout invalidation, password hashing implementation, production secret handling và inactive-account response cần được phân tích trong PLAN mà không tự ý chọn trước JWT hoặc HTTP-only Cookie Session.

### Feature Status

Authentication vẫn giữ trạng thái `TODO` cho đến khi hoàn tất SPEC approval, PLAN, implementation, testing, review và approval. `FEATURE_STATUS.md` không được chỉnh sửa.

## 11. Open Questions

1. **Authentication mechanism:** PLAN cần phân tích và quyết định mechanism phù hợp giữa security, complexity, `ARCHITECTURE.md` và scope đồ án. SPEC không chọn JWT hoặc HTTP-only Cookie Session.
2. **Credential lifetime và renewal:** PLAN cần quyết định thời hạn, renewal và revocation behavior.
3. **Logout behavior:** PLAN cần xác định credential/session được kết thúc hoặc invalidate như thế nào sau `POST /api/auth/logout`.
4. **`display_name` validation:** Cần xác định giới hạn độ dài, ký tự hợp lệ và việc có cho phép trùng display name hay không.
5. **Email normalization details:** Đã chốt lowercase; PLAN cần xác định có trim whitespace trước lowercase hay không và cách xử lý các email input bất thường.
6. **Error code cụ thể:** Cần chốt danh sách error code authentication và logout trong API implementation contract.
7. **Rate limiting:** Cần quyết định có yêu cầu rate limiting cho login/register trong phạm vi đồ án hay không.
8. **Existing user data:** V1 không yêu cầu hỗ trợ dữ liệu user cũ. Nếu trong PLAN hoặc implementation phát hiện dữ liệu user đã tồn tại cần migration hoặc compatibility, phải báo developer trước khi xử lý.

## Conflicts / Ambiguities

- API/UI documentation cũ sử dụng `username`, trong khi quyết định nghiệp vụ mới chốt sử dụng `display_name`. SPEC này áp dụng quyết định mới và không sử dụng `username`; `API_SPEC.md` và `UI_UX_SPEC.md` chưa được chỉnh sửa theo yêu cầu hiện tại.
- `DATABASE.md` sử dụng `display_name`, phù hợp với quyết định mới.
- `API_SPEC.md` có endpoint `POST /api/auth/logout` trong endpoint inventory nhưng phần Authentication chi tiết trước đây chưa mô tả endpoint này. SPEC này đưa logout vào scope theo quyết định của developer; request/response và invalidation behavior vẫn để PLAN.
- `API_SPEC.md` chưa quy định authentication mechanism cụ thể.
- `ARCHITECTURE.md` chưa cố định JWT hoặc HTTP-only Cookie Session.
- Authentication mechanism sẽ được phân tích và quyết định trong PLAN.
- `DATABASE.md` có nhắc `JWT_SECRET`, nhưng điều này không đủ để kết luận hệ thống phải sử dụng JWT. SPEC không chọn JWT.
- UI documentation cũ ghi Register gồm `Username`; quyết định mới thay thế bằng `display_name`. UI document chưa được chỉnh sửa theo yêu cầu hiện tại.
- Source code chưa có Authentication implementation, nên chưa có conflict behavior giữa code và SPEC.

## Assumptions

- `USER` tiếp tục là entity account duy nhất cho cả User và Admin.
- Các endpoint Authentication hiện có trong API inventory được giữ nguyên tên.
- Không tạo schema change, migration, dependency hoặc implementation trong giai đoạn SPEC.
- Các quyết định được developer chốt trong yêu cầu hiện tại được ưu tiên khi SPEC được xem xét cùng các tài liệu cũ đang chưa đồng bộ.

**SPEC status: DRAFT**
