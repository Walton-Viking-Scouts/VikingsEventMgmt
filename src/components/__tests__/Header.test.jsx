import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import DesktopHeader from '../desktop/DesktopHeader';
import { NotificationProvider } from '../../contexts/notifications/NotificationContext';

describe('Header', () => {
  it('renders with default props', () => {
    render(
      <NotificationProvider>
        <DesktopHeader data-oid="tfynk:r" />
      </NotificationProvider>,
    );
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('displays hardcoded title', () => {
    render(
      <NotificationProvider>
        <DesktopHeader data-oid="om.zc45" />
      </NotificationProvider>,
    );
    expect(
      screen.getByText('Viking Scouts (1st Walton on Thames)'),
    ).toBeInTheDocument();
  });
});
