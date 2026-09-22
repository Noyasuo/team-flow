import { useMutation, useQuery, useSubscription } from '@apollo/client/react';
import React from 'react';
import dayjs from 'dayjs';
import { Users, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ADD_WORKSPACE_MEMBER,
  CREATE_PROJECT,
  CREATE_WORKSPACE,
  DASHBOARD,
  PROJECTS,
  USERS,
  WORKSPACE_UPDATED_SUBSCRIPTION,
  WORKSPACES,
} from '../../lib/graphql';
import { useWorkspaceContext } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { CreateProjectModal } from '../../components/CreateProjectModal';

type Workspace = {
  id: string;
  name: string;
  description?: string;
  owner: {
    id: string;
  };
  members: Array<{
    role: 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER';
    user: {
      id: string;
      name: string;
      email: string;
    };
  }>;
};

type WorkspacesResult = {
  workspaces: Workspace[];
};

type CreateWorkspaceResult = {
  createWorkspace: {
    id: string;
    name: string;
  };
};

type DashboardResult = {
  dashboard: {
    totalProjects: number;
    totalTasks: number;
    overdueTasks: number;
    completedTasksThisWeek: number;
    tasksByStatus: Array<{ key: string; count: number }>;
    tasksByPriority: Array<{ key: string; count: number }>;
  };
};

type ProjectsResult = {
  projects: {
    nodes: Array<{ id: string; name: string; status: string; dueDate?: string | null }>;
  };
};

type UsersResult = {
  users: {
    nodes: Array<{ id: string; name: string; email: string }>;
  };
};

type AddWorkspaceMemberResult = {
  addWorkspaceMember: {
    id: string;
  };
};

const metricLabels = [
  { key: 'totalProjects', label: 'Projects' },
  { key: 'totalTasks', label: 'Tasks' },
  { key: 'overdueTasks', label: 'Overdue' },
  { key: 'completedTasksThisWeek', label: 'Done (7d)' },
] as const;

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { selectedWorkspaceId, setSelectedWorkspaceId } = useWorkspaceContext();
  const { data: workspaceData, loading: workspacesLoading, refetch } =
    useQuery<WorkspacesResult>(WORKSPACES);
  const [createWorkspace, { loading: createWorkspaceLoading }] =
    useMutation<CreateWorkspaceResult>(CREATE_WORKSPACE);
  const [createProject, { loading: createProjectLoading }] = useMutation(CREATE_PROJECT);
  const [addWorkspaceMember, { loading: addWorkspaceMemberLoading }] =
    useMutation<AddWorkspaceMemberResult>(ADD_WORKSPACE_MEMBER);
  const [showCreateWorkspace, setShowCreateWorkspace] = React.useState(false);
  const [workspaceFormError, setWorkspaceFormError] = React.useState('');
  const [showCreateProject, setShowCreateProject] = React.useState(false);
  const [projectFormError, setProjectFormError] = React.useState('');
  const [showAddMember, setShowAddMember] = React.useState(false);
  const [addMemberFormError, setAddMemberFormError] = React.useState('');

  // Use selected workspace or fall back to first
  const activeWorkspace = workspaceData?.workspaces?.find((w) => w.id === selectedWorkspaceId) ??
                         workspaceData?.workspaces?.[0] ?? null;

  const activeWorkspaceRole =
    activeWorkspace?.members.find((member) => member.user.id === user?.id)?.role ?? null;
  const isWorkspaceCreator =
    Boolean(activeWorkspace?.owner?.id) && activeWorkspace?.owner.id === user?.id;
  const accountRole = user?.role ?? 'MEMBER';
  const canCreateWorkspace = ['ADMIN', 'MANAGER'].includes(accountRole);
  const canCreateProject = activeWorkspaceRole ? ['ADMIN', 'MANAGER'].includes(activeWorkspaceRole) : false;
  const canManageMembers = Boolean(activeWorkspace) && isWorkspaceCreator;
  const { data: usersData, refetch: refetchUsers } = useQuery<UsersResult>(USERS, {
    skip: !canManageMembers,
    variables: { page: 1, limit: 200 },
  });
  const memberOptions = (usersData?.users.nodes ?? []).filter(
    (candidate) => !activeWorkspace?.members.some((member) => member.user.id === candidate.id)
  );

  // Live updates: membership/role changes on the active workspace refresh this page automatically.
  useSubscription(WORKSPACE_UPDATED_SUBSCRIPTION, {
    variables: { workspaceId: activeWorkspace?.id },
    skip: !activeWorkspace,
    onData: () => void refetch(),
  });

  // Sync selected workspace when first workspace loads
  React.useEffect(() => {
    if (activeWorkspace && !selectedWorkspaceId) {
      setSelectedWorkspaceId(activeWorkspace.id);
    }
  }, [activeWorkspace, selectedWorkspaceId, setSelectedWorkspaceId]);

  const {
    data: dashboardData,
    loading: dashboardLoading,
    refetch: refetchDashboard,
  } = useQuery<DashboardResult>(DASHBOARD, {
    skip: !activeWorkspace,
    variables: { workspaceId: activeWorkspace?.id },
  });

  const {
    data: projectsData,
    loading: projectsLoading,
    refetch: refetchProjects,
  } = useQuery<ProjectsResult>(PROJECTS, {
    skip: !activeWorkspace,
    variables: { workspaceId: activeWorkspace?.id, page: 1, limit: 8 },
  });

  function openCreateWorkspaceModal() {
    if (!canCreateWorkspace) {
      showToast('Only ADMIN or MANAGER accounts can create workspaces.', 'error');
      return;
    }

    setWorkspaceFormError('');
    setShowCreateWorkspace(true);
  }

  async function handleCreateWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorkspaceFormError('');

    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const description = String(form.get('description') ?? '').trim();

    if (name.length < 2) {
      setWorkspaceFormError('Workspace name must be at least 2 characters.');
      return;
    }

    try {
      const result = await createWorkspace({
        variables: {
          input: {
            name,
            description: description || 'Your default TeamFlow workspace',
          },
        },
      });

      await refetch();

      // Switch to newly created workspace
      if (result.data?.createWorkspace?.id) {
        setSelectedWorkspaceId(result.data.createWorkspace.id);
      }

      setShowCreateWorkspace(false);
    } catch (createError) {
      setWorkspaceFormError(
        createError instanceof Error
          ? createError.message.replace(/^GraphQL error:\s*/i, '')
          : 'Unable to create workspace.'
      );
    }
  }

  function openCreateProjectModal() {
    if (!activeWorkspace) {
      return;
    }

    if (!canCreateProject) {
      showToast('You do not have permission to create projects in this workspace.', 'error');
      return;
    }

    setProjectFormError('');
    setShowCreateProject(true);
  }

  function openMembersSection() {
    navigate('/workspace-members');
  }

  async function handleCreateProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeWorkspace) {
      return;
    }

    setProjectFormError('');
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const description = String(form.get('description') ?? '').trim();

    if (name.length < 2) {
      setProjectFormError('Project name must be at least 2 characters.');
      return;
    }

    try {
      await createProject({
        variables: {
          input: {
            workspaceId: activeWorkspace.id,
            name,
            description,
            status: 'ACTIVE',
          },
        },
      });

      await Promise.all([refetch(), refetchDashboard(), refetchProjects()]);
      setShowCreateProject(false);
    } catch (createError) {
      setProjectFormError(
        createError instanceof Error
          ? createError.message.replace(/^GraphQL error:\s*/i, '')
          : 'Unable to create project.'
      );
    }
  }

  async function handleAddWorkspaceMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeWorkspace) {
      return;
    }

    setAddMemberFormError('');
    const form = new FormData(event.currentTarget);
    const userId = String(form.get('userId') ?? '');
    const role = 'MEMBER' as 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER';
    const targetUser = (usersData?.users.nodes ?? []).find((candidate) => candidate.id === userId);

    if (!targetUser) {
      setAddMemberFormError('Select a user to add.');
      return;
    }

    try {
      await addWorkspaceMember({
        variables: {
          input: {
            workspaceId: activeWorkspace.id,
            userId: targetUser.id,
            role,
          },
        },
      });

      await Promise.all([refetch(), refetchUsers()]);
      setShowAddMember(false);
      showToast(`${targetUser.name} added as ${role}.`, 'success');
    } catch (addError) {
      setAddMemberFormError(
        addError instanceof Error
          ? addError.message.replace(/^GraphQL error:\s*/i, '')
          : 'Unable to add member.'
      );
    }
  }

  if (workspacesLoading) {
    return <p className="text-sm text-ink/70">Loading workspaces...</p>;
  }

  if (!activeWorkspace) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">No workspace yet</h2>
        <p className="text-sm text-ink/70">
          {canCreateWorkspace
            ? 'Create your first workspace to unlock analytics, projects, and kanban boards.'
            : 'You can access workspaces after the creator adds you as a member.'}
        </p>
        {canCreateWorkspace ? (
          <button
            type="button"
            onClick={openCreateWorkspaceModal}
            disabled={createWorkspaceLoading}
            className="rounded-xl bg-ink px-4 py-2 text-sm text-mist"
          >
            {createWorkspaceLoading ? 'Creating...' : 'Create workspace'}
          </button>
        ) : null}
        {showCreateWorkspace ? (
          <CreateWorkspaceModal
            error={workspaceFormError}
            loading={createWorkspaceLoading}
            onClose={() => setShowCreateWorkspace(false)}
            onSubmit={handleCreateWorkspace}
          />
        ) : null}
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {canCreateProject ? (
          <button
            type="button"
            onClick={openCreateProjectModal}
            disabled={createProjectLoading}
            className="rounded-xl bg-ink px-4 py-2 text-sm text-mist disabled:opacity-70"
          >
            {createProjectLoading ? 'Creating...' : 'Create project'}
          </button>
        ) : null}
        {canCreateWorkspace ? (
          <button
            type="button"
            onClick={openCreateWorkspaceModal}
            disabled={createWorkspaceLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-ink/20 px-4 py-2 text-sm hover:bg-ink/5 disabled:opacity-70"
          >
            <Users size={15} />
            {createWorkspaceLoading ? 'Creating...' : 'New workspace'}
          </button>
        ) : null}
        <button
          type="button"
          onClick={openMembersSection}
          className="inline-flex items-center gap-2 rounded-xl border border-ink/20 px-3 py-2 text-sm hover:bg-ink/5"
          aria-label="Go to workspace members"
        >
          <Users size={15} />
          Members
        </button>
      </div>

      {dashboardLoading ? (
        <p className="text-sm text-ink/70">Loading analytics...</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metricLabels.map((metric) => (
            <article key={metric.key} className="rounded-2xl border border-ink/10 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-ink/60">{metric.label}</p>
              <p className="mt-2 text-3xl font-semibold">
                {dashboardData?.dashboard?.[metric.key] ?? 0}
              </p>
            </article>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-ink/10 bg-white p-4">
          <h3 className="text-lg font-semibold">Task Status</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {(dashboardData?.dashboard.tasksByStatus ?? []).map((item) => (
              <li key={item.key} className="flex justify-between rounded-lg bg-sand px-3 py-2">
                <span>{item.key.replace('_', ' ')}</span>
                <strong>{item.count}</strong>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-ink/10 bg-white p-4">
          <h3 className="text-lg font-semibold">Priority Mix</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {(dashboardData?.dashboard.tasksByPriority ?? []).map((item) => (
              <li key={item.key} className="flex justify-between rounded-lg bg-sand px-3 py-2">
                <span>{item.key}</span>
                <strong>{item.count}</strong>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <article className="rounded-2xl border border-ink/10 bg-white p-4">
        <h3 className="text-lg font-semibold">Active Projects</h3>
        {projectsLoading ? (
          <p className="mt-3 text-sm text-ink/70">Loading projects...</p>
        ) : (projectsData?.projects.nodes ?? []).length === 0 ? (
          <div className="mt-3 space-y-3 rounded-xl border border-dashed border-ink/20 bg-sand/30 p-4">
            <p className="text-sm text-ink/70">
              No projects yet. Create one to start adding tasks and editing work.
            </p>
            <button
              type="button"
              onClick={openCreateProjectModal}
              disabled={createProjectLoading || !canCreateProject}
              className="rounded-xl bg-ink px-4 py-2 text-sm text-mist disabled:opacity-70"
            >
              {createProjectLoading ? 'Creating...' : 'Create first project'}
            </button>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {(projectsData?.projects.nodes ?? []).map((project) => (
              <li key={project.id} className="rounded-xl border border-ink/10 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{project.name}</p>
                    <p className="text-xs text-ink/60">
                      Due {project.dueDate ? dayjs(project.dueDate).format('MMM D, YYYY') : 'TBD'}
                    </p>
                  </div>
                  <Link
                    to={`/projects/${project.id}`}
                    className="rounded-lg border border-ink/10 px-3 py-1 text-xs hover:bg-ink hover:text-mist"
                  >
                    Open board
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </article>

      {showCreateProject ? (
        <CreateProjectModal
          error={projectFormError}
          loading={createProjectLoading}
          onClose={() => setShowCreateProject(false)}
          onSubmit={handleCreateProject}
        />
      ) : null}

      {showCreateWorkspace ? (
        <CreateWorkspaceModal
          error={workspaceFormError}
          loading={createWorkspaceLoading}
          onClose={() => setShowCreateWorkspace(false)}
          onSubmit={handleCreateWorkspace}
        />
      ) : null}

      {showAddMember ? (
        <AddWorkspaceMemberModal
          error={addMemberFormError}
          loading={addWorkspaceMemberLoading}
          memberOptions={memberOptions}
          onClose={() => setShowAddMember(false)}
          onSubmit={handleAddWorkspaceMember}
        />
      ) : null}
    </section>
  );
}

function AddWorkspaceMemberModal({
  error,
  loading,
  memberOptions,
  onClose,
  onSubmit,
}: {
  error: string;
  loading: boolean;
  memberOptions: Array<{ id: string; name: string; email: string }>;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-ink/30 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-float">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Add member</h2>
          <button type="button" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {error ? <p className="rounded-lg bg-ember/10 px-3 py-2 text-sm text-ember">{error}</p> : null}

        <label className="block">
          <span className="mb-1 block text-sm font-medium">User</span>
          <select
            name="userId"
            required
            defaultValue=""
            className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm outline-none focus:border-aqua"
          >
            <option value="" disabled>
              Select a user
            </option>
            {memberOptions.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name} · {candidate.email}
              </option>
            ))}
          </select>
        </label>

        {memberOptions.length === 0 ? (
          <p className="text-xs text-ink/50">Every active user is already a member of this workspace.</p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-xl border border-ink/10 px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || memberOptions.length === 0}
            className="rounded-xl bg-ink px-4 py-2 text-sm text-mist disabled:opacity-70"
          >
            {loading ? 'Adding...' : 'Add member'}
          </button>
        </div>
      </form>
    </div>
  );
}

function CreateWorkspaceModal({
  error,
  loading,
  onClose,
  onSubmit,
}: {
  error: string;
  loading: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-ink/30 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-float">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Create workspace</h2>
          <button type="button" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {error ? <p className="rounded-lg bg-ember/10 px-3 py-2 text-sm text-ember">{error}</p> : null}

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Workspace name</span>
          <input
            name="name"
            required
            minLength={2}
            maxLength={120}
            autoFocus
            placeholder="e.g. Product Engineering"
            className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm outline-none focus:border-aqua"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">
            Description <span className="font-normal text-ink/50">(optional)</span>
          </span>
          <textarea
            name="description"
            rows={3}
            maxLength={500}
            placeholder="What's this workspace for?"
            className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm outline-none focus:border-aqua"
          />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-xl border border-ink/10 px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-ink px-4 py-2 text-sm text-mist disabled:opacity-70"
          >
            {loading ? 'Creating...' : 'Create workspace'}
          </button>
        </div>
      </form>
    </div>
  );
}
