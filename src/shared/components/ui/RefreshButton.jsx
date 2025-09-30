import React, { useState } from 'react';
import { handleScoutError } from '../../utils/scoutErrorHandler.js';

function RefreshButton({
  onRefresh,
  loading = false,
  className = '',
  size = 'default',
  variant = 'primary',
  children,
  showErrorNotification = true,
}) {
  const [hasError, setHasError] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  const sizeClasses = {
    small: 'px-3 py-1.5 text-sm',
    default: 'px-4 py-2 text-sm',
    large: 'px-6 py-3 text-base',
  };

  const variantClasses = {
    primary: 'bg-scout-blue text-white hover:bg-scout-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-scout-blue-light',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300',
    success: 'bg-scout-green text-white hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500',
    error: 'bg-scout-red text-white hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500',
  };

  // Use error variant if there was an error
  const currentVariant = hasError ? 'error' : variant;
  const combinedClasses = `${baseClasses} ${sizeClasses[size]} ${variantClasses[currentVariant]} ${className}`;

  const handleClick = async () => {
    if (loading || isPending || !onRefresh) return;

    try {
      setIsPending(true);
      setHasError(false);
      await onRefresh();
    } catch (error) {
      setHasError(true);
      if (showErrorNotification) {
        handleScoutError(error, 'refresh data');
      }
    } finally {
      setIsPending(false);
    }
  };

  const getIcon = () => {
    if (loading || isPending) {
      return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>;
    }

    if (hasError) {
      return (
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      );
    }

    return (
      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    );
  };

  const getText = () => {
    if (loading || isPending) return 'Refreshing...';
    if (hasError) return 'Try Again';
    return 'Refresh Data';
  };

  const defaultContent = (
    <>
      {getIcon()}
      {getText()}
    </>
  );

  return (
    <button
      onClick={handleClick}
      disabled={loading || isPending}
      className={combinedClasses}
      type="button"
      title={hasError ? 'An error occurred. Click to try again.' : undefined}
    >
      {children || defaultContent}
    </button>
  );
}

export default RefreshButton;