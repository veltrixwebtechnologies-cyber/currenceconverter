import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../types';

function PaymentSuccessPage({
  isPro,
  refetchPremium,
  clerkUser
}: {
  isPro: boolean;
  refetchPremium: () => Promise<boolean>;
  clerkUser: any;
}) {
  const navigate = useNavigate();
  const [confettiItems] = useState(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 2}s`,
      color: ['#7c6efa', '#22d3ee', '#a78bfa', '#34d399', '#f59e0b'][Math.floor(Math.random() * 5)],
      size: `${6 + Math.random() * 8}px`,
    }))
  );

  const [checking, setChecking] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [manualSuccess, setManualSuccess] = useState(false);

  useEffect(() => {
    if (isPro) return;

    let active = true;
    let timer: any;

    const poll = async () => {
      if (!active) return;
      setChecking(true);
      const isUpgraded = await refetchPremium();
      setChecking(false);
      setAttempts((prev) => prev + 1);

      if (!isUpgraded && active && attempts < 10) {
        timer = setTimeout(poll, 3000);
      }
    };

    timer = setTimeout(poll, 2500);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isPro, refetchPremium, attempts]);

  const handleManualCheck = async () => {
    setChecking(true);
    await refetchPremium();
    setChecking(false);
  };

  const handleManualActivate = async () => {
    if (!clerkUser?.id) return;
    setChecking(true);
    try {
      const email = clerkUser.primaryEmailAddress?.emailAddress || '';
      const res = await fetch(`${API_BASE}/debug/make-pro?userId=${clerkUser.id}&email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (data.success) {
        setManualSuccess(true);
        await refetchPremium();
      }
    } catch (err) {
      console.error('Manual activation failed:', err);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', paddingTop: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>

      {/* Confetti animation (only show if active Pro) */}
      {isPro && (
        <>
          <style>{`
            @keyframes confetti-fall {
              0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
              100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
            }
          `}</style>
          {confettiItems.map((item) => (
            <div
              key={item.id}
              style={{
                position: 'fixed', top: '-20px', left: item.left,
                width: item.size, height: item.size,
                background: item.color, borderRadius: '2px',
                animation: `confetti-fall 3s ${item.delay} ease-in forwards`,
                pointerEvents: 'none', zIndex: 0,
              }}
            />
          ))}
        </>
      )}

      <div style={{ maxWidth: '520px', width: '100%', padding: '24px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(124,110,250,0.2), rgba(34,211,238,0.2))', border: '2px solid rgba(124,110,250,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: '36px' }}>
          {isPro ? '🎉' : '⏳'}
        </div>

        <div className="sec-eyebrow" style={{ marginBottom: '12px' }}>
          {isPro ? 'Purchase Confirmed' : 'Verifying Subscription'}
        </div>
        <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 800, marginBottom: '16px', lineHeight: 1.2 }}>
          {isPro ? (
            <>Welcome to <span className="grad">HoverConvert Pro!</span></>
          ) : (
            <>Setting Up Your <span className="grad">Pro Access...</span></>
          )}
        </h1>

        <p style={{ fontSize: '16px', color: 'var(--tx2)', lineHeight: 1.7, marginBottom: '32px' }}>
          {isPro 
            ? 'Your account has been upgraded successfully. You now have lifetime access to HoverConvert Pro! Log in to the extension with the same account to get unlimited conversions.'
            : 'Your payment was successful! We are syncing with the payment provider to activate your premium features. This usually takes around 5-10 seconds.'
          }
        </p>

        {/* Status indicator */}
        <div style={{ padding: '20px', borderRadius: '16px', background: isPro ? 'rgba(52,211,153,0.05)' : 'rgba(124,110,250,0.05)', border: isPro ? '1px solid rgba(52,211,153,0.2)' : '1px solid rgba(124,110,250,0.2)', marginBottom: '32px', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: isPro ? 'var(--gr)' : 'var(--cy)' }}>
              {isPro ? '✓ Pro Subscription Active' : '⚡ Status: Activating...'}
            </span>
            {!isPro && (
              <span style={{ fontSize: '12px', color: 'var(--tx3)' }}>
                Attempt {attempts}/10
              </span>
            )}
          </div>
          
          <div style={{ fontSize: '13px', color: 'var(--tx2)' }}>
            User ID: <code style={{ color: 'var(--tx)', background: 'var(--bg2)', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace' }}>{clerkUser?.id || 'Not signed in'}</code>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {isPro ? (
            <>
              <button
                onClick={() => navigate('/')}
                className="btn-p"
                style={{ padding: '14px 32px', fontSize: '16px', borderRadius: '12px', width: '100%' }}
              >
                ⚡ Go to Home Page
              </button>
              <button
                onClick={() => navigate('/dev-dashboard')}
                style={{ padding: '12px 32px', fontSize: '14px', borderRadius: '12px', width: '100%', background: 'transparent', border: '1px solid var(--br)', color: 'var(--tx2)', cursor: 'pointer' }}
              >
                📊 Open Developer Dashboard
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleManualCheck}
                disabled={checking}
                className="btn-p"
                style={{ padding: '14px 32px', fontSize: '16px', borderRadius: '12px', width: '100%', opacity: checking ? 0.7 : 1 }}
              >
                {checking ? 'Checking Status...' : '🔄 Sync Purchase Status'}
              </button>
              
              {clerkUser?.id && (
                <button
                  onClick={handleManualActivate}
                  disabled={checking || manualSuccess}
                  style={{ 
                    padding: '12px 32px', 
                    fontSize: '14px', 
                    borderRadius: '12px', 
                    width: '100%', 
                    background: 'rgba(34,211,238,0.1)', 
                    border: '1px dashed var(--cy)', 
                    color: 'var(--cy)', 
                    cursor: 'pointer',
                    marginTop: '8px'
                  }}
                >
                  🚀 (Test Mode) Manually Activate Pro Instantly
                </button>
              )}
            </>
          )}
        </div>

        <p style={{ marginTop: '24px', fontSize: '12px', color: 'var(--tx3)' }}>
          If you run into issues, please try logging out and logging back in to force-refresh your Clerk session.
        </p>
      </div>
    </div>
  );
}

export default PaymentSuccessPage;
