# PROJECT OVERVIEW — English Vocabulary Learning Platform

> Tài liệu tổng quan chính thức về phạm vi và định hướng chức năng của hệ thống.
> AI Agent phải đọc tài liệu này trước khi phân tích, lập kế hoạch hoặc triển khai các feature liên quan.
> Không được tự ý thay đổi nghiệp vụ, thêm feature ngoài phạm vi hoặc loại bỏ feature đã được xác định nếu chưa được người phát triển phê duyệt.

---

# 1. Tổng quan hệ thống

## 1.1. Tên hệ thống

English Vocabulary Learning Platform

## 1.2. Tên đề tài dự kiến

Xây dựng hệ thống học từ vựng tiếng Anh

## 1.3. Mục tiêu

Xây dựng một nền tảng web hỗ trợ người học tiếng Anh tập trung vào việc học, ghi nhớ và luyện tập từ vựng.

Hệ thống hỗ trợ:

- Khám phá và lựa chọn Vocabulary Set theo Topic.
- Học từ mới bằng Flashcard.
- Nghe phát âm mẫu của từ vựng.
- Luyện phát âm bằng cách tự nói và nhận đánh giá.
- Luyện tập từ vựng qua các dạng Quiz.
- Ôn tập từ vựng theo cơ chế Spaced Repetition.
- Theo dõi Learning Progress.
- Tạo động lực học tập bằng XP, Level, Streak và Achievement.
- Tạo và quản lý Vocabulary Set cá nhân.
- Chia sẻ và khám phá Vocabulary Set trong Community.
- Hệ thống quản trị dành cho Admin.
- Có thể mở rộng thêm một số tính năng AI hỗ trợ học tập nếu được phê duyệt.

Mục tiêu chính của hệ thống là hỗ trợ người học học và ghi nhớ từ vựng hiệu quả, thay vì chỉ cung cấp danh sách từ vựng.

---

# 2. Đối tượng sử dụng và vai trò

Hệ thống có hai authenticated roles:

- User
- Admin

Guest là người dùng chưa đăng nhập và không phải một authenticated role.

## 2.1. Guest

Guest là người chưa đăng nhập.

Có thể:

- Xem Landing Page.
- Xem thông tin giới thiệu hệ thống.
- Đăng ký tài khoản.
- Đăng nhập.
- Khám phá các nội dung công khai được cho phép.

Không được sử dụng các chức năng học tập cá nhân yêu cầu tài khoản.

## 2.2. User

User là người dùng đã đăng ký và đăng nhập.

Có thể:

- Quản lý tài khoản cá nhân.
- Khám phá Topic và Vocabulary Set.
- Học Vocabulary Set.
- Học bằng Flashcard.
- Nghe phát âm mẫu.
- Luyện phát âm.
- Làm Quiz.
- Review từ vựng.
- Theo dõi Learning Progress.
- Nhận XP.
- Tăng Level.
- Duy trì Streak.
- Nhận Achievement.
- Tạo và quản lý Vocabulary Set cá nhân.
- Chia sẻ Vocabulary Set.
- Khám phá Vocabulary Set được chia sẻ.
- Copy Vocabulary Set được phép chia sẻ.
- Tạo và tương tác với nội dung Community trong phạm vi được xác định.

## 2.3. Admin

Admin là người quản trị hệ thống.

Admin có thể:

- Quản lý User.
- Quản lý Vocabulary.
- Quản lý Meaning.
- Quản lý Example.
- Quản lý Topic.
- Quản lý Vocabulary Set hệ thống.
- Quản lý Achievement và nội dung hệ thống khi cần.
- Quản lý Community content khi cần.
- Xem các thống kê quản trị phù hợp.

Admin sử dụng cùng hệ thống User và được phân biệt bằng role `ADMIN`.

---

# 3. Feature Map tổng thể

Hệ thống được chia thành các nhóm chức năng:

1. Authentication
2. Vocabulary
3. Topic
4. Vocabulary Set
5. Flashcard Learning
6. Pronunciation
7. Quiz & Practice
8. Spaced Repetition / SRS
9. Learning Progress
10. Gamification
11. Community
12. Admin Management
13. AI Learning - Optional

Các feature có mức độ ưu tiên khác nhau.

Không phải tất cả feature đều phải được triển khai cùng mức độ ngay từ đầu.

---

# 4. Authentication

## 4.1. Registration

User có thể:

- Tạo tài khoản.
- Nhập thông tin đăng ký.
- Hệ thống kiểm tra dữ liệu hợp lệ.
- Kiểm tra email đã tồn tại.
- Mật khẩu phải được lưu dưới dạng hash.
- Không lưu mật khẩu dạng plaintext.

## 4.2. Login

User có thể đăng nhập bằng thông tin tài khoản.

Hệ thống phải:

- Xác thực thông tin đăng nhập.
- Tạo phiên/token xác thực.
- Trả về thông tin User cần thiết.

## 4.3. Authorization

Hệ thống phân biệt:

- Guest.
- User.
- Admin.

Các API và chức năng phải kiểm tra quyền truy cập phù hợp.

---

# 5. Topic

Topic dùng để phân loại nội dung học tập theo chủ đề.

Ví dụ:

- Business
- Travel
- Education
- Daily Life
- Technology

Topic không trực tiếp quản lý toàn bộ từ vựng.

Mô hình khái niệm:

    Topic
       ↓
    Vocabulary Set
       ↓
    Vocabulary

Một Topic có thể có nhiều Vocabulary Set.

Danh sách Topic thực tế sẽ được xác định trong SPEC/Database Design.

---

# 6. Vocabulary

Vocabulary là dữ liệu cốt lõi của hệ thống.

Một Vocabulary item có thể bao gồm:

- Word.
- Pronunciation / IPA.
- Model pronunciation.
- Part of speech.
- Meaning.
- Multiple meanings.
- Context.
- Example sentence.
- CEFR level.

## 6.1. Multiple Meanings

Một từ có thể có nhiều nghĩa.

Ví dụ:

Một từ tiếng Anh có thể có nghĩa khác nhau tùy theo ngữ cảnh sử dụng.

Hệ thống phải cho phép lưu và hiển thị nhiều Meaning thay vì giả định một Vocabulary chỉ có một Meaning.

Meaning có thể gắn với Context phù hợp.

## 6.2. CEFR

Vocabulary có thể được gắn với cấp độ:

- A1
- A2
- B1
- B2
- C1
- C2

Việc sử dụng CEFR cụ thể sẽ được xác định trong SPEC/Database Design.

---

# 7. Vocabulary Set

Vocabulary Set là tập hợp các Vocabulary phục vụ cho việc học.

## 7.1. System Vocabulary Set

Admin có thể tạo và quản lý các Vocabulary Set chính thức của hệ thống.

System Vocabulary Set có thể được gắn với một Topic.

## 7.2. User Vocabulary Set

User có thể:

- Tạo Vocabulary Set cá nhân.
- Đặt tên.
- Thêm Vocabulary.
- Xóa Vocabulary.
- Quản lý nội dung.

User-created Vocabulary Set là private by default.

User không thể trực tiếp chuyển Vocabulary Set cá nhân thành Public.

Vocabulary Set có thể được chia sẻ thông qua Community theo sharing rules
của hệ thống.

## 7.3. Public Vocabulary Set

Khi User chia sẻ Vocabulary Set thông qua Community:

- User khác có thể khám phá.
- User khác có thể xem.
- User khác có thể copy set.
- User khác có thể sử dụng bản copy để học.

Việc copy tạo ra một Vocabulary Set riêng thuộc sở hữu của User mới.

User mới không thể chỉnh sửa Vocabulary Set gốc.

---

# 8. Flashcard Learning

Flashcard là phương thức học từ mới.

Một Flashcard có thể hiển thị:

- Word.
- IPA.
- Part of speech.
- Meaning.
- Context.
- Example sentence.
- Model pronunciation.

## 8.1. Model Pronunciation

Người dùng có thể nhấn nút 🔊 để nghe cách phát âm mẫu của Vocabulary.

Mục tiêu:

- Giúp người học nghe cách phát âm.
- Hỗ trợ người mới trước khi tự phát âm.
- Không bắt người học phải tự đoán cách đọc chỉ dựa trên chữ viết hoặc IPA.

Model pronunciation là chức năng nghe mẫu.

Nó không phải là chức năng đánh giá phát âm của User.

## 8.2. Flashcard Review

Sau khi học Flashcard, User có thể thực hiện hoạt động review phù hợp.

Kết quả review có thể được sử dụng để cập nhật:

- Learning Progress.
- SRS scheduling.
- XP.
- Streak.

Quy tắc cụ thể phải tuân theo Business Rules đã được phê duyệt.

---

# 9. Quiz & Practice

Hệ thống hỗ trợ các dạng bài tập từ vựng.

## 9.1. Vietnamese → English Full Typing

Hệ thống hiển thị nghĩa tiếng Việt.

Ví dụ:

    Công việc → ______

User phải nhập từ tiếng Anh đầy đủ.

## 9.2. Missing Letters

Hệ thống hiển thị từ bị thiếu một hoặc nhiều ký tự.

Ví dụ:

    w_rk → ______

User phải hoàn thành từ.

## 9.3. Character-level Feedback

Đối với các dạng Quiz nhập chữ, hệ thống hỗ trợ feedback theo từng ký tự/position khi phù hợp.

Ví dụ:

- Ký tự đúng ở đúng vị trí: feedback màu xanh.
- Ký tự sai hoặc sai vị trí: feedback màu đỏ.

Mục tiêu là tạo feedback trực quan và giúp User nhận biết chính xác vị trí sai.

## 9.4. Quiz Result

Sau mỗi Quiz attempt, hệ thống có thể ghi nhận:

- Kết quả đúng/sai.
- Điểm.
- Learning Progress.
- XP.
- Streak.
- SRS information nếu Quiz là một learning/review activity.

Quiz không được tự ý gọi thêm learning/review flow gây cộng thưởng hai lần cho cùng một learning event.

## 9.5. Additional Quiz Types

Hệ thống có thể mở rộng thêm Quiz Types nếu cần.

Tuy nhiên, AI Agent không được tự ý tạo thêm Quiz Type ngoài SPEC đã được phê duyệt.

---

# 10. Pronunciation

Pronunciation là một learning module quan trọng của hệ thống.

Pronunciation gồm hai hoạt động chính:

1. Nghe Model Pronunciation.
2. Pronunciation Practice.

Pronunciation Practice không được coi là một Quiz Type.

## 10.1. Listen to Model Pronunciation

Flow:

    Display Word
        ↓
    Listen Model Pronunciation
        ↓
    User Repeats

User có thể nghe lại Model Pronunciation nhiều lần.

## 10.2. Pronunciation Practice

Flow:

    Display Word
        ↓
    Listen Model Pronunciation
        ↓
    Press Microphone
        ↓
    User Speaks
        ↓
    System Records / Analyzes
        ↓
    Pronunciation Assessment
        ↓
    Result / Feedback
        ↓
    Retry

Các trạng thái chính có thể bao gồm:

- Ready.
- Recording.
- Processing.
- Result.
- Error.
- Unsupported.

## 10.3. Pronunciation Assessment

Hệ thống đánh giá phần phát âm của User.

Kết quả có thể bao gồm:

- Overall score.
- Accuracy score.
- Fluency score.
- Completeness score.
- Pass/Fail.
- Feedback.

Công nghệ và phương pháp tính score cụ thể sẽ được quyết định trong PLAN/Technical Design.

Không được tự ý giả định một dịch vụ hoặc công nghệ cụ thể nếu chưa được phê duyệt.

## 10.4. Passing Rule

Business Rule hiện tại:

    score > 50%  → PASS
    score ≤ 50% → FAIL

Không được tự ý thay đổi ngưỡng này nếu chưa được người phát triển phê duyệt.

## 10.5. Pronunciation History

Nếu được triển khai, hệ thống có thể lưu lịch sử luyện phát âm để:

- Theo dõi tiến bộ.
- Hiển thị kết quả học tập.
- Hỗ trợ Learning Progress.

Cấu trúc lưu trữ cụ thể sẽ được quyết định trong Database Design.

---

# 11. Spaced Repetition System (SRS)

SRS giúp User ôn tập từ vựng theo mức độ ghi nhớ.

Mục tiêu:

- Không bắt User ôn mọi từ với cùng tần suất.
- Tăng tần suất ôn các từ User yếu.
- Giãn khoảng thời gian với các từ User đã nhớ tốt.

## 11.1. Algorithm

Định hướng sử dụng SM-2 hoặc một biến thể phù hợp của Spaced Repetition.

Implementation cụ thể phải được xác định trong PLAN/Technical Design.

## 11.2. Learning Record

Hệ thống cần theo dõi các thông tin cần thiết cho việc scheduling, ví dụ:

- Repetitions.
- Ease factor.
- Interval.
- Last review.
- Next review.
- Review result.

Tên field và schema thực tế sẽ được quyết định trong Database Design.

## 11.3. Review Scheduling

Sau mỗi lần review:

    Review Result
        ↓
    SRS Algorithm
        ↓
    Calculate Next Interval
        ↓
    Calculate Next Review Date
        ↓
    Save Learning Record

## 11.4. Today's Review

Hệ thống có thể tạo danh sách các Vocabulary đến hạn ôn.

Ví dụ:

    Today's Review
    18 words

Quy tắc xác định từ đến hạn phải dựa trên SRS implementation được phê duyệt.

---

# 12. Learning Progress

Hệ thống theo dõi tiến độ học tập của từng User đối với từng Vocabulary.

Learning Progress không chỉ là thống kê tổng số từ.

## 12.1. Vocabulary Learning State

Mỗi User có thể có trạng thái học tập riêng đối với Vocabulary.

Định hướng trạng thái:

    NEW
      ↓
    LEARNING
      ↓
    LEARNED
      ↓
    NEEDS_REVIEW
      ↓
    LEARNED

State cụ thể và điều kiện chuyển state sẽ được xác định trong SPEC.

## 12.2. Topic Progress

Topic Progress được tổng hợp từ Learning Progress của các Vocabulary thuộc các Vocabulary Set của Topic.

Ví dụ:

    Travel
    72% completed

    144 / 200 words learned

Progress phải được tính dựa trên dữ liệu học tập thực tế, không lưu một giá trị aggregate độc lập nếu không cần thiết.

## 12.3. Words to Review

Dashboard có thể hiển thị số Vocabulary cần review.

Ví dụ:

    12 words to review

Danh sách này được xác định dựa trên SRS và Learning Progress.

## 12.4. Learning Statistics

Learning Progress có thể bao gồm:

- Total words learned.
- Words currently learning.
- Words needing review.
- Review count.
- Quiz accuracy.
- Pronunciation results.
- Learning history.
- XP.
- Level.
- Streak.
- Achievement.

---

# 13. Gamification

Gamification được sử dụng để tạo động lực học tập.

Các thành phần chính:

- XP.
- Level.
- Daily Goal.
- Streak.
- Achievement.

Gamification không được làm thay đổi mục tiêu chính là học từ vựng.

---

## 13.1. XP

XP được cộng từ các learning activities hợp lệ.

Quy tắc XP hiện tại là một quy tắc chung cho tất cả User.

### New Word

User học một Vocabulary lần đầu:

    +3 XP

### Review

User review một Vocabulary đã học:

    +1 XP

### Quiz Correct

User trả lời Quiz đúng:

    +3 XP

### Incorrect Quiz

Quiz trả lời sai:

    +0 XP

### Repeated Activity

Việc lặp lại cùng một từ trong cùng một context/activity mà không tạo ra learning event mới:

    +0 XP

Hệ thống phải ngăn việc farming XP thông qua các thao tác không mang lại learning event thực sự.

Ví dụ:

- Mở lại Flashcard không tự động cộng XP.
- Nhấn nghe pronunciation nhiều lần không tự động cộng XP.
- Reload trang không cộng XP.
- Gửi lại cùng một thao tác không hợp lệ không được cộng XP.

---

# 13.2. Level

XP được sử dụng để xác định Level.

    Learning Activity
          ↓
         XP
          ↓
        Level

Level có giới hạn.

### Level Range

Hệ thống sử dụng:

    Level 1 → Level 15

Trong đó:

    Level 15 = MAX LEVEL

Khi User đạt Level 15:

- XP vẫn tiếp tục tăng.
- Level không tăng vượt quá 15.
- Dashboard có thể hiển thị `Level 15 — MAX`.

XP không bị giới hạn bởi Level.

Ví dụ:

    5,250 XP  → Level 15
    8,000 XP  → Level 15
    20,000 XP → Level 15

Bảng XP threshold cụ thể từ Level 1 đến Level 15 sẽ được xác định trong Business Rules/PLAN trước khi triển khai.

Level chỉ phục vụ Gamification.

Level không tự động khóa hoặc mở Vocabulary, Topic hoặc Learning Content nếu chưa có Business Rule riêng.

---

# 13.3. Daily Goal

Daily Goal là mục tiêu XP mà User muốn đạt trong một ngày.

### Default Goal

Mặc định:

    50 XP / day

### Goal Range

User có thể điều chỉnh Daily Goal trong:

    50 → 200 XP / day

Giá trị phải được backend validate.

### Daily Progress

Dashboard hiển thị:

    Today's XP / Daily Goal

Ví dụ:

    35 / 50 XP

Khi sang ngày mới, today's XP được tính lại từ dữ liệu của ngày mới.

Backend không cần reset dữ liệu của toàn bộ User bằng cron.

Hệ thống có thể lưu learning/activity progress theo từng ngày và nếu ngày hiện tại chưa có record thì today's XP được xem là 0.

### Daily Goal Bonus

Khi User hoàn thành Daily Goal, User nhận thêm bonus XP.

Công thức định hướng:

    Bonus = 20% của Daily Goal

Có giới hạn:

    Minimum = 10 XP
    Maximum = 40 XP

Ví dụ:

    Goal 50 XP  → Bonus 10 XP
    Goal 100 XP → Bonus 20 XP
    Goal 150 XP → Bonus 30 XP
    Goal 200 XP → Bonus 40 XP

Bonus chỉ được nhận một lần trong một ngày.

Daily Goal completion được xác định dựa trên Activity XP.

Bonus XP không được tính ngược lại vào điều kiện hoàn thành Daily Goal để tránh vòng lặp cộng thưởng.

### Change Goal

Nếu User thay đổi Daily Goal trong ngày:

- Today's XP không bị reset.
- Nếu giảm Goal và Activity XP hiện tại đã đạt Goal mới, Goal có thể được xem là hoàn thành.
- Nếu tăng Goal, XP đã đạt vẫn được giữ nguyên và progress được tính lại theo Goal mới.
- Bonus chỉ được nhận một lần trong ngày.

---

# 13.4. Streak

Streak biểu thị số ngày User có learning activity liên tiếp.

Streak không dựa đơn thuần vào việc đăng nhập.

## Qualifying Activities

Các hoạt động có thể duy trì Streak:

- Học Vocabulary.
- Flashcard learning.
- Review.
- Quiz.
- Pronunciation Practice.

Các thao tác chỉ xem giao diện không được tính:

- Login.
- Xem Dashboard.
- Xem Profile.
- Xem Topic.
- Xem Vocabulary Set mà không thực hiện learning activity.

## Streak Rules

Nếu:

    Yesterday = learning day
    Today = learning day

thì:

    Streak +1

Nếu User đã được tính Streak trong ngày hiện tại:

    Không cộng thêm.

Nếu User bỏ qua một hoặc nhiều ngày:

    Streak reset về 1 khi User quay lại học.

Nhiều learning activities trong cùng một ngày chỉ tính là một Streak day.

Streak không yêu cầu một mức XP tối thiểu nếu User đã thực hiện một learning activity hợp lệ.

Version 1 không có Streak Freeze.

---

# 13.5. Achievement

Achievement dùng để ghi nhận các mốc học tập.

Ví dụ:

- First Word.
- 100 Words.
- 7 Day Streak.
- Quiz Master.
- Vocabulary Collector.

Danh sách Achievement thực tế và điều kiện đạt sẽ được xác định trong SPEC.

---

# 14. Dashboard

Dashboard là màn hình tổng quan tiến độ học tập của User.

Dashboard có thể hiển thị:

## 14.1. Main Statistics

- Level.
- Total XP.
- Streak.
- Daily Goal.

## 14.2. Daily Goal

Ví dụ:

    Daily Goal
    35 / 50 XP

Hiển thị progress của ngày hiện tại.

## 14.3. Continue Learning

Hiển thị các Topic/Vocabulary Set User đang học hoặc học gần đây.

Ví dụ:

    Travel
    72%
    144 / 200 words learned

    12 words to review

    [Continue Learning]

Có thể hiển thị khoảng 2–3 nội dung học tập phù hợp.

## 14.4. Today's Review

Hiển thị số Vocabulary đang đến hạn review.

Ví dụ:

    18 words to review

## 14.5. Dashboard Principle

Dashboard phải ưu tiên thông tin giúp User biết:

1. Hôm nay cần làm gì?
2. Đang tiến bộ đến đâu?
3. Có từ nào cần review?
4. Có thể tiếp tục học từ đâu?

Không nên biến Dashboard thành màn hình chỉ hiển thị gamification.

---

# 15. Community

Community phục vụ việc chia sẻ nội dung học tập.

Community version 1 tập trung vào:

- Posts.
- Comments.
- Vocabulary Set sharing.

## 15.1. Public Vocabulary Set

User có thể chia sẻ Vocabulary Set ở chế độ Public.

User khác có thể:

- Khám phá.
- Xem.
- Copy.
- Sử dụng bản copy để học.

## 15.2. Posts

User có thể tạo bài đăng Community.

Ví dụ:

- Chia sẻ Vocabulary Set.
- Chia sẻ nội dung học tập.
- Chia sẻ thành tích học tập.

## 15.3. Comments

User có thể bình luận trên Post trong phạm vi được cho phép.

## 15.4. Scope Control

Community version 1 không mặc định bao gồm:

- Like.
- Follow.
- Friends.
- Direct Message.
- Chat.
- Social Feed phức tạp.
- Leaderboard xã hội.
- Full social network.

Các feature trên chỉ được thêm nếu có SPEC và được phê duyệt.

---

# 16. AI Learning Features — Optional

AI là nhóm tính năng mở rộng.

AI không phải điều kiện bắt buộc để hoàn thành toàn bộ Core Learning System.

Nếu triển khai AI, feature cụ thể phải được phê duyệt trước.

Ví dụ các hướng có thể xem xét:

- AI tạo Example.
- AI giải thích Meaning/Usage/Context.
- AI tạo Quiz.
- AI hỗ trợ phân biệt các từ tương tự.

Không được tự ý thêm AI feature chỉ vì công nghệ có thể hỗ trợ.

AI không được làm thay đổi Business Rules của Core Learning System nếu chưa được phê duyệt.

---

# 17. Admin Management

Admin có quyền quản trị nội dung và người dùng.

## 17.1. User Management

Admin có thể:

- Xem danh sách User.
- Xem thông tin cần thiết.
- Khóa/mở khóa tài khoản.
- Quản lý role theo authorization rules.

## 17.2. Vocabulary Management

Admin có thể:

- Tạo Vocabulary.
- Chỉnh sửa Vocabulary.
- Xóa Vocabulary.
- Quản lý Meaning.
- Quản lý IPA.
- Quản lý Model Pronunciation.
- Quản lý Example.
- Quản lý Topic.
- Quản lý CEFR.

## 17.3. Vocabulary Set Management

Admin có thể:

- Xem Vocabulary Set.
- Tạo System Vocabulary Set.
- Chỉnh sửa System Vocabulary Set.
- Xóa System Vocabulary Set.
- Quản lý nội dung set.

## 17.4. Achievement Management

Admin có thể quản lý Achievement và các nội dung hệ thống liên quan nếu được triển khai.

## 17.5. Community Management

Admin có thể:

- Xem Posts.
- Xem Comments.
- Xử lý nội dung vi phạm.
- Ẩn/xóa nội dung khi cần theo moderation rules.

## 17.6. Admin Dashboard

Admin Dashboard có thể hiển thị các thống kê như:

- Total users.
- Active users.
- Total vocabulary.
- Total vocabulary sets.
- Learning activities.
- Quiz attempts.
- Pronunciation attempts.
- Community activity.

Các chỉ số cụ thể sẽ được xác định trong SPEC/PLAN.

---

# 18. Feature Priority

Để kiểm soát scope và đảm bảo khả năng hoàn thành đồ án, feature được chia theo mức độ ưu tiên.

## MUST HAVE — Core

- Authentication.
- Vocabulary.
- Topic.
- Vocabulary Set.
- Flashcard.
- Quiz.
- Pronunciation.
- SRS / Spaced Repetition.
- Learning Progress.
- Dashboard.
- Admin Management.

## SHOULD HAVE

- XP.
- Level.
- Daily Goal.
- Streak.
- Achievement.
- Community.

## COULD HAVE

- AI Example Generator.
- AI Explanation.
- AI Quiz Generator.
- Các AI learning feature phù hợp khác.

Nếu thời gian hoặc nguồn lực hạn chế:

    MUST HAVE
        ↓
    SHOULD HAVE
        ↓
    COULD HAVE

Không được hy sinh Core Learning System để triển khai feature mở rộng.

---

# 19. Core Learning Flow

Luồng học tập chính:

    User Login
        ↓
    Select Topic
        ↓
    Select Vocabulary Set
        ↓
    Learn with Flashcards
        ↓
    Listen Model Pronunciation
        ↓
    Practice Pronunciation
        ↓
    Take Quiz
        ↓
    Review Result
        ↓
    Update Learning Progress
        ↓
    SRS Scheduling
        ↓
    Update XP
        ↓
    Update Daily Goal
        ↓
    Update Streak
        ↓
    Update Level / Achievement
        ↓
    Dashboard
        ↓
    Today's Review / Continue Learning

Không phải mọi learning activity đều phải đi qua toàn bộ flow trên.

Ví dụ:

- User chỉ review một từ → có thể cập nhật Learning Progress + SRS + XP + Streak.
- User làm Quiz → cập nhật Quiz Result + Learning Progress + XP + Streak.
- User luyện Pronunciation → cập nhật Pronunciation Result + Learning Progress phù hợp + XP + Streak.

Frontend không được thực hiện hai learning flows cho cùng một activity nếu điều đó dẫn tới cộng XP hoặc cập nhật progress hai lần.

---

# 20. Important Business Principles

## 20.1. Learning First

Mục tiêu chính của hệ thống là hỗ trợ học và ghi nhớ từ vựng.

Gamification và Community phải phục vụ mục tiêu học tập.

AI chỉ là phần mở rộng.

## 20.2. Two Authenticated Roles

Hệ thống chỉ có:

- User.
- Admin.

Guest chỉ là trạng thái chưa đăng nhập.

Không tự ý tạo thêm role như:

- Free.
- Premium.
- Moderator.
- Staff.

nếu chưa được phê duyệt.

## 20.3. Multiple Meanings

Không được giả định mỗi Vocabulary chỉ có một Meaning.

Meaning phải có khả năng gắn với Context phù hợp.

## 20.4. Pronunciation is Core

Pronunciation bao gồm:

1. Nghe Model Pronunciation.
2. User tự phát âm.
3. Hệ thống đánh giá.
4. Pass khi score > 50%.

Pronunciation Practice là learning activity riêng, không phải Quiz Type.

## 20.5. SRS-driven Learning

Learning Progress và review scheduling phải hỗ trợ cơ chế Spaced Repetition.

## 20.6. XP is Universal

Mọi User sử dụng cùng một quy tắc XP.

Không phân biệt XP theo User type hoặc mức độ "normal/hardcore".

## 20.7. XP and Level are Different

XP:

- Không giới hạn.
- Ghi nhận tổng hoạt động học tập.

Level:

- Có giới hạn.
- Level tối đa là 15.
- Chỉ phục vụ Gamification.

## 20.8. Streak Measures Consistency

Streak đo tính liên tục của learning activity.

Không đồng nhất Streak với Login.

## 20.9. Daily Goal Uses Activity XP

Daily Goal được tính dựa trên Activity XP.

Bonus XP từ Daily Goal không được dùng để tự tạo điều kiện hoàn thành chính Daily Goal đó.

## 20.10. Scope First

Không thêm feature chỉ vì có thể triển khai về mặt kỹ thuật.

Mọi feature mới ảnh hưởng tới:

- Business Logic.
- Database.
- API.
- UI/UX.
- Security.
- Testing.
- Scope.

phải được phân tích và phê duyệt trước.

---

# 21. Scope Control Rules for AI Agent

AI Agent PHẢI tuân thủ:

1. Đọc file này trước khi làm việc với feature của hệ thống.
2. Không tự ý thêm feature mới.
3. Không tự ý xóa feature đã được xác định.
4. Không tự ý thay đổi Business Rule.
5. Không tự ý thay đổi pronunciation passing threshold `> 50%`.
6. Không tự ý thay đổi XP rules.
7. Không tự ý thay đổi Level Max = 15.
8. Không tự ý thay đổi Daily Goal rules.
9. Không tự ý thay đổi Streak rules.
10. Không tự ý quyết định công nghệ Pronunciation Assessment nếu chưa có PLAN.
11. Không tự ý mở rộng Community.
12. Không tự ý thêm AI feature.
13. Không tự ý tạo thêm User Role.
14. Nếu yêu cầu mới mâu thuẫn với tài liệu này, phải hỏi người phát triển trước.
15. Nếu một feature chưa có SPEC chi tiết, không được tự suy đoán nghiệp vụ quan trọng.
16. Không code toàn bộ hệ thống chỉ từ file tổng quan này.
17. Phải tuân thủ workflow:

    SPEC
    ↓
    PLAN
    ↓
    TASK
    ↓
    IMPLEMENT
    ↓
    TEST
    ↓
    REVIEW

---

# 22. Development Workflow

Mọi feature lớn nên đi theo:

    SPEC
      ↓
    PLAN
      ↓
    TASK
      ↓
    IMPLEMENT
      ↓
    TEST
      ↓
    REVIEW
      ↓
    APPROVE
      ↓
    COMMIT

## SPEC

Xác định:

- What.
- Why.
- Actors.
- User flow.
- Business rules.
- Data requirements.
- API requirements.
- Acceptance criteria.
- Edge cases.

## PLAN

Xác định:

- Architecture impact.
- Database changes.
- API changes.
- Backend changes.
- Frontend changes.
- Testing strategy.
- Implementation order.
- Risks.

## TASK

Chia PLAN thành các task nhỏ có thể triển khai.

Mỗi task phải có:

- Objective.
- Dependencies.
- Files/areas affected.
- Scope.
- Verification.

## CODE

Chỉ implement task đã được phê duyệt.

Ưu tiên:

    Reuse
       ↓
    Extend
       ↓
    Create

Không tự ý refactor lớn.

## TEST

Kiểm tra implementation theo:

- SPEC.
- PLAN.
- TASK.
- Acceptance Criteria.
- Business Rules.

Bao gồm các kiểm tra phù hợp:

- Unit test.
- Integration test.
- API test.
- Frontend test.
- Manual test.
- Edge case.
- Validation.
- Authorization.
- Regression.
- Build.

## REVIEW

Review:

- Correctness.
- Security.
- Maintainability.
- Architecture.
- Scope.
- Tests.
- Documentation.

Feature chỉ được xem là hoàn thành sau khi:

    TEST
      ↓
    REVIEW
      ↓
    APPROVE

---

# 23. Out of Scope Unless Explicitly Approved

Các chức năng sau không mặc định thuộc scope:

- Mobile application.
- Offline-first application.
- Microservices.
- Full social network.
- Direct messaging/chat.
- Real-time voice conversation.
- Staff role.
- Moderator role.
- Free/Premium subscription.
- Payment system.
- Social leaderboard.
- Advanced machine learning model tự huấn luyện.
- AI feature mới chưa được phê duyệt.
- Các feature làm scope vượt quá thời gian triển khai đồ án.

---

# 24. Final Product Vision

Sản phẩm cuối cùng hướng tới một nền tảng học từ vựng tiếng Anh có chu trình:

    Discover Topic
          ↓
    Select Vocabulary Set
          ↓
    Learn with Flashcards
          ↓
    Listen Model Pronunciation
          ↓
    Practice Pronunciation
          ↓
    Practice with Quiz
          ↓
    Track Learning Progress
          ↓
    Review with SRS
          ↓
    Earn XP
          ↓
    Maintain Streak
          ↓
    Progress through Levels
          ↓
    Unlock Achievements
          ↓
    Continue Learning
          ↓
    Community Sharing
          ↓
    Optional AI Assistance

Trọng tâm của sản phẩm là:

**Vocabulary + Vocabulary Set + Flashcard + Quiz + Pronunciation + SRS + Learning Progress**

Các nhóm:

**XP + Level + Daily Goal + Streak + Achievement + Community**

đóng vai trò tăng động lực và mở rộng trải nghiệm.

**AI** là nhóm tính năng mở rộng, không được làm ảnh hưởng đến khả năng hoàn thành Core Learning System.
