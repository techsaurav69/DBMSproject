import { type FormEvent, type ReactElement, useState } from 'react';
import { ApiRequestError, api, type AuthResponse } from '../lib/api';

type Mode = 'login' | 'register';

type Props = { onAuthenticated: (response: AuthResponse) => void };

export function AuthPage({ onAuthenticated }: Props): ReactElement {
  const [mode, setMode] = useState<Mode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    // Read the form's actual values so browser/password-manager autofill works
    // even when it does not dispatch React change events.
    const form = new FormData(event.currentTarget);
    const credentials = { email: String(form.get('email') ?? '').trim(), password: String(form.get('password') ?? '') };
    setError(null);
    setIsSubmitting(true);
    try {
      const response = mode === 'login'
        ? await api.login(credentials)
        : await api.register({ displayName: String(form.get('displayName') ?? '').trim(), ...credentials });
      onAuthenticated(response);
    } catch (reason: unknown) {
      setError(reason instanceof ApiRequestError ? reason.message : 'Unable to reach the local API.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="auth-card" aria-labelledby="auth-title">
      <div className="auth-card__topline">
        <span className="signal-dot" aria-hidden="true" />
        Secure local access
      </div>
      <h2 id="auth-title">{mode === 'login' ? 'Sign in to coordinate' : 'Create a citizen account'}</h2>
      <p className="muted">
        {mode === 'login'
          ? 'Use a fictional development account to enter the local prototype.'
          : 'New registrations receive the Citizen role by default.'}
      </p>

      <div className="auth-switch" role="tablist" aria-label="Authentication mode">
        <button className={mode === 'login' ? 'is-active' : ''} type="button" role="tab" aria-selected={mode === 'login'} onClick={() => setMode('login')}>Sign in</button>
        <button className={mode === 'register' ? 'is-active' : ''} type="button" role="tab" aria-selected={mode === 'register'} onClick={() => setMode('register')}>Register</button>
      </div>

      <form onSubmit={submit} noValidate>
        {mode === 'register' && (
          <label>
            Display name
            <input name="displayName" value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={120} required autoComplete="name" placeholder="Your name" />
          </label>
        )}
        <label>
          Email address
          <input name="email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" required autoComplete={mode === 'login' ? 'username' : 'email'} />
        </label>
        <label>
          Password
          <input name="password" value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={12} maxLength={128} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </label>
        {mode === 'register' && <p className="field-note">Use 12+ characters with upper/lowercase letters and a number.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-action" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Working…' : mode === 'login' ? 'Sign in securely' : 'Create local account'}
          <span aria-hidden="true">→</span>
        </button>
      </form>

    </section>
  );
}
