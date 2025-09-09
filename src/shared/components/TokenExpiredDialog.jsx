import React, { useState, useEffect, useRef } from 'react';

function TokenExpiredDialog({ 
  isOpen = false, 
  onRefresh = () => {}, 
  onLogout = () => {},
  onReLogin = null,
  onStayOffline = null,
  hasCachedData = false,
  message = 'Your session has expired. Please refresh or log in again.',
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState('');
  const dialogRef = useRef(null);

  // Focus management for accessibility
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Use new auth flow if handlers are provided
  const useNewAuthFlow = onReLogin && onStayOffline;
  
  // Enhanced message based on cached data availability
  const enhancedMessage = useNewAuthFlow 
    ? hasCachedData 
      ? 'Your session has expired. You can continue working with cached data offline, or log in again to sync your latest changes.'
      : 'Your session has expired. Please log in again to continue.'
    : message;

  const handleAction = async (action, actionName) => {
    setIsLoading(true);
    setLoadingAction(actionName);
    
    try {
      await action();
    } catch (error) {
      console.error(`Error during ${actionName}:`, error);
    } finally {
      setIsLoading(false);
      setLoadingAction('');
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="token-expired-title"
      aria-describedby="token-expired-description"
    >
      <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        <div className="mt-3 text-center">
          <h3 
            id="token-expired-title"
            className="text-lg leading-6 font-medium text-gray-900"
            ref={dialogRef}
            tabIndex={-1}
          >
            Session Expired
          </h3>
          <div className="mt-2 px-4 py-3">
            <p id="token-expired-description" className="text-sm text-gray-500">
              {enhancedMessage}
            </p>
          </div>
          <div className="flex flex-col space-y-3 px-4 py-3 sm:flex-row sm:space-y-0 sm:space-x-3">
            {useNewAuthFlow ? (
              <>
                <button
                  onClick={() => handleAction(onReLogin, 'login')}
                  disabled={isLoading}
                  className="px-4 py-2 bg-scout-blue text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-scout-blue-dark focus:outline-none focus:ring-2 focus:ring-scout-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  aria-describedby={isLoading && loadingAction === 'login' ? 'login-loading' : undefined}
                >
                  {isLoading && loadingAction === 'login' ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Logging in...
                      <span id="login-loading" className="sr-only">Loading, please wait</span>
                    </span>
                  ) : (
                    'Log In Again'
                  )}
                </button>
                {hasCachedData && (
                  <button
                    onClick={() => handleAction(onStayOffline, 'offline')}
                    disabled={isLoading}
                    className="px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                    aria-describedby={isLoading && loadingAction === 'offline' ? 'offline-loading' : undefined}
                  >
                    {isLoading && loadingAction === 'offline' ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Switching...
                        <span id="offline-loading" className="sr-only">Loading, please wait</span>
                      </span>
                    ) : (
                      'Work Offline'
                    )}
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={() => handleAction(onRefresh, 'refresh')}
                  disabled={isLoading}
                  className="px-4 py-2 bg-scout-blue text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-scout-blue-dark focus:outline-none focus:ring-2 focus:ring-scout-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  aria-describedby={isLoading && loadingAction === 'refresh' ? 'refresh-loading' : undefined}
                >
                  {isLoading && loadingAction === 'refresh' ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Refreshing...
                      <span id="refresh-loading" className="sr-only">Loading, please wait</span>
                    </span>
                  ) : (
                    'Refresh'
                  )}
                </button>
                <button
                  onClick={() => handleAction(onLogout, 'logout')}
                  disabled={isLoading}
                  className="px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  aria-describedby={isLoading && loadingAction === 'logout' ? 'logout-loading' : undefined}
                >
                  {isLoading && loadingAction === 'logout' ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Logging out...
                      <span id="logout-loading" className="sr-only">Loading, please wait</span>
                    </span>
                  ) : (
                    'Log Out'
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TokenExpiredDialog;