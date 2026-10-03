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
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import elVocabLogo from "../../assets/images/logo.png";
import elVocabMobileLogo from "../../assets/logo_mobile.png";
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
  }

  function toggleAccountMenu() {
    if (!isAccountMenuOpen) setIsDrawerOpen(false);
    setIsAccountMenuOpen((isOpen) => !isOpen);
  }

  useEffect(() => {
    if (!isDrawerOpen) return undefined;
    const focusTimer = window.setTimeout(() => sidebarRef.current?.querySelector("a")?.focus(), 100);
    function handleKeyDown(event) {
      if (event.key === "Escape") closeDrawer();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
    };
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
  const isFocusLearning = [
    "/learn/vocabulary-sets/",
    "/quiz/vocabulary-sets/",
  ].some((prefix) => location.pathname.startsWith(prefix));
  const isUser = user.role === "USER";

  if (isFocusLearning) {
    return <div className="learning-focus-shell"><Outlet /></div>;
  }

  const brandContent = (
    <>
      <span className={`authenticated-brand-mark${isUser ? " !inline-flex !h-10 !w-auto !shrink-0 !items-center !justify-start !overflow-visible !rounded-none !bg-transparent" : ""}`} aria-hidden="true">
        {isUser ? (
          <>
            <img className="elvocab-logo-mobile block h-10 w-auto max-w-none sm:hidden" src={elVocabMobileLogo} alt="" />
            <img className="elvocab-logo-full hidden h-10 w-auto max-w-none sm:block" src={elVocabLogo} alt="" />
          </>
        ) : "E"}
      </span>
      {!isUser ? <span>ELVocab</span> : null}
    </>
  );
  const brandClasses = `authenticated-brand${isUser ? " !flex !min-w-0 !cursor-pointer !items-center !gap-2 !rounded-xl !text-[0.9rem] !font-semibold !tracking-[-0.02em] !text-[var(--text-primary)] !no-underline !transition-colors hover:!text-[var(--accent-primary-pressed)] focus-visible:!outline-none focus-visible:!ring-2 focus-visible:!ring-[var(--accent-primary-focus)] sm:!gap-3 sm:!text-[0.98rem] motion-reduce:!transition-none" : ""}`;
  const brand = isUser
    ? <Link className={brandClasses} to="/dashboard" aria-label="Về trang chủ ELVocab">{brandContent}</Link>
    : <div className={brandClasses}>{brandContent}</div>;

  function navigationLink(to, label, Icon, { end = false } = {}) {
    return (
      <NavLink
        to={to}
        end={end}
        onClick={() => closeDrawer({ restoreFocus: false })}
        className={({ isActive }) => `authenticated-nav-link${isUser ? " !flex !min-h-11 !items-center !gap-3 !rounded-xl !border !border-transparent !px-3 !py-2.5 !text-[0.86rem] !font-medium !text-[#526075] !no-underline !outline-none !transition-[border-color,background-color,color,transform] !duration-150 hover:!translate-x-0.5 hover:!border-[#dfe4fb] hover:!bg-[var(--bg-subtle)] hover:!text-[var(--accent-primary)] focus-visible:!shadow-[0_0_0_2px_var(--accent-primary-focus)] motion-reduce:!transition-none motion-reduce:hover:!translate-x-0 [&.is-active]:!border-[#cfd7ff] [&.is-active]:!bg-[var(--accent-primary-soft)] [&.is-active]:!text-[var(--accent-primary)]" : ""}${isActive ? " is-active" : ""}`}
      >
        <Icon className="size-5" aria-hidden="true" />
        <span>{label}</span>
      </NavLink>
    );
  }

  const drawerToggle = (
    <button
      ref={drawerToggleRef}
      type="button"
      className={`authenticated-drawer-toggle${isUser ? " !inline-flex !size-11 !cursor-pointer !items-center !justify-center !rounded-xl !border !border-transparent !bg-transparent !text-[var(--text-primary)] !transition-colors hover:!text-[var(--accent-primary)] focus-visible:!outline-none focus-visible:!shadow-[0_0_0_2px_var(--accent-primary-focus)] lg:!hidden motion-reduce:!transition-none" : ""}`}
      aria-label={isDrawerOpen ? "Đóng điều hướng" : "Mở điều hướng"}
      aria-controls="authenticated-sidebar"
      aria-expanded={isMobileNavigation ? isDrawerOpen : undefined}
      onClick={() => (isDrawerOpen ? closeDrawer() : openDrawer())}
    >
      {isDrawerOpen ? <X className="size-[1.125rem] sm:size-5" aria-hidden="true" /> : <Menu className="size-[1.125rem] sm:size-5" aria-hidden="true" />}
    </button>
  );

  const headerContent = (
    <>
      {!isUser ? drawerToggle : null}
      <div className={`authenticated-mobile-brand${isUser ? " !flex !min-w-0 !shrink justify-start lg:justify-self-start" : ""}`}>{brand}</div>

      {user.role === "USER" ? (
        <nav className="authenticated-header-navigation hidden min-w-0 lg:flex lg:items-center lg:justify-self-center lg:gap-3" aria-label="Điều hướng nhanh">
          <NavLink to="/dashboard" end className={({ isActive }) => `authenticated-header-link relative inline-flex cursor-pointer items-center px-3 py-3 text-[0.9375rem] font-semibold text-[var(--text-secondary)] no-underline transition-colors after:absolute after:inset-x-[0.7rem] after:bottom-1.5 after:h-px after:scale-x-[0.45] after:rounded-full after:bg-current after:opacity-0 after:transition-[opacity,transform] hover:text-[var(--accent-primary)] focus-visible:rounded-md focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--accent-primary-focus)] motion-reduce:transition-none motion-reduce:after:transition-none${isActive ? " is-active !text-[var(--accent-primary)] after:!scale-x-100 after:!opacity-100" : ""}`}>Trang chủ</NavLink>
          <NavLink to="/my/vocabulary-sets" className={({ isActive }) => `authenticated-header-link relative inline-flex cursor-pointer items-center px-3 py-3 text-[0.9375rem] font-semibold text-[var(--text-secondary)] no-underline transition-colors after:absolute after:inset-x-[0.7rem] after:bottom-1.5 after:h-px after:scale-x-[0.45] after:rounded-full after:bg-current after:opacity-0 after:transition-[opacity,transform] hover:text-[var(--accent-primary)] focus-visible:rounded-md focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--accent-primary-focus)] motion-reduce:transition-none motion-reduce:after:transition-none${isActive ? " is-active !text-[var(--accent-primary)] after:!scale-x-100 after:!opacity-100" : ""}`}>Bộ từ của tôi</NavLink>
          <NavLink to="/topics" className={({ isActive }) => `authenticated-header-link relative inline-flex cursor-pointer items-center px-3 py-3 text-[0.9375rem] font-semibold text-[var(--text-secondary)] no-underline transition-colors after:absolute after:inset-x-[0.7rem] after:bottom-1.5 after:h-px after:scale-x-[0.45] after:rounded-full after:bg-current after:opacity-0 after:transition-[opacity,transform] hover:text-[var(--accent-primary)] focus-visible:rounded-md focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--accent-primary-focus)] motion-reduce:transition-none motion-reduce:after:transition-none${isActive ? " is-active !text-[var(--accent-primary)] after:!scale-x-100 after:!opacity-100" : ""}`}>Khám phá bộ từ</NavLink>
        </nav>
      ) : null}

      <div className={isUser ? "authenticated-header-utilities col-start-2 flex items-center justify-end gap-1 sm:gap-1.5 lg:contents" : "contents"}>
      <div ref={accountMenuRef} className={`authenticated-account-menu${isUser ? " !relative lg:justify-self-end" : ""}`}>
        <button
          ref={accountMenuTriggerRef}
          type="button"
          className={`authenticated-avatar-trigger${isUser ? " !inline-flex !size-11 !cursor-pointer !items-center !justify-center !rounded-full !border !border-[var(--border-soft)] !bg-white !p-0 !transition-colors hover:!border-slate-300 hover:!bg-[var(--bg-subtle)] focus-visible:!outline-none focus-visible:!shadow-[0_0_0_2px_var(--accent-primary-focus)] motion-reduce:!transition-none" : ""}`}
          aria-label={`Mở menu tài khoản của ${displayName}`}
          aria-controls="authenticated-account-dropdown"
          aria-expanded={isAccountMenuOpen}
          onClick={toggleAccountMenu}
        >
          {user.avatar_url ? (
            <img className={`authenticated-avatar${isUser ? " !inline-flex !size-8 !shrink-0 !rounded-full !bg-[var(--accent-primary-soft)] !object-cover !text-[var(--accent-primary-pressed)] sm:!size-9" : ""}`} src={user.avatar_url} alt="" />
          ) : (
            <span className={`authenticated-avatar${isUser ? " !inline-flex !size-8 !shrink-0 !items-center !justify-center !rounded-full !bg-[var(--accent-primary-soft)] !text-[0.8rem] !font-extrabold !text-[var(--accent-primary-pressed)] sm:!size-9 sm:!text-sm" : ""}`} aria-hidden="true">{defaultAvatar}</span>
          )}
        </button>

        {isAccountMenuOpen ? (
          <div id="authenticated-account-dropdown" className={`authenticated-account-dropdown${isUser ? " !absolute !right-0 !top-[calc(100%+0.5rem)] !w-[min(18rem,calc(100vw-2rem))] !rounded-2xl !border !border-[var(--border-soft)] !bg-white !p-2 !shadow-[0_18px_48px_rgb(37_52_86/12%)]" : ""}`} aria-label="Tài khoản">
            <div className={`authenticated-account-identity${isUser ? " !min-w-0 !px-3 !py-2" : ""}`}>
              <p className={isUser ? "!m-0 !truncate !text-sm !font-semibold !text-[var(--text-primary)]" : ""} title={displayName}>{displayName}</p>
              {user.role === "ADMIN" ? (
                <span className="authenticated-admin-indicator">
                  <ShieldCheck className="size-4" aria-hidden="true" />Quản trị viên
                </span>
              ) : null}
            </div>
            <hr className={isUser ? "!my-2 !h-px !border-0 !bg-[var(--border-soft)]" : ""} />
            <button
              type="button"
              className={`authenticated-logout-button${isUser ? " !m-0 !flex !min-h-11 !w-full !cursor-pointer !items-center !justify-start !gap-2 !rounded-xl !border-0 !bg-transparent !px-3 !py-2 !font-[inherit] !font-bold !text-[var(--text-primary)] hover:!bg-[var(--bg-subtle)] hover:!text-red-700 focus-visible:!outline-none focus-visible:!shadow-[0_0_0_2px_var(--accent-primary-focus)] disabled:!cursor-wait disabled:!opacity-65" : ""}`}
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
            {logoutError ? <p className={`authenticated-logout-error${isUser ? " !mx-2 !mb-0 !mt-2 !rounded-lg !bg-red-50 !p-2 !text-xs !text-red-700" : ""}`} role="alert">{logoutError}</p> : null}
          </div>
        ) : null}
      </div>
      {isUser ? drawerToggle : null}
      </div>
    </>
  );

  return (
    <div className={`authenticated-app${isUser ? " authenticated-user-app !block !h-auto !min-h-dvh !min-w-0 !overflow-x-clip !overflow-y-visible lg:!h-dvh lg:!overflow-hidden" : ""}`}>
      <aside
        ref={sidebarRef}
        id="authenticated-sidebar"
        className={`authenticated-sidebar${isUser ? " !fixed !inset-y-0 !left-0 !z-50 !flex !w-[min(15.5rem,calc(100vw-3rem))] !min-w-0 !flex-col !overflow-x-hidden !overflow-y-auto !border !border-[var(--border-soft)] !bg-white !p-4 !shadow-[0_8px_24px_rgb(30_41_59/6%)] !transition-[transform,visibility] !duration-200 !ease-out max-lg:!-translate-x-full max-lg:!invisible lg:!bottom-4 lg:!top-[5.5rem] lg:!left-[max(1.75rem,calc((100vw-1440px)/2+2rem))] lg:!h-[calc(100dvh-6.5rem)] lg:!w-[15.5rem] lg:!translate-x-0 lg:!visible lg:!rounded-[1.25rem] motion-reduce:!transition-none [&.is-open]:!translate-x-0 [&.is-open]:!visible" : ""}${drawerIsVisible ? " is-open" : ""}`}
        aria-label="Điều hướng chính"
        aria-hidden={isMobileNavigation && !isDrawerOpen}
        inert={(isMobileNavigation && !isDrawerOpen) || undefined}
      >
        {user.role === "ADMIN" ? <div className="authenticated-sidebar-brand">{brand}</div> : null}
        {user.role === "USER" ? (
          <div className="authenticated-sidebar-profile flex min-w-0 items-center gap-[0.65rem] border-b border-[var(--border-soft)] px-1 pb-[0.9rem] pt-[0.15rem]">
            <span className="authenticated-sidebar-avatar !inline-flex !size-9 !shrink-0 !items-center !justify-center !rounded-full !bg-[var(--accent-primary-soft)] !text-[0.8rem] !font-extrabold !text-[var(--accent-primary-pressed)]" aria-hidden="true">{defaultAvatar}</span>
            <div className="min-w-0">
              <p className="authenticated-sidebar-name !m-0 !truncate !text-[0.82rem] !font-semibold !text-[var(--text-primary)]" title={displayName}>{displayName}</p>
              <p className="authenticated-sidebar-email !mb-0 !mt-[0.15rem] !truncate !text-[0.72rem] !font-normal !text-[var(--text-secondary)]" title={user.email}>{user.email}</p>
            </div>
          </div>
        ) : null}
        <nav className={`authenticated-navigation${isUser ? " !mt-[0.9rem] !grid !gap-1" : ""}`} aria-label="Điều hướng ứng dụng">
          {user.role === "USER" ? (
            <>
              <p className="authenticated-nav-heading !mb-2 !mt-0 !px-3 !text-[0.66rem] !font-semibold !uppercase !tracking-[0.11em] !text-[var(--text-secondary)]">Từ vựng</p>
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
        {user.role === "USER" ? (
          <div className="authenticated-sidebar-session mt-auto border-t border-[var(--border-soft)] pt-3">
            <button type="button" className="authenticated-sidebar-logout flex min-h-11 w-full cursor-pointer items-center gap-[0.55rem] rounded-xl border border-transparent bg-transparent px-[0.7rem] py-[0.55rem] text-left text-[0.86rem] font-medium text-[#5e687a] transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-800 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--accent-primary-focus)] disabled:cursor-not-allowed disabled:opacity-[0.58] motion-reduce:transition-none" onClick={handleLogout} disabled={isLoggingOut} aria-busy={isLoggingOut}>
              {isLoggingOut ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <LogOut className="size-4" aria-hidden="true" />}
              <span>{isLoggingOut ? "Đang đăng xuất…" : "Đăng xuất"}</span>
            </button>
            {logoutError ? <p className="authenticated-logout-error !mx-[0.35rem] !mb-0 !mt-2 !text-xs !text-red-700" role="alert">{logoutError}</p> : null}
          </div>
        ) : (
          <div className="authenticated-sidebar-account">
            <span className="authenticated-sidebar-avatar" aria-hidden="true">{defaultAvatar}</span>
            <div className="min-w-0">
              <p className="authenticated-sidebar-name" title={displayName}>{displayName}</p>
              <p className="authenticated-sidebar-role">Quản trị viên</p>
            </div>
          </div>
        )}
      </aside>

      {isMobileNavigation && isDrawerOpen ? (
        <button
          type="button"
          className={`authenticated-drawer-backdrop${isUser ? " !fixed !inset-0 !z-40 !block !cursor-pointer !border-0 !bg-slate-900/40 lg:!hidden" : ""}`}
          aria-label="Đóng điều hướng"
          onClick={() => closeDrawer()}
        />
      ) : null}

      <div className={`authenticated-shell-main${isUser ? " !flex !min-h-dvh !min-w-0 !flex-col !overflow-visible lg:!h-dvh lg:!overflow-hidden" : ""}`} inert={(isMobileNavigation && isDrawerOpen) || undefined}>
        <header className={`authenticated-header${isUser ? " !sticky !top-0 !z-10 !flex !min-h-[3.75rem] !basis-[3.75rem] !w-full !shrink-0 !items-center !justify-normal !gap-0 !border-b !border-[var(--border-soft)] !bg-white/[0.97] !p-0 sm:!min-h-[4.25rem] sm:!basis-[4.25rem] lg:!relative lg:!min-h-18 lg:!basis-18" : ""}`}>
          {user.role === "USER" ? (
            <div className="authenticated-header-inner mx-auto flex h-full w-full max-w-[1440px] items-center justify-between px-4 sm:px-8 lg:grid lg:w-[calc(100%-18rem)] lg:max-w-[1280px] lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-0 lg:px-8">
              {headerContent}
            </div>
          ) : headerContent}
        </header>

        <main className={`authenticated-main${isUser ? " !min-h-[calc(100dvh-3.75rem)] !min-w-0 !flex-1 !overflow-visible sm:!min-h-[calc(100dvh-4.25rem)] lg:!min-h-0 lg:!overflow-x-hidden lg:!overflow-y-auto lg:!pl-[calc(max(1.75rem,calc((100vw-1440px)/2+2rem))+17rem)]" : ""}`}><Outlet /></main>
      </div>
    </div>
  );
}
