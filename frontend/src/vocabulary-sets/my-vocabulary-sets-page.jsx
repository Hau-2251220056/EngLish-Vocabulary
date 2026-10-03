import { ArrowDown, ArrowRight, ArrowUp, BookOpen, FolderHeart, LoaderCircle, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { topicService } from "../services/topic-service.js";
import { VocabularySetApiError, vocabularySetService } from "../services/vocabulary-set-service.js";
import { ActionMenu } from "../components/action-menu.jsx";

const EMPTY_SET = { name: "", description: "", items: [] };
const PRIMARY_BUTTON_CLASSES = "inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-[0.45rem] rounded-[0.8rem] border-0 bg-[var(--accent-primary)] px-4 py-[0.72rem] font-[inherit] font-semibold text-white shadow-[0_4px_12px_rgb(76_162_230/16%)] transition-[transform,box-shadow,background-color] duration-150 hover:-translate-y-px hover:bg-[var(--accent-primary-hover)] hover:shadow-[0_6px_16px_rgb(76_162_230/20%)] active:translate-y-0 active:bg-[var(--accent-primary-pressed)] focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] disabled:cursor-not-allowed disabled:opacity-[0.58] motion-reduce:transform-none motion-reduce:transition-none max-[700px]:w-full";
const MODAL_BUTTON_CLASSES = "inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-[0.9rem] py-[0.6rem] text-sm font-medium text-slate-700 transition-[border-color,background-color,color,box-shadow] duration-150 hover:not-disabled:border-[#b8d9f1] hover:not-disabled:bg-[var(--accent-primary-soft)] hover:not-disabled:text-[var(--accent-primary-pressed)] focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] disabled:cursor-not-allowed disabled:opacity-[0.58] motion-reduce:transition-none";
const MODAL_FIELD_CLASSES = "w-full min-w-0 rounded-xl border border-[#d7dce6] bg-white px-[0.8rem] py-[0.72rem] leading-[1.45] text-slate-900 outline-0 transition-[border-color,box-shadow] duration-150 hover:not-disabled:border-[#aeb8c9] focus:border-[var(--accent-primary)] focus:shadow-[0_0_0_3px_var(--accent-primary-focus)] aria-invalid:border-[#dc6b6b] aria-invalid:shadow-[0_0_0_1px_rgb(220_107_107/22%)] disabled:cursor-not-allowed motion-reduce:transition-none";
const MODAL_ERROR_CLASSES = "mt-[0.15rem] mb-0 rounded-[0.7rem] bg-red-50 px-3 py-[0.65rem] text-sm text-red-700";

export function MyVocabularySetsPage() {
  const navigate = useNavigate();
  const [sets, setSets] = useState([]);
  const [listState, setListState] = useState("loading");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("server");
  const [editor, setEditor] = useState(null);
  const [editorError, setEditorError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [pending, setPending] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const managementTriggerRef = useRef(null);
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

  const visibleSets = useMemo(() => sortSets(filterSets(sets, query), sort), [query, sets, sort]);

  function retry() { setReload((value) => value + 1); }

  function openCreate() {
    setFeedback(null);
    setEditorError(null);
    setEditor({ mode: "create", aggregate: EMPTY_SET });
  }

  async function saveSet(input) {
    const editing = editor?.mode === "edit";
    setPending("save");
    setEditorError(null);
    try {
      const saved = editing ? await vocabularySetService.updateMySet(editor.aggregate.id, input) : await vocabularySetService.createMySet(input);
      setSets((current) => upsertSummary(current, saved));
      setEditor(null);
      setEditorError(null);
      setFeedback({ type: "success", message: editing ? "Đã cập nhật bộ từ." : "Đã tạo bộ từ riêng tư." });
      if (!editing) navigate(`/my/vocabulary-sets/${saved.id}`);
      else requestAnimationFrame(() => managementTriggerRef.current?.focus?.());
      return true;
    } catch (error) {
      setEditorError(errorMessage(error, "Không thể lưu bộ từ. Vui lòng thử lại."));
      return false;
    } finally { setPending(null); }
  }

  function openManagement(set, mode, trigger) {
    managementTriggerRef.current = trigger;
    if (mode === "edit") { setEditorError(null); setEditor({ mode: "edit", aggregate: set }); }
    else { setDeleteError(null); setDeleteTarget(set); }
  }

  function closeEditor() { setEditor(null); setEditorError(null); requestAnimationFrame(() => managementTriggerRef.current?.focus?.()); }
  function closeDelete() { if (pending === "delete") return; setDeleteTarget(null); setDeleteError(null); requestAnimationFrame(() => managementTriggerRef.current?.focus?.()); }
  async function confirmDelete() {
    setPending("delete"); setDeleteError(null);
    try { await vocabularySetService.deleteMySet(deleteTarget.id); setSets((current) => current.filter((set) => set.id !== deleteTarget.id)); setDeleteTarget(null); setFeedback({ type: "success", message: "Đã xóa bộ từ riêng tư." }); }
    catch (error) { setDeleteError(errorMessage(error, "Không thể xóa bộ từ. Vui lòng thử lại.")); }
    finally { setPending(null); }
  }

  return (
    <section className="my-vocabulary-sets-page mx-auto w-full max-w-[76rem] p-[clamp(1.25rem,3vw,2.5rem)] text-[var(--text-primary)] max-[700px]:p-4" aria-labelledby="my-vocabulary-sets-title">
      <header className="my-vocabulary-sets-header mb-7 flex items-start justify-between gap-4 max-[700px]:mb-[1.45rem] max-[700px]:flex-col max-[700px]:items-stretch max-[700px]:gap-[0.7rem]">
        <div><h1 className="m-0 text-[clamp(1.75rem,2.8vw,2.05rem)] font-semibold tracking-[-0.035em]" id="my-vocabulary-sets-title">Bộ từ của tôi</h1><p className="mb-0 mt-[0.45rem] text-sm font-normal text-slate-500">Quản lý và tiếp tục học các bộ từ bạn đã tạo.</p></div>
        <button className={`my-vocabulary-sets-primary ${PRIMARY_BUTTON_CLASSES}`} type="button" onClick={openCreate} disabled={pending !== null}><Plus className="size-5" aria-hidden="true" />Tạo bộ từ</button>
      </header>

      {feedback ? <p className={`my-vocabulary-sets-feedback mb-4 mt-0 rounded-xl px-4 py-3 ${feedback.type === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`} role={feedback.type === "error" ? "alert" : "status"} aria-live="polite">{feedback.message}</p> : null}
      {editor ? <PersonalVocabularySetModal aggregate={editor.aggregate} error={editorError} mode={editor.mode} pending={pending === "save"} onCancel={closeEditor} onSave={saveSet} /> : null}

      <section className="my-vocabulary-sets-list mt-0" aria-labelledby="my-vocabulary-sets-list-title">
        <div className="my-vocabulary-sets-toolbar flex items-end justify-between gap-6 border-b border-[#e8edf5] pb-4 max-[700px]:flex-col max-[700px]:items-stretch">
          <div><h2 className="m-0 text-[clamp(1.08rem,1.8vw,1.3rem)] font-semibold" id="my-vocabulary-sets-list-title">Danh sách bộ từ</h2>{listState === "ready" && sets.length > 0 ? <p className="mb-0 mt-1 text-[0.85rem] text-slate-500">{sets.length} bộ từ trong thư viện</p> : null}</div>
          <div className="my-vocabulary-sets-controls flex w-full max-w-[39rem] min-w-0 items-center gap-[0.65rem] max-[700px]:max-w-none max-[700px]:flex-col max-[700px]:items-stretch">
            <label className="my-vocabulary-sets-search flex min-h-11 min-w-56 flex-1 items-center gap-2 rounded-[0.8rem] border border-slate-300 bg-white px-3 py-[0.55rem] text-slate-500 transition-[border-color,box-shadow] duration-150 focus-within:border-[var(--accent-primary)] focus-within:shadow-[0_0_0_3px_var(--accent-primary-focus)] max-[700px]:w-full max-[700px]:min-w-0"><span className="sr-only">Tìm bộ từ</span><Search className="size-5" aria-hidden="true" /><input className="w-full min-w-0 border-0 bg-transparent font-[inherit] text-[var(--text-primary)] outline-0" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm bộ từ..." autoComplete="off" /></label>
            <label className="my-vocabulary-sets-sort flex min-h-11 items-center rounded-[0.8rem] border border-slate-300 bg-white transition-[border-color,box-shadow] duration-150 focus-within:border-[var(--accent-primary)] focus-within:shadow-[0_0_0_3px_var(--accent-primary-focus)]"><span className="sr-only">Sắp xếp bộ từ</span><select className="min-h-[2.65rem] border-0 bg-transparent py-0 pl-3 pr-9 font-[inherit] font-bold text-slate-700 outline-0 max-[700px]:w-full" value={sort} onChange={(event) => setSort(event.target.value)}><option value="server">Mặc định</option><option value="name-asc">Tên A–Z</option><option value="name-desc">Tên Z–A</option><option value="count-asc">Số từ tăng dần</option><option value="count-desc">Số từ giảm dần</option></select></label>
          </div>
        </div>
        {listState === "loading" ? <MySetSkeleton /> : null}
        {listState === "error" ? <MyState role="alert" title="Không thể tải bộ từ" message="Vui lòng thử lại." action={<button type="button" onClick={retry}>Thử lại</button>} /> : null}
        {listState === "ready" && sets.length === 0 ? <MyState visual title="Bạn chưa có bộ từ nào" message="Tạo bộ từ đầu tiên để xây dựng thư viện học tập của riêng bạn." action={<><button type="button" aria-label="Tạo bộ từ đầu tiên" onClick={openCreate}><Plus aria-hidden="true" />Tạo bộ từ</button><Link to="/topics">Khám phá bộ từ</Link></>} /> : null}
        {listState === "ready" && sets.length > 0 && visibleSets.length === 0 ? <MyState title="Không tìm thấy bộ từ phù hợp" message="Thử một từ khóa khác hoặc xóa nội dung tìm kiếm." action={<button type="button" onClick={() => setQuery("")}>Xóa tìm kiếm</button>} /> : null}
        {listState === "ready" && visibleSets.length > 0 ? <ul className="my-vocabulary-sets-grid mt-5 grid list-none grid-cols-3 gap-[1.1rem] p-0 max-[1000px]:grid-cols-2 max-[700px]:grid-cols-1" aria-label="Các bộ từ của tôi">{visibleSets.map((set, index) => <MySetCard key={set.id} set={set} accent={index % 3} onManage={openManagement} />)}</ul> : null}
      </section>

      {deleteTarget ? <DeletePersonalSetDialog error={deleteError} name={deleteTarget.name} pending={pending === "delete"} onCancel={closeDelete} onConfirm={confirmDelete} /> : null}

    </section>
  );
}

export function PersonalVocabularySetModal({ aggregate, error, mode, onCancel, onSave, pending }) {
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
    <dialog ref={dialogRef} className="m-auto max-h-[calc(100dvh-2rem)] w-[min(calc(100%-2rem),31rem)] overflow-auto rounded-[1.15rem] border-0 bg-transparent p-0 text-slate-900 shadow-[0_24px_65px_rgb(15_23_42/28%)] backdrop:bg-slate-900/50" aria-labelledby={titleId} onCancel={handleCancel} onClick={handleBackdrop}>
      <div className="rounded-[inherit] border border-slate-200 bg-white p-[1.35rem] max-[700px]:p-4">
        <header className="flex items-start justify-between gap-4 border-b border-[#e8edf5] pb-4">
          <div><h2 className="m-0 text-[1.35rem] font-semibold tracking-[-0.02em] text-slate-800" id={titleId}>{mode === "create" ? "Tạo bộ từ" : "Chỉnh sửa bộ từ"}</h2><p className="mt-[0.35rem] mb-0 text-sm leading-normal text-slate-500">{mode === "create" ? "Đặt tên cho bộ từ mới của bạn." : "Cập nhật tên và mô tả của bộ từ."}</p></div>
          <button className={`${MODAL_BUTTON_CLASSES} size-11 shrink-0 p-0 [&_svg]:size-[1.1rem]`} type="button" aria-label="Đóng" onClick={closeWhenSafe} disabled={pending}><X aria-hidden="true" /></button>
        </header>
        <form className="grid gap-[0.45rem] pt-4" noValidate onSubmit={submit}>
          {error ? <p className={MODAL_ERROR_CLASSES} role="alert">{error}</p> : null}
          <label className="mt-[0.45rem] grid gap-[0.4rem] font-semibold text-slate-700" htmlFor="personal-set-name">Tên bộ từ<input className={MODAL_FIELD_CLASSES} ref={nameRef} id="personal-set-name" value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} maxLength={101} disabled={pending} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "personal-set-name-error" : undefined} /></label>
          {errors.name ? <p id="personal-set-name-error" className={MODAL_ERROR_CLASSES} role="alert">{errors.name}</p> : null}
          <label className="mt-[0.45rem] grid gap-[0.4rem] font-semibold text-slate-700 [&_span]:font-normal [&_span]:text-slate-500" htmlFor="personal-set-description">Mô tả <span>(không bắt buộc)</span><textarea className={`${MODAL_FIELD_CLASSES} resize-y max-[700px]:h-24`} id="personal-set-description" value={values.description} onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))} maxLength={501} rows={4} disabled={pending} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? "personal-set-description-error" : undefined} /></label>
          {errors.description ? <p id="personal-set-description-error" className={MODAL_ERROR_CLASSES} role="alert">{errors.description}</p> : null}
          <footer className="mt-[0.8rem] flex justify-end gap-[0.65rem] border-t border-[#e8edf5] pt-4 max-[700px]:flex-col-reverse max-[700px]:[&_button]:w-full"><button className={MODAL_BUTTON_CLASSES} type="button" onClick={closeWhenSafe} disabled={pending}>Hủy</button><button className={PRIMARY_BUTTON_CLASSES} type="submit" disabled={pending} aria-busy={pending}>{pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}{pending ? "Đang lưu…" : mode === "create" ? "Tạo bộ từ" : "Lưu thay đổi"}</button></footer>
        </form>
      </div>
    </dialog>
  );
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

function MySetCard({ accent, onManage, set }) {
  const accents = ["bg-[#f1f8fd] text-[var(--accent-primary-pressed)]", "bg-[var(--accent-violet-soft)] text-[var(--accent-violet)]", "bg-emerald-50 text-emerald-700"];
  return <li className="min-w-0"><article className={`my-vocabulary-set-card accent-${accent} flex h-full min-w-0 flex-col overflow-visible rounded-[1.05rem] border border-[#dfe6f2] bg-white shadow-[0_4px_14px_rgb(30_41_59/4%)] transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:border-[#b8daf2] hover:shadow-[0_9px_22px_rgb(30_41_59/7%)] motion-reduce:transform-none motion-reduce:transition-none`}><div className={`my-vocabulary-set-card-art relative flex h-[4.25rem] items-center justify-start overflow-hidden px-4 ${accents[accent]} before:absolute before:-right-4 before:-top-16 before:size-28 before:rounded-full before:bg-current before:opacity-[0.06] after:absolute after:-bottom-10 after:left-16 after:size-16 after:rounded-full after:bg-current after:opacity-[0.06]`} aria-hidden="true"><span className="relative z-[1] grid size-10 place-items-center rounded-xl bg-white/80 shadow-[0_3px_10px_rgb(30_41_59/6%)] ring-1 ring-inset ring-white [&_svg]:size-5"><BookOpen /></span></div><div className="my-vocabulary-set-card-body flex min-w-0 flex-1 flex-col px-4 pb-[0.85rem] pt-4"><p className="my-vocabulary-set-count mb-[0.55rem] mt-0 w-fit rounded-full bg-slate-100 px-[0.55rem] py-[0.2rem] text-xs font-semibold text-slate-600">{set.item_count} từ vựng</p><h3 className="m-0 [overflow-wrap:anywhere] text-base font-semibold leading-[1.4] text-slate-800">{set.name}</h3><p className="my-vocabulary-set-description mt-1.5 line-clamp-2 min-h-[2.8em] overflow-hidden text-sm font-normal leading-[1.4] text-slate-500">{set.description || "Chưa có mô tả."}</p></div><div className="my-vocabulary-set-card-actions relative z-[2] flex min-h-[3.55rem] items-center justify-between gap-[0.6rem] px-4 pb-[0.8rem] pt-1"><Link className="my-vocabulary-set-learn inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[0.65rem] bg-[var(--accent-primary)] px-3 py-[0.45rem] text-sm font-semibold text-white no-underline shadow-[0_3px_8px_rgb(76_162_230/14%)] transition-[background-color,box-shadow,transform] hover:-translate-y-px hover:bg-[var(--accent-primary-hover)] hover:shadow-[0_5px_12px_rgb(76_162_230/18%)] active:translate-y-0 active:bg-[var(--accent-primary-pressed)] focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] motion-reduce:transform-none [&_svg]:size-4" to={`/my/vocabulary-sets/${set.id}`}>Xem<ArrowRight aria-hidden="true" /></Link><ActionMenu label={`Quản lý ${set.name}`}><button role="menuitem" type="button" onClick={(event) => onManage(set, "edit", event.currentTarget.closest(".action-menu").querySelector(".action-menu-trigger"))}>Chỉnh sửa</button><button role="menuitem" type="button" className="is-danger" onClick={(event) => onManage(set, "delete", event.currentTarget.closest(".action-menu").querySelector(".action-menu-trigger"))}>Xóa bộ từ</button></ActionMenu></div></article></li>;
}

function DeletePersonalSetDialog({ error, name, onCancel, onConfirm, pending }) {
  const ref = useRef(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => { if (dialog?.open) dialog.close(); }; }, []);
  return <dialog ref={ref} className="m-auto w-[min(calc(100%-2rem),29rem)] max-w-none border-0 bg-transparent p-0 backdrop:bg-slate-900/50" aria-labelledby="delete-personal-set-title" aria-describedby="delete-personal-set-description" onCancel={(event) => { event.preventDefault(); if (!pending) onCancel(); }} onClick={(event) => { if (event.target === ref.current && !pending) onCancel(); }}><div className="rounded-2xl bg-white p-5 shadow-[0_24px_60px_rgb(15_23_42/30%)]"><h2 className="mt-0" id="delete-personal-set-title">Xóa bộ từ?</h2><p id="delete-personal-set-description">Bạn có chắc muốn xóa bộ từ <strong>{name}</strong> không? Từ vựng và tiến độ học không bị xóa.</p>{error ? <p role="alert" className={MODAL_ERROR_CLASSES}>{error}</p> : null}<footer className="mt-4 flex justify-end gap-[0.65rem] max-[480px]:flex-col-reverse max-[480px]:[&_button]:w-full"><button className={MODAL_BUTTON_CLASSES} type="button" onClick={onCancel} disabled={pending}>Hủy</button><button type="button" className={`${MODAL_BUTTON_CLASSES} border-red-200 text-red-700 hover:not-disabled:border-rose-300 hover:not-disabled:bg-rose-50 hover:not-disabled:text-rose-800`} onClick={() => void onConfirm()} disabled={pending} aria-busy={pending}>{pending ? "Đang xóa…" : "Xác nhận xóa"}</button></footer></div></dialog>;
}

function MySetSkeleton() {
  return <div className="my-vocabulary-set-skeleton mt-5 grid grid-cols-3 gap-[1.1rem] max-[1000px]:grid-cols-2 max-[700px]:grid-cols-1" role="status" aria-label="Đang tải bộ từ của bạn"><span className="sr-only">Đang tải bộ từ của bạn…</span>{[0, 1, 2].map((item) => <div className="h-60 rounded-2xl border border-slate-200 bg-white px-4 pb-4 pt-26 max-[700px]:not-first:hidden [&_span]:mt-[0.65rem] [&_span]:block [&_span]:h-[0.8rem] [&_span]:animate-pulse [&_span]:rounded-full [&_span]:bg-[#e9eef6] [&_span:nth-child(2)]:w-[70%] [&_span:nth-child(3)]:w-[45%] motion-reduce:[&_span]:animate-none" key={item} aria-hidden="true"><span /><span /><span /></div>)}</div>;
}

function MyState({ action, loading, message, role, title, visual = false }) { return <div className={`my-vocabulary-set-state mt-5 grid gap-[0.7rem] rounded-2xl border border-dashed border-slate-300 bg-white p-[1.4rem] text-slate-600 ${visual ? "is-visual justify-items-center px-6 py-[clamp(2rem,6vw,4rem)] text-center" : "justify-items-start"}`} role={loading ? "status" : role} aria-live={loading ? "polite" : undefined}>{loading ? <LoaderCircle className="size-6 animate-spin" aria-hidden="true" /> : null}{visual ? <span className="my-vocabulary-set-state-visual grid size-[4.25rem] -rotate-3 place-items-center rounded-[1.25rem] bg-[var(--accent-primary-soft)] text-[var(--accent-primary-pressed)] [&_svg]:size-8" aria-hidden="true"><FolderHeart /></span> : null}{title ? <h2 className="m-0">{title}</h2> : null}<p className="m-0">{message}</p>{action ? <div className={`my-vocabulary-set-state-actions flex flex-wrap items-center gap-[0.6rem] [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:justify-center [&_a]:gap-1.5 [&_a]:rounded-xl [&_a]:border [&_a]:border-slate-300 [&_a]:bg-white [&_a]:px-[0.85rem] [&_a]:py-[0.6rem] [&_a]:font-extrabold [&_a]:text-slate-700 [&_a]:no-underline [&_a]:focus-visible:outline-0 [&_a]:focus-visible:ring-2 [&_a]:focus-visible:ring-[var(--accent-primary-focus)] [&_button]:inline-flex [&_button]:min-h-11 [&_button]:cursor-pointer [&_button]:items-center [&_button]:justify-center [&_button]:gap-1.5 [&_button]:rounded-xl [&_button]:border [&_button]:border-slate-300 [&_button]:bg-white [&_button]:px-[0.85rem] [&_button]:py-[0.6rem] [&_button]:font-[inherit] [&_button]:font-extrabold [&_button]:text-slate-700 [&_button]:focus-visible:outline-0 [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-[var(--accent-primary-focus)] [&_svg]:size-4 ${visual ? "[&_button]:border-[var(--accent-primary)] [&_button]:bg-[var(--accent-primary)] [&_button]:text-white" : ""}`}>{action}</div> : null}</div>; }
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
