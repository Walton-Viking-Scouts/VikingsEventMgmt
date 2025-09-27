# Current Active Terms IndexedDB Schema

## Overview

The `current_active_terms` IndexedDB object store provides normalized storage for the currently active term for each section, optimizing term lookup performance and reducing data duplication from the existing `viking_terms_offline` JSON blob storage.

## Schema Design

### Object Store Definition
```javascript
// Store Name: current_active_terms
// Primary Key: sectionId (string)
// Database Version: 3 (already implemented)
const currentActiveTermsStore = db.createObjectStore(STORES.CURRENT_ACTIVE_TERMS, {
  keyPath: 'sectionId'
});
currentActiveTermsStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
```

### Data Structure

Each record in the `current_active_terms` store follows this structure:

```typescript
interface CurrentActiveTerm {
  sectionId: string;           // Primary key - section identifier
  currentTermId: string;       // ID of the currently active term
  termName: string;           // Human-readable term name
  startDate: string;          // Term start date (YYYY-MM-DD format)
  endDate: string;            // Term end date (YYYY-MM-DD format)
  lastUpdated: number;        // Timestamp of last update (Date.now())
}
```

### Example Record
```javascript
{
  sectionId: "999901",
  currentTermId: "12345",
  termName: "Autumn Term 2025",
  startDate: "2025-09-01",
  endDate: "2025-12-15",
  lastUpdated: 1737765123456
}
```

## Implementation Details

### Database Service Integration

The schema is already integrated into the existing IndexedDB service:

**File**: `/src/shared/services/storage/indexedDBService.js`

```javascript
// Store constant
CURRENT_ACTIVE_TERMS: 'current_active_terms'

// Creation in upgrade handler (lines 59-62)
if (!db.objectStoreNames.contains(STORES.CURRENT_ACTIVE_TERMS)) {
  const currentActiveTermsStore = db.createObjectStore(STORES.CURRENT_ACTIVE_TERMS, {
    keyPath: 'sectionId'
  });
  currentActiveTermsStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
}
```

### UnifiedStorageService Routing

**File**: `/src/shared/services/storage/unifiedStorageService.js`

The routing logic already supports both production and demo mode keys:

```javascript
if (key === 'viking_current_active_terms' || key === 'demo_viking_current_active_terms') {
  return IndexedDBService.STORES.CURRENT_ACTIVE_TERMS;
}
```

## Usage Patterns

### Basic Operations

#### Store Current Active Term
```javascript
import { IndexedDBService } from '../services/storage/indexedDBService.js';

const currentActiveTerm = {
  sectionId: "999901",
  currentTermId: "12345",
  termName: "Autumn Term 2025",
  startDate: "2025-09-01",
  endDate: "2025-12-15",
  lastUpdated: Date.now()
};

await IndexedDBService.set(
  IndexedDBService.STORES.CURRENT_ACTIVE_TERMS,
  currentActiveTerm.sectionId,  // Key
  currentActiveTerm            // Data stored in .data property
);
```

#### Retrieve Current Active Term
```javascript
const currentActiveTerm = await IndexedDBService.get(
  IndexedDBService.STORES.CURRENT_ACTIVE_TERMS,
  "999901"  // sectionId
);

if (currentActiveTerm) {
  console.log(`Current term: ${currentActiveTerm.termName}`);
  console.log(`Period: ${currentActiveTerm.startDate} to ${currentActiveTerm.endDate}`);
}
```

#### Query by Last Updated (using index)
```javascript
// Get all current active terms updated after a specific timestamp
const recentTimestamp = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
const recentTerms = await IndexedDBService.getByIndex(
  IndexedDBService.STORES.CURRENT_ACTIVE_TERMS,
  'lastUpdated',
  IDBKeyRange.lowerBound(recentTimestamp)
);
```

### Integration with UnifiedStorageService

For consistency with existing patterns, use UnifiedStorageService:

```javascript
import { UnifiedStorageService } from '../services/storage/unifiedStorageService.js';
import { isDemoMode } from '../../../config/demoMode.js';

// Key selection based on demo mode
const demoMode = isDemoMode();
const baseKey = demoMode ? 'demo_viking_current_active_terms' : 'viking_current_active_terms';

// Store current active term for a section
await UnifiedStorageService.set(`${baseKey}_${sectionId}`, currentActiveTerm);

// Retrieve current active term for a section
const currentActiveTerm = await UnifiedStorageService.get(`${baseKey}_${sectionId}`);
```

## Performance Benefits

### Comparison with Existing JSON Blob Storage

**Before (viking_terms_offline)**:
- Store all terms for all sections in single JSON blob
- Requires parsing entire blob to find current term
- Duplicated data across sections
- No indexing for efficient queries

**After (current_active_terms)**:
- Normalized storage, one record per section
- Direct key-based lookup by sectionId
- Indexed by lastUpdated for efficient time-based queries
- Minimal data duplication

### Query Performance

```javascript
// OLD: Parse entire terms blob
const termsBlob = await UnifiedStorageService.get('viking_terms_offline');
const sectionTerms = termsBlob[sectionId];
const currentTerm = sectionTerms.find(term => /* logic to determine current */);

// NEW: Direct indexed lookup
const currentTerm = await IndexedDBService.get(
  IndexedDBService.STORES.CURRENT_ACTIVE_TERMS,
  sectionId
);
```

## Migration Strategy

The schema is already in place and ready for use. To migrate from existing JSON blob storage:

1. **Data Population**: Parse existing `viking_terms_offline` data
2. **Current Term Detection**: Apply business logic to determine which term is "current"
3. **Normalize and Store**: Save current terms to the new schema
4. **Gradual Migration**: Update consuming code to use new storage progressively

## Best Practices

### Data Consistency
- Always update `lastUpdated` timestamp when modifying records
- Use transactions when updating multiple related records
- Validate date formats before storage (YYYY-MM-DD)

### Error Handling
```javascript
try {
  const currentTerm = await IndexedDBService.get(
    IndexedDBService.STORES.CURRENT_ACTIVE_TERMS,
    sectionId
  );

  if (!currentTerm) {
    // Handle missing current term - fallback to terms blob?
    logger.warn('No current active term found for section', { sectionId });
  }
} catch (error) {
  logger.error('Failed to retrieve current active term', { sectionId, error });
  // Implement fallback strategy
}
```

### Demo Mode Support
- Use appropriate key prefix based on `isDemoMode()`
- Maintain separate demo data to avoid contamination
- Test both production and demo modes

## Integration Points

### Existing Services That May Benefit
- Event management (filtering by current term)
- Member services (current term context)
- Reporting and analytics
- Dashboard widgets showing current term info

### API Integration
When syncing with backend APIs, the normalized structure simplifies:
- Term change detection
- Selective updates (only changed sections)
- Efficient change tracking via `lastUpdated` index

## Database Version Management

**Current State**: The schema is implemented in DATABASE_VERSION = 3
**Future Changes**: Increment DATABASE_VERSION if schema modifications are needed
**Backward Compatibility**: Existing stores remain unaffected

---

**Status**: ✅ Schema is fully implemented and ready for use
**Location**: `indexedDBService.js` lines 59-62, 13
**Integration**: `unifiedStorageService.js` routing implemented
**Next Steps**: Begin using the new schema in application logic