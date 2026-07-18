import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { trackEvent } from '../types';

interface LandingProps {
  isPro: boolean;
}

function LandingPage({ isPro }: LandingProps) {
  const navigate = useNavigate();
  const [visibleElements, setVisibleElements] = useState<Record<string, boolean>>({});

  useEffect(() => {
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
  }, []);
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
    window.open('https://chromewebstore.google.com/detail/kknnjgicdlamepecgkgafdgodmeipibp?utm_source=item-share-cb', '_blank', 'noopener,noreferrer');
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

export default LandingPage;
