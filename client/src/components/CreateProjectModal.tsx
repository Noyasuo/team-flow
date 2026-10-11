import { X } from 'lucide-react';
import type { FormEvent } from 'react';

export function CreateProjectModal({
  error,
  loading,
  onClose,
  onSubmit,
}: {
  error: string;
  loading: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-ink/30 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-float">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Create project</h2>
          <button type="button" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {error ? <p className="rounded-lg bg-ember/10 px-3 py-2 text-sm text-ember">{error}</p> : null}

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Project name</span>
          <input
            name="name"
            required
            minLength={2}
            maxLength={120}
            autoFocus
            placeholder="e.g. Website Redesign"
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
            maxLength={1000}
            placeholder="What's this project about?"
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
            {loading ? 'Creating...' : 'Create project'}
          </button>
        </div>
      </form>
    </div>
  );
}
