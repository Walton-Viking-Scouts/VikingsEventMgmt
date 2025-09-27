# Storage Layer Patterns & Best Practices

Guide for implementing efficient data storage patterns in the Viking Event Management system, with focus on the migration from blob storage to normalized tables.

## Table of Contents
- [Storage Architecture](#storage-architecture)
- [Migration Patterns](#migration-patterns)
- [Performance Optimization](#performance-optimization)
- [Service Implementation](#service-implementation)
- [Testing Strategies](#testing-strategies)
- [Monitoring & Debugging](#monitoring--debugging)

## Storage Architecture

### Current Storage Stack

```
┌─────────────────────────────────────────┐
│              Application Layer           │
│  (Components, Services, Business Logic) │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│            Service Layer                 │
│  • CurrentActiveTermsService             │
│  • PatrolManagerService                 │
│  • SectionTermsService                  │
│  • UnifiedStorageService                │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│           Storage Layer                  │
│  • IndexedDB (Structured Data)          │
│  • LocalStorage (Configuration)         │
│  • SessionStorage (Temporary Data)      │
└─────────────────────────────────────────┘
```

### Design Principles

#### 1. **Table-First Design**
- Prefer normalized tables over blob storage
- Use primary keys for O(1) lookups
- Design indexes for common query patterns
- Separate concerns with dedicated tables

#### 2. **Performance-Driven Architecture**
- Measure before optimizing
- Benchmark critical operations
- Use indexes strategically
- Optimize for common use cases

#### 3. **Migration-Safe Patterns**
- Always include fallback mechanisms
- Provide automatic migration paths
- Maintain backward compatibility during transitions
- Validate data integrity throughout process

## Migration Patterns

### Blob-to-Table Migration Template

Based on the successful Current Active Terms migration, use this template for other blob-to-table conversions:

#### 1. **Analysis Phase**

```javascript
// Analyze existing blob structure
async function analyzeBlobStructure(blobKey) {
  const blobData = await UnifiedStorageService.get(blobKey);

  return {
    totalRecords: Object.keys(blobData).length,
    sampleStructure: Object.values(blobData)[0],
    commonFields: analyzeCommonFields(blobData),
    accessPatterns: analyzeAccessPatterns(blobData)
  };
}
```

#### 2. **Schema Design**

```sql
-- Template for new table schema
CREATE TABLE {table_name} (
  {primary_key} TEXT PRIMARY KEY,     -- Direct lookup key
  {data_fields} TEXT NOT NULL,        -- Core data fields
  lastUpdated INTEGER NOT NULL        -- Always include for sync
);

-- Performance indexes
CREATE INDEX idx_{table_name}_lastUpdated
ON {table_name}(lastUpdated);

-- Add other indexes based on query patterns
CREATE INDEX idx_{table_name}_{query_field}
ON {table_name}({query_field});
```

#### 3. **Service Implementation Template**

```javascript
export class {EntityName}Service {
  // Primary operations - O(1) performance
  static async get{Entity}(primaryKey) {
    return await IndexedDBService.get(
      IndexedDBService.STORES.{TABLE_NAME},
      primaryKey
    );
  }

  static async set{Entity}(primaryKey, data) {
    const record = {
      [primaryKey]: String(primaryKey),
      ...normalizeData(data),
      lastUpdated: Date.now()
    };

    return await IndexedDBService.set(
      IndexedDBService.STORES.{TABLE_NAME},
      primaryKey,
      record
    );
  }

  // Migration method
  static async migrateFrom{Legacy}Blob() {
    const blobData = await UnifiedStorageService.get('{legacy_key}');
    if (!blobData) return { migrated: 0, skipped: 0, errors: 0 };

    let migrated = 0, skipped = 0, errors = 0;

    for (const [key, data] of Object.entries(blobData)) {
      try {
        const normalizedData = this._normalizeData(data);
        if (normalizedData) {
          await this.set{Entity}(key, normalizedData);
          migrated++;
        } else {
          skipped++;
        }
      } catch (error) {
        errors++;
      }
    }

    return { migrated, skipped, errors };
  }

  // Utility methods
  static async getAll{Entities}() {
    // Implement batch retrieval
  }

  static async get{Entities}UpdatedSince(timestamp) {
    // Implement indexed range queries
  }

  static async getStoreStatistics() {
    // Implement diagnostics
  }
}
```

### Migration Execution Strategy

#### Phase 1: Parallel Implementation
```javascript
// Deploy new service alongside existing blob access
// Test thoroughly in development
// Validate performance benchmarks
```

#### Phase 2: Gradual Migration
```javascript
// Update consumer services one by one
// Monitor performance and error rates
// Maintain fallback to blob storage
```

#### Phase 3: Cleanup
```javascript
// Remove blob storage dependencies
// Clean up legacy code paths
// Update documentation
```

## Performance Optimization

### Indexing Strategy

#### Primary Indexes (Always Include)
```sql
-- Primary key for O(1) lookups
{primary_key} TEXT PRIMARY KEY

-- Timestamp for sync operations
CREATE INDEX idx_{table}_lastUpdated ON {table}(lastUpdated);
```

#### Query-Specific Indexes
```sql
-- For range queries
CREATE INDEX idx_{table}_{range_field} ON {table}({range_field});

-- For filtered searches
CREATE INDEX idx_{table}_{filter_field} ON {table}({filter_field});

-- For compound queries (use sparingly)
CREATE INDEX idx_{table}_{field1}_{field2} ON {table}({field1}, {field2});
```

### Query Optimization Patterns

#### 1. **Direct Lookups (O(1))**
```javascript
// Optimal: Direct primary key lookup
const result = await IndexedDBService.get(storeName, primaryKey);

// Avoid: Scanning for matches
const results = await IndexedDBService.getAll(storeName);
const match = results.find(r => r.someField === value); // O(n) - BAD
```

#### 2. **Range Queries (O(log n))**
```javascript
// Optimal: Indexed range query
const keyRange = IDBKeyRange.lowerBound(timestamp);
const results = await IndexedDBService.getByIndex(storeName, 'lastUpdated', keyRange);

// Avoid: Filter after retrieval
const all = await IndexedDBService.getAll(storeName);
const filtered = all.filter(r => r.lastUpdated >= timestamp); // O(n) - BAD
```

#### 3. **Batch Operations**
```javascript
// Optimal: Transaction-based batch operations
const transaction = await IndexedDBService.getTransaction([storeName], 'readwrite');
await Promise.all(
  records.map(record =>
    IndexedDBService.set(storeName, record.id, record, transaction)
  )
);

// Avoid: Individual transactions
for (const record of records) {
  await IndexedDBService.set(storeName, record.id, record); // Multiple transactions - SLOWER
}
```

### Performance Monitoring

#### Benchmark Template
```javascript
class {Service}Benchmark {
  async benchmarkPrimaryOperations() {
    const iterations = 1000;

    // Benchmark get operation
    const getResults = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await {Service}.get{Entity}(testId);
      getResults.push(performance.now() - start);
    }

    // Benchmark set operation
    const setResults = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await {Service}.set{Entity}(testId, testData);
      setResults.push(performance.now() - start);
    }

    return {
      get: this.analyzeResults(getResults),
      set: this.analyzeResults(setResults)
    };
  }

  analyzeResults(times) {
    return {
      avg: times.reduce((a, b) => a + b) / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      median: times.sort((a, b) => a - b)[Math.floor(times.length / 2)]
    };
  }
}
```

## Service Implementation

### Standard Service Structure

```javascript
export class {EntityName}Service {
  // Core CRUD operations
  static async get{Entity}(id) { /* Implementation */ }
  static async set{Entity}(id, data) { /* Implementation */ }
  static async delete{Entity}(id) { /* Implementation */ }

  // Batch operations
  static async getAll{Entities}() { /* Implementation */ }
  static async get{Entities}UpdatedSince(timestamp) { /* Implementation */ }

  // Migration utilities
  static async migrateFrom{Legacy}() { /* Implementation */ }
  static async clear{Entities}() { /* Implementation */ }

  // Diagnostics
  static async getStoreStatistics() { /* Implementation */ }
  static async validateDataIntegrity() { /* Implementation */ }

  // Private helpers
  static _normalizeData(rawData) { /* Implementation */ }
  static _validateData(data) { /* Implementation */ }
}
```

### Error Handling Patterns

```javascript
// Standard error handling wrapper
static async safeOperation(operation, context) {
  try {
    const result = await operation();

    logger.debug('Operation completed', {
      operation: operation.name,
      context,
      resultType: typeof result
    }, LOG_CATEGORIES.DATABASE);

    return result;
  } catch (error) {
    logger.error('Operation failed', {
      operation: operation.name,
      context,
      error: error.message,
      stack: error.stack
    }, LOG_CATEGORIES.ERROR);

    throw error;
  }
}

// Usage example
static async getCurrentActiveTerm(sectionId) {
  return this.safeOperation(
    () => IndexedDBService.get(this.STORE_NAME, sectionId),
    { sectionId, operation: 'getCurrentActiveTerm' }
  );
}
```

### Data Normalization

```javascript
static _normalizeData(rawData) {
  // Handle field name variations
  const normalized = {
    id: String(rawData.id || rawData.identifier),
    name: String(rawData.name || rawData.title || ''),
    startDate: this._normalizeDate(rawData.startDate || rawData.start_date),
    endDate: this._normalizeDate(rawData.endDate || rawData.end_date),
    lastUpdated: Date.now()
  };

  // Validate required fields
  if (!normalized.id || !normalized.name) {
    throw new Error('Missing required fields in data normalization');
  }

  return normalized;
}

static _normalizeDate(dateValue) {
  if (!dateValue) return null;

  // Handle various date formats
  if (typeof dateValue === 'string') {
    return dateValue; // Assume YYYY-MM-DD format
  }

  if (dateValue instanceof Date) {
    return dateValue.toISOString().split('T')[0];
  }

  if (typeof dateValue === 'number') {
    return new Date(dateValue).toISOString().split('T')[0];
  }

  return null;
}
```

## Testing Strategies

### Unit Test Template

```javascript
describe('{EntityName}Service', () => {
  beforeEach(async () => {
    // Clear test data
    await {EntityName}Service.clear{Entities}();

    // Setup test data
    await setupTestData();
  });

  afterEach(async () => {
    // Cleanup
    await {EntityName}Service.clear{Entities}();
  });

  describe('Core Operations', () => {
    test('should get entity by ID', async () => {
      const testId = 'test_123';
      const testData = { /* test data */ };

      await {EntityName}Service.set{Entity}(testId, testData);
      const result = await {EntityName}Service.get{Entity}(testId);

      expect(result).toBeDefined();
      expect(result.id).toBe(testId);
      expect(result.name).toBe(testData.name);
    });

    test('should return null for non-existent entity', async () => {
      const result = await {EntityName}Service.get{Entity}('non_existent');
      expect(result).toBeNull();
    });

    test('should set entity data', async () => {
      const testId = 'test_456';
      const testData = { /* test data */ };

      const success = await {EntityName}Service.set{Entity}(testId, testData);
      expect(success).toBe(true);

      const stored = await {EntityName}Service.get{Entity}(testId);
      expect(stored).toMatchObject(testData);
    });
  });

  describe('Batch Operations', () => {
    test('should get all entities', async () => {
      // Setup multiple entities
      await Promise.all([
        {EntityName}Service.set{Entity}('1', testData1),
        {EntityName}Service.set{Entity}('2', testData2),
        {EntityName}Service.set{Entity}('3', testData3)
      ]);

      const allEntities = await {EntityName}Service.getAll{Entities}();
      expect(allEntities).toHaveLength(3);
    });

    test('should get entities updated since timestamp', async () => {
      const beforeTime = Date.now();

      await {EntityName}Service.set{Entity}('recent', testData);

      const afterTime = Date.now();

      const recent = await {EntityName}Service.get{Entities}UpdatedSince(beforeTime);
      expect(recent).toHaveLength(1);
      expect(recent[0].id).toBe('recent');

      const none = await {EntityName}Service.get{Entities}UpdatedSince(afterTime);
      expect(none).toHaveLength(0);
    });
  });

  describe('Migration', () => {
    test('should migrate from legacy blob storage', async () => {
      // Setup legacy blob data
      const legacyData = { /* mock blob structure */ };
      await UnifiedStorageService.set('legacy_key', legacyData);

      const stats = await {EntityName}Service.migrateFrom{Legacy}();

      expect(stats.migrated).toBeGreaterThan(0);
      expect(stats.errors).toBe(0);

      // Verify migrated data
      const migrated = await {EntityName}Service.getAll{Entities}();
      expect(migrated.length).toBe(stats.migrated);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid data gracefully', async () => {
      await expect(
        {EntityName}Service.set{Entity}('invalid', null)
      ).rejects.toThrow();
    });

    test('should handle database errors', async () => {
      // Mock database failure
      const originalGet = IndexedDBService.get;
      IndexedDBService.get = jest.fn().mockRejectedValue(new Error('DB Error'));

      await expect(
        {EntityName}Service.get{Entity}('test')
      ).rejects.toThrow('DB Error');

      // Restore
      IndexedDBService.get = originalGet;
    });
  });
});
```

### Integration Test Patterns

```javascript
describe('{EntityName}Service Integration', () => {
  test('should integrate with consumer services', async () => {
    // Test integration with other services
    const entityId = 'integration_test';
    const testData = { /* test data */ };

    // Setup entity
    await {EntityName}Service.set{Entity}(entityId, testData);

    // Test consumer service integration
    const consumerResult = await ConsumerService.useEntity(entityId);
    expect(consumerResult).toBeDefined();
    expect(consumerResult.entityId).toBe(entityId);
  });

  test('should handle concurrent access', async () => {
    const entityId = 'concurrent_test';

    // Simulate concurrent access
    const promises = Array.from({ length: 10 }, (_, i) =>
      {EntityName}Service.set{Entity}(entityId, { counter: i })
    );

    await Promise.all(promises);

    // Verify final state
    const result = await {EntityName}Service.get{Entity}(entityId);
    expect(result).toBeDefined();
    expect(result.counter).toBeGreaterThanOrEqual(0);
  });
});
```

## Monitoring & Debugging

### Performance Monitoring

```javascript
class StorageMonitor {
  constructor(serviceName) {
    this.serviceName = serviceName;
    this.metrics = {
      operations: new Map(),
      errors: new Map(),
      performanceTrends: []
    };
  }

  recordOperation(operation, duration, success) {
    const key = `${this.serviceName}.${operation}`;

    if (!this.metrics.operations.has(key)) {
      this.metrics.operations.set(key, {
        count: 0,
        totalTime: 0,
        errors: 0,
        avgTime: 0
      });
    }

    const stats = this.metrics.operations.get(key);
    stats.count++;
    stats.totalTime += duration;
    stats.avgTime = stats.totalTime / stats.count;

    if (!success) {
      stats.errors++;
    }

    // Track performance trends
    this.metrics.performanceTrends.push({
      timestamp: Date.now(),
      operation: key,
      duration,
      success
    });

    // Keep only recent trends (last 1000 operations)
    if (this.metrics.performanceTrends.length > 1000) {
      this.metrics.performanceTrends.shift();
    }
  }

  getMetrics() {
    return {
      operations: Object.fromEntries(this.metrics.operations),
      trends: this.metrics.performanceTrends.slice(-100) // Last 100 operations
    };
  }
}

// Usage in service
const monitor = new StorageMonitor('CurrentActiveTermsService');

static async monitoredOperation(operation, ...args) {
  const start = performance.now();
  let success = false;

  try {
    const result = await operation.apply(this, args);
    success = true;
    return result;
  } catch (error) {
    throw error;
  } finally {
    const duration = performance.now() - start;
    monitor.recordOperation(operation.name, duration, success);
  }
}
```

### Debug Utilities

```javascript
class StorageDebugger {
  static async diagnoseStorageIssues(serviceName, entityId) {
    const diagnosis = {
      timestamp: Date.now(),
      serviceName,
      entityId,
      issues: [],
      recommendations: []
    };

    // Check database connectivity
    try {
      const db = await IndexedDBService.getDB();
      if (!db) {
        diagnosis.issues.push('Database connection failed');
        diagnosis.recommendations.push('Check IndexedDB support and availability');
      }
    } catch (error) {
      diagnosis.issues.push(`Database error: ${error.message}`);
    }

    // Check data integrity
    try {
      const entity = await Service.get{Entity}(entityId);
      if (!entity) {
        diagnosis.issues.push('Entity not found');
      } else {
        // Validate entity structure
        const validation = this._validateEntityStructure(entity);
        if (!validation.valid) {
          diagnosis.issues.push(`Invalid entity structure: ${validation.errors.join(', ')}`);
          diagnosis.recommendations.push('Run data migration or cleanup');
        }
      }
    } catch (error) {
      diagnosis.issues.push(`Entity retrieval error: ${error.message}`);
    }

    // Check performance metrics
    const metrics = monitor.getMetrics();
    const avgGetTime = metrics.operations[`${serviceName}.get{Entity}`]?.avgTime;
    if (avgGetTime && avgGetTime > 10) { // 10ms threshold
      diagnosis.issues.push(`Slow performance: ${avgGetTime.toFixed(2)}ms average`);
      diagnosis.recommendations.push('Consider adding indexes or optimizing queries');
    }

    return diagnosis;
  }

  static _validateEntityStructure(entity) {
    const errors = [];

    if (!entity.id) errors.push('Missing id field');
    if (!entity.lastUpdated) errors.push('Missing lastUpdated field');
    if (typeof entity.lastUpdated !== 'number') errors.push('Invalid lastUpdated type');

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
```

### Logging Best Practices

```javascript
// Structured logging for storage operations
class StorageLogger {
  static logOperation(service, operation, context, result = null, error = null) {
    const logData = {
      service,
      operation,
      context,
      timestamp: Date.now(),
      duration: context.duration || null,
      success: !error
    };

    if (result) {
      logData.resultType = typeof result;
      logData.resultSize = Array.isArray(result) ? result.length : null;
    }

    if (error) {
      logData.error = {
        message: error.message,
        stack: error.stack
      };
    }

    if (error) {
      logger.error(`${service}.${operation} failed`, logData, LOG_CATEGORIES.ERROR);
    } else {
      logger.debug(`${service}.${operation} completed`, logData, LOG_CATEGORIES.DATABASE);
    }
  }
}

// Usage in service methods
static async getCurrentActiveTerm(sectionId) {
  const start = performance.now();
  const context = { sectionId, operation: 'getCurrentActiveTerm' };

  try {
    const result = await IndexedDBService.get(this.STORE_NAME, sectionId);

    context.duration = performance.now() - start;
    StorageLogger.logOperation('CurrentActiveTermsService', 'getCurrentActiveTerm', context, result);

    return result;
  } catch (error) {
    context.duration = performance.now() - start;
    StorageLogger.logOperation('CurrentActiveTermsService', 'getCurrentActiveTerm', context, null, error);

    throw error;
  }
}
```

## Best Practices Summary

### ✅ Do
- **Measure performance before and after changes**
- **Use primary keys for direct lookups (O(1))**
- **Add indexes for common query patterns**
- **Implement comprehensive error handling**
- **Provide migration paths from legacy storage**
- **Include diagnostic and monitoring utilities**
- **Write comprehensive tests for all operations**
- **Use structured logging with consistent categories**
- **Normalize data consistently across services**
- **Validate data integrity during migrations**

### ❌ Don't
- **Scan large datasets when indexed lookups are available**
- **Ignore performance benchmarking**
- **Break backward compatibility without migration paths**
- **Skip error handling in storage operations**
- **Mix storage concerns with business logic**
- **Forget to clean up deprecated storage after migration**
- **Implement complex queries without proper indexing**
- **Ignore memory usage in large batch operations**
- **Skip data validation in service boundaries**
- **Use blob storage for frequently accessed data**

---

**Last Updated**: September 2024
**Next Review**: After next storage migration project