import { ArrowLeft, ArrowRight, BookOpenCheck, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuthentication } from "../auth/use-authentication.js";
import { LoadingIndicator } from "../components/loading-indicator.jsx";
import {
  createReferencePlaybackCoordinator,
  REFERENCE_PLAYBACK_ISSUES,
} from "../pronunciation/reference-playback-coordinator.js";
import { LearningApiError, learningService } from "../services/learning-service.js";
import { LearningSessionApiError, learningSessionService } from "../services/learning-session-service.js";
import { LearningPathApiError, learningPathService } from "../services/learning-path-service.js";
import { clearLearningSessionState, loadLearningSessionState } from "../session-storage/learning-session-state.js";
import { showXpRewardToast } from "../components/xp-reward-notification.js";
import {
  acknowledgeNormalReveal,
  acceptPassLinkedNormalSession,
  canCompleteNormalLearningSession,
  completeNormalLearningSession,
  openNormalLearningSession,
  prepareFreshNormalLearningSession,
  persistNormalLearningCursor,
  reconcileNormalLearningSession,
} from "./normal-learning-session.js";
import { runPathOperation } from "./learning-path-run.js";
import {
  FlashcardCard,
  FlashcardProgress,
  FlashcardToolbar,
  SrsRatingControls,
} from "./flashcard-presentation.jsx";
import {
  acceptSrsRatingProjection,
  openPassLinkedSrsSession,
  openSrsLearningSession,
  reconcileSrsLearningSession,
} from "./srs-learning-session.js";
import {
  ordinarySrsPresentation,
  preserveOrdinarySrsRating,
  readOrdinarySrsRatingAttempts,
  recoverOrdinarySrsSession,
  settleOrdinarySrsRating,
} from "./ordinary-srs-recovery.js";
import {
  isKeyboardShortcutSafe,
  pendingLearningRating,
  resolveFlashcardInteraction,
  revealWithPronunciation,
  selectPrimaryMeaning,
  SRS_INTERVAL_LABELS as RATING_INTERVAL_LABELS,
  SRS_RATING_LABELS as RATING_LABELS,
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
  startIndependentNormalRun,
  summarizeLearningRun,
  summarizeNormalRun,
} from "./learning-run-state.js";

const PAGE_CLASSES = "learning-page mx-auto h-full min-h-0 w-full max-w-[75rem] px-[clamp(0.8rem,3vw,2rem)] py-[clamp(0.55rem,1.5vw,0.85rem)] text-[#172554] max-[700px]:px-[0.8rem] max-[700px]:py-[0.65rem]";
const BUTTON_CLASSES = "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[0.8rem] border border-transparent px-4 py-[0.7rem] font-[inherit] font-extrabold no-underline transition-[transform,box-shadow,background-color] duration-150 hover:not-disabled:-translate-y-px focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] disabled:cursor-not-allowed disabled:opacity-[0.58] motion-reduce:transform-none motion-reduce:transition-none [&_svg]:size-[1.1rem]";
const PRIMARY_BUTTON_CLASSES = `${BUTTON_CLASSES} bg-[var(--accent-primary)] text-white shadow-[0_4px_12px_rgb(76_162_230/16%)] hover:not-disabled:bg-[var(--accent-primary-hover)] active:bg-[var(--accent-primary-pressed)]`;
const SECONDARY_BUTTON_CLASSES = `${BUTTON_CLASSES} border-slate-300 bg-white text-slate-700`;
const PREVIOUS_BUTTON_CLASSES = `${BUTTON_CLASSES} h-14 w-full min-w-0 flex-col gap-0.5 whitespace-nowrap !rounded-2xl !border-[#f97316] bg-white px-2 py-1 !font-semibold text-[#f97316] hover:not-disabled:bg-orange-50 focus-visible:ring-orange-200 active:bg-orange-100 disabled:!border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-100`;
const NEXT_BUTTON_CLASSES = `${BUTTON_CLASSES} h-14 w-full min-w-0 flex-col gap-0.5 whitespace-nowrap !rounded-2xl !border-[#7ed321] bg-[#7ed321] px-2 py-1 !font-semibold text-white shadow-[0_4px_12px_rgb(126_211_33/18%)] hover:not-disabled:!border-[#6fbd1d] hover:not-disabled:bg-[#6fbd1d] focus-visible:ring-lime-200 active:!border-[#5da117] active:bg-[#5da117] disabled:!border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none disabled:opacity-100`;
export function LearningFoundationPage({ reviewContext = false }) {
  const { setId } = useParams();
  const { user } = useAuthentication();
  return <LearningFoundation key={JSON.stringify([user.id, setId, reviewContext])} {...{ user, setId, reviewContext }} />;
}

function LearningFoundation({ user, setId, reviewContext }) {
  const location = useLocation();
  const navigate = useNavigate();
  const sessionIntent = reviewContext ? "DUE_ONLY" : "STANDARD";
  const freshDueOnlyRequestRef = useRef(
    reviewContext && location.state?.learningIntent === "FRESH_DUE_ONLY",
  );
  const storedAtEntry = useMemo(
    () => loadLearningRunState(browserSessionStorage(), user.id, setId, sessionIntent),
    [setId, sessionIntent, user.id],
  );
  const freshNormalIntent = !reviewContext && location.state?.learningIntent === "FRESH_NORMAL";
  const openSrsIntent = !reviewContext && location.state?.learningIntent === "OPEN_SRS";
  const continueOrdinarySrs = !reviewContext && location.state?.learningIntent === "CONTINUE_SRS";
  const [mode, setMode] = useState(reviewContext
    ? "SRS"
    : continueOrdinarySrs || openSrsIntent ? "SRS"
      : location.state?.learningPathAction || freshNormalIntent
      ? "NORMAL"
      : storedAtEntry?.version === 3 ? storedAtEntry.active_mode : "SRS");
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
  const [pathPass, setPathPass] = useState(null);
  const [pathPassStatus, setPathPassStatus] = useState(continueOrdinarySrs ? "legacy" : freshNormalIntent ? "loading" : "idle");
  const [pathCompletion, setPathCompletion] = useState(null);
  const [srsSession, setSrsSession] = useState(null);
  const [srsSessionStatus, setSrsSessionStatus] = useState("idle");
  const [ordinarySrsAttempts, setOrdinarySrsAttempts] = useState([]);
  const [recoveryPending, setRecoveryPending] = useState(false);
  const [recoveryError, setRecoveryError] = useState(null);
  const [audioError, setAudioError] = useState(null);
  const [announcement, setAnnouncement] = useState("");
  const [focusTarget, setFocusTarget] = useState(null);
  const restartSrsRef = useRef(false);
  const ordinaryActionRef = useRef(null);
  const mountedRef = useRef(false);
  const recoveryPayloadRef = useRef(null);
  const modeTransitionRef = useRef(false);
  const freshNormalInitializationRef = useRef(false);
  const freshNormalConsumedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      ordinaryActionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!freshDueOnlyRequestRef.current) return;
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, navigate]);
  const shownXpRewardEventsRef = useRef(new Set());
  const cardHeadingRef = useRef(null);
  const answerHeadingRef = useRef(null);
  const summaryHeadingRef = useRef(null);
  const modeHeadingRef = useRef(null);
  const normalPendingStatusRef = useRef(null);
  const normalRetryButtonRef = useRef(null);
  const normalProgressionButtonRef = useRef(null);
  const normalMutationFocusIntentRef = useRef(false);
  const returnTo = reviewContext ? "/review" : location.state?.returnTo ?? "/my/vocabulary-sets";
  const supportsSpeechSynthesis = typeof window !== "undefined"
    && typeof window.speechSynthesis?.speak === "function"
    && typeof window.SpeechSynthesisUtterance === "function";
  const pronunciationCoordinator = useMemo(() => createReferencePlaybackCoordinator({
    speechSynthesis: supportsSpeechSynthesis ? window.speechSynthesis : null,
    createUtterance: supportsSpeechSynthesis
      ? (text) => new window.SpeechSynthesisUtterance(text)
      : null,
    onStateChange: ({ issue }) => {
      if (issue === REFERENCE_PLAYBACK_ISSUES.PLAYBACK_FAILED) {
        setAudioError("Không thể phát âm từ này. Bạn vẫn có thể tiếp tục ôn tập.");
      } else if (issue === REFERENCE_PLAYBACK_ISSUES.NO_PLAYBACK_AVAILABLE) {
        setAudioError("Trình duyệt không hỗ trợ phát âm từ này. Bạn vẫn có thể tiếp tục ôn tập.");
      } else {
        setAudioError(null);
      }
    },
  }), [supportsSpeechSynthesis]);

  const requestedMode = pendingMode ?? mode;

  useEffect(() => {
    let active = true;
    void learningService.getLearningSet(setId, { mode: requestedMode }).then((freshPayload) => {
      if (!active) return;
      const storage = browserSessionStorage();
      const stored = loadLearningRunState(storage, user.id, setId, sessionIntent);
      let preserveSrsQueue = false;
      if (requestedMode === "SRS" && sessionIntent === "STANDARD") {
        const identity = { userId: user.id, setId, mode: "SRS", sessionIntent };
        const reference = loadLearningSessionState(storage, identity);
        const retry = stored?.srs.retry_context;
        preserveSrsQueue = Boolean(reference
          && (!stored?.srs.session_id || stored.srs.session_id === reference.session_id));
        setOrdinarySrsAttempts(retry && retry.session_id === reference?.session_id
          ? preserveOrdinarySrsRating(storage, identity, retry)
          : readOrdinarySrsRatingAttempts(storage, identity));
      }
      let nextState = reconcileLearningRunState(stored, user.id, setId, freshPayload, { preserveSrsQueue });
      nextState = selectLearningMode(nextState, requestedMode);
      if (requestedMode === "SRS" && restartSrsRef.current) {
        nextState = restartSrsRun(nextState, freshPayload);
        restartSrsRef.current = false;
      }
      saveLearningRunState(browserSessionStorage(), nextState, sessionIntent);
      setPayload(freshPayload);
      setRunState(nextState);
      setMode(requestedMode);
      if (requestedMode === "SRS") setSrsSessionStatus("loading");
      else setPathCompletion(null);
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
    }).catch((error) => {
      if (!active) return;
      if (modeTransitionRef.current) {
        modeTransitionRef.current = false;
        setPendingMode(null);
        setEventError("Không thể chuyển chế độ ôn tập. Vui lòng thử lại.");
        return;
      }
      if (error instanceof LearningApiError && error.code === "CEFR_LEVEL_LOCKED") setStatus("locked");
      else if (error instanceof LearningApiError && error.code === "LEARNING_SET_EMPTY") setStatus("empty");
      else if (error instanceof LearningApiError && error.kind === "not-found") setStatus("not-found");
      else setStatus("error");
    });
    return () => {
      active = false;
      pronunciationCoordinator.cancel();
    };
  }, [pronunciationCoordinator, reloadToken, requestedMode, sessionIntent, setId, user.id]);

  useEffect(() => {
    if (status !== "ready" || !payload || reviewContext || continueOrdinarySrs
      || payload === recoveryPayloadRef.current) return undefined;
    if (freshNormalConsumedRef.current && !freshNormalIntent) return undefined;
    if (pathPass?.set_id === setId) return undefined;
    let active = true;
    async function handleIndependentFallback() {
      setPathPass(null);
      if (freshNormalIntent) {
        if (freshNormalInitializationRef.current) return;
        freshNormalInitializationRef.current = true;
        try {
          await prepareFreshNormalLearningSession({
            storage: browserSessionStorage(),
            identity: { userId: user.id, setId, mode: "NORMAL" },
            service: learningSessionService,
          });
        } catch {
          if (!active) return;
          freshNormalInitializationRef.current = false;
          setPathPassStatus("error");
          setEventError("Chưa thể bắt đầu lượt học mới an toàn. Vui lòng thử lại để khôi phục phiên đang chờ.");
          return;
        }
        if (!active) return;
        setNormalSession(null);
        setNormalSessionStatus("idle");
        setRunState((current) => {
          const freshRun = startIndependentNormalRun(current, payload.cards);
          saveLearningRunState(browserSessionStorage(), freshRun, sessionIntent);
          return freshRun;
        });
        freshNormalConsumedRef.current = true;
        navigate(location.pathname, { replace: true, state: null });
      }
      setPathPassStatus("legacy");
    }
    void runPathOperation({
      storage: browserSessionStorage(), userId: user.id, setId, kind: "START",
      randomUuid: () => window.crypto.randomUUID(),
      execute: (operationId) => learningPathService.startPass(setId, operationId),
    }).then(({ pass }) => {
      if (!active) return;
      setPathPass(pass);
      setPathPassStatus(pass.can_continue === false ? "restart-required" : "managed");
    }).catch((error) => {
      if (!active) return;
      if (error instanceof LearningPathApiError && error.code === "CEFR_SET_ALREADY_COMPLETED") {
        void handleIndependentFallback();
        return;
      }
      if (error instanceof LearningPathApiError && error.code === "CEFR_PASS_NOT_FOUND") {
        void handleIndependentFallback();
        return;
      }
      if (error instanceof LearningPathApiError && error.code === "CEFR_LEVEL_LOCKED") {
        setPathPassStatus("locked");
        setEventError("Bộ từ này thuộc cấp độ CEFR chưa được mở khóa. Bạn vẫn có thể xem chi tiết hoặc học một bản sao riêng.");
        return;
      }
      if (error instanceof LearningPathApiError && error.code === "CEFR_PASS_RESTART_REQUIRED") {
        const recommendationPassId = location.state?.passId;
        if (typeof recommendationPassId === "string") {
          void learningPathService.readPass(recommendationPassId).then((pass) => {
            if (!active) return;
            setPathPass(pass);
            setPathPassStatus("restart-required");
          }).catch(() => {
            if (active) setPathPassStatus("error");
          });
        } else {
          setPathPassStatus("error");
        }
        setEventError("Nội dung bộ từ đã thay đổi. Hãy mở lại lượt học từ Dashboard để bắt đầu lại an toàn.");
        return;
      }
      setPathPassStatus("error");
      setEventError("Chưa thể chuẩn bị lượt học CEFR. Vui lòng thử lại.");
    });
    return () => { active = false; };
  }, [continueOrdinarySrs, freshNormalIntent, location.pathname, location.state?.passId, navigate, pathPass?.id, pathPass?.set_id, pathPass?.state, payload, reviewContext, sessionIntent, setId, status, user.id]);

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
  const ordinarySrs = mode === "SRS" && !reviewContext && pathPassStatus === "legacy";
  const modeRetry = runState?.srs.retry_context;
  const currentOrdinaryAttempt = ordinarySrsAttempts.find(({ request, superseded }) => (
    !superseded && request.session_id === srsSession?.session_id
  ))?.request ?? (modeRetry && modeRetry.session_id === srsSession?.session_id
    && !ordinarySrsAttempts.some(({ request }) => request.event_id === modeRetry.event_id) ? modeRetry : null);
  const retryEvent = ordinarySrs
    ? (currentOrdinaryAttempt?.vocabulary_id === currentId ? currentOrdinaryAttempt : null)
    : modeRetry?.session_id === srsSession?.session_id ? modeRetry ?? null : null;
  const pendingRating = pendingLearningRating(eventState, retryEvent);
  useEffect(() => {
    if (status !== "ready" || mode !== "NORMAL" || !runState || cards.length === 0
      || ["idle", "loading", "locked", "error", "restart-required"].includes(pathPassStatus)
      || normalSession?.view_state === "COMPLETED") {
      return undefined;
    }
    let active = true;
    const identity = {
      userId: user.id, setId, mode: "NORMAL",
      ...(pathPassStatus === "managed" && pathPass ? { passId: pathPass.id } : {}),
    };
    const openSession = pathPassStatus === "managed" && pathPass
      ? runPathOperation({
        storage: browserSessionStorage(), userId: user.id, setId, passId: pathPass.id, kind: "NEXT_SESSION",
        randomUuid: () => window.crypto.randomUUID(),
        execute: (operationId) => learningPathService.createNextSession(pathPass.id, operationId, "NORMAL"),
      }).then((result) => result.session === null ? null : acceptPassLinkedNormalSession({
        storage: browserSessionStorage(), identity, session: result.session,
      }))
      : openNormalLearningSession({
      storage: browserSessionStorage(), identity,
      vocabularyIds: cards.map(({ id }) => id),
      service: learningSessionService,
      randomUuid: () => window.crypto.randomUUID(),
    });
    void openSession.then((sessionState) => {
      if (!active) return;
      if (sessionState === null) {
        setNormalSession(null);
        setNormalSessionStatus("PASS_READY_TO_COMPLETE");
        requestFocus("summary");
        return;
      }
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
        const currentBatchIds = new Set(proposedCards.map(({ id }) => id));
        let resumedRun = runState;
        if (!sessionState.item_ids.some((id) => currentBatchIds.has(id)) && proposedCards.length > 0) {
          resumedRun = selectNormalCard(resumedRun, proposedCards.at(-1).id, proposedCards);
          resumedRun = continueNormalRun(completeNormalBatch(resumedRun));
        }
        persist(selectNormalCard(resumedRun, sessionState.cursor_vocabulary_id, authoritativeCards));
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
  }, [mode, normalSession?.view_state, pathPass?.id, pathPassStatus, status, setId, user.id, cards.map(({ id }) => id).join(":")]);

  useEffect(() => {
    if (status !== "ready" || mode !== "SRS" || !runState
      || (!reviewContext && !["managed", "legacy"].includes(pathPassStatus))) return undefined;
    let active = true;
    const managed = !reviewContext && pathPassStatus === "managed" && pathPass;
    const exactSrsSessionId = managed
      ? pathPass.active_sessions.SRS.filter(({ exact_resume_available: exact }) => exact).at(-1)?.id ?? null
      : null;
    const identity = {
      userId: user.id, setId, mode: "SRS", sessionIntent,
      ...(managed ? { passId: pathPass.id } : {}),
    };
    const opening = managed
      ? openPassLinkedSrsSession({
        storage: browserSessionStorage(), identity, passId: pathPass.id,
        exactSessionId: exactSrsSessionId,
        pathService: learningPathService, sessionService: learningSessionService,
        runOperation: runPathOperation, randomUuid: () => window.crypto.randomUUID(),
      })
      : openSrsLearningSession({
        storage: browserSessionStorage(), identity,
        service: learningSessionService, randomUuid: () => window.crypto.randomUUID(),
        refreshUnanswered: freshDueOnlyRequestRef.current,
      }).then((result) => reviewContext ? result
        : { session_state: result, cards: null, evaluated_at: null });
    freshDueOnlyRequestRef.current = false;
    void opening.then((opened) => {
      if (!active) return;
      const sessionState = opened.session_state;
      let activeRun = runState;
      if ((managed || reviewContext) && opened.cards) {
        const authoritativePayload = {
          ...payload,
          ...(opened.set_name ? { name: opened.set_name } : {}),
          mode: "SRS",
          cards: opened.cards,
          eligible_count: opened.cards.length,
          evaluated_at: opened.evaluated_at ?? payload.evaluated_at,
          next_review_at: null,
        };
        activeRun = reconcileLearningRunState(runState, user.id, setId, authoritativePayload);
        setPayload(authoritativePayload);
      }
      setSrsSession(sessionState);
      if (!managed && !reviewContext && sessionState?.view_state === "ACTIVE") {
        const presentation = ordinarySrsPresentation(sessionState, payload);
        if (presentation !== "ACTIVE") {
          setSrsSessionStatus(presentation);
          requestFocus("summary");
          return;
        }
      }
      setSrsSessionStatus(sessionState?.view_state ?? (opened.reason === "PASS_READY_TO_COMPLETE"
        ? "PASS_READY_TO_COMPLETE" : "UP_TO_DATE"));
      if (!sessionState) {
        if (reviewContext) persist(restartSrsRun(activeRun, { cards: [], evaluated_at: payload.evaluated_at }));
        if (opened.reason === "PASS_READY_TO_COMPLETE") requestFocus("summary");
        return;
      }
      const reconciledRun = reconcileSrsSessionRun(activeRun, sessionState);
      persist(reconciledRun);
      const unresolved = ordinarySrs
        ? ordinarySrsAttempts.some(({ request, superseded }) => !superseded
          && request.session_id === sessionState.session_id
          && request.vocabulary_id === currentSrsVocabularyId(reconciledRun))
        : reconciledRun.srs.retry_context;
      if (unresolved && sessionState.view_state === "ACTIVE") {
        setEventState("error");
        setEventError("Có một đánh giá chưa xác định kết quả. Hãy thử lại đúng thao tác trước khi tiếp tục.");
      }
      if (sessionState.view_state === "COMPLETED") requestFocus("summary");
      else if (sessionState.view_state === "ACTIVE") requestFocus("card");
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
  }, [mode, pathPass?.id, pathPassStatus, reviewContext, sessionIntent, status, setId, user.id]);

  useEffect(() => {
    if (!focusTarget) return;
    const target = focusTarget.kind === "answer" ? answerHeadingRef.current
      : focusTarget.kind === "summary" ? summaryHeadingRef.current
        : focusTarget.kind === "mode" ? modeHeadingRef.current : cardHeadingRef.current;
    target?.focus();
  }, [focusTarget]);

  useEffect(() => {
    if (!normalMutationFocusIntentRef.current || mode !== "NORMAL") return;
    if (eventState === "pending") {
      normalPendingStatusRef.current?.focus({ preventScroll: true });
      return;
    }
    if (eventState === "error" && normalRetryVocabularyId) {
      normalRetryButtonRef.current?.focus();
      normalMutationFocusIntentRef.current = false;
      return;
    }
    if (eventState === "idle" && normalRetryVocabularyId === null && revealed) {
      normalProgressionButtonRef.current?.focus();
      normalMutationFocusIntentRef.current = false;
    }
  }, [eventState, mode, normalRetryVocabularyId, revealed]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (status !== "ready" || pendingMode || !currentCard || eventState === "pending"
        || (!isKeyboardShortcutSafe(event.target) && !isNormalNavigationArrow(event))) return;
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
    function isNormalNavigationArrow(event) {
      return mode === "NORMAL"
        && ["ArrowLeft", "ArrowRight"].includes(event.key)
        && Boolean(event.target?.closest?.('nav[aria-label="Điều hướng thẻ"]'));
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  function persist(nextState) {
    setRunState(nextState);
    saveLearningRunState(browserSessionStorage(), nextState, sessionIntent);
  }

  function requestFocus(kind) { setFocusTarget({ kind, nonce: Date.now() }); }
  function retryLoad() {
    setStatus("loading");
    setEventError(null);
    setReloadToken((value) => value + 1);
  }

  async function recoverSrs() {
    if (!ordinarySrs || srsSessionStatus !== "ACTIVE_SNAPSHOT_UNAVAILABLE" || ordinaryActionRef.current
      || eventState === "pending") return;
    const action = {};
    ordinaryActionRef.current = action;
    const isCurrent = () => ordinaryActionRef.current === action;
    const identity = learningSessionIdentity("SRS");
    setRecoveryPending(true);
    setRecoveryError(null);
    try {
      const result = await recoverOrdinarySrsSession({
        storage: browserSessionStorage(), identity, originalId: srsSession.session_id,
        sessionService: learningSessionService,
        readCards: () => learningService.getLearningSet(setId, { mode: "SRS" }),
        randomUuid: () => window.crypto.randomUUID(), isCurrent,
      });
      if (!isCurrent() || !result) return;
      recoveryPayloadRef.current = result.payload;
      setPayload(result.payload);
      setSrsSession(result.session);
      setSrsSessionStatus(["EXPIRED", "INACCESSIBLE"].includes(result.presentation)
        ? `RECOVERY_${result.presentation}` : result.presentation);
      let needsRetry = false;
      if (["ACTIVE", "COMPLETED"].includes(result.presentation)) {
        const reconciled = reconcileSrsSessionRun(runState, result.session);
        persist(reconciled);
        needsRetry = result.presentation === "ACTIVE" && ordinarySrsAttempts.some(({ request, superseded }) => (
          !superseded && request.session_id === result.session.session_id
          && request.vocabulary_id === currentSrsVocabularyId(reconciled)
        ));
      }
      setRevealed(false);
      setEventState(needsRetry ? "error" : "idle");
      setEventError(needsRetry ? "Có một đánh giá chưa xác định kết quả. Hãy thử lại đúng thao tác trước khi tiếp tục." : null);
      requestFocus(result.presentation === "ACTIVE" ? "card" : "summary");
    } catch (error) {
      if (!isCurrent()) return;
      if (error instanceof LearningApiError && error.code === "CEFR_LEVEL_LOCKED") setStatus("locked");
      else if (error instanceof LearningApiError && error.code === "LEARNING_SET_EMPTY") setStatus("empty");
      else if (error?.kind === "not-found") setStatus("not-found");
      else setRecoveryError("Chưa thể tiếp tục ôn tập. Vui lòng thử lại.");
      requestFocus("summary");
    } finally {
      if (isCurrent()) {
        ordinaryActionRef.current = null;
        setRecoveryPending(false);
      }
    }
  }

  async function retryOriginalSrsRating(request) {
    if (!ordinarySrs || ordinaryActionRef.current || eventState === "pending") return;
    const identity = learningSessionIdentity("SRS");
    const storage = browserSessionStorage();
    const action = {};
    ordinaryActionRef.current = action;
    const isCurrent = () => ordinaryActionRef.current === action;
    setEventState("pending");
    setRecoveryError(null);
    try {
      const accepted = await learningService.recordMeaningfulEvent(request);
      if (!isCurrent()) return;
      setOrdinarySrsAttempts(settleOrdinarySrsRating(storage, identity, request.event_id));
      if (runState.srs.retry_context?.event_id === request.event_id) {
        persist(setSrsRetryContext(runState, null));
      }
      showXpRewardToast(accepted.reward, shownXpRewardEventsRef.current);
      retryLoad();
    } catch (error) {
      if (!isCurrent()) return;
      try {
        if (error instanceof LearningApiError && ["LEARNING_PROGRESS_CHANGED", "LEARNING_SET_ITEM_CHANGED"].includes(error.code)) {
          setOrdinarySrsAttempts(settleOrdinarySrsRating(storage, identity, request.event_id, { superseded: true }));
          if (runState.srs.retry_context?.event_id === request.event_id) {
            persist(setSrsRetryContext(runState, null));
          }
          setRecoveryError("Tiến độ đã thay đổi. Không thể xác nhận lại đánh giá trước đó.");
        } else {
          setRecoveryError("Chưa thể xác nhận lại đánh giá trước đó. Bạn có thể tiếp tục ôn tập.");
        }
      } catch {
        setRecoveryError("Chưa thể lưu trạng thái đánh giá. Vui lòng thử lại.");
      }
      requestFocus(srsSessionStatus === "ACTIVE" && currentCard ? "card" : "summary");
    } finally {
      if (isCurrent()) {
        ordinaryActionRef.current = null;
        setEventState("idle");
      }
    }
  }

  function switchMode(nextMode) {
    if (reviewContext && nextMode !== "SRS") return;
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

  async function revealNormalAnswer(retry = false, restoreKeyboardFocus = false) {
    if ((!retry && revealed) || mode !== "NORMAL" || !currentCard || !normalSession
      || normalSession.view_state !== "ACTIVE" || eventState === "pending") return;
    if (!revealed) revealAnswer();
    normalMutationFocusIntentRef.current = restoreKeyboardFocus;
    setEventState("pending");
    setEventError(null);
    setNormalRetryVocabularyId(currentCard.id);
    setAnnouncement("Đang ghi nhận bằng chứng học tập…");
    try {
      const accepted = await acknowledgeNormalReveal({
        storage: browserSessionStorage(),
        identity: learningSessionIdentity("NORMAL"),
        state: normalSession,
        vocabularyId: currentCard.id,
        service: learningSessionService,
        randomUuid: () => window.crypto.randomUUID(),
      });
      setNormalSession(accepted);
      setNormalSessionStatus(accepted.view_state);
      if (accepted.cefr_pass) {
        setPathPass((current) => mergePassEvidenceSummary(current, accepted.cefr_pass));
      }
      setNormalRetryVocabularyId(null);
      setEventState("idle");
      setAnnouncement("Đã ghi nhận thẻ được lật. Bạn có thể tiếp tục.");
    } catch (error) {
      if (await reconcileTerminalNormalMutation(error)) return;
      setEventState("error");
      setEventError("Chưa thể ghi nhận lần lật thẻ. Hãy thử lại trước khi hoàn thành phiên.");
      setAnnouncement("Chưa thể ghi nhận bằng chứng học tập. Hãy thử lại.");
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
      const reveal = mode === "NORMAL"
        ? () => void revealNormalAnswer(false, trigger === "space")
        : revealAnswer;
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
        identity: learningSessionIdentity("NORMAL"),
        state: normalSession,
        service: learningSessionService,
        randomUuid: () => window.crypto.randomUUID(),
      });
      setNormalSession(result.session_state);
      setNormalSessionStatus("COMPLETED");
      if (pathPassStatus === "managed" && pathPass) {
        setPathPass(await learningPathService.readPass(pathPass.id));
      }
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
        identity: learningSessionIdentity("NORMAL"),
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
      normalMutationFocusIntentRef.current = false;
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
    clearLearningSessionState(browserSessionStorage(), learningSessionIdentity("NORMAL"));
    setNormalSession(null);
    setNormalSessionStatus("idle");
    setRevealed(false);
    setAudioError(null);
    setAnnouncement("Đã chuyển sang nhóm từ tiếp theo.");
    requestFocus("card");
  }

  async function completeFullPass() {
    if (!pathPass || pathPass.remaining_items !== 0 || eventState === "pending") return;
    setEventState("pending");
    setEventError(null);
    try {
      const result = await runPathOperation({
        storage: browserSessionStorage(), userId: user.id, setId, passId: pathPass.id, kind: "COMPLETE_PASS",
        randomUuid: () => window.crypto.randomUUID(),
        execute: (operationId) => learningPathService.completePass(pathPass.id, operationId),
      });
      setPathPass(result.pass);
      setPathCompletion(result.path);
      setEventState("idle");
      setAnnouncement("Đã hoàn thành bộ từ và cập nhật lộ trình CEFR.");
      requestFocus("summary");
    } catch (error) {
      setEventState("error");
      if (error instanceof LearningPathApiError && error.code === "CEFR_PASS_RESTART_REQUIRED") {
        setPathPassStatus("restart-required");
        setEventError("Nội dung bộ từ đã thay đổi. Hãy xác nhận bắt đầu lại với nội dung hiện tại.");
      } else {
        setEventError("Chưa thể hoàn thành bộ từ. Bằng chứng đã ghi nhận được giữ nguyên để bạn thử lại.");
      }
    }
  }

  async function restartFullPass() {
    if (!pathPass || eventState === "pending") return;
    setEventState("pending");
    setEventError(null);
    try {
      const result = await runPathOperation({
        storage: browserSessionStorage(), userId: user.id, setId, passId: pathPass.id, kind: "RESTART_PASS",
        randomUuid: () => window.crypto.randomUUID(),
        execute: (operationId) => learningPathService.restartPass(pathPass.id, operationId),
      });
      clearLearningSessionState(browserSessionStorage(), learningSessionIdentity("NORMAL"));
      clearLearningSessionState(browserSessionStorage(), learningSessionIdentity("SRS"));
      setPathPass(result.pass);
      setPathPassStatus("managed");
      setNormalSession(null);
      setNormalSessionStatus("idle");
      persist(restartNormalRun(runState, allCards));
      setEventState("idle");
      setAnnouncement("Đã bắt đầu lại lượt học với nội dung hiện tại.");
    } catch {
      setEventState("error");
      setEventError("Chưa thể bắt đầu lại lượt học. Vui lòng thử lại.");
    }
  }

  async function submitRating(rating, attempt = null) {
    if (mode !== "SRS" || !currentCard || !runState || eventState === "pending"
      || srsSessionStatus !== "ACTIVE" || ordinaryActionRef.current) return;
    if (attempt && (attempt.session_id !== srsSession?.session_id || attempt.vocabulary_id !== currentCard.id)) return;
    if (!attempt && (retryEvent || currentOrdinaryAttempt)) return;
    const nextAttempt = attempt ?? {
      event_id: window.crypto.randomUUID(), set_id: setId,
      session_id: srsSession.session_id,
      vocabulary_id: currentCard.id, expected_revision: currentCard.progress.revision, rating,
    };
    const pendingState = setSrsRetryContext(runState, nextAttempt);
    if (!saveLearningRunState(browserSessionStorage(), pendingState, sessionIntent)) {
      setEventState("error");
      setEventError("Chưa thể lưu thao tác đánh giá để thử lại an toàn. Vui lòng tải lại trang.");
      return;
    }
    setRunState(pendingState);
    setEventState("pending");
    setEventError(null);
    setAnnouncement(`Đang ghi nhận: ${RATING_LABELS[rating]}.`);
    const storage = browserSessionStorage();
    const identity = learningSessionIdentity("SRS");
    try {
      if (ordinarySrs) {
        setOrdinarySrsAttempts(preserveOrdinarySrsRating(storage, identity, nextAttempt));
      }
      const accepted = await learningService.recordMeaningfulEvent(nextAttempt);
      if (!mountedRef.current) return;
      const { reward, session, cefr_pass: cefrPass } = accepted;
      const progress = Object.fromEntries(Object.entries(accepted).filter(([field]) => (
        !["reward", "session", "streak", "cefr_pass"].includes(field)
      )));
      const acceptedSession = acceptSrsRatingProjection({
        storage,
        identity,
        state: srsSession,
        backendSession: session,
        cefrPass,
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
      if (!saveLearningRunState(browserSessionStorage(), nextState, sessionIntent)) {
        setRunState(pendingState);
        throw new TypeError("Accepted SRS result could not be persisted.");
      }
      setRunState(nextState);
      if (ordinarySrs) {
        setOrdinarySrsAttempts(settleOrdinarySrsRating(storage, identity, nextAttempt.event_id));
      }
      if (cefrPass) {
        const mergedPass = mergePassEvidenceSummary(pathPass, cefrPass);
        setPathPass(mergedPass);
        try {
          setPathPass(await learningPathService.readPass(mergedPass.id));
        } catch {
          // The accepted event summary remains authoritative for credit/readiness.
        }
      }
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
      if (!mountedRef.current) return;
      if (error instanceof LearningApiError
        && ["LEARNING_PROGRESS_CHANGED", "LEARNING_SET_ITEM_CHANGED"].includes(error.code)) {
        if (ordinarySrs) {
          try {
            setOrdinarySrsAttempts(settleOrdinarySrsRating(storage, identity, nextAttempt.event_id, { superseded: true }));
            persist(setSrsRetryContext(pendingState, null));
          } catch {
            // Keep the exact attempt available when durable storage cannot be updated.
          }
        }
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
        identity: learningSessionIdentity("SRS"),
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

  async function restartRun() {
    if (!runState || eventState === "pending") return;
    cancelPronunciation();
    if (mode === "SRS") {
      if (summary.presentation_count > 0
        && !window.confirm("Bắt đầu lại phiên SRS? Tiến độ đã lưu sẽ không bị xóa.")) return;
      restartSrsRef.current = true;
      clearLearningSessionState(browserSessionStorage(), learningSessionIdentity("SRS"));
      setSrsSession(null);
      setSrsSessionStatus("idle");
      setStatus("loading");
      setReloadToken((value) => value + 1);
    } else if (pathPassStatus === "managed" && pathPass?.state === "ACTIVE") {
      setEventError("Lượt học CEFR đang được lưu tự động. Hãy tiếp tục lượt hiện tại; chỉ bắt đầu lại khi hệ thống báo nội dung đã thay đổi.");
    } else {
      setEventState("pending");
      setEventError(null);
      try {
        await prepareFreshNormalLearningSession({
          storage: browserSessionStorage(),
          identity: learningSessionIdentity("NORMAL"),
          service: learningSessionService,
        });
        setNormalSession(null);
        setNormalSessionStatus("idle");
        persist(restartNormalRun(runState, allCards));
        setStatus("loading");
        setReloadToken((value) => value + 1);
        setRevealed(false);
        setAnnouncement("Đã trở về thẻ đầu tiên.");
        requestFocus("card");
      } catch {
        setEventState("error");
        setEventError("Chưa thể bắt đầu lượt học mới an toàn. Vui lòng thử lại.");
      }
    }
  }

  function continueSrsReview() {
    if (mode !== "SRS" || !runState || !summary.completed || eventState === "pending") return;
    restartSrsRef.current = true;
    clearLearningSessionState(browserSessionStorage(), learningSessionIdentity("SRS"));
    setSrsSession(null);
    setSrsSessionStatus("idle");
    setStatus("loading");
    setReloadToken((value) => value + 1);
  }

  function learningSessionIdentity(sessionMode) {
    return {
      userId: user.id,
      setId,
      mode: sessionMode,
      ...(sessionMode === "SRS" ? { sessionIntent } : {}),
      ...(pathPassStatus === "managed" && pathPass ? { passId: pathPass.id } : {}),
    };
  }

  function playPronunciation() {
    if (!currentCard?.pronunciation_url && !supportsSpeechSynthesis) return;
    pronunciationCoordinator.listen({
      targetId: currentCard.id,
      text: currentCard.word,
      audioUrl: currentCard.pronunciation_url,
    });
  }

  function playFromSpeaker() {
    if (resolveFlashcardInteraction(revealed, "speaker").shouldPlayPronunciation) {
      void playPronunciation();
    }
  }

  function cancelPronunciation() {
    pronunciationCoordinator.cancel();
  }

  const detachedAttempts = ordinarySrs ? ordinarySrsAttempts.filter(({ request, superseded }) => (
    !superseded && (srsSessionStatus !== "ACTIVE" || request.event_id !== retryEvent?.event_id)
  )) : [];
  const pendingRatingActions = recoveryError || detachedAttempts.length ? (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
      {recoveryError ? <p className="m-0 w-full text-sm text-red-800" role="alert">{recoveryError}</p> : null}
      {detachedAttempts.map(({ request }) => (
        <button key={request.event_id} type="button" className={SECONDARY_BUTTON_CLASSES}
          disabled={eventState === "pending" || recoveryPending} onClick={() => void retryOriginalSrsRating(request)}>
          Thử lại đánh giá trước đó ({RATING_LABELS[request.rating]})
        </button>
      ))}
    </div>
  ) : null;

  if (!reviewContext && ["locked", "error"].includes(pathPassStatus)) {
    return <LearningPageState
      mode={mode}
      status={pathPassStatus === "locked" ? "locked" : "error"}
      onRetry={retryLoad}
      returnTo={returnTo}
    />;
  }

  if (status !== "ready" || !payload || !runState || !summary
    || (freshNormalIntent && pathPassStatus === "loading")
    || (mode === "SRS" && srsSessionStatus === "loading"
      && pathPassStatus !== "restart-required")) {
    const presentationStatus = mode === "SRS" && srsSessionStatus === "loading"
      ? "loading"
      : status;
    return <LearningPageState mode={mode} status={presentationStatus} onRetry={retryLoad} returnTo={returnTo} />;
  }


  if (mode === "SRS" && srsSessionStatus === "ACTIVE_SNAPSHOT_UNAVAILABLE") {
    return <LearningPageState mode={mode} status="snapshot-unavailable" onRetry={recoverSrs} returnTo={returnTo}
      headingRef={summaryHeadingRef} retryPending={recoveryPending} retryDisabled={eventState === "pending"}>
      {pendingRatingActions}
    </LearningPageState>;
  }
  if (mode === "SRS" && ["RECOVERY_EXPIRED", "RECOVERY_INACCESSIBLE"].includes(srsSessionStatus)) {
    return <LearningPageState mode={mode} status={srsSessionStatus === "RECOVERY_EXPIRED" ? "srs-expired" : "not-found"}
      returnTo={returnTo} headingRef={summaryHeadingRef}>{pendingRatingActions}</LearningPageState>;
  }

  const hasActiveEmptyDue = srsSessionStatus === "ACTIVE_EMPTY_DUE";
  const isSrsFinished = mode === "SRS" && summary.completed && !hasActiveEmptyDue;
  const isUpToDate = mode === "SRS" && (summary.up_to_date || hasActiveEmptyDue);
  const isPassReady = mode === "SRS" && srsSessionStatus === "PASS_READY_TO_COMPLETE";
  if (isSrsFinished || isUpToDate || isPassReady) {
    const managedSrs = !reviewContext && pathPassStatus === "managed" && pathPass;
    const readyToComplete = managedSrs && pathPass.state === "ACTIVE"
      && pathPass.ready_to_complete;
    const passCompleted = managedSrs && pathPass.state === "COMPLETED";
    return (
      <main className={`${PAGE_CLASSES} grid min-h-[min(38rem,calc(100vh_-_9rem))] place-items-center`}>
        <section className="w-full max-w-[36rem] rounded-[1.4rem] border border-[#d9e8f3] bg-white p-[clamp(1.5rem,5vw,2.5rem)] text-center shadow-[0_16px_36px_rgb(30_41_59/8%)]" role="status">
          <BookOpenCheck className="mx-auto size-14 rounded-2xl bg-[var(--accent-primary-soft)] p-3 text-[var(--accent-primary-pressed)]" aria-hidden="true" />
          <h1 ref={summaryHeadingRef} tabIndex={-1}>{readyToComplete ? "Sẵn sàng hoàn thành bộ từ" : passCompleted ? "Hoàn thành bộ từ" : "Hoàn thành ôn tập"}</h1>
          <p>{readyToComplete
            ? `Đã học đủ ${pathPass.credited_items} / ${pathPass.snapshot_size} từ. Hãy xác nhận bước cuối.`
            : isSrsFinished ? `Đã hoàn thành ${summary.completed_count} / ${summary.total} từ trong phiên này.` : reviewContext ? "Hiện chưa có từ nào đến hạn. Bạn có thể quay lại Trung tâm ôn tập." : "Hiện chưa có từ nào đến hạn. Bạn có thể ôn tập thường hoặc quay lại bộ từ."}</p>
          {isUpToDate && payload.next_review_at ? <p>Lần ôn tập tiếp theo: {formatNextReview(payload.next_review_at)}</p> : null}
          <div className="flex flex-wrap justify-center gap-3">
            {!reviewContext ? <button type="button" className={PRIMARY_BUTTON_CLASSES} onClick={() => switchMode("NORMAL")} disabled={eventState === "pending"}>Học thường</button> : null}
            {readyToComplete
              ? <button type="button" className={PRIMARY_BUTTON_CLASSES} onClick={() => void completeFullPass()} disabled={eventState === "pending"}>{eventState === "pending" ? "Đang hoàn thành…" : "Hoàn thành bộ từ"}</button>
              : isSrsFinished && !passCompleted ? <button type="button" className={SECONDARY_BUTTON_CLASSES} onClick={continueSrsReview} disabled={eventState === "pending"}><RotateCcw aria-hidden="true" /> {reviewContext ? "Ôn tiếp" : "Học tiếp"}</button> : null}
            <Link className={SECONDARY_BUTTON_CLASSES} to={returnTo}>{reviewContext ? "Trung tâm ôn tập" : "Quay lại bộ từ"}</Link>
          </div>
          {pendingRatingActions}
        </section>
      </main>
    );
  }

  if (!reviewContext && pathPassStatus === "restart-required") {
    return (
      <main className={`${PAGE_CLASSES} grid min-h-[min(38rem,calc(100vh_-_9rem))] place-items-center`}>
        <section className="w-full max-w-[36rem] rounded-[1.4rem] border border-amber-200 bg-white p-[clamp(1.5rem,5vw,2.5rem)] text-center shadow-[0_16px_36px_rgb(30_41_59/8%)]" role="alert">
          <h1 ref={summaryHeadingRef} tabIndex={-1}>Nội dung bộ từ đã thay đổi</h1>
          <p>Lượt học cũ không thể tiếp tục an toàn. Bắt đầu lại sẽ tạo ảnh chụp nội dung mới; hệ thống không tự cấp hoàn thành.</p>
          <div className="flex flex-wrap justify-center gap-3"><button type="button" className={PRIMARY_BUTTON_CLASSES} onClick={() => void restartFullPass()} disabled={eventState === "pending"}>{eventState === "pending" ? "Đang bắt đầu lại…" : "Bắt đầu lại"}</button><Link className={SECONDARY_BUTTON_CLASSES} to={returnTo}>Quay lại bộ từ</Link></div>
        </section>
      </main>
    );
  }

  const managedBatchComplete = mode === "NORMAL" && pathPassStatus === "managed"
    && (normalSummary?.batch_completed || normalSessionStatus === "PASS_READY_TO_COMPLETE");
  if (mode === "NORMAL" && (managedBatchComplete || normalSummary?.batch_completed)) {
    const isManaged = pathPassStatus === "managed" && Boolean(pathPass);
    const isFullRunCompleted = isManaged ? pathPass.state === "COMPLETED" : normalSummary.full_run_completed;
    const isReadyForFinalCompletion = isManaged && pathPass.state === "ACTIVE" && pathPass.remaining_items === 0;
    const remainingItems = isManaged ? pathPass.remaining_items : normalSummary.next_batch_size;
    return (
      <main className={`${PAGE_CLASSES} grid min-h-[min(38rem,calc(100vh_-_9rem))] place-items-center`}>
        <section className="w-full max-w-[36rem] rounded-[1.4rem] border border-[#d9e8f3] bg-white p-[clamp(1.5rem,5vw,2.5rem)] text-center shadow-[0_16px_36px_rgb(30_41_59/8%)]" role="status" aria-atomic="true">
          <BookOpenCheck className="mx-auto size-14 rounded-2xl bg-[var(--accent-primary-soft)] p-3 text-[var(--accent-primary-pressed)]" aria-hidden="true" />
          <h1 ref={summaryHeadingRef} tabIndex={-1}>{isFullRunCompleted ? "Hoàn thành bộ từ" : isReadyForFinalCompletion ? "Sẵn sàng hoàn thành bộ từ" : "Hoàn thành phiên"}</h1>
          <p>{isFullRunCompleted ? "Bạn đã học hết các từ vựng trong phiên này!" : isReadyForFinalCompletion ? `Đã học đủ ${pathPass.studied_items} / ${pathPass.snapshot_size} từ. Hãy xác nhận bước cuối.` : `Nhóm hiện tại đã hoàn thành. Còn ${remainingItems} từ trong lượt học.`}</p>
          {pathCompletion ? <p className="rounded-lg bg-emerald-50 p-3 text-emerald-800" role="status">Cấp độ cao nhất đang mở: <strong>{pathCompletion.highest_unlocked_level}</strong>{pathCompletion.path_completed_at ? ". Bạn đã đạt thành tích hoàn thành lộ trình." : "."}</p> : null}
          {announcement ? <p className="sr-only">{announcement}</p> : null}
          <div className="flex flex-wrap justify-center gap-3">
            {isFullRunCompleted
              ? !isManaged
                ? <button type="button" className={PRIMARY_BUTTON_CLASSES} onClick={() => void restartRun()} disabled={eventState === "pending"}><RotateCcw aria-hidden="true" /> {eventState === "pending" ? "Đang bắt đầu lại…" : "Học lại từ đầu"}</button>
                : null
              : isReadyForFinalCompletion
                ? <button type="button" className={PRIMARY_BUTTON_CLASSES} onClick={() => void completeFullPass()} disabled={eventState === "pending"}>{eventState === "pending" ? "Đang hoàn thành…" : "Hoàn thành bộ từ"}</button>
                : <button type="button" className={PRIMARY_BUTTON_CLASSES} onClick={continueNormalBatch}>Học tiếp {Math.min(10, remainingItems)} từ</button>}
            <Link className={SECONDARY_BUTTON_CLASSES} to={returnTo}>Quay lại bộ từ</Link>
          </div>
        </section>
      </main>
    );
  }

  if (!currentCard) return <LearningPageState mode={mode} status="error" onRetry={retryLoad} returnTo={returnTo} />;

  return (
    <main className="learning-page h-full min-h-0 w-full text-[#172554]" aria-labelledby="learning-page-title">
      <div className="flex h-full min-h-0 flex-col">
        <FlashcardToolbar
          backLabel={payload.name}
          badge={reviewContext ? "Ôn tập" : pathPassStatus === "managed" ? "Lượt học CEFR" : null}
          disabled={eventState === "pending"}
          innerClassName={`grid ${reviewContext ? "grid-cols-[minmax(0,1fr)_auto_auto]" : "grid-cols-[minmax(0,1fr)_auto_auto_auto]"} max-[900px]:grid-cols-[minmax(0,1fr)_auto]`}
          onBack={() => navigate(returnTo)}
          onRestart={restartRun}
          restartLabel={mode === "NORMAL" ? "Học lại từ đầu" : "Bắt đầu lại"}
        >
            <div className="learning-key-hints flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-600 max-[900px]:col-start-1 max-[900px]:row-start-2 max-[900px]:justify-self-start max-[520px]:col-span-2 max-[520px]:justify-self-center" aria-label="Phím tắt học">
              <LearningKeyHint keys="Space" label="Lật thẻ" />
              {mode === "NORMAL" ? <LearningKeyHint keys="← →" label="Chuyển thẻ" /> : null}
            </div>
            {!reviewContext ? <div className="learning-mode-selector inline-flex min-h-11 justify-self-center rounded-xl border border-sky-200 bg-sky-50 p-1 max-[900px]:col-start-2 max-[900px]:row-start-2 max-[520px]:col-span-2 max-[520px]:col-start-1 max-[520px]:row-start-3" role="group" aria-label="Chế độ ôn tập">
              {[['SRS', 'SRS', 'Ôn tập SRS'], ['NORMAL', 'Thường', 'Ôn tập thường']].map(([value, visibleLabel, accessibleLabel]) => (
                <button key={value} type="button" className={`min-h-11 cursor-pointer rounded-lg px-3 text-sm font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] disabled:cursor-not-allowed motion-reduce:transition-none ${requestedMode === value ? "bg-white text-sky-800 shadow-sm" : "bg-transparent text-slate-600 hover:bg-white/70 hover:text-sky-800"}`} aria-label={accessibleLabel} aria-pressed={requestedMode === value} onClick={() => switchMode(value)} disabled={eventState === "pending" || Boolean(pendingMode)}>{visibleLabel}</button>
              ))}
            </div> : null}
        </FlashcardToolbar>
        <h1 id="learning-page-title" ref={modeHeadingRef} tabIndex={-1} className="sr-only">{payload.name} — {mode === "SRS" ? "Ôn tập SRS" : "Ôn tập thường"}</h1>
        <div className="mx-auto flex min-h-0 w-full max-w-[40rem] flex-1 flex-col px-[clamp(0.8rem,3vw,2rem)] py-[clamp(0.55rem,1.5vw,0.85rem)] max-[700px]:px-[0.8rem] max-[700px]:py-[0.65rem]">
        <FlashcardProgress
          label={mode === "SRS" ? "Tiến độ SRS" : "Tiến độ"}
          max={mode === "SRS" ? summary.total : cards.length}
          value={mode === "SRS" ? summary.completed_count : currentIndex + 1}
          valueLabel={mode === "SRS" ? `Đã hoàn thành ${summary.completed_count} / ${summary.total}` : `Thẻ ${currentIndex + 1} / ${cards.length}`}
        />
        <div className="sr-only" aria-atomic="true" aria-live="polite" ref={normalPendingStatusRef} role="status" tabIndex={mode === "NORMAL" && eventState === "pending" ? -1 : undefined}>{announcement}</div>
        {eventError ? <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800" role="alert"><span>{eventError}</span>{mode === "NORMAL" && normalRetryVocabularyId === currentCard?.id ? <button className={SECONDARY_BUTTON_CLASSES} type="button" ref={normalRetryButtonRef} onClick={(event) => void revealNormalAnswer(true, event.detail === 0)}>Thử lại ghi nhận</button> : mode === "NORMAL" && ["EXPIRED", "INACCESSIBLE"].includes(normalSessionStatus) ? <button className={SECONDARY_BUTTON_CLASSES} type="button" onClick={restartRun}>Bắt đầu lại</button> : mode === "NORMAL" && normalSessionStatus === "error" ? <button className={SECONDARY_BUTTON_CLASSES} type="button" onClick={retryLoad}>Thử lại phiên học</button> : mode === "SRS" && ["EXPIRED", "INACCESSIBLE"].includes(srsSessionStatus) ? <button className={SECONDARY_BUTTON_CLASSES} type="button" onClick={restartRun}>Bắt đầu lại</button> : eventState === "conflict" ? <button className={SECONDARY_BUTTON_CLASSES} type="button" onClick={retryLoad}>Làm mới phiên SRS</button> : retryEvent ? <button className={SECONDARY_BUTTON_CLASSES} type="button" disabled={eventState === "pending"} onClick={() => void submitRating(retryEvent.rating, retryEvent)}>Thử lại</button> : null}</div> : null}
        {pendingRatingActions}
        {audioError ? <p className="m-0 mb-2 text-sm text-amber-700" role="status">{audioError}</p> : null}
        <FlashcardCard
          key={`${mode}:${currentCard.id}`}
          answerHeadingRef={answerHeadingRef}
          audioAvailable={Boolean(currentCard.pronunciation_url || supportsSpeechSynthesis)}
          audioDisabled={mode !== "NORMAL" && eventState === "pending"}
          busy={mode === "NORMAL" && eventState === "pending"}
          card={currentCard}
          cardHeadingRef={cardHeadingRef}
          disabled={eventState === "pending"}
          meaning={primaryMeaning}
          onAudio={playFromSpeaker}
          onCardClick={handleCardClick}
          overlay={pendingMode || (mode === "NORMAL" && normalSessionStatus === "idle") ? <div className="absolute inset-0 z-10 grid place-items-center rounded-3xl bg-white/85 px-4 backdrop-blur-[1px]"><LoadingIndicator label={pendingMode ? "Đang chuyển chế độ…" : "Đang chuẩn bị phiên học…"} /></div> : null}
          revealed={revealed}
        />
        <div className="mt-3 grid min-h-[3.35rem] shrink-0 place-items-center">
          {mode === "SRS" ? <SrsRatingControls
             disabled={eventState === "pending" || Boolean(pendingMode) || Boolean(retryEvent || currentOrdinaryAttempt)
               || (ordinarySrs && eventState === "conflict") || srsSessionStatus !== "ACTIVE"}
            items={Object.entries(RATING_LABELS).map(([rating, label]) => ({
              label,
              rating,
              subLabel: rating === "AGAIN" ? "Trong phiên này" : RATING_INTERVAL_LABELS[currentCard.rating_previews[rating].interval_days],
            }))}
            onRate={(rating) => void submitRating(rating)}
            pendingRating={pendingRating}
            revealed={revealed}
          /> : (
            <nav className="grid w-full max-w-sm grid-cols-2 gap-3" aria-label="Điều hướng thẻ"><button type="button" className={PREVIOUS_BUTTON_CLASSES} onClick={() => navigateNormal(currentIndex - 1)} disabled={currentIndex === 0 || Boolean(pendingMode) || eventState === "pending"}><span className="inline-flex items-center gap-2"><ArrowLeft aria-hidden="true" /> Thẻ trước</span><span className="text-xs font-medium opacity-70">Key: ←</span></button>{currentIndex === cards.length - 1 ? <button type="button" className={NEXT_BUTTON_CLASSES} ref={normalProgressionButtonRef} onClick={finishNormalBatch} disabled={Boolean(pendingMode) || eventState === "pending" || !canCompleteNormalLearningSession(normalSession)}>Hoàn thành phiên</button> : <button type="button" className={NEXT_BUTTON_CLASSES} ref={normalProgressionButtonRef} onClick={() => navigateNormal(currentIndex + 1)} disabled={Boolean(pendingMode) || eventState === "pending"}><span className="inline-flex items-center gap-2">Thẻ sau <ArrowRight aria-hidden="true" /></span><span className="text-xs font-medium opacity-80">Key: →</span></button>}</nav>
          )}
        </div>
        </div>
      </div>
    </main>
  );
}

export function SetReviewPage() {
  return <LearningFoundationPage reviewContext />;
}

function LearningKeyHint({ keys, label }) {
  return <span className="inline-flex items-center whitespace-nowrap rounded-full border border-sky-100 bg-sky-50/70 px-2 py-1 text-xs text-slate-600"><kbd className="font-sans font-extrabold text-sky-800">{keys}</kbd><span className="px-1 text-slate-400" aria-hidden="true">·</span><span>{label}</span></span>;
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

function mergePassEvidenceSummary(current, summary) {
  if (!current || current.id !== summary?.id) {
    throw new TypeError("CEFR evidence summary does not match the active pass.");
  }
  return {
    ...current,
    state: summary.state,
    studied_items: summary.credited_items,
    credited_items: summary.credited_items,
    remaining_items: summary.remaining_items,
    ready_to_complete: summary.ready_to_complete,
    activity_state: summary.state !== "ACTIVE"
      ? summary.state
      : summary.ready_to_complete ? "READY_TO_COMPLETE"
        : summary.credited_items === 0 ? "PRISTINE" : "IN_PROGRESS",
  };
}

function LearningPageState({ mode, onRetry, returnTo, status, headingRef, retryPending, retryDisabled, children }) {
  const loading = status === "loading";
  const isRecovery = status === "snapshot-unavailable";
  const content = {
    loading: [mode === "SRS" ? "Đang chuẩn bị phiên ôn tập" : "Đang chuẩn bị phiên học", "Nội dung bộ từ đang được tải."],
    empty: ["Bộ từ chưa có nội dung", "Hãy thêm từ vựng trước khi bắt đầu."],
    "not-found": ["Không tìm thấy bộ từ có thể học", "Bộ từ không tồn tại hoặc bạn không có quyền truy cập."],
    locked: ["Cấp độ CEFR chưa được mở khóa", "Bạn có thể xem chi tiết hoặc tạo bản sao riêng, nhưng chưa thể học trực tiếp bộ từ công khai này."],
    error: ["Không thể tải phiên ôn tập", "Vui lòng kiểm tra kết nối và thử lại."],
    "snapshot-unavailable": ["Tiến độ ôn tập đã thay đổi", "Tiến độ từ vựng của bạn đã được cập nhật. Bạn có thể tiếp tục ôn tập theo danh sách từ đến hạn mới nhất."],
    "srs-expired": ["Phiên SRS đã hết hạn", "Quay lại bộ từ để mở phiên ôn tập."],
  }[status] ?? ["Không thể mở phiên ôn tập", "Vui lòng quay lại và thử lại."];
  const frameClasses = loading
    ? `${PAGE_CLASSES} grid min-h-[min(28rem,calc(100vh_-_9rem))] place-items-center`
    : `${PAGE_CLASSES} grid min-h-[min(38rem,calc(100vh_-_9rem))] place-items-center`;
  const cardClasses = loading
    ? "w-full max-w-[30rem] rounded-2xl border border-sky-100 bg-white px-6 py-7 text-center shadow-[0_12px_28px_rgb(30_41_59/6%)]"
    : "w-full max-w-[34rem] rounded-[1.4rem] border border-[#d9e8f3] bg-white p-8 text-center shadow-[0_16px_36px_rgb(30_41_59/6%)]";
  return (
    <main className={frameClasses}>
      <section className={cardClasses} role={loading || isRecovery ? undefined : "alert"}>
        {loading ? (
          <>
            <h1 className="m-0 text-xl font-black text-slate-900">{content[0]}</h1>
            <div className="mt-5"><LoadingIndicator label={content[1]} variant="centered" /></div>
          </>
        ) : (
          <>
            <BookOpenCheck className="mx-auto size-14 rounded-2xl bg-sky-50 p-3 text-[#0877b9]" aria-hidden="true" />
            <h1 ref={headingRef} tabIndex={headingRef ? -1 : undefined}
              className={isRecovery ? "mb-2 mt-3 text-xl font-black text-slate-900" : undefined}>{content[0]}</h1>
            <p>{content[1]}</p>
          </>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {status === "error" || isRecovery ? (
            <button type="button" className={PRIMARY_BUTTON_CLASSES} onClick={onRetry} disabled={retryPending || retryDisabled}>
              {isRecovery ? "Tiếp tục ôn tập" : "Thử lại"}
            </button>
          ) : null}
          <Link className={SECONDARY_BUTTON_CLASSES} to={returnTo}>Quay lại bộ từ</Link>
        </div>
        {retryPending ? <p role="status" className="mt-3 text-sm">Đang tải danh sách ôn tập…</p> : null}
        {children}
      </section>
    </main>
  );
}
