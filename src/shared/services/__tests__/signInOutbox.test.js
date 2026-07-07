import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mem, updateFlexiRecordMock } = vi.hoisted(() => ({
  mem: new Map(),
  updateFlexiRecordMock: vi.fn(),
}));

vi.mock('../api/api/flexiRecords.js', () => ({
  updateFlexiRecord: updateFlexiRecordMock,
}));

vi.mock('../storage/database.js', () => ({
  default: {
    getFlexiData: vi.fn(async () => ({ items: [] })),
    saveFlexiData: vi.fn(async () => {}),
  },
}));

vi.mock('../storage/indexedDBService.js', () => ({
  IndexedDBService: {
    STORES: { CACHE_DATA: 'cache_data' },
    get: vi.fn(async (store, key) => mem.get(key)),
    set: vi.fn(async (store, key, value) => {
      mem.set(key, value);
      return true;
    }),
  },
}));

vi.mock('../../utils/networkUtils.js', () => ({
  addNetworkListener: vi.fn(),
}));

vi.mock('../auth/tokenService.js', () => ({
  getToken: vi.fn(() => 'test-token'),
}));

import { enqueue, drain, pendingCount } from '../signInOutbox.js';
import { IndexedDBService } from '../storage/indexedDBService.js';

function makeOp(id, fieldCount = 1) {
  return {
    id,
    memberLabel: `Member ${id}`,
    action: 'signin',
    scoutid: id,
    sectionid: 1,
    extraid: '100',
    termId: 't1',
    sectionType: 'beavers',
    updates: Array.from({ length: fieldCount }, (_, i) => ({ fieldId: `f_${i + 1}`, value: 'v' })),
    createdAt: 'now',
  };
}

beforeEach(() => {
  mem.clear();
  updateFlexiRecordMock.mockReset();
  IndexedDBService.get.mockClear();
  IndexedDBService.set.mockClear();
});

describe('signInOutbox drain', () => {
  it('drains ops FIFO and empties the store', async () => {
    updateFlexiRecordMock.mockResolvedValue({ ok: true });
    await enqueue(makeOp('a', 2));
    await enqueue(makeOp('b', 1));

    const result = await drain('tok');

    expect(result.completed).toBe(2);
    expect(result.remaining).toBe(0);
    expect(result.errors).toEqual([]);
    expect(updateFlexiRecordMock).toHaveBeenCalledTimes(3);
    expect(await pendingCount()).toBe(0);
  });

  it('does not lose an op enqueued while a drain is in flight', async () => {
    let releaseFirst;
    updateFlexiRecordMock.mockImplementationOnce(
      () => new Promise((resolve) => {
        releaseFirst = () => resolve({ ok: true });
      }),
    ).mockResolvedValue({ ok: true });

    await enqueue(makeOp('a', 1));
    const drainPromise = drain('tok');

    // Let the drain start awaiting op A's network call, then enqueue B
    await new Promise((r) => setTimeout(r, 0));
    await enqueue(makeOp('b', 1));
    releaseFirst();

    const result = await drainPromise;

    // Both ops synced (the drain re-reads the store each iteration);
    // with snapshot-based persistence op B was silently clobbered.
    expect(result.completed).toBe(2);
    expect(await pendingCount()).toBe(0);
    expect(updateFlexiRecordMock).toHaveBeenCalledTimes(2);
  });

  it('persists per-field progress and resumes mid-op after a transient failure', async () => {
    updateFlexiRecordMock
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error('network down'));

    await enqueue(makeOp('a', 2));
    const first = await drain('tok');

    expect(first.completed).toBe(0);
    expect(first.remaining).toBe(1);
    expect(first.errors[0]).toContain('network down');

    const stored = mem.get('viking_signin_outbox').ops;
    expect(stored).toHaveLength(1);
    expect(stored[0].updates).toHaveLength(1);
    expect(stored[0].updates[0].fieldId).toBe('f_2');

    updateFlexiRecordMock.mockReset();
    updateFlexiRecordMock.mockResolvedValue({ ok: true });
    const second = await drain('tok');

    expect(second.completed).toBe(1);
    // Resume at field 2 only - field 1 must not be written twice
    expect(updateFlexiRecordMock).toHaveBeenCalledTimes(1);
    expect(updateFlexiRecordMock.mock.calls[0][3]).toBe('f_2');
  });

  it('drops permanently-failing ops (4xx) instead of blocking the queue', async () => {
    const permanent = new Error('Invalid columnid format');
    permanent.status = 400;
    updateFlexiRecordMock
      .mockRejectedValueOnce(permanent)
      .mockResolvedValue({ ok: true });

    await enqueue(makeOp('bad', 1));
    await enqueue(makeOp('good', 1));

    const result = await drain('tok');

    expect(result.dropped).toBe(1);
    expect(result.completed).toBe(1);
    expect(result.remaining).toBe(0);
    expect(result.errors[0]).toContain('not retried');
  });

  it('halts (keeps ops queued) on 429 back-pressure', async () => {
    const rateLimited = new Error('Rate limit exceeded');
    rateLimited.status = 429;
    updateFlexiRecordMock.mockRejectedValue(rateLimited);

    await enqueue(makeOp('a', 1));
    await enqueue(makeOp('b', 1));

    const result = await drain('tok');

    expect(result.completed).toBe(0);
    expect(result.dropped).toBe(0);
    expect(result.remaining).toBe(2);
  });

  it('reports and preserves ops when no token is available', async () => {
    await enqueue(makeOp('a', 1));

    const result = await drain(null);

    expect(result.remaining).toBe(1);
    expect(result.errors[0]).toContain('No authentication token');
    expect(updateFlexiRecordMock).not.toHaveBeenCalled();
  });

  it('treats a missing write result as a transient failure, not success', async () => {
    updateFlexiRecordMock.mockResolvedValue(null);

    await enqueue(makeOp('a', 1));
    const result = await drain('tok');

    expect(result.completed).toBe(0);
    expect(result.remaining).toBe(1);
  });
});

describe('signInOutbox enqueue', () => {
  it('propagates store failures instead of clobbering the outbox', async () => {
    await enqueue(makeOp('a', 1));
    IndexedDBService.get.mockRejectedValueOnce(new Error('idb unavailable'));

    await expect(enqueue(makeOp('b', 1))).rejects.toThrow('idb unavailable');

    // Op A survives untouched
    expect(mem.get('viking_signin_outbox').ops).toHaveLength(1);
  });
});
