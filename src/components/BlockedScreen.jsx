import React from 'react';

function BlockedScreen() {
  return (
    <div className="main-content">
      <div className="blocked-container">
        <h1>🚨 Access Blocked</h1>
        <p className="mt-3">
          OSM API access has been blocked due to rate limiting or other restrictions. 
          Please contact the system administrator or try again later.
        </p>
        <button 
          className="btn btn-primary mt-3"
          onClick={() => window.location.reload()}
          type="button"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

export default BlockedScreen;