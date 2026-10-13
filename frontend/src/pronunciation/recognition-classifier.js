const MAX_ALTERNATIVES = 5;
const OUTER_PUNCTUATION = /^\p{P}+|\p{P}+$/gu;

export const RECOGNITION_OUTCOMES = Object.freeze({
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

export function normalizeRecognitionConfidence(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}

export function classifyRecognition({ target, alternatives } = {}) {
  const normalizedTarget = normalizeRecognitionText(target);
  const rawAlternatives = Array.isArray(alternatives)
    ? alternatives.slice(0, MAX_ALTERNATIVES)
    : [];
  const primary = sanitizeAlternative(rawAlternatives[0], 0);
  const sanitizedAlternatives = sanitizeAlternatives(rawAlternatives);

  if (!normalizedTarget) {
    return inconclusiveResult({
      issue: "INVALID_TARGET",
      target,
      normalizedTarget,
      alternatives: sanitizedAlternatives,
    });
  }

  if (rawAlternatives.length === 0) {
    return inconclusiveResult({
      issue: "NO_RESULT",
      target,
      normalizedTarget,
      alternatives: sanitizedAlternatives,
    });
  }

  if (!primary) {
    return inconclusiveResult({
      issue: "UNUSABLE_PRIMARY",
      target,
      normalizedTarget,
      alternatives: sanitizedAlternatives,
    });
  }

  const matchedAlternative = sanitizedAlternatives.find(
    ({ normalizedTranscript }) => normalizedTranscript === normalizedTarget,
  );
  const classification = matchedAlternative?.sourceIndex === 0
    ? RECOGNITION_OUTCOMES.PRIMARY_MATCH
    : matchedAlternative
      ? RECOGNITION_OUTCOMES.ALTERNATIVE_MATCH
      : RECOGNITION_OUTCOMES.NO_MATCH;

  return {
    classification,
    issue: null,
    target,
    normalizedTarget,
    primaryTranscript: primary.transcript,
    matchedAlternativeIndex: matchedAlternative?.sourceIndex ?? null,
    alternatives: sanitizedAlternatives,
  };
}

function sanitizeAlternatives(rawAlternatives) {
  const seen = new Set();
  const alternatives = [];

  rawAlternatives.forEach((alternative, sourceIndex) => {
    const sanitized = sanitizeAlternative(alternative, sourceIndex);
    if (!sanitized || seen.has(sanitized.normalizedTranscript)) return;
    seen.add(sanitized.normalizedTranscript);
    alternatives.push(sanitized);
  });

  return alternatives;
}

function sanitizeAlternative(alternative, sourceIndex) {
  if (!alternative || typeof alternative !== "object" || Array.isArray(alternative)) {
    return null;
  }

  const normalizedTranscript = normalizeRecognitionText(alternative.transcript);
  if (!normalizedTranscript) return null;

  return {
    transcript: alternative.transcript,
    normalizedTranscript,
    confidence: normalizeRecognitionConfidence(alternative.confidence),
    sourceIndex,
  };
}

function inconclusiveResult({ issue, target, normalizedTarget, alternatives }) {
  return {
    classification: RECOGNITION_OUTCOMES.INCONCLUSIVE,
    issue,
    target,
    normalizedTarget,
    primaryTranscript: null,
    matchedAlternativeIndex: null,
    alternatives,
  };
}
