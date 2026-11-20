import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PasswordField({ id, label, error, hint, ...inputProps }) {
  const [isVisible, setIsVisible] = useState(false);
  const descriptionId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[0.82rem] font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isVisible ? "text" : "password"}
          aria-invalid={Boolean(error)}
          aria-describedby={descriptionId}
          className={`min-h-11 w-full rounded-xl border bg-white py-2.5 pr-12 pl-3.5 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:ring-1 motion-reduce:transition-none ${
            error
              ? "border-red-300 focus:border-red-500 focus:ring-red-100"
              : "border-slate-200 focus:border-[#4ca2e6] focus:ring-[rgb(76_162_230/20%)]"
          }`}
          {...inputProps}
        />
        <button
          type="button"
          onClick={() => setIsVisible((current) => !current)}
          className="absolute inset-y-0 right-1 flex min-w-10 cursor-pointer items-center justify-center rounded-lg bg-transparent text-sm font-[550] text-slate-500 outline-none transition-colors hover:text-[#4ca2e6] focus-visible:text-[#4ca2e6] focus-visible:ring-2 focus-visible:ring-[#4ca2e6] motion-reduce:transition-none"
          aria-label={isVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        >
          {isVisible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-xs font-medium text-red-600">
          <span aria-hidden="true">•</span>
          {error.message}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
