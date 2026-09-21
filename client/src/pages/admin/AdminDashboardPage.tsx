import { useQuery } from '@apollo/client/react';
import { LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ADMIN_STATS } from '../../lib/graphql';

type AdminStatsResult = {
  adminStats: {
    totalUsers: number;
    activeUsers: number;
    totalWorkspaces: number;
    totalProjects: number;
    totalTasks: number;
    openTasks: number;
    completedTasks: number;
  };
};

const metrics = [
  ['totalUsers', 'Users'],
  ['activeUsers', 'Active users'],
  ['totalWorkspaces', 'Workspaces'],
  ['totalProjects', 'Projects'],
  ['totalTasks', 'Tasks'],
  ['openTasks', 'Open tasks'],
  ['completedTasks', 'Completed tasks'],
] as const;

export function AdminDashboardPage() {
  const { user, logout } = useAuth();
  const { data, loading, error } = useQuery<AdminStatsResult>(ADMIN_STATS);
  const stats = data?.adminStats;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,#dceef0,#f5f1e8_55%,#e7eef0)] p-4 text-ink md:p-8">
      <main className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/80 bg-white/80 p-5 shadow-float backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-ink p-2 text-mist"><ShieldCheck size={20} /></div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-aqua">TeamFlow</p>
              <h1 className="text-2xl font-semibold">Admin dashboard</h1>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-ink/60">{user?.email}</span>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-lg border border-ink/10 px-3 py-2 hover:bg-ink hover:text-mist"
            >
              <LogOut size={15} /> Log out
            </button>
          </div>
        </header>

        {loading ? <p className="text-sm text-ink/70">Loading admin metrics...</p> : null}
        {error ? <p className="rounded-xl bg-ember/10 px-4 py-3 text-sm text-ember">{error.message}</p> : null}
        {stats ? (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map(([key, label]) => (
              <article key={key} className="rounded-2xl border border-white/80 bg-white/85 p-5 shadow-float">
                <p className="text-sm text-ink/60">{label}</p>
                <p className="mt-2 text-3xl font-semibold">{stats[key]}</p>
              </article>
            ))}
          </section>
        ) : null}
      </main>
    </div>
  );
}