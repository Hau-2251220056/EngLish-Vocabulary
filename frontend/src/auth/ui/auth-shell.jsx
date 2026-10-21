import { Link } from "react-router-dom";
import elVocabLogo from "../../assets/images/logo.png";
import { LoginForm } from "./login-form.jsx";
import { RegisterForm } from "./register-form.jsx";
import { VocabularyExperience } from "./vocabulary-experience.jsx";

export function AuthShell({
  mode,
  loginEmail,
  onSwitchMode,
  onRegistrationSuccess,
}) {
  return (
    <main className="auth-stage flex min-h-screen justify-center px-3 pb-4 pt-8 sm:px-6 sm:pb-8 sm:pt-10 min-[901px]:py-8">
      <div className="my-0 w-full max-w-5xl min-[901px]:my-auto">
        <img
          src={elVocabLogo}
          alt="ELVocab"
          className="mx-auto mb-3 block h-auto w-44 min-[901px]:hidden"
        />
        <Link
          to="/"
          data-testid="auth-home-link"
          className="mb-3 inline-flex min-h-11 w-fit items-center rounded-lg px-1 text-sm font-semibold text-slate-500 no-underline transition-colors hover:text-[#3978b6] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#b9d9f6] motion-reduce:transition-none"
        >
          ← Quay về trang chủ
        </Link>
        <div data-testid="auth-card" className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-indigo-950/10">
          <div className="relative grid min-h-[min(600px,calc(100vh-7.5rem))] grid-cols-2 overflow-hidden max-[900px]:flex max-[900px]:min-h-0 max-[900px]:flex-col" data-mode={mode}>
            <div
              data-testid="auth-illustration-panel"
              className={`auth-moving-panel col-start-1 row-start-1 min-w-0 max-[900px]:hidden ${mode === "register" ? "translate-x-full" : "translate-x-0"}`}
            >
              <VocabularyExperience mode={mode} />
            </div>
            <div
              data-testid="auth-form-panel"
              className={`auth-moving-panel col-start-2 row-start-1 min-w-0 bg-white max-[900px]:relative max-[900px]:w-full max-[900px]:translate-x-0 ${mode === "register" ? "-translate-x-full" : "translate-x-0"}`}
            >
              {mode === "login" ? (
                <LoginForm
                  initialEmail={loginEmail}
                  onSwitchMode={() => onSwitchMode("register")}
                />
              ) : (
                <RegisterForm
                  onSwitchMode={() => onSwitchMode("login")}
                  onRegistrationSuccess={onRegistrationSuccess}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
