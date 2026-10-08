import { LoaderCircle, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  privateVocabularyFormValues,
  serializePrivateVocabulary,
  validatePrivateVocabulary,
} from "./private-vocabulary-form-model.js";

const PARTS_OF_SPEECH = [
  ["noun", "Noun"], ["verb", "Verb"], ["adjective", "Adjective"],
  ["adverb", "Adverb"], ["pronoun", "Pronoun"], ["preposition", "Preposition"],
  ["conjunction", "Conjunction"], ["interjection", "Interjection"],
  ["determiner", "Determiner"], ["phrase", "Phrase"], ["other", "Other"],
];
const BUTTON_CLASSES = "inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-[0.7rem] border border-slate-300 bg-white px-[0.65rem] py-[0.42rem] text-[0.8rem] font-medium text-slate-700 transition-[border-color,background-color,color,box-shadow,transform] duration-150 hover:not-disabled:border-[#b8d9f1] hover:not-disabled:bg-[var(--accent-primary-soft)] hover:not-disabled:text-[var(--accent-primary-pressed)] focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none [&_svg]:size-4";
const FIELD_CLASSES = "h-10 min-h-10 w-full rounded-[0.6rem] border border-[#d7dce6] bg-white px-[0.65rem] py-[0.45rem] text-[0.84rem] leading-[1.35] text-slate-900 outline-0 transition-[border-color,box-shadow,background-color] duration-150 hover:not-disabled:border-[#aeb8c9] focus:border-[var(--accent-primary)] focus:shadow-[0_0_0_3px_var(--accent-primary-focus)] focus-visible:outline-0 aria-invalid:border-[#dc6b6b] aria-invalid:shadow-[0_0_0_1px_rgb(220_107_107/22%)] disabled:cursor-not-allowed motion-reduce:transition-none";
const TEXTAREA_CLASSES = `${FIELD_CLASSES} resize-none`;
const LABEL_CLASSES = "grid gap-[0.2rem] text-[0.78rem] font-medium text-slate-700";
const OPTIONAL_LABEL_CLASSES = "flex flex-wrap items-baseline gap-x-1 text-[0.78rem] font-medium text-slate-700 [&_span]:text-[0.72rem] [&_span]:font-normal [&_span]:text-slate-500";

export function PrivateVocabularyEditor({ embedded = false, error, initialValue, mode, onCancel, onSubmit, pending }) {
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(null);
  const [values, setValues] = useState(() => privateVocabularyFormValues(initialValue));
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (embedded) return undefined;
    const dialog = dialogRef.current;
    returnFocusRef.current = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      document.body.style.overflow = overflow;
      returnFocusRef.current?.focus?.();
    };
  }, [embedded]);

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
  }
  function updateMeaning(index, field, value) {
    setValues((current) => ({
      ...current,
      meanings: current.meanings.map((meaning, itemIndex) =>
        itemIndex === index ? { ...meaning, [field]: value } : meaning),
    }));
  }
  function updateExample(meaningIndex, exampleIndex, field, value) {
    setValues((current) => ({
      ...current,
      meanings: current.meanings.map((meaning, itemIndex) => itemIndex !== meaningIndex
        ? meaning
        : {
            ...meaning,
            examples: meaning.examples.map((example, childIndex) =>
              childIndex === exampleIndex ? { ...example, [field]: value } : example),
          }),
    }));
  }
  function addMeaning() {
    setValues((current) => ({ ...current, meanings: [...current.meanings, blankMeaning()] }));
  }
  function removeMeaning(index) {
    if (values.meanings.length === 1) return;
    setValues((current) => ({
      ...current,
      meanings: current.meanings.filter((_, itemIndex) => itemIndex !== index),
    }));
  }
  function addExample(meaningIndex) {
    updateMeaning(meaningIndex, "examples", [...values.meanings[meaningIndex].examples, blankExample()]);
  }
  function removeExample(meaningIndex, exampleIndex) {
    updateMeaning(
      meaningIndex,
      "examples",
      values.meanings[meaningIndex].examples.filter((_, index) => index !== exampleIndex),
    );
  }
  async function submit(event) {
    event.preventDefault();
    const nextErrors = validatePrivateVocabulary(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSubmit(serializePrivateVocabulary(values));
  }

  const panel = (
      <section className={`private-vocabulary-dialog w-full max-w-[38rem] overflow-auto rounded-[1.15rem] border border-[#e5e7f0] bg-white p-[0.85rem] shadow-[0_20px_45px_rgb(15_23_42/30%)] max-[700px]:p-[0.8rem] ${embedded ? "max-h-none max-w-none overflow-visible border-0 p-0 shadow-none max-[700px]:p-0" : "max-h-[calc(100dvh-2rem)]"}`} aria-labelledby="private-vocabulary-dialog-title">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="m-0 text-[0.68rem] font-semibold tracking-[0.06em] text-[var(--accent-primary-pressed)] uppercase">{mode === "edit" ? "Từ vựng của tôi" : "Tạo từ mới"}</p>
            <h2 className="m-0 text-[1.1rem] leading-tight font-semibold" id="private-vocabulary-dialog-title">{mode === "edit" ? "Chỉnh sửa từ vựng" : "Tạo và thêm vào bộ từ"}</h2>
          </div>
          {!embedded ? <button className={`${BUTTON_CLASSES} size-10 p-0`} type="button" aria-label="Đóng biểu mẫu từ vựng" onClick={onCancel} disabled={pending}><X aria-hidden="true" /></button> : null}
        </header>
        {mode === "edit" ? <p className="my-[0.45rem] rounded-[0.7rem] border border-[#fde7c2] bg-[#fffaf2] px-[0.6rem] py-[0.45rem] text-[0.76rem] leading-[1.4] text-[#8a4b12]">Thay đổi này sẽ áp dụng cho mọi bộ từ đang sử dụng cùng từ vựng này.</p> : null}
        {error ? <p className="my-2 rounded-[0.7rem] bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">{error}</p> : null}
        <form className="mt-[0.4rem]" noValidate onSubmit={submit}>
          <div className="grid grid-cols-2 items-start gap-x-[0.6rem] gap-y-[0.42rem] max-[700px]:grid-cols-1">
            <div className="grid gap-[0.2rem]"><label className={LABEL_CLASSES} htmlFor="private-vocabulary-word">Từ vựng<input className={FIELD_CLASSES} id="private-vocabulary-word" value={values.word} onChange={(event) => update("word", event.target.value)} disabled={pending} aria-invalid={Boolean(errors.word)} /></label>{errors.word ? <FieldError message={errors.word} /> : null}</div>
            <label className={LABEL_CLASSES} htmlFor="private-vocabulary-phonetic"><span className={OPTIONAL_LABEL_CLASSES}>Phiên âm <span>(không bắt buộc)</span></span><input className={FIELD_CLASSES} id="private-vocabulary-phonetic" value={values.phonetic} onChange={(event) => update("phonetic", event.target.value)} disabled={pending} /></label>
          </div>
          <div className="mt-2 grid gap-[0.65rem]">
            {values.meanings.map((meaning, meaningIndex) => (
              <fieldset className="m-0 border-0 border-t border-[#e8ebf1] p-0 pt-[0.55rem]" key={meaning.id ?? `meaning-${meaningIndex}`}>
                <legend className="pr-[0.35rem] text-[0.84rem] font-semibold text-slate-800">Nghĩa {meaningIndex + 1}</legend>
                <div className="grid grid-cols-2 items-start gap-x-[0.6rem] gap-y-[0.42rem] max-[700px]:grid-cols-1">
                  <div className="grid gap-[0.2rem]"><label className={LABEL_CLASSES}>Loại từ<select className={`${FIELD_CLASSES} cursor-pointer`} value={meaning.part_of_speech} onChange={(event) => updateMeaning(meaningIndex, "part_of_speech", event.target.value)} disabled={pending} aria-invalid={Boolean(errors[`part-${meaningIndex}`])}><option value="">Chọn loại từ</option>{meaning.part_of_speech && !PARTS_OF_SPEECH.some(([value]) => value === meaning.part_of_speech) ? <option value={meaning.part_of_speech}>{meaning.part_of_speech}</option> : null}{PARTS_OF_SPEECH.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{errors[`part-${meaningIndex}`] ? <FieldError message={errors[`part-${meaningIndex}`]} /> : null}</div>
                  <div className="grid gap-[0.2rem]"><label className={LABEL_CLASSES}>Nghĩa tiếng Việt<textarea className={TEXTAREA_CLASSES} value={meaning.meaning_vi} onChange={(event) => updateMeaning(meaningIndex, "meaning_vi", event.target.value)} disabled={pending} aria-invalid={Boolean(errors[`meaning-${meaningIndex}`])} /></label>{errors[`meaning-${meaningIndex}`] ? <FieldError message={errors[`meaning-${meaningIndex}`]} /> : null}</div>
                  <label className={LABEL_CLASSES}><span className={OPTIONAL_LABEL_CLASSES}>Ngữ cảnh <span>(không bắt buộc)</span></span><textarea className={TEXTAREA_CLASSES} value={meaning.context} onChange={(event) => updateMeaning(meaningIndex, "context", event.target.value)} disabled={pending} /></label>
                  <div className="flex h-full items-end justify-end max-[700px]:justify-start"><button className={BUTTON_CLASSES} type="button" onClick={() => addExample(meaningIndex)} disabled={pending}><Plus aria-hidden="true" />Thêm ví dụ</button></div>
                </div>
                <div className="mt-2 border-t border-slate-200 pt-[0.45rem]">
                  <h3 className="m-0 text-[0.82rem] font-semibold">Ví dụ</h3>
                  {meaning.examples.map((example, exampleIndex) => (
                    <div className="mt-[0.4rem] grid grid-cols-[1fr_1fr_auto] items-end gap-[0.4rem] max-[700px]:grid-cols-1" key={example.id ?? `example-${exampleIndex}`}>
                      <label className={LABEL_CLASSES}>Ví dụ tiếng Anh<textarea className={TEXTAREA_CLASSES} value={example.example_en} onChange={(event) => updateExample(meaningIndex, exampleIndex, "example_en", event.target.value)} disabled={pending} aria-invalid={Boolean(errors[`example-${meaningIndex}-${exampleIndex}`])} />{errors[`example-${meaningIndex}-${exampleIndex}`] ? <span className="text-[0.85rem] font-semibold! text-red-700!">{errors[`example-${meaningIndex}-${exampleIndex}`]}</span> : null}</label>
                      <label className={LABEL_CLASSES}><span className={OPTIONAL_LABEL_CLASSES}>Bản dịch tiếng Việt <span>(không bắt buộc)</span></span><textarea className={TEXTAREA_CLASSES} value={example.example_vi} onChange={(event) => updateExample(meaningIndex, exampleIndex, "example_vi", event.target.value)} disabled={pending} /></label>
                      <button className={BUTTON_CLASSES} type="button" onClick={() => removeExample(meaningIndex, exampleIndex)} disabled={pending}><Trash2 aria-hidden="true" />Xóa ví dụ</button>
                    </div>
                  ))}
                </div>
                <button type="button" className={`${BUTTON_CLASSES} mt-[0.45rem] text-red-700 hover:not-disabled:border-rose-300 hover:not-disabled:bg-rose-50 hover:not-disabled:text-rose-800`} onClick={() => removeMeaning(meaningIndex)} disabled={pending || values.meanings.length === 1}><Trash2 aria-hidden="true" />Xóa nghĩa</button>
              </fieldset>
            ))}
          </div>
          <button type="button" className={`${BUTTON_CLASSES} mt-[0.45rem]`} onClick={addMeaning} disabled={pending}><Plus aria-hidden="true" />Thêm nghĩa</button>
          <footer className="mt-[0.55rem] flex justify-end gap-2 border-t border-[#e8ebf1] pt-[0.55rem] max-[700px]:flex-col-reverse max-[700px]:[&_button]:min-h-11 max-[700px]:[&_button]:w-full"><button className={BUTTON_CLASSES} type="button" onClick={onCancel} disabled={pending}>Hủy</button><button type="submit" className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-[0.7rem] border-0 bg-[var(--accent-primary)] px-[0.65rem] py-[0.42rem] text-[0.8rem] font-medium text-white shadow-[0_4px_12px_rgb(76_162_230/16%)] transition-[background-color,box-shadow,transform] duration-150 hover:not-disabled:-translate-y-px hover:not-disabled:bg-[var(--accent-primary-hover)] hover:not-disabled:shadow-[0_6px_16px_rgb(76_162_230/20%)] active:translate-y-0 active:bg-[var(--accent-primary-pressed)] focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transform-none motion-reduce:transition-none" disabled={pending} aria-busy={pending}>{pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}{pending ? "Đang lưu…" : mode === "edit" ? "Lưu thay đổi" : "Tạo và thêm"}</button></footer>
        </form>
      </section>
  );
  if (embedded) return <div className="private-vocabulary-embedded">{panel}</div>;
  return <dialog ref={dialogRef} className="m-auto max-h-[calc(100vh-2rem)] w-[min(calc(100%-2rem),38rem)] max-w-none overflow-hidden border-0 bg-transparent p-0 backdrop:bg-slate-900/50" aria-labelledby="private-vocabulary-dialog-title" onClick={(event) => { if (event.target === dialogRef.current && !pending) onCancel(); }} onCancel={(event) => { event.preventDefault(); if (!pending) onCancel(); }}>{panel}</dialog>;
}

function blankMeaning() {
  return { part_of_speech: "", meaning_vi: "", context: "", cefr_level: "", examples: [] };
}
function blankExample() {
  return { example_en: "", example_vi: "" };
}
function FieldError({ message }) {
  return <p className="m-0 rounded-[0.7rem] bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">{message}</p>;
}
