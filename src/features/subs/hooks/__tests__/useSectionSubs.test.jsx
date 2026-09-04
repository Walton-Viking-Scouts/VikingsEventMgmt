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
import { loadSectionSubs } from '../../services/subsService.js';
import { useSectionSubs } from '../useSectionSubs.js';
import { makeSummary } from '../../__tests__/fixtures.js';

beforeEach(() => {
  vi.clearAllMocks();
  hasFinanceScope.mockReturnValue(true);
  loadSectionSubs.mockResolvedValue(makeSummary());
});

describe('useSectionSubs', () => {
  it('loads the section once on mount', async () => {
    const { result } = renderHook(() => useSectionSubs('49097'));

    await waitFor(() => expect(result.current.summary).toBeTruthy());
    expect(loadSectionSubs).toHaveBeenCalledTimes(1);
    expect(loadSectionSubs).toHaveBeenCalledWith('49097', { token: 'test-token', forceRefresh: false });
  });

  it('loads nothing without the finance scope', async () => {
    hasFinanceScope.mockReturnValue(false);

    const { result } = renderHook(() => useSectionSubs('49097'));

    await waitFor(() => expect(result.current.needsFinanceScope).toBe(true));
    expect(loadSectionSubs).not.toHaveBeenCalled();
  });

  it('exposes needsAuth on an auth failure and does not retry', async () => {
    const err = new Error('Token expired');
    err.needsAuth = true;
    loadSectionSubs.mockRejectedValue(err);

    const { result } = renderHook(() => useSectionSubs('49097'));

    await waitFor(() => expect(result.current.needsAuth).toBe(true));
    expect(loadSectionSubs).toHaveBeenCalledTimes(1);
  });

  it('refresh reloads with forceRefresh', async () => {
    const { result } = renderHook(() => useSectionSubs('49097'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.refresh();
    });

    expect(loadSectionSubs).toHaveBeenLastCalledWith('49097', { token: 'test-token', forceRefresh: true });
  });
});
