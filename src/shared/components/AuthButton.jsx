import React from 'react';
import { Button } from './ui';

/**
 * AuthButton - Context-aware authentication button for header
 *
 * Displays different button text and behavior based on authentication state:
 * - No data: "Sign in to OSM"
 * - Has cached data: "Refresh data"
 * - Token expired: "Sign in to refresh"
 * - Syncing: "Syncing..." (disabled)
 *
 * @param {Object} props - Component props
 * @param {string} props.authState - Current authentication state
 * @param {Function} props.onLogin - Login handler function
 * @param {Function} props.onRefresh - Refresh handler function
 * @param {boolean} props.isLoading - Whether sync is in progress
 * @param {boolean} props.isOfflineMode - Whether the app is in offline mode
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.size - Button size (xs, sm, md, lg, xl)
 */
function AuthButton({
  authState,
  onLogin,
  onRefresh,
  isLoading = false,
  isOfflineMode = false,
  className = '',
  size,
  ...rest
}) {
  const getButtonConfig = () => {
    if (isLoading) {
      return {
        text: 'Syncing...',
        onClick: null,
        disabled: true,
        variant: 'outline',
        ariaLabel: 'Currently syncing data with OSM',
      };
    }

    switch (authState) {
    case 'no_data':
      return {
        text: 'Sign in to OSM',
        onClick: onLogin,
        disabled: false,
        variant: 'scout-purple',
        ariaLabel: 'Sign in to Online Scout Manager to access data',
      };

    case 'cached_only':
      if (isOfflineMode) {
        return {
          text: 'Offline - Sign in to refresh',
          onClick: onLogin,
          disabled: false,
          variant: 'outline',
          ariaLabel: 'You are offline with cached data - sign in to refresh data from OSM',
        };
      }
      return {
        text: 'Sign in to refresh',
        onClick: onLogin, // Need to login first to get token for refresh
        disabled: false,
        variant: 'scout-purple',
        ariaLabel: 'Sign in to OSM to refresh data - currently using cached data',
      };

    case 'token_expired':
      return {
        text: 'Sign in to refresh',
        onClick: onLogin,
        disabled: false,
        variant: 'scout-purple',
        ariaLabel: 'Session expired - sign in again to refresh data',
      };

    case 'authenticated':
      return {
        text: 'Refresh',
        onClick: onRefresh || onLogin,
        disabled: false,
        variant: 'outline',
        ariaLabel: 'Refresh data from OSM',
      };

    case 'syncing':
      return {
        text: 'Syncing...',
        onClick: null,
        disabled: true,
        variant: 'outline',
        ariaLabel: 'Currently syncing data with OSM',
      };

    default:
      return {
        text: 'Sign in',
        onClick: onLogin,
        disabled: false,
        variant: 'scout-blue',
        ariaLabel: 'Sign in to Online Scout Manager',
      };
    }
  };

  const config = getButtonConfig();

  return (
    <Button
      variant={config.variant}
      onClick={config.onClick}
      disabled={config.disabled}
      size={size}
      className={`auth-button ${className}`}
      aria-label={config.ariaLabel}
      data-testid="auth-button"
      {...rest}
      data-oid="14si21j"
    >
      {config.text}
    </Button>
  );
}

export default AuthButton;
