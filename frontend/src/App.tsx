import { Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfirmProvider, Spinner, ToastProvider } from '@/components/ui';
import { AppLayout } from '@/components/layout/AppLayout';
import { AdminIndexRedirect, PublicOnly, RequireAdmin, RequireAuth, RequireChallengeManage, RequireCompetitionManage, RequirePermission } from '@/components/Guards';
import { useBootstrapAuth } from '@/hooks/useBootstrapAuth';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { VerifyEmailPage } from '@/pages/auth/VerifyEmailPage';
import { ChallengesPage } from '@/pages/challenges/ChallengesPage';
import { ChallengeDetailPage } from '@/pages/challenges/ChallengeDetailPage';
import { ChallengeLayout } from '@/pages/challenges/ChallengeLayout';
import { ChallengeWriteupsPage } from '@/pages/challenges/ChallengeWriteupsPage';
import { ChallengeDiscussionsPage } from '@/pages/challenges/ChallengeDiscussionsPage';
import { ScoreboardPage } from '@/pages/ScoreboardPage';
import { UserProfilePage } from '@/pages/UserProfilePage';
import { MyInstancesPage } from '@/pages/MyInstancesPage';
import { MySubmissionsPage } from '@/pages/MySubmissionsPage';
import { MeSolvesPage } from '@/pages/MeSolvesPage';
import { SettingsLayout } from '@/pages/settings/SettingsLayout';
import { SettingsProfilePage } from '@/pages/settings/SettingsProfilePage';
import { SettingsPasswordPage } from '@/pages/settings/SettingsPasswordPage';
import { SettingsSecurityPage } from '@/pages/settings/SettingsSecurityPage';
import { AnnouncementsPage } from '@/pages/AnnouncementsPage';
import { SearchPage } from '@/pages/SearchPage';
import { AnnouncementDetailPage } from '@/pages/AnnouncementDetailPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { StatsPage } from '@/pages/StatsPage';
import { RealtimeScoreboardPage } from '@/pages/RealtimeScoreboardPage';
import { TeamsPage } from '@/pages/TeamsPage';
import { TeamDetailPage, TeamScoreboardPage } from '@/pages/TeamDetailPage';
import { TeamNewPage } from '@/pages/TeamNewPage';
import { TeamJoinPage } from '@/pages/TeamJoinPage';
import { CompetitionsPage } from '@/pages/CompetitionsPage';
import { CommunityLayout } from '@/pages/community/CommunityLayout';
import { CommunityListPage } from '@/pages/community/CommunityListPage';
import { CommunityNewPage } from '@/pages/community/CommunityNewPage';
import { CommunityTopicPage } from '@/pages/community/CommunityTopicPage';
import { CommunityEditPage } from '@/pages/community/CommunityEditPage';
import { CommunityHistoryPage } from '@/pages/community/CommunityHistoryPage';
import { CompetitionLayout } from '@/pages/competitions/CompetitionLayout';
import { CompetitionOverviewPage } from '@/pages/competitions/CompetitionOverviewPage';
import { CompetitionChallengesPage } from '@/pages/competitions/CompetitionChallengesPage';
import { CompetitionScoreboardPage } from '@/pages/competitions/CompetitionScoreboardPage';
import { CompetitionAnnouncementsPage } from '@/pages/competitions/CompetitionAnnouncementsPage';
import { CompetitionDiscussionsPage } from '@/pages/competitions/CompetitionDiscussionsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { AdminLayout } from '@/pages/admin/AdminLayout';
import { AdminCategoriesPage } from '@/pages/admin/AdminCategoriesPage';
import { AdminChallengesPage } from '@/pages/admin/AdminChallengesPage';
import { AdminAccessGroupsPage } from '@/pages/admin/AdminAccessGroupsPage';
import { AdminChallengeNewPage } from '@/pages/admin/AdminChallengeNewPage';
import { AdminChallengeEditPage } from '@/pages/admin/AdminChallengeEditPage';
import { AdminAnnouncementsPage } from '@/pages/admin/AdminAnnouncementsPage';
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage';
import { AdminUserDetailPage } from '@/pages/admin/AdminUserDetailPage';
import { AdminOverviewPage } from '@/pages/admin/AdminOverviewPage';
import { AdminSettingsPage } from '@/pages/admin/AdminSettingsPage';
import { AdminAuditPage } from '@/pages/admin/AdminAuditPage';
import { AdminServerPage } from '@/pages/admin/AdminServerPage';
import { AdminCompetitionsPage } from '@/pages/admin/AdminCompetitionsPage';
import { AdminCompetitionNewPage } from '@/pages/admin/AdminCompetitionNewPage';
import { AdminCompetitionEditPage } from '@/pages/admin/AdminCompetitionEditPage';
import { AdminCompetitionAnnouncementsPage } from '@/pages/admin/AdminCompetitionAnnouncementsPage';
import { AdminCompetitionRegistrationsPage } from '@/pages/admin/AdminCompetitionRegistrationsPage';
import { AdminCommunityPage } from '@/pages/admin/AdminCommunityPage';

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
              <ChallengeLayout />
            </RequireAuth>
          }
        >
          <Route index element={<ChallengeDetailPage />} />
          <Route path="writeups" element={<ChallengeWriteupsPage />} />
          <Route path="discussions" element={<ChallengeDiscussionsPage />} />
        </Route>
        <Route path="/scoreboard" element={<ScoreboardPage />} />
        <Route path="/scoreboard/realtime" element={<RealtimeScoreboardPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/community" element={<CommunityLayout />}>
          <Route index element={<CommunityListPage />} />
          <Route path="new" element={<RequireAuth><CommunityNewPage /></RequireAuth>} />
          <Route path=":id" element={<CommunityTopicPage />} />
          <Route path=":id/edit" element={<RequireAuth><CommunityEditPage /></RequireAuth>} />
          <Route path=":id/history" element={<RequireAuth><CommunityHistoryPage /></RequireAuth>} />
        </Route>
        <Route path="/competitions" element={<CompetitionsPage />} />
        <Route path="/competitions/:id" element={<CompetitionLayout />}>
          <Route index element={<CompetitionOverviewPage />} />
          <Route path="challenges" element={<CompetitionChallengesPage />} />
          <Route path="scoreboard" element={<CompetitionScoreboardPage />} />
          <Route path="announcements" element={<CompetitionAnnouncementsPage />} />
          <Route path="discussions" element={<CompetitionDiscussionsPage />} />
        </Route>
        <Route path="/teams" element={<RequireAuth><TeamsPage /></RequireAuth>} />
        <Route path="/teams/new" element={<RequireAuth><TeamNewPage /></RequireAuth>} />
        <Route path="/teams/join" element={<RequireAuth><TeamJoinPage /></RequireAuth>} />
        <Route path="/teams/scoreboard" element={<TeamScoreboardPage />} />
        <Route path="/teams/:id" element={<TeamDetailPage />} />
        <Route
          path="/instances"
          element={
            <RequireAuth>
              <MyInstancesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/me/submissions"
          element={
            <RequireAuth>
              <MySubmissionsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/me/solves"
          element={
            <RequireAuth>
              <MeSolvesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <SettingsLayout />
            </RequireAuth>
          }
        >
          <Route index element={<SettingsProfilePage />} />
          <Route path="password" element={<SettingsPasswordPage />} />
          <Route path="security" element={<SettingsSecurityPage />} />
        </Route>
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
          <Route index element={<AdminIndexRedirect />} />
          <Route path="overview" element={<RequirePermission permission="admin.overview"><AdminOverviewPage /></RequirePermission>} />
          <Route path="categories" element={<RequirePermission permission="challenge.manage"><AdminCategoriesPage /></RequirePermission>} />
          <Route path="challenges" element={<RequireChallengeManage><AdminChallengesPage /></RequireChallengeManage>} />
          <Route path="challenges/new" element={<RequirePermission permission="challenge.manage"><AdminChallengeNewPage /></RequirePermission>} />
          <Route path="challenges/:id/edit" element={<RequireChallengeManage><AdminChallengeEditPage /></RequireChallengeManage>} />
          <Route path="access-groups" element={<RequirePermission permission="challenge.manage"><AdminAccessGroupsPage /></RequirePermission>} />
          <Route path="announcements" element={<RequirePermission permission="announcement.manage"><AdminAnnouncementsPage /></RequirePermission>} />
          <Route path="community" element={<RequirePermission permission="community.manage"><AdminCommunityPage /></RequirePermission>} />
          <Route path="users" element={<RequirePermission permission="user.manage"><AdminUsersPage /></RequirePermission>} />
          <Route path="users/:id" element={<RequirePermission permission="user.manage"><AdminUserDetailPage /></RequirePermission>} />
          <Route path="competitions" element={<RequireCompetitionManage><AdminCompetitionsPage /></RequireCompetitionManage>} />
          <Route path="competitions/new" element={<RequirePermission permission="competition.manage"><AdminCompetitionNewPage /></RequirePermission>} />
          <Route path="competitions/:id/edit" element={<RequireCompetitionManage><AdminCompetitionEditPage /></RequireCompetitionManage>} />
          <Route path="competitions/:id/announcements" element={<RequireCompetitionManage><AdminCompetitionAnnouncementsPage /></RequireCompetitionManage>} />
          <Route path="competitions/:id/registrations" element={<RequireCompetitionManage><AdminCompetitionRegistrationsPage /></RequireCompetitionManage>} />
          <Route path="settings" element={<RequirePermission permission="settings.manage"><AdminSettingsPage /></RequirePermission>} />
          <Route path="audit" element={<RequirePermission permission="audit.view"><AdminAuditPage /></RequirePermission>} />
          <Route path="server" element={<RequirePermission permission="server.manage"><AdminServerPage /></RequirePermission>} />
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
      <Route
        path="/auth/forgot-password"
        element={
          <PublicOnly>
            <ForgotPasswordPage />
          </PublicOnly>
        }
      />
      <Route path="/auth/reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
      <Route path="/auth/verify-email/:token" element={<VerifyEmailPage />} />
      <Route path="/auth/verify-email" element={<VerifyEmailPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ConfirmProvider>
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
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
