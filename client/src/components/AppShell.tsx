import { Bell, LayoutDashboard, Layers, UserCircle2 } from 'lucide-react';
import React from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { useAuth } from '../context/AuthContext';
import { useWorkspaceContext } from '../context/WorkspaceContext';
import { WORKSPACES } from '../lib/graphql';
import { ProfileDropdown } from './ProfileDropdown';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/projects', label: 'Projects', icon: Layers },
];

type Workspace = {
  id: string;
  name: string;
};

type WorkspacesResult = {
  workspaces: Workspace[];
};

export function AppShell() {
  const { user, logout } = useAuth();
  const { selectedWorkspaceId, setSelectedWorkspaceId } = useWorkspaceContext();
  const { data: workspacesData } = useQuery<WorkspacesResult>(WORKSPACES);

  // Set first workspace as default if none selected
  const workspaces = workspacesData?.workspaces ?? [];
  const activeWorkspace = workspaces.find(w => w.id === selectedWorkspaceId) || workspaces[0];

  React.useEffect(() => {
    if (activeWorkspace && !selectedWorkspaceId) {
      setSelectedWorkspaceId(activeWorkspace.id);
    }
  }, [activeWorkspace, selectedWorkspaceId, setSelectedWorkspaceId]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#f4f3e6,#d9ecf0_45%,#eef4f8)] text-ink">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 p-4 md:grid-cols-[220px_1fr] md:p-8">
        <aside className="rounded-2xl border border-white/70 bg-white/70 p-5 shadow-float backdrop-blur">
          <div className="mb-8">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-aqua">TeamFlow</p>
            <h1 className="mt-2 text-2xl font-semibold">Ship work in flow</h1>
          </div>

          {/* Workspace Selector */}
          {workspaces.length > 0 && (
            <div className="mb-6">
              <label className="block text-xs uppercase tracking-wide text-ink/50 mb-2">Workspace</label>
              <select
                value={activeWorkspace?.id ?? ''}
                onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                className="w-full rounded-lg border border-ink/20 bg-white px-3 py-2 text-sm font-medium text-ink hover:border-ink/40 transition appearance-none cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23333' d='M1 1l5 5 5-5'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 8px center',
                  paddingRight: '28px',
                }}
              >
                {workspaces.map(ws => (
                  <option key={ws.id} value={ws.id}>{ws.name}</option>
                ))}
              </select>
            </div>
          )}

          <nav className="space-y-2">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                    isActive
                      ? 'bg-ink text-mist'
                      : 'text-ink/80 hover:bg-white hover:text-ink'
                  }`
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
            {user?.role === 'ADMIN' ? (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                    isActive ? 'bg-ink text-mist' : 'text-ink/80 hover:bg-white hover:text-ink'
                  }`
                }
              >
                <UserCircle2 size={16} />
                Admin dashboard
              </NavLink>
            ) : null}
          </nav>
        </aside>

        <main className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-float backdrop-blur md:p-6">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-4">
            <div className="flex items-center gap-3 text-sm">
              <UserCircle2 size={18} />
              <span className="font-medium">{user?.name}</span>
              <span className="text-ink/50">{user?.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/notifications"
                className="inline-flex items-center gap-1 rounded-lg border border-ink/10 px-3 py-1.5 text-sm hover:bg-ink hover:text-mist"
              >
                <Bell size={14} /> Alerts
              </Link>
                <ProfileDropdown user={user} onLogout={logout} />
            </div>
          </header>

          <Outlet />
        </main>
      </div>
    </div>
  );
}
