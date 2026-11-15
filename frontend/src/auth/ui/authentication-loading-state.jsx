import { LoadingIndicator } from "../../components/loading-indicator.jsx";

export function AuthenticationLoadingState({ error = null, onRetry = null }) {
  const recovery = error !== null && typeof onRetry === "function";
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8faff] p-6">
      <div className="flex flex-col items-center rounded-2xl border border-sky-100 bg-white p-8 shadow-[0_12px_30px_rgb(30_41_59/8%)]">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[0.8rem] bg-[#0877b9] font-black text-white" aria-hidden="true">
          E
        </span>
        <p className="mb-0 mt-3 font-black text-blue-950">ELVocab</p>
        {recovery ? (
          <div className="mt-5 max-w-sm text-center" role="alert">
            <p className="m-0 font-bold text-red-800">Không thể xác minh phiên đăng nhập lúc này.</p>
            <p className="mb-0 mt-2 text-sm leading-relaxed text-slate-600">Phiên của bạn chưa bị đăng xuất. Hãy thử xác minh lại khi dịch vụ sẵn sàng.</p>
            <button className="mt-5 min-h-11 cursor-pointer rounded-lg bg-[#0877b9] px-5 py-2.5 font-extrabold text-white hover:bg-[#075f95] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#0877b9]/30" type="button" onClick={onRetry}>Thử lại</button>
          </div>
        ) : (
          <div className="mt-5">
            <LoadingIndicator label="Đang kiểm tra phiên đăng nhập…" variant="centered" />
          </div>
        )}
      </div>
    </main>
  );
}
