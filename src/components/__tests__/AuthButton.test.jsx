import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AuthButton from '../AuthButton.jsx';

describe('AuthButton', () => {
  const mockOnLogin = vi.fn();
  const mockOnRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Sign in to OSM" when authState is no_data', () => {
    render(
      <AuthButton
        authState="no_data"
        onLogin={mockOnLogin}
        onRefresh={mockOnRefresh}
      />,
    );

    expect(screen.getByText('Sign in to OSM')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Sign in to Online Scout Manager to access data');
  });

  it('shows "Refresh data" when authState is cached_only', () => {
    render(
      <AuthButton
        authState="cached_only"
        onLogin={mockOnLogin}
        onRefresh={mockOnRefresh}
      />,
    );

    expect(screen.getByText('Refresh data')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Refresh data from OSM - currently using cached data');
  });

  it('shows "Sign in to refresh" when authState is token_expired', () => {
    render(
      <AuthButton
        authState="token_expired"
        onLogin={mockOnLogin}
        onRefresh={mockOnRefresh}
      />,
    );

    expect(screen.getByText('Sign in to refresh')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Session expired - sign in again to refresh data');
  });

  it('shows "Refresh" when authState is authenticated', () => {
    render(
      <AuthButton
        authState="authenticated"
        onLogin={mockOnLogin}
        onRefresh={mockOnRefresh}
      />,
    );

    expect(screen.getByText('Refresh')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Refresh data from OSM');
  });

  it('shows "Syncing..." when isLoading is true', () => {
    render(
      <AuthButton
        authState="authenticated"
        onLogin={mockOnLogin}
        onRefresh={mockOnRefresh}
        isLoading={true}
      />,
    );

    expect(screen.getByText('Syncing...')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Currently syncing data with OSM');
  });
});