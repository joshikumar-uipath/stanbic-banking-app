import { useState } from 'react';
import type { FormEvent } from 'react';
import AdminShell, { fieldLabel, fieldInput, primaryButton, errorBanner } from './AdminShell';
import { adminLogin } from '../lib/adminAuth';

export default function AdminLogin({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (adminLogin(username, password)) {
      onLoggedIn();
    } else {
      setError('Invalid credentials.');
    }
  };

  return (
    <AdminShell title="Sign in" subtitle="Demo admin gate — sign in with admin / admin.">
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={fieldLabel} htmlFor="al-user">Username</label>
          <input
            id="al-user"
            className="admin-input"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={fieldInput}
          />
        </div>
        <div>
          <label style={fieldLabel} htmlFor="al-pass">Password</label>
          <input
            id="al-pass"
            className="admin-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={fieldInput}
          />
        </div>
        {error && <div style={errorBanner}>{error}</div>}
        <button type="submit" style={primaryButton}>Continue</button>
      </form>
    </AdminShell>
  );
}
