import { ArrowDown, ArrowRight, ArrowUp, BookOpen, FolderHeart, LoaderCircle, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { topicService } from "../services/topic-service.js";
import { vocabularyService } from "../services/vocabulary-service.js";
import { VocabularySetApiError, vocabularySetService } from "../services/vocabulary-set-service.js";
import { createPrivateVocabularyAction, createPrivateVocabularySubmitter } from "./private-vocabulary-action.js";
import { PrivateVocabularyEditor } from "./private-vocabulary-editor.jsx";

const EMPTY_SET = { name: "", description: "", items: [] };

export function MyVocabularySetsPage() {
  const { setId } = useParams();
  const navigate = useNavigate();
  const [sets, setSets] = useState([]);
  const [listState, setListState] = useState("loading");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("server");
  const [editor, setEditor] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailState, setDetailState] = useState("idle");
  const [feedback, setFeedback] = useState(null);
  const [pending, setPending] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) setListState("loading");
      return vocabularySetService.listMySets();
    }).then(
      (data) => { if (active) { setSets(data); setListState("ready"); } },
      () => { if (active) setListState("error"); },
    );
    return () => { active = false; };
  }, [reload]);

  useEffect(() => {
    if (!setId) return undefined;
    let active = true;
    void Promise.resolve().then(() => {
      if (active) setDetailState("loading");
      return vocabularySetService.getMySet(setId);
    }).then(
      (data) => { if (active) { setDetail(data); setDetailState("ready"); } },
      () => { if (active) setDetailState("error"); },
    );
    return () => { active = false; };
  }, [reload, setId]);

  const visibleSets = useMemo(() => sortSets(filterSets(sets, query), sort), [query, sets, sort]);

  function retry() { setReload((value) => value + 1); }

  function openCreate() {
    setFeedback(null);
    setEditor({ mode: "create", aggregate: EMPTY_SET });
  }

  async function openEdit() {
    if (!detail || pending) return;
    setPending("detail");
    setFeedback(null);
    try {
      // Reload the complete aggregate before every edit so the replacement payload is current.
      const current = await vocabularySetService.getMySet(detail.id);
      setDetail(current);
      setEditor({ mode: "edit", aggregate: current });
    } catch (error) {
      setFeedback({ type: "error", message: errorMessage(error, "Không thể tải bộ từ để chỉnh sửa.") });
    } finally { setPending(null); }
  }

  async function saveSet(input) {
    const editing = editor?.mode === "edit";
    setPending("save");
    setFeedback(null);
    try {
      const saved = editing
        ? await vocabularySetService.updateMySet(editor.aggregate.id, input)
        : await vocabularySetService.createMySet(input);
      setSets((current) => upsertSummary(current, saved));
      setDetail(saved);
      setEditor(null);
      setFeedback({ type: "success", message: editing ? "Đã cập nhật bộ từ." : "Đã tạo bộ từ riêng tư." });
      navigate(`/my/vocabulary-sets/${saved.id}`);
      return true;
    } catch (error) {
      setFeedback({ type: "error", message: errorMessage(error, "Không thể lưu bộ từ. Vui lòng thử lại.") });
      return false;
    } finally { setPending(null); }
  }

  async function confirmDelete() {
    if (!deleteTarget || pending) return;
    setPending("delete");
    setFeedback(null);
    try {
      await vocabularySetService.deleteMySet(deleteTarget.id);
      setSets((current) => current.filter((set) => set.id !== deleteTarget.id));
      setDeleteTarget(null);
      setDetail(null);
      setFeedback({ type: "success", message: "Đã xóa bộ từ riêng tư." });
      navigate("/my/vocabulary-sets");
    } catch (error) {
      setFeedback({ type: "error", message: errorMessage(error, "Không thể xóa bộ từ. Vui lòng thử lại.") });
    } finally { setPending(null); }
  }

  return (
    <section className="my-vocabulary-sets-page" aria-labelledby="my-vocabulary-sets-title">
      <header className="my-vocabulary-sets-header">
        <div><h1 id="my-vocabulary-sets-title">Bộ từ của tôi</h1><p>Quản lý và tiếp tục học các bộ từ bạn đã tạo.</p></div>
        <button className="my-vocabulary-sets-primary" type="button" onClick={openCreate} disabled={pending !== null}><Plus className="size-5" aria-hidden="true" />Tạo bộ từ</button>
      </header>

      {feedback ? <p className={`my-vocabulary-sets-feedback is-${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"} aria-live="polite">{feedback.message}</p> : null}
      {editor ? <VocabularySetEditor aggregate={editor.aggregate} mode={editor.mode} pending={pending === "save"} onCancel={() => setEditor(null)} onSave={saveSet} onSetChanged={retry} /> : null}
      {setId ? <MySetDetail detail={detail} state={detailState} pending={pending !== null} onClose={() => navigate("/my/vocabulary-sets")} onEdit={() => void openEdit()} onDelete={() => setDeleteTarget(detail)} onRetry={retry} /> : null}

      <section className="my-vocabulary-sets-list" aria-labelledby="my-vocabulary-sets-list-title">
        <div className="my-vocabulary-sets-toolbar">
          <div><h2 id="my-vocabulary-sets-list-title">Danh sách bộ từ</h2>{listState === "ready" && sets.length > 0 ? <p>{sets.length} bộ từ trong thư viện</p> : null}</div>
          <div className="my-vocabulary-sets-controls">
            <label className="my-vocabulary-sets-search"><span className="sr-only">Tìm bộ từ</span><Search className="size-5" aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm bộ từ..." autoComplete="off" /></label>
            <label className="my-vocabulary-sets-sort"><span className="sr-only">Sắp xếp bộ từ</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="server">Mặc định</option><option value="name-asc">Tên A–Z</option><option value="name-desc">Tên Z–A</option><option value="count-asc">Số từ tăng dần</option><option value="count-desc">Số từ giảm dần</option></select></label>
          </div>
        </div>
        {listState === "loading" ? <MySetSkeleton /> : null}
        {listState === "error" ? <MyState role="alert" title="Không thể tải bộ từ" message="Vui lòng thử lại." action={<button type="button" onClick={retry}>Thử lại</button>} /> : null}
        {listState === "ready" && sets.length === 0 ? <MyState visual title="Bạn chưa có bộ từ nào" message="Tạo bộ từ đầu tiên để xây dựng thư viện học tập của riêng bạn." action={<><button type="button" aria-label="Tạo bộ từ đầu tiên" onClick={openCreate}><Plus aria-hidden="true" />Tạo bộ từ</button><Link to="/topics">Khám phá bộ từ</Link></>} /> : null}
        {listState === "ready" && sets.length > 0 && visibleSets.length === 0 ? <MyState title="Không tìm thấy bộ từ phù hợp" message="Thử một từ khóa khác hoặc xóa nội dung tìm kiếm." action={<button type="button" onClick={() => setQuery("")}>Xóa tìm kiếm</button>} /> : null}
        {listState === "ready" && visibleSets.length > 0 ? <ul className="my-vocabulary-sets-grid" aria-label="Các bộ từ của tôi">{visibleSets.map((set, index) => <MySetCard key={set.id} set={set} accent={index % 3} />)}</ul> : null}
      </section>

      {deleteTarget ? <DeleteDialog set={deleteTarget} pending={pending === "delete"} onCancel={() => setDeleteTarget(null)} onConfirm={() => void confirmDelete()} /> : null}
    </section>
  );
}

function MySetDetail({ detail, onClose, onDelete, onEdit, onRetry, pending, state }) {
  if (state === "loading") return <MyState loading message="Đang tải chi tiết bộ từ…" />;
  if (state === "error") return <MyState role="alert" title="Không thể tải bộ từ" message="Bộ từ có thể không còn khả dụng." action={<><button type="button" onClick={onRetry}>Thử lại</button><button type="button" onClick={onClose}>Đóng</button></>} />;
  if (!detail) return null;
  const items = [...detail.items].sort((left, right) => left.position - right.position);
  return <section className="my-vocabulary-set-detail" aria-labelledby="my-vocabulary-set-detail-title"><div className="my-vocabulary-set-detail-heading"><div><p>Riêng tư</p><h2 id="my-vocabulary-set-detail-title">{detail.name}</h2></div><button type="button" aria-label="Đóng chi tiết bộ từ" onClick={onClose}><X className="size-5" aria-hidden="true" /></button></div><p>{detail.description || "Chưa có mô tả."}</p><p className="my-vocabulary-set-detail-count"><BookOpen className="size-4" aria-hidden="true" />{items.length} từ vựng theo thứ tự đã chọn</p><ol>{items.map((item) => <li key={item.id}><strong>{item.word}</strong>{item.phonetic ? <span>{item.phonetic}</span> : null}</li>)}</ol><div className="my-vocabulary-set-actions">{items.length > 0 ? <><Link to={`/learn/vocabulary-sets/${detail.id}`} state={{ returnTo: `/my/vocabulary-sets/${detail.id}` }}>Học bộ từ</Link><Link to={`/quiz/vocabulary-sets/${detail.id}`} state={{ returnTo: `/my/vocabulary-sets/${detail.id}`, setName: detail.name }}>Làm Quiz</Link></> : null}<button type="button" onClick={onEdit} disabled={pending}>Chỉnh sửa</button><button type="button" className="is-danger" onClick={onDelete} disabled={pending}>Xóa bộ từ</button></div></section>;
}

export function VocabularySetEditor({ aggregate, mode, onCancel, onSave, onSetChanged, pending, requireItems = false }) {
  const [values, setValues] = useState(() => formValues(aggregate));
  const [topics, setTopics] = useState([]);
  const [topicState, setTopicState] = useState(requireItems ? "loading" : "ready");
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerItems, setPickerItems] = useState([]);
  const [pickerState, setPickerState] = useState("idle");
  const [errors, setErrors] = useState({});
  const [privateEditor, setPrivateEditor] = useState(null);
  const [privatePending, setPrivatePending] = useState(false);
  const [privateError, setPrivateError] = useState(null);
  const privateSubmit = useMemo(() => createPrivateVocabularySubmitter(vocabularySetService), []);

  useEffect(() => {
    if (!requireItems) return undefined;
    let active = true;
    topicService.listTopics().then((data) => { if (active) { setTopics(data); setTopicState("ready"); } }, () => { if (active) setTopicState("error"); });
    return () => { active = false; };
  }, [requireItems]);

  function update(field, value) { setValues((current) => ({ ...current, [field]: value })); }
  function moveItem(index, direction) { setValues((current) => { const next = [...current.items]; const target = index + direction; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; return { ...current, items: next }; }); }
  function addItem(item) { if (values.items.some((current) => current.vocabulary_id === item.id)) return; setValues((current) => ({ ...current, items: [...current.items, { vocabulary_id: item.id, word: item.word, phonetic: item.phonetic ?? null, source: item.source, primary_meaning: item.primary_meaning ?? null }] })); }
  function removeItem(index) { setValues((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) })); }
  async function searchPicker(event) { event.preventDefault(); const query = pickerQuery.trim(); if (!query) { setPickerState("validation"); return; } setPickerState("loading"); try { setPickerItems(await vocabularySetService.searchVocabularyPicker(query)); setPickerState("ready"); } catch { setPickerState("error"); } }
  async function submit(event) { event.preventDefault(); const nextErrors = validateSet(values, requireItems); setErrors(nextErrors); if (Object.keys(nextErrors).length) return; await onSave(serializeSet(values, requireItems)); }

  function openPrivateCreate() {
    if (!aggregate.id) return;
    const initial = { word: pickerQuery.trim(), phonetic: "", meanings: [] };
    setPrivateError(null);
    setPrivateEditor({ mode: "create", initial, action: createPrivateVocabularyAction(initial) });
  }
  async function openPrivateEdit(item) {
    setPrivatePending(true);
    setPrivateError(null);
    try {
      const vocabulary = await vocabularyService.getPrivateVocabulary(item.id ?? item.vocabulary_id);
      setPrivateEditor({ mode: "edit", id: vocabulary.id, initial: vocabulary });
    } catch (error) { setPrivateError(privateErrorMessage(error)); }
    finally { setPrivatePending(false); }
  }
  async function savePrivateVocabulary(input) {
    if (!privateEditor) return;
    setPrivatePending(true);
    setPrivateError(null);
    try {
      if (privateEditor.mode === "create") {
        privateEditor.action.prepare(input);
        const result = await privateSubmit(aggregate.id, privateEditor.action);
        const item = { id: result.vocabulary.id, word: result.vocabulary.word, phonetic: result.vocabulary.phonetic ?? null, source: "PRIVATE", editable: true, primary_meaning: result.vocabulary.meanings?.[0] ?? null };
        setValues((current) => current.items.some(({ vocabulary_id }) => vocabulary_id === item.id) ? current : { ...current, items: [...current.items, { ...item, vocabulary_id: item.id }] });
        setPickerItems((current) => current.some(({ id }) => id === item.id) ? current : [...current, item]);
        onSetChanged?.();
      } else {
        const updated = await vocabularyService.updatePrivateVocabulary(privateEditor.id, input);
        setValues((current) => ({ ...current, items: current.items.map((item) => item.vocabulary_id === updated.id ? { ...item, word: updated.word, phonetic: updated.phonetic ?? null } : item) }));
        setPickerItems((current) => current.map((item) => item.id === updated.id ? { ...item, word: updated.word, phonetic: updated.phonetic ?? null, primary_meaning: updated.meanings?.[0] ?? null } : item));
      }
      setPrivateEditor(null);
    } catch (error) { setPrivateError(privateErrorMessage(error)); }
    finally { setPrivatePending(false); }
  }

  return <section className="my-vocabulary-set-editor" aria-labelledby="my-vocabulary-set-editor-title"><div className="my-vocabulary-set-editor-heading"><h2 id="my-vocabulary-set-editor-title">{mode === "create" ? requireItems ? "Tạo bộ từ hệ thống" : "Tạo bộ từ riêng" : `Chỉnh sửa ${aggregate.name}`}</h2><button type="button" aria-label="Đóng biểu mẫu bộ từ" onClick={onCancel} disabled={pending}><X className="size-5" aria-hidden="true" /></button></div><form noValidate onSubmit={submit}><div className="my-vocabulary-set-form-grid"><label htmlFor="my-set-name">Tên bộ từ<input id="my-set-name" value={values.name} onChange={(event) => update("name", event.target.value)} maxLength={101} disabled={pending} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "my-set-name-error" : undefined} /></label>{errors.name ? <FieldError id="my-set-name-error" message={errors.name} /> : null}{requireItems ? <><label htmlFor="my-set-topic">Chủ đề<select id="my-set-topic" value={values.topic_id} onChange={(event) => update("topic_id", event.target.value)} disabled={pending || topicState !== "ready"} aria-invalid={Boolean(errors.topic_id)} aria-describedby={errors.topic_id ? "my-set-topic-error" : undefined}><option value="">{topicState === "loading" ? "Đang tải chủ đề…" : "Chọn chủ đề"}</option>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label>{topicState === "error" ? <FieldError message="Không thể tải danh sách chủ đề. Hãy đóng biểu mẫu và thử lại." /> : null}{errors.topic_id ? <FieldError id="my-set-topic-error" message={errors.topic_id} /> : null}</> : null}<label className="my-vocabulary-set-form-wide" htmlFor="my-set-description">Mô tả <span>(không bắt buộc)</span><textarea id="my-set-description" value={values.description} onChange={(event) => update("description", event.target.value)} maxLength={501} rows={3} disabled={pending} aria-invalid={Boolean(errors.description)} /></label>{errors.description ? <FieldError message={errors.description} /> : null}</div>
    <fieldset className="my-vocabulary-set-items-editor"><legend>Danh sách từ vựng theo thứ tự</legend><p>Danh sách này là nội dung đầy đủ sẽ được lưu cho bộ từ. {requireItems ? "Bộ từ hệ thống cần ít nhất một từ vựng." : "Bạn có thể để trống bộ từ riêng tư."}</p>{errors.items ? <FieldError message={errors.items} /> : null}<ol>{values.items.map((item, index) => <li key={item.vocabulary_id}><div><strong>{item.word}</strong>{item.phonetic ? <span>{item.phonetic}</span> : null}</div><div className="my-vocabulary-set-item-controls">{item.source === "PRIVATE" ? <button type="button" onClick={() => void openPrivateEdit(item)} disabled={pending || privatePending}>Sửa</button> : null}<button type="button" onClick={() => moveItem(index, -1)} disabled={pending || index === 0} aria-label={`Đưa ${item.word} lên`}><ArrowUp className="size-4" aria-hidden="true" /></button><button type="button" onClick={() => moveItem(index, 1)} disabled={pending || index === values.items.length - 1} aria-label={`Đưa ${item.word} xuống`}><ArrowDown className="size-4" aria-hidden="true" /></button><button type="button" onClick={() => removeItem(index)} disabled={pending} aria-label={`Xóa ${item.word} khỏi bộ từ`}><Trash2 className="size-4" aria-hidden="true" /></button></div></li>)}</ol></fieldset>
    <fieldset className="my-vocabulary-picker"><legend>Thêm từ vựng</legend><p>Tìm từ hệ thống hoặc từ của bạn để tái sử dụng. Bạn vẫn có thể tạo một từ mới dù có kết quả trùng từ.</p><div><label htmlFor="my-set-vocabulary-query">Từ khóa<input id="my-set-vocabulary-query" type="search" value={pickerQuery} onChange={(event) => setPickerQuery(event.target.value)} disabled={pending || privatePending} autoComplete="off" /></label><button type="button" onClick={searchPicker} disabled={pending || privatePending || pickerState === "loading"}>{pickerState === "loading" ? "Đang tìm…" : "Tìm từ"}</button></div>{pickerState === "validation" ? <FieldError message="Nhập từ khóa trước khi tìm." /> : null}{pickerState === "error" ? <FieldError message="Không thể tìm từ vựng. Vui lòng thử lại." /> : null}{privateError && !privateEditor ? <FieldError message={privateError} /> : null}{pickerState === "ready" && pickerItems.length === 0 ? <p role="status">Không tìm thấy từ phù hợp. Bạn có thể tạo từ mới.</p> : null}{pickerState === "ready" && pickerItems.length > 0 ? <ul>{pickerItems.map((item) => { const added = values.items.some((current) => current.vocabulary_id === item.id); return <li key={item.id} className="my-vocabulary-picker-result"><div><strong>{item.word}</strong><span>{item.primary_meaning ? `${item.primary_meaning.part_of_speech} · ${item.primary_meaning.meaning_vi}` : "Chưa có nghĩa chính"}</span><small>{item.source === "CANONICAL" ? "Hệ thống" : "Của tôi"}</small></div><div><button type="button" onClick={() => addItem(item)} disabled={pending || privatePending || added}>{added ? "Đã thêm" : "Thêm"}</button>{item.editable ? <button type="button" onClick={() => void openPrivateEdit(item)} disabled={pending || privatePending}>Chỉnh sửa</button> : null}</div></li>; })}</ul> : null}{aggregate.id && !requireItems ? <div className="private-vocabulary-create-entry"><p>{pickerItems.length === 0 && pickerState === "ready" ? "Không có kết quả phù hợp?" : "Muốn tạo một nghĩa riêng khác?"}</p><button type="button" onClick={openPrivateCreate} disabled={pending || privatePending}>Tạo từ mới</button></div> : null}</fieldset>
    <div className="my-vocabulary-set-form-actions"><button type="button" onClick={onCancel} disabled={pending || privatePending}>Hủy</button><button className="my-vocabulary-sets-primary" type="submit" disabled={pending || privatePending || (requireItems && topicState !== "ready")} aria-busy={pending}>{pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}{pending ? "Đang lưu…" : "Lưu bộ từ"}</button></div></form>{privateEditor ? <PrivateVocabularyEditor error={privateError} initialValue={privateEditor.initial} mode={privateEditor.mode} pending={privatePending} onCancel={() => { if (!privatePending) { setPrivateEditor(null); setPrivateError(null); } }} onSubmit={savePrivateVocabulary} /> : null}</section>;
}

function DeleteDialog({ onCancel, onConfirm, pending, set }) { return <div className="my-vocabulary-set-dialog-backdrop"><section className="my-vocabulary-set-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-my-set-title"><h2 id="delete-my-set-title">Xóa bộ từ?</h2><p>Bạn sẽ xóa <strong>{set.name}</strong> và danh sách từ của bộ này. Hành động không thể hoàn tác.</p><div><button type="button" onClick={onCancel} disabled={pending} autoFocus>Hủy</button><button type="button" className="is-danger" onClick={onConfirm} disabled={pending} aria-busy={pending}>{pending ? "Đang xóa…" : "Xác nhận xóa"}</button></div></section></div>; }
function MySetCard({ accent, set }) {
  const canLearn = set.item_count > 0;
  return <li><article className={`my-vocabulary-set-card accent-${accent}`}><div className="my-vocabulary-set-card-art" aria-hidden="true"><BookOpen /></div><div className="my-vocabulary-set-card-body"><p className="my-vocabulary-set-count">{set.item_count} từ vựng</p><h3>{set.name}</h3><p className="my-vocabulary-set-description">{set.description || "Chưa có mô tả."}</p></div><div className="my-vocabulary-set-card-actions">{canLearn ? <Link className="my-vocabulary-set-learn" to={`/learn/vocabulary-sets/${set.id}`} state={{ returnTo: "/my/vocabulary-sets" }}>Học<ArrowRight aria-hidden="true" /></Link> : <span className="my-vocabulary-set-empty-label">Chưa có từ để học</span>}<Link className="my-vocabulary-set-detail-link" to={`/my/vocabulary-sets/${set.id}`} aria-label={`Xem chi tiết ${set.name}`}>Chi tiết</Link></div></article></li>;
}

function MySetSkeleton() {
  return <div className="my-vocabulary-set-skeleton" role="status" aria-label="Đang tải bộ từ của bạn"><span className="sr-only">Đang tải bộ từ của bạn…</span>{[0, 1, 2].map((item) => <div key={item} aria-hidden="true"><span /><span /><span /></div>)}</div>;
}

function MyState({ action, loading, message, role, title, visual = false }) { return <div className={`my-vocabulary-set-state${visual ? " is-visual" : ""}`} role={loading ? "status" : role} aria-live={loading ? "polite" : undefined}>{loading ? <LoaderCircle className="size-6 animate-spin" aria-hidden="true" /> : null}{visual ? <span className="my-vocabulary-set-state-visual" aria-hidden="true"><FolderHeart /></span> : null}{title ? <h2>{title}</h2> : null}<p>{message}</p>{action ? <div className="my-vocabulary-set-state-actions">{action}</div> : null}</div>; }
function FieldError({ id, message }) { return <p id={id} className="my-vocabulary-set-field-error" role="alert">{message}</p>; }
function formValues(aggregate) { return { topic_id: aggregate.topic_id ?? "", name: aggregate.name ?? "", description: aggregate.description ?? "", items: (aggregate.items ?? []).slice().sort((left, right) => left.position - right.position).map((item) => ({ vocabulary_id: item.vocabulary_id, word: item.word, phonetic: item.phonetic ?? null, source: item.source })) }; }
function serializeSet(values, requireTopic) { return { ...(requireTopic ? { topic_id: values.topic_id } : {}), name: values.name.trim(), description: values.description.trim() || null, items: values.items.map((item) => ({ vocabulary_id: item.vocabulary_id })) }; }
function validateSet(values, requireItems) { const errors = {}; if (!values.name.trim()) errors.name = "Tên bộ từ là bắt buộc."; else if (values.name.trim().length > 100) errors.name = "Tên bộ từ không được quá 100 ký tự."; if (requireItems && !values.topic_id) errors.topic_id = "Hãy chọn một chủ đề."; if (values.description.length > 500) errors.description = "Mô tả không được quá 500 ký tự."; if (requireItems && values.items.length === 0) errors.items = "Bộ từ hệ thống cần ít nhất một từ vựng."; return errors; }
function filterSets(sets, query) { const normalized = query.trim().toLocaleLowerCase(); if (!normalized) return sets; return sets.filter((set) => [set.name, set.description].filter((value) => typeof value === "string").some((value) => value.toLocaleLowerCase().includes(normalized))); }
function sortSets(sets, sort) {
  if (sort === "server") return sets;
  const sorted = [...sets];
  if (sort === "name-asc" || sort === "name-desc") sorted.sort((left, right) => left.name.localeCompare(right.name, "vi", { sensitivity: "base" }) * (sort === "name-asc" ? 1 : -1));
  if (sort === "count-asc" || sort === "count-desc") sorted.sort((left, right) => (left.item_count - right.item_count) * (sort === "count-asc" ? 1 : -1));
  return sorted;
}
function upsertSummary(sets, aggregate) { const summary = { ...aggregate, item_count: aggregate.items?.length ?? 0 }; delete summary.items; const index = sets.findIndex((set) => set.id === summary.id); return index === -1 ? [summary, ...sets] : sets.map((set) => set.id === summary.id ? summary : set); }
function errorMessage(error, fallback) { const messages = { VOCABULARY_SET_NOT_FOUND: "Bộ từ không còn khả dụng.", TOPIC_NOT_FOUND: "Chủ đề đã chọn không còn khả dụng.", VOCABULARY_NOT_FOUND: "Có từ vựng đã chọn không còn khả dụng.", VALIDATION_ERROR: "Dữ liệu bộ từ không hợp lệ.", AUTHENTICATION_FAILED: "Phiên đăng nhập không còn hợp lệ.", FORBIDDEN: "Bạn không có quyền thực hiện hành động này." }; return messages[error?.code] ?? (error instanceof VocabularySetApiError && error.kind === "operational" ? "Không thể kết nối dịch vụ. Vui lòng thử lại." : fallback); }
function privateErrorMessage(error) { const messages = { VALIDATION_ERROR: "Dữ liệu từ vựng chưa hợp lệ. Hãy kiểm tra lại các trường bắt buộc.", VOCABULARY_SET_NOT_FOUND: "Bộ từ không còn khả dụng.", VOCABULARY_NOT_FOUND: "Từ vựng không còn khả dụng.", AUTHENTICATION_FAILED: "Phiên đăng nhập không còn hợp lệ.", FORBIDDEN: "Bạn không có quyền thực hiện hành động này.", PRIVATE_VOCABULARY_OPERATION_CONFLICT: "Yêu cầu tạo từ đã thay đổi. Hãy hủy và bắt đầu một lần tạo mới." }; return messages[error?.code] ?? "Chưa thể lưu từ vựng. Bạn có thể thử lại an toàn."; }
