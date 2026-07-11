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
import { useSectionYPCounts } from '../useSectionYPCounts.js';

function Harness({ ids }) {
  const { counts, loading } = useSectionYPCounts(ids);
  return <span data-testid="out">{loading ? 'loading' : JSON.stringify(counts)}</span>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useSectionYPCounts', () => {
  it('calls getMembers with NUMERIC ids (web index lookup is type-strict)', async () => {
    databaseService.getMembers.mockResolvedValue([]);
    render(<Harness ids={['49097', '49099']} />);
    await waitFor(() => expect(databaseService.getMembers).toHaveBeenCalled());
    expect(databaseService.getMembers).toHaveBeenCalledWith([49097, 49099]);
  });

  it('counts Young People per section from each member\'s section memberships', async () => {
    databaseService.getMembers.mockResolvedValue([
      {
        scoutid: '1',
        sections: [
          { sectionid: 49097, person_type: 'Young People' },
          { sectionid: 49099, person_type: 'Young People' }, // multi-section scout
        ],
      },
      {
        scoutid: '2',
        sections: [{ sectionid: 49097, person_type: 'Young People' }],
      },
      {
        scoutid: '3',
        sections: [{ sectionid: 49097, person_type: 'Leaders' }], // not counted
      },
    ]);

    render(<Harness ids={['49097', '49099']} />);
    await waitFor(() => expect(screen.getByTestId('out')).not.toHaveTextContent('loading'));
    expect(JSON.parse(screen.getByTestId('out').textContent)).toEqual({ '49097': 2, '49099': 1 });
  });

  it('returns zeros (not undefined) for requested sections with no YP', async () => {
    databaseService.getMembers.mockResolvedValue([
      { scoutid: '3', sections: [{ sectionid: 49097, person_type: 'Leaders' }] },
    ]);
    render(<Harness ids={['49097']} />);
    await waitFor(() => expect(screen.getByTestId('out')).not.toHaveTextContent('loading'));
    expect(JSON.parse(screen.getByTestId('out').textContent)).toEqual({ '49097': 0 });
  });

  it('handles an empty id list', async () => {
    render(<Harness ids={[]} />);
    await waitFor(() => expect(screen.getByTestId('out')).toHaveTextContent('{}'));
    expect(databaseService.getMembers).not.toHaveBeenCalled();
  });
});
