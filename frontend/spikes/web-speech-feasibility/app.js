import {
  classifyRecognition,
  confidencePercentage,
  getSpeechRecognitionConstructor,
} from "./speech-feasibility.js";

const targetInput = document.querySelector("#target-word");
const startButton = document.querySelector("#start-listening");
const stopButton = document.querySelector("#stop-listening");
const retryButton = document.querySelector("#retry-listening");
const statusOutput = document.querySelector("#recognition-status");
const errorOutput = document.querySelector("#recognition-error");
const resultsSection = document.querySelector("#recognition-results");
const primaryOutput = document.querySelector("#primary-transcript");
const classificationOutput = document.querySelector("#match-classification");
const alternativesBody = document.querySelector("#alternatives-body");
const rawOutput = document.querySelector("#raw-result");
const capabilityOutput = document.querySelector("#capability-status");

const Recognition = getSpeechRecognitionConstructor(window);
let recognition = null;
let listening = false;

function setStatus(message) {
  statusOutput.textContent = message;
}

function setListening(nextListening) {
  listening = nextListening;
  startButton.disabled = nextListening || !Recognition;
  stopButton.disabled = !nextListening;
  retryButton.disabled = nextListening || !Recognition;
  targetInput.disabled = nextListening;
}

function clearResults() {
  errorOutput.hidden = true;
  errorOutput.textContent = "";
  resultsSection.hidden = true;
  primaryOutput.textContent = "—";
  classificationOutput.textContent = "—";
  alternativesBody.replaceChildren();
  rawOutput.textContent = "Chưa có kết quả.";
}

function showInconclusive(issue, message) {
  const diagnostic = classifyRecognition({ target: targetInput.value, issue });
  classificationOutput.textContent = diagnostic.classification;
  primaryOutput.textContent = "—";
  rawOutput.textContent = JSON.stringify(diagnostic, null, 2);
  resultsSection.hidden = false;
  errorOutput.textContent = message;
  errorOutput.hidden = false;
}

function renderResult(alternatives) {
  const diagnostic = classifyRecognition({ target: targetInput.value, alternatives });
  primaryOutput.textContent = diagnostic.primaryTranscript || "—";
  classificationOutput.textContent = diagnostic.classification;
  classificationOutput.dataset.classification = diagnostic.classification;
  alternativesBody.replaceChildren(...diagnostic.alternatives.map((alternative, index) => {
    const row = document.createElement("tr");
    const position = document.createElement("td");
    const transcript = document.createElement("td");
    const confidence = document.createElement("td");
    position.textContent = String(index + 1);
    transcript.textContent = alternative.transcript || "(trống)";
    confidence.textContent = `${alternative.confidence ?? "N/A"} (${confidencePercentage(alternative.confidence)})`;
    row.append(position, transcript, confidence);
    return row;
  }));
  rawOutput.textContent = JSON.stringify({
    target: diagnostic.target,
    classification: diagnostic.classification,
    alternatives: diagnostic.alternatives.map(({ transcript, confidence }) => ({ transcript, confidence })),
  }, null, 2);
  resultsSection.hidden = false;
  errorOutput.hidden = true;
}

function createRecognition() {
  const instance = new Recognition();
  instance.lang = "en-US";
  instance.continuous = false;
  instance.interimResults = false;
  instance.maxAlternatives = 5;
  instance.onstart = () => {
    setListening(true);
    setStatus("Đang nghe. Hãy nói một từ tiếng Anh.");
  };
  instance.onspeechend = () => {
    setStatus("Đã nhận giọng nói; đang chờ kết quả nhận dạng.");
  };
  instance.onresult = (event) => {
    const alternatives = Array.from(event.results?.[0] || [], (result) => ({
      transcript: result.transcript,
      confidence: result.confidence,
    }));
    renderResult(alternatives);
    setStatus("Đã nhận kết quả chẩn đoán.");
  };
  instance.onerror = (event) => {
    const messages = {
      "not-allowed": "Quyền microphone bị từ chối hoặc không khả dụng.",
      "no-speech": "Không phát hiện giọng nói. Hãy thử lại.",
      "audio-capture": "Không tìm thấy microphone khả dụng.",
      network: "Dịch vụ nhận dạng của trình duyệt gặp lỗi mạng.",
    };
    showInconclusive(event.error || "RECOGNITION_ERROR", messages[event.error] || "Không thể đánh giá lần nhận dạng này.");
    setStatus("Kết quả không thể kết luận.");
  };
  instance.onend = () => {
    setListening(false);
    if (statusOutput.textContent.startsWith("Đang nghe")) {
      setStatus("Đã dừng nghe mà chưa có kết quả.");
    }
  };
  return instance;
}

function startRecognition() {
  const target = targetInput.value.trim();
  if (!target) {
    showInconclusive("INVALID_TARGET", "Hãy nhập một từ mục tiêu trước khi bắt đầu.");
    targetInput.focus();
    return;
  }
  clearResults();
  recognition = createRecognition();
  setStatus("Đang yêu cầu quyền microphone…");
  try {
    recognition.start();
  } catch {
    showInconclusive("START_FAILED", "Không thể bắt đầu nhận dạng. Hãy đợi rồi thử lại.");
    setListening(false);
  }
}

startButton.addEventListener("click", startRecognition);
retryButton.addEventListener("click", startRecognition);
stopButton.addEventListener("click", () => {
  if (listening && recognition) {
    setStatus("Đang dừng nghe…");
    recognition.stop();
  }
});

if (Recognition) {
  capabilityOutput.textContent = "Trình duyệt có SpeechRecognition/webkitSpeechRecognition.";
  setStatus("Sẵn sàng. Microphone chỉ được yêu cầu khi bạn bấm Bắt đầu nghe.");
  setListening(false);
} else {
  capabilityOutput.textContent = "Trình duyệt này không hỗ trợ SpeechRecognition.";
  showInconclusive("UNSUPPORTED", "Hãy mở harness bằng Chrome có hỗ trợ Web Speech API.");
  setStatus("Không hỗ trợ nhận dạng giọng nói.");
  setListening(false);
}
