import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Flame,
  FolderOpen,
  LibraryBig,
  Plus,
  RefreshCw,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import dashboardLearningIllustration from "../assets/images/banner.png";
import { useAuthentication } from "../auth/use-authentication.js";
import { learningService } from "../services/learning-service.js";
import { learningSessionService } from "../services/learning-session-service.js";
import { vocabularySetService } from "../services/vocabulary-set-service.js";
import { getDashboardGreeting } from "./dashboard-greeting.js";
import "./dashboard-page.css";

const DASHBOARD_SET_PREVIEW_LIMIT = 3;
const FOCUS_CLASSES = "focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]";
const PRIMARY_LINK_CLASSES = `dashboard-primary-link inline-flex min-h-11 items-center justify-center gap-[0.4rem] rounded-md bg-[var(--color-primary)] px-[0.8rem] py-[0.55rem] text-[0.79rem] font-extrabold text-white no-underline hover:bg-[var(--color-primary-hover)] max-[480px]:w-full [&_svg]:size-4 ${FOCUS_CLASSES}`;
const SECONDARY_LINK_CLASSES = `dashboard-secondary-link inline-flex min-h-11 items-center justify-center gap-[0.4rem] rounded-md border border-[#d8dfeb] bg-white px-[0.8rem] py-[0.55rem] text-[0.79rem] font-extrabold text-[var(--color-info)] no-underline hover:border-[#aebde5] hover:bg-[#f7f9ff] max-[480px]:w-full [&_svg]:size-4 ${FOCUS_CLASSES}`;
const PROGRESS_STYLES = {
  total: { card: "bg-[#f1f5ff]", icon: "bg-[#dce6ff] text-[var(--color-primary)]", label: "text-[#304d9b]" },
  learning: { card: "bg-[#fff5df]", icon: "bg-[#ffe0a8] text-[var(--color-warning)]", label: "text-[var(--color-warning)]" },
  learned: { card: "bg-[#e8f9ef]", icon: "bg-[#bdeed1] text-[var(--color-success)]", label: "text-[var(--color-success)]" },
};
const SET_ICON_STYLES = [
  "bg-[#e9efff] text-[var(--color-primary)]",
  "bg-[#fff0d8] text-[#a85b00]",
  "bg-[#e1f6ea] text-[#08703f]",
];
const loadProgress = () =>
  learningService.getLearningProgress({ page: 1, page_size: 1 });
const loadCurrentStreak = () => learningSessionService.getCurrentStreak();
const loadMySets = () => vocabularySetService.listMySets();

export function DashboardPage() {
  const { user } = useAuthentication();
  const isUser = user.role === "USER";
  const progress = useDashboardSource(isUser, loadProgress, "progress");
  const streak = useDashboardSource(isUser, loadCurrentStreak, "streak");
  const mySets = useDashboardSource(isUser, loadMySets, "sets");

  if (!isUser) return <DashboardAdminLanding displayName={user.display_name} />;

  return (
    <section aria-labelledby="dashboard-title" className="dashboard-page mx-auto min-w-0 w-full max-w-6xl p-[clamp(1.5rem,3vw,3rem)] text-[var(--color-body)] max-[760px]:px-4 max-[760px]:pb-8 max-[760px]:pt-5">
      <DashboardIntroduction displayName={user.display_name} />

      <DashboardSection
        action={<Link to="/my/learning-progress">Xem tiến độ chi tiết</Link>}
        errorMessage="Không thể tải tóm tắt học tập. Vui lòng thử lại."
        loadingMessage="Đang tải tóm tắt học tập…"
        source={progress}
        title="Tiến độ học tập"
        type="progress"
      >
        {(data) => <ProgressSummary summary={data.summary} xpLevel={data.xp_level} />}
      </DashboardSection>

      <StreakSummary source={streak} />

      <DashboardSection
        action={mySets.status !== "success" || mySets.data.length > 0 ? <Link to="/my/vocabulary-sets">Xem tất cả</Link> : null}
        errorMessage="Không thể tải bộ từ riêng. Vui lòng thử lại."
        loadingMessage="Đang tải bộ từ riêng…"
        source={mySets}
        title="Bộ từ của bạn"
        type="sets"
      >
        {(sets) => <MySetsSummary sets={sets} />}
      </DashboardSection>

    </section>
  );
}

function StreakSummary({ source }) {
  const titleId = "dashboard-streak-title";
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
    <section
      aria-busy={source.status === "loading"}
      aria-labelledby={titleId}
      className="dashboard-streak-section mt-7 min-w-0 max-w-[28rem]"
    >
      <h2
        className="m-0 rounded-sm text-[clamp(1.2rem,2vw,1.45rem)] tracking-[-0.025em] text-[var(--color-heading)] outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-[#3b5bdb]/30"
        id={titleId}
        ref={headingRef}
        tabIndex={-1}
      >
        Chuỗi học tập
      </h2>

      {source.status === "loading" ? (
        <div className="mt-4" aria-live="polite" role="status">
          <span className="sr-only">Đang tải chuỗi học tập…</span>
          <span className="block min-h-[8.5rem] animate-pulse rounded-[var(--radius-xl)] bg-[#fff1e8] motion-reduce:animate-none" aria-hidden="true" />
        </div>
      ) : null}

      {source.status === "success" ? <StreakCard onRefresh={retry} streak={source.data} /> : null}

      {source.status === "error" ? (
        <div className="mt-4 rounded-[var(--radius-xl)] border border-[#f2cfd5] bg-[#fffafb] p-4" role="alert">
          {hasValue ? <StreakCard stale streak={source.data} /> : (
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-md bg-[#ffe4e8] text-[#c62035] [&_svg]:size-[1.4rem]" aria-hidden="true"><AlertTriangle /></span>
              <div>
                <h3 className="m-0 text-[0.95rem] text-[var(--color-heading)]">Không thể tải chuỗi học tập</h3>
                <p className="mb-0 mt-1 text-[0.84rem] leading-normal text-[var(--color-muted)]">Dữ liệu chuỗi chưa khả dụng. Vui lòng thử lại.</p>
              </div>
            </div>
          )}
          <button className={`mt-3 inline-flex min-h-11 cursor-pointer items-center gap-[0.45rem] rounded-md border-0 bg-[var(--color-primary)] px-[0.9rem] py-[0.55rem] font-[inherit] text-[0.82rem] font-extrabold text-white [&_svg]:size-4 ${FOCUS_CLASSES}`} ref={retryButtonRef} type="button" onClick={retry}>
            <RefreshCw aria-hidden="true" /> Thử lại chuỗi học tập
          </button>
        </div>
      ) : null}
    </section>
  );
}

function StreakCard({ onRefresh, stale = false, streak }) {
  const status = streak.completed_today
    ? "Bạn đã duy trì chuỗi hôm nay."
    : streak.current_streak > 0
      ? "Hãy hoàn thành một hoạt động đủ điều kiện hôm nay để tiếp tục chuỗi."
      : "Bắt đầu lại chuỗi bằng một hoạt động học đủ điều kiện.";

  return (
    <div className={`${stale ? "mt-0 border-0 bg-transparent p-0 shadow-none" : "mt-4 border border-[#f3d8c5] bg-[linear-gradient(135deg,#fffaf5,#fff1e8)] p-4 shadow-[var(--shadow-sm)]"} min-w-0 rounded-[var(--radius-xl)]`}>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-lg)] bg-[#ffe1cc] text-[#c95316] [&_svg]:size-6" aria-hidden="true"><Flame /></span>
          <p className="m-0 text-[clamp(1.45rem,3vw,1.8rem)] font-extrabold leading-none text-[var(--color-heading)]" aria-label={`Chuỗi hiện tại ${streak.current_streak} ngày`}>
            {streak.current_streak} <span className="text-[0.85rem] font-bold text-[var(--color-muted)]">ngày</span>
          </p>
        </div>
        {onRefresh ? (
          <button className={`grid size-11 shrink-0 cursor-pointer place-items-center rounded-md border border-[#e8c9b6] bg-white text-[#9b481f] hover:bg-[#fff8f3] [&_svg]:size-4 ${FOCUS_CLASSES}`} type="button" onClick={onRefresh} aria-label="Làm mới chuỗi học tập">
            <RefreshCw aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <p className="mb-0 mt-3 text-[0.86rem] font-semibold leading-relaxed text-[#6e4b3a]" aria-live="polite">{status}</p>
      {stale ? <p className="mb-0 mt-2 text-[0.8rem] font-bold text-[#9a3342]">Dữ liệu gần nhất có thể đã cũ.</p> : null}
    </div>
  );
}

function DashboardIntroduction({ displayName }) {
  const greeting = getDashboardGreeting();

  return (
    <header className="dashboard-introduction dashboard-hero relative mb-[clamp(2rem,4vw,3rem)] flex min-h-[8.5rem] w-full max-w-none items-start justify-between gap-[clamp(1rem,3vw,2.5rem)] overflow-hidden rounded-[var(--radius-lg)] px-[clamp(1.5rem,4vw,2.75rem)] py-[1.55rem] max-[760px]:min-h-32 max-[760px]:gap-3 max-[760px]:p-5 max-[480px]:min-h-[7.5rem] max-[480px]:p-[1.1rem]">
      <div className="dashboard-hero-copy relative z-[2] min-w-0 max-w-[64%] pt-1 max-[760px]:max-w-[68%] max-[480px]:max-w-[calc(100%-4.5rem)] max-[480px]:pt-0">
        <h1 className="m-0 text-[clamp(1.75rem,3vw,2.35rem)] font-extrabold leading-[1.2] tracking-[-0.035em] text-[var(--color-heading)] [overflow-wrap:anywhere] max-[480px]:text-[1.65rem]" id="dashboard-title">{greeting}, {displayName} <span className="inline-block rotate-[-8deg] text-[0.82em]" aria-hidden="true">👋</span></h1>
        <p className="mb-0 mt-[0.65rem] text-base leading-[1.65] text-[#61708d] max-[480px]:text-[0.92rem]">Sẵn sàng học thêm vài từ hôm nay chưa?</p>
      </div>
      <div className="dashboard-hero-visual pointer-events-none absolute inset-y-0 right-0 w-[min(48%,31rem)] shrink-0 max-[760px]:w-[43%] max-[480px]:w-[6.5rem]" aria-hidden="true">
        <span className="dashboard-hero-bubble is-one" />
        <span className="dashboard-hero-bubble is-two" />
        <span className="dashboard-hero-bubble is-three" />
        <span className="dashboard-hero-bubble is-four" />
        <span className="dashboard-hero-bubble is-five" />
        <span className="dashboard-hero-bubble is-six" />
        <span className="dashboard-hero-bubble is-seven" />
        <span className="dashboard-hero-bubble is-eight" />
        <span className="dashboard-hero-dots" />
        <img className="absolute bottom-[-0.8rem] right-[0.9rem] z-[2] h-auto w-[clamp(13.5rem,22vw,17.5rem)] object-contain max-[760px]:bottom-[-0.3rem] max-[760px]:right-[-0.75rem] max-[760px]:w-[clamp(9rem,27vw,12rem)] max-[480px]:bottom-[-0.15rem] max-[480px]:right-[-2rem] max-[480px]:w-[8.25rem] max-[480px]:opacity-[0.82]" alt="" src={dashboardLearningIllustration} />
      </div>
    </header>
  );
}

function DashboardAdminLanding({ displayName }) {
  return (
    <section aria-labelledby="dashboard-title" className="dashboard-page dashboard-admin-page">
      <header className="dashboard-introduction">
        <h1 id="dashboard-title">Xin chào, {displayName}.</h1>
      </header>
      <section className="dashboard-admin-panel" aria-labelledby="dashboard-admin-title">
        <span className="dashboard-admin-icon" aria-hidden="true">
          <BookOpenCheck />
        </span>
        <div>
          <h2 id="dashboard-admin-title">Không gian quản trị</h2>
          <p>
            Đây là điểm bắt đầu an toàn cho tài khoản quản trị. Hãy chọn một khu vực quản lý từ thanh điều hướng để bắt đầu.
          </p>
        </div>
      </section>
    </section>
  );
}

function DashboardSection({ action, children, errorMessage, loadingMessage, source, title, type }) {
  const titleId = `dashboard-${source.key}-title`;
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

  return (
    <section
      aria-labelledby={titleId}
      aria-busy={source.status === "loading"}
      className={`dashboard-section dashboard-${type}-section min-w-0 ${type === "progress" ? "mt-7 max-w-[58rem]" : "mt-12 max-[760px]:mt-10"}`}
    >
      <div className="dashboard-section-heading mb-4 flex items-center justify-between gap-4 max-[480px]:items-start">
        <h2 className="m-0 rounded-sm text-[clamp(1.2rem,2vw,1.45rem)] tracking-[-0.025em] text-[var(--color-heading)] outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-[#3b5bdb]/30" id={titleId} ref={headingRef} tabIndex={-1}>{title}</h2>
        {action ? <span className="shrink-0 [&_a]:text-[0.86rem] [&_a]:font-extrabold [&_a]:text-[var(--color-primary)] [&_a]:no-underline hover:[&_a]:text-[var(--color-primary-hover)] hover:[&_a]:underline">{action}</span> : null}
      </div>

      {source.status === "loading" ? (
        <DashboardLoadingState message={loadingMessage} type={type} />
      ) : null}

      {source.status === "error" ? (
        <div className="dashboard-state dashboard-error-state flex min-w-0 items-center gap-[0.9rem] rounded-[var(--radius-lg)] border border-[#f2cfd5] bg-[#fffafb] p-4" role="alert">
          <span className="grid size-11 shrink-0 place-items-center rounded-md bg-[#ffe4e8] text-[#c62035] [&_svg]:size-[1.4rem]" aria-hidden="true"><AlertTriangle /></span>
          <div>
            <h3 className="m-0 text-[0.95rem] text-[var(--color-heading)]">Đã có lỗi xảy ra</h3>
            <p className="mb-0 mt-1 text-[0.84rem] leading-normal text-[var(--color-muted)]">{errorMessage}</p>
            <button className={`mt-3 inline-flex min-h-11 cursor-pointer items-center gap-[0.45rem] rounded-md border-0 bg-[var(--color-primary)] px-[0.9rem] py-[0.55rem] font-[inherit] text-[0.82rem] font-extrabold text-white [&_svg]:size-4 ${FOCUS_CLASSES}`} ref={retryButtonRef} type="button" onClick={retry}>
              <RefreshCw aria-hidden="true" /> Thử lại
            </button>
          </div>
        </div>
      ) : null}

      {source.status === "success" ? children(source.data) : null}
    </section>
  );
}

function DashboardLoadingState({ message, type }) {
  const count = 3;
  return (
    <div className={`dashboard-loading dashboard-${type}-loading`}>
      <p className="sr-only" role="status">{message}</p>
      <div className={`grid grid-cols-3 ${type === "sets" ? "gap-4" : "gap-3"} max-[760px]:grid-cols-1`} aria-hidden="true">
        {Array.from({ length: count }, (_, index) => <span className={`block animate-pulse rounded-[var(--radius-lg)] motion-reduce:animate-none ${type === "sets" ? "min-h-56 bg-[#edf1f7] max-[760px]:min-h-48" : "min-h-[5.75rem] bg-[#eaf0fa]"}`} key={index} />)}
      </div>
    </div>
  );
}

function ProgressSummary({ summary, xpLevel }) {
  const values = [
    { key: "total", label: "Tổng đã bắt đầu", value: summary.total_started, icon: BookOpenCheck },
    { key: "learning", label: "Đang học", value: summary.learning, icon: RefreshCw },
    { key: "learned", label: "Đã thuộc", value: summary.learned, icon: CheckCircle2 },
  ];
  return (
    <>
      <XpLevelSummary xpLevel={xpLevel} />
      <dl className="dashboard-progress-grid m-0 grid grid-cols-3 gap-3 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-sm)] max-[760px]:grid-cols-1 max-[760px]:gap-[0.6rem]" aria-label="Tóm tắt tiến độ" role="group">
        {values.map(({ icon: Icon, key, label, value }) => (
          <div className={`dashboard-progress-card is-${key} flex min-h-[5.75rem] min-w-0 items-center gap-[0.8rem] rounded-[var(--radius-lg)] p-4 max-[760px]:min-h-[4.75rem] ${PROGRESS_STYLES[key].card}`} key={key}>
            <span className={`dashboard-progress-icon grid size-10 shrink-0 place-items-center rounded-full [&_svg]:size-5 [&_svg]:[stroke-width:2.2] ${PROGRESS_STYLES[key].icon}`} aria-hidden="true"><Icon /></span>
            <div className="dashboard-progress-copy min-w-0">
              <dt className={`text-[0.78rem] font-extrabold leading-[1.3] ${PROGRESS_STYLES[key].label}`}>{label}</dt>
              <dd className="mb-0 mt-1 text-[1.6rem] font-extrabold leading-none text-[var(--color-heading)]">{value} <span className="text-[0.72rem] font-medium text-[var(--color-muted)]">từ vựng</span></dd>
            </div>
          </div>
        ))}
      </dl>
      {summary.total_started === 0 ? (
        <div className="dashboard-empty-note flex min-w-0 items-center gap-[0.9rem] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[#fafbff] p-4" role="status">
          <BookOpenCheck className="size-7 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
          <div>
            <h3 className="m-0 text-[0.95rem] text-[var(--color-heading)]">Bạn chưa bắt đầu học từ vựng nào</h3>
            <p className="mb-0 mt-1 text-[0.84rem] leading-normal text-[var(--color-muted)]">Hãy khám phá chủ đề hoặc bộ từ của bạn để bắt đầu.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}

function XpLevelSummary({ xpLevel }) {
  const progressPercent = xpLevel.is_max_level
    ? 100
    : clampPercentage(
      ((xpLevel.total_xp - xpLevel.level_min_xp)
        / (xpLevel.next_level_xp - xpLevel.level_min_xp)) * 100,
    );
  const remainingXp = xpLevel.is_max_level
    ? null
    : xpLevel.next_level_xp - xpLevel.total_xp;

  return (
    <section
      aria-label="XP và cấp độ"
      className="dashboard-xp-summary mb-3 min-w-0 rounded-[var(--radius-xl)] border border-[#d9e2ff] bg-[linear-gradient(135deg,#f7f9ff,#eef3ff)] p-[clamp(1rem,2.4vw,1.35rem)] shadow-[var(--shadow-sm)]"
    >
      <div className="flex min-w-0 items-center justify-between gap-4 max-[480px]:items-start">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-lg)] bg-[#dce6ff] text-[var(--color-primary)] [&_svg]:size-6" aria-hidden="true">
            <Zap />
          </span>
          <div className="min-w-0">
            <p className="m-0 text-[0.75rem] font-extrabold uppercase tracking-[0.08em] text-[#4d64a5]">Cấp độ hiện tại</p>
            <h3 className="m-0 mt-1 text-[clamp(1.15rem,2vw,1.4rem)] leading-tight text-[var(--color-heading)]">
              Level {xpLevel.level}{xpLevel.is_max_level ? " — MAX" : ""}
            </h3>
          </div>
        </div>
        <p className="m-0 shrink-0 text-right text-[clamp(1.15rem,2vw,1.45rem)] font-extrabold text-[var(--color-primary)]">
          {formatXp(xpLevel.total_xp)} XP
        </p>
      </div>

      {xpLevel.is_max_level ? (
        <div className="mt-4">
          <div className="h-2.5 overflow-hidden rounded-full bg-[#dbe3f8]" aria-hidden="true">
            <span className="block h-full w-full rounded-full bg-[var(--color-primary)]" />
          </div>
          <p className="mb-0 mt-2 text-[0.8rem] font-bold text-[#42547f]">Đã đạt cấp độ tối đa. Tổng XP vẫn tiếp tục tăng.</p>
        </div>
      ) : (
        <div className="mt-4">
          <div className="mb-2 flex items-end justify-between gap-3 text-[0.78rem] text-[#526078] max-[480px]:items-start max-[480px]:flex-col max-[480px]:gap-1">
            <span>{formatXp(xpLevel.total_xp - xpLevel.level_min_xp)} / {formatXp(xpLevel.next_level_xp - xpLevel.level_min_xp)} XP trong cấp độ này</span>
            <strong className="shrink-0 text-[#34466f]">Còn {formatXp(remainingXp)} XP đến cấp tiếp theo</strong>
          </div>
          <div
            aria-label={`Tiến độ XP Level ${xpLevel.level}`}
            aria-valuemax={xpLevel.next_level_xp}
            aria-valuemin={xpLevel.level_min_xp}
            aria-valuenow={xpLevel.total_xp}
            className="h-2.5 overflow-hidden rounded-full bg-[#dbe3f8]"
            role="progressbar"
          >
            <span
              className="block h-full rounded-full bg-[var(--color-primary)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function clampPercentage(value) {
  return Math.min(100, Math.max(0, value));
}

function formatXp(value) {
  return value.toLocaleString("vi-VN");
}

function MySetsSummary({ sets }) {
  const preview = sets.slice(0, DASHBOARD_SET_PREVIEW_LIMIT);
  return (
    <div className="dashboard-sets-content">
      <p className="dashboard-set-total mb-[1.15rem] mt-[-0.55rem] text-[0.86rem] text-[var(--color-muted)] [&_strong]:text-[var(--color-body)]">{sets.length > 0 ? <>Bạn đang có <strong>{sets.length}</strong> bộ từ riêng.</> : "Không gian học của riêng bạn đang chờ bộ từ đầu tiên."}</p>
      {preview.length === 0 ? (
        <div className="dashboard-empty-note dashboard-sets-empty flex min-w-0 items-start gap-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[#fbfcff] p-[clamp(1.25rem,3vw,2rem)] max-[480px]:flex-col" role="status">
          <span className="dashboard-empty-icon grid size-12 shrink-0 place-items-center rounded-[var(--radius-lg)] bg-[#e9efff] text-[var(--color-primary)] [&_svg]:size-6" aria-hidden="true"><FolderOpen /></span>
          <div className="dashboard-empty-copy">
            <h3 className="m-0 text-[0.95rem] text-[var(--color-heading)]">Bạn chưa có bộ từ riêng</h3>
            <p className="mb-0 mt-1 max-w-[38rem] text-[0.84rem] leading-normal text-[var(--color-muted)]">Tự tạo một bộ từ theo mục tiêu của bạn, hoặc khám phá nội dung có sẵn để bắt đầu học.</p>
            <div className="dashboard-empty-actions mt-4 flex flex-wrap gap-[0.6rem] max-[480px]:flex-col">
              <Link className={PRIMARY_LINK_CLASSES} to="/my/vocabulary-sets"><Plus aria-hidden="true" /> Tạo bộ từ</Link>
              <Link className={SECONDARY_LINK_CLASSES} to="/topics">Khám phá bộ từ <ArrowRight aria-hidden="true" /></Link>
            </div>
          </div>
        </div>
      ) : (
        <ul className="dashboard-set-grid m-0 grid list-none grid-cols-3 gap-4 p-0 max-[760px]:grid-cols-1" aria-label="Bộ từ riêng xem trước">
          {preview.map((set, index) => (
            <li className="min-w-0" key={set.id}>
              <article className="dashboard-set-card flex min-h-full min-w-0 flex-col justify-between gap-5 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)] transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-[#cbd6f5] hover:shadow-[var(--shadow-md)] motion-reduce:transform-none motion-reduce:transition-none motion-reduce:duration-0 max-[760px]:gap-[0.9rem] max-[760px]:p-[0.95rem]">
                <div className="dashboard-set-card-content min-w-0">
                  <span className={`dashboard-set-icon mb-4 grid size-11 place-items-center rounded-[0.9rem] max-[760px]:mb-[0.7rem] max-[760px]:size-10 [&_svg]:size-[1.35rem] ${SET_ICON_STYLES[index % SET_ICON_STYLES.length]}`} aria-hidden="true"><LibraryBig /></span>
                  <h3 className="m-0 text-[1.05rem] text-[var(--color-heading)] [overflow-wrap:anywhere]">{set.name}</h3>
                  {set.description ? <p className="mb-[0.85rem] mt-2 line-clamp-2 min-h-[2.7rem] text-[0.84rem] leading-[1.55] text-[var(--color-muted)] max-[760px]:mb-[0.65rem] max-[760px]:mt-[0.35rem] max-[760px]:min-h-0">{set.description}</p> : <p className="is-muted mb-[0.85rem] mt-2 line-clamp-2 min-h-[2.7rem] text-[0.84rem] leading-[1.55] text-[#98a2b3] max-[760px]:mb-[0.65rem] max-[760px]:mt-[0.35rem] max-[760px]:min-h-0">Chưa có mô tả.</p>}
                  <span className="dashboard-set-count inline-flex items-center gap-[0.35rem] text-[0.78rem] font-bold text-[var(--color-muted)] [&_svg]:size-4"><BookOpenCheck aria-hidden="true" /> {set.item_count} từ vựng</span>
                </div>
                <div className="dashboard-set-actions flex flex-wrap gap-[0.6rem] max-[480px]:flex-col">
                  <Link className={SECONDARY_LINK_CLASSES} to={`/my/vocabulary-sets/${set.id}`}>
                    Xem chi tiết
                  </Link>
                  {set.item_count > 0 ? (
                    <Link
                      className={PRIMARY_LINK_CLASSES}
                      to={`/learn/vocabulary-sets/${set.id}`}
                      state={{ returnTo: "/dashboard" }}
                    >
                      Bắt đầu học <ArrowRight aria-hidden="true" />
                    </Link>
                  ) : null}
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function useDashboardSource(enabled, loader, key) {
  const [retryToken, setRetryToken] = useState(0);
  const [state, setState] = useState({ data: null, status: enabled ? "loading" : "idle" });
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!enabled) return undefined;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    loader()
      .then((data) => {
        if (requestIdRef.current === requestId) setState({ data, status: "success" });
      })
      .catch(() => {
        if (requestIdRef.current === requestId) setState((current) => ({ data: current.data, status: "error" }));
      });

    return () => {
      if (requestIdRef.current === requestId) requestIdRef.current += 1;
    };
  }, [enabled, loader, retryToken]);

  function retry() {
    if (!enabled || state.status === "loading") return;
    setState((current) => ({ data: current.data, status: "loading" }));
    setRetryToken((value) => value + 1);
  }

  return { ...state, key, retry };
}
