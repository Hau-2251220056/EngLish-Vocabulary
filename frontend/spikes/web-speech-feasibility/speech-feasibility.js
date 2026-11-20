const OUTER_PUNCTUATION = /^\p{P}+|\p{P}+$/gu;

export const MATCH_CLASSIFICATIONS = Object.freeze({
  PRIMARY_MATCH: "PRIMARY_MATCH",
  ALTERNATIVE_MATCH: "ALTERNATIVE_MATCH",
  NO_MATCH: "NO_MATCH",
  INCONCLUSIVE: "INCONCLUSIVE",
});

export function normalizeRecognitionText(value) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFC")
    .trim()
    .replace(OUTER_PUNCTUATION, "")
    .trim()
    .toLocaleLowerCase("en-US");
}

export function normalizeConfidence(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}

export function classifyRecognition({ target, alternatives = [], issue = null } = {}) {
  const normalizedTarget = normalizeRecognitionText(target);
  const normalizedAlternatives = Array.isArray(alternatives)
    ? alternatives.map((alternative) => ({
      transcript: typeof alternative?.transcript === "string" ? alternative.transcript : "",
      confidence: normalizeConfidence(alternative?.confidence),
      normalizedTranscript: normalizeRecognitionText(alternative?.transcript),
    }))
    : [];

  if (issue || !normalizedTarget || normalizedAlternatives.length === 0) {
    return {
      classification: MATCH_CLASSIFICATIONS.INCONCLUSIVE,
      issue: issue || (!normalizedTarget ? "INVALID_TARGET" : "NO_RESULT"),
      target: typeof target === "string" ? target : "",
      normalizedTarget,
      alternatives: normalizedAlternatives,
    };
  }

  const matchIndex = normalizedAlternatives.findIndex(
    ({ normalizedTranscript }) => normalizedTranscript === normalizedTarget,
  );
  const classification = matchIndex === 0
    ? MATCH_CLASSIFICATIONS.PRIMARY_MATCH
    : matchIndex > 0
      ? MATCH_CLASSIFICATIONS.ALTERNATIVE_MATCH
      : MATCH_CLASSIFICATIONS.NO_MATCH;

  return {
    classification,
    issue: null,
    target: target.trim(),
    normalizedTarget,
    primaryTranscript: normalizedAlternatives[0].transcript,
    matchedAlternativeIndex: matchIndex >= 0 ? matchIndex : null,
    alternatives: normalizedAlternatives,
  };
}

export function getSpeechRecognitionConstructor(browserWindow = globalThis.window) {
  if (!browserWindow) return null;
  return browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition || null;
}

export function confidencePercentage(confidence) {
  const normalized = normalizeConfidence(confidence);
  return normalized === null ? "Không được cung cấp" : `${(normalized * 100).toFixed(1)}%`;
}
