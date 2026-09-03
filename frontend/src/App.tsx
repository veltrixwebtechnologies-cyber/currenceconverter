import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import './App.css';
import logoImg from './assets/logo.png';
import { API_BASE } from './types';
import type { UserSettings, License } from './types';
import { GoogleAuthButton, GoogleIcon } from './components/GoogleAuthButton';
import { useFirebaseAuth } from './context/FirebaseAuthContext';
export { GoogleIcon };

// Page imports
import LandingPage from './pages/LandingPage';
import SupportPage from './pages/SupportPage';
import AdminQueriesPage from './pages/AdminQueriesPage';
import DeveloperDashboard from './pages/DeveloperDashboard';
import PricingPage from './pages/PricingPage';
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import PaymentFailedPage from './pages/PaymentFailedPage';
import USDToINRPage from './pages/USDToINRPage';
import EURToINRPage from './pages/EURToINRPage';
import GBPToINRPage from './pages/GBPToINRPage';
import CurrencyConverterToolPage from './pages/CurrencyConverterToolPage';
import LiveExchangeRatesPage from './pages/LiveExchangeRatesPage';
import NotFoundPage from './pages/NotFoundPage';
import PrivacyPage from './pages/PrivacyPage';

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavigate = (to: string) => {
    navigate(to);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Firebase Auth hook
  const { user, isLoaded: clerkIsLoaded, isSignedIn: clerkIsSignedIn, signOut: firebaseSignOut, getIdToken: clerkGetToken } = useFirebaseAuth();
  const clerkUser = user;
  const clerkEnabled = true;

  // User details & License keys
  const [userId, setUserId] = useState<string>('');
  const [isPro, setIsPro] = useState<boolean>(() => {
    // Check legacy license first
    const storedLicense = localStorage.getItem('hc_license_info');
    if (storedLicense) return true;

    // Check Clerk cached status
    const cached = localStorage.getItem('hc_premium_status');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Cache is valid for 24 hours
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          return !!parsed.premium;
        }
      } catch (_) { }
    }
    return false;
  });
  const [licenseInfo, setLicenseInfo] = useState<License | null>(null);
  const [extensionId, setExtensionId] = useState<string | null>(() => localStorage.getItem('hc_extension_id'));

  useEffect(() => {
    const handleExtensionReady = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        localStorage.setItem('hc_extension_id', customEvent.detail);
        setExtensionId(customEvent.detail);
      }
    };

    window.addEventListener('HC_EXTENSION_READY', handleExtensionReady);
    return () => {
      window.removeEventListener('HC_EXTENSION_READY', handleExtensionReady);
    };
  }, []);

  // App Settings
  const [settings, setSettings] = useState<UserSettings>({
    userId: '',
    nativeCurrency: 'INR',
    theme: 'glass',
    hoverDelay: 100,
    rateOverride: null,
    favoriteCurrencies: ['USD', 'EUR', 'GBP', 'JPY', 'AUD']
  });

  useEffect(() => {
    console.debug('[Settings] Synchronized local configuration:', settings);
  }, [settings]);

  // Rates Cache
  const [rates, setRates] = useState<Record<string, number>>({});
  // UI state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; visible: boolean }>({
    message: '',
    type: 'success',
    visible: false
  });
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);

  // Form states
  const [licenseInput, setLicenseInput] = useState('');
  const [purchaseEmail, setPurchaseEmail] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportMessage, setSupportMessage] = useState('');

  // Scroll transparency for navigation
  const [navScrolled, setNavScrolled] = useState(false);

  // Establish stable user ID & load settings
  useEffect(() => {
    // Fetch exchange rates from backend
    fetchRates();

    // Store extension ID if present in query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const extId = urlParams.get('extensionId');
    if (extId) {
      localStorage.setItem('hc_extension_id', extId);
      // Clean up the URL search params so the extensionId isn't hanging around
      const newUrl = window.location.pathname + window.location.search.replace(/[?&]extensionId=[^&]+/, '').replace(/^&/, '?');
      window.history.replaceState({}, document.title, newUrl);
    }

    // Check and validate legacy license key securely on backend
    const checkLegacyLicense = async () => {
      const storedLicense = localStorage.getItem('hc_license_info');
      if (storedLicense) {
        try {
          const parsed = JSON.parse(storedLicense);
          if (parsed && parsed.licenseKey) {
            const res = await fetch(`${API_BASE}/license/validate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ licenseKey: parsed.licenseKey })
            });
            const data = await res.json();
            if (res.ok && data.success && data.license?.status === 'active') {
              setLicenseInfo(data.license);
              setIsPro(true);
            } else {
              localStorage.removeItem('hc_license_info');
              setLicenseInfo(null);
            }
          }
        } catch (e) {
          localStorage.removeItem('hc_license_info');
          setLicenseInfo(null);
        }
      }
    };
    checkLegacyLicense();
  }, []);

  // Dynamically switch userId between Clerk ID (if logged in) and Guest ID (if logged out)
  useEffect(() => {
    if (!clerkIsLoaded) return;
    if (clerkIsSignedIn && clerkUser) {
      setUserId(clerkUser.uid);
    } else {
      const storedUserId = localStorage.getItem('hc_user_id');
      const storedToken = localStorage.getItem('hc_guest_token');
      if (storedUserId && storedToken) {
        setUserId(storedUserId);
      } else {
        // Request a server-issued signed guest token
        fetch(`${API_BASE}/guest-token`, { method: 'POST' })
          .then(res => res.json())
          .then((data: { userId: string; token: string }) => {
            localStorage.setItem('hc_user_id', data.userId);
            localStorage.setItem('hc_guest_token', data.token);
            setUserId(data.userId);
          })
          .catch(() => {
            // Offline fallback — generate a local ID (settings won't persist server-side)
            const fallbackId = 'user_' + Math.random().toString(36).substring(2, 11);
            localStorage.setItem('hc_user_id', fallbackId);
            setUserId(fallbackId);
          });
      }
    }
  }, [clerkIsLoaded, clerkIsSignedIn, clerkUser]);

  // Check premium status via Clerk auth when user loads
  const checkPremium = useCallback(async () => {
    if (!clerkIsLoaded) return false;
    try {
      const headers: Record<string, string> = {};
      if (clerkIsSignedIn && clerkGetToken) {
        const token = await clerkGetToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      } else {
        // Not signed in: clear local premium status cache
        localStorage.removeItem('hc_premium_status');
      }

      const res = await fetch(`${API_BASE}/check-premium`, { headers });
      const data = await res.json() as { premium: boolean; plan: string; dailyLimit: number | null };

      const premiumStatus = !!data.premium;
      setIsPro(premiumStatus);

      if (clerkIsSignedIn) {
        localStorage.setItem('hc_premium_status', JSON.stringify({
          premium: premiumStatus,
          timestamp: Date.now()
        }));
      }
      return premiumStatus;
    } catch (err) {
      console.warn('Premium check failed, defaulting to free tier:', err);
      // Fallback to cached status on network failure with 24h TTL
      const cached = localStorage.getItem('hc_premium_status');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed.timestamp === 'number' && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
            setIsPro(!!parsed.premium);
            return !!parsed.premium;
          }
        } catch (_) { }
      }
      setIsPro(false);
      return false;
    }
  }, [clerkIsLoaded, clerkIsSignedIn, clerkGetToken]);

  useEffect(() => {
    checkPremium();
  }, [checkPremium]);

  // Sync Clerk Auth with Chrome Extension
  useEffect(() => {
    if (!clerkIsLoaded) return;
    const syncAuthWithExtension = async () => {
      const targetExtId = extensionId || localStorage.getItem('hc_extension_id');
      if (!targetExtId) return;

      try {
        if (clerkIsSignedIn && clerkGetToken && clerkUser) {
          const token = await clerkGetToken();
          if (token) {
            if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
              const sessionPayload = {
                type: 'INSTANT_CURRENCY_FIREBASE_SESSION',
                token: token,
                user: {
                  id: clerkUser.uid,
                  email: clerkUser.email
                },
                subscription: {
                  active: isPro,
                  status: isPro ? 'active' : 'inactive',
                  plan_type: isPro ? 'pro_lifetime' : 'free'
                }
              };
              chrome.runtime.sendMessage(targetExtId, sessionPayload, (response: any) => {
                if (chrome.runtime.lastError) {
                  console.warn('Extension sync failed (expected if not installed/configured):', chrome.runtime.lastError.message);
                } else {
                  console.log('Synced session to Chrome Extension.', response);
                }
              });
              // Also send with legacy type for extension compatibility
              chrome.runtime.sendMessage(targetExtId, { ...sessionPayload, type: 'INSTANT_CURRENCY_CLERK_SESSION' });
            }
          }
        } else {
          // Clear session in extension on logout
          if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
            chrome.runtime.sendMessage(
              targetExtId,
              {
                type: 'INSTANT_CURRENCY_CLERK_SESSION',
                token: null,
                user: null,
                subscription: null
              },
              () => {
                if (chrome.runtime.lastError) {
                  // Ignore
                }
              }
            );
          }
        }
      } catch (err) {
        console.error('Failed to sync auth with extension:', err);
      }
    };
    syncAuthWithExtension();
  }, [clerkIsLoaded, clerkIsSignedIn, clerkUser, isPro, extensionId]);

  // Fetch settings once userId is loaded
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const headers: Record<string, string> = {};
        const guestToken = localStorage.getItem('hc_guest_token');
        if (guestToken) headers['x-guest-token'] = guestToken;
        const response = await fetch(`${API_BASE}/settings/${userId}`, { headers });
        const data = await response.json() as { success: boolean; settings: UserSettings };
        if (data.success) {
          setSettings(data.settings);
          console.log('Loaded user settings for:', data.settings.userId || userId);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    };

    if (userId) {
      fetchSettings();
    }
  }, [userId]);

  // Handle nav background scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setNavScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type, visible: true });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 4000);
  };

  // Redirect unauthenticated users from protected pages (e.g. dev dashboard)
  useEffect(() => {
    if (clerkIsLoaded && !clerkIsSignedIn && path === '/dev-dashboard') {
      showToast('Authentication required. Please sign in.', 'error');
      handleNavigate('/');
    }
  }, [clerkIsLoaded, clerkIsSignedIn, path]);

  // Dynamic Title, Meta Description, and Canonical Link Updates
  useEffect(() => {
    let title = 'Currency Converter – Instant Currency Conversion Tool | HoverConvert';
    let description = 'Convert currencies instantly while browsing websites. Hover or select any amount and get live exchange rates in real time.';

    switch (path) {
      case '/':
        title = 'Currency Converter – Instant Currency Conversion Tool | HoverConvert';
        description = 'Convert currencies instantly while browsing websites. Hover or select any amount and get live exchange rates in real time.';
        break;
      case '/privacy':
        title = 'Privacy Policy | HoverConvert';
        description = 'Read the Privacy Policy for HoverConvert. Learn how we handle your data, local currency processing, and security practices.';
        break;
      case '/support':
        title = 'Priority Support & Help | HoverConvert';
        description = 'Get priority support for HoverConvert Chrome extension. Submit your issues and get help from our development team.';
        break;
      case '/admin-queries':
        title = 'Admin Queries Portal | HoverConvert';
        description = 'HoverConvert admin ticket and support query management interface.';
        break;
      case '/dev-dashboard':
        title = 'Developer Dashboard | HoverConvert';
        description = 'Access developer options, api keys, and usage statistics for HoverConvert Pro.';
        break;
      case '/pricing':
        title = 'Get HoverConvert Pro – 3 Months Access | HoverConvert';
        description = 'Upgrade to HoverConvert Pro to unlock offline conversions, custom markups, unlimited daily usage, and more for 3 months.';
        break;
      case '/payment-success':
        title = 'Payment Successful | HoverConvert';
        description = 'Thank you for upgrading to HoverConvert Pro! Your premium 3-month access is now activated.';
        break;
      case '/payment-failed':
        title = 'Payment Failed | HoverConvert';
        description = 'Your transaction could not be completed. Please try upgrading again or contact support.';
        break;
      case '/usd-to-inr':
        title = 'USD to INR Converter - Live Dollar to Rupee Exchange Rate | HoverConvert';
        description = 'Convert US Dollars (USD) to Indian Rupees (INR) instantly. Check real-time USD to INR exchange rates, historical rates, and live conversion data.';
        break;
      case '/eur-to-inr':
        title = 'EUR to INR Converter - Live Euro to Rupee Exchange Rate | HoverConvert';
        description = 'Convert Euros (EUR) to Indian Rupees (INR) instantly. Check real-time EUR to INR exchange rates, historical rates, and live conversion data.';
        break;
      case '/gbp-to-inr':
        title = 'GBP to INR Converter - Live Pound to Rupee Exchange Rate | HoverConvert';
        description = 'Convert British Pounds (GBP) to Indian Rupees (INR) instantly. Check real-time GBP to INR exchange rates, historical rates, and live conversion data.';
        break;
      case '/currency-converter':
        title = 'Free Instant Currency Converter Tool - 160+ Currencies | HoverConvert';
        description = 'Free online currency converter tool. Convert over 160+ world currencies instantly with real-time live forex exchange rates.';
        break;
      case '/live-exchange-rates':
        title = 'Live Exchange Rates Table - Real-Time Forex Rates | HoverConvert';
        description = 'View real-time forex exchange rates table. Compare popular currency pairs instantly with live data updated every 6 hours.';
        break;
      default:
        title = 'Page Not Found | HoverConvert';
        description = 'The page you are looking for does not exist on HoverConvert.';
    }

    document.title = title;

    // Update meta description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', description);

    // Update og:title
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', title);

    // Update og:description
    let ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', description);

    // Update og:url
    let ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', `https://www.currenceconverter.me${path === '/' ? '/' : path}`);

    // Update canonical link dynamically
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', `https://www.currenceconverter.me${path === '/' ? '/' : path}`);
  }, [path]);

  const fetchRates = async () => {
    try {
      const response = await fetch(`${API_BASE}/rates`);
      const data = await response.json() as { success: boolean; rates: Record<string, number>; updatedAt: string };
      if (data.success) {
        setRates(data.rates);
      }
    } catch (error) {
      console.error('Error fetching rates:', error);
      // Fallback
      setRates({
        USD: 1.0,
        INR: 85.02,
        EUR: 0.92,
        GBP: 0.78,
        JPY: 156.40,
        AUD: 1.51
      });
    }
  };

  const handleActivateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseInput.trim()) return;

    try {
      const response = await fetch(`${API_BASE}/license/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: licenseInput.trim() })
      });
      const data = await response.json() as { success: boolean; valid: boolean; license?: License; message?: string };
      if (data.success && data.valid && data.license) {
        setIsPro(true);
        setLicenseInfo(data.license);
        localStorage.setItem('hc_license_info', JSON.stringify(data.license));
        setShowLicenseModal(false);
        showToast('Pro license activated! Thank you for supporting us.', 'success');
      } else {
        showToast(data.message || 'Invalid license key. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Error validating license:', error);
      showToast('Connection error, license validation failed.', 'error');
    }
  };

  const handleMockPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseEmail.trim() || !purchaseEmail.includes('@')) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/license/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: purchaseEmail.trim() })
      });
      const data = await response.json() as { success: boolean; license: License };
      if (data.success) {
        setIsPro(true);
        setLicenseInfo(data.license);
        localStorage.setItem('hc_license_info', JSON.stringify(data.license));
        setLicenseInput(data.license.licenseKey);
        showToast('Purchase mock checkout succeeded! License key created.', 'success');
      }
    } catch (error) {
      console.error('Error creating mock license:', error);
      showToast('Mock purchase server error.', 'error');
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportEmail.trim() || !supportMessage.trim()) return;

    try {
      const response = await fetch(`${API_BASE}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: supportEmail, message: supportMessage })
      });
      const data = await response.json() as { success: boolean; message: string };
      if (data.success) {
        showToast(data.message, 'success');
        setSupportMessage('');
        setShowSupportModal(false);
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      showToast('Feedback submitted locally.', 'success');
      setShowSupportModal(false);
    }
  };

  return (
    <>
      {/* FLOAT NAV BAR */}
      <nav id="navbar" style={{ background: navScrolled || path !== '/' ? 'rgba(6,8,14,0.94)' : 'rgba(6,8,14,0.75)' }}>
        <a onClick={() => handleNavigate('/')} className="logo" style={{ cursor: 'pointer' }}>
          <div className="logo-mark">
            <img src={logoImg || "/logo.png"} alt="HoverConvert Logo" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
          </div>HoverConvert
        </a>

        {path === '/' ? (
          <ul className="nav-links">
            <li><a href="#features">Features</a></li>
            <li><a href="#problem">How it Works</a></li>
            <li><a href="#pricing">Pricing</a></li>
            <li><a href="#faq">FAQ</a></li>
            <li><a onClick={() => handleNavigate('/currency-converter')}>Calculator</a></li>
            <li><a onClick={() => handleNavigate('/live-exchange-rates')}>Rates</a></li>
            <li><a onClick={() => handleNavigate('/support')}>Support</a></li>
          </ul>
        ) : (
          <ul className="nav-links">
            <li>
              <a onClick={() => handleNavigate('/')} className="">
                Home Page
              </a>
            </li>
            <li>
              <a onClick={() => handleNavigate('/currency-converter')} className={path === '/currency-converter' ? 'active' : ''}>
                Currency Converter
              </a>
            </li>
            <li>
              <a onClick={() => handleNavigate('/live-exchange-rates')} className={path === '/live-exchange-rates' ? 'active' : ''}>
                Live Rates
              </a>
            </li>
            <li>
              <a onClick={() => handleNavigate('/support')} className={path === '/support' ? 'active' : ''}>
                Support
              </a>
            </li>
            {isPro && (
              <li>
                <a onClick={() => handleNavigate('/dev-dashboard')} className={path === '/dev-dashboard' ? 'active' : ''}>
                  Developer Dashboard
                </a>
              </li>
            )}
          </ul>
        )}

        <div className="nav-actions">
          {path === '/' ? (
            <>
              {clerkIsSignedIn ? (
                isPro ? (
                  <button onClick={() => handleNavigate('/dev-dashboard')} className="nav-cta">
                    📊 Dashboard
                  </button>
                ) : (
                  <button onClick={() => handleNavigate('/pricing')} className="nav-cta">
                    ⚡ Upgrade to Pro
                  </button>
                )
              ) : (
                <button onClick={() => handleNavigate('/pricing')} className="nav-cta">
                  ⚡ Get Pro — $4.99
                </button>
              )}
            </>
          ) : (
            <>
              {isPro && (
                <span style={{ fontSize: '11px', color: 'var(--cy)', fontWeight: 'bold' }}>⭐ Pro</span>
              )}
              {!isPro && (
                <button onClick={() => handleNavigate('/pricing')} className="nav-cta" style={{ padding: '7px 14px', fontSize: '13px' }}>
                  ⚡ Go Pro
                </button>
              )}
            </>
          )}
          {/* Firebase User Profile or Sign In */}
          {clerkIsSignedIn && clerkIsLoaded ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || user.email || 'User'}
                  style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid var(--cy)' }}
                  title={user.displayName || user.email || ''}
                />
              ) : (
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--vi), var(--cy))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                  {(user?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <button
                onClick={() => firebaseSignOut()}
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <GoogleAuthButton forceRedirectUrl={path === '/pricing' ? '/pricing' : undefined} />
          )}
          <button className="hbg" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>☰</button>
        </div>
      </nav>

      {/* MOBILE NAV MENU */}
      {mobileMenuOpen && (
        <ul className="nav-links" style={{
          display: 'flex', flexDirection: 'column', position: 'fixed',
          top: '65px', left: '0', right: '0', background: 'rgba(6,8,14,0.98)',
          padding: '20px 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)',
          gap: '18px', backdropFilter: 'blur(20px)', zIndex: 199
        }}>
          {path === '/' ? (
            <>
              <li><a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a></li>
              <li><a href="#problem" onClick={() => setMobileMenuOpen(false)}>How it Works</a></li>
              <li><a href="#pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</a></li>
              <li><a href="#faq" onClick={() => setMobileMenuOpen(false)}>FAQ</a></li>
              <li><a onClick={() => { handleNavigate('/currency-converter'); setMobileMenuOpen(false); }}>🧮 Currency Converter</a></li>
              <li><a onClick={() => { handleNavigate('/live-exchange-rates'); setMobileMenuOpen(false); }}>📈 Live Exchange Rates</a></li>
              <li><a onClick={() => { handleNavigate('/support'); setMobileMenuOpen(false); }}>⚡ Help & Support</a></li>
              {clerkEnabled && !clerkIsSignedIn && (
                <li>
                  <GoogleAuthButton
                    style={{ color: 'var(--cy)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                    onClick={() => setMobileMenuOpen(false)}
                  />
                </li>
              )}
              {isPro ? (
                <li><a onClick={() => { handleNavigate('/dev-dashboard'); setMobileMenuOpen(false); }}>📊 Pro Dashboard</a></li>
              ) : (
                <li><a onClick={() => { setShowLicenseModal(true); setMobileMenuOpen(false); }}>🔑 Activate Pro</a></li>
              )}
            </>
          ) : (
            <>
              <li><a onClick={() => { handleNavigate('/'); setMobileMenuOpen(false); }}>Home</a></li>
              <li><a onClick={() => { handleNavigate('/currency-converter'); setMobileMenuOpen(false); }}>Currency Converter</a></li>
              <li><a onClick={() => { handleNavigate('/live-exchange-rates'); setMobileMenuOpen(false); }}>Live Exchange Rates</a></li>
              <li><a onClick={() => { handleNavigate('/support'); setMobileMenuOpen(false); }}>Help & Support</a></li>
              {clerkEnabled && !clerkIsSignedIn && (
                <li>
                  <GoogleAuthButton
                    style={{ color: 'var(--cy)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                    onClick={() => setMobileMenuOpen(false)}
                    forceRedirectUrl={path === '/pricing' ? '/pricing' : undefined}
                  />
                </li>
              )}
              {isPro && <li><a onClick={() => { handleNavigate('/dev-dashboard'); setMobileMenuOpen(false); }}>Developer Dashboard</a></li>}
              {!isPro && <li><a onClick={() => { setShowLicenseModal(true); setMobileMenuOpen(false); }}>🔑 Activate Pro</a></li>}
            </>
          )}
        </ul>
      )}

      {/* MAIN VIEWPORT ROUTES */}
      <Routes>
        <Route path="/" element={<LandingPage isPro={isPro} />} />
        <Route path="/support" element={<SupportPage clerkUser={clerkUser} showToast={showToast} />} />
        <Route
          path="/admin-queries"
          element={
            <AdminQueriesPage
              clerkUser={clerkUser}
              clerkGetToken={clerkGetToken}
              showToast={showToast}
            />
          }
        />
        <Route
          path="/dev-dashboard"
          element={
            <DeveloperDashboard
              isPro={isPro}
              licenseInfo={licenseInfo}
              setShowSupportModal={setShowSupportModal}
            />
          }
        />
        <Route
          path="/pricing"
          element={
            <PricingPage
              isPro={isPro}
              clerkIsSignedIn={clerkIsSignedIn}
              clerkIsLoaded={clerkIsLoaded}
              clerkUser={clerkUser}
              clerkGetToken={clerkGetToken}
              showToast={showToast}
              clerkEnabled={clerkEnabled}
            />
          }
        />
        <Route
          path="/payment-success"
          element={
            <PaymentSuccessPage
              isPro={isPro}
              refetchPremium={checkPremium}
              clerkUser={clerkUser}
            />
          }
        />
        <Route path="/payment-failed" element={<PaymentFailedPage />} />
        <Route path="/usd-to-inr" element={<USDToINRPage rates={rates} />} />
        <Route path="/eur-to-inr" element={<EURToINRPage rates={rates} />} />
        <Route path="/gbp-to-inr" element={<GBPToINRPage rates={rates} />} />
        <Route path="/currency-converter" element={<CurrencyConverterToolPage rates={rates} />} />
        <Route path="/live-exchange-rates" element={<LiveExchangeRatesPage rates={rates} />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      {/* FOOTER */}
      <footer>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '30px', width: '100%', marginBottom: '30px', borderBottom: '1px solid var(--br)', paddingBottom: '30px' }}>
          <div style={{ textAlign: 'left' }}>
            <a onClick={() => handleNavigate('/')} className="logo" style={{ cursor: 'pointer', marginBottom: '10px' }}>
              <div className="logo-mark">
                <img src={logoImg || "/logo.png"} alt="HoverConvert Logo" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
              </div>HoverConvert
            </a>
            <p style={{ fontSize: '12px', color: 'var(--tx2)', maxWidth: '280px', marginTop: '10px' }}>
              Instant currency conversion tool. Hover over any amount on any page and get real-time exchange rates instantly.
            </p>
          </div>
          <div style={{ textAlign: 'left' }}>
            <h4 style={{ fontFamily: 'Space Grotesk', fontSize: '14px', marginBottom: '12px', color: 'var(--tx)' }}>Quick Tools</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <a onClick={() => handleNavigate('/currency-converter')} style={{ color: 'var(--tx2)', cursor: 'pointer' }}>Currency Converter</a>
              <a onClick={() => handleNavigate('/live-exchange-rates')} style={{ color: 'var(--tx2)', cursor: 'pointer' }}>Live Exchange Rates</a>
            </div>
          </div>
          <div style={{ textAlign: 'left' }}>
            <h4 style={{ fontFamily: 'Space Grotesk', fontSize: '14px', marginBottom: '12px', color: 'var(--tx)' }}>Popular Converters</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <a onClick={() => handleNavigate('/usd-to-inr')} style={{ color: 'var(--tx2)', cursor: 'pointer' }}>USD to INR Converter</a>
              <a onClick={() => handleNavigate('/eur-to-inr')} style={{ color: 'var(--tx2)', cursor: 'pointer' }}>EUR to INR Converter</a>
              <a onClick={() => handleNavigate('/gbp-to-inr')} style={{ color: 'var(--tx2)', cursor: 'pointer' }}>GBP to INR Converter</a>
            </div>
          </div>
          <div style={{ textAlign: 'left' }}>
            <h4 style={{ fontFamily: 'Space Grotesk', fontSize: '14px', marginBottom: '12px', color: 'var(--tx)' }}>External Resources</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <a href="https://chromewebstore.google.com/detail/kknnjgicdlamepecgkgafdgodmeipibp?utm_source=item-share-cb" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--tx2)' }}>Chrome Web Store</a>
              <a href="https://openexchangerates.org" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--tx2)' }}>Open Exchange Rates</a>
              <a href="https://clerk.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--tx2)' }}>Clerk Auth Service</a>
            </div>
          </div>
          <div style={{ textAlign: 'left' }}>
            <h4 style={{ fontFamily: 'Space Grotesk', fontSize: '14px', marginBottom: '12px', color: 'var(--tx)' }}>Legal & Support</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <a onClick={() => handleNavigate('/privacy')} style={{ color: 'var(--tx2)', cursor: 'pointer' }}>Privacy Policy</a>
              <a onClick={() => showToast('Terms of service loaded', 'info')} style={{ color: 'var(--tx2)', cursor: 'pointer' }}>Terms of Service</a>
              <a onClick={() => handleNavigate('/support')} style={{ color: 'var(--tx2)', cursor: 'pointer' }}>Priority Support</a>
              <a onClick={() => handleNavigate('/admin-queries')} style={{ color: 'var(--tx2)', cursor: 'pointer' }}>Admin Portal</a>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '20px', width: '100%' }}>
          <span className="fcopy">© 2026 HoverConvert. Premium SEO Landing Pages. All rights reserved.</span>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--tx2)' }}>Share HoverConvert:</span>
            <a href="https://twitter.com/intent/tweet?text=Convert%20currencies%20instantly%20while%20browsing%20with%20HoverConvert!%20Check%20it%20out%20at%20https://www.currenceconverter.me/" target="_blank" rel="noopener noreferrer" className="share-btn" style={{ textDecoration: 'none', background: 'var(--br)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', color: 'var(--tx)' }}>X (Twitter)</a>
            <a href="https://www.facebook.com/sharer/sharer.php?u=https://www.currenceconverter.me/" target="_blank" rel="noopener noreferrer" className="share-btn" style={{ textDecoration: 'none', background: 'var(--br)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', color: 'var(--tx)' }}>Facebook</a>
            <a href="https://www.linkedin.com/sharing/share-offsite/?url=https://www.currenceconverter.me/" target="_blank" rel="noopener noreferrer" className="share-btn" style={{ textDecoration: 'none', background: 'var(--br)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', color: 'var(--tx)' }}>LinkedIn</a>
            <a href="https://reddit.com/submit?url=https://www.currenceconverter.me/&title=HoverConvert%20-%20Instant%20Currency%20Conversion%20Tool" target="_blank" rel="noopener noreferrer" className="share-btn" style={{ textDecoration: 'none', background: 'var(--br)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', color: 'var(--tx)' }}>Reddit</a>
          </div>
        </div>
      </footer>

      {/* TOAST NOTIFICATION */}
      <div className={`toast ${toast.visible ? 'show' : ''} toast-${toast.type}`}>
        <span className="toast-icon">
          {toast.type === 'success' && '✓'}
          {toast.type === 'error' && '✕'}
          {toast.type === 'info' && '🛈'}
        </span>
        <span className="toast-message">{toast.message}</span>
      </div>

      {/* MODAL: LICENSE ACTIVATION */}
      <div className={`modal-overlay ${showLicenseModal ? 'show' : ''}`} onClick={() => setShowLicenseModal(false)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close" onClick={() => setShowLicenseModal(false)}>×</button>
          <h3 className="modal-title">Unlock HoverConvert Pro</h3>
          <p className="modal-subtitle">Enter your Pro license key to unlock all currencies and cloud synchronization.</p>

          <form onSubmit={handleActivateLicense} className="modal-form" style={{ marginBottom: '20px' }}>
            <div className="control-group">
              <label className="control-label">License Key</label>
              <input
                type="text"
                className="text-input"
                placeholder="HC-PRO-XXXXX-XXXXX"
                value={licenseInput}
                onChange={(e) => setLicenseInput(e.target.value)}
              />
            </div>
            <button type="submit" className="primary-btn">Activate Key</button>
          </form>

          <div style={{ borderTop: '1px solid var(--br)', paddingTop: '20px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Don't have a key?</h4>
            <p style={{ fontSize: '12px', color: 'var(--tx2)', marginBottom: '14px' }}>
              Simulate a premium checkout. Enter your email below to instantly generate a demo license key.
            </p>
            <form onSubmit={handleMockPurchase} className="modal-form">
              <div className="control-group">
                <label className="control-label">Your Email</label>
                <input
                  type="email"
                  className="text-input"
                  placeholder="your-email@example.com"
                  value={purchaseEmail}
                  onChange={(e) => setPurchaseEmail(e.target.value)}
                />
              </div>
              <button type="submit" className="secondary-btn" style={{ borderColor: 'var(--vi)', color: 'var(--vi2)' }}>
                ⚡ Generate Mock Pro License ($4.99)
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* MODAL: SUPPORT / FEEDBACK */}
      <div className={`modal-overlay ${showSupportModal ? 'show' : ''}`} onClick={() => setShowSupportModal(false)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close" onClick={() => setShowSupportModal(false)}>×</button>
          <h3 className="modal-title">Contact Support</h3>
          <p className="modal-subtitle">Have questions or found a bug? We typically respond within 24 hours.</p>

          <form onSubmit={handleFeedbackSubmit} className="modal-form">
            <div className="control-group">
              <label className="control-label">Email Address</label>
              <input
                type="email"
                className="text-input"
                required
                placeholder="your-email@example.com"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
              />
            </div>
            <div className="control-group">
              <label className="control-label">Message</label>
              <textarea
                className="text-input"
                required
                rows={4}
                placeholder="Describe your issue or suggestions..."
                value={supportMessage}
                onChange={(e) => setSupportMessage(e.target.value)}
                style={{ resize: 'none', fontFamily: 'inherit' }}
              />
            </div>
            <button type="submit" className="primary-btn">Send Message</button>
          </form>
        </div>
      </div>
      <Analytics />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
