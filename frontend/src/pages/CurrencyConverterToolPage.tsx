import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function CurrencyConverterToolPage({ rates }: { rates: Record<string, number> }) {
  const navigate = useNavigate();
  const [amount, setAmount] = useState<number>(100);
  const [fromCurr, setFromCurr] = useState<string>('USD');
  const [toCurr, setToCurr] = useState<string>('INR');

  const supportedList = Object.keys(rates).length > 0 ? Object.keys(rates) : ['USD', 'INR', 'EUR', 'GBP', 'JPY', 'AUD'];

  const fromRate = rates[fromCurr] || 1;
  const toRate = rates[toCurr] || 1;
  const currentRate = toRate / fromRate;
  const converted = (amount * currentRate).toFixed(2);

  return (
    <section className="seo-page" style={{ paddingTop: '100px', minHeight: '80vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 20px' }}>
        <div style={{ marginBottom: '20px' }}>
          <a onClick={() => navigate('/')} style={{ color: 'var(--cy)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            ← Back to Home
          </a>
        </div>
        
        <div className="seo-hero" style={{ marginBottom: '40px' }}>
          <div className="pill">⚡ Universal Calculator</div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 700, marginBottom: '16px', lineHeight: 1.2 }}>
            Instant Currency Converter – Real-Time Foreign Exchange Calculator
          </h1>
          <p style={{ color: 'var(--tx2)', fontSize: '16px', maxWidth: '700px' }}>
            Convert any currency instantly using our interactive calculator. Supports over 160 currencies globally with ultra-low latency updates.
          </p>
        </div>

        {/* Calculator Widget */}
        <div className="dashboard-card" style={{ padding: '30px', background: 'var(--bg2)', border: '1px solid var(--br2)', borderRadius: '16px', marginBottom: '40px' }}>
          <h3 style={{ marginBottom: '20px', fontFamily: 'Space Grotesk' }}>Interactive Multi-Currency Calculator</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--tx2)', marginBottom: '8px' }}>From Currency</label>
              <select 
                value={fromCurr} 
                onChange={(e) => setFromCurr(e.target.value)}
                style={{ width: '100%', padding: '12px', background: 'var(--bg3)', border: '1px solid var(--br)', borderRadius: '8px', color: '#fff', fontSize: '16px', marginBottom: '12px' }}
              >
                {supportedList.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input 
                type="number" 
                value={amount} 
                onChange={(e) => setAmount(Number(e.target.value))}
                style={{ width: '100%', padding: '12px', background: 'var(--bg3)', border: '1px solid var(--br)', borderRadius: '8px', color: '#fff', fontSize: '16px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--tx2)', marginBottom: '8px' }}>To Currency</label>
              <select 
                value={toCurr} 
                onChange={(e) => setToCurr(e.target.value)}
                style={{ width: '100%', padding: '12px', background: 'var(--bg3)', border: '1px solid var(--br)', borderRadius: '8px', color: '#fff', fontSize: '16px', marginBottom: '12px' }}
              >
                {supportedList.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input 
                type="text" 
                value={`${converted} ${toCurr}`} 
                readOnly
                style={{ width: '100%', padding: '12px', background: 'var(--bg4)', border: '1px solid var(--br)', borderRadius: '8px', color: 'var(--cy)', fontSize: '16px', fontWeight: 'bold' }}
              />
            </div>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--tx3)' }}>
            Live rate: <strong>1 {fromCurr} = {currentRate.toFixed(4)} {toCurr}</strong>. Updated in real-time.
          </div>
        </div>

        {/* Content Section */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '40px', marginBottom: '50px' }}>
          <div style={{ textAlign: 'left' }}>
            <h2 style={{ fontFamily: 'Space Grotesk', fontSize: '24px', marginBottom: '16px' }}>Supported Conversion Path Quicklinks</h2>
            <p style={{ color: 'var(--tx2)', fontSize: '14px', marginBottom: '20px' }}>
              Access direct calculations for popular pairs immediately to view charts and conversion grids:
            </p>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <li>
                <a onClick={() => navigate('/usd-to-inr')} style={{ color: 'var(--cy)', cursor: 'pointer', textDecoration: 'underline', fontSize: '14px' }}>
                  🇺🇸 USD to 🇮🇳 INR Converter (US Dollar to Indian Rupee)
                </a>
              </li>
              <li>
                <a onClick={() => navigate('/eur-to-inr')} style={{ color: 'var(--cy)', cursor: 'pointer', textDecoration: 'underline', fontSize: '14px' }}>
                  🇪🇺 EUR to 🇮🇳 INR Converter (Euro to Indian Rupee)
                </a>
              </li>
              <li>
                <a onClick={() => navigate('/gbp-to-inr')} style={{ color: 'var(--cy)', cursor: 'pointer', textDecoration: 'underline', fontSize: '14px' }}>
                  🇬🇧 GBP to 🇮🇳 INR Converter (British Pound to Indian Rupee)
                </a>
              </li>
            </ul>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div className="dashboard-card" style={{ padding: '20px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--br)', borderRadius: '12px' }}>
              <h4 style={{ fontFamily: 'Space Grotesk', marginBottom: '10px' }}>Compare Real-Time Live Rates</h4>
              <p style={{ fontSize: '12px', color: 'var(--tx2)', marginBottom: '14px' }}>
                Need to view all currency fluctuations at once? Check our real-time exchange rate table.
              </p>
              <button onClick={() => navigate('/live-exchange-rates')} className="nav-secondary-btn" style={{ width: '100%' }}>
                📈 View Rate Board
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default CurrencyConverterToolPage;
