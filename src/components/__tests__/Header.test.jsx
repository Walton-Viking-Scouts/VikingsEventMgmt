import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Header from '../Header';
import { NotificationProvider } from '../../contexts/notifications/NotificationContext';

describe('Header', () => {
  it('renders with default props', () => {
    render(
      <NotificationProvider>
        <Header data-oid="tfynk:r" />
      </NotificationProvider>,
    );
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('displays hardcoded title', () => {
    render(
      <NotificationProvider>
        <Header data-oid="om.zc45" />
      </NotificationProvider>,
    );
    expect(
      screen.getByText('Viking Scouts (1st Walton on Thames)'),
    ).toBeInTheDocument();
  });
});
