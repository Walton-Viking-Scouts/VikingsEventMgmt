import { describe, it, expect, vi, beforeEach } from 'vitest';

const { networkMock, demoMock } = vi.hoisted(() => ({
  networkMock: { online: true },
  demoMock: { enabled: false },
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
    handleAPIResponse: vi.fn(() => true),
    shouldMakeAPICall: vi.fn(() => true),
    reset: vi.fn(),
    hasAuthFailed: vi.fn(() => false),
  },
}));

vi.mock('../../../utils/sentry.js', () => ({
  sentryUtils: { addBreadcrumb: vi.fn(), captureException: vi.fn() },
}));

import { osmRequest } from '../base.js';
import { authHandler } from '../../../auth/authHandler.js';
import { isTokenExpired } from '../../../auth/tokenService.js';

function okResponse(body) {
  return {
    ok: true,
    status: 200,
    url: 'https://test/endpoint',
    json: async () => body,
  };
}

beforeEach(() => {
  networkMock.online = true;
  demoMock.enabled = false;
  localStorage.removeItem('osm_blocked');
  authHandler.shouldMakeAPICall.mockReturnValue(true);
  isTokenExpired.mockReturnValue(false);
  global.fetch = vi.fn(async () => okResponse({ items: [1, 2] }));
});

describe('osmRequest writes', () => {
  const writeOpts = { token: 'tok', method: 'POST', write: true, body: { a: 1 } };

  it('throws when offline instead of silently succeeding', async () => {
    networkMock.online = false;
    await expect(osmRequest('testWrite', '/write', writeOpts)).rejects.toThrow('cannot send write');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('throws when OSM access is blocked', async () => {
    localStorage.setItem('osm_blocked', 'true');
    await expect(osmRequest('testWrite', '/write', writeOpts)).rejects.toThrow('cannot send write');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('throws when the auth circuit breaker is open', async () => {
    authHandler.shouldMakeAPICall.mockReturnValue(false);
    await expect(osmRequest('testWrite', '/write', writeOpts)).rejects.toThrow('cannot send write');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rethrows API errors and never falls back to cache', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      url: 'https://test/endpoint',
      json: async () => ({ error: 'boom' }),
    }));
    const cacheRead = vi.fn(async () => ({ stale: true }));

    await expect(
      osmRequest('testWrite', '/write', { ...writeOpts, cacheRead }),
    ).rejects.toThrow('testWrite failed');
  });
});

describe('osmRequest reads', () => {
  it('returns fresh TTL cache without fetching', async () => {
    const cacheRead = vi.fn(async () => ({ items: ['cached'], _cacheTimestamp: Date.now() }));
    const result = await osmRequest('testRead', '/read', {
      token: 'tok',
      ttl: 60000,
      cacheRead,
    });
    expect(result.items).toEqual(['cached']);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('bypasses the TTL cache on forceRefresh', async () => {
    const cacheRead = vi.fn(async () => ({ items: ['cached'], _cacheTimestamp: Date.now() }));
    const result = await osmRequest('testRead', '/read', {
      token: 'tok',
      ttl: 60000,
      forceRefresh: true,
      cacheRead,
    });
    expect(result.items).toEqual([1, 2]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to cache when the API call fails', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('network reset');
    });
    const cacheRead = vi.fn(async () => ({ items: ['cached'] }));
    const result = await osmRequest('testRead', '/read', { token: 'tok', cacheRead });
    expect(result.items).toEqual(['cached']);
  });

  it('returns emptyValue offline with no cache', async () => {
    networkMock.online = false;
    const result = await osmRequest('testRead', '/read', {
      token: 'tok',
      emptyValue: { items: [] },
    });
    expect(result).toEqual({ items: [] });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('throws offline with no cache when throwWhenUnavailable is set', async () => {
    networkMock.online = false;
    await expect(
      osmRequest('testRead', '/read', { token: 'tok', throwWhenUnavailable: true }),
    ).rejects.toThrow('no cached data available');
  });

  it('runs transform before cacheWrite and returns the transformed value', async () => {
    const writes = [];
    const result = await osmRequest('testRead', '/read', {
      token: 'tok',
      transform: (data) => data.items.map((n) => n * 10),
      cacheWrite: async (value) => {
        writes.push(value);
      },
    });
    expect(result).toEqual([10, 20]);
    expect(writes).toEqual([[10, 20]]);
  });

  it('swallows cacheWrite failures and still returns the result', async () => {
    const result = await osmRequest('testRead', '/read', {
      token: 'tok',
      cacheWrite: async () => {
        throw new Error('quota exceeded');
      },
    });
    expect(result).toEqual({ items: [1, 2] });
  });

  it('strips _rateLimitInfo from the returned data', async () => {
    global.fetch = vi.fn(async () => okResponse({ items: [1], _rateLimitInfo: { osm: { remaining: 5 } } }));
    const result = await osmRequest('testRead', '/read', { token: 'tok' });
    expect(result._rateLimitInfo).toBeUndefined();
    expect(result.items).toEqual([1]);
  });
});

describe('osmRequest token handling (issue #233)', () => {
  it('read with a missing token falls back to cache instead of throwing', async () => {
    const cacheRead = vi.fn(async () => ({ items: ['cached'] }));
    const result = await osmRequest('testRead', '/read', { token: null, cacheRead });
    expect(result.items).toEqual(['cached']);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('read with a missing token and no cache rejects with code NO_TOKEN (not emptyValue)', async () => {
    await expect(
      osmRequest('testRead', '/read', { token: null, emptyValue: { items: [] } }),
    ).rejects.toMatchObject({ code: 'NO_TOKEN' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('read with an expired token falls back to cache', async () => {
    isTokenExpired.mockReturnValue(true);
    const cacheRead = vi.fn(async () => ({ items: ['cached'] }));
    const result = await osmRequest('testRead', '/read', { token: 'expired-tok', cacheRead });
    expect(result.items).toEqual(['cached']);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('write with a missing token still rejects (unchanged behavior)', async () => {
    const cacheRead = vi.fn(async () => ({ items: ['cached'] }));
    await expect(
      osmRequest('testWrite', '/write', {
        token: null, method: 'POST', write: true, body: { a: 1 }, cacheRead,
      }),
    ).rejects.toMatchObject({ code: 'NO_TOKEN' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('read with an expired token and no cache rejects with a TokenExpiredError shape', async () => {
    isTokenExpired.mockReturnValue(true);
    await expect(
      osmRequest('testRead', '/read', { token: 'expired-tok', emptyValue: { items: [] } }),
    ).rejects.toMatchObject({ isTokenExpired: true, status: 401 });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('write with an expired token still rejects (unchanged behavior)', async () => {
    isTokenExpired.mockReturnValue(true);
    await expect(
      osmRequest('testWrite', '/write', {
        token: 'expired-tok', method: 'POST', write: true, body: { a: 1 },
      }),
    ).rejects.toMatchObject({ isTokenExpired: true });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
