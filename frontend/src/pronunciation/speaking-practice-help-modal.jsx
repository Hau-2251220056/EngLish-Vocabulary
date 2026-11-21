import { useEffect, useRef, useState } from "react";

const GUIDANCE = Object.freeze({
  iosChrome: Object.freeze({
    label: "iPhone/iPad · Chrome",
    steps: Object.freeze([
      "Mở Cài đặt trên iPhone/iPad, sau đó chọn Chrome.",
      "Bật “Micrô”.",
      "Bật “Nhận dạng Lời nói”. Microphone được cho phép vẫn có thể chưa đủ nếu quyền nhận dạng lời nói đang tắt.",
      "Quay lại ELVocab và thử Luyện nói lần nữa.",
    ]),
  }),
  iosSafari: Object.freeze({
    label: "iPhone/iPad · Safari",
    steps: Object.freeze([
      "Mở Cài đặt → Safari → Micrô, sau đó chọn “Cho phép”.",
      "Mở Cài đặt → Quyền riêng tư & Bảo mật → Nhận dạng Lời nói.",
      "Nếu Safari xuất hiện trong danh sách, hãy bật quyền cho Safari.",
      "Nếu cần, kiểm tra quyền microphone riêng của website ELVocab trong Safari.",
      "Quay lại ELVocab và thử lại.",
    ]),
  }),
  android: Object.freeze({
    label: "Android",
    steps: Object.freeze([
      "Kiểm tra quyền microphone của ứng dụng trình duyệt trong cài đặt thiết bị.",
      "Kiểm tra quyền microphone của website ELVocab trong trình duyệt. Tên menu có thể khác nhau tùy thiết bị.",
      "Quay lại trình duyệt và thử lại.",
    ]),
  }),
  desktop: Object.freeze({
    label: "Máy tính",
    steps: Object.freeze([
      "Mở điều khiển quyền của website ở gần thanh địa chỉ.",
      "Cho phép microphone nếu quyền đã bị chặn.",
      "Thử lại, hoặc dùng trình duyệt có hỗ trợ nhận dạng giọng nói.",
    ]),
  }),
});

const TAB_CLASSES = "min-h-11 rounded-lg border-0 bg-transparent px-3 text-sm font-bold text-slate-600 hover:bg-sky-50 hover:text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 aria-pressed:bg-sky-100 aria-pressed:text-sky-900";

export function SpeakingPermissionHelpModal({ onClose }) {
  const [platform, setPlatform] = useState(() => detectGuidancePlatform(globalThis.navigator));
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  useDialogBehavior({ dialogRef, initialFocusRef: closeRef, onClose });
  const guidance = GUIDANCE[platform];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-3" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="permission-help-title" className="max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-sky-200 bg-white p-[clamp(1rem,4vw,1.75rem)] shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="permission-help-title" className="m-0 text-xl font-black text-slate-950">Hướng dẫn quyền microphone</h2>
            <p className="mb-0 mt-1 text-sm leading-relaxed text-slate-600">Chọn thiết bị và trình duyệt bạn đang dùng. ELVocab không thể tự thay đổi quyền hệ thống.</p>
          </div>
          <button ref={closeRef} type="button" className="min-h-11 shrink-0 rounded-lg border-0 bg-transparent px-3 font-bold text-sky-700 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300" onClick={onClose}>Đóng</button>
        </div>
        <div className="mt-4 flex flex-wrap gap-1" role="group" aria-label="Chọn thiết bị và trình duyệt">
          {Object.entries(GUIDANCE).map(([key, item]) => <button key={key} type="button" aria-pressed={platform === key} className={TAB_CLASSES} onClick={() => setPlatform(key)}>{item.label}</button>)}
        </div>
        <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50/70 p-4" aria-live="polite">
          <h3 className="m-0 text-base font-black text-slate-900">{guidance.label}</h3>
          <ol className="mb-0 mt-3 grid gap-2 pl-5 text-sm leading-relaxed text-slate-700">{guidance.steps.map((step) => <li key={step}>{step}</li>)}</ol>
        </div>
      </section>
    </div>
  );
}

export function SpeakingPrivacyModal({ disclosure, onClose }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  useDialogBehavior({ dialogRef, initialFocusRef: closeRef, onClose });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-3" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="speaking-privacy-title" className="max-h-[calc(100dvh-1.5rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-sky-200 bg-white p-[clamp(1rem,4vw,1.75rem)] shadow-2xl">
        <h2 id="speaking-privacy-title" className="m-0 text-xl font-black text-slate-950">Thông tin xử lý giọng nói</h2>
        <div className="mt-3 grid gap-2 text-sm leading-relaxed text-slate-700">{disclosure.paragraphs.map((paragraph) => <p className="m-0" key={paragraph}>{paragraph}</p>)}</div>
        <div className="mt-5 text-right"><button ref={closeRef} type="button" className="min-h-11 rounded-lg border-0 bg-transparent px-3 font-bold text-sky-700 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300" onClick={onClose}>Đóng</button></div>
      </section>
    </div>
  );
}

function detectGuidancePlatform(navigatorObject) {
  const userAgent = navigatorObject?.userAgent ?? "";
  const platform = navigatorObject?.platform ?? "";
  const ios = /iPad|iPhone|iPod/i.test(userAgent) || (platform === "MacIntel" && navigatorObject?.maxTouchPoints > 1);
  if (ios) return /CriOS/i.test(userAgent) ? "iosChrome" : "iosSafari";
  if (/Android/i.test(userAgent)) return "android";
  return "desktop";
}

function useDialogBehavior({ dialogRef, initialFocusRef, onClose }) {
  useEffect(() => {
    const returnFocus = document.activeElement;
    initialFocusRef.current?.focus();
    function handleKeyDown(event) {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab") return;
      const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, [dialogRef, initialFocusRef, onClose]);
}
