import { useMutation, useQuery } from '@apollo/client/react';
import React from 'react';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import { CREATE_PROJECT, PROJECTS, WORKSPACES } from '../lib/graphql';
import { useWorkspaceContext } from '../context/WorkspaceContext';

type WorkspaceResult = {
  workspaces: Array<{
    id: string;
    name: string;
  }>;
};

type ProjectResult = {
  projects: {
    nodes: Array<{
      id: string;
      name: string;
      status: string;
      dueDate?: string | null;
    }>;
  };
};

export function ProjectsFallbackPage() {
  const { selectedWorkspaceId, setSelectedWorkspaceId } = useWorkspaceContext();
  const { data: workspacesData, loading: workspacesLoading } =
    useQuery<WorkspaceResult>(WORKSPACES);
  const [createProject, { loading: createProjectLoading }] =
    useMutation(CREATE_PROJECT);

  const activeWorkspace = workspacesData?.workspaces?.find(w => w.id === selectedWorkspaceId) ??
                         workspacesData?.workspaces?.[0] ?? null;

  // Sync selected workspace when first workspace loads
  React.useEffect(() => {
    if (activeWorkspace && !selectedWorkspaceId) {
      setSelectedWorkspaceId(activeWorkspace.id);
    }
  }, [activeWorkspace, selectedWorkspaceId, setSelectedWorkspaceId]);

  const { data: projectsData, loading: projectsLoading, refetch } =
    useQuery<ProjectResult>(PROJECTS, {
      skip: !activeWorkspace,
      variables: {
        workspaceId: activeWorkspace?.id,
        page: 1,
        limit: 20,
      },
    });

  async function handleCreateProject() {
    if (!activeWorkspace) {
      return;
    }

    const projectName = window.prompt('Project name');
    if (!projectName) {
      return;
    }

    await createProject({
      variables: {
        input: {
          workspaceId: activeWorkspace.id,
          name: projectName,
          description: '',
          status: 'ACTIVE',
        },
      },
    });

    await refetch();
  }

  if (workspacesLoading) {
    return <p className="text-sm text-ink/70">Loading projects...</p>;
  }

  if (!activeWorkspace) {
    return (
      <section className="rounded-2xl border border-ink/10 bg-white p-5">
        <h2 className="text-2xl font-semibold">No workspace found</h2>
        <p className="mt-2 text-sm text-ink/70">
          Create a workspace first from Dashboard, then manage projects here.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-ink/10 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Projects</h2>
          <p className="text-sm text-ink/70">Workspace: {activeWorkspace.name}</p>
        </div>
        <button
          type="button"
          onClick={() => void handleCreateProject()}
          disabled={createProjectLoading}
          className="rounded-xl bg-ink px-4 py-2 text-sm text-mist disabled:opacity-70"
        >
          {createProjectLoading ? 'Creating...' : 'Create project'}
        </button>
      </div>

      {projectsLoading ? (
        <p className="text-sm text-ink/70">Loading project list...</p>
      ) : (projectsData?.projects.nodes ?? []).length === 0 ? (
        <p className="text-sm text-ink/70">No projects yet. Create one to start managing tasks.</p>
      ) : (
        <ul className="space-y-2">
          {(projectsData?.projects.nodes ?? []).map((project) => (
            <li key={project.id} className="rounded-xl border border-ink/10 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{project.name}</p>
                  <p className="text-xs text-ink/60">
                    {project.status} · Due {project.dueDate ? dayjs(project.dueDate).format('MMM D, YYYY') : 'TBD'}
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
    </section>
  );
}
