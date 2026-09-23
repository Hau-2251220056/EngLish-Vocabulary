import { BookOpen, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { VocabularySetEditor } from "./my-vocabulary-sets-page.jsx";
import { VocabularySetApiError, vocabularySetService } from "../services/vocabulary-set-service.js";

const EMPTY_SYSTEM_SET = { topic_id: "", name: "", description: "", items: [] };

export function AdminVocabularySetsPage() {
  const [sets, setSets] = useState([]);
  const [state, setState] = useState("loading");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [editor, setEditor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [pending, setPending] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) setState("loading");
      return vocabularySetService.listAdminSystemSets();
    }).then((data) => { if (active) { setSets(data); setState("ready"); } }, () => { if (active) setState("error"); });
    return () => { active = false; };
  }, [reload]);

  const visible = useMemo(() => filterSets(sets, query), [query, sets]);
  const retry = () => setReload((value) => value + 1);

  async function open(set, mode) {
    if (pending) return;
    setPending("detail");
    setFeedback(null);
    try {
      const aggregate = await vocabularySetService.getAdminSystemSet(set.id);
      setSelected(aggregate);
      if (mode === "edit") setEditor({ mode, aggregate });
    } catch (error) { setFeedback({ type: "error", message: messageFor(error, "Không thể tải chi tiết bộ từ hệ thống.") }); }
    finally { setPending(null); }
  }

  async function save(input) {
    const editing = editor?.mode === "edit";
    setPending("save"); setFeedback(null);
    try {
      const saved = editing ? await vocabularySetService.updateAdminSystemSet(editor.aggregate.id, input) : await vocabularySetService.createAdminSystemSet(input);
      setSets((current) => upsert(current, saved));
      setSelected(saved); setEditor(null);
      setFeedback({ type: "success", message: editing ? "Đã cập nhật bộ từ hệ thống." : "Đã tạo bộ từ hệ thống." });
      return true;
    } catch (error) { setFeedback({ type: "error", message: messageFor(error, "Không thể lưu bộ từ hệ thống. Vui lòng thử lại.") }); return false; }
    finally { setPending(null); }
  }

  async function remove() {
    if (!deleting || pending) return;
    setPending("delete"); setFeedback(null);
    try {
      await vocabularySetService.deleteAdminSystemSet(deleting.id);
      setSets((current) => current.filter((set) => set.id !== deleting.id));
      if (selected?.id === deleting.id) setSelected(null);
      setDeleting(null); setFeedback({ type: "success", message: "Đã xóa bộ từ hệ thống." });
    } catch (error) { setFeedback({ type: "error", message: messageFor(error, "Không thể xóa bộ từ hệ thống. Vui lòng thử lại.") }); }
    finally { setPending(null); }
  }

  return <section className="my-vocabulary-sets-page" aria-labelledby="admin-vocabulary-sets-title"><header className="my-vocabulary-sets-header"><div><p className="my-vocabulary-sets-eyebrow">Quản trị nội dung</p><h1 id="admin-vocabulary-sets-title">Quản lý bộ từ hệ thống</h1><p>Tạo và duy trì các bộ từ công khai theo chủ đề.</p></div><button className="my-vocabulary-sets-primary" type="button" disabled={pending !== null} onClick={() => { setSelected(null); setEditor({ mode: "create", aggregate: EMPTY_SYSTEM_SET }); setFeedback(null); }}><Plus className="size-5" aria-hidden="true" />Tạo bộ từ</button></header>
    {feedback ? <p className={`my-vocabulary-sets-feedback is-${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"} aria-live="polite">{feedback.message}</p> : null}
    {editor ? <VocabularySetEditor aggregate={editor.aggregate} mode={editor.mode} requireItems pending={pending === "save"} onCancel={() => setEditor(null)} onSave={save} /> : null}
    {selected ? <SystemSetDetail aggregate={selected} pending={pending !== null} onClose={() => setSelected(null)} onEdit={() => setEditor({ mode: "edit", aggregate: selected })} onDelete={() => setDeleting(selected)} /> : null}
    <section className="my-vocabulary-sets-list" aria-labelledby="admin-vocabulary-set-list-title"><div className="my-vocabulary-sets-toolbar"><h2 id="admin-vocabulary-set-list-title">Danh sách bộ từ hệ thống</h2><label className="my-vocabulary-sets-search"><span className="sr-only">Tìm kiếm bộ từ hệ thống</span><Search className="size-5" aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên hoặc mô tả" autoComplete="off" /></label></div>
      {state === "loading" ? <State loading message="Đang tải bộ từ hệ thống…" /> : null}
      {state === "error" ? <State role="alert" title="Không thể tải bộ từ hệ thống" message="Vui lòng thử lại." action={<button type="button" onClick={retry}>Thử lại</button>} /> : null}
      {state === "ready" && sets.length === 0 ? <State title="Chưa có bộ từ hệ thống" message="Tạo bộ từ hệ thống đầu tiên để công khai theo chủ đề." /> : null}
      {state === "ready" && sets.length > 0 && visible.length === 0 ? <State title="Không có kết quả" message="Hãy thử từ khóa khác." /> : null}
      {state === "ready" && visible.length > 0 ? <div className="admin-topic-table-wrap"><table className="admin-topic-table"><caption className="sr-only">Danh sách bộ từ hệ thống</caption><thead><tr><th scope="col">Bộ từ</th><th scope="col">Số từ</th><th scope="col"><span className="sr-only">Hành động</span></th></tr></thead><tbody>{visible.map((set) => <tr key={set.id}><th scope="row"><strong>{set.name}</strong><span className="my-vocabulary-set-table-description">{set.description || "Chưa có mô tả."}</span></th><td>{set.item_count}</td><td><div className="admin-topic-actions"><button type="button" disabled={pending !== null} onClick={() => void open(set, "view")} aria-label={`Xem ${set.name}`}>Xem</button><button type="button" disabled={pending !== null} onClick={() => void open(set, "edit")} aria-label={`Sửa ${set.name}`}>Sửa</button><button type="button" className="is-danger" disabled={pending !== null} onClick={() => setDeleting(set)} aria-label={`Xóa ${set.name}`}>Xóa</button></div></td></tr>)}</tbody></table></div> : null}
    </section>{deleting ? <DeleteSystemDialog aggregate={deleting} pending={pending === "delete"} onCancel={() => setDeleting(null)} onConfirm={() => void remove()} /> : null}</section>;
}

function SystemSetDetail({ aggregate, onClose, onDelete, onEdit, pending }) { const items = [...aggregate.items].sort((left, right) => left.position - right.position); return <section className="my-vocabulary-set-detail" aria-labelledby="admin-vocabulary-set-detail-title"><div className="my-vocabulary-set-detail-heading"><div><p>Hệ thống · Công khai</p><h2 id="admin-vocabulary-set-detail-title">{aggregate.name}</h2></div><button type="button" onClick={onClose} aria-label="Đóng chi tiết bộ từ"><X className="size-5" aria-hidden="true" /></button></div><p>{aggregate.description || "Chưa có mô tả."}</p><p className="my-vocabulary-set-detail-count"><BookOpen className="size-4" aria-hidden="true" />{items.length} từ vựng theo thứ tự đã chọn</p><ol>{items.map((item) => <li key={item.id}><strong>{item.word}</strong>{item.phonetic ? <span>{item.phonetic}</span> : null}</li>)}</ol><div className="my-vocabulary-set-actions"><button type="button" onClick={onEdit} disabled={pending}>Chỉnh sửa</button><button type="button" className="is-danger" onClick={onDelete} disabled={pending}>Xóa bộ từ</button></div></section>; }
function DeleteSystemDialog({ aggregate, onCancel, onConfirm, pending }) { return <div className="my-vocabulary-set-dialog-backdrop"><section className="my-vocabulary-set-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-system-set-title"><h2 id="delete-system-set-title">Xóa bộ từ hệ thống?</h2><p>Bạn sẽ xóa <strong>{aggregate.name}</strong> khỏi danh sách công khai. Hành động không thể hoàn tác.</p><div><button type="button" autoFocus disabled={pending} onClick={onCancel}>Hủy</button><button type="button" className="is-danger" disabled={pending} aria-busy={pending} onClick={onConfirm}>{pending ? "Đang xóa…" : "Xác nhận xóa"}</button></div></section></div>; }
function State({ action, loading, message, role, title }) { return <div className="my-vocabulary-set-state" role={loading ? "status" : role} aria-live={loading ? "polite" : undefined}>{title ? <h2>{title}</h2> : null}<p>{message}</p>{action}</div>; }
function filterSets(sets, query) { const normalized = query.trim().toLocaleLowerCase(); return normalized ? sets.filter((set) => [set.name, set.description].filter((value) => typeof value === "string").some((value) => value.toLocaleLowerCase().includes(normalized))) : sets; }
function upsert(sets, aggregate) { const summary = { ...aggregate, item_count: aggregate.items?.length ?? 0 }; delete summary.items; const index = sets.findIndex((set) => set.id === summary.id); return index === -1 ? [summary, ...sets] : sets.map((set) => set.id === summary.id ? summary : set); }
function messageFor(error, fallback) { const messages = { VOCABULARY_SET_NOT_FOUND: "Bộ từ không còn khả dụng.", TOPIC_NOT_FOUND: "Chủ đề đã chọn không còn khả dụng.", VOCABULARY_NOT_FOUND: "Có từ vựng đã chọn không còn khả dụng.", VALIDATION_ERROR: "Dữ liệu bộ từ không hợp lệ.", AUTHENTICATION_FAILED: "Phiên đăng nhập không còn hợp lệ.", FORBIDDEN: "Bạn không có quyền thực hiện hành động này." }; return messages[error?.code] ?? (error instanceof VocabularySetApiError && error.kind === "operational" ? "Không thể kết nối dịch vụ. Vui lòng thử lại." : fallback); }
