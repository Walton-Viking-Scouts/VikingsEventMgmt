import React from 'react';
import RefreshButton from './RefreshButton.jsx';

function ErrorState({
  message,
  onRetry,
  showRetry = true,
  retryLabel = 'Try Again',
  retryLoading = false,
  icon = 'alert',
  className = '',
  children,
}) {
  const iconElements = {
    alert: (
      <svg className="w-12 h-12 text-scout-red mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    ),
    wifi: (
      <svg className="w-12 h-12 text-scout-red mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
      </svg>
    ),
    lock: (
      <svg className="w-12 h-12 text-scout-red mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    server: (
      <svg className="w-12 h-12 text-scout-red mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
      </svg>
    ),
  };

  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
      {iconElements[icon] || iconElements.alert}

      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Oops! Something went wrong
      </h3>

      <p className="text-gray-600 mb-6 max-w-md">
        {message || 'An unexpected error occurred. Please try again.'}
      </p>

      {children && (
        <div className="mb-4">
          {children}
        </div>
      )}

      {showRetry && onRetry && (
        <RefreshButton
          onRefresh={onRetry}
          loading={retryLoading}
          variant="primary"
        >
          {retryLabel}
        </RefreshButton>
      )}
    </div>
  );
}

function NetworkErrorState({ onRetry, retryLoading = false }) {
  return (
    <ErrorState
      message="Unable to connect to OSM. Check your internet connection and try again."
      onRetry={onRetry}
      retryLoading={retryLoading}
      icon="wifi"
      retryLabel="Check Connection"
    />
  );
}

function AuthErrorState({ onRetry, retryLoading = false }) {
  return (
    <ErrorState
      message="Your session has expired. Please log in again to continue."
      onRetry={onRetry}
      retryLoading={retryLoading}
      icon="lock"
      retryLabel="Log In Again"
    />
  );
}

function ServerErrorState({ onRetry, retryLoading = false }) {
  return (
    <ErrorState
      message="OSM server is having problems. Please try again in a few minutes."
      onRetry={onRetry}
      retryLoading={retryLoading}
      icon="server"
      retryLabel="Try Again"
    />
  );
}

function DataErrorState({ onRetry, retryLoading = false, dataType = 'data' }) {
  return (
    <ErrorState
      message={`Unable to load ${dataType}. Check your connection and try refreshing.`}
      onRetry={onRetry}
      retryLoading={retryLoading}
      icon="alert"
      retryLabel="Refresh Data"
    />
  );
}

ErrorState.Network = NetworkErrorState;
ErrorState.Auth = AuthErrorState;
ErrorState.Server = ServerErrorState;
ErrorState.Data = DataErrorState;

export default ErrorState;