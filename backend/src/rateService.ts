import { db, ExchangeRatesSnapshot } from './db';

export const FALLBACK_RATES: Record<string, number> = {
  USD: 1.0, INR: 85.02, EUR: 0.92, GBP: 0.78, JPY: 156.40,
  AUD: 1.51, CAD: 1.37, CHF: 0.90, CNY: 7.24, SGD: 1.35,
  HKD: 7.81, AED: 3.67, SAR: 3.75, MYR: 4.71, THB: 36.65, NZD: 1.63,
  SEK: 10.50, NOK: 10.75, DKK: 6.90, KRW: 1380.0, MXN: 18.20,
  BRL: 5.40, ZAR: 18.10, TRY: 32.50, RUB: 89.0, IDR: 16200.0,
  PHP: 58.5, PLN: 4.0, CZK: 23.1, HUF: 365.0, ILS: 3.70, VND: 25400.0, TWD: 32.4
};

export const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function validateRates(rates: any): boolean {
  if (!rates || typeof rates !== 'object' || Array.isArray(rates)) return false;
  const keys = Object.keys(rates);
  if (keys.length < 5) return false;
  
  // Ensure USD rate exists
  if (rates.USD !== undefined && (typeof rates.USD !== 'number' || rates.USD <= 0)) {
    return false;
  }

  for (const key of keys) {
    const val = rates[key];
    if (typeof val !== 'number' || !Number.isFinite(val) || val <= 0) {
      return false;
    }
  }
  return true;
}

export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>
): { amount: number; rate: number } {
  if (amount === undefined || amount === null || !Number.isFinite(amount)) {
    throw new Error('Invalid amount for conversion');
  }

  const from = (fromCurrency || '').trim().toUpperCase();
  const to = (toCurrency || '').trim().toUpperCase();

  if (!from || !to) {
    throw new Error('From and To currencies are required');
  }

  if (from === to) {
    return { amount, rate: 1.0 };
  }

  const fromRate = rates[from];
  const toRate = rates[to];

  if (!fromRate || !toRate || fromRate <= 0 || toRate <= 0) {
    throw new Error(`Exchange rate unavailable for ${!fromRate ? from : to}`);
  }

  // Calculate via base currency (USD)
  const usdAmount = amount / fromRate;
  const targetAmount = usdAmount * toRate;
  const effectiveRate = toRate / fromRate;

  return {
    amount: targetAmount,
    rate: effectiveRate
  };
}

class RateService {
  private inMemorySnapshot: ExchangeRatesSnapshot | null = null;
  private fetchPromise: Promise<ExchangeRatesSnapshot> | null = null;

  /**
   * Primary entrypoint to get current exchange rates with 5-minute server-side caching.
   */
  async getRates(forceRefresh = false): Promise<ExchangeRatesSnapshot> {
    const now = Date.now();

    // Return cached in-memory snapshot if valid and not expired
    if (!forceRefresh && this.inMemorySnapshot) {
      const expiresAtMs = new Date(this.inMemorySnapshot.expiresAt).getTime();
      if (now < expiresAtMs && !this.inMemorySnapshot.stale) {
        console.log('[RateService] Cache hit — returning live cached rates');
        return this.inMemorySnapshot;
      }
    }

    // Coalesce concurrent refresh calls into single fetch Promise
    if (this.fetchPromise) {
      console.log('[RateService] Returning active in-flight fetch promise');
      return this.fetchPromise;
    }

    this.fetchPromise = this.refreshRates()
      .finally(() => {
        this.fetchPromise = null;
      });

    return this.fetchPromise;
  }

  private async refreshRates(): Promise<ExchangeRatesSnapshot> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + REFRESH_INTERVAL_MS);

    // 1. Try Open Exchange Rates
    const apiKey = process.env.OPENEXCHANGERATES_API_KEY || process.env.OPEN_EXCHANGE_RATES_API_KEY;
    if (apiKey) {
      try {
        console.log('[RateService] Fetching rates from Open Exchange Rates API...');
        const res = await fetch(`https://openexchangerates.org/api/latest.json?app_id=${apiKey}`);
        if (res.ok) {
          const data = (await res.json()) as any;
          if (data && data.rates && validateRates(data.rates)) {
            // Ensure USD base rate is explicitly set to 1.0
            data.rates.USD = 1.0;
            const snapshot: ExchangeRatesSnapshot = {
              base: 'USD',
              rates: data.rates,
              fetchedAt: now.toISOString(),
              expiresAt: expiresAt.toISOString(),
              stale: false,
              provider: 'openexchangerates'
            };
            this.inMemorySnapshot = snapshot;
            await db.saveExchangeRatesSnapshot(snapshot);
            console.log('[RateService] Successfully updated rates from Open Exchange Rates');
            return snapshot;
          } else {
            console.warn('[RateService] Open Exchange Rates response validation failed');
          }
        } else {
          console.warn(`[RateService] Open Exchange Rates API error status ${res.status}`);
        }
      } catch (err) {
        console.error('[RateService] Open Exchange Rates request failed:', err);
      }
    } else {
      console.log('[RateService] Open Exchange Rates API key not set, trying secondary provider...');
    }

    // 2. Secondary Provider Fallback (open.er-api.com)
    try {
      console.log('[RateService] Fetching rates from secondary provider (open.er-api.com)...');
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (res.ok) {
        const data = (await res.json()) as any;
        if (data && data.rates && validateRates(data.rates)) {
          data.rates.USD = 1.0;
          const snapshot: ExchangeRatesSnapshot = {
            base: 'USD',
            rates: data.rates,
            fetchedAt: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
            stale: false,
            provider: 'open_er_api'
          };
          this.inMemorySnapshot = snapshot;
          await db.saveExchangeRatesSnapshot(snapshot);
          console.log('[RateService] Successfully updated rates from secondary provider');
          return snapshot;
        }
      }
    } catch (err) {
      console.error('[RateService] Secondary provider request failed:', err);
    }

    // 3. Fallback to persisted database snapshot if network calls fail
    try {
      console.log('[RateService] Attempting fallback to persisted database rate snapshot...');
      const persistedSnapshot = await db.getExchangeRatesSnapshot();
      if (persistedSnapshot && validateRates(persistedSnapshot.rates)) {
        const staleSnapshot: ExchangeRatesSnapshot = {
          ...persistedSnapshot,
          stale: true,
          expiresAt: expiresAt.toISOString()
        };
        this.inMemorySnapshot = staleSnapshot;
        console.warn('[RateService] Serving stale persisted exchange rates snapshot');
        return staleSnapshot;
      }
    } catch (err) {
      console.error('[RateService] Failed reading database rate snapshot:', err);
    }

    // 4. Ultimate Local Static Fallback
    console.warn('[RateService] Serving hardcoded static FALLBACK_RATES');
    const staticSnapshot: ExchangeRatesSnapshot = {
      base: 'USD',
      rates: FALLBACK_RATES,
      fetchedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      stale: true,
      provider: 'fallback_static'
    };
    this.inMemorySnapshot = staticSnapshot;
    return staticSnapshot;
  }
}

export const rateService = new RateService();
