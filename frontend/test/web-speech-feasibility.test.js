import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyRecognition,
  confidencePercentage,
  getSpeechRecognitionConstructor,
  MATCH_CLASSIFICATIONS,
  normalizeRecognitionText,
} from "../spikes/web-speech-feasibility/speech-feasibility.js";

test("normalization handles Unicode, case, whitespace and outer punctuation conservatively", () => {
  assert.equal(normalizeRecognitionText("  PROFESSOR!  "), "professor");
  assert.equal(normalizeRecognitionText("“Café”"), "café");
  assert.equal(normalizeRecognitionText("teacher's"), "teacher's");
  assert.notEqual(normalizeRecognitionText("teachers"), normalizeRecognitionText("teacher"));
});

test("primary transcript exact match is diagnostic PRIMARY_MATCH", () => {
  const result = classifyRecognition({
    target: "Professor",
    alternatives: [{ transcript: "professor", confidence: 0.962 }],
  });
  assert.equal(result.classification, MATCH_CLASSIFICATIONS.PRIMARY_MATCH);
  assert.equal(result.matchedAlternativeIndex, 0);
  assert.equal(result.alternatives[0].confidence, 0.962);
});

test("exact target in a later alternative is ALTERNATIVE_MATCH", () => {
  const result = classifyRecognition({
    target: "teacher",
    alternatives: [
      { transcript: "teachers", confidence: 0.91 },
      { transcript: "teacher", confidence: 0.843 },
    ],
  });
  assert.equal(result.classification, MATCH_CLASSIFICATIONS.ALTERNATIVE_MATCH);
  assert.equal(result.matchedAlternativeIndex, 1);
});

test("plural, substring and unrelated alternatives remain NO_MATCH", () => {
  for (const transcript of ["teachers", "teacher helper", "picture"]) {
    assert.equal(classifyRecognition({
      target: "teacher",
      alternatives: [{ transcript, confidence: 0.8 }],
    }).classification, MATCH_CLASSIFICATIONS.NO_MATCH);
  }
});

test("missing results and recognition errors are INCONCLUSIVE", () => {
  assert.equal(classifyRecognition({ target: "book" }).classification, MATCH_CLASSIFICATIONS.INCONCLUSIVE);
  assert.equal(classifyRecognition({
    target: "book",
    issue: "NO_SPEECH",
    alternatives: [{ transcript: "book", confidence: 0.9 }],
  }).classification, MATCH_CLASSIFICATIONS.INCONCLUSIVE);
});

test("invalid or missing confidence is retained as unavailable, not converted to a score", () => {
  for (const confidence of [undefined, Number.NaN, -1, 1.1, "0.8"]) {
    const result = classifyRecognition({ target: "book", alternatives: [{ transcript: "book", confidence }] });
    assert.equal(result.alternatives[0].confidence, null);
    assert.equal(confidencePercentage(confidence), "Không được cung cấp");
  }
  assert.equal(confidencePercentage(0.843), "84.3%");
});

test("capability detection supports standard, prefixed and unsupported browsers", () => {
  class StandardRecognition {}
  class PrefixedRecognition {}
  assert.equal(getSpeechRecognitionConstructor({ SpeechRecognition: StandardRecognition }), StandardRecognition);
  assert.equal(getSpeechRecognitionConstructor({ webkitSpeechRecognition: PrefixedRecognition }), PrefixedRecognition);
  assert.equal(getSpeechRecognitionConstructor({}), null);
});
