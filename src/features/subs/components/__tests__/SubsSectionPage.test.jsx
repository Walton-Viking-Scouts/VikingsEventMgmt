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

  it('flags only rows with an overdue payment, not merely scheduled ones', async () => {
    renderPage();

    await screen.findByText(/Ben Brown/);
    expect(screen.getByText(/Ben Brown/).closest('tr').className).toContain('border-scout-red');
    expect(screen.getByText(/Ann Adams/).closest('tr').className).toContain('border-transparent');
  });

  it('shows OSM status text verbatim on the badges', async () => {
    renderPage();

    await screen.findByText(/Ben Brown/);
    const cells = screen.getByText(/Ben Brown/).closest('tr').querySelectorAll('td');
    expect(cells[4].textContent).toBe('Payment required');
    expect(cells[5].textContent).toBe('Payment requiredPayment required');
    expect(screen.getAllByText('Received').length).toBeGreaterThan(0);
  });

  it('reads Payment required for an applicable payment with an empty history', async () => {
    const base = makeSummary();
    loadSectionSubs.mockResolvedValue(makeSummary({
      members: base.members.map((row, index) => (index === 0
        ? {
          ...row,
          buckets: {
            ...row.buckets,
            current: [{ paymentId: '1259483', date: '2025-09-15', amount: 26, isDue: true, state: 'not-started', latestStatus: '', latestAt: null }],
          },
        }
        : row)),
    }));

    renderPage();

    await screen.findByText(/Ann Adams/);
    const currentCell = screen.getByText(/Ann Adams/).closest('tr').querySelectorAll('td')[5];
    expect(currentCell.textContent).toBe('Payment required');
    expect(currentCell.querySelector('span span').className).toContain('text-scout-red');
  });

  it('colours every Payment required badge red, whatever its date', async () => {
    const { container } = renderPage();

    await screen.findByText(/Ben Brown/);
    const required = [...container.querySelectorAll('td span span')]
      .filter((node) => node.textContent === 'Payment required');
    expect(required.length).toBeGreaterThan(0);
    required.forEach((node) => {
      expect(node.className).toContain('text-scout-red');
      expect(node.className).not.toContain('amber');
    });
  });

  it('shows the OSM status in the Next cell when there is one', async () => {
    renderPage();

    await screen.findByText(/Ben Brown/);
    const nextCell = screen.getByText(/Ben Brown/).closest('tr').querySelectorAll('td')[6];
    expect(nextCell.textContent).toBe('Initiated');
  });

  it('falls back to the set-up badge when OSM has no next-term status', async () => {
    renderPage();

    await screen.findByText(/Dan Davies/);
    const nextCell = screen.getByText(/Dan Davies/).closest('tr').querySelectorAll('td')[6];
    expect(nextCell.textContent).toBe('Not scheduled');
  });

  it('shows an inferred term name in the column header', async () => {
    loadSectionSubs.mockResolvedValue(makeSummary({
      terms: {
        ...makeSummary().terms,
        next: { termId: null, name: 'from 15 Jan 2027', startDate: '2027-01-15', endDate: null, inferred: true },
      },
    }));

    renderPage();

    expect(await screen.findByLabelText('Next · from 15 Jan 2027')).toBeInTheDocument();
    expect(screen.queryByLabelText('Next · Not scheduled')).not.toBeInTheDocument();
  });

  it('renders the derived set-up badges when OSM has no next-term status', async () => {
    renderPage();

    await screen.findByText(/Cara Clark/);
    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(screen.getAllByText('Not scheduled').length).toBeGreaterThan(0);
  });

  it('reads Not scheduled in the Next header when nothing is scheduled', async () => {
    loadSectionSubs.mockResolvedValue(makeSummary({
      termTotals: { ...makeSummary().termTotals, next: { ...makeSummary().termTotals.next, scheduled: false } },
    }));

    renderPage();

    expect(await screen.findByRole('columnheader', { name: 'Next · Not scheduled' })).toBeInTheDocument();
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
