import { AlertCircle, Clock, Info, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAuthentication } from "../auth/use-authentication.js";
import { readLeaderboard } from "./leaderboard-api.js";
import { PersonalRankCard, RankingTable, SkeletonLoader, TopPodium } from "./leaderboard-presentation.jsx";
import { leaderboardSession } from "./leaderboard-session.js";
import { createLeaderboardView } from "./leaderboard-view.js";

const PERIODS = [["weekly", "Tuần này"], ["monthly", "Tháng này"], ["all", "Toàn thời gian"]];
const timeZone = "Asia/Ho_Chi_Minh";
const dateFormatter = new Intl.DateTimeFormat("en-GB", { timeZone, day: "2-digit", month: "2-digit", year: "numeric" });
const timeFormatter = new Intl.DateTimeFormat("vi-VN", { timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700";

export function LeaderboardPage() {
  const session = useSyncExternalStore(leaderboardSession.subscribe, leaderboardSession.getSnapshot);
  return <section className="mx-auto w-full min-w-0 max-w-5xl space-y-5 px-3.5 py-5 sm:space-y-6 sm:px-6 sm:py-7 lg:px-8" aria-labelledby="leaderboard-title">
    {session ? <LeaderboardSessionPage key={session.generation} session={session} /> : <PageHeader />}
  </section>;
}

function LeaderboardSessionPage({ session }) {
  const { refreshCurrentUser } = useAuthentication();
  const [view] = useState(() => createLeaderboardView({ session, read: readLeaderboard }));
  const { period, page, entry, loading, error, previousPeriod } = useSyncExternalStore(view.subscribe, view.snapshot);
  const data = entry?.data;
  const listTitle = useRef(null);
  const currentRow = useRef(null);
  const pendingJump = useRef(null);

  useEffect(() => view.start(), [view]);
  useEffect(() => {
    if (error === "auth") void refreshCurrentUser();
  }, [error, refreshCurrentUser]);
  useEffect(() => {
    const jump = pendingJump.current;
    if (!jump) return;
    if (jump.period !== period || jump.page !== page || previousPeriod) {
      pendingJump.current = null;
    } else if (data?.pagination.page === jump.page) {
      pendingJump.current = null;
      focusPosition(currentRow.current ?? listTitle.current);
    }
  }, [data, page, period, previousPeriod]);

  function showPersonalPage() {
    if (data.pagination.page === data.me.page && page === data.me.page) {
      focusPosition(currentRow.current ?? listTitle.current);
      return;
    }
    pendingJump.current = { page: data.me.page, period };
    view.setPage(data.me.page);
  }

  return <>
    <PageHeader period={period} onPeriod={(next) => {
      pendingJump.current = null;
      view.setPeriod(next);
    }} />
    <PeriodStatus data={data} loading={loading} error={error} onRetry={view.refresh} />
    {previousPeriod && <p role="status" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 sm:text-sm">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-600" />
      <span><strong>Dữ liệu kỳ trước:</strong> Bảng xếp hạng đang hiển thị kết quả của kỳ trước.</span>
    </p>}
    {error === "auth" && <p role="alert" className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-700">Bạn hiện không có quyền xem bảng xếp hạng.</p>}
    {error === "transient" && !data && <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-4">
      <p role="alert" className="flex items-center gap-2 text-sm text-slate-700"><AlertCircle aria-hidden="true" className="size-4 shrink-0 text-rose-600" /> Không tải được bảng xếp hạng.</p>
      <RetryButton onRetry={view.refresh} />
    </div>}
    {loading && !data && <SkeletonLoader />}
    {data && <>
      <PersonalRankCard learner={data.me} onJump={showPersonalPage} disabled={previousPeriod} />
      <TopPodium learners={data.top} />
      <RankingTable data={data} page={page} previousPeriod={previousPeriod} titleRef={listTitle} currentRowRef={currentRow} onPage={(next) => {
        pendingJump.current = null;
        view.setPage(next);
      }} />
    </>}
  </>;
}

function focusPosition(element) {
  if (!element) return;
  element.focus({ preventScroll: true });
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
  element.scrollIntoView({ block: "center", behavior });
}

function PageHeader({ period, onPeriod }) {
  return <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
    <div>
      <h1 id="leaderboard-title" className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Bảng xếp hạng</h1>
      <p className="mt-1 text-sm text-slate-600">Nỗ lực mỗi ngày, chinh phục thứ hạng!</p>
    </div>
    {period && <div role="group" aria-label="Chọn kỳ xếp hạng" className="inline-flex w-full min-w-0 rounded-xl border border-slate-200 bg-slate-200/70 p-1 md:w-auto">
      {PERIODS.map(([value, label]) => <button key={value} type="button" aria-pressed={period === value}
        onClick={() => onPeriod(value)}
        className={`min-h-11 min-w-0 flex-1 cursor-pointer rounded-lg px-1.5 py-2 text-xs font-medium transition-colors sm:px-3.5 sm:text-sm md:flex-initial md:whitespace-nowrap ${focus} ${period === value ? "bg-white font-semibold text-sky-700 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}>
        {label}
      </button>)}
    </div>}
  </div>;
}

function PeriodStatus({ data, loading, error, onRetry }) {
  return <div className="flex flex-col items-start justify-between gap-x-4 gap-y-1 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-xs text-slate-600 sm:flex-row sm:flex-wrap sm:items-center">
    <div className="flex flex-wrap items-center gap-1.5 font-medium text-slate-700">
      <span>Kỳ xếp hạng:</span>
      {data && <span className="rounded-md border border-sky-100 bg-sky-50 px-2 py-0.5 text-sky-700">{periodLabel(data.window)}</span>}
    </div>
    {data && <div className="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1" aria-live="polite">
      <span className="inline-flex items-center gap-1.5">
        <Clock aria-hidden="true" className="size-3.5 shrink-0 text-slate-500" />
        <span>Cập nhật lúc <time dateTime={data.as_of}>{timeFormatter.format(new Date(data.as_of))}</time></span>
      </span>
      {loading && <span className="inline-flex items-center gap-1.5 font-medium text-sky-700">
        <RefreshCw aria-hidden="true" className="size-3.5 motion-safe:animate-spin" /> Đang cập nhật…
      </span>}
      {error === "transient" && <>
        <span className="inline-flex items-center gap-1 font-medium text-rose-700">
          <AlertCircle aria-hidden="true" className="size-3.5 shrink-0" /> Chưa thể cập nhật
        </span>
        <RetryButton onRetry={onRetry} />
      </>}
    </div>}
  </div>;
}

function RetryButton({ onRetry }) {
  return <button type="button" onClick={onRetry} className={`min-h-11 cursor-pointer rounded-lg border border-rose-200 bg-rose-50 px-2.5 font-semibold text-rose-700 hover:bg-rose-100 ${focus}`}>Thử lại</button>;
}

function periodLabel(window) {
  if (window.start === null) return "Tất cả thời gian tích lũy";
  return `${dateFormatter.format(new Date(window.start))} – ${dateFormatter.format(Date.parse(window.end) - 1)}`;
}
