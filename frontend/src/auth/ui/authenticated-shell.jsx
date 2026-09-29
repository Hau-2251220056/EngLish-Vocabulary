import {
  BookOpenCheck,
  BookText,
  Compass,
  Home,
  LoaderCircle,
  LogOut,
  Menu,
  ShieldCheck,
  Tags,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthentication } from "../use-authentication.js";

const LOGOUT_ERROR_MESSAGE = "Không thể đăng xuất lúc này. Vui lòng thử lại.";
const MOBILE_NAVIGATION_QUERY = "(max-width: 1023px)";

export function AuthenticatedShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuthentication();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isMobileNavigation, setIsMobileNavigation] = useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE_NAVIGATION_QUERY).matches,
  );
  const drawerToggleRef = useRef(null);
  const sidebarRef = useRef(null);
  const accountMenuRef = useRef(null);
  const accountMenuTriggerRef = useRef(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_NAVIGATION_QUERY);
    function syncNavigationMode(event) {
      setIsMobileNavigation(event.matches);
      if (!event.matches) setIsDrawerOpen(false);
    }
    syncNavigationMode(mediaQuery);
    mediaQuery.addEventListener("change", syncNavigationMode);
    return () => mediaQuery.removeEventListener("change", syncNavigationMode);
  }, []);

  function closeDrawer({ restoreFocus = true } = {}) {
    setIsDrawerOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => drawerToggleRef.current?.focus());
  }

  function closeAccountMenu({ restoreFocus = true } = {}) {
    setIsAccountMenuOpen(false);
    if (restoreFocus) accountMenuTriggerRef.current?.focus();
  }

  function openDrawer() {
    setIsAccountMenuOpen(false);
    setIsDrawerOpen(true);
    window.requestAnimationFrame(() => sidebarRef.current?.querySelector("a")?.focus());
  }

  function toggleAccountMenu() {
    if (!isAccountMenuOpen) setIsDrawerOpen(false);
    setIsAccountMenuOpen((isOpen) => !isOpen);
  }

  useEffect(() => {
    if (!isDrawerOpen) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") closeDrawer();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen]);

  useEffect(() => {
    if (!isAccountMenuOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") closeAccountMenu();
    }
    function handlePointerDown(event) {
      if (!accountMenuRef.current?.contains(event.target)) {
        closeAccountMenu({ restoreFocus: false });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isAccountMenuOpen]);

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
      setIsAccountMenuOpen(false);
      navigate("/login", { replace: true });
    } catch {
      setLogoutError(LOGOUT_ERROR_MESSAGE);
      setIsLoggingOut(false);
    }
  }

  const displayName = user.display_name;
  const defaultAvatar = displayName.trim().charAt(0).toUpperCase() || "E";
  const drawerIsVisible = !isMobileNavigation || isDrawerOpen;
  const isFocusLearning = location.pathname.startsWith("/learn/vocabulary-sets/");

  if (isFocusLearning) {
    return <div className="learning-focus-shell"><Outlet /></div>;
  }

  const brand = (
    <div className="authenticated-brand">
      <span className="authenticated-brand-mark" aria-hidden="true">E</span>
      <span>ELVocab</span>
    </div>
  );

  function navigationLink(to, label, Icon, { end = false } = {}) {
    return (
      <NavLink
        to={to}
        end={end}
        onClick={() => closeDrawer({ restoreFocus: false })}
        className={({ isActive }) => `authenticated-nav-link${isActive ? " is-active" : ""}`}
      >
        <Icon className="size-5" aria-hidden="true" />
        <span>{label}</span>
      </NavLink>
    );
  }

  return (
    <div className="authenticated-app">
      <aside
        ref={sidebarRef}
        id="authenticated-sidebar"
        className={`authenticated-sidebar${drawerIsVisible ? " is-open" : ""}`}
        aria-label="Điều hướng chính"
        aria-hidden={isMobileNavigation && !isDrawerOpen}
        inert={(isMobileNavigation && !isDrawerOpen) || undefined}
      >
        <div className="authenticated-sidebar-brand">{brand}</div>
        <nav className="authenticated-navigation" aria-label="Điều hướng ứng dụng">
          {user.role === "USER" ? (
            <>
              <p className="authenticated-nav-heading">Từ vựng</p>
              {navigationLink("/dashboard", "Trang chủ", Home, { end: true })}
              {navigationLink("/my/vocabulary-sets", "Bộ từ của tôi", BookText)}
              {navigationLink("/topics", "Khám phá bộ từ", Compass)}
            </>
          ) : (
            <>
              {navigationLink("/dashboard", "Trang chủ", Home, { end: true })}
              <p className="authenticated-nav-heading">Quản trị</p>
              {navigationLink("/admin/topics", "Quản lý chủ đề", Tags)}
              {navigationLink("/admin/vocabulary", "Quản lý từ vựng", BookOpenCheck)}
              {navigationLink("/admin/vocabulary-sets", "Quản lý bộ từ", BookText)}
            </>
          )}
        </nav>
        <div className="authenticated-sidebar-account">
          <span className="authenticated-sidebar-avatar" aria-hidden="true">{defaultAvatar}</span>
          <div className="min-w-0">
            <p className="authenticated-sidebar-name" title={displayName}>{displayName}</p>
            <p className="authenticated-sidebar-role">
              {user.role === "ADMIN" ? "Quản trị viên" : "Người học"}
            </p>
          </div>
        </div>
      </aside>

      {isMobileNavigation && isDrawerOpen ? (
        <button
          type="button"
          className="authenticated-drawer-backdrop"
          aria-label="Đóng điều hướng"
          onClick={() => closeDrawer()}
        />
      ) : null}

      <div className="authenticated-shell-main" inert={(isMobileNavigation && isDrawerOpen) || undefined}>
        <header className="authenticated-header">
          <button
            ref={drawerToggleRef}
            type="button"
            className="authenticated-drawer-toggle"
            aria-label={isDrawerOpen ? "Đóng điều hướng" : "Mở điều hướng"}
            aria-controls="authenticated-sidebar"
            aria-expanded={isMobileNavigation ? isDrawerOpen : undefined}
            onClick={() => (isDrawerOpen ? closeDrawer() : openDrawer())}
          >
            {isDrawerOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>

          <div className="authenticated-mobile-brand">{brand}</div>

          <div ref={accountMenuRef} className="authenticated-account-menu">
            <button
              ref={accountMenuTriggerRef}
              type="button"
              className="authenticated-avatar-trigger"
              aria-label={`Mở menu tài khoản của ${displayName}`}
              aria-controls="authenticated-account-dropdown"
              aria-expanded={isAccountMenuOpen}
              onClick={toggleAccountMenu}
            >
              {user.avatar_url ? (
                <img className="authenticated-avatar" src={user.avatar_url} alt="" />
              ) : (
                <span className="authenticated-avatar" aria-hidden="true">{defaultAvatar}</span>
              )}
            </button>

            {isAccountMenuOpen ? (
              <div id="authenticated-account-dropdown" className="authenticated-account-dropdown" aria-label="Tài khoản">
                <div className="authenticated-account-identity">
                  <p title={displayName}>{displayName}</p>
                  {user.role === "ADMIN" ? (
                    <span className="authenticated-admin-indicator">
                      <ShieldCheck className="size-4" aria-hidden="true" />Quản trị viên
                    </span>
                  ) : null}
                </div>
                <hr />
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
                {logoutError ? <p className="authenticated-logout-error" role="alert">{logoutError}</p> : null}
              </div>
            ) : null}
          </div>
        </header>

        <main className="authenticated-main"><Outlet /></main>
      </div>
    </div>
  );
}
