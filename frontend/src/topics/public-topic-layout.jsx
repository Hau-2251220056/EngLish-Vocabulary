import { Home, LogIn } from "lucide-react";
import { Link, Outlet } from "react-router-dom";
import elVocabLogo from "../assets/images/logo.png";
import elVocabMobileLogo from "../assets/logo_mobile.png";

export function PublicTopicLayout() {
  return (
    <div className="public-topic-app">
      <header className="public-topic-header">
        <Link className="public-topic-brand" to="/" aria-label="Trang chủ ELVocab">
          <img className="public-topic-brand-mobile" src={elVocabMobileLogo} alt="" />
          <img className="public-topic-brand-full" src={elVocabLogo} alt="" />
        </Link>
        <nav className="public-topic-header-nav" aria-label="Điều hướng công khai">
          <Link className="public-topic-header-link" to="/">
            <Home className="size-4" aria-hidden="true" />
            Trang chủ
          </Link>
          <Link className="public-topic-header-link" to="/login">
            <LogIn className="size-4" aria-hidden="true" />
            Đăng nhập
          </Link>
        </nav>
      </header>
      <main className="public-topic-main">
        <Outlet />
      </main>
      <footer className="public-topic-footer flex flex-wrap items-center justify-center gap-x-4 gap-y-2"><span>© 2026 ELVocab</span><Link className="inline-flex min-h-11 items-center rounded-sm font-semibold text-[#075f95] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200" to="/data-sources">Nguồn dữ liệu &amp; Giấy phép</Link></footer>
    </div>
  );
}
