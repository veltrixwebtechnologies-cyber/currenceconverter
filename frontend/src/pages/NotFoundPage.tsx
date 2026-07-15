import { useNavigate } from 'react-router-dom';

function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <section className="hero" style={{ minHeight: '80vh', padding: '120px 20px 80px' }}>
      <div className="hero-glow-l"></div>
      <div className="hero-glow-r"></div>
      <div className="hero-grid"></div>
      <div style={{ position: 'relative', zIndex: 10, maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{
          fontSize: '120px',
          fontWeight: '900',
          lineHeight: '1',
          background: 'linear-gradient(130deg, var(--vi2) 0%, var(--cy) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: '20px',
          fontFamily: 'Space Grotesk, sans-serif',
          letterSpacing: '-5px'
        }}>
          404
        </div>
        <h2 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '16px', color: 'var(--tx)', fontFamily: 'Space Grotesk, sans-serif' }}>
          Page Not Found
        </h2>
        <p style={{ fontSize: '16px', color: 'var(--tx2)', marginBottom: '32px', lineHeight: '1.6' }}>
          The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
          Use the links below to navigate back to safety.
        </p>
        <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/')} className="btn-p">
            ⚡ Back to Home
          </button>
          <button onClick={() => navigate('/currency-converter')} className="btn-g">
            🧮 Currency Converter
          </button>
          <button onClick={() => navigate('/live-exchange-rates')} className="btn-g">
            📈 Live Exchange Rates
          </button>
        </div>
      </div>
    </section>
  );
}

export default NotFoundPage;
