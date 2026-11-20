import { LoadingIndicator } from "../components/loading-indicator.jsx";

export function SetDetailLoadingSkeleton({ focusRef }) {
  return (
    <div className="mt-5">
      <LoadingIndicator focusRef={focusRef} label="Đang tải bộ từ…" variant="centered" />
      <div className="mt-6 grid gap-5" aria-hidden="true">
        <div className="grid gap-3">
          <span className="h-8 w-2/5 max-w-72 animate-pulse rounded-xl bg-sky-100 motion-reduce:animate-none" />
          <span className="h-4 w-3/5 max-w-xl animate-pulse rounded-full bg-slate-100 motion-reduce:animate-none" />
          <span className="h-4 w-2/5 max-w-md animate-pulse rounded-full bg-slate-100 motion-reduce:animate-none" />
        </div>
        <div className="flex gap-3 max-[640px]:flex-col">
          <span className="h-11 w-36 animate-pulse rounded-xl bg-sky-100 motion-reduce:animate-none max-[640px]:w-full" />
          <span className="h-11 w-32 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none max-[640px]:w-full" />
        </div>
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <span className="h-5 w-44 animate-pulse rounded-full bg-sky-100 motion-reduce:animate-none" />
          {[0, 1, 2].map((row) => (
            <span className="h-12 animate-pulse rounded-xl bg-slate-50 motion-reduce:animate-none" key={row} />
          ))}
        </div>
      </div>
    </div>
  );
}
