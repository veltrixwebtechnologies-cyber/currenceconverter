import { track } from '@vercel/analytics';

export interface UserSettings {
  userId: string;
  nativeCurrency: string;
  theme: 'light' | 'dark' | 'glass';
  hoverDelay: number;
  rateOverride: number | null;
  favoriteCurrencies: string[];
}

export interface License {
  licenseKey: string;
  email: string;
  status: 'active' | 'revoked';
  createdAt: string;
}

export const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5001/api' : '/api';

export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  try {
    track(eventName, properties);
  } catch (err) {
    console.warn(`[Analytics Error] Failed to track ${eventName}:`, err);
  }
};
