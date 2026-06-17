// popup.js

const DOMAIN = 'https://www.currenceconverter.me'; // Update this to your production domain or localhost during development

document.addEventListener('DOMContentLoaded', async () => {
  // Load UI state
  updateUI();

  // Add event listeners
  document.getElementById('btn-upgrade').addEventListener('click', () => {
    chrome.tabs.create({ url: `${DOMAIN}/pricing` });
  });

  document.getElementById('btn-login').addEventListener('click', () => {
    chrome.tabs.create({ url: `${DOMAIN}/pricing` });
  });

  document.getElementById('btn-sync').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'checkPremium' }, (response) => {
      if (response && response.success) {
        alert('Premium status synced successfully!');
        updateUI();
      } else {
        alert('Could not sync. Ensure you are signed in on ' + DOMAIN);
      }
    });
  });

  document.getElementById('btn-logout').addEventListener('click', () => {
    chrome.storage.local.set({
      plan: 'free',
      premium: false,
      clerkUserId: null,
      clerkUserEmail: null,
      authToken: null
    }, () => {
      updateUI();
    });
  });
});

function updateUI() {
  chrome.storage.local.get(['plan', 'premium', 'dailyConversions', 'clerkUserEmail', 'dailyLimit'], (data) => {
    const isPremium = data.premium || data.plan === 'pro_lifetime';
    const planBadge = document.getElementById('plan-badge');
    const usageSection = document.getElementById('usage-section');
    const unlimitedSection = document.getElementById('unlimited-section');
    const ctaUpgrade = document.getElementById('cta-upgrade');
    const accountStatus = document.getElementById('account-status');
    const btnLogin = document.getElementById('btn-login');
    const btnSync = document.getElementById('btn-sync');
    const btnLogout = document.getElementById('btn-logout');

    // Update Plan Badge
    if (isPremium) {
      planBadge.textContent = 'Pro';
      planBadge.className = 'badge badge-pro';
      usageSection.classList.add('hidden');
      unlimitedSection.classList.remove('hidden');
      ctaUpgrade.classList.add('hidden');
    } else {
      planBadge.textContent = 'Free';
      planBadge.className = 'badge badge-free';
      usageSection.classList.remove('hidden');
      unlimitedSection.classList.add('hidden');
      ctaUpgrade.classList.remove('hidden');
    }

    // Update daily usage
    const count = data.dailyConversions || 0;
    const limit = data.dailyLimit || 50;
    document.getElementById('conversions-count').textContent = count;
    const percentage = Math.min((count / limit) * 100, 100);
    document.getElementById('conversions-progress').style.width = `${percentage}%`;

    // Update Auth Status
    if (data.clerkUserEmail) {
      accountStatus.textContent = data.clerkUserEmail;
      btnLogin.classList.add('hidden');
      btnSync.classList.remove('hidden');
      btnLogout.classList.remove('hidden');
    } else {
      accountStatus.textContent = 'Not Logged In';
      btnLogin.classList.remove('hidden');
      btnSync.classList.add('hidden');
      btnLogout.classList.add('hidden');
    }
  });
}
