import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * Component that displays remaining time until token expires
 * Shows different colors based on remaining time:
 * - Green: > 15 minutes
 * - Yellow: 5-15 minutes
 * - Red: < 5 minutes
 */
function TokenCountdown({ authState, className = '' }) {
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [displayText, setDisplayText] = useState('');

  useEffect(() => {
    // Only show countdown when authenticated
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

      // Format display text based on time remaining
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

    // Update immediately
    updateCountdown();

    // Set up interval to update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [authState]);

  // Don't render anything if not authenticated or no time data
  if (authState !== 'authenticated' || !timeRemaining) {
    return null;
  }

  return (
    <div className={`text-sm text-gray-600 ${className}`} data-oid="ni8li1n">
      <span className="hidden md:inline" data-oid="a-eblja">
        Session:{' '}
      </span>
      <span data-oid="z2xm505">{displayText}</span>
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
};

export default TokenCountdown;
