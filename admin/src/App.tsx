import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from '@/auth/RequireAuth';
import { Layout } from '@/components/Layout';
import { LoginPage } from '@/pages/LoginPage';
import { OverviewPage } from '@/pages/OverviewPage';
import { PaymentsPage } from '@/pages/PaymentsPage';
import { PaymentAccountDetailPage } from '@/pages/PaymentAccountDetailPage';
import { ChargesPage } from '@/pages/ChargesPage';
import { WebhooksPage } from '@/pages/WebhooksPage';
import { CondominiumsPage } from '@/pages/CondominiumsPage';
import { CondominiumDetailPage } from '@/pages/CondominiumDetailPage';
import { UsersPage } from '@/pages/UsersPage';
import { UserDetailPage } from '@/pages/UserDetailPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="/condominios" element={<CondominiumsPage />} />
        <Route path="/condominios/:id" element={<CondominiumDetailPage />} />
        <Route path="/usuarios" element={<UsersPage />} />
        <Route path="/usuarios/:id" element={<UserDetailPage />} />
        <Route path="/pagamentos" element={<PaymentsPage />} />
        <Route
          path="/pagamentos/:accountId"
          element={<PaymentAccountDetailPage />}
        />
        <Route path="/cobrancas" element={<ChargesPage />} />
        <Route path="/webhooks" element={<WebhooksPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
