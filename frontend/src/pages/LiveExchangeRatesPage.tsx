import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function LiveExchangeRatesPage({ rates }: { rates: Record<string, number> }) {
  const navigate = useNavigate();
  const [filterQuery, setFilterQuery] = useState<string>('');
  const supportedList = Object.entries(rates);

  const filteredRates = supportedList.filter(([code]) => 
    code.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <section className="seo-page" style={{ paddingTop: '100px', minHeight: '80vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 20px' }}>
        <div style={{ marginBottom: '20px' }}>
          <a onClick={() => navigate('/')} style={{ color: 'var(--cy)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            ← Back to Home
          </a>
        </div>
        
        <div className="seo-hero" style={{ marginBottom: '40px' }}>
          <div className="pill">📈 Global FX Market</div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 700, marginBottom: '16px', lineHeight: 1.2 }}>
            Live Exchange Rates – Real-Time Global Currency FX Rates Board
          </h1>
          <p style={{ color: 'var(--tx2)', fontSize: '16px', maxWidth: '700px' }}>
            Monitor the latest live foreign exchange market conversions. Search, filter, and track exchange rates relative to USD in real-time.
          </p>
        </div>

        {/* Filter Input */}
        <div style={{ marginBottom: '20px' }}>
          <input 
            type="text"
            placeholder="Search currency code (e.g. INR, EUR, JPY)..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            style={{ width: '100%', padding: '12px 16px', background: 'var(--bg2)', border: '1px solid var(--br)', borderRadius: '8px', color: '#fff', fontSize: '15px' }}
          />
        </div>

        {/* Grid Display */}
        <div className="dashboard-card" style={{ padding: '24px', background: 'var(--bg2)', border: '1px solid var(--br2)', borderRadius: '16px', marginBottom: '40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            {filteredRates.length > 0 ? (
              filteredRates.map(([code, rate]) => (
                <div key={code} style={{ padding: '16px', background: 'var(--bg3)', borderRadius: '8px', border: '1px solid var(--br)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--tx3)', fontWeight: 'bold' }}>CURRENCY PAIR</span>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--tx)' }}>USD / {code}</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--cy)' }}>
                    {rate.toFixed(4)}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--success)' }}>● Real-time Feed</span>
                </div>
              ))
            ) : (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--tx3)' }}>
                No matching currencies found.
              </div>
            )}
          </div>
        </div>

        {/* Internal Linking & Call-To-Action */}
        <div className="dashboard-card" style={{ padding: '30px', background: 'linear-gradient(135deg, rgba(124, 110, 250, 0.1) 0%, rgba(34, 211, 238, 0.05) 100%)', border: '1px solid rgba(124, 110, 250, 0.25)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
          <h3 style={{ fontFamily: 'Space Grotesk' }}>Never manually calculate exchange rates again</h3>
          <p style={{ fontSize: '14px', color: 'var(--tx2)', maxWidth: '500px' }}>
            Install the free HoverConvert Chrome extension to convert all foreign price lists and checkout items automatically while browsing.
          </p>
          <button onClick={() => navigate('/')} className="nav-cta" style={{ padding: '12px 24px' }}>
            ⚡ Get HoverConvert Now
          </button>
        </div>
      </div>
    </section>
  );
}

export default LiveExchangeRatesPage;
