import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import schemesFixture from '../../__fixtures__/getSchemes.json';
import statusFixture from '../../__fixtures__/paymentStatus.json';

vi.mock('../../../../shared/services/api/api/index.js', () => ({
  getPaymentSchemes: vi.fn(),
  getPaymentStatus: vi.fn(),
  getTerms: vi.fn(),
}));

vi.mock('../../../../shared/services/storage/currentActiveTermsService.js', () => ({
  CurrentActiveTermsService: { getCurrentActiveTerm: vi.fn() },
}));

vi.mock('../../../../shared/services/storage/database.js', () => ({
  default: {
    getSections: vi.fn(),
    getMembers: vi.fn(),
  },
}));

vi.mock('../../../../config/demoMode.js', () => ({
  isDemoMode: vi.fn(() => false),
}));

vi.mock('../../../../shared/services/auth/authHandler.js', () => ({
  authHandler: { hasAuthFailed: vi.fn(() => false) },
}));

vi.mock('../../../../shared/services/utils/logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  LOG_CATEGORIES: { ERROR: 'error' },
}));

import { getPaymentSchemes, getPaymentStatus, getTerms } from '../../../../shared/services/api/api/index.js';
import databaseService from '../../../../shared/services/storage/database.js';
import { CurrentActiveTermsService } from '../../../../shared/services/storage/currentActiveTermsService.js';
import { authHandler } from '../../../../shared/services/auth/authHandler.js';
import { isDemoMode } from '../../../../config/demoMode.js';
import { getSubsSections, loadSectionSubs, resetTermsCache } from '../subsService.js';

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
  resetTermsCache();
  getTerms.mockResolvedValue({ 49097: TERMS, 49098: TERMS });
  CurrentActiveTermsService.getCurrentActiveTerm.mockResolvedValue(null);
  isDemoMode.mockReturnValue(false);
  authHandler.hasAuthFailed.mockReturnValue(false);
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
      { sectionId: '49097', sectionName: 'Thursday Beavers', financePermission: 20, canView: true, permissionsSynced: true },
      { sectionId: '49098', sectionName: 'Cubs', financePermission: 10, canView: true, permissionsSynced: true },
      { sectionId: '49099', sectionName: 'Scouts', financePermission: 0, canView: false, permissionsSynced: true },
      { sectionId: '49100', sectionName: 'Explorers', financePermission: 0, canView: false, permissionsSynced: false },
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

  it('marks a network failure as not localOnly', async () => {
    getPaymentSchemes.mockRejectedValue(new Error('boom'));
    await expect(loadSectionSubs('49097', { token: 'tok' }))
      .rejects.toMatchObject({ code: 'LOAD_FAILED', localOnly: false });
  });

  it('flags needsAuth for an expired token', async () => {
    const authError = Object.assign(new Error('expired'), { isTokenExpired: true, status: 401 });
    getPaymentSchemes.mockRejectedValue(authError);
    await expect(loadSectionSubs('49097', { token: 'tok' }))
      .rejects.toMatchObject({ needsAuth: true, status: 401, code: 'NEEDS_AUTH', localOnly: false });
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
      .rejects.toMatchObject({ code: 'NO_ACCESS', localOnly: true, message: 'No finance access for Scouts' });
    expect(getPaymentSchemes).not.toHaveBeenCalled();
  });

  it('refuses to load a section that is not cached', async () => {
    await expect(loadSectionSubs('99999', { token: 'tok' }))
      .rejects.toMatchObject({ code: 'UNKNOWN_SECTION', localOnly: true });
    expect(getPaymentSchemes).not.toHaveBeenCalled();
  });

  it('finds terms keyed by section id string and fetches the payload once per run', async () => {
    const first = await loadSectionSubs('49097', { token: 'tok' });
    const second = await loadSectionSubs('49098', { token: 'tok' });
    expect(first.terms.current.termId).toBe('965353');
    expect(second.terms.current.termId).toBe('965353');
    expect(getTerms).toHaveBeenCalledTimes(1);
  });

  it('reports NO_CURRENT_TERM when the payload has no terms for the section', async () => {
    getTerms.mockResolvedValue({ 49098: TERMS });
    await expect(loadSectionSubs('49097', { token: 'tok' })).rejects.toMatchObject({
      code: 'NO_CURRENT_TERM',
      localOnly: true,
      message: 'No terms cached for Thursday Beavers — refresh the app data first',
    });
    expect(getPaymentSchemes).not.toHaveBeenCalled();
  });

  it('uses the current-active-term record even when today falls outside it', async () => {
    CurrentActiveTermsService.getCurrentActiveTerm.mockResolvedValue({
      currentTermId: '965352', termName: 'Summer', startDate: '2026-04-01', endDate: '2026-07-20',
    });
    const result = await loadSectionSubs('49097', { token: 'tok' });
    expect(result.terms.current.termId).toBe('965352');
    expect(result.terms.next.termId).toBe('965353');
    expect(getPaymentStatus).toHaveBeenCalledWith('49097', '60603', '965352', 'tok', { forceRefresh: false });
  });

  it('falls back to the date-based derivation when there is no record', async () => {
    const result = await loadSectionSubs('49097', { token: 'tok' });
    expect(result.terms.current.termId).toBe('965353');
    expect(result.terms.previous.termId).toBe('965352');
  });

  it('reports demo mode before making any call', async () => {
    isDemoMode.mockReturnValue(true);
    await expect(loadSectionSubs('49097', { token: 'tok' }))
      .rejects.toMatchObject({ code: 'DEMO_MODE', localOnly: true });
    expect(getTerms).not.toHaveBeenCalled();
    expect(getPaymentSchemes).not.toHaveBeenCalled();
  });

  it('stops the whole run when the terms fetch is refused, calling getTerms once', async () => {
    getTerms.mockRejectedValue(Object.assign(new Error('expired'), { isTokenExpired: true, status: 401 }));
    for (const id of ['49097', '49098', '49097']) {
      await expect(loadSectionSubs(id, { token: 'tok' }))
        .rejects.toMatchObject({ code: 'NEEDS_AUTH', needsAuth: true, localOnly: false });
    }
    expect(getTerms).toHaveBeenCalledTimes(1);
    expect(getPaymentSchemes).not.toHaveBeenCalled();
  });

  it('classifies a plain terms failure as LOAD_FAILED', async () => {
    getTerms.mockRejectedValue(new Error('network down'));
    await expect(loadSectionSubs('49097', { token: 'tok' })).rejects.toMatchObject({
      code: 'LOAD_FAILED', localOnly: false, needsAuth: false,
    });
  });

  it('classifies the auth circuit breaker as NEEDS_AUTH', async () => {
    authHandler.hasAuthFailed.mockReturnValue(true);
    getPaymentSchemes.mockRejectedValue(new Error('getPaymentSchemes: authentication failed this session'));
    await expect(loadSectionSubs('49097', { token: 'tok' }))
      .rejects.toMatchObject({ code: 'NEEDS_AUTH', needsAuth: true, status: 401 });
  });

  it('fails loudly when the current-term record cannot be read', async () => {
    CurrentActiveTermsService.getCurrentActiveTerm.mockRejectedValue(new Error('db closed'));
    await expect(loadSectionSubs('49097', { token: 'tok' })).rejects.toMatchObject({
      code: 'NO_CURRENT_TERM',
      localOnly: true,
      message: 'Could not read the current term for Thursday Beavers: db closed',
    });
    expect(getPaymentSchemes).not.toHaveBeenCalled();
  });

  it('pins the current term to the record even when another term overlaps today', async () => {
    getTerms.mockResolvedValue({ 49097: [
      { termid: 'overlap', name: 'Long', startdate: '2026-08-01', enddate: '2026-11-30' },
      { termid: '965353', name: 'Autumn', startdate: '2026-09-01', enddate: '2026-12-20' },
    ] });
    CurrentActiveTermsService.getCurrentActiveTerm.mockResolvedValue({
      currentTermId: '965353', termName: 'Autumn', startDate: '2026-09-01', endDate: '2026-12-20',
    });
    const result = await loadSectionSubs('49097', { token: 'tok' });
    expect(result.terms.current.termId).toBe('965353');
  });

  it('reports the cached member count', async () => {
    databaseService.getMembers.mockResolvedValue([
      { scoutid: '1', sections: [{ sectionid: 49097, person_type: 'Leaders' }] },
    ]);
    const result = await loadSectionSubs('49097', { token: 'tok' });
    expect(result.cachedMemberCount).toBe(1);
  });

  it('reports a dormant section as NO_CURRENT_TERM before any payment call', async () => {
    getTerms.mockResolvedValue({ 49097: [
      { termid: 'old', name: 'Autumn 2013', startdate: '2013-09-01', enddate: '2013-12-20' },
    ] });
    await expect(loadSectionSubs('49097', { token: 'tok' })).rejects.toMatchObject({
      code: 'NO_CURRENT_TERM',
      localOnly: true,
      message: 'No current term for Thursday Beavers (last term ended 2013-12-20)',
    });
    expect(getPaymentSchemes).not.toHaveBeenCalled();
  });

  it('reports a section with no cached terms at all', async () => {
    getTerms.mockResolvedValue({});
    await expect(loadSectionSubs('49097', { token: 'tok' })).rejects.toMatchObject({
      code: 'NO_CURRENT_TERM',
      localOnly: true,
      message: 'No terms cached for Thursday Beavers — refresh the app data first',
    });
    expect(getPaymentSchemes).not.toHaveBeenCalled();
  });
});
