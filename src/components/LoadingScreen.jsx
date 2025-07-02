import React from 'react';

function LoadingScreen({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-8 h-8 border-4 border-scout-blue border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-gray-600 text-center">{message}</p>
    </div>
  );
}

export default LoadingScreen;
