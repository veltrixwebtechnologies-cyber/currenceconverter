import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const subscriptionId = searchParams.get('subscription_id');
  const paymentId = searchParams.get('payment_id');
  const rawStatus = searchParams.get('status');
  const email = searchParams.get('email') || clerkUser?.email;

  const statusParam = rawStatus?.toLowerCase();
  const validStatuses = ['succeeded', 'completed', 'active', 'paid', 'success'];
  const isExplicitNonSuccess = !!statusParam && !validStatuses.includes(statusParam);
  const isPending = statusParam === 'pending';

  const [checking, setChecking] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const [confettiItems] = useState(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 2}s`,
      color: ['#7c6efa', '#22d3ee', '#a78bfa', '#34d399', '#f59e0b'][Math.floor(Math.random() * 5)],
      size: `${6 + Math.random() * 8}px`,
    }))
  );

  useEffect(() => {
    if (isPro) return;

    let active = true;

    const confirmAndPoll = async () => {
      if (!active) return;
      setChecking(true);

      // Attempt automatic payment confirmation ONLY if status is valid / not explicitly non-successful
      if (clerkUser?.uid && !isExplicitNonSuccess) {
        try {
          await fetch(`${API_BASE}/subscription/confirm-payment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${clerkUser.uid}`
            },
            body: JSON.stringify({
              paymentId,
              subscriptionId,
              status: rawStatus,
              email
            })
          });
        } catch (err) {
          console.warn('[PaymentSuccessPage] Direct payment confirmation attempt error:', err);
        }
      }

      // Check premium status
      const isUpgraded = await refetchPremium();
      setChecking(false);
      setAttempts((prev) => prev + 1);

      if (!isUpgraded && active && attempts < 5 && !isExplicitNonSuccess) {
        setTimeout(confirmAndPoll, 3000);
      }
    };

    confirmAndPoll();

    return () => {
      active = false;
    };
  }, [isPro, clerkUser, location.search, isExplicitNonSuccess]);

  const handleManualCheck = async () => {
    setChecking(true);
    await refetchPremium();
    setChecking(false);
  };

  const getStatusIcon = () => {
    if (isPro) return '🎉';
    if (isPending) return '⏳';
    if (isExplicitNonSuccess) return '❌';
    return '⚡';
  };

  const getEyebrow = () => {
    if (isPro) return 'Purchase Confirmed';
    if (isPending) return 'Payment Processing';
    if (isExplicitNonSuccess) return 'Payment Unconfirmed';
    return 'Verifying Subscription';
  };

  const getHeading = () => {
    if (isPro) return <>Welcome to <span className="grad">HoverConvert Pro!</span></>;
    if (isPending) return <>Payment <span className="grad">Pending...</span></>;
    if (isExplicitNonSuccess) return <>Payment <span className="grad">Not Completed</span></>;
    return <>Setting Up Your <span className="grad">Pro Access...</span></>;
  };

  const getDescription = () => {
    if (isPro) {
      return 'Your account has been upgraded successfully. You now have full access to HoverConvert Pro! Log in to the extension with the same account to enjoy unlimited conversions.';
    }
    if (isPending) {
      return 'Your payment is currently being processed by the payment provider. Your Pro subscription will activate automatically as soon as payment is confirmed.';
    }
    if (isExplicitNonSuccess) {
      return `Your payment was not completed (Status: ${rawStatus || 'unconfirmed'}). Pro access is reserved exclusively for paid members.`;
    }
    return 'Your payment details were received. Verifying your transaction with the payment gateway...';
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
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: isExplicitNonSuccess && !isPending ? 'rgba(239,68,68,0.1)' : 'linear-gradient(135deg, rgba(124,110,250,0.2), rgba(34,211,238,0.2))', border: isExplicitNonSuccess && !isPending ? '2px solid rgba(239,68,68,0.4)' : '2px solid rgba(124,110,250,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: '36px' }}>
          {getStatusIcon()}
        </div>

        <div className="sec-eyebrow" style={{ marginBottom: '12px', color: isExplicitNonSuccess && !isPending ? '#ef4444' : undefined }}>
          {getEyebrow()}
        </div>
        <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 800, marginBottom: '16px', lineHeight: 1.2 }}>
          {getHeading()}
        </h1>

        <p style={{ fontSize: '16px', color: 'var(--tx2)', lineHeight: 1.7, marginBottom: '32px' }}>
          {getDescription()}
        </p>

        {/* Status indicator */}
        <div style={{ 
          padding: '20px', 
          borderRadius: '16px', 
          background: isPro ? 'rgba(52,211,153,0.05)' : isExplicitNonSuccess && !isPending ? 'rgba(239,68,68,0.05)' : 'rgba(124,110,250,0.05)', 
          border: isPro ? '1px solid rgba(52,211,153,0.2)' : isExplicitNonSuccess && !isPending ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(124,110,250,0.2)', 
          marginBottom: '32px', 
          textAlign: 'left' 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: isPro ? 'var(--gr)' : isExplicitNonSuccess && !isPending ? '#ef4444' : 'var(--cy)' }}>
              {isPro 
                ? '✓ Pro Subscription Active' 
                : isPending 
                  ? '⏳ Status: Payment Pending' 
                  : isExplicitNonSuccess 
                    ? `❌ Status: Payment ${rawStatus ? rawStatus.toUpperCase() : 'Unconfirmed'}` 
                    : '⚡ Status: Verifying...'}
            </span>
            {!isPro && !isExplicitNonSuccess && (
              <span style={{ fontSize: '12px', color: 'var(--tx3)' }}>
                Attempt {attempts}/5
              </span>
            )}
          </div>
          
          <div style={{ fontSize: '13px', color: 'var(--tx2)' }}>
            User ID: <code style={{ color: 'var(--tx)', background: 'var(--bg2)', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace' }}>{clerkUser?.uid || 'Not signed in'}</code>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {isPro ? (
            <button
              onClick={() => navigate('/')}
              className="btn-p"
              style={{ padding: '14px 32px', fontSize: '16px', borderRadius: '12px', width: '100%' }}
            >
              ⚡ Go to Home Page
            </button>
          ) : isExplicitNonSuccess && !isPending ? (
            <>
              <button
                onClick={() => navigate('/pricing')}
                className="btn-p"
                style={{ padding: '14px 32px', fontSize: '16px', borderRadius: '12px', width: '100%' }}
              >
                ⚡ Return to Pricing
              </button>
              <button
                onClick={() => navigate('/')}
                className="btn-s"
                style={{ padding: '12px 32px', fontSize: '14px', borderRadius: '12px', width: '100%', background: 'transparent', border: '1px solid var(--bdr)' }}
              >
                Go to Home Page
              </button>
            </>
          ) : (
            <button
              onClick={handleManualCheck}
              disabled={checking}
              className="btn-p"
              style={{ padding: '14px 32px', fontSize: '16px', borderRadius: '12px', width: '100%', opacity: checking ? 0.7 : 1 }}
            >
              {checking ? 'Checking Status...' : '🔄 Re-check Payment Status'}
            </button>
          )}
        </div>

        <p style={{ marginTop: '24px', fontSize: '12px', color: 'var(--tx3)' }}>
          If you run into issues, please try logging out and logging back in to refresh your session.
        </p>
      </div>
    </div>
  );
}

export default PaymentSuccessPage;
