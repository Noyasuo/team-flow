import { useMutation, useQuery } from '@apollo/client/react';
import { LayoutDashboard, LogOut, Plus, ShieldCheck, Users, Workflow, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  ADMIN_OPERATIONS,
  ADMIN_STATS,
  CREATE_ADMIN_USER,
  SET_ADMIN_TASK_STATUS,
  SET_USER_ACTIVE,
} from '../../lib/graphql';

type AdminStats = {
  totalUsers: number;
  activeUsers: number;
  totalWorkspaces: number;
  totalProjects: number;
  totalTasks: number;
  openTasks: number;
  completedTasks: number;
};

type OperationsResult = {
  adminUsers: Array<{
    id: string;
    username?: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
  }>;
  adminWorkspaces: Array<{
    id: string;
    name: string;
    owner: { name: string; email: string };
    members: Array<{ user: { id: string }; role: string }>;
    createdAt: string;
  }>;
  adminProjects: Array<{
    id: string;
    name: string;
    status: string;
    workspace: { name: string };
    createdBy: { name: string };
  }>;
  adminTasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    project: { name: string };
    assignee?: { name: string };
  }>;
};

const tabs = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'workspaces', label: 'Workspaces', icon: Workflow },
  { key: 'projects', label: 'Projects', icon: Workflow },
  { key: 'tasks', label: 'Tasks', icon: Workflow },
] as const;
type Tab = (typeof tabs)[number]['key'];

export function AdminDashboardPage() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [showCreateUser, setShowCreateUser] = useState(false);
  const { data: statsData, loading: statsLoading } = useQuery<{ adminStats: AdminStats }>(ADMIN_STATS);
  const { data, loading, error, refetch } = useQuery<OperationsResult>(ADMIN_OPERATIONS);
  const [setActive] = useMutation(SET_USER_ACTIVE);
  const [setTaskStatus] = useMutation(SET_ADMIN_TASK_STATUS);
  const [createUser] = useMutation(CREATE_ADMIN_USER);
  const stats = statsData?.adminStats;

  async function toggleUser(id: string, isActive: boolean) {
    await setActive({ variables: { userId: id, isActive: !isActive } });
    await refetch();
  }

  async function updateTask(id: string, status: string) {
    await setTaskStatus({ variables: { taskId: id, status } });
    await refetch();
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await createUser({ variables: { input: Object.fromEntries(form.entries()) } });
    setShowCreateUser(false);
    await refetch();
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,#dceef0,#f5f1e8_55%,#e7eef0)] p-4 text-ink md:p-8">
      <main className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/80 bg-white/85 p-5 shadow-float backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-ink p-2 text-mist"><ShieldCheck size={20} /></div>
            <div><p className="text-xs uppercase tracking-[0.25em] text-aqua">TeamFlow control center</p><h1 className="text-2xl font-semibold">Admin dashboard</h1></div>
          </div>
          <div className="flex items-center gap-3 text-sm"><span className="text-ink/60">{user?.username ?? user?.email}</span><button type="button" onClick={logout} className="inline-flex items-center gap-2 rounded-lg border border-ink/10 px-3 py-2 hover:bg-ink hover:text-mist"><LogOut size={15} /> Log out</button></div>
        </header>

        <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-white/80 bg-white/70 p-2 shadow-float">
          {tabs.map(({ key, label, icon: Icon }) => <button key={key} type="button" onClick={() => setTab(key)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm ${tab === key ? 'bg-ink text-mist' : 'text-ink/70 hover:bg-white'}`}><Icon size={15} />{label}</button>)}
        </nav>

        {statsLoading || loading ? <p className="text-sm text-ink/70">Loading system data...</p> : null}
        {error ? <p className="rounded-xl bg-ember/10 px-4 py-3 text-sm text-ember">{error.message}</p> : null}
        {tab === 'overview' && stats ? <Overview stats={stats} onCreateUser={() => { setTab('users'); setShowCreateUser(true); }} /> : null}
        {tab === 'users' && data ? <UsersPanel users={data.adminUsers} onCreate={() => setShowCreateUser(true)} onToggle={toggleUser} /> : null}
        {tab === 'workspaces' && data ? <ResourceTable title="Workspace directory" columns={['Workspace', 'Owner', 'Members', 'Created']} rows={data.adminWorkspaces.map((item) => [item.name, item.owner.name, item.members.length, new Date(item.createdAt).toLocaleDateString()])} /> : null}
        {tab === 'projects' && data ? <ResourceTable title="Project directory" columns={['Project', 'Workspace', 'Owner', 'Status']} rows={data.adminProjects.map((item) => [item.name, item.workspace.name, item.createdBy.name, item.status])} /> : null}
        {tab === 'tasks' && data ? <TasksPanel tasks={data.adminTasks} onStatusChange={updateTask} /> : null}
        {showCreateUser ? <CreateUserModal onClose={() => setShowCreateUser(false)} onSubmit={handleCreateUser} /> : null}
      </main>
    </div>
  );
}

function Overview({ stats, onCreateUser }: { stats: AdminStats; onCreateUser: () => void }) {
  const metrics = [['Users', stats.totalUsers, `${stats.activeUsers} active`], ['Workspaces', stats.totalWorkspaces, 'System-wide'], ['Projects', stats.totalProjects, 'Across workspaces'], ['Tasks', stats.totalTasks, `${stats.openTasks} open`]] as const;
  const completion = stats.totalTasks ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0;
  const active = stats.totalUsers ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0;
  return <>
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{metrics.map(([label, value, note]) => <article key={label} className="rounded-2xl border border-white/80 bg-white/85 p-5 shadow-float"><p className="text-sm text-ink/60">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p><p className="mt-1 text-xs text-ink/50">{note}</p></article>)}</section>
    <section className="grid gap-5 lg:grid-cols-2"><article className="rounded-2xl border border-white/80 bg-white/85 p-5 shadow-float"><h2 className="text-lg font-semibold">System health</h2><Progress label="Active users" value={active} detail={`${stats.activeUsers} / ${stats.totalUsers}`} /><Progress label="Task completion" value={completion} detail={`${stats.completedTasks} / ${stats.totalTasks}`} /></article><article className="rounded-2xl border border-white/80 bg-white/85 p-5 shadow-float"><h2 className="text-lg font-semibold">Quick actions</h2><p className="mt-1 text-sm text-ink/60">Common system operations.</p><button type="button" onClick={onCreateUser} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm text-mist"><Plus size={15} /> Create user</button></article></section>
  </>;
}

function Progress({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className="mt-4 space-y-2 text-sm"><div className="flex justify-between"><span>{label}</span><strong>{detail}</strong></div><div className="h-2 rounded-full bg-ink/10"><div className="h-2 rounded-full bg-aqua" style={{ width: `${value}%` }} /></div></div>;
}

function UsersPanel({ users, onCreate, onToggle }: { users: OperationsResult['adminUsers']; onCreate: () => void; onToggle: (id: string, isActive: boolean) => void }) {
  return <section className="rounded-2xl border border-white/80 bg-white/85 p-5 shadow-float"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">User directory</h2><p className="text-sm text-ink/60">Manage account access across TeamFlow.</p></div><button type="button" onClick={onCreate} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm text-mist"><Plus size={15} /> Create user</button></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-ink/10 text-xs uppercase text-ink/50"><tr><th className="p-3">User</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead><tbody>{users.map((item) => <tr key={item.id} className="border-b border-ink/5"><td className="p-3"><strong>{item.name}</strong><p className="text-xs text-ink/50">@{item.username ?? 'unassigned'} · {item.email}</p></td><td className="p-3">{item.role}</td><td className="p-3">{item.isActive ? 'Active' : 'Disabled'}</td><td className="p-3"><button type="button" onClick={() => void onToggle(item.id, item.isActive)} className="rounded-lg border border-ink/10 px-3 py-1.5 text-xs">{item.isActive ? 'Disable' : 'Enable'}</button></td></tr>)}</tbody></table></div></section>;
}

function TasksPanel({ tasks, onStatusChange }: { tasks: OperationsResult['adminTasks']; onStatusChange: (id: string, status: string) => void }) {
  return <section className="rounded-2xl border border-white/80 bg-white/85 p-5 shadow-float"><h2 className="mb-4 text-lg font-semibold">Task operations</h2><div className="space-y-2">{tasks.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/10 p-3"><div><strong>{item.title}</strong><p className="text-xs text-ink/50">{item.project.name} · {item.priority} · {item.assignee?.name ?? 'Unassigned'}</p></div><select value={item.status} onChange={(event) => onStatusChange(item.id, event.target.value)} className="rounded-lg border border-ink/10 bg-white px-2 py-1.5 text-xs"><option>TODO</option><option>IN_PROGRESS</option><option>REVIEW</option><option>DONE</option></select></div>)}</div></section>;
}

function CreateUserModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const fields = [['username', 'Username'], ['name', 'Full name'], ['email', 'Email'], ['title', 'Title'], ['password', 'Temporary password']];
  return <div className="fixed inset-0 z-20 grid place-items-center bg-ink/30 p-4"><form onSubmit={onSubmit} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-float"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Create user</h2><button type="button" onClick={onClose} title="Close"><X size={18} /></button></div><div className="grid gap-3 sm:grid-cols-2">{fields.map(([name, label]) => <label key={name} className="block"><span className="mb-1 block text-sm font-medium">{label}</span><input name={name} type={name === 'password' ? 'password' : name === 'email' ? 'email' : 'text'} required={name !== 'title'} minLength={name === 'password' ? 8 : undefined} className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm" /></label>)}<label className="block"><span className="mb-1 block text-sm font-medium">Role</span><select name="role" defaultValue="MEMBER" className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm"><option>MEMBER</option><option>MANAGER</option><option>ADMIN</option><option>VIEWER</option></select></label></div><button type="submit" className="rounded-xl bg-ink px-4 py-2 text-sm text-mist">Create account</button></form></div>;
}

function ResourceTable({ title, columns, rows }: { title: string; columns: string[]; rows: Array<Array<string | number>> }) {
  return <section className="rounded-2xl border border-white/80 bg-white/85 p-5 shadow-float"><h2 className="mb-4 text-lg font-semibold">{title}</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-ink/10 text-xs uppercase text-ink/50"><tr>{columns.map((column) => <th key={column} className="p-3">{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-b border-ink/5">{row.map((value, cellIndex) => <td key={cellIndex} className="p-3">{value}</td>)}</tr>)}</tbody></table></div></section>;
}
