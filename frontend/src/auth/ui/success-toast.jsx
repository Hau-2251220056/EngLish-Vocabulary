import { Check, CircleAlert, X } from "lucide-react";
import { createPortal } from "react-dom";

const VARIANTS = Object.freeze({
  error: {
    container: "border-red-200",
    icon: "bg-red-100 text-red-700",
    Icon: CircleAlert,
    role: "alert",
    live: "assertive",
  },
  success: {
    container: "border-emerald-200",
    icon: "bg-emerald-100 text-emerald-700",
    Icon: Check,
    role: "status",
    live: "polite",
  },
});

export function AuthNotification({ isVisible, message, onDismiss, title, variant = "success" }) {
  const presentation = VARIANTS[variant];
  const Icon = presentation.Icon;

  const notification = (
    <div
      className={`auth-notification fixed inset-x-4 top-4 z-50 flex items-start gap-3 rounded-2xl border bg-white px-4 py-3 shadow-lg shadow-slate-900/10 transition duration-300 motion-reduce:transition-none sm:inset-x-auto sm:right-5 sm:top-5 sm:w-[min(25rem,calc(100vw-2.5rem))] ${presentation.container} ${
        isVisible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
      }`}
      role={presentation.role}
      aria-live={presentation.live}
      aria-atomic="true"
      aria-hidden={!isVisible}
    >
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${presentation.icon}`}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-800">{title}</p>
        {message ? <p className="mt-0.5 text-sm leading-5 text-slate-600">{message}</p> : null}
      </div>
      {onDismiss && isVisible ? (
        <button
          type="button"
          className="-m-1 inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-500 outline-none transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-[#4ca2e6] motion-reduce:transition-none"
          onClick={onDismiss}
          aria-label="Đóng thông báo"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );

  return typeof document === "undefined" ? notification : createPortal(notification, document.body);
}

export function SuccessToast({ isVisible }) {
  return (
    <AuthNotification
      isVisible={isVisible}
      title="Tạo tài khoản thành công!"
    />
  );
}
