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

describe('Events Normalization - IndexedDB Integration', () => {
  beforeEach(async () => {
    const db = await getDB();
    const tx = db.transaction('events', 'readwrite');
    await tx.objectStore('events').clear();
    await tx.done;
  });

  it('should store and retrieve events by section', async () => {
    await IndexedDBService.bulkReplaceEventsForSection(1, [
      { eventid: 'evt1', sectionid: 1, termid: 't1', name: 'Camp', startdate: '2026-03-01' },
      { eventid: 'evt2', sectionid: 1, termid: 't1', name: 'Hike', startdate: '2026-03-15' },
    ]);

    const result = await IndexedDBService.getEventsBySection(1);
    expect(result).toHaveLength(2);

    const ids = result.map(e => e.eventid);
    expect(ids).toContain('evt1');
    expect(ids).toContain('evt2');
  });

  it('should replace only events for target section (section-scoped)', async () => {
    await IndexedDBService.bulkReplaceEventsForSection(1, [
      { eventid: 'evt1', sectionid: 1, termid: 't1', name: 'Camp', startdate: '2026-03-01' },
      { eventid: 'evt2', sectionid: 1, termid: 't1', name: 'Hike', startdate: '2026-03-15' },
    ]);

    await IndexedDBService.bulkReplaceEventsForSection(2, [
      { eventid: 'evt3', sectionid: 2, termid: 't1', name: 'Meeting', startdate: '2026-04-01' },
    ]);

    await IndexedDBService.bulkReplaceEventsForSection(1, [
      { eventid: 'evt4', sectionid: 1, termid: 't2', name: 'New Camp', startdate: '2026-05-01' },
    ]);

    const section1Events = await IndexedDBService.getEventsBySection(1);
    expect(section1Events).toHaveLength(1);
    expect(section1Events[0].eventid).toBe('evt4');

    const section2Events = await IndexedDBService.getEventsBySection(2);
    expect(section2Events).toHaveLength(1);
    expect(section2Events[0].eventid).toBe('evt3');
  });

  it('should retrieve events by term', async () => {
    await IndexedDBService.bulkReplaceEventsForSection(1, [
      { eventid: 'evt1', sectionid: 1, termid: 't1', name: 'Camp', startdate: '2026-03-01' },
      { eventid: 'evt2', sectionid: 1, termid: 't2', name: 'Hike', startdate: '2026-06-15' },
    ]);

    await IndexedDBService.bulkReplaceEventsForSection(2, [
      { eventid: 'evt3', sectionid: 2, termid: 't1', name: 'Meeting', startdate: '2026-04-01' },
    ]);

    const t1Events = await IndexedDBService.getEventsByTerm('t1');
    expect(t1Events).toHaveLength(2);

    const t1Ids = t1Events.map(e => e.eventid);
    expect(t1Ids).toContain('evt1');
    expect(t1Ids).toContain('evt3');
  });

  it('should retrieve single event by ID', async () => {
    await IndexedDBService.bulkReplaceEventsForSection(1, [
      { eventid: 'evt1', sectionid: 1, termid: 't1', name: 'Camp', startdate: '2026-03-01' },
      { eventid: 'evt2', sectionid: 1, termid: 't1', name: 'Hike', startdate: '2026-03-15' },
    ]);

    const event = await IndexedDBService.getEventById('evt1');
    expect(event).toBeDefined();
    expect(event.eventid).toBe('evt1');
    expect(event.name).toBe('Camp');

    const missing = await IndexedDBService.getEventById('nonexistent');
    expect(missing).toBeNull();
  });

  it('should handle empty section gracefully', async () => {
    const result = await IndexedDBService.getEventsBySection(999);
    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);

    const count = await IndexedDBService.bulkReplaceEventsForSection(999, []);
    expect(count).toBe(0);
  });

  it('should handle bulk replace atomically (all-or-nothing)', async () => {
    await IndexedDBService.bulkReplaceEventsForSection(1, [
      { eventid: 'old1', sectionid: 1, termid: 't1', name: 'Old Event 1', startdate: '2026-01-01' },
      { eventid: 'old2', sectionid: 1, termid: 't1', name: 'Old Event 2', startdate: '2026-01-15' },
    ]);

    await IndexedDBService.bulkReplaceEventsForSection(1, [
      { eventid: 'new1', sectionid: 1, termid: 't2', name: 'New Event 1', startdate: '2026-06-01' },
      { eventid: 'new2', sectionid: 1, termid: 't2', name: 'New Event 2', startdate: '2026-06-15' },
      { eventid: 'new3', sectionid: 1, termid: 't2', name: 'New Event 3', startdate: '2026-07-01' },
    ]);

    const events = await IndexedDBService.getEventsBySection(1);
    expect(events).toHaveLength(3);

    const ids = events.map(e => e.eventid);
    expect(ids).toContain('new1');
    expect(ids).toContain('new2');
    expect(ids).toContain('new3');
    expect(ids).not.toContain('old1');
    expect(ids).not.toContain('old2');
  });
});
