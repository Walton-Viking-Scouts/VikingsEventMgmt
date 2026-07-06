import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MemberAvatar from '../MemberAvatar';

describe('MemberAvatar', () => {
  it('renders an img with the constructed photo URL when photo_guid is present', () => {
    const member = { scoutid: 1234567, photo_guid: 'abc-guid', firstname: 'Jane', lastname: 'Doe' };
    render(<MemberAvatar member={member} />);

    const img = screen.getByRole('img', { name: /jane doe/i });
    expect(img.tagName).toBe('IMG');
    expect(img).toHaveAttribute(
      'src',
      'https://www.onlinescoutmanager.co.uk/sites/onlinescoutmanager.co.uk/public/member_photos/1234000/1234567/abc-guid/125x125_0.jpg',
    );
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('uses the 250x250 variant for size lg', () => {
    const member = { scoutid: 1234567, photo_guid: 'abc-guid', firstname: 'Jane', lastname: 'Doe' };
    render(<MemberAvatar member={member} size="lg" />);

    const img = screen.getByRole('img', { name: /jane doe/i });
    expect(img).toHaveAttribute('src', expect.stringContaining('250x250_0.jpg'));
  });

  it('renders initials fallback when photo_guid is missing', () => {
    const member = { scoutid: 1234567, photo_guid: null, firstname: 'Jane', lastname: 'Doe' };
    const { container } = render(<MemberAvatar member={member} />);

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('derives initials from a combined name field when firstname/lastname are absent', () => {
    const member = { scoutid: 1234567, photo_guid: null, name: 'Jane Doe' };
    render(<MemberAvatar member={member} />);

    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('falls back to initials when the image fails to load', () => {
    const member = { scoutid: 1234567, photo_guid: 'abc-guid', firstname: 'Jane', lastname: 'Doe' };
    const { container } = render(<MemberAvatar member={member} />);

    const img = screen.getByRole('img', { name: /jane doe/i });
    fireEvent.error(img);

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('applies the correct size classes for sm, md, and lg', () => {
    const member = { scoutid: 1234567, photo_guid: null, firstname: 'Jane', lastname: 'Doe' };

    const { rerender } = render(<MemberAvatar member={member} size="sm" />);
    expect(screen.getByText('JD')).toHaveClass('h-8', 'w-8');

    rerender(<MemberAvatar member={member} size="md" />);
    expect(screen.getByText('JD')).toHaveClass('h-12', 'w-12');

    rerender(<MemberAvatar member={member} size="lg" />);
    expect(screen.getByText('JD')).toHaveClass('h-24', 'w-24');
  });
});
