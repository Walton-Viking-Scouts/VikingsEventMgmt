import React from 'react';

function TokenExpiredDialog({ 
  isOpen = false, 
  onRefresh = () => {}, 
  onLogout = () => {},
  onReLogin = null,
  onStayOffline = null,
  hasCachedData = false,
  message = "Your session has expired. Please refresh or log in again."
}) {
  if (!isOpen) return null;

  // Use new auth flow if handlers are provided
  const useNewAuthFlow = onReLogin && onStayOffline;
  
  // Enhanced message based on cached data availability
  const enhancedMessage = useNewAuthFlow 
    ? hasCachedData 
      ? "Your session has expired. You can continue working with cached data offline, or log in again to sync your latest changes."
      : "Your session has expired. Please log in again to continue."
    : message;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3 text-center">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Session Expired
          </h3>
          <div className="mt-2 px-7 py-3">
            <p className="text-sm text-gray-500">{enhancedMessage}</p>
          </div>
          <div className="flex space-x-4 px-4 py-3">
            {useNewAuthFlow ? (
              <>
                <button
                  onClick={onReLogin}
                  className="px-4 py-2 bg-scout-blue text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-scout-blue-dark focus:outline-none focus:ring-2 focus:ring-scout-blue"
                >
                  Log In Again
                </button>
                {hasCachedData && (
                  <button
                    onClick={onStayOffline}
                    className="px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    Work Offline
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={onRefresh}
                  className="px-4 py-2 bg-scout-blue text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-scout-blue-dark focus:outline-none focus:ring-2 focus:ring-scout-blue"
                >
                  Refresh
                </button>
                <button
                  onClick={onLogout}
                  className="px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Log Out
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