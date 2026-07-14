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

const MEMBERS = [
  { scoutid: '10', name: 'Simon Clark' },
  { scoutid: '11', name: 'Alice Smith' },
  { scoutid: '12', name: 'Alice Smith' },
];

const ROTA_GROUP = {
  hostSection: { sectionid: 555 },
  members: MEMBERS,
};

function Harness({ rota }) {
  const { identity, needsPicker, resolving, choose, clear } = useRotaIdentity(rota);
  return (
    <div>
      <span data-testid="identity">{identity ? identity.name : 'none'}</span>
      <span data-testid="picker">{String(needsPicker)}</span>
      <span data-testid="resolving">{String(resolving)}</span>
      <button onClick={() => choose('11')}>choose</button>
      <button onClick={() => clear()}>clear</button>
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

    render(<Harness rota={ROTA_GROUP} />);

    await waitFor(() => expect(screen.getByTestId('identity')).toHaveTextContent('Simon Clark'));
    expect(screen.getByTestId('picker')).toHaveTextContent('false');
    expect(localStorage.getItem('viking_rota_identity_555')).toBe('10');
  });

  it('asks for the picker when the name is ambiguous', async () => {
    safeGetSessionItem.mockReturnValue({ firstname: 'Alice', lastname: 'Smith' });

    render(<Harness rota={ROTA_GROUP} />);

    await waitFor(() => expect(screen.getByTestId('picker')).toHaveTextContent('true'));
    expect(screen.getByTestId('identity')).toHaveTextContent('none');
  });

  it('asks for the picker when no name source exists', async () => {
    safeGetSessionItem.mockReturnValue({});
    IndexedDBService.get.mockResolvedValue(null);

    render(<Harness rota={ROTA_GROUP} />);

    await waitFor(() => expect(screen.getByTestId('picker')).toHaveTextContent('true'));
  });

  it('prefers a previously confirmed choice over name matching', async () => {
    safeGetSessionItem.mockReturnValue({ firstname: 'Simon', lastname: 'Clark' });
    localStorage.setItem('viking_rota_identity_555', '11');

    render(<Harness rota={ROTA_GROUP} />);

    await waitFor(() => expect(screen.getByTestId('identity')).toHaveTextContent('Alice Smith'));
  });

  it('persists an explicit choice', async () => {
    safeGetSessionItem.mockReturnValue({ firstname: 'Alice', lastname: 'Smith' });

    render(<Harness rota={ROTA_GROUP} />);
    await waitFor(() => expect(screen.getByTestId('picker')).toHaveTextContent('true'));

    fireEvent.click(screen.getByText('choose'));
    await waitFor(() => expect(screen.getByTestId('identity')).toHaveTextContent('Alice Smith'));
    expect(localStorage.getItem('viking_rota_identity_555')).toBe('11');
  });

  it('falls back to cached startup globals for the name', async () => {
    safeGetSessionItem.mockReturnValue({});
    IndexedDBService.get.mockResolvedValue({ globals: { firstname: 'Simon', lastname: 'Clark' } });

    render(<Harness rota={ROTA_GROUP} />);

    await waitFor(() => expect(screen.getByTestId('identity')).toHaveTextContent('Simon Clark'));
  });

  it('resolves the same identity across two rota groups that share a host section', async () => {
    safeGetSessionItem.mockReturnValue({});

    const { unmount } = render(<Harness rota={ROTA_GROUP} />);
    await waitFor(() => expect(screen.getByTestId('picker')).toHaveTextContent('true'));
    fireEvent.click(screen.getByText('choose'));
    await waitFor(() => expect(screen.getByTestId('identity')).toHaveTextContent('Alice Smith'));
    unmount();

    // A second group aggregated for a different season bucket, but hosted in
    // the same Adults section — new object identity, same hostSectionId.
    const otherGroup = { hostSection: { sectionid: 555 }, members: MEMBERS };
    render(<Harness rota={otherGroup} />);

    await waitFor(() => expect(screen.getByTestId('identity')).toHaveTextContent('Alice Smith'));
    expect(screen.getByTestId('picker')).toHaveTextContent('false');
  });

  it('clear() drops the stored choice and re-opens the picker', async () => {
    safeGetSessionItem.mockReturnValue({ firstname: 'Simon', lastname: 'Clark' });

    render(<Harness rota={ROTA_GROUP} />);
    await waitFor(() => expect(screen.getByTestId('identity')).toHaveTextContent('Simon Clark'));

    fireEvent.click(screen.getByText('clear'));

    expect(screen.getByTestId('identity')).toHaveTextContent('none');
    expect(screen.getByTestId('picker')).toHaveTextContent('true');
    expect(localStorage.getItem('viking_rota_identity_555')).toBeNull();
  });
});
