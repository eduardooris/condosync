/* eslint-disable react-refresh/only-export-components */
import { Suspense, lazy, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedLayout } from '@/shared/components/layout/ProtectedLayout';
import { Spinner } from '@/shared/components/ui/Spinner';
import { ProtectedRoute } from '@/app/ProtectedRoute';

const LoginPage = lazy(() => import('@/domains/auth/pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/domains/auth/pages/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() =>
  import('@/domains/auth/pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })),
);
const ResetPasswordPage = lazy(() =>
  import('@/domains/auth/pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })),
);
const NoCondominiumPage = lazy(() =>
  import('@/domains/auth/pages/NoCondominiumPage').then((m) => ({ default: m.NoCondominiumPage })),
);
const DashboardPage = lazy(() => import('@/domains/dashboard/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ChargesPage = lazy(() => import('@/domains/charges/pages/ChargesPage').then((m) => ({ default: m.ChargesPage })));
const ExpensesPage = lazy(() => import('@/domains/expenses/pages/ExpensesPage').then((m) => ({ default: m.ExpensesPage })));
const BulletinPage = lazy(() => import('@/domains/bulletin/pages/BulletinPage').then((m) => ({ default: m.BulletinPage })));
const DocumentsPage = lazy(() => import('@/domains/documents/pages/DocumentsPage').then((m) => ({ default: m.DocumentsPage })));
const OccurrencesPage = lazy(() => import('@/domains/occurrences/pages/OccurrencesPage').then((m) => ({ default: m.OccurrencesPage })));
const PollsPage = lazy(() => import('@/domains/polls/pages/PollsPage').then((m) => ({ default: m.PollsPage })));
const ReservationsPage = lazy(() =>
  import('@/domains/reservations/pages/ReservationsPage').then((m) => ({ default: m.ReservationsPage })),
);
const VisitorsPage = lazy(() =>
  import('@/domains/visitors/pages/VisitorsPage').then((m) => ({ default: m.VisitorsPage })),
);
const CorrespondencesPage = lazy(() =>
  import('@/domains/visitors/pages/CorrespondencesPage').then((m) => ({ default: m.CorrespondencesPage })),
);
const NotificationsPage = lazy(() =>
  import('@/domains/notifications/pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })),
);
const CondominiumsPage = lazy(() => import('@/domains/condominiums/pages/CondominiumsPage').then((m) => ({ default: m.CondominiumsPage })));
const CondominiumDetailPage = lazy(() =>
  import('@/domains/condominiums/pages/CondominiumDetailPage').then((m) => ({ default: m.CondominiumDetailPage })),
);
const UnitsPage = lazy(() => import('@/domains/units/pages/UnitsPage').then((m) => ({ default: m.UnitsPage })));
const ResidentsPage = lazy(() => import('@/domains/residents/pages/ResidentsPage').then((m) => ({ default: m.ResidentsPage })));
const SettingsPage = lazy(() => import('@/domains/auth/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const SetupPage = lazy(() => import('@/domains/setup/pages/SetupPage').then((m) => ({ default: m.SetupPage })));
const AcceptInvitePage = lazy(() =>
  import('@/domains/invitations/pages/AcceptInvitePage').then((m) => ({ default: m.AcceptInvitePage })),
);

const withSuspense = (component: ReactNode) => <Suspense fallback={<Spinner size="lg" />}>{component}</Suspense>;

export const router = createBrowserRouter([
  // Public auth flow
  { path: '/login', element: withSuspense(<LoginPage />) },
  { path: '/register', element: withSuspense(<RegisterPage />) },
  { path: '/forgot-password', element: withSuspense(<ForgotPasswordPage />) },
  { path: '/reset-password', element: withSuspense(<ResetPasswordPage />) },
  { path: '/invite/:token', element: withSuspense(<AcceptInvitePage />) },
  {
    element: <ProtectedRoute minRole="RESIDENT" />,
    children: [
      // Fullscreen flows (no app shell)
      {
        path: '/setup',
        element: withSuspense(
          <ProtectedRoute minRole="SUB_ADMIN">
            <SetupPage />
          </ProtectedRoute>,
        ),
      },
      { path: '/no-condo', element: withSuspense(<NoCondominiumPage />) },
      // Legacy redirect — old onboarding URL points to the new setup
      { path: '/onboarding', element: <Navigate to="/setup" replace /> },
      {
        path: '/',
        element: <ProtectedLayout />,
        children: [
          { index: true, element: withSuspense(<DashboardPage />) },
          { path: 'charges', element: withSuspense(<ChargesPage />) },
          { path: 'expenses', element: withSuspense(<ExpensesPage />) },
          { path: 'bulletin', element: withSuspense(<BulletinPage />) },
          { path: 'documents', element: withSuspense(<DocumentsPage />) },
          { path: 'occurrences', element: withSuspense(<OccurrencesPage />) },
          { path: 'polls', element: withSuspense(<PollsPage />) },
          { path: 'reservations', element: withSuspense(<ReservationsPage />) },
          { path: 'visitors', element: withSuspense(<VisitorsPage />) },
          { path: 'correspondences', element: withSuspense(<CorrespondencesPage />) },
          { path: 'notifications', element: withSuspense(<NotificationsPage />) },
          { path: 'settings', element: withSuspense(<SettingsPage />) },
          { path: 'condominiums', element: withSuspense(<ProtectedRoute minRole="SUB_ADMIN"><CondominiumsPage /></ProtectedRoute>) },
          { path: 'condominiums/:id', element: withSuspense(<ProtectedRoute minRole="SUB_ADMIN"><CondominiumDetailPage /></ProtectedRoute>) },
          {
            path: 'units',
            element: withSuspense(
              <ProtectedRoute minRole="SUB_ADMIN">
                <UnitsPage />
              </ProtectedRoute>,
            ),
          },
          {
            path: 'residents',
            element: withSuspense(
              <ProtectedRoute minRole="SUB_ADMIN">
                <ResidentsPage />
              </ProtectedRoute>,
            ),
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
