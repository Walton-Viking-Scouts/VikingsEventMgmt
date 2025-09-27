# Current Active Terms Service API Reference

The `CurrentActiveTermsService` provides optimized access to current active term information with direct table lookups instead of blob storage searches.

## Table of Contents
- [Service Overview](#service-overview)
- [Core Methods](#core-methods)
- [Migration Methods](#migration-methods)
- [Utility Methods](#utility-methods)
- [Error Handling](#error-handling)
- [Performance Characteristics](#performance-characteristics)
- [Usage Examples](#usage-examples)

## Service Overview

### Import
```javascript
import { CurrentActiveTermsService } from '../shared/services/storage/currentActiveTermsService.js';
```

### Key Features
- **O(1) Direct Lookups**: Primary key access by sectionId
- **Indexed Queries**: Efficient timestamp-based range queries
- **Automatic Migration**: Seamless transition from legacy blob storage
- **Batch Operations**: Optimized multi-record access
- **Comprehensive Logging**: Structured logging for debugging and monitoring

## Core Methods

### `getCurrentActiveTerm(sectionId)`

Retrieves the current active term for a specific section.

**Parameters:**
- `sectionId` (string): Section identifier

**Returns:**
- `Promise<Object|null>`: Current active term object or null if not found

**Performance:** O(1) - Direct indexed lookup

**Example:**
```javascript
const term = await CurrentActiveTermsService.getCurrentActiveTerm('section_123');
if (term) {
  console.log(`Active term: ${term.termName}`);
  console.log(`Period: ${term.startDate} to ${term.endDate}`);
}
```

**Response Object:**
```javascript
{
  sectionId: "section_123",
  currentTermId: "term_123_2024",
  termName: "2024 Spring Term",
  startDate: "2024-01-01",
  endDate: "2024-12-31",
  lastUpdated: 1695633600000
}
```

---

### `setCurrentActiveTerm(sectionId, termData)`

Sets or updates the current active term for a section.

**Parameters:**
- `sectionId` (string): Section identifier
- `termData` (Object): Term information object

**Returns:**
- `Promise<boolean>`: true on success

**Performance:** O(1) - Direct indexed write

**Example:**
```javascript
const termData = {
  currentTermId: "term_456_2024",
  termName: "2024 Fall Term",
  startDate: "2024-09-01",
  endDate: "2024-12-15"
};

const success = await CurrentActiveTermsService.setCurrentActiveTerm('section_456', termData);
```

**Input Formats Supported:**
```javascript
// Standard format
{
  currentTermId: "term_id",
  termName: "Term Name",
  startDate: "YYYY-MM-DD",
  endDate: "YYYY-MM-DD"
}

// Legacy format (auto-converted)
{
  termid: "term_id",        // → currentTermId
  name: "Term Name",        // → termName
  startdate: "YYYY-MM-DD",  // → startDate
  enddate: "YYYY-MM-DD"     // → endDate
}
```

---

### `getAllCurrentActiveTerms()`

Retrieves all current active terms from the database.

**Parameters:** None

**Returns:**
- `Promise<Array<Object>>`: Array of all current active term objects

**Performance:** O(n) - Full table scan

**Example:**
```javascript
const allTerms = await CurrentActiveTermsService.getAllCurrentActiveTerms();
console.log(`Total active terms: ${allTerms.length}`);

allTerms.forEach(term => {
  console.log(`Section ${term.sectionId}: ${term.termName}`);
});
```

---

### `getTermsUpdatedSince(timestamp)`

Retrieves terms that have been updated since a specific timestamp. Useful for incremental synchronization.

**Parameters:**
- `timestamp` (number): Unix timestamp in milliseconds

**Returns:**
- `Promise<Array<Object>>`: Array of terms updated after the timestamp

**Performance:** O(log n) - Indexed range query

**Example:**
```javascript
const lastSync = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
const recentTerms = await CurrentActiveTermsService.getTermsUpdatedSince(lastSync);

console.log(`${recentTerms.length} terms updated in last 24 hours`);
```

---

### `deleteCurrentActiveTerm(sectionId)`

Removes the current active term record for a section.

**Parameters:**
- `sectionId` (string): Section identifier

**Returns:**
- `Promise<boolean>`: true on success

**Performance:** O(1) - Direct indexed delete

**Example:**
```javascript
const deleted = await CurrentActiveTermsService.deleteCurrentActiveTerm('section_789');
if (deleted) {
  console.log('Term record removed successfully');
}
```

## Migration Methods

### `migrateFromTermsBlob()`

Migrates current active terms from legacy blob storage to the new table format. Runs automatically on first service access if needed.

**Parameters:** None

**Returns:**
- `Promise<Object>`: Migration statistics object

**Performance:** O(n) - Processes all sections in blob storage

**Example:**
```javascript
const stats = await CurrentActiveTermsService.migrateFromTermsBlob();
console.log(`Migration complete:`, stats);
// Output: { migrated: 45, skipped: 2, errors: 0 }
```

**Migration Statistics:**
```javascript
{
  migrated: 45,    // Successfully migrated terms
  skipped: 2,      // Sections with no valid terms
  errors: 0        // Sections that failed to migrate
}
```

**Migration Logic:**
1. **Current Terms**: Terms where today falls between start and end dates
2. **Future Terms**: If no current term, use earliest upcoming term
3. **Past Terms**: If no current/future terms, use most recent past term
4. **Fallback**: If no terms with dates, use first available term

## Utility Methods

### `clearAllCurrentActiveTerms()`

Removes all current active term records from the database. ⚠️ **Use with caution in production.**

**Parameters:** None

**Returns:**
- `Promise<boolean>`: true on success

**Performance:** O(1) - Database clear operation

**Example:**
```javascript
// Development/testing only
const cleared = await CurrentActiveTermsService.clearAllCurrentActiveTerms();
```

---

### `getStoreStatistics()`

Provides comprehensive statistics about the current active terms store.

**Parameters:** None

**Returns:**
- `Promise<Object>`: Statistics object

**Performance:** O(n) - Analyzes all records

**Example:**
```javascript
const stats = await CurrentActiveTermsService.getStoreStatistics();
console.log('Store Statistics:', stats);
```

**Statistics Object:**
```javascript
{
  totalTerms: 47,
  sections: ["section_1", "section_2", ...],
  oldestUpdate: 1695549600000,
  newestUpdate: 1695636000000,
  termDistribution: {
    "term_1_2024": 15,
    "term_2_2024": 12,
    "term_3_2024": 20
  }
}
```

## Error Handling

All methods use structured error handling with detailed logging:

### Error Types

1. **Database Errors**
   - Connection failures
   - Schema/index issues
   - Transaction rollbacks

2. **Validation Errors**
   - Missing required fields
   - Invalid data types
   - Malformed section IDs

3. **Migration Errors**
   - Blob parsing failures
   - Data inconsistencies
   - Partial migration states

### Error Response Pattern

```javascript
try {
  const term = await CurrentActiveTermsService.getCurrentActiveTerm('invalid_id');
} catch (error) {
  // Error includes:
  // - error.message: Human-readable description
  // - error.sectionId: Context information
  // - error.operation: Which operation failed
  console.error('Term lookup failed:', error);
}
```

### Logging Categories

All operations log to structured categories:

- `DATABASE`: Normal database operations
- `ERROR`: Error conditions and failures
- `MIGRATION`: Migration process steps
- `PERFORMANCE`: Timing and optimization data

## Performance Characteristics

### Benchmark Data (1000 iterations)

| Operation | Average | Median | P95 | P99 |
|-----------|---------|---------|-----|-----|
| **getCurrentActiveTerm()** | 0.081ms | 0.083ms | 0.125ms | 0.208ms |
| **setCurrentActiveTerm()** | 0.15ms | 0.14ms | 0.25ms | 0.35ms |
| **getAllCurrentActiveTerms()** | 2.1ms | 1.8ms | 4.2ms | 6.8ms |
| **getTermsUpdatedSince()** | 3.07ms | 2.0ms | 6.33ms | 28.79ms |

### Scaling Characteristics

- **Single Lookups**: O(1) - constant time regardless of data size
- **Range Queries**: O(log n) - logarithmic scaling with indexed searches
- **Batch Operations**: Linear scaling with predictable performance
- **Migration**: O(n) - scales linearly with number of sections

### Memory Usage

- **Table Storage**: ~200 bytes per term record
- **Index Overhead**: ~50 bytes per record for timestamp index
- **Cache Impact**: Minimal - leverages IndexedDB's built-in caching
- **Memory Growth**: Linear with number of sections

## Usage Examples

### Basic Term Lookup Pattern

```javascript
class SomeService {
  async processSection(sectionId) {
    try {
      // Get current term for section
      const term = await CurrentActiveTermsService.getCurrentActiveTerm(sectionId);

      if (!term) {
        console.warn(`No active term found for section ${sectionId}`);
        return null;
      }

      // Use term data
      return this.performOperationWithTerm(term);

    } catch (error) {
      console.error('Failed to get current term:', error);
      throw error;
    }
  }
}
```

### Batch Processing Pattern

```javascript
async function syncAllSections() {
  // Get all current terms
  const allTerms = await CurrentActiveTermsService.getAllCurrentActiveTerms();

  // Process in batches to avoid memory issues
  const batchSize = 50;
  for (let i = 0; i < allTerms.length; i += batchSize) {
    const batch = allTerms.slice(i, i + batchSize);

    await Promise.all(
      batch.map(term => processTerm(term))
    );
  }
}
```

### Incremental Sync Pattern

```javascript
class TermSyncService {
  async performIncrementalSync(lastSyncTime) {
    // Get terms updated since last sync
    const updatedTerms = await CurrentActiveTermsService.getTermsUpdatedSince(lastSyncTime);

    if (updatedTerms.length === 0) {
      console.log('No terms updated since last sync');
      return;
    }

    // Sync each updated term
    for (const term of updatedTerms) {
      await this.syncTermWithRemote(term);
    }

    // Update last sync timestamp
    await this.updateLastSyncTime(Date.now());
  }
}
```

### Migration Status Check Pattern

```javascript
async function ensureTermsReady() {
  // Check if we have any terms
  const stats = await CurrentActiveTermsService.getStoreStatistics();

  if (stats.totalTerms === 0) {
    console.log('No terms found, running migration...');

    const migrationResult = await CurrentActiveTermsService.migrateFromTermsBlob();

    if (migrationResult.migrated > 0) {
      console.log(`Successfully migrated ${migrationResult.migrated} terms`);
    } else {
      console.warn('Migration completed but no terms were migrated');
    }
  }

  return stats;
}
```

## Integration Patterns

### Service Layer Integration

```javascript
// In your service classes
class PatrolService {
  async createPatrol(sectionId, patrolData) {
    // Get current term for validation
    const currentTerm = await CurrentActiveTermsService.getCurrentActiveTerm(sectionId);

    if (!currentTerm) {
      throw new Error(`No active term found for section ${sectionId}`);
    }

    // Include term context in patrol data
    const enrichedData = {
      ...patrolData,
      termId: currentTerm.currentTermId,
      termName: currentTerm.termName
    };

    return this.savePatrol(enrichedData);
  }
}
```

### Component Integration

```javascript
// In React components or similar
function TermSelector({ sectionId, onTermSelected }) {
  const [currentTerm, setCurrentTerm] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCurrentTerm() {
      try {
        const term = await CurrentActiveTermsService.getCurrentActiveTerm(sectionId);
        setCurrentTerm(term);
        if (term && onTermSelected) {
          onTermSelected(term);
        }
      } catch (error) {
        console.error('Failed to load current term:', error);
      } finally {
        setLoading(false);
      }
    }

    if (sectionId) {
      loadCurrentTerm();
    }
  }, [sectionId, onTermSelected]);

  // Render component...
}
```

---

**API Version**: 1.0
**Last Updated**: September 2024
**Compatibility**: IndexedDB-based storage systems