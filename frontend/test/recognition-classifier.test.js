import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyRecognition,
  normalizeRecognitionConfidence,
  normalizeRecognitionText,
  RECOGNITION_OUTCOMES,
} from "../src/pronunciation/recognition-classifier.js";

test("primary exact match returns PRIMARY_MATCH", () => {
  const result = classifyRecognition({
    target: "professor",
    alternatives: [{ transcript: "professor", confidence: 0.907 }],
  });

  assert.equal(result.classification, RECOGNITION_OUTCOMES.PRIMARY_MATCH);
  assert.equal(result.matchedAlternativeIndex, 0);
  assert.equal(result.alternatives[0].confidence, 0.907);
});

test("normalization is case-insensitive and removes only surrounding punctuation", () => {
  assert.equal(normalizeRecognitionText("  “PROFESSOR?!”  "), "professor");
  assert.equal(normalizeRecognitionText("teacher's"), "teacher's");
  assert.equal(normalizeRecognitionText("mother-in-law"), "mother-in-law");
  assert.notEqual(normalizeRecognitionText("cant"), normalizeRecognitionText("can't"));
});

test("normalization composes canonically equivalent Unicode with NFC", () => {
  const decomposed = "Cafe\u0301";
  assert.equal(normalizeRecognitionText(decomposed), normalizeRecognitionText("CAFÉ"));
  assert.equal(normalizeRecognitionText(decomposed), "café");
});

test("plurals, substrings, ship and sheep remain distinct", () => {
  for (const [target, transcript] of [
    ["teacher", "teachers"],
    ["teacher", "teacher helper"],
    ["ship", "sheep"],
  ]) {
    const result = classifyRecognition({ target, alternatives: [{ transcript }] });
    assert.equal(result.classification, RECOGNITION_OUTCOMES.NO_MATCH);
  }
});

test("later exact alternative returns uncertain ALTERNATIVE_MATCH", () => {
  const result = classifyRecognition({
    target: "teacher",
    alternatives: [
      { transcript: "picture", confidence: 0.9 },
      { transcript: "teacher", confidence: 0.2 },
    ],
  });

  assert.equal(result.classification, RECOGNITION_OUTCOMES.ALTERNATIVE_MATCH);
  assert.notEqual(result.classification, RECOGNITION_OUTCOMES.PRIMARY_MATCH);
  assert.equal(result.primaryTranscript, "picture");
  assert.equal(result.matchedAlternativeIndex, 1);
});

test("unusable raw primary is INCONCLUSIVE and never promotes a later match", () => {
  for (const primary of [null, {}, { transcript: "" }, { transcript: "!!!" }]) {
    const result = classifyRecognition({
      target: "teacher",
      alternatives: [primary, { transcript: "teacher", confidence: 0.8 }],
    });

    assert.equal(result.classification, RECOGNITION_OUTCOMES.INCONCLUSIVE);
    assert.equal(result.issue, "UNUSABLE_PRIMARY");
    assert.equal(result.matchedAlternativeIndex, null);
  }
});

test("malformed and empty later alternatives are ignored in browser order", () => {
  const result = classifyRecognition({
    target: "book",
    alternatives: [
      { transcript: "look" },
      null,
      "book",
      { transcript: "..." },
      { transcript: "book", confidence: 0.4 },
    ],
  });

  assert.equal(result.classification, RECOGNITION_OUTCOMES.ALTERNATIVE_MATCH);
  assert.deepEqual(result.alternatives.map(({ transcript, sourceIndex }) => (
    [transcript, sourceIndex]
  )), [["look", 0], ["book", 4]]);
  assert.equal(result.matchedAlternativeIndex, 4);
});

test("normalized duplicate later alternatives are removed without changing primary", () => {
  const result = classifyRecognition({
    target: "book",
    alternatives: [
      { transcript: "look" },
      { transcript: " BOOK! ", confidence: 0.8 },
      { transcript: "book", confidence: 0.99 },
      { transcript: "cook" },
    ],
  });

  assert.equal(result.classification, RECOGNITION_OUTCOMES.ALTERNATIVE_MATCH);
  assert.equal(result.primaryTranscript, "look");
  assert.equal(result.matchedAlternativeIndex, 1);
  assert.deepEqual(result.alternatives.map(({ normalizedTranscript }) => normalizedTranscript), [
    "look",
    "book",
    "cook",
  ]);
});

test("only the first five raw browser candidates are processed", () => {
  const alternatives = ["one", "two", "three", "four", "five", "target"].map(
    (transcript) => ({ transcript }),
  );
  const result = classifyRecognition({ target: "target", alternatives });

  assert.equal(result.classification, RECOGNITION_OUTCOMES.NO_MATCH);
  assert.equal(result.alternatives.length, 5);
  assert.deepEqual(result.alternatives.map(({ sourceIndex }) => sourceIndex), [0, 1, 2, 3, 4]);
});

test("missing target or candidates produce INCONCLUSIVE", () => {
  assert.equal(classifyRecognition({ alternatives: [{ transcript: "book" }] }).issue, "INVALID_TARGET");
  assert.equal(classifyRecognition({ target: "book" }).issue, "NO_RESULT");
  assert.equal(classifyRecognition({ target: "book", alternatives: null }).issue, "NO_RESULT");
});

test("confidence accepts only finite numbers in the inclusive unit interval", () => {
  assert.equal(normalizeRecognitionConfidence(0), 0);
  assert.equal(normalizeRecognitionConfidence(1), 1);
  for (const value of [undefined, null, Number.NaN, Infinity, -0.1, 1.1, "0.8"]) {
    assert.equal(normalizeRecognitionConfidence(value), null);
  }

  const lowConfidenceMatch = classifyRecognition({
    target: "ship",
    alternatives: [{ transcript: "ship", confidence: 0.001 }],
  });
  assert.equal(lowConfidenceMatch.classification, RECOGNITION_OUTCOMES.PRIMARY_MATCH);
});

test("classifier output contains no pronunciation score or PASS/FAIL fields", () => {
  const result = classifyRecognition({
    target: "ship",
    alternatives: [{ transcript: "ship", confidence: 0.25 }],
  });

  for (const forbiddenField of [
    "score",
    "pronunciationScore",
    "accuracy",
    "pass",
    "passed",
    "isAcceptable",
  ]) {
    assert.equal(Object.hasOwn(result, forbiddenField), false);
  }
  assert.deepEqual(Object.values(RECOGNITION_OUTCOMES), [
    "PRIMARY_MATCH",
    "ALTERNATIVE_MATCH",
    "NO_MATCH",
    "INCONCLUSIVE",
  ]);
});
