import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import SessionMiniCard from '../SessionMiniCard.jsx';
import { COVER_STATUS } from '../../utils/rotaDisplay.js';

function makeSession(overrides = {}) {
  return {
    key: 'S_20260708_49097',
    fieldId: 'f_2',
    date: '2026-07-08',
    sectionId: '49097',
    sectionName: 'Beavers',
    label: 'Bell boats',
    activityTag: 'Kayaking',
    needed: 3,
    cancelled: false,
    hasMeta: true,
    confirmed: [{ scoutid: '1', name: 'Alice Smith', status: 'I', photo_guid: null }],
    backups: [],
    status: COVER_STATUS.SHORT,
    ...overrides,
  };
}

describe('SessionMiniCard', () => {
  it('shows section, its own date, the label, activity tag, and cover ratio', () => {
    render(<SessionMiniCard session={makeSession()} onSelect={() => {}} />);

    expect(screen.getByText('Beavers')).toBeInTheDocument();
    // The tile carries its own date now that day headers are gone.
    expect(screen.getByText('Wed 8 Jul')).toBeInTheDocument();
    expect(screen.getByText('Bell boats')).toBeInTheDocument();
    expect(screen.getByText('Kayaking')).toBeInTheDocument();
    expect(screen.getByText('1/3')).toBeInTheDocument();
  });

  it('shows "Not on water" and never "Activity not set" for a cancelled week', () => {
    render(
      <SessionMiniCard
        session={makeSession({ cancelled: true, label: '', status: COVER_STATUS.OFF })}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText('Not on water')).toBeInTheDocument();
    expect(screen.queryByText('Activity not set')).not.toBeInTheDocument();
  });

  it('prompts "Activity not set" and "Set up" for an on-water week with no meta or label', () => {
    render(
      <SessionMiniCard
        session={makeSession({ label: '', hasMeta: false, needed: null, confirmed: [], status: COVER_STATUS.UNSET })}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText('Activity not set')).toBeInTheDocument();
    expect(screen.getByText('Set up')).toBeInTheDocument();
  });

  it('calls onSelect when tapped', () => {
    const onSelect = vi.fn();
    render(<SessionMiniCard session={makeSession()} onSelect={onSelect} />);

    fireEvent.click(screen.getByTestId('minicard-S_20260708_49097'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
