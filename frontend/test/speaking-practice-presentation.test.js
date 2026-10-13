import assert from "node:assert/strict";
import test from "node:test";
import { RECOGNITION_OUTCOMES } from "../src/pronunciation/recognition-classifier.js";
import { SPEAKING_PRACTICE_PHASES } from "../src/pronunciation/speaking-practice-state.js";
import {
  getRecognitionOutcomePresentation,
  getSpeakingPracticeIssuePresentation,
  getSpeakingPracticePresentation,
  SPEAKING_PRACTICE_ACTION_LABELS,
  SPEAKING_PRACTICE_DISCLOSURE,
} from "../src/pronunciation/speaking-practice-presentation.js";

const ALL_PHASES = Object.values(SPEAKING_PRACTICE_PHASES);
const DISPLAYABLE_ISSUES = [
  "UNSUPPORTED", "INSECURE_CONTEXT", "PERMISSION_DENIED", "SERVICE_NOT_ALLOWED",
  "NO_SPEECH", "AUDIO_CAPTURE_FAILED", "NETWORK_ERROR", "ABORTED", "NO_RESULT",
  "UNUSABLE_PRIMARY", "INVALID_TARGET", "START_FAILED", "START_TIMEOUT",
  "FINALIZATION_TIMEOUT", "RECOGNITION_ERROR", "NO_PLAYBACK_AVAILABLE", "PLAYBACK_FAILED",
  "LEARNING_SET_NOT_FOUND", "FORBIDDEN", "UNAUTHENTICATED", "LEARNING_SET_EMPTY",
  "INVALID_LEARNING_RESPONSE", "LEARNING_REQUEST_FAILED", "INVALID_LEARNING_SET",
  "INACCESSIBLE", "EMPTY", "DISPOSED",
];

test("maps every accepted aggregate phase to stable Vietnamese presentation", () => {
  for (const phase of ALL_PHASES) {
    const presentation = getSpeakingPracticePresentation(snapshot({ phase }));
    assert.equal(presentation.phase, phase);
    assert.equal(typeof presentation.heading, "string", phase);
    assert.equal(presentation.heading.length > 0, true, phase);
    assert.equal(typeof presentation.description, "string", phase);
    assert.equal(presentation.description.length > 0, true, phase);
  }
});

test("maps session-owned completion without inventing a controller phase", () => {
  const presentation = getSpeakingPracticePresentation(snapshot({
    phase: SPEAKING_PRACTICE_PHASES.READY,
    completed: true,
    controls: { canExit: true, canRestart: true },
  }));
  assert.equal(presentation.phase, "COMPLETED");
  assert.equal(presentation.heading, "Đã đi hết bộ từ");
  assert.equal(presentation.description, "Bạn đã xem qua tất cả từ trong phiên này. Kết quả không được lưu thành điểm hay tiến độ.");
  assert.equal(presentation.actions.restart.enabled, true);
  assert.equal(presentation.actions.exit.enabled, true);
  assert.equal(presentation.transcript, null);
});

test("preserves the exact approved outcome copy and non-grading clarification", () => {
  const expected = {
    PRIMARY_MATCH: ["Đã nhận diện từ mục tiêu", "Tốt lắm! Hãy tiếp tục luyện tập."],
    ALTERNATIVE_MATCH: ["Nhận diện chưa chắc chắn", "Từ mục tiêu chỉ xuất hiện trong kết quả thay thế."],
    NO_MATCH: ["Chưa nhận diện khớp", "Hãy nghe mẫu và thử nói lại nhé!"],
    INCONCLUSIVE: ["Chưa thể xác định kết quả", "Hãy thử lại."],
  };
  for (const outcome of Object.values(RECOGNITION_OUTCOMES)) {
    const presentation = getRecognitionOutcomePresentation({ classification: outcome });
    assert.equal(presentation.heading, expected[outcome][0]);
    assert.equal(presentation.message, expected[outcome][1]);
    assert.doesNotMatch(`${presentation.message} ${presentation.clarification}`, /\b\d+%|điểm (số|độ chính xác) phát âm|bạn đã phát âm sai/i);
  }
});

test("alternative match uses caution semantics and explicitly qualified copy", () => {
  const presentation = getRecognitionOutcomePresentation({ classification: RECOGNITION_OUTCOMES.ALTERNATIVE_MATCH });
  assert.equal(presentation.tone, "caution");
  assert.equal(presentation.heading, "Nhận diện chưa chắc chắn");
  assert.match(presentation.message, /chỉ xuất hiện trong kết quả thay thế/i);
  assert.match(presentation.clarification, /chưa được xem là thành công/i);
});

test("no-match explicitly avoids diagnosing incorrect pronunciation", () => {
  const presentation = getRecognitionOutcomePresentation({ classification: RECOGNITION_OUTCOMES.NO_MATCH });
  assert.equal(presentation.tone, "negative");
  assert.match(presentation.clarification, /không chứng minh rằng bạn phát âm sai/i);
});

test("inconclusive uses caution semantics without becoming a definite failure", () => {
  const presentation = getRecognitionOutcomePresentation({ classification: RECOGNITION_OUTCOMES.INCONCLUSIVE });
  assert.equal(presentation.tone, "caution");
  assert.match(`${presentation.heading} ${presentation.message} ${presentation.clarification}`, /chưa thể xác định/i);
  assert.doesNotMatch(`${presentation.message} ${presentation.clarification}`, /phát âm sai|thất bại/i);
});

test("inconclusive keeps its caution outcome while exposing actionable issue recovery", () => {
  const presentation = getSpeakingPracticePresentation(snapshot({
    phase: SPEAKING_PRACTICE_PHASES.INCONCLUSIVE,
    issue: "NO_SPEECH",
    result: { classification: RECOGNITION_OUTCOMES.INCONCLUSIVE },
  }));
  assert.equal(presentation.tone, "caution");
  assert.match(presentation.issue.message, /chưa nghe thấy lời nói/i);
  assert.match(presentation.issue.recovery, /thử lại/i);
});

test("permission denial overrides the generic inconclusive outcome with explicit microphone guidance", () => {
  const presentation = getSpeakingPracticePresentation(snapshot({
    phase: SPEAKING_PRACTICE_PHASES.RECOVERABLE_ERROR,
    issue: "PERMISSION_DENIED",
    result: { classification: RECOGNITION_OUTCOMES.INCONCLUSIVE },
    controls: { canListen: true, canSpeak: true, canRetry: true },
  }));
  assert.equal(presentation.heading, "Không thể sử dụng microphone");
  assert.equal(presentation.description, "Hãy cho phép ELVocab truy cập microphone trong cài đặt trình duyệt rồi thử lại.");
  assert.equal(presentation.tone, "neutral");
  assert.equal(presentation.issue, null);
  assert.equal(presentation.actions.listen.enabled, true);
  assert.equal(presentation.actions.retry.enabled, true);
});

test("service and audio-capture failures retain distinct actionable recovery", () => {
  for (const [code, message] of [
    ["SERVICE_NOT_ALLOWED", /dịch vụ nhận diện/i],
    ["AUDIO_CAPTURE_FAILED", /không thể thu âm từ micro/i],
  ]) {
    const presentation = getSpeakingPracticePresentation(snapshot({
      phase: SPEAKING_PRACTICE_PHASES.RECOVERABLE_ERROR,
      issue: code,
      result: { classification: RECOGNITION_OUTCOMES.INCONCLUSIVE },
    }));
    assert.equal(presentation.heading, "Chưa thể nhận diện lúc này");
    assert.equal(presentation.tone, "neutral");
    assert.match(presentation.issue.message, message);
  }
});

test("an explicitly stopped empty attempt has a private announcement without an assessment", () => {
  const presentation = getSpeakingPracticePresentation(snapshot({
    phase: SPEAKING_PRACTICE_PHASES.READY,
    recognition: { phase: "IDLE", terminal: true, result: null, issue: null },
  }));
  assert.equal(presentation.phase, SPEAKING_PRACTICE_PHASES.READY);
  assert.equal(presentation.tone, "neutral");
  assert.equal(presentation.issue, null);
  assert.equal(presentation.transcript, null);
  assert.equal(presentation.announcement, "Đã dừng lượt nói.");
});

test("finalizing exposes only a concise polite announcement for the React boundary", () => {
  const presentation = getSpeakingPracticePresentation(snapshot({
    phase: SPEAKING_PRACTICE_PHASES.FINALIZING,
  }));
  assert.equal(presentation.phase, SPEAKING_PRACTICE_PHASES.FINALIZING);
  assert.equal(presentation.announcement, "Đang chờ kết quả nhận diện.");
  assert.equal(presentation.tone, "neutral");
  assert.equal(presentation.issue, null);
});

test("starting and listening expose concise polite announcements for the React boundary", () => {
  for (const [phase, announcement] of [
    [SPEAKING_PRACTICE_PHASES.STARTING, "Đang bắt đầu nhận diện."],
    [SPEAKING_PRACTICE_PHASES.LISTENING, "Đang lắng nghe."],
  ]) {
    const presentation = getSpeakingPracticePresentation(snapshot({ phase }));
    assert.equal(presentation.announcement, announcement);
    assert.equal(presentation.tone, "neutral");
    assert.equal(presentation.issue, null);
  }
});

test("shows only the usable sanitized primary transcript for terminal usable outcomes", () => {
  for (const classification of [
    RECOGNITION_OUTCOMES.PRIMARY_MATCH,
    RECOGNITION_OUTCOMES.ALTERNATIVE_MATCH,
    RECOGNITION_OUTCOMES.NO_MATCH,
  ]) {
    const result = {
      classification,
      primaryTranscript: "  BOOK\u0301  ",
      alternatives: [{ transcript: "private alternative" }],
      confidence: 0.99,
    };
    const presentation = getSpeakingPracticePresentation(snapshot({ phase: SPEAKING_PRACTICE_PHASES.RESULT, result }));
    assert.equal(presentation.transcript.value, "BOOḰ");
    assert.equal(JSON.stringify(presentation).includes("private alternative"), false);
    assert.equal(JSON.stringify(presentation).includes("0.99"), false);
  }
});

test("never displays transcript for inconclusive, absent or unusable values", () => {
  for (const result of [
    { classification: RECOGNITION_OUTCOMES.INCONCLUSIVE, primaryTranscript: "book" },
    { classification: RECOGNITION_OUTCOMES.PRIMARY_MATCH, primaryTranscript: "   " },
    { classification: RECOGNITION_OUTCOMES.PRIMARY_MATCH },
    null,
  ]) {
    assert.equal(getSpeakingPracticePresentation(snapshot({ result })).transcript, null);
  }
});

test("maps every known issue to actionable stable copy", () => {
  for (const code of DISPLAYABLE_ISSUES) {
    const mapped = getSpeakingPracticeIssuePresentation(code);
    assert.equal(typeof mapped.message, "string", code);
    assert.equal(mapped.message.length > 0, true, code);
    assert.equal(typeof mapped.recovery, "string", code);
    assert.equal(mapped.recovery.length > 0, true, code);
  }
});

test("unknown issues use a generic fallback without leaking native details", () => {
  const nativeMessage = "DOMException: vendor token secret";
  const presentation = getSpeakingPracticePresentation(snapshot({
    phase: SPEAKING_PRACTICE_PHASES.RECOVERABLE_ERROR,
    issue: "UNKNOWN_VENDOR_FAILURE",
    error: { message: nativeMessage },
  }));
  assert.equal(presentation.issue, getSpeakingPracticeIssuePresentation("another unknown code"));
  assert.equal(JSON.stringify(presentation).includes(nativeMessage), false);
});

test("action labels match the HUMAN-approved Vietnamese labels", () => {
  assert.deepEqual(SPEAKING_PRACTICE_ACTION_LABELS, {
    listen: "Nghe từ mẫu", speak: "Nói", stop: "Dừng nói",
    confirmDisclosure: "Đồng ý và bắt đầu", deferDisclosure: "Để sau",
    retry: "Thử nói lại", previous: "Từ trước", next: "Từ tiếp theo",
    skip: "Bỏ qua từ này", exit: "Quay lại bộ từ", restart: "Luyện lại từ đầu",
  });
});

test("action legality is copied from controller controls rather than inferred from phase", () => {
  const controls = {
    canListen: false, canSpeak: true, canConfirmDisclosure: false, canStop: true,
    canRetry: false, canChangeTarget: true, canExit: false, canRestart: false,
  };
  const presentation = getSpeakingPracticePresentation(snapshot({
    phase: SPEAKING_PRACTICE_PHASES.UNSUPPORTED,
    targetIndex: 2,
    controls,
  }));
  assert.equal(presentation.actions.listen.enabled, false);
  assert.equal(presentation.actions.speak.enabled, true);
  assert.equal(presentation.actions.stop.enabled, true);
  assert.equal(presentation.actions.retry.enabled, false);
  assert.equal(presentation.actions.previous.enabled, true);
  assert.equal(presentation.actions.next.enabled, true);
  assert.equal(presentation.actions.exit.enabled, false);
});

test("retry maps directly to controller canRetry and needs no second confirmation", () => {
  const presentation = getSpeakingPracticePresentation(snapshot({
    phase: SPEAKING_PRACTICE_PHASES.RESULT,
    controls: { canRetry: true, canConfirmDisclosure: false },
  }));
  assert.equal(presentation.actions.retry.enabled, true);
  assert.equal(presentation.actions.confirmDisclosure.enabled, false);
});

test("disclosure is inline copy with truthful local-or-remote processing boundaries", () => {
  const presentation = getSpeakingPracticePresentation(snapshot({
    phase: SPEAKING_PRACTICE_PHASES.DISCLOSURE,
    controls: { canConfirmDisclosure: true },
  }));
  assert.equal(presentation.disclosure, SPEAKING_PRACTICE_DISCLOSURE);
  const text = presentation.disclosure.paragraphs.join(" ");
  assert.match(text, /Web Speech/);
  assert.match(text, /trên thiết bị hoặc từ xa/);
  assert.match(text, /không tải lên hoặc lưu âm thanh, bản chép lời hay kết quả nhận diện qua Backend/);
  assert.match(text, /không tính điểm độ chính xác phát âm/);
  assert.match(text, /chủ động đồng ý/);
  assert.doesNotMatch(text, /luôn.*thiết bị|hoàn toàn ngoại tuyến/i);
  assert.equal(presentation.actions.confirmDisclosure.enabled, true);
  assert.equal(presentation.actions.deferDisclosure.enabled, true);
});

test("expected disclosure requirement does not produce generic error presentation", () => {
  const input = Object.freeze({
    phase: SPEAKING_PRACTICE_PHASES.DISCLOSURE,
    issue: "DISCLOSURE_REQUIRED",
    controls: Object.freeze({ canConfirmDisclosure: true }),
    targetIndex: 0,
  });

  const presentation = getSpeakingPracticePresentation(input);

  assert.equal(presentation.heading, "Xác nhận trước khi dùng micro");
  assert.equal(presentation.disclosure, SPEAKING_PRACTICE_DISCLOSURE);
  assert.equal(presentation.actions.confirmDisclosure.enabled, true);
  assert.equal(presentation.issue, null);
  assert.equal(presentation.tone, "neutral");
  assert.equal(input.issue, "DISCLOSURE_REQUIRED");

  const unexpectedContext = getSpeakingPracticePresentation(snapshot({
    phase: SPEAKING_PRACTICE_PHASES.RECOVERABLE_ERROR,
    issue: "DISCLOSURE_REQUIRED",
  }));
  assert.equal(unexpectedContext.issue, getSpeakingPracticeIssuePresentation("UNKNOWN_ISSUE"));
});

test("does not expose disclosure outside its accepted state", () => {
  assert.equal(getSpeakingPracticePresentation(snapshot({ phase: SPEAKING_PRACTICE_PHASES.READY })).disclosure, null);
});

test("handles missing optional snapshot values safely", () => {
  const presentation = getSpeakingPracticePresentation();
  assert.equal(presentation.phase, SPEAKING_PRACTICE_PHASES.LOADING);
  assert.equal(presentation.transcript, null);
  assert.equal(presentation.issue, null);
  assert.equal(Object.values(presentation.actions).every(({ enabled }) => enabled === false), true);
});

test("does not mutate snapshot, controls or result inputs", () => {
  const controls = Object.freeze({ canListen: true, canExit: true });
  const result = Object.freeze({ classification: RECOGNITION_OUTCOMES.PRIMARY_MATCH, primaryTranscript: " book " });
  const input = Object.freeze({ phase: SPEAKING_PRACTICE_PHASES.RESULT, controls, result, targetIndex: 0 });
  const before = JSON.stringify(input);
  getSpeakingPracticePresentation(input);
  assert.equal(JSON.stringify(input), before);
});

test("presentation contains no confidence, alternative, score, upload or persistence field", () => {
  const presentation = getSpeakingPracticePresentation(snapshot({
    phase: SPEAKING_PRACTICE_PHASES.RESULT,
    result: { classification: RECOGNITION_OUTCOMES.PRIMARY_MATCH, primaryTranscript: "book" },
  }));
  for (const forbidden of ["confidence", "alternatives", "score", "upload", "persist", "progress", "xp"]) {
    assert.equal(Object.hasOwn(presentation, forbidden), false, forbidden);
  }
});

function snapshot(overrides = {}) {
  return {
    phase: SPEAKING_PRACTICE_PHASES.READY,
    issue: null,
    result: null,
    completed: false,
    targetIndex: 0,
    controls: {},
    ...overrides,
  };
}
