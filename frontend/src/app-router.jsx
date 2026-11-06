import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import {
  AdminRoute,
  GuestRoute,
  ProtectedRoute,
  UserRoute,
} from "./auth/ui/route-guards.jsx";
import { LearningSessionStorageObserver } from "./learning/learning-session-storage-observer.jsx";
import { QuizSessionStorageObserver } from "./quiz/quiz-session-storage-observer.jsx";
import { SpeakingSessionStorageObserver } from "./pronunciation/speaking-session-storage-observer.jsx";

const AuthPage = lazyRoute(() => import("./auth/ui/auth-page.jsx"), "AuthPage");
const AuthenticatedShell = lazyRoute(
  () => import("./auth/ui/authenticated-shell.jsx"),
  "AuthenticatedShell",
);
const DashboardPage = lazyRoute(() => import("./dashboard/dashboard-page.jsx"), "DashboardPage");
const LearningFoundationPage = lazyRoute(
  () => import("./learning/learning-foundation-page.jsx"),
  "LearningFoundationPage",
);
const GlobalReviewPage = lazyRoute(() => import("./learning/global-review-page.jsx"), "GlobalReviewPage");
const LearningProgressPage = lazyRoute(
  () => import("./learning-progress/learning-progress-page.jsx"),
  "LearningProgressPage",
);
const LandingPage = lazyRoute(() => import("./landing/landing-page.jsx"), "LandingPage");
const QuizFoundationPage = lazyRoute(
  () => import("./quiz/quiz-foundation-page.jsx"),
  "QuizFoundationPage",
);
const SpeakingPracticePage = lazyRoute(
  () => import("./pronunciation/speaking-practice-page.jsx"),
  "SpeakingPracticePage",
);
const AdminTopicPage = lazyRoute(() => import("./topics/admin-topic-page.jsx"), "AdminTopicPage");
const DiscoveryRouteLayout = lazyRoute(
  () => import("./topics/discovery-route-layout.jsx"),
  "DiscoveryRouteLayout",
);
const TopicDetailPage = lazyRoute(() => import("./topics/topic-detail-page.jsx"), "TopicDetailPage");
const TopicListPage = lazyRoute(() => import("./topics/topic-list-page.jsx"), "TopicListPage");
const AdminVocabularyRoute = lazyRoute(
  () => import("./vocabulary/admin-vocabulary-route.jsx"),
  "AdminVocabularyRoute",
);
const AdminVocabularySetsPage = lazyRoute(
  () => import("./vocabulary-sets/admin-vocabulary-sets-page.jsx"),
  "AdminVocabularySetsPage",
);
const MyVocabularySetsPage = lazyRoute(
  () => import("./vocabulary-sets/my-vocabulary-sets-page.jsx"),
  "MyVocabularySetsPage",
);
const MyVocabularySetDetailPage = lazyRoute(
  () => import("./vocabulary-sets/my-vocabulary-set-detail-page.jsx"),
  "MyVocabularySetDetailPage",
);
const PublicVocabularySetDetailPage = lazyRoute(
  () => import("./vocabulary-sets/public-vocabulary-set-pages.jsx"),
  "PublicVocabularySetDetailPage",
);
const PublicVocabularySetDiscoveryPage = lazyRoute(
  () => import("./vocabulary-sets/public-vocabulary-set-pages.jsx"),
  "PublicVocabularySetDiscoveryPage",
);

export function AppRouter() {
  return (
    <BrowserRouter>
      <LearningSessionStorageObserver />
      <QuizSessionStorageObserver />
      <SpeakingSessionStorageObserver />
      <Routes>
        <Route element={<DiscoveryRouteLayout />}>
          <Route path="/topics" element={<TopicListPage />} />
          <Route path="/topics/:topicId" element={<TopicDetailPage />} />
          <Route path="/topics/:topicId/vocabulary-sets" element={<PublicVocabularySetDiscoveryPage />} />
          <Route path="/vocabulary-sets/:setId" element={<PublicVocabularySetDetailPage />} />
        </Route>
        <Route element={<GuestRoute />}>
          <Route path="/" element={<LandingPage />} />
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
              <Route path="/review" element={<GlobalReviewPage />} />
              <Route path="/quiz/vocabulary-sets/:setId" element={<QuizFoundationPage />} />
              <Route path="/pronunciation/vocabulary-sets/:setId" element={<SpeakingPracticePage />} />
              <Route path="/my/learning-progress" element={<LearningProgressPage />} />
              <Route path="/my/vocabulary-sets" element={<MyVocabularySetsPage />} />
              <Route path="/my/vocabulary-sets/:setId" element={<MyVocabularySetDetailPage />} />
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

function lazyRoute(loadModule, exportName) {
  const LazyRoute = lazy(() => loadModule().then((module) => ({ default: module[exportName] })));

  return function RouteWithLoadingBoundary() {
    return (
      <Suspense fallback={<RouteLoadingState />}>
        <LazyRoute />
      </Suspense>
    );
  };
}

function RouteLoadingState() {
  return (
    <main className="grid min-h-[40vh] place-items-center bg-[#f8faff] p-6" aria-busy="true">
      <p className="m-0 text-sm font-semibold text-slate-600" role="status" aria-live="polite">
        Đang tải trang…
      </p>
    </main>
  );
}
