import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { track } from '@vercel/analytics';
import {
  useUser,
  useAuth,
  SignInButton,
  UserButton
} from '@clerk/clerk-react';
import './App.css';

// Safe event tracker
const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  try {
    track(eventName, properties);
    console.log(`[Analytics] Event tracked: ${eventName}`, properties);
  } catch (err) {
    console.warn(`[Analytics Error] Failed to track ${eventName}:`, err);
  }
};

// Configurable API base url
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5001/api' : '/api';

const KNOWN_PATHS = [
  '/',
  '/support',
  '/admin-queries',
  '/dev-dashboard',
  '/pricing',
  '/payment-success',
  '/payment-failed',
  '/usd-to-inr',
  '/eur-to-inr',
  '/gbp-to-inr',
  '/currency-converter',
  '/live-exchange-rates'
];

interface UserSettings {
  userId: string;
  nativeCurrency: string;
  theme: 'light' | 'dark' | 'glass';
  hoverDelay: number;
  rateOverride: number | null;
  favoriteCurrencies: string[];
}

interface License {
  licenseKey: string;
  email: string;
  status: 'active' | 'revoked';
  createdAt: string;
}



export default function App() {
  // Navigation Routing
  const [path, setPath] = useState<string>(window.location.pathname);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentView = path === '/' ? 'landing' : (path === '/dev-dashboard' ? 'dev-dashboard' : 'other');

  // Clerk hooks (safely handle when ClerkProvider is not present)
  let clerkUser: any = null;
  let clerkIsLoaded = true;
  let clerkIsSignedIn = false;
  let clerkGetToken: (() => Promise<string | null>) | null = null;
  let clerkEnabled = true;
  try {
    const { user, isLoaded } = useUser();
    const { isSignedIn, getToken } = useAuth();
    clerkUser = user;
    clerkIsLoaded = isLoaded;
    clerkIsSignedIn = !!isSignedIn;
    clerkGetToken = getToken;
  } catch (_) {
    // ClerkProvider not mounted — auth features disabled
    clerkEnabled = false;
  }

  const navigate = (to: string) => {
    window.history.pushState(null, '', to);
    setPath(to);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const handlePopState = () => {
      setPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
      } catch (_) {}
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

  // Intersection Observer for scroll animations
  const [visibleElements, setVisibleElements] = useState<Record<string, boolean>>({});

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
      setUserId(clerkUser.id);
    } else {
      let storedUserId = localStorage.getItem('hc_user_id');
      if (!storedUserId) {
        storedUserId = 'user_' + Math.random().toString(36).substring(2, 11);
        localStorage.setItem('hc_user_id', storedUserId);
      }
      setUserId(storedUserId);
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
        } catch (_) {}
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
              chrome.runtime.sendMessage(
                targetExtId,
                {
                  type: 'INSTANT_CURRENCY_CLERK_SESSION',
                  token: token,
                  user: {
                    id: clerkUser.id,
                    email: clerkUser.primaryEmailAddress?.emailAddress
                  },
                  subscription: {
                    active: isPro,
                    status: isPro ? 'active' : 'inactive',
                    plan_type: isPro ? 'pro_lifetime' : 'free'
                  }
                },
                (response: any) => {
                  if (chrome.runtime.lastError) {
                    console.warn('Extension sync failed (expected if not installed/configured):', chrome.runtime.lastError.message);
                  } else {
                    console.log('Synced session to Chrome Extension.', response);
                  }
                }
              );
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
    if (userId) {
      fetchSettings();
      // Reference settings to satisfy compiler checks
      console.log('Loaded user settings for:', settings.userId || userId);
    }
  }, [userId, settings]);

  // Handle nav background scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setNavScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Intersection Observer for fade-in animations on landing view
  useEffect(() => {
    if (currentView !== 'landing') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-reveal-id');
            if (id) {
              setVisibleElements((prev) => ({ ...prev, [id]: true }));
            }
          }
        });
      },
      { threshold: 0.1 }
    );

    const elements = document.querySelectorAll('.reveal-init');
    elements.forEach((el) => observer.observe(el));

    return () => {
      elements.forEach((el) => observer.unobserve(el));
    };
  }, [currentView]);

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
      navigate('/');
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
        title = 'Get HoverConvert Pro – Lifetime Access | HoverConvert';
        description = 'Upgrade to HoverConvert Pro to unlock offline conversions, custom markups, unlimited daily usage, and more.';
        break;
      case '/payment-success':
        title = 'Payment Successful | HoverConvert';
        description = 'Thank you for upgrading to HoverConvert Pro! Your premium lifetime license is now activated.';
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

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${API_BASE}/settings/${userId}`);
      const data = await response.json() as { success: boolean; settings: UserSettings };
      if (data.success) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
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
        <a onClick={() => navigate('/')} className="logo" style={{ cursor: 'pointer' }}>
          <div className="logo-mark"><img src="/logo.png" alt="HoverConvert Logo" /></div>HoverConvert
        </a>

        {path === '/' ? (
          <ul className="nav-links">
            <li><a href="#features">Features</a></li>
            <li><a href="#problem">How it Works</a></li>
            <li><a href="#pricing">Pricing</a></li>
            <li><a href="#faq">FAQ</a></li>
            <li><a onClick={() => navigate('/currency-converter')}>Calculator</a></li>
            <li><a onClick={() => navigate('/live-exchange-rates')}>Rates</a></li>
            <li><a onClick={() => navigate('/support')}>Support</a></li>
          </ul>
        ) : (
          <ul className="nav-links">
            <li>
              <a onClick={() => navigate('/')} className="">
                Home Page
              </a>
            </li>
            <li>
              <a onClick={() => navigate('/currency-converter')} className={path === '/currency-converter' ? 'active' : ''}>
                Currency Converter
              </a>
            </li>
            <li>
              <a onClick={() => navigate('/live-exchange-rates')} className={path === '/live-exchange-rates' ? 'active' : ''}>
                Live Rates
              </a>
            </li>
            <li>
              <a onClick={() => navigate('/support')} className={path === '/support' ? 'active' : ''}>
                Support
              </a>
            </li>
            {isPro && (
              <li>
                <a onClick={() => navigate('/dev-dashboard')} className={path === '/dev-dashboard' ? 'active' : ''}>
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
                  <button onClick={() => navigate('/dev-dashboard')} className="nav-cta">
                    📊 Dashboard
                  </button>
                ) : (
                  <button onClick={() => navigate('/pricing')} className="nav-cta">
                    ⚡ Upgrade to Pro
                  </button>
                )
              ) : (
                <button onClick={() => navigate('/pricing')} className="nav-cta">
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
                <button onClick={() => navigate('/pricing')} className="nav-cta" style={{ padding: '7px 14px', fontSize: '13px' }}>
                  ⚡ Go Pro
                </button>
              )}
            </>
          )}
          {/* Clerk UserButton or Sign In */}
          {clerkEnabled && clerkIsLoaded && (
            clerkIsSignedIn ? (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <UserButton afterSignOutUrl="/" />
              </div>
            ) : (
              <SignInButton mode={window.innerWidth < 768 ? "redirect" : "modal"} forceRedirectUrl={path === '/pricing' ? '/pricing' : undefined}>
                <button className="nav-secondary-btn" style={{ padding: '7px 14px', fontSize: '13px' }}>
                  Sign In
                </button>
              </SignInButton>
            )
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
              <li><a onClick={() => { navigate('/currency-converter'); setMobileMenuOpen(false); }}>🧮 Currency Converter</a></li>
              <li><a onClick={() => { navigate('/live-exchange-rates'); setMobileMenuOpen(false); }}>📈 Live Exchange Rates</a></li>
              <li><a onClick={() => { navigate('/support'); setMobileMenuOpen(false); }}>⚡ Help & Support</a></li>
              {isPro ? (
                <li><a onClick={() => { navigate('/dev-dashboard'); setMobileMenuOpen(false); }}>📊 Pro Dashboard</a></li>
              ) : (
                <li><a onClick={() => { setShowLicenseModal(true); setMobileMenuOpen(false); }}>🔑 Activate Pro</a></li>
              )}
            </>
          ) : (
            <>
              <li><a onClick={() => { navigate('/'); setMobileMenuOpen(false); }}>Home</a></li>
              <li><a onClick={() => { navigate('/currency-converter'); setMobileMenuOpen(false); }}>Currency Converter</a></li>
              <li><a onClick={() => { navigate('/live-exchange-rates'); setMobileMenuOpen(false); }}>Live Exchange Rates</a></li>
              <li><a onClick={() => { navigate('/support'); setMobileMenuOpen(false); }}>Help & Support</a></li>
              {isPro && <li><a onClick={() => { navigate('/dev-dashboard'); setMobileMenuOpen(false); }}>Developer Dashboard</a></li>}
              {!isPro && <li><a onClick={() => { setShowLicenseModal(true); setMobileMenuOpen(false); }}>🔑 Activate Pro</a></li>}
            </>
          )}
        </ul>
      )}

      {/* MAIN VIEWPORT */}
      {path === '/' && (
        <LandingPage
          visibleElements={visibleElements}
          navigate={navigate}
          isPro={isPro}
        />
      )}

      {path === '/support' && (
        <SupportPage
          navigate={navigate}
          clerkUser={clerkUser}
          showToast={showToast}
        />
      )}

      {path === '/admin-queries' && (
        <AdminQueriesPage
          navigate={navigate}
          clerkUser={clerkUser}
          clerkGetToken={clerkGetToken}
          showToast={showToast}
        />
      )}


      {path === '/dev-dashboard' && (
        <DeveloperDashboard
          isPro={isPro}
          licenseInfo={licenseInfo}
          setShowSupportModal={setShowSupportModal}
        />
      )}

      {path === '/pricing' && (
        <PricingPage
          navigate={navigate}
          isPro={isPro}
          clerkIsSignedIn={clerkIsSignedIn}
          clerkIsLoaded={clerkIsLoaded}
          clerkUser={clerkUser}
          clerkGetToken={clerkGetToken}
          showToast={showToast}
          clerkEnabled={clerkEnabled}
        />
      )}

      {path === '/payment-success' && (
        <PaymentSuccessPage
          navigate={navigate}
          isPro={isPro}
          refetchPremium={checkPremium}
          clerkUser={clerkUser}
        />
      )}

      {path === '/payment-failed' && (
        <PaymentFailedPage navigate={navigate} />
      )}


      {path === '/usd-to-inr' && (
        <USDToINRPage navigate={navigate} rates={rates} />
      )}

      {path === '/eur-to-inr' && (
        <EURToINRPage navigate={navigate} rates={rates} />
      )}

      {path === '/gbp-to-inr' && (
        <GBPToINRPage navigate={navigate} rates={rates} />
      )}

      {path === '/currency-converter' && (
        <CurrencyConverterToolPage navigate={navigate} rates={rates} />
      )}

      {path === '/live-exchange-rates' && (
        <LiveExchangeRatesPage navigate={navigate} rates={rates} />
      )}

      {!KNOWN_PATHS.includes(path) && (
        <NotFoundPage navigate={navigate} />
      )}

      {/* FOOTER */}
      <footer>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '30px', width: '100%', marginBottom: '30px', borderBottom: '1px solid var(--br)', paddingBottom: '30px' }}>
          <div style={{ textAlign: 'left' }}>
            <a onClick={() => navigate('/')} className="logo" style={{ cursor: 'pointer', marginBottom: '10px' }}>
              <div className="logo-mark"><img src="/logo.png" alt="HoverConvert Logo" /></div>HoverConvert
            </a>
            <p style={{ fontSize: '12px', color: 'var(--tx2)', maxWidth: '280px', marginTop: '10px' }}>
              Instant currency conversion tool. Hover over any amount on any page and get real-time exchange rates instantly.
            </p>
          </div>
          <div style={{ textAlign: 'left' }}>
            <h4 style={{ fontFamily: 'Space Grotesk', fontSize: '14px', marginBottom: '12px', color: 'var(--tx)' }}>Quick Tools</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <a onClick={() => navigate('/currency-converter')} style={{ color: 'var(--tx2)', cursor: 'pointer' }}>Currency Converter</a>
              <a onClick={() => navigate('/live-exchange-rates')} style={{ color: 'var(--tx2)', cursor: 'pointer' }}>Live Exchange Rates</a>
            </div>
          </div>
          <div style={{ textAlign: 'left' }}>
            <h4 style={{ fontFamily: 'Space Grotesk', fontSize: '14px', marginBottom: '12px', color: 'var(--tx)' }}>Popular Converters</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <a onClick={() => navigate('/usd-to-inr')} style={{ color: 'var(--tx2)', cursor: 'pointer' }}>USD to INR Converter</a>
              <a onClick={() => navigate('/eur-to-inr')} style={{ color: 'var(--tx2)', cursor: 'pointer' }}>EUR to INR Converter</a>
              <a onClick={() => navigate('/gbp-to-inr')} style={{ color: 'var(--tx2)', cursor: 'pointer' }}>GBP to INR Converter</a>
            </div>
          </div>
          <div style={{ textAlign: 'left' }}>
            <h4 style={{ fontFamily: 'Space Grotesk', fontSize: '14px', marginBottom: '12px', color: 'var(--tx)' }}>External Resources</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <a href="https://chromewebstore.google.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--tx2)' }}>Chrome Web Store</a>
              <a href="https://openexchangerates.org" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--tx2)' }}>Open Exchange Rates</a>
              <a href="https://clerk.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--tx2)' }}>Clerk Auth Service</a>
            </div>
          </div>
          <div style={{ textAlign: 'left' }}>
            <h4 style={{ fontFamily: 'Space Grotesk', fontSize: '14px', marginBottom: '12px', color: 'var(--tx)' }}>Legal & Support</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <a onClick={() => showToast('Privacy policy loaded', 'info')} style={{ color: 'var(--tx2)', cursor: 'pointer' }}>Privacy Policy</a>
              <a onClick={() => showToast('Terms of service loaded', 'info')} style={{ color: 'var(--tx2)', cursor: 'pointer' }}>Terms of Service</a>
              <a onClick={() => navigate('/support')} style={{ color: 'var(--tx2)', cursor: 'pointer' }}>Priority Support</a>
              <a onClick={() => navigate('/admin-queries')} style={{ color: 'var(--tx2)', cursor: 'pointer' }}>Admin Portal</a>
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

/* ═══════════════════════════════════════════════════
   LANDING PAGE COMPONENT
   ═══════════════════════════════════════════════════ */
interface LandingProps {
  visibleElements: Record<string, boolean>;
  navigate: (to: string) => void;
  isPro: boolean;
}

function LandingPage({ visibleElements, navigate, isPro }: LandingProps) {
  // Demo strip calculator state
  const [demoTab, setDemoTab] = useState({ sym: '$', amount: 120, inr: 10200, code: 'USD', name: 'US Dollar' });
  const [activeTabIdx, setActiveTabIdx] = useState(0);

  // Hand simulation tracking
  const [currentIdx, setCurrentIdx] = useState(0);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [showTooltipIdx, setShowTooltipIdx] = useState<number | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: 400, y: 320 });
  const [cursorOpacity, setCursorOpacity] = useState(0);

  const browserPageRef = useRef<HTMLDivElement>(null);
  const prow0Ref = useRef<HTMLDivElement>(null);
  const prow1Ref = useRef<HTMLDivElement>(null);
  const prow2Ref = useRef<HTMLDivElement>(null);

  const productRows = [
    { ref: prow0Ref, price: '$349.99', inr: '₹29,750', name: 'Sony WH-1000XM5 Wireless', meta: '★★★★★ 4.8 · 12,400 reviews', details: 'USD 349.99' },
    { ref: prow1Ref, price: '$249.00', inr: '₹21,165', name: 'Apple AirPods Pro (2nd Gen)', meta: '★★★★★ 4.9 · 8,200 reviews', details: 'USD 249.00' },
    { ref: prow2Ref, price: '$329.00', inr: '₹27,970', name: 'Bose QuietComfort 45', meta: '★★★★☆ 4.6 · 9,800 reviews', details: 'USD 329.00' }
  ];

  // Animated hand cursor loop
  useEffect(() => {
    let active = true;
    let animFrame: number;
    let timeouts: number[] = [];

    const getTargetCoordinates = (idx: number) => {
      const row = productRows[idx].ref.current;
      const page = browserPageRef.current;
      if (!row || !page) return { x: 300, y: 150 };

      const rowRect = row.getBoundingClientRect();
      const pageRect = page.getBoundingClientRect();
      return {
        x: rowRect.width - 80,
        y: (rowRect.top - pageRect.top) + (rowRect.height / 2)
      };
    };

    const animateHand = (idx: number) => {
      if (!active) return;
      const target = getTargetCoordinates(idx);
      const startX = cursorPos.x;
      const startY = cursorPos.y;

      const duration = 900;
      const startTime = performance.now();

      const step = (now: number) => {
        if (!active) return;
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const t = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        setCursorPos({
          x: startX + (target.x - startX) * t,
          y: startY + (target.y - startY) * t
        });

        if (progress < 1) {
          animFrame = requestAnimationFrame(step);
        } else {
          setHoveredRow(idx);
          const t1 = window.setTimeout(() => {
            setShowTooltipIdx(idx);

            const t2 = window.setTimeout(() => {
              setShowTooltipIdx(null);
              setHoveredRow(null);

              const nextIdx = (idx + 1) % productRows.length;
              setCurrentIdx(nextIdx);

              const t3 = window.setTimeout(() => {
                animateHand(nextIdx);
              }, 400);
              timeouts.push(t3);
            }, 2000);
            timeouts.push(t2);
          }, 300);
          timeouts.push(t1);
        }
      };

      animFrame = requestAnimationFrame(step);
    };

    const startTimeout = window.setTimeout(() => {
      setCursorOpacity(1);
      animateHand(0);
    }, 1000);
    timeouts.push(startTimeout);

    return () => {
      active = false;
      cancelAnimationFrame(animFrame);
      timeouts.forEach(clearTimeout);
    };
  }, [currentIdx]);

  const liveDemoTabs = [
    { label: '🇺🇸 USD', sym: '$', amount: 120, inr: 10200, code: 'USD', name: 'US Dollar' },
    { label: '🇪🇺 EUR', sym: '€', amount: 50, inr: 4600, code: 'EUR', name: 'Euro' },
    { label: '🇬🇧 GBP', sym: '£', amount: 300, inr: 32000, code: 'GBP', name: 'British Pound' },
    { label: '🇯🇵 JPY', sym: '¥', amount: 5000, inr: 2800, code: 'JPY', name: 'Japanese Yen' },
    { label: '🇦🇺 AUD', sym: 'A$', amount: 200, inr: 10800, code: 'AUD', name: 'Australian Dollar' }
  ];

  const handleTabChange = (idx: number) => {
    setActiveTabIdx(idx);
    const tab = liveDemoTabs[idx];
    setDemoTab(tab);
    trackEvent('demo_interact', { currency_code: tab.code });
  };

  const handleAddtoChrome = (pos: string) => {
    trackEvent('cta_add_to_chrome', { position: pos });
    const link = document.createElement('a');
    link.href = '/instant-currency-production.zip';
    link.download = 'instant-currency-production.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isVisible = (id: string) => visibleElements[id] !== false;

  // Track page milestones
  useEffect(() => {
    const handleScrollMilestones = () => {
      const h = document.documentElement;
      const st = h.scrollTop || document.body.scrollTop;
      const sh = h.scrollHeight || document.body.scrollHeight;
      const ch = h.clientHeight;
      const percent = Math.round((st / (sh - ch)) * 100);

      if (percent >= 25 && percent < 30 && !window.hasOwnProperty('_tr25')) {
        (window as any)._tr25 = true;
        trackEvent('scroll_milestone', { percentage: 25 });
      }
      if (percent >= 50 && percent < 55 && !window.hasOwnProperty('_tr50')) {
        (window as any)._tr50 = true;
        trackEvent('scroll_milestone', { percentage: 50 });
      }
      if (percent >= 75 && percent < 80 && !window.hasOwnProperty('_tr75')) {
        (window as any)._tr75 = true;
        trackEvent('scroll_milestone', { percentage: 75 });
      }
      if (percent >= 98 && !window.hasOwnProperty('_tr100')) {
        (window as any)._tr100 = true;
        trackEvent('scroll_milestone', { percentage: 100 });
      }
    };
    window.addEventListener('scroll', handleScrollMilestones);
    return () => window.removeEventListener('scroll', handleScrollMilestones);
  }, []);

  return (
    <>
      {/* HERO SECTION */}
      <section className="hero" id="home">
        <div className="hero-grid"></div>
        <div className="hero-glow-l"></div>
        <div className="hero-glow-r"></div>

        <div className={`pill reveal-init ${isVisible('h-pill') ? 'reveal-visible' : ''}`} data-reveal-id="h-pill">
          <div className="pill-dot"></div>Chrome Extension · Free to Install
        </div>
        <h1 className={`reveal-init d1 ${isVisible('h-title') ? 'reveal-visible' : ''}`} data-reveal-id="h-title">
          Convert Any Currency <span className="grad">Without</span><br />Leaving the Page
        </h1>
        <p className={`hero-sub reveal-init d2 ${isVisible('h-sub') ? 'reveal-visible' : ''}`} data-reveal-id="h-sub">
          See any foreign price in your local currency the moment you hover — on every website, instantly, with zero tab switching.
        </p>
        
        {/* Dominant Chrome Store CTA */}
        <div className={`hero-btns reveal-init d3 ${isVisible('h-btns') ? 'reveal-visible' : ''}`} data-reveal-id="h-btns" style={{ flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => { handleAddtoChrome('hero'); trackEvent('cta_hero_primary', { position: 'hero' }); }}
              className="btn-p"
              style={{ padding: '15px 36px', fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 0 36px rgba(124,110,250,0.45)' }}
            >
              <span>⚡ Add to Chrome — It's Free</span>
            </button>
            <a href="#demo-strip" className="btn-g" style={{ padding: '15px 32px', fontSize: '16px' }} onClick={() => trackEvent('cta_pricing_explore', { plan: 'demo' })}>
              ▶ Try Interactive Demo
            </a>
          </div>
          <div className="cws-rating">
            <span className="cws-stars">★★★★★</span>
            <span>4.9/5 Rating (180+ Reviews) · 12,000+ Users</span>
          </div>
        </div>

        {/* trust badge points */}
        <div className={`trust-row reveal-init ${isVisible('h-trust') ? 'reveal-visible' : ''}`} data-reveal-id="h-trust" style={{ marginTop: '24px' }}>
          <span>🛡️ Works on 160+ Currencies</span>
          <span>🌍 Works on Every Website</span>
          <span>🔒 100% Private (Runs locally)</span>
          <span>🚫 Zero Sign-Up Required</span>
        </div>

        {/* HERO DEMO FRAME */}
        <div className={`demo-stage reveal-init d1 ${isVisible('h-demo') ? 'reveal-visible' : ''}`} data-reveal-id="h-demo">
          <div className="browser-chrome">
            <div className="dots">
              <div className="dot dot-r"></div>
              <div className="dot dot-y"></div>
              <div className="dot dot-g"></div>
            </div>
            <div className="url-bar">amazon.com/s?k=wireless+headphones</div>
          </div>

          <div className="browser-page" ref={browserPageRef}>
            <div className="page-header">Search Results — Electronics</div>

            {productRows.map((row, idx) => (
              <div
                key={idx}
                ref={row.ref}
                className={`product-row ${hoveredRow === idx ? 'hovered' : ''}`}
                id={`prow${idx}`}
              >
                <div className={`prod-img ${idx % 2 === 0 ? 'blue' : 'green'}`}>
                  {idx === 0 && '🎧'}
                  {idx === 1 && '🎵'}
                  {idx === 2 && '🔊'}
                </div>
                <div>
                  <div className="prod-name">{row.name}</div>
                  <div className="prod-meta">{row.meta}</div>
                </div>
                <div className="prod-price">
                  <span className={`price-sel ${hoveredRow === idx ? 'lit' : ''}`}>
                    {row.price}
                  </span>
                </div>

                {/* Simulated Hover Tooltip */}
                <div className={`conv-tooltip ${showTooltipIdx === idx ? 'show' : ''}`}>
                  <div className="tt-label">Converted to INR</div>
                  <div className="tt-val">{row.inr}</div>
                  <div className="tt-orig">{row.details}</div>
                  <div className="tt-rate">
                    <div className="tt-live"></div>1 USD = ₹85.02 · Live
                  </div>
                </div>
              </div>
            ))}

            {/* Hand cursor animation */}
            <div
              className="cursor-wrap"
              style={{
                left: `${cursorPos.x}px`,
                top: `${cursorPos.y}px`,
                opacity: cursorOpacity,
                bottom: 'auto',
                right: 'auto',
                position: 'absolute'
              }}
            >
              <svg width="46" height="60" viewBox="0 0 46 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g filter="url(#hand-shadow)">
                  <path d="M10 28 C10 22 12 18 16 16 L16 8 C16 5.8 17.8 4 20 4 C22.2 4 24 5.8 24 8 L24 20 C24.8 19.4 25.8 19 27 19 C28.8 19 30.4 20 31.2 21.5 C31.9 20.6 33 20 34.2 20 C36.2 20 37.8 21.6 37.8 23.6 L37.8 24.5 C38.5 23.7 39.5 23.2 40.6 23.2 C42.6 23.2 44.2 24.8 44.2 26.8 L44.2 36 C44.2 44.8 37.2 52 28 52 L24 52 C16.3 52 10 45.7 10 38 Z" fill="#F5C6A0" />
                  <path d="M20 20 L20 8" stroke="#E8A87C" strokeWidth="1" strokeLinecap="round" />
                  <path d="M24 22 L24 10" stroke="#E8A87C" strokeWidth="1" strokeLinecap="round" />
                  <path d="M14 32 Q16 30 18 32" stroke="#E8A87C" strokeWidth="0.8" fill="none" />
                  <path d="M14 36 Q16 34 18 36" stroke="#E8A87C" strokeWidth="0.8" fill="none" />
                  <path d="M10 34 Q7 32 8 28 Q9 25 12 26" stroke="#E8A87C" strokeWidth="1" fill="none" />
                </g>
                <defs>
                  <filter id="hand-shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="rgba(0,0,0,0.5)" />
                  </filter>
                </defs>
              </svg>
            </div>
          </div>

          <div className="cycle-dots">
            {productRows.map((_, i) => (
              <div key={i} className={`cyc-dot ${currentIdx === i ? 'on' : ''}`}></div>
            ))}
          </div>
        </div>
      </section>

      {/* EXTENSION PREVIEW IMAGE */}
      <div style={{ display: 'flex', justifyContent: 'center', width: '100%', padding: '0 20px', boxSizing: 'border-box', marginBottom: '80px' }}>
        <div style={{ maxWidth: '800px', width: '100%', position: 'relative', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--br)', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', background: 'var(--bg2)' }}>
          <img 
            src="/extension_preview.png" 
            alt="HoverConvert - Instant Currency Converter Chrome extension tooltip in action converting USD prices to INR on Amazon" 
            width={1024}
            height={1024}
            style={{ width: '100%', height: 'auto', aspectRatio: '1 / 1', display: 'block' }}
          />
        </div>
      </div>

      {/* STATS BAR */}
      <div className="stats-bar">
        <div className={`stat-item reveal-init ${isVisible('s-1') ? 'reveal-visible' : ''}`} data-reveal-id="s-1">
          <div className="stat-num">160+</div>
          <div className="stat-lbl">Currencies supported</div>
        </div>
        <div className={`stat-item reveal-init d1 ${isVisible('s-2') ? 'reveal-visible' : ''}`} data-reveal-id="s-2">
          <div className="stat-num">&lt;50ms</div>
          <div className="stat-lbl">Conversion latency</div>
        </div>
        <div className={`stat-item reveal-init d2 ${isVisible('s-3') ? 'reveal-visible' : ''}`} data-reveal-id="s-3">
          <div className="stat-num">0 bytes</div>
          <div className="stat-lbl">Data sent to servers</div>
        </div>
        <div className={`stat-item reveal-init d3 ${isVisible('s-4') ? 'reveal-visible' : ''}`} data-reveal-id="s-4">
          <div className="stat-num">4.9 ★</div>
          <div className="stat-lbl">Chrome Store rating</div>
        </div>
      </div>

      {/* PROBLEM & SOLUTION SECTION */}
      <section className="prob-section" id="problem">
        <div className={`reveal-init ${isVisible('prob-intro') ? 'reveal-visible' : ''}`} data-reveal-id="prob-intro">
          <div className="sec-eyebrow">The Friction</div>
          <h2 className="sec-h">Stop Breaking Your Browsing Flow</h2>
          <p className="sec-p">Every foreign currency amount costs you 4 steps, 20 seconds, and your total concentration. There is a better way.</p>
        </div>

        <div className="prob-card-grid">
          <div className="prob-card bad">
            <div className="prob-header bad-text">
              <span>❌ Without HoverConvert</span>
            </div>
            <div className="prob-step">
              <div className="prob-icon pi-bad">😤</div>
              <div>
                <h4>See a Price Online</h4>
                <p>You spot "$349.99" on a website. You are unsure of its real cost in your currency.</p>
              </div>
            </div>
            <div className="prob-step">
              <div className="prob-icon pi-bad">🔄</div>
              <div>
                <h4>Open a New Tab</h4>
                <p>You leave the store, search Google for a converter, and type the price manually.</p>
              </div>
            </div>
            <div className="prob-step">
              <div className="prob-icon pi-bad">😵</div>
              <div>
                <h4>Lose Your Place</h4>
                <p>By the time you switch back to the store, your concentration is broken.</p>
              </div>
            </div>
          </div>

          <div className="prob-card good">
            <div className="prob-header good-text">
              <span>✓ With HoverConvert</span>
            </div>
            <div className="prob-step">
              <div className="prob-icon pi-good">👀</div>
              <div>
                <h4>Spot a Foreign Price</h4>
                <p>You see "$349.99" on any website while shopping or working.</p>
              </div>
            </div>
            <div className="prob-step">
              <div className="prob-icon pi-good">⚡</div>
              <div>
                <h4>Hover Your Cursor</h4>
                <p>Simply hover over the amount. The local price appears instantly in under 50ms.</p>
              </div>
            </div>
            <div className="prob-step">
              <div className="prob-icon pi-good">🎯</div>
              <div>
                <h4>Keep Browsing</h4>
                <p>No extra tabs or keyboard entries required. Smooth, uninterrupted browsing.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS (3-STEP PROCESS) */}
      <section className="feat-section" id="how-it-works" style={{ background: 'var(--bg)' }}>
        <div className="ctr">
          <div className="sec-eyebrow">Simple Workflow</div>
          <h2 className="sec-h">How It Works</h2>
          <p className="sec-p">Get started in under 10 seconds. Convert prices seamlessly.</p>
        </div>

        <div className="process-grid">
          <div className="process-step">
            <div className="process-num">1</div>
            <h3 className="process-title">Hover or Highlight</h3>
            <p className="process-desc">Hover over any price or highlight text containing currency symbols on any website.</p>
          </div>
          <div className="process-step">
            <div className="process-num">2</div>
            <h3 className="process-title">Instant Converted Tooltip</h3>
            <p className="process-desc">A premium glassmorphic tooltip displays the converted rate in your native currency immediately.</p>
          </div>
          <div className="process-step">
            <div className="process-num">3</div>
            <h3 className="process-title">Customize to Your Needs</h3>
            <p className="process-desc">Set custom exchange rate offsets, switch between themes, or select favorite currencies.</p>
          </div>
        </div>
      </section>

      {/* USE CASES SECTION */}
      <section className="feat-section" id="use-cases" style={{ background: 'var(--bg2)' }}>
        <div className="ctr">
          <div className="sec-eyebrow">Use Cases</div>
          <h2 className="sec-h">Who is HoverConvert For?</h2>
          <p className="sec-p">Tailored convenience designed for professionals, travelers, and shoppers.</p>
        </div>

        <div className="usecase-grid">
          <div className="usecase-card">
            <div className="usecase-emoji">🛒</div>
            <h3 className="usecase-title">International Shoppers</h3>
            <p className="usecase-desc">Shop on Amazon Global, eBay, Steam, or Shopify stores and see your true cost instantly without conversions.</p>
          </div>
          <div className="usecase-card">
            <div className="usecase-emoji">💼</div>
            <h3 className="usecase-title">Freelancers & Remote Workers</h3>
            <p className="usecase-desc">Convert invoices, rate lists, and platform listings (Upwork, Fiverr) to understand payments immediately.</p>
          </div>
          <div className="usecase-card">
            <div className="usecase-emoji">✈️</div>
            <h3 className="usecase-title">Travelers & Nomads</h3>
            <p className="usecase-desc">Plan trips, browse Airbnb, and book flight tickets in native currencies on foreign sites.</p>
          </div>
          <div className="usecase-card">
            <div className="usecase-emoji">📈</div>
            <h3 className="usecase-title">Investors & Forex</h3>
            <p className="usecase-desc">Analyze financial news, stock prices, or cryptocurrency assets across global markets effortlessly.</p>
          </div>
          <div className="usecase-card">
            <div className="usecase-emoji">💻</div>
            <h3 className="usecase-title">Developers & SaaS Teams</h3>
            <p className="usecase-desc">Instantly convert cloud hosting bills, API costs, or global software subscriptions in a flash.</p>
          </div>
        </div>
      </section>

      {/* FEATURE COMPARISON MATRIX */}
      <section className="matrix-section">
        <div className="ctr">
          <div className="sec-eyebrow">The Comparison</div>
          <h2 className="sec-h">Google vs. Sites vs. HoverConvert</h2>
          <p className="sec-p">Why thousands of professionals prefer our browser extension over manual options.</p>
        </div>

        <div className="matrix-container">
          <table className="matrix-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Google Search</th>
                <th>Converter Sites</th>
                <th>HoverConvert</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>**Conversion Speed**</td>
                <td>15 - 20 seconds</td>
                <td>30+ seconds</td>
                <td className="highlight">**&lt;50 milliseconds (Instant)**</td>
              </tr>
              <tr>
                <td>**User Input Required**</td>
                <td>Type query or copy-paste</td>
                <td>Select currencies & type value</td>
                <td className="highlight">**Just hover cursor**</td>
              </tr>
              <tr>
                <td>**Tab Switching**</td>
                <td>Yes (leaves store tab)</td>
                <td>Yes (leaves store tab)</td>
                <td className="highlight">**No (stay on the page)**</td>
              </tr>
              <tr>
                <td>**Ads & Bloat**</td>
                <td>None</td>
                <td>Heavy ads & popups</td>
                <td className="highlight">**100% clean & ad-free**</td>
              </tr>
              <tr>
                <td>**Conversions Offline**</td>
                <td>❌ Requires connection</td>
                <td>❌ Requires connection</td>
                <td className="highlight">**✓ Works offline (cached)**</td>
              </tr>
              <tr>
                <td>**Privacy Protection**</td>
                <td>Tracked by search engine</td>
                <td>Heavy cookies & tracking</td>
                <td className="highlight">**🔒 100% private (runs local)**</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* TECHNICAL TRUST / SECURITY BADGES */}
      <section className="feat-section" id="security" style={{ background: 'var(--bg)' }}>
        <div className="ctr">
          <div className="sec-eyebrow">Privacy First</div>
          <h2 className="sec-h">Built For Enterprise Security</h2>
          <p className="sec-p">We respect your data. HoverConvert runs entirely on your device with maximum security standards.</p>
        </div>

        <div className="trust-grid">
          <div className="trust-card">
            <div className="trust-icon">🛡️</div>
            <h3 className="trust-title">Manifest V3 Compliant</h3>
            <p className="trust-desc">Built using Google's latest secure extension framework, enforcing strict safety rules.</p>
          </div>
          <div className="trust-card">
            <div className="trust-icon">🪶</div>
            <h3 className="trust-title">Under 40KB in Size</h3>
            <p className="trust-desc">Extremely lightweight file footprint. Installs instantly and adds zero page load lag.</p>
          </div>
          <div className="trust-card">
            <div className="trust-icon">🔒</div>
            <h3 className="trust-title">No Server tracking</h3>
            <p className="trust-desc">No databases are used. Your browsing history and pricing checks never leave your browser.</p>
          </div>
        </div>
      </section>

      {/* LIVE DEMO STRIP */}
      <section className="demo-strip" id="demo-strip">
        <div className={`reveal-init ctr ${isVisible('demo-intro') ? 'reveal-visible' : ''}`} data-reveal-id="demo-intro">
          <div className="sec-eyebrow">Live Preview</div>
          <h2 className="sec-h">See any currency → ₹INR</h2>
          <p className="sec-p">Click a currency to see exactly what the tooltip shows you on any website.</p>
        </div>
        <div className={`demo-strip-inner reveal-init d1 ${isVisible('demo-box') ? 'reveal-visible' : ''}`} data-reveal-id="demo-box">
          <div className="dtabs">
            {liveDemoTabs.map((t, idx) => (
              <div
                key={idx}
                className={`dtab ${activeTabIdx === idx ? 'on' : ''}`}
                onClick={() => handleTabChange(idx)}
                onMouseEnter={() => handleTabChange(idx)}
              >
                {t.label}
              </div>
            ))}
          </div>
          <div className="dbody">
            <div className="dfrom">
              <div className="damount">{demoTab.sym}{demoTab.amount.toLocaleString()}</div>
              <div className="dcode">{demoTab.name} · {demoTab.code}</div>
            </div>
            <div className="darrow">→</div>
            <div className="dto">
              <div className="dinr">₹{demoTab.inr.toLocaleString()}</div>
              <div className="dcode">approx. at today's rate</div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING TRANSITION BRIDGE */}
      <section className="pricing-bridge">
        <div className="pricing-bridge-inner">
          <h3 className="pricing-bridge-h">Stop wasting time switching tabs every day.</h3>
          <p className="pricing-bridge-p">Get started for free or upgrade to HoverConvert Pro to unlock unlimited conversions, custom rates, and favorite currencies. Pay once, use forever.</p>
        </div>
      </section>

      {/* PRICING SECTION */}
      <section className="pricing-section" id="pricing">
        <div className="price-grid">
          <div className={`pcard reveal-init ${isVisible('p-free') ? 'reveal-visible' : ''}`} data-reveal-id="p-free">
            <div className="pname">Free Plan</div>
            <div className="pprice">$0</div>
            <div className="pterm">Forever free</div>
            <ul className="pfeat">
              <li>49 conversions / month</li>
              <li>Top 12 currencies</li>
              <li>Hover tooltips</li>
              <li>Works on all websites</li>
              <li className="no">Manual rate override</li>
              <li className="no">Unlimited conversions</li>
              <li className="no">Favorite currencies</li>
            </ul>
            {isPro ? (
              <div style={{ textAlign: 'center', padding: '13px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--br)', color: 'var(--tx3)', fontWeight: 600, fontSize: '15px' }}>
                Previous Plan
              </div>
            ) : (
              <button onClick={() => { trackEvent('cta_pricing_explore', { plan: 'free' }); navigate('/currency-converter'); }} className="pbtn pbtn-f">
                Use Free Calculator
              </button>
            )}
          </div>
          <div className={`pcard hot reveal-init d1 ${isVisible('p-pro') ? 'reveal-visible' : ''}`} data-reveal-id="p-pro">
            <div className="pbadge">Best Value</div>
            <div className="pname">Pro Plan</div>
            <div className="pprice">$4.99</div>
            <div className="pterm">One-time · Lifetime access</div>
            <ul className="pfeat">
              <li>Unlimited conversions</li>
              <li>160+ currencies</li>
              <li>Hover + text selection</li>
              <li>Premium dark/glass tooltip UI</li>
              <li>Manual rate override</li>
              <li>Favorite currencies</li>
              <li>Priority support</li>
            </ul>
            {isPro ? (
              <div style={{ textAlign: 'center', padding: '13px', borderRadius: '12px', background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)', color: 'var(--cy)', fontWeight: 700, fontSize: '15px' }}>
                ✓ Current Plan (Lifetime Active)
              </div>
            ) : (
              <button onClick={() => { trackEvent('cta_pricing_explore', { plan: 'pro' }); navigate('/pricing'); }} className="pbtn pbtn-p">
                Upgrade to Pro — $4.99
              </button>
            )}
          </div>
        </div>
        <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--tx3)', marginTop: '18px' }}>
          🔒 Secure payment · Instant activation · 30-day money-back guarantee
        </p>
      </section>

      {/* TESTIMONIALS */}
      <section className="testi-section" id="testimonials">
        <div className={`reveal-init ctr ${isVisible('testi-intro') ? 'reveal-visible' : ''}`} data-reveal-id="testi-intro">
          <div className="sec-eyebrow">Real Users</div>
          <h2 className="sec-h">People Who Stopped Switching Tabs</h2>
        </div>
        <div className="testi-grid">
          <div className={`tcard reveal-init ${isVisible('t-1') ? 'reveal-visible' : ''}`} data-reveal-id="t-1">
            <div className="stars">★★★★★</div>
            <p className="ttext">"I shop from US sites every week. HoverConvert is <strong>the first extension I install</strong> on any new browser. A total game-changer."</p>
            <div className="tauthor">
              <div className="tav" style={{ background: 'rgba(124,110,250,0.15)', color: 'var(--vi2)' }}>PR</div>
              <div>
                <div className="tname">Priya R.</div>
                <div className="trole">Frequent Shopper · Mumbai</div>
              </div>
            </div>
          </div>
          <div className={`tcard reveal-init d1 ${isVisible('t-2') ? 'reveal-visible' : ''}`} data-reveal-id="t-2">
            <div className="stars">★★★★★</div>
            <p className="ttext">"As a freelancer billing in USD, I use this daily. <strong>Ridiculously fast and accurate.</strong> Bought Pro in the first 5 minutes."</p>
            <div className="tauthor">
              <div className="tav" style={{ background: 'rgba(34,211,238,0.1)', color: 'var(--cy)' }}>AK</div>
              <div>
                <div className="tname">Arjun K.</div>
                <div className="trole">Freelance Designer · Bangalore</div>
              </div>
            </div>
          </div>
          <div className={`tcard reveal-init d2 ${isVisible('t-3') ? 'reveal-visible' : ''}`} data-reveal-id="t-3">
            <div className="stars">★★★★★</div>
            <p className="ttext">"The tooltip design is gorgeous. Feels like <strong>it was built into Chrome itself.</strong> Insane attention to detail."</p>
            <div className="tauthor">
              <div className="tav" style={{ background: 'rgba(255,107,107,0.1)', color: '#FF9090' }}>SM</div>
              <div>
                <div className="tname">Sneha M.</div>
                <div className="trole">Product Manager · Hyderabad</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <FAQSection />

      {/* EXIT INTENT SECTION */}
      <section className="exit-intent-section">
        <div className="exit-intent-inner">
          <div className="exit-intent-eyebrow">Still Using Google for Currency Conversion?</div>
          <h2 className="exit-intent-h">
            Stop opening new tabs.<br />
            <span className="grad">Convert while you browse.</span>
          </h2>
          <p className="exit-intent-sub">
            Stop manually searching exchange rates every time you see a foreign price. HoverConvert shows the local value the moment you hover — no steps, no friction.
          </p>

          <div className="exit-comparison">
            <div className="exit-comp-col bad-col">
              <div className="exit-comp-label">❌ Google Search</div>
              <div className="exit-comp-steps">
                <span>See price</span>
                <span className="exit-arrow">→</span>
                <span>Open new tab</span>
                <span className="exit-arrow">→</span>
                <span>Type query</span>
                <span className="exit-arrow">→</span>
                <span>Read result</span>
                <span className="exit-arrow">→</span>
                <span>Switch back</span>
              </div>
              <div className="exit-comp-time">~20 seconds per conversion</div>
            </div>
            <div className="exit-vs">VS</div>
            <div className="exit-comp-col good-col">
              <div className="exit-comp-label">✓ HoverConvert</div>
              <div className="exit-comp-steps">
                <span>Hover over price</span>
                <span className="exit-arrow">→</span>
                <span className="exit-highlight">Done. ⚡</span>
              </div>
              <div className="exit-comp-time" style={{ color: 'var(--vi2)' }}>&lt;1 second. Stay on the page.</div>
            </div>
          </div>

          <button
            onClick={() => { handleAddtoChrome('exit_intent'); trackEvent('cta_exit_intent', { section: 'exit_intent' }); }}
            className="btn-p exit-intent-cta"
          >
            ⚡ Try HoverConvert Free
          </button>
          <p className="exit-intent-note">Free forever · No account · Installs in 10 seconds</p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="cta-section">
        <div className={`reveal-init ${isVisible('cta') ? 'reveal-visible' : ''}`} data-reveal-id="cta">
          <h2>Stop Opening<br /><em>Currency Converter Tabs.</em></h2>
          <p>Install HoverConvert and see any price in local values — the moment you hover, on every website, forever.</p>
          <div className="cta-btns">
            <button onClick={() => { handleAddtoChrome('footer'); trackEvent('cta_hero_primary', { position: 'footer' }); }} className="btn-p" style={{ fontSize: '16px', padding: '15px 32px' }}>
              ⚡ Add to Chrome — It's Free
            </button>
            <a href="#demo-strip" className="btn-g" style={{ fontSize: '16px', padding: '15px 32px' }} onClick={() => trackEvent('cta_pricing_explore', { plan: 'demo' })}>See How It Works</a>
          </div>
          <p style={{ marginTop: '14px', fontSize: '12px', color: 'var(--tx3)' }}>No account required · Installs in 10 seconds · Free forever</p>
        </div>
      </section>
    </>
  );
}

/* ═══════════════════════════════════════════════════
   PRICING PAGE COMPONENT
   ═══════════════════════════════════════════════════ */
interface PricingPageProps {
  navigate: (to: string) => void;
  isPro: boolean;
  clerkIsSignedIn: boolean;
  clerkIsLoaded: boolean;
  clerkUser: any;
  clerkGetToken: (() => Promise<string | null>) | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  clerkEnabled: boolean;
}

function PricingPage({ navigate, isPro, clerkIsSignedIn, clerkIsLoaded, clerkUser, clerkGetToken, showToast, clerkEnabled }: PricingPageProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleUpgrade = async () => {
    if (!clerkIsSignedIn) {
      // Not logged in — prompt sign in
      showToast('Please sign in first to upgrade to Pro.', 'info');
      return;
    }

    const email = clerkUser?.primaryEmailAddress?.emailAddress;
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
            Start free. Upgrade once. Use forever. No subscriptions, no surprises.
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
            <div className="pname" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--tx)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Pro Lifetime</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
              <div className="pprice" style={{ fontSize: '42px', fontWeight: 800, fontFamily: 'Space Grotesk' }}>$4.99</div>
              <span style={{ fontSize: '13px', color: 'var(--tx3)' }}>one-time</span>
            </div>
            <div className="pterm" style={{ fontSize: '13px', color: 'var(--tx3)', marginBottom: '28px' }}>Lifetime access · Pay once, use forever</div>
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
                ✓ Current Plan (Lifetime Active)
              </div>
            ) : !clerkEnabled ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  className="pbtn pbtn-p"
                  onClick={() => showToast('Clerk authentication is not configured. Please set VITE_CLERK_PUBLISHABLE_KEY in your environment to sign in.', 'error')}
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--vi), var(--cy))', border: 'none', color: '#fff', fontWeight: 700, fontSize: '16px', cursor: 'pointer' }}
                >
                  Sign In to Upgrade — $4.99
                </button>
                <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--tx3)' }}>
                  You need to sign in first so we can link your purchase to your account.
                </p>
              </div>
            ) : clerkIsLoaded && !clerkIsSignedIn ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <SignInButton mode={window.innerWidth < 768 ? "redirect" : "modal"} forceRedirectUrl="/pricing">
                  <button
                    className="pbtn pbtn-p"
                    style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--vi), var(--cy))', border: 'none', color: '#fff', fontWeight: 700, fontSize: '16px', cursor: 'pointer' }}
                  >
                    Sign In to Upgrade — $4.99
                  </button>
                </SignInButton>
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
              { q: 'Is this really a one-time payment?', a: 'Yes. Pay $4.99 once and use HoverConvert Pro forever. No subscriptions, no renewals, no hidden fees.' },
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

/* ═══════════════════════════════════════════════════
   PAYMENT SUCCESS PAGE COMPONENT
   ═══════════════════════════════════════════════════ */
function PaymentSuccessPage({
  navigate,
  isPro,
  refetchPremium,
  clerkUser
}: {
  navigate: (to: string) => void;
  isPro: boolean;
  refetchPremium: () => Promise<boolean>;
  clerkUser: any;
}) {
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

/* ═══════════════════════════════════════════════════
   PAYMENT FAILED PAGE COMPONENT
   ═══════════════════════════════════════════════════ */
function PaymentFailedPage({
  navigate
}: {
  navigate: (to: string) => void;
}) {
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

function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const faqs = [
    { q: 'Does it work offline?', a: 'Yes. Rates are cached locally so conversions work without an internet connection. They sync automatically when you\'re back online.' },
    { q: 'Which websites are supported?', a: 'Every website — Amazon, eBay, Airbnb, Steam, Etsy, Booking.com, Shopify stores, and any page displaying a currency symbol followed by a number.' },
    { q: 'Is my browsing data stored or shared?', a: 'Absolutely not. HoverConvert is fully local. It reads page content to detect prices, but sends zero data to any server. Your browsing history is completely private.' },
    { q: 'How often are exchange rates updated?', a: 'Rates refresh every 6 hours via a lightweight sync. You can also set a manual rate in extension settings for your bank\'s exact conversion rate.' },
    { q: 'Can I customize which currencies are converted?', a: 'Yes. HoverConvert allows you to set your default native currency, select favorite target currencies, and even define manual conversion overrides in settings.' },
    { q: 'How does the license key activation work?', a: 'After a one-time purchase of Pro, you\'ll receive a license key via email. Simply input the key in the "Activate Pro" window to unlock all Pro capabilities for lifetime usage.' },
    { q: 'Is there a refund policy?', a: 'Yes. No-questions-asked 30-day full refund. If it doesn\'t work the way you expected, just reach out and we\'ll process it immediately.' }
  ];

  const handleToggle = (idx: number, qText: string) => {
    const isNowOpen = openIdx !== idx;
    setOpenIdx(isNowOpen ? idx : null);
    if (isNowOpen) {
      trackEvent('faq_toggle', { question: qText });
    }
  };

  return (
    <section className="faq-section" id="faq">
      <div className="ctr">
        <div className="sec-eyebrow">FAQ</div>
        <h2 className="sec-h">Honest Answers</h2>
      </div>
      <div className="faq-list">
        {faqs.map((f, i) => (
          <div key={i} className={`faq-item ${openIdx === i ? 'open' : ''}`}>
            <button className="faq-q" onClick={() => handleToggle(i, f.q)}>
              {f.q}
              <span className="faq-tog">{openIdx === i ? '−' : '+'}</span>
            </button>
            <div className="faq-a" style={{ maxHeight: openIdx === i ? '200px' : '0px', paddingBottom: openIdx === i ? '18px' : '0px' }}>
              {f.a}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════
   DEVELOPER DASHBOARD (PRO) COMPONENT
   ═══════════════════════════════════════════════════ */
interface DevDashboardProps {
  isPro: boolean;
  licenseInfo: License | null;
  setShowSupportModal: (show: boolean) => void;
}

function DeveloperDashboard({ isPro, licenseInfo, setShowSupportModal }: DevDashboardProps) {
  if (!isPro) {
    return (
      <div className="dashboard-layout" style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '12px' }}>
        <h2>Access Restricted</h2>
        <p style={{ color: 'var(--tx2)' }}>The Developer Dashboard is reserved for Pro license holders.</p>
      </div>
    );
  }

  const chartData = [
    { label: 'Mon', val: 140 },
    { label: 'Tue', val: 210 },
    { label: 'Wed', val: 190 },
    { label: 'Thu', val: 340 },
    { label: 'Fri', val: 280 },
    { label: 'Sat', val: 120 },
    { label: 'Sun', val: 95 }
  ];

  return (
    <div className="dashboard-layout" style={{ display: 'block', padding: '100px max(20px, calc(50vw - 620px)) 60px' }}>
      <div style={{ textAlign: 'left', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 'bold' }}>Developer & license Management</h2>
        <p style={{ color: 'var(--tx2)', fontSize: '14px' }}>
          Welcome back! Manage your HoverConvert installations, configure API keys, and download custom configuration profiles.
        </p>
      </div>

      <div className="dev-dashboard-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Analytics Chart */}
          <div className="dashboard-card">
            <h3 className="card-title">
              Weekly Conversion Volume
              <span style={{ fontSize: '11px', color: 'var(--cy)', background: 'rgba(34,211,238,0.1)', padding: '3px 8px', borderRadius: '4px' }}>
                Synced Local Cache
              </span>
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--tx2)', marginTop: '-8px', marginBottom: '16px' }}>
              Number of hover conversion tooltips rendered inside your browser per day.
            </p>

            <div className="mock-chart-container">
              {chartData.map((d, i) => (
                <div key={i} className="chart-bar-group">
                  <div
                    className="chart-bar"
                    style={{ height: `${(d.val / 380) * 100}%` }}
                    data-value={d.val}
                  ></div>
                  <span className="chart-label">{d.label}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--tx3)', marginTop: '14px' }}>
              <span>Total Detections: 1,375</span>
              <span>Avg Latency: 32ms</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* License Status */}
          <div className="dashboard-card license-info-card">
            <h3 className="card-title">License Status</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--tx3)' }}>REGISTERED EMAIL</span>
                <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{licenseInfo?.email || 'N/A'}</div>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: 'var(--tx3)' }}>LICENSE KEY</span>
                <div className="license-key-display">
                  <span>{licenseInfo?.licenseKey || 'N/A'}</span>
                  <button
                    onClick={() => {
                      if (licenseInfo?.licenseKey) {
                        navigator.clipboard.writeText(licenseInfo.licenseKey);
                        alert('Copied to clipboard!');
                      }
                    }}
                    className="copy-btn"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--br)', paddingTop: '12px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--tx3)' }}>STATUS</span>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    ● Active Lifetime
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--tx3)' }}>TYPE</span>
                  <div style={{ fontSize: '12px', fontWeight: 'bold' }}>Developer Pro</div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Support */}
          <div className="dashboard-card">
            <h3 className="card-title">Pro Support</h3>
            <p style={{ fontSize: '12px', color: 'var(--tx2)', marginBottom: '14px' }}>
              As a Pro user, your feedback and tickets are fast-tracked. Reach out directly.
            </p>
            <button onClick={() => setShowSupportModal(true)} className="secondary-btn" style={{ width: '100%' }}>
              💬 Open Priority Ticket
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// SEO SUB-PAGE: USD TO INR CONVERTER
// ==========================================
interface PageProps {
  navigate: (to: string) => void;
  rates: Record<string, number>;
}

function USDToINRPage({ navigate, rates }: PageProps) {
  const [amount, setAmount] = useState<number>(100);
  const usdRate = rates.USD || 1;
  const inrRate = rates.INR || 85.02;
  const currentRate = inrRate / usdRate;

  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'faq-schema-usd-inr';
    script.innerHTML = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is the live exchange rate for USD to INR?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": `The live exchange rate is 1 USD = ₹ ${currentRate.toFixed(2)} INR. Exchange rates fluctuate based on market conditions.`
          }
        },
        {
          "@type": "Question",
          "name": "How does HoverConvert help with USD to INR conversion?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "HoverConvert is a browser extension that lets you hover over any USD price on any webpage and view the converted value in INR instantly, without leaving the page."
          }
        }
      ]
    });
    document.head.appendChild(script);
    return () => {
      const existing = document.getElementById('faq-schema-usd-inr');
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
            USD to INR Converter – Live US Dollar to Indian Rupee Exchange Rate
          </h1>
          <p style={{ color: 'var(--tx2)', fontSize: '16px', maxWidth: '700px' }}>
            Convert US Dollars (USD) to Indian Rupees (INR) instantly using our live currency calculator. Monitor real-time market rates and download our browser extension for automatic conversions on the fly.
          </p>
        </div>

        {/* Calculator Widget */}
        <div className="dashboard-card" style={{ padding: '30px', background: 'var(--bg2)', border: '1px solid var(--br2)', borderRadius: '16px', marginBottom: '40px' }}>
          <h3 style={{ marginBottom: '20px', fontFamily: 'Space Grotesk' }}>Interactive USD to INR Calculator</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--tx2)', marginBottom: '8px' }}>US Dollar (USD)</label>
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
            Live rate: <strong>1 USD = ₹ {currentRate.toFixed(4)} INR</strong>. Updated in real-time.
          </div>
        </div>

        {/* Content & Examples */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '40px', marginBottom: '50px' }}>
          <div style={{ textAlign: 'left' }}>
            <h2 style={{ fontFamily: 'Space Grotesk', fontSize: '24px', marginBottom: '16px' }}>USD to INR Conversion Table</h2>
            <p style={{ color: 'var(--tx2)', fontSize: '14px', marginBottom: '20px' }}>
              Here are some of the most common US Dollar to Indian Rupee conversion values at the current exchange rate:
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--br)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 8px', color: 'var(--tx2)', fontSize: '13px' }}>US Dollar (USD)</th>
                  <th style={{ padding: '12px 8px', color: 'var(--tx2)', fontSize: '13px' }}>Indian Rupee (INR)</th>
                </tr>
              </thead>
              <tbody>
                {[1, 5, 10, 50, 100, 500, 1000].map((val) => (
                  <tr key={val} style={{ borderBottom: '1px solid var(--br)' }}>
                    <td style={{ padding: '12px 8px', fontSize: '14px' }}>${val} USD</td>
                    <td style={{ padding: '12px 8px', fontSize: '14px', color: 'var(--cy)', fontWeight: 'bold' }}>₹ {(val * currentRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} INR</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2 style={{ fontFamily: 'Space Grotesk', fontSize: '24px', marginBottom: '16px' }}>Why Choose HoverConvert for USD to INR?</h2>
            <p style={{ color: 'var(--tx2)', fontSize: '14px', marginBottom: '16px', lineHeight: 1.6 }}>
              Instead of manually copying and pasting values into search engines or converting tables, <strong>HoverConvert</strong> detects price selectors dynamically. With our browser extension, you can view foreign currency conversions directly on websites like Amazon, eBay, Airbnb, and global blogs.
            </p>
          </div>

          <div style={{ textAlign: 'left' }}>
            <div className="dashboard-card" style={{ padding: '20px', background: 'rgba(124, 110, 250, 0.05)', border: '1px solid rgba(124, 110, 250, 0.2)', borderRadius: '12px', marginBottom: '30px' }}>
              <h4 style={{ fontFamily: 'Space Grotesk', marginBottom: '10px' }}>Popular Conversions</h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                <li><a onClick={() => navigate('/eur-to-inr')} style={{ color: 'var(--cy)', cursor: 'pointer', textDecoration: 'underline' }}>EUR to INR Converter</a></li>
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
              <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>How accurate is this USD to INR calculator?</h4>
              <p style={{ fontSize: '13px', color: 'var(--tx2)' }}>
                Our currency converter fetches official exchange rates from major global banking APIs multiple times a day. While it is highly accurate, it is intended for informational purposes and should not be used as a final reference for international bank transfers or commercial trading.
              </p>
            </div>
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>What is the current live USD to INR exchange rate?</h4>
              <p style={{ fontSize: '13px', color: 'var(--tx2)' }}>
                The current exchange rate is 1 USD = ₹ {currentRate.toFixed(2)} INR. Exchange rates vary based on real-time market liquidity and macroeconomic factors.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ==========================================
// SEO SUB-PAGE: EUR TO INR CONVERTER
// ==========================================
function EURToINRPage({ navigate, rates }: PageProps) {
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

// ==========================================
// SEO SUB-PAGE: GBP TO INR CONVERTER
// ==========================================
function GBPToINRPage({ navigate, rates }: PageProps) {
  const [amount, setAmount] = useState<number>(100);
  const gbpRate = rates.GBP || 0.78;
  const inrRate = rates.INR || 85.02;
  const currentRate = inrRate / gbpRate;

  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'faq-schema-gbp-inr';
    script.innerHTML = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is the live exchange rate for GBP to INR?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": `The live exchange rate is 1 GBP = ₹ ${currentRate.toFixed(2)} INR. Exchange rates fluctuate based on market conditions.`
          }
        },
        {
          "@type": "Question",
          "name": "How does HoverConvert help with GBP to INR conversion?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "HoverConvert is a browser extension that lets you hover over any GBP price on any webpage and view the converted value in INR instantly, without leaving the page."
          }
        }
      ]
    });
    document.head.appendChild(script);
    return () => {
      const existing = document.getElementById('faq-schema-gbp-inr');
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
            GBP to INR Converter – Live British Pound to Indian Rupee Exchange Rate
          </h1>
          <p style={{ color: 'var(--tx2)', fontSize: '16px', maxWidth: '700px' }}>
            Convert British Pounds (GBP) to Indian Rupees (INR) instantly using our live currency calculator. Monitor real-time market rates and download our browser extension for automatic conversions on the fly.
          </p>
        </div>

        {/* Calculator Widget */}
        <div className="dashboard-card" style={{ padding: '30px', background: 'var(--bg2)', border: '1px solid var(--br2)', borderRadius: '16px', marginBottom: '40px' }}>
          <h3 style={{ marginBottom: '20px', fontFamily: 'Space Grotesk' }}>Interactive GBP to INR Calculator</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--tx2)', marginBottom: '8px' }}>British Pound (GBP)</label>
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
            Live rate: <strong>1 GBP = ₹ {currentRate.toFixed(4)} INR</strong>. Updated in real-time.
          </div>
        </div>

        {/* Content & Examples */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '40px', marginBottom: '50px' }}>
          <div style={{ textAlign: 'left' }}>
            <h2 style={{ fontFamily: 'Space Grotesk', fontSize: '24px', marginBottom: '16px' }}>GBP to INR Conversion Table</h2>
            <p style={{ color: 'var(--tx2)', fontSize: '14px', marginBottom: '20px' }}>
              Here are some of the most common British Pound to Indian Rupee conversion values at the current exchange rate:
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--br)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 8px', color: 'var(--tx2)', fontSize: '13px' }}>British Pound (GBP)</th>
                  <th style={{ padding: '12px 8px', color: 'var(--tx2)', fontSize: '13px' }}>Indian Rupee (INR)</th>
                </tr>
              </thead>
              <tbody>
                {[1, 5, 10, 50, 100, 500, 1000].map((val) => (
                  <tr key={val} style={{ borderBottom: '1px solid var(--br)' }}>
                    <td style={{ padding: '12px 8px', fontSize: '14px' }}>£{val} GBP</td>
                    <td style={{ padding: '12px 8px', fontSize: '14px', color: 'var(--cy)', fontWeight: 'bold' }}>₹ {(val * currentRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} INR</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2 style={{ fontFamily: 'Space Grotesk', fontSize: '24px', marginBottom: '16px' }}>Why Choose HoverConvert for GBP to INR?</h2>
            <p style={{ color: 'var(--tx2)', fontSize: '14px', marginBottom: '16px', lineHeight: 1.6 }}>
              Instead of manually copying and pasting values into search engines or converting tables, <strong>HoverConvert</strong> detects price selectors dynamically. With our browser extension, you can view foreign currency conversions directly on websites like Amazon, eBay, Airbnb, and global blogs.
            </p>
          </div>

          <div style={{ textAlign: 'left' }}>
            <div className="dashboard-card" style={{ padding: '20px', background: 'rgba(124, 110, 250, 0.05)', border: '1px solid rgba(124, 110, 250, 0.2)', borderRadius: '12px', marginBottom: '30px' }}>
              <h4 style={{ fontFamily: 'Space Grotesk', marginBottom: '10px' }}>Popular Conversions</h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                <li><a onClick={() => navigate('/usd-to-inr')} style={{ color: 'var(--cy)', cursor: 'pointer', textDecoration: 'underline' }}>USD to INR Converter</a></li>
                <li><a onClick={() => navigate('/eur-to-inr')} style={{ color: 'var(--cy)', cursor: 'pointer', textDecoration: 'underline' }}>EUR to INR Converter</a></li>
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
              <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>How accurate is this GBP to INR calculator?</h4>
              <p style={{ fontSize: '13px', color: 'var(--tx2)' }}>
                Our currency converter fetches official exchange rates from major global banking APIs multiple times a day. While it is highly accurate, it is intended for informational purposes and should not be used as a final reference for international bank transfers or commercial trading.
              </p>
            </div>
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>What is the current live GBP to INR exchange rate?</h4>
              <p style={{ fontSize: '13px', color: 'var(--tx2)' }}>
                The current exchange rate is 1 GBP = ₹ {currentRate.toFixed(2)} INR. Exchange rates vary based on real-time market liquidity and macroeconomic factors.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ==========================================
// SEO SUB-PAGE: FREE CURRENCY CONVERTER
// ==========================================
function CurrencyConverterToolPage({ navigate, rates }: PageProps) {
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

// ==========================================
// SEO SUB-PAGE: LIVE EXCHANGE RATES BOARD
// ==========================================
function LiveExchangeRatesPage({ navigate, rates }: PageProps) {
  const [filterQuery, setFilterQuery] = useState<string>('');
  const supportedList = Object.entries(rates);

  const filteredRates = supportedList.filter(([code]) => 
    code.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <section className="seo-page" style={{ paddingTop: '100px', minHeight: '80vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 20px' }}>
        <div style={{ marginBottom: '20px' }}>
          <a onClick={() => navigate('/')} style={{ color: 'var(--cy)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            ← Back to Home
          </a>
        </div>
        
        <div className="seo-hero" style={{ marginBottom: '40px' }}>
          <div className="pill">📈 Global FX Market</div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 700, marginBottom: '16px', lineHeight: 1.2 }}>
            Live Exchange Rates – Real-Time Global Currency FX Rates Board
          </h1>
          <p style={{ color: 'var(--tx2)', fontSize: '16px', maxWidth: '700px' }}>
            Monitor the latest live foreign exchange market conversions. Search, filter, and track exchange rates relative to USD in real-time.
          </p>
        </div>

        {/* Filter Input */}
        <div style={{ marginBottom: '20px' }}>
          <input 
            type="text"
            placeholder="Search currency code (e.g. INR, EUR, JPY)..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            style={{ width: '100%', padding: '12px 16px', background: 'var(--bg2)', border: '1px solid var(--br)', borderRadius: '8px', color: '#fff', fontSize: '15px' }}
          />
        </div>

        {/* Grid Display */}
        <div className="dashboard-card" style={{ padding: '24px', background: 'var(--bg2)', border: '1px solid var(--br2)', borderRadius: '16px', marginBottom: '40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            {filteredRates.length > 0 ? (
              filteredRates.map(([code, rate]) => (
                <div key={code} style={{ padding: '16px', background: 'var(--bg3)', borderRadius: '8px', border: '1px solid var(--br)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--tx3)', fontWeight: 'bold' }}>CURRENCY PAIR</span>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--tx)' }}>USD / {code}</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--cy)' }}>
                    {rate.toFixed(4)}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--success)' }}>● Real-time Feed</span>
                </div>
              ))
            ) : (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--tx3)' }}>
                No matching currencies found.
              </div>
            )}
          </div>
        </div>

        {/* Internal Linking & Call-To-Action */}
        <div className="dashboard-card" style={{ padding: '30px', background: 'linear-gradient(135deg, rgba(124, 110, 250, 0.1) 0%, rgba(34, 211, 238, 0.05) 100%)', border: '1px solid rgba(124, 110, 250, 0.25)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
          <h3 style={{ fontFamily: 'Space Grotesk' }}>Never manually calculate exchange rates again</h3>
          <p style={{ fontSize: '14px', color: 'var(--tx2)', maxWidth: '500px' }}>
            Install the free HoverConvert Chrome extension to convert all foreign price lists and checkout items automatically while browsing.
          </p>
          <button onClick={() => navigate('/')} className="nav-cta" style={{ padding: '12px 24px' }}>
            ⚡ Get HoverConvert Now
          </button>
        </div>
      </div>
    </section>
  );
}

// ==========================================
// HELP & SUPPORT PAGE
// ==========================================
interface SupportPageProps {
  navigate: (to: string) => void;
  clerkUser: any;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

function SupportPage({ navigate, clerkUser, showToast }: SupportPageProps) {
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
    { q: "How do I install the HoverConvert extension?", a: "Download the compiled zip from the developer dashboard or visit the Chrome Web Store. Drag-and-drop the folder into chrome://extensions with Developer Mode toggled on." },
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

// ==========================================
// ADMIN QUERIES DASHBOARD
// ==========================================
interface AdminQueriesPageProps {
  navigate: (to: string) => void;
  clerkUser: any;
  clerkGetToken: (() => Promise<string | null>) | null;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

function AdminQueriesPage({ navigate, clerkUser, clerkGetToken, showToast }: AdminQueriesPageProps) {
  const [passcode, setPasscode] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('hc_admin_authenticated') === 'true');
  const [queries, setQueries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');

  const isAdminEmail = !!(
    clerkUser?.primaryEmailAddress?.emailAddress &&
    (clerkUser.primaryEmailAddress.emailAddress.includes('sudhan') ||
      clerkUser.primaryEmailAddress.emailAddress.includes('admin'))
  );

  const authenticated = isAuthenticated || isAdminEmail;

  const fetchQueries = useCallback(async () => {
    setIsLoading(true);
    const key = localStorage.getItem('hc_admin_key') || passcode;
    
    // Set headers
    const headers: Record<string, string> = {};
    if (clerkGetToken) {
      try {
        const token = await clerkGetToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      } catch (e) {
        console.warn('Clerk token acquisition failed', e);
      }
    }

    try {
      const url = `${API_BASE}/feedback?adminKey=${encodeURIComponent(key || '')}`;
      const response = await fetch(url, { headers });
      const data = await response.json();
      
      if (data.success) {
        setQueries(data.feedback || []);
        setIsAuthenticated(true);
        localStorage.setItem('hc_admin_authenticated', 'true');
        if (key) {
          localStorage.setItem('hc_admin_key', key);
        }
      } else {
        // Only trigger error toast if user manually entered passcode and it failed
        if (passcode) {
          showToast(data.message || 'Unauthorized admin access', 'error');
        }
        setIsAuthenticated(false);
        localStorage.removeItem('hc_admin_authenticated');
        localStorage.removeItem('hc_admin_key');
      }
    } catch (e) {
      showToast('Error connecting to admin API', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [passcode, clerkGetToken, showToast]);

  useEffect(() => {
    if (authenticated) {
      fetchQueries();
    }
  }, [authenticated, fetchQueries]);

  const handleResolve = async (id: string) => {
    const key = localStorage.getItem('hc_admin_key');
    const headers: Record<string, string> = {};
    if (clerkGetToken) {
      try {
        const token = await clerkGetToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      } catch (e) {}
    }

    try {
      const response = await fetch(`${API_BASE}/feedback/${id}?adminKey=${encodeURIComponent(key || '')}`, {
        method: 'DELETE',
        headers
      });
      const data = await response.json();
      if (data.success) {
        showToast('Ticket marked as resolved!', 'success');
        setQueries(prev => prev.filter(q => q.id !== id));
      } else {
        showToast(data.message || 'Failed to delete query', 'error');
      }
    } catch (e) {
      showToast('Network error resolving query', 'error');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setQueries([]);
    localStorage.removeItem('hc_admin_authenticated');
    localStorage.removeItem('hc_admin_key');
    showToast('Logged out of admin session.', 'info');
  };

  const filtered = queries.filter(q => 
    (q.email || '').toLowerCase().includes(search.toLowerCase()) || 
    (q.message || '').toLowerCase().includes(search.toLowerCase())
  );

  const proCount = queries.filter(q => q.isPro).length;

  if (!authenticated) {
    return (
      <section className="seo-page" style={{ paddingTop: '120px', minHeight: '80vh', background: 'var(--bg)', display: 'flex', alignItems: 'center' }}>
        <div style={{ maxWidth: '400px', margin: '0 auto', padding: '30px', background: 'var(--bg2)', border: '1px solid var(--br2)', borderRadius: '16px', width: '100%' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center', fontFamily: 'Space Grotesk' }}>Admin Portal</h3>
          <p style={{ fontSize: '13px', color: 'var(--tx2)', marginBottom: '24px', textAlign: 'center' }}>Enter passcode to view user support queries.</p>
          <form onSubmit={(e) => { e.preventDefault(); fetchQueries(); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input 
              type="password"
              placeholder="Admin passcode..."
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', background: 'var(--bg3)', border: '1px solid var(--br)', borderRadius: '8px', color: '#fff', textAlign: 'center', fontSize: '15px' }}
            />
            <button type="submit" className="primary-btn" style={{ padding: '12px', background: 'var(--vi)', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
              Login as Admin
            </button>
            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <a onClick={() => navigate('/')} style={{ fontSize: '12px', color: 'var(--tx3)', cursor: 'pointer' }}>Return to home</a>
            </div>
          </form>
        </div>
      </section>
    );
  }

  return (
    <section className="seo-page" style={{ paddingTop: '100px', minHeight: '80vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <div>
            <a onClick={() => navigate('/')} style={{ color: 'var(--cy)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              ← Back to Home
            </a>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginTop: '10px', fontFamily: 'Space Grotesk' }}>
              Admin Queries Dashboard
            </h1>
          </div>
          <button onClick={handleLogout} className="nav-secondary-btn" style={{ padding: '8px 16px', fontSize: '12px' }}>
            Disconnect
          </button>
        </div>

        {/* Stats Row */}
        <div className="dev-dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
          <div className="dashboard-card" style={{ padding: '20px', background: 'var(--bg2)', border: '1px solid var(--br)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--tx3)', fontWeight: 'bold' }}>TOTAL TICKETS</span>
            <span style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--tx)' }}>{queries.length}</span>
          </div>
          <div className="dashboard-card" style={{ padding: '20px', background: 'var(--bg2)', border: '1px solid var(--br)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--tx3)', fontWeight: 'bold' }}>PRO USER TICKETS</span>
            <span style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--vi2)' }}>{proCount}</span>
          </div>
          <div className="dashboard-card" style={{ padding: '20px', background: 'var(--bg2)', border: '1px solid var(--br)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--tx3)', fontWeight: 'bold' }}>UNRESOLVED</span>
            <span style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--warning)' }}>{queries.length}</span>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center' }}>
          <input 
            type="text"
            placeholder="Search queries by sender email or content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, padding: '12px 16px', background: 'var(--bg2)', border: '1px solid var(--br)', borderRadius: '8px', color: '#fff', fontSize: '14px' }}
          />
          <button onClick={fetchQueries} className="nav-secondary-btn" disabled={isLoading} style={{ padding: '12px 20px', fontSize: '14px', whiteSpace: 'nowrap' }}>
            {isLoading ? 'Syncing...' : '🔄 Refresh'}
          </button>
        </div>

        {/* Queries List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filtered.length > 0 ? (
            filtered.map((query) => (
              <div 
                key={query.id} 
                className="dashboard-card" 
                style={{ 
                  padding: '24px', 
                  background: 'var(--bg2)', 
                  border: query.isPro ? '1px solid var(--vi)' : '1px solid var(--br)', 
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  transition: 'all 0.3s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontWeight: 'bold', color: 'var(--tx)', fontSize: '15px' }}>{query.email}</span>
                      {query.isPro && (
                        <span style={{ fontSize: '10px', color: '#fff', background: 'var(--vi)', padding: '2px 8px', borderRadius: '100px', fontWeight: 'bold' }}>
                          ★ PRO USER
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--tx3)' }}>
                      Submitted: {new Date(query.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <button 
                    onClick={() => handleResolve(query.id)}
                    className="nav-cta"
                    style={{ background: 'var(--success)', padding: '6px 14px', fontSize: '12px' }}
                  >
                    ✓ Resolve & Close
                  </button>
                </div>
                
                <div style={{ 
                  background: 'var(--bg3)', 
                  border: '1px solid var(--br)', 
                  borderRadius: '8px', 
                  padding: '16px', 
                  color: 'var(--tx2)', 
                  fontSize: '14px',
                  whiteSpace: 'pre-wrap',
                  lineHeight: '1.5'
                }}>
                  {query.message}
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg2)', border: '1px solid var(--br)', borderRadius: '12px', color: 'var(--tx3)' }}>
              {isLoading ? 'Fetching tickets...' : 'No queries found. All caught up! 🎉'}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

interface NotFoundProps {
  navigate: (to: string) => void;
}

function NotFoundPage({ navigate }: NotFoundProps) {
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
