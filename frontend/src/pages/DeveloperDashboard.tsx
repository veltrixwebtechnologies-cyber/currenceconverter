import type { License } from '../types';

interface DevDashboardProps {
  isPro: boolean;
  licenseInfo: License | null;
  setShowSupportModal: (show: boolean) => void;
}

function DeveloperDashboard({ isPro, licenseInfo, setShowSupportModal }: DevDashboardProps) {
  if (!isPro) {
    return (
      <div className="dashboard-layout" style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '12px' }}>
        <h2>Access Restricted</h2>
        <p style={{ color: 'var(--tx2)' }}>The Developer Dashboard is reserved for Pro license holders.</p>
      </div>
    );
  }

  const chartData = [
    { label: 'Mon', val: 140 },
    { label: 'Tue', val: 210 },
    { label: 'Wed', val: 190 },
    { label: 'Thu', val: 340 },
    { label: 'Fri', val: 280 },
    { label: 'Sat', val: 120 },
    { label: 'Sun', val: 95 }
  ];

  return (
    <div className="dashboard-layout" style={{ display: 'block', padding: '100px max(20px, calc(50vw - 620px)) 60px' }}>
      <div style={{ textAlign: 'left', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 'bold' }}>Developer & license Management</h2>
        <p style={{ color: 'var(--tx2)', fontSize: '14px' }}>
          Welcome back! Manage your HoverConvert installations, configure API keys, and download custom configuration profiles.
        </p>
      </div>

      <div className="dev-dashboard-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Analytics Chart */}
          <div className="dashboard-card">
            <h3 className="card-title">
              Weekly Conversion Volume
              <span style={{ fontSize: '11px', color: 'var(--cy)', background: 'rgba(34,211,238,0.1)', padding: '3px 8px', borderRadius: '4px' }}>
                Synced Local Cache
              </span>
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--tx2)', marginTop: '-8px', marginBottom: '16px' }}>
              Number of hover conversion tooltips rendered inside your browser per day.
            </p>

            <div className="mock-chart-container">
              {chartData.map((d, i) => (
                <div key={i} className="chart-bar-group">
                  <div
                    className="chart-bar"
                    style={{ height: `${(d.val / 380) * 100}%` }}
                    data-value={d.val}
                  ></div>
                  <span className="chart-label">{d.label}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--tx3)', marginTop: '14px' }}>
              <span>Total Detections: 1,375</span>
              <span>Avg Latency: 32ms</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* License Status */}
          <div className="dashboard-card license-info-card">
            <h3 className="card-title">License Status</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--tx3)' }}>REGISTERED EMAIL</span>
                <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{licenseInfo?.email || 'N/A'}</div>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: 'var(--tx3)' }}>LICENSE KEY</span>
                <div className="license-key-display">
                  <span>{licenseInfo?.licenseKey || 'N/A'}</span>
                  <button
                    onClick={() => {
                      if (licenseInfo?.licenseKey) {
                        navigator.clipboard.writeText(licenseInfo.licenseKey);
                        alert('Copied to clipboard!');
                      }
                    }}
                    className="copy-btn"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--br)', paddingTop: '12px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--tx3)' }}>STATUS</span>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    ● Active (3 Months)
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--tx3)' }}>TYPE</span>
                  <div style={{ fontSize: '12px', fontWeight: 'bold' }}>Developer Pro</div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Support */}
          <div className="dashboard-card">
            <h3 className="card-title">Pro Support</h3>
            <p style={{ fontSize: '12px', color: 'var(--tx2)', marginBottom: '14px' }}>
              As a Pro user, your feedback and tickets are fast-tracked. Reach out directly.
            </p>
            <button onClick={() => setShowSupportModal(true)} className="secondary-btn" style={{ width: '100%' }}>
              💬 Open Priority Ticket
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DeveloperDashboard;
