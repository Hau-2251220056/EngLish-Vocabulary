import { BookOpen, LayoutDashboard, LogIn } from "lucide-react";
import { Link, Outlet } from "react-router-dom";
import { useAuthentication } from "../auth/use-authentication.js";

export function PublicTopicLayout() {
  const { isAuthenticated, user } = useAuthentication();
  const displayName = user?.display_name ?? "";
  const defaultAvatar = displayName.trim().charAt(0).toUpperCase() || "E";

  return (
    <div className="public-topic-app">
      <header className="public-topic-header">
        <Link className="public-topic-brand" to="/topics" aria-label="ELVocab Topics">
          <span className="public-topic-brand-mark" aria-hidden="true">
            E
          </span>
          <span>ELVocab</span>
        </Link>
        <nav aria-label="Điều hướng công khai">
          {isAuthenticated ? (
            <Link
              className="public-topic-header-link public-topic-account-link"
              to="/dashboard"
              aria-label={`Đến Dashboard của ${displayName}`}
            >
              <span className="public-topic-avatar" aria-hidden="true">
                {defaultAvatar}
              </span>
              <span className="public-topic-account-name">{displayName}</span>
              <LayoutDashboard className="size-4" aria-hidden="true" />
              <span>Dashboard</span>
            </Link>
          ) : (
            <Link className="public-topic-header-link" to="/login">
              <LogIn className="size-4" aria-hidden="true" />
              Đăng nhập
            </Link>
          )}
        </nav>
      </header>
      <main className="public-topic-main">
        <div className="public-topic-heading-mark" aria-hidden="true">
          <BookOpen className="size-6" />
        </div>
        <Outlet />
      </main>
      <footer className="public-topic-footer">© 2026 ELVocab</footer>
    </div>
  );
}
