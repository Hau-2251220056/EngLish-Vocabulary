import { LoadingIndicator } from "../../components/loading-indicator.jsx";

export function AuthenticationLoadingState() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8faff] p-6">
      <div className="flex flex-col items-center rounded-2xl border border-sky-100 bg-white p-8 shadow-[0_12px_30px_rgb(30_41_59/8%)]">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[0.8rem] bg-[#0877b9] font-black text-white" aria-hidden="true">
          E
        </span>
        <p className="mb-0 mt-3 font-black text-blue-950">ELVocab</p>
        <div className="mt-5">
          <LoadingIndicator label="Đang kiểm tra phiên đăng nhập…" variant="centered" />
        </div>
      </div>
    </main>
  );
}
