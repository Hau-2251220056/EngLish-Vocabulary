import { installAuthApiMock, publicAdmin, publicUser, responses } from "./auth-api.js";

export const ids = ["A", "B", "C", "D"].map((letter) => letter.repeat(43));
export async function installQuizApiMock(page, options = {}) {
  const calls = { answers: [], learningEvents: [], questions: [] };
  await installAuthApiMock(page, { "/api/auth/me": options.guest ? responses.guest() : responses.currentUser(options.user ?? publicUser) });
  await page.route("**/api/learning/events", async (route) => { calls.learningEvents.push(route.request().postDataJSON()); await route.fulfill({ status: 500, json: { success: false } }); });
  await page.route("**/api/quiz/sets/*/questions**", async (route) => {
    const url = new URL(route.request().url()); const runId = url.searchParams.get("run_id");
    calls.questions.push({ quizType: url.searchParams.get("type"), runId });
    await fulfill(route, options.onQuestions ? await options.onQuestions({ call: calls.questions.length, runId }) : success(questionPayload(runId, options)));
  });
  await page.route("**/api/quiz/answers", async (route) => {
    const body = route.request().postDataJSON(); calls.answers.push(body);
    await fulfill(route, options.onAnswer ? await options.onAnswer({ body, call: calls.answers.length }) : success(answerResult(body)));
  });
  return calls;
}
export { publicAdmin, publicUser };
export function questionPayload(runId, options = {}) { return { id: options.setId ?? "set-flow", name: options.setName ?? "Quiz browser review", quiz_type: "MULTIPLE_CHOICE", run_id: runId, questions: options.questions ?? [question("word-wake", 1, "wake", "thức dậy"), question("word-sleep", 2, "sleep", "ngủ")] }; }
export function question(vocabularyId, position, word, correctLabel, overrides = {}) { const labels = [correctLabel, "ăn", "đi bộ", "chạy"]; return { vocabulary_id: vocabularyId, position, question_revision: String(position).repeat(43), prompt: { word, part_of_speech: overrides.part_of_speech ?? "verb" }, choices: labels.map((label, index) => ({ choice_id: ids[index], label })), progress: { status: "NEW", review_count: 0, revision: 0, last_reviewed_at: null } }; }
export function answerResult(body, overrides = {}) { const correctChoiceId = overrides.correct_choice_id ?? ids[0]; return { set_id: body.set_id, vocabulary_id: body.vocabulary_id, run_id: body.run_id, quiz_type: "MULTIPLE_CHOICE", is_correct: overrides.is_correct ?? body.selected_choice_id === correctChoiceId, selected_choice_id: body.selected_choice_id, correct_choice_id: correctChoiceId, progress: { status: body.selected_choice_id === correctChoiceId ? "LEARNED" : "LEARNING", review_count: 1, revision: body.expected_revision + 1, last_reviewed_at: "2026-10-15T00:00:00.000Z" } }; }
export const success = (data) => ({ status: 200, json: { success: true, data } });
export const failure = (status, code) => ({ status, json: { success: false, error: { code, message: "Không thể xử lý Quiz." } } });
async function fulfill(route, response) { if (response?.abort) return route.abort(response.abort); return route.fulfill(response); }
