import { ArrowLeft, ArrowRight, Check, CheckCircle2, CircleAlert, CircleX, Languages, LoaderCircle, PenLine, RefreshCw, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuthentication } from "../auth/use-authentication.js";
import { quizService } from "../services/quiz-service.js";
import { availableUnscrambleTiles, buildUnscrambleAnswer, classifyQuizLoadError, classifyQuizSubmissionError, createSharedQuizQuestionLoader, isUnscrambleAnswerComplete, presentCharacterFeedback, quizAnswerHasContent, removeUnscrambleTile, selectUnscrambleTile, unscrambleAnswerSlots } from "./quiz-presentation.js";
import { createActiveQuizNavigationState, resolveQuizBackNavigation } from "./quiz-navigation.js";
import { acceptQuizAnswer, beginQuizAnswer, createQuizRunState, failQuizAnswer, loadQuizRunState, reconcileQuizRunState, restartQuizRun, saveQuizRunState, summarizeQuizRun } from "./quiz-run-state.js";
import "./quiz-page.css";

const TYPES = {
  VI_TO_ENGLISH: { label: "Tiếng Việt → Tiếng Anh", description: "Nhập từ tiếng Anh phù hợp với nghĩa tiếng Việt." },
  UNSCRAMBLE_WORD: { label: "Sắp xếp từ tiếng Anh", description: "Sắp xếp các ký tự để tạo thành từ tiếng Anh." },
};
const loadQuizQuestions = createSharedQuizQuestionLoader(
  (setId, quizType, runId) => quizService.getQuestions(setId, quizType, runId),
);

export function QuizFoundationPage() {
  const { setId } = useParams();
  const { user } = useAuthentication();
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const type = params.get("type");
  const returnTo = location.state?.returnTo ?? "/my/vocabulary-sets";
  const setName = location.state?.setName ?? "Bộ từ đã chọn";
  function navigateBack(stage) {
    const action = resolveQuizBackNavigation({ stage, state: location.state, selectionPath: location.pathname, returnTo });
    if (action.kind === "history") navigate(action.delta);
    else navigate(action.to, { replace: true, state: action.state });
  }
  if (!user?.id || !setId || !Object.hasOwn(TYPES, type)) {
    return <TypeSelection onBack={() => navigateBack("selection")} onStart={(selected) => setParams({ type: selected }, { state: createActiveQuizNavigationState(location.state) })} setName={setName} />;
  }
  return <ActiveQuiz key={`${user.id}:${setId}:${type}`} onBack={() => navigateBack("active")} quizType={type} setId={setId} userId={user.id} />;
}

function TypeSelection({ onBack, onStart, setName }) {
  const [selected, setSelected] = useState("");
  return <section className="quiz-page quiz-selection" aria-labelledby="quiz-selection-title">
    <BackControl onBack={onBack} />
    <header><p className="quiz-eyebrow">Quiz · {setName}</p><h1 id="quiz-selection-title">Chọn loại Quiz</h1><p>Chọn một hình thức và hoàn thành toàn bộ từ vựng theo thứ tự của bộ từ.</p></header>
    <fieldset className="quiz-type-options"><legend className="sr-only">Loại Quiz</legend>{Object.entries(TYPES).map(([type, option]) => <label className={`quiz-type-option${selected === type ? " is-selected" : ""}`} key={type}>
      <input checked={selected === type} name="quiz-type" onChange={() => setSelected(type)} type="radio" value={type} />
      <span className="quiz-type-icon" aria-hidden="true">{type === "VI_TO_ENGLISH" ? <Languages /> : <PenLine />}</span>
      <span><strong>{option.label}</strong><small>{option.description}</small></span><Check className="quiz-type-check" aria-hidden="true" />
    </label>)}</fieldset>
    <button className="quiz-primary-button quiz-start-button" disabled={!selected} onClick={() => onStart(selected)} type="button">Bắt đầu Quiz <ArrowRight aria-hidden="true" /></button>
  </section>;
}

function ActiveQuiz({ onBack, quizType, setId, userId }) {
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

  if (loadState !== "ready") return <LoadState state={loadState} onBack={onBack} onRetry={() => { setLoadState("loading"); setLoadToken((value) => value + 1); }} />;
  if (showCompletion && summary.completed) return <Completion headingRef={completionRef} onBack={onBack} onRestart={restart} quizType={quizType} setName={payload.name} summary={summary} />;
  return <section className="quiz-page" aria-labelledby="quiz-title">
    <div className="quiz-toolbar"><BackControl onBack={onBack} /><button className="quiz-text-button" onClick={requestRestart} type="button"><RotateCcw aria-hidden="true" />Bắt đầu lại</button></div>
    <header className="quiz-run-header"><div><p className="quiz-eyebrow">Quiz</p><h1 id="quiz-title">{payload.name}</h1></div><span className="quiz-type-badge">{TYPES[quizType].label}</span></header>
    <Progress accepted={summary.answered} current={Math.min(currentIndex + 1, summary.total)} total={summary.total} />
    <article className="quiz-question-card" aria-busy={pending}>
      <Prompt headingRef={questionRef} question={shown} quizType={quizType} />
      {!result ? quizType === "UNSCRAMBLE_WORD"
        ? <UnscrambleAnswerForm error={validationError} locked={Boolean(run.pending_attempt || submitError?.conclusive)} onChange={(value) => { setSelectedTileIds(value); setValidationError(null); }} onKeyboardSubmit={noteKeyboardSubmission} onPointerSubmit={notePointerSubmission} onRetry={retrySubmission} onSubmit={submit} pending={pending} prompt={current.prompt} retryable={Boolean(submitError && !submitError.conclusive)} selectedTileIds={selectedTileIds} />
        : <AnswerForm answer={answer} error={validationError} locked={Boolean(run.pending_attempt || submitError?.conclusive)} onChange={(value) => { setAnswer(value); setValidationError(null); }} onKeyboardSubmit={noteKeyboardSubmission} onPointerSubmit={notePointerSubmission} onRetry={retrySubmission} onSubmit={submit} pending={pending} retryable={Boolean(submitError && !submitError.conclusive)} />
        : <AcceptedFeedback headingRef={resultRef} result={result} />}
      {submitError ? <SubmissionError error={submitError} onRefresh={refreshConflict} /> : null}
    </article>
    {result ? <div className="quiz-next-action"><button className="quiz-primary-button" onClick={nextQuestion} type="button">{summary.completed ? "Xem kết quả" : "Câu tiếp theo"}<ArrowRight aria-hidden="true" /></button></div> : null}
    {restartOpen ? <RestartDialog onCancel={() => setRestartOpen(false)} onConfirm={restart} /> : null}
  </section>;
}

function BackControl({ onBack }) { return <button className="quiz-back-link" onClick={onBack} type="button"><ArrowLeft aria-hidden="true" /><span>Quay lại</span></button>; }
function Progress({ accepted, current, total }) { return <section className="quiz-progress" aria-label="Tiến độ Quiz"><div><span>Câu {current} / {total}</span><span>{accepted} câu đã hoàn thành</span></div><div aria-label={`${accepted} trên ${total} câu đã hoàn thành`} aria-valuemax={total} aria-valuemin="0" aria-valuenow={accepted} className="quiz-progress-track" role="progressbar"><span style={{ width: `${total ? accepted / total * 100 : 0}%` }} /></div></section>; }
function Prompt({ headingRef, question, quizType }) { if (!question) return null; return <header className="quiz-question-prompt"><p className="quiz-question-kicker">{quizType === "VI_TO_ENGLISH" ? "NGHĨA TIẾNG VIỆT" : "SẮP XẾP TỪ TIẾNG ANH"}</p><h2 ref={headingRef} tabIndex="-1">{question.prompt.meaning_vi}</h2><div className="quiz-question-meta"><span>{question.prompt.part_of_speech}</span>{question.prompt.cefr_level ? <span>{question.prompt.cefr_level}</span> : null}</div>{question.prompt.context ? <p className="quiz-question-context">{question.prompt.context}</p> : null}{quizType === "UNSCRAMBLE_WORD" ? <p className="quiz-question-instruction">Chọn các ký tự theo đúng thứ tự.</p> : null}</header>; }
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
  return <form className="quiz-answer-form quiz-unscramble-form" noValidate onKeyDown={onKeyboardSubmit} onSubmit={onSubmit}>
    <fieldset disabled={locked || pending}>
      <legend>Sắp xếp câu trả lời</legend>
      <p id="quiz-unscramble-help">Chọn từng ký tự để điền vào vị trí tiếp theo. Nhấn ký tự đã chọn để đưa về nhóm bên dưới.</p>
      <div aria-describedby={`quiz-unscramble-help${error ? " quiz-answer-error" : ""}`} aria-invalid={Boolean(error)} aria-label="Câu trả lời đã sắp xếp" className="quiz-unscramble-answer" role="group">
        {answerSlots.map((slot, index) => slot.kind === "separator"
          ? <span aria-label={`Ký tự cố định ${slot.value}`} className="quiz-answer-slot is-separator" key={`separator-${index}`}>{slot.value}</span>
          : slot.tile_id
            ? <button aria-label={`Bỏ ký tự ${slot.character} khỏi vị trí ${index + 1}`} className="quiz-answer-slot is-filled" key={`tile-${index}-${slot.tile_id}`} onClick={() => removeTile(slot.tile_id)} type="button">{slot.character}</button>
            : <span aria-hidden="true" className="quiz-answer-slot is-empty" key={`empty-${index}`} />)}
      </div>
      <div aria-label="Các ký tự có thể chọn" className="quiz-unscramble-pool" role="group">
        {poolTiles.map((tile, index) => <button aria-label={`Chọn ký tự ${tile.character}, vị trí ${index + 1} trong nhóm ký tự`} className="quiz-letter-tile" key={tile.tile_id} onClick={() => chooseTile(tile.tile_id)} ref={(node) => { if (node) poolRefs.current.set(tile.tile_id, node); else poolRefs.current.delete(tile.tile_id); }} type="button">{tile.character}</button>)}
        {!poolTiles.length ? <span className="quiz-pool-empty">Đã chọn đủ ký tự</span> : null}
      </div>
    </fieldset>
    {prompt.shuffle_mode === "IDENTITY_FALLBACK" ? <p className="quiz-identity-note">Các ký tự của từ này không thể đảo thành một thứ tự khác, hãy chọn lần lượt để xác nhận.</p> : null}
    {error ? <p className="quiz-field-error" id="quiz-answer-error" role="alert">{error}</p> : null}
    <button aria-busy={pending} className="quiz-primary-button" disabled={pending || (!retryable && (!complete || locked))} onClick={retryable ? onRetry : undefined} onPointerDown={onPointerSubmit} ref={submitRef} type={retryable ? "button" : "submit"}>{pending ? <LoaderCircle className="quiz-spinner" aria-hidden="true" /> : null}{pending ? "Đang kiểm tra…" : retryable ? "Thử gửi lại" : "Kiểm tra đáp án"}</button>
  </form>;
}

function AnswerForm({ answer, error, locked, onChange, onKeyboardSubmit, onPointerSubmit, onRetry, onSubmit, pending, retryable }) { return <form className="quiz-answer-form" noValidate onKeyDown={onKeyboardSubmit} onSubmit={onSubmit}><label htmlFor="quiz-answer">Câu trả lời bằng tiếng Anh</label><p id="quiz-answer-help">Nhập đầy đủ từ hoặc cụm từ.</p><input aria-describedby={`quiz-answer-help${error ? " quiz-answer-error" : ""}`} aria-invalid={Boolean(error)} autoComplete="off" autoFocus disabled={locked} id="quiz-answer" maxLength="100" onChange={(event) => onChange(event.target.value)} spellCheck="false" value={answer} />{error ? <p className="quiz-field-error" id="quiz-answer-error" role="alert">{error}</p> : null}<button aria-busy={pending} className="quiz-primary-button" disabled={pending || (locked && !retryable)} onClick={retryable ? onRetry : undefined} onPointerDown={onPointerSubmit} type={retryable ? "button" : "submit"}>{pending ? <LoaderCircle className="quiz-spinner" aria-hidden="true" /> : null}{pending ? "Đang kiểm tra…" : retryable ? "Thử gửi lại" : "Kiểm tra đáp án"}</button></form>; }
function AcceptedFeedback({ headingRef, result }) { const correct = result.is_correct; const announcement = correct ? "Chính xác. Bạn đã trả lời đúng." : "Chưa chính xác. Hãy xem lại đáp án trước khi tiếp tục."; return <section className={`quiz-feedback ${correct ? "is-correct" : "is-incorrect"}`} aria-labelledby="quiz-result-title"><p aria-atomic="true" aria-live="polite" className="sr-only" role="status">{announcement}</p><div className="quiz-feedback-heading">{correct ? <CheckCircle2 aria-hidden="true" /> : <CircleX aria-hidden="true" />}<div><h2 id="quiz-result-title" ref={headingRef} tabIndex="-1">{correct ? "Chính xác" : "Chưa chính xác"}</h2><p>{correct ? "Bạn đã trả lời đúng." : "Hãy xem lại đáp án trước khi tiếp tục."}</p></div></div>{!correct ? <p><span>Câu trả lời của bạn</span><strong>{result.normalized_answer}</strong></p> : null}<p><span>Đáp án đúng</span><strong>{result.correct_answer}</strong></p><CharacterFeedback feedback={result.character_feedback} /></section>; }
function CharacterFeedback({ feedback }) { if (!feedback.length) return null; return <section className="quiz-character-feedback" aria-labelledby="quiz-character-title"><h3 id="quiz-character-title">Chi tiết ký tự</h3><ol>{presentCharacterFeedback(feedback).map((item) => <li aria-label={item.accessibleLabel} className={`is-${item.state}`} key={item.position}><span aria-hidden="true" className="quiz-feedback-character">{item.visibleValue}</span><span aria-hidden="true" className="quiz-feedback-underline" /></li>)}</ol></section>; }
function SubmissionError({ error, onRefresh }) { const message = error.kind === "question-changed" ? "Nội dung câu hỏi đã thay đổi. Hãy tải lại Quiz để tiếp tục." : error.kind === "progress-conflict" ? "Tiến độ của từ này đã thay đổi ở một hoạt động khác. Hãy làm mới Quiz để tiếp tục." : error.conclusive ? "Không thể chấp nhận câu trả lời này. Hãy làm mới Quiz để tiếp tục." : "Chưa thể xác nhận câu trả lời. Bạn có thể thử gửi lại an toàn."; return <div className="quiz-inline-error" role="alert"><CircleAlert aria-hidden="true" /><div><p>{message}</p>{error.conclusive ? <button onClick={onRefresh} type="button">Làm mới Quiz</button> : null}</div></div>; }
function LoadState({ state, onBack, onRetry }) { const loading = state === "loading"; const content = state === "empty" ? ["Bộ từ chưa sẵn sàng", "Bộ từ này chưa có từ vựng để làm Quiz."] : state === "not-found" ? ["Không thể mở Quiz", "Bộ từ có thể không còn khả dụng."] : ["Không thể tải Quiz", "Vui lòng thử lại."]; return <section className="quiz-page quiz-load-page" aria-labelledby="quiz-load-title"><BackControl onBack={onBack} />{loading ? <div className="quiz-loading-state" role="status"><LoaderCircle className="quiz-spinner" aria-hidden="true" /><h1 id="quiz-load-title">Đang chuẩn bị Quiz…</h1><div aria-hidden="true"><span /><span /><span /></div></div> : <div className="quiz-state-card" role={state === "error" ? "alert" : undefined}><CircleAlert aria-hidden="true" /><h1 id="quiz-load-title">{content[0]}</h1><p>{content[1]}</p><div>{state === "error" ? <button className="quiz-primary-button" onClick={onRetry} type="button"><RefreshCw aria-hidden="true" />Thử lại</button> : null}<button className="quiz-text-button" onClick={onBack} type="button">Quay lại</button></div></div>}</section>; }
function Completion({ headingRef, onBack, onRestart, quizType, setName, summary }) { return <section className="quiz-page quiz-completion" aria-labelledby="quiz-completion-title"><BackControl onBack={onBack} /><div className="quiz-completion-card"><span className="quiz-completion-icon" aria-hidden="true"><CheckCircle2 /></span><p className="quiz-eyebrow">{TYPES[quizType].label} · {setName}</p><h1 id="quiz-completion-title" ref={headingRef} tabIndex="-1">Hoàn thành Quiz</h1><p>Bạn đã hoàn thành toàn bộ câu hỏi trong lượt này.</p><dl><div><dt>Tổng số câu</dt><dd>{summary.total}</dd></div><div className="is-correct"><dt>Chính xác</dt><dd>{summary.correct}</dd></div><div className="is-incorrect"><dt>Chưa chính xác</dt><dd>{summary.incorrect}</dd></div></dl><div className="quiz-completion-actions"><button className="quiz-primary-button" onClick={onRestart} type="button"><RotateCcw aria-hidden="true" />Làm lại Quiz</button><button className="quiz-text-button" onClick={onBack} type="button">Quay lại</button></div></div></section>; }
function RestartDialog({ onCancel, onConfirm }) { const ref = useRef(null); useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []); return <dialog className="quiz-restart-dialog" onCancel={onCancel} ref={ref}><div><span aria-hidden="true"><RotateCcw /></span><h2>Bắt đầu lại Quiz?</h2><p>Kết quả tạm thời của lượt này sẽ được xóa. Tiến độ học đã lưu không bị đặt lại.</p><div><button autoFocus onClick={onCancel} type="button">Hủy</button><button className="quiz-primary-button" onClick={onConfirm} type="button">Bắt đầu lại</button></div></div></dialog>; }
