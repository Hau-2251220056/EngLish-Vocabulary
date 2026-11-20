import { LoaderCircle } from "lucide-react";

export function LoadingIndicator({ focusRef, label, variant = "inline" }) {
  const centered = variant === "centered";

  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className={centered
        ? "flex flex-col items-center gap-3 rounded-lg text-center text-sm font-semibold text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)]"
        : "inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)]"}
      ref={focusRef}
      role="status"
      tabIndex={focusRef ? -1 : undefined}
    >
      <span
        className={`${centered ? "size-10 rounded-xl" : "size-7 rounded-lg"} grid shrink-0 place-items-center bg-sky-50 text-[#0877b9]`}
        aria-hidden="true"
      >
        <LoaderCircle className={`${centered ? "size-5" : "size-4"} animate-spin motion-reduce:animate-none`} />
      </span>
      <span>{label}</span>
    </div>
  );
}
