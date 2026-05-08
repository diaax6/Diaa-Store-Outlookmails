'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, LogIn, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error || 'Wrong password'); return; }
      router.push('/app');
      router.refresh();
    } catch { setError('Connection error'); } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="animate-in" style={{ width: '100%', maxWidth: 400 }}>
        <div className="glass-card" style={{ padding: '36px 32px', textAlign: 'center' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 28 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Mail style={{ width: 24, height: 24, color: '#ef4444' }} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: '#ef4444', letterSpacing: '0.05em' }}>DIAA STORE</h1>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', letterSpacing: '0.1em' }}>OUTLOOK MAIL</p>
            </div>
          </div>

          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 20, letterSpacing: '0.05em' }}>ENTER PASSWORD</h2>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
              borderRadius: 10, fontSize: 13, color: '#ef4444', marginBottom: 16,
            }}>
              <AlertCircle style={{ width: 16, height: 16 }} /> {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input className="app-input" type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password" required autoComplete="current-password"
              style={{ textAlign: 'center', borderColor: 'rgba(239,68,68,0.15)' }} />

            <button type="submit" disabled={loading || !password} style={{
              width: '100%', padding: '14px 0', border: 'none', borderRadius: 12,
              background: 'linear-gradient(135deg, #ef4444, #f97316)', color: 'white',
              fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: loading || !password ? 0.4 : 1, transition: 'all 0.2s',
              boxShadow: '0 4px 16px rgba(239,68,68,0.25)',
            }}>
              <LogIn style={{ width: 18, height: 18 }} />
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
