import { ArrowLeft, ArrowRight, BookOpen, Bookmark, LoaderCircle, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuthentication } from "../auth/use-authentication.js";
import { VocabularySetApiError, vocabularySetService } from "../services/vocabulary-set-service.js";
import { SetLearningActions, SetVocabularyPreviewTable } from "./set-detail-primitives.jsx";

export function PublicVocabularySetDiscoveryPage() {
  const { topicId } = useParams();
  return <PublicVocabularySetDiscoveryContent key={topicId} topicId={topicId} />;
}

function PublicVocabularySetDiscoveryContent({ topicId }) {
  const [sets, setSets] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("loading");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let current = true;
    vocabularySetService.listPublicSystemSets(topicId).then(
      (data) => {
        if (!current) return;
        setSets(data);
        setStatus("success");
      },
      (error) => {
        if (current) setStatus(isTopicNotFound(error) ? "not-found" : "error");
      },
    );
    return () => { current = false; };
  }, [reloadToken, topicId]);

  const visibleSets = useMemo(() => filterSets(sets, query), [query, sets]);

  function retry() {
    setStatus("loading");
    setReloadToken((value) => value + 1);
  }

  return (
    <section className="public-topic-content" aria-labelledby="vocabulary-set-discovery-title">
      <Link className="public-topic-back-link" to={`/topics/${topicId}`}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        Chi tiết chủ đề
      </Link>
      <div className="public-topic-intro">
        <p className="public-topic-eyebrow">Bộ từ hệ thống</p>
        <h1 id="vocabulary-set-discovery-title">Bộ từ theo chủ đề</h1>
        <p>Khám phá các bộ từ công khai được biên soạn cho chủ đề này.</p>
      </div>

      {status === "success" && sets.length > 0 ? (
        <div className="public-topic-search">
          <label htmlFor="vocabulary-set-search">Tìm kiếm bộ từ</label>
          <div className="public-topic-search-control">
            <Search className="size-5" aria-hidden="true" />
            <input id="vocabulary-set-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nhập tên hoặc mô tả bộ từ" autoComplete="off" />
          </div>
          <p className="public-topic-result-count" aria-live="polite">{visibleSets.length} bộ từ phù hợp</p>
        </div>
      ) : null}

      {status === "loading" ? <PublicState status message="Đang tải bộ từ…" /> : null}
      {status === "not-found" ? <PublicState role="alert" title="Không tìm thấy chủ đề" message="Chủ đề này không tồn tại hoặc không còn khả dụng." action={<Link to="/topics">Quay lại danh sách chủ đề</Link>} /> : null}
      {status === "error" ? <PublicState role="alert" title="Không thể tải bộ từ" message="Vui lòng kiểm tra kết nối và thử lại." action={<button type="button" onClick={retry}>Thử lại</button>} /> : null}
      {status === "success" && sets.length === 0 ? <PublicState title="Chưa có bộ từ" message="Chủ đề này hiện chưa có bộ từ hệ thống công khai." /> : null}
      {status === "success" && sets.length > 0 && visibleSets.length === 0 ? <PublicState title="Không tìm thấy bộ từ phù hợp" message="Hãy thử một từ khóa khác." /> : null}
      {status === "success" && visibleSets.length > 0 ? (
        <ul className="public-topic-grid" aria-label="Danh sách bộ từ hệ thống">
          {visibleSets.map((set) => (
            <li key={set.id}>
              <article className="public-topic-card public-vocabulary-set-card">
                <p className="public-vocabulary-set-card-label">Bộ từ hệ thống</p>
                <h2>{set.name}</h2>
                <p>{set.description || "Chưa có mô tả cho bộ từ này."}</p>
                <span className="public-vocabulary-set-count">{set.item_count} từ vựng</span>
                <Link to={`/vocabulary-sets/${set.id}`}>Xem bộ từ <ArrowRight className="size-4" aria-hidden="true" /></Link>
              </article>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function PublicVocabularySetDetailPage() {
  const { setId } = useParams();
  return <PublicVocabularySetDetailContent key={setId} setId={setId} />;
}

function PublicVocabularySetDetailContent({ setId }) {
  const { isAuthenticated, user } = useAuthentication();
  const navigate = useNavigate();
  const [set, setSet] = useState(null);
  const [status, setStatus] = useState("loading");
  const [reloadToken, setReloadToken] = useState(0);
  const [copyState, setCopyState] = useState("idle");
  const [copyError, setCopyError] = useState(null);

  useEffect(() => {
    let current = true;
    vocabularySetService.getPublicSystemSet(setId).then(
      (data) => {
        if (!current) return;
        setSet(data);
        setStatus("success");
      },
      (error) => {
        if (current) setStatus(isSetNotFound(error) ? "not-found" : "error");
      },
    );
    return () => { current = false; };
  }, [reloadToken, setId]);

  const items = useMemo(() => (set?.items ? [...set.items].sort((left, right) => left.position - right.position) : []), [set]);

  function retry() {
    setStatus("loading");
    setReloadToken((value) => value + 1);
  }

  async function copySet() {
    if (copyState === "pending" || !set) return;
    setCopyState("pending");
    setCopyError(null);
    try {
      const copied = await vocabularySetService.copySystemSet(set.id);
      navigate(`/my/vocabulary-sets/${copied.id}`);
    } catch {
      setCopyError("Không thể sao chép bộ từ. Vui lòng thử lại.");
      setCopyState("idle");
    }
  }

  return (
    <section className="set-detail-page mx-auto w-full max-w-[76rem] p-[clamp(1rem,3vw,2.5rem)] text-[var(--text-primary)] max-[480px]:p-4" aria-label="Chi tiết bộ từ hệ thống">
      <Link className="set-detail-back inline-flex min-h-11 items-center gap-[0.45rem] font-semibold text-[#5b6478] no-underline transition-[color,transform] duration-150 hover:-translate-x-0.5 hover:text-[var(--accent-primary-hover)] focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] motion-reduce:transform-none motion-reduce:transition-none [&_svg]:w-[1.1rem]" to={set ? `/topics/${set.topic_id}/vocabulary-sets` : "/topics"}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        {set ? "Các bộ từ cùng chủ đề" : "Khám phá bộ từ"}
      </Link>
      {status === "loading" ? <PublicState status message="Đang tải bộ từ…" /> : null}
      {status === "not-found" ? <PublicState role="alert" title="Không tìm thấy bộ từ" message="Bộ từ này không tồn tại hoặc không còn công khai." action={<Link to="/topics">Quay lại danh sách chủ đề</Link>} /> : null}
      {status === "error" ? <PublicState role="alert" title="Không thể tải bộ từ" message="Vui lòng kiểm tra kết nối và thử lại." action={<button type="button" onClick={retry}>Thử lại</button>} /> : null}
      {status === "success" && set ? (
        <article className="public-vocabulary-set-detail">
          <p className="public-topic-eyebrow !text-slate-500">Bộ từ hệ thống</p>
          <header className="set-detail-header mt-[0.15rem] flex items-start justify-between gap-6 max-[800px]:flex-col max-[800px]:items-stretch">
            <div className="min-w-0">
              <h1 className="m-0 [overflow-wrap:anywhere] text-[clamp(1.75rem,2.8vw,2.05rem)] font-semibold tracking-[-0.035em] max-[700px]:text-[1.7rem]" id="vocabulary-set-detail-title">{set.name}</h1>
              <p className="mb-0 mt-2 max-w-[42rem] text-sm leading-6 text-slate-500">{set.description || "Chưa có mô tả cho bộ từ này."}</p>
              <Link className="mt-2 inline-flex text-sm font-semibold text-[var(--accent-primary)] no-underline focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)]" to={`/topics/${set.topic_id}/vocabulary-sets`}>Xem các bộ từ cùng chủ đề</Link>
            </div>
            {!isAuthenticated ? <Link className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-[0.7rem] border border-[var(--accent-primary)] bg-white px-3 py-[0.55rem] text-sm font-semibold text-[var(--accent-primary)] no-underline hover:bg-[var(--accent-primary-soft)] focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] max-[800px]:min-h-11 max-[800px]:w-full" to="/login">Đăng nhập để học và lưu</Link> : null}
            {user?.role === "USER" ? <button type="button" className="inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[0.7rem] border border-slate-300 bg-white px-3 py-[0.55rem] text-sm font-semibold text-slate-700 hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary-soft)] hover:text-[var(--accent-primary)] focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] disabled:cursor-not-allowed disabled:opacity-[0.58] max-[800px]:min-h-11 max-[800px]:w-full" onClick={() => void copySet()} disabled={copyState === "pending"} aria-busy={copyState === "pending"}><Bookmark className="size-4" aria-hidden="true" />{copyState === "pending" ? "Đang lưu…" : "Lưu vào Bộ từ của tôi"}</button> : null}
          </header>
          {copyError ? <p className="mb-0 mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{copyError}</p> : null}

          {user?.role === "USER" ? <SetLearningActions enabled={items.length > 0} returnTo={`/vocabulary-sets/${set.id}`} setId={set.id} setName={set.name} /> : null}

          <section className="set-detail-vocabulary mt-[1.65rem]" aria-labelledby="vocabulary-set-items-title">
            <div className="set-detail-section-heading flex items-center justify-between gap-4"><h2 className="m-0 text-[clamp(1.125rem,1.6vw,1.25rem)] font-semibold" id="vocabulary-set-items-title">Từ vựng trong bộ ({items.length})</h2></div>
            {items.length > 0 ? <SetVocabularyPreviewTable items={items} /> : <div className="set-detail-empty mt-4 grid justify-items-center gap-[0.65rem] rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-[clamp(2rem,6vw,4rem)] text-center text-slate-500 [&_h3]:m-0 [&_p]:m-0 [&>svg]:size-8 [&>svg]:text-[var(--accent-primary)]"><BookOpen aria-hidden="true" /><h3>Bộ từ chưa có từ vựng</h3><p>Hiện chưa có nội dung để học với Flashcard và Quiz.</p></div>}
          </section>
        </article>
      ) : null}
    </section>
  );
}

function PublicState({ action, message, role, status, title }) {
  return <div className="public-topic-state" role={status ? "status" : role} aria-live={status ? "polite" : undefined}>{status ? <LoaderCircle className="size-6 animate-spin" aria-hidden="true" /> : null}{title ? <h1>{title}</h1> : null}<p>{message}</p>{action}</div>;
}

function filterSets(sets, query) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return sets;
  return sets.filter((set) => [set.name, set.description].filter((value) => typeof value === "string").some((value) => value.toLocaleLowerCase().includes(normalizedQuery)));
}

function isTopicNotFound(error) {
  return error instanceof VocabularySetApiError && error.code === "TOPIC_NOT_FOUND";
}

function isSetNotFound(error) {
  return error instanceof VocabularySetApiError && error.kind === "not-found";
}
