import { Navigate, Outlet, useLocation } from "react-router-dom";
import { LandingPageLoadingState } from "../../landing/landing-page-loading-state.jsx";
import { AuthenticationLoadingState } from "./authentication-loading-state.jsx";
import { useAuthentication } from "../use-authentication.js";

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuthentication();

  if (isLoading) return <AuthenticationLoadingState />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <Outlet />;
}

export function GuestRoute() {
  const { isAuthenticated, isLoading } = useAuthentication();
  const location = useLocation();

  if (isLoading) {
    return location.pathname === "/"
      ? <LandingPageLoadingState />
      : <AuthenticationLoadingState />;
  }
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
