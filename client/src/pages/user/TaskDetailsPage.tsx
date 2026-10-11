import { useMutation, useQuery, useSubscription } from '@apollo/client/react';
import dayjs from 'dayjs';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ADD_COMMENT, COMMENT_ADDED_SUBSCRIPTION, TASK, TASK_CHANGED_SUBSCRIPTION, UPDATE_TASK } from '../../lib/graphql';

type TaskResult = {
  task: {
    id: string;
    title: string;
    description?: string;
    status: string;
    priority: string;
    dueDate?: string | null;
    assignee?: { id: string; name: string } | null;
    project: { id: string; name: string };
    comments: {
      nodes: Array<{
        id: string;
        body: string;
        createdAt: string;
        author: { id: string; name: string };
      }>;
    };
  } | null;
};

export function TaskDetailsPage() {
  const { taskId } = useParams();
  const [comment, setComment] = useState('');
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    status: 'TODO',
    priority: 'MEDIUM',
    dueDate: '',
  });
  const { data, loading, refetch } = useQuery<TaskResult>(TASK, {
    skip: !taskId,
    variables: { id: taskId },
  });
  const [addComment, { loading: commentLoading }] = useMutation(ADD_COMMENT);
  const [updateTask, { loading: updateLoading }] = useMutation(UPDATE_TASK);

  // Live updates: new comments and task edits made elsewhere refresh this page automatically.
  const liveProjectId = data?.task?.project.id;
  useSubscription(COMMENT_ADDED_SUBSCRIPTION, {
    variables: { taskId },
    skip: !taskId,
    onData: () => void refetch(),
  });
  useSubscription(TASK_CHANGED_SUBSCRIPTION, {
    variables: { projectId: liveProjectId },
    skip: !liveProjectId,
    onData: () => void refetch(),
  });

  useEffect(() => {
    if (!data?.task) {
      return;
    }

    setTaskForm({
      title: data.task.title,
      description: data.task.description ?? '',
      status: data.task.status,
      priority: data.task.priority,
      dueDate: data.task.dueDate ? data.task.dueDate.slice(0, 10) : '',
    });
  }, [data?.task]);

  if (!taskId) {
    return <p className="text-sm text-ink/70">Task not found.</p>;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextComment = comment.trim();
    if (!nextComment) {
      return;
    }

    await addComment({
      variables: {
        input: {
          taskId,
          body: nextComment,
        },
      },
    });

    setComment('');
    await refetch();
  }

  async function handleTaskSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!taskId) {
      return;
    }

    const dueDateValue = taskForm.dueDate
      ? new Date(`${taskForm.dueDate}T00:00:00.000Z`).toISOString()
      : null;

    await updateTask({
      variables: {
        input: {
          id: taskId,
          title: taskForm.title,
          description: taskForm.description,
          status: taskForm.status,
          priority: taskForm.priority,
          dueDate: dueDateValue,
        },
      },
    });

    await refetch();
  }

  if (loading) {
    return <p className="text-sm text-ink/70">Loading task...</p>;
  }

  if (!data?.task) {
    return <p className="text-sm text-ink/70">Task not found.</p>;
  }

  const task = data.task;

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <Link
          to={`/projects/${task.project.id}`}
          className="inline-flex items-center gap-2 rounded-xl border border-ink/10 px-3 py-2 text-sm text-ink hover:bg-ink hover:text-mist"
        >
          <ArrowLeft size={15} />
          Back to {task.project.name}
        </Link>
        <h2 className="text-3xl font-semibold">{task.title}</h2>
        <p className="text-sm text-ink/70">{task.description || 'No description provided yet.'}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-xl border border-ink/10 bg-white p-3">
          <p className="text-xs uppercase text-ink/60">Status</p>
          <p className="mt-1 font-medium">{task.status}</p>
        </article>
        <article className="rounded-xl border border-ink/10 bg-white p-3">
          <p className="text-xs uppercase text-ink/60">Priority</p>
          <p className="mt-1 font-medium">{task.priority}</p>
        </article>
        <article className="rounded-xl border border-ink/10 bg-white p-3">
          <p className="text-xs uppercase text-ink/60">Due</p>
          <p className="mt-1 font-medium">{task.dueDate ? dayjs(task.dueDate).format('MMM D, YYYY') : 'TBD'}</p>
        </article>
      </div>

      <article className="rounded-2xl border border-ink/10 bg-white p-4">
        <h3 className="text-lg font-semibold">Edit Task</h3>

        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleTaskSave}>
          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm font-medium">Title</span>
            <input
              value={taskForm.title}
              onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))}
              className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm outline-none focus:border-aqua"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm font-medium">Description</span>
            <textarea
              rows={4}
              value={taskForm.description}
              onChange={(event) =>
                setTaskForm((current) => ({ ...current, description: event.target.value }))
              }
              className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm outline-none focus:border-aqua"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">Status</span>
            <select
              value={taskForm.status}
              onChange={(event) => setTaskForm((current) => ({ ...current, status: event.target.value }))}
              className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm outline-none focus:border-aqua"
            >
              <option value="TODO">TODO</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="REVIEW">REVIEW</option>
              <option value="DONE">DONE</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">Priority</span>
            <select
              value={taskForm.priority}
              onChange={(event) =>
                setTaskForm((current) => ({ ...current, priority: event.target.value }))
              }
              className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm outline-none focus:border-aqua"
            >
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="URGENT">URGENT</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">Due date</span>
            <input
              type="date"
              value={taskForm.dueDate}
              onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))}
              className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm outline-none focus:border-aqua"
            />
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={updateLoading}
              className="rounded-xl bg-ink px-4 py-2 text-sm text-mist disabled:opacity-70"
            >
              {updateLoading ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </article>

      <article className="rounded-2xl border border-ink/10 bg-white p-4">
        <h3 className="text-lg font-semibold">Discussion</h3>

        <ul className="mt-4 space-y-3">
          {task.comments.nodes.map((item) => (
            <li key={item.id} className="rounded-xl border border-ink/10 bg-sand/40 p-3">
              <div className="flex items-center justify-between gap-3 text-xs text-ink/60">
                <span>{item.author.name}</span>
                <span>{dayjs(item.createdAt).format('MMM D, HH:mm')}</span>
              </div>
              <p className="mt-2 text-sm">{item.body}</p>
            </li>
          ))}
        </ul>

        <form className="mt-4 flex gap-2" onSubmit={handleSubmit}>
          <input
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Write a comment..."
            className="flex-1 rounded-xl border border-ink/10 px-3 py-2 text-sm outline-none focus:border-aqua"
          />
          <button
            type="submit"
            disabled={commentLoading}
            className="rounded-xl bg-ink px-3 py-2 text-sm text-mist"
          >
            {commentLoading ? 'Posting...' : 'Post'}
          </button>
        </form>
      </article>
    </section>
  );
}
