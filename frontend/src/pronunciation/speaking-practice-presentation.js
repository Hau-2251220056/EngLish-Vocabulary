import { RECOGNITION_OUTCOMES } from "./recognition-classifier.js";
import { SPEAKING_PRACTICE_PHASES } from "./speaking-practice-state.js";

export const SPEAKING_PRACTICE_ACTION_LABELS = Object.freeze({
  listen: "Nghe từ mẫu",
  speak: "Nói",
  stop: "Dừng nói",
  confirmDisclosure: "Đồng ý và bắt đầu",
  deferDisclosure: "Để sau",
  retry: "Thử nói lại",
  previous: "Từ trước",
  next: "Từ tiếp theo",
  skip: "Bỏ qua từ này",
  exit: "Quay lại bộ từ",
  restart: "Luyện lại từ đầu",
});

export const SPEAKING_PRACTICE_DISCLOSURE = Object.freeze({
  heading: "Trước khi dùng micro",
  paragraphs: Object.freeze([
    "Luyện nói sử dụng khả năng Web Speech của trình duyệt để nhận diện từ bạn nói.",
    "Tùy trình duyệt và thiết bị, âm thanh có thể được xử lý ngay trên thiết bị hoặc từ xa bởi nhà cung cấp trình duyệt.",
    "ELVocab không tải lên hoặc lưu âm thanh, bản chép lời hay kết quả nhận diện qua Backend.",
    "Phiên bản này không tính điểm độ chính xác phát âm và không thay đổi Tiến độ học hay gamification.",
    "Micro chỉ bắt đầu nhận diện sau khi bạn chủ động đồng ý.",
  ]),
});

const STATE_COPY = Object.freeze({
  [SPEAKING_PRACTICE_PHASES.LOADING]: copy("Đang chuẩn bị luyện nói", "Đang tải bộ từ và thứ tự từ vựng đã được xác thực.", "status"),
  [SPEAKING_PRACTICE_PHASES.READY]: copy("Sẵn sàng luyện nói", "Nghe từ mẫu hoặc chủ động bắt đầu nhận diện khi bạn đã sẵn sàng."),
  [SPEAKING_PRACTICE_PHASES.DISCLOSURE]: copy("Xác nhận trước khi dùng micro", "Hãy đọc thông tin về xử lý âm thanh trước khi bắt đầu."),
  [SPEAKING_PRACTICE_PHASES.UNSUPPORTED]: copy("Trình duyệt chưa hỗ trợ nhận diện giọng nói", "Bạn vẫn có thể nghe từ mẫu và chuyển giữa các từ. Hãy thử một trình duyệt có hỗ trợ Web Speech.", "status"),
  [SPEAKING_PRACTICE_PHASES.INSECURE_CONTEXT]: copy("Cần kết nối an toàn để dùng micro", "Hãy mở ELVocab qua HTTPS hoặc localhost rồi thử lại.", "alert"),
  [SPEAKING_PRACTICE_PHASES.STARTING]: copy("Đang bắt đầu nhận diện", "Trình duyệt có thể yêu cầu quyền sử dụng micro. Vui lòng chờ.", "status"),
  [SPEAKING_PRACTICE_PHASES.LISTENING]: copy("Đang lắng nghe", "Hãy nói từ mục tiêu. Chọn “Dừng nói” khi bạn đã nói xong.", "status"),
  [SPEAKING_PRACTICE_PHASES.FINALIZING]: copy("Đang chờ kết quả nhận diện", "Trình duyệt đang hoàn tất kết quả cuối cùng.", "status"),
  [SPEAKING_PRACTICE_PHASES.RESULT]: copy("Kết quả nhận diện", "Đây là đối chiếu bản chép lời của trình duyệt, không phải đánh giá chất lượng phát âm.", "status"),
  [SPEAKING_PRACTICE_PHASES.INCONCLUSIVE]: copy("Chưa thể xác định kết quả", "Bạn có thể nghe lại từ mẫu và thử nói lại.", "status"),
  [SPEAKING_PRACTICE_PHASES.RECOVERABLE_ERROR]: copy("Chưa thể nhận diện lúc này", "Hãy kiểm tra gợi ý bên dưới rồi thử lại.", "alert"),
  [SPEAKING_PRACTICE_PHASES.INACCESSIBLE]: copy("Không thể mở bộ từ", "Bộ từ có thể không tồn tại hoặc bạn không có quyền truy cập.", "alert"),
  [SPEAKING_PRACTICE_PHASES.EMPTY]: copy("Bộ từ chưa có nội dung", "Hãy thêm từ vựng vào bộ từ trước khi luyện nói.", "status"),
  [SPEAKING_PRACTICE_PHASES.CANCELLING]: copy("Đang dừng hoạt động", "ELVocab đang hủy nhận diện và phát âm thanh hiện tại.", "status"),
});

const COMPLETED_COPY = copy(
  "Đã đi hết bộ từ",
  "Bạn đã xem qua tất cả từ trong phiên này. Kết quả không được lưu thành điểm hay tiến độ.",
  "status",
);

const PERMISSION_DENIED_COPY = copy(
  "Không thể sử dụng microphone",
  "Hãy cho phép ELVocab truy cập microphone trong cài đặt trình duyệt rồi thử lại.",
  "alert",
);

const OUTCOME_COPY = Object.freeze({
  [RECOGNITION_OUTCOMES.PRIMARY_MATCH]: Object.freeze({
    heading: "Đã nhận diện từ mục tiêu",
    message: "Tốt lắm! Hãy tiếp tục luyện tập.",
    clarification: "Kết quả này chỉ cho biết bản chép lời chính của trình duyệt khớp với từ mục tiêu; đây không phải đánh giá chất lượng phát âm.",
    tone: "positive",
  }),
  [RECOGNITION_OUTCOMES.ALTERNATIVE_MATCH]: Object.freeze({
    heading: "Nhận diện chưa chắc chắn",
    message: "Từ mục tiêu chỉ xuất hiện trong kết quả thay thế.",
    clarification: "Kết quả này chưa được xem là thành công và không đánh giá chất lượng phát âm.",
    tone: "caution",
  }),
  [RECOGNITION_OUTCOMES.NO_MATCH]: Object.freeze({
    heading: "Chưa nhận diện khớp",
    message: "Hãy nghe mẫu và thử nói lại nhé!",
    clarification: "Không khớp bản chép lời không chứng minh rằng bạn phát âm sai.",
    tone: "negative",
  }),
  [RECOGNITION_OUTCOMES.INCONCLUSIVE]: Object.freeze({
    heading: "Chưa thể xác định kết quả",
    message: "Hãy thử lại.",
    clarification: "Đây không phải kết quả đánh giá người học và không tạo hình phạt.",
    tone: "caution",
  }),
});

const ISSUE_COPY = Object.freeze({
  UNSUPPORTED: issue("Trình duyệt chưa hỗ trợ nhận diện giọng nói.", "Hãy dùng trình duyệt có hỗ trợ Web Speech; bạn vẫn có thể nghe từ mẫu và chuyển từ."),
  INSECURE_CONTEXT: issue("Micro chỉ khả dụng trong ngữ cảnh an toàn.", "Hãy mở trang qua HTTPS hoặc localhost."),
  PERMISSION_DENIED: issue("Quyền sử dụng micro đã bị từ chối.", "Cho phép micro trong cài đặt trình duyệt rồi thử lại."),
  SERVICE_NOT_ALLOWED: issue("Dịch vụ nhận diện của trình duyệt không cho phép yêu cầu này.", "Kiểm tra quyền và chính sách của trình duyệt hoặc thử lại sau."),
  NO_SPEECH: issue("Trình duyệt chưa nghe thấy lời nói.", "Kiểm tra micro, nói gần micro hơn rồi thử lại."),
  AUDIO_CAPTURE_FAILED: issue("Trình duyệt không thể thu âm từ micro.", "Kiểm tra thiết bị đầu vào và quyền micro rồi thử lại."),
  NETWORK_ERROR: issue("Dịch vụ nhận diện của trình duyệt gặp lỗi mạng.", "Kiểm tra kết nối rồi thử lại. Một số trình duyệt có thể xử lý âm thanh từ xa."),
  ABORTED: issue("Lượt nhận diện đã được hủy.", "Bạn có thể chủ động bắt đầu một lượt mới khi sẵn sàng."),
  NO_RESULT: issue("Trình duyệt không trả về kết quả cuối cùng.", "Hãy thử nói lại trong một lượt mới."),
  UNUSABLE_PRIMARY: issue("Kết quả chính của trình duyệt không thể dùng để đối chiếu.", "Hãy thử nói lại trong một lượt mới."),
  INVALID_TARGET: issue("Không thể đối chiếu từ mục tiêu hiện tại.", "Hãy chuyển từ hoặc tải lại bộ từ."),
  START_FAILED: issue("Không thể bắt đầu nhận diện.", "Kiểm tra quyền micro và thử lại."),
  START_TIMEOUT: issue("Trình duyệt không bắt đầu nhận diện đúng thời gian.", "Hãy thử lại; nếu lỗi tiếp diễn, kiểm tra quyền micro."),
  FINALIZATION_TIMEOUT: issue("Trình duyệt không hoàn tất kết quả đúng thời gian.", "Hãy bắt đầu một lượt nhận diện mới."),
  RECOGNITION_ERROR: issue("Trình duyệt gặp lỗi khi nhận diện.", "Hãy thử lại hoặc dùng một trình duyệt được hỗ trợ."),
  NO_PLAYBACK_AVAILABLE: issue("Thiết bị chưa có cách phát từ mẫu.", "Bạn vẫn có thể luyện nói hoặc chuyển sang từ khác."),
  PLAYBACK_FAILED: issue("Không thể phát từ mẫu.", "Hãy thử lại hoặc tiếp tục với thao tác khác đang khả dụng."),
  LEARNING_SET_NOT_FOUND: issue("Không thể tìm thấy bộ từ.", "Quay lại trang bộ từ và chọn một bộ từ khả dụng."),
  FORBIDDEN: issue("Bạn không có quyền truy cập bộ từ này.", "Quay lại trang bộ từ và chọn nội dung bạn được phép học."),
  UNAUTHENTICATED: issue("Phiên đăng nhập không còn hợp lệ.", "Đăng nhập lại rồi mở bộ từ."),
  LEARNING_SET_EMPTY: issue("Bộ từ chưa có từ vựng.", "Thêm từ vựng trước khi bắt đầu luyện nói."),
  INVALID_LEARNING_RESPONSE: issue("Dữ liệu bộ từ chưa hợp lệ.", "Tải lại trang; nếu lỗi tiếp diễn, quay lại bộ từ."),
  LEARNING_REQUEST_FAILED: issue("Không thể tải bộ từ lúc này.", "Kiểm tra kết nối rồi thử tải lại."),
  INVALID_LEARNING_SET: issue("Đường dẫn bộ từ chưa hợp lệ.", "Quay lại trang bộ từ và mở lại hoạt động."),
  INACCESSIBLE: issue("Không thể truy cập bộ từ.", "Quay lại trang bộ từ và chọn nội dung khả dụng."),
  EMPTY: issue("Bộ từ chưa có từ vựng.", "Thêm từ vựng trước khi bắt đầu luyện nói."),
  DISPOSED: issue("Phiên luyện nói đã kết thúc.", "Mở lại hoạt động nếu bạn muốn bắt đầu phiên mới."),
});

const UNKNOWN_ISSUE = issue(
  "Đã xảy ra lỗi khi chuẩn bị hoặc nhận diện.",
  "Hãy thử lại. Nếu lỗi tiếp diễn, quay lại bộ từ và mở lại hoạt động.",
);

export function getSpeakingPracticePresentation(snapshot = {}) {
  const completed = snapshot?.completed === true;
  const phase = typeof snapshot?.phase === "string" ? snapshot.phase : SPEAKING_PRACTICE_PHASES.LOADING;
  const permissionDenied = phase === SPEAKING_PRACTICE_PHASES.RECOVERABLE_ERROR
    && snapshot?.issue === "PERMISSION_DENIED";
  const state = completed
    ? COMPLETED_COPY
    : permissionDenied
      ? PERMISSION_DENIED_COPY
      : STATE_COPY[phase] ?? STATE_COPY[SPEAKING_PRACTICE_PHASES.RECOVERABLE_ERROR];
  const outcome = completed || phase === SPEAKING_PRACTICE_PHASES.RECOVERABLE_ERROR
    ? null
    : getRecognitionOutcomePresentation(snapshot?.result);
  const expectedDisclosure = phase === SPEAKING_PRACTICE_PHASES.DISCLOSURE
    && snapshot?.issue === "DISCLOSURE_REQUIRED";
  const issuePresentation = completed || expectedDisclosure || permissionDenied || !snapshot?.issue
    ? null
    : getSpeakingPracticeIssuePresentation(snapshot.issue);

  return Object.freeze({
    activityLabel: "Luyện nói",
    phase: completed ? "COMPLETED" : phase,
    heading: outcome?.heading ?? state.heading,
    description: outcome?.message ?? state.description,
    clarification: outcome?.clarification ?? null,
    tone: outcome?.tone ?? "neutral",
    liveRegion: state.liveRegion,
    announcement: phase === SPEAKING_PRACTICE_PHASES.STARTING
      ? "Đang bắt đầu nhận diện."
      : phase === SPEAKING_PRACTICE_PHASES.LISTENING
        ? "Đang lắng nghe."
        : phase === SPEAKING_PRACTICE_PHASES.FINALIZING
          ? "Đang chờ kết quả nhận diện."
      : phase === SPEAKING_PRACTICE_PHASES.READY
        && snapshot?.recognition?.phase === "IDLE"
        && snapshot?.recognition?.terminal === true
        ? "Đã dừng lượt nói."
          : null,
    issue: issuePresentation,
    transcript: transcriptPresentation(snapshot?.result),
    disclosure: phase === SPEAKING_PRACTICE_PHASES.DISCLOSURE && !completed
      ? SPEAKING_PRACTICE_DISCLOSURE
      : null,
    actions: actionPresentation(snapshot),
  });
}

export function getRecognitionOutcomePresentation(result) {
  const classification = result?.classification;
  return OUTCOME_COPY[classification] ?? null;
}

export function getSpeakingPracticeIssuePresentation(issueCode) {
  return ISSUE_COPY[issueCode] ?? UNKNOWN_ISSUE;
}

function transcriptPresentation(result) {
  if (![RECOGNITION_OUTCOMES.PRIMARY_MATCH, RECOGNITION_OUTCOMES.ALTERNATIVE_MATCH, RECOGNITION_OUTCOMES.NO_MATCH]
    .includes(result?.classification)) return null;
  if (typeof result?.primaryTranscript !== "string") return null;
  const value = result.primaryTranscript.normalize("NFC").trim();
  return value ? Object.freeze({ label: "Trình duyệt đã nhận diện", value }) : null;
}

function actionPresentation(snapshot) {
  const controls = snapshot?.controls ?? {};
  const completed = snapshot?.completed === true;
  return Object.freeze({
    listen: action("listen", controls.canListen),
    speak: action("speak", controls.canSpeak),
    stop: action("stop", controls.canStop),
    confirmDisclosure: action("confirmDisclosure", controls.canConfirmDisclosure),
    deferDisclosure: action("deferDisclosure", controls.canConfirmDisclosure),
    retry: action("retry", controls.canRetry),
    previous: action("previous", controls.canChangeTarget && snapshot?.targetIndex > 0),
    next: action("next", controls.canChangeTarget),
    skip: action("skip", controls.canChangeTarget),
    exit: action("exit", controls.canExit),
    restart: action("restart", completed && controls.canRestart),
  });
}

function action(name, enabled) {
  return Object.freeze({ label: SPEAKING_PRACTICE_ACTION_LABELS[name], enabled: enabled === true });
}

function copy(heading, description, liveRegion = null) {
  return Object.freeze({ heading, description, liveRegion });
}

function issue(message, recovery) {
  return Object.freeze({ message, recovery });
}
