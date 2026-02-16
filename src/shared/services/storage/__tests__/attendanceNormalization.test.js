import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../utils/sentry.js', () => ({
  sentryUtils: {
    captureException: vi.fn(),
    captureMessage: vi.fn(),
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
import { AttendanceSchema } from '../schemas/validation.js';

describe('Attendance Normalization - IndexedDB Integration', () => {
  beforeEach(async () => {
    const db = await getDB();

    const attTx = db.transaction('attendance', 'readwrite');
    await attTx.objectStore('attendance').clear();
    await attTx.done;

    const metaTx = db.transaction('shared_event_metadata', 'readwrite');
    await metaTx.objectStore('shared_event_metadata').clear();
    await metaTx.done;
  });

  it('stores and retrieves attendance by event', async () => {
    await IndexedDBService.bulkReplaceAttendanceForEvent('evt1', [
      { eventid: 'evt1', scoutid: 100, sectionid: 1, attending: 'Yes', patrol: 'Alpha' },
      { eventid: 'evt1', scoutid: 200, sectionid: 1, attending: 'No', patrol: 'Beta' },
      { eventid: 'evt1', scoutid: 300, sectionid: 1, attending: 'Invited' },
    ]);

    const result = await IndexedDBService.getAttendanceByEvent('evt1');
    expect(result).toHaveLength(3);

    const scoutIds = result.map(r => r.scoutid);
    expect(scoutIds).toContain(100);
    expect(scoutIds).toContain(200);
    expect(scoutIds).toContain(300);
  });

  it('retrieves attendance by scout across events', async () => {
    await IndexedDBService.bulkReplaceAttendanceForEvent('evtA', [
      { eventid: 'evtA', scoutid: 100, sectionid: 1, attending: 'Yes' },
      { eventid: 'evtA', scoutid: 200, sectionid: 1, attending: 'No' },
    ]);

    await IndexedDBService.bulkReplaceAttendanceForEvent('evtB', [
      { eventid: 'evtB', scoutid: 100, sectionid: 1, attending: 'No' },
    ]);

    const scout100 = await IndexedDBService.getAttendanceByScout(100);
    expect(scout100).toHaveLength(2);

    const eventIds = scout100.map(r => r.eventid);
    expect(eventIds).toContain('evtA');
    expect(eventIds).toContain('evtB');
  });

  it('retrieves single attendance record by compound key', async () => {
    await IndexedDBService.bulkReplaceAttendanceForEvent('evt1', [
      { eventid: 'evt1', scoutid: 100, sectionid: 1, attending: 'Yes' },
      { eventid: 'evt1', scoutid: 200, sectionid: 1, attending: 'No' },
    ]);

    const found = await IndexedDBService.getAttendanceRecord('evt1', 100);
    expect(found).toBeDefined();
    expect(found.scoutid).toBe(100);
    expect(found.attending).toBe('Yes');

    const missing = await IndexedDBService.getAttendanceRecord('evt1', 999);
    expect(missing).toBeNull();
  });

  it('per-event atomic replacement preserves other events', async () => {
    await IndexedDBService.bulkReplaceAttendanceForEvent('evtA', [
      { eventid: 'evtA', scoutid: 100, sectionid: 1, attending: 'Yes' },
    ]);

    await IndexedDBService.bulkReplaceAttendanceForEvent('evtB', [
      { eventid: 'evtB', scoutid: 200, sectionid: 2, attending: 'No' },
    ]);

    await IndexedDBService.bulkReplaceAttendanceForEvent('evtA', [
      { eventid: 'evtA', scoutid: 300, sectionid: 1, attending: 'Invited' },
    ]);

    const evtA = await IndexedDBService.getAttendanceByEvent('evtA');
    expect(evtA).toHaveLength(1);
    expect(evtA[0].scoutid).toBe(300);

    const evtB = await IndexedDBService.getAttendanceByEvent('evtB');
    expect(evtB).toHaveLength(1);
    expect(evtB[0].scoutid).toBe(200);
  });

  it('shared and regular attendance coexist in same store', async () => {
    const db = await getDB();
    const tx = db.transaction('attendance', 'readwrite');
    const store = tx.objectStore('attendance');

    await store.put({ eventid: 'evt1', scoutid: 100, sectionid: 1, attending: 'Yes', updated_at: Date.now() });
    await store.put({ eventid: 'evt1', scoutid: 200, sectionid: 2, attending: 'No', isSharedSection: true, updated_at: Date.now() });
    await tx.done;

    const all = await IndexedDBService.getAttendanceByEvent('evt1');
    expect(all).toHaveLength(2);

    const shared = all.filter(r => r.isSharedSection === true);
    const regular = all.filter(r => !r.isSharedSection);
    expect(shared).toHaveLength(1);
    expect(regular).toHaveLength(1);
  });

  it('shared event metadata CRUD', async () => {
    const metadata = {
      eventid: 'evt1',
      isSharedEvent: true,
      ownerSectionId: 1,
      sections: [
        { sectionid: 1, sectionname: 'Beavers' },
        { sectionid: 2, sectionname: 'Cubs' },
      ],
    };

    await IndexedDBService.saveSharedEventMetadata(metadata);

    const retrieved = await IndexedDBService.getSharedEventMetadata('evt1');
    expect(retrieved).toBeDefined();
    expect(retrieved.eventid).toBe('evt1');
    expect(retrieved.sections).toHaveLength(2);

    await IndexedDBService.saveSharedEventMetadata({
      eventid: 'evt2',
      isSharedEvent: true,
      ownerSectionId: 2,
      sections: [{ sectionid: 2, sectionname: 'Cubs' }],
    });

    const allMetadata = await IndexedDBService.getAllSharedEventMetadata();
    expect(allMetadata).toHaveLength(2);
  });

  it('compound key type coercion', async () => {
    const db = await getDB();
    const tx = db.transaction('attendance', 'readwrite');
    await tx.objectStore('attendance').put({
      eventid: 'evt1',
      scoutid: 100,
      sectionid: 1,
      attending: 'Yes',
      updated_at: Date.now(),
    });
    await tx.done;

    const record = await IndexedDBService.getAttendanceRecord(String('evt1'), Number(100));
    expect(record).toBeDefined();
    expect(record.eventid).toBe('evt1');
    expect(record.scoutid).toBe(100);

    const byEvent = await IndexedDBService.getAttendanceByEvent('evt1');
    expect(byEvent).toHaveLength(1);

    const byScout = await IndexedDBService.getAttendanceByScout(100);
    expect(byScout).toHaveLength(1);
  });

  it('attending value normalization', () => {
    const testCases = [
      { input: 'yes', expected: 'Yes' },
      { input: '1', expected: 'Yes' },
      { input: 'No', expected: 'No' },
      { input: 'invited', expected: 'Invited' },
      { input: 'Shown', expected: 'Shown' },
      { input: '0', expected: 'No' },
    ];

    for (const { input, expected } of testCases) {
      const result = AttendanceSchema.parse({
        scoutid: 1,
        eventid: 'evt1',
        sectionid: 1,
        attending: input,
      });
      expect(result.attending).toBe(expected);
    }
  });
});
