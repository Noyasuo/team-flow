import { useMutation, useQuery } from '@apollo/client/react';
import React from 'react';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import { CREATE_PROJECT, CREATE_WORKSPACE, DASHBOARD, PROJECTS, WORKSPACES } from '../lib/graphql';
import { useWorkspaceContext } from '../context/WorkspaceContext';

type Workspace = {
  id: string;
  name: string;
  description?: string;
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

const metricLabels = [
  { key: 'totalProjects', label: 'Projects' },
  { key: 'totalTasks', label: 'Tasks' },
  { key: 'overdueTasks', label: 'Overdue' },
  { key: 'completedTasksThisWeek', label: 'Done (7d)' },
] as const;

export function DashboardPage() {
  const { selectedWorkspaceId, setSelectedWorkspaceId } = useWorkspaceContext();
  const { data: workspaceData, loading: workspacesLoading, refetch } =
    useQuery<WorkspacesResult>(WORKSPACES);
  const [createWorkspace, { loading: createWorkspaceLoading }] =
    useMutation<CreateWorkspaceResult>(CREATE_WORKSPACE);
  const [createProject, { loading: createProjectLoading }] = useMutation(CREATE_PROJECT);

  // Use selected workspace or fall back to first
  const activeWorkspace = workspaceData?.workspaces?.find(w => w.id === selectedWorkspaceId) ?? 
                         workspaceData?.workspaces?.[0] ?? null;

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

  async function handleCreateWorkspace() {
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

  if (workspacesLoading) {
    return <p className="text-sm text-ink/70">Loading workspaces...</p>;
  }

  if (!activeWorkspace) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">No workspace yet</h2>
        <p className="text-sm text-ink/70">Create your first workspace to unlock analytics, projects, and kanban boards.</p>
        <button
          type="button"
          onClick={() => void handleCreateWorkspace()}
          disabled={createWorkspaceLoading}
          className="rounded-xl bg-ink px-4 py-2 text-sm text-mist"
        >
          {createWorkspaceLoading ? 'Creating...' : 'Create workspace'}
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.25em] text-aqua">Workspace</p>
        <h2 className="text-3xl font-semibold">{activeWorkspace.name}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleCreateProject()}
            disabled={createProjectLoading}
            className="rounded-xl bg-ink px-4 py-2 text-sm text-mist disabled:opacity-70"
          >
            {createProjectLoading ? 'Creating...' : 'Create project'}
          </button>
          <button
            type="button"
            onClick={() => void handleCreateWorkspace()}
            disabled={createWorkspaceLoading}
            className="rounded-xl border border-ink/20 px-4 py-2 text-sm hover:bg-ink/5 disabled:opacity-70"
          >
            {createWorkspaceLoading ? 'Creating...' : 'New workspace'}
          </button>
        </div>
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
              onClick={() => void handleCreateProject()}
              disabled={createProjectLoading}
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
