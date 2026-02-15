import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../utils/sentry.js', () => ({
  sentryUtils: {
    captureException: vi.fn(),
  },
}));

vi.mock('../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  LOG_CATEGORIES: {
    DATABASE: 'DATABASE',
    ERROR: 'ERROR',
  },
}));

vi.mock('../../../../config/demoMode.js', () => ({
  isDemoMode: vi.fn(() => false),
}));

import { IndexedDBService, getDB } from '../indexedDBService.js';

describe('Sections Normalization - IndexedDB Integration', () => {
  beforeEach(async () => {
    const db = await getDB();
    const tx = db.transaction('sections', 'readwrite');
    await tx.objectStore('sections').clear();
    await tx.done;
  });

  it('bulkReplaceSections stores individual records keyed by sectionid', async () => {
    await IndexedDBService.bulkReplaceSections([
      { sectionid: 1, sectionname: 'Cubs', sectiontype: 'cubs' },
      { sectionid: 2, sectionname: 'Scouts', sectiontype: 'scouts' },
    ]);

    const result = await IndexedDBService.getAllSections();
    expect(result).toHaveLength(2);
    expect(result.find(s => s.sectionid === 1)).toBeDefined();
    expect(result.find(s => s.sectionid === 2)).toBeDefined();

    for (const record of result) {
      expect(record).toHaveProperty('sectionid');
      expect(record).toHaveProperty('sectionname');
      expect(record).toHaveProperty('sectiontype');
      expect(record).toHaveProperty('updated_at');
    }
  });

  it('bulkReplaceSections replaces all records atomically', async () => {
    await IndexedDBService.bulkReplaceSections([
      { sectionid: 1, sectionname: 'Section A', sectiontype: 'a' },
      { sectionid: 2, sectionname: 'Section B', sectiontype: 'b' },
    ]);

    await IndexedDBService.bulkReplaceSections([
      { sectionid: 3, sectionname: 'Section C', sectiontype: 'c' },
      { sectionid: 4, sectionname: 'Section D', sectiontype: 'd' },
    ]);

    const result = await IndexedDBService.getAllSections();
    expect(result).toHaveLength(2);

    const ids = result.map(s => s.sectionid);
    expect(ids).toContain(3);
    expect(ids).toContain(4);
    expect(ids).not.toContain(1);
    expect(ids).not.toContain(2);
  });

  it('bulkReplaceSections with empty array clears all sections', async () => {
    await IndexedDBService.bulkReplaceSections([
      { sectionid: 1, sectionname: 'Cubs', sectiontype: 'cubs' },
      { sectionid: 2, sectionname: 'Scouts', sectiontype: 'scouts' },
    ]);

    await IndexedDBService.bulkReplaceSections([]);

    const result = await IndexedDBService.getAllSections();
    expect(result).toEqual([]);
  });

  it('getAllSections returns empty array when no sections exist', async () => {
    const result = await IndexedDBService.getAllSections();
    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('sections store has sectiontype index', async () => {
    await IndexedDBService.bulkReplaceSections([
      { sectionid: 1, sectionname: 'Cubs Pack 1', sectiontype: 'cubs' },
      { sectionid: 2, sectionname: 'Scouts Troop 1', sectiontype: 'scouts' },
      { sectionid: 3, sectionname: 'Cubs Pack 2', sectiontype: 'cubs' },
    ]);

    const db = await getDB();
    const tx = db.transaction('sections', 'readonly');
    const store = tx.objectStore('sections');
    const index = store.index('sectiontype');
    const cubsSections = await index.getAll('cubs');
    await tx.done;

    expect(cubsSections).toHaveLength(2);
    expect(cubsSections.every(s => s.sectiontype === 'cubs')).toBe(true);
  });
});
