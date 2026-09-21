import { useMutation } from '@apollo/client/react';
import { Eye, EyeOff } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LOGIN } from '../../lib/graphql';

type AuthResponse = {
  token: string;
  user: {
    id: string;
    name: string;
    username: string;
    email: string;
    title?: string;
  };
};

type LoginMutationResult = { login: AuthResponse };

function toFriendlyAuthMessage(error: unknown): string {
  const fallback = 'Unable to sign in. Please check your username and password.';

  const rawMessage =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : '';

  const graphQLErrors =
    typeof error === 'object' &&
    error !== null &&
    'graphQLErrors' in error &&
    Array.isArray((error as { graphQLErrors?: unknown[] }).graphQLErrors)
      ? ((error as { graphQLErrors: Array<{ message?: string }> }).graphQLErrors ?? [])
      : [];

  const graphQLMessages = graphQLErrors
    .map((item) => item?.message ?? '')
    .filter(Boolean)
    .join(' ');

  const candidate = graphQLMessages || rawMessage;

  if (!candidate) {
    return fallback;
  }

  const lowerCandidate = candidate.toLowerCase();

  if (
    lowerCandidate.includes('failed to fetch') ||
    lowerCandidate.includes('networkerror') ||
    lowerCandidate.includes('network error') ||
    lowerCandidate.includes('econnrefused') ||
    lowerCandidate.includes('fetch failed')
  ) {
    return 'Cannot connect to the server. Please ensure backend API is running and try again.';
  }

  const jsonArrayMatch = candidate.match(/\[\s*\{[\s\S]*\}\s*\]/);
  const candidateJson = jsonArrayMatch ? jsonArrayMatch[0] : candidate;

  try {
    const parsed = JSON.parse(candidateJson) as Array<{
      path?: string[];
      message?: string;
      code?: string;
      minimum?: number;
    }>;

    if (Array.isArray(parsed) && parsed.length > 0) {
      const first = parsed[0];
      const field = Array.isArray(first.path) ? first.path[0] : '';

      if (field === 'password') {
        return 'Password format is invalid.';
      }

      if (field === 'username') {
        return 'Please enter a valid username.';
      }

      if (typeof first.message === 'string' && first.message.trim()) {
        return first.message;
      }
    }
  } catch {
    // Ignore JSON parse errors and continue with string-based mapping.
  }

  if (candidate.includes('Invalid credentials')) {
    return 'Invalid username or password.';
  }

  if (candidate.toLowerCase().includes('username')) {
    return 'Please use a valid username.';
  }

  return candidate.length <= 160 ? candidate : fallback;
}

export function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, setSession } = useAuth();
  const [formState, setFormState] = useState({
    username: '',
    password: '',
  });
  const [feedback, setFeedback] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);

  const [login, { loading: loginLoading }] = useMutation<LoginMutationResult>(LOGIN);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback('');

    try {
      const result = await login({
        variables: {
          input: {
            username: formState.username,
            password: formState.password,
          },
        },
      });

      if (!result.data?.login) {
        throw new Error('Login failed');
      }

      setSession(result.data.login.token, result.data.login.user);
      const destination = (location.state as { from?: string } | null)?.from ?? '/';
      navigate(destination);
    } catch (error) {
      setFeedback(toFriendlyAuthMessage(error));
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[conic-gradient(at_top_right,#fcefd6,#d8e9ee,#ecf7f8)] px-4">
      <div className="w-full max-w-lg rounded-3xl border border-white/80 bg-white/80 p-8 shadow-float backdrop-blur">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-aqua">TeamFlow SaaS</p>
        <h1 className="mt-3 text-3xl font-semibold">Welcome back</h1>
        <p className="mt-2 text-sm text-ink/70">
          Manage projects with GraphQL-powered workflows and role-aware collaboration.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Username</span>
            <input
              type="text"
              required
              value={formState.username}
              onChange={(event) =>
                setFormState((current) => ({ ...current, username: event.target.value }))
              }
              className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-aqua"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">Password</span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={formState.password}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, password: event.target.value }))
                }
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 pr-10 text-sm outline-none focus:border-aqua"
              />
              <button
                type="button"
                title={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((current) => !current)}
                className="absolute inset-y-0 right-2 my-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-ink/60 hover:bg-sand hover:text-ink"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          {feedback ? <p className="rounded-lg bg-ember/10 px-3 py-2 text-sm text-ember">{feedback}</p> : null}

          <button
            type="submit"
            disabled={loginLoading}
            className="w-full rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-mist transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loginLoading ? 'Please wait...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
