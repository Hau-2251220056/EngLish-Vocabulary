import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useAuthentication } from "../use-authentication.js";
import { registerSchema } from "../validation/auth-schemas.js";
import { getAuthErrorPresentation } from "./auth-error-messages.js";
import { FormAlert } from "./form-alert.jsx";
import { FormField } from "./form-field.jsx";
import { AuthFormFrame, ModeSwitch, SubmitButton } from "./login-form.jsx";
import { PasswordField } from "./password-field.jsx";

export function RegisterForm({ onSwitchMode, onRegistrationSuccess }) {
  const { register: registerAccount } = useAuthentication();
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      display_name: "",
      email: "",
      password: "",
      confirm_password: "",
    },
  });

  async function submit({ display_name, email, password }) {
    setFormError(null);
    try {
      await registerAccount({ display_name, email, password });
      reset({
        display_name: "",
        email: "",
        password: "",
        confirm_password: "",
      });
      onRegistrationSuccess(email);
    } catch (error) {
      setFormError(getAuthErrorPresentation(error, "register"));
    }
  }

  return (
    <AuthFormFrame
      eyebrow="Tạo tài khoản"
      title="Bắt đầu cùng ELVocab"
      description="Xây dựng vốn từ vựng vững chắc, từng ngày một."
    >
      <form className="space-y-3.5" onSubmit={handleSubmit(submit)} noValidate>
        <FormAlert error={formError} />
        <FormField
          id="register-display-name"
          label="Tên hiển thị"
          type="text"
          autoComplete="name"
          placeholder="Tên của bạn"
          error={errors.display_name}
          disabled={isSubmitting}
          {...register("display_name")}
        />
        <FormField
          id="register-email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="your@example.com"
          error={errors.email}
          disabled={isSubmitting}
          {...register("email")}
        />
        <PasswordField
          id="register-password"
          label="Mật khẩu"
          autoComplete="new-password"
          placeholder="Tối thiểu 8 ký tự"
          hint="Sử dụng ít nhất 8 ký tự."
          error={errors.password}
          disabled={isSubmitting}
          {...register("password")}
        />
        <PasswordField
          id="register-confirm-password"
          label="Xác nhận mật khẩu"
          autoComplete="new-password"
          placeholder="Nhập lại mật khẩu"
          error={errors.confirm_password}
          disabled={isSubmitting}
          {...register("confirm_password")}
        />
        <SubmitButton
          isSubmitting={isSubmitting}
          pendingLabel="Đang tạo tài khoản..."
        >
          Tạo tài khoản
        </SubmitButton>
      </form>
      <ModeSwitch
        text="Đã có tài khoản?"
        action="Đăng nhập"
        onClick={onSwitchMode}
      />
    </AuthFormFrame>
  );
}
