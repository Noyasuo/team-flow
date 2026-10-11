import { useMutation, useQuery } from '@apollo/client/react';
import { ArrowLeft, UsersRound } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import {
  ADD_PROJECT_MEMBER,
  PROJECT,
  REMOVE_PROJECT_MEMBER,
  UPDATE_PROJECT_MEMBER_ACCESS,
} from '../../lib/graphql';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

type ProjectResult = {
  project: {
    id: string;
    name: string;
    createdBy: { id: string; name: string };
    members: Array<{ user: { id: string; name: string; email: string }; accessLevel: 'VIEW' | 'EDIT' }>;
    workspace: {
      id: string;
      name: string;
      owner: { id: string };
      members: Array<{ user: { id: string; name: string; email: string }; role: string }>;
    };
  } | null;
};

function normalizeAccessLevel(value?: string | null): 'VIEW' | 'EDIT' {
  return value === 'EDIT' || value === 'MANAGE' ? 'EDIT' : 'VIEW';
}

export function ProjectMembersPage() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedAccess, setSelectedAccess] = useState<'VIEW' | 'EDIT'>('VIEW');
  const { data, loading, refetch } = useQuery<ProjectResult>(PROJECT, {
    skip: !projectId,
    variables: { id: projectId },
  });
  const [addProjectMember, { loading: adding }] = useMutation(ADD_PROJECT_MEMBER);
  const [updateProjectMemberAccess] = useMutation(UPDATE_PROJECT_MEMBER_ACCESS);
  const [removeProjectMember] = useMutation(REMOVE_PROJECT_MEMBER);

  if (!projectId) {
    return <p className="text-sm text-ink/70">Project not found.</p>;
  }

  if (loading) {
    return <p className="text-sm text-ink/70">Loading project members...</p>;
  }

  const project = data?.project;
  if (!project) {
    return <p className="text-sm text-ink/70">Project not found.</p>;
  }

  const isProjectCreator = project.createdBy.id === user?.id;
  const isWorkspaceOwner = project.workspace.owner.id === user?.id;
  const workspaceRole = project.workspace.members.find((member) => member.user.id === user?.id)?.role;
  const currentAccess = project.members.find((member) => member.user.id === user?.id)?.accessLevel;
  const canManageProject =
    isProjectCreator ||
    isWorkspaceOwner ||
    user?.role === 'ADMIN' ||
    ['ADMIN', 'MANAGER'].includes(workspaceRole ?? '') ||
    currentAccess === 'EDIT';
  const availableMembers = project.workspace.members.filter(
    (member) =>
      member.user.id !== project.createdBy.id &&
      !project.members.some((projectMember) => projectMember.user.id === member.user.id)
  );

  async function handleAddMember() {
    if (!selectedMemberId) return;
    try {
      await addProjectMember({
        variables: { input: { projectId, userId: selectedMemberId, accessLevel: selectedAccess } },
      });
      await refetch();
      setSelectedMemberId('');
      showToast('Project member added.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message.replace(/^GraphQL error:\s*/i, '') : 'Unable to add project member.', 'error');
    }
  }

  async function handleAccessChange(userId: string, accessLevel: string) {
    try {
      await updateProjectMemberAccess({ variables: { input: { projectId, userId, accessLevel } } });
      await refetch();
      showToast('Project access updated.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message.replace(/^GraphQL error:\s*/i, '') : 'Unable to update project access.', 'error');
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      await removeProjectMember({ variables: { projectId, userId } });
      await refetch();
      showToast('Project member removed.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message.replace(/^GraphQL error:\s*/i, '') : 'Unable to remove project member.', 'error');
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-ink/10 bg-white p-5 shadow-float">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-3">
        <div>
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-aqua"><UsersRound size={14} /> Project members</p>
          <h2 className="text-2xl font-semibold">{project.name}</h2>
          <p className="text-sm text-ink/60">Manage VIEW or EDIT access for this project.</p>
        </div>
        <Link to={`/projects/${projectId}`} className="inline-flex items-center gap-2 rounded-xl border border-ink/10 px-3 py-2 text-sm hover:bg-ink hover:text-mist">
          <ArrowLeft size={15} /> Back to project
        </Link>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/10 p-3 text-sm">
          <span><strong>{project.createdBy.name}</strong> <span className="text-ink/60">Project creator</span></span>
          <span className="rounded-lg bg-ink/5 px-2 py-1 text-xs">EDIT</span>
        </div>
        {project.members.map((member) => (
          <div key={member.user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/10 p-3 text-sm">
            <span><strong>{member.user.name}</strong> <span className="text-ink/60">{member.user.email}</span></span>
            {canManageProject ? (
              <div className="flex items-center gap-2">
                <select value={normalizeAccessLevel(member.accessLevel)} onChange={(event) => void handleAccessChange(member.user.id, event.target.value)} className="rounded-lg border border-ink/10 bg-white px-2 py-1.5 text-xs"><option value="VIEW">VIEW</option><option value="EDIT">EDIT</option></select>
                <button type="button" onClick={() => void handleRemoveMember(member.user.id)} className="rounded-lg border border-ember/30 px-2 py-1.5 text-xs text-ember">Remove</button>
              </div>
            ) : <span className="rounded-lg bg-ink/5 px-2 py-1 text-xs">{normalizeAccessLevel(member.accessLevel)}</span>}
          </div>
        ))}
      </div>

      {canManageProject && availableMembers.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-t border-ink/10 pt-4">
          <select value={selectedMemberId} onChange={(event) => setSelectedMemberId(event.target.value)} className="rounded-lg border border-ink/10 bg-white px-2 py-2 text-sm"><option value="">Add workspace member...</option>{availableMembers.map((member) => <option key={member.user.id} value={member.user.id}>{member.user.name}</option>)}</select>
          <select value={selectedAccess} onChange={(event) => setSelectedAccess(event.target.value as 'VIEW' | 'EDIT')} className="rounded-lg border border-ink/10 bg-white px-2 py-2 text-sm"><option>VIEW</option><option>EDIT</option></select>
          <button type="button" disabled={adding || !selectedMemberId} onClick={() => void handleAddMember()} className="rounded-lg bg-ink px-3 py-2 text-sm text-mist disabled:opacity-70">{adding ? 'Adding...' : 'Add access'}</button>
        </div>
      ) : null}
    </section>
  );
}
