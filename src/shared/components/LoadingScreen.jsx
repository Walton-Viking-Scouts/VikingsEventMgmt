import React from 'react';

/**
 *
 * @param root0
 * @param root0.message
 */
function LoadingScreen({ message = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-scout-blue mx-auto"></div>
        <p className="mt-4 text-gray-600">{message}</p>
      </div>
    </div>
  );
}

export default LoadingScreen;