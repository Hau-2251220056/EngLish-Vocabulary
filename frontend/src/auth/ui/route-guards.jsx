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

function AuthenticationLoadingState() {
  return (
    <main className="auth-check-stage" aria-labelledby="auth-check-title">
      <div className="auth-check-card" role="status" aria-live="polite">
        <span className="auth-check-mark" aria-hidden="true">
          E
        </span>
        <p className="auth-check-brand">ELVocab</p>
        <div className="auth-check-message">
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
          <span id="auth-check-title">Đang kiểm tra phiên đăng nhập…</span>
        </div>
      </div>
    </main>
  );
}
