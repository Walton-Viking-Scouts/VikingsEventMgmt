# IndexedDB Migration Guide

This document outlines the migration from localStorage to IndexedDB for the Viking Event Management application.

## Overview

The migration uses a **phased approach** to minimize risk and allow for rollback. Each record type is migrated completely from localStorage to IndexedDB before moving to the next phase.

## Architecture

### Core Services

1. **IndexedDBService** - Low-level IndexedDB operations using the `idb` library
2. **MigrationService** - Handles the actual migration logic and phase management
3. **UnifiedStorageService** - Provides a unified interface that automatically routes to the correct storage system based on migration status

### Migration Phases

**Phase 1: Cache & Sync (Low Risk)**
- `viking_last_sync` → `cache_data` store
- `viking_attendance_cache_time_*` → `cache_data` store
- `viking_shared_metadata_*` → `cache_data` store

**Phase 2: Configuration (Low Risk)**
- `viking_sections_offline` → `sections` store
- `viking_startup_data_offline` → `startup_data` store
- `viking_terms_offline` → `terms` store

**Phase 3: Flexi System (Medium Risk)**
- `viking_flexi_lists_*_offline` → `flexi_lists` store
- `viking_flexi_records_*_archived_n_offline` → `flexi_records` store
- `viking_flexi_structure_*_offline` → `flexi_structure` store
- `viking_flexi_data_*_offline` → `flexi_data` store

**Phase 4: Events (High Risk)**
- `viking_events_*_offline` → `events` store
- `viking_attendance_*_offline` → `attendance` store
- `viking_shared_attendance_*_offline` → `shared_attendance` store

**Phase 5: Members (Critical)**
- `viking_members_comprehensive_offline` → `members` store

## Usage

### Basic Migration

```javascript
import MigrationService from './src/shared/services/storage/migrationService.js';

// Migrate a specific phase
const result = await MigrationService.migratePhase(MigrationService.PHASES.PHASE_1_CACHE);

if (result.success) {
  console.log(`Migrated ${result.migratedCount} keys successfully`);
} else {
  console.error(`Migration failed: ${result.errors.length} errors`);
}

// Check migration status
const status = await MigrationService.getMigrationStatus();
console.log(status);
```

### Using Unified Storage

```javascript
import UnifiedStorageService from './src/shared/services/storage/unifiedStorageService.js';

// The service automatically routes to IndexedDB or localStorage based on migration status
const lastSync = await UnifiedStorageService.getLastSync();
await UnifiedStorageService.setLastSync(Date.now());

const events = await UnifiedStorageService.getEvents('12345');
await UnifiedStorageService.setEvents('12345', eventsData);
```

### Migration UI

A React component is provided for managing migrations:

```javascript
import StorageMigrationPanel from './src/shared/components/StorageMigrationPanel.jsx';

// Add to your admin/debug page
<StorageMigrationPanel />
```

## Migration Process

### Step 1: Test Phase 1 (Cache & Sync)

```javascript
// 1. Check current status
const status = await MigrationService.getMigrationStatus();

// 2. Migrate Phase 1 (lowest risk)
const result = await MigrationService.migratePhase(MigrationService.PHASES.PHASE_1_CACHE);

// 3. Test that cache operations work correctly
const lastSync = await UnifiedStorageService.getLastSync();

// 4. If successful, cleanup localStorage for Phase 1
await MigrationService.cleanupLocalStorageForPhase(MigrationService.PHASES.PHASE_1_CACHE);
```

### Step 2: Continue with Remaining Phases

Once Phase 1 is validated, continue with subsequent phases in order:

```javascript
// Phase 2: Configuration
await MigrationService.migratePhase(MigrationService.PHASES.PHASE_2_CONFIG);

// Phase 3: Flexi System
await MigrationService.migratePhase(MigrationService.PHASES.PHASE_3_FLEXI);

// Phase 4: Events
await MigrationService.migratePhase(MigrationService.PHASES.PHASE_4_EVENTS);

// Phase 5: Members (most critical)
await MigrationService.migratePhase(MigrationService.PHASES.PHASE_5_MEMBERS);
```

### Step 3: Cleanup and Validation

After each successful phase:

```javascript
// Cleanup localStorage for the phase
await MigrationService.cleanupLocalStorageForPhase(phase);

// Generate report to verify migration
const report = await UnifiedStorageService.getStorageReport();
console.log(report);
```

## Rollback Strategy

If any phase fails or causes issues:

```javascript
// Rollback a specific phase
await MigrationService.rollbackPhase(MigrationService.PHASES.PHASE_1_CACHE);

// This will:
// 1. Restore data to localStorage
// 2. Remove data from IndexedDB
// 3. Update migration status to 'rolled_back'
```

## Error Handling

The migration services include comprehensive error handling:

- **Partial failures**: Some keys migrate successfully, others fail
- **IndexedDB unavailable**: Graceful fallback to localStorage
- **Transaction failures**: Proper cleanup and status tracking
- **Data corruption**: Validation before cleanup

## Code Integration

### Updating Existing Code

Replace direct localStorage calls:

```javascript
// OLD: Direct localStorage usage
const data = JSON.parse(localStorage.getItem('viking_events_123_offline') || '[]');
localStorage.setItem('viking_events_123_offline', JSON.stringify(newData));

// NEW: Unified storage service
const data = await UnifiedStorageService.getEvents('123');
await UnifiedStorageService.setEvents('123', newData);
```

### Backward Compatibility

The UnifiedStorageService maintains backward compatibility:
- Before migration: uses localStorage
- After migration: uses IndexedDB
- Fallback: if IndexedDB fails, falls back to localStorage

## Monitoring and Debugging

### Migration Status Tracking

```javascript
const status = await MigrationService.getMigrationStatus();
// Returns: { phase_1_cache: 'completed', phase_2_config: 'pending', ... }
```

### Storage Report

```javascript
const report = await UnifiedStorageService.getStorageReport();
// Returns detailed information about both storage systems
```

### Debug Information

All operations include comprehensive logging to the console and Sentry for production debugging.

## Testing

Run the migration tests:

```bash
npm run test:run -- src/shared/services/storage/__tests__/migrationService.test.js
```

## Production Considerations

1. **Backup**: Ensure you have backups before starting migration
2. **User notification**: Consider informing users about the migration process
3. **Monitoring**: Watch for increased error rates during migration
4. **Gradual rollout**: Consider migrating different user segments at different times
5. **Rollback plan**: Be prepared to rollback if issues arise

## Benefits After Migration

- **Increased storage capacity**: IndexedDB has much higher limits than localStorage
- **Better performance**: Asynchronous operations don't block the UI
- **Structured data**: Better organization with separate object stores
- **Indexing**: Faster queries using IndexedDB indexes
- **Transactions**: Atomic operations for data consistency