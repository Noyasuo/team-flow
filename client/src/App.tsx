import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthPage } from './pages/user/AuthPage';
import { ChangePasswordPage } from './pages/user/ChangePasswordPage';
import { AdminRoutes } from './routes/AdminRoutes';
import { userRoutes } from './routes/UserRoutes';

function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route path="/admin" element={<AdminRoutes />} />
      {userRoutes}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
