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
  default: {
    getLoadingStatus: vi.fn(() => ({ isLoadingAll: false })),
    // Default to a never-settling load so the recovery path stays inert unless
    // a test opts in.
    whenAllDataSettled: vi.fn(() => new Promise(() => {})),
  },
}));

import { loadRota } from '../../services/rotaService.js';
import dataLoadingService from '../../../../shared/services/data/dataLoadingService.js';
import {
  markReferenceDataReady,
  resetReferenceDataReady,
} from '../../../../shared/services/data/referenceDataReady.js';
import { useWaterRota } from '../useWaterRota.js';

const ROTA = { year: 2026, sessions: [], members: [] };

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
  resetReferenceDataReady();
  dataLoadingService.getLoadingStatus.mockReturnValue({ isLoadingAll: false });
  dataLoadingService.whenAllDataSettled.mockReturnValue(new Promise(() => {}));
});

describe('useWaterRota', () => {
  it('loads the rota on mount from a warm cache, at deep-link priority', async () => {
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
    loadRota.mockResolvedValue(null);
    dataLoadingService.getLoadingStatus.mockReturnValue({ isLoadingAll: false });

    const { result } = renderHook(() => useWaterRota(2026));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rota).toBeNull();
  });

  it('stays in loading on a cold cache, then fills in when reference data becomes ready', async () => {
    dataLoadingService.getLoadingStatus.mockReturnValue({ isLoadingAll: true });
    loadRota.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useWaterRota(2026));

    await waitFor(() => expect(loadRota).toHaveBeenCalledTimes(1));
    expect(result.current.loading).toBe(true);
    expect(result.current.rota).toBeNull();

    loadRota.mockResolvedValueOnce(ROTA);
    await act(async () => {
      markReferenceDataReady();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rota).toBe(ROTA);
    expect(loadRota).toHaveBeenCalledTimes(2);
  });

  it('recovers to an empty board when the bootstrap settles without reference ever becoming ready (reference load failed)', async () => {
    // Cold cache with a bootstrap running; reference load will fail so the
    // ready signal never fires. The board must not spin forever.
    const settled = deferred();
    dataLoadingService.getLoadingStatus.mockReturnValue({ isLoadingAll: true });
    dataLoadingService.whenAllDataSettled.mockReturnValue(settled.promise);
    loadRota.mockResolvedValue(null);

    const { result } = renderHook(() => useWaterRota(2026));

    await waitFor(() => expect(loadRota).toHaveBeenCalledTimes(1));
    expect(result.current.loading).toBe(true);

    // Bootstrap finishes without success: isLoadingAll flips false, settle resolves.
    dataLoadingService.getLoadingStatus.mockReturnValue({ isLoadingAll: false });
    await act(async () => {
      settled.resolve();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rota).toBeNull();
  });

  it('does not let a slower stale load clobber a newer result (epoch guard)', async () => {
    // Mount load is slow and resolves null; the ready-signal load resolves ROTA
    // first. The later null must not overwrite the loaded board.
    const mountLoad = deferred();
    const signalLoad = deferred();
    loadRota
      .mockReturnValueOnce(mountLoad.promise)
      .mockReturnValueOnce(signalLoad.promise);

    const { result } = renderHook(() => useWaterRota(2026));
    await waitFor(() => expect(loadRota).toHaveBeenCalledTimes(1));

    // Reference becomes ready -> a second (newer) load starts.
    await act(async () => {
      markReferenceDataReady();
    });
    await waitFor(() => expect(loadRota).toHaveBeenCalledTimes(2));

    // Newer load resolves first with the rota...
    await act(async () => {
      signalLoad.resolve(ROTA);
    });
    await waitFor(() => expect(result.current.rota).toBe(ROTA));

    // ...then the stale mount load resolves null and must be ignored.
    await act(async () => {
      mountLoad.resolve(null);
    });
    expect(result.current.rota).toBe(ROTA);
    expect(result.current.loading).toBe(false);
  });

  it('stops re-running after unmount', async () => {
    loadRota.mockResolvedValue(ROTA);

    const { result, unmount } = renderHook(() => useWaterRota(2026));
    await waitFor(() => expect(result.current.loading).toBe(false));

    loadRota.mockClear();
    unmount();
    await act(async () => {
      markReferenceDataReady();
    });

    expect(loadRota).not.toHaveBeenCalled();
  });

  it('surfaces load errors', async () => {
    loadRota.mockRejectedValue(new Error('nope'));

    const { result } = renderHook(() => useWaterRota(2026));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.rota).toBeNull();
  });
});
