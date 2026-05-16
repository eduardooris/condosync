import { Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedLayout } from '@/shared/components/layout/ProtectedLayout';
import { Spinner } from '@/shared/components/ui/Spinner';
import { ProtectedRoute } from '@/app/ProtectedRoute';
import { lazyPage } from '@/shared/lib/lazyImport';

const LoginPage = lazyPage(() => import('@/domains/auth/pages/LoginPage'), 'LoginPage');
const RegisterPage = lazyPage(() => import('@/domains/auth/pages/RegisterPage'), 'RegisterPage');
const ForgotPasswordPage = lazyPage(
  () => import('@/domains/auth/pages/ForgotPasswordPage'),
  'ForgotPasswordPage',
);
const ResetPasswordPage = lazyPage(
  () => import('@/domains/auth/pages/ResetPasswordPage'),
  'ResetPasswordPage',
);
const NoCondominiumPage = lazyPage(
  () => import('@/domains/auth/pages/NoCondominiumPage'),
  'NoCondominiumPage',
);
const DashboardPage = lazyPage(() => import('@/domains/dashboard/pages/DashboardPage'), 'DashboardPage');
const ChargesPage = lazyPage(() => import('@/domains/charges/pages/ChargesPage'), 'ChargesPage');
const ExpensesPage = lazyPage(() => import('@/domains/expenses/pages/ExpensesPage'), 'ExpensesPage');
const BulletinPage = lazyPage(() => import('@/domains/bulletin/pages/BulletinPage'), 'BulletinPage');
const DocumentsPage = lazyPage(() => import('@/domains/documents/pages/DocumentsPage'), 'DocumentsPage');
const OccurrencesPage = lazyPage(
  () => import('@/domains/occurrences/pages/OccurrencesPage'),
  'OccurrencesPage',
);
const PollsPage = lazyPage(() => import('@/domains/polls/pages/PollsPage'), 'PollsPage');
const ReservationsPage = lazyPage(
  () => import('@/domains/reservations/pages/ReservationsPage'),
  'ReservationsPage',
);
const VisitorsPage = lazyPage(() => import('@/domains/visitors/pages/VisitorsPage'), 'VisitorsPage');
const CorrespondencesPage = lazyPage(
  () => import('@/domains/visitors/pages/CorrespondencesPage'),
  'CorrespondencesPage',
);
const NotificationsPage = lazyPage(
  () => import('@/domains/notifications/pages/NotificationsPage'),
  'NotificationsPage',
);
const CondominiumsPage = lazyPage(
  () => import('@/domains/condominiums/pages/CondominiumsPage'),
  'CondominiumsPage',
);
const CondominiumDetailPage = lazyPage(
  () => import('@/domains/condominiums/pages/CondominiumDetailPage'),
  'CondominiumDetailPage',
);
const UnitsPage = lazyPage(() => import('@/domains/units/pages/UnitsPage'), 'UnitsPage');
const SettingsPage = lazyPage(() => import('@/domains/auth/pages/SettingsPage'), 'SettingsPage');
const SetupPage = lazyPage(() => import('@/domains/setup/pages/SetupPage'), 'SetupPage');
const AcceptInvitePage = lazyPage(
  () => import('@/domains/invitations/pages/AcceptInvitePage'),
  'AcceptInvitePage',
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
          { path: 'residents', element: <Navigate to="/units" replace /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
