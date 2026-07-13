import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('../../../../shared/services/utils/logger.js', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  LOG_CATEGORIES: { ERROR: 'ERROR' },
}));

vi.mock('../../../../shared/services/auth/tokenService.js', () => ({
  getToken: vi.fn(() => 'test-token'),
}));

vi.mock('../../services/rotaService.js', () => ({
  loadRota: vi.fn(),
}));

vi.mock('../../../../shared/services/data/dataLoadingService.js', () => ({
  default: { getLoadingStatus: vi.fn(() => ({ isLoadingAll: false })) },
}));

import { loadRota } from '../../services/rotaService.js';
import dataLoadingService from '../../../../shared/services/data/dataLoadingService.js';
import {
  markReferenceDataReady,
  resetReferenceDataReady,
} from '../../../../shared/services/data/referenceDataReady.js';
import { useWaterRota } from '../useWaterRota.js';

const ROTA = { year: 2026, sessions: [], members: [] };

beforeEach(() => {
  vi.clearAllMocks();
  resetReferenceDataReady();
  dataLoadingService.getLoadingStatus.mockReturnValue({ isLoadingAll: false });
});

describe('useWaterRota', () => {
  it('loads the rota on mount from a warm cache', async () => {
    loadRota.mockResolvedValue(ROTA);

    const { result } = renderHook(() => useWaterRota(2026));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rota).toBe(ROTA);
    expect(loadRota).toHaveBeenCalledWith(2026, 'test-token', { priority: 5 });
  });

  it('shows an empty board (not loading) when reference is ready but no rota exists', async () => {
    markReferenceDataReady();
    loadRota.mockResolvedValue(null);

    const { result } = renderHook(() => useWaterRota(2026));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rota).toBeNull();
  });

  it('shows an empty board when no rota exists and no load is in progress (no stuck spinner)', async () => {
    // Warm-cache/offline: reference never marked ready this session and the
    // bootstrap is not running, so a null rota is a genuine "no rota".
    loadRota.mockResolvedValue(null);
    dataLoadingService.getLoadingStatus.mockReturnValue({ isLoadingAll: false });

    const { result } = renderHook(() => useWaterRota(2026));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rota).toBeNull();
  });

  it('stays in loading on a cold cache, then fills in when reference data becomes ready', async () => {
    // Cold cache with the post-login bootstrap running: first load finds no
    // cached sections -> null while not ready.
    dataLoadingService.getLoadingStatus.mockReturnValue({ isLoadingAll: true });
    loadRota.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useWaterRota(2026));

    // Should remain loading rather than flashing an empty board.
    await waitFor(() => expect(loadRota).toHaveBeenCalledTimes(1));
    expect(result.current.loading).toBe(true);
    expect(result.current.rota).toBeNull();

    // Reference data lands: the signal re-runs the load, now returning a rota.
    loadRota.mockResolvedValueOnce(ROTA);
    await act(async () => {
      markReferenceDataReady();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rota).toBe(ROTA);
    expect(loadRota).toHaveBeenCalledTimes(2);
  });

  it('surfaces load errors', async () => {
    loadRota.mockRejectedValue(new Error('nope'));

    const { result } = renderHook(() => useWaterRota(2026));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.rota).toBeNull();
  });
});
