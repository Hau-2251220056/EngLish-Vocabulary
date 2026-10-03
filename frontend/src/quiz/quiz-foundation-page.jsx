import { ArrowLeft, ArrowRight, Check, CheckCircle2, CircleAlert, CircleX, Languages, LoaderCircle, PenLine, RefreshCw, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuthentication } from "../auth/use-authentication.js";
import { quizService } from "../services/quiz-service.js";
import { availableUnscrambleTiles, buildUnscrambleAnswer, classifyQuizLoadError, classifyQuizSubmissionError, createSharedQuizQuestionLoader, isUnscrambleAnswerComplete, presentCharacterFeedback, quizAnswerHasContent, removeUnscrambleTile, selectUnscrambleTile, unscrambleAnswerSlots } from "./quiz-presentation.js";
import { resolveQuizSetDetailPath } from "./quiz-navigation.js";
import { acceptQuizAnswer, beginQuizAnswer, createQuizRunState, failQuizAnswer, loadQuizRunState, reconcileQuizRunState, restartQuizRun, saveQuizRunState, summarizeQuizRun } from "./quiz-run-state.js";

const TYPES = {
  VI_TO_ENGLISH: { label: "Tiếng Việt → Tiếng Anh", description: "Nhập từ tiếng Anh phù hợp với nghĩa tiếng Việt." },
  UNSCRAMBLE_WORD: { label: "Sắp xếp từ tiếng Anh", description: "Sắp xếp các ký tự để tạo thành từ tiếng Anh." },
};
const loadQuizQuestions = createSharedQuizQuestionLoader(
  (setId, quizType, runId) => quizService.getQuestions(setId, quizType, runId),
);
const PAGE_CLASSES = "quiz-page mx-auto h-full w-full max-w-[860px] overflow-y-auto px-4 pb-10 pt-6 text-[#172033] max-sm:px-3 max-sm:pb-8 max-sm:pt-4 [&_svg]:size-[1.15rem] [&_svg]:shrink-0";
const FOCUS_CLASSES = "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-[#4CA2E6]/35";
const TEXT_BUTTON_CLASSES = `quiz-text-button inline-flex min-h-11 cursor-pointer items-center gap-[0.45rem] border-0 bg-transparent font-[inherit] text-[0.88rem] font-[750] text-[#40547d] no-underline hover:text-[#358bcf] ${FOCUS_CLASSES}`;
const PRIMARY_BUTTON_CLASSES = `quiz-primary-button inline-flex min-h-[46px] cursor-pointer items-center justify-center gap-[0.45rem] rounded-[11px] border-0 bg-[#4CA2E6] px-4 py-[0.7rem] font-[inherit] font-extrabold text-white no-underline transition-[background-color,transform] duration-150 hover:not-disabled:-translate-y-px hover:not-disabled:bg-[#358bcf] focus-visible:outline-[#4CA2E6]/35 disabled:cursor-not-allowed disabled:opacity-[0.58] motion-reduce:transform-none motion-reduce:transition-none motion-reduce:duration-0 ${FOCUS_CLASSES}`;
const CARD_CLASSES = "border border-[#e1e6ef] bg-white shadow-[0_14px_36px_rgba(32,52,96,0.08)]";
const TILE_CLASSES = `inline-grid size-[46px] min-h-11 min-w-11 cursor-pointer place-items-center rounded-[10px] border border-[#cbd6ed] bg-white px-[0.35rem] font-[inherit] font-[850] leading-none text-[#172033] transition-[border-color,background-color,color,transform] duration-150 hover:not-disabled:-translate-y-px hover:not-disabled:border-[#70b6eb] hover:not-disabled:bg-[#eff8ff] hover:not-disabled:text-[#287fbe] motion-reduce:transform-none motion-reduce:transition-none motion-reduce:duration-0 max-sm:size-11 ${FOCUS_CLASSES}`;

export function QuizFoundationPage() {
  const { setId } = useParams();
  const { user } = useAuthentication();
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const type = params.get("type");
  const returnTo = resolveQuizSetDetailPath(setId, location.state);
  const setName = location.state?.setName ?? "Bộ từ đã chọn";
  function navigateBack() {
    navigate(returnTo, { replace: true });
  }
  if (!user?.id || !setId || !Object.hasOwn(TYPES, type)) {
    return <TypeSelection onBack={navigateBack} onStart={(selected) => setParams({ type: selected }, { state: location.state })} setName={setName} />;
  }
  return <ActiveQuiz key={`${user.id}:${setId}:${type}`} onBack={navigateBack} quizType={type} setId={setId} setName={setName} userId={user.id} />;
}

function TypeSelection({ onBack, onStart, setName }) {
  const [selected, setSelected] = useState("");
  return <section className={`${PAGE_CLASSES} quiz-selection`} aria-labelledby="quiz-selection-title">
    <QuizTopBar onBack={onBack} setName={setName} />
    <header className="my-6"><p className="quiz-eyebrow mb-[0.35rem] text-[0.72rem] font-[850] uppercase tracking-[0.1em] text-[#4CA2E6]">Quiz · {setName}</p><h1 className="m-0 text-[clamp(1.65rem,4vw,2.15rem)] leading-[1.15] text-[#101828] [overflow-wrap:anywhere]" id="quiz-selection-title">Chọn loại Quiz</h1><p className="mb-0 mt-[0.65rem] leading-[1.6] text-[#667085]">Chọn một hình thức và hoàn thành toàn bộ từ vựng theo thứ tự của bộ từ.</p></header>
    <fieldset className="quiz-type-options m-0 grid grid-cols-2 gap-4 border-0 p-0 max-sm:grid-cols-1"><legend className="sr-only">Loại Quiz</legend>{Object.entries(TYPES).map(([type, option]) => <label className={`quiz-type-option relative grid min-h-[126px] cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-[0.8rem] rounded-2xl border bg-white p-4 shadow-[0_8px_22px_rgba(32,52,96,0.05)] has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-[3px] has-[:focus-visible]:outline-[#4CA2E6]/30 max-sm:min-h-[108px] ${selected === type ? "is-selected border-[#70b6eb] bg-[#f2f9fe]" : "border-[#dce3ef] hover:border-[#70b6eb] hover:bg-[#f2f9fe]"}`} key={type}>
      <input className="absolute opacity-0" checked={selected === type} name="quiz-type" onChange={() => setSelected(type)} type="radio" value={type} />
      <span className="quiz-type-icon grid size-[46px] place-items-center rounded-[13px] bg-[#eff8ff] text-[#4CA2E6]" aria-hidden="true">{type === "VI_TO_ENGLISH" ? <Languages /> : <PenLine />}</span>
      <span><strong className="block text-[#172033]">{option.label}</strong><small className="mt-[0.3rem] block leading-[1.45] text-[#667085]">{option.description}</small></span><Check className={`quiz-type-check text-[#4CA2E6] ${selected === type ? "visible" : "invisible"}`} aria-hidden="true" />
    </label>)}</fieldset>
    <button className={`${PRIMARY_BUTTON_CLASSES} quiz-start-button ml-auto mt-5 min-w-[190px] max-sm:ml-0 max-sm:w-full`} disabled={!selected} onClick={() => onStart(selected)} type="button">Bắt đầu Quiz <ArrowRight aria-hidden="true" /></button>
  </section>;
}

function ActiveQuiz({ onBack, quizType, setId, setName, userId }) {
  const [run, setRun] = useState(() => loadQuizRunState(window.sessionStorage, userId, setId, quizType) ?? createQuizRunState(userId, setId, quizType));
  const [payload, setPayload] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  const [loadToken, setLoadToken] = useState(0);
  const [answer, setAnswer] = useState("");
  const [selectedTileIds, setSelectedTileIds] = useState([]);
  const [validationError, setValidationError] = useState(null);
  const [result, setResult] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [showCompletion, setShowCompletion] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState(null);
  const questionRef = useRef(null), resultRef = useRef(null), completionRef = useRef(null);
  const submissionModalityRef = useRef("keyboard");
  const completedLoadKeyRef = useRef(null);
  const requestFocus = useCallback((kind) => setFocusRequest({ kind, key: crypto.randomUUID() }), []);

  useEffect(() => {
    if (!focusRequest) return;
    (focusRequest.kind === "result" ? resultRef : focusRequest.kind === "completion" ? completionRef : questionRef).current?.focus();
  }, [focusRequest]);

  useEffect(() => {
    const loadKey = `${run.user_id}:${run.set_id}:${run.quiz_type}:${run.run_id}:${loadToken}`;
    if (completedLoadKeyRef.current === loadKey) return undefined;
    let active = true;
    loadQuizQuestions(loadKey, run.set_id, run.quiz_type, run.run_id).then((data) => {
      if (!active) return;
      completedLoadKeyRef.current = loadKey;
      const reconciled = reconcileQuizRunState(run, run.user_id, data);
      saveQuizRunState(window.sessionStorage, reconciled);
      const completed = summarizeQuizRun(reconciled).completed;
      setRun(reconciled); setPayload(data); setAnswer(reconciled.pending_attempt?.answer ?? ""); setResult(null); setSubmitError(reconciled.pending_attempt ? { kind: "operational", code: "QUIZ_REQUEST_FAILED", conclusive: false } : null); setShowCompletion(completed); setLoadState("ready"); requestFocus(completed ? "completion" : "question");
    }, (error) => { if (active) { completedLoadKeyRef.current = loadKey; setLoadState(classifyQuizLoadError(error)); } });
    return () => { active = false; };
  }, [loadToken, requestFocus, run]);

  const questions = useMemo(() => payload?.questions ?? [], [payload]);
  const summary = useMemo(() => summarizeQuizRun(run), [run]);
  const current = questions.find((question) => question.vocabulary_id === run.current_vocabulary_id) ?? null;
  const shown = result ? questions.find((question) => question.vocabulary_id === result.vocabulary_id) : current;
  const currentIndex = shown ? questions.findIndex((question) => question.vocabulary_id === shown.vocabulary_id) : Math.max(0, summary.answered - 1);
  const pending = run.request_state === "submitting";
  function notePointerSubmission() { submissionModalityRef.current = "pointer"; }
  function noteKeyboardSubmission(event) {
    if (event.key === "Enter" || event.key === " ") submissionModalityRef.current = "keyboard";
  }
  function consumeSubmissionModality() {
    const modality = submissionModalityRef.current;
    submissionModalityRef.current = "keyboard";
    return modality;
  }
  function save(next) { setRun(next); saveQuizRunState(window.sessionStorage, next); }
  function restart() { const next = restartQuizRun(run); save(next); setAnswer(""); setSelectedTileIds([]); setResult(null); setSubmitError(null); setShowCompletion(false); setRestartOpen(false); setLoadState("loading"); setLoadToken((value) => value + 1); }
  function requestRestart() { if (summary.answered || quizAnswerHasContent(answer) || selectedTileIds.length || run.pending_attempt) setRestartOpen(true); else restart(); }
  function submit(event) {
    event.preventDefault();
    if (pending || result) return;
    const submittedAnswer = quizType === "UNSCRAMBLE_WORD"
      ? buildUnscrambleAnswer(current.prompt, selectedTileIds)
      : answer;
    const valid = quizType === "UNSCRAMBLE_WORD"
      ? isUnscrambleAnswerComplete(current.prompt, selectedTileIds)
      : quizAnswerHasContent(submittedAnswer);
    if (!valid) { setValidationError(quizType === "UNSCRAMBLE_WORD" ? "Vui lòng sắp xếp đầy đủ các ký tự." : "Vui lòng nhập câu trả lời bằng tiếng Anh."); return; }
    setAnswer(submittedAnswer);
    const next = beginQuizAnswer(run, current.vocabulary_id, submittedAnswer);
    if (next === run || !next.pending_attempt) return;
    const focusResult = consumeSubmissionModality() === "keyboard";
    setValidationError(null); setSubmitError(null); save(next); void send(next, next.pending_attempt, focusResult);
  }
  function retrySubmission() {
    if (!run.pending_attempt || pending) return;
    const next = { ...run, request_state: "submitting", error_code: null };
    const focusResult = consumeSubmissionModality() === "keyboard";
    save(next); setSubmitError(null); void send(next, next.pending_attempt, focusResult);
  }
  async function send(activeRun, attempt, focusResult) {
    try { const response = await quizService.submitAnswer(attempt); const next = acceptQuizAnswer(activeRun, response); save(next); setResult(response); if (focusResult) requestFocus("result"); }
    catch (error) {
      const failure = classifyQuizSubmissionError(error);
      const next = failQuizAnswer(activeRun, failure.code, { conclusive: failure.conclusive }); save(next);
      if (failure.kind === "not-found") setLoadState("not-found"); else setSubmitError(failure);
    }
  }
  function nextQuestion() { setResult(null); setAnswer(""); setSelectedTileIds([]); setSubmitError(null); if (summary.completed) { setShowCompletion(true); requestFocus("completion"); } else requestFocus("question"); }
  function refreshConflict() { setSubmitError(null); setAnswer(""); setSelectedTileIds([]); setLoadState("loading"); setLoadToken((value) => value + 1); }

  if (loadState !== "ready") return <LoadState state={loadState} onBack={onBack} onRetry={() => { setLoadState("loading"); setLoadToken((value) => value + 1); }} setName={setName} />;
  if (showCompletion && summary.completed) return <Completion headingRef={completionRef} onBack={onBack} onRestart={restart} quizType={quizType} setName={payload.name} summary={summary} />;
  return <section className={PAGE_CLASSES} aria-labelledby="quiz-title">
    <QuizTopBar onBack={onBack} onRestart={requestRestart} setName={payload.name} />
    <header className="quiz-run-header flex items-end justify-between gap-4 max-sm:flex-col max-sm:items-start max-sm:gap-[0.55rem]"><div><p className="quiz-eyebrow mb-[0.35rem] text-[0.72rem] font-[850] uppercase tracking-[0.1em] text-[#4CA2E6]">Quiz</p><h1 className="m-0 text-[clamp(1.65rem,4vw,2.15rem)] leading-[1.15] text-[#101828] [overflow-wrap:anywhere]" id="quiz-title">{payload.name}</h1></div><span className="quiz-type-badge shrink-0 rounded-full border border-[#b9dcf6] bg-[#eff8ff] px-[0.7rem] py-[0.38rem] text-[0.76rem] font-extrabold text-[#287fbe]">{TYPES[quizType].label}</span></header>
    <Progress accepted={summary.answered} current={Math.min(currentIndex + 1, summary.total)} total={summary.total} />
    <article className={`quiz-question-card rounded-[22px] p-[clamp(1.25rem,4vw,2.25rem)] focus-within:ring-1 focus-within:ring-[#4CA2E6]/35 max-sm:rounded-[17px] ${CARD_CLASSES}`} aria-busy={pending}>
      <Prompt headingRef={questionRef} question={shown} quizType={quizType} />
      {!result ? quizType === "UNSCRAMBLE_WORD"
        ? <UnscrambleAnswerForm error={validationError} locked={Boolean(run.pending_attempt || submitError?.conclusive)} onChange={(value) => { setSelectedTileIds(value); setValidationError(null); }} onKeyboardSubmit={noteKeyboardSubmission} onPointerSubmit={notePointerSubmission} onRetry={retrySubmission} onSubmit={submit} pending={pending} prompt={current.prompt} retryable={Boolean(submitError && !submitError.conclusive)} selectedTileIds={selectedTileIds} />
        : <AnswerForm answer={answer} error={validationError} locked={Boolean(run.pending_attempt || submitError?.conclusive)} onChange={(value) => { setAnswer(value); setValidationError(null); }} onKeyboardSubmit={noteKeyboardSubmission} onPointerSubmit={notePointerSubmission} onRetry={retrySubmission} onSubmit={submit} pending={pending} retryable={Boolean(submitError && !submitError.conclusive)} />
        : <AcceptedFeedback headingRef={resultRef} result={result} />}
      {submitError ? <SubmissionError error={submitError} onRefresh={refreshConflict} /> : null}
    </article>
    {result ? <div className="quiz-next-action mt-4 flex justify-end"><button className={`${PRIMARY_BUTTON_CLASSES} max-sm:w-full`} onClick={nextQuestion} type="button">{summary.completed ? "Xem kết quả" : "Câu tiếp theo"}<ArrowRight aria-hidden="true" /></button></div> : null}
    {restartOpen ? <RestartDialog onCancel={() => setRestartOpen(false)} onConfirm={restart} /> : null}
  </section>;
}

function QuizTopBar({ onBack, onRestart, setName }) { return <div className="quiz-toolbar mb-[1.1rem] flex min-h-11 items-center justify-between gap-4 max-sm:items-start max-[700px]:gap-2"><button aria-label={`Quay lại chi tiết bộ từ ${setName}`} className={`quiz-back-link inline-flex min-h-11 min-w-0 max-w-[min(70%,36rem)] cursor-pointer items-center gap-[0.45rem] border-0 bg-transparent p-0 font-[inherit] text-[0.88rem] font-[750] text-[#40547d] no-underline hover:text-[#358bcf] max-[700px]:max-w-[62%] [&_span]:truncate ${FOCUS_CLASSES}`} onClick={onBack} title={setName} type="button"><ArrowLeft aria-hidden="true" /><span>{setName}</span></button>{onRestart ? <button className={`${TEXT_BUTTON_CLASSES} shrink-0 text-[#4CA2E6] hover:text-[#358bcf]`} onClick={onRestart} type="button"><RotateCcw aria-hidden="true" />Bắt đầu lại</button> : null}</div>; }
function Progress({ accepted, current, total }) { return <section className="quiz-progress mb-[1.1rem] mt-5" aria-label="Tiến độ Quiz"><div className="mb-2 flex justify-between gap-4 text-[0.82rem] text-[#667085]"><span className="font-extrabold text-[#287fbe]">Câu {current} / {total}</span><span>{accepted} câu đã hoàn thành</span></div><div aria-label={`${accepted} trên ${total} câu đã hoàn thành`} aria-valuemax={total} aria-valuemin="0" aria-valuenow={accepted} className="quiz-progress-track h-[0.55rem] overflow-hidden rounded-full bg-[#e8edf6]" role="progressbar"><span className="block h-full rounded-[inherit] bg-[#4CA2E6] transition-[width] duration-200 ease-in-out motion-reduce:transition-none motion-reduce:duration-0" style={{ width: `${total ? accepted / total * 100 : 0}%` }} /></div></section>; }
function Prompt({ headingRef, question, quizType }) { if (!question) return null; return <header className="quiz-question-prompt border-b border-[#e8ecf3] pb-6 text-center max-sm:pb-[1.1rem]"><p className="quiz-question-kicker mb-[0.35rem] text-[0.72rem] font-[850] uppercase tracking-[0.1em] text-[#4CA2E6]">{quizType === "VI_TO_ENGLISH" ? "NGHĨA TIẾNG VIỆT" : "SẮP XẾP TỪ TIẾNG ANH"}</p><h2 className="mx-auto mb-[0.8rem] mt-[0.4rem] max-w-[680px] text-[clamp(1.55rem,4.5vw,2.35rem)] leading-tight text-[#101828] outline-none [overflow-wrap:anywhere]" ref={headingRef} tabIndex="-1">{question.prompt.meaning_vi}</h2><div className="quiz-question-meta flex flex-wrap justify-center gap-[0.45rem] [&_span]:rounded-full [&_span]:bg-[#f1f4fa] [&_span]:px-[0.55rem] [&_span]:py-1 [&_span]:text-xs [&_span]:font-[750] [&_span]:text-[#526078]"><span>{question.prompt.part_of_speech}</span>{question.prompt.cefr_level ? <span>{question.prompt.cefr_level}</span> : null}</div>{question.prompt.context ? <p className="quiz-question-context mx-auto mb-0 mt-[0.85rem] max-w-[620px] rounded-xl bg-[#f8f9fc] px-4 py-3 leading-[1.55] text-[#526078]">{question.prompt.context}</p> : null}{quizType === "UNSCRAMBLE_WORD" ? <p className="quiz-question-instruction m-0 text-[#667085]">Chọn các ký tự theo đúng thứ tự.</p> : null}</header>; }
function UnscrambleAnswerForm({ error, locked, onChange, onKeyboardSubmit, onPointerSubmit, onRetry, onSubmit, pending, prompt, retryable, selectedTileIds }) {
  const poolRefs = useRef(new Map());
  const submitRef = useRef(null);
  const poolTiles = availableUnscrambleTiles(prompt, selectedTileIds);
  const answerSlots = unscrambleAnswerSlots(prompt, selectedTileIds);
  const complete = isUnscrambleAnswerComplete(prompt, selectedTileIds);
  function focusAfterRender(target) { window.requestAnimationFrame(() => target()?.focus()); }
  function chooseTile(tileId) {
    if (locked || pending) return;
    const currentIndex = poolTiles.findIndex((tile) => tile.tile_id === tileId);
    const nextPoolTile = poolTiles[currentIndex + 1] ?? poolTiles[currentIndex - 1];
    onChange(selectUnscrambleTile(prompt, selectedTileIds, tileId));
    focusAfterRender(() => nextPoolTile ? poolRefs.current.get(nextPoolTile.tile_id) : submitRef.current);
  }
  function removeTile(tileId) {
    if (locked || pending) return;
    onChange(removeUnscrambleTile(selectedTileIds, tileId));
    focusAfterRender(() => poolRefs.current.get(tileId));
  }
  return <form className="quiz-answer-form quiz-unscramble-form mt-[1.4rem] grid [&_.quiz-primary-button]:mt-4 [&_.quiz-primary-button]:min-w-[180px] [&_.quiz-primary-button]:justify-self-end max-sm:[&_.quiz-primary-button]:ml-0 max-sm:[&_.quiz-primary-button]:w-full" noValidate onKeyDown={onKeyboardSubmit} onSubmit={onSubmit}>
    <fieldset className="m-0 min-w-0 border-0 p-0" disabled={locked || pending}>
      <legend className="text-[0.88rem] font-extrabold text-[#273653]">Sắp xếp câu trả lời</legend>
      <p className="mb-[0.8rem] mt-1 text-[0.78rem] text-[#758097]" id="quiz-unscramble-help">Chọn từng ký tự để điền vào vị trí tiếp theo. Nhấn ký tự đã chọn để đưa về nhóm bên dưới.</p>
      <div aria-describedby={`quiz-unscramble-help${error ? " quiz-answer-error" : ""}`} aria-invalid={Boolean(error)} aria-label="Câu trả lời đã sắp xếp" className="quiz-unscramble-answer flex min-h-16 min-w-0 flex-wrap items-center justify-center gap-2 rounded-[13px] border border-[#dce3ef] bg-[#f8faff] p-[0.65rem] max-sm:gap-[0.4rem] max-sm:px-[0.45rem] max-sm:py-[0.6rem]" role="group">
        {answerSlots.map((slot, index) => slot.kind === "separator"
          ? <span aria-label={`Ký tự cố định ${slot.value}`} className="quiz-answer-slot is-separator inline-grid h-[46px] min-h-11 w-auto min-w-[18px] cursor-default place-items-center border-0 bg-transparent px-[0.35rem] font-[inherit] font-[850] leading-none text-[#526078] max-sm:h-11" key={`separator-${index}`}>{slot.value}</span>
          : slot.tile_id
            ? <button aria-label={`Bỏ ký tự ${slot.character} khỏi vị trí ${index + 1}`} className={`${TILE_CLASSES} quiz-answer-slot is-filled rounded-sm border-x-0 border-b-2 border-t-0 border-[#4CA2E6] bg-transparent text-[#287fbe]`} key={`tile-${index}-${slot.tile_id}`} onClick={() => removeTile(slot.tile_id)} type="button">{slot.character}</button>
            : <span aria-hidden="true" className="quiz-answer-slot is-empty inline-grid size-[46px] min-h-11 min-w-11 cursor-default place-items-center rounded-sm border-x-0 border-b-2 border-t-0 border-dashed border-[#cbd6ed] bg-transparent px-[0.35rem] max-sm:size-11" key={`empty-${index}`} />)}
      </div>
      <div aria-label="Các ký tự có thể chọn" className="quiz-unscramble-pool mt-3 flex min-h-[68px] min-w-0 flex-wrap items-center justify-center gap-2 rounded-[13px] bg-[#f3f6fb] p-[0.7rem] max-sm:gap-[0.4rem] max-sm:px-[0.45rem] max-sm:py-[0.6rem]" role="group">
        {poolTiles.map((tile, index) => <button aria-label={`Chọn ký tự ${tile.character}, vị trí ${index + 1} trong nhóm ký tự`} className={`${TILE_CLASSES} quiz-letter-tile`} key={tile.tile_id} onClick={() => chooseTile(tile.tile_id)} ref={(node) => { if (node) poolRefs.current.set(tile.tile_id, node); else poolRefs.current.delete(tile.tile_id); }} type="button">{tile.character}</button>)}
        {!poolTiles.length ? <span className="quiz-pool-empty text-[0.8rem] font-bold text-[#667085]">Đã chọn đủ ký tự</span> : null}
      </div>
    </fieldset>
    {prompt.shuffle_mode === "IDENTITY_FALLBACK" ? <p className="quiz-identity-note mb-0 mt-3 text-[0.78rem] leading-normal text-[#667085]">Các ký tự của từ này không thể đảo thành một thứ tự khác, hãy chọn lần lượt để xác nhận.</p> : null}
    {error ? <p className="quiz-field-error mb-0 mt-2 text-[0.8rem] font-bold text-[#b42338]" id="quiz-answer-error" role="alert">{error}</p> : null}
    <button aria-busy={pending} className={PRIMARY_BUTTON_CLASSES} disabled={pending || (!retryable && (!complete || locked))} onClick={retryable ? onRetry : undefined} onPointerDown={onPointerSubmit} ref={submitRef} type={retryable ? "button" : "submit"}>{pending ? <LoaderCircle className="quiz-spinner animate-spin motion-reduce:[animation-duration:1.5s]" aria-hidden="true" /> : null}{pending ? "Đang kiểm tra…" : retryable ? "Thử gửi lại" : "Kiểm tra đáp án"}</button>
  </form>;
}

function AnswerForm({ answer, error, locked, onChange, onKeyboardSubmit, onPointerSubmit, onRetry, onSubmit, pending, retryable }) { return <form className="quiz-answer-form mt-[1.4rem] grid [&_.quiz-primary-button]:mt-4 [&_.quiz-primary-button]:min-w-[180px] [&_.quiz-primary-button]:justify-self-end max-sm:[&_.quiz-primary-button]:ml-0 max-sm:[&_.quiz-primary-button]:w-full" noValidate onKeyDown={onKeyboardSubmit} onSubmit={onSubmit}><label className="text-[0.88rem] font-extrabold text-[#273653]" htmlFor="quiz-answer">Câu trả lời bằng tiếng Anh</label><p className="mb-[0.65rem] mt-1 text-[0.78rem] text-[#758097]" id="quiz-answer-help">Nhập đầy đủ từ hoặc cụm từ.</p><input className="min-h-[50px] w-full rounded-xl border border-[#cfd7e7] bg-white px-[0.9rem] py-[0.78rem] font-[inherit] text-base text-[#101828] focus:border-[#4CA2E6] focus:outline focus:outline-2 focus:outline-[#4CA2E6]/20 disabled:bg-[#f4f6f9] disabled:text-[#526078] aria-[invalid=true]:border-[#cf3148]" aria-describedby={`quiz-answer-help${error ? " quiz-answer-error" : ""}`} aria-invalid={Boolean(error)} autoComplete="off" autoFocus disabled={locked} id="quiz-answer" maxLength="100" onChange={(event) => onChange(event.target.value)} spellCheck="false" value={answer} />{error ? <p className="quiz-field-error mb-0 mt-2 text-[0.8rem] font-bold text-[#b42338]" id="quiz-answer-error" role="alert">{error}</p> : null}<button aria-busy={pending} className={PRIMARY_BUTTON_CLASSES} disabled={pending || (locked && !retryable)} onClick={retryable ? onRetry : undefined} onPointerDown={onPointerSubmit} type={retryable ? "button" : "submit"}>{pending ? <LoaderCircle className="quiz-spinner animate-spin motion-reduce:[animation-duration:1.5s]" aria-hidden="true" /> : null}{pending ? "Đang kiểm tra…" : retryable ? "Thử gửi lại" : "Kiểm tra đáp án"}</button></form>; }
function AcceptedFeedback({ headingRef, result }) { const correct = result.is_correct; const announcement = correct ? "Chính xác. Bạn đã trả lời đúng." : "Chưa chính xác. Hãy xem lại đáp án trước khi tiếp tục."; return <section className={`quiz-feedback mt-[1.4rem] rounded-[15px] border p-4 ${correct ? "is-correct border-[#bbf7d0] bg-[#fbfffc] text-[#08703f]" : "is-incorrect border-[#fecaca] bg-[#fffafa] text-[#a9263a]"}`} aria-labelledby="quiz-result-title"><p aria-atomic="true" aria-live="polite" className="sr-only" role="status">{announcement}</p><div className="quiz-feedback-heading flex items-start gap-[0.7rem] [&>svg]:size-[1.6rem]">{correct ? <CheckCircle2 aria-hidden="true" /> : <CircleX aria-hidden="true" />}<div><h2 className="m-0 text-[1.15rem] text-current outline-none" id="quiz-result-title" ref={headingRef} tabIndex="-1">{correct ? "Chính xác" : "Chưa chính xác"}</h2><p className="mb-0 mt-1">{correct ? "Bạn đã trả lời đúng." : "Hãy xem lại đáp án trước khi tiếp tục."}</p></div></div>{!correct ? <p className="mt-[0.9rem] grid grid-cols-[minmax(120px,auto)_1fr] gap-3 text-[#526078] max-sm:grid-cols-1 max-sm:gap-[0.2rem]"><span>Câu trả lời của bạn</span><strong className="text-[#172033] [overflow-wrap:anywhere]">{result.normalized_answer}</strong></p> : null}<p className="mt-[0.9rem] grid grid-cols-[minmax(120px,auto)_1fr] gap-3 text-[#526078] max-sm:grid-cols-1 max-sm:gap-[0.2rem]"><span>Đáp án đúng</span><strong className="text-[#172033] [overflow-wrap:anywhere]">{result.correct_answer}</strong></p><CharacterFeedback feedback={result.character_feedback} /></section>; }
function CharacterFeedback({ feedback }) { if (!feedback.length) return null; return <section className="quiz-character-feedback mt-[1.1rem] border-t border-current/20 pt-4" aria-labelledby="quiz-character-title"><h3 className="mb-[0.65rem] mt-0 text-[0.86rem] text-[#273653]" id="quiz-character-title">Chi tiết ký tự</h3><ol className="m-0 flex list-none flex-wrap gap-[0.45rem] p-0">{presentCharacterFeedback(feedback).map((item) => { const semanticColor = item.state === "correct" ? "text-[#22c55e]" : "text-red-500"; return <li aria-label={item.accessibleLabel} className={`is-${item.state} grid min-w-10 px-1 py-[0.2rem] text-center ${semanticColor}`} key={item.position}><span aria-hidden="true" className={`quiz-feedback-character font-[850] ${item.state === "correct" ? "text-[#172033]" : "text-red-500"}`}>{item.visibleValue}</span><span aria-hidden="true" className="quiz-feedback-underline mt-[0.18rem] block w-full border-b-4 border-current" /></li>; })}</ol></section>; }
function SubmissionError({ error, onRefresh }) { const message = error.kind === "question-changed" ? "Nội dung câu hỏi đã thay đổi. Hãy tải lại Quiz để tiếp tục." : error.kind === "progress-conflict" ? "Tiến độ của từ này đã thay đổi ở một hoạt động khác. Hãy làm mới Quiz để tiếp tục." : error.conclusive ? "Không thể chấp nhận câu trả lời này. Hãy làm mới Quiz để tiếp tục." : "Chưa thể xác nhận câu trả lời. Bạn có thể thử gửi lại an toàn."; return <div className="quiz-inline-error mt-4 flex gap-[0.65rem] rounded-xl border border-[#f0c2ca] bg-[#fff8f9] p-[0.85rem] text-[#a9263a]" role="alert"><CircleAlert aria-hidden="true" /><div><p className="m-0 leading-normal">{message}</p>{error.conclusive ? <button className={`mt-[0.45rem] min-h-11 cursor-pointer border-0 bg-transparent font-extrabold text-[#8f1d30] underline ${FOCUS_CLASSES}`} onClick={onRefresh} type="button">Làm mới Quiz</button> : null}</div></div>; }
function LoadState({ state, onBack, onRetry, setName }) { const loading = state === "loading"; const content = state === "empty" ? ["Bộ từ chưa sẵn sàng", "Bộ từ này chưa có từ vựng để làm Quiz."] : state === "not-found" ? ["Không thể mở Quiz", "Bộ từ có thể không còn khả dụng."] : ["Không thể tải Quiz", "Vui lòng thử lại."]; return <section className={`${PAGE_CLASSES} quiz-load-page`} aria-labelledby="quiz-load-title"><QuizTopBar onBack={onBack} setName={setName} />{loading ? <div className="quiz-loading-state px-4 py-12 text-center text-[#526078]" role="status"><h1 className="mb-[1.3rem] mt-[0.8rem] text-[1.35rem] text-[#172033]" id="quiz-load-title">Đang chuẩn bị Quiz…</h1><div className="mx-auto grid max-w-[520px] gap-[0.6rem] [&>span]:h-5 [&>span]:animate-pulse [&>span]:rounded-[7px] [&>span]:bg-[#e8edf6] motion-reduce:[&>span]:animate-none [&>span:nth-child(2)]:h-[140px]" aria-hidden="true"><span /><span /><span /></div></div> : <div className={`quiz-state-card rounded-[22px] p-[clamp(1.5rem,5vw,3rem)] text-center [&>svg]:size-10 [&>svg]:text-[#d13b50] ${CARD_CLASSES}`} role={state === "error" ? "alert" : undefined}><CircleAlert aria-hidden="true" /><h1 className="mb-[0.45rem] mt-[0.7rem] text-[clamp(1.5rem,4vw,2rem)] text-[#101828]" id="quiz-load-title">{content[0]}</h1><p className="text-[#667085]">{content[1]}</p><div className="mt-[1.2rem] flex flex-wrap justify-center gap-[0.7rem]">{state === "error" ? <button className={PRIMARY_BUTTON_CLASSES} onClick={onRetry} type="button"><RefreshCw aria-hidden="true" />Thử lại</button> : null}<button className={TEXT_BUTTON_CLASSES} onClick={onBack} type="button">Quay lại</button></div></div>}</section>; }
function Completion({ headingRef, onBack, onRestart, quizType, setName, summary }) { return <section className={`${PAGE_CLASSES} quiz-completion`} aria-labelledby="quiz-completion-title"><QuizTopBar onBack={onBack} onRestart={onRestart} setName={setName} /><div className={`quiz-completion-card rounded-[22px] p-[clamp(1.5rem,5vw,3rem)] text-center focus-within:ring-1 focus-within:ring-[#4CA2E6]/35 ${CARD_CLASSES}`}><span className="quiz-completion-icon inline-grid size-[58px] place-items-center rounded-full bg-[#dcf8e9] text-[#08703f] [&_svg]:size-8" aria-hidden="true"><CheckCircle2 /></span><p className="quiz-eyebrow mb-[0.35rem] text-[0.72rem] font-[850] uppercase tracking-[0.1em] text-[#4CA2E6]">{TYPES[quizType].label} · {setName}</p><h1 className="mb-[0.45rem] mt-[0.7rem] text-[clamp(1.5rem,4vw,2rem)] text-[#101828] outline-none" id="quiz-completion-title" ref={headingRef} tabIndex="-1">Hoàn thành Quiz</h1><p className="text-[#667085]">Bạn đã hoàn thành toàn bộ câu hỏi trong lượt này.</p><dl className="mt-6 grid grid-cols-3 gap-[0.8rem] max-sm:grid-cols-1 max-sm:gap-[0.55rem] [&>div]:rounded-[13px] [&>div]:bg-[#f3f6fb] [&>div]:p-[0.9rem] max-sm:[&>div]:flex max-sm:[&>div]:items-center max-sm:[&>div]:justify-between"><div><dt className="text-[0.76rem] font-[750] text-[#667085]">Tổng số câu</dt><dd className="mb-0 ml-0 mr-0 mt-[0.2rem] text-[1.7rem] font-[850] text-[#172033] max-sm:text-[1.35rem]">{summary.total}</dd></div><div className="is-correct !bg-[#effcf5]"><dt className="text-[0.76rem] font-[750] text-[#667085]">Chính xác</dt><dd className="mb-0 ml-0 mr-0 mt-[0.2rem] text-[1.7rem] font-[850] text-[#172033] max-sm:text-[1.35rem]">{summary.correct}</dd></div><div className="is-incorrect !bg-[#fff3f5]"><dt className="text-[0.76rem] font-[750] text-[#667085]">Chưa chính xác</dt><dd className="mb-0 ml-0 mr-0 mt-[0.2rem] text-[1.7rem] font-[850] text-[#172033] max-sm:text-[1.35rem]">{summary.incorrect}</dd></div></dl><div className="quiz-completion-actions mt-[1.2rem] flex flex-wrap justify-center gap-[0.7rem]"><button className={TEXT_BUTTON_CLASSES} onClick={onBack} type="button">Quay lại</button></div></div></section>; }
function RestartDialog({ onCancel, onConfirm }) { const ref = useRef(null); useEffect(() => { const dialog = ref.current; const returnFocus = document.activeElement; dialog?.showModal(); return () => { dialog?.close(); if (returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus(); }; }, []); return <dialog aria-labelledby="quiz-restart-title" className="quiz-restart-dialog fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[min(calc(100%-2rem),440px)] rounded-[18px] border-0 p-0 text-[#172033] shadow-[0_24px_80px_rgba(17,24,39,0.28)] backdrop:bg-slate-900/50" onCancel={onCancel} ref={ref}><div className="p-[1.4rem]"><span className="grid size-11 place-items-center rounded-xl bg-[#eff8ff] text-[#4CA2E6]" aria-hidden="true"><RotateCcw /></span><h2 className="mb-[0.4rem] mt-[0.9rem]" id="quiz-restart-title">Bắt đầu lại Quiz?</h2><p className="m-0 leading-[1.55] text-[#667085]">Kết quả tạm thời của lượt này sẽ được xóa. Tiến độ học đã lưu không bị đặt lại.</p><div className="mt-[1.2rem] flex justify-end gap-[0.65rem] max-sm:flex-col-reverse max-sm:[&_button]:w-full"><button className={`inline-flex min-h-[46px] cursor-pointer items-center justify-center rounded-[11px] border border-[#d3daea] bg-white px-4 py-[0.7rem] font-extrabold text-[#287fbe] disabled:cursor-not-allowed ${FOCUS_CLASSES}`} autoFocus onClick={onCancel} type="button">Hủy</button><button className={PRIMARY_BUTTON_CLASSES} onClick={onConfirm} type="button">Bắt đầu lại</button></div></div></dialog>; }
