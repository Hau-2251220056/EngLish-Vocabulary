import { installAuthApiMock, publicAdmin, publicUser, responses } from "./auth-api.js";

const revisions = {
  first: "A".repeat(43),
  second: "B".repeat(43),
};

export async function installQuizApiMock(page, options = {}) {
  const calls = { answers: [], learningEvents: [], questions: [] };
  const user = options.user ?? publicUser;
  await installAuthApiMock(page, {
    "/api/auth/me": options.guest ? responses.guest() : responses.currentUser(user),
  });
  await page.route("**/api/learning/events", async (route) => {
    calls.learningEvents.push(route.request().postDataJSON());
    await route.fulfill({ status: 500, json: { success: false } });
  });
  await page.route("**/api/quiz/sets/*/questions**", async (route) => {
    const url = new URL(route.request().url());
    const quizType = url.searchParams.get("type");
    const runId = url.searchParams.get("run_id");
    calls.questions.push({ quizType, runId });
    const response = options.onQuestions
      ? await options.onQuestions({ call: calls.questions.length, quizType, runId })
      : success(questionPayload(quizType, runId, options));
    await fulfill(route, response);
  });
  await page.route("**/api/quiz/answers", async (route) => {
    const body = route.request().postDataJSON();
    calls.answers.push(body);
    const response = options.onAnswer
      ? await options.onAnswer({ body, call: calls.answers.length })
      : success(answerResult(body));
    await fulfill(route, response);
  });
  return calls;
}

export { publicAdmin, publicUser };

export function questionPayload(quizType, runId, options = {}) {
  const questions = quizType === "UNSCRAMBLE_WORD"
    ? [unscrambleQuestion(), identityQuestion()]
    : [viQuestion("word-book", 1, revisions.first, "quyển sách"), viQuestion("word-travel", 2, revisions.second, "du lịch")];
  return {
    id: options.setId ?? "set-flow",
    name: options.setName ?? "Quiz browser review",
    quiz_type: quizType,
    run_id: runId,
    questions: options.questions ?? questions,
  };
}

export function viQuestion(vocabularyId, position, questionRevision, meaning, overrides = {}) {
  return {
    vocabulary_id: vocabularyId,
    position,
    question_revision: questionRevision,
    prompt: {
      meaning_vi: meaning,
      context: overrides.context ?? null,
      part_of_speech: overrides.part_of_speech ?? "noun",
      cefr_level: overrides.cefr_level ?? "A1",
    },
    progress: {
      status: overrides.status ?? "NEW",
      review_count: overrides.review_count ?? 0,
      revision: overrides.revision ?? 0,
      last_reviewed_at: null,
    },
  };
}

export function answerResult(body, overrides = {}) {
  const answer = body.answer;
  const canonical = overrides.correct_answer ?? (body.vocabulary_id === "word-travel" ? "travel" : body.vocabulary_id === "word-identity" ? "a" : "book");
  const correct = overrides.is_correct ?? answer === canonical;
  return {
    set_id: body.set_id,
    vocabulary_id: body.vocabulary_id,
    run_id: body.run_id,
    quiz_type: body.quiz_type,
    is_correct: correct,
    correct_answer: canonical,
    normalized_answer: answer,
    character_feedback: overrides.character_feedback ?? feedback(answer, canonical),
    progress: {
      status: correct ? "LEARNED" : "LEARNING",
      review_count: body.expected_revision + 1,
      revision: body.expected_revision + 1,
      last_reviewed_at: "2026-09-27T00:00:00.000Z",
    },
  };
}

export function success(data) {
  return { status: 200, json: { success: true, data } };
}

export function failure(status, code, message = "Không thể xử lý Quiz.") {
  return { status, json: { success: false, error: { code, message } } };
}

async function fulfill(route, response) {
  if (response?.abort) return route.abort(response.abort);
  return route.fulfill(response);
}

function unscrambleQuestion() {
  return {
    ...viQuestion("word-book", 1, revisions.first, "quyển sách"),
    prompt: {
      meaning_vi: "quyển sách",
      context: null,
      part_of_speech: "noun",
      cefr_level: "A1",
      shuffle_mode: "SHUFFLED",
      tiles: [tile("o-2", "o"), tile("b", "b"), tile("k", "k"), tile("o-1", "o")],
      slots: [{ kind: "tile" }, { kind: "tile" }, { kind: "separator", value: "-" }, { kind: "tile" }, { kind: "tile" }],
    },
  };
}

function identityQuestion() {
  return {
    ...viQuestion("word-identity", 2, revisions.second, "một ký tự"),
    prompt: {
      meaning_vi: "một ký tự",
      context: null,
      part_of_speech: "noun",
      cefr_level: null,
      shuffle_mode: "IDENTITY_FALLBACK",
      tiles: [tile("a", "a")],
      slots: [{ kind: "tile" }],
    },
  };
}

function tile(seed, character) {
  return { tile_id: seed.padEnd(43, "x"), character };
}

function feedback(answer, canonical) {
  const length = Math.max([...answer].length, [...canonical].length);
  return Array.from({ length }, (_, position) => {
    const submitted = [...answer][position] ?? null;
    const expected = [...canonical][position] ?? null;
    return {
      position,
      submitted,
      expected,
      state: submitted === expected ? "correct" : submitted === null ? "missing" : expected === null ? "extra" : "incorrect",
    };
  });
}
