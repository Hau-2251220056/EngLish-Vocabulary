import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  LoaderCircle,
  RotateCcw,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useNavigationType,
  useParams,
} from "react-router-dom";
import { useAuthentication } from "../auth/use-authentication.js";
import { LearningApiError, learningService } from "../services/learning-service.js";
import {
  isKeyboardShortcutSafe,
  nextUnassessedCardId,
  pendingLearningOutcome,
  resolveFlashcardInteraction,
  revealWithPronunciation,
  selectEnglishSpeechVoice,
  selectPrimaryMeaning,
} from "./learning-presentation.js";
import {
  assessLearningCard,
  loadLearningRunState,
  reconcileLearningRunState,
  restartLearningRun,
  saveLearningRunState,
  selectLearningCard,
  summarizeLearningRun,
} from "./learning-run-state.js";

const OUTCOME_LABELS = {
  REMEMBERED: "Nhớ rồi",
  STUDY_AGAIN: "Học lại",
};

const PAGE_CLASSES = "learning-page mx-auto h-full min-h-0 w-full max-w-[75rem] px-[clamp(0.8rem,3vw,2rem)] py-[clamp(0.55rem,1.5vw,0.85rem)] text-[#172554] max-[700px]:px-[0.8rem] max-[700px]:py-[0.65rem]";
const BUTTON_CLASSES = "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[0.8rem] border border-transparent px-4 py-[0.7rem] font-[inherit] font-extrabold no-underline transition-[transform,box-shadow,background-color] duration-150 hover:not-disabled:-translate-y-px focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] disabled:cursor-not-allowed disabled:opacity-[0.58] motion-reduce:transform-none motion-reduce:transition-none [&_svg]:size-[1.1rem]";
const PRIMARY_BUTTON_CLASSES = `${BUTTON_CLASSES} bg-[var(--accent-primary)] text-white shadow-[0_4px_12px_rgb(76_162_230/16%)] hover:not-disabled:bg-[var(--accent-primary-hover)] active:bg-[var(--accent-primary-pressed)]`;
const SECONDARY_BUTTON_CLASSES = `${BUTTON_CLASSES} border-slate-300 bg-white text-slate-700`;
const AUDIO_BUTTON_CLASSES = "inline-flex size-11 min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-[var(--accent-primary-soft)] p-0 text-[var(--accent-primary-pressed)] transition-[transform,background-color,color,box-shadow] duration-150 hover:not-disabled:-translate-y-px hover:not-disabled:bg-[#dceffd] hover:not-disabled:text-[var(--accent-primary-pressed)] focus-visible:bg-[#dceffd] focus-visible:text-[var(--accent-primary-pressed)] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-primary-focus)] disabled:cursor-not-allowed disabled:opacity-[0.58] motion-reduce:transform-none motion-reduce:transition-none [&_svg]:size-[1.3rem]";

function wordSizeClasses(length, back = false) {
  if (length > 36) return back ? "text-[clamp(1.2rem,2.7vw,1.8rem)]" : "text-[clamp(1.35rem,3.4vw,2.35rem)] leading-[1.15]";
  if (length > 20) return back ? "text-[clamp(1.45rem,3.3vw,2.25rem)]" : "text-[clamp(1.8rem,4.5vw,3.25rem)] leading-[1.08]";
  return back ? "text-[clamp(1.8rem,4vw,2.8rem)]" : "text-[clamp(2.4rem,6vw,4.5rem)]";
}

export function LearningFoundationPage() {
  const { setId } = useParams();
  const { user } = useAuthentication();
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const [payload, setPayload] = useState(null);
  const [runState, setRunState] = useState(null);
  const [status, setStatus] = useState("loading");
  const [reloadToken, setReloadToken] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [eventState, setEventState] = useState("idle");
  const [eventError, setEventError] = useState(null);
  const [retryEvent, setRetryEvent] = useState(null);
  const [audioError, setAudioError] = useState(null);
  const [announcement, setAnnouncement] = useState("");
  const [focusTarget, setFocusTarget] = useState(null);
  const cardHeadingRef = useRef(null);
  const answerHeadingRef = useRef(null);
  const summaryHeadingRef = useRef(null);
  const audioRef = useRef(null);
  const pronunciationRequestRef = useRef(0);
  const returnTo = location.state?.returnTo ?? "/my/vocabulary-sets";
  const supportsSpeechSynthesis = typeof window !== "undefined"
    && "speechSynthesis" in window
    && "SpeechSynthesisUtterance" in window;

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) {
        setStatus("loading");
        setEventError(null);
      }
      return learningService.getLearningSet(setId);
    }).then(
      (freshPayload) => {
        if (!active) return;
        const stored = loadLearningRunState(window.sessionStorage, user.id, setId);
        let reconciled = reconcileLearningRunState(
          stored,
          user.id,
          setId,
          freshPayload.cards,
        );
        if (
          navigationType === "PUSH" &&
          summarizeLearningRun(reconciled, freshPayload.cards).completed
        ) {
          reconciled = restartLearningRun(reconciled, freshPayload.cards);
        }
        saveLearningRunState(window.sessionStorage, reconciled);
        setPayload(freshPayload);
        setRunState(reconciled);
        setRevealed(false);
        setRetryEvent(null);
        setEventState("idle");
        setAudioError(null);
        setStatus("ready");
        requestFocus("card");
      },
      (error) => {
        if (!active) return;
        if (error instanceof LearningApiError && error.code === "LEARNING_SET_EMPTY") {
          setStatus("empty");
        } else if (error instanceof LearningApiError && error.kind === "not-found") {
          setStatus("not-found");
        } else {
          setStatus("error");
        }
      },
    );
    return () => {
      active = false;
      pronunciationRequestRef.current += 1;
      audioRef.current?.pause();
      audioRef.current = null;
      if (supportsSpeechSynthesis) window.speechSynthesis.cancel();
    };
  }, [navigationType, reloadToken, setId, supportsSpeechSynthesis, user.id]);

  const cards = useMemo(() => payload?.cards ?? [], [payload]);
  const summary = useMemo(
    () => (runState ? summarizeLearningRun(runState, cards) : null),
    [cards, runState],
  );
  const currentIndex = cards.findIndex(
    (card) => card.id === runState?.current_vocabulary_id,
  );
  const currentCard = cards[currentIndex] ?? null;
  const primaryMeaning = useMemo(
    () => selectPrimaryMeaning(currentCard?.meanings),
    [currentCard],
  );
  const pendingOutcome = pendingLearningOutcome(eventState, retryEvent);

  useEffect(() => {
    if (!focusTarget) return;
    const target =
      focusTarget.kind === "answer"
        ? answerHeadingRef.current
        : focusTarget.kind === "summary"
          ? summaryHeadingRef.current
          : cardHeadingRef.current;
    target?.focus();
  }, [focusTarget]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (
        event.code !== "Space" ||
        status !== "ready" ||
        summary?.completed ||
        eventState === "pending" ||
        !isKeyboardShortcutSafe(event.target)
      ) {
        return;
      }
      event.preventDefault();
      toggleCardFace("space");
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  function retryLoad() {
    setReloadToken((value) => value + 1);
  }

  function revealAnswer() {
    if (revealed) return;
    setRevealed(true);
    setAnnouncement("Đã hiện nghĩa và ví dụ của từ hiện tại.");
    requestFocus("answer");
  }

  function showCardFront() {
    if (!revealed) return;
    setRevealed(false);
    setAnnouncement("Đã quay lại mặt trước của thẻ hiện tại.");
    requestFocus("card");
  }

  function toggleCardFace(trigger) {
    const interaction = resolveFlashcardInteraction(revealed, trigger);
    if (!interaction.shouldFlip) return;
    if (interaction.nextRevealed) {
      if (interaction.shouldPlayPronunciation) {
        revealWithPronunciation(revealAnswer, playPronunciation);
      } else {
        revealAnswer();
      }
    } else {
      showCardFront();
    }
  }

  function handleCardClick(event) {
    if (eventState === "pending" || !isKeyboardShortcutSafe(event.target)) return;
    toggleCardFace("card");
  }

  function playFromSpeaker() {
    const interaction = resolveFlashcardInteraction(revealed, "speaker");
    if (interaction.shouldPlayPronunciation) void playPronunciation();
  }

  function navigateCard(targetIndex) {
    const target = cards[targetIndex];
    if (!target || !runState || eventState === "pending") return;
    cancelPronunciation();
    const nextState = selectLearningCard(runState, target.id, cards);
    saveRunState(nextState);
    setRevealed(false);
    setEventError(null);
    setRetryEvent(null);
    setAudioError(null);
    setAnnouncement(`Đã chuyển đến thẻ ${targetIndex + 1} trên ${cards.length}.`);
    requestFocus("card");
  }

  async function submitOutcome(outcome, attempt = null) {
    if (!currentCard || !runState || eventState === "pending") return;
    const nextAttempt =
      attempt ??
      (retryEvent?.vocabulary_id === currentCard.id && retryEvent.outcome === outcome
        ? retryEvent
        : {
            event_id: window.crypto.randomUUID(),
            set_id: setId,
            vocabulary_id: currentCard.id,
            expected_revision: currentCard.progress.revision,
            outcome,
          });

    setEventState("pending");
    setEventError(null);
    setRetryEvent(nextAttempt);
    setAnnouncement(`Đang ghi nhận: ${OUTCOME_LABELS[outcome]}.`);
    try {
      const progress = await learningService.recordMeaningfulEvent(nextAttempt);
      const updatedCards = cards.map((card) =>
        card.id === currentCard.id ? { ...card, progress } : card,
      );
      setPayload((current) => ({ ...current, cards: updatedCards }));
      let nextState = assessLearningCard(runState, currentCard.id, outcome, cards);
      const nextSummary = summarizeLearningRun(nextState, cards);
      if (!nextSummary.completed) {
        const nextId = nextUnassessedCardId(cards, nextState.assessments, currentIndex);
        if (nextId) nextState = selectLearningCard(nextState, nextId, cards);
      }
      saveRunState(nextState);
      cancelPronunciation();
      setRetryEvent(null);
      setRevealed(false);
      setAudioError(null);
      setAnnouncement(`${OUTCOME_LABELS[outcome]} đã được ghi nhận.`);
      requestFocus(nextSummary.completed ? "summary" : "card");
    } catch (error) {
      if (
        error instanceof LearningApiError &&
        ["LEARNING_PROGRESS_CHANGED", "LEARNING_SET_ITEM_CHANGED"].includes(error.code)
      ) {
        setEventState("conflict");
        setEventError(
          error.code === "LEARNING_SET_ITEM_CHANGED"
            ? "Bộ từ đã thay đổi và từ này không còn trong phiên học."
            : "Tiến độ đã thay đổi ở một yêu cầu khác.",
        );
      } else {
        setEventState("error");
        setEventError("Chưa thể ghi nhận lựa chọn. Nội dung thẻ vẫn được giữ để bạn thử lại.");
      }
      return;
    }
    setEventState("idle");
  }

  function saveRunState(nextState) {
    setRunState(nextState);
    saveLearningRunState(window.sessionStorage, nextState);
  }

  function requestFocus(kind) {
    setFocusTarget({ kind });
  }

  function restartRun() {
    if (!runState || eventState === "pending") return;
    if (
      summary.assessed > 0 &&
      !window.confirm("Bắt đầu lại lượt học hiện tại? Tiến độ đã lưu của bạn sẽ không bị xóa.")
    ) {
      return;
    }
    const nextState = restartLearningRun(runState, cards);
    cancelPronunciation();
    saveRunState(nextState);
    setRevealed(false);
    setEventState("idle");
    setEventError(null);
    setRetryEvent(null);
    setAnnouncement("Đã bắt đầu một lượt học mới từ thẻ đầu tiên.");
    requestFocus("card");
  }

  async function playPronunciation() {
    if (!currentCard?.pronunciation_url && !supportsSpeechSynthesis) return;
    const requestId = pronunciationRequestRef.current + 1;
    pronunciationRequestRef.current = requestId;
    setAudioError(null);
    try {
      audioRef.current?.pause();
      audioRef.current = null;
      if (supportsSpeechSynthesis) window.speechSynthesis.cancel();
      if (currentCard.pronunciation_url) {
        const audio = new Audio(currentCard.pronunciation_url);
        audioRef.current = audio;
        await audio.play();
        return;
      }
      const utterance = new window.SpeechSynthesisUtterance(currentCard.word);
      const voice = selectEnglishSpeechVoice(window.speechSynthesis.getVoices());
      utterance.lang = voice?.lang ?? "en-US";
      if (voice) utterance.voice = voice;
      utterance.onerror = (event) => {
        if (
          pronunciationRequestRef.current !== requestId ||
          ["canceled", "cancelled", "interrupted"].includes(event.error)
        ) {
          return;
        }
        setAudioError("Không thể phát âm từ này. Bạn có thể tiếp tục học bình thường.");
      };
      window.speechSynthesis.speak(utterance);
    } catch {
      if (pronunciationRequestRef.current !== requestId) return;
      setAudioError("Không thể phát âm thanh mẫu. Bạn có thể tiếp tục học từ này.");
    }
  }

  function cancelPronunciation() {
    pronunciationRequestRef.current += 1;
    audioRef.current?.pause();
    audioRef.current = null;
    if (supportsSpeechSynthesis) window.speechSynthesis.cancel();
  }

  if (status !== "ready" || !payload || !runState || !summary || !currentCard) {
    return <LearningPageState status={status} onRetry={retryLoad} returnTo={returnTo} />;
  }

  if (summary.completed) {
    return (
      <main className={`${PAGE_CLASSES} grid min-h-[min(38rem,calc(100vh_-_9rem))] place-items-center`} aria-labelledby="learning-summary-title">
        <div className="w-full max-w-[34rem] rounded-[1.4rem] border border-[#d9e8f3] bg-white p-[clamp(1.5rem,5vw,2.5rem)] text-center shadow-[0_16px_36px_rgb(30_41_59/8%)]">
          <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-[var(--accent-primary-soft)] text-[var(--accent-primary-pressed)] [&_svg]:size-[1.8rem]" aria-hidden="true"><BookOpenCheck /></span>
          <p className="mb-[0.3rem] mt-4 text-xs font-black uppercase tracking-[0.12em] text-[var(--accent-primary-pressed)]">Hoàn thành lượt học</p>
          <h1 className="m-0" id="learning-summary-title" ref={summaryHeadingRef} tabIndex={-1}>{payload.name}</h1>
          <p className="m-0 text-slate-500 leading-[1.65]">Bạn đã tự đánh giá toàn bộ {summary.total} thẻ trong lượt học này.</p>
          <dl className="my-6 grid grid-cols-2 gap-3">
            <div className="rounded-[0.9rem] bg-slate-50 p-4"><dt className="text-[0.8rem] font-extrabold text-slate-500">Nhớ rồi</dt><dd className="mb-0 mt-[0.35rem] text-[1.8rem] font-black text-[#172554]">{summary.remembered}</dd></div>
            <div className="rounded-[0.9rem] bg-slate-50 p-4"><dt className="text-[0.8rem] font-extrabold text-slate-500">Học lại</dt><dd className="mb-0 mt-[0.35rem] text-[1.8rem] font-black text-[#172554]">{summary.study_again}</dd></div>
          </dl>
          <div className="flex justify-center gap-3 max-[460px]:flex-col">
            <button type="button" className={`${PRIMARY_BUTTON_CLASSES} max-[460px]:w-full`} onClick={restartRun}><RotateCcw aria-hidden="true" /> Học lại bộ từ</button>
            <button type="button" className={`${SECONDARY_BUTTON_CLASSES} max-[460px]:w-full`} onClick={() => navigate(returnTo)}>Quay lại bộ từ</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={PAGE_CLASSES} aria-labelledby="learning-page-title">
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      <div className="mb-[0.4rem] flex min-h-11 items-center justify-between gap-4 max-[700px]:mb-[0.35rem] max-[700px]:gap-2">
        <button type="button" className="inline-flex min-h-11 min-w-0 max-w-[min(60%,32rem)] cursor-pointer items-center gap-[0.4rem] border-0 bg-transparent px-0 py-[0.45rem] font-[inherit] font-extrabold text-slate-700 hover:not-disabled:text-[var(--accent-primary-pressed)] focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] disabled:cursor-not-allowed disabled:opacity-[0.58] max-[700px]:max-w-[48%] max-[700px]:text-[0.84rem] [&_span]:truncate [&_svg]:size-[1.1rem]" onClick={() => navigate(returnTo)} disabled={eventState === "pending"} title={payload.name}><ArrowLeft aria-hidden="true" /><span>{payload.name}</span></button>
        <div className="flex shrink-0 items-center gap-2 max-[700px]:gap-[0.35rem]">
          <button type="button" className={`${SECONDARY_BUTTON_CLASSES} min-h-10 px-[0.8rem] py-[0.55rem] max-[700px]:min-h-11 max-[700px]:w-auto max-[700px]:px-[0.7rem] max-[700px]:text-[0.82rem]`} onClick={restartRun} disabled={eventState === "pending"}><RotateCcw aria-hidden="true" /> Bắt đầu lại</button>
        </div>
      </div>
      <div className="mx-auto flex h-[calc(100%_-_3.15rem)] min-h-0 w-full max-w-[40rem] flex-col">
        <h1 id="learning-page-title" className="sr-only">{payload.name}</h1>
        <section className="learning-progress mb-[0.55rem] mt-[0.15rem] shrink-0" aria-label="Tiến độ bộ từ">
          <div className="mb-[0.3rem] flex items-center justify-between gap-4 text-[0.84rem] font-extrabold text-slate-600"><span>Tiến độ bộ từ</span><span>Thẻ {currentIndex + 1}/{cards.length}</span></div>
          <progress className="h-[0.45rem] w-full overflow-hidden rounded-full border-0 bg-slate-200 accent-[var(--accent-primary)]" value={summary.assessed} max={summary.total}>{summary.assessed}/{summary.total}</progress>
        </section>
        {audioError ? <p className="mx-auto mb-0 mt-[0.8rem] text-center text-red-700" role="alert">{audioError}</p> : null}
        {eventError ? (
          <div className={`mb-4 flex items-center justify-between gap-4 rounded-[0.9rem] border px-4 py-[0.85rem] max-[700px]:flex-col max-[700px]:items-stretch ${eventState === "conflict" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-red-200 bg-red-50 text-red-800"}`} role="alert">
            <p className="m-0">{eventError}</p>
            {eventState === "conflict" ? <button className={`${BUTTON_CLASSES} border-current bg-transparent text-inherit`} type="button" onClick={retryLoad}>Làm mới phiên học</button> : retryEvent ? <button className={`${BUTTON_CLASSES} border-current bg-transparent text-inherit`} type="button" onClick={() => void submitOutcome(retryEvent.outcome, retryEvent)}>Thử ghi nhận lại</button> : null}
          </div>
        ) : null}
        <div key={currentCard.id} className="learning-flip-stage grid min-h-60 max-h-[30rem] w-full flex-auto cursor-pointer self-center lg:h-96 lg:flex-none max-[700px]:min-h-56" onClick={handleCardClick}>
          <div className={`learning-card-flipper relative h-full min-h-0 min-w-0 rounded-3xl border border-[#b9dcf6] bg-white shadow-[0_16px_36px_rgb(30_41_59/8%)] focus-within:ring-1 focus-within:ring-[var(--accent-primary-focus)] max-[700px]:rounded-[1.1rem] ${revealed ? "is-revealed" : ""}`}>
            <section className="learning-card absolute inset-0 flex h-full min-h-0 min-w-0 w-full flex-col overflow-x-hidden overflow-y-auto rounded-[inherit] p-[clamp(1.1rem,2.5vw,1.75rem)] max-[700px]:p-4" aria-labelledby="learning-card-word" aria-hidden={revealed} inert={revealed || undefined}>
              <div className="learning-front-content flex min-h-0 flex-1 items-center justify-center">
                <div className="flex max-w-full flex-col items-center">
                  <span className="rounded-full bg-[var(--accent-primary-soft)] px-[0.65rem] py-[0.35rem] text-[0.72rem] font-black uppercase tracking-[0.08em] text-[var(--accent-primary-pressed)]">Từ vựng</span>
                  <h2 id="learning-card-word" className={`mt-[clamp(0.75rem,2vh,1.25rem)] max-w-full [overflow-wrap:anywhere] text-center font-black leading-none text-zinc-950 focus-visible:outline-0 max-[700px]:mt-[0.8rem] ${wordSizeClasses(currentCard.word.length)}`} ref={cardHeadingRef} tabIndex={-1}>{currentCard.word}</h2>
                  {currentCard.phonetic ? <p className="mb-0 mt-[0.45rem] text-center text-[clamp(1rem,2vw,1.25rem)] text-slate-500">{currentCard.phonetic}</p> : null}
                  {currentCard.pronunciation_url || supportsSpeechSynthesis ? <div className="mt-[0.55rem] flex justify-center"><button type="button" className={AUDIO_BUTTON_CLASSES} onClick={playFromSpeaker} disabled={eventState === "pending"} aria-label={`Phát âm từ ${currentCard.word}`} title="Phát âm"><Volume2 aria-hidden="true" /></button></div> : null}
                </div>
              </div>
              <p className="mb-0 mt-auto pt-[0.8rem] text-center text-[0.78rem] text-slate-400">Nhấn hoặc Space để lật thẻ</p>
            </section>
            <section className="learning-card learning-card-back absolute inset-0 h-full min-h-0 min-w-0 w-full overflow-x-hidden overflow-y-auto rounded-[inherit] p-[clamp(1.1rem,2.5vw,1.75rem)] max-[700px]:p-4" aria-labelledby={`meaning-${primaryMeaning?.id ?? "unavailable"}`} aria-hidden={!revealed} inert={!revealed || undefined}>
              <header className="border-b border-slate-200 pb-3">
                <div className="flex max-w-full items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className={`m-0 min-w-0 max-w-full [overflow-wrap:anywhere] text-left font-black leading-none text-[var(--accent-primary-pressed)] ${wordSizeClasses(currentCard.word.length, true)}`}>{currentCard.word}</h2>
                    {currentCard.phonetic ? <p className="mb-0 mt-[0.45rem] text-left text-[clamp(1rem,2vw,1.25rem)] text-slate-500">{currentCard.phonetic}</p> : null}
                  </div>
                  {currentCard.pronunciation_url || supportsSpeechSynthesis ? <button type="button" className={AUDIO_BUTTON_CLASSES} onClick={playFromSpeaker} disabled={eventState === "pending"} aria-label={`Phát âm từ ${currentCard.word}`} title="Phát âm"><Volume2 aria-hidden="true" /></button> : null}
                </div>
                {primaryMeaning ? <div className="mt-[0.55rem] flex flex-wrap gap-2 [&_span]:rounded-full [&_span]:bg-[var(--accent-primary-soft)] [&_span]:px-[0.65rem] [&_span]:py-[0.35rem] [&_span]:text-[0.78rem] [&_span]:font-extrabold [&_span]:text-[var(--accent-primary-pressed)]"><span>{primaryMeaning.part_of_speech}</span>{primaryMeaning.cefr_level ? <span>{primaryMeaning.cefr_level}</span> : null}</div> : null}
              </header>
              <div className="m-0 max-w-[43rem] pt-[0.85rem]">
                {primaryMeaning ? (
                  <article aria-labelledby={`meaning-${primaryMeaning.id}`}>
                    <h3 className="m-0 text-[clamp(1.45rem,3.2vw,2rem)] leading-[1.3] text-slate-900 focus-visible:outline-0" id={`meaning-${primaryMeaning.id}`} ref={answerHeadingRef} tabIndex={-1}>{primaryMeaning.meaning_vi}</h3>
                    {primaryMeaning.context ? <p className="my-[0.65rem] border-l-[3px] border-[#a9d5f4] pl-[0.85rem] leading-[1.65] text-slate-600">Ngữ cảnh: {primaryMeaning.context}</p> : null}
                    {primaryMeaning.examples.length > 0 ? <div className="mt-3"><h4 className="m-0 text-[0.9rem] text-slate-700">Ví dụ</h4><ul className="mb-0 mt-[0.45rem] grid list-none gap-[0.45rem] p-0">{primaryMeaning.examples.slice(0, 1).map((example) => <li className="rounded-xl bg-slate-100 px-3 py-[0.55rem]" key={example.id}><p className="m-0 font-bold leading-[1.55] text-slate-800">{example.example_en}</p>{example.example_vi ? <span className="mt-1 block leading-[1.5] text-slate-500">{example.example_vi}</span> : null}</li>)}</ul></div> : null}
                  </article>
                ) : <p id="meaning-unavailable">Chưa có nghĩa phù hợp để hiển thị.</p>}
              </div>
            </section>
          </div>
        </div>
        <div className="learning-action-slot mt-3 grid min-h-[3.35rem] shrink-0 place-items-center">
          {revealed ? (
            <section className="flex min-h-[3.35rem] shrink-0 items-center justify-center gap-[0.875rem] max-[700px]:w-full max-[700px]:max-w-[22rem]" aria-label="Tự đánh giá">
              <button type="button" className={`${BUTTON_CLASSES} min-w-32 whitespace-nowrap border-orange-200 bg-orange-50 text-orange-700 max-[700px]:min-w-0 max-[700px]:flex-1 max-[700px]:px-3`} onClick={() => void submitOutcome("STUDY_AGAIN")} disabled={eventState === "pending"} aria-busy={pendingOutcome === "STUDY_AGAIN"}>{pendingOutcome === "STUDY_AGAIN" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null} Học lại</button>
              <button type="button" className={`${PRIMARY_BUTTON_CLASSES} min-w-32 whitespace-nowrap max-[700px]:min-w-0 max-[700px]:flex-1 max-[700px]:px-3`} onClick={() => void submitOutcome("REMEMBERED")} disabled={eventState === "pending"} aria-busy={pendingOutcome === "REMEMBERED"}>{pendingOutcome === "REMEMBERED" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null} Nhớ rồi</button>
            </section>
          ) : (
            <nav className="flex items-center justify-center gap-[0.875rem]" aria-label="Điều hướng thẻ">
              <button type="button" className={`${BUTTON_CLASSES} whitespace-nowrap border-amber-300 bg-white text-amber-700 hover:not-disabled:bg-amber-50 focus-visible:ring-amber-200 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-100 max-[460px]:w-auto max-[460px]:min-w-0 max-[460px]:px-[0.7rem]`} onClick={() => navigateCard(currentIndex - 1)} disabled={currentIndex === 0 || eventState === "pending"}><ArrowLeft aria-hidden="true" /> Thẻ trước</button>
              <button type="button" className={`${BUTTON_CLASSES} whitespace-nowrap border-emerald-500 bg-emerald-500 text-white shadow-[0_4px_12px_rgb(16_185_129/18%)] hover:not-disabled:border-emerald-600 hover:not-disabled:bg-emerald-600 focus-visible:ring-emerald-200 active:border-emerald-700 active:bg-emerald-700 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none disabled:opacity-100 max-[460px]:w-auto max-[460px]:min-w-0 max-[460px]:px-[0.7rem]`} onClick={() => navigateCard(currentIndex + 1)} disabled={currentIndex === cards.length - 1 || eventState === "pending"}>Thẻ sau <ArrowRight aria-hidden="true" /></button>
            </nav>
          )}
        </div>
      </div>
    </main>
  );
}

function LearningPageState({ onRetry, returnTo, status }) {
  const content = {
    loading: ["Đang chuẩn bị phiên học", "Nội dung bộ từ và tiến độ của bạn đang được tải."],
    empty: ["Bộ từ chưa có nội dung", "Hãy thêm từ vựng vào bộ từ trước khi bắt đầu học."],
    "not-found": ["Không tìm thấy bộ từ có thể học", "Bộ từ không tồn tại hoặc bạn không có quyền truy cập."],
    error: ["Không thể tải phiên học", "Vui lòng kiểm tra kết nối và thử lại."],
  }[status] ?? ["Không thể mở phiên học", "Vui lòng quay lại và thử lại."];

  return (
    <main className={`${PAGE_CLASSES} grid min-h-[min(38rem,calc(100vh_-_9rem))] place-items-center`}>
      <section className="w-full max-w-[34rem] rounded-[1.4rem] border border-[#d9e8f3] bg-white p-[clamp(1.5rem,5vw,2.5rem)] text-center shadow-[0_16px_36px_rgb(30_41_59/8%)]" role={status === "loading" ? "status" : "alert"} aria-live={status === "loading" ? "polite" : undefined}>
        {status === "loading" ? <span className="learning-loading-icon inline-flex size-14 items-center justify-center rounded-2xl bg-[var(--accent-primary-soft)] text-[var(--accent-primary-pressed)]" aria-hidden="true"><LoaderCircle className="size-8 animate-spin" /></span> : <BookOpenCheck className="inline-flex size-14 rounded-2xl bg-[var(--accent-primary-soft)] p-3 text-[var(--accent-primary-pressed)]" aria-hidden="true" />}
        <h1 className="mb-0 mt-4">{content[0]}</h1><p className="text-slate-500 leading-[1.65]">{content[1]}</p>
        <div className="flex justify-center gap-3 max-[460px]:flex-col">{status === "error" ? <button type="button" className={`${PRIMARY_BUTTON_CLASSES} max-[460px]:w-full`} onClick={onRetry}>Thử lại</button> : null}<Link className={`${SECONDARY_BUTTON_CLASSES} max-[460px]:w-full`} to={returnTo}>Quay lại bộ từ</Link></div>
      </section>
    </main>
  );
}
