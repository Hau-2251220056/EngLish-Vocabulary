import { LoaderCircle, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import {
  privateVocabularyFormValues,
  serializePrivateVocabulary,
  validatePrivateVocabulary,
} from "./private-vocabulary-form-model.js";

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export function PrivateVocabularyEditor({ error, initialValue, mode, onCancel, onSubmit, pending }) {
  const [values, setValues] = useState(() => privateVocabularyFormValues(initialValue));
  const [errors, setErrors] = useState({});

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

  return (
    <div className="my-vocabulary-set-dialog-backdrop">
      <section className="private-vocabulary-dialog" role="dialog" aria-modal="true" aria-labelledby="private-vocabulary-dialog-title">
        <header>
          <div>
            <p>{mode === "edit" ? "Từ vựng của tôi" : "Tạo từ mới"}</p>
            <h2 id="private-vocabulary-dialog-title">{mode === "edit" ? "Chỉnh sửa từ vựng" : "Tạo và thêm vào bộ từ"}</h2>
          </div>
          <button type="button" aria-label="Đóng biểu mẫu từ vựng" onClick={onCancel} disabled={pending}><X aria-hidden="true" /></button>
        </header>
        {mode === "edit" ? <p className="private-vocabulary-warning">Thay đổi này sẽ áp dụng cho mọi bộ từ đang sử dụng cùng từ vựng này.</p> : null}
        {error ? <p className="my-vocabulary-set-field-error" role="alert">{error}</p> : null}
        <form noValidate onSubmit={submit}>
          <div className="private-vocabulary-form-grid">
            <label htmlFor="private-vocabulary-word">Từ vựng<input id="private-vocabulary-word" value={values.word} onChange={(event) => update("word", event.target.value)} disabled={pending} aria-invalid={Boolean(errors.word)} /></label>
            {errors.word ? <FieldError message={errors.word} /> : null}
            <label htmlFor="private-vocabulary-phonetic">Phiên âm <span>(không bắt buộc)</span><input id="private-vocabulary-phonetic" value={values.phonetic} onChange={(event) => update("phonetic", event.target.value)} disabled={pending} /></label>
          </div>
          <div className="private-vocabulary-meanings">
            {values.meanings.map((meaning, meaningIndex) => (
              <fieldset key={meaning.id ?? `meaning-${meaningIndex}`}>
                <legend>Nghĩa {meaningIndex + 1}</legend>
                <div className="private-vocabulary-form-grid">
                  <label>Loại từ<input value={meaning.part_of_speech} onChange={(event) => updateMeaning(meaningIndex, "part_of_speech", event.target.value)} disabled={pending} aria-invalid={Boolean(errors[`part-${meaningIndex}`])} /></label>
                  {errors[`part-${meaningIndex}`] ? <FieldError message={errors[`part-${meaningIndex}`]} /> : null}
                  <label>Nghĩa tiếng Việt<textarea value={meaning.meaning_vi} onChange={(event) => updateMeaning(meaningIndex, "meaning_vi", event.target.value)} disabled={pending} aria-invalid={Boolean(errors[`meaning-${meaningIndex}`])} /></label>
                  {errors[`meaning-${meaningIndex}`] ? <FieldError message={errors[`meaning-${meaningIndex}`]} /> : null}
                  <label>Ngữ cảnh <span>(không bắt buộc)</span><textarea value={meaning.context} onChange={(event) => updateMeaning(meaningIndex, "context", event.target.value)} disabled={pending} /></label>
                  <label>CEFR <span>(không bắt buộc)</span><select value={meaning.cefr_level} onChange={(event) => updateMeaning(meaningIndex, "cefr_level", event.target.value)} disabled={pending}><option value="">Chưa chọn</option>{CEFR_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}</select></label>
                </div>
                <div className="private-vocabulary-examples">
                  <div><h3>Ví dụ</h3><button type="button" onClick={() => addExample(meaningIndex)} disabled={pending}><Plus aria-hidden="true" />Thêm ví dụ</button></div>
                  {meaning.examples.map((example, exampleIndex) => (
                    <div className="private-vocabulary-example" key={example.id ?? `example-${exampleIndex}`}>
                      <label>Ví dụ tiếng Anh<textarea value={example.example_en} onChange={(event) => updateExample(meaningIndex, exampleIndex, "example_en", event.target.value)} disabled={pending} aria-invalid={Boolean(errors[`example-${meaningIndex}-${exampleIndex}`])} />{errors[`example-${meaningIndex}-${exampleIndex}`] ? <span className="private-vocabulary-inline-error">{errors[`example-${meaningIndex}-${exampleIndex}`]}</span> : null}</label>
                      <label>Bản dịch tiếng Việt <span>(không bắt buộc)</span><textarea value={example.example_vi} onChange={(event) => updateExample(meaningIndex, exampleIndex, "example_vi", event.target.value)} disabled={pending} /></label>
                      <button type="button" onClick={() => removeExample(meaningIndex, exampleIndex)} disabled={pending}><Trash2 aria-hidden="true" />Xóa ví dụ</button>
                    </div>
                  ))}
                </div>
                <button type="button" className="private-vocabulary-remove-meaning" onClick={() => removeMeaning(meaningIndex)} disabled={pending || values.meanings.length === 1}><Trash2 aria-hidden="true" />Xóa nghĩa</button>
              </fieldset>
            ))}
          </div>
          <button type="button" className="private-vocabulary-add-meaning" onClick={addMeaning} disabled={pending}><Plus aria-hidden="true" />Thêm nghĩa</button>
          <footer><button type="button" onClick={onCancel} disabled={pending}>Hủy</button><button type="submit" className="my-vocabulary-sets-primary" disabled={pending} aria-busy={pending}>{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}{pending ? "Đang lưu…" : mode === "edit" ? "Lưu thay đổi" : "Tạo và thêm"}</button></footer>
        </form>
      </section>
    </div>
  );
}

function blankMeaning() {
  return { part_of_speech: "", meaning_vi: "", context: "", cefr_level: "", examples: [] };
}
function blankExample() {
  return { example_en: "", example_vi: "" };
}
function FieldError({ message }) {
  return <p className="my-vocabulary-set-field-error" role="alert">{message}</p>;
}
