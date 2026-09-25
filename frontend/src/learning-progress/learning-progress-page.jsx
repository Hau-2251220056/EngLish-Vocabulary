import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { learningService } from "../services/learning-service.js";
import "./learning-progress-page.css";

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
      className="learning-progress-page"
      aria-labelledby="learning-progress-title"
      aria-busy={isLoading}
    >
      <header className="learning-progress-heading">
        <p className="learning-progress-eyebrow">Hành trình của bạn</p>
        <h1 id="learning-progress-title">Tiến độ học tập</h1>
        <p>
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
        className="learning-progress-list-section"
        aria-labelledby="learning-progress-list-title"
      >
        <div className="learning-progress-list-heading">
          <div>
            <p className="learning-progress-section-kicker">Tiến độ hiện tại</p>
            <h2 id="learning-progress-list-title">Từ vựng của bạn</h2>
          </div>
          {!isFirstUse ? (
            <label className="learning-progress-filter">
              <span>Trạng thái</span>
              <select
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

        <div className="learning-progress-results" aria-live="polite">
          {isLoading ? (
            <p className="learning-progress-updating" role="status">
              <LoaderCircle aria-hidden="true" /> Đang cập nhật…
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
              icon={<SearchRing />}
              title="Không có từ vựng phù hợp"
              description={`Hiện không có từ vựng ở trạng thái “${STATUS_LABELS[status]}”.`}
              action={
                <button type="button" onClick={onClearFilter} disabled={isLoading}>
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
    <section className="learning-progress-summary" aria-label="Tóm tắt tiến độ">
      {cards.map((card) => (
        <article
          className={`learning-progress-summary-card is-${card.key}`}
          key={card.key}
        >
          <span className="learning-progress-summary-icon">{card.icon}</span>
          <div>
            <p>{card.label}</p>
            <strong>{card.value}</strong>
            <span>từ vựng</span>
          </div>
        </article>
      ))}
    </section>
  );
}

function ProgressList({ items }) {
  return (
    <ul className="learning-progress-list" aria-label="Danh sách tiến độ từ vựng">
      {items.map((item) => (
        <li className="learning-progress-row" key={item.vocabulary.id}>
          <div className="learning-progress-word">
            <strong>{item.vocabulary.word}</strong>
            {item.vocabulary.phonetic ? <span>{item.vocabulary.phonetic}</span> : null}
          </div>
          <span className={`learning-progress-badge is-${item.status.toLowerCase()}`}>
            {STATUS_LABELS[item.status]}
          </span>
          <div className="learning-progress-row-detail">
            <RefreshCw aria-hidden="true" />
            <span>Đã ôn {item.review_count} lần</span>
          </div>
          <div className="learning-progress-row-detail">
            <Clock3 aria-hidden="true" />
            <span>
              <small>Học gần nhất</small>
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
    <div className="learning-progress-pagination-row">
      <nav className="learning-progress-pagination" aria-label="Phân trang tiến độ">
        <button
          ref={previousButtonRef}
          type="button"
          aria-label="Trang trước"
          disabled={disabled || pagination.page <= 1}
          onClick={() => onPageChange(pagination.page - 1, "previous")}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <span aria-current="page">
          Trang {pagination.page} / {pagination.total_pages}
        </span>
        <button
          ref={nextButtonRef}
          type="button"
          aria-label="Trang sau"
          disabled={disabled || pagination.page >= pagination.total_pages}
          onClick={() => onPageChange(pagination.page + 1, "next")}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </nav>
      <p>
        Hiển thị {firstItem}–{lastItem} trong {pagination.total_items} từ
      </p>
    </div>
  );
}

function ProgressLoadingState() {
  return (
    <div className="learning-progress-loading" role="status" aria-live="polite">
      <span className="sr-only">Đang tải tiến độ học tập…</span>
      <div className="learning-progress-loading-cards" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
      <div className="learning-progress-loading-list" aria-hidden="true">
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
    <div className="learning-progress-state is-error" role="alert">
      <span className="learning-progress-state-icon">
        <AlertTriangle aria-hidden="true" />
      </span>
      <h2>Không thể tải tiến độ học tập</h2>
      <p>{message}</p>
      <button type="button" onClick={onRetry}>
        <RefreshCw aria-hidden="true" /> Thử lại
      </button>
    </div>
  );
}

function EmptyState({ icon, title, description, action = null }) {
  return (
    <div className="learning-progress-state">
      <span className="learning-progress-state-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

function SearchRing() {
  return <span className="learning-progress-search-ring" aria-hidden="true" />;
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
