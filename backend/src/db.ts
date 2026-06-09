import * as fs from 'fs';
import * as path from 'path';

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

export const db = {
  getSettings: (userId: string): UserSettings => {
    const data = readDB();
    if (!data.settings[userId]) {
      data.settings[userId] = DEFAULT_SETTINGS(userId);
      writeDB(data);
    }
    return data.settings[userId];
  },

  updateSettings: (userId: string, updates: Partial<UserSettings>): UserSettings => {
    const data = readDB();
    const current = data.settings[userId] || DEFAULT_SETTINGS(userId);
    data.settings[userId] = { ...current, ...updates };
    writeDB(data);
    return data.settings[userId];
  },

  validateLicense: (licenseKey: string): License | null => {
    const data = readDB();
    const license = data.licenses[licenseKey];
    if (license && license.status === 'active') {
      return license;
    }
    return null;
  },

  createLicense: (email: string): License => {
    const data = readDB();
    const licenseKey = `HC-PRO-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const newLicense: License = {
      licenseKey,
      email,
      status: 'active',
      createdAt: new Date().toISOString()
    };
    data.licenses[licenseKey] = newLicense;
    writeDB(data);
    return newLicense;
  },

  addFeedback: (email: string, message: string): Feedback => {
    const data = readDB();
    const newFeedback: Feedback = {
      id: Math.random().toString(36).substring(2, 11),
      email,
      message,
      createdAt: new Date().toISOString()
    };
    data.feedback.push(newFeedback);
    writeDB(data);
    return newFeedback;
  }
};
