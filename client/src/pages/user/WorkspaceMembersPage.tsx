import { useQuery } from '@apollo/client/react';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { WORKSPACES } from '../../lib/graphql';
import { useWorkspaceContext } from '../../context/WorkspaceContext';

type Workspace = {
  id: string;
  name: string;
  owner: { id: string };
  members: Array<{
    role: 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER';
    user: { id: string; name: string; email: string };
  }>;
};

export function WorkspaceMembersPage() {
  const { selectedWorkspaceId } = useWorkspaceContext();
  const { data, loading } = useQuery<{ workspaces: Workspace[] }>(WORKSPACES);

  const activeWorkspace =
    data?.workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? data?.workspaces[0] ?? null;

  function accessLabel(role: Workspace['members'][number]['role']) {
    return ['ADMIN', 'MANAGER', 'MEMBER'].includes(role) ? 'EDIT' : 'VIEW';
  }

  if (loading) {
    return <p className="text-sm text-ink/70">Loading workspace members...</p>;
  }

  if (!activeWorkspace) {
    return (
      <section className="space-y-3 rounded-2xl border border-ink/10 bg-white p-5">
        <h2 className="text-2xl font-semibold">Workspace members</h2>
        <p className="text-sm text-ink/70">No workspace selected.</p>
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-ink hover:underline">
          <ArrowLeft size={15} /> Back to dashboard
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-ink/10 bg-white p-5 shadow-float">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-aqua">Workspace</p>
          <h2 className="text-2xl font-semibold">{activeWorkspace.name}</h2>
        </div>
        <Link to="/" className="inline-flex items-center gap-2 rounded-xl border border-ink/10 px-3 py-2 text-sm hover:bg-ink hover:text-mist">
          <ArrowLeft size={15} /> Back to dashboard
        </Link>
      </div>

      <div className="flex items-center justify-between gap-3 border-b border-ink/10 pb-3">
        <div>
          <h3 className="text-xl font-semibold">Members</h3>
          <p className="text-sm text-ink/60">Manage access for this workspace.</p>
        </div>
        <button type="button" className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm text-mist">
          <UserPlus size={15} /> Add member
        </button>
      </div>

      <div className="space-y-3">
        {activeWorkspace.members.map((member) => (
          <div key={member.user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/10 p-3">
            <div>
              <p className="font-medium">{member.user.name}</p>
              <p className="text-sm text-ink/60">{member.user.email}</p>
            </div>
            <span className="rounded-full bg-ink/5 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-ink/80">
              {accessLabel(member.role)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
