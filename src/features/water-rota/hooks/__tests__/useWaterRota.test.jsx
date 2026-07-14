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
  discoverRotaRecords: vi.fn(),
  loadRotaGroup: vi.fn(),
}));

vi.mock('../../../../shared/services/data/dataLoadingService.js', () => ({
  default: {
    getLoadingStatus: vi.fn(() => ({ isLoadingAll: false })),
    // Default to a never-settling load so the recovery path stays inert unless
    // a test opts in.
    whenAllDataSettled: vi.fn(() => new Promise(() => {})),
  },
}));

import { discoverRotaRecords, loadRotaGroup } from '../../services/rotaService.js';
import dataLoadingService from '../../../../shared/services/data/dataLoadingService.js';
import {
  markReferenceDataReady,
  resetReferenceDataReady,
} from '../../../../shared/services/data/referenceDataReady.js';
import { useWaterRota, uniqueSeasonBuckets, defaultSeasonBucket } from '../useWaterRota.js';

const GROUP = { seasonBucket: 'Summer 2026', sessions: [], members: [] };

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

describe('uniqueSeasonBuckets', () => {
  it('dedupes descriptors to their distinct season buckets', () => {
    expect(uniqueSeasonBuckets([
      { seasonBucket: 'Summer 2026' },
      { seasonBucket: 'Spring 2026' },
      { seasonBucket: 'Summer 2026' },
    ])).toEqual(['Summer 2026', 'Spring 2026']);
  });

  it('is empty for no descriptors', () => {
    expect(uniqueSeasonBuckets([])).toEqual([]);
    expect(uniqueSeasonBuckets(undefined)).toEqual([]);
  });
});

describe('defaultSeasonBucket', () => {
  it('returns null for an empty bucket list', () => {
    expect(defaultSeasonBucket([])).toBeNull();
  });

  it('picks the bucket whose season window contains today', () => {
    expect(defaultSeasonBucket(['Spring 2026', 'Summer 2026', 'Autumn 2026'], '2026-06-15')).toBe('Summer 2026');
  });

  it('falls back to the latest year when today is not covered', () => {
    expect(defaultSeasonBucket(['Autumn 2025', 'Spring 2026'], '2026-06-15')).toBe('Spring 2026');
  });

  it('falls back to the latest season order within the latest year when today is not covered', () => {
    expect(defaultSeasonBucket(['Autumn 2026', 'Spring 2026'], '2025-01-01')).toBe('Autumn 2026');
  });
});

describe('useWaterRota', () => {
  it('discovers buckets and loads the resolved default bucket, at deep-link priority', async () => {
    const descriptors = [{ seasonBucket: 'Summer 2026' }, { seasonBucket: 'Spring 2026' }];
    discoverRotaRecords.mockResolvedValue(descriptors);
    loadRotaGroup.mockResolvedValue(GROUP);

    const { result } = renderHook(() => useWaterRota());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(discoverRotaRecords).toHaveBeenCalledWith('test-token', 5);
    const expectedBucket = defaultSeasonBucket(uniqueSeasonBuckets(descriptors));
    expect(loadRotaGroup).toHaveBeenCalledWith(expectedBucket, 'test-token', { priority: 5 });
    expect(result.current.rota).toBe(GROUP);
    expect(result.current.seasonBucket).toBe(expectedBucket);
    expect(result.current.buckets).toEqual(['Summer 2026', 'Spring 2026']);
  });

  it('loads an explicitly requested season bucket instead of the default', async () => {
    discoverRotaRecords.mockResolvedValue([{ seasonBucket: 'Summer 2025' }]);
    loadRotaGroup.mockResolvedValue(GROUP);

    const { result } = renderHook(() => useWaterRota('Summer 2025'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(loadRotaGroup).toHaveBeenCalledWith('Summer 2025', 'test-token', { priority: 5 });
    expect(result.current.seasonBucket).toBe('Summer 2025');
  });

  it('falls back to the resolved default bucket when the requested season bucket does not exist (stale/invalid ?season=)', async () => {
    discoverRotaRecords.mockResolvedValue([{ seasonBucket: 'Summer 2026' }]);
    loadRotaGroup.mockResolvedValue(GROUP);

    const { result } = renderHook(() => useWaterRota('Nonexistent Bucket 1999'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(loadRotaGroup).toHaveBeenCalledWith('Summer 2026', 'test-token', { priority: 5 });
    expect(result.current.seasonBucket).toBe('Summer 2026');
  });

  it('shows an empty board (not loading) when reference is ready but no rota exists anywhere', async () => {
    markReferenceDataReady();
    discoverRotaRecords.mockResolvedValue([]);

    const { result } = renderHook(() => useWaterRota());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rota).toBeNull();
    expect(result.current.buckets).toEqual([]);
    expect(loadRotaGroup).not.toHaveBeenCalled();
  });

  it('shows an empty board when no rota exists and no load is in progress (no stuck spinner)', async () => {
    discoverRotaRecords.mockResolvedValue([]);
    dataLoadingService.getLoadingStatus.mockReturnValue({ isLoadingAll: false });

    const { result } = renderHook(() => useWaterRota());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rota).toBeNull();
  });

  it('stays in loading on a cold cache (no buckets discovered yet), then fills in when reference data becomes ready', async () => {
    dataLoadingService.getLoadingStatus.mockReturnValue({ isLoadingAll: true });
    discoverRotaRecords.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useWaterRota());

    await waitFor(() => expect(discoverRotaRecords).toHaveBeenCalledTimes(1));
    expect(result.current.loading).toBe(true);
    expect(result.current.rota).toBeNull();

    discoverRotaRecords.mockResolvedValueOnce([{ seasonBucket: 'Summer 2026' }]);
    loadRotaGroup.mockResolvedValueOnce(GROUP);
    await act(async () => {
      markReferenceDataReady();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rota).toBe(GROUP);
    expect(discoverRotaRecords).toHaveBeenCalledTimes(2);
  });

  it('recovers to an empty board when the bootstrap settles without reference ever becoming ready (reference load failed)', async () => {
    const settled = deferred();
    dataLoadingService.getLoadingStatus.mockReturnValue({ isLoadingAll: true });
    dataLoadingService.whenAllDataSettled.mockReturnValue(settled.promise);
    discoverRotaRecords.mockResolvedValue([]);

    const { result } = renderHook(() => useWaterRota());

    await waitFor(() => expect(discoverRotaRecords).toHaveBeenCalledTimes(1));
    expect(result.current.loading).toBe(true);

    dataLoadingService.getLoadingStatus.mockReturnValue({ isLoadingAll: false });
    await act(async () => {
      settled.resolve();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rota).toBeNull();
  });

  it('does not let a slower stale load clobber a newer result (epoch guard)', async () => {
    discoverRotaRecords.mockResolvedValue([{ seasonBucket: 'Summer 2026' }]);
    const mountLoad = deferred();
    const signalLoad = deferred();
    loadRotaGroup
      .mockReturnValueOnce(mountLoad.promise)
      .mockReturnValueOnce(signalLoad.promise);

    const { result } = renderHook(() => useWaterRota());
    await waitFor(() => expect(loadRotaGroup).toHaveBeenCalledTimes(1));

    // Reference becomes ready -> a second (newer) load starts.
    await act(async () => {
      markReferenceDataReady();
    });
    await waitFor(() => expect(loadRotaGroup).toHaveBeenCalledTimes(2));

    // Newer load resolves first with the group...
    await act(async () => {
      signalLoad.resolve(GROUP);
    });
    await waitFor(() => expect(result.current.rota).toBe(GROUP));

    // ...then the stale mount load resolves null and must be ignored.
    await act(async () => {
      mountLoad.resolve(null);
    });
    expect(result.current.rota).toBe(GROUP);
    expect(result.current.loading).toBe(false);
  });

  it('stops re-running after unmount', async () => {
    discoverRotaRecords.mockResolvedValue([{ seasonBucket: 'Summer 2026' }]);
    loadRotaGroup.mockResolvedValue(GROUP);

    const { result, unmount } = renderHook(() => useWaterRota());
    await waitFor(() => expect(result.current.loading).toBe(false));

    discoverRotaRecords.mockClear();
    unmount();
    await act(async () => {
      markReferenceDataReady();
    });

    expect(discoverRotaRecords).not.toHaveBeenCalled();
  });

  it('surfaces load errors', async () => {
    discoverRotaRecords.mockRejectedValue(new Error('nope'));

    const { result } = renderHook(() => useWaterRota());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.rota).toBeNull();
  });
});
