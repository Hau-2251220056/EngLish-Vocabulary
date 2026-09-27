// @ts-nocheck
import { createHash } from "node:crypto";

const CEFR_ORDER = new Map([
  ["A1", 0],
  ["A2", 1],
  ["B1", 2],
  ["B2", 3],
  ["C1", 4],
  ["C2", 5],
]);
const SELECTABLE_CHARACTER_PATTERN = /^[\p{L}\p{Nd}]$/u;
const QUIZ_ANSWER_MAX_LENGTH = 100;
const UNSCRAMBLE_POLICY_VERSION = "quiz-unscramble-v1";
const QUESTION_REVISION_POLICY_VERSION = "quiz-question-revision-v3";

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

export function normalizeQuizAnswer(value) {
  if (typeof value !== "string" || value.length > QUIZ_ANSWER_MAX_LENGTH) {
    throw new TypeError("Quiz answer is invalid.");
  }
  const normalized = value
    .trim()
    .normalize("NFC")
    .replace(/\s+/gu, " ")
    .toLowerCase();
  if (normalized.length === 0) {
    throw new TypeError("Quiz answer is invalid.");
  }
  return normalized;
}

export function quizAnswersAreEquivalent(submitted, canonical, {
  allowSpaceForCanonicalHyphen = false,
} = {}) {
  const submittedCharacters = [...normalizeQuizAnswer(submitted)];
  const canonicalCharacters = [...normalizeQuizAnswer(canonical)];
  return submittedCharacters.length === canonicalCharacters.length
    && submittedCharacters.every((character, index) => charactersMatch(
      character,
      canonicalCharacters[index],
      allowSpaceForCanonicalHyphen,
    ));
}

export function buildCharacterFeedback(submitted, canonical, {
  allowSpaceForCanonicalHyphen = false,
} = {}) {
  const submittedCharacters = [...normalizeQuizAnswer(submitted)];
  const canonicalCharacters = [...normalizeQuizAnswer(canonical)];
  const costs = buildAlignmentCosts(
    submittedCharacters,
    canonicalCharacters,
    allowSpaceForCanonicalHyphen,
  );
  const feedback = [];
  let submittedIndex = 0;
  let canonicalIndex = 0;

  while (
    submittedIndex < submittedCharacters.length
    || canonicalIndex < canonicalCharacters.length
  ) {
    const submittedCharacter = submittedCharacters[submittedIndex];
    const canonicalCharacter = canonicalCharacters[canonicalIndex];
    const position = feedback.length;

    if (
      submittedIndex < submittedCharacters.length
      && canonicalIndex < canonicalCharacters.length
      && charactersMatch(
        submittedCharacter,
        canonicalCharacter,
        allowSpaceForCanonicalHyphen,
      )
      && costs[submittedIndex][canonicalIndex]
        === costs[submittedIndex + 1][canonicalIndex + 1]
    ) {
      feedback.push({
        position,
        submitted: submittedCharacter,
        expected: canonicalCharacter,
        state: "correct",
      });
      submittedIndex += 1;
      canonicalIndex += 1;
      continue;
    }

    const currentCost = costs[submittedIndex][canonicalIndex];
    const canSubstitute = submittedIndex < submittedCharacters.length
      && canonicalIndex < canonicalCharacters.length
      && currentCost === 1 + costs[submittedIndex + 1][canonicalIndex + 1];
    const canMarkMissing = canonicalIndex < canonicalCharacters.length
      && currentCost === 1 + costs[submittedIndex][canonicalIndex + 1];
    const canMarkExtra = submittedIndex < submittedCharacters.length
      && currentCost === 1 + costs[submittedIndex + 1][canonicalIndex];

    // Deterministic minimum-cost tie-breaking: a direct substitution is the
    // clearest single-position error; otherwise prefer the gap that exposes a
    // following exact match. The remaining stable order is missing, then extra.
    if (canSubstitute && !gapExposesImmediateMatch(
      submittedCharacters,
      canonicalCharacters,
      submittedIndex,
      canonicalIndex,
      allowSpaceForCanonicalHyphen,
    )) {
      feedback.push({
        position,
        submitted: submittedCharacter,
        expected: canonicalCharacter,
        state: "incorrect",
      });
      submittedIndex += 1;
      canonicalIndex += 1;
    } else if (canMarkMissing && (
      !canMarkExtra
      || charactersMatch(
        submittedCharacter,
        canonicalCharacters[canonicalIndex + 1],
        allowSpaceForCanonicalHyphen,
      )
    )) {
      feedback.push({
        position,
        submitted: null,
        expected: canonicalCharacter,
        state: "missing",
      });
      canonicalIndex += 1;
    } else if (canMarkExtra) {
      feedback.push({
        position,
        submitted: submittedCharacter,
        expected: null,
        state: "extra",
      });
      submittedIndex += 1;
    } else if (canSubstitute) {
      feedback.push({
        position,
        submitted: submittedCharacter,
        expected: canonicalCharacter,
        state: "incorrect",
      });
      submittedIndex += 1;
      canonicalIndex += 1;
    }
  }

  return feedback;
}

function buildAlignmentCosts(submitted, canonical, allowSpaceForCanonicalHyphen) {
  const costs = Array.from(
    { length: submitted.length + 1 },
    () => Array(canonical.length + 1).fill(0),
  );
  for (let submittedIndex = submitted.length; submittedIndex >= 0; submittedIndex -= 1) {
    costs[submittedIndex][canonical.length] = submitted.length - submittedIndex;
  }
  for (let canonicalIndex = canonical.length; canonicalIndex >= 0; canonicalIndex -= 1) {
    costs[submitted.length][canonicalIndex] = canonical.length - canonicalIndex;
  }
  for (let submittedIndex = submitted.length - 1; submittedIndex >= 0; submittedIndex -= 1) {
    for (let canonicalIndex = canonical.length - 1; canonicalIndex >= 0; canonicalIndex -= 1) {
      if (charactersMatch(
        submitted[submittedIndex],
        canonical[canonicalIndex],
        allowSpaceForCanonicalHyphen,
      )) {
        costs[submittedIndex][canonicalIndex] = costs[submittedIndex + 1][canonicalIndex + 1];
      } else {
        costs[submittedIndex][canonicalIndex] = 1 + Math.min(
          costs[submittedIndex + 1][canonicalIndex + 1],
          costs[submittedIndex][canonicalIndex + 1],
          costs[submittedIndex + 1][canonicalIndex],
        );
      }
    }
  }
  return costs;
}

function gapExposesImmediateMatch(
  submitted,
  canonical,
  submittedIndex,
  canonicalIndex,
  allowSpaceForCanonicalHyphen,
) {
  return charactersMatch(
    submitted[submittedIndex],
    canonical[canonicalIndex + 1],
    allowSpaceForCanonicalHyphen,
  ) || charactersMatch(
    submitted[submittedIndex + 1],
    canonical[canonicalIndex],
    allowSpaceForCanonicalHyphen,
  );
}

function charactersMatch(submitted, canonical, allowSpaceForCanonicalHyphen) {
  return submitted !== undefined && canonical !== undefined && (
    submitted === canonical
    || (allowSpaceForCanonicalHyphen && submitted === " " && canonical === "-")
  );
}

export function createUnscrambleProjection({ runId, setId, vocabularyId, word }) {
  const normalizedWord = normalizeQuizAnswer(word);
  const slots = [];
  const canonicalTiles = [];

  [...normalizedWord].forEach((character, canonicalIndex) => {
    if (SELECTABLE_CHARACTER_PATTERN.test(character)) {
      slots.push({ kind: "tile" });
      canonicalTiles.push({ character, canonicalIndex });
    } else {
      slots.push({ kind: "separator", value: character });
    }
  });
  if (canonicalTiles.length === 0) {
    throw new TypeError("Quiz word has no selectable characters.");
  }

  const seed = canonicalSerialize([
    UNSCRAMBLE_POLICY_VERSION,
    runId,
    setId,
    vocabularyId,
    normalizedWord,
  ]);
  let orderedTiles = canonicalTiles
    .map((tile) => ({ ...tile, rank: digest(`${seed}:rank:${tile.canonicalIndex}`) }))
    .sort((left, right) => left.rank.localeCompare(right.rank));
  const canonicalVisible = canonicalTiles.map(({ character }) => character).join("");
  const canDiffer = new Set(canonicalTiles.map(({ character }) => character)).size > 1;

  if (canDiffer && visibleSequence(orderedTiles) === canonicalVisible) {
    const offset = 1 + (digestByte(`${seed}:rotation`) % (orderedTiles.length - 1));
    orderedTiles = orderedTiles.slice(offset).concat(orderedTiles.slice(0, offset));
    if (visibleSequence(orderedTiles) === canonicalVisible) {
      orderedTiles = findDifferentRotation(orderedTiles, canonicalVisible);
    }
  }

  const shuffleMode = canDiffer ? "SHUFFLED" : "IDENTITY_FALLBACK";
  if (!canDiffer) orderedTiles = canonicalTiles;

  return {
    tiles: orderedTiles.map(({ character, canonicalIndex }) => ({
      tile_id: digest(`${seed}:tile:${canonicalIndex}`),
      character,
    })),
    slots,
    shuffle_mode: shuffleMode,
  };
}

export function createQuestionRevision({
  setId,
  itemId,
  position,
  quizType,
  vocabularyId,
  vocabularyUpdatedAt,
  runId = null,
  meaningId = null,
  meaningUpdatedAt = null,
}) {
  return digest(
    canonicalSerialize([
      QUESTION_REVISION_POLICY_VERSION,
      setId,
      itemId,
      position,
      quizType,
      vocabularyId,
      toTimestamp(vocabularyUpdatedAt),
      quizType === "UNSCRAMBLE_WORD" ? runId : null,
      meaningId,
      meaningUpdatedAt === null ? null : toTimestamp(meaningUpdatedAt),
      quizType === "UNSCRAMBLE_WORD" ? UNSCRAMBLE_POLICY_VERSION : null,
    ]),
  );
}

function canonicalSerialize(value) {
  return JSON.stringify(value);
}

function digest(value) {
  return createHash("sha256").update(value, "utf8").digest("base64url");
}

function digestByte(value) {
  return createHash("sha256").update(value, "utf8").digest()[0];
}

function visibleSequence(tiles) {
  return tiles.map(({ character }) => character).join("");
}

function findDifferentRotation(tiles, canonicalVisible) {
  for (let offset = 1; offset < tiles.length; offset += 1) {
    const rotated = tiles.slice(offset).concat(tiles.slice(0, offset));
    if (visibleSequence(rotated) !== canonicalVisible) return rotated;
  }
  return tiles;
}

function toTimestamp(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return new Date(value).toISOString();
  throw new TypeError("Quiz revision timestamp is invalid.");
}
