import { BookOpenCheck, LoaderCircle, LogOut, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuthentication } from "../use-authentication.js";

const LOGOUT_ERROR_MESSAGE = "Không thể đăng xuất lúc này. Vui lòng thử lại.";

export function AuthenticatedShell() {
  const navigate = useNavigate();
  const { logout, user } = useAuthentication();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState(null);

  async function handleLogout() {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    setLogoutError(null);

    try {
      await logout();
      navigate("/login", { replace: true });
    } catch {
      setLogoutError(LOGOUT_ERROR_MESSAGE);
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="authenticated-layout">
      <aside className="authenticated-sidebar" aria-label="Điều hướng chính">
        <div className="authenticated-brand">
          <span className="authenticated-brand-mark" aria-hidden="true">
            E
          </span>
          <span>ELVocab</span>
        </div>

        <nav className="authenticated-navigation" aria-label="Khu vực học tập">
          <NavLink
            to="/dashboard"
            end
            className={({ isActive }) =>
              `authenticated-nav-link${isActive ? " is-active" : ""}`
            }
          >
            <BookOpenCheck className="size-5" aria-hidden="true" />
            <span>Dashboard</span>
          </NavLink>
        </nav>

        <div className="authenticated-account">
          <div className="min-w-0">
            <p className="authenticated-account-label">Tài khoản</p>
            <p className="authenticated-display-name" title={user.display_name}>
              {user.display_name}
            </p>
            {user.role === "ADMIN" ? (
              <span className="authenticated-admin-indicator">
                <ShieldCheck className="size-4" aria-hidden="true" />
                Quản trị viên
              </span>
            ) : null}
          </div>

          <button
            type="button"
            className="authenticated-logout-button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            aria-busy={isLoggingOut}
          >
            {isLoggingOut ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <LogOut className="size-4" aria-hidden="true" />
            )}
            <span>{isLoggingOut ? "Đang đăng xuất…" : "Đăng xuất"}</span>
          </button>

          {logoutError ? (
            <p className="authenticated-logout-error" role="alert">
              {logoutError}
            </p>
          ) : null}
        </div>
      </aside>

      <main className="authenticated-main">
        <Outlet />
      </main>
    </div>
  );
}
