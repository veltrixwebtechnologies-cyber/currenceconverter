// content.js

// Global configuration
let nativeCurrency = 'INR';
let isPremiumUser = false;
let rates = {
  USD: 1.0,
  INR: 85.02,
  EUR: 0.92,
  GBP: 0.78,
  JPY: 156.40,
  AUD: 1.51,
  CAD: 1.37
};

// Fetch rates & settings on start
function init() {
  chrome.storage.local.get(['premium', 'plan', 'settings'], (data) => {
    isPremiumUser = data.premium || data.plan === 'pro_lifetime';
    if (data.settings && data.settings.nativeCurrency) {
      nativeCurrency = data.settings.nativeCurrency;
    }
  });

  // Fetch live rates from the API through background fetch or directly
  fetch('https://hoverconvert.vercel.app/api/rates')
    .then(r => r.json())
    .then(data => {
      if (data && data.success && data.rates) {
        rates = data.rates;
      }
    })
    .catch(err => console.log('HoverConvert: using fallback rates.', err));
}

init();

// Watch for storage changes (e.g. user toggles settings or logs in)
chrome.storage.onChanged.addListener((changes) => {
  if (changes.premium || changes.plan) {
    const val = changes.premium ? changes.premium.newValue : (changes.plan ? changes.plan.newValue === 'pro_lifetime' : isPremiumUser);
    isPremiumUser = val;
  }
  if (changes.settings && changes.settings.newValue) {
    if (changes.settings.newValue.nativeCurrency) {
      nativeCurrency = changes.settings.newValue.nativeCurrency;
    }
  }
});

// 1. Clerk Authentication Web App Sync
if (window.location.hostname === 'hoverconvert.vercel.app' || window.location.hostname === 'localhost') {
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'HOVERCONVERT_AUTH') {
      const { userId, email, token } = event.data;
      chrome.runtime.sendMessage({
        action: 'syncAuth',
        userId,
        email,
        token
      }, (response) => {
        console.log('HoverConvert Extension: Clerk auth sync complete.', response);
      });
    }
  });
}

// 2. Hover Detection & Tooltip Logic
const CURRENCY_MAP = {
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY',
  '₹': 'INR',
  'A$': 'AUD',
  'C$': 'CAD',
  'USD': 'USD',
  'EUR': 'EUR',
  'GBP': 'GBP',
  'INR': 'INR',
  'JPY': 'JPY',
  'AUD': 'AUD',
  'CAD': 'CAD'
};

const PRICE_REGEX = /(?:([$€£¥₹]|USD|EUR|GBP|INR|JPY|AUD|CAD)\s*(\d+(?:,\d{3})*(?:\.\d{2})?))|((?:\d+(?:,\d{3})*(?:\.\d{2})?)\s*([$€£¥₹]|USD|EUR|GBP|INR|JPY|AUD|CAD))/i;

let activeTooltip = null;
let hoverTimer = null;

document.addEventListener('mouseover', (e) => {
  const target = e.target;
  if (!target || target.nodeType !== Node.ELEMENT_NODE) return;
  if (target.id === 'hoverconvert-tooltip' || target.closest('#hoverconvert-tooltip')) return;

  // Read text content
  const text = target.textContent ? target.textContent.trim() : '';
  if (!text || text.length > 50) return; // Ignore large blocks

  const match = text.match(PRICE_REGEX);
  if (match) {
    let symbol, amountStr;
    if (match[1]) {
      symbol = match[1];
      amountStr = match[2];
    } else {
      amountStr = match[3];
      symbol = match[4];
    }

    const amount = parseFloat(amountStr.replace(/,/g, ''));
    if (isNaN(amount)) return;

    const sourceCurrency = CURRENCY_MAP[symbol.toUpperCase()] || symbol;
    if (sourceCurrency === nativeCurrency) return; // Already in native currency

    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      showConversionTooltip(target, amount, sourceCurrency);
    }, 150); // delay before triggering conversion
  }
});

document.addEventListener('mouseout', (e) => {
  const target = e.target;
  if (activeTooltip && (!target || !target.closest('#hoverconvert-tooltip'))) {
    clearTimeout(hoverTimer);
    // Don't remove immediately to allow clicking buttons on tooltip
    setTimeout(() => {
      if (activeTooltip && !activeTooltip.matches(':hover')) {
        removeTooltip();
      }
    }, 300);
  }
});

function removeTooltip() {
  if (activeTooltip) {
    activeTooltip.remove();
    activeTooltip = null;
  }
}

function showConversionTooltip(targetElement, amount, sourceCurrency) {
  removeTooltip();

  // Request backend permission to convert (check free limits)
  chrome.runtime.sendMessage({ action: 'checkUsage' }, (usage) => {
    if (!usage) return;

    if (!usage.allowed) {
      createLimitExceededTooltip(targetElement);
      return;
    }

    // Convert currency
    const rateSrc = rates[sourceCurrency];
    const rateDest = rates[nativeCurrency];

    if (!rateSrc || !rateDest) return;

    const amountUSD = amount / rateSrc;
    const convertedAmount = amountUSD * rateDest;

    // Increment count on backend
    chrome.runtime.sendMessage({ action: 'incrementConversion' });

    createTooltip(targetElement, amount, sourceCurrency, convertedAmount, nativeCurrency);
  });
}

function createTooltip(targetElement, amount, sourceCurrency, convertedAmount, destCurrency) {
  const tooltip = document.createElement('div');
  tooltip.id = 'hoverconvert-tooltip';
  
  // Style with beautiful premium dark glassmorphism
  Object.assign(tooltip.style, {
    position: 'absolute',
    background: 'rgba(15, 23, 42, 0.92)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    padding: '12px 16px',
    color: '#f8fafc',
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
    zIndex: '2147483647',
    pointerEvents: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: '160px',
    transition: 'opacity 0.2s, transform 0.2s',
    transform: 'translateY(8px)',
    opacity: '0'
  });

  const formattedConverted = convertedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedSource = amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  tooltip.innerHTML = `
    <div style="font-size: 11px; color: #94a3b8; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; display: flex; justify-content: space-between; align-items: center;">
      <span>HoverConvert</span>
      <span style="font-size: 10px; color: #22d3ee;">⚡ Live rate</span>
    </div>
    <div style="font-size: 18px; font-weight: 800; color: #ffffff; margin: 2px 0; font-family: inherit;">
      ${destCurrency} ${formattedConverted}
    </div>
    <div style="font-size: 11px; color: #64748b;">
      Original: ${sourceCurrency} ${formattedSource}
    </div>
  `;

  document.body.appendChild(tooltip);
  activeTooltip = tooltip;

  positionTooltip(targetElement, tooltip);

  // Animate in
  setTimeout(() => {
    tooltip.style.opacity = '1';
    tooltip.style.transform = 'translateY(0)';
  }, 10);

  // Mouseleave handler to close when cursor leaves the tooltip
  tooltip.addEventListener('mouseleave', () => {
    removeTooltip();
  });
}

function createLimitExceededTooltip(targetElement) {
  const tooltip = document.createElement('div');
  tooltip.id = 'hoverconvert-tooltip';
  
  Object.assign(tooltip.style, {
    position: 'absolute',
    background: 'rgba(15, 23, 42, 0.95)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '12px',
    padding: '14px 16px',
    color: '#f8fafc',
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
    zIndex: '2147483647',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxWidth: '220px'
  });

  tooltip.innerHTML = `
    <div style="font-weight: 700; color: #ef4444; display: flex; align-items: center; gap: 6px;">
      <span>⚠️</span> Limit Reached (50/day)
    </div>
    <div style="font-size: 12px; color: #94a3b8; line-height: 1.4;">
      You've hit the daily free limit. Upgrade to Pro for lifetime unlimited conversions.
    </div>
    <button id="hc-tooltip-upgrade-btn" style="background: linear-gradient(135deg, #7c6efa, #22d3ee); border: none; color: white; padding: 6px 12px; border-radius: 6px; font-weight: 600; font-size: 11px; cursor: pointer; margin-top: 4px;">
      ⚡ Upgrade to Pro
    </button>
  `;

  document.body.appendChild(tooltip);
  activeTooltip = tooltip;

  positionTooltip(targetElement, tooltip);

  const upgradeBtn = tooltip.querySelector('#hc-tooltip-upgrade-btn');
  upgradeBtn.addEventListener('click', () => {
    window.open('https://hoverconvert.vercel.app/pricing', '_blank');
    removeTooltip();
  });

  tooltip.addEventListener('mouseleave', () => {
    removeTooltip();
  });
}

function positionTooltip(targetElement, tooltipElement) {
  const rect = targetElement.getBoundingClientRect();
  const tooltipRect = tooltipElement.getBoundingClientRect();

  // Position above the hovered element
  let top = rect.top + window.scrollY - tooltipRect.height - 8;
  let left = rect.left + window.scrollX + (rect.width / 2) - (tooltipRect.width / 2);

  // If too close to top of viewport, position below instead
  if (rect.top - tooltipRect.height < 10) {
    top = rect.bottom + window.scrollY + 8;
  }

  // Contain horizontally
  if (left < 10) left = 10;
  if (left + tooltipRect.width > window.innerWidth - 10) {
    left = window.innerWidth - tooltipRect.width - 10;
  }

  tooltipElement.style.top = `${top}px`;
  tooltipElement.style.left = `${left}px`;
}
