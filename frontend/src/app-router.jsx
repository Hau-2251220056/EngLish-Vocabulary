import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthPage } from "./auth/ui/auth-page.jsx";
import { AuthenticatedShell } from "./auth/ui/authenticated-shell.jsx";
import {
  AdminRoute,
  GuestRoute,
  ProtectedRoute,
  UserRoute,
} from "./auth/ui/route-guards.jsx";
import { DashboardPage } from "./dashboard/dashboard-page.jsx";
import { LearningFoundationPage } from "./learning/learning-foundation-page.jsx";
import { LearningSessionStorageObserver } from "./learning/learning-session-storage-observer.jsx";
import { LearningProgressPage } from "./learning-progress/learning-progress-page.jsx";
import { AdminTopicPage } from "./topics/admin-topic-page.jsx";
import { PublicTopicLayout } from "./topics/public-topic-layout.jsx";
import { TopicDetailPage } from "./topics/topic-detail-page.jsx";
import { TopicListPage } from "./topics/topic-list-page.jsx";
import { AdminVocabularyRoute } from "./vocabulary/admin-vocabulary-route.jsx";
import { AdminVocabularySetsPage } from "./vocabulary-sets/admin-vocabulary-sets-page.jsx";
import { MyVocabularySetsPage } from "./vocabulary-sets/my-vocabulary-sets-page.jsx";
import {
  PublicVocabularySetDetailPage,
  PublicVocabularySetDiscoveryPage,
} from "./vocabulary-sets/public-vocabulary-set-pages.jsx";

export function AppRouter() {
  return (
    <BrowserRouter>
      <LearningSessionStorageObserver />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route element={<PublicTopicLayout />}>
          <Route path="/topics" element={<TopicListPage />} />
          <Route path="/topics/:topicId" element={<TopicDetailPage />} />
          <Route path="/topics/:topicId/vocabulary-sets" element={<PublicVocabularySetDiscoveryPage />} />
          <Route path="/vocabulary-sets/:setId" element={<PublicVocabularySetDetailPage />} />
        </Route>
        <Route element={<GuestRoute />}>
          <Route element={<AuthPage />}>
            <Route path="/login" element={null} />
            <Route path="/register" element={null} />
          </Route>
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<AuthenticatedShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route element={<UserRoute />}>
              <Route path="/learn/vocabulary-sets/:setId" element={<LearningFoundationPage />} />
              <Route path="/my/learning-progress" element={<LearningProgressPage />} />
              <Route path="/my/vocabulary-sets" element={<MyVocabularySetsPage />} />
              <Route path="/my/vocabulary-sets/:setId" element={<MyVocabularySetsPage />} />
            </Route>
            <Route element={<AdminRoute />}>
              <Route path="/admin/topics" element={<AdminTopicPage />} />
              <Route path="/admin/vocabulary" element={<AdminVocabularyRoute />} />
              <Route path="/admin/vocabulary-sets" element={<AdminVocabularySetsPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
