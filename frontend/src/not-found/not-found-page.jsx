import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuthentication } from "../auth/use-authentication.js";

const ACTION_FOCUS =
  "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#0877b9]/35 focus-visible:ring-offset-2";

export function NotFoundPage() {
  const { isAuthenticated } = useAuthentication();
  const headingRef = useRef(null);
  const homePath = isAuthenticated ? "/dashboard" : "/";

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Không tìm thấy trang | ELVocab";
    headingRef.current?.focus({ preventScroll: true });
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <main
      className="grid min-h-screen min-h-dvh w-full place-items-center py-12 text-center text-slate-800"
      style={{
        backgroundImage:
          "radial-gradient(circle at 88% 12%, #fff2e7 0%, transparent 34%), linear-gradient(135deg, #eaf7ff 0%, #ffffff 50%, #eaf9f1 100%)",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
      }}
    >
      <section aria-labelledby="not-found-title" className="w-full max-w-xl">
        <p className="m-0 text-[clamp(6.5rem,18vw,12rem)] font-black leading-none tracking-[-0.08em] text-[#0877b9] tabular-nums">
          404
        </p>
        <h1
          className="mt-6 rounded-sm text-balance text-[clamp(1.75rem,4vw,2.5rem)] font-extrabold leading-tight tracking-[-0.035em] text-slate-950 outline-none"
          id="not-found-title"
          ref={headingRef}
          tabIndex={-1}
        >
          Không tìm thấy trang
        </h1>
        <p className="mx-auto mt-3 max-w-md text-pretty text-base leading-relaxed text-slate-600">
          Trang bạn đang tìm kiếm không tồn tại hoặc đường dẫn đã thay đổi.
        </p>
        <Link
          className={`mt-8 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0877b9] px-6 py-2.5 font-extrabold text-white no-underline transition-colors hover:bg-[#075f95] motion-reduce:transition-none ${ACTION_FOCUS}`}
          to={homePath}
        >
          Về trang chủ
        </Link>
      </section>
    </main>
  );
}
