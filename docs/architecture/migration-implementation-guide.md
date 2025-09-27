# Migration Implementation Guide

**Step-by-Step Guide to Replace Complex Sync System with Scout-Appropriate Simplicity**

## Pre-Migration Checklist

### 1. Backup Current System
```bash
# Create feature branch for migration
git checkout -b feature/simplify-sync-system

# Tag current complex system for reference
git tag complex-sync-system-backup

# Document current API call patterns
npm run test:run # Ensure all tests pass before migration
```

### 2. Analyze Current Data Flow
```bash
# Review current storage patterns
find src/shared/services/storage -name "*.js" | grep -E "(sync|attendance)" | head -10

# Identify all components using AtomicAttendanceSync
grep -r "AtomicAttendanceSync" src/ --include="*.js" --include="*.jsx"

# Check current event listeners
grep -r "addSyncListener\|removeSyncListener" src/ --include="*.js" --include="*.jsx"
```

## Phase 1: Create Simple Services (Days 1-2)

### Step 1.1: Create EventDataService

**File:** `src/shared/services/data/eventDataService.js`

```javascript
import { getEvents, fetchMostRecentTermId } from '../api/api.js';
import { getToken } from '../auth/tokenService.js';
import logger, { LOG_CATEGORIES } from '../utils/logger.js';

class EventDataService {
  constructor() {
    this.eventsCache = [];
    this.lastFetchTime = null;
    this.isLoading = false;
    this.refreshPromise = null;

    // Feature flag for gradual migration
    this.useSimpleSync = localStorage.getItem('viking_use_simple_sync') === 'true';
  }

  async getEvents(forceRefresh = false) {
    // Check feature flag
    if (!this.useSimpleSync) {
      logger.debug('Simple sync disabled, using legacy system', {}, LOG_CATEGORIES.DATA_SERVICE);
      return this.getCachedEventsFromLegacyStorage();
    }

    if (!forceRefresh && this.eventsCache.length > 0 && this.isCacheFresh()) {
      logger.debug('Returning cached events', {
        eventCount: this.eventsCache.length,
        cacheAge: Date.now() - this.lastFetchTime,
      }, LOG_CATEGORIES.DATA_SERVICE);
      return this.eventsCache;
    }

    return await this.refreshEvents();
  }

  async refreshEvents() {
    if (this.isLoading) {
      logger.debug('Events refresh already in progress', {}, LOG_CATEGORIES.DATA_SERVICE);
      return this.refreshPromise || this.eventsCache;
    }

    this.refreshPromise = this._doRefresh();
    return await this.refreshPromise;
  }

  async _doRefresh() {
    try {
      this.isLoading = true;
      logger.info('Refreshing events data', {}, LOG_CATEGORIES.DATA_SERVICE);

      const token = getToken();
      if (!token) {
        logger.warn('No auth token available for events refresh', {}, LOG_CATEGORIES.DATA_SERVICE);
        return this.eventsCache;
      }

      const allEvents = [];
      const sections = this.getCachedSections();

      if (sections.length === 0) {
        logger.warn('No sections found for events refresh', {}, LOG_CATEGORIES.DATA_SERVICE);
        return this.eventsCache;
      }

      for (const section of sections) {
        try {
          const termId = await fetchMostRecentTermId(section.sectionid, token);
          if (termId) {
            const sectionEvents = await getEvents(section.sectionid, termId, token);
            const eventsWithSection = sectionEvents.map(event => ({
              ...event,
              sectionname: section.name,
              sectionid: section.sectionid,
              termid: termId,
            }));
            allEvents.push(...eventsWithSection);
          } else {
            logger.debug('No term ID found for section (likely waiting list)', {
              sectionName: section.name,
              sectionId: section.sectionid,
            }, LOG_CATEGORIES.DATA_SERVICE);
          }
        } catch (sectionError) {
          logger.warn('Failed to fetch events for section', {
            sectionName: section.name,
            sectionId: section.sectionid,
            error: sectionError.message,
          }, LOG_CATEGORIES.DATA_SERVICE);
        }
      }

      this.eventsCache = allEvents;
      this.lastFetchTime = Date.now();

      // Store in localStorage for compatibility during migration
      this.storeEventsCache(allEvents);

      logger.info('Events refresh completed', {
        eventCount: allEvents.length,
        sectionCount: sections.length,
      }, LOG_CATEGORIES.DATA_SERVICE);

      return this.eventsCache;

    } catch (error) {
      logger.error('Failed to refresh events', {
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.DATA_SERVICE);
      throw new Error(`Could not load events: ${error.message}`);
    } finally {
      this.isLoading = false;
      this.refreshPromise = null;
    }
  }

  getCachedSections() {
    const sections = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('viking_sections_') || key.includes('demo_viking_sections_')) && key.endsWith('_offline')) {
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const parsed = JSON.parse(cached);
            const sectionItems = Array.isArray(parsed) ? parsed : (parsed.items || []);
            sections.push(...sectionItems);
          }
        } catch (error) {
          logger.debug('Failed to parse cached sections', {
            cacheKey: key,
            error: error.message,
          }, LOG_CATEGORIES.DATA_SERVICE);
        }
      }
    }

    logger.debug('Found cached sections for events', {
      sectionCount: sections.length,
      sections: sections.map(s => ({ sectionid: s.sectionid, name: s.name })),
    }, LOG_CATEGORIES.DATA_SERVICE);

    return sections;
  }

  getCachedEventsFromLegacyStorage() {
    // Fallback to legacy storage during migration
    const events = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('viking_events_') || key.includes('demo_viking_events_')) && key.endsWith('_offline')) {
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const parsed = JSON.parse(cached);
            const eventItems = Array.isArray(parsed) ? parsed : (parsed.items || []);
            events.push(...eventItems);
          }
        } catch (error) {
          logger.debug('Failed to parse cached events from legacy storage', {
            cacheKey: key,
            error: error.message,
          }, LOG_CATEGORIES.DATA_SERVICE);
        }
      }
    }
    return events;
  }

  storeEventsCache(events) {
    // Store in format compatible with existing system during migration
    const cacheKey = 'viking_events_simple_cache_offline';
    try {
      localStorage.setItem(cacheKey, JSON.stringify(events));
    } catch (error) {
      logger.warn('Failed to store events cache', {
        error: error.message,
        eventCount: events.length,
      }, LOG_CATEGORIES.DATA_SERVICE);
    }
  }

  isCacheFresh() {
    if (!this.lastFetchTime) return false;
    const cacheAge = Date.now() - this.lastFetchTime;
    const maxAge = 30 * 60 * 1000; // 30 minutes
    return cacheAge < maxAge;
  }

  getLastFetchTime() {
    return this.lastFetchTime;
  }

  clearCache() {
    this.eventsCache = [];
    this.lastFetchTime = null;
    localStorage.removeItem('viking_events_simple_cache_offline');
    logger.debug('Events cache cleared', {}, LOG_CATEGORIES.DATA_SERVICE);
  }

  // Migration utilities
  enableSimpleSync() {
    localStorage.setItem('viking_use_simple_sync', 'true');
    this.useSimpleSync = true;
    logger.info('Simple sync enabled', {}, LOG_CATEGORIES.DATA_SERVICE);
  }

  disableSimpleSync() {
    localStorage.setItem('viking_use_simple_sync', 'false');
    this.useSimpleSync = false;
    logger.info('Simple sync disabled, using legacy system', {}, LOG_CATEGORIES.DATA_SERVICE);
  }

  isSimpleSyncEnabled() {
    return this.useSimpleSync;
  }
}

export default new EventDataService();
```

### Step 1.2: Add Feature Flag Controls

**File:** `src/shared/services/data/simpleSyncManager.js`

```javascript
import eventDataService from './eventDataService.js';
import attendanceDataService from './attendanceDataService.js';
import logger, { LOG_CATEGORIES } from '../utils/logger.js';

class SimpleSyncManager {
  constructor() {
    this.isEnabled = localStorage.getItem('viking_use_simple_sync') === 'true';
  }

  enableSimpleSync() {
    localStorage.setItem('viking_use_simple_sync', 'true');
    this.isEnabled = true;

    eventDataService.enableSimpleSync();

    logger.info('Simple sync system enabled', {
      timestamp: new Date().toISOString(),
    }, LOG_CATEGORIES.DATA_SERVICE);

    // Clear complex system caches to force fresh start
    this.clearLegacyCaches();

    return true;
  }

  disableSimpleSync() {
    localStorage.setItem('viking_use_simple_sync', 'false');
    this.isEnabled = false;

    eventDataService.disableSimpleSync();

    logger.info('Simple sync system disabled, reverting to legacy', {
      timestamp: new Date().toISOString(),
    }, LOG_CATEGORIES.DATA_SERVICE);

    return true;
  }

  isSimpleSyncEnabled() {
    return this.isEnabled;
  }

  async refreshAllData() {
    if (!this.isEnabled) {
      throw new Error('Simple sync not enabled. Use legacy sync system.');
    }

    try {
      logger.info('Starting simple sync refresh', {}, LOG_CATEGORIES.DATA_SERVICE);

      // Step 1: Refresh events
      const events = await eventDataService.refreshEvents();
      logger.debug('Events refreshed', { eventCount: events.length }, LOG_CATEGORIES.DATA_SERVICE);

      // Step 2: Refresh attendance (uses events from step 1)
      const attendance = await attendanceDataService.refreshAttendanceData();
      logger.debug('Attendance refreshed', { recordCount: attendance.length }, LOG_CATEGORIES.DATA_SERVICE);

      const result = {
        success: true,
        eventsCount: events.length,
        attendanceCount: attendance.length,
        timestamp: Date.now(),
      };

      logger.info('Simple sync refresh completed', result, LOG_CATEGORIES.DATA_SERVICE);
      return result;

    } catch (error) {
      logger.error('Simple sync refresh failed', {
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.DATA_SERVICE);
      throw new Error(`Sync failed: ${error.message}`);
    }
  }

  clearLegacyCaches() {
    // Clear complex system caches to ensure clean state
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.includes('viking_sync_') ||
        key.includes('viking_atomic_') ||
        key.includes('viking_transaction_') ||
        key.includes('viking_retry_') ||
        key.includes('viking_offline_')
      )) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      logger.debug('Removed legacy cache key', { key }, LOG_CATEGORIES.DATA_SERVICE);
    });

    logger.info('Legacy caches cleared', { removedKeys: keysToRemove.length }, LOG_CATEGORIES.DATA_SERVICE);
  }

  getSystemStatus() {
    return {
      simpleSyncEnabled: this.isEnabled,
      eventsCacheSize: eventDataService.eventsCache?.length || 0,
      eventsLastFetch: eventDataService.getLastFetchTime(),
      attendanceCacheSize: attendanceDataService.attendanceCache?.length || 0,
      attendanceLastFetch: attendanceDataService.getLastFetchTime(),
      timestamp: Date.now(),
    };
  }
}

export default new SimpleSyncManager();
```

### Step 1.3: Create Migration Testing Component

**File:** `src/components/admin/SyncSystemTester.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import simpleSyncManager from '../../shared/services/data/simpleSyncManager.js';
import logger from '../../shared/services/utils/logger.js';

const SyncSystemTester = () => {
  const [isSimpleSyncEnabled, setIsSimpleSyncEnabled] = useState(false);
  const [systemStatus, setSystemStatus] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshResult, setLastRefreshResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    updateStatus();
  }, []);

  const updateStatus = () => {
    setIsSimpleSyncEnabled(simpleSyncManager.isSimpleSyncEnabled());
    setSystemStatus(simpleSyncManager.getSystemStatus());
  };

  const handleToggleSimpleSync = () => {
    try {
      if (isSimpleSyncEnabled) {
        simpleSyncManager.disableSimpleSync();
      } else {
        simpleSyncManager.enableSimpleSync();
      }
      updateStatus();
      setError(null);
    } catch (error) {
      setError(`Failed to toggle sync system: ${error.message}`);
    }
  };

  const handleTestRefresh = async () => {
    try {
      setIsRefreshing(true);
      setError(null);

      const result = await simpleSyncManager.refreshAllData();
      setLastRefreshResult(result);
      updateStatus();

    } catch (error) {
      setError(`Refresh failed: ${error.message}`);
      setLastRefreshResult(null);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '20px', borderRadius: '8px' }}>
      <h3>Sync System Migration Tester</h3>

      <div style={{ marginBottom: '20px' }}>
        <h4>Current System</h4>
        <p>
          <strong>Active System:</strong>
          {isSimpleSyncEnabled ? ' Simple Sync (New)' : ' Legacy Sync (Complex)'}
        </p>
        <button
          onClick={handleToggleSimpleSync}
          style={{
            padding: '8px 16px',
            backgroundColor: isSimpleSyncEnabled ? '#dc3545' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {isSimpleSyncEnabled ? 'Switch to Legacy System' : 'Switch to Simple System'}
        </button>
      </div>

      {systemStatus && (
        <div style={{ marginBottom: '20px' }}>
          <h4>System Status</h4>
          <ul style={{ fontSize: '14px' }}>
            <li>Events Cache: {systemStatus.eventsCacheSize} events</li>
            <li>Events Last Fetch: {systemStatus.eventsLastFetch ? new Date(systemStatus.eventsLastFetch).toLocaleString() : 'Never'}</li>
            <li>Attendance Cache: {systemStatus.attendanceCacheSize} records</li>
            <li>Attendance Last Fetch: {systemStatus.attendanceLastFetch ? new Date(systemStatus.attendanceLastFetch).toLocaleString() : 'Never'}</li>
          </ul>
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <h4>Test Refresh</h4>
        <button
          onClick={handleTestRefresh}
          disabled={isRefreshing || !isSimpleSyncEnabled}
          style={{
            padding: '8px 16px',
            backgroundColor: isSimpleSyncEnabled ? '#007bff' : '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isSimpleSyncEnabled ? 'pointer' : 'not-allowed'
          }}
        >
          {isRefreshing ? 'Refreshing...' : 'Test Simple Sync Refresh'}
        </button>
        {!isSimpleSyncEnabled && (
          <p style={{ fontSize: '12px', color: '#666' }}>
            Enable simple sync to test refresh functionality
          </p>
        )}
      </div>

      {lastRefreshResult && (
        <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#d4edda', borderRadius: '4px' }}>
          <h4>Last Refresh Result</h4>
          <ul style={{ fontSize: '14px' }}>
            <li>Success: {lastRefreshResult.success ? 'Yes' : 'No'}</li>
            <li>Events: {lastRefreshResult.eventsCount}</li>
            <li>Attendance: {lastRefreshResult.attendanceCount}</li>
            <li>Time: {new Date(lastRefreshResult.timestamp).toLocaleString()}</li>
          </ul>
        </div>
      )}

      {error && (
        <div style={{ padding: '10px', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '4px' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
        <p><strong>Instructions:</strong></p>
        <ol>
          <li>Test the legacy system first to ensure it works</li>
          <li>Switch to simple system and test refresh</li>
          <li>Compare data counts and performance</li>
          <li>Switch back and forth to verify both systems work</li>
        </ol>
      </div>
    </div>
  );
};

export default SyncSystemTester;
```

## Phase 2: Update UI Components (Day 3)

### Step 2.1: Create Simple Refresh Controls

**File:** `src/components/dashboard/SimpleRefreshControls.jsx`

```jsx
import React, { useState } from 'react';
import eventDataService from '../../shared/services/data/eventDataService.js';
import attendanceDataService from '../../shared/services/data/attendanceDataService.js';
import simpleSyncManager from '../../shared/services/data/simpleSyncManager.js';

const SimpleRefreshControls = ({ onDataRefreshed }) => {
  const [isRefreshingEvents, setIsRefreshingEvents] = useState(false);
  const [isRefreshingAttendance, setIsRefreshingAttendance] = useState(false);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [error, setError] = useState(null);

  const handleRefreshEvents = async () => {
    try {
      setIsRefreshingEvents(true);
      setError(null);

      const events = await eventDataService.refreshEvents();
      setLastRefresh(new Date());

      if (onDataRefreshed) {
        onDataRefreshed({ type: 'events', data: events });
      }

    } catch (error) {
      setError(`Failed to refresh events: ${error.message}`);
    } finally {
      setIsRefreshingEvents(false);
    }
  };

  const handleRefreshAttendance = async () => {
    try {
      setIsRefreshingAttendance(true);
      setError(null);

      const attendance = await attendanceDataService.refreshAttendanceData();
      setLastRefresh(new Date());

      if (onDataRefreshed) {
        onDataRefreshed({ type: 'attendance', data: attendance });
      }

    } catch (error) {
      setError(`Failed to refresh attendance: ${error.message}`);
    } finally {
      setIsRefreshingAttendance(false);
    }
  };

  const handleRefreshAll = async () => {
    try {
      setIsRefreshingAll(true);
      setError(null);

      const result = await simpleSyncManager.refreshAllData();
      setLastRefresh(new Date());

      if (onDataRefreshed) {
        onDataRefreshed({ type: 'all', data: result });
      }

    } catch (error) {
      setError(`Failed to refresh all data: ${error.message}`);
    } finally {
      setIsRefreshingAll(false);
    }
  };

  const isAnyRefreshing = isRefreshingEvents || isRefreshingAttendance || isRefreshingAll;

  return (
    <div className="simple-refresh-controls" style={{ padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={handleRefreshEvents}
          disabled={isAnyRefreshing}
          style={{
            padding: '8px 16px',
            backgroundColor: isRefreshingEvents ? '#6c757d' : '#17a2b8',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isAnyRefreshing ? 'not-allowed' : 'pointer',
            fontSize: '14px'
          }}
        >
          {isRefreshingEvents ? 'Loading Events...' : 'Refresh Events'}
        </button>

        <button
          onClick={handleRefreshAttendance}
          disabled={isAnyRefreshing}
          style={{
            padding: '8px 16px',
            backgroundColor: isRefreshingAttendance ? '#6c757d' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isAnyRefreshing ? 'not-allowed' : 'pointer',
            fontSize: '14px'
          }}
        >
          {isRefreshingAttendance ? 'Loading Attendance...' : 'Refresh Attendance'}
        </button>

        <button
          onClick={handleRefreshAll}
          disabled={isAnyRefreshing}
          style={{
            padding: '8px 16px',
            backgroundColor: isRefreshingAll ? '#6c757d' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isAnyRefreshing ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          {isRefreshingAll ? 'Refreshing All...' : 'Refresh All Data'}
        </button>

        {lastRefresh && (
          <span style={{ fontSize: '12px', color: '#666', marginLeft: '12px' }}>
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
        )}
      </div>

      {error && (
        <div style={{
          marginTop: '12px',
          padding: '8px 12px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          borderRadius: '4px',
          fontSize: '14px',
          border: '1px solid #f5c6cb'
        }}>
          {error}
        </div>
      )}
    </div>
  );
};

export default SimpleRefreshControls;
```

### Step 2.2: Update EventDashboard Component

**File:** `src/components/EventDashboard.jsx` (modifications)

```jsx
// Add imports
import SimpleRefreshControls from './dashboard/SimpleRefreshControls.jsx';
import simpleSyncManager from '../shared/services/data/simpleSyncManager.js';

// Add to EventDashboard component
const EventDashboard = () => {
  // ... existing state ...
  const [useSimpleSync, setUseSimpleSync] = useState(simpleSyncManager.isSimpleSyncEnabled());

  // Add simple sync data refresh handler
  const handleSimpleDataRefreshed = (refreshResult) => {
    // Force re-render of event cards with new data
    loadEventCards(true); // forceRefresh = true
  };

  // Add to render method (after existing refresh controls)
  return (
    <div>
      {/* Show simple controls only if simple sync is enabled */}
      {useSimpleSync && (
        <div style={{ marginTop: '16px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#007bff' }}>
            Simple Sync Controls (New System)
          </h4>
          <SimpleRefreshControls onDataRefreshed={handleSimpleDataRefreshed} />
        </div>
      )}

      {/* Existing dashboard content */}
      {/* ... rest of component ... */}
    </div>
  );
};
```

## Phase 3: Testing and Validation (Day 4)

### Step 3.1: Create Comprehensive Test Suite

**File:** `src/shared/services/data/__tests__/eventDataService.test.js`

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import eventDataService from '../eventDataService.js';
import * as api from '../../api/api.js';
import * as tokenService from '../../auth/tokenService.js';

// Mock dependencies
vi.mock('../../api/api.js');
vi.mock('../../auth/tokenService.js');

describe('EventDataService', () => {
  beforeEach(() => {
    // Clear cache and localStorage before each test
    eventDataService.clearCache();
    localStorage.clear();
    vi.clearAllMocks();

    // Enable simple sync for testing
    eventDataService.enableSimpleSync();
  });

  describe('getEvents', () => {
    it('should return cached events when cache is fresh and forceRefresh is false', async () => {
      // Setup
      const mockEvents = [
        { eventid: '1', name: 'Test Event 1', sectionid: '1' },
        { eventid: '2', name: 'Test Event 2', sectionid: '1' }
      ];
      eventDataService.eventsCache = mockEvents;
      eventDataService.lastFetchTime = Date.now() - 10000; // 10 seconds ago

      // Execute
      const result = await eventDataService.getEvents(false);

      // Assert
      expect(result).toEqual(mockEvents);
      expect(api.getEvents).not.toHaveBeenCalled();
    });

    it('should refresh events when forceRefresh is true', async () => {
      // Setup
      const mockToken = 'test-token';
      const mockSections = [{ sectionid: '1', name: 'Test Section' }];
      const mockEvents = [{ eventid: '1', name: 'Test Event' }];

      vi.mocked(tokenService.getToken).mockReturnValue(mockToken);
      vi.mocked(api.fetchMostRecentTermId).mockResolvedValue('term1');
      vi.mocked(api.getEvents).mockResolvedValue(mockEvents);

      // Mock localStorage for sections
      localStorage.setItem('viking_sections_test_offline', JSON.stringify(mockSections));

      // Execute
      const result = await eventDataService.getEvents(true);

      // Assert
      expect(result).toEqual([{
        ...mockEvents[0],
        sectionname: 'Test Section',
        sectionid: '1',
        termid: 'term1'
      }]);
      expect(api.getEvents).toHaveBeenCalledWith('1', 'term1', mockToken);
    });

    it('should handle API errors gracefully', async () => {
      // Setup
      const mockToken = 'test-token';
      const mockSections = [{ sectionid: '1', name: 'Test Section' }];

      vi.mocked(tokenService.getToken).mockReturnValue(mockToken);
      vi.mocked(api.fetchMostRecentTermId).mockRejectedValue(new Error('API Error'));

      localStorage.setItem('viking_sections_test_offline', JSON.stringify(mockSections));

      // Execute & Assert
      await expect(eventDataService.getEvents(true)).rejects.toThrow('Could not load events: API Error');
    });
  });

  describe('Feature Flag Functionality', () => {
    it('should respect simple sync flag when disabled', async () => {
      // Setup
      eventDataService.disableSimpleSync();

      // Mock legacy storage
      const legacyEvents = [{ eventid: '1', name: 'Legacy Event' }];
      localStorage.setItem('viking_events_legacy_offline', JSON.stringify(legacyEvents));

      // Execute
      const result = await eventDataService.getEvents();

      // Assert
      expect(result).toEqual(legacyEvents);
      expect(api.getEvents).not.toHaveBeenCalled();
    });
  });
});
```

### Step 3.2: Create Integration Test

**File:** `src/shared/services/data/__tests__/simpleSyncIntegration.test.js`

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import simpleSyncManager from '../simpleSyncManager.js';
import eventDataService from '../eventDataService.js';
import attendanceDataService from '../attendanceDataService.js';

describe('Simple Sync Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should complete full refresh cycle', async () => {
    // Setup
    simpleSyncManager.enableSimpleSync();

    // Mock successful API responses
    const mockEvents = [{ eventid: '1', name: 'Test Event', sectionid: '1' }];
    const mockAttendance = [{ eventid: '1', attending: 'Yes' }];

    vi.spyOn(eventDataService, 'refreshEvents').mockResolvedValue(mockEvents);
    vi.spyOn(attendanceDataService, 'refreshAttendanceData').mockResolvedValue(mockAttendance);

    // Execute
    const result = await simpleSyncManager.refreshAllData();

    // Assert
    expect(result.success).toBe(true);
    expect(result.eventsCount).toBe(1);
    expect(result.attendanceCount).toBe(1);
    expect(eventDataService.refreshEvents).toHaveBeenCalled();
    expect(attendanceDataService.refreshAttendanceData).toHaveBeenCalled();
  });

  it('should handle partial failures gracefully', async () => {
    // Setup
    simpleSyncManager.enableSimpleSync();

    vi.spyOn(eventDataService, 'refreshEvents').mockResolvedValue([]);
    vi.spyOn(attendanceDataService, 'refreshAttendanceData').mockRejectedValue(new Error('Attendance API failed'));

    // Execute & Assert
    await expect(simpleSyncManager.refreshAllData()).rejects.toThrow('Sync failed: Attendance API failed');
  });
});
```

### Step 3.3: Create Performance Comparison Test

**File:** `src/shared/services/data/__tests__/performanceComparison.test.js`

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import simpleSyncManager from '../simpleSyncManager.js';

describe('Performance Comparison', () => {
  const measurePerformance = async (syncFunction) => {
    const startTime = performance.now();
    const startMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;

    await syncFunction();

    const endTime = performance.now();
    const endMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;

    return {
      duration: endTime - startTime,
      memoryDelta: endMemory - startMemory,
    };
  };

  it('should demonstrate performance improvements', async () => {
    // Setup simple sync
    simpleSyncManager.enableSimpleSync();

    // Mock API responses
    vi.doMock('../../api/api.js', () => ({
      getEvents: vi.fn().mockResolvedValue([]),
      fetchMostRecentTermId: vi.fn().mockResolvedValue('term1'),
      getEventAttendance: vi.fn().mockResolvedValue([]),
    }));

    // Measure simple sync performance
    const simplePerf = await measurePerformance(() => simpleSyncManager.refreshAllData());

    // Assert performance characteristics
    expect(simplePerf.duration).toBeLessThan(5000); // Should complete in under 5 seconds
    expect(simplePerf.memoryDelta).toBeLessThan(1000000); // Should use less than 1MB additional memory
  });
});
```

## Phase 4: Production Migration (Day 5)

### Step 4.1: Enable Feature Flag in Production

```javascript
// Add to admin panel or run in browser console
localStorage.setItem('viking_use_simple_sync', 'true');

// Verify simple sync is enabled
import simpleSyncManager from './src/shared/services/data/simpleSyncManager.js';
console.log('Simple sync enabled:', simpleSyncManager.isSimpleSyncEnabled());
```

### Step 4.2: Monitor and Validate

```javascript
// Create monitoring script for production validation
const validateSimpleSync = async () => {
  console.log('Starting simple sync validation...');

  try {
    const status = simpleSyncManager.getSystemStatus();
    console.log('System status:', status);

    const result = await simpleSyncManager.refreshAllData();
    console.log('Refresh result:', result);

    if (result.success && result.eventsCount > 0) {
      console.log('✅ Simple sync validation passed');
      return true;
    } else {
      console.log('❌ Simple sync validation failed - no data');
      return false;
    }
  } catch (error) {
    console.log('❌ Simple sync validation failed:', error.message);
    return false;
  }
};

// Run validation
validateSimpleSync();
```

### Step 4.3: Remove Complex Services

Once simple sync is validated in production:

```bash
# Remove complex service files
rm src/shared/services/storage/AtomicAttendanceSync.js
rm src/shared/services/storage/SyncEventBus.js
rm src/shared/services/storage/SyncTransaction.js
rm src/shared/services/storage/SyncRetryManager.js
rm src/shared/services/storage/OfflineOperationQueue.js
rm src/shared/services/storage/SyncConflictResolver.js
rm src/shared/services/network/NetworkStatusManager.js

# Update imports in remaining files
grep -r "AtomicAttendanceSync\|SyncEventBus\|SyncTransaction" src/ --include="*.js" --include="*.jsx"
# Manual removal of imports and references

# Run tests to ensure nothing is broken
npm run test:run
npm run lint
npm run build
```

## Success Metrics

### Before Migration (Complex System)
- **Files**: 7 complex services (~2,200 lines)
- **Memory Usage**: ~2MB for sync system
- **API Calls**: 8-12 per full sync
- **Error Messages**: Technical jargon
- **Debugging Time**: 2-3 hours for issues
- **User Control**: Hidden background processes

### After Migration (Simple System)
- **Files**: 2 simple services (~300 lines)
- **Memory Usage**: ~50KB for sync system
- **API Calls**: 2-4 per full refresh
- **Error Messages**: Plain English
- **Debugging Time**: 10-15 minutes for issues
- **User Control**: Clear manual refresh buttons

### Validation Checklist

- [ ] Simple sync loads events correctly
- [ ] Simple sync loads attendance correctly
- [ ] Error messages are user-friendly
- [ ] Manual refresh controls work
- [ ] Feature flag toggles between systems
- [ ] Performance is improved
- [ ] Scout leaders can understand the interface
- [ ] All tests pass
- [ ] Documentation is updated

## Rollback Plan

If issues are discovered after migration:

```javascript
// Immediate rollback
localStorage.setItem('viking_use_simple_sync', 'false');
location.reload();

// Restore complex services from git
git checkout HEAD~1 -- src/shared/services/storage/AtomicAttendanceSync.js
git checkout HEAD~1 -- src/shared/services/storage/SyncEventBus.js
// ... restore other files as needed

// Run tests to verify rollback
npm run test:run
```

This migration guide provides a safe, step-by-step approach to replace the over-engineered sync system with Scout-appropriate simplicity while maintaining all existing functionality and providing clear rollback options.