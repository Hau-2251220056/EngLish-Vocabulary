import {
  Activity,
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  FolderOpen,
  LibraryBig,
  Map,
  RefreshCw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthentication } from "../auth/use-authentication.js";
import { learningService } from "../services/learning-service.js";
import { vocabularySetService } from "../services/vocabulary-set-service.js";
import { getDashboardGreeting } from "./dashboard-greeting.js";
import "./dashboard-page.css";

const DASHBOARD_SET_PREVIEW_LIMIT = 3;
const loadProgress = () =>
  learningService.getLearningProgress({ page: 1, page_size: 1 });
const loadMySets = () => vocabularySetService.listMySets();

export function DashboardPage() {
  const { user } = useAuthentication();
  const isUser = user.role === "USER";
  const progress = useDashboardSource(isUser, loadProgress);
  const mySets = useDashboardSource(isUser, loadMySets);

  if (!isUser) return <DashboardAdminLanding displayName={user.display_name} />;

  return (
    <section aria-labelledby="dashboard-title" className="dashboard-page">
      <DashboardIntroduction displayName={user.display_name} />

      <DashboardSection
        action={<Link to="/my/learning-progress">Xem tiến độ chi tiết</Link>}
        errorMessage="Không thể tải tóm tắt học tập. Vui lòng thử lại."
        loadingMessage="Đang tải tóm tắt học tập…"
        source={progress}
        title="Tiến độ học tập"
        type="progress"
      >
        {(data) => <ProgressSummary summary={data.summary} />}
      </DashboardSection>

      <DashboardSection
        action={<Link to="/my/vocabulary-sets">Xem tất cả</Link>}
        errorMessage="Không thể tải bộ từ riêng. Vui lòng thử lại."
        loadingMessage="Đang tải bộ từ riêng…"
        source={mySets}
        title="Bộ từ riêng của bạn"
        type="sets"
      >
        {(sets) => <MySetsSummary sets={sets} />}
      </DashboardSection>

      <DashboardQuickLinks />
    </section>
  );
}

function DashboardIntroduction({ displayName }) {
  const greeting = getDashboardGreeting();

  return (
    <header className="dashboard-introduction">
      <p className="dashboard-eyebrow">Dashboard</p>
      <h1 id="dashboard-title">{greeting}, {displayName}.</h1>
      <p>Tổng quan ngắn về hành trình học từ vựng hiện tại của bạn.</p>
    </header>
  );
}

function DashboardAdminLanding({ displayName }) {
  return (
    <section aria-labelledby="dashboard-title" className="dashboard-page dashboard-admin-page">
      <header className="dashboard-introduction">
        <p className="dashboard-eyebrow">Dashboard</p>
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
      className={`dashboard-section dashboard-${type}-section`}
    >
      <div className="dashboard-section-heading">
        <h2 id={titleId} ref={headingRef} tabIndex={-1}>{title}</h2>
        {action}
      </div>

      {source.status === "loading" ? (
        <DashboardLoadingState message={loadingMessage} type={type} />
      ) : null}

      {source.status === "error" ? (
        <div className="dashboard-state dashboard-error-state" role="alert">
          <span aria-hidden="true"><AlertTriangle /></span>
          <div>
            <h3>Đã có lỗi xảy ra</h3>
            <p>{errorMessage}</p>
            <button ref={retryButtonRef} type="button" onClick={retry}>
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
      <div aria-hidden="true">
        {Array.from({ length: count }, (_, index) => <span key={index} />)}
      </div>
    </div>
  );
}

function ProgressSummary({ summary }) {
  const values = [
    { key: "total", label: "Tổng đã bắt đầu", value: summary.total_started, icon: BookOpenCheck },
    { key: "learning", label: "Đang học", value: summary.learning, icon: RefreshCw },
    { key: "learned", label: "Đã thuộc", value: summary.learned, icon: CheckCircle2 },
  ];
  return (
    <>
      <dl className="dashboard-progress-grid" aria-label="Tóm tắt tiến độ" role="group">
        {values.map(({ icon: Icon, key, label, value }) => (
          <div className={`dashboard-progress-card is-${key}`} key={key}>
            <span className="dashboard-progress-icon" aria-hidden="true"><Icon /></span>
            <div>
              <dt>{label}</dt>
              <dd>{value}</dd>
              <span>từ vựng</span>
            </div>
          </div>
        ))}
      </dl>
      {summary.total_started === 0 ? (
        <div className="dashboard-empty-note" role="status">
          <BookOpenCheck aria-hidden="true" />
          <div>
            <h3>Bạn chưa bắt đầu học từ vựng nào</h3>
            <p>Hãy khám phá chủ đề hoặc bộ từ của bạn để bắt đầu.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}

function MySetsSummary({ sets }) {
  const preview = sets.slice(0, DASHBOARD_SET_PREVIEW_LIMIT);
  return (
    <div className="dashboard-sets-content">
      <p className="dashboard-set-total">Bạn có <strong>{sets.length}</strong> bộ từ riêng.</p>
      {preview.length === 0 ? (
        <div className="dashboard-empty-note" role="status">
          <FolderOpen aria-hidden="true" />
          <div>
            <h3>Bạn chưa có bộ từ riêng</h3>
            <p>Các bộ từ bạn tạo hoặc sao chép sẽ xuất hiện tại đây.</p>
          </div>
        </div>
      ) : (
        <ul className="dashboard-set-grid" aria-label="Bộ từ riêng xem trước">
          {preview.map((set) => (
            <li key={set.id}>
              <article className="dashboard-set-card">
                <div className="dashboard-set-card-content">
                  <span className="dashboard-set-icon" aria-hidden="true"><LibraryBig /></span>
                  <h3>{set.name}</h3>
                  {set.description ? <p>{set.description}</p> : <p className="is-muted">Chưa có mô tả.</p>}
                  <span className="dashboard-set-count">{set.item_count} từ vựng</span>
                </div>
                <div className="dashboard-set-actions">
                  <Link className="dashboard-secondary-link" to={`/my/vocabulary-sets/${set.id}`}>
                    Xem bộ từ
                  </Link>
                  {set.item_count > 0 ? (
                    <Link
                      className="dashboard-primary-link"
                      to={`/learn/vocabulary-sets/${set.id}`}
                      state={{ returnTo: "/dashboard" }}
                    >
                      Học bộ từ
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

function DashboardQuickLinks() {
  const links = [
    { to: "/topics", title: "Khám phá chủ đề", description: "Tìm các bộ từ hệ thống theo chủ đề.", icon: Map },
    { to: "/my/vocabulary-sets", title: "Bộ từ của tôi", description: "Tạo và quản lý các bộ từ riêng.", icon: LibraryBig },
    { to: "/my/learning-progress", title: "Tiến độ chi tiết", description: "Xem trạng thái từng từ đã bắt đầu học.", icon: Activity },
  ];
  return (
    <section className="dashboard-section dashboard-quick-section" aria-labelledby="dashboard-quick-title">
      <div className="dashboard-section-heading">
        <h2 id="dashboard-quick-title">Khám phá và quản lý</h2>
      </div>
      <nav aria-label="Lối tắt Dashboard">
        <ul className="dashboard-quick-grid">
          {links.map(({ description, icon: Icon, title, to }) => (
            <li key={to}>
              <Link to={to}>
                <span aria-hidden="true"><Icon /></span>
                <div><strong>{title}</strong><small>{description}</small></div>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}

function useDashboardSource(enabled, loader) {
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

  return { ...state, key: loader === loadProgress ? "progress" : "sets", retry };
}
