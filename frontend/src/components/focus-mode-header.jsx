import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const BACK_CLASSES = "inline-flex min-h-11 min-w-0 cursor-pointer items-center gap-2 overflow-hidden rounded-lg border-0 bg-transparent px-0 font-extrabold text-slate-700 no-underline transition-colors hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:size-[1.15rem]";

export function FocusModeHeader({
  actions = null,
  backHref = null,
  backLabel,
  children = null,
  className = "",
  contextLabel,
  disabled = false,
  innerClassName = "flex min-h-14 flex-wrap justify-between",
  maxWidthClassName = "max-w-[72rem]",
  onBack = null,
  titleBadge = null,
}) {
  const backContent = <><ArrowLeft className="shrink-0" aria-hidden="true" /><span className="max-w-[min(13rem,52vw)] truncate">{backLabel}</span></>;
  return (
    <header className={`focus-mode-header w-full shrink-0 border-b border-slate-200 bg-white/95 ${className}`.trim()}>
      <div className={`focus-mode-header-inner mx-auto w-full ${maxWidthClassName} ${innerClassName} items-center gap-x-4 gap-y-1.5 px-[clamp(0.8rem,3vw,2rem)] py-1.5 max-[700px]:py-1`}>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {backHref
            ? <Link className={BACK_CLASSES} to={backHref}>{backContent}</Link>
            : <button aria-label={`Quay lại ${backLabel}`} className={BACK_CLASSES} disabled={disabled} onClick={onBack} title={backLabel} type="button">{backContent}</button>}
          {titleBadge ? <span className="focus-mode-title-badge shrink-0 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-extrabold leading-4 text-sky-700">{titleBadge}</span> : null}
        </div>
        {children}
        <div className="focus-mode-header-context ml-auto flex shrink-0 items-center justify-end gap-2">
          {contextLabel ? <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-extrabold text-sky-700">{contextLabel}</span> : null}
          {actions}
        </div>
      </div>
    </header>
  );
}
