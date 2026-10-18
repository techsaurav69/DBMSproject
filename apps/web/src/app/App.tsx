import { type JSX, useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { api, type AuthResponse, type CurrentUser } from '../lib/api';
import { AuthPage } from './AuthPage';
import { Workspace } from './Workspace';

const storageKey = 'crisisgrid.local.auth-token';
const themeStorageKey = 'crisisgrid.local.theme';

function AppContent(): JSX.Element {
  const [health, setHealth] = useState<'checking' | 'online' | 'offline'>('checking');
  const [session, setSession] = useState<{ accessToken: string; user: CurrentUser } | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem(themeStorageKey) === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    void api.health().then(() => setHealth('online')).catch(() => setHealth('offline'));
    const token = localStorage.getItem(storageKey);
    if (token) {
      void api.me(token).then((user) => setSession({ accessToken: token, user })).catch(() => localStorage.removeItem(storageKey));
    }
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem(themeStorageKey, theme); }, [theme]);

  function onAuthenticated(response: AuthResponse): void {
    localStorage.setItem(storageKey, response.accessToken);
    setSession(response);
  }

  function signOut(): void {
    localStorage.removeItem(storageKey);
    setSession(null);
  }

  if (session) return <Workspace accessToken={session.accessToken} user={session.user} onSignOut={signOut} theme={theme} onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} />;

  return (
    <main className="landing-shell">
      <header className="landing-header"><a className="brand" href="/"><span className="brand-mark">+</span> CrisisGrid</a><div className="landing-actions"><button type="button" className="theme-toggle" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>{theme === 'dark' ? '☀ Light' : '◐ Dark'}</button><span className={`connection-state connection-state--${health}`}><i />{health === 'online' ? 'Local API connected' : health === 'offline' ? 'API unavailable' : 'Checking local API'}</span></div></header>
      <div className="landing-grid">
        <section className="hero-copy" aria-labelledby="app-title">
          <p className="eyebrow">DISASTER COORDINATION · LOCAL PROTOTYPE</p>
          <h1 id="app-title">Clarity when <em>every minute</em> matters.</h1>
          <p className="hero-description">A secure local workspace for reporting needs, locating eligible resources, and coordinating emergency response with accountable data.</p>
          <div className="capability-row"><span><b>01</b> Verified roles</span><span><b>02</b> PostGIS ready</span><span><b>03</b> Auditable actions</span></div>
          <aside className="emergency-notice" aria-label="Emergency notice"><span>!</span><p><strong>For development only.</strong> CrisisGrid does not contact emergency services. In an emergency, use your location's official emergency contact method.</p></aside>
        </section>
        <AuthPage onAuthenticated={onAuthenticated} />
      </div>
      <footer>Localhost only <span>•</span> Fictional data <span>•</span> No live integrations</footer>
    </main>
  );
}

export function App(): JSX.Element {
  return <BrowserRouter><Routes><Route path="*" element={<AppContent />} /></Routes></BrowserRouter>;
}

