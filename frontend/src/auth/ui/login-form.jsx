import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useAuthentication } from "../use-authentication.js";
import { loginSchema } from "../validation/auth-schemas.js";
import { getAuthErrorPresentation } from "./auth-error-messages.js";
import { FormAlert } from "./form-alert.jsx";
import { FormField } from "./form-field.jsx";
import { PasswordField } from "./password-field.jsx";

export function LoginForm({ initialEmail = "", onSwitchMode }) {
  const navigate = useNavigate();
  const { login } = useAuthentication();
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: initialEmail, password: "" },
  });

  useEffect(() => {
    reset({ email: initialEmail, password: "" });
  }, [initialEmail, reset]);

  async function submit(values) {
    setFormError(null);
    try {
      await login(values);
      navigate("/dashboard");
    } catch (error) {
      setFormError(getAuthErrorPresentation(error, "login"));
    }
  }

  return (
    <AuthFormFrame
      eyebrow="Chào mừng trở lại"
      title="Tiếp tục học mỗi ngày"
      description="Đăng nhập để tiếp nối hành trình từ vựng của bạn."
    >
      <form className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
        <FormAlert error={formError} />
        <FormField
          id="login-email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="your@example.com"
          error={errors.email}
          disabled={isSubmitting}
          {...register("email")}
        />
        <PasswordField
          id="login-password"
          label="Mật khẩu"
          autoComplete="current-password"
          placeholder="Nhập mật khẩu"
          error={errors.password}
          disabled={isSubmitting}
          {...register("password")}
        />
        <SubmitButton
          isSubmitting={isSubmitting}
          pendingLabel="Đang đăng nhập..."
        >
          Đăng nhập
        </SubmitButton>
      </form>
      <ModeSwitch
        text="Chưa có tài khoản?"
        action="Tạo tài khoản"
        onClick={onSwitchMode}
      />
    </AuthFormFrame>
  );
}

export function AuthFormFrame({ eyebrow, title, description, children }) {
  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col justify-center px-6 py-8 md:px-8 lg:px-10">
      <div className="mb-6">
        <p className="text-xs font-extrabold tracking-[0.17em] text-indigo-600 uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function SubmitButton({ isSubmitting, pendingLabel, children }) {
  return (
    <button
      type="submit"
      disabled={isSubmitting}
      aria-busy={isSubmitting}
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-sm outline-none transition hover:bg-indigo-700 focus-visible:ring-4 focus-visible:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-indigo-400"
    >
      {isSubmitting ? (
        <>
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          <span>{pendingLabel}</span>
        </>
      ) : (
        <>
          <span>{children}</span>
          <ArrowRight className="size-4" aria-hidden="true" />
        </>
      )}
    </button>
  );
}

export function ModeSwitch({ text, action, onClick }) {
  return (
    <p className="mt-6 text-center text-sm text-slate-500">
      {text}{" "}
      <button
        type="button"
        onClick={onClick}
        className="rounded font-bold text-indigo-700 outline-none hover:text-indigo-900 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      >
        {action}
      </button>
    </p>
  );
}
