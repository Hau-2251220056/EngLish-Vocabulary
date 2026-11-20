import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { notifications } from "../../components/notification-service.js";
import { AuthShell } from "./auth-shell.jsx";

const REGISTRATION_HANDOFF_DELAY_MS = 1200;
const REGISTRATION_SUCCESS_TOAST_ID = "auth-registration-success";

export function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const mode = location.pathname === "/register" ? "register" : "login";
  const [loginEmail, setLoginEmail] = useState("");
  const handoffTimer = useRef(null);

  useEffect(
    () => () => {
      if (handoffTimer.current) clearTimeout(handoffTimer.current);
    },
    [],
  );

  function switchMode(nextMode) {
    if (handoffTimer.current) {
      clearTimeout(handoffTimer.current);
      handoffTimer.current = null;
    }
    navigate(`/${nextMode}`);
  }

  function handleRegistrationSuccess(email) {
    setLoginEmail(email);
    notifications.success(
      "Tạo tài khoản thành công!",
      REGISTRATION_SUCCESS_TOAST_ID,
      { role: "status" },
    );
    handoffTimer.current = setTimeout(() => {
      handoffTimer.current = null;
      navigate("/login");
    }, REGISTRATION_HANDOFF_DELAY_MS);
  }

  return (
    <>
      <AuthShell
        mode={mode}
        loginEmail={loginEmail}
        onSwitchMode={switchMode}
        onRegistrationSuccess={handleRegistrationSuccess}
      />
      <Outlet />
    </>
  );
}
