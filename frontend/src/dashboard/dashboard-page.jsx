import { AlertTriangle, ArrowRight, BookOpenCheck, Flame, LibraryBig, LockKeyhole, Map, RefreshCw, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import dashboardLearningIllustration from "../assets/images/banner.png";
import { useAuthentication } from "../auth/use-authentication.js";
import { learningService } from "../services/learning-service.js";
import { learningPathService } from "../services/learning-path-service.js";
import { learningSessionService } from "../services/learning-session-service.js";
import { vocabularySetService } from "../services/vocabulary-set-service.js";
import { getDashboardGreeting } from "./dashboard-greeting.js";
import "./dashboard-page.css";

const FOCUS_CLASSES = "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#0877b9]/30";
const PRIMARY_LINK_CLASSES = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#0877b9] px-4 py-2.5 text-sm font-extrabold text-white no-underline transition-colors duration-150 hover:bg-[#075f95] motion-reduce:transition-none ${FOCUS_CLASSES}`;
const CARD_CLASSES = "min-w-0 rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_rgb(15_83_115/7%)]";
const loadProgress = () => learningService.getLearningProgress({ page: 1, page_size: 1 });
const loadCurrentStreak = () => learningSessionService.getCurrentStreak();
const loadMySets = () => vocabularySetService.listMySets();
const loadLearningPath = () => learningPathService.getPath();
const loadReviewSummary = () => learningService.getGlobalReviewSummary();

export function DashboardPage() {
  const { user } = useAuthentication();
  const isUser = user.role === "USER";
  const progress = useDashboardSource(isUser, loadProgress, "progress");
  const streak = useDashboardSource(isUser, loadCurrentStreak, "streak");
  const mySets = useDashboardSource(isUser, loadMySets, "sets");
  const learningPath = useDashboardSource(isUser, loadLearningPath, "learning-path");
  const review = useDashboardSource(isUser, loadReviewSummary, "review");

  if (!isUser) return <DashboardAdminLanding displayName={user.display_name} />;

  return (
    <section aria-labelledby="dashboard-title" className="dashboard-page mx-auto min-w-0 w-full max-w-6xl px-[clamp(1rem,3vw,3rem)] pb-12 pt-[clamp(1.25rem,3vw,2.5rem)] text-[var(--color-body)]">
      <DashboardIntroduction displayName={user.display_name} />
      <DashboardStatistics mySets={mySets} progress={progress} streak={streak} />

      <div className="mt-8 grid min-w-0 grid-cols-1 gap-5">
        <DashboardDataCard errorMessage="Không thể tải bài học tiếp theo. Các khu vực khác vẫn dùng được." loadingMessage="Đang tải bài học tiếp theo…" source={learningPath} title="Bài học tiếp theo" type="next-lesson">
          {(data) => <NextLessonSummary path={data} />}
        </DashboardDataCard>
      </div>

      <div className="mt-5 grid min-w-0 grid-cols-2 items-start gap-5 max-[800px]:grid-cols-1">
        <DashboardDataCard errorMessage="Không thể tải lộ trình CEFR. Các khu vực khác vẫn dùng được." loadingMessage="Đang tải lộ trình CEFR…" source={learningPath} title="Lộ trình CEFR" type="learning-path">
          {(data) => <CefrPathSummary path={data} />}
        </DashboardDataCard>
        <DashboardDataCard errorMessage="Không thể tải số từ cần ôn. Các khu vực khác vẫn dùng được." loadingMessage="Đang tải từ cần ôn…" source={review} title="Từ cần ôn" type="review">
          {(data) => <ReviewSummary summary={data} />}
        </DashboardDataCard>
      </div>
    </section>
  );
}

function DashboardStatistics({ mySets, progress, streak }) {
  return (
    <section aria-labelledby="dashboard-statistics-title" className="mt-6 min-w-0">
      <h2 className="sr-only" id="dashboard-statistics-title">Tổng quan học tập</h2>
      <div className="grid min-w-0 grid-cols-4 gap-4 max-[900px]:grid-cols-2 max-[520px]:grid-cols-1">
        <LevelStat source={progress} />
        <StreakStat source={streak} />
        <TotalXpStat source={progress} />
        <SetCountStat source={mySets} />
      </div>
    </section>
  );
}

function LevelStat({ source }) {
  return (
    <StatisticSourceCard label="Cấp độ" source={source}>
      {(data) => {
        const xp = data.xp_level;
        const progressPercent = xp.is_max_level ? 100 : clampPercentage(((xp.total_xp - xp.level_min_xp) / (xp.next_level_xp - xp.level_min_xp)) * 100);
        const circumference = 2 * Math.PI * 22;
        return (
          <div className="flex min-w-0 items-center gap-3.5">
            <div aria-label={`Tiến độ XP Level ${xp.level}`} aria-valuemax={xp.is_max_level ? xp.total_xp : xp.next_level_xp} aria-valuemin={xp.level_min_xp} aria-valuenow={xp.total_xp} className="relative grid size-[4.25rem] shrink-0 place-items-center" role="progressbar">
              <svg aria-hidden="true" className="size-full -rotate-90" viewBox="0 0 52 52">
                <circle className="fill-none stroke-slate-200" cx="26" cy="26" r="22" strokeWidth="5" />
                <circle className="fill-none stroke-[#0877b9]" cx="26" cy="26" r="22" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progressPercent / 100)} strokeLinecap="round" strokeWidth="5" />
              </svg>
              <strong className="absolute text-xl text-slate-900 tabular-nums">{xp.level}</strong>
            </div>
            <div className="min-w-0">
              <p className="m-0 text-xs font-bold text-slate-500">Level hiện tại</p>
              <p className="mb-0 mt-1 text-sm font-extrabold text-slate-800">{xp.is_max_level ? "Đã đạt cấp tối đa" : `${formatXp(xp.total_xp - xp.level_min_xp)} / ${formatXp(xp.next_level_xp - xp.level_min_xp)} XP`}</p>
            </div>
          </div>
        );
      }}
    </StatisticSourceCard>
  );
}

function StreakStat({ source }) {
  return (
    <StatisticSourceCard label="Chuỗi học" source={source}>
      {(data) => (
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className={`grid size-12 shrink-0 place-items-center rounded-xl [&_svg]:size-6 ${data.completed_today ? "bg-orange-50 text-[#d94a1e]" : "bg-slate-100 text-slate-400"}`} aria-hidden="true"><Flame /></span>
            <div className="min-w-0">
              <p className="m-0 text-[1.65rem] font-extrabold leading-none text-slate-900 tabular-nums" aria-label={`Chuỗi hiện tại ${data.current_streak} ngày`}>{data.current_streak} <span className="text-sm font-bold text-slate-500">ngày</span></p>
              <p className="mb-0 mt-1.5 text-xs font-bold text-slate-500">{data.completed_today ? "Đã duy trì hôm nay" : "Chưa hoàn thành hôm nay"}</p>
            </div>
          </div>
          <button className={`grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-[#8fc5df] hover:text-[#075f95] ${FOCUS_CLASSES}`} type="button" onClick={source.retry} aria-label="Làm mới chuỗi học tập"><RefreshCw aria-hidden="true" className="size-4" /></button>
        </div>
      )}
    </StatisticSourceCard>
  );
}

function TotalXpStat({ source }) {
  return (
    <StatisticSourceCard label="Tổng XP" source={source}>
      {(data) => <div className="flex min-w-0 items-center gap-3.5"><span className="grid size-12 shrink-0 place-items-center rounded-xl bg-sky-50 text-[#0877b9] [&_svg]:size-6" aria-hidden="true"><Zap /></span><p className="m-0 min-w-0 text-[1.65rem] font-extrabold leading-none text-slate-900 tabular-nums">{formatXp(data.xp_level.total_xp)} <span className="text-sm font-bold text-slate-500">XP</span></p></div>}
    </StatisticSourceCard>
  );
}

function SetCountStat({ source }) {
  return (
    <StatisticSourceCard label="Bộ từ" source={source}>
      {(data) => <div className="flex min-w-0 items-center gap-3.5"><span className="grid size-12 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 [&_svg]:size-6" aria-hidden="true"><LibraryBig /></span><p className="m-0 min-w-0 text-[1.65rem] font-extrabold leading-none text-slate-900 tabular-nums">{data.length} <span className="text-sm font-bold text-slate-500">bộ cá nhân</span></p></div>}
    </StatisticSourceCard>
  );
}

function StatisticSourceCard({ children, label, source }) {
  const headingRef = useRef(null);
  const retryButtonRef = useRef(null);
  const retryRequestedRef = useRef(false);
  useEffect(() => {
    if (!retryRequestedRef.current || source.status === "loading") return;
    if (source.status === "error") retryButtonRef.current?.focus();
    if (source.status === "success") headingRef.current?.focus();
    retryRequestedRef.current = false;
  }, [source.status]);
  function retry() {
    retryRequestedRef.current = true;
    source.retry();
  }
  const hasValue = source.data !== null;
  return (
    <article className={`${CARD_CLASSES} min-h-[9rem] p-4`} aria-busy={source.status === "loading"}>
      <h3 className="m-0 rounded-sm text-sm font-extrabold text-slate-700 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#0877b9]/30" ref={headingRef} tabIndex={-1}>{label}</h3>
      {source.status === "loading" ? <div className="mt-4" role="status"><span className="sr-only">Đang tải {label.toLocaleLowerCase("vi-VN")}…</span><span className="block h-12 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" aria-hidden="true" /></div> : null}
      {source.status === "error" ? <div className="mt-3" role="alert">{hasValue ? <div className="mb-3">{children(source.data)}</div> : null}<p className="m-0 text-xs font-semibold leading-relaxed text-red-700">{hasValue ? "Dữ liệu gần nhất có thể đã cũ." : "Chưa thể tải dữ liệu."}</p><button className={`mt-2 min-h-11 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 text-xs font-extrabold text-[#075f95] hover:bg-sky-50 ${FOCUS_CLASSES}`} ref={retryButtonRef} type="button" onClick={retry}>Thử lại</button></div> : null}
      {source.status === "success" ? <div className="mt-4">{children(source.data)}</div> : null}
    </article>
  );
}

function NextLessonSummary({ path }) {
  const primaryLevel = getPrimaryLevel(path);
  const recommendation = path.recommendation;
  const recommendedSet = recommendation ? findRecommendedSet(path, recommendation.set_id) : null;
  const recommendationName = recommendedSet?.name ?? "Bộ từ được đề xuất";
  const recommendationLevel = recommendedSet?.level ?? path.highest_unlocked_level;
  const configurationMessage = getConfigurationMessage(primaryLevel);
  if (!recommendation) {
    const message = path.all_current_sets_complete ? "Bạn đã hoàn thành các bộ từ hiện có trong lộ trình." : configurationMessage ?? "Hiện chưa có bộ từ phù hợp để đề xuất ở cấp độ này.";
    return <div className="flex min-w-0 items-start gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5" role="status"><span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white text-slate-500 shadow-sm [&_svg]:size-6" aria-hidden="true"><BookOpenCheck /></span><div className="min-w-0"><p className="m-0 font-extrabold text-slate-900">Chưa có bài học được đề xuất</p><p className="mb-0 mt-1 text-sm leading-relaxed text-slate-600">{message}</p></div></div>;
  }
  return (
    <div className="flex min-w-0 items-center justify-between gap-6 rounded-xl border border-sky-100 bg-sky-50/70 p-[clamp(1rem,3vw,1.5rem)] max-[640px]:items-stretch max-[640px]:flex-col">
      <div className="flex min-w-0 items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white text-[#0877b9] shadow-sm [&_svg]:size-6" aria-hidden="true"><BookOpenCheck /></span><div className="min-w-0"><p className="m-0 text-[clamp(1.15rem,2.5vw,1.45rem)] font-extrabold leading-tight text-slate-900 [overflow-wrap:anywhere]">{recommendationName}</p><div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-600"><span className="inline-flex min-h-8 items-center rounded-full border border-sky-200 bg-white px-3 text-[#075f95]">CEFR {recommendationLevel}</span>{primaryLevel ? <span>{primaryLevel.completed_count} / {primaryLevel.required_count} bộ đã hoàn thành</span> : null}</div></div></div>
      <Link className={`${PRIMARY_LINK_CLASSES} shrink-0 max-[640px]:w-full`} to={`/learn/vocabulary-sets/${recommendation.set_id}`} state={{ returnTo: "/dashboard", learningPathAction: recommendation.action, passId: recommendation.pass_id }}>{recommendation.action === "RESUME" ? "Tiếp tục học" : "Bắt đầu học"} <ArrowRight aria-hidden="true" className="size-4" /></Link>
    </div>
  );
}

function CefrPathSummary({ path }) {
  const primaryLevel = getPrimaryLevel(path);
  const preservedCompletion = Boolean(path.path_completed_at) && !path.all_current_sets_complete;
  const configurationMessage = getConfigurationMessage(primaryLevel);
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-sky-50 text-[#0877b9] [&_svg]:size-5" aria-hidden="true"><Map /></span><div className="min-w-0"><p className="m-0 text-xs font-bold text-slate-500">Cấp độ cao nhất đã mở</p><p className="mb-0 mt-0.5 text-xl font-extrabold text-slate-900">CEFR {path.highest_unlocked_level}</p>{primaryLevel ? <p className="mb-0 mt-1 text-sm text-slate-600">{primaryLevel.completed_count} / {primaryLevel.required_count} bộ công khai đã hoàn thành</p> : null}</div></div>
      <ol className="mt-5 grid list-none grid-cols-5 gap-2 p-0" aria-label="Các cấp độ CEFR">{path.levels.map((level) => <li className={`flex min-h-11 items-center justify-center gap-1 rounded-lg border px-1 py-2 text-sm font-extrabold ${level.unlocked ? "border-sky-200 bg-sky-50 text-[#075f95]" : "border-slate-200 bg-slate-100 text-slate-500"}`} key={level.level}>{!level.unlocked ? <LockKeyhole className="size-3.5" aria-hidden="true" /> : null}{level.level}<span className="sr-only">{level.unlocked ? "đã mở" : "đang khóa"}</span></li>)}</ol>
      {path.path_completed_at && path.all_current_sets_complete ? <p className="mb-0 mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-800" role="status">Đã hoàn thành lộ trình hiện tại.</p> : null}
      {preservedCompletion ? <p className="mb-0 mt-4 rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-900" role="status">Lộ trình hiện có thêm nội dung chưa học.</p> : null}
      {configurationMessage ? <p className="mb-0 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">{configurationMessage}</p> : null}
    </div>
  );
}

function ReviewSummary({ summary }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-5 max-[520px]:items-stretch max-[520px]:flex-col">
      <div className="flex min-w-0 items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 [&_svg]:size-5" aria-hidden="true"><RefreshCw /></span><div className="min-w-0">{summary.has_due_items ? <p className="m-0 text-xl font-extrabold text-slate-900">{summary.due_count} từ đang đến hạn</p> : <p className="m-0 text-xl font-extrabold text-slate-900">Đã ôn tập đầy đủ</p>}{!summary.has_due_items && summary.nearest_future_review_at ? <p className="mb-0 mt-1 text-sm text-slate-600">Lần ôn gần nhất: {new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(summary.nearest_future_review_at))}</p> : null}</div></div>
      <Link className={`${PRIMARY_LINK_CLASSES} shrink-0 max-[520px]:w-full`} to="/review">Xem ôn tập <ArrowRight aria-hidden="true" className="size-4" /></Link>
    </div>
  );
}

function DashboardDataCard({ children, errorMessage, loadingMessage, source, title, type }) {
  const titleId = `dashboard-${source.key}-${type}-title`;
  const headingRef = useRef(null);
  const retryButtonRef = useRef(null);
  const retryRequestedRef = useRef(false);
  useEffect(() => {
    if (!retryRequestedRef.current || source.status === "loading") return;
    if (source.status === "error") retryButtonRef.current?.focus();
    if (source.status === "success") headingRef.current?.focus();
    retryRequestedRef.current = false;
  }, [source.status]);
  function retry() { retryRequestedRef.current = true; source.retry(); }
  return (
    <section aria-labelledby={titleId} aria-busy={source.status === "loading"} className={`${CARD_CLASSES} min-w-0 p-[clamp(1rem,2.5vw,1.5rem)]`}>
      <h2 className="m-0 rounded-sm text-[clamp(1.1rem,2vw,1.3rem)] font-extrabold tracking-[-0.02em] text-slate-900 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#0877b9]/30" id={titleId} ref={headingRef} tabIndex={-1}>{title}</h2>
      {source.status === "loading" ? <div className="mt-4" role="status"><span className="sr-only">{loadingMessage}</span><span className="block min-h-28 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" aria-hidden="true" /></div> : null}
      {source.status === "error" ? <div className="mt-4 flex min-w-0 items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4" role="alert"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-700" aria-hidden="true" /><div className="min-w-0"><p className="m-0 text-sm font-semibold leading-relaxed text-red-800">{errorMessage}</p><button className={`mt-3 min-h-11 cursor-pointer rounded-lg border border-red-200 bg-white px-3 text-sm font-extrabold text-red-800 hover:bg-red-100 ${FOCUS_CLASSES}`} ref={retryButtonRef} type="button" onClick={retry}>Thử lại</button></div></div> : null}
      {source.status === "success" ? <div className="mt-4">{children(source.data)}</div> : null}
    </section>
  );
}

function DashboardIntroduction({ displayName }) {
  const greeting = getDashboardGreeting();
  return (
    <header className="dashboard-introduction dashboard-hero relative flex min-h-[9rem] w-full items-start justify-between gap-6 overflow-hidden rounded-2xl px-[clamp(1.25rem,4vw,2.75rem)] py-[clamp(1.25rem,3vw,1.75rem)] max-[520px]:min-h-[8rem]">
      <div className="relative z-[2] min-w-0 max-w-[64%] max-[760px]:max-w-[70%] max-[520px]:max-w-[calc(100%-4.5rem)]"><h1 className="m-0 text-pretty text-[clamp(1.5rem,3vw,2.25rem)] font-extrabold leading-[1.15] tracking-[-0.035em] text-slate-900" id="dashboard-title"><span className="block text-[0.62em] font-bold tracking-[-0.015em] text-[#075f95]">{greeting}{" "}</span><span className="mt-1 block [overflow-wrap:anywhere]">{displayName}</span></h1><p className="mb-0 mt-3 max-w-[34rem] text-sm leading-relaxed text-slate-600">Sẵn sàng học thêm vài từ hôm nay chưa?</p></div>
      <div className="dashboard-hero-visual pointer-events-none absolute inset-y-0 right-0 w-[min(48%,31rem)] max-[760px]:w-[43%] max-[520px]:w-[6.5rem]" aria-hidden="true"><span className="dashboard-hero-bubble is-one" /><span className="dashboard-hero-bubble is-two" /><span className="dashboard-hero-bubble is-three" /><span className="dashboard-hero-bubble is-four" /><span className="dashboard-hero-bubble is-five" /><span className="dashboard-hero-bubble is-six" /><span className="dashboard-hero-bubble is-seven" /><span className="dashboard-hero-bubble is-eight" /><span className="dashboard-hero-dots" /><img className="absolute bottom-[-0.8rem] right-[0.9rem] z-[2] h-auto w-[clamp(13.5rem,22vw,17.5rem)] object-contain max-[760px]:bottom-[-0.3rem] max-[760px]:right-[-0.75rem] max-[760px]:w-[clamp(9rem,27vw,12rem)] max-[520px]:bottom-[-0.15rem] max-[520px]:right-[-2rem] max-[520px]:w-[8.25rem] max-[520px]:opacity-80" alt="" height="320" src={dashboardLearningIllustration} width="320" /></div>
    </header>
  );
}

function DashboardAdminLanding({ displayName }) {
  return <section aria-labelledby="dashboard-title" className="dashboard-page dashboard-admin-page"><header className="dashboard-introduction"><h1 id="dashboard-title">Xin chào, {displayName}.</h1></header><section className="dashboard-admin-panel" aria-labelledby="dashboard-admin-title"><span className="dashboard-admin-icon" aria-hidden="true"><BookOpenCheck /></span><div><h2 id="dashboard-admin-title">Không gian quản trị</h2><p>Đây là điểm bắt đầu an toàn cho tài khoản quản trị. Hãy chọn một khu vực quản lý từ thanh điều hướng để bắt đầu.</p></div></section></section>;
}

function getPrimaryLevel(path) { return path.levels.find(({ level }) => level === path.highest_unlocked_level); }
function findRecommendedSet(path, setId) { return path.levels.flatMap(({ incomplete_sets: sets, level }) => sets.map((set) => ({ ...set, level }))).find(({ id }) => id === setId) ?? null; }
function getConfigurationMessage(primaryLevel) {
  if (primaryLevel?.configuration === "NO_REQUIRED_SETS") return "Cấp độ này chưa có bộ từ bắt buộc. Hệ thống chưa thể mở khóa cấp tiếp theo.";
  if (primaryLevel?.configuration === "EMPTY_REQUIRED_SET") return "Có bộ từ bắt buộc chưa có nội dung. Hệ thống chưa thể đề xuất lượt học an toàn.";
  return null;
}
function clampPercentage(value) { return Math.min(100, Math.max(0, value)); }
function formatXp(value) { return value.toLocaleString("vi-VN"); }

function useDashboardSource(enabled, loader, key) {
  const [retryToken, setRetryToken] = useState(0);
  const [state, setState] = useState({ data: null, status: enabled ? "loading" : "idle" });
  const requestIdRef = useRef(0);
  useEffect(() => {
    if (!enabled) return undefined;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    loader().then((data) => { if (requestIdRef.current === requestId) setState({ data, status: "success" }); }).catch(() => { if (requestIdRef.current === requestId) setState((current) => ({ data: current.data, status: "error" })); });
    return () => { if (requestIdRef.current === requestId) requestIdRef.current += 1; };
  }, [enabled, loader, retryToken]);
  function retry() {
    if (!enabled || state.status === "loading") return;
    setState((current) => ({ data: current.data, status: "loading" }));
    setRetryToken((value) => value + 1);
  }
  return { ...state, key, retry };
}
