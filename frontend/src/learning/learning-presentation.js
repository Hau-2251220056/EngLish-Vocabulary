const CEFR_ORDER = new Map([
  ["A1", 0],
  ["A2", 1],
  ["B1", 2],
  ["B2", 3],
  ["C1", 4],
  ["C2", 5],
]);

export function selectPrimaryMeaning(meanings = []) {
  let selected = null;
  let selectedRank = Number.POSITIVE_INFINITY;

  for (const meaning of meanings) {
    const rank = CEFR_ORDER.get(meaning.cefr_level) ?? Number.POSITIVE_INFINITY;
    if (selected === null || rank < selectedRank) {
      selected = meaning;
      selectedRank = rank;
    }
  }

  return selected;
}

export function nextUnassessedCardId(cards, assessments, currentIndex) {
  for (let offset = 1; offset <= cards.length; offset += 1) {
    const card = cards[(currentIndex + offset) % cards.length];
    if (card && !assessments[card.id]) return card.id;
  }
  return null;
}

export function isKeyboardShortcutSafe(target) {
  if (typeof Element === "undefined") return true;
  if (!(target instanceof Element)) return true;
  return !target.closest(
    "button, a, input, select, textarea, summary, [contenteditable='true'], [role='button']",
  );
}

export function selectEnglishSpeechVoice(voices = []) {
  const englishVoices = voices.filter((voice) =>
    voice?.lang?.toLowerCase().startsWith("en"),
  );
  return englishVoices.find((voice) => voice.default) ?? englishVoices[0] ?? null;
}

export function resolveFlashcardInteraction(revealed, trigger) {
  if (trigger === "speaker") {
    return { shouldFlip: false, nextRevealed: revealed, shouldPlayPronunciation: true };
  }
  return {
    shouldFlip: true,
    nextRevealed: !revealed,
    shouldPlayPronunciation: !revealed && ["card", "space"].includes(trigger),
  };
}

export function revealWithPronunciation(reveal, playPronunciation) {
  reveal();
  try {
    const playback = playPronunciation();
    if (playback?.catch) void playback.catch(() => {});
  } catch {
    // Playback is enhancement-only; revealing the answer must always succeed.
  }
}

export function pendingLearningOutcome(eventState, attempt) {
  return eventState === "pending" ? attempt?.outcome ?? null : null;
}

export function isLearningOutcomePending(eventState, attempt, outcome) {
  return pendingLearningOutcome(eventState, attempt) === outcome;
}
