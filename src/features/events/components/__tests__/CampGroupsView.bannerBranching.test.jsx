import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../../shared/services/utils/logger.js', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  LOG_CATEGORIES: { APP: 'APP', API: 'API', COMPONENT: 'COMPONENT', ERROR: 'ERROR' },
}));

vi.mock('../../../../shared/utils/platform.js', () => ({
  isMobileLayout: () => false,
}));

vi.mock('../../services/campGroupAllocationService.js', () => ({
  assignMemberToCampGroup: vi.fn(),
  batchAssignMembers: vi.fn(),
  extractFlexiRecordContext: vi.fn(),
  bulkUpdateCampGroups: vi.fn(),
}));

vi.mock('../../../../shared/services/auth/tokenService.js', () => ({
  getToken: vi.fn(() => 'tok'),
}));

vi.mock('../../../../shared/utils/notifications.js', () => ({
  notifyError: vi.fn(),
  notifyInfo: vi.fn(),
  notifySuccess: vi.fn(),
}));

vi.mock('../../../../shared/services/storage/database.js', () => ({
  default: { getSections: vi.fn(async () => []) },
}));

vi.mock('../CampGroupCard.jsx', () => ({ default: () => null }));
vi.mock('../GroupNamesEditModal.jsx', () => ({ default: () => null }));

vi.mock('../../../flexi-records', () => ({
  MissingFlexiRecordsBanner: () => <div data-testid="missing-flexi-banner">banner</div>,
  isOperationalSection: (section) => {
    const name = (section?.sectionname || section?.name || '').toLowerCase();
    if (!name) return false;
    return !(name.includes('adults') || name.includes('waiting') || name.includes('waitinglist'));
  },
}));

import CampGroupsView from '../CampGroupsView.jsx';

describe('CampGroupsView — missing-flexi banner branching', () => {
  it('renders the actionable banner when at least one event section is operational', () => {
    render(
      <CampGroupsView
        attendees={[{ scoutid: 1, person_type: 'Leaders', name: 'A Leader' }]}
        events={[
          { sectionid: 1, sectionname: 'Beavers' },
          { sectionid: 2, sectionname: 'Adults' },
        ]}
      />,
    );
    expect(screen.getByTestId('missing-flexi-banner')).toBeInTheDocument();
    expect(screen.queryByText(/no young people in this view/i)).not.toBeInTheDocument();
  });

  it('renders the adults-only explanatory alert when every event section is non-operational', () => {
    render(
      <CampGroupsView
        attendees={[{ scoutid: 1, person_type: 'Leaders', name: 'A Leader' }]}
        events={[
          { sectionid: 1, sectionname: 'Adults' },
          { sectionid: 2, sectionname: 'Waiting List' },
        ]}
      />,
    );
    expect(screen.getByText(/no young people in this view/i)).toBeInTheDocument();
    expect(screen.queryByTestId('missing-flexi-banner')).not.toBeInTheDocument();
  });

  it('renders neither banner nor alert when there are no events to classify', () => {
    render(<CampGroupsView attendees={[]} events={[]} />);
    expect(screen.queryByTestId('missing-flexi-banner')).not.toBeInTheDocument();
    expect(screen.queryByText(/no young people in this view/i)).not.toBeInTheDocument();
  });

  it('renders the banner when an event section has no name (synthetic placeholder is skipped, but other sections may be operational)', () => {
    render(
      <CampGroupsView
        attendees={[{ scoutid: 1, person_type: 'Leaders', name: 'A Leader' }]}
        events={[
          { sectionid: 1 },
          { sectionid: 2, sectionname: 'Cubs' },
        ]}
      />,
    );
    expect(screen.getByTestId('missing-flexi-banner')).toBeInTheDocument();
  });
});
