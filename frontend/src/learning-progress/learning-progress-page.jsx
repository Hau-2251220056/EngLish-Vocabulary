import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LoaderCircle,
  RefreshCw,
  Search,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { learningService } from "../services/learning-service.js";

const PAGE_SIZE = 20;
const STATUS_OPTIONS = [
  { value: "", label: "Tất cả" },
  { value: "LEARNING", label: "Đang học" },
  { value: "LEARNED", label: "Đã thuộc" },
  { value: "NEEDS_REVIEW", label: "Cần ôn" },
];
const STATUS_LABELS = Object.fromEntries(
  STATUS_OPTIONS.filter(({ value }) => value).map(({ value, label }) => [
    value,
    label,
  ]),
);
const FOCUS_CLASSES = "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#3b5bdb]/30";
const ACTION_BUTTON_CLASSES = `inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-[0.45rem] rounded-xl border-0 bg-[#3b5bdb] px-4 font-[inherit] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_CLASSES}`;
const SUMMARY_STYLES = {
  total: {
    card: "bg-[linear-gradient(135deg,#f7faff,#edf3ff)]",
    icon: "bg-[#dbe7ff] text-[#3b5bdb]",
    label: "text-[#304d9b]",
  },
  learning: {
    card: "bg-[linear-gradient(135deg,#fffaf0,#fff1d7)]",
    icon: "bg-[#ffdfa4] text-[#b66400]",
    label: "text-[#a85b00]",
  },
  learned: {
    card: "bg-[linear-gradient(135deg,#f0fff8,#dcf8ea)]",
    icon: "bg-[#baf0d0] text-[#087b43]",
    label: "text-[#08703f]",
  },
  review: {
    card: "bg-[linear-gradient(135deg,#fff7f8,#ffe5e9)]",
    icon: "bg-[#ffcbd2] text-[#c62035]",
    label: "text-[#ae2637]",
  },
};
const STATUS_BADGE_STYLES = {
  LEARNING: "bg-[#fff1d8] text-[#a85b00]",
  LEARNED: "bg-[#dcf8e9] text-[#08703f]",
  NEEDS_REVIEW: "bg-[#ffe1e5] text-[#ae2637]",
};

export function LearningProgressPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [retryToken, setRetryToken] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const requestIdRef = useRef(0);
  const paginationFocusRef = useRef(null);
  const previousPageButtonRef = useRef(null);
  const nextPageButtonRef = useRef(null);

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    learningService
      .getLearningProgress({
        page,
        page_size: PAGE_SIZE,
        ...(status ? { status } : {}),
      })
      .then((nextData) => {
        if (requestIdRef.current === requestId) setData(nextData);
      })
      .catch(() => {
        if (requestIdRef.current === requestId) {
          setError("Không thể tải tiến độ học tập. Vui lòng thử lại.");
        }
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setIsLoading(false);
      });

    return () => {
      if (requestIdRef.current === requestId) requestIdRef.current += 1;
    };
  }, [page, retryToken, status]);

  useEffect(() => {
    if (isLoading || !data || !paginationFocusRef.current) return;
    const requestedDirection = paginationFocusRef.current;
    const requestedButton =
      requestedDirection === "previous"
        ? previousPageButtonRef.current
        : nextPageButtonRef.current;
    const fallbackButton =
      requestedDirection === "previous"
        ? nextPageButtonRef.current
        : previousPageButtonRef.current;
    const focusTarget = requestedButton?.disabled
      ? fallbackButton
      : requestedButton;
    focusTarget?.focus();
    paginationFocusRef.current = null;
  }, [data, isLoading]);

  function handleStatusChange(event) {
    if (isLoading) return;
    beginRequest();
    setStatus(event.target.value);
    setPage(1);
  }

  function handlePageChange(nextPage, direction) {
    if (isLoading || nextPage === page) return;
    paginationFocusRef.current = direction;
    beginRequest();
    setPage(nextPage);
  }

  function clearFilter() {
    if (isLoading) return;
    beginRequest();
    setStatus("");
    setPage(1);
  }

  function retry() {
    if (isLoading) return;
    beginRequest();
    setRetryToken((value) => value + 1);
  }

  function beginRequest() {
    setIsLoading(true);
    setError(null);
  }

  const isInitialLoading = isLoading && data === null;

  return (
    <section
      className="learning-progress-page mx-auto min-w-0 w-full max-w-[1180px] p-[clamp(1.5rem,3vw,2.75rem)] text-[#172033] max-sm:px-[0.9rem] max-sm:pb-8 max-sm:pt-[1.2rem]"
      aria-labelledby="learning-progress-title"
      aria-busy={isLoading}
    >
      <header className="learning-progress-heading mb-6 max-sm:mb-[1.1rem]">
        <p className="learning-progress-eyebrow mb-[0.35rem] text-xs font-extrabold uppercase tracking-[0.09em] text-[#3b5bdb]">Hành trình của bạn</p>
        <h1 className="m-0 text-[clamp(1.8rem,3vw,2.35rem)] leading-[1.15] tracking-[-0.035em] text-[#101828]" id="learning-progress-title">Tiến độ học tập</h1>
        <p className="mb-0 mt-[0.55rem] max-w-[720px] leading-[1.6] text-[#526078] max-sm:text-[0.9rem]">
          Theo dõi các từ vựng bạn đã bắt đầu học cùng trạng thái học tập hiện
          tại.
        </p>
      </header>

      {isInitialLoading ? (
        <ProgressLoadingState />
      ) : error ? (
        <ProgressErrorState message={error} onRetry={retry} />
      ) : data ? (
        <ProgressContent
          data={data}
          status={status}
          isLoading={isLoading}
          onStatusChange={handleStatusChange}
          onPageChange={handlePageChange}
          onClearFilter={clearFilter}
          previousPageButtonRef={previousPageButtonRef}
          nextPageButtonRef={nextPageButtonRef}
        />
      ) : null}
    </section>
  );
}

function ProgressContent({
  data,
  status,
  isLoading,
  onStatusChange,
  onPageChange,
  onClearFilter,
  previousPageButtonRef,
  nextPageButtonRef,
}) {
  const { summary, items, pagination } = data;
  const isFirstUse = summary.total_started === 0;
  const isFilteredEmpty = !isFirstUse && items.length === 0 && Boolean(status);
  const isPageEmpty = !isFirstUse && items.length === 0 && !status;

  return (
    <>
      <SummaryCards summary={summary} />

      <section
        className="learning-progress-list-section min-w-0 rounded-[20px] border border-[#e5eaf2] bg-white p-[clamp(1rem,2.2vw,1.5rem)] shadow-[0_12px_36px_rgb(37_52_86/0.06)] max-sm:rounded-2xl max-sm:p-[0.9rem]"
        aria-labelledby="learning-progress-list-title"
      >
        <div className="learning-progress-list-heading mb-4 flex items-end justify-between gap-4 max-sm:flex-col max-sm:items-stretch">
          <div>
            <p className="learning-progress-section-kicker mb-[0.35rem] text-xs font-extrabold uppercase tracking-[0.09em] text-[#3b5bdb]">Tiến độ hiện tại</p>
            <h2 className="m-0 text-[1.35rem] tracking-[-0.02em] text-[#101828]" id="learning-progress-list-title">Từ vựng của bạn</h2>
          </div>
          {!isFirstUse ? (
            <label className="learning-progress-filter flex items-center gap-[0.65rem] text-[0.88rem] text-[#526078] max-sm:justify-between">
              <span>Trạng thái</span>
              <select
                className={`min-h-11 min-w-[150px] rounded-xl border border-[#d8dfeb] bg-white py-0 pl-[0.85rem] pr-[2.3rem] font-[inherit] font-bold text-[#172033] disabled:cursor-not-allowed disabled:opacity-50 max-sm:max-w-[190px] max-sm:flex-1 ${FOCUS_CLASSES}`}
                value={status}
                onChange={onStatusChange}
                disabled={isLoading}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value || "ALL"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className="learning-progress-results relative min-w-0" aria-live="polite">
          {isLoading ? (
            <p className="learning-progress-updating absolute right-[0.6rem] top-[0.6rem] z-[2] m-0 flex items-center gap-[0.4rem] rounded-full bg-[#eef3ff] px-[0.7rem] py-[0.45rem] text-[0.78rem] font-bold text-[#3451bd] shadow-[0_3px_12px_rgb(30_52_110/0.1)]" role="status">
              <LoaderCircle className="size-[15px] animate-spin motion-reduce:animate-none" aria-hidden="true" /> Đang cập nhật…
            </p>
          ) : null}
          {isFirstUse ? (
            <EmptyState
              icon={<BookOpen aria-hidden="true" />}
              title="Bạn chưa có tiến độ học tập"
              description="Khi bạn bắt đầu học từ vựng bằng Flashcard, tiến độ hiện tại sẽ xuất hiện tại đây."
            />
          ) : isFilteredEmpty ? (
            <EmptyState
              icon={<Search aria-hidden="true" />}
              title="Không có từ vựng phù hợp"
              description={`Hiện không có từ vựng ở trạng thái “${STATUS_LABELS[status]}”.`}
              action={
                <button className={ACTION_BUTTON_CLASSES} type="button" onClick={onClearFilter} disabled={isLoading}>
                  Xóa bộ lọc
                </button>
              }
            />
          ) : isPageEmpty ? (
            <EmptyState
              icon={<BookOpen aria-hidden="true" />}
              title="Trang này chưa có từ vựng"
              description="Hãy quay lại trang trước để tiếp tục xem tiến độ."
            />
          ) : (
            <ProgressList items={items} />
          )}
        </div>

        {!isFirstUse && pagination.total_pages > 0 ? (
          <Pagination
            pagination={pagination}
            disabled={isLoading}
            onPageChange={onPageChange}
            previousButtonRef={previousPageButtonRef}
            nextButtonRef={nextPageButtonRef}
          />
        ) : null}
      </section>
    </>
  );
}

function SummaryCards({ summary }) {
  const cards = [
    {
      key: "total",
      label: "Tổng đã bắt đầu",
      value: summary.total_started,
      icon: <BookOpen aria-hidden="true" />,
    },
    {
      key: "learning",
      label: "Đang học",
      value: summary.learning,
      icon: <RefreshCw aria-hidden="true" />,
    },
    {
      key: "learned",
      label: "Đã thuộc",
      value: summary.learned,
      icon: <Check aria-hidden="true" />,
    },
    {
      key: "review",
      label: "Cần ôn",
      value: summary.needs_review,
      icon: <Clock3 aria-hidden="true" />,
    },
  ];

  return (
    <section className="learning-progress-summary mb-[1.8rem] grid grid-cols-4 gap-4 max-[1020px]:grid-cols-2 max-sm:mb-[1.2rem] max-sm:gap-[0.65rem] max-[390px]:grid-cols-1" aria-label="Tóm tắt tiến độ">
      {cards.map((card) => {
        const styles = SUMMARY_STYLES[card.key];
        return (
        <article
          className={`learning-progress-summary-card is-${card.key} flex min-h-[116px] min-w-0 items-center gap-[0.9rem] rounded-[18px] border border-white/85 p-[1.15rem] shadow-[0_10px_30px_rgb(51_78_140/0.07)] max-sm:min-h-24 max-sm:gap-[0.65rem] max-sm:rounded-[15px] max-sm:p-[0.85rem] max-[390px]:min-h-[82px] ${styles.card}`}
          key={card.key}
        >
          <span className={`learning-progress-summary-icon grid size-12 shrink-0 place-items-center rounded-full max-sm:size-10 [&_svg]:size-6 [&_svg]:[stroke-width:2.2] max-sm:[&_svg]:size-[21px] ${styles.icon}`}>{card.icon}</span>
          <div>
            <p className={`mb-[0.15rem] mt-0 text-[0.85rem] font-extrabold max-sm:text-[0.72rem] ${styles.label}`}>{card.label}</p>
            <strong className="block text-[1.9rem] leading-[1.05] text-[#101828] max-sm:text-[1.45rem]">{card.value}</strong>
            <span className="text-[0.8rem] text-[#526078] max-sm:text-[0.7rem]">từ vựng</span>
          </div>
        </article>
        );
      })}
    </section>
  );
}

function ProgressList({ items }) {
  return (
    <ul className="learning-progress-list m-0 list-none divide-y divide-[#edf0f5] overflow-hidden rounded-2xl border border-[#e5eaf2] p-0" aria-label="Danh sách tiến độ từ vựng">
      {items.map((item) => (
        <li className="learning-progress-row grid min-w-0 grid-cols-[minmax(150px,1.3fr)_minmax(90px,0.65fr)_minmax(135px,0.85fr)_minmax(150px,0.9fr)] items-center gap-4 bg-white px-4 py-[0.9rem] max-[1020px]:grid-cols-[minmax(140px,1.2fr)_minmax(90px,0.7fr)_minmax(130px,0.9fr)] max-[1020px]:[&_.learning-progress-row-detail:last-child]:col-start-3 max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-x-[0.8rem] max-sm:gap-y-[0.65rem] max-sm:p-[0.9rem] max-sm:[&_.learning-progress-row-detail:last-child]:col-auto max-[390px]:[&_.learning-progress-row-detail]:col-span-full" key={item.vocabulary.id}>
          <div className="learning-progress-word min-w-0">
            <strong className="block text-base text-[#101828] [overflow-wrap:anywhere]">{item.vocabulary.word}</strong>
            {item.vocabulary.phonetic ? <span className="mt-[0.15rem] block text-[0.85rem] text-[#667085] [overflow-wrap:anywhere]">{item.vocabulary.phonetic}</span> : null}
          </div>
          <span className={`learning-progress-badge is-${item.status.toLowerCase()} justify-self-start whitespace-nowrap rounded-full px-[0.7rem] py-[0.35rem] text-xs font-extrabold max-sm:self-start ${STATUS_BADGE_STYLES[item.status]}`}>
            {STATUS_LABELS[item.status]}
          </span>
          <div className="learning-progress-row-detail flex min-w-0 items-center gap-2 text-[0.82rem] text-[#4c5d78] max-sm:text-[0.76rem] [&_svg]:size-[18px] [&_svg]:shrink-0 [&_svg]:text-[#49649f] [&_span]:min-w-0">
            <RefreshCw aria-hidden="true" />
            <span>Đã ôn {item.review_count} lần</span>
          </div>
          <div className="learning-progress-row-detail flex min-w-0 items-center gap-2 text-[0.82rem] text-[#4c5d78] max-sm:text-[0.76rem] [&_svg]:size-[18px] [&_svg]:shrink-0 [&_svg]:text-[#49649f] [&_span]:min-w-0">
            <Clock3 aria-hidden="true" />
            <span>
              <small className="block text-[0.7rem] text-[#7a869b]">Học gần nhất</small>
              {formatReviewedAt(item.last_reviewed_at)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Pagination({
  pagination,
  disabled,
  onPageChange,
  previousButtonRef,
  nextButtonRef,
}) {
  const firstItem = (pagination.page - 1) * pagination.page_size + 1;
  const lastItem = Math.min(
    pagination.page * pagination.page_size,
    pagination.total_items,
  );

  return (
    <div className="learning-progress-pagination-row mt-[1.15rem] flex items-center justify-between gap-4 max-sm:flex-col">
      <nav className="learning-progress-pagination flex items-center gap-[0.65rem]" aria-label="Phân trang tiến độ">
        <button
          className={`inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl border-0 bg-[#edf2ff] text-[#3451bd] disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-5 ${FOCUS_CLASSES}`}
          ref={previousButtonRef}
          type="button"
          aria-label="Trang trước"
          disabled={disabled || pagination.page <= 1}
          onClick={() => onPageChange(pagination.page - 1, "previous")}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <span className="text-[0.85rem] font-[750] text-[#344054]" aria-current="page">
          Trang {pagination.page} / {pagination.total_pages}
        </span>
        <button
          className={`inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl border-0 bg-[#edf2ff] text-[#3451bd] disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-5 ${FOCUS_CLASSES}`}
          ref={nextButtonRef}
          type="button"
          aria-label="Trang sau"
          disabled={disabled || pagination.page >= pagination.total_pages}
          onClick={() => onPageChange(pagination.page + 1, "next")}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </nav>
      <p className="m-0 text-[0.8rem] text-[#667085] max-sm:order-first max-sm:text-center">
        Hiển thị {firstItem}–{lastItem} trong {pagination.total_items} từ
      </p>
    </div>
  );
}

function ProgressLoadingState() {
  return (
    <div className="learning-progress-loading" role="status" aria-live="polite">
      <span className="sr-only">Đang tải tiến độ học tập…</span>
      <div className="learning-progress-loading-cards grid grid-cols-4 gap-4 max-[1020px]:grid-cols-2 max-sm:gap-[0.65rem]" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <span className="h-[116px] animate-pulse rounded-[18px] bg-[#eaf0fa] motion-reduce:animate-none max-sm:h-24" key={index} />
        ))}
      </div>
      <div className="learning-progress-loading-list mt-[1.8rem] rounded-[20px] border border-[#e5eaf2] bg-white p-6 [&_span]:block [&_span]:h-[58px] [&_span]:animate-pulse [&_span]:rounded-xl [&_span]:bg-[#edf1f7] motion-reduce:[&_span]:animate-none [&_span+span]:mt-[0.65rem]" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function ProgressErrorState({ message, onRetry }) {
  return (
    <div className="learning-progress-state is-error flex min-h-[420px] flex-col items-center justify-center rounded-[20px] border border-[#f5d7dc] bg-white px-4 py-8 text-center max-sm:min-h-[260px]" role="alert">
      <span className="learning-progress-state-icon mb-4 grid size-16 place-items-center rounded-[20px] bg-[#ffe4e8] text-[#c62035] [&_svg]:size-[31px]">
        <AlertTriangle aria-hidden="true" />
      </span>
      <h2 className="m-0 text-[1.1rem] text-[#172033]">Không thể tải tiến độ học tập</h2>
      <p className="mb-4 mt-[0.45rem] max-w-[440px] leading-[1.55] text-[#667085]">{message}</p>
      <button className={ACTION_BUTTON_CLASSES} type="button" onClick={onRetry}>
        <RefreshCw aria-hidden="true" /> Thử lại
      </button>
    </div>
  );
}

function EmptyState({ icon, title, description, action = null }) {
  return (
    <div className="learning-progress-state flex min-h-[290px] flex-col items-center justify-center px-4 py-8 text-center max-sm:min-h-[260px]">
      <span className="learning-progress-state-icon mb-4 grid size-16 place-items-center rounded-[20px] bg-[#e7efff] text-[#3b5bdb] [&_svg]:size-[31px]">{icon}</span>
      <h3 className="m-0 text-[1.1rem] text-[#172033]">{title}</h3>
      <p className="mb-4 mt-[0.45rem] max-w-[440px] leading-[1.55] text-[#667085]">{description}</p>
      {action}
    </div>
  );
}

function formatReviewedAt(value) {
  if (!value) return "Chưa có";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa có";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
