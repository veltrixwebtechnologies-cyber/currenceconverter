import express from 'express';
import crypto from 'crypto';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { Webhook } from 'svix';
import DodoPayments from 'dodopayments';
import { db } from './db';
import { rateService, convertCurrency } from './rateService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Firebase Admin initialization
if (!getApps().length) {
  initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'hoverconvert-app'
  });
}

// ── Middleware ────────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS: string[] = [
  'https://currenceconverter.me',
  'https://www.currenceconverter.me',
];
if (process.env.NODE_ENV !== 'production') {
  ALLOWED_ORIGINS.push(
    'http://localhost:5173', 'http://localhost:5001', 'http://localhost:5174', 'http://localhost:5175',
    'http://127.0.0.1:5173', 'http://127.0.0.1:5001', 'http://127.0.0.1:5174', 'http://127.0.0.1:5175'
  );
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use('/api/webhooks/dodo', express.raw({ type: 'application/json' }));
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ── Helper: Verify Firebase Auth Token ──────────────────────────────────────────

async function getAuthUserId(req: express.Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token && req.query.userId) {
    token = req.query.userId as string;
  }
  if (!token) return null;

  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    return decodedToken.uid || null;
  } catch (error) {
    // If token is JWT, attempt parsing fallback for local development
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        if (payload && (payload.uid || payload.sub || payload.user_id)) {
          return payload.uid || payload.sub || payload.user_id;
        }
      }
    } catch (_) { }

    // Fallback: simple token/id string passed from dev/extension
    if (token.length > 3 && !token.includes(' ')) {
      return token;
    }
    return null;
  }
}

// ── Rates & Conversion endpoints ──────────────────────────────────────────────

app.get('/api/rates', async (req, res) => {
  try {
    const force = req.query.force === 'true';
    const snapshot = await rateService.getRates(force);
    res.json({
      success: true,
      base: snapshot.base,
      rates: snapshot.rates,
      fetchedAt: snapshot.fetchedAt,
      expiresAt: snapshot.expiresAt,
      stale: snapshot.stale,
      provider: snapshot.provider,
      updatedAt: snapshot.fetchedAt
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to retrieve exchange rates', error: error.message });
  }
});

app.get('/api/convert', async (req, res) => {
  try {
    const amountStr = req.query.amount as string;
    const from = (req.query.from as string) || 'USD';
    const to = (req.query.to as string) || 'INR';

    if (!amountStr) {
      return res.status(400).json({ success: false, message: 'Missing required parameter: amount' });
    }

    const amount = parseFloat(amountStr);
    if (isNaN(amount)) {
      return res.status(400).json({ success: false, message: 'Invalid amount parameter' });
    }

    const force = req.query.force === 'true';
    const snapshot = await rateService.getRates(force);
    const result = convertCurrency(amount, from, to, snapshot.rates);

    res.json({
      success: true,
      query: { amount, from: from.toUpperCase(), to: to.toUpperCase() },
      result: result.amount,
      rate: result.rate,
      updatedAt: snapshot.fetchedAt,
      stale: snapshot.stale,
      provider: snapshot.provider
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Conversion failed', error: error.message });
  }
});

// ── User & Subscription Endpoints ──────────────────────────────────────────

app.get('/api/me', async (req, res) => {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    let email = '';
    try {
      const userRecord = await getAuth().getUser(userId);
      email = userRecord.email || '';
    } catch (_) { }

    res.json({
      user: {
        id: userId,
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
    const userId = await getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const subscription = await db.getSubscription(userId);
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

app.post('/api/subscription/confirm-payment', async (req, res) => {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { paymentId, subscriptionId, email } = req.body || {};
    let userEmail = email;

    if (!userEmail) {
      try {
        const u = await getAuth().getUser(userId);
        userEmail = u.email;
      } catch (_) {}
    }

    const refId = paymentId || subscriptionId || 'dodo_direct_' + Date.now();
    await db.upsertSubscription(userId, userEmail || '', 'pro_lifetime', refId);

    console.log(`✅ Direct payment confirmation activated for userId=${userId}, email=${userEmail}`);
    res.json({ success: true, message: 'Pro subscription activated' });
  } catch (error: any) {
    console.error('Payment confirmation error:', error);
    res.status(500).json({ success: false, message: error.message });
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
    const userId = await getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let email = req.body?.email;
    if (!email) {
      try {
        const u = await getAuth().getUser(userId);
        email = u.email;
      } catch (_) { }
    }

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
        userId: userId,
        clerkUserId: userId,
        email: email
      },
      return_url: `${APP_URL}/payment-success`,
      cancel_url: `${APP_URL}/payment-failed`
    });

    const checkoutUrl = session.checkout_url;

    if (!checkoutUrl) {
      return res.status(500).json({ error: 'Failed to create payment session' });
    }

    res.json({ url: checkoutUrl, checkoutUrl });
  } catch (error: any) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── Support / Feedback Endpoints ────────────────────────────────────────────

app.post('/api/support', async (req, res) => {
  try {
    const { email, message } = req.body;
    if (!email || !message) {
      return res.status(400).json({ success: false, message: 'Email and message are required.' });
    }
    const feedback = await db.addFeedback(email, message);
    res.json({ success: true, message: 'Support ticket submitted successfully.', feedback });
  } catch (error: any) {
    console.error('Error saving feedback:', error);
    res.status(500).json({ success: false, message: 'Failed to submit support request.' });
  }
});

async function isAdminRequest(req: express.Request): Promise<boolean> {
  const authHeader = req.headers['x-admin-key'] || req.query.adminKey;

  if (process.env.ADMIN_API_KEY && authHeader === process.env.ADMIN_API_KEY) {
    return true;
  }

  try {
    const userId = await getAuthUserId(req);
    if (userId) {
      const user = await getAuth().getUser(userId);
      const email = user.email;
      if (email && process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL) {
        return true;
      }
    }
  } catch (error) {
    console.error('Error verifying admin status:', error);
  }

  const isLocal = req.hostname === 'localhost' || req.hostname === '127.0.0.1';
  if (process.env.NODE_ENV !== 'production' && isLocal) {
    return true;
  }

  return false;
}

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

// ── Check Premium Status ─────────────────────────────────────────────────

app.get('/api/check-premium', async (req, res) => {
  try {
    const userId: string | null = await getAuthUserId(req);

    if (!userId) {
      return res.json({
        premium: false,
        plan: 'free',
        dailyLimit: 50
      });
    }

    const subscription = await db.getSubscription(userId);

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
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Dodo Webhook ─────────────────────────────────────────────────────────────

app.post('/api/webhooks/dodo', async (req, res) => {
  const WEBHOOK_SECRET = process.env.DODO_WEBHOOK_SECRET;

  let payload: any;
  try {
    if (WEBHOOK_SECRET) {
      const svixHeaders = {
        'svix-id': req.headers['svix-id'] as string,
        'svix-timestamp': req.headers['svix-timestamp'] as string,
        'svix-signature': req.headers['svix-signature'] as string,
      };

      if (svixHeaders['svix-id'] && svixHeaders['svix-timestamp'] && svixHeaders['svix-signature']) {
        const wh = new Webhook(WEBHOOK_SECRET);
        const rawBody = (req.body instanceof Buffer) ? req.body.toString('utf8') : JSON.stringify(req.body);
        payload = wh.verify(rawBody, svixHeaders) as any;
      } else {
        payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      }
    } else {
      payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Webhook verification failed' });
  }

  const eventType: string = payload.type || payload.event || '';
  console.log(`Dodo Webhook received: type=${eventType}`);

  const isSuccessEvent = [
    'payment.succeeded',
    'checkout.session.completed',
    'subscription.active',
    'subscription.renewed'
  ].includes(eventType);

  const isRevokeEvent = [
    'subscription.cancelled',
    'subscription.revoked',
    'subscription.expired',
    'payment.refunded'
  ].includes(eventType);

  if (isSuccessEvent) {
    try {
      const metadata = payload.data?.metadata || payload.metadata || {};
      const customer = payload.data?.customer || payload.customer || {};

      const userId: string | undefined = metadata.userId || metadata.clerkUserId || metadata.clerk_user_id;
      const email: string | undefined =
        metadata.email ||
        customer.email ||
        payload.data?.payment_link?.customer?.email;

      const paymentId: string =
        payload.data?.payment_id ||
        payload.data?.id ||
        payload.id ||
        'unknown';

      if (!userId) {
        console.error('Webhook: userId missing from metadata', JSON.stringify(payload, null, 2));
        return res.status(200).json({ received: true, warning: 'userId missing from metadata' });
      }

      console.log(`Activating pro for userId=${userId}, email=${email}, paymentId=${paymentId}`);

      await db.upsertSubscription(
        userId,
        email || '',
        'pro_lifetime',
        paymentId
      );

      console.log(`✅ User ${userId} upgraded to pro_lifetime`);
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

      const userId: string | undefined = metadata.userId || metadata.clerkUserId || metadata.clerk_user_id;
      const email: string | undefined =
        metadata.email ||
        customer.email ||
        payload.data?.payment_link?.customer?.email;

      if (!userId) {
        console.error('Webhook: userId missing from metadata in revoke event', JSON.stringify(payload, null, 2));
        return res.status(200).json({ received: true, warning: 'userId missing from metadata' });
      }

      console.log(`Revoking/downgrading pro for userId=${userId}, email=${email}`);

      await db.upsertSubscription(
        userId,
        email || '',
        'free',
        null
      );

      console.log(`❌ User ${userId} subscription status set to free`);
      return res.status(200).json({ received: true, revoked: true });
    } catch (error: any) {
      console.error('Webhook processing error:', error);
      return res.status(500).json({ error: 'Failed to process webhook' });
    }
  }

  res.status(200).json({ received: true });
});

app.post('/api/create-checkout', async (req, res) => {
  const DODO_API_KEY = process.env.DODO_API_KEY;
  const DODO_PRODUCT_ID = process.env.DODO_PRODUCT_ID;
  const APP_URL = process.env.APP_URL || 'https://hoverconvert.vercel.app';

  if (!DODO_API_KEY || !DODO_PRODUCT_ID) {
    console.error('DODO_API_KEY or DODO_PRODUCT_ID not set');
    return res.status(500).json({ success: false, message: 'Payment not configured' });
  }

  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
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
        userId: userId,
        clerkUserId: userId,
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

  res.json({
    status: 'diagnostic_info',
    time: new Date().toISOString(),
    env: {
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
    let userId = await getAuthUserId(req);
    if (!userId && req.query.userId) {
      userId = req.query.userId as string;
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID required. Pass it via Authorization header or ?userId=...'
      });
    }

    const email = (req.query.email as string) || 'debug-user@example.com';

    const subscription = await db.upsertSubscription(
      userId,
      email,
      'pro_lifetime',
      'debug_manual_upgrade_' + Date.now()
    );

    res.json({
      success: true,
      message: `Successfully upgraded user ${userId} to pro_lifetime!`,
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
