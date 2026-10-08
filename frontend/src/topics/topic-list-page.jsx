import { Bookmark, BookOpen, ChevronRight, LoaderCircle, RotateCcw, Search, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuthentication } from "../auth/use-authentication.js";
import { vocabularySetService } from "../services/vocabulary-set-service.js";
import { DefaultSetCoverArtwork, SetCefrBadge, SetCover } from "../vocabulary-sets/set-metadata-presentation.jsx";
import { useSavedVocabularySetSession } from "../vocabulary-sets/saved-vocabulary-set-session.js";
import { filterDiscoveryCatalog, loadDiscoveryCatalog, paginateDiscoveryCatalog, selectDiscoveryFeaturedSets } from "./discovery-catalog.js";

const DESCRIPTION_FALLBACK = "Chưa có mô tả cho bộ từ này.";

export function TopicListPage() {
  const { isAuthenticated, user } = useAuthentication();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [catalog, setCatalog] = useState({ topics: [], sets: [] });
  const [query, setQuery] = useState("");
  const [topicId, setTopicId] = useState(() => searchParams.get("topic") ?? "");
  const [cefrLevel, setCefrLevel] = useState("");
  const [status, setStatus] = useState("loading");
  const [reloadToken, setReloadToken] = useState(0);
  const [copyBySet, setCopyBySet] = useState({});
  const { beginCopy, completeCopy, failCopy, savedSetIds } = useSavedVocabularySetSession();
  const [page, setPage] = useState(1);

  useEffect(() => {
    function syncTopicFromHistory() {
      setTopicId(new URLSearchParams(window.location.search).get("topic") ?? "");
      setPage(1);
    }
    window.addEventListener("popstate", syncTopicFromHistory);
    return () => window.removeEventListener("popstate", syncTopicFromHistory);
  }, []);

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
    () => filterDiscoveryCatalog(catalog.sets, { cefrLevel, query, topicId }),
    [catalog.sets, cefrLevel, query, topicId],
  );
  const hasFilters = query.length > 0 || topicId.length > 0 || cefrLevel.length > 0;
  const featuredSets = useMemo(
    () => selectDiscoveryFeaturedSets(catalog.sets),
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
    setCefrLevel("");
    updateTopicFilter("");
  }

  function updateTopicFilter(nextTopicId) {
    const nextParams = new URLSearchParams(searchParams);
    if (nextTopicId) nextParams.set("topic", nextTopicId);
    else nextParams.delete("topic");
    setTopicId(nextTopicId);
    setSearchParams(nextParams, { replace: true });
    setPage(1);
  }

  async function copySet(set) {
    if (!beginCopy(set.id)) return;
    setCopyBySet((current) => ({ ...current, [set.id]: { status: "pending", error: null } }));
    try {
      const copied = await vocabularySetService.copySystemSet(set.id);
      completeCopy(set.id);
      navigate(`/my/vocabulary-sets/${copied.id}`);
    } catch {
      failCopy(set.id);
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
            <div className="discovery-search-heading">
              <label htmlFor="discovery-search">Tìm kiếm bộ từ</label>
              <button type="button" className="discovery-clear-button" onClick={clearFilters} disabled={!hasFilters}><RotateCcw className="size-3.5" aria-hidden="true" />Xóa bộ lọc</button>
            </div>
            <div className="public-topic-search-control">
              <Search className="size-5" aria-hidden="true" />
              <input id="discovery-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Nhập tên hoặc mô tả bộ từ" autoComplete="off" />
            </div>
          </div>
          <fieldset className="discovery-topic-filter">
            <legend>Chủ đề</legend>
            <div className="discovery-topic-options">
              <label><input type="radio" name="discovery-topic" value="" checked={topicId === ""} onChange={(event) => updateTopicFilter(event.target.value)} /><span>Tất cả chủ đề</span></label>
              {catalog.topics.map((topic) => <label key={topic.id}><input type="radio" name="discovery-topic" value={topic.id} checked={topicId === topic.id} onChange={(event) => updateTopicFilter(event.target.value)} /><span>{topic.name}</span></label>)}
            </div>
          </fieldset>
          <label className="discovery-cefr-filter grid gap-2 text-sm font-semibold text-slate-700" htmlFor="discovery-cefr-filter">Trình độ CEFR
            <select className="min-h-11 w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2 font-[inherit] font-medium text-slate-700 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary-focus)]" id="discovery-cefr-filter" value={cefrLevel} onChange={(event) => { setCefrLevel(event.target.value); setPage(1); }}>
              <option value="">Tất cả mức độ</option>
              {["A1", "A2", "B1", "B2", "C1"].map((level) => <option key={level} value={level}>{level}</option>)}
            </select>
          </label>
          <div className="discovery-results-row">
            <p className="public-topic-result-count" aria-live="polite">{normalVisibleSets.length} bộ từ phù hợp</p>
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
      <SetCover alt="" className={`discovery-card-cover discovery-card-cover--${topicTone} relative`} coverImageUrl={set.cover_image_url} fallback={<><DefaultSetCoverArtwork /><span className="discovery-cover-orbit" /></>} imageClassName="absolute inset-0 size-full object-cover">
        <span className="discovery-topic-badge">{set.topic.name}</span>
      </SetCover>
      <div className="discovery-card-body">
        <div className="discovery-card-title-row">
          <h2>{set.name}</h2>
          <div className="flex shrink-0 items-center gap-2"><SetCefrBadge cefrLevel={set.cefr_level} /><span className="public-vocabulary-set-count"><BookOpen className="size-4" aria-hidden="true" />{set.item_count} từ</span></div>
        </div>
        <p>{set.description || DESCRIPTION_FALLBACK}</p>
        {copyState?.error ? <p className="discovery-copy-error" role="alert">{copyState.error}</p> : null}
        <div className="discovery-card-actions">
          {!isAuthenticated ? <Link className="discovery-save-action" to="/login"><Bookmark className="size-4" aria-hidden="true" />Đăng nhập để lưu</Link> : null}
          {role === "USER" && isSaved ? <span className="is-saved inline-flex min-h-9 items-center gap-[0.3rem] rounded-[0.55rem] px-[0.52rem] py-1.5 text-[0.8rem] font-bold" role="status"><Bookmark className="size-4" fill="currentColor" aria-hidden="true" />Đã lưu</span> : null}
          {role === "USER" && !isSaved ? <button type="button" onClick={onCopy} disabled={isPending} aria-busy={isPending}><Bookmark className="size-4" aria-hidden="true" />{isPending ? "Đang lưu…" : copyState?.error ? "Thử lưu lại" : "Lưu"}</button> : null}
          <Link className="discovery-view-action" to={`/vocabulary-sets/${set.id}`}>Xem <ChevronRight className="size-4" aria-hidden="true" /></Link>
        </div>
      </div>
    </article>
  );
}

function getTopicTone(topicIdentity) {
  const tones = ["mint", "amber", "coral", "sky"];
  const hash = [...String(topicIdentity)].reduce((total, character) => total + character.codePointAt(0), 0);
  return tones[hash % tones.length];
}

function DiscoveryState({ action, message, role, status, title }) {
  return <div className="public-topic-state" role={status ? "status" : role} aria-live={status ? "polite" : undefined}>{status ? <LoaderCircle className="size-6 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}{title ? <h2>{title}</h2> : null}<p>{message}</p>{action}</div>;
}
