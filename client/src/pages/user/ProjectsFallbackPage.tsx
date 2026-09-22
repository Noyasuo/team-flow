import { useMutation, useQuery } from '@apollo/client/react';
import React from 'react';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import { CREATE_PROJECT, PROJECTS, WORKSPACES } from '../../lib/graphql';
import { useWorkspaceContext } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { CreateProjectModal } from '../../components/CreateProjectModal';

type WorkspaceResult = {
  workspaces: Array<{
    id: string;
    name: string;
    members: Array<{
      role: 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER';
      user: { id: string };
    }>;
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
  const { user } = useAuth();
  const { showToast } = useToast();
  const { selectedWorkspaceId, setSelectedWorkspaceId } = useWorkspaceContext();
  const { data: workspacesData, loading: workspacesLoading } =
    useQuery<WorkspaceResult>(WORKSPACES);
  const [createProject, { loading: createProjectLoading }] =
    useMutation(CREATE_PROJECT);

  const activeWorkspace = workspacesData?.workspaces?.find(w => w.id === selectedWorkspaceId) ??
                         workspacesData?.workspaces?.[0] ?? null;

  const activeWorkspaceRole =
    activeWorkspace?.members.find((member) => member.user.id === user?.id)?.role ?? null;
  const canCreateProject = activeWorkspaceRole ? ['ADMIN', 'MANAGER'].includes(activeWorkspaceRole) : false;
  const canCreateWorkspace = ['ADMIN', 'MANAGER'].includes(user?.role ?? 'MEMBER');
  const [showCreateProject, setShowCreateProject] = React.useState(false);
  const [projectFormError, setProjectFormError] = React.useState('');

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

      await refetch();
      setShowCreateProject(false);
    } catch (createError) {
      setProjectFormError(
        createError instanceof Error
          ? createError.message.replace(/^GraphQL error:\s*/i, '')
          : 'Unable to create project.'
      );
    }
  }

  if (workspacesLoading) {
    return <p className="text-sm text-ink/70">Loading projects...</p>;
  }

  if (!activeWorkspace) {
    return (
      <section className="rounded-2xl border border-ink/10 bg-white p-5">
        <h2 className="text-2xl font-semibold">No workspace found</h2>
        <p className="mt-2 text-sm text-ink/70">
          {canCreateWorkspace
            ? 'Create a workspace first from Dashboard, then manage projects here.'
            : 'You can access workspaces after the creator adds you as a member.'}
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

      {showCreateProject ? (
        <CreateProjectModal
          error={projectFormError}
          loading={createProjectLoading}
          onClose={() => setShowCreateProject(false)}
          onSubmit={handleCreateProject}
        />
      ) : null}
    </section>
  );
}
