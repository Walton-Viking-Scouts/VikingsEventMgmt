import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import schemesFixture from '../../__fixtures__/getSchemes.json';
import statusFixture from '../../__fixtures__/paymentStatus.json';

vi.mock('../../../../shared/services/api/api/index.js', () => ({
  getPaymentSchemes: vi.fn(),
  getPaymentStatus: vi.fn(),
}));

vi.mock('../../../../shared/services/storage/database.js', () => ({
  default: {
    getSections: vi.fn(),
    getTerms: vi.fn(),
    getMembers: vi.fn(),
  },
}));

vi.mock('../../../../shared/services/utils/logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  LOG_CATEGORIES: { ERROR: 'error' },
}));

import { getPaymentSchemes, getPaymentStatus } from '../../../../shared/services/api/api/index.js';
import databaseService from '../../../../shared/services/storage/database.js';
import { getSubsSections, loadSectionSubs } from '../subsService.js';

const SECTIONS = [
  { sectionid: 49097, sectionname: 'Thursday Beavers', permissions: { finance: 20 } },
  { sectionid: 49098, sectionname: 'Cubs', permissions: { finance: 10 } },
  { sectionid: 49099, sectionname: 'Scouts', permissions: { finance: 0 } },
  { sectionid: 49100, sectionname: 'Explorers' },
];

const TERMS = [
  { termid: '965352', name: 'Summer', startdate: '2026-04-01', enddate: '2026-07-20' },
  { termid: '965353', name: 'Autumn', startdate: '2026-09-01', enddate: '2026-12-20' },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-20T09:00:00'));
  databaseService.getSections.mockResolvedValue(SECTIONS);
  databaseService.getTerms.mockResolvedValue(TERMS);
  databaseService.getMembers.mockResolvedValue([]);
  getPaymentSchemes.mockResolvedValue(schemesFixture);
  getPaymentStatus.mockResolvedValue(statusFixture);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getSubsSections', () => {
  it('returns every cached section in store order with a canView flag', async () => {
    await expect(getSubsSections()).resolves.toEqual([
      { sectionId: '49097', sectionName: 'Thursday Beavers', financePermission: 20, canView: true },
      { sectionId: '49098', sectionName: 'Cubs', financePermission: 10, canView: true },
      { sectionId: '49099', sectionName: 'Scouts', financePermission: 0, canView: false },
      { sectionId: '49100', sectionName: 'Explorers', financePermission: 0, canView: false },
    ]);
  });

  it('returns [] when nothing is cached', async () => {
    databaseService.getSections.mockResolvedValue(null);
    await expect(getSubsSections()).resolves.toEqual([]);
  });
});

describe('loadSectionSubs', () => {
  it('loads schemes then one status call per subs scheme for the current term', async () => {
    const result = await loadSectionSubs('49097', { token: 'tok' });

    expect(getPaymentSchemes).toHaveBeenCalledWith('49097', 'tok', { forceRefresh: false });
    expect(getPaymentStatus).toHaveBeenCalledTimes(2);
    expect(getPaymentStatus).toHaveBeenNthCalledWith(1, '49097', '60603', '965353', 'tok', { forceRefresh: false });
    expect(getPaymentStatus).toHaveBeenNthCalledWith(2, '49097', '60604', '965353', 'tok', { forceRefresh: false });
    expect(result.sectionName).toBe('Thursday Beavers');
    expect(result.terms.current.termId).toBe('965353');
    expect(result.schemes).toHaveLength(2);
    expect(result.otherSchemes.map((s) => s.name)).toEqual(['Camps and Activities']);
    expect(result.fromCache).toBe(false);
  });

  it('passes forceRefresh through to every call', async () => {
    await loadSectionSubs('49097', { token: 'tok', forceRefresh: true });
    expect(getPaymentSchemes).toHaveBeenCalledWith('49097', 'tok', { forceRefresh: true });
    expect(getPaymentStatus).toHaveBeenCalledWith('49097', '60603', '965353', 'tok', { forceRefresh: true });
  });

  it('reports fromCache and the newest cached timestamp when every response is cached', async () => {
    getPaymentSchemes.mockResolvedValue({ ...schemesFixture, _cacheTimestamp: 100 });
    getPaymentStatus.mockResolvedValue({ ...statusFixture, _cacheTimestamp: 250 });
    const result = await loadSectionSubs('49097', { token: 'tok' });
    expect(result.fromCache).toBe(true);
    expect(result.loadedAt).toBe(250);
  });

  it('stops on the first status failure without calling the next scheme', async () => {
    getPaymentStatus.mockRejectedValueOnce(new Error('OSM exploded'));
    await expect(loadSectionSubs('49097', { token: 'tok' }))
      .rejects.toThrow('Could not load payment status for Leaders Subs in Thursday Beavers');
    expect(getPaymentStatus).toHaveBeenCalledTimes(1);
  });

  it('flags needsAuth for an expired token', async () => {
    const authError = Object.assign(new Error('expired'), { isTokenExpired: true, status: 401 });
    getPaymentSchemes.mockRejectedValue(authError);
    await expect(loadSectionSubs('49097', { token: 'tok' }))
      .rejects.toMatchObject({ needsAuth: true, status: 401 });
    expect(getPaymentStatus).not.toHaveBeenCalled();
  });

  it('flags needsAuth false for other failures', async () => {
    getPaymentSchemes.mockRejectedValue(new Error('boom'));
    await expect(loadSectionSubs('49097', { token: 'tok' }))
      .rejects.toMatchObject({ needsAuth: false });
  });

  it('dedupes concurrent loads of the same section', async () => {
    const [a, b] = await Promise.all([
      loadSectionSubs('49097', { token: 'tok' }),
      loadSectionSubs('49097', { token: 'tok' }),
    ]);
    expect(getPaymentSchemes).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);

    await loadSectionSubs('49097', { token: 'tok' });
    expect(getPaymentSchemes).toHaveBeenCalledTimes(2);
  });

  it('refuses to load a section without finance access', async () => {
    await expect(loadSectionSubs('49099', { token: 'tok' }))
      .rejects.toThrow('No finance access for Scouts');
    expect(getPaymentSchemes).not.toHaveBeenCalled();
  });

  it('refuses to load a section that is not cached', async () => {
    await expect(loadSectionSubs('99999', { token: 'tok' }))
      .rejects.toThrow('Unknown section 99999');
    expect(getPaymentSchemes).not.toHaveBeenCalled();
  });

  it('reports demo mode rather than an empty result', async () => {
    getPaymentSchemes.mockResolvedValue(null);
    await expect(loadSectionSubs('49097', { token: 'tok' }))
      .rejects.toThrow('Subs are not available in demo mode');
    expect(getPaymentStatus).not.toHaveBeenCalled();
  });

  it('refuses to load without a cached current term', async () => {
    databaseService.getTerms.mockResolvedValue([]);
    await expect(loadSectionSubs('49097', { token: 'tok' }))
      .rejects.toThrow('No current term is cached');
    expect(getPaymentSchemes).not.toHaveBeenCalled();
  });
});
