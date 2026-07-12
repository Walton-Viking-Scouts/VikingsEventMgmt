import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../../../../shared/utils/storageUtils.js', () => ({
  safeGetSessionItem: vi.fn(),
}));

vi.mock('../../../../shared/services/storage/indexedDBService.js', () => ({
  IndexedDBService: {
    get: vi.fn(),
    STORES: { CACHE_DATA: 'cache_data' },
  },
}));

import { safeGetSessionItem } from '../../../../shared/utils/storageUtils.js';
import { IndexedDBService } from '../../../../shared/services/storage/indexedDBService.js';
import { useRotaIdentity } from '../useRotaIdentity.js';

const ROTA = {
  recordId: 777,
  members: [
    { scoutid: '10', name: 'Simon Clark' },
    { scoutid: '11', name: 'Alice Smith' },
    { scoutid: '12', name: 'Alice Smith' },
  ],
};

function Harness({ rota }) {
  const { identity, needsPicker, resolving, choose } = useRotaIdentity(rota);
  return (
    <div>
      <span data-testid="identity">{identity ? identity.name : 'none'}</span>
      <span data-testid="picker">{String(needsPicker)}</span>
      <span data-testid="resolving">{String(resolving)}</span>
      <button onClick={() => choose('11')}>choose</button>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  IndexedDBService.get.mockResolvedValue(null);
});

describe('useRotaIdentity', () => {
  it('auto-matches a unique full name from session user info', async () => {
    safeGetSessionItem.mockReturnValue({ firstname: 'Simon', lastname: 'Clark' });

    render(<Harness rota={ROTA} />);

    await waitFor(() => expect(screen.getByTestId('identity')).toHaveTextContent('Simon Clark'));
    expect(screen.getByTestId('picker')).toHaveTextContent('false');
    expect(localStorage.getItem('viking_rota_identity_777')).toBe('10');
  });

  it('asks for the picker when the name is ambiguous', async () => {
    safeGetSessionItem.mockReturnValue({ firstname: 'Alice', lastname: 'Smith' });

    render(<Harness rota={ROTA} />);

    await waitFor(() => expect(screen.getByTestId('picker')).toHaveTextContent('true'));
    expect(screen.getByTestId('identity')).toHaveTextContent('none');
  });

  it('asks for the picker when no name source exists', async () => {
    safeGetSessionItem.mockReturnValue({});
    IndexedDBService.get.mockResolvedValue(null);

    render(<Harness rota={ROTA} />);

    await waitFor(() => expect(screen.getByTestId('picker')).toHaveTextContent('true'));
  });

  it('prefers a previously confirmed choice over name matching', async () => {
    safeGetSessionItem.mockReturnValue({ firstname: 'Simon', lastname: 'Clark' });
    localStorage.setItem('viking_rota_identity_777', '11');

    render(<Harness rota={ROTA} />);

    await waitFor(() => expect(screen.getByTestId('identity')).toHaveTextContent('Alice Smith'));
  });

  it('persists an explicit choice', async () => {
    safeGetSessionItem.mockReturnValue({ firstname: 'Alice', lastname: 'Smith' });

    render(<Harness rota={ROTA} />);
    await waitFor(() => expect(screen.getByTestId('picker')).toHaveTextContent('true'));

    fireEvent.click(screen.getByText('choose'));
    await waitFor(() => expect(screen.getByTestId('identity')).toHaveTextContent('Alice Smith'));
    expect(localStorage.getItem('viking_rota_identity_777')).toBe('11');
  });

  it('falls back to cached startup globals for the name', async () => {
    safeGetSessionItem.mockReturnValue({});
    IndexedDBService.get.mockResolvedValue({ globals: { firstname: 'Simon', lastname: 'Clark' } });

    render(<Harness rota={ROTA} />);

    await waitFor(() => expect(screen.getByTestId('identity')).toHaveTextContent('Simon Clark'));
  });
});
