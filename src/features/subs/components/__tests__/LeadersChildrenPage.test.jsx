import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../../../../shared/services/auth/tokenService.js', () => ({
  getToken: vi.fn(() => 'test-token'),
}));

vi.mock('../../../../shared/services/auth/tokenScopes.js', () => ({
  hasFinanceScope: vi.fn(() => true),
  decodeTokenScopes: vi.fn(() => []),
}));

vi.mock('../../services/subsService.js', () => ({
  getSubsSections: vi.fn(),
  loadSectionSubs: vi.fn(),
  loadLeadersChildren: vi.fn(),
}));

vi.mock('../../../auth/hooks', () => ({
  useAuth: vi.fn(() => ({ login: vi.fn() })),
}));

import { hasFinanceScope } from '../../../../shared/services/auth/tokenScopes.js';
import { getSubsSections, loadLeadersChildren, loadSectionSubs } from '../../services/subsService.js';
import LeadersChildrenPage from '../LeadersChildrenPage.jsx';

const leader = (scoutId, sectionName, matchedOn = ['name'], name = 'Jane Doe') => ({
  scoutId, name, sections: [{ sectionId: '9', sectionName }], matchedOn,
});

const MATCHED = [
  {
    sectionId: '1',
    sectionName: 'Beavers',
    children: [
      {
        scoutId: '200', firstName: 'Amy', lastName: 'Doe',
        parents: [{ contact: 'Primary contact 1', name: 'Jane Doe', leaders: [leader('100', 'Cubs')] }],
      },
      {
        scoutId: '201', firstName: 'Ben', lastName: 'Doe',
        parents: [{
          contact: 'Primary contact 2', name: 'Jen Doe',
          leaders: [leader('100', 'Adults', ['email'], 'Jennifer Doe')],
        }],
      },
    ],
  },
  { sectionId: '2', sectionName: 'Cubs', children: [] },
  {
    sectionId: '4',
    sectionName: 'Scouts',
    children: [
      {
        scoutId: '300', firstName: 'Cal', lastName: 'Roe',
        parents: [{ contact: 'Primary contact 1', name: 'Jo Roe', leaders: [leader('101', 'Beavers')] }],
      },
    ],
  },
];

const ACCESS = [
  { sectionId: '1', sectionName: 'Beavers', canView: true, permissionsSynced: true },
  { sectionId: '2', sectionName: 'Cubs', canView: true, permissionsSynced: true },
  { sectionId: '4', sectionName: 'Scouts', canView: false, permissionsSynced: true },
];

/** Renders the page inside a router. */
function renderPage() {
  return render(
    <MemoryRouter>
      <LeadersChildrenPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  hasFinanceScope.mockReturnValue(true);
  loadLeadersChildren.mockResolvedValue(MATCHED);
  getSubsSections.mockResolvedValue(ACCESS);
  loadSectionSubs.mockResolvedValue({
    schemes: [
      { name: 'Leaders Subs', members: [{ scoutId: '200' }] },
      { name: 'Beavers Subs', members: [{ scoutId: '201' }] },
    ],
  });
});

describe('LeadersChildrenPage', () => {
  it('shows each section with its matched children, leader sections and subs group', async () => {
    renderPage();

    const beavers = (await screen.findByRole('heading', { name: 'Beavers' })).closest('section');
    const amyRow = within(beavers).getByText('Amy Doe').closest('tr');
    expect(within(amyRow).getByText('Cubs')).toBeInTheDocument();
    expect(await within(amyRow).findByText('Leaders')).toBeInTheDocument();
    expect(within(amyRow).getByText('Leaders Subs')).toBeInTheDocument();

    expect(within(amyRow).queryByText('email match')).not.toBeInTheDocument();

    const benRow = within(beavers).getByText('Ben Doe').closest('tr');
    expect(within(benRow).getByText('Adults')).toBeInTheDocument();
    expect(within(benRow).getByText(/Jennifer Doe/)).toBeInTheDocument();
    expect(within(benRow).getByText('email match')).toBeInTheDocument();
    expect(within(benRow).getByText('Other')).toBeInTheDocument();
  });

  it('loads subs only for viewable sections with a match', async () => {
    renderPage();

    await screen.findAllByText('Leaders Subs');
    expect(loadSectionSubs).toHaveBeenCalledTimes(1);
    expect(loadSectionSubs).toHaveBeenCalledWith('1', { token: 'test-token', forceRefresh: false });
  });

  it('marks sections without finance access and empty sections', async () => {
    renderPage();

    const scouts = (await screen.findByRole('heading', { name: 'Scouts' })).closest('section');
    expect(within(scouts).getByText('No finance access')).toBeInTheDocument();
    const cubs = screen.getByRole('heading', { name: 'Cubs' }).closest('section');
    expect(within(cubs).getByText('No young people with a parent who is a leader')).toBeInTheDocument();
  });

  it('still lists matches without the finance scope', async () => {
    hasFinanceScope.mockReturnValue(false);

    renderPage();

    expect(await screen.findByText('Amy Doe')).toBeInTheDocument();
    expect(screen.getByText(/Sign in again with the finance permission/)).toBeInTheDocument();
    expect(loadSectionSubs).not.toHaveBeenCalled();
  });
});
