import * as fs from 'fs';
import * as path from 'path';
import { kv } from '@vercel/kv';

const isVercel = !!process.env.VERCEL;
const DATA_FILE = path.join(__dirname, '..', 'data.json');

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

interface DBData {
  settings: Record<string, UserSettings>;
  licenses: Record<string, License>;
  feedback: Feedback[];
}

const DEFAULT_SETTINGS = (userId: string): UserSettings => ({
  userId,
  nativeCurrency: 'INR',
  theme: 'glass',
  hoverDelay: 100,
  rateOverride: null,
  favoriteCurrencies: ['USD', 'EUR', 'GBP', 'JPY', 'AUD']
});

// Prepopulate database with some license keys for testing/demo
const initialData: DBData = {
  settings: {},
  licenses: {
    'HC-PRO-DEMO-12345': {
      licenseKey: 'HC-PRO-DEMO-12345',
      email: 'demo@hoverconvert.com',
      status: 'active',
      createdAt: new Date().toISOString()
    },
    'HC-PRO-TEST-99999': {
      licenseKey: 'HC-PRO-TEST-99999',
      email: 'tester@hoverconvert.com',
      status: 'active',
      createdAt: new Date().toISOString()
    }
  },
  feedback: []
};

// Local File Helpers
function readDB(): DBData {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      writeDB(initialData);
      return initialData;
    }
    const content = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(content);
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

// Vercel KV Initializer (Prepopulate demo keys if not present)
async function ensureKVPooled(): Promise<void> {
  try {
    const initialized = await kv.get<boolean>('hc:initialized');
    if (!initialized) {
      // Set the demo licenses in KV
      for (const [key, license] of Object.entries(initialData.licenses)) {
        await kv.hset('hc:licenses', { [key]: license });
      }
      await kv.set('hc:initialized', true);
    }
  } catch (error) {
    console.error('Failed to initialize Vercel KV', error);
  }
}

export const db = {
  getSettings: async (userId: string): Promise<UserSettings> => {
    if (isVercel) {
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
    if (isVercel) {
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
    if (isVercel) {
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

    if (isVercel) {
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

    if (isVercel) {
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
  }
};
