import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../../../../shared/services/utils/logger.js', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  LOG_CATEGORIES: { ERROR: 'ERROR' },
}));

vi.mock('../../../../shared/services/storage/database.js', () => ({
  default: { getMembers: vi.fn() },
}));

import databaseService from '../../../../shared/services/storage/database.js';
import { useSectionLeaders } from '../useSectionLeaders.js';

function Harness({ ids, host }) {
  const { candidates, loading } = useSectionLeaders(ids, host);
  return <span data-testid="out">{loading ? 'loading' : JSON.stringify(candidates)}</span>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useSectionLeaders', () => {
  it('queries host + sections with numeric ids', async () => {
    databaseService.getMembers.mockResolvedValue([]);
    render(<Harness ids={['49097']} host="900" />);
    await waitFor(() => expect(databaseService.getMembers).toHaveBeenCalled());
    expect(databaseService.getMembers).toHaveBeenCalledWith([900, 49097]);
  });

  it('returns section leaders who are also host members, excluding YP and non-host leaders', async () => {
    databaseService.getMembers.mockResolvedValue([
      {
        scoutid: '1', firstname: 'Alice', lastname: 'Adams',
        sections: [
          { sectionid: 49097, person_type: 'Leaders' }, // Cubs leader
          { sectionid: 900, person_type: 'Leaders' }, // in Adults host → candidate
        ],
      },
      {
        scoutid: '2', firstname: 'Bob', lastname: 'Best',
        sections: [{ sectionid: 49097, person_type: 'Leaders' }], // Cubs leader NOT in host → excluded
      },
      {
        scoutid: '3', firstname: 'Cara', lastname: 'Cole',
        sections: [
          { sectionid: 49097, person_type: 'Young People' }, // YP → excluded
          { sectionid: 900, person_type: 'Young People' },
        ],
      },
    ]);

    render(<Harness ids={['49097']} host="900" />);
    await waitFor(() => expect(screen.getByTestId('out')).not.toHaveTextContent('loading'));
    const out = JSON.parse(screen.getByTestId('out').textContent);
    expect(out['49097']).toEqual([{ scoutid: '1', name: 'Alice Adams' }]);
  });

  it('returns empty candidate arrays for sections with no eligible leaders', async () => {
    databaseService.getMembers.mockResolvedValue([
      { scoutid: '2', firstname: 'Bob', sections: [{ sectionid: 49097, person_type: 'Leaders' }] },
    ]);
    render(<Harness ids={['49097']} host="900" />);
    await waitFor(() => expect(screen.getByTestId('out')).not.toHaveTextContent('loading'));
    expect(JSON.parse(screen.getByTestId('out').textContent)).toEqual({ '49097': [] });
  });

  it('no-ops without a host section', async () => {
    render(<Harness ids={['49097']} host={null} />);
    await waitFor(() => expect(screen.getByTestId('out')).toHaveTextContent('{}'));
    expect(databaseService.getMembers).not.toHaveBeenCalled();
  });
});
