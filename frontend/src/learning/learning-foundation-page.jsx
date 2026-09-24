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
      audioRef.current?.pause();
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
  const wordLengthClass = currentCard?.word.length > 36
    ? " is-very-long-word"
    : currentCard?.word.length > 20
      ? " is-long-word"
      : "";
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
    setAudioError(null);
    try {
      audioRef.current?.pause();
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
      utterance.onerror = () => {
        setAudioError("Không thể phát âm từ này. Bạn có thể tiếp tục học bình thường.");
      };
      window.speechSynthesis.speak(utterance);
    } catch {
      setAudioError("Không thể phát âm thanh mẫu. Bạn có thể tiếp tục học từ này.");
    }
  }

  if (status !== "ready" || !payload || !runState || !summary || !currentCard) {
    return <LearningPageState status={status} onRetry={retryLoad} returnTo={returnTo} />;
  }

  if (summary.completed) {
    return (
      <main className="learning-page learning-completion" aria-labelledby="learning-summary-title">
        <div className="learning-completion-card">
          <span className="learning-completion-mark" aria-hidden="true"><BookOpenCheck /></span>
          <p className="learning-eyebrow">Hoàn thành lượt học</p>
          <h1 id="learning-summary-title" ref={summaryHeadingRef} tabIndex={-1}>{payload.name}</h1>
          <p>Bạn đã tự đánh giá toàn bộ {summary.total} thẻ trong lượt học này.</p>
          <dl className="learning-summary-grid">
            <div><dt>Nhớ rồi</dt><dd>{summary.remembered}</dd></div>
            <div><dt>Học lại</dt><dd>{summary.study_again}</dd></div>
          </dl>
          <div className="learning-completion-actions">
            <button type="button" className="learning-button learning-button-primary" onClick={restartRun}><RotateCcw aria-hidden="true" /> Học lại bộ từ</button>
            <button type="button" className="learning-button learning-button-secondary" onClick={() => navigate(returnTo)}>Quay lại bộ từ</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="learning-page" aria-labelledby="learning-page-title">
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      <div className="learning-focus-toolbar">
        <button type="button" className="learning-back-link" onClick={() => navigate(returnTo)} disabled={eventState === "pending"} title={payload.name}><ArrowLeft aria-hidden="true" /><span>{payload.name}</span></button>
        <div className="learning-toolbar-actions">
          <button type="button" className="learning-button learning-button-quiet" onClick={restartRun} disabled={eventState === "pending"}><RotateCcw aria-hidden="true" /> Bắt đầu lại</button>
        </div>
      </div>
      <div className="learning-column">
        <h1 id="learning-page-title" className="sr-only">{payload.name}</h1>
        <section className="learning-progress" aria-label="Tiến độ bộ từ">
          <div><span>Tiến độ bộ từ</span><span>Thẻ {currentIndex + 1}/{cards.length}</span></div>
          <progress value={summary.assessed} max={summary.total}>{summary.assessed}/{summary.total}</progress>
        </section>
        {audioError ? <p className="learning-audio-error" role="alert">{audioError}</p> : null}
        {eventError ? (
          <div className={`learning-alert ${eventState === "conflict" ? "is-conflict" : ""}`} role="alert">
            <p>{eventError}</p>
            {eventState === "conflict" ? <button type="button" onClick={retryLoad}>Làm mới phiên học</button> : retryEvent ? <button type="button" onClick={() => void submitOutcome(retryEvent.outcome, retryEvent)}>Thử ghi nhận lại</button> : null}
          </div>
        ) : null}
        <div key={currentCard.id} className="learning-flip-stage" onClick={handleCardClick}>
          <div className={`learning-card-flipper ${revealed ? "is-revealed" : ""}`}>
            <section className="learning-card learning-card-front" aria-labelledby="learning-card-word" aria-hidden={revealed} inert={revealed || undefined}>
              <span className="learning-front-label">Từ vựng</span>
              <h2 id="learning-card-word" className={`learning-card-word${wordLengthClass}`} ref={cardHeadingRef} tabIndex={-1}>{currentCard.word}</h2>
              {currentCard.phonetic ? <p className="learning-phonetic">{currentCard.phonetic}</p> : null}
              {currentCard.pronunciation_url || supportsSpeechSynthesis ? <div className="learning-front-audio-row"><button type="button" className="learning-audio-button" onClick={playFromSpeaker} disabled={eventState === "pending"} aria-label={`Phát âm từ ${currentCard.word}`} title="Phát âm"><Volume2 aria-hidden="true" /></button></div> : null}
              <p className="learning-flip-helper">Nhấn hoặc Space để lật thẻ</p>
            </section>
            <section className="learning-card learning-card-back" aria-labelledby={`meaning-${primaryMeaning?.id ?? "unavailable"}`} aria-hidden={!revealed} inert={!revealed || undefined}>
              <header className="learning-back-header">
                <div className="learning-back-word-row">
                  <div>
                    <h2 className={`learning-card-word${wordLengthClass}`}>{currentCard.word}</h2>
                    {currentCard.phonetic ? <p className="learning-phonetic">{currentCard.phonetic}</p> : null}
                  </div>
                  {currentCard.pronunciation_url || supportsSpeechSynthesis ? <button type="button" className="learning-audio-button" onClick={playFromSpeaker} disabled={eventState === "pending"} aria-label={`Phát âm từ ${currentCard.word}`} title="Phát âm"><Volume2 aria-hidden="true" /></button> : null}
                </div>
                {primaryMeaning ? <div className="learning-meaning-meta"><span>{primaryMeaning.part_of_speech}</span>{primaryMeaning.cefr_level ? <span>{primaryMeaning.cefr_level}</span> : null}</div> : null}
              </header>
              <div className="learning-answer">
                {primaryMeaning ? (
                  <article aria-labelledby={`meaning-${primaryMeaning.id}`}>
                    <h3 className="learning-meaning-title" id={`meaning-${primaryMeaning.id}`} ref={answerHeadingRef} tabIndex={-1}>{primaryMeaning.meaning_vi}</h3>
                    {primaryMeaning.context ? <p className="learning-context">Ngữ cảnh: {primaryMeaning.context}</p> : null}
                    {primaryMeaning.examples.length > 0 ? <div className="learning-examples"><h4>Ví dụ</h4><ul>{primaryMeaning.examples.slice(0, 1).map((example) => <li key={example.id}><p>{example.example_en}</p>{example.example_vi ? <span>{example.example_vi}</span> : null}</li>)}</ul></div> : null}
                  </article>
                ) : <p id="meaning-unavailable">Chưa có nghĩa phù hợp để hiển thị.</p>}
              </div>
            </section>
          </div>
        </div>
        <div className="learning-action-slot">
          {revealed ? (
            <section className="learning-assessment" aria-label="Tự đánh giá">
              <button type="button" className="learning-button learning-button-study" onClick={() => void submitOutcome("STUDY_AGAIN")} disabled={eventState === "pending"} aria-busy={pendingOutcome === "STUDY_AGAIN"}>{pendingOutcome === "STUDY_AGAIN" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null} Học lại</button>
              <button type="button" className="learning-button learning-button-primary" onClick={() => void submitOutcome("REMEMBERED")} disabled={eventState === "pending"} aria-busy={pendingOutcome === "REMEMBERED"}>{pendingOutcome === "REMEMBERED" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null} Nhớ rồi</button>
            </section>
          ) : (
            <nav className="learning-navigation" aria-label="Điều hướng thẻ">
              <button type="button" className="learning-button learning-button-secondary" onClick={() => navigateCard(currentIndex - 1)} disabled={currentIndex === 0 || eventState === "pending"}><ArrowLeft aria-hidden="true" /> Thẻ trước</button>
              <button type="button" className="learning-button learning-button-secondary" onClick={() => navigateCard(currentIndex + 1)} disabled={currentIndex === cards.length - 1 || eventState === "pending"}>Thẻ sau <ArrowRight aria-hidden="true" /></button>
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
    <main className="learning-page learning-state-page">
      <section className="learning-state-card" role={status === "loading" ? "status" : "alert"} aria-live={status === "loading" ? "polite" : undefined}>
        {status === "loading" ? <LoaderCircle className="learning-state-icon animate-spin" aria-hidden="true" /> : <BookOpenCheck className="learning-state-icon" aria-hidden="true" />}
        <h1>{content[0]}</h1><p>{content[1]}</p>
        <div>{status === "error" ? <button type="button" className="learning-button learning-button-primary" onClick={onRetry}>Thử lại</button> : null}<Link className="learning-button learning-button-secondary" to={returnTo}>Quay lại bộ từ</Link></div>
      </section>
    </main>
  );
}
