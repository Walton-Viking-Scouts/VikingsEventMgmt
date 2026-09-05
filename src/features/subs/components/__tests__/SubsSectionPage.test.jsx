import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
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
}));

vi.mock('../../../auth/hooks', () => ({
  useAuth: vi.fn(() => ({ login: vi.fn() })),
}));

import { hasFinanceScope } from '../../../../shared/services/auth/tokenScopes.js';
import { loadSectionSubs } from '../../services/subsService.js';
import SubsSectionPage from '../SubsSectionPage.jsx';
import { makeSummary } from '../../__tests__/fixtures.js';

/** Renders the section page at /subs/49097. */
function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/subs/49097']}>
      <Routes>
        <Route path="/subs/:sectionId" element={<SubsSectionPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  hasFinanceScope.mockReturnValue(true);
  loadSectionSubs.mockResolvedValue(makeSummary());
});

describe('SubsSectionPage', () => {
  it('renders one table per subs scheme with member rows', async () => {
    renderPage();

    expect(await screen.findByText('Thursday Beavers')).toBeInTheDocument();
    expect(screen.getByText('Beavers Subs')).toBeInTheDocument();
    expect(screen.getByText('Leaders Subs')).toBeInTheDocument();
    expect(screen.getAllByRole('table')).toHaveLength(2);
    expect(screen.getByText(/Ann Adams/)).toBeInTheDocument();
    expect(screen.getByLabelText('Not in cached members')).toBeInTheDocument();
    expect(screen.getAllByText('YP')).toHaveLength(2);
    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.getByText('Camps and Activities')).toBeInTheDocument();
  });

  it('lists the young people not set up', async () => {
    renderPage();

    expect(await screen.findByText('YP not set up')).toBeInTheDocument();
    expect(screen.getByText('Eve Evans')).toBeInTheDocument();
  });

  it('says so when every young person is in a scheme', async () => {
    loadSectionSubs.mockResolvedValue(makeSummary({ ypNotInSubs: [] }));

    renderPage();

    expect(await screen.findByText('All young people are in a subs scheme')).toBeInTheDocument();
  });

  it('shows a no-access error from the service', async () => {
    loadSectionSubs.mockRejectedValue(new Error('No finance access for this section'));

    renderPage();

    expect(await screen.findByText('No finance access for this section')).toBeInTheDocument();
  });

  it('shows a local, pre-network error message', async () => {
    const err = new Error('No current term is cached for Adults');
    err.code = 'NO_CURRENT_TERM';
    err.localOnly = true;
    loadSectionSubs.mockRejectedValue(err);

    renderPage();

    expect(await screen.findByText('No current term is cached for Adults')).toBeInTheDocument();
  });

  it('shows the sign-in card without the finance scope', async () => {
    hasFinanceScope.mockReturnValue(false);

    renderPage();

    expect(await screen.findByText('Sign in again to see subs')).toBeInTheDocument();
    expect(loadSectionSubs).not.toHaveBeenCalled();
  });
});
