import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('../../../../shared/services/auth/tokenService.js', () => ({
  getToken: vi.fn(() => 'test-token'),
}));

vi.mock('../../../../shared/utils/notifications.js', () => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}));

vi.mock('../../services/rotaService.js', () => ({
  writeSignup: vi.fn(),
}));

import { writeSignup } from '../../services/rotaService.js';
import { notifyError, notifySuccess } from '../../../../shared/utils/notifications.js';
import { useRotaSignup } from '../useRotaSignup.js';
import { SIGNUP_STATUS } from '../../services/rotaEncoding.js';

const RECORD_A = { recordId: 'a', hostSection: { sectionid: '1' } };
const RECORD_B = { recordId: 'b', hostSection: { sectionid: '1' } };

// Two sessions sharing the same fieldId ("f_1" repeats across records — PRD
// §5.3) but with distinct, globally-unique keys and owning records.
const SESSION_A = { key: 'S_20260714_49097', fieldId: 'f_1', record: RECORD_A };
const SESSION_B = { key: 'S_20260714_49098', fieldId: 'f_1', record: RECORD_B };

const ROTA = { seasonBucket: 'Summer 2026' };
const IDENTITY = { scoutid: '10', name: 'Simon Clark' };

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
});

describe('useRotaSignup', () => {
  it('routes the write to the session\'s owning record, not the group', async () => {
    writeSignup.mockResolvedValue(undefined);
    const refresh = vi.fn(async () => undefined);
    const { result } = renderHook(() => useRotaSignup(ROTA, IDENTITY, refresh));

    await act(async () => {
      await result.current.setSignup(SESSION_A, SIGNUP_STATUS.IN);
    });

    expect(writeSignup).toHaveBeenCalledWith({
      rota: RECORD_A,
      fieldId: 'f_1',
      scoutid: '10',
      status: SIGNUP_STATUS.IN,
      token: 'test-token',
    });
    expect(notifySuccess).toHaveBeenCalledWith('You\'re in');
    expect(refresh).toHaveBeenCalled();
  });

  it('keys pending state on the session key, not the field id', async () => {
    const write = deferred();
    writeSignup.mockReturnValue(write.promise);
    const refresh = vi.fn(async () => undefined);
    const { result } = renderHook(() => useRotaSignup(ROTA, IDENTITY, refresh));

    let settle;
    act(() => {
      settle = result.current.setSignup(SESSION_A, SIGNUP_STATUS.IN);
    });

    await waitFor(() => expect(result.current.pendingKey).toBe(SESSION_A.key));
    // Same fieldId, different record/key — must NOT read as pending.
    expect(result.current.pendingKey).not.toBe(SESSION_B.key);

    await act(async () => {
      write.resolve(undefined);
      await settle;
    });

    expect(result.current.pendingKey).toBeNull();
  });

  it('two same-fieldId sessions in different records do not cross-trigger pending state', async () => {
    const write = deferred();
    writeSignup.mockReturnValue(write.promise);
    const refresh = vi.fn(async () => undefined);
    const { result } = renderHook(() => useRotaSignup(ROTA, IDENTITY, refresh));

    act(() => {
      result.current.setSignup(SESSION_A, SIGNUP_STATUS.IN);
    });

    await waitFor(() => expect(result.current.pendingKey).toBe(SESSION_A.key));
    const sessionAPending = result.current.pendingKey === SESSION_A.key;
    const sessionBPending = result.current.pendingKey === SESSION_B.key;
    expect(sessionAPending).toBe(true);
    expect(sessionBPending).toBe(false);

    await act(async () => {
      write.resolve(undefined);
    });
  });

  it('surfaces an offline-specific message for WRITE_UNAVAILABLE', async () => {
    const error = Object.assign(new Error('offline'), { code: 'WRITE_UNAVAILABLE' });
    writeSignup.mockRejectedValue(error);
    const refresh = vi.fn(async () => undefined);
    const { result } = renderHook(() => useRotaSignup(ROTA, IDENTITY, refresh));

    await act(async () => {
      await result.current.setSignup(SESSION_A, SIGNUP_STATUS.IN);
    });

    expect(notifyError).toHaveBeenCalledWith('You\'re offline — connect to change your signup.');
    expect(result.current.pendingKey).toBeNull();
  });

  it('does nothing without a loaded rota, identity, or session', async () => {
    const refresh = vi.fn(async () => undefined);
    const { result, rerender } = renderHook(
      ({ rota, identity }) => useRotaSignup(rota, identity, refresh),
      { initialProps: { rota: null, identity: IDENTITY } },
    );

    await act(async () => {
      await result.current.setSignup(SESSION_A, SIGNUP_STATUS.IN);
    });
    expect(writeSignup).not.toHaveBeenCalled();

    rerender({ rota: ROTA, identity: null });
    await act(async () => {
      await result.current.setSignup(SESSION_A, SIGNUP_STATUS.IN);
    });
    expect(writeSignup).not.toHaveBeenCalled();

    rerender({ rota: ROTA, identity: IDENTITY });
    await act(async () => {
      await result.current.setSignup(null, SIGNUP_STATUS.IN);
    });
    expect(writeSignup).not.toHaveBeenCalled();
  });
});
