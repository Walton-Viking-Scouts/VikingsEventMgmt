import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
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
    expect(screen.getByText('Young people')).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.queryByText(/Summer 2025/)).not.toBeInTheDocument();
    expect(screen.getAllByText('24').length).toBeGreaterThan(0);
    expect(screen.getAllByText('£24').length).toBeGreaterThan(0);
  });

  it('splits the YP figure between leaders and section subs', async () => {
    renderPage();

    await screen.findByRole('link', { name: 'Thursday Beavers' });
    const cells = screen.getAllByRole('row')[2].querySelectorAll('td');
    expect([...cells].slice(1, 5).map((cell) => cell.textContent)).toEqual(['24', '0', '2', '1']);
  });

  it('dashes the leaders column when the section has no leaders scheme', async () => {
    loadSectionSubs.mockImplementation(() =>
      Promise.resolve(makeSummary({
        schemes: makeSummary().schemes.filter((scheme) => scheme.name !== 'Leaders Subs'),
      })),
    );

    renderPage();

    await screen.findByRole('link', { name: 'Thursday Beavers' });
    const cells = screen.getAllByRole('row')[2].querySelectorAll('td');
    expect([...cells].slice(1, 5).map((cell) => cell.textContent)).toEqual(['24', '–', '2', '1']);
  });

  it('shows Due, Paid and Unpaid per term group and no overdue highlight', async () => {
    const { container } = renderPage();

    await screen.findByRole('link', { name: 'Friday Cubs' });
    const headers = [...screen.getAllByRole('columnheader')].map((cell) => cell.textContent);
    expect(headers.filter((text) => text === 'due')).toHaveLength(3);
    expect(headers.filter((text) => text === 'paid')).toHaveLength(3);
    expect(headers.filter((text) => text === 'unpaid')).toHaveLength(3);
    expect(headers).not.toContain('overdue');
    expect(container.querySelectorAll('.text-scout-red')).toHaveLength(0);

    const cells = screen.getAllByRole('row')[2].querySelectorAll('td');
    expect([...cells].slice(5, 8).map((cell) => cell.textContent)).toEqual(['3£72', '2£48', '1£24']);
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

    await act(async () => {
      resolveFirst(makeSummary());
      await Promise.resolve();
    });
  });

  it('shows the loaded time per row', async () => {
    renderPage();

    await screen.findByRole('link', { name: 'Thursday Beavers' });
    expect(screen.getAllByText(/^Loaded \d{2}:\d{2}$/).length).toBe(2);
  });

  it('marks a section whose permissions are not synced', async () => {
    getSubsSections.mockResolvedValue([
      { sectionId: '49097', sectionName: 'Thursday Beavers', financePermission: 0, canView: false, permissionsSynced: false },
    ]);

    renderPage();

    expect(await screen.findByText('Permissions not synced — refresh the app data')).toBeInTheDocument();
    expect(screen.queryByText('No finance access')).not.toBeInTheDocument();
    expect(loadSectionSubs).not.toHaveBeenCalled();
  });

  it('dashes the YP cells when the section has no cached members', async () => {
    loadSectionSubs.mockImplementation(() => Promise.resolve(makeSummary({ cachedMemberCount: 0 })));

    renderPage();

    await screen.findByRole('link', { name: 'Thursday Beavers' });
    const cells = screen.getAllByRole('row')[2].querySelectorAll('td');
    expect([...cells].slice(1, 5).map((cell) => cell.textContent)).toEqual(['–', '–', '–', '–']);
    expect(cells[1].getAttribute('title')).toBe('No members cached for this section — refresh the app data');
  });

  it('dashes and unlinks later rows when a network error stops the run', async () => {
    const err = new Error('OSM said no');
    err.code = 'LOAD_FAILED';
    loadSectionSubs.mockRejectedValueOnce(err);

    renderPage();

    expect(await screen.findByText(/Couldn't load Thursday Beavers/)).toBeInTheDocument();
    expect(screen.getByText(/Loading stopped/)).toBeInTheDocument();
    expect(loadSectionSubs).toHaveBeenCalledTimes(1);
    const laterRow = screen.getAllByRole('row')[3];
    expect(laterRow.querySelectorAll('td')[1].textContent).toBe('–');
    expect(screen.getByRole('link', { name: 'Friday Cubs' })).toBeInTheDocument();
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
