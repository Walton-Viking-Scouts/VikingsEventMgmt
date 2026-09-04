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
import { makeSummary, SECTIONS, MIXED_SECTIONS } from '../../__tests__/fixtures.js';

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

  it('renders each section card with its summary numbers', async () => {
    renderPage();

    expect(await screen.findByText('Thursday Beavers')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('Beavers Subs 2 / Leaders Subs 0')).toHaveLength(2));
    expect(screen.getAllByText('24').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1 (£26)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Beavers Subs 2 / Leaders Subs 0').length).toBeGreaterThan(0);
  });

  it('shows the failing section in the error banner and stops loading', async () => {
    loadSectionSubs.mockRejectedValueOnce(new Error('OSM said no'));

    renderPage();

    expect(await screen.findByText(/Couldn't load Thursday Beavers/)).toBeInTheDocument();
    expect(screen.getByText(/Loading stopped/)).toBeInTheDocument();
    expect(loadSectionSubs).toHaveBeenCalledTimes(1);
  });

  it('greys out a section with no finance access', async () => {
    getSubsSections.mockResolvedValue(MIXED_SECTIONS);

    renderPage();

    expect(await screen.findByText('Saturday Scouts')).toBeInTheDocument();
    expect(screen.getByText('No finance access')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Saturday Scouts/ })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(loadSectionSubs.mock.calls.map((call) => call[0])).toEqual(['49097', '49098']),
    );
  });

  it('notes when no section has finance access', async () => {
    getSubsSections.mockResolvedValue([
      { sectionId: '49099', sectionName: 'Saturday Scouts', financePermission: 0, canView: false },
    ]);

    renderPage();

    expect(await screen.findByText('No sections with finance access')).toBeInTheDocument();
  });
});
