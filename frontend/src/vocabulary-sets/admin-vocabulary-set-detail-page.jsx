import { ArrowDown, ArrowLeft, ArrowUp, Image as ImageIcon, LoaderCircle, Pencil, Plus, Search, Trash2, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AdminConfirmDialog, AdminPagination } from "../admin/admin-ui-primitives.jsx";
import { adminNotifications } from "../admin/admin-notification-service.js";
import { AdminSystemSetPicker } from "../admin/admin-system-set-picker.jsx";
import "../admin/admin-system-set-detail.css";
import { topicService } from "../services/topic-service.js";
import { vocabularySetService } from "../services/vocabulary-set-service.js";
import { SystemSetEditorDialog } from "./admin-vocabulary-sets-page.jsx";

const PAGE_SIZE = 10;

export function AdminVocabularySetDetailPage() {
  const { setId } = useParams();
  const navigate = useNavigate();
  const [aggregate, setAggregate] = useState(null);
  const [savedItems, setSavedItems] = useState([]);
  const [draftItems, setDraftItems] = useState([]);
  const [topics, setTopics] = useState([]);
  const [state, setState] = useState("loading");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [feedback, setFeedback] = useState(null);
  const [pending, setPending] = useState(null);
  const [editor, setEditor] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [unsavedAction, setUnsavedAction] = useState(null);
  const [reload, setReload] = useState(0);
  const pickerTriggerRef = useRef(null);
  const removeTriggerRef = useRef(null);
  const unsavedTriggerRef = useRef(null);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) { setState("loading"); setFeedback(null); }
      return vocabularySetService.getAdminSystemSet(setId);
    }).then((data) => {
      if (!active) return;
      const ordered = orderItems(data.items);
      setAggregate(data);
      setSavedItems(ordered);
      setDraftItems(ordered);
      setPage(1);
      setState("ready");
    }, () => { if (active) setState("error"); });
    topicService.listTopics().then((data) => { if (active) setTopics(data); }, () => {});
    return () => { active = false; };
  }, [reload, setId]);

  const dirty = itemSignature(draftItems) !== itemSignature(savedItems);
  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized ? draftItems.filter((item) => [item.word, item.phonetic, item.primary_meaning?.meaning_vi, item.primary_meaning?.part_of_speech].filter(Boolean).some((value) => value.toLocaleLowerCase().includes(normalized))) : draftItems;
  }, [draftItems, query]);
  const searchActive = query.trim().length > 0;
  const totalPages = Math.max(1, Math.ceil(visibleItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedItems = visibleItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const topicName = topics.find((topic) => topic.id === aggregate?.topic_id)?.name ?? "Chủ đề hệ thống";

  useEffect(() => {
    if (!dirty) return undefined;
    const beforeUnload = (event) => { event.preventDefault(); event.returnValue = ""; };
    const protectLinks = (event) => {
      const anchor = event.target.closest("a[href]");
      if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = new URL(anchor.href, window.location.href);
      if (target.origin !== window.location.origin || target.pathname === window.location.pathname) return;
      event.preventDefault();
      unsavedTriggerRef.current = anchor;
      setUnsavedAction({ type: "leave", target: `${target.pathname}${target.search}${target.hash}` });
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", protectLinks, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", protectLinks, true); };
  }, [dirty, navigate]);

  function move(index, direction) {
    if (searchActive) return;
    const target = index + direction;
    if (target < 0 || target >= draftItems.length) return;
    setDraftItems((current) => {
      const next = [...current];
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return withPositions(next);
    });
    setPage(Math.floor(target / PAGE_SIZE) + 1);
    setFeedback(null);
  }

  function requestRemove(item, trigger) {
    if (draftItems.length === 1) {
      setFeedback({ type: "error", message: "Bộ từ hệ thống cần giữ lại ít nhất một từ vựng." });
      return;
    }
    removeTriggerRef.current = trigger;
    setRemoveTarget(item);
  }

  function confirmRemove() {
    if (!removeTarget) return;
    setDraftItems((current) => withPositions(current.filter((candidate) => candidate.vocabulary_id !== removeTarget.vocabulary_id)));
    setFeedback(null);
    setRemoveTarget(null);
  }

  function requestDiscard(trigger) {
    if (!dirty) return;
    unsavedTriggerRef.current = trigger;
    setUnsavedAction({ type: "discard" });
  }

  function confirmUnsavedAction() {
    if (!unsavedAction) return;
    const target = unsavedAction.type === "leave" ? unsavedAction.target : null;
    setDraftItems(savedItems);
    setFeedback(null);
    setQuery("");
    setPage(1);
    setUnsavedAction(null);
    if (target) navigate(target);
  }

  async function saveMembership() {
    if (!dirty || pending) return;
    setPending("membership");
    setFeedback(null);
    try {
      const saved = await vocabularySetService.updateAdminSystemSet(setId, { items: draftItems.map((item) => ({ vocabulary_id: item.vocabulary_id })) });
      const ordered = orderItems(saved.items);
      setAggregate(saved);
      setSavedItems(ordered);
      setDraftItems(ordered);
      setFeedback(null);
      adminNotifications.success("Lưu danh sách từ thành công", `system-set-membership-${setId}`);
    } catch {
      setFeedback({ type: "error", message: "Không thể lưu danh sách từ vựng. Bản nháp vẫn được giữ để bạn thử lại." });
    } finally { setPending(null); }
  }

  async function saveMetadata({ input, metadata }) {
    setPending("metadata");
    setFeedback(null);
    try {
      let saved = await vocabularySetService.updateAdminSystemSet(setId, input);
      try {
        if (metadata.coverFile) saved = await vocabularySetService.uploadAdminSystemSetCover(setId, metadata.coverFile);
        else if (metadata.removeCover) saved = await vocabularySetService.removeAdminSystemSetCover(setId);
      } catch {
        setAggregate(saved);
        setEditor({ mode: "edit", aggregate: saved, uploadRetry: metadata.coverFile ?? null });
        setFeedback({ type: "error", message: "Thông tin đã lưu nhưng ảnh bìa chưa cập nhật. Hãy thử lại." });
        return false;
      }
      setAggregate(saved);
      setEditor(null);
      setFeedback(null);
      adminNotifications.success("Cập nhật bộ từ thành công", `system-set-detail-update-${setId}`);
      return true;
    } catch {
      setFeedback({ type: "error", message: "Không thể cập nhật thông tin bộ từ. Hãy thử lại." });
      return false;
    } finally { setPending(null); }
  }

  async function retryCoverUpload() {
    if (!editor?.uploadRetry) return;
    setPending("metadata");
    try {
      const saved = await vocabularySetService.uploadAdminSystemSetCover(setId, editor.uploadRetry);
      setAggregate(saved);
      setEditor(null);
      setFeedback(null);
      adminNotifications.success("Đã tải ảnh bìa", `system-set-detail-cover-${setId}`);
    } catch { setFeedback({ type: "error", message: "Chưa thể tải ảnh bìa. Hãy thử lại." }); }
    finally { setPending(null); }
  }

  if (state === "loading") return <PageState loading message="Đang tải chi tiết bộ từ…" />;
  if (state === "error") return <PageState title="Không thể tải bộ từ hệ thống" message="Bộ từ không tồn tại hoặc dữ liệu chưa sẵn sàng." action={<><button type="button" onClick={() => setReload((value) => value + 1)}>Thử lại</button><Link to="/admin/vocabulary-sets">Quay lại danh sách</Link></>} />;
  if (!aggregate) return null;

  return <section className="admin-set-detail-page" aria-labelledby="admin-set-detail-title">
    <Link className="admin-set-detail-back" to="/admin/vocabulary-sets"><ArrowLeft aria-hidden="true" />Quản lý bộ từ</Link>
    <header className="admin-set-detail-hero">
      <div className="admin-set-detail-cover">{aggregate.cover_image_url ? <img src={aggregate.cover_image_url} alt="" width="112" height="84" /> : <ImageIcon aria-hidden="true" />}</div>
      <div className="admin-set-detail-heading"><p>Hệ thống · Công khai</p><h1 id="admin-set-detail-title">{aggregate.name}</h1><div className="admin-set-detail-badges"><span>{topicName}</span><span>{aggregate.cefr_level || "Chưa có CEFR"}</span><span>{draftItems.length} từ vựng</span></div><p>{aggregate.description || "Chưa có mô tả."}</p></div>
      <button className="admin-topic-primary-button" type="button" onClick={() => setEditor({ mode: "edit", aggregate })} disabled={pending !== null}><Pencil aria-hidden="true" />Chỉnh sửa thông tin</button>
    </header>

    {feedback?.type === "error" ? <p className="admin-topic-feedback is-error" role="alert" aria-live="polite">{feedback.message}</p> : null}

    <section className="admin-set-membership" aria-labelledby="admin-set-membership-title">
      <div className="admin-set-membership-heading"><div><h2 id="admin-set-membership-title">Từ vựng trong bộ</h2><p>Thêm, gỡ hoặc sắp xếp trong bản nháp rồi lưu toàn bộ danh sách một lần.</p></div><button ref={pickerTriggerRef} className="admin-secondary-button" type="button" onClick={() => setPickerOpen(true)} disabled={pending !== null}><Plus aria-hidden="true" />Thêm từ vựng</button></div>
      <div className="admin-set-membership-toolbar"><label><span className="sr-only">Tìm trong bộ từ</span><Search aria-hidden="true" /><input name="membership_query" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Tìm theo từ, nghĩa hoặc từ loại…" autoComplete="off" /></label><span aria-live="polite">{visibleItems.length}/{draftItems.length} từ</span></div>
      {searchActive ? <p id="admin-set-reorder-search-note" className="admin-set-reorder-note">Xóa nội dung tìm kiếm để sắp xếp thứ tự từ vựng.</p> : null}
      {visibleItems.length === 0 ? <p className="admin-set-detail-empty">Không có từ vựng phù hợp với tìm kiếm.</p> : <><ol className="admin-set-item-list">{paginatedItems.map((item) => { const index = draftItems.findIndex((candidate) => candidate.vocabulary_id === item.vocabulary_id); return <li key={item.vocabulary_id}><span className="admin-set-item-position">{index + 1}</span><div className="admin-set-item-copy"><strong>{item.word}</strong><span>{item.phonetic || "Chưa có phiên âm"}</span></div><div className="admin-set-item-meaning"><strong>{item.primary_meaning?.meaning_vi || "Chưa có nghĩa chính"}</strong><span>{item.primary_meaning?.part_of_speech || "Chưa có từ loại"}</span></div><div className="admin-set-item-actions"><button type="button" onClick={() => move(index, -1)} disabled={pending !== null || searchActive || index === 0} aria-describedby={searchActive ? "admin-set-reorder-search-note" : undefined} aria-label={`Đưa ${item.word} lên`}><ArrowUp aria-hidden="true" /></button><button type="button" onClick={() => move(index, 1)} disabled={pending !== null || searchActive || index === draftItems.length - 1} aria-describedby={searchActive ? "admin-set-reorder-search-note" : undefined} aria-label={`Đưa ${item.word} xuống`}><ArrowDown aria-hidden="true" /></button><button className="is-danger" type="button" onClick={(event) => requestRemove(item, event.currentTarget)} disabled={pending !== null || draftItems.length === 1} aria-label={draftItems.length === 1 ? `Không thể gỡ ${item.word}; bộ từ cần ít nhất một từ` : `Gỡ ${item.word} khỏi bộ từ`} title={draftItems.length === 1 ? "Bộ từ cần ít nhất một từ vựng" : undefined}><Trash2 aria-hidden="true" /></button></div></li>; })}</ol><AdminPagination currentPage={currentPage} totalPages={totalPages} pageSize={PAGE_SIZE} totalItems={visibleItems.length} onPrevious={() => setPage((value) => Math.max(1, value - 1))} onNext={() => setPage((value) => Math.min(totalPages, value + 1))} /></>}
      <footer className={`admin-set-membership-footer${dirty ? " is-dirty" : ""}`}><span role="status" aria-live="polite">{dirty ? "Có thay đổi chưa lưu" : "Danh sách đã được lưu"}</span><div><button className="admin-secondary-button" type="button" onClick={(event) => requestDiscard(event.currentTarget)} disabled={!dirty || pending !== null}><Undo2 aria-hidden="true" />Bỏ thay đổi</button><button className="admin-topic-primary-button" type="button" onClick={() => void saveMembership()} disabled={!dirty || pending !== null || draftItems.length === 0} aria-busy={pending === "membership"}>{pending === "membership" ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}{pending === "membership" ? "Đang lưu…" : "Lưu thay đổi"}</button></div></footer>
    </section>

    {pickerOpen ? <AdminSystemSetPicker open selected={draftItems} returnFocusRef={pickerTriggerRef} onCancel={() => setPickerOpen(false)} onNavigateToVocabulary={() => navigate("/admin/vocabulary")} onConfirm={(items) => { setDraftItems(withPositions(items)); setPickerOpen(false); setFeedback(null); }} /> : null}
    {editor ? <SystemSetEditorDialog editor={editor} error={feedback?.type === "error" ? feedback.message : null} pending={pending === "metadata"} retryUpload={editor.uploadRetry ? retryCoverUpload : null} onCancel={() => setEditor(null)} onSave={saveMetadata} /> : null}
    <AdminConfirmDialog open={Boolean(removeTarget)} title="Gỡ từ khỏi bộ từ?" description={removeTarget ? `Bạn muốn gỡ từ “${removeTarget.word}” khỏi bộ từ này?` : ""} note="Sau khi xác nhận, hãy nhấn “Lưu thay đổi” trên trang để hoàn tất." confirmLabel="Gỡ khỏi danh sách" returnFocusRef={removeTriggerRef} onCancel={() => setRemoveTarget(null)} onConfirm={confirmRemove} />
    <AdminConfirmDialog open={Boolean(unsavedAction)} title={unsavedAction?.type === "leave" ? "Rời trang khi chưa lưu?" : "Bỏ các thay đổi chưa lưu?"} description={unsavedAction?.type === "leave" ? "Các thay đổi chưa lưu sẽ bị mất nếu bạn rời trang." : "Danh sách từ vựng sẽ được khôi phục về lần lưu gần nhất."} note={null} cancelLabel={unsavedAction?.type === "leave" ? "Ở lại" : "Tiếp tục chỉnh sửa"} confirmLabel={unsavedAction?.type === "leave" ? "Rời trang" : "Bỏ thay đổi"} returnFocusRef={unsavedTriggerRef} onCancel={() => setUnsavedAction(null)} onConfirm={confirmUnsavedAction} />
  </section>;
}

function PageState({ action, loading, message, title }) { return <section className="admin-set-detail-page"><div className="admin-topic-state" role={loading ? "status" : "alert"} aria-live="polite">{loading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}{title ? <h1>{title}</h1> : null}<p>{message}</p>{action ? <div className="admin-state-actions">{action}</div> : null}</div></section>; }
function orderItems(items = []) { return withPositions([...items].sort((left, right) => left.position - right.position)); }
function withPositions(items) { return items.map((item, index) => ({ ...item, position: index + 1 })); }
function itemSignature(items) { return items.map((item) => item.vocabulary_id).join("|"); }
