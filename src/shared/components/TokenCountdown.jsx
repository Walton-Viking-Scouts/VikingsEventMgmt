import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

function TokenCountdown({ authState, className = '', compact = false }) {
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [displayText, setDisplayText] = useState('');

  useEffect(() => {
    if (authState !== 'authenticated') {
      setTimeRemaining(null);
      setDisplayText('');
      return;
    }

    const updateCountdown = () => {
      const expiresAt = sessionStorage.getItem('token_expires_at');
      if (!expiresAt) {
        setTimeRemaining(null);
        setDisplayText('');
        return;
      }

      const expirationTime = parseInt(expiresAt);
      const now = Date.now();
      const msRemaining = expirationTime - now;

      if (msRemaining <= 0) {
        setTimeRemaining(0);
        setDisplayText('Expired');
        return;
      }

      const minutesRemaining = Math.floor(msRemaining / (60 * 1000));
      const secondsRemaining = Math.floor((msRemaining % (60 * 1000)) / 1000);

      setTimeRemaining(msRemaining);

      if (minutesRemaining >= 60) {
        const hoursRemaining = Math.floor(minutesRemaining / 60);
        const remainingMinutes = minutesRemaining % 60;
        setDisplayText(`${hoursRemaining}h ${remainingMinutes}m`);
      } else if (minutesRemaining >= 1) {
        setDisplayText(`${minutesRemaining}m ${secondsRemaining}s`);
      } else {
        setDisplayText(`${secondsRemaining}s`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [authState]);

  if (authState !== 'authenticated' || !timeRemaining) {
    return null;
  }

  return (
    <div className={`${compact ? 'text-xs' : 'text-sm'} text-gray-600 ${className}`}>
      <span>
        {compact ? 'Session: ' : (
          <span className="hidden md:inline">Session: </span>
        )}
      </span>
      <span>{displayText}</span>
    </div>
  );
}

TokenCountdown.propTypes = {
  authState: PropTypes.oneOf([
    'no_data',
    'cached_only', 
    'authenticated',
    'token_expired',
    'syncing',
  ]).isRequired,
  className: PropTypes.string,
  compact: PropTypes.bool,
};

export default TokenCountdown;