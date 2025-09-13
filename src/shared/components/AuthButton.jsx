import React from 'react';

/**
 * AuthButton - Context-aware authentication button for header
 *
 * Displays different button text and behavior based on authentication state:
 * - No data: "Sign in to OSM"
 * - Has cached data: "Refresh data"
 * - Token expired: "Sign in to refresh"
 * - Syncing: "Syncing..." (disabled)
 *
 * @param {object} props - Component props
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

  const getButtonClasses = (variant, size) => {
    const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
    
    const sizeClasses = {
      xs: 'px-2 py-1 text-xs',
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
      xl: 'px-8 py-4 text-lg',
    };
    
    const variantClasses = {
      'scout-purple': 'bg-scout-purple text-white hover:bg-scout-purple-dark focus:ring-scout-purple-light active:bg-scout-purple-dark',
      'scout-blue': 'bg-scout-blue text-white hover:bg-scout-blue-dark focus:ring-scout-blue-light active:bg-scout-blue-dark',
      'outline': 'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-blue-300 active:bg-gray-100',
    };
    
    return `${baseClasses} ${sizeClasses[size] || sizeClasses.md} ${variantClasses[variant] || variantClasses['scout-blue']}`;
  };

  return (
    <button
      onClick={config.onClick}
      disabled={config.disabled}
      className={`${getButtonClasses(config.variant, size)} auth-button ${className}`}
      aria-label={config.ariaLabel}
      data-testid="auth-button"
      {...rest}
      data-oid="14si21j"
    >
      {config.text}
    </button>
  );
}

export default AuthButton;
