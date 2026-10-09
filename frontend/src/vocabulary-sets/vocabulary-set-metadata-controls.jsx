import { ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { NativeSelect } from "../components/native-select.jsx";

const FIELD_CLASSES = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary-focus)] disabled:cursor-not-allowed disabled:opacity-60";

export function VocabularySetMetadataControls({ compact = false, idPrefix, legend = "Thông tin hiển thị", requiredCefr, showCefr = true, value, onChange, pending }) {
  const objectUrl = useMemo(() => value.coverFile ? URL.createObjectURL(value.coverFile) : null, [value.coverFile]);

  useEffect(() => {
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [objectUrl]);

  const preview = objectUrl || value.coverUrl || null;
  const chooseFile = (file) => onChange({ ...value, coverFile: file ?? null, coverUrl: file ? "" : value.coverUrl, coverUrlDirty: false, removeCover: false });

  return (
    <fieldset className={`grid rounded-xl border border-slate-200 ${compact ? "gap-2 p-3" : "mt-3 gap-3 p-4"}`} disabled={pending}>
      <legend className="px-1 font-semibold text-slate-800">{legend}</legend>
      {showCefr ? <VocabularySetCefrControl idPrefix={idPrefix} required={requiredCefr} value={value} onChange={onChange} pending={pending} /> : null}

      <label className="grid gap-1.5 font-semibold text-slate-700" htmlFor={`${idPrefix}-cover-url`}>
        URL ảnh bìa HTTPS
        <input className={FIELD_CLASSES} id={`${idPrefix}-cover-url`} type="url" inputMode="url" placeholder="https://…" value={value.coverUrl} onChange={(event) => onChange({ ...value, coverUrl: event.target.value, coverFile: null, coverUrlDirty: true, removeCover: false })} />
      </label>
      <div className="text-sm text-slate-500">Hoặc tải JPEG, PNG, WebP tối đa 5 MiB. Ảnh được tối ưu trước khi lưu.</div>
      <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-[var(--accent-primary-focus)]">
        <ImagePlus className="size-4" aria-hidden="true" /> Chọn ảnh bìa
        <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseFile(event.target.files?.[0])} />
      </label>
      {value.coverFile ? <p className="m-0 text-sm text-slate-600">Đã chọn: {value.coverFile.name}</p> : null}
      {preview && !value.removeCover ? <img className="max-h-40 w-full rounded-xl border border-slate-200 object-contain" src={preview} alt="Xem trước ảnh bìa bộ từ" /> : null}
      {(preview || value.persistedCoverUrl) && !value.removeCover ? (
        <button className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300" type="button" onClick={() => onChange({ ...value, coverUrl: "", coverFile: null, coverUrlDirty: false, removeCover: true })}>
          <Trash2 className="size-4" aria-hidden="true" /> Xóa ảnh bìa
        </button>
      ) : null}
      {value.removeCover ? <p className="m-0 text-sm text-slate-600" role="status">Ảnh bìa sẽ được xóa khi bạn lưu.</p> : null}
    </fieldset>
  );
}

export function VocabularySetCefrControl({ idPrefix, required = false, userPresentation = false, value, onChange, pending = false }) {
  const options = <>
    <option value="">{required ? "Chọn trình độ" : "Không chọn"}</option>
    {["A1", "A2", "B1", "B2", "C1"].map((level) => <option key={level} value={level}>{level}</option>)}
  </>;
  const selectProps = {
    id: `${idPrefix}-cefr`,
    required,
    disabled: pending,
    value: value.cefrLevel,
    onChange: (event) => onChange({ ...value, cefrLevel: event.target.value }),
  };
  return <label className="grid gap-1.5 font-semibold text-slate-700" htmlFor={`${idPrefix}-cefr`}>
    Trình độ CEFR {required ? <span aria-hidden="true">*</span> : <span className="font-normal text-slate-500">(không bắt buộc)</span>}
    {userPresentation
      ? <NativeSelect {...selectProps}>{options}</NativeSelect>
      : <select className={FIELD_CLASSES} {...selectProps}>{options}</select>}
  </label>;
}
