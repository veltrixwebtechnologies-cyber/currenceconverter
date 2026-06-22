import * as fs from 'fs';
import * as path from 'path';
import { kv } from '@vercel/kv';
import { createClient } from 'redis';

const isVercel = !!process.env.VERCEL;
const DATA_FILE = path.join(__dirname, '..', 'data.json');

// Check if Vercel KV REST environment variables are available to use HTTP/REST
const useVercelKV = !!(isVercel && process.env.KV_REST_API_URL);

// Initialize standard Redis client ONLY if NOT running on Vercel with KV REST available
let redisClient: any = null;
if (process.env.REDIS_URL && !useVercelKV) {
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
    if (useVercelKV) {
      const initialized = await kv.get<boolean>('hc:initialized');
      if (!initialized) {
        await kv.set('hc:initialized', true);
      }
    } else if (redisClient) {
      await redisClient.set('hc:initialized', 'true');
    }
  } catch (error) {
    console.error('Failed to initialize KV/Redis', error);
  }
}

export const db = {
  getRedisStatus: async (): Promise<{ initialized: boolean; connected: boolean; error: string | null }> => {
    let connected = false;
    let error: string | null = null;
    if (useVercelKV) {
      try {
        await kv.ping();
        connected = true;
      } catch (err: any) {
        error = err.message || String(err);
      }
    } else if (redisClient) {
      try {
        await redisClient.ping();
        connected = true;
      } catch (err: any) {
        error = err.message || String(err);
      }
    }
    return {
      initialized: useVercelKV || !!redisClient,
      connected,
      error
    };
  },

  getSettings: async (userId: string): Promise<UserSettings> => {
    if (useVercelKV) {
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
    } else if (redisClient) {
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
    if (useVercelKV) {
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
    } else if (redisClient) {
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
    } else {
      const data = readDB();
      const current = data.settings[userId] || DEFAULT_SETTINGS(userId);
      data.settings[userId] = { ...current, ...updates };
      writeDB(data);
      return data.settings[userId];
    }
  },

  validateLicense: async (licenseKey: string): Promise<License | null> => {
    if (useVercelKV) {
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
    } else if (redisClient) {
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

    if (useVercelKV) {
      try {
        await ensureKVPooled();
        await kv.hset('hc:licenses', { [licenseKey]: newLicense });
        return newLicense;
      } catch (error) {
        console.error('KV createLicense error', error);
        throw error;
      }
    } else if (redisClient) {
      try {
        await redisClient.hSet('hc:licenses', licenseKey, JSON.stringify(newLicense));
        return newLicense;
      } catch (error) {
        console.error('Redis createLicense error', error);
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

    if (useVercelKV) {
      try {
        await kv.rpush('hc:feedback', newFeedback);
        return newFeedback;
      } catch (error) {
        console.error('KV addFeedback error', error);
        throw error;
      }
    } else if (redisClient) {
      try {
        await redisClient.rPush('hc:feedback', JSON.stringify(newFeedback));
        return newFeedback;
      } catch (error) {
        console.error('Redis addFeedback error', error);
        throw error;
      }
    } else {
      const data = readDB();
      data.feedback.push(newFeedback);
      writeDB(data);
      return newFeedback;
    }
  },

  getAllFeedback: async (): Promise<Feedback[]> => {
    if (useVercelKV) {
      try {
        const feedback = await kv.lrange<Feedback>('hc:feedback', 0, -1);
        return feedback || [];
      } catch (error) {
        console.error('KV getAllFeedback error', error);
        return [];
      }
    } else if (redisClient) {
      try {
        const list = await redisClient.lRange('hc:feedback', 0, -1);
        return list ? list.map((item: string) => JSON.parse(item)) : [];
      } catch (error) {
        console.error('Redis getAllFeedback error', error);
        return [];
      }
    } else {
      const data = readDB();
      return data.feedback || [];
    }
  },

  deleteFeedback: async (id: string): Promise<boolean> => {
    if (useVercelKV) {
      try {
        const feedback = await kv.lrange<Feedback>('hc:feedback', 0, -1);
        const filtered = (feedback || []).filter(f => f.id !== id);
        await kv.del('hc:feedback');
        if (filtered.length > 0) {
          await kv.rpush('hc:feedback', ...filtered);
        }
        return true;
      } catch (error) {
        console.error('KV deleteFeedback error', error);
        return false;
      }
    } else if (redisClient) {
      try {
        const list = await redisClient.lRange('hc:feedback', 0, -1);
        const feedback = list ? list.map((item: string) => JSON.parse(item)) : [];
        const filtered = feedback.filter((f: any) => f.id !== id);
        await redisClient.del('hc:feedback');
        for (const item of filtered) {
          await redisClient.rPush('hc:feedback', JSON.stringify(item));
        }
        return true;
      } catch (error) {
        console.error('Redis deleteFeedback error', error);
        return false;
      }
    } else {
      const data = readDB();
      const initialLength = data.feedback.length;
      data.feedback = data.feedback.filter(f => f.id !== id);
      writeDB(data);
      return data.feedback.length < initialLength;
    }
  },

  // ── Subscription methods (Clerk + Dodo) ──────────────────────────────────

  getSubscription: async (clerkUserId: string): Promise<UserSubscription | null> => {
    if (useVercelKV) {
      try {
        const sub = await kv.hget<UserSubscription>('hc:subscriptions', clerkUserId);
        return sub || null;
      } catch (error) {
        console.error('KV getSubscription error', error);
        return null;
      }
    } else if (redisClient) {
      try {
        const val = await redisClient.hGet('hc:subscriptions', clerkUserId);
        return val ? JSON.parse(val) : null;
      } catch (error) {
        console.error('Redis getSubscription error', error);
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
    if (useVercelKV) {
      try {
        existing = await kv.hget<UserSubscription>('hc:subscriptions', clerkUserId);
      } catch (_) {}
    } else if (redisClient) {
      try {
        const val = await redisClient.hGet('hc:subscriptions', clerkUserId);
        existing = val ? JSON.parse(val) : null;
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

    if (useVercelKV) {
      try {
        await kv.hset('hc:subscriptions', { [clerkUserId]: subscription });
      } catch (error) {
        console.error('KV upsertSubscription error', error);
        throw error;
      }
    } else if (redisClient) {
      try {
        await redisClient.hSet('hc:subscriptions', clerkUserId, JSON.stringify(subscription));
      } catch (error) {
        console.error('Redis upsertSubscription error', error);
        throw error;
      }
    } else {
      const data = readDB();
      data.subscriptions[clerkUserId] = subscription;
      writeDB(data);
    }

    return subscription;
  },

  isEmailPro: async (email: string): Promise<boolean> => {
    if (!email) return false;
    if (useVercelKV) {
      try {
        const subs = (await kv.hvals('hc:subscriptions')) as any[];
        const found = subs.find((s: any) => s.email && s.email.toLowerCase() === email.toLowerCase() && s.premium);
        return !!found;
      } catch {
        return false;
      }
    } else if (redisClient) {
      try {
        const vals = await redisClient.hVals('hc:subscriptions');
        const subs = vals ? vals.map((v: string) => JSON.parse(v)) : [];
        const found = subs.find((s: any) => s.email && s.email.toLowerCase() === email.toLowerCase() && s.premium);
        return !!found;
      } catch {
        return false;
      }
    } else {
      const data = readDB();
      const found = Object.values(data.subscriptions || {}).find((s: any) => s.email && s.email.toLowerCase() === email.toLowerCase() && s.premium);
      return !!found;
    }
  }
};
