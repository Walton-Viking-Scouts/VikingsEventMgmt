import React from 'react';
import { parseTimestamp } from '../utils/asyncUtils.js';

// Auth state constants
const AUTH_STATES = {
  NO_DATA: 'no_data',
  SYNCING: 'syncing',
  AUTHENTICATED: 'authenticated',
  CACHED_ONLY: 'cached_only',
  TOKEN_EXPIRED: 'token_expired',
};

// Staleness color mapping
const STALENESS_COLOURS = {
  fresh: 'text-yellow-600',
  moderate: 'text-orange-600',
  stale: 'text-red-600',
  'very-stale': 'text-red-700',
};

/**
 * DataFreshness - Shows data age and sync status
 *
 * Displays contextual information about when data was last synced
 * with appropriate visual indicators for data staleness urgency
 */
function DataFreshness({ lastSync, authState, className = '', compact = false }) {
  const getDataAge = (timestamp) => {
    const syncTimeMs = parseTimestamp(timestamp);
    if (!syncTimeMs) return null;

    const diffMs = Math.max(0, Date.now() - syncTimeMs);

    const minutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const months = Math.floor(days / 30);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    return `${months}mo ago`;
  };

  const getStalenessLevel = (timestamp) => {
    const syncTimeMs = parseTimestamp(timestamp);
    if (!syncTimeMs) return 'unknown';

    const diffMs = Math.max(0, Date.now() - syncTimeMs);

    // Different staleness thresholds based on our design
    const HOUR = 60 * 60 * 1000;
    const DAY = 24 * HOUR;
    const WEEK = 7 * DAY;

    if (diffMs < HOUR) return 'fresh'; // < 1 hour
    if (diffMs < 4 * HOUR) return 'moderate'; // < 4 hours
    if (diffMs < DAY) return 'stale'; // < 1 day
    if (diffMs < WEEK) return 'very-stale'; // < 1 week
    return 'ancient'; // > 1 week
  };

  const getDisplayInfo = () => {
    const age = getDataAge(lastSync);
    const staleness = getStalenessLevel(lastSync);

    switch (authState) {
    case AUTH_STATES.NO_DATA:
      return {
        text: age ? `Cached data from ${age}` : 'Sign in to get fresh data',
        className: 'text-gray-500',
      };

    case AUTH_STATES.SYNCING:
      return {
        text: 'Syncing...',
        className: 'text-blue-600 animate-pulse',
      };

    case AUTH_STATES.AUTHENTICATED:
      return {
        text: age ? `Last synced: ${age}` : 'Recently synced',
        className: staleness === 'fresh' ? 'text-green-600' : 'text-blue-600',
      };

    case AUTH_STATES.CACHED_ONLY:
    case AUTH_STATES.TOKEN_EXPIRED: {
      const urgencyClass =
          {
            ...STALENESS_COLOURS,
            ancient: 'text-red-900',
          }[staleness] || 'text-gray-600';

      return {
        text: age ? `Cached data from ${age}` : 'Using cached data',
        className: urgencyClass,
      };
    }

    default:
      return {
        text: 'Unknown status',
        className: 'text-gray-500',
      };
    }
  };

  const info = getDisplayInfo();

  // Don't render anything if there's no meaningful info to show
  if (!info.text) return null;

  return (
    <div
      className={`data-freshness ${compact ? 'text-xs' : 'text-sm'} ${info.className} ${className}`}
      data-oid="q3i0cxc"
    >
      <span
        className="data-freshness-text"
        title={info.text}
        data-oid="p7xyb7w"
      >
        {compact ? info.text.replace('Last synced: ', 'Synced: ').replace('Cached data from ', 'Cached: ') : info.text}
      </span>
    </div>
  );
}

export default DataFreshness;
