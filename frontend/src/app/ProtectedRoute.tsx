import type { ReactNode } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { AppErrorBoundary } from '@/shared/components/layout/AppErrorBoundary';
import { useAuthStore } from '@/shared/stores/auth.store';
import type { UserRole } from '@/shared/types/auth.types';

const roleRank: Record<UserRole, number> = {
  RESIDENT: 1,
  RESPONSIBLE: 2,
  SUB_ADMIN: 3,
  ADMIN: 4,
};

export function ProtectedRoute({ minRole, children }: { minRole: UserRole; children?: ReactNode }) {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const role = useAuthStore((state) => state.role);

  if (!token || !role) return <Navigate to="/login" replace />;
  if (roleRank[role] < roleRank[minRole]) return <Navigate to="/" replace />;
  if (children) return <>{children}</>;
  return (
    <AppErrorBoundary onNavigateHome={() => navigate('/', { replace: true })}>
      <Outlet />
    </AppErrorBoundary>
  );
}
