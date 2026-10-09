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
    <main className="auth-stage flex min-h-screen justify-center px-3 py-4 sm:px-6 sm:py-8">
      <div className="my-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-indigo-950/10">
        <div className="relative grid min-h-[min(600px,calc(100vh-4rem))] grid-cols-2 overflow-hidden max-[900px]:flex max-[900px]:min-h-0 max-[900px]:flex-col" data-mode={mode}>
          <div className={`auth-moving-panel col-start-1 row-start-1 min-w-0 max-[900px]:relative max-[900px]:w-full max-[900px]:translate-x-0 ${mode === "register" ? "translate-x-full" : "translate-x-0"}`}>
            <VocabularyExperience mode={mode} />
          </div>
          <div className={`auth-moving-panel col-start-2 row-start-1 min-w-0 bg-white max-[900px]:relative max-[900px]:w-full max-[900px]:translate-x-0 ${mode === "register" ? "-translate-x-full" : "translate-x-0"}`}>
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
    </main>
  );
}
