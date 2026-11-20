import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import elVocabLogo from "../assets/images/logo.png";
import elVocabMobileLogo from "../assets/logo_mobile.png";
import { navigateToLandingSection } from "./section-navigation.js";

const sectionLinks = [
  { href: "#tinh-nang", label: "Tính năng" },
  { href: "#cach-hoat-dong", label: "Cách hoạt động" },
];

export function PublicNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key !== "Escape") return;
      setIsMenuOpen(false);
      menuButtonRef.current?.focus();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMenuOpen]);

  function closeMenu() {
    setIsMenuOpen(false);
  }

  function followSectionLink(event, hash) {
    closeMenu();
    navigateToLandingSection(event, hash);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex min-h-18 w-full max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="inline-flex min-h-11 shrink-0 items-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-[var(--accent-primary-focus,#bfdbfe)]"
          aria-label="Trang chủ ELVocab"
        >
          <img className="h-10 w-auto sm:hidden" src={elVocabMobileLogo} alt="" />
          <img className="hidden h-10 w-auto sm:block" src={elVocabLogo} alt="" />
        </Link>

        <div className="hidden items-center justify-end gap-7 md:flex" data-testid="landing-navbar-right-group">
          <nav className="flex items-center gap-7" aria-label="Điều hướng trang giới thiệu">
            {sectionLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(event) => followSectionLink(event, link.href)}
                className="rounded-lg px-1 py-3 text-sm font-semibold text-slate-600 no-underline transition-colors hover:text-[#3d7fbe] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#b9d9f6] motion-reduce:transition-none"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2 border-l border-slate-200 pl-5">
            <Link
              to="/login"
              className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-slate-700 no-underline transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#b9d9f6] motion-reduce:transition-none"
            >
              Đăng nhập
            </Link>
            <Link
              to="/register"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#4b8ccc] px-5 text-sm font-bold text-white no-underline shadow-[0_10px_24px_rgb(75_140_204/24%)] transition-[background-color,transform,box-shadow] hover:-translate-y-0.5 hover:bg-[#3978b6] hover:shadow-[0_14px_28px_rgb(75_140_204/30%)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#b9d9f6] focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none"
            >
              Bắt đầu miễn phí
            </Link>
          </div>
        </div>

        <button
          ref={menuButtonRef}
          type="button"
          className="inline-flex size-11 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-[#3d7fbe] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#b9d9f6] md:hidden motion-reduce:transition-none"
          aria-label={isMenuOpen ? "Đóng menu" : "Mở menu"}
          aria-controls="landing-mobile-menu"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          {isMenuOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
        </button>
      </div>

      <nav
        id="landing-mobile-menu"
        className={`${isMenuOpen ? "grid" : "hidden"} border-t border-slate-200 bg-white px-4 py-4 shadow-[0_18px_30px_rgb(15_23_42/8%)] md:hidden`}
        aria-label="Điều hướng trang giới thiệu trên di động"
      >
        {sectionLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-slate-700 no-underline hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#b9d9f6]"
            onClick={(event) => followSectionLink(event, link.href)}
          >
            {link.label}
          </a>
        ))}
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
          <Link
            to="/login"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 no-underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--accent-primary-focus,#bfdbfe)]"
            onClick={closeMenu}
          >
            Đăng nhập
          </Link>
          <Link
            to="/register"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#4b8ccc] px-3 text-center text-sm font-bold text-white no-underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#b9d9f6]"
            onClick={closeMenu}
          >
            Bắt đầu miễn phí
          </Link>
        </div>
      </nav>
    </header>
  );
}
