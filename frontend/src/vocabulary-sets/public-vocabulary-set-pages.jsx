import { ArrowLeft, ArrowRight, BookOpen, LoaderCircle, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuthentication } from "../auth/use-authentication.js";
import { VocabularySetApiError, vocabularySetService } from "../services/vocabulary-set-service.js";

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
    <section className="public-topic-content" aria-label="Chi tiết bộ từ hệ thống">
      <Link className="public-topic-back-link" to={set ? `/topics/${set.topic_id}/vocabulary-sets` : "/topics"}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        {set ? "Các bộ từ cùng chủ đề" : "Tất cả chủ đề"}
      </Link>
      {status === "loading" ? <PublicState status message="Đang tải bộ từ…" /> : null}
      {status === "not-found" ? <PublicState role="alert" title="Không tìm thấy bộ từ" message="Bộ từ này không tồn tại hoặc không còn công khai." action={<Link to="/topics">Quay lại danh sách chủ đề</Link>} /> : null}
      {status === "error" ? <PublicState role="alert" title="Không thể tải bộ từ" message="Vui lòng kiểm tra kết nối và thử lại." action={<button type="button" onClick={retry}>Thử lại</button>} /> : null}
      {status === "success" && set ? (
        <article className="public-topic-detail-card public-vocabulary-set-detail-card">
          <p className="public-topic-eyebrow">Bộ từ hệ thống</p>
          <h1 id="vocabulary-set-detail-title">{set.name}</h1>
          <p className="public-topic-detail-description">{set.description || "Chưa có mô tả cho bộ từ này."}</p>
          <dl className="public-topic-metadata">
            <div><dt><BookOpen className="size-4" aria-hidden="true" />Số từ</dt><dd>{items.length} từ vựng</dd></div>
            <div><dt>Chủ đề</dt><dd><Link to={`/topics/${set.topic_id}/vocabulary-sets`}>Xem các bộ từ cùng chủ đề</Link></dd></div>
          </dl>
          <section className="public-vocabulary-set-items" aria-labelledby="vocabulary-set-items-title">
            <div className="public-vocabulary-set-items-heading"><h2 id="vocabulary-set-items-title">Danh sách từ vựng</h2><p>{items.length} từ theo thứ tự của bộ từ</p></div>
            {items.length > 0 ? <ol aria-labelledby="vocabulary-set-items-title">{items.map((item) => <li key={item.id} value={item.position}><span className="public-vocabulary-set-item-word">{item.word}</span>{item.phonetic ? <span className="public-vocabulary-set-item-phonetic">{item.phonetic}</span> : null}</li>)}</ol> : <p className="public-vocabulary-set-items-empty">Bộ từ này hiện chưa có từ vựng.</p>}
          </section>
          {!isAuthenticated ? (
            <aside className="public-vocabulary-set-auth-prompt" aria-label="Sao chép bộ từ">
              <h2>Muốn lưu bộ từ này?</h2>
              <p>Đăng nhập để có thể sao chép bộ từ hệ thống vào Bộ từ của tôi.</p>
              <Link to="/login">Đăng nhập</Link>
            </aside>
          ) : null}
          {user?.role === "USER" ? (
            <aside className="public-vocabulary-set-auth-prompt" aria-label="Sao chép bộ từ">
              <h2>Lưu vào Bộ từ của tôi</h2>
              <p>Bạn sẽ nhận một bản sao riêng tư, có thể tự chỉnh sửa sau đó.</p>
              {copyError ? <p role="alert">{copyError}</p> : null}
              <button type="button" onClick={() => void copySet()} disabled={copyState === "pending"} aria-busy={copyState === "pending"}>
                {copyState === "pending" ? "Đang sao chép…" : "Sao chép bộ từ"}
              </button>
            </aside>
          ) : null}
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
