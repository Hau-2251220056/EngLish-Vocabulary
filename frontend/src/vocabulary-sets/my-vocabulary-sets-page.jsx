import { ArrowDown, ArrowRight, ArrowUp, BookOpen, FolderHeart, LoaderCircle, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { topicService } from "../services/topic-service.js";
import { VocabularySetApiError, vocabularySetService } from "../services/vocabulary-set-service.js";

const EMPTY_SET = { name: "", description: "", items: [] };

export function MyVocabularySetsPage() {
  const { setId } = useParams();
  const navigate = useNavigate();
  const [sets, setSets] = useState([]);
  const [listState, setListState] = useState("loading");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("server");
  const [editor, setEditor] = useState(null);
  const [editorError, setEditorError] = useState(null);
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
    setEditorError(null);
    setEditor({ mode: "create", aggregate: EMPTY_SET });
  }

  async function openEdit() {
    if (!detail || pending) return;
    setPending("detail");
    setFeedback(null);
    try {
      // Reload before editing so the modal always starts from authoritative metadata.
      const current = await vocabularySetService.getMySet(detail.id);
      setDetail(current);
      setEditorError(null);
      setEditor({ mode: "edit", aggregate: current });
    } catch (error) {
      setFeedback({ type: "error", message: errorMessage(error, "Không thể tải bộ từ để chỉnh sửa.") });
    } finally { setPending(null); }
  }

  async function saveSet(input) {
    const editing = editor?.mode === "edit";
    setPending("save");
    setEditorError(null);
    try {
      const saved = editing
        ? await vocabularySetService.updateMySet(editor.aggregate.id, input)
        : await vocabularySetService.createMySet(input);
      setSets((current) => upsertSummary(current, saved));
      setDetail(saved);
      setEditor(null);
      setEditorError(null);
      setFeedback({ type: "success", message: editing ? "Đã cập nhật bộ từ." : "Đã tạo bộ từ riêng tư." });
      navigate(`/my/vocabulary-sets/${saved.id}`);
      return true;
    } catch (error) {
      setEditorError(errorMessage(error, "Không thể lưu bộ từ. Vui lòng thử lại."));
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
      {editor ? <PersonalVocabularySetModal aggregate={editor.aggregate} error={editorError} mode={editor.mode} pending={pending === "save"} onCancel={() => { setEditor(null); setEditorError(null); }} onSave={saveSet} /> : null}
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

function PersonalVocabularySetModal({ aggregate, error, mode, onCancel, onSave, pending }) {
  const dialogRef = useRef(null);
  const nameRef = useRef(null);
  const returnFocusRef = useRef(null);
  const [values, setValues] = useState(() => personalSetFormValues(aggregate));
  const [errors, setErrors] = useState({});
  const titleId = `personal-set-modal-title-${mode}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    returnFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    nameRef.current?.focus();
    return () => {
      if (dialog?.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus?.();
    };
  }, []);

  function closeWhenSafe() {
    if (!pending) onCancel();
  }

  function handleCancel(event) {
    event.preventDefault();
    closeWhenSafe();
  }

  function handleBackdrop(event) {
    if (event.target === dialogRef.current) closeWhenSafe();
  }

  async function submit(event) {
    event.preventDefault();
    if (pending) return;
    const nextErrors = validatePersonalSet(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    await onSave(serializePersonalSet(values));
  }

  return (
    <dialog ref={dialogRef} className="personal-vocabulary-set-modal" aria-labelledby={titleId} onCancel={handleCancel} onClick={handleBackdrop}>
      <div className="personal-vocabulary-set-modal-panel">
        <header>
          <div><h2 id={titleId}>{mode === "create" ? "Tạo bộ từ" : "Chỉnh sửa bộ từ"}</h2><p>{mode === "create" ? "Đặt tên cho bộ từ mới của bạn." : "Cập nhật tên và mô tả của bộ từ."}</p></div>
          <button type="button" aria-label="Đóng" onClick={closeWhenSafe} disabled={pending}><X aria-hidden="true" /></button>
        </header>
        <form noValidate onSubmit={submit}>
          {error ? <p className="personal-vocabulary-set-modal-error" role="alert">{error}</p> : null}
          <label htmlFor="personal-set-name">Tên bộ từ<input ref={nameRef} id="personal-set-name" value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} maxLength={101} disabled={pending} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "personal-set-name-error" : undefined} /></label>
          {errors.name ? <FieldError id="personal-set-name-error" message={errors.name} /> : null}
          <label htmlFor="personal-set-description">Mô tả <span>(không bắt buộc)</span><textarea id="personal-set-description" value={values.description} onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))} maxLength={501} rows={4} disabled={pending} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? "personal-set-description-error" : undefined} /></label>
          {errors.description ? <FieldError id="personal-set-description-error" message={errors.description} /> : null}
          <footer><button type="button" onClick={closeWhenSafe} disabled={pending}>Hủy</button><button className="my-vocabulary-sets-primary" type="submit" disabled={pending} aria-busy={pending}>{pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}{pending ? "Đang lưu…" : mode === "create" ? "Tạo bộ từ" : "Lưu thay đổi"}</button></footer>
        </form>
      </div>
    </dialog>
  );
}

function MySetDetail({ detail, onClose, onDelete, onEdit, onRetry, pending, state }) {
  if (state === "loading") return <MyState loading message="Đang tải chi tiết bộ từ…" />;
  if (state === "error") return <MyState role="alert" title="Không thể tải bộ từ" message="Bộ từ có thể không còn khả dụng." action={<><button type="button" onClick={onRetry}>Thử lại</button><button type="button" onClick={onClose}>Đóng</button></>} />;
  if (!detail) return null;
  const items = [...detail.items].sort((left, right) => left.position - right.position);
  return <section className="my-vocabulary-set-detail" aria-labelledby="my-vocabulary-set-detail-title"><div className="my-vocabulary-set-detail-heading"><div><p>Riêng tư</p><h2 id="my-vocabulary-set-detail-title">{detail.name}</h2></div><button type="button" aria-label="Đóng chi tiết bộ từ" onClick={onClose}><X className="size-5" aria-hidden="true" /></button></div><p>{detail.description || "Chưa có mô tả."}</p><p className="my-vocabulary-set-detail-count"><BookOpen className="size-4" aria-hidden="true" />{items.length} từ vựng theo thứ tự đã chọn</p><ol>{items.map((item) => <li key={item.id}><strong>{item.word}</strong>{item.phonetic ? <span>{item.phonetic}</span> : null}</li>)}</ol><div className="my-vocabulary-set-actions">{items.length > 0 ? <><Link to={`/learn/vocabulary-sets/${detail.id}`} state={{ returnTo: `/my/vocabulary-sets/${detail.id}` }}>Học bộ từ</Link><Link to={`/quiz/vocabulary-sets/${detail.id}`} state={{ returnTo: `/my/vocabulary-sets/${detail.id}`, setName: detail.name }}>Làm Quiz</Link></> : null}<button type="button" onClick={onEdit} disabled={pending}>Chỉnh sửa</button><button type="button" className="is-danger" onClick={onDelete} disabled={pending}>Xóa bộ từ</button></div></section>;
}

export function AdminVocabularySetEditor({ aggregate, mode, onCancel, onSave, pending }) {
  const [values, setValues] = useState(() => formValues(aggregate));
  const [topics, setTopics] = useState([]);
  const [topicState, setTopicState] = useState("loading");
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerItems, setPickerItems] = useState([]);
  const [pickerState, setPickerState] = useState("idle");
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let active = true;
    topicService.listTopics().then((data) => { if (active) { setTopics(data); setTopicState("ready"); } }, () => { if (active) setTopicState("error"); });
    return () => { active = false; };
  }, []);

  function update(field, value) { setValues((current) => ({ ...current, [field]: value })); }
  function moveItem(index, direction) { setValues((current) => { const next = [...current.items]; const target = index + direction; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; return { ...current, items: next }; }); }
  function addItem(item) { if (values.items.some((current) => current.vocabulary_id === item.id)) return; setValues((current) => ({ ...current, items: [...current.items, { vocabulary_id: item.id, word: item.word, phonetic: item.phonetic ?? null, source: item.source, primary_meaning: item.primary_meaning ?? null }] })); }
  function removeItem(index) { setValues((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) })); }
  async function searchPicker(event) { event.preventDefault(); const query = pickerQuery.trim(); if (!query) { setPickerState("validation"); return; } setPickerState("loading"); try { setPickerItems(await vocabularySetService.searchVocabularyPicker(query)); setPickerState("ready"); } catch { setPickerState("error"); } }
  async function submit(event) { event.preventDefault(); const nextErrors = validateSystemSet(values); setErrors(nextErrors); if (Object.keys(nextErrors).length) return; await onSave(serializeSystemSet(values)); }

  return (
    <section className="my-vocabulary-set-editor" aria-labelledby="my-vocabulary-set-editor-title">
      <div className="my-vocabulary-set-editor-heading">
        <h2 id="my-vocabulary-set-editor-title">{mode === "create" ? "Tạo bộ từ hệ thống" : `Chỉnh sửa ${aggregate.name}`}</h2>
        <button type="button" aria-label="Đóng biểu mẫu bộ từ" onClick={onCancel} disabled={pending}><X className="size-5" aria-hidden="true" /></button>
      </div>
      <form noValidate onSubmit={submit}>
        <div className="my-vocabulary-set-form-grid">
          <label htmlFor="my-set-name">Tên bộ từ<input id="my-set-name" value={values.name} onChange={(event) => update("name", event.target.value)} maxLength={101} disabled={pending} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "my-set-name-error" : undefined} /></label>
          {errors.name ? <FieldError id="my-set-name-error" message={errors.name} /> : null}
          <label htmlFor="my-set-topic">Chủ đề<select id="my-set-topic" value={values.topic_id} onChange={(event) => update("topic_id", event.target.value)} disabled={pending || topicState !== "ready"} aria-invalid={Boolean(errors.topic_id)} aria-describedby={errors.topic_id ? "my-set-topic-error" : undefined}><option value="">{topicState === "loading" ? "Đang tải chủ đề…" : "Chọn chủ đề"}</option>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label>
          {topicState === "error" ? <FieldError message="Không thể tải danh sách chủ đề. Hãy đóng biểu mẫu và thử lại." /> : null}
          {errors.topic_id ? <FieldError id="my-set-topic-error" message={errors.topic_id} /> : null}
          <label className="my-vocabulary-set-form-wide" htmlFor="my-set-description">Mô tả <span>(không bắt buộc)</span><textarea id="my-set-description" value={values.description} onChange={(event) => update("description", event.target.value)} maxLength={501} rows={3} disabled={pending} aria-invalid={Boolean(errors.description)} /></label>
          {errors.description ? <FieldError message={errors.description} /> : null}
        </div>
        <fieldset className="my-vocabulary-set-items-editor">
          <legend>Danh sách từ vựng theo thứ tự</legend>
          <p>Danh sách này là nội dung đầy đủ sẽ được lưu cho bộ từ. Bộ từ hệ thống cần ít nhất một từ vựng.</p>
          {errors.items ? <FieldError message={errors.items} /> : null}
          <ol>{values.items.map((item, index) => <li key={item.vocabulary_id}><div><strong>{item.word}</strong>{item.phonetic ? <span>{item.phonetic}</span> : null}</div><div className="my-vocabulary-set-item-controls"><button type="button" onClick={() => moveItem(index, -1)} disabled={pending || index === 0} aria-label={`Đưa ${item.word} lên`}><ArrowUp className="size-4" aria-hidden="true" /></button><button type="button" onClick={() => moveItem(index, 1)} disabled={pending || index === values.items.length - 1} aria-label={`Đưa ${item.word} xuống`}><ArrowDown className="size-4" aria-hidden="true" /></button><button type="button" onClick={() => removeItem(index)} disabled={pending} aria-label={`Xóa ${item.word} khỏi bộ từ`}><Trash2 className="size-4" aria-hidden="true" /></button></div></li>)}</ol>
        </fieldset>
        <fieldset className="my-vocabulary-picker">
          <legend>Thêm từ vựng</legend>
          <p>Tìm từ hệ thống để thêm vào bộ từ.</p>
          <div><label htmlFor="my-set-vocabulary-query">Từ khóa<input id="my-set-vocabulary-query" type="search" value={pickerQuery} onChange={(event) => setPickerQuery(event.target.value)} disabled={pending} autoComplete="off" /></label><button type="button" onClick={searchPicker} disabled={pending || pickerState === "loading"}>{pickerState === "loading" ? "Đang tìm…" : "Tìm từ"}</button></div>
          {pickerState === "validation" ? <FieldError message="Nhập từ khóa trước khi tìm." /> : null}
          {pickerState === "error" ? <FieldError message="Không thể tìm từ vựng. Vui lòng thử lại." /> : null}
          {pickerState === "ready" && pickerItems.length === 0 ? <p role="status">Không tìm thấy từ phù hợp.</p> : null}
          {pickerState === "ready" && pickerItems.length > 0 ? <ul>{pickerItems.map((item) => { const added = values.items.some((current) => current.vocabulary_id === item.id); return <li key={item.id} className="my-vocabulary-picker-result"><div><strong>{item.word}</strong><span>{item.primary_meaning ? `${item.primary_meaning.part_of_speech} · ${item.primary_meaning.meaning_vi}` : "Chưa có nghĩa chính"}</span><small>Hệ thống</small></div><div><button type="button" onClick={() => addItem(item)} disabled={pending || added}>{added ? "Đã thêm" : "Thêm"}</button></div></li>; })}</ul> : null}
        </fieldset>
        <div className="my-vocabulary-set-form-actions"><button type="button" onClick={onCancel} disabled={pending}>Hủy</button><button className="my-vocabulary-sets-primary" type="submit" disabled={pending || topicState !== "ready"} aria-busy={pending}>{pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}{pending ? "Đang lưu…" : "Lưu bộ từ"}</button></div>
      </form>
    </section>
  );
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
function personalSetFormValues(aggregate) { return { name: aggregate.name ?? "", description: aggregate.description ?? "" }; }
function serializePersonalSet(values) { return { name: values.name.trim(), description: values.description.trim() || null }; }
function validatePersonalSet(values) { const errors = {}; if (!values.name.trim()) errors.name = "Tên bộ từ là bắt buộc."; else if (values.name.trim().length > 100) errors.name = "Tên bộ từ không được quá 100 ký tự."; if (values.description.length > 500) errors.description = "Mô tả không được quá 500 ký tự."; return errors; }
function formValues(aggregate) { return { topic_id: aggregate.topic_id ?? "", name: aggregate.name ?? "", description: aggregate.description ?? "", items: (aggregate.items ?? []).slice().sort((left, right) => left.position - right.position).map((item) => ({ vocabulary_id: item.vocabulary_id, word: item.word, phonetic: item.phonetic ?? null, source: item.source })) }; }
function serializeSystemSet(values) { return { topic_id: values.topic_id, name: values.name.trim(), description: values.description.trim() || null, items: values.items.map((item) => ({ vocabulary_id: item.vocabulary_id })) }; }
function validateSystemSet(values) { const errors = {}; if (!values.name.trim()) errors.name = "Tên bộ từ là bắt buộc."; else if (values.name.trim().length > 100) errors.name = "Tên bộ từ không được quá 100 ký tự."; if (!values.topic_id) errors.topic_id = "Hãy chọn một chủ đề."; if (values.description.length > 500) errors.description = "Mô tả không được quá 500 ký tự."; if (values.items.length === 0) errors.items = "Bộ từ hệ thống cần ít nhất một từ vựng."; return errors; }
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
