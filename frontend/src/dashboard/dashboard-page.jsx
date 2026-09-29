import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  FolderOpen,
  LibraryBig,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import dashboardLearningIllustration from "../assets/images/banner.png";
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

function DashboardIntroduction({ displayName }) {
  const greeting = getDashboardGreeting();

  return (
    <header className="dashboard-introduction dashboard-hero">
      <div className="dashboard-hero-copy">
        <h1 id="dashboard-title">{greeting}, {displayName} <span aria-hidden="true">👋</span></h1>
        <p>Sẵn sàng học thêm vài từ hôm nay chưa?</p>
      </div>
      <div className="dashboard-hero-visual" aria-hidden="true">
        <span className="dashboard-hero-bubble is-one" />
        <span className="dashboard-hero-bubble is-two" />
        <span className="dashboard-hero-bubble is-three" />
        <span className="dashboard-hero-bubble is-four" />
        <span className="dashboard-hero-bubble is-five" />
        <span className="dashboard-hero-bubble is-six" />
        <span className="dashboard-hero-bubble is-seven" />
        <span className="dashboard-hero-bubble is-eight" />
        <span className="dashboard-hero-dots" />
        <img alt="" src={dashboardLearningIllustration} />
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
            <div className="dashboard-progress-copy">
              <dt>{label}</dt>
              <dd>{value} <span>từ vựng</span></dd>
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
      <p className="dashboard-set-total">{sets.length > 0 ? <>Bạn đang có <strong>{sets.length}</strong> bộ từ riêng.</> : "Không gian học của riêng bạn đang chờ bộ từ đầu tiên."}</p>
      {preview.length === 0 ? (
        <div className="dashboard-empty-note dashboard-sets-empty" role="status">
          <span className="dashboard-empty-icon" aria-hidden="true"><FolderOpen /></span>
          <div className="dashboard-empty-copy">
            <h3>Bạn chưa có bộ từ riêng</h3>
            <p>Tự tạo một bộ từ theo mục tiêu của bạn, hoặc khám phá nội dung có sẵn để bắt đầu học.</p>
            <div className="dashboard-empty-actions">
              <Link className="dashboard-primary-link" to="/my/vocabulary-sets"><Plus aria-hidden="true" /> Tạo bộ từ</Link>
              <Link className="dashboard-secondary-link" to="/topics">Khám phá bộ từ <ArrowRight aria-hidden="true" /></Link>
            </div>
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
                  <span className="dashboard-set-count"><BookOpenCheck aria-hidden="true" /> {set.item_count} từ vựng</span>
                </div>
                <div className="dashboard-set-actions">
                  <Link className="dashboard-secondary-link" to={`/my/vocabulary-sets/${set.id}`}>
                    Xem chi tiết
                  </Link>
                  {set.item_count > 0 ? (
                    <Link
                      className="dashboard-primary-link"
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
