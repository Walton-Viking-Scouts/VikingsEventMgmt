import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Header from '../Header';

describe('Header', () => {
  it('renders with default props', () => {
    render(<Header />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('displays hardcoded title', () => {
    render(<Header />);
    expect(screen.getByText('Viking Scouts (1st Walton on Thames)')).toBeInTheDocument();
  });
});
