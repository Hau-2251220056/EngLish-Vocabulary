import assert from "node:assert/strict";
import test from "node:test";
import {
  isKeyboardShortcutSafe,
  isLearningOutcomePending,
  nextUnassessedCardId,
  pendingLearningOutcome,
  resolveFlashcardInteraction,
  revealWithPronunciation,
  selectEnglishSpeechVoice,
  selectPrimaryMeaning,
} from "../src/learning/learning-presentation.js";

test("primary Meaning uses lowest CEFR and preserves deterministic order for ties", () => {
  const meanings = [
    { id: "b2-first", cefr_level: "B2" },
    { id: "a2-first", cefr_level: "A2" },
    { id: "a2-second", cefr_level: "A2" },
    { id: "without-cefr", cefr_level: null },
  ];

  assert.equal(selectPrimaryMeaning(meanings).id, "a2-first");
  assert.equal(
    selectPrimaryMeaning(meanings.filter((meaning) => meaning.cefr_level === null)).id,
    "without-cefr",
  );
  assert.equal(selectPrimaryMeaning([]), null);
});

test("next card selection skips assessed cards in ordered circular traversal", () => {
  const cards = [{ id: "one" }, { id: "two" }, { id: "three" }];
  assert.equal(nextUnassessedCardId(cards, { two: "REMEMBERED" }, 0), "three");
  assert.equal(
    nextUnassessedCardId(
      cards,
      { one: "REMEMBERED", two: "STUDY_AGAIN", three: "REMEMBERED" },
      1,
    ),
    null,
  );
});

test("keyboard safety defaults safely outside a browser DOM", () => {
  assert.equal(isKeyboardShortcutSafe(null), true);
});

test("pronunciation fallback prefers a default English voice without requiring one", () => {
  const voices = [
    { name: "Vietnamese", lang: "vi-VN", default: true },
    { name: "English UK", lang: "en-GB", default: false },
    { name: "English US", lang: "en-US", default: true },
  ];
  assert.equal(selectEnglishSpeechVoice(voices).name, "English US");
  assert.equal(selectEnglishSpeechVoice(voices.slice(0, 2)).name, "English UK");
  assert.equal(selectEnglishSpeechVoice([]), null);
});

test("pending visual belongs only to the submitted learning outcome", () => {
  const studyAgain = { outcome: "STUDY_AGAIN" };
  assert.equal(pendingLearningOutcome("pending", studyAgain), "STUDY_AGAIN");
  assert.equal(isLearningOutcomePending("pending", studyAgain, "STUDY_AGAIN"), true);
  assert.equal(isLearningOutcomePending("pending", studyAgain, "REMEMBERED"), false);

  const remembered = { outcome: "REMEMBERED" };
  assert.equal(pendingLearningOutcome("pending", remembered), "REMEMBERED");
  assert.equal(isLearningOutcomePending("pending", remembered, "REMEMBERED"), true);
  assert.equal(isLearningOutcomePending("pending", remembered, "STUDY_AGAIN"), false);
  assert.equal(pendingLearningOutcome("error", { outcome: "REMEMBERED" }), null);
});

test("Front card click and safe Space reveal with pronunciation; Back only flips", () => {
  assert.deepEqual(resolveFlashcardInteraction(false, "card"), {
    shouldFlip: true,
    nextRevealed: true,
    shouldPlayPronunciation: true,
  });
  assert.deepEqual(resolveFlashcardInteraction(false, "space"), {
    shouldFlip: true,
    nextRevealed: true,
    shouldPlayPronunciation: true,
  });
  assert.deepEqual(resolveFlashcardInteraction(true, "card"), {
    shouldFlip: true,
    nextRevealed: false,
    shouldPlayPronunciation: false,
  });
  assert.deepEqual(resolveFlashcardInteraction(true, "space"), {
    shouldFlip: true,
    nextRevealed: false,
    shouldPlayPronunciation: false,
  });
});

test("speaker plays without flipping and playback failure cannot block reveal", async () => {
  assert.deepEqual(resolveFlashcardInteraction(false, "speaker"), {
    shouldFlip: false,
    nextRevealed: false,
    shouldPlayPronunciation: true,
  });
  const actions = [];
  revealWithPronunciation(
    () => actions.push("revealed"),
    () => Promise.reject(new Error("playback unavailable")),
  );
  await Promise.resolve();
  assert.deepEqual(actions, ["revealed"]);
});
