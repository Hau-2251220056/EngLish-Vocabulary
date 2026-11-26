import { Link } from "react-router-dom";

export function LearnerFooter() {
  return (
    <footer className="learner-footer mt-auto flex min-h-14 shrink-0 flex-col items-center justify-center gap-1 border-t border-slate-200 px-4 py-2 text-center text-xs text-slate-500 sm:flex-row sm:justify-between sm:px-8 sm:text-[0.8125rem] lg:px-10">
      <span>© 2026 ELVocab.</span>
      <Link className="inline-flex min-h-11 items-center rounded-md font-medium text-slate-600 underline-offset-4 transition-colors hover:text-sky-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 motion-reduce:transition-none" to="/data-sources">
        Nguồn dữ liệu
      </Link>
    </footer>
  );
}

export function AuthFooter() {
  return (
    <footer className="auth-footer shrink-0 px-4 pb-4 pt-3 text-center text-xs leading-5 text-slate-500 sm:text-[0.8125rem]">
      <p className="m-0">
        <Link className="inline-flex min-h-11 items-center rounded-md font-medium text-slate-600 underline-offset-4 hover:text-sky-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200" to="/">Trang chủ</Link>
        <span aria-hidden="true"> · </span>
        <Link className="inline-flex min-h-11 items-center rounded-md font-medium text-slate-600 underline-offset-4 hover:text-sky-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200" to="/data-sources">Nguồn dữ liệu</Link>
      </p>
      <p className="m-0">© 2026 ELVocab. Dự án phục vụ mục đích giáo dục.</p>
    </footer>
  );
}
