import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function EURToINRPage({ rates }: { rates: Record<string, number> }) {
  const navigate = useNavigate();
  const [amount, setAmount] = useState<number>(100);
  const eurRate = rates.EUR || 0.92;
  const inrRate = rates.INR || 85.02;
  const currentRate = inrRate / eurRate;

  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'faq-schema-eur-inr';
    script.innerHTML = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is the live exchange rate for EUR to INR?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": `The live exchange rate is 1 EUR = ₹ ${currentRate.toFixed(2)} INR. Exchange rates fluctuate based on market conditions.`
          }
        },
        {
          "@type": "Question",
          "name": "How does HoverConvert help with EUR to INR conversion?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "HoverConvert is a browser extension that lets you hover over any EUR price on any webpage and view the converted value in INR instantly, without leaving the page."
          }
        }
      ]
    });
    document.head.appendChild(script);
    return () => {
      const existing = document.getElementById('faq-schema-eur-inr');
      if (existing) existing.remove();
    };
  }, [currentRate]);

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
          <div className="pill">⚡ Real-Time Exchange Rates</div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 700, marginBottom: '16px', lineHeight: 1.2 }}>
            EUR to INR Converter – Live Euro to Indian Rupee Exchange Rate
          </h1>
          <p style={{ color: 'var(--tx2)', fontSize: '16px', maxWidth: '700px' }}>
            Convert Euros (EUR) to Indian Rupees (INR) instantly using our live currency calculator. Monitor real-time market rates and download our browser extension for automatic conversions on the fly.
          </p>
        </div>

        {/* Calculator Widget */}
        <div className="dashboard-card" style={{ padding: '30px', background: 'var(--bg2)', border: '1px solid var(--br2)', borderRadius: '16px', marginBottom: '40px' }}>
          <h3 style={{ marginBottom: '20px', fontFamily: 'Space Grotesk' }}>Interactive EUR to INR Calculator</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--tx2)', marginBottom: '8px' }}>Euro (EUR)</label>
              <input 
                type="number" 
                value={amount} 
                onChange={(e) => setAmount(Number(e.target.value))}
                style={{ width: '100%', padding: '12px', background: 'var(--bg3)', border: '1px solid var(--br)', borderRadius: '8px', color: '#fff', fontSize: '16px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--tx2)', marginBottom: '8px' }}>Indian Rupee (INR)</label>
              <input 
                type="text" 
                value={`₹ ${Number(converted).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} 
                readOnly
                style={{ width: '100%', padding: '12px', background: 'var(--bg4)', border: '1px solid var(--br)', borderRadius: '8px', color: 'var(--cy)', fontSize: '16px', fontWeight: 'bold' }}
              />
            </div>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--tx3)' }}>
            Live rate: <strong>1 EUR = ₹ {currentRate.toFixed(4)} INR</strong>. Updated in real-time.
          </div>
        </div>

        {/* Content & Examples */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '40px', marginBottom: '50px' }}>
          <div style={{ textAlign: 'left' }}>
            <h2 style={{ fontFamily: 'Space Grotesk', fontSize: '24px', marginBottom: '16px' }}>EUR to INR Conversion Table</h2>
            <p style={{ color: 'var(--tx2)', fontSize: '14px', marginBottom: '20px' }}>
              Here are some of the most common Euro to Indian Rupee conversion values at the current exchange rate:
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--br)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 8px', color: 'var(--tx2)', fontSize: '13px' }}>Euro (EUR)</th>
                  <th style={{ padding: '12px 8px', color: 'var(--tx2)', fontSize: '13px' }}>Indian Rupee (INR)</th>
                </tr>
              </thead>
              <tbody>
                {[1, 5, 10, 50, 100, 500, 1000].map((val) => (
                  <tr key={val} style={{ borderBottom: '1px solid var(--br)' }}>
                    <td style={{ padding: '12px 8px', fontSize: '14px' }}>€{val} EUR</td>
                    <td style={{ padding: '12px 8px', fontSize: '14px', color: 'var(--cy)', fontWeight: 'bold' }}>₹ {(val * currentRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} INR</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2 style={{ fontFamily: 'Space Grotesk', fontSize: '24px', marginBottom: '16px' }}>Why Choose HoverConvert for EUR to INR?</h2>
            <p style={{ color: 'var(--tx2)', fontSize: '14px', marginBottom: '16px', lineHeight: 1.6 }}>
              Instead of manually copying and pasting values into search engines or converting tables, <strong>HoverConvert</strong> detects price selectors dynamically. With our browser extension, you can view foreign currency conversions directly on websites like Amazon, eBay, Airbnb, and global blogs.
            </p>
          </div>

          <div style={{ textAlign: 'left' }}>
            <div className="dashboard-card" style={{ padding: '20px', background: 'rgba(124, 110, 250, 0.05)', border: '1px solid rgba(124, 110, 250, 0.2)', borderRadius: '12px', marginBottom: '30px' }}>
              <h4 style={{ fontFamily: 'Space Grotesk', marginBottom: '10px' }}>Popular Conversions</h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                <li><a onClick={() => navigate('/usd-to-inr')} style={{ color: 'var(--cy)', cursor: 'pointer', textDecoration: 'underline' }}>USD to INR Converter</a></li>
                <li><a onClick={() => navigate('/gbp-to-inr')} style={{ color: 'var(--cy)', cursor: 'pointer', textDecoration: 'underline' }}>GBP to INR Converter</a></li>
                <li><a onClick={() => navigate('/currency-converter')} style={{ color: 'var(--cy)', cursor: 'pointer', textDecoration: 'underline' }}>Free Currency Converter</a></li>
                <li><a onClick={() => navigate('/live-exchange-rates')} style={{ color: 'var(--cy)', cursor: 'pointer', textDecoration: 'underline' }}>Live Exchange Rates</a></li>
              </ul>
            </div>

            <div className="dashboard-card" style={{ padding: '20px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--br)', borderRadius: '12px' }}>
              <h4 style={{ fontFamily: 'Space Grotesk', marginBottom: '10px' }}>Convert on Hover</h4>
              <p style={{ fontSize: '12px', color: 'var(--tx2)', marginBottom: '14px' }}>
                Want to convert currencies automatically while you browse without clicking? Try the HoverConvert Chrome extension.
              </p>
              <button onClick={() => navigate('/')} className="nav-cta" style={{ width: '100%', padding: '10px' }}>
                ⚡ Try Extension
              </button>
            </div>
          </div>
        </div>

        {/* FAQs */}
        <div style={{ borderTop: '1px solid var(--br)', paddingTop: '40px', marginBottom: '60px', textAlign: 'left' }}>
          <h2 style={{ fontFamily: 'Space Grotesk', fontSize: '24px', marginBottom: '24px' }}>Frequently Asked Questions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>How accurate is this EUR to INR calculator?</h4>
              <p style={{ fontSize: '13px', color: 'var(--tx2)' }}>
                Our currency converter fetches official exchange rates from major global banking APIs multiple times a day. While it is highly accurate, it is intended for informational purposes and should not be used as a final reference for international bank transfers or commercial trading.
              </p>
            </div>
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>What is the current live EUR to INR exchange rate?</h4>
              <p style={{ fontSize: '13px', color: 'var(--tx2)' }}>
                The current exchange rate is 1 EUR = ₹ {currentRate.toFixed(2)} INR. Exchange rates vary based on real-time market liquidity and macroeconomic factors.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default EURToINRPage;
