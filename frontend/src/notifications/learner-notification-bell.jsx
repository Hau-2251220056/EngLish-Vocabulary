import { Bell, BookOpen, Flame, Trophy, X } from "lucide-react";
import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { NOTIFICATION_PAGE_SIZE } from "./learner-notification-cache.js";
import "./learner-notifications.css";

const relativeTime = new Intl.RelativeTimeFormat("vi", { numeric: "auto" });
const wholeNumber = new Intl.NumberFormat("vi");
const visual = {
  STREAK_INTERRUPTED: {
    Icon: Flame, color: "peach", title: "Chuỗi học đã gián đoạn",
    message: () => "Mỗi lần quay lại đều đáng quý. Hãy học một chút hôm nay để bắt đầu chuỗi mới!",
  },
  STREAK_MILESTONE: {
    Icon: Trophy, color: "yellow", title: "Cột mốc chuỗi học",
    message: ({ days }) => `Bạn đã học ${days} ngày liên tiếp. Tuyệt vời, hãy giữ nhịp nhé!`,
  },
  VOCABULARY_MILESTONE: {
    Icon: BookOpen, color: "sky", title: "Cột mốc từ vựng",
    message: ({ started }) => `Bạn đã bắt đầu học ${wholeNumber.format(started)} từ vựng. Tiếp tục khám phá nhé!`,
  },
};

function formatRelativeTime(instant) {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(instant)) / 60_000));
  if (minutes === 0) return "Vừa xong";
  if (minutes < 60) return relativeTime.format(-minutes, "minute");
  if (minutes < 1440) return relativeTime.format(-Math.floor(minutes / 60), "hour");
  return relativeTime.format(-Math.floor(minutes / 1440), "day");
}

export function LearnerNotificationBell({ cache, open, onToggle, onClose }) {
  const state = useSyncExternalStore(cache.subscribe, cache.snapshot);
  const id = useId();
  const root = useRef(null);
  const trigger = useRef(null);
  const close = useRef(null);
  const list = useRef(null);
  const scrollTop = useRef(0);
  const restoreMoreFocus = useRef(false);
  const hasMore = Boolean(state.cursor);

  useEffect(() => { void cache.refresh(); }, [cache]);
  useEffect(() => {
    if (open) {
      if (list.current) list.current.scrollTop = scrollTop.current;
      close.current?.focus();
    }
  }, [open]);
  useEffect(() => {
    if (open && !hasMore && restoreMoreFocus.current) {
      restoreMoreFocus.current = false;
      list.current?.focus();
    }
  }, [open, hasMore]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event) {
      if (!root.current?.contains(event.target)) onClose();
    }
    function onKey(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const countLabel = state.count === null ? "Thông báo, chưa có dữ liệu số mục chưa đọc" : `Thông báo, ${state.count} chưa đọc`;
  return (
    <div ref={root} className="learner-notification-anchor">
      <button type="button" ref={trigger} className="learner-notification-bell" aria-label={countLabel}
        aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => {
          if (!open) void cache.refresh();
          onToggle();
        }}>
        <Bell size={21} aria-hidden="true" />
        {state.count > 0 && <span className="learner-notification-badge" aria-hidden="true">{state.count > 99 ? "99+" : state.count}</span>}
      </button>
      {open && (
        <section id={id} aria-labelledby={`${id}-title`} className="learner-notification-panel">
          <header className="learner-notification-panel-header">
            <div>
              <h2 id={`${id}-title`}>Thông báo</h2>
              <span className="learner-notification-meta">{state.count === null ? "Chưa rõ số mục chưa đọc" : `${state.count} chưa đọc`}</span>
            </div>
            <button type="button" className="learner-notification-action" disabled={state.count === null || state.count === 0 || state.readingAll}
              onClick={() => void cache.markAll()}>Đánh dấu tất cả đã đọc</button>
            <button ref={close} type="button" className="learner-notification-close" aria-label="Đóng thông báo" onClick={() => {
              onClose();
              trigger.current?.focus();
            }}><X size={19} aria-hidden="true" /></button>
          </header>
          <div ref={list} tabIndex={-1} className="learner-notification-list" onScroll={(event) => { scrollTop.current = event.currentTarget.scrollTop; }}>
            {!state.loaded && !state.refreshError && <div role="status" aria-label="Đang tải thông báo" className="learner-notification-skeleton">
              {Array.from({ length: NOTIFICATION_PAGE_SIZE }, (_, index) => <div key={index} />)}
            </div>}
            {!state.loaded && state.refreshError && <div className="learner-notification-empty">
              <p role="alert">Không thể tải thông báo.</p>
              <button type="button" className="learner-notification-action" onClick={() => void cache.refresh({ force: true })}>Thử lại</button>
            </div>}
            {state.loaded && state.items.length === 0 && <div className="learner-notification-empty">
              <Bell size={26} aria-hidden="true" />
              <strong>Chưa có thông báo.</strong>
              <p>Các thông báo mới sẽ xuất hiện tại đây.</p>
            </div>}
            {state.items.length > 0 && <ul>{state.items.map((item) => {
              const entry = visual[item.type];
              if (!entry) return null;
              const unread = item.read_at === null;
              const pending = state.reading.includes(item.id) || state.readingAll;
              const { Icon } = entry;
              return <li key={item.id}>
                <button type="button" className={`learner-notification-item${unread ? " is-unread" : ""}`}
                  aria-disabled={!unread || pending} onClick={() => { if (unread && !pending) void cache.markOne(item.id); }}>
                  <span className={`learner-notification-icon is-${entry.color}`}><Icon size={19} aria-hidden="true" /></span>
                  <span className="learner-notification-copy">
                    <span className="learner-notification-title">{entry.title}<span className="sr-only">, {unread ? "chưa đọc" : "đã đọc"}</span></span>
                    <span>{entry.message(item.payload)}</span>
                    <time dateTime={item.occurred_at}>{formatRelativeTime(item.occurred_at)}</time>
                  </span>
                  {unread && <span className="learner-notification-dot" aria-hidden="true" />}
                </button>
              </li>;
            })}</ul>}
          </div>
          {(hasMore || (state.loaded && state.refreshError) || state.moreError || state.readError) && <footer className="learner-notification-panel-footer">
            {state.loaded && state.refreshError && <div><span role="status">Không thể làm mới.</span>{" "}
              <button type="button" className="learner-notification-action" onClick={() => void cache.refresh({ force: true })}>Thử lại</button></div>}
            {state.moreError && <span role="status">Không thể tải thêm. Bạn có thể thử lại.</span>}
            {state.readError && <span role="status">Không thể đánh dấu đã đọc. Vui lòng thử lại.</span>}
            {hasMore && <button type="button" className="learner-notification-action" disabled={state.loadingMore || state.refreshing} onClick={() => {
              restoreMoreFocus.current = true;
              void cache.loadMore();
            }}>{state.loadingMore ? "Đang tải…" : "Xem thêm"}</button>}
          </footer>}
        </section>
      )}
    </div>
  );
}
