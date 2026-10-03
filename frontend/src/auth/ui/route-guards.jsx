import { LoaderCircle } from "lucide-react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuthentication } from "../use-authentication.js";

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuthentication();

  if (isLoading) return <AuthenticationLoadingState />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <Outlet />;
}

export function GuestRoute() {
  const { isAuthenticated, isLoading } = useAuthentication();

  if (isLoading) return <AuthenticationLoadingState />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}

export function AdminRoute() {
  const { user } = useAuthentication();

  if (user?.role !== "ADMIN") return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}

export function UserRoute() {
  const { user } = useAuthentication();

  if (user?.role !== "USER") return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}

function AuthenticationLoadingState() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8faff] p-6" aria-labelledby="auth-check-title">
      <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_12px_30px_rgb(30_41_59/8%)]" role="status" aria-live="polite">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[0.8rem] bg-indigo-600 font-black text-white" aria-hidden="true">
          E
        </span>
        <p className="mt-3 mb-0 font-black text-blue-950">ELVocab</p>
        <div className="mt-5 flex items-center gap-[0.6rem] text-sm text-slate-600">
          <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          <span id="auth-check-title">Đang kiểm tra phiên đăng nhập…</span>
        </div>
      </div>
    </main>
  );
}
