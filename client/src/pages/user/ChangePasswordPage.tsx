import { useMutation } from '@apollo/client/react';
import { Eye, EyeOff } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { CHANGE_MY_PASSWORD } from '../../lib/graphql';

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isAuthReady, user, requiresPasswordChange, completePasswordChange } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('12345678');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [feedback, setFeedback] = useState('');
  const [visibleFields, setVisibleFields] = useState({ current: false, new: false, confirmation: false });
  const [changePassword, { loading }] = useMutation(CHANGE_MY_PASSWORD);

  if (!isAuthReady) return null;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  if (!requiresPasswordChange) return <Navigate to={user?.role === 'ADMIN' ? '/admin' : '/'} replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback('');
    if (newPassword.length < 8) {
      setFeedback('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmation) {
      setFeedback('New password and confirmation must match.');
      return;
    }

    try {
      await changePassword({ variables: { currentPassword, newPassword } });
      completePasswordChange();
      navigate(user?.role === 'ADMIN' ? '/admin' : '/', { replace: true });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unable to change password.');
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_right,#dceef0,#f5f1e8_55%,#e7eef0)] px-4">
      <section className="w-full max-w-lg rounded-3xl border border-white/80 bg-white/90 p-8 shadow-float backdrop-blur">
        <p className="text-xs uppercase tracking-[0.25em] text-aqua">Security check</p>
        <h1 className="mt-3 text-3xl font-semibold">Change your password</h1>
        <p className="mt-2 text-sm text-ink/70">Your account is using the default password. Choose a new password before continuing.</p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <PasswordField label="Current password" value={currentPassword} visible={visibleFields.current} onChange={(value) => setCurrentPassword(value)} onToggle={() => setVisibleFields((fields) => ({ ...fields, current: !fields.current }))} />
          <PasswordField label="New password" value={newPassword} visible={visibleFields.new} onChange={(value) => setNewPassword(value)} onToggle={() => setVisibleFields((fields) => ({ ...fields, new: !fields.new }))} minLength={8} />
          <PasswordField label="Confirm new password" value={confirmation} visible={visibleFields.confirmation} onChange={(value) => setConfirmation(value)} onToggle={() => setVisibleFields((fields) => ({ ...fields, confirmation: !fields.confirmation }))} minLength={8} />
          {feedback ? <p className="rounded-lg bg-ember/10 px-3 py-2 text-sm text-ember">{feedback}</p> : null}
          <button type="submit" disabled={loading} className="w-full rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-mist disabled:opacity-70">{loading ? 'Saving...' : 'Save new password'}</button>
        </form>
      </section>
    </div>
  );
}

function PasswordField({ label, value, visible, onChange, onToggle, minLength }: { label: string; value: string; visible: boolean; onChange: (value: string) => void; onToggle: () => void; minLength?: number }) {
  return <label className="block"><span className="mb-1 block text-sm font-medium">{label}</span><div className="relative"><input type={visible ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} minLength={minLength} required className="w-full rounded-xl border border-ink/15 px-3 py-2 pr-10 text-sm" /><button type="button" title={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} onClick={onToggle} className="absolute inset-y-0 right-2 my-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-ink/60 hover:bg-sand hover:text-ink">{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>;
}
