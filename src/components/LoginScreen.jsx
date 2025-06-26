import React from 'react';

function LoginScreen({ onLogin }) {
  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">Vikings Event Management</h1>
        <p className="text-muted mb-3">
          Please log in with your Online Scout Manager account to continue.
        </p>
        <button 
          className="login-btn"
          onClick={onLogin}
          type="button"
        >
          Login with Online Scout Manager (OSM)
        </button>
      </div>
    </div>
  );
}

export default LoginScreen;