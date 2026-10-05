import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isKeyboardShortcutSafe,
  isLearningRatingPending,
  pendingLearningRating,
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

test("same-spelling cards retain exact identities and selected Meaning POS/text", () => {
  const cards = [
    { id: "canonical-book", word: "book", meanings: [{ id: "c", cefr_level: "A1", part_of_speech: "noun", meaning_vi: "canonical meaning" }] },
    { id: "private-book", word: "book", meanings: [
      { id: "p-b2", cefr_level: "B2", part_of_speech: "noun", meaning_vi: "private book meaning" },
      { id: "p-a2", cefr_level: "A2", part_of_speech: "verb", meaning_vi: "private booking meaning" },
    ] },
  ];
  const selected = selectPrimaryMeaning(cards[1].meanings);
  assert.deepEqual({ id: selected.id, part_of_speech: selected.part_of_speech, meaning_vi: selected.meaning_vi }, {
    id: "p-a2", part_of_speech: "verb", meaning_vi: "private booking meaning",
  });
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

test("Learning audio keeps card URL priority and exact-word native TTS fallback", async () => {
  const source = await readFile(new URL("../src/learning/learning-foundation-page.jsx", import.meta.url), "utf8");
  assert.match(source, /if \(currentCard\.pronunciation_url\) \{[\s\S]*new Audio\(currentCard\.pronunciation_url\)/);
  assert.match(source, /new window\.SpeechSynthesisUtterance\(currentCard\.word\)/);
  assert.doesNotMatch(source, /find\([^\n]*\.word|filter\([^\n]*\.word/);
});

test("pending visual belongs only to the submitted SRS rating", () => {
  const attempt = { rating: "AGAIN" };
  assert.equal(pendingLearningRating("pending", attempt), "AGAIN");
  assert.equal(isLearningRatingPending("pending", attempt, "AGAIN"), true);
  assert.equal(isLearningRatingPending("pending", attempt, "GOOD"), false);
  assert.equal(pendingLearningRating("error", attempt), null);
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
