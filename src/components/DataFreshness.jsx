import React from 'react';

/**
 * DataFreshness - Shows data age and sync status
 *
 * Displays contextual information about when data was last synced
 * with appropriate visual indicators for data staleness urgency
 */
function DataFreshness({ lastSync, authState, className = '' }) {
  const getDataAge = (timestamp) => {
    if (!timestamp) return null;

    const now = Date.now();
    
    // Convert timestamp to epoch milliseconds
    let syncTimeMs;
    if (typeof timestamp === 'string') {
      if (/^\d+$/.test(timestamp)) {
        // Epoch timestamp as string (standard format)
        syncTimeMs = parseInt(timestamp, 10);
      } else {
        // ISO string (legacy format) 
        syncTimeMs = new Date(timestamp).getTime();
      }
    } else if (typeof timestamp === 'number') {
      // Epoch timestamp as number
      syncTimeMs = timestamp;
    } else {
      // Date object or other
      syncTimeMs = new Date(timestamp).getTime();
    }
    
    if (Number.isNaN(syncTimeMs) || syncTimeMs <= 0) return null; // invalid timestamp
    
    // Sanity check: reject timestamps too far in the future (more than 1 day)
    if (syncTimeMs > now + 24 * 60 * 60 * 1000) {
      console.warn('DataFreshness: Timestamp is far in the future, ignoring:', new Date(syncTimeMs));
      return null;
    }
    
    const diffMs = Math.max(0, now - syncTimeMs);

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
    if (!timestamp) return 'unknown';

    const now = Date.now();
    
    // Convert timestamp to epoch milliseconds (same logic as getDataAge)
    let syncTimeMs;
    if (typeof timestamp === 'string') {
      if (/^\d+$/.test(timestamp)) {
        syncTimeMs = parseInt(timestamp, 10);
      } else {
        syncTimeMs = new Date(timestamp).getTime();
      }
    } else if (typeof timestamp === 'number') {
      syncTimeMs = timestamp;
    } else {
      syncTimeMs = new Date(timestamp).getTime();
    }
    
    if (Number.isNaN(syncTimeMs) || syncTimeMs <= 0) return 'unknown';
    
    // Sanity check: reject far future timestamps
    if (syncTimeMs > now + 24 * 60 * 60 * 1000) return 'unknown';
    
    const diffMs = Math.max(0, now - syncTimeMs);

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
    case 'no_data':
      return {
        text: age ? `Cached data from ${age}` : 'Sign in to get fresh data',
        className: 'text-gray-500',
      };

    case 'syncing':
      return {
        text: 'Syncing...',
        className: 'text-blue-600 animate-pulse',
      };

    case 'authenticated':
      return {
        text: age ? `Last synced: ${age}` : 'Recently synced',
        className: staleness === 'fresh' ? 'text-green-600' : 'text-blue-600',
      };

    case 'cached_only':
    case 'token_expired': {
      const urgencyClass =
          {
            fresh: 'text-yellow-600',
            moderate: 'text-orange-600',
            stale: 'text-red-600',
            'very-stale': 'text-red-700',
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
      className={`data-freshness text-sm ${info.className} ${className}`}
    >
      <span className="data-freshness-text hidden sm:inline">{info.text}</span>
      {/* Mobile: Show abbreviated text */}
      <span className="sm:hidden" title={info.text}>
        {info.text}
      </span>
    </div>
  );
}

export default DataFreshness;
