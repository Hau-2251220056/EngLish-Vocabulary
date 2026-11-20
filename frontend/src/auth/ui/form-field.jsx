export function FormField({
  id,
  label,
  error,
  hint,
  className = "",
  ...inputProps
}) {
  const descriptionId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[0.82rem] font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={descriptionId}
        className={`min-h-11 w-full rounded-xl border bg-white px-3.5 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:ring-1 motion-reduce:transition-none ${
          error
            ? "border-red-300 focus:border-red-500 focus:ring-red-100"
            : "border-slate-200 focus:border-[#4ca2e6] focus:ring-[rgb(76_162_230/20%)]"
        } ${className}`}
        {...inputProps}
      />
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
