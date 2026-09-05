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
  it('renders one table for the section with a row per member and scheme', async () => {
    renderPage();

    expect(await screen.findByText('Thursday Beavers')).toBeInTheDocument();
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.getAllByText('Beavers Subs')).toHaveLength(4);
    expect(screen.getAllByText('Leaders Subs')).toHaveLength(1);
    expect(screen.getByText(/Ann Adams/)).toBeInTheDocument();
    expect(screen.getByLabelText('Not in cached members')).toBeInTheDocument();
    expect(screen.getByText('Camps and Activities')).toBeInTheDocument();
  });

  it('flags rows with an unpaid previous or current payment', async () => {
    renderPage();

    await screen.findByText(/Ben Brown/);
    const flagged = screen.getByText(/Ben Brown/).closest('tr');
    expect(flagged.className).toContain('border-scout-red');
    expect(screen.getByText(/Ann Adams/).closest('tr').className).toContain('border-transparent');
  });

  it('renders each nextSetUp variant as a badge', async () => {
    renderPage();

    await screen.findByText(/Ann Adams/);
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('No DD')).toBeInTheDocument();
    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(screen.getAllByText('Not scheduled').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Paid').length).toBeGreaterThan(0);
  });

  it('reads Not scheduled in the Next header when nothing is scheduled', async () => {
    loadSectionSubs.mockResolvedValue(makeSummary({
      termTotals: { ...makeSummary().termTotals, next: { ...makeSummary().termTotals.next, scheduled: false } },
    }));

    renderPage();

    expect(await screen.findByText('Next · Not scheduled')).toBeInTheDocument();
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
