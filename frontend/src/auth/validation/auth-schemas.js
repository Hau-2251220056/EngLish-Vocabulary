import { z } from "zod";

const emailSchema = z
  .string()
  .min(1, "Vui lòng nhập email.")
  .email("Email không hợp lệ.");

const passwordSchema = z
  .string()
  .min(1, "Vui lòng nhập mật khẩu.")
  .min(8, "Mật khẩu phải có ít nhất 8 ký tự.");

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const registerSchema = z
  .object({
    display_name: z.string().min(1, "Vui lòng nhập tên hiển thị."),
    email: emailSchema,
    password: passwordSchema,
    confirm_password: z.string().min(1, "Vui lòng xác nhận mật khẩu."),
  })
  .refine((values) => values.password === values.confirm_password, {
    message: "Mật khẩu xác nhận không khớp.",
    path: ["confirm_password"],
  });
