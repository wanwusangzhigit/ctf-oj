import { Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Spinner, ToastProvider } from '@/components/ui';
import { AppLayout } from '@/components/layout/AppLayout';
import { PublicOnly, RequireAdmin, RequireAuth } from '@/components/Guards';
import { useBootstrapAuth } from '@/hooks/useBootstrapAuth';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ChallengesPage } from '@/pages/challenges/ChallengesPage';
import { ChallengeDetailPage } from '@/pages/challenges/ChallengeDetailPage';
import { ScoreboardPage } from '@/pages/ScoreboardPage';
import { UserProfilePage } from '@/pages/UserProfilePage';
import { MyInstancesPage } from '@/pages/MyInstancesPage';
import { AnnouncementsPage } from '@/pages/AnnouncementsPage';
import { AnnouncementDetailPage } from '@/pages/AnnouncementDetailPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { AdminLayout } from '@/pages/admin/AdminLayout';
import { AdminCategoriesPage } from '@/pages/admin/AdminCategoriesPage';
import { AdminChallengesPage } from '@/pages/admin/AdminChallengesPage';
import { AdminAnnouncementsPage } from '@/pages/admin/AdminAnnouncementsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function AppRoutes() {
  useBootstrapAuth();

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/challenges" element={<ChallengesPage />} />
        <Route
          path="/challenges/:id"
          element={
            <RequireAuth>
              <ChallengeDetailPage />
            </RequireAuth>
          }
        />
        <Route path="/scoreboard" element={<ScoreboardPage />} />
        <Route
          path="/instances"
          element={
            <RequireAuth>
              <MyInstancesPage />
            </RequireAuth>
          }
        />
        <Route path="/announcements" element={<AnnouncementsPage />} />
        <Route path="/announcements/:id" element={<AnnouncementDetailPage />} />
        <Route
          path="/notifications"
          element={
            <RequireAuth>
              <NotificationsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/users/:id"
          element={
            <RequireAuth>
              <UserProfilePage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<Navigate to="/admin/categories" replace />} />
          <Route path="categories" element={<AdminCategoriesPage />} />
          <Route path="challenges" element={<AdminChallengesPage />} />
          <Route path="announcements" element={<AdminAnnouncementsPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route
        path="/auth/login"
        element={
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        }
      />
      <Route
        path="/auth/register"
        element={
          <PublicOnly>
            <RegisterPage />
          </PublicOnly>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Suspense
            fallback={
              <div className="flex items-center justify-center min-h-screen">
                <Spinner className="h-5 w-5 text-muted" />
              </div>
            }
          >
            <AppRoutes />
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
