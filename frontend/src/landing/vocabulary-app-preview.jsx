import {
  BookOpen,
  Check,
  CircleUserRound,
  Layers3,
  Mic2,
  Repeat2,
  Sparkles,
} from "lucide-react";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";

const previewWords = [
  { number: "01", word: "curious", meaning: "tò mò", active: true },
  { number: "02", word: "resilient", meaning: "kiên cường" },
  { number: "03", word: "achieve", meaning: "đạt được" },
];

const FLIP_DURATION_MS = 600;
const AUTO_REVEAL_DELAY_MS = 2500;
const AUTO_RETURN_DELAY_MS = 2000;

export const VocabularyAppPreview = forwardRef(function VocabularyAppPreview(_, ref) {
  const [isRevealed, setIsRevealed] = useState(false);
  const cardRef = useRef(null);
  const timersRef = useRef(new Set());
  const transitionLockedRef = useRef(false);
  const manualInteractionRef = useRef(false);
  const automaticStartedRef = useRef(false);
  const automaticFinishedRef = useRef(false);
  const isMountedRef = useRef(true);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current.clear();
    transitionLockedRef.current = false;
  }, []);

  const schedule = useCallback((callback, delay) => {
    const timer = window.setTimeout(() => {
      timersRef.current.delete(timer);
      if (isMountedRef.current) callback();
    }, delay);
    timersRef.current.add(timer);
  }, []);

  const lockTransition = useCallback(() => {
    transitionLockedRef.current = true;
    schedule(() => { transitionLockedRef.current = false; }, FLIP_DURATION_MS);
  }, [schedule]);

  const flipManually = useCallback(() => {
    if (manualInteractionRef.current && transitionLockedRef.current) return;
    manualInteractionRef.current = true;
    automaticFinishedRef.current = true;
    clearTimers();
    setIsRevealed((current) => !current);
    lockTransition();
  }, [clearTimers, lockTransition]);

  useEffect(() => {
    isMountedRef.current = true;
    const card = cardRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!card || reduceMotion || typeof IntersectionObserver === "undefined") {
      automaticFinishedRef.current = true;
      return () => {
        isMountedRef.current = false;
        clearTimers();
      };
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) {
        if (automaticStartedRef.current && !automaticFinishedRef.current) {
          automaticFinishedRef.current = true;
          clearTimers();
          setIsRevealed(false);
        }
        return;
      }
      if (automaticStartedRef.current || automaticFinishedRef.current || manualInteractionRef.current) return;

      automaticStartedRef.current = true;
      schedule(() => {
        if (manualInteractionRef.current || automaticFinishedRef.current) return;
        setIsRevealed(true);
        lockTransition();
        schedule(() => {
          if (manualInteractionRef.current || automaticFinishedRef.current) return;
          setIsRevealed(false);
          automaticFinishedRef.current = true;
          lockTransition();
        }, AUTO_RETURN_DELAY_MS);
      }, AUTO_REVEAL_DELAY_MS);
    }, { threshold: 0.45 });

    observer.observe(card);
    return () => {
      isMountedRef.current = false;
      observer.disconnect();
      clearTimers();
    };
  }, [clearTimers, lockTransition, schedule]);

  return (
    <section
      ref={ref}
      id="san-pham-demo"
      tabIndex={-1}
      aria-labelledby="demo-title"
      className="landing-preview-continuity scroll-mt-24 px-4 pb-20 outline-none sm:px-6 lg:px-8 lg:pb-28"
    >
      <div className="mx-auto w-full max-w-[1120px]">
        <div className="mb-5 flex flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold tracking-[0.08em] text-[#3978b6] uppercase">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Bản xem trước minh họa
          </span>
          <h2 id="demo-title" className="mt-3 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Một không gian học tập tập trung và dễ sử dụng
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Nội dung dưới đây là bản demo tĩnh, không phải dữ liệu hay kết quả học tập của người dùng.
          </p>
        </div>

        <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_32px_80px_rgb(39_63_122/16%)] sm:rounded-[2rem]">
          <div className="flex min-h-12 items-center gap-2 border-b border-slate-200 bg-slate-50 px-4" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-rose-300" />
            <span className="size-2.5 rounded-full bg-amber-300" />
            <span className="size-2.5 rounded-full bg-emerald-300" />
            <div className="mx-auto flex h-7 w-[min(55%,22rem)] items-center justify-center rounded-lg border border-slate-200 bg-white text-[0.65rem] font-medium text-slate-400">
              ELVocab · Bản demo
            </div>
          </div>

          <div className="grid min-h-[31rem] bg-[#f8faff] md:grid-cols-[13.5rem_minmax(0,1fr)]">
            <aside className="hidden border-r border-slate-200 bg-white p-5 md:block" aria-labelledby="preview-index-title">
              <div className="flex items-start gap-2.5">
                <span className="grid size-8 place-items-center rounded-lg bg-[#4b8ccc] text-white">
                  <BookOpen className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 id="preview-index-title" className="text-sm font-extrabold leading-5 text-slate-900">Giao tiếp hằng ngày</h3>
                  <p className="mt-0.5 text-[0.68rem] leading-4 text-slate-500">Danh sách từ vựng</p>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between text-[0.68rem] font-bold text-slate-500">
                <span>Vị trí xem demo</span>
                <span aria-label="Từ số 1 trên tổng số 3 từ">01 / 03</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                <span className="block h-full w-1/3 rounded-full bg-[#63a0e0]" />
              </div>
              <ol className="mt-5 space-y-2" aria-label="Từ vựng trong bản demo">
                {previewWords.map((item) => (
                  <li
                    key={item.word}
                    aria-current={item.active ? "true" : undefined}
                    className={`rounded-xl border px-3 py-3 ${item.active ? "border-[#b9d9f6] bg-[#f0f7ff]" : "border-transparent bg-transparent"}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className={`mt-0.5 text-[0.62rem] font-extrabold ${item.active ? "text-[#3978b6]" : "text-slate-400"}`}>{item.number}</span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-bold ${item.active ? "text-[#3978b6]" : "text-slate-700"}`}>{item.word}</p>
                        <p className="mt-1 text-[0.68rem] text-slate-500">{item.meaning}</p>
                      </div>
                      {item.active ? <Check className="size-3.5 text-[#4b8ccc]" aria-hidden="true" /> : null}
                    </div>
                  </li>
                ))}
              </ol>
            </aside>

            <div className="min-w-0 p-4 sm:p-7 lg:p-10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold tracking-[0.12em] text-[#4ca2e6] uppercase">Flashcard minh họa</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">Giao tiếp hằng ngày</h3>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                  <CircleUserRound className="size-4 text-[#4ca2e6]" aria-hidden="true" />
                  Chế độ demo
                </div>
              </div>

              <div className="preview-learning-layout mt-5 grid gap-4 sm:mt-6 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_13rem]" data-testid="preview-learning-layout">
                <button
                  ref={cardRef}
                  type="button"
                  data-testid="preview-flashcard"
                  data-face={isRevealed ? "back" : "front"}
                  aria-label={`Thẻ curious đang hiển thị mặt ${isRevealed ? "sau" : "trước"}. Nhấn để lật thẻ.`}
                  aria-pressed={isRevealed}
                  className="preview-flip-stage order-2 relative grid min-h-72 cursor-pointer border-0 bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#b9d9f6] focus-visible:ring-offset-2 sm:min-h-[20rem] lg:order-none"
                  onClick={flipManually}
                >
                  <span className={`preview-card-flipper relative grid min-h-72 min-w-0 rounded-[1.5rem] border border-blue-100 bg-white shadow-[0_18px_45px_rgb(59_91_219/9%)] sm:min-h-[20rem] ${isRevealed ? "is-revealed" : ""}`}>
                    <span className="preview-card-face relative flex min-h-72 flex-col items-center justify-center overflow-hidden rounded-[inherit] px-5 py-6 text-center sm:min-h-[20rem] sm:px-6 sm:py-8" aria-hidden={isRevealed} inert={isRevealed || undefined}>
                      <span className="absolute -right-12 -top-12 size-36 rounded-full bg-blue-50" aria-hidden="true" />
                      <span className="absolute -bottom-16 -left-10 size-40 rounded-full bg-cyan-50" aria-hidden="true" />
                      <span className="relative rounded-full bg-[#edf7fe] px-3 py-1 text-xs font-bold text-[#237fc4]">Tính từ</span>
                      <strong className="relative mt-5 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">curious</strong>
                      <span className="relative mt-3 text-sm font-medium text-slate-400">/ˈkjʊə.ri.əs/</span>
                      <span className="relative mt-7 text-xs font-semibold text-slate-400">Nhấn để xem nghĩa</span>
                    </span>
                    <span className="preview-card-face preview-card-back relative flex min-h-72 flex-col items-center justify-center overflow-hidden rounded-[inherit] px-5 py-6 text-center sm:min-h-[20rem] sm:px-6 sm:py-8" aria-hidden={!isRevealed} inert={!isRevealed || undefined}>
                      <span className="rounded-full bg-[#edf7fe] px-3 py-1 text-xs font-bold text-[#237fc4]">Nghĩa tiếng Việt</span>
                      <strong className="mt-5 text-2xl font-extrabold text-[#3978b6]">tò mò, ham tìm hiểu</strong>
                      <span className="mt-6 w-full max-w-md rounded-2xl bg-slate-50 px-5 py-4">
                        <span className="block text-sm font-semibold leading-6 text-slate-700">She is curious about how languages work.</span>
                        <span className="mt-2 block text-xs leading-5 text-slate-500">Cô ấy tò mò về cách ngôn ngữ hoạt động.</span>
                      </span>
                      <span className="mt-5 text-xs font-semibold text-slate-400">Nhấn để xem lại từ</span>
                    </span>
                  </span>
                </button>

                <div className="order-1 grid grid-cols-3 gap-2 lg:order-none lg:grid-cols-1 lg:gap-3" data-testid="preview-capability-grid">
                  <PreviewMode icon={Layers3} label="Flashcard" detail="Học theo từng thẻ" active />
                  <PreviewMode icon={Check} label="Trắc nghiệm" detail="4 lựa chọn Anh → Việt" />
                  <PreviewMode icon={Mic2} label="Luyện nói" detail="Phản hồi nhận dạng" />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-center gap-4">
                <p className="text-center text-xs font-semibold text-slate-400">Minh họa giao diện học</p>
                <button type="button" className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-[#4b8ccc] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#3978b6] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#b9d9f6] focus-visible:ring-offset-2 motion-reduce:transition-none" onClick={flipManually}>
                  <Repeat2 className="size-4" aria-hidden="true" />
                  Lật thẻ
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});

function PreviewMode({ icon: Icon, label, detail, active = false }) {
  return (
    <div className={`grid min-h-20 min-w-0 place-items-center content-center rounded-xl border p-2 text-center lg:min-h-0 lg:place-items-start lg:rounded-2xl lg:p-4 lg:text-left ${active ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"}`}>
      <span className={`grid size-8 place-items-center rounded-lg lg:size-9 lg:rounded-xl ${active ? "bg-[#4b8ccc] text-white" : "bg-slate-100 text-slate-500"}`}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <p className="mt-2 w-full text-[0.68rem] font-bold leading-4 text-slate-800 sm:text-xs lg:mt-3 lg:text-sm">{label}</p>
      <p className="mt-1 hidden text-xs leading-5 text-slate-500 lg:block">{detail}</p>
    </div>
  );
}
