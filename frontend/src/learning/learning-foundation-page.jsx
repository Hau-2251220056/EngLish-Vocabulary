import { ArrowLeft, ArrowRight, BookOpenCheck, LoaderCircle, RotateCcw, Volume2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuthentication } from "../auth/use-authentication.js";
import { LearningApiError, learningService } from "../services/learning-service.js";
import { LearningSessionApiError, learningSessionService } from "../services/learning-session-service.js";
import { clearLearningSessionState } from "../session-storage/learning-session-state.js";
import { showXpRewardToast } from "../components/xp-reward-notification.js";
import {
  acknowledgeNormalReveal,
  canCompleteNormalLearningSession,
  completeNormalLearningSession,
  openNormalLearningSession,
  persistNormalLearningCursor,
  reconcileNormalLearningSession,
} from "./normal-learning-session.js";
import {
  acceptSrsRatingProjection,
  openSrsLearningSession,
  reconcileSrsLearningSession,
} from "./srs-learning-session.js";
import {
  isKeyboardShortcutSafe,
  pendingLearningRating,
  resolveFlashcardInteraction,
  revealWithPronunciation,
  selectEnglishSpeechVoice,
  selectPrimaryMeaning,
} from "./learning-presentation.js";
import {
  applySrsRating,
  completeNormalBatch,
  continueNormalRun,
  currentNormalBatchCards,
  currentSrsVocabularyId,
  loadLearningRunState,
  reconcileLearningRunState,
  reconcileSrsSessionRun,
  restartNormalRun,
  restartSrsRun,
  saveLearningRunState,
  selectLearningMode,
  selectNormalCard,
  setSrsRetryContext,
  summarizeLearningRun,
  summarizeNormalRun,
} from "./learning-run-state.js";

const RATING_LABELS = { AGAIN: "Lại", HARD: "Khó", GOOD: "Tốt", EASY: "Dễ" };
const RATING_INTERVAL_LABELS = Object.freeze({
  1: "Ngày mai",
  3: "1–3 ngày",
  7: "1 tuần+",
  14: "2 tuần",
  30: "30 ngày",
});
const PAGE_CLASSES = "learning-page mx-auto h-full min-h-0 w-full max-w-[75rem] px-[clamp(0.8rem,3vw,2rem)] py-[clamp(0.55rem,1.5vw,0.85rem)] text-[#172554] max-[700px]:px-[0.8rem] max-[700px]:py-[0.65rem]";
const BUTTON_CLASSES = "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[0.8rem] border border-transparent px-4 py-[0.7rem] font-[inherit] font-extrabold no-underline transition-[transform,box-shadow,background-color] duration-150 hover:not-disabled:-translate-y-px focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] disabled:cursor-not-allowed disabled:opacity-[0.58] motion-reduce:transform-none motion-reduce:transition-none [&_svg]:size-[1.1rem]";
const PRIMARY_BUTTON_CLASSES = `${BUTTON_CLASSES} bg-[var(--accent-primary)] text-white shadow-[0_4px_12px_rgb(76_162_230/16%)] hover:not-disabled:bg-[var(--accent-primary-hover)] active:bg-[var(--accent-primary-pressed)]`;
const SECONDARY_BUTTON_CLASSES = `${BUTTON_CLASSES} border-slate-300 bg-white text-slate-700`;
const RATING_BUTTON_CLASSES = {
  AGAIN: `${BUTTON_CLASSES} !border-2 !border-red-400 bg-white text-red-700 hover:not-disabled:bg-red-50 focus-visible:ring-red-300`,
  HARD: `${BUTTON_CLASSES} !border-2 !border-amber-400 bg-white text-amber-700 hover:not-disabled:bg-amber-50 focus-visible:ring-amber-300`,
  GOOD: `${BUTTON_CLASSES} !border-2 !border-[var(--accent-primary)] bg-white text-[var(--accent-primary-pressed)] hover:not-disabled:bg-[var(--accent-primary-soft)] focus-visible:ring-[var(--accent-primary-focus)]`,
  EASY: `${BUTTON_CLASSES} !border-2 !border-emerald-400 bg-white text-emerald-700 hover:not-disabled:bg-emerald-50 focus-visible:ring-emerald-300`,
};
const PREVIOUS_BUTTON_CLASSES = `${BUTTON_CLASSES} h-14 w-full min-w-0 flex-col gap-0.5 whitespace-nowrap !rounded-2xl !border-[#f97316] bg-white px-2 py-1 !font-semibold text-[#f97316] hover:not-disabled:bg-orange-50 focus-visible:ring-orange-200 active:bg-orange-100 disabled:!border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-100`;
const NEXT_BUTTON_CLASSES = `${BUTTON_CLASSES} h-14 w-full min-w-0 flex-col gap-0.5 whitespace-nowrap !rounded-2xl !border-[#7ed321] bg-[#7ed321] px-2 py-1 !font-semibold text-white shadow-[0_4px_12px_rgb(126_211_33/18%)] hover:not-disabled:!border-[#6fbd1d] hover:not-disabled:bg-[#6fbd1d] focus-visible:ring-lime-200 active:!border-[#5da117] active:bg-[#5da117] disabled:!border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none disabled:opacity-100`;
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
  const storedAtEntry = useMemo(
    () => loadLearningRunState(browserSessionStorage(), user.id, setId),
    [setId, user.id],
  );
  const [mode, setMode] = useState(storedAtEntry?.version === 3 ? storedAtEntry.active_mode : "SRS");
  const [pendingMode, setPendingMode] = useState(null);
  const [payload, setPayload] = useState(null);
  const [runState, setRunState] = useState(null);
  const [status, setStatus] = useState("loading");
  const [reloadToken, setReloadToken] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [eventState, setEventState] = useState("idle");
  const [eventError, setEventError] = useState(null);
  const [normalSession, setNormalSession] = useState(null);
  const [normalSessionStatus, setNormalSessionStatus] = useState("idle");
  const [normalRetryVocabularyId, setNormalRetryVocabularyId] = useState(null);
  const [srsSession, setSrsSession] = useState(null);
  const [srsSessionStatus, setSrsSessionStatus] = useState("idle");
  const [audioError, setAudioError] = useState(null);
  const [announcement, setAnnouncement] = useState("");
  const [focusTarget, setFocusTarget] = useState(null);
  const restartSrsRef = useRef(false);
  const modeTransitionRef = useRef(false);
  const shownXpRewardEventsRef = useRef(new Set());
  const cardHeadingRef = useRef(null);
  const answerHeadingRef = useRef(null);
  const summaryHeadingRef = useRef(null);
  const modeHeadingRef = useRef(null);
  const audioRef = useRef(null);
  const pronunciationRequestRef = useRef(0);
  const returnTo = location.state?.returnTo ?? "/my/vocabulary-sets";
  const supportsSpeechSynthesis = typeof window !== "undefined"
    && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

  const requestedMode = pendingMode ?? mode;

  useEffect(() => {
    let active = true;
    void learningService.getLearningSet(setId, { mode: requestedMode }).then(
      (freshPayload) => {
        if (!active) return;
        const stored = loadLearningRunState(browserSessionStorage(), user.id, setId);
        let nextState = reconcileLearningRunState(stored, user.id, setId, freshPayload);
        nextState = selectLearningMode(nextState, requestedMode);
        if (requestedMode === "SRS" && restartSrsRef.current) {
          nextState = restartSrsRun(nextState, freshPayload);
          restartSrsRef.current = false;
        }
        saveLearningRunState(browserSessionStorage(), nextState);
        setPayload(freshPayload);
        setRunState(nextState);
        setMode(requestedMode);
        if (requestedMode === "SRS") setSrsSessionStatus("loading");
        setPendingMode(null);
        modeTransitionRef.current = false;
        setRevealed(false);
        setEventState("idle");
        setAudioError(null);
        setStatus("ready");
        const normalCompleted = requestedMode === "NORMAL"
          && summarizeNormalRun(nextState).batch_completed;
        const srsSummary = requestedMode === "SRS" ? summarizeLearningRun(nextState) : null;
        requestFocus(normalCompleted || srsSummary?.completed || srsSummary?.up_to_date
          ? "summary" : freshPayload.cards.length > 0 ? "card" : "mode");
      },
      (error) => {
        if (!active) return;
        if (modeTransitionRef.current) {
          modeTransitionRef.current = false;
          setPendingMode(null);
          setEventError("Không thể chuyển chế độ ôn tập. Vui lòng thử lại.");
          return;
        }
        if (error instanceof LearningApiError && error.code === "LEARNING_SET_EMPTY") setStatus("empty");
        else if (error instanceof LearningApiError && error.kind === "not-found") setStatus("not-found");
        else setStatus("error");
      },
    );
    return () => {
      active = false;
      pronunciationRequestRef.current += 1;
      audioRef.current?.pause();
      audioRef.current = null;
      if (supportsSpeechSynthesis) window.speechSynthesis.cancel();
    };
  }, [reloadToken, requestedMode, setId, supportsSpeechSynthesis, user.id]);

  const allCards = useMemo(() => payload?.cards ?? [], [payload]);
  const proposedCards = useMemo(
    () => mode === "NORMAL" && runState
      ? currentNormalBatchCards(runState, allCards)
      : allCards,
    [allCards, mode, runState],
  );
  const cards = useMemo(() => {
    const sessionItems = mode === "NORMAL" ? normalSession?.item_ids : srsSession?.item_ids;
    if (!sessionItems?.length) return proposedCards;
    const byId = new Map(allCards.map((card) => [card.id, card]));
    return sessionItems.map((id) => byId.get(id)).filter(Boolean);
  }, [allCards, mode, normalSession, proposedCards, srsSession]);
  const summary = useMemo(() => runState ? summarizeLearningRun(runState) : null, [runState]);
  const normalSummary = useMemo(
    () => runState ? summarizeNormalRun(runState) : null,
    [runState],
  );
  const currentId = mode === "SRS"
    ? currentSrsVocabularyId(runState)
    : runState?.normal.current_vocabulary_id;
  const currentIndex = cards.findIndex((card) => card.id === currentId);
  const currentCard = cards[currentIndex] ?? null;
  const primaryMeaning = useMemo(() => selectPrimaryMeaning(currentCard?.meanings), [currentCard]);
  const retryEvent = runState?.srs.retry_context ?? null;
  const pendingRating = pendingLearningRating(eventState, retryEvent);

  useEffect(() => {
    if (status !== "ready" || mode !== "NORMAL" || !runState || cards.length === 0) {
      return undefined;
    }
    let active = true;
    const identity = { userId: user.id, setId, mode: "NORMAL" };
    void openNormalLearningSession({
      storage: browserSessionStorage(), identity,
      vocabularyIds: cards.map(({ id }) => id),
      service: learningSessionService,
      randomUuid: () => window.crypto.randomUUID(),
    }).then((sessionState) => {
      if (!active) return;
      setNormalSession(sessionState);
      setNormalSessionStatus(sessionState?.view_state ?? "error");
      if (sessionState?.view_state === "COMPLETED") {
        let completedState = selectNormalCard(runState, cards.at(-1).id, cards);
        completedState = completeNormalBatch(completedState);
        persist(completedState);
        requestFocus("summary");
      } else if (sessionState?.view_state === "ACTIVE") {
        const byId = new Map(allCards.map((card) => [card.id, card]));
        const authoritativeCards = sessionState.item_ids.map((id) => byId.get(id)).filter(Boolean);
        persist(selectNormalCard(runState, sessionState.cursor_vocabulary_id, authoritativeCards));
      } else if (sessionState?.view_state === "EXPIRED") {
        setEventError("Phiên học đã hết hạn. Hãy bắt đầu lại nhóm từ để tiếp tục.");
      } else if (sessionState?.view_state === "INACCESSIBLE") {
        setEventError("Bộ từ không còn khả dụng cho phiên này. Hãy quay lại hoặc bắt đầu lại sau khi có quyền truy cập.");
      }
    }).catch(() => {
      if (!active) return;
      setNormalSessionStatus("error");
      setEventError("Chưa thể chuẩn bị phiên học. Vui lòng thử lại.");
    });
    return () => { active = false; };
  // Batch identity owns the Backend session; cursor changes must not recreate it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, status, setId, user.id, cards.map(({ id }) => id).join(":")]);

  useEffect(() => {
    if (status !== "ready" || mode !== "SRS" || !runState) return undefined;
    let active = true;
    const identity = { userId: user.id, setId, mode: "SRS" };
    void openSrsLearningSession({
      storage: browserSessionStorage(), identity,
      service: learningSessionService,
      randomUuid: () => window.crypto.randomUUID(),
    }).then((sessionState) => {
      if (!active) return;
      setSrsSession(sessionState);
      setSrsSessionStatus(sessionState?.view_state ?? "UP_TO_DATE");
      if (!sessionState) return;
      const reconciledRun = reconcileSrsSessionRun(runState, sessionState);
      persist(reconciledRun);
      if (reconciledRun.srs.retry_context && sessionState.view_state === "ACTIVE") {
        setEventState("error");
        setEventError("Có một đánh giá chưa xác định kết quả. Hãy thử lại đúng thao tác trước khi tiếp tục.");
      }
      if (sessionState.view_state === "COMPLETED") requestFocus("summary");
      else if (sessionState.view_state === "EXPIRED") {
        setEventError("Phiên SRS đã hết hạn. Hãy bắt đầu lại để tiếp tục ôn tập.");
      } else if (sessionState.view_state === "INACCESSIBLE") {
        setEventError("Bộ từ không còn khả dụng cho phiên SRS này.");
      }
    }).catch(() => {
      if (!active) return;
      setSrsSessionStatus("error");
      setEventError("Chưa thể chuẩn bị phiên SRS. Vui lòng thử lại.");
    });
    return () => { active = false; };
  // The Backend session owns the immutable SRS queue for this Set.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, status, setId, user.id]);

  useEffect(() => {
    if (!focusTarget) return;
    const target = focusTarget.kind === "answer" ? answerHeadingRef.current
      : focusTarget.kind === "summary" ? summaryHeadingRef.current
        : focusTarget.kind === "mode" ? modeHeadingRef.current : cardHeadingRef.current;
    target?.focus();
  }, [focusTarget]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (status !== "ready" || pendingMode || !currentCard || eventState === "pending"
        || !isKeyboardShortcutSafe(event.target)) return;
      if (event.code === "Space") {
        event.preventDefault();
        toggleCardFace("space");
        return;
      }
      if (mode === "NORMAL" && event.key === "ArrowLeft") {
        event.preventDefault();
        navigateNormal(currentIndex - 1);
      } else if (mode === "NORMAL" && event.key === "ArrowRight") {
        event.preventDefault();
        navigateNormal(currentIndex + 1);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  function persist(nextState) {
    setRunState(nextState);
    saveLearningRunState(browserSessionStorage(), nextState);
  }

  function requestFocus(kind) { setFocusTarget({ kind, nonce: Date.now() }); }
  function retryLoad() {
    setStatus("loading");
    setEventError(null);
    setReloadToken((value) => value + 1);
  }

  function switchMode(nextMode) {
    if (nextMode === requestedMode || eventState === "pending" || pendingMode) return;
    cancelPronunciation();
    if (runState) persist(selectLearningMode(runState, nextMode));
    modeTransitionRef.current = true;
    setEventError(null);
    setPendingMode(nextMode);
    if (nextMode === "NORMAL") setNormalSessionStatus("idle");
    setRevealed(false);
    setAnnouncement(`Đã chuyển sang ${nextMode === "SRS" ? "Ôn tập SRS" : "Ôn tập thường"}.`);
  }

  function revealAnswer() {
    if (revealed) return;
    setRevealed(true);
    setAnnouncement("Đã hiện nghĩa và ví dụ của từ hiện tại.");
    requestFocus("answer");
  }

  async function revealNormalAnswer(retry = false) {
    if ((!retry && revealed) || mode !== "NORMAL" || !currentCard || !normalSession
      || normalSession.view_state !== "ACTIVE" || eventState === "pending") return;
    if (!revealed) revealAnswer();
    setEventState("pending");
    setEventError(null);
    setNormalRetryVocabularyId(currentCard.id);
    try {
      const accepted = await acknowledgeNormalReveal({
        storage: browserSessionStorage(),
        identity: { userId: user.id, setId, mode: "NORMAL" },
        state: normalSession,
        vocabularyId: currentCard.id,
        service: learningSessionService,
        randomUuid: () => window.crypto.randomUUID(),
      });
      setNormalSession(accepted);
      setNormalSessionStatus(accepted.view_state);
      setNormalRetryVocabularyId(null);
      setEventState("idle");
      setAnnouncement("Đã ghi nhận thẻ được lật. Bạn có thể tiếp tục.");
    } catch (error) {
      if (await reconcileTerminalNormalMutation(error)) return;
      setEventState("error");
      setEventError("Chưa thể ghi nhận lần lật thẻ. Hãy thử lại trước khi hoàn thành phiên.");
    }
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
      const reveal = mode === "NORMAL" ? () => void revealNormalAnswer() : revealAnswer;
      if (interaction.shouldPlayPronunciation) revealWithPronunciation(reveal, playPronunciation);
      else reveal();
    } else showCardFront();
  }

  function handleCardClick(event) {
    if (eventState === "pending" || pendingMode || !isKeyboardShortcutSafe(event.target)) return;
    toggleCardFace("card");
  }

  function navigateNormal(targetIndex) {
    const target = cards[targetIndex];
    if (!target || !runState || eventState === "pending") return;
    cancelPronunciation();
    persist(selectNormalCard(runState, target.id, cards));
    if (normalSession?.view_state === "ACTIVE") {
      try {
        setNormalSession(persistNormalLearningCursor({
          storage: browserSessionStorage(), state: normalSession, vocabularyId: target.id,
        }));
      } catch {
        setEventState("error");
        setEventError("Ch\u01b0a th\u1ec3 l\u01b0u v\u1ecb tr\u00ed th\u1ebb. H\u00e3y gi\u1eef trang n\u00e0y m\u1edf v\u00e0 th\u1eed l\u1ea1i.");
        return;
      }
    }
    setRevealed(false);
    setAudioError(null);
    setAnnouncement(`Đã chuyển đến thẻ ${targetIndex + 1} trên ${cards.length}.`);
    requestFocus("card");
  }

  async function finishNormalBatch() {
    if (mode !== "NORMAL" || !runState || !normalSession
      || !canCompleteNormalLearningSession(normalSession) || eventState === "pending") return;
    cancelPronunciation();
    setEventState("pending");
    setEventError(null);
    try {
      const result = await completeNormalLearningSession({
        storage: browserSessionStorage(),
        identity: { userId: user.id, setId, mode: "NORMAL" },
        state: normalSession,
        service: learningSessionService,
        randomUuid: () => window.crypto.randomUUID(),
      });
      setNormalSession(result.session_state);
      setNormalSessionStatus("COMPLETED");
      let nextState = selectNormalCard(runState, cards.at(-1).id, cards);
      nextState = completeNormalBatch(nextState);
      persist(nextState);
      setRevealed(false);
      setAudioError(null);
      setEventState("idle");
      setAnnouncement(`Đã hoàn thành phiên học. Chuỗi hiện tại ${result.streak.current_streak} ngày.`);
      requestFocus("summary");
    } catch (error) {
      if (await reconcileTerminalNormalMutation(error)) return;
      setEventState("error");
      setEventError("Chưa thể hoàn thành phiên. Dữ liệu đã ghi nhận được giữ nguyên để bạn thử lại.");
    }
  }

  async function reconcileTerminalNormalMutation(error) {
    if (!(error instanceof LearningSessionApiError)
      || !["LEARNING_SESSION_EXPIRED", "LEARNING_SESSION_INACCESSIBLE"].includes(error.code)
      || !normalSession) return false;
    try {
      const reconciled = await reconcileNormalLearningSession({
        storage: browserSessionStorage(),
        identity: { userId: user.id, setId, mode: "NORMAL" },
        state: normalSession,
        service: learningSessionService,
      });
      const expectedViewState = error.code === "LEARNING_SESSION_EXPIRED"
        ? "EXPIRED" : "INACCESSIBLE";
      if (reconciled.view_state !== expectedViewState) {
        throw new TypeError("Terminal Learning Session reconciliation did not confirm the rejection.");
      }
      setNormalSession(reconciled);
      setNormalSessionStatus(reconciled.view_state);
      setNormalRetryVocabularyId(null);
      setEventState("idle");
      setEventError(reconciled.view_state === "EXPIRED"
        ? "Phi\u00ean h\u1ecdc \u0111\u00e3 h\u1ebft h\u1ea1n. H\u00e3y b\u1eaft \u0111\u1ea7u l\u1ea1i nh\u00f3m t\u1eeb \u0111\u1ec3 ti\u1ebfp t\u1ee5c."
        : "B\u1ed9 t\u1eeb kh\u00f4ng c\u00f2n kh\u1ea3 d\u1ee5ng cho phi\u00ean n\u00e0y. H\u00e3y quay l\u1ea1i ho\u1eb7c b\u1eaft \u0111\u1ea7u l\u1ea1i sau khi c\u00f3 quy\u1ec1n truy c\u1eadp.");
      setAnnouncement(reconciled.view_state === "EXPIRED"
        ? "Phi\u00ean h\u1ecdc \u0111\u00e3 h\u1ebft h\u1ea1n. C\u1ea7n b\u1eaft \u0111\u1ea7u l\u1ea1i."
        : "Phi\u00ean h\u1ecdc kh\u00f4ng c\u00f2n truy c\u1eadp \u0111\u01b0\u1ee3c.");
      requestFocus("mode");
      return true;
    } catch {
      setEventState("error");
      setEventError("Tráº¡ng thÃ¡i phiÃªn Ä‘Ã£ thay Ä‘á»•i nhÆ°ng chÆ°a thá»ƒ Ä‘á»“ng bá»™. HÃ£y táº£i láº¡i trang.");
      return true;
    }
  }

  function continueNormalBatch() {
    if (mode !== "NORMAL" || !runState) return;
    const nextState = continueNormalRun(runState);
    if (nextState === runState) return;
    persist(nextState);
    clearLearningSessionState(browserSessionStorage(), { userId: user.id, setId, mode: "NORMAL" });
    setNormalSession(null);
    setNormalSessionStatus("idle");
    setRevealed(false);
    setAudioError(null);
    setAnnouncement("Đã chuyển sang nhóm từ tiếp theo.");
    requestFocus("card");
  }

  async function submitRating(rating, attempt = null) {
    if (mode !== "SRS" || !currentCard || !runState || eventState === "pending"
      || srsSession?.view_state !== "ACTIVE") return;
    if (!attempt && retryEvent) return;
    const nextAttempt = attempt ?? {
      event_id: window.crypto.randomUUID(), set_id: setId,
      session_id: srsSession.session_id,
      vocabulary_id: currentCard.id, expected_revision: currentCard.progress.revision, rating,
    };
    let pendingState = setSrsRetryContext(runState, nextAttempt);
    if (!saveLearningRunState(browserSessionStorage(), pendingState)) {
      setEventState("error");
      setEventError("Chưa thể lưu thao tác đánh giá để thử lại an toàn. Vui lòng tải lại trang.");
      return;
    }
    setRunState(pendingState);
    setEventState("pending");
    setEventError(null);
    setAnnouncement(`Đang ghi nhận: ${RATING_LABELS[rating]}.`);
    try {
      const accepted = await learningService.recordMeaningfulEvent(nextAttempt);
      const { reward, session } = accepted;
      const progress = Object.fromEntries(Object.entries(accepted).filter(([field]) => (
        !["reward", "session", "streak"].includes(field)
      )));
      const acceptedSession = acceptSrsRatingProjection({
        storage: browserSessionStorage(),
        identity: { userId: user.id, setId, mode: "SRS" },
        state: srsSession,
        backendSession: session,
      });
      setSrsSession(acceptedSession);
      setSrsSessionStatus(acceptedSession.view_state);
      setPayload((current) => ({
        ...current,
        cards: current.cards.map((card) => card.id === currentCard.id
          ? { ...card, progress: { ...card.progress, ...progress } } : card),
      }));
      const nextState = applySrsRating(pendingState, currentCard.id, rating, progress);
      const nextSummary = summarizeLearningRun(nextState);
      if (!saveLearningRunState(browserSessionStorage(), nextState)) {
        setRunState(pendingState);
        throw new TypeError("Accepted SRS result could not be persisted.");
      }
      setRunState(nextState);
      cancelPronunciation();
      setRevealed(false);
      setAudioError(null);
      setEventState("idle");
      const acceptedAnnouncement = rating === "AGAIN"
        ? "Đã ghi nhận Lại. Thẻ sẽ quay lại sau các lượt tiếp theo."
        : `${RATING_LABELS[rating]} đã được ghi nhận.`;
      setAnnouncement(acceptedAnnouncement);
      showXpRewardToast(reward, shownXpRewardEventsRef.current);
      requestFocus(nextSummary.completed ? "summary" : "card");
    } catch (error) {
      if (error instanceof LearningApiError
        && ["LEARNING_PROGRESS_CHANGED", "LEARNING_SET_ITEM_CHANGED"].includes(error.code)) {
        setEventState("conflict");
        setEventError("Phiên SRS đã thay đổi. Hãy làm mới để tiếp tục với dữ liệu hiện tại.");
      } else if (await reconcileTerminalSrsMutation(error)) return;
      else {
        setEventState("error");
        setEventError("Chưa thể ghi nhận đánh giá. Thẻ vẫn được giữ để bạn thử lại.");
      }
    }
  }

  async function reconcileTerminalSrsMutation(error) {
    if (!(error instanceof LearningApiError)
      || !["LEARNING_SESSION_EXPIRED", "LEARNING_SESSION_INACCESSIBLE"].includes(error.code)
      || !srsSession) return false;
    try {
      const reconciled = await reconcileSrsLearningSession({
        storage: browserSessionStorage(),
        identity: { userId: user.id, setId, mode: "SRS" },
        state: srsSession,
        service: learningSessionService,
      });
      const expected = error.code === "LEARNING_SESSION_EXPIRED" ? "EXPIRED" : "INACCESSIBLE";
      if (reconciled.view_state !== expected) throw new TypeError("Unexpected SRS session state.");
      setSrsSession(reconciled);
      setSrsSessionStatus(expected);
      setEventState("idle");
      setEventError(expected === "EXPIRED"
        ? "Phiên SRS đã hết hạn. Hãy bắt đầu lại để tiếp tục ôn tập."
        : "Bộ từ không còn khả dụng cho phiên SRS này.");
      requestFocus("mode");
      return true;
    } catch {
      setEventState("error");
      setEventError("Trạng thái phiên SRS đã thay đổi nhưng chưa thể đồng bộ. Hãy tải lại trang.");
      return true;
    }
  }

  function restartRun() {
    if (!runState || eventState === "pending") return;
    cancelPronunciation();
    if (mode === "SRS") {
      if (summary.presentation_count > 0
        && !window.confirm("Bắt đầu lại phiên SRS? Tiến độ đã lưu sẽ không bị xóa.")) return;
      restartSrsRef.current = true;
      clearLearningSessionState(browserSessionStorage(), { userId: user.id, setId, mode: "SRS" });
      setSrsSession(null);
      setSrsSessionStatus("idle");
      setStatus("loading");
      setReloadToken((value) => value + 1);
    } else {
      clearLearningSessionState(browserSessionStorage(), { userId: user.id, setId, mode: "NORMAL" });
      setNormalSession(null);
      setNormalSessionStatus("idle");
      persist(restartNormalRun(runState, allCards));
      setStatus("loading");
      setReloadToken((value) => value + 1);
      setRevealed(false);
      setAnnouncement("Đã trở về thẻ đầu tiên.");
      requestFocus("card");
    }
  }

  function continueSrsReview() {
    if (mode !== "SRS" || !runState || !summary.completed) return;
    restartSrsRef.current = true;
    clearLearningSessionState(browserSessionStorage(), { userId: user.id, setId, mode: "SRS" });
    setSrsSession(null);
    setSrsSessionStatus("idle");
    setStatus("loading");
    setReloadToken((value) => value + 1);
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
      utterance.onerror = () => setAudioError("Không thể phát âm từ này. Bạn vẫn có thể tiếp tục ôn tập.");
      window.speechSynthesis.speak(utterance);
    } catch {
      if (pronunciationRequestRef.current === requestId) {
        setAudioError("Không thể phát âm thanh mẫu. Bạn vẫn có thể tiếp tục ôn tập.");
      }
    }
  }

  function playFromSpeaker() {
    if (resolveFlashcardInteraction(revealed, "speaker").shouldPlayPronunciation) {
      void playPronunciation();
    }
  }

  function cancelPronunciation() {
    pronunciationRequestRef.current += 1;
    audioRef.current?.pause();
    audioRef.current = null;
    if (supportsSpeechSynthesis) window.speechSynthesis.cancel();
  }

  if (status !== "ready" || !payload || !runState || !summary
    || (mode === "SRS" && srsSessionStatus === "loading")) {
    return <LearningPageState status={status} onRetry={retryLoad} returnTo={returnTo} />;
  }

  const isSrsFinished = mode === "SRS" && summary.completed;
  const isUpToDate = mode === "SRS" && summary.up_to_date;
  if (isSrsFinished || isUpToDate) {
    return (
      <main className={`${PAGE_CLASSES} grid min-h-[min(38rem,calc(100vh_-_9rem))] place-items-center`}>
        <section className="w-full max-w-[36rem] rounded-[1.4rem] border border-[#d9e8f3] bg-white p-[clamp(1.5rem,5vw,2.5rem)] text-center shadow-[0_16px_36px_rgb(30_41_59/8%)]" role="status">
          <BookOpenCheck className="mx-auto size-14 rounded-2xl bg-[var(--accent-primary-soft)] p-3 text-[var(--accent-primary-pressed)]" aria-hidden="true" />
          <h1 ref={summaryHeadingRef} tabIndex={-1}>Hoàn thành ôn tập</h1>
          <p>{isSrsFinished ? `Đã hoàn thành ${summary.completed_count} / ${summary.total} từ trong phiên này.` : "Hiện chưa có từ nào đến hạn. Bạn có thể ôn tập thường hoặc quay lại bộ từ."}</p>
          {isUpToDate && payload.next_review_at ? <p>Lần ôn tập tiếp theo: {formatNextReview(payload.next_review_at)}</p> : null}
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" className={PRIMARY_BUTTON_CLASSES} onClick={() => switchMode("NORMAL")}>Ôn tập thường</button>
            {isSrsFinished ? <button type="button" className={SECONDARY_BUTTON_CLASSES} onClick={continueSrsReview}><RotateCcw aria-hidden="true" /> Ôn tiếp</button> : null}
            <Link className={SECONDARY_BUTTON_CLASSES} to={returnTo}>Quay lại bộ từ</Link>
          </div>
        </section>
      </main>
    );
  }

  if (mode === "NORMAL" && normalSummary?.batch_completed) {
    const isFullRunCompleted = normalSummary.full_run_completed;
    return (
      <main className={`${PAGE_CLASSES} grid min-h-[min(38rem,calc(100vh_-_9rem))] place-items-center`}>
        <section className="w-full max-w-[36rem] rounded-[1.4rem] border border-[#d9e8f3] bg-white p-[clamp(1.5rem,5vw,2.5rem)] text-center shadow-[0_16px_36px_rgb(30_41_59/8%)]" role="status" aria-atomic="true">
          <BookOpenCheck className="mx-auto size-14 rounded-2xl bg-[var(--accent-primary-soft)] p-3 text-[var(--accent-primary-pressed)]" aria-hidden="true" />
          <h1 ref={summaryHeadingRef} tabIndex={-1}>{isFullRunCompleted ? "Hoàn thành bộ từ" : "Hoàn thành phiên"}</h1>
          <p>{isFullRunCompleted ? "Bạn đã hoàn thành toàn bộ lượt học này." : "Nhóm từ hiện tại đã được hoàn thành."}</p>
          {announcement ? <p className="sr-only">{announcement}</p> : null}
          <div className="flex flex-wrap justify-center gap-3">
            {isFullRunCompleted
              ? <button type="button" className={PRIMARY_BUTTON_CLASSES} onClick={restartRun}>Học lại từ đầu</button>
              : <button type="button" className={PRIMARY_BUTTON_CLASSES} onClick={continueNormalBatch}>Học tiếp {normalSummary.next_batch_size} từ</button>}
            <Link className={SECONDARY_BUTTON_CLASSES} to={returnTo}>Quay lại bộ từ</Link>
          </div>
        </section>
      </main>
    );
  }

  if (!currentCard) return <LearningPageState status="error" onRetry={retryLoad} returnTo={returnTo} />;

  return (
    <main className="learning-page h-full min-h-0 w-full text-[#172554]" aria-labelledby="learning-page-title">
      <div className="flex h-full min-h-0 flex-col">
        <header className="learning-toolbar w-full shrink-0 border-b border-slate-200">
          <div className="learning-toolbar-inner mx-auto grid w-full max-w-[75rem] grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-x-4 gap-y-1.5 px-[clamp(0.8rem,3vw,2rem)] py-1.5 max-[900px]:grid-cols-[minmax(0,1fr)_auto] max-[700px]:py-1">
            <button type="button" className="inline-flex min-h-11 min-w-0 cursor-pointer items-center gap-2 justify-self-start border-0 bg-transparent px-0 font-extrabold text-slate-700 focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] disabled:cursor-not-allowed disabled:opacity-60" onClick={() => navigate(returnTo)} disabled={eventState === "pending"}><ArrowLeft aria-hidden="true" /><span className="max-w-52 truncate">{payload.name}</span></button>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-600 max-[900px]:col-start-1 max-[900px]:row-start-2 max-[900px]:justify-self-start max-[520px]:col-span-2 max-[520px]:justify-self-center" aria-label="Phím tắt học">
              <LearningKeyHint keyLabel="Space" label="Lật thẻ" />
              {mode === "NORMAL" ? <><LearningKeyHint keyLabel="←" label="Thẻ trước" /><LearningKeyHint keyLabel="→" label="Thẻ sau" /></> : null}
            </div>
            <div className="inline-flex min-h-11 justify-self-center rounded-xl border border-slate-300 bg-slate-100 p-1 max-[900px]:col-start-2 max-[900px]:row-start-2 max-[520px]:col-span-2 max-[520px]:col-start-1 max-[520px]:row-start-3" role="group" aria-label="Chế độ ôn tập">
              {[['SRS', 'Ôn tập SRS'], ['NORMAL', 'Ôn tập thường']].map(([value, label]) => (
                <button key={value} type="button" className={`min-h-11 cursor-pointer rounded-lg px-3 text-sm font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] disabled:cursor-not-allowed ${requestedMode === value ? "bg-white text-[var(--accent-primary-pressed)] shadow-sm" : "bg-transparent text-slate-600"}`} aria-pressed={requestedMode === value} onClick={() => switchMode(value)} disabled={eventState === "pending" || Boolean(pendingMode)}>{label}</button>
              ))}
            </div>
            <div className="group relative justify-self-end max-[900px]:col-start-2 max-[900px]:row-start-1">
              <button type="button" className="inline-flex size-11 cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white p-0 text-slate-700 transition-colors hover:not-disabled:border-[var(--accent-primary)] hover:not-disabled:bg-[var(--accent-primary-soft)] hover:not-disabled:text-[var(--accent-primary-pressed)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:size-[1.15rem]" onClick={restartRun} disabled={eventState === "pending"} aria-label={mode === "NORMAL" ? "Học lại từ đầu" : "Bắt đầu lại"} aria-describedby="learning-restart-tooltip"><RotateCcw aria-hidden="true" /></button>
              <span id="learning-restart-tooltip" role="tooltip" className="learning-restart-tooltip pointer-events-none absolute right-0 top-full z-20 mt-2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">{mode === "NORMAL" ? "Học lại từ đầu" : "Bắt đầu lại"}</span>
            </div>
          </div>
        </header>
        <h1 id="learning-page-title" ref={modeHeadingRef} tabIndex={-1} className="sr-only">{payload.name} — {mode === "SRS" ? "Ôn tập SRS" : "Ôn tập thường"}</h1>
        <div className="mx-auto flex min-h-0 w-full max-w-[40rem] flex-1 flex-col px-[clamp(0.8rem,3vw,2rem)] py-[clamp(0.55rem,1.5vw,0.85rem)] max-[700px]:px-[0.8rem] max-[700px]:py-[0.65rem]">
        <section className="learning-progress mb-[0.55rem] mt-[0.15rem] shrink-0" aria-label="Tiến độ bộ từ">
          <div className="mb-[0.3rem] flex items-center justify-between gap-4 text-[0.84rem] font-extrabold text-slate-600">
            <span>{mode === "SRS" ? "Tiến độ SRS" : "Tiến độ"}</span>
            <span>{mode === "SRS" ? `Đã hoàn thành ${summary.completed_count} / ${summary.total}` : `Thẻ ${currentIndex + 1} / ${cards.length}`}</span>
          </div>
          <progress className="h-[0.45rem] w-full overflow-hidden rounded-full border-0 bg-slate-200 accent-[var(--accent-primary)]" value={mode === "SRS" ? summary.completed_count : currentIndex + 1} max={mode === "SRS" ? summary.total : cards.length}>{mode === "SRS" ? summary.completed_count : currentIndex + 1}/{mode === "SRS" ? summary.total : cards.length}</progress>
        </section>
        <div className="sr-only" aria-atomic="true" aria-live="polite" role="status">{announcement}</div>
        {eventError ? <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800" role="alert"><span>{eventError}</span>{mode === "NORMAL" && normalRetryVocabularyId === currentCard?.id ? <button className={SECONDARY_BUTTON_CLASSES} type="button" onClick={() => void revealNormalAnswer(true)}>Thử lại ghi nhận</button> : mode === "NORMAL" && ["EXPIRED", "INACCESSIBLE"].includes(normalSessionStatus) ? <button className={SECONDARY_BUTTON_CLASSES} type="button" onClick={restartRun}>Bắt đầu lại</button> : mode === "NORMAL" && normalSessionStatus === "error" ? <button className={SECONDARY_BUTTON_CLASSES} type="button" onClick={retryLoad}>Thử lại phiên học</button> : mode === "SRS" && ["EXPIRED", "INACCESSIBLE"].includes(srsSessionStatus) ? <button className={SECONDARY_BUTTON_CLASSES} type="button" onClick={restartRun}>Bắt đầu lại</button> : eventState === "conflict" ? <button className={SECONDARY_BUTTON_CLASSES} type="button" onClick={retryLoad}>Làm mới phiên SRS</button> : retryEvent ? <button className={SECONDARY_BUTTON_CLASSES} type="button" onClick={() => void submitRating(retryEvent.rating, retryEvent)}>Thử lại</button> : null}</div> : null}
        {audioError ? <p className="m-0 mb-2 text-sm text-amber-700" role="status">{audioError}</p> : null}
        <div key={`${mode}:${currentCard.id}`} className="learning-flip-stage relative grid min-h-[22rem] w-full shrink-0 cursor-pointer self-center lg:min-h-96 max-[700px]:min-h-56" onClick={handleCardClick}>
          <div className={`learning-card-flipper relative grid min-h-0 min-w-0 rounded-3xl border border-[#b9dcf6] bg-white shadow-[0_16px_36px_rgb(30_41_59/8%)] focus-within:ring-1 focus-within:ring-[var(--accent-primary-focus)] max-[700px]:rounded-[1.1rem] ${revealed ? "is-revealed" : ""}`}>
            <section className="learning-card relative flex min-h-0 min-w-0 w-full flex-col rounded-[inherit] p-[clamp(1.1rem,2.5vw,1.75rem)] max-[700px]:p-4" aria-labelledby="learning-card-word" aria-hidden={revealed} inert={revealed || undefined}>
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
            <section className="learning-card learning-card-back relative min-h-0 min-w-0 w-full rounded-[inherit] p-[clamp(1rem,2.2vw,1.5rem)] max-[700px]:p-4" aria-labelledby={`meaning-${primaryMeaning?.id ?? "unavailable"}`} aria-hidden={!revealed} inert={!revealed || undefined}>
              <header className="border-b border-slate-200 pb-2">
                <div className="flex max-w-full items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className={`m-0 min-w-0 max-w-full [overflow-wrap:anywhere] text-left font-black leading-none text-[var(--accent-primary-pressed)] ${wordSizeClasses(currentCard.word.length, true)}`}>{currentCard.word}</h2>
                    {currentCard.phonetic ? <p className="mb-0 mt-[0.3rem] text-left text-[clamp(1rem,2vw,1.25rem)] text-slate-500">{currentCard.phonetic}</p> : null}
                  </div>
                  {currentCard.pronunciation_url || supportsSpeechSynthesis ? <button type="button" className={AUDIO_BUTTON_CLASSES} onClick={playFromSpeaker} disabled={eventState === "pending"} aria-label={`Phát âm từ ${currentCard.word}`} title="Phát âm"><Volume2 aria-hidden="true" /></button> : null}
                </div>
                {primaryMeaning ? <div className="mt-[0.4rem] flex flex-wrap gap-2 [&_span]:rounded-full [&_span]:bg-[var(--accent-primary-soft)] [&_span]:px-[0.65rem] [&_span]:py-[0.3rem] [&_span]:text-[0.78rem] [&_span]:font-extrabold [&_span]:text-[var(--accent-primary-pressed)]"><span>{primaryMeaning.part_of_speech}</span>{primaryMeaning.cefr_level ? <span>{primaryMeaning.cefr_level}</span> : null}</div> : null}
              </header>
              <div className="m-0 max-w-[43rem] pt-[0.65rem]">
                {primaryMeaning ? (
                  <article aria-labelledby={`meaning-${primaryMeaning.id}`}>
                    <h3 className="m-0 text-[clamp(1.45rem,3.2vw,2rem)] leading-[1.3] text-slate-900 focus-visible:outline-0" id={`meaning-${primaryMeaning.id}`} ref={answerHeadingRef} tabIndex={-1}>{primaryMeaning.meaning_vi}</h3>
                    {primaryMeaning.context ? <p className="my-[0.45rem] border-l-[3px] border-[#a9d5f4] pl-[0.75rem] leading-[1.55] text-slate-600">Ngữ cảnh: {primaryMeaning.context}</p> : null}
                    {primaryMeaning.examples.length > 0 ? <div className="mt-2"><h4 className="m-0 text-[0.9rem] text-slate-700">Ví dụ</h4><ul className="mb-0 mt-[0.3rem] grid list-none gap-[0.4rem] p-0">{primaryMeaning.examples.slice(0, 1).map((example) => <li className="rounded-xl bg-slate-100 px-3 py-[0.45rem]" key={example.id}><p className="m-0 font-bold leading-[1.5] text-slate-800">{example.example_en}</p>{example.example_vi ? <span className="mt-1 block leading-[1.45] text-slate-500">{example.example_vi}</span> : null}</li>)}</ul></div> : null}
                  </article>
                ) : <p id="meaning-unavailable">Chưa có nghĩa phù hợp để hiển thị.</p>}
              </div>
            </section>
          </div>
          {pendingMode || (mode === "NORMAL" && normalSessionStatus === "idle") ? <div className="absolute inset-0 z-10 grid place-items-center rounded-3xl bg-white/85 text-[var(--accent-primary-pressed)] backdrop-blur-[1px]" role="status" aria-live="polite"><span className="inline-flex items-center gap-2 font-extrabold"><LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> {pendingMode ? "Đang chuyển chế độ…" : "Đang chuẩn bị phiên học…"}</span></div> : null}
        </div>
        <div className="mt-3 grid min-h-[3.35rem] shrink-0 place-items-center">
          {mode === "SRS" ? revealed ? (
            <section className="grid w-full grid-cols-4 gap-2 max-[520px]:grid-cols-2" aria-label="Đánh giá SRS">
              {Object.entries(RATING_LABELS).map(([rating, label]) => {
                const preview = currentCard.rating_previews[rating];
                const subLabel = rating === "AGAIN"
                  ? "Trong phiên này"
                  : RATING_INTERVAL_LABELS[preview.interval_days];
                return <button key={rating} type="button" className={`${RATING_BUTTON_CLASSES[rating]} relative h-14 min-w-0 w-full flex-col gap-0.5 rounded-xl bg-white px-2 py-2 shadow-none`} aria-label={`${label}, ${subLabel}`} onClick={() => void submitRating(rating)} disabled={eventState === "pending" || Boolean(pendingMode) || Boolean(retryEvent) || srsSessionStatus !== "ACTIVE"} aria-busy={pendingRating === rating}>{pendingRating === rating ? <LoaderCircle className="absolute right-2 top-2 size-4 animate-spin" aria-hidden="true" /> : null}<span className="font-extrabold leading-tight">{label}</span><span className="text-[0.72rem] font-semibold leading-tight opacity-80">{subLabel}</span></button>;
              })}
            </section>
          ) : <p className="m-0 text-sm text-slate-500">Lật thẻ để chọn mức độ ghi nhớ.</p> : (
            <nav className="grid w-full max-w-sm grid-cols-2 gap-3" aria-label="Điều hướng thẻ"><button type="button" className={PREVIOUS_BUTTON_CLASSES} onClick={() => navigateNormal(currentIndex - 1)} disabled={currentIndex === 0 || Boolean(pendingMode) || eventState === "pending"}><span className="inline-flex items-center gap-2"><ArrowLeft aria-hidden="true" /> Thẻ trước</span><span className="text-xs font-medium opacity-70">Key: ←</span></button>{currentIndex === cards.length - 1 ? <button type="button" className={NEXT_BUTTON_CLASSES} onClick={finishNormalBatch} disabled={Boolean(pendingMode) || eventState === "pending" || !canCompleteNormalLearningSession(normalSession)}>Hoàn thành phiên</button> : <button type="button" className={NEXT_BUTTON_CLASSES} onClick={() => navigateNormal(currentIndex + 1)} disabled={Boolean(pendingMode) || eventState === "pending"}><span className="inline-flex items-center gap-2">Thẻ sau <ArrowRight aria-hidden="true" /></span><span className="text-xs font-medium opacity-80">Key: →</span></button>}</nav>
          )}
        </div>
        </div>
      </div>
    </main>
  );
}

function LearningKeyHint({ keyLabel, label }) {
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><kbd className="min-w-6 rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-center font-mono text-[0.68rem] font-bold leading-4 text-slate-700 shadow-sm">{keyLabel}</kbd><span className="text-[15px] font-medium">{label}</span></span>;
}

function browserSessionStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function formatNextReview(value) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function LearningPageState({ onRetry, returnTo, status }) {
  const content = {
    loading: ["Đang chuẩn bị phiên ôn tập", "Nội dung bộ từ đang được tải."],
    empty: ["Bộ từ chưa có nội dung", "Hãy thêm từ vựng trước khi bắt đầu."],
    "not-found": ["Không tìm thấy bộ từ có thể học", "Bộ từ không tồn tại hoặc bạn không có quyền truy cập."],
    error: ["Không thể tải phiên ôn tập", "Vui lòng kiểm tra kết nối và thử lại."],
  }[status] ?? ["Không thể mở phiên ôn tập", "Vui lòng quay lại và thử lại."];
  return <main className={`${PAGE_CLASSES} grid min-h-[min(38rem,calc(100vh_-_9rem))] place-items-center`}><section className="w-full max-w-[34rem] rounded-[1.4rem] border border-[#d9e8f3] bg-white p-8 text-center" role={status === "loading" ? "status" : "alert"}><BookOpenCheck className="mx-auto size-14" aria-hidden="true" /><h1>{content[0]}</h1><p>{content[1]}</p><div className="flex justify-center gap-3">{status === "error" ? <button type="button" className={PRIMARY_BUTTON_CLASSES} onClick={onRetry}>Thử lại</button> : null}<Link className={SECONDARY_BUTTON_CLASSES} to={returnTo}>Quay lại bộ từ</Link></div></section></main>;
}
