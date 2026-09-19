import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { AuthenticationContext } from "../src/auth/authentication-context.js";
import { LoginForm } from "../src/auth/ui/login-form.jsx";
import "../src/index.css";

export function SessionExpiredFixture() {
  const [sessionExpired, setSessionExpired] = useState(true);
  const context = useMemo(
    () => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      authError: null,
      sessionExpired,
      dismissSessionExpired: () => setSessionExpired(false),
      login: async () => {
        throw new Error("Login is not exercised by this component fixture.");
      },
    }),
    [sessionExpired],
  );

  return (
    <MemoryRouter>
      <AuthenticationContext.Provider value={context}>
        <LoginForm initialEmail="" onSwitchMode={() => {}} />
      </AuthenticationContext.Provider>
    </MemoryRouter>
  );
}

createRoot(document.getElementById("root")).render(<SessionExpiredFixture />);
