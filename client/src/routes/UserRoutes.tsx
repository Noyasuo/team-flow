import { Route } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { DashboardPage } from '../pages/user/DashboardPage';
import { KanbanPage } from '../pages/user/KanbanPage';
import { NotificationsPage } from '../pages/user/NotificationsPage';
import { ProjectsFallbackPage } from '../pages/user/ProjectsFallbackPage';
import { TaskDetailsPage } from '../pages/user/TaskDetailsPage';

export const userRoutes = (
  <>
    <Route element={<ProtectedRoute />}>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsFallbackPage />} />
        <Route path="/projects/:projectId" element={<KanbanPage />} />
        <Route path="/tasks/:taskId" element={<TaskDetailsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
      </Route>
    </Route>
  </>
);