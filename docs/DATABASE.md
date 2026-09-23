# DATABASE — English Vocabulary Learning Platform

> Tài liệu định nghĩa mô hình dữ liệu và nguyên tắc thiết kế Database của hệ thống.
>
> AI Agent phải đọc tài liệu này trước khi thiết kế Database Schema, Prisma Schema, Repository hoặc các API liên quan đến dữ liệu.
>
> Không được tự ý thêm, xóa hoặc thay đổi entity, relationship hoặc business rule quan trọng nếu chưa được người phát triển phê duyệt.

---

# 1. Database Overview

## 1.1. Database

Hệ thống sử dụng:

- Database Engine: PostgreSQL
- Database Hosting: Supabase
- ORM dự kiến: Prisma

Database được thiết kế theo hướng relational database vì hệ thống có nhiều mối quan hệ giữa:

- Người dùng.
- Topic.
- Từ vựng.
- Nghĩa của từ.
- Ví dụ.
- Vocabulary Set.
- Tiến độ học tập.
- Daily Goal.
- Quiz.
- Achievement.
- Streak.
- Community.

---

# 2. Nguyên tắc thiết kế

Database phải tuân thủ các nguyên tắc:

1. Dữ liệu có quan hệ rõ ràng phải được mô hình hóa bằng relationship.
2. Không lưu dữ liệu lặp lại nếu có thể chuẩn hóa hợp lý.
3. Business logic không được đưa trực tiếp vào Database nếu có thể xử lý ở Backend Service.
4. Backend là lớp duy nhất được phép xử lý nghiệp vụ và truy cập Database.
5. Frontend không được truy cập PostgreSQL/Supabase Database trực tiếp.
6. Foreign Key phải được sử dụng cho các quan hệ quan trọng.
7. Các bảng phải có Primary Key.
8. Các bảng cần tracking thời gian nên có `created_at` và/hoặc `updated_at`.
9. Không tạo bảng chỉ để phục vụ một trường hợp chưa có nhu cầu thực tế.
10. Ưu tiên thiết kế đơn giản, rõ ràng và dễ maintain.

Nguyên tắc chính:

> **Build what the project needs, not what the technology makes possible.**

---

# 3. Domain Model

Database được chia thành các nhóm chính:

```text
USER
│
├── AUTH_SESSION
│
├── Learning
│   ├── LEARNING_PROGRESS
│   ├── USER_DAILY_PROGRESS
│   ├── QUIZ_ATTEMPT
│   └── STREAK
│
├── Gamification
│   ├── ACHIEVEMENT
│   └── USER_ACHIEVEMENT
│
├── Vocabulary
│   ├── TOPIC
│   ├── VOCABULARY
│   ├── VOCABULARY_MEANING
│   ├── VOCABULARY_EXAMPLE
│   ├── VOCABULARY_SET
│   └── VOCABULARY_SET_ITEM
│
└── Community
    ├── COMMUNITY_POST
    └── COMMUNITY_COMMENT
4. Entity List

Phiên bản đầu tiên của hệ thống dự kiến có các entity chính sau:

Entity	Mục đích
USER	Người dùng và Admin
AUTH_SESSION	Session xác thực phía server của User
TOPIC	Chủ đề từ vựng
VOCABULARY	Từ vựng
VOCABULARY_MEANING	Các nghĩa khác nhau của một từ
VOCABULARY_EXAMPLE	Ví dụ sử dụng từ
VOCABULARY_SET	Bộ từ vựng
VOCABULARY_SET_ITEM	Liên kết Vocabulary và Vocabulary Set
LEARNING_PROGRESS	Tiến độ học của user đối với từng từ
USER_DAILY_PROGRESS	Tiến độ XP và Daily Goal theo từng ngày
QUIZ_ATTEMPT	Lịch sử làm quiz
STREAK	Theo dõi chuỗi ngày học
ACHIEVEMENT	Danh sách thành tích
USER_ACHIEVEMENT	Thành tích user đã đạt
COMMUNITY_POST	Bài đăng cộng đồng
COMMUNITY_COMMENT	Bình luận bài đăng
Không bắt buộc phải tạo riêng một bảng QUIZ ở giai đoạn đầu nếu quiz được sinh dựa trên Vocabulary và Quiz Type.

Chỉ tạo entity QUIZ riêng khi nghiệp vụ thực tế yêu cầu lưu các quiz cố định hoặc quiz session phức tạp.

5. USER
5.1. Mục đích

Lưu thông tin tài khoản người dùng và Admin.

Hệ thống chỉ có hai authenticated role:

USER
ADMIN

Guest là trạng thái chưa đăng nhập, không phải một role được lưu trong Database.

5.2. Dữ liệu dự kiến
USER

- id
- email
- password_hash
- display_name
- avatar_url
- role
- is_active
- total_xp
- daily_xp_goal
- created_at
- updated_at

### 5.2.1. USER Data Type & Constraint Contract

Các field của `USER` phải được materialize theo contract sau:

| Field           | Data Type    | Nullable | Default           | Constraint / Rule                |
| --------------- | ------------ | -------- | ----------------- | -------------------------------- |
| `id`            | UUID         | NOT NULL | Generated UUID    | Primary Key                      |
| `email`         | VARCHAR(255) | NOT NULL | None              | UNIQUE                           |
| `password_hash` | TEXT         | NOT NULL | None              | Không lưu plaintext password     |
| `display_name`  | VARCHAR(100) | NOT NULL | None              | Tên hiển thị của User            |
| `avatar_url`    | TEXT         | NULL     | NULL              | URL avatar, nếu có               |
| `role`          | Enum         | NOT NULL | `USER`            | Chỉ `USER` hoặc `ADMIN`          |
| `is_active`     | BOOLEAN      | NOT NULL | `true`            | Trạng thái tài khoản             |
| `total_xp`      | INTEGER      | NOT NULL | `0`               | Không âm                         |
| `daily_xp_goal` | INTEGER      | NOT NULL | `50`              | Giá trị hợp lệ từ `50` đến `200` |
| `created_at`    | TIMESTAMP    | NOT NULL | Current timestamp | Thời điểm tạo User               |
| `updated_at`    | TIMESTAMP    | NOT NULL | Current timestamp | Tự động cập nhật khi User thay đổi |

#### USER Role

Database chỉ cho phép hai authenticated role:

* `USER`
* `ADMIN`

`Guest` không được lưu trong `USER.role` vì Guest là trạng thái chưa xác thực.

#### USER ID

`USER.id` sử dụng UUID và là Primary Key.

Các Foreign Key tham chiếu tới `USER.id` phải sử dụng cùng kiểu dữ liệu UUID.

#### USER Email

`email` phải:

* NOT NULL.
* UNIQUE.
* Được normalize ở Backend trước khi lưu.
* Không phân biệt chữ hoa/chữ thường ở tầng business logic.

Database unique constraint phải bảo vệ uniqueness ở tầng persistence.

#### USER Password

`password_hash` chỉ lưu password hash được tạo bởi Backend.

Database không lưu plaintext password.

Cách hash và verify password được quy định trong Authentication Specification/Plan, không thuộc Database logic.

#### USER XP

`total_xp`:

* NOT NULL.
* Default `0`.
* INTEGER.
* Không được âm.

Level không được lưu trong bảng `USER`.

Level được tính từ `total_xp` ở Backend Service.

#### USER Daily XP Goal

`daily_xp_goal`:

* NOT NULL.
* Default `50`.
* Giá trị hợp lệ trong khoảng `50` đến `200`.
* Việc thay đổi Daily XP Goal không reset `total_xp`.
* Business validation được thực hiện ở Backend.

#### USER Timestamps

`created_at` mặc định là current timestamp.

`updated_at` mặc định là current timestamp và tự động cập nhật khi record `USER` thay đổi.

Database có thể sử dụng constraint để bảo vệ miền giá trị nếu implementation cần và không làm thay đổi business rule đã được phê duyệt.

---


5.3. Role
USER
ADMIN
5.4. Quy tắc
Email phải unique.
Password phải được lưu dưới dạng hash.
Không lưu plaintext password.
role dùng để phân quyền Backend.
is_active xác định tài khoản có đang hoạt động hay không.
total_xp là tổng XP của user.
daily_xp_goal là mục tiêu XP mỗi ngày của user.
Level được tính dựa trên total_xp ở Backend Service.
Không lưu level trực tiếp trong Database ở phiên bản đầu.
5.5. Daily XP Goal

Mục tiêu mặc định:

50 XP / day

Khoảng giá trị được hỗ trợ ở phiên bản đầu:

50 - 200 XP / day

User có thể thay đổi Daily XP Goal trong Settings.

Thay đổi Daily Goal không reset XP đã đạt trong ngày.

5.6. AUTH_SESSION

### Mục đích

Lưu các authentication session phía server của User.

### Dữ liệu dự kiến

AUTH_SESSION

- id
- user_id
- session_identifier_hash
- created_at
- expires_at

### Relationship

USER 1 ─── N AUTH_SESSION

Một User có thể có nhiều authentication session đồng thời.

Mỗi AUTH_SESSION thuộc về đúng một User thông qua `user_id`.

### Quy tắc và constraint

- `session_identifier_hash` phải unique.
- Chỉ lưu SHA-256 hash của session identifier.
- Raw session token/identifier không được lưu trong Database.
- Session hết hiệu lực sau 7 ngày thông qua `expires_at`.
- Logout của current session sẽ xóa record AUTH_SESSION tương ứng.
- Không có logout-all-devices trong v1.
- Không thêm `revoked_at`, `last_used_at`, `ip_address`, `user_agent` hoặc `device_name`.
- Không triển khai session/device history.
### 5.6.1. AUTH_SESSION Data Type & Constraint Contract

Các field của `AUTH_SESSION` phải được materialize theo contract sau:

| Field                     | Data Type   | Nullable | Default           | Constraint / Rule              |
| ------------------------- | ----------- | -------- | ----------------- | ------------------------------ |
| `id`                      | UUID        | NOT NULL | Generated UUID    | Primary Key                    |
| `user_id`                 | UUID        | NOT NULL | None              | Foreign Key → `USER.id`        |
| `session_identifier_hash` | VARCHAR(64) | NOT NULL | None              | UNIQUE                         |
| `created_at`              | TIMESTAMP   | NOT NULL | Current timestamp | Thời điểm tạo session          |
| `expires_at`              | TIMESTAMP   | NOT NULL | None              | Thời điểm session hết hiệu lực |

#### AUTH_SESSION ID

`AUTH_SESSION.id` sử dụng UUID và là Primary Key.

`AUTH_SESSION.user_id` sử dụng UUID để reference `USER.id`.

#### Session Identifier Hash

`session_identifier_hash`:

* NOT NULL.
* UNIQUE.
* Lưu SHA-256 hash dưới dạng hexadecimal representation.
* Không lưu raw session token/identifier.
* Không lưu thêm session metadata ngoài các field được định nghĩa trong `AUTH_SESSION`.

Raw session token chỉ tồn tại trong runtime/cookie theo Authentication Specification.

#### Session Expiration

`expires_at` là thời điểm session hết hiệu lực.

Session có lifetime 7 ngày theo Authentication Specification/Plan.

Backend chịu trách nhiệm tạo giá trị `expires_at` phù hợp khi tạo session.

Database không tự động xóa expired session bằng cron/job ở phiên bản đầu.

#### AUTH_SESSION Relationship

Relationship:

`USER 1 ─── N AUTH_SESSION`

Một User có thể có nhiều session đồng thời.

Mỗi `AUTH_SESSION.user_id` phải reference tới một `USER.id`.

Không sử dụng:

* `revoked_at`
* `last_used_at`
* `ip_address`
* `user_agent`
* `device_name`

trong phiên bản đầu.

Không tạo bảng session/device history riêng.

6. TOPIC
6.1. Mục đích

TOPIC dùng để phân loại nội dung học tập theo chủ đề.

Ví dụ:

Daily Life
Education
Travel
Food
Work
Technology
6.2. Topic V1 approved data contract
TOPIC

- id: UUID
- name: NOT NULL, maximum 100 characters
- description: nullable, maximum 500 characters
- created_at
- updated_at

`name` is trimmed/validated by the backend and has a PostgreSQL functional unique index on `LOWER(name)` for case-insensitive uniqueness. No additional normalized-name column or database extension is required.
6.3. Relationship

Topic được tổ chức theo:

TOPIC
   ↓
VOCABULARY_SET
   ↓
VOCABULARY

Topic V1 itself did not materialize a Vocabulary Set relationship or foreign key. Vocabulary Set V1 is the approved feature that materializes the required `TOPIC 1:N VOCABULARY_SET` relationship.

6.4. Quy tắc
Topic hệ thống do Admin quản lý.
User không tự ý tạo hoặc chỉnh sửa Topic hệ thống.
Không lưu trực tiếp `topic_id` trong VOCABULARY ở Topic V1.
Vocabulary Set V1 requires non-null `VOCABULARY_SET.topic_id` and `ON DELETE RESTRICT` / no cascade. Topic V1 must not be retroactively described as having created that relation, mock data or a relation-state test.
7. Vocabulary V1 Approved Data Contract

Vocabulary V1 is an ADMIN-managed aggregate only. It materializes:

```text
VOCABULARY
  -> VOCABULARY_MEANING
      -> VOCABULARY_EXAMPLE
```

`VOCABULARY.id`, `VOCABULARY_MEANING.id` and `VOCABULARY_EXAMPLE.id` are UUID primary keys. There is no direct Topic relationship and no Vocabulary Set/Set Item relation in V1.

### 7.1 VOCABULARY

- `word`: required, trimmed, non-empty `VARCHAR(100)`; display casing is preserved.
- `phonetic`: optional `VARCHAR(100)`.
- `pronunciation_url`: optional `VARCHAR(2048)` stored as model-pronunciation metadata only.
- `created_at`, `updated_at`.

The migration must create a PostgreSQL functional unique index on `LOWER(word)`. No normalized-word column, `difficulty_level`, CEFR field, part of speech or direct Topic foreign key belongs on `VOCABULARY`.

### 7.2 VOCABULARY_MEANING

- `vocabulary_id`: required UUID foreign key to `VOCABULARY.id`.
- `part_of_speech`: required trimmed non-empty `VARCHAR(50)` free-form string.
- `meaning_vi`: required trimmed non-empty `VARCHAR(500)`.
- `context`: optional `VARCHAR(500)`.
- `cefr_level`: nullable string/text, restricted by an explicit PostgreSQL `CHECK` to `A1`, `A2`, `B1`, `B2`, `C1`, `C2` or `NULL`.
- `created_at`, `updated_at`.

V1 must not introduce a PostgreSQL or Prisma CEFR enum. CEFR belongs only to Meaning.

### 7.3 VOCABULARY_EXAMPLE

- `meaning_id`: required UUID foreign key to `VOCABULARY_MEANING.id`.
- `example_en`: required trimmed non-empty `VARCHAR(1000)`.
- `example_vi`: optional `VARCHAR(1000)`.
- `created_at`.

`VOCABULARY 1:N VOCABULARY_MEANING` and `VOCABULARY_MEANING 1:N VOCABULARY_EXAMPLE`. Every Vocabulary has one or more Meanings; each Meaning has zero or more Examples. An Example belongs to Meaning, never directly to Vocabulary.

### 7.4 Aggregate Integrity and Deletion

Vocabulary is the V1 aggregate root. Create and nested update writes are atomic. A supplied Meaning collection is complete replacement data; stable child IDs must belong to the addressed aggregate, and omission from a supplied replacement collection intentionally deletes the omitted owned Meaning/Example.

Database cascade deletion is permitted only for owned Meaning/Example children when their Vocabulary aggregate is deleted. Vocabulary Set V1 materializes the first external Vocabulary reference: `VOCABULARY_SET_ITEM.vocabulary_id` uses `ON DELETE RESTRICT` / no cascade. Any later progress, quiz or other external reference must define its own approved foreign-key and delete policy.

10. VOCABULARY_SET — Legacy Draft (superseded for V1)
10.1. Mục đích

Vocabulary Set là một tập hợp các từ vựng được sử dụng để tổ chức nội dung học tập.

Set có thể:

Do Admin tạo.
Do User tạo.
Được chia sẻ thông qua Community.
Được User khác sao chép về tài khoản cá nhân.
10.2. Dữ liệu dự kiến
VOCABULARY_SET

- id
- topic_id (future/deferred; nullability not decided)
- owner_id
- name
- description
- is_public
- created_at
- updated_at

Khi được phê duyệt trong future Vocabulary Set feature, `topic_id` sẽ tham chiếu tới TOPIC; Topic V1 không materialize field/FK này.

owner_id tham chiếu tới USER.

10.3. Ownership Rules
Admin-created Vocabulary Set

Vocabulary Set do Admin tạo là Public Set.

ADMIN
  ↓
PUBLIC VOCABULARY SET

User có thể:

Xem Set.
Học Set.
Sao chép Set.

User không có quyền:

Chỉnh sửa Set gốc.
Xóa Set gốc.
User-created Vocabulary Set

Vocabulary Set do User tạo là Private Set mặc định.

USER
  ↓
PRIVATE VOCABULARY SET

Owner có thể:

Xem.
Học.
Thêm Vocabulary.
Xóa Vocabulary.
Chỉnh sửa thông tin Set.
Xóa Set.

User không thể trực tiếp chuyển Set cá nhân thành Public Set.

Community Sharing

Nếu User muốn chia sẻ Set cá nhân:

USER VOCABULARY SET
        ↓
   COMMUNITY POST
        ↓
   OTHER USERS

Vocabulary Set gốc vẫn thuộc quyền sở hữu của User tạo ra.

Copy Vocabulary Set

User có thể sao chép:

Public Set của Admin.
Set được User khác chia sẻ thông qua Community.

Khi copy:

Original Vocabulary Set
        ↓
   Copy / Add to My Sets
        ↓
New Vocabulary Set

Hệ thống tạo một VOCABULARY_SET mới với:

owner_id = User thực hiện copy
is_public = false

Các VOCABULARY_SET_ITEM của Set gốc cũng được sao chép sang Set mới.

Bản sao là một Set độc lập.

User thực hiện copy:

Có thể học bản sao.
Có thể chỉnh sửa bản sao.
Có thể xóa bản sao.
Không có quyền chỉnh sửa Set gốc.
Không có quyền xóa Set gốc.

Việc chỉnh sửa bản sao không ảnh hưởng tới Set gốc.

11. VOCABULARY_SET_ITEM — Legacy Draft (superseded for V1)
11.1. Mục đích

Bảng trung gian kết nối Vocabulary và Vocabulary Set.

11.2. Dữ liệu
VOCABULARY_SET_ITEM

- id
- vocabulary_set_id
- vocabulary_id
- created_at
11.3. Constraint

Không cho phép một Vocabulary xuất hiện nhiều lần trong cùng một Set.

UNIQUE(vocabulary_set_id, vocabulary_id)
### 11.4 Vocabulary Set V1 Approved Data Contract

Vocabulary Set V1 materializes only this Set aggregate:

```text
TOPIC --RESTRICT--> VOCABULARY_SET --CASCADE--> VOCABULARY_SET_ITEM --RESTRICT--> VOCABULARY
```

#### VOCABULARY_SET

- `id`: UUID primary key.
- `topic_id`: required UUID foreign key to `TOPIC.id`.
- `owner_id`: required UUID foreign key to `USER.id`; derived by Backend, never trusted from client input.
- `name`: required trimmed non-empty `VARCHAR(100)`.
- `description`: nullable `VARCHAR(500)`.
- `is_public`: required boolean. ADMIN-created System Sets are `true`; USER-created and copied User Sets are `false`.
- `created_at`, `updated_at`.

There is no Set-type enum. The service enforces that System Sets are ADMIN-created/public and User Sets are USER-owned/private. Every Set belongs to exactly one Topic. `TOPIC -> VOCABULARY_SET` must use `ON DELETE RESTRICT` / no cascade.

#### VOCABULARY_SET_ITEM

- `id`: UUID primary key.
- `vocabulary_set_id`: required UUID foreign key to `VOCABULARY_SET.id`.
- `vocabulary_id`: required UUID foreign key to `VOCABULARY.id`.
- `position`: required positive integer, persisted as contiguous one-based order within a Set.
- `created_at`.

The migration must enforce `UNIQUE(vocabulary_set_id, vocabulary_id)`, `UNIQUE(vocabulary_set_id, position)` and `CHECK (position > 0)`. Set deletion cascades only to its owned Items. Vocabulary deletion is `RESTRICT` while any Item references it. An Item references Vocabulary only, never a Meaning or Example; CEFR remains only on `VOCABULARY_MEANING`.

#### V1 Aggregate, Copy and Deferred Boundaries

System Sets require one-or-more Items. Private User Sets may be empty drafts. A supplied aggregate `items` collection is the complete desired ordered collection; Backend validates each Vocabulary ID and atomically replaces/reorders owned Items. There is no granular Set Item API.

Copying a System Set creates an independent private User Set with fresh Set/Item IDs, copied Topic/name/description and preserved Vocabulary order. No source-link, synchronization, Community sharing, public User Set, Flashcard, Learning, Progress, SRS, Quiz, XP, Streak, Pronunciation Practice or AI behavior is materialized in V1.

12. LEARNING_PROGRESS
12.1. Mục đích

Theo dõi tiến độ học của từng User đối với từng Vocabulary.

USER + VOCABULARY
        ↓
LEARNING_PROGRESS
12.2. Dữ liệu dự kiến
LEARNING_PROGRESS

- id
- user_id
- vocabulary_id
- status
- correct_count
- incorrect_count
- review_count
- last_reviewed_at
- next_review_at
- interval_days
- ease_factor
- created_at
- updated_at
12.3. Status

Phiên bản đầu sử dụng:

NEW
LEARNING
LEARNED
NEEDS_REVIEW
NEW

User chưa có hoạt động học đối với Vocabulary.

LEARNING

User đã bắt đầu học nhưng chưa đạt trạng thái ghi nhớ ổn định.

LEARNED

User đã đạt điều kiện học thành công theo rule của hệ thống.

NEEDS_REVIEW

Vocabulary đã từng được học nhưng cần được ôn tập lại.

Các điều kiện chuyển trạng thái cụ thể được xác định trong Business Logic / PLAN khi triển khai.

12.4. Constraint

Mỗi User chỉ có một Learning Progress cho một Vocabulary:

UNIQUE(user_id, vocabulary_id)

Tiến độ học của User không phụ thuộc vào việc Vocabulary nằm trong Set nào.

13. Spaced Repetition

Spaced Repetition không cần tạo một bảng riêng.

Thông tin cần thiết có thể được lưu trong:

LEARNING_PROGRESS

Các trường liên quan:

last_reviewed_at
next_review_at
interval_days
ease_factor
review_count

Backend chịu trách nhiệm tính toán lịch ôn tập.

Luồng khái niệm:

User completes learning activity
        ↓
Learning Service
        ↓
Evaluate learning result
        ↓
Update Learning Progress
        ↓
Calculate next review

Thuật toán Spaced Repetition cụ thể chưa được cố định trong Database Design.

AI Agent không được tự ý thêm entity hoặc bảng riêng chỉ để phục vụ thuật toán Spaced Repetition.

14. USER_DAILY_PROGRESS
14.1. Mục đích

Lưu tiến độ XP của User theo từng ngày để phục vụ:

Daily XP Goal.
Daily XP progress.
Goal completion.
Daily Goal bonus.

Không reset một trường today_xp trực tiếp trong USER.

14.2. Dữ liệu dự kiến
USER_DAILY_PROGRESS

- id
- user_id
- date
- activity_xp
- bonus_xp
- goal_completed
- created_at
- updated_at
14.3. Quy tắc

Mỗi User chỉ có một record cho một ngày:

UNIQUE(user_id, date)

Nếu User chưa có record của ngày hiện tại:

today_xp = 0

Khi User phát sinh learning activity:

Learning Activity
        ↓
Calculate XP
        ↓
Create / Update USER_DAILY_PROGRESS

Không cần cron job để reset XP hàng ngày.

14.4. Activity XP

activity_xp chỉ lưu XP từ các hoạt động học.

Không bao gồm Daily Goal bonus.

Điều này giúp tránh việc bonus XP tự tạo điều kiện để hoàn thành Daily Goal.

14.5. Daily Goal Bonus

Daily Goal bonus được tính:

20% of Daily XP Goal

với giới hạn:

Minimum = 10 XP
Maximum = 40 XP

Ví dụ:

Goal 50  → Bonus 10 XP
Goal 100 → Bonus 20 XP
Goal 150 → Bonus 30 XP
Goal 200 → Bonus 40 XP

Bonus chỉ được nhận tối đa một lần trong một ngày.

goal_completed = true khi:

activity_xp >= user's daily_xp_goal

Bonus không được tính vào điều kiện hoàn thành Daily Goal.

15. QUIZ_ATTEMPT
15.1. Mục đích

Lưu lịch sử User thực hiện các câu hỏi luyện tập.

Hệ thống hiện tại chỉ hỗ trợ 2 Quiz Type:

VI_TO_ENGLISH

MISSING_LETTER

AI Agent không được tự ý thêm Quiz Type mới nếu chưa được người phát triển phê duyệt.

15.2. Dữ liệu dự kiến
QUIZ_ATTEMPT

- id
- user_id
- vocabulary_id
- quiz_type
- user_answer
- correct_answer
- is_correct
- score
- response_time_ms
- created_at
15.3. Quiz Type
VI_TO_ENGLISH
MISSING_LETTER
VI_TO_ENGLISH

User nhìn thấy nghĩa tiếng Việt hoặc thông tin ngữ cảnh và nhập từ tiếng Anh.

MISSING_LETTER

User hoàn thành từ tiếng Anh bị thiếu một hoặc nhiều ký tự.

15.4. Character-level Feedback

Đối với Quiz yêu cầu nhập câu trả lời, hệ thống có thể so sánh từng ký tự giữa:

user_answer
correct_answer

để tạo feedback theo từng vị trí.

Ví dụ:

User answer:

deserst

Correct answer:

dessert

Backend có thể xác định:

Ký tự đúng.
Ký tự sai.
Vị trí tương ứng.

Không tạo bảng riêng để lưu kết quả từng ký tự nếu không thực sự cần thiết.

15.5. XP Rule

Quiz trả lời đúng:

+3 XP

Quiz trả lời sai:

+0 XP

Một Quiz attempt hợp lệ không được làm phát sinh XP lần thứ hai do Frontend gọi lại API hoặc do retry request.

16. Pronunciation Data Principle

Pronunciation là một module học tập riêng, không phải Quiz Type.

Thông tin phát âm mẫu được lưu trong:

VOCABULARY

├── phonetic
└── pronunciation_url

User có thể:

Nghe phát âm mẫu
        ↓
Tự phát âm
        ↓
Hệ thống phân tích
        ↓
Feedback

Ở phiên bản đầu:

Không bắt buộc lưu audio của User vào Database.
Không bắt buộc tạo PRONUNCIATION_ATTEMPT.
Không tạo các bảng pronunciation riêng nếu chưa có nhu cầu thực tế.

Nếu pronunciation practice được xác định là một qualifying learning activity, Backend có thể cập nhật LEARNING_PROGRESS, XP và Streak theo business rules đã được phê duyệt.

Nếu sau này cần lưu lịch sử pronunciation attempt, phải thiết kế migration và cập nhật tài liệu Database trước khi triển khai.

17. STREAK
17.1. Mục đích

Theo dõi chuỗi ngày học liên tiếp của User.

17.2. Dữ liệu dự kiến
STREAK

- id
- user_id
- current_streak
- longest_streak
- last_activity_date
- updated_at

Relationship:

USER 1 ─── 1 STREAK

Một User có một Streak record chính.

17.3. Qualifying Learning Activity

Streak được tính dựa trên hoạt động học hợp lệ.

Ví dụ:

Học Vocabulary.
Flashcard learning.
Quiz.
Pronunciation Practice.
Review.

Không tính:

Login.
Mở Dashboard.
Xem Profile.
Xem Vocabulary Set.
Chỉ điều hướng trong hệ thống mà không có learning activity.
17.4. Quy tắc

Nếu User đã có learning activity hôm nay:

Không tăng streak thêm lần nữa.

Nếu hôm qua có activity và hôm nay có activity:

current_streak + 1

Nếu có một hoặc nhiều ngày bị bỏ qua:

current_streak = 1

Nếu:

current_streak > longest_streak

thì cập nhật:

longest_streak = current_streak

Streak không yêu cầu một mức XP tối thiểu.

Một ngày chỉ cần có ít nhất một qualifying learning activity.

Phiên bản đầu không có Streak Freeze.

18. ACHIEVEMENT
18.1. Mục đích

Lưu danh sách thành tích của hệ thống.

Ví dụ:

First Lesson
Vocabulary Beginner
7 Day Streak
100 Words
500 XP
18.2. Dữ liệu dự kiến
ACHIEVEMENT

- id
- name
- description
- icon_url
- condition_type
- condition_value
- created_at
- updated_at
18.3. Condition Type

Ví dụ:

WORDS_LEARNED
XP_REACHED
STREAK_REACHED
QUIZ_COMPLETED

condition_value là giá trị cần đạt.

Ví dụ:

condition_type = STREAK_REACHED
condition_value = 7
19. USER_ACHIEVEMENT
19.1. Mục đích

Lưu Achievement mà User đã đạt được.

19.2. Dữ liệu
USER_ACHIEVEMENT

- id
- user_id
- achievement_id
- achieved_at
19.3. Constraint

Không cho phép User nhận cùng một Achievement nhiều lần nếu Achievement đó chỉ có thể đạt một lần.

UNIQUE(user_id, achievement_id)
20. Level Data Principle

Level là một phần của Gamification nhưng không được lưu trực tiếp trong Database ở phiên bản đầu.

Level được tính từ:

USER.total_xp

Backend Service chịu trách nhiệm xác định Level.

20.1. Level Range

Phiên bản đầu có:

LEVEL 1 → LEVEL 15

Level 15 là Level tối đa.

User vẫn có thể tiếp tục nhận XP sau khi đạt Level 15.

Ví dụ:

User đạt Level 15
        ↓
Tiếp tục học
        ↓
Total XP tiếp tục tăng
        ↓
Level vẫn = 15

Không giới hạn total_xp ở Level 15.

20.2. Level Threshold

Level 2 bắt đầu tại:

50 XP

Bảng Level threshold cụ thể chưa được xem là Database Schema và phải được quản lý ở Backend configuration/business logic.

AI Agent không được tự ý tạo cột level hoặc bảng LEVEL nếu chưa có requirement mới.

21. Gamification Data Principle

Gamification bao gồm:

XP
Level
Daily Goal
Streak
Achievement

Trong đó:

XP được lưu trong USER.total_xp.
Level được tính từ USER.total_xp.
Daily Goal được lưu trong USER.daily_xp_goal.
Daily XP được lưu trong USER_DAILY_PROGRESS.
Streak được quản lý bởi STREAK.
Achievement được quản lý bởi ACHIEVEMENT + USER_ACHIEVEMENT.
21.1. XP Rules

Phiên bản đầu sử dụng một XP rule chung cho tất cả User:

Activity	XP
Học từ mới lần đầu	+3
Review từ đã học	+1
Quiz đúng	+3
Quiz sai	+0
Lặp lại cùng learning event	+0

Daily Goal bonus được tính riêng theo quy tắc tại USER_DAILY_PROGRESS.

XP chỉ được cộng cho learning event hợp lệ.

Không cộng XP chỉ vì:

Mở Flashcard.
Refresh trang.
Click lại cùng một action không tạo learning event mới.
Gửi lại cùng request do retry/network issue.
21.2. XP và Learning Progress

Learning Progress và XP là hai khái niệm độc lập.

LEARNING_PROGRESS
→ User đã học gì và đang ở trạng thái nào.

XP
→ User đã thực hiện bao nhiêu hoạt động được tính điểm.

Không được suy luận rằng:

1 XP = 1 learned word
22. COMMUNITY_POST
22.1. Mục đích

Lưu bài đăng trong khu vực Community.

Community là feature hỗ trợ việc chia sẻ và khám phá nội dung học tập liên quan đến Vocabulary Set.

22.2. Dữ liệu dự kiến
COMMUNITY_POST

- id
- user_id
- vocabulary_set_id (nullable)
- title
- content
- created_at
- updated_at
22.3. Sharing Rule

Community Post không chuyển quyền sở hữu Vocabulary Set.

User A
  ↓
Owns Vocabulary Set A
  ↓
Creates Community Post
  ↓
Shares Set A
  ↓
User B copies Set A

Set gốc vẫn thuộc User A.

User B nhận được một Vocabulary Set mới thuộc User B.

23. COMMUNITY_COMMENT
23.1. Mục đích

Lưu bình luận của User trên bài đăng.

23.2. Dữ liệu
COMMUNITY_COMMENT

- id
- post_id
- user_id
- content
- created_at
- updated_at

Relationship:

COMMUNITY_POST 1 ─── N COMMUNITY_COMMENT

USER 1 ─── N COMMUNITY_COMMENT
24. Entity Relationship Overview

Mô hình quan hệ tổng quát:

                         ┌──────────────────┐
                         │       USER       │
                         └────────┬─────────┘
                                  │
              ┌───────────────────┼────────────────────┐
              │                   │                    │
              ▼                   ▼                    ▼
     ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
     │ LEARNING_       │ │ USER_DAILY_     │ │     STREAK      │
     │ PROGRESS        │ │ PROGRESS        │ └─────────────────┘
     └────────┬────────┘ └─────────────────┘
              │
              │
              ▼
       ┌─────────────────┐
       │   VOCABULARY    │
       └────────┬────────┘
                │
        ┌───────┴──────────────┐
        │                      │
        ▼                      ▼
┌─────────────────────┐ ┌─────────────────────┐
│ VOCABULARY_MEANING  │ │ VOCABULARY_SET_ITEM │
└──────────┬──────────┘ └──────────┬──────────┘
           │                       │
           ▼                       ▼
┌─────────────────────┐    ┌─────────────────┐
│ VOCABULARY_EXAMPLE  │    │ VOCABULARY_SET  │
└─────────────────────┘    └────────┬────────┘
                                    │
                                    ▼
                                  TOPIC

USER
 ├── QUIZ_ATTEMPT
 ├── VOCABULARY_SET
 ├── COMMUNITY_POST
 ├── COMMUNITY_COMMENT
 └── USER_ACHIEVEMENT
                  │
                  ▼
            ACHIEVEMENT

COMMUNITY_POST
       │
       ▼
COMMUNITY_COMMENT
25. Main Relationships
Relationship	Cardinality
USER → AUTH_SESSION	1:N
USER → LEARNING_PROGRESS	1:N
VOCABULARY → LEARNING_PROGRESS	1:N
USER → USER_DAILY_PROGRESS	1:N
USER → QUIZ_ATTEMPT	1:N
VOCABULARY → QUIZ_ATTEMPT	1:N
USER → STREAK	1:1
TOPIC → VOCABULARY_SET	1:N
VOCABULARY → VOCABULARY_MEANING	1:N
VOCABULARY_MEANING → VOCABULARY_EXAMPLE	1:N
USER → VOCABULARY_SET	1:N
VOCABULARY_SET → VOCABULARY_SET_ITEM	1:N
VOCABULARY → VOCABULARY_SET_ITEM	1:N
USER → COMMUNITY_POST	1:N
VOCABULARY_SET → COMMUNITY_POST	1:N
COMMUNITY_POST → COMMUNITY_COMMENT	1:N
USER → COMMUNITY_COMMENT	1:N
USER → USER_ACHIEVEMENT	1:N
ACHIEVEMENT → USER_ACHIEVEMENT	1:N
26. Indexing Strategy

Index chỉ được thêm khi có nhu cầu truy vấn thực tế.

Các index quan trọng dự kiến:

USER
UNIQUE(email)
AUTH_SESSION
UNIQUE(session_identifier_hash)
TOPIC

Có thể index:

name

Nếu Topic được tìm kiếm thường xuyên.

VOCABULARY

`UNIQUE INDEX` on `LOWER(word)` is required by Vocabulary V1 for case-insensitive uniqueness. No `difficulty_level` index exists in V1.

VOCABULARY_MEANING
vocabulary_id
VOCABULARY_EXAMPLE
meaning_id
VOCABULARY_SET
owner_id
topic_id
is_public
VOCABULARY_SET_ITEM
vocabulary_set_id
vocabulary_id

UNIQUE(vocabulary_set_id, vocabulary_id)
LEARNING_PROGRESS
user_id
vocabulary_id
next_review_at

UNIQUE(user_id, vocabulary_id)
USER_DAILY_PROGRESS
user_id
date

UNIQUE(user_id, date)
QUIZ_ATTEMPT
user_id
vocabulary_id
created_at
STREAK
UNIQUE(user_id)
ACHIEVEMENT

Có thể index:

condition_type

nếu cần cho truy vấn kiểm tra Achievement.

USER_ACHIEVEMENT
user_id
achievement_id

UNIQUE(user_id, achievement_id)
COMMUNITY_POST
user_id
vocabulary_set_id
created_at
COMMUNITY_COMMENT
post_id
user_id
created_at
27. Foreign Key Rules

Các relationship quan trọng phải sử dụng Foreign Key.

Ví dụ:

VOCABULARY_SET.topic_id
    → TOPIC.id
VOCABULARY_MEANING.vocabulary_id
    → VOCABULARY.id
VOCABULARY_EXAMPLE.meaning_id
    → VOCABULARY_MEANING.id
VOCABULARY_SET.owner_id
    → USER.id
VOCABULARY_SET_ITEM.vocabulary_set_id
    → VOCABULARY_SET.id
VOCABULARY_SET_ITEM.vocabulary_id
    → VOCABULARY.id
LEARNING_PROGRESS.user_id
    → USER.id
LEARNING_PROGRESS.vocabulary_id
    → VOCABULARY.id
USER_DAILY_PROGRESS.user_id
    → USER.id
QUIZ_ATTEMPT.user_id
    → USER.id
QUIZ_ATTEMPT.vocabulary_id
    → VOCABULARY.id
COMMUNITY_POST.user_id
    → USER.id
COMMUNITY_POST.vocabulary_set_id
    → VOCABULARY_SET.id
COMMUNITY_COMMENT.post_id
    → COMMUNITY_POST.id
COMMUNITY_COMMENT.user_id
    → USER.id
USER_ACHIEVEMENT.user_id
    → USER.id
USER_ACHIEVEMENT.achievement_id
    → ACHIEVEMENT.id
AUTH_SESSION.user_id
  → USER.id

Foreign Key behavior phải được cân nhắc theo từng entity.

Không được sử dụng cascade delete một cách tùy tiện.

Đặc biệt cần thận trọng với:

User.
Vocabulary.
Vocabulary Set.
Learning Progress.
Daily Progress.
Quiz History.
Community Post.
Achievement.

Dữ liệu lịch sử học tập không nên bị xóa ngoài ý muốn chỉ vì một entity liên quan bị thay đổi.

28. Data Integrity

Database phải đảm bảo:

Unique

Các dữ liệu cần unique phải được kiểm soát ở Database.

Ví dụ:

USER.email
LEARNING_PROGRESS(user_id, vocabulary_id)
USER_DAILY_PROGRESS(user_id, date)
VOCABULARY_SET_ITEM(vocabulary_set_id, vocabulary_id)
USER_ACHIEVEMENT(user_id, achievement_id)
AUTH_SESSION.session_identifier_hash
Not Null

Các trường bắt buộc phải được xác định rõ là NOT NULL.

Ví dụ:

USER.email
USER.password_hash
USER.role
VOCABULARY.word
VOCABULARY_MEANING.meaning_vi
TOPIC.name
VOCABULARY_SET.name
USER_DAILY_PROGRESS.date
Foreign Key

Các relationship quan trọng phải được đảm bảo bằng Foreign Key.

29. Soft Delete

Không mặc định thêm deleted_at vào tất cả các bảng.

Chỉ sử dụng soft delete cho entity khi nghiệp vụ thực tế yêu cầu khôi phục hoặc giữ lịch sử.

Ví dụ có thể cân nhắc:

COMMUNITY_POST

hoặc dữ liệu quản trị cần giữ lịch sử.

AI Agent không được tự động thêm soft delete vào toàn bộ schema.

30. Timestamps

Các entity chính nên sử dụng:

created_at
updated_at

Không phải mọi bảng đều bắt buộc có updated_at.

Các bảng event/history có thể chỉ cần:

created_at

Ví dụ:

QUIZ_ATTEMPT
USER_ACHIEVEMENT
VOCABULARY_EXAMPLE
31. Learning Data Principle

Learning Progress là dữ liệu theo User.

USER + VOCABULARY
        ↓
LEARNING_PROGRESS

Mỗi cặp:

(user_id, vocabulary_id)

chỉ nên có một Learning Progress record.

Điều này giúp hệ thống có thể truy vấn:

Các từ User chưa học.

Các từ User đang học.

Các từ cần ôn hôm nay.

Các từ đã learned.


Tiến độ học của User không phụ thuộc vào việc Vocabulary nằm trong Set nào.

Ví dụ:

User A học "work" từ Admin Set
        ↓
Learning Progress của User A

User A học "work" từ Community Set
        ↓
Vẫn sử dụng Learning Progress của User A đối với "work"
32. Gamification Data Principle

Gamification bao gồm:

XP
Level
Daily Goal
Streak
Achievement

Trong đó:

XP được lưu trực tiếp trong USER.
Level được tính từ USER.total_xp.
Level tối đa là 15 ở phiên bản đầu.
Daily Goal được lưu trong USER.daily_xp_goal.
Daily XP được lưu trong USER_DAILY_PROGRESS.
Streak được quản lý bởi STREAK.
Achievement được quản lý bởi ACHIEVEMENT + USER_ACHIEVEMENT.

Không tạo thêm bảng riêng cho từng loại XP event nếu chưa có nhu cầu audit XP chi tiết.

Nếu sau này cần lịch sử XP, có thể bổ sung:

XP_TRANSACTION

nhưng không tạo ở phiên bản đầu nếu chưa cần thiết.

33. Vocabulary Set Data Principle

Vocabulary Set có hai nguồn chính:

ADMIN
  ↓
PUBLIC SET

USER
  ↓
PRIVATE SET
Admin Public Set

User có thể:

View
Learn
Copy

nhưng không thể:

Edit original
Delete original
User Private Set

Owner có thể:

View
Learn
Edit
Delete
Copy

Copy Set không tạo relationship ownership mới với Set gốc.

Hệ thống tạo:

New VOCABULARY_SET
        +
New VOCABULARY_SET_ITEM records

Set mới thuộc User thực hiện copy.

Không cần tạo các bảng:

VOCABULARY_SET_DOWNLOAD
VOCABULARY_SET_COPY
VOCABULARY_SET_OWNER

cho nghiệp vụ này.

34. Community Data Principle

Community là module hỗ trợ hệ thống học từ vựng.

Database Community ở phiên bản đầu tập trung vào:

COMMUNITY_POST
COMMUNITY_COMMENT

COMMUNITY_POST có thể liên kết với VOCABULARY_SET để hỗ trợ chia sẻ Vocabulary Set.

Luồng chia sẻ:

USER
  ↓
Owns VOCABULARY_SET
  ↓
Creates COMMUNITY_POST
  ↓
Shares VOCABULARY_SET
  ↓
Other User
  ↓
Copies VOCABULARY_SET
  ↓
New Private VOCABULARY_SET

Community không làm thay đổi ownership của Set gốc.

Không mặc định triển khai:

Chat realtime.
Follow user.
Friend system.
Notification system.
Reaction system.
Report system.

Các feature này chỉ được thêm khi được xác định rõ trong phạm vi dự án.

35. Admin Data

Không tạo bảng ADMIN riêng.

Admin là một User có:

USER.role = ADMIN

Admin sử dụng các quyền đặc biệt để:

Quản lý Vocabulary.
Quản lý Vocabulary Meaning.
Quản lý Vocabulary Example.
Quản lý Topic.
Quản lý Vocabulary Set hệ thống.
Quản lý Achievement.
Quản lý Community Content.
Quản lý User khi cần.
Xem dữ liệu thống kê hệ thống.

Authorization phải được xử lý ở Backend.

36. Database Security

Frontend không được truy cập trực tiếp PostgreSQL.

Luồng dữ liệu:

React
  ↓
REST API
  ↓
Express Backend
  ↓
Service
  ↓
Repository / Prisma
  ↓
PostgreSQL / Supabase

Database credentials phải được lưu trong environment variables.

Không commit:

DATABASE_URL
JWT_SECRET
SUPABASE_SECRET_KEY

hoặc các secret tương tự vào Git repository.

37. Transaction

Transaction được sử dụng khi một business operation cập nhật nhiều dữ liệu và cần đảm bảo tính toàn vẹn.

Ví dụ:

Submit Quiz
    ↓
Save Quiz Attempt
    ↓
Update Learning Progress
    ↓
Update XP
    ↓
Update Daily Progress
    ↓
Update Streak
    ↓
Check Achievement

Nếu nghiệp vụ yêu cầu các bước trên thành một atomic operation, Backend Service phải sử dụng Database Transaction.

Copy Vocabulary Set

Copy Vocabulary Set cũng nên được thực hiện trong một transaction:

Create New Vocabulary Set
        ↓
Copy Vocabulary Set Items
        ↓
Commit

Nếu một bước thất bại, toàn bộ operation phải được rollback để tránh tạo Set không đầy đủ.

Không tự động sử dụng transaction cho mọi query đơn giản.

38. Initial Database Scope

Phiên bản đầu tiên của Database dự kiến gồm:

1. USER
2. AUTH_SESSION
3. TOPIC
4. VOCABULARY
5. VOCABULARY_MEANING
6. VOCABULARY_EXAMPLE
7. VOCABULARY_SET
8. VOCABULARY_SET_ITEM
9. LEARNING_PROGRESS
10. USER_DAILY_PROGRESS
11. QUIZ_ATTEMPT
12. STREAK
13. ACHIEVEMENT
14. USER_ACHIEVEMENT
15. COMMUNITY_POST
16. COMMUNITY_COMMENT

Tổng cộng:

16 tables

Database application schema trên Supabase hiện đang empty và chưa có migration application trước đó. Vì vậy, TASK-001 có thể tạo migration đầu tiên để materialize `USER` và `AUTH_SESSION` cùng relationship và constraints đã được phê duyệt.

Đây là phạm vi Database dự kiến, không phải yêu cầu bắt buộc phải giữ nguyên đúng 16 bảng trong mọi trường hợp.

Trong quá trình thiết kế chi tiết, nếu phát hiện một entity không cần thiết hoặc có thể xử lý bằng entity hiện tại, AI Agent có thể đề xuất loại bỏ hoặc điều chỉnh sau khi phân tích và được phê duyệt.

Ngược lại, AI Agent không được tự ý mở rộng Database thành nhiều entity hoặc bảng mới chỉ vì mục đích "enterprise", overengineering hoặc dự đoán các nhu cầu chưa được xác định trong phạm vi dự án.

Các feature như Pronunciation và Spaced Repetition không tạo thêm table riêng ở phiên bản đầu nếu dữ liệu có thể được xử lý bằng các entity hiện tại.

Nếu phát sinh yêu cầu cần bổ sung entity hoặc table mới, AI Agent phải phân tích lý do, tác động và đề xuất trước khi thực hiện.

39. Future Extension

Các entity sau có thể được xem xét trong tương lai:

XP_TRANSACTION
NOTIFICATION
VOCABULARY_FAVORITE
USER_FOLLOW
COMMUNITY_REACTION
COMMUNITY_REPORT
QUIZ_SESSION
AI_GENERATION_HISTORY
PRONUNCIATION_ATTEMPT

Những entity này không thuộc Initial Database Scope.

Đây chỉ là các hướng mở rộng tiềm năng, không phải thiết kế đã được phê duyệt.

AI Agent không được tự tạo các entity này nếu feature tương ứng chưa được xác định và phê duyệt.

40. Database Change Rules

AI Agent phải tuân thủ:

Không được tự ý
Đổi PostgreSQL sang Database khác.
Xóa entity quan trọng.
Đổi relationship quan trọng.
Thêm hàng loạt bảng không có trong scope.
Đưa business logic vào Database thay vì Backend.
Cho Frontend truy cập Database trực tiếp.
Lưu plaintext password.
Bỏ Foreign Key khỏi relationship quan trọng.
Tạo bảng riêng cho từng Quiz Type nếu chưa có lý do nghiệp vụ.
Tạo bảng riêng cho USER và ADMIN.
Tạo bảng riêng cho Copy/Download Vocabulary Set nếu nghiệp vụ hiện tại không yêu cầu.
Tạo bảng riêng cho Spaced Repetition chỉ vì có thuật toán ôn tập.
Tạo bảng riêng cho Pronunciation nếu chưa có nhu cầu lưu lịch sử pronunciation attempt.
Tạo bảng riêng cho Level chỉ để lưu Level hiện tại.
Tạo bảng riêng cho Daily Goal nếu dữ liệu có thể được quản lý bằng USER và USER_DAILY_PROGRESS.
Được phép
Bổ sung index khi có lý do về query performance.
Bổ sung constraint để bảo vệ data integrity.
Điều chỉnh tên field cho nhất quán.
Điều chỉnh kiểu dữ liệu nếu có lý do kỹ thuật.
Đề xuất entity mới khi feature yêu cầu.
Tạo migration khi business requirement thay đổi.
Điều chỉnh Foreign Key behavior nếu có lý do rõ ràng về data integrity.

Mọi thay đổi làm ảnh hưởng đến domain model hoặc relationship quan trọng phải được người phát triển phê duyệt trước.

41. Source of Truth

Các tài liệu trong project có vai trò khác nhau:

AGENTS.md
→ Global project rules và development constraints.
PROJECT_OVERVIEW.md
→ Business scope và phạm vi tổng thể của hệ thống.
ARCHITECTURE.md
→ Kiến trúc và technical direction của hệ thống.
DATABASE.md
→ Data model và database design.
API_SPEC.md
→ API contract.
UI_UX_SPEC.md
→ UI/UX behavior và user flow.
FEATURE_STATUS.md
→ Theo dõi trạng thái implementation của feature.
→ Không phải source of truth cho business requirement.
Approved SPEC / PLAN / TASK
→ Requirement và implementation plan cụ thể cho từng change.

Nếu có mâu thuẫn giữa implementation hiện tại và các tài liệu trên,

AI Agent không được tự ý chọn một bên và tiếp tục.

AI Agent phải:

Xác định mâu thuẫn.
Giải thích impact.
Xác định tài liệu nào cần được cập nhật.
Yêu cầu người phát triển phê duyệt nếu thay đổi ảnh hưởng đến scope, architecture, database, API hoặc business rule.

Implementation hiện tại không được tự động trở thành source of truth chỉ vì code đã tồn tại.

42. Core Database Principle

Database của hệ thống phải hướng tới:

Simple
   ↓
Clear
   ↓
Consistent
   ↓
Maintainable
   ↓
Testable
   ↓
Scalable when necessary

Không thiết kế Database phức tạp chỉ để thể hiện công nghệ.

Mục tiêu là xây dựng một Database:

Đủ cho phạm vi đồ án.
Dễ hiểu.
Dễ triển khai với PostgreSQL/Supabase.
Dễ sử dụng với Prisma.
Dễ test.
Dễ mở rộng khi feature thực sự cần.
Phù hợp với kiến trúc Backend REST API.
```
