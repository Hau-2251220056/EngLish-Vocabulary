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
- Từ vựng.
- Nghĩa của từ.
- Ví dụ.
- Vocabulary Set.
- Tiến độ học tập.
- Quiz.
- Lịch sử làm quiz.
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
├── Learning
│   ├── LEARNING_PROGRESS
│   ├── QUIZ_ATTEMPT
│   └── STREAK
│
├── Gamification
│   ├── ACHIEVEMENT
│   └── USER_ACHIEVEMENT
│
├── Vocabulary
│   ├── VOCABULARY
│   ├── VOCABULARY_MEANING
│   ├── VOCABULARY_EXAMPLE
│   ├── VOCABULARY_SET
│   └── VOCABULARY_SET_ITEM
│
└── Community
    ├── COMMUNITY_POST
    └── COMMUNITY_COMMENT
```

---

# 4. Entity List

Phiên bản đầu tiên của hệ thống dự kiến có các entity chính sau:

| Entity              | Mục đích                              |
| ------------------- | ------------------------------------- |
| USER                | Người dùng và Admin                   |
| VOCABULARY          | Từ vựng                               |
| VOCABULARY_MEANING  | Các nghĩa khác nhau của một từ        |
| VOCABULARY_EXAMPLE  | Ví dụ sử dụng từ                      |
| VOCABULARY_SET      | Bộ từ vựng                            |
| VOCABULARY_SET_ITEM | Liên kết Vocabulary và Vocabulary Set |
| LEARNING_PROGRESS   | Tiến độ học của user đối với từng từ  |
| QUIZ_ATTEMPT        | Lịch sử làm quiz                      |
| STREAK              | Theo dõi chuỗi ngày học               |
| ACHIEVEMENT         | Danh sách thành tích                  |
| USER_ACHIEVEMENT    | Thành tích user đã đạt                |
| COMMUNITY_POST      | Bài đăng cộng đồng                    |
| COMMUNITY_COMMENT   | Bình luận bài đăng                    |

> Không bắt buộc phải tạo riêng một bảng `QUIZ` ở giai đoạn đầu nếu quiz được sinh dựa trên vocabulary và quiz type.
>
> Chỉ tạo entity `QUIZ` riêng khi nghiệp vụ thực tế yêu cầu lưu các quiz cố định hoặc quiz session phức tạp.

---

# 5. USER

## 5.1. Mục đích

Lưu thông tin tài khoản người dùng và Admin.

Hệ thống chỉ có hai role:

```text
USER
ADMIN
```

## 5.2. Dữ liệu dự kiến

```text
USER

- id
- email
- password_hash
- display_name
- avatar_url
- role
- is_active
- total_xp
- created_at
- updated_at
```

### Role

```text
USER
ADMIN
```

### Quy tắc

- Email phải unique.
- Password phải được lưu dưới dạng hash.
- Không lưu plaintext password.
- `role` dùng để phân quyền Backend.
- `is_active` xác định tài khoản có đang hoạt động hay không.
- `total_xp` là tổng XP của user.
- Level được tính dựa trên `total_xp` ở Backend Service.
- Không lưu `level` trực tiếp trong database ở phiên bản đầu để tránh dữ liệu XP và Level bị lệch.

### Account Status

```text
is_active = true
→ Tài khoản đang hoạt động.

is_active = false
→ Tài khoản bị vô hiệu hóa.
```

---

# 6. VOCABULARY

## 6.1. Mục đích

Lưu thông tin cơ bản của một từ tiếng Anh.

Ví dụ:

```text
work
dessert
book
```

## 6.2. Dữ liệu dự kiến

```text
VOCABULARY

- id
- word
- phonetic
- pronunciation_url
- difficulty_level
- created_at
- updated_at
```

## 6.3. Giải thích

### `word`

Từ tiếng Anh.

Ví dụ:

```text
work
```

### `phonetic`

Phiên âm của từ.

Ví dụ:

```text
/wɜːrk/
```

### `pronunciation_url`

Đường dẫn tới audio phát âm mẫu nếu hệ thống sử dụng file audio bên ngoài.

### `difficulty_level`

Mức độ khó của từ.

Có thể sử dụng:

```text
BEGINNER
INTERMEDIATE
ADVANCED
```

`part_of_speech` không được lưu trực tiếp trong `VOCABULARY` vì một từ có thể có nhiều Meaning và mỗi Meaning có thể có Part of Speech khác nhau.

---

# 7. VOCABULARY_MEANING

## 7.1. Mục đích

Một từ tiếng Anh có thể có nhiều nghĩa.

Ví dụ:

```text
book
```

có thể là:

```text
quyển sách
đặt trước
```

Do đó không nên lưu duy nhất một trường `meaning` trong `VOCABULARY`.

## 7.2. Dữ liệu dự kiến

```text
VOCABULARY_MEANING

- id
- vocabulary_id
- part_of_speech
- meaning_vi
- context
- created_at
- updated_at
```

## 7.3. Giải thích

### `part_of_speech`

Loại từ của Meaning.

Ví dụ:

```text
noun
verb
adjective
adverb
```

Một Vocabulary có thể có nhiều Meaning với Part of Speech khác nhau.

Ví dụ:

```text
Vocabulary:
work

Meaning 1:
Part of Speech: noun
Meaning: công việc

Meaning 2:
Part of Speech: verb
Meaning: làm việc
```

### `context`

Ngữ cảnh sử dụng của Meaning.

## 7.4. Relationship

```text
VOCABULARY 1 ─── N VOCABULARY_MEANING
```

Một Vocabulary có thể có nhiều Meaning.

Một Meaning chỉ thuộc về một Vocabulary.

---

# 8. VOCABULARY_EXAMPLE

## 8.1. Mục đích

Lưu các câu ví dụ giúp người học hiểu cách sử dụng từ trong ngữ cảnh.

## 8.2. Dữ liệu dự kiến

```text
VOCABULARY_EXAMPLE

- id
- meaning_id
- example_en
- example_vi
- created_at
```

## 8.3. Relationship

```text
VOCABULARY
    │
    └── VOCABULARY_MEANING
            │
            └── VOCABULARY_EXAMPLE
```

Một Meaning có thể có nhiều Example.

Ví dụ:

```text
Vocabulary:

work

Meaning:

công việc

Example:

I have a lot of work today.
```

---

# 9. VOCABULARY_SET

## 9.1. Mục đích

Vocabulary Set là một tập hợp các từ vựng được sử dụng để tổ chức nội dung học tập.

Set có thể:

- Do Admin tạo.
- Do User tạo.
- Được chia sẻ thông qua Community.
- Được User khác sao chép về tài khoản cá nhân.

## 9.2. Dữ liệu dự kiến

```text
VOCABULARY_SET

- id
- owner_id
- name
- description
- is_public
- created_at
- updated_at
```

`owner_id` tham chiếu tới `USER`.

## 9.3. Ownership Rules

### Admin-created Vocabulary Set

Vocabulary Set do Admin tạo là Public Set.

```text
ADMIN
  ↓
PUBLIC VOCABULARY SET
```

User có thể:

- Xem Set.
- Học trực tiếp Set.
- Sao chép Set vào tài khoản cá nhân.

User không có quyền:

- Chỉnh sửa Set gốc.
- Xóa Set gốc.

### User-created Vocabulary Set

Vocabulary Set do User tạo là Private Set mặc định.

```text
USER
  ↓
PRIVATE VOCABULARY SET
```

Owner có thể:

- Xem.
- Học.
- Thêm Vocabulary.
- Xóa Vocabulary.
- Chỉnh sửa thông tin Set.
- Xóa Set.

User không thể trực tiếp chuyển Set cá nhân thành Public Set.

### Community Sharing

Nếu User muốn chia sẻ Set cá nhân:

```text
USER VOCABULARY SET
        ↓
   COMMUNITY POST
        ↓
   OTHER USERS
```

Vocabulary Set gốc vẫn thuộc quyền sở hữu của User tạo ra.

### Copy Vocabulary Set

User có thể sao chép:

- Public Set của Admin.
- Set được User khác chia sẻ thông qua Community.

Khi copy:

```text
Original Vocabulary Set
        ↓
   Copy / Add to My Sets
        ↓
New Vocabulary Set
```

Hệ thống tạo một `VOCABULARY_SET` mới với:

```text
owner_id = User thực hiện copy
is_public = false
```

Các `VOCABULARY_SET_ITEM` của Set gốc cũng được sao chép sang Set mới.

Bản sao là một Set độc lập.

User thực hiện copy:

- Có thể học bản sao.
- Có thể chỉnh sửa bản sao.
- Có thể xóa bản sao.
- Không có quyền chỉnh sửa Set gốc.
- Không có quyền xóa Set gốc.

Việc chỉnh sửa bản sao không ảnh hưởng tới Set gốc.

## 9.4. Relationship

```text
USER 1 ─── N VOCABULARY_SET
```

Một User có thể sở hữu nhiều Vocabulary Set.

```text
VOCABULARY_SET N ─── N VOCABULARY
```

Quan hệ này được xử lý thông qua `VOCABULARY_SET_ITEM`.

---

# 10. VOCABULARY_SET_ITEM

## 10.1. Mục đích

Bảng trung gian kết nối Vocabulary và Vocabulary Set.

## 10.2. Dữ liệu

```text
VOCABULARY_SET_ITEM

- id
- vocabulary_set_id
- vocabulary_id
- created_at
```

## 10.3. Relationship

```text
VOCABULARY_SET
        │
        └── N VOCABULARY_SET_ITEM N ── VOCABULARY
```

Một Set có nhiều Vocabulary.

Một Vocabulary có thể xuất hiện trong nhiều Set.

## 10.4. Constraint

Không cho phép một Vocabulary xuất hiện nhiều lần trong cùng một Set.

Logical constraint:

```text
UNIQUE(vocabulary_set_id, vocabulary_id)
```

---

# 11. LEARNING_PROGRESS

## 11.1. Mục đích

Theo dõi tiến độ học của từng User đối với từng Vocabulary.

Đây là entity quan trọng của hệ thống.

Ví dụ:

```text
User A
    ↓
work
    ↓
Learning Progress
```

## 11.2. Dữ liệu dự kiến

```text
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
```

## 11.3. Status

Có thể sử dụng:

```text
NEW
LEARNING
REVIEW
MASTERED
```

### NEW

User chưa học từ này.

### LEARNING

User đã bắt đầu học nhưng chưa ghi nhớ ổn định.

### REVIEW

Từ đang được đưa vào quá trình ôn tập.

### MASTERED

User đã đạt mức độ ghi nhớ tốt theo rule của hệ thống.

## 11.4. User-specific Progress

Learning Progress thuộc về từng User.

Ví dụ:

```text
User A + work
→ Learning Progress của User A

User B + work
→ Learning Progress của User B
```

Hai User không sử dụng chung Learning Progress.

---

# 12. Spaced Repetition

Spaced Repetition không cần tạo một bảng riêng.

Thông tin cần thiết có thể được lưu trong:

```text
LEARNING_PROGRESS
```

Các trường quan trọng:

```text
last_reviewed_at
next_review_at
interval_days
ease_factor
review_count
```

Backend sẽ chịu trách nhiệm tính toán lịch ôn tập.

Ví dụ:

```text
User trả lời đúng
        ↓
Spaced Repetition Service
        ↓
Tăng interval
        ↓
Tính next_review_at
        ↓
Update LEARNING_PROGRESS
```

Business logic của Spaced Repetition phải nằm ở Backend Service, không nằm ở Controller hoặc Frontend.

Thuật toán Spaced Repetition cụ thể có thể được điều chỉnh trong quá trình phát triển nhưng không tạo entity riêng chỉ để lưu thuật toán.

---

# 13. QUIZ_ATTEMPT

## 13.1. Mục đích

Lưu lịch sử User thực hiện các câu hỏi luyện tập.

Hệ thống hiện tại chỉ hỗ trợ **2 Quiz Type**:

```text
VI_TO_ENGLISH
MISSING_LETTER
```

AI Agent không được tự ý thêm Quiz Type mới nếu chưa được người phát triển phê duyệt.

## 13.2. Dữ liệu dự kiến

```text
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
```

## 13.3. Quiz Type

```text
VI_TO_ENGLISH
MISSING_LETTER
```

### VI_TO_ENGLISH

User nhìn thấy nghĩa tiếng Việt hoặc thông tin ngữ cảnh và nhập từ tiếng Anh.

### MISSING_LETTER

User hoàn thành từ tiếng Anh bị thiếu một hoặc nhiều ký tự.

## 13.4. Character-level Feedback

Đối với Quiz yêu cầu nhập câu trả lời, hệ thống có thể so sánh từng ký tự giữa:

```text
user_answer
correct_answer
```

để tạo feedback theo từng vị trí.

Ví dụ:

```text
User answer:
deserst

Correct answer:
dessert
```

Backend có thể xác định:

- Ký tự đúng.
- Ký tự sai.
- Vị trí tương ứng.

Không tạo bảng riêng để lưu kết quả từng ký tự nếu không thực sự cần thiết.

## 13.5. Quiz Data Principle

Quiz không nên lưu toàn bộ nội dung Quiz một cách dư thừa nếu câu hỏi có thể được tạo từ dữ liệu Vocabulary.

Luồng:

```text
VOCABULARY
      ↓
Quiz Service
      ↓
Generate Question
      ↓
User Answers
      ↓
QUIZ_ATTEMPT
```

`QUIZ_ATTEMPT` chủ yếu lưu kết quả và lịch sử.

Không tạo nhiều bảng như:

```text
VI_TO_ENGLISH_QUIZ
MISSING_LETTER_QUIZ
```

trừ khi nghiệp vụ trong tương lai chứng minh rằng các Quiz Type có cấu trúc dữ liệu hoàn toàn khác nhau.

---

# 14. Pronunciation Data Principle

Pronunciation là một module học tập riêng, không phải Quiz Type.

Thông tin phát âm mẫu được lưu trong:

```text
VOCABULARY
├── phonetic
└── pronunciation_url
```

User có thể:

```text
Nghe phát âm mẫu
        ↓
Tự phát âm
        ↓
Hệ thống phân tích
        ↓
Feedback
```

Ở phiên bản đầu:

- Không bắt buộc lưu audio của User vào Database.
- Không bắt buộc tạo `PRONUNCIATION_ATTEMPT`.
- Không tạo các bảng pronunciation riêng nếu chưa có nhu cầu thực tế.

Nếu sau này cần lưu lịch sử pronunciation attempt, phải thiết kế migration và cập nhật tài liệu Database trước khi triển khai.

---

# 15. STREAK

## 15.1. Mục đích

Theo dõi chuỗi ngày học liên tiếp của User.

## 15.2. Dữ liệu dự kiến

```text
STREAK

- id
- user_id
- current_streak
- longest_streak
- last_activity_date
- updated_at
```

Relationship:

```text
USER 1 ─── 1 STREAK
```

Một User có một Streak record chính.

## 15.3. Quy tắc

Khi User có hoạt động học hợp lệ:

```text
Activity today
        ↓
Check last_activity_date
        ↓
Nếu là ngày liên tiếp
        → tăng current_streak

Nếu bị gián đoạn
        → reset current_streak

Nếu current_streak > longest_streak
        → update longest_streak
```

Logic này thuộc Backend Service.

---

# 16. ACHIEVEMENT

## 16.1. Mục đích

Lưu danh sách thành tích của hệ thống.

Ví dụ:

```text
First Lesson
Vocabulary Beginner
7 Day Streak
100 Words
500 XP
```

## 16.2. Dữ liệu dự kiến

```text
ACHIEVEMENT

- id
- name
- description
- icon_url
- condition_type
- condition_value
- created_at
- updated_at
```

`condition_type` xác định loại điều kiện.

Ví dụ:

```text
WORDS_LEARNED
XP_REACHED
STREAK_REACHED
QUIZ_COMPLETED
```

`condition_value` là giá trị cần đạt.

Ví dụ:

```text
condition_type = STREAK_REACHED
condition_value = 7
```

---

# 17. USER_ACHIEVEMENT

## 17.1. Mục đích

Lưu Achievement mà User đã đạt được.

## 17.2. Dữ liệu

```text
USER_ACHIEVEMENT

- id
- user_id
- achievement_id
- achieved_at
```

## 17.3. Relationship

```text
USER N ─── N ACHIEVEMENT
```

Thông qua:

```text
USER_ACHIEVEMENT
```

## 17.4. Constraint

Không cho phép User nhận cùng một Achievement nhiều lần nếu Achievement đó chỉ có thể đạt một lần.

Logical constraint:

```text
UNIQUE(user_id, achievement_id)
```

---

# 18. COMMUNITY_POST

## 18.1. Mục đích

Lưu bài đăng trong khu vực Community.

Community là feature hỗ trợ việc chia sẻ và khám phá nội dung học tập liên quan đến Vocabulary Set.

## 18.2. Dữ liệu dự kiến

```text
COMMUNITY_POST

- id
- user_id
- vocabulary_set_id
- title
- content
- created_at
- updated_at
```

`vocabulary_set_id` tham chiếu tới Vocabulary Set được chia sẻ.

## 18.3. Relationship

```text
USER 1 ─── N COMMUNITY_POST

VOCABULARY_SET 1 ─── N COMMUNITY_POST
```

Một Community Post thuộc về một User.

Một Community Post có thể liên kết với một Vocabulary Set được chia sẻ.

## 18.4. Sharing Rule

Community Post không chuyển quyền sở hữu Vocabulary Set.

Ví dụ:

```text
User A
  ↓
Owns Vocabulary Set A
  ↓
Creates Community Post
  ↓
Shares Set A
  ↓
User B copies Set A
```

Set gốc vẫn thuộc User A.

User B nhận được một Vocabulary Set mới thuộc User B.

---

# 19. COMMUNITY_COMMENT

## 19.1. Mục đích

Lưu bình luận của User trên bài đăng.

## 19.2. Dữ liệu dự kiến

```text
COMMUNITY_COMMENT

- id
- post_id
- user_id
- content
- created_at
- updated_at
```

## 19.3. Relationship

```text
COMMUNITY_POST 1 ─── N COMMUNITY_COMMENT

USER 1 ─── N COMMUNITY_COMMENT
```

---

# 20. Entity Relationship Overview

Mô hình quan hệ tổng quát:

```text
                           ┌──────────────────┐
                           │       USER       │
                           └────────┬─────────┘
                                    │
              ┌─────────────────────┼────────────────────────┐
              │                     │                        │
              ▼                     ▼                        ▼
     ┌─────────────────┐   ┌─────────────────┐    ┌─────────────────┐
     │ LEARNING_       │   │ QUIZ_ATTEMPT    │    │     STREAK      │
     │ PROGRESS        │   └────────┬────────┘    └─────────────────┘
     └────────┬────────┘            │
              │                     │
              └──────────┬──────────┘
                         ▼
                ┌─────────────────┐
                │   VOCABULARY    │
                └────────┬────────┘
                         │
                  ┌──────┴──────────────┐
                  │                     │
                  ▼                     ▼
       ┌─────────────────────┐  ┌─────────────────────┐
       │ VOCABULARY_MEANING  │  │ VOCABULARY_SET_ITEM │
       └──────────┬──────────┘  └──────────┬──────────┘
                  │                        │
                  ▼                        ▼
       ┌─────────────────────┐   ┌─────────────────┐
       │ VOCABULARY_EXAMPLE  │   │ VOCABULARY_SET  │
       └─────────────────────┘   └────────┬────────┘
                                         │
                                         │
                                         ▼
                                ┌─────────────────┐
                                │ COMMUNITY_POST  │
                                └────────┬────────┘
                                         │
                                         ▼
                                ┌─────────────────┐
                                │ COMMUNITY_      │
                                │ COMMENT         │
                                └─────────────────┘


                ┌─────────────────┐
                │   ACHIEVEMENT   │
                └────────┬────────┘
                         │
                         │
                         ▼
                ┌─────────────────┐
                │ USER_ACHIEVEMENT│
                └────────┬────────┘
                         │
                         │
                         ▼
                        USER
```

Các quan hệ quan trọng:

```text
USER
 ├── LEARNING_PROGRESS
 ├── QUIZ_ATTEMPT
 ├── STREAK
 ├── VOCABULARY_SET
 ├── COMMUNITY_POST
 ├── COMMUNITY_COMMENT
 └── USER_ACHIEVEMENT

VOCABULARY
 ├── VOCABULARY_MEANING
 ├── LEARNING_PROGRESS
 ├── QUIZ_ATTEMPT
 └── VOCABULARY_SET_ITEM

VOCABULARY_MEANING
 └── VOCABULARY_EXAMPLE

VOCABULARY_SET
 ├── VOCABULARY_SET_ITEM
 └── COMMUNITY_POST

ACHIEVEMENT
 └── USER_ACHIEVEMENT

COMMUNITY_POST
 └── COMMUNITY_COMMENT
```

---

# 21. Main Relationships

| Relationship                            | Cardinality |
| --------------------------------------- | ----------- |
| USER → LEARNING_PROGRESS                | 1:N         |
| VOCABULARY → LEARNING_PROGRESS          | 1:N         |
| USER → QUIZ_ATTEMPT                     | 1:N         |
| VOCABULARY → QUIZ_ATTEMPT               | 1:N         |
| USER → STREAK                           | 1:1         |
| VOCABULARY → VOCABULARY_MEANING         | 1:N         |
| VOCABULARY_MEANING → VOCABULARY_EXAMPLE | 1:N         |
| USER → VOCABULARY_SET                   | 1:N         |
| VOCABULARY_SET → VOCABULARY_SET_ITEM    | 1:N         |
| VOCABULARY → VOCABULARY_SET_ITEM        | 1:N         |
| USER → COMMUNITY_POST                   | 1:N         |
| VOCABULARY_SET → COMMUNITY_POST         | 1:N         |
| COMMUNITY_POST → COMMUNITY_COMMENT      | 1:N         |
| USER → COMMUNITY_COMMENT                | 1:N         |
| USER → USER_ACHIEVEMENT                 | 1:N         |
| ACHIEVEMENT → USER_ACHIEVEMENT          | 1:N         |

---

# 22. Indexing Strategy

Index chỉ được thêm khi có nhu cầu truy vấn thực tế.

Các index quan trọng dự kiến:

## USER

```text
UNIQUE(email)
```

## VOCABULARY

Có thể index:

```text
word
difficulty_level
```

Nếu `word` được tìm kiếm thường xuyên, `word` nên có index phù hợp.

## VOCABULARY_MEANING

```text
vocabulary_id
```

## VOCABULARY_EXAMPLE

```text
meaning_id
```

## VOCABULARY_SET

```text
owner_id
is_public
```

## VOCABULARY_SET_ITEM

```text
vocabulary_set_id
vocabulary_id
UNIQUE(vocabulary_set_id, vocabulary_id)
```

## LEARNING_PROGRESS

```text
user_id
vocabulary_id
next_review_at
UNIQUE(user_id, vocabulary_id)
```

## QUIZ_ATTEMPT

```text
user_id
vocabulary_id
created_at
```

## STREAK

```text
UNIQUE(user_id)
```

## ACHIEVEMENT

Có thể index:

```text
condition_type
```

nếu cần cho truy vấn kiểm tra Achievement.

## USER_ACHIEVEMENT

```text
user_id
achievement_id
UNIQUE(user_id, achievement_id)
```

## COMMUNITY_POST

```text
user_id
vocabulary_set_id
created_at
```

## COMMUNITY_COMMENT

```text
post_id
user_id
created_at
```

---

# 23. Foreign Key Rules

Các relationship quan trọng phải sử dụng Foreign Key.

Ví dụ:

```text
VOCABULARY_MEANING.vocabulary_id
        → VOCABULARY.id
```

```text
VOCABULARY_EXAMPLE.meaning_id
        → VOCABULARY_MEANING.id
```

```text
VOCABULARY_SET.owner_id
        → USER.id
```

```text
VOCABULARY_SET_ITEM.vocabulary_set_id
        → VOCABULARY_SET.id
```

```text
VOCABULARY_SET_ITEM.vocabulary_id
        → VOCABULARY.id
```

```text
LEARNING_PROGRESS.user_id
        → USER.id
```

```text
LEARNING_PROGRESS.vocabulary_id
        → VOCABULARY.id
```

```text
QUIZ_ATTEMPT.user_id
        → USER.id
```

```text
QUIZ_ATTEMPT.vocabulary_id
        → VOCABULARY.id
```

```text
COMMUNITY_POST.user_id
        → USER.id
```

```text
COMMUNITY_POST.vocabulary_set_id
        → VOCABULARY_SET.id
```

```text
COMMUNITY_COMMENT.post_id
        → COMMUNITY_POST.id
```

```text
COMMUNITY_COMMENT.user_id
        → USER.id
```

```text
USER_ACHIEVEMENT.user_id
        → USER.id
```

```text
USER_ACHIEVEMENT.achievement_id
        → ACHIEVEMENT.id
```

Foreign Key behavior phải được cân nhắc theo từng entity.

Không được sử dụng cascade delete một cách tùy tiện.

Đặc biệt cần thận trọng với:

- User.
- Vocabulary.
- Vocabulary Set.
- Learning Progress.
- Quiz History.
- Community Post.
- Achievement.

Dữ liệu lịch sử học tập không nên bị xóa ngoài ý muốn chỉ vì một entity liên quan bị thay đổi.

---

# 24. Data Integrity

Database phải đảm bảo:

## Unique

Các dữ liệu cần unique phải được kiểm soát ở Database.

Ví dụ:

```text
USER.email
```

```text
LEARNING_PROGRESS(user_id, vocabulary_id)
```

```text
VOCABULARY_SET_ITEM(vocabulary_set_id, vocabulary_id)
```

```text
USER_ACHIEVEMENT(user_id, achievement_id)
```

## Not Null

Các trường bắt buộc phải được xác định rõ là `NOT NULL`.

Ví dụ:

```text
USER.email
USER.password_hash
VOCABULARY.word
VOCABULARY_MEANING.meaning_vi
VOCABULARY_SET.name
```

## Foreign Key

Các relationship quan trọng phải được đảm bảo bằng Foreign Key.

---

# 25. Soft Delete

Không mặc định thêm `deleted_at` vào tất cả các bảng.

Chỉ sử dụng soft delete cho entity khi nghiệp vụ thực tế yêu cầu khôi phục hoặc giữ lịch sử.

Ví dụ có thể cân nhắc:

```text
COMMUNITY_POST
```

hoặc dữ liệu quản trị cần giữ lịch sử.

AI Agent không được tự động thêm soft delete vào toàn bộ schema.

---

# 26. Timestamps

Các entity chính nên sử dụng:

```text
created_at
updated_at
```

Không phải mọi bảng đều bắt buộc có `updated_at`.

Ví dụ:

```text
USER
VOCABULARY
VOCABULARY_MEANING
VOCABULARY_SET
LEARNING_PROGRESS
COMMUNITY_POST
COMMUNITY_COMMENT
ACHIEVEMENT
```

Các bảng chỉ lưu event/history có thể chỉ cần:

```text
created_at
```

Ví dụ:

```text
QUIZ_ATTEMPT
USER_ACHIEVEMENT
VOCABULARY_EXAMPLE
```

---

# 27. Learning Data Principle

Learning Progress là dữ liệu theo User.

Do đó:

```text
USER + VOCABULARY
        ↓
LEARNING_PROGRESS
```

Mỗi cặp:

```text
(user_id, vocabulary_id)
```

chỉ nên có một Learning Progress record.

Điều này giúp hệ thống có thể truy vấn:

```text
Các từ User chưa học.

Các từ User đang học.

Các từ cần ôn hôm nay.

Các từ đã mastered.
```

Tiến độ học của User không phụ thuộc vào việc Vocabulary nằm trong Set nào.

Ví dụ:

```text
User A học "work" từ Admin Set
        ↓
Learning Progress của User A

User A học "work" từ Community Set
        ↓
Vẫn sử dụng Learning Progress của User A đối với "work"
```

---

# 28. Gamification Data Principle

Gamification bao gồm:

```text
XP
Level
Streak
Achievement
```

Trong đó:

- XP được lưu trực tiếp trong `USER` ở phiên bản đầu.
- Level được tính từ `USER.total_xp` ở Backend Service.
- Không lưu Level riêng trong Database ở phiên bản đầu.
- Streak được quản lý bởi `STREAK`.
- Achievement được quản lý bởi `ACHIEVEMENT + USER_ACHIEVEMENT`.

Không tạo thêm bảng riêng cho từng loại XP event nếu chưa có nhu cầu audit XP chi tiết.

Nếu sau này cần lịch sử XP, có thể bổ sung:

```text
XP_TRANSACTION
```

nhưng **không tạo ở phiên bản đầu nếu chưa cần thiết**.

---

# 29. Vocabulary Set Data Principle

Vocabulary Set có hai nguồn chính:

```text
ADMIN
  ↓
PUBLIC SET

USER
  ↓
PRIVATE SET
```

### Admin Public Set

User có thể:

```text
View
Learn
Copy
```

nhưng không thể:

```text
Edit original
Delete original
```

### User Private Set

Owner có thể:

```text
View
Learn
Edit
Delete
```

### Copy

Copy Set không tạo relationship ownership mới với Set gốc.

Hệ thống tạo:

```text
New VOCABULARY_SET
        +
New VOCABULARY_SET_ITEM records
```

Set mới thuộc User thực hiện copy.

Không cần tạo các bảng:

```text
VOCABULARY_SET_DOWNLOAD
VOCABULARY_SET_COPY
VOCABULARY_SET_OWNER
```

cho nghiệp vụ này.

---

# 30. Community Data Principle

Community là module hỗ trợ hệ thống học từ vựng.

Database Community ở phiên bản đầu tập trung vào:

```text
COMMUNITY_POST
COMMUNITY_COMMENT
```

`COMMUNITY_POST` có thể liên kết với `VOCABULARY_SET` để hỗ trợ chia sẻ Vocabulary Set.

Luồng chia sẻ:

```text
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
```

Community không làm thay đổi ownership của Set gốc.

Không mặc định triển khai:

- Chat realtime.
- Follow user.
- Friend system.
- Notification system.
- Reaction system.
- Report system.

Các feature này chỉ được thêm khi được xác định rõ trong phạm vi dự án.

---

# 31. Admin Data

Không tạo bảng `ADMIN` riêng.

Admin là một User có:

```text
USER.role = ADMIN
```

Admin sử dụng các quyền đặc biệt để:

- Quản lý Vocabulary.
- Quản lý Vocabulary Meaning.
- Quản lý Vocabulary Example.
- Quản lý Vocabulary Set hệ thống.
- Quản lý Achievement.
- Quản lý Community Content.
- Quản lý User khi cần.
- Xem dữ liệu thống kê hệ thống.

Authorization phải được xử lý ở Backend.

---

# 32. Database Security

Frontend không được truy cập trực tiếp PostgreSQL.

Luồng dữ liệu:

```text
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
```

Database credentials phải được lưu trong environment variables.

Không commit:

```text
DATABASE_URL
JWT_SECRET
SUPABASE_SECRET_KEY
```

hoặc các secret tương tự vào Git repository.

---

# 33. Transaction

Transaction được sử dụng khi một business operation cập nhật nhiều dữ liệu và cần đảm bảo tính toàn vẹn.

Ví dụ:

```text
Submit Quiz
    ↓
Save Quiz Attempt
    ↓
Update Learning Progress
    ↓
Update XP
    ↓
Update Streak
    ↓
Check Achievement
```

Nếu nghiệp vụ yêu cầu các bước trên thành một atomic operation, Backend Service phải sử dụng Database Transaction.

### Copy Vocabulary Set

Copy Vocabulary Set cũng nên được thực hiện trong một transaction:

```text
Create New Vocabulary Set
        ↓
Copy Vocabulary Set Items
        ↓
Commit
```

Nếu một bước thất bại, toàn bộ operation phải được rollback để tránh tạo Set không đầy đủ.

Không tự động sử dụng transaction cho mọi query đơn giản.

---

# 34. Initial Database Scope

Phiên bản đầu tiên của Database dự kiến gồm:

```text
1. USER
2. VOCABULARY
3. VOCABULARY_MEANING
4. VOCABULARY_EXAMPLE
5. VOCABULARY_SET
6. VOCABULARY_SET_ITEM
7. LEARNING_PROGRESS
8. QUIZ_ATTEMPT
9. STREAK
10. ACHIEVEMENT
11. USER_ACHIEVEMENT
12. COMMUNITY_POST
13. COMMUNITY_COMMENT
```

Tổng cộng:

```text
13 tables
```

Đây là phạm vi Database dự kiến, không phải yêu cầu bắt buộc phải giữ nguyên 13 bảng nếu trong quá trình thiết kế chi tiết phát hiện một entity không cần thiết.

Ngược lại, AI Agent không được tự ý mở rộng thành hàng chục bảng chỉ vì muốn thiết kế "enterprise".

Các feature như Pronunciation và Spaced Repetition không tạo thêm table riêng ở phiên bản đầu nếu dữ liệu có thể được xử lý bằng các entity hiện tại.

---

# 35. Future Extension

Các entity sau có thể được xem xét trong tương lai:

```text
XP_TRANSACTION
NOTIFICATION
VOCABULARY_FAVORITE
USER_FOLLOW
COMMUNITY_REACTION
COMMUNITY_REPORT
QUIZ_SESSION
AI_GENERATION_HISTORY
PRONUNCIATION_ATTEMPT
```

Những entity này **không thuộc Initial Database Scope**.

Đây chỉ là các hướng mở rộng tiềm năng, không phải thiết kế đã được phê duyệt.

AI Agent không được tự tạo các entity này nếu feature tương ứng chưa được xác định và phê duyệt.

---

# 36. Database Change Rules

AI Agent phải tuân thủ:

## Không được tự ý

- Đổi PostgreSQL sang Database khác.
- Xóa entity quan trọng.
- Đổi relationship quan trọng.
- Thêm hàng loạt bảng không có trong scope.
- Đưa business logic vào Database thay vì Backend.
- Cho Frontend truy cập Database trực tiếp.
- Lưu plaintext password.
- Bỏ Foreign Key khỏi relationship quan trọng.
- Tạo bảng riêng cho từng Quiz Type nếu chưa có lý do nghiệp vụ.
- Tạo bảng riêng cho USER và ADMIN.
- Tạo bảng riêng cho Copy/Download Vocabulary Set nếu nghiệp vụ hiện tại không yêu cầu.
- Tạo bảng riêng cho Spaced Repetition chỉ vì có thuật toán ôn tập.
- Tạo bảng riêng cho Pronunciation nếu chưa có nhu cầu lưu lịch sử pronunciation attempt.

## Được phép

- Bổ sung index khi có lý do về query performance.
- Bổ sung constraint để bảo vệ data integrity.
- Điều chỉnh tên field cho nhất quán.
- Điều chỉnh kiểu dữ liệu nếu có lý do kỹ thuật.
- Đề xuất entity mới khi feature yêu cầu.
- Tạo migration khi business requirement thay đổi.
- Điều chỉnh Foreign Key behavior nếu có lý do rõ ràng về data integrity.

Mọi thay đổi làm ảnh hưởng đến domain model hoặc relationship quan trọng phải được người phát triển phê duyệt trước.

---

# 37. Source of Truth

Thứ tự ưu tiên tài liệu:

```text
PROJECT_OVERVIEW.md
        ↓
ARCHITECTURE.md
        ↓
DATABASE.md
        ↓
API_SPEC.md
        ↓
Feature-specific documentation
```

Nếu có mâu thuẫn:

1. `PROJECT_OVERVIEW.md` xác định phạm vi nghiệp vụ.
2. `ARCHITECTURE.md` xác định kiến trúc hệ thống.
3. `DATABASE.md` xác định mô hình dữ liệu.
4. `API_SPEC.md` xác định API contract.
5. Feature documentation mô tả chi tiết implementation của feature.

AI Agent không được sử dụng implementation hiện tại để tự động thay đổi source of truth.

---

# 38. Core Database Principle

Database của hệ thống phải hướng tới:

```text
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
```

Không thiết kế Database phức tạp chỉ để thể hiện công nghệ.

Mục tiêu là xây dựng một Database:

- Đủ cho phạm vi đồ án.
- Dễ hiểu.
- Dễ triển khai với PostgreSQL/Supabase.
- Dễ sử dụng với Prisma.
- Dễ test.
- Dễ mở rộng khi feature thực sự cần.
- Phù hợp với kiến trúc Backend REST API.
