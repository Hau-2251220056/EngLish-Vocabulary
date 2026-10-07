import { Bookmark, BookOpen, ChevronRight, LoaderCircle, RotateCcw, Search, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthentication } from "../auth/use-authentication.js";
import { vocabularySetService } from "../services/vocabulary-set-service.js";
import { filterDiscoveryCatalog, loadDiscoveryCatalog, paginateDiscoveryCatalog } from "./discovery-catalog.js";

const DESCRIPTION_FALLBACK = "Chưa có mô tả cho bộ từ này.";
const MANUAL_REVIEW_PREFIX = "E2E-DISCOVERY-MANUAL-";
const SAVED_SETS_KEY = "elvocab.discovery.saved-set-ids.v1";

export function TopicListPage() {
  const { isAuthenticated, user } = useAuthentication();
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState({ topics: [], sets: [] });
  const [query, setQuery] = useState("");
  const [topicId, setTopicId] = useState("");
  const [status, setStatus] = useState("loading");
  const [reloadToken, setReloadToken] = useState(0);
  const [copyBySet, setCopyBySet] = useState({});
  const [savedSetIds, setSavedSetIds] = useState(readSessionSavedSetIds);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let current = true;
    loadDiscoveryCatalog().then(
      (data) => {
        if (!current) return;
        setCatalog(data);
        setStatus("success");
      },
      () => {
        if (current) setStatus("error");
      },
    );
    return () => { current = false; };
  }, [reloadToken]);

  const visibleSets = useMemo(
    () => filterDiscoveryCatalog(catalog.sets, { query, topicId }),
    [catalog.sets, query, topicId],
  );
  const hasFilters = query.length > 0 || topicId.length > 0;
  const featuredSets = useMemo(
    () => import.meta.env.DEV
      ? catalog.sets.filter((set) => [set.name, set.description].some((value) => value?.includes(MANUAL_REVIEW_PREFIX))).slice(0, 3)
      : [],
    [catalog.sets],
  );
  const featuredSetIds = useMemo(() => new Set(featuredSets.map((set) => set.id)), [featuredSets]);
  const normalVisibleSets = useMemo(
    () => visibleSets.filter((set) => !featuredSetIds.has(set.id)),
    [featuredSetIds, visibleSets],
  );
  const pagination = useMemo(() => paginateDiscoveryCatalog(normalVisibleSets, page), [normalVisibleSets, page]);

  function retry() {
    setStatus("loading");
    setReloadToken((value) => value + 1);
  }

  function clearFilters() {
    setQuery("");
    setTopicId("");
    setPage(1);
  }

  async function copySet(set) {
    if (copyBySet[set.id]?.status === "pending") return;
    setCopyBySet((current) => ({ ...current, [set.id]: { status: "pending", error: null } }));
    try {
      const copied = await vocabularySetService.copySystemSet(set.id);
      setSavedSetIds((current) => {
        const next = new Set(current).add(set.id);
        writeSessionSavedSetIds(next);
        return next;
      });
      navigate(`/my/vocabulary-sets/${copied.id}`);
    } catch {
      setCopyBySet((current) => ({
        ...current,
        [set.id]: { status: "idle", error: "Không thể lưu bộ từ. Vui lòng thử lại." },
      }));
    }
  }

  return (
    <section className="public-topic-content discovery-content" aria-labelledby="topic-list-title">
      <h1 className="sr-only" id="topic-list-title">Khám phá bộ từ</h1>

      {status === "success" && featuredSets.length > 0 ? (
        <section className="discovery-featured" aria-labelledby="discovery-featured-title">
          <div className="discovery-section-heading">
            <div><Star className="size-4" aria-hidden="true" /><h2 id="discovery-featured-title">Bộ từ nổi bật</h2></div>
          </div>
          <ul className="discovery-featured-grid">
            {featuredSets.map((set) => <li key={set.id}><DiscoverySetCard featured set={set} role={user?.role ?? null} isAuthenticated={isAuthenticated} isSaved={savedSetIds.has(set.id)} copyState={copyBySet[set.id]} onCopy={() => void copySet(set)} /></li>)}
          </ul>
        </section>
      ) : null}

      {status === "success" && catalog.sets.length > 0 ? (
        <div className="discovery-catalog-layout">
          <aside className="discovery-filter-sidebar" aria-label="Tìm kiếm và lọc bộ từ">
          <div className="public-topic-search discovery-search">
            <label htmlFor="discovery-search">Tìm kiếm bộ từ</label>
            <div className="public-topic-search-control">
              <Search className="size-5" aria-hidden="true" />
              <input id="discovery-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Nhập tên hoặc mô tả bộ từ" autoComplete="off" />
            </div>
          </div>
          <fieldset className="discovery-topic-filter">
            <legend>Chủ đề</legend>
            <label><input type="radio" name="discovery-topic" value="" checked={topicId === ""} onChange={(event) => { setTopicId(event.target.value); setPage(1); }} /><span>Tất cả chủ đề</span></label>
            {catalog.topics.map((topic) => <label key={topic.id}><input type="radio" name="discovery-topic" value={topic.id} checked={topicId === topic.id} onChange={(event) => { setTopicId(event.target.value); setPage(1); }} /><span>{topic.name}</span></label>)}
          </fieldset>
          <div className="discovery-results-row">
            <p className="public-topic-result-count" aria-live="polite">{normalVisibleSets.length} bộ từ phù hợp</p>
            {hasFilters ? <button type="button" className="discovery-clear-button" onClick={clearFilters}><RotateCcw className="size-3.5" aria-hidden="true" />Xóa bộ lọc</button> : null}
          </div>
          </aside>
          <div className="discovery-catalog-results">
            {normalVisibleSets.length === 0 ? <DiscoveryState title="Không tìm thấy bộ từ phù hợp" message="Hãy thử từ khóa hoặc chủ đề khác, hoặc xóa bộ lọc." /> : (
              <ul className="public-topic-grid discovery-set-grid" aria-label="Danh sách bộ từ hệ thống">
                {pagination.items.map((set) => <li key={set.id}><DiscoverySetCard set={set} role={user?.role ?? null} isAuthenticated={isAuthenticated} isSaved={savedSetIds.has(set.id)} copyState={copyBySet[set.id]} onCopy={() => void copySet(set)} /></li>)}
              </ul>
            )}
            {normalVisibleSets.length > 0 ? <nav className="discovery-pagination" aria-label="Phân trang bộ từ"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={pagination.currentPage === 1}>Trước</button><span aria-live="polite">{pagination.currentPage} / {pagination.totalPages}</span><button type="button" onClick={() => setPage((value) => Math.min(pagination.totalPages, value + 1))} disabled={pagination.currentPage === pagination.totalPages}>Sau</button></nav> : null}
          </div>
        </div>
      ) : null}

      {status === "loading" ? <DiscoveryState status message="Đang tải danh mục bộ từ…" /> : null}
      {status === "error" ? <DiscoveryState role="alert" title="Không thể tải danh mục bộ từ" message="Danh mục chưa đầy đủ. Vui lòng kiểm tra kết nối và thử lại." action={<button type="button" onClick={retry}>Thử lại</button>} /> : null}
      {status === "success" && catalog.sets.length === 0 ? <DiscoveryState title="Chưa có bộ từ để khám phá" message="Các bộ từ hệ thống công khai sẽ xuất hiện tại đây khi sẵn sàng." /> : null}
    </section>
  );
}

function DiscoverySetCard({ copyState, featured = false, isAuthenticated, isSaved, onCopy, role, set }) {
  const isPending = copyState?.status === "pending";
  const topicTone = getTopicTone(set.topic.id || set.topic.name);
  return (
    <article className={`public-topic-card public-vocabulary-set-card discovery-set-card${featured ? " is-featured" : ""}`}>
      <div className={`discovery-card-cover discovery-card-cover--${topicTone}`} aria-hidden="true">
        <BookOpen />
        <span className="discovery-cover-orbit" />
        <span className="discovery-topic-badge">{set.topic.name}</span>
      </div>
      <div className="discovery-card-body">
        <div className="discovery-card-title-row">
          <h2>{set.name}</h2>
          <span className="public-vocabulary-set-count"><BookOpen className="size-4" aria-hidden="true" />{set.item_count} từ</span>
        </div>
        <p>{set.description || DESCRIPTION_FALLBACK}</p>
        {copyState?.error ? <p className="discovery-copy-error" role="alert">{copyState.error}</p> : null}
        <div className="discovery-card-actions">
          {!isAuthenticated ? <Link className="discovery-save-action" to="/login"><Bookmark className="size-4" aria-hidden="true" />Đăng nhập để lưu</Link> : null}
          {role === "USER" ? <button className={isSaved ? "is-saved" : undefined} type="button" onClick={onCopy} disabled={isPending} aria-busy={isPending}><Bookmark className="size-4" fill={isSaved ? "currentColor" : "none"} aria-hidden="true" />{isPending ? "Đang lưu…" : copyState?.error ? "Thử lưu lại" : isSaved ? "Đã lưu" : "Lưu"}</button> : null}
          <Link className="discovery-view-action" to={`/vocabulary-sets/${set.id}`}>Xem <ChevronRight className="size-4" aria-hidden="true" /></Link>
        </div>
      </div>
    </article>
  );
}

function readSessionSavedSetIds() {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(SAVED_SETS_KEY) || "[]");
    return new Set(Array.isArray(value) ? value.filter((item) => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

function writeSessionSavedSetIds(savedSetIds) {
  try {
    window.sessionStorage.setItem(SAVED_SETS_KEY, JSON.stringify([...savedSetIds]));
  } catch {
    // Session feedback is best-effort and never affects the authoritative copy result.
  }
}

function getTopicTone(topicIdentity) {
  const tones = ["mint", "amber", "coral", "sky"];
  const hash = [...String(topicIdentity)].reduce((total, character) => total + character.codePointAt(0), 0);
  return tones[hash % tones.length];
}

function DiscoveryState({ action, message, role, status, title }) {
  return <div className="public-topic-state" role={status ? "status" : role} aria-live={status ? "polite" : undefined}>{status ? <LoaderCircle className="size-6 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}{title ? <h2>{title}</h2> : null}<p>{message}</p>{action}</div>;
}
