import { ArrowLeft, LoaderCircle, Plus, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { vocabularySetService } from "../services/vocabulary-set-service.js";
import { createPrivateVocabularyAction, createPrivateVocabularySubmitter } from "./private-vocabulary-action.js";
import { PrivateVocabularyEditor } from "./private-vocabulary-editor.jsx";

const submitPrivateVocabulary = createPrivateVocabularySubmitter(vocabularySetService);
const BUTTON_CLASSES = "inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-[0.7rem] border border-slate-300 bg-white px-[0.65rem] py-[0.42rem] text-[0.8rem] font-medium text-slate-700 transition-[border-color,background-color,color,box-shadow,transform] duration-150 hover:not-disabled:border-[#b8d9f1] hover:not-disabled:bg-[var(--accent-primary-soft)] hover:not-disabled:text-[var(--accent-primary-pressed)] focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus,rgb(76_162_230/32%))] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none [&_svg]:size-4";
const ERROR_CLASSES = "mt-2 rounded-[0.7rem] bg-red-50 px-3 py-[0.65rem] text-sm text-red-700";

export function AddVocabularyModal({ existingIds, onAddExisting, onClose, onCreated, setId }) {
  const dialogRef = useRef(null);
  const searchRef = useRef(null);
  const createTriggerRef = useRef(null);
  const returnFocusRef = useRef(null);
  const previousStepRef = useRef("search");
  const [step, setStep] = useState("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searchState, setSearchState] = useState("idle");
  const [pendingId, setPendingId] = useState(null);
  const [error, setError] = useState(null);
  const actionRef = useRef(null);

  const busy = pendingId !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    returnFocusRef.current = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    searchRef.current?.focus();
    return () => {
      if (dialog?.open) dialog.close();
      document.body.style.overflow = overflow;
      returnFocusRef.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    if (previousStepRef.current === step) return;
    previousStepRef.current = step;
    if (step === "create") {
      dialogRef.current?.querySelector("#private-vocabulary-word")?.focus();
    } else {
      createTriggerRef.current?.focus();
    }
  }, [step]);

  function closeWhenSafe() { if (!busy) onClose(); }
  function cancel(event) { event.preventDefault(); closeWhenSafe(); }
  function backdrop(event) { if (event.target === dialogRef.current) closeWhenSafe(); }
  function showSearch() { if (!busy) { setError(null); setStep("search"); } }

  function updateQuery(value) {
    setQuery(value);
    if (searchState === "validation" && normalizeSearchQuery(value)) setSearchState("idle");
  }

  function clearQuery() {
    setQuery("");
    setResults([]);
    searchRef.current?.focus();
  }

  async function search(event) {
    event.preventDefault();
    const normalized = normalizeSearchQuery(query);
    if (!normalized) { setSearchState("validation"); return; }
    setSearchState("loading"); setError(null);
    try {
      setResults(await vocabularySetService.searchVocabularyPicker(normalized));
      setSearchState("ready");
    } catch {
      setSearchState("error");
    }
  }

  async function add(item) {
    if (busy || existingIds.has(item.id)) return;
    setPendingId(item.id); setError(null);
    try { await onAddExisting(item.id); }
    catch (cause) { setError(safeMessage(cause, "Chưa thể thêm từ vựng. Vui lòng thử lại.")); }
    finally { setPendingId(null); }
  }

  async function create(vocabulary) {
    if (busy) return false;
    if (!actionRef.current || actionRef.current.state === "success") {
      actionRef.current = createPrivateVocabularyAction(vocabulary);
    } else {
      actionRef.current.prepare(vocabulary);
    }
    setPendingId("create"); setError(null);
    try {
      await submitPrivateVocabulary(setId, actionRef.current);
      await onCreated();
      return true;
    } catch (cause) {
      setError(safeMessage(cause, "Chưa thể tạo từ mới. Nội dung của bạn vẫn được giữ lại."));
      return false;
    } finally { setPendingId(null); }
  }

  return (
    <dialog className={`m-auto max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-none overflow-auto border-0 bg-transparent p-0 backdrop:bg-slate-900/50 max-[480px]:w-[calc(100%-1.5rem)] ${step === "search" ? "sm:max-w-lg" : "sm:max-w-xl"}`} ref={dialogRef} aria-labelledby="add-vocabulary-title" aria-busy={busy} onCancel={cancel} onClick={backdrop}>
      <h2 className="sr-only" id="add-vocabulary-title">Thêm từ vựng</h2>
      <div className="rounded-2xl border border-[#e5e7f0] bg-white p-4 shadow-[0_24px_60px_rgb(15_23_42/30%)] max-[480px]:p-[0.9rem]">
        {step === "search" ? (
          <>
            <header className="flex items-start justify-between gap-4"><div><h2 className="m-0 text-[1.15rem] font-semibold">Thêm từ vựng</h2><p className="mt-1 mb-0 text-[0.8rem] font-normal leading-[1.45] text-slate-500">Tìm từ hệ thống hoặc từ riêng của bạn.</p></div><button className={BUTTON_CLASSES} type="button" aria-label="Đóng" onClick={closeWhenSafe} disabled={busy}><X aria-hidden="true" /></button></header>
            {error ? <p className={ERROR_CLASSES} role="alert">{error}</p> : null}
            <form className="mt-[0.85rem]" role="search" onSubmit={search}>
              <label className="grid gap-[0.3rem] text-sm font-semibold text-slate-700" htmlFor="add-vocabulary-query">Tìm từ vựng<span className="flex min-h-10 items-center rounded-[0.7rem] border border-[#d7dce6] bg-white transition-[border-color,box-shadow] duration-150 focus-within:border-[var(--accent-primary)] focus-within:shadow-[0_0_0_3px_var(--accent-primary-focus)] hover:border-[#aeb8c9]"><input className="h-10 min-w-0 flex-1 border-0 bg-transparent px-3 py-[0.58rem] text-sm leading-[1.35] outline-0" ref={searchRef} id="add-vocabulary-query" type="text" role="searchbox" value={query} onChange={(event) => updateQuery(event.target.value)} disabled={busy} autoComplete="off" />{query ? <button type="button" className="inline-grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] disabled:cursor-not-allowed disabled:opacity-60" aria-label="Xóa từ khóa" onClick={clearQuery} disabled={busy}><X aria-hidden="true" /></button> : null}<button type="submit" className="inline-grid size-10 shrink-0 cursor-pointer place-items-center border-0 border-l border-slate-200 bg-transparent p-0 text-[var(--accent-primary-pressed)] transition-colors hover:text-[var(--accent-primary)] focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-primary-focus)] disabled:cursor-not-allowed disabled:opacity-60" aria-label="Tìm kiếm" disabled={busy || searchState === "loading"}>{searchState === "loading" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}</button></span></label>
            </form>
            {searchState === "validation" ? <p className={ERROR_CLASSES} role="alert">Nhập từ khóa trước khi tìm kiếm.</p> : null}
            {searchState === "error" ? <p className={ERROR_CLASSES} role="alert">Không thể tìm từ vựng. Vui lòng thử lại.</p> : null}
            {searchState === "ready" && results.length === 0 ? <p className="text-slate-500" role="status">Không tìm thấy từ phù hợp.</p> : null}
            {searchState === "ready" && results.length > 0 ? <ul className="my-3 grid max-h-72 list-none gap-[0.4rem] overflow-auto p-0">{results.map((item) => { const added = existingIds.has(item.id); const adding = pendingId === item.id; return <li className="flex items-center justify-between gap-4 rounded-xl border border-transparent bg-[#f7f8fc] px-[0.65rem] py-[0.6rem] transition-[border-color,background-color] duration-150 hover:border-[#dfe3f4] hover:bg-[#fafaff] max-[800px]:items-stretch max-[800px]:flex-col motion-reduce:transition-none" key={item.id}><div><strong>{item.word}</strong>{item.phonetic ? <span className="mt-[0.2rem] block font-normal text-slate-500">{item.phonetic}</span> : null}<small className="mt-[0.2rem] block font-normal text-slate-500">{item.source === "CANONICAL" ? "Từ hệ thống" : "Từ của tôi"}{item.primary_meaning ? ` · ${item.primary_meaning.meaning_vi}` : ""}</small></div><button className={`${BUTTON_CLASSES} max-[800px]:w-full`} type="button" disabled={busy || added} aria-busy={adding} onClick={() => void add(item)}>{added ? "Đã có trong bộ" : adding ? "Đang thêm…" : "Thêm"}</button></li>; })}</ul> : null}
            <footer className="mt-3 flex items-center justify-between gap-2 border-t border-[#edf0f5] pt-3 max-[480px]:mt-[0.6rem] max-[480px]:pt-[0.6rem]"><button className={BUTTON_CLASSES} ref={createTriggerRef} type="button" onClick={() => { setStep("create"); setError(null); }} disabled={busy}><Plus aria-hidden="true" />Tạo từ mới</button><button className={BUTTON_CLASSES} type="button" onClick={closeWhenSafe} disabled={busy}>Hủy</button></footer>
          </>
        ) : (
          <>
            <header className="mb-[0.65rem] flex items-center justify-between gap-3"><button className={BUTTON_CLASSES} type="button" onClick={showSearch} disabled={busy}><ArrowLeft aria-hidden="true" />Quay lại tìm kiếm</button><button className={`${BUTTON_CLASSES} size-10 shrink-0 p-0`} type="button" aria-label="Đóng" onClick={closeWhenSafe} disabled={busy}><X aria-hidden="true" /></button></header>
            <PrivateVocabularyEditor embedded error={error} initialValue={null} mode="create" onCancel={showSearch} onSubmit={create} pending={pendingId === "create"} />
          </>
        )}
      </div>
    </dialog>
  );
}

function normalizeSearchQuery(value) {
  return value.trim().replace(/\s+/gu, " ");
}

function safeMessage(error, fallback) {
  const messages = {
    VOCABULARY_ALREADY_IN_SET: "Từ vựng này đã có trong bộ.",
    VOCABULARY_NOT_FOUND: "Từ vựng không còn khả dụng.",
    VOCABULARY_SET_NOT_FOUND: "Bộ từ không còn khả dụng.",
    VALIDATION_ERROR: "Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại.",
    PRIVATE_VOCABULARY_OPERATION_CONFLICT: "Yêu cầu tạo từ không còn hợp lệ. Hãy đóng và thử lại.",
  };
  return messages[error?.code] ?? fallback;
}
