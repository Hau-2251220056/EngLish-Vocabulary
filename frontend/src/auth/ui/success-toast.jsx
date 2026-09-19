import { Check } from "lucide-react";

export function SuccessToast({ isVisible }) {
  return (
    <div
      className={`auth-toast fixed top-4 right-4 left-4 z-50 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3 shadow-lg shadow-slate-900/10 transition duration-300 sm:left-auto sm:min-w-80 ${
        isVisible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
      }`}
      role="status"
      aria-live="polite"
      aria-hidden={!isVisible}
    >
      <span className="flex size-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <Check className="size-5" aria-hidden="true" />
      </span>
      <p className="text-sm font-bold text-slate-800">Tạo tài khoản thành công!</p>
    </div>
  );
}
