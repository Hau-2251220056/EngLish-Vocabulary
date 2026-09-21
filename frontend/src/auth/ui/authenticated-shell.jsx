import { BookOpenCheck, LoaderCircle, LogOut, Menu, ShieldCheck, Tags, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuthentication } from "../use-authentication.js";

const LOGOUT_ERROR_MESSAGE = "Không thể đăng xuất lúc này. Vui lòng thử lại.";

export function AuthenticatedShell() {
  const navigate = useNavigate();
  const { logout, user } = useAuthentication();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMobileNavigation, setIsMobileNavigation] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches);
  const drawerToggleRef = useRef(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 900px)");
    function syncNavigationMode(event) { setIsMobileNavigation(event.matches); if (!event.matches) setIsDrawerOpen(false); }
    syncNavigationMode(mediaQuery);
    mediaQuery.addEventListener("change", syncNavigationMode);
    return () => mediaQuery.removeEventListener("change", syncNavigationMode);
  }, []);

  function closeDrawer({ restoreFocus = true } = {}) { setIsDrawerOpen(false); if (restoreFocus) drawerToggleRef.current?.focus(); }

  useEffect(() => {
    if (!isDrawerOpen) return undefined;
    function handleKeyDown(event) { if (event.key === "Escape") closeDrawer(); }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen]);

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setLogoutError(null);
    try { await logout(); closeDrawer({ restoreFocus: false }); navigate("/login", { replace: true }); }
    catch { setLogoutError(LOGOUT_ERROR_MESSAGE); setIsLoggingOut(false); }
  }

  const displayName = user.display_name;
  const defaultAvatar = displayName.trim().charAt(0).toUpperCase() || "E";
  const drawerIsVisible = !isMobileNavigation || isDrawerOpen;

  return (
    <div className="authenticated-app">
      <header className="authenticated-header">
        <div className="authenticated-brand"><span className="authenticated-brand-mark" aria-hidden="true">E</span><span>ELVocab</span></div>
        <div className="authenticated-header-actions">
        <button ref={drawerToggleRef} type="button" className="authenticated-drawer-toggle" aria-label={isDrawerOpen ? "Đóng điều hướng" : "Mở điều hướng"} aria-controls="authenticated-sidebar" aria-expanded={isMobileNavigation ? isDrawerOpen : undefined} onClick={() => (isDrawerOpen ? closeDrawer() : setIsDrawerOpen(true))}>
          {isDrawerOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
        </button>
        <div className="authenticated-header-account">
          {user.avatar_url ? <img className="authenticated-avatar" src={user.avatar_url} alt="" /> : <span className="authenticated-avatar" aria-hidden="true">{defaultAvatar}</span>}
          <div className="min-w-0"><p className="authenticated-header-name" title={displayName}>{displayName}</p>{user.role === "ADMIN" ? <span className="authenticated-admin-indicator"><ShieldCheck className="size-4" aria-hidden="true" />Quản trị viên</span> : null}</div>
        </div>
        </div>
      </header>
      {isMobileNavigation && isDrawerOpen ? <button type="button" className="authenticated-drawer-backdrop" aria-label="Đóng điều hướng" onClick={() => closeDrawer()} /> : null}
      <div className="authenticated-layout">
        <aside id="authenticated-sidebar" className={`authenticated-sidebar${drawerIsVisible ? " is-open" : ""}`} aria-label="Điều hướng chính" aria-hidden={isMobileNavigation && !isDrawerOpen} inert={isMobileNavigation && !isDrawerOpen || undefined}>
          <nav className="authenticated-navigation" aria-label="Khu vực học tập"><NavLink to="/dashboard" end onClick={() => closeDrawer({ restoreFocus: false })} className={({ isActive }) => `authenticated-nav-link${isActive ? " is-active" : ""}`}><BookOpenCheck className="size-5" aria-hidden="true" /><span>Dashboard</span></NavLink>{user.role === "ADMIN" ? <NavLink to="/admin/topics" onClick={() => closeDrawer({ restoreFocus: false })} className={({ isActive }) => `authenticated-nav-link${isActive ? " is-active" : ""}`}><Tags className="size-5" aria-hidden="true" /><span>Quản lý chủ đề</span></NavLink> : null}</nav>
          <div className="authenticated-account"><div className="min-w-0"><p className="authenticated-account-label">Tài khoản</p><p className="authenticated-display-name" title={displayName}>{displayName}</p></div><button type="button" className="authenticated-logout-button" onClick={handleLogout} disabled={isLoggingOut} aria-busy={isLoggingOut}>{isLoggingOut ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <LogOut className="size-4" aria-hidden="true" />}<span>{isLoggingOut ? "Đang đăng xuất…" : "Đăng xuất"}</span></button>{logoutError ? <p className="authenticated-logout-error" role="alert">{logoutError}</p> : null}</div>
        </aside>
        <main className="authenticated-main"><Outlet /></main>
      </div>
      <footer className="authenticated-footer">© 2026 ELVocab</footer>
    </div>
  );
}
