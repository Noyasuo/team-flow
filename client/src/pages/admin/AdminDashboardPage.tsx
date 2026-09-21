import { useMutation, useQuery } from '@apollo/client/react';
import { LayoutDashboard, LogOut, Plus, ShieldCheck, Users, Workflow, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  ADMIN_OPERATIONS,
  ADMIN_STATS,
  CHANGE_ADMIN_USER_PASSWORD,
  CREATE_ADMIN_USER,
  RESET_ADMIN_USER_PASSWORD,
  SET_ADMIN_TASK_STATUS,
  SET_USER_ACTIVE,
  UPDATE_ADMIN_USER,
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
    title?: string;
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
  const [editingUser, setEditingUser] = useState<OperationsResult['adminUsers'][number] | null>(null);
  const [userFormError, setUserFormError] = useState('');
  const { data: statsData, loading: statsLoading } = useQuery<{ adminStats: AdminStats }>(ADMIN_STATS);
  const { data, loading, error, refetch } = useQuery<OperationsResult>(ADMIN_OPERATIONS);
  const [setActive] = useMutation(SET_USER_ACTIVE);
  const [setTaskStatus] = useMutation(SET_ADMIN_TASK_STATUS);
  const [createUser] = useMutation(CREATE_ADMIN_USER);
  const [updateUser] = useMutation(UPDATE_ADMIN_USER);
  const [resetPassword] = useMutation(RESET_ADMIN_USER_PASSWORD);
  const [changePassword] = useMutation(CHANGE_ADMIN_USER_PASSWORD);
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
    setUserFormError('');
    const form = new FormData(event.currentTarget);
    try {
      await createUser({ variables: { input: Object.fromEntries(form.entries()) } });
      setShowCreateUser(false);
      await refetch();
    } catch (createError) {
      setUserFormError(getGraphqlErrorMessage(createError));
    }
  }

  async function handleUpdateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingUser) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    const passwordConfirmation = String(form.get('passwordConfirmation') ?? '');
    if (password !== passwordConfirmation) {
      window.alert('New password and confirmation must match.');
      return;
    }
    try {
      await updateUser({
        variables: {
          input: {
            id: editingUser.id,
            username: form.get('username'),
            name: form.get('name'),
            email: form.get('email'),
            title: form.get('title'),
            password: password || undefined,
            isActive: form.get('isActive') === 'true',
            role: form.get('role'),
          },
        },
      });
      setEditingUser(null);
      await refetch();
    } catch (updateError) {
      setUserFormError(getGraphqlErrorMessage(updateError));
    }
  }

  async function handleResetPassword() {
    if (!editingUser) return;
    await resetPassword({ variables: { userId: editingUser.id } });
  }

  async function handleChangePassword(password: string) {
    if (!editingUser) return;
    await changePassword({ variables: { userId: editingUser.id, password } });
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
        {tab === 'users' && data ? <UsersPanel users={data.adminUsers} onCreate={() => setShowCreateUser(true)} onEdit={setEditingUser} onToggle={toggleUser} /> : null}
        {tab === 'workspaces' && data ? <ResourceTable title="Workspace directory" columns={['Workspace', 'Owner', 'Members', 'Created']} rows={data.adminWorkspaces.map((item) => [item.name, item.owner.name, item.members.length, new Date(item.createdAt).toLocaleDateString()])} /> : null}
        {tab === 'projects' && data ? <ResourceTable title="Project directory" columns={['Project', 'Workspace', 'Owner', 'Status']} rows={data.adminProjects.map((item) => [item.name, item.workspace.name, item.createdBy.name, item.status])} /> : null}
        {tab === 'tasks' && data ? <TasksPanel tasks={data.adminTasks} onStatusChange={updateTask} /> : null}
        {showCreateUser ? <CreateUserModal error={userFormError} onClose={() => { setUserFormError(''); setShowCreateUser(false); }} onSubmit={handleCreateUser} /> : null}
        {editingUser ? <EditUserModal serverError={userFormError} user={editingUser} onClose={() => { setUserFormError(''); setEditingUser(null); }} onSubmit={handleUpdateUser} onResetPassword={handleResetPassword} onChangePassword={handleChangePassword} /> : null}
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

function UsersPanel({ users, onCreate, onEdit, onToggle }: { users: OperationsResult['adminUsers']; onCreate: () => void; onEdit: (user: OperationsResult['adminUsers'][number]) => void; onToggle: (id: string, isActive: boolean) => void }) {
  return <section className="rounded-2xl border border-white/80 bg-white/85 p-5 shadow-float"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">User directory</h2><p className="text-sm text-ink/60">Manage account roles and access across TeamFlow.</p></div><button type="button" onClick={onCreate} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm text-mist"><Plus size={15} /> Create user</button></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-ink/10 text-xs uppercase text-ink/50"><tr><th className="p-3">User</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead><tbody>{users.map((item) => <tr key={item.id} className="border-b border-ink/5"><td className="p-3"><strong>{item.name}</strong><p className="text-xs text-ink/50">@{item.username ?? 'unassigned'} · {item.email}</p></td><td className="p-3">{item.role}</td><td className="p-3">{item.isActive ? 'Active' : 'Disabled'}</td><td className="p-3"><div className="flex gap-2"><button type="button" onClick={() => onEdit(item)} className="rounded-lg bg-ink px-3 py-1.5 text-xs text-mist">Edit</button><button type="button" onClick={() => void onToggle(item.id, item.isActive)} className="rounded-lg border border-ink/10 px-3 py-1.5 text-xs">{item.isActive ? 'Disable' : 'Enable'}</button></div></td></tr>)}</tbody></table></div></section>;
}

function TasksPanel({ tasks, onStatusChange }: { tasks: OperationsResult['adminTasks']; onStatusChange: (id: string, status: string) => void }) {
  return <section className="rounded-2xl border border-white/80 bg-white/85 p-5 shadow-float"><h2 className="mb-4 text-lg font-semibold">Task operations</h2><div className="space-y-2">{tasks.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/10 p-3"><div><strong>{item.title}</strong><p className="text-xs text-ink/50">{item.project.name} · {item.priority} · {item.assignee?.name ?? 'Unassigned'}</p></div><select value={item.status} onChange={(event) => onStatusChange(item.id, event.target.value)} className="rounded-lg border border-ink/10 bg-white px-2 py-1.5 text-xs"><option>TODO</option><option>IN_PROGRESS</option><option>REVIEW</option><option>DONE</option></select></div>)}</div></section>;
}

function getGraphqlErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '');
    return message.replace(/^GraphQL error:\s*/i, '') || 'Unable to save user.';
  }
  return 'Unable to save user.';
}

function CreateUserModal({ error, onClose, onSubmit }: { error: string; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const fields = [['username', 'Username'], ['name', 'Full name'], ['email', 'Email'], ['title', 'Title'], ['password', 'Temporary password']];
  return <div className="fixed inset-0 z-20 grid place-items-center bg-ink/30 p-4"><form onSubmit={onSubmit} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-float"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Create user</h2><button type="button" onClick={onClose} title="Close"><X size={18} /></button></div>{error ? <p className="rounded-lg bg-ember/10 px-3 py-2 text-sm text-ember">{error}</p> : null}<div className="grid gap-3 sm:grid-cols-2">{fields.map(([name, label]) => <label key={name} className="block"><span className="mb-1 block text-sm font-medium">{label}</span><input name={name} type={name === 'password' ? 'password' : name === 'email' ? 'email' : 'text'} required={name !== 'title'} minLength={name === 'password' ? 8 : undefined} className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm" /></label>)}<label className="block"><span className="mb-1 block text-sm font-medium">Role</span><select name="role" defaultValue="MEMBER" className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm"><option>MEMBER</option><option>MANAGER</option><option>ADMIN</option><option>VIEWER</option></select></label></div><button type="submit" className="rounded-xl bg-ink px-4 py-2 text-sm text-mist">Create account</button></form></div>;
}

function EditUserModal({ serverError, user, onClose, onSubmit, onResetPassword, onChangePassword }: { serverError: string; user: OperationsResult['adminUsers'][number]; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onResetPassword: () => void; onChangePassword: (password: string) => Promise<void> }) {
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');

  async function submitPasswordChange() {
    setMessage('');
    setError('');
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmation) {
      setError('New password and confirmation must match.');
      return;
    }
    try {
      await onChangePassword(newPassword);
      setNewPassword('');
      setConfirmation('');
      setShowPasswordChange(false);
      setMessage('Password changed successfully.');
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : 'Unable to change password.');
    }
  }

  async function confirmReset() {
    try {
      await onResetPassword();
      setShowResetConfirm(false);
      setMessage('Password reset to 12345678.');
    } catch (resetError) {
      setShowResetConfirm(false);
      setError(resetError instanceof Error ? resetError.message : 'Unable to reset password.');
    }
  }

  return <div className="fixed inset-0 z-20 grid place-items-center bg-ink/30 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-float"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Edit user</h2><button type="button" onClick={onClose} title="Close"><X size={18} /></button></div>{serverError ? <p className="mt-3 rounded-lg bg-ember/10 px-3 py-2 text-sm text-ember">{serverError}</p> : null}{message ? <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}{error ? <p className="mt-3 rounded-lg bg-ember/10 px-3 py-2 text-sm text-ember">{error}</p> : null}<form onSubmit={onSubmit} className="mt-4 space-y-4"><div className="grid gap-3 sm:grid-cols-2"><Field name="username" label="Username" value={user.username ?? ''} /><Field name="name" label="Full name" value={user.name} /><Field name="email" label="Email" type="email" value={user.email} /><Field name="title" label="Title" value={user.title ?? ''} /><label className="block"><span className="mb-1 block text-sm font-medium">Role</span><select name="role" defaultValue={user.role} className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm"><option>MEMBER</option><option>MANAGER</option><option>ADMIN</option><option>VIEWER</option></select></label><label className="block"><span className="mb-1 block text-sm font-medium">Status</span><select name="isActive" defaultValue={String(user.isActive)} className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm"><option value="true">Active</option><option value="false">Disabled</option></select></label></div><div className="flex flex-wrap gap-2 border-t border-ink/10 pt-4"><button type="button" onClick={() => { setError(''); setShowResetConfirm(true); }} className="rounded-xl border border-ember/30 px-3 py-2 text-sm text-ember">Reset password</button><button type="button" onClick={() => { setError(''); setShowPasswordChange((current) => !current); }} className="rounded-xl border border-ink/10 px-3 py-2 text-sm">{showPasswordChange ? 'Hide change password' : 'Change password'}</button></div>{showPasswordChange ? <div className="grid gap-3 rounded-xl bg-ink/5 p-3 sm:grid-cols-2"><Field name="newPassword" label="New password" type="password" value={newPassword} onChange={setNewPassword} minLength={8} /><Field name="passwordConfirmation" label="Confirm password" type="password" value={confirmation} onChange={setConfirmation} minLength={8} /><button type="button" onClick={() => void submitPasswordChange()} className="rounded-xl bg-ink px-4 py-2 text-sm text-mist sm:col-span-2">Save password</button></div> : null}<p className="text-xs text-ink/50">Reset sets the password to the default 12345678.</p><div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-ink/10 px-4 py-2 text-sm">Cancel</button><button type="submit" className="rounded-xl bg-ink px-4 py-2 text-sm text-mist">Save changes</button></div></form>{showResetConfirm ? <div className="fixed inset-0 z-30 grid place-items-center bg-ink/40 p-4"><div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-float"><h3 className="text-lg font-semibold">Reset password?</h3><p className="mt-2 text-sm text-ink/70">Set {user.name}'s password to the default 12345678?</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setShowResetConfirm(false)} className="rounded-xl border border-ink/10 px-4 py-2 text-sm">Cancel</button><button type="button" onClick={() => void confirmReset()} className="rounded-xl bg-ember px-4 py-2 text-sm text-white">Reset password</button></div></div></div> : null}</div></div>;
}

function Field({ name, label, value, type = 'text', minLength, onChange }: { name: string; label: string; value: string; type?: string; minLength?: number; onChange?: (value: string) => void }) {
  return <label className="block"><span className="mb-1 block text-sm font-medium">{label}</span><input name={name} type={type} defaultValue={onChange ? undefined : value} value={onChange ? value : undefined} onChange={onChange ? (event) => onChange(event.target.value) : undefined} required={!['title', 'password', 'passwordConfirmation', 'newPassword'].includes(name)} minLength={minLength} autoCapitalize={name === 'username' ? 'none' : undefined} autoCorrect={name === 'username' ? 'off' : undefined} spellCheck={name === 'username' ? false : undefined} className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm" /></label>;
}

function ResourceTable({ title, columns, rows }: { title: string; columns: string[]; rows: Array<Array<string | number>> }) {
  return <section className="rounded-2xl border border-white/80 bg-white/85 p-5 shadow-float"><h2 className="mb-4 text-lg font-semibold">{title}</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-ink/10 text-xs uppercase text-ink/50"><tr>{columns.map((column) => <th key={column} className="p-3">{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-b border-ink/5">{row.map((value, cellIndex) => <td key={cellIndex} className="p-3">{value}</td>)}</tr>)}</tbody></table></div></section>;
}
