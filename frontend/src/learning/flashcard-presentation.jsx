import { ArrowLeft, LoaderCircle, RotateCcw, Volume2 } from "lucide-react";
import { Link } from "react-router-dom";

const TOOLBAR_BUTTON_CLASSES = "inline-flex min-h-11 min-w-0 cursor-pointer items-center gap-2 border-0 bg-transparent px-0 font-extrabold text-slate-700 no-underline focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] disabled:cursor-not-allowed disabled:opacity-60";
const AUDIO_BUTTON_CLASSES = "inline-flex size-11 min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-[var(--accent-primary-soft)] p-0 text-[var(--accent-primary-pressed)] transition-[transform,background-color,color,box-shadow] duration-150 hover:not-disabled:-translate-y-px hover:not-disabled:bg-[#dceffd] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-primary-focus)] disabled:cursor-not-allowed disabled:opacity-[0.58] motion-reduce:transform-none motion-reduce:transition-none [&_svg]:size-[1.3rem]";
const RATING_BUTTON_BASE = "inline-flex min-h-11 cursor-pointer items-center justify-center border-2 font-[inherit] focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-[0.58]";
const RATING_BUTTON_CLASSES = {
  AGAIN: `${RATING_BUTTON_BASE} border-red-400 text-red-700 hover:not-disabled:bg-red-50 focus-visible:ring-red-300`,
  HARD: `${RATING_BUTTON_BASE} border-amber-400 text-amber-700 hover:not-disabled:bg-amber-50 focus-visible:ring-amber-300`,
  GOOD: `${RATING_BUTTON_BASE} border-[var(--accent-primary)] text-[var(--accent-primary-pressed)] hover:not-disabled:bg-[var(--accent-primary-soft)] focus-visible:ring-[var(--accent-primary-focus)]`,
  EASY: `${RATING_BUTTON_BASE} border-emerald-400 text-emerald-700 hover:not-disabled:bg-emerald-50 focus-visible:ring-emerald-300`,
};

export function FlashcardToolbar({
  backHref,
  backLabel,
  badge = null,
  children,
  disabled = false,
  innerClassName = "flex min-h-[3.5rem] flex-wrap justify-between",
  onBack,
  onRestart,
  restartLabel = "Bắt đầu lại",
}) {
  const backContent = <><ArrowLeft className="shrink-0" aria-hidden="true" /><span className="max-w-52 truncate">{backLabel}</span></>;
  return (
    <header className="learning-toolbar w-full shrink-0 border-b border-slate-200">
      <div className={`learning-toolbar-inner mx-auto w-full max-w-[75rem] ${innerClassName} items-center gap-x-4 gap-y-1.5 px-[clamp(0.8rem,3vw,2rem)] py-1.5 max-[700px]:py-1`}>
        <div className="flex min-w-0 items-center gap-2">
          {backHref
            ? <Link className={TOOLBAR_BUTTON_CLASSES} to={backHref}>{backContent}</Link>
            : <button type="button" className={TOOLBAR_BUTTON_CLASSES} onClick={onBack} disabled={disabled}>{backContent}</button>}
          {badge ? <span className="learning-review-context-badge inline-flex shrink-0 rounded-full border border-[#cfe8f8] bg-[var(--accent-primary-soft)] px-2.5 py-1 text-xs font-bold text-[var(--accent-primary-pressed)]">{badge}</span> : null}
        </div>
        {children}
        {onRestart ? (
          <div className="group relative ml-auto">
            <button type="button" className="inline-flex size-11 cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white p-0 text-slate-700 transition-colors hover:not-disabled:border-[var(--accent-primary)] hover:not-disabled:bg-[var(--accent-primary-soft)] hover:not-disabled:text-[var(--accent-primary-pressed)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:size-[1.15rem]" onClick={onRestart} disabled={disabled} aria-label={restartLabel} aria-describedby="learning-restart-tooltip"><RotateCcw aria-hidden="true" /></button>
            <span id="learning-restart-tooltip" role="tooltip" className="learning-restart-tooltip pointer-events-none absolute right-0 top-full z-20 mt-2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none">{restartLabel}</span>
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function FlashcardProgress({ label, max, value, valueLabel }) {
  return (
    <section className="learning-progress mb-[0.55rem] mt-[0.15rem] shrink-0" aria-label={label}>
      <div className="mb-[0.3rem] flex items-center justify-between gap-4 text-[0.84rem] font-extrabold text-slate-600">
        <span>{label}</span>
        <span>{valueLabel}</span>
      </div>
      <progress className="h-[0.45rem] w-full overflow-hidden rounded-full border-0 bg-slate-200 accent-[var(--accent-primary)]" value={value} max={max}>{value}/{max}</progress>
    </section>
  );
}

export function FlashcardCard({
  answerHeadingRef,
  audioAvailable = false,
  audioDisabled,
  busy = false,
  card,
  cardHeadingRef,
  disabled = false,
  interactionRef,
  interactive = false,
  meaning,
  onAudio,
  onCardClick,
  overlay = null,
  revealed,
}) {
  const audioIsDisabled = audioDisabled ?? disabled;

  function handleKeyDown(event) {
    if (!interactive || disabled || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    onCardClick?.(event);
  }

  const visibleFaceLabel = revealed
    ? meaning?.meaning_vi || "Chưa có nghĩa phù hợp để hiển thị."
    : card.word;
  const interaction = interactive ? {
    "aria-label": visibleFaceLabel,
    "aria-pressed": revealed,
    onKeyDown: handleKeyDown,
    role: "button",
    tabIndex: 0,
  } : {};

  const audioButton = audioAvailable && !interactive ? (
    <button type="button" className={AUDIO_BUTTON_CLASSES} onClick={onAudio} disabled={audioIsDisabled} aria-label={`Phát âm từ ${card.word}`} title="Phát âm"><Volume2 aria-hidden="true" /></button>
  ) : null;

  return (
    <div className="learning-flip-stage relative grid min-h-[22rem] w-full shrink-0 cursor-pointer self-center rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] lg:min-h-96 max-[700px]:min-h-56 max-[700px]:rounded-[1.1rem]" aria-busy={busy || undefined} onClick={onCardClick} ref={interactionRef} {...interaction}>
      <div className={`learning-card-flipper relative grid min-h-0 min-w-0 rounded-3xl border border-[#b9dcf6] bg-white shadow-[0_16px_36px_rgb(30_41_59/8%)] focus-within:ring-1 focus-within:ring-[var(--accent-primary-focus)] max-[700px]:rounded-[1.1rem] ${revealed ? "is-revealed" : ""}`}>
        <section className="learning-card relative flex min-h-0 min-w-0 w-full flex-col rounded-[inherit] p-[clamp(1.1rem,2.5vw,1.75rem)] max-[700px]:p-4" aria-labelledby="learning-card-word" aria-hidden={revealed} inert={revealed || undefined}>
          <div className="learning-front-content flex min-h-0 flex-1 items-center justify-center">
            <div className="flex max-w-full flex-col items-center">
              <span className="rounded-full bg-[var(--accent-primary-soft)] px-[0.65rem] py-[0.35rem] text-[0.72rem] font-black uppercase tracking-[0.08em] text-[var(--accent-primary-pressed)]">Từ vựng</span>
              <h2 id="learning-card-word" className={`mt-[clamp(0.75rem,2vh,1.25rem)] max-w-full [overflow-wrap:anywhere] text-center font-black leading-none text-zinc-950 focus-visible:outline-0 max-[700px]:mt-[0.8rem] ${wordSizeClasses(card.word.length)}`} ref={cardHeadingRef} tabIndex={-1}>{card.word}</h2>
              {card.phonetic ? <p className="mb-0 mt-[0.45rem] text-center text-[clamp(1rem,2vw,1.25rem)] text-slate-500">{card.phonetic}</p> : null}
              {audioButton ? <div className="mt-[0.55rem] flex justify-center">{audioButton}</div> : null}
            </div>
          </div>
          <p className="mb-0 mt-auto pt-[0.8rem] text-center text-[0.78rem] text-slate-400">Nhấn hoặc Space để lật thẻ</p>
        </section>
        <section className="learning-card learning-card-back relative min-h-0 min-w-0 w-full rounded-[inherit] p-[clamp(1rem,2.2vw,1.5rem)] max-[700px]:p-4" aria-labelledby={`meaning-${meaning?.id ?? "unavailable"}`} aria-hidden={!revealed} inert={!revealed || undefined}>
          <header className="border-b border-slate-200 pb-2">
            <div className="flex max-w-full items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className={`m-0 min-w-0 max-w-full [overflow-wrap:anywhere] text-left font-black leading-none text-[var(--accent-primary-pressed)] ${wordSizeClasses(card.word.length, true)}`}>{card.word}</h2>
                {card.phonetic ? <p className="mb-0 mt-[0.3rem] text-left text-[clamp(1rem,2vw,1.25rem)] text-slate-500">{card.phonetic}</p> : null}
              </div>
              {audioButton}
            </div>
            {meaning ? <div className="mt-[0.4rem] flex flex-wrap gap-2 [&_span]:rounded-full [&_span]:bg-[var(--accent-primary-soft)] [&_span]:px-[0.65rem] [&_span]:py-[0.3rem] [&_span]:text-[0.78rem] [&_span]:font-extrabold [&_span]:text-[var(--accent-primary-pressed)]"><span>{meaning.part_of_speech}</span>{meaning.cefr_level ? <span>{meaning.cefr_level}</span> : null}</div> : null}
          </header>
          <div className="m-0 max-w-[43rem] pt-[0.65rem]">
            {meaning ? (
              <article aria-labelledby={`meaning-${meaning.id}`}>
                <h3 className="m-0 text-[clamp(1.45rem,3.2vw,2rem)] leading-[1.3] text-slate-900 focus-visible:outline-0" id={`meaning-${meaning.id}`} ref={answerHeadingRef} tabIndex={-1}>{meaning.meaning_vi}</h3>
                {meaning.context ? <p className="my-[0.45rem] border-l-[3px] border-[#a9d5f4] pl-[0.75rem] leading-[1.55] text-slate-600">Ngữ cảnh: {meaning.context}</p> : null}
                {meaning.examples.length > 0 ? <div className="mt-2"><h4 className="m-0 text-[0.9rem] text-slate-700">Ví dụ</h4><ul className="mb-0 mt-[0.3rem] grid list-none gap-[0.4rem] p-0">{meaning.examples.slice(0, 1).map((example) => <li className="rounded-xl bg-slate-100 px-3 py-[0.45rem]" key={example.id}><p className="m-0 font-bold leading-[1.5] text-slate-800">{example.example_en}</p>{example.example_vi ? <span className="mt-1 block leading-[1.45] text-slate-500">{example.example_vi}</span> : null}</li>)}</ul></div> : null}
              </article>
            ) : <p id="meaning-unavailable">Chưa có nghĩa phù hợp để hiển thị.</p>}
          </div>
        </section>
      </div>
      {overlay}
    </div>
  );
}

export function SrsRatingControls({ disabled = false, items, onRate, pendingRating = null, revealed }) {
  if (!revealed) return <p className="m-0 text-sm text-slate-500">Lật thẻ để chọn mức độ ghi nhớ.</p>;
  return (
    <section className="grid w-full grid-cols-4 gap-2 max-[520px]:grid-cols-2" aria-label="Đánh giá SRS">
      {items.map(({ label, rating, subLabel }) => (
        <button key={rating} type="button" className={`${RATING_BUTTON_CLASSES[rating]} relative h-14 min-w-0 w-full flex-col gap-0.5 rounded-xl bg-white px-2 py-2 shadow-none`} aria-label={`${label}, ${subLabel}`} onClick={() => onRate(rating)} disabled={disabled} aria-busy={pendingRating === rating}>
          <span className="inline-flex items-center justify-center gap-1.5">
            {pendingRating === rating ? <LoaderCircle className="size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
            <span className="font-extrabold leading-tight">{label}</span>
          </span>
          <span className="text-[0.72rem] font-semibold leading-tight opacity-80">{subLabel}</span>
        </button>
      ))}
    </section>
  );
}

function wordSizeClasses(length, back = false) {
  if (length > 36) return back ? "text-[clamp(1.2rem,2.7vw,1.8rem)]" : "text-[clamp(1.35rem,3.4vw,2.35rem)] leading-[1.15]";
  if (length > 20) return back ? "text-[clamp(1.45rem,3.3vw,2.25rem)]" : "text-[clamp(1.8rem,4.5vw,3.25rem)] leading-[1.08]";
  return back ? "text-[clamp(1.8rem,4vw,2.8rem)]" : "text-[clamp(2.4rem,6vw,4.5rem)]";
}
