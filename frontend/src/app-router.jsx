import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthPage } from "./auth/ui/auth-page.jsx";
import { AuthenticatedShell } from "./auth/ui/authenticated-shell.jsx";
import {
  AdminRoute,
  GuestRoute,
  ProtectedRoute,
} from "./auth/ui/route-guards.jsx";
import { DashboardPlaceholder } from "./pages/dashboard-placeholder.jsx";
import { AdminTopicPage } from "./topics/admin-topic-page.jsx";
import { PublicTopicLayout } from "./topics/public-topic-layout.jsx";
import { TopicDetailPage } from "./topics/topic-detail-page.jsx";
import { TopicListPage } from "./topics/topic-list-page.jsx";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route element={<PublicTopicLayout />}>
          <Route path="/topics" element={<TopicListPage />} />
          <Route path="/topics/:topicId" element={<TopicDetailPage />} />
        </Route>
        <Route element={<GuestRoute />}>
          <Route element={<AuthPage />}>
            <Route path="/login" element={null} />
            <Route path="/register" element={null} />
          </Route>
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<AuthenticatedShell />}>
            <Route path="/dashboard" element={<DashboardPlaceholder />} />
            <Route element={<AdminRoute />}>
              <Route path="/admin/topics" element={<AdminTopicPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
