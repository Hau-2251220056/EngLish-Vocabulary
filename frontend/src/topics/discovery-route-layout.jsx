import { LoaderCircle } from "lucide-react";
import { AuthenticatedShell } from "../auth/ui/authenticated-shell.jsx";
import { useAuthentication } from "../auth/use-authentication.js";
import { PublicTopicLayout } from "./public-topic-layout.jsx";

export function DiscoveryRouteLayout() {
  const { isAuthenticated, isLoading } = useAuthentication();

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8faff] p-6" aria-labelledby="discovery-auth-title">
        <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_12px_30px_rgb(30_41_59/8%)]" role="status" aria-live="polite">
          <span className="inline-flex size-10 items-center justify-center rounded-[0.8rem] bg-indigo-600 font-black text-white" aria-hidden="true">E</span>
          <p className="mb-0 mt-3 font-black text-blue-950">ELVocab</p>
          <div className="mt-5 flex items-center gap-2 text-sm text-slate-600">
            <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            <span id="discovery-auth-title">Đang kiểm tra phiên đăng nhập…</span>
          </div>
        </div>
      </main>
    );
  }

  return isAuthenticated ? <AuthenticatedShell /> : <PublicTopicLayout />;
}
