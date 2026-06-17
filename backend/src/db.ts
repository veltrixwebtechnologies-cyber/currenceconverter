import * as fs from 'fs';
import * as path from 'path';
import { kv } from '@vercel/kv';
import { createClient } from 'redis';

const isVercel = !!process.env.VERCEL;
const DATA_FILE = path.join(__dirname, '..', 'data.json');

// Initialize standard Redis client if REDIS_URL is provided
let redisClient: any = null;
if (process.env.REDIS_URL) {
  console.log('Initializing standard Redis client with REDIS_URL');
  redisClient = createClient({
    url: process.env.REDIS_URL
  });
  redisClient.connect().catch((err: any) => {
    console.error('Redis client connection error:', err);
  });
}

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

export interface Feedback {
  id: string;
  email: string;
  message: string;
  createdAt: string;
}

// NEW: Clerk + Dodo based subscription
export interface UserSubscription {
  clerkUserId: string;
  email: string;
  premium: boolean;
  plan: 'free' | 'pro_lifetime';
  dodoPaymentId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DBData {
  settings: Record<string, UserSettings>;
  licenses: Record<string, License>;
  feedback: Feedback[];
  subscriptions: Record<string, UserSubscription>;
}

const DEFAULT_SETTINGS = (userId: string): UserSettings => ({
  userId,
  nativeCurrency: 'INR',
  theme: 'glass',
  hoverDelay: 100,
  rateOverride: null,
  favoriteCurrencies: ['USD', 'EUR', 'GBP', 'JPY', 'AUD']
});

const initialData: DBData = {
  settings: {},
  licenses: {},
  feedback: [],
  subscriptions: {}
};

// Local File Helpers
function readDB(): DBData {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      writeDB(initialData);
      return initialData;
    }
    const content = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    // Ensure subscriptions key exists in older data files
    if (!parsed.subscriptions) parsed.subscriptions = {};
    return parsed;
  } catch (error) {
    console.error('Error reading database file, using fallback initial data', error);
    return initialData;
  }
}

function writeDB(data: DBData): void {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing database file', error);
  }
}

// Vercel KV Initializer
async function ensureKVPooled(): Promise<void> {
  try {
    if (redisClient) {
      await redisClient.set('hc:initialized', 'true');
    } else {
      const initialized = await kv.get<boolean>('hc:initialized');
      if (!initialized) {
        await kv.set('hc:initialized', true);
      }
    }
  } catch (error) {
    console.error('Failed to initialize KV/Redis', error);
  }
}

export const db = {
  getRedisStatus: async (): Promise<{ initialized: boolean; connected: boolean; error: string | null }> => {
    let connected = false;
    let error: string | null = null;
    if (redisClient) {
      try {
        await redisClient.ping();
        connected = true;
      } catch (err: any) {
        error = err.message || String(err);
      }
    }
    return {
      initialized: !!redisClient,
      connected,
      error
    };
  },

  getSettings: async (userId: string): Promise<UserSettings> => {
    if (redisClient) {
      try {
        const val = await redisClient.hGet('hc:settings', userId);
        let settings = val ? JSON.parse(val) : null;
        if (!settings) {
          settings = DEFAULT_SETTINGS(userId);
          await redisClient.hSet('hc:settings', userId, JSON.stringify(settings));
        }
        return settings;
      } catch (error) {
        console.error('Redis getSettings error', error);
        return DEFAULT_SETTINGS(userId);
      }
    } else if (isVercel) {
      try {
        let settings = await kv.hget<UserSettings>('hc:settings', userId);
        if (!settings) {
          settings = DEFAULT_SETTINGS(userId);
          await kv.hset('hc:settings', { [userId]: settings });
        }
        return settings;
      } catch (error) {
        console.error('KV getSettings error', error);
        return DEFAULT_SETTINGS(userId);
      }
    } else {
      const data = readDB();
      if (!data.settings[userId]) {
        data.settings[userId] = DEFAULT_SETTINGS(userId);
        writeDB(data);
      }
      return data.settings[userId];
    }
  },

  updateSettings: async (userId: string, updates: Partial<UserSettings>): Promise<UserSettings> => {
    if (redisClient) {
      try {
        const val = await redisClient.hGet('hc:settings', userId);
        let current = val ? JSON.parse(val) : DEFAULT_SETTINGS(userId);
        const updated = { ...current, ...updates };
        await redisClient.hSet('hc:settings', userId, JSON.stringify(updated));
        return updated;
      } catch (error) {
        console.error('Redis updateSettings error', error);
        throw error;
      }
    } else if (isVercel) {
      try {
        let current = await kv.hget<UserSettings>('hc:settings', userId);
        if (!current) {
          current = DEFAULT_SETTINGS(userId);
        }
        const updated = { ...current, ...updates };
        await kv.hset('hc:settings', { [userId]: updated });
        return updated;
      } catch (error) {
        console.error('KV updateSettings error', error);
        throw error;
      }
    } else {
      const data = readDB();
      const current = data.settings[userId] || DEFAULT_SETTINGS(userId);
      data.settings[userId] = { ...current, ...updates };
      writeDB(data);
      return data.settings[userId];
    }
  },

  validateLicense: async (licenseKey: string): Promise<License | null> => {
    if (redisClient) {
      try {
        const val = await redisClient.hGet('hc:licenses', licenseKey);
        const license = val ? JSON.parse(val) : null;
        if (license && license.status === 'active') {
          return license;
        }
        return null;
      } catch (error) {
        console.error('Redis validateLicense error', error);
        return null;
      }
    } else if (isVercel) {
      try {
        await ensureKVPooled();
        const license = await kv.hget<License>('hc:licenses', licenseKey);
        if (license && license.status === 'active') {
          return license;
        }
        return null;
      } catch (error) {
        console.error('KV validateLicense error', error);
        return null;
      }
    } else {
      const data = readDB();
      const license = data.licenses[licenseKey];
      if (license && license.status === 'active') {
        return license;
      }
      return null;
    }
  },

  createLicense: async (email: string): Promise<License> => {
    const licenseKey = `HC-PRO-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const newLicense: License = {
      licenseKey,
      email,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    if (redisClient) {
      try {
        await redisClient.hSet('hc:licenses', licenseKey, JSON.stringify(newLicense));
        return newLicense;
      } catch (error) {
        console.error('Redis createLicense error', error);
        throw error;
      }
    } else if (isVercel) {
      try {
        await ensureKVPooled();
        await kv.hset('hc:licenses', { [licenseKey]: newLicense });
        return newLicense;
      } catch (error) {
        console.error('KV createLicense error', error);
        throw error;
      }
    } else {
      const data = readDB();
      data.licenses[licenseKey] = newLicense;
      writeDB(data);
      return newLicense;
    }
  },

  addFeedback: async (email: string, message: string): Promise<Feedback> => {
    const newFeedback: Feedback = {
      id: Math.random().toString(36).substring(2, 11),
      email,
      message,
      createdAt: new Date().toISOString()
    };

    if (redisClient) {
      try {
        await redisClient.rPush('hc:feedback', JSON.stringify(newFeedback));
        return newFeedback;
      } catch (error) {
        console.error('Redis addFeedback error', error);
        throw error;
      }
    } else if (isVercel) {
      try {
        await kv.rpush('hc:feedback', newFeedback);
        return newFeedback;
      } catch (error) {
        console.error('KV addFeedback error', error);
        throw error;
      }
    } else {
      const data = readDB();
      data.feedback.push(newFeedback);
      writeDB(data);
      return newFeedback;
    }
  },

  // ── Subscription methods (Clerk + Dodo) ──────────────────────────────────

  getSubscription: async (clerkUserId: string): Promise<UserSubscription | null> => {
    if (redisClient) {
      try {
        const val = await redisClient.hGet('hc:subscriptions', clerkUserId);
        return val ? JSON.parse(val) : null;
      } catch (error) {
        console.error('Redis getSubscription error', error);
        return null;
      }
    } else if (isVercel) {
      try {
        const sub = await kv.hget<UserSubscription>('hc:subscriptions', clerkUserId);
        return sub || null;
      } catch (error) {
        console.error('KV getSubscription error', error);
        return null;
      }
    } else {
      const data = readDB();
      return data.subscriptions[clerkUserId] || null;
    }
  },

  upsertSubscription: async (
    clerkUserId: string,
    email: string,
    plan: 'free' | 'pro_lifetime',
    dodoPaymentId: string | null
  ): Promise<UserSubscription> => {
    const now = new Date().toISOString();
    const isPremium = plan === 'pro_lifetime';

    let existing: UserSubscription | null = null;
    if (redisClient) {
      try {
        const val = await redisClient.hGet('hc:subscriptions', clerkUserId);
        existing = val ? JSON.parse(val) : null;
      } catch (_) {}
    } else if (isVercel) {
      try {
        existing = await kv.hget<UserSubscription>('hc:subscriptions', clerkUserId);
      } catch (_) {}
    } else {
      const data = readDB();
      existing = data.subscriptions[clerkUserId] || null;
    }

    const subscription: UserSubscription = {
      clerkUserId,
      email,
      premium: isPremium,
      plan,
      dodoPaymentId: dodoPaymentId || existing?.dodoPaymentId || null,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    if (redisClient) {
      try {
        await redisClient.hSet('hc:subscriptions', clerkUserId, JSON.stringify(subscription));
      } catch (error) {
        console.error('Redis upsertSubscription error', error);
        throw error;
      }
    } else if (isVercel) {
      try {
        await kv.hset('hc:subscriptions', { [clerkUserId]: subscription });
      } catch (error) {
        console.error('KV upsertSubscription error', error);
        throw error;
      }
    } else {
      const data = readDB();
      data.subscriptions[clerkUserId] = subscription;
      writeDB(data);
    }

    return subscription;
  }
};
