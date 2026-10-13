import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, Headphones, Info, Mic, RotateCcw, SkipForward, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getSpeakingPracticePresentation } from "./speaking-practice-presentation.js";
import { SPEAKING_PRACTICE_PHASES } from "./speaking-practice-state.js";
import { bindSpeakingPracticeVisibility, createSpeakingPracticePageSession, resolveSpeakingPracticeReturnTo } from "./speaking-practice-page-session.js";

const PRIMARY_BUTTON_CLASSES = "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-[#63A0E0] px-4 font-bold text-white shadow-[0_6px_16px_rgb(99_160_224/24%)] transition-[transform,background-color,box-shadow] duration-150 hover:not-disabled:-translate-y-px hover:not-disabled:bg-[#4f8fce] hover:not-disabled:shadow-[0_8px_20px_rgb(99_160_224/30%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a8cff4] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none motion-reduce:transition-none";
const SECONDARY_BUTTON_CLASSES = "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 font-bold text-slate-700 transition-[border-color,background-color,color,transform] duration-150 hover:not-disabled:-translate-y-px hover:not-disabled:border-[#83B4E8] hover:not-disabled:bg-[#f2f8fd] hover:not-disabled:text-[#356faa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a8cff4] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none motion-reduce:transition-none";
const QUIET_BUTTON_CLASSES = "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-transparent px-3 font-bold text-slate-600 transition-colors hover:not-disabled:bg-slate-100 hover:not-disabled:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a8cff4] disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none";
const NAVIGATION_BUTTON_CLASSES = "inline-flex min-h-[4.5rem] w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 px-3 py-2 text-sm font-bold whitespace-nowrap transition-[border-color,background-color,color,transform,box-shadow] duration-150 hover:not-disabled:-translate-y-px focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none motion-reduce:transition-none [&_svg]:size-5";
const PREVIOUS_BUTTON_CLASSES = `${NAVIGATION_BUTTON_CLASSES} border-[#C4B5FD] bg-white text-[#6D4BC3] hover:not-disabled:border-[#A78BFA] hover:not-disabled:bg-[#F7F4FF] focus-visible:ring-[#DDD6FE]`;
const SKIP_BUTTON_CLASSES = `${NAVIGATION_BUTTON_CLASSES} border-[#F4C56A] bg-white text-[#B56808] hover:not-disabled:border-[#E8A62A] hover:not-disabled:bg-[#FFF9EB] focus-visible:ring-[#FDE68A]`;
const NEXT_BUTTON_CLASSES = `${NAVIGATION_BUTTON_CLASSES} border-[#63A0E0] bg-[#63A0E0] text-white shadow-[0_5px_14px_rgb(99_160_224/22%)] hover:not-disabled:border-[#4f8fce] hover:not-disabled:bg-[#4f8fce] hover:not-disabled:shadow-[0_7px_18px_rgb(99_160_224/28%)] focus-visible:ring-[#a8cff4]`;
const BRIEF_DISCLOSURE = "Giọng nói của bạn có thể được xử lý bởi dịch vụ của trình duyệt để nhận diện từ bạn nói.";
const FEEDBACK_STYLES = Object.freeze({
  positive: Object.freeze({ classes: "border-[#A7E3B8] bg-[#ECFDF3] text-[#166534]", Icon: CheckCircle2 }),
  negative: Object.freeze({ classes: "border-[#F4A8A8] bg-[#FEF2F2] text-[#991B1B]", Icon: XCircle }),
  caution: Object.freeze({ classes: "border-[#FCD34D] bg-[#FFFBEB] text-[#92400E]", Icon: AlertTriangle }),
  issue: Object.freeze({ classes: "border-[#b9d8f4] bg-[#f2f8fd] text-[#285f96]", Icon: CircleAlert }),
  neutral: Object.freeze({ classes: "border-slate-200 bg-slate-50 text-slate-700", Icon: Info }),
});
const TERMINAL_PHASES = new Set([
  SPEAKING_PRACTICE_PHASES.RESULT,
  SPEAKING_PRACTICE_PHASES.INCONCLUSIVE,
  SPEAKING_PRACTICE_PHASES.RECOVERABLE_ERROR,
]);

export function SpeakingPracticePage() {
  const { setId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const sessionRef = useRef(null);
  const targetHeadingRef = useRef(null);
  const completionHeadingRef = useRef(null);
  const feedbackHeadingRef = useRef(null);
  const speakingContextRef = useRef(null);
  const focusStateRef = useRef({ initialized: false, setId: null, targetId: null, completed: false, generation: null, phase: null });
  const [snapshot, setSnapshot] = useState(null);
  const [retryToken, setRetryToken] = useState(0);
  const [terminalFocusIntent, setTerminalFocusIntent] = useState(false);
  const returnTo = resolveSpeakingPracticeReturnTo(setId, location.state);

  useEffect(() => {
    let ownedSession = null;
    let active = true;
    ownedSession = createSpeakingPracticePageSession({
      setId,
      onSnapshot(nextSnapshot) {
        if (active && sessionRef.current === ownedSession) setSnapshot(nextSnapshot);
      },
    });
    sessionRef.current = ownedSession;
    setSnapshot(ownedSession.getSnapshot());
    const removeVisibilityListener = bindSpeakingPracticeVisibility(globalThis.document, () => ownedSession.cancel("PAGE_HIDDEN"));
    void ownedSession.start();

    return () => {
      active = false;
      removeVisibilityListener();
      if (sessionRef.current === ownedSession) sessionRef.current = null;
      ownedSession.dispose();
    };
  }, [retryToken, setId]);

  const targetId = snapshot?.target?.id ?? null;
  const completed = snapshot?.completed === true;
  const generation = snapshot?.generation ?? null;
  const phase = snapshot?.phase ?? null;
  const terminalFocusPending = TERMINAL_PHASES.has(phase) && terminalFocusIntent;

  useEffect(() => {
    if (!targetId && !completed) return;
    const previous = focusStateRef.current;
    focusStateRef.current = { initialized: true, setId, targetId, completed, generation, phase };
    if (!previous.initialized) return;
    if (completed && !previous.completed) {
      completionHeadingRef.current?.focus({ preventScroll: true });
      return;
    }
    if (!completed && targetId && (previous.completed || setId !== previous.setId || targetId !== previous.targetId)) {
      targetHeadingRef.current?.focus({ preventScroll: true });
      return;
    }
    const enteredTerminal = TERMINAL_PHASES.has(phase)
      && (!TERMINAL_PHASES.has(previous.phase) || generation !== previous.generation);
    if (!enteredTerminal) return;
    const activeElement = globalThis.document?.activeElement;
    const focusIsAvailable = !activeElement || activeElement === globalThis.document?.body
      || speakingContextRef.current?.contains(activeElement);
    if (terminalFocusIntent && focusIsAvailable) {
      feedbackHeadingRef.current?.focus({ preventScroll: true });
    } else {
      setTerminalFocusIntent(false);
    }
  }, [completed, generation, phase, setId, targetId, terminalFocusIntent]);

  function noteTerminalFocusIntent(event) {
    setTerminalFocusIntent(event.detail === 0);
  }

  function retryAttempt(event) {
    noteTerminalFocusIntent(event);
    if (event.detail === 0) targetHeadingRef.current?.focus({ preventScroll: true });
    sessionRef.current?.retryAttempt();
  }

  function exitPractice() {
    const ownedSession = sessionRef.current;
    if (ownedSession) {
      sessionRef.current = null;
      ownedSession.exit();
    }
    navigate(returnTo, { replace: true });
  }

  const presentation = getSpeakingPracticePresentation(snapshot ?? { phase: SPEAKING_PRACTICE_PHASES.LOADING, controls: {} });

  if (!snapshot || snapshot.phase === SPEAKING_PRACTICE_PHASES.LOADING || snapshot.phase === SPEAKING_PRACTICE_PHASES.CANCELLING) {
    return <PageState presentation={presentation} />;
  }

  if (snapshot.phase === SPEAKING_PRACTICE_PHASES.INACCESSIBLE || snapshot.phase === SPEAKING_PRACTICE_PHASES.EMPTY
    || (snapshot.phase === SPEAKING_PRACTICE_PHASES.RECOVERABLE_ERROR && !snapshot.target)) {
    return <PageState presentation={presentation} onExit={exitPractice} onRetry={snapshot.phase === SPEAKING_PRACTICE_PHASES.RECOVERABLE_ERROR ? () => setRetryToken((value) => value + 1) : null} />;
  }

  if (snapshot.completed) {
    return (
      <PageFrame>
        <section className="w-full max-w-[34rem] rounded-3xl border border-[#cfe3f6] bg-white p-[clamp(1.5rem,5vw,2.5rem)] text-center shadow-[0_16px_36px_rgb(30_41_59/8%)]" aria-labelledby="speaking-practice-complete-title" role="status">
          <RotateCcw className="mx-auto size-14 rounded-2xl bg-[#edf5fc] p-3 text-[#63A0E0]" aria-hidden="true" />
          <h1 ref={completionHeadingRef} tabIndex={-1} id="speaking-practice-complete-title" className="mb-0 mt-4 rounded-lg text-2xl font-black text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a8cff4]">{presentation.heading}</h1>
          <p className="mx-auto mb-0 mt-2 max-w-md leading-relaxed text-slate-600">{presentation.description}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button type="button" className={PRIMARY_BUTTON_CLASSES} disabled={!snapshot.controls.canRestart} onClick={() => sessionRef.current?.restartAfterCompletion()}>{presentation.actions.restart.label}</button>
            <button type="button" className={SECONDARY_BUTTON_CLASSES} disabled={!snapshot.controls.canExit} onClick={exitPractice}>{presentation.actions.exit.label}</button>
          </div>
        </section>
      </PageFrame>
    );
  }

  const currentPosition = snapshot.targetIndex + 1;
  const totalTargets = snapshot.targets.length;
  const progressPercent = totalTargets > 0 ? (currentPosition / totalTargets) * 100 : 0;
  const showFeedback = ![
    SPEAKING_PRACTICE_PHASES.READY,
    SPEAKING_PRACTICE_PHASES.STARTING,
    SPEAKING_PRACTICE_PHASES.LISTENING,
    SPEAKING_PRACTICE_PHASES.FINALIZING,
  ].includes(snapshot.phase)
    || presentation.tone !== "neutral"
    || presentation.issue !== null;

  return (
    <main className="speaking-practice-page min-h-full w-full min-w-0 overflow-x-clip text-[#172554]" aria-labelledby="speaking-practice-title">
      <div className="flex min-h-full flex-col">
        <header className="w-full shrink-0 border-b border-slate-200 bg-white/90">
          <div className="mx-auto flex min-h-14 w-full max-w-[64rem] items-center justify-between gap-4 px-[clamp(0.8rem,3vw,2rem)] py-1.5">
            <button type="button" className="inline-flex min-h-11 min-w-0 cursor-pointer items-center gap-2 border-0 bg-transparent px-0 font-extrabold text-slate-700 focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a8cff4] disabled:cursor-not-allowed disabled:opacity-50" onClick={exitPractice} disabled={!snapshot.controls.canExit}><ArrowLeft aria-hidden="true" /><span className="max-w-56 truncate">{snapshot.set?.name}</span></button>
            <span className="shrink-0 rounded-full bg-[#edf5fc] px-3 py-1.5 text-sm font-black text-[#3979b7]">Luyện nói</span>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-[38rem] flex-1 flex-col px-[clamp(0.8rem,3vw,2rem)] py-[clamp(0.8rem,2vw,1.25rem)]">
          <section className="mb-3 shrink-0" aria-label="Tiến độ bộ từ">
            <div className="mb-1.5 flex items-center justify-between gap-4 text-sm font-extrabold text-slate-600"><span>Tiến độ</span><span>Từ {currentPosition} / {totalTargets}</span></div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Tiến độ luyện nói" aria-valuemin={0} aria-valuemax={totalTargets} aria-valuenow={currentPosition}>
              <div className="h-full rounded-full bg-[#63A0E0]" style={{ width: `${progressPercent}%` }} />
            </div>
          </section>

          <section className="flex min-h-[25rem] w-full min-w-0 flex-col rounded-3xl border border-[#b9d8f4] bg-white p-[clamp(1.15rem,3vw,2rem)] text-center shadow-[0_16px_36px_rgb(30_41_59/8%)] max-[600px]:min-h-[22rem]" aria-labelledby="speaking-practice-title">
            <div ref={speakingContextRef} className="flex flex-1 flex-col items-center justify-center">
              <span className="rounded-full bg-[#edf5fc] px-3 py-1.5 text-xs font-black uppercase tracking-[0.08em] text-[#3979b7]">Từ cần luyện</span>
              <h1 ref={targetHeadingRef} tabIndex={-1} id="speaking-practice-title" className="mb-0 mt-4 max-w-full rounded-lg [overflow-wrap:anywhere] text-[clamp(2.5rem,9vw,4.5rem)] font-black leading-none text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a8cff4]">{snapshot.target?.word}</h1>
              {snapshot.target?.phonetic ? <p className="mb-0 mt-3 max-w-full [overflow-wrap:anywhere] text-[clamp(1rem,3vw,1.3rem)] text-slate-500">{snapshot.target.phonetic}</p> : null}

              <div className="mt-6 flex w-full flex-col items-center justify-center gap-3 min-[640px]:flex-row min-[640px]:flex-wrap" aria-label="Thao tác luyện nói" data-testid="speaking-actions">
                <button type="button" aria-label={presentation.actions.listen.label} className={`${SECONDARY_BUTTON_CLASSES} size-11 p-0 min-[640px]:h-auto min-[640px]:w-auto min-[640px]:px-4`} disabled={!snapshot.controls.canListen} onClick={() => sessionRef.current?.listen()}><Headphones aria-hidden="true" /><span className="hidden min-[640px]:inline">{presentation.actions.listen.label}</span></button>
                {snapshot.controls.canStop ? <button type="button" aria-label={presentation.actions.stop.label} className={PRIMARY_BUTTON_CLASSES} onClick={(event) => { noteTerminalFocusIntent(event); sessionRef.current?.stopSpeaking(); }}><ListeningWaveform />{presentation.actions.stop.label}</button> : <button type="button" aria-label={presentation.actions.speak.label} className={`${PRIMARY_BUTTON_CLASSES} size-11 p-0 min-[640px]:h-auto min-[640px]:w-auto min-[640px]:px-4`} disabled={!snapshot.controls.canSpeak} onClick={(event) => { noteTerminalFocusIntent(event); sessionRef.current?.requestSpeak(); }}><Mic aria-hidden="true" /><span className="hidden min-[640px]:inline">{presentation.actions.speak.label}</span></button>}
              </div>

              {presentation.announcement ? <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{presentation.announcement}</p> : null}
              {showFeedback ? <FeedbackPanel announce={!terminalFocusPending} headingRef={feedbackHeadingRef} presentation={presentation} /> : null}

              {snapshot.controls.canRetry ? <button type="button" className={`${QUIET_BUTTON_CLASSES} mt-2`} onClick={retryAttempt}><RotateCcw aria-hidden="true" />{presentation.actions.retry.label}</button> : null}

              {presentation.disclosure ? <Disclosure presentation={presentation} controls={snapshot.controls} onConfirm={(event) => { noteTerminalFocusIntent(event); sessionRef.current?.confirmDisclosureAndStart(); }} sessionRef={sessionRef} /> : null}
            </div>

          </section>

          <nav className="mt-3 grid w-full grid-cols-2 gap-2 min-[480px]:grid-cols-3" aria-label="Điều hướng luyện nói">
            <button type="button" className={PREVIOUS_BUTTON_CLASSES} disabled={!snapshot.controls.canChangeTarget || snapshot.targetIndex === 0} onClick={() => sessionRef.current?.previousTarget()}><ChevronLeft aria-hidden="true" /><span>{presentation.actions.previous.label}</span></button>
            <button type="button" className={SKIP_BUTTON_CLASSES} disabled={!snapshot.controls.canChangeTarget} onClick={() => sessionRef.current?.skipTarget()}><SkipForward aria-hidden="true" /><span>{presentation.actions.skip.label}</span></button>
            <button type="button" className={`${NEXT_BUTTON_CLASSES} col-span-2 min-[480px]:col-span-1`} disabled={!snapshot.controls.canChangeTarget} onClick={() => sessionRef.current?.nextTarget()}><ChevronRight aria-hidden="true" /><span>{presentation.actions.next.label}</span></button>
          </nav>
        </div>
      </div>
    </main>
  );
}

function ListeningWaveform() {
  return (
    <span className="flex h-5 items-center gap-0.5" aria-hidden="true" data-testid="listening-waveform">
      <span className="h-2 w-0.5 rounded-full bg-slate-200 animate-[pulse_800ms_ease-in-out_infinite] motion-reduce:animate-none" />
      <span className="h-3.5 w-0.5 rounded-full bg-white animate-[pulse_950ms_ease-in-out_100ms_infinite] motion-reduce:animate-none" />
      <span className="h-5 w-0.5 rounded-full bg-slate-200 animate-[pulse_700ms_ease-in-out_180ms_infinite] motion-reduce:animate-none" />
      <span className="h-4 w-0.5 rounded-full bg-white animate-[pulse_900ms_ease-in-out_80ms_infinite] motion-reduce:animate-none" />
      <span className="h-5 w-0.5 rounded-full bg-slate-200 animate-[pulse_750ms_ease-in-out_220ms_infinite] motion-reduce:animate-none" />
      <span className="h-3.5 w-0.5 rounded-full bg-white animate-[pulse_1000ms_ease-in-out_140ms_infinite] motion-reduce:animate-none" />
      <span className="h-2 w-0.5 rounded-full bg-slate-200 animate-[pulse_850ms_ease-in-out_40ms_infinite] motion-reduce:animate-none" />
    </span>
  );
}

function Disclosure({ controls, onConfirm, presentation, sessionRef }) {
  return (
    <section className="mt-4 w-full rounded-2xl border border-[#b9d8f4] bg-[#f6faff] p-4 text-left" aria-labelledby="speaking-disclosure-title">
      <h2 id="speaking-disclosure-title" className="m-0 text-base font-black text-slate-900">{presentation.disclosure.heading}</h2>
      <p className="mb-0 mt-2 text-sm leading-relaxed text-slate-600">{BRIEF_DISCLOSURE}</p>
      <details className="mt-3 text-sm text-slate-600">
        <summary className="min-h-11 cursor-pointer content-center rounded-lg font-bold text-[#356faa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a8cff4]">Tìm hiểu thêm</summary>
        <div className="mt-2 grid gap-2 leading-relaxed">{presentation.disclosure.paragraphs.map((paragraph) => <p className="m-0" key={paragraph}>{paragraph}</p>)}</div>
      </details>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" className={QUIET_BUTTON_CLASSES} disabled={!controls.canConfirmDisclosure} onClick={() => sessionRef.current?.deferDisclosure()}>{presentation.actions.deferDisclosure.label}</button>
        <button type="button" className={PRIMARY_BUTTON_CLASSES} disabled={!controls.canConfirmDisclosure} onClick={onConfirm}>Tiếp tục</button>
      </div>
    </section>
  );
}

function FeedbackPanel({ announce, headingRef, presentation }) {
  const hasOutcome = presentation.tone !== "neutral";
  const style = hasOutcome
    ? FEEDBACK_STYLES[presentation.tone] ?? FEEDBACK_STYLES.neutral
    : presentation.issue ? FEEDBACK_STYLES.issue : FEEDBACK_STYLES.neutral;
  const StatusIcon = style.Icon;
  const supportingText = hasOutcome
    ? presentation.description
    : presentation.issue?.message ?? presentation.description;
  const announcement = [presentation.heading, supportingText, !hasOutcome ? presentation.issue?.recovery : null]
    .filter(Boolean)
    .join(". ");
  return (
    <>
      {announce && presentation.liveRegion ? <p className="sr-only" role={presentation.liveRegion} aria-live={presentation.liveRegion === "status" ? "polite" : undefined} aria-atomic="true">{announcement}</p> : null}
      <section className={`mt-5 w-full rounded-2xl border px-4 py-3 text-left ${style.classes}`} aria-labelledby="speaking-feedback-title">
        <div className="flex items-start gap-3">
          <StatusIcon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 ref={headingRef} tabIndex={-1} id="speaking-feedback-title" className="m-0 rounded-lg text-base font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/30">{presentation.heading}</h2>
            <p className="mb-0 mt-1 text-sm leading-relaxed">{supportingText}</p>
            {!hasOutcome && presentation.issue ? <p className="mb-0 mt-1 text-sm leading-relaxed">{presentation.issue.recovery}</p> : null}
          </div>
        </div>
      </section>
      {presentation.transcript ? <p className="mb-0 mt-2 w-full rounded-xl bg-slate-50 px-3 py-2 text-left text-sm text-slate-600"><span className="font-bold">{presentation.transcript.label}:</span> <span>{presentation.transcript.value}</span></p> : null}
    </>
  );
}

function PageFrame({ children }) {
  return <main className="mx-auto grid min-h-full w-full place-items-center px-4 py-8">{children}</main>;
}

function PageState({ presentation, onExit = null, onRetry = null }) {
  return (
    <PageFrame>
      <section className="w-full max-w-[34rem] rounded-3xl border border-[#cfe3f6] bg-white p-[clamp(1.25rem,5vw,2rem)] text-center shadow-[0_16px_36px_rgb(30_41_59/6%)]" role={presentation.liveRegion ?? "alert"} aria-atomic="true">
        <h1 className="text-2xl font-black text-slate-900">{presentation.heading}</h1>
        <p className="leading-relaxed text-slate-600">{presentation.description}</p>
        {presentation.issue ? <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#b9d8f4] bg-[#f2f8fd] p-3 text-left text-sm leading-relaxed text-[#285f96]"><CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><div><p className="m-0 font-bold">{presentation.issue.message}</p><p className="mb-0 mt-1">{presentation.issue.recovery}</p></div></div> : null}
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {onRetry ? <button type="button" className={PRIMARY_BUTTON_CLASSES} onClick={onRetry}>Thử lại</button> : null}
          {onExit ? <button type="button" className={SECONDARY_BUTTON_CLASSES} onClick={onExit}>{presentation.actions.exit.label}</button> : null}
        </div>
      </section>
    </PageFrame>
  );
}
