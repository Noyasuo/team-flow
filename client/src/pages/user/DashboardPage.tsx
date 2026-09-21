import { useMutation, useQuery } from '@apollo/client/react';
import React from 'react';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import {
  ADD_WORKSPACE_MEMBER,
  CREATE_PROJECT,
  CREATE_WORKSPACE,
  DASHBOARD,
  PROJECTS,
  USERS,
  WORKSPACES,
} from '../../lib/graphql';
import { useWorkspaceContext } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';

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

const workspaceRoles: Array<'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER'> = [
  'ADMIN',
  'MANAGER',
  'MEMBER',
  'VIEWER',
];

export function DashboardPage() {
  const { user } = useAuth();
  const { selectedWorkspaceId, setSelectedWorkspaceId } = useWorkspaceContext();
  const { data: workspaceData, loading: workspacesLoading, refetch } =
    useQuery<WorkspacesResult>(WORKSPACES);
  const [createWorkspace, { loading: createWorkspaceLoading }] =
    useMutation<CreateWorkspaceResult>(CREATE_WORKSPACE);
  const [createProject, { loading: createProjectLoading }] = useMutation(CREATE_PROJECT);
  const [addWorkspaceMember, { loading: addWorkspaceMemberLoading }] =
    useMutation<AddWorkspaceMemberResult>(ADD_WORKSPACE_MEMBER);
  const [memberUserId, setMemberUserId] = React.useState('');
  const [memberRole, setMemberRole] = React.useState<'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER'>('MEMBER');

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

  // Sync selected workspace when first workspace loads
  React.useEffect(() => {
    if (activeWorkspace && !selectedWorkspaceId) {
      setSelectedWorkspaceId(activeWorkspace.id);
    }
  }, [activeWorkspace, selectedWorkspaceId, setSelectedWorkspaceId]);

  React.useEffect(() => {
    if (!canManageMembers) {
      return;
    }

    if (!memberUserId && memberOptions.length > 0) {
      setMemberUserId(memberOptions[0].id);
    }
  }, [canManageMembers, memberOptions, memberUserId]);

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

  async function handleCreateWorkspace() {
    if (!canCreateWorkspace) {
      window.alert('Only ADMIN or MANAGER accounts can create workspaces.');
      return;
    }

    const workspaceName = window.prompt('New workspace name');
    if (!workspaceName) {
      return;
    }

    const result = await createWorkspace({
      variables: {
        input: {
          name: workspaceName,
          description: 'Your default TeamFlow workspace',
        },
      },
    });

    await refetch();
    
    // Switch to newly created workspace
    if (result.data?.createWorkspace?.id) {
      setSelectedWorkspaceId(result.data.createWorkspace.id);
    }
  }

  async function handleCreateProject() {
    if (!activeWorkspace) {
      return;
    }

    if (!canCreateProject) {
      window.alert('You do not have permission to create projects in this workspace.');
      return;
    }

    const projectName = window.prompt('Project name');
    if (!projectName) {
      return;
    }

    const projectDescription = window.prompt('Project description (optional)') ?? '';

    await createProject({
      variables: {
        input: {
          workspaceId: activeWorkspace.id,
          name: projectName,
          description: projectDescription,
          status: 'ACTIVE',
        },
      },
    });

    await Promise.all([refetch(), refetchDashboard(), refetchProjects()]);
  }

  async function handleAddWorkspaceMember() {
    if (!activeWorkspace || !canManageMembers) {
      window.alert('Only the workspace creator can add members.');
      return;
    }

    const targetUser = (usersData?.users.nodes ?? []).find((candidate) => candidate.id === memberUserId);

    if (!targetUser) {
      window.alert('Select a user to add.');
      return;
    }

    await addWorkspaceMember({
      variables: {
        input: {
          workspaceId: activeWorkspace.id,
          userId: targetUser.id,
          role: memberRole,
        },
      },
    });

    await Promise.all([refetch(), refetchUsers()]);
    setMemberUserId('');
    setMemberRole('MEMBER');
    window.alert(`${targetUser.name} added as ${memberRole}.`);
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
            onClick={() => void handleCreateWorkspace()}
            disabled={createWorkspaceLoading}
            className="rounded-xl bg-ink px-4 py-2 text-sm text-mist"
          >
            {createWorkspaceLoading ? 'Creating...' : 'Create workspace'}
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.25em] text-aqua">Workspace</p>
        <h2 className="text-3xl font-semibold">{activeWorkspace.name}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {canCreateProject ? (
            <button
              type="button"
              onClick={() => void handleCreateProject()}
              disabled={createProjectLoading}
              className="rounded-xl bg-ink px-4 py-2 text-sm text-mist disabled:opacity-70"
            >
              {createProjectLoading ? 'Creating...' : 'Create project'}
            </button>
          ) : null}
          {canCreateWorkspace ? (
            <button
              type="button"
              onClick={() => void handleCreateWorkspace()}
              disabled={createWorkspaceLoading}
              className="rounded-xl border border-ink/20 px-4 py-2 text-sm hover:bg-ink/5 disabled:opacity-70"
            >
              {createWorkspaceLoading ? 'Creating...' : 'New workspace'}
            </button>
          ) : null}
          {canManageMembers ? (
            <button
              type="button"
              onClick={() => void handleAddWorkspaceMember()}
              disabled={addWorkspaceMemberLoading}
              className="rounded-xl border border-ink/20 px-4 py-2 text-sm hover:bg-ink/5 disabled:opacity-70"
            >
              {addWorkspaceMemberLoading ? 'Adding...' : 'Add member'}
            </button>
          ) : null}
        </div>
      </div>

      {canManageMembers ? (
        <article className="rounded-2xl border border-ink/10 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold">Workspace Members</h3>
              <p className="text-sm text-ink/70">Only the workspace creator can add members.</p>
            </div>
            <span className="rounded-full bg-sand px-3 py-1 text-xs text-ink/70">
              Creator: {activeWorkspace?.owner?.id === user?.id ? 'Yes' : 'No'}
            </span>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <form
              className="space-y-3 rounded-xl border border-ink/10 bg-sand/30 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                void handleAddWorkspaceMember();
              }}
            >
              <label className="block text-sm font-medium text-ink">Add member</label>
              <select
                aria-label="Member to add"
                value={memberUserId}
                onChange={(event) => setMemberUserId(event.target.value)}
                className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm"
              >
                <option value="">Select a user</option>
                {memberOptions.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name} · {candidate.email}
                  </option>
                ))}
              </select>

              <select
                aria-label="Member role"
                value={memberRole}
                onChange={(event) => setMemberRole(event.target.value as typeof memberRole)}
                className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm"
              >
                {workspaceRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                disabled={addWorkspaceMemberLoading || !memberUserId}
                className="rounded-xl bg-ink px-4 py-2 text-sm text-mist disabled:opacity-70"
              >
                {addWorkspaceMemberLoading ? 'Adding...' : 'Add member'}
              </button>
            </form>

            <div className="rounded-xl border border-ink/10 bg-sand/20 p-4">
              <p className="text-sm font-medium text-ink">Current members</p>
              <ul className="mt-3 space-y-2 text-sm">
                {activeWorkspace?.members.map((member) => (
                  <li key={member.user.id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
                    <div>
                      <p className="font-medium">{member.user.name}</p>
                      <p className="text-xs text-ink/60">{member.user.email}</p>
                    </div>
                    <span className="rounded-full bg-ink px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-mist">
                      {member.role}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </article>
      ) : null}

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
              onClick={() => void handleCreateProject()}
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
    </section>
  );
}
