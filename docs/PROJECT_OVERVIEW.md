# PROJECT OVERVIEW — English Vocabulary Learning Platform

Tài liệu tổng quan chính thức về phạm vi và định hướng chức năng của hệ thống.

AI Agent phải đọc tài liệu này trước khi phân tích, lập kế hoạch hoặc triển khai các feature liên quan.

Không được tự ý thay đổi nghiệp vụ, thêm feature ngoài phạm vi hoặc loại bỏ feature đã được xác định nếu chưa có sự phê duyệt của người phát triển.

Khi có yêu cầu mới làm thay đổi phạm vi hoặc nghiệp vụ, AI Agent phải đề xuất thay đổi trước, không tự ý triển khai.


---

# 1. Tổng quan hệ thống

## 1.1. Tên hệ thống

**English Vocabulary Learning Platform**

## 1.2. Tên đề tài dự kiến

**Xây dựng hệ thống học từ vựng tiếng Anh**

## 1.3. Mục tiêu

Xây dựng một nền tảng web hỗ trợ người học tiếng Anh tập trung vào việc học, ghi nhớ và luyện tập từ vựng.

Hệ thống không chỉ cung cấp danh sách từ vựng và flashcard mà còn hỗ trợ:

- Học từ vựng thông qua Flashcard.
- Hiểu nghĩa của từ theo từng ngữ cảnh.
- Hỗ trợ các từ có nhiều nghĩa và nhiều từ loại.
- Luyện tập thông qua **2 dạng Quiz chính**.
- Luyện phát âm bằng cách nghe phát âm mẫu và tự phát âm.
- Đánh giá kết quả phát âm của người dùng ở mức phù hợp với phạm vi đồ án.
- Ôn tập từ vựng theo cơ chế **Spaced Repetition**.
- Theo dõi tiến độ học tập của người dùng.
- Tạo động lực học tập thông qua XP, Level, Streak và Achievement.
- Tạo và quản lý Vocabulary Set cá nhân.
- Khám phá và chia sẻ Vocabulary Set thông qua Community.
- Cho phép người dùng sao chép các Vocabulary Set được chia sẻ vào tài khoản cá nhân.
- Một số tính năng AI có thể được tích hợp để hỗ trợ việc học nếu phù hợp với phạm vi và thời gian thực hiện.
- Cung cấp hệ thống quản trị dành cho Admin.

Mục tiêu cốt lõi của hệ thống là giúp người học:

1. Học từ mới.
2. Hiểu nghĩa và cách sử dụng từ.
3. Nghe được cách phát âm chuẩn.
4. Tự luyện phát âm.
5. Kiểm tra mức độ ghi nhớ.
6. Ôn tập đúng thời điểm.
7. Theo dõi sự tiến bộ trong quá trình học.


---

# 2. Người dùng và quyền truy cập

Hệ thống có hai role chính được lưu trong database:

- `USER`
- `ADMIN`

Không sử dụng mô hình tài khoản Free/Premium trong phạm vi hiện tại.

## 2.1. USER

Người dùng thông thường có thể:

- Đăng ký và đăng nhập.
- Quản lý thông tin cá nhân.
- Học các Vocabulary Set được phép truy cập.
- Học từ vựng thông qua Flashcard.
- Làm 2 dạng Quiz của hệ thống.
- Luyện phát âm.
- Theo dõi tiến độ học tập.
- Tham gia cơ chế XP, Level, Streak và Achievement.
- Tạo Vocabulary Set cá nhân.
- Chia sẻ Vocabulary Set cá nhân thông qua Community.
- Khám phá các Vocabulary Set được chia sẻ bởi người dùng khác.
- Sao chép Vocabulary Set được chia sẻ vào tài khoản cá nhân.

## 2.2. ADMIN

Admin là một tài khoản người dùng có `role = ADMIN`.

Admin có quyền quản lý dữ liệu và nội dung của hệ thống, bao gồm:

- Quản lý tài khoản người dùng.
- Quản lý từ vựng.
- Quản lý nghĩa của từ.
- Quản lý ví dụ sử dụng từ.
- Tạo và quản lý các Vocabulary Set của hệ thống.
- Quản lý nội dung Community khi cần thiết.
- Quản lý Achievement và các nội dung liên quan đến hệ thống.
- Theo dõi các thông tin quản trị cần thiết.

Admin không sử dụng một hệ thống tài khoản riêng biệt mà sử dụng bảng `USER` với role tương ứng.


---

# 3. Vocabulary

## 3.1. Thông tin từ vựng

Mỗi từ vựng có thể bao gồm:

- Word.
- Phonetic.
- Pronunciation.
- Một hoặc nhiều Meaning.
- Part of Speech.
- Context.
- Một hoặc nhiều Example.

Hệ thống phải hỗ trợ trường hợp một từ có nhiều nghĩa khác nhau.

Ví dụ:

**work**

- Noun → công việc.
- Verb → làm việc.

Các nghĩa khác nhau phải có thể được mô tả và sử dụng trong những ngữ cảnh khác nhau.

## 3.2. Vocabulary Meaning

Một Vocabulary có thể có nhiều Meaning.

Mỗi Meaning có thể bao gồm:

- Part of Speech.
- Nghĩa tiếng Việt.
- Context.

Ví dụ:

```text
Vocabulary:

work

Meaning 1:
Part of Speech: Noun
Meaning: công việc

Meaning 2:
Part of Speech: Verb
Meaning: làm việc
3.3. Vocabulary Example

Example được liên kết với một Meaning cụ thể thay vì chỉ liên kết trực tiếp với Vocabulary.

Điều này giúp hệ thống thể hiện chính xác cách sử dụng từ trong từng ngữ cảnh.

4. Learning
4.1. Flashcard

Flashcard là phương thức chính để người dùng học từ mới.

Một Flashcard có thể hiển thị:

Từ vựng.
Phonetic.
Nghĩa.
Part of Speech.
Context.
Example.
Phát âm mẫu.

Flashcard không được xem là một dạng Quiz.

4.2. Learning Flow

Flow học tập chính có thể bao gồm:

Flashcard
    ↓
Pronunciation Practice
    ↓
Quiz

Chi tiết về UI, interaction và navigation được quy định trong UI_UX_SPEC.md.

Learning flow có thể được điều chỉnh trong quá trình phát triển nếu có phê duyệt thay đổi.

5. Quiz

Hệ thống hiện tại chỉ có 2 dạng Quiz chính.

AI Agent không được tự ý thêm các dạng Quiz khác nếu chưa có sự phê duyệt.

5.1. Quiz Type 1 — Vietnamese → English

Hệ thống hiển thị nghĩa tiếng Việt hoặc thông tin ngữ cảnh.

Người dùng phải nhập đầy đủ từ tiếng Anh tương ứng.

Ví dụ:

Công việc → ______

User answer: work

Correct answer: work

Hệ thống kiểm tra câu trả lời của người dùng với đáp án chính xác.

5.2. Quiz Type 2 — Missing Letter

Hệ thống hiển thị từ tiếng Anh bị thiếu một hoặc nhiều ký tự.

Ví dụ:

w_rk

Answer: work

Người dùng phải hoàn thành từ còn thiếu.

5.3. Character-level Feedback

Đối với các Quiz yêu cầu người dùng nhập câu trả lời, hệ thống có thể cung cấp phản hồi theo từng ký tự.

Ví dụ:

User answer:

deserst

Correct answer:

dessert

Hệ thống có thể xác định vị trí ký tự đúng và sai để hiển thị phản hồi trực quan.

Quy tắc:

Ký tự đúng ở vị trí tương ứng → hiển thị trạng thái đúng.
Ký tự sai ở vị trí tương ứng → hiển thị trạng thái sai.
Phản hồi được thực hiện dựa trên việc so sánh user_answer với correct_answer.

Không tạo bảng database riêng cho kết quả từng ký tự nếu không thực sự cần thiết.

6. Pronunciation

Pronunciation là một module học tập riêng, không phải Quiz Type thứ ba.

6.1. Model Pronunciation

Hệ thống cung cấp:

Phonetic.
Phát âm mẫu của từ.
Chức năng nghe phát âm mẫu.
6.2. User Pronunciation

Người dùng có thể:

Nghe phát âm mẫu.
Tự phát âm từ.
Hệ thống có thể phân tích và đánh giá mức độ phù hợp của phát âm.
Hiển thị feedback phù hợp cho người dùng.

Phạm vi đánh giá phát âm cần được giữ ở mức phù hợp với thời gian và khả năng triển khai của đồ án.

Không bắt buộc phải lưu file audio của người dùng vào database.

Nếu sau này cần lưu lịch sử pronunciation attempt, phải xem xét và thiết kế migration riêng thay vì tự ý mở rộng database.

Chi tiết về UI/UX và interaction của Pronunciation được quy định trong UI_UX_SPEC.md.

Công nghệ hoặc dịch vụ dùng để đánh giá phát âm chưa được cố định trong tài liệu này và sẽ được quyết định trong giai đoạn PLAN khi cần thiết.

7. Spaced Repetition

Hệ thống sử dụng cơ chế Spaced Repetition để xác định thời điểm người dùng nên ôn tập lại từ vựng.

Hệ thống cần lưu thông tin cần thiết để:

Theo dõi lịch sử học.
Theo dõi số lần trả lời đúng/sai.
Xác định lần ôn tập gần nhất.
Xác định thời điểm ôn tập tiếp theo.
Điều chỉnh khoảng thời gian ôn tập dựa trên kết quả học.

Spaced Repetition là logic xử lý nghiệp vụ, không phải một bảng database riêng.

Logic Spaced Repetition nên được tách riêng để dễ kiểm thử và thay đổi.

Thuật toán cụ thể chưa được cố định trong tài liệu này và sẽ được quyết định trong giai đoạn PLAN.

8. Learning Progress

Hệ thống theo dõi tiến độ học tập theo từng User và Vocabulary.

Một User có thể có trạng thái học tập riêng đối với từng từ.

Thông tin có thể bao gồm:

Số lần trả lời đúng.
Số lần trả lời sai.
Số lần ôn tập.
Lần ôn tập gần nhất.
Lần ôn tập tiếp theo.
Trạng thái học tập.
Các thông tin cần thiết cho Spaced Repetition.

Tiến độ của mỗi User là độc lập.

Ví dụ:

User A học "work"

→ Progress của User A

User B học "work"

→ Progress của User B

Hai người dùng không sử dụng chung Learning Progress.

9. Gamification

Hệ thống sử dụng một số cơ chế Gamification để tạo động lực học tập.

9.1. XP

Người dùng nhận XP thông qua các hoạt động học tập phù hợp.

XP được sử dụng để xác định Level.

9.2. Level

Level được xác định dựa trên tổng XP của người dùng.

Không tạo bảng Level riêng nếu chưa có nhu cầu nghiệp vụ rõ ràng.

9.3. Streak

Hệ thống theo dõi chuỗi ngày học liên tiếp của người dùng.

Thông tin chính:

Current Streak.
Longest Streak.
Last Activity Date.
9.4. Achievement

Achievement là các thành tựu người dùng có thể đạt được dựa trên điều kiện được định nghĩa trước.

Ví dụ:

First Lesson.
7 Day Streak.
100 Words.
500 XP.
100 Quiz.

Achievement được quản lý bởi Admin.

10. Vocabulary Set

Vocabulary Set là tập hợp các từ vựng được sử dụng để tổ chức nội dung học tập.

Một Vocabulary Set có:

Tên.
Mô tả.
Chủ sở hữu.
Danh sách Vocabulary.
Trạng thái public/private phù hợp với nghiệp vụ.

Một Vocabulary Set có thể chứa nhiều Vocabulary và một Vocabulary có thể thuộc nhiều Vocabulary Set.

11. Quy tắc sở hữu và chia sẻ Vocabulary Set
11.1. Admin Vocabulary Set

Vocabulary Set do Admin tạo và quản lý là Public Vocabulary Set.

User có thể:

Xem bộ từ.
Học trực tiếp bộ từ.
Thực hiện các hoạt động học tập trên bộ từ.
Sao chép bộ từ vào tài khoản cá nhân.

Khi User sao chép một bộ từ của Admin:

Admin Vocabulary Set
        ↓
    Copy / Add
        ↓
User's Vocabulary Set

Hệ thống tạo một Vocabulary Set mới thuộc sở hữu của User.

Bản sao là một bộ từ độc lập.

User không có quyền chỉnh sửa hoặc xóa Vocabulary Set gốc của Admin.

11.2. User Vocabulary Set

Vocabulary Set do User tạo là Private mặc định.

User có toàn quyền đối với bộ từ của chính mình:

Xem.
Học.
Thêm từ.
Xóa từ.
Chỉnh sửa thông tin bộ từ.
Xóa bộ từ.

User không thể trực tiếp chuyển Vocabulary Set cá nhân thành Public Vocabulary Set.

11.3. Chia sẻ thông qua Community

Nếu User muốn chia sẻ Vocabulary Set cá nhân, User có thể tạo Community Post để chia sẻ bộ từ.

Community đóng vai trò là nơi:

Khám phá Vocabulary Set.
Giới thiệu Vocabulary Set.
Chia sẻ Vocabulary Set giữa người dùng.

Vocabulary Set gốc vẫn thuộc quyền sở hữu của User tạo ra.

Việc tạo Community Post để chia sẻ không làm thay đổi trạng thái is_public của Vocabulary Set gốc.

11.4. Copy Vocabulary Set từ Community

User khác có thể xem Community Post và chọn sao chép Vocabulary Set được chia sẻ.

Khi đó:

User A's Vocabulary Set

          ↓

    Community Post

          ↓

       User B

          ↓

   Copy Vocabulary Set

          ↓

User B's Private Vocabulary Set

Vocabulary Set của User B là một bản sao độc lập.

User B:

Có thể học bộ từ.
Có thể chỉnh sửa bộ từ của mình.
Có thể xóa bộ từ của mình.

User B:

Không thể chỉnh sửa bộ từ gốc của User A.
Không trở thành owner của bộ từ gốc.
Không ảnh hưởng đến bộ từ gốc khi chỉnh sửa bản sao.
12. Community

Community là khu vực cho phép người dùng chia sẻ và khám phá nội dung học tập liên quan đến Vocabulary Set.

12.1. Community Post

User có thể tạo Community Post để:

Chia sẻ Vocabulary Set.
Viết tiêu đề.
Viết nội dung giới thiệu.
Cho phép người dùng khác khám phá bộ từ.

Một Community Post có thể liên kết với Vocabulary Set được chia sẻ.

12.2. Community Comment

User có thể bình luận trên Community Post.

Mỗi comment thuộc:

Một Community Post.
Một User.

Các chức năng Community khác như reaction, follow, report, notification... không nằm trong phạm vi mặc định nếu chưa được phê duyệt.

13. AI Support

AI là tính năng hỗ trợ tùy chọn, không phải yêu cầu cốt lõi bắt buộc của hệ thống.

AI có thể được tích hợp nếu:

Phù hợp với mục tiêu của hệ thống.
Mang lại giá trị thực tế cho việc học từ vựng.
Không làm phạm vi đồ án vượt quá khả năng triển khai.
Có đủ thời gian để kiểm thử và đánh giá.

AI có thể được xem xét cho các chức năng như:

Hỗ trợ giải thích từ vựng.
Tạo ví dụ.
Hỗ trợ ngữ cảnh.
Hỗ trợ học tập cá nhân.

Tuy nhiên:

Việc không tích hợp AI vẫn phải đảm bảo hệ thống đáp ứng đầy đủ các chức năng cốt lõi đã được xác định.

AI Agent không được tự ý thêm AI vào các feature chỉ vì mục đích làm hệ thống phức tạp hơn.

Nếu AI được sử dụng, việc lựa chọn model/service và kiến trúc tích hợp phải được xác định trong PLAN và được phê duyệt.

14. Admin Management

Admin chịu trách nhiệm quản lý dữ liệu và nội dung của hệ thống.

Các nhóm quản trị chính:

14.1. User Management
Xem danh sách User.
Xem thông tin cần thiết.
Quản lý trạng thái tài khoản.
Quản lý role USER/ADMIN theo nghiệp vụ đã được phê duyệt.
14.2. Vocabulary Management

Admin có thể:

Tạo Vocabulary.
Chỉnh sửa Vocabulary.
Xóa Vocabulary.
Quản lý Meaning.
Quản lý Example.
Quản lý thông tin Pronunciation.
14.3. Vocabulary Set Management

Admin có thể:

Tạo Public Vocabulary Set.
Chỉnh sửa Vocabulary Set.
Thêm/xóa Vocabulary trong Set.
Xóa Vocabulary Set.
14.4. Achievement Management

Admin có thể:

Tạo Achievement.
Chỉnh sửa Achievement.
Xóa Achievement.
Quản lý điều kiện đạt Achievement.
14.5. Community Management

Admin có thể quản lý nội dung Community khi cần thiết theo quyền quản trị.

Các chức năng quản trị nâng cao chỉ được bổ sung khi có yêu cầu nghiệp vụ rõ ràng.

15. Scope Control

Để đảm bảo dự án có thể hoàn thành trong thời gian thực hiện đồ án, hệ thống áp dụng nguyên tắc:

Build what the project needs, not what the technology makes possible.

AI Agent phải ưu tiên:

Đúng nghiệp vụ.
Đúng phạm vi.
Đơn giản.
Dễ hiểu.
Dễ kiểm thử.
Dễ bảo trì.
Chỉ mở rộng khi thực sự cần thiết.

Không tự ý thêm:

Role mới.
Quiz Type mới.
Subscription / Premium.
Payment.
Các bảng database không phục vụ nghiệp vụ hiện tại.
Các hệ thống social phức tạp.
AI phức tạp.
Các microservice không cần thiết.
Các abstraction không cần thiết.

Mọi feature mới nằm ngoài tài liệu này phải được đề xuất và được người phát triển phê duyệt trước khi triển khai.

16. Nguyên tắc phát triển

Hệ thống được phát triển theo các nguyên tắc:

Separation of Concerns.
Single Responsibility.
Reusability.
Maintainability.
Testability.
Security.
Clear business logic.
Avoid over-engineering.

AI Agent phải ưu tiên giải pháp đơn giản và phù hợp với quy mô đồ án.

Không triển khai một giải pháp phức tạp chỉ vì công nghệ cho phép.

17. Nguồn sự thật của hệ thống
17.1. Nguyên tắc chung

AGENTS.md chứa các quy tắc và ràng buộc phát triển ở cấp project.

Đối với một feature cụ thể, AI Agent phải tuân theo:

AGENTS.md
    ↓
Approved SPEC
    ↓
Approved PLAN
    ↓
Approved TASK

Các tài liệu project cung cấp baseline context:

PROJECT_OVERVIEW.md
UI_UX_SPEC.md
ARCHITECTURE.md
DATABASE.md
API_SPEC.md
FEATURE_STATUS.md
17.2. Vai trò của từng tài liệu
PROJECT_OVERVIEW.md

Nguồn chính cho:

Product scope.
Actors.
Core features.
Business direction.
Global business constraints.
UI_UX_SPEC.md

Nguồn chính cho:

UI behavior.
UX.
User flow.
Interaction.
Screen-level behavior.
ARCHITECTURE.md

Nguồn chính cho:

Application architecture.
Backend architecture.
Frontend architecture.
Architectural boundaries.
DATABASE.md

Nguồn chính cho:

Database entities.
Relationships.
Important constraints.
Data design.
API_SPEC.md

Nguồn chính cho:

API endpoints.
Request/response contract.
Authentication requirements.
Authorization requirements.
FEATURE_STATUS.md

Dùng để theo dõi:

TODO.
IN_PROGRESS.
DONE.
BLOCKED.

FEATURE_STATUS.md là tài liệu trạng thái, không phải nguồn thay thế cho yêu cầu nghiệp vụ.

17.3. Khi có mâu thuẫn

Nếu các tài liệu có mâu thuẫn:

Không được tự ý chọn một cách hiểu.
Phải xác định điểm mâu thuẫn.
Phân tích ảnh hưởng.
Đề xuất cách giải quyết.
Yêu cầu người phát triển xác nhận khi mâu thuẫn ảnh hưởng đến scope, business rule, architecture, database hoặc API contract.

Source code và test là bằng chứng về trạng thái triển khai thực tế, không được tự động xem là yêu cầu nghiệp vụ.

18. Trạng thái tài liệu

Tài liệu này là baseline scope của hệ thống.

Các thay đổi về:

Core business rules.
User roles.
Vocabulary Set ownership.
Quiz types.
Learning flow.
Database architecture.
Application architecture.

phải được phê duyệt trước khi triển khai.

Sau khi thay đổi được phê duyệt, các tài liệu liên quan phải được cập nhật trước hoặc đồng thời với việc triển khai để đảm bảo tài liệu và source code luôn nhất quán.

Khi một feature đang được phát triển:

TODO
  ↓
IN_PROGRESS
  ↓
TEST
  ↓
REVIEW
  ↓
DONE

Feature chỉ được đánh dấu DONE sau khi:

Implementation hoàn tất.
TEST đạt yêu cầu.
REVIEW có verdict APPROVE.

Nếu phát sinh blocker ngăn cản việc tiếp tục:

IN_PROGRESS
      ↓
   BLOCKED

Không được đánh dấu DONE chỉ vì code đã viết xong hoặc test cơ bản đã chạy thành công.