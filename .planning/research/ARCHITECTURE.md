# Architecture Research

**Domain:** Normalized storage layer for Capacitor hybrid app (IndexedDB web / SQLite native)
**Researched:** 2026-02-15
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
                          Current State
 ┌──────────────────────────────────────────────────────────┐
 │                    Consumer Layer                         │
 │  Components, Hooks, Data Services, API handlers          │
 ├──────────────┬──────────────────┬────────────────────────┤
 │              │                  │                        │
 │  ┌───────────▼──────┐  ┌───────▼──────────┐            │
 │  │ DatabaseService   │  │ Direct imports   │            │
 │  │ (database.js)     │  │ of USS / IDB     │            │
 │  │ - SQLite (native) │  │ from 20+ files   │            │
 │  │ - USS fallback    │  │                  │            │
 │  └───────────┬───────┘  └───────┬──────────┘            │
 │              │                  │                        │
 │  ┌───────────▼──────────────────▼──────────┐            │
 │  │     UnifiedStorageService (USS)          │            │
 │  │  - Key routing (shouldUseIndexedDB)      │            │
 │  │  - Blob storage via string keys          │            │
 │  │  - localStorage fallback                 │            │
 │  └───────────┬──────────────────────────────┘            │
 │              │                                           │
 │  ┌───────────▼──────────────────────────────┐            │
 │  │     IndexedDBService (indexedDBService)   │            │
 │  │  - 12 object stores                      │            │
 │  │  - Generic get/set + member-specific CRUD │            │
 │  │  - idb library wrapper                   │            │
 │  └──────────────────────────────────────────┘            │
 └──────────────────────────────────────────────────────────┘


                          Target State
 ┌──────────────────────────────────────────────────────────┐
 │                    Consumer Layer                         │
 │  Components, Hooks, Data Services, API handlers          │
 ├──────────────────────────────────────────────────────────┤
 │                                                          │
 │  ┌──────────────────────────────────────────────────┐   │
 │  │              StorageService                       │   │
 │  │  (single public API for all storage)              │   │
 │  │                                                   │   │
 │  │  .sections.getAll()   .events.getBySection(id)    │   │
 │  │  .members.getBySection(ids)                       │   │
 │  │  .attendance.getByEvent(id)                       │   │
 │  │  .terms.getCurrentActive(sectionId)               │   │
 │  │  .flexi.getData(recordId, sectionId, termId)      │   │
 │  │  .cache.getLastSync()                             │   │
 │  └─────────────────────┬────────────────────────────┘   │
 │                        │                                 │
 │  ┌─────────────────────▼────────────────────────────┐   │
 │  │           Platform Adapter                        │   │
 │  │  if (native) → SQLiteAdapter                      │   │
 │  │  if (web)    → IndexedDBAdapter                   │   │
 │  └──────────────────────────────────────────────────┘   │
 └──────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Replaces |
|-----------|----------------|----------|
| **StorageService** | Single public API. Domain-scoped namespaces (`.sections`, `.members`, `.events`, etc.). All consumers import this one service. | DatabaseService + direct USS/IDB imports from 20+ files |
| **IndexedDBAdapter** | Web platform implementation. Normalized stores with proper keyPaths. Uses `idb` library. | IndexedDBService blob stores + UnifiedStorageService key routing |
| **SQLiteAdapter** | Native platform implementation. SQLite tables with proper schemas. Uses `@capacitor-community/sqlite`. | DatabaseService SQLite branch |
| **Domain Repositories** | Type-specific CRUD logic (MembersRepository, EventsRepository, etc.). Consumed by StorageService namespaces. Encapsulate normalization/denormalization. | Scattered logic across database.js, USS convenience methods, and consumer files |

## Recommended Project Structure

```
src/shared/services/storage/
├── storageService.js           # Single public API (facade)
├── adapters/
│   ├── indexedDBAdapter.js     # Web: idb-based normalized stores
│   └── sqliteAdapter.js        # Native: SQLite with proper schema
├── repositories/
│   ├── membersRepository.js    # Member CRUD (already normalized pattern)
│   ├── eventsRepository.js     # Event CRUD (normalize next)
│   ├── attendanceRepository.js # Attendance CRUD
│   ├── sectionsRepository.js   # Sections CRUD
│   ├── termsRepository.js      # Terms + current active terms
│   ├── flexiRepository.js      # FlexiRecord data/structure/lists
│   └── cacheRepository.js      # Sync timestamps, cache metadata
├── schemas/
│   ├── indexedDBSchema.js       # Store definitions, keyPaths, indexes
│   └── sqliteSchema.js          # CREATE TABLE statements
├── __tests__/                   # Existing tests (adapt)
│   └── ...
├── DEPRECATED_database.js       # Thin shim during migration
├── DEPRECATED_unifiedStorageService.js  # Thin shim during migration
└── DEPRECATED_indexedDBService.js       # Thin shim during migration
```

### Structure Rationale

- **storageService.js:** Single import point. Consumers never touch adapters or repositories directly. Provides domain-scoped namespaces like `storageService.members.getBySection([1,2])`.
- **adapters/:** Platform detection happens once at initialization. The adapter interface is identical for both platforms. Repositories call adapter methods, never platform APIs directly.
- **repositories/:** Each data domain gets its own repository encapsulating normalization logic. The members repository already exists as a pattern (the `saveMembers`/`getMembers` dual-store logic in database.js). Other repositories follow the same pattern.
- **schemas/:** Centralized schema definitions. IndexedDB schema defines stores, keyPaths, and indexes. SQLite schema defines CREATE TABLE statements. Both schemas describe the same logical data model.
- **DEPRECATED_ files:** During migration, existing files become thin shims that delegate to the new StorageService. This allows incremental migration of 20+ consumer files without a big-bang rewrite.

## Architectural Patterns

### Pattern 1: Repository per Domain

**What:** Each data type (members, events, attendance, sections, terms, flexi) gets its own repository class that encapsulates all storage operations for that domain.
**When to use:** Always. Every data type flows through its repository.
**Trade-offs:** More files, but each is focused and testable. The members repository already proves this pattern works.

**Example:**
```javascript
class EventsRepository {
  constructor(adapter) {
    this.adapter = adapter;
  }

  async saveEvents(sectionId, events) {
    const normalized = events.map(event => ({
      eventid: event.eventid,
      sectionid: sectionId,
      termid: event.termid || null,
      name: event.name,
      startdate: event.startdate,
      enddate: event.enddate,
      location: event.location,
      notes: event.notes,
    }));
    await this.adapter.events.bulkPut(normalized);
  }

  async getBySection(sectionId) {
    return await this.adapter.events.getByIndex('sectionid', sectionId);
  }

  async getById(eventId) {
    return await this.adapter.events.get(eventId);
  }
}
```

### Pattern 2: Platform Adapter with Identical Interface

**What:** A single adapter interface implemented by both IndexedDBAdapter and SQLiteAdapter. The StorageService selects the adapter at init time based on `Capacitor.isNativePlatform()`.
**When to use:** Every storage operation goes through the adapter.
**Trade-offs:** Both adapters must implement the same interface, which means IndexedDB stores and SQLite tables must model the same logical schema. This is a strength -- it forces consistency.

**Example:**
```javascript
class IndexedDBAdapter {
  async initialize() {
    this.db = await openDB('vikings-eventmgmt', VERSION, { upgrade });
  }

  get events() {
    return {
      get: (id) => this.db.get('events', id),
      getByIndex: (index, value) => this.db.getAllFromIndex('events', index, value),
      put: (record) => this.db.put('events', record),
      bulkPut: async (records) => {
        const tx = this.db.transaction('events', 'readwrite');
        for (const record of records) await tx.store.put(record);
        await tx.done;
      },
      delete: (id) => this.db.delete('events', id),
      clear: () => this.db.clear('events'),
    };
  }
}
```

### Pattern 3: Deprecation Shims for Incremental Migration

**What:** Existing service files become thin wrappers that delegate to the new StorageService. Consumers continue working unchanged until migrated.
**When to use:** During the migration period. Remove shims after all consumers are migrated.
**Trade-offs:** Temporary code duplication, but eliminates big-bang risk. Each consumer file can be migrated independently.

**Example:**
```javascript
// DEPRECATED_unifiedStorageService.js
import storageService from './storageService.js';

export class UnifiedStorageService {
  static async getEvents(sectionId) {
    return storageService.events.getBySection(sectionId);
  }
  static async setEvents(sectionId, events) {
    return storageService.events.saveEvents(sectionId, events);
  }
  // ... delegate all methods
}
```

## Data Flow

### Save Flow (API to Storage)

```
API Response (JSON blob)
    |
    v
Data Loading Service (dataLoadingService.js)
    |
    v
StorageService.{domain}.save(data)
    |
    v
{Domain}Repository.save(data)
    |--- normalize: flatten blob into individual records
    |--- validate: ensure required fields present
    |
    v
PlatformAdapter.{store}.bulkPut(normalizedRecords)
    |
    |--- [Web] IndexedDBAdapter → idb transaction → IndexedDB stores
    |--- [Native] SQLiteAdapter → SQL INSERT/REPLACE → SQLite tables
```

### Read Flow (Storage to UI)

```
Component / Hook
    |
    v
StorageService.{domain}.getBySection(sectionId)
    |
    v
{Domain}Repository.getBySection(sectionId)
    |--- query by index/foreign key
    |--- denormalize: reconstruct rich objects from stored records
    |
    v
PlatformAdapter.{store}.getByIndex('sectionid', sectionId)
    |
    |--- [Web] IndexedDBAdapter → idb index query → records
    |--- [Native] SQLiteAdapter → SQL SELECT WHERE → rows
```

### Key Data Flows

1. **Members (already normalized):** API returns flat member array per section. `saveMembers()` splits into `core_members` (keyed by scoutid) + `member_section` (composite key [scoutid, sectionid]). `getMembers()` joins them back. This exact pattern extends to all other data types.

2. **Events (normalize next):** API returns events array per section. Currently stored as blob with key `viking_events_{sectionId}_offline`. Normalize to: one record per event in `events` store, keyed by `eventid`, indexed by `sectionid`.

3. **Attendance (normalize after events):** API returns attendance array per event. Currently stored as blob with key `viking_attendance_{eventId}_offline`. Normalize to: one record per attendance entry, composite key `[eventid, scoutid]`, indexed by `eventid`.

4. **Sections:** Currently stored as single blob with key `viking_sections_offline`. Normalize to: one record per section, keyed by `sectionid`.

5. **Terms:** Currently stored as blob with key `viking_terms_offline`. Already partially normalized via `CurrentActiveTermsService`. Normalize all terms to: one record per term, keyed by `termid`, indexed by `sectionid`.

6. **Flexi Records (most complex, normalize last):** Three related stores -- lists, structure, data. Currently use composite string keys. Normalize to: proper keyPaths and indexes for each store.

## Normalized IndexedDB Schema

The IndexedDB schema should change from blob stores (keyPath: 'key') to record-level stores with proper keyPaths:

| Store | Current keyPath | Normalized keyPath | Indexes |
|-------|----------------|-------------------|---------|
| `sections` | `'key'` (blob) | `'sectionid'` | `sectiontype` |
| `events` | `'key'` (blob) | `'eventid'` | `sectionid`, `termid`, `startdate` |
| `attendance` | `'key'` (blob) | `['eventid', 'scoutid']` | `eventid`, `scoutid` |
| `core_members` | `'scoutid'` (already normalized) | `'scoutid'` (keep) | `lastname`, `firstname` |
| `member_section` | `['scoutid', 'sectionid']` (already normalized) | `['scoutid', 'sectionid']` (keep) | `scoutid`, `sectionid`, `person_type` |
| `terms` | `'key'` (blob) | `'termid'` | `sectionid`, `startdate` |
| `current_active_terms` | `'sectionId'` (already normalized) | `'sectionId'` (keep) | `lastUpdated` |
| `flexi_lists` | `'key'` (blob) | `'flexiRecordId'` | `sectionid` |
| `flexi_structure` | `'key'` (blob) | `['flexiRecordId', 'sectionid']` | `flexiRecordId` |
| `flexi_data` | `'key'` (blob) | `['flexiRecordId', 'sectionid', 'termid']` | `flexiRecordId`, `sectionid` |
| `cache_data` | `'key'` (keep for KV metadata) | `'key'` (keep) | `type`, `timestamp` |

## Build Order (Suggested Normalization Sequence)

Based on dependency analysis and complexity:

### Phase 1: Sections (simplest, foundational)
- **Why first:** Every other data type references sectionid. Lowest record count. Simplest schema.
- **Records:** ~5-10 sections per group.
- **Dependencies:** None. Everything depends on sections.
- **Effort:** Small. Direct keyPath change, simple CRUD.

### Phase 2: Events
- **Why second:** Events are referenced by attendance and flexi records. Medium complexity.
- **Records:** ~50-200 events per section per term.
- **Dependencies:** Sections (foreign key: sectionid).
- **Effort:** Medium. Currently blob-per-section, normalize to record-per-event.

### Phase 3: Attendance
- **Why third:** Depends on events. Most critical for offline operation (event check-in).
- **Records:** ~20-60 attendance records per event.
- **Dependencies:** Events (foreign key: eventid), Members (foreign key: scoutid).
- **Effort:** Medium. Versioning/conflict tracking metadata must be preserved.

### Phase 4: Terms
- **Why fourth:** CurrentActiveTermsService already partially normalized. Full terms blob still exists.
- **Records:** ~3-6 terms per section.
- **Dependencies:** Sections (foreign key: sectionid).
- **Effort:** Small-Medium. CurrentActiveTermsService already works correctly; just normalize the full terms blob.

### Phase 5: Flexi Records
- **Why last:** Most complex data structure. Three related stores. Depends on events, sections, terms.
- **Records:** Variable, can be large.
- **Dependencies:** Sections, Terms, Events.
- **Effort:** Large. Three interrelated stores, composite keys, complex query patterns.

### Phase 6: Service Consolidation & Cleanup
- **What:** Remove all DEPRECATED_ shims. Delete UnifiedStorageService, old IndexedDBService blob methods, DatabaseService.
- **Dependencies:** All consumer files migrated to new StorageService.
- **Effort:** Medium. Mainly find-and-replace imports across 20+ files + test updates.

## Anti-Patterns

### Anti-Pattern 1: String Key Routing

**What people do:** Use string key patterns like `viking_events_{sectionId}_offline` to route data to different stores, with regex matching in a routing layer (current UnifiedStorageService pattern).
**Why it's wrong:** String keys obscure the data model. The routing layer becomes a maintenance burden. No ability to query individual records -- must load entire blob to find one event.
**Do this instead:** Use proper keyPaths and indexes. Store individual records keyed by their natural identifiers (eventid, scoutid, sectionid). Query by index for filtered retrieval.

### Anti-Pattern 2: Blob-per-Entity-Group Storage

**What people do:** Store all events for a section as a single JSON blob. Store all attendance for an event as a single JSON blob.
**Why it's wrong:** Any update to a single record requires reading, deserializing, modifying, serializing, and writing the entire blob. No granular conflict detection. Wastes memory on large datasets.
**Do this instead:** Store individual records. Use IndexedDB's built-in indexing for filtered retrieval. Use transactions for atomic multi-record updates.

### Anti-Pattern 3: Dual-Path Platform Branching in Every Method

**What people do:** Every method in DatabaseService checks `if (!this.isNative || !this.db)` and branches to completely different code paths.
**Why it's wrong:** Every method has two implementations interleaved. Bugs in one platform path are hard to spot. Testing requires covering both branches of every method.
**Do this instead:** Select the adapter once at initialization. All methods delegate to the adapter. Platform-specific logic is encapsulated in the adapter, not scattered across every method.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| OSM API (via backend) | API response -> DataLoadingService -> StorageService.{domain}.save() | No change to API layer needed. DataLoadingService is the only integration point. |
| Sentry | Error tracking in adapters and repositories | Move sentryUtils.captureException into adapter error handling, not scattered across every method. |
| idb library | Used by IndexedDBAdapter exclusively | Already in use. No change needed. |
| @capacitor-community/sqlite | Used by SQLiteAdapter exclusively | Already in use. No change needed. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Consumer -> StorageService | Import `storageService`, call domain methods | Only public API. No direct adapter/repository access. |
| StorageService -> Repository | StorageService delegates to typed repositories | Each namespace (`.events`, `.members`) maps to a repository. |
| Repository -> Adapter | Repository calls adapter store methods | Adapter provides store-scoped CRUD. Repository handles normalization. |
| Adapter -> Platform API | Adapter wraps idb or @capacitor-community/sqlite | Platform-specific code lives only here. |

## Consumer Migration Impact

Files currently importing storage services directly (from grep analysis):

| Import Target | Consumer Count | Migration Strategy |
|---------------|----------------|-------------------|
| `UnifiedStorageService` | 20 files | DEPRECATED_ shim first, then migrate each file to `storageService.{domain}` |
| `database.js` (DatabaseService) | 22 files | DEPRECATED_ shim first, then migrate each file |
| `indexedDBService.js` (IndexedDBService) | 10 files (non-test) | DEPRECATED_ shim first. Most are already via database.js. |
| `currentActiveTermsService.js` | 3 files | Becomes `storageService.terms.getCurrentActive()` |

Total unique consumer files: ~30 (some import multiple services).

### Migration Path per Consumer
1. Replace import from old service with import from `storageService`
2. Replace method calls with new namespace-scoped calls
3. Remove old import
4. Verify tests pass

Each file migration is independent and can be done in separate commits.

## Sources

- Codebase analysis: `/Users/simon/vsCodeProjects/VikingEventMgmt/ios app/src/shared/services/storage/` (all 5 files)
- Codebase analysis: `/Users/simon/vsCodeProjects/VikingEventMgmt/ios app/.planning/codebase/ARCHITECTURE.md`
- Codebase analysis: `/Users/simon/vsCodeProjects/VikingEventMgmt/ios app/.planning/codebase/STRUCTURE.md`
- idb library: Context7 `/jakearchibald/idb` -- confirms store-level transactions, keyPath-based stores, index queries
- @capacitor-community/sqlite: Context7 `/capacitor-community/sqlite` -- confirms SQLite connection pattern used in database.js
- Existing normalized pattern: `saveMembers()`/`getMembers()` dual-store implementation in database.js (lines 833-1216) and IndexedDBService core_members/member_section stores

---
*Architecture research for: Viking Event Management normalized storage layer*
*Researched: 2026-02-15*
