import { ChevronDown } from "lucide-react";

const SELECT_CLASSES = "peer min-h-11 w-full appearance-none rounded-xl border border-slate-300 bg-white py-2 pl-3 pr-10 font-[inherit] text-sm font-medium text-slate-700 outline-none transition-[border-color,box-shadow,background-color] duration-150 hover:not-disabled:border-slate-400 focus-visible:border-[var(--accent-primary)] focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-focus)] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 disabled:opacity-60 motion-reduce:transition-none";

export function NativeSelect({ children, className = "", wrapperClassName = "", ...selectProps }) {
  return (
    <span className={`native-select relative block min-w-0 ${wrapperClassName}`}>
      <select className={`${SELECT_CLASSES} ${className}`} {...selectProps}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500 peer-disabled:opacity-50"
        aria-hidden="true"
        focusable="false"
      />
    </span>
  );
}
