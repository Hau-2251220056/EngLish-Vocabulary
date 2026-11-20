import assert from "node:assert/strict";
import test from "node:test";
import {
  loginSchema,
  registerSchema,
} from "../src/auth/validation/auth-schemas.js";

test("login validation enforces required email and password rules", () => {
  const emptyResult = loginSchema.safeParse({ email: "", password: "" });
  assert.equal(emptyResult.success, false);
  assert.deepEqual(issueMessages(emptyResult), [
    "Vui lòng nhập email.",
    "Email không hợp lệ.",
    "Vui lòng nhập mật khẩu.",
    "Mật khẩu phải có ít nhất 8 ký tự.",
  ]);

  const invalidResult = loginSchema.safeParse({
    email: "not-an-email",
    password: "short",
  });
  assert.equal(invalidResult.success, false);
  assert.deepEqual(issueMessages(invalidResult), [
    "Email không hợp lệ.",
    "Mật khẩu phải có ít nhất 8 ký tự.",
  ]);
});

test("register validation enforces display name and confirmation match", () => {
  const result = registerSchema.safeParse({
    display_name: "",
    email: "learner@example.com",
    password: "password",
    confirm_password: "different",
  });

  assert.equal(result.success, false);
  assert.deepEqual(issueMessages(result), [
    "Vui lòng nhập tên hiển thị.",
    "Mật khẩu xác nhận không khớp.",
  ]);
});

test("valid registration data retains confirmation only in schema output", () => {
  const input = {
    display_name: "Learner",
    email: "learner@example.com",
    password: "password",
    confirm_password: "password",
  };

  assert.deepEqual(registerSchema.parse(input), input);
});

function issueMessages(result) {
  return result.error.issues.map((issue) => issue.message);
}
