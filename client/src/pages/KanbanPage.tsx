import { useMutation, useQuery } from '@apollo/client/react';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CREATE_TASK, PROJECT, TASKS, UPDATE_TASK } from '../lib/graphql';

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
    workspace: {
      id: string;
      name: string;
    };
  } | null;
};

const columns: Array<TaskNode['status']> = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];

export function KanbanPage() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [search, setSearch] = useState('');

  const { data: projectData, loading: projectLoading } = useQuery<ProjectResult>(PROJECT, {
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

  async function handleCreateTask() {
    const title = window.prompt('Task title');
    if (!title) {
      return;
    }

    if (!workspaceId) {
      window.alert('Project workspace is still loading. Please try again in a moment.');
      return;
    }

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
        </div>

        <div className="flex items-center gap-2">
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
            onClick={() => void handleCreateTask()}
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
    </section>
  );
}
