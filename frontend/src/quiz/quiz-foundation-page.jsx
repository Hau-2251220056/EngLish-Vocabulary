import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, CircleX, LoaderCircle, RefreshCw, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuthentication } from "../auth/use-authentication.js";
import { quizService } from "../services/quiz-service.js";
import { classifyQuizLoadError, classifyQuizSubmissionError, createSharedQuizQuestionLoader } from "./quiz-presentation.js";
import { resolveQuizSetDetailPath } from "./quiz-navigation.js";
import { acceptQuizAnswer, beginQuizAnswer, createQuizRunState, failQuizAnswer, loadQuizRunState, reconcileQuizRunState, restartQuizRun, saveQuizRunState, summarizeQuizRun } from "./quiz-run-state.js";

const TYPE = "MULTIPLE_CHOICE";
const loadQuestions = createSharedQuizQuestionLoader((setId, runId) => quizService.getQuestions(setId, runId));
const FOCUS = "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-[#4CA2E6]/35";
const PRIMARY = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-[#4CA2E6] px-4 py-3 font-extrabold text-white transition hover:not-disabled:bg-[#358bcf] focus-visible:outline-[#4CA2E6]/35 disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none ${FOCUS}`;
const TEXT = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 border-0 bg-transparent font-bold text-[#40547d] hover:text-[#287fbe] disabled:cursor-not-allowed disabled:opacity-55 ${FOCUS}`;
const PAGE = "mx-auto min-h-full w-full max-w-[720px] overflow-x-clip px-4 pb-10 pt-6 text-[#172033] max-sm:px-3 max-sm:pb-8 max-sm:pt-4";

export function QuizFoundationPage() {
  const { setId } = useParams();
  const { user } = useAuthentication();
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = resolveQuizSetDetailPath(setId, location.state);
  const setName = location.state?.setName ?? "Bộ từ đã chọn";
  const onBack = () => navigate(returnTo, { replace: true });
  if (!user?.id || !setId) return <LoadState state="error" onBack={onBack} setName={setName} />;
  return <ActiveQuiz key={`${user.id}:${setId}`} onBack={onBack} setId={setId} setName={setName} userId={user.id} />;
}

function ActiveQuiz({ onBack, setId, setName, userId }) {
  const [run, setRun] = useState(() => loadQuizRunState(window.sessionStorage, userId, setId, TYPE) ?? createQuizRunState(userId, setId, TYPE));
  const [payload, setPayload] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  const [loadToken, setLoadToken] = useState(0);
  const [selectedChoiceId, setSelectedChoiceId] = useState(run.pending_attempt?.selected_choice_id ?? "");
  const [result, setResult] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [showCompletion, setShowCompletion] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState(null);
  const questionRef = useRef(null), resultRef = useRef(null), completionRef = useRef(null);
  const keyboardSubmitRef = useRef(true);
  const completedLoadKeyRef = useRef(null);
  const requestFocus = useCallback((kind) => setFocusRequest({ kind, key: crypto.randomUUID() }), []);

  useEffect(() => {
    if (!focusRequest) return;
    (focusRequest.kind === "result" ? resultRef : focusRequest.kind === "completion" ? completionRef : questionRef).current?.focus();
  }, [focusRequest]);

  useEffect(() => {
    const key = `${run.user_id}:${run.set_id}:${run.run_id}:${loadToken}`;
    if (completedLoadKeyRef.current === key) return undefined;
    let active = true;
    loadQuestions(key, run.set_id, run.run_id).then((data) => {
      if (!active) return;
      completedLoadKeyRef.current = key;
      const reconciled = reconcileQuizRunState(run, run.user_id, data);
      const completed = summarizeQuizRun(reconciled).completed;
      saveQuizRunState(window.sessionStorage, reconciled);
      setRun(reconciled); setPayload(data); setSelectedChoiceId(reconciled.pending_attempt?.selected_choice_id ?? "");
      setResult(null); setSubmitError(reconciled.pending_attempt ? { kind: "operational", code: "QUIZ_REQUEST_FAILED", conclusive: false } : null);
      setShowCompletion(completed); setLoadState("ready"); requestFocus(completed ? "completion" : "question");
    }, (error) => { if (active) { completedLoadKeyRef.current = key; setLoadState(classifyQuizLoadError(error)); } });
    return () => { active = false; };
  }, [loadToken, requestFocus, run]);

  const questions = useMemo(() => payload?.questions ?? [], [payload]);
  const summary = useMemo(() => summarizeQuizRun(run), [run]);
  const current = questions.find(({ vocabulary_id: id }) => id === run.current_vocabulary_id) ?? null;
  const shown = result ? questions.find(({ vocabulary_id: id }) => id === result.vocabulary_id) : current;
  const currentIndex = shown ? questions.findIndex(({ vocabulary_id: id }) => id === shown.vocabulary_id) : Math.max(0, summary.answered - 1);
  const pending = run.request_state === "submitting";
  const save = (next) => { setRun(next); saveQuizRunState(window.sessionStorage, next); };

  function restart() {
    const next = restartQuizRun(run); save(next); setSelectedChoiceId(""); setResult(null); setSubmitError(null);
    setShowCompletion(false); setRestartOpen(false); setLoadState("loading"); setLoadToken((value) => value + 1);
  }
  function requestRestart() {
    if (summary.answered || selectedChoiceId || run.pending_attempt) setRestartOpen(true); else restart();
  }
  function submit(event) {
    event.preventDefault();
    if (pending || result || !selectedChoiceId || !current) return;
    const next = beginQuizAnswer(run, current.vocabulary_id, selectedChoiceId);
    if (next === run || !next.pending_attempt) return;
    const focusResult = keyboardSubmitRef.current;
    keyboardSubmitRef.current = true; setSubmitError(null); save(next); void send(next, next.pending_attempt, focusResult);
  }
  function retry() {
    if (!run.pending_attempt || pending) return;
    const next = { ...run, request_state: "submitting", error_code: null };
    save(next); setSubmitError(null); void send(next, next.pending_attempt, true);
  }
  async function send(activeRun, attempt, focusResult) {
    try {
      const response = await quizService.submitAnswer(attempt);
      save(acceptQuizAnswer(activeRun, response)); setResult(response); if (focusResult) requestFocus("result");
    } catch (error) {
      const failure = classifyQuizSubmissionError(error);
      save(failQuizAnswer(activeRun, failure.code, { conclusive: failure.conclusive }));
      if (failure.kind === "not-found") setLoadState("not-found"); else setSubmitError(failure);
    }
  }
  function nextQuestion() {
    setResult(null); setSelectedChoiceId(""); setSubmitError(null);
    if (summary.completed) { setShowCompletion(true); requestFocus("completion"); } else requestFocus("question");
  }
  function refresh() { setSubmitError(null); setSelectedChoiceId(""); setLoadState("loading"); setLoadToken((value) => value + 1); }

  if (loadState !== "ready") return <LoadState state={loadState} onBack={onBack} onRetry={refresh} setName={setName} />;
  if (showCompletion && summary.completed) return <Completion headingRef={completionRef} onBack={onBack} onRestart={restart} setName={payload.name} summary={summary} />;

  return <main className={PAGE} aria-labelledby="quiz-title">
    <TopBar onBack={onBack} onRestart={requestRestart} setName={payload.name} />
    <header className="flex items-end justify-between gap-4 max-sm:flex-col max-sm:items-start"><div><p className="mb-1 text-xs font-extrabold uppercase tracking-widest text-[#4CA2E6]">Quiz · Trắc nghiệm</p><h1 className="m-0 text-[clamp(1.55rem,4vw,2.15rem)] [overflow-wrap:anywhere]" id="quiz-title">{payload.name}</h1></div><span className="shrink-0 rounded-full border border-[#b9dcf6] bg-[#eff8ff] px-3 py-1.5 text-xs font-extrabold text-[#287fbe]">Anh → Việt</span></header>
    <Progress accepted={summary.answered} current={Math.min(currentIndex + 1, summary.total)} total={summary.total} />
    <article className="mx-auto min-w-0 max-w-[680px] rounded-[22px] border border-[#e1e6ef] bg-white p-[clamp(1rem,2vw,1.375rem)] shadow-[0_14px_36px_rgba(32,52,96,0.08)] max-sm:rounded-[17px]" aria-busy={pending} data-testid="quiz-panel">
      <header className="border-b border-[#e8ecf3] pb-4 text-center"><p className="mb-1 text-xs font-extrabold uppercase tracking-widest text-[#4CA2E6]">Chọn nghĩa tiếng Việt</p><h2 className="m-0 text-[clamp(1.7rem,5vw,2.5rem)] leading-tight outline-none [overflow-wrap:anywhere]" ref={questionRef} tabIndex="-1">{shown.prompt.word}</h2>{shown.prompt.part_of_speech ? <span className="mt-2 inline-block rounded-full bg-[#f1f4fa] px-2.5 py-1 text-xs font-bold text-[#526078]">{shown.prompt.part_of_speech}</span> : null}</header>
      {!result ? <ChoiceForm choices={current.choices} error={submitError} locked={Boolean(run.pending_attempt || submitError?.conclusive)} onChange={setSelectedChoiceId} onPointerSubmit={() => { keyboardSubmitRef.current = false; }} onRetry={retry} onSubmit={submit} pending={pending} selected={selectedChoiceId} />
        : <Feedback choices={shown.choices} headingRef={resultRef} result={result} />}
      {submitError ? <SubmissionError error={submitError} onRefresh={refresh} /> : null}
    </article>
    {result ? <div className="mx-auto mt-3 flex max-w-[680px] justify-end"><button className={`${PRIMARY} max-sm:w-full`} onClick={nextQuestion} type="button">{summary.completed ? "Xem kết quả" : "Câu tiếp theo"}<ArrowRight aria-hidden="true" /></button></div> : null}
    {restartOpen ? <RestartDialog onCancel={() => setRestartOpen(false)} onConfirm={restart} /> : null}
  </main>;
}

function ChoiceForm({ choices, error, locked, onChange, onPointerSubmit, onRetry, onSubmit, pending, selected }) {
  return <form className="mt-4" onSubmit={onSubmit}><fieldset className="m-0 min-w-0 border-0 p-0" disabled={locked || pending}><legend className="sr-only">Chọn một nghĩa tiếng Việt</legend><div className="flex min-w-0 flex-col gap-2.5" data-testid="quiz-choice-list">{choices.map((choice, index) => {
    const checked = selected === choice.choice_id;
    return <label className={`group relative grid min-h-12 cursor-pointer grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#4CA2E6]/35 motion-reduce:transition-none ${checked ? "border-[#4CA2E6] bg-[#eff8ff]" : "border-[#d7dfec] bg-white hover:border-[#70b6eb] hover:bg-[#f7fbff]"} has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60`} key={choice.choice_id}><input checked={checked} className="absolute inset-0 z-10 m-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed" name="quiz-choice" onChange={() => onChange(choice.choice_id)} type="radio" value={choice.choice_id} /><span className={`grid size-7 place-items-center rounded-full border text-xs font-extrabold ${checked ? "border-[#4CA2E6] bg-[#4CA2E6] text-white" : "border-[#c5cfdf] text-[#526078]"}`} aria-hidden="true">{String.fromCharCode(65 + index)}</span><span className="min-w-0 font-bold leading-5 text-[#172033] [overflow-wrap:anywhere]">{choice.label}</span></label>;
  })}</div></fieldset><button aria-busy={pending} className={`${PRIMARY} ml-auto mt-4 min-w-48 max-sm:w-full`} disabled={pending || (!error && (!selected || locked))} onClick={error && !error.conclusive ? onRetry : undefined} onPointerDown={onPointerSubmit} type={error && !error.conclusive ? "button" : "submit"}>{pending ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}{pending ? "Đang kiểm tra…" : error && !error.conclusive ? "Thử gửi lại" : "Kiểm tra đáp án"}</button></form>;
}

function Feedback({ choices, headingRef, result }) {
  const correct = result.is_correct;
  return <section className="mt-4" aria-labelledby="quiz-result-title" data-testid="quiz-feedback"><p aria-live="polite" className="sr-only" role="status">{correct ? "Chính xác." : "Chưa chính xác. Đáp án đúng đã được đánh dấu."}</p><div className="flex items-center gap-2 font-extrabold text-[#344054]">{correct ? <CheckCircle2 className="size-5" aria-hidden="true" /> : <CircleX className="size-5" aria-hidden="true" />}<h2 className="m-0 text-base outline-none" id="quiz-result-title" ref={headingRef} tabIndex="-1">{correct ? "Chính xác" : "Chưa chính xác"}</h2></div><ul className="mt-3 flex list-none flex-col gap-2.5 p-0" data-testid="quiz-feedback-list">{choices.map((choice, index) => {
    const isCorrect = choice.choice_id === result.correct_choice_id;
    const isSelected = choice.choice_id === result.selected_choice_id;
    const state = isCorrect ? "correct" : isSelected ? "incorrect-selected" : "neutral";
    return <li aria-label={`${choice.label}. ${isCorrect ? "Đáp án đúng" : isSelected ? "Bạn đã chọn, chưa chính xác" : "Không được chọn"}`} className={`grid min-h-12 grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-2.5 rounded-xl border px-3 py-2.5 ${isCorrect ? "border-green-500 bg-green-50" : isSelected ? "border-red-500 bg-red-50" : "border-[#d7dfec] bg-white"}`} data-answer-state={state} key={choice.choice_id}><span className={`grid size-7 place-items-center rounded-full border text-xs font-extrabold ${isCorrect ? "border-green-600 text-green-700" : isSelected ? "border-red-600 text-red-700" : "border-[#c5cfdf] text-[#526078]"}`} aria-hidden="true">{String.fromCharCode(65 + index)}</span><strong className="min-w-0 leading-5 [overflow-wrap:anywhere]">{choice.label}</strong></li>;
  })}</ul></section>;
}

function Progress({ accepted, current, total }) { return <section className="my-5" aria-label="Tiến độ Quiz"><div className="mb-2 flex flex-wrap justify-between gap-2 text-sm text-[#667085]"><strong className="text-[#287fbe]">Câu {current} / {total}</strong><span>{accepted} câu đã hoàn thành</span></div><div aria-label={`${accepted} trên ${total} câu đã hoàn thành`} aria-valuemax={total} aria-valuemin="0" aria-valuenow={accepted} className="h-2 overflow-hidden rounded-full bg-[#e8edf6]" role="progressbar"><span className="block h-full rounded-full bg-[#4CA2E6] transition-[width] motion-reduce:transition-none" style={{ width: `${total ? accepted / total * 100 : 0}%` }} /></div></section>; }
function TopBar({ onBack, onRestart, setName }) { return <div className="mb-5 flex min-h-11 items-center justify-between gap-3"><button aria-label={`Quay lại chi tiết bộ từ ${setName}`} className={`${TEXT} min-w-0 max-w-[70%] [&_span]:truncate`} onClick={onBack} title={setName} type="button"><ArrowLeft aria-hidden="true" /><span>{setName}</span></button>{onRestart ? <button className={`${TEXT} shrink-0 text-[#287fbe]`} onClick={onRestart} type="button"><RotateCcw aria-hidden="true" />Bắt đầu lại</button> : null}</div>; }

function SubmissionError({ error, onRefresh }) { const conflict = error.kind === "question-changed" || error.kind === "progress-conflict"; return <div className="mt-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800" role="alert"><CircleAlert aria-hidden="true" /><div><p className="m-0">{conflict ? "Nội dung câu hỏi hoặc tiến độ đã thay đổi. Hãy làm mới Quiz để tiếp tục." : "Chưa thể xác nhận câu trả lời. Bạn có thể thử gửi lại an toàn."}</p>{error.conclusive ? <button className={`${TEXT} mt-1 text-red-800 underline`} onClick={onRefresh} type="button">Làm mới Quiz</button> : null}</div></div>; }
function LoadState({ state, onBack, onRetry, setName }) {
  const loading = state === "loading";
  const copy = state === "empty" ? ["Bộ từ chưa sẵn sàng", "Bộ từ này chưa có từ vựng để làm Quiz."] : state === "choices-unavailable" ? ["Chưa đủ lựa chọn", "Hiện chưa thể tạo bốn đáp án tiếng Việt khác nhau cho bộ từ này."] : state === "not-found" ? ["Không thể mở Quiz", "Bộ từ có thể không còn khả dụng."] : ["Không thể tải Quiz", "Vui lòng thử lại."];
  return <main className={PAGE}><TopBar onBack={onBack} setName={setName} />{loading ? <div className="py-14 text-center text-[#526078]" role="status"><h1>Đang chuẩn bị Quiz…</h1><div className="mx-auto mt-5 grid max-w-lg gap-3" aria-hidden="true"><span className="h-6 animate-pulse rounded bg-[#e8edf6] motion-reduce:animate-none" /><span className="h-40 animate-pulse rounded-2xl bg-[#e8edf6] motion-reduce:animate-none" /></div></div> : <section className="mx-auto grid max-w-lg justify-items-center gap-3 rounded-2xl border border-[#e1e6ef] bg-white p-6 text-center shadow-sm" role={state === "error" ? "alert" : undefined}><CircleAlert className="text-red-600" aria-hidden="true" /><h1 className="m-0 text-2xl">{copy[0]}</h1><p className="m-0 text-[#667085]">{copy[1]}</p><div className="flex flex-wrap justify-center gap-3 max-sm:w-full max-sm:flex-col">{["error", "choices-unavailable"].includes(state) && onRetry ? <button className={PRIMARY} onClick={onRetry} type="button"><RefreshCw aria-hidden="true" />Thử lại</button> : null}<button className={TEXT} onClick={onBack} type="button">Quay lại</button></div></section>}</main>;
}
function Completion({ headingRef, onBack, onRestart, setName, summary }) { return <main className={PAGE}><TopBar onBack={onBack} onRestart={onRestart} setName={setName} /><section className="rounded-[22px] border border-[#e1e6ef] bg-white p-[clamp(1.5rem,5vw,3rem)] text-center shadow-sm"><CheckCircle2 className="mx-auto size-14 text-green-600" aria-hidden="true" /><p className="mb-1 mt-4 text-xs font-extrabold uppercase tracking-widest text-[#4CA2E6]">Trắc nghiệm · {setName}</p><h1 className="m-0 outline-none" ref={headingRef} tabIndex="-1">Hoàn thành Quiz</h1><p className="text-[#667085]">Bạn đã hoàn thành toàn bộ câu hỏi trong lượt này.</p><dl className="mt-6 grid grid-cols-3 gap-3 max-sm:grid-cols-1">{[["Tổng số câu", summary.total], ["Chính xác", summary.correct], ["Chưa chính xác", summary.incorrect]].map(([label, value]) => <div className="rounded-xl bg-[#f3f6fb] p-4 max-sm:flex max-sm:justify-between" key={label}><dt className="text-sm text-[#667085]">{label}</dt><dd className="m-0 text-2xl font-extrabold">{value}</dd></div>)}</dl><button className={`${TEXT} mt-5`} onClick={onBack} type="button">Quay lại bộ từ</button></section></main>; }
function RestartDialog({ onCancel, onConfirm }) { const ref = useRef(null); useEffect(() => { const dialog = ref.current; const returnFocus = document.activeElement; dialog?.showModal(); return () => { dialog?.close(); if (returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus(); }; }, []); return <dialog aria-labelledby="quiz-restart-title" className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[min(calc(100%-2rem),440px)] rounded-2xl border-0 p-0 shadow-2xl backdrop:bg-slate-900/50" onCancel={onCancel} ref={ref}><div className="p-6"><h2 id="quiz-restart-title">Bắt đầu lại Quiz?</h2><p className="text-[#667085]">Kết quả tạm thời của lượt này sẽ được xóa. Tiến độ học đã lưu không bị đặt lại.</p><div className="mt-5 flex justify-end gap-3 max-sm:flex-col-reverse"><button autoFocus className={TEXT} onClick={onCancel} type="button">Hủy</button><button className={PRIMARY} onClick={onConfirm} type="button">Bắt đầu lại</button></div></div></dialog>; }
