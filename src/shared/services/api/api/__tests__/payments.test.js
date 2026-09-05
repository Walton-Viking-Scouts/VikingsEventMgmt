import { describe, it, expect, vi, beforeEach } from 'vitest';

const { networkMock, demoMock, cacheMock } = vi.hoisted(() => ({
  networkMock: { online: true },
  demoMock: { enabled: false },
  cacheMock: { store: new Map() },
}));

vi.mock('../../../../../config/demoMode.js', () => ({
  isDemoMode: vi.fn(() => demoMock.enabled),
}));

vi.mock('../../../../utils/networkUtils.js', () => ({
  checkNetworkStatus: vi.fn(async () => networkMock.online),
  addNetworkListener: vi.fn(),
}));

vi.mock('../../../../utils/rateLimitQueue.js', () => ({
  withRateLimitQueue: vi.fn((fn) => fn()),
  globalRateLimitQueue: { applyQuotaInfo: vi.fn(), clear: vi.fn() },
}));

vi.mock('../../../auth/tokenService.js', () => ({
  isTokenExpired: vi.fn(() => false),
  checkWritePermission: vi.fn(),
}));

vi.mock('../../../auth/authHandler.js', () => ({
  authHandler: {
    handleAPIResponse: vi.fn((response) => response.status !== 401),
    shouldMakeAPICall: vi.fn(() => true),
    reset: vi.fn(),
    hasAuthFailed: vi.fn(() => false),
  },
}));

vi.mock('../../../utils/sentry.js', () => ({
  sentryUtils: { addBreadcrumb: vi.fn(), captureException: vi.fn() },
}));

vi.mock('../../../storage/indexedDBService.js', () => ({
  default: {
    STORES: { CACHE_DATA: 'cache_data' },
    get: vi.fn(async (_store, key) => cacheMock.store.get(key) ?? null),
    set: vi.fn(async (_store, key, value) => {
      cacheMock.store.set(key, value);
      return true;
    }),
  },
}));

import { getPaymentSchemes, getPaymentStatus } from '../payments.js';
import { isTokenExpired } from '../../../auth/tokenService.js';

function okResponse(body) {
  return { ok: true, status: 200, url: 'https://test/endpoint', json: async () => body };
}

function lastUrl() {
  return global.fetch.mock.calls.at(-1)[0];
}

beforeEach(() => {
  networkMock.online = true;
  demoMock.enabled = false;
  cacheMock.store.clear();
  localStorage.removeItem('osm_blocked');
  isTokenExpired.mockReturnValue(false);
  global.fetch = vi.fn(async () => okResponse({ items: [], _rateLimitInfo: {} }));
});

describe('getPaymentSchemes', () => {
  it('requests the schemes endpoint with sectionid', async () => {
    await getPaymentSchemes(49097, 'tok');
    expect(lastUrl()).toContain('/get-payment-schemes?sectionid=49097');
  });

  it('strips _rateLimitInfo and caches the response', async () => {
    const result = await getPaymentSchemes(49097, 'tok');
    expect(result).toEqual({ items: [] });
    const cached = cacheMock.store.get('viking_payment_schemes_49097');
    expect(cached.items).toEqual([]);
    expect(typeof cached._cacheTimestamp).toBe('number');
  });

  it('serves a fresh cache without hitting the network', async () => {
    cacheMock.store.set('viking_payment_schemes_49097', { items: [{ schemeid: '1' }], _cacheTimestamp: Date.now() });
    const result = await getPaymentSchemes(49097, 'tok');
    expect(result.items).toHaveLength(1);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('bypasses the cache with forceRefresh', async () => {
    cacheMock.store.set('viking_payment_schemes_49097', { items: [{ schemeid: '1' }], _cacheTimestamp: Date.now() });
    await getPaymentSchemes(49097, 'tok', { forceRefresh: true });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns null in demo mode without calling the API', async () => {
    demoMock.enabled = true;
    await expect(getPaymentSchemes(49097, 'tok')).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('throws when offline with no cached data', async () => {
    networkMock.online = false;
    await expect(getPaymentSchemes(49097, 'tok')).rejects.toThrow('no cached data available');
  });

  it('rejects a malformed body instead of caching it', async () => {
    global.fetch = vi.fn(async () => okResponse({ nope: true }));
    await expect(getPaymentSchemes(49097, 'tok')).rejects.toThrow('unexpected response shape');
    expect(cacheMock.store.size).toBe(0);
  });

  it('rejects an empty body', async () => {
    global.fetch = vi.fn(async () => okResponse(null));
    await expect(getPaymentSchemes(49097, 'tok')).rejects.toThrow('empty response from OSM');
  });

  it('rejects a body flagging an OSM error, naming the section', async () => {
    global.fetch = vi.fn(async () => okResponse({ status: false, error: 'no access' }));
    await expect(getPaymentSchemes(49097, 'tok'))
      .rejects.toThrow('Payment schemes for section 49097: OSM reported "no access"');
  });
});

describe('no stale-cache fallback', () => {
  const stale = { items: [{ schemeid: '1' }], _cacheTimestamp: Date.now() - (31 * 60 * 1000) };

  it('throws rather than serving a stale cache when the request fails', async () => {
    cacheMock.store.set('viking_payment_schemes_49097', stale);
    global.fetch = vi.fn(async () => ({
      ok: false, status: 500, url: 'https://test/endpoint', json: async () => ({ error: 'boom' }),
    }));
    await expect(getPaymentSchemes(49097, 'tok')).rejects.toThrow();
  });

  it('throws TokenExpiredError rather than serving a stale cache', async () => {
    cacheMock.store.set('viking_payment_schemes_49097', stale);
    isTokenExpired.mockReturnValue(true);
    await expect(getPaymentSchemes(49097, 'tok'))
      .rejects.toMatchObject({ isTokenExpired: true, status: 401 });
  });

  it('throws rather than serving a stale cache when offline', async () => {
    cacheMock.store.set('viking_payment_schemes_49097', stale);
    networkMock.online = false;
    await expect(getPaymentSchemes(49097, 'tok')).rejects.toThrow('no cached data available');
  });

  it('still serves a fresh cache, timestamp intact, without fetching', async () => {
    const fresh = { items: [{ schemeid: '1' }], _cacheTimestamp: Date.now() - 1000 };
    cacheMock.store.set('viking_payment_schemes_49097', fresh);
    const result = await getPaymentSchemes(49097, 'tok');
    expect(result._cacheTimestamp).toBe(fresh._cacheTimestamp);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('ignores even a fresh cache under forceRefresh', async () => {
    cacheMock.store.set('viking_payment_schemes_49097', { items: [{ schemeid: '1' }], _cacheTimestamp: Date.now() });
    await getPaymentSchemes(49097, 'tok', { forceRefresh: true });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('getPaymentStatus', () => {
  it('sends sectionid, schemeid, termid and payload=1', async () => {
    global.fetch = vi.fn(async () => okResponse({ status: true, data: { members: [] } }));
    await getPaymentStatus(49097, 60603, 965353, 'tok');
    expect(lastUrl()).toContain(
      '/get-payment-status?sectionid=49097&schemeid=60603&termid=965353&payload=1',
    );
  });

  it('caches under the section/scheme/term key', async () => {
    global.fetch = vi.fn(async () => okResponse({ status: true, data: { members: [] } }));
    await getPaymentStatus(49097, 60603, 965353, 'tok');
    expect(cacheMock.store.has('viking_payment_status_49097_60603_965353')).toBe(true);
  });

  it('bypasses the cache with forceRefresh', async () => {
    global.fetch = vi.fn(async () => okResponse({ status: true, data: { members: [] } }));
    cacheMock.store.set('viking_payment_status_49097_60603_965353', { data: { members: [] }, _cacheTimestamp: Date.now() });
    await getPaymentStatus(49097, 60603, 965353, 'tok', { forceRefresh: true });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws TokenExpiredError when the stored token has expired', async () => {
    isTokenExpired.mockReturnValue(true);
    await expect(getPaymentStatus(49097, 60603, 965353, 'tok'))
      .rejects.toMatchObject({ isTokenExpired: true, status: 401 });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a status body without a members array', async () => {
    global.fetch = vi.fn(async () => okResponse({ status: true, data: {} }));
    await expect(getPaymentStatus(49097, 60603, 965353, 'tok'))
      .rejects.toThrow('Payment status for scheme 60603 in section 49097: unexpected response shape');
  });

  it('surfaces a server 401 as a 401 error', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false, status: 401, url: 'https://test/endpoint', json: async () => ({ error: 'unauthorised' }),
    }));
    await expect(getPaymentStatus(49097, 60603, 965353, 'tok'))
      .rejects.toMatchObject({ status: 401 });
  });
});
