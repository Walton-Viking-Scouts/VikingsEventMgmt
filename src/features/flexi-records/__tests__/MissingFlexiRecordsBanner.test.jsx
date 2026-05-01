import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../hooks/useMissingFlexiRecords.js', () => ({
  default: vi.fn(),
}));

vi.mock('../components/CreateMissingFlexiModal', () => ({
  default: () => <div data-testid="create-modal" />,
}));

import useMissingFlexiRecords from '../hooks/useMissingFlexiRecords.js';
import MissingFlexiRecordsBanner from '../components/MissingFlexiRecordsBanner';

const someGap = {
  section: { sectionid: 1, sectionname: 'Beavers' },
  termId: 'T1',
  missingRecords: [
    { template: { name: 'Viking Section Movers', fields: [] }, reason: 'absent', missingFields: [] },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('MissingFlexiRecordsBanner', () => {
  it('renders nothing when token_expired is true', () => {
    localStorage.setItem('token_expired', 'true');
    useMissingFlexiRecords.mockReturnValue({ loading: false, missing: [someGap], refresh: vi.fn() });
    const { container } = render(<MissingFlexiRecordsBanner sections={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when nothing is missing', () => {
    useMissingFlexiRecords.mockReturnValue({ loading: false, missing: [], refresh: vi.fn() });
    const { container } = render(<MissingFlexiRecordsBanner sections={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a warning alert with a CTA when records are missing', () => {
    useMissingFlexiRecords.mockReturnValue({ loading: false, missing: [someGap], refresh: vi.fn() });
    render(<MissingFlexiRecordsBanner sections={[]} />);
    expect(screen.getByText(/FlexiRecords need to be set up/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /review and create/i })).toBeInTheDocument();
  });

  it('renders nothing while loading', () => {
    useMissingFlexiRecords.mockReturnValue({ loading: true, missing: [], refresh: vi.fn() });
    const { container } = render(<MissingFlexiRecordsBanner sections={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
