import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
}));

vi.mock('../../../auth/hooks', () => ({
  useAuth: vi.fn(() => ({ login: vi.fn() })),
}));

import { hasFinanceScope } from '../../../../shared/services/auth/tokenScopes.js';
import { getSubsSections, loadSectionSubs } from '../../services/subsService.js';
import SubsSummaryPage from '../SubsSummaryPage.jsx';
import { makeSummary, SECTIONS, MIXED_SECTIONS, termBucketStats } from '../../__tests__/fixtures.js';

/** Renders the summary page inside a router. */
function renderPage() {
  return render(
    <MemoryRouter>
      <SubsSummaryPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  hasFinanceScope.mockReturnValue(true);
  getSubsSections.mockResolvedValue(SECTIONS);
  loadSectionSubs.mockImplementation((sectionId) =>
    Promise.resolve(makeSummary({ sectionId, sectionName: `Section ${sectionId}` })),
  );
});

describe('SubsSummaryPage', () => {
  it('shows the sign-in card when the token lacks the finance scope', async () => {
    hasFinanceScope.mockReturnValue(false);

    renderPage();

    expect(await screen.findByText('Sign in again to see subs')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in to osm/i })).toBeInTheDocument();
    expect(getSubsSections).not.toHaveBeenCalled();
  });

  it('shows the sign-in card when the load needs auth', async () => {
    const err = new Error('Token expired');
    err.needsAuth = true;
    loadSectionSubs.mockRejectedValueOnce(err);

    renderPage();

    expect(await screen.findByText('Sign in again to see subs')).toBeInTheDocument();
  });

  it('renders one row per section with its term figures', async () => {
    renderPage();

    expect(await screen.findByRole('link', { name: 'Thursday Beavers' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('link', { name: 'Friday Cubs' })).toBeInTheDocument());

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(screen.getByText('Previous · Summer 2025')).toBeInTheDocument();
    expect(screen.getByText('Current · Autumn 2025')).toBeInTheDocument();
    expect(screen.getByText('Next · Spring 2026')).toBeInTheDocument();
    expect(screen.getAllByText('24').length).toBeGreaterThan(0);
    expect(screen.getAllByText('£24').length).toBeGreaterThan(0);
  });

  it('highlights a non-zero overdue figure in scout-red', async () => {
    const { container } = renderPage();

    await screen.findByRole('link', { name: 'Friday Cubs' });
    const highlighted = [...container.querySelectorAll('.text-scout-red')];
    expect(highlighted).toHaveLength(4);
    expect(highlighted.map((node) => node.textContent)).toEqual(['1£24', '1£26', '1£24', '1£26']);
  });

  it('shows Not scheduled instead of figures for an unscheduled bucket', async () => {
    loadSectionSubs.mockImplementation(() =>
      Promise.resolve(makeSummary({
        termTotals: {
          previous: termBucketStats({ scheduled: true }),
          current: termBucketStats({ scheduled: true }),
          next: termBucketStats({ scheduled: false }),
        },
      })),
    );

    renderPage();

    await waitFor(() => expect(screen.getAllByText('Not scheduled')).toHaveLength(2));
  });

  it('shows a spinner on the row being loaded and dashes on pending rows', async () => {
    let resolveFirst;
    loadSectionSubs.mockImplementation(() => new Promise((resolve) => { resolveFirst = resolve; }));

    renderPage();

    expect(await screen.findByLabelText('Loading section')).toBeInTheDocument();
    expect(screen.getAllByText('–').length).toBeGreaterThan(0);
    resolveFirst(makeSummary());
  });

  it('greys out a section with no finance access', async () => {
    getSubsSections.mockResolvedValue(MIXED_SECTIONS);

    renderPage();

    expect(await screen.findByText('Saturday Scouts')).toBeInTheDocument();
    expect(screen.getByText('No finance access')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Saturday Scouts' })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(loadSectionSubs.mock.calls.map((call) => call[0])).toEqual(['49097', '49098']),
    );
  });

  it('marks a section with a local error and still loads the rest', async () => {
    const err = new Error('No current term for Adults (last term ended 2013-05-23)');
    err.code = 'NO_CURRENT_TERM';
    err.localOnly = true;
    loadSectionSubs.mockRejectedValueOnce(err);

    renderPage();

    expect(await screen.findByText('No current term for Adults (last term ended 2013-05-23)')).toBeInTheDocument();
    await waitFor(() => expect(loadSectionSubs).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('link', { name: 'Thursday Beavers' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Friday Cubs' })).toBeInTheDocument();
    expect(screen.queryByText(/Loading stopped/)).not.toBeInTheDocument();
  });

  it('notes when no section has finance access', async () => {
    getSubsSections.mockResolvedValue([
      { sectionId: '49099', sectionName: 'Saturday Scouts', financePermission: 0, canView: false },
    ]);

    renderPage();

    expect(await screen.findByText('No sections with finance access')).toBeInTheDocument();
  });
});
