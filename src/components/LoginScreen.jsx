import React from 'react';
import * as Sentry from '@sentry/react';

function LoginScreen({ onLogin }) {
  const handleLoginClick = () => {
    // Create a span to measure login button performance
    Sentry.startSpan(
      {
        op: "ui.click",
        name: "Login Button Click",
      },
      (span) => {
        span.setAttribute("component", "LoginScreen");
        span.setAttribute("action", "login_initiated");
        
        onLogin();
      },
    );
  };

  return (
    <div className="login-container" data-testid="login-screen">
      <div className="login-card">
        <h1 className="login-title">Vikings Event Management</h1>
        <p className="text-muted mb-3">
          Please log in with your Online Scout Manager account to continue.
        </p>
        <button 
          className="login-btn"
          onClick={handleLoginClick}
          type="button"
          data-testid="login-button"
        >
          Login with Online Scout Manager (OSM)
        </button>
      </div>
    </div>
  );
}

export default LoginScreen;