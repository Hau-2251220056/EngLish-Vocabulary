import { BookOpen, LogIn } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";

export function PublicTopicLayout() {
  const { pathname } = useLocation();

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
          <Link className="public-topic-header-link" to="/login">
            <LogIn className="size-4" aria-hidden="true" />
            Đăng nhập
          </Link>
        </nav>
      </header>
      <main className="public-topic-main">
        {pathname !== "/topics" ? <div className="public-topic-heading-mark" aria-hidden="true"><BookOpen className="size-6" /></div> : null}
        <Outlet />
      </main>
      <footer className="public-topic-footer">© 2026 ELVocab</footer>
    </div>
  );
}
