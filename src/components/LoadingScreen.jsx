import React from 'react';

function LoadingScreen({ message = 'Loading...' }) {
  return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p>{message}</p>
    </div>
  );
}

export default LoadingScreen;
