import { ArrowLeft, ArrowRight, BookOpen, Bookmark, LoaderCircle, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuthentication } from "../auth/use-authentication.js";
import { NativeSelect } from "../components/native-select.jsx";
import { notifications } from "../components/notification-service.js";
import { VocabularySetApiError, vocabularySetService } from "../services/vocabulary-set-service.js";
import { SetDetailPagination, SetLearningActions, SetVocabularyPreviewTable } from "./set-detail-primitives.jsx";
import { paginateSetDetailItems } from "./set-detail-pagination.js";
import { DefaultSetCoverArtwork, SetCefrBadge, SetCover } from "./set-metadata-presentation.jsx";
import { useSavedVocabularySetSession } from "./saved-vocabulary-set-session.js";

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
                <SetCover alt="" className="relative mb-3 flex h-28 items-center justify-center overflow-hidden rounded-xl bg-[var(--accent-primary-soft)] text-[var(--accent-primary-pressed)] [&>svg]:size-8" coverImageUrl={set.cover_image_url} fallback={<DefaultSetCoverArtwork />} imageClassName="size-full object-cover" />
                <p className="public-vocabulary-set-card-label">Bộ từ hệ thống</p>
                <div className="flex items-start justify-between gap-2"><h2>{set.name}</h2><SetCefrBadge cefrLevel={set.cefr_level} /></div>
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
  const [itemsPage, setItemsPage] = useState(1);
  const [addItem, setAddItem] = useState(null);
  const { beginCopy, completeCopy, failCopy, savedSetIds } = useSavedVocabularySetSession();
  const isSaved = savedSetIds.has(setId);

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
  const itemPagination = useMemo(() => paginateSetDetailItems(items, itemsPage), [items, itemsPage]);

  function retry() {
    setStatus("loading");
    setReloadToken((value) => value + 1);
  }

  async function copySet() {
    if (!set || !beginCopy(set.id)) return;
    setCopyState("pending");
    setCopyError(null);
    try {
      const copied = await vocabularySetService.copySystemSet(set.id);
      completeCopy(set.id);
      navigate(`/my/vocabulary-sets/${copied.id}`);
    } catch {
      failCopy(set.id);
      setCopyError("Không thể sao chép bộ từ. Vui lòng thử lại.");
      setCopyState("idle");
    }
  }

  function openAdd(item, trigger) {
    setAddItem({ item, trigger });
  }

  function closeAdd() {
    const trigger = addItem?.trigger;
    setAddItem(null);
    requestAnimationFrame(() => { if (trigger?.isConnected) trigger.focus(); });
  }

  return (
    <section className="set-detail-page mx-auto w-full max-w-[76rem] p-[clamp(1rem,3vw,2.5rem)] text-[var(--text-primary)] max-[480px]:p-4" aria-label="Chi tiết bộ từ hệ thống">
      <Link className="set-detail-back inline-flex min-h-11 items-center gap-[0.45rem] font-semibold text-[#5b6478] no-underline transition-[color,transform] duration-150 hover:-translate-x-0.5 hover:text-[var(--accent-primary-hover)] focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] motion-reduce:transform-none motion-reduce:transition-none [&_svg]:w-[1.1rem]" to={set ? `/topics?topic=${encodeURIComponent(set.topic_id)}` : "/topics"}>
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
            <div className="min-w-0 flex-1">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h1 className="m-0 [overflow-wrap:anywhere] text-[clamp(1.75rem,2.8vw,2.05rem)] font-semibold tracking-[-0.035em] max-[700px]:text-[1.7rem]" id="vocabulary-set-detail-title">{set.name}</h1><SetCefrBadge cefrLevel={set.cefr_level} /></div>
                <p className="mb-0 mt-2 max-w-[42rem] text-sm leading-6 text-slate-500">{set.description || "Chưa có mô tả cho bộ từ này."}</p>
                <Link className="mt-2 inline-flex text-sm font-semibold text-[var(--accent-primary)] no-underline focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)]" to={`/topics?topic=${encodeURIComponent(set.topic_id)}`}>Xem các bộ từ cùng chủ đề</Link>
              </div>
            </div>
            {!isAuthenticated ? <Link className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-[0.7rem] border border-[var(--accent-primary)] bg-white px-3 py-[0.55rem] text-sm font-semibold text-[var(--accent-primary)] no-underline hover:bg-[var(--accent-primary-soft)] focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] max-[800px]:min-h-11 max-[800px]:w-full" to="/login">Đăng nhập để học và lưu</Link> : null}
            {user?.role === "USER" && isSaved ? <span className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-[0.7rem] bg-emerald-50 px-3 py-[0.55rem] text-sm font-semibold text-emerald-700 max-[800px]:min-h-11 max-[800px]:w-full" role="status"><Bookmark className="size-4" fill="currentColor" aria-hidden="true" />Đã lưu</span> : null}
            {user?.role === "USER" && !isSaved ? <button type="button" className="inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[0.7rem] border border-slate-300 bg-white px-3 py-[0.55rem] text-sm font-semibold text-slate-700 hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary-soft)] hover:text-[var(--accent-primary)] focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] disabled:cursor-not-allowed disabled:opacity-[0.58] max-[800px]:min-h-11 max-[800px]:w-full" onClick={() => void copySet()} disabled={copyState === "pending"} aria-busy={copyState === "pending"}><Bookmark className="size-4" aria-hidden="true" />{copyState === "pending" ? "Đang lưu…" : copyError ? "Thử lưu lại" : "Lưu vào Bộ từ của tôi"}</button> : null}
          </header>
          {copyError ? <p className="mb-0 mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{copyError}</p> : null}

          {user?.role === "USER" ? <SetLearningActions enabled={items.length > 0} returnTo={`/vocabulary-sets/${set.id}`} setId={set.id} setName={set.name} /> : null}

          <section className="set-detail-vocabulary mt-[1.65rem]" aria-labelledby="vocabulary-set-items-title">
            <div className="set-detail-section-heading flex items-center justify-between gap-4"><h2 className="m-0 text-[clamp(1.125rem,1.6vw,1.25rem)] font-semibold" id="vocabulary-set-items-title">Từ vựng trong bộ ({items.length})</h2></div>
            {items.length > 0 ? <><SetVocabularyPreviewTable items={itemPagination.items} renderAction={user?.role === "USER" ? (item) => <button type="button" className="public-set-add-action inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1 rounded-lg border border-[var(--accent-primary)] bg-white px-2.5 text-xs font-semibold text-[var(--accent-primary-pressed)] hover:bg-[var(--accent-primary-soft)] focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)]" aria-label={`Thêm ${item.word} vào bộ từ cá nhân`} onClick={(event) => openAdd(item, event.currentTarget)}><Plus className="size-4 shrink-0" aria-hidden="true" /><span className="public-set-add-label">Thêm</span></button> : undefined} /><SetDetailPagination pagination={itemPagination} setPage={setItemsPage} /></> : <div className="set-detail-empty mt-4 grid justify-items-center gap-[0.65rem] rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-[clamp(2rem,6vw,4rem)] text-center text-slate-500 [&_h3]:m-0 [&_p]:m-0 [&>svg]:size-8 [&>svg]:text-[var(--accent-primary)]"><BookOpen aria-hidden="true" /><h3>Bộ từ chưa có từ vựng</h3><p>Hiện chưa có nội dung để học với Flashcard, Quiz và Luyện nói.</p></div>}
          </section>
          {addItem ? <AddPublicVocabularyDialog item={addItem.item} sourceSetId={set.id} onClose={closeAdd} onSuccess={(destination) => { notifications.success(`Đã thêm ${addItem.item.word} vào ${destination.name}.`, `public-word-added-${addItem.item.vocabulary_id}-${destination.id}`); closeAdd(); }} /> : null}
        </article>
      ) : null}
    </section>
  );
}

function AddPublicVocabularyDialog({ item, onClose, onSuccess, sourceSetId }) {
  const panelRef = useRef(null);
  const [sets, setSets] = useState([]);
  const [state, setState] = useState("loading");
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState(null);
  const pending = state === "submitting";

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    let current = true;
    vocabularySetService.listMySets().then(
      (data) => { if (current) { setSets(data); setState("ready"); } },
      () => { if (current) setState("error"); },
    );
    return () => { current = false; };
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => {
    function handleKey(event) {
      if (event.key === "Escape" && !pending) onClose();
      if (event.key !== "Tab" || !panelRef.current) return;
      const controls = [...panelRef.current.querySelectorAll("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled])")];
      if (controls.length === 0) { event.preventDefault(); panelRef.current.focus(); return; }
      const first = controls[0];
      const last = controls.at(-1);
      if (!panelRef.current.contains(document.activeElement) || document.activeElement === panelRef.current) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, pending]);

  async function submit(event) {
    event.preventDefault();
    if (!selectedId || pending) return;
    setState("submitting");
    setError(null);
    try {
      await vocabularySetService.addPublicVocabularyItem(selectedId, sourceSetId, item.vocabulary_id);
      onSuccess(sets.find((set) => set.id === selectedId));
    } catch (cause) {
      setError(cause instanceof VocabularySetApiError && cause.code === "VOCABULARY_ALREADY_IN_SET" ? "Từ này đã có trong bộ" : "Chưa thể thêm từ vựng. Vui lòng thử lại.");
      setState("ready");
    }
  }

  const dialog = <div className="fixed inset-0 z-[100] grid items-end bg-slate-900/40 p-0 min-[641px]:place-items-center min-[641px]:p-4" data-testid="add-public-vocabulary-overlay" role="presentation" style={{ "--accent-primary": "#4ca2e6", "--accent-primary-focus": "rgb(76 162 230 / 32%)", "--accent-primary-pressed": "#237fc4", "--bg-subtle": "#f8fafc" }} onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}><section ref={panelRef} tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="add-public-vocabulary-title" aria-describedby="add-public-vocabulary-description" className="max-h-[calc(100dvh-1rem)] w-full overflow-auto overscroll-contain rounded-t-2xl bg-white p-5 shadow-[0_24px_60px_rgb(15_23_42/30%)] min-[641px]:max-h-[calc(100dvh-2rem)] min-[641px]:w-[min(30rem,calc(100vw-2rem))] min-[641px]:rounded-2xl min-[641px]:border min-[641px]:border-slate-200">
    <header className="flex items-start justify-between gap-4"><div><h2 id="add-public-vocabulary-title" className="m-0 text-lg font-semibold">Thêm vào bộ từ cá nhân</h2><p id="add-public-vocabulary-description" className="mb-0 mt-1 text-sm text-slate-600">Chọn bộ từ đích cho <strong>{item.word}</strong>.</p></div><button type="button" aria-label="Đóng chọn bộ từ" className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-slate-600 hover:bg-slate-100 focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] disabled:cursor-not-allowed" onClick={onClose} disabled={pending}><X className="size-5" aria-hidden="true" /></button></header>
    {state === "loading" ? <p className="mt-5 flex items-center gap-2 text-sm text-slate-600" role="status"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Đang tải bộ từ…</p> : null}
    {state === "error" ? <div className="mt-5" role="alert"><p>Không thể tải danh sách bộ từ.</p><button type="button" className="min-h-10 cursor-pointer rounded-lg border border-slate-300 bg-white px-3 font-semibold" onClick={() => { setState("loading"); vocabularySetService.listMySets().then((data) => { setSets(data); setState("ready"); }, () => setState("error")); }}>Thử lại</button></div> : null}
    {state !== "loading" && state !== "error" && sets.length === 0 ? <div className="mt-5 rounded-xl bg-[var(--bg-subtle)] p-4 text-sm text-slate-600"><p className="mt-0">Bạn chưa có bộ từ cá nhân nào.</p><Link className="cursor-pointer font-semibold text-[var(--accent-primary-pressed)]" to="/my/vocabulary-sets">Tạo bộ từ cá nhân</Link></div> : null}
    {state !== "loading" && state !== "error" && sets.length > 0 ? <form className="mt-5" onSubmit={submit}><label className="grid gap-2 text-sm font-semibold text-slate-700" htmlFor="destination-set">Bộ từ đích</label><NativeSelect id="destination-set" name="destination-set" className="cursor-pointer disabled:cursor-not-allowed" wrapperClassName="mt-2" value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setError(null); }} disabled={pending}><option value="" disabled>Chọn bộ từ cá nhân...</option>{sets.map((set) => <option key={set.id} value={set.id}>{set.name} — {set.item_count} từ vựng</option>)}</NativeSelect>{error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p> : null}<footer className="mt-5 flex justify-end gap-2 max-[480px]:flex-col-reverse max-[480px]:[&_button]:w-full"><button type="button" className="min-h-11 cursor-pointer rounded-xl border border-slate-300 bg-white px-4 font-semibold text-slate-700 disabled:cursor-not-allowed" onClick={onClose} disabled={pending}>Hủy</button><button type="submit" className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-[var(--accent-primary)] px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={!selectedId || pending} aria-busy={pending}>{pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}{pending ? "Đang thêm…" : "Thêm vào bộ từ"}</button></footer></form> : null}
  </section></div>;

  return createPortal(dialog, document.body);
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
