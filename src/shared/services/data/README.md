# AttendanceDataService

A simple data service for fetching and caching Scout attendance data.

## Features

- Basic data fetching from API
- Simple in-memory caching
- Tracks last fetch time
- Works with existing event data structure

## Usage

```javascript
import attendanceDataService from './attendanceDataService.js';

// Get attendance data (uses cache if available)
const attendanceData = await attendanceDataService.getAttendanceData();

// Force refresh from API
const freshData = await attendanceDataService.getAttendanceData(true);

// Explicitly refresh data
const refreshedData = await attendanceDataService.refreshAttendanceData();

// Check when data was last fetched
const lastFetch = attendanceDataService.getLastFetchTime();

// Clear cache
attendanceDataService.clearCache();
```

## Data Flow

1. Service looks for cached events in localStorage
2. For each event, calls existing `getEventAttendance` API
3. Enriches attendance records with event information
4. Stores results in simple array cache
5. Returns cached data on subsequent calls (unless force refresh)

## Integration

The service integrates with the existing Scout app architecture:

- Uses existing API functions (`getEventAttendance`)
- Uses existing auth token service
- Uses existing logger for debugging
- Follows the same patterns as other data services

This is intentionally kept simple for a Scout event management app - no complex EventEmitter patterns or sophisticated caching strategies needed.