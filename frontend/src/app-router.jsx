import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthPage } from "./auth/ui/auth-page.jsx";
import { AuthenticatedShell } from "./auth/ui/authenticated-shell.jsx";
import { GuestRoute, ProtectedRoute } from "./auth/ui/route-guards.jsx";
import { DashboardPlaceholder } from "./pages/dashboard-placeholder.jsx";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route element={<GuestRoute />}>
          <Route element={<AuthPage />}>
            <Route path="/login" element={null} />
            <Route path="/register" element={null} />
          </Route>
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<AuthenticatedShell />}>
            <Route path="/dashboard" element={<DashboardPlaceholder />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
