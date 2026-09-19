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
    <main className="auth-stage flex min-h-screen items-center justify-center px-3 py-4 sm:px-6 sm:py-8">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-indigo-950/10">
        <div className="auth-shell-content" data-mode={mode}>
          <div className="auth-moving-panel auth-vocabulary-panel">
            <VocabularyExperience mode={mode} />
          </div>
          <div className="auth-moving-panel auth-form-panel bg-white">
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
