import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import StateBadge from '../StateBadge.jsx';

describe('StateBadge', () => {
  it.each([
    ['paid', 'Paid'],
    ['in-progress', 'In progress'],
    ['required', 'Required'],
    ['not-started', 'Not started'],
    ['not-required', 'Not required'],
  ])('labels the %s state', (state, label) => {
    render(<StateBadge state={state} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('renders an empty dashed marker for not-applicable', () => {
    render(<StateBadge state="not-applicable" />);
    expect(screen.getByLabelText('Not applicable')).toBeInTheDocument();
  });

  it('surfaces the raw status for an unknown state', () => {
    render(<StateBadge state="unknown" latestStatus="Refunded" />);
    expect(screen.getByText('Refunded')).toBeInTheDocument();
  });
});
