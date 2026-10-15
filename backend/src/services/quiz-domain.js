// @ts-nocheck
import { createHash } from "node:crypto";

const CEFR_ORDER = new Map([["A1", 0], ["A2", 1], ["B1", 2], ["B2", 3], ["C1", 4], ["C2", 5]]);
const CHOICE_POLICY_VERSION = "quiz-multiple-choice-v1";
const REVISION_POLICY_VERSION = "quiz-question-revision-v4";

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

export function normalizeChoiceLabel(value) {
  if (typeof value !== "string") throw new TypeError("Quiz choice label is invalid.");
  const normalized = value.trim().normalize("NFC").replace(/\s+/gu, " ").toLowerCase();
  if (!normalized) throw new TypeError("Quiz choice label is invalid.");
  return normalized;
}

export function buildMultipleChoiceQuestion({ runId, setId, item, setCandidates, canonicalCandidates }) {
  const vocabulary = item?.vocabulary;
  const correctMeaning = selectPrimaryMeaning(vocabulary?.meanings);
  if (!vocabulary || typeof vocabulary.word !== "string" || !correctMeaning) {
    throw new TypeError("Quiz question content is unavailable.");
  }
  const seenLabels = new Set([normalizeChoiceLabel(correctMeaning.meaning_vi)]);
  const local = eligibleCandidates(setCandidates, vocabulary.id, seenLabels);
  const selected = rankCandidates(local, runId, setId, vocabulary.id).slice(0, 3);
  if (selected.length < 3) {
    const external = eligibleCandidates(canonicalCandidates, vocabulary.id, seenLabels);
    selected.push(...rankCandidates(external, runId, setId, vocabulary.id).slice(0, 3 - selected.length));
  }
  if (selected.length !== 3) return null;

  const choiceInputs = [
    { vocabulary, meaning: correctMeaning, isCorrect: true },
    ...selected.map(({ vocabulary: candidate, meaning }) => ({ vocabulary: candidate, meaning, isCorrect: false })),
  ];
  const choices = choiceInputs.map((choice) => ({
    choice_id: digest(canonicalSerialize([CHOICE_POLICY_VERSION, runId, setId, vocabulary.id, choice.vocabulary.id, choice.meaning.id])),
    label: choice.meaning.meaning_vi,
    isCorrect: choice.isCorrect,
    vocabularyId: choice.vocabulary.id,
    meaningId: choice.meaning.id,
    vocabularyUpdatedAt: choice.vocabulary.updated_at,
    meaningUpdatedAt: choice.meaning.updated_at,
  }));
  choices.sort((left, right) => choiceRank(left.choice_id, runId, setId, vocabulary.id)
    .localeCompare(choiceRank(right.choice_id, runId, setId, vocabulary.id)));
  const revision = createQuestionRevision({ runId, setId, itemId: item.id, position: item.position, vocabulary, correctMeaning, choices });
  const correctChoice = choices.find(({ isCorrect }) => isCorrect);
  return {
    question: {
      vocabulary_id: vocabulary.id,
      position: item.position,
      question_revision: revision,
      prompt: { word: vocabulary.word, part_of_speech: correctMeaning.part_of_speech ?? null },
      choices: choices.map(({ choice_id, label }) => ({ choice_id, label })),
    },
    correctChoiceId: correctChoice.choice_id,
    choiceIds: new Set(choices.map(({ choice_id }) => choice_id)),
  };
}

export function createQuestionRevision({ runId, setId, itemId, position, vocabulary, correctMeaning, choices }) {
  return digest(canonicalSerialize([
    REVISION_POLICY_VERSION, CHOICE_POLICY_VERSION, runId, setId, itemId, position,
    vocabulary.id, vocabulary.word, toTimestamp(vocabulary.updated_at),
    correctMeaning.id, correctMeaning.meaning_vi, correctMeaning.part_of_speech ?? null,
    toTimestamp(correctMeaning.updated_at),
    choices.map((choice) => [choice.choice_id, choice.vocabularyId, choice.meaningId, choice.label,
      toTimestamp(choice.vocabularyUpdatedAt), toTimestamp(choice.meaningUpdatedAt)]),
  ]));
}

function eligibleCandidates(candidates, questionVocabularyId, seenLabels) {
  const eligible = [];
  for (const vocabulary of candidates ?? []) {
    if (!vocabulary || vocabulary.id === questionVocabularyId) continue;
    const meaning = selectPrimaryMeaning(vocabulary.meanings);
    if (!meaning) continue;
    let label;
    try { label = normalizeChoiceLabel(meaning.meaning_vi); } catch { continue; }
    if (seenLabels.has(label)) continue;
    seenLabels.add(label);
    eligible.push({ vocabulary, meaning });
  }
  return eligible;
}

function rankCandidates(candidates, runId, setId, vocabularyId) {
  return [...candidates].sort((left, right) => candidateRank(left, runId, setId, vocabularyId)
    .localeCompare(candidateRank(right, runId, setId, vocabularyId)));
}
function candidateRank(candidate, runId, setId, vocabularyId) {
  return digest(canonicalSerialize([CHOICE_POLICY_VERSION, "candidate", runId, setId, vocabularyId,
    candidate.vocabulary.id, candidate.meaning.id]));
}
function choiceRank(choiceId, runId, setId, vocabularyId) {
  return digest(canonicalSerialize([CHOICE_POLICY_VERSION, "order", runId, setId, vocabularyId, choiceId]));
}
function canonicalSerialize(value) { return JSON.stringify(value); }
function digest(value) { return createHash("sha256").update(value, "utf8").digest("base64url"); }
function toTimestamp(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return new Date(value).toISOString();
  throw new TypeError("Quiz revision timestamp is invalid.");
}
