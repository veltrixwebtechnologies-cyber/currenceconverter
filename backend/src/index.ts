import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { db } from './db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Fallback rates if external API is down
const FALLBACK_RATES: Record<string, number> = {
  USD: 1.0,
  INR: 85.02,
  EUR: 0.92,
  GBP: 0.78,
  JPY: 156.40,
  AUD: 1.51,
  CAD: 1.37,
  CHF: 0.90,
  CNY: 7.24,
  SGD: 1.35,
  HKD: 7.81,
  AED: 3.67,
  SAR: 3.75,
  MYR: 4.71,
  THB: 36.65,
  NZD: 1.63
};

interface RatesCache {
  rates: Record<string, number>;
  timestamp: number;
}

let ratesCache: RatesCache = {
  rates: FALLBACK_RATES,
  timestamp: 0
};

const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

// Helper to fetch live rates
async function getLiveRates(): Promise<Record<string, number>> {
  const now = Date.now();
  if (now - ratesCache.timestamp < CACHE_DURATION) {
    return ratesCache.rates;
  }

  try {
    console.log('Fetching live exchange rates...');
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }
    const data = await response.json() as any;
    if (data && data.rates) {
      ratesCache = {
        rates: data.rates,
        timestamp: now
      };
      console.log('Live exchange rates updated successfully.');
      return data.rates;
    }
    throw new Error('Invalid response format');
  } catch (error) {
    console.error('Failed to fetch live exchange rates, using cache/fallback:', error);
    // If cache has ever been updated, keep it, otherwise use fallback
    if (ratesCache.timestamp === 0) {
      ratesCache.timestamp = now; // Prevent constant API calls on failure
    }
    return ratesCache.rates;
  }
}

app.use(cors());
app.use(express.json());

// Log requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Rates endpoint
app.get('/api/rates', async (req, res) => {
  try {
    const rates = await getLiveRates();
    res.json({
      success: true,
      rates,
      base: 'USD',
      updatedAt: new Date(ratesCache.timestamp).toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve exchange rates',
      error: error.message
    });
  }
});

// Settings endpoints
app.get('/api/settings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const settings = await db.getSettings(userId);
    res.json({ success: true, settings });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/settings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    const settings = await db.updateSettings(userId, updates);
    res.json({ success: true, settings });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// License validation & activation
app.post('/api/license/activate', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Invalid email address' });
    }
    const license = await db.createLicense(email);
    res.json({
      success: true,
      message: 'License activated successfully',
      license
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/license/validate', async (req, res) => {
  try {
    const { licenseKey } = req.body;
    if (!licenseKey) {
      return res.status(400).json({ success: false, message: 'License key is required' });
    }
    const license = await db.validateLicense(licenseKey);
    if (license) {
      res.json({
        success: true,
        valid: true,
        license
      });
    } else {
      res.json({
        success: true,
        valid: false,
        message: 'Invalid or expired license key'
      });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Feedback endpoint
app.post('/api/feedback', async (req, res) => {
  try {
    const { email, message } = req.body;
    if (!email || !message) {
      return res.status(400).json({ success: false, message: 'Email and message are required' });
    }
    const feedback = await db.addFeedback(email, message);
    res.json({
      success: true,
      message: 'Thank you for your feedback! We will get back to you shortly.',
      feedback
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Start Server
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`HoverConvert backend running on port ${PORT}`);
  });
}

export default app;

