const OPERATIONAL_ERROR = Object.freeze({
  title: "Đã xảy ra lỗi",
  message: "Không thể kết nối đến máy chủ. Vui lòng thử lại.",
});

export function getAuthErrorPresentation(error, operation) {
  if (error?.kind === "operational") {
    return OPERATIONAL_ERROR;
  }

  if (error?.code === "AUTHENTICATION_FAILED") {
    return {
      title: "Không thể đăng nhập",
      message: "Email hoặc mật khẩu không chính xác.",
    };
  }

  if (error?.code === "EMAIL_ALREADY_EXISTS") {
    return {
      title: "Không thể tạo tài khoản",
      message: "Email này đã được đăng ký.",
    };
  }

  if (error?.code === "VALIDATION_ERROR") {
    return {
      title: operation === "login" ? "Không thể đăng nhập" : "Thông tin chưa hợp lệ",
      message: "Vui lòng kiểm tra lại thông tin và thử lại.",
    };
  }

  return {
    title: operation === "login" ? "Không thể đăng nhập" : "Không thể tạo tài khoản",
    message: "Yêu cầu chưa thể hoàn tất. Vui lòng thử lại.",
  };
}
