import { QuizApiError } from "../services/quiz-service.js";

export const quizAnswerHasContent = (value) => typeof value === "string" && value.trim().length > 0;

export function selectUnscrambleTile(prompt, selectedTileIds, tileId) {
  if (!isUnscramblePrompt(prompt) || selectedTileIds.includes(tileId)) return selectedTileIds;
  if (!prompt.tiles.some((tile) => tile.tile_id === tileId)) return selectedTileIds;
  if (selectedTileIds.length >= selectableSlotCount(prompt)) return selectedTileIds;
  return [...selectedTileIds, tileId];
}

export function removeUnscrambleTile(selectedTileIds, tileId) {
  return selectedTileIds.filter((selectedId) => selectedId !== tileId);
}

export function availableUnscrambleTiles(prompt, selectedTileIds) {
  const selected = new Set(selectedTileIds);
  return isUnscramblePrompt(prompt)
    ? prompt.tiles.filter((tile) => !selected.has(tile.tile_id))
    : [];
}

export function buildUnscrambleAnswer(prompt, selectedTileIds) {
  if (!isUnscramblePrompt(prompt)) return "";
  const byId = new Map(prompt.tiles.map((tile) => [tile.tile_id, tile.character]));
  let selectedIndex = 0;
  return prompt.slots.map((slot) => {
    if (slot.kind === "separator") return slot.value;
    const character = byId.get(selectedTileIds[selectedIndex]);
    selectedIndex += 1;
    return character ?? "";
  }).join("");
}

export function isUnscrambleAnswerComplete(prompt, selectedTileIds) {
  return isUnscramblePrompt(prompt) &&
    selectedTileIds.length === selectableSlotCount(prompt);
}

export function unscrambleAnswerSlots(prompt, selectedTileIds) {
  if (!isUnscramblePrompt(prompt)) return [];
  const byId = new Map(prompt.tiles.map((tile) => [tile.tile_id, tile.character]));
  let selectedIndex = 0;
  return prompt.slots.map((slot, position) => {
    if (slot.kind === "separator") return { ...slot, position };
    const tileId = selectedTileIds[selectedIndex] ?? null;
    selectedIndex += 1;
    return {
      kind: "tile",
      position,
      tile_id: tileId,
      character: tileId ? byId.get(tileId) : null,
    };
  });
}

export function createSharedQuizQuestionLoader(load) {
  const pending = new Map();
  return (key, ...argumentsForLoad) => {
    const existing = pending.get(key);
    if (existing) return existing;
    const request = Promise.resolve().then(() => load(...argumentsForLoad));
    pending.set(key, request);
    const cleanup = () => { if (pending.get(key) === request) pending.delete(key); };
    request.then(cleanup, cleanup);
    return request;
  };
}

export function classifyQuizLoadError(error) {
  if (error instanceof QuizApiError && error.code === "QUIZ_SET_EMPTY") return "empty";
  if (error instanceof QuizApiError && error.kind === "not-found") return "not-found";
  return "error";
}

export function classifyQuizSubmissionError(error) {
  const code = error instanceof QuizApiError ? error.code : "QUIZ_REQUEST_FAILED";
  if (error instanceof QuizApiError && error.kind === "not-found") return { kind: "not-found", code, conclusive: true };
  if (["QUIZ_QUESTION_CHANGED", "QUIZ_ITEM_CHANGED"].includes(code)) return { kind: "question-changed", code, conclusive: true };
  if (["QUIZ_PROGRESS_CONFLICT", "QUIZ_RETRY_CONFLICT"].includes(code)) return { kind: "progress-conflict", code, conclusive: true };
  if (error instanceof QuizApiError && (error.kind === "validation" || error.status === 400)) return { kind: "validation", code, conclusive: true };
  return { kind: "operational", code, conclusive: false };
}

export function describeCharacterFeedback(item) {
  const position = Number.isSafeInteger(item?.position) ? item.position + 1 : 1;
  const submitted = displayCharacter(item?.submitted);
  const expected = displayCharacter(item?.expected);
  if (item?.state === "correct" && item?.submitted === " " && item?.expected === "-") {
    return {
      shortLabel: "Đúng",
      accessibleLabel: `Ký tự ${position}: dấu cách được chấp nhận thay cho dấu gạch nối.`,
    };
  }
  if (item?.state === "correct") return { shortLabel: "Đúng", accessibleLabel: `Ký tự ${position}: ${submitted}, đúng.` };
  if (item?.state === "missing") return { shortLabel: "Thiếu", accessibleLabel: `Ký tự ${position}: thiếu ${expected}.` };
  if (item?.state === "extra") return { shortLabel: "Thừa", accessibleLabel: `Ký tự ${position}: ${submitted} là ký tự thừa.` };
  return { shortLabel: "Sai", accessibleLabel: `Ký tự ${position}: ${submitted}, đáp án là ${expected}.` };
}

export function visibleCharacterFeedbackValue(item) {
  return item?.state === "missing" || item?.submitted === null
    ? "_"
    : item?.submitted ?? "_";
}

export function presentCharacterFeedback(feedback) {
  return feedback.map((item) => ({
    ...item,
    accessibleLabel: describeCharacterFeedback(item).accessibleLabel,
    visibleValue: visibleCharacterFeedbackValue(item),
  }));
}

function displayCharacter(value) { return value === " " ? "dấu cách" : value ?? "ký tự trống"; }

function selectableSlotCount(prompt) {
  return prompt.slots.filter(({ kind }) => kind === "tile").length;
}

function isUnscramblePrompt(prompt) {
  return Boolean(prompt && Array.isArray(prompt.tiles) && Array.isArray(prompt.slots));
}
