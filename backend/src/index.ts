import express from 'express';
import crypto from 'crypto';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { Webhook } from 'svix';
import DodoPayments from 'dodopayments';
import { db } from './db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Clerk client (server-side)
const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY || ''
});

// ── Exchange Rates Cache ──────────────────────────────────────────────────────

const FALLBACK_RATES: Record<string, number> = {
  USD: 1.0, INR: 85.02, EUR: 0.92, GBP: 0.78, JPY: 156.40,
  AUD: 1.51, CAD: 1.37, CHF: 0.90, CNY: 7.24, SGD: 1.35,
  HKD: 7.81, AED: 3.67, SAR: 3.75, MYR: 4.71, THB: 36.65, NZD: 1.63
};

interface RatesCache { rates: Record<string, number>; timestamp: number; }
let ratesCache: RatesCache = { rates: FALLBACK_RATES, timestamp: 0 };
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

async function getLiveRates(): Promise<Record<string, number>> {
  const now = Date.now();
  if (now - ratesCache.timestamp < CACHE_DURATION) return ratesCache.rates;
  try {
    console.log('Fetching live exchange rates...');
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!response.ok) throw new Error(`API returned status ${response.status}`);
    const data = await response.json() as any;
    if (data && data.rates) {
      ratesCache = { rates: data.rates, timestamp: now };
      console.log('Live exchange rates updated successfully.');
      return data.rates;
    }
    throw new Error('Invalid response format');
  } catch (error) {
    console.error('Failed to fetch live exchange rates, using cache/fallback:', error);
    if (ratesCache.timestamp === 0) ratesCache.timestamp = now;
    return ratesCache.rates;
  }
}

// ── Middleware ────────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS: string[] = [
  'https://currenceconverter.me',
  'https://www.currenceconverter.me',
];
if (process.env.NODE_ENV !== 'production') {
  ALLOWED_ORIGINS.push(
    'http://localhost:5173', 'http://localhost:5001',
    'http://127.0.0.1:5173', 'http://127.0.0.1:5001'
  );
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, extensions)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// NOTE: Raw body middleware for webhook signature verification MUST come first
// We use express.raw() for the webhook route, then express.json() for everything else
app.use('/api/webhooks/dodo', express.raw({ type: 'application/json' }));
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ── Helper: Verify Clerk token ────────────────────────────────────────────────

async function getClerkUserId(req: express.Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    // Verify the session token with Clerk
    const sessionClaims = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY
    });
    return sessionClaims.sub || null;
  } catch (error) {
    console.error('Clerk token verification failed:', error);
    return null;
  }
}

// ── Rates endpoint ────────────────────────────────────────────────────────────

app.get('/api/rates', async (req, res) => {
  try {
    const rates = await getLiveRates();
    res.json({ success: true, rates, base: 'USD', updatedAt: new Date(ratesCache.timestamp).toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to retrieve exchange rates', error: error.message });
  }
});

// ── Guest token helpers (signed, non-guessable) ──────────────────────────────

const GUEST_SIGNING_SECRET = process.env.GUEST_SIGNING_SECRET || 'hc-guest-default-' + (process.env.CLERK_SECRET_KEY || '').slice(-16);

function createGuestToken(userId: string): string {
  return crypto.createHmac('sha256', GUEST_SIGNING_SECRET).update(userId).digest('hex');
}

function verifyGuestSignature(userId: string, token: string): boolean {
  if (!token || !userId) return false;
  try {
    const expected = createGuestToken(userId);
    if (expected.length !== token.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(token, 'hex'));
  } catch {
    return false;
  }
}

// ── Helper: Verify user access to settings ────────────────────────────────────

async function verifyUserAccess(req: express.Request, userIdFromParam: string): Promise<boolean> {
  const tokenClerkUserId = await getClerkUserId(req);
  if (tokenClerkUserId) {
    return tokenClerkUserId === userIdFromParam;
  }
  // Guest access requires a server-issued signed token
  const guestToken = req.headers['x-guest-token'] as string;
  if (guestToken && userIdFromParam.startsWith('user_')) {
    return verifyGuestSignature(userIdFromParam, guestToken);
  }
  return false;
}

// ── Guest token endpoint ──────────────────────────────────────────────────────

app.post('/api/guest-token', (_req, res) => {
  const userId = 'user_' + crypto.randomBytes(5).toString('hex').slice(0, 9);
  const token = createGuestToken(userId);
  res.json({ userId, token });
});

// ── Settings endpoints ────────────────────────────────────────────────────────

app.get('/api/settings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const hasAccess = await verifyUserAccess(req, userId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Forbidden. Access to settings denied.' });
    }
    const settings = await db.getSettings(userId);
    res.json({ success: true, settings });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/settings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const hasAccess = await verifyUserAccess(req, userId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Forbidden. Access to settings denied.' });
    }
    const updates = req.body;
    const settings = await db.updateSettings(userId, updates);
    res.json({ success: true, settings });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Extension compatibility endpoints ──────────────────────────────────────────

app.get('/api/me', async (req, res) => {
  try {
    const clerkUserId = await getClerkUserId(req);
    if (!clerkUserId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await clerk.users.getUser(clerkUserId);
    const email = user.emailAddresses[0]?.emailAddress || '';
    res.json({
      user: {
        id: clerkUserId,
        email: email
      }
    });
  } catch (error: any) {
    console.error('Error fetching user info:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/subscription/status', async (req, res) => {
  try {
    const clerkUserId = await getClerkUserId(req);
    if (!clerkUserId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const subscription = await db.getSubscription(clerkUserId);
    const active = !!(subscription && subscription.premium);
    res.json({
      active,
      status: active ? 'active' : 'inactive',
      plan_type: subscription?.plan || 'free',
      expires_at: null
    });
  } catch (error: any) {
    console.error('Error fetching subscription status:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/subscription/create-checkout', async (req, res) => {
  const DODO_API_KEY = process.env.DODO_API_KEY;
  const DODO_PRODUCT_ID = process.env.DODO_PRODUCT_ID;
  const APP_URL = process.env.APP_URL || 'https://hoverconvert.vercel.app';

  if (!DODO_API_KEY || !DODO_PRODUCT_ID) {
    console.error('DODO_API_KEY or DODO_PRODUCT_ID not set');
    return res.status(500).json({ error: 'Payment not configured' });
  }

  try {
    const clerkUserId = await getClerkUserId(req);
    if (!clerkUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await clerk.users.getUser(clerkUserId);
    const email = user.emailAddresses[0]?.emailAddress;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const dodo = new DodoPayments({
      bearerToken: DODO_API_KEY,
      environment: DODO_API_KEY.includes('test') || DODO_API_KEY.startsWith('E-') ? 'test_mode' : 'live_mode'
    });

    const session = await dodo.checkoutSessions.create({
      product_cart: [
        {
          product_id: DODO_PRODUCT_ID,
          quantity: 1
        }
      ],
      customer: {
        email: email,
        name: email.split('@')[0]
      },
      metadata: {
        clerkUserId: clerkUserId,
        email: email
      },
      return_url: `${APP_URL}/payment-success`,
      cancel_url: `${APP_URL}/payment-failed`
    });

    const checkoutUrl = session.checkout_url;

    if (!checkoutUrl) {
      return res.status(500).json({ error: 'No checkout URL returned' });
    }

    res.json({ checkout_url: checkoutUrl });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// ── License validation & activation (legacy) ─────────────────────────────────

app.post('/api/license/activate', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Invalid email address' });
    }
    const license = await db.createLicense(email);
    res.json({ success: true, message: 'License activated successfully', license });
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
      res.json({ success: true, valid: true, license });
    } else {
      res.json({ success: true, valid: false, message: 'Invalid or expired license key' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Feedback endpoint ─────────────────────────────────────────────────────────

app.post('/api/feedback', async (req, res) => {
  try {
    const { email, message } = req.body;
    if (!email || !message) {
      return res.status(400).json({ success: false, message: 'Email and message are required' });
    }
    const feedback = await db.addFeedback(email, message);
    res.json({ success: true, message: 'Thank you for your feedback! We will get back to you shortly.', feedback });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Helper: Secure Admin Access Verification
async function isAdminRequest(req: express.Request): Promise<boolean> {
  const authHeader = req.headers['x-admin-key'] || req.query.adminKey;
  
  if (process.env.ADMIN_API_KEY && authHeader === process.env.ADMIN_API_KEY) {
    return true;
  }
  
  try {
    const clerkUserId = await getClerkUserId(req);
    if (clerkUserId) {
      const user = await clerk.users.getUser(clerkUserId);
      const email = user.emailAddresses[0]?.emailAddress;
      if (email && process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL) {
        return true;
      }
    }
  } catch (error) {
    console.error('Error verifying Clerk admin status:', error);
  }
  
  const isLocal = req.hostname === 'localhost' || req.hostname === '127.0.0.1';
  if (process.env.NODE_ENV !== 'production' && isLocal) {
    return true;
  }
  
  return false;
}

// GET all feedback / queries (admin only)
app.get('/api/feedback', async (req, res) => {
  try {
    if (!(await isAdminRequest(req))) {
      return res.status(403).json({ success: false, message: 'Unauthorized. Admin access required.' });
    }

    const feedbackList = await db.getAllFeedback();
    const enrichedList = await Promise.all(
      feedbackList.map(async (item: any) => {
        const isProUser = await db.isEmailPro(item.email);
        return { ...item, isPro: isProUser };
      })
    );
    res.json({ success: true, feedback: enrichedList });
  } catch (error: any) {
    console.error('Error fetching feedback list:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE a specific feedback / query (admin only)
app.delete('/api/feedback/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!(await isAdminRequest(req))) {
      return res.status(403).json({ success: false, message: 'Unauthorized. Admin access required.' });
    }

    const success = await db.deleteFeedback(id);
    res.json({ success, message: success ? 'Query resolved successfully.' : 'Query not found.' });
  } catch (error: any) {
    console.error('Error deleting feedback:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── NEW: Check Premium Status ─────────────────────────────────────────────────
// GET /api/check-premium
// Accepts: Authorization: Bearer <clerk-session-token>
//       OR: ?userId=<clerkUserId> (for extension quick-check)

app.get('/api/check-premium', async (req, res) => {
  try {
    // Auth-derived userId only — no query param fallback
    const clerkUserId: string | null = await getClerkUserId(req);

    if (!clerkUserId) {
      // Not logged in — free tier
      return res.json({
        premium: false,
        plan: 'free',
        dailyLimit: 50
      });
    }

    const subscription = await db.getSubscription(clerkUserId);

    if (subscription && subscription.premium) {
      return res.json({
        premium: true,
        plan: subscription.plan,
        dailyLimit: null
      });
    }

    return res.json({
      premium: false,
      plan: 'free',
      dailyLimit: 50
    });
  } catch (error: any) {
    console.error('check-premium error:', error);
    // On error, default to free tier (fail open) to avoid blocking free users
    res.json({ premium: false, plan: 'free', dailyLimit: 50 });
  }
});

// ── NEW: Dodo Payments Webhook ────────────────────────────────────────────────
// POST /api/webhooks/dodo
// Verifies Svix signature, reads Clerk userId from metadata, marks user as premium

app.post('/api/webhooks/dodo', async (req, res) => {
  const DODO_WEBHOOK_SECRET = process.env.DODO_WEBHOOK_SECRET;

  if (!DODO_WEBHOOK_SECRET) {
    console.error('DODO_WEBHOOK_SECRET not set');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  // Svix signature verification
  const svixId = req.headers['svix-id'] as string;
  const svixTimestamp = req.headers['svix-timestamp'] as string;
  const svixSignature = req.headers['svix-signature'] as string;

  if (!svixId || !svixTimestamp || !svixSignature) {
    return res.status(400).json({ error: 'Missing Svix headers' });
  }

  let payload: any;
  try {
    const wh = new Webhook(DODO_WEBHOOK_SECRET);
    payload = wh.verify(req.body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature
    });
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const eventType: string = payload.type || payload.event_type || '';
  console.log(`Dodo webhook received: ${eventType}`);

  // Handle successful payment events
  const isSuccessEvent = [
    'payment.succeeded',
    'payment.completed',
    'subscription.activated',
    'order.paid'
  ].includes(eventType);

  const isRevokeEvent = [
    'subscription.cancelled',
    'subscription.revoked',
    'subscription.expired',
    'payment.refunded'
  ].includes(eventType);

  if (isSuccessEvent) {
    try {
      // Extract metadata from the Dodo payload
      // Dodo typically nests customer data and metadata differently
      const metadata = payload.data?.metadata || payload.metadata || {};
      const customer = payload.data?.customer || payload.customer || {};

      const clerkUserId: string | undefined = metadata.clerkUserId || metadata.clerk_user_id;
      const email: string | undefined =
        metadata.email ||
        customer.email ||
        payload.data?.payment_link?.customer?.email;

      const paymentId: string =
        payload.data?.payment_id ||
        payload.data?.id ||
        payload.id ||
        'unknown';

      if (!clerkUserId) {
        console.error('Webhook: clerkUserId missing from metadata', JSON.stringify(payload, null, 2));
        // Acknowledge receipt even if we can't process — prevents Dodo from retrying
        return res.status(200).json({ received: true, warning: 'clerkUserId missing from metadata' });
      }

      console.log(`Activating pro for clerkUserId=${clerkUserId}, email=${email}, paymentId=${paymentId}`);

      await db.upsertSubscription(
        clerkUserId,
        email || '',
        'pro_lifetime',
        paymentId
      );

      console.log(`✅ User ${clerkUserId} upgraded to pro_lifetime`);
      return res.status(200).json({ received: true, upgraded: true });
    } catch (error: any) {
      console.error('Webhook processing error:', error);
      return res.status(500).json({ error: 'Failed to process webhook' });
    }
  }

  if (isRevokeEvent) {
    try {
      const metadata = payload.data?.metadata || payload.metadata || {};
      const customer = payload.data?.customer || payload.customer || {};

      const clerkUserId: string | undefined = metadata.clerkUserId || metadata.clerk_user_id;
      const email: string | undefined =
        metadata.email ||
        customer.email ||
        payload.data?.payment_link?.customer?.email;

      if (!clerkUserId) {
        console.error('Webhook: clerkUserId missing from metadata in revoke event', JSON.stringify(payload, null, 2));
        return res.status(200).json({ received: true, warning: 'clerkUserId missing from metadata' });
      }

      console.log(`Revoking/downgrading pro for clerkUserId=${clerkUserId}, email=${email}`);

      await db.upsertSubscription(
        clerkUserId,
        email || '',
        'free',
        null
      );

      console.log(`❌ User ${clerkUserId} subscription status set to free`);
      return res.status(200).json({ received: true, revoked: true });
    } catch (error: any) {
      console.error('Webhook processing error:', error);
      return res.status(500).json({ error: 'Failed to process webhook' });
    }
  }

  // For all other event types, acknowledge receipt
  res.status(200).json({ received: true });
});

// ── NEW: Create Dodo Checkout Session ────────────────────────────────────────
// POST /api/create-checkout
// Body: { clerkUserId, email }
// Returns: { checkoutUrl }
// This keeps the Dodo API key server-side only.

app.post('/api/create-checkout', async (req, res) => {
  const DODO_API_KEY = process.env.DODO_API_KEY;
  const DODO_PRODUCT_ID = process.env.DODO_PRODUCT_ID;
  const APP_URL = process.env.APP_URL || 'https://hoverconvert.vercel.app';

  if (!DODO_API_KEY || !DODO_PRODUCT_ID) {
    console.error('DODO_API_KEY or DODO_PRODUCT_ID not set');
    return res.status(500).json({ success: false, message: 'Payment not configured' });
  }

  try {
    // Verify user is authenticated with Clerk
    const clerkUserId = await getClerkUserId(req);
    if (!clerkUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Initialize DodoPayments client
    const dodo = new DodoPayments({
      bearerToken: DODO_API_KEY,
      environment: DODO_API_KEY.includes('test') || DODO_API_KEY.startsWith('E-') ? 'test_mode' : 'live_mode'
    });

    // Create a Dodo checkout session via SDK
    const session = await dodo.checkoutSessions.create({
      product_cart: [
        {
          product_id: DODO_PRODUCT_ID,
          quantity: 1
        }
      ],
      customer: {
        email: email,
        name: email.split('@')[0]
      },
      metadata: {
        clerkUserId: clerkUserId,
        email: email
      },
      return_url: `${APP_URL}/payment-success`,
      cancel_url: `${APP_URL}/payment-failed`
    });

    const checkoutUrl = session.checkout_url;

    if (!checkoutUrl) {
      return res.status(500).json({ success: false, message: 'No checkout URL returned' });
    }

    res.json({ success: true, checkoutUrl });
  } catch (error: any) {
    console.error('create-checkout error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/diagnostics', async (req, res) => {
  if (!(await isAdminRequest(req))) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const redisUrlSet = !!process.env.REDIS_URL;
  const redisStatus = await db.getRedisStatus();

  res.json({
    status: 'diagnostic_info',
    time: new Date().toISOString(),
    env: {
      CLERK_SECRET_KEY_PRESENT: !!process.env.CLERK_SECRET_KEY,
      DODO_API_KEY_PRESENT: !!process.env.DODO_API_KEY,
      DODO_PRODUCT_ID_PRESENT: !!process.env.DODO_PRODUCT_ID,
      DODO_WEBHOOK_SECRET_PRESENT: !!process.env.DODO_WEBHOOK_SECRET,
      REDIS_URL_PRESENT: redisUrlSet,
      VERCEL_ENV: process.env.VERCEL || 'not_vercel',
    },
  });
});

app.get('/api/debug/make-pro', async (req, res) => {
  try {
    if (!(await isAdminRequest(req))) {
      return res.status(403).json({ success: false, message: 'Unauthorized. Admin access required for debug endpoints.' });
    }
    let clerkUserId = await getClerkUserId(req);
    if (!clerkUserId && req.query.userId) {
      clerkUserId = req.query.userId as string;
    }

    if (!clerkUserId) {
      return res.status(400).json({
        success: false,
        message: 'Clerk User ID required. Pass it via Authorization header or ?userId=user_...'
      });
    }

    const email = (req.query.email as string) || 'debug-user@example.com';

    const subscription = await db.upsertSubscription(
      clerkUserId,
      email,
      'pro_lifetime',
      'debug_manual_upgrade_' + Date.now()
    );

    res.json({
      success: true,
      message: `Successfully upgraded user ${clerkUserId} to pro_lifetime in Redis!`,
      subscription
    });
  } catch (error: any) {
    console.error('Failed to manually upgrade user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Start Server ──────────────────────────────────────────────────────────────

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`HoverConvert backend running on port ${PORT}`);
  });
}

export default app;
