import { useNavigate } from 'react-router-dom';

function PrivacyPage() {
  const navigate = useNavigate();

  const keyHighlights = [
    {
      title: "Local Processing First",
      desc: "Whenever possible, currency conversions are processed locally on your device without sending webpage content to external servers."
    },
    {
      title: "No Browsing History Collected",
      desc: "We do not track, collect, or store your browsing history, websites visited, or search queries."
    },
    {
      title: "Data Safety Guarantee",
      desc: "We do not sell user data. Any information transmitted is secured using industry-standard HTTPS encryption."
    }
  ];

  const sections = [
    {
      num: "1",
      title: "Introduction",
      content: "Welcome to HoverConvert (referred to as \"we,\" \"our,\" or \"us\"). We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our browser extension and website (available at https://www.currenceconverter.me). Please read this policy carefully. If you do not agree with the terms of this privacy policy, please do not access the site or use the extension."
    },
    {
      num: "2",
      title: "Information We Collect",
      content: "We collect information in two main categories: information you provide directly to us (such as your account details or support messages) and technical information collected automatically to ensure the service functions correctly (such as network communications for fetching exchange rates)."
    },
    {
      num: "3",
      title: "Authentication & Account Information",
      content: "When you sign up for an optional HoverConvert account or purchase a Pro license, we collect details including your email address and authentication state. This data is used solely to verify your subscription status, sync settings across devices, and manage access to premium features. We use Clerk as our third-party identity and authentication provider."
    },
    {
      num: "4",
      title: "Exchange Rate Services",
      content: "To provide accurate and up-to-date currency conversions, the HoverConvert extension retrieves current exchange rates using secure HTTPS APIs. We request rates from our central server or verified third-party API providers. These requests do not transmit your personal information or browsing context."
    },
    {
      num: "5",
      title: "Website Content Processing",
      content: "HoverConvert detects currency values on webpages you visit to display converted amounts on hover. This processing occurs locally in your browser sandbox. Your browsing history is not collected, and no webpage content or private data is transmitted to our servers or any third party."
    },
    {
      num: "6",
      title: "Local Storage & Preferences",
      content: "We store user configurations (such as target currency, theme choices, hover delay, and rate overrides) locally on your device. These settings are saved in the browser's local storage (chrome.storage) to personalize your experience. Settings are only synced to our secure servers if you are authenticated."
    },
    {
      num: "7",
      title: "How We Use Information",
      content: "We use the collected information to operate, maintain, and improve HoverConvert; verify premium licenses; respond to support queries; and protect the security and integrity of our services. We do not use your information for advertising, nor do we build user profiles based on your web activity."
    },
    {
      num: "8",
      title: "Data Sharing",
      content: "We do not sell, rent, or trade your personal data. We only share information with trusted third-party service providers (such as authentication or payment processors) to the minimum extent necessary to provide our services, or when required by law."
    },
    {
      num: "9",
      title: "Data Security",
      content: "We implement robust administrative, technical, and physical security measures to protect your personal information. All communications between the extension, website, and our servers are encrypted using Secure Sockets Layer (SSL/HTTPS) technology."
    },
    {
      num: "10",
      title: "Third-Party Services",
      content: "We partner with Clerk (identity management) and Dodo Payments (subscription billing and checkout). These services may collect and process your information in accordance with their respective privacy policies. We do not run or execute remote JavaScript within the extension context."
    },
    {
      num: "11",
      title: "Your Rights",
      content: "Depending on your jurisdiction (such as GDPR in Europe or CCPA in California), you have rights to access, correct, or delete your personal data. You can delete your local extension data at any time by resetting your preferences or uninstalling the extension."
    },
    {
      num: "12",
      title: "Changes to this Privacy Policy",
      content: "We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the 'Effective Date' at the top of this document."
    },
    {
      num: "13",
      title: "Contact Information",
      content: "If you have questions or comments about this Privacy Policy, please contact us at: Website: https://www.currenceconverter.me | Support Email: support@currenceconverter.me"
    }
  ];

  return (
    <section className="seo-page" style={{ paddingTop: '100px', minHeight: '80vh', background: 'var(--bg)', color: 'var(--tx)' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 20px 60px' }}>
        <div style={{ marginBottom: '20px' }}>
          <a onClick={() => navigate('/')} style={{ color: 'var(--cy)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            ← Back to Home
          </a>
        </div>

        <div className="seo-hero" style={{ marginBottom: '40px', textAlign: 'center' }}>
          <div className="pill" style={{ display: 'inline-block', padding: '4px 12px', background: 'rgba(34, 211, 238, 0.1)', border: '1px solid rgba(34, 211, 238, 0.2)', borderRadius: '9999px', fontSize: '12px', color: 'var(--cy)', fontWeight: 'bold', marginBottom: '12px' }}>
            🔒 Privacy & Trust
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 700, marginBottom: '16px', lineHeight: 1.2 }}>
            Privacy Policy
          </h1>
          <p style={{ color: 'var(--tx2)', fontSize: '14px', maxWidth: '600px', margin: '0 auto' }}>
            Effective Date: July 16, 2026
          </p>
        </div>

        {/* Key Highlights Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '40px' }}>
          {keyHighlights.map((hl, idx) => (
            <div key={idx} className="dashboard-card" style={{ padding: '20px', background: 'var(--bg2)', border: '1px solid var(--br2)', borderRadius: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--cy)' }}>{hl.title}</h3>
              <p style={{ fontSize: '12px', color: 'var(--tx2)', lineHeight: '1.5' }}>{hl.desc}</p>
            </div>
          ))}
        </div>

        {/* Content sections */}
        <div className="dashboard-card" style={{ padding: '30px', background: 'var(--bg2)', border: '1px solid var(--br2)', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {sections.map((section, idx) => (
            <div key={idx} style={{ borderBottom: idx !== sections.length - 1 ? '1px solid var(--br)' : 'none', paddingBottom: idx !== sections.length - 1 ? '24px' : '0' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', width: '24px', height: '24px', background: 'var(--vi)', color: '#fff', borderRadius: '50%', fontSize: '12px', fontWeight: 'bold', flexShrink: 0, marginTop: '2px' }}>
                  {section.num}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--tx)' }}>
                    {section.title}
                  </h2>
                  <p style={{ fontSize: '13px', color: 'var(--tx2)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                    {section.content}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default PrivacyPage;
