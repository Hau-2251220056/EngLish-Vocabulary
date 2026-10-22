import elVocabLogo from "../assets/images/logo.png";
import elVocabMobileLogo from "../assets/logo_mobile.png";

export function LandingPageLoadingState() {
  return (
    <div
      className="min-h-screen overflow-x-hidden bg-white text-slate-800"
      data-testid="landing-loading-state"
    >
      <header className="border-b border-slate-200/80 bg-white/90">
        <div className="mx-auto flex min-h-18 w-full max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="inline-flex min-h-11 shrink-0 items-center" aria-hidden="true">
            <img className="h-10 w-auto sm:hidden" src={elVocabMobileLogo} alt="" />
            <img className="hidden h-10 w-auto sm:block" src={elVocabLogo} alt="" />
          </div>
          <div
            className="hidden items-center gap-3 md:flex"
            data-testid="landing-loading-navbar-placeholder"
            aria-hidden="true"
          >
            <span className="h-3 w-16 rounded-full bg-slate-100" />
            <span className="h-3 w-24 rounded-full bg-slate-100" />
            <span className="ml-3 h-11 w-24 rounded-xl bg-slate-100" />
            <span className="h-11 w-36 rounded-xl bg-blue-100/80" />
          </div>
          <div className="size-11 rounded-xl border border-slate-200 bg-slate-50 md:hidden" aria-hidden="true" />
        </div>
      </header>

      <main className="landing-hero-grid relative overflow-hidden px-4 pb-14 pt-16 sm:px-6 sm:pb-18 sm:pt-20 lg:px-8 lg:pb-20 lg:pt-24">
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
          <div className="absolute left-[8%] top-32 size-20 rounded-full bg-cyan-100/55 blur-2xl" />
          <div className="absolute right-[9%] top-52 size-24 rounded-full bg-blue-100/70 blur-2xl" />
        </div>

        <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center">
          <div
            className="flex w-full max-w-3xl animate-pulse flex-col items-center motion-reduce:animate-none"
            data-testid="landing-loading-hero-skeleton"
            aria-hidden="true"
          >
            <div className="h-7 w-48 rounded-full bg-blue-100/80 sm:w-56" />
            <div className="mt-8 h-11 w-[min(100%,38rem)] rounded-2xl bg-slate-100 sm:h-16" />
            <div className="mt-3 h-11 w-[min(82%,31rem)] rounded-2xl bg-blue-100/70 sm:h-16" />
            <div className="mt-7 h-4 w-[min(90%,34rem)] rounded-full bg-slate-100" />
            <div className="mt-3 h-4 w-[min(72%,27rem)] rounded-full bg-slate-100" />
            <div className="mt-9 grid w-full max-w-sm grid-cols-[1.15fr_0.85fr] gap-2 sm:max-w-md sm:gap-3">
              <div className="h-12 rounded-xl bg-blue-200/80" />
              <div className="h-12 rounded-xl border border-slate-200 bg-white" />
            </div>
          </div>

          <p className="sr-only" role="status" aria-live="polite">
            Đang tải ELVocab…
          </p>
        </div>
      </main>
    </div>
  );
}
