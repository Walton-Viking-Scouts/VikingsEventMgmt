import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../../shared/services/utils/logger.js', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  LOG_CATEGORIES: { APP: 'APP' },
}));

vi.mock('../../../shared/services/auth/tokenService.js', () => ({
  getToken: vi.fn(() => 'tok'),
}));

vi.mock('../../../shared/services/api/api/terms.js', () => ({
  fetchMostRecentTermId: vi.fn(async () => 'T1'),
}));

vi.mock('../../movements/services/vikingSectionMoversValidation.js', () => ({
  validateVikingSectionMoversFlexiRecord: vi.fn(),
}));

vi.mock('../services/vikingEventMgmtValidation.js', () => ({
  validateVikingEventMgmtFlexiRecord: vi.fn(),
}));

import { validateVikingSectionMoversFlexiRecord } from '../../movements/services/vikingSectionMoversValidation.js';
import { validateVikingEventMgmtFlexiRecord } from '../services/vikingEventMgmtValidation.js';
import useMissingFlexiRecords from '../hooks/useMissingFlexiRecords.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useMissingFlexiRecords', () => {
  it('skips adults and waitinglist sections', async () => {
    validateVikingSectionMoversFlexiRecord.mockResolvedValue({ isValid: true, hasFlexiRecord: true, missingFields: [] });
    validateVikingEventMgmtFlexiRecord.mockResolvedValue({ isValid: true, hasFlexiRecord: true, missingFields: [] });

    const sections = [
      { sectionid: 1, sectionname: 'Adults' },
      { sectionid: 2, sectionname: 'Waiting List' },
    ];

    const { result } = renderHook(() => useMissingFlexiRecords(sections));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.missing).toEqual([]);
    expect(validateVikingSectionMoversFlexiRecord).not.toHaveBeenCalled();
    expect(validateVikingEventMgmtFlexiRecord).not.toHaveBeenCalled();
  });

  it('reports absent when the record does not exist', async () => {
    validateVikingSectionMoversFlexiRecord.mockResolvedValue({
      isValid: false,
      hasFlexiRecord: false,
      missingFields: [],
    });
    validateVikingEventMgmtFlexiRecord.mockResolvedValue({
      isValid: true,
      hasFlexiRecord: true,
      missingFields: [],
    });

    const { result } = renderHook(() =>
      useMissingFlexiRecords([{ sectionid: 7, sectionname: 'Beavers' }]),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.missing).toHaveLength(1);
    const [gap] = result.current.missing;
    expect(gap.section.sectionid).toBe(7);
    expect(gap.missingRecords).toHaveLength(1);
    expect(gap.missingRecords[0].reason).toBe('absent');
    expect(gap.missingRecords[0].template.name).toBe('Viking Section Movers');
  });

  it('reports incomplete when the record exists but is missing fields', async () => {
    validateVikingSectionMoversFlexiRecord.mockResolvedValue({ isValid: true, hasFlexiRecord: true, missingFields: [] });
    validateVikingEventMgmtFlexiRecord.mockResolvedValue({
      isValid: false,
      hasFlexiRecord: true,
      missingFields: [{ fieldName: 'CampGroup' }, { fieldName: 'SignedInBy' }],
    });

    const { result } = renderHook(() =>
      useMissingFlexiRecords([{ sectionid: 7, sectionname: 'Beavers' }]),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.missing).toHaveLength(1);
    const [gap] = result.current.missing;
    expect(gap.missingRecords[0].reason).toBe('incomplete');
    expect(gap.missingRecords[0].missingFields).toEqual(['CampGroup', 'SignedInBy']);
    expect(gap.missingRecords[0].template.name).toBe('Viking Event Mgmt');
  });

  it('skips sections where the validator hit a network error rather than reporting them as absent', async () => {
    validateVikingSectionMoversFlexiRecord.mockResolvedValue({
      isValid: false,
      hasFlexiRecord: false,
      networkError: true,
      missingFields: [],
    });
    validateVikingEventMgmtFlexiRecord.mockResolvedValue({
      isValid: true,
      hasFlexiRecord: true,
      missingFields: [],
    });

    const { result } = renderHook(() =>
      useMissingFlexiRecords([{ sectionid: 7, sectionname: 'Beavers' }]),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.missing).toEqual([]);
  });
});
