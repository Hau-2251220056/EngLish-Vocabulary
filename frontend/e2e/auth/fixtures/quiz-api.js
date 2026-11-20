import { installAuthApiMock, publicAdmin, publicUser, responses } from "./auth-api.js";

export const ids = ["A", "B", "C", "D"].map((letter) => letter.repeat(43));
export const quizSetId = "10000000-0000-4000-8000-000000000001";
export async function installQuizApiMock(page, options = {}) {
  const calls = { answers: [], learningEvents: [], manifests: [], questions: [], sessions: [] };
  const sessions = new Map();
  const questions = options.questions ?? [
    question("word-wake", 1, "wake", "thức dậy"),
    question("word-sleep", 2, "sleep", "ngủ"),
  ];
  await installAuthApiMock(page, { "/api/auth/me": options.guest ? responses.guest() : responses.currentUser(options.user ?? publicUser) });
  await page.route("**/api/learning/sets/*?mode=NORMAL", async (route) => {
    calls.manifests.push({ method: route.request().method(), url: route.request().url() });
    await route.fulfill({ status: 200, json: { success: true, data: {
      id: options.setId ?? quizSetId,
      name: options.setName ?? "Quiz browser review",
      mode: "NORMAL",
      total_items: questions.length,
      cards: questions.map(({ vocabulary_id, position, prompt }) => ({
        id: vocabulary_id,
        position,
        word: prompt.word,
        meanings: [],
        progress: {
          effective_status: "NEW",
          stage: 0,
          interval_days: null,
          next_review_at: null,
          review_count: 0,
          revision: 0,
        },
      })),
    } } });
  });
  await page.route("**/api/learning/events", async (route) => { calls.learningEvents.push(route.request().postDataJSON()); await route.fulfill({ status: 500, json: { success: false } }); });
  await page.route("**/api/learning-sessions**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "POST" && url.pathname === "/api/learning-sessions") {
      const body = request.postDataJSON();
      const session = sessionProjection(options.authoritativeSessionId ?? body.operation_id, body.set_id, body.vocabulary_ids);
      sessions.set(session.id, session);
      calls.sessions.push({ method: "POST", body });
      await route.fulfill({ status: 201, json: { success: true, data: { session, replayed: false } } });
      return;
    }
    if (request.method() === "GET") {
      const session = sessions.get(url.pathname.split("/").at(-1));
      calls.sessions.push({ method: "GET", id: session?.id ?? null });
      await route.fulfill(session
        ? { status: 200, json: { success: true, data: { ...session, can_continue: session.state === "ACTIVE" } } }
        : failure(404, "LEARNING_SESSION_NOT_FOUND"));
      return;
    }
    await route.fulfill(failure(404, "LEARNING_SESSION_NOT_FOUND"));
  });
  await page.route("**/api/quiz/sets/*/questions**", async (route) => {
    const url = new URL(route.request().url()); const runId = url.searchParams.get("run_id");
    calls.questions.push({ quizType: url.searchParams.get("type"), runId, vocabularyIds: url.searchParams.get("vocabulary_ids") });
    await fulfill(route, options.onQuestions ? await options.onQuestions({ call: calls.questions.length, runId }) : success(questionPayload(runId, { ...options, questions })));
  });
  await page.route("**/api/quiz/answers", async (route) => {
    const body = route.request().postDataJSON(); calls.answers.push(body);
    const response = options.onAnswer ? await options.onAnswer({ body, call: calls.answers.length }) : success(answerResult(body));
    await fulfill(route, bindAnswerToSession(response, body, sessions));
  });
  return calls;
}
export { publicAdmin, publicUser };
export function questionPayload(runId, options = {}) { return { id: options.setId ?? quizSetId, name: options.setName ?? "Quiz browser review", quiz_type: "MULTIPLE_CHOICE", run_id: runId, questions: options.questions ?? [question("word-wake", 1, "wake", "thức dậy"), question("word-sleep", 2, "sleep", "ngủ")] }; }
export function question(vocabularyId, position, word, correctLabel, overrides = {}) { const labels = [correctLabel, "ăn", "đi bộ", "chạy"]; const normalizedId = /^[0-9a-f-]{36}$/i.test(vocabularyId) ? vocabularyId : `30000000-0000-4000-8000-${String(position).padStart(12, "0")}`; return { vocabulary_id: normalizedId, position, question_revision: String(position).repeat(43), prompt: { word, part_of_speech: overrides.part_of_speech ?? "verb" }, choices: labels.map((label, index) => ({ choice_id: ids[index], label })), progress: { status: "NEW", review_count: 0, revision: 0, last_reviewed_at: null } }; }
export function answerResult(body, overrides = {}) { const correctChoiceId = overrides.correct_choice_id ?? ids[0]; const isCorrect = overrides.is_correct ?? body.selected_choice_id === correctChoiceId; return { set_id: body.set_id, vocabulary_id: body.vocabulary_id, run_id: body.run_id, quiz_type: "MULTIPLE_CHOICE", is_correct: isCorrect, selected_choice_id: body.selected_choice_id, correct_choice_id: correctChoiceId, progress: { status: isCorrect ? "LEARNED" : "LEARNING", review_count: 1, revision: body.expected_revision + 1, last_reviewed_at: "2026-10-15T00:00:00.000Z" }, reward: { source_event_id: body.event_id, xp_earned: isCorrect ? 3 : 0, replayed: false, total_xp: isCorrect ? 3 : 0, level: 1, level_min_xp: 0, next_level_xp: 50, is_max_level: false } }; }
export const success = (data) => ({ status: 200, json: { success: true, data } });
export const failure = (status, code) => ({ status, json: { success: false, error: { code, message: "Không thể xử lý Quiz." } } });
async function fulfill(route, response) { if (response?.abort) return route.abort(response.abort); return route.fulfill(response); }

function sessionProjection(id, setId, vocabularyIds) {
  return {
    id,
    set_id: setId,
    mode: "QUIZ",
    state: "ACTIVE",
    created_at: "2026-10-15T00:00:00.000Z",
    expires_at: "2026-10-22T00:00:00.000Z",
    completed_at: null,
    snapshot_size: vocabularyIds.length,
    completed_items: 0,
    items: vocabularyIds.map((vocabulary_id, position) => ({ vocabulary_id, position, evidence: null })),
  };
}

function bindAnswerToSession(response, body, sessions) {
  if (response?.status !== 200 || !response.json?.data || !body.session_id) return response;
  const session = sessions.get(body.session_id);
  if (!session) return response;
  const result = response.json.data;
  const evidence = result.is_correct ? "QUIZ_CORRECT" : "QUIZ_INCORRECT";
  const items = session.items.map((item) => item.vocabulary_id === body.vocabulary_id
    ? { ...item, evidence }
    : item);
  const completedItems = items.filter(({ evidence: value }) => value !== null).length;
  const completed = completedItems === session.snapshot_size;
  const next = {
    ...session,
    items,
    completed_items: completedItems,
    ...(completed ? { state: "COMPLETED", completed_at: "2026-10-15T00:01:00.000Z" } : {}),
  };
  sessions.set(next.id, next);
  response.json.data = {
    ...result,
    session: next,
    ...(completed ? { streak: { current_streak: 1, completed_today: true, last_qualified_date: "2026-10-15", timezone: "Asia/Ho_Chi_Minh", evaluated_at: "2026-10-15T00:01:00.000Z" } } : {}),
  };
  return response;
}
