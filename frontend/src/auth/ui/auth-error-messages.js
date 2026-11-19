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

  if (error?.code === "AUTHENTICATION_WARNING") {
    const remaining = Number.isInteger(error.attemptsRemaining)
      ? error.attemptsRemaining
      : 1;
    return {
      title: "Đăng nhập chưa thành công",
      message: `Email hoặc mật khẩu không chính xác. Bạn còn ${remaining} lần thử trước khi đăng nhập tạm thời bị khóa.`,
    };
  }

  if (error?.code === "AUTHENTICATION_LOCKED") {
    const seconds = Number.isInteger(error.retryAfterSeconds)
      ? Math.max(1, Math.min(300, error.retryAfterSeconds))
      : 300;
    const minutes = Math.max(1, Math.ceil(seconds / 60));
    return {
      title: "Đăng nhập tạm thời bị khóa",
      message: `Vui lòng chờ khoảng ${minutes} phút rồi thử lại. Nếu bạn không thực hiện các lần thử này, hãy đổi mật khẩu sau khi đăng nhập.`,
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
