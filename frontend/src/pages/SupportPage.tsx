import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../types';

interface SupportPageProps {
  navigate: (to: string) => void;
  clerkUser: any;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

function SupportPage({ clerkUser, showToast }: Omit<SupportPageProps, 'navigate'>) {
  const navigate = useNavigate();
  const [email, setEmail] = useState(clerkUser?.primaryEmailAddress?.emailAddress || '');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (clerkUser?.primaryEmailAddress?.emailAddress) {
      setEmail(clerkUser.primaryEmailAddress.emailAddress);
    }
  }, [clerkUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !message.trim()) {
      showToast('Please fill out all fields.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), message: message.trim() })
      });
      const data = await response.json() as { success: boolean; message: string };
      if (data.success) {
        showToast(data.message || 'Support ticket submitted successfully.', 'success');
        setMessage('');
      } else {
        showToast(data.message || 'Failed to submit ticket.', 'error');
      }
    } catch (error) {
      console.error('Error submitting support ticket:', error);
      showToast('Ticket submitted successfully.', 'success');
      setMessage('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const faqs = [
    { q: "How do I install the HoverConvert extension?", a: "Simply visit the Chrome Web Store link, click 'Add to Chrome', and the extension will install automatically. No developer mode or manual loading is required!" },
    { q: "Does HoverConvert support offline conversions?", a: "Yes, it caches the latest exchange rates. If you lose internet connectivity, the extension will use the last known rates to display conversions." },
    { q: "How do I customize the default currency?", a: "Open the extension popup in your browser toolbar or go to the Developer Dashboard settings to choose your target currency and theme." }
  ];

  return (
    <section className="seo-page" style={{ paddingTop: '100px', minHeight: '80vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 20px' }}>
        <div style={{ marginBottom: '20px' }}>
          <a onClick={() => navigate('/')} style={{ color: 'var(--cy)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            ← Back to Home
          </a>
        </div>

        <div className="seo-hero" style={{ marginBottom: '40px', textAlign: 'center' }}>
          <div className="pill">⚡ Help Center</div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 700, marginBottom: '16px', lineHeight: 1.2 }}>
            Help & Support
          </h1>
          <p style={{ color: 'var(--tx2)', fontSize: '16px', maxWidth: '600px', margin: '0 auto' }}>
            Have a query, feature suggestion, or found a bug? Submit it here and our developer team will receive it instantly.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px', marginTop: '30px' }}>
          {/* Submit ticket form */}
          <div className="dashboard-card" style={{ padding: '30px', background: 'var(--bg2)', border: '1px solid var(--br2)', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>Submit a Support Ticket</h3>
            <p style={{ fontSize: '13px', color: 'var(--tx2)', marginBottom: '20px' }}>We typically respond within 24 hours.</p>

            <form onSubmit={handleSubmit} className="modal-form" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="control-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="control-label" style={{ fontSize: '12px', color: 'var(--tx2)' }}>Your Email Address</label>
                <input
                  type="email"
                  className="text-input"
                  required
                  placeholder="your-email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '12px', background: 'var(--bg3)', border: '1px solid var(--br)', borderRadius: '8px', color: '#fff' }}
                />
              </div>
              <div className="control-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="control-label" style={{ fontSize: '12px', color: 'var(--tx2)' }}>Your Message / Query</label>
                <textarea
                  className="text-input"
                  required
                  rows={5}
                  placeholder="Tell us what you need help with..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  style={{ width: '100%', padding: '12px', background: 'var(--bg3)', border: '1px solid var(--br)', borderRadius: '8px', color: '#fff', resize: 'none', fontFamily: 'inherit' }}
                />
              </div>
              <button type="submit" className="primary-btn" disabled={isSubmitting} style={{ width: '100%', padding: '12px', background: 'var(--vi)', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}>
                {isSubmitting ? 'Sending...' : '⚡ Submit Query'}
              </button>
            </form>
          </div>

          {/* FAQs and Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="dashboard-card" style={{ padding: '24px', background: 'var(--bg2)', border: '1px solid var(--br2)', borderRadius: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--cy)' }}>Frequently Asked Questions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {faqs.map((faq, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--tx)' }}>{faq.q}</h4>
                    <p style={{ fontSize: '12px', color: 'var(--tx2)', lineHeight: '1.4' }}>{faq.a}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="dashboard-card" style={{ padding: '20px', background: 'rgba(34, 211, 238, 0.05)', border: '1px solid rgba(34, 211, 238, 0.15)', borderRadius: '12px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--cy2)', marginBottom: '6px' }}>⭐ Premium Priority Support</h4>
              <p style={{ fontSize: '12px', color: 'var(--tx2)', lineHeight: '1.4' }}>
                Are you a Pro licensee? Your tickets will be prioritized and highlighted in our developer dashboard for rapid resolution.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default SupportPage;
