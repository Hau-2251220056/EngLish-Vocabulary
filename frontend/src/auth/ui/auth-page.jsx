import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AuthShell } from "./auth-shell.jsx";
import { SuccessToast } from "./success-toast.jsx";

const REGISTRATION_HANDOFF_DELAY_MS = 1200;

export function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const mode = location.pathname === "/register" ? "register" : "login";
  const [loginEmail, setLoginEmail] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
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
    setShowSuccess(false);
    navigate(`/${nextMode}`);
  }

  function handleRegistrationSuccess(email) {
    setLoginEmail(email);
    setShowSuccess(true);
    handoffTimer.current = setTimeout(() => {
      handoffTimer.current = null;
      setShowSuccess(false);
      navigate("/login");
    }, REGISTRATION_HANDOFF_DELAY_MS);
  }

  return (
    <>
      <SuccessToast isVisible={showSuccess} />
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
