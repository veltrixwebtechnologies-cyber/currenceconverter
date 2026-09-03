import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../types';

interface AdminQueriesPageProps {
  navigate: (to: string) => void;
  clerkUser: any;
  clerkGetToken: (() => Promise<string | null>) | null;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

function AdminQueriesPage({ clerkUser, clerkGetToken, showToast }: Omit<AdminQueriesPageProps, 'navigate'>) {
  const navigate = useNavigate();
  const [passcode, setPasscode] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('hc_admin_authenticated') === 'true');
  const [queries, setQueries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');

  const isAdminEmail = !!(
    clerkUser?.email &&
    (clerkUser.email.includes('sudhan') ||
      clerkUser.email.includes('admin'))
  );

  const authenticated = isAuthenticated || isAdminEmail;

  const fetchQueries = useCallback(async () => {
    setIsLoading(true);
    const key = localStorage.getItem('hc_admin_key') || passcode;
    
    // Set headers
    const headers: Record<string, string> = {};
    if (clerkGetToken) {
      try {
        const token = await clerkGetToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      } catch (e) {
        console.warn('Clerk token acquisition failed', e);
      }
    }

    try {
      const url = `${API_BASE}/feedback?adminKey=${encodeURIComponent(key || '')}`;
      const response = await fetch(url, { headers });
      const data = await response.json();
      
      if (data.success) {
        setQueries(data.feedback || []);
        setIsAuthenticated(true);
        localStorage.setItem('hc_admin_authenticated', 'true');
        if (key) {
          localStorage.setItem('hc_admin_key', key);
        }
      } else {
        // Only trigger error toast if user manually entered passcode and it failed
        if (passcode) {
          showToast(data.message || 'Unauthorized admin access', 'error');
        }
        setIsAuthenticated(false);
        localStorage.removeItem('hc_admin_authenticated');
        localStorage.removeItem('hc_admin_key');
      }
    } catch (e) {
      showToast('Error connecting to admin API', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [passcode, clerkGetToken, showToast]);

  useEffect(() => {
    if (authenticated) {
      fetchQueries();
    }
  }, [authenticated, fetchQueries]);

  const handleResolve = async (id: string) => {
    const key = localStorage.getItem('hc_admin_key');
    const headers: Record<string, string> = {};
    if (clerkGetToken) {
      try {
        const token = await clerkGetToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      } catch (e) {}
    }

    try {
      const response = await fetch(`${API_BASE}/feedback/${id}?adminKey=${encodeURIComponent(key || '')}`, {
        method: 'DELETE',
        headers
      });
      const data = await response.json();
      if (data.success) {
        showToast('Ticket marked as resolved!', 'success');
        setQueries(prev => prev.filter(q => q.id !== id));
      } else {
        showToast(data.message || 'Failed to delete query', 'error');
      }
    } catch (e) {
      showToast('Network error resolving query', 'error');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setQueries([]);
    localStorage.removeItem('hc_admin_authenticated');
    localStorage.removeItem('hc_admin_key');
    showToast('Logged out of admin session.', 'info');
  };

  const filtered = queries.filter(q => 
    (q.email || '').toLowerCase().includes(search.toLowerCase()) || 
    (q.message || '').toLowerCase().includes(search.toLowerCase())
  );

  const proCount = queries.filter(q => q.isPro).length;

  if (!authenticated) {
    return (
      <section className="seo-page" style={{ paddingTop: '120px', minHeight: '80vh', background: 'var(--bg)', display: 'flex', alignItems: 'center' }}>
        <div style={{ maxWidth: '400px', margin: '0 auto', padding: '30px', background: 'var(--bg2)', border: '1px solid var(--br2)', borderRadius: '16px', width: '100%' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center', fontFamily: 'Space Grotesk' }}>Admin Portal</h3>
          <p style={{ fontSize: '13px', color: 'var(--tx2)', marginBottom: '24px', textAlign: 'center' }}>Enter passcode to view user support queries.</p>
          <form onSubmit={(e) => { e.preventDefault(); fetchQueries(); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input 
              type="password"
              placeholder="Admin passcode..."
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', background: 'var(--bg3)', border: '1px solid var(--br)', borderRadius: '8px', color: '#fff', textAlign: 'center', fontSize: '15px' }}
            />
            <button type="submit" className="primary-btn" style={{ padding: '12px', background: 'var(--vi)', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
              Login as Admin
            </button>
            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <a onClick={() => navigate('/')} style={{ fontSize: '12px', color: 'var(--tx3)', cursor: 'pointer' }}>Return to home</a>
            </div>
          </form>
        </div>
      </section>
    );
  }

  return (
    <section className="seo-page" style={{ paddingTop: '100px', minHeight: '80vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <div>
            <a onClick={() => navigate('/')} style={{ color: 'var(--cy)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              ← Back to Home
            </a>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginTop: '10px', fontFamily: 'Space Grotesk' }}>
              Admin Queries Dashboard
            </h1>
          </div>
          <button onClick={handleLogout} className="nav-secondary-btn" style={{ padding: '8px 16px', fontSize: '12px' }}>
            Disconnect
          </button>
        </div>

        {/* Stats Row */}
        <div className="dev-dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
          <div className="dashboard-card" style={{ padding: '20px', background: 'var(--bg2)', border: '1px solid var(--br)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--tx3)', fontWeight: 'bold' }}>TOTAL TICKETS</span>
            <span style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--tx)' }}>{queries.length}</span>
          </div>
          <div className="dashboard-card" style={{ padding: '20px', background: 'var(--bg2)', border: '1px solid var(--br)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--tx3)', fontWeight: 'bold' }}>PRO USER TICKETS</span>
            <span style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--vi2)' }}>{proCount}</span>
          </div>
          <div className="dashboard-card" style={{ padding: '20px', background: 'var(--bg2)', border: '1px solid var(--br)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--tx3)', fontWeight: 'bold' }}>UNRESOLVED</span>
            <span style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--warning)' }}>{queries.length}</span>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center' }}>
          <input 
            type="text"
            placeholder="Search queries by sender email or content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, padding: '12px 16px', background: 'var(--bg2)', border: '1px solid var(--br)', borderRadius: '8px', color: '#fff', fontSize: '14px' }}
          />
          <button onClick={fetchQueries} className="nav-secondary-btn" disabled={isLoading} style={{ padding: '12px 20px', fontSize: '14px', whiteSpace: 'nowrap' }}>
            {isLoading ? 'Syncing...' : '🔄 Refresh'}
          </button>
        </div>

        {/* Queries List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filtered.length > 0 ? (
            filtered.map((query) => (
              <div 
                key={query.id} 
                className="dashboard-card" 
                style={{ 
                  padding: '24px', 
                  background: 'var(--bg2)', 
                  border: query.isPro ? '1px solid var(--vi)' : '1px solid var(--br)', 
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  transition: 'all 0.3s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontWeight: 'bold', color: 'var(--tx)', fontSize: '15px' }}>{query.email}</span>
                      {query.isPro && (
                        <span style={{ fontSize: '10px', color: '#fff', background: 'var(--vi)', padding: '2px 8px', borderRadius: '100px', fontWeight: 'bold' }}>
                          ★ PRO USER
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--tx3)' }}>
                      Submitted: {new Date(query.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <button 
                    onClick={() => handleResolve(query.id)}
                    className="nav-cta"
                    style={{ background: 'var(--success)', padding: '6px 14px', fontSize: '12px' }}
                  >
                    ✓ Resolve & Close
                  </button>
                </div>
                
                <div style={{ 
                  background: 'var(--bg3)', 
                  border: '1px solid var(--br)', 
                  borderRadius: '8px', 
                  padding: '16px', 
                  color: 'var(--tx2)', 
                  fontSize: '14px',
                  whiteSpace: 'pre-wrap',
                  lineHeight: '1.5'
                }}>
                  {query.message}
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg2)', border: '1px solid var(--br)', borderRadius: '12px', color: 'var(--tx3)' }}>
              {isLoading ? 'Fetching tickets...' : 'No queries found. All caught up! 🎉'}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default AdminQueriesPage;
