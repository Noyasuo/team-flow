import { useMutation, useQuery } from '@apollo/client/react';
import { ArrowLeft, Trash2, UserPlus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ADD_WORKSPACE_MEMBER, REMOVE_WORKSPACE_MEMBER, USERS, WORKSPACES } from '../../lib/graphql';
import { useWorkspaceContext } from '../../context/WorkspaceContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

type Workspace = {
  id: string;
  name: string;
  owner: { id: string };
  members: Array<{
    role: 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER';
    user: { id: string; name: string; email: string };
  }>;
};

type UsersResult = {
  users: {
    nodes: Array<{ id: string; name: string; email: string }>;
  };
};

export function WorkspaceMembersPage() {
  const { selectedWorkspaceId } = useWorkspaceContext();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data, loading, refetch } = useQuery<{ workspaces: Workspace[] }>(WORKSPACES);
  const [showAddMember, setShowAddMember] = useState(false);
  const [formError, setFormError] = useState('');
  const [addWorkspaceMember, { loading: addLoading }] = useMutation(ADD_WORKSPACE_MEMBER);
  const [removeWorkspaceMember] = useMutation(REMOVE_WORKSPACE_MEMBER);
  const { data: usersData } = useQuery<UsersResult>(USERS, {
    variables: { page: 1, limit: 200 },
  });

  const activeWorkspace =
    data?.workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? data?.workspaces[0] ?? null;

  const memberOptions = (usersData?.users.nodes ?? []).filter(
    (candidate) => !activeWorkspace?.members.some((member) => member.user.id === candidate.id)
  );

  const canManageMembers = Boolean(
    activeWorkspace &&
      (user?.role === 'ADMIN' ||
        activeWorkspace.owner.id === user?.id ||
        ['ADMIN', 'MANAGER'].includes(
          activeWorkspace.members.find((member) => member.user.id === user?.id)?.role ?? ''
        ))
  );

  async function handleRemoveMember(memberId: string, memberName: string) {
    if (!activeWorkspace || memberId === activeWorkspace.owner.id) return;
    if (!window.confirm(`Remove ${memberName} from ${activeWorkspace.name}?`)) return;

    try {
      await removeWorkspaceMember({
        variables: { workspaceId: activeWorkspace.id, userId: memberId },
      });
      await refetch();
      showToast(`${memberName} was removed from the workspace.`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message.replace(/^GraphQL error:\s*/i, '') : 'Unable to remove member.', 'error');
    }
  }

  async function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeWorkspace) return;

    const userId = String(new FormData(event.currentTarget).get('userId') ?? '');
    if (!userId) {
      setFormError('Select a user to add.');
      return;
    }

    try {
      await addWorkspaceMember({
        variables: {
          input: { workspaceId: activeWorkspace.id, userId, role: 'MEMBER' },
        },
      });
      await refetch();
      setShowAddMember(false);
      setFormError('');
      const addedUser = usersData?.users.nodes.find((candidate) => candidate.id === userId);
      showToast(`${addedUser?.name ?? 'Member'} added to the workspace.`, 'success');
    } catch (error) {
      setFormError(error instanceof Error ? error.message.replace(/^GraphQL error:\s*/i, '') : 'Unable to add member.');
    }
  }

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
        {canManageMembers ? (
          <button
            type="button"
            onClick={() => {
              setFormError('');
              setShowAddMember(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm text-mist"
          >
            <UserPlus size={15} /> Add member
          </button>
        ) : null}
      </div>

      <div className="space-y-3">
        {activeWorkspace.members.map((member) => (
          <div key={member.user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/10 p-3">
            <div>
              <p className="font-medium">{member.user.name}</p>
              <p className="text-sm text-ink/60">{member.user.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-ink/5 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-ink/80">
                {accessLabel(member.role)}
              </span>
              {canManageMembers && member.user.id !== activeWorkspace.owner.id ? (
                <button
                  type="button"
                  onClick={() => void handleRemoveMember(member.user.id, member.user.name)}
                  title="Remove member"
                  aria-label={`Remove ${member.user.name}`}
                  className="rounded-lg border border-ember/30 p-2 text-ember hover:bg-ember/10"
                >
                  <Trash2 size={14} />
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {showAddMember ? (
        <div className="fixed inset-0 z-20 grid place-items-center bg-ink/30 p-4">
          <form onSubmit={handleAddMember} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-float">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Add member</h2>
              <button type="button" onClick={() => setShowAddMember(false)} title="Close" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            {formError ? <p className="rounded-lg bg-ember/10 px-3 py-2 text-sm text-ember">{formError}</p> : null}
            <label className="block">
              <span className="mb-1 block text-sm font-medium">User</span>
              <select name="userId" required defaultValue="" className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm outline-none focus:border-aqua">
                <option value="" disabled>Select a user</option>
                {memberOptions.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.email}</option>)}
              </select>
            </label>
            {memberOptions.length === 0 ? <p className="text-xs text-ink/50">Every active user is already a member of this workspace.</p> : null}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAddMember(false)} className="rounded-xl border border-ink/10 px-4 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={addLoading || memberOptions.length === 0} className="rounded-xl bg-ink px-4 py-2 text-sm text-mist disabled:opacity-70">
                {addLoading ? 'Adding...' : 'Add member'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
