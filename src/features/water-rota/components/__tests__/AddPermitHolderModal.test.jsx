import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import AddPermitHolderModal from '../AddPermitHolderModal.jsx';

const MEMBERS = [
  { scoutid: '10', name: 'Simon Clark', photo_guid: 'guid-10' },
  { scoutid: '11', name: 'Alice Smith' },
  { scoutid: '12', name: 'Bob Jones' },
];

describe('AddPermitHolderModal', () => {
  it('renders every member, name-sorted', () => {
    render(
      <AddPermitHolderModal
        isOpen
        members={MEMBERS}
        existingScoutids={[]}
        onPick={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const rows = screen.getAllByRole('button').filter((el) => el.dataset.testid?.startsWith('add-permit-holder-row-'));
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Alice Smith'),
      expect.stringContaining('Bob Jones'),
      expect.stringContaining('Simon Clark'),
    ]);
  });

  it('filters by search text', () => {
    render(
      <AddPermitHolderModal
        isOpen
        members={MEMBERS}
        existingScoutids={[]}
        onPick={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Search members'), { target: { value: 'ali' } });

    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.queryByText('Bob Jones')).not.toBeInTheDocument();
    expect(screen.queryByText('Simon Clark')).not.toBeInTheDocument();
  });

  it('disables and tags rows already signed up', () => {
    render(
      <AddPermitHolderModal
        isOpen
        members={MEMBERS}
        existingScoutids={['11']}
        onPick={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Already on')).toBeInTheDocument();
    expect(screen.getByTestId('add-permit-holder-row-11')).toBeDisabled();
    expect(screen.getByTestId('add-permit-holder-row-10')).not.toBeDisabled();
  });

  it('calls onPick with the chosen scoutid', () => {
    const onPick = vi.fn();
    render(
      <AddPermitHolderModal
        isOpen
        members={MEMBERS}
        existingScoutids={[]}
        onPick={onPick}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('add-permit-holder-row-10'));
    expect(onPick).toHaveBeenCalledWith('10');
  });

  it('does not call onPick for a disabled row', () => {
    const onPick = vi.fn();
    render(
      <AddPermitHolderModal
        isOpen
        members={MEMBERS}
        existingScoutids={['10']}
        onPick={onPick}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('add-permit-holder-row-10'));
    expect(onPick).not.toHaveBeenCalled();
  });

  it('shows an empty state when no members match', () => {
    render(
      <AddPermitHolderModal
        isOpen
        members={MEMBERS}
        existingScoutids={[]}
        onPick={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Search members'), { target: { value: 'zzz' } });
    expect(screen.getByText('No matching names.')).toBeInTheDocument();
  });
});
