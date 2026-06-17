// background.js

const API_BASE = 'https://www.currenceconverter.me/api';

// Initialize defaults
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['plan', 'premium', 'dailyConversions', 'lastCheckDate', 'dailyLimit'], (data) => {
    const today = new Date().toISOString().split('T')[0];
    chrome.storage.local.set({
      plan: data.plan || 'free',
      premium: data.premium || false,
      dailyConversions: data.lastCheckDate === today ? (data.dailyConversions || 0) : 0,
      lastCheckDate: today,
      dailyLimit: 50
    });
  });
});

// Alarm to periodically sync/validate premium status
chrome.alarms.create('checkPremiumAlarm', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkPremiumAlarm') {
    syncPremiumStatus();
  }
});

// Listener for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'syncAuth') {
    // Received auth state from HoverConvert website content script
    const { userId, email, token } = request;
    chrome.storage.local.set({
      clerkUserId: userId,
      clerkUserEmail: email,
      authToken: token
    }, () => {
      syncPremiumStatus().then((isPro) => {
        sendResponse({ success: true, isPro });
      });
    });
    return true; // Keep message channel open for async response
  }

  if (request.action === 'checkPremium') {
    syncPremiumStatus().then((isPro) => {
      sendResponse({ success: true, isPro });
    }).catch((err) => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  if (request.action === 'incrementConversion') {
    handleIncrementConversion(sendResponse);
    return true;
  }

  if (request.action === 'checkUsage') {
    getUsageInfo().then(sendResponse);
    return true;
  }
});

async function getUsageInfo() {
  const today = new Date().toISOString().split('T')[0];
  return new Promise((resolve) => {
    chrome.storage.local.get(['plan', 'premium', 'dailyConversions', 'lastCheckDate', 'dailyLimit'], (data) => {
      let count = data.dailyConversions || 0;
      let checkDate = data.lastCheckDate;

      if (checkDate !== today) {
        count = 0;
        chrome.storage.local.set({ dailyConversions: 0, lastCheckDate: today });
      }

      resolve({
        isPremium: data.premium || data.plan === 'pro_lifetime',
        count,
        limit: data.dailyLimit || 50,
        allowed: (data.premium || data.plan === 'pro_lifetime') || (count < (data.dailyLimit || 50))
      });
    });
  });
}

function handleIncrementConversion(sendResponse) {
  const today = new Date().toISOString().split('T')[0];
  chrome.storage.local.get(['plan', 'premium', 'dailyConversions', 'lastCheckDate', 'dailyLimit'], (data) => {
    const isPremium = data.premium || data.plan === 'pro_lifetime';
    let count = data.dailyConversions || 0;

    if (data.lastCheckDate !== today) {
      count = 0;
    }

    if (isPremium) {
      chrome.storage.local.set({ dailyConversions: count + 1, lastCheckDate: today });
      sendResponse({ success: true, allowed: true, count: count + 1 });
    } else {
      const limit = data.dailyLimit || 50;
      if (count < limit) {
        chrome.storage.local.set({ dailyConversions: count + 1, lastCheckDate: today });
        sendResponse({ success: true, allowed: true, count: count + 1 });
      } else {
        sendResponse({ success: false, allowed: false, count });
      }
    }
  });
}

async function syncPremiumStatus() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['clerkUserId', 'authToken'], async (data) => {
      if (!data.authToken) {
        // Not logged in
        chrome.storage.local.set({ plan: 'free', premium: false });
        resolve(false);
        return;
      }

      try {
        const headers = { 'Content-Type': 'application/json' };
        if (data.authToken) {
          headers['Authorization'] = `Bearer ${data.authToken}`;
        }

        // Query status endpoint
        const response = await fetch(`${API_BASE}/check-premium`, {
          method: 'GET',
          headers
        });

        if (!response.ok) {
          throw new Error('Failed to verify status');
        }

        const resData = await response.json();
        const isPro = !!(resData.premium || resData.pro);
        chrome.storage.local.set({
          plan: isPro ? 'pro_lifetime' : 'free',
          premium: isPro
        });
        resolve(isPro);
      } catch (err) {
        console.error('Error syncing premium status:', err);
        // On error, fallback to current stored value to support offline use
        chrome.storage.local.get(['premium'], (storedData) => {
          resolve(!!storedData.premium);
        });
      }
    });
  });
}
