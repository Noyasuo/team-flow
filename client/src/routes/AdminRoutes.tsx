import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage';

export function AdminRoutes() {
  const { isAuthenticated, isAuthReady, user } = useAuth();

  if (!isAuthReady) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace state={{ from: '/admin' }} />;
  }

  if (user?.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  return <AdminDashboardPage />;
}