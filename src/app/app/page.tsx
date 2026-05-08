'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mail, Users, Plus, Search, Download, Trash2, X, Copy, Check,
  ChevronLeft, ChevronRight, Key, User as UserIcon, ArrowLeft,
  RefreshCw, Eye, EyeOff, LogOut
} from 'lucide-react';

interface EmailAccount {
  id: string;
  email: string;
  status: string;
  health_score: number;
}

interface MailMessage {
  id: string;
  sender: string;
  subject: string;
  body_preview: string;
  body?: string;
  raw_body?: string;
  received_at: string;
  has_otp: boolean;
}

interface OTPResult {
  code: string;
  code_type: string;
  status: string;
}

export default function AppPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [otpResults, setOtpResults] = useState<OTPResult[]>([]);
  const [fetching, setFetching] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [senderFilter, setSenderFilter] = useState('');
  const [mailCount, setMailCount] = useState('10');
  const [copiedCode, setCopiedCode] = useState('');
  const [usedAccounts, setUsedAccounts] = useState<Set<string>>(new Set());
  const [openMessage, setOpenMessage] = useState<MailMessage | null>(null);
  const [credentials, setCredentials] = useState<{email: string; password: string} | null>(null);
  const [showCreds, setShowCreds] = useState(false);
  const [loadingCreds, setLoadingCreds] = useState(false);

  const currentAccount = currentIndex >= 0 ? accounts[currentIndex] : null;
  const topOTP = otpResults[0];

  useEffect(() => {
    // Verify session (IP-bound)
    fetch('/api/auth/login').then(r => r.json()).then(d => {
      if (d.success) { setAuthenticated(true); setAuthChecked(true); fetchAccounts(); }
      else { setAuthChecked(true); router.push('/login'); }
    }).catch(() => { setAuthChecked(true); router.push('/login'); });
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/login', { method: 'DELETE' });
    router.push('/login');
  };

  const copyEmail = () => {
    if (!currentAccount) return;
    navigator.clipboard.writeText(currentAccount.email);
    setCopiedCode('email');
    setTimeout(() => setCopiedCode(''), 2000);
  };

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/accounts');
      const json = await res.json();
      if (json.success && json.data) {
        const active = json.data.filter((a: EmailAccount) => a.status === 'active');
        setAccounts(active);
        // Restore saved index from localStorage
        const savedIdx = parseInt(localStorage.getItem('ds_currentIndex') || '-1');
        if (active.length > 0) {
          if (savedIdx >= 0 && savedIdx < active.length) setCurrentIndex(savedIdx);
          else if (currentIndex === -1) setCurrentIndex(0);
        }
        // Restore used accounts
        try {
          const savedUsed = localStorage.getItem('ds_usedAccounts');
          if (savedUsed) setUsedAccounts(new Set(JSON.parse(savedUsed)));
        } catch {}
      }
    } catch (err) { console.error(err); }
  };

  const goNext = useCallback(() => {
    if (currentIndex < accounts.length - 1) {
      const next = currentIndex + 1;
      setCurrentIndex(next);
      localStorage.setItem('ds_currentIndex', String(next));
      setMessages([]);
      setOtpResults([]);
    }
  }, [currentIndex, accounts.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      const prev = currentIndex - 1;
      setCurrentIndex(prev);
      localStorage.setItem('ds_currentIndex', String(prev));
      setMessages([]);
      setOtpResults([]);
    }
  }, [currentIndex]);

  const selectAccount = (idx: number) => {
    setCurrentIndex(idx);
    localStorage.setItem('ds_currentIndex', String(idx));
    setMessages([]);
    setOtpResults([]);
    setCredentials(null);
    setShowCreds(false);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goPrev(); }
      if (e.key === 'Enter' && currentAccount) { e.preventDefault(); fetchMail(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, currentAccount]);

  const fetchMail = async () => {
    if (!currentAccount) return;
    setFetching(true);
    try {
      const res = await fetch('/api/mail/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: currentAccount.id, count: parseInt(mailCount) }),
      });
      const data = await res.json();
      if (data.data?.messages) setMessages(data.data.messages);
      if (data.data?.otps) setOtpResults(data.data.otps);
      setUsedAccounts(prev => { const n = new Set([...prev, currentAccount.id]); localStorage.setItem('ds_usedAccounts', JSON.stringify([...n])); return n; });
    } finally { setFetching(false); }
  };

  const fetchAndNext = async () => {
    if (currentIndex < accounts.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      localStorage.setItem('ds_currentIndex', String(nextIdx));
      setMessages([]);
      setOtpResults([]);
      setCredentials(null);
      setShowCreds(false);
      // Auto-fetch next account
      const nextAcc = accounts[nextIdx];
      if (nextAcc) {
        setFetching(true);
        try {
          const res = await fetch('/api/mail/fetch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ account_id: nextAcc.id, count: parseInt(mailCount) }),
          });
          const data = await res.json();
          if (data.data?.messages) setMessages(data.data.messages);
          if (data.data?.otps) setOtpResults(data.data.otps);
          setUsedAccounts(prev => { const n = new Set([...prev, nextAcc.id]); localStorage.setItem('ds_usedAccounts', JSON.stringify([...n])); return n; });
        } finally { setFetching(false); }
      }
    }
  };

  const fetchCredentials = async () => {
    if (!currentAccount) return;
    if (credentials) { setShowCreds(!showCreds); return; }
    setLoadingCreds(true);
    try {
      const res = await fetch(`/api/accounts/${currentAccount.id}/credentials`);
      const data = await res.json();
      if (data.success) { setCredentials(data.data); setShowCreds(true); }
    } finally { setLoadingCreds(false); }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  // Extract OTP from message text
  const extractOTP = (text: string): string | null => {
    const patterns = [
      /(?:code|otp|pin|verification|verify|confirm|security)\s*(?:is|:)?\s*(\d{4,8})/i,
      /(\d{4,8})\s*(?:is your|is the)\s*(?:code|otp|pin|verification)/i,
      /(?:enter|use)\s*(?:code|otp)?\s*:?\s*(\d{4,8})/i,
      /\b(\d{6})\b/,
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m?.[1]) return m[1];
    }
    return null;
  };

  const handleImport = async () => {
    if (!importText.trim()) return;
    setImporting(true);
    try {
      const lines = importText.trim().split('\n').filter(Boolean);
      const items = lines.map(line => {
        const parts = line.split(/[-]{2,}/);
        return { email: parts[0]?.trim() || '', password: parts[1]?.trim() || '', client_id: parts[2]?.trim() || '', refresh_token: parts[3]?.trim() || '', valid: parts.length >= 4 };
      }).filter(i => i.valid);
      await fetch('/api/accounts/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accounts: items }) });
      setShowImport(false);
      setImportText('');
      await fetchAccounts();
    } finally { setImporting(false); }
  };

  const clearAll = () => { setAccounts([]); setCurrentIndex(-1); setMessages([]); setOtpResults([]); setUsedAccounts(new Set()); localStorage.removeItem('ds_currentIndex'); localStorage.removeItem('ds_usedAccounts'); };

  const toggleUsed = (accountId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setUsedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      localStorage.setItem('ds_usedAccounts', JSON.stringify([...next]));
      return next;
    });
  };

  const filteredMessages = messages.filter(m => {
    const ms = !searchQuery || m.subject?.toLowerCase().includes(searchQuery.toLowerCase()) || m.body_preview?.toLowerCase().includes(searchQuery.toLowerCase());
    const mf = !senderFilter || m.sender?.toLowerCase().includes(senderFilter.toLowerCase());
    return ms && mf;
  });


  if (!authChecked) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: '#64748b' }}>Loading...</p></div>;
  if (!authenticated) return null;

  return (
    <div style={{ minHeight: '100vh', padding: '20px 24px', maxWidth: 1480, margin: '0 auto' }}>
      {/* ═══ HEADER ═══ */}
      <div className="glass-card" style={{ padding: '14px 24px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Mail style={{ width: 22, height: 22, color: '#ef4444' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 900, color: '#ef4444', letterSpacing: '0.04em' }}>DIAA STORE</h1>
            <p style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Outlook Mail Fetcher</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 100, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.15)' }}>
            <div style={{ width: 7, height: 7, background: '#10b981', borderRadius: '50%', boxShadow: '0 0 8px rgba(16,185,129,0.5)' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>Ready</span>
          </div>
          <button onClick={handleLogout} title="Logout" style={{ padding: '6px 14px', borderRadius: 100, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', transition: 'all 0.15s' }}>
            <LogOut style={{ width: 14, height: 14, color: '#ef4444' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>Logout</span>
          </button>
        </div>
      </div>

      {/* ═══ MAIN ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, minHeight: 'calc(100vh - 120px)' }}>

        {/* LEFT PANEL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="glass-card" style={{ padding: 0, display: 'flex', flexDirection: 'column', flex: 1 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users style={{ width: 16, height: 16, color: '#94a3b8' }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>Mailbox List</span>
              </div>
              <span style={{ padding: '2px 10px', borderRadius: 100, fontSize: 12, fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)' }}>{accounts.length}</span>
            </div>

            {/* Import */}
            <div style={{ padding: '10px 14px 0' }}>
              <button onClick={() => setShowImport(true)} style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #ef4444, #f97316)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 4px 12px rgba(239,68,68,0.2)' }}>
                <Plus style={{ width: 16, height: 16 }} /> Batch Import
              </button>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', maxHeight: 'calc(100vh - 380px)' }}>
              {accounts.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 250 }}>
                  <Mail style={{ width: 40, height: 40, color: '#334155', marginBottom: 10 }} />
                  <p style={{ fontSize: 13, color: '#64748b' }}>No mailboxes</p>
                  <p style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>Click import above</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {accounts.map((acc, idx) => {
                    const isActive = idx === currentIndex;
                    const isUsed = usedAccounts.has(acc.id);
                    return (
                      <button key={acc.id} onClick={() => selectAccount(idx)} style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 12px', borderRadius: 9, textAlign: 'left',
                        background: isActive ? 'rgba(239,68,68,0.08)' : 'transparent',
                        border: isActive ? '1px solid rgba(239,68,68,0.15)' : '1px solid transparent',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                        <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, background: isActive ? '#ef4444' : 'transparent', border: isActive ? '2px solid #ef4444' : '2px solid #475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {isActive && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
                        </div>
                        <span style={{ flex: 1, fontSize: 12, color: isActive ? '#ef4444' : '#94a3b8', fontWeight: isActive ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.email}</span>
                        {isUsed && (
                          <span onClick={(e) => toggleUsed(acc.id, e)} title="Click to unmark" style={{ padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: 'rgba(239,68,68,0.1)', color: '#ef4444', letterSpacing: '0.05em', cursor: 'pointer', transition: 'all 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.15)'; e.currentTarget.style.color = '#10b981'; e.currentTarget.textContent = '✕ UNDO'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.textContent = 'USED'; }}
                          >USED</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              <button onClick={clearAll} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.05)', background: 'transparent', color: '#64748b', fontSize: 12, cursor: 'pointer' }}>
                <Trash2 style={{ width: 12, height: 12 }} /> Clear All
              </button>
            </div>
          </div>

          {/* ═══ NAVIGATION ═══ */}
          <div className="glass-card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <button onClick={goPrev} disabled={currentIndex <= 0} style={{ width: 42, height: 42, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: currentIndex > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${currentIndex > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)'}`, color: currentIndex > 0 ? '#ef4444' : '#475569', cursor: currentIndex > 0 ? 'pointer' : 'not-allowed' }}>
                <ChevronLeft style={{ width: 20, height: 20 }} />
              </button>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#e2e8f0' }}>
                  {currentIndex >= 0 ? currentIndex + 1 : '—'} <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>/ {accounts.length}</span>
                </div>
              </div>
              <button onClick={goNext} disabled={currentIndex >= accounts.length - 1} style={{ width: 42, height: 42, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: currentIndex < accounts.length - 1 ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${currentIndex < accounts.length - 1 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)'}`, color: currentIndex < accounts.length - 1 ? '#ef4444' : '#475569', cursor: currentIndex < accounts.length - 1 ? 'pointer' : 'not-allowed' }}>
                <ChevronRight style={{ width: 20, height: 20 }} />
              </button>
            </div>
          </div>
        </div>

        {/* ═══ RIGHT PANEL ═══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
          {/* Account Bar — ALWAYS visible */}
          {currentAccount && (
            <>
              <div className="glass-card" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg, #ef4444, #f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(239,68,68,0.2)', flexShrink: 0 }}>
                  <UserIcon style={{ width: 20, height: 20, color: 'white' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentAccount.email}</p>
                  <p style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>Account #{currentIndex + 1} of {accounts.length}</p>
                </div>
                <button onClick={copyEmail} title="Copy email" style={{ padding: '6px 14px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', background: copiedCode === 'email' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, transition: 'all 0.15s' }}>
                  {copiedCode === 'email' ? <Check style={{ width: 13, height: 13, color: '#10b981' }} /> : <Copy style={{ width: 13, height: 13, color: '#94a3b8' }} />}
                  <span style={{ fontSize: 12, fontWeight: 700, color: copiedCode === 'email' ? '#10b981' : '#94a3b8' }}>{copiedCode === 'email' ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              {/* Action Buttons — separate row, aligned right */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0, minHeight: 36 }}>
                <button onClick={fetchCredentials} title="Show credentials" style={{ width: 36, height: 36, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: showCreds ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.04)', border: showCreds ? '1px solid rgba(168,85,247,0.2)' : '1px solid rgba(255,255,255,0.06)', transition: 'all 0.15s' }}>
                  {loadingCreds ? <RefreshCw style={{ width: 15, height: 15, color: '#a855f7', animation: 'spin 1s linear infinite' }} /> : showCreds ? <EyeOff style={{ width: 15, height: 15, color: '#a855f7' }} /> : <Eye style={{ width: 15, height: 15, color: '#94a3b8' }} />}
                </button>
                <button onClick={fetchMail} disabled={fetching} title="Refresh" style={{ width: 36, height: 36, borderRadius: 9, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: fetching ? 0.4 : 1 }}>
                  <RefreshCw style={{ width: 15, height: 15, color: '#94a3b8', animation: fetching ? 'spin 1s linear infinite' : 'none' }} />
                </button>
                <button onClick={fetchMail} disabled={fetching} style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #059669, #10b981)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 3px 10px rgba(16,185,129,0.2)', opacity: fetching ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                  <Download style={{ width: 14, height: 14 }} /> {fetching ? 'Loading...' : 'Show'}
                </button>
                <button onClick={fetchAndNext} disabled={fetching || currentIndex >= accounts.length - 1} style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #ef4444, #f97316)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 3px 10px rgba(239,68,68,0.2)', opacity: fetching || currentIndex >= accounts.length - 1 ? 0.4 : 1, whiteSpace: 'nowrap' }}>
                  <ChevronRight style={{ width: 14, height: 14 }} /> Next Mail
                </button>
              </div>
            </>
          )}

          {/* Credentials Panel */}
          {showCreds && credentials && (
            <div className="glass-card animate-in" style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12, borderColor: 'rgba(168,85,247,0.12)' }}>
              <Eye style={{ width: 16, height: 16, color: '#a855f7', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 16 }}>
                <div>
                  <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>EMAIL</span>
                  <p style={{ fontSize: 13, color: '#e2e8f0', fontFamily: 'monospace' }}>{credentials.email}</p>
                </div>
                <div>
                  <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>PASSWORD</span>
                  <p style={{ fontSize: 13, color: '#e2e8f0', fontFamily: 'monospace' }}>{credentials.password}</p>
                </div>
              </div>
              <button onClick={() => { navigator.clipboard.writeText(`${credentials.email}:${credentials.password}`); setCopiedCode('creds'); setTimeout(() => setCopiedCode(''), 2000); }} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: copiedCode === 'creds' ? 'rgba(16,185,129,0.15)' : 'rgba(168,85,247,0.1)', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                {copiedCode === 'creds' ? <Check style={{ width: 14, height: 14, color: '#10b981' }} /> : <Copy style={{ width: 14, height: 14, color: '#a855f7' }} />}
                <span style={{ fontSize: 12, fontWeight: 700, color: copiedCode === 'creds' ? '#10b981' : '#a855f7' }}>{copiedCode === 'creds' ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          )}


          {/* Search Bar */}
          <div className="glass-card" style={{ padding: '14px 18px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#64748b' }} />
                <input className="app-input" placeholder="Search (Subject/Body)" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ paddingLeft: 36 }} />
              </div>
              <div style={{ width: 180, position: 'relative' }}>
                <UserIcon style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#64748b' }} />
                <input className="app-input" placeholder="Sender filter" value={senderFilter} onChange={e => setSenderFilter(e.target.value)} style={{ paddingLeft: 36 }} />
              </div>
              <select value={mailCount} onChange={e => setMailCount(e.target.value)} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.04)', fontSize: 13, color: '#e2e8f0', cursor: 'pointer', outline: 'none' }}>
                {[5, 10, 20, 50].map(n => <option key={n} value={n}>{n} mails</option>)}
              </select>
            </div>
          </div>

          {/* Messages */}
          <div className="glass-card" style={{ flex: 1, padding: 0, minHeight: 0, background: 'rgba(10,14,26,0.5)', overflowY: 'auto' }}>
            {filteredMessages.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 300 }}>
                <Mail style={{ width: 48, height: 48, color: '#1e293b', marginBottom: 12 }} />
                <p style={{ fontSize: 14, color: '#64748b' }}>{accounts.length === 0 ? 'Import mailboxes to start' : 'Select an account and click Fetch'}</p>
              </div>
            ) : (
              <div>
                {filteredMessages.map((msg, i) => {
                  const otp = msg.has_otp ? extractOTP((msg.subject || '') + ' ' + (msg.body_preview || '')) : null;
                  return (
                    <div key={msg.id || i} onClick={() => setOpenMessage(msg)} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 18px', borderBottom: i < filteredMessages.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none', transition: 'background 0.15s', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.03)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: msg.has_otp ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {msg.has_otp ? <Key style={{ width: 16, height: 16, color: '#ef4444' }} /> : <Mail style={{ width: 16, height: 16, color: '#475569' }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{msg.sender}</span>
                          {msg.has_otp && <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>OTP</span>}
                        </div>
                        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{msg.subject}</p>
                        <p style={{ fontSize: 11, color: '#64748b', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.body_preview}</p>
                      </div>
                      {otp ? (
                        <button onClick={(e) => { e.stopPropagation(); copyCode(otp); }} style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                          borderRadius: 8, border: 'none', cursor: 'pointer', flexShrink: 0,
                          background: copiedCode === otp ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)',
                          transition: 'all 0.2s',
                        }}>
                          <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'monospace', color: copiedCode === otp ? '#10b981' : '#ef4444', letterSpacing: '0.1em' }}>{otp}</span>
                          {copiedCode === otp
                            ? <Check style={{ width: 14, height: 14, color: '#10b981' }} />
                            : <Copy style={{ width: 14, height: 14, color: '#ef4444' }} />
                          }
                        </button>
                      ) : (
                        <span style={{ fontSize: 10, color: '#475569', whiteSpace: 'nowrap', marginTop: 2 }}>{new Date(msg.received_at).toLocaleTimeString()}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ MESSAGE DETAIL MODAL ═══ */}
      {openMessage && (() => {
        const fullText = (openMessage.subject || '') + ' ' + (openMessage.body_preview || '') + ' ' + (openMessage.raw_body || openMessage.body || '');
        const msgOtp = extractOTP(fullText);
        const htmlBody = openMessage.raw_body || openMessage.body || '';
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setOpenMessage(null)}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} />
            <div className="animate-in" onClick={e => e.stopPropagation()} style={{ position: 'relative', width: '100%', maxWidth: 640, maxHeight: '80vh', background: 'rgba(15,20,35,0.95)', borderRadius: 16, border: '1px solid rgba(239,68,68,0.1)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }}>
              {/* Header */}
              <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <button onClick={() => setOpenMessage(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>
                    <ArrowLeft style={{ width: 16, height: 16 }} /> Back
                  </button>
                  <span style={{ fontSize: 11, color: '#475569' }}>{new Date(openMessage.received_at).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: openMessage.has_otp ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {openMessage.has_otp ? <Key style={{ width: 18, height: 18, color: '#ef4444' }} /> : <Mail style={{ width: 18, height: 18, color: '#64748b' }} />}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{openMessage.sender}</p>
                    <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>{openMessage.subject}</p>
                  </div>
                </div>
                {/* Copy OTP button */}
                {msgOtp && (
                  <button onClick={() => copyCode(msgOtp)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '12px 18px', borderRadius: 10, cursor: 'pointer',
                    background: copiedCode === msgOtp ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.08)',
                    border: copiedCode === msgOtp ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(239,68,68,0.15)',
                    transition: 'all 0.2s',
                  }}>
                    <Key style={{ width: 18, height: 18, color: copiedCode === msgOtp ? '#10b981' : '#ef4444' }} />
                    <span style={{ fontSize: 22, fontWeight: 900, fontFamily: 'monospace', color: copiedCode === msgOtp ? '#10b981' : '#ef4444', letterSpacing: '0.15em' }}>{msgOtp}</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, background: copiedCode === msgOtp ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)' }}>
                      {copiedCode === msgOtp ? <Check style={{ width: 14, height: 14, color: '#10b981' }} /> : <Copy style={{ width: 14, height: 14, color: '#ef4444' }} />}
                      <span style={{ fontSize: 12, fontWeight: 700, color: copiedCode === msgOtp ? '#10b981' : '#ef4444' }}>{copiedCode === msgOtp ? 'Copied!' : 'Copy OTP'}</span>
                    </div>
                  </button>
                )}
              </div>
              {/* Body — rendered as original HTML */}
              <div style={{ flex: 1, overflow: 'hidden' }}>
                {htmlBody ? (
                  <iframe
                    srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:20px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#1a1a1a;background:transparent;line-height:1.6;word-break:break-word}img{max-width:100%;height:auto}a{color:#2563eb}table{max-width:100%!important}*{max-width:100%!important;box-sizing:border-box}</style></head><body>${htmlBody}</body></html>`}
                    style={{ width: '100%', height: '100%', border: 'none', borderRadius: '0 0 16px 16px', background: 'white', minHeight: 300 }}
                    sandbox="allow-same-origin"
                    title="Email content"
                  />
                ) : (
                  <div style={{ padding: '20px 24px' }}>
                    <p style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {openMessage.body_preview}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══ IMPORT MODAL ═══ */}
      {showImport && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setShowImport(false)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }} />
          <div className="animate-in" onClick={e => e.stopPropagation()} style={{ position: 'relative', width: '100%', maxWidth: 540, background: 'rgba(15,20,35,0.95)', borderRadius: 16, padding: 28, border: '1px solid rgba(239,68,68,0.1)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: '#e2e8f0' }}>Batch Import</h2>
              <button onClick={() => setShowImport(false)} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X style={{ width: 16, height: 16, color: '#94a3b8' }} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 14 }}>Format: <span style={{ color: '#ef4444', fontWeight: 600 }}>email----password----clientid----refresh_token</span></p>
            <textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder={'user@outlook.com----pass----clientid----token'} rows={7}
              style={{ width: '100%', padding: 14, borderRadius: 10, border: '1px solid rgba(239,68,68,0.1)', background: 'rgba(255,255,255,0.03)', fontSize: 12, fontFamily: 'monospace', color: '#e2e8f0', outline: 'none', resize: 'vertical', lineHeight: 1.6 }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button onClick={() => setShowImport(false)} style={{ padding: '9px 20px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', color: '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleImport} disabled={importing || !importText.trim()} style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #ef4444, #f97316)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: !importText.trim() ? 0.4 : 1 }}>
                <Plus style={{ width: 14, height: 14 }} /> {importing ? 'Importing...' : 'Confirm Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
