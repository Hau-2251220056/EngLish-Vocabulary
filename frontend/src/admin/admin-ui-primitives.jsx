import { ChevronLeft, ChevronRight, LoaderCircle, TriangleAlert } from "lucide-react";
import { useEffect, useId, useRef } from "react";

export function AdminBadge({ children, className = "", label, tone = "sky" }) {
  return <span className={`admin-badge is-${tone} ${className}`.trim()} aria-label={label}>{children}</span>;
}

export function AdminPlannedNavigationItem({ icon: Icon, label }) {
  return <div className="authenticated-nav-link admin-nav-planned" aria-disabled="true"><Icon className="size-5" aria-hidden="true" /><span>{label}</span><AdminBadge tone="slate">Sắp ra mắt</AdminBadge></div>;
}

export function AdminToolbar({ children, className = "" }) {
  return <div className={`admin-toolbar ${className}`.trim()}>{children}</div>;
}

export function AdminPagination({ busy = false, currentPage, onNext, onPrevious, pageSize, totalItems, totalPages }) {
  const validTotal = Math.max(0, Number(totalItems) || 0);
  const validPages = Math.max(1, Number(totalPages) || 1);
  const validPage = Math.min(Math.max(1, Number(currentPage) || 1), validPages);
  const validPageSize = Math.max(1, Number(pageSize) || validTotal || 1);
  const rangeStart = validTotal === 0 ? 0 : ((validPage - 1) * validPageSize) + 1;
  const rangeEnd = validTotal === 0 ? 0 : Math.min(validPage * validPageSize, validTotal);
  return <nav className="admin-pagination" aria-label="Phân trang" aria-busy={busy || undefined}><span className="admin-pagination-range">Hiển thị <strong>{rangeStart}–{rangeEnd}</strong> / {validTotal} kết quả</span><div className="admin-pagination-controls"><button type="button" onClick={onPrevious} disabled={busy || validPage <= 1}><ChevronLeft aria-hidden="true" />Trước</button><span>Trang <strong>{validPage}</strong>/{validPages}</span><button type="button" onClick={onNext} disabled={busy || validPage >= validPages}>Sau<ChevronRight aria-hidden="true" /></button></div></nav>;
}

export function AdminState({ action, kind = "empty", message, title }) {
  const loading = kind === "loading";
  return <section className={`admin-state is-${kind}`} role={kind === "error" ? "alert" : "status"} aria-live="polite">{loading ? <LoaderCircle className="admin-state-icon animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}{kind === "error" ? <TriangleAlert className="admin-state-icon" aria-hidden="true" /> : null}<h2>{title}</h2><p>{message}</p>{action ? <div className="admin-state-action">{action}</div> : null}</section>;
}

export function AdminDialog({ children, className = "", description, footer, initialFocusRef, onRequestClose, open, returnFocusRef, title, tone = "default" }) {
  const dialogRef = useRef(null);
  const fallbackFocusRef = useRef(null);
  const headingId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const returnTarget = returnFocusRef?.current;
    if (!dialog) return undefined;
    if (open && !dialog.open) {
      dialog.showModal();
      window.requestAnimationFrame(() => (initialFocusRef?.current ?? fallbackFocusRef.current)?.focus());
    } else if (!open && dialog.open) dialog.close();
    return () => {
      if (dialog.open) dialog.close();
      if (open) window.requestAnimationFrame(() => returnTarget?.focus());
    };
  }, [initialFocusRef, open, returnFocusRef]);

  return (
    <dialog ref={dialogRef} className={`admin-dialog is-${tone} ${className}`.trim()} aria-labelledby={headingId} aria-describedby={description ? descriptionId : undefined} onCancel={(event) => { event.preventDefault(); onRequestClose?.("escape"); }} onClick={(event) => { if (event.target === dialogRef.current) onRequestClose?.("backdrop"); }}>
      <div className="admin-dialog-frame">
        <header><div><h2 id={headingId}>{title}</h2>{description ? <p id={descriptionId}>{description}</p> : null}</div><button ref={fallbackFocusRef} type="button" className="admin-dialog-close" aria-label="Đóng hộp thoại" onClick={() => onRequestClose?.("close-button")}>×</button></header>
        <div className="admin-dialog-body">{children}</div>
        {footer ? <footer>{footer}</footer> : null}
      </div>
    </dialog>
  );
}

export function AdminConfirmDialog({ cancelLabel = "Hủy", confirmLabel = "Xác nhận xóa", description, error, note = "Hành động này không thể hoàn tác.", onCancel, onConfirm, open, pending = false, returnFocusRef, title }) {
  const cancelRef = useRef(null);
  return <AdminDialog open={open} title={title} description={description} initialFocusRef={cancelRef} returnFocusRef={returnFocusRef} onRequestClose={() => { if (!pending) onCancel(); }} tone="danger" footer={<><button ref={cancelRef} type="button" onClick={onCancel} disabled={pending}>{cancelLabel}</button><button type="button" className="is-danger" onClick={onConfirm} disabled={pending} aria-busy={pending}>{pending ? "Đang xóa…" : confirmLabel}</button></>}><p className="admin-confirm-copy">{note}</p>{error ? <p className="admin-dialog-error" role="alert">{error}</p> : null}</AdminDialog>;
}
