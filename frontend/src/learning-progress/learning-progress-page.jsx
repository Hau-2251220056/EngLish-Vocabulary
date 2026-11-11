import {
  AlertTriangle,
  BookOpen,
  Check,
  Clock3,
  Flame,
  RefreshCw,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { learningService } from "../services/learning-service.js";
import { learningSessionService } from "../services/learning-session-service.js";

const FOCUS_CLASSES = "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#0877b9]/30";
const ACTION_BUTTON_CLASSES = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#0877b9] bg-[#0877b9] px-4 font-[inherit] text-sm font-extrabold text-white hover:bg-[#075f95] ${FOCUS_CLASSES}`;
const SUMMARY_STYLES = {
  total: { card: "border-[#b9e7ef] bg-[#f0fbfd]", icon: "bg-white text-[#0e7490]", label: "text-[#0e667c]" },
  learned: { card: "border-[#bbe8d0] bg-[#f0fdf7]", icon: "bg-white text-[#08703f]", label: "text-[#08703f]" },
  learning: { card: "border-[#f8d89a] bg-[#fffaeb]", icon: "bg-white text-[#a85b00]", label: "text-[#8a4b00]" },
  review: { card: "border-[#f7cbd2] bg-[#fff5f6]", icon: "bg-white text-[#ae2637]", label: "text-[#9f2434]" },
};
const ACTIVITY_META = {
  ACTIVE: { label: "Có hoạt động", marker: "border-[#76c99b] bg-[#dff7e9] text-[#08703f]" },
  INACTIVE: { label: "Không có hoạt động", marker: "border-[#cbd5e1] bg-white text-slate-400" },
  UNAVAILABLE: { label: "Chưa có dữ liệu", marker: "border-[#f0cf92] bg-[#fff8e8] text-[#9a6700]" },
};

export function LearningProgressPage() {
  const progress = useProgressSource();
  const streak = useStreakSource();

  return (
    <section
      aria-busy={progress.status === "loading"}
      aria-labelledby="learning-progress-title"
      className="learning-progress-page mx-auto min-w-0 w-full max-w-[1180px] px-[clamp(0.75rem,3vw,2.75rem)] pb-12 pt-[clamp(1.25rem,3vw,2.5rem)] text-slate-800"
    >
      <header className="learning-progress-heading mb-7 max-w-[720px] max-sm:mb-5">
        <h1 className="m-0 text-balance text-[clamp(1.8rem,3vw,2.4rem)] font-extrabold leading-tight tracking-[-0.035em] text-slate-950" id="learning-progress-title">
          Tiến độ học tập
        </h1>
        <p className="mb-0 mt-2 text-pretty leading-relaxed text-slate-600 max-sm:text-sm">
          Xem những bước bạn đã đi qua và giữ nhịp học đều mỗi ngày.
        </p>
      </header>

      {progress.status === "loading" ? <ProgressLoadingState /> : null}
      {progress.status === "error" ? <ProgressErrorState onRetry={progress.retry} /> : null}
      {progress.status === "success" ? <ProgressContent data={progress.data} streak={streak} /> : null}
    </section>
  );
}

function ProgressContent({ data, streak }) {
  return (
    <div className="space-y-6 max-sm:space-y-4">
      <SummaryCards summary={data.summary} />
      <ActivityWeek activity={data.streak_activity_7d} />
      <LearningOverview streak={streak} xp={data.xp_level} />
    </div>
  );
}

function SummaryCards({ summary }) {
  const cards = [
    { key: "total", label: "Từ đã học", value: summary.total_started, icon: <BookOpen aria-hidden="true" />, note: "Đã bắt đầu học, chưa nhất thiết đã thuộc." },
    { key: "learned", label: "Đã thuộc", value: summary.learned, icon: <Check aria-hidden="true" /> },
    { key: "learning", label: "Đang học", value: summary.learning, icon: <RefreshCw aria-hidden="true" /> },
    { key: "review", label: "Cần ôn", value: summary.needs_review, icon: <Clock3 aria-hidden="true" /> },
  ];

  return (
    <section aria-label="Tóm tắt tiến độ" className="learning-progress-summary grid min-w-0 grid-cols-4 items-stretch gap-4 max-[900px]:grid-cols-2 max-[420px]:gap-2.5">
      {cards.map((card) => {
        const styles = SUMMARY_STYLES[card.key];
        return (
          <article className={`learning-progress-summary-card flex min-h-36 min-w-0 flex-col rounded-2xl border p-4 shadow-[0_10px_24px_rgb(15_83_115/6%)] max-[420px]:min-h-[8.25rem] max-[420px]:p-3 ${styles.card}`} key={card.key}>
            <div className="flex min-w-0 items-center gap-2.5 max-[420px]:gap-2">
              <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-xl border border-white/80 shadow-sm max-[420px]:size-9 [&_svg]:size-5 ${styles.icon}`}>{card.icon}</span>
              <p className={`m-0 min-w-0 text-sm font-extrabold leading-tight max-[420px]:text-xs ${styles.label}`}>{card.label}</p>
            </div>
            <strong className="mt-3 block text-3xl font-extrabold leading-none text-slate-950 tabular-nums max-[420px]:text-2xl">{formatNumber(card.value)}</strong>
            <p className="mb-0 mt-1 text-xs font-semibold leading-snug text-slate-600 max-[420px]:text-[0.6875rem]">{card.note ?? "từ vựng"}</p>
          </article>
        );
      })}
    </section>
  );
}

function ActivityWeek({ activity }) {
  const allUnavailable = activity.days.every(({ status }) => status === "UNAVAILABLE");

  return (
    <section aria-labelledby="learning-activity-title" className="rounded-2xl border border-[#c7e3f3] bg-white p-[clamp(1rem,2.5vw,1.5rem)] shadow-[0_12px_30px_rgb(15_83_115/6%)]">
      <div className="flex min-w-0 items-start justify-between gap-4 max-sm:block">
        <div className="min-w-0">
          <h2 className="m-0 text-balance text-xl font-extrabold tracking-[-0.02em] text-slate-950" id="learning-activity-title">Hoạt động 7 ngày qua</h2>
          <p className="mb-0 mt-1 max-w-[700px] text-pretty text-sm leading-relaxed text-slate-600">Một ngày được ghi nhận khi bạn hoàn thành lượt học, ôn SRS hoặc Quiz đủ điều kiện.</p>
        </div>
        <span className="mt-0.5 shrink-0 rounded-full bg-[#e8f7fb] px-3 py-1 text-xs font-bold text-[#0e667c] max-sm:mt-3">7 ngày gần nhất</span>
      </div>

      <ol aria-label="Hoạt động học trong 7 ngày" className="learning-progress-activity-grid mt-5 grid min-w-0 grid-cols-7 gap-2 p-0 max-[420px]:gap-1">
        {activity.days.map((day, index) => {
          const meta = ACTIVITY_META[day.status];
          const dateLabel = formatActivityDate(day.date);
          const isToday = index === activity.days.length - 1;
          return (
            <li aria-label={`${dateLabel.long}: ${meta.label}${isToday ? ", hôm nay" : ""}`} className="flex min-w-0 flex-col items-center text-center" key={day.date}>
              <span className="text-[0.6875rem] font-bold text-slate-500 max-[360px]:text-[0.625rem]">{isToday ? "Nay" : dateLabel.weekday}</span>
              <span aria-hidden="true" className={`mt-2 grid size-10 place-items-center rounded-full border-2 max-[420px]:size-8 ${meta.marker}`}>
                {day.status === "ACTIVE" ? <Check className="size-5 max-[420px]:size-4" /> : day.status === "INACTIVE" ? <span className="size-1.5 rounded-full bg-current" /> : <span className="text-sm font-extrabold">?</span>}
              </span>
              <span className="mt-2 text-[0.6875rem] font-semibold text-slate-600 tabular-nums max-[360px]:text-[0.625rem]">{dateLabel.short}</span>
              <span className="sr-only">{meta.label}</span>
            </li>
          );
        })}
      </ol>

      {allUnavailable ? (
        <p className="mb-0 mt-4 rounded-xl bg-[#fff8e8] px-3 py-2.5 text-sm font-semibold leading-relaxed text-[#7a5200]" role="status">Chưa đủ dữ liệu để xác định hoạt động trong 7 ngày này.</p>
      ) : (
        <ul aria-label="Chú thích hoạt động" className="mt-5 flex list-none flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 px-0 pt-4 text-xs font-semibold text-slate-600">
          {Object.entries(ACTIVITY_META).map(([status, meta]) => <li className="flex items-center gap-1.5" key={status}><span aria-hidden="true" className={`size-3 rounded-full border ${meta.marker}`} />{meta.label}</li>)}
        </ul>
      )}
    </section>
  );
}

function LearningOverview({ streak, xp }) {
  const levelProgress = xp.is_max_level ? 100 : clampPercentage(((xp.total_xp - xp.level_min_xp) / (xp.next_level_xp - xp.level_min_xp)) * 100);

  return (
    <section aria-labelledby="learning-overview-title">
      <h2 className="mb-3 mt-0 text-xl font-extrabold tracking-[-0.02em] text-slate-950" id="learning-overview-title">Tổng quan học tập</h2>
      <div className="grid min-w-0 grid-cols-3 items-stretch gap-4 max-[760px]:grid-cols-1 max-sm:gap-3">
        <article className="min-w-0 rounded-2xl border border-[#c7e3f3] bg-[#f1f9fd] p-4 shadow-[0_10px_24px_rgb(15_83_115/5%)]">
          <p className="m-0 text-sm font-extrabold text-[#075f95]">Level hiện tại</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white text-xl font-extrabold text-[#075f95] shadow-sm tabular-nums">{xp.level}</span>
            <div className="min-w-0 flex-1">
              <div aria-label={`Tiến độ XP Level ${xp.level}`} aria-valuemax={xp.is_max_level ? xp.total_xp : xp.next_level_xp} aria-valuemin={xp.level_min_xp} aria-valuenow={xp.total_xp} className="h-2 overflow-hidden rounded-full bg-[#d8eaf4]" role="progressbar"><span className="block h-full rounded-full bg-[#1684b8]" style={{ width: `${levelProgress}%` }} /></div>
              <p className="mb-0 mt-2 text-xs font-bold text-slate-600">{xp.is_max_level ? "Đã đạt cấp tối đa" : `${formatNumber(xp.total_xp - xp.level_min_xp)} / ${formatNumber(xp.next_level_xp - xp.level_min_xp)} XP`}</p>
            </div>
          </div>
        </article>

        <article className="min-w-0 rounded-2xl border border-[#b9e7ef] bg-[#f0fbfd] p-4 shadow-[0_10px_24px_rgb(15_83_115/5%)]">
          <p className="m-0 text-sm font-extrabold text-[#0e667c]">Tổng XP</p>
          <div className="mt-3 flex items-center gap-3"><span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-xl bg-white text-[#0e7490] shadow-sm"><Zap className="size-6" /></span><p className="m-0 text-2xl font-extrabold text-slate-950 tabular-nums">{formatNumber(xp.total_xp)} <span className="text-sm text-slate-600">XP</span></p></div>
        </article>

        <StreakOverview source={streak} />
      </div>
    </section>
  );
}

function StreakOverview({ source }) {
  return (
    <article aria-busy={source.status === "loading"} className="min-w-0 rounded-2xl border border-[#f8d89a] bg-[#fff9eb] p-4 shadow-[0_10px_24px_rgb(15_83_115/5%)]">
      <p className="m-0 text-sm font-extrabold text-[#8a4b00]">Chuỗi học</p>
      {source.status === "loading" ? <div className="mt-3 h-12 animate-pulse rounded-xl bg-white/80 motion-reduce:animate-none" role="status"><span className="sr-only">Đang tải chuỗi học…</span></div> : null}
      {source.status === "error" ? <div className="mt-2" role="alert"><p className="m-0 text-xs font-semibold leading-relaxed text-red-700">Chưa thể tải chuỗi học.</p><button className={`mt-2 min-h-11 cursor-pointer rounded-lg border border-[#f1c77c] bg-white px-3 text-xs font-extrabold text-[#8a4b00] hover:bg-[#fff4d9] ${FOCUS_CLASSES}`} type="button" onClick={source.retry}>Thử lại</button></div> : null}
      {source.status === "success" ? <div className="mt-3 flex items-center gap-3"><span aria-hidden="true" className={`grid size-12 shrink-0 place-items-center rounded-xl bg-white shadow-sm ${source.data.completed_today ? "text-[#d94a1e]" : "text-slate-400"}`}><Flame className="size-6" /></span><div><p aria-label={`Chuỗi hiện tại ${source.data.current_streak} ngày`} className="m-0 text-2xl font-extrabold text-slate-950 tabular-nums">{source.data.current_streak} <span className="text-sm text-slate-600">ngày</span></p><p className="mb-0 mt-1 text-xs font-semibold text-slate-600">{source.data.completed_today ? "Đã duy trì hôm nay" : "Chưa hoàn thành hôm nay"}</p></div></div> : null}
    </article>
  );
}

function ProgressLoadingState() {
  return (
    <div aria-live="polite" className="learning-progress-loading" role="status">
      <span className="sr-only">Đang tải tiến độ học tập…</span>
      <div aria-hidden="true" className="learning-progress-loading-cards grid grid-cols-4 gap-4 max-[900px]:grid-cols-2 max-[420px]:gap-2.5">
        {Array.from({ length: 4 }, (_, index) => <span className="h-36 animate-pulse rounded-2xl bg-sky-50 motion-reduce:animate-none max-[420px]:h-[8.25rem]" key={index} />)}
      </div>
      <span aria-hidden="true" className="mt-6 block h-52 animate-pulse rounded-2xl bg-slate-50 motion-reduce:animate-none" />
    </div>
  );
}

function ProgressErrorState({ onRetry }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-red-200 bg-white px-4 py-8 text-center" role="alert">
      <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-red-50 text-red-700"><AlertTriangle aria-hidden="true" className="size-7" /></span>
      <h2 className="m-0 text-lg font-extrabold text-slate-900">Không thể tải tiến độ học tập</h2>
      <p className="mb-4 mt-2 max-w-md text-sm leading-relaxed text-slate-600">Vui lòng thử lại để xem dữ liệu mới nhất.</p>
      <button className={ACTION_BUTTON_CLASSES} type="button" onClick={onRetry}><RefreshCw aria-hidden="true" className="size-4" /> Thử lại</button>
    </div>
  );
}

function useProgressSource() {
  const [retryToken, setRetryToken] = useState(0);
  const [state, setState] = useState({ data: null, status: "loading" });
  const requestIdRef = useRef(0);
  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    learningService.getLearningProgress({ page: 1, page_size: 1 })
      .then((data) => { if (requestIdRef.current === requestId) setState({ data, status: "success" }); })
      .catch(() => { if (requestIdRef.current === requestId) setState({ data: null, status: "error" }); });
    return () => { if (requestIdRef.current === requestId) requestIdRef.current += 1; };
  }, [retryToken]);
  function retry() {
    if (state.status === "loading") return;
    setState({ data: null, status: "loading" });
    setRetryToken((value) => value + 1);
  }
  return { ...state, retry };
}

function useStreakSource() {
  const [retryToken, setRetryToken] = useState(0);
  const [state, setState] = useState({ data: null, status: "loading" });
  const requestIdRef = useRef(0);
  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    learningSessionService.getCurrentStreak()
      .then((data) => { if (requestIdRef.current === requestId) setState({ data, status: "success" }); })
      .catch(() => { if (requestIdRef.current === requestId) setState({ data: null, status: "error" }); });
    return () => { if (requestIdRef.current === requestId) requestIdRef.current += 1; };
  }, [retryToken]);
  function retry() {
    if (state.status === "loading") return;
    setState({ data: null, status: "loading" });
    setRetryToken((value) => value + 1);
  }
  return { ...state, retry };
}

function formatActivityDate(value) {
  const instant = new Date(`${value}T00:00:00.000Z`);
  return {
    weekday: new Intl.DateTimeFormat("vi-VN", { weekday: "short", timeZone: "UTC" }).format(instant),
    short: new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(instant),
    long: new Intl.DateTimeFormat("vi-VN", { dateStyle: "long", timeZone: "UTC" }).format(instant),
  };
}

function formatNumber(value) { return value.toLocaleString("vi-VN"); }
function clampPercentage(value) { return Math.min(100, Math.max(0, value)); }
