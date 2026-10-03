import { MoreVertical } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function ActionMenu({ children, label, registerTrigger }) {
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    const closeEscape = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault(); setOpen(false); triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", closeEscape); };
  }, [open]);

  return <div className="action-menu relative inline-flex" ref={rootRef}>
    <button ref={(control) => { triggerRef.current = control; registerTrigger?.(control); }} type="button" className="action-menu-trigger inline-grid size-11 min-w-11 cursor-pointer place-items-center rounded-xl border border-[#dbe3ef] bg-white p-0 text-slate-600 transition-[border-color,background-color,color,box-shadow] duration-150 hover:border-[#bfc7e8] hover:bg-[#f5f6ff] hover:text-indigo-800 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-indigo-200 motion-reduce:transition-none [&_svg]:size-[1.15rem]" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}><MoreVertical aria-hidden="true" /></button>
    {open ? <div className="action-menu-popover absolute right-0 top-[calc(100%+0.35rem)] z-20 grid min-w-40 overflow-hidden rounded-[0.85rem] border border-[#e0e3ee] bg-white p-1.5 shadow-[0_16px_36px_rgb(30_41_59/14%)] [&_button]:flex [&_button]:min-h-11 [&_button]:cursor-pointer [&_button]:items-center [&_button]:gap-2 [&_button]:whitespace-nowrap [&_button]:rounded-lg [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-[0.7rem] [&_button]:py-2.5 [&_button]:font-[inherit] [&_button]:font-semibold [&_button]:text-slate-700 [&_button]:transition-colors [&_button]:duration-150 [&_button:hover]:bg-slate-100 [&_button:focus-visible]:bg-slate-100 [&_button:focus-visible]:outline-3 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-indigo-200 [&_button.is-danger]:text-red-700 [&_button.is-danger:hover]:bg-rose-50 motion-reduce:[&_button]:transition-none" role="menu" onClick={() => setOpen(false)}>{children}</div> : null}
  </div>;
}
