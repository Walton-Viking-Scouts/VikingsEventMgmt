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

  it('renders one column per future payment date, in order', async () => {
    renderPage();

    await screen.findByText(/Ann Adams/);
    expect(screen.getByText('Future')).toBeInTheDocument();
    const headers = [...screen.getAllByRole('columnheader')].map((cell) => cell.textContent);
    expect(headers).toContain('15 Jan 2026');
    expect(headers).toContain('20 Apr 2027');
    expect(headers.indexOf('15 Jan 2026')).toBeLessThan(headers.indexOf('20 Apr 2027'));
  });

  it('shows each future payment badge and dashes where the scheme has none', async () => {
    renderPage();

    await screen.findByText(/Ben Brown/);
    const ben = screen.getByText(/Ben Brown/).closest('tr').querySelectorAll('td');
    expect(ben[6].textContent).toBe('Initiated');
    expect(ben[7].textContent).toBe('Received');

    const dan = screen.getByText(/Dan Davies/).closest('tr').querySelectorAll('td');
    expect(dan[6].textContent).toBe('–');
    expect(dan[7].textContent).toBe('–');
  });

  it('shows a single Not scheduled column when there are no future payments', async () => {
    const base = makeSummary();
    loadSectionSubs.mockResolvedValue(makeSummary({
      members: base.members.map((row) => ({ ...row, buckets: { ...row.buckets, next: [] } })),
    }));

    renderPage();

    await screen.findByText(/Ann Adams/);
    expect(await screen.findByLabelText('Next · Not scheduled')).toBeInTheDocument();
    expect(screen.queryByText('Future')).not.toBeInTheDocument();
    const cells = screen.getByText(/Ann Adams/).closest('tr').querySelectorAll('td');
    expect(cells).toHaveLength(7);
    expect(cells[6].textContent).toBe('–');
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
