import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import SessionCard from '../SessionCard.jsx';
import { COVER_STATUS } from '../../utils/rotaDisplay.js';

function makeSession(overrides = {}) {
  return {
    fieldId: 'f_2',
    date: '2026-07-14',
    sectionId: '49097',
    sectionName: 'Cubs',
    activity: 'Kayaking',
    programmeTitle: '',
    label: 'Kayaking',
    activityTag: '',
    startTime: '18:15',
    endTime: '19:30',
    kids: 24,
    needed: 3,
    notes: '',
    cancelled: false,
    hasMeta: true,
    confirmed: [
      { scoutid: '1', name: 'Alice Smith', status: 'I', at: null },
      { scoutid: '2', name: 'Bob Jones', status: 'I', at: null },
    ],
    backups: [{ scoutid: '3', name: 'Cara Lee', status: 'B', at: null }],
    status: COVER_STATUS.AT_RISK,
    ...overrides,
  };
}

describe('SessionCard', () => {
  it('shows section, date, times, activity, kids, and cover counts', () => {
    render(<SessionCard session={makeSession()} />);

    expect(screen.getByText('Cubs')).toBeInTheDocument();
    expect(screen.getByText('Tue 14 Jul')).toBeInTheDocument();
    expect(screen.getByText('18:15–19:30')).toBeInTheDocument();
    expect(screen.getByText('Kayaking')).toBeInTheDocument();
    expect(screen.getByText('~24 YP')).toBeInTheDocument();
    expect(screen.getByText('of 3 permit holders', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('· 1 backup', { exact: false })).toBeInTheDocument();
  });

  it('shows the programme title as the label and the activity as a secondary tag', () => {
    render(<SessionCard session={makeSession({ label: 'Bell boats', activity: 'Kayaking', activityTag: 'Kayaking', programmeTitle: 'Bell boats' })} />);

    expect(screen.getByText('Bell boats')).toBeInTheDocument();
    expect(screen.getByText('Kayaking')).toBeInTheDocument();
  });

  it('renders the not-on-water state without cover details', () => {
    render(<SessionCard session={makeSession({ cancelled: true, status: COVER_STATUS.OFF })} />);

    expect(screen.getByText('Not on water')).toBeInTheDocument();
    expect(screen.queryByText('Kayaking')).not.toBeInTheDocument();
    expect(screen.queryByText('of 3 permit holders', { exact: false })).not.toBeInTheDocument();
  });

  it('prompts setup when no metadata exists yet', () => {
    render(
      <SessionCard
        session={makeSession({
          hasMeta: false,
          needed: null,
          kids: null,
          confirmed: [],
          backups: [],
          status: COVER_STATUS.UNSET,
        })}
      />,
    );

    expect(screen.getByText('Needs setting up')).toBeInTheDocument();
  });

  it('calls onSelect with the session when tapped', () => {
    const onSelect = vi.fn();
    const session = makeSession();
    render(<SessionCard session={session} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith(session);
  });
});
