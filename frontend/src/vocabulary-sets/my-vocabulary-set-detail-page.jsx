import { ArrowLeft, BookOpen, CircleAlert, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { vocabularyService } from "../services/vocabulary-service.js";
import { VocabularySetApiError, vocabularySetService } from "../services/vocabulary-set-service.js";
import { AddVocabularyModal } from "./add-vocabulary-modal.jsx";
import { PrivateVocabularyEditor } from "./private-vocabulary-editor.jsx";
import { SetLearningActions } from "./set-detail-primitives.jsx";
import { SetCefrBadge } from "./set-metadata-presentation.jsx";

const DETAIL_PRIMARY_BUTTON_CLASSES = "inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center gap-[0.4rem] rounded-[0.7rem] border-0 bg-[var(--accent-primary)] px-3 py-[0.55rem] text-sm font-semibold text-white shadow-[0_4px_12px_rgb(76_162_230/16%)] transition-[transform,box-shadow,background-color] duration-150 hover:-translate-y-px hover:bg-[var(--accent-primary-hover)] hover:shadow-[0_6px_16px_rgb(76_162_230/20%)] active:translate-y-0 active:bg-[var(--accent-primary-pressed)] focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] disabled:cursor-not-allowed disabled:opacity-[0.58] motion-reduce:transform-none motion-reduce:transition-none max-[800px]:min-h-11 max-[800px]:w-full";

export function MyVocabularySetDetailPage() {
  const { setId } = useParams();
  const [detail, setDetail] = useState(null);
  const [state, setState] = useState("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [privateEditor, setPrivateEditor] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [privateError, setPrivateError] = useState(null);
  const [pending, setPending] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const privateEditControlsRef = useRef(new Map());
  const removeControlsRef = useRef(new Map());
  const pendingPrivateFocusIdRef = useRef(null);
  const pendingRemoveFocusIdRef = useRef(null);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) { setState("loading"); setFeedback(null); }
      return vocabularySetService.getMySet(setId);
    }).then(
      (data) => { if (active) { setDetail(data); setState("ready"); } },
      (error) => { if (active) { setDetail(null); setState(isMissing(error) ? "not-found" : "error"); } },
    );
    return () => { active = false; };
  }, [reloadKey, setId]);

  useEffect(() => {
    const vocabularyId = pendingPrivateFocusIdRef.current;
    if (privateEditor || !vocabularyId) return;
    const control = privateEditControlsRef.current.get(vocabularyId);
    if (!control?.isConnected) return;
    pendingPrivateFocusIdRef.current = null;
    control.focus();
  }, [detail, privateEditor]);

  useEffect(() => {
    const vocabularyId = pendingRemoveFocusIdRef.current;
    if (pending || removeTarget || !vocabularyId) return;
    const control = removeControlsRef.current.get(vocabularyId);
    if (!control?.isConnected) return;
    pendingRemoveFocusIdRef.current = null;
    control.focus();
  }, [detail, pending, removeTarget]);

  const items = useMemo(() => [...(detail?.items ?? [])].sort((a, b) => a.position - b.position), [detail]);
  const existingIds = useMemo(() => new Set(items.map((item) => item.vocabulary_id)), [items]);
  const detailPath = `/my/vocabulary-sets/${setId}`;

  async function refresh() {
    const current = await vocabularySetService.getMySet(setId);
    setDetail(current); setState("ready");
    return current;
  }

  async function addExisting(vocabularyId) {
    await vocabularySetService.updateMySet(setId, { items: [...items.map((item) => ({ vocabulary_id: item.vocabulary_id })), { vocabulary_id: vocabularyId }] });
    await refresh(); setAddOpen(false); setFeedback({ type: "success", text: "Đã thêm từ vựng vào bộ." });
  }

  async function openPrivateEditor(item) {
    if (pending) return;
    setPrivateEditor({ item, data: null });
    setPending(`load-${item.vocabulary_id}`); setPrivateError(null);
    try {
      const data = await vocabularyService.getPrivateVocabulary(item.vocabulary_id);
      setPrivateEditor((current) => current?.item.vocabulary_id === item.vocabulary_id ? { item, data } : current);
    }
    catch (error) { setPrivateEditor(null); setFeedback({ type: "error", text: message(error, "Không thể tải từ vựng để chỉnh sửa.") }); requestAnimationFrame(() => privateEditControlsRef.current.get(item.vocabulary_id)?.focus?.()); }
    finally { setPending(null); }
  }

  function closePrivateEditor() {
    if (pending === "private") return;
    const vocabularyId = privateEditor?.item.vocabulary_id;
    setPrivateEditor(null); setPrivateError(null);
    requestAnimationFrame(() => privateEditControlsRef.current.get(vocabularyId)?.focus?.());
  }

  async function savePrivate(input) {
    setPending("private"); setPrivateError(null);
    try { const vocabularyId = privateEditor.data.id; await vocabularyService.updatePrivateVocabulary(vocabularyId, input); await refresh(); pendingPrivateFocusIdRef.current = vocabularyId; setPrivateEditor(null); setFeedback({ type: "success", text: "Đã cập nhật từ vựng." }); return true; }
    catch (error) { setPrivateError(message(error, "Không thể lưu từ vựng. Vui lòng thử lại.")); return false; }
    finally { setPending(null); }
  }

  function requestRemove(item) {
    if (!pending) setRemoveTarget(item);
  }

  function cancelRemove() {
    if (pending?.startsWith("remove-")) return;
    const vocabularyId = removeTarget?.vocabulary_id;
    setRemoveTarget(null);
    requestAnimationFrame(() => removeControlsRef.current.get(vocabularyId)?.focus?.());
  }

  async function confirmRemove() {
    const item = removeTarget;
    if (!item || pending) return;
    setPending(`remove-${item.vocabulary_id}`); setFeedback(null);
    try {
      const current = await vocabularySetService.updateMySet(setId, { items: items.filter((entry) => entry.vocabulary_id !== item.vocabulary_id).map((entry) => ({ vocabulary_id: entry.vocabulary_id })) });
      setDetail(current); setState("ready"); setRemoveTarget(null); setFeedback({ type: "success", text: `Đã gỡ ${item.word} khỏi bộ.` });
    } catch (error) { pendingRemoveFocusIdRef.current = item.vocabulary_id; setRemoveTarget(null); setFeedback({ type: "error", text: message(error, "Không thể gỡ từ vựng. Vui lòng thử lại.") }); }
    finally { setPending(null); }
  }

  if (state !== "ready" || !detail) return <DetailState state={state} onRetry={() => setReloadKey((value) => value + 1)} />;

  return (
    <main className="set-detail-page mx-auto w-full max-w-[76rem] p-[clamp(1rem,3vw,2.5rem)] text-[var(--text-primary)] max-[480px]:p-4">
      <Link className="set-detail-back inline-flex min-h-11 items-center gap-[0.45rem] font-semibold text-[#5b6478] no-underline transition-[color,transform] duration-150 hover:-translate-x-0.5 hover:text-[var(--accent-primary-hover)] focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] motion-reduce:transform-none motion-reduce:transition-none [&_svg]:w-[1.1rem]" to="/my/vocabulary-sets"><ArrowLeft aria-hidden="true" />Bộ từ của tôi</Link>
      <header className="set-detail-header mt-[0.15rem] flex items-start justify-between gap-6 max-[800px]:flex-col max-[800px]:items-stretch">
        <div className="min-w-0">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="m-0 [overflow-wrap:anywhere] text-[clamp(1.75rem,2.8vw,2.05rem)] font-semibold tracking-[-0.035em] max-[700px]:text-[1.7rem]">{detail.name}</h1><SetCefrBadge cefrLevel={detail.cefr_level} /></div><p className="mb-0 mt-2 max-w-[42rem] text-sm leading-6 text-slate-500">{detail.description || "Chưa có mô tả cho bộ từ này."}</p></div>
        </div>
      </header>
      {feedback ? <p className={`set-detail-feedback mb-0 mt-4 rounded-xl px-4 py-3 text-sm font-normal ${feedback.type === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`} role={feedback.type === "error" ? "alert" : "status"}>{feedback.text}</p> : null}

      <SetLearningActions enabled={items.length > 0} returnTo={detailPath} setId={setId} setName={detail.name} />

      <section className="set-detail-vocabulary mt-[1.65rem]" aria-labelledby="set-detail-vocabulary-title">
        <div className="set-detail-section-heading flex items-center justify-between gap-4 max-[800px]:flex-col max-[800px]:items-stretch"><h2 className="m-0 text-[clamp(1.125rem,1.6vw,1.25rem)] font-semibold" id="set-detail-vocabulary-title">Từ vựng trong bộ ({items.length})</h2><button type="button" className={`my-vocabulary-sets-primary ${DETAIL_PRIMARY_BUTTON_CLASSES}`} onClick={() => setAddOpen(true)}><Plus aria-hidden="true" />Thêm từ vựng</button></div>
        {items.length === 0 ? <div className="set-detail-empty mt-4 grid justify-items-center gap-[0.65rem] rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-[clamp(2rem,6vw,4rem)] text-center text-slate-500 [&_h3]:m-0 [&_p]:m-0 [&>svg]:size-8 [&>svg]:text-[var(--accent-primary)]"><BookOpen aria-hidden="true" /><h3>Bộ từ chưa có từ vựng</h3><p>Thêm từ vựng để bắt đầu học với Flashcard và Quiz.</p></div> : <VocabularyTable items={items} pending={pending} onEdit={openPrivateEditor} onRemove={requestRemove} registerEditControl={(vocabularyId, control) => { if (control) privateEditControlsRef.current.set(vocabularyId, control); else privateEditControlsRef.current.delete(vocabularyId); }} registerRemoveControl={(vocabularyId, control) => { if (control) removeControlsRef.current.set(vocabularyId, control); else removeControlsRef.current.delete(vocabularyId); }} />}
      </section>

      {addOpen ? <AddVocabularyModal existingIds={existingIds} setId={setId} onAddExisting={addExisting} onCreated={async () => { await refresh(); setAddOpen(false); setFeedback({ type: "success", text: "Đã tạo và thêm từ mới." }); }} onClose={() => setAddOpen(false)} /> : null}
      {privateEditor?.data ? <PrivateVocabularyEditor error={privateError} initialValue={privateEditor.data} mode="edit" pending={pending === "private"} onCancel={closePrivateEditor} onSubmit={savePrivate} /> : null}
      {privateEditor && !privateEditor.data ? <PrivateVocabularyLoadingDialog word={privateEditor.item.word} onCancel={closePrivateEditor} /> : null}
      {removeTarget ? <RemoveMembershipDialog item={removeTarget} pending={pending === `remove-${removeTarget.vocabulary_id}`} onCancel={cancelRemove} onConfirm={confirmRemove} /> : null}
    </main>
  );
}

function VocabularyTable({ items, onEdit, onRemove, pending, registerEditControl, registerRemoveControl }) {
  const headingClasses = "h-[4.25rem] border-b border-[#e8edf5] bg-[var(--bg-subtle)] px-[0.58rem] py-[0.45rem] text-left align-middle text-[0.78rem] font-semibold tracking-[0.01em] text-slate-600 max-[800px]:h-[3.75rem] max-[800px]:px-[0.35rem] max-[800px]:py-[0.4rem] max-[480px]:text-[0.72rem]";
  const cellClasses = "h-[4.25rem] [overflow-wrap:anywhere] border-b border-[#e8edf5] px-[0.58rem] py-[0.45rem] align-middle font-normal leading-[1.35] text-[#455166] max-[800px]:h-[3.75rem] max-[800px]:px-[0.35rem] max-[800px]:py-[0.4rem]";
  const optionalClasses = "set-detail-optional-column max-[800px]:hidden";
  return <div className="set-detail-table-wrap mt-4 overflow-visible rounded-[0.8rem] border border-[var(--border-soft)] bg-white shadow-[0_4px_14px_rgb(30_41_59/3%)]"><table className="set-detail-table w-full table-fixed border-separate border-spacing-0 text-[0.82rem] max-[480px]:text-[0.76rem]"><thead><tr><th className={`${headingClasses} w-[14%] max-[800px]:w-[27%]`}>Từ vựng</th><th className={`${headingClasses} ${optionalClasses} w-[13%]`}>Phiên âm</th><th className={`${headingClasses} ${optionalClasses} w-[11%]`}>Từ loại</th><th className={`${headingClasses} w-[20%] max-[800px]:w-[44%]`}>Nghĩa</th><th className={`${headingClasses} ${optionalClasses} w-[22%]`}>Ví dụ</th><th className={`${headingClasses} w-[6.5rem] pr-[0.45rem] text-right max-[800px]:w-[29%]`}>Thao tác</th></tr></thead><tbody>{items.map((item) => { const privateItem = item.source === "PRIVATE"; const editExplanation = privateItem ? `Chỉnh sửa ${item.word}` : "Chỉ từ của bạn mới có thể chỉnh sửa"; return <tr className="transition-colors duration-150 last:[&_td]:border-b-0 hover:bg-[#fafaff] motion-reduce:transition-none" key={item.vocabulary_id}><td className={cellClasses}><strong className="font-semibold text-[var(--text-primary)]">{item.word}</strong></td><td className={`${cellClasses} ${optionalClasses}`}>{item.phonetic || "—"}</td><td className={`${cellClasses} ${optionalClasses}`}>{item.primary_meaning?.part_of_speech || "—"}</td><td className={cellClasses}>{item.primary_meaning?.meaning_vi || "Chưa có nghĩa"}</td><td className={`${cellClasses} ${optionalClasses} set-detail-example-cell`}>{item.primary_meaning?.example ? <><span className="line-clamp-2" title={item.primary_meaning.example.example_en}>{item.primary_meaning.example.example_en}</span>{item.primary_meaning.example.example_vi ? <small className="mt-[0.12rem] line-clamp-1 text-[0.7rem] text-[var(--text-secondary)]" title={item.primary_meaning.example.example_vi}>{item.primary_meaning.example.example_vi}</small> : null}</> : "—"}</td><td className={`${cellClasses} w-[6.5rem] pr-[0.45rem] text-right max-[800px]:w-[29%]`}><div className="set-detail-direct-actions flex items-center justify-end gap-[0.1rem] max-[480px]:gap-0"><button className="inline-grid size-11 min-w-11 cursor-pointer place-items-center rounded-[0.65rem] border-0 bg-transparent text-[#657187] transition-[background-color,color,box-shadow] duration-150 hover:not-disabled:bg-[var(--accent-primary-soft)] hover:not-disabled:text-[var(--accent-primary)] focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_var(--accent-primary)] disabled:cursor-not-allowed disabled:text-slate-300 motion-reduce:transition-none [&_svg]:size-4" ref={(control) => { if (privateItem) registerEditControl(item.vocabulary_id, control); }} type="button" aria-label={editExplanation} title={editExplanation} onClick={() => { if (privateItem) void onEdit(item); }} disabled={!privateItem || Boolean(pending)}><Pencil aria-hidden="true" /></button><button className="is-remove inline-grid size-11 min-w-11 cursor-pointer place-items-center rounded-[0.65rem] border-0 bg-transparent text-[#657187] transition-[background-color,color,box-shadow] duration-150 hover:bg-[var(--danger-soft)] hover:text-[#b23a48] focus-visible:bg-[var(--danger-soft)] focus-visible:text-[#b23a48] focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_var(--accent-primary)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none [&_svg]:size-4" ref={(control) => registerRemoveControl(item.vocabulary_id, control)} type="button" aria-label={`Gỡ ${item.word} khỏi bộ`} title={`Gỡ ${item.word} khỏi bộ`} onClick={() => onRemove(item)} disabled={Boolean(pending)}><Trash2 aria-hidden="true" /></button></div></td></tr>; })}</tbody></table></div>;
}

function PrivateVocabularyLoadingDialog({ onCancel, word }) {
  const ref = useRef(null);
  const cancelRef = useRef(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); cancelRef.current?.focus(); return () => { if (dialog?.open) dialog.close(); }; }, []);
  return <dialog ref={ref} className="m-auto w-[min(calc(100%-2rem),28rem)] max-w-none border-0 bg-transparent p-0 backdrop:bg-slate-900/50" aria-labelledby="private-vocabulary-loading-title" onCancel={(event) => { event.preventDefault(); onCancel(); }} onClick={(event) => { if (event.target === ref.current) onCancel(); }}><section className="rounded-2xl border border-[var(--border-soft)] bg-white p-5 shadow-[0_20px_45px_rgb(15_23_42/24%)]"><h2 className="m-0 text-lg font-semibold" id="private-vocabulary-loading-title">Chỉnh sửa từ vựng</h2><div className="mt-4 flex items-center gap-3 text-sm text-slate-600" role="status"><LoaderCircle className="size-5 animate-spin text-[var(--accent-primary)]" aria-hidden="true" /><span>Đang tải dữ liệu cho {word}…</span></div><footer className="mt-5 flex justify-end"><button ref={cancelRef} type="button" className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-[0.7rem] border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)]" onClick={onCancel}>Hủy</button></footer></section></dialog>;
}

function RemoveMembershipDialog({ item, onCancel, onConfirm, pending }) {
  const ref = useRef(null);
  const cancelRef = useRef(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); cancelRef.current?.focus(); return () => { if (dialog?.open) dialog.close(); }; }, []);
  return <dialog ref={ref} className="m-auto w-[min(calc(100%-2rem),29rem)] max-w-none border-0 bg-transparent p-0 backdrop:bg-slate-900/50" aria-labelledby="remove-membership-title" aria-describedby="remove-membership-description" aria-busy={pending} onCancel={(event) => { event.preventDefault(); if (!pending) onCancel(); }} onClick={(event) => { if (event.target === ref.current && !pending) onCancel(); }}><section className="rounded-2xl border border-[var(--border-soft)] bg-white p-5 shadow-[0_20px_45px_rgb(15_23_42/24%)]"><h2 className="m-0 text-lg font-semibold" id="remove-membership-title">Gỡ từ khỏi bộ?</h2><p className="mb-0 mt-3 text-sm leading-6 text-slate-600" id="remove-membership-description">Từ vựng sẽ được gỡ khỏi bộ này. Tiến độ học và từ vựng gốc vẫn được giữ lại.</p><p className="mb-0 mt-2 text-sm font-semibold text-slate-800">{item.word}</p><footer className="mt-5 flex justify-end gap-2 max-[480px]:flex-col-reverse max-[480px]:[&_button]:min-h-11 max-[480px]:[&_button]:w-full"><button ref={cancelRef} type="button" className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-[0.7rem] border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] disabled:cursor-not-allowed disabled:opacity-60" onClick={onCancel} disabled={pending}>Hủy</button><button type="button" className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-[0.7rem] border border-rose-700 bg-rose-700 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-800 focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-60" onClick={() => void onConfirm()} disabled={pending} aria-busy={pending}>{pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}{pending ? "Đang gỡ…" : "Gỡ khỏi bộ"}</button></footer></section></dialog>;
}

function DetailState({ onRetry, state }) {
  const pageClasses = "set-detail-page mx-auto w-full max-w-[76rem] p-[clamp(1rem,3vw,2.5rem)] text-[var(--text-primary)] max-[480px]:p-4";
  const stateClasses = "set-detail-state mt-4 grid justify-items-center gap-[0.65rem] rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-[clamp(2rem,6vw,4rem)] text-center text-slate-500 [&_h1]:m-0 [&_p]:m-0 [&>svg]:size-8 [&>svg]:text-[var(--accent-primary)]";
  if (state === "loading") return <main className={pageClasses}><div className={stateClasses} role="status"><LoaderCircle className="animate-spin" aria-hidden="true" /><h1>Đang tải bộ từ…</h1></div></main>;
  const missing = state === "not-found";
  return <main className={pageClasses}><div className={stateClasses} role={missing ? undefined : "alert"}><CircleAlert aria-hidden="true" /><h1>{missing ? "Không tìm thấy bộ từ" : "Không thể tải bộ từ"}</h1><p>{missing ? "Bộ từ có thể không còn khả dụng hoặc bạn không có quyền truy cập." : "Vui lòng thử lại."}</p><div className="flex flex-wrap justify-center gap-[0.6rem] [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:justify-center [&_a]:rounded-xl [&_a]:border [&_a]:border-slate-300 [&_a]:bg-white [&_a]:px-[0.8rem] [&_a]:py-[0.6rem] [&_a]:font-semibold [&_a]:text-slate-700 [&_a]:no-underline [&_a]:focus-visible:outline-0 [&_a]:focus-visible:ring-2 [&_a]:focus-visible:ring-[var(--accent-primary-focus)] [&_button]:inline-flex [&_button]:min-h-11 [&_button]:cursor-pointer [&_button]:items-center [&_button]:justify-center [&_button]:rounded-xl [&_button]:border [&_button]:border-slate-300 [&_button]:bg-white [&_button]:px-[0.8rem] [&_button]:py-[0.6rem] [&_button]:font-[inherit] [&_button]:font-semibold [&_button]:text-slate-700 [&_button]:focus-visible:outline-0 [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-[var(--accent-primary-focus)]">{!missing ? <button type="button" onClick={onRetry}>Thử lại</button> : null}<Link to="/my/vocabulary-sets">Quay lại Bộ từ của tôi</Link></div></div></main>;
}


function isMissing(error) { return error instanceof VocabularySetApiError && (error.kind === "not-found" || error.kind === "authorization"); }
function message(error, fallback) {
  const safe = { VOCABULARY_SET_NOT_FOUND: "Bộ từ không còn khả dụng.", VOCABULARY_NOT_FOUND: "Từ vựng không còn khả dụng.", VALIDATION_ERROR: "Dữ liệu chưa hợp lệ.", FORBIDDEN: "Bạn không có quyền thực hiện hành động này." };
  return safe[error?.code] ?? fallback;
}
