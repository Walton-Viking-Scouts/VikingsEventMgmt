import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('../../../../shared/services/auth/tokenService.js', () => ({
  getToken: vi.fn(() => 'test-token'),
}));

vi.mock('../../../../shared/services/auth/tokenScopes.js', () => ({
  hasFinanceScope: vi.fn(() => true),
  decodeTokenScopes: vi.fn(() => []),
}));

vi.mock('../../services/subsService.js', () => ({
  getSubsSections: vi.fn(),
  loadSectionSubs: vi.fn(),
}));

import { hasFinanceScope } from '../../../../shared/services/auth/tokenScopes.js';
import { getSubsSections, loadSectionSubs } from '../../services/subsService.js';
import { useSubsSummary } from '../useSubsSummary.js';
import { makeSummary, SECTIONS, MIXED_SECTIONS } from '../../__tests__/fixtures.js';

/** Manually-resolvable promise for ordering-sensitive tests. */
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  hasFinanceScope.mockReturnValue(true);
  getSubsSections.mockResolvedValue(SECTIONS);
  loadSectionSubs.mockResolvedValue(makeSummary());
});

describe('useSubsSummary', () => {
  it('loads nothing and flags the missing finance scope', async () => {
    hasFinanceScope.mockReturnValue(false);

    const { result } = renderHook(() => useSubsSummary());

    await waitFor(() => expect(result.current.needsFinanceScope).toBe(true));
    expect(getSubsSections).not.toHaveBeenCalled();
    expect(loadSectionSubs).not.toHaveBeenCalled();
  });

  it('loads sections one at a time, never in parallel', async () => {
    const first = deferred();
    loadSectionSubs.mockImplementation((sectionId) =>
      sectionId === '49097' ? first.promise : Promise.resolve(makeSummary()),
    );

    const { result } = renderHook(() => useSubsSummary());

    await waitFor(() => expect(loadSectionSubs).toHaveBeenCalledTimes(1));
    expect(loadSectionSubs).toHaveBeenCalledWith('49097', { token: 'test-token', forceRefresh: false });
    expect(result.current.loadingSectionId).toBe('49097');

    await act(async () => {
      first.resolve(makeSummary());
      await first.promise;
    });

    await waitFor(() => expect(loadSectionSubs).toHaveBeenCalledTimes(2));
    expect(loadSectionSubs).toHaveBeenNthCalledWith(2, '49098', { token: 'test-token', forceRefresh: false });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(Object.keys(result.current.summaries)).toEqual(['49097', '49098']);
  });

  it('never requests a section without finance access', async () => {
    getSubsSections.mockResolvedValue(MIXED_SECTIONS);

    const { result } = renderHook(() => useSubsSummary());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sections).toHaveLength(3);
    expect(loadSectionSubs.mock.calls.map((call) => call[0])).toEqual(['49097', '49098']);
  });

  it('stops the whole load on the first error', async () => {
    loadSectionSubs.mockRejectedValueOnce(new Error('OSM said no'));

    const { result } = renderHook(() => useSubsSummary());

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.error.message).toBe('OSM said no');
    expect(loadSectionSubs).toHaveBeenCalledTimes(1);
    expect(result.current.needsAuth).toBe(false);
  });

  it('exposes needsAuth from an auth failure', async () => {
    const err = new Error('Token expired');
    err.needsAuth = true;
    loadSectionSubs.mockRejectedValueOnce(err);

    const { result } = renderHook(() => useSubsSummary());

    await waitFor(() => expect(result.current.needsAuth).toBe(true));
  });

  it('refresh re-runs the load with forceRefresh', async () => {
    const { result } = renderHook(() => useSubsSummary());

    await waitFor(() => expect(result.current.loading).toBe(false));
    loadSectionSubs.mockClear();

    await act(async () => {
      await result.current.refresh();
    });

    expect(loadSectionSubs).toHaveBeenCalledWith('49097', { token: 'test-token', forceRefresh: true });
  });
});
