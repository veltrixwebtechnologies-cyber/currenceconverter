import {
  validateRates,
  convertCurrency,
  FALLBACK_RATES,
  rateService
} from './rateService';

async function runTests() {
  console.log('=== RUNNING EXCHANGE RATE SYSTEM INTEGRATION & UNIT TESTS ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // Test 1: USD -> INR conversion
  try {
    const res = convertCurrency(100, 'USD', 'INR', FALLBACK_RATES);
    const expected = 100 * FALLBACK_RATES.INR;
    assert(Math.abs(res.amount - expected) < 0.001, `USD to INR conversion (Got ${res.amount}, expected ${expected})`);
    assert(res.rate === FALLBACK_RATES.INR, 'USD to INR rate matches');
  } catch (e: any) {
    assert(false, `USD to INR conversion threw error: ${e.message}`);
  }

  // Test 2: INR -> USD conversion
  try {
    const res = convertCurrency(8502, 'INR', 'USD', FALLBACK_RATES);
    const expected = 8502 / FALLBACK_RATES.INR; // 100
    assert(Math.abs(res.amount - expected) < 0.001, `INR to USD conversion (Got ${res.amount}, expected ${expected})`);
  } catch (e: any) {
    assert(false, `INR to USD conversion threw error: ${e.message}`);
  }

  // Test 3: Cross currency EUR -> INR
  try {
    const res = convertCurrency(10, 'EUR', 'INR', FALLBACK_RATES);
    const expectedUsd = 10 / FALLBACK_RATES.EUR;
    const expectedInr = expectedUsd * FALLBACK_RATES.INR;
    assert(Math.abs(res.amount - expectedInr) < 0.01, `Cross currency EUR to INR (Got ${res.amount}, expected ${expectedInr})`);
  } catch (e: any) {
    assert(false, `EUR to INR conversion threw error: ${e.message}`);
  }

  // Test 4: Cross currency INR -> EUR
  try {
    const res = convertCurrency(1000, 'INR', 'EUR', FALLBACK_RATES);
    const expectedUsd = 1000 / FALLBACK_RATES.INR;
    const expectedEur = expectedUsd * FALLBACK_RATES.EUR;
    assert(Math.abs(res.amount - expectedEur) < 0.01, `Cross currency INR to EUR (Got ${res.amount}, expected ${expectedEur})`);
  } catch (e: any) {
    assert(false, `INR to EUR conversion threw error: ${e.message}`);
  }

  // Test 5: GBP -> JPY
  try {
    const res = convertCurrency(50, 'GBP', 'JPY', FALLBACK_RATES);
    const expectedUsd = 50 / FALLBACK_RATES.GBP;
    const expectedJpy = expectedUsd * FALLBACK_RATES.JPY;
    assert(Math.abs(res.amount - expectedJpy) < 0.1, `Cross currency GBP to JPY (Got ${res.amount}, expected ${expectedJpy})`);
  } catch (e: any) {
    assert(false, `GBP to JPY conversion threw error: ${e.message}`);
  }

  // Test 6: Same currency (USD -> USD)
  try {
    const res = convertCurrency(250, 'USD', 'USD', FALLBACK_RATES);
    assert(res.amount === 250 && res.rate === 1.0, 'Same currency conversion returns exact amount and 1.0 rate');
  } catch (e: any) {
    assert(false, `Same currency conversion threw error: ${e.message}`);
  }

  // Test 7: Missing currency error handling
  try {
    convertCurrency(100, 'USD', 'XYZ_UNSUPPORTED', FALLBACK_RATES);
    assert(false, 'Missing currency should throw an error');
  } catch (e: any) {
    assert(e.message.includes('unavailable'), `Missing currency throws expected error message (${e.message})`);
  }

  // Test 8: Rate validation
  assert(validateRates(FALLBACK_RATES) === true, 'Valid rate dataset returns true');
  assert(validateRates(null) === false, 'Null dataset returns false');
  assert(validateRates({}) === false, 'Empty dataset returns false');
  assert(validateRates({ USD: 1, EUR: -0.5, INR: 80, GBP: 0.8, JPY: 150 }) === false, 'Negative rate returns false');
  assert(validateRates({ USD: 1, EUR: NaN, INR: 80, GBP: 0.8, JPY: 150 }) === false, 'NaN rate returns false');

  // Test 9: RateService cache retrieval
  try {
    const snapshot = await rateService.getRates();
    assert(snapshot.base === 'USD', 'Snapshot base currency is USD');
    assert(snapshot.rates && typeof snapshot.rates.INR === 'number', 'Snapshot contains numeric INR rate');
    assert(typeof snapshot.fetchedAt === 'string', 'Snapshot contains valid ISO fetchedAt timestamp');
    assert(typeof snapshot.expiresAt === 'string', 'Snapshot contains valid ISO expiresAt timestamp');
  } catch (e: any) {
    assert(false, `RateService getRates threw error: ${e.message}`);
  }

  console.log(`\n=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
