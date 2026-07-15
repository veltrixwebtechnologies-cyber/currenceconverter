import { useNavigate } from 'react-router-dom';

function PaymentFailedPage() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: '100vh', paddingTop: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ maxWidth: '520px', width: '100%', padding: '24px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(245,158,11,0.2))', border: '2px solid rgba(239,68,68,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: '36px' }}>
          ✕
        </div>

        <div className="sec-eyebrow" style={{ marginBottom: '12px', color: 'var(--er)' }}>
          Payment Cancelled or Failed
        </div>
        <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 800, marginBottom: '16px', lineHeight: 1.2 }}>
          Let's get your <span className="grad" style={{ background: 'linear-gradient(135deg, #ef4444, #f59e0b)' }}>Pro Access back on track</span>
        </h1>

        <p style={{ fontSize: '16px', color: 'var(--tx2)', lineHeight: 1.7, marginBottom: '32px' }}>
          The payment checkout session was cancelled or failed to complete. Don't worry—your card was not charged. If you ran into transaction errors, please check your card limits or attempt payment again.
        </p>

        {/* Troubleshooting Checklist */}
        <div style={{ padding: '20px', borderRadius: '16px', background: 'rgba(239,68,68,0.03)', border: '1px solid rgba(239,68,68,0.15)', marginBottom: '32px', textAlign: 'left' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700, color: 'var(--tx)' }}>💡 Troubleshooting Tips:</h4>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--tx2)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li>Make sure international/online transactions are enabled on your card.</li>
            <li>Verify you have sufficient funds or credit limit.</li>
            <li>Ensure billing details entered on checkout match your card address.</li>
            <li>Try checking out with a different credit/debit card.</li>
          </ul>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={() => navigate('/pricing')}
            className="btn-p"
            style={{ padding: '14px 32px', fontSize: '16px', borderRadius: '12px', width: '100%', background: 'linear-gradient(135deg, #ef4444, #f59e0b)', border: 'none' }}
          >
            🔄 Try Checkout Again
          </button>
          <button
            onClick={() => navigate('/support')}
            style={{ padding: '12px 32px', fontSize: '14px', borderRadius: '12px', width: '100%', background: 'transparent', border: '1px solid var(--br)', color: 'var(--tx2)', cursor: 'pointer' }}
          >
            💬 Contact Support
          </button>
        </div>
      </div>
    </div>
  );
}

export default PaymentFailedPage;
