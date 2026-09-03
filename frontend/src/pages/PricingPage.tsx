import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../types';
import { GoogleAuthButton, GoogleIcon } from '../components/GoogleAuthButton';

interface PricingPageProps {
  isPro: boolean;
  clerkIsSignedIn: boolean;
  clerkIsLoaded: boolean;
  clerkUser: any;
  clerkGetToken: (() => Promise<string | null>) | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  clerkEnabled: boolean;
}

function PricingPage({ isPro, clerkIsSignedIn, clerkIsLoaded: _clerkIsLoaded, clerkUser, clerkGetToken, showToast, clerkEnabled }: PricingPageProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleUpgrade = async () => {
    if (!clerkIsSignedIn) {
      // Not logged in — prompt sign in
      showToast('Please sign in first to upgrade to Pro.', 'info');
      return;
    }

    const email = clerkUser?.email;
    if (!email) {
      showToast('Could not retrieve your email. Please try again.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (clerkGetToken) {
        const token = await clerkGetToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE}/create-checkout`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email })
      });

      const data = await res.json() as { success: boolean; checkoutUrl?: string; message?: string };
      if (data.success && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        showToast(data.message || 'Failed to start checkout. Please try again.', 'error');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      showToast('Network error. Please check your connection and try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', paddingTop: '80px', paddingBottom: '80px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 24px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <div className="sec-eyebrow" style={{ marginBottom: '12px' }}>Simple Pricing</div>
          <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 800, lineHeight: 1.15, marginBottom: '16px' }}>
            Choose Your Plan
          </h1>
          <p style={{ fontSize: '17px', color: 'var(--tx2)', maxWidth: '480px', margin: '0 auto' }}>
            Start free. Upgrade to Pro for 3 months access. No subscriptions, no surprises.
          </p>
        </div>

        {/* Plan Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', alignItems: 'start' }}>
          {/* Free Plan */}
          <div className="pcard" style={{ padding: '32px', borderRadius: '20px', background: 'var(--bg2)', border: '1px solid var(--br)' }}>
            <div className="pname" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--tx2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Free Plan</div>
            <div className="pprice" style={{ fontSize: '42px', fontWeight: 800, fontFamily: 'Space Grotesk', marginBottom: '4px' }}>$0</div>
            <div className="pterm" style={{ fontSize: '13px', color: 'var(--tx3)', marginBottom: '28px' }}>Forever free · No account needed</div>
            <ul className="pfeat" style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
              {[
                '50 conversions / day',
                'Top currencies',
                'Hover tooltips',
                'Works on all websites',
              ].map((f) => <li key={f} style={{ display: 'flex', gap: '8px', fontSize: '14px' }}><span style={{ color: '#22d3ee' }}>✓</span> {f}</li>)}
              {[
                'Unlimited conversions',
                'Dark mode & glass UI',
                '160+ currencies',
                'Favorite currencies',
              ].map((f) => <li key={f} className="no" style={{ display: 'flex', gap: '8px', fontSize: '14px', color: 'var(--tx3)', textDecoration: 'line-through' }}><span>✕</span> {f}</li>)}
            </ul>
            {isPro ? (
              <div style={{ textAlign: 'center', padding: '13px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--br)', color: 'var(--tx3)', fontWeight: 600, fontSize: '15px' }}>
                Previous Plan
              </div>
            ) : (
              <button
                className="pbtn pbtn-f"
                onClick={() => navigate('/currency-converter')}
                style={{ width: '100%', padding: '13px', borderRadius: '12px', background: 'transparent', border: '1px solid var(--br)', color: 'var(--tx2)', cursor: 'pointer', fontWeight: 600, fontSize: '15px' }}
              >
                Use Free Calculator
              </button>
            )}
          </div>

          {/* Pro Plan */}
          <div className="pcard hot" style={{ padding: '32px', borderRadius: '20px', background: 'linear-gradient(135deg, rgba(124,110,250,0.12), rgba(34,211,238,0.08))', border: '1px solid rgba(124,110,250,0.4)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, var(--vi), var(--cy))' }}></div>
            <div className="pbadge" style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, background: 'linear-gradient(90deg, var(--vi), var(--cy))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>⭐ Best Value · Most Popular</div>
            <div className="pname" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--tx)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Pro (3 Months)</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
              <div className="pprice" style={{ fontSize: '42px', fontWeight: 800, fontFamily: 'Space Grotesk' }}>$4.99</div>
              <span style={{ fontSize: '13px', color: 'var(--tx3)' }}>/ 3 months</span>
            </div>
            <div className="pterm" style={{ fontSize: '13px', color: 'var(--tx3)', marginBottom: '28px' }}>3-Month access · Pay once, no automatic renewal</div>
            <ul className="pfeat" style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
              {[
                'Unlimited conversions',
                '160+ currencies',
                'Premium dark & glass UI',
                'Manual rate override',
                'Favorite currencies (unlimited)',
                'Priority email support',
                '30-day money-back guarantee',
              ].map((f) => <li key={f} style={{ display: 'flex', gap: '8px', fontSize: '14px' }}><span style={{ color: '#22d3ee' }}>✓</span> {f}</li>)}
            </ul>

            {isPro ? (
              <div style={{ textAlign: 'center', padding: '13px', borderRadius: '12px', background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)', color: 'var(--cy)', fontWeight: 700, fontSize: '15px' }}>
                ✓ Current Plan (3 Months Active)
              </div>
            ) : !clerkEnabled ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  className="pbtn pbtn-p"
                  onClick={() => showToast('Clerk authentication is not configured. Please set VITE_CLERK_PUBLISHABLE_KEY in your environment to sign in.', 'error')}
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--vi), var(--cy))', border: 'none', color: '#fff', fontWeight: 700, fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <GoogleIcon />
                  <span>Continue with Google to Upgrade — $4.99</span>
                </button>
                <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--tx3)' }}>
                  You need to sign in first so we can link your purchase to your account.
                </p>
              </div>
            ) : !clerkIsSignedIn ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <GoogleAuthButton
                  className="pbtn pbtn-p"
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--vi), var(--cy))', border: 'none', color: '#fff', fontWeight: 700, fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  forceRedirectUrl="/pricing"
                  label="Continue with Google to Upgrade — $4.99"
                />
                <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--tx3)' }}>
                  You need to sign in first so we can link your purchase to your account.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  className="pbtn pbtn-p"
                  onClick={handleUpgrade}
                  disabled={isLoading}
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', background: isLoading ? 'rgba(124,110,250,0.4)' : 'linear-gradient(135deg, var(--vi), var(--cy))', border: 'none', color: '#fff', fontWeight: 700, fontSize: '16px', cursor: isLoading ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
                >
                  {isLoading ? '⏳ Redirecting to checkout...' : '⚡ Upgrade to Pro — $4.99'}
                </button>
                <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--tx3)' }}>
                  🔒 Secure payment via Dodo Payments · Instant activation
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Trust badges */}
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '24px', marginTop: '48px', padding: '24px', borderRadius: '16px', background: 'var(--bg2)', border: '1px solid var(--br)' }}>
          {['🔒 256-bit SSL encryption', '💳 Secure payment via Dodo', '↩️ 30-day money-back guarantee', '⚡ Instant activation'].map((badge) => (
            <span key={badge} style={{ fontSize: '13px', color: 'var(--tx2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {badge}
            </span>
          ))}
        </div>

        {/* FAQ */}
        <div style={{ marginTop: '56px', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'Space Grotesk', fontSize: '22px', fontWeight: 700, marginBottom: '24px' }}>Common Questions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
            {[
              { q: 'Is this a one-time payment for 3 months?', a: 'Yes. Pay $4.99 once and receive 3 full months of HoverConvert Pro access. No recurring auto-renewals or unexpected charges.' },
              { q: 'What happens to my free conversions while I\'m not logged in?', a: 'Free users get 50 conversions per day without any account required. The extension tracks this locally using chrome.storage. No data is sent to servers.' },
              { q: 'How does the extension know I\'m a Pro user?', a: 'After payment, your account is marked as premium in our secure database. The extension calls our API (using your Clerk session token) to verify your status. No payment data is stored in the extension.' },
              { q: 'What if I need a refund?', a: 'No problem. 30-day money-back guarantee, no questions asked. Just email us and we\'ll process it immediately.' },
            ].map((item, i) => (
              <div key={i} style={{ padding: '16px 20px', borderRadius: '12px', background: 'var(--bg2)', border: '1px solid var(--br)' }}>
                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px' }}>{item.q}</div>
                <div style={{ fontSize: '13px', color: 'var(--tx2)', lineHeight: 1.6 }}>{item.a}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

export default PricingPage;
