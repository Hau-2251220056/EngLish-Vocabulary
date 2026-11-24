import { AlertTriangle, ArrowRight, BookOpen, BookOpenCheck, BookText, Compass, Flame, LibraryBig, LockKeyhole, Map, RefreshCw, Tags, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import dashboardLearningIllustration from "../assets/images/banner.png";
import { useAuthentication } from "../auth/use-authentication.js";
import { LoadingIndicator } from "../components/loading-indicator.jsx";
import { learningService } from "../services/learning-service.js";
import { learningPathService } from "../services/learning-path-service.js";
import { learningSessionService } from "../services/learning-session-service.js";
import { topicService } from "../services/topic-service.js";
import { vocabularySetService } from "../services/vocabulary-set-service.js";
import { loadDiscoveryCatalog, selectDiscoveryFeaturedSets } from "../topics/discovery-catalog.js";
import { DefaultSetCoverArtwork, SetCover } from "../vocabulary-sets/set-metadata-presentation.jsx";
import { getDashboardGreeting } from "./dashboard-greeting.js";
import { getCurrentLearningPresentation } from "./dashboard-current-learning.js";
import {
  aggregateCefrDistribution,
  aggregateTopicDistribution,
  percentage,
  requireSystemSetSummaries,
  requireTopicSummaries,
  requireVocabularySummaries,
  selectLeadingCefr,
} from "./admin-dashboard-data.js";
import { loadAdminVocabularyList } from "./admin-vocabulary-store.js";
import "./dashboard-page.css";

const FOCUS_CLASSES = "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#0877b9]/30";
const REVIEW_LINK_CLASSES = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#47750D] bg-[#518314] px-4 py-2.5 text-sm font-extrabold text-white no-underline transition-colors duration-150 hover:bg-[#47750D] active:bg-[#3F6212] motion-reduce:transition-none ${FOCUS_CLASSES}`;
const SUGGESTION_LINK_CLASSES = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#B83B0B] bg-[#C94F00] px-4 py-2.5 text-sm font-extrabold text-white no-underline transition-colors duration-150 hover:bg-[#B83B0B] active:bg-[#9A3412] motion-reduce:transition-none ${FOCUS_CLASSES}`;
const CONTINUE_LINK_CLASSES = `inline-flex min-h-11 w-fit items-center gap-1.5 rounded-md text-sm font-extrabold text-[#075f95] no-underline transition-colors duration-150 hover:text-[#064d78] hover:underline hover:underline-offset-4 active:text-[#053c5e] motion-reduce:transition-none ${FOCUS_CLASSES}`;
const CARD_CLASSES = "min-w-0 rounded-2xl border shadow-[0_12px_30px_rgb(15_83_115/7%)]";
const DATA_CARD_TONES = Object.freeze({
  "learning-path": "border-blue-200 bg-[#f8fbff]",
  review: "border-[#7ED321] bg-[#F4FCE8]",
});
const loadProgress = () => learningService.getLearningProgress({ page: 1, page_size: 1 });
const loadCurrentStreak = () => learningSessionService.getCurrentStreak();
const loadMySets = () => vocabularySetService.listMySets();
const loadLearningPath = () => learningPathService.getPath();
const loadReviewSummary = () => learningService.getGlobalReviewSummary();
const loadFeaturedCatalog = () => loadDiscoveryCatalog();
const loadAdminTopics = () => topicService.listTopics().then(requireTopicSummaries);
const loadAdminVocabulary = () => loadAdminVocabularyList().then(requireVocabularySummaries);
const loadAdminSystemSets = () => vocabularySetService.listAdminSystemSets().then(requireAdminSystemSetSummaries);

export function DashboardPage() {
  const { user } = useAuthentication();
  const isUser = user.role === "USER";
  const progress = useDashboardSource(isUser, loadProgress, "progress");
  const streak = useDashboardSource(isUser, loadCurrentStreak, "streak");
  const mySets = useDashboardSource(isUser, loadMySets, "sets");
  const learningPath = useDashboardSource(isUser, loadLearningPath, "learning-path");
  const currentLearning = useCurrentLearningPass(isUser, learningPath);
  const review = useDashboardSource(isUser, loadReviewSummary, "review");
  const featured = useDashboardSource(isUser, loadFeaturedCatalog, "featured");
  const adminTopics = useDashboardSource(!isUser, loadAdminTopics, "admin-topics");
  const adminVocabulary = useDashboardSource(!isUser, loadAdminVocabulary, "admin-vocabulary");
  const adminSystemSets = useDashboardSource(!isUser, loadAdminSystemSets, "admin-system-sets");

  if (!isUser) return <DashboardAdminLanding systemSets={adminSystemSets} topics={adminTopics} vocabulary={adminVocabulary} />;

  return (
    <section aria-labelledby="dashboard-title" className="dashboard-page mx-auto min-w-0 w-full max-w-6xl px-[clamp(1rem,3vw,3rem)] pb-12 pt-[clamp(1.25rem,3vw,2.5rem)] text-[var(--color-body)]">
      <DashboardIntroduction displayName={user.display_name} />
      <DashboardStatistics mySets={mySets} progress={progress} streak={streak} />

      <div className="mt-8 grid min-w-0 grid-cols-2 items-start gap-x-5 gap-y-3 max-[800px]:grid-cols-1">
        <h2 className="col-start-1 row-start-1 m-0 rounded-sm text-[clamp(1.1rem,2vw,1.3rem)] font-extrabold tracking-[-0.02em] text-slate-900 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#0877b9]/30 max-[800px]:col-start-auto max-[800px]:row-start-auto" id="dashboard-next-suggestion-title" tabIndex={-1}>Gợi ý tiếp theo</h2>
        <NextSuggestionSection source={learningPath} />
        <CurrentLearningSection catalogSource={featured} pathSource={learningPath} source={currentLearning} />
        <DashboardDataCard className={`col-start-1 ${currentLearning.recommendation ? "row-start-4" : "row-start-3"} max-[800px]:col-start-auto max-[800px]:row-start-auto`} errorMessage="Không thể tải lộ trình CEFR. Các khu vực khác vẫn dùng được." loadingMessage="Đang tải lộ trình CEFR…" source={learningPath} title="Lộ trình CEFR" type="learning-path">
          {(data) => <CefrPathSummary path={data} />}
        </DashboardDataCard>
        <DashboardDataCard className="col-start-2 row-start-2 h-full max-[800px]:col-start-auto max-[800px]:row-start-auto" errorMessage="Không thể tải số từ cần ôn. Các khu vực khác vẫn dùng được." loadingMessage="Đang tải từ cần ôn…" source={review} title="Từ cần ôn" type="review">
          {(data) => <ReviewSummary summary={data} />}
        </DashboardDataCard>
        <FeaturedSetsSection catalogSource={featured} className={`col-start-2 row-start-3 ${currentLearning.recommendation ? "row-span-2" : ""} max-[800px]:col-start-auto max-[800px]:row-start-auto max-[800px]:row-span-1`} pathSource={learningPath} />
      </div>
    </section>
  );
}

function DashboardStatistics({ mySets, progress, streak }) {
  return (
    <section aria-labelledby="dashboard-statistics-title" className="mt-6 min-w-0">
      <h2 className="sr-only" id="dashboard-statistics-title">Tổng quan học tập</h2>
      <div className="grid min-w-0 grid-cols-4 gap-4 max-[900px]:grid-cols-2 max-[520px]:gap-3">
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
    <StatisticSourceCard accent="text-[#075f95]" label="Cấp độ" source={source} tone="border-[#c7e3f3] bg-[#f1f9fd]">
      {(data) => {
        const xp = data.xp_level;
        const progressPercent = xp.is_max_level ? 100 : clampPercentage(((xp.total_xp - xp.level_min_xp) / (xp.next_level_xp - xp.level_min_xp)) * 100);
        const circumference = 2 * Math.PI * 22;
        return (
          <div className="flex min-w-0 items-center gap-3.5 max-[520px]:gap-2">
            <div aria-label={`Tiến độ XP Level ${xp.level}`} aria-valuemax={xp.is_max_level ? xp.total_xp : xp.next_level_xp} aria-valuemin={xp.level_min_xp} aria-valuenow={xp.total_xp} className="relative grid size-[4.25rem] shrink-0 place-items-center max-[520px]:size-[3.25rem]" role="progressbar">
              <svg aria-hidden="true" className="size-full -rotate-90" viewBox="0 0 52 52">
                <circle className="fill-none stroke-slate-200" cx="26" cy="26" r="22" strokeWidth="5" />
                <circle className="fill-none stroke-[#0877b9]" cx="26" cy="26" r="22" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progressPercent / 100)} strokeLinecap="round" strokeWidth="5" />
              </svg>
              <strong className="absolute text-xl text-slate-900 tabular-nums max-[520px]:text-lg">{xp.level}</strong>
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
    <StatisticSourceCard accent="text-[#b45309]" label="Chuỗi học" source={source} tone="border-[#fed7aa] bg-[#fff7ed]">
      {(data) => (
        <div className="grid min-w-0 grid-cols-[auto_1fr] items-center gap-x-3.5 max-[520px]:gap-x-2">
          <span className={`row-span-2 grid size-12 shrink-0 place-items-center rounded-xl border max-[520px]:row-span-1 max-[520px]:size-10 [&_svg]:size-6 max-[520px]:[&_svg]:size-5 ${data.completed_today ? "border-orange-200 bg-orange-100 text-[#d94a1e]" : "border-slate-200 bg-slate-100 text-slate-400"}`} aria-hidden="true"><Flame /></span>
          <p className="m-0 min-w-0 text-[1.65rem] font-extrabold leading-none text-slate-900 tabular-nums max-[520px]:text-xl" aria-label={`Chuỗi hiện tại ${data.current_streak} ngày`}>{data.current_streak} <span className="text-sm font-bold text-slate-500 max-[520px]:text-xs">ngày</span></p>
          <p className="col-start-2 mb-0 mt-1.5 text-xs font-bold leading-snug text-slate-500 max-[520px]:col-span-2 max-[520px]:col-start-1 max-[520px]:mt-2">{data.completed_today ? "Đã duy trì hôm nay" : "Chưa hoàn thành hôm nay"}</p>
        </div>
      )}
    </StatisticSourceCard>
  );
}

function TotalXpStat({ source }) {
  return (
    <StatisticSourceCard accent="text-[#0e7490]" label="Tổng XP" source={source} tone="border-[#c7eef4] bg-[#f0fdff]">
      {(data) => <div className="flex min-w-0 items-center gap-3.5 max-[520px]:gap-2"><span className="grid size-12 shrink-0 place-items-center rounded-xl border border-[#b9e7ef] bg-white/70 text-[#0e7490] shadow-sm max-[520px]:size-10 [&_svg]:size-6 max-[520px]:[&_svg]:size-5" aria-hidden="true"><Zap /></span><p className="m-0 min-w-0 text-[1.65rem] font-extrabold leading-none text-slate-900 tabular-nums max-[520px]:text-xl">{formatXp(data.xp_level.total_xp)} <span className="text-sm font-bold text-slate-600 max-[520px]:text-xs">XP</span></p></div>}
    </StatisticSourceCard>
  );
}

function SetCountStat({ source }) {
  return (
    <StatisticSourceCard accent="text-[#047857]" label="Bộ từ cá nhân" source={source} tone="border-[#bbe8d0] bg-[#f0fdf7]">
      {(data) => <div className="flex min-w-0 items-center gap-3.5 max-[520px]:gap-2"><span className="grid size-12 shrink-0 place-items-center rounded-xl border border-[#a8ddc0] bg-white/70 text-[#047857] shadow-sm max-[520px]:size-10 [&_svg]:size-6 max-[520px]:[&_svg]:size-5" aria-hidden="true"><LibraryBig /></span><p className="m-0 min-w-0 text-[1.65rem] font-extrabold leading-none text-slate-900 tabular-nums max-[520px]:text-xl">{data.length} <span className="text-sm font-bold leading-tight text-slate-600 max-[520px]:hidden">bộ cá nhân</span><span className="hidden whitespace-nowrap text-xs font-bold text-slate-600 max-[520px]:inline">bộ</span></p></div>}
    </StatisticSourceCard>
  );
}

function StatisticSourceCard({ accent, children, label, source, tone }) {
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
    <article className={`${CARD_CLASSES} ${tone} min-h-[9rem] p-4 shadow-[0_10px_24px_rgb(15_23_42/6%)] max-[520px]:min-h-[8.25rem] max-[520px]:p-3`} aria-busy={source.status === "loading"}>
      <h3 className={`m-0 rounded-sm text-sm font-extrabold max-[520px]:text-[0.8125rem] ${accent} focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#0877b9]/30`} ref={headingRef} tabIndex={-1}>{label}</h3>
      {source.status === "loading" ? <div className="mt-4" role="status"><span className="sr-only">Đang tải {label.toLocaleLowerCase("vi-VN")}…</span><span className="block h-12 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" aria-hidden="true" /></div> : null}
      {source.status === "error" ? <div className="mt-3" role="alert">{hasValue ? <div className="mb-3">{children(source.data)}</div> : null}<p className="m-0 text-xs font-semibold leading-relaxed text-red-700">{hasValue ? "Dữ liệu gần nhất có thể đã cũ." : "Chưa thể tải dữ liệu."}</p><button className={`mt-2 min-h-11 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 text-xs font-extrabold text-[#075f95] hover:bg-sky-50 ${FOCUS_CLASSES}`} ref={retryButtonRef} type="button" onClick={retry}>Thử lại</button></div> : null}
      {source.status === "success" ? <div className="mt-4">{children(source.data)}</div> : null}
    </article>
  );
}

function NextSuggestionSection({ source }) {
  const retryButtonRef = useRef(null);
  const retryRequestedRef = useRef(false);
  useEffect(() => {
    if (!retryRequestedRef.current || source.status === "loading") return;
    if (source.status === "error") retryButtonRef.current?.focus();
    if (source.status === "success") document.getElementById("dashboard-next-suggestion-title")?.focus();
    retryRequestedRef.current = false;
  }, [source.status]);
  function retry() {
    retryRequestedRef.current = true;
    source.retry();
  }
  return (
    <section aria-labelledby="dashboard-next-suggestion-title" aria-busy={source.status === "loading"} className="col-start-1 row-start-2 min-w-0 h-full max-[800px]:col-start-auto max-[800px]:row-start-auto">
      {source.status === "loading" ? <div className="h-full min-h-32 animate-pulse rounded-2xl border border-[#F97316] bg-[#FFF3E9] motion-reduce:animate-none" role="status"><span className="sr-only">Đang tải gợi ý tiếp theo…</span></div> : null}
      {source.status === "error" ? <div className="flex h-full min-h-32 min-w-0 items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4" role="alert"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-700" aria-hidden="true" /><div className="min-w-0"><p className="m-0 text-sm font-semibold leading-relaxed text-red-800">Không thể tải gợi ý tiếp theo. Các khu vực khác vẫn dùng được.</p><button className={`mt-3 min-h-11 cursor-pointer rounded-lg border border-red-200 bg-white px-3 text-sm font-extrabold text-red-800 hover:bg-red-100 ${FOCUS_CLASSES}`} ref={retryButtonRef} type="button" onClick={retry}>Thử lại</button></div></div> : null}
      {source.status === "success" ? <NextSuggestionSummary path={source.data} /> : null}
    </section>
  );
}

function NextSuggestionSummary({ path }) {
  const primaryLevel = getPrimaryLevel(path);
  const suggestion = path.next_suggestion;
  const suggestedSet = suggestion ? findRecommendedSet(path, suggestion.set_id) : null;
  const configurationMessage = getConfigurationMessage(primaryLevel);
  const milestoneMessage = getNextLevelMilestone(path, primaryLevel);
  if (!suggestion || !suggestedSet) {
    const allIncompleteSetsActive = path.next_suggestion_reason === "ALL_INCOMPLETE_SETS_ACTIVE";
    const message = allIncompleteSetsActive
      ? primaryLevel.incomplete_sets.length === 1
        ? "Bộ từ còn lại đang có lượt học hoặc ôn tập. Hãy tiếp tục hoạt động hiện tại thay vì bắt đầu một lượt trùng lặp."
        : "Những bộ từ chưa hoàn thành ở cấp độ này đang có lượt học hoặc ôn tập. Hãy tiếp tục các hoạt động hiện tại trước khi chọn gợi ý mới."
      : path.all_current_sets_complete
        ? "Bạn đã hoàn thành các bộ từ hiện có trong lộ trình."
        : configurationMessage ?? "Hiện chưa có bộ từ phù hợp để đề xuất ở cấp độ này.";
    return <div className="flex h-full min-w-0 items-start gap-4 rounded-2xl border border-[#F97316] bg-[#FFF3E9] p-5" role="status"><span className="grid size-11 shrink-0 place-items-center rounded-xl border border-[#F97316] bg-white/75 text-[#F97316] shadow-sm [&_svg]:size-5" aria-hidden="true"><BookOpenCheck /></span><div className="min-w-0"><p className="m-0 font-extrabold text-slate-900">Chưa có gợi ý tiếp theo</p><p className="mb-0 mt-1 text-sm leading-relaxed text-slate-600">{message}</p>{milestoneMessage ? <p className="mb-0 mt-2 text-sm font-bold leading-relaxed text-[#9A3412]">{milestoneMessage}</p> : null}</div></div>;
  }
  return (
    <div className="flex h-full min-w-0 flex-wrap items-center justify-between gap-5 rounded-2xl border border-[#F97316] bg-[#FFF3E9] p-[clamp(1rem,2.5vw,1.25rem)] shadow-[0_10px_24px_rgb(180_83_9/7%)] max-[560px]:items-stretch max-[560px]:flex-col max-[560px]:flex-nowrap">
      <div className="flex min-w-0 flex-1 basis-64 items-start gap-3 max-[560px]:basis-auto"><span className="grid size-11 shrink-0 place-items-center rounded-xl border border-[#F97316] bg-white/75 text-[#F97316] shadow-sm [&_svg]:size-5" aria-hidden="true"><BookOpenCheck /></span><div className="min-w-0 flex-1"><p className="m-0 text-lg font-extrabold leading-tight text-slate-900 [overflow-wrap:anywhere]">{suggestedSet.name}</p><div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-600"><span className="inline-flex min-h-8 items-center rounded-full border border-[#F97316] bg-white/70 px-3 text-[#9A3412]">{suggestedSet.level}</span>{primaryLevel ? <span>{primaryLevel.completed_count} / {primaryLevel.required_count} bộ đã hoàn thành</span> : null}</div>{milestoneMessage ? <p className="mb-0 mt-2 text-sm font-bold leading-relaxed text-[#9A3412]">{milestoneMessage}</p> : null}</div></div>
      <Link className={`${SUGGESTION_LINK_CLASSES} ml-auto shrink-0 max-[560px]:ml-0 max-[560px]:w-full`} to={`/learn/vocabulary-sets/${suggestion.set_id}`} state={{ returnTo: "/dashboard", learningPathAction: suggestion.action, passId: suggestion.pass_id }}>Bắt đầu học <ArrowRight aria-hidden="true" className="size-4" /></Link>
    </div>
  );
}

function CurrentLearningSection({ catalogSource, pathSource, source }) {
  const headingRef = useRef(null);
  const retryButtonRef = useRef(null);
  const retryRequestedRef = useRef(false);
  useEffect(() => {
    if (!retryRequestedRef.current || source.status === "loading") return;
    if (source.status === "error") retryButtonRef.current?.focus();
    if (source.status === "success") headingRef.current?.focus();
    retryRequestedRef.current = false;
  }, [source.status]);
  if (!source.recommendation) return null;
  const set = pathSource.data ? findRecommendedSet(pathSource.data, source.recommendation.set_id) : null;
  const catalogSet = catalogSource.data?.sets.find(({ id }) => id === source.recommendation.set_id) ?? null;
  const invalidSet = pathSource.status === "success" && !set;
  function retry() {
    retryRequestedRef.current = true;
    source.retry();
  }
  return (
    <section aria-labelledby="dashboard-current-learning-title" aria-busy={source.status === "loading"} className={`${CARD_CLASSES} col-start-1 row-start-3 min-w-0 border-sky-200 bg-white ${source.status === "success" && set ? "overflow-hidden p-0" : "p-[clamp(1rem,2.5vw,1.25rem)]"} max-[800px]:col-start-auto max-[800px]:row-start-auto`}>
      {source.status !== "success" || !set ? <h2 className="m-0 rounded-sm text-xs font-extrabold uppercase tracking-[0.12em] text-[#075f95]" id="dashboard-current-learning-title">Tiếp tục học</h2> : null}
      {source.status === "loading" ? <div className="grid min-h-28 place-items-center"><LoadingIndicator label="Đang tải lượt học hiện tại…" variant="centered" /></div> : null}
      {source.status === "error" || invalidSet ? <div className="mt-3 flex min-h-28 min-w-0 items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4" role="alert"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-700" aria-hidden="true" /><div className="min-w-0"><p className="m-0 text-sm font-semibold leading-relaxed text-red-800">{invalidSet ? "Chưa thể xác định bộ từ đang học. Hãy tải lại Dashboard." : "Không thể tải tiến độ lượt học hiện tại. Các khu vực khác vẫn dùng được."}</p>{!invalidSet ? <button className={`mt-3 min-h-11 cursor-pointer rounded-lg border border-red-200 bg-white px-3 text-sm font-extrabold text-red-800 hover:bg-red-100 ${FOCUS_CLASSES}`} ref={retryButtonRef} type="button" onClick={retry}>Thử lại</button> : null}</div></div> : null}
      {source.status === "success" && set ? <CurrentLearningSummary coverImageUrl={catalogSet?.cover_image_url ?? null} headingRef={headingRef} pass={source.data} recommendation={source.recommendation} set={set} /> : null}
    </section>
  );
}

function CurrentLearningSummary({ coverImageUrl, headingRef, pass, recommendation, set }) {
  const presentation = getCurrentLearningPresentation(pass);
  if (!presentation.isValid) return <p className="m-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800" role="alert">Trạng thái lượt học không hợp lệ. Hãy tải lại Dashboard.</p>;
  const restartRequired = pass.can_continue === false;
  return (
    <div className="flex min-w-0 items-stretch">
      <SetCover
        alt=""
        className="relative w-[clamp(6.5rem,27%,8.5rem)] shrink-0 self-stretch overflow-hidden bg-sky-50 max-[560px]:w-[5.5rem]"
        coverImageUrl={coverImageUrl}
        fallback={<span className="absolute inset-0 grid place-items-center text-[#0877b9] [&_svg]:size-9 max-[560px]:[&_svg]:size-7"><DefaultSetCoverArtwork /></span>}
        imageClassName="absolute inset-0 size-full object-cover"
      />
      <div className="flex min-w-0 flex-1 flex-col justify-center px-4 py-3 max-[560px]:px-3">
        <h2 className="m-0 rounded-sm text-xs font-extrabold uppercase tracking-[0.12em] text-[#075f95] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#0877b9]/30" id="dashboard-current-learning-title" ref={headingRef} tabIndex={-1}>Tiếp tục học</h2>
        <p className="mb-0 mt-1 text-lg font-extrabold leading-tight text-slate-900 [overflow-wrap:anywhere]">{set.name}</p>
        <p className="mb-0 mt-2 text-sm font-bold leading-relaxed text-slate-600" role="status">{presentation.status}</p>
        {restartRequired ? <p className="mb-0 mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-sm font-semibold text-amber-900" role="status">Nội dung bộ từ đã thay đổi. Mở lượt học để xác nhận bắt đầu lại an toàn.</p> : null}
        <Link className={`${CONTINUE_LINK_CLASSES} mt-1`} to={`/learn/vocabulary-sets/${recommendation.set_id}`} state={{ returnTo: "/dashboard", learningPathAction: "RESUME", passId: recommendation.pass_id }}>Tiếp tục <ArrowRight aria-hidden="true" className="size-4" /></Link>
      </div>
    </div>
  );
}

function CefrPathSummary({ path }) {
  const primaryLevel = getPrimaryLevel(path);
  const preservedCompletion = Boolean(path.path_completed_at) && !path.all_current_sets_complete;
  const configurationMessage = getConfigurationMessage(primaryLevel);
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl border border-blue-200 bg-blue-100 text-[#0877b9] [&_svg]:size-5" aria-hidden="true"><Map /></span><div className="min-w-0"><p className="m-0 text-xs font-bold text-slate-500">Cấp độ cao nhất đã mở</p><p className="mb-0 mt-0.5 text-xl font-extrabold text-slate-900">CEFR {path.highest_unlocked_level}</p>{primaryLevel ? <p className="mb-0 mt-1 text-sm text-slate-600">{primaryLevel.completed_count} / {primaryLevel.required_count} bộ công khai đã hoàn thành</p> : null}</div></div>
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
      <div className="flex min-w-0 items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl border border-[#7ED321] bg-white/75 text-[#7ED321] [&_svg]:size-5" aria-hidden="true"><RefreshCw /></span><div className="min-w-0">{summary.has_due_items ? <p className="m-0 text-xl font-extrabold text-slate-900">{summary.due_count} từ đang đến hạn</p> : <p className="m-0 text-xl font-extrabold text-slate-900">Đã ôn tập đầy đủ</p>}{!summary.has_due_items && summary.nearest_future_review_at ? <p className="mb-0 mt-1 text-sm text-slate-600">Lần ôn gần nhất: {new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(summary.nearest_future_review_at))}</p> : null}</div></div>
      <Link className={`${REVIEW_LINK_CLASSES} shrink-0 max-[520px]:w-full`} to="/review">Xem ôn tập <ArrowRight aria-hidden="true" className="size-4" /></Link>
    </div>
  );
}

function FeaturedSetsSection({ catalogSource, className = "", pathSource }) {
  const headingRef = useRef(null);
  const retryButtonRef = useRef(null);
  const retryRequestedRef = useRef(false);
  useEffect(() => {
    if (!retryRequestedRef.current || catalogSource.status === "loading") return;
    if (catalogSource.status === "error") retryButtonRef.current?.focus();
    if (catalogSource.status === "success") headingRef.current?.focus();
    retryRequestedRef.current = false;
  }, [catalogSource.status]);
  function retry() {
    retryRequestedRef.current = true;
    catalogSource.retry();
  }
  const sets = catalogSource.status === "success"
    ? selectDiscoveryFeaturedSets(catalogSource.data.sets.filter((set) => set.item_count > 0))
    : [];
  return (
    <section aria-labelledby="dashboard-featured-title" aria-busy={catalogSource.status === "loading"} className={`${CARD_CLASSES} min-w-0 border-cyan-200 bg-white p-[clamp(1rem,2.5vw,1.5rem)] ${className}`}>
      <div className="flex min-w-0 items-center justify-between gap-4">
        <h2 className="m-0 rounded-sm text-[clamp(1.1rem,2vw,1.3rem)] font-extrabold tracking-[-0.02em] text-slate-900 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#0877b9]/30" id="dashboard-featured-title" ref={headingRef} tabIndex={-1}>Bộ từ nổi bật</h2>
        <Link className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm font-extrabold text-[#075f95] no-underline hover:bg-sky-50 ${FOCUS_CLASSES}`} to="/topics">Khám phá <Compass className="size-4" aria-hidden="true" /></Link>
      </div>
      {catalogSource.status === "loading" ? <div className="mt-4 min-h-32 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" role="status"><span className="sr-only">Đang tải bộ từ nổi bật…</span></div> : null}
      {catalogSource.status === "error" ? <div className="mt-4 flex min-w-0 items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4" role="alert"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-700" aria-hidden="true" /><div className="min-w-0"><p className="m-0 text-sm font-semibold leading-relaxed text-red-800">Không thể tải bộ từ nổi bật.</p><button className={`mt-3 min-h-11 cursor-pointer rounded-lg border border-red-200 bg-white px-3 text-sm font-extrabold text-red-800 hover:bg-red-100 ${FOCUS_CLASSES}`} ref={retryButtonRef} type="button" onClick={retry}>Thử lại</button></div></div> : null}
      {catalogSource.status === "success" && sets.length === 0 ? <p className="mb-0 mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600" role="status">Chưa có bộ từ công khai phù hợp để giới thiệu.</p> : null}
      {catalogSource.status === "success" && sets.length > 0 ? <ul className="mb-0 mt-3 grid list-none gap-1.5 p-0" aria-label="Bộ từ nổi bật">{sets.map((set) => {
        const level = pathSource.data?.levels.find(({ level: value }) => value === set.cefr_level);
        const locked = Boolean(level && !level.unlocked);
        return <li className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5" key={set.id}><span className="grid size-10 shrink-0 place-items-center rounded-lg border border-cyan-200 bg-cyan-50 text-[#0E7490]" aria-hidden="true"><BookOpen className="size-5" /></span><div className="min-w-0 flex-1"><p className="m-0 truncate text-sm font-extrabold text-slate-900" title={set.name}>{set.name}</p><p className="mb-0 mt-0.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-500"><span>{set.topic.name}</span><span aria-hidden="true">·</span><span>{set.item_count} từ</span>{set.cefr_level ? <><span aria-hidden="true">·</span><span>{set.cefr_level}</span></> : null}{locked ? <span className="inline-flex items-center gap-1 text-slate-600"><LockKeyhole className="size-3" aria-hidden="true" />Đang khóa</span> : null}</p></div><Link className={`inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-sm font-extrabold text-[#075f95] no-underline hover:bg-sky-50 ${FOCUS_CLASSES}`} to={`/vocabulary-sets/${set.id}`}>Xem<span className="sr-only"> {set.name}</span></Link></li>;
      })}</ul> : null}
    </section>
  );
}

function DashboardDataCard({ children, className = "", errorMessage, loadingMessage, source, title, type }) {
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
    <section aria-labelledby={titleId} aria-busy={source.status === "loading"} className={`${CARD_CLASSES} ${DATA_CARD_TONES[type]} min-w-0 p-[clamp(1rem,2.5vw,1.5rem)] ${className}`}>
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

const ADMIN_CEFR_COLORS = Object.freeze({ A1: "#0ea5e9", A2: "#22c55e", B1: "#f59e0b", B2: "#f97316", C1: "#14b8a6" });
const ADMIN_CEFR_LEVELS = Object.freeze(Object.keys(ADMIN_CEFR_COLORS));

function normalizeLegacyC2ForDashboardValidation(systemSets) {
  return systemSets.map((set) => set?.cefr_level === "C2" ? { ...set, cefr_level: "C1" } : set);
}

function requireAdminSystemSetSummaries(systemSets) {
  requireSystemSetSummaries(normalizeLegacyC2ForDashboardValidation(systemSets));
  return systemSets;
}

function getAdminCurriculumSets(systemSets) {
  return systemSets.filter(({ cefr_level: level }) => ADMIN_CEFR_LEVELS.includes(level));
}

function DashboardAdminLanding({ systemSets, topics, vocabulary }) {
  const destinations = [
    { description: "Tổ chức danh mục chủ đề dùng cho các bộ từ hệ thống.", icon: Tags, label: "Chủ đề", to: "/admin/topics" },
    { description: "Tạo và cập nhật từ vựng, nghĩa, ngữ cảnh và ví dụ.", icon: BookOpenCheck, label: "Kho từ vựng", to: "/admin/vocabulary" },
    { description: "Duy trì các bộ từ công khai và nội dung học theo thứ tự.", icon: BookText, label: "Bộ từ hệ thống", to: "/admin/vocabulary-sets" },
  ];
  const curriculumSets = systemSets.status === "success" ? getAdminCurriculumSets(systemSets.data) : null;
  const cefr = curriculumSets ? aggregateCefrDistribution(curriculumSets) : null;
  const leadingCefr = cefr ? selectLeadingCefr(cefr) : null;
  const leadingCefrStatus = !curriculumSets?.length ? "Chưa có dữ liệu" : leadingCefr ? `${leadingCefr.count} bộ từ` : "Đồng hạng";

  return (
    <section aria-labelledby="dashboard-title" className="dashboard-page dashboard-admin-page">
      <header className="dashboard-admin-heading">
        <h1 id="dashboard-title">Tổng quan hệ thống</h1>
        <p>Thống kê nội dung học tập của ELVocab.</p>
      </header>
      <section className="dashboard-admin-kpis" aria-label="Tổng quan nội dung">
        <AdminKpiCard description="Danh mục đang quản lý" icon={Tags} label="Tổng chủ đề" source={topics} />
        <AdminKpiCard description="Mục từ trong thư viện" icon={BookOpenCheck} label="Tổng từ vựng" source={vocabulary} />
        <AdminKpiCard description="Bao gồm mọi cấp hiện có" icon={BookText} label="Tổng bộ từ hệ thống" source={systemSets} />
        <article className="dashboard-admin-kpi is-leading-cefr" aria-label="Cấp CEFR có nhiều bộ từ nhất" aria-busy={systemSets.status === "loading"}>
          <span className="dashboard-admin-kpi-icon" aria-hidden="true"><BookOpen /></span>
          <div><p>Cấp CEFR có nhiều bộ từ nhất</p>
            {systemSets.status === "loading" ? <span className="dashboard-admin-kpi-loading" role="status">Đang tải…</span> : null}
            {systemSets.status === "error" ? <><span className="dashboard-admin-kpi-error" role="alert">Chưa thể tải dữ liệu.</span><button type="button" onClick={systemSets.retry}>Thử lại</button></> : null}
            {systemSets.status === "success" ? <><strong>{leadingCefr?.level ?? "—"}</strong><span>{leadingCefrStatus}</span></> : null}
          </div>
        </article>
      </section>
      <section className="dashboard-admin-insights" aria-label="Phân bố nội dung">
        <AdminCefrChart source={systemSets} />
        <AdminTopicChart setsSource={systemSets} topicsSource={topics} />
      </section>
      <div className="dashboard-admin-management-heading">
        <h2>Khu vực quản lý</h2>
        <p>Cập nhật nội dung học tập từ các danh mục hiện có.</p>
      </div>
      <nav className="dashboard-admin-shortcuts" aria-label="Khu vực quản trị">
        {destinations.map(({ description, icon: Icon, label, to }) => (
          <Link className="dashboard-admin-shortcut" key={to} to={to}>
            <span className="dashboard-admin-shortcut-icon" aria-hidden="true"><Icon /></span>
            <span className="dashboard-admin-shortcut-copy">
              <strong>{label}</strong>
              <span>{description}</span>
            </span>
            <ArrowRight className="dashboard-admin-shortcut-arrow" aria-hidden="true" />
          </Link>
        ))}
      </nav>
    </section>
  );
}

function AdminKpiCard({ description, icon: Icon, label, source }) {
  return (
    <article className="dashboard-admin-kpi" aria-busy={source.status === "loading"} aria-label={label}>
      <span className="dashboard-admin-kpi-icon" aria-hidden="true"><Icon /></span>
      <div>
        <p>{label}</p>
        {source.status === "loading" ? <span className="dashboard-admin-kpi-loading" role="status">Đang tải…</span> : null}
        {source.status === "error" ? <><span className="dashboard-admin-kpi-error" role="alert">Chưa thể tải dữ liệu.</span><button type="button" onClick={source.retry}>Thử lại</button></> : null}
        {source.status === "success" ? <><strong>{source.data.length.toLocaleString("vi-VN")}</strong><span>{description}</span></> : null}
      </div>
    </article>
  );
}

function AdminCefrChart({ source }) {
  if (source.status === "loading") return <AdminChartState loading title="Phân bố bộ từ theo cấp độ CEFR" />;
  if (source.status === "error") return <AdminChartState title="Phân bố bộ từ theo cấp độ CEFR" message="Chưa thể tải dữ liệu bộ từ." onRetry={source.retry} />;

  const curriculumSets = getAdminCurriculumSets(source.data);
  const distribution = aggregateCefrDistribution(curriculumSets);
  const total = curriculumSets.length;
  if (total === 0) return <AdminChartState title="Phân bố bộ từ theo cấp độ CEFR" message="Chưa có bộ từ hệ thống để phân bố." />;

  const gradient = distribution.reduce(({ cursor, segments }, { count, level }) => {
    const nextCursor = cursor + (count / total) * 100;
    return {
      cursor: nextCursor,
      segments: [...segments, `${ADMIN_CEFR_COLORS[level]} ${cursor}% ${nextCursor}%`],
    };
  }, { cursor: 0, segments: [] }).segments.join(", ");

  return (
    <section className="dashboard-admin-chart-card dashboard-admin-cefr-card" aria-labelledby="admin-cefr-chart-title">
      <header><h2 id="admin-cefr-chart-title">Phân bố bộ từ theo cấp độ CEFR</h2><p>{total.toLocaleString("vi-VN")} bộ từ hệ thống</p></header>
      <div className="dashboard-admin-cefr-visual">
        <div className="dashboard-admin-donut" style={{ "--admin-cefr-gradient": `conic-gradient(${gradient})` }} role="img" tabIndex={0} aria-label={`Biểu đồ phân bố ${total} bộ từ hệ thống trong các cấp A1 đến C1.`}><span aria-hidden="true"><strong>{total}</strong><small>Tổng bộ từ</small></span></div>
        <ul className="dashboard-admin-cefr-legend" aria-label="Chi tiết phân bố CEFR">
          {distribution.map(({ count, level }) => <li key={level}><span className="dashboard-admin-legend-swatch" style={{ backgroundColor: ADMIN_CEFR_COLORS[level] }} aria-hidden="true" /><strong>{level}</strong><span>{count} bộ</span><small>{percentage(count, total)}%</small><span className="sr-only">Cấp {level}: {count} bộ từ, chiếm {percentage(count, total)} phần trăm.</span></li>)}
        </ul>
      </div>
      <div className="sr-only"><table><caption>Phân bố bộ từ hệ thống theo cấp độ CEFR</caption><thead><tr><th scope="col">Cấp độ</th><th scope="col">Số bộ từ</th><th scope="col">Tỷ lệ</th></tr></thead><tbody>{distribution.map(({ count, level }) => <tr key={level}><th scope="row">{level}</th><td>{count}</td><td>{percentage(count, total)}%</td></tr>)}</tbody></table></div>
    </section>
  );
}

function AdminTopicChart({ setsSource, topicsSource }) {
  const loading = setsSource.status === "loading" || topicsSource.status === "loading";
  const failed = setsSource.status === "error" || topicsSource.status === "error";
  const retry = () => {
    if (setsSource.status === "error") setsSource.retry();
    if (topicsSource.status === "error") topicsSource.retry();
  };
  if (loading) return <AdminChartState loading title="Số bộ từ theo chủ đề" />;
  if (failed) return <AdminChartState title="Số bộ từ theo chủ đề" message="Chưa thể tải đầy đủ dữ liệu chủ đề và bộ từ." onRetry={retry} />;
  if (setsSource.data.length === 0) return <AdminChartState title="Số bộ từ theo chủ đề" message="Chưa có bộ từ hệ thống để phân bố theo chủ đề." />;

  let distribution;
  try { distribution = aggregateTopicDistribution(topicsSource.data, normalizeLegacyC2ForDashboardValidation(setsSource.data)); }
  catch { return <AdminChartState title="Số bộ từ theo chủ đề" message="Liên kết chủ đề của bộ từ không hợp lệ. Hãy thử tải lại dữ liệu." onRetry={() => { topicsSource.retry(); setsSource.retry(); }} />; }
  const maximum = Math.max(...distribution.map(({ count }) => count), 1);

  return (
    <section className="dashboard-admin-chart-card dashboard-admin-topic-card" aria-labelledby="admin-topic-chart-title">
      <header><h2 id="admin-topic-chart-title">Số bộ từ theo chủ đề</h2><p>{topicsSource.data.length.toLocaleString("vi-VN")} chủ đề</p></header>
      <ol className="dashboard-admin-topic-bars">
        {distribution.map(({ count, id, name }) => <li key={id} tabIndex={0} aria-label={`${name}: ${count} bộ từ`}><div><span title={name}>{name}</span><strong>{count}</strong></div><span className="dashboard-admin-topic-track" aria-hidden="true"><span style={{ width: `${(count / maximum) * 100}%` }} /></span></li>)}
      </ol>
      <div className="sr-only"><table><caption>Số bộ từ hệ thống theo chủ đề</caption><thead><tr><th scope="col">Chủ đề</th><th scope="col">Số bộ từ</th></tr></thead><tbody>{distribution.map(({ count, id, name }) => <tr key={id}><th scope="row">{name}</th><td>{count}</td></tr>)}</tbody></table></div>
    </section>
  );
}

function AdminChartState({ loading = false, message, onRetry, title }) {
  return <section className="dashboard-admin-chart-card dashboard-admin-chart-state" aria-busy={loading} aria-label={title}><h2>{title}</h2>{loading ? <LoadingIndicator label="Đang tải dữ liệu…" variant="centered" /> : <p role={onRetry ? "alert" : "status"}>{message}</p>}{onRetry ? <button type="button" onClick={onRetry}>Thử lại</button> : null}</section>;
}

function getPrimaryLevel(path) { return path.levels.find(({ level }) => level === path.highest_unlocked_level); }
function findRecommendedSet(path, setId) { return path.levels.flatMap(({ incomplete_sets: sets, level }) => sets.map((set) => ({ ...set, level }))).find(({ id }) => id === setId) ?? null; }
function getNextLevelMilestone(path, primaryLevel) {
  if (!primaryLevel || primaryLevel.configuration !== "READY"
    || primaryLevel.required_count - primaryLevel.completed_count !== 1
    || primaryLevel.incomplete_sets.length !== 1) return null;
  const primaryIndex = path.levels.findIndex(({ level }) => level === primaryLevel.level);
  const nextLevel = path.levels[primaryIndex + 1];
  if (!nextLevel || nextLevel.unlocked) return null;
  return `Sắp mở khóa ${nextLevel.level}. Hoàn thành bộ từ còn lại để tiếp tục lộ trình.`;
}
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

function useCurrentLearningPass(enabled, pathSource) {
  const [retryToken, setRetryToken] = useState(0);
  const [state, setState] = useState({ data: null, key: null, status: "idle" });
  const requestIdRef = useRef(0);
  const recommendation = enabled && pathSource.status === "success"
    && pathSource.data?.recommendation?.action === "RESUME"
    ? pathSource.data.recommendation
    : null;
  const passId = recommendation?.pass_id ?? null;
  const setId = recommendation?.set_id ?? null;
  const key = passId && setId ? `${passId}:${setId}` : null;
  useEffect(() => {
    if (!key) return undefined;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    learningPathService.readPass(passId).then((pass) => {
      if (requestIdRef.current !== requestId) return;
      const presentation = getCurrentLearningPresentation(pass);
      if (pass.id !== passId || pass.set_id !== setId || pass.state !== "ACTIVE" || !presentation.isValid) throw new TypeError("Current Learning pass does not match the recommendation.");
      setState({ data: pass, key, status: "success" });
    }).catch(() => {
      if (requestIdRef.current === requestId) setState({ data: null, key, status: "error" });
    });
    return () => { if (requestIdRef.current === requestId) requestIdRef.current += 1; };
  }, [key, passId, retryToken, setId]);
  const status = recommendation && state.key !== key ? "loading" : state.status;
  function retry() {
    if (!recommendation || status === "loading") return;
    setState((current) => ({ ...current, status: "loading" }));
    setRetryToken((value) => value + 1);
  }
  return { data: state.data, recommendation, retry, status };
}
