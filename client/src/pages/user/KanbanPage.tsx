import { useMutation, useQuery, useSubscription } from '@apollo/client/react';
import dayjs from 'dayjs';
import { ArrowLeft, UsersRound } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CREATE_TASK,
  PROJECT,
  PROJECT_UPDATED_SUBSCRIPTION,
  TASK_CHANGED_SUBSCRIPTION,
  TASKS,
  UPDATE_TASK,
  WORKSPACE_UPDATED_SUBSCRIPTION,
} from '../../lib/graphql';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { CreateTaskModal } from '../../components/CreateTaskModal';

type TaskNode = {
  id: string;
  title: string;
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string | null;
  description?: string;
  assignee?: {
    id: string;
    name: string;
  } | null;
};

type TasksResult = {
  tasks: {
    nodes: TaskNode[];
    pageInfo: {
      page: number;
      totalPages: number;
      totalCount: number;
    };
  };
};

type ProjectResult = {
  project: {
    id: string;
    name: string;
    description?: string | null;
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

const columns: Array<TaskNode['status']> = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];

export function KanbanPage() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [taskFormError, setTaskFormError] = useState('');

  const { data: projectData, loading: projectLoading, refetch: refetchProject } = useQuery<ProjectResult>(PROJECT, {
    skip: !projectId,
    variables: { id: projectId },
  });

  const { data, loading, refetch } = useQuery<TasksResult>(TASKS, {
    skip: !projectId,
    variables: {
      projectId,
      page: 1,
      limit: 50,
      search: search.trim() ? search : undefined,
    },
  });

  const [createTask, { loading: createTaskLoading }] = useMutation(CREATE_TASK);
  const [updateTask] = useMutation(UPDATE_TASK);

  // Live updates: any task change, project-access change, or workspace-membership
  // change on this board refreshes the relevant query automatically - no manual refresh needed.
  const liveWorkspaceId = projectData?.project?.workspace.id;
  useSubscription(TASK_CHANGED_SUBSCRIPTION, {
    variables: { projectId },
    skip: !projectId,
    onData: () => void refetch(),
  });
  useSubscription(PROJECT_UPDATED_SUBSCRIPTION, {
    variables: { projectId },
    skip: !projectId,
    onData: () => void refetchProject(),
  });
  useSubscription(WORKSPACE_UPDATED_SUBSCRIPTION, {
    variables: { workspaceId: liveWorkspaceId },
    skip: !liveWorkspaceId,
    onData: () => void refetchProject(),
  });

  const groupedTasks = useMemo(() => {
    const bucket: Record<TaskNode['status'], TaskNode[]> = {
      TODO: [],
      IN_PROGRESS: [],
      REVIEW: [],
      DONE: [],
    };

    (data?.tasks.nodes ?? []).forEach((task) => {
      bucket[task.status].push(task);
    });

    return bucket;
  }, [data?.tasks.nodes]);

  if (!projectId) {
    return <p className="text-sm text-ink/70">Pick a project from the dashboard first.</p>;
  }

  const selectedProject = projectData?.project ?? null;
  const workspaceId = selectedProject?.workspace.id ?? null;
  const isProjectCreator = selectedProject?.createdBy.id === user?.id;
  const isWorkspaceOwner = selectedProject?.workspace.owner.id === user?.id;
  const currentProjectRole = isWorkspaceOwner
    ? 'ADMIN'
    : isProjectCreator
      ? 'EDIT'
    : selectedProject?.workspace.members.find((member) => member.user.id === user?.id)?.role ?? null;
  function openCreateTaskModal() {
    if (!workspaceId) {
      showToast('Project workspace is still loading. Please try again in a moment.', 'error');
      return;
    }

    setTaskFormError('');
    setShowCreateTask(true);
  }

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId) {
      setTaskFormError('Project workspace is still loading. Please try again in a moment.');
      return;
    }

    setTaskFormError('');
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') ?? '').trim();

    if (title.length < 2) {
      setTaskFormError('Task title must be at least 2 characters.');
      return;
    }

    try {
      await createTask({
        variables: {
          input: {
            workspaceId,
            projectId,
            title,
            description: '',
            priority: 'MEDIUM',
            status: 'TODO',
          },
        },
      });

      await refetch();
      setShowCreateTask(false);
    } catch (createError) {
      setTaskFormError(
        createError instanceof Error
          ? createError.message.replace(/^GraphQL error:\s*/i, '')
          : 'Unable to create task.'
      );
    }
  }

  async function handleStatusChange(taskId: string, status: TaskNode['status']) {
    await updateTask({
      variables: {
        input: {
          id: taskId,
          status,
        },
      },
    });

    await refetch();
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-aqua">Kanban</p>
          <h2 className="text-2xl font-semibold">
            {projectLoading ? 'Loading project...' : selectedProject?.name ?? 'Project board'}
          </h2>
          {selectedProject?.workspace?.name ? (
            <p className="text-sm text-ink/60">Workspace: {selectedProject.workspace.name}</p>
          ) : null}
          {currentProjectRole ? (
            <p className="mt-2 inline-flex rounded-full bg-aqua/10 px-3 py-1 text-xs font-medium text-aqua">
              Project role: {currentProjectRole}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/projects"
            className="inline-flex items-center gap-2 rounded-xl border border-ink/10 px-3 py-2 text-sm hover:bg-ink hover:text-mist"
          >
            <ArrowLeft size={15} />
            Back to projects
          </Link>
          <Link
            to={`/projects/${projectId}/members`}
            title="Project members"
            aria-label="Project members"
            className="inline-flex items-center justify-center rounded-xl border border-ink/10 px-3 py-2 text-sm hover:bg-ink hover:text-mist"
          >
            <UsersRound size={16} />
          </Link>
          <input
            placeholder="Search tasks..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="rounded-xl border border-ink/10 px-3 py-2 text-sm outline-none focus:border-aqua"
          />
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-xl border border-ink/10 px-3 py-2 text-sm hover:bg-ink hover:text-mist"
          >
            Filter
          </button>
          <button
            type="button"
            onClick={openCreateTaskModal}
            disabled={createTaskLoading}
            className="rounded-xl bg-ink px-3 py-2 text-sm text-mist"
          >
            {createTaskLoading ? 'Saving...' : 'New task'}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-ink/70">Loading board...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {columns.map((column) => (
            <article key={column} className="rounded-2xl border border-ink/10 bg-white p-3">
              <header className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">{column.replace('_', ' ')}</h3>
                <span className="rounded-full bg-sand px-2 py-0.5 text-xs text-ink/70">
                  {groupedTasks[column].length}
                </span>
              </header>

              <ul className="space-y-2">
                {groupedTasks[column].map((task) => (
                  <li key={task.id} className="rounded-xl border border-ink/10 bg-sand/50 p-3">
                    <button
                      type="button"
                      onClick={() => navigate(`/tasks/${task.id}`)}
                      className="text-left text-sm font-medium hover:underline"
                    >
                      {task.title}
                    </button>
                    <p className="mt-1 text-xs text-ink/70">{task.priority} priority</p>
                    <p className="mt-1 text-xs text-ink/60">
                      Due {task.dueDate ? dayjs(task.dueDate).format('MMM D') : 'No due date'}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <select
                        title="Task status"
                        value={task.status}
                        onChange={(event) =>
                          void handleStatusChange(
                            task.id,
                            event.target.value as TaskNode['status']
                          )
                        }
                        className="w-full rounded-lg border border-ink/10 bg-white px-2 py-1 text-xs"
                      >
                        {columns.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                      <Link
                        to={`/tasks/${task.id}`}
                        className="rounded-lg border border-ink/10 px-2 py-1 text-xs hover:bg-ink hover:text-mist"
                      >
                        View
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}

      {showCreateTask ? (
        <CreateTaskModal
          error={taskFormError}
          loading={createTaskLoading}
          onClose={() => setShowCreateTask(false)}
          onSubmit={handleCreateTask}
        />
      ) : null}
    </section>
  );
}
